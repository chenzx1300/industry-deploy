#!/usr/bin/env node
// Re-render HTML for all industries from already-existing JSON files in data/.
// Use this after translate-news.mjs modifies titles/snippets, since
// daily-update.mjs overwrites news with fresh web fetches.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const DATA_DIR = 'data';
const DIST_DIR = 'docs';

const industries = JSON.parse(readFileSync(join(DATA_DIR, 'industries.json'), 'utf-8')).industries;

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