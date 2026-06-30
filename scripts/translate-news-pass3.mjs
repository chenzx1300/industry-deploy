#!/usr/bin/env node
// Pass 3 — translate ALL remaining English/mixed-language items.
// More aggressive prompt: translate EVERYTHING to Chinese, only preserve
// truly untranslatable tokens (URLs, file sizes, hex IDs, stock tickers).

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
const CONFIDENCE_FLOOR = 0.7;
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
  const sys = `You translate English/Japanese news headlines to Simplified Chinese. AGGRESSIVE translation: translate EVERYTHING possible.

OUTPUT: ONLY valid JSON array, no prose, no markdown fences. Each object has 3 fields: "title" (string), "snippet" (string), "confidence" (string 0.0-1.0).

Example:
[{"title":"翻译","snippet":"摘要","confidence":"0.9"}]

RULES — translate as much as possible:
1. **Companies/brands** → translate to Chinese when a standard name exists:
   - Neste (芬兰石油公司) → 耐斯特, Goldman/Goldwin → 高尔登, Olaplex → 欧拉普
   - Blackstone → 黑石集团, Ecolab → 艺康集团, KKR → KKR (keep)
   - ThermoKey → 意可, Strategic Thermal Labs → Strategic Thermal Labs (keep)
   - NVIDIA → 英伟达, Tesla → 特斯拉, BYD → 比亚迪
   - Audi, BMW, Mercedes → 奥迪、宝马、梅赛德斯
   - Land Cruiser → 陆地巡洋舰, Hilux → 海拉克斯, Atto 2 → Atto 2 (no Chinese)
   - Model Y, Model 3, Cybertruck → 特斯拉 Model Y、特斯拉 Model 3、特斯拉 Cybertruck
2. **Form types** → translate:
   - 6-K, 8-K, 10-Q, 10-K → 6-K（当期海外报告）、8-K（当期报告）、10-Q（季度报告）、10-K（年度报告）
3. **Publishers** → translate when standard:
   - PR Newswire → 美通社, Reuters → 路透社, Caixin Global → 财新国际
   - CnEVPost, HPCwire, Stock Titan, Investing News Network → keep (no standard translation)
   - " - PublisherName" suffix: keep or translate based on rule above
4. **Person names** → transliterate to Chinese (close phonetic):
   - Jim Currier → 吉姆·柯里尔, Pradhyumna Ingle → 普拉迪尤姆纳·英格尔
   - Japanese names: keep katakana transliteration
5. **Acronyms / initialisms** → translate if standard:
   - CDR, DDR5, NAND, DRAM, AI, IoT, MLCC, CDU, EV, HEV, xEV, SUV → keep (technical terms)
   - "AI 时代", "xEV 高电压" — these are already Chinese-mixed, OK
6. **Product names with model codes** → keep code but translate description:
   - "Ability™ BuildingPro Suites" → "Ability™ BuildingPro 套件" (translate Suites to 套件)
   - "OCTAIR 保温纤维" → keep OCTAIR, translate 保温纤维 (already Chinese)
   - "BattCool 5.0" → "BattCool 5.0 储能空调" (add Chinese description)
7. **Numbers, dates, percentages** → verbatim
8. **File sizes** like "(PDF: 153.2 KB)" → keep in English

Confidence rubric:
- 0.95+: clean translation
- 0.85-0.95: minor transliteration choices
- 0.70-0.85: some interpretation
- <0.70: review required`;

  const user = `Translate these ${items.length} items to Simplified Chinese. Translate EVERYTHING you can — even mixed-language titles. Return ONLY the JSON array.\n\n${numbered}`;

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
  console.log(`▸ ${slug}: re-translating ${pending.length} items (pass 3, aggressive)...`);
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
  writeFileSync(join(DATA_DIR, 'translate-report-pass3.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.summary).reduce((a,b) => a + b, 0);
  console.log(`\n✓ Pass 3 done. Applied ${total} translations.`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(err => { console.error('✗', err); process.exit(1); });