/**
 * app/constants/crm.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Constantes del CRM: colores de etapas, fuentes, asesores.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * stgC — Colores por etapa del pipeline CRM.
 * Versión de App.jsx (colores más vivos para el Dashboard).
 * CRM.jsx usa la versión de app/data/leads.js.
 */
export const stgC = {
  "Nuevo Registro":     "#94A3B8",
  "Primer Contacto":    "#38BDF8",
  "Seguimiento":        "#22D3EE",
  "Zoom Agendado":      "#60A5FA",
  "Zoom Concretado":    "#4ADE80",
  "Visita Agendada":    "#F59E0B",
  "Visita Concretada":  "#6EE7C2",
  "Negociación":        "#FB923C",
  "Cierre":             "#34D399",
  "Perdido":            "#F87171",
};

export const SRC_META = {
  Facebook:    { color: "#4267B2", label: "Facebook Ads" },
  Instagram:   { color: "#C13584", label: "Instagram" },
  Referido:    { color: "#10B981", label: "Referido" },
  WhatsApp:    { color: "#25D366", label: "WhatsApp" },
  Google:      { color: "#EA4335", label: "Google Ads" },
  Cancún:      { color: "#F59E0B", label: "Cancún" },
  Orgánico:    { color: "#6EE7C2", label: "Orgánico" },
  Evento:      { color: "#8B5CF6", label: "Evento" },
};
