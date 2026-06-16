import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchIndustry } from '../../src/pipeline/search.mjs';

test('searchIndustry POSTs to Tavily with correct shape', async () => {
  let captured;
  const mockFetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [{ title: 'Top EV companies', url: 'https://x.com', content: 'BYD, CATL, Tesla...' }] }),
    };
  };
  const result = await searchIndustry('ev', { apiKey: 'tvly-test', fetchImpl: mockFetch });
  assert.match(captured.url, /^https:\/\/api\.tavily\.com\/search$/);
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.query, 'top ev companies 2026');
  assert.equal(body.api_key, 'tvly-test');
  assert.equal(body.max_results, 20);
  assert.equal(result.results.length, 1);
});

test('searchIndustry retries on 5xx up to 2 times', async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  };
  await searchIndustry('ev', { apiKey: 'k', fetchImpl: mockFetch });
  assert.equal(calls, 3);
});

test('searchIndustry returns empty when all retries fail', async () => {
  const mockFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const result = await searchIndustry('ev', { apiKey: 'k', fetchImpl: mockFetch });
  assert.deepEqual(result.results, []);
});
