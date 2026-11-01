#!/usr/bin/env node
// Turn the enriched entries into day files — each entry goes into the file of its own
// publish date, so one run may write several — plus their Markdown notes and the index of
// dates. Then, from the same entries, one file per source under sources/, so the website can
// show everything a source has published without reading every day file.
//
//   node write.mjs <enriched.json> [--out <dir>]   (default: <content dir>/data)
//
// Writing upserts across every day file on disk: an entry already filed is refreshed from
// the new fetch, a new one is added, and one the new fetch did not return is kept. An entry
// sitting in the wrong day file is moved to its publish date. summary and tags are only
// replaced by non-empty values, so a run without them (no Claude) never wipes out ones
// written earlier.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { localDate, localDateTime, slugify } from "./lib/text.mjs";
import { contentDir } from "./lib/env.mjs";

const ENTRY_FIELDS = [
  "title",
  "source",
  "type",
  "sourceLink",
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
    if (entry.sourceLink) lines.push(`- **Source Link:** ${entry.sourceLink}`);
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

/** Day files are named <YYYY-MM-DD>.json; this excludes index.json. */
const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

const dayPath = (outDir, date) => join(outDir, ...date.split("-").slice(0, 2), `${date}.json`);

/** The source files live in their own folder under outDir, next to the year folders. */
const SOURCES_DIR = "sources";
const sourcesDir = (outDir) => join(outDir, SOURCES_DIR);
const sourcePath = (outDir, slug) => join(sourcesDir(outDir), `${slug}.json`);

/** Every readable day file under outDir, with its path and its text as it is on disk. */
function readDayFiles(outDir, { warn = true } = {}) {
  const days = [];
  if (!existsSync(outDir)) return days;
  const sources = sourcesDir(outDir);
  for (const dirent of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile() || !DAY_FILE.test(dirent.name)) continue;
    const path = join(dirent.parentPath ?? dirent.path, dirent.name);
    // A source whose name looks like a date is not a day.
    if (path.startsWith(sources + "/") || path.startsWith(sources + "\\")) continue;
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

/** A day file and its Markdown note. */
function removeDay(jsonPath) {
  for (const path of [jsonPath, jsonPath.replace(/\.json$/, ".md")]) rmSync(path, { force: true });
}

/**
 * Rebuild the index of dates from whatever day files are on disk, rather than appending to
 * the previous index. A day file that was edited or deleted by hand can then never leave a
 * stale record behind. The site only needs to know which days exist and where their files
 * are; per-entry filtering happens on each day's own page.
 */
function rebuildIndex(outDir) {
  const relative = (path) => path.slice(outDir.length + 1).split("\\").join("/");
  // Re-read rather than reuse what main() loaded, so the index matches the disk exactly.
  const dates = readDayFiles(outDir, { warn: false })
    .map((day) => ({ date: day.date, entryCount: day.entries.length, path: relative(day.path) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    updatedAt: localDateTime(new Date()),
    dateCount: dates.length,
    entryCount: dates.reduce((sum, d) => sum + d.entryCount, 0),
    dates,
  };
}

/**
 * The sources listed in source.json, by title. They give a source's type, categories and
 * link when it has no entries yet, and are the authority on them when it has.
 */
function readConfiguredSources() {
  const path = join(contentDir(), "source.json");
  if (!existsSync(path)) return new Map();
  let items;
  try {
    items = readJson(path).items;
  } catch {
    console.error(`warning: could not read ${path}; source files take their details from the entries`);
    return new Map();
  }
  const sources = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = String(item?.title ?? "").trim();
    if (!name || sources.has(name)) continue;
    sources.set(name, {
      type: String(item.type ?? ""),
      category: Array.isArray(item.category) ? item.category : [],
      sourceLink: String(item.sourceLink ?? ""),
    });
  }
  return sources;
}

/** Every readable source file on disk, by source name, with its text as it is on disk. */
function readSourceFiles(outDir) {
  const sources = new Map();
  const dir = sourcesDir(outDir);
  if (!existsSync(dir)) return sources;
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json") || dirent.name === "index.json") continue;
    const path = join(dir, dirent.name);
    let text;
    let source;
    try {
      text = readFileSync(path, "utf8");
      source = JSON.parse(text);
    } catch {
      console.error(`warning: skipping unreadable ${path}`);
      continue;
    }
    if (!source?.name || !Array.isArray(source.entries)) continue;
    sources.set(source.name, { ...source, path, text });
  }
  return sources;
}

/** An entry's source name; entries written before sources were recorded may have none. */
const sourceName = (entry) => String(entry.source ?? "").trim() || "Unknown source";

/**
 * Write one file per source from the entries, which are every entry on disk after the day
 * files were written, plus an index of the sources. Like the day files, a source file is only
 * rewritten when its content changed, so a source with nothing new is left as it is,
 * `updatedAt` included. A source keeps the slug its file already has, so its URL never
 * changes; a new source gets one from its name, made unique against the ones in use.
 */
function writeSources(outDir, entries, now) {
  const configured = readConfiguredSources();
  const previous = readSourceFiles(outDir);

  const groups = new Map();
  for (const name of configured.keys()) groups.set(name, []);
  for (const entry of entries) {
    const name = sourceName(entry);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }

  // Slugs already on disk are kept; the rest are assigned in name order, so a run is reproducible.
  const slugs = new Map();
  const taken = new Set();
  for (const name of groups.keys()) {
    const slug = previous.get(name)?.slug;
    if (slug && !taken.has(slug)) {
      slugs.set(name, slug);
      taken.add(slug);
    }
  }
  for (const name of [...groups.keys()].filter((n) => !slugs.has(n)).sort((a, b) => a.localeCompare(b, "en"))) {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    slugs.set(name, slug);
    taken.add(slug);
  }

  const written = [];
  const index = [];
  for (const [name, group] of groups) {
    const sorted = [...group].sort(byPublishedDesc);
    // source.json is the authority on a source's details; failing that, its newest entry.
    const details = configured.get(name) ??
      (sorted[0]
        ? { type: sorted[0].type, category: sorted[0].category, sourceLink: sorted[0].sourceLink }
        : { type: "", category: [], sourceLink: "" });
    const before = previous.get(name);
    const slug = slugs.get(name);
    const source = {
      name,
      slug,
      ...details,
      updatedAt: before?.updatedAt ?? "",
      entryCount: sorted.length,
      entries: sorted,
    };
    const path = before?.path ?? sourcePath(outDir, slug);
    if (!before || serialise(source) !== before.text) {
      source.updatedAt = localDateTime(now);
      writeFile(path, serialise(source));
      written.push({ name, slug, path, entryCount: source.entryCount });
    }
    index.push({
      name,
      slug,
      type: source.type,
      category: source.category,
      sourceLink: source.sourceLink,
      entryCount: source.entryCount,
      latestPublishedAt: sorted[0]?.publishedAt ?? "",
      path: `${SOURCES_DIR}/${slug}.json`,
    });
  }

  // A source with no entries left and no longer in source.json has nothing to show.
  const removed = [];
  for (const [name, before] of previous) {
    if (groups.has(name)) continue;
    rmSync(before.path, { force: true });
    removed.push(before.path);
  }

  index.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const indexPath = join(sourcesDir(outDir), "index.json");
  writeFile(
    indexPath,
    serialise({
      updatedAt: localDateTime(now),
      sourceCount: index.length,
      entryCount: index.reduce((sum, s) => sum + s.entryCount, 0),
      sources: index,
    }),
  );
  return { written, removed, index: indexPath, sourceCount: index.length };
}

function main() {
  const { inputPath, outDir: outArg } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    console.error("usage: node write.mjs <enriched.json> [--out <dir>]");
    process.exitCode = 2;
    return;
  }

  const outDir = resolve(outArg || join(contentDir(), "data"));
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
      ...(stats.get(date) ?? { added: 0, updated: 0 }),
      entryCount: day.entryCount,
    });
  }

  const indexPath = join(outDir, "index.json");
  const index = rebuildIndex(outDir);
  writeFile(indexPath, serialise(index));

  // The pool now holds every entry on disk, so the source files come from it directly.
  const sources = writeSources(
    outDir,
    [...pool.values()].map(({ entry }) => entry),
    now,
  );

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
    sources,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
}
