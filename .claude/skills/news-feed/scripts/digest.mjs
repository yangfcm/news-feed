#!/usr/bin/env node
// Fetch and write in one step, with summary and tags left empty: the way to make a digest
// without Claude. The skill does not use this; it runs fetch.mjs and write.mjs itself so it
// can write the summaries in between.
//
//   node digest.mjs <source.json> [--hours 24] [--out output/data]
//
// --out goes to write.mjs; every other argument is passed on to fetch.mjs. The day file is
// upserted as usual, so summaries written by an earlier Claude run on the same day are kept.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const run = (script, args, stdio) =>
  spawnSync(process.execPath, [join(here, script), ...args], { stdio, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

const fetchArgs = [];
const writeArgs = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--out") writeArgs.push(argv[i], argv[++i] ?? "");
  else if (argv[i].startsWith("--out=")) writeArgs.push(argv[i]);
  else fetchArgs.push(argv[i]);
}

const fetched = run("fetch.mjs", fetchArgs, ["ignore", "pipe", "inherit"]);
if (fetched.status !== 0) {
  process.exitCode = fetched.status ?? 1;
} else {
  const dir = mkdtempSync(join(tmpdir(), "news-feed-"));
  try {
    const raw = join(dir, "raw.json");
    writeFileSync(raw, fetched.stdout);
    process.exitCode = run("write.mjs", [raw, ...writeArgs], "inherit").status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
