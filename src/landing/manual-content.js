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
 *   icon      — nombre del icono Lucide React (debe existir en ICON_MAP de ManualCRM.jsx)
 *   title     — pregunta o instrucción ("¿Cómo agregar un cliente?")
 *   summary   — 1 línea de descripción para búsqueda y previsualización
 *   tags      — keywords para matching en búsqueda y RAG
 *   content   — array de bloques estructurados:
 *               { type: 'p', text }              párrafo
 *               { type: 'steps', items }         lista numerada
 *               { type: 'list', items }          lista con bullets
 *               { type: 'tip', text }            callout informativo
 *               { type: 'warn', text }           callout de cuidado
 *               { type: 'flow', items }          pasos con título ({ n, title, text })
 *               { type: 'ex', items }            ejemplos de frases para el asistente
 *
 * ── Actualización 29-jul-2026 ────────────────────────────────────────────────
 * El manual cubría solo el CRM básico (8 categorías). Se amplió a TODO el
 * sistema: Copilot, WhatsApp, Mi Espacio y Documentos, Proyectos, Create, Caja,
 * Comando y Telegram (contenido traído de /manual-asistente-telegram, que sigue
 * existiendo aparte con el detalle completo).
 * Estilo: español neutro (sin voseo) — Duke es México.
 */

import { INTEL_FEATURES } from '../app/constants/intelFeatures';

export const CATEGORIES = [
  { id: 'empezar',     label: 'Empezar',            icon: 'Sparkles' },
  { id: 'funciones',   label: 'Todas las funciones', icon: 'Zap' },
  { id: 'clientes',    label: 'Tus clientes',       icon: 'Users' },
  { id: 'pipeline',    label: 'Pipeline',           icon: 'Layers' },
  { id: 'seguimiento', label: 'Notas y tareas',     icon: 'FileText' },
  { id: 'copilot',     label: 'Copilot',            icon: 'Bot' },
  { id: 'whatsapp',    label: 'WhatsApp',           icon: 'MessageCircle' },
  { id: 'espacio',     label: 'Mi Espacio',         icon: 'FolderOpen' },
  { id: 'proyectos',   label: 'Proyectos',          icon: 'Building2' },
  { id: 'create',      label: 'Create',             icon: 'Hexagon' },
  { id: 'caja',        label: 'Caja',               icon: 'Wallet' },
  { id: 'comando',     label: 'Comando',            icon: 'Activity' },
  { id: 'telegram',    label: 'Telegram',           icon: 'Send' },
  { id: 'equipo',      label: 'Equipo y roles',     icon: 'UsersRound' },
  { id: 'reportes',    label: 'Reportes',           icon: 'LineChart' },
  { id: 'soporte',     label: 'Soporte y ayuda',    icon: 'LifeBuoy' },
];


/* ── Las funciones del sistema, una por una ───────────────────────────────────
 * NO están escritas a mano: se generan de INTEL_FEATURES, la MISMA lista que
 * alimenta el Centro de Inteligencia dentro del sistema. Si mañana se agrega
 * una función allá, aparece acá sola. Copiarlas a mano garantizaba que en dos
 * semanas el manual dijera una cosa y la app otra.
 * ───────────────────────────────────────────────────────────────────────── */
const PEDIS  = INTEL_FEATURES.filter((f) => f.kind === 'pedis');
const AGENTE = INTEL_FEATURES.filter((f) => f.kind !== 'pedis');

const FICHAS_FUNCIONES = INTEL_FEATURES.map((f) => ({
  id: `fn-${f.id}`,
  category: 'funciones',
  icon: f.icon,
  title: f.label,
  summary: f.tagline,
  tags: [
    f.label.toLowerCase(),
    ...f.label.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 3),
    f.kind === 'pedis' ? 'se lo pides' : 'lo hace solo',
    'funcion', 'copilot',
  ],
  content: [
    { type: 'p', text: f.tagline },
    { type: 'p', text: f.kind === 'pedis'
        ? `Esto se lo pides tú. ${f.where}.`
        : `Esto lo hace el sistema solo, sin que nadie lo pida. ${f.where}.` },
    { type: 'steps', items: f.how },
    ...(f.kind === 'pedis'
      ? []
      : [{ type: 'tip', text: 'No hay que activarla ni acordarse de ella: corre sola en segundo plano.' }]),
  ],
}));

const INDICE_FUNCIONES = {
  id: 'fn-indice',
  category: 'funciones',
  icon: 'Zap',
  title: `Las ${INTEL_FEATURES.length} funciones del sistema, en una lista`,
  summary: `Todo lo que Stratos AI puede hacer hoy: ${PEDIS.length} cosas que le pides y ${AGENTE.length} que hace solo.`,
  tags: ['funciones', 'todo lo que puede hacer', 'capacidades', 'lista', 'indice', 'que puede hacer', 'para que sirve'],
  content: [
    { type: 'p', text: `Stratos AI tiene ${INTEL_FEATURES.length} funciones. ${PEDIS.length} se las pides tú —por escrito o por voz, desde el Copilot— y ${AGENTE.length} las hace el sistema solo, sin que nadie se acuerde de ellas.` },
    { type: 'p', text: 'Esta misma lista está dentro del sistema: toca el Centro de Inteligencia en la barra de arriba y ahí ves cada función con su mini-tutorial. Abajo está el detalle de cada una.' },
    { type: 'p', text: `LO QUE TÚ LE PIDES (${PEDIS.length})` },
    { type: 'list', items: PEDIS.map((f) => `${f.label} — ${f.tagline}`) },
    { type: 'p', text: `LO QUE HACE SOLO (${AGENTE.length})` },
    { type: 'list', items: AGENTE.map((f) => `${f.label} — ${f.tagline}`) },
    { type: 'tip', text: 'Casi todo se hace hablándole al Copilot con tus palabras. No hay comandos que memorizar: si lo dices como se lo dirías a un compañero, lo entiende.' },
  ],
};

