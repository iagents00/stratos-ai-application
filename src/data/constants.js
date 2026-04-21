/**
 * data/constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-exporta STAGES y STAGE_COLORS desde el design system.
 *
 * NOTA: La paleta de colores (P) ya NO se define aquí.
 *       Fuente única de verdad → src/design-system/tokens.js
 *
 * Para componentes que necesiten colores del pipeline:
 *   import { STAGES, STAGE_COLORS } from "../data/constants";
 *   import { P } from "../design-system/tokens";
 * ─────────────────────────────────────────────────────────────────────────────
 */
export { STAGES, STAGE_COLORS, P, font, fontDisp } from "../design-system/tokens";

// Alias de compatibilidad — mantiene código existente funcionando sin cambios
export { STAGE_COLORS as stgC } from "../design-system/tokens";
