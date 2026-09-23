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
function resolverPipeline(cfg) {
  const groups = Array.isArray(cfg?.crm?.pipelines) && cfg.crm.pipelines.length
    ? cfg.crm.pipelines.filter(g => Array.isArray(g?.stages) && g.stages.length)
    : null;

  const custom = groups
    ? groups.flatMap(g => g.stages)
    : (Array.isArray(cfg?.crm?.pipeline) && cfg.crm.pipeline.length ? cfg.crm.pipeline : null);

  const stages = custom ? custom.map(s => s.name) : [...DUKE_STAGES];
  const pipelineGroups = groups
    ? groups.map(g => ({
        id:     g.id,
        label:  g.label || g.id,
        hint:   g.hint || null,
        kpis:   Array.isArray(g.kpis) && g.kpis.length ? g.kpis : null,
        labels: g.labels && typeof g.labels === "object" ? g.labels : null,
        stages: g.stages.map(s => s.name),
      }))
    : [{ id: "todo", label: "Pipeline", hint: null, stages }];

  return {
    stages,
    pipelineGroups,
    hasGroups: !!groups && groups.length > 1,
    colors: custom
      ? Object.fromEntries(custom.map(s => [s.name, s.color]))
      : { ...DUKE_STGC },
    defaultStage: stages[0],
    isCustom: !!custom,
  };
}

const inicial = resolverPipeline(_cfg);

/** Etapas del pipeline activo, en orden (izq → der en el kanban). */
export const STAGES = [...inicial.stages];

/**
 * Tableros del cliente: `[{ id, label, stages:[nombre] }]`.
 * Siempre tiene al menos uno — quien no declare `crm.pipelines` recibe un único
 * grupo con todas sus etapas, que es como se comportaba el CRM hasta ahora.
 */
export const PIPELINE_GROUPS = inicial.pipelineGroups.map(g => ({ ...g, stages: [...g.stages] }));

/** true si el cliente reparte sus etapas en más de un tablero. */
export let HAS_PIPELINE_GROUPS = inicial.hasGroups;

/** Mapa etapa → color. Para clientes custom se arma desde su config; Duke usa el histórico. */
export const stgC = { ...inicial.colors };

/** Etapa donde caen los registros nuevos (primera del pipeline). */
export let DEFAULT_STAGE = inicial.defaultStage;

/** true si el cliente activo usa un pipeline custom (útil para apagar lógica Duke-específica). */
export let IS_CUSTOM_PIPELINE = inicial.isCustom;

/**
 * Aplica en caliente la configuración guardada en organizations.meta_config.
 *
 * Los tenants creados desde la consola comparten la ruta `/tenant`, por lo que
 * su pipeline no puede quedar compilado en un archivo por empresa. App.jsx lee
 * la configuración de la organización autenticada y llama esta función. Las
 * colecciones se mutan conservando su referencia para que los imports ya
 * cargados (CRM, tarjetas y selectores) vean la versión nueva en el siguiente
 * render, sin recargar ni mezclar empresas.
 */
export function applyPipelineConfig(cfg) {
  const next = resolverPipeline(cfg);
  STAGES.splice(0, STAGES.length, ...next.stages);
  PIPELINE_GROUPS.splice(
    0,
    PIPELINE_GROUPS.length,
    ...next.pipelineGroups.map(g => ({ ...g, stages: [...g.stages] })),
  );
  for (const key of Object.keys(stgC)) delete stgC[key];
  Object.assign(stgC, next.colors);
  HAS_PIPELINE_GROUPS = next.hasGroups;
  DEFAULT_STAGE = next.defaultStage;
  IS_CUSTOM_PIPELINE = next.isCustom;
  return next;
}
