// The Worker as a whole, run by wrangler's test harness with a local D1 that has the
// migrations applied. Tokens are the emulator's unsigned kind, which the Worker accepts here
// because FIREBASE_AUTH_EMULATOR is on and the requests are for localhost.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import type { Env } from "../src/index.ts";
import { claims, PROJECT, unsigned } from "./helpers.ts";

const root = new URL("..", import.meta.url).pathname;
const ORIGIN = "http://localhost:3000";
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// A stand-in for web/out: one page and the 404 page, so the tests don't need a site build.
const assets = mkdtempSync(join(tmpdir(), "news-feed-assets-"));
mkdirSync(join(assets, "login"));
writeFileSync(join(assets, "login", "index.html"), "<p>sign in page</p>");
writeFileSync(join(assets, "404.html"), "<p>site 404 page</p>");

const server = createTestHarness({
  root,
  workers: [
    {
      // As wrangler.jsonc, with the stand-in assets and test vars.
      config: {
        name: "news-feed-test",
        main: "src/index.ts",
        compatibility_date: "2026-10-01",
        assets: {
          directory: assets,
          binding: "ASSETS",
          html_handling: "auto-trailing-slash",
          not_found_handling: "404-page",
          run_worker_first: ["/api/*"],
        },
        d1_databases: [{ binding: "DB", database_name: "news-feed-test", database_id: "00000000-0000-0000-0000-000000000000" }],
        vars: { FIREBASE_PROJECT_ID: PROJECT, FIREBASE_AUTH_EMULATOR: "true", DEV_ALLOWED_ORIGIN: ORIGIN },
      },
    },
  ],
});

let db: D1Database;

before(async () => {
  await server.listen();
  db = (await server.getWorker<Env>().getEnv()).DB;
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    for (const statement of unstable_splitSqlQuery(sql)) await db.prepare(statement).run();
  }
});

