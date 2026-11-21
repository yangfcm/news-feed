"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { fetchAccount, type AccountResult } from "@/lib/account";
import { getFirebaseAuth } from "@/lib/firebase";

/**
 * Where a signed-in user lands. For now it only says who is signed in and whether the account
 * is ready; the rest of the site moves behind sign-in later.
 */
export function AccountPlaceholder() {
  const router = useRouter();
  const user = useAuthUser();
  const [result, setResult] = useState<AccountResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      router.replace("/login/");
      return;
    }
    let cancelled = false;
    (async () => {
      // A user who verified in another tab still carries the old answer until reloaded.
      let refreshed = false;
      if (!user.emailVerified) {
        await user.reload().catch(() => {});
        refreshed = true;
        if (!user.emailVerified) {
          router.replace("/verify-email/");
          return;
        }
      }
      let next = await fetchAccount(user, { refreshToken: refreshed });
      // The token may predate the verification; one refresh settles it.
      if (!next.ok && next.error === "email_not_verified" && !refreshed) next = await fetchAccount(user, { refreshToken: true });
      if (cancelled) return;
      if (!next.ok && next.error === "email_not_verified") router.replace("/verify-email/");
      else setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router, attempt]);

  async function onSignOut() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace("/login/");
  }

  const retry = () => {
    setResult(null);
    setAttempt((n) => n + 1);
  };
  const signOutButton = (
    <Button size="lg" variant="outline" onClick={() => void onSignOut()}>
      Sign out
    </Button>
  );

  if (!user || !result) return <AuthShell title="Your account" description="Loading…" />;

  if (result.ok && result.account.status === "active") {
    return (
      <AuthShell title="You're signed in" description={<>Signed in as <span className="font-medium text-foreground">{result.account.email}</span>.</>}>
        <p className="text-sm text-muted-foreground">Your account is ready. More is coming here soon.</p>
        {signOutButton}
      </AuthShell>
    );
  }

  if (result.ok) {
    return (
      <AuthShell title="Waiting for approval" description={<>Signed in as <span className="font-medium text-foreground">{result.account.email}</span>.</>}>
        <p className="text-sm text-muted-foreground">Your account has been created and is waiting for an administrator to approve it. You can use the site once it&apos;s approved.</p>
        <Button size="lg" onClick={retry}>
          Check again
        </Button>
        {signOutButton}
      </AuthShell>
    );
  }

  const failure = {
    disabled: { title: "Account disabled", text: "This account has been disabled. Contact the site's administrator if you think this is a mistake." },
    email_in_use: { title: "Email already in use", text: "Another account on this site already uses this email address. Contact the site's administrator." },
    unavailable: { title: "Couldn't load your account", text: "Something went wrong reaching the server. Try again in a moment." },
  }[result.error === "email_not_verified" ? "unavailable" : result.error];

  return (
    <AuthShell title={failure.title}>
      <p className="text-sm text-muted-foreground">{failure.text}</p>
      {result.error === "unavailable" ? (
        <Button size="lg" onClick={retry}>
          Try again
        </Button>
      ) : null}
      {signOutButton}
    </AuthShell>
  );
}
