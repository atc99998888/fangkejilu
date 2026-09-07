export async function onRequestGet(context) {
  const { request, env } = context;

  // 访问安全密钥（可更改，需与 URL 中 ?key= 保持一致）
  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  if (!env || !env.DB) {
    return new Response("数据库未绑定：请在 Cloudflare Pages 设置中绑定名为 DB 的 D1 数据库", { status: 500 });
  }

  try {
    const bjDateExpr = "DATE(DATETIME(IFNULL(visit_time, CURRENT_TIMESTAMP), '+8 hours'))";
    const todayDateExpr = "DATE('now', '+8 hours')";

    // 【JSON 轮询 API】：前端大屏每 3 秒发起一次请求获取最新动态
    if (url.searchParams.get("action") === "realtime") {
      const latestRes = await env.DB.prepare(`
        SELECT id, ip, country, city, visit_time 
        FROM visits 
        ORDER BY id DESC LIMIT 10
      `).all();

      const todayRes = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM visits 
        WHERE ${bjDateExpr} = ${todayDateExpr}
      `).first();

      const cityRankRes = await env.DB.prepare(`
        SELECT country, city, COUNT(*) as city_total 
        FROM visits 
        WHERE ${bjDateExpr} = ${todayDateExpr}
        GROUP BY country, city 
        ORDER BY city_total DESC LIMIT 5
      `).all();

      const rawRecords = latestRes?.results || [];
      const formattedRecords = rawRecords.map(r => ({
        id: r.id,
        ip: r.ip || 'Unknown',
        country: translateCountry(r.country),
        city: translateCity(r.city),
        time: formatDate(r.visit_time)
      }));

      const formattedCities = (cityRankRes?.results || []).map(c => ({
        country: translateCountry(c.country),
        city: translateCity(c.city),
        count: c.city_total
      }));

      return new Response(JSON.stringify({
        todayCount: todayRes?.count || 0,
        latest: formattedRecords,
        topCities: formattedCities
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 【HTML 渲染】：直接打开页面时输出的中控大屏 UI
    const todayRes = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visits 
      WHERE ${bjDateExpr} = ${todayDateExpr}
    `).first();
    const todayVisits = todayRes?.count || 0;

    const latestDetailsRes = await env.DB.prepare(`
      SELECT id, ip, country, city, visit_time 
      FROM visits 
      WHERE ${bjDateExpr} = ${todayDateExpr}
      ORDER BY id DESC LIMIT 20
    `).all();
    const latestDetails = latestDetailsRes?.results || [];

    const cityRankRes = await env.DB.prepare(`
      SELECT country, city, COUNT(*) as city_total 
      FROM visits 
      WHERE ${bjDateExpr} = ${todayDateExpr}
      GROUP BY country, city 
      ORDER BY city_total DESC LIMIT 5
    `).all();
    const cityRank = cityRankRes?.results || [];

    const renderFeedItems = (list) => {
      if (!list || list.length === 0) {
        return '<div style="color:#666;text-align:center;padding:40px;">今日暂无访客数据，等待数据涌入...</div>';
      }
      return list.map(item => `
        <div class="feed-item" data-id="${item.id}">
          <div class="feed-avatar">⚡</div>
          <div class="feed-info">
            <div class="feed-title">
              <span class="user-loc">${translateCountry(item.country)} · ${translateCity(item.city)}</span>
              <span class="visit-time">${formatDate(item.visit_time)}</span>
            </div>
            <div class="feed-sub">
              IP: <code>${escapeHtml(item.ip || 'Unknown')}</code>
            </div>
          </div>
          <div class="feed-badge">已进入</div>
        </div>
      `).join('');
    };

    const maxCityCount = cityRank[0]?.city_total || 1;
    const renderCityProgress = (list) => {
      if (!list || list.length === 0) return '<div style="color:#666;text-align:center;padding:20px;">暂无榜单</div>';
      return list.map((item, idx) => {
        const percent = Math.round((item.city_total / maxCityCount) * 100);
        return `
          <div class="city-item">
            <div class="city-header">
              <span><strong style="color:#ff0055;">NO.${idx+1}</strong> ${translateCountry(item.country)} ${translateCity(item.city)}</span>
              <span class="city-num">${item.city_total} 人次</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    };

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>直播间中控台 - 今日流量实时大屏</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background-color: #0b0e14;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow-x: hidden;
          }
          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 30px;
            background: linear-gradient(180deg, rgba(20, 26, 40, 0.9) 0%, rgba(11, 14, 20, 0.9) 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
          }
          .title-area { display: flex; align-items: center; gap: 12px; }
          .live-tag {
            background: #ff0055;
            color: #fff;
            font-size: 12px;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 4px;
            letter-spacing: 1px;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
          .title-area h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1px; }
          .clock-box { font-family: monospace; font-size: 16px; color: #00f0ff; }
          .grid-container {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
          }
          .card-panel {
            background: rgba(22, 28, 41, 0.7);
            border: 1px solid rgba(0, 240, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            position: relative;
            overflow: hidden;
          }
          .card-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(90deg, #00f0ff, #ff0055);
          }
          .panel-header {
            font-size: 16px;
            font-weight: 600;
            color: #00f0ff;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .stat-hero {
            text-align: center;
            padding: 20px 0;
            background: radial-gradient(circle, rgba(0,240,255,0.1) 0%, rgba(0,0,0,0) 70%);
            margin-bottom: 20px;
          }
          .stat-hero .label { font-size: 14px; color: #8a99ad; letter-spacing: 1px; }
          .stat-hero .num {
            font-size: 64px;
            font-weight: 900;
            font-family: 'Impact', sans-serif, monospace;
            background: linear-gradient(180deg, #ffffff 0%, #00f0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
            transition: transform 0.2s ease;
            display: inline-block;
          }
          .feed-stream {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 520px;
            overflow-y: auto;
            padding-right: 5px;
          }
          .feed-stream::-webkit-scrollbar { width: 4px; }
          .feed-stream::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.3); border-radius: 4px; }
          .feed-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 14px;
            animation: slideDown 0.4s ease forwards;
            transition: all 0.3s;
          }
          .feed-item:hover {
            background: rgba(0, 240, 255, 0.08);
            border-color: rgba(0, 240, 255, 0.4);
            transform: translateX(4px);
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .feed-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff0055, #ff5000);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 0 10px rgba(255, 0, 85, 0.5);
          }
          .feed-info { flex: 1; }
          .feed-title { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; }
          .user-loc { color: #ffffff; }
          .visit-time { font-size: 12px; color: #8a99ad; font-weight: normal; }
          .feed-sub { font-size: 12px; color: #62728d; margin-top: 4px; }
          .feed-sub code { color: #00f0ff; background: transparent; }
          .feed-badge {
            background: rgba(0, 240, 255, 0.1);
            color: #00f0ff;
            border: 1px solid rgba(0, 240, 255, 0.3);
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
          }
          .city-list { display: flex; flex-direction: column; gap: 15px; margin-top: 10px; }
          .city-item { font-size: 13px; }
          .city-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .city-num { color: #00f0ff; font-weight: bold; }
          .progress-bar { height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #ff0055, #00f0ff); border-radius: 3px; transition: width 0.5s ease; }
          .live-toast-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
          }
          .live-toast {
            pointer-events: auto;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid #00f0ff;
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
          @keyframes popIn {
            from { transform: translateX(100%) scale(0.8); opacity: 0; }
            to { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes popOut {
            from { transform: translateX(0) scale(1); opacity: 1; }
            to { transform: translateX(100%) scale(0.8); opacity: 0; }
          }
          @media (max-width: 900px) {
            .grid-container { grid-template-columns: 1fr; padding: 10px; }
            .dashboard-header { padding: 10px 15px; }
            .stat-hero .num { font-size: 48px; }
          }
        </style>
      </head>
      <body>

        <div class="live-toast-container" id="toastContainer"></div>

        <div class="dashboard-header">
          <div class="title-area">
            <span class="live-tag">LIVE 中控台</span>
            <h1>今日访客实时中控屏</h1>
          </div>
          <div class="clock-box" id="liveClock">00:00:00</div>
        </div>

        <div class="grid-container">
          <div class="card-panel">
            <div class="stat-hero">
              <div class="label">TODAY VISITS / 今日实时访客总量</div>
              <div class="num" id="todayHeroNum">${todayVisits}</div>
            </div>

            <div class="panel-header">
              <span>🔥 最新访客实时推刷流水</span>
              <span style="font-size: 12px; color: #8a99ad; font-weight: normal;">自动无感更新中</span>
            </div>

            <div class="feed-stream" id="feedStream">
              ${renderFeedItems(latestDetails)}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="card-panel">
              <div class="panel-header">
                <span>🏙️ 今日热门区域榜 TOP 5</span>
              </div>
              <div class="city-list" id="cityList">
                ${renderCityProgress(cityRank)}
              </div>
            </div>

            <div class="card-panel" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
              <div style="font-size: 36px; margin-bottom: 10px;">📡</div>
              <div style="font-size: 14px; color: #00f0ff; font-weight: bold;">中控台数据链路正常</div>
              <div style="font-size: 12px; color: #62728d; margin-top: 6px;">全网集群访客无缝追踪中</div>
            </div>
          </div>
        </div>

        <script>
          function updateClock() {
            const now = new Date();
            document.getElementById('liveClock').innerText = now.toLocaleTimeString('zh-CN', { hour12: false });
          }
          setInterval(updateClock, 1000);
          updateClock();

          let lastSeenId = ${latestDetails[0] ? (latestDetails[0].id || 0) : 0};

          function showToast(record) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'live-toast';
            toast.innerHTML = \`
              <div style="font-size: 20px;">🔥</div>
              <div>
                <div style="font-weight: bold; color: #00f0ff; font-size: 13px;">新访客涌入！</div>
                <div style="font-size: 12px; color: #e2e8f0; margin-top: 2px;">
                  来自 <strong>\${record.country} \${record.city}</strong> (\${record.ip})
                </div>
              </div>
            \`;
            container.appendChild(toast);

            setTimeout(() => {
              toast.style.animation = 'popOut 0.3s forwards';
              setTimeout(() => toast.remove(), 300);
            }, 3500);
          }

          async function pollRealtimeData() {
            try {
              const res = await fetch(window.location.pathname + window.location.search + "&action=realtime");
              if (!res.ok) return;
              const data = await res.json();

              if (data.todayCount !== undefined) {
                const numEl = document.getElementById('todayHeroNum');
                if (numEl && numEl.innerText != data.todayCount) {
                  numEl.innerText = data.todayCount;
                  numEl.style.transform = 'scale(1.25)';
                  setTimeout(() => numEl.style.transform = 'scale(1)', 200);
                }
              }

              if (data.latest && data.latest.length > 0) {
                const newest = data.latest[0];
                if (lastSeenId && newest.id > lastSeenId) {
                  showToast(newest);

                  const stream = document.getElementById('feedStream');
                  if (stream) {
                    const newItem = document.createElement('div');
                    newItem.className = 'feed-item';
                    newItem.setAttribute('data-id', newest.id);
                    newItem.innerHTML = \`
                      <div class="feed-avatar">⚡</div>
                      <div class="feed-info">
                        <div class="feed-title">
                          <span class="user-loc">\${newest.country} · \${newest.city}</span>
                          <span class="visit-time">\${newest.time}</span>
                        </div>
                        <div class="feed-sub">
                          IP: <code>\${newest.ip}</code>
                        </div>
                      </div>
                      <div class="feed-badge">已进入</div>
                    \`;
                    stream.insertBefore(newItem, stream.firstChild);

                    if (stream.children.length > 30) {
                      stream.removeChild(stream.lastChild);
                    }
                  }
                  lastSeenId = newest.id;
                }
              }

              if (data.topCities && data.topCities.length > 0) {
                const cityListEl = document.getElementById('cityList');
                if (cityListEl) {
                  const maxVal = data.topCities[0].count || 1;
                  cityListEl.innerHTML = data.topCities.map((item, idx) => {
                    const pct = Math.round((item.count / maxVal) * 100);
                    return \`
                      <div class="city-item">
                        <div class="city-header">
                          <span><strong style="color:#ff0055;">NO.\${idx+1}</strong> \${item.country} \${item.city}</span>
                          <span class="city-num">\${item.count} 人次</span>
                        </div>
                        <div class="progress-bar">
                          <div class="progress-fill" style="width: \${pct}%;"></div>
                        </div>
                      </div>
                    \`;
                  }).join('');
                }
              }

            } catch (e) {}
          }

          setInterval(pollRealtimeData, 3000);
        </script>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return new Response(`大屏加载异常：${error.message}`, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(utcString) {
  if (!utcString) return '刚刚';
  try {
    const date = new Date(utcString + " UTC");
    if (isNaN(date.getTime())) return utcString;
    return date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch (e) {
    return utcString;
  }
}

function translateCountry(code) {
  const countryMap = {
    'CN': '🇨🇳 中国', 'HK': '🇭🇰 中国香港', 'MO': '🇲🇴 中国澳门', 'TW': '🇹🇼 中国台湾',
    'US': '🇺🇸 美国', 'JP': '🇯🇵 日本', 'KR': '🇰🇷 韩国', 'SG': '🇸🇬 新加坡',
    'GB': '🇬🇧 英国', 'DE': '🇩🇪 德国', 'CA': '🇨🇦 加拿大', 'AU': '🇦🇺 澳大利亚',
    'RU': '🇷🇺 俄罗斯', 'Unknown': '未知地区'
  };
  return countryMap[code] || code || '未知地区';
}

function translateCity(city) {
  if (!city || city === 'Unknown') return '未知城市';
  const cityMap = {
    'Beijing': '北京', 'Shanghai': '上海', 'Tianjin': '天津', 'Chongqing': '重庆',
    'Hong Kong': '香港', 'Macau': '澳门', 'Taipei': '台北', 'Kaohsiung': '高雄',
    'Guangzhou': '广州', 'Shenzhen': '深圳', 'Zhuhai': '珠海', 'Shantou': '汕头',
    'Foshan': '佛山', 'Dongguan': '东莞', 'Zhongshan': '中山', 'Hangzhou': '杭州',
    'Ningbo': '宁波', 'Wenzhou': '温州', 'Nanjing': '南京', 'Suzhou': '苏州',
    'Wuxi': '无锡', 'Chengdu': '成都', 'Wuhan': '武汉', 'Changsha': '长沙',
    'Zhengzhou': '郑州', 'Qingdao': '青岛', 'Jinan': '济南', 'Xi\'an': '西安',
    'Xian': '西安', 'Fuzhou': '福州', 'Xiamen': '厦门', 'Hefei': '合肥'
  };
  return cityMap[city] || city;
}
