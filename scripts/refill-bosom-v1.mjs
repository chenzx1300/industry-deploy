#!/usr/bin/env node
// Bosom (本松新材 / 杭州本松新材料技术股份有限公司) refill: bosomchina.com/news/typeid-31.html
// Article URL pattern: /news_detail/id-<id>.html
//
// Bosom is NOT publicly traded (no cninfo orgId for "本松" or "杭州本松新材料" —
// the ticker 688603 used to be mistakenly assigned to Bosom but is actually Skychem).
// Therefore cninfo fallback does NOT apply. We use ONLY official site content.
//
// Critical filter: the news list has 4 categories on the site:
//   - 公司新闻 (typeid-31)   — REAL business news ✓
//   - 展会动态 (typeid-32)   — trade show invitations (NOT news) ✗
//   - 团队生活 (typeid-34)   — internal team life (NOT news) ✗
//   - 公示     (typeid-43)   — public notices (real news) ✓
//
// (NB: the site's category filter is broken — items from all categories appear
// on the typeid-31 page; we manually filter by title/content instead.)
//
// Removed in this revision:
//   - id-175 (2024 ALE邀请函 / 2024-06-24) — trade-show invitation (展会动态)
//
// Replacements sourced from pages 2-5 of /news/typeid-31.html:
//   - id-173 (2024/04/24) — 龙泉研究院 R&D 中心 (real news)
//   - id-169 (2024/01/04) — AACS 战略合作伙伴
//   - id-166 (2023/12/15) — 新沪屏蔽泵 客户拜访
//   - id-163 (2023/12/06) — 安工程&本松以塑代钢研究院挂牌
//   - id-162 (2023/11/01) — 第二个 CNAS 认可实验室
//   - id-161 (2023/09/16) — 龙泉副市长调研
//   - id-160 (2023/03/10) — 浙江省科技进步奖提名（公示）

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'bosom');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('Bosom not found in industries.json');

const now = new Date().toISOString();

// 10 real business news items, sorted desc by date
const BOSOM_NEWS = [
  { date: '2025-09-08', title: '本松新材与浙江大学联合培养博士后开题审核顺利举行', url: 'https://www.bosomchina.com/news_detail/id-178.html' },
  { date: '2025-08-20', title: '企业互访，共结纽带 ——施耐德电气与本松新材商讨合作路径', url: 'https://www.bosomchina.com/news_detail/id-177.html' },
  { date: '2025-06-19', title: '本松新材新能源汽车电驱逆变器模块轻量化项目启动', url: 'https://www.bosomchina.com/news_detail/id-176.html' },
  { date: '2024-04-24', title: '龙泉创业创新研究院•本松新材成立热管理系统联合研发中心', url: 'https://www.bosomchina.com/news_detail/id-173.html' },
  { date: '2024-01-04', title: '本松新材荣结AACS战略合作伙伴', url: 'https://www.bosomchina.com/news_detail/id-169.html' },
  { date: '2023-12-15', title: '随着新沪的节奏"泵"发——本松新材拜访新沪屏蔽泵', url: 'https://www.bosomchina.com/news_detail/id-166.html' },
  { date: '2023-12-06', title: '安工程&本松新材·汽车与航空领域以塑代钢产业化技术研究院挂牌', url: 'https://www.bosomchina.com/news_detail/id-163.html' },
  { date: '2023-11-01', title: '喜获第二个CNAS认可实验室', url: 'https://www.bosomchina.com/news_detail/id-162.html' },
  { date: '2023-09-16', title: '龙泉副市长金伟君等领导一行莅临本松新材调研指导', url: 'https://www.bosomchina.com/news_detail/id-161.html' },
  { date: '2023-03-10', title: '关于拟提名2022年度浙江省科学技术进步奖项目的公示', url: 'https://www.bosomchina.com/news_detail/id-160.html' },
];

c.news = BOSOM_NEWS.map(n => ({
  title: n.title,
  url: n.url,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'bosomchina.com',
}));

// Clear stale fallback_news (was 4 items incl. the 展会动态 id-175)
c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Bosom news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);
