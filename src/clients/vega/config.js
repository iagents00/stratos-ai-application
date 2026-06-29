/**
 * src/clients/vega/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del cliente CONSTRUCTORA VEGA (white-label del CRM Stratos).
 *
 * Vega es un tenant AISLADO, igual que Grupo 28 y TradeGenius: comparte el
 * código y el proyecto Supabase, pero sus datos viven bajo su propia
 * `organization_id` y se filtran por RLS. NUNCA ve datos de Stratos/Duke ni
 * los módulos internos de Stratos (Finanzas, RRHH, ERP, iAgents, Campañas) —
 * esos usan datos mock horneados en el bundle y filtrarían info de Stratos si
 * se prendieran.
 *
 * El aislamiento de módulos lo enforza `canAccessModule()` en navigation.js:
 * como la org de Vega NO es STRATOS_ORG_ID, automáticamente queda limitada a
 * CRM + Perfil + Papelera (+ Comando Directivo porque su config lo prende).
 * No hay que tocar el control de acceso ni nada de la operación de Stratos.
 *
 * Activación (mientras no haya dominio/subdominio propio):
 *   - localhost:5173/?app&client=vega          (dev / QA)
 *   - app.stratoscapitalgroup.com/vega         (prod, path-based)
 *   - vega.stratoscapitalgroup.com             (prod, subdomain — fase 2)
 *
 * USO PREVISTO (caso Constructora Vega):
 *   - El equipo de campo NO opera acá: carga actividad/evidencia/gastos por
 *     Telegram (flujos en n8n — NO se tocan). Esta web es el tablero de mando
 *     de Ricardo y Macarena para VER y GESTIONAR lo que entra.
 *   - CRM = pipeline de Obras / Licitaciones (cada registro es una obra).
 *   - Comando Directivo = pulso del equipo (indicadores por persona).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const vegaConfig = {
  id:        "vega",
  name:      "Constructora Vega",
  legalName: "Constructora Vega",
  tagline:   "Gestión de obra y licitaciones",

  // Renombra etiquetas del menú lateral por módulo (id de nav → texto). Para
  // Vega el CRM se presenta como "ERP" (gestión de obra). Default {}: usa el
  // label histórico de navigation.js. Solo afecta el texto, no el routing.
  navLabels: { c: "ERP" },

  brand: {
    logoText:                "Constructora Vega",
    // Hereda el menta del design system por ahora (el accent por cliente es un
    // cambio aparte y delicado — ver CLAUDE.md). Cuando definan color de marca,
    // se setea acá.
    accent:                  null,
    accentLight:             null,
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Constructora Vega",
  },

  tenant: {
    clientId:       "vega",
    // UUID de la org "Constructora Vega" en la tabla `organizations` del
    // Supabase principal (creada con supabase/setup_vega_tenant.mjs, jun-2026).
    // Con esto activo, ClientOrgGuard auto-redirige a los usuarios de Vega a
    // /vega tras el login. Sus datos quedan aislados por organization_id + RLS.
    organizationId: "065e12c5-56e2-440d-8f82-cd6c1ca612b7",
    // Comparte el proyecto Supabase de Duke/Grupo28/TGenius — aislamiento por
    // organization_id + RLS, no por proyecto separado.
    supabaseRef:    "glulgyhkrqpykxmujodb",
    // Bot de Telegram propio de Vega (sin @). Se usa para el @nombre en las
    // instrucciones y para el deep link t.me/<botUsername>.
    botUsername:    "ASISTENTE_CRM_VEGA_BOT",
    // Vega usa el flujo MANUAL: el equipo se conecta desde la app de Telegram
    // del celular (código + /conectar), sin depender de que el navegador tenga
    // sesión iniciada (el deep link a t.me/... abre Telegram web y fallaba).
    telegramManualPairing: true,
  },

  // Mismo set probado y aislado que Grupo 28 / TradeGenius. Los módulos internos
  // de Stratos quedan apagados (defensa en profundidad — además `canAccessModule`
  // ya los bloquea por no ser la org de Stratos).
  features: {
    crm:          true,    // Pipeline reusado como Obras / Licitaciones
    dash:         false,   // Dash de Stratos — Vega usa Comando Directivo
    erp:          false,   // datos mock de Stratos
    team:         false,   // datos mock de Stratos
    iacrm:        false,   // iAgents internos de Stratos
    landingPages: false,   // Campañas internas de Stratos
    finanzas:     false,   // datos mock de Stratos
    rrhh:         false,   // datos mock de Stratos
    trash:        true,    // Papelera del propio CRM
    comandoDirectivo: true, // Tablero de mando para Ricardo (org-scoped, seguro)
  },

  support: {
    email:    null,   // Pendiente: email de soporte de Constructora Vega
    whatsapp: null,   // Pendiente: WhatsApp (cae al de Stratos si queda null)
  },

  crm: {
    // Obras preseteadas en el dropdown "Nuevo registro". Vacío por ahora → la
    // lista se deriva de los registros que vayan cargando. Cuando tengan obras
    // fijas se listan acá.
    defaultProjects: [],
    // Pestaña "Indicadores" por persona, para Ricardo/Macarena (admins).
    advisorMetricsTab: true,
    // Discovery simplificado (patrón validado en Duke, Grupo 28 y TGenius).
    discoverySimplified: true,
    // Oculta el "Centro de Agentes IA" (agentes de venta de Stratos: reactivar,
    // seguimiento, callcenter, calificar). No aplica a obra. Default true = se ve.
    aiAgentsPanel: false,
    // Expediente como modal centrado casi-fullscreen (no drawer lateral).
    expedienteCentered: true,

    // ── Pipeline de OBRAS / LICITACIONES (solo Vega) ──────────────────────────
    // Pocas etapas, las esenciales, alineadas al flujo real que describió
    // Ricardo: detectar la licitación → analizar si conviene (pliego, costos,
    // vicios ocultos) → presentar la propuesta → ganar la adjudicación →
    // ejecutar la obra → finalizar. "Descartada" es el carril para las que no
    // convienen o no se adjudicaron.
    //
    // ⚠️ CONTRATO CON n8n: estos `name` son EXACTOS los strings que van a
    // leads.stage. El workflow de n8n que da de alta licitaciones debe escribir
    // "Detectada" (la primera etapa) al crear el registro. Para mover de etapa,
    // n8n (o el usuario en el CRM) setea leads.stage a uno de estos nombres
    // textuales. Si el string no coincide, el registro no aparece en ninguna
    // columna del kanban. NO se toca la lógica de n8n: solo se acuerda el texto.
    pipeline: [
      { name: "Detectada",    color: "#94A3B8" }, // licitación/obra detectada (entrada de n8n)
      { name: "En Análisis",  color: "#38BDF8" }, // evaluando si conviene (pliego + costos)
      { name: "Presentada",   color: "#FBBF24" }, // propuesta/oferta presentada, esperando resultado
      { name: "Adjudicada",   color: "#A78BFA" }, // ganada — nos dieron la obra
      { name: "En Ejecución", color: "#06B6D4" }, // obra en curso
      { name: "Finalizada",   color: "#34D399" }, // obra entregada
      { name: "Descartada",   color: "#F87171" }, // no conviene / no adjudicada
    ],

    // ── Vocabulario del CRM (solo Vega) ───────────────────────────────────────
    // Reemplaza "cliente" por "proyecto" en los textos visibles del CRM. Resuelto
    // por src/app/constants/labels.js (default = vocabulario de Duke). Las claves
    // que no se declaren acá heredan el texto de Duke.
    labels: {
      entity:                "proyecto",
      entityCap:             "Proyecto",
      entityPlural:          "proyectos",
      newEntity:             "Nuevo proyecto",
      priorityList:          "Proyectos en prioridad",
      emptyList:             "Sin proyectos",
      entityNamePlaceholder: "Nombre de la obra o licitación",
      entityProfile:         "Detalle del proyecto",
      deleteEntity:          "Eliminar proyecto (mover a papelera)",
      viewDetail:            "Ver detalle del proyecto",
      openProfile:           "Abrir detalle del proyecto",
      // Título del header: "Constructora Vega" (en vez de "CRM Asesores").
      pageTitle:             "Constructora",
      pageTitleAccent:       "Vega",
      pageTitleMobile:       "Constructora Vega",
      // El "Discovery" de Stratos acá es el "Expediente" de la obra.
      discoveryTab:          "Expediente",
      discoveryTabShort:     "Exped.",
    },

    // ── KPIs de arriba del CRM (solo Vega) ────────────────────────────────────
    // Reemplaza las 4 tarjetas de Stratos (Score, Zooms…) por métricas de obra.
    // El CRM las renderiza si `crm.kpis` es un array (default null → KPIs Duke).
    //   value/sub.type: "total" (cantidad de proyectos) · "count" (de una etapa)
    //                   · "money" (suma de presupuestos, en $M)
    //   icon: nombre de ícono lucide ya importado en el CRM
    //   color: clave de la paleta (blue · cyan · accent · emerald · violet)
    kpis: [
      { label: "Proyectos en pipeline", value: { type: "total" },
        sub: { type: "count", stage: "En Análisis", suffix: "en análisis" },
        icon: "Building2",  color: "blue" },
      { label: "En análisis",           value: { type: "count", stage: "En Análisis" },
        sub: { type: "count", stage: "Detectada", suffix: "detectadas" },
        icon: "Search",     color: "cyan" },
      { label: "Adjudicadas",           value: { type: "count", stage: "Adjudicada" },
        sub: { type: "count", stage: "En Ejecución", suffix: "en ejecución" },
        icon: "Trophy",     color: "accent" },
      { label: "Valor en juego",        value: { type: "money" },
        sub: { type: "count", stage: "Finalizada", suffix: "finalizadas" },
        icon: "DollarSign", color: "emerald" },
    ],
  },
};

export default vegaConfig;
