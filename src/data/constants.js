/**
 * constants.js — Design System & CRM Constants
 *
 * Fuente única de verdad para:
 *   - Paleta de colores (P)
 *   - Tipografías (font, fontDisp)
 *   - Etapas del pipeline CRM (STAGES, stgC)
 *
 * TODO: Mover P y fonts a un archivo de tema separado si el sistema crece.
 */

// ─── PALETA DE COLORES ────────────────────────────────────────────────────────

export const P = {
  bg:      "#060A11",
  bg2:     "#0B1018",
  bg3:     "#111827",
  border:  "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  txt:     "#E2E8F0",
  txt2:    "#94A3B8",
  txt3:    "#64748B",
  accent:  "#6EE7C2",
  blue:    "#60A5FA",
  violet:  "#A78BFA",
  amber:   "#FBBF24",
  rose:    "#FB7185",
  emerald: "#34D399",
  cyan:    "#22D3EE",
  orange:  "#F97316",
};

// ─── TIPOGRAFÍAS ──────────────────────────────────────────────────────────────

export const font     = "SF Pro Text, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
export const fontDisp = "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

// ─── PIPELINE CRM ─────────────────────────────────────────────────────────────

/**
 * Etapas del pipeline de ventas — en orden de avance.
 * Estas etapas deben mantenerse sincronizadas con los valores `st` en leads.js.
 */
export const STAGES = [
  "Nuevo Registro",
  "Primer Contacto",
  "Seguimiento",
  "Zoom Agendado",
  "Zoom Concretado",
  "Visita Agendada",
  "Visita Concretada",
  "Negociación",
  "Cierre",
  "Perdido",
];

/**
 * Color asociado a cada etapa del pipeline.
 * Úsalo para badges, indicadores y etiquetas.
 */
export const stgC = {
  "Nuevo Registro":    P.txt3,
  "Primer Contacto":   P.blue,
  "Seguimiento":       P.amber,
  "Zoom Agendado":     P.violet,
  "Zoom Concretado":   "#C084FC",
  "Visita Agendada":   P.cyan,
  "Visita Concretada": P.emerald,
  "Negociación":       P.orange,
  "Cierre":            P.accent,
  "Perdido":           P.rose,
};
