import { DayHeading } from "@/components/day-heading";
import { EntryCard } from "@/components/entry-card";
import { EntryCount, FilteredEntry } from "@/components/entry-filters";
import { entryKey } from "@/lib/filters";
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
      <DayHeading date={day.date} dates={dates} badge={<EntryCount />}>
        Updated At {day.updatedAt}
      </DayHeading>
      <div className="flex flex-col gap-6">
        {/* The first cards are above the fold on any viewport, so their images load eagerly. */}
        {day.entries.map((entry, i) => (
          <FilteredEntry key={entryKey(entry)} id={entryKey(entry)}>
            <EntryCard entry={entry} eager={i < 2} sourceHref={sourceHrefs[entry.source]} />
          </FilteredEntry>
        ))}
      </div>
    </>
  );
}
