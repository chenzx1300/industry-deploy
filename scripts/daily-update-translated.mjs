#!/usr/bin/env node
// Daily update + auto-translate.
// Pipeline:
//   1. Build fresh news from web (daily-update.mjs)
//   2. Translate any remaining English titles/snippets to Chinese (translate-news.mjs)
//   3. Re-render HTML from translated JSON
//
// This means the JSON in data/ is always English-on-build, then translated;
// if a daily cron rebuilds, translation runs again automatically.

import { spawnSync } from 'node:child_process';

function run(label, cmd, args, opts = {}) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(cmd, args, { encoding: 'utf-8', stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    console.error(`✗ ${label} failed (exit ${res.status})`);
    process.exit(1);
  }
}

run('Step 1/4 — Build fresh news', 'node', ['scripts/daily-update.mjs']);
run('Step 2/4 — Strip bot-block / placeholder snippets', 'node', ['scripts/clean-news.mjs']);
run('Step 3/4 — Translate English to Chinese', 'node', ['scripts/translate-news.mjs']);
// daily-update already rendered HTML; after translate+clean we need to re-render
run('Step 4/4 — Re-render HTML from translated JSON', 'node', ['scripts/render-from-json.mjs']);

console.log('\n✓ All done.');