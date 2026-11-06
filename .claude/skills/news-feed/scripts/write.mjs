#!/usr/bin/env node
// Turn the enriched entries into day files — each entry goes into the file of its own
// publish date, so one run may write several — plus their Markdown notes and the index of
// dates. Then, from the same entries, one file per source under sources/, so the website can
// show everything a source has published without reading every day file.
//
//   node write.mjs <enriched.json> [--out <dir>] [--full]   (default: <content dir>/data)
//
// Writing upserts into the day files: an entry already filed is refreshed from the new
// fetch, a new one is added, and one the new fetch did not return is kept. An entry sitting
// in the wrong day file is moved to its publish date. summary and tags are only replaced by
// non-empty values, so a run without them (no Claude) never wipes out ones written earlier.
//
// Only the day files a run can touch are read: the run date, the publish date of every
// incoming entry, and the date an incoming entry is already filed under, which its source's
// file tells. The index of dates and the source files are then updated from what changed,
// so the cost of a run follows the size of the fetch, not of the archive. --full reads every
// day file and rebuilds everything from them instead; it is also what happens when either
// index is missing, and the source files alone are rebuilt when one that is needed can't be read.

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
  let full = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--full") full = true;
    else if (arg === "--out") out = argv[++i] ?? "";
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else positional.push(arg);
  }
  return { inputPath: positional[0], outDir: out, full };
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

/** The JSON at path, or null when it is missing or unreadable. */
function readJsonIfReadable(path) {
  if (!existsSync(path)) return null;
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

/** Every day file under outDir, by path only; the source files are not days. */
function listDayFiles(outDir) {
  if (!existsSync(outDir)) return [];
  const sources = sourcesDir(outDir);
  const paths = [];
  for (const dirent of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile() || !DAY_FILE.test(dirent.name)) continue;
    const path = join(dirent.parentPath ?? dirent.path, dirent.name);
    // A source whose name looks like a date is not a day.
    if (path.startsWith(sources + "/") || path.startsWith(sources + "\\")) continue;
    paths.push(path);
  }
  return paths;
}

/** One day file with its path and its text as it is on disk, or null when it can't be used. */
function readDayFile(path, { warn = true } = {}) {
  if (!existsSync(path)) return null;
  let text;
  let day;
  try {
    text = readFileSync(path, "utf8");
    day = JSON.parse(text);
  } catch {
    if (warn) console.error(`warning: skipping unreadable ${path}`);
    return null;
  }
  if (!day?.date || !Array.isArray(day.entries)) return null;
  return { ...day, path, text };
}

/** Every readable day file under outDir. */
function readDayFiles(outDir, options) {
  return listDayFiles(outDir)
    .map((path) => readDayFile(path, options))
    .filter(Boolean);
}

/** A day file and its Markdown note. */
function removeDay(jsonPath) {
  for (const path of [jsonPath, jsonPath.replace(/\.json$/, ".md")]) rmSync(path, { force: true });
}

/**
 * Build the index of dates from the day files that are on disk, rather than appending to the
 * previous index, so a day file deleted by hand never leaves a stale record behind. `known`
 * gives, by path relative to outDir, the date and entry count of the files this run already
 * knows: the ones it wrote or left unchanged, and in an incremental run the rows of the
 * previous index. Only a file it does not know is read.
 *
 * Also says whether the day files changed outside a run: a known file is gone, or a file
 * was not known. An incremental run then can't trust the source files to match the days.
 */
