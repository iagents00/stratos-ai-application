/**
 * src/clients/legacy-design/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente LEGACY DESIGN — firma de arquitectura y desarrollo
 * inmobiliario (white-label del CRM Stratos).
 *
 * Qué es este tenant:
 *   Un despacho que diseña y además desarrolla. El CRM se reusa como PIPELINE DE
 *   PROYECTOS: cada registro es un encargo, desde la consulta inicial hasta la
 *   entrega de obra, pasando por propuesta, anteproyecto, proyecto ejecutivo y
 *   ejecución. Es el pariente cercano de Constructora Vega (obra/licitaciones),
 *   pero acá el trabajo arranca en el DISEÑO, no en la licitación.
 *
 * ⚠️ Por qué NO es un clon de Duke aunque suene "inmobiliario": Duke vende
 *    unidades de un catálogo (embudo de venta, zooms, cierre). Legacy Design
 *    ENTREGA proyectos (contrato, fases de diseño, obra). Mismo motor, pipeline y
 *    vocabulario distintos — y datos completamente separados.
 *
 * Aislamiento: comparte código y proyecto Supabase (glulgyhkrqpykxmujodb) pero sus
 * datos viven bajo su propia organization_id (281caa01-…) + RLS. Como su org NO es
 * STRATOS_ORG_ID, canAccessModule() la limita automáticamente a CRM + Perfil +
 * Papelera (+ Comando y Caja porque esta config los prende). Los módulos internos
 * de Stratos (Finanzas/RRHH/ERP/iAgents/Campañas) quedan bloqueados — usan datos
 * mock horneados en el bundle. No se toca el control de acceso ni la operación de Duke.
 *
 * Activación:
 *   - localhost:5173/?app&client=legacy-design     (dev / QA)
 *   - app.stratoscapitalgroup.com/legacy-design    (prod, path-based)
 *   - legacy-design.stratoscapitalgroup.com        (prod, subdomain — fase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const legacyDesignConfig = {
  id:        "legacy-design",
  name:      "Legacy Design",
  legalName: "Legacy Design",
  tagline:   "Arquitectura y desarrollo inmobiliario",

  brand: {
    logoText:                "Legacy Design",
    appWordmark:             "Legacy",
    // Bronce / arena. ⚠️ Hoy `brand.accent` NO retematiza la app (el tema global
    // sigue en menta del design system); lo consume el tablero de Comando Ops.
    accent:                  "#C8A97E",
    accentLight:             "#E3CBA9",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Legacy Design",
    intelligenceCenterLabelMobile: "Legacy",
  },

  tenant: {
    clientId:       "legacy-design",
    // UUID de la org "Legacy Design" en `organizations` (migración 179).
    organizationId: "281caa01-7414-4eef-b3b6-afa1e7623ab3",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot propio todavía (ver receta en la skill stratos-whitelabel-onboarding).
    botUsername:    "",
    telegramManualPairing: false,
  },

  features: {
    crm:              true,   // Reusado como Pipeline de Proyectos del despacho
    dash:             false,  // Dash de Stratos (mock)
    erp:              false,  // Catálogo inmobiliario de Duke (mock)
    team:             false,  // datos mock de Stratos
    iacrm:            false,  // iAgents internos de Stratos
    landingPages:     false,  // Campañas internas de Stratos
    finanzas:         false,  // datos mock de Stratos
    rrhh:             false,  // datos mock de Stratos
    trash:            true,   // Papelera del propio CRM
    comandoDirectivo: true,   // Tablero de los socios del despacho (org-scoped)
    // Caja: honorarios que entran por fase y gastos de obra que salen. Lo ve el
    // mando; el equipo de diseño no necesita el libro completo del despacho.
    caja:             true,
    cajaAsesores:     false,
    // Copilot APAGADO hasta que vinculen Telegram (el chat enruta por
    // telegram_chat_id). Se prende con copilotModule: true cuando conecten el bot.
    copilotModule:    false,
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el propio
    whatsapp: null,
  },

  crm: {
    // Tipo de encargo, para etiquetar cada proyecto en el alta.
    defaultProjects: [
      "Residencial",
      "Comercial",
      "Interiorismo",
      "Desarrollo propio",
      "Remodelación",
      "Consultoría / peritaje",
    ],
    // Métricas por persona: cuántos proyectos lleva cada arquitecto.
    advisorMetricsTab: true,
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" de venta de Stratos (mock).
    aiAgentsPanel: false,
    expedienteCentered: false,
    // El proyecto tiene un cliente real detrás y hace falta su teléfono para
    // coordinar reuniones y visitas de obra → NO projectMode.
    projectMode: false,
    // La etapa "Contactame Ya" del default global no existe en este pipeline:
    // en false, cada proyecto conserva su etapa al reasignarlo de arquitecto.
    bulkReassignToContactameByDefault: false,

    // ── Pipeline de PROYECTOS — solo Legacy Design ────────────────────────────
    // El camino real de un encargo de arquitectura: consulta → reunión de brief →
    // propuesta de honorarios → contrato firmado → anteproyecto → proyecto
    // ejecutivo → obra → entrega.
    //
    // ⚠️ CONTRATO CON n8n / con el asistente: estos `name` son los strings EXACTOS
    // que se guardan en leads.stage. Un flujo que dé de alta consultas debe
    // escribir "Consulta" (primera etapa) o el registro no cae en ninguna columna.
    //
    // "Reunión" es la etapa de CITA del tenant: proactive_config.zoom_stage_label
    // = 'Reunión' → el asistente avisa 3 h antes de la junta con el cliente.
    pipeline: [
      { name: "Consulta",           color: "#94A3B8" }, // llegó un interesado
      { name: "Reunión",            color: "#38BDF8" }, // junta / levantamiento agendado
      { name: "Propuesta",          color: "#FBBF24" }, // honorarios y alcance enviados
      { name: "Contratado",         color: "#A78BFA" }, // firmó / dio anticipo
      { name: "Anteproyecto",       color: "#FB923C" }, // primeras plantas y volumetría
      { name: "Proyecto ejecutivo", color: "#22D3EE" }, // planos constructivos
      { name: "Obra",               color: "#818CF8" }, // ejecución / supervisión
      { name: "Entregado",          color: "#34D399" }, // entregado al cliente
      { name: "Descartado",         color: "#F87171" }, // no procedió
    ],

    // ── Vocabulario del CRM — solo Legacy Design ─────────────────────────────
    labels: {
      entity:                "proyecto",
      entityCap:             "Proyecto",
      entityPlural:          "proyectos",
      newEntity:             "Nuevo proyecto",
      priorityList:          "Proyectos en prioridad",
      emptyList:             "Sin proyectos",
      entityNamePlaceholder: "Nombre del proyecto o del cliente",
      entityProfile:         "Detalle del proyecto",
      deleteEntity:          "Eliminar proyecto (mover a papelera)",
      viewDetail:            "Ver detalle del proyecto",
      openProfile:           "Abrir detalle del proyecto",
      pageTitle:             "Proyectos",
      pageTitleAccent:       "Legacy Design",
      pageTitleMobile:       "Proyectos",
      // El expediente del proyecto: brief, planos, acuerdos, avances de obra.
      discoveryTab:          "Expediente",
      discoveryTabShort:     "Exped.",
    },

    // ── KPIs de arriba del CRM — solo Legacy Design ──────────────────────────
    kpis: [
      { label: "Proyectos activos",  value: { type: "total" },
        sub: { type: "count", stage: "Propuesta", suffix: "con propuesta" },
        icon: "Building2",  color: "blue" },
      { label: "En diseño",          value: { type: "count", stage: "Anteproyecto" },
        sub: { type: "count", stage: "Proyecto ejecutivo", suffix: "en ejecutivo" },
        icon: "FileText",   color: "cyan" },
      { label: "En obra",            value: { type: "count", stage: "Obra" },
        sub: { type: "count", stage: "Entregado", suffix: "entregados" },
        icon: "Trophy",     color: "accent" },
      { label: "Valor contratado",   value: { type: "money" },
        sub: { type: "count", stage: "Reunión", suffix: "reuniones agendadas" },
        icon: "DollarSign", color: "emerald" },
    ],
  },
};

export default legacyDesignConfig;
