#!/usr/bin/env node
// Append NEV motor (新能源汽车电机) industry block to data/industries.json.
// 12 companies: 4 CN (Inovance, JJ Electric, CRRC Times Electric, Founder Motor)
// + 8 INTL (Nidec, ZF, BorgWarner, Magna, Bosch, Continental, Aisin, Hitachi Astemo).
// All news[] arrays empty — refill-*.mjs scripts populate them.
//
// Run: node scripts/add-nev-motor-industry.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const fp = 'data/industries.json';
const data = JSON.parse(readFileSync(fp, 'utf-8'));

const NEV_MOTOR_COMPANIES = [
  // ZF removed 2026-07-10: zf.com entire domain returns S3 AccessDenied XML,
  // no working news source. The 12 → 11 NEV motor industries still meet the
  // validator (≥6 industries, ≥3 CN, ≥3 INTL).
  { id: 'nidec',          name: '尼得科 Nidec',                  region: 'intl', domain: 'nidec.com',          monogram: '尼', monogram_color: '#dc2626', news_url: 'https://www.nidec.com/en/corporate/news/' },
  { id: 'borgwarner',     name: '博格华纳 BorgWarner',           region: 'intl', domain: 'borgwarner.com',     monogram: '博', monogram_color: '#ea580c', news_url: 'https://www.borgwarner.com/newsroom/press-releases' },
  { id: 'magna',          name: '麦格纳 Magna International',    region: 'intl', domain: 'magna.com',          monogram: '麦', monogram_color: '#16a34a', news_url: 'https://www.magna.com/newsroom/news' },
  { id: 'bosch',          name: '博世 Bosch',                    region: 'intl', domain: 'bosch.com',          monogram: '世', monogram_color: '#7c2d12', news_url: 'https://www.bosch.com/research/news/' },
  { id: 'continental',    name: '大陆集团 Continental',          region: 'intl', domain: 'continental.com',    monogram: '陆', monogram_color: '#b91c1c', news_url: 'https://www.aumovio.com/en/company/press/press-releases.html' },
  { id: 'aisin',          name: '爱信 Aisin',                    region: 'intl', domain: 'aisin.com',          monogram: '爱', monogram_color: '#c2410c', news_url: 'https://www.aisin.com/en/news/2026/' },
  { id: 'hitachi-astemo', name: '日立安斯泰莫 Hitachi Astemo',   region: 'intl', domain: 'astemo.com',         monogram: '日', monogram_color: '#be185d', news_url: 'https://www.astemo.com/en/news/' },
  { id: 'inovance',       name: '汇川技术 Inovance',             region: 'cn',   domain: 'inovance.com',       monogram: '汇', monogram_color: '#4f46e5', news_url: 'https://www.inovance.com/news' },
  { id: 'jjelectric',     name: '精进电动 JJ Electric',          region: 'cn',   domain: 'jjecn.com',          monogram: '精', monogram_color: '#0891b2', news_url: 'http://www.jjecn.com' },
  { id: 'crrc-tel',       name: '中车时代电气 CRRC Times Electric', region: 'cn', domain: 'tec.crrczic.cc',    monogram: '车', monogram_color: '#65a30d', news_url: 'https://www.tec.crrczic.cc' },
  { id: 'founder',        name: '方正电机 Founder Motor',        region: 'cn',   domain: 'fdm.com.cn',         monogram: '方', monogram_color: '#a16207', news_url: 'http://www.fdm.com.cn' },
].map(c => ({ ...c, news: [], fallback_news: [] }));

const newIndustry = {
  slug: 'new-energy-vehicle-motor-industry',
  prompt: '新能源汽车电机',
  companies: NEV_MOTOR_COMPANIES,
};

// Check if already exists
if (data.industries.some(i => i.slug === newIndustry.slug)) {
  console.log(`Industry ${newIndustry.slug} already exists — overwriting.`);
  data.industries = data.industries.map(i => i.slug === newIndustry.slug ? newIndustry : i);
} else {
  data.industries.push(newIndustry);
}

writeFileSync(fp, JSON.stringify(data, null, 2));
console.log(`\nNow ${data.industries.length} industries total.`);
console.log(`Appended ${newIndustry.slug}: ${NEV_MOTOR_COMPANIES.length} companies (empty news).`);
console.log('Companies:');
for (const c of NEV_MOTOR_COMPANIES) console.log(`  ${c.region.padEnd(4)} ${c.id.padEnd(16)} ${c.monogram}  ${c.name}`);