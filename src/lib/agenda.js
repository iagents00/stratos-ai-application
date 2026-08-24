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
 * DEGRADACIÓN: si la RPC falla —cuenta demo sin sesión real, sin red, permisos—
 * NO se rompe la pantalla. La tarjeta igual desaparece y el contador sube; se
 * pierde solo la persistencia. Un asesor con mala señal tiene que poder
 * trabajar su lista.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";

/** Qué se cerró hoy. Devuelve un mapa leadId -> estado, o {} si no se pudo. */
export async function agendaDeHoy() {
  try {
    const { data, error } = await supabase.rpc("rails_agenda_hoy");
    if (error) {
      console.warn("[agenda] no se pudo leer la agenda de hoy:", error.message);
      return {};
    }
    const mapa = {};
    for (const fila of data || []) {
      if (fila.lead_id && fila.estado !== "pendiente") mapa[fila.lead_id] = fila.estado;
    }
    return mapa;
  } catch (e) {
    console.warn("[agenda] error leyendo la agenda:", e?.message || e);
    return {};
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
    });
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
