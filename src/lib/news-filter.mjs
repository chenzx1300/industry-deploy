// News quality filter: rejects navigation pages, listing pages, policy/legal pages,
// and items not actually about the target company.

const BAD_TITLE_PATTERNS = [
  // Bare section labels
  /^news$/i,
  /^press release$/i,
  /^press releases$/i,
  /^press image(s)?$/i,
  /^press kit$/i,
  /^media( kit)?$/i,
  /^our (businesses|company|products|solutions|services|team|approach|history)$/i,
  /^about( us)?$/i,
  /^contact( us)?$/i,
  /^investor relations$/i,
  /^sec filings( details)?$/i,

  // Policy / legal
  /code of conduct/i,
  /policy\s*no\.?\s*\d+/i,
  /modern slavery act/i,
  /transparency in supply chains/i,
  /human rights policy/i,
  /california transparency/i,

  // "Press Release / News - Company" header shape
  /^press release\s*[-:]/i,
  /^press releases?\s*[-:]/i,
  /^news\s*[-:]/i,
  /^sec filings\s*[-:]/i,
  /^investor relations\s*[-:]/i,
];

// Action verbs (English) commonly found in news headlines.
const ENGLISH_VERBS = /\b(launch|set|develop|report|receive|sign|announce|complete|expand|partner|join|appoint|release|invest|acquire|open|close|merge|raise|file|issue|approve|pass|win|begin|start|build|design|reveal|introduce|unveil|test|hit|add|create|deliver|supply|order|ship|grant|fund|earn|host|reach|secure|certify|commission|enter|include|feature|bring|name|pick|tap|hire|fire|topple|halt|resume|delay|return|plan|aim|seek|mull|consider|break|attend|exhibit|showcase|highlight|present|hold|post|grow|fell|cut|drop|rise|fall|log|cite|nominate|sell|buy|pay|cost|see|look|note|say|tell|speak|finds|gets|takes|makes|put|give|comes|goes|stands|proves|leads|moves|turns|tracks|faces|tops|misses|warns|calls|backs|claims|wants|needs|keeps|maintains|extends|says|notes|states|tells|argues|suggests|offers|provides|confirms|denies|discloses|admits|inaugurate|inaugurates|inaugurated|restructure|restructures|restructured|decide|decides|decided|elect|elects|elected|adopt|adopts|adopted|launched|deployed|deals|deal|shift|shifts|topped|topping|sets|set|setto|priced|prices|pricedat|valued|values|expects|expect|elected|crowned|launched|cuts|cut|came|gone|grew|grow|gone|became|becomes)/i;

