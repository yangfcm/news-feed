import { EntryCard } from "@/components/entry-card";
import { FilteredEntry } from "@/components/entry-filters";
import { EntryRow } from "@/components/entry-row";
import { EntryTile } from "@/components/entry-tile";
import { ViewPanel } from "@/components/view-panel";
import { Card } from "@/components/ui/card";
import { entryKey } from "@/lib/filters";
import type { Entry } from "@/lib/types";
import type { ViewScope } from "@/lib/view";

/** The entries in each of the three views; ViewPanel shows the current one. */
export function EntryViews({
  scope,
  entries,
  sourceHrefs = {},
  eager = 0,
  filtered = false,
}: {
  scope: ViewScope;
  entries: Entry[];
  sourceHrefs?: Record<string, string>;
  /** How many of the first entries load their images eagerly. */
  eager?: number;
  /** Hide entries the sidebar filters out; needs EntryFilterProvider. */
  filtered?: boolean;
}) {
  const items = (render: (entry: Entry, i: number) => React.ReactNode) =>
    entries.map((entry, i) => {
      const key = entryKey(entry);
      return filtered ? (
        <FilteredEntry key={key} id={key}>
          {render(entry, i)}
        </FilteredEntry>
      ) : (
        <div key={key}>{render(entry, i)}</div>
      );
    });

  return (
    <>
      <ViewPanel scope={scope} view="article" className="flex flex-col gap-6">
        {items((entry, i) => (
          <EntryCard entry={entry} eager={i < eager} sourceHref={sourceHrefs[entry.source]} />
        ))}
      </ViewPanel>
      <ViewPanel scope={scope} view="card" className="@container">
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
          {items((entry, i) => (
            <EntryTile entry={entry} eager={i < eager} sourceHref={sourceHrefs[entry.source]} />
          ))}
        </div>
      </ViewPanel>
      <ViewPanel scope={scope} view="list">
        <Card className="py-0">
          {/* Gaps over a border-coloured background, so rows hidden by the filters leave no extra line. */}
          <div className="flex flex-col gap-px bg-border">
            {items((entry) => (
              <EntryRow entry={entry} sourceHref={sourceHrefs[entry.source]} />
            ))}
          </div>
        </Card>
      </ViewPanel>
    </>
  );
}
