/**
 * src/clients/clinica-dental/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente CLÍNICA DENTAL — consultorio odontológico
 * (white-label del CRM Stratos).
 *
 * Qué es este tenant:
 *   Una clínica dental no maneja "leads inmobiliarios": maneja PACIENTES. Y su
 *   embudo real es distinto al de una venta — el paciente entra pidiendo informes,
 *   viene a una valoración, recibe un PLAN DE TRATAMIENTO con precio, lo acepta (o
 *   no), se trata durante semanas y después hay que traerlo de vuelta al control.
 *   Eso es lo que vive acá.
 *
 * ⭐ POR QUÉ ESTE PIPELINE ES ASÍ (esto sí está documentado, no es invento):
 *   [[portafolio-sistemas]] tiene a "clínicas y dentistas" como nicho top y dice
 *   exactamente dónde está el dinero en este rubro:
 *     · «confirmación de citas (reduce no-shows ~30%)»
 *     · «seguimiento post-consulta»
 *     · «recuperar pacientes inactivos»
 *   Las tres cosas están cableadas abajo: la etapa "Cita agendada" es la que
 *   dispara el recordatorio del día antes; "No asistió" es una etapa propia y
 *   visible (no un registro perdido); y "Alta / control" existe para que el
 *   paciente terminado no desaparezca, sino que vuelva a los 6 meses.
 *
 * ⚠️ NOMBRE PROVISIONAL: "Clínica Dental" es un placeholder — el nombre comercial
 *    real no se dijo. Cambiar el nombre visible después es trivial; cambiar la
 *    RUTA (/clinica-dental) rompe los links que ya se hayan repartido, así que
 *    conviene definirla antes de dar accesos.
 *
 * ⚠️ DE QUIÉN ES ESTA CLÍNICA — pregunta abierta:
 *    No es ninguna de las empresas del corporativo de [[plan-replicacion-corporativo]]
 *    (ahí están Duke/RRHH, Mueblería, Legacy Design y Brasa y Piedra). Lo que sí
 *    hay en el cerebro es que las clínicas dentales son el segmento de la "ruta
 *    médica" de prospección de NSG: 51 prospectos dentales en Mexicali, Tijuana y
 *    San Luis. Si esta clínica sale de ahí, es un CLIENTE (no una empresa interna)
 *    y entonces (a) la zona horaria correcta es America/Tijuana, no Cancun, y
 *    (b) hay que definir qué se le cobra — la decisión #2 del plan, todavía abierta.
 *
 * 🔒 ADVERTENCIA DE DATOS (leer antes de cargar pacientes):
 *    Esto es un CRM comercial, NO un expediente clínico. Sirve para el camino
 *    comercial del paciente (contacto → cita → presupuesto → tratamiento → control)
 *    y para eso está bien. NO está construido para historia clínica: no tiene
 *    bitácora de quién leyó qué, ni manejo de consentimiento, ni los resguardos que
 *    pide un dato de salud. El aislamiento entre clínicas sí está (organization_id
 *    + RLS, igual que el resto), pero eso es otra cosa.
 *    → Regla práctica para la clínica: en las notas va lo comercial (qué se le
 *      cotizó, qué dijo, cuándo volver a llamar). Diagnósticos, radiografías e
 *      historia clínica se quedan en el software dental de ellos.
 *
 * Aislamiento: comparte código y proyecto Supabase (glulgyhkrqpykxmujodb) pero sus
 * datos viven bajo su propia organization_id (6c5cf32a-…) + RLS. Como su org NO es
 * STRATOS_ORG_ID, canAccessModule() la limita automáticamente a CRM + Perfil +
 * Papelera (+ Comando y Caja porque esta config los prende). Los módulos internos
 * de Stratos (Finanzas/RRHH/ERP/iAgents/Campañas) quedan bloqueados — usan datos
 * mock horneados en el bundle. No se toca el control de acceso ni la operación de Duke.
 *
 * Activación:
 *   - localhost:5173/?app&client=clinica-dental     (dev / QA)
 *   - app.stratoscapitalgroup.com/clinica-dental    (prod, path-based)
 *   - clinica-dental.stratoscapitalgroup.com        (prod, subdomain — fase 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const clinicaDentalConfig = {
  id:        "clinica-dental",
  name:      "Clínica Dental",
  legalName: "Clínica Dental",
  tagline:   "Pacientes y tratamientos",

  // En el menú lateral el CRM no se llama "CRM": se llama "Pacientes". Es el
  // idioma del negocio, y el mecanismo ya existe (App.jsx lee navLabels[id]).
  navLabels: { c: "Pacientes" },

  brand: {
    logoText:                "Clínica Dental",
    appWordmark:             "Clínica Dental",
    // Cian clínico. ⚠️ Hoy `brand.accent` NO retematiza la app (el tema global
    // sigue en menta del design system); lo consume el tablero de Comando Ops.
    accent:                  "#22D3EE",
    accentLight:             "#67E8F9",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Clínica Dental",
    intelligenceCenterLabelMobile: "Clínica",
  },

  tenant: {
    clientId:       "clinica-dental",
    // UUID de la org "Clínica Dental" en `organizations` (migración 180).
    organizationId: "6c5cf32a-3db4-477d-bbed-26d90231bc9a",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Sin bot propio todavía. En una clínica el bot le sirve sobre todo a la
    // recepcionista/coordinadora de agenda: saber qué citas hay hoy, cuáles se
    // confirmaron y quién faltó, sin abrir el sistema. Receta en la skill
    // stratos-whitelabel-onboarding.
    botUsername:    "",
    telegramManualPairing: false,
  },

  features: {
    crm:              true,   // Reusado como seguimiento de Pacientes
    dash:             false,  // Dash de Stratos (mock)
    erp:              false,  // Catálogo inmobiliario de Duke (mock)
    team:             false,  // datos mock de Stratos
    iacrm:            false,  // iAgents internos de Stratos
    landingPages:     false,  // Campañas internas de Stratos
    finanzas:         false,  // datos mock de Stratos
    rrhh:             false,  // datos mock de Stratos
    trash:            true,   // Papelera del propio CRM
    comandoDirectivo: true,   // Tablero del dueño / director de la clínica
    // Caja: la clínica cobra en mostrador todos los días y compra insumos. El
    // libro de ingresos/egresos es de lo más aterrizado que se le puede dar.
    caja:             true,
    // Recepción también carga cobros y compras, no solo el dueño.
    cajaAsesores:     true,
    // Copilot APAGADO hasta que vinculen Telegram (el chat enruta por
    // telegram_chat_id). Se prende con copilotModule: true cuando conecten el bot.
    copilotModule:    false,
    // Chat del equipo (org-scoped, sin depender de n8n): recepción, doctores y
    // asistentes en un hilo, que hoy va por WhatsApp mezclado con lo personal.
    teamChat:         true,
    // Alta de usuarios propios (doctores, recepción) sin depender de nosotros.
    teamAdmin:        true,
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el propio
    whatsapp: null,
  },

  crm: {
    // Tipo de tratamiento, para etiquetar en el alta y poder filtrar después.
    // Ordenado de lo más frecuente a lo más especializado.
    defaultProjects: [
      "Limpieza / prevención",
      "Ortodoncia",
      "Implantes",
      "Endodoncia",
      "Prótesis / coronas",
      "Estética dental",
      "Odontopediatría",
      "Urgencia",
    ],
    // Métricas por persona: cuántos pacientes y cuánto tratamiento lleva cada
    // doctor. En una clínica con varios odontólogos esto es la mitad del valor.
    advisorMetricsTab: true,
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" de venta de Stratos (mock, inmobiliario).
    aiAgentsPanel: false,
    expedienteCentered: false,
    // El paciente es una persona real y el teléfono es LO importante (la cita se
    // confirma por WhatsApp) → NO projectMode.
    projectMode: false,
    // La etapa "Contactame Ya" del default global no existe en este pipeline:
    // en false, cada paciente conserva su etapa al reasignarlo de doctor.
    bulkReassignToContactameByDefault: false,

    // ── Pipeline de PACIENTES — solo Clínica Dental ───────────────────────────
    // El camino real de una clínica: alguien pregunta → se le da cita → viene a
    // valoración → se le presenta el plan con precio → lo acepta y se trata →
    // termina y pasa a control.
    //
    // Dos etapas que existen a propósito, porque son las que dan plata:
    //   · "Presupuesto" separada de "En tratamiento": el paciente que ya escuchó
    //     el precio y no contestó es EL pendiente más caro de una clínica. Verlo
    //     en su propia columna es lo que hace que alguien lo llame.
    //   · "No asistió" separada de todo: el no-show es un dato de negocio (a quién
    //     confirmarle sí o sí la próxima), no un paciente perdido. Y NO es etapa
    //     terminal en proactive_config — a propósito — para que el escáner de
    //     inactividad lo levante a los 7 días y alguien lo persiga. (En Brasa el
    //     no-show sí es terminal: la cena ya pasó. Acá el paciente se recupera.)
    //
    // ⚠️ CONTRATO CON n8n / con el asistente: estos `name` son los strings EXACTOS
    // que se guardan en leads.stage. Un flujo que dé de alta pacientes debe escribir
    // "Nuevo contacto" (primera etapa) o el registro no cae en ninguna columna.
    //
    // "Cita agendada" es la etapa de CITA del tenant: proactive_config
    // .zoom_stage_label = 'Cita agendada' → el asistente avisa el día antes
    // (24 h es el tope real del escáner; ver la migración 180).
    pipeline: [
      { name: "Nuevo contacto", color: "#94A3B8" }, // pidió informes
      { name: "Cita agendada",  color: "#38BDF8" }, // tiene fecha y hora
      { name: "Valoración",     color: "#A78BFA" }, // vino, se revisó, hay plan
      { name: "Presupuesto",    color: "#FBBF24" }, // ya sabe el precio, sin decidir
      { name: "En tratamiento", color: "#34D399" }, // aceptó, está en proceso
      { name: "Alta / control", color: "#22D3EE" }, // terminó → control a 6 meses
      { name: "No asistió",     color: "#FB923C" }, // no-show, hay que reagendar
      { name: "No aceptó",      color: "#F87171" }, // no tomó el tratamiento
    ],

    // ── Vocabulario del CRM — solo Clínica Dental ────────────────────────────
    labels: {
      entity:                "paciente",
      entityCap:             "Paciente",
      entityPlural:          "pacientes",
      newEntity:             "Nuevo paciente",
      priorityList:          "Pacientes en prioridad",
      emptyList:             "Sin pacientes",
      entityNamePlaceholder: "Nombre del paciente",
      // A propósito "Ficha" y NO "Expediente": expediente suena a historia
      // clínica y esto no lo es (ver la advertencia de datos arriba).
      entityProfile:         "Ficha del paciente",
      deleteEntity:          "Eliminar paciente (mover a papelera)",
      viewDetail:            "Ver ficha del paciente",
      openProfile:           "Abrir ficha del paciente",
      pageTitle:             "Pacientes",
      pageTitleAccent:       "Clínica Dental",
      pageTitleMobile:       "Pacientes",
      // La pestaña de detalle: qué tratamiento se le propuso, en cuántas
      // sesiones, cómo va a pagar, quién lo atiende.
      discoveryTab:          "Tratamiento",
      discoveryTabShort:     "Trat.",
    },

    // ── KPIs de arriba del CRM — solo Clínica Dental ─────────────────────────
    // Las cuatro cifras que un dueño de clínica sí mira: cuánta gente tiene en
    // curso, cuántas citas vienen, cuánto dinero está esperando un "sí", y
    // cuántos le faltaron.
    kpis: [
      { label: "Pacientes activos",  value: { type: "total" },
        sub: { type: "count", stage: "En tratamiento", suffix: "en tratamiento" },
        icon: "Users",        color: "blue" },
      { label: "Citas agendadas",    value: { type: "count", stage: "Cita agendada" },
        sub: { type: "count", stage: "Nuevo contacto", suffix: "por agendar" },
        icon: "CalendarDays", color: "cyan" },
      { label: "Presupuestos por cerrar", value: { type: "count", stage: "Presupuesto" },
        sub: { type: "count", stage: "No asistió", suffix: "faltaron a su cita" },
        icon: "FileText",     color: "accent" },
      { label: "Valor en tratamientos",   value: { type: "money" },
        sub: { type: "count", stage: "Alta / control", suffix: "en control" },
        icon: "DollarSign",   color: "emerald" },
    ],
  },
};

export default clinicaDentalConfig;
