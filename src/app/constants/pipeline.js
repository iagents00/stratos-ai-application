/**
 * app/constants/pipeline.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline del CRM resuelto POR CLIENTE.
 *
 * Duke del Caribe usa el pipeline histórico de 13 etapas ("Contáctame Ya" …
 * "Postventa"). Un cliente puede declarar el suyo en su config:
 *
 *   crm: {
 *     pipeline: [ { name: "Detectada", color: "#94A3B8" }, ... ]
 *   }
 *
 * Si `crm.pipeline` es null (default) se hereda el de Duke intacto — por eso
 * Duke nunca se ve afectado por este archivo.
 *
 * CONTRATO CON n8n: `name` es el string EXACTO que se guarda en `leads.stage`.
 * Los workflows de n8n tienen que escribir ese mismo string o el registro no
 * cae en ninguna columna del kanban.
 *
 * ⚠️ RESOLUCIÓN AL BOOT (no reactiva)
 * Se resuelve una vez al cargar el módulo, desde la URL. Esto alcanza en web,
 * donde el tenant lo fija el path/subdominio antes de montar React. En NATIVO
 * (iOS) el tenant se aplica después del login (ver ClientOrgGuard), así que
 * aquí siempre se obtiene el pipeline de Duke. Hoy no es un problema porque la
 * app nativa arranca solo con Duke; si algún día Vega o Grupo 28 necesitan
 * pipeline propio en iOS, esto tiene que pasar a un hook que lea useClient().
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { resolveClientFromLocation } from "../../clients";
import { STAGES as DUKE_STAGES, stgC as DUKE_STAGE_COLORS } from "../data/leads";

const clientPipeline = resolveClientFromLocation(window.location)?.crm?.pipeline;
const hasCustom = Array.isArray(clientPipeline) && clientPipeline.length > 0;

/** Nombres de las etapas, en orden de izquierda a derecha en el kanban. */
export const STAGES = hasCustom
  ? clientPipeline.map(s => s.name)
  : DUKE_STAGES;

/** Mapa nombre-de-etapa → color hex. */
export const stgC = hasCustom
  ? Object.fromEntries(clientPipeline.map(s => [s.name, s.color]))
  : DUKE_STAGE_COLORS;

/** Etapa donde caen los registros nuevos (primera columna). */
export const DEFAULT_STAGE = STAGES[0];

/** true si el cliente activo corrió su propio pipeline (útil para debugging). */
export const HAS_CUSTOM_PIPELINE = hasCustom;
