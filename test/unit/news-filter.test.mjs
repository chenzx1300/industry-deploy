import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyNews, isRelevantToCompany, filterNewsItems } from '../../src/lib/news-filter.mjs';

test('isLikelyNews: rejects bare navigation labels', () => {
  assert.equal(isLikelyNews('News'), false);
  assert.equal(isLikelyNews('Press Release'), false);
  assert.equal(isLikelyNews('Press images'), false);
  assert.equal(isLikelyNews('Media kit'), false);
  assert.equal(isLikelyNews('Our Businesses'), false);
  assert.equal(isLikelyNews('Investor Relations'), false);
  assert.equal(isLikelyNews('SEC Filings Details'), false);
  assert.equal(isLikelyNews('About'), false);
  assert.equal(isLikelyNews('Contact'), false);
});

test('isLikelyNews: rejects "X - Company" nav headers', () => {
  assert.equal(isLikelyNews('News - Hexcel'), false);
  assert.equal(isLikelyNews('Press Release - SGL Carbon'), false);
  assert.equal(isLikelyNews('Investor Relations - Toray'), false);
  assert.equal(isLikelyNews('SEC Filings - Hexcel Corp.'), false);
});

test('isLikelyNews: rejects ALL-CAPS policy/legal titles', () => {
  assert.equal(isLikelyNews('HEXCEL SUPPLIER CODE OF CONDUCT - Hexcel'), false);
  assert.equal(isLikelyNews('CORPORATE POLICY POLICY No. 1.11 Subject: Human Rights - Hexcel'), false);
  assert.equal(isLikelyNews('UK MODERN SLAVERY ACT STATEMENT CALIFORNIA TRANSPARENCY IN SUPPLY CHAINS ACT STATEMENT - Hexcel'), false);
});

test('isLikelyNews: accepts real English news with action verbs', () => {
  assert.equal(isLikelyNews('Toray to Set Up TORELINA PPS Resin Production Facility in India - Toray'), true);
  assert.equal(isLikelyNews('Deutsche Aircraft and Hexcel Announce Long-Term Composite Partnership for the D328eco Regional Aircraft Programme - Hexcel'), true);
  assert.equal(isLikelyNews('SGL Carbon commissions photovoltaic system and lays the foundation for a new nitrogen plant at its Meitingen site - SGL Carbon'), true);
  assert.equal(isLikelyNews('Toray Composite Materials America and Syensqo Enter into Long-Term Carbon Fiber Supply Agreement for Aerospace Applications - Toray'), true);
});

test('isLikelyNews: accepts real Chinese news with action verbs', () => {
  assert.equal(isLikelyNews('中复神鹰发布全球首款高强高模型碳纤维产品 - 搜狐'), true);
  assert.equal(isLikelyNews('光威复材：4月30日融券卖出5900股，融资融券余额10.81亿元 - MSN'), true);
  assert.equal(isLikelyNews('全省首个、国家电网区域内首个园区类源网荷储一体化项目在威海建成 - 碳索储能网'), true);
});

test('isLikelyNews: rejects generic company landing pages', () => {
  // No action verb, even though length is OK
  assert.equal(isLikelyNews('Toray Industries, Inc. - Toray'), false);
  assert.equal(isLikelyNews('SGL Carbon SE - SGL Carbon'), false);
});

test('isLikelyNews: rejects empty / very short titles', () => {
  assert.equal(isLikelyNews(''), false);
  assert.equal(isLikelyNews('News today'), false);
});

test('isRelevantToCompany: matches by brand token', () => {
  assert.equal(isRelevantToCompany('中复神鹰发布全球首款高强高模型碳纤维产品', '中复神鹰 Sinofibers'), true);
  assert.equal(isRelevantToCompany('恒神股份突破在即 - 财富号', '中复神鹰 Sinofibers'), false);
  assert.equal(isRelevantToCompany('Toray to Set Up Production Facility', 'Toray Industries'), true);
  assert.equal(isRelevantToCompany('Hexcel announces composite partnership', 'Hexcel Corp'), true);
  assert.equal(isRelevantToCompany('Some random article title', 'Hexcel Corp'), false);
});

test('isRelevantToCompany: handles multi-word brand', () => {
  // For "SGL Carbon", the longest token "Carbon" is generic — but "SGL Carbon" as brand should still match
  assert.equal(isRelevantToCompany('SGL Carbon commissions photovoltaic system', 'SGL Carbon SE'), true);
  assert.equal(isRelevantToCompany('Hexcel Reports 2026 First Quarter Results', 'Hexcel Corp'), true);
});

test('isRelevantToCompany: passes through when no brand tokens extractable', () => {
  // If companyName is empty, no filtering
  assert.equal(isRelevantToCompany('Some random article', ''), true);
  assert.equal(isRelevantToCompany('Some random article', null), true);
});

test('filterNewsItems: end-to-end filtering', () => {
  const items = [
    { title: 'News - Hexcel' },                                         // bad: bare label
    { title: 'HEXCEL SUPPLIER CODE OF CONDUCT - Hexcel' },              // bad: policy
    { title: 'Deutsche Aircraft and Hexcel Announce Long-Term Composite Partnership' }, // good
    { title: 'Some random article unrelated to anything' },             // bad: no company
    { title: 'Hexcel Reports 2026 First Quarter Results' },             // good
    { title: '恒神股份突破在即 - 财富号' },                                  // bad: wrong company (for 中复神鹰)
  ];
  const filtered = filterNewsItems(items, 'Hexcel Corp');
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].title.startsWith('Deutsche'), true);
  assert.equal(filtered[1].title.startsWith('Hexcel Reports'), true);
});

test('filterNewsItems: filters by Chinese company name', () => {
  const items = [
    { title: '中复神鹰发布全球首款高强高模型碳纤维产品' },
    { title: '光威复材：打造碳纤维产业新脊梁' },     // not about 中复神鹰
    { title: '恒神股份突破在即' },                     // not about 中复神鹰
    { title: '碳纤维还得降' },                          // not specifically about 中复神鹰
  ];
  const filtered = filterNewsItems(items, '中复神鹰 Sinofibers');
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title, /中复神鹰/);
});
