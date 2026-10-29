#!/usr/bin/env node
// Collect everything the sources in source.json published in the last N hours.
//
//   node fetch.mjs <source.json> [--hours 24]
//
// Prints JSON to stdout. `summary` and `tags` are left empty for Claude to fill in.
// source.json is re-read in full on every run: it is hand-edited between runs, so no
// part of the source list is cached, inferred from an earlier output, or hardcoded here.

import { durationToSeconds, localDateTime, parseDate } from "./lib/text.mjs";
import { fetchText, mapPool } from "./lib/http.mjs";
import { normaliseFeedEntry, parseFeed } from "./lib/feeds.mjs";
import { loadSources } from "./lib/sources.mjs";
import { loadEnv } from "./lib/env.mjs";
import { apiKey, bestThumbnail, fetchVideos, listUploads, resolveChannelId, uploadsPlaylistId } from "./lib/youtube.mjs";

const HOURS_DEFAULT = 24;
const HOURS_MIN = 1;
const HOURS_MAX = 48;
const SHORT_MAX_SECONDS = 180; // YouTube videos this long or shorter are Shorts.
const CONCURRENCY = 4;

function parseArgs(argv) {
  const positional = [];
  let hours = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--hours") hours = argv[++i] ?? "";
    else if (arg.startsWith("--hours=")) hours = arg.slice("--hours=".length);
    else positional.push(arg);
  }
  return { sourcePath: positional[0], hoursRaw: hours };
}

/** hours must be a number in [1, 48]; anything else falls back to 24. */
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

function makeEntry(source, fields, published) {
  return {
    title: fields.title,
    source: source.title,
    type: source.type,
    publisher: source.publisher,
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

async function collectFeed(source, cutoff) {
  const { entries: raws, channelImage } = parseFeed(await fetchText(source.link));
  const entries = [];
  let missingFields = 0;
  for (const raw of raws) {
    const published = parseDate(raw.published);
    if (!published || published.getTime() < cutoff) continue;
    const fields = normaliseFeedEntry(raw, channelImage);
    if (!fields.title || !fields.link) {
      missingFields += 1;
      continue;
    }
    entries.push(
      makeEntry(source, { ...fields, duration: durationToSeconds(fields.rawDuration), videoId: null }, published)
    );
  }
  return { entries, missingFields, shorts: 0 };
}

/**
 * YouTube sources together: each channel's uploads are listed separately, then every
 * video id from every channel is fetched in one batched videos.list call.
 */
async function collectYouTube(sources, cutoff) {
  const results = new Map(sources.map((s) => [s, { entries: [], missingFields: 0, shorts: 0, error: null }]));
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
      return { source, ids: await listUploads(uploadsPlaylistId(channelId), key) };
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
      if (!published || published.getTime() < cutoff) continue;

      const duration = durationToSeconds(video.contentDetails?.duration);
      // Unknown duration (live or upcoming) is kept rather than guessed away.
      if (duration !== null && duration <= SHORT_MAX_SECONDS) {
        bucket.shorts += 1;
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
  const { sourcePath, hoursRaw } = parseArgs(process.argv.slice(2));
  if (!sourcePath) {
    console.error("usage: node fetch.mjs <source.json> [--hours 24]");
    process.exitCode = 2;
    return;
  }

  loadEnv();
  const { hours, note } = resolveHours(hoursRaw);
  if (note) console.error(`warning: ${note}`);

  const { sources, warnings } = loadSources(sourcePath);
  for (const w of warnings) console.error(`warning: ${w}`);

  const now = new Date();
  const cutoff = now.getTime() - hours * 3600_000;

  const youtubeSources = sources.filter((s) => s.kind === "youtube");
  const feedSources = sources.filter((s) => s.kind !== "youtube");

  const [feedResults, youtubeResults] = await Promise.all([
    mapPool(feedSources, CONCURRENCY, async (source) => {
      try {
        return { source, ...(await collectFeed(source, cutoff)) };
      } catch (err) {
        return { source, entries: [], missingFields: 0, shorts: 0, error: err.message };
      }
    }),
    collectYouTube(youtubeSources, cutoff),
  ]);

  const bySource = new Map(feedResults.map((r) => [r.source, r]));
  for (const [source, result] of youtubeResults) bySource.set(source, { source, ...result });

  const out = {
    generatedAt: localDateTime(now),
    windowHours: hours,
    sourceFile: sourcePath,
    sources: [],
    entries: [],
    errors: [],
    warnings,
    filtered: { shorts: 0, missingFields: 0 },
  };

  for (const source of sources) {
    const result = bySource.get(source) ?? { entries: [], shorts: 0, missingFields: 0, error: "not fetched" };
    if (result.error) {
      out.errors.push({ source: source.title, type: source.type, link: source.link, error: result.error });
      continue;
    }
    out.sources.push({ source: source.title, type: source.type, link: source.link, count: result.entries.length });
    out.entries.push(...result.entries);
    out.filtered.shorts += result.shorts;
    out.filtered.missingFields += result.missingFields;
  }

  out.entries.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  out.entryCount = out.entries.length;
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

// process.exit() would discard buffered stderr when it is a pipe, losing the warnings above.
main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
