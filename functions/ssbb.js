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

      const count = todayRes?.count || 0;
      const income = count * 8; // 计算实时收入

      return new Response(JSON.stringify({
        todayCount: count,
        todayIncome: income,
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
    const todayIncome = todayVisits * 8; // 预估收入

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

          /* 顶部统计双卡片布局 */
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .stat-hero {
            text-align: center;
            padding: 20px 10px;
            border-radius: 10px;
            background: radial-gradient(circle, rgba(0,240,255,0.08) 0%, rgba(0,0,0,0) 70%);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .stat-hero.income-box {
            background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0) 70%);
            border-color: rgba(255, 215, 0, 0.2);
          }
          .stat-hero .label { font-size: 13px; color: #8a99ad; letter-spacing: 1px; }
          .stat-hero .num {
            font-size: 48px;
            font-weight: 900;
            font-family: 'Impact', sans-serif, monospace;
            background: linear-gradient(180deg, #ffffff 0%, #00f0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
            transition: transform 0.2s ease;
            display: inline-block;
          }
          .stat-hero.income-box .num {
            background: linear-gradient(180deg, #ffffff 0%, #ffd700 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          }

          .feed-stream {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 480px;
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
            .stats-grid { grid-template-columns: 1fr; }
            .stat-hero .num { font-size: 40px; }
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
            
            <div class="stats-grid">
              <div class="stat-hero">
                <div class="label">TODAY VISITS / 今日实时访客</div>
                <div class="num" id="todayHeroNum">${todayVisits}</div>
              </div>
              <div class="stat-hero income-box">
                <div class="label">ESTIMATED REVENUE / 今日预估收入</div>
                <div class="num" id="todayIncomeNum">¥ ${todayIncome}</div>
              </div>
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
              <div style="font-size: 36px; margin-bottom: 10px;">💰</div>
              <div style="font-size: 14px; color: #ffd700; font-weight: bold;">汇率基准：¥ 8.00 / 访客</div>
              <div style="font-size: 12px; color: #62728d; margin-top: 6px;">根据实时进入流量自动计算估算收益</div>
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
              <div style="font-size: 20px;">💵</div>
              <div>
                <div style="font-weight: bold; color: #ffd700; font-size: 13px;">收益 +8 元！</div>
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

              if (data.todayIncome !== undefined) {
                const incomeEl = document.getElementById('todayIncomeNum');
                if (incomeEl && incomeEl.innerText != ('¥ ' + data.todayIncome)) {
                  incomeEl.innerText = '¥ ' + data.todayIncome;
                  incomeEl.style.transform = 'scale(1.25)';
                  setTimeout(() => incomeEl.style.transform = 'scale(1)', 200);
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
    'beijing': '北京', 'shanghai': '上海', 'tianjin': '天津', 'chongqing': '重庆',
    'hong kong': '香港', 'macau': '澳门', 'taipei': '台北', 'kaohsiung': '高雄',
    'guangzhou': '广州', 'shenzhen': '深圳', 'zhuhai': '珠海', 'shantou': '汕头',
    'foshan': '佛山', 'shaoguan': '韶关', 'heyuan': '河源', 'meizhou': '梅州',
    'huizhou': '惠州', 'shanwei': '汕尾', 'dongguan': '东莞', 'zhongshan': '中山',
    'jiangmen': '江门', 'yangjiang': '阳江', 'zhanjiang': '湛江', 'maoming': '茂名',
    'zhaoqing': '肇庆', 'qingyuan': '清远', 'chaozhou': '潮州', 'jieyang': '揭阳', 'yunfu': '云浮',
    'hangzhou': '杭州', 'ningbo': '宁波', 'wenzhou': '温州', 'jiaxing': '嘉兴',
    'huzhou': '湖州', 'shaoxing': '绍兴', 'jinhua': '金华', 'quzhou': '衢州',
    'zhoushan': '舟山', 'taizhou': '台州', 'lishui': '丽水',
    'nanjing': '南京', 'wuxi': '无锡', 'xuzhou': '徐州', 'changzhou': '常州',
    'suzhou': '苏州', 'nantong': '南通', 'lianyungang': '连云港', 'huaian': '淮安',
    'yancheng': '盐城', 'yangzhou': '扬州', 'zhenjiang': '镇江', 'taizhou2': '泰州', 'suqian': '宿迁',
    'jinan': '济南', 'qingdao': '青岛', 'zibo': '淄博', 'zaozhuang': '枣庄',
    'dongying': '东营', 'yantai': '烟台', 'weifang': '潍坊', 'jining': '济宁',
    'taian': '泰安', 'weihai': '威海', 'rizhao': '日照', 'linyi': '临沂',
    'dezhou': '德州', 'liaocheng': '聊城', 'binzhou': '滨州', 'heze': '菏泽',
    'fuzhou': '福州', 'xiamen': '厦门', 'putian': '莆田', 'sanming': '三明',
    'quanzhou': '泉州', 'zhangzhou': '漳州', 'nanping': '南平', 'longyan': '龙岩', 'ningde': '宁德',
    'wuhan': '武汉', 'huangshi': '黄石', 'shiyan': '十堰', 'yichang': '宜昌',
    'xiangyang': '襄阳', 'ezhou': '鄂州', 'jingmen': '荆门', 'xiaogan': '孝感',
    'jingzhou': '荆州', 'huanggang': '黄冈', 'xianning': '咸宁', 'suizhou': '随州',
    'enshi': '恩施', 'xiantian': '仙桃', 'qianjiang': '潜江', 'tianmen': '天门', 'shennongjia': '神农架',
    'changsha': '长沙', 'zhuzhou': '株洲', 'xiangtan': '湘潭', 'hengyang': '衡阳',
    'shaoyang': '邵阳', 'yueyang': '岳阳', 'changde': '常德', 'zhangjiajie': '张家界',
    'yiyang': '益阳', 'chenzhou': '郴州', 'yongzhou': '永州', 'huaihua': '怀化',
    'loudi': '娄底', 'xiangxi': '湘西',
    'zhengzhou': '郑州', 'kaifeng': '开封', 'luoyang': '洛阳', 'pingdingshan': '平顶山',
    'anyang': '安阳', 'hebi': '鹤壁', 'xinxiang': '新乡', 'jiaozuo': '焦作',
    'puyang': '濮阳', 'xuchang': '许昌', 'luohe': '漯河', 'sanmenxia': '三门峡',
    'nanyang': '南阳', 'shangqiu': '商丘', 'xinyang': '信阳', 'zhoukou': '周口',
    'zhumadian': '驻马店', 'jiyuan': '济源',
    'chengdu': '成都', 'zigong': '自贡', 'panzhihua': '攀枝花', 'luzhou': '泸州',
    'deyang': '德阳', 'mianyang': '绵阳', 'guangyuan': '广元', 'suining': '遂宁',
    'neijiang': '内江', 'leshan': '乐山', 'nanchong': '南充', 'meishan': '眉山',
    'yibin': '宜宾', 'guangan': '广安', 'dazhou': '达州', 'yaan': '雅安',
    'bazhong': '巴中', 'ziyang': '资阳', 'aba': '阿坝', 'ganzi': '甘孜', 'liangshan': '凉山',
    'xian': "西安", "xi'an": "西安", 'tongchuan': '铜川', 'baoji': '宝鸡',
    'xianyang': '咸阳', 'weinan': '渭南', 'yanan': '延安', 'hanzhong': '汉中',
    'yulin': '榆林', 'ankang': '安康', 'shangluo': '商洛',
    'shijiazhuang': '石家庄', 'tangshan': '唐山', 'qinhuangdao': '秦皇岛',
    'handan': '邯郸', 'xingtai': '邢台', 'baoding': '保定', 'zhangjiakou': '张家口',
    'chengde': '承德', 'cangzhou': '沧州', 'langfang': '廊坊', 'hengshui': '衡水',
    'taiwo': '太原', 'taiyuan': '太原', 'datong': '大同', 'yangquan': '阳泉',
    'changzhi': '长治', 'jincheng': '晋城', 'shuozhou': '朔州', 'jinzhong': '晋中',
    'yuncheng': '运城', 'xinzhou': '忻州', 'linfen': '临汾', 'lvliang': '吕梁',
    'shenyang': '沈阳', 'dalian': '大连', 'anshan': '鞍山', 'fushun': '抚顺',
    'benxi': '本溪', 'dandong': '丹东', 'jinzhou': '锦州', 'yingkou': '营口',
    'fuxin': '阜新', 'liaoyang': '辽阳', 'panjin': '盘锦', 'tieling': '铁岭',
    'chaoyang': '朝阳', 'huludao': '葫芦岛',
    'changchun': '长春', 'jilin': '吉林', 'siping': '四平', 'liaoyuan': '辽源',
    'tonghua': '通化', 'baishan': '白山', 'songyuan': '松原', 'baicheng': '白城', 'yanbian': '延边',
    'harbin': '哈尔滨', 'qiqihar': '齐齐哈尔', 'jixi': '鸡西', 'hegang': '鹤岗',
    'shuangyashan': '双鸭山', 'daqing': '大庆', 'yichun': '伊春', 'jiamusi': '佳木斯',
    'qitaihe': '七台河', 'mudanjiang': '牡丹江', 'heihe': '黑河', 'suihua': '绥化', 'daxinganling': '大兴安岭',
    'hefei': '合肥', 'wuhu': '芜湖', 'bengbu': '蚌埠', 'huainan': '淮南',
    'maanshan': '马鞍山', 'huaibei': '淮北', 'tongling': '铜陵', 'anqing': '安庆',
    'huangshan': '黄山', 'chuzhou': '滁州', 'fuyang': '阜阳', 'suzhou2': '宿州',
    'luan': '六安', 'bozhou': '毫州', 'chizhou': '池州', 'xuancheng': '宣城',
    'nanchang': '南昌', 'jingdezhen': '景德镇', 'pingxiang': '萍乡', 'jiujiang': '九江',
    'xinyu': '新余', 'yingtan': '鹰潭', 'ganzhou': '赣州', 'jian': '吉安',
    'yichun2': '宜春', 'fuzhou2': '抚州', 'shangrao': '上饶',
    'nanning': '南宁', 'liuzhou': '柳州', 'guilin': '桂林', 'wuzhou': '梧州',
    'beihai': '北海', 'fangchenggang': '防城港', 'qinzhou': '钦州', 'guigang': '贵港',
    'yulin2': '玉林', 'baise': '百色', 'hezhou': '贺州', 'hechi': '河池', 'laibin': '来宾', 'chongzuo': '崇左',
    'haikou': '海口', 'sanya': '三亚', 'sansha': '三沙', 'danzhou': '儋州',
    'guiyang': '贵阳', 'liupanshui': '六盘水', 'zunyi': '遵义', 'anshun': '安顺',
    'bijie': '毕节', 'tongren': '铜仁', 'qianxinan': '黔西南', 'qiandongnan': '黔东南', 'qiannan': '黔南',
    'kunming': '昆明', 'qujing': '曲靖', 'yuxi': '玉溪', 'baoshan': '保山',
    'zhaotong': '昭通', 'lijiang': '丽江', 'puer': '普洱', 'lincang': '临沧',
    'chuxiong': '楚雄', 'honghe': '红河', 'wenshan': '文山', 'xishuangbanna': '西双版纳',
    'dali': '大理', 'dehong': '德宏', 'nujiang': '怒江', 'diqing': '迪庆',
    'lhasa': '拉萨', 'shigatse': '日喀则', 'qamdo': '昌都', 'nyingchi': '林芝',
    'shannan': '山南', 'nagqu': '那曲', 'ngari': '阿里',
    'lanzhou': '兰州', 'jiayuguan': '嘉峪关', 'jinchang': '金昌', 'baiyin': '白银',
    'tianshui': '天水', 'wuwei': '武威', 'zhangye': '张掖', 'pingliang': '平凉',
    'jiuquan': '酒泉', 'qingyang': '庆阳', 'dingxi': '定西', 'longnan': '陇南',
    'linxia': '临夏', 'gannan': '甘南',
    'xining': '西宁', 'haidong': '海东', 'haibei': '海北', 'huangnan': '黄南',
    'hainan2': '海南州', 'golog': '果洛', 'yushu': '玉树', 'haixi': '海西',
    'yinchuan': '银川', 'shizuishan': '石嘴山', 'wuzhong': '吴忠', 'guyuan': '固原', 'zhongwei': '中卫',
    'urumqi': '乌鲁木齐', 'karamay': '克拉玛依', 'turpan': '吐鲁番', 'hami': '哈密',
    'changji': '昌吉', 'bortala': '博尔塔拉', 'bayingolin': '巴音郭楞', 'aksus': '阿克苏',
    'aksu': '阿克苏', 'kizilsu': '克孜勒苏', 'kashgar': '喀什', 'hotan': '和田',
    'ili': '伊犁', 'tacheng': '塔城', 'altay': '阿勒泰', 'shihezi': '石河子'
  };

  const key = String(city).toLowerCase().trim().replace(/-/g, '').replace(/\s+/g, '');
  return cityMap[key] || cityMap[String(city).toLowerCase().trim()] || city;
}
