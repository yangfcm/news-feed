const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD, the same format the skill names its day files with. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse YYYY-MM-DD as a local date (new Date("YYYY-MM-DD") would be UTC midnight). */
export function parseDateString(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Seconds as M:SS or H:MM:SS. */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatCoverage(hours: number | null | undefined): string {
  return typeof hours === "number" ? `${hours} hours` : "unknown";
}
