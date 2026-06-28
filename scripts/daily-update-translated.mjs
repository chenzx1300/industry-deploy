#!/usr/bin/env node
// Daily update pipeline. Reads existing data/<slug>.json as the knowledge
// baseline, fetches only NEW news (incremental), re-seeds fallback to
// guarantee Chinese content, strips block-page noise, translates
// English→Chinese, then re-renders HTML.
//
// Steps (must run in this order — see skill "Daily pipeline"):
//   1. incremental-update.mjs  — fetch + dedup onto baseline; drop stale cos
//   2. seed-fallbacks.mjs      — re-inject dated fallback_news + drop Bing misclassified
//   3. clean-news.mjs          — strip block-page snippets / placeholder titles
//   4. translate-news.mjs      — translate any remaining English
//   5. render-from-json.mjs    — re-render HTML
//
// After this script, the user MUST run:
//   6. generate-audit-report.mjs
//   7. human review + git push
//
// All steps are idempotent — safe to re-run.

import { spawnSync } from 'node:child_process';

function run(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(cmd, args, { encoding: 'utf-8', stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✗ ${label} failed (exit ${res.status})`);
    process.exit(1);
  }
}

run('Step 1/5 — Incremental fetch + dedup + stale-drop', 'node', ['scripts/incremental-update.mjs']);
run('Step 2/5 — Re-seed fallback_news (drop Bing misclassified)', 'node', ['scripts/seed-fallbacks.mjs']);
run('Step 3/5 — Strip bot-block / placeholder snippets', 'node', ['scripts/clean-news.mjs']);
run('Step 4/5 — Translate English to Chinese', 'node', ['scripts/translate-news.mjs']);
run('Step 5/5 — Re-render HTML from translated JSON', 'node', ['scripts/render-from-json.mjs']);

console.log('\n✓ Pipeline steps 1-5 done. Now run:');
console.log('  node scripts/generate-audit-report.mjs');
console.log('  open docs/audit-report.html  # review low-confidence items');
console.log('  git add . && git commit -m "..." && git push');
console.log('\n(DO NOT deploy without step 6+7 review.)');