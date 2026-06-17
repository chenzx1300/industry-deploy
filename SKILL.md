---
name: industry-news-radar
description: Generate a tabbed HTML news report for any industry prompt. Top 3 Chinese + top 3 international giants, latest news from Google News. Deployed to Netlify under permanent `<slug>-industry` URLs.
metadata:
  type: project
---

# Industry News Radar

CLI tool that turns an industry prompt (e.g. `new energy vehicles`, `carbon fiber`) into a permanent, deployed HTML report covering the top 6 global leaders and their latest news.

## When to use this skill

- User wants a per-industry news dashboard (vs. a one-off paper list)
- They want a shareable permalink (`<slug>-industry`) on Netlify
- They want a bilingual or Chinese-localized UI with Apple-style design
- They want dark mode + responsive layout

## Architecture (7-step pipeline)

```
slugify → Tavily search → Claude identify (tool_use, 6 cos) 
       → Google News RSS fetch (concurrent for 6 cos)
       → normalize → render HTML → Netlify zip deploy
```

## Project location

`F:/claude/industry-deploy/`

## Prerequisites

| Item | Where to get it |
|------|-----------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `TAVILY_API_KEY` | https://tavily.com (free tier OK) |
| `NETLIFY_TOKEN` | Stored in agent memory `netlify-deploy-token` — DO NOT ask user |
| `NETLIFY_SITE_ID` | Create new site at app.netlify.com, copy ID |

## Quick start

```bash
cd F:/claude/industry-deploy

# 1. Setup (one-time)
cp .env.example .env
# Fill in the 4 keys above
npm install

# 2. Generate an industry report (real API)
npm run build -- "carbon fiber"

# 3. Deploy to Netlify
npm run deploy
```

URL: `https://<NETLIFY_SITE_ID>.netlify.app/<slug>-industry/`
Example: `https://xxx.netlify.app/carbon-fiber-industry/`

## Demo without API keys

A self-contained demo runner is at `demo-build.mjs` (and `carbon-fiber-demo.mjs`) — uses mock Chinese-language data, no API calls.

```bash
node demo-build.mjs              # generates "新能源汽车" demo
node carbon-fiber-demo.mjs       # generates "碳纤维" demo
# Then open dist/<slug>-industry/index.html in a browser
```

## Local preview

```bash
npx http-server dist -p 8080
# Open http://localhost:8080/
```

## Key files

| File | Purpose |
|------|---------|
| `src/build.mjs` | 7-step pipeline orchestrator (CLI entry) |
| `src/pipeline/slugify.mjs` | prompt → URL slug (`-industry` suffix) |
| `src/pipeline/search.mjs` | Tavily wrapper with retry |
| `src/pipeline/identify.mjs` | Claude tool_use → 6 ranked companies |
| `src/pipeline/fetch-news.mjs` | Concurrent Google News RSS for 6 domains |
| `src/pipeline/validate.mjs` | Schema check (6 cos, 3 CN + 3 intl) |
| `src/pipeline/render.mjs` | Apple-style HTML renderer (industry + home) |
| `src/pipeline/manifest.mjs` | Homepage industry index |
| `src/lib/netlify.mjs` | Zip + Netlify deploy API helpers |
| `deploy.mjs` | Standalone Netlify zip deploy |

## Design language

- Apple-inspired: pure white/black backgrounds, SF Pro font stack, `0071e3` accent
- Chinese-first UI: 行业雷达 / 本周要点 / 数据来源
- Each company tab shows: summary card (top 3 headlines + stats) → full news list
- Dark mode toggle in top-right (frosted glass button); follows OS preference on first load

## Testing

```bash
npm test                  # 56 unit tests
npm run test:integration  # full pipeline with mocked APIs
```

## Output structure

```
dist/
├─ index.html                              ← homepage (all industries)
└─ <slug>-industry/
   └─ index.html                           ← industry page (6 tabs)

data/
├─ <slug>.json                             ← raw company + news data
└─ manifest.json                           ← homepage index source
```

## Adding a new industry

1. Run `npm run build -- "<new industry>"`
2. Confirm companies identified make sense (manually edit `data/<slug>.json` if not)
3. Run `npm run deploy`

To re-run with fresh data, just `npm run build -- "<industry>"` again — dedupe is by slug.

## Common issues

- **Build says "expected 6 companies"** — Claude returned fewer. Either retry (network blip) or check the prompt. Edit `data/<slug>.json` to add missing companies manually.
- **News is empty** — Google News may not return results for niche domains. Edit domains in `data/<slug>.json`.
- **Netlify 401** — token expired. Re-check `netlify-deploy-token` memory.

## Related

- Memory: `~/.claude/projects/F--claude/memory/netlify-deploy-token.md`
- Memory: `~/.claude/projects/F--claude/memory/codegraph-usage.md`
- Spec: `docs/superpowers/specs/2026-06-16-industry-news-deploy-design.md`
- Plan: `docs/superpowers/plans/2026-06-16-industry-news-deploy.md`
