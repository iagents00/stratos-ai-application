/**
 * src/clients/legacy-design/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant LEGACY DESIGN (corporativo Duke — arquitectura y
 * desarrollo inmobiliario: diseño y construcción de casas).
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG). Sus funciones NO son las de ventas de Duke.
 *   - El registro que se mueve es una CASA (cada fila de la hoja de Shadai).
 *   - El pipeline es espejo EXACTO de `org_stages` en la base, derivado de los
 *     procesos reales de su hoja de control de proyectos (11 casas).
 *
 * Activación: app.stratoscapitalgroup.com/legacy-design (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const legacyDesignConfig = {
  id:        "legacy-design",
  name:      "Legacy Design",
  legalName: "Legacy Design",
  tagline:   "Arquitectura y desarrollo — cada casa, a la vista",

  brand: {
    logoText:                "Legacy Design",
    accent:                  "#0EA5E9",   // azul plano/proyecto
    accentLight:             "#38BDF8",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Legacy Design",
  },

  tenant: {
    clientId:       "legacy-design",
    organizationId: "281caa01-7414-4eef-b3b6-afa1e7623ab3",
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  features: {
    crm:          true,    // El pipeline de CASAS/proyectos
    dash:         false,
    erp:          false,
    team:         false,
    iacrm:        false,
    landingPages: false,
    finanzas:     false,
    rrhh:         false,
    trash:        true,
    comandoDirectivo: false,
  },

  support: { email: null, whatsapp: null, phoneLabel: null },

  crm: {
    // ⚠️ ESPEJO de org_stages (base). Sustituye el «¿cuándo se entrega Casa
    // Ágata?» por abrir y mirar. El Modelo de NEGOCIO del cliente (Venta ·
    // Retiro · Renta vacacional), el arquitecto y el link a Drive van como
    // campos del expediente, no como etapas.
    pipeline: [
      // «Terreno y contrato» nació de cargar las 11 casas REALES de la hoja de
      // Shadai: 5 estaban ANTES del diseño (selección de terreno, cierre de
      // compra, contrato con el arquitecto). La hoja manda, no el catálogo.
      { name: "Terreno y contrato",          color: "#A8A29E" },
      { name: "Diseño y proyecto ejecutivo", color: "#94A3B8" },
      { name: "Licencias y permisos",        color: "#38BDF8" },
      { name: "Cimientos",                   color: "#FBBF24" },
      { name: "Obra gris",                   color: "#FB923C" },
      { name: "Acabados",                    color: "#A78BFA" },
      { name: "Entrega",                     color: "#34D399" },
      { name: "Postventa",                   color: "#64748B" },
    ],
    defaultProjects: [],
    advisorMetricsTab: false,
    discoverySimplified: true,
  },

  labels: {
    entity:                "casa",
    entityCap:             "Casa",
    entityPlural:          "casas",
    newEntity:             "Nueva casa",
    priorityList:          "Casas en prioridad",
    emptyList:             "Sin casas",
    entityNamePlaceholder: "Nombre del proyecto (ej. Casa Ágata)",
    entityProfile:         "Expediente de la casa",
    deleteEntity:          "Quitar casa (mover a papelera)",
    viewDetail:            "Ver expediente de la casa",
    openProfile:           "Abrir expediente de la casa",
    pageTitle:             "Proyectos",
    pageTitleMobile:       "Proyectos",
  },
};

export default legacyDesignConfig;
