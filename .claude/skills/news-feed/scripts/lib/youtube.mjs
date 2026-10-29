// YouTube Data API access: channel handle -> uploads playlist -> video details.

import { fetchJson, fetchText } from "./http.mjs";

const API = "https://www.googleapis.com/youtube/v3";
// playlistItems.list costs one quota unit per page regardless of maxResults, so ask for the
// maximum: a 96-hour window on a busy channel can easily exceed 10 uploads.
const MAX_RESULTS = 50;
// Paging back to an older --date stops here: 500 uploads, 10 quota units per channel.
// Whatever is older than that is simply not collected.
const MAX_PAGES = 10;
const THUMB_ORDER = ["maxres", "standard", "high", "medium", "default"];

export function apiKey() {
  const key = (process.env.YT_API_KEY || "").trim();
  if (!key) throw new Error("YT_API_KEY is not set; put it in .env at the project root or export it");
  return key;
}

/** Find the UC… channel id. Taken from the URL when present, else scraped off the channel page. */
export async function resolveChannelId(url) {
  const direct = url.match(/\/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];

  const page = await fetchText(url);
  const found =
    page.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ||
    page.match(/"externalId":"(UC[\w-]{22})"/) ||
    page.match(/"channelId":"(UC[\w-]{22})"/);
  if (!found) throw new Error("could not find a channel id on the channel page");
  return found[1];
}

/** A channel's uploads playlist is its channel id with the UC prefix swapped for UU. */
export function uploadsPlaylistId(channelId) {
  return channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId;
}

/**
 * Ids of a channel's uploads published in window [from, to), newest first. Pages back until
 * it passes `from`; `truncated` is true when MAX_PAGES ran out first. contentDetails carries
 * the video's own publish time, which is close enough to page by; fetch.mjs still filters on
 * the time videos.list reports.
 */
export async function listUploads(playlistId, key, { from, to }) {
  const ids = [];
  let pageToken = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = { key, playlistId, part: "contentDetails", maxResults: String(MAX_RESULTS) };
    if (pageToken) params.pageToken = pageToken;
    const data = await fetchJson(`${API}/playlistItems?${new URLSearchParams(params)}`);
    const items = data.items || [];
    for (const item of items) {
      const id = item?.contentDetails?.videoId;
      if (typeof id !== "string" || !id) continue;
      const published = Date.parse(item.contentDetails.videoPublishedAt ?? "");
      // No publish time (private or upcoming): keep it and let videos.list decide.
      if (Number.isNaN(published) || (published >= from && published < to)) ids.push(id);
    }
    pageToken = data.nextPageToken;
    const oldest = Date.parse(items.at(-1)?.contentDetails?.videoPublishedAt ?? "");
    if (!pageToken || !(oldest >= from)) return { ids, truncated: false };
  }
  return { ids, truncated: true };
}

/**
 * Full details for video ids, as a Map id -> video.
 * Ids from every channel are batched together: 50 per request, one request for most runs.
 */
export async function fetchVideos(ids, key) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const url = `${API}/videos?${new URLSearchParams({
      key,
      part: "snippet,statistics,contentDetails",
      id: ids.slice(i, i + 50).join(","),
    })}`;
    const data = await fetchJson(url);
    for (const video of data.items || []) if (video?.id) out.set(video.id, video);
  }
  return out;
}

/**
 * False when the video lists the only countries it can be watched in and `country` is not
 * one of them, or lists the countries it is blocked in and `country` is one of them.
 * A video with neither list is available everywhere.
 */
export function watchableIn(video, country) {
  const { allowed, blocked } = video?.contentDetails?.regionRestriction ?? {};
  if (Array.isArray(allowed) && !allowed.includes(country)) return false;
  if (Array.isArray(blocked) && blocked.includes(country)) return false;
  return true;
}

export function bestThumbnail(thumbnails) {
  if (!thumbnails) return "";
  for (const key of THUMB_ORDER) if (thumbnails[key]?.url) return thumbnails[key].url;
  return "";
}
