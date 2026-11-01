"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { EntryCard } from "@/components/entry-card";
import { LoadMore } from "@/components/load-more";
import { Button } from "@/components/ui/button";
import { BATCH_SIZE, batchHref } from "@/lib/batches";
import { entryKey } from "@/lib/filters";
import type { Entry } from "@/lib/types";

/**
 * A source's entries, grouped under the day they were published. The page holds the first
 * batch; the rest are fetched one batch at a time as the reader reaches the end.
 */
export function SourceEntries({
  slug,
  initial,
  total,
  dates,
}: {
  slug: string;
  initial: Entry[];
  total: number;
  /** Every date with a day page, for linking the day headings. */
  dates: string[];
}) {
  const [entries, setEntries] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const hasDay = useMemo(() => new Set(dates), [dates]);

  // Regrouped from every loaded entry, so a day split across two batches keeps one heading.
  const days = useMemo(() => {
    const days = new Map<string, Entry[]>();
    for (const entry of entries) {
      const date = entry.publishedAt.slice(0, 10);
      if (!days.has(date)) days.set(date, []);
      days.get(date)!.push(entry);
    }
    return days;
  }, [entries]);

  const more = entries.length < total;

  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(batchHref(slug, Math.floor(entries.length / BATCH_SIZE) + 1));
      if (!response.ok) throw new Error(`${response.status}`);
      const batch = (await response.json()) as Entry[];
      setEntries((current) => [...current, ...batch]);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  if (!days.size) return <p className="text-muted-foreground">Nothing from this source yet.</p>;

  return (
    <div className="flex flex-col gap-8">
      {[...days].map(([date, group], i) => (
        <section key={date} className="flex flex-col gap-4">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {hasDay.has(date) ? (
              <Link href={`/${date}/`} className="underline-offset-4 hover:text-foreground hover:underline">
                {date}
              </Link>
            ) : (
              date
            )}
          </h2>
          {group.map((entry) => (
            // The first cards are above the fold on any viewport, so their images load eagerly.
            <EntryCard key={entryKey(entry)} entry={entry} eager={i === 0} />
          ))}
        </section>
      ))}
      {more && !failed && !loading ? <LoadMore key={entries.length} onLoad={load} /> : null}
      {loading ? <p className="text-center text-sm text-muted-foreground">Loading…</p> : null}
      {failed ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Couldn&apos;t load more entries.
          <Button variant="outline" size="sm" onClick={load} className="cursor-pointer">
            Retry
          </Button>
        </p>
      ) : null}
    </div>
  );
}
