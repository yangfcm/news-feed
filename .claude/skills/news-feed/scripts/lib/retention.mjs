// Retention rules declared in source.json: a default for every source under the top-level
// `retention`, overridden rule by rule by an item's own `retention`. Bad rules are warned
// about and ignored.

import { localDate } from "./text.mjs";

const RULES = ["maxAgeDays", "maxEntries"];

/**
 * One raw retention object, validated. Returns only the rules it sets; an explicit null is
 * kept so that it can switch off the default in mergeRetention.
 */
export function parseRetention(raw, where, warnings) {
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
    if (value === null || (Number.isInteger(value) && value > 0)) out[rule] = value;
    else warnings.push(`${where}.${rule} ${JSON.stringify(value)} is not a positive whole number; ignored`);
  }
  return out;
}

/** Default overridden rule by rule; a null override removes the rule. */
export function mergeRetention(defaults, overrides) {
  const out = { ...defaults, ...overrides };
  for (const rule of Object.keys(out)) if (out[rule] === null) delete out[rule];
  return out;
}

/**
 * The entries of one source that `rules` no longer keep: those past the newest `maxEntries`,
 * and those published more than `maxAgeDays` days before `now`'s local date. `entries` are
 * newest first and `dateOf` gives an entry's local publish date, or null. An entry with no
 * publish date is never deleted, nor counted.
 */
export function expiredEntries(entries, rules, now, dateOf) {
  let cutoff = null;
  if (rules.maxAgeDays != null) {
    const day = new Date(now);
    day.setDate(day.getDate() - rules.maxAgeDays);
    cutoff = localDate(day);
  }
  return entries
    .filter((entry) => dateOf(entry))
    .filter((entry, i) => (rules.maxEntries != null && i >= rules.maxEntries) || (cutoff && dateOf(entry) < cutoff));
}
