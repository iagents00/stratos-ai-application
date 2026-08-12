/**
 * src/clients/gasil/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant GASIL RADIODIAGNÓSTICO DEL VALLE — centro de imagen
 * y radiodiagnóstico en Poblado Guadalupe Victoria, Valle de Mexicali (km 43).
 *
 * Es el segundo tenant de salud, y es distinto de la Clínica Dental: acá no hay
 * tratamientos de meses, hay ESTUDIOS que se hacen en una visita. El ciclo real
 * es: alguien pregunta por Facebook → se le informa → viene → se le hace el
 * estudio → el radiólogo lo interpreta → se le entregan resultados. Y la mitad
 * del volumen no llega sola: la mandan médicos de la zona, que por eso tienen
 * su propio tablero.
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG). Nada de las funciones de ventas de Duke.
 *   - Pipeline espejo EXACTO de `org_stages` en stratos-prod (15 filas).
 *   - Cerebro propio en `org_brain_docs`, aislado por RLS.
 *
 * ⚠️ REGLA PROPIA DE ESTE TENANT: es un centro médico. El asistente NO inventa
 * preparaciones de estudios ni precios. Lo que no está cargado en su cerebro se
 * responde «déjame confirmarlo» y se pasa al personal. Una preparación mal dicha
 * hace que el paciente venga en ayunas sin necesidad, o que llegue sin ayuno y
 * pierda el viaje.
 *
 * Activación: app.stratoscapitalgroup.com/gasil (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const gasilConfig = {
  id:        "gasil",
  name:      "Gasil Radiodiagnóstico del Valle",
  legalName: "Gasil Radiodiagnóstico del Valle",
  tagline:   "Cada estudio, de la primera pregunta a los resultados",

  // El CRM acá no es un CRM: es la lista de pacientes del centro.
  navLabels: {
    c:   "Pacientes",
    mkt: "Actividades",
  },

  brand: {
    logoText:     "Gasil",
    appWordmark:  "Gasil",
    // Magenta del logo (la G de GASIL). Deliberadamente distinto del menta de
    // Duke (#6EE7C2), del azul de la Clínica Dental (#38BDF8) y del rosa claro
    // de NSG (#F472B6): Gasil tiene que sentir que este sistema es SUYO y no el
    // de otra empresa prestado.
    accent:      "#D6249F",
    accentLight: "#F472D0",
    favicon:     "/favicon.ico",
    intelligenceCenterLabel:       "Centro de Inteligencia · Gasil",
    intelligenceCenterLabelMobile: "Gasil",
  },

  tenant: {
    clientId:       "gasil",
    // Org «Gasil Radiodiagnóstico del Valle» en `organizations` (stratos-prod).
    organizationId: "72e827f9-4d40-4197-bde6-3e4359f09591",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot de Telegram por ahora: el asistente vive dentro de la app.
    botUsername:           "",
    telegramManualPairing: false,
    // El «¿qué puedes hacer?» PROPIO de Gasil (telegram.js lo responde al
    // instante, antes de cualquier webhook). Sin esto caería al texto de NSG o
    // al manual inmobiliario. Lenguaje de recepción de un centro de imagen.
    copilotHelp:
      "Esto es lo que puedo hacer por ti en Gasil:\n\n" +
      "• Anotar al vuelo: «ponme una tarea: llamar mañana a las 10 a los pacientes que no se presentaron»\n" +
      "• Repartir el trabajo: «que recepción entregue los resultados del señor López el jueves» (le llega el aviso y el sistema lo persigue)\n" +
      "• Tu día: «¿qué tengo hoy?» o «¿qué pendientes tiene el equipo?»\n" +
      "• Recordatorios que suenan: «recuérdame en 2 horas mandar los resultados de la señora Martínez»\n" +
      "• Lo que sabe tu centro: pregúntame qué estudios hacemos, qué preparación lleva un ultrasonido, quién firma las interpretaciones o por el manual\n\n" +
      "Todo por texto o por voz. Los avisos llegan 1 hora y 10 minutos antes, solo en tu jornada.\n\n" +
      "Una cosa que no hago a propósito: no invento precios ni preparaciones de estudios. Si algo no lo tengo cargado, te lo digo y lo confirmas con el personal.",
  },

  // Módulos del molde EQUIPO (patrón NSG/Legacy) con el CRM encendido: acá sí
  // hay tablero, porque un paciente y un médico se persiguen. Lo demás son
  // módulos internos de Stratos con datos de ejemplo horneados en el bundle:
  // prendidos filtrarían información de otra empresa.
  features: {
    crm:              true,   // Los dos tableros: pacientes y médicos
    dash:             false,
    erp:              false,
    team:             false,
    iacrm:            false,
    landingPages:     false,
    finanzas:         false,
    rrhh:             false,
    trash:            true,
    comandoDirectivo: true,   // Tablero propio, org-scoped
    comandoOps:       true,   // Operación (pacientes/equipo/caja), sin embudo de leads
    // La caja resuelve el dolor número dos del dueño: hoy va personalmente al
    // valle cada semana a recoger el efectivo, sin ver el movimiento del día.
    caja:             true,
    cajaAsesores:     false,
    cajaCobro:        false,  // La facturación es de NSG, no de un centro de imagen
    whatsappChat:     false,
    whatsappModule:   false,
    zoomControl:      false,  // No hay Zooms en un centro de imagen
    // Copilot con el cerebro de TAREAS org-scoped (molde madre NSG) en modo
    // puente (fn_org_copilot_responder). El cerebro definitivo llega al clonar
    // el flujo copilot-nsg (n8n, sesión local): ver punto 15 de la skill.
    copilotModule:    true,
    copilotBrain:     "tareas",
    mktModule:        true,   // El motor de tareas — acá se llama ACTIVIDADES
    teamAdmin:        true,   // Alta del equipo desde CRM → Usuarios
    teamChat:         false,
  },

  // El motor reusado: un centro de imagen no produce videos ni recibe pedidos
  // de diseño. Sin esto le aparecería la hoja de propiedades de Duke.
  mkt: {
    hideTabs:  ["pipeline", "solicitudes"],
    tabLabels: { marcas: "Áreas" },
  },

  // Portada de la pantalla de acceso. Sin esto se hereda la de Stratos, que
  // habla de IA comercial y de millones en transacciones inmobiliarias: el
  // negocio de otra empresa, y es lo primero que ve cualquiera que entre.
  login: {
    heroTop: "El centro de imagen",
    heroBot: "sin un mensaje sin contestar",
    sub: [
      "Pacientes · Estudios · Resultados · Médicos que refieren",
      "Todo en un solo lugar, y un asistente que lo escribe por ti.",
    ],
    stats: [
      ["0",    "Mensajes sin responder"],
      ["100%", "De los estudios, seguidos hasta la entrega"],
      ["24/7", "Asistente que responde"],
    ],
  },

  support: {
    // Teléfono público del centro (su página oficial). Correo y WhatsApp de
    // soporte: pendientes de que Gasil los defina.
    email:      null,
    whatsapp:   null,
    phoneLabel: "658 516 2568",
  },

  // ── Centro de Inteligencia PROPIO ──────────────────────────────────────────
  // Las funciones de ESTE negocio, sobre el molde NSG (tareas + agenda). Si acá
  // apareciera «Recomendar propiedades», el tenant está mal armado.
  // Las dos primeras salen textuales de lo que pidió el dueño en la reunión del
  // 15 de junio de 2026: los mensajes de Facebook sin contestar y distinguir el
  // tipo de ultrasonido para dar la preparación correcta.
  intelFeatures: [
    { id: "mensajes-frios", label: "Que ningún mensaje se enfríe", icon: "Bell", color: "#D6249F", kind: "pedis",
      chan: "En el CRM", where: "Módulo Pacientes, columna «Mensaje nuevo»",
      tagline: "Cada persona que escribe entra al tablero y se ve quién sigue sin respuesta.",
      how: ["Todo el que pregunta por Facebook o WhatsApp cae en «Mensaje nuevo».",
            "Se responde, se le informa y se mueve la tarjeta: nadie se queda del sábado al lunes."] },
    { id: "preparacion", label: "La preparación de cada estudio", icon: "Search", color: "#A78BFA", kind: "pedis",
      chan: "Copilot", where: "En el módulo Copilot",
      tagline: "Pregunta qué prepara un estudio y responde solo lo confirmado, nunca a la adivinanza.",
      how: ['"¿Qué preparación lleva el ultrasonido de hígado?" y te da el ayuno de 8 horas.',
            "Si de ese estudio no hay indicación cargada, lo dice y lo pasa al personal en vez de inventar."] },
    { id: "tablero-pacientes", label: "El tablero de pacientes", icon: "ClipboardList", color: "#22D3EE", kind: "pedis",
      chan: "En el CRM", where: "Módulo Pacientes",
      tagline: "De «Mensaje nuevo» a «Resultados entregados»: en qué va cada persona, sin preguntar.",
      how: ["Se abre y se mira: quién viene mañana, a quién le falta el estudio, a quién falta entregarle.",
            'También hablando: "¿cómo va la señora Martínez?"'] },
    { id: "medicos-refieren", label: "Los médicos que nos mandan", icon: "Users", color: "#34D399", kind: "pedis",
      chan: "En el CRM", where: "Módulo Pacientes, pestaña «Médicos»",
      tagline: "Quién nos manda pacientes, quién dejó de hacerlo y a quién hay que visitar.",
      how: ["La columna «Dejó de mandar» es la venta más barata que existe: ya confió una vez.",
            "Cuando alguien cae ahí, se le programa una visita o una llamada."] },
    { id: "tarea-voz", label: "Anotar por voz", icon: "Mic", color: "#F472D0", kind: "pedis",
      chan: "Copilot", where: "En el módulo Copilot",
      tagline: "Dicta un pendiente y queda en la agenda, sin formularios.",
      how: ['Abre el Copilot y dicta: "Ponme una tarea: llamar mañana a las 10 a los que no se presentaron".',
            "Queda en tu agenda y te avisa 1 hora y 10 minutos antes."] },
    { id: "asignar", label: "Repartir el trabajo", icon: "UserPlus", color: "#60A5FA", kind: "pedis",
      chan: "Copilot", where: "En el Copilot o en Mi Espacio → Equipo",
      tagline: "Asigna pendientes al equipo y el sistema los persigue por ti.",
      how: ['"Que recepción entregue los resultados del señor López el jueves."',
            "Le llega el aviso a la persona y el seguimiento lo hace el sistema."] },
    { id: "avisos", label: "Avisos sin perseguir a nadie", icon: "BellRing", color: "#FB923C", kind: "agente",
      chan: "Automático", where: "Solo dentro de la jornada del centro",
      tagline: "Vencimientos y pendientes avisan solos, agrupados, sin madrugadas.",
      how: ["Si una tarea vence, el responsable recibe el aviso en su jornada.",
            "Quien coordina recibe UN resumen, no veinte mensajes."] },
  ],

  crm: {
    // Estudios preseteados en el desplegable al registrar un paciente. Son los
    // ocho servicios de su página oficial, más los que el dueño mencionó en la
    // reunión (densitometría y los tipos de ultrasonido, que se cotizan y se
    // preparan distinto — por eso van separados y no como «ultrasonido»).
    defaultProjects: [
      "Ultrasonido",
      "Ultrasonido de hígado y vesícula",
      "Ultrasonido de embarazo",
      "Ultrasonido 3D / 4D",
      "Rayos X",
      "Rayos X dental (panorámica)",
      "Mamografía",
      "Densitometría",
      "Electrocardiograma",
      "Estudios especiales",
      "Biopsia (estudio intervencionista)",
      "Laboratorio (análisis clínicos)",
    ],
    advisorMetricsTab:   false,
    discoverySimplified: true,
    aiAgentsPanel:       false,
    expedienteCentered:  false,
    projectMode:         false,  // El paciente ES una persona: teléfono y datos visibles

    // ── DOS TABLEROS, NO UNO ─────────────────────────────────────────────────
    // Un centro de imagen tiene dos trabajos distintos y mezclarlos esconde el
    // segundo:
    //
    //   PACIENTES — del primer mensaje hasta que se le entregan los resultados.
    //               Lo trabaja recepción y el técnico. Se mide en estudios.
    //   MÉDICOS   — los doctores de la zona que mandan pacientes. Se consiguen
    //               visitando consultorios y se pierden en silencio. Se mide en
    //               pacientes referidos.
    //
    // ⚠️ ESPEJO EXACTO de `org_stages` (15 filas, orden 1-15) en stratos-prod.
    // Los `name` son los strings que van a `leads.stage`: si acá se renombra una
    // etapa hay que renombrarla también allá, o el registro desaparece de su
    // columna. `fn_org_stage` resuelve «la etapa 3» contra ESTAS etapas.
    //
    // ── CÓMO SE ELIGIERON LOS NOMBRES ────────────────────────────────────────
    // Cada etapa se llama por la SITUACIÓN de la persona, en palabras que usaría
    // cualquiera en la recepción, y sugiere la acción:
    //   "Mensaje nuevo"            → hay que contestarle
    //   "Preparación enviada"      → ya sabe si viene en ayunas
    //   "Esperando interpretación" → hay que apurar al radiólogo
    //   "Toca control"             → hay que llamarle, vuelve a facturar
    //   "Dejó de mandar"           → hay que ir a visitarlo
    pipelines: [
      {
        id: "pacientes",
        label: "Pacientes",
        hint: "Del primer mensaje hasta los resultados en la mano",
        labels: {
          entity:       "paciente",
          entityPlural: "pacientes",
          priorityList: "Pacientes en prioridad",
        },
        stages: [
          { name: "Mensaje nuevo",            color: "#94A3B8" }, // escribió por Facebook o WhatsApp; nadie le respondió aún
          { name: "Ya se le informó",         color: "#38BDF8" }, // sabe precio y qué incluye; falta ponerle día
          { name: "Cita agendada",            color: "#818CF8" }, // tiene día y hora
          { name: "Preparación enviada",      color: "#A78BFA" }, // sabe el ayuno, la orden médica y qué traer
          { name: "Estudio realizado",        color: "#22D3EE" }, // vino y se le hizo
          { name: "Esperando interpretación", color: "#FB923C" }, // el radiólogo lo está leyendo y firmando
          { name: "Resultados entregados",    color: "#4ADE80" }, // impresos o por la Aplicación Gasil
          { name: "Toca control",             color: "#10B981" }, // mamografía anual, seguimiento de embarazo
          { name: "No se presentó",           color: "#FBBF24" }, // no vino a su cita; hay que recuperarlo
          { name: "No agendó",                color: "#F87171" }, // preguntó y no siguió — SIEMPRE con el motivo anotado
        ],
        // Las preguntas de la recepción: a cuánta gente le debo respuesta,
        // cuántos vienen, y cuántos estudios están sin entregar.
        kpis: [
          { label: "Sin responder",       value: { type: "count", stage: "Mensaje nuevo" },
            sub: { type: "count", stage: "Ya se le informó", suffix: "ya informados" },
            icon: "Bell",         color: "accent" },
          { label: "Vienen a estudio",    value: { type: "count", stage: "Cita agendada" },
            sub: { type: "count", stage: "Preparación enviada", suffix: "con preparación enviada" },
            icon: "CalendarDays", color: "cyan" },
          { label: "Falta entregar",      value: { type: "count", stage: "Esperando interpretación" },
            sub: { type: "count", stage: "Estudio realizado", suffix: "estudios hechos" },
            icon: "FileText",     color: "violet" },
          { label: "Hay que recuperar",   value: { type: "count", stage: "No se presentó" },
            sub: { type: "count", stage: "Toca control", suffix: "tocan control" },
            icon: "Target",       color: "blue" },
        ],
      },
      {
        id: "medicos",
        label: "Médicos",
        hint: "Los doctores de la zona que nos mandan pacientes",
        labels: {
          entity:       "médico",
          entityPlural: "médicos",
          priorityList: "Médicos en prioridad",
        },
        stages: [
          { name: "Médico por visitar",     color: "#94A3B8" }, // consultorio de la zona al que no hemos ido
          { name: "Visita hecha",           color: "#818CF8" }, // ya se le dejó la hoja de servicios
          { name: "Ya nos mandó pacientes", color: "#22D3EE" }, // mandó al menos uno
          { name: "Nos manda seguido",      color: "#4ADE80" }, // es una fuente estable
          { name: "Dejó de mandar",         color: "#F87171" }, // se apagó — la venta más barata que existe
        ],
        kpis: [
          { label: "Médicos activos",   value: { type: "count", stage: "Nos manda seguido" },
            sub: { type: "count", stage: "Ya nos mandó pacientes", suffix: "mandaron alguna vez" },
            icon: "Users",     color: "emerald" },
          { label: "Por visitar",       value: { type: "count", stage: "Médico por visitar" },
            sub: { type: "count", stage: "Visita hecha", suffix: "ya visitados" },
            icon: "Search",    color: "blue" },
          { label: "Se apagaron",       value: { type: "count", stage: "Dejó de mandar" },
            sub: { type: "count", stage: "Nos manda seguido", suffix: "siguen activos" },
            icon: "Target",    color: "accent" },
          { label: "En el tablero",     value: { type: "total" },
            sub: { type: "count", stage: "Visita hecha", suffix: "visitados" },
            icon: "Trophy",    color: "cyan" },
        ],
      },
    ],

    // ── Vocabulario de Gasil ─────────────────────────────────────────────────
    // Punto 13 del protocolo: la jerga sigue a la empresa. Nada puede decir
    // «cliente», «lead», «asesor» ni «propiedad» en un centro de imagen.
    labels: {
      entity:                "paciente",
      entityCap:             "Paciente",
      entityPlural:          "pacientes",
      newEntity:             "Nuevo paciente",
      priorityList:          "Pacientes en prioridad",
      emptyList:             "Sin pacientes",
      entityNamePlaceholder: "Nombre del paciente",
      entityProfile:         "Expediente del paciente",
      deleteEntity:          "Quitar paciente (mover a papelera)",
      viewDetail:            "Ver expediente del paciente",
      openProfile:           "Abrir expediente del paciente",
      pageTitle:             "Pacientes",
      pageTitleAccent:       "",           // sin el «Asesores» de Duke al lado
      pageTitleMobile:       "Pacientes",
      discoveryTab:          "Expediente",
      discoveryTabShort:     "Exped.",
      // En un centro de imagen el recontacto es un SEGUIMIENTO del estudio, y
      // quien atiende no es un «asesor».
      followUpOne:           "seguimiento",
      followUpMany:          "seguimientos",
      followUpRegister:      "Registrar seguimiento",
      followUpRegisterShort: "Registrar",
      followUpColShort:      "Seguim.",
      noAdvisor:             "Sin responsable",
      advisorAll:            "Todo el equipo",
      relatedContacts:       "Contactos del paciente",
    },

    // KPIs generales (cuando no hay tablero seleccionado). Reemplazan las
    // tarjetas de Stratos (Score, Zooms, $ en pipeline) por lo que de verdad
    // mira un centro de imagen.
    kpis: [
      { label: "Sin responder",     value: { type: "count", stage: "Mensaje nuevo" },
        sub: { type: "count", stage: "Ya se le informó", suffix: "ya informados" },
        icon: "Bell",         color: "accent" },
      { label: "Vienen a estudio",  value: { type: "count", stage: "Cita agendada" },
        sub: { type: "count", stage: "Preparación enviada", suffix: "con preparación enviada" },
        icon: "CalendarDays", color: "cyan" },
      { label: "Falta entregar",    value: { type: "count", stage: "Esperando interpretación" },
        sub: { type: "count", stage: "Estudio realizado", suffix: "estudios hechos" },
        icon: "FileText",     color: "violet" },
      { label: "Tocan control",     value: { type: "count", stage: "Toca control" },
        sub: { type: "count", stage: "No se presentó", suffix: "no se presentaron" },
        icon: "Trophy",       color: "emerald" },
    ],
  },
};

export default gasilConfig;
