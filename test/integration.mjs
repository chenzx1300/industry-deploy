import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSlug } from '../src/pipeline/slugify.mjs';
import { searchIndustry } from '../src/pipeline/search.mjs';
import { identifyCompanies } from '../src/pipeline/identify.mjs';
import { fetchNewsForCompanies } from '../src/pipeline/fetch-news.mjs';
import { renderIndustryPage, renderHomepage } from '../src/pipeline/render.mjs';
import { validateData } from '../src/pipeline/validate.mjs';
import { addToManifest, loadManifest } from '../src/pipeline/manifest.mjs';

const RSS_XML = `<?xml version="1.0"?><rss><channel>
  <item><title>Test news 1</title><link>https://example.com/1</link><pubDate>Sun, 15 Jun 2026 08:00:00 GMT</pubDate><description>Snippet 1</description></item>
  <item><title>Test news 2</title><link>https://example.com/2</link><pubDate>Sat, 14 Jun 2026 08:00:00 GMT</pubDate><description>Snippet 2</description></item>
</channel></rss>`;

const COMPANIES = [
  { id: 'a', name: 'A', region: 'cn', domain: 'a.com', slug: 'a' },
  { id: 'b', name: 'B', region: 'cn', domain: 'b.com', slug: 'b' },
  { id: 'c', name: 'C', region: 'cn', domain: 'c.com', slug: 'c' },
  { id: 'd', name: 'D', region: 'intl', domain: 'd.com', slug: 'd' },
  { id: 'e', name: 'E', region: 'intl', domain: 'e.com', slug: 'e' },
  { id: 'f', name: 'F', region: 'intl', domain: 'f.com', slug: 'f' },
];

test('full pipeline produces valid data, manifest, and HTML', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'pipeline-'));
  try {
    // 1. slugify
    const slug = buildSlug('electric vehicles');
    assert.equal(slug, 'electric-vehicles-industry');

    // 2. search (mocked)
    const tavilyResults = await searchIndustry('electric vehicles', {
      apiKey: 'test',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ results: [{ title: 't', content: 'c', url: 'https://x' }] }) }),
    });
    assert.ok(tavilyResults.results.length > 0);

    // 3. identify (mocked)
    const identified = await identifyCompanies('electric vehicles', tavilyResults, {
      client: { messages: { create: async () => ({ content: [{ type: 'tool_use', name: 'return_companies', input: { companies: COMPANIES } }] }) } },
    });
    assert.equal(identified.companies.length, 6);

    // 4. fetch news (mocked)
    const withNews = await fetchNewsForCompanies(identified.companies, {
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => RSS_XML }),
    });
    const totalNews = withNews.reduce((s, c) => s + c.news.length, 0);
    assert.equal(totalNews, 12); // 2 items × 6 companies

    // 5. validate
    const data = {
      slug,
      prompt: 'electric vehicles',
      generated_at: new Date().toISOString(),
      companies: withNews,
    };
    const v = validateData(data);
    assert.equal(v.ok, true);

    // 6. manifest
    await addToManifest(tmpDir, {
      slug,
      prompt: 'electric vehicles',
      company_count: 6,
      news_count: totalNews,
      generated_at: data.generated_at,
    });
    const manifest = await loadManifest(tmpDir);
    assert.equal(manifest.industries.length, 1);
    assert.equal(manifest.industries[0].news_count, 12);

    // 7. render
    const industryHtml = renderIndustryPage(data);
    const homepageHtml = renderHomepage(manifest);
    assert.match(industryHtml, /electric-vehicles-industry|electric vehicles/);
    assert.match(homepageHtml, /electric vehicles/);
    assert.match(homepageHtml, /12 items/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
