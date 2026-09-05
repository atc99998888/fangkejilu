export async function onRequestPost(context) {
  const { request, env } = context;

  // 跨域响应头设置
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    // 自动创建数据库表（如果不存在）
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        city TEXT DEFAULT 'Unknown',
        country TEXT DEFAULT 'Unknown',
        visit_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 获取访问者真实的来源域名（如主域名或 71 个子域名之一）
    const referer = request.headers.get("referer") || request.headers.get("origin") || "";
    let domain = "Unknown";
    if (referer) {
      try {
        domain = new URL(referer).hostname;
      } catch (e) {
        domain = referer;
      }
    } else {
      const url = new URL(request.url);
      domain = url.hostname;
    }

    // 获取 Cloudflare 原生识别的城市和国家
    const city = request.cf?.city || 'Unknown';
    const country = request.cf?.country || 'Unknown';

    // 写入数据库
    await env.DB.prepare(
      "INSERT INTO visits (domain, city, country) VALUES (?, ?, ?)"
    ).bind(domain, city, country).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// 专门响应浏览器的 OPTIONS 预检请求（解决跨域报错）
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
