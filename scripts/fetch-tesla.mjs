#!/usr/bin/env node
// Fetch ~10 recent Tesla news items. Sources:
//   1. Tesla official blog: https://www.tesla.com/blog
//   2. Tesla IR press: https://ir.tesla.com/press-release
//   3. Bing news for major Tesla topics
// Validates every URL and date.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBingNews } from '../src/lib/bing-news.mjs';

const CUTOFF = new Date('2025-06-29T00:00:00Z');
const SLUG = 'new-energy-vehicles-industry';
const BLOCKED = /cninfo\.com\.cn|seekingalpha|markets\.businessinsider|stockanalysis|simplywall\.st|wallstreetzen|wisesheets|tipranks|investing\.com|yahoo\.com\/news|insidermonkey|newsfilter\.io|aastocks|fool\.com|nasdaq\.com\/article|finance\.yahoo|morningstar\.com/;

async function headOk(url) { try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }); return r.status >= 200 && r.status < 400; } catch { return false; } }
async function getPageDate(url) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!r.ok) return null;
    const html = await r.text();
    const mp = [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,/<meta[^>]+name=["']datePublished["'][^>]+content=["']([^"']+)["']/i,/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']datePublished["']/i,/<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i];
    for (const re of mp) { const m = html.match(re); if (m) { const t = new Date(m[1]); if (!isNaN(t.getTime())) return t; } }
    const tm = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (tm) { const t = new Date(tm[1]); if (!isNaN(t.getTime())) return t; }
    const jl = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (jl) { const t = new Date(jl[1]); if (!isNaN(t.getTime())) return t; }
    return null;
  } catch { return null; }
}

async function fetchTeslaBlog() {
  // https://www.tesla.com/blog — WordPress-based, has <article> blocks
  try {
    const r = await fetch('https://www.tesla.com/blog', { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const html = await r.text();
    const items = [];
    const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/g;
    let m;
    while ((m = articleRe.exec(html)) !== null) {
      const block = m[1];
      // title in h2 or h3 with link
      const linkMatch = block.match(/<h[23][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/);
      if (!linkMatch) continue;
      const url = linkMatch[1].startsWith('http') ? linkMatch[1] : 'https://www.tesla.com' + linkMatch[1];
      const title = linkMatch[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/\s+/g, ' ').trim();
      const timeMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/);
      const date = timeMatch ? new Date(timeMatch[1]) : null;
      items.push({ title, url, date, source: 'tesla.com' });
    }
    return items;
  } catch (e) {
    console.log('  tesla.com/blog error:', e.message);
    return [];
  }
}

async function fetchTeslaIR() {
  // https://ir.tesla.com/press-release
  try {
    const r = await fetch('https://ir.tesla.com/press-release', { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const html = await r.text();
    const items = [];
    // Look for press release rows
    const linkRe = /<a[^>]+href=["']([^"']*press-release[^"']*|[^"']*press_release[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const url = m[1].startsWith('http') ? m[1] : 'https://ir.tesla.com' + m[1];
      const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      if (title.length > 15) items.push({ title, url, date: null, source: 'ir.tesla.com' });
    }
    return items;
  } catch (e) {
    console.log('  ir.tesla.com error:', e.message);
    return [];
  }
}

async function main() {
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === 'tesla');
  if (!c) throw new Error('Tesla not found');
  c.news = c.news || [];
  console.log(`▸ tesla: have ${c.news.length}, need ${10 - c.news.length}`);

  const all = [];
  // 1. Tesla blog
  const blog = await fetchTeslaBlog();
  console.log(`  tesla.com/blog: ${blog.length}`);
  all.push(...blog);

  // 2. Tesla IR
  const ir = await fetchTeslaIR();
  console.log(`  ir.tesla.com: ${ir.length}`);
  all.push(...ir);

  // 3. Bing for recent Tesla news
  const queries = [
    'Tesla news 2026 announcement',
    'Tesla Q1 2026 earnings',
    'Tesla Cybertruck news 2026',
    'Tesla Model Y refresh 2026',
    'Tesla FSD news 2026',
    'Tesla Optimus robot 2026',
    'Tesla energy storage 2026',
    'Tesla gigafactory 2026',
    'Tesla Robotaxi 2026',
  ];
  for (const q of queries) {
    if (all.length >= 30) break;
    try {
      const r = await fetchBingNews(q, { maxResults: 5 });
      for (const x of r) {
        if (!x.url || BLOCKED.test(x.url)) continue;
        const title = x.title || '';
        if (!title.toLowerCase().includes('tesla')) continue;
        all.push({ title, url: x.url, date: x.published_at ? new Date(x.published_at) : null, source: (() => { try { return new URL(x.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() });
      }
    } catch {}
  }
  console.log(`  total candidates: ${all.length}`);

  // Filter to past 1 year
  const seen = new Set(c.news.map(n => n.url));
  const recent = all.filter(i => i.title && i.url && !seen.has(i.url) && (!i.date || (i.date && i.date >= CUTOFF)));
  console.log(`  fresh candidates: ${recent.length}`);

  // Validate
  const validated = [];
  const queue = [...recent];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length && validated.length < 10) {
      const cand = queue.shift();
      const ok = await headOk(cand.url);
      if (!ok) continue;
      let date = cand.date;
      if (!date) date = await getPageDate(cand.url);
      if (date && date < CUTOFF) continue;
      validated.push({ ...cand, _date: date });
    }
  }));
  console.log(`  validated: ${validated.length}`);

  if (validated.length > 0) {
    const now = new Date().toISOString();
    const toAdd = validated.slice(0, 10).map(v => ({
      title: v.title,
      url: v.url,
      snippet: '',
      published_at: v._date ? v._date.toISOString() : (v.published_at || null),
      fetched_at: now,
      source: v.source || (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    }));
    c.news = [...c.news, ...toAdd];
    writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ✓ added ${toAdd.length}, total now ${c.news.length}`);
  } else {
    console.log(`  ✗ no items`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
