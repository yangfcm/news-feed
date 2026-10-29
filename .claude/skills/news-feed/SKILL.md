---
name: news-feed
description: Build today's news digest from the sources listed in input/source.json (podcasts, YouTube channels and blogs). Collects everything published in the last 24 hours, writes a Chinese summary and tags for each item, and outputs a daily JSON file, a Markdown note and a daily index under output/data/<Year>/<Month>/, plus a global searchable index.
user-invocable: true
argument-hint: "[hours, default 24]"
---

# News Feed

Collect everything the sources in `input/source.json` published in the last 24 hours (or the number of hours given as the argument), summarise each item in Chinese, and write today's digest.

Run everything from the project root.

The work splits in two: the scripts do all fetching, merging and rendering; you write the summaries and tags. Never hand-write the output files — Step 3 generates them.

## source.json changes between runs

`input/source.json` is hand-edited at any time: items are added and removed, and so are types, categories and publishers. On every run, treat the file as it is now.

- Never reuse a source list from memory or from an earlier digest. Step 1 re-reads the file in full.
- `type` is currently `Podcast`, `YouTube` or `Blog`, but a new value may appear at any time. The script reads an unknown type's `link` as an RSS/Atom feed and warns on stderr. Pass that warning on in your report so the user knows the type was not specially handled.
- A source removed from the file simply stops appearing. Entries already written into past day files stay there; do not go back and delete them.
- Categories, tags, types and source names in the index are derived from the data on every run. Nothing about the source list is hardcoded anywhere.

## Step 1: Fetch the entries

Install the dependency once, then fetch:

```bash
[ -d .claude/skills/news-feed/scripts/node_modules ] || npm install --prefix .claude/skills/news-feed/scripts
node .claude/skills/news-feed/scripts/fetch.mjs input/source.json --hours 24 > <scratchpad>/raw.json
```

`--hours` accepts a number from 1 to 48. Anything else — out of range, not a number, missing — falls back to 24 and the script says so on stderr.

`COUNTRY` (see the last section) sets the country used to drop region-restricted YouTube videos. When it is missing or not a two-letter code, nothing is dropped for region and the script says so on stderr. Pass that warning on in your report.

`raw.json` contains:

- `generatedAt`, `windowHours`, `country` (the code used, or `null`), `sourceFile`, `entryCount`
- `entries`: newest first. Each one already has every field the output needs except `summary` and `tags`, which are empty for you to fill in. `description` is the feed's own text, cleaned to plain text — it is your raw material and is **not** part of the final output.
- `sources`: every source that was fetched, with its entry count.
- `errors`: sources that could not be fetched, each with the reason. Do not stop the run for these.
- `warnings`: problems in `source.json` itself (missing link, duplicate link, unknown type).
- `filtered`: how many entries were dropped as Shorts (`shorts`), as YouTube videos not available in `country` (`regionRestricted`), or for missing a title or link (`missingFields`).

Never add a dropped video back, by hand or otherwise. It must not appear in the JSON, the Markdown note or either index.

For each source in `errors`, try once by hand with WebFetch — find its RSS feed or its latest posts — and apply the same time window. Entries found that way are summarised like any other. If that also fails, leave it in the report as a fetch issue.

## Step 2: Write a summary and tags for each entry

First, if today's day file already exists (`output/data/<Year>/<Month>/<YYYY-MM-DD>.json`), read it. An entry in `raw.json` whose `link` — or `videoId`, for YouTube — matches one there that already has a summary does not need a new one: leave its `summary` and `tags` empty, and Step 3 keeps the earlier ones. Write summaries and tags only for the rest.

All summaries are in **Simplified Chinese**. Choose the method by what the entry is (`type`, or for an entry fetched by hand, what the content actually is).

- **Podcast** — `description` is the episode's show notes.
  - Strip the boilerplate: sponsor reads, ad notices, promo codes, chapter timestamps, "contact us / follow us / subscribe" lines, link lists, transcript links, and hosting notices such as "Hosted on Acast" or "See omnystudio.com/listener".
  - What remains is the English original. Translate it into a faithful Chinese summary of 2–5 sentences.
  - If nothing useful is left after stripping, open `link` with WebFetch and use the episode page instead.
