# Industry News Radar — Design Spec

**Date:** 2026-06-16
**Status:** Draft (awaiting user review)
**Project:** `F:/claude/industry-deploy/`

## Purpose

CLI-driven static site generator that, given an industry prompt, identifies the top 3 Chinese + top 3 international giants in that industry, fetches their latest news from Google News, and publishes a tabbed HTML report under a permanent `<slug>-industry` URL.

Reference project: `F:/claude/compscitech-deploy/` (academic papers via CrossRef → static HTML → Netlify).

## Goals

- One CLI invocation (`node build.mjs "new energy vehicles"`) produces and deploys a complete industry news page.
- Each industry gets its own permanent URL (`<slug>-industry`).
- All output is static HTML/CSS/JS — no runtime server, no SPA framework.
- Visually polished (academic-modern style, light + dark mode toggle).

## Non-Goals

- Real-time updates (data is snapshot at build time; user reruns the script to refresh).
- Search/filter within a page (out of scope for v1).
- User accounts, persistence across runs beyond `data/` + `manifest.json`.
- Multi-language UI (English only — news content is in source language naturally).

## Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger | CLI script | Matches compscitech-deploy workflow; no server cost |
| Company identification | Tavily search + Claude API | Tavily for fresh ranking, Claude to extract structured 6-company list |
| News source | Google News RSS with `site:` filter | Free, no API key, covers any company domain |
| Data freshness | On-demand rebuild | Simplest; user runs script when they want fresh data |
| Project location | `F:/claude/industry-deploy/` (new) | Clean separation from compscitech-deploy |
| LLM provider | Anthropic Claude (Sonnet) | Highest quality for structured extraction, good Chinese support |
| Output format | Static HTML (multi-page) | Matches compscitech-deploy; permanent URLs map to directories |
| Deploy target | Netlify | Same platform as compscitech-deploy |
| Netlify site | New site (separate from compscitech) | Clean URL space; no sub-path conflict |
| UI language | English | User explicit preference ("都采用英文") |
| URL slugs | English, lowercase, hyphenated | Conventional; safe for routing |
| News card style | List (title / snippet / meta) | Compact, scannable |
| Tab order | LLM-ranked by influence | Information density; LLMs reason about market cap/size |
| CN/Intl visual separator | Vertical divider + small "🇨🇳 CHINA / 🌍 INTERNATIONAL" label | Clear regional grouping |
| Dark mode | Light + dark, header toggle | Modern UX, ~80 extra lines of CSS variables |
| Brand color | `#2563eb` (academic blue) | Consistent with compscitech-deploy |
| Homepage style | Portal (large title + industry card grid) | Distinct from industry pages, browseable |

## End-to-End Pipeline

User invocation:
```bash
cd F:/claude/industry-deploy
node build.mjs "new energy vehicles"
```

Seven-step pipeline:

1. **slugify** — `prompt → kebab-case slug`. Append `-industry` suffix. Example: `"new energy vehicles" → new-energy-vehicles-industry`.
2. **tavily search** — Query `top <industry> companies 2026`. Take top 20 results.
3. **claude identify** — Send Tavily results + prompt to Claude with strict JSON schema. Request 6 companies ranked by influence, with `{name, region: "cn"|"intl", domain}`. (Chinese input prompts also work; LLM returns `slug_en` field for URL.)
4. **rss fetch (concurrent)** — For each of 6 companies, fetch `https://news.google.com/rss/search?q=site:<domain>&hl=en-US&gl=US&ceid=US:en`. Use `Promise.all` for parallelism. Parse with `fast-xml-parser`.
5. **normalize + dedupe** — Sort by `pubDate` desc. Dedupe by URL. Cap at top N per company (default N=8, configurable).
6. **persist + render** — Write `data/<slug>.json`. Update `manifest.json`. Render `dist/<slug>-industry/index.html`. Re-render `dist/index.html` (homepage).
7. **deploy** — Zip `dist/`, POST to Netlify deploys API, PUT zip.

## Data Model

`data/<slug>.json`:
```json
{
  "slug": "new-energy-vehicles-industry",
  "prompt": "new energy vehicles",
  "generated_at": "2026-06-16T10:23:00Z",
  "companies": [
    {
      "id": "byd",
      "name": "BYD",
      "region": "cn",
      "domain": "byd.com",
      "logo_url": null,
      "news": [
        {
          "title": "BYD launches new blade battery platform",
          "snippet": "BYD unveiled its next-gen...",
          "url": "https://byd.com/news/...",
          "source": "byd.com",
          "published_at": "2026-06-15T08:00:00Z"
        }
      ]
    }
  ]
}
```

`manifest.json`:
```json
{
  "industries": [
    {
      "slug": "new-energy-vehicles-industry",
      "prompt": "new energy vehicles",
      "company_count": 6,
      "news_count": 48,
      "generated_at": "2026-06-16T10:23:00Z"
    }
  ]
}
```

## File Structure

