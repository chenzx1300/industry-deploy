// One-off demo build: generates real HTML with mock data, no API keys required.
// Usage: node demo-build.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderIndustryPage, renderHomepage } from './src/pipeline/render.mjs';
import { addToManifest, loadManifest } from './src/pipeline/manifest.mjs';

const SLUG = 'new-energy-vehicles-industry';
const PROMPT = '新能源汽车';
const DATA_DIR = 'data';
const OUT_DIR = 'docs';

// 真实感中文 mock 数据（2026 年中）
const data = {
  slug: SLUG,
  prompt: PROMPT,
  generated_at: new Date().toISOString(),
  companies: [
    {
      id: 'byd', name: '比亚迪 BYD', region: 'cn', domain: 'byd.com',
      news: [
        { title: '比亚迪发布第三代刀片电池，CLTC 续航突破 1000 公里', snippet: '比亚迪在深圳举行发布会，正式推出第三代刀片电池平台，能量密度提升 35%，搭载该电池的汉 EV 旗舰版 CLTC 续航达 1050 公里，10–80% 快充仅需 12 分钟。', url: 'https://www.byd.com/news/blade-3', source: 'byd.com', published_at: '2026-06-15T08:00:00Z' },
        { title: '比亚迪匈牙利塞格德工厂正式投产，年产能 20 万辆', snippet: '比亚迪欧洲第二座整车工厂在匈牙利塞格德开业，主要面向欧盟市场生产 Atto 3、Dolphin 和 Seal 三款车型，初期年产能 20 万辆，未来将扩至 30 万辆。', url: 'https://www.byd.com/news/hungary-plant', source: 'byd.com', published_at: '2026-06-12T14:30:00Z' },
        { title: '比亚迪 Q1 全球纯电销量 42 万辆，超越特斯拉', snippet: '行业数据显示，比亚迪 2026 年 Q1 全球纯电动车销量达 42 万辆，超越特斯拉的 41.2 万辆，首次登顶全球纯电销量冠军。', url: 'https://www.byd.com/news/q1-sales', source: 'byd.com', published_at: '2026-06-08T09:15:00Z' },
        { title: '比亚迪宣布在巴西建设磷酸铁锂材料工厂', snippet: '比亚迪与巴西矿业巨头 Vale 签署协议，将在巴伊亚州建设年产能 15 万吨的磷酸铁锂正极材料工厂，2027 年 Q3 投产。', url: 'https://www.byd.com/news/brazil-lfp', source: 'byd.com', published_at: '2026-06-05T11:20:00Z' },
        { title: '仰望 U7 豪华旗舰轿车开启预售，售价 60 万元起', snippet: '比亚迪旗下高端品牌仰望推出全新旗舰轿车 U7，搭载四电机驱动，0-100 km/h 加速 2.3 秒，CLTC 续航 720 公里，预售价 60–80 万元。', url: 'https://www.byd.com/news/yangwang-u7', source: 'byd.com', published_at: '2026-06-03T07:00:00Z' },
        { title: '比亚迪携手丰田深化混动技术合作', snippet: '比亚迪与丰田签署扩大合作协议，将在更多车型上搭载比亚迪 DM-i 混动系统，覆盖紧凑型到中大型轿车和 SUV。', url: 'https://www.byd.com/news/toyota-dmi', source: 'byd.com', published_at: '2026-05-30T13:45:00Z' },
        { title: '比亚迪海豹 06 DM-i 旅行版上市，售价 12.98 万起', snippet: '比亚迪海洋网推出海豹 06 DM-i 旅行版，纯电续航 80/120 公里，馈电油耗 3.8L/100km，主打家庭长途出行市场。', url: 'https://www.byd.com/news/seal-06-touring', source: 'byd.com', published_at: '2026-05-27T10:30:00Z' },
        { title: '比亚迪完成墨西哥城电动公交订单交付', snippet: '比亚迪向墨西哥城交付 500 辆纯电公交客车，这是拉美地区规模最大的电动公交订单，预计每年减少碳排放 6 万吨。', url: 'https://www.byd.com/news/mexico-bus', source: 'byd.com', published_at: '2026-05-24T16:00:00Z' },
        { title: '比亚迪储能业务海外订单突破 30 GWh', snippet: '比亚迪储能业务部宣布 2026 上半年海外储能订单累计超 30 GWh，主要市场为美国、欧洲和澳洲，覆盖工商业储能和电网侧储能。', url: 'https://www.byd.com/news/ess-overseas', source: 'byd.com', published_at: '2026-05-21T09:00:00Z' },
        { title: '比亚迪方程豹豹 8 越野 SUV 月销破 2 万辆', snippet: '方程豹品牌旗下硬派越野 SUV 豹 8 在 5 月单月销量突破 2 万辆，超过坦克 500 Hi4-Z，成为国内中大型越野 SUV 销冠。', url: 'https://www.byd.com/news/fangchengbao-8', source: 'byd.com', published_at: '2026-05-18T14:15:00Z' },
        { title: '比亚迪第 1000 万辆新能源车下线', snippet: '比亚迪在西安工厂举行仪式，庆祝第 1000 万辆新能源车下线，从 0 到 1000 万辆用时约 14 年，成为全球首家达成此里程碑的车企。', url: 'https://www.byd.com/news/10m-units', source: 'byd.com', published_at: '2026-05-15T08:30:00Z' },
      ],
    },
    {
      id: 'catl', name: '宁德时代 CATL', region: 'cn', domain: 'catl.com',
      news: [
        { title: '宁德时代四川宜宾超级工厂投产，年产能 100 GWh', snippet: '宁德时代在四川宜宾的全新超级工厂正式投产，主要生产 LFP 磷酸铁锂电芯，配套入门级电动车市场和储能市场，年产能 100 GWh。', url: 'https://www.catl.com/news/yibin-plant', source: 'catl.com', published_at: '2026-06-14T03:00:00Z' },
        { title: '宁德时代与宝马联合开发固态电池中试线', snippet: 'CATL 与宝马集团宣布在宁德总部建设固态电池联合中试线，初期产能 0.5 GWh，目标 2027 年小批量装车验证。', url: 'https://www.catl.com/news/bmw-ssb', source: 'catl.com', published_at: '2026-06-10T11:00:00Z' },
        { title: '麒麟 3.0 电池量产装车，能量密度 300 Wh/kg', snippet: 'CATL 第三代麒麟电池量产，能量密度突破 300 Wh/kg，支持 5C 超快充，10–80% 仅需 6 分钟，首发车型为极氪 001 FR。', url: 'https://www.catl.com/news/qilin-3', source: 'catl.com', published_at: '2026-06-07T15:30:00Z' },
        { title: '宁德时代发布神行 PLUS LFP 电池，10 分钟充至 80%', snippet: 'CATL 发布神行系列升级版——神行 PLUS LFP 电池，峰值充电功率 700 kW，常温下 10 分钟内可从 10% 充至 80%。', url: 'https://www.catl.com/news/shenxing-plus', source: 'catl.com', published_at: '2026-06-04T09:45:00Z' },
        { title: '宁德时代与特斯拉签署 5 年 200 GWh 长期供货协议', snippet: '宁德时代宣布与特斯拉签署 5 年期长期供货协议，总规模约 200 GWh，覆盖 Model 2、Model 3、Model Y 在上海工厂的生产需求。', url: 'https://www.catl.com/news/tesla-200gwh', source: 'catl.com', published_at: '2026-06-01T13:20:00Z' },
        { title: '宁德时代印尼电池厂 2027 年投产，规划 60 GWh', snippet: 'CATL 与印尼国有矿业公司 Mind Id 合作的电池工厂将于 2027 年 Q1 投产，一期产能 20 GWh，最终扩至 60 GWh，配套东南亚电动车市场。', url: 'https://www.catl.com/news/indonesia', source: 'catl.com', published_at: '2026-05-29T08:00:00Z' },
        { title: '宁德时代香港 IPO 募资 53 亿美元', snippet: 'CATL 在香港联交所完成第二上市，发行价 263 港元，募资约 53 亿美元，主要用于海外产能扩张和固态电池研发。', url: 'https://www.catl.com/news/hk-ipo', source: 'catl.com', published_at: '2026-05-26T17:30:00Z' },
        { title: '神行超充网络全国突破 5000 根', snippet: 'CATL 旗下神行超充网络在国内已建成超 5000 根 600 kW+ 超充桩，覆盖 280+ 城市，与 30+ 车企实现互联互通。', url: 'https://www.catl.com/news/charging-network', source: 'catl.com', published_at: '2026-05-22T10:00:00Z' },
        { title: '宁德时代发布家用储能系统 CATL EnerC Plus 3.0', snippet: 'CATL 推出第三代家储产品 EnerC Plus 3.0，单机容量 10–30 kWh，循环寿命 12000 次，10 年质保，瞄准欧洲和澳洲家储市场。', url: 'https://www.catl.com/news/enerc-3', source: 'catl.com', published_at: '2026-05-19T14:00:00Z' },
        { title: '宁德时代钠离子电池量产装车奇瑞 iCAR 03', snippet: 'CATL 钠离子电池量产版首批装车奇瑞 iCAR 03，电池包能量密度 160 Wh/kg，CLTC 续航 200 公里，主打 A0 级入门电动车。', url: 'https://www.catl.com/news/sodium-ion', source: 'catl.com', published_at: '2026-05-16T11:30:00Z' },
      ],
    },
    {
      id: 'nio', name: '蔚来 NIO', region: 'cn', domain: 'nio.com',
      news: [
        { title: '蔚来乐道品牌登陆欧洲，德荷两国率先开售', snippet: '蔚来旗下子品牌乐道（Onvo）正式进入欧洲市场，德国柏林和荷兰阿姆斯特丹的首批展厅同步开业，首发车型为乐道 L60，售价 €39,900 起。', url: 'https://www.nio.com/news/onvo-europe', source: 'nio.com', published_at: '2026-06-13T16:20:00Z' },
        { title: '蔚来 5 月交付 2.8 万辆，创单月历史新高', snippet: '蔚来公布 2026 年 5 月交付数据：全品牌共交付 28,052 辆，其中蔚来品牌 18,500 辆、乐道 7,800 辆、萤火虫 1,752 辆。', url: 'https://www.nio.com/news/may-deliveries', source: 'nio.com', published_at: '2026-06-09T07:45:00Z' },
        { title: '蔚来 ET9 行政旗舰轿车开启全国交付', snippet: '蔚来 ET9 正式开始向预定用户交付，搭载 900V 高压平台、神玑 NX9031 智驾芯片、零重力后排座椅，售价 78.8 万元起。', url: 'https://www.nio.com/news/et9-delivery', source: 'nio.com', published_at: '2026-06-06T09:00:00Z' },
        { title: '蔚来第 5000 座换电站上线，平均换电 2 分 40 秒', snippet: '蔚来宣布全国第 5000 座换电站——G30 连霍高速宝鸡服务区换电站正式上线，全国高速换电网络基本成型，平均换电耗时 2 分 40 秒。', url: 'https://www.nio.com/news/5000-swap', source: 'nio.com', published_at: '2026-06-03T14:30:00Z' },
        { title: '蔚来萤火虫（Firefly）海外首店开业，落地挪威奥斯陆', snippet: '蔚来第三品牌萤火虫欧洲首店在挪威奥斯陆开业，首款车型萤火虫 EC1 同步开启预订，售价 €29,900，定位精品小车市场。', url: 'https://www.nio.com/news/firefly-oslo', source: 'nio.com', published_at: '2026-05-31T11:00:00Z' },
        { title: '蔚来神玑 NX9031 智驾芯片流片成功，算力 2000 TOPS', snippet: '蔚来自研智驾芯片神玑 NX9031 完成流片回片，单颗算力 2000 TOPS，将于 7 月起在新车 ET9、ES8 上首发搭载。', url: 'https://www.nio.com/news/shenji-chip', source: 'nio.com', published_at: '2026-05-28T15:45:00Z' },
        { title: '蔚来 ES8 2026 款上市，起售价 49.8 万元', snippet: '蔚来 ES8 2026 款正式上市，全系标配 100 kWh 电池包、空气悬架、L3 级硬件平台，起售价 49.8 万元，与理想 L9、问界 M9 形成直接竞争。', url: 'https://www.nio.com/news/es8-2026', source: 'nio.com', published_at: '2026-05-25T10:30:00Z' },
        { title: '蔚来与宁德时代签署固态电池联合开发协议', snippet: '蔚来与 CATL 签署固态电池联合开发协议，目标 2027 年实现半固态电池小批量装车，2028 年实现全固态电池量产。', url: 'https://www.nio.com/news/ssb-jv', source: 'nio.com', published_at: '2026-05-22T13:00:00Z' },
        { title: '蔚来在中东开启交付，首批 ES8 抵达阿联酋', snippet: '蔚来在中东市场首批 ES8 运抵阿联酋迪拜和沙特利雅得展厅，正式开启交付，售价较国内贵约 30%，主打高端电动车市场。', url: 'https://www.nio.com/news/me-launch', source: 'nio.com', published_at: '2026-05-19T08:30:00Z' },
        { title: '蔚来能源获中东主权基金 30 亿美元战略投资', snippet: '蔚来能源（NIO Power）宣布完成 30 亿美元战略融资，由阿布扎比主权基金 Mubadala 领投，资金用于海外换电站网络扩张。', url: 'https://www.nio.com/news/nio-power-funding', source: 'nio.com', published_at: '2026-05-16T16:15:00Z' },
      ],
    },
    {
      id: 'tesla', name: 'Tesla 特斯拉', region: 'intl', domain: 'tesla.com',
      news: [
        { title: 'Tesla Model 2 在得州超级工厂发布，起售价 $19,999', snippet: 'Tesla 推出长期承诺的平价车型 Model 2，定位紧凑型纯电轿车，入门版起售价 $19,999，WLTP 续航 380 公里，2026 Q4 开启交付。', url: 'https://www.tesla.com/news/model-2-unveil', source: 'tesla.com', published_at: '2026-06-16T01:00:00Z' },
        { title: 'Tesla Robotaxi 在奥斯汀和凤凰城正式商业化运营', snippet: 'Tesla 自动驾驶出租车服务在美国奥斯汀和凤凰城全面上线，无安全员、车内仅乘客，按里程计价（$0.79/英里），覆盖两大都会区超 200 平方公里。', url: 'https://www.tesla.com/news/robotaxi-launch', source: 'tesla.com', published_at: '2026-06-14T18:00:00Z' },
        { title: 'Tesla 储能业务 Q2 装机量同比增长 73%', snippet: 'Tesla 能源部门公布 Q2 数据：Megapack 和 Powerwall 合计装机 16 GWh，同比增长 73%；上海储能超级工厂产能扩张至 10 GWh/月。', url: 'https://www.tesla.com/news/q2-storage', source: 'tesla.com', published_at: '2026-06-11T13:30:00Z' },
        { title: 'Tesla 召回 120 万辆汽车，更新自动驾驶软件', snippet: 'Tesla 发起自愿召回，覆盖 2022–2024 年生产的 Model 3/Y 共 120 万辆，修复自动驾驶系统在特定路口的视觉识别缺陷，OTA 远程完成。', url: 'https://www.tesla.com/news/recall-12m', source: 'tesla.com', published_at: '2026-06-07T15:00:00Z' },
        { title: 'Tesla Optimus 第三代人形机器人量产启动', snippet: 'Tesla Optimus Gen 3 在得州工厂开始小批量量产，单台成本降至 $20,000 以下，主要用于 Tesla 自身工厂的搬运和装配作业。', url: 'https://www.tesla.com/news/optimus-gen3', source: 'tesla.com', published_at: '2026-06-04T11:00:00Z' },
        { title: 'Tesla 墨西哥蒙特雷工厂首车下线', snippet: 'Tesla 墨西哥新莱昂州蒙特雷超级工厂首台 Model 3 下线，该工厂投资 50 亿美元，年产能规划 50 万辆，主要供应北美和拉美市场。', url: 'https://www.tesla.com/news/monterrey-first', source: 'tesla.com', published_at: '2026-06-01T09:30:00Z' },
        { title: 'Tesla FSD v13 在中国全面推送', snippet: 'Tesla 中国正式推送 FSD v13，采用端到端神经网络方案，已覆盖中国所有高速和高架场景，城市道路开放上海、深圳、北京、广州、杭州。', url: 'https://www.tesla.com/news/fsd-v13-china', source: 'tesla.com', published_at: '2026-05-29T16:00:00Z' },
        { title: 'Tesla Powerwall 3 出货量突破 100 万台', snippet: 'Tesla 宣布家用储能 Powerwall 3 全球累计出货突破 100 万台，2026 上半年单季出货 25 万台，同比增长 110%。', url: 'https://www.tesla.com/news/powerwall-1m', source: 'tesla.com', published_at: '2026-05-26T14:30:00Z' },
        { title: 'Tesla Semi 电动卡车获百事可乐 500 辆追加订单', snippet: '百事可乐宣布向 Tesla Semi 追加 500 辆订单，使其 Tesla Semi 总订单数达到 1500 辆，将于 2027 年底前全部交付。', url: 'https://www.tesla.com/news/semi-pepsi', source: 'tesla.com', published_at: '2026-05-23T12:00:00Z' },
        { title: 'Tesla 柏林工厂将改产 Model 2，年产能 30 万辆', snippet: 'Tesla 柏林超级工厂计划在 2026 Q4 切换至 Model 2 生产线，规划年产能 30 万辆，主要面向欧洲市场。', url: 'https://www.tesla.com/news/berlin-model2', source: 'tesla.com', published_at: '2026-05-20T10:30:00Z' },
      ],
    },
    {
      id: 'vw', name: 'Volkswagen 大众', region: 'intl', domain: 'volkswagen.com',
      news: [
        { title: '大众 ID.2all 确认售价 €24,999 起，欧洲开售', snippet: '大众正式确认 ID.2all 紧凑型纯电两厢车起售价 €24,999，将于 2026 Q4 开启欧洲交付，WLTP 续航 450 公里，支持 175 kW 快充。', url: 'https://www.volkswagen.com/news/id2all-pricing', source: 'volkswagen.com', published_at: '2026-06-15T10:00:00Z' },
        { title: '大众追加投资 Rivian 20 亿美元，加速软件平台落地', snippet: '大众集团宣布向与 Rivian 的合资企业再投资 20 亿美元，用于统一软件平台（SSP）的开发，目标 2027 年搭载于 ID. 系列新车型。', url: 'https://www.volkswagen.com/news/rivian-jv', source: 'volkswagen.com', published_at: '2026-06-11T08:30:00Z' },
        { title: '大众沃尔夫斯堡新电动车工厂正式投产', snippet: '大众在沃尔夫斯堡总部的全新电动车工厂 MeA 投产，取代此前的高尔夫燃油车产线，初期年产能 20 万辆，生产 ID.3 和 ID.4 改款车型。', url: 'https://www.volkswagen.com/news/wolfsburg-ev', source: 'volkswagen.com', published_at: '2026-06-05T12:00:00Z' },
        { title: '奥迪 Q6 e-tron 在中国上市，售价 49.99 万起', snippet: '奥迪基于 PPE 平台的 Q6 e-tron 在中国上市，搭载 800V 高压架构，CLTC 续航 700 公里，售价 49.99–59.99 万元。', url: 'https://www.volkswagen.com/news/q6-etron-cn', source: 'volkswagen.com', published_at: '2026-06-02T14:45:00Z' },
        { title: '保时捷 Macan EV 全球累计交付突破 10 万辆', snippet: '保时捷首款纯电 SUV Macan EV 自 2024 年上市以来全球累计交付突破 10 万辆，2025 年全年交付 8.7 万辆，超过燃油版 Macan。', url: 'https://www.volkswagen.com/news/macan-ev-100k', source: 'volkswagen.com', published_at: '2026-05-30T16:20:00Z' },
        { title: '大众中国与小鹏汽车合作车型 2026 年下半年上市', snippet: '大众汽车集团（中国）与小鹏汽车联合开发的首款车型——基于大众 CEA 架构的 A+ 级纯电 SUV 将于 2026 Q4 在中国上市，售价 20 万元区间。', url: 'https://www.volkswagen.com/news/xpeng-jv', source: 'volkswagen.com', published_at: '2026-05-27T10:30:00Z' },
        { title: '斯柯达推出 Elroq 紧凑型纯电 SUV', snippet: '斯柯达品牌推出全新紧凑型纯电 SUV Elroq，基于 MEB+ 平台，续航 480 公里，欧洲起售价 €33,900，将于 2026 Q3 交付。', url: 'https://www.volkswagen.com/news/elroq', source: 'volkswagen.com', published_at: '2026-05-24T13:00:00Z' },
        { title: '大众 ID.Buzz 长轴距版美国上市，起售价 $59,995', snippet: '大众 ID.Buzz 长轴距版（LWB）正式登陆美国市场，搭载 91 kWh 电池和 7 座布局，EPA 续航 380 公里，起售价 $59,995。', url: 'https://www.volkswagen.com/news/idbuzz-us', source: 'volkswagen.com', published_at: '2026-05-21T09:00:00Z' },
        { title: 'CARIAD 软件部门重组，独立运营', snippet: '大众集团宣布 CARIAD 软件部门完成重组，拆分为 CARIAD SDV（软件平台）和 CARIAD ADAS（自动驾驶）两个独立子公司。', url: 'https://www.volkswagen.com/news/cariad-restruct', source: 'volkswagen.com', published_at: '2026-05-18T15:45:00Z' },
        { title: '大众 Scout 越野品牌复活，电动皮卡 Traveler 量产', snippet: '大众集团旗下 Scout Motors 复活 Scout 越野品牌，首款车型纯电皮卡 Traveler 在南卡罗来纳工厂开始量产，起售价 $51,500。', url: 'https://www.volkswagen.com/news/scout-traveler', source: 'volkswagen.com', published_at: '2026-05-15T11:30:00Z' },
      ],
    },
    {
      id: 'toyota', name: 'Toyota 丰田', region: 'intl', domain: 'toyota.com',
      news: [
        { title: '丰田 bZ4X 改款上市，CLTC 续航提升至 720 公里', snippet: '丰田发布 bZ4X 2027 款，搭载宁德时代 LFP 磷酸铁锂电池包，CLTC 续航提升至 720 公里，30–80% 快充时间缩短至 18 分钟。', url: 'https://global.toyota/en/news/bz4x-2027', source: 'toyota.com', published_at: '2026-06-13T05:00:00Z' },
        { title: '丰田与雷克萨斯宣布 2028 年欧/美/中全 BEV 化', snippet: '丰田汽车宣布加速电动化：到 2028 年，丰田和雷克萨斯在欧洲、美国和中国市场销售的所有车型将全部为纯电动（BEV），停售燃油和混动车型。', url: 'https://global.toyota/en/news/bev-roadmap', source: 'toyota.com', published_at: '2026-06-09T14:00:00Z' },
        { title: '丰田与比亚迪合资纯电车型 bZ3 在中国月销破 2 万', snippet: '丰田与比亚迪合资研发的纯电轿车 bZ3 在中国市场月销突破 2 万辆，单价 16.98 万元起，已成为合资品牌中最畅销的纯电轿车。', url: 'https://global.toyota/en/news/bz3-sales', source: 'toyota.com', published_at: '2026-06-06T10:30:00Z' },
        { title: '丰田固态电池 2027 年小批量装车验证', snippet: '丰田宣布固态电池研发取得关键突破，2027 年将在雷克萨斯车型上小批量装车验证，能量密度目标 450 Wh/kg，10 分钟充满。', url: 'https://global.toyota/en/news/ssb-2027', source: 'toyota.com', published_at: '2026-06-03T08:15:00Z' },
        { title: '丰田发布全新 Hilux BEV 电动皮卡概念车', snippet: '丰田在泰国车展发布 Hilux BEV 电动皮卡概念车，搭载双电机四驱系统，WLTP 续航 400 公里，规划 2027 年量产，瞄准东南亚和澳洲市场。', url: 'https://global.toyota/en/news/hilux-bev', source: 'toyota.com', published_at: '2026-05-31T13:45:00Z' },
        { title: '丰田凯美瑞第九代推出 PHEV 版，纯电续航 100 公里', snippet: '丰田发布第九代凯美瑞，首次提供 PHEV 插混版本，搭载 2.5L 发动机和 18.5 kWh 电池包，纯电续航 100 公里，预计 2026 Q4 上市。', url: 'https://global.toyota/en/news/camry-9-phev', source: 'toyota.com', published_at: '2026-05-28T11:00:00Z' },
        { title: '丰田在巴西投资 18 亿美元扩产混动车型', snippet: '丰田宣布在巴西圣保罗工厂追加投资 18 亿美元，用于扩产 Corolla Cross 混动版和 Yaris Cross 混动版，应对拉美市场强劲需求。', url: 'https://global.toyota/en/news/brazil-invest', source: 'toyota.com', published_at: '2026-05-25T15:30:00Z' },
        { title: '雷克萨斯 RZ 改款上市，CLTC 续航提升至 650 公里', snippet: '雷克萨斯 RZ 纯电 SUV 改款上市，搭载 90 kWh 电池包和 DIRECT4 四驱系统，CLTC 续航 650 公里，新增 L2+ 智驾系统。', url: 'https://global.toyota/en/news/rz-2027', source: 'toyota.com', published_at: '2026-05-22T09:00:00Z' },
        { title: '丰田与住友商事合作回收电动车电池', snippet: '丰田与住友商事签署合作协议，将在日本、爱尔兰和泰国建立电动车电池回收网络，目标 2030 年实现 100% 退役电池回收利用。', url: 'https://global.toyota/en/news/battery-recycling', source: 'toyota.com', published_at: '2026-05-19T14:00:00Z' },
        { title: '丰田 GR Yaris EV 性能版 2027 年上市', snippet: '丰田 GR 部门宣布 GR Yaris 电动版将于 2027 年上市，搭载三电机四驱系统，最大功率 600 马力，0-100 km/h 加速小于 2.5 秒。', url: 'https://global.toyota/en/news/gr-yaris-ev', source: 'toyota.com', published_at: '2026-05-16T10:00:00Z' },
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
