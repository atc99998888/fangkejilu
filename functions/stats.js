export async function onRequestGet(context) {
  const { request, env } = context;

  // 后台访问密码（可自由修改）
  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  try {
    // 自动全新初始化数据表（单行 SQL）
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, ip TEXT DEFAULT 'Unknown', city TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', visit_time DATETIME DEFAULT CURRENT_TIMESTAMP);");

    // 1. 查询全站总访问量
    const totalVisitsRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM visits`).first();
    const totalVisits = totalVisitsRes?.total || 0;

    // 2. 查询域名排行榜
    const domainRankRes = await env.DB.prepare(`
      SELECT domain, COUNT(*) as domain_total 
      FROM visits 
      GROUP BY domain 
      ORDER BY domain_total DESC
    `).all();
    const domainRank = domainRankRes?.results || [];

    // 3. 查询城市排行榜
    const cityRankRes = await env.DB.prepare(`
      SELECT country, city, COUNT(*) as city_total 
      FROM visits 
      GROUP BY country, city 
      ORDER BY city_total DESC 
      LIMIT 15
    `).all();
    const cityRank = cityRankRes?.results || [];

    // 4. 查询各域名下的详细访问记录（包含时间、IP、国家、城市）
    const detailsRes = await env.DB.prepare(`
      SELECT domain, ip, country, city, visit_time 
      FROM visits 
      ORDER BY id DESC
    `).all();
    const details = detailsRes?.results || [];

    const totalDomains = domainRank.length;
    const uniqueCities = new Set(details.map(d => d.city)).size;

    const groupedDetails = {};
    details.forEach(item => {
      if (!groupedDetails[item.domain]) {
        groupedDetails[item.domain] = [];
      }
      groupedDetails[item.domain].push(item);
    });

    // 域名排行榜 HTML（通过 decodeDomain 处理中文域名）
    let domainRankHtml = domainRank.map((item, index) => `
      <tr>
        <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
        <td><strong class="domain-name" data-domain="${escapeHtml(item.domain)}">${escapeHtml(decodeDomain(item.domain))}</strong></td>
        <td><span class="pv-count">${item.domain_total} 次</span></td>
      </tr>
    `).join('');

    // 城市排行榜 HTML
    let cityRankHtml = cityRank.map((item, index) => `
      <tr>
        <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
        <td>${translateCountry(item.country)}</td>
        <td><strong>${translateCity(item.city)}</strong></td>
        <td><span class="pv-count">${item.city_total} 次</span></td>
      </tr>
    `).join('');

    // 各域名明细卡片 HTML（支持点击展开/折叠）
    let domainCardsHtml = domainRank.map((item, index) => {
      const domain = item.domain;
      const decodedDomainName = decodeDomain(domain);
      const list = groupedDetails[domain] || [];
      const rows = list.map(row => `
        <tr>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
          <td>${translateCountry(row.country)}</td>
          <td>${translateCity(row.city)}</td>
        </tr>
      `).join('');

      return `
        <div class="domain-card">
          <div class="domain-header" onclick="toggleCard(${index})">
            <h3>🌐 访问域名：<span class="domain-name" data-domain="${escapeHtml(domain)}">${escapeHtml(decodedDomainName)}</span> <span class="toggle-icon" id="icon-${index}">▼</span></h3>
            <span class="domain-total-badge">该域名总访客：${item.domain_total} 次</span>
          </div>
          <div class="domain-content" id="content-${index}" style="display: none;">
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="4" style="text-align:center;">暂无明细数据</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>多域名访客数据统计控制台</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background: #f0f2f5; color: #333; margin: 0; }
          .container { max-width: 1000px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #1a1a1a; font-size: 22px; }
          
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
          .stat-card { background: #fff; padding: 12px 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); text-align: center; }
          .stat-card .num { font-size: 20px; font-weight: bold; color: #0066ff; margin-top: 2px; }
          .stat-card .label { font-size: 12px; color: #666; }

          .panel { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
          .panel-title { font-size: 16px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f0f2f5; padding-bottom: 8px; color: #2c3e50; }

          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #eef0f3; padding: 10px; text-align: left; font-size: 13px; }
          th { background-color: #f8f9fa; color: #555; }
          tr:nth-child(even) { background-color: #fafbfc; }

          code { background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #d63384; }

          .rank-badge { display: inline-block; width: 20px; height: 20px; line-height: 20px; border-radius: 50%; background: #e0e0e0; color: #333; font-weight: bold; font-size: 11px; text-align: center; }
          .rank-1 { background: #ffd700; color: #fff; }
          .rank-2 { background: #c0c0c0; color: #fff; }
          .rank-3 { background: #cd7f32; color: #fff; }
          .pv-count { color: #27ae60; font-weight: bold; }

          .domain-card { background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
          .domain-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
          .domain-header h3 { margin: 0; font-size: 15px; color: #333; display: flex; align-items: center; gap: 8px; }
          .domain-header h3 span { color: #0066ff; }
          .toggle-icon { font-size: 11px; color: #888; transition: transform 0.2s ease; }
          .domain-total-badge { background: #e8f3ff; color: #0066ff; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
          .domain-content { margin-top: 12px; border-top: 1px dashed #eef0f3; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 网站集群访客统计仪表盘</h1>
          </div>

          <!-- 1. 概览 -->
          <div class="stats-grid">
            <div class="stat-card"><div class="label">全站总访问量 (PV)</div><div class="num">${totalVisits}</div></div>
            <div class="stat-card"><div class="label">已被访问域名数</div><div class="num">${totalDomains}</div></div>
            <div class="stat-card"><div class="label">覆盖城市数</div><div class="num">${uniqueCities}</div></div>
          </div>

          <!-- 2. 域名排行榜 -->
          <div class="panel">
            <h2 class="panel-title">🏆 域名流量排行榜</h2>
            <table>
              <thead>
                <tr><th style="width: 70px; text-align: center;">排名</th><th>访问域名</th><th>累计访客量</th></tr>
              </thead>
              <tbody>
                ${domainRankHtml || '<tr><td colspan="3" style="text-align:center;">暂无数据</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 3. 城市排行榜 -->
          <div class="panel">
            <h2 class="panel-title">🏙️ 热门访问城市排行榜 (Top 15)</h2>
            <table>
              <thead>
                <tr><th style="width: 70px; text-align: center;">排名</th><th>国家 / 地区</th><th>城市</th><th>访问次数</th></tr>
              </thead>
              <tbody>
                ${cityRankHtml || '<tr><td colspan="4" style="text-align:center;">暂无数据</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 4. 各域名详细访客记录（点开折叠） -->
          <h2 style="color: #2c3e50; font-size: 16px; margin-bottom: 12px;">📍 各域名明细记录 (点击展开)</h2>
          ${domainCardsHtml || '<div class="panel" style="text-align:center; padding:20px; color:#888;">暂无数据</div>'}

        </div>

        <script>
          function toggleCard(index) {
            const content = document.getElementById('content-' + index);
            const icon = document.getElementById('icon-' + index);
            if (content.style.display === 'none') {
              content.style.display = 'block';
              icon.innerText = '▲';
            } else {
              content.style.display = 'none';
              icon.innerText = '▼';
            }
          }

          // 浏览器客户端深度渲染还原中文域名
          document.addEventListener("DOMContentLoaded", function() {
            document.querySelectorAll('.domain-name').forEach(el => {
              const rawDomain = el.getAttribute('data-domain');
              if (rawDomain && rawDomain.includes('xn--')) {
                try {
                  const url = new URL('http://' + rawDomain);
                  el.innerText = url.hostname;
                } catch(e) {}
              }
            });
          });
        </script>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return new Response(`数据库交互异常：${error.message}\n${error.stack}`, { 
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

// 解码中文域名 (Punycode 还原)
function decodeDomain(domain) {
  if (!domain) return '';
  if (!domain.includes('xn--')) return domain;
  try {
    const parsed = new URL('http://' + domain);
    return parsed.hostname;
  } catch (e) {
    return domain;
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(utcString) {
  if (!utcString) return '未知时间';
  try {
    const date = new Date(utcString + " UTC");
    if (isNaN(date.getTime())) return utcString;
    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch (e) {
    return utcString;
  }
}

function translateCountry(code) {
  const countryMap = {
    'CN': '🇨🇳 中国', 'HK': '🇭🇰 中国香港', 'MO': '🇲🇴 中国澳门', 'TW': '🇹🇼 中国台湾',
    'US': '🇺🇸 美国', 'JP': '🇯🇵 日本', 'KR': '🇰🇷 韩国', 'SG': '🇸🇬 新加坡',
    'GB': '🇬🇧 英国', 'DE': '🇩🇪 德国', 'CA': '🇨🇦 加拿大', 'AU': '🇦🇺 澳大利亚',
    'RU': '🇷🇺 俄罗斯', 'Unknown': '未知国家'
  };
  return countryMap[code] || code || '未知国家';
}

function translateCity(city) {
  if (!city || city === 'Unknown') return '未知城市';
  const cityMap = {
    'Beijing': '北京', 'Shanghai': '上海', 'Tianjin': '天津', 'Chongqing': '重庆',
    'Hong Kong': '香港', 'Macau': '澳门', 'Taipei': '台北', 'Kaohsiung': '高雄',
    'Guangzhou': '广州', 'Shenzhen': '深圳', 'Zhuhai': '珠海', 'Shantou': '汕头',
    'Foshan': '佛山', 'Shaoguan': '韶关', 'Zhanjiang': '湛江', 'Zhaoqing': '肇庆',
    'Jiangmen': '江门', 'Maoming': '茂名', 'Huizhou': '惠州', 'Meizhou': '梅州',
    'Shanwei': '汕尾', 'Heyuan': '河源', 'Yangjiang': '阳江', 'Qingyuan': '清远',
    'Dongguan': '东莞', 'Zhongshan': '中山', 'Chaozhou': '潮州', 'Jieyang': '揭阳', 'Yunfu': '云浮',
    'Taiyuan': '太原', 'Datong': '大同', 'Yangquan': '阳泉', 'Changzhi': '长治',
    'Jincheng': '晋城', 'Shuozhou': '朔州', 'Jinzhong': '晋中', 'Yuncheng': '运城',
    'Xinzhou': '忻州', 'Linfen': '临汾', 'Luliang': '吕梁',
    'Jinan': '济南', 'Qingdao': '青岛', 'Zibo': '淄博', 'Zaozhuang': '枣庄',
    'Dongying': '东营', 'Yantai': '烟台', 'Weifang': '潍坊', 'Jining': '济宁',
    'Taian': '泰安', 'Weihai': '威海', 'Rizhao': '日照', 'Linyi': '临沂',
    'Dezhou': '德州', 'Liaocheng': '聊城', 'Binzhou': '滨州', 'Heze': '菏泽',
    'Hangzhou': '杭州', 'Ningbo': '宁波', 'Wenzhou': '温州', 'Jiaxing': '嘉兴',
    'Huzhou': '湖州', 'Shaoxing': '绍兴', 'Jinhua': '金华', 'Quzhou': '衢州',
    'Zhoushan': '舟山', 'Taizhou': '台州', 'Lishui': '丽水',
    'Nanjing': '南京', 'Wuxi': '无锡', 'Xuzhou': '徐州', 'Changzhou': '常州',
    'Suzhou': '苏州', 'Nantong': '南通', 'Lianyungang': '连云港', 'Huai\'an': '淮安',
    'Huaian': '淮安', 'Yancheng': '盐城', 'Yangzhou': '扬州', 'Zhenjiang': '镇江',
    'Taizhou_JS': '泰州', 'Suqian': '宿迁',
    'Zhengzhou': '郑州', 'Kaifeng': '开封', 'Luoyang': '洛阳', 'Pingdingshan': '平顶山',
    'Anyang': '安阳', 'Hebi': '鹤壁', 'Xinxiang': '新乡', 'Jiaozuo': '焦作',
    'Puyang': '濮阳', 'Xuchang': '许昌', 'Luohe': '漯河', 'Sanmenxia': '三门峡',
    'Nanyang': '南阳', 'Shangqiu': '商丘', 'Xinyang': '信阳', 'Zhoukou': '周口',
    'Zhumadian': '驻马店', 'Jiyuan': '济源',
    'Wuhan': '武汉', 'Huangshi': '黄石', 'Shiyan': '十堰', 'Yichang': '宜昌',
    'Xiangyang': '襄阳', 'Ezhou': '鄂州', 'Jingmen': '荆门', 'Xiaogan': '孝感',
    'Jingzhou': '荆州', 'Huanggang': '黄冈', 'Xianning': '咸宁', 'Suizhou': '随州',
    'Enshi': '恩施', 'Xiantao': '仙桃', 'Tianmen': '天门', 'Qianjiang': '潜江',
    'Changsha': '长沙', 'Zhuzhou': '株洲', 'Xiangtan': '湘潭', 'Hengyang': '衡阳',
    'Shaoyang': '邵阳', 'Yueyang': '岳阳', 'Changde': '常德', 'Zhangjiajie': '张家界',
    'Yiyang': '益阳', 'Chenzhou': '郴州', 'Yongzhou': '永州', 'Huaihua': '怀化',
    'Loudi': '娄底', 'Xiangxi': '湘西',
    'Chengdu': '成都', 'Zigong': '自贡', 'Panzhihua': '攀枝花', 'Luzhou': '泸州',
    'Deyang': '德阳', 'Mianyang': '绵阳', 'Guangyuan': '广元', 'Suining': '遂宁',
    'Neijiang': '内江', 'Leshan': '乐山', 'Nanchong': '南充', 'Meishan': '眉山',
    'Yibin': '宜宾', 'Guang\'an': '广安', 'Guangan': '广安', 'Dazhou': '达州',
    'Ya\'an': '雅安', 'Yaan': '雅安', 'Bazhong': '巴中', 'Ziyang': '资阳',
    'Aba': '阿坝', 'Ganzi': '甘孜', 'Liangshan': '凉山',
    'Fuzhou': '福州', 'Xiamen': '厦门', 'Putian': '莆田', 'Sanming': '三明',
    'Quanzhou': '泉州', 'Zhangzhou': '漳州', 'Nanping': '南平', 'Longyan': '龙岩', 'Ningde': '宁德',
    'Hefei': '合肥', 'Wuhu': '芜湖', 'Bengbu': '蚌埠', 'Huainan': '淮南',
    'Ma\'anshan': '马鞍山', 'Maanshan': '马鞍山', 'Huaibei': '淮北', 'Tongling': '铜陵',
    'Anqing': '安庆', 'Huangshan': '黄山', 'Chuzhou': '滁州', 'Fuyang': '阜阳',
    'Suzhou_AH': '宿州', 'Lu\'an': '六安', 'Luan': '六安', 'Bozhou': '亳州',
    'Chizhou': '池州', 'Xuancheng': '宣城',
    'Shijiazhuang': '石家庄', 'Tangshan': '唐山', 'Qinhuangdao': '秦皇岛', 'Handan': '邯郸',
    'Xingtai': '邢台', 'Baoding': '保定', 'Zhangjiakou': '张家口', 'Chengde': '承德',
    'Cangzhou': '沧州', 'Langfang': '廊坊', 'Hengshui': '衡水',
    'Shenyang': '沈阳', 'Dalian': '大连', 'Anshan': '鞍山', 'Fushun': '抚顺',
    'Benxi': '本溪', 'Dandong': '丹东', 'Jinzhou': '锦州', 'Yingkou': '营口',
    'Fuxin': '阜新', 'Liaoyang': '辽阳', 'Panjin': '盘锦', 'Tieling': '铁岭',
    'Chaoyang': '朝阳', 'Huludao': '葫芦岛',
    'Changchun': '长春', 'Jilin': '吉林', 'Siping': '四平', 'Liaoyuan': '辽源',
    'Tonghua': '通化', 'Baishan': '白山', 'Songyuan': '松原', 'Baicheng': '白城', 'Yanbian': '延边',
    'Harbin': '哈尔滨', 'Qiqihar': '齐齐哈尔', 'Jixi': '鸡西', 'Hegang': '鹤岗',
    'Shuangyashan': '双鸭山', 'Daqing': '大庆', 'Yichun': '伊春', 'Jiamusi': '佳木斯',
    'Qitaihe': '七台河', 'Mudanjiang': '牡丹江', 'Heihe': '黑河', 'Suihua': '绥化', 'Daxinganling': '大兴安岭',
    'Nanchang': '南昌', 'Jingdezhen': '景德镇', 'Pingxiang': '萍乡', 'Jiujiang': '九江',
    'Xinyu': '新余', 'Yingtan': '鹰潭', 'Ganzhou': '赣州', 'Ji\'an': '吉安', 'Jian': '吉安',
    'Yichun_JX': '宜春', 'Fuzhou_JX': '抚州', 'Shangrao': '上饶',
    'Xi\'an': '西安', 'Xian': '西安', 'Tongchuan': '铜川', 'Baoji': '宝鸡',
    'Xianyang': '咸阳', 'Weinan': '渭南', 'Yan\'an': '延安', 'Yanan': '延安',
    'Hanzhong': '汉中', 'Yulin': '榆林', 'Ankang': '安康', 'Shangluo': '商洛',
    'Lanzhou': '兰州', 'Xining': '西宁', 'Yinchuan': '银川', 'Urumqi': '乌鲁木齐',
    'Lhasa': '拉萨', 'Kashgar': '喀什', 'Korla': '库尔勒', 'Ili': '伊犁',
    'Nanning': '南宁', 'Liuzhou': '柳州', 'Guilin': '桂林', 'Wuzhou': '梧州',
    'Beihai': '北海', 'Fangchenggang': '防城港', 'Qinzhou': '钦州', 'Guigang': '贵港',
    'Yulin_GX': '玉林', 'Baise': '百色', 'Hechi': '河池', 'Hezhou': '贺州', 'Chongzuo': '崇左',
    'Kunming': '昆明', 'Guiyang': '贵阳', 'Haikou': '海口', 'Sanya': '三亚',
    'Zunyi': '遵义', 'Dali': '大理', 'Lijiang': '丽江', 'Xishuangbanna': '西双版纳'
  };
  return cityMap[city] || city;
}
