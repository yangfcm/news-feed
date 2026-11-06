---
name: news-feed
description: Build the news digest from the sources listed in content/source.json (podcasts, YouTube channels and blogs). Collects everything published in the last 24 hours (or a given number of hours, or on a given date), writes a Chinese summary and tags for each item, and files each item under its own publish date — a JSON file and a Markdown note per date under content/data/<Year>/<Month>/, plus an index of the dates.
user-invocable: true
argument-hint: "[hours 1-96 | date YYYY-MM-DD, YYYY/MM/DD or YYYYMMDD; default 24 hours]"
---

# News Feed

Collect everything the sources in `content/source.json` published in the last 24 hours, summarise each item in Chinese, and write the digest. The argument changes the window:

- a number from 1 to 96: the last that many hours;
- a date as `YYYY-MM-DD`, `YYYY/MM/DD` or `YYYYMMDD`: everything published on that local calendar day, midnight to midnight. It must be a real date and not after today;
- nothing, or anything invalid: the last 24 hours, and the script says why on stderr.

Every entry is filed under the local date it was **published**, not the date of the run. A 24-hour window usually reaches back into yesterday, so one run normally writes two day files: yesterday's (topped up) and today's.

Run everything from the project root.

Your content lives in `content/`: the sources in `content/source.json` and the digests in `content/data/`. When `CONTENT_DIR` is set, in the environment or in `.env` at the project root, it names another folder, relative to the project root; read `content/` below as that folder. The scripts find it on their own.

The work splits in two: the scripts do all fetching, merging and rendering; you write the summaries and tags. Never hand-write the output files — Step 3 generates them.

## source.json changes between runs

`content/source.json` is hand-edited at any time: items are added and removed, and so are types, categories and source links. On every run, treat the file as it is now.

- Never reuse a source list from memory or from an earlier digest. Step 1 re-reads the file in full.
- `type` is currently `Podcast`, `YouTube` or `Blog`, but a new value may appear at any time. The script reads an unknown type's `link` as an RSS/Atom feed and warns on stderr. Pass that warning on in your report so the user knows the type was not specially handled.
- A source removed from the file simply stops appearing. Entries already written into past day files stay there; do not go back and delete them.
- Categories, tags, types and source names are taken from the data on every run. Nothing about the source list is hardcoded anywhere.

## Step 1: Fetch the entries

Install the dependency once, then fetch:

```bash
[ -d .claude/skills/news-feed/scripts/node_modules ] || npm install --prefix .claude/skills/news-feed/scripts
node .claude/skills/news-feed/scripts/fetch.mjs --hours 24 > <scratchpad>/raw.json
```

Pass the argument on as is: if it is 8 digits or contains `-` or `/`, as `--date <argument>`; otherwise as `--hours <argument>`. With no argument, use `--hours 24`. Let the script validate it — do not reformat or correct the date yourself.

- `--hours` accepts a number from 1 to 96. Anything else — out of range, not a number — falls back to 24 and the script says so on stderr.
- `--date` accepts `YYYY-MM-DD`, `YYYY/MM/DD` or `YYYYMMDD`. A malformed date, an impossible one (`2026-02-30`) or one after today falls back to the last 24 hours, and the script says so on stderr. Pass that warning on in your report.
- Feeds only list their most recent items, so for an older date a podcast or blog may no longer carry what it published then; that is not an error. YouTube uploads are paged back at most 10 pages (500 videos) per channel. If the date is still not reached, that channel simply has no entries for it — not an error — and the script notes it on stderr; mention it in the report.

`raw.json` contains:

- `generatedAt`, `windowHours` (the hours used, or `null` for a date), `targetDate` (the date fetched as `YYYY-MM-DD`, or `null` for an hours window), `sourceFile`, `entryCount`
- `dates`: the distinct publish dates (`YYYY-MM-DD`, local) of the entries, newest first — the day files Step 3 will write into.
- `entries`: newest first. Each one already has every field the output needs except `summary` and `tags`, which are empty for you to fill in. `description` is the feed's own text, cleaned to plain text — it is your raw material and is **not** part of the final output.
- `sources`: every source that was fetched, with its entry count.
- `errors`: sources that could not be fetched, each with the reason. Do not stop the run for these.
- `warnings`: problems in `source.json` itself (missing link, duplicate link, unknown type, a filter rule that cannot be read).
- `filtered`: how many entries the filters in `source.json` dropped, by rule: `duration` (`minDuration` / `maxDuration`), `region` (`availableInCountry`), `title` (`excludeTitle` / `includeTitle`); plus `missingFields`, entries with no title or link.

