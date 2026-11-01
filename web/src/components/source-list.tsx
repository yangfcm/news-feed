import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sourceHref } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { SourceSummary } from "@/lib/types";

/** The sidebar list of every source, for moving between their pages. */
export function SourceList({ sources, selected }: { sources: SourceSummary[]; selected?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Sources</CardTitle>
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
                    current ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 truncate">{source.name}</span>
                  <span className="shrink-0 text-xs opacity-60">{source.entryCount}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/** The sources grouped by type, each a link to its page, for the sources page. */
export function SourceGroups({ sources }: { sources: SourceSummary[] }) {
  const types = [...new Set(sources.map((s) => s.type || "Other"))].sort((a, b) => a.localeCompare(b, "en"));
  return (
    <div className="flex flex-col gap-6">
      {types.map((type) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="text-lg">{type}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sources
                .filter((s) => (s.type || "Other") === type)
                .map((source) => (
                  <li key={source.slug}>
                    <Link
                      href={sourceHref(source.slug)}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 transition-colors hover:text-primary"
                    >
                      <span className="min-w-0 flex-1 font-medium">{source.name}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        {source.category.map((c) => (
                          <Badge key={c} variant="secondary">
                            {c}
                          </Badge>
                        ))}
                        <span className="ml-1">
                          {source.entryCount} {source.entryCount === 1 ? "entry" : "entries"}
                        </span>
                        {source.latestPublishedAt ? <span>· latest {source.latestPublishedAt.slice(0, 10)}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
