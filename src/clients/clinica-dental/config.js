/**
 * src/clients/clinica-dental/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente CLÍNICA DENTAL (white-label del CRM Stratos).
 *
 * Es el primer tenant que NO es inmobiliario ni de obra: acá el "cliente" es un
 * PACIENTE, el pipeline es un tratamiento odontológico y el asistente sabe de
 * citas, presupuestos y controles — no de leads ni de Zooms.
 *
 * Antes de que existiera este archivo, `/clinica-dental` no matcheaba ningún
 * cliente registrado y `matchClientFromLocation()` caía al default `duke`: la
 * clínica veía el pipeline inmobiliario de Duke del Caribe ("Contáctame Ya",
 * "Zoom Agendado", "Apartó"), la palabra "cliente" y los KPIs de Zooms. Este
 * config es lo que corta esa herencia.
 *
 * SIN TELEGRAM (decisión del cliente): el asistente vive SOLO dentro de la app,
 * como Copilot. Por eso `botUsername` va vacío y `telegramManualPairing` en
 * false. La identidad del Copilot igual se resuelve por
 * `profiles.telegram_chat_id`, que en este tenant es un valor SINTÉTICO
 * (negativo) que nadie usa para chatear — es solo la llave del cerebro.
 *
 * Activación:
 *   - localhost:5173/?app&client=clinica-dental      (dev / QA)
 *   - app.stratoscapitalgroup.com/clinica-dental     (prod, path-based)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const clinicaDentalConfig = {
  id:        "clinica-dental",
  name:      "Clínica Dental",
  legalName: "Clínica Dental",
  tagline:   "Pacientes, agenda y tratamientos en un solo lugar",

  // El CRM acá no es un CRM: es la lista de pacientes de la clínica.
  navLabels: { c: "Pacientes" },

  brand: {
    logoText: "Clínica Dental",
    appWordmark: "Clínica Dental",
    // Azul clínico, deliberadamente distinto del menta de Duke (#6EE7C2) y del
    // rosa de NSG: en salud el azul lee como limpieza y confianza, y evita que
    // la clínica sienta que está usando "el sistema de otra empresa".
    accent:      "#38BDF8",
    accentLight: "#7DD3FC",
    favicon:     "/favicon.ico",
    intelligenceCenterLabel:       "Centro de Inteligencia · Clínica Dental",
    intelligenceCenterLabelMobile: "Clínica Dental",
  },

  tenant: {
    clientId:       "clinica-dental",
    // Org "Clínica Dental" en `organizations` (stratos-prod). Con esto activo,
    // ClientOrgGuard manda a /clinica-dental a quien entre con esta org.
    organizationId: "6c5cf32a-3db4-477d-bbed-26d90231bc9a",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot de Telegram: el asistente es solo el Copilot de la app.
    botUsername:           "",
    telegramManualPairing: false,
    // Cerebro propio en n8n → RPC `dental_nlu_dispatch` en Supabase.
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-dental-9f2c7a41",
    // "¿Qué puedes hacer?" escrito para una clínica. Sin esto, el Copilot
    // respondía con el manual inmobiliario (leads, Zooms, catálogo de
    // propiedades). Lenguaje de consultorio, sin tecnicismos.
    copilotHelp:
      "Esto es lo que puedo hacer por ti:\n\n" +
      "• Pacientes — \"muéstrame mis pacientes\", \"busca a Marcela\", \"abre la ficha de Ricardo\", \"registra a Ana Gómez, teléfono 300 123 4567\"\n" +
      "• Agenda — \"¿qué tengo hoy?\", \"citas de la semana\", \"agenda a Camila el jueves a las 10\", \"mueve la cita de Andrés para mañana a las 3\", \"confirma la cita de Luisa\"\n" +
      "• Después de atender — \"Jorge ya vino\" o \"Marcela no asistió\", y el paciente avanza solo de etapa\n" +
      "• Presupuestos — \"hazle un presupuesto de implante a Marcela\", \"ya se lo envié\", \"lo aceptó\", \"¿qué presupuestos están esperando respuesta?\"\n" +
      "• Tratamientos — \"¿cuánto vale la ortodoncia?\", \"inicia ortodoncia a Ricardo\", \"registra la sesión de Ricardo\", \"¿qué tratamientos están en curso?\"\n" +
      "• Controles — \"prográmale el control a Paola en 6 meses\", \"¿qué controles vienen?\"\n" +
      "• Indicadores — \"¿cómo va la clínica?\", \"muéstrame el embudo\"\n\n" +
      "Puedes hablarme por voz o escribirme. Todo lo que registro aparece al instante en la ficha del paciente.",
  },

  // Solo lo que una clínica usa. El resto son módulos internos de Stratos con
  // datos de ejemplo horneados en el bundle: prendidos filtrarían información de
  // otra empresa. Además `canAccessModule` ya los bloquea por no ser la org de
  // Stratos — esto es defensa en profundidad.
  features: {
    crm:          true,   // La lista de pacientes
    dash:         false,
    erp:          false,
    team:         false,
    iacrm:        false,
    landingPages: false,
    finanzas:     false,
    rrhh:         false,
    trash:        true,   // Papelera del propio tenant
    comandoDirectivo: false,
    caja:         false,
    whatsappChat:   false,
    whatsappModule: false,
    mktModule:      false,
    zoomControl:    false, // No hay Zooms en un consultorio
    // El asistente dentro de la app, con cerebro dental propio.
    copilotModule: true,
    copilotBrain:  "dental",
  },

  // Portada de la pantalla de acceso. Sin esto se hereda la de Stratos, que
  // habla de "IA comercial", de "cerrar más" y de "$40M+ en transacciones
  // gestionadas": el negocio de una inmobiliaria, no el de un consultorio — y
  // es lo primero que ve cualquiera que entre.
  login: {
    heroTop: "El consultorio",
    heroBot: "ordenado de principio a fin",
    sub: [
      "Pacientes · Agenda · Presupuestos · Tratamientos",
      "Todo en un solo lugar, y un asistente que lo escribe por ti.",
    ],
    stats: [
      ["100%", "De la historia en un lugar"],
      ["0",    "Citas que se te pasan"],
      ["24/7", "Asistente que responde"],
    ],
  },

  support: {
    email:    null,   // Pendiente: correo de soporte de la clínica
    whatsapp: null,   // Pendiente: WhatsApp de la clínica
  },

  crm: {
    // Tratamientos preseteados en el dropdown al crear un paciente. Coinciden
    // con el catálogo sembrado en `dent_treatments` para esta org.
    defaultProjects: [
      "Consulta de valoración",
      "Limpieza dental",
      "Blanqueamiento dental",
      "Resina / calza",
      "Endodoncia",
      "Corona en porcelana",
      "Extracción simple",
      "Extracción muela del juicio",
      "Ortodoncia (brackets)",
      "Implante dental",
      "Urgencia odontológica",
    ],
    advisorMetricsTab:   true,   // Indicadores por odontólogo
    discoverySimplified: true,
    aiAgentsPanel:       false,  // Agentes de venta de Stratos: no aplican
    expedienteCentered:  false,
    projectMode:         false,  // El paciente ES una persona: teléfono y datos visibles

    // ── Pipeline de PACIENTES ────────────────────────────────────────────────
    // El recorrido real de una clínica: alguien pregunta → se le contacta →
    // viene a valoración → se le pasa el presupuesto → acepta y se trata →
    // queda en controles. "Perdido" es el carril de los que no siguieron.
    //
    // ⚠️ CONTRATO CON EL CEREBRO: estos `name` son EXACTOS los strings que van a
    // leads.stage, y `dental_nlu_dispatch` los escribe tal cual al mover un
    // paciente (al agendar cita, al marcar atendida, al aceptar presupuesto…).
    // Si se renombra una etapa acá, hay que renombrarla también en esa función
    // o el paciente deja de aparecer en su columna.
    pipeline: [
      { name: "Nuevo contacto",      color: "#94A3B8" }, // preguntó, aún sin contactar
      { name: "Contactado",          color: "#38BDF8" }, // se le escribió, coordinando cita
      { name: "Cita agendada",       color: "#A78BFA" }, // con día y hora confirmados
      { name: "Consulta realizada",  color: "#FBBF24" }, // ya vino, falta presupuesto
      { name: "Presupuesto enviado", color: "#FB923C" }, // esperando su respuesta
      { name: "Tratamiento en curso",color: "#22D3EE" }, // aceptó, está en sesiones
      { name: "Paciente recurrente", color: "#34D399" }, // terminó, sigue en controles
      { name: "Perdido",             color: "#F87171" }, // no siguió — se anota el motivo
    ],

    // ── Vocabulario de la clínica ────────────────────────────────────────────
    labels: {
      entity:                "paciente",
      entityCap:             "Paciente",
      entityPlural:          "pacientes",
      newEntity:             "Nuevo paciente",
      priorityList:          "Pacientes en prioridad",
      emptyList:             "Sin pacientes",
      entityNamePlaceholder: "Nombre del paciente",
      entityProfile:         "Historia del paciente",
      deleteEntity:          "Eliminar paciente (mover a papelera)",
      viewDetail:            "Ver historia del paciente",
      openProfile:           "Abrir historia del paciente",
      pageTitle:             "Clínica",
      pageTitleAccent:       "Dental",
      pageTitleMobile:       "Pacientes",
      discoveryTab:          "Historia",
      discoveryTabShort:     "Hist.",
    },

    // ── KPIs de la clínica ───────────────────────────────────────────────────
    // Reemplazan las tarjetas de Stratos (Score, Zooms…) por lo que de verdad
    // mira una clínica: cuánta gente tiene, cuántos van a venir, cuántos
    // presupuestos están sin respuesta y cuánto vale lo que está en juego.
    kpis: [
      { label: "Pacientes activos",    value: { type: "total" },
        sub: { type: "count", stage: "Nuevo contacto", suffix: "sin contactar" },
        icon: "Users",        color: "blue" },
      { label: "Citas por atender",    value: { type: "count", stage: "Cita agendada" },
        sub: { type: "count", stage: "Consulta realizada", suffix: "ya valorados" },
        icon: "CalendarDays", color: "cyan" },
      { label: "Presupuestos abiertos",value: { type: "count", stage: "Presupuesto enviado" },
        sub: { type: "count", stage: "Tratamiento en curso", suffix: "en tratamiento" },
        icon: "FileText",     color: "accent" },
      { label: "Valor en el embudo",   value: { type: "money" },
        sub: { type: "count", stage: "Paciente recurrente", suffix: "en control" },
        icon: "DollarSign",   color: "emerald" },
    ],
  },
};

export default clinicaDentalConfig;
