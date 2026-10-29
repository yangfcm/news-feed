import { DayHeading } from "@/components/day-heading";
import { EntryCard } from "@/components/entry-card";
import { FilteredEntry, FilterStatus } from "@/components/entry-filters";
import { entryKey } from "@/lib/filters";
import type { Day } from "@/lib/types";

/** A day's digest, in the same order as its Markdown note. Must be inside EntryFilterProvider. */
export function DayView({ day }: { day: Day }) {
  return (
    <>
      <DayHeading date={day.date} badge={`${day.entryCount} ${day.entryCount === 1 ? "entry" : "entries"}`}>
        Updated At {day.updatedAt}
      </DayHeading>
      <div className="flex flex-col gap-6">
        <FilterStatus />
        {day.entries.length ? (
          // The first cards are above the fold on any viewport, so their images load eagerly.
          day.entries.map((entry, i) => (
            <FilteredEntry key={entryKey(entry)} id={entryKey(entry)}>
              <EntryCard entry={entry} eager={i < 2} />
            </FilteredEntry>
          ))
        ) : (
          <p className="text-muted-foreground">No entries in this window.</p>
        )}
      </div>
    </>
  );
}
