#!/usr/bin/env node
// Second-pass translation: items that still have English brand names after
// the first pass. More aggressive prompt — translates brand names to Chinese
// transliterations when appropriate.

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
if (!KEY) {
  console.error('✗ No ANTHROPIC_AUTH_TOKEN');
  process.exit(1);
}

const DATA_DIR = 'data';
const CONFIG_FILE = join(DATA_DIR, 'industries.json');
const SLUGS = (JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')).industries || []).map(i => i.slug);
const BATCH_SIZE = 5;
const CONFIDENCE_FLOOR = 0.75;
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
  const sys = `You are a literal Japanese/English → Simplified-Chinese translator for industry news.

OUTPUT: ONLY a valid JSON array (no prose, no markdown fences). Each object has EXACTLY 3 fields: "title" (string), "snippet" (string), "confidence" (string 0.0-1.0).

Example:
[{"title":"翻译1","snippet":"摘要1","confidence":"0.9"}]

RULES:
1. Translate ALL English/Japanese company/brand names to Chinese. Examples:
   - "Toray Industries" → "东丽工业"
   - "Teijin Frontier" → "帝人富瑞"
   - "Asahi Kasei" → "旭化成"
   - "Goldwin" → "Goldwin" (no common translation, can keep)
   - "Idemitsu" → "出光兴产"
   - "Teijin" → "帝人"
   - "Mitsubishi Chemical" → "三菱化学"
   - "Solvay" → "索尔维"
   - "Honeywell" → "霍尼韦尔"
   - "Teijin Pharma" → "帝人制药"
   - "OCTAIR" → "OCTAIR" (product code, keep)
   - "RecoHand" → "RecoHand" (product code, keep)
   - "XEOMIN" → "XEOMIN" (drug name, keep)
2. KEEP these in original language:
   - Stock tickers (NYSE:TSLA, OTCQX:JUSHF, TSE:3407)
   - Drug names (XEOMIN®, etc.)
   - Product model numbers (Atto 2, OCTAIR)
   - Units and numbers ($35, 20%, 235.687)
   - File sizes (PDF: 153.2 KB)
3. Source names: keep publisher name as-is at end of title (e.g. " - PR Newswire")
4. Numbers, dates, percentages — verbatim
5. If source is gibberish/URL/placeholder/bot page — return empty string for both, confidence 0.0

Confidence rubric:
- 0.95+: clean translation, all terms translated
- 0.85-0.95: minor stylistic
- 0.70-0.85: some interpretation needed
- <0.70: review required`;

  const user = `Translate these ${items.length} items to Simplified Chinese. Return ONLY the JSON array.\n\n${numbered}`;

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
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
        pending.push({
          key: `${c.id}#${n.url}`,
          co: c.id,
          news: n,
          title: n.title || '',
          snippet: n.snippet || '',
        });
      }
    }
  }
  if (pending.length === 0) {
    console.log(`▸ ${slug}: 0 items, skipping`);
    return 0;
  }
  console.log(`▸ ${slug}: re-translating ${pending.length} items (aggressive brand-name translation)...`);
  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }
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
          results[start + j] = { ...batch[j], out: arr[j] };
        }
        console.log(`  ✓ batch ${Math.floor(start / BATCH_SIZE) + 1}/${batches.length} (${batch.length} items)`);
      } catch (err) {
        for (let j = 0; j < batch.length; j++) {
          results[start + j] = { ...batch[j], error: err.message };
        }
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
  for (const slug of SLUGS) {
    report.summary[slug] = await runOnSlug(slug, report);
  }
  writeFileSync(join(DATA_DIR, 'translate-report-pass2.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.summary).reduce((a,b) => a + b, 0);
  console.log(`\n✓ Pass 2 done. Applied ${total} translations.`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1); });