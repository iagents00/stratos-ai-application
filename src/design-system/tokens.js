/**
 * design-system/tokens.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FUENTE ÚNICA DE VERDAD para colores, tipografías y espaciado de Stratos IA.
 *
 * USO:
 *   import { P, PL, font, fontDisp, mono } from "../design-system/tokens";
 *
 * REGLAS:
 *   - NUNCA hardcodear colores directamente en componentes.
 *   - Usar P para la plataforma app (fondo más oscuro, accent más vibrante).
 *   - Usar PL para la landing pública (ligeras variaciones intencionales).
 *   - Espaciado: múltiplos de 4px → 4, 8, 12, 16, 24, 32, 48, 64, 96.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── PALETA — PLATAFORMA (app.stratoscapitalgroup.com) ───────────────────────
export const P = {
  // Fondos
  bg:      "#030810",
  bg2:     "#07101E",
  bg3:     "#0C1628",
  surface: "#091225",

  // Vidrio (glassmorphism)
  glass:   "rgba(255,255,255,0.035)",
  glassH:  "rgba(255,255,255,0.055)",

  // Bordes
  border:  "rgba(255,255,255,0.07)",
  borderH: "rgba(255,255,255,0.12)",

  // Texto — blanco dominante, siempre legible sobre fondos oscuros
  txt:     "#E2E8F0",
  txt2:    "#8B99AE",
  txt3:    "#4A5568",

  // Accent — verde menta, usar con moderación
  accent:  "#6EE7C2",
  accentS: "rgba(110,231,194,0.08)",
  accentB: "rgba(110,231,194,0.14)",

  // Colores semánticos
  blue:    "#7EB8F0",
  violet:  "#A78BFA",
  amber:   "#FBBF24",
  rose:    "#E8818C",
  emerald: "#6DD4A8",
  cyan:    "#5DC8D9",
  orange:  "#F97316",

  // Border radius
  r:  16,   // tarjetas
  rs: 10,   // badges
  rx: 6,    // micro
};

// ─── PALETA — LANDING PÚBLICA (stratoscapitalgroup.com) ──────────────────────
// Ligeras variaciones intencionales: fondo un poco más oscuro, accent más suave
export const PL = {
  bg:      "#04080F",
  surface: "#080D17",

  glass:   "rgba(255,255,255,0.028)",
  glassH:  "rgba(255,255,255,0.048)",

  border:  "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.12)",

  txt:     "#EDF2F7",
  txt2:    "#8A97AA",
  txt3:    "#3D4A5C",
  w:       "#FFFFFF",

  accent:  "#52D9B8",       // Ligeramente más apagado que la app
  accentS: "rgba(82,217,184,0.07)",
  accentB: "rgba(82,217,184,0.13)",

  blue:    "#6BAED6",
  blueS:   "rgba(107,174,214,0.08)",
  violet:  "#9B8AF0",
  violetS: "rgba(155,138,240,0.08)",
  rose:    "#D97070",
  roseS:   "rgba(217,112,112,0.08)",

  r: 14,
};

// ─── PALETA — LIGHT MODE (modo blanco premium de la plataforma) ──────────────
export const LP = {
  bg: "#EDF3F0", bgSoft: "#F6FAF8", bgCool: "#EAF0EE",
  glass: "rgba(255,255,255,0.70)", glassH: "rgba(255,255,255,0.92)",
  glassStrong: "rgba(255,255,255,0.96)",
  glassMint: "rgba(236,251,246,0.75)",
  border: "rgba(15,23,42,0.08)", borderH: "rgba(15,23,42,0.16)",
  borderMint: "rgba(15,158,122,0.18)",
  surface: "#FFFFFF",
  accent: "#0D9A76", accentDark: "#067A5E",
  accentS: "rgba(13,154,118,0.08)", accentB: "rgba(13,154,118,0.28)",
  accentG: "linear-gradient(135deg, #0D9A76 0%, #14B892 50%, #34D4AA 100%)",
  blue: "#2563EB", violet: "#7C3AED", amber: "#D97706",
  rose: "#E11D48", emerald: "#059669", cyan: "#0891B2",
  txt: "#0B1220", txt2: "#3B4A61", txt3: "#7A8699",
  shadow1: "0 1px 2px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.04)",
  shadow2: "0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.07), 0 16px 40px rgba(15,23,42,0.04)",
  shadow3: "0 4px 12px rgba(15,23,42,0.08), 0 20px 56px rgba(15,23,42,0.10), 0 32px 80px rgba(15,23,42,0.06)",
  shadowMint: "0 2px 8px rgba(13,154,118,0.10), 0 8px 28px rgba(13,154,118,0.08)",
  r: 16, rs: 10, rx: 6,
};

// ─── TIPOGRAFÍAS ──────────────────────────────────────────────────────────────
export const font     = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
export const fontDisp = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
export const mono     = `"SF Mono", "Fira Code", "Cascadia Code", monospace`;

// ─── ESPACIADO ────────────────────────────────────────────────────────────────
export const spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  6:  24,
  8:  32,
  12: 48,
  16: 64,
  24: 96,
};

// ─── PIPELINE CRM ─────────────────────────────────────────────────────────────
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

export const STAGE_COLORS = {
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
