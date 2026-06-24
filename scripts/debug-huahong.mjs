// Debug: find article links in 华虹 news page
import { JSDOM } from 'jsdom';

const html = await fetch('https://huahonggrace.com/s/news.php?year=2026', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
}).then(r => r.text());

const dom = new JSDOM(html);
const doc = dom.window.document;
const links = doc.querySelectorAll('a[href]');
console.log('Total <a>:', links.length);
console.log('---');
for (const a of links) {
  const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
  const href = a.getAttribute('href');
  if (!text || !href) continue;
  if (text.length < 4) continue;
  if (href.startsWith('#') || href.match(/\.(jpg|png|css|js|ico)$/i)) continue;
  console.log('  [' + text.substring(0,60) + ']  ->  ' + href);
}