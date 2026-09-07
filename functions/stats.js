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

    // 数据查询封装函数
    const fetchDashboardData = async () => {
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
        SELECT id, domain, ip, country, city, visit_time 
        FROM visits 
        WHERE DATE(DATETIME(COALESCE(visit_time, CURRENT_TIMESTAMP), '+8 hours')) = DATE(DATETIME('now', '+8 hours'))
        ORDER BY id DESC
      `).all();
      const todayDetails = todayDetailsRes?.results || [];

      const yesterdayDetailsRes = await env.DB.prepare(`
        SELECT id, domain, ip, country, city, visit_time 
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

      // 4. 查询域名数据
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

      // 5. 查询城市数据
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

      return {
        todayVisits,
        yesterdayVisits,
        todayDetails,
        yesterdayDetails,
        last7DaysData,
        domainRank,
        yesterdayDomainMap,
        cityRank,
        yesterdayCityMap
      };
    };

    // 如果客户端发送的是 AJAX API 轮询请求，直接返回 JSON 数据
    if (url.searchParams.get("action") === "api") {
      const data = await fetchDashboardData();
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 首次加载页面
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>直播大屏级·实时多域名数据监控</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 15px; background: #0f172a; color: #f8fafc; margin: 0; }
          .container { max-width: 1000px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 15px; }
          .header h1 { margin: 0; color: #38bdf8; font-size: 22px; letter-spacing: 0.5px; }
          
          /* 直播间风格：实时滚动新访客动效大屏播报 */
          .live-stream-box {
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 1px solid #334155;
            border-left: 4px solid #38bdf8;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .live-tag {
            background: #ef4444;
            color: #fff;
            font-size: 11px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
            margin-right: 10px;
            white-space: nowrap;
            animation: pulse-red 1.5s infinite;
          }
          @keyframes pulse-red {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          .ticker-wrapper {
            flex: 1;
            overflow: hidden;
            white-space: nowrap;
          }
          .ticker-text {
            display: inline-block;
            font-size: 13px;
            color: #e2e8f0;
            transition: transform 0.4s ease-out, opacity 0.4s ease-out;
          }

          /* 数据统计数字卡片 */
          .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 12px; 
            margin-bottom: 15px; 
          }
          .stat-card { 
            background: #1e293b; 
            padding: 14px 16px; 
            border-radius: 8px; 
            border: 1px solid #334155; 
            text-align: center; 
            cursor: pointer; 
            transition: all 0.2s ease; 
          }
          .stat-card:hover { border-color: #38bdf8; transform: translateY(-2px); }
          .stat-card .num { font-size: 28px; font-weight: 800; color: #38bdf8; margin-top: 2px; }
          .stat-card .num.flash { animation: numberBump 0.5s ease; color: #4ade80; }
          @keyframes numberBump {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          .stat-card .label { font-size: 12px; color: #94a3b8; font-weight: 500; }
          .stat-card .tip { font-size: 11px; color: #38bdf8; margin-top: 4px; font-weight: bold; }

          .panel { background: #1e293b; padding: 14px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 15px; }
          .panel-title { font-size: 15px; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 8px; color: #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
          .panel-title .sub-tip { font-size: 11px; color: #4ade80; font-weight: normal; }

          .chart-container { position: relative; width: 100%; height: 200px; margin-top: 8px; }
          canvas { width: 100%!important; height: 100%!important; }

          /* 强制横向排版与横向滚动条样式 */
          .scroll-x {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th, td { 
            border: 1px solid #334155; 
            padding: 8px 10px; 
            text-align: left; 
            font-size: 12px; 
            white-space: nowrap; /* 强制单行横向拉伸 */
          }
          th { background-color: #0f172a; color: #94a3b8; }
          td { color: #cbd5e1; }

          tr.clickable-row { cursor: pointer; transition: background-color 0.15s ease; }
          tr.clickable-row:hover { background-color: #334155!important; }
          .arrow-icon { font-size: 10px; color: #64748b; margin-left: 6px; display: inline-block; }

          .detail-cell { padding: 0!important; background-color: #0f172a!important; }
          .inner-table-wrapper { padding: 8px 10px; background: #0f172a; border-bottom: 2px solid #334155; }
          .inner-title { font-size: 11px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }
          .inner-table-wrapper table { background: #1e293b; }

          code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #f43f5e; border: 1px solid #334155; }

          .rank-badge { display: inline-block; width: 18px; height: 18px; line-height: 18px; border-radius: 50%; background: #334155; color: #fff; font-weight: bold; font-size: 10px; text-align: center; }
          .rank-1 { background: #eab308; color: #000; }
          .rank-2 { background: #94a3b8; color: #000; }
          .rank-3 { background: #d97706; color: #fff; }
          .pv-count { color: #4ade80; font-weight: bold; }
          .pv-yesterday { color: #a855f7; font-weight: bold; }

          /* 新增行的淡入动画 */
          .new-row-anim {
            animation: fadeInRow 1s ease-in-out;
          }
          @keyframes fadeInRow {
            0% { background-color: #0284c7; }
            100% { background-color: transparent; }
          }

          @media (max-width: 600px) {
            body { padding: 8px; }
            .stats-grid { gap: 8px; }
            .stat-card { padding: 10px 6px; }
            .stat-card .num { font-size: 22px; }
            .stat-card .label { font-size: 11px; }
            .stat-card .tip { font-size: 9px; }
            th, td { padding: 6px 8px; font-size: 11px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📡 网站集群实时监控大屏</h1>
          </div>

          <!-- 实时动态访客滚动播报条（类似带货大屏实时下单提醒） -->
          <div class="live-stream-box">
            <div class="live-tag">LIVE 实时访客</div>
            <div class="ticker-wrapper">
              <div class="ticker-text" id="ticker-text">正在连接数据库监控中...</div>
            </div>
          </div>

          <!-- 1. 数字概览 -->
          <div class="stats-grid">
            <div class="stat-card" onclick="toggleElement('today-detail-panel', 'today-icon')">
              <div class="label">今日实时总访问量</div>
              <div class="num" id="today-visits-num">0</div>
              <div class="tip">👇 点击展开/收起今日明细 <span id="today-icon">▼</span></div>
            </div>
            <div class="stat-card" onclick="toggleElement('yesterday-detail-panel', 'yesterday-icon')">
              <div class="label">昨日全天总访问量</div>
              <div class="num" id="yesterday-visits-num">0</div>
              <div class="tip">👇 点击展开/收起昨日明细 <span id="yesterday-icon">▼</span></div>
            </div>
          </div>

          <!-- 今日明细（横向排版+滑动） -->
          <div class="panel" id="today-detail-panel" style="display: none; border-color: #0284c7;">
            <h2 class="panel-title" style="color: #38bdf8;">
              📋 今日全量访问明细（共 <span id="today-count-span">0</span> 条记录）
              <span class="sub-tip">⏱️ 今日 00:00 至今</span>
            </h2>
            <div class="scroll-x" style="max-height: 380px; overflow-y: auto;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
                </thead>
                <tbody id="today-table-body"></tbody>
              </table>
            </div>
          </div>

          <!-- 昨日明细（横向排版+滑动） -->
          <div class="panel" id="yesterday-detail-panel" style="display: none; border-color: #9333ea;">
            <h2 class="panel-title" style="color: #c084fc;">
              📜 昨日全量访问明细（共 <span id="yesterday-count-span">0</span> 条记录）
              <span class="sub-tip" style="color: #c084fc;">⏱️ 昨日全天</span>
            </h2>
            <div class="scroll-x" style="max-height: 380px; overflow-y: auto;">
              <table>
                <thead>
                  <tr><th>访问域名</th><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
                </thead>
                <tbody id="yesterday-table-body"></tbody>
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

          <!-- 3. 今日域名排行榜（横向） -->
          <div class="panel">
            <h2 class="panel-title">
              🏆 今日域名流量排行榜 (点击展开明细)
              <span class="sub-tip">⏱️ 包含昨日数据对比</span>
            </h2>
            <div class="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th style="width: 60px; text-align: center;">排名</th>
                    <th>访问域名</th>
                    <th>今日访问量</th>
                    <th>昨日访问量</th>
                  </tr>
                </thead>
                <tbody id="domain-rank-body"></tbody>
              </table>
            </div>
          </div>

          <!-- 4. 城市排行榜（横向） -->
          <div class="panel">
            <h2 class="panel-title">
              🏙️ 热门访问城市排行榜 (点击展开明细)
              <span class="sub-tip">⏱️ 已列出所有城市及昨日对比</span>
            </h2>
            <div class="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th style="width: 60px; text-align: center;">排名</th>
                    <th>国家 / 地区</th>
                    <th>城市</th>
                    <th>今日访问次数</th>
                    <th>昨日访问次数</th>
                  </tr>
                </thead>
                <tbody id="city-rank-body"></tbody>
              </table>
            </div>
          </div>

        </div>

        <script>
          let lastMaxVisitId = 0; // 用于追踪最新的访问记录 ID
          const expandedState = {};

          function toggleElement(contentId, iconId) {
            const content = document.getElementById(contentId);
            const icon = document.getElementById(iconId);
            if (!content) return;
            
            const isRow = content.tagName === 'TR';
            const showStyle = isRow ? 'table-row' : 'block';

            if (content.style.display === 'none') {
              content.style.display = showStyle;
              expandedState[contentId] = true;
              if (icon) icon.innerText = '▲';
            } else {
              content.style.display = 'none';
              expandedState[contentId] = false;
              if (icon) icon.innerText = '▼';
            }
          }

          // 客户端解码 Punycode
          function punycodeToUnicode(domain) {
            if (!domain) return '';
            return domain; 
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
            return city;
          }

          // 核心更新 UI 函数
          function updateDashboard(data) {
            // 1. 判断是否有新访客，有则播放直播风格动效播报
            if (data.todayDetails && data.todayDetails.length > 0) {
              const latestVisit = data.todayDetails[0];
              if (latestVisit.id && latestVisit.id > lastMaxVisitId) {
                if (lastMaxVisitId !== 0) {
                  // 触发出单式滚动播报动画
                  pushTickerNotice(latestVisit);
                  // 数字高亮跳动
                  const todayNumEl = document.getElementById('today-visits-num');
                  todayNumEl.classList.remove('flash');
                  void todayNumEl.offsetWidth; // 强行重绘
                  todayNumEl.classList.add('flash');
                } else {
                  // 第一次初始化显示最新的访客
                  updateTickerText("最新访客来自 [" + translateCity(latestVisit.city) + "] 正在访问 " + latestVisit.domain);
                }
                lastMaxVisitId = latestVisit.id;
              }
            } else {
              updateTickerText("暂无最新访问数据...");
            }

            // 2. 更新基础数字
            document.getElementById('today-visits-num').innerText = data.todayVisits;
            document.getElementById('yesterday-visits-num').innerText = data.yesterdayVisits;
            document.getElementById('today-count-span').innerText = data.todayVisits;
            document.getElementById('yesterday-count-span').innerText = data.yesterdayVisits;

            // 构建分类映射
            const domainDetailsMap = {};
            const cityDetailsMap = {};

            data.todayDetails.forEach(item => {
              if (!domainDetailsMap[item.domain]) domainDetailsMap[item.domain] = [];
              domainDetailsMap[item.domain].push(item);

              const cityKey = item.country + '_' + item.city;
              if (!cityDetailsMap[cityKey]) cityDetailsMap[cityKey] = [];
              cityDetailsMap[cityKey].push(item);
            });

            // 3. 渲染今日与昨日横向明细
            document.getElementById('today-table-body').innerHTML = renderTableRows(data.todayDetails);
            document.getElementById('yesterday-table-body').innerHTML = renderTableRows(data.yesterdayDetails);

            // 4. 渲染域名排行榜
            let domainHtml = '';
            if (data.domainRank.length === 0) {
              domainHtml = '<tr><td colspan="4" style="text-align:center;">今日暂无访问数据</td></tr>';
            } else {
              data.domainRank.forEach((item, index) => {
                const domain = item.domain;
                const list = domainDetailsMap[domain] || [];
                const yesterdayCount = data.yesterdayDomainMap[domain] || 0;
                const detailId = 'domain-detail-' + index;
                const iconId = 'domain-icon-' + index;
                const isExpanded = expandedState[detailId] ? 'table-row' : 'none';
                const arrow = expandedState[detailId] ? '▲' : '▼';

                const innerRows = list.map(row => `
                  <tr>
                    <td><code>${formatDate(row.visit_time)}</code></td>
                    <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
                    <td>${translateCountry(row.country)}</td>
                    <td>${translateCity(row.city)}</td>
                  </tr>
                `).join('');

                domainHtml += `
                  <tr class="clickable-row" onclick="toggleElement('${detailId}', '${iconId}')">
                    <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
                    <td><strong>${escapeHtml(domain)}</strong> <span class="arrow-icon" id="${iconId}">${arrow}</span></td>
                    <td><span class="pv-count">${item.domain_total} 次</span></td>
                    <td><span class="pv-yesterday">${yesterdayCount} 次</span></td>
                  </tr>
                  <tr id="${detailId}" class="detail-row" style="display: ${isExpanded};">
                    <td colspan="4" class="detail-cell">
                      <div class="inner-table-wrapper">
                        <div class="inner-title">🌐 域名 <strong>${escapeHtml(domain)}</strong> 今日访问明细：</div>
                        <div class="scroll-x">
                          <table>
                            <thead>
                              <tr><th>访问时间 (北京时间)</th><th>访客 IP</th><th>国家 / 地区</th><th>城市</th></tr>
                            </thead>
                            <tbody>
                              ${innerRows || '<tr><td colspan="4" style="text-align:center;">暂无明细记录</td></tr>'}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              });
            }
            document.getElementById('domain-rank-body').innerHTML = domainHtml;

            // 5. 渲染城市排行榜
            let cityHtml = '';
            if (data.cityRank.length === 0) {
              cityHtml = '<tr><td colspan="5" style="text-align:center;">今日暂无访问数据</td></tr>';
            } else {
              data.cityRank.forEach((item, index) => {
                const cityKey = item.country + '_' + item.city;
                const list = cityDetailsMap[cityKey] || [];
                const yesterdayCount = data.yesterdayCityMap[cityKey] || 0;
                const detailId = 'city-detail-' + index;
                const iconId = 'city-icon-' + index;
                const isExpanded = expandedState[detailId] ? 'table-row' : 'none';
                const arrow = expandedState[detailId] ? '▲' : '▼';

                const innerRows = list.map(row => `
                  <tr>
                    <td><code>${formatDate(row.visit_time)}</code></td>
                    <td><strong style="color:#38bdf8;">${escapeHtml(row.domain)}</strong></td>
                    <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
                  </tr>
                `).join('');

                cityHtml += `
                  <tr class="clickable-row" onclick="toggleElement('${detailId}', '${iconId}')">
                    <td style="text-align: center;"><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
                    <td>${translateCountry(item.country)}</td>
                    <td><strong>${translateCity(item.city)}</strong> <span class="arrow-icon" id="${iconId}">${arrow}</span></td>
                    <td><span class="pv-count">${item.city_total} 次</span></td>
                    <td><span class="pv-yesterday">${yesterdayCount} 次</span></td>
                  </tr>
                  <tr id="${detailId}" class="detail-row" style="display: ${isExpanded};">
                    <td colspan="5" class="detail-cell">
                      <div class="inner-table-wrapper">
                        <div class="inner-title">🏙️ 城市 <strong>${translateCity(item.city)}</strong> 今日来源域名与时间明细：</div>
                        <div class="scroll-x">
                          <table>
                            <thead>
                              <tr><th>访问时间 (北京时间)</th><th>被访问域名</th><th>访客 IP</th></tr>
                            </thead>
                            <tbody>
                              ${innerRows || '<tr><td colspan="3" style="text-align:center;">暂无明细记录</td></tr>'}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              });
            }
            document.getElementById('city-rank-body').innerHTML = cityHtml;

            // 6. 重新绘制折线图
            drawChart(data.last7DaysData);
          }

          // 弹幕推送效果（类似主播画面下方实时弹出“XX购买了商品”）
          function pushTickerNotice(visit) {
            const tickerEl = document.getElementById('ticker-text');
            tickerEl.style.transform = 'translateY(-100%)';
            tickerEl.style.opacity = '0';

            setTimeout(() => {
              const text = "⚡ 刚刚！来自 [" + translateCountry(visit.country) + " " + translateCity(visit.city) + "] 的访客访问了 " + visit.domain + " (" + formatDate(visit.visit_time) + ")";
              tickerEl.innerText = text;
              tickerEl.style.transform = 'translateY(100%)';
              
              setTimeout(() => {
                tickerEl.style.transform = 'translateY(0)';
                tickerEl.style.opacity = '1';
              }, 50);
            }, 300);
          }

          function updateTickerText(str) {
            document.getElementById('ticker-text').innerText = str;
          }

          function renderTableRows(list) {
            if (!list || list.length === 0) {
              return '<tr><td colspan="5" style="text-align:center; color:#64748b;">暂无访问记录</td></tr>';
            }
            return list.map((row, idx) => `
              <tr class="${idx === 0 ? 'new-row-anim' : ''}">
                <td><strong style="color:#38bdf8;">${escapeHtml(row.domain)}</strong></td>
                <td><code>${formatDate(row.visit_time)}</code></td>
                <td><code>${escapeHtml(row.ip || 'Unknown')}</code></td>
                <td>${translateCountry(row.country)}</td>
                <td>${translateCity(row.city)}</td>
              </tr>
            `).join('');
          }

          function drawChart(chartData) {
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
            const padding = { top: 30, bottom: 30, left: 20, right: 20 };

            const counts = chartData.map(d => d.count);
            const maxVal = Math.max(...counts, 5);

            const stepX = (width - padding.left - padding.right) / (chartData.length - 1);
            const points = chartData.map((item, index) => {
              const x = padding.left + index * stepX;
              const y = height - padding.bottom - ((item.count / maxVal) * (height - padding.top - padding.bottom));
              return { x, y, count: item.count, displayDate: item.displayDate };
            });

            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = '#334155';
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
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.00)');

            ctx.beginPath();
            ctx.moveTo(points[0].x, height - padding.bottom);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            points.forEach((p, i) => {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            points.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#0f172a';
              ctx.fill();
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.fillStyle = '#38bdf8';
              ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
              ctx.textAlign = 'center';
              ctx.fillText(p.count + '次', p.x, p.y - 8);

              ctx.fillStyle = '#94a3b8';
              ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
              ctx.fillText(p.displayDate, p.x, height - 8);
            });
          }

          // 开启自动无刷新更新 (每 3 秒发起一次静默同步)
          async function fetchRealtimeData() {
            try {
              const apiUrl = new URL(window.location.href);
              apiUrl.searchParams.set("action", "api");
              const res = await fetch(apiUrl);
              if (res.ok) {
                const data = await res.json();
                updateDashboard(data);
              }
            } catch (e) {
              console.error("数据实时同步失败:", e);
            }
          }

          // 页面初始化及定时器绑定
          fetchRealtimeData();
          setInterval(fetchRealtimeData, 3000);
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
