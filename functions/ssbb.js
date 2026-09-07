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
      const income = count * 8; 

      return new Response(JSON.stringify({
        todayCount: count,
        todayIncome: income,
        latest: formattedRecords,
        topCities: formattedCities
      }), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 【HTML 渲染】：中控大屏主界面
    const todayRes = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visits 
      WHERE ${bjDateExpr} = ${todayDateExpr}
    `).first();
    const todayVisits = todayRes?.count || 0;
    const todayIncome = todayVisits * 8;

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
        <title>全球直播大数据中控台</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background-color: #06090e;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow-x: hidden;
          }

          /* 全屏金币雨 Canvas */
          #coinCanvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9998;
          }

          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 30px;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 9, 14, 0.95) 100%);
            border-bottom: 1px solid rgba(0, 240, 255, 0.2);
            backdrop-filter: blur(10px);
          }
          .title-area { display: flex; align-items: center; gap: 12px; }
          .live-tag {
            background: linear-gradient(90deg, #ff0055, #ff5000);
            color: #fff;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 20px;
            letter-spacing: 1.5px;
            box-shadow: 0 0 12px rgba(255, 0, 85, 0.6);
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
          .title-area h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; background: linear-gradient(90deg, #fff, #00f0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          
          .header-right { display: flex; align-items: center; gap: 20px; }
          .clock-box { font-family: monospace; font-size: 16px; color: #00f0ff; text-shadow: 0 0 8px rgba(0,240,255,0.5); }
          
          /* 页面底部静态常驻控制栏（嵌入式布局，跟随页面滚动） */
          .bottom-sound-bar {
            width: 100%;
            padding: 30px 0 40px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background: transparent;
          }
          .sound-toggle {
            background: rgba(13, 20, 32, 0.9);
            border: 1px solid rgba(255, 215, 0, 0.5);
            color: #ffd700;
            padding: 10px 26px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            user-select: none;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
          }
          .sound-toggle:hover {
            border-color: #ffd700;
            background: rgba(255, 215, 0, 0.15);
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
            transform: translateY(-2px);
          }
          .sound-toggle.muted {
            color: #8a99ad;
            border-color: rgba(255, 255, 255, 0.2);
            background: rgba(13, 20, 32, 0.6);
            box-shadow: none;
          }

          .grid-container {
            display: grid;
            grid-template-columns: 2.2fr 1fr;
            gap: 20px;
            padding: 20px;
            max-width: 1500px;
            margin: 0 auto;
          }
          .card-panel {
            background: rgba(13, 20, 32, 0.75);
            border: 1px solid rgba(0, 240, 255, 0.15);
            border-radius: 14px;
            padding: 20px;
            box-shadow: 0 10px 40px 0 rgba(0, 0, 0, 0.5);
            position: relative;
            overflow: hidden;
          }
          .card-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(90deg, #00f0ff, #ffd700, #ff0055);
          }
          .panel-header {
            font-size: 15px;
            font-weight: 700;
            color: #00f0ff;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            letter-spacing: 0.5px;
          }

          /* 顶部统计双卡片 */
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .stat-hero {
            text-align: center;
            padding: 20px 10px;
            border-radius: 12px;
            background: radial-gradient(circle at center, rgba(0,240,255,0.1) 0%, rgba(0,0,0,0.3) 100%);
            border: 1px solid rgba(0, 240, 255, 0.2);
            position: relative;
          }
          .stat-hero.income-box {
            background: radial-gradient(circle at center, rgba(255,215,0,0.12) 0%, rgba(0,0,0,0.3) 100%);
            border-color: rgba(255, 215, 0, 0.3);
          }
          .stat-hero .label { font-size: 12px; color: #8a99ad; letter-spacing: 1.5px; font-weight: 600; }
          .stat-hero .num {
            font-size: 52px;
            font-weight: 900;
            font-family: 'Impact', sans-serif, monospace;
            background: linear-gradient(180deg, #ffffff 0%, #00f0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 25px rgba(0, 240, 255, 0.4);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: inline-block;
          }
          .stat-hero.income-box .num {
            background: linear-gradient(180deg, #ffffff 0%, #ffd700 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 25px rgba(255, 215, 0, 0.6);
          }

          /* 弹性浮动动画 */
          .gold-pop {
            animation: goldShockwave 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important;
          }
          @keyframes goldShockwave {
            0% { transform: scale(1); filter: drop-shadow(0 0 0px #ffd700); }
            50% { transform: scale(1.35) translateY(-5px); filter: drop-shadow(0 0 35px #ffd700); }
            100% { transform: scale(1); filter: drop-shadow(0 0 0px #ffd700); }
          }

          /* 屏幕中央漂浮收益特效 */
          .cash-float-container {
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10000;
          }
          .cash-float-item {
            font-family: 'Impact', -apple-system, sans-serif;
            font-size: 48px;
            font-weight: 900;
            color: #ffd700;
            text-shadow: 0 0 20px #ff0055, 0 0 40px #ffd700;
            animation: floatUpAndOut 1.2s cubic-bezier(0.08, 0.82, 0.17, 1) forwards;
            position: absolute;
            white-space: nowrap;
          }
          @keyframes floatUpAndOut {
            0% { opacity: 0; transform: translate(-50%, 20px) scale(0.5) rotate(-5deg); }
            30% { opacity: 1; transform: translate(-50%, -30px) scale(1.3) rotate(3deg); }
            100% { opacity: 0; transform: translate(-50%, -120px) scale(0.9) rotate(0deg); }
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
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
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
            border-color: rgba(0, 240, 255, 0.3);
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
          .progress-bar { height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #ff0055, #ffd700, #00f0ff); border-radius: 3px; transition: width 0.5s ease; }

          .bigdata-panel {
            background: radial-gradient(circle at top left, rgba(0,240,255,0.15), rgba(0,0,0,0.4));
            border: 1px solid rgba(0, 240, 255, 0.25);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .bigdata-title {
            font-size: 14px;
            font-weight: 800;
            color: #00f0ff;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .stat-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.03);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12px;
            border: 1px solid rgba(255,255,255,0.05);
          }
          .stat-metric span { color: #8a99ad; }
          .stat-metric strong { color: #ffd700; font-family: monospace; font-size: 14px; }

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
            background: rgba(10, 16, 26, 0.95);
            border: 1px solid #ffd700;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
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

        <canvas id="coinCanvas"></canvas>
        <div class="cash-float-container" id="cashFloatBox"></div>
        <div class="live-toast-container" id="toastContainer"></div>

        <div class="dashboard-header">
          <div class="title-area">
            <span class="live-tag">GLOBAL LIVE</span>
            <h1>全球直播流量大数据控制中心</h1>
          </div>
          <div class="header-right">
            <div class="clock-box" id="liveClock">00:00:00</div>
          </div>
        </div>

        <div class="grid-container">
          <div class="card-panel">
            
            <div class="stats-grid">
              <div class="stat-hero">
                <div class="label">GLOBAL VISITS / 全球实时并发访客总量</div>
                <div class="num" id="todayHeroNum">${todayVisits}</div>
              </div>
              <div class="stat-hero income-box">
                <div class="label">REALTIME REVENUE / 实时估算商业收益</div>
                <div class="num" id="todayIncomeNum">¥ ${todayIncome}</div>
              </div>
            </div>

            <div class="panel-header">
              <span>🔥 实时高频全网数据流 (Real-time Stream)</span>
              <span style="font-size: 12px; color: #8a99ad; font-weight: normal;">高并发无感同步中</span>
            </div>

            <div class="feed-stream" id="feedStream">
              ${renderFeedItems(latestDetails)}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div class="card-panel">
              <div class="panel-header">
                <span>🏙️ 区域流量分布榜 TOP 5</span>
              </div>
              <div class="city-list" id="cityList">
                ${renderCityProgress(cityRank)}
              </div>
            </div>

            <div class="bigdata-panel">
              <div class="bigdata-title">
                <span>🌐</span> 全球直播大数据统计中心
              </div>
              <div class="stat-metric">
                <span>计算节点状态</span>
                <strong style="color: #00f0ff;">Active (100%)</strong>
              </div>
              <div class="stat-metric">
                <span>数据吞吐延迟</span>
                <strong style="color: #00f0ff;">< 12ms</strong>
              </div>
              <div class="stat-metric">
                <span>流量转化溢价</span>
                <strong>实时动态换算</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- 页面底部静态控制按钮 (自然嵌入布局，跟随页面滚动) -->
        <div class="bottom-sound-bar">
          <button class="sound-toggle" id="soundBtn" onclick="toggleSound()">
            <span id="soundIcon">🔊</span> <span id="soundText">进账提示音：已开启</span>
          </button>
        </div>

        <script>
          // =============== 音效控制 (多金币快速碰撞、洒落、哗啦啦金币雨音效) ===============
          let soundEnabled = true;
          let audioCtx = null;

          function initAudio() {
            if (!audioCtx) {
              const AudioContextClass = window.AudioContext || window.webkitAudioContext;
              if (AudioContextClass) {
                audioCtx = new AudioContextClass();
              }
            }
            if (audioCtx && audioCtx.state === 'suspended') {
              audioCtx.resume();
            }
          }

          function toggleSound() {
            initAudio(); // 每次点击时显式激活音频上下文
            soundEnabled = !soundEnabled;
            const btn = document.getElementById('soundBtn');
            const icon = document.getElementById('soundIcon');
            const text = document.getElementById('soundText');
            if (soundEnabled) {
              btn.classList.remove('muted');
              icon.innerText = '🔊';
              text.innerText = '进账提示音：已开启';
              playCoinSound();
            } else {
              btn.classList.add('muted');
              icon.innerText = '🔇';
              text.innerText = '进账提示音：已关闭';
            }
          }

          // 模拟一堆金币倾泻洒落（连击撞击+金属摩擦噪音+混响余音）
          function playCoinSound() {
            if (!soundEnabled) return;
            try {
              initAudio();
              if (!audioCtx) return;
              
              const now = audioCtx.currentTime;

              // 1. 生成轻微的高频粉色/白色金属摩擦背景音，模拟几十枚金币一起滑落的“哗啦啦”声
              const bufferSize = audioCtx.sampleRate * 0.8; 
              const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
              const data = buffer.getChannelData(0);
              for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
              }

              const noise = audioCtx.createBufferSource();
              noise.buffer = buffer;

              const noiseFilter = audioCtx.createBiquadFilter();
              noiseFilter.type = 'bandpass';
              noiseFilter.frequency.setValueAtTime(3500, now);
              noiseFilter.Q.setValueAtTime(3.0, now);

              const noiseGain = audioCtx.createGain();
              noiseGain.gain.setValueAtTime(0.08, now);
              noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

              noise.connect(noiseFilter);
              noiseFilter.connect(noiseGain);
              noiseGain.connect(audioCtx.destination);

              noise.start(now);
              noise.stop(now + 0.7);

              // 2. 密集随机触发 15 次金属叮当撞击声（模拟多枚硬币掉落叠加）
              const coinCount = 15;
              const baseFreqs = [1800, 2200, 2600, 3100, 3600];

              for (let i = 0; i < coinCount; i++) {
                // 在 0 ~ 0.5 秒内随机分布降落时间，形成倾泻感
                const delay = Math.random() * 0.45;
                const hitTime = now + delay;
                
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                // 随机选择高频音调，模拟不同大小金币碰撞
                const freq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)] + (Math.random() * 400 - 200);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, hitTime);
                // 碰撞瞬间快速向下滑音，体现硬币转动/反弹的效果
                osc.frequency.exponentialRampToValueAtTime(freq * 0.85, hitTime + 0.12);

                // 撞击音量随机
                const volume = 0.15 + Math.random() * 0.2;
                gain.gain.setValueAtTime(volume, hitTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.25);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(hitTime);
                osc.stop(hitTime + 0.25);
              }

            } catch(e) {
              console.error("Audio error:", e);
            }
          }

          // =============== 撒金币雨特效 (Canvas 粒子系统) ===============
          const canvas = document.getElementById('coinCanvas');
          const ctx = canvas.getContext('2d');
          let coins = [];

          function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }
          window.addEventListener('resize', resizeCanvas);
          resizeCanvas();

          class Coin {
            constructor() {
              this.x = Math.random() * canvas.width;
              this.y = -20;
              this.size = Math.random() * 8 + 10;
              this.speedY = Math.random() * 5 + 4;
              this.speedX = (Math.random() - 0.5) * 2;
              this.rotation = Math.random() * 360;
              this.rotSpeed = Math.random() * 10 + 5;
              this.scaleY = 1;
              this.scaleSpeed = Math.random() * 0.1 + 0.05;
              this.opacity = 1;
            }
            update() {
              this.y += this.speedY;
              this.x += this.speedX;
              this.rotation += this.rotSpeed;
              this.scaleY = Math.sin(this.rotation * Math.PI / 180);
              if (this.y > canvas.height - 50) {
                this.opacity -= 0.03;
              }
            }
            draw() {
              ctx.save();
              ctx.translate(this.x, this.y);
              ctx.scale(1, this.scaleY);
              ctx.globalAlpha = Math.max(0, this.opacity);

              // 绘制金色硬币
              ctx.beginPath();
              ctx.arc(0, 0, this.size, 0, Math.PI * 2);
              ctx.fillStyle = '#ffd700';
              ctx.shadowColor = '#ff5000';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#fff7b2';
              ctx.stroke();

              // 内部￥符号
              ctx.fillStyle = '#b37700';
              ctx.font = 'bold ' + (this.size * 1.1) + 'px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('¥', 0, 1);

              ctx.restore();
            }
          }

          function spawnCoinRain() {
            for (let i = 0; i < 35; i++) {
              coins.push(new Coin());
            }
          }

          function animateCoins() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = coins.length - 1; i >= 0; i--) {
              coins[i].update();
              coins[i].draw();
              if (coins[i].opacity <= 0 || coins[i].y > canvas.height) {
                coins.splice(i, 1);
              }
            }
            requestAnimationFrame(animateCoins);
          }
          animateCoins();

          // =============== 主逻辑 ===============
          function updateClock() {
            const now = new Date();
            document.getElementById('liveClock').innerText = now.toLocaleTimeString('zh-CN', { hour12: false });
          }
          setInterval(updateClock, 1000);
          updateClock();

          let lastSeenId = ${latestDetails[0] ? (latestDetails[0].id || 0) : 0};

          // 触发中央漂浮收益特效
          function triggerCashEffect() {
            const box = document.getElementById('cashFloatBox');
            if (!box) return;
            const el = document.createElement('div');
            el.className = 'cash-float-item';
            el.innerText = '新增收入 🎉';
            box.appendChild(el);
            setTimeout(() => el.remove(), 1200);
          }

          function showToast(record) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = 'live-toast';
            toast.innerHTML = \`
              <div style="font-size: 24px;">💰</div>
              <div>
                <div style="font-weight: bold; color: #ffd700; font-size: 13px;">新增收入进账！</div>
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
                }
              }

              if (data.todayIncome !== undefined) {
                const incomeEl = document.getElementById('todayIncomeNum');
                const newText = '¥ ' + data.todayIncome;
                if (incomeEl && incomeEl.innerText !== newText) {
                  incomeEl.innerText = newText;
                  
                  // 金色缩放冲击特效
                  incomeEl.classList.remove('gold-pop');
                  void incomeEl.offsetWidth; 
                  incomeEl.classList.add('gold-pop');
                }
              }

              if (data.latest && data.latest.length > 0) {
                const newest = data.latest[0];
                if (lastSeenId && newest.id > lastSeenId) {
                  showToast(newest);
                  triggerCashEffect(); // 飘字
                  spawnCoinRain();     // 撒金币雨
                  playCoinSound();     // 播放一堆金币洒落音效

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

          // 用户在页面上进行任意交互时自动解锁音频播放权限
          ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.addEventListener(evt, () => { initAudio(); }, { once: true });
          });

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
