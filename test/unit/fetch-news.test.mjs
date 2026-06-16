import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsForCompanies } from '../../src/pipeline/fetch-news.mjs';

const RSS_XML = `<?xml version="1.0"?><rss><channel>
  <item><title>News 1</title><link>https://x.com/1</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

test('fetchNewsForCompanies builds correct URL with site: filter', async () => {
  const captured = [];
  const mockFetch = async (url) => {
    captured.push(url);
    return { ok: true, status: 200, text: async () => RSS_XML };
  };
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 5 });
  assert.equal(captured.length, 1);
  assert.match(captured[0], /news\.google\.com\/rss\/search/);
  // URLSearchParams percent-encodes the colon; accept either form
  assert.match(captured[0], /(site:byd\.com|site%3Abyd\.com)/);
});

test('fetchNewsForCompanies returns news array per company', async () => {
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => RSS_XML });
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch });
  assert.equal(result[0].news.length, 1);
  assert.equal(result[0].news[0].title, 'News 1');
});

test('fetchNewsForCompanies runs concurrently', async () => {
  const order = [];
  const mockFetch = async (url) => {
    const id = url.match(/site(?::|%3A)([^.&]+)/)[1];
    order.push(`start-${id}`);
    await new Promise(r => setTimeout(r, 10));
    order.push(`end-${id}`);
    return { ok: true, status: 200, text: async () => RSS_XML };
  };
  const companies = [
    { id: 'a', name: 'A', region: 'cn', domain: 'a.com' },
    { id: 'b', name: 'B', region: 'cn', domain: 'b.com' },
  ];
  await fetchNewsForCompanies(companies, { fetchImpl: mockFetch });
  // Both should start before either ends (concurrent)
  assert(order.indexOf('start-a') < order.indexOf('end-a'));
  assert(order.indexOf('start-b') < order.indexOf('end-b'));
});

test('fetchNewsForCompanies skips failed company without crashing', async () => {
  const mockFetch = async (url) => {
    if (url.includes('b.com')) return { ok: false, status: 500, text: async () => '' };
    return { ok: true, status: 200, text: async () => RSS_XML };
  };
  const companies = [
    { id: 'a', name: 'A', region: 'cn', domain: 'a.com' },
    { id: 'b', name: 'B', region: 'cn', domain: 'b.com' },
  ];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch });
  assert.equal(result[0].news.length, 1);
  assert.equal(result[1].news.length, 0);
  assert.equal(result[1].id, 'b');
});

test('fetchNewsForCompanies caps at maxItems per company', async () => {
  const manyItems = Array.from({ length: 20 }, (_, i) =>
    `<item><title>News ${i}</title><link>https://x.com/${i}</link><pubDate>Sun, ${15 - (i % 14)} Jun 2026 08:00:00 GMT</pubDate></item>`
  ).join('');
  const xml = `<?xml version="1.0"?><rss><channel>${manyItems}</channel></rss>`;
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => xml });
  const companies = [{ id: 'a', name: 'A', region: 'cn', domain: 'a.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 5 });
  assert.equal(result[0].news.length, 5);
});
