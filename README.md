# Industry News Radar

CLI tool that generates tabbed HTML news reports for any industry. Top 3 Chinese + top 3 international giants, latest news from Google News. Deployed to GitHub Pages under permanent `<slug>-industry` URLs.

## Architecture

7-step pipeline: `slugify → tavily search → claude identify → google news rss fetch → normalize → render → git commit docs/`.

See `design/superpowers/specs/2026-06-16-industry-news-deploy-design.md` for the full design.

## Setup

```bash
cp .env.example .env
# fill in API keys:
#   ANTHROPIC_API_KEY — from console.anthropic.com
#   TAVILY_API_KEY — from tavily.com (free tier)

npm install
```

## Usage

Generate an industry report:

```bash
npm run build -- "new energy vehicles"
```

This creates:
- `data/<slug>.json` — raw company + news data
- `docs/<slug>-industry/index.html` — the report page
- `docs/index.html` — homepage (regenerated)

## Deploy to GitHub Pages

```bash
git add docs/
git commit -m "deploy: <prompt>"
git push origin master
```

Then enable Pages in repo Settings → Pages → Source: **master** / **/docs**. Site is live at:

```
https://<user>.github.io/industry-deploy/
https://<user>.github.io/industry-deploy/<slug>-industry/
```

## Demos (no API keys)

```bash
npm run demo               # new energy vehicles (mock Chinese data)
npm run demo:carbon-fiber  # carbon fiber (mock Chinese data)
npm run real               # carbon fiber with REAL Google News data (uses cached RSS)
```

## Tests

```bash
npm test                  # 70 unit tests
npm run test:integration  # full pipeline with mocks
```

## Files

- `src/build.mjs` — pipeline orchestrator (CLI entry)
- `src/pipeline/` — one file per pipeline step
- `src/lib/` — shared utilities (logger, html helpers, rss parser, news filter)
- `docs/` — generated HTML (committed to repo, served by GitHub Pages)
- `data/` — generated industry data (gitignored)
- `dist/` — legacy build output dir (gitignored; kept for backwards compat)

## Manual verification (post-deploy)

- [ ] Homepage loads at `https://<user>.github.io/industry-deploy/`
- [ ] Industry page loads at `https://<user>.github.io/industry-deploy/<slug>-industry/`
- [ ] All 6 tabs visible with news counts
- [ ] Tab click switches news list
- [ ] News links open correct source articles
- [ ] Dark mode toggle works and persists across reload
- [ ] Mobile width (375px): tabs scroll horizontally
- [ ] Deep link `#byd` activates BYD tab on load