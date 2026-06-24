/**
 * manual-telegram-content.js — Manual del ASISTENTE DE TELEGRAM (Duke del Caribe)
 *
 * URL pública: stratoscapitalgroup.com/manual-asistente-telegram
 * Audiencia: asesores (muchos no son técnicos) + sección extra para admins.
 *
 * Bloques soportados por ManualCRM.jsx: p / steps / list / tip / warn / flow / ex
 *   flow: { type:'flow', items:[{ n, title, text }] }   diagrama de pasos en tarjetas
 *   ex:   { type:'ex',   items:['…','…'] }               ejemplos "escribile así" (chips)
 */

export const CATEGORIES_TG = [
  { id: 'empezar',  label: 'Empezar de cero',       icon: 'Send' },
  { id: 'pedidos',  label: 'Qué le podés pedir',    icon: 'MessageCircle' },
  { id: 'fechas',   label: 'Fechas y horas',        icon: 'History' },
  { id: 'solo',     label: 'Lo que hace solo',      icon: 'Workflow' },
  { id: 'botones',  label: 'Los botones',           icon: 'CheckSquare' },
  { id: 'equipo',   label: 'Acciones de Equipo',    icon: 'UsersRound' },
  { id: 'admin',    label: 'Si sos admin',          icon: 'ShieldUser' },
  { id: 'tips',     label: 'Dudas y problemas',     icon: 'LifeBuoy' },
];

export const MANUAL_SECTIONS_TG = [
  /* ═══════════ EMPEZAR DE CERO ═══════════ */
  {
    id: 'que-es',
    category: 'empezar',
    icon: 'Sparkles',
    title: '¿Qué es tu asistente de Telegram?',
    summary: 'Un asistente personal dentro de Telegram, conectado en vivo a tu CRM. Le hablás (o le mandás un audio) y él hace el trabajo por vos.',
    tags: ['asistente', 'bot', 'telegram', 'que es', 'para que sirve'],
    content: [
      { type: 'p', text: 'Imaginá tener un asistente que conoce a todos tus clientes y nunca se olvida de nada. Eso es tu asistente de Telegram: un chat conectado en vivo a tu CRM de Duke del Caribe.' },
      { type: 'p', text: 'Le escribís (o le mandás un audio) como a un compañero, y él hace el trabajo dentro del sistema: registra acciones, agenda zooms, crea clientes, busca fichas y te recuerda lo importante. Todo lo que hacés por el chat queda guardado al instante en el CRM.' },
      { type: 'list', items: [
        'Trabajás desde el celular, sin abrir la computadora.',
        'No se te escapa ningún cliente: él te persigue a vos, no al revés.',
        'Llegás preparado a cada reunión y a cada llamada.',
      ]},
      { type: 'tip', text: 'No hay que memorizar comandos ni botones. Hablale natural, con tus palabras. Tolera errores de dedo, y si algo no le queda claro, te lo pregunta.' },
    ],
  },
  {
    id: 'que-es-telegram',
    category: 'empezar',
    icon: 'Send',
    title: '¿No usás Telegram? Empezá por acá',
    summary: 'Telegram es una app de mensajería gratis, parecida a WhatsApp. Te explicamos cómo instalarla en 1 minuto.',
    tags: ['telegram', 'instalar', 'descargar', 'app', 'que es telegram', 'no se usar'],
    content: [
      { type: 'p', text: 'Telegram es una aplicación de mensajería gratuita, muy parecida a WhatsApp. Tu asistente vive ahí dentro. Si nunca la usaste, instalarla toma un minuto:' },
      { type: 'steps', items: [
        'En tu celular, abrí la tienda de apps (Play Store en Android, App Store en iPhone).',
        'Buscá "Telegram" y tocá Instalar.',
        'Abrila y registrate con tu número de teléfono (te llega un código por SMS).',
        'Listo. Ya podés buscar al bot del asistente (siguiente paso).',
      ]},
      { type: 'tip', text: 'Telegram es gratis y funciona en celular y en computadora. Si ya la tenés instalada, saltá directo a "Conectá tu Telegram".' },
    ],
  },
  {
    id: 'conectar',
    category: 'empezar',
    icon: 'LogIn',
    title: 'Conectá tu Telegram (una sola vez)',
    summary: 'Vinculá tu Telegram con tu perfil del CRM usando un código. Es por única vez y toma 2 minutos. Seguí estos 3 pasos.',
    tags: ['conectar', 'vincular', 'codigo', 'start', 'generar codigo', 'parear', 'primera vez', 'bot'],
    content: [
      { type: 'p', text: 'Para que el asistente sepa quién sos y te muestre TUS clientes, conectás tu Telegram con tu perfil del CRM una sola vez. Son 3 pasos:' },
      { type: 'flow', items: [
        { n: '1', title: 'Abrí el bot en Telegram', text: 'En Telegram, en la lupa de buscar, escribí @Strato_sasistente_crm_bot. Abrí ese chat y tocá Iniciar (o escribí /start).' },
        { n: '2', title: 'Generá tu código en el CRM', text: 'Entrá a app.stratoscapitalgroup.com, iniciá sesión, y abajo buscá la sección "Conectar Telegram". Tocá "Generar código" — te da un código de 8 dígitos.' },
        { n: '3', title: 'Pegá el código en el chat', text: 'Volvé al chat del bot y mandale ese código. Cuando veas "Conectado, [tu nombre]" ya está. Escribí hola para empezar.' },
      ]},
      { type: 'warn', text: 'El bot correcto es @Strato_sasistente_crm_bot (revisá bien el nombre). El código vence en unos minutos: si se te pasa, generá uno nuevo.' },
      { type: 'tip', text: 'Tu Telegram queda ligado SOLO a tu perfil — nadie más ve ni toca tus clientes. Si cambiás de teléfono, repetí estos 3 pasos.' },
    ],
  },
  {
    id: 'audios',
    category: 'empezar',
    icon: 'MessageCircle',
    title: 'Mandale audios (no hace falta escribir)',
    summary: 'Si estás manejando o con las manos ocupadas, mandale una nota de voz. El asistente la entiende igual que un mensaje escrito.',
    tags: ['audio', 'nota de voz', 'voz', 'hablar', 'sin escribir', 'manejando'],
    content: [
      { type: 'p', text: 'No siempre podés escribir. Por eso el asistente entiende AUDIOS: mantené apretado el micrófono en Telegram, hablale normal y soltá. Él transcribe lo que dijiste y lo ejecuta igual que si lo hubieras escrito.' },
      { type: 'ex', items: [
        '(audio) "Agendá el zoom de Carlos para el viernes a las 11 de la mañana"',
        '(audio) "Creá un cliente, Mariana López, teléfono 521 55 1234 5678, llamarla en 4 horas"',
        '(audio) "Recordame mandarle la propuesta a Felipe mañana a las 10"',
      ]},
      { type: 'tip', text: 'Ideal cuando vas manejando, saliendo de una reunión o con las manos ocupadas. Hablale claro y pausado y va a entender perfecto.' },
    ],
  },
  {
    id: 'como-hablarle',
    category: 'empezar',
    icon: 'MessageCircle',
    title: '¿Cómo le hablo? (ya no hay menús)',
    summary: 'Le escribís o le mandás audio en lenguaje normal, como a un compañero. Ya no dependés de menús ni comandos.',
    tags: ['como hablar', 'lenguaje natural', 'escribir', 'menu', 'comandos', 'hola'],
    content: [
      { type: 'p', text: 'El asistente entiende lo que decís en lenguaje normal. No tenés que aprender comandos raros: decile qué necesitás como se lo dirías a una persona.' },
      { type: 'ex', items: [
        '"buscá a Diana"',
        '"cuántos clientes tengo en pipeline"',
        '"pasá a Felipe a Seguimiento"',
        '"recordame llamar a Juan mañana 9am"',
      ]},
      { type: 'tip', text: 'Si escribís hola o menú, te muestra un resumen de lo que podés hacer. Pero no es obligatorio: andá directo al grano.' },
    ],
  },

  /* ═══════════ QUÉ LE PODÉS PEDIR ═══════════ */
  {
    id: 'crear-cliente',
    category: 'pedidos',
    icon: 'UserPlus',
    title: 'Crear un cliente nuevo (estés donde estés)',
    summary: 'Te llegó un lead y no estás frente a la computadora. Creálo desde el chat en segundos y queda asignado a vos.',
    tags: ['crear cliente', 'nuevo lead', 'registrar', 'agregar cliente', 'alta', 'fuera de la pc'],
    content: [
      { type: 'p', text: 'Estás en la calle, en un evento o saliendo de una reunión y te pasan un contacto. No esperes a llegar a la computadora: registralo ahí mismo desde el chat.' },
      { type: 'ex', items: [
        '"creá cliente Mariana, teléfono 5215512345678, llamarla en 4 horas"',
        '"nuevo lead: Diego Torres, 521..., contactarlo hoy 6pm"',
      ]},
      { type: 'p', text: 'Queda creado, asignado a vos, y con su primera próxima acción cargada. Por defecto entra en la etapa "Contáctame Ya".' },
      { type: 'tip', text: '¿Qué pasa si no decís la etapa? El bot la pone en "Contáctame Ya" (la de contacto inmediato) y te avisa. Si querés otra, agregá "…en etapa Segundo Intento".' },
    ],
  },
  {
    id: 'proxima-accion',
    category: 'pedidos',
    icon: 'CheckSquare',
    title: 'Programar la próxima acción de un cliente',
    summary: 'Decile a quién, qué vas a hacer y cuándo. Lo guarda en la ficha y te lo recuerda a tiempo.',
    tags: ['proxima accion', 'tarea', 'recordatorio', 'agendar', 'pendiente', 'seguimiento'],
    content: [
      { type: 'p', text: 'Decile el cliente, la acción y la fecha/hora, todo en una frase:' },
      { type: 'ex', items: [
        '"poné la próxima acción de Ceci: enviar whatsapp, hoy 8pm"',
        '"próxima acción con Mariana: mandar la propuesta el viernes 11am"',
      ]},
      { type: 'p', text: 'La guarda en la ficha del cliente y se encarga de recordártela cerca de la hora (ver "Lo que hace solo").' },
      { type: 'tip', text: '¿Qué pasa si no ponés la hora? Te la pregunta. Respondele en el mismo chat con el día y la hora — el ya sabe de qué cliente se trata.' },
    ],
  },
  {
    id: 'cambiar-accion',
    category: 'pedidos',
    icon: 'MoveRight',
    title: 'Cambiar o actualizar una acción del cliente',
    summary: 'Cambiaron los planes con un cliente. Actualizá su próxima acción o reagendala desde el chat.',
    tags: ['cambiar accion', 'actualizar', 'reagendar', 'modificar', 'mover', 'reprogramar'],
    content: [
      { type: 'p', text: 'Si lo que tenías agendado cambió, decíselo y lo actualiza:' },
      { type: 'ex', items: [
        '"cambiá la próxima acción de Felipe a: reenviar cotización, mañana 3pm"',
        '"reagendá el zoom de Carlos para el lunes 10am"',
      ]},
      { type: 'p', text: 'El cambio queda registrado en el historial del cliente, y el asistente recalcula los recordatorios con la nueva fecha.' },
    ],
  },
  {
    id: 'agendar-zoom',
    category: 'pedidos',
    icon: 'Workflow',
    title: 'Agendar un Zoom',
    summary: 'Programá la reunión con el cliente. Pasa a la etapa Zoom Agendado y el asistente te prepara antes.',
    tags: ['zoom', 'agendar', 'reunion', 'cita', 'meet', 'zoom agendado'],
    content: [
      { type: 'ex', items: [
        '"poné el zoom de Carlos el viernes 11am"',
        '"cambiá la etapa de Felipe a Zoom Agendado mañana 10am"',
      ]},
      { type: 'p', text: 'El cliente pasa a la etapa Zoom Agendado con la fecha y hora que diste. Y unas 3 horas antes, el asistente te manda un resumen del cliente para que entres preparado (ver "Lo que hace solo").' },
    ],
  },
  {
    id: 'cambiar-etapa',
    category: 'pedidos',
    icon: 'Layers',
    title: 'Mover un cliente de etapa',
    summary: 'Avanzá un cliente en el pipeline desde el chat, sin abrir el CRM.',
    tags: ['etapa', 'cambiar etapa', 'pipeline', 'mover', 'seguimiento', 'apartó', 'cierre'],
    content: [
      { type: 'ex', items: [
        '"pasá a Felipe a Seguimiento"',
        '"mové a Sofía a Apartó"',
      ]},
      { type: 'p', text: 'Cada movimiento queda en el historial. ¿Te equivocaste? Simplemente decile la etapa correcta y lo corrige.' },
    ],
  },
  {
    id: 'buscar-ficha',
    category: 'pedidos',
    icon: 'FileSearch',
    title: 'Buscar un cliente y consultar todo: ficha, notas, expediente',
    summary: 'Encontrá un cliente y consultá su información completa: presupuesto, interés, objeciones, notas e historial — desde el chat.',
    tags: ['buscar', 'encontrar', 'ficha', 'expediente', 'notas', 'historial', 'informacion', 'consultar'],
    content: [
      { type: 'p', text: 'Antes de llamar a un cliente, repasalo en 5 segundos desde el chat:' },
      { type: 'ex', items: [
        '"buscá a Diana"  → te muestra su ficha.',
        '"buscá 51234"   → busca por parte del teléfono.',
        '"ver expediente de Carlos"  → notas, presupuesto, objeciones, resumen.',
        '"historial de Felipe"  → todos los movimientos del cliente.',
      ]},
      { type: 'p', text: 'En la ficha vas a ver presupuesto, proyecto de interés, objeciones, etapa y un resumen. Desde ahí podés pedir el expediente completo (notas e información) o el historial.' },
      { type: 'tip', text: 'Útil cuando estás por entrar a un Zoom o una llamada y necesitás recordar dónde quedó el cliente.' },
    ],
  },
  {
    id: 'kpis-agenda-pipeline',
    category: 'pedidos',
    icon: 'LayoutDashboard',
    title: 'Consultar tus KPIs, tu agenda y tu pipeline',
    summary: 'Tus números, tus pendientes y tu embudo, todo desde el chat.',
    tags: ['kpis', 'numeros', 'metricas', 'agenda', 'mis clientes', 'pipeline', 'dashboard'],
    content: [
      { type: 'ex', items: [
        '"kpis"         → leads, calientes, pipeline, pendientes y vencidos.',
        '"mis clientes" → tu agenda de próximas acciones (lo más cercano primero).',
        '"pipeline"     → cuántos clientes tenés en cada etapa.',
        '"qué tengo pendiente"',
      ]},
    ],
  },

  /* ═══════════ FECHAS Y HORAS ═══════════ */
  {
    id: 'formato-fechas',
    category: 'fechas',
    icon: 'History',
    title: 'Cómo decir la fecha y la hora',
    summary: 'El asistente entiende muchas formas de decir cuándo. Estos son los formatos que reconoce.',
    tags: ['fecha', 'hora', 'cuando', 'mañana', 'en 3 horas', 'viernes', 'formato'],
    content: [
      { type: 'p', text: 'Podés decir la fecha y hora de muchas formas, y las entiende todas:' },
      { type: 'ex', items: [
        'hoy 8pm    ·    mañana 10am',
        'en 3 horas    ·    en 30 minutos    ·    dentro de 2 días',
        'el viernes 3pm    ·    el jueves 10am',
        '22/06 16:00    ·    24/06 9am',
      ]},
      { type: 'tip', text: '¿Qué pasa si tenés un error de dedo (ej. "ñamana" o "jeuves")? El asistente no lo adivina mal: te vuelve a preguntar la fecha para que la escribas bien. Mejor eso que guardar una fecha equivocada.' },
    ],
  },
  {
    id: 'zona-horaria',
    category: 'fechas',
    icon: 'History',
    title: 'La zona horaria (importante)',
    summary: 'Por defecto el asistente interpreta y muestra todo en hora de Cancún. Si estás en otra zona, podés cambiarla en el CRM.',
    tags: ['zona horaria', 'cancun', 'hora', 'huso', 'bogota', 'timezone'],
    content: [
      { type: 'p', text: 'El bot interpreta y muestra todas las fechas en una zona horaria. Por defecto es Cancún (México). Si vos trabajás desde otra zona (por ejemplo Colombia), conviene ajustarla para que las horas te caigan bien.' },
      { type: 'steps', items: [
        'En el CRM (app.stratoscapitalgroup.com), buscá la sección "Zona horaria".',
        'Elegí tu zona en la lista (o tocá "Usar la detectada" para usar la de tu navegador).',
        'Tocá "Guardar zona horaria".',
      ]},
      { type: 'tip', text: 'Cuando el asistente te confirma algo, te aclara la zona entre paréntesis, ej: "el 25 de junio a las 15:00 hs (Cancún)". Así nunca hay confusión.' },
    ],
  },

  /* ═══════════ LO QUE HACE SOLO ═══════════ */
  {
    id: 'avisos-intro',
    category: 'solo',
    icon: 'Workflow',
    title: 'Lo que el asistente hace por vos solo',
    summary: 'No tenés que estar pidiendo: él te escribe en el momento justo. Son cuatro tipos de aviso.',
    tags: ['avisos', 'recordatorios', 'automatico', 'proactivo', 'solo'],
    content: [
      { type: 'p', text: 'El asistente trabaja en segundo plano y te escribe cuando tenés que actuar:' },
      { type: 'list', items: [
        'Antes de un Zoom (≈3 horas antes): resumen del cliente para entrar preparado.',
        'Próxima acción cercana: te la recuerda a tiempo, y de nuevo unos minutos antes.',
        'Cliente sin movimiento: te avisa de un cliente que llevás días sin atender.',
        'Acción de equipo: te pregunta si ya hiciste una tarea de tu Lista de Acción.',
      ]},
      { type: 'tip', text: 'Todos los avisos llegan en horario laboral (no te molesta de noche). Y casi todos traen botones para que respondas en un toque (ver "Los botones").' },
    ],
  },
  {
    id: 'aviso-zoom',
    category: 'solo',
    icon: 'Send',
    title: 'Resumen antes de tu Zoom',
    summary: '≈3 horas antes de un Zoom agendado, te llega un briefing estratégico del cliente.',
    tags: ['zoom', 'resumen', 'briefing', 'antes del zoom', '3 horas', 'preparado'],
    content: [
      { type: 'p', text: 'Cuando tenés un Zoom Agendado, unas 3 horas antes te llega un mensaje con el resumen del cliente: qué le interesa, su presupuesto, objeciones y un plan sugerido para la reunión. El objetivo es simple: que nunca entres en frío.' },
      { type: 'p', text: 'El mensaje trae botones para responder (ver la sección "Los botones").' },
    ],
  },
  {
    id: 'aviso-proxima',
    category: 'solo',
    icon: 'CheckSquare',
    title: 'Recordatorio de tu próxima acción',
    summary: 'Te recuerda lo que tenías agendado con un cliente, a tiempo, para que no se te pase.',
    tags: ['proxima accion', 'recordatorio', 'aviso', 'agendado', 'pendiente'],
    content: [
      { type: 'p', text: 'Si programaste una próxima acción con un cliente, el asistente te la recuerda cerca de la hora, y vuelve a avisar unos minutos antes. Si no confirmás tu plan, escala el aviso para que no quede en el aire.' },
    ],
  },
  {
    id: 'aviso-inactivo',
    category: 'solo',
    icon: 'AlertCircle',
    title: 'Cliente sin movimiento (lead abandonado)',
    summary: 'Si un cliente de etapa temprana lleva días sin que lo atiendas, te avisa para que lo retomes antes de que se enfríe.',
    tags: ['inactivo', 'abandonado', 'sin movimiento', 'retomar', 'enfriar', 'dias'],
    content: [
      { type: 'p', text: 'El asistente vigila tus clientes de etapas tempranas. Si uno lleva días sin movimiento, te escribe algo así: "Oye, [cliente] lleva días sin movimiento desde la última actividad el [fecha]. ¿Qué pasó? Revisá el CRM y registrá la acción o reagendá."' },
      { type: 'p', text: 'El mensaje trae 3 botones (ver la sección siguiente para saber qué hace cada uno).' },
    ],
  },

  /* ═══════════ LOS BOTONES ═══════════ */
  {
    id: 'botones-intro',
    category: 'botones',
    icon: 'CheckSquare',
    title: 'Cómo funcionan los botones (qué pasa al tocarlos)',
    summary: 'Cuando el asistente te avisa algo, te da botones. Cada botón hace una acción real en el CRM. Esto es lo que pasa con cada uno.',
    tags: ['botones', 'responder', 'que pasa', 'tocar boton', 'al presionar'],
    content: [
      { type: 'p', text: 'Los botones son la forma más rápida de responder: tocás uno y el asistente lo registra en el CRM al instante. No abren ninguna otra pantalla — la acción pasa en el momento.' },
      { type: 'warn', text: 'Cuando un botón te pide algo a cambio (por ejemplo, una fecha), respondele en ESE mismo chat. El asistente ya sabe de qué cliente se trata; vos solo completás lo que falta.' },
    ],
  },
  {
    id: 'botones-inactivo',
    category: 'botones',
    icon: 'AlertCircle',
    title: 'Botones del aviso de cliente sin movimiento',
    summary: 'Qué hace cada botón cuando te avisa de un lead abandonado.',
    tags: ['ya lo contacte', 'definir proxima accion', 'ver ficha', 'reagendar', 'botones inactivo'],
    content: [
      { type: 'list', items: [
        'Ya lo contacté → registra el contacto y el cliente vuelve a tu seguimiento activo (deja de marcarse como abandonado).',
        'Definir próxima acción → el bot te pregunta qué vas a hacer y para cuándo. Vos respondés y queda guardado en la ficha.',
        'Ver ficha del cliente → te muestra presupuesto, interés, objeciones y el resumen, sin salir del chat.',
      ]},
      { type: 'p', text: 'Ejemplo del flujo de "Definir próxima acción":' },
      { type: 'ex', items: [
        '(bot) ¿Cuál es la próxima acción y para cuándo?',
        '(vos) reactivarlo — mañana 3pm',
        '(bot) Listo, próxima acción de [cliente]: reactivarlo — el 25 de junio a las 15:00 hs (Cancún).',
      ]},
    ],
  },
  {
    id: 'botones-zoom',
    category: 'botones',
    icon: 'Send',
    title: 'Botones del resumen de Zoom',
    summary: 'Qué hace cada botón cuando te llega el briefing antes de un Zoom.',
    tags: ['botones zoom', 'ya estudie', 'plan', 'reagendar zoom', 'ver expediente'],
    content: [
      { type: 'list', items: [
        'Ya estudié, este es mi plan → confirmás que repasaste al cliente y mandás tu plan para la reunión. Queda registrado.',
        'Reagendar → el bot te pregunta la nueva fecha del Zoom y lo reprograma.',
        'Ver expediente → te muestra la información completa del cliente para terminar de prepararte.',
      ]},
      { type: 'tip', text: 'Responder "este es mi plan" le dice al sistema que estás encima — si no confirmás, el aviso escala a tu director/admin.' },
    ],
  },

  /* ═══════════ ACCIONES DE EQUIPO ═══════════ */
  {
    id: 'equipo-que-es',
    category: 'equipo',
    icon: 'UsersRound',
    title: '¿Qué son las Acciones de Equipo?',
    summary: 'Tareas de la "Lista de Acción" del equipo. El asistente te hace seguimiento por Telegram hasta que las cierres.',
    tags: ['acciones de equipo', 'lista de accion', 'comando directivo', 'tareas equipo'],
    content: [
      { type: 'p', text: 'Además de las acciones por cliente, está la "Lista de Acción" del equipo (en el Comando Directivo del CRM). Son tareas con fecha límite que el asistente te recuerda y te persigue hasta que las marques hechas.' },
      { type: 'p', text: 'Cuando vos (asesor) creás una acción de equipo, se asigna a vos automáticamente — es obvio que es para vos. Si la crea un admin, él elige a quién se la asigna.' },
      { type: 'tip', text: 'Toda acción de equipo lleva fecha y hora límite obligatoria — esa fecha es la que usa el asistente para recordarte.' },
    ],
  },
  {
    id: 'equipo-coach',
    category: 'equipo',
    icon: 'MessageCircle',
    title: 'El coach que te pregunta "¿ya la hiciste?"',
    summary: 'El asistente te avisa 1 día antes y 3 horas antes de cada acción de equipo, con 3 botones para responder.',
    tags: ['coach', 'ya la hice', 'en proceso', 'no la hice', 'seguimiento equipo'],
    content: [
      { type: 'p', text: 'El asistente te escribe 1 día antes y 3 horas antes de que venza cada acción de equipo tuya, con un mensaje como: "Seguimiento — Lista de Acción. Hola [tu nombre], ¿ya hiciste esta acción? [descripción] — Para el [fecha] hs (Cancún)". Y trae 3 botones:' },
      { type: 'list', items: [
        'Ya la hice → la marca como completada y deja de molestarte.',
        'En proceso → la anota y te responde "avisame cuando la cierres".',
        'No la hice → la anota y avisa a los admins para que te apoyen.',
      ]},
      { type: 'tip', text: 'Lo que respondés se refleja al instante en la pestaña "Indicadores · Productividad" del Comando Directivo: tu % de avance sube cuando marcás acciones como hechas.' },
    ],
  },

  /* ═══════════ SI SOS ADMIN ═══════════ */
  {
    id: 'admin-intro',
    category: 'admin',
    icon: 'ShieldUser',
    title: 'Lo extra que podés hacer si sos admin',
    summary: 'Si tu rol es admin / super_admin / CEO / director (por ejemplo Oscar), el asistente te da más poderes que a un asesor.',
    tags: ['admin', 'super admin', 'director', 'ceo', 'permisos', 'oscar'],
    content: [
      { type: 'p', text: 'Un asesor ve y trabaja solo con SUS clientes. Un admin opera sobre todo el equipo. Como admin sumás:' },
      { type: 'list', items: [
        'Ver los KPIs y el pipeline de TODOS los asesores, no solo los tuyos.',
        'Asignar / reasignar un cliente a un asesor del equipo.',
        'Crear acciones de equipo y asignarlas a cualquier asesor (vos elegís el responsable; al asesor que crea una acción se le auto-asigna a sí mismo).',
        'Recibir las escalaciones: cuando un asesor no confirma su plan de Zoom o responde "No la hice" a una acción de equipo, te llega el aviso para apoyarlo.',
      ]},
      { type: 'warn', text: 'Para recibir las escalaciones en Telegram, tu perfil de admin también tiene que estar conectado al bot (mismo paso de "Conectá tu Telegram"). Si no, las escalaciones se registran en el CRM pero no te llegan al chat.' },
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
      { type: 'ex', items: [
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
    title: 'Ver los números del equipo completo',
    summary: 'Como admin ves los KPIs globales, no solo los tuyos.',
    tags: ['kpis equipo', 'numeros globales', 'dashboard', 'pipeline equipo', 'admin'],
    content: [
      { type: 'p', text: 'Pedile los KPIs y ves el panorama de todo el equipo: leads totales, calientes, pipeline por etapa, pendientes y vencidos de todos los asesores.' },
      { type: 'tip', text: 'En el CRM web, el Comando Directivo tiene 3 pestañas: Indicadores · Leads, Indicadores · Zooms e Indicadores · Productividad (esta última muestra el avance de cada asesor en su Lista de Acción).' },
    ],
  },

  /* ═══════════ DUDAS Y PROBLEMAS ═══════════ */
  {
    id: 'faq',
    category: 'tips',
    icon: 'HelpCircle',
    title: 'Preguntas frecuentes (¿qué pasa si…?)',
    summary: 'Las dudas más comunes, resueltas.',
    tags: ['preguntas', 'faq', 'que pasa si', 'dudas', 'comunes'],
    content: [
      { type: 'list', items: [
        '¿Qué pasa si me equivoco en una fecha? El bot te la vuelve a preguntar — escribila bien y listo.',
        '¿Qué pasa si creo un cliente sin etapa? Lo pone en "Contáctame Ya" y te avisa.',
        '¿Qué pasa si no toco ningún botón del recordatorio? El aviso puede escalar a tu director/admin. Mejor respondé.',
        '¿Otros ven mis clientes? No. Cada quien ve solo los suyos. Los admins ven los de todos.',
        '¿Puedo usarlo desde la computadora? Sí, Telegram funciona en celular y en compu con la misma cuenta.',
      ]},
    ],
  },
  {
    id: 'problemas',
    category: 'tips',
    icon: 'LifeBuoy',
    title: 'Si algo no funciona',
    summary: 'Qué revisar antes de pedir ayuda.',
    tags: ['problema', 'no funciona', 'error', 'no me llega', 'ayuda', 'soporte'],
    content: [
      { type: 'list', items: [
        'No te llegan avisos: revisá que tu Telegram esté conectado (sección "Conectar Telegram"). Si cambiaste de teléfono, reconectá.',
        'Una acción no notifica: asegurate de que tenga un responsable. Las acciones "sin asignar" no mandan recordatorio (no hay a quién avisarle).',
        'El bot no entiende una fecha: casi siempre es un error de dedo. Volvé a escribirla (mañana 3pm, en 3 horas, 24/06 16:00).',
        'No estás seguro de cómo pedir algo: escribí hola para ver el resumen, o decílo con tus palabras.',
      ]},
      { type: 'tip', text: 'Si nada de esto lo resuelve, escribile al soporte por WhatsApp (el botón de abajo) con una captura del chat.' },
    ],
  },
];

/** Búsqueda genérica (mismo contrato que searchManual). */
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
