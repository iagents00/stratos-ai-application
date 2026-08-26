// Stratos AI — Edge Function: email-webhook
//
// Recibe los eventos de Resend y los devuelve al CRM. Esto es lo que separa
// "mandar correos" de "email marketing": el asesor abre el lead y ve que la
// persona abrió la invitación tres veces y no se registró.
//
// Un rebote duro o una queja entran a email_suppressions Y marcan
// leads.opt_out. Esa persona no vuelve a recibir nada, de ninguna campaña,
// nunca. Es lo que sostiene la reputación del dominio a un año vista.
//
// SIN JWT: Resend no manda Authorization. La autenticidad se prueba con la
// firma Svix, que es criptográfica y con ventana de tiempo. Desplegar con:
//   supabase functions deploy email-webhook --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const TOLERANCIA_SEG = 300; // 5 minutos, igual que el estándar de Svix

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

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function bytesToB64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** Comparación en tiempo constante: no filtra información por cuánto tarda. */
function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function firmaVálida(req: Request, crudo: string) {
  if (!WEBHOOK_SECRET) return false;

  const id    = req.headers.get("svix-id");
  const ts    = req.headers.get("svix-timestamp");
  const firma = req.headers.get("svix-signature");
  if (!id || !ts || !firma) return false;

  // Ventana de tiempo: bloquea reenvíos de un webhook capturado hace horas.
  const edad = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(edad) || edad > TOLERANCIA_SEG) return false;

  const secreto = WEBHOOK_SECRET.startsWith("whsec_")
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;

  const llave = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const esperada = bytesToB64(
    await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(`${id}.${ts}.${crudo}`))
  );

  // El header trae una o varias versiones: "v1,firma v1,otra"
  return firma
    .split(" ")
    .map((p) => p.split(",")[1] ?? "")
    .some((f) => igualSeguro(f, esperada));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  const crudo = await req.text();

  if (!(await firmaVálida(req, crudo))) {
    return json({ error: "Firma inválida" }, 401);
  }

  let evento: any;
  try {
    evento = JSON.parse(crudo);
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const tipo    = String(evento.type ?? "");
  const msgId   = evento?.data?.email_id ?? null;
  const destino = (evento?.data?.to?.[0] ?? "").toLowerCase();
  const ahora   = new Date().toISOString();

  if (!msgId) return json({ ok: true, ignorado: "sin email_id" });

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
    case "email.delivered":
      parche.estado = "entregado";
      parche.delivered_at = ahora;
      break;

    case "email.opened":
      parche.aperturas = (r.aperturas ?? 0) + 1;
      if (!r.opened_at) {
        parche.opened_at = ahora;
        accionCRM = "Abrió el correo";
      }
      break;

    case "email.clicked":
      parche.clics = (r.clics ?? 0) + 1;
      if (!r.clicked_at) {
        parche.clicked_at = ahora;
        accionCRM = "Hizo clic en el correo";
      }
      break;

    case "email.bounced": {
      parche.estado = "rebote";
      parche.bounced_at = ahora;
      const b = evento?.data?.bounce ?? {};
      parche.error = `${b.type ?? "?"}/${b.subType ?? "?"}: ${b.message ?? ""}`.slice(0, 300);
      accionCRM = "Rebotó el correo";
      // Solo el rebote permanente excluye. Un buzón lleno se reintenta.
      if (String(b.type ?? "").toLowerCase() === "permanent") {
        suprimir = { motivo: "rebote_duro", detalle: String(parche.error) };
      }
      break;
    }

    case "email.complained":
      parche.estado = "queja";
      parche.complained_at = ahora;
      accionCRM = "Marcó el correo como spam";
      suprimir = { motivo: "queja", detalle: "marcó como spam" };
      break;

    default:
      return json({ ok: true, ignorado: tipo });
  }

  await rest(`email_recipients?id=eq.${r.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(parche),
  });

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

    // Una queja de spam es un "no me contactes" de toda la casa, no solo del correo.
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
        metadata: { evento: tipo, message_id: msgId },
        occurred_at: ahora,
      }),
    }).catch(() => {});
  }

  return json({ ok: true, tipo, destinatario: r.id });
});
