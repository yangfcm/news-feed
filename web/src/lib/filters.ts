import type { Entry } from "@/lib/types";

/** The entry fields the sidebar filters by, in display order. */
export const FACETS = [
  { key: "type", label: "Type" },
  { key: "category", label: "Categories" },
  { key: "source", label: "Sources" },
] as const;

export type FacetKey = (typeof FACETS)[number]["key"];

/** The selected values of each facet. */
export type Selection = Record<FacetKey, string[]>;

export type FacetOption = { value: string; count: number };

/** Just what filtering needs, so the client isn't sent every entry's full content again. */
export type FilterItem = Pick<Entry, FacetKey> & { key: string };

/** Stable identity for an entry; also its React key. */
export function entryKey(entry: Entry): string {
  return entry.videoId ?? entry.link;
}

export function toFilterItem(entry: Entry): FilterItem {
  return { key: entryKey(entry), type: entry.type, source: entry.source, category: entry.category };
}

function facetValues(item: FilterItem, facet: FacetKey): string[] {
  const value = item[facet];
  return Array.isArray(value) ? value : [value];
}

/**
 * Each facet's values across all the items, alphabetically. A value's count is how many items
 * it matches given the other facets' selections; its own facet's are ORed, so they don't narrow it.
 */
export function collectFacets(items: FilterItem[], selection: Selection): Record<FacetKey, FacetOption[]> {
  return Object.fromEntries(
    FACETS.map(({ key }) => {
      const others = { ...selection, [key]: [] };
      const counts = new Map<string, number>();
      for (const item of items) {
        const hit = matches(item, others) ? 1 : 0;
        for (const value of new Set(facetValues(item, key))) counts.set(value, (counts.get(value) ?? 0) + hit);
      }
      // A fixed locale, so the order is the same at build time and in the browser.
      const options = [...counts].sort(([a], [b]) => a.localeCompare(b, "en")).map(([value, count]) => ({ value, count }));
      return [key, options];
    }),
  ) as Record<FacetKey, FacetOption[]>;
}

/** Within a facet any selected value matches; every facet with a selection must match. */
export function matches(item: FilterItem, selection: Selection): boolean {
  return FACETS.every(({ key }) => {
    const selected = selection[key];
    return !selected.length || facetValues(item, key).some((value) => selected.includes(value));
  });
}
