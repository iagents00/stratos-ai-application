/**
 * views/plan-semanal.js — la lógica pura del Plan Semanal.
 * ─────────────────────────────────────────────────────────────────────────────
 * Separado de PlanSemanal.jsx para poder probarlo sin navegador (mismo patrón
 * que CRM/zoom-metrics.js y CRM/date-range.js). Lo cubre
 * `tools/check_plan_semanal.mjs`.
 *
 * Acá vive lo que es fácil equivocar en silencio: en qué lunes cae una fecha
 * (el domingo es el caso que se rompe siempre, porque para JS el domingo es 0 y
 * para nosotros es el ÚLTIMO día de la semana, no el primero).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Los días de la hoja, de lunes a domingo. */
export const DIAS = [
  { k: "lun", l: "Lunes",     c: "Lun" },
  { k: "mar", l: "Martes",    c: "Mar" },
  { k: "mie", l: "Miércoles", c: "Mié" },
  { k: "jue", l: "Jueves",    c: "Jue" },
  { k: "vie", l: "Viernes",   c: "Vie" },
  { k: "sab", l: "Sábado",    c: "Sáb" },
  { k: "dom", l: "Domingo",   c: "Dom" },
];

/** 09:00 → 18:00 cada media hora (19 franjas), igual que la hoja de Drive. */
export const FRANJAS = (() => {
  const out = [];
  for (let m = 9 * 60; m <= 18 * 60; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

export const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

/**
 * Lunes de la semana a la que pertenece una fecha. La semana va lunes→domingo,
 * así que el domingo pertenece a la semana que ARRANCÓ seis días antes.
 * Devuelve una fecha nueva a medianoche local (no muta la que le pasan).
 */
export function lunesDe(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dow = (d.getDay() + 6) % 7;          // 0 = lunes … 6 = domingo
  d.setDate(d.getDate() - dow);
  return d;
}

/** YYYY-MM-DD en hora LOCAL (toISOString daría el día anterior al oeste de UTC). */
export const isoDe = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "27 jul" — para el encabezado de la semana. */
export const fechaCorta = (d) => `${d.getDate()} ${MESES[d.getMonth()]}`;

/** El plan vacío: la forma canónica del JSON que se guarda. */
export const planVacio = () => ({ slots: {}, notas: "", prioridades: [] });

/**
 * Lee el JSON guardado sin reventar si viene de otra versión, a medio escribir
 * o con basura. Siempre devuelve la forma canónica: la pantalla nunca ve un
 * `slots` que no sea objeto ni un `prioridades` que no sea arreglo.
 */
export function parsePlan(descripcion) {
  if (!descripcion) return planVacio();
  try {
    const p = JSON.parse(descripcion);
    const slots = {};
    if (p && typeof p.slots === "object" && !Array.isArray(p.slots) && p.slots) {
      for (const [k, v] of Object.entries(p.slots)) {
        if (typeof v === "string" && v.trim()) slots[k] = v;
      }
    }
    const prioridades = Array.isArray(p?.prioridades)
      ? p.prioridades
          .filter(x => x && typeof x.texto === "string" && x.texto.trim())
          .map(x => ({ texto: x.texto, hecha: x.hecha === true }))
      : [];
    return { slots, notas: typeof p?.notas === "string" ? p.notas : "", prioridades };
  } catch { return planVacio(); }
}

/** Clave de una franja dentro del plan. */
export const slotKey = (dia, hora) => `${dia}|${hora}`;

/** Cuántas franjas tienen algo escrito (lo que el líder mira de un vistazo). */
export const franjasLlenas = (plan) =>
  Object.values(plan?.slots || {}).filter(v => String(v || "").trim()).length;

/** Título de la fila en `mkt_tasks` — la llave estable por persona y semana. */
export const tituloFilaDe = (lunes) => `Plan semanal ${isoDe(lunes)}`;
