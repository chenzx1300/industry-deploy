// Debug: find article links on NVIDIA news page
import { JSDOM } from 'jsdom';

const html = await fetch('https://nvidianews.nvidia.com/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
}).then(r => r.text());

const dom = new JSDOM(html);
const root = dom.window.document.querySelector('main, article') || dom.window.document.body;
const links = root.querySelectorAll('a[href]');
for (const a of links) {
  const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
  const href = a.getAttribute('href');
  if (!text || !href) continue;
  if (text.length < 20) continue;
  if (href.match(/\.(jpg|png|css|js|ico)$/i)) continue;
  if (href.startsWith('#')) continue;
  if (href.match(/\/(about|contact|privacy|terms|legal|search|category|tag)\b/i)) continue;
  console.log('  [' + text.substring(0,80) + ']');
  console.log('    ' + href);
}