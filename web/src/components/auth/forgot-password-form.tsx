"use client";

import Link from "next/link";
import { useState } from "react";
import { FirebaseError } from "firebase/app";
import { AuthShell, Field, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { authErrorMessage, sendPasswordReset } from "@/lib/account";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      // Never say whether an account exists for the address.
      if (err instanceof FirebaseError && err.code === "auth/user-not-found") setSentTo(email);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={
        <Link href="/login/" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <FormMessage tone="notice">If there&apos;s an account for {sentTo}, a reset link is on its way. Check your inbox.</FormMessage>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field id="email" name="email" label="Email" type="email" autoComplete="email" required disabled={busy} />
          {error ? <FormMessage>{error}</FormMessage> : null}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
