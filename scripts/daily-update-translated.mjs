#!/usr/bin/env node
// Daily update pipeline. Reads existing data/<slug>.json as the knowledge
// baseline, fetches only NEW news (incremental), strips junk, translates
// English→Chinese, then re-renders HTML.
//
// Steps:
//   1. incremental-update.mjs  — fetch + dedup onto baseline; drop stale companies
//   2. clean-news.mjs          — strip block-page snippets / placeholder titles
//   3. translate-news.mjs      — translate any remaining English
//   4. render-from-json.mjs    — re-render HTML
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

run('Step 1/4 — Incremental fetch + dedup + stale-drop', 'node', ['scripts/incremental-update.mjs']);
run('Step 2/4 — Strip bot-block / placeholder snippets', 'node', ['scripts/clean-news.mjs']);
run('Step 3/4 — Translate English to Chinese', 'node', ['scripts/translate-news.mjs']);
run('Step 4/4 — Re-render HTML from translated JSON', 'node', ['scripts/render-from-json.mjs']);

console.log('\n✓ All done.');