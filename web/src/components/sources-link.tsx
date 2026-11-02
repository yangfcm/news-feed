"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RssIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SourcesLink() {
  const active = usePathname().replace(/\/$/, "") === "/sources";

  return (
    <Link
      href="/sources/"
      aria-label="Sources"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline" }),
        active && "brand",
        "max-xs:w-8 max-xs:px-0 max-xs:has-data-[icon=inline-start]:pl-0",
      )}
    >
      <RssIcon data-icon="inline-start" />
      <span className="hidden xs:inline">Sources</span>
    </Link>
  );
}
