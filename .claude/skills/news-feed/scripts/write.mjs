#!/usr/bin/env node
// Turn the enriched entries into day files — each entry goes into the file of its own
// publish date, so one run may write several — plus their Markdown notes, day indexes and
// the global index.
//
//   node write.mjs <enriched.json> [--out output/data]
//
// Writing upserts across every day file on disk: an entry already filed is refreshed from
// the new fetch, a new one is added, and one the new fetch did not return is kept. An entry
// sitting in the wrong day file is moved to its publish date. summary and tags are only
// replaced by non-empty values, so a run without them (no Claude) never wipes out ones
// written earlier.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { localDate, localDateTime } from "./lib/text.mjs";
import { PROJECT_ROOT } from "./lib/env.mjs";

const ENTRY_FIELDS = [
  "title",
  "source",
  "type",
  "publisher",
  "publishedAt",
  "link",
  "thumbnail",
  "category",
  "summary",
  "tags",
  "audioLink",
  "videoId",
  "duration",
];

const INDEX_FIELDS = ["date", "title", "link", "type", "source", "publisher", "category", "tags", "publishedAt"];

function parseArgs(argv) {
  const positional = [];
  let out = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") out = argv[++i] ?? "";
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else positional.push(arg);
  }
  return { inputPath: positional[0], outDir: out };
}

/** Identity of an entry for de-duplication: the video for YouTube, else the link. */
function entryKey(entry) {
  return entry.videoId ? `yt:${entry.videoId}` : `link:${String(entry.link || "").trim()}`;
}

/** Keep only the documented fields, in the documented order. */
function shape(entry) {
  const out = {};
  for (const field of ENTRY_FIELDS) {
    const value = entry[field];
    if (field === "category" || field === "tags") out[field] = Array.isArray(value) ? value : [];
    else if (field === "duration") out[field] = typeof value === "number" ? value : null;
    else if (field === "audioLink" || field === "videoId") out[field] = value || null;
    else out[field] = value ?? "";
  }
  return out;
}

/**
 * Refresh an entry already in the day file. Every field comes from the new fetch except
 * summary and tags, which keep their earlier value unless the new one is non-empty.
 */
function merge(previous, next) {
  return {
    ...next,
    summary: String(next.summary).trim() ? next.summary : previous.summary,
    tags: next.tags.length ? next.tags : previous.tags,
  };
}

/** The local date an entry belongs to: its publish date, or `fallback` when that is unusable. */
function entryDate(entry, fallback) {
  const published = String(entry.publishedAt || "");
  return /^\d{4}-\d{2}-\d{2}/.test(published) ? published.slice(0, 10) : fallback;
}

const byPublishedDesc = (a, b) =>
  a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : a.title < b.title ? -1 : 1;

