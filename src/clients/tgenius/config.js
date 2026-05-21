/**
 * src/clients/tgenius/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente TGENIUS.
 *
 * Zona propia del cliente Tgenius — se puede modificar libremente (el CODEOWNERS
 * la asigna a su carpeta). Todo lo demás del CRM se comparte con Duke (en
 * producción) y Grupo 28, y requiere review del owner.
 *
 * Activación (igual que Grupo 28):
 *   - localhost:5173/?app&client=tgenius   (dev / QA)
 *   - app.stratoscapitalgroup.com/tgenius  (prod, path-based)
 *   - tgenius.stratoscapitalgroup.com       (prod, subdomain — requiere DNS)
 *
 * Aislamiento: organization_id = UUID de Tgenius + RLS. Como NO es la org
 * Stratos, navigation.js lo trata como cliente externo (ve solo CRM, Perfil,
 * Papelera). Nada de lo que se haga acá afecta a Duke ni a Grupo 28.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const tgeniusConfig = {
  id:        "tgenius",
  name:      "Tgenius",
  legalName: "Tgenius",
  tagline:   "Gestión inmobiliaria inteligente — Tgenius",

  brand: {
    logoText:                "Tgenius",
    accent:                  "#6D28D9",   // violeta de marca (ajustable por Tgenius)
    accentLight:             "#A78BFA",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Tgenius",
  },

  tenant: {
    clientId:       "tgenius",
    // UUID de "Tgenius" en la tabla `organizations` del Supabase principal.
    organizationId: "c1d2e3f4-a5b6-47c8-9d0e-1f2a3b4c5d6e",
    // Comparte el mismo proyecto Supabase que Duke/Grupo28 — aislamiento por
    // organization_id + RLS, no por proyecto.
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // Features declaradas explícitamente (defensa en profundidad). El aislamiento
  // real lo enforza canAccessModule() en navigation.js: como Tgenius NO es la
  // org Stratos, solo ve CRM, Perfil y Papelera.
  features: {
    crm:          true,
    dash:         false,
    erp:          false,
    team:         false,
    iacrm:        false,
    landingPages: false,
    finanzas:     false,
    rrhh:         false,
    trash:        true,
    comandoDirectivo: true,
  },

  support: {
    email:    null,   // Pendiente: email de soporte de Tgenius
    whatsapp: null,
  },

  // Configuración del CRM específica de Tgenius.
  crm: {
    defaultProjects:     [],     // Tgenius calcula la lista desde sus leads
    advisorMetricsTab:   true,
    discoverySimplified: true,
  },
};

export default tgeniusConfig;
