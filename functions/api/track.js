export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 自动创建数据库表（如果表已存在则跳过）
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        city TEXT DEFAULT 'Unknown',
        country TEXT DEFAULT 'Unknown',
        visit_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 获取访问的域名与 Cloudflare 原生识别的地理位置
    const url = new URL(request.url);
    const domain = url.hostname;
    const city = request.cf?.city || 'Unknown';
    const country = request.cf?.country || 'Unknown';

    // 写入 D1 数据库
    await env.DB.prepare(
      "INSERT INTO visits (domain, city, country) VALUES (?, ?, ?)"
    ).bind(domain, city, country).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