export const MANUAL_SECTIONS = [
  /* ═══════════════════ EMPEZAR ═══════════════════ */
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
      { type: 'p', text: 'Puedes usar Stratos como una app en tu celular, con su propio ícono en la pantalla de inicio. La forma de hacerlo depende de si tienes Android o iPhone.' },
      { type: 'p', text: '📱  Si tienes ANDROID (Samsung, Motorola, Xiaomi, etc.) → descargas la app:' },
      { type: 'steps', items: [
        'Abre este link en tu celular: github.com/iagents00/stratos-ai-application/releases/download/android-latest/stratos-ai.apk',
        'Toca "Descargar" y espera a que baje el archivo.',
        'Toca el archivo descargado (stratos-ai.apk) para abrirlo.',
        'La primera vez, el celular pide un permiso para "instalar apps de orígenes desconocidos": actívalo y toca "Instalar".',
        'Abre la app "Stratos CRM AI" y entra con tu correo y contraseña.',
      ]},
      { type: 'tip', text: 'La app de Android siempre trae lo más nuevo (carga el sistema en vivo). Si te pasan una versión nueva, se instala encima sin desinstalar nada.' },
      { type: 'p', text: '🍎  Si tienes iPHONE → no se descarga nada; agregas la página a la pantalla de inicio:' },
      { type: 'steps', items: [
        'Abre Safari (el navegador de Apple, el ícono de la brújula azul). Importante: tiene que ser Safari, no Chrome.',
        'Entra a app.stratoscapitalgroup.com',
        'Abajo en el centro de la pantalla, toca el botón Compartir (un cuadrito con una flecha apuntando hacia arriba).',
        'Desliza hacia abajo en el menú y toca "Agregar a inicio" (en inglés: "Add to Home Screen").',
        'Arriba a la derecha, toca "Agregar".',
        'Listo: ya tienes el ícono de Stratos en tu pantalla de inicio. Tócalo y se abre como una app.',
      ]},
      { type: 'warn', text: 'En iPhone el botón "Agregar a inicio" solo aparece en Safari. Si usas Chrome, no vas a ver esa opción.' },
      { type: 'tip', text: 'Con la app instalada te pueden llegar las notificaciones al teléfono (Zooms, tareas, recordatorios) aunque tengas el sistema cerrado. Mira "Recibir notificaciones en el teléfono".' },
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
    id: 'mapa-modulos',
    category: 'empezar',
    icon: 'Layout',
    title: 'El mapa del sistema: qué es cada módulo',
    summary: 'Todos los módulos del menú explicados en una línea, para saber a dónde ir.',
    tags: ['modulos', 'menú', 'sidebar', 'navegación', 'mapa', 'secciones', 'que es cada cosa'],
    content: [
      { type: 'p', text: 'El menú de la izquierda tiene todos los módulos del sistema. No todos los ves: dependen de tu rol y de tu empresa. Este es el mapa completo:' },
      { type: 'list', items: [
        'CRM — tus clientes y el pipeline. Es donde trabajas todos los días.',
        'Copilot — tu asistente inteligente. Le hablas normal y opera por ti.',
        'WhatsApp — todas las conversaciones de WhatsApp de tus clientes en un solo lugar.',
        'Create — para armar landing pages y material de tus proyectos.',
        'Comando — el tablero de indicadores (leads, Zooms, productividad del equipo).',
        'Caja — el libro de ingresos y egresos de la organización.',
        'Proyectos — el catálogo de desarrollos, con sus fichas y sus Drives.',
        'iAgents — los agentes de inteligencia artificial del sistema.',
        'Papelera — los clientes eliminados, por si hay que recuperar alguno.',
        'Perfil — tus datos, tu contraseña y la conexión con Telegram.',
      ]},
      { type: 'tip', text: 'Si un módulo no aparece en tu menú, es porque tu rol no lo tiene habilitado o tu empresa no lo contrató. Pídeselo a tu admin.' },
      { type: 'p', text: 'Arriba a la derecha está "Mi Espacio": tu agenda personal, los documentos del equipo, el plan estratégico y el protocolo de ventas.' },
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
        'Sidebar izquierdo: el menú con todos los módulos (CRM, Copilot, WhatsApp, etc.).',
        'Header superior: tu nombre, las notificaciones (la campanita) y "Mi Espacio".',
        'Área central: aquí se carga el módulo que abriste.',
        'Centro de Inteligencia: la barra de arriba que te resume tu día y lo que necesita atención.',
      ]},
      { type: 'tip', text: 'En el celular el menú se ve abajo, con los módulos principales y un botón "Más" para el resto.' },
    ],
  },
  {
    id: 'centro-inteligencia',
    category: 'empezar',
    icon: 'Sparkles',
    title: 'El Centro de Inteligencia (la barra que brilla arriba)',
    summary: 'El panel de arriba que te muestra tus clientes prioritarios reales y todo lo que el sistema puede hacer por ti.',
    tags: ['centro de inteligencia', 'dynamic island', 'notificaciones', 'prioridad', 'funciones', 'que puede hacer'],
    content: [
      { type: 'p', text: 'Arriba en el centro, la barra que dice "Centro de Inteligencia" (con un punto verde que brilla) es tu resumen inteligente. Tócala y se abre un panel con dos cosas:' },
      { type: 'list', items: [
        'Tus novedades reales: tu cliente más caliente, los que están por enfriarse, tu día (Zooms y clientes nuevos por contactar) y tu pipeline.',
        'Qué puede hacer el sistema: un carrusel con todas las funciones del asistente (registrar por voz, agendar Zoom, buscar ficha, reactivar dormidos…). Toca cualquiera y te explica cómo se usa y desde dónde.',
      ]},
      { type: 'tip', text: 'En cada novedad de un cliente, el botón "Ver en el CRM" te abre justo el expediente de ESE cliente.' },
    ],
  },
  {
    id: 'notificaciones-telefono',
    category: 'empezar',
    icon: 'AlarmClock',
    title: 'Recibir notificaciones en el teléfono',
    summary: 'Que los avisos de Zoom, tareas y recordatorios te lleguen al celular aunque tengas el sistema cerrado.',
    tags: ['notificaciones', 'push', 'avisos', 'celular', 'alertas', 'activar notificaciones'],
    content: [
      { type: 'p', text: 'El sistema puede avisarte al teléfono como si fuera un mensaje de chat: tu Zoom de las 11, la tarea que vence, el cliente que se está enfriando.' },
      { type: 'steps', items: [
        'Instala Stratos como app en tu celular (mira "Instalar Stratos como app en tu celular").',
        'Abre el Copilot.',
        'Cuando aparezca el botón "Activar notificaciones", tócalo.',
        'El celular te pide permiso: acepta.',
      ]},
      { type: 'tip', text: 'Con esto no necesitas tener el sistema abierto. Si además conectas Telegram, los avisos también te llegan por ahí (es opcional).' },
    ],
  },

  /* ═══════════════════ CLIENTES ═══════════════════ */
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
      { type: 'tip', text: 'Más rápido todavía: díctaselo al Copilot. "Crea un cliente Ana Martínez 5551234567, presupuesto 300 mil, interesada en Tulum" y queda registrado. Mira la sección Copilot.' },
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
      { type: 'tip', text: 'También puedes filtrar por etapa, por asesor o por rango de fechas con los controles de arriba.' },
    ],
  },
  {
    id: 'ver-expediente-cliente',
    category: 'clientes',
    icon: 'FileSearch',
    title: 'El expediente completo de un cliente',
    summary: 'Toda la historia del cliente en un solo lugar: datos, notas, llamadas, WhatsApp, documentos y análisis.',
    tags: ['expediente', 'detalle', 'historial', 'cliente', 'perfil', 'ficha', 'panel'],
    content: [
      { type: 'p', text: 'Cuando das clic en un cliente se abre su expediente, que reúne absolutamente todo lo que se sabe de él:' },
      { type: 'list', items: [
        'Datos: nombre, teléfono, correo, presupuesto, proyecto de interés, etapa y asesor.',
        'Análisis IA: qué tan probable es que cierre y qué riesgos tiene.',
        'Próxima acción y lista de acciones: lo que sigue con este cliente.',
        'Notas: todo lo que se ha ido documentando, en orden de tiempo.',
        'Chat de WhatsApp: la conversación real con el cliente, sin salir del expediente.',
        'Llamadas: las llamadas de voz registradas, con su resultado.',
        'Discovery: las respuestas del perfilamiento (presupuesto, zona, recámaras, objetivo).',
        'Documentos: los archivos que subiste de ese cliente.',
        'Contactos relacionados: si el cliente tiene más de un teléfono o llegó por otro contacto.',
        'Historial: cada cambio, con fecha, hora y quién lo hizo.',
      ]},
      { type: 'tip', text: 'Navegas entre las vistas con los tabs de arriba del panel. Todo se guarda solo.' },
    ],
  },
  {
    id: 'llamar-cliente',
    category: 'clientes',
    icon: 'Phone',
    title: 'Llamar a un cliente desde el sistema',
    summary: 'El botón de llamada que marca al cliente y deja registro de la llamada.',
    tags: ['llamar', 'llamada', 'telefono', 'marcar', 'voz'],
    content: [
      { type: 'p', text: 'En la ficha del cliente hay un botón para llamarlo. Al usarlo, el sistema abre la llamada y deja registrado que lo contactaste — no tienes que anotarlo aparte.' },
      { type: 'tip', text: 'Después de la llamada, agrega una nota con lo que se habló. Es lo que hace que el expediente sirva de verdad si otra persona toma el caso.' },
    ],
  },
  {
    id: 'papelera-restaurar',
    category: 'clientes',
    icon: 'Trash2',
    title: 'Recuperar un cliente borrado (Papelera)',
    summary: 'Los clientes eliminados no se pierden: quedan en la Papelera y se pueden restaurar.',
    tags: ['papelera', 'borrar', 'eliminar', 'restaurar', 'recuperar', 'basura', 'trash'],
    content: [
      { type: 'p', text: 'Cuando eliminas un cliente NO desaparece: se va a la Papelera, con todo su historial. Desde ahí puedes traerlo de vuelta.' },
      { type: 'steps', items: [
        'Entra al módulo Papelera (está en "Más" si usas el celular).',
        'Busca al cliente en la lista.',
        'Toca "Restaurar" y vuelve al CRM tal como estaba.',
      ]},
      { type: 'warn', text: 'La opción "Eliminar definitivamente" borra el cliente de verdad y no se puede deshacer. Solo la tienen los administradores y pide doble confirmación.' },
    ],
  },

  /* ═══════════════════ PIPELINE ═══════════════════ */
  {
    id: 'mover-etapa-pipeline',
    category: 'pipeline',
    icon: 'MoveRight',
    title: '¿Cómo muevo a un cliente entre etapas?',
    summary: 'Avanzar un cliente en el pipeline (de Segundo Intento a Seguimiento, por ejemplo).',
    tags: ['pipeline', 'etapa', 'mover', 'cambiar', 'arrastrar'],
    content: [
      { type: 'p', text: 'Hay tres formas de cambiar la etapa de un cliente:' },
      { type: 'p', text: 'Forma 1 — Arrastrar y soltar (la más rápida):' },
      { type: 'steps', items: [
        'Deja presionada la tarjeta del cliente con el mouse.',
        'Arrástrala a la columna de la etapa que quieras (Seguimiento, Apartó, Cierre, etc.).',
        'Suelta el botón.',
      ]},
      { type: 'p', text: 'Forma 2 — Desde el expediente del cliente:' },
      { type: 'steps', items: [
        'Da clic en el cliente para abrir su panel.',
        'En el menú de etapas, selecciona la nueva.',
        'Se guarda automáticamente.',
      ]},
      { type: 'p', text: 'Forma 3 — Pídeselo al Copilot: "pasa a Juan Pérez a Zoom Agendado".' },
      { type: 'tip', text: 'Cada movimiento queda registrado en el historial. Si te equivocaste, regresa la tarjeta a la etapa correcta — no se pierde nada.' },
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

  /* ═══════════════════ SEGUIMIENTO ═══════════════════ */
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
      { type: 'tip', text: 'También puedes dictarla: "anota en Felipe que pidió ver más opciones en zona norte" y el Copilot la guarda en su expediente.' },
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
      { type: 'p', text: 'El sistema te recuerda esa acción antes de que venza — en el sistema, en el teléfono y, si lo conectaste, en Telegram.' },
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

  /* ═══════════════════ COPILOT ═══════════════════ */
  {
    id: 'copilot-que-es',
    category: 'copilot',
    icon: 'Bot',
    title: '¿Qué es el Copilot y por qué te conviene usarlo?',
    summary: 'El asistente inteligente dentro del CRM. Funciona con solo tu login — no hace falta Telegram ni nada más.',
    tags: ['copilot', 'asistente', 'chat', 'ia', 'bot', 'que es', 'sin telegram'],
    content: [
      { type: 'p', text: 'El Copilot es tu asistente dentro del sistema. Le escribes (o le mandas un audio) como si le hablaras a un compañero, y él opera tus clientes al instante: registra, actualiza, agenda, busca y te responde con datos reales.' },
      { type: 'p', text: 'Lo importante: funciona con solo tu usuario del CRM. No necesitas conectar Telegram ni salir del sistema. Todo el equipo lo puede usar desde ya.' },
      { type: 'list', items: [
        'Ya sabe quién eres por tu login: desde el primer mensaje te muestra TUS clientes.',
        'Todo lo que hablan queda guardado en el historial del Copilot.',
        'Es el mismo cerebro del asistente de Telegram — lo que funciona en uno funciona en el otro.',
      ]},
      { type: 'tip', text: 'Entra por la pestaña "Copilot" del menú. En el celular está en la barra de abajo.' },
    ],
  },
  {
    id: 'copilot-como-hablarle',
    category: 'copilot',
    icon: 'MessageCircle',
    title: '¿Cómo le hablo? (no hay menús ni comandos)',
    summary: 'Le hablas normal, como a una persona. No hay que aprenderse comandos.',
    tags: ['como hablar', 'comandos', 'lenguaje natural', 'escribir', 'menus'],
    content: [
      { type: 'p', text: 'No hay menús ni comandos que memorizar. Escribe como le hablarías a un compañero de trabajo. Si algo le falta, te lo pregunta.' },
      { type: 'ex', items: [
        '"¿cuáles son mis clientes?"',
        '"¿qué tengo hoy?"',
        '"¿cómo voy este mes?"',
        '"la ficha de Carlos Ramírez"',
      ]},
      { type: 'tip', text: 'Si no entiende algo, díselo con otras palabras. No se rompe nada por preguntarle mal.' },
    ],
  },
  {
    id: 'copilot-audios',
    category: 'copilot',
    icon: 'Mic',
    title: 'Mándale audios (no hace falta escribir)',
    summary: 'Le mandas una nota de voz y hace lo mismo que si lo hubieras escrito.',
    tags: ['audio', 'voz', 'nota de voz', 'grabar', 'dictar', 'hablar', 'manos libres'],
    content: [
      { type: 'p', text: 'Si vas manejando o saliendo de una cita, no escribas: mándale un audio. El Copilot lo transcribe y hace lo que le pediste.' },
      { type: 'p', text: 'Es la forma más rápida de registrar lo que acaba de pasar en una reunión, sin tener que sentarte a capturar.' },
      { type: 'ex', items: [
        '"Acabo de salir del Zoom con Mariana, le interesó la torre 2, agéndame seguimiento el jueves a las 10"',
      ]},
    ],
  },
  {
    id: 'copilot-consultar',
    category: 'copilot',
    icon: 'LineChart',
    title: 'Consultar tus clientes, tu agenda y tus números',
    summary: 'Pídele tu cartera, lo que tienes hoy, tus KPIs o tu pipeline.',
    tags: ['mis clientes', 'agenda', 'kpis', 'pipeline', 'consultar', 'numeros', 'cartera'],
    content: [
      { type: 'ex', items: [
        '"mis clientes" — tu cartera con etapa y próxima acción.',
        '"mi agenda" o "¿qué tengo hoy?" — tus próximas acciones ordenadas, con las vencidas primero.',
        '"mis KPIs" o "¿cómo voy?" — leads, calientes, pipeline, pendientes y vencidos.',
        '"el pipeline" — cuántos clientes tienes en cada etapa.',
      ]},
      { type: 'tip', text: 'Estas listas salen directo de la base de datos, no las inventa la IA. Lo que ves es exactamente lo que hay en tu CRM.' },
    ],
  },
  {
    id: 'copilot-registrar',
    category: 'copilot',
    icon: 'UserPlus',
    title: 'Registrar y actualizar clientes hablando',
    summary: 'Crear un cliente, anotar algo, cambiarlo de etapa o tomarlo para tu cartera — todo dictado.',
    tags: ['crear cliente', 'registrar', 'actualizar', 'anotar', 'cambiar etapa', 'asignar', 'tomar lead'],
    content: [
      { type: 'ex', items: [
        '"crea un cliente Ana Torres 5551234567, presupuesto 300 mil, interesada en Tulum"',
        '"anota en Felipe que pidió ver más opciones en zona norte"',
        '"pasa a Juan Pérez a Zoom Agendado"',
        '"pasa a Juan y asígnamelo a mí"',
      ]},
      { type: 'p', text: 'Si le falta un dato importante (el teléfono, la fecha), te lo pregunta antes de guardar. No inventa datos.' },
      { type: 'tip', text: 'También puedes registrar varios clientes de una sola vez: pásale la lista y los da de alta uno por uno.' },
    ],
  },
  {
    id: 'copilot-agendar',
    category: 'copilot',
    icon: 'AlarmClock',
    title: 'Agendar Zooms, visitas y recordatorios',
    summary: 'Le dices cuándo en palabras ("el jueves a las 3", "en 2 horas") y él lo agenda.',
    tags: ['agendar', 'zoom', 'visita', 'recordatorio', 'cita', 'fecha', 'hora'],
    content: [
      { type: 'ex', items: [
        '"agenda el Zoom de Carlos el viernes 11am"',
        '"agenda visita con Mariana el 15 a las 4pm"',
        '"recuérdame llamar a Luis en 2 horas"',
      ]},
      { type: 'p', text: 'Entiende las fechas en palabras: "mañana", "el jueves", "en 3 horas", "media hora", "15/08 10:00". Si dices solo un día sin hora, te pregunta la hora.' },
      { type: 'warn', text: 'La hora se interpreta en TU zona horaria (la de tu perfil). Si viajas y cambias de zona, avísale a tu admin para que la actualice — si no, las horas te van a caer corridas.' },
    ],
  },
  {
    id: 'copilot-catalogo',
    category: 'copilot',
    icon: 'Building2',
    title: 'Preguntarle por propiedades y pedir recomendaciones',
    summary: 'Buscar en el catálogo con filtros reales y que te proponga qué ofrecerle a un cliente puntual.',
    tags: ['catalogo', 'propiedades', 'proyectos', 'drive', 'recomendar', 'recomendacion', 'que le ofrezco'],
    content: [
      { type: 'p', text: 'El Copilot conoce el catálogo de desarrollos con sus precios, zonas y sus carpetas de Drive.' },
      { type: 'ex', items: [
        '"propiedades en Cancún de menos de 200 mil"',
        '"el drive de Tulum"',
        '"¿qué le recomiendo al cliente Pepito?"',
      ]},
      { type: 'p', text: 'Cuando le pides una recomendación para un cliente, mira su presupuesto y la zona que le interesa, y te propone lo que encaja — explicándote el porqué.' },
    ],
  },
  {
    id: 'copilot-avisos',
    category: 'copilot',
    icon: 'AlarmClock',
    title: 'Lo que el asistente hace solo (sin que le pidas nada)',
    summary: 'Los avisos automáticos: antes de tu Zoom, antes de tu próxima acción, y cuando un cliente se enfría.',
    tags: ['avisos', 'automatico', 'proactivo', 'recordatorio', 'alertas', 'solo', 'zoom', 'inactivo'],
    content: [
      { type: 'p', text: 'Además de responderte, el asistente trabaja solo. Estos avisos te llegan sin que hagas nada:' },
      { type: 'list', items: [
        'Antes de tu Zoom: un resumen del cliente para que llegues preparado, con horas de anticipación.',
        'Antes de tu próxima acción: te avisa con tiempo y otra vez cuando está por vencer.',
        'Recordatorio de tus visitas agendadas.',
        'Cliente sin movimiento: si un cliente lleva días sin contacto, te lo recuerda para que no se enfríe.',
      ]},
      { type: 'p', text: 'Cada aviso trae botones para resolverlo ahí mismo: marcar como hecha, posponer, reagendar o abrir la ficha del cliente.' },
      { type: 'tip', text: 'Si conectaste Telegram, estos avisos te llegan también por ahí. Y con la app instalada en el celular, como notificación al teléfono.' },
    ],
  },
  {
    id: 'copilot-admin',
    category: 'copilot',
    icon: 'ShieldUser',
    title: 'Lo extra que puedes pedirle si eres admin',
    summary: 'Ver la cartera de cualquier asesor, asignar clientes y crear acciones de equipo desde el chat.',
    tags: ['admin', 'director', 'ceo', 'equipo', 'asignar', 'acciones de equipo', 'cartera de'],
    content: [
      { type: 'p', text: 'Un asesor ve y trabaja solo con SUS clientes. Si tu rol es admin, director o CEO, el asistente te da más:' },
      { type: 'ex', items: [
        '"¿cuáles son los clientes de Gael en segunda etapa?"',
        '"los últimos 2 leads de Cecilia"',
        '"asigna el cliente Mariana a Araceli"',
        '"crea una acción de equipo para Carlos: enviar 3 proyectos al cliente, mañana 10am"',
      ]},
      { type: 'list', items: [
        'Ver los KPIs y el pipeline de TODO el equipo, no solo los tuyos.',
        'Asignar o reasignar clientes entre asesores.',
        'Crear acciones de equipo y asignarlas a quien corresponda (o a "Todos").',
        'Recibir las escalaciones: cuando un asesor no confirma su plan, te llega el aviso para apoyarlo.',
      ]},
      { type: 'tip', text: 'Si eres asesor y pides la cartera de otro, el asistente te avisa que solo puedes ver la tuya — los datos están protegidos por rol.' },
    ],
  },

  /* ═══════════════════ WHATSAPP ═══════════════════ */
  {
    id: 'whatsapp-bandeja',
    category: 'whatsapp',
    icon: 'MessageCircle',
    title: 'La bandeja de WhatsApp: todos los chats en un lugar',
    summary: 'Ver y responder las conversaciones de WhatsApp de tus clientes sin salir del CRM.',
    tags: ['whatsapp', 'chats', 'conversaciones', 'bandeja', 'mensajes', 'responder', 'no leidos'],
    content: [
      { type: 'p', text: 'El módulo WhatsApp reúne todas las conversaciones de tus clientes, ordenadas por el último mensaje. Sirve para enterarte al instante de que un cliente te escribió y responderle sin cambiar de app.' },
      { type: 'list', items: [
        'La lista muestra los chats con contador de mensajes NO leídos.',
        'Puedes filtrar por etapa del pipeline o dejar solo los no leídos.',
        'Al abrir un chat lo ves a pantalla completa, con el cuadro para escribir abajo.',
      ]},
      { type: 'tip', text: 'La conversación también aparece dentro del expediente del cliente, así que puedes responder desde donde te quede más cómodo.' },
      { type: 'p', text: 'Cada quien ve lo suyo: un asesor ve las conversaciones de SUS clientes; un admin ve todas las de la organización.' },
    ],
  },

  /* ═══════════════════ MI ESPACIO ═══════════════════ */
  {
    id: 'mi-espacio-que-es',
    category: 'espacio',
    icon: 'FolderOpen',
    title: 'Qué es "Mi Espacio"',
    summary: 'Tu panel personal: agenda propia, documentos del equipo, plan estratégico y protocolo de ventas.',
    tags: ['mi espacio', 'panel', 'agenda personal', 'documentos', 'plan', 'protocolo'],
    content: [
      { type: 'p', text: 'Arriba a la derecha, "Mi Espacio" abre tu panel personal. Tiene cuatro secciones:' },
      { type: 'list', items: [
        'Agenda: tus actividades personales y profesionales, con prioridad y fecha. Es tu lista de pendientes propia (distinta de las acciones de un cliente).',
        'Documentos: los documentos del equipo (mira la siguiente sección).',
        'Plan Estratégico: los objetivos y las metas del período.',
        'Protocolo de Ventas: cómo se vende acá — las etapas con su tiempo de respuesta y las preguntas de calificación.',
      ]},
      { type: 'tip', text: 'Si eres admin puedes ver además la agenda del equipo completo y asignar actividades a otras personas.' },
    ],
  },
  {
    id: 'documentos-equipo',
    category: 'espacio',
    icon: 'FileText',
    title: 'Documentos del Equipo',
    summary: 'Los documentos importantes del equipo, siempre en el mismo lugar y accesibles para todos.',
    tags: ['documentos', 'archivos', 'manual', 'informes', 'reportes', 'drive', 'word', 'pdf'],
    content: [
      { type: 'p', text: 'Dentro de Mi Espacio, la sección "Documentos del Equipo" guarda los documentos que se van generando: manuales, informes, planes, reportes.' },
      { type: 'p', text: 'La idea es simple: un documento que solo vive en el chat de alguien o en la carpeta de descargas de una computadora, para el equipo no existe. Acá siempre se puede encontrar.' },
      { type: 'list', items: [
        'Abre el documento con un clic — se ve en el navegador.',
        'Los que están en Drive se pueden abrir y editar directamente ahí.',
        'Cuando hay una versión nueva, se reemplaza la anterior — no se acumulan copias.',
      ]},
      { type: 'tip', text: 'Si generas un reporte o un informe desde el sistema, queda guardado acá automáticamente.' },
    ],
  },
  {
    id: 'protocolo-ventas',
    category: 'espacio',
    icon: 'Workflow',
    title: 'El Protocolo de Ventas',
    summary: 'Cómo se vende acá: cada etapa con su tiempo de respuesta y las preguntas de calificación.',
    tags: ['protocolo', 'ventas', 'proceso', 'sla', 'calificacion', 'preguntas', 'metodo'],
    content: [
      { type: 'p', text: 'En Mi Espacio → Protocolo de Ventas está el proceso completo: las 12 etapas del pipeline con el tiempo máximo de respuesta de cada una, y las preguntas que hay que hacerle a un cliente para calificarlo.' },
      { type: 'p', text: 'Las preguntas de calificación cubren cinco puntos: presupuesto, quién toma la decisión, qué busca (inversión o disfrute), en qué plazo, y si tiene capital o necesita financiamiento.' },
      { type: 'tip', text: 'Si tienes dudas de qué hacer con un cliente en cierta etapa, esta es la referencia oficial.' },
    ],
  },

  /* ═══════════════════ PROYECTOS ═══════════════════ */
  {
    id: 'proyectos-catalogo',
    category: 'proyectos',
    icon: 'Building2',
    title: 'El catálogo de proyectos y sus Drives',
    summary: 'Todos los desarrollos con su ficha, su ubicación, su rango de precio y su carpeta de material.',
    tags: ['proyectos', 'catalogo', 'desarrollos', 'propiedades', 'drive', 'material', 'fichas', 'erp'],
    content: [
      { type: 'p', text: 'El módulo Proyectos es el catálogo de desarrollos que vendemos. De cada uno tienes:' },
      { type: 'list', items: [
        'La ficha con sus datos y su descripción.',
        'La ubicación y la zona (Cancún, Tulum, Playa del Carmen…).',
        'El rango de precio (ticket), con un color para identificarlo rápido.',
        'El link a su carpeta de Drive con todo el material para enviarle al cliente.',
      ]},
      { type: 'p', text: 'Puedes buscar por nombre, filtrar por zona o por rango de precio, y verlo como tarjetas o como tabla.' },
      { type: 'tip', text: 'Si no quieres entrar al módulo, pídeselo al Copilot: "propiedades en Cancún de menos de 200 mil" o "el drive de Tulum".' },
    ],
  },

  /* ═══════════════════ CREATE ═══════════════════ */
  {
    id: 'create-landings',
    category: 'create',
    icon: 'Hexagon',
    title: 'Create: armar tus propias landing pages',
    summary: 'Generar páginas de presentación de proyectos para mandarle a un cliente o usar en campañas.',
    tags: ['create', 'landing', 'pagina', 'campañas', 'material', 'presentacion', 'portafolio'],
    content: [
      { type: 'p', text: 'El módulo Create sirve para armar landing pages de los proyectos: páginas de presentación que puedes compartir con un cliente o usar en una campaña.' },
      { type: 'p', text: 'Eliges el proyecto, el estilo y los datos de contacto, y el sistema arma la página. Después la puedes ver, copiar el link y compartirla.' },
      { type: 'tip', text: 'Está habilitado para todos los asesores: cada quien puede armar su propio material sin depender de nadie.' },
    ],
  },

  /* ═══════════════════ CAJA ═══════════════════ */
  {
    id: 'caja-que-es',
    category: 'caja',
    icon: 'Wallet',
    title: 'Caja: ingresos y egresos de la organización',
    summary: 'El libro de movimientos: lo que entra, lo que sale, por cuenta y por categoría.',
    tags: ['caja', 'gastos', 'ingresos', 'egresos', 'dinero', 'cuentas', 'finanzas', 'comprobante'],
    content: [
      { type: 'p', text: 'Caja es el libro de movimientos de la organización. Ahí se registra lo que entra y lo que sale, con su cuenta, su categoría, la obra a la que corresponde y la fecha.' },
      { type: 'steps', items: [
        'Entra al módulo Caja.',
        'Toca el botón para agregar un movimiento.',
        'Elige si es ingreso o egreso.',
        'Llena el monto, la cuenta, la categoría, la obra y la fecha.',
        'Si tienes el comprobante, adjúntalo.',
        'Guarda.',
      ]},
      { type: 'tip', text: 'Los gastos que el equipo registra por Telegram (escribiendo, por audio o mandando la foto del ticket) aparecen acá automáticamente. Es la misma libreta.' },
      { type: 'warn', text: 'Este módulo no lo ven todos: por defecto es solo para administradores y dirección, porque muestra el libro completo de la organización.' },
    ],
  },
  {
    id: 'caja-informe',
    category: 'caja',
    icon: 'FileText',
    title: 'El informe de avances y la cuenta de cobro',
    summary: 'Documentos que el sistema arma solo con lo que realmente se hizo en el período.',
    tags: ['informe', 'reporte', 'cuenta de cobro', 'avances', 'quincenal', 'word', 'pdf'],
    content: [
      { type: 'p', text: 'Desde Caja se generan dos documentos que antes se hacían a mano:' },
      { type: 'list', items: [
        'Informe de avances: qué se hizo en el período, armado con la información real del sistema.',
        'Cuenta de cobro: el documento formal del período.',
      ]},
      { type: 'p', text: 'Salen en Word y en PDF con el formato oficial, y quedan guardados en Documentos del Equipo — no hay que archivarlos a mano.' },
    ],
  },

  /* ═══════════════════ COMANDO ═══════════════════ */
  {
    id: 'comando-indicadores',
    category: 'comando',
    icon: 'Activity',
    title: 'Comando: los indicadores del equipo',
    summary: 'El tablero de dirección: cómo evolucionan leads, Zooms y la productividad de cada asesor.',
    tags: ['comando', 'dashboard', 'indicadores', 'kpis', 'directivo', 'equipo', 'productividad', 'zooms'],
    content: [
      { type: 'p', text: 'Comando es el tablero de dirección. Muestra cómo evolucionan los números del equipo en el tiempo, no solo la foto de hoy.' },
      { type: 'list', items: [
        'Indicadores · Leads: cuántos entran, cómo avanzan, de dónde vienen.',
        'Indicadores · Zooms: los agendados, los concretados y los que se cayeron.',
        'Indicadores · Productividad: el avance de cada asesor en su lista de acciones.',
      ]},
      { type: 'p', text: 'Puedes ver el período por día, semana o mes, elegir un rango personalizado en el calendario, y descargar el reporte para dirección.' },
      { type: 'p', text: 'Abajo está la tabla por asesor, para comparar el desempeño de cada uno en el mismo período.' },
      { type: 'warn', text: 'Este módulo es para dirección y administración. Un asesor ve sus propios números desde el CRM y desde el Copilot.' },
    ],
  },

  /* ═══════════════════ TELEGRAM ═══════════════════ */
  {
    id: 'telegram-que-es',
    category: 'telegram',
    icon: 'Send',
    title: 'Telegram: el mismo asistente, en tu chat personal',
    summary: 'Es OPCIONAL. El Copilot ya hace todo. Telegram sirve si además quieres operar desde tu chat.',
    tags: ['telegram', 'bot', 'asistente', 'chat', 'opcional', 'que es'],
    content: [
      { type: 'p', text: 'El asistente de Telegram es el MISMO cerebro del Copilot, pero en tu chat personal de Telegram. Hace lo mismo: registra clientes, agenda, consulta y te manda los avisos.' },
      { type: 'warn', text: 'Conectar Telegram NO es obligatorio. El Copilot dentro del CRM ya hace todo y las notificaciones te llegan al teléfono con la app instalada. Telegram es un extra para quien lo prefiera.' },
      { type: 'p', text: '¿Para qué sirve entonces? Para operar desde el celular sin abrir el sistema: sales de una cita, le mandas un audio a tu chat y queda registrado.' },
    ],
  },
  {
    id: 'telegram-conectar',
    category: 'telegram',
    icon: 'Send',
    title: 'Conectar tu Telegram (una sola vez)',
    summary: 'Tres pasos para vincular tu chat de Telegram con tu usuario del CRM.',
    tags: ['telegram', 'conectar', 'vincular', 'codigo', 'bot', 'start'],
    content: [
      { type: 'flow', items: [
        { n: '1', title: 'Abre el bot en Telegram', text: 'En Telegram, en la lupa de buscar, escribe @Strato_sasistente_crm_bot. Abre ese chat y toca Iniciar (o escribe /start).' },
        { n: '2', title: 'Genera tu código en el CRM', text: 'Entra a app.stratoscapitalgroup.com, inicia sesión, ve a tu Perfil y busca la sección "Conectar Telegram". Toca "Generar código" — te da un código de 8 dígitos.' },
        { n: '3', title: 'Pega el código en el chat', text: 'Vuelve al chat del bot y mándale ese código. Cuando veas "Conectado, [tu nombre]" ya está. Escribe hola para empezar.' },
      ]},
      { type: 'warn', text: 'El código caduca. Si te tardaste, genera uno nuevo. Y un mismo Telegram solo puede estar conectado a un usuario.' },
      { type: 'tip', text: 'Si eres admin y quieres recibir las escalaciones del equipo en Telegram, tu perfil también tiene que estar conectado.' },
    ],
  },
  {
    id: 'telegram-manual-completo',
    category: 'telegram',
    icon: 'HelpCircle',
    title: 'El manual completo del asistente de Telegram',
    summary: 'Todo el detalle del asistente: qué pedirle, formatos de fecha, avisos automáticos y qué hace cada botón.',
    tags: ['telegram', 'manual', 'detalle', 'completo', 'guia', 'botones', 'fechas'],
    content: [
      { type: 'p', text: 'Lo esencial de Telegram está en este manual. Si quieres el detalle completo — todas las frases que entiende, cómo escribir las fechas, los avisos automáticos y qué hace cada botón de los mensajes — hay un manual dedicado:' },
      { type: 'p', text: 'app.stratoscapitalgroup.com/manual-asistente-telegram' },
      { type: 'tip', text: 'Como el cerebro es el mismo, todo lo que ese manual explica para Telegram también aplica al Copilot dentro del CRM.' },
    ],
  },

  /* ═══════════════════ EQUIPO ═══════════════════ */
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
      { type: 'p', text: 'El otro asesor verá el cliente en su lista de inmediato. El historial completo y todas las notas viajan con él, y empieza a recibir sus recordatorios.' },
      { type: 'warn', text: 'Esta acción puede estar restringida a directores y administradores. Si no aparece la opción, pregúntale a tu director.' },
    ],
  },
  {
    id: 'roles-permisos',
    category: 'equipo',
    icon: 'ShieldUser',
    title: 'Roles y permisos del equipo',
    summary: 'Qué puede hacer cada rol: super_admin, admin, ceo, director, asesor y marketing.',
    tags: ['roles', 'permisos', 'admin', 'director', 'asesor', 'jerarquía', 'marketing'],
    content: [
      { type: 'p', text: 'El sistema tiene varios roles, cada uno con su nivel de acceso:' },
      { type: 'list', items: [
        'Super Admin: ve y modifica todo. Solo el dueño del sistema.',
        'Admin: gestiona usuarios y configuración general. Ve todos los leads.',
        'CEO: ve dashboards completos y todo el pipeline. Lectura completa.',
        'Director: ve los leads de su equipo y el pipeline de sus asesores.',
        'Asesor: ve y trabaja solo con sus leads asignados.',
        'Marketing: no ve el CRM de ventas. Trabaja en su propio espacio (Mi Día, Marcas, Pipeline de videos y Solicitudes) y tiene su propio Copilot.',
      ]},
      { type: 'tip', text: 'Si necesitas más permisos, pídelos a tu admin o director. El equipo de marketing tiene su propio manual aparte.' },
    ],
  },

  /* ═══════════════════ REPORTES ═══════════════════ */
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
      { type: 'p', text: 'Puedes filtrar por rango de fechas para ver cómo va el mes contra el anterior.' },
      { type: 'tip', text: 'Lo mismo se lo puedes preguntar al Copilot: "¿cómo voy este mes?".' },
    ],
  },

  /* ═══════════════════ SOPORTE ═══════════════════ */
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
    tags: ['error', 'no funciona', 'no carga', 'lento', 'problema', 'falla', 'pantalla en blanco'],
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
  {
    id: 'sesion-se-cierra',
    category: 'soporte',
    icon: 'LogIn',
    title: 'Si el sistema te pide iniciar sesión seguido',
    summary: 'Qué hacer cuando la sesión se cierra más de lo normal.',
    tags: ['sesion', 'cierra sesion', 'login', 'me saca', 'desconecta', 'contraseña otra vez'],
    content: [
      { type: 'p', text: 'La sesión está pensada para durar. Si te está pidiendo la contraseña seguido, prueba esto:' },
      { type: 'steps', items: [
        'Usa la app instalada en el celular en vez del navegador — ahí la sesión se mantiene mejor.',
        'No entres en modo incógnito: ahí la sesión se borra al cerrar.',
        'Evita "limpiar datos de navegación" del navegador, porque borra la sesión.',
        'Si sigue pasando, avísanos con la hora aproximada — se puede revisar qué ocurrió.',
      ]},
      { type: 'tip', text: 'Cuando publicamos una versión nueva puede pedirte entrar una vez. Eso es normal.' },
    ],
  },
  INDICE_FUNCIONES,
  ...FICHAS_FUNCIONES,
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
      version: '2.0',
      generatedAt: new Date().toISOString(),
      categories: CATEGORIES,
      sections: MANUAL_SECTIONS,
      search: searchManual,
    };
  }
}
