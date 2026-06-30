#!/usr/bin/env node
// Generate snippets for Kingfa official-site items via LLM.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M3';

function getApiKey() {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  const p = `${homedir()}/.claude/settings.json`;
  if (!existsSync(p)) return null;
  try {
    const s = JSON.parse(readFileSync(p, 'utf-8'));
    return s?.env?.ANTHROPIC_AUTH_TOKEN || null;
  } catch { return null; }
}

const KEY = getApiKey();
if (!KEY) { console.error('no API key'); process.exit(1); }

const fp = 'data/thermal-materials-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'kingfa');

async function genSnippet(title) {
  const sys = `你是金发科技（Kingfa）公司新闻摘要专家。为给定的新闻标题生成40-80字中文摘要，说明这条新闻讲什么、用词简洁明了。直接输出摘要，不要任何前缀、解释或markdown。`;
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: sys,
      messages: [{ role: 'user', content: title }],
    }),
  });
  if (!res.ok) return '';
  const j = await res.json();
  return (j.content?.[0]?.text || '').trim().slice(0, 250);
}

const pending = c.news.filter(n => !n.snippet && n.source === 'kingfa.com.cn');
console.log('Need snippets for', pending.length, 'items');
for (const n of pending) {
  n.snippet = await genSnippet(n.title);
  console.log('  - ' + n.title.slice(0, 40) + ' → ' + n.snippet.slice(0, 80));
}
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Done');