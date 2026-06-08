/**
 * src/clients/stratos-sales/config.js
 * Configuracion del cliente STRATOS SALES.
 *
 * Tenant interno operado por NSG (empresa paragua duenya de Stratos) para
 * VENDER Stratos AI a otras empresas. Distinto del producto Stratos en si:
 *   - Stratos AI         = el producto que se vende
 *   - Stratos Sales      = el equipo NSG que lo vende -> este tenant
 *   - NSG                = la empresa paragua que opera todo
 *
 * Activacion: la app carga esta config cuando la URL es:
 *   - localhost:5173/?app/stratos-sales         (dev)
 *   - app.stratoscapitalgroup.com/stratos-sales (prod, path-based)
 */

const stratosSalesConfig = {
  id:        "stratos-sales",
  name:      "Stratos Sales",
  legalName: "NSG - Stratos AI Sales",
  tagline:   "Venta consultiva de Stratos AI - Operado por NSG",

  brand: {
    logoText:                "Stratos Sales",
    accent:                  "#10B981",
    accentLight:             "#34D399",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia - Stratos Sales",
  },

  tenant: {
    clientId:       "stratos-sales",
    // UUID de "Stratos Sales" en la tabla `organizations` (creado en migracion 050, PR #160).
    organizationId: "b1145073-434c-4779-a243-d5e8f5ff3617",
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // Modulos minimos: solo CRM + Comando Directivo + Papelera.
  // Modulos internos del producto Stratos (ERP/RRHH/Finanzas/etc) NO aplican
  // porque aqui no se opera el producto, se vende.
  features: {
    crm:              true,
    dash:             false,
    erp:              false,
    team:             false,
    iacrm:            false,
    landingPages:     false,
    finanzas:         false,
    rrhh:             false,
    trash:            true,
    comandoDirectivo: true,
  },

  support: {
    email:    null,
    whatsapp: "+5219842803001",
    phoneLabel: "+52 1 984 280 3001",
  },

  crm: {
    // "Proyectos" = planes/SKUs de Stratos que se ofrecen al lead.
    defaultProjects: [
      "Stratos AI - Plan Enterprise",
      "Stratos AI - Plan Pro",
      "Stratos AI - Plan Starter",
      "Stratos AI - Asesoria sin costo",
    ],
    advisorMetricsTab: true,
    discoverySimplified: true,
  },
};

export default stratosSalesConfig;
