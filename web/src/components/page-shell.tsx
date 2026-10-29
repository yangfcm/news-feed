import { DateCalendar } from "@/components/date-calendar";
import { SidebarMenu } from "@/components/sidebar-menu";

/**
 * The two-column layout every page shares: content on the left, calendar (and sidebar) on
 * the right. On narrower screens the sidebar opens from a header button instead.
 */
export function PageShell({
  dates,
  selected,
  sidebar,
  children,
}: {
  dates: string[];
  selected?: string;
  /** Shown under the calendar. */
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sidebarContent = (
    <>
      <DateCalendar dates={dates} selected={selected} />
      {sidebar}
    </>
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0">{children}</main>
      {/* Not sticky: the filters can be taller than the viewport and should scroll with the page. */}
      <aside className="hidden flex-col gap-6 lg:flex lg:self-start">{sidebarContent}</aside>
      <SidebarMenu>{sidebarContent}</SidebarMenu>
    </div>
  );
}
