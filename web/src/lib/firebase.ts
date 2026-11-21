// The Firebase app and its Auth instance, for the account pages only.

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { authConfigured, authEmulatorHost, firebaseConfig } from "@/lib/firebase-config";

let auth: Auth | null = null;

/** The Auth instance, or null when sign-in isn't configured or during the build's prerender. */
export function getFirebaseAuth(): Auth | null {
  if (!authConfigured || typeof window === "undefined") return null;
  if (!auth) {
    auth = getAuth(getApps()[0] ?? initializeApp(firebaseConfig));
    if (authEmulatorHost) connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  }
  return auth;
}