Never add a dropped video back, by hand or otherwise. It must not appear in the JSON or the Markdown note.

For each source in `errors`, try once by hand with WebFetch — find its RSS feed or its latest posts — and apply the same time window. Entries found that way are summarised like any other. If that also fails, leave it in the report as a fetch issue.

## Step 2: Write a summary and tags for each entry

First, for every date in `raw.json`'s `dates`, read that day file if it exists (`content/data/<Year>/<Month>/<YYYY-MM-DD>.json`). An entry in `raw.json` whose `link` — or `videoId`, for YouTube — matches one there that already has a summary does not need a new one: leave its `summary` and `tags` empty, and Step 3 keeps the earlier ones. Write summaries and tags only for the rest.

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

Write the result to `<scratchpad>/enriched.json`: the same structure as `raw.json`, with `summary` and `tags` filled in on every entry that needs them (all of them, unless some were already summarised by an earlier run). Change nothing else.

## Step 3: Write the output files

```bash
node .claude/skills/news-feed/scripts/write.mjs <scratchpad>/enriched.json
```

Each entry goes into the files of its publish date — the local date at the start of its `publishedAt`. For every date that gains, loses or changes an entry, the script writes the two day files below. The **run date's** day file — `targetDate` for a date fetch, else today's local date — is always written, even when it ends up with no entries, because it is the one that records this run's fetch errors. Then it updates `index.json` and the source files under `sources/`. A `publishedAt` in the future — a podcast scheduled ahead — goes into that future date's file.

The script reads only the day files this run can change: the run date's, the one for each entry's publish date, and the one an entry is already filed under when that is a different date. The source files of the fetched sources tell it the last. The other day files are not opened, so a run takes about as long on a year of digests as on a week. Add `--full` to read every day file and rebuild `index.json` and every source file from them instead. Use it to repair the data after editing a day file by hand. It also happens on its own when `index.json` or `sources/index.json` is missing.

**`<Year>/<Month>/<YYYY-MM-DD>.json`**

```json
{
  "date": "2026-10-29",
  "updatedAt": "2026-10-29 13:40",
  "entryCount": 5,
  "entries": [
    {
      "title": "...",
      "source": "BBC World Service",
      "type": "YouTube",
      "sourceLink": "https://www.youtube.com/@BBCWorldService",
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

`updatedAt` is when this file was last written. `errors` lists the sources that could not be fetched, and only the run date's file gets them from this run: any other day's file keeps the `errors` it already had, or `[]` when this run creates it. `sourceLink` is the source's own page, copied from its `sourceLink` in `source.json` (`""` when it has none). `duration` is **whole seconds** (`null` when unknown). `audioLink` and `videoId` are `null` when they do not apply.

**`<Year>/<Month>/<YYYY-MM-DD>.md`** — the same entries as a note: frontmatter (`Date`, `Updated At`, `Entries`), an H1 of the date, one `##` section per entry with its thumbnail, the `Source` / `Source Link` / `Published` / `Link` / `Category` / `Tags` / `Summary` fields, and a bold `⚠️ **Fetch issues**` block last. `Source Link` is left out when the source has none. `Tags` and `Summary` are left out of an entry that has none, which happens when the digest is made without Claude (`npm run digest`); the website hides them the same way.

**`index.json`** — the list of dates that have a day file, newest first, which the website builds its calendar and pages from:

```json
{
  "updatedAt": "2026-10-29 13:40",
  "dateCount": 1,
  "entryCount": 11,
  "dates": [
    {
      "date": "2026-10-29",
      "entryCount": 11,
      "path": "2026/10/2026-10-29.json"
    }
  ]
}
```

`path` is relative to `content/data/`. There is no index of the entries themselves: the website filters each day's entries on that day's page.

`index.json` is updated from the previous one and the day files this run wrote. The script also lists the day files on disk, so a day file added or deleted by hand is reflected in it on the next run. When that happens, the source files are rebuilt from every day file, because the script can't tell which entries the change added or removed. A day file **edited** by hand is not noticed until a run touches that day, or a run with `--full`.

