/**
 * manual-content.js — Contenido estructurado del Manual del CRM
 *
 * Diseñado para 3 propósitos simultáneos:
 *   1. Renderizado en ManualCRM.jsx (UI para asesores).
 *   2. Búsqueda en cliente (cada sección tiene tags + summary indexables).
 *   3. Consumo futuro por un agente IA de soporte (estructura RAG-friendly).
 *
 * Cuando se conecte el agente IA, expondrá esta data vía:
 *   window.__STRATOS_MANUAL__ = MANUAL_SECTIONS
 *   GET /manual.json (estática, generada en build)
 *
 * Cada sección sigue el contrato:
 *   id        — slug único, usable como ancla URL (#agregar-cliente)
 *   category  — agrupador para sidebar
 *   icon      — nombre del icono Lucide React
 *   title     — pregunta o instrucción ("¿Cómo agregar un cliente?")
 *   summary   — 1 línea de descripción para búsqueda y previsualización
 *   tags      — keywords para matching en búsqueda y RAG
 *   content   — array de bloques estructurados:
 *               { type: 'p', text }              párrafo
 *               { type: 'steps', items }         lista numerada
 *               { type: 'list', items }          lista con bullets
 *               { type: 'tip', text }            callout informativo
 *               { type: 'warn', text }           callout de cuidado
 */

export const CATEGORIES = [
  { id: 'empezar',     label: 'Empezar',          icon: 'Sparkles' },
  { id: 'clientes',    label: 'Tus clientes',     icon: 'Users' },
  { id: 'pipeline',    label: 'Pipeline',         icon: 'Layers' },
  { id: 'seguimiento', label: 'Notas y tareas',   icon: 'FileText' },
  { id: 'equipo',      label: 'Equipo y roles',   icon: 'UsersRound' },
  { id: 'reportes',    label: 'Reportes',         icon: 'LineChart' },
  { id: 'integraciones', label: 'Telegram y bots', icon: 'MessageCircle' },
  { id: 'soporte',     label: 'Soporte y ayuda',  icon: 'LifeBuoy' },
];

