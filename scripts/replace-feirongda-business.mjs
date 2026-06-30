#!/usr/bin/env node
// Replace Feirongda cninfo stock announcements with business news from official frd.cn site.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SLUG = 'thermal-materials-industry';
const COMPANY_ID = 'feirongda';
const BASE = 'https://www.frd.cn/news_view.aspx?TypeId=4&Id=';
const PARAMS = '&Fid=t2:4:2';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

async function fetchMeta(id) {
  const url = `${BASE}${id}${PARAMS}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Date in YYYY-MM-DD format
    const dm = html.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dm ? dm[1] : null;
    // Snippet from meta description
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    let snippet = md ? md[1].trim() : '';
    // Fallback: first paragraph
    if (!snippet) {
      const p = html.match(/<div[^>]+class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (p) snippet = p[1].replace(/<[^>]+>/g, '').trim().slice(0, 250);
    }
    // Limit length
    snippet = snippet.slice(0, 250);
    return { id, url, date, snippet };
  } catch { return null; }
}

const ARTICLES = [
  { id: 840, title: '飞荣达控股具身智能子公司——果力智能乔迁新址' },
  { id: 839, title: '飞荣达携手果力智能参与灵巧手国家标准闭门起草研讨会' },
  { id: 838, title: '全国电磁屏蔽材料标准化技术委员会2025年年会在深圳成功召开' },
  { id: 837, title: '京东工业与飞荣达等10家机器人零部件企业签署战略合作' },
  { id: 836, title: '飞荣达出席 2025 中国电磁兼容大会' },
  { id: 835, title: '飞荣达参与起草的两项国家标准正式发布' },
  { id: 834, title: '第五届热管理大会成功举办，飞荣达技术总监罗梅博士应邀演讲' },
  { id: 833, title: '导电橡胶新产品——大压缩量屏蔽橡胶' },
  { id: 832, title: '2024年度飞荣达结构件供应商质量大会圆满落幕' },
  { id: 831, title: '飞荣达喜获PCT专利美国发明授权' },
  { id: 829, title: '飞荣达实验中心新增检测能力' },
];

async function main() {
  const fp = join('data', `${SLUG}.json`);
  const data = JSON.parse(readFileSync(fp, 'utf-8'));
  const c = data.companies.find(x => x.id === COMPANY_ID);
  if (!c) { console.error('not found'); process.exit(1); }

  console.log(`▸ ${c.name}: ${c.news.length} current items`);

  const now = new Date().toISOString();
  const fetched = [];
  for (const a of ARTICLES) {
    const meta = await fetchMeta(a.id);
    if (!meta || !meta.date) {
      console.log(`  ⚠ ID ${a.id}: no date, skip`);
      continue;
    }
    if (!meta.snippet) meta.snippet = `飞荣达${a.title}。`;
    fetched.push({
      title: a.title,
      url: meta.url,
      snippet: meta.snippet,
      published_at: meta.date + 'T00:00:00Z',
      fetched_at: now,
      source: 'frd.cn',
    });
    console.log(`  ✓ [${meta.date}] ${a.title}`);
    console.log(`    S: ${meta.snippet.slice(0, 80)}`);
  }

  c.news = fetched.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, 10);
  writeFileSync(fp, JSON.stringify(data, null, 2));

  console.log(`\n✓ Feirongda: ${c.news.length} business news from frd.cn`);
  const srcCount = {};
  c.news.forEach(n => { srcCount[n.source] = (srcCount[n.source] || 0) + 1; });
  console.log('  Sources:', srcCount);
  for (const n of c.news) {
    console.log(`  [${n.published_at.slice(0,10)}] ${n.title.slice(0,55)}`);
  }
}

main().catch(err => { console.error('✗', err); process.exit(1); });