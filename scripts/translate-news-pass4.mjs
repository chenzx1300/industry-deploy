#!/usr/bin/env node
// Pass 4 — translate brand names, geographic names, publisher suffixes.
// Targeted at items where the surrounding text is already Chinese.

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

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const SLUGS = (JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')).industries || []).map(i => i.slug);
const BATCH_SIZE = 5;
const CONFIDENCE_FLOOR = 0.65;
const MAX_PARALLEL = 3;

function needsTranslation(s) {
  if (!s) return false;
  const cjk = (s.match(/[一-鿿]/g) || []).length;
  const words = (s.match(/\b[A-Za-z]{3,}\b/g) || []);
  if (words.length >= 2) return true;
  if (cjk < s.length / 2) return true;
  return false;
}

async function callModel(items) {
  const numbered = items.map((it, i) => `${i + 1}. [TITLE] ${it.title}\n   [SNIPPET] ${it.snippet || '(empty)'}`).join('\n\n');
  const sys = `You are finalizing Chinese news headlines. The titles are MOSTLY Chinese but still contain English brand names, product codes, publisher names, or geographic names that should be translated/transliterated.

OUTPUT: ONLY valid JSON array. Each object: "title" (string), "snippet" (string), "confidence" (string 0.0-1.0).

RULES — apply ONLY to the leftover English parts:
1. **Car/vehicle model names**:
   - "Land Cruiser" → 陆地巡洋舰, "Hilux" → 海拉克斯, "Land Cruiser FJ" → 陆地巡洋舰FJ
   - "Li L8" / "Li L9" → 理想L8 / 理想L9 (Li = 理想 brand)
   - "Model Y" / "Model 3" → 特斯拉Model Y / Model 3
   - "Cybertruck" → Cybertruck (keep)
2. **Japanese company brands**: keep brand names if they're the official English name, BUT add Chinese context if helpful
   - "OCTAIR" → OCTAIR (keep, it's a product line)
   - "RecoHand" → RecoHand (keep, product name)
   - "DeepSeek V4" → DeepSeek V4 (keep, model)
   - "Solventum" → Solventum (keep, recently spun off 3M brand)
   - "Eagan" → 伊甘 (transliterate city name)
3. **Geographic place names** (transliterate):
   - "Kurkumbh" → 库尔库姆布, "Gebkim" → 格布基姆
   - "Wisconsin" → 威斯康星州
   - "Germany" → 德国
4. **Publisher/media names** (translate if standard, otherwise keep):
   - "PR Newswire" → 美通社
   - "Reuters" → 路透社
   - "Caixin Global" → 财新国际
   - "CnEVPost" → CnEVPost (keep, no standard)
   - "Stock Titan" → Stock Titan (keep)
   - "Investing News Network" → 投资新闻网络
   - "The Business Journals" → 商业期刊
   - "HBS Dealer" → HBS经销商
   - "Barchart.com" → Barchart.com (keep)
   - "Let's Data Science" → 让我们数据科学
   - "Oils & Fats International" → 国际油脂杂志
   - "Japan Tissue Engineering" → 日本组织工程公司
   - "Solventum" → 索尔文图姆 (transliterate)
5. **Company names that have English names**:
   - "SIH Partners" → SIH Partners (keep, French PE firm)
   - "Circulose" → Circulose (keep, brand)
   - "Jilin" → 吉林
6. **Brand new SEC filing items** (only those with "6-K：表格 6-K" pattern):
   - Translate to: "公司提交6-K表格（海外当期报告）" or similar
7. **Date prefixes like "2026年5月18日 材料 可持续性"** — keep these prefixes
8. **File size suffixes like "(PDF: 236.2 KB)"** — keep verbatim

Confidence rubric:
- 0.95+: clean translation of all English parts
- 0.85-0.95: minor choices
- 0.70-0.85: kept some brand names intentionally
- <0.70: review required`;

  const user = `Finalize these ${items.length} titles by translating leftover English words (brand names, place names, publisher names). The titles are MOSTLY Chinese already. Return ONLY the JSON array.\n\n${numbered}`;

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  let text = json.content?.[0]?.text || '';
  text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let arr;
  try { arr = JSON.parse(text); }
  catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) { try { arr = JSON.parse(m[0]); } catch {} }
    if (!arr) throw new Error(`cannot parse: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(arr)) throw new Error(`not array: ${typeof arr}`);
  for (const item of arr) {
    if (typeof item.confidence === 'string') item.confidence = parseFloat(item.confidence) || 0;
  }
  return arr;
}

async function processBatch(batch) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const arr = await callModel(batch);
      if (arr.length !== batch.length) throw new Error(`expected ${batch.length}, got ${arr.length}`);
      return arr;
    } catch (err) {
      console.error(`  ⚠ batch attempt ${attempt} failed: ${err.message.slice(0, 100)}`);
      if (attempt === 2) {
        const out = [];
        for (const item of batch) {
          try {
            const arr = await callModel([item]);
            if (arr.length === 1) out.push(arr[0]);
            else throw new Error('length mismatch');
          } catch (e2) {
            out.push({ title: item.title, snippet: item.snippet, confidence: 0 });
          }
        }
        return out;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function runOnSlug(slug, report) {
  const fp = join(DATA_DIR, `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const pending = [];
  for (const c of data.companies) {
    for (const n of c.news) {
      if (needsTranslation(n.title) || needsTranslation(n.snippet)) {
        pending.push({ co: c.id, news: n, title: n.title || '', snippet: n.snippet || '' });
      }
    }
  }
  if (pending.length === 0) { console.log(`▸ ${slug}: 0 items, skipping`); return 0; }
  console.log(`▸ ${slug}: pass 4 (brand/place/publisher translation) on ${pending.length} items...`);
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
        for (let j = 0; j < batch.length; j++) results[start + j] = { ...batch[j], out: arr[j] };
        console.log(`  ✓ batch ${Math.floor(start / BATCH_SIZE) + 1}/${batches.length}`);
      } catch (err) {
        for (let j = 0; j < batch.length; j++) results[start + j] = { ...batch[j], error: err.message };
        console.error(`  ✗ batch ${Math.floor(start / BATCH_SIZE) + 1}: ${err.message.slice(0, 100)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));
  let applied = 0, skipped = 0, errors = 0;
  for (const r of results) {
    if (!r) continue;
    if (r.error) { errors++; continue; }
    const conf = r.out.confidence ?? 0;
    report.all_translations.push({
      slug, company: r.co, url: r.news.url,
      orig: { title: r.title, snippet: r.snippet },
      translated: { title: r.out.title || '', snippet: r.out.snippet || '' },
      confidence: conf,
      applied: conf >= CONFIDENCE_FLOOR,
    });
    if (conf < CONFIDENCE_FLOOR) { skipped++; continue; }
    if (r.out.title) r.news.title = r.out.title;
    if (r.out.snippet) r.news.snippet = r.out.snippet;
    applied++;
  }
  writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`  applied=${applied} low_conf=${skipped} errors=${errors}`);
  return applied;
}

async function main() {
  const report = { all_translations: [], summary: {} };
  for (const slug of SLUGS) report.summary[slug] = await runOnSlug(slug, report);
  writeFileSync(join(DATA_DIR, 'translate-report-pass4.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.summary).reduce((a,b) => a + b, 0);
  console.log(`\n✓ Pass 4 done. Applied ${total} translations.`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(err => { console.error('✗', err); process.exit(1); });