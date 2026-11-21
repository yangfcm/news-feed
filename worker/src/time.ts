/** A UTC timestamp in the one format the database accepts: YYYY-MM-DDTHH:MM:SSZ, no milliseconds. */
export function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
