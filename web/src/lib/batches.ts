/** How many entries a page shows at first, and how many more each time the reader reaches the end. */
export const BATCH_SIZE = 12;

export function batchCount(total: number): number {
  return Math.ceil(total / BATCH_SIZE);
}

/** A source's entries after the first batch, which is in the page itself; `n` counts from 1. */
export function batchHref(slug: string, n: number): string {
  return `/source/${slug}/entries/${n}.json`;
}
