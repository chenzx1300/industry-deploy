// Semiconductor industry build (one-shot, real RSS data).
// Invoke via industry-news-radar skill or directly: node scripts/build-semiconductor.mjs

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseGoogleNewsRss } from '../src/lib/rss-parser.mjs';
import { filterNewsItems } from '../src/lib/news-filter.mjs';
import { scrapeNewsCenter, scrapeNewsCenterWithPlaywright, matchItemsToArticles } from '../src/lib/news-scraper.mjs';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const SLUG = 'semiconductor-industry';
const PROMPT = '半导体';
const RSS_DIR = './tmp-rss-cache';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';

const COMPANIES = [
  { id: 'huahong',   name: '华虹半导体 Hua Hong', region: 'cn',   domain: 'huahonggrace.com', file: 'huahong.xml',   monogram: '华', monogram_color: '#dc2626', news_url: 'https://huahonggrace.com/s/news.php?year=2026' },
  { id: 'ymtc',      name: '长江存储 YMTC',       region: 'cn',   domain: 'ymtc.com',        file: 'ymtc.xml',      monogram: '江', monogram_color: '#7c3aed', news_url: 'https://www.ymtc.com/news/' },
  { id: 'jcet',      name: '长电科技 JCET',       region: 'cn',   domain: 'jcetglobal.com',   file: null,            monogram: '电', monogram_color: '#7c3aed', news_url: 'https://www.jcetglobal.com' },
  { id: 'tsmc',      name: '台积电 TSMC',         region: 'intl', domain: 'tsmc.com',        file: 'tsmc.xml',      monogram: '台', monogram_color: '#cc0000', news_url: 'https://www.broadcom.com/company/news' },
  { id: 'samsung',   name: '三星电子 Samsung',    region: 'intl', domain: 'samsung.com',     file: 'samsung.xml',   monogram: 'S', monogram_color: '#1428a0', news_url: 'https://news.samsung.com/global/' },
  { id: 'intel',     name: 'Intel',               region: 'intl', domain: 'intel.com',       file: 'intel.xml',     monogram: 'I', monogram_color: '#0071c5', news_url: 'https://www.intel.com/content/www/us/en/newsroom/news-release.html' },
  { id: 'nvidia',    name: 'NVIDIA 英伟达',       region: 'intl', domain: 'nvidia.com',      file: 'nvidia.xml',    monogram: 'N', monogram_color: '#76b900', news_url: 'https://nvidianews.nvidia.com/' },
  { id: 'amd',       name: 'AMD',                 region: 'intl', domain: 'amd.com',         file: 'amd.xml',       monogram: 'A', monogram_color: '#ed1c24', news_url: 'https://www.amd.com/en/newsroom.html' },
  { id: 'asml',      name: 'ASML 阿斯麦',         region: 'intl', domain: 'asml.com',        file: null,            monogram: 'A', monogram_color: '#0067b1', news_url: 'https://www.asml.com/en/news/press-releases' },
];

const PER_COMPANY = 10;

function fetchAndParse(file, companyName, maxItems, newsUrl) {
  const path = `${RSS_DIR}/${file}`;
  if (!existsSync(path)) return { items: [] };
  const xml = readFileSync(path, 'utf-8');
  const overFetch = maxItems * 4;
  const raw = parseGoogleNewsRss(xml).slice(0, overFetch);
  const filtered = filterNewsItems(raw, companyName).slice(0, maxItems);
  return { items: filtered };
}

async function resolveUrls(items, companyName, newsUrl) {
  if (!newsUrl) return items;
  // 1. Try simple fetch first (fast, works for most sites)
  let scraped = [];
  try {
    scraped = await scrapeNewsCenter(newsUrl, { maxArticles: 30 });
  } catch {}
  // 2. If simple fetch got 0 results, try Playwright (slower but handles JS / anti-bot)
  if (scraped.length === 0) {
    try {
      scraped = await scrapeNewsCenterWithPlaywright(newsUrl, { maxArticles: 30 });
    } catch {}
  }

  // If we have scraped articles, use them as the news source.
  // If items is empty (no RSS), generate items from scraped.
  if (scraped.length > 0) {
    const baseItems = items.length > 0 ? items : scraped.slice(0, PER_COMPANY).map(s => ({
      title: s.title, snippet: '', url: s.url, source: '',
    }));
    return matchItemsToArticles(baseItems, scraped).map((i, idx) => {
      if (i._matchScore && i._matchScore >= 0.3) {
        return { ...i, url: i.url };
      }
      // Unmatched: use next scraped article
      const fallback = scraped[idx] || scraped[0];
      if (fallback) {
        return { ...i, title: fallback.title, url: fallback.url };
      }
      return { ...i, url: newsUrl };
    });
  }
  // No scraped data: keep RSS title, point at news center
  return items.map(i => ({ ...i, url: newsUrl }));
}

const generated_at = new Date().toISOString();
const companies = await Promise.all(COMPANIES.map(async c => {
  const r = fetchAndParse(c.file, c.name, PER_COMPANY, c.news_url);
  const items = await resolveUrls(r.items, c.name, c.news_url);
  const { file, ...rest } = c;
  return { ...rest, news: items };
}));

const totalNews = companies.reduce((s, c) => s + c.news.length, 0);
console.log(`✓ ${totalNews} 条新闻分布在 ${companies.length} 家公司`);
for (const c of companies) console.log(`  · ${c.name}: ${c.news.length} 条`);

const data = { slug: SLUG, prompt: PROMPT, generated_at, companies, default_id: 'tsmc' };
mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(`${DATA_DIR}/${SLUG}.json`, JSON.stringify(data, null, 2));

await addToManifest(DATA_DIR, {
  slug: SLUG, prompt: PROMPT,
  company_count: companies.length, news_count: totalNews,
  generated_at,
});
const manifest = await loadManifest(DATA_DIR);

mkdirSync(`${OUT_DIR}/${SLUG}`, { recursive: true });
writeFileSync(`${OUT_DIR}/${SLUG}/index.html`, renderIndustryPage(data));
writeFileSync(`${OUT_DIR}/index.html`, renderHomepage(manifest));

console.log(`\n✓ docs/${SLUG}/index.html`);
console.log(`✓ docs/index.html (homepage, 3 industries)`);