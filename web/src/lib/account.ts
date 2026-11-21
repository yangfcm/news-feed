// The site's own record of the signed-in user, from the Worker's GET /api/me. The Worker
// checks the Firebase ID token sent with the request and makes the user on their first visit.

import { FirebaseError } from "firebase/app";
import { sendEmailVerification, sendPasswordResetEmail, type User as FirebaseUser } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export type Account = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "active" | "disabled";
  timeZone: string;
  country: string | null;
  createdAt: string;
  approvedAt: string | null;
};

export type AccountResult =
  | { ok: true; account: Account }
  | { ok: false; error: "email_not_verified" | "disabled" | "email_in_use" | "unavailable" };

/** Where the API is: the same origin, unless NEXT_PUBLIC_API_ORIGIN points `next dev` at `wrangler dev`. */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export async function fetchAccount(user: FirebaseUser, { refreshToken = false } = {}): Promise<AccountResult> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/me`, {
      headers: {
        Authorization: `Bearer ${await user.getIdToken(refreshToken)}`,
        "X-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  const body = (await response.json().catch(() => null)) as { user?: Account; error?: string } | null;
  if (response.ok && body?.user) return { ok: true, account: body.user };
  const error = body?.error;
  if (error === "email_not_verified" || error === "disabled" || error === "email_in_use") return { ok: false, error };
  return { ok: false, error: "unavailable" };
}

/** A sentence for the reader for a Firebase Auth error. */
export function authErrorMessage(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/invalid-email":
      return "That doesn't look like an email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the sign-in service. Check your connection and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** Where Firebase's emails send the reader back to, once they have verified or reset. */
function returnUrl(path: string) {
  return { url: new URL(path, window.location.origin).toString() };
}

/**
 * Send the verification email, coming back to `path`. If this site's domain isn't one of the
 * Firebase project's authorized domains, the return link is refused; send it without one then.
 */
export async function sendVerification(user: FirebaseUser, path = "/account/"): Promise<void> {
  try {
    await sendEmailVerification(user, returnUrl(path));
  } catch (err) {
    if (!isContinueUrlError(err)) throw err;
    await sendEmailVerification(user);
  }
}

/** As sendVerification, for the password reset email. */
export async function sendPasswordReset(email: string, path = "/login/"): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("sign-in isn't configured");
  try {
    await sendPasswordResetEmail(auth, email, returnUrl(path));
  } catch (err) {
    if (!isContinueUrlError(err)) throw err;
    await sendPasswordResetEmail(auth, email);
  }
}

function isContinueUrlError(err: unknown): boolean {
  return err instanceof FirebaseError && (err.code === "auth/unauthorized-continue-uri" || err.code === "auth/invalid-continue-uri");
}
