import { createDemoLeads } from "./demo-leads.js";
import { P } from "../../design-system/tokens";

// Pipeline oficial Duke del Caribe (Mayo 2026) — ver design-system/tokens.js
// para la fuente única de verdad. Esta copia local existe por compatibilidad
// con módulos que la importaban directamente; ambos arreglos están sincronizados.
export const STAGES = [
  "Contáctame Ya", "Segundo Intento", "Tercer Intento", "Rotación",
  "Remarketing IA", "Zoom Agendado", "Reactivar Zoom", "Zoom Concretado",
  "Seguimiento", "Largo Plazo", "Apartó", "Visita Agendada", "Cierre", "Postventa",
];

export const stgC = {
  "Contáctame Ya":    P.txt3,
  "Segundo Intento":  P.blue,
  "Tercer Intento":   "#7EB8F0",
  "Rotación":         "#A8A29E",
  "Remarketing IA":   "#FB923C",
  "Zoom Agendado":    "#3B82F6",
  "Reactivar Zoom":   "#EA580C",
  "Zoom Concretado":  "#2DD4BF",
  "Seguimiento":      "#FBBF24",
  "Largo Plazo":      "#818CF8",
  "Apartó":           "#4ADE80",
  "Visita Agendada":  P.cyan,
  "Cierre":           P.accent,
  "Postventa":        "#64748B",
};

// Only synthetic records may be bundled as CRM demo examples.
export const leads = createDemoLeads();
