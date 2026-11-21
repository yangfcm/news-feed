// The Worker behind /api/*. Every other request is served from web/out by Cloudflare without
// running this code (wrangler.jsonc, "run_worker_first").
//
//   GET /api/me   The signed-in user, made on their first visit. Needs a Firebase ID token
//                 for a verified email: Authorization: Bearer <token>. The browser's time zone
//                 goes in X-Time-Zone, and is used only when the user is new.

import { InvalidTokenError, verifyIdToken } from "./token.ts";
import { syncUser } from "./users.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** The Firebase project whose ID tokens are accepted. */
  FIREBASE_PROJECT_ID: string;
  /**
   * "true" accepts the unsigned tokens of the Firebase Auth emulator. Only for `wrangler dev`,
   * set in .dev.vars; it is ignored unless the request is for localhost.
   */
  FIREBASE_AUTH_EMULATOR?: string;
  /** An origin allowed to call the API from another port, such as http://localhost:3000 for `next dev`. */
  DEV_ALLOWED_ORIGIN?: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    // A request that matches no file in web/out comes here too; let the assets answer it, which
    // serves the site's 404 page.
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method === "OPTIONS" && cors) return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/api/me" && url.pathname !== "/api/me/") return json({ error: "not_found" }, 404, cors);
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { ...cors, Allow: "GET" });
    if (!env.FIREBASE_PROJECT_ID) return json({ error: "not_configured" }, 500, cors);

    const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return json({ error: "unauthenticated" }, 401, cors);

    let identity;
    try {
      identity = await verifyIdToken(token, {
        projectId: env.FIREBASE_PROJECT_ID,
        emulator: env.FIREBASE_AUTH_EMULATOR === "true" && LOCAL_HOSTS.has(url.hostname),
      });
    } catch (err) {
      if (err instanceof InvalidTokenError) return json({ error: "invalid_token" }, 401, cors);
      throw err;
    }
    if (!identity.emailVerified) return json({ error: "email_not_verified" }, 403, cors);

    const result = await syncUser(env.DB, identity, {
      timeZone: validTimeZone(request.headers.get("X-Time-Zone")),
      country: validCountry(request.cf?.country),
    });
    if ("error" in result) return json({ error: result.error }, result.error === "email_in_use" ? 409 : 500, cors);
    if (result.user.status === "disabled") return json({ error: "disabled" }, 403, cors);
    return json({ user: result.user }, 200, cors);
  },
} satisfies ExportedHandler<Env>;

function json(body: unknown, status: number, headers: Record<string, string> | null = null): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** CORS headers for the one origin allowed in development, else null. */
function corsHeaders(request: Request, env: Env): Record<string, string> | null {
  const origin = request.headers.get("Origin");
  if (!env.DEV_ALLOWED_ORIGIN || origin !== env.DEV_ALLOWED_ORIGIN) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, X-Time-Zone",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

/** An IANA time zone the runtime knows, else UTC. */
function validTimeZone(value: string | null): string {
  if (!value || value.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/** Cloudflare's country code, unless it is unknown (XX) or Tor (T1). */
function validCountry(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1" ? value : null;
}
