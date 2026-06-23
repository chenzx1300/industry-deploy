import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoogleNewsUrl } from '../../src/lib/url-resolver.mjs';

test('returns input unchanged for non-Google URLs', async () => {
  const result = await resolveGoogleNewsUrl('https://byd.com/news/article', { fetchImpl: async () => ({}) });
  assert.equal(result, 'https://byd.com/news/article');
});

test('returns input on fetch error (graceful fallback)', async () => {
  const result = await resolveGoogleNewsUrl('https://news.google.com/rss/articles/ABC', {
    fetchImpl: async () => { throw new Error('network down'); },
  });
  assert.equal(result, 'https://news.google.com/rss/articles/ABC');
});

test('follows 302 Location header', async () => {
  const result = await resolveGoogleNewsUrl('https://news.google.com/rss/articles/CBMiXXX', {
    fetchImpl: async () => ({
      status: 302,
      headers: { get: (k) => k.toLowerCase() === 'location' ? 'https://www.tesla.com/news/article-123' : null },
    }),
  });
  assert.equal(result, 'https://www.tesla.com/news/article-123');
});

test('returns input on non-redirect status', async () => {
  const result = await resolveGoogleNewsUrl('https://news.google.com/rss/articles/CBMiYYY', {
    fetchImpl: async () => ({
      status: 200,
      headers: { get: () => null },
    }),
  });
  assert.equal(result, 'https://news.google.com/rss/articles/CBMiYYY');
});

test('returns input when no Location header on 302', async () => {
  const result = await resolveGoogleNewsUrl('https://news.google.com/rss/articles/CBMiZZZ', {
    fetchImpl: async () => ({
      status: 302,
      headers: { get: () => null },
    }),
  });
  assert.equal(result, 'https://news.google.com/rss/articles/CBMiZZZ');
});