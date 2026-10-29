// Text helpers: HTML to plain text, duration normalisation, local date formatting.

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ",
  mdash: "—", ndash: "–", hellip: "…", middot: "·", bull: "•",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«",
  raquo: "»", deg: "°", trade: "™", copy: "©", reg: "®",
  times: "×", frac12: "½", eacute: "é", egrave: "è", agrave: "à",
  ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
  ntilde: "ñ", pound: "£", euro: "€", yen: "¥",
};

export function decodeEntities(input) {
  return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? match;
  });
}

const BLOCK_TAGS = /<\/?(?:p|br|div|li|ul|ol|h[1-6]|tr|td|th|section|article|blockquote|pre|figure)\b[^>]*>/gi;

/** Turn a feed's HTML (or plain text) field into readable plain text, plus its first image. */
export function htmlToText(raw) {
  if (raw == null || raw === "") return { text: "", image: null };
  let s = String(raw);
  const img = s.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(BLOCK_TAGS, "\n");
  s = s.replace(/<[^>]*>/g, " ");
  s = decodeEntities(s);
  s = s
    .replace(/[ \t\r\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: s, image: img ? decodeEntities(img[1]).trim() : null };
}

/**
 * Normalise every duration spelling we see into whole seconds.
 * YouTube returns ISO 8601 ("PT14M35S"); podcast feeds use "0:14:35", "14:35" or "875".
 */
export function durationToSeconds(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const iso = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso && iso.slice(1).some(Boolean)) {
    const [, d, h, m, sec] = iso;
    return Math.round(Number(d || 0) * 86400 + Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(sec || 0));
  }
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(Number(s));

  const parts = s.split(":").map((p) => p.trim());
  if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => /^\d+(?:\.\d+)?$/.test(p))) {
    const n = parts.map(Number);
    return Math.round(n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1]);
  }
  return null;
}

export function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // Some feeds emit "2026-10-28 16:00:00 +1100" instead of a T-separated stamp.
  d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, "0");

/** Local-time YYYY-MM-DD. All dates in the output are local, never UTC. */
export function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-time YYYY-MM-DD HH:mm. Sorts correctly as a plain string. */
export function localDateTime(d) {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
