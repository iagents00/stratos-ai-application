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
export default async function handler(req, res) {
  const host = (req.headers && req.headers.host) || "app.stratoscapitalgroup.com";
  const base = `https://${host}`;
  let html;
  try {
    const r = await fetch(`${base}/index.html`, { headers: { "x-og-bypass": "1" } });
    html = await r.text();
  } catch (e) {
    res.statusCode = 302;
    res.setHeader("Location", "/index.html");
    return res.end();
  }

  const img = `${base}/og-portafolio.png`;
  const title = "Portafolio Personalizado de Propiedades";
  const desc = "Una selección exclusiva de propiedades de inversión en la Riviera Maya, preparada especialmente para ti.";
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Stratos AI">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:secure_url" content="${img}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${img}">`,
  ].join("");

  html = html
    .replace(/<meta[^>]*(?:property=["']og:[^"']*["']|name=["']twitter:[^"']*["'])[^>]*>\s*/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace("</head>", tags + "</head>");

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.end(html);
}
