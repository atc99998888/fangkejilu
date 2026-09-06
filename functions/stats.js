// 内存缓存，避免频繁重复请求外部 API
const ipCache = new Map();

// 辅助函数：将 GBK Buffer 转为 UTF-8 字符串（太平洋电脑网接口返回 GBK 编码）
function decodeGBK(buffer) {
  try {
    const decoder = new TextDecoder('gbk');
    return decoder.decode(buffer);
  } catch (e) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

// 核心函数：免 Key 高精度 IP 解析（太平洋电脑网 + IP-API 备用）
async function fetchAccurateGeo(ip) {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { country: 'CN', city: '局域网/本地' };
  }

  // 清洗 IP，防止带有掩码或空格（例如 "114.114.114.114/24" -> "114.114.114.114"）
  let cleanIp = ip.split('/')[0].trim();
  if (cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
    return { country: 'CN', city: '局域网/本地' };
  }

  // 1. 读取缓存
  if (ipCache.has(cleanIp)) {
    return ipCache.get(cleanIp);
  }

  // === 方案 A：太平洋电脑网免 Key 公共接口（国内极速、含省市和运营商） ===
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`http://whois.pconline.com.cn/ipJson.jsp?ip=${cleanIp}&json=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const text = decodeGBK(buffer);
      const data = JSON.parse(text);

      if (data && (data.pro || data.city || data.addr)) {
        let fullInfo = '';
        const pro = data.pro ? data.pro.trim() : '';
        const city = data.city ? data.city.trim() : '';
        const addr = data.addr ? data.addr.trim() : '';

        if (pro && city && pro !== city) {
          fullInfo = `${pro} ${city} ${addr}`.trim();
        } else {
          fullInfo = `${addr || pro || city}`.trim();
        }

        // 清理掉前缀“中国”等重复词汇
        fullInfo = fullInfo.replace(/^中国\s*/, '').replace(/\s+/g, ' ');

        if (fullInfo) {
          const result = { country: 'CN', city: fullInfo };
          ipCache.set(cleanIp, result);
          return result;
        }
      }
    }
  } catch (e) {
    console.error(`太平洋 IP 接口请求失败 (${cleanIp}):`, e.message);
  }

  // === 方案 B：IP-API 备用接口（免费、免 Key、支持中文） ===
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`http://ip-api.com/json/${cleanIp}?lang=zh-CN`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const province = data.regionName || '';
        const city = data.city || '';
        const isp = data.isp || '';
        const fullInfo = `${province} ${city} ${isp}`.trim().replace(/\s+/g, ' ');

        const result = {
          country: data.countryCode || 'CN',
          city: fullInfo || '未知城市'
        };
        ipCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (err) {
    console.error(`IP-API 接口请求失败 (${cleanIp}):`, err.message);
  }

  return { country: 'CN', city: '未知城市' };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // 后台访问密码
  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  // 检查 D1 数据库绑定
  if (!env || !env.DB) {
    return new Response("数据库未绑定：请在 Cloudflare Pages 设置中绑定名为 DB 的 D1 数据库", { status: 500 });
  }

  try {
    // 初始化数据表
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, ip TEXT DEFAULT 'Unknown', city TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', visit_time DATETIME DEFAULT CURRENT_TIMESTAMP);");

    // 1. 获取【今日】与【昨日】访问总量
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

    // 实时高精度 IP 解析
    const processDetails = async (rows) => {
      if (!rows || rows.length === 0) return [];
      
      return await Promise.all(rows.map(async (row) => {
        const ip = row.ip || row.client_ip || 'Unknown';
        let country = 'CN';
        let city = '未知城市';

        if (ip !== 'Unknown') {
          const accurateGeo = await fetchAccurateGeo(ip);
          if (accurateGeo) {
            country = accurateGeo.country;
            city = accurateGeo.city;
          }
        }

        return {
          ...row,
          ip: ip,
          country: country,
          city: city,
          displayIp: escapeHtml(ip),
          displayCountry: translateCountry(country),
          displayCity: city
        };
      }));
    };

    // 2. 查询今日与昨日明细数据
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

    // 3. 获取最近 7 天访问趋势
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

    // 4. 域名排行榜
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

    // 5. 城市排行榜聚合
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

    // 表格渲染辅助函数
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

    // 域名 HTML
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
                  <tr><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市 / 运营商</th></tr>
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

    // 城市 HTML
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

          <!-- 1. 顶部概览 -->
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

          <!-- 今日全量明细面板 -->
          <div class="panel" id="today-detail-panel" style="display: none; border: 2px solid #0066ff;">
            <h2 class="panel-title" style="color: #0066ff;">
              📋 今日全量访问明细（共 ${todayVisits} 条记录）
              <span class="sub-tip">⏱️ 今日 00:00 至今</span>
            </h2>
            <div style="overflow-x: auto; max-height: 400px;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市 / 运营商</th></tr>
                </thead>
                <tbody>
                  ${todayTableRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 昨日全量明细面板 -->
          <div class="panel" id="yesterday-detail-panel" style="display: none; border: 2px solid #8e44ad;">
            <h2 class="panel-title" style="color: #8e44ad;">
              📜 昨日全量访问明细（共 ${yesterdayVisits} 条记录）
              <span class="sub-tip" style="color: #8e44ad;">⏱️ 昨日全天</span>
            </h2>
            <div style="overflow-x: auto; max-height: 400px;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>省份 / 城市 / 运营商</th></tr>
                </thead>
                <tbody>
                  ${yesterdayTableRowsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. 最近 7 天访问趋势图 -->
          <div class="panel">
            <h2 class="panel-title">📈 最近 7 天访问趋势图</h2>
            <div class="chart-container">
              <canvas id="trendChart"></canvas>
            </div>
          </div>

          <!-- 3. 今日域名排行榜 -->
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

          <!-- 4. 城市与运营商排行榜 -->
          <div class="panel">
            <h2 class="panel-title">
              🏙️ 热门访问地区 / 运营商排行榜 (点击展开明细)
              <span class="sub-tip">⏱️ 免 Key 高精度中文解析</span>
            </h2>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 70px; text-align: center;">排名</th>
                    <th>国家 / 地区</th>
                    <th>省份 / 城市 / 运营商</th>
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
