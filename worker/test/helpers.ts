// Tokens for the tests: signed ones as Google would issue them, and unsigned ones as the
// Firebase Auth emulator does.

import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";

export const PROJECT = "demo-news-feed";
export const ISSUER = `https://securetoken.google.com/${PROJECT}`;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** The claims of a fresh token for a verified user; override any of them. */
export function claims(overrides: JWTPayload = {}): JWTPayload {
  const now = nowSeconds();
  return {
    iss: ISSUER,
    aud: PROJECT,
    sub: "uid-1",
    iat: now - 10,
    exp: now + 3600,
    auth_time: now - 10,
    email: "reader@example.com",
    email_verified: true,
    ...overrides,
  };
}

/** A key pair published under `kid`, and a signer for it. */
export async function signingKey(kid = "key-1") {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  const keys: JWTVerifyGetKey = createLocalJWKSet({ keys: [jwk] });
  const sign = (payload: JWTPayload, header: { alg?: string; kid?: string } = {}) =>
    new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid, ...header }).sign(privateKey);
  return { keys, sign, privateKey };
}

/** An unsigned token, as the Auth emulator issues. */
export function unsigned(payload: JWTPayload): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.`;
}
