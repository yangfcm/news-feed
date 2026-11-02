import Link from "next/link";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sourceHref } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { SourceSummary } from "@/lib/types";

/** The sidebar list of every source, for moving between their pages. */
export function SourceList({
  sources,
  selected,
}: {
  sources: SourceSummary[];
  selected?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>All Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {sources.map((source) => {
            const current = source.slug === selected;
            return (
              <li key={source.slug}>
                <Link
                  href={sourceHref(source.slug)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                    current
                      ? "bg-brand font-medium text-brand-foreground hover:bg-brand/80"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">{source.name}</span>
                  <span className="shrink-0 text-xs opacity-60">
                    {source.entryCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Every source, each a link to its page, for the sources page. */
export function SourceDirectory({ sources }: { sources: SourceSummary[] }) {
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <ul className="divide-y">
          {sources.map((source) => (
            <li key={source.slug}>
              <Link
                href={sourceHref(source.slug)}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-(--card-spacing) py-3 transition-colors hover:bg-muted"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                  {source.type ? <EntryTypeIcon type={source.type} className="size-4" /> : null}
                  <span className="min-w-0">{source.name}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {source.category.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="hidden group-hover:bg-background sm:inline-flex"
                    >
                      {c}
                    </Badge>
                  ))}
                  <span className="sm:ml-1">
                    {source.entryCount}{" "}
                    {source.entryCount === 1 ? "entry" : "entries"}
                  </span>
                  {source.latestPublishedAt ? (
                    <span className="hidden sm:inline">
                      · latest {source.latestPublishedAt.slice(0, 10)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
