#!/usr/bin/env node
// Translate English news titles/snippets to Simplified Chinese.
// Uses MiniMax API (api.minimaxi.com/anthropic, Anthropic-compatible).
//
// Strategy:
//   1. Scan all 4 industry JSON files for English titles/snippets
//   2. Batch 10 items per API call; ask model to return JSON array
//   3. Skip items that are already mostly Chinese (>= 60% CJK chars)
//   4. For each translation, model also returns `confidence` (0-1).
//      Items with confidence < 0.6 are written to data/translate-report.json
//      but NOT applied to the JSON — operator reviews them manually.
//
// Usage: node scripts/translate-news.mjs
//
// Reads API key from ANTHROPIC_AUTH_TOKEN env var or
// ~/.claude/settings.json (env block).

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
  console.error('✗ No ANTHROPIC_AUTH_TOKEN in env or ~/.claude/settings.json');
  process.exit(1);
}

const DATA_DIR = 'data';
const SLUGS = ['semiconductor-industry', 'new-energy-vehicles-industry', 'carbon-fiber-industry', 'thermal-materials-industry'];
const BATCH_SIZE = 5;
const CONFIDENCE_FLOOR = 0.8;       // stricter threshold — items < 0.8 are NOT applied
const MAX_PARALLEL = 3;

function isMostlyCjk(s) {
  if (!s) return true;
  // Count distinct "English word" tokens (3+ ASCII letters).
  // Chinese-mixed-with-brand has 1-2 brand names; pure English title has 3+.
  const words = (s.match(/\b[A-Za-z]{3,}\b/g) || []);
  return words.length < 3;
}

