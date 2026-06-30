// Targeted press release scraping for remaining companies
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const TARGET = parseInt(process.env.TARGET || '10', 10);
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const NOW = new Date().toISOString();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'cninfo.com.cn', 'tradingview.com', 'seekingalpha.com', 'morningstar.com', 'markets.businessinsider.com', 'stockanalysis.com'];

const KNOWN = {
  macleanfogg: [
    { title: 'MacLean-Fogg Celebrates 100 Years of Family Ownership, Manufacturing Excellence, and Community Commitment', url: 'https://www.wkow.com/online_features/press_releases/maclean-fogg-celebrates-100-years-of-family-ownership-manufacturing-excellence-and-community-commitment', published_at: '2025-10-15T00:00:00Z' },
    { title: 'OMCO Solar Acquired by MacLean-Fogg, positioned for continued growth', url: 'https://www.marketwatch.com/press-release/omco-solar-acquired-by-maclean-fogg-positioned-for-continued-growth', published_at: '2025-09-10T00:00:00Z' },
    { title: 'MacLean-Fogg Announces Acquisition of Metal 3D Printing Pioneer Formetrix', url: 'https://www.businesswire.com/news/home/20250605005374/en/', published_at: '2025-06-05T00:00:00Z' },
    { title: 'MacLean Power Systems and Power Grid Components Complete Merger, Move Forward as Combined Company', url: 'https://www.macleanpower.com/maclean-power-systems-and-power-grid-components-complete', published_at: '2026-03-04T00:00:00Z' },
  ],
};

function dedupAdd(c, items) {
  const seen = new Set(c.news.map(n => n.url));
  let added = 0;
  for (const it of items) {
    if (c.news.length >= TARGET) break;
    if (!it.url || seen.has(it.url)) continue;
    if (HARD_BLOCK.some(b => it.url.includes(b))) continue;
    const d = new Date(it.published_at);
    if (isNaN(d.getTime()) || d < CUTOFF) continue;
    seen.add(it.url);
    c.news.push({
      title: it.title,
      url: it.url,
      snippet: '',
      published_at: it.published_at,
      fetched_at: NOW,
      source: (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    });
    added++;
  }
  return added;
}

const inds = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));

for (const ind of inds.industries) {
  const fp = join(DATA_DIR, `${ind.slug}.json`);
  if (!existsSync(fp)) continue;
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    const items = KNOWN[c.id];
    if (!items) continue;
    if (c.news.length >= TARGET) continue;
    const need = TARGET - c.news.length;
    console.log(`\n▸ ${ind.slug}/${c.id}: have ${c.news.length}, need ${need}`);
    const a = dedupAdd(c, items);
    console.log(`  ✓ added ${a} (now ${c.news.length})`);
    if (a > 0) touched = true;
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}
console.log('\n=== Done ===');
