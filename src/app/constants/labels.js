/**
 * app/constants/labels.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Diccionario de ETIQUETAS del CRM, resuelto por cliente.
 *
 * Permite adaptar el vocabulario del CRM por cliente sin propagar props: igual
 * que pipeline.js, resolvemos el cliente activo UNA vez al cargar el módulo
 * (misma fuente que main.jsx → ClientProvider). El cliente es fijo durante toda
 * la sesión, así que `L` es consistente en todos los componentes que lo importan.
 *
 * GARANTÍA PARA DUKE (y cualquier cliente sin `crm.labels`):
 *   Si el cliente activo no declara overrides, `L` = DEFAULT_LABELS (el
 *   vocabulario histórico de Stratos/Duke). Byte-idéntico. El override solo
 *   aplica al cliente que lo declara (ej. Constructora Vega → "proyecto").
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { resolveClientFromLocation } from "../../clients";

// Vocabulario histórico de Duke (ventas inmobiliarias). NO cambiar: es el default.
const DEFAULT_LABELS = {
  entity:                "cliente",                          // singular minúscula
  entityCap:             "Cliente",                          // singular capitalizada
  entityPlural:          "clientes",                         // plural minúscula
  newEntity:             "Nuevo cliente",                    // botón de alta
  priorityList:          "Clientes en prioridad",            // sección de foco
  emptyList:             "Sin clientes",                     // estado vacío
  entityNamePlaceholder: "Nombre del cliente",               // placeholder del nombre
  entityProfile:         "Perfil del cliente",               // encabezado del drawer
  deleteEntity:          "Eliminar cliente (mover a papelera)",
  viewDetail:            "Ver Discovery del cliente",        // tooltip abrir drawer
  openProfile:           "Abrir perfil del cliente",         // tooltip abrir perfil
};

const _cfg = (() => {
  try { return resolveClientFromLocation(); }
  catch { return null; }
})();

/** Etiquetas activas: defaults de Duke + overrides del cliente (si los declara). */
export const L = { ...DEFAULT_LABELS, ...(_cfg?.crm?.labels || {}) };
