import { parseGoogleNewsRss } from '../lib/rss-parser.mjs';
import { filterNewsItems } from '../lib/news-filter.mjs';

const BASE = 'https://news.google.com/rss/search';

// Google News RSS often returns navigation/listing pages and off-topic items in the
// top results. We over-fetch then filter to keep the most relevant N per company.
const OVER_FETCH_MULTIPLIER = 3;

function buildRssUrl(domain, { hl = 'en-US', gl = 'US', ceid = 'US:en' } = {}) {
  const params = new URLSearchParams({ q: `site:${domain}`, hl, gl, ceid });
  return `${BASE}?${params}`;
}

export async function fetchNewsForCompanies(companies, { fetchImpl = globalThis.fetch, maxItems = 8 } = {}) {
  const results = await Promise.all(companies.map(async (company) => {
    try {
      const fetchSize = maxItems * OVER_FETCH_MULTIPLIER;
      const res = await fetchImpl(buildRssUrl(company.domain));
      if (!res.ok) return { ...company, news: [] };
      const xml = await res.text();
      const allItems = parseGoogleNewsRss(xml).slice(0, fetchSize);
      const filtered = filterNewsItems(allItems, company.name).slice(0, maxItems);
      return { ...company, news: filtered };
    } catch {
      return { ...company, news: [] };
    }
  }));
  return results;
}

export { buildRssUrl };
