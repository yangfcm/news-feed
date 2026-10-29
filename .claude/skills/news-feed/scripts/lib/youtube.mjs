// YouTube Data API access: channel handle -> uploads playlist -> video details.

import { fetchJson, fetchText } from "./http.mjs";

const API = "https://www.googleapis.com/youtube/v3";
// playlistItems.list costs one quota unit regardless of maxResults, so ask for the maximum:
// a 48-hour window on a busy channel can easily exceed 10 uploads once Shorts are filtered out.
const MAX_RESULTS = 50;
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

/** Video ids of a channel's most recent uploads, newest first. */
export async function listUploads(playlistId, key) {
  const url = `${API}/playlistItems?${new URLSearchParams({
    key,
    playlistId,
    part: "snippet",
    maxResults: String(MAX_RESULTS),
  })}`;
  const data = await fetchJson(url);
  return (data.items || [])
    .map((item) => item?.snippet?.resourceId?.videoId)
    .filter((id) => typeof id === "string" && id);
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

export function bestThumbnail(thumbnails) {
  if (!thumbnails) return "";
  for (const key of THUMB_ORDER) if (thumbnails[key]?.url) return thumbnails[key].url;
  return "";
}
