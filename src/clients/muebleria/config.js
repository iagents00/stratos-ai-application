/**
 * src/clients/muebleria/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant MUEBLERÍA (corporativo Duke — fábrica de muebles).
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG). Nada de las funciones de ventas de Duke.
 *   - El pipeline usa SUS palabras (corte, armado, laca, entrega) y es espejo
 *     EXACTO de `org_stages` en la base — si cambia uno, cambia el otro.
 *   - Gente que no vive frente a una computadora: la entrada natural es la voz
 *     y una foto. El sistema les habla claro y coloquial, sin tecnicismos.
 *
 * Activación: app.stratoscapitalgroup.com/muebleria (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const muebleriaConfig = {
  id:        "muebleria",
  name:      "Mueblería",
  legalName: "Mueblería",
  tagline:   "Muebles a medida — del taller a tu casa",

  brand: {
    logoText:                "Mueblería",
    accent:                  "#D97706",   // ámbar madera
    accentLight:             "#F59E0B",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Mueblería",
  },

  tenant: {
    clientId:       "muebleria",
    // UUID de "Mueblería" en `organizations` (stratos-prod). El aislamiento es
    // por organization_id + RLS, no por proyecto.
    organizationId: "e583eb98-ff00-4920-a69c-db39f3841b31",
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // Declaradas EXPLÍCITAMENTE (defensa en profundidad, patrón grupo28):
  // lo que no usa esta empresa queda apagado — un menú con módulos vacíos es
  // peor que un menú corto.
  features: {
    crm:          true,    // El pipeline de PEDIDOS (sus etapas, no las de Duke)
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
    // ⚠️ ESPEJO de org_stages (base). El registro que se mueve es un PEDIDO.
    // «Anticipo recibido» es la etapa que manda: sin anticipo no se corta madera.
    pipeline: [
      { name: "Cotización",         color: "#94A3B8" },
      { name: "Anticipo recibido",  color: "#4ADE80" },
      { name: "Corte",              color: "#38BDF8" },
      { name: "Armado",             color: "#FBBF24" },
      { name: "Laca",               color: "#A78BFA" },
      { name: "Entrega",            color: "#34D399" },
      { name: "Ajustes y garantía", color: "#64748B" },
    ],
    defaultProjects: [],
    advisorMetricsTab: false,
    discoverySimplified: true,
  },

  // El vocabulario del taller, no el de un CRM.
  labels: {
    entity:                "pedido",
    entityCap:             "Pedido",
    entityPlural:          "pedidos",
    newEntity:             "Nuevo pedido",
    priorityList:          "Pedidos en prioridad",
    emptyList:             "Sin pedidos",
    entityNamePlaceholder: "Cliente o mueble (ej. Comedor Familia López)",
    entityProfile:         "Detalle del pedido",
    deleteEntity:          "Quitar pedido (mover a papelera)",
    viewDetail:            "Ver detalle del pedido",
    openProfile:           "Abrir detalle del pedido",
    pageTitle:             "Pedidos",
    pageTitleMobile:       "Pedidos",
  },
};

export default muebleriaConfig;
