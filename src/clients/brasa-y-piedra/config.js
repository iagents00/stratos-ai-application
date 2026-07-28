/**
 * src/clients/brasa-y-piedra/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente BRASA Y PIEDRA — restaurante en Playa del Carmen
 * (white-label del CRM Stratos).
 *
 * Qué es este tenant (y por qué NO es un CRM de ventas):
 *   Un restaurante no tiene "leads" ni cierra ventas por pipeline: llena mesas.
 *   Lo que sí tiene forma de embudo — y hoy se les escapa en WhatsApp — son las
 *   RESERVAS Y EVENTOS: alguien pregunta por una mesa grande, un cumpleaños o un
 *   evento privado, hay que cotizarlo, confirmarlo con anticipo y atenderlo el
 *   día. Eso es lo que vive acá. El servicio de piso del día a día NO se
 *   administra desde este CRM.
 *
 * ⚠️ Supuesto anotado: la ubicación (Playa del Carmen) viene de lo que se dijo al
 *    pedir el alta y define la zona horaria del asistente (America/Cancun, la
 *    misma de Duke). Si operan en otra plaza, se corrige `timezone` en
 *    proactive_config y listo.
 *
 * ⚠️⚠️ HONESTIDAD SOBRE EL PIPELINE DE RESERVAS (leer antes de venderlo):
 *    El embudo de reservas/eventos de abajo es una PROPUESTA nuestra, no algo que
 *    el restaurante haya pedido. Lo que sí está registrado de boca de Iván es que
 *    el día de Brasa son "actividades cortas y entre ellos": pedidos y proteínas,
 *    mandar algo a marketing, un platillo nuevo, buscar cocinero o mesero — y por
 *    eso [[plan-replicacion-corporativo]] concluye que Brasa "no necesita CRM de
 *    ventas ni ERP de proyectos: necesita tareas rápidas, recordatorios y el chat".
 *    Además Alex dijo en la reunión del 27-jul: «en Brasa no veo dónde funcione
 *    Stratos, en Mueblería tampoco».
 *    → Por eso acá se prende el CHAT (lo que el plan sí pide) y se deja el tablero
 *      de reservas como la hipótesis a validar con quien maneje el restaurante.
 *      Si al sentarse con ellos las reservas no son un dolor real, este pipeline se
 *      cambia o se apaga (`features.crm: false`) sin tocar nada del resto.
 *
 * Aislamiento: comparte código y proyecto Supabase (glulgyhkrqpykxmujodb) pero sus
 * datos viven bajo su propia organization_id (ea74b69a-…) + RLS. Como su org NO es
 * STRATOS_ORG_ID, canAccessModule() la limita automáticamente a CRM + Perfil +
 * Papelera (+ Comando y Caja porque esta config los prende). Los módulos internos
 * de Stratos (Finanzas/RRHH/ERP/iAgents/Campañas) quedan bloqueados — usan datos
 * mock horneados en el bundle. No se toca el control de acceso ni la operación de Duke.
 *
 * Activación:
 *   - localhost:5173/?app&client=brasa-y-piedra     (dev / QA)
 *   - app.stratoscapitalgroup.com/brasa-y-piedra    (prod, path-based)
 *   - brasa-y-piedra.stratoscapitalgroup.com        (prod, subdomain — fase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const brasaYPiedraConfig = {
  id:        "brasa-y-piedra",
  name:      "Brasa y Piedra",
  legalName: "Brasa y Piedra",
  tagline:   "Reservas y eventos",

  // En el menú lateral el CRM no se llama "CRM": se llama "Reservas". Es el
  // idioma del negocio, y el mecanismo ya existe (App.jsx lee navLabels[id]).
  navLabels: { c: "Reservas" },

  brand: {
    logoText:                "Brasa y Piedra",
    appWordmark:             "Brasa y Piedra",
    // Brasa. ⚠️ Hoy `brand.accent` NO retematiza la app (el tema global sigue en
    // menta del design system); lo consume el tablero de Comando Ops.
    accent:                  "#F97316",
    accentLight:             "#FDBA74",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Brasa y Piedra",
    intelligenceCenterLabelMobile: "Brasa",
  },

  tenant: {
    clientId:       "brasa-y-piedra",
    // UUID de la org "Brasa y Piedra" en `organizations` (migración 184).
    organizationId: "ea74b69a-6904-4c65-a0ca-e0af58f1473a",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot propio todavía. Para un restaurante el bot es probablemente lo más
    // valioso del sistema (el host carga la reserva hablándole al teléfono), así
    // que es el primer candidato a montarle: receta en la skill
    // stratos-whitelabel-onboarding.
    botUsername:    "",
    telegramManualPairing: false,
  },

  features: {
    crm:              true,   // Reusado como Reservas y Eventos
    dash:             false,  // Dash de Stratos (mock)
    erp:              false,  // Catálogo inmobiliario de Duke (mock)
    team:             false,  // datos mock de Stratos
    iacrm:            false,  // iAgents internos de Stratos
    landingPages:     false,  // Campañas internas de Stratos
    finanzas:         false,  // datos mock de Stratos
    rrhh:             false,  // datos mock de Stratos
    trash:            true,   // Papelera del propio CRM
    comandoDirectivo: true,   // Tablero del dueño / gerente (org-scoped, seguro)
    // Caja: un restaurante compra insumos todos los días. El libro de
    // ingresos/egresos es de lo más aterrizado que se les puede dar.
    caja:             true,
    // El equipo (host, capitán de meseros) también carga compras del día desde la
    // web, no solo el gerente.
    cajaAsesores:     true,
    // Copilot APAGADO hasta que vinculen Telegram (el chat enruta por
    // telegram_chat_id). Se prende con copilotModule: true cuando conecten el bot.
    // ⭐ Para este tenant el Copilot por Telegram es LA pieza que más importa: el
    // plan del corporativo dice que Brasa "es casi todo Copilot por Telegram"
    // (tareas cortas entre ellos: pedidos y proteínas, un platillo nuevo, buscar
    // cocinero). Es el primer paso a darle cuando haya bot.
    copilotModule:    false,
    // Chat del equipo: ⭐ esto SÍ es lo que el plan dice que Brasa necesita
    // ("tareas rápidas, recordatorios y el chat"). Funciona solo, org-scoped, y el
    // primer admin crea su canal desde la misma pantalla.
    teamChat:         true,
    // Alta de usuarios propios (gerente, capitán, cocina) sin depender de nosotros.
    teamAdmin:        true,
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el propio
    whatsapp: null,
  },

  crm: {
    // Tipo de reserva, para etiquetar en el alta y poder filtrar después.
    defaultProjects: [
      "Mesa regular",
      "Grupo grande",
      "Evento privado",
      "Cumpleaños / celebración",
      "Corporativo",
      "Catering / fuera de casa",
    ],
    // Métricas por persona: cuántas reservas trae cada quien (host, RP).
    advisorMetricsTab: true,
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" de venta de Stratos (mock, inmobiliario).
    aiAgentsPanel: false,
    expedienteCentered: false,
    // La reserva tiene una persona real detrás y el teléfono es LO importante
    // (se confirma por WhatsApp) → NO projectMode.
    projectMode: false,
    // La etapa "Contactame Ya" del default global no existe en este pipeline:
    // en false, cada reserva conserva su etapa al reasignarla.
    bulkReassignToContactameByDefault: false,

    // ── Ajustes que antes se calculaban con las etapas de Duke ───────────────
    // La reserva confirmada (hay que montarla) y la solicitud sin responder
    // (se enfría en horas) son lo que hay que mirar hoy.
    priorityStages: ["Confirmada", "Solicitud"],
    // No cuentan como avance: no vino, o avisó que no venía.
    noProgressStages: ["No asistió", "Cancelada"],
    // ⚠️ SUPUESTO A CONFIRMAR CON EL RESTAURANTE: un evento típico ~$15.000 MXN.
    ticketReferencia: 15000,

    // ── Pipeline de RESERVAS Y EVENTOS — solo Brasa y Piedra ──────────────────
    // El camino real: entra la solicitud → se responde y se acuerda → si es
    // evento se cotiza → se confirma (con anticipo) → llega el día y se atiende.
    // "No asistió" existe a propósito y separado de "Cancelada": el no-show es un
    // dato de negocio (a quién no volver a apartar la mesa buena), no un error.
    //
    // ⚠️ CONTRATO CON n8n / con el asistente: estos `name` son los strings EXACTOS
    // que se guardan en leads.stage. Un flujo que dé de alta reservas debe escribir
    // "Solicitud" (primera etapa) o el registro no cae en ninguna columna.
    //
    // "Confirmada" es la etapa de CITA del tenant: proactive_config
    // .zoom_stage_label = 'Confirmada' → el asistente avisa 4 h antes de la
    // reserva, con tiempo para montar la mesa.
    pipeline: [
      { name: "Solicitud",      color: "#94A3B8" }, // preguntaron por mesa/evento
      { name: "En seguimiento", color: "#38BDF8" }, // se está acordando fecha/detalle
      { name: "Cotizado",       color: "#FBBF24" }, // evento o grupo con menú y precio
      { name: "Confirmada",     color: "#A78BFA" }, // apartada (anticipo si aplica)
      { name: "Atendida",       color: "#34D399" }, // vinieron y se les atendió
      { name: "No asistió",     color: "#FB923C" }, // no-show
      { name: "Cancelada",      color: "#F87171" }, // avisaron que no vienen
    ],

    // ── Vocabulario del CRM — solo Brasa y Piedra ────────────────────────────
    labels: {
      entity:                "reserva",
      entityCap:             "Reserva",
      entityPlural:          "reservas",
      newEntity:             "Nueva reserva",
      priorityList:          "Reservas en prioridad",
      emptyList:             "Sin reservas",
      entityNamePlaceholder: "Nombre de quien reserva",
      entityProfile:         "Detalle de la reserva",
      deleteEntity:          "Eliminar reserva (mover a papelera)",
      viewDetail:            "Ver detalle de la reserva",
      openProfile:           "Abrir detalle de la reserva",
      pageTitle:             "Reservas",
      pageTitleAccent:       "Brasa y Piedra",
      pageTitleMobile:       "Reservas",
      // El expediente de la reserva: número de personas, alergias, montaje,
      // menú acordado, quién es el festejado.
      discoveryTab:          "Detalles",
      discoveryTabShort:     "Detal.",
      // Quien tomó la reserva (host, RP o quien atienda el teléfono).
      advisor:               "responsable",
      advisorCap:            "Responsable",
      advisorPlural:         "responsables",
    },

    // ── KPIs de arriba del CRM — solo Brasa y Piedra ─────────────────────────
    kpis: [
      { label: "Reservas activas",   value: { type: "total" },
        sub: { type: "count", stage: "En seguimiento", suffix: "en seguimiento" },
        icon: "CalendarDays", color: "blue" },
      { label: "Confirmadas",        value: { type: "count", stage: "Confirmada" },
        sub: { type: "count", stage: "Solicitud", suffix: "por responder" },
        icon: "Users",        color: "cyan" },
      { label: "Eventos cotizados",  value: { type: "count", stage: "Cotizado" },
        sub: { type: "count", stage: "Atendida", suffix: "atendidas" },
        icon: "Trophy",       color: "accent" },
      { label: "Valor en eventos",   value: { type: "money" },
        sub: { type: "count", stage: "No asistió", suffix: "no-shows" },
        icon: "DollarSign",   color: "emerald" },
    ],
  },
};

export default brasaYPiedraConfig;
