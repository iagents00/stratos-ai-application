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
import tgeniusConfig from "./tgenius/config";
import stratosSalesConfig from "./stratos-sales/config";

// Registry de todos los clientes conocidos
const CLIENT_CONFIGS = {
  duke:            dukeConfig,
  grupo28:         grupo28Config,
  tgenius:         tgeniusConfig,
  "stratos-sales": stratosSalesConfig,
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
  const hostname = (location.hostname || "").toLowerCase();
  const pathname = location.pathname || "";
  const params   = new URLSearchParams(location.search || "");

  // 0. Dominio propio declarado (white-label con su propio dominio).
  //    Máxima prioridad: si un cliente lista este hostname EXACTO en su config
  //    (campo `domains`), gana. Esto hace que app.tgenius.com / tgenius.com
  //    resuelvan a "tgenius" en cuanto se apunte el DNS, sin depender de la
  //    heurística de subdominio (que no cubre app.* ni www.*).
  for (const [id, cfg] of Object.entries(CLIENT_CONFIGS)) {
    const domains = cfg.domains;
    if (Array.isArray(domains) && domains.some(d => String(d).toLowerCase() === hostname)) {
      return id;
    }
  }

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
  if (queryClient) {
    if (CLIENT_CONFIGS[queryClient]) return queryClient;
    // Query param presente pero inválido — avisar al QA para que detecte
    // typos rápido (?client=grupo3 cuando quiso ?client=grupo28).
    if (typeof console !== "undefined") {
      console.warn(
        `[Stratos] ?client="${queryClient}" no existe en el registry. ` +
        `Clientes válidos: ${Object.keys(CLIENT_CONFIGS).join(", ")}. ` +
        `Fallback a "duke".`
      );
    }
  }

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

// ─── Mapeo bidireccional clientId ↔ organizationId (Supabase) ────────────────
// Construido al boot a partir de los configs. Permite preguntarle al sistema
// "¿qué cliente corresponde a esta organizationId?" después de un login.
const ORG_ID_TO_CLIENT_ID = Object.fromEntries(
  Object.entries(CLIENT_CONFIGS)
    .map(([id, cfg]) => [cfg.tenant?.organizationId, id])
    .filter(([orgId]) => orgId) // descartar clientes sin org asociada
);

/**
 * Devuelve el clientId asociado a una organizationId de Supabase.
 * Si no se conoce la org → null (caso típico: nuevo cliente sin config aún).
 *
 * @param {string} organizationId - UUID de la org en la tabla `organizations`
 * @returns {string|null} clientId conocido, o null si no hay match
 */
export function getClientIdByOrgId(organizationId) {
  if (!organizationId) return null;
  return ORG_ID_TO_CLIENT_ID[organizationId] || null;
}

/**
 * Devuelve la organizationId de Supabase asociada a un clientId conocido.
 * @param {string} clientId
 * @returns {string|null}
 */
export function getOrgIdByClientId(clientId) {
  const cfg = CLIENT_CONFIGS[clientId];
  return cfg?.tenant?.organizationId || null;
}

/**
 * Decide si hay que redirigir al user a otro cliente según su organización.
 *
 * Reglas:
 *   - Si el clientId actual matchea el clientId de la org del user → no redirige.
 *   - Si la org del user mapea a un clientId distinto del actual → redirige
 *     al path correcto (preserva query y hash).
 *   - Si la org del user no está en el registry (cliente desconocido) → no
 *     redirige (fallback al comportamiento actual).
 *
 * @param {object} user - { organizationId: string, ... }
 * @param {string} currentClientId - resultado de matchClientFromLocation()
 * @param {Location} location - window.location
 * @returns {string|null} URL absoluta a la que redirigir, o null si no redirige
 */
export function resolveRedirectForUser(user, currentClientId, location = window.location) {
  if (!user?.organizationId) return null;
  const targetClientId = getClientIdByOrgId(user.organizationId);
  if (!targetClientId) return null;
  if (targetClientId === currentClientId) return null;

  // Construir el path correcto:
  //   - Si destino es "duke" (default), removemos cualquier /<cliente> del path.
  //   - Si destino es otro cliente, le ponemos /<clienteId> como prefijo.
  const origin = location.origin || "";
  const search = location.search || "";
  const hash   = location.hash   || "";

  // Strippeo del prefijo del cliente actual si lo había
  let basePath = location.pathname || "/";
  for (const id of REGISTERED_CLIENT_IDS) {
    if (id === "duke") continue;
    if (basePath === `/${id}` || basePath.startsWith(`/${id}/`)) {
      basePath = basePath.slice(`/${id}`.length) || "/";
      break;
    }
  }

  const targetPath = targetClientId === "duke"
    ? basePath
    : `/${targetClientId}${basePath === "/" ? "" : basePath}`;

  return `${origin}${targetPath}${search}${hash}`;
}
