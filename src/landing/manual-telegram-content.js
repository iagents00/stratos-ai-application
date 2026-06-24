/**
 * manual-telegram-content.js — Contenido del Manual del ASISTENTE DE TELEGRAM
 *
 * URL pública: stratoscapitalgroup.com/manual-asistente-telegram
 * Audiencia: asesores (uso diario) + sección extra para admins.
 *
 * Mismo contrato de bloques que manual-content.js (p / steps / list / tip / warn),
 * para reusar el render de ManualCRM.jsx.
 *
 * El asistente HOY es Postgres-first + lenguaje natural: le escribís normal (o tocás
 * los botones que aparecen en los recordatorios) y él hace el trabajo en el CRM.
 */

export const CATEGORIES_TG = [
  { id: 'empezar',     label: 'Empezar',                 icon: 'Send' },
  { id: 'pedidos',     label: 'Lo que le pedís',         icon: 'MessageCircle' },
  { id: 'fechas',      label: 'Fechas y horas',          icon: 'History' },
  { id: 'solo',        label: 'Lo que hace solo',        icon: 'Workflow' },
  { id: 'botones',     label: 'Botones y respuestas',    icon: 'CheckSquare' },
  { id: 'equipo',      label: 'Acciones de Equipo',      icon: 'UsersRound' },
  { id: 'admin',       label: 'Si sos admin',            icon: 'ShieldUser' },
  { id: 'tips',        label: 'Consejos y problemas',    icon: 'LifeBuoy' },
];

export const MANUAL_SECTIONS_TG = [
  /* ════════════ EMPEZAR ════════════ */
  {
    id: 'que-es',
    category: 'empezar',
    icon: 'Sparkles',
    title: '¿Qué es tu asistente de Telegram?',
    summary: 'Un bot de Telegram conectado a tu CRM. Le escribís como a una persona y él hace el trabajo: registra acciones, agenda zooms, busca clientes y te recuerda lo importante.',
    tags: ['asistente', 'bot', 'telegram', 'que es', 'para que sirve', 'crm'],
    content: [
      { type: 'p', text: 'Tu asistente es un bot de Telegram conectado en vivo a tu CRM de Duke del Caribe. Le hablás en lenguaje normal (o tocás botones) y él ejecuta el trabajo dentro del sistema. Todo lo que hacés por el chat queda guardado al instante en el CRM.' },
      { type: 'list', items: [
        'Registrás próximas acciones y agendás zooms sin abrir la computadora.',
        'Buscás clientes y ves sus fichas desde el celular, en segundos.',
        'Consultás tus KPIs, tu agenda y tu pipeline cuando quieras.',
        'Y lo más importante: él te persigue a vos — te avisa lo que tenés que hacer, a tiempo.',
      ]},
      { type: 'tip', text: 'No tenés que memorizar comandos. Escribile con tus palabras (tolera errores de dedo) o tocá los botones que te aparezcan. Si algo no le queda claro, te lo pregunta.' },
    ],
  },
  {
    id: 'conectar',
    category: 'empezar',
    icon: 'LogIn',
    title: 'Conectá tu Telegram (una sola vez)',
    summary: 'Vinculá tu cuenta de Telegram a tu perfil del CRM con un código de 8 dígitos. Toma 1 minuto y es por única vez.',
    tags: ['conectar', 'vincular', 'codigo', 'start', 'conectar telegram', 'pareo', 'primera vez'],
    content: [
      { type: 'steps', items: [
        'Entrá al CRM en app.stratoscapitalgroup.com e iniciá sesión con tu cuenta.',
        'Arriba a la derecha abrí tu Perfil y tocá "Conectar Telegram".',
        'El CRM te muestra un código de 8 dígitos (vence en unos minutos).',
        'En Telegram buscá el bot STRATOS ASISTENTE y abrí el chat.',
        'Escribí /start y luego pegá tu código. También sirve: /conectar 12345678.',
      ]},
      { type: 'p', text: 'Cuando veas "Conectado, [tu nombre]" ya estás listo. Escribí hola para ver qué podés hacer.' },
      { type: 'warn', text: 'Tu número de Telegram queda ligado SOLO a tu perfil. Nadie más ve ni toca tus clientes. Si cambiás de teléfono, repetí el paso desde Perfil → Conectar Telegram.' },
    ],
  },
  {
    id: 'como-hablarle',
    category: 'empezar',
    icon: 'MessageCircle',
    title: '¿Cómo le hablo? (ya no hay menús)',
    summary: 'Le escribís natural, como a un compañero. El asistente entiende lenguaje normal — ya no dependés de menús ni comandos.',
    tags: ['como hablar', 'lenguaje natural', 'escribir', 'menu', 'comandos', 'hola'],
    content: [
      { type: 'p', text: 'El asistente entiende lo que escribís en lenguaje normal. No tenés que aprender comandos: decile qué necesitás como se lo dirías a un compañero.' },
      { type: 'list', items: [
        '"recordame llamar a Juan mañana 9am"',
        '"agendá zoom con Sofía el jueves 4pm"',
        '"cuántos clientes tengo en pipeline"',
        '"buscá a Diana"',
      ]},
      { type: 'tip', text: 'Si escribís hola o menú, te muestra un resumen de lo que podés hacer. Pero no es obligatorio: andá directo al grano y él entiende.' },
    ],
  },

  /* ════════════ LO QUE LE PEDÍS ════════════ */
  {
    id: 'proxima-accion',
    category: 'pedidos',
    icon: 'CheckSquare',
    title: 'Programar una próxima acción',
    summary: 'Decile a quién, qué vas a hacer y cuándo. Lo guarda en la ficha del cliente y te lo recuerda a tiempo.',
    tags: ['proxima accion', 'tarea', 'recordatorio', 'agendar', 'pendiente', 'seguimiento'],
    content: [
      { type: 'p', text: 'Decile el cliente, la acción y la fecha/hora, todo en una frase:' },
      { type: 'list', items: [
        '"poné la próxima acción de Ceci: enviar whatsapp, hoy a las 8pm"',
        '"recordame llamar a Felipe mañana 10am"',
        '"próxima acción con Mariana: mandar la propuesta el viernes 11am"',
      ]},
      { type: 'p', text: 'El asistente la guarda en la ficha del cliente y se encarga de recordártela cerca de la hora (ver "Lo que hace solo").' },
      { type: 'tip', text: 'Si no ponés la hora, te la pregunta. Respondele en el mismo chat con el día y la hora.' },
    ],
  },
  {
    id: 'agendar-zoom',
    category: 'pedidos',
    icon: 'Workflow',
    title: 'Agendar un Zoom',
    summary: 'Programá la reunión con el cliente. Pasa a la etapa Zoom Agendado con su fecha y hora.',
    tags: ['zoom', 'agendar', 'reunion', 'cita', 'meet', 'zoom agendado'],
    content: [
      { type: 'list', items: [
        '"poné el zoom de Carlos el viernes 11am"',
        '"cambiá la etapa de Felipe a Zoom Agendado mañana 10am"',
      ]},
      { type: 'p', text: 'El cliente pasa a la etapa Zoom Agendado con la fecha y hora que diste. Y el asistente te va a mandar un resumen del cliente unas 3 horas antes para que entres preparado.' },
    ],
  },
  {
    id: 'crear-cliente',
    category: 'pedidos',
    icon: 'UserPlus',
    title: 'Crear un cliente nuevo',
    summary: 'Registrá un lead que te llegó por fuera del sistema. Queda creado y asignado a vos, con su primera acción lista.',
    tags: ['crear cliente', 'nuevo lead', 'registrar', 'agregar cliente', 'alta'],
    content: [
      { type: 'list', items: [
        '"creá cliente Mariana, teléfono 5215512345678, llamarla en 4 horas"',
        '"nuevo lead: Diego Torres, 521..., contactarlo hoy 6pm"',
      ]},
      { type: 'p', text: 'Queda creado, asignado a vos, y con su primera próxima acción cargada. Por defecto entra en la etapa "Contáctame Ya" (la de contacto inmediato).' },
      { type: 'tip', text: 'Si no decís la etapa, el bot la pone en "Contáctame Ya" y te avisa. Si querés otra, decísela ("…en etapa Segundo Intento").' },
    ],
  },
  {
    id: 'buscar',
    category: 'pedidos',
    icon: 'FileSearch',
    title: 'Buscar un cliente y ver su ficha',
    summary: 'Encontrá un cliente por nombre o parte del teléfono y mirá su expediente completo.',
    tags: ['buscar', 'encontrar', 'ficha', 'expediente', 'cliente'],
    content: [
      { type: 'list', items: [
        '"buscá a Diana" → te muestra la ficha del cliente.',
        '"buscá 51234" → busca por parte del teléfono.',
      ]},
      { type: 'p', text: 'En la ficha vas a ver presupuesto, interés, objeciones, etapa y un resumen del cliente. Desde ahí podés ver el expediente o el historial completo.' },
    ],
  },
  {
    id: 'kpis-agenda-pipeline',
    category: 'pedidos',
    icon: 'LayoutDashboard',
    title: 'KPIs, agenda y pipeline',
    summary: 'Consultá tus números, tu lista de pendientes y cómo viene tu embudo, todo desde el chat.',
    tags: ['kpis', 'numeros', 'metricas', 'agenda', 'mis clientes', 'pipeline', 'dashboard'],
    content: [
      { type: 'list', items: [
        '"kpis" → tus números: leads, calientes, pipeline, pendientes y vencidos.',
        '"mis clientes" → tu agenda de próximas acciones (las más cercanas primero).',
        '"pipeline" → cuántos clientes tenés en cada etapa.',
        '"qué tengo pendiente" → lo que tenés por hacer.',
      ]},
    ],
  },
  {
    id: 'cambiar-etapa',
    category: 'pedidos',
    icon: 'MoveRight',
    title: 'Cambiar la etapa de un cliente',
    summary: 'Movés un cliente en el pipeline desde el chat, sin abrir el CRM.',
    tags: ['etapa', 'cambiar etapa', 'pipeline', 'mover', 'seguimiento', 'apartó', 'cierre'],
    content: [
      { type: 'list', items: [
        '"pasá a Felipe a Seguimiento"',
        '"cambiá a Sofía a Zoom Agendado el jueves 4pm"',
      ]},
      { type: 'p', text: 'Cada movimiento queda registrado en el historial del cliente. Si te equivocaste, simplemente decile la etapa correcta.' },
    ],
  },

  /* ════════════ FECHAS Y HORAS ════════════ */
  {
    id: 'formato-fechas',
    category: 'fechas',
    icon: 'History',
    title: 'Cómo decir la fecha y la hora',
    summary: 'El asistente entiende muchas formas de decir cuándo. Siempre interpreta en hora de Cancún (México).',
    tags: ['fecha', 'hora', 'cuando', 'mañana', 'en 3 horas', 'viernes', 'cancun'],
    content: [
      { type: 'p', text: 'Podés decir la fecha y hora de muchas formas; el asistente las entiende todas (siempre en hora de Cancún):' },
      { type: 'list', items: [
        'hoy 8pm   ·   mañana 10am',
        'en 3 horas   ·   en 30 minutos   ·   dentro de 2 días',
        'el viernes 3pm   ·   el jueves 10am',
        '22/06 16:00   ·   24/06 9am',
      ]},
      { type: 'warn', text: 'Cuidado con los typos en las fechas: si escribís "ñamana" o "jeuves", el asistente no lo entiende y te vuelve a preguntar — mejor eso que guardar una fecha equivocada. Volvé a escribirla bien.' },
    ],
  },

  /* ════════════ LO QUE HACE SOLO ════════════ */
  {
    id: 'avisos-intro',
    category: 'solo',
    icon: 'Workflow',
    title: 'Lo que el asistente hace por vos solo',
    summary: 'No tenés que estar pidiendo: él te avisa en el momento justo. Estos son los recordatorios que vas a recibir.',
    tags: ['avisos', 'recordatorios', 'automatico', 'proactivo', 'solo'],
    content: [
      { type: 'p', text: 'El asistente trabaja en segundo plano y te escribe cuando tenés que actuar. Son cuatro tipos de aviso:' },
      { type: 'list', items: [
        'Antes de un Zoom (≈3 horas antes): te llega un resumen del cliente para entrar preparado.',
        'Próxima acción cercana: te recuerda lo que tenías agendado, a tiempo (y de nuevo unos minutos antes).',
        'Cliente sin movimiento: te avisa de un cliente que llevás días sin atender, para que no se enfríe.',
        'Acción de equipo: te pregunta si ya hiciste una acción de tu Lista de Acción (ver su propia sección).',
      ]},
      { type: 'tip', text: 'Todos los avisos llegan dentro del horario laboral (no te molesta de noche).' },
    ],
  },
  {
    id: 'aviso-zoom',
    category: 'solo',
    icon: 'Send',
    title: 'Resumen antes de tu Zoom',
    summary: 'Unas 3 horas antes de un Zoom agendado, el asistente te manda un briefing del cliente.',
    tags: ['zoom', 'resumen', 'briefing', 'antes del zoom', '3 horas', 'preparado'],
    content: [
      { type: 'p', text: 'Cuando tenés un Zoom Agendado, ≈3 horas antes te llega un mensaje con el resumen estratégico del cliente: qué le interesa, presupuesto, objeciones y un plan sugerido para la reunión.' },
      { type: 'p', text: 'El mensaje trae botones para que respondas (ver "Botones y respuestas"). Estudiá al cliente y entrá en frío nunca.' },
    ],
  },
  {
    id: 'aviso-inactivo',
    category: 'solo',
    icon: 'AlertCircle',
    title: 'Cliente sin movimiento (lead abandonado)',
    summary: 'Si un cliente lleva días sin que lo atiendas, el asistente te avisa para que lo retomes antes de que se enfríe.',
    tags: ['inactivo', 'abandonado', 'sin movimiento', 'retomar', 'enfriar', 'dias'],
    content: [
      { type: 'p', text: 'El asistente vigila tus clientes de etapas tempranas. Si uno lleva días sin movimiento, te escribe algo como: "Oye, [cliente] lleva días sin movimiento desde la última actividad el [fecha]. ¿Qué pasó? Revisá el CRM y registrá la acción o reagendá."' },
      { type: 'p', text: 'El mensaje trae 3 botones: Ya lo contacté · Definir próxima acción · Ver ficha del cliente.' },
    ],
  },

  /* ════════════ BOTONES Y RESPUESTAS ════════════ */
  {
    id: 'botones-como',
    category: 'botones',
    icon: 'CheckSquare',
    title: 'Los botones de los recordatorios',
    summary: 'Cuando el asistente te avisa, te da botones para responder en un toque. Esto es lo que hace cada uno.',
    tags: ['botones', 'responder', 'ya lo contacte', 'definir proxima accion', 'ver ficha'],
    content: [
      { type: 'list', items: [
        'Ya lo contacté — lo registra y el cliente vuelve a tu seguimiento activo.',
        'Definir próxima acción — el bot te pregunta la próxima acción y la fecha. Vos respondés y queda guardado.',
        'Ver ficha / expediente — te muestra presupuesto, interés, objeciones y el resumen del cliente.',
      ]},
      { type: 'p', text: 'Ejemplo del flujo de "Definir próxima acción":' },
      { type: 'list', items: [
        '(bot) ¿Cuál es la próxima acción y para cuándo?',
        '(vos) reactivarlo — mañana 3pm',
        '(bot) Listo, próxima acción de [cliente]: reactivarlo - el 25 de junio a las 15:00 hs (Cancún).',
      ]},
      { type: 'warn', text: 'Cuando el bot te pide la fecha, respondele en ese mismo chat. Él ya sabe de qué cliente se trata; vos solo decile el día y la hora.' },
    ],
  },

  /* ════════════ ACCIONES DE EQUIPO ════════════ */
  {
    id: 'equipo-que-es',
    category: 'equipo',
    icon: 'UsersRound',
    title: '¿Qué son las Acciones de Equipo?',
    summary: 'Tareas que se cargan en la "Lista de Acción" del Comando Directivo. El asistente te hace seguimiento por Telegram hasta que las cierres.',
    tags: ['acciones de equipo', 'lista de accion', 'comando directivo', 'tareas equipo'],
    content: [
      { type: 'p', text: 'Además de las acciones por cliente, está la "Lista de Acción" del equipo (en el Comando Directivo del CRM). Son tareas con fecha límite que el asistente te recuerda y te persigue hasta que las marques hechas.' },
      { type: 'p', text: 'Cuando vos (asesor) creás una acción de equipo, se asigna a vos automáticamente — es obvio que es para vos. Si la crea un admin, él elige a quién se la asigna.' },
      { type: 'tip', text: 'Toda acción de equipo lleva fecha y hora límite obligatoria — esa fecha es la que usa el coach para recordarte.' },
    ],
  },
  {
    id: 'equipo-coach',
    category: 'equipo',
    icon: 'MessageCircle',
    title: 'El coach que te pregunta "¿ya la hiciste?"',
    summary: 'El asistente te avisa de cada acción de equipo (1 día antes y 3 horas antes) y te da 3 botones para responder.',
    tags: ['coach', 'ya la hice', 'en proceso', 'no la hice', 'seguimiento', 'recordatorio equipo'],
    content: [
      { type: 'p', text: 'El asistente te escribe 1 día antes y 3 horas antes de que venza cada acción de equipo tuya. El mensaje es algo así:' },
      { type: 'list', items: [
        '🔵 Seguimiento — Lista de Acción',
        'Hola [tu nombre], ¿ya hiciste esta acción?',
        '[descripción de la acción] — Para el [fecha] hs (Cancún)',
      ]},
      { type: 'p', text: 'Y trae 3 botones:' },
      { type: 'list', items: [
        'Ya la hice — la marca como completada y deja de molestarte.',
        'En proceso — la anota y te dice "avisame cuando la cierres".',
        'No la hice — la anota y avisa a los admins para que te apoyen.',
      ]},
      { type: 'tip', text: 'Lo que respondas se refleja al instante en la pestaña "Indicadores · Productividad" del Comando Directivo (tu % de avance sube cuando marcás hechas).' },
    ],
  },

  /* ════════════ SI SOS ADMIN ════════════ */
  {
    id: 'admin-intro',
    category: 'admin',
    icon: 'ShieldUser',
    title: 'Lo extra que podés hacer si sos admin',
    summary: 'Si tu rol es admin / super_admin / CEO / director (por ejemplo Oscar), el asistente te da más poderes que a un asesor.',
    tags: ['admin', 'super admin', 'director', 'ceo', 'permisos', 'oscar'],
    content: [
      { type: 'p', text: 'Un asesor ve y trabaja solo con SUS clientes. Un admin opera sobre todo el equipo. Esto es lo que sumás como admin:' },
      { type: 'list', items: [
        'Ver los KPIs y el pipeline de TODOS los asesores, no solo los tuyos.',
        'Asignar / reasignar un cliente a un asesor del equipo.',
        'Crear acciones de equipo y asignarlas a cualquier asesor (a vos no se te auto-asignan: vos elegís el responsable).',
        'Recibir las escalaciones: cuando un asesor no confirma su plan de Zoom o responde "No la hice" a una acción de equipo, te llega el aviso para apoyarlo.',
      ]},
      { type: 'warn', text: 'Para recibir las escalaciones en Telegram, tu perfil de admin tiene que estar conectado al bot (mismo paso de "Conectar Telegram"). Si no, las escalaciones se registran pero no te llegan al chat.' },
    ],
  },
  {
    id: 'admin-asignar',
    category: 'admin',
    icon: 'UserCheck',
    title: 'Asignar un cliente a un asesor',
    summary: 'Como admin podés repartir o reasignar clientes entre tu equipo desde el chat.',
    tags: ['asignar cliente', 'reasignar', 'repartir', 'asesor', 'admin'],
    content: [
      { type: 'list', items: [
        '"asigná el cliente Mariana a Araceli"',
        '"pasá a Felipe al asesor Emmanuel"',
      ]},
      { type: 'p', text: 'El cliente aparece de inmediato en la lista del asesor nuevo, con todo su historial y notas. Y ese asesor empieza a recibir los recordatorios de ese cliente.' },
    ],
  },
  {
    id: 'admin-kpis',
    category: 'admin',
    icon: 'LineChart',
    title: 'Ver KPIs del equipo completo',
    summary: 'Como admin ves los números globales, no solo los tuyos.',
    tags: ['kpis equipo', 'numeros globales', 'dashboard', 'pipeline equipo', 'admin'],
    content: [
      { type: 'p', text: 'Pedile los KPIs y vas a ver el panorama de todo el equipo: leads totales, calientes, pipeline por etapa, pendientes y vencidos de todos los asesores.' },
      { type: 'tip', text: 'En el CRM web, el Comando Directivo tiene además 3 pestañas: Indicadores · Leads, Indicadores · Zooms e Indicadores · Productividad (esta última muestra el avance de cada asesor en su Lista de Acción).' },
    ],
  },

  /* ════════════ CONSEJOS Y PROBLEMAS ════════════ */
  {
    id: 'tips-uso',
    category: 'tips',
    icon: 'Lightbulb',
    title: 'Consejos para sacarle el jugo',
    summary: 'Pequeños hábitos que hacen la diferencia con tu asistente.',
    tags: ['consejos', 'tips', 'buenas practicas', 'habitos'],
    content: [
      { type: 'list', items: [
        'Registrá las acciones apenas terminás una llamada — desde el celular, en segundos.',
        'Respondé los botones de los recordatorios: así el sistema sabe que estás encima y no escala.',
        'Hablale natural y completo: "agendá zoom con Sofía el jueves 4pm" es mejor que mensajes a medias.',
        'Si el bot te pregunta algo, contestale en el mismo chat — ya tiene el contexto del cliente.',
      ]},
      { type: 'tip', text: 'Probalo hoy con un cliente de prueba y vas a ver lo fácil que es. El asistente te persigue a vos, no al revés.' },
    ],
  },
  {
    id: 'problemas',
    category: 'tips',
    icon: 'HelpCircle',
    title: 'Si algo no funciona',
    summary: 'Qué revisar antes de pedir ayuda.',
    tags: ['problema', 'no funciona', 'error', 'no me llega', 'ayuda', 'soporte'],
    content: [
      { type: 'list', items: [
        'No te llegan avisos: revisá que tu Telegram esté conectado (Perfil → Conectar Telegram). Si cambiaste de teléfono, reconectá.',
        'Una acción no notifica: asegurate de que tenga un responsable. Las acciones "sin asignar" no mandan recordatorio (no hay a quién avisarle).',
        'El bot no entiende una fecha: probablemente fue un typo — volvé a escribirla bien (mañana 3pm, en 3 horas, 24/06 16:00).',
        'No estás seguro de un comando: escribí hola para ver el menú, o simplemente decílo con tus palabras.',
      ]},
      { type: 'warn', text: 'Si nada de esto lo resuelve, escribile a tu admin o al soporte por WhatsApp con una captura del chat.' },
    ],
  },
];

/** Búsqueda genérica reusable (igual contrato que searchManual). */
export function searchManualTG(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return MANUAL_SECTIONS_TG;
  const tokens = q.split(/\s+/).filter(Boolean);
  return MANUAL_SECTIONS_TG
    .map((s) => {
      const hay = [s.title, s.summary, s.category, ...(s.tags || [])].join(' ').toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 1;
        if (s.title.toLowerCase().includes(t)) score += 2;
        if ((s.tags || []).some((tag) => tag.toLowerCase() === t)) score += 3;
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}
