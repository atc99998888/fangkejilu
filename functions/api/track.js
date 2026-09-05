export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
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

    const city = request.cf?.city || 'Unknown';
    const country = request.cf?.country || 'Unknown';

    await env.DB.prepare(
      "INSERT INTO visits (domain, city, country) VALUES (?, ?, ?)"
    ).bind(domain, city, country).run();

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
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
