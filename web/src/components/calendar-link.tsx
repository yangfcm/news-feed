"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useBrowserToday } from "@/hooks/use-browser-today";
import { cn } from "@/lib/utils";

// Only dates with a digest have a page; without one, the home page shows today's empty state.
export function CalendarLink({ dates }: { dates: string[] }) {
  const today = useBrowserToday();
  const pathname = usePathname().replace(/\/$/, "");
  const href = today && dates.includes(today) ? `/${today}/` : "/";
  const active = !!today && pathname === `/${today}`;

  return (
    <Link
      href={href}
      aria-label="Calendar"
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline" }),
        active && "brand",
        "max-xs:w-8 max-xs:px-0 max-xs:has-data-[icon=inline-start]:pl-0",
      )}
    >
      <CalendarIcon data-icon="inline-start" />
      <span className="hidden xs:inline">Calendar</span>
    </Link>
  );
}