export const MANUAL_SECTIONS = [
  /* ─── EMPEZAR ─── */
  {
    id: 'primer-acceso',
    category: 'empezar',
    icon: 'LogIn',
    title: '¿Cómo iniciar sesión por primera vez?',
    summary: 'Tu primer acceso al sistema con el correo y contraseña que te dio tu administrador.',
    tags: ['login', 'acceso', 'contraseña', 'iniciar sesión', 'primer día', 'entrar'],
    content: [
      { type: 'p', text: 'Tu administrador te creó una cuenta y te compartió un correo y una contraseña. Estos son los pasos para entrar la primera vez.' },
      { type: 'steps', items: [
        'Abre el navegador (Chrome, Safari, lo que prefieras).',
        'Ve a app.stratoscapitalgroup.com',
        'Escribe tu correo electrónico (el mismo que te compartió tu admin).',
        'Escribe la contraseña que te enviaron.',
        'Da clic en "Iniciar sesión →"',
      ]},
      { type: 'tip', text: 'Si te aparece "Servicio temporalmente lento", espera 30 segundos y vuelve a intentar. Es normal en el primer acceso del día.' },
      { type: 'p', text: 'Una vez adentro, te recomendamos cambiar la contraseña por una que solo tú sepas (mira la siguiente sección).' },
    ],
  },
  {
    id: 'instalar-app-celular',
    category: 'empezar',
    icon: 'Smartphone',
    title: 'Instalar Stratos como app en tu celular',
    summary: 'Deja Stratos con su ícono en la pantalla de inicio de tu celular, para abrirlo de un toque. Los pasos son distintos en Android y en iPhone.',
    tags: ['app', 'celular', 'móvil', 'instalar', 'apk', 'android', 'iphone', 'ios', 'descargar', 'pantalla de inicio', 'agregar a inicio', 'aplicacion', 'aplicación'],
    content: [
      { type: 'p', text: 'Podés usar Stratos como una app en tu celular, con su propio ícono en la pantalla de inicio. La forma de hacerlo depende de si tenés Android o iPhone.' },
      { type: 'p', text: '📱  Si tenés ANDROID (Samsung, Motorola, Xiaomi, etc.) → descargás la app:' },
      { type: 'steps', items: [
        'Abre este link en tu celular: github.com/iagents00/stratos-ai-application/releases/download/android-latest/stratos-ai.apk',
        'Toca "Descargar" y espera a que baje el archivo.',
        'Toca el archivo descargado (stratos-ai.apk) para abrirlo.',
        'La primera vez, el celular pide un permiso para "instalar apps de orígenes desconocidos": actívalo y toca "Instalar".',
        'Abre la app "Stratos CRM AI" y entra con tu correo y contraseña.',
      ]},
      { type: 'tip', text: 'La app de Android siempre trae lo más nuevo (carga el sistema en vivo). Si te pasan una versión nueva, se instala encima sin desinstalar nada.' },
      { type: 'p', text: '🍎  Si tenés iPHONE → no se descarga nada; agregás la página a la pantalla de inicio:' },
      { type: 'steps', items: [
        'Abre Safari (el navegador de Apple, el ícono de la brújula azul). Importante: tiene que ser Safari, no Chrome.',
        'Entra a app.stratoscapitalgroup.com',
        'Abajo en el centro de la pantalla, toca el botón Compartir (un cuadrito con una flecha apuntando hacia arriba).',
        'Desliza hacia abajo en el menú y toca "Agregar a inicio" (en inglés: "Add to Home Screen").',
        'Arriba a la derecha, toca "Agregar".',
        'Listo: ya tenés el ícono de Stratos en tu pantalla de inicio. Tócalo y se abre como una app.',
      ]},
      { type: 'warn', text: 'En iPhone el botón "Agregar a inicio" solo aparece en Safari. Si usás Chrome, no vas a ver esa opción.' },
    ],
  },
  {
    id: 'cambiar-contrasena',
    category: 'empezar',
    icon: 'KeyRound',
    title: '¿Cómo cambio mi contraseña?',
    summary: 'Cambiar la contraseña que te dio el admin por una propia.',
    tags: ['contraseña', 'cambiar', 'recuperar', 'olvidé contraseña', 'reset'],
    content: [
      { type: 'p', text: 'Si quieres cambiar la contraseña que te dieron por una nueva tuya:' },
      { type: 'steps', items: [
        'En la pantalla de login, da clic en "¿Olvidaste tu contraseña?"',
        'Escribe tu correo y da clic en "Enviar enlace de recuperación →"',
        'Revisa tu correo. Te llega un email con un link.',
        'Da clic en el link y elige tu nueva contraseña.',
      ]},
      { type: 'warn', text: 'El link expira en 24 horas. Si se vence, repite el proceso desde cero.' },
      { type: 'tip', text: 'Si no llega el correo, revisa la carpeta de spam o promociones.' },
    ],
  },
  {
    id: 'conocer-interfaz',
    category: 'empezar',
    icon: 'Layout',
    title: 'Conocer la interfaz del sistema',
    summary: 'Las partes principales de la pantalla y para qué sirve cada una.',
    tags: ['interfaz', 'pantalla', 'menú', 'navegación', 'sidebar'],
    content: [
      { type: 'p', text: 'Cuando entras al sistema, ves 4 áreas principales:' },
      { type: 'list', items: [
        'Sidebar izquierdo: el menú con todos los módulos (Dashboard, CRM, etc.)',
        'Header superior: tu nombre, notificaciones, configuración.',
        'Área central: aquí se carga el módulo que abriste.',
        'Dynamic Island: la barra inferior con accesos rápidos a chat e IA.',
      ]},
      { type: 'tip', text: 'Hoy la entrega oficial es solamente el módulo CRM. Los demás módulos del menú están en construcción y se van a entregar en próximas fases.' },
    ],
  },
  {
    id: 'centro-inteligencia',
    category: 'empezar',
    icon: 'Sparkles',
    title: 'El Centro de Inteligencia (la barra que brilla arriba)',
    summary: 'El panel de arriba que te muestra tus clientes prioritarios reales y todo lo que el sistema puede hacer por vos.',
    tags: ['centro de inteligencia', 'dynamic island', 'notificaciones', 'prioridad', 'funciones', 'que puede hacer'],
    content: [
      { type: 'p', text: 'Arriba en el centro, la barra que dice "Centro de Inteligencia" (con un punto verde que brilla) es tu resumen inteligente. Tocala y se abre un panel con dos cosas:' },
      { type: 'list', items: [
        'Tus novedades reales: tu cliente más caliente, los que están por enfriarse, tu día (Zooms y clientes nuevos por contactar) y tu pipeline.',
        'Qué puede hacer el sistema: un carrusel con todas las funciones del asistente (registrar por voz, agendar Zoom, buscar ficha, reactivar dormidos…). Tocá cualquiera y te explica cómo se usa y desde dónde.',
      ]},
      { type: 'tip', text: 'En cada novedad de un cliente, el botón "Ver en el CRM" te abre justo el expediente de ESE cliente.' },
    ],
  },
  {
    id: 'app-movil',
    category: 'empezar',
    icon: 'Smartphone',
    title: 'Usá Stratos desde tu celular (la app)',
    summary: 'Además del navegador, hay una app instalable en el celular con todo el CRM.',
    tags: ['app', 'movil', 'celular', 'android', 'apk', 'instalar', 'aplicacion', 'telefono'],
    content: [
      { type: 'p', text: 'Ya podés usar Stratos como una app en tu celular (Android), no solo desde el navegador. Está pensada para el teléfono: menú abajo con íconos grandes y un botón "+" central con todas las herramientas.' },
      { type: 'steps', items: [
        'Pedile a tu administrador el link de descarga (te llega por Telegram cuando hay versión nueva).',
        'Descargá e instalá el archivo (Android te pide permitir "instalar apps de esta fuente" — es normal).',
        'Abrila e iniciá sesión con tu mismo correo y contraseña del CRM.',
      ]},
      { type: 'tip', text: 'La app siempre está al día: cuando mejoramos el CRM, los cambios te llegan solos, sin reinstalar nada.' },
      { type: 'p', text: 'La versión para iPhone está lista y se habilita pronto.' },
    ],
  },

  /* ─── CLIENTES ─── */
  {
    id: 'agregar-cliente-manual',
    category: 'clientes',
    icon: 'UserPlus',
    title: '¿Cómo agregar un cliente nuevo manualmente?',
    summary: 'Capturar un lead que llegó por una vía no automática (llamada, evento, recomendación).',
    tags: ['agregar', 'crear', 'cliente', 'lead', 'nuevo', 'manual', 'captura'],
    content: [
      { type: 'p', text: 'Para registrar un cliente que te llegó fuera del sistema (ej: te llamó, lo conociste en un evento, te lo recomendaron):' },
      { type: 'steps', items: [
        'Entra al módulo CRM desde el sidebar.',
        'Da clic en el botón "Agregar Cliente" (arriba a la derecha).',
        'Llena los campos: Nombre, Teléfono, Email, Presupuesto, Proyecto de interés.',
        'Selecciona la etapa inicial (normalmente "Contáctame Ya" o "Segundo Intento").',
        'Si tú lo vas a atender, asegúrate de que tu nombre esté en "Asesor".',
        'Da clic en "Guardar".',
      ]},
      { type: 'tip', text: 'El cliente aparece de inmediato en el pipeline. No tienes que refrescar la página.' },
    ],
  },
  {
    id: 'buscar-cliente',
    category: 'clientes',
    icon: 'Search',
    title: '¿Cómo busco un cliente específico?',
    summary: 'Encontrar rápido un cliente por nombre, teléfono o cualquier dato.',
    tags: ['buscar', 'encontrar', 'filtrar', 'cliente'],
    content: [
      { type: 'p', text: 'En el módulo CRM hay una barra de búsqueda arriba. Funciona así:' },
      { type: 'steps', items: [
        'Da clic en la barra que dice "Buscar cliente..."',
        'Empieza a escribir cualquier dato del cliente (nombre, parte del teléfono, email).',
        'La lista se filtra mientras escribes.',
        'Da clic en el cliente para ver su expediente completo.',
      ]},
      { type: 'tip', text: 'También puedes filtrar por etapa o por asesor usando los filtros del lado izquierdo.' },
    ],
  },
  {
    id: 'ver-expediente-cliente',
    category: 'clientes',
    icon: 'FileSearch',
    title: 'Ver el expediente completo de un cliente',
    summary: 'Toda la historia, notas y movimientos de un cliente en un solo lugar.',
    tags: ['expediente', 'detalle', 'historial', 'cliente', 'perfil'],
    content: [
      { type: 'p', text: 'Cuando das clic en un cliente, se abre un panel lateral con su información completa:' },
      { type: 'list', items: [
        'Análisis IA: qué tan probable es que cierre, qué riesgos tiene.',
        'Perfil: datos básicos, presupuesto, proyecto de interés.',
        'Expediente: notas, historial de cambios, próximas acciones, tareas.',
      ]},
      { type: 'p', text: 'Puedes navegar entre las 3 vistas con los tabs de arriba del panel.' },
    ],
  },

  /* ─── PIPELINE ─── */
  {
    id: 'mover-etapa-pipeline',
    category: 'pipeline',
    icon: 'MoveRight',
    title: '¿Cómo muevo a un cliente entre etapas?',
    summary: 'Avanzar un cliente en el pipeline (de Segundo Intento a Seguimiento, por ejemplo).',
    tags: ['pipeline', 'etapa', 'mover', 'cambiar', 'arrastrar'],
    content: [
      { type: 'p', text: 'Hay dos formas de cambiar la etapa de un cliente:' },
      { type: 'p', text: 'Forma 1 — Arrastrar y soltar (la más rápida):' },
      { type: 'steps', items: [
        'Dejá presionada la tarjeta del cliente con el mouse.',
        'Arrastrala a la columna de la etapa que quieras (Seguimiento, Apartó, Cierre, etc.).',
        'Suelta el botón.',
      ]},
      { type: 'p', text: 'Forma 2 — Desde el detalle del cliente:' },
      { type: 'steps', items: [
        'Da clic en el cliente para abrir su panel.',
        'En el menú de etapas, selecciona la nueva.',
        'Se guarda automáticamente.',
      ]},
      { type: 'tip', text: 'Cada movimiento queda registrado en el historial. Si te equivocaste, regresá la tarjeta a la etapa correcta — no se pierde nada.' },
    ],
  },
  {
    id: 'etapas-pipeline-significado',
    category: 'pipeline',
    icon: 'Workflow',
    title: '¿Qué significa cada etapa del pipeline?',
    summary: 'Pipeline Duke del Caribe: 12 etapas oficiales — Contáctame Ya, Segundo/Tercer Intento, Rotación, Remarketing IA, Zoom, Seguimiento, Apartó, Visita, Cierre, Postventa.',
    tags: ['pipeline', 'etapas', 'estados', 'significado', 'embudo'],
    content: [
      { type: 'p', text: 'El pipeline oficial Duke del Caribe tiene 12 etapas. Cada una describe el estado real del cliente y la siguiente acción obligatoria del asesor:' },
      { type: 'list', items: [
        'Contáctame Ya: lead nuevo o urgente. Contacto inmediato (< 1h). No puede acumular.',
        'Segundo Intento: ya marcaste una vez sin respuesta — segunda llamada.',
        'Tercer Intento: tercera llamada. Si no contesta, pasa a Rotación.',
        'Rotación: Emanuel reasigna a otro asesor. Es segunda oportunidad, no abandono.',
        'Remarketing IA: leads fríos o no listos. La IA nutre con publicidad y contenido automatizado.',
        'Zoom Agendado: ya hay discovery completo y cita confirmada con fecha y hora.',
        'Reactivar Zoom: el cliente NO se conectó al Zoom — recuperar confianza y reagendar.',
        'Seguimiento: Zoom concretado, envío de proyectos, corridas financieras, opciones, negociación. Toda la fase activa post-Zoom vive acá.',
        'Apartó: el cliente envió dinero al desarrollador para reservar la propiedad.',
        'Visita Agendada: el cliente ya envió fechas o vuelos para visitar Riviera Maya.',
        'Cierre: el cliente pagó Down Payment. No se llega antes del pago.',
        'Postventa: Lili da seguimiento formal de avances de obra, comprobantes y estados de cuenta.',
      ]},
      { type: 'tip', text: 'Regla crítica: Contáctame Ya nunca puede tener un lead más de 1 hora sin contacto. Cierre exige Down Payment pagado — apartado no es cierre.' },
    ],
  },

  /* ─── SEGUIMIENTO ─── */
  {
    id: 'agregar-nota-cliente',
    category: 'seguimiento',
    icon: 'NotebookPen',
    title: '¿Cómo agrego una nota a un cliente?',
    summary: 'Documentar una llamada, conversación o información importante del cliente.',
    tags: ['nota', 'comentario', 'historial', 'documentar', 'agregar'],
    content: [
      { type: 'steps', items: [
        'Abre el cliente dando clic en su tarjeta.',
        'Ve al tab "Expediente".',
        'En la sección "Notas", escribe lo que quieras agregar.',
        'Las notas se guardan automáticamente al hacer clic fuera del cuadro.',
      ]},
      { type: 'tip', text: 'Recomendamos agregar nota después de cada interacción con el cliente. Así, si otra persona toma el caso, sabe exactamente dónde quedó.' },
    ],
  },
  {
    id: 'asignar-tarea',
    category: 'seguimiento',
    icon: 'CheckSquare',
    title: '¿Cómo asigno una tarea o próxima acción?',
    summary: 'Programar el siguiente paso con un cliente para que no se te olvide.',
    tags: ['tarea', 'próxima acción', 'recordatorio', 'pendiente', 'agendar'],
    content: [
      { type: 'p', text: 'Cada cliente puede tener una "próxima acción" definida — la siguiente cosa que vas a hacer con él.' },
      { type: 'steps', items: [
        'Abre el cliente.',
        'En la sección "Próxima acción", escribe qué vas a hacer (ej: "Llamar el lunes a las 3pm").',
        'En "Fecha", indica cuándo (ej: "Hoy", "Esta semana", "15 de mayo").',
        'Guarda.',
      ]},
      { type: 'p', text: 'En el dashboard verás un resumen de todas las próximas acciones del día.' },
    ],
  },
  {
    id: 'historial-cambios',
    category: 'seguimiento',
    icon: 'History',
    title: 'Ver el historial completo de un cliente',
    summary: 'Todos los cambios, etapas y movimientos en orden cronológico.',
    tags: ['historial', 'cambios', 'auditoría', 'movimientos', 'timeline'],
    content: [
      { type: 'p', text: 'Cada vez que se cambia algo en un cliente (etapa, asesor, datos), queda registrado en su historial.' },
      { type: 'steps', items: [
        'Abre el cliente.',
        'Ve al tab "Expediente".',
        'Baja a la sección "Historial de acciones".',
        'Verás cada movimiento con fecha, hora y quién lo hizo.',
      ]},
      { type: 'tip', text: 'Esto es muy útil cuando quieres saber "¿quién cambió esto?" o "¿qué pasó la semana pasada con este cliente?".' },
    ],
  },

  /* ─── EQUIPO ─── */
  {
    id: 'asignar-cliente-otro-asesor',
    category: 'equipo',
    icon: 'UserCheck',
    title: '¿Cómo le paso un cliente a otro asesor?',
    summary: 'Reasignar un cliente para que otra persona del equipo lo atienda.',
    tags: ['asignar', 'reasignar', 'pasar', 'transferir', 'asesor'],
    content: [
      { type: 'p', text: 'Si tu compañero va a tomar el caso (porque viajas, porque domina mejor el proyecto, etc.):' },
      { type: 'steps', items: [
        'Abre el cliente.',
        'En el campo "Asesor", elige el nuevo nombre.',
        'Guarda.',
      ]},
      { type: 'p', text: 'El otro asesor verá el cliente en su lista de inmediato. El historial completo y todas las notas viajan con él.' },
      { type: 'warn', text: 'Esta acción puede estar restringida a directores y administradores. Si no aparece la opción, pregúntale a tu director.' },
    ],
  },
  {
    id: 'roles-permisos',
    category: 'equipo',
    icon: 'ShieldUser',
    title: 'Roles y permisos del equipo',
    summary: 'Qué puede hacer cada rol: super_admin, admin, ceo, director, asesor.',
    tags: ['roles', 'permisos', 'admin', 'director', 'asesor', 'jerarquía'],
    content: [
      { type: 'p', text: 'El sistema tiene varios roles, cada uno con su nivel de acceso:' },
      { type: 'list', items: [
        'Super Admin: ve y modifica todo. Solo el dueño del sistema.',
        'Admin: gestiona usuarios y configuración general. Ve todos los leads.',
        'CEO: ve dashboards completos y todo el pipeline. Lectura completa.',
        'Director: ve los leads de su equipo y el pipeline de sus asesores.',
        'Asesor: ve y trabaja solo con sus leads asignados.',
      ]},
      { type: 'tip', text: 'Si necesitas más permisos, pídelos a tu admin o director.' },
    ],
  },

  /* ─── REPORTES ─── */
  {
    id: 'ver-dashboard',
    category: 'reportes',
    icon: 'LayoutDashboard',
    title: 'Tu dashboard del día',
    summary: 'Ver cuántos leads tienes, cuántos están calientes, cuáles necesitan atención.',
    tags: ['dashboard', 'reportes', 'kpi', 'métricas', 'resumen'],
    content: [
      { type: 'p', text: 'En el módulo CRM, arriba del pipeline ves un resumen con tus números:' },
      { type: 'list', items: [
        'Total de leads activos.',
        'Cuántos están en cada etapa.',
        'Leads "calientes" (alta probabilidad de cerrar).',
        'Leads inactivos (sin movimiento en X días).',
      ]},
      { type: 'p', text: 'Puedes filtrar por rango de fechas para ver cómo va el mes vs el anterior.' },
    ],
  },

  /* ─── INTEGRACIONES ─── */
  {
    id: 'conectar-telegram',
    category: 'integraciones',
    icon: 'Send',
    title: 'Conectar tu cuenta a Telegram',
    summary: 'Recibir alertas y registrar leads desde tu Telegram personal.',
    tags: ['telegram', 'bot', 'conectar', 'alertas', 'notificaciones'],
    content: [
      { type: 'p', text: 'El sistema tiene un bot de Telegram que te avisa cuando hay un lead caliente y te permite registrar conversaciones.' },
      { type: 'steps', items: [
        'En la app, ve a tu Perfil (clic en tu nombre arriba a la derecha).',
        'Busca la sección "Conexiones".',
        'Da clic en "Conectar Telegram".',
        'Sigue las instrucciones (te dará un código que pegas en el chat con el bot).',
      ]},
      { type: 'tip', text: 'Una vez conectado, el bot te manda alertas en tu chat privado. No te pierde una notificación importante.' },
    ],
  },
  {
    id: 'copilot-asistente',
    category: 'integraciones',
    icon: 'Bot',
    title: 'El asistente dentro del CRM (Copilot)',
    summary: 'El mismo asistente del bot de Telegram, pero adentro del CRM. Escribile como en un chat y hace todo por vos, sin abrir Telegram.',
    tags: ['copilot', 'asistente', 'chat', 'ia', 'bot', 'crm', 'recomendar', 'catalogo', 'drive'],
    content: [
      { type: 'p', text: 'En el menú del CRM tenés la pestaña "Copilot": es el MISMO asistente inteligente del bot de Telegram, pero embebido en el sistema. Le escribís (o le mandás un audio) en lenguaje normal y opera tus clientes al instante. Ideal si no querés usar Telegram: hace exactamente lo mismo.' },
      { type: 'list', items: [
        'Consultá: "mis clientes", "mi agenda de hoy", "mis KPIs", "el pipeline".',
        'Buscá y trabajá un cliente: "la ficha de Carlos", "pasá a Juan a Zoom Agendado".',
        'Catálogo con filtro real: "propiedades en Cancún de menos de 200 mil", "en Tulum de más de 1 millón" — con su link de Drive.',
        'Recomendaciones: "¿qué le recomiendo al cliente Pepito?" → mira su presupuesto y zona y te propone lo que encaja, con el porqué.',
        'Si sos admin: "clientes de Gael en segunda etapa", "los últimos 2 leads de Cecilia".',
      ]},
      { type: 'tip', text: 'La primera vez, si te lo pide, conectá tu Telegram (mismo paso de arriba) para que el asistente sepa quién sos y te muestre TUS clientes. Después le hablás directo desde el CRM.' },
    ],
  },

  /* ─── SOPORTE ─── */
  {
    id: 'pedir-ayuda',
    category: 'soporte',
    icon: 'HelpCircle',
    title: '¿Cómo pido ayuda?',
    summary: 'Canales para resolver dudas o reportar problemas.',
    tags: ['ayuda', 'soporte', 'duda', 'problema', 'contacto'],
    content: [
      { type: 'p', text: 'Si algo no funciona o tienes una duda:' },
      { type: 'list', items: [
        'WhatsApp directo: la forma más rápida. Te respondemos en menos de 24h hábiles.',
        'Correo: info@stratoscapitalgroup.com. Para temas con archivos adjuntos.',
        'Pregúntale a tu admin o director: a veces es algo que ellos pueden resolver al instante.',
      ]},
      { type: 'tip', text: 'Cuando reportes un problema, ayuda muchísimo si nos mandas: 1) qué intentabas hacer, 2) qué pasó, 3) una captura de pantalla del error.' },
    ],
  },
  {
    id: 'que-hacer-si-no-funciona',
    category: 'soporte',
    icon: 'AlertCircle',
    title: 'Qué hacer si el sistema no carga o no funciona',
    summary: 'Pasos básicos antes de reportar un problema.',
    tags: ['error', 'no funciona', 'no carga', 'lento', 'problema', 'falla'],
    content: [
      { type: 'p', text: 'Antes de reportar, prueba estos pasos:' },
      { type: 'steps', items: [
        'Refresca la página (Ctrl+R en Windows / Cmd+R en Mac).',
        'Cierra sesión y vuelve a entrar.',
        'Borra la caché del navegador (Ctrl+Shift+R / Cmd+Shift+R).',
        'Prueba en otra pestaña en modo incógnito.',
        'Si nada funciona, manda WhatsApp con captura del error.',
      ]},
      { type: 'tip', text: 'Si tienes mala conexión a internet, el sistema entra en "modo offline" y guarda tus cambios localmente. Cuando vuelve la conexión, se sincronizan solos.' },
    ],
  },
];

/**
 * Helper: búsqueda simple por texto. Match contra title, summary, tags y category.
 * Devuelve secciones ordenadas por relevancia (más matches primero).
 */
export function searchManual(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return MANUAL_SECTIONS;
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = MANUAL_SECTIONS.map(s => {
    const haystack = [
      s.title,
      s.summary,
      s.category,
      ...(s.tags || []),
    ].join(' ').toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1;
      if (s.title.toLowerCase().includes(t)) score += 2;
      if ((s.tags || []).some(tag => tag.toLowerCase() === t)) score += 3;
    }
    return { section: s, score };
  });
  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.section);
}

/**
 * Expone el manual en window para que un agente IA embebido pueda consumirlo
 * desde el contexto del DOM en futuras versiones.
 */
export function exposeManualToWindow() {
  if (typeof window !== 'undefined') {
    window.__STRATOS_MANUAL__ = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      categories: CATEGORIES,
      sections: MANUAL_SECTIONS,
      search: searchManual,
    };
  }
}
