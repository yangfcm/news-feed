import { TriangleAlertIcon } from "lucide-react";
import { DayHeading } from "@/components/day-heading";
import { EntryCard } from "@/components/entry-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCoverage } from "@/lib/format";
import type { Day } from "@/lib/types";

/** A day's digest, in the same order as its Markdown note: entries, then fetch issues. */
export function DayView({ day }: { day: Day }) {
  return (
    <>
      <DayHeading date={day.date}>
        Updated At {day.updatedAt} · Coverage {formatCoverage(day.coverage)} · {day.entryCount} entries
      </DayHeading>
      <div className="flex flex-col gap-6">
        {day.entries.length ? (
          // The first cards are above the fold on any viewport, so their images load eagerly.
          day.entries.map((entry, i) => <EntryCard key={entry.videoId ?? entry.link} entry={entry} eager={i < 2} />)
        ) : (
          <p className="text-muted-foreground">No entries in this window.</p>
        )}
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Fetch issues</AlertTitle>
          <AlertDescription>
            {day.errors.length ? (
              <ul className="list-disc pl-4">
                {day.errors.map((e) => (
                  <li key={`${e.source}-${e.link}`}>
                    {e.source} ({e.type}): {e.error}
                  </li>
                ))}
              </ul>
            ) : (
              "None"
            )}
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
