#!/usr/bin/env node
// Collect everything the sources in source.json published in the last N hours, or on one
// local calendar day.
//
//   node fetch.mjs <source.json> [--hours 24 | --date YYYY-MM-DD]   (the project keeps it at input/source.json)
//
// Prints JSON to stdout. `summary` and `tags` are left empty for Claude to fill in.
// source.json is re-read in full on every run: it is hand-edited between runs, so no
// part of the source list is cached, inferred from an earlier output, or hardcoded here.

import { durationToSeconds, localDate, localDateTime, parseDate } from "./lib/text.mjs";
import { fetchText, mapPool } from "./lib/http.mjs";
import { normaliseFeedEntry, parseFeed } from "./lib/feeds.mjs";
import { loadSources } from "./lib/sources.mjs";
import { loadEnv } from "./lib/env.mjs";
import {
  apiKey,
  bestThumbnail,
  fetchVideos,
  listUploads,
  resolveChannelId,
  uploadsPlaylistId,
  watchableIn,
} from "./lib/youtube.mjs";

const HOURS_DEFAULT = 24;
const HOURS_MIN = 1;
const HOURS_MAX = 96;
// --date spellings: YYYY-MM-DD, YYYY/MM/DD or YYYYMMDD.
const DATE_FORMATS = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{4})\/(\d{2})\/(\d{2})$/, /^(\d{4})(\d{2})(\d{2})$/];
const SHORT_MAX_SECONDS = 180; // YouTube videos this long or shorter are Shorts.
const CONCURRENCY = 4;

function parseArgs(argv) {
  const positional = [];
  let hours = null;
  let date = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--hours") hours = argv[++i] ?? "";
    else if (arg.startsWith("--hours=")) hours = arg.slice("--hours=".length);
    else if (arg === "--date") date = argv[++i] ?? "";
    else if (arg.startsWith("--date=")) date = arg.slice("--date=".length);
    else positional.push(arg);
  }
  return { sourcePath: positional[0], hoursRaw: hours, dateRaw: date };
}

/** hours must be a number in [1, 96]; anything else falls back to 24. */
function resolveHours(raw) {
  if (raw === null || String(raw).trim() === "") return { hours: HOURS_DEFAULT, note: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < HOURS_MIN || n > HOURS_MAX) {
    return {
      hours: HOURS_DEFAULT,
      note: `hours ${JSON.stringify(String(raw))} is not a number between ${HOURS_MIN} and ${HOURS_MAX}; using ${HOURS_DEFAULT}`,
    };
  }
  return { hours: n, note: null };
}

/** A real calendar date, not after today, in one of DATE_FORMATS; else null. */
function parseDay(raw, now) {
  const match = DATE_FORMATS.map((re) => String(raw).trim().match(re)).find(Boolean);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const start = new Date(y, m - 1, d);
  // new Date rolls 2026-02-30 over into March; a rolled-over date was not a real one.
  if (start.getFullYear() !== y || start.getMonth() !== m - 1 || start.getDate() !== d) return null;
  if (start.getTime() > now.getTime()) return null;
  return start;
}

/**
 * The publish-time window to collect, as [from, to) in epoch ms. --date takes that local day,
 * midnight to midnight; otherwise the last `hours` hours, with no upper bound (a podcast
 * scheduled ahead is still picked up, as before).
 */
function resolveWindow({ hoursRaw, dateRaw }, now) {
  const notes = [];
  if (dateRaw !== null) {
    if (hoursRaw !== null) notes.push("both --date and --hours given; --hours is ignored");
    const start = parseDay(dateRaw, now);
    if (start) {
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      return { date: localDate(start), hours: null, from: start.getTime(), to: end.getTime(), notes };
    }
    notes.push(
      `date ${JSON.stringify(String(dateRaw))} is not a valid date up to today in YYYY-MM-DD, YYYY/MM/DD or YYYYMMDD; ` +
        `using the last ${HOURS_DEFAULT} hours`
    );
    return { date: null, hours: HOURS_DEFAULT, from: now.getTime() - HOURS_DEFAULT * 3600_000, to: Infinity, notes };
  }
  const { hours, note } = resolveHours(hoursRaw);
  if (note) notes.push(note);
  return { date: null, hours, from: now.getTime() - hours * 3600_000, to: Infinity, notes };
}

const inWindow = (published, window) =>
  Boolean(published) && published.getTime() >= window.from && published.getTime() < window.to;

/** COUNTRY must be an ISO 3166-1 alpha-2 code; without one, region restrictions are not checked. */
function resolveCountry(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(value)) return { country: value, note: null };
  const problem = value ? `COUNTRY ${JSON.stringify(String(raw))} is not a two-letter country code` : "COUNTRY is not set";
  return { country: null, note: `${problem}; region-restricted YouTube videos are not filtered out` };
}

function makeEntry(source, fields, published) {
  return {
    title: fields.title,
    source: source.title,
    type: source.type,
    sourceLink: source.sourceLink,
    publishedAt: localDateTime(published),
    link: fields.link,
    thumbnail: fields.thumbnail || "",
    category: source.category,
    summary: "",
    tags: [],
    audioLink: fields.audioLink ?? null,
    videoId: fields.videoId ?? null,
    duration: fields.duration ?? null,
    description: fields.description,
  };
}

async function collectFeed(source, window) {
  const { entries: raws, channelImage } = parseFeed(await fetchText(source.link));
  const entries = [];
  let missingFields = 0;
  for (const raw of raws) {
    const published = parseDate(raw.published);
    if (!inWindow(published, window)) continue;
    const fields = normaliseFeedEntry(raw, channelImage);
    if (!fields.title || !fields.link) {
      missingFields += 1;
      continue;
    }
    entries.push(
      makeEntry(source, { ...fields, duration: durationToSeconds(fields.rawDuration), videoId: null }, published)
    );
  }
  return { entries, missingFields, shorts: 0, regionRestricted: 0 };
}

