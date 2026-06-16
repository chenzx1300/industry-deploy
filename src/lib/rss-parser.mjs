import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export function parseGoogleNewsRss(xmlString) {
  let parsed;
  try {
    parsed = parser.parse(xmlString);
  } catch {
    return [];
  }
  const channel = parsed?.rss?.channel;
  if (!channel) return [];
  const rawItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
  const items = [];
  for (const raw of rawItems) {
    const title = (raw.title || '').toString().trim();
    const url = (raw.link || '').toString().trim();
    if (!title || !url) continue;
    const sourceUrl = raw.source?.['@_url'] || url;
    let source;
    try {
      source = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      source = 'unknown';
    }
    const pubDate = raw.pubDate ? new Date(raw.pubDate) : null;
    const published_at = pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : new Date().toISOString();
    items.push({
      title,
      snippet: (raw.description || '').toString().trim(),
      url,
      source,
      published_at,
    });
  }
  items.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return items;
}