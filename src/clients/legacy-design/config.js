/**
 * src/clients/legacy-design/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente LEGACY DESIGN — firma de arquitectura y desarrollo
 * inmobiliario (white-label del CRM Stratos).
 *
 * Qué es este tenant:
 *   La cuarta empresa del corporativo de Duke: diseña y construye casas (Tulum
 *   Country, Amares Riviera). El CRM se reusa como su CONTROL DE PROYECTOS: cada
 *   registro es una CASA, con su cliente, su modelo de negocio y en qué punto de
 *   la construcción va. Es el pariente cercano de Constructora Vega (obra), pero
 *   acá el trabajo arranca en el DISEÑO, no en la licitación.
 *
 * ⚠️ Por qué NO es un clon de Duke aunque suene "inmobiliario": Duke vende
 *    unidades de un catálogo (embudo de venta, zooms, cierre). Legacy ENTREGA
 *    casas. Mismo motor, pipeline y vocabulario distintos — y datos separados.
 *
 * ⚠️⚠️ LEER ANTES DE CONSTRUIRLE MÁS (importante, no es un detalle):
 *   1. Esta config es el ESQUELETO del tenant (marca, vocabulario, tablero), no
 *      el módulo de Control de Proyectos completo. **Alex pidió expresamente
 *      dejar Legacy para el final** («yo esto lo pondría a posterior… primero el
 *      CRM sin fallas, luego actividades, luego tareas, y de ahí Legacy/NSG») y
 *      **pidió una reunión previa** para revisar qué falta y qué sobra.
 *      Construir el módulo sin esa reunión es ir contra la prioridad del cliente.
 *   2. Lo que su hoja tiene y ACÁ TODAVÍA NO: campo **CONSTRUCTOR** (distinto de
 *      arquitecto — Alex lo detectó en vivo), **Ubicación/Lote**, **Arquitecto**,
 *      adjuntos de **Pagos / comprobantes**, y el **enlace a Drive** por casa,
 *      que es el corazón del expediente (bitácoras, contratos, licencias,
 *      pólizas, reportes fotográficos). Hoy eso se puede pegar en el expediente
 *      del proyecto, pero no son campos propios todavía.
 *   3. **Permisos que pidió Alex y que hoy NO están enforced**: solo **Shadai** y
 *      **Mario Coria** editan; toda la dirección (Alex incluido) es SOLO LECTURA.
 *      El CRM aún no tiene ese rol de "lectura por módulo" — hay que resolverlo
 *      antes de darles acceso, o se lo damos a editar a quien pidió no tenerlo.
 *   4. **Alex NO quiere avisos para Legacy** (los quiere para su equipo de
 *      marketing). Por eso el motor proactivo queda apagado (ver migración 184).
 *   Detalle completo: nota [[legacy-design-control-proyectos]] del AIOS.
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

  // En el menú lateral el CRM se llama "Proyectos": es la palabra que ellos ya
  // usan en su propia hoja ("Control de Proyectos"), no una que les inventamos.
  navLabels: { c: "Proyectos" },

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
    // UUID de la org "Legacy Design" en `organizations` (migración 184).
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
    // Chat del equipo (org-scoped, sin dependencias externas): el hilo entre
    // Shadai, Mario y la dirección, donde hoy va por WhatsApp.
    teamChat:         true,
    // Alta de usuarios propios (arquitectos, constructores) sin depender de nosotros.
    teamAdmin:        true,
  },

  support: {
    email:    null,   // cae al soporte de Stratos hasta definir el propio
    whatsapp: null,
  },

  crm: {
    // El "MODELO" de su hoja real: NO es el modelo de casa, es el modelo de
    // NEGOCIO del cliente. Son los tres valores que usan hoy.
    // (Corregido con la hoja real el 29-jul; ver [[legacy-design-control-proyectos]].)
    defaultProjects: [
      "Venta",
      "Retiro",
      "Renta vacacional",
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

    // ── Pipeline = el ESTADO de su hoja real — solo Legacy Design ─────────────
    // ⚠️ ESTA ES LA DECISIÓN IMPORTANTE DE ESTE TENANT, y va contra el instinto:
    // NO se inventa un kanban de etapas de obra (consulta → anteproyecto →
    // ejecutivo → obra…). Su hoja de Control de Proyectos ya tiene DOS campos
    // distintos y hay que respetar la diferencia:
    //
    //   · "PROCESO" → TEXTO LIBRE, una frase propia por casa ("Colocación de
    //     tapial, inicio de cimientos", "Licencias de tala y desmonte"). Volverlo
    //     columnas fijas PIERDE información — está advertido explícitamente en
    //     [[legacy-design-control-proyectos]] §2.1. Ese texto vive en la
    //     "Próxima acción" / el expediente del proyecto, NO en la etapa.
    //   · "ESTADO"  → catálogo corto y real de 3 valores. ESE es el kanban.
    //
    // Se agrega "Entregada" porque su hoja tiene "Fecha de finalización" y sin un
    // estado final las casas terminadas se quedarían para siempre en "En curso".
    // Los colores son LOS SUYOS (amarillo=en curso, rojo=pendiente, morado=no
    // iniciada), para que la pantalla se lea igual que la hoja que ya conocen.
    //
    // El catálogo real de etapas de obra solo puede salir de sentarse con Shadai
    // (dueña de la hoja). Hasta entonces, esto respeta su dato tal cual.
    //
    // ⚠️ CONTRATO CON n8n / con el asistente: estos `name` son los strings EXACTOS
    // que se guardan en leads.stage. Un flujo que dé de alta proyectos debe
    // escribir "No iniciada" (primera etapa) o el registro no cae en ninguna columna.
    pipeline: [
      { name: "No iniciada", color: "#A78BFA" }, // morado en su hoja — "Por definir"
      { name: "Pendiente",   color: "#F87171" }, // rojo — esperando algo (terreno, contrato, reunión)
      { name: "En curso",    color: "#FBBF24" }, // amarillo — avanzando (proyecto, licencias, obra)
      { name: "Entregada",   color: "#34D399" }, // terminada y entregada al cliente
    ],

    // ── Vocabulario del CRM — solo Legacy Design ─────────────────────────────
    labels: {
      entity:                "proyecto",
      entityCap:             "Proyecto",
      entityPlural:          "proyectos",
      newEntity:             "Nuevo proyecto",
      priorityList:          "Proyectos en prioridad",
      emptyList:             "Sin proyectos",
      // En su hoja solo 3 de 11 proyectos tienen nombre: el nombre NACE cuando el
      // proyecto arranca (los demás van como "S/N"). Por eso el placeholder acepta
      // las dos formas.
      entityNamePlaceholder: "Casa … o el cliente (si aún no tiene nombre)",
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
      // Quien lleva la casa. En su hoja real aparecen el constructor y el arquitecto;
      // hasta que el CRM tenga esos campos, es un único responsable.
      advisor:               "responsable",
      advisorCap:            "Responsable",
      advisorPlural:         "responsables",
    },

    // ── KPIs de arriba del CRM — solo Legacy Design ──────────────────────────
    // Responden la pregunta con la que Alex justificó la hoja: "¿cuándo se
    // entrega Casa Ágata?" → cuántas casas hay, cuántas avanzan, cuántas están
    // trabadas esperando algo, y cuántas ya se entregaron.
    kpis: [
      { label: "Casas en cartera", value: { type: "total" },
        sub: { type: "count", stage: "En curso", suffix: "en curso" },
        icon: "Building2",  color: "blue" },
      { label: "En curso",         value: { type: "count", stage: "En curso" },
        sub: { type: "count", stage: "No iniciada", suffix: "sin iniciar" },
        icon: "Target",     color: "cyan" },
      { label: "Pendientes",       value: { type: "count", stage: "Pendiente" },
        sub: { type: "count", stage: "No iniciada", suffix: "no iniciadas" },
        icon: "FileText",   color: "accent" },
      { label: "Entregadas",       value: { type: "count", stage: "Entregada" },
        sub: { type: "total", suffix: "en cartera" },
        icon: "Trophy",     color: "emerald" },
    ],
  },
};

export default legacyDesignConfig;
