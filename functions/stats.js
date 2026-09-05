export async function onRequestGet(context) {
  const { request, env } = context;

  // 请自行修改下面的后台访问密码
  const SECRET_KEY = "123456"; 
  const url = new URL(request.url);

  if (url.searchParams.get("key") !== SECRET_KEY) {
    return new Response("未授权访问：请在 URL 末尾加上 ?key=你的密码", { status: 403 });
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT domain, country, city, COUNT(*) as total_visits 
      FROM visits 
      GROUP BY domain, country, city 
      ORDER BY domain ASC, total_visits DESC
    `).all();

    let rowsHtml = (results || []).map(row => `
      <tr>
        <td><strong>${escapeHtml(row.domain)}</strong></td>
        <td>${escapeHtml(row.country)}</td>
        <td>${escapeHtml(row.city)}</td>
        <td>${row.total_visits}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>域名与城市访问统计后台</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; background: #f9f9f9; }
          .container { max-width: 900px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h2 { text-align: center; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
          th { background-color: #f4f4f4; color: #555; }
          tr:nth-child(even) { background-color: #fafafa; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>域名 - 访客城市统计报表</h2>
          <table>
            <thead>
              <tr><th>访问域名</th><th>国家</th><th>城市</th><th>总访问量</th></tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" style="text-align:center;">暂无访问数据</td></tr>'}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    return new Response("数据库建立成功但尚无数据，请先访问一次网站首页。", { status: 200 });
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