// Action verbs (Chinese) commonly found in Chinese news headlines.
const CHINESE_VERBS = /(发布|推出|签署|完成|收购|投产|合作|获得|宣布|成为|突破|增长|减少|签约|启动|终止|下线|交付|上线|任命|选举|达成|成立|开业|扩建|上市|融资|募集|入股|减持|增持|分红|披露|涨停|跌停|上涨|下跌|预测|规划|目标|重启|复产|减产|扩产|合资|并购|重组|改革|搬迁|投资|募资|发行|审议|审批|中标|摘牌|挂牌|过户|交割|回购|质押|冻结|解禁|路演|配售|配股|增发|换购|对赌|担保|估值|盈利|亏损|扭亏|营收|业绩|财报|季报|年报|中报|快报|预告|预亏|减亏|盈警|盈喜|涉诉|胜诉|败诉|和解|仲裁|听证|调查|被罚|整改|处分|撤销|废止|生效|实施|推进|部署|深化|拓展|聚焦|发力|布局|进驻|落地|亮相|登场|开启|揭幕|奠基|封顶|建成|通车|通航|运营|赴美|赴港|退市|停牌|复牌|编织|发展|观察|崛起|抢占|加速|即将|进入|体现|关注|看好|预计|涉及|引发|推动|提升|降低|落后|实现|具备|拥有|引爆|看齐|应对|面对|涉足|进军|带来|提供|给予|配合|共同|助力|出海|做|接待|走访|创下|刷新|摘得|荣获|斩获|赢得|捧回|获评|荣登|荣膺|问鼎|夺得|摘取|入围|上榜|登顶|登榜|揭晓|出炉|显现|暴露|凸显|展现|呈现|备受|诱发|致使|招致|触|推向|涌入|流入|流出|迁入|迁出|搬入|搬出|登陆|开展|召开|举行|举办|承办|主办|协办|赞助|冠名|入选|拔得|名列|排名|排第|位列|高居|位居|跻身|走在|领跑|跑赢|领涨|领跌|拖累|拖低|提振|承压|建|制造|暴跌|暴涨|涨价|降价|提价|降价|研报|看好|唱多|唱空|回调|反弹|反转|突破|下挫|上行|下行|回落|企稳|震荡|盘整|整理|缩量|放量|高开|低开|冲高|回落|企稳|走强|走弱|反弹|反转|回调|承压|支撑|阻力|突破|跌破|跌破|破位|破净|发行|申购|中签|缴款|上市|申购|开盘|收盘|涨跌|震荡|强势|弱势|走强|走弱|看好|看淡|增持|减持|仓位|建仓|减仓|加仓|调仓|换仓|满仓|空仓|补仓|平仓|止损|止盈|锁仓|观望|看多|看空|做多|做空)/;

const GENERIC_TOKENS = new Set([
  'inc', 'corp', 'ltd', 'co', 'gmbh', 'corporation', 'company', 'group', 'limited',
  'industries', 'industrial', 'industries.', 'inc.', 'co.', 'ltd.', 'gmbh.',
  '新材料', '集团',
]);

function isMostlyUppercase(s) {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.85;
}

function stripCompanySuffix(title) {
  // Strip trailing " - Company Name" / " – Hexcel" / " — SGL Carbon"
  return title.replace(/\s+[-–—]\s+[^-–—]+$/, '').trim();
}

export function isLikelyNews(title) {
  if (!title) return false;
  const t = title.trim();
  const stripped = stripCompanySuffix(t);

  for (const pat of BAD_TITLE_PATTERNS) {
    if (pat.test(stripped) || pat.test(t)) return false;
  }

  // ALL-CAPS policies / legal documents
  if (isMostlyUppercase(stripped)) return false;

  // Reasonable length (after stripping company suffix)
  if (stripped.length < 12) return false;

  // Accept if any of:
  // 1. Has action verb (CN or EN)
  // 2. Contains a year (real news usually has one)
  const hasVerb = ENGLISH_VERBS.test(stripped) || CHINESE_VERBS.test(stripped);
  const hasYear = /\b20[12]\d\b/.test(stripped);

  return hasVerb || hasYear;
}

function extractBrandTokens(companyName) {
  const tokens = [];
  const parts = companyName.split(/[\s,.\-_]+/);
  for (const part of parts) {
    if (part.length < 2) continue;
    if (GENERIC_TOKENS.has(part.toLowerCase())) continue;
    tokens.push(part);
    // For Chinese names, also extract 2-char substrings (so "威海拓展" → "威海", "拓展")
    if (/[一-龥]/.test(part) && part.length >= 4) {
      for (let i = 0; i <= part.length - 2; i++) {
        const sub = part.substring(i, i + 2);
        if (!GENERIC_TOKENS.has(sub)) tokens.push(sub);
      }
    }
  }
  return tokens;
}

export function isRelevantToCompany(title, companyName) {
  if (!companyName) return true;
  const tokens = extractBrandTokens(companyName);
  if (tokens.length === 0) return true;

  // Match if ANY token appears in the title
  const t = title.toLowerCase();
  return tokens.some(token => t.includes(token.toLowerCase()));
}

export function filterNewsItems(items, companyName) {
  return items.filter(n =>
    isLikelyNews(n.title) && isRelevantToCompany(n.title, companyName)
  );
}
