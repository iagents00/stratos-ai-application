// Stratos AI — Edge Function: email-unsubscribe
//
// Baja en un clic, RFC 8058.
//
// POR QUÉ EL GET NO DA DE BAJA SOLO:
//   Los antivirus de correo corporativo (Outlook Safe Links y compañía)
//   visitan cada enlace del correo por su cuenta para revisarlo. Si el GET
//   diera de baja, esos escáneres darían de baja a gente que nunca hizo clic.
//   Entonces: GET muestra una página con botón, POST ejecuta.
//   El botón nativo de Gmail manda POST directo, así que ese sigue siendo
//   un clic de verdad.
//
// SIN JWT: la persona que se da de baja no tiene sesión. El token es la
// autorización: 64 hex, único, y solo sirve para su propio correo.
//   supabase functions deploy email-unsubscribe --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARCA        = Deno.env.get("EMAIL_BRAND_NAME") ?? "Duke del Caribe";

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function página(titulo: string, cuerpo: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo} · ${MARCA}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#f5f6f8; color:#0f1720;
         font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:24px; }
  .caja { background:#fff; max-width:460px; width:100%; padding:40px 32px;
          border-radius:14px; box-shadow:0 1px 3px rgba(0,0,0,.08); text-align:center; }
  h1 { font-size:20px; margin:0 0 12px; font-weight:600; letter-spacing:-.01em; }
  p { margin:0 0 20px; color:#4a5560; }
  button { font:inherit; font-weight:600; cursor:pointer; border:0; border-radius:9px;
           padding:13px 26px; background:#0f1720; color:#fff; }
  button:hover { opacity:.88; }
  .marca { margin-top:26px; font-size:13px; color:#8b95a1; }
  .sutil { background:none; color:#6b7684; text-decoration:underline; padding:6px; font-weight:400; }
  @media (prefers-color-scheme: dark) {
    body { background:#0b0f14; color:#e6eaf0; }
    .caja { background:#141a21; box-shadow:none; }
    p { color:#9aa5b1; }
    button { background:#e6eaf0; color:#0b0f14; }
    .sutil { background:none; color:#8b95a1; }
  }
</style></head>
<body><div class="caja">${cuerpo}<div class="marca">${MARCA}</div></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function buscarPorToken(token: string) {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const filas = await rest(
    `email_recipients?unsub_token=eq.${token}&select=id,email,lead_id,organization_id,campaign_id`
  );
  return filas?.[0] ?? null;
}

Deno.serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const alta  = url.searchParams.get("alta") === "1";

  const r = await buscarPorToken(token);

  if (!r) {
    return página(
      "Enlace no válido",
      `<h1>Este enlace ya no sirve</h1>
       <p>Puede que sea de un correo muy viejo. Si quieres dejar de recibir
          mensajes, respóndele a quien te escribió y lo hacemos a mano.</p>`,
      404
    );
  }

  // ── GET: confirmación, sin ejecutar nada ─────────────────────────────────
  if (req.method === "GET") {
    return página(
      "Cancelar suscripción",
      `<h1>¿Dejamos de escribirte?</h1>
       <p>Vamos a quitar <strong>${r.email}</strong> de nuestros correos.
          Es inmediato y lo puedes revertir aquí mismo.</p>
       <form method="POST">
         <button type="submit">Sí, darme de baja</button>
       </form>`
    );
  }

  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  // ── POST: ejecuta. Aquí llega el botón nativo de Gmail y el de la página ──
  const esOneClick = (await req.text()).includes("List-Unsubscribe=One-Click");

  if (alta) {
    // Reactivar: se borra de la lista de exclusión y se limpia el opt_out.
    await rest(
      `email_suppressions?organization_id=eq.${r.organization_id}` +
      `&email=eq.${encodeURIComponent(r.email)}&motivo=eq.baja`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    ).catch(() => {});

    if (r.lead_id) {
      await rest(`leads?id=eq.${r.lead_id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ opt_out: false }),
      }).catch(() => {});
    }

    return página(
      "Suscripción reactivada",
      `<h1>Listo, seguimos en contacto</h1>
       <p><strong>${r.email}</strong> vuelve a recibir nuestros correos.</p>`
    );
  }

  await rest("email_suppressions", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      organization_id: r.organization_id,
      email: r.email,
      motivo: "baja",
      detalle: esOneClick ? "botón del cliente de correo" : "página de baja",
      campaign_id: r.campaign_id,
    }),
  }).catch(() => {});

  if (r.lead_id) {
    await rest(`leads?id=eq.${r.lead_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ opt_out: true }),
    }).catch(() => {});

    await rest("lead_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: r.lead_id,
        organization_id: r.organization_id,
        type: "email",
        action: "Se dio de baja del correo",
        actor_name: "Correo",
        metadata: { via: esOneClick ? "one-click" : "página" },
        occurred_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  // Gmail espera 200 a secas en el one-click, no una página.
  if (esOneClick) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return página(
    "Listo",
    `<h1>Ya no te escribimos</h1>
     <p>Quitamos <strong>${r.email}</strong> de la lista. No vas a recibir más correos nuestros.</p>
     <form method="POST" action="?t=${token}&alta=1">
       <button type="submit" class="sutil">Fue sin querer, vuélveme a suscribir</button>
     </form>`
  );
});
