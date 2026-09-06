// ==========================================
// 1. 国内省市拼音 -> 中文映射字典 (覆盖全国主要省市)
// ==========================================
const PINYIN_TO_CHINESE = {
  // 省份/直辖市拼音
  'shaanxi': '陕西', 'shanxi': '山西', 'shandong': '山东', 'henan': '河南', 'hebei': '河北',
  'hunan': '湖南', 'hubei': '湖北', 'guangdong': '广东', 'guangxi': '广西', 'sichuan': '四川',
  'zhejiang': '浙江', 'jiangsu': '江苏', 'fujian': '福建', 'liaoning': '辽宁', 'jilin': '吉林',
  'heilongjiang': '黑龙江', 'yunnan': '云南', 'guizhou': '贵州', 'gansu': '甘肃', 'qinghai': '青海',
  'inner mongolia': '内蒙古', 'neimenggu': '内蒙古', 'xinjiang': '新疆', 'tibet': '西藏', 'xizang': '西藏',
  'hainan': '海南', 'ningxia': '宁夏', 'jiangxi': '江西', 'anhui': '安徽', 'taiwan': '台湾',
  'beijing': '北京', 'shanghai': '上海', 'tianjin': '天津', 'chongqing': '重庆', 'hong kong': '香港',
  'hongkong': '香港', 'macau': '澳门', 'macao': '澳门',

  // 主要城市拼音
  'yulin': '榆林', 'xian': '西安', 'xianyang': '咸阳', 'baoji': '宝鸡', 'weinan': '渭南', 'yanan': '延安',
  'hanzhong': '汉中', 'ankang': '安康', 'shangluo': '商洛', 'tongchuan': '铜川',
  'guangzhou': '广州', 'shenzhen': '深圳', 'dongguan': '东莞', 'foshan': '佛山', 'zhuhai': '珠海',
  'huizhou': '惠州', 'zhongshan': '中山', 'jiangmen': '江门', 'zhanjiang': '湛江', 'shantou': '汕头',
  'hangzhou': '杭州', 'ningbo': '宁波', 'wenzhou': '温州', 'jiaxing': '嘉兴', 'huzhou': '湖州',
  'shaoxing': '绍兴', 'jinhua': '金华', 'quzhou': '衢州', 'zhoushan': '舟山', 'taizhou': '台州',
  'nanjing': '南京', 'suzhou': '苏州', 'wuxi': '无锡', 'changzhou': '常州', 'nantong': '南通',
  'yangzhou': '扬州', 'zhenjiang': '镇江', 'huaian': '淮安', 'yancheng': '盐城', 'xuzhou': '徐州',
  'chengdu': '成都', 'mianyang': '绵阳', 'deyang': '德阳', 'yibin': '宜宾', 'nanchong': '南充',
  'wuhan': '武汉', 'xiangyang': '襄阳', 'yichang': '宜昌', 'huangshi': '黄石', 'jingzhou': '荆州',
  'changsha': '长沙', 'zhuzhou': '株洲', 'xiangtan': '湘潭', 'hengyang': '衡阳', 'shaoyang': '邵阳',
  'jinan': '济南', 'qingdao': '青岛', 'yantai': '烟台', 'weifang': '潍坊', 'jining': '济宁',
  'zibo': '淄博', 'linyi': '临沂', 'taian': '泰安', 'weihai': '威海', 'rizhao': '日照',
  'zhengzhou': '郑州', 'luoyang': '洛阳', 'kaifeng': '开封', 'xinxiang': '新乡', 'jiaozuo': '焦作',
  'fuzhou': '福州', 'xiamen': '厦门', 'quanzhou': '泉州', 'zhangzhou': '漳州', 'putian': '莆田',
  'shenyang': '沈阳', 'dalian': '大连', 'anshan': '鞍山', 'fushun': '抚顺', 'benxi': '本溪',
  'harbin': '哈尔滨', 'daqing': '大庆', 'qiqihaer': '齐齐哈尔', 'mudanjiang': '牡丹江',
  'changchun': '长春', 'jilin city': '吉林', 'siping': '四平', 'liaoyuan': '辽源',
  'shijiazhuang': '石家庄', 'tangshan': '唐山', 'qinhuangdao': '秦皇岛', 'handan': '邯郸', 'baoding': '保定',
  'taiyuan': '太原', 'datong': '大同', 'yangquan': '阳泉', 'changzhi': '长治', 'jincheng': '晋城',
  'nanchang': '南昌', 'ganzhou': '赣州', 'jiujiang': '九江', 'yichun': '宜春', 'shangrao': '上饶',
  'hefei': '合肥', 'wuhu': '芜湖', 'bengbu': '蚌埠', 'huainan': '淮南', 'maanshan': '马鞍山',
  'kunming': '昆明', 'qujing': '曲靖', 'yuxi': '玉溪', 'baoshan': '保山', 'zhaotong': '昭通',
  'guiyang': '贵阳', 'zunyi': '遵义', 'liupanshui': '六盘水', 'anshun': '安顺',
  'nanning': '南宁', 'guilin': '桂林', 'liuzhou': '柳州', 'wuzhou': '梧州', 'beihai': '北海',
  'lanzhou': '兰州', 'tianshui': '天水', 'jiayuguan': '嘉峪关', 'jinchang': '金昌',
  'xining': '西宁', 'haidong': '海东',
  'yinchuan': '银川', 'shizuishan': '石嘴山', 'wuzhong': '吴忠',
  'urumuqi': '乌鲁木齐', 'karamay': '克拉玛依',
  'hohhot': '呼和浩特', 'baotou': '包头', 'wuhai': '乌海', 'chifeng': '赤峰'
};

const PROVINCES_CN = [
  '陕西', '山西', '山东', '河南', '河北', '湖南', '湖北', '广东', '广西', 
  '四川', '浙江', '江苏', '福建', '辽宁', '吉林', '黑龙江', '云南', '贵州', 
  '甘肃', '青海', '内蒙古', '新疆', '西藏', '海南', '宁夏', '江西', '安徽', '台湾',
  '北京', '上海', '天津', '重庆', '香港', '澳门'
];

// 自动识别拼音并翻译成中文
function pinyinToChinese(text) {
  if (!text) return '';
  let lower = text.trim().toLowerCase();
  
  // 查找直接映射
  if (PINYIN_TO_CHINESE[lower]) {
    return PINYIN_TO_CHINESE[lower];
  }
  
  // 尝试逐词匹配替换
  for (let [pinyin, cn] of Object.entries(PINYIN_TO_CHINESE)) {
    if (lower.includes(pinyin)) {
      return cn;
    }
  }
  return text; // 找不到映射则返回原文本
}

// 评分函数：中文精准度评价
function evaluatePrecision(locationStr) {
  if (!locationStr || locationStr === '中国' || locationStr === '未知地区') return 0;
  
  // 匹配到具体“省+市/县”（如：陕西榆林）得分最高
  for (let prov of PROVINCES_CN) {
    if (locationStr.includes(prov)) {
      if (locationStr.length > prov.length) {
        return 3; // 精准地级市
      }
      return 1; // 仅省级
    }
  }

  // 纯中文地名给 2 分
  if (/[\u4e00-\u9fa5]/.test(locationStr)) return 2;
  return 0;
}

// 统一过滤、清洗与中文字符格式化
function cleanAndExtractLocation(provinceRaw, cityRaw) {
  let prov = pinyinToChinese(provinceRaw || '');
  let city = pinyinToChinese(cityRaw || '');

  // 1. 如果包含中文省份，进行格式化组合
  for (let p of PROVINCES_CN) {
    if (prov.includes(p) || city.includes(p)) {
      let cleanCity = city.replace(new RegExp(`^${p}`), '')
                          .replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|电信|联通|移动)$/g, '')
                          .replace(/(市|州|盟|区|县)$/, '');
      cleanCity = pinyinToChinese(cleanCity);

      if (cleanCity && cleanCity !== p && /^[\u4e00-\u9fa5]+$/.test(cleanCity)) {
        return `${p}${cleanCity}`;
      }
      return p;
    }
  }

  // 2. 清洗普通文本
  let combined = `${prov}${city}`
    .replace(/(电信|联通|移动|铁通|广电|长城宽带|教育网|阿里云|腾讯云|华为云|百度云|IDC|机房)/g, '')
    .replace(/^中国\s*/, '')
    .trim();

  combined = pinyinToChinese(combined);

  // 移除所有英文单词，确保不输出拼音
  combined = combined.replace(/[a-zA-Z]/g, '').trim();

  return combined || null;
}