async function callModel(items) {
  const numbered = items.map((it, i) => `${i + 1}. [TITLE] ${it.title}\n   [SNIPPET] ${it.snippet || '(empty)'}`).join('\n\n');
  const sys = `You are a literal English→Simplified-Chinese translator for news. Output ONLY a valid JSON array of objects (no prose, no markdown fences). Each object has exactly THREE string fields: "title", "snippet", "confidence" (number 0.0-1.0 as a string).

Example of correct output:
[{"title":"翻译1","snippet":"摘要1","confidence":"0.9"},{"title":"翻译2","snippet":"","confidence":"0.85"}]

STRICT RULES — violating any of these lowers confidence:
1. **Literal translation only** — translate the words that are there, do NOT add context the source doesn't have. No inventing facts, no filling gaps.
2. **Preserve ALL English tokens** that appear in the source: brand names (BYD, Samsung, Intel, TSMC, Solvay, Jushi, etc.), tickers (SEHK:1347, NASDAQ:TSLA, OTCQX:JUSHF, CSE:JUSH), units ($35,500, 20%, €6.15, 235.687 BCM), model numbers (Atto 2, JE20), proper nouns (Lithium-ion, ROE), company suffixes (Inc., Holdings, GmbH), stock qualifiers ("premium", "fair value", "1-Star"), and parenthetical markers like "(PDF: 153.2 KB)".
3. **Numbers, percentages, dates** — keep them verbatim.
4. **Chinese titles should read like news** — concise, complete, "的"/"了"/"在" allowed where natural.
5. **If source is mostly gibberish / URL / placeholder / bot page** — return empty string for both title and snippet, confidence 0.0.
6. **If you are unsure about ANY term** — keep it English and lower confidence.

Confidence rubric:
- 0.95+ : clean literal translation, all proper nouns preserved
- 0.85-0.95 : minor stylistic choices, semantically equivalent
- 0.70-0.85 : some interpretation but source is clear
- 0.50-0.70 : ambiguous or you paraphrased; reviewer should check
- < 0.50 : likely misread; review required`;
  const user = `Translate these ${items.length} English news items to Simplified Chinese. Return ONLY the JSON array, no prose, no markdown fences.\n\n${numbered}`;
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
  text = text.trim();
  // Strip code fences if any
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let arr;
  try {
    arr = JSON.parse(text);
  } catch (e1) {
    // Some models return string-wrapped JSON
    if (text.startsWith('"') && text.endsWith('"')) {
      try { arr = JSON.parse(JSON.parse(text)); } catch (e2) { /* fall through */ }
    }
    if (!arr) {
      // Try to extract a JSON array substring (greedy)
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        try { arr = JSON.parse(m[0]); } catch (e3) { /* fall through */ }
      }
      // Last resort: fix unescaped quotes inside string values (e.g. "Jushi" inside "title": "...")
      if (!arr) {
        try {
          // Replace inner " surrounded by Chinese chars with full-width quote
          const fixed = text
            .replace(/([一-鿿])"([^",:}\]]+)"([一-鿿])/g, '$1“$2”$3')
            .replace(/: "([^",:}\]]*)"([^",:}\]]*)"([^"]*?)"/g, ': "$1“$2”$3"');
          arr = JSON.parse(fixed);
        } catch (e4) { /* fall through */ }
      }
    }
    if (!arr) throw new Error(`cannot parse JSON from response: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(arr)) throw new Error(`response is not array: ${typeof arr}`);
  // Normalize confidence to number
  for (const item of arr) {
    if (typeof item.confidence === 'string') item.confidence = parseFloat(item.confidence) || 0;
  }
  return arr;
}

async function processBatch(batch) {
  const tries = batch.length;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const arr = await callModel(batch);
      if (arr.length !== tries) throw new Error(`expected ${tries} translations, got ${arr.length}`);
      return arr;
    } catch (err) {
      console.error(`  ⚠ attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function runOnSlug(slug, report) {
  const fp = join(DATA_DIR, `${slug}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));

  // Collect items needing translation
  const pending = [];
  for (const c of data.companies) {
    for (const n of c.news) {
      const needsTitle = n.title && !isMostlyCjk(n.title);
      const needsSnippet = n.snippet && !isMostlyCjk(n.snippet);
      if (needsTitle || needsSnippet) {
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
    console.log(`▸ ${slug}: 0 English items, skipping`);
    return 0;
  }

  console.log(`▸ ${slug}: translating ${pending.length} items...`);

  // Build batches of BATCH_SIZE
  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  // Run with limited parallelism
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
        console.error(`  ✗ batch ${Math.floor(start / BATCH_SIZE) + 1} failed: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));

  // Apply translations
  let applied = 0, skipped = 0, errors = 0;
  for (const r of results) {
    if (!r) continue;
    if (r.error) { errors++; continue; }
    const conf = r.out.confidence ?? 0;
    // Always log every translation for audit — the report includes ALL items
    const auditEntry = {
      slug, company: r.co, url: r.news.url,
      orig: { title: r.title, snippet: r.snippet },
      translated: { title: r.out.title || '', snippet: r.out.snippet || '' },
      confidence: conf,
      applied: conf >= CONFIDENCE_FLOOR,
    };
    report.all_translations.push(auditEntry);
    if (conf < CONFIDENCE_FLOOR) {
      report.low_confidence.push(auditEntry);
      skipped++;
      continue;
    }
    if (r.out.title) r.news.title = r.out.title;
    if (r.out.snippet) r.news.snippet = r.out.snippet;
    applied++;
  }

  writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`  applied=${applied} low_conf=${skipped} errors=${errors}`);
  return applied;
}

async function main() {
  const report = { low_confidence: [], all_translations: [], summary: {} };
  for (const slug of SLUGS) {
    const n = await runOnSlug(slug, report);
    report.summary[slug] = n;
  }
  writeFileSync(join(DATA_DIR, 'translate-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n✓ Done.`);
  console.log(`  Applied:           ${Object.values(report.summary).reduce((a,b)=>a+b, 0)}`);
  console.log(`  Low-confidence:    ${report.low_confidence.length} → see data/translate-report.json`);
  console.log(`  Total translations logged: ${report.all_translations.length}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(err => { console.error('✗ Fatal:', err); process.exit(1); });