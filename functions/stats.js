export async function onRequestGet(context) {
  const { request, env } = context;

  // 后台访问密码
  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  // 检查 D1 绑定是否存在
  if (!env || !env.DB) {
    return new Response("数据库未绑定：请在 Cloudflare Pages 设置中绑定名为 DB 的 D1 数据库", { status: 500 });
  }

  try {
    // 自动初始化数据表
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, ip TEXT DEFAULT 'Unknown', city TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', visit_time DATETIME DEFAULT CURRENT_TIMESTAMP);");

    // 1. 获取【今日访问量】与【昨日访问量】
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

    // 2. 查询【今日】与【昨日】的全量明细记录
    const todayDetailsRes = await env.DB.prepare(`
      SELECT domain, ip, country, city, visit_time 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
      ORDER BY id DESC
    `).all();
    const todayDetails = todayDetailsRes?.results || [];

    const yesterdayDetailsRes = await env.DB.prepare(`
      SELECT domain, ip, country, city, visit_time 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours', '-1 day'))
      ORDER BY id DESC
    `).all();
    const yesterdayDetails = yesterdayDetailsRes?.results || [];

    // 3. 获取最近 7 天每日访问量
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

    // 4. 查询【今日】与【昨日】域名数据
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

    // 5. 查询【今日】与【昨日】城市数据（全量排列）
    const cityRankRes = await env.DB.prepare(`
      SELECT country, city, COUNT(*) as city_total 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
      GROUP BY country, city 
      ORDER BY city_total DESC
    `).all();
    const cityRank = cityRankRes?.results || [];

    const yesterdayCityRes = await env.DB.prepare(`
      SELECT country, city, COUNT(*) as city_total 
      FROM visits 
      WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours', '-1 day'))
      GROUP BY country, city
    `).all();
    const yesterdayCityMap = {};
    (yesterdayCityRes?.results || []).forEach(item => {
      yesterdayCityMap[`${item.country}_${item.city}`] = item.city_total;
    });

    // 渲染通用顶部卡片明细表格
    const renderTableRows = (list) => {
      if (!list || list.length === 0) {
        return '<tr><td colspan="5" style="text-align:center; color:#999;">暂无访问记录</td></tr>';
      }
      return list.map(row => `
        <tr>
          <td><strong>${escapeHtml(punycodeToUnicode(row.domain))}</strong></td>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
          <td>${translateCountry(row.country)}</td>
          <td>${translateCity(row.city)}</td>
        </tr>
      `).join('');
    };

    const todayTableRowsHtml = renderTableRows(todayDetails);
    const yesterdayTableRowsHtml = renderTableRows(yesterdayDetails);

    // 构建【按域名归类】和【按城市归类】的数据映射
    const domainDetailsMap = {};
    const cityDetailsMap = {};
    // 地图数据映射（城市中文名 -> 访问量）
    const mapCityCountData = {};

    todayDetails.forEach(item => {
      if (!domainDetailsMap[item.domain]) domainDetailsMap[item.domain] = [];
      domainDetailsMap[item.domain].push(item);

      const cityKey = `${item.country}_${item.city}`;
      if (!cityDetailsMap[cityKey]) cityDetailsMap[cityKey] = [];
      cityDetailsMap[cityKey].push(item);

      const zhCity = translateCity(item.city);
      if (zhCity !== '未知城市') {
        mapCityCountData[zhCity] = (mapCityCountData[zhCity] || 0) + 1;
      }
    });

    // 生成散点地图所需格式：[{name: '北京', value: [116.46, 39.92, 12]}, ...]
    const cityGeoCoords = getCityGeoCoords();
    const mapDataArray = [];
    Object.keys(mapCityCountData).forEach(cityName => {
      const coord = cityGeoCoords[cityName];
      if (coord) {
        mapDataArray.push({
          name: cityName,
          value: [...coord, mapCityCountData[cityName]]
        });
      }
    });

    // 1. 生成可展开的域名排行榜 HTML
    let domainRankHtml = domainRank.map((item, index) => {
      const domain = item.domain;
      const list = domainDetailsMap[domain] || [];
      const yesterdayCount = yesterdayDomainMap[domain] || 0;
      
      const innerRows = list.map(row => `
        <tr>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
          <td>${translateCountry(row.country)}</td>
          <td>${translateCity(row.city)}</td>
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
                  <tr><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
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

    // 2. 生成可展开的城市排行榜 HTML (全量展示)
    let cityRankHtml = cityRank.map((item, index) => {
      const cityKey = `${item.country}_${item.city}`;
      const list = cityDetailsMap[cityKey] || [];
      const yesterdayCount = yesterdayCityMap[cityKey] || 0;

      const innerRows = list.map(row => `
        <tr>
          <td><code>${formatDate(row.visit_time)}</code></td>
          <td><strong style="color:#0066ff;">${escapeHtml(punycodeToUnicode(row.domain))}</strong></td>
          <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
        </tr>
      `).join('');

      return `
        <tr class="clickable-row" onclick="toggleElement('city-detail-${index}', 'city-icon-${index}')">
          <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
          <td>${translateCountry(item.country)}</td>
          <td><strong>${translateCity(item.city)}</strong> <span class="arrow-icon" id="city-icon-${index}">▼</span></td>
          <td><span class="pv-count">${item.city_total} 次</span></td>
          <td><span class="pv-yesterday">${yesterdayCount} 次</span></td>
        </tr>
        <tr id="city-detail-${index}" class="detail-row" style="display: none;">
          <td colspan="5" class="detail-cell">
            <div class="inner-table-wrapper">
              <div class="inner-title">🏙️ 城市 <strong>${translateCity(item.city)}</strong> 今日来源域名与时间明细：</div>
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
        <!-- 引入 ECharts 库与中国地图 JS -->
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/china.js"></script>
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
          .map-container { position: relative; width: 100%; height: 460px; margin-top: 10px; }
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

          code { 
            background: #f1f3f5; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: monospace; 
            font-size: 12px; 
            color: #d63384; 
            max-width: 170px;
            display: inline-block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
          }

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
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
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
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
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

          <!-- 3. 今日城市分布式访客地图 (ECharts 城市散点图) -->
          <div class="panel">
            <h2 class="panel-title">
              📍 今日城市分布式访客地图
              <span class="sub-tip">💡 气泡大小与颜色代表访客量级别（点击查看具体数据）</span>
            </h2>
            <div id="chinaMap" class="map-container"></div>
          </div>

          <!-- 4. 今日域名排行榜 -->
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

          <!-- 5. 城市排行榜 -->
          <div class="panel">
            <h2 class="panel-title">
              🏙️ 热门访问城市排行榜 (点击展开明细)
              <span class="sub-tip">⏱️ 已列出所有城市及昨日对比</span>
            </h2>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 70px; text-align: center;">排名</th>
                    <th>国家 / 地区</th>
                    <th>城市</th>
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

          // 绘制 7 天趋势图
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

          // 绘制城市分布散点地图 (ECharts)
          (function initMap() {
            const mapDom = document.getElementById('chinaMap');
            if (!mapDom) return;
            const myChart = echarts.init(mapDom);

            // 数据格式：[{name: '深圳', value: [114.07, 22.62, 15]}, ...]
            const mapData = ${JSON.stringify(mapDataArray)};

            const values = mapData.map(d => d.value[2]);
            const maxVal = Math.max(...values, 10);
            const minVal = 1;

            const option = {
              backgroundColor: '#ffffff',
              tooltip: {
                trigger: 'item',
                formatter: function (params) {
                  if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
                    const count = params.value[2];
                    return '📍 <strong>' + params.name + '</strong><br/>今日访客量：<strong style="color:#ff4d4f; font-size: 15px;">' + count + '</strong> 次';
                  }
                  return params.name;
                }
              },
              visualMap: {
                min: minVal,
                max: maxVal,
                splitNumber: 5,
                left: '20',
                bottom: '20',
                dimension: 2, // 对应 value 数组中的第 3 个元素（访客量）
                text: ['高', '低'],
                title: ['今日访客量级别'],
                realtime: false,
                calculable: true,
                inRange: {
                  color: ['#56b4e9', '#0072b2', '#e69f00', '#d55e00', '#cc0000'],
                  symbolSize: [10, 30] // 气泡根据数值从 10px 到 30px 变大
                },
                textStyle: {
                  color: '#333',
                  fontSize: 12
                }
              },
              geo: {
                map: 'china',
                roam: true,
                zoom: 1.25,
                label: {
                  show: false
                },
                itemStyle: {
                  normal: {
                    areaColor: '#f3f4f6',
                    borderColor: '#d1d5db',
                    borderWidth: 1
                  },
                  emphasis: {
                    areaColor: '#e5e7eb'
                  }
                }
              },
              series: [
                {
                  name: '城市访客量',
                  type: 'effectScatter', // 带有涟漪光圈动画的散点
                  coordinateSystem: 'geo',
                  data: mapData,
                  showEffectOn: 'render',
                  rippleEffect: {
                    brushType: 'stroke',
                    scale: 3,
                    period: 4
                  },
                  hoverAnimation: true,
                  label: {
                    formatter: '{b}',
                    position: 'right',
                    show: true,
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: '#1f2937'
                  },
                  itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.2)'
                  },
                  zlevel: 1
                }
              ]
            };

            myChart.setOption(option);

            // 点击散点显示提示框
            myChart.on('click', function (params) {
              if (params.seriesType === 'effectScatter') {
                alert('📍 城市：' + params.name + '\n📊 今日访客量：' + params.value[2] + ' 次');
              }
            });

            window.addEventListener('resize', () => myChart.resize());
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

// 常见城市经纬度对照字典
function getCityGeoCoords() {
  return {
    '北京': [116.46, 39.92], '上海': [121.48, 31.22], '天津': [117.20, 39.13], '重庆': [106.54, 29.59],
    '香港': [114.17, 22.28], '澳门': [113.54, 22.19], '台北': [121.50, 25.05], '高雄': [120.31, 22.61],
    '广州': [113.23, 23.16], '深圳': [114.07, 22.62], '珠海': [113.52, 22.30], '汕头': [116.69, 23.39],
    '佛山': [113.11, 23.05], '韶关': [113.62, 24.84], '湛江': [110.359, 21.27], '肇庆': [112.47, 23.05],
    '江门': [113.06, 22.61], '茂名': [110.88, 21.68], '惠州': [114.41, 23.09], '梅州': [116.1, 24.3],
    '汕尾': [115.37, 22.78], '河源': [114.68, 23.73], '阳江': [111.95, 21.85], '清远': [113.01, 23.7],
    '东莞': [113.75, 23.04], '中山': [113.38, 22.52], '潮州': [116.63, 23.68], '揭阳': [116.35, 23.55], '云浮': [112.02, 22.93],
    '太原': [112.53, 37.87], '大同': [113.30, 40.12], '济南': [117.00, 36.65], '青岛': [120.33, 36.07],
    '烟台': [121.39, 37.52], '潍坊': [119.10, 36.62], '临沂': [118.35, 35.05], '杭州': [120.19, 30.26],
    '宁波': [121.56, 29.86], '温州': [120.65, 28.01], '嘉兴': [120.76, 30.77], '湖州': [120.10, 30.86],
    '绍兴': [120.58, 30.01], '金华': [119.64, 29.12], '台州': [121.42, 28.66], '南京': [118.78, 32.04],
    '无锡': [120.29, 31.59], '徐州': [117.20, 34.26], '常州': [119.95, 31.79], '苏州': [120.62, 31.32],
    '南通': [120.86, 32.01], '扬州': [119.42, 32.39], '镇江': [119.44, 32.20], '郑州': [113.65, 34.76],
    '洛阳': [112.44, 34.70], '武汉': [114.31, 30.52], '宜昌': [111.30, 30.70], '襄阳': [112.14, 32.04],
    '长沙': [112.98, 28.19], '株洲': [113.16, 27.83], '衡阳': [112.61, 26.89], '岳阳': [113.09, 29.37],
    '成都': [104.06, 30.67], '绵阳': [104.73, 31.48], '德阳': [104.38, 31.13], '宜宾': [104.56, 28.77],
    '福州': [119.30, 26.08], '厦门': [118.10, 24.46], '泉州': [118.58, 24.93], '合肥': [117.27, 31.86],
    '芜湖': [118.37, 31.33], '石家庄': [114.48, 38.03], '唐山': [118.18, 39.63], '沈阳': [123.38, 41.80],
    '大连': [121.62, 38.92], '长春': [125.32, 43.86], '哈尔滨': [126.63, 45.75], '南昌': [115.89, 28.68],
    '赣州': [114.92, 25.85], '西安': [108.95, 34.27], '兰州': [103.73, 36.03], '西宁': [101.74, 36.56],
    '银川': [106.27, 38.47], '乌鲁木齐': [87.68, 43.77], '拉萨': [91.11, 29.97], '南宁': [108.33, 22.84],
    '桂林': [110.28, 25.29], '昆明': [102.71, 25.04], '贵阳': [106.71, 26.57], '海口': [110.35, 20.02],
    '三亚': [109.51, 18.25]
  };
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