/**
 * YouTube sources together: each channel's uploads are listed separately, then every
 * video id from every channel is fetched in one batched videos.list call.
 */
async function collectYouTube(sources, window, country) {
  const results = new Map(
    sources.map((s) => [s, { entries: [], missingFields: 0, shorts: 0, regionRestricted: 0, error: null }])
  );
  if (!sources.length) return results;

  let key;
  try {
    key = apiKey();
  } catch (err) {
    for (const s of sources) results.get(s).error = err.message;
    return results;
  }

  const listed = await mapPool(sources, CONCURRENCY, async (source) => {
    try {
      const channelId = await resolveChannelId(source.link);
      const { ids, truncated } = await listUploads(uploadsPlaylistId(channelId), key, window);
      if (truncated) {
        console.error(`warning: ${source.title}: stopped listing uploads before reaching the start of the window; older videos were not checked`);
      }
      return { source, ids };
    } catch (err) {
      return { source, ids: [], error: err.message };
    }
  });

  const ids = [...new Set(listed.flatMap((l) => l.ids))];
  let videos = new Map();
  let batchError = null;
  if (ids.length) {
    try {
      videos = await fetchVideos(ids, key);
    } catch (err) {
      batchError = err.message;
    }
  }

  for (const { source, ids: channelIds, error } of listed) {
    const bucket = results.get(source);
    if (error) {
      bucket.error = error;
      continue;
    }
    if (batchError) {
      bucket.error = `videos.list failed: ${batchError}`;
      continue;
    }
    for (const id of channelIds) {
      const video = videos.get(id);
      if (!video) continue;
      const snippet = video.snippet || {};
      // videos.list snippet.publishedAt is the real publish time; the one on
      // playlistItems is when the video was added to the uploads playlist.
      const published = parseDate(snippet.publishedAt);
      if (!inWindow(published, window)) continue;

      const duration = durationToSeconds(video.contentDetails?.duration);
      // Unknown duration (live or upcoming) is kept rather than guessed away.
      if (duration !== null && duration <= SHORT_MAX_SECONDS) {
        bucket.shorts += 1;
        continue;
      }
      // A video limited to a list of countries that leaves ours out cannot be watched here.
      if (country && !watchableIn(video, country)) {
        bucket.regionRestricted += 1;
        continue;
      }
      const title = String(snippet.title || "").trim();
      if (!title) {
        bucket.missingFields += 1;
        continue;
      }
      bucket.entries.push(
        makeEntry(
          source,
          {
            title,
            link: `https://www.youtube.com/watch?v=${id}`,
            thumbnail: bestThumbnail(snippet.thumbnails) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            audioLink: null,
            videoId: id,
            duration,
            description: String(snippet.description || "").trim(),
          },
          published
        )
      );
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sourcePath } = args;
  if (!sourcePath) {
    console.error("usage: node fetch.mjs <source.json> [--hours 24 | --date YYYY-MM-DD]");
    process.exitCode = 2;
    return;
  }

  loadEnv();
  const now = new Date();
  const window = resolveWindow(args, now);
  for (const note of window.notes) console.error(`warning: ${note}`);
  const { country, note: countryNote } = resolveCountry(process.env.COUNTRY);
  if (countryNote) console.error(`warning: ${countryNote}`);

  const { sources, warnings } = loadSources(sourcePath);
  for (const w of warnings) console.error(`warning: ${w}`);

  const youtubeSources = sources.filter((s) => s.kind === "youtube");
  const feedSources = sources.filter((s) => s.kind !== "youtube");

  const [feedResults, youtubeResults] = await Promise.all([
    mapPool(feedSources, CONCURRENCY, async (source) => {
      try {
        return { source, ...(await collectFeed(source, window)) };
      } catch (err) {
        return { source, entries: [], missingFields: 0, shorts: 0, regionRestricted: 0, error: err.message };
      }
    }),
    collectYouTube(youtubeSources, window, country),
  ]);

  const bySource = new Map(feedResults.map((r) => [r.source, r]));
  for (const [source, result] of youtubeResults) bySource.set(source, { source, ...result });

  const out = {
    generatedAt: localDateTime(now),
    // Exactly one of these is set: the hours window, or the single day fetched.
    windowHours: window.hours,
    targetDate: window.date,
    country,
    sourceFile: sourcePath,
    sources: [],
    entries: [],
    errors: [],
    warnings,
    filtered: { shorts: 0, regionRestricted: 0, missingFields: 0 },
  };

  for (const source of sources) {
    const result = bySource.get(source) ?? {
      entries: [],
      shorts: 0,
      regionRestricted: 0,
      missingFields: 0,
      error: "not fetched",
    };
    if (result.error) {
      out.errors.push({ source: source.title, type: source.type, link: source.link, error: result.error });
      continue;
    }
    out.sources.push({ source: source.title, type: source.type, link: source.link, count: result.entries.length });
    out.entries.push(...result.entries);
    out.filtered.shorts += result.shorts;
    out.filtered.regionRestricted += result.regionRestricted;
    out.filtered.missingFields += result.missingFields;
  }

  out.entries.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  out.entryCount = out.entries.length;
  // The day files this fetch will write into, newest first: each entry is filed by its publish date.
  out.dates = [...new Set(out.entries.map((e) => e.publishedAt.slice(0, 10)))];
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

// process.exit() would discard buffered stderr when it is a pipe, losing the warnings above.
main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
