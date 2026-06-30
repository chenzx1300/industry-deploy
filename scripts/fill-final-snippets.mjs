#!/usr/bin/env node
// Fill the last 2 missing snippets via LLM.

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

async function genSnippet(title, company) {
  const sys = `你是公司新闻摘要专家。给定标题和公司名，生成40-80字中文摘要，说明这条新闻/公告讲什么。直接输出摘要，不要任何前缀。`;
  const user = `公司：${company}\n标题：${title}`;
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
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return '';
  const j = await res.json();
  return (j.content?.[0]?.text || '').trim().slice(0, 250);
}

const SLUGS = (JSON.parse(readFileSync('data/industries.json','utf-8')).industries).map(i => i.slug);
let filled = 0;
for (const slug of SLUGS) {
  const fp = join('data', `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  let touched = false;
  for (const c of data.companies) {
    for (const n of c.news) {
      if (!n.snippet || n.snippet.length < 10) {
        console.log(`  [${slug}/${c.id}] ${n.title.slice(0, 60)}`);
        n.snippet = await genSnippet(n.title, c.name);
        if (n.snippet) filled++;
        touched = true;
      }
    }
  }
  if (touched) writeFileSync(fp, JSON.stringify(data, null, 2));
}
console.log(`\n✓ Filled ${filled} snippets`);