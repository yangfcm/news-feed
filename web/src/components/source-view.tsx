import { ExternalLinkIcon } from "lucide-react";
import { SourceEntries } from "@/components/source-entries";
import { Badge } from "@/components/ui/badge";
import { BATCH_SIZE } from "@/lib/batches";
import type { Source } from "@/lib/types";

/** A source's page: its heading, then everything it has published, newest first. */
export function SourceView({ source, dates }: { source: Source; dates: string[] }) {
  const count = `${source.entryCount} ${source.entryCount === 1 ? "entry" : "entries"}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-2">
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
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="secondary">{count}</Badge>
          {source.updatedAt ? <span className="ml-1">Updated At {source.updatedAt}</span> : null}
        </div>
      </div>
      <SourceEntries
        slug={source.slug}
        initial={source.entries.slice(0, BATCH_SIZE)}
        total={source.entries.length}
        dates={dates}
      />
    </>
  );
}
