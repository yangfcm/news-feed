"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { collectFacets, FACETS, matches, type FacetKey, type FilterItem, type Selection } from "@/lib/filters";

const NO_SELECTION: Selection = { type: [], category: [], source: [] };

type FilterState = {
  items: FilterItem[];
  selection: Selection;
  active: boolean;
  /** Keys of the items that match the selection. */
  visible: Set<string>;
  toggle: (facet: FacetKey, value: string) => void;
  clear: () => void;
};

const FilterContext = createContext<FilterState | null>(null);

function useFilters(): FilterState {
  const state = useContext(FilterContext);
  if (!state) throw new Error("useFilters must be used inside EntryFilterProvider");
  return state;
}

/** Holds the sidebar's selection for one day, shared by the sidebar and the entry list. */
export function EntryFilterProvider({ items, children }: { items: FilterItem[]; children: React.ReactNode }) {
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);

  const state = useMemo<FilterState>(() => {
    const toggle = (facet: FacetKey, value: string) =>
      setSelection((current) => {
        const selected = current[facet];
        const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
        return { ...current, [facet]: next };
      });
    return {
      items,
      selection,
      active: FACETS.some(({ key }) => selection[key].length > 0),
      visible: new Set(items.filter((item) => matches(item, selection)).map((item) => item.key)),
      toggle,
      clear: () => setSelection(NO_SELECTION),
    };
  }, [items, selection]);

  return <FilterContext value={state}>{children}</FilterContext>;
}

/**
 * Hides a server-rendered entry that doesn't match. It stays mounted, so a player that's
 * already going keeps playing while the filters change.
 */
export function FilteredEntry({ id, children }: { id: string; children: React.ReactNode }) {
  return <div hidden={!useFilters().visible.has(id)}>{children}</div>;
}

/** How many entries the filters leave, with a way to reset them. Nothing while unfiltered. */
export function FilterStatus() {
  const { items, active, visible, clear } = useFilters();
  if (!active) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      {visible.size ? `Showing ${visible.size} of ${items.length} entries.` : "No entries match the selected filters."}
      <Button variant="link" size="sm" onClick={clear} className="h-auto cursor-pointer p-0">
        Clear filters
      </Button>
    </p>
  );
}

/** The sidebar panel: every type, category and source on the page, each a toggle. */
export function EntryFilters() {
  const { items, selection, active, toggle, clear } = useFilters();
  const facets = useMemo(() => collectFacets(items, selection), [items, selection]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        {/* Always laid out, only hidden, so the header is the same height with or without it. */}
        <CardAction className={active ? undefined : "invisible"}>
          <Button variant="ghost" size="xs" onClick={clear} className="cursor-pointer">
            Clear
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {FACETS.map(({ key, label }) =>
          facets[key].length ? (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h2>
              <div className="flex flex-wrap gap-1.5">
                {facets[key].map(({ value, count }) => {
                  const selected = selection[key].includes(value);
                  // A selected value stays clickable even at 0, so it can always be cleared.
                  const disabled = count === 0 && !selected;
                  return (
                    <Badge
                      key={value}
                      render={<button type="button" disabled={disabled} />}
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      onClick={() => toggle(key, value)}
                      className={cn(
                        "cursor-pointer disabled:pointer-events-none disabled:opacity-40",
                        !selected && "hover:border-transparent hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      {value}
                      <span className="opacity-60">{count}</span>
                    </Badge>
                  );
                })}
              </div>
            </section>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}
