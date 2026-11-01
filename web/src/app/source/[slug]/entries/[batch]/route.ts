import { BATCH_SIZE, batchCount } from "@/lib/batches";
import { getSource, getSourceIndex, withEncodedSlugs } from "@/lib/data";

// Written to out/ at build time, one JSON file per batch; the source page fetches them as the
// reader scrolls.
export const dynamic = "force-static";
export const dynamicParams = false;

// A static export fails on an empty list, so when no source has more than one batch, a single
// placeholder is generated instead.
const NO_BATCHES = { slug: "no-sources-yet", batch: "2.json" };

export function generateStaticParams() {
  // The first batch is in the page itself.
  const params = getSourceIndex().sources.flatMap((source) =>
    Array.from({ length: Math.max(batchCount(source.entryCount) - 1, 0) }, (_, i) => ({
      slug: source.slug,
      batch: `${i + 2}.json`,
    })),
  );
  return withEncodedSlugs(params.length ? params : [NO_BATCHES]);
}

export async function GET(_request: Request, { params }: RouteContext<"/source/[slug]/entries/[batch]">) {
  const { slug, batch } = await params;
  const start = (Number.parseInt(batch, 10) - 1) * BATCH_SIZE;
  const entries = getSource(decodeURIComponent(slug))?.entries ?? [];
  return Response.json(entries.slice(start, start + BATCH_SIZE));
}
