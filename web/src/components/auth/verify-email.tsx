"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { AuthShell, FormMessage } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { authErrorMessage, sendVerification } from "@/lib/account";
import { getFirebaseAuth } from "@/lib/firebase";

/** How long the resend button waits after sending, to stay clear of Firebase's rate limit. */
const RESEND_WAIT_MS = 30_000;

export function VerifyEmail() {
  const router = useRouter();
  const user = useAuthUser();
  const [message, setMessage] = useState<{ tone: "error" | "notice"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);

  /** Whether the email has been verified since; if so, refresh the token and move on. */
  const check = useCallback(
    async ({ quiet = false } = {}) => {
      if (!user) return;
      try {
        await user.reload();
        if (user.emailVerified) {
          // The token still says "unverified" until it is refreshed.
          await user.getIdToken(true);
          router.replace("/account/");
        } else if (!quiet) {
          setMessage({ tone: "error", text: "Your email isn't verified yet. Open the link in the email we sent." });
        }
      } catch (err) {
        if (!quiet) setMessage({ tone: "error", text: authErrorMessage(err) });
      }
    },
    [user, router],
  );

  useEffect(() => {
    if (user === null) return;
    if (user?.emailVerified) {
      router.replace("/account/");
      return;
    }
    // Coming back to this tab from the email is the usual moment the address was just verified.
    const onFocus = () => void check({ quiet: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, router, check]);

  async function resend() {
    if (!user) return;
    setBusy(true);
    try {
      await sendVerification(user);
      setMessage({ tone: "notice", text: `We sent a new link to ${user.email}.` });
      setResendLocked(true);
      setTimeout(() => setResendLocked(false), RESEND_WAIT_MS);
    } catch (err) {
      setMessage({ tone: "error", text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace("/login/");
  }

  if (user === undefined) return <AuthShell title="Verify your email" description="Loading…" />;
  if (user === null) {
    return (
      <AuthShell title="Verify your email" description="Sign in to verify your email address.">
        <Link href="/login/" className="text-sm underline underline-offset-4">
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      description={
        <>
          We sent a link to <span className="font-medium text-foreground">{user.email}</span>. Open it, then come back here.
        </>
      }
    >
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Button size="lg" onClick={() => void check()} disabled={busy}>
        I&apos;ve verified my email
      </Button>
      <Button size="lg" variant="outline" onClick={() => void resend()} disabled={busy || resendLocked}>
        Send the link again
      </Button>
      <Button variant="ghost" onClick={() => void switchAccount()} disabled={busy}>
        Use another account
      </Button>
    </AuthShell>
  );
}