**`sources/<slug>.json`** — everything one source has published, newest first, so the website can show a source's page without reading every day file. The day files are the record of what was collected, and the source files are derived from them. A run updates a source file from the day files it read: the source keeps the entries in its file that were not in those days, and takes its entries in those days as they are now. A run with `--full` builds every source file from every entry on disk instead; both give the same result. There is a source file for every source that has an entry in any day file, and for every source in `source.json`, even with no entries yet:

```json
{
  "name": "ABC News Daily",
  "slug": "abc-news-daily",
  "type": "Podcast",
  "category": ["News"],
  "sourceLink": "https://www.abc.net.au/listen/programs/abc-news-daily",
  "updatedAt": "2026-10-29 13:40",
  "entryCount": 2,
  "entries": [{ "...": "the same entries as in the day files" }]
}
```

A source is identified by its name, the `source` of its entries. `type`, `category` and `sourceLink` come from its item in `source.json`. A source removed from `source.json` keeps the ones its file already has, and a source never listed there takes them from its newest entry. `slug` is the URL segment of the source's page on the website and the file's name: lower-case letters and digits in any script (so a Chinese name keeps its characters), with every other run of characters replaced by one hyphen, and a number appended when two names give the same slug. A source keeps the slug its file already has, so its URL never changes. Like a day file, a source file is only rewritten when its content changed, `updatedAt` included; one whose source has no entries left and is no longer in `source.json` is deleted.

To decide which sources to look at, the script compares `source.json` with `sources/index.json` by name. A source listed with no row is new and gets a file. A source listed whose details differ from its row is rewritten. A source not listed whose row has no entries is deleted. Add the sources with an entry in the day files read, and every other row of `sources/index.json` is carried over without opening its file. When a source file that is needed can't be read, the script warns and rebuilds every source file from the day files.

**`sources/index.json`** — the list of sources, by name, which the website builds its sources page from:

```json
{
  "updatedAt": "2026-10-29 13:40",
  "sourceCount": 3,
  "entryCount": 11,
  "sources": [
    {
      "name": "ABC News Daily",
      "slug": "abc-news-daily",
      "type": "Podcast",
      "category": ["News"],
      "sourceLink": "https://www.abc.net.au/listen/programs/abc-news-daily",
      "entryCount": 2,
      "latestPublishedAt": "2026-10-29 06:00",
      "path": "sources/abc-news-daily.json"
    }
  ]
}
```

`latestPublishedAt` is `""` for a source with no entries. `path` is relative to `content/data/`.

### Running more than once a day

The skill is meant to run once a day, but running it again is safe and is the normal way to pick up what was published since. Fetch exactly as you would on a first run — the merge happens on write, as an upsert into the day files the run can change:

- An entry counts as already present when its `link` matches, or its `videoId` for YouTube, in the day file of its publish date, or in the day file its source's file says it is filed under.
- **An entry already filed is updated** from this fetch: title, thumbnail, duration, publish time and every other fetched field take the new values.
- **`summary` and `tags` are only replaced by non-empty values.** Left empty, the earlier ones are kept, so a summary written earlier is never lost — not even to a run without Claude (`npm run digest`). Conversely, a later skill run fills in the summaries such a run left empty.
- **A new entry is appended.**
- **An entry this fetch did not return is kept as it is** — whether it fell outside a shorter `--hours` window or another `--date`, its source failed this time, or it was filtered out. Nothing is ever removed from a day file by a re-run.
- **An entry in the wrong day file is moved** to the file of its publish date — for instance after its `publishedAt` changed, or in a file written before entries were filed by publish date. A file left empty by such moves is deleted along with its note. The same item found in two day files is merged into one, keeping any summary and tags.
- A day file whose content did not change is left exactly as it is, `updatedAt` included.
- `updatedAt`, `entryCount` and the Markdown note of every day file written, and `index.json`, are refreshed.
- The source files are updated from the day files as they now are, so they always agree with them; a source with nothing new keeps its file as it was.

