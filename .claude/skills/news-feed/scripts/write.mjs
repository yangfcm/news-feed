#!/usr/bin/env node
// Turn the enriched entries into the day's JSON, its Markdown note, its day index, and the
// global index.
//
//   node write.mjs <enriched.json> [--out output/data]
//
// Re-running on the same day upserts: an entry already in the day file is refreshed from
// the new fetch, a new one is appended, and one the new fetch did not return is kept.
// summary and tags are only replaced by non-empty values, so a run without them (no
// Claude) never wipes out ones written earlier.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

const byPublishedDesc = (a, b) =>
  a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : a.title < b.title ? -1 : 1;

function renderMarkdown(day) {
  const lines = [
    "---",
    `Date: ${day.date}`,
    `Updated At: ${day.updatedAt}`,
    `Coverage: ${day.coverage === null ? "unknown" : `${day.coverage} hours`}`,
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

/** Day files are named <YYYY-MM-DD>.json; this excludes index.json and <YYYY-MM-DD>-index.json. */
const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

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

  if (existsSync(outDir)) {
    for (const dirent of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
      if (!dirent.isFile() || !DAY_FILE.test(dirent.name)) continue;
      const full = join(dirent.parentPath ?? dirent.path, dirent.name);
      let day;
      try {
        day = readJson(full);
      } catch {
        console.error(`warning: skipping unreadable ${full}`);
        continue;
      }
      if (!day?.date || !Array.isArray(day.entries)) continue;

      const records = day.entries.map((entry) => indexRecord(day.date, entry)).sort(byPublishedDesc);
      const dayIndexPath = full.replace(/\.json$/, "-index.json");
      const dayIndex = {
        date: day.date,
        updatedAt: day.updatedAt ?? "",
        coverage: day.coverage ?? null,
        entryCount: records.length,
        path: relative(full),
        facets: collectFacets(records),
        entries: records,
      };
      writeFile(dayIndexPath, `${JSON.stringify(dayIndex, null, 2)}\n`);

      dates.push({
        date: day.date,
        coverage: day.coverage ?? null,
        entryCount: records.length,
        path: relative(full),
        indexPath: relative(dayIndexPath),
      });
      entries.push(...records);
    }
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
  const date = localDate(now);
  const [year, month] = date.split("-");
  const jsonPath = join(outDir, year, month, `${date}.json`);
  const mdPath = join(outDir, year, month, `${date}.md`);
  const dayIndexPath = join(outDir, year, month, `${date}-index.json`);

  let existing = [];
  let previousCoverage = null;
  if (existsSync(jsonPath)) {
    try {
      const previous = readJson(jsonPath);
      existing = previous.entries || [];
      previousCoverage = previous.coverage ?? null;
    } catch {
      console.error(`warning: ${jsonPath} was unreadable and will be replaced`);
    }
  }

  const byKey = new Map(existing.map((entry) => [entryKey(entry), shape(entry)]));
  const seenThisRun = new Set();
  let added = 0;
  let updated = 0;
  for (const entry of incoming) {
    const key = entryKey(entry);
    // The same item from two sources counts once; the first one wins.
    if (seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    const previous = byKey.get(key);
    if (previous) {
      byKey.set(key, merge(previous, shape(entry)));
      updated += 1;
    } else {
      byKey.set(key, shape(entry));
      added += 1;
    }
  }
  const entries = [...byKey.values()].sort(byPublishedDesc);

  const day = {
    date,
    updatedAt: localDateTime(now),
    // The hours window of the latest run that wrote this day.
    coverage: typeof input.windowHours === "number" ? input.windowHours : previousCoverage,
    entryCount: entries.length,
    entries,
    errors: input.errors || [],
  };

  writeFile(jsonPath, `${JSON.stringify(day, null, 2)}\n`);
  writeFile(mdPath, renderMarkdown(day));

  const indexPath = join(outDir, "index.json");
  const index = rebuildIndexes(outDir);
  writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  const summary = {
    json: jsonPath,
    markdown: mdPath,
    dayIndex: dayIndexPath,
    index: indexPath,
    added,
    updated,
    skippedAsDuplicate: incoming.length - seenThisRun.size,
    entryCount: day.entryCount,
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
