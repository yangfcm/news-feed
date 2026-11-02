import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { EntryDialog } from "@/components/entry-dialog";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { DialogTrigger } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";
import type { Entry } from "@/lib/types";

/** One entry in the List view: its title and a line of metadata; the title opens it in a modal. */
export function EntryRow({ entry, sourceHref }: { entry: Entry; sourceHref?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3">
      <h2 className="font-medium leading-snug">
        <EntryDialog entry={entry} sourceHref={sourceHref}>
          {/* A span, not a button, so a long title wraps inline and the link icon follows its last line. */}
          <DialogTrigger
            nativeButton={false}
            render={<span />}
            className="cursor-pointer underline-offset-4 hover:underline"
          >
            {entry.title}
          </DialogTrigger>
        </EntryDialog>
        <a
          href={entry.link}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in new window"
          title="Open in new window"
          className="ml-1.5 inline-flex h-[1lh] items-center align-top text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLinkIcon className="size-4" />
        </a>
      </h2>
      <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <EntryTypeIcon type={entry.type} className="size-3" />
          {sourceHref ? (
            <Link href={sourceHref} className="underline-offset-4 hover:text-foreground hover:underline">
              {entry.source}
            </Link>
          ) : (
            entry.source
          )}
        </span>
        <span>· {entry.publishedAt}</span>
        {entry.duration ? <span>· {formatDuration(entry.duration)}</span> : null}
      </p>
    </div>
  );
}
