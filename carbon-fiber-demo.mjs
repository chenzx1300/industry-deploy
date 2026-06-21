// Carbon fiber industry demo: generates real HTML with mock data, no API keys required.
// Usage: node carbon-fiber-demo.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'carbon-fiber-industry';
const PROMPT = '碳纤维';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';

const data = {
  slug: SLUG,
  prompt: PROMPT,
  generated_at: new Date().toISOString(),
  companies: [
    {
      id: 'sinofibers', name: '中复神鹰 Sinofibers', region: 'cn', domain: 'sinofibers.com', monogram: '复', monogram_color: '#1e40af',
      news: [
        { title: '中复神鹰 T1100 级碳纤维实现万吨级量产', snippet: '中复神鹰宣布其自主研发的 T1100 级高强高模碳纤维正式突破万吨级年产能，成为全球第二家掌握该级别碳纤维工业化生产的企业。', url: 'https://www.sinofibers.com/news/t1100-10kt', source: 'sinofibers.com', published_at: '2026-06-15T08:00:00Z' },
        { title: '中复神鹰西宁 2.4 万吨碳纤维基地全面投产', snippet: '位于青海西宁的中复神鹰 2.4 万吨/年碳纤维项目全部产线投产，采用干喷湿纺工艺，主要面向风电叶片和氢能储罐市场。', url: 'https://www.sinofibers.com/news/xining-full', source: 'sinofibers.com', published_at: '2026-06-12T14:30:00Z' },
        { title: '中复神鹰与中材科技签署 5 年 8 万吨供货协议', snippet: '中复神鹰与中材科技风电叶片公司签署 5 年期战略供货协议，总规模 8 万吨碳纤维及织物，配套金风科技、远景能源等整机厂。', url: 'https://www.sinofibers.com/news/cmt-supply', source: 'sinofibers.com', published_at: '2026-06-08T09:15:00Z' },
        { title: '中复神鹰 Q1 营收 18.7 亿元，同比增长 41%', snippet: '中复神鹰发布 2026 年 Q1 财报：营业收入 18.7 亿元，同比增长 41%；归母净利润 3.2 亿元，同比增长 58%；毛利率 35.6%。', url: 'https://www.sinofibers.com/news/q1-report', source: 'sinofibers.com', published_at: '2026-06-04T11:00:00Z' },
        { title: '中复神鹰 SYT55S 高强高模碳纤维通过航天认证', snippet: '中复神鹰自主研发的 SYT55S 碳纤维通过航天科技集团认证，将用于国产大型运载火箭复合材料壳体，替代部分进口材料。', url: 'https://www.sinofibers.com/news/syt55s-aerospace', source: 'sinofibers.com', published_at: '2026-06-01T13:45:00Z' },
        { title: '中复神鹰发布全球首款 50K 大丝束碳纤维', snippet: '中复神鹰在 SAMPE 展会上发布全球首款 50K 大丝束碳纤维产品 SYT50S-50K，专为风电叶片和氢能储罐设计，成本较 24K 降低 20%。', url: 'https://www.sinofibers.com/news/50k-launch', source: 'sinofibers.com', published_at: '2026-05-29T10:30:00Z' },
        { title: '中复神鹰投资 12 亿元建设碳纤维复材生产基地', snippet: '中复神鹰宣布在江苏连云港投资 12 亿元建设碳纤维复合材料生产基地，年产预浸料 5000 万平米，2027 年 Q3 投产。', url: 'https://www.sinofibers.com/news/composite-plant', source: 'sinofibers.com', published_at: '2026-05-26T16:00:00Z' },
        { title: '中复神鹰与空客签署预浸料供应谅解备忘录', snippet: '中复神鹰与空客公司在巴黎签署谅解备忘录，将为其 A320neo 和 A350 飞机提供碳纤维预浸料，预计 2027 年开始小批量供货。', url: 'https://www.sinofibers.com/news/airbus-mou', source: 'sinofibers.com', published_at: '2026-05-22T09:00:00Z' },
        { title: '中复神鹰获国家科技进步奖二等奖', snippet: '中复神鹰"万吨级干喷湿纺碳纤维产业化关键技术"项目荣获 2025 年度国家科技进步奖二等奖，突破国外 40 年技术封锁。', url: 'https://www.sinofibers.com/news/nat-science-award', source: 'sinofibers.com', published_at: '2026-05-19T14:15:00Z' },
        { title: '中复神鹰 RFL 改性剂实现进口替代', snippet: '中复神鹰自主研发的碳纤维上浆剂 RFL 改性剂完成国产化攻关，性能达到日本松本日之出水平，成本降低 35%，实现批量替代。', url: 'https://www.sinofibers.com/news/rfl-domestic', source: 'sinofibers.com', published_at: '2026-05-15T11:30:00Z' },
        { title: '中复神鹰发布 ESG 报告，碳足迹降低 22%', snippet: '中复神鹰发布 2025 年 ESG 报告：通过光伏直供、绿电交易和工艺优化，单位产品碳足迹较 2022 年降低 22%，达到国际领先水平。', url: 'https://www.sinofibers.com/news/esg-2025', source: 'sinofibers.com', published_at: '2026-05-12T08:45:00Z' },
      ],
    },
    {
      id: 'weihai', name: '威海拓展 Weihai Tuozhan', region: 'cn', domain: 'weihaifiber.com', monogram: '海', monogram_color: '#0d9488',
      news: [
        { title: '威海拓展成为国产大飞机 C929 主供应商', snippet: '威海拓展纤维股份有限公司正式成为中国商飞 C929 宽体客机碳纤维复合材料主供应商，承担机身和机翼复合材料部件制造。', url: 'https://www.weihaifiber.com/news/c929-main', source: 'weihaifiber.com', published_at: '2026-06-14T03:00:00Z' },
        { title: '威海拓展 QM4550 中模量碳纤维量产突破 5 千吨', snippet: '威海拓展 QM4550 中模量碳纤维年产能突破 5000 吨，成为继东丽 T800 之后全球第二个突破该级别工业化生产的产品。', url: 'https://www.weihaifiber.com/news/qm4550-5kt', source: 'weihaifiber.com', published_at: '2026-06-10T11:00:00Z' },
        { title: '威海拓展在山东荣成扩产 8000 吨碳纤维', snippet: '威海拓展宣布在山东荣成投资 28 亿元建设年产 8000 吨高性能碳纤维项目，配套国产大飞机和风电叶片需求，2027 年底投产。', url: 'https://www.weihaifiber.com/news/rongcheng-8kt', source: 'weihaifiber.com', published_at: '2026-06-06T15:30:00Z' },
        { title: '威海拓展与航天科工集团联合实验室揭牌', snippet: '威海拓展与中国航天科工集团联合建设的"先进碳纤维复合材料联合实验室"在威海揭牌，重点攻关航天用碳纤维技术。', url: 'https://www.weihaifiber.com/news/casic-lab', source: 'weihaifiber.com', published_at: '2026-06-03T09:45:00Z' },
        { title: '威海拓展 SYT65 高强高模碳纤维通过军工认证', snippet: '威海拓展 SYT65 高强高模碳纤维（拉伸强度 6.5 GPa）通过军工定型认证，将批量用于国产新一代战术导弹和卫星结构件。', url: 'https://www.weihaifiber.com/news/syt65-mil', source: 'weihaifiber.com', published_at: '2026-05-31T13:20:00Z' },
        { title: '威海拓展与 Vestas 签署风电叶片碳梁供应协议', snippet: '威海拓展与丹麦 Vestas 签署 3 年期碳纤维拉挤板供应协议，年供货规模 1500 吨，配套 V236-15.0 MW 海上风机叶片。', url: 'https://www.weihaifiber.com/news/vestas-deal', source: 'weihaifiber.com', published_at: '2026-05-28T08:00:00Z' },
        { title: '威海拓展入选工信部"单项冠军企业"', snippet: '威海拓展凭借在碳纤维领域的领先优势，被工信部认定为第七批制造业"单项冠军企业"，主营产品市场占有率位居全球第三。', url: 'https://www.weihaifiber.com/news/single-champion', source: 'weihaifiber.com', published_at: '2026-05-25T17:30:00Z' },
        { title: '威海拓展 Q1 营收 14.5 亿元，民用占比首次过半', snippet: '威海拓展发布 Q1 财报：营业收入 14.5 亿元，同比增长 28%；民用领域（风电/氢能/光伏）首次占比超过 50%。', url: 'https://www.weihaifiber.com/news/q1-civilian', source: 'weihaifiber.com', published_at: '2026-05-22T10:00:00Z' },
        { title: '威海拓展 SYT49S 碳纤维应用于低空飞行器', snippet: '威海拓展 SYT49S 标准模量碳纤维批量应用于亿航 EH216-S 无人驾驶载人飞行器，已通过中国民航局型号合格审定。', url: 'https://www.weihaifiber.com/news/ehang-uam', source: 'weihaifiber.com', published_at: '2026-05-19T14:00:00Z' },
        { title: '威海拓展发布碳纤维氢能储罐解决方案', snippet: '威海拓展在 FCVC 展会上发布 70MPa IV 型碳纤维缠绕氢瓶整体解决方案，储氢密度达 6.8 wt%，较金属瓶提升 70%。', url: 'https://www.weihaifiber.com/news/h2-tank', source: 'weihaifiber.com', published_at: '2026-05-16T11:30:00Z' },
      ],
    },
    {
      id: 'guangwei', name: '光威复材 Guangwei', region: 'cn', domain: 'guangweicf.com', monogram: '光', monogram_color: '#475569',
      news: [
        { title: '光威复材国产 T800 替代项目进入批量交付阶段', snippet: '光威复材承担的国家重点 T800 级碳纤维国产替代项目进入批量交付阶段，2026 年预计交付 1500 吨，配套航空航天型号。', url: 'https://www.guangweicf.com/news/t800-batch', source: 'guangweicf.com', published_at: '2026-06-13T16:20:00Z' },
        { title: '光威复材包头 1.2 万吨大丝束项目投产', snippet: '光威复材位于内蒙古包头的 1.2 万吨/年大丝束碳纤维项目正式投产，主要面向风电叶片、新能源汽车和氢能储罐等民用市场。', url: 'https://www.guangweicf.com/news/baotou-online', source: 'guangweicf.com', published_at: '2026-06-09T07:45:00Z' },
        { title: '光威复材联合中科院化学所攻关 M65 高模量碳纤维', snippet: '光威复材与中科院化学所联合启动 M65 高模量碳纤维（拉伸模量 650 GPa）攻关项目，目标 2027 年完成中试，2028 年量产。', url: 'https://www.guangweicf.com/news/m65-project', source: 'guangweicf.com', published_at: '2026-06-05T14:30:00Z' },
        { title: '光威复材风电用碳梁国内市场占有率超 35%', snippet: '光威复材 2025 年风电用碳纤维拉挤板国内市场占有率达 35.2%，连续 5 年位居国内第一，全球排名第二。', url: 'https://www.guangweicf.com/news/wind-share', source: 'guangweicf.com', published_at: '2026-06-02T09:00:00Z' },
        { title: '光威复材推出汽车级快速固化预浸料', snippet: '光威复材推出汽车级 GW-CC200 快速固化碳纤维预浸料，固化时间由 8 分钟缩短至 90 秒，专为新能源汽车 HP-RTM 工艺设计。', url: 'https://www.guangweicf.com/news/auto-prepreg', source: 'guangweicf.com', published_at: '2026-05-29T11:00:00Z' },
        { title: '光威复材与吉利汽车签署车身轻量化合作协议', snippet: '光威复材与吉利汽车集团签署战略合作协议，将为吉利银河系列和极氪品牌提供碳纤维车身部件，单车减重 30%。', url: 'https://www.guangweicf.com/news/geely-deal', source: 'guangweicf.com', published_at: '2026-05-26T13:00:00Z' },
        { title: '光威复材 Q1 净利润同比增长 47%', snippet: '光威复材 2026 年 Q1 财报：营收 9.8 亿元（+22%），归母净利润 1.95 亿元（+47%）；碳梁及预浸料业务增长强劲。', url: 'https://www.guangweicf.com/news/q1-results', source: 'guangweicf.com', published_at: '2026-05-23T08:30:00Z' },
        { title: '光威复材设立欧洲办事处，剑指空客/庞巴迪供应链', snippet: '光威复材在德国汉堡设立欧洲办事处，瞄准空客 A350、庞巴迪 Global 7500 等机型的碳纤维复合材料一级供应商认证。', url: 'https://www.guangweicf.com/news/europe-office', source: 'guangweicf.com', published_at: '2026-05-20T15:45:00Z' },
        { title: '光威复材联合 Vestas 研发下一代海上风电叶片', snippet: '光威复材与 Vestas 联合研发下一代 18 MW 海上风电叶片碳梁，碳纤维用量较 V236 平台增加 40%，单根叶片减重 12 吨。', url: 'https://www.guangweicf.com/news/next-gen-blade', source: 'guangweicf.com', published_at: '2026-05-17T10:30:00Z' },
        { title: '光威复材入选 MSCI 中国 A50 互联互通指数', snippet: '光威复材被纳入 MSCI 中国 A50 互联互通指数，反映国际资本市场对其碳纤维行业龙头地位的高度认可。', url: 'https://www.guangweicf.com/news/msci-a50', source: 'guangweicf.com', published_at: '2026-05-14T16:15:00Z' },
      ],
    },
    {
      id: 'toray', name: 'Toray 东丽', region: 'intl', domain: 'toray.com', monogram: 'T', monogram_color: '#9f1239',
      news: [
        { title: '东丽发布全球最高强度碳纤维 T1200X，拉伸强度 8.0 GPa', snippet: '日本东丽工业发布全球拉伸强度最高的 T1200X 碳纤维（8.0 GPa），将用于下一代航空发动机复合材料叶片和火箭壳体。', url: 'https://www.toray.com/news/t1200x', source: 'toray.com', published_at: '2026-06-16T01:00:00Z' },
        { title: '东丽收购德国碳纤维预浸料企业 MTC', snippet: '东丽工业宣布以 4.2 亿欧元收购德国碳纤维预浸料企业 MTC（Mobile Technology Composite），扩大欧洲市场布局。', url: 'https://www.toray.com/news/mtc-acquisition', source: 'toray.com', published_at: '2026-06-12T18:00:00Z' },
        { title: '东丽与波音签署 10 年 30 亿美元长协', snippet: '东丽与波音签署 10 年期碳纤维复合材料长协，总规模 30 亿美元，覆盖 777X、787 和新一代窄体机（NMA）项目。', url: 'https://www.toray.com/news/boeing-10yr', source: 'toray.com', published_at: '2026-06-08T13:30:00Z' },
        { title: '东丽 Q1 碳纤维复合材料业务营收 12.3 亿美元', snippet: '东丽工业 2026 财年 Q1（4-6 月）财报：碳纤维复合材料业务营收 12.3 亿美元，同比增长 18%；航空需求强劲。', url: 'https://www.toray.com/news/q1-fy26', source: 'toray.com', published_at: '2026-06-04T15:00:00Z' },
        { title: '东丽推出回收碳纤维品牌 EcoCircle Torayca', snippet: '东丽工业推出 EcoCircle Torayca 回收碳纤维品牌，目标 2030 年回收处理 1 万吨退役飞机碳纤维，复用率超 90%。', url: 'https://www.toray.com/news/ecocircle', source: 'toray.com', published_at: '2026-05-31T11:00:00Z' },
        { title: '东丽扩建韩国龟尾工厂，T800 级碳纤维产能翻倍', snippet: '东丽工业投资 1.5 亿美元扩建韩国龟尾工厂，T800 级碳纤维年产能从 4700 吨扩至 9700 吨，2027 年 Q4 投产。', url: 'https://www.toray.com/news/kumi-expand', source: 'toray.com', published_at: '2026-05-28T09:30:00Z' },
        { title: '东丽与 Joby Aviation 联合开发 eVTOL 碳纤维机体', snippet: '东丽与美国 Joby Aviation 签署联合开发协议，为其 S4 电动垂直起降飞行器提供碳纤维复合材料机体，目标 2026 年取证。', url: 'https://www.toray.com/news/joby-evtol', source: 'toray.com', published_at: '2026-05-25T16:00:00Z' },
        { title: '东丽 Z600 碳纤维应用于 H3 火箭 LE-12 发动机喷管', snippet: '日本宇宙航空研究开发机构（JAXA）H3 火箭 LE-12 发动机喷管采用东丽 Z600 高模量碳纤维，是日本首个国产火箭发动机复合材料部件。', url: 'https://www.toray.com/news/h3-nozzle', source: 'toray.com', published_at: '2026-05-22T14:30:00Z' },
        { title: '东丽风电用大丝束碳纤维在土耳其建厂', snippet: '东丽工业宣布在土耳其伊斯坦布尔建设年产 6000 吨风电用大丝束碳纤维工厂，配套欧美风电市场，2027 年 Q2 投产。', url: 'https://www.toray.com/news/turkey-plant', source: 'toray.com', published_at: '2026-05-19T12:00:00Z' },
        { title: '东丽发布 2026–2030 中期经营计划，碳纤维投资 50 亿美元', snippet: '东丽发布中期经营计划，2026–2030 年间在碳纤维复合材料领域投资 50 亿美元，重点布局航空、低空经济和氢能。', url: 'https://www.toray.com/news/midterm-plan', source: 'toray.com', published_at: '2026-05-16T10:30:00Z' },
      ],
    },
    {
      id: 'hexcel', name: 'Hexcel 赫氏', region: 'intl', domain: 'hexcel.com', monogram: 'H', monogram_color: '#3730a3',
      news: [
        { title: 'Hexcel 发布新一代 HexPly M91 快速固化预浸料', snippet: 'Hexcel 发布 HexPly M91 快速固化预浸料，固化时间缩短至 60 秒，专为航空航天和汽车复合材料大规模量产设计。', url: 'https://www.hexcel.com/news/m91-prepreg', source: 'hexcel.com', published_at: '2026-06-15T10:00:00Z' },
        { title: 'Hexcel 与 Archer Aviation 联合开发 Midnight eVTOL', snippet: 'Hexcel 与 Archer Aviation 扩大合作，为其 Midnight 电动垂直起降飞行器提供碳纤维预浸料和蜂窝芯材，目标 2025 年取证。', url: 'https://www.hexcel.com/news/archer-midnight', source: 'hexcel.com', published_at: '2026-06-11T08:30:00Z' },
        { title: 'Hexcel 在法国里昂开设欧洲研发中心', snippet: 'Hexcel 在法国里昂新设欧洲研发中心，专注于下一代航空发动机复合材料和氢能储罐用碳纤维研发。', url: 'https://www.hexcel.com/news/lyon-rd', source: 'hexcel.com', published_at: '2026-06-07T12:00:00Z' },
        { title: 'Hexcel 入选空客 A350-1000 ULR 碳纤维主供应商', snippet: 'Hexcel 入选空客 A350-1000 ULR（超远程版）碳纤维复合材料主供应商，承担机身和垂尾复合材料部件制造。', url: 'https://www.hexcel.com/news/a350-1000-ulr', source: 'hexcel.com', published_at: '2026-06-03T14:45:00Z' },
        { title: 'Hexcel Q1 营收 5.4 亿美元，同比增长 12%', snippet: 'Hexcel 2026 年 Q1 财报：营收 5.4 亿美元（+12%），营业利润率 17.8%，碳纤维复合材料业务增长强劲。', url: 'https://www.hexcel.com/news/q1-2026', source: 'hexcel.com', published_at: '2026-05-30T16:20:00Z' },
        { title: 'Hexcel 与 Vestas 联合开发 15MW 海上风机叶片', snippet: 'Hexcel 与丹麦 Vestas 签署联合开发协议，研发 15 MW 海上风机用碳纤维复合材料叶片，单根叶片长度 115 米。', url: 'https://www.hexcel.com/news/vestas-15mw', source: 'hexcel.com', published_at: '2026-05-27T10:30:00Z' },
        { title: 'Hexcel HexForce 织物应用于波音 777-9 翼盒', snippet: 'Hexcel HexForce 碳纤维织物批量应用于波音 777-9 复合材料翼盒，单架飞机碳纤维用量达 18 吨。', url: 'https://www.hexcel.com/news/b777-9-wingbox', source: 'hexcel.com', published_at: '2026-05-24T13:00:00Z' },
        { title: 'Hexcel 在美国犹他州扩建碳纤维织物工厂', snippet: 'Hexcel 投资 8000 万美元在美国犹他州 West Valley City 扩建碳纤维织物工厂，新增产能 1500 吨/年，2027 Q2 投产。', url: 'https://www.hexcel.com/news/utah-expand', source: 'hexcel.com', published_at: '2026-05-21T09:00:00Z' },
        { title: 'Hexcel 推出回收碳纤维品牌 Hexcel ReCycle', snippet: 'Hexcel 推出回收碳纤维品牌 Hexcel ReCycle，目标 2028 年实现 30% 的原材料来自回收碳纤维，降低产品碳足迹 25%。', url: 'https://www.hexcel.com/news/recycle-brand', source: 'hexcel.com', published_at: '2026-05-18T15:45:00Z' },
        { title: 'Hexcel 与 Lockheed Martin 合作研发高超音速飞行器', snippet: 'Hexcel 与洛克希德·马丁签署合作协议，研发 SR-72 高超音速飞行器用耐高温碳纤维复合材料，可在 2000°C 下工作。', url: 'https://www.hexcel.com/news/lm-sr72', source: 'hexcel.com', published_at: '2026-05-15T11:30:00Z' },
      ],
    },
    {
      id: 'sgl', name: 'SGL Carbon 西格里', region: 'intl', domain: 'sglcarbon.com', monogram: 'S', monogram_color: '#1f2937',
      news: [
        { title: 'SGL Carbon 推出 SIGRACELL 燃料电池双极板', snippet: 'SGL Carbon 推出新一代 SIGRACELL 碳纤维复合双极板，专为氢燃料电池设计，功率密度达 4.2 kW/L，领先行业。', url: 'https://www.sglcarbon.com/news/sigracell', source: 'sglcarbon.com', published_at: '2026-06-13T05:00:00Z' },
        { title: 'SGL Carbon 与宝马联合开发氢燃料电池储罐', snippet: 'SGL Carbon 与宝马集团联合开发 700 bar 高压氢燃料电池储罐，采用碳纤维缠绕工艺，搭载于 BMW iX5 Hydrogen。', url: 'https://www.sglcarbon.com/news/bmw-h2', source: 'sglcarbon.com', published_at: '2026-06-09T14:00:00Z' },
        { title: 'SGL Carbon 在德国 Meitingen 扩产碳纤维 50%', snippet: 'SGL Carbon 投资 1.2 亿欧元在德国巴伐利亚 Meitingen 工厂扩产，碳纤维年产能从 4000 吨提升至 6000 吨，2027 Q3 投产。', url: 'https://www.sglcarbon.com/news/meitingen-expand', source: 'sglcarbon.com', published_at: '2026-06-05T10:30:00Z' },
        { title: 'SGL Carbon SIGRATEX 碳毡应用于半导体晶圆生产', snippet: 'SGL Carbon SIGRATEX 碳纤维毡批量应用于台积电 2nm 晶圆生产线的硅外延炉，单台设备年用量超 5 吨。', url: 'https://www.sglcarbon.com/news/tsmc-2nm', source: 'sglcarbon.com', published_at: '2026-06-01T13:45:00Z' },
        { title: 'SGL Carbon 收购英国碳纤维回收企业 Carbon Clean', snippet: 'SGL Carbon 宣布以 8500 万欧元收购英国 Carbon Clean 碳纤维回收公司，强化欧洲回收碳纤维供应链。', url: 'https://www.sglcarbon.com/news/carbon-clean', source: 'sglcarbon.com', published_at: '2026-05-28T11:00:00Z' },
        { title: 'SGL Carbon Q1 EBITDA 同比增长 23%', snippet: 'SGL Carbon 2026 年 Q1 财报：营收 3.1 亿欧元（+8%），EBITDA 5300 万欧元（+23%），碳纤维业务增长强劲。', url: 'https://www.sglcarbon.com/news/q1-2026', source: 'sglcarbon.com', published_at: '2026-05-25T15:30:00Z' },
        { title: 'SGL Carbon 与 Siemens Energy 合作风电叶片碳梁', snippet: 'SGL Carbon 与西门子歌美飒签署 5 年期碳纤维拉挤板供应协议，配套 SG 14-222 DD 海上风机，单根叶片长度 108 米。', url: 'https://www.sglcarbon.com/news/siemens-wind', source: 'sglcarbon.com', published_at: '2026-05-22T09:00:00Z' },
        { title: 'SGL Carbon 在波兰奥波莱开设复合材料研发中心', snippet: 'SGL Carbon 在波兰奥波莱开设复合材料研发中心，专注于汽车和工业应用碳纤维部件的低成本量产工艺。', url: 'https://www.sglcarbon.com/news/poland-rd', source: 'sglcarbon.com', published_at: '2026-05-19T14:00:00Z' },
        { title: 'SGL Carbon SIGRAPREG 预浸料通过 Airbus A320neo 认证', snippet: 'SGL Carbon SIGRAPREG 碳纤维预浸料通过空客 A320neo 复合材料后压力框认证，单架飞机用量约 800 公斤。', url: 'https://www.sglcarbon.com/news/a320neo-cert', source: 'sglcarbon.com', published_at: '2026-05-16T10:00:00Z' },
        { title: 'SGL Carbon 发布 2030 碳中和路线图', snippet: 'SGL Carbon 发布 2030 碳中和路线图：所有生产基地 100% 使用可再生能源，Scope 1+2 排放较 2022 年降低 60%。', url: 'https://www.sglcarbon.com/news/carbon-neutral-2030', source: 'sglcarbon.com', published_at: '2026-05-13T08:30:00Z' },
      ],
    },
  ],
};

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, `${SLUG}.json`), JSON.stringify(data, null, 2));

  const totalNews = data.companies.reduce((s, c) => s + c.news.length, 0);
  await addToManifest(DATA_DIR, {
    slug: SLUG,
    prompt: PROMPT,
    company_count: data.companies.length,
    news_count: totalNews,
    generated_at: data.generated_at,
  });

  const manifest = await loadManifest(DATA_DIR);

  await mkdir(join(OUT_DIR, SLUG), { recursive: true });
  await writeFile(join(OUT_DIR, SLUG, 'index.html'), renderIndustryPage(data));
  await writeFile(join(OUT_DIR, 'index.html'), renderHomepage(manifest));

  console.log(`✓ ${totalNews} 条新闻分布在 ${data.companies.length} 家公司`);
  for (const c of data.companies) {
    console.log(`  · ${c.name}: ${c.news.length} 条`);
  }
  console.log(`✓ 已生成 docs/index.html 与 docs/${SLUG}/index.html`);
}

main().catch(err => { console.error(err); process.exit(1); });