function renderMarkdown(day) {
  const lines = [
    "---",
    `Date: ${day.date}`,
    `Updated At: ${day.updatedAt}`,
    `Entries: ${day.entryCount}`,
    "---",
    "",
    `# ${day.date}`,
    "",
  ];

  if (!day.entries.length) {
    lines.push("_No entries in this window._", "");
  }

  for (const entry of day.entries) {
    lines.push(`## ${entry.title}`, "");
    if (entry.thumbnail) lines.push(`![thumbnail|100](${entry.thumbnail})`, "");
    lines.push(`- **Source:** ${entry.source}`);
    lines.push(`- **Published:** ${entry.publishedAt}`);
    lines.push(`- **Link:** ${entry.link}`);
    lines.push(`- **Category:** ${entry.category.join(", ")}`);
    // Without Claude there are no tags or summary; leave the lines out rather than empty.
    if (entry.tags.length) lines.push(`- **Tags:** ${entry.tags.map((t) => `#${t}`).join(" ")}`);
    if (String(entry.summary).trim()) lines.push(`- **Summary:** ${entry.summary}`);
    lines.push("");
  }

  lines.push("\u26a0\ufe0f **Fetch issues**", "");
  if (day.errors.length) {
    for (const e of day.errors) lines.push(`- ${e.source} (${e.type}): ${e.error}`);
  } else {
    lines.push("- None");
  }
  lines.push("");
  return lines.join("\n");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const serialise = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Day files are named <YYYY-MM-DD>.json; this excludes index.json and <YYYY-MM-DD>-index.json. */
const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

const dayPath = (outDir, date) => join(outDir, ...date.split("-").slice(0, 2), `${date}.json`);

/** Every readable day file under outDir, with its path and its text as it is on disk. */
function readDayFiles(outDir, { warn = true } = {}) {
  const days = [];
  if (!existsSync(outDir)) return days;
  for (const dirent of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile() || !DAY_FILE.test(dirent.name)) continue;
    const path = join(dirent.parentPath ?? dirent.path, dirent.name);
    let text;
    let day;
    try {
      text = readFileSync(path, "utf8");
      day = JSON.parse(text);
    } catch {
      if (warn) console.error(`warning: skipping unreadable ${path}`);
      continue;
    }
    if (!day?.date || !Array.isArray(day.entries)) continue;
    days.push({ ...day, path, text });
  }
  return days;
}

/** A day file, its Markdown note and its day index. */
function removeDay(jsonPath) {
  for (const path of [jsonPath, jsonPath.replace(/\.json$/, ".md"), jsonPath.replace(/\.json$/, "-index.json")]) {
    rmSync(path, { force: true });
  }
}

/** The lightweight, summary-free record an index keeps for one entry. */
function indexRecord(date, entry) {
  const record = {};
  for (const field of INDEX_FIELDS) record[field] = field === "date" ? date : entry[field] ?? (field === "category" || field === "tags" ? [] : "");
  return record;
}

function collectFacets(records) {
  const facets = { types: new Set(), categories: new Set(), sources: new Set(), tags: new Set() };
  for (const record of records) {
    if (record.type) facets.types.add(record.type);
    if (record.source) facets.sources.add(record.source);
    for (const c of record.category) facets.categories.add(c);
    for (const t of record.tags) facets.tags.add(t);
  }
  return {
    types: [...facets.types].sort(),
    categories: [...facets.categories].sort(),
    sources: [...facets.sources].sort(),
    tags: [...facets.tags].sort(),
  };
}

/**
 * Rebuild every day's index and the global index from whatever day files are on disk,
 * rather than appending to the previous index. A day file that was edited or deleted by
 * hand can then never leave a stale record behind.
 */
function rebuildIndexes(outDir) {
  const entries = [];
  const dates = [];
  const relative = (path) => path.slice(outDir.length + 1).split("\\").join("/");

  // Re-read rather than reuse what main() loaded, so the indexes match the disk exactly.
  for (const day of readDayFiles(outDir, { warn: false })) {
    const records = day.entries.map((entry) => indexRecord(day.date, entry)).sort(byPublishedDesc);
    const dayIndexPath = day.path.replace(/\.json$/, "-index.json");
    const dayIndex = {
      date: day.date,
      updatedAt: day.updatedAt ?? "",
      entryCount: records.length,
      path: relative(day.path),
      facets: collectFacets(records),
      entries: records,
    };
    writeFile(dayIndexPath, serialise(dayIndex));

    dates.push({
      date: day.date,
      entryCount: records.length,
      path: relative(day.path),
      indexPath: relative(dayIndexPath),
    });
    entries.push(...records);
  }

  dates.sort((a, b) => (a.date < b.date ? 1 : -1));
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : byPublishedDesc(a, b)));

  return {
    updatedAt: localDateTime(new Date()),
    dateCount: dates.length,
    entryCount: entries.length,
    dates,
    facets: collectFacets(entries),
    entries,
  };
}

function main() {
  const { inputPath, outDir: outArg } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    console.error("usage: node write.mjs <enriched.json> [--out output/data]");
    process.exitCode = 2;
    return;
  }

  const outDir = resolve(outArg || join(PROJECT_ROOT, "output", "data"));
  const input = readJson(inputPath);
  const incoming = (input.entries || []).filter((e) => e?.title && e?.link);

  const missingSummary = incoming.filter((e) => !String(e.summary || "").trim()).length;
  if (missingSummary) console.error(`warning: ${missingSummary} of ${incoming.length} entries have no summary`);

  const now = new Date();
  // The date this run is for: the --date fetched, else today. Its file is always written
  // and is the one that records the fetch errors.
  const runDate = input.targetDate || localDate(now);
  const existingDays = readDayFiles(outDir);

  // Every entry already on disk, across all days, keyed by identity. `from` is the date of
  // the file it was read from (null for a new entry).
  const pool = new Map();
  for (const day of existingDays) {
    for (const raw of day.entries) {
      const held = { entry: shape(raw), from: day.date };
      const key = entryKey(held.entry);
      const other = pool.get(key);
      if (!other) {
        pool.set(key, held);
        continue;
      }
      // The same item in two day files: keep the copy filed under its own publish date.
      const [keep, drop] = entryDate(held.entry, held.from) === held.from ? [held, other] : [other, held];
      pool.set(key, { ...keep, entry: merge(drop.entry, keep.entry) });
    }
  }

  const stats = new Map();
  const statsFor = (date) => stats.get(date) ?? stats.set(date, { added: 0, updated: 0 }).get(date);
  const seenThisRun = new Set();
  for (const raw of incoming) {
    const entry = shape(raw);
    const key = entryKey(entry);
    // The same item from two sources counts once; the first one wins.
    if (seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    const held = pool.get(key);
    if (held) {
      pool.set(key, { entry: merge(held.entry, entry), from: held.from });
      statsFor(entryDate(entry, held.from)).updated += 1;
    } else {
      pool.set(key, { entry, from: null });
      statsFor(entryDate(entry, runDate)).added += 1;
    }
  }

  const buckets = new Map();
  let moved = 0;
  for (const { entry, from } of pool.values()) {
    const date = entryDate(entry, from ?? runDate);
    if (from && from !== date) moved += 1;
    if (!buckets.has(date)) buckets.set(date, []);
    buckets.get(date).push(entry);
  }

  const existingByDate = new Map(existingDays.map((day) => [day.date, day]));
  const allDates = [...new Set([runDate, ...buckets.keys(), ...existingByDate.keys()])].sort().reverse();
  const written = [];
  const removed = [];
  for (const date of allDates) {
    const entries = (buckets.get(date) ?? []).sort(byPublishedDesc);
    const previous = existingByDate.get(date);
    const isRunDate = date === runDate;

    // Every entry moved out to its publish date: the file has nothing left to hold.
    if (!entries.length && !isRunDate && previous?.entries.length) {
      removeDay(previous.path);
      removed.push(previous.path);
      continue;
    }

    const day = {
      date,
      updatedAt: previous?.updatedAt ?? "",
      entryCount: entries.length,
      entries,
      // Fetch errors describe the run, so only the run date's file records them.
      errors: isRunDate ? input.errors || [] : previous?.errors ?? [],
    };
    // The run date's file is always written; any other only when its content changed.
    if (!isRunDate && previous && serialise(day) === previous.text) continue;
    day.updatedAt = localDateTime(now);

    const jsonPath = previous?.path ?? dayPath(outDir, date);
    const mdPath = jsonPath.replace(/\.json$/, ".md");
    writeFile(jsonPath, serialise(day));
    writeFile(mdPath, renderMarkdown(day));
    written.push({
      date,
      json: jsonPath,
      markdown: mdPath,
      dayIndex: jsonPath.replace(/\.json$/, "-index.json"),
      ...(stats.get(date) ?? { added: 0, updated: 0 }),
      entryCount: day.entryCount,
    });
  }

  const indexPath = join(outDir, "index.json");
  const index = rebuildIndexes(outDir);
  writeFile(indexPath, serialise(index));

  const total = (field) => [...stats.values()].reduce((sum, s) => sum + s[field], 0);
  const summary = {
    days: written,
    removed,
    moved,
    index: indexPath,
    added: total("added"),
    updated: total("updated"),
    skippedAsDuplicate: incoming.length - seenThisRun.size,
    indexedDays: index.dateCount,
    indexedEntries: index.entryCount,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
}