```
F:/claude/industry-deploy/
├─ src/
│  ├─ build.mjs                ← CLI entrypoint; orchestrates pipeline
│  └─ pipeline/
│     ├─ slugify.mjs
│     ├─ search.mjs            ← Tavily
│     ├─ identify.mjs          ← Claude (structured JSON output)
│     ├─ fetch-news.mjs        ← 6 concurrent Google News RSS fetches
│     ├─ render.mjs            ← JSON → HTML (industry page + homepage)
│     └─ manifest.mjs          ← manifest.json read/write
├─ src/lib/
│  ├─ rss-parser.mjs
│  ├─ netlify.mjs              ← shared deploy helpers
│  ├─ html-helpers.mjs         ← escape, formatDate, relativeTime
│  └─ logger.mjs               ← progress logging with ✓/✗ symbols
├─ data/
│  └─ <slug>.json              ← one per industry
├─ dist/                       ← generated; deploy source
│  ├─ index.html               ← homepage
│  └─ <slug>-industry/
│     └─ index.html
├─ test/
│  ├─ unit/                    ← node:test specs for slugify, rss-parser, html-helpers
│  ├─ fixtures/                ← mock Tavily/Claude/RSS responses
│  └─ integration.mjs          ← full pipeline run with mocks
├─ deploy.mjs                  ← zips dist/, uploads to Netlify
├─ validate.mjs                ← schema check before deploy
├─ package.json
├─ .env.example
├─ .gitignore
└─ README.md
```

## HTML Structure

### Industry page (`dist/<slug>-industry/index.html`)

```
<header>
  ├─ chip: industry tag
  ├─ h1: prompt (serif)
  ├─ meta: "6 companies · 48 news items · generated 2026-06-16"
  └─ dark mode toggle (right)
</header>

<nav class="tabs">
  <span class="region-label">🇨🇳 CHINA</span>
  <button class="tab" data-co="byd">BYD · 8</button>
  <button class="tab" data-co="catl">CATL · 6</button>
  <button class="tab" data-co="nio">NIO · 5</button>
  <span class="region-divider"></span>
  <span class="region-label">🌍 INTERNATIONAL</span>
  <button class="tab" data-co="tesla">Tesla · 9</button>
  <button class="tab" data-co="vw">Volkswagen · 7</button>
  <button class="tab" data-co="toyota">Toyota · 5</button>
</nav>

<main>
  <section data-co="byd">
    <h2>BYD</h2>
    <ul class="news-list">
      <li class="news-item">
        <a class="news-title" href="https://byd.com/..." target="_blank">
          BYD launches new blade battery platform ↗
        </a>
        <p class="news-snippet">BYD unveiled its next-gen...</p>
        <span class="news-meta">byd.com · 2026-06-15 · 2h ago</span>
      </li>
    </ul>
  </section>
  <!-- ... 5 more sections, hidden by default -->
</main>

<footer>
  Sources: Google News · Generated 2026-06-16 · For reference only
</footer>
```

Tab interaction (~20 lines vanilla JS):
```js
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.co;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('section[data-co]').forEach(s => s.hidden = s.dataset.co !== target);
    tab.classList.add('active');
    history.replaceState(null, '', '#' + target);
  });
});
// On load: activate tab matching location.hash
```

### Homepage (`dist/index.html`)

```
<header>
  <h1>Industry News Radar</h1>
  <p>Latest news from industry leaders. Generated locally.</p>
  <dark mode toggle>
</header>

<main>
  <ul class="industry-grid">
    <li class="industry-card">
      <a href="new-energy-vehicles-industry/">
        <h3>new energy vehicles</h3>
        <span>6 companies · 48 items</span>
        <time>2026-06-16</time>
      </a>
    </li>
    <!-- ... -->
  </ul>
</main>
```

## Visual Design

**Color palette:**
```
--bg:        #fafaf8   (warm white)
--surface:   #ffffff
--border:    #e8e6e1
--text:      #1a1a1a
--text-soft: #5a5a5a
--accent:    #2563eb   (academic blue — consistent with compscitech-deploy)
--cn-tint:   #dc2626   (red accent for CN tabs)
--intl-tint: #1e40af   (blue accent for intl tabs)

[dark mode]
--bg:        #0f0f0f
--surface:   #1a1a1a
--border:    #2a2a2a
--text:      #e8e8e8
--text-soft: #a0a0a0
--accent:    #60a5fa
```

**Typography:**
- `--font-sans`: `-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif`
- `--font-serif`: `'Source Serif Pro', 'Georgia', serif` (headings, company names, tab labels)

**Layout:**
- Max width 960px, centered
- Industry page: header → tabs (with CN/Intl separator) → news list
- Homepage: header → industry card grid (2-3 columns responsive)

**News item layout (list style):**
- Title (sans, 16px, bold)
- Snippet (sans, 14px, soft color, max 2 lines with line-clamp)
- Meta line (sans, 12px, soft color): `source.com · date · relative-time`
- 1px border between items (no card borders — editorial feel)
- Hover: title turns blue + 2px left accent bar appears

