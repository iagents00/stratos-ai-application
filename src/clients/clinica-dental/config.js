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

    // ── DOS RECORRIDOS, NO UNO ───────────────────────────────────────────────
    // Una clínica tiene dos trabajos distintos y no conviene mezclarlos:
    //
    //   CAPTACIÓN   — del primer mensaje hasta que la persona VIENE. Lo trabaja
    //                 recepción: responder, entender qué necesita, ofrecer
    //                 horarios, confirmar y recordar. Se mide en citas.
    //   TRATAMIENTO — empieza DESPUÉS de la primera consulta. Lo trabaja el
    //                 odontólogo con recepción: estudios, plan, presupuesto,
    //                 decisión, sesiones y control. Se mide en tratamientos.
    //
    // Las 19 etapas viven en el MISMO campo del paciente (`leads.stage`): nadie
    // está en los dos a la vez, y el paso de uno a otro es "Cita realizada" →
    // "Consulta realizada". El tablero muestra un recorrido por vez, con
    // pestañas, porque 19 columnas juntas no se leen.
    //
    // ⚠️ CONTRATO CON EL CEREBRO: estos `name` son EXACTOS los strings que van a
    // `leads.stage`, y `dental_nlu_dispatch` los escribe tal cual al agendar,
    // marcar atendida, aceptar presupuesto o cerrar la última sesión. Si acá se
    // renombra una etapa, hay que renombrarla también en esa función o el
    // paciente desaparece de su columna.
    // Doce etapas, seis por tablero. La versión larga tenía diecinueve y la
    // mitad no eran etapas: "Servicio identificado" es un DATO (el servicio ya
    // se guarda en su campo), "Cita ofrecida" y "Tratamiento agendado" son
    // momentos de minutos donde nadie se queda, "Decisión pendiente" es lo
    // mismo que "Presupuesto enviado" visto desde el otro lado, y "Estudios
    // pendientes" o "Tratamiento definido" son una próxima acción, no una
    // columna. Una etapa se gana su lugar solo si alguien puede QUEDARSE ahí y
    // hay que ir a buscarlo. Con seis por tablero, además, entran todas en
    // pantalla sin scroll horizontal.
    // ── CÓMO SE ELIGIERON LOS NOMBRES ────────────────────────────────────────
    // Cada etapa se llama por la SITUACIÓN del paciente, en palabras que usaría
    // cualquiera en la recepción. Nada de vocabulario de CRM de ventas
    // ("Cerrado", "Perdido", "Captación", "Lead"): quien entra por primera vez
    // tiene que entender de un vistazo qué paciente va en cada columna y qué
    // hay que hacer con él, sin que nadie se lo explique.
    //
    // El nombre dice la situación Y sugiere la acción:
    //   "Sin contactar"          → hay que escribirle
    //   "Buscando cita"          → hay que ponerle día y hora
    //   "Cita sin confirmar"     → hay que llamar a confirmar
    //   "Pensando el presupuesto"→ hay que hacer seguimiento, sin presionar
    //   "Listo para empezar"     → hay que agendarle la primera sesión
    //   "Vuelve a control"       → hay que recordarle cuándo volver
    pipelines: [
      {
        id: "captacion",
        label: "Citas",
        hint: "Desde que preguntan hasta que vienen",
        stages: [
          { name: "Sin contactar",     color: "#94A3B8" }, // escribió, llamó o llenó un formulario; nadie le respondió aún
          { name: "Buscando cita",     color: "#38BDF8" }, // ya se habló; se está coordinando día y hora
          { name: "Cita sin confirmar",color: "#818CF8" }, // tiene día y hora, falta que diga que viene
          { name: "Cita confirmada",   color: "#22D3EE" }, // confirmó — es lo que anticipa los ausentismos
          { name: "Faltó a la cita",   color: "#FBBF24" }, // canceló o no vino; hay que recuperarlo
          { name: "No continuó",       color: "#F87171" }, // no sigue — SIEMPRE con el motivo anotado
        ],
        // Las cuatro tarjetas de arriba, contadas SOBRE ESTE recorrido. Son las
        // preguntas de la recepción: a cuánta gente le debo respuesta, cuántos
        // vienen, cuántos se me están cayendo.
        kpis: [
          { label: "Pacientes por atender", value: { type: "total" },
            sub: { type: "count", stage: "Sin contactar", suffix: "sin contactar" },
            icon: "Users",        color: "blue" },
          { label: "Sin día y hora",        value: { type: "count", stage: "Buscando cita" },
            sub: { type: "count", stage: "Sin contactar", suffix: "sin contactar" },
            icon: "Search",       color: "violet" },
          { label: "Citas por confirmar",   value: { type: "count", stage: "Cita sin confirmar" },
            sub: { type: "count", stage: "Cita confirmada", suffix: "ya confirmadas" },
            icon: "CalendarDays", color: "cyan" },
          { label: "Hay que recuperar",     value: { type: "count", stage: "Faltó a la cita" },
            sub: { type: "count", stage: "No continuó", suffix: "no continuaron" },
            icon: "Target",       color: "accent" },
        ],
      },
      {
        id: "tratamiento",
        label: "Tratamientos",
        hint: "Desde la primera consulta hasta el control",
        stages: [
          { name: "Ya vino a consulta",     color: "#38BDF8" }, // lo revisaron; falta pasarle el precio
          { name: "Pensando el presupuesto",color: "#FB923C" }, // tiene precio y condiciones; está decidiendo
          { name: "Listo para empezar",     color: "#22D3EE" }, // aceptó; falta agendar la primera sesión
          { name: "En tratamiento",         color: "#34D399" }, // en sesiones
          { name: "Tratamiento terminado",  color: "#4ADE80" }, // completó el servicio
          { name: "Vuelve a control",       color: "#10B981" }, // revisión o mantenimiento
        ],
        // Acá la pregunta es otra: cuánto dinero está esperando respuesta y
        // cuánta gente está en sesiones.
        kpis: [
          { label: "Pacientes en tratamiento", value: { type: "total" },
            sub: { type: "count", stage: "En tratamiento", suffix: "en sesiones" },
            icon: "Users",        color: "blue" },
          { label: "Presupuestos abiertos",    value: { type: "count", stage: "Pensando el presupuesto" },
            sub: { type: "count", stage: "Listo para empezar", suffix: "listos para empezar" },
            icon: "FileText",     color: "cyan" },
          { label: "Valor en el embudo",       value: { type: "money" },
            sub: { type: "count", stage: "En tratamiento", suffix: "en tratamiento" },
            icon: "DollarSign",   color: "emerald" },
          { label: "Vuelven a control",        value: { type: "count", stage: "Vuelve a control" },
            sub: { type: "count", stage: "Tratamiento terminado", suffix: "terminaron" },
            icon: "Trophy",       color: "accent" },
        ],
      },
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
        sub: { type: "count", stage: "Sin contactar", suffix: "sin contactar" },
        icon: "Users",        color: "blue" },
      { label: "Citas por atender",    value: { type: "count", stage: "Cita sin confirmar" },
        sub: { type: "count", stage: "Cita confirmada", suffix: "ya confirmadas" },
        icon: "CalendarDays", color: "cyan" },
      { label: "Presupuestos abiertos",value: { type: "count", stage: "Pensando el presupuesto" },
        sub: { type: "count", stage: "Listo para empezar", suffix: "listos para empezar" },
        icon: "FileText",     color: "accent" },
      { label: "Valor en el embudo",   value: { type: "money" },
        sub: { type: "count", stage: "En tratamiento", suffix: "en tratamiento" },
        icon: "DollarSign",   color: "emerald" },
    ],
  },
};

export default clinicaDentalConfig;
