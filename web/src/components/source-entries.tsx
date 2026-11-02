"use client";

import { useRef, useState } from "react";
import { EntryViews } from "@/components/entry-views";
import { LoadMore } from "@/components/load-more";
import { Button } from "@/components/ui/button";
import { BATCH_SIZE, batchHref } from "@/lib/batches";
import type { Entry } from "@/lib/types";

/**
 * A source's entries, newest first. The page holds the first batch; the rest are fetched one
 * batch at a time as the reader reaches the end.
 */
export function SourceEntries({ slug, initial, total }: { slug: string; initial: Entry[]; total: number }) {
  const [entries, setEntries] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

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

  if (!entries.length) return <p className="text-muted-foreground">Nothing from this source yet.</p>;

  return (
    <div className="flex flex-col gap-8">
      {/* The first cards are above the fold on any viewport, so their images load eagerly. */}
      <EntryViews scope="source" entries={entries} eager={4} />
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
