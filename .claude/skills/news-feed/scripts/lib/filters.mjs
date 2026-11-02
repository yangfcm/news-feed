// Entry filters declared in source.json: per-type defaults under the top-level `filters`,
// overridden key by key by an item's own `filters`. Bad rules are warned about and ignored.

import { watchableIn } from "./youtube.mjs";

const DURATION_RULES = ["minDuration", "maxDuration"];
const TITLE_RULES = ["excludeTitle", "includeTitle"];
const RULES = [...DURATION_RULES, "availableInCountry", ...TITLE_RULES];

function patterns(value, where, rule, warnings) {
  const list = Array.isArray(value) ? value : [value];
  const out = [];
  for (const p of list) {
    if (typeof p !== "string" || !p.trim()) {
      warnings.push(`${where}.${rule} has ${JSON.stringify(p)}, which is not a pattern; ignored`);
      continue;
    }
    try {
      out.push(new RegExp(p, "i"));
    } catch (err) {
      warnings.push(`${where}.${rule} pattern ${JSON.stringify(p)} is not a valid regex (${err.message}); ignored`);
    }
  }
  return out;
}

/**
 * One raw filters object, validated. Returns only the rules it sets; an explicit null is kept
 * so that it can switch off a type default in mergeFilters.
 */
export function parseFilters(raw, where, warnings) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push(`${where} is not an object; ignored`);
    return {};
  }
  const out = {};
  for (const [rule, value] of Object.entries(raw)) {
    if (!RULES.includes(rule)) {
      warnings.push(`${where} has unknown rule ${JSON.stringify(rule)}; ignored`);
      continue;
    }
    if (value === null) {
      out[rule] = null;
    } else if (DURATION_RULES.includes(rule)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[rule] = value;
      else warnings.push(`${where}.${rule} ${JSON.stringify(value)} is not a number of seconds; ignored`);
    } else if (rule === "availableInCountry") {
      const code = typeof value === "string" ? value.trim().toUpperCase() : "";
      if (/^[A-Z]{2}$/.test(code)) out[rule] = code;
      else warnings.push(`${where}.${rule} ${JSON.stringify(value)} is not a two-letter country code; ignored`);
    } else {
      const list = patterns(value, where, rule, warnings);
      if (list.length) out[rule] = list;
    }
  }
  return out;
}

/** Defaults overridden key by key; a null override removes the rule. */
export function mergeFilters(defaults, overrides) {
  const out = { ...defaults, ...overrides };
  for (const rule of Object.keys(out)) if (out[rule] === null) delete out[rule];
  return out;
}

/**
 * Why an entry is dropped — "duration", "region" or "title" — or null to keep it.
 * An unknown duration is kept. Region is checked only for YouTube videos.
 */
export function rejectReason({ title, duration, video }, rules) {
  if (duration != null) {
    if (rules.minDuration != null && duration < rules.minDuration) return "duration";
    if (rules.maxDuration != null && duration > rules.maxDuration) return "duration";
  }
  if (video && rules.availableInCountry && !watchableIn(video, rules.availableInCountry)) return "region";
  if (rules.excludeTitle?.some((re) => re.test(title))) return "title";
  if (rules.includeTitle && !rules.includeTitle.some((re) => re.test(title))) return "title";
  return null;
}
