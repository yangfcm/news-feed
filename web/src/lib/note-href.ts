export function noteHref(segments: string[]): string {
  return `/notes/${segments.map(encodeURIComponent).join("/")}/`;
}
