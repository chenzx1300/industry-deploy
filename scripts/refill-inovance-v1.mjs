#!/usr/bin/env node
// Inovance (汇川技术, SZ:300124) — 10 corp-site items via Chrome MCP.
// Source: https://www.inovance.com/portal/news/list?typeId=1 (page 1).
// Verified corp site renders fully in Chrome (was thought to be JS shell —
// it loads all 10 items on initial page render).
// Per user 2026-07-11: Inovance also exempt from no-WeChat rule (mp.weixin.qq.com
// links accepted alongside corp site + newweb.inovance.com PDF links).
// All 10 items fetched 2026-07-11. Top 10 by published_at desc.
import { readFileSync, writeFileSync } from 'node:fs';
const fp = 'data/new-energy-vehicle-motor-industry.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));
const c = data.companies.find(x => x.id === 'inovance');
const now = new Date().toISOString();
c.news_url = 'https://www.inovance.com/portal/news/list?typeId=1';
const N = [
  ['2026-07-03T13:58:25', 'https://mp.weixin.qq.com/s/30Xc8cE4dYZvI--_OwJ8iA', '共建产业标准新生态 | 汇川斩获ICA五项行业大奖，携全栈数自平台登陆AMTS 2026'],
  ['2026-04-08T09:15:49', 'https://mp.weixin.qq.com/s/I5YodZGgTlS2kK1avUUTRA', '无论多远，我们一直都在｜汇川技术《WE CARE》全球服务系列故事，即将上线'],
  ['2026-03-30T15:43:34', 'https://newweb.inovance.com/owfile/upload/other/2026/03/27/cf2a4dc1-810f-42ab-9805-8d2a15caa0ca.pdf', '关于汇川技术驱动系统产品价格调整的通知'],
  ['2026-03-30T15:42:55', 'https://newweb.inovance.com/owfile/upload/other/2026/03/27/e7ffc0ce-6833-43c9-bfd7-a1bd406e8219.pdf', '关于汇川技术控制系统产品价格调整的通知'],
  ['2026-03-30T15:40:45', 'https://mp.weixin.qq.com/s/5npOg3zqpOkkv5Ixlx3Vzg', '关于汇川技术部分产品价格调整的通知'],
  ['2026-03-30T15:32:26', 'https://mp.weixin.qq.com/s/LrkyWK8v95sndbSbSmcHvA', '关于汇川技术机器人产品价格调整的通知'],
  ['2026-03-10T09:14:20', 'https://mp.weixin.qq.com/s/-DldSug55zAmGUoK3Qxo-w', '协同创新，面向未来 | 中国WiTSnet标准获国际广泛认可，赋能全球智能制造'],
  ['2026-03-03T18:01:05', 'https://mp.weixin.qq.com/s/Sd30dDUEyuzVpzRr7PQxaw', '灵活无界 效率领跑！灵汐·InoLynx全时交直流一体PCS全球首发'],
  ['2026-02-03T15:02:21', 'https://mp.weixin.qq.com/s/2FNlUeBEqobpo7GnugWacg', '汇川技术与拓日新能签署战略合作协议，以光储融合引领零碳建设'],
  ['2026-02-02T09:04:16', 'https://mp.weixin.qq.com/s/nJeBByJ7qVEU4nRz3QjEdw', '场景·精度·愿力丨汇川技术董事长朱兴明2026年度演讲实录'],
];
c.news = N.map(([d, url, t]) => ({
  title: t,
  url,
  snippet: '',
  published_at: d + (d.endsWith('Z') ? '' : 'Z'),
  fetched_at: now,
  source: url.includes('weixin.qq.com') ? 'mp.weixin.qq.com' : 'inovance.com',
}));
c.fallback_news = [];
writeFileSync(fp, JSON.stringify(data, null, 2));
console.log('Inovance news after refill:', c.news.length);
for (const n of c.news) console.log(' ', n.published_at.slice(0,19), '|', n.title);
