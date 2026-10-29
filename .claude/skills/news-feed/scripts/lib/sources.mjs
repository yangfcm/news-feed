// Read source.json. The file is hand-edited between runs, so nothing here is cached or
// assumed: every run takes the file exactly as it is now, and unknown shapes degrade
// instead of throwing.

import { readFileSync } from "node:fs";

/** Types we know how to fetch. Anything else is treated as a plain RSS/Atom feed. */
const KNOWN = { podcast: "feed", blog: "feed", youtube: "youtube" };

function asArray(value) {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()) : [String(value).trim()];
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Returns { sources, warnings }. A source is skipped only when it has no usable link —
 * everything else gets a sensible fallback so that adding a field-light item to
 * source.json never breaks the whole run.
 */
export function loadSources(path) {
  const raw = readFileSync(path, "utf8");
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err.message}`);
  }

  const items = Array.isArray(doc?.items) ? doc.items : null;
  if (!items) throw new Error(`${path} has no "items" array`);

  const sources = [];
  const warnings = [];
  const seen = new Set();

  items.forEach((item, index) => {
    const link = typeof item?.link === "string" ? item.link.trim() : "";
    if (!link) {
      warnings.push(`items[${index}] (${item?.title || "untitled"}) has no link; skipped`);
      return;
    }
    if (seen.has(link)) {
      warnings.push(`items[${index}] repeats a link already in the file (${link}); skipped`);
      return;
    }
    seen.add(link);

    const declaredType = typeof item?.type === "string" ? item.type.trim() : "";
    const kind = KNOWN[declaredType.toLowerCase()];
    if (!kind) {
      warnings.push(
        `items[${index}] (${item?.title || link}) has type ${JSON.stringify(declaredType) || "(none)"}, ` +
          `which this skill does not know; its link will be read as an RSS/Atom feed`
      );
    }

    const publisher = item?.publisher;
    sources.push({
      // `type` keeps the file's own spelling so it shows up verbatim in the output and index.
      type: declaredType || "Unknown",
      kind: kind || "feed",
      title: (typeof item?.title === "string" && item.title.trim()) || hostOf(link),
      link,
      category: asArray(item?.category),
      publisher:
        (typeof publisher?.name === "string" && publisher.name.trim()) ||
        (typeof publisher === "string" && publisher.trim()) ||
        "",
      order: index,
    });
  });

  if (!sources.length) throw new Error(`${path} has no usable items`);
  return { sources, warnings };
}
