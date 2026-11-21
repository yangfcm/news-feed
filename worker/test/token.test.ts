import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import { InvalidTokenError, verifyIdToken } from "../src/token.ts";
import { isoSeconds } from "../src/time.ts";
import { claims, PROJECT, signingKey, unsigned } from "./helpers.ts";

const rejects = (promise: Promise<unknown>) => assert.rejects(promise, InvalidTokenError);

describe("verifyIdToken, signed tokens", async () => {
  const { keys, sign } = await signingKey();
  const verify = (token: string) => verifyIdToken(token, { projectId: PROJECT, keys });

  it("accepts a valid token", async () => {
    assert.deepEqual(await verify(await sign(claims())), {
      subject: "uid-1",
      email: "reader@example.com",
      emailVerified: true,
    });
  });

  it("reports an unverified email rather than rejecting the token", async () => {
    assert.equal((await verify(await sign(claims({ email_verified: false })))).emailVerified, false);
    assert.equal((await verify(await sign(claims({ email_verified: undefined })))).emailVerified, false);
  });

  it("rejects an expired token", async () => rejects(verify(await sign(claims({ exp: Math.floor(Date.now() / 1000) - 3600 })))));
  it("rejects a token for another project", async () => rejects(verify(await sign(claims({ aud: "other-project" })))));
  it("rejects a token from another issuer", async () => rejects(verify(await sign(claims({ iss: "https://securetoken.google.com/other" })))));
  it("rejects a token issued in the future", async () => rejects(verify(await sign(claims({ iat: Math.floor(Date.now() / 1000) + 3600 })))));
  it("rejects a token with no subject", async () => rejects(verify(await sign(claims({ sub: "" })))));
  it("rejects a token with no auth_time", async () => rejects(verify(await sign(claims({ auth_time: undefined })))));
  it("rejects a token with an auth_time in the future", async () => rejects(verify(await sign(claims({ auth_time: Math.floor(Date.now() / 1000) + 3600 })))));
  it("rejects a token with no email", async () => rejects(verify(await sign(claims({ email: undefined })))));

  it("rejects a token signed by a key that isn't published", async () => {
    const other = await signingKey("key-1");
    await rejects(verify(await other.sign(claims())));
  });

  it("rejects a token naming an unknown key", async () => rejects(verify(await sign(claims(), { kid: "missing" }))));

  it("rejects an HMAC token, even one keyed with the public key's id", async () => {
    const token = await new SignJWT(claims()).setProtectedHeader({ alg: "HS256", kid: "key-1" }).sign(new TextEncoder().encode("secret"));
    await rejects(verify(token));
  });

  it("rejects an unsigned token outside emulator mode", () => rejects(verify(unsigned(claims()))));
  it("rejects a malformed token", () => rejects(verify("not-a-token")));

  it("needs a project id", async () => {
    await assert.rejects(verifyIdToken(await sign(claims()), { projectId: "", keys }), (err) => !(err instanceof InvalidTokenError));
  });
});

describe("verifyIdToken, emulator mode", async () => {
  const { sign } = await signingKey();
  const verify = (token: string) => verifyIdToken(token, { projectId: PROJECT, emulator: true });

  it("accepts an unsigned token with valid claims", async () => {
    assert.equal((await verify(unsigned(claims()))).subject, "uid-1");
  });
  it("still checks the audience", () => rejects(verify(unsigned(claims({ aud: "other" })))));
  it("still checks the issuer", () => rejects(verify(unsigned(claims({ iss: "https://evil.example" })))));
  it("still checks expiry", () => rejects(verify(unsigned(claims({ exp: Math.floor(Date.now() / 1000) - 3600 })))));
  it("rejects a signed token, which the emulator never issues", async () => rejects(verify(await sign(claims()))));
  it("rejects a malformed token as invalid, not as a server error", () => rejects(verify("not-a-token")));
});

describe("isoSeconds", () => {
  it("drops the milliseconds, as the database's format checks require", () => {
    assert.equal(isoSeconds(new Date("2026-11-21T03:04:05.678Z")), "2026-11-21T03:04:05Z");
  });
});
