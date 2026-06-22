/**
 * app/views/ZoomControl/constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogos del panel "Control de Zooms" (Duke del Caribe).
 *
 * Replican las hojas de Catálogos del Excel "control_zooms_agendados_roles":
 *   · LINERS         — setters que AGENDAN la cita (quién consigue el Zoom).
 *   · PRESENTADORES  — closers que CORREN el Zoom (principal y, opcional, apoyo).
 *   · ESTATUS        — ciclo de vida de cada Zoom (Agendado → … → terminal).
 *   · PAIRINGS       — dupla sugerida Liner → Presentador (pre-llenado del form,
 *                      el usuario siempre puede cambiarla).
 *
 * Son SEMILLA editable: el form permite teclear un nombre nuevo que no esté en
 * la lista (igual que el Excel toleraba entradas a mano). Las listas solo
 * arrancan el dropdown; no son una validación dura.
 *
 * Los colores siguen la familia verde/azul/naranja del design system (sin
 * rosas/violetas/amarillos puros) y leen bien sobre tema claro y oscuro —
 * mismo criterio que COLORS_BY_KEY de ComandoDirectivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Setters que agendan el Zoom.
export const LINERS = [
  "Gael Velasco",
  "Carlos Ayala",
  "Cecilia Mendoza",
  "Daniel Pavon",
  "Victor Benitez",
];

// Closers que corren el Zoom (principal o apoyo).
export const PRESENTADORES = [
  "Oscar Gálvez",
  "Ken Lugo",
  "Cecilia Mendoza",
  "Daniel Pavon",
  "Gael Velasco",
];

// Ciclo de vida del Zoom, en orden operativo. El índice define el "avance".
export const ESTATUS = [
  "Agendado",
  "Confirmado",
  "Asistió",
  "No show",
  "Reagendado",
  "Cancelado",
];

export const ESTATUS_DEFAULT = "Agendado";

// Color por estatus (hex saturado, legible en claro/oscuro).
//   Agendado   → azul programado · Confirmado → azul cielo (avanzando)
//   Asistió    → verde esmeralda (éxito)
//   No show    → naranja profundo (atención)
//   Reagendado → ámbar (precaución) · Cancelado → gris (terminal neutro)
export const ESTATUS_COLORS = {
  "Agendado":   "#3B82F6",
  "Confirmado": "#0EA5E9",
  "Asistió":    "#10B981",
  "No show":    "#EA580C",
  "Reagendado": "#F59E0B",
  "Cancelado":  "#64748B",
};

// Estatus que cuentan como "el Zoom efectivamente ocurrió".
export const ESTATUS_ASISTIO = "Asistió";
// Estatus que cuentan como "no ocurrió por el cliente".
export const ESTATUS_NO_SHOW = "No show";
// Estatus terminales (ya no están en agenda activa).
export const ESTATUS_TERMINALES = new Set(["Asistió", "No show", "Cancelado"]);
// Estatus que siguen "vivos" en la agenda (cuentan para próximos).
export const ESTATUS_ACTIVOS = new Set(["Agendado", "Confirmado", "Reagendado"]);

// Dupla sugerida Liner → Presentador principal (de la hoja Catálogos del Excel).
// Solo pre-llena el form; el usuario puede sobreescribir siempre.
export const PAIRINGS = {
  "Gael Velasco":   "Oscar Gálvez",
  "Carlos Ayala":   "Ken Lugo",
  "Cecilia Mendoza": "Cecilia Mendoza",
  "Victor Benitez": "Oscar Gálvez",
};

// Apoyo sugerido por Liner (cuando la dupla del Excel traía un segundo closer).
export const PAIRINGS_APOYO = {
  "Cecilia Mendoza": "Daniel Pavon",
};

/** Devuelve el presentador principal sugerido para un liner (o ""). */
export function suggestPresentador(liner) {
  return PAIRINGS[liner] || "";
}

/** Devuelve el presentador de apoyo sugerido para un liner (o ""). */
export function suggestApoyo(liner) {
  return PAIRINGS_APOYO[liner] || "";
}

/** Color de un estatus, con fallback al gris neutro si no está catalogado. */
export function estatusColor(estatus) {
  return ESTATUS_COLORS[estatus] || "#64748B";
}
