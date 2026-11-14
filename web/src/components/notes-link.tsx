"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookPenIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotesLink() {
  const active = usePathname().startsWith("/notes");

  return (
    <Link
      href="/notes/"
      aria-label="Notes"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline" }),
        active && "brand",
        "max-xs:w-8 max-xs:px-0 max-xs:has-data-[icon=inline-start]:pl-0",
      )}
    >
      <NotebookPenIcon data-icon="inline-start" />
      <span className="hidden xs:inline">Notes</span>
    </Link>
  );
}
