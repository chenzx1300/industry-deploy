import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseGoogleNewsRss } from '../../src/lib/rss-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, '../fixtures/google-news-rss.xml'), 'utf-8');

test('parses valid RSS into items', () => {
  const items = parseGoogleNewsRss(fixture);
  assert.equal(items.length, 2); // empty title skipped
  assert.equal(items[0].title, 'BYD launches new blade battery');
  assert.equal(items[0].url, 'https://byd.com/news/blade');
  assert.match(items[0].published_at, /^2026-06-15/);
});

test('returns empty array for invalid XML', () => {
  assert.deepEqual(parseGoogleNewsRss('not xml'), []);
});

test('skips items missing required fields', () => {
  const xml = `<rss><channel><item><link>https://x.com</link></item></channel></rss>`;
  assert.deepEqual(parseGoogleNewsRss(xml), []);
});

test('parses source domain from <source> url', () => {
  const items = parseGoogleNewsRss(fixture);
  assert.equal(items[0].source, 'byd.com');
});

test('falls back to domain from link when no source', () => {
  const xml = `<rss><channel>
    <item>
      <title>Test</title>
      <link>https://example.com/article</link>
      <pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate>
    </item>
  </channel></rss>`;
  const items = parseGoogleNewsRss(xml);
  assert.equal(items[0].source, 'example.com');
});
