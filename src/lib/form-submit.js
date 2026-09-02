/**
 * lib/form-submit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Envía un formulario público (sin sesión) a la edge function `form-submit`.
 *
 * Por qué una edge function y no un insert directo desde el navegador:
 *   la llave anon del bundle NO puede escribir en ninguna tabla (superficie
 *   anónima cero, ver migración 242). La función corre con service_role,
 *   valida el payload, guarda la respuesta, crea el lead en el CRM de
 *   Stratos Sales y manda el aviso por correo al equipo.
 *
 * La función se despliega con --no-verify-jwt: quien la usa es un visitante
 * anónimo. No hace falta apikey ni token.
 *
 * Uso:
 *   const r = await enviarFormulario({ formulario, contacto, respuestas, meta });
 *   if (!r.ok) mostrar(r.error);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://glulgyhkrqpykxmujodb.supabase.co";

const FORM_SUBMIT_URL =
  import.meta.env.VITE_FORM_SUBMIT_URL || `${SUPABASE_URL}/functions/v1/form-submit`;

const TIMEOUT_MS = 15000;

/**
 * @param {object} p
 * @param {string} p.formulario   slug registrado en la edge function (ej. "onboarding-call-center")
 * @param {object} p.contacto     { empresa, responsable, email, whatsapp }
 * @param {object} p.respuestas   lo que contestó, tal cual lo arma la página
 * @param {object} [p.meta]       { url, duracion_seg, ... }
 * @param {string} [p.trampa]     honeypot: los humanos lo dejan vacío
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
export async function enviarFormulario({ formulario, contacto, respuestas, meta = {}, trampa = "" }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FORM_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        formulario,
        contacto,
        respuestas,
        trampa,
        meta: {
          ...meta,
          url: typeof window !== "undefined" ? window.location.href : "",
          enviado_en: new Date().toISOString(),
        },
      }),
    });
    let cuerpo = null;
    try { cuerpo = await res.json(); } catch { /* sin JSON */ }
    if (!res.ok || !cuerpo?.ok) {
      return { ok: false, error: cuerpo?.error || `No se pudo enviar (HTTP ${res.status})` };
    }
    return { ok: true, id: cuerpo.id };
  } catch (err) {
    const abortado = err?.name === "AbortError";
    return { ok: false, error: abortado ? "El servidor tardó demasiado. Intenta de nuevo." : "Sin conexión. Revisa tu internet e intenta de nuevo." };
  } finally {
    clearTimeout(timer);
  }
}
