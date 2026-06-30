#!/usr/bin/env node
// Fix Bosom order: restore original dates from knowledge base, sort desc.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/thermal-materials-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'bosom');

const KNOWN = {
  'https://www.bosomchina.com/news_detail/id-178.html': {
    title: '本松新材与浙江大学联合培养博士后开题审核顺利举行',
    date: '2025-09-08T00:00:00Z',
  },
  'https://www.bosomchina.com/news_detail/id-177.html': {
    title: '企业互访，共结纽带 ——施耐德电气与本松新材商讨合作路径',
    date: '2025-08-20T00:00:00Z',
  },
  'https://www.bosomchina.com/news_detail/id-176.html': {
    title: '本松新材新能源汽车电驱逆变器模块轻量化项目启动',
    date: '2025-06-19T00:00:00Z',
  },
};

for (const n of c.news) {
  const k = KNOWN[n.url];
  if (k) {
    n.title = k.title;
    n.published_at = k.date;
  }
}

// Sort desc by date
c.news.sort((a, b) => b.published_at.localeCompare(a.published_at));

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Bosom fixed. New order:');
for (const n of c.news) console.log('  ', n.published_at.slice(0, 10), n.title);