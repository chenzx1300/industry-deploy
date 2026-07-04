#!/usr/bin/env node
// 奇鋐科技 AVC (TSE: 3017) refill: 10 news items from DNN module grid at
// https://www.avc.co/zh-cn/最新消息 (moduleID=1340, jqgrid table #jqgWhatsNews).
//
// Approved news_url (set 2026-07-04 by user — replaced the empty avc.com.tw/news):
//   https://www.avc.co/zh-cn/最新消息
//
// Article URL pattern:
//   https://www.avc.co/zh-cn/最新消息/<WhatsNewsID>     (e.g. 202606-000001)
//
// The grid is server-rendered (data injected as clientArray on the listing page).
// However avc.co sits behind Imperva Incapsula — bot/cURL is blocked with a 212-byte
// challenge page, so the actual listing HTML can only be obtained via a real browser.
// Once extracted, the news items are hardcoded here (same model as all other refill-v1).
//
// Items 1-10 = top 10 by ReleaseDate desc. All 31 entries verified 2026-07-04
// via Chrome MCP.

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
let c = null;
for (const ind of data.industries) {
  const hit = (ind.companies || []).find(x => x.id === 'avctw');
  if (hit) { c = hit; break; }
}
if (!c) throw new Error('AVCTW not found in industries.json');

const now = new Date().toISOString();

// news_url updated from the empty avc.com.tw/news (DNN shell) to the populated
// avc.co/zh-cn/最新消息 listing per user confirmation on 2026-07-04.
c.news_url = 'https://www.avc.co/zh-cn/最新消息';

// Top 10 most-recent items, hardcoded.
const AVC_NEWS = [
  { date: '2026-06-22', id: '202606-000001', title: '奇鋐科技以優異的經營績效，持續推動ESG永續發展各項工作，再次經篩選自2026年6月起納入「臺灣永續指數」成分股並得使用「臺灣永續指數專屬標章」' },
  { date: '2026-05-21', id: '202605-000001', title: '與供應商開展氣候層面合作，奇鋐科技榮獲CDP 2025供應商合作評估（SEA）頂級A評分' },
  { date: '2025-12-24', id: '202512-000001', title: 'AVC 以優異的經營績效，再次納入「臺灣永續指數」成分股並獲得「臺灣永續指數專屬標章」' },
  { date: '2025-09-30', id: '202509-000001', title: '奇鋐公司獲頒2025年外資百強第六名' },
  { date: '2025-07-01', id: '202507-000001', title: 'AVC 連續第2年納入「臺灣永續指數」成分股並獲得「臺灣永續指數專屬標章」' },
  { date: '2025-05-26', id: '202505-000005', title: 'AVC榮獲2025年聯想全球供應商大會所頒發之鑽石獎' },
  { date: '2025-04-21', id: '202504-000001', title: '奇鋐科技於2025年取得健康職場認證健康促進標章認證標章' },
  { date: '2024-11-22', id: '202411-000001', title: '東莞明鑫通過SBTi審核' },
  { date: '2024-10-22', id: '202410-000001', title: '2024年10月18日奇鋐科技參加玉山銀行「 玉山ESG永續倡議行動 」' },
  { date: '2024-09-26', id: '202409-000002', title: '奇鋐公司獲頒外資百強前十名' },
];

c.news = AVC_NEWS.map(n => ({
  title: n.title,
  url: `https://www.avc.co/zh-cn/最新消息/${n.id}`,
  snippet: '',
  published_at: n.date + 'T00:00:00Z',
  fetched_at: now,
  source: 'avc.co',
}));

c.fallback_news = [];

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('AVCTW news after refill:', c.news.length);
console.log('  news_url:', c.news_url);
for (const n of c.news) console.log(' ', n.published_at.slice(0, 10), '|', n.title);