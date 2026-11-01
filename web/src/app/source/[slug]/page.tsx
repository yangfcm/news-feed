import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SourceList } from "@/components/source-list";
import { SourceView } from "@/components/source-view";
import { Card, CardContent } from "@/components/ui/card";
import { getAvailableDates, getSource, getSourceIndex, withEncodedSlugs } from "@/lib/data";

// Only the sources in the index exist; a static export cannot render others on demand.
export const dynamicParams = false;

// A static export fails on an empty list, so before the first digest a single
// placeholder page is generated instead.
const NO_SOURCES = "no-sources-yet";

export function generateStaticParams() {
  const slugs = getSourceIndex().sources.map((s) => s.slug);
  return withEncodedSlugs((slugs.length ? slugs : [NO_SOURCES]).map((slug) => ({ slug })));
}

export async function generateMetadata({ params }: PageProps<"/source/[slug]">): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const name = getSourceIndex().sources.find((s) => s.slug === slug)?.name ?? slug;
  return { title: `News Feed · ${name}` };
}

export default async function SourcePage({ params }: PageProps<"/source/[slug]">) {
  const slug = decodeURIComponent((await params).slug);
  const source = getSource(slug);
  const sources = getSourceIndex().sources;
  const dates = getAvailableDates();

  if (!source) {
    return (
      <PageShell>
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">Source</h1>
        <Card>
          <CardContent className="flex flex-col gap-2 text-muted-foreground">
            <p>No such source.</p>
            <p>
              <Link href="/sources/" className="text-foreground underline underline-offset-4">
                All sources
              </Link>
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell sidebar={<SourceList sources={sources} selected={slug} />}>
      <SourceView source={source} dates={dates} />
    </PageShell>
  );
}
