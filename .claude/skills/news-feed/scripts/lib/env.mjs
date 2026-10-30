// Minimal .env loader. Never overrides a variable already in the environment.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// lib -> scripts -> news-feed -> skills -> .claude -> project root
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

export function loadEnv() {
  for (const path of [resolve(process.cwd(), ".env"), resolve(PROJECT_ROOT, ".env")]) {
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const name = trimmed.slice(0, eq).replace(/^export\s+/, "").trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
        value = value.slice(1, -1);
      }
      if (name && process.env[name] === undefined) process.env[name] = value;
    }
  }
}

/** Where source.json and data/ live: CONTENT_DIR (relative to the project root), else content/. */
export function contentDir() {
  loadEnv();
  return resolve(PROJECT_ROOT, process.env.CONTENT_DIR || "content");
}
