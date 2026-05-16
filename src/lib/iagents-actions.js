/**
 * lib/iagents-actions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cliente HTTP fino para el webhook de orquestación de n8n.
 *
 * n8n expone UN webhook genérico que rutea internamente por el campo `action`
 * del payload. Acciones soportadas:
 *   - "llamar_ia"        → dispara llamada outbound vía Retell AI
 *   - "enviar_plantilla" → envía plantilla de WhatsApp vía Chatwoot
 *   - "descartar_lead"   → marca lead como perdido + cierra conversación
 *
 * NOTA DE SEGURIDAD: este webhook es público (no requiere auth en n8n hoy).
 * Eso significa que cualquiera con la URL puede dispararlo. Por eso desde la
 * UI solo lo exponemos a usuarios con flag `crm_only = true` (cuentas bot
 * tipo iagents@stratos.ai). Si en el futuro hay que abrirlo a más usuarios,
 * agregar auth (HMAC compartido o Supabase JWT) en el nodo de entrada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const N8N_INTERNAL_WEBHOOK_URL =
  "https://personal-n8n.suwsiw.easypanel.host/webhook/api-interna-stratos";

const TIMEOUT_MS = 15000;

async function postJson(url, body, { timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let parsed = null;
    try { parsed = await res.json(); } catch { /* webhook puede no devolver JSON */ }
    if (!res.ok) {
      return { ok: false, status: res.status, error: parsed?.error || `HTTP ${res.status}`, data: parsed };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: e?.message || "network error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normaliza un teléfono a formato E.164. Acepta entradas con espacios,
 * paréntesis, guiones, y con o sin "+". Si no podemos asegurarlo, devuelve
 * lo que tengamos con "+" delante (n8n hace su propia validación al final).
 */
export function toE164(phone) {
  if (!phone) return null;
  const raw  = String(phone).trim();
  const digs = raw.replace(/[^0-9]/g, "");
  if (digs.length < 7) return null;
  return raw.startsWith("+") ? `+${digs}` : `+${digs}`;
}

/**
 * Dispara una llamada outbound vía Retell.
 * @param {string} phoneE164 — teléfono del lead.
 * @returns {Promise<{ok: boolean, status?: number, error?: string, data?: any}>}
 */
export async function triggerIaCall(phoneE164) {
  const phone = toE164(phoneE164);
  if (!phone) return { ok: false, error: "phone_invalid" };
  return postJson(N8N_INTERNAL_WEBHOOK_URL, {
    action: "llamar_ia",
    phone_e164: phone,
  });
}

/**
 * Envía una plantilla de WhatsApp (handoff manual al asesor).
 * Stub listo para usar; UI aún no expone botón.
 */
export async function sendIaTemplate(phoneE164, templateName) {
  const phone = toE164(phoneE164);
  if (!phone) return { ok: false, error: "phone_invalid" };
  return postJson(N8N_INTERNAL_WEBHOOK_URL, {
    action: "enviar_plantilla",
    phone_e164: phone,
    template: templateName || null,
  });
}

/**
 * Marca al lead como descartado en el flujo del bot.
 * Stub listo para usar; UI aún no expone botón.
 */
export async function discardLeadViaIa(phoneE164, reason = null) {
  const phone = toE164(phoneE164);
  if (!phone) return { ok: false, error: "phone_invalid" };
  return postJson(N8N_INTERNAL_WEBHOOK_URL, {
    action: "descartar_lead",
    phone_e164: phone,
    reason,
  });
}

/**
 * Decide si el user activo puede disparar acciones IA outbound desde el CRM.
 * Hoy: solo cuentas con `crm_only = true` (iagents@stratos.ai). Si en el
 * futuro queremos que más users puedan, cambiar esta función.
 */
export function canTriggerIaActions(user) {
  return !!user && user.crmOnly === true;
}
