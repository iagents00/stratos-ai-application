/**
 * src/clients/_shared/defaults.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Config base que TODOS los clientes heredan.
 *
 * Cada cliente en src/clients/<id>/config.js puede sobreescribir cualquier
 * campo de aquí. Si no lo sobreescribe, hereda el valor por defecto.
 *
 * REGLA: agregar campos nuevos aquí PRIMERO, con su valor por defecto.
 *        Así garantizamos que ningún cliente se rompe porque le falte un campo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_CLIENT_CONFIG = {
  // Identidad
  id:        "default",
  name:      "Stratos AI",
  legalName: "Stratos Capital Group",
  tagline:   "Plataforma inteligente de gestión inmobiliaria",

  // Branding visual (overrides opcionales del design system)
  brand: {
    logoText:    "Stratos",
    accent:      null,   // null → usa el accent del design system
    accentLight: null,
    favicon:     "/favicon.ico",
  },

  // Multi-tenancy en Supabase
  // - organizationId: UUID de la organización en la tabla `organizations`.
  //   Es el LINK entre nuestro sistema de URL (clientId) y el sistema de permisos
  //   por organización (PR #93). Si un user loguea y su organizationId no matchea
  //   con el del clientId actual, lo redirigimos al cliente correcto.
  // - clientId: identificador interno (duke, grupo28...) usado en la URL.
  // - supabaseRef: si el cliente usa SU PROPIO proyecto Supabase, se setea acá.
  //   Mientras tanto, todos comparten el proyecto principal y se aíslan por
  //   organizationId + RLS.
  tenant: {
    clientId:        "default",
    organizationId:  null,   // null → no hay org asociada (fallback genérico)
    supabaseRef:     null,
  },

  // Features habilitadas — cada módulo del CRM puede prenderse/apagarse
  // por cliente. Si no aparece aquí, asumimos true (compat retroactiva).
  features: {
    crm:           true,
    dash:          true,
    erp:           true,
    team:          true,
    iacrm:         true,
    landingPages:  true,
    finanzas:      true,
    rrhh:          true,
    trash:         true,
  },

  // Contacto y soporte
  support: {
    email:    "soporte@stratoscapitalgroup.com",
    whatsapp: null,
  },
};

/**
 * Helper: merge profundo de la config del cliente sobre los defaults.
 * Solo dos niveles (suficiente para nuestra shape). No usa lodash.
 */
export function mergeClientConfig(clientConfig) {
  const base = DEFAULT_CLIENT_CONFIG;
  if (!clientConfig) return base;
  return {
    ...base,
    ...clientConfig,
    brand:    { ...base.brand,    ...(clientConfig.brand    || {}) },
    tenant:   { ...base.tenant,   ...(clientConfig.tenant   || {}) },
    features: { ...base.features, ...(clientConfig.features || {}) },
    support:  { ...base.support,  ...(clientConfig.support  || {}) },
  };
}
