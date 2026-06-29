/**
 * app/constants/pipeline.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FUENTE ÚNICA del pipeline activo (etapas + colores) según el cliente.
 *
 * Por qué existe: las etapas (`STAGES`) y sus colores (`stgC`) eran constantes
 * de módulo importadas en todo el CRM. Para soportar un pipeline distinto por
 * cliente (ej. Constructora Vega = Obras/Licitaciones) sin propagar props por
 * decenas de call-sites, las resolvemos UNA vez al cargar el módulo, leyendo el
 * cliente activo de la URL — la MISMA fuente de verdad que usa main.jsx para el
 * ClientProvider (`resolveClientFromLocation`). El cliente es fijo durante toda
 * la sesión de la página, así que esta resolución es consistente en todos lados.
 *
 * GARANTÍA PARA DUKE (y cualquier cliente sin pipeline custom):
 *   Si el cliente activo NO declara `crm.pipeline`, se re-exportan EXACTAMENTE
 *   las constantes históricas (STAGES de tokens + stgC de constants/crm). El
 *   comportamiento de Stratos/Duke queda byte-idéntico. El override solo aplica
 *   al cliente que lo declara en su config.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { resolveClientFromLocation } from "../../clients";
import { STAGES as DUKE_STAGES } from "../../design-system/tokens";
import { stgC as DUKE_STGC } from "./crm";

// Resolución defensiva: si algo falla al leer la URL, caemos al pipeline de Duke.
const _cfg = (() => {
  try { return resolveClientFromLocation(); }
  catch { return null; }
})();

const _custom = Array.isArray(_cfg?.crm?.pipeline) && _cfg.crm.pipeline.length
  ? _cfg.crm.pipeline
  : null;

/** Etapas del pipeline activo, en orden (izq → der en el kanban). */
export const STAGES = _custom ? _custom.map(s => s.name) : DUKE_STAGES;

/** Mapa etapa → color. Para clientes custom se arma desde su config; Duke usa el histórico. */
export const stgC = _custom
  ? Object.fromEntries(_custom.map(s => [s.name, s.color]))
  : DUKE_STGC;

/** Etapa donde caen los registros nuevos (primera del pipeline). */
export const DEFAULT_STAGE = STAGES[0];

/** true si el cliente activo usa un pipeline custom (útil para apagar lógica Duke-específica). */
export const IS_CUSTOM_PIPELINE = !!_custom;