// 带超时控制的异步 Fetch 封装
async function fetchWithTimeout(url, timeout = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ==========================================
// 2. 在线并发 IP 接口节点
// ==========================================

// [接口 1] 百度 OpenData（国内中文精准度第一）
async function apiBaidu(cleanIp) {
  const res = await fetchWithTimeout(`https://opendata.baidu.com/api.php?query=${encodeURIComponent(cleanIp)}&resource_id=6006&oe=utf8`);
  if (!res.ok) throw new Error('Baidu HTTP error');
  const data = await res.json();
  const loc = data?.data?.[0]?.location || '';
  const parsed = cleanAndExtractLocation('', loc);
  if (parsed) return { country: 'CN', city: parsed, score: evaluatePrecision(parsed) };
  throw new Error('Baidu parse failed');
}

// [接口 2] IP-API（全网通用，支持拼音自动转中文）
async function apiIpApi(cleanIp) {
  const res = await fetchWithTimeout(`http://ip-api.com/json/${cleanIp}?fields=status,countryCode,regionName,city&lang=zh-CN`);
  if (!res.ok) throw new Error('IpApi HTTP error');
  const data = await res.json();
  if (data && data.status === 'success') {
    const parsed = cleanAndExtractLocation(data.regionName, data.city);
    if (parsed) return { country: data.countryCode || 'CN', city: parsed, score: evaluatePrecision(parsed) };
  }
  throw new Error('IpApi parse failed');
}

// [接口 3] IpWhois（太平洋、海外及国内节点覆盖）
async function apiIpWhois(cleanIp) {
  const res = await fetchWithTimeout(`https://ipwhois.app/json/${cleanIp}?lang=zh-CN`);
  if (!res.ok) throw new Error('IpWhois HTTP error');
  const data = await res.json();
  if (data && data.success) {
    const parsed = cleanAndExtractLocation(data.region, data.city);
    if (parsed) return { country: data.country_code || 'CN', city: parsed, score: evaluatePrecision(parsed) };
  }
  throw new Error('IpWhois parse failed');
}

// [接口 4] IP.SB 节点
async function apiIpSb(cleanIp) {
  const res = await fetchWithTimeout(`https://api.ip.sb/geoip/${cleanIp}`);
  if (!res.ok) throw new Error('IP.SB HTTP error');
  const data = await res.json();
  const parsed = cleanAndExtractLocation(data.region, data.city);
  if (parsed) return { country: data.country_code || 'CN', city: parsed, score: evaluatePrecision(parsed) };
  throw new Error('IP.SB parse failed');
}

// 内存缓存字典，提升响应效率
const globalIpCache = new Map();

// ==========================================
// 3. 多源并行竞速 + 拼音转中文决策调度器
// ==========================================
async function resolveBestGlobalGeo(ip) {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { country: 'CN', city: '局域网/本地' };
  }

  let cleanIp = ip.split(',')[0].split('/')[0].trim();
  if (cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.16.')) {
    return { country: 'CN', city: '局域网/本地' };
  }

  if (globalIpCache.has(cleanIp)) {
    return globalIpCache.get(cleanIp);
  }

  // 4 个 API 并发全网竞速
  const promises = [
    apiBaidu(cleanIp),
    apiIpApi(cleanIp),
    apiIpWhois(cleanIp),
    apiIpSb(cleanIp)
  ];

  try {
    const results = await Promise.allSettled(promises);
    let bestResult = null;

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        // 匹配到满分中文“省+市”（如：“陕西榆林”），直接采用
        if (res.value.score === 3) {
          bestResult = res.value;
          break;
        }
        // 择优选择得分最高且不含拼音的结果
        if (!bestResult || res.value.score > bestResult.score) {
          bestResult = res.value;
        }
      }
    }

    if (bestResult && bestResult.city) {
      const finalData = { country: bestResult.country, city: bestResult.city };
      globalIpCache.set(cleanIp, finalData);
      return finalData;
    }
  } catch (e) {
    console.error("竞速解析失败:", e);
  }

  return { country: 'CN', city: '中国' };
}

