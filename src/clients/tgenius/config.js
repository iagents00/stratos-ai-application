/**
 * src/clients/tgenius/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente TGENIUS.
 *
 * Zona propia del cliente TGenius — se puede modificar libremente (el CODEOWNERS
 * la asigna a su carpeta). Todo lo demás del CRM se comparte con Duke (en
 * producción) y Grupo 28, y requiere review del owner.
 *
 * Activación (igual que Grupo 28):
 *   - localhost:5173/?app&client=tgenius   (dev / QA)
 *   - app.stratoscapitalgroup.com/tgenius  (prod, path-based)
 *   - tgenius.stratoscapitalgroup.com       (prod, subdomain — requiere DNS)
 *
 * Aislamiento: organization_id = UUID de TGenius + RLS. Como NO es la org
 * Stratos, navigation.js lo trata como cliente externo (ve solo CRM, Perfil,
 * Papelera). Nada de lo que se haga acá afecta a Duke ni a Grupo 28.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const tgeniusConfig = {
  id:        "tgenius",
  name:      "TGenius",
  legalName: "TGenius",
  tagline:   "Gestión inmobiliaria inteligente — TGenius",

  // Dominios que resuelven a TGenius (hostname exacto, máxima prioridad en el
  // resolver). El path /tgenius y el subdominio tgenius.stratoscapitalgroup.com
  // siguen funcionando para QA, pero la cara "pro" de TGenius es su propio
  // dominio. Falta el paso de infra: apuntar el DNS (CNAME → Vercel) y agregar
  // el dominio en el proyecto de Vercel.
  // ⚠️ Ajustar al dominio REAL cuando se compre (¿tgenius.com? ¿.ai? ¿.app?).
  domains: [
    "tgenius.stratoscapitalgroup.com", // subdominio — disponible ya (falta DNS + Vercel)
    "tgenius.com",
    "www.tgenius.com",
    "app.tgenius.com",
  ],

  brand: {
    logoText:                "TGenius",
    // Header de la app: muestra "TGenius" en vez del legacy "Stratos AI".
    // Solo afecta a TGenius — Duke y Grupo 28 no declaran este campo.
    appWordmark:             "TGenius",
    accent:                  "#6D28D9",   // violeta de marca (ajustable por TGenius)
    accentLight:             "#A78BFA",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · TGenius",
  },

  tenant: {
    clientId:       "tgenius",
    // UUID de "TGenius" en la tabla `organizations` del Supabase principal.
    organizationId: "c1d2e3f4-a5b6-47c8-9d0e-1f2a3b4c5d6e",
    // Comparte el mismo proyecto Supabase que Duke/Grupo28 — aislamiento por
    // organization_id + RLS, no por proyecto.
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // Features declaradas explícitamente (defensa en profundidad). El aislamiento
  // real lo enforza canAccessModule() en navigation.js: como TGenius NO es la
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
    email:    null,   // Pendiente: email de soporte de TGenius
    whatsapp: null,
  },

  // Configuración del CRM específica de TGenius.
  crm: {
    defaultProjects:     [],     // TGenius calcula la lista desde sus leads
    advisorMetricsTab:   true,
    discoverySimplified: true,
  },
};

export default tgeniusConfig;
