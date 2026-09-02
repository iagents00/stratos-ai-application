// Stratos AI — Edge Function: form-submit
//
// Recibe un formulario público (el visitante no tiene sesión), lo guarda,
// lo deja como lead en el CRM y avisa al equipo por correo.
//
// Reglas:
//   • Solo formularios REGISTRADOS abajo. Un slug desconocido se rechaza:
//     esta puerta no sirve para escribir lo que sea en la base.
//   • El navegador nunca toca la base: la función llama con service_role a
//     fn_form_guardar_respuesta (migración 242), que es la única que escribe.
//   • Honeypot + tamaños máximos + tope de 5 envíos por correo al día (en SQL).
//   • El correo al equipo NO bloquea la respuesta: si Resend falla se intenta
//     Brevo; si ambos fallan, la respuesta ya quedó guardada y visible en el
//     CRM — se registra el error y se contesta ok al visitante.
//
// SIN JWT: quien manda es un prospecto anónimo desde la landing.
//   supabase functions deploy form-submit --no-verify-jwt
//
// Secrets opcionales (Settings → Edge Functions → Secrets):
//   FORM_NOTIFY_TO    a quién llega el aviso (coma-separado). Default abajo.
//   FORM_NOTIFY_FROM  remitente; debe ser del dominio verificado en Resend.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const BREVO_API_KEY  = Deno.env.get("BREVO_API_KEY") ?? "";
const NOTIFY_TO      = (Deno.env.get("FORM_NOTIFY_TO") ?? "info@stratoscapitalgroup.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
const NOTIFY_FROM    = Deno.env.get("FORM_NOTIFY_FROM") ?? "Stratos AI <formularios@stratoscapitalgroup.com>";

// ── Formularios que esta puerta acepta ──────────────────────────────────────
// org = a qué CRM cae el lead. Stratos Sales es el tenant con el que NSG vende.
const FORMULARIOS: Record<string, { org: string; titulo: string; secciones: Seccion[] }> = {
  "onboarding-call-center": {
    org: "b1145073-434c-4779-a243-d5e8f5ff3617",
    titulo: "Onboarding · AI Call Center",
    // Cómo se lee cada respuesta en el correo y en las notas del lead.
    // clave = campo en `respuestas`; lista = se imprime con viñetas.
    secciones: [
      { titulo: "Tipos de clientes",          campos: [{ k: "tipos_clientes", l: "Perfiles", lista: true }] },
      { titulo: "Criterios de calificación",  campos: [{ k: "criterios", l: "Datos que la IA debe recopilar", lista: true }, { k: "criterios_otro", l: "Otro dato necesario" }] },
      { titulo: "Objetivos de la llamada",    campos: [{ k: "objetivos", l: "Objetivos", lista: true }, { k: "objetivos_otro", l: "Otro objetivo o contexto" }] },
      { titulo: "Experiencia y tono",         campos: [{ k: "tono_etiquetas", l: "Estilo", lista: true }, { k: "tono", l: "Cómo quieren la atención" }] },
      { titulo: "Entrenamiento",              campos: [{ k: "ejemplos_via", l: "Cómo mandará los ejemplos" }] },
    ],
  },
};

type Campo   = { k: string; l: string; lista?: boolean };
type Seccion = { titulo: string; campos: Campo[] };

const MAX_TEXTO  = 4000;   // por campo
const MAX_CUERPO = 60_000; // request completo

const ORIGENES_OK = [
  /^https:\/\/([a-z0-9-]+\.)?stratoscapitalgroup\.com$/i,
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const ok = ORIGENES_OK.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://stratoscapitalgroup.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(req) },
  });

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function correoValido(e: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(e)
    && !/^\.|\.@|@\.|\.\./.test(e)
    && e.length <= 254;
}

/** Texto plano, recortado. Arrays → array de textos. Lo demás se descarta. */
function limpiar(v: unknown): string | string[] | null {
  if (typeof v === "string") return v.trim().slice(0, MAX_TEXTO);
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 500)).filter(Boolean).slice(0, 40);
  }
  return null;
}

/** Recorre las secciones y arma [ {titulo, filas:[{l, v}]} ] con solo lo contestado. */
function armar(def: Seccion[], r: Record<string, unknown>) {
  return def.map((s) => ({
    titulo: s.titulo,
    filas: s.campos
      .map((c) => ({ l: c.l, lista: !!c.lista, v: limpiar(r[c.k]) }))
      .filter((f) => f.v && (Array.isArray(f.v) ? f.v.length : f.v.length)),
  })).filter((s) => s.filas.length);
}

function resumenTexto(titulo: string, contacto: Record<string, string>, secciones: ReturnType<typeof armar>) {
  const fecha = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });
  const out: string[] = [`[${titulo} · ${fecha}]`];
  out.push(`Empresa: ${contacto.empresa || "-"}`);
  out.push(`Responsable: ${contacto.responsable || "-"}`);
  out.push(`Correo: ${contacto.email || "-"}`);
  if (contacto.whatsapp) out.push(`WhatsApp: ${contacto.whatsapp}`);
  for (const s of secciones) {
    out.push("", s.titulo.toUpperCase());
    for (const f of s.filas) {
      if (Array.isArray(f.v)) out.push(`${f.l}:`, ...f.v.map((x) => `  · ${x}`));
      else out.push(`${f.l}: ${f.v}`);
    }
  }
  return out.join("\n");
}

function correoHtml(titulo: string, contacto: Record<string, string>, secciones: ReturnType<typeof armar>, leadId: string | null) {
  const fila = (l: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7684;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(l)}</td><td style="padding:6px 0;font-size:14px;color:#0f1720">${v}</td></tr>`;
  const valor = (f: { v: string | string[] }) =>
    Array.isArray(f.v)
      ? `<ul style="margin:0;padding-left:18px">${f.v.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
      : escapeHtml(f.v).replace(/\n/g, "<br>");

  const bloques = secciones.map((s) => `
    <h3 style="margin:22px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#34a586">${escapeHtml(s.titulo)}</h3>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">${s.filas.map((f) => fila(f.l, valor(f))).join("")}</table>`).join("");

  const crm = leadId
    ? `<p style="margin:26px 0 0"><a href="https://app.stratoscapitalgroup.com/stratos-sales" style="display:inline-block;background:#0f1720;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:9px">Abrir en el CRM de Stratos Sales</a></p>`
    : "";

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f6f8;padding:24px;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1720">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;padding:32px 30px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b95a1">Nueva respuesta</p>
  <h1 style="margin:0 0 18px;font-size:21px;letter-spacing:-.01em">${escapeHtml(titulo)}</h1>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${fila("Empresa", `<strong>${escapeHtml(contacto.empresa || "-")}</strong>`)}
    ${fila("Responsable", escapeHtml(contacto.responsable || "-"))}
    ${fila("Correo", `<a href="mailto:${escapeHtml(contacto.email)}" style="color:#0f1720">${escapeHtml(contacto.email || "-")}</a>`)}
    ${contacto.whatsapp ? fila("WhatsApp", `<a href="https://wa.me/${escapeHtml(contacto.whatsapp.replace(/\D/g, ""))}" style="color:#0f1720">${escapeHtml(contacto.whatsapp)}</a>`) : ""}
  </table>
  ${bloques}
  ${crm}
  <p style="margin:28px 0 0;font-size:12px;color:#8b95a1">Responde a este correo y le llega directo al cliente. Stratos AI · formulario público.</p>
</div></body></html>`;
}

async function enviarCorreo(asunto: string, html: string, replyTo: string): Promise<string> {
  if (RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_FROM, to: NOTIFY_TO, subject: asunto, html, reply_to: replyTo }),
    });
    if (r.ok) return "resend";
    console.error("[form-submit] Resend falló:", r.status, await r.text());
  }
  if (BREVO_API_KEY) {
    const m = NOTIFY_FROM.match(/^(.*?)\s*<([^>]+)>$/);
    const sender = m ? { name: m[1].trim(), email: m[2] } : { email: NOTIFY_FROM };
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, to: NOTIFY_TO.map((email) => ({ email })), subject: asunto, htmlContent: html, replyTo: { email: replyTo } }),
    });
    if (r.ok) return "brevo";
    console.error("[form-submit] Brevo falló:", r.status, await r.text());
  }
  throw new Error("ningún proveedor de correo respondió");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST")    return json(req, { ok: false, error: "Solo POST" }, 405);

  const crudo = await req.text();
  if (crudo.length > MAX_CUERPO) return json(req, { ok: false, error: "El envío es demasiado grande" }, 413);

  let p: Record<string, unknown>;
  try { p = JSON.parse(crudo); } catch { return json(req, { ok: false, error: "Body inválido" }, 400); }

  // Honeypot: el campo lo llena un bot, nunca una persona. Se contesta ok
  // para no darle pistas, y no se guarda nada.
  if (typeof p.trampa === "string" && p.trampa.trim()) return json(req, { ok: true, id: null });

  const slug = String(p.formulario ?? "");
  const def  = FORMULARIOS[slug];
  if (!def) return json(req, { ok: false, error: "Formulario desconocido" }, 400);

  const c = (p.contacto ?? {}) as Record<string, unknown>;
  const contacto = {
    empresa:     String(c.empresa ?? "").trim().slice(0, 200),
    responsable: String(c.responsable ?? "").trim().slice(0, 200),
    email:       String(c.email ?? "").trim().toLowerCase().slice(0, 254),
    whatsapp:    String(c.whatsapp ?? "").trim().slice(0, 40),
  };
  if (!contacto.empresa || !contacto.responsable) return json(req, { ok: false, error: "Faltan la empresa o el responsable" }, 400);
  if (!correoValido(contacto.email))              return json(req, { ok: false, error: "El correo no es válido" }, 400);

  const respuestas = (p.respuestas && typeof p.respuestas === "object" && !Array.isArray(p.respuestas))
    ? p.respuestas as Record<string, unknown> : {};
  const secciones = armar(def.secciones, respuestas);
  const resumen   = resumenTexto(def.titulo, contacto, secciones);

  const metaIn = (p.meta && typeof p.meta === "object") ? p.meta as Record<string, unknown> : {};
  const meta = {
    url:          String(metaIn.url ?? "").slice(0, 500),
    duracion_seg: Number(metaIn.duracion_seg) || null,
    user_agent:   (req.headers.get("User-Agent") ?? "").slice(0, 300),
    resumen,
  };

  // ── Guardar + lead en el CRM (una sola transacción en SQL) ────────────────
  let guardado: { respuesta_id: string; lead_id: string | null };
  try {
    guardado = await rest("rpc/fn_form_guardar_respuesta", {
      method: "POST",
      body: JSON.stringify({
        p_org_id: def.org,
        p_formulario: slug,
        p_contacto: contacto,
        p_respuestas: respuestas,
        p_meta: meta,
      }),
    });
  } catch (err) {
    const msg = String(err);
    console.error("[form-submit] no se pudo guardar:", msg);
    const tope = /demasiados env/i.test(msg);
    return json(req, { ok: false, error: tope ? "Ya recibimos varias respuestas de este correo hoy. Intenta mañana." : "No pudimos guardar tu respuesta. Intenta de nuevo." }, tope ? 429 : 500);
  }

  // ── Aviso al equipo (no bloquea) ─────────────────────────────────────────
  try {
    const asunto = `Nuevo onboarding AI Call Center · ${contacto.empresa}`;
    const via = await enviarCorreo(asunto, correoHtml(def.titulo, contacto, secciones, guardado.lead_id), contacto.email);
    await rest(`form_respuestas?id=eq.${guardado.respuesta_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ notificado_at: new Date().toISOString(), meta: { ...meta, notificado_via: via } }),
    });
  } catch (err) {
    console.error("[form-submit] guardado pero sin correo:", String(err));
  }

  return json(req, { ok: true, id: guardado.respuesta_id });
});
