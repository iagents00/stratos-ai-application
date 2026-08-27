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
  // Se recibe varias veces a proposito (el lado nativo la reofrece al abrir la
  // app y con unos segundos de gracia). Guardar la misma dos veces no molesta:
  // la tabla la reemplaza. Lo que SI dolia era recibirla cero veces.
  let ultimaGuardada = null;

  const alLlegarToken = async (ev) => {
    const token = ev?.detail?.token || "";
    if (!token || token === ultimaGuardada) return;
    ultimaGuardada = token;
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

  // Y se BUSCA la que el teléfono dejó guardada, sin esperar a que nos avisen.
  //
  // Es lo que hace que esto funcione siempre: el aviso en vivo solo sirve si
  // estábamos escuchando en ese instante, y al arrancar la app nunca lo
  // estamos — el CRM se engancha después del login, segundos más tarde. Como
  // el teléfono además la deja escrita, acá alcanza con ir a buscarla.
  try {
    const guardada = window.localStorage?.getItem("stratos.voip.token");
    if (guardada) alLlegarToken({ detail: { token: guardada } });
  } catch { /* si no hay, la traerá el aviso en vivo */ }

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

/**
 * ¿Alguien me está llamando AHORA MISMO?
 *
 * Se consulta al abrir la app y al volver del segundo plano, porque en Android
 * la llamada abre la app pero no le cuenta al CRM por qué se abrió. En vez de
 * pasarle el dato por un camino frágil, el CRM lo va a buscar: si hay una
 * llamada de hace menos de un minuto, la muestra.
 *
 * Un minuto es a propósito. Más que eso ya no es una llamada, es un aviso
 * viejo — y aparecer con la pantalla de "te están llamando" por algo de hace
 * cinco minutos es peor que no aparecer.
 *
 * @param {string} userId
 * @returns {Promise<{caller:string, meet:string}|null>}
 */
export async function llamadaEnCurso(userId) {
  if (!userId) return null;
  try {
    const desde = new Date(Date.now() - 60000).toISOString();
    const { data, error } = await supabase
      .from("proactive_reminders")
      .select("payload, created_at")
      .eq("asesor_id", userId)
      .eq("tipo", "llamada_entrante")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const p = data[0].payload || {};
    return {
      caller: p.caller || String(p.title || "Alguien").replace(/\s+te est[aá] llamando.*$/i, "").trim(),
      meet: p.meet || p.url || "",
    };
  } catch {
    return null;
  }
}

/**
 * LAS LLAMADAS QUE YA SE ATENDIERON O SE COLGARON.
 *
 * Sin esto, colgar no servía de nada: el CRM pregunta si te llaman cada vez que
 * la app vuelve al frente, encontraba la MISMA llamada —todavía dentro de su
 * minuto de vida— y la mostraba otra vez. Se colgaba, se volvía a la app, y ahí
 * estaba de nuevo. Reportado por Ángel el 27-ago-2026: «sigue insistiendo».
 *
 * Se guarda en el teléfono y no solo en memoria, porque el caso típico es
 * justamente cerrar la app y volver: si viviera en memoria, se olvidaría en el
 * peor momento.
 *
 * Se conservan solo las últimas: nadie necesita recordar que colgó una llamada
 * de anteayer, y una lista que crece para siempre termina siendo un problema.
 */
const CLAVE_DESPACHADAS = "stratos.llamadas.despachadas";
const CUANTAS_RECORDAR = 20;

function leerDespachadas() {
  try {
    const crudo = window.localStorage?.getItem(CLAVE_DESPACHADAS);
    const l = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(l) ? l : [];
  } catch { return []; }
}

function yaDespachada(id) {
  if (!id) return false;
  return leerDespachadas().includes(id);
}

/** Marca una llamada como resuelta: contestada, colgada o vencida. */
export function marcarLlamadaDespachada(id) {
  if (!id) return;
  try {
    const l = leerDespachadas();
    if (l.includes(id)) return;
    l.push(id);
    window.localStorage?.setItem(
      CLAVE_DESPACHADAS,
      JSON.stringify(l.slice(-CUANTAS_RECORDAR)),
    );
  } catch { /* si no se puede guardar, lo peor es que insista una vez más */ }
}
