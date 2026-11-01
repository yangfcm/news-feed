import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { NavigationProgressBar } from "@/components/navigation-progress";
import { HeaderSlot } from "@/components/sidebar-menu";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo />
          News Feed
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/sources/" />} className="text-muted-foreground">
            Sources
          </Button>
          <HeaderSlot />
          <ModeToggle />
        </div>
      </div>
      <NavigationProgressBar />
    </header>
  );
}
