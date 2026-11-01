import Link from "next/link";
import { RssIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationProgressBar } from "@/components/navigation-progress";
import { HeaderSlot } from "@/components/sidebar-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo />
          News Feed
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sources/"
            aria-label="Sources"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "max-xs:w-8 max-xs:px-0 max-xs:has-data-[icon=inline-start]:pl-0",
            )}
          >
            <RssIcon data-icon="inline-start" />
            <span className="hidden xs:inline">Sources</span>
          </Link>
          <HeaderSlot />
          <ModeToggle />
        </div>
      </div>
      <NavigationProgressBar />
    </header>
  );
}
