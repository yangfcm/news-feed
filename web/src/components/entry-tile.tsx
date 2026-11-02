import Image from "next/image";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { EntryDialog } from "@/components/entry-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DialogTrigger } from "@/components/ui/dialog";
import { formatDuration, youtubePoster } from "@/lib/format";
import type { Entry } from "@/lib/types";

/** One entry in the Card view: thumbnail, title and metadata; the thumbnail and title open it in a modal. */
export function EntryTile({
  entry,
  eager = false,
  sourceHref,
}: {
  entry: Entry;
  eager?: boolean;
  sourceHref?: string;
}) {
  const thumbnail = entry.thumbnail || (entry.videoId ? youtubePoster(entry.videoId) : "");

  return (
    <EntryDialog entry={entry} sourceHref={sourceHref}>
      <Card className="h-full pt-0">
        <DialogTrigger
          tabIndex={-1}
          aria-hidden
          className="relative block aspect-video w-full cursor-pointer overflow-hidden bg-muted"
        >
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="(min-width: 768px) 300px, 100vw"
              loading={eager ? "eager" : "lazy"}
              className="object-contain transition-transform hover:scale-105"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {entry.type}
            </span>
          )}
        </DialogTrigger>
        <CardContent className="flex flex-1 flex-col gap-2">
          <Badge className="self-start">{entry.type}</Badge>
          <div className="flex items-start gap-1.5 leading-snug">
            <h2 className="line-clamp-3 min-w-0 flex-1 font-medium">
              <DialogTrigger
                nativeButton={false}
                render={<span />}
                className="cursor-pointer underline-offset-4 hover:underline"
              >
                {entry.title}
              </DialogTrigger>
            </h2>
            <a
              href={entry.link}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in new window"
              title="Open in new window"
              className="inline-flex h-[1lh] shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </div>
          <div className="mt-auto flex flex-col gap-0.5 text-xs text-muted-foreground">
            {sourceHref ? (
              <Link href={sourceHref} className="truncate underline-offset-4 hover:text-foreground hover:underline">
                {entry.source}
              </Link>
            ) : (
              <span className="truncate">{entry.source}</span>
            )}
            <span>
              {entry.publishedAt}
              {entry.duration ? ` · ${formatDuration(entry.duration)}` : null}
            </span>
          </div>
        </CardContent>
      </Card>
    </EntryDialog>
  );
}
