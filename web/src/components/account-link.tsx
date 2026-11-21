"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRoundIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCOUNT_PAGES = ["/account", "/login", "/signup", "/verify-email", "/forgot-password"];

/** The header's way into the account pages. /account/ sends a signed-out reader to sign in. */
export function AccountLink() {
  const pathname = usePathname();
  const active = ACCOUNT_PAGES.some((page) => pathname.startsWith(page));

  return (
    <Link
      href="/account/"
      aria-label="Account"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline" }),
        active && "brand",
        // Icon only below md: with its label the header row overflows on small tablets.
        "max-md:w-8 max-md:px-0 max-md:has-data-[icon=inline-start]:pl-0",
      )}
    >
      <UserRoundIcon data-icon="inline-start" />
      <span className="hidden md:inline">Account</span>
    </Link>
  );
}
