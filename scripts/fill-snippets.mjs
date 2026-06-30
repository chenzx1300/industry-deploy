#!/usr/bin/env node
// Generate brief Chinese snippets (20-50 chars) for items with empty snippets.
// For cninfo/SEC items the actual content is a PDF, so we derive a summary
// from the title. For RSS items we could fetch the page meta description
// but it's simpler to use the same model-based approach uniformly.
//
// Strategy:
//   1. Collect all items with empty/short snippet
//   2. Batch 10 per API call, ask model to write a 20-50 char Chinese summary
//      based on the title (and any existing snippet)
//   3. Apply results
//
// Usage: node scripts/fill-snippets.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'MiniMax-M3';
const BATCH_SIZE = 10;
const MAX_PARALLEL = 3;
const DRY_RUN = process.argv.includes('--dry-run');

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
if (!KEY) {
  console.error('✗ No ANTHROPIC_AUTH_TOKEN');
  process.exit(1);
}

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const SLUGS = (JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')).industries || []).map(i => i.slug);

async function callModel(items) {
  const numbered = items.map((it, i) => `${i + 1}. [TITLE] ${it.title}`).join('\n');
  const sys = `You write ultra-brief Chinese news summaries (20-40 Chinese characters, ≤80 chars total) for industry news cards. Output ONLY a JSON array of strings, one summary per input item, no prose, no markdown fences.

Rules:
1. Summary is a concise factual hook — what happened, to whom, when.
2. Preserve brand names, tickers, units, model numbers verbatim.
3. For SEC filings: e.g. "8-K: 2026年6月9日公告" or "10-K: 2025年度报告"
4. For 公告 (announcements): e.g. "公司2025年度股东会决议" or "聘任/任命/分红公告"
5. For press releases: extract the key event — "X公司宣布收购Y", "X发布新产品Z"
6. No leading "该公告" or "公司" filler unless it adds info.
7. Return empty string only if title is gibberish/placeholder.

Example of correct output:
["比亚迪2025年度股东会决议公告","NVIDIA发布10-K年度报告(2025财年)","霍尼韦尔任命新独立董事"]`;
  const user = `Write a brief Chinese summary (20-40 chars) for each news title below. Return ONLY the JSON array.\n\n${numbered}`;
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2048, system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  let text = json.content?.[0]?.text || '';
  text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (m) text = m[0];
  return JSON.parse(text);
}

async function processBatch(batch) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const arr = await callModel(batch);
      if (arr.length !== batch.length) throw new Error(`length mismatch: ${arr.length} vs ${batch.length}`);
      return arr;
    } catch (err) {
      if (attempt === 2) {
        // Per-item retry
        const out = [];
        for (const it of batch) {
          try {
            const a = await callModel([it]);
            out.push(a[0] || '');
          } catch { out.push(''); }
        }
        return out;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function runOnSlug(slug) {
  const fp = join(DATA_DIR, `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const pending = [];
  for (const c of data.companies) {
    for (let i = 0; i < c.news.length; i++) {
      const n = c.news[i];
      const sn = (n.snippet || '').trim();
      if (sn.length >= 10) continue;  // already has decent snippet
      pending.push({ co: c.id, news: n, title: n.title || '', idx: i });
    }
  }
  if (pending.length === 0) {
    console.log(`▸ ${slug}: 0 items need snippets`);
    return 0;
  }
  console.log(`▸ ${slug}: filling ${pending.length} snippets...`);

  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));
  const results = new Array(pending.length);
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const myIdx = cursor++;
      if (myIdx >= pending.length) break;
      const start = myIdx;
      const end = Math.min(start + BATCH_SIZE, pending.length);
      const batch = pending.slice(start, end);
      try {
        const arr = await processBatch(batch);
        for (let j = 0; j < batch.length; j++) {
          results[start + j] = arr[j];
        }
        console.log(`  ✓ batch ${Math.floor(start / BATCH_SIZE) + 1}/${batches.length} (${batch.length} items)`);
      } catch (err) {
        for (let j = 0; j < batch.length; j++) results[start + j] = '';
        console.error(`  ✗ batch ${Math.floor(start / BATCH_SIZE) + 1}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));

  let applied = 0;
  for (let i = 0; i < pending.length; i++) {
    const r = results[i];
    if (r && r.length > 0) {
      pending[i].news.snippet = r;
      applied++;
    }
  }
  if (!DRY_RUN && applied > 0) writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`  applied=${applied}`);
  return applied;
}

const totals = {};
for (const slug of SLUGS) {
  totals[slug] = await runOnSlug(slug);
}
const sum = Object.values(totals).reduce((a, b) => a + b, 0);
console.log(`\n=== Total snippets filled: ${sum} ===`);
