import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateData } from '../../src/pipeline/validate.mjs';

const validData = {
  slug: 'ev-industry',
  prompt: 'ev',
  generated_at: '2026-06-16T00:00:00Z',
  companies: [
    { id: 'a', name: 'A', region: 'cn', domain: 'a.com', news: [{ title: 't', snippet: 's', url: 'https://x.com/1', source: 'x.com', published_at: '2026-06-15T00:00:00Z' }] },
    { id: 'b', name: 'B', region: 'cn', domain: 'b.com', news: [] },
    { id: 'c', name: 'C', region: 'cn', domain: 'c.com', news: [] },
    { id: 'd', name: 'D', region: 'intl', domain: 'd.com', news: [] },
    { id: 'e', name: 'E', region: 'intl', domain: 'e.com', news: [] },
    { id: 'f', name: 'F', region: 'intl', domain: 'f.com', news: [] },
  ],
};

test('validateData passes for valid data', () => {
  const result = validateData(validData);
  assert.equal(result.ok, true);
});

test('validateData rejects missing slug', () => {
  const data = { ...validData, slug: undefined };
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /slug/i);
});

test('validateData rejects too few companies', () => {
  const data = { ...validData, companies: validData.companies.slice(0, 5) };
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /at least 6 companies/i);
});

test('validateData rejects missing regions', () => {
  const data = JSON.parse(JSON.stringify(validData));
  data.companies[3].region = 'cn';
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /region/i);
});

test('validateData accepts 3 cn + 6 intl = 9 companies (semiconductor layout)', () => {
  const data = {
    slug: 'semi', prompt: 'semi', generated_at: '2026-06-24T00:00:00Z',
    companies: [
      { id: 'a', name: 'A', region: 'cn', domain: 'a.com', news: [] },
      { id: 'b', name: 'B', region: 'cn', domain: 'b.com', news: [] },
      { id: 'c', name: 'C', region: 'cn', domain: 'c.com', news: [] },
      { id: 'd', name: 'D', region: 'intl', domain: 'd.com', news: [] },
      { id: 'e', name: 'E', region: 'intl', domain: 'e.com', news: [] },
      { id: 'f', name: 'F', region: 'intl', domain: 'f.com', news: [] },
      { id: 'g', name: 'G', region: 'intl', domain: 'g.com', news: [] },
      { id: 'h', name: 'H', region: 'intl', domain: 'h.com', news: [] },
      { id: 'i', name: 'I', region: 'intl', domain: 'i.com', news: [] },
    ],
  };
  const result = validateData(data);
  assert.equal(result.ok, true);
});

test('validateData rejects when cn < 3', () => {
  const data = JSON.parse(JSON.stringify(validData));
  data.companies[0].region = 'intl';
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /at least 3 cn/i);
});

test('validateData rejects when intl < 3', () => {
  const data = JSON.parse(JSON.stringify(validData));
  data.companies[3].region = 'cn';
  data.companies[4].region = 'cn';
  data.companies[5].region = 'cn';
  const result = validateData(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /at least 3 intl/i);
});