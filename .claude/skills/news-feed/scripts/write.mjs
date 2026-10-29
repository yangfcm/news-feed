#!/usr/bin/env node
// Turn the enriched entries into the day's JSON, its Markdown note, and the global index.
//
//   node write.mjs <enriched.json> [--out output/data]
//
// Re-running on the same day merges: existing entries are kept as they are (summaries
// written earlier are never overwritten) and only unseen entries are appended.

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
    lines.push(`- **Tags:** ${entry.tags.map((t) => `#${t}`).join(" ")}`);
    lines.push(`- **Summary:** ${entry.summary || ''}`);
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

/**
 * Rebuild the index from whatever day files are on disk, rather than appending to the
 * previous index. A day file that was edited or deleted by hand can then never leave a
 * stale record behind.
 */
function rebuildIndex(outDir) {
  const entries = [];
  const dates = [];
  const facets = { types: new Set(), categories: new Set(), sources: new Set(), tags: new Set() };

  if (existsSync(outDir)) {
    for (const dirent of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
      if (!dirent.isFile() || !dirent.name.endsWith(".json") || dirent.name === "index.json") continue;
      const full = join(dirent.parentPath ?? dirent.path, dirent.name);
      let day;
      try {
        day = readJson(full);
      } catch {
        console.error(`warning: skipping unreadable ${full}`);
        continue;
      }
      if (!day?.date || !Array.isArray(day.entries)) continue;

      dates.push({
        date: day.date,
        entryCount: day.entries.length,
        path: full.slice(outDir.length + 1).split("\\").join("/"),
      });
      for (const entry of day.entries) {
        const record = {};
        for (const field of INDEX_FIELDS) record[field] = field === "date" ? day.date : entry[field] ?? (field === "category" || field === "tags" ? [] : "");
        entries.push(record);
        if (entry.type) facets.types.add(entry.type);
        if (entry.source) facets.sources.add(entry.source);
        for (const c of entry.category || []) facets.categories.add(c);
        for (const t of entry.tags || []) facets.tags.add(t);
      }
    }
  }

  dates.sort((a, b) => (a.date < b.date ? 1 : -1));
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : byPublishedDesc(a, b)));

  return {
    updatedAt: localDateTime(new Date()),
    dateCount: dates.length,
    entryCount: entries.length,
    dates,
    facets: {
      types: [...facets.types].sort(),
      categories: [...facets.categories].sort(),
      sources: [...facets.sources].sort(),
      tags: [...facets.tags].sort(),
    },
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

  let existing = [];
  if (existsSync(jsonPath)) {
    try {
      existing = readJson(jsonPath).entries || [];
    } catch {
      console.error(`warning: ${jsonPath} was unreadable and will be replaced`);
    }
  }

  const seen = new Set(existing.map(entryKey));
  const added = [];
  for (const entry of incoming) {
    const key = entryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(shape(entry));
  }

  const day = {
    date,
    updatedAt: localDateTime(now),
    entryCount: existing.length + added.length,
    entries: [...existing.map(shape), ...added].sort(byPublishedDesc),
    errors: input.errors || [],
  };

  writeFile(jsonPath, `${JSON.stringify(day, null, 2)}\n`);
  writeFile(mdPath, renderMarkdown(day));

  const indexPath = join(outDir, "index.json");
  const index = rebuildIndex(outDir);
  writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

  const summary = {
    json: jsonPath,
    markdown: mdPath,
    index: indexPath,
    added: added.length,
    skippedAsDuplicate: incoming.length - added.length,
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
