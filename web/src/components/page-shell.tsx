import { DateCalendar } from "@/components/date-calendar";
import { SidebarProvider } from "@/components/sidebar-menu";

/**
 * The two-column layout every page shares: content on the left, calendar (and sidebar) on
 * the right. On narrower screens the sidebar opens from a button in the page's heading
 * instead (SidebarMenu). Without `dates` there is no calendar, and without either the page
 * is a single column.
 */
export function PageShell({
  dates,
  selected,
  sidebar,
  children,
}: {
  dates?: string[];
  selected?: string;
  /** Shown under the calendar. */
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!dates && !sidebar) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <main className="min-w-0">{children}</main>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {dates ? <DateCalendar dates={dates} selected={selected} /> : null}
      {sidebar}
    </>
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0">
        <SidebarProvider sidebar={sidebarContent}>{children}</SidebarProvider>
      </main>
      {/* Scrolls on its own when taller than the viewport; `*:shrink-0` as in SidebarMenu, `-m-px p-px` keeps the cards' rings unclipped. */}
      <aside className="sticky top-22 -m-px hidden max-h-[calc(100dvh-7.5rem)] flex-col gap-6 self-start overflow-y-auto p-px *:shrink-0 lg:flex">
        {sidebarContent}
      </aside>
    </div>
  );
}