after(async () => {
  await server.close();
  rmSync(assets, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.prepare("DELETE FROM users").run();
  await db.prepare("UPDATE app_settings SET signup_requires_approval = 0").run();
});

type Init = { token?: string; url?: string; method?: string; headers?: Record<string, string> };

async function call({ token, url = "http://localhost:8787/api/me", method = "GET", headers = {} }: Init = {}) {
  const response = await server.fetch(url, {
    method,
    headers: { "X-Time-Zone": "Australia/Sydney", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

const tokenFor = (sub: string, email = `${sub}@example.com`, extra = {}) => unsigned(claims({ sub, email, ...extra }));
const row = (sub: string) => db.prepare("SELECT * FROM users WHERE auth_subject = ?1").bind(sub).first<Record<string, unknown>>();

describe("GET /api/me, refusals", () => {
  it("needs a token", async () => {
    const { status, body } = await call();
    assert.equal(status, 401);
    assert.deepEqual(body, { error: "unauthenticated" });
  });

  it("rejects a malformed token", async () => {
    const { status, body } = await call({ token: "nonsense" });
    assert.equal(status, 401);
    assert.deepEqual(body, { error: "invalid_token" });
  });

  it("refuses an unverified email, and makes no user", async () => {
    const { status, body } = await call({ token: tokenFor("u-unverified", undefined, { email_verified: false }) });
    assert.equal(status, 403);
    assert.deepEqual(body, { error: "email_not_verified" });
    assert.equal(await row("u-unverified"), null);
  });

  it("refuses the emulator's unsigned tokens when the request isn't for localhost", async () => {
    const { status, body } = await call({ token: tokenFor("u-remote"), url: "https://news.example.com/api/me" });
    assert.equal(status, 401);
    assert.deepEqual(body, { error: "invalid_token" });
  });

  it("answers only GET /api/me", async () => {
    assert.equal((await call({ token: tokenFor("u1"), method: "POST" })).status, 405);
    assert.equal((await call({ token: tokenFor("u1"), url: "http://localhost:8787/api/other" })).status, 404);
  });

  it("never lets a response be cached", async () => {
    assert.equal((await call()).headers.get("Cache-Control"), "no-store");
  });
});

describe("GET /api/me, users", () => {
  it("makes an active user on the first visit when approval is off", async () => {
    const { status, body } = await call({ token: tokenFor("u1") });
    assert.equal(status, 200);
    assert.equal(body.user.email, "u1@example.com");
    assert.equal(body.user.status, "active");
    assert.equal(body.user.role, "member");
    assert.equal(body.user.timeZone, "Australia/Sydney");
    // The harness reports a fixed country of its own; any two-letter code will do.
    assert.match(body.user.country, /^[A-Z]{2}$/);
    assert.match(body.user.createdAt, TIMESTAMP);
    assert.equal(body.user.approvedAt, body.user.createdAt);
  });

  it("makes a pending user when approval is on, who becomes active once approved", async () => {
    await db.prepare("UPDATE app_settings SET signup_requires_approval = 1").run();
    const first = await call({ token: tokenFor("u2") });
    assert.equal(first.status, 200);
    assert.equal(first.body.user.status, "pending");
    assert.equal(first.body.user.approvedAt, null);

    await db.prepare("UPDATE users SET status = 'active', approved_at = '2026-11-21T09:00:00Z' WHERE auth_subject = 'u2'").run();
    const later = await call({ token: tokenFor("u2") });
    assert.equal(later.body.user.status, "active");
    assert.equal(later.body.user.id, first.body.user.id);
  });

  it("keeps the users made before approval was turned on as they are", async () => {
    await call({ token: tokenFor("u3") });
    await db.prepare("UPDATE app_settings SET signup_requires_approval = 1").run();
    assert.equal((await call({ token: tokenFor("u3") })).body.user.status, "active");
  });

  it("returns the same user on later visits", async () => {
    const a = await call({ token: tokenFor("u4") });
    const b = await call({ token: tokenFor("u4") });
    assert.equal(a.body.user.id, b.body.user.id);
    assert.equal((await db.prepare("SELECT count(*) AS n FROM users").first<{ n: number }>())?.n, 1);
  });

  it("falls back to UTC for a time zone it doesn't know", async () => {
    const { body } = await call({ token: tokenFor("u5"), headers: { "X-Time-Zone": "Mars/Olympus_Mons" } });
    assert.equal(body.user.timeZone, "UTC");
  });

  it("writes last_seen_at at most once an hour", async () => {
    await call({ token: tokenFor("u6") });
    await db.prepare("UPDATE users SET last_seen_at = '2026-01-01T00:00:00Z' WHERE auth_subject = 'u6'").run();
    await call({ token: tokenFor("u6") });
    const seen = (await row("u6"))?.last_seen_at as string;
    assert.match(seen, TIMESTAMP);
    assert.notEqual(seen, "2026-01-01T00:00:00Z");

    await call({ token: tokenFor("u6") });
    assert.equal((await row("u6"))?.last_seen_at, seen);
  });

  it("refreshes the email from the token", async () => {
    await call({ token: tokenFor("u7", "old@example.com") });
    const { body } = await call({ token: tokenFor("u7", "new@example.com") });
    assert.equal(body.user.email, "new@example.com");
    assert.equal((await row("u7"))?.email, "new@example.com");
  });

  it("keeps the old email when the new one belongs to another user", async () => {
    await call({ token: tokenFor("u8", "taken@example.com") });
    await call({ token: tokenFor("u9", "mine@example.com") });
    const { status, body } = await call({ token: tokenFor("u9", "taken@example.com") });
    assert.equal(status, 200);
    assert.equal(body.user.email, "mine@example.com");
  });

  it("refuses a new Firebase account whose email an existing user has", async () => {
    await call({ token: tokenFor("u10", "same@example.com") });
    const { status, body } = await call({ token: tokenFor("u11", "same@example.com") });
    assert.equal(status, 409);
    assert.deepEqual(body, { error: "email_in_use" });
  });

  it("refuses a disabled user", async () => {
    await call({ token: tokenFor("u12") });
    await db.prepare("UPDATE users SET status = 'disabled' WHERE auth_subject = 'u12'").run();
    const { status, body } = await call({ token: tokenFor("u12") });
    assert.equal(status, 403);
    assert.deepEqual(body, { error: "disabled" });
  });

  it("reports a missing settings row instead of making a user", async () => {
    await db.prepare("DELETE FROM app_settings").run();
    try {
      const { status, body } = await call({ token: tokenFor("u13") });
      assert.equal(status, 500);
      assert.deepEqual(body, { error: "not_configured" });
    } finally {
      await db.prepare("INSERT INTO app_settings (id, updated_at) VALUES (1, '2026-11-21T00:00:00Z')").run();
    }
  });
});

describe("routing", () => {
  it("serves a page from the assets", async () => {
    const response = await server.fetch("http://localhost:8787/login/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /sign in page/);
  });

  it("answers an unknown page with the site's 404 page, not the API's", async () => {
    const response = await server.fetch("http://localhost:8787/no-such-page/");
    assert.equal(response.status, 404);
    assert.match(await response.text(), /site 404 page/);
  });

  it("answers an unknown API path with JSON", async () => {
    const response = await server.fetch("http://localhost:8787/api/nothing");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  });
});

describe("CORS for the development origin", () => {
  it("answers a preflight from that origin", async () => {
    const { status, headers } = await call({ method: "OPTIONS", headers: { Origin: ORIGIN } });
    assert.equal(status, 204);
    assert.equal(headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.match(headers.get("Access-Control-Allow-Headers") ?? "", /Authorization/);
  });

  it("allows that origin to read responses", async () => {
    assert.equal((await call({ token: tokenFor("u14"), headers: { Origin: ORIGIN } })).headers.get("Access-Control-Allow-Origin"), ORIGIN);
  });

  it("gives no CORS headers to any other origin", async () => {
    assert.equal((await call({ token: tokenFor("u15"), headers: { Origin: "https://evil.example" } })).headers.get("Access-Control-Allow-Origin"), null);
  });
});