function buildIndex(outDir, known, now) {
  const dates = [];
  const onDisk = new Set();
  let unknown = 0;
  for (const path of listDayFiles(outDir)) {
    const rel = relativePath(outDir, path);
    onDisk.add(rel);
    let row = known.get(rel);
    if (!row) {
      unknown += 1;
      const day = readDayFile(path, { warn: false });
      if (!day) continue;
      row = { date: day.date, entryCount: day.entries.length };
    }
    dates.push({ date: row.date, entryCount: row.entryCount, path: rel });
  }
  dates.sort((a, b) => (a.date < b.date ? 1 : -1));
  const missing = [...known.keys()].filter((rel) => !onDisk.has(rel)).length;
  return {
    index: {
      updatedAt: localDateTime(now),
      dateCount: dates.length,
      entryCount: dates.reduce((sum, d) => sum + d.entryCount, 0),
      dates,
    },
    changedOutside: unknown > 0 || missing > 0,
  };
}

const relativePath = (outDir, path) => path.slice(outDir.length + 1).split("\\").join("/");

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

/** One source file with its path and its text as it is on disk, or null when it can't be used. */
function readSourceFile(path) {
  if (!existsSync(path)) return null;
  let text;
  let source;
  try {
    text = readFileSync(path, "utf8");
    source = JSON.parse(text);
  } catch {
    console.error(`warning: skipping unreadable ${path}`);
    return null;
  }
  if (!source?.name || !Array.isArray(source.entries)) return null;
  return { ...source, path, text };
}

/** Every readable source file on disk, by source name. */
function readSourceFiles(outDir) {
  const sources = new Map();
  const dir = sourcesDir(outDir);
  if (!existsSync(dir)) return sources;
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json") || dirent.name === "index.json") continue;
    const source = readSourceFile(join(dir, dirent.name));
    if (source) sources.set(source.name, source);
  }
  return sources;
}

/** An entry's source name; entries written before sources were recorded may have none. */
const sourceName = (entry) => String(entry.source ?? "").trim() || "Unknown source";

const sameDetails = (a, b) =>
  JSON.stringify([a.type, a.category, a.sourceLink]) === JSON.stringify([b.type, b.category, b.sourceLink]);

/**
 * Write the source files of `groups` (source name to all of its entries) and the index of
 * sources, which is those plus the rows in `kept`, carried over as they are. `previous` holds
 * the file each group already has, if any. Like the day files, a source file is only
 * rewritten when its content changed, so a source with nothing new is left as it is,
 * `updatedAt` included. A source keeps the slug its file already has, so its URL never
 * changes; a new source gets one from its name, made unique against the ones in use. A group
 * with no entries that is not in source.json has nothing to show, so its file is deleted, as
 * is every path in `remove`.
 *
 * A source's type, categories and link come from source.json. One that is not listed there
 * keeps the ones its file already has, so removing a source from source.json changes nothing
 * about it; a source never listed takes them from its newest entry.
 */