- **YouTube** — treat the video description the same way.
  - Remove channel promotions, social links, hashtags, membership and sponsor blurbs, and chapter timestamps. A long chapter list may be condensed into the key topics.
  - If the original is already Chinese, keep its content and still write the summary in Simplified Chinese, converting any Traditional characters.
  - If the description has no real content, base the summary on the title. **Never invent what the video covers.**
- **Blog** — write your own summary of the article.
  - `description` usually holds the full post. If it looks truncated — it ends in "…" or "Read more", or is only a few sentences — WebFetch `link` and read the whole thing.
  - Write 3–6 sentences covering the main points and the conclusion.

For every entry:

- The summary states the content and nothing else. Leave out any note on where the information came from, how complete the description was, or how you worked it out.
- `tags`: 1 to 6 tags, **English, lower case, hyphenated between words** (`machine-learning`, `us-politics`, `premier-league`), with no `#` prefix. Write them from what the entry is actually about — its title and your summary — not from the source's `category`. Prefer a few specific tags over many vague ones; a single-topic entry may well have only two.

Write the result to `<scratchpad>/enriched.json`: the same structure as `raw.json`, with `summary` and `tags` filled in on every entry that needs them (all of them, unless some were already summarised earlier today). Change nothing else.

## Step 3: Write the output files

```bash
node .claude/skills/news-feed/scripts/write.mjs <scratchpad>/enriched.json
```

This writes four files under `output/data/`, using today's local date:

**`<Year>/<Month>/<YYYY-MM-DD>.json`**

```json
{
  "date": "2026-10-29",
  "updatedAt": "2026-10-29 13:40",
  "coverage": 24,
  "entryCount": 5,
  "entries": [
    {
      "title": "...",
      "source": "BBC World Service",
      "type": "YouTube",
      "publisher": "BBC",
      "publishedAt": "2026-10-20 05:25",
      "link": "https://www.youtube.com/watch?v=cRH7CRf4C9c",
      "thumbnail": "https://...",
      "category": ["News"],
      "summary": "...",
      "tags": ["tag1", "tag2"],
      "audioLink": null,
      "videoId": "cRH7CRf4C9c",
      "duration": 170
    }
  ],
  "errors": [{ "source": "...", "type": "...", "link": "...", "error": "..." }]
}
```

`coverage` is the `--hours` window the run used, as a number of hours (`24` means the last 24 hours). `duration` is **whole seconds** (`null` when unknown). `audioLink` and `videoId` are `null` when they do not apply.

**`<Year>/<Month>/<YYYY-MM-DD>.md`** — the same entries as a note: frontmatter (`Date`, `Updated At`, `Coverage`, `Entries` — `Coverage` reads like `24 hours`), an H1 of the date, one `##` section per entry with its thumbnail, the `Source` / `Published` / `Link` / `Category` / `Tags` / `Summary` fields, and a bold `⚠️ **Fetch issues**` block last. `Tags` and `Summary` are left out of an entry that has none, which happens when the digest is made without Claude (`npm run digest`); the website hides them the same way.

**`<Year>/<Month>/<YYYY-MM-DD>-index.json`** — the day's own index, e.g. `2026/10/2026-10-29-index.json`:

```json
{
  "date": "2026-10-29",
  "updatedAt": "2026-10-29 13:40",
  "coverage": 24,
  "entryCount": 5,
  "path": "2026/10/2026-10-29.json",
  "facets": { "types": [], "categories": [], "sources": [], "tags": [] },
  "entries": [
    {
      "date": "2026-10-29",
      "title": "...",
      "link": "...",
      "type": "YouTube",
      "source": "BBC World Service",
      "publisher": "BBC",
      "category": ["News"],
      "tags": ["tag1", "tag2"],
      "publishedAt": "2026-10-20 05:25"
    }
  ]
}
```

`facets` lists every `type`, `category`, `source` and `tag` used that day. `entries` holds one lightweight record per entry, with no summary.

**`index.json`** — one global index for later retrieval. It has the same `facets` and `entries` as a day index, but across all days, plus `dates`, newest first:

```json
"dates": [
  {
    "date": "2026-10-29",
    "coverage": 24,
    "entryCount": 11,
    "path": "2026/10/2026-10-29.json",
    "indexPath": "2026/10/2026-10-29-index.json"
  }
]
```

`coverage` is copied from the day file, in hours. `path` and `indexPath` are relative to `output/data/`. That supports retrieval by exact date, date range, tag, category, type and source name.

Both kinds of index are rebuilt from the day files on every run, so every past day's index is regenerated as well. A day file edited by hand is reflected in its index on the next run.

### Running more than once a day

The skill is meant to run once a day, but running it again is safe and is the normal way to pick up what was published since. Fetch exactly as you would on a first run — the merge happens on write, as an upsert:

- An entry counts as already present when its `link` matches, or its `videoId` for YouTube.
- **An entry already in the day's file is updated** from this fetch: title, thumbnail, duration, publish time and every other fetched field take the new values.
- **`summary` and `tags` are only replaced by non-empty values.** Left empty, the earlier ones are kept, so a summary written earlier is never lost — not even to a run without Claude (`npm run digest`). Conversely, a later skill run fills in the summaries such a run left empty.
- **A new entry is appended.**
- **An entry this fetch did not return is kept as it is** — whether it fell outside a shorter `--hours` window, its source failed this time, or it was filtered out. Nothing is ever removed from a day file by a re-run.
- `updatedAt`, `entryCount`, the Markdown note and both indexes are all refreshed.
- `coverage` is set to this run's `--hours`, replacing the earlier value. It records the window of the latest run, not the union of all runs.

The script prints how many entries it added, how many it updated, how many it skipped as duplicates within this run, and the four file paths.

## Step 4: Build the site

The website in `web/` is a static Next.js export: every day page is rendered into HTML at build time, so it only shows the new data once it is rebuilt.

```bash
cd web && ( [ -d node_modules ] || npm ci ) && npm run build
```

This writes the site to `web/out/` — `out/index.html` is today's page and `out/<YYYY-MM-DD>/index.html` is one page per date in the index. A failed build does not affect the data files written in Step 3; do not retry it repeatedly or edit the site code to make it pass. Report the error instead.

## Step 5: Report

Tell the user:

- the paths of the JSON, Markdown and day index files
- whether the site build succeeded (`web/out/`), or the error it failed with
- how many entries were added and how many updated this run, and the day's total
- the entry count per source, grouped by type
- how many Shorts were filtered out, and how many region-restricted videos (with the `country` used, or the warning that it was not set)
- every source in `errors`, with its reason, and every `source.json` warning

## What the scripts do, so you can read their output

- Each source gets 20 seconds; on any failure it waits 10 seconds and retries once, and only a second failure counts as an error. That source is then skipped and the rest of the run continues.
- Sources are fetched concurrently (4 at a time), so one slow source does not hold up the others.
- YouTube: the `@handle` page gives the `UC…` channel id, whose uploads playlist is the same id with `UC` swapped for `UU`. `playlistItems` lists the newest uploads, then **one batched `videos` call covers every channel at once**. Publish times come from `videos`, because `playlistItems` reports when a video joined the playlist rather than when it went out.
- A YouTube video of **180 seconds or less is a Short and is dropped**. A video whose duration is unknown — live or upcoming — is kept rather than guessed away.
- A YouTube video that cannot be watched in `COUNTRY` is dropped: its `contentDetails.regionRestriction.allowed` list **does not include** `COUNTRY`, or its `regionRestriction.blocked` list **includes** it. A video with neither list is kept.
- An entry with no title or no link is dropped.
- Podcast `duration` comes from `itunes:duration`, which may be seconds, `MM:SS` or `H:MM:SS`; all spellings are normalised to seconds.
- All dates are local time. `publishedAt` is `YYYY-MM-DD HH:mm` and sorts correctly as plain text.
- `YT_API_KEY` is read from the environment, or from `.env` at the project root. Without it, only the YouTube sources fail; podcasts and blogs still produce a digest.
- `COUNTRY` is read the same way: the ISO 3166-1 alpha-2 code of the country the digest is watched from, such as `AU`. Case does not matter.
