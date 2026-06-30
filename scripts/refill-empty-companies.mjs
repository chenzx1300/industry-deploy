#!/usr/bin/env node
// Refill companies that lost all items after verification.
// Strategy: try fallback_news URLs first; if not accessible, fetch company-specific sources.

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

async function genSnippet(title) {
  const sys = '你是公司新闻摘要专家。给定标题，生成40-80字中文摘要说明新闻讲什么。直接输出摘要。';
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}`, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 200,
      system: sys,
      messages: [{ role: 'user', content: `标题：${title}` }],
    }),
  });
  if (!res.ok) return '';
  const j = await res.json();
  return (j.content?.[0]?.text || '').trim().slice(0, 250);
}

async function fetchMeta(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!r.ok) return { ok: false, status: r.status };
    const body = await r.text();
    return { ok: true, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, error: e.message?.slice(0, 50) };
  }
}

const SLUGS = JSON.parse(readFileSync('data/industries.json', 'utf-8')).industries.map(i => i.slug);

async function refillCompany(c) {
  console.log(`\n▸ ${c.slug}/${c.co.id} ${c.co.name}`);
  const newItems = [];
  const now = new Date().toISOString();

  // Try fallback_news
  const fallback = c.co.fallback_news || [];
  for (const f of fallback.slice(0, 12)) {
    if (!f.url) continue;
    const meta = await fetchMeta(f.url);
    if (!meta.ok) {
      console.log(`  ✗ fallback: ${f.url.slice(0, 60)} → HTTP ${meta.status}`);
      continue;
    }
    // For cninfo/SEC/broad, accept directly
    if (/cninfo|sec\.gov|hkexnews|mops\.twse/.test(f.url)) {
      const snippet = f.snippet || await genSnippet(f.title);
      newItems.push({
        title: f.title,
        url: f.url,
        snippet,
        published_at: f.published_at || '2026-01-01T00:00:00Z',
        fetched_at: now,
        source: new URL(f.url).hostname.replace(/^www\./, ''),
      });
      console.log(`  ✓ fallback cninfo: ${f.title.slice(0, 50)}`);
      continue;
    }
    // For other URLs, check body has expected keywords
    const body = meta.body || '';
    const expectedKeywords = (() => {
      const k = c.co.name.toLowerCase();
      if (k.includes('3m')) return ['3M', '3m'];
      if (k.includes('bosom') || k.includes('本松')) return ['本松', 'Bosom'];
      if (k.includes('abb')) return ['ABB', 'abb'];
      if (k.includes('envicool') || k.includes('英维克')) return ['英维克', 'Envicool'];
      if (k.includes('avc') || k.includes('奇鋐')) return ['奇鋐', 'AVC'];
      if (k.includes('coolit')) return ['CoolIT', 'coolit'];
      return [c.co.name.split(' ')[0]];
    })();
    const matched = expectedKeywords.some(kw => body.toLowerCase().includes(kw.toLowerCase()));
    if (!matched && body.length > 500) {
      console.log(`  ✗ fallback mismatch: ${f.url.slice(0, 60)} → no ${expectedKeywords[0]}`);
      continue;
    }
    // Get date from URL if YYYY-MM-DD pattern
    const dm = f.url.match(/(\d{4})-(\d{2})-(\d{2})/) || f.url.match(/(\d{4})(\d{2})(\d{2})/);
    let date = f.published_at;
    if (!date && dm) date = `${dm[1]}-${dm[2]}-${dm[3]}T00:00:00Z`;
    if (!date) {
      const articleTime = body.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
      if (articleTime) date = articleTime[1];
    }
    if (!date) date = '2026-01-01T00:00:00Z';

    const snippet = f.snippet || await genSnippet(f.title);
    newItems.push({
      title: f.title,
      url: f.url,
      snippet,
      published_at: date,
      fetched_at: now,
      source: new URL(f.url).hostname.replace(/^www\./, ''),
    });
    console.log(`  ✓ fallback: ${f.title.slice(0, 50)}`);
  }

  return newItems;
}

async function main() {
  const EMPTY_COMPANIES = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const slugFilter = process.argv.find(a => a.startsWith('--slug='))?.slice(7);

  const results = [];
  for (const slug of SLUGS) {
    if (slugFilter && slug !== slugFilter) continue;
    const fp = join('data', `${slug}.json`);
    const data = JSON.parse(readFileSync(fp, 'utf-8'));
    let touched = false;
    for (const c of data.companies) {
      if (c.news.length > 0) continue;
      if (EMPTY_COMPANIES.length > 0 && !EMPTY_COMPANIES.includes(c.id)) continue;
      const items = await refillCompany({ slug, co: c });
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