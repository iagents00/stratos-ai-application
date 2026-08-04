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

// ── VARIOS TABLEROS PARA UN MISMO CLIENTE ──────────────────────────────────
// Una clínica no tiene un solo recorrido: tiene el de CONSEGUIR Y ATENDER al
// paciente (del primer mensaje hasta que viene a la consulta) y el de TRATARLO
// (del diagnóstico hasta el control). Son 19 etapas en total — ponerlas en un
// solo tablero lo vuelve ilegible, y separarlas en dos hace que cualquiera del
// equipo vea de un golpe dónde está cada persona.
//
// Por eso un cliente puede declarar `crm.pipelines`:
//   [{ id, label, stages: [{name, color}] }, ...]
// Las etapas de TODOS los grupos siguen viviendo en el mismo campo del
// paciente, así que los desplegables, los filtros y los colores no cambian:
// `STAGES` sigue siendo la lista completa y en orden. Lo único nuevo es que el
// tablero sabe qué trozo mostrar.
//
// Quien no declare `crm.pipelines` (Duke, NSG, Vega, Grupo 28, TGenius) queda
// exactamente como está: un único grupo con todo, y el selector ni aparece.
const _groups = Array.isArray(_cfg?.crm?.pipelines) && _cfg.crm.pipelines.length
  ? _cfg.crm.pipelines.filter(g => Array.isArray(g?.stages) && g.stages.length)
  : null;

const _custom = _groups
  ? _groups.flatMap(g => g.stages)
  : (Array.isArray(_cfg?.crm?.pipeline) && _cfg.crm.pipeline.length ? _cfg.crm.pipeline : null);

/** Etapas del pipeline activo, en orden (izq → der en el kanban). */
export const STAGES = _custom ? _custom.map(s => s.name) : DUKE_STAGES;

/**
 * Tableros del cliente: `[{ id, label, stages:[nombre] }]`.
 * Siempre tiene al menos uno — quien no declare `crm.pipelines` recibe un único
 * grupo con todas sus etapas, que es como se comportaba el CRM hasta ahora.
 */
export const PIPELINE_GROUPS = _groups
  ? _groups.map(g => ({
      id:     g.id,
      label:  g.label || g.id,
      hint:   g.hint || null,
      stages: g.stages.map(s => s.name),
    }))
  : [{ id: "todo", label: "Pipeline", hint: null, stages: STAGES }];

/** true si el cliente reparte sus etapas en más de un tablero. */
export const HAS_PIPELINE_GROUPS = !!_groups && _groups.length > 1;

/** Mapa etapa → color. Para clientes custom se arma desde su config; Duke usa el histórico. */
export const stgC = _custom
  ? Object.fromEntries(_custom.map(s => [s.name, s.color]))
  : DUKE_STGC;

/** Etapa donde caen los registros nuevos (primera del pipeline). */
export const DEFAULT_STAGE = STAGES[0];

/** true si el cliente activo usa un pipeline custom (útil para apagar lógica Duke-específica). */
export const IS_CUSTOM_PIPELINE = !!_custom;
