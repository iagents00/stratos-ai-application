/**
 * src/clients/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolver del cliente activo según la URL.
 *
 * Punto de entrada único: main.jsx llama a resolveClientFromLocation() al boot
 * y pasa el resultado al ClientProvider.
 *
 * AGREGAR UN CLIENTE NUEVO:
 *   1. Crear src/clients/<id>/config.js (copiando grupo28/config.js como base).
 *   2. Importarlo aquí y agregarlo al map CLIENT_CONFIGS.
 *   3. Definir su match en matchClientFromLocation().
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { mergeClientConfig } from "./_shared/defaults";
import dukeConfig    from "./duke/config";
import grupo28Config from "./grupo28/config";

// Registry de todos los clientes conocidos
const CLIENT_CONFIGS = {
  duke:    dukeConfig,
  grupo28: grupo28Config,
};

/**
 * Detecta qué cliente debe cargar según hostname + path.
 *
 * Estrategia de matching (en orden de prioridad):
 *   1. Subdomain match  → grupo28.stratoscapitalgroup.com → "grupo28"
 *   2. Path prefix      → /grupo28, /grupo28/... → "grupo28"
 *   3. Query param      → ?client=grupo28 (útil en localhost)
 *   4. Default          → "duke" (cliente original)
 *
 * @param {Location} location - typically window.location
 * @returns {string} clientId
 */
export function matchClientFromLocation(location = window.location) {
  const hostname = location.hostname || "";
  const pathname = location.pathname || "";
  const params   = new URLSearchParams(location.search || "");

  // 1. Subdomain (fase 2 — cuando configuremos DNS)
  for (const id of Object.keys(CLIENT_CONFIGS)) {
    if (id === "duke") continue;  // duke es el default, no usa subdomain
    if (hostname.startsWith(`${id}.`)) return id;
  }

  // 2. Path prefix
  for (const id of Object.keys(CLIENT_CONFIGS)) {
    if (id === "duke") continue;
    if (pathname === `/${id}` || pathname.startsWith(`/${id}/`)) return id;
  }

  // 3. Query param (override útil para QA en localhost)
  const queryClient = params.get("client");
  if (queryClient && CLIENT_CONFIGS[queryClient]) return queryClient;

  // 4. Default
  return "duke";
}

/**
 * Resuelve la configuración del cliente, mergeada con los defaults.
 * @param {string} clientId
 * @returns {object} config completa (nunca null)
 */
export function getClientConfig(clientId) {
  const cfg = CLIENT_CONFIGS[clientId] || CLIENT_CONFIGS.duke;
  return mergeClientConfig(cfg);
}

/**
 * Atajo para main.jsx: detecta y devuelve config en una sola llamada.
 */
export function resolveClientFromLocation(location = window.location) {
  const clientId = matchClientFromLocation(location);
  return getClientConfig(clientId);
}

// Para debugging — expone los IDs registrados
export const REGISTERED_CLIENT_IDS = Object.keys(CLIENT_CONFIGS);
