"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AuthShell, Field, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { authErrorMessage } from "@/lib/account";
import { getFirebaseAuth } from "@/lib/firebase";

export function SignInForm() {
  const router = useRouter();
  const user = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(user.emailVerified ? "/account/" : "/verify-email/");
  }, [user, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      // On success the effect above moves on, once Firebase reports the new user.
      await signInWithEmailAndPassword(auth, String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/signup/" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="email" name="email" label="Email" type="email" autoComplete="email" required disabled={busy} />
        <Field id="password" name="password" label="Password" type="password" autoComplete="current-password" required disabled={busy} />
        <Link href="/forgot-password/" className="-mt-2 self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot your password?
        </Link>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
