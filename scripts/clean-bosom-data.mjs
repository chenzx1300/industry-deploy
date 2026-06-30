#!/usr/bin/env node
// Clean Bosom data: remove wrong-company cninfo announcements (688603 is Skychem/天承科技, NOT Bosom).
// Keep only the 3 official bosomchina.com links from industries.json fallback_news.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M3';
function getApiKey() {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  const p = `${homedir()}/.claude/settings.json`;
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8'))?.env?.ANTHROPIC_AUTH_TOKEN || null; }
  catch { return null; }
}
const KEY = getApiKey();

async function genSnippet(title) {
  const sys = '你是公司新闻摘要专家。给定标题，生成40-80字中文摘要，说明这条新闻讲什么。直接输出摘要，不要前缀。';
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

const SLUG = 'thermal-materials-industry';
const ID = 'bosom';
const fp = join('data', `${SLUG}.json`);
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === ID);
console.log(`▸ ${c.name}: ${c.news.length} current items`);

// Drop all cninfo items (688603 is Skychem/天承科技, not Bosom)
const before = c.news.length;
c.news = c.news.filter(n => !n.url.includes('cninfo.com.cn'));
console.log(`  Dropped ${before - c.news.length} wrong-company cninfo items`);
console.log(`  Kept ${c.news.length} official bosomchina.com items`);

// Re-rank and ensure dates are present
const now = new Date().toISOString();
for (const n of c.news) {
  if (!n.snippet || n.snippet.length < 10) {
    n.snippet = await genSnippet(n.title);
  }
  n.source = 'bosomchina.com';
}

// Sort desc
c.news.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log(`\n✓ ${c.name}: ${c.news.length} items (final)`);
for (const n of c.news) {
  console.log(`  [${n.published_at.slice(0,10)}] ${n.title.slice(0,60)}`);
  console.log(`    ${n.url}`);
}