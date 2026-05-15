/**
 * src/clients/grupo28/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente GRUPO 28.
 *
 * Esta es la única zona del repo que el desarrollador de Grupo 28 puede
 * modificar libremente. Todo lo demás del CRM se comparte con Duke (que está
 * en producción) y requiere aprobación del owner del proyecto.
 *
 * Activación: la app carga esta config cuando la URL es:
 *   - localhost:5173/?app/grupo28  (dev)
 *   - app.stratoscapitalgroup.com/grupo28  (prod, path-based)
 *   - grupo28.stratoscapitalgroup.com      (prod, subdomain — fase 2)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Para el dev de Grupo 28:
 *   - Cambiá legalName, tagline, brand.logoText y brand.accent libremente.
 *   - Para apagar módulos que el cliente no quiere, poné features.<modulo> = false.
 *   - Para conectar Supabase propio: editá .env.local (NO commitearlo).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const grupo28Config = {
  id:        "grupo28",
  name:      "Grupo 28",
  legalName: "Grupo 28",
  tagline:   "Gestión inmobiliaria — Grupo 28",

  brand: {
    logoText:    "Grupo 28",
    accent:      null,   // ← Pendiente: el dev de Grupo 28 elige el color de marca
    accentLight: null,
    favicon:     "/favicon.ico",
  },

  tenant: {
    clientId:    "grupo28",
    // Si Grupo 28 usa un proyecto Supabase propio, su ref va aquí.
    // Mientras tanto, las queries se filtran por client_id = "grupo28".
    supabaseRef: null,
  },

  // Mismas features que Duke por defecto. El dev puede apagar lo que no aplique.
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
    email:    null,   // Pendiente: email de soporte de Grupo 28
    whatsapp: null,
  },
};

export default grupo28Config;
