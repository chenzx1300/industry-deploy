import { escapeHtml, formatDate, relativeTime } from '../lib/html-helpers.mjs';

const STYLES = `
:root {
  --bg: #fafaf8;
  --surface: #ffffff;
  --border: #e8e6e1;
  --text: #1a1a1a;
  --text-soft: #5a5a5a;
  --accent: #2563eb;
  --cn-tint: #dc2626;
  --intl-tint: #1e40af;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif;
  --font-serif: 'Source Serif Pro', 'Georgia', serif;
}
[data-theme="dark"] {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --border: #2a2a2a;
  --text: #e8e8e8;
  --text-soft: #a0a0a0;
  --accent: #60a5fa;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-sans); background: var(--bg); color: var(--text); line-height: 1.5; }
.container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
header h1 { font-family: var(--font-serif); font-size: 36px; font-weight: 600; margin-bottom: 8px; }
header .meta { color: var(--text-soft); font-size: 14px; }
header .meta strong { color: var(--text); }
.theme-toggle { position: absolute; top: 24px; right: 24px; background: none; border: 1px solid var(--border); padding: 6px 12px; border-radius: 4px; cursor: pointer; color: var(--text); font-size: 12px; }
.chip { display: inline-block; background: rgba(37, 99, 235, 0.1); color: var(--accent); padding: 4px 10px; border-radius: 12px; font-size: 12px; margin-bottom: 12px; }
nav.tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 24px 0 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); align-items: center; }
nav.tabs .region-label { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; padding: 0 8px; color: var(--text-soft); }
nav.tabs .region-divider { width: 1px; height: 20px; background: var(--border); margin: 0 8px; }
nav.tabs button { font-family: var(--font-serif); background: none; border: none; padding: 8px 16px; cursor: pointer; color: var(--text-soft); font-size: 15px; border-radius: 6px; transition: all 0.15s; }
nav.tabs button:hover { color: var(--text); background: var(--surface); }
nav.tabs button.active { color: var(--accent); background: var(--surface); font-weight: 600; }
main section { margin-bottom: 48px; }
main section h2 { font-family: var(--font-serif); font-size: 24px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
ul.news-list { list-style: none; }
li.news-item { padding: 16px 0; border-bottom: 1px solid var(--border); transition: padding-left 0.15s; }
li.news-item:hover { padding-left: 8px; }
li.news-item:hover .news-title { color: var(--accent); }
a.news-title { color: var(--text); text-decoration: none; font-size: 16px; font-weight: 600; display: block; margin-bottom: 6px; }
p.news-snippet { color: var(--text-soft); font-size: 14px; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
span.news-meta { color: var(--text-soft); font-size: 12px; }
.empty { color: var(--text-soft); font-style: italic; padding: 16px 0; }
footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--text-soft); font-size: 12px; text-align: center; }
.industry-grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 32px; }
.industry-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; transition: all 0.15s; }
.industry-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.industry-card a { display: block; padding: 20px; text-decoration: none; color: var(--text); }
.industry-card h3 { font-family: var(--font-serif); font-size: 20px; margin-bottom: 8px; }
.industry-card .stats { color: var(--text-soft); font-size: 13px; }
.industry-card time { display: block; color: var(--text-soft); font-size: 12px; margin-top: 8px; }
.empty-state { text-align: center; padding: 64px 24px; color: var(--text-soft); }
@media (max-width: 640px) {
  nav.tabs { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
  nav.tabs button { white-space: nowrap; }
  header h1 { font-size: 28px; }
}
`;

const SCRIPT = `
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.co;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('section[data-co]').forEach(s => s.hidden = s.dataset.co !== target);
    tab.classList.add('active');
    history.replaceState(null, '', '#' + target);
  });
});
window.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#', '');
  if (hash) {
    const tab = document.querySelector('.tab[data-co="' + hash + '"]');
    if (tab) tab.click();
  }
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.theme = theme;
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
});
`;

function pageShell(title, body, generatedAt) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
${body}
<script>${SCRIPT}</script>
</body>
</html>`;
}

export function renderIndustryPage(data) {
  const cn = data.companies.filter(c => c.region === 'cn');
  const intl = data.companies.filter(c => c.region === 'intl');
  const totalNews = data.companies.reduce((sum, c) => sum + c.news.length, 0);
  const now = new Date(data.generated_at);

  const tabsHtml = (companies) =>
    companies.map(c =>
      `<button class="tab" data-co="${escapeHtml(c.id)}">${escapeHtml(c.name)} · ${c.news.length}</button>`
    ).join('');

  const sectionsHtml = data.companies.map(c => `
    <section data-co="${escapeHtml(c.id)}"${c.id !== data.companies[0].id ? ' hidden' : ''}>
      <h2>${escapeHtml(c.name)}</h2>
      ${c.news.length === 0 ? '<p class="empty">No recent news found.</p>' : `<ul class="news-list">
        ${c.news.map(n => `
          <li class="news-item">
            <a class="news-title" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)} ↗</a>
            <p class="news-snippet">${escapeHtml(n.snippet)}</p>
            <span class="news-meta">${escapeHtml(n.source)} · ${formatDate(n.published_at)} · ${relativeTime(n.published_at, now)}</span>
          </li>
        `).join('')}
      </ul>`}
    </section>
  `).join('');

  const body = `
<div class="container">
  <button class="theme-toggle">🌓 Theme</button>
  <header>
    <span class="chip">industry</span>
    <h1>${escapeHtml(data.prompt)}</h1>
    <p class="meta"><strong>6 companies</strong> · ${totalNews} news items · generated ${formatDate(data.generated_at)}</p>
  </header>
  <nav class="tabs">
    <span class="region-label">🇨🇳 CHINA</span>
    ${tabsHtml(cn)}
    <span class="region-divider"></span>
    <span class="region-label">🌍 INTERNATIONAL</span>
    ${tabsHtml(intl)}
  </nav>
  <main>${sectionsHtml}</main>
  <footer>Sources: Google News · Generated ${formatDate(data.generated_at)} · For reference only</footer>
</div>`;

  return pageShell(data.prompt, body, data.generated_at);
}

export function renderHomepage(manifest) {
  const cards = manifest.industries.map(i => `
    <li class="industry-card">
      <a href="${escapeHtml(i.slug)}/">
        <h3>${escapeHtml(i.prompt)}</h3>
        <span class="stats">${i.company_count} companies · ${i.news_count} items</span>
        <time>${formatDate(i.generated_at)}</time>
      </a>
    </li>
  `).join('');

  const inner = manifest.industries.length === 0
    ? `<div class="empty-state">No industries yet. Run <code>npm run build -- "&lt;industry&gt;"</code> to generate one.</div>`
    : `<ul class="industry-grid">${cards}</ul>`;

  const body = `
<div class="container">
  <button class="theme-toggle">🌓 Theme</button>
  <header>
    <span class="chip">radar</span>
    <h1>Industry News Radar</h1>
    <p class="meta">Latest news from industry leaders. Generated locally.</p>
  </header>
  <main>${inner}</main>
  <footer>Generated locally · Source: Google News</footer>
</div>`;

  return pageShell('Industry News Radar', body, new Date().toISOString());
}