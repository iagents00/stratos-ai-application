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
    logoText:                "Grupo 28",
    accent:                  null,   // ← Pendiente: el dev de Grupo 28 elige el color de marca
    accentLight:             null,
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Grupo 28",
  },

  tenant: {
    clientId:       "grupo28",
    // UUID de "Grupo 28" en la tabla `organizations` del Supabase principal.
    // Los usuarios de esta org (felipeg@grupo28.com, lural@grupo28.com, etc.)
    // tienen profiles.organization_id = este UUID, y por PR #93 solo ven CRM.
    organizationId: "9afe40d2-7163-4407-a4cd-5346799ecd3c",
    // Comparte el mismo proyecto Supabase que Duke — el aislamiento es por
    // organization_id + RLS, no por proyecto.
    supabaseRef:    "glulgyhkrqpykxmujodb",
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
    // Grupo 28 quiere su propio Comando Directivo en el sidebar — distinto
    // del Dash de Stratos. Muestra los 7 indicadores ejecutivos coordinados
    // con el CRM (asignados/contactados/calificados/zooms/activos/seguim.)
    // con filtro Hoy/Semana/Mes y una tabla por asesor.
    comandoDirectivo: true,
  },

  support: {
    email:    null,   // Pendiente: email de soporte de Grupo 28
    whatsapp: null,
  },

  // Configuración del CRM específica de Grupo 28.
  crm: {
    // Lista curada de proyectos en el dropdown "Nuevo cliente".
    defaultProjects: [
      "Gobernador 28",
      "Monarca 28",
      "Portofino 28",
      "Presidente 28",
      "Prueba28",
    ],
    // Pestaña de métricas por asesor (Comando Directivo dentro del CRM).
    // Solo la verán los admins/director/super_admin/ceo de Grupo 28.
    advisorMetricsTab: true,
  },
};

export default grupo28Config;
