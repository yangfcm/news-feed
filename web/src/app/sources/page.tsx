import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SourceGroups } from "@/components/source-list";
import { Badge } from "@/components/ui/badge";
import { getAvailableDates, getSourceIndex } from "@/lib/data";

export const metadata: Metadata = { title: "News Feed · Sources" };

export default function SourcesPage() {
  const index = getSourceIndex();
  const dates = getAvailableDates();
  const count = `${index.sourceCount} ${index.sourceCount === 1 ? "source" : "sources"}`;

  return (
    <PageShell dates={dates}>
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Sources</h1>
          <Badge variant="secondary">{count}</Badge>
        </div>
        {index.updatedAt ? <p className="text-sm text-muted-foreground">Updated At {index.updatedAt}</p> : null}
      </div>
      {index.sources.length ? (
        <SourceGroups sources={index.sources} />
      ) : (
        <p className="text-muted-foreground">No sources yet. They appear here after the first digest.</p>
      )}
    </PageShell>
  );
}
