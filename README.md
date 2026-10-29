# News Feed

A daily digest of the podcasts, YouTube channels and blogs you follow, with a website to read it on.

## What it does

Each run collects everything your sources published in the last 24 hours and publishes the result as a website.

1. **Fetch.** A [Claude Code](https://claude.com/claude-code) skill, `news-feed`, reads the sources in [`input/source.json`](input/source.json) and fetches their latest items:
   - podcasts and blogs from their RSS/Atom feeds;
   - YouTube channels through the YouTube Data API.

   YouTube Shorts (3 minutes or less) and videos that can't be watched in your country are dropped.

2. **Summarise.** Claude writes a summary in Chinese and a few English tags for every item.
3. **Write.** The day's digest is saved under `output/data/<Year>/<Month>/`:
   - `<date>.json` holds the full data;
   - `<date>.md` is a readable Markdown note;
   - `<date>-index.json` is the day's index.

   A global `output/data/index.json` covers every day. Running again on the same day updates the items already there and adds the new ones. Summaries and tags already written are kept unless new ones are written.

4. **Publish.** The website in [`web/`](web) is a static [Next.js](https://nextjs.org) site built with [shadcn/ui](https://ui.shadcn.com):
   - the home page shows today's digest, and every past day has its own page;
   - a calendar in the sidebar jumps between days that have content;
   - podcast episodes play in an inline audio player, and YouTube videos in an embedded player;
   - it has light and dark themes.

   [`netlify.toml`](netlify.toml) deploys it to Netlify.

```
input/source.json               the sources to follow (edit by hand)
.claude/skills/news-feed/       the skill: instructions (SKILL.md) and fetch/write scripts
output/data/                    the generated digests (committed to git)
web/                            the website (Next.js static export)
netlify.toml                    Netlify build settings
```

## Running it locally

### Requirements

- **Node.js 20.9 or later** and npm. Next.js 16 needs 20.9 or later.
- **Claude Code** (optional), to run the skill. Only the summaries and tags are written by Claude; everything else is scripts. Without Claude, see [Without Claude](#without-claude).
- **A YouTube Data API v3 key**, for the YouTube sources. Create one in the [Google Cloud console](https://console.cloud.google.com/apis/credentials) with the YouTube Data API v3 enabled. Without it, podcasts and blogs still work; only the YouTube sources fail.

### Setup

1. Install the dependencies of the skill scripts and of the website:

   ```bash
   npm run setup
   ```

2. Create `.env` at the project root from the template, and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable     | Meaning                                                                                                                                                                                                            |
   | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `YT_API_KEY` | Your YouTube Data API v3 key.                                                                                                                                                                                      |
   | `COUNTRY`    | Two-letter ISO 3166-1 code of the country you watch from, e.g. `AU`. YouTube videos that are not available there are left out. If it is not set, region-restricted videos are kept and the fetch prints a warning. |

   `.env` is gitignored. Never commit it.

3. Edit [`input/source.json`](input/source.json) to list your sources. Each item looks like this:

   ```json
   {
     "title": "ABC News Daily",
     "link": "https://www.abc.net.au/feeds/9443166/podcast.xml",
     "type": "Podcast",
     "category": ["News"],
     "publisher": { "name": "ABC", "link": "https://www.abc.net.au/" }
   }
   ```

   - `type` is `Podcast`, `YouTube` or `Blog`.
   - `link` depends on the type: a podcast's RSS feed, a blog's RSS/Atom feed, or a YouTube channel page such as `https://www.youtube.com/@maximilian-schwarzmueller`.
   - The file is read again on every run, so you can add or remove sources at any time.

### Making a digest

In Claude Code, from the project root, run the skill:

```
/news-feed
```

Pass a number of hours, from 1 to 48, to change the window: `/news-feed 12`. The skill fetches, summarises, writes the files under `output/data/`, builds the site, and reports what it collected and any sources that failed.

### Without Claude

The digest can be made with the scripts alone. Items then have no summary or tags; the Markdown note and the website simply leave those out.

```bash
npm run digest                  # fetch and write today's digest into output/data/
npm run digest -- --hours 12    # a different window, from 1 to 48 hours
npm run build                   # rebuild the website with it
```

You can mix the two. A later Claude run on the same day fills in the missing summaries, and running `npm run digest` after a Claude run never removes the summaries it wrote.

### Viewing the site

```bash
npm run dev       # http://localhost:3000, reads output/data/ live
```

To check the production build instead, run `npm run build`, then `npm run preview`.

## Commands

Run these from the project root. The root [`package.json`](package.json) only holds these shortcuts and has no dependencies of its own, so don't run `npm install` there.

| Command           | What it does                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`   | Installs the dependencies of the skill scripts (`.claude/skills/news-feed/scripts/`) and does a clean install of the website (`web/`) from its lockfile. Run it after cloning, or when a lockfile changes.                                                                                                                                          |
| `npm run digest`  | Makes today's digest without Claude: fetches what the sources in `input/source.json` published in the last 24 hours, then writes the day's JSON, Markdown note and indexes into `output/data/`, with no summaries or tags. Items already in today's file are updated and new ones added; summaries written earlier are kept. Pass `--hours` (1 to 48) for a different window, e.g. `npm run digest -- --hours 12`, or `--out <dir>` to try a run without touching `output/data/`. Run `npm run build` afterwards to update the website. |
| `npm run dev`     | Starts the website's development server at http://localhost:3000. Pages read `output/data/` on every request, so new data shows up on refresh.                                                                                                                                                                                                      |
| `npm run build`   | Builds the static website into `web/out/`: `index.html` for today, plus one `<date>/index.html` per day in the index. Rebuild after new data is written. The skill does this as its last step.                                                                                                                                                      |
| `npm run preview` | Serves the built `web/out/` locally, to check the production build before deploying.                                                                                                                                                                                                                                                                |
| `npm run lint`    | Runs ESLint over the website code.                                                                                                                                                                                                                                                                                                                  |
