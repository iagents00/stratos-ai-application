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

  // Features de Grupo 28 — declaradas EXPLÍCITAMENTE (defensa en profundidad).
  //
  // El aislamiento real lo enforza `canAccessModule()` en navigation.js junto
  // con `EXTERNAL_ORG_MODULES` (clientes externos ven solo CRM, Perfil,
  // Papelera). Aún así declaramos los flags aquí en `false` para que la config
  // sea AUTOEXPLICATIVA: si alguien en el futuro modifica la lista de módulos
  // externos, Grupo 28 sigue sin ver lo que no le corresponde.
  features: {
    crm:          true,    // Pipeline de ventas, el módulo principal
    dash:         false,   // Dash de Stratos — Grupo 28 usa Comando Directivo
    erp:          false,   // ERP de Stratos — no aplica para Grupo 28
    team:         false,   // Asesores top — solo Stratos
    iacrm:        false,   // iAgents internos de Stratos
    landingPages: false,   // Campañas — solo Stratos
    finanzas:     false,   // Módulo interno de Stratos
    rrhh:         false,   // Módulo interno de Stratos
    trash:        true,    // Papelera del propio CRM
    // Comando Directivo propio en el sidebar — 7 indicadores ejecutivos
    // (asignados/contactados/calificados/zooms/activos/seguimientos) con
    // filtro Hoy/Semana/Mes y tabla por asesor. Distinto del Dash de Stratos.
    comandoDirectivo: true,
  },

  support: {
    email:    null,   // Pendiente: email de soporte de Grupo 28
    whatsapp: "+5219842803001",
    phoneLabel: "+52 1 984 280 3001",
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
    // Discovery simplificado: un solo drawer scrolleable con Próxima
    // Acción arriba, "Agregar nota adicional" prominente, y 4 accordions
    // al final (cronograma · chat · datos generales · historial unificado
    // de actividades del lead). Validado primero en Duke y ahora promovido
    // a Grupo 28. Tareas quedan ocultas porque Grupo 28 tiene 0 tasks en BD.
    discoverySimplified: true,
  },
};

export default grupo28Config;
