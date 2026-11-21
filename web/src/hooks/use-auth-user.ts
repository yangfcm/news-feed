"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { authConfigured } from "@/lib/firebase-config";

/**
 * The signed-in Firebase user: undefined until Firebase has restored the session, then a user
 * or null. Always null when sign-in isn't configured. The first value is the same in the
 * build's prerender and in the browser, so hydration matches.
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(authConfigured ? undefined : null);
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (auth) return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}
