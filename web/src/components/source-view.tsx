import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { EntryCard } from "@/components/entry-card";
import { Badge } from "@/components/ui/badge";
import { entryKey } from "@/lib/filters";
import type { Source } from "@/lib/types";

/** Everything one source has published, newest first, grouped under the day it was published. */
export function SourceView({ source, dates }: { source: Source; dates: string[] }) {
  const hasDay = new Set(dates);
  const days = new Map<string, Source["entries"]>();
  for (const entry of source.entries) {
    const date = entry.publishedAt.slice(0, 10);
    if (!days.has(date)) days.set(date, []);
    days.get(date)!.push(entry);
  }
  const count = `${source.entryCount} ${source.entryCount === 1 ? "entry" : "entries"}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {source.name}
            {source.sourceLink ? (
              <a
                href={source.sourceLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Open source in new window"
                title="Open source in new window"
                className="ml-2 inline-flex h-[1lh] items-center align-top text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLinkIcon className="size-5" />
              </a>
            ) : null}
          </h1>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {source.type ? <Badge>{source.type}</Badge> : null}
          {source.category.map((c) => (
            <Badge key={c} variant="secondary">
              {c}
            </Badge>
          ))}
          {source.updatedAt ? <span className="ml-1">Updated At {source.updatedAt}</span> : null}
        </div>
      </div>
      {days.size ? (
        <div className="flex flex-col gap-8">
          {[...days].map(([date, entries], i) => (
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
              {entries.map((entry) => (
                // The first cards are above the fold on any viewport, so their images load eagerly.
                <EntryCard key={entryKey(entry)} entry={entry} eager={i === 0} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Nothing from this source yet.</p>
      )}
    </>
  );
}
