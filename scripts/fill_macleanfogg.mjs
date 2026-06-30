import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/composite-insulator-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'macleanfogg');
const UA = 'Mozilla/5.0';
const url = 'https://news.google.com/rss/search?q=MacLean-Fogg+Company+press&hl=en-US&gl=US&ceid=US:en';
const r = await fetch(url, { headers: { 'User-Agent': UA } });
const xml = await r.text();
const items = [];
const re = /<item>([\s\S]*?)<\/item>/g;
let m;
const HARD_BLOCK = ['finance.yahoo.com', 'yahoo.com', 'weixin.sogou.com', 'cninfo.com.cn', 'tradingview.com', 'seekingalpha.com', 'morningstar.com', 'markets.businessinsider.com', 'stockanalysis.com', 'stocktwits.com'];
const CUTOFF = new Date('2025-06-30T00:00:00Z');
const NOW = new Date().toISOString();
const ALIASES = ['MacLean-Fogg', 'MacLean Fogg', 'MacLean Power'];
function isRelevant(t) {
  const lower = (t||'').toLowerCase();
  for (const a of ALIASES) if (lower.includes(a.toLowerCase())) return true;
  return false;
}
function clean(t) { return (t||'').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim(); }
while ((m = re.exec(xml)) !== null) {
  const title = clean((m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
  const sourceUrl = (m[1].match(/<source[^>]+url=["']([^"']+)["']/) || [])[1];
  const pub = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
  if (!title || !sourceUrl || !pub) continue;
  const d = new Date(pub);
  if (isNaN(d.getTime())) continue;
  if (d < CUTOFF) continue;
  if (HARD_BLOCK.some(b => sourceUrl.includes(b))) continue;
  if (!isRelevant(title)) continue;
  items.push({ title, sourceUrl, date: d });
}
const seen = new Set(c.news.map(n => n.url));
let added = 0;
for (const it of items) {
  if (c.news.length >= 10) break;
  if (seen.has(it.sourceUrl)) continue;
  seen.add(it.sourceUrl);
  c.news.push({ title: it.title, url: it.sourceUrl, snippet: '', published_at: it.date.toISOString(), fetched_at: NOW, source: (() => { try { return new URL(it.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })() });
  added++;
}
console.log('MacLean-Fogg: added ' + added + ' (now ' + c.news.length + '/10)');
for (const it of items.slice(0, 3)) console.log('  -', it.title.slice(0,80), '|', it.sourceUrl);
writeFileSync(fp, JSON.stringify(data, null, 2));
