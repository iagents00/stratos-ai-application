// Public browser credential; RLS and the exact-code RPC enforce access.
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdWxneWhrcnFweWt4bXVqb2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjc0ODQsImV4cCI6MjA5Mjg0MzQ4NH0.GUPRPxZM8G50TVpvTDegzADO8n117clpTgSQpaMJAEk';
/**
 * api/og-landing.js — Preview OG para el link del portafolio (/p).
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsApp/redes leen los <meta> OG del HTML. El SPA sirve el mismo index.html
 * para todas las rutas, así que /p mostraría la imagen de marketing. Esta
 * función (Vercel) intercepta SOLO /p: toma el index.html real (con los scripts
 * del app intactos, para que el fragmento #d=... siga renderizando la landing
 * en el navegador) y le inyecta un OG "Portafolio Personalizado" con imagen.
 * El crawler ve el OG; el usuario ve el app completo.
 */
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanLabel = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) : '';

export default async function handler(req, res) {
  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end();
  }
  const requestedHost = String(req.headers?.host || "").toLowerCase();
  const allowedHosts = new Set([
    "app.stratoscapitalgroup.com", "stratoscapitalgroup.com", "www.stratoscapitalgroup.com",
    "getstratosai.com", "www.getstratosai.com", "app.getstratosai.com",
    "stratos-ai-application.vercel.app", process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter(Boolean));
  // Never interpolate arbitrary Host headers into a server-side fetch or HTML.
  const host = allowedHosts.has(requestedHost) ? requestedHost : "app.stratoscapitalgroup.com";
  const base = `https://${host}`;
  let html;
  try {
    const r = await fetch(`${base}/index.html`, {
      headers: { "x-og-bypass": "1" }, signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!r.ok) throw new Error("index_unavailable");
    html = await r.text();
  } catch {
    res.statusCode = 302;
    res.setHeader("Location", "/index.html");
    return res.end();
  }

  const img = `${base}/og-portafolio-stratos-v2.png`;
  let title = "Portafolio Personalizado de Propiedades";
  let desc = "Una selección de propiedades preparada especialmente para ti.";
  let agency = "Stratos";
  // Fragments (#d) never reach servers. Short codes enable personalized previews.
  const pathname = new URL(req.url || "/p", base).pathname;
  const code = pathname.match(/^\/p\/([A-Za-z0-9_-]{1,64})\/?$/)?.[1]
    || (typeof req.query?.code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(req.query.code) ? req.query.code : null);
  if (code) {
    try {
      const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || PUBLIC_ANON_KEY;
      const r = await fetch("https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/resolve_portfolio_link", {
        method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ p_code: code }), signal: AbortSignal.timeout(4000), redirect: "error",
      });
      if (r.ok) {
        const encoded = await r.json();
        if (typeof encoded === "string" && encoded.length <= 60000) {
          const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
          if (Array.isArray(payload.p) && payload.p.length) {
            agency = cleanLabel(payload.g) || agency;
            const client = cleanLabel(payload.c);
            title = client ? `Portafolio para ${client} · ${agency}` : `Portafolio personalizado · ${agency}`;
            desc = `${agency} ha preparado esta selección de propiedades para ti.`;
          }
        }
      }
    } catch { /* The app still resolves the link; never cache a server error page. */ }
  }
  const canonical = `${base}/p${code ? `/${code}` : ""}`;

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image:alt" content="Portafolio personalizado · Stratos. Fondo negro, letras blancas y acentos azul cielo.">`,
    `<meta property="og:site_name" content="${escapeHtml(agency)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:secure_url" content="${img}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1730">`,
    `<meta property="og:image:height" content="909">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(desc)}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].join("");

  html = html
    .replace(/<meta[^>]*(?:property=["']og:[^"']*["']|name=["']twitter:[^"']*["'])[^>]*>\s*/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", tags + "</head>");

  res.statusCode = 200;
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.end(req.method === "HEAD" ? undefined : html);
}
