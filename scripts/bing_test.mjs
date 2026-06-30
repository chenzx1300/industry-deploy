import { fetchBingNews } from '../src/lib/bing-news.mjs';
const queries = ['MacLean-Fogg Company', 'MacLean Power Systems news', 'MacLean-Fogg press release'];
for (const q of queries) {
  try {
    const r = await fetchBingNews(q, { maxResults: 15 });
    console.log('--- ' + q + ' (' + r.length + ' items) ---');
    for (const x of r.slice(0, 5)) console.log('  -', x.title?.slice(0, 80), '|', x.url?.slice(0, 60));
  } catch(e) { console.log(q, ':', e.message); }
}
