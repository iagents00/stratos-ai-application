/**
 * lib/llamadas-nativas.js — el puente entre la pantalla de llamada y el CRM
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ RESUELVE
 *
 * Cuando alguien del equipo llama y el teléfono está bloqueado, iOS muestra su
 * propia pantalla de llamada a pantalla completa —la misma de WhatsApp— y esa
 * pantalla la dibuja el sistema, no nosotros. Este archivo es lo que conecta esa
 * pantalla con el CRM:
 *
 *   · guarda la identificación del teléfono para el canal de llamadas, que es
 *     DISTINTA de la de los avisos normales (el mismo teléfono tiene dos, y no
 *     son intercambiables);
 *   · escucha qué botón tocó la persona y actúa: contestar abre la reunión,
 *     rechazar no hace nada más.
 *
 * ⚠️ Solo existe en el iPhone. En Android la pantalla de llamada se hace de otra
 * forma y en el navegador no aplica: acá todo es no-op silencioso.
 *
 * Creado el 27-ago-2026, a pedido de Ángel.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";
import { isNativeApp } from "./native";

function plataforma() {
  try { return window.Capacitor?.getPlatform?.() || null; } catch { return null; }
}

/** El mismo criterio que usa push-native: un token de Xcode vive en el sandbox. */
function entorno() {
  try { return import.meta.env.PROD ? "production" : "sandbox"; } catch { return "production"; }
}

let yaEscuchando = false;

/**
 * Deja el CRM enganchado a la pantalla de llamada del sistema.
 *
 * @param {string} userId a quién pertenece este teléfono
 * @param {(url:string)=>void} [alContestar] qué hacer cuando aceptan la llamada
 * @returns {() => void} para desengancharse al cerrar sesión
 */
export function engancharLlamadas(userId, alContestar) {
  // Solo iPhone: la pantalla completa de llamada es de iOS.
  if (!isNativeApp() || plataforma() !== "ios" || !userId || yaEscuchando) {
    return () => {};
  }
  yaEscuchando = true;

  // El lado nativo avisa por estos dos eventos. Se escuchan en la ventana
  // porque es el único puente que hay entre Swift y el CRM sin escribir un
  // plugin entero para dos mensajes.
  const alLlegarToken = async (ev) => {
    const token = ev?.detail?.token || "";
    if (!token) return;
    try {
      await supabase.from("device_tokens").upsert({
        user_id: userId,
        token,
        // Se guarda aparte a propósito: si se mezclara con la identificación de
        // los avisos normales, el servidor mandaría avisos al buzón de llamadas
        // y llamadas al de avisos. Apple rechaza los dos casos.
        platform: "ios-voip",
        entorno: entorno(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,token" });
    } catch (e) {
      console.warn("[llamadas] no pude guardar la identificación:", e?.message || e);
    }
  };

  const alTocarBoton = (ev) => {
    const { evento, url } = ev?.detail || {};
    if (evento !== "contestar") return;
    // Contestar entra a la reunión. Si por algo no vino el enlace, al menos se
    // abre el CRM en el Copilot, que es donde está la conversación.
    try { alContestar?.(url || ""); } catch { /* noop */ }
  };

  window.addEventListener("StratosTokenVoIP", alLlegarToken);
  window.addEventListener("StratosLlamada", alTocarBoton);

  return () => {
    yaEscuchando = false;
    window.removeEventListener("StratosTokenVoIP", alLlegarToken);
    window.removeEventListener("StratosLlamada", alTocarBoton);
  };
}

/** Al cerrar sesión: que las llamadas del usuario anterior no sigan sonando acá. */
export async function soltarLlamadas(userId) {
  if (!userId) return;
  try {
    await supabase.from("device_tokens")
      .delete().eq("user_id", userId).eq("platform", "ios-voip");
  } catch { /* best-effort */ }
}
