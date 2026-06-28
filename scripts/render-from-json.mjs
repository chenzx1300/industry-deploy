#!/usr/bin/env node
// Re-render HTML for all industries from already-existing JSON files in data/.
// Use this after translate-news.mjs modifies titles/snippets, since
// daily-update.mjs overwrites news with fresh web fetches.
//
// Defensive: scans data/<slug>.json for any title/snippet that still has
// >= 3 English words of 3+ chars (i.e. likely untranslated). If --force
// is passed, auto-runs translate-news.mjs first; otherwise prints a warning
// so the operator knows to translate before deploying.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const DATA_DIR = 'data';
const DIST_DIR = 'docs';
const FORCE_TRANSLATE = process.argv.includes('--force') || process.env.TRANSLATE_AUTO === '1';

const industries = JSON.parse(readFileSync(join(DATA_DIR, 'industries.json'), 'utf-8')).industries;

// Same heuristic as translate-news.mjs: count distinct English tokens of
// 3+ ASCII letters; >= 3 means "looks English-ish, probably needs translation".
function looksUntranslated(s) {
  if (!s) return false;
  const words = s.match(/\b[A-Za-z]{3,}\b/g) || [];
  return words.length >= 3;
}

function scanUntranslated() {
  const issues = [];
  for (const ind of industries) {
    const fp = join(DATA_DIR, ind.slug + '.json');
    if (!existsSync(fp)) continue;
    const data = JSON.parse(readFileSync(fp, 'utf-8'));
    for (const c of data.companies) {
      for (const n of c.news || []) {
        if (looksUntranslated(n.title) || looksUntranslated(n.snippet)) {
          issues.push({ slug: ind.slug, co: c.id, url: n.url, title: n.title });
        }
      }
    }
  }
  return issues;
}

const issues = scanUntranslated();
if (issues.length > 0) {
  console.log(`⚠ Detected ${issues.length} likely-untranslated items in data/:`);
  // Group by company for compact output
  const byCo = {};
  for (const i of issues) {
    const k = `${i.slug}/${i.co}`;
    (byCo[k] = byCo[k] || []).push(i);
  }
  for (const [k, items] of Object.entries(byCo).slice(0, 8)) {
    console.log(`  ${k}: ${items.length} item(s)`);
    for (const it of items.slice(0, 2)) {
      console.log(`    - ${it.title.substring(0, 70)}`);
    }
  }
  if (Object.keys(byCo).length > 8) console.log(`  ... and ${Object.keys(byCo).length - 8} more companies`);

  if (FORCE_TRANSLATE) {
    console.log(`\n▸ Auto-running translate-news.mjs (FORCE_TRANSLATE=${FORCE_TRANSLATE})...`);
    const res = spawnSync('node', ['scripts/translate-news.mjs'], { stdio: 'inherit', encoding: 'utf-8' });
    if (res.status !== 0) {
      console.error(`✗ translate-news.mjs failed (exit ${res.status}); rendering anyway`);
    } else {
      const after = scanUntranslated();
      console.log(`  → untranslated items after auto-translate: ${after.length} (was ${issues.length})`);
    }
  } else {
    console.log(`\n  Render anyway, but consider running:`);
    console.log(`    node scripts/translate-news.mjs          # translate first, then re-render`);
    console.log(`    node scripts/render-from-json.mjs --force  # auto-translate then render`);
  }
}

let totalNews = 0;
for (const ind of industries) {
  const fp = join(DATA_DIR, ind.slug + '.json');
  if (!existsSync(fp)) {
    console.error(`✗ ${fp} not found — run daily-update.mjs first`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.reduce((s, x) => s + x.news.length, 0);
  totalNews += c;
  mkdirSync(join(DIST_DIR, ind.slug), { recursive: true });
  writeFileSync(join(DIST_DIR, ind.slug, 'index.html'), renderIndustryPage(data));
  console.log(`✓ ${ind.slug}: ${data.companies.length} cos / ${c} news`);
  await addToManifest(DATA_DIR, {
    slug: ind.slug,
    prompt: ind.prompt,
    company_count: data.companies.length,
    news_count: c,
    generated_at: data.generated_at,
  });
}

const manifest = await loadManifest(DATA_DIR);
writeFileSync(join(DIST_DIR, 'index.html'), renderHomepage(manifest));
console.log(`\n✓ ${industries.length} industries / ${totalNews} total news re-rendered.`);