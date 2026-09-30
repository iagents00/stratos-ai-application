/**
 * lib/agenda.js — Persistencia de la lista del día (Stratos Rails)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mi Día calcula sus tarjetas en el navegador con lib/next-action-engine.js,
 * pero el resultado de trabajarlas tiene que sobrevivir a un F5. Eso vive en
 * agenda_items, y se escribe por RPC, nunca con un insert directo.
 *
 * POR QUÉ RPC: la organización y el nombre del asesor los deriva el servidor de
 * auth.uid(). Si el front pudiera mandar organization_id, un request manipulado
 * escribiría en la agenda de otra empresa.
 *
 * Los errores de lectura se propagan y el caller conserva las acciones cuando
 * una escritura no es confirmada. No presentar éxito local como persistencia.
 */
import { supabase } from "./supabase";

/** Qué se cerró hoy. Devuelve un mapa leadId -> estado, o {} si no se pudo. */
export async function agendaDeHoy() {
  try {
    const { data, error } = await supabase.rpc("rails_agenda_hoy").abortSignal(AbortSignal.timeout(10000));
    if (error) {
      console.warn("[agenda] no se pudo leer la agenda de hoy:", error.message);
      throw new Error("No se pudo leer la agenda de hoy.");
    }
    const mapa = {};
    for (const fila of data || []) {
      if (fila.lead_id && fila.estado !== "pendiente") mapa[fila.lead_id] = fila.estado;
    }
    return mapa;
  } catch (e) {
    console.warn("[agenda] error leyendo la agenda:", e?.message || e);
    throw new Error("No se pudo leer la agenda de hoy.");
  }
}

/**
 * Cierra una tarjeta. Idempotente por (lead, día) del lado del servidor: cerrar
 * dos veces actualiza, no duplica.
 *
 * @param {object} accion - lo que devuelve next-action-engine
 * @param {"hecho"|"movido"|"saltado"} estado
 * @returns {Promise<boolean>} true si quedó guardado
 */
export async function marcarAccion(accion, estado, resultado = null) {
  if (!accion?.leadId) return false;
  try {
    const { error } = await supabase.rpc("rails_marcar_accion", {
      p_lead_id:   accion.leadId,
      p_tipo:      accion.tipo,
      p_razon:     accion.razon,
      p_estado:    estado,
      p_pedir:     accion.pedir ?? null,
      p_canal:     accion.canal ?? null,
      p_resultado: resultado,
    }).abortSignal(AbortSignal.timeout(10000));
    if (error) {
      console.warn("[agenda] no se pudo guardar la acción:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[agenda] error guardando la acción:", e?.message || e);
    return false;
  }
}

/**
 * La fecha a la que se mueve un cliente desde Mi Día.
 *
 * Devuelve las dos formas que el CRM necesita: el instante real (`iso`, que es
 * lo que ordena y con lo que el motor decide si una promesa venció) y el texto
 * local `YYYY-MM-DD HH:mm` que la ficha guarda como fecha cruda.
 *
 * Siempre a las 9 de la mañana: la hora en que se empieza a trabajar la lista,
 * no la hora exacta en que el asesor tocó el botón. Mover algo a las 16:47 de
 * dentro de tres días no significa nada para nadie.
 */
export function fechaParaMover(dias, desde = new Date()) {
  const cuando = new Date(desde);
  cuando.setDate(cuando.getDate() + dias);
  cuando.setHours(9, 0, 0, 0);
  const dd = (n) => String(n).padStart(2, "0");
  return {
    iso: cuando.toISOString(),
    local: `${cuando.getFullYear()}-${dd(cuando.getMonth() + 1)}-${dd(cuando.getDate())} 09:00`,
  };
}