The script prints how it ran (`mode`: `full`, `incremental`, or `incremental, sources rebuilt`) and how many day files it read (`daysRead`); for every day file it wrote, its date, its JSON and Markdown paths, how many entries it added and updated and its total (`days`); the day files it removed (`removed`); how many entries it moved between days (`moved`); the totals added and updated; how many it skipped as duplicates within this run; the path of `index.json`; and under `sources`, the source files it wrote (`written`: name, slug, path and entry count of each) and removed (`removed`), the path of `sources/index.json` (`index`) and how many sources it indexed (`sourceCount`).

## Step 4: Build the site

The website in `web/` is a static Next.js export: every day page is rendered into HTML at build time, so it only shows the new data once it is rebuilt.

```bash
cd web && ( [ -d node_modules ] || npm ci ) && npm run build
```

This writes the site to `web/out/` — `out/index.html` is today's page, `out/<YYYY-MM-DD>/index.html` is one page per date in the index, `out/sources/index.html` lists the sources and `out/source/<slug>/index.html` is one page per source in `sources/index.json`. A failed build does not affect the data files written in Step 3; do not retry it repeatedly or edit the site code to make it pass. Report the error instead.

## Step 5: Publish the content

Pushing the content repo is what deploys the site: the push calls a build hook, and the build fetches the content repo. Do this only when `content/` is a git repo of its own with a remote:

```bash
git -C content rev-parse --show-toplevel   # must print the content folder itself
git -C content remote                      # must print at least one remote
```

If either check fails, skip this step and say so in the report; the digest stays local. Otherwise commit everything the run changed and push:

```bash
git -C content add -A
git -C content commit -m "Add <run date> content."
git -C content push
```

`<run date>` is the run date of Step 3: `targetDate` for a date fetch, else today's local date. If nothing changed, there is nothing to commit; skip the push. If the push fails, do not force it or rewrite anything; report the error. The commit stays local until the next push.

## Step 6: Report

Tell the user:

- the window used: the hours, or the date

- for every day file written: its date, the paths of its JSON and Markdown files, how many entries were added and updated, and that day's total
- any day files removed and the number of entries moved between days, when there were any
- whether the site build succeeded (`web/out/`), or the error it failed with
- whether the content was pushed (with the commit), skipped (and why), or failed to push (with the error)
- the entry count per source, grouped by type
- how many entries were filtered out, by reason (`duration`, `region`, `title`)
- every source in `errors`, with its reason, and every `source.json` warning

## What the scripts do, so you can read their output

- Each source gets 20 seconds; on any failure it waits 10 seconds and retries once, and only a second failure counts as an error. That source is then skipped and the rest of the run continues.
- Sources are fetched concurrently (4 at a time), so one slow source does not hold up the others.
- YouTube: the `@handle` page gives the `UC…` channel id, whose uploads playlist is the same id with `UC` swapped for `UU`. `playlistItems` lists the newest uploads, then **one batched `videos` call covers every channel at once**. Publish times come from `videos`, because `playlistItems` reports when a video joined the playlist rather than when it went out.
- Filters come from `source.json`: the top-level `filters` holds defaults per type (matched to an item's `type` in any case), and an item's own `filters` replaces them rule by rule; a rule set to `null` turns the default off for that item. An entry is dropped when:
  - `minDuration` / `maxDuration`: its duration in seconds is below / above the value. A duration that is unknown — a live or upcoming video, a podcast without `itunes:duration` — is kept rather than guessed away. Shorts are dropped by a YouTube default of `minDuration: 181`.
  - `availableInCountry`: it is a YouTube video that cannot be watched in that country (a two-letter code): its `contentDetails.regionRestriction.allowed` list **does not include** it, or its `regionRestriction.blocked` list **includes** it. A video with neither list is kept. On other types the rule has no effect.
  - `excludeTitle` / `includeTitle`: its title matches any of the regexes / none of them, ignoring case.
  - An unknown rule, a value of the wrong kind or an invalid regex is ignored with a warning.
- An entry with no title or no link is dropped.
- Podcast `duration` comes from `itunes:duration`, which may be seconds, `MM:SS` or `H:MM:SS`; all spellings are normalised to seconds.
- All dates are local time. `publishedAt` is `YYYY-MM-DD HH:mm` and sorts correctly as plain text.
- `YT_API_KEY` is read from the environment, or from `.env` at the project root. Without it, only the YouTube sources fail; podcasts and blogs still produce a digest.
