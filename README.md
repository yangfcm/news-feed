# News Feed

A daily digest of the podcasts, YouTube channels and blogs you follow, with a website to read it on.

## What it does

Each run collects everything your sources published in the last 24 hours and publishes the result as a website.

1. **Fetch.** A [Claude Code](https://claude.com/claude-code) skill, `news-feed`, reads the sources in `content/source.json` and fetches their latest items:
   - podcasts and blogs from their RSS/Atom feeds;
   - YouTube channels through the YouTube Data API.

   YouTube Shorts (3 minutes or less) and videos that can't be watched in your country are dropped.

2. **Summarise.** Claude writes a summary in Chinese and a few English tags for every item.
3. **Write.** Each item is filed under the day it was published, so one run usually writes both yesterday's and today's digest, under `content/data/<Year>/<Month>/`:
   - `<date>.json` holds the full data;
   - `<date>.md` is a readable Markdown note.

   `content/data/index.json` lists every day that has a digest; the website builds its calendar and pages from it. Running again updates the items already filed and adds the new ones to their day. Summaries and tags already written are kept unless new ones are written.

4. **Publish.** The website in [`web/`](web) is a static [Next.js](https://nextjs.org) site built with [shadcn/ui](https://ui.shadcn.com):
   - the home page shows today's digest, and every past day has its own page;
   - a calendar in the sidebar jumps between days that have content;
   - podcast episodes play in an inline audio player, and YouTube videos in an embedded player;
   - it has light and dark themes.

   [`netlify.toml`](netlify.toml) deploys it to Netlify.

```
content/                        your content, kept out of this repo (gitignored)
  source.json                   the sources to follow (edit by hand)
  data/                         the generated digests
source.example.json             a starting source.json; `npm run setup` copies it into content/
.claude/skills/news-feed/       the skill: instructions (SKILL.md) and fetch/write scripts
web/                            the website (Next.js static export)
scripts/fetch-content.sh        clones your content repo before a Netlify build
netlify.toml                    Netlify build settings
```

The code and your content are kept apart: this repo holds only the code, and `content/` holds your sources and digests. To keep them in git, make `content/` a repo of its own; see [Keeping your content in git](#keeping-your-content-in-git).

## Running it locally

### Requirements

- **Node.js 20.9 or later** and npm. Next.js 16 needs 20.9 or later.
- **Claude Code** (optional), to run the skill. Only the summaries and tags are written by Claude; everything else is scripts. Without Claude, see [Without Claude](#without-claude).
- **A YouTube Data API v3 key**, for the YouTube sources. Create one in the [Google Cloud console](https://console.cloud.google.com/apis/credentials) with the YouTube Data API v3 enabled. Without it, podcasts and blogs still work; only the YouTube sources fail.

### Setup

1. Install the dependencies of the skill scripts and of the website, and create `content/source.json` from the example:

   ```bash
   npm run setup
   ```

   If you already keep your content in a repo, clone it as `content/` first; setup then leaves it alone.

2. Create `.env` at the project root from the template, and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable     | Meaning                                                                                                                                                                                                            |
   | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `YT_API_KEY` | Your YouTube Data API v3 key.                                                                                                                                                                                      |
   | `COUNTRY`    | Two-letter ISO 3166-1 code of the country you watch from, e.g. `AU`. YouTube videos that are not available there are left out. If it is not set, region-restricted videos are kept and the fetch prints a warning. |
   | `CONTENT_DIR` | Optional. The folder holding `source.json` and `data/`, relative to the project root. Defaults to `content`. The website reads it from the environment only, not from `.env`. |

   `.env` is gitignored. Never commit it.

3. Edit `content/source.json` to list your sources. Each item looks like this:

   ```json
   {
     "title": "ABC News Daily",
     "link": "https://www.abc.net.au/feeds/9443166/podcast.xml",
     "type": "Podcast",
     "category": ["News"],
     "sourceLink": "https://www.abc.net.au/listen/programs/abc-news-daily"
   }
   ```

   - `type` is `Podcast`, `YouTube` or `Blog`.
   - `link` depends on the type: a podcast's RSS feed, a blog's RSS/Atom feed, or a YouTube channel page such as `https://www.youtube.com/@maximilian-schwarzmueller`.
   - `sourceLink` is the source's own page for people to visit, such as the podcast's homepage. The website links to it next to the source name. It is optional; leave it empty or out to show no link.
   - The file is read again on every run, so you can add or remove sources at any time.

### Making a digest

In Claude Code, from the project root, run the skill:

```
/news-feed
```

Pass a number of hours, from 1 to 96, to change the window: `/news-feed 12`. Or pass a date — `2026-10-27`, `2026/10/27` or `20261027` — to collect what was published on that day: `/news-feed 2026-10-27`. An invalid date, or one after today, falls back to the last 24 hours. Feeds only keep their recent items, so an older date may come back incomplete. The skill fetches, summarises, writes the files under `content/data/`, builds the site, pushes the content repo if `content/` is one, and reports what it collected and any sources that failed.

### Without Claude

The digest can be made with the scripts alone. Items then have no summary or tags; the Markdown note and the website simply leave those out.

```bash
npm run digest                  # fetch and write the digest into content/data/
npm run digest -- --hours 12    # a different window, from 1 to 96 hours
npm run digest -- --date 2026-10-27   # one day; also 2026/10/27 or 20261027
npm run build                   # rebuild the website with it
```

You can mix the two. A later Claude run on the same day fills in the missing summaries, and running `npm run digest` after a Claude run never removes the summaries it wrote.

### Viewing the site

```bash
npm run dev       # http://localhost:3000, reads content/data/ live
```

To check the production build instead, run `npm run build`, then `npm run preview`.

## Keeping your content in git

`content/` is gitignored, so this repo never picks up your sources or digests. To keep them in git, and to deploy them, make `content/` a repo of its own, private if you like:

```bash
cd content
git init
git add -A
git commit -m "Add content."
git remote add origin git@github.com:<you>/news-feed-data.git
git push -u origin main
```

On another machine, clone that repo as `content/` in the project root. From then on, each `/news-feed` run commits the changes in `content/` and pushes them. After `npm run digest`, push them yourself:

```bash
git -C content add -A && git -C content commit -m "Add content." && git -C content push
```

## Deploying to Netlify

Netlify builds the site from this repo, and [`scripts/fetch-content.sh`](scripts/fetch-content.sh) clones your content repo into `content/` before the build.

1. Create a Netlify site from this repo. [`netlify.toml`](netlify.toml) already holds the build settings.
2. In the site's environment variables, set:

   | Variable             | Value                                                                                                                                 |
   | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
   | `CONTENT_REPO`       | Your content repo on GitHub, as `owner/name`, e.g. `yangfcm/news-feed-data`.                                                          |
   | `CONTENT_REPO_TOKEN` | Only for a private content repo: a GitHub fine-grained token with read-only access to **Contents** of that one repo.                   |

3. In Netlify, add a build hook (**Site configuration → Build & deploy → Build hooks**) and copy its URL.
4. In the content repo on GitHub, add the URL as an Actions secret named `NETLIFY_BUILD_HOOK`, and add this workflow as `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - run: curl -fsS -X POST -d '{}' "$HOOK"
           env:
             HOOK: ${{ secrets.NETLIFY_BUILD_HOOK }}
   ```

Every push to the content repo then rebuilds the site with the new digests. A push to this repo rebuilds it too, and that build also fetches the latest content.

## Commands

Run these from the project root. The root [`package.json`](package.json) only holds these shortcuts and has no dependencies of its own, so don't run `npm install` there.

| Command           | What it does                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`   | Installs the dependencies of the skill scripts (`.claude/skills/news-feed/scripts/`) and does a clean install of the website (`web/`) from its lockfile. Creates `content/source.json` from `source.example.json` if it does not exist yet. Run it after cloning, or when a lockfile changes.                                                                                                                                          |
| `npm run digest`  | Makes the digest without Claude: fetches what the sources in `content/source.json` published in the last 24 hours, then writes each item into the JSON and Markdown note of the day it was published, and the index of dates, into `content/data/`, with no summaries or tags. Items already filed are updated and new ones added; summaries written earlier are kept. Pass `--hours` (1 to 96) for a different window, e.g. `npm run digest -- --hours 12`, `--date` for one day, e.g. `npm run digest -- --date 2026-10-27`, or `--out <dir>` to try a run without touching `content/data/`. Run `npm run build` afterwards to update the website. |
| `npm run dev`     | Starts the website's development server at http://localhost:3000. Pages read `content/data/` on every request, so new data shows up on refresh.                                                                                                                                                                                                      |
| `npm run build`   | Builds the static website into `web/out/`: `index.html` for today, plus one `<date>/index.html` per day in the index. Rebuild after new data is written. The skill does this as its last step.                                                                                                                                                      |
| `npm run preview` | Serves the built `web/out/` locally, to check the production build before deploying.                                                                                                                                                                                                                                                                |
| `npm run lint`    | Runs ESLint over the website code.                                                                                                                                                                                                                                                                                                                  |
