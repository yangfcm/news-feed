import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Day, GlobalIndex } from "@/lib/types";

// `next build` runs from web/; CONTENT_DIR is relative to the project root.
const DATA_DIR = path.join(path.resolve(process.cwd(), "..", process.env.CONTENT_DIR || "content"), "data");

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    console.warn(`warning: could not read ${file}`);
    return null;
  }
}

export function getIndex(): GlobalIndex {
  const index = readJson<GlobalIndex>(path.join(DATA_DIR, "index.json"));
  return { ...index, dates: index?.dates ?? [] };
}

/** Every date that has a day file, newest first. */
export function getAvailableDates(): string[] {
  return getIndex().dates.map((d) => d.date);
}

export function getDay(date: string): Day | null {
  const entry = getIndex().dates.find((d) => d.date === date);
  if (!entry) return null;
  const day = readJson<Day>(path.join(DATA_DIR, entry.path));
  if (!day || !Array.isArray(day.entries)) return null;
  return { ...day, errors: day.errors ?? [] };
}
