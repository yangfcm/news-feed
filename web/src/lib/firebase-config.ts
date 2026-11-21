// The Firebase web config, inlined at build time from the NEXT_PUBLIC_FIREBASE_* variables;
// see README.md, "Accounts". It identifies the project and grants nothing, so it is public.
// Kept apart from lib/firebase.ts so pages that only ask whether sign-in is configured don't
// load the Firebase SDK.

// Each variable is named in full: Next.js only inlines `process.env.NEXT_PUBLIC_...` written out.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Host and port of the Firebase Auth emulator, for local development only. */
export const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

/** Without a config the site builds and works as before, and the account pages say so. */
export const authConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
