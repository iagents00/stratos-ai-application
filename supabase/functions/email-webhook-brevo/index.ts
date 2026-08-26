// Stratos AI — Edge Function: email-webhook-brevo
//
// Gemelo de email-webhook, pero para Brevo. Existe porque los dos proveedores
// hablan distinto: Resend firma con Svix y manda `email.opened`; Brevo no firma
// nada y manda `unique_opened`.
//
// AUTENTICACIÓN: Brevo no firma sus webhooks, así que la única defensa posible
// es un token secreto en la URL. Es más débil que una firma criptográfica —
// quien vea la URL puede llamarla — pero el daño está acotado: solo se pueden
// tocar destinatarios cuyo message-id exacto ya exista en la base.
//
//   supabase functions deploy email-webhook-brevo --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN        = Deno.env.get("BREVO_WEBHOOK_TOKEN") ?? "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

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

function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  const url = new URL(req.url);
  if (!TOKEN || !igualSeguro(url.searchParams.get("t") ?? "", TOKEN)) {
    return json({ error: "Token inválido" }, 401);
  }

  let ev: any;
  try {
    ev = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const tipo    = String(ev.event ?? "");
  // Brevo manda el Message-ID de SMTP, que es justo lo que guardamos al enviar.
  const msgId   = ev["message-id"] ?? ev.message_id ?? null;
  const destino = String(ev.email ?? "").toLowerCase();
  const ahora   = new Date().toISOString();

  if (!msgId) return json({ ok: true, ignorado: "sin message-id" });

  const filas = await rest(
    `email_recipients?provider_message_id=eq.${encodeURIComponent(msgId)}` +
    `&select=id,lead_id,organization_id,email,campaign_id,aperturas,clics,opened_at,clicked_at`
  );
  const r = filas?.[0];
  if (!r) return json({ ok: true, ignorado: "destinatario desconocido" });

  const parche: Record<string, unknown> = {};
  let accionCRM: string | null = null;
  let suprimir: { motivo: string; detalle: string } | null = null;

  switch (tipo) {
    case "delivered":
      parche.estado = "entregado";
      parche.delivered_at = ahora;
      break;

    case "opened":
    case "unique_opened":
      parche.aperturas = (r.aperturas ?? 0) + 1;
      if (!r.opened_at) { parche.opened_at = ahora; accionCRM = "Abrió el correo"; }
      break;

    case "click":
      parche.clics = (r.clics ?? 0) + 1;
      if (!r.clicked_at) { parche.clicked_at = ahora; accionCRM = "Hizo clic en el correo"; }
      break;

    // Permanentes: la dirección no existe o nos bloquearon. No se reintenta.
    case "hard_bounce":
    case "invalid_email":
    case "blocked":
      parche.estado = "rebote";
      parche.bounced_at = ahora;
      parche.error = `${tipo}: ${String(ev.reason ?? "").slice(0, 250)}`;
      accionCRM = "Rebotó el correo";
      suprimir = { motivo: "rebote_duro", detalle: String(parche.error) };
      break;

    // Transitorios: buzón lleno, servidor caído. Se puede reintentar otro día.
    case "soft_bounce":
    case "deferred":
      parche.estado = "rebote";
      parche.bounced_at = ahora;
      parche.error = `${tipo}: ${String(ev.reason ?? "").slice(0, 250)}`;
      break;

    case "spam":
      parche.estado = "queja";
      parche.complained_at = ahora;
      accionCRM = "Marcó el correo como spam";
      suprimir = { motivo: "queja", detalle: "marcó como spam" };
      break;

    case "unsubscribed":
      accionCRM = "Se dio de baja del correo";
      suprimir = { motivo: "baja", detalle: "baja desde el pie de Brevo" };
      break;

    default:
      return json({ ok: true, ignorado: tipo });
  }

  if (Object.keys(parche).length) {
    await rest(`email_recipients?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(parche),
    });
  }

  if (suprimir) {
    await rest("email_suppressions", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        organization_id: r.organization_id,
        email: destino || r.email,
        motivo: suprimir.motivo,
        detalle: suprimir.detalle,
        campaign_id: r.campaign_id,
      }),
    }).catch(() => {});

    if (r.lead_id) {
      await rest(`leads?id=eq.${r.lead_id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ opt_out: true }),
      }).catch(() => {});
    }
  }

  if (accionCRM && r.lead_id) {
    await rest("lead_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: r.lead_id,
        organization_id: r.organization_id,
        type: "email",
        action: accionCRM,
        actor_name: "Correo",
        metadata: { evento: tipo, message_id: msgId, proveedor: "brevo" },
        occurred_at: ahora,
      }),
    }).catch(() => {});
  }

  return json({ ok: true, tipo, destinatario: r.id });
});
