# Industry News Radar

CLI to generate tabbed HTML news reports for any industry. Top 3 Chinese + top 3 international giants, latest news from Google News.

## Quick start

```bash
cp .env.example .env
# fill in API keys
npm install
npm run build -- "new energy vehicles"
npm run deploy
```

## URLs

- Homepage: `https://<NETLIFY_SITE_ID>.netlify.app/`
- Industry page: `https://<NETLIFY_SITE_ID>.netlify.app/<slug>-industry/`

## Data flow

See `docs/superpowers/specs/2026-06-16-industry-news-deploy-design.md`.
