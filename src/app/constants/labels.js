/**
 * app/constants/labels.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Vocabulario visible del CRM, resuelto POR CLIENTE.
 *
 * Duke vende departamentos → sus registros son "clientes".
 * Vega presenta licitaciones de obra → los suyos son "proyectos".
 * Es el MISMO CRM: solo cambian las palabras que ve el usuario.
 *
 * Un cliente declara únicamente las claves que quiere cambiar en su config:
 *
 *   crm: {
 *     labels: { entity: "proyecto", entityCap: "Proyecto", ... }
 *   }
 *
 * Las claves no declaradas heredan DEFAULT_LABELS (vocabulario de Duke), así
 * que Duke nunca se ve afectado mientras `crm.labels` siga en null.
 *
 * ⚠️ Misma limitación de resolución al boot que constants/pipeline.js — leer
 * la nota de ahí antes de usar esto en la app nativa con un tenant que no sea
 * Duke.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { resolveClientFromLocation } from "../../clients";

/** Vocabulario histórico de Duke del Caribe. Es el fallback de todos. */
export const DEFAULT_LABELS = {
  entity:                "cliente",
  entityCap:             "Cliente",
  entityPlural:          "clientes",
  newEntity:             "Nuevo cliente",
  priorityList:          "Clientes en prioridad",
  emptyList:             "Sin clientes",
  entityNamePlaceholder: "Nombre del cliente",
  entityProfile:         "Perfil del cliente",
  deleteEntity:          "Eliminar cliente (mover a papelera)",
  viewDetail:            "Ver detalle del cliente",
  openProfile:           "Abrir perfil del cliente",
};

const clientLabels = resolveClientFromLocation(window.location)?.crm?.labels;

/** Vocabulario activo. Import corto porque aparece mucho en JSX: {L.entityCap} */
export const L = { ...DEFAULT_LABELS, ...(clientLabels || {}) };
