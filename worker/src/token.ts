// Checks a Firebase ID token, as Firebase documents for verifying ID tokens with a third-party
// JWT library: RS256, signed by one of Google's published keys, issued for this project, not
// expired, with a non-empty subject.
//
// The Firebase Auth emulator issues unsigned tokens. `emulator` accepts those, with the same
// claim checks; the caller must only ever turn it on for local development.

import { createRemoteJWKSet, decodeJwt, decodeProtectedHeader, errors, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";

/** Google's public keys for Firebase ID tokens, as a JSON Web Key Set. */
export const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let remoteKeys: JWTVerifyGetKey | undefined;

/**
 * Google's keys, made on first use rather than when the module loads, which Workers restrict.
 * jose then fetches and caches them for as long as the Worker instance lives.
 */
export function firebaseKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteKeys;
}

/** What the API needs from a valid token. */
export type Identity = {
  /** The Firebase uid. */
  subject: string;
  email: string;
  emailVerified: boolean;
};

export class InvalidTokenError extends Error {}

/** Seconds of clock difference allowed between Google and this Worker. */
const CLOCK_TOLERANCE = 60;

export async function verifyIdToken(
  token: string,
  options: { projectId: string; keys?: JWTVerifyGetKey; emulator?: boolean; now?: Date },
): Promise<Identity> {
  const { projectId, emulator = false, now = new Date() } = options;
  const keys = options.keys ?? (emulator ? undefined : firebaseKeys());
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set");
  const issuer = `https://securetoken.google.com/${projectId}`;

  let payload: JWTPayload;
  try {
    if (emulator) {
      payload = decodeUnsigned(token);
      checkClaims(payload, { issuer, audience: projectId, now });
    } else {
      ({ payload } = await jwtVerify(token, keys!, {
        algorithms: ["RS256"],
        issuer,
        audience: projectId,
        currentDate: now,
        clockTolerance: CLOCK_TOLERANCE,
        requiredClaims: ["exp", "iat", "sub", "auth_time"],
      }));
    }
  } catch (err) {
    if (err instanceof InvalidTokenError) throw err;
    // Google's key endpoint timing out or answering badly is a server problem, passed on as
    // is, like any error that is not jose's. jose's other errors mean the token is not acceptable.
    if (err instanceof errors.JWKSTimeout || err instanceof errors.JWKSInvalid) throw err;
    if (err instanceof errors.JOSEError) throw new InvalidTokenError(err.message);
    throw err;
  }

  // jwtVerify only checks iat when asked for a maximum token age; Firebase requires it in the past.
  const seconds = Math.floor(now.getTime() / 1000);
  if (typeof payload.iat !== "number" || payload.iat > seconds + CLOCK_TOLERANCE) {
    throw new InvalidTokenError("the token was issued in the future");
  }
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) {
    throw new InvalidTokenError("the token has no valid subject");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > seconds + CLOCK_TOLERANCE) {
    throw new InvalidTokenError("the token has no valid auth_time");
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new InvalidTokenError("the token has no email");
  }
  return { subject: payload.sub, email: payload.email, emailVerified: payload.email_verified === true };
}

/** The payload of an unsigned token. Decoding can only fail because of the token itself. */
function decodeUnsigned(token: string): JWTPayload {
  let alg: unknown;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch (err) {
    throw new InvalidTokenError(err instanceof Error ? err.message : "malformed token");
  }
  if (alg !== "none") throw new InvalidTokenError("the emulator issues unsigned tokens");
  try {
    return decodeJwt(token);
  } catch (err) {
    throw new InvalidTokenError(err instanceof Error ? err.message : "malformed token");
  }
}

/** The checks jwtVerify makes, for the emulator's unsigned tokens; iat is checked for both after. */
function checkClaims(payload: JWTPayload, { issuer, audience, now }: { issuer: string; audience: string; now: Date }) {
  const seconds = Math.floor(now.getTime() / 1000);
  if (payload.iss !== issuer) throw new InvalidTokenError("unexpected issuer");
  if (payload.aud !== audience) throw new InvalidTokenError("unexpected audience");
  if (typeof payload.exp !== "number" || payload.exp <= seconds - CLOCK_TOLERANCE) throw new InvalidTokenError("the token has expired");
}
