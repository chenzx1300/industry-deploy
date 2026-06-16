import { parseGoogleNewsRss } from '../lib/rss-parser.mjs';

const BASE = 'https://news.google.com/rss/search';

function buildRssUrl(domain) {
  const params = new URLSearchParams({
    q: `site:${domain}`,
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en',
  });
  return `${BASE}?${params}`;
}

export async function fetchNewsForCompanies(companies, { fetchImpl = globalThis.fetch, maxItems = 8 } = {}) {
  const results = await Promise.all(companies.map(async (company) => {
    try {
      const res = await fetchImpl(buildRssUrl(company.domain));
      if (!res.ok) return { ...company, news: [] };
      const xml = await res.text();
      const items = parseGoogleNewsRss(xml).slice(0, maxItems);
      return { ...company, news: items };
    } catch {
      return { ...company, news: [] };
    }
  }));
  return results;
}
