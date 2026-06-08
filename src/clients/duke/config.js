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
    // Comando Directivo activo en Duke — reemplaza el Dash legacy con la
    // vista ejecutiva nueva (gráfica de evolución + tabla descargable +
    // reporte HTML para dirección). Validado primero en Grupo 28, ahora
    // promovido al cliente original. Aplica solo a admins/director/ceo;
    // los asesores siguen sin tener acceso al módulo.
    comandoDirectivo: true,
  },

  support: {
    email:    "soporte@stratoscapitalgroup.com",
    whatsapp: "+5219842803001",
    phoneLabel: "+52 1 984 280 3001",
  },

  // Configuración del CRM específica de Duke.
  // Validado con Grupo 28 (PR #99) y promovido al cliente original.
  // - defaultProjects: vacío → Duke sigue calculando la lista desde leadsData
  //   (comportamiento histórico, sin cambios visibles).
  // - advisorMetricsTab: true → admins/director/super_admin/ceo de Duke
  //   ahora ven el botón "Indicadores" en el header del CRM.
  crm: {
    defaultProjects:     [],
    advisorMetricsTab:   true,
    // Discovery simplificado (PR del 2026-05): un solo drawer scrolleable
    // con Próxima Acción + notas + cronograma. Sin sub-toggle, sin Tareas.
    discoverySimplified: true,
    // Sync realtime del tablero de prioridad: el reorden/pin que el bot de
    // Telegram hace sobre crm_prefs ahora se refleja en vivo en el CRM abierto
    // (antes el front lo pisaba). Solo Duke por ahora.
    prefsRealtimeSync:   true,
  },
};

export default dukeConfig;