// ==========================================
// 4. Cloudflare Pages 业务主入口
// ==========================================
export async function onRequestGet(context) {
  const { request, env } = context;

  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  if (!env || !env.DB) {
    return new Response("数据库未绑定：请在 Cloudflare Pages 设置中绑定名为 DB 的 D1 数据库", { status: 500 });
  }

  try {
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, ip TEXT DEFAULT 'Unknown', city TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', visit_time DATETIME DEFAULT CURRENT_TIMESTAMP);");

    const todayRes = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
    `).first();
    const todayVisits = todayRes?.count || 0;

    const yesterdayRes = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours', '-1 day'))
    `).first();
    const yesterdayVisits = yesterdayRes?.count || 0;

    // 批量并发处理 IP 定位
    const processDetails = async (rows) => {
      if (!rows || rows.length === 0) return [];
      
      return await Promise.all(rows.map(async (row) => {
        const realIp = row.ip || 'Unknown';
        
        // 竞速并翻译拼音为中文
        const geo = await resolveBestGlobalGeo(realIp);

        return {
          ...row,
          ip: realIp,
          country: geo.country,
          city: geo.city,
          displayIp: escapeHtml(realIp),
          displayCountry: translateCountry(geo.country),
          displayCity: geo.city
        };
      }));
    };

    const todayDetailsRaw = await env.DB.prepare(`
      SELECT domain, ip, country, city, visit_time 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
      ORDER BY id DESC
    `).all();
    const todayDetails = await processDetails(todayDetailsRaw?.results);

    const yesterdayDetailsRaw = await env.DB.prepare(`
      SELECT domain, ip, country, city, visit_time 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours', '-1 day'))
      ORDER BY id DESC
    `).all();
    const yesterdayDetails = await processDetails(yesterdayDetailsRaw?.results);

    const last7DaysRes = await env.DB.prepare(`
      SELECT DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) as date, COUNT(*) as count 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) >= DATE(DATETIME('now', '+8 hours', '-6 days'))
      GROUP BY DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours'))
      ORDER BY date ASC
    `).all();

    const last7DaysData = [];
    const dbDaysMap = {};
    (last7DaysRes?.results || []).forEach(row => { if(row.date) dbDaysMap[row.date] = row.count; });

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + 8 * 3600 * 1000 - i * 24 * 3600 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      last7DaysData.push({
        date: dateStr,
        displayDate: dateStr.slice(5),
        count: dbDaysMap[dateStr] || 0
      });
    }

    const domainRankRes = await env.DB.prepare(`
      SELECT domain, COUNT(*) as domain_total 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
      GROUP BY domain 
      ORDER BY domain_total DESC
    `).all();
    const domainRank = domainRankRes?.results || [];

    const yesterdayDomainRes = await env.DB.prepare(`
      SELECT domain, COUNT(*) as domain_total 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours', '-1 day'))
      GROUP BY domain
    `).all();
    const yesterdayDomainMap = {};
    (yesterdayDomainRes?.results || []).forEach(item => {
      yesterdayDomainMap[item.domain] = item.domain_total;
    });

    const cityRankMap = {};
    todayDetails.forEach(item => {
      const key = `${item.country}_${item.displayCity}`;
      if (!cityRankMap[key]) {
        cityRankMap[key] = { country: item.country, city: item.displayCity, city_total: 0 };
      }
      cityRankMap[key].city_total += 1;
    });

    const cityRank = Object.values(cityRankMap).sort((a, b) => b.city_total - a.city_total);

    const yesterdayCityMap = {};
    yesterdayDetails.forEach(item => {
      const key = `${item.country}_${item.displayCity}`;
      yesterdayCityMap[key] = (yesterdayCityMap[key] || 0) + 1;
    });

    const renderTableRows = (list) => {
      if (!list || list.length === 0) {
        return '<tr><td colspan="5" style="text-align:center; color:#999;">暂无访问记录</td></tr>';
      }
      return list.map(row => `
        <tr>
          <td><strong>${escapeHtml(punycodeToUnicode(row.domain))}</strong></td>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><code>${row.displayIp}</code></td>
          <td>${row.displayCountry}</td>
          <td>${row.displayCity}</td>
        </tr>
      `).join('');
    };

    const todayTableRowsHtml = renderTableRows(todayDetails);
    const yesterdayTableRowsHtml = renderTableRows(yesterdayDetails);

    const domainDetailsMap = {};
    const cityDetailsMap = {};

    todayDetails.forEach(item => {
      if (!domainDetailsMap[item.domain]) domainDetailsMap[item.domain] = [];
      domainDetailsMap[item.domain].push(item);

      const cityKey = `${item.country}_${item.displayCity}`;
      if (!cityDetailsMap[cityKey]) cityDetailsMap[cityKey] = [];
      cityDetailsMap[cityKey].push(item);
    });

    let domainRankHtml = domainRank.map((item, index) => {
      const domain = item.domain;
      const list = domainDetailsMap[domain] || [];
      const yesterdayCount = yesterdayDomainMap[domain] || 0;
      
      const innerRows = list.map(row => `
        <tr>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><code>${row.displayIp}</code></td>
          <td>${row.displayCountry}</td>
          <td>${row.displayCity}</td>
        </tr>
      `).join('');

      return `
        <tr class="clickable-row" onclick="toggleElement('domain-detail-${index}', 'domain-icon-${index}')">
          <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
          <td><strong>${escapeHtml(punycodeToUnicode(domain))}</strong> <span class="arrow-icon" id="domain-icon-${index}">▼</span></td>
          <td><span class="pv-count">${item.domain_total} 次</span></td>
          <td><span class="pv-yesterday">${yesterdayCount} 次</span></td>
        </tr>
        <tr id="domain-detail-${index}" class="detail-row" style="display: none;">
          <td colspan="4" class="detail-cell">
            <div class="inner-table-wrapper">
              <div class="inner-title">🌐 域名 <strong>${escapeHtml(punycodeToUnicode(domain))}</strong> 今日访问明细：</div>
              <table>
                <thead>
                  <tr><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市</th></tr>
                </thead>
                <tbody>
                  ${innerRows || '<tr><td colspan="4" style="text-align:center;">暂无明细记录</td></tr>'}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    let cityRankHtml = cityRank.map((item, index) => {
      const cityKey = `${item.country}_${item.city}`;
      const list = cityDetailsMap[cityKey] || [];
      const yesterdayCount = yesterdayCityMap[cityKey] || 0;

      const innerRows = list.map(row => `
        <tr>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><strong style="color:#0066ff;">${escapeHtml(punycodeToUnicode(row.domain))}</strong></td>
          <td><code>${row.displayIp}</code></td>
        </tr>
      `).join('');

      return `
        <tr class="clickable-row" onclick="toggleElement('city-detail-${index}', 'city-icon-${index}')">
          <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
          <td>${translateCountry(item.country)}</td>
          <td><strong>${item.city}</strong> <span class="arrow-icon" id="city-icon-${index}">▼</span></td>
          <td><span class="pv-count">${item.city_total} 次</span></td>
          <td><span class="pv-yesterday">${yesterdayCount} 次</span></td>
        </tr>
        <tr id="city-detail-${index}" class="detail-row" style="display: none;">
          <td colspan="5" class="detail-cell">
            <div class="inner-table-wrapper">
              <div class="inner-title">🏙️ 地区 <strong>${item.city}</strong> 今日来源域名与时间明细：</div>
              <table>
                <thead>
                  <tr><th>访问时间 (北京时间)</th><th>被访问域名</th><th>访客 IP</th></tr>
                </thead>
                <tbody>
                  ${innerRows || '<tr><td colspan="3" style="text-align:center;">暂无明细记录</td></tr>'}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
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
          
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
          .stat-card { background: #fff; padding: 16px 20px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); text-align: center; cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; }
          .stat-card:hover { border-color: #0066ff; box-shadow: 0 4px 12px rgba(0,102,255,0.15); transform: translateY(-2px); }
          .stat-card .num { font-size: 24px; font-weight: bold; color: #0066ff; margin-top: 4px; }
          .stat-card .label { font-size: 13px; color: #666; font-weight: 500; }
          .stat-card .tip { font-size: 11px; color: #0066ff; margin-top: 4px; font-weight: bold; }

          .panel { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
          .panel-title { font-size: 16px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f0f2f5; padding-bottom: 8px; color: #2c3e50; display: flex; justify-content: space-between; align-items: center; }
          .panel-title .sub-tip { font-size: 12px; color: #27ae60; font-weight: normal; }

          .chart-container { position: relative; width: 100%; height: 220px; margin-top: 10px; }
          canvas { width: 100%!important; height: 100%!important; }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th, td { border: 1px solid #eef0f3; padding: 10px; text-align: left; font-size: 13px; }
          th { background-color: #f8f9fa; color: #555; }

          tr.clickable-row { cursor: pointer; transition: background-color 0.15s ease; }
          tr.clickable-row:hover { background-color: #f0f7ff!important; }
          .arrow-icon { font-size: 10px; color: #888; margin-left: 6px; display: inline-block; transition: transform 0.2s ease; }

          .detail-cell { padding: 0!important; background-color: #fcfdfe!important; }
          .inner-table-wrapper { padding: 12px 16px; background: #f4f8fb; border-bottom: 2px solid #e1e9f0; }
          .inner-title { font-size: 12px; color: #444; margin-bottom: 8px; font-weight: 500; }
          .inner-table-wrapper table { background: #fff; }
          .inner-table-wrapper th { background-color: #eaf2f9; }

          code { background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #d63384; }

          .rank-badge { display: inline-block; width: 20px; height: 20px; line-height: 20px; border-radius: 50%; background: #e0e0e0; color: #333; font-weight: bold; font-size: 11px; text-align: center; }
          .rank-1 { background: #ffd700; color: #fff; }
          .rank-2 { background: #c0c0c0; color: #fff; }
          .rank-3 { background: #cd7f32; color: #fff; }
          .pv-count { color: #27ae60; font-weight: bold; }
          .pv-yesterday { color: #8e44ad; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 网站集群访客统计仪表盘</h1>
          </div>

          <div class="stats-grid">
            <div class="stat-card" onclick="toggleElement('today-detail-panel', 'today-icon')">
              <div class="label">今日访问量</div>
              <div class="num">${todayVisits}</div>
              <div class="tip">👇 点击展开/收起今日访问明细 <span id="today-icon">▼</span></div>
            </div>
            <div class="stat-card" onclick="toggleElement('yesterday-detail-panel', 'yesterday-icon')">
              <div class="label">昨日访问量</div>
              <div class="num">${yesterdayVisits}</div>
              <div class="tip">👇 点击展开/收起昨日访问明细 <span id="yesterday-icon">▼</span></div>
            </div>
          </div>

          <div class="panel" id="today-detail-panel" style="display: none; border: 2px solid #0066ff;">
            <h2 class="panel-title" style="color: #0066ff;">
              📋 今日全量访问明细（共 ${todayVisits} 条记录）
              <span class="sub-tip">⏱️ 今日 00:00 至今</span>
            </h2>
            <div style="overflow-x: auto; max-height: 400px;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市</th></tr>
                </thead>
                <tbody>
                  ${todayTableRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel" id="yesterday-detail-panel" style="display: none; border: 2px solid #8e44ad;">
            <h2 class="panel-title" style="color: #8e44ad;">
              📜 昨日全量访问明细（共 ${yesterdayVisits} 条记录）
              <span class="sub-tip" style="color: #8e44ad;">⏱️ 昨日全天</span>
            </h2>
            <div style="overflow-x: auto; max-height: 400px;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市</th></tr>
                </thead>
                <tbody>
                  ${yesterdayTableRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">📈 最近 7 天访问趋势图</h2>
            <div class="chart-container">
              <canvas id="trendChart"></canvas>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">
              🏆 今日域名流量排行榜 (点击展开明细)
              <span class="sub-tip">⏱️ 包含昨日数据对比</span>
            </h2>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 70px; text-align: center;">排名</th>
                    <th>访问域名</th>
                    <th>今日访问量</th>
                    <th>昨日访问量</th>
                  </tr>
                </thead>
                <tbody>
                  ${domainRankHtml || '<tr><td colspan="4" style="text-align:center;">今日暂无访问数据</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">
              🏙️ 热门访问地区排行榜 (点击展开明细)
              <span class="sub-tip">🌐 智能识别并全自动转为中文城市</span>
            </h2>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 70px; text-align: center;">排名</th>
                    <th>国家 / 地区</th>
                    <th>省份 / 城市</th>
                    <th>今日访问次数</th>
                    <th>昨日访问次数</th>
                  </tr>
                </thead>
                <tbody>
                  ${cityRankHtml || '<tr><td colspan="5" style="text-align:center;">今日暂无访问数据</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <script>
          function toggleElement(contentId, iconId) {
            const content = document.getElementById(contentId);
            const icon = document.getElementById(iconId);
            if (!content) return;
            
            const isRow = content.tagName === 'TR';
            const showStyle = isRow ? 'table-row' : 'block';

            if (content.style.display === 'none') {
              content.style.display = showStyle;
              if (icon) icon.innerText = '▲';
            } else {
              content.style.display = 'none';
              if (icon) icon.innerText = '▼';
            }
          }

          (function drawChart() {
            const chartData = ${JSON.stringify(last7DaysData)};
            const canvas = document.getElementById('trendChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            const width = rect.width;
            const height = rect.height;
            const padding = { top: 35, bottom: 35, left: 25, right: 25 };

            const counts = chartData.map(d => d.count);
            const maxVal = Math.max(...counts, 5);

            const stepX = (width - padding.left - padding.right) / (chartData.length - 1);
            const points = chartData.map((item, index) => {
              const x = padding.left + index * stepX;
              const y = height - padding.bottom - ((item.count / maxVal) * (height - padding.top - padding.bottom));
              return { x, y, count: item.count, displayDate: item.displayDate };
            });

            ctx.strokeStyle = '#f0f0f0';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            for (let i = 0; i <= 3; i++) {
              const y = padding.top + (i * (height - padding.top - padding.bottom) / 3);
              ctx.moveTo(padding.left, y);
              ctx.lineTo(width - padding.right, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
            gradient.addColorStop(0, 'rgba(0, 102, 255, 0.25)');
            gradient.addColorStop(1, 'rgba(0, 102, 255, 0.00)');

            ctx.beginPath();
            ctx.moveTo(points[0].x, height - padding.bottom);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.strokeStyle = '#0066ff';
            ctx.lineWidth = 2.5;
            points.forEach((p, i) => {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            points.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = '#0066ff';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.fillStyle = '#0066ff';
              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
              ctx.textAlign = 'center';
              ctx.fillText(p.count + '次', p.x, p.y - 10);

              ctx.fillStyle = '#666666';
              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
              ctx.fillText(p.displayDate, p.x, height - 10);
            });
          })();
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

function decodePunycodePart(input) {
  const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;
  function adapt(delta, numPoints, firstTime) {
    delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((BASE - TMIN) * TMAX) / 2) {
      delta = Math.floor(delta / (BASE - TMIN));
      k += BASE;
    }
    return Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
  }

  let output = [];
  let basicIdx = input.lastIndexOf('-');
  if (basicIdx > 0) {
    for (let j = 0; j < basicIdx; ++j) {
      output.push(input.charCodeAt(j));
    }
    input = input.slice(basicIdx + 1);
  }

  let n = INITIAL_N, i = 0, bias = INITIAL_BIAS;
  let inIdx = 0;
  while (inIdx < input.length) {
    let oldI = i, w = 1, k = BASE;
    while (true) {
      if (inIdx >= input.length) return input;
      let code = input.charCodeAt(inIdx++);
      let digit = code - 48 < 10 ? code - 22 : code - 65 < 26 ? code - 65 : code - 97 < 26 ? code - 97 : BASE;
      i += digit * w;
      let t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      k += BASE;
    }
    bias = adapt(i - oldI, output.length + 1, oldI === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

function punycodeToUnicode(domain) {
  if (!domain) return '';
  return domain.split('.').map(part => {
    return part.startsWith('xn--') ? decodePunycodePart(part.slice(4)) : part;
  }).join('.');
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
