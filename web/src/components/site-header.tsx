import Link from "next/link";
import { AccountLink } from "@/components/account-link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationProgressBar } from "@/components/navigation-progress";
import { NotesLink } from "@/components/notes-link";
import { SourcesLink } from "@/components/sources-link";
import { ThemeColorPicker } from "@/components/theme-color-picker";
import { TodayLink } from "@/components/today-link";
import { getAvailableDates } from "@/lib/data";
import { authConfigured } from "@/lib/firebase-config";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", authConfigured && "whitespace-nowrap")}>
          <Logo />
          {/* With the Account button, the row runs out of room on the narrowest phones, and
              again just above xs, where the buttons gain their labels. The logo still links home. */}
          <span className={authConfigured ? "max-[23rem]:sr-only xs:max-[34rem]:sr-only" : undefined}>News Feed</span>
        </Link>
        <div className={authConfigured ? "flex items-center gap-1 xs:gap-2" : "flex items-center gap-2"}>
          <TodayLink dates={getAvailableDates()} />
          <SourcesLink />
          <NotesLink />
          <ThemeColorPicker />
          <ModeToggle />
          {authConfigured ? <AccountLink /> : null}
        </div>
      </div>
      <NavigationProgressBar />
    </header>
  );
}
