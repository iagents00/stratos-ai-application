import { rechazoDefinitivoRails } from "./rails-gestion";
import { supabase } from "./supabase";

export const zonaRails = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Los fallos son visibles: una agenda desconocida no equivale a una agenda vacía. */
export async function agendaDeHoy() {
  const { data, error } = await supabase.rpc("rails_agenda_del_dia", { p_timezone: zonaRails() });
  if (error) throw error;
  return Object.fromEntries((data || []).filter(f => f.lead_id && f.estado !== "pendiente")
    .map(f => [f.lead_id, { estado: f.estado, completado_at: f.completado_at, asesor_id: f.asesor_id }]));
}

export async function resolverAccion(accion, gestion) {
  const { data, error } = await supabase.rpc("rails_resolver_accion", {
    p_id: gestion.id, p_lead_id: accion.leadId, p_version: accion.version,
    p_tipo: accion.tipo, p_razon: accion.razon,
    p_resultado: gestion.resultado, p_detalle: gestion.detalle, p_canal: gestion.canal,
    p_siguiente: gestion.siguiente, p_siguiente_at: gestion.fecha, p_timezone: zonaRails(),
  });
  if (error) throw Object.assign(new Error(error.message || "No pudimos confirmar el guardado."), { definitivo: rechazoDefinitivoRails(error) });
  if (!data?.lead?.id) throw new Error("El servidor no confirmó el guardado. Reintenta la misma gestión.");
  return data;
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