**Empty state:** "No recent news found." for companies with 0 news.

**Responsive:**
- Desktop: tabs horizontal
- Tablet: tabs horizontal, smaller fonts
- Mobile (<640px): tabs horizontal-scroll, news list single column

## Deployment

**Platform:** Netlify (new site, separate from compscitech-deploy)

**API flow:**
```js
POST https://api.netlify.com/api/v1/sites/<SITE_ID>/deploys
  → { id: "deploy_id" }

PUT https://api.netlify.com/api/v1/deploys/<deploy_id>/files
  Content-Type: application/zip
  Body: <dist.zip>
```

**Setup steps (manual, one-time):**
1. User creates new site in Netlify dashboard.
2. User provides `NETLIFY_SITE_ID` and `NETLIFY_TOKEN` (personal access token with deploy scope).
3. Stored in `.env`.

**Environment variables (`.env`):**
```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
NETLIFY_TOKEN=nfp_vPqQdzXsCTBiM3PuJmkEjuaSqTyRNusTc6eb   # stored in agent memory `netlify-deploy-token`
NETLIFY_SITE_ID=xxxxxxxx                                  # user creates new site in Netlify dashboard; provided separately
```

`NETLIFY_TOKEN` is the user's personal access token, stored in agent memory under `netlify-deploy-token` for cross-session reuse. Do not re-ask.

`NETLIFY_SITE_ID` is per-project; user must create a new Netlify site for industry-deploy and provide the SITE_ID once (stored in `.env`).

`.env.example` template committed; `.env` gitignored.

## Error Handling

| Phase | Failure | Handling |
|-------|---------|----------|
| slugify | empty / invalid prompt | Throw, exit 1, message "invalid prompt" |
| tavily | timeout / no results | Retry 2x exponential backoff; final fallback: use Claude's own knowledge |
| claude | API error / non-JSON output | Retry 1x; final failure: prompt user to check `ANTHROPIC_API_KEY` |
| claude | invalid domain format in output | Filter out invalid company, continue with remainder |
| rss fetch | single company fails | Skip that company, UI shows "暂无新闻" for that tab |
| rss fetch | all 6 fail | Throw, exit, preserve partial state |
| rss parse | missing title/url field | Skip single item, keep valid ones |
| render | template variable undefined | Use `<%= missing_field %>` placeholder, don't corrupt HTML |
| deploy | Netlify 4xx/5xx | Retry 1x; preserve `dist/` for manual retry |
| any phase | unexpected exception | Log stack trace; preserve `data/<slug>.json` if written; suggest manual recovery command |

**Logger format:**
```
[1/7] slugify → new-energy-vehicles-industry ✓
[2/7] tavily search → 20 results ✓
[3/7] claude identify → 6 companies ✓
[4/7] fetch news (6 concurrent) → ▓▓▓▓▓▓ 6/6 ✓
[5/7] normalize → 48 items ✓
[6/7] render → 2 files written ✓
[7/7] deploy → https://xxx.netlify.app ✓
```

## Testing

| Type | Tool | Coverage |
|------|------|----------|
| Unit | `node:test` (built-in) | `slugify`, `rss-parser`, `html-helpers`, `manifest` |
| Integration | `test/integration.mjs` | Full pipeline with mocked Tavily/Claude/RSS; assert `dist/` structure + manifest |
| Schema | `validate.mjs` | Pre-deploy: validate `data/<slug>.json` + each company has ≥1 news |
| Visual | Manual | After each deploy: tab switching, dark mode toggle, mobile width, deep link |

**Key unit cases:**
```js
slugify('New Energy Vehicles') === 'new-energy-vehicles'
slugify('SaaS') === 'saas'
slugify('AI/ML') === 'ai-ml'
slugify('') throws

parseGoogleNewsRss(fixture).length === 10
parseGoogleNewsRss(invalidXml) === []  // does not throw
parseGoogleNewsRss(itemMissingUrl) skips item
```

**Manual checklist (post-deploy):**
- [ ] Homepage loads; lists all generated industries
- [ ] Industry page loads; 6 tabs visible with counts
- [ ] Tab click switches news list
- [ ] News links open correct source articles (not Google News aggregator)
- [ ] Dark mode toggle works and persists across reload (localStorage)
- [ ] Mobile width (375px): tabs scroll horizontally, news list single column
- [ ] Deep link `#byd` activates BYD tab on load

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "fast-xml-parser": "^4.5.0",
    "archiver": "^7.0.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=20"
  }
}
```

`node:test` is built-in (Node 20+). No test framework needed.

## Future Work (out of scope for v1)

- Scheduled rebuilds via cron or GitHub Actions.
- Logo fetching from each company's official site (currently `null`, UI shows text initial).
- Multi-language UI (currently English only).
- Search/filter on industry page.
- Per-company news language filtering (CN companies → Chinese news; intl → English). Deferred because Google News RSS `hl=`/`gl=` parameters affect feed but not article language coverage reliably.
