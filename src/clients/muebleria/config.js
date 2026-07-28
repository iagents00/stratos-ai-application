/**
 * src/clients/muebleria/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente MUEBLERÍA — fábrica de muebles / carpintería
 * (white-label del CRM Stratos).
 *
 * ⚠️ NOMBRE PENDIENTE DE CONFIRMAR: al momento de montarlo no teníamos el nombre
 *    comercial real de la empresa, así que se usa "Mueblería" como rótulo. Cambiar
 *    el nombre visible es una línea (`name` + `brand.logoText` + `labels`); cambiar
 *    el `id`/slug ya implica mover la carpeta, la URL y el slug de la org, así que
 *    conviene confirmarlo antes de repartir accesos.
 *
 * Qué es este tenant:
 *   Un taller de carpintería que fabrica muebles a medida. El CRM se reusa como
 *   PIPELINE DE PEDIDOS: cada registro es un mueble encargado, en su camino desde
 *   que el cliente pregunta hasta que se entrega instalado. No es un embudo de
 *   venta inmobiliaria, es un flujo de producción.
 *
 * ⭐ POR QUÉ ESTA EMPRESA IMPORTA MÁS DE LO QUE PARECE (Iván, 24-jul):
 *   «Si el sistema se adapta a mueblería (los más rústicos), ya con eso se adapta
 *   a todas». Es el benchmark de adaptabilidad del corporativo.
 *   Consecuencia de diseño, y hay que tomarla en serio: **acá la gente no vive
 *   frente a una computadora.** La entrada natural es **Telegram y la voz**, y la
 *   evidencia de avance es **una foto**, no un texto. Esta web es el tablero del
 *   dueño para VER lo que entra; el taller no va a cargar formularios.
 *   → Por eso lo próximo y más valioso para este tenant NO es otro módulo web:
 *     es su bot de Telegram + el Copilot (ver `features.copilotModule`).
 *
 * ⚠️ Las etapas internas del taller (corte, armado, laca) NO son columnas del
 *    kanban a propósito: viven como próxima acción / notas dentro del pedido.
 *    Volverlas columnas duplicaría el tablero y hay que verlo con el taller real
 *    antes. Y ojo con la tensión abierta: Alex dijo el 27-jul «en Mueblería
 *    tampoco veo dónde funcione Stratos» — conviene reconciliarlo con Iván
 *    (que la puso de benchmark) antes de invertirle mucho más.
 *
 * Aislamiento: comparte código y proyecto Supabase (glulgyhkrqpykxmujodb) pero sus
 * datos viven bajo su propia organization_id (e583eb98-…) + RLS. Como su org NO es
 * STRATOS_ORG_ID, canAccessModule() la limita automáticamente a CRM + Perfil +
 * Papelera (+ Comando y Caja porque esta config los prende). Los módulos internos
 * de Stratos (Finanzas/RRHH/ERP/iAgents/Campañas) quedan bloqueados — usan datos
 * mock horneados en el bundle y filtrarían info de Stratos si se prendieran.
 * No se toca el control de acceso ni nada de la operación de Duke.
 *
 * Activación:
 *   - localhost:5173/?app&client=muebleria     (dev / QA)
 *   - app.stratoscapitalgroup.com/muebleria    (prod, path-based)
 *   - muebleria.stratoscapitalgroup.com        (prod, subdomain — fase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const muebleriaConfig = {
  id:        "muebleria",
  name:      "Mueblería",
  legalName: "Mueblería",
  tagline:   "Taller de muebles a medida",

  // En el menú lateral el CRM no se llama "CRM" — en el taller nadie dice CRM.
  // Se llama "Pedidos", que es lo que de verdad lleva. El mecanismo ya existe
  // (App.jsx lee navLabels[id]); solo cambia el texto, no el routing ni permisos.
  navLabels: { c: "Pedidos" },

  brand: {
    logoText:                "Mueblería",
    appWordmark:             "Mueblería",
    // Madera / ámbar. ⚠️ Hoy `brand.accent` NO retematiza la app (el tema global
    // sigue en menta del design system); lo consume el tablero de Comando Ops.
    // Queda declarado para cuando el accent por cliente esté cableado.
    accent:                  "#D4A373",
    accentLight:             "#E9C9A5",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Mueblería",
    intelligenceCenterLabelMobile: "Mueblería",
  },

  tenant: {
    clientId:       "muebleria",
    // UUID de la org "Mueblería" en `organizations` (migración 179). Con esto,
    // ClientOrgGuard auto-redirige a su gente a /muebleria tras el login y RLS
    // aísla sus datos.
    organizationId: "e583eb98-ff00-4920-a69c-db39f3841b31",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot propio todavía. Cuando lo tengan: crear el bot con @BotFather,
    // ponerlo acá sin @, y seguir la receta de la skill stratos-whitelabel-onboarding.
    botUsername:    "",
    telegramManualPairing: false,
  },

  // Set mínimo y aislado (mismo patrón probado en Grupo 28 / Vega / NSG).
  features: {
    crm:              true,   // Reusado como Pipeline de Pedidos del taller
    dash:             false,  // Dash de Stratos (mock)
    erp:              false,  // Catálogo inmobiliario de Duke (mock)
    team:             false,  // datos mock de Stratos
    iacrm:            false,  // iAgents internos de Stratos
    landingPages:     false,  // Campañas internas de Stratos
    finanzas:         false,  // datos mock de Stratos
    rrhh:             false,  // datos mock de Stratos
    trash:            true,   // Papelera del propio CRM
    comandoDirectivo: true,   // Tablero del dueño del taller (org-scoped, seguro)
    // Caja: un taller compra madera, herrajes y barniz todo el tiempo. El libro
    // de ingresos/egresos (team_expenses) es de lo más útil que se les puede dar.
    caja:             true,
    // Los carpinteros también cargan sus gastos de compra desde la web, no solo
    // el mando (mismo caso que el equipo de campo de Vega).
    cajaAsesores:     true,
    // Copilot APAGADO por ahora: el chat del asistente enruta por telegram_chat_id,
    // así que no sirve hasta que la gente del taller vincule su Telegram. Se prende
    // (copilotModule: true) el día que conecten el bot — no antes, para no darles
    // un módulo que no responde.
    copilotModule:    false,
    // Chat del equipo: funciona solo (org-scoped, sin depender de n8n) y el primer
    // admin crea su canal desde la misma pantalla. Para gente que no vive frente a
    // la computadora, tener el hilo del taller acá adentro vale más que un módulo más.
    teamChat:         true,
    // Alta de usuarios: sin esto el tenant no puede sumar a su propia gente y
    // dependería de nosotros para cada carpintero. Es org-scoped: un admin de la
    // mueblería jamás ve gente de Duke.
    teamAdmin:        true,
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el propio
    whatsapp: null,
  },

  crm: {
    // Tipos de trabajo del taller, para etiquetar cada pedido. Se ofrecen en el
    // dropdown "Proyecto" del alta. Ajustar a lo que realmente fabriquen.
    defaultProjects: [
      "Cocina integral",
      "Clóset / vestidor",
      "Puertas",
      "Mobiliario a medida",
      "Comercial / obra",
      "Reparación / restauración",
    ],
    // Métricas por persona: cuántos pedidos lleva cada carpintero/vendedor.
    advisorMetricsTab: true,
    // Discovery simplificado (patrón validado en Duke/Grupo28/TGenius/Vega/NSG).
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" de venta de Stratos (mock, inmobiliario).
    aiAgentsPanel: false,
    // Expediente como drawer lateral (igual que Duke).
    expedienteCentered: false,
    // NO usamos projectMode: el pedido tiene un cliente real detrás y necesitamos
    // su teléfono para avisarle de la medición y la entrega.
    projectMode: false,
    // ⚠️ Importante: el default global mueve los registros reasignados a la etapa
    // "Contactame Ya", que NO existe en este pipeline (quedarían fuera del tablero).
    // En false, cada pedido conserva su etapa al reasignarlo de carpintero.
    bulkReassignToContactameByDefault: false,

    // ── Pipeline de PEDIDOS del taller — solo Mueblería ───────────────────────
    // El camino real de un mueble a medida: alguien pregunta → se va a tomar
    // medidas → se cotiza → aprueban y dan anticipo → se fabrica → acabados →
    // se instala → entregado.
    //
    // ⚠️ CONTRATO CON n8n / con el asistente: estos `name` son los strings EXACTOS
    // que se guardan en leads.stage. Un flujo que dé de alta pedidos debe escribir
    // "Solicitud" (primera etapa). Si el string no coincide, el registro no cae en
    // ninguna columna del kanban.
    //
    // "Medición" es además la etapa de CITA del tenant: proactive_config
    // .zoom_stage_label = 'Medición' → el asistente avisa 3 h antes de ir a medir.
    pipeline: [
      { name: "Solicitud",     color: "#94A3B8" }, // preguntaron, aún sin medir
      { name: "Medición",      color: "#38BDF8" }, // visita agendada para tomar medidas
      { name: "Cotizado",      color: "#FBBF24" }, // presupuesto enviado
      { name: "Aprobado",      color: "#A78BFA" }, // aceptaron / dieron anticipo
      { name: "En producción", color: "#FB923C" }, // en el taller
      { name: "Acabados",      color: "#22D3EE" }, // lijado, barniz, herrajes
      { name: "Entrega",       color: "#F472B6" }, // listo, agendando instalación
      { name: "Entregado",     color: "#34D399" }, // instalado y cobrado
      { name: "Cancelado",     color: "#F87171" }, // no procedió
    ],

    // ── Vocabulario del CRM — solo Mueblería ─────────────────────────────────
    // Cada registro es un PEDIDO, no un "cliente".
    labels: {
      entity:                "pedido",
      entityCap:             "Pedido",
      entityPlural:          "pedidos",
      newEntity:             "Nuevo pedido",
      priorityList:          "Pedidos en prioridad",
      emptyList:             "Sin pedidos",
      entityNamePlaceholder: "Cliente o mueble (ej. Cocina — Familia López)",
      entityProfile:         "Detalle del pedido",
      deleteEntity:          "Eliminar pedido (mover a papelera)",
      viewDetail:            "Ver detalle del pedido",
      openProfile:           "Abrir detalle del pedido",
      pageTitle:             "Pedidos",
      pageTitleAccent:       "Taller",
      pageTitleMobile:       "Pedidos",
      // El "Discovery" de Stratos acá es el expediente del mueble: medidas,
      // materiales, fotos del avance.
      discoveryTab:          "Expediente",
      discoveryTabShort:     "Exped.",
      // Quien lleva el pedido en el taller. NO "asesor": acá nadie asesora, alguien se
      // hace cargo del mueble de punta a punta.
      advisor:               "responsable",
      advisorCap:            "Responsable",
      advisorPlural:         "responsables",
    },

    // ── KPIs de arriba del CRM — solo Mueblería ──────────────────────────────
    // Lo que el dueño del taller mira todos los días: cuánto hay encargado, qué
    // está en la banca de trabajo, qué falta entregar y cuánto dinero representa.
    // Solo íconos ya soportados por KPI_ICON_MAP del CRM.
    kpis: [
      { label: "Pedidos activos",   value: { type: "total" },
        sub: { type: "count", stage: "Cotizado", suffix: "cotizados" },
        icon: "FileText",   color: "blue" },
      { label: "En producción",     value: { type: "count", stage: "En producción" },
        sub: { type: "count", stage: "Acabados", suffix: "en acabados" },
        icon: "Target",     color: "cyan" },
      { label: "Por entregar",      value: { type: "count", stage: "Entrega" },
        sub: { type: "count", stage: "Entregado", suffix: "entregados" },
        icon: "Trophy",     color: "accent" },
      { label: "Valor en pedidos",  value: { type: "money" },
        sub: { type: "count", stage: "Medición", suffix: "mediciones agendadas" },
        icon: "DollarSign", color: "emerald" },
    ],
  },
};

export default muebleriaConfig;
