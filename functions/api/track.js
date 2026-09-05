export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    // 自动全新初始化数据表（单行 SQL）
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL, ip TEXT DEFAULT 'Unknown', city TEXT DEFAULT 'Unknown', country TEXT DEFAULT 'Unknown', visit_time DATETIME DEFAULT CURRENT_TIMESTAMP);");

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

    // 24小时去重逻辑：查询该 IP 在过去24小时内是否访问过当前域名
    if (ip !== "Unknown") {
      const recentVisit = await env.DB.prepare(
        "SELECT id FROM visits WHERE domain = ? AND ip = ? AND visit_time >= datetime('now', '-1 day') LIMIT 1"
      ).bind(domain, ip).first();

      // 如果 24 小时内已有记录，直接返回成功但不重复写入
      if (recentVisit) {
        return new Response(JSON.stringify({ success: true, message: "24h duplicate visit ignored" }), {
          headers: corsHeaders
        });
      }
    }

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