function writeSourceFiles(outDir, now, { configured, groups, previous, kept = [], remove = [] }) {
  // Slugs already on disk are kept; the rest are assigned in name order, so a run is reproducible.
  const slugs = new Map();
  const taken = new Set(kept.map((row) => row.slug));
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
  const removed = [];
  const index = [...kept];
  const removeFile = (path) => {
    if (!existsSync(path)) return;
    rmSync(path, { force: true });
    removed.push(path);
  };
  for (const [name, group] of groups) {
    const before = previous.get(name);
    if (!group.length && !configured.has(name)) {
      if (before?.path) removeFile(before.path);
      continue;
    }
    const sorted = [...group].sort(byPublishedDesc);
    const details = configured.get(name) ??
      (before?.text
        ? { type: before.type, category: before.category, sourceLink: before.sourceLink }
        : sorted[0]
        ? { type: sorted[0].type, category: sorted[0].category, sourceLink: sorted[0].sourceLink }
        : { type: "", category: [], sourceLink: "" });
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
    if (!before?.text || serialise(source) !== before.text) {
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
  for (const path of remove) removeFile(path);

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

/**
 * Rebuild every source file from `entries`, which are every entry on disk. One is written for
 * every source with an entry and every source in source.json; a file on disk for any other
 * source is deleted.
 */
function rebuildSources(outDir, entries, now) {
  const configured = readConfiguredSources();
  const previous = readSourceFiles(outDir);
  const groups = new Map();
  for (const name of configured.keys()) groups.set(name, []);
  for (const entry of entries) {
    const name = sourceName(entry);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
  }
  const remove = [...previous].filter(([name]) => !groups.has(name)).map(([, file]) => file.path);
  return writeSourceFiles(outDir, now, { configured, groups, previous, remove });
}

/**
 * Update the source files from the day files this run read and wrote, without reading the
 * rest. A source's entries are those in its file that were not in the day files read, plus
 * its entries in those day files as they are now; that equals a full rebuild because every
 * entry that could have changed was in the day files read.
 *
 * Which sources to look at comes from comparing source.json with the previous index, by name:
 * one listed with no row is new; one listed whose details differ from its row is rewritten;
 * one not listed whose row has no entries is deleted, without reading its file. Add the sources
 * that had or now have an entry in the day files read, and those whose file is missing. Every
 * other row is carried over as it is. Returns null when a source file it needs can't be read,
 * so the caller can rebuild the source files from the day files instead.
 */
function updateSources(outDir, now, { rows, loadSource, readEntries, touchedEntries, touchedKeys }) {
  const configured = readConfiguredSources();
  const affected = new Set();
  for (const entry of [...readEntries, ...touchedEntries]) affected.add(sourceName(entry));
  for (const [name, details] of configured) {
    const row = rows.get(name);
    if (!row || !sameDetails(row, details)) affected.add(name);
  }
  for (const [name, row] of rows) {
    if (!row.path || !existsSync(join(outDir, row.path))) affected.add(name);
  }

  const groups = new Map();
  const previous = new Map();
  for (const name of affected) {
    const row = rows.get(name);
    let untouched = [];
    if (row) {
      const file = loadSource(name);
      if (file) {
        previous.set(name, file);
        untouched = file.entries.filter((entry) => !touchedKeys.has(entryKey(entry)));
      } else if (row.entryCount > 0) {
        return null;
      } else {
        previous.set(name, { slug: row.slug, path: row.path ? join(outDir, row.path) : null, text: null });
      }
    }
    groups.set(name, [...untouched, ...touchedEntries.filter((entry) => sourceName(entry) === name)]);
  }

  const kept = [];
  const remove = [];
  for (const [name, row] of rows) {
    if (affected.has(name)) continue;
    if (!configured.has(name) && !row.entryCount) remove.push(join(outDir, row.path));
    else kept.push(row);
  }
  return writeSourceFiles(outDir, now, { configured, groups, previous, kept, remove });
}

/** Every entry in the day files on disk, once each. */
function entriesOnDisk(outDir) {
  const seen = new Map();
  for (const day of readDayFiles(outDir, { warn: false })) {
    for (const raw of day.entries) {
      const entry = shape(raw);
      const key = entryKey(entry);
      if (!seen.has(key)) seen.set(key, entry);
    }
  }
  return [...seen.values()];
}

function main() {
  const { inputPath, outDir: outArg, full } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    console.error("usage: node write.mjs <enriched.json> [--out <dir>] [--full]");
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

  // An incremental run needs both indexes from the run before; without them, read everything.
  const previousIndex = full ? null : readJsonIfReadable(join(outDir, "index.json"));
  const previousSources = full ? null : readJsonIfReadable(join(sourcesDir(outDir), "index.json"));
  const incremental = Array.isArray(previousIndex?.dates) && Array.isArray(previousSources?.sources);

  const rows = new Map();
  const sourceCache = new Map();
  /** The source file of a source in the previous index, read once. */
  const loadSource = (name) => {
    if (!sourceCache.has(name)) {
      const row = rows.get(name);
      const file = row?.path ? readSourceFile(join(outDir, row.path)) : null;
      sourceCache.set(name, file?.name === name ? file : null);
    }
    return sourceCache.get(name);
  };

  let existingDays;
  if (incremental) {
    for (const row of previousSources.sources) if (row?.name) rows.set(row.name, row);
    // The day files this run can touch: the run date, each entry's publish date, and the date
    // each entry is filed under now, which differs when its publishedAt changed. The files of
    // the incoming entries' sources tell the latter without opening any other day file.
    const filed = new Map();
    for (const name of new Set(incoming.map((raw) => sourceName(raw)))) {
      for (const entry of loadSource(name)?.entries ?? []) {
        const date = entryDate(entry, null);
        if (date) filed.set(entryKey(entry), date);
      }
    }
    const dates = new Set([runDate]);
    for (const raw of incoming) {
      const entry = shape(raw);
      dates.add(entryDate(entry, runDate));
      const date = filed.get(entryKey(entry));
      if (date) dates.add(date);
    }
    const indexed = new Map(previousIndex.dates.map((row) => [row.date, row.path]));
    existingDays = [...dates]
      .map((date) => {
        const paths = [indexed.get(date) && join(outDir, indexed.get(date)), dayPath(outDir, date)];
        for (const path of paths.filter(Boolean)) {
          const day = readDayFile(path);
          if (day?.date === date) return day;
        }
        return null;
      })
      .filter(Boolean);
  } else {
    existingDays = readDayFiles(outDir);
  }

  // Every entry in the day files read, keyed by identity. `from` is the date of the file it
  // was read from (null for a new entry).
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
  // Every entry the day files held before this run, so the source files can drop their old copies.
  const touchedKeys = new Set(pool.keys());

  const stats = new Map();
  const statsFor = (date) => stats.get(date) ?? stats.set(date, { added: 0, updated: 0 }).get(date);
  const seenThisRun = new Set();
  for (const raw of incoming) {
    const entry = shape(raw);
    const key = entryKey(entry);
    // The same item from two sources counts once; the first one wins.
    if (seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    touchedKeys.add(key);
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
  // Date and entry count of every day file this run wrote or left as it was, by relative path.
  const known = new Map(incremental ? previousIndex.dates.map((row) => [row.path, row]) : []);
  for (const date of allDates) {
    const entries = (buckets.get(date) ?? []).sort(byPublishedDesc);
    const previous = existingByDate.get(date);
    const isRunDate = date === runDate;

    // Every entry moved out to its publish date: the file has nothing left to hold.
    if (!entries.length && !isRunDate && previous?.entries.length) {
      known.delete(relativePath(outDir, previous.path));
      removeDay(previous.path);
      removed.push(previous.path);
      continue;
    }

    const jsonPath = previous?.path ?? dayPath(outDir, date);
    known.set(relativePath(outDir, jsonPath), { date, entryCount: entries.length });

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
  const { index, changedOutside } = buildIndex(outDir, known, now);
  writeFile(indexPath, serialise(index));

  // A full run's pool holds every entry on disk, so the source files come from it directly.
  // An incremental run updates them from the day files it read, unless that can't be trusted.
  const touchedEntries = [...pool.values()].map(({ entry }) => entry);
  let mode = "full";
  let sources = null;
  if (!incremental) {
    sources = rebuildSources(outDir, touchedEntries, now);
  } else if (changedOutside) {
    console.error("warning: day files were added or deleted outside a run; rebuilding the source files from every day file");
  } else {
    mode = "incremental";
    sources = updateSources(outDir, now, {
      rows,
      loadSource,
      readEntries: existingDays.flatMap((day) => day.entries),
      touchedEntries,
      touchedKeys,
    });
    if (!sources) console.error("warning: a source file could not be read; rebuilding the source files from every day file");
  }
  if (!sources) {
    mode = "incremental, sources rebuilt";
    sources = rebuildSources(outDir, entriesOnDisk(outDir), now);
  }

  const total = (field) => [...stats.values()].reduce((sum, s) => sum + s[field], 0);
  const summary = {
    mode,
    daysRead: existingDays.length,
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
