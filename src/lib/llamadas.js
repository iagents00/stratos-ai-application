/**
 * Consultas y estado local de los avisos de llamada del equipo.
 *
 * Las llamadas llegan como notificaciones normales y se atienden desde el
 * aviso interno de Stratos. La app iOS no registra PushKit ni usa CallKit.
 */
import { supabase } from "./supabase";
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
      .select("id, payload, created_at")
      .eq("asesor_id", userId)
      .eq("tipo", "llamada_entrante")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !data || data.length === 0) return null;
    const activa = data.find((item) => !yaDespachada(item.id));
    if (!activa) return null;
    const p = activa.payload || {};
    return {
      id: activa.id,
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
