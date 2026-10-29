import { DateCalendar } from "@/components/date-calendar";

/** The two-column layout every page shares: content on the left, calendar on the right. */
export function PageShell({
  dates,
  selected,
  children,
}: {
  dates: string[];
  selected?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="min-w-0">{children}</main>
      <aside className="lg:sticky lg:top-22 lg:self-start">
        <DateCalendar dates={dates} selected={selected} />
      </aside>
    </div>
  );
}
