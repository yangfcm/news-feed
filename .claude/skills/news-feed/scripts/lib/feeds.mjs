// RSS 2.0 / Atom 1.0 / RSS 1.0 parsing, normalised into one entry shape.

import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "./text.mjs";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Tags that may legitimately repeat; forcing arrays keeps the accessors below uniform.
  isArray: (name) => ["item", "entry", "link", "enclosure", "media:thumbnail", "media:content"].includes(name),
});

/** Text of a node that may be a string, an array, or an object carrying #text. */
function text(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") return typeof node["#text"] === "string" ? node["#text"] : "";
  return String(node);
}

function attr(node, name) {
  if (node == null) return "";
  const first = Array.isArray(node) ? node[0] : node;
  return typeof first === "object" ? String(first[`@${name}`] ?? "") : "";
}

function firstTruthy(...values) {
  return values.find((v) => typeof v === "string" && v.trim()) ?? "";
}

/** The alternate (human-readable) link of an Atom entry. */
function atomLink(entry) {
  const links = Array.isArray(entry?.link) ? entry.link : entry?.link ? [entry.link] : [];
  const pick =
    links.find((l) => typeof l === "object" && (l["@rel"] ?? "alternate") === "alternate") ??
    links.find((l) => typeof l === "object" && l["@href"]) ??
    links[0];
  if (typeof pick === "string") return pick;
  return String(pick?.["@href"] ?? "");
}

/** media:content can be audio or video too; only an image one is a thumbnail. */
function mediaImage(nodes) {
  const list = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];
  const img = list.find(
    (m) => typeof m === "object" && (m["@medium"] === "image" || String(m["@type"] ?? "").startsWith("image/"))
  );
  return String(img?.["@url"] ?? "");
}

function mediaThumb(node) {
  return firstTruthy(
    attr(node["media:thumbnail"], "url"),
    mediaImage(node["media:content"]),
    attr(node["itunes:image"], "href"),
    text(node["image"]?.url)
  );
}

function enclosures(item) {
  const list = Array.isArray(item?.enclosure) ? item.enclosure : item?.enclosure ? [item.enclosure] : [];
  return list.filter((e) => e && typeof e === "object");
}

/**
 * Parse a feed document into raw entries.
 * Returns { entries, channelImage }; each entry carries the fields the fetcher needs.
 */
export function parseFeed(xml) {
  const doc = parser.parse(xml);

  const channel = doc?.rss?.channel ?? doc?.["rdf:RDF"] ?? null;
  const feed = doc?.feed ?? null;

  if (channel) {
    const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    const channelImage = firstTruthy(attr(channel["itunes:image"], "href"), text(channel.image?.url));
    const entries = items.map((item) => {
      const encl = enclosures(item);
      const audio = encl.find((e) => String(e["@type"] ?? "").startsWith("audio/"));
      const image = encl.find((e) => String(e["@type"] ?? "").startsWith("image/"));
      return {
        title: text(item.title),
        link: firstTruthy(text(item.link), text(item["atom:link"]), attr(item.link, "href"), text(item.guid)),
        published: firstTruthy(text(item.pubDate), text(item.published), text(item["dc:date"]), text(item.date)),
        duration: firstTruthy(text(item["itunes:duration"]), text(item.duration)),
        audioLink: String(audio?.["@url"] ?? ""),
        thumbnail: firstTruthy(mediaThumb(item), String(image?.["@url"] ?? "")),
        descriptionHtml: firstTruthy(
          text(item["content:encoded"]),
          text(item.description),
          text(item["itunes:summary"]),
          text(item.summary)
        ),
      };
    });
    return { entries, channelImage };
  }

  if (feed) {
    const items = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    const channelImage = firstTruthy(text(feed.logo), text(feed.icon));
    const entries = items.map((entry) => ({
      title: text(entry.title),
      link: atomLink(entry),
      published: firstTruthy(text(entry.published), text(entry.updated)),
      duration: "",
      audioLink: "",
      thumbnail: mediaThumb(entry),
      descriptionHtml: firstTruthy(
        text(entry["media:description"]),
        text(entry.content),
        text(entry.summary)
      ),
    }));
    return { entries, channelImage };
  }

  throw new Error("not an RSS or Atom feed");
}

/** Shape a parsed feed entry into the skill's entry fields (minus summary/tags). */
export function normaliseFeedEntry(raw, channelImage) {
  const { text: description, image } = htmlToText(raw.descriptionHtml);
  return {
    title: String(raw.title || "").trim(),
    link: String(raw.link || "").trim(),
    thumbnail: String(raw.thumbnail || image || channelImage || "").trim(),
    audioLink: String(raw.audioLink || "").trim() || null,
    description,
    rawDuration: raw.duration,
  };
}
