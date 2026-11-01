import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { SourceDirectory } from "@/components/source-list";
import { Badge } from "@/components/ui/badge";
import { getSourceIndex } from "@/lib/data";

export const metadata: Metadata = { title: "News Feed · My Sources" };

export default function SourcesPage() {
  const index = getSourceIndex();
  const count = `${index.sourceCount} ${index.sourceCount === 1 ? "source" : "sources"}`;

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">My Sources</h1>
          <Badge variant="secondary">{count}</Badge>
        </div>
        {index.updatedAt ? <p className="text-sm text-muted-foreground">Updated At {index.updatedAt}</p> : null}
      </div>
      {index.sources.length ? (
        <SourceDirectory sources={index.sources} />
      ) : (
        <p className="text-muted-foreground">No sources yet. They appear here after the first digest.</p>
      )}
    </PageShell>
  );
}
