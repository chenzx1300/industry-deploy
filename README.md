# Industry News Radar

CLI tool that generates tabbed HTML news reports for any industry. Top 3 Chinese + top 3 international giants, latest news from Google News. Deployed to Netlify under permanent `<slug>-industry` URLs.

## Architecture

7-step pipeline: `slugify → tavily search → claude identify → google news rss fetch → normalize → render → netlify deploy`.

See `docs/superpowers/specs/2026-06-16-industry-news-deploy-design.md` for the full design.

## Setup

```bash
cp .env.example .env
# fill in API keys:
#   ANTHROPIC_API_KEY — from console.anthropic.com
#   TAVILY_API_KEY — from tavily.com (free tier)
#   NETLIFY_TOKEN — from app.netlify.com/user/applications (stored in agent memory `netlify-deploy-token`)
#   NETLIFY_SITE_ID — create a new site in Netlify dashboard, copy the ID from site settings

npm install
```

## Usage

Generate an industry report:

```bash
npm run build -- "new energy vehicles"
```

This creates:
- `data/<slug>.json` — raw company + news data
- `dist/<slug>-industry/index.html` — the report page
- `dist/index.html` — homepage (regenerated)

Deploy to Netlify:

```bash
npm run deploy
```

The homepage lists all generated industries. Each industry gets a permanent URL:

```
https://<NETLIFY_SITE_ID>.netlify.app/
https://<NETLIFY_SITE_ID>.netlify.app/<slug>-industry/
```

## Tests

```bash
npm test                  # unit tests (51 tests)
npm run test:integration  # full pipeline with mocks
```

## Files

- `src/build.mjs` — pipeline orchestrator
- `src/pipeline/` — one file per pipeline step
- `src/lib/` — shared utilities (logger, html helpers, rss parser, netlify)
- `deploy.mjs` — standalone deploy script
- `data/` — generated industry data (gitignored)
- `dist/` — generated HTML (gitignored)

## Manual verification (post-deploy)

- [ ] Homepage loads at `https://<site>.netlify.app/`
- [ ] Industry page loads at `https://<site>.netlify.app/<slug>-industry/`
- [ ] All 6 tabs visible with news counts
- [ ] Tab click switches news list
- [ ] News links open correct source articles
- [ ] Dark mode toggle works and persists across reload
- [ ] Mobile width (375px): tabs scroll horizontally
- [ ] Deep link `#byd` activates BYD tab on load
