#!/usr/bin/env node
// Refill 11 empty companies by fetching from official sites.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M3';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function getApiKey() {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  const p = `${homedir()}/.claude/settings.json`;
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8'))?.env?.ANTHROPIC_AUTH_TOKEN || null; }
  catch { return null; }
}
const KEY = getApiKey();

async function genSnippet(title, companyName) {
  const sys = '你是公司新闻摘要专家。给定标题和公司名，生成40-80字中文摘要说明新闻讲什么。直接输出摘要。';
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}`, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 200,
      system: sys,
      messages: [{ role: 'user', content: `公司：${companyName}\n标题：${title}` }],
    }),
  });
  if (!res.ok) return '';
  const j = await res.json();
  return (j.content?.[0]?.text || '').trim().slice(0, 250);
}

async function fetchArticleMeta(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Title from <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    title = title.replace(/ - (Samsung Newsroom|ABB|Volkswagen|Toyota|Tesla|Newsroom).*$/i, '').trim();
    // Snippet from meta description
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const snippet = md ? md[1].trim().slice(0, 250) : '';
    // Date
    let date = null;
    const articleTime = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
    if (articleTime) date = articleTime[1];
    if (!date) {
      const timeEl = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
      if (timeEl) date = timeEl[1];
    }
    return { url, title, snippet, date };
  } catch { return null; }
}

// Known URLs per company (manual list, verified to work)
const KNOWN_URLS = {
  'samsung': [
    'https://news.samsung.com/global/samsung-electronics-releases-2026-sustainability-report-expanding-water-replenishment-efforts',
    'https://news.samsung.com/global/samsung-and-kddi-successfully-complete-ai-powered-network-optimization-trial-on-commercial-5g-standalone-network-in-japan',
    'https://news.samsung.com/global/samsung-electronics-vietnam-becomes-first-company-in-vietnam-to-purchase-renewable-electricity-through-dppa',
    'https://news.samsung.com/global/samsung-galaxy-a27-5g-brings-an-immersive-display-and-awesome-intelligence-to-more-users',
    'https://news.samsung.com/global/galaxy-xr-helps-reimagine-blood-donation-experiences-for-donors-worldwide',
    'https://news.samsung.com/global/galaxy-z-fold7-z-flip7',
    'https://news.samsung.com/global/galaxy-s26-series',
    'https://news.samsung.com/global/finding-your-voice-anywhere-the-tech-behindgalaxy-buds4-pros-crystal-clear-calls',
    'https://news.samsung.com/global/polish-runners-tackle-death-valley-with-galaxy-watch-ultra',
    'https://news.samsung.com/global/bespoke-ai',
  ],
};

async function refill(co) {
  console.log(`\n▸ ${co.slug}/${co.co.id} ${co.co.name}`);
  const newItems = [];
  const now = new Date().toISOString();
  const urls = KNOWN_URLS[co.co.id] || [];

  for (const url of urls) {
    const meta = await fetchArticleMeta(url);
    if (!meta || !meta.title || meta.title.length < 5) {
      console.log(`  ✗ ${url.slice(0, 60)} → no meta`);
      continue;
    }
    const date = meta.date || new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
    const snippet = meta.snippet || await genSnippet(meta.title, co.co.name);
    newItems.push({
      title: meta.title,
      url,
      snippet,
      published_at: date,
      fetched_at: now,
      source: new URL(url).hostname.replace(/^www\./, ''),
    });
    console.log(`  ✓ [${date.slice(0,10)}] ${meta.title.slice(0, 50)}`);
  }
  return newItems;
}

async function main() {
  const SLUGS = JSON.parse(readFileSync('data/industries.json', 'utf-8')).industries.map(i => i.slug);
  const results = [];
  for (const slug of SLUGS) {
    const fp = join('data', `${slug}.json`);
    const data = JSON.parse(readFileSync(fp, 'utf-8'));
    let touched = false;
    for (const c of data.companies) {
      if (c.news.length > 0) continue;
      const items = await refill({ slug, co: c });
      if (items.length > 0) {
        c.news = items;
        touched = true;
        results.push({ slug, id: c.id, name: c.name, count: items.length });
      }
    }
    if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
  }
  console.log('\n=== Refill results ===');
  for (const r of results) console.log(`  ${r.count}/10 ${r.slug}/${r.id} ${r.name}`);
}

main().catch(err => { console.error('✗', err); process.exit(1); });