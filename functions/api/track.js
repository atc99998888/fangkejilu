export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    // 1. 确保基础表存在
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        city TEXT DEFAULT 'Unknown',
        country TEXT DEFAULT 'Unknown',
        visit_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. 自动兼容旧表：如果旧表没有 ip 字段则自动补上（防止旧表插入报错）
    try {
      await env.DB.exec(`ALTER TABLE visits ADD COLUMN ip TEXT DEFAULT 'Unknown';`);
    } catch (e) {
      // 如果 ip 字段已存在则忽略错误
    }

    // 获取来源域名
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

    // 获取访客 IP、城市和国家
    const ip = request.headers.get("cf-connecting-ip") || "Unknown";
    const city = request.cf?.city || 'Unknown';
    const country = request.cf?.country || 'Unknown';

    // 写入 D1 数据库
    await env.DB.prepare(
      "INSERT INTO visits (domain, ip, city, country) VALUES (?, ?, ?, ?)"
    ).bind(domain, ip, city, country).run();

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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
