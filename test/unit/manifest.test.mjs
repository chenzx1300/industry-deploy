import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadManifest, saveManifest, addToManifest } from '../../src/pipeline/manifest.mjs';

test('loadManifest returns empty list when file missing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  const result = await loadManifest(dir);
  assert.deepEqual(result, { industries: [] });
});

test('saveManifest writes JSON', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  const data = { industries: [{ slug: 'foo-industry', prompt: 'foo', company_count: 6, news_count: 10, generated_at: '2026-06-16T00:00:00Z' }] };
  await saveManifest(dir, data);
  const read = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'));
  assert.deepEqual(read, data);
});

test('addToManifest prepends new entry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  await addToManifest(dir, { slug: 'a-industry', prompt: 'a', company_count: 6, news_count: 10, generated_at: '2026-06-15T00:00:00Z' });
  await addToManifest(dir, { slug: 'b-industry', prompt: 'b', company_count: 6, news_count: 20, generated_at: '2026-06-16T00:00:00Z' });
  const m = await loadManifest(dir);
  assert.equal(m.industries.length, 2);
  assert.equal(m.industries[0].slug, 'b-industry'); // newest first
});

test('addToManifest dedupes by slug (updates in place)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  await addToManifest(dir, { slug: 'a-industry', prompt: 'a', company_count: 6, news_count: 10, generated_at: '2026-06-15T00:00:00Z' });
  await addToManifest(dir, { slug: 'a-industry', prompt: 'a', company_count: 6, news_count: 99, generated_at: '2026-06-16T00:00:00Z' });
  const m = await loadManifest(dir);
  assert.equal(m.industries.length, 1);
  assert.equal(m.industries[0].news_count, 99);
  assert.equal(m.industries[0].generated_at, '2026-06-16T00:00:00Z');
});
