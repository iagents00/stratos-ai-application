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
  "Contáctame ya":      "#94A3B8",
  "Segundo Intento":    "#38BDF8",
  "Remarketing":        "#FB923C",
  "Seguimiento":        "#FBBF24",
  "Zoom Agendado":      "#3B82F6",
  "No Show":            "#EA580C",
  "Zoom Concretado":    "#4ADE80",
  "Visita Agendada":    "#06B6D4",
  "Visita Concretada":  "#6EE7C2",
  "Negociación":        "#FB923C",
  "Cierre":             "#34D399",
  "Rotación":           "#A8A29E",
  "Postventa":          "#64748B",
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
