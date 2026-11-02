import { DayHeading } from "@/components/day-heading";
import { EntryCount } from "@/components/entry-filters";
import { EntryViews } from "@/components/entry-views";
import { ViewSwitcher } from "@/components/view-switcher";
import type { Day } from "@/lib/types";

/** A day's digest, in the same order as its Markdown note. Must be inside EntryFilterProvider. */
export function DayView({
  day,
  dates,
  sourceHrefs = {},
}: {
  day: Day;
  dates: string[];
  /** Each source's page on this site, by source name. */
  sourceHrefs?: Record<string, string>;
}) {
  if (!day.entries.length) {
    return (
      <>
        <DayHeading date={day.date} dates={dates} />
        <p className="text-muted-foreground">No entries on this date.</p>
      </>
    );
  }

  return (
    <>
      <DayHeading date={day.date} dates={dates} badge={<EntryCount />} actions={<ViewSwitcher scope="date" />}>
        Updated At {day.updatedAt}
      </DayHeading>
      {/* The first cards are above the fold on any viewport, so their images load eagerly. */}
      <EntryViews scope="date" entries={day.entries} sourceHrefs={sourceHrefs} eager={2} filtered />
    </>
  );
}
