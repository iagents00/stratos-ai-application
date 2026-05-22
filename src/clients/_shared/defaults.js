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

  // Dominios propios que resuelven a este cliente (white-label con su dominio).
  // El resolver (src/clients/index.js) los matchea por hostname EXACTO con
  // máxima prioridad. Útil para que un cliente viva en su dominio propio
  // (ej: app.tgenius.com) sin depender de heurísticas de subdominio ni de un
  // path /<cliente>. Default vacío → el cliente se resuelve por path/subdominio.
  domains: [],

  // Branding visual (overrides opcionales del design system)
  brand: {
    logoText:              "Stratos",
    accent:                null,   // null → usa el accent del design system
    accentLight:           null,
    favicon:               "/favicon.ico",
    // Etiqueta del pill del header (Dynamic Island). Cada cliente puede
    // personalizarla para que la app se sienta más suya. Default mantiene el
    // texto histórico → Duke no cambia.
    intelligenceCenterLabel: "Centro de Inteligencia",
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
    // Comando Directivo: dashboard ejecutivo con indicadores de equipo
    // (asignados, contactados, calificados, zooms, activos, seguimientos)
    // filtrable por Hoy / Semana / Mes. Default OFF — solo clientes que lo
    // necesiten explícitamente lo prenden. Visible para admin/director/ceo.
    comandoDirectivo: false,
  },

  // Contacto y soporte
  support: {
    email:    "soporte@stratoscapitalgroup.com",
    whatsapp: null,
  },

  // Configuración del CRM por cliente
  crm: {
    // Lista curada de proyectos preseteados que aparecen en el dropdown del
    // formulario "Nuevo cliente". Si está vacío (default), el CRM calcula la
    // lista a partir de los leads existentes (comportamiento histórico de Duke).
    // Si el cliente declara una lista, esa toma prioridad → útil para clientes
    // recién onboardeados que aún no tienen leads.
    defaultProjects: [],

    // Pestaña "Indicadores de Asesores" dentro del CRM. Muestra una tabla con
    // métricas por asesor (leads asignados, contactados, zooms, etc.) filtrable
    // por día/semana/mes. Visible solo para roles admin/director/super_admin/ceo.
    // Default OFF → Duke no la ve hasta que se prenda explícitamente.
    advisorMetricsTab: false,

    // Drawer "Discovery" simplificado — una sola sección scrolleable con
    // Próxima Acción arriba, notas y cronograma, sin la sección de Tareas.
    // Cuando está OFF, se mantiene el comportamiento histórico (Expediente
    // + Perfil + Análisis IA con sección de Tareas visible).
    discoverySimplified: false,

    // Sincronización realtime del tablero de prioridad (profiles.crm_prefs).
    // Cuando el bot de Telegram reordena/pinea un cliente, el CRM abierto en el
    // browser pisaba ese cambio al re-guardar su snapshot en memoria
    // (last-writer-wins, sin sync). Con esto ON, el CRM se suscribe a cambios
    // de su propia fila profiles y refleja en vivo lo que escribió el bot.
    // Default OFF → solo clientes que lo validen lo prenden.
    prefsRealtimeSync: false,
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
    crm:      { ...base.crm,      ...(clientConfig.crm      || {}) },
  };
}
