---
name: industry-news-radar
description: Generate a tabbed HTML news report for any industry prompt. Top 3 Chinese + top 3 international giants, latest news from Google News. Deployed to GitHub Pages under permanent `<slug>-industry` URLs.
metadata:
  type: project
---

# Industry News Radar

CLI tool that turns an industry prompt (e.g. `new energy vehicles`, `carbon fiber`) into a permanent, deployed HTML report covering the top 6 global leaders and their latest news.

## When to use this skill

- User wants a per-industry news dashboard (vs. a one-off paper list)
- They want a shareable permalink (`<slug>-industry`) on GitHub Pages
- They want a bilingual or Chinese-localized UI with Apple-style design
- They want dark mode + responsive layout

## Architecture (7-step pipeline)

```
slugify → Tavily search → Claude identify (tool_use, 6 cos)
       → Google News RSS fetch (concurrent for 6 cos)
       → normalize → render HTML → git commit docs/
```

## Project location

`F:/claude/industry-deploy/`

## Prerequisites

| Item | Where to get it |
|------|-----------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com (only for `npm run build`) |
| `TAVILY_API_KEY` | https://tavily.com (free tier OK; only for `npm run build`) |
| GitHub account | https://github.com (for `git push` + Pages) |

No Netlify account needed. No deploy tokens.

## Quick start

```bash
cd F:/claude/industry-deploy

# 1. Setup (one-time)
cp .env.example .env
# Fill in API keys (only needed for the full `npm run build` path)
npm install

# 2. Generate an industry report (real API, optional — see demos below)
npm run build -- "carbon fiber"

# 3. Commit and push to GitHub
git add docs/
git commit -m "deploy: carbon fiber"
git push origin master

# 4. Enable GitHub Pages (one-time, in repo Settings → Pages):
#    Source: "Deploy from a branch" → master → /docs
```

URL: `https://<user>.github.io/industry-deploy/<slug>-industry/`
Example: `https://zhangxing-chen.github.io/industry-deploy/carbon-fiber-industry/`

## Demos (no API keys required)

```bash
npm run demo               # 新能源汽车 — mock Chinese data, no API calls
npm run demo:carbon-fiber  # 碳纤维 — mock Chinese data, no API calls
npm run real               # 碳纤维 — REAL Google News data (uses cached RSS from tmp-rss-cache/)
```

The `npm run real` runner is the recommended path for one-off, no-API demos:
- Identifies the 6 companies via Claude (the agent in this session, not API)
- Fetches Google News RSS via curl
- Filters out nav pages, off-topic items, and policy/legal pages
- Renders the same Apple-style HTML

```bash
# After running real/demo, view locally:
file:///F:/claude/industry-deploy/docs/index.html
file:///F:/claude/industry-deploy/docs/<slug>-industry/index.html
```

## Local preview

```bash
npx http-server docs -p 8080
# Open http://localhost:8080/
```

## Key files

| File | Purpose |
|------|---------|
| `src/build.mjs` | 7-step pipeline orchestrator (CLI entry, real API path) |
| `real-build.mjs` | Zero-API demo runner using cached RSS |
| `demo-build.mjs` | Mock-data demo for new energy vehicles |
| `carbon-fiber-demo.mjs` | Mock-data demo for carbon fiber |
| `src/pipeline/slugify.mjs` | prompt → URL slug (`-industry` suffix) |
| `src/pipeline/search.mjs` | Tavily wrapper with retry |
| `src/pipeline/identify.mjs` | Claude tool_use → 6 ranked companies |
| `src/pipeline/fetch-news.mjs` | Concurrent Google News RSS for 6 domains + filter |
| `src/pipeline/validate.mjs` | Schema check (6 cos, 3 CN + 3 intl) |
| `src/pipeline/render.mjs` | Apple-style HTML renderer (industry + home) |
| `src/pipeline/manifest.mjs` | Homepage industry index |
| `src/lib/news-filter.mjs` | Filters nav pages, off-topic items |
| `docs/` | Generated HTML (committed to repo, served by GitHub Pages) |
| `data/` | Generated industry data (gitignored) |

## Design language

- Apple-inspired: pure white/black backgrounds, SF Pro font stack, `0071e3` accent
- Chinese-first UI: 行业雷达 / 本周要点 / 数据来源
- Each company tab shows: summary card (top 3 headlines + stats) → full news list
- Dark mode toggle in top-right (frosted glass button); follows OS preference on first load

## Testing

```bash
npm test                  # 70 unit tests
npm run test:integration  # full pipeline with mocked APIs
```

## Output structure

```
docs/
├─ index.html                              ← homepage (all industries)
└─ <slug>-industry/
   └─ index.html                           ← industry page (6 tabs)

data/
├─ <slug>.json                             ← raw company + news data (gitignored)
└─ manifest.json                           ← homepage index source (gitignored)
```

## Adding a new industry

1. Run `npm run build -- "<new industry>"` (real API) or `npm run real` (zero-API demo)
2. Verify companies/news look right in `docs/<slug>-industry/index.html`
3. `git add docs/ && git commit && git push`
4. GitHub Pages redeploys automatically (~30 seconds)

To re-run with fresh data, just rebuild — dedupe is by slug.

## Common issues

- **Build says "expected 6 companies"** — Claude returned fewer. Retry, or manually edit `data/<slug>.json`.
- **News is empty** — Google News may not return results for niche domains. Manually edit `data/<slug>.json`.
- **GitHub Pages 404** — Pages not enabled in repo settings, or wrong source branch/folder.
- **Build outputs to dist/ instead of docs/** — outdated build.mjs; update to use OUT_DIR.

## Related

- Memory: `~/.claude/projects/F--claude/memory/codegraph-usage.md`
- Spec: `design/superpowers/specs/2026-06-16-industry-news-deploy-design.md`
- Plan: `design/superpowers/plans/2026-06-16-industry-news-deploy.md`