"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { AuthShell, Field, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { authErrorMessage, sendVerification } from "@/lib/account";
import { getFirebaseAuth } from "@/lib/firebase";

const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const user = useAuthUser();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Someone already signed in has nothing to do here. Not while this form is making the
  // account: that would leave before the verification email is sent.
  useEffect(() => {
    if (user && !busy) router.replace(user.emailVerified ? "/account/" : "/verify-email/");
  }, [user, busy, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    if (password !== form.get("confirm")) return setError("The passwords don't match.");

    const auth = getFirebaseAuth();
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // The account exists now; if the email fails to send, the next page can send it again.
      await sendVerification(credential.user).catch(() => {});
      router.replace("/verify-email/");
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create an account"
      description="We'll email you a link to confirm your address."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login/" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="email" name="email" label="Email" type="email" autoComplete="email" required disabled={busy} />
        <Field id="password" name="password" label="Password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} disabled={busy} />
        <Field id="confirm" name="confirm" label="Confirm password" type="password" autoComplete="new-password" required disabled={busy} />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
