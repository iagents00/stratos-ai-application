/**
 * src/clients/duke/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente DUKE (cliente original de Stratos AI, en producción).
 *
 * Este es el cliente "default" — si la URL no matchea ninguna otra ruta de
 * cliente (ej: /grupo28), se carga esta config.
 *
 * ⚠️ ZONA SENSIBLE — este archivo afecta el CRM en producción de Duke del Caribe.
 * Cualquier cambio aquí lo revisa el owner del proyecto antes de mergear.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const dukeConfig = {
  id:        "duke",
  name:      "Stratos AI",
  legalName: "Duke del Caribe",
  tagline:   "Plataforma inteligente de gestión inmobiliaria",

  brand: {
    logoText:    "Stratos",
    accent:      null,   // usa el accent del design system (verde menta #6EE7C2)
    accentLight: null,
    favicon:     "/favicon.ico",
  },

  tenant: {
    clientId:       "duke",
    // UUID de "Stratos Capital Group" en la tabla `organizations`. Coincide con
    // la constante STRATOS_ORG_ID en src/app/constants/navigation.js. NO CAMBIAR.
    organizationId: "00000000-0000-0000-0000-000000000001",
    supabaseRef:    "glulgyhkrqpykxmujodb",  // proyecto Supabase de producción
  },

  // Duke tiene todos los módulos habilitados
  features: {
    crm:          true,
    dash:         true,
    erp:          true,
    team:         true,
    iacrm:        true,
    landingPages: true,
    finanzas:     true,
    rrhh:         true,
    trash:        true,
  },

  support: {
    email:    "soporte@stratoscapitalgroup.com",
    whatsapp: null,
  },
};

export default dukeConfig;
