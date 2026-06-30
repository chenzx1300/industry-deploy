#!/usr/bin/env node
// Pass 5 — final cleanup. Target: SEC filing titles, remaining city/place names, person names, last brand stragglers.

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
const BATCH_SIZE = 4;
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
  const sys = `You are finalizing Chinese news headlines. The titles are MOSTLY Chinese but still contain English proper nouns (company brands, product names, place names, person names, SEC filing types) that should be transliterated to Chinese.

OUTPUT: ONLY valid JSON array. Each object: "title" (string), "snippet" (string), "confidence" (string 0.0-1.0).

RULES — apply ONLY to leftover English:
1. **SEC filing types** — translate the FULL title to natural Chinese:
   - "TE Connectivity 10-Q（季度报告）" → "TE Connectivity提交10-Q表格（季度报告）"
   - "TE Connectivity 8-K（当期报告）" → "TE Connectivity提交8-K表格（当期报告）"
   - "Vertiv 8-K（当期报告）" → "Vertiv提交8-K表格（当期报告）"
   - "Hubbell 提交8-K（当期报告）" → "Hubbell提交8-K表格（当期报告）"
   - "蔚来 6-K：表格 6-K" → "蔚来提交6-K表格（海外当期报告）"
   - "蔚来 6-K（当期海外报告）：表格 6-K" → "蔚来提交6-K表格（海外当期报告）"
   - "ABB有限公司：ABB股票回购 - 2025年12月24日 - 2025年12月30日" → "ABB有限公司披露股票回购（2025年12月24日至12月30日）"
   - "SIH Partners持股通知 - 2026年5月19日" → "SIH Partners发布持股变动通知（2026年5月19日）"
   - "SIH Partners参与通知 - 2026年5月13日" → "SIH Partners发布持股变动通知（2026年5月13日）"

2. **Place names** — transliterate to standard Chinese:
   - "Lange" → "兰格", "Kalleh" → "卡勒"
   - "Wisconsin" → "威斯康星州", "California" → "加利福尼亚州"
   - "Gebkim" → "格布基姆", "Kurkumbh" → "库尔库姆布"
   - "Mankato" → "曼卡托", "Eagan" → "伊甘", "Champaign" → "尚佩恩"
   - "Calgary" → "卡尔加里", "Coquitlam" → "高贵林"
   - "Caribbean" → "加勒比"
   - "德国汉高" already Chinese; "(USA)" → "（美国）"

3. **Person names** — transliterate to Chinese:
   - "Kazuhide Takanori" → "高�的之纪"  [user's preferred transliteration "的之纪"]
   - "Pat Gelsinger" → "帕特·基辛格"
   - "Jensen Huang" → "黄仁勋"
   - Person names from Japanese/Korean: use the standard Chinese transliteration
   - Always add Chinese surname first (亚洲顺序) for Asian names

4. **Brand/product names** — keep English but clean up pattern:
   - "BattCool 5.0" → "BattCool 5.0" (keep)
   - "ERGO Switch™" → "ERGO Switch™" (keep)
   - "Ability™ BuildingPro Suites" → "Ability™ BuildingPro Suites" (keep)
   - "OMCO Solar" → "OMCO Solar" (keep)
   - "Høglund" → "Høglund" (keep, Norwegian)
   - "Proteus" → "Proteus" (keep)
   - "PSYONIC" → "PSYONIC" (keep, brand)
   - "VoltaGrid" → "VoltaGrid" (keep)
   - "THE NORTH FACE" → "北面（THE NORTH FACE）" (transliterate + parenthetical)
   - "东丽CMA" → "东丽CMA" (keep as is)
   - "FSD" → "FSD（Full Self-Driving，完全自动驾驶）" (first occurrence, then FSD)
   - "FSD Lite" → "FSD Lite" (keep)
   - "OCP Global Summit" → "OCP Global Summit（开放计算项目全球峰会）"
   - "Computex" → "台北国际电脑展（Computex）"
   - "KGI Pre-Computex" → "凯基（KGI）Computex前导"

5. **Acronyms in headlines** — transliterate if known:
   - "CDU" → "CDU（液冷分配单元）" first time, then "CDU"
   - "MLCC" → "MLCC（多层陶瓷电容器）" first time, then "MLCC"
   - "RWD" → "后轮驱动（RWD）"
   - "Air RWD" → "Air后驱版"
   - "DigiKey" → "DigiKey（得捷电子）" first time
   - "Mouser" → "Mouser（贸泽电子）" first time
   - "MONA" → "MONA（小鹏子品牌）" first time
   - "Tesla / FSD / Cybertruck / Rivian" → keep
   - "Token" → "Token" (in AI context, keep English)
   - "KW" → "千瓦" or "kW"（standard unit symbol, keep）

6. **Suffix publisher names after " - "** — translate:
   - "- 美通社" (already Chinese)
   - "- 国际油脂杂志" (already Chinese)
   - "- Retail Dive" → "- Retail Dive（零售潜水）"
   - "- HPCwire" → "- HPCwire"
   - "- pv magazine美国版" → "- pv magazine美国版" (keep)
   - "- 数据中心丰富度 | Substack" → "- 数据中心丰富度 | Substack"
   - "- 智能水务杂志" (already Chinese)

7. **Sample contexts** to fix specific titles:
   - "耐斯特、高尔登、出光兴产和东丽工业建立合作伙伴关系" → "耐斯特、出光兴产和东丽建立合作伙伴关系" (高尔登 is wrong, should be 出光兴产)
     Actually keep "高尔登" — it's "Golden" or "Kolon". Translate as needed but keep standard. Standard: "高尔登" → "高尔登" (keep)
   - "的之纪就任东丽CMA社长兼CEO,2026年4月1日生效" → "的之纪就任东丽CMA社长兼CEO，2026年4月1日生效" (replace "," with "，")
   - "理想汽车首款纯电SUV理想i8正式发布 全国统一零售价格32.18万元-36.98万元" → "理想汽车首款纯电SUV理想i8正式发布，全国统一零售价32.18万-36.98万元"
   - "小鹏发布MONA L03，MONA系列首款SUV" → "小鹏发布MONA L03，MONA系列首款SUV" (L03 → keep if model code; L03 means SUV L03)
   - "Lemonade 将特斯拉 FSD 保险扩展至科罗拉多州" → "Lemonade将特斯拉FSD保险扩展至科罗拉多州"
   - "小鹏 G6 Air RWD 评测：配置虽少但提供高科技体验的电动车" → "小鹏G6 Air后驱版评测：配置虽少但提供高科技体验的电动车"

Confidence rubric:
- 0.95+: clean translation of all English parts
- 0.85-0.95: minor choices
- 0.70-0.85: kept some brand names intentionally
- <0.70: review required`;

  const user = `Final cleanup of these ${items.length} titles. The titles are MOSTLY Chinese but still have leftover English proper nouns (SEC filings, places, persons, acronyms, brands). Translate to natural Chinese. Return ONLY the JSON array.\n\n${numbered}`;

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
  console.log(`▸ ${slug}: pass 5 (final cleanup) on ${pending.length} items...`);
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
  writeFileSync(join(DATA_DIR, 'translate-report-pass5.json'), JSON.stringify(report, null, 2));
  const total = Object.values(report.summary).reduce((a,b) => a + b, 0);
  console.log(`\n✓ Pass 5 done. Applied ${total} translations.`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(err => { console.error('✗', err); process.exit(1); });