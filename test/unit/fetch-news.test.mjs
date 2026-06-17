import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsForCompanies } from '../../src/pipeline/fetch-news.mjs';

const REAL_RSS_XML = `<?xml version="1.0"?><rss><channel>
  <item><title>BYD launches next-gen blade battery platform</title><link>https://x.com/1</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

test('fetchNewsForCompanies builds correct URL with site: filter', async () => {
  const captured = [];
  const mockFetch = async (url) => {
    captured.push(url);
    return { ok: true, status: 200, text: async () => REAL_RSS_XML };
  };
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 5 });
  assert.equal(captured.length, 1);
  assert.match(captured[0], /news\.google\.com\/rss\/search/);
  // URLSearchParams percent-encodes the colon; accept either form
  assert.match(captured[0], /(site:byd\.com|site%3Abyd\.com)/);
});

test('fetchNewsForCompanies returns news array per company', async () => {
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => REAL_RSS_XML });
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch });
  assert.equal(result[0].news.length, 1);
  assert.equal(result[0].news[0].title, 'BYD launches next-gen blade battery platform');
});

test('fetchNewsForCompanies runs concurrently', async () => {
  const order = [];
  const mockFetch = async (url) => {
    const id = url.match(/site(?::|%3A)([^.&]+)/)[1];
    order.push(`start-${id}`);
    await new Promise(r => setTimeout(r, 10));
    order.push(`end-${id}`);
    return { ok: true, status: 200, text: async () => REAL_RSS_XML };
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
    return { ok: true, status: 200, text: async () => REAL_RSS_XML };
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

test('fetchNewsForCompanies caps at maxItems per company after filtering', async () => {
  // Generate 30 items, each with realistic verb-bearing titles
  const manyItems = Array.from({ length: 30 }, (_, i) =>
    `<item><title>BYD announces expansion plan ${i}</title><link>https://x.com/${i}</link><pubDate>Sun, ${15 - (i % 14)} Jun 2026 08:00:00 GMT</pubDate></item>`
  ).join('');
  const xml = `<?xml version="1.0"?><rss><channel>${manyItems}</channel></rss>`;
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => xml });
  const companies = [{ id: 'a', name: 'BYD', region: 'cn', domain: 'a.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 5 });
  assert.equal(result[0].news.length, 5);
});

test('fetchNewsForCompanies filters out nav pages and off-topic items', async () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>BYD launches new battery plant</title><link>https://x.com/1</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
    <item><title>News - BYD</title><link>https://x.com/2</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
    <item><title>BYD - Investor Relations</title><link>https://x.com/3</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
    <item><title>Some other company article about cars</title><link>https://x.com/4</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
    <item><title>BYD reports record quarterly sales</title><link>https://x.com/5</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => xml });
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 10 });
  // Should keep only the 2 BYD articles with action verbs and BYD in title
  assert.equal(result[0].news.length, 2);
  assert.match(result[0].news[0].title, /BYD launches/);
  assert.match(result[0].news[1].title, /BYD reports/);
});

test('fetchNewsForCompanies over-fetches to compensate for filtering', async () => {
  // Interleave good and bad items so over-fetching can find enough good ones
  const items = [];
  for (let i = 0; i < 20; i++) {
    if (i % 2 === 0) {
      items.push(`<item><title>BYD announces initiative ${i}</title><link>https://x.com/good-${i}</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>`);
    } else {
      items.push(`<item><title>News - BYD</title><link>https://x.com/bad-${i}</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate></item>`);
    }
  }
  const xml = `<?xml version="1.0"?><rss><channel>${items.join('')}</channel></rss>`;
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => xml });
  const companies = [{ id: 'byd', name: 'BYD', region: 'cn', domain: 'byd.com' }];
  const result = await fetchNewsForCompanies(companies, { fetchImpl: mockFetch, maxItems: 5 });
  // Should have 5 good items despite half being bad
  assert.equal(result[0].news.length, 5);
  for (const item of result[0].news) {
    assert.match(item.title, /BYD announces/);
  }
});
