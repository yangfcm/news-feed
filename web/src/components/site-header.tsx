import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { HeaderSlot } from "@/components/sidebar-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          News Feed
        </Link>
        <div className="flex items-center gap-2">
          <HeaderSlot />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
