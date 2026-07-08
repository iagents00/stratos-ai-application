/**
 * src/clients/_shared/defaults.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Config base que TODOS los clientes heredan.
 *
 * Cada cliente en src/clients/<id>/config.js puede sobreescribir cualquier
 * campo de aquí. Si no lo sobreescribe, hereda el valor por defecto.
 *
 * REGLA: agregar campos nuevos aquí PRIMERO, con su valor por defecto.
 *        Así garantizamos que ningún cliente se rompe porque le falte un campo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_CLIENT_CONFIG = {
  // Identidad
  id:        "default",
  name:      "Stratos AI",
  legalName: "Stratos Capital Group",
  tagline:   "Plataforma inteligente de gestión inmobiliaria",

  // Dominios propios que resuelven a este cliente (white-label con su dominio).
  // El resolver (src/clients/index.js) los matchea por hostname EXACTO con
  // máxima prioridad. Útil para que un cliente viva en su dominio propio
  // (ej: app.tgenius.com) sin depender de heurísticas de subdominio ni de un
  // path /<cliente>. Default vacío → el cliente se resuelve por path/subdominio.
  domains: [],

  // Renombra etiquetas del menú lateral por módulo: { <navId>: "<texto>" }.
  // Default {} → cada módulo usa su label histórico de navigation.js. Un cliente
  // puede presentar un módulo con otro nombre (ej. Vega: CRM → "ERP"). Solo
  // cambia el texto visible, no el routing ni los permisos.
  navLabels: {},

  // Branding visual (overrides opcionales del design system)
  brand: {
    logoText:              "Stratos",
    // Wordmark del HEADER de la app (esquina superior izquierda). Opt-in:
    // si es null, el header renderiza el legacy "Stratos" + "AI" → Duke y
    // Grupo 28 quedan idénticos. Un cliente white-label lo setea con su nombre
    // para que el header muestre SU marca (ej: TGenius → "TGenius").
    appWordmark:           null,
    accent:                null,   // null → usa el accent del design system
    accentLight:           null,
    favicon:               "/favicon.ico",
    // Etiqueta del pill del header (Dynamic Island). Cada cliente puede
    // personalizarla para que la app se sienta más suya. Default mantiene el
    // texto histórico → Duke no cambia.
    intelligenceCenterLabel: "Centro de Inteligencia",
  },

  // Multi-tenancy en Supabase
  // - organizationId: UUID de la organización en la tabla `organizations`.
  //   Es el LINK entre nuestro sistema de URL (clientId) y el sistema de permisos
  //   por organización (PR #93). Si un user loguea y su organizationId no matchea
  //   con el del clientId actual, lo redirigimos al cliente correcto.
  // - clientId: identificador interno (duke, grupo28...) usado en la URL.
  // - supabaseRef: si el cliente usa SU PROPIO proyecto Supabase, se setea acá.
  //   Mientras tanto, todos comparten el proyecto principal y se aíslan por
  //   organizationId + RLS.
  tenant: {
    clientId:        "default",
    organizationId:  null,   // null → no hay org asociada (fallback genérico)
    supabaseRef:     null,
    // Username del bot de Telegram de ESTE cliente (sin @). Cada tenant tiene
    // su propio bot. Default "" → la vista de Perfil cae al env var global
    // VITE_TELEGRAM_BOT_USERNAME, así Duke/Stratos siguen IGUAL hasta que un
    // cliente declare el suyo acá.
    botUsername:     "",
    // Flujo de pareo en Perfil → Conectar Telegram:
    //   false (default) = DEEP LINK: botón "Conectar mi Telegram" que abre
    //     t.me/<bot>?start=<código>. Es lo de Duke; queda IGUAL.
    //   true            = MANUAL: muestra el código de 8 dígitos + instrucciones
    //     "/conectar <código>" (más un botón deep link como extra). Sirve para
    //     conectar desde la app de Telegram del celular sin depender de que el
    //     navegador tenga sesión iniciada.
    telegramManualPairing: false,
  },

  // Features habilitadas — cada módulo del CRM puede prenderse/apagarse
  // por cliente. Si no aparece aquí, asumimos true (compat retroactiva).
  features: {
    crm:           true,
    dash:          true,
    erp:           true,
    team:          true,
    iacrm:         true,
    landingPages:  true,
    finanzas:      true,
    rrhh:          true,
    trash:         true,
    // Comando Directivo: dashboard ejecutivo con indicadores de equipo
    // (asignados, contactados, calificados, zooms, activos, seguimientos)
    // filtrable por Hoy / Semana / Mes. Default OFF — solo clientes que lo
    // necesiten explícitamente lo prenden. Visible para admin/director/ceo.
    comandoDirectivo: false,
    // Control de Zooms: pestaña dentro de Comando Directivo para gestionar los
    // Zooms de venta (Liner / Presentador / estatus) sobre la tabla
    // zoom_agendados (migración 027). Reemplaza el Excel de control manual.
    // Default OFF — workflow específico de Duke por ahora; otros clientes no
    // ven la pestaña hasta que lo prendan.
    zoomControl: false,
    // Caja: libro de cuentas / ingresos / egresos sobre team_expenses (los
    // gastos que el equipo registra por Telegram aparecen ahí solos). Visible
    // para TODOS los roles del cliente (incluye asesor). Default OFF — hoy
    // solo Constructora Vega lo prende en su config.
    caja: false,
  },

  // Contacto y soporte
  support: {
    email:    "soporte@stratoscapitalgroup.com",
    whatsapp: null,
    // Etiqueta del telefono de soporte mostrada en el header (icono PhoneCall)
    // y en el panel "Soporte directo" del Perfil/System. Si es null, no se
    // muestra el boton de llamada. Cada cliente lo setea en su config.js.
    phoneLabel: null,
  },

  // Configuración del CRM por cliente
  crm: {
    // Lista curada de proyectos preseteados que aparecen en el dropdown del
    // formulario "Nuevo cliente". Si está vacío (default), el CRM calcula la
    // lista a partir de los leads existentes (comportamiento histórico de Duke).
    // Si el cliente declara una lista, esa toma prioridad → útil para clientes
    // recién onboardeados que aún no tienen leads.
    defaultProjects: [],

    // Pestaña "Indicadores de Asesores" dentro del CRM. Muestra una tabla con
    // métricas por asesor (leads asignados, contactados, zooms, etc.) filtrable
    // por día/semana/mes. Visible solo para roles admin/director/super_admin/ceo.
    // Default OFF → Duke no la ve hasta que se prenda explícitamente.
    advisorMetricsTab: false,

    // Drawer "Discovery" simplificado — una sola sección scrolleable con
    // Próxima Acción arriba, notas y cronograma, sin la sección de Tareas.
    // Cuando está OFF, se mantiene el comportamiento histórico (Expediente
    // + Perfil + Análisis IA con sección de Tareas visible).
    discoverySimplified: false,

    // "Centro de Agentes IA" (equipo virtual de venta: reactivar/seguimiento/
    // callcenter/calificar). Default true → se muestra. Clientes que no venden
    // (ej. Vega: obra/licitaciones) lo apagan con false.
    aiAgentsPanel: true,

    // Layout del Expediente (NotesModal) en desktop. Default false → drawer
    // lateral de 460px (Duke). true → modal centrado casi-fullscreen (Vega).
    expedienteCentered: false,

    // Modo PROYECTO — para clientes cuyo "cliente" del CRM es un proyecto (obra,
    // licitación), no un lead/persona. Cuando está ON, el detalle (NotesModal)
    // deja solo Próxima acción + Expediente (notas) y oculta los datos de lead:
    // el bloque "Datos generales del cliente" (teléfono, correo, etiqueta,
    // campaña, fricción, perfil, riesgo) y el campo inline de teléfono.
    // Default OFF → Duke y el resto NO cambian.
    projectMode: false,

    // Sincronización realtime del tablero de prioridad (profiles.crm_prefs).
    // Cuando el bot de Telegram reordena/pinea un cliente, el CRM abierto en el
    // browser pisaba ese cambio al re-guardar su snapshot en memoria
    // (last-writer-wins, sin sync). Con esto ON, el CRM se suscribe a cambios
    // de su propia fila profiles y refleja en vivo lo que escribió el bot.
    // Default OFF → solo clientes que lo validen lo prenden.
    prefsRealtimeSync: false,

    // Bulk reassign: comportamiento legacy/seguro por defecto = mover los
    // leads reasignados a "Contactame Ya" para que el nuevo asesor los vea
    // arriba del pipeline. Clientes pueden setear esto a false para preservar
    // la etapa actual en cada lead al reasignar.
    bulkReassignToContactameByDefault: true,

    // Pipeline (etapas del kanban) custom por cliente. Default null → el CRM
    // usa el pipeline histórico de Duke (STAGES de design-system/tokens). Si un
    // cliente declara un array, ESE pipeline reemplaza al de Duke SOLO para ese
    // cliente (resuelto en src/app/constants/pipeline.js al boot). Duke nunca
    // se ve afectado mientras este campo siga en null.
    //
    // Shape: [{ name: string, color: "#RRGGBB" }, ...]
    // - El orden define las columnas del kanban (izq → der).
    // - La primera etapa es donde caen los registros nuevos (DEFAULT_STAGE).
    // - `name` es el string EXACTO que se guarda en leads.stage — n8n debe
    //   escribir ese mismo string para que el registro caiga en la columna.
    pipeline: null,

    // Vocabulario del CRM (etiquetas visibles) custom por cliente. Default null
    // → se usa el vocabulario histórico de Duke (DEFAULT_LABELS en
    // src/app/constants/labels.js). Un cliente puede declarar solo las claves
    // que quiera cambiar (ej. Vega: "cliente" → "proyecto"); el resto hereda
    // Duke. Duke nunca se ve afectado mientras esto siga en null.
    labels: null,

    // KPIs de arriba del CRM custom por cliente. Default null → las 4 tarjetas
    // históricas de Stratos (Clientes en Pipeline / Score / Zooms / Valor). Si
    // un cliente declara un array (ej. Vega: métricas de obra), el CRM renderiza
    // esas. Shape de cada KPI: { label, value:{type,stage?}, sub:{type,stage?,suffix}, icon, color }.
    kpis: null,
  },
};

/**
 * Helper: merge profundo de la config del cliente sobre los defaults.
 * Solo dos niveles (suficiente para nuestra shape). No usa lodash.
 */
export function mergeClientConfig(clientConfig) {
  const base = DEFAULT_CLIENT_CONFIG;
  if (!clientConfig) return base;
  return {
    ...base,
    ...clientConfig,
    brand:    { ...base.brand,    ...(clientConfig.brand    || {}) },
    tenant:   { ...base.tenant,   ...(clientConfig.tenant   || {}) },
    features: { ...base.features, ...(clientConfig.features || {}) },
    support:  { ...base.support,  ...(clientConfig.support  || {}) },
    crm:      { ...base.crm,      ...(clientConfig.crm      || {}) },
  };
}
