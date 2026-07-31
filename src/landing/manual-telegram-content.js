/**
 * manual-telegram-content.js — Manual del COPILOT / Asistente IA (Duke del Caribe)
 *
 * URL pública: stratoscapitalgroup.com/manual-asistente-telegram
 * Audiencia: asesores (muchos no son técnicos) + sección extra para admins.
 * Español NEUTRO (cliente mexicano): tú/puedes/háblale — nunca vos/podés.
 *
 * Actualizado 31-jul-2026: el Copilot dentro del sistema es la superficie
 * principal (audio con Enter, dictado de actividades con plan y correcciones,
 * recordatorios con botones de estado); Telegram queda como plus opcional.
 *
 * Bloques soportados por ManualCRM.jsx: p / steps / list / tip / warn / flow / ex
 *   flow: { type:'flow', items:[{ n, title, text }] }   diagrama de pasos en tarjetas
 *   ex:   { type:'ex',   items:['…','…'] }               ejemplos "escríbele así" (chips)
 */

export const CATEGORIES_TG = [
  { id: 'empezar',  label: 'Empezar de cero',        icon: 'Send' },
  { id: 'pedidos',  label: 'Qué le puedes pedir',    icon: 'MessageCircle' },
  { id: 'equipo',   label: 'Actividades del equipo', icon: 'UsersRound' },
  { id: 'fechas',   label: 'Fechas y horas',         icon: 'History' },
  { id: 'solo',     label: 'Lo que hace solo',       icon: 'Workflow' },
  { id: 'botones',  label: 'Los botones',            icon: 'CheckSquare' },
  { id: 'admin',    label: 'Si eres admin',          icon: 'ShieldUser' },
  { id: 'tips',     label: 'Dudas y problemas',      icon: 'LifeBuoy' },
];

export const MANUAL_SECTIONS_TG = [
  /* ═══════════ EMPEZAR DE CERO ═══════════ */
  {
    id: 'que-es',
    category: 'empezar',
    icon: 'Sparkles',
    title: '¿Qué es tu Copilot?',
    summary: 'Tu asistente inteligente conectado en vivo a tu CRM. Vive DENTRO del sistema (pestaña Copilot) y funciona solo con tu login. Le hablas o le mandas un audio y hace el trabajo por ti. Telegram es un plus opcional.',
    tags: ['asistente', 'bot', 'telegram', 'copilot', 'que es', 'para que sirve', 'sin telegram'],
    content: [
      { type: 'p', text: 'Imagina tener un asistente que conoce a todos tus clientes y nunca se olvida de nada. Eso es tu Copilot: le hablas como a un compañero y hace el trabajo por ti. Lo tienes DENTRO del sistema, en la pestaña "Copilot" (app.stratoscapitalgroup.com) — funciona solo con tu login, sin conectar nada más.' },
      { type: 'p', text: 'Le escribes o le mandas un audio, y él trabaja dentro del sistema: registra clientes, agenda zooms, programa actividades para el equipo, busca fichas, te recuerda lo importante y te avisa antes de cada compromiso. Todo lo que haces por el chat queda guardado al instante en el CRM.' },
      { type: 'list', items: [
        'Trabajas desde el celular, sin abrir la computadora.',
        'No se te escapa ningún cliente: él te persigue a ti, no al revés.',
        'Llegas preparado a cada reunión y a cada llamada.',
      ]},
      { type: 'tip', text: 'No hay que memorizar comandos ni menús. Háblale natural, con tus palabras. Tolera errores de dedo y audios revueltos; y si algo no le queda claro, te lo pregunta en vez de adivinar.' },
      { type: 'p', text: 'Telegram es OPCIONAL — un plus. Si lo conectas, recibes las mismas alertas y puedes operar también desde tu chat de Telegram. Es el MISMO asistente en las dos superficies, con las mismas capacidades: todo este manual sirve en ambas. Las notificaciones (Zoom, actividades, recordatorios) te llegan igual al teléfono desde el Copilot, con la app instalada.' },
    ],
  },
  {
    id: 'audio-copilot',
    category: 'empezar',
    icon: 'MessageCircle',
    title: 'Mándale audios (no hace falta escribir)',
    summary: 'Toca el micrófono del chat, habla normal y presiona Enter: se corta y se envía en un solo gesto. Ideal manejando o con las manos ocupadas.',
    tags: ['audio', 'nota de voz', 'voz', 'hablar', 'sin escribir', 'microfono', 'enter', 'dictar'],
    content: [
      { type: 'p', text: 'No siempre puedes escribir. En el Copilot toca el micrófono (a la izquierda del cuadro de texto), habla normal y, cuando termines, presiona Enter: la grabación se corta y se envía en un solo gesto. Con Escape la cancelas. Si prefieres el mouse, toca "Listo" y revisa la nota antes de enviarla.' },
      { type: 'p', text: 'Mientras grabas vas a ver el texto crudo tal como lo oye el teléfono — con errores y palabras pegadas. No te preocupes: la limpieza pasa al enviar. El asistente entiende audios largos y revueltos, separa cada cosa que pediste y las ejecuta todas.' },
      { type: 'ex', items: [
        '(audio) "Agenda el zoom de Carlos para el viernes a las 11 de la mañana"',
        '(audio) "Crea un cliente, Mariana López, teléfono 521 55 1234 5678, llamarla en 4 horas"',
        '(audio) "Necesito que Cecilia organice su CRM mañana a las 9:45 y que haga 35 llamadas antes de las 5"',
      ]},
      { type: 'tip', text: 'En Telegram también puedes mandarle notas de voz de toda la vida (mantén presionado el micrófono y suelta). Mismo asistente, mismo resultado.' },
      { type: 'warn', text: 'Si tu navegador no convierte la voz en texto (pasa en Brave y en la app de Android), el asistente te lo dice con claridad en vez de inventar un mensaje. Ahí conviene dictar desde Chrome o Safari, o escribir.' },
    ],
  },
  {
    id: 'como-hablarle',
    category: 'empezar',
    icon: 'MessageCircle',
    title: '¿Cómo le hablo? (ya no hay menús)',
    summary: 'Le escribes o le mandas audio en lenguaje normal, como a un compañero. Sin comandos ni menús.',
    tags: ['como hablar', 'lenguaje natural', 'escribir', 'menu', 'comandos', 'hola', 'que puedes hacer'],
    content: [
      { type: 'p', text: 'El asistente entiende lo que dices en lenguaje normal. No tienes que aprender comandos raros: dile qué necesitas como se lo dirías a una persona.' },
      { type: 'ex', items: [
        '"busca a Diana"',
        '"cuántos clientes tengo en pipeline"',
        '"pasa a Felipe a Seguimiento"',
        '"recuérdame llamar a Juan mañana 9am"',
      ]},
      { type: 'tip', text: 'Si le escribes "hola" o le preguntas "¿qué puedes hacer?", te muestra un resumen de sus capacidades con el enlace a este manual. Pero no es obligatorio: ve directo al grano.' },
    ],
  },
  {
    id: 'que-es-telegram',
    category: 'empezar',
    icon: 'Send',
    title: '¿Quieres además Telegram? (opcional)',
    summary: 'Telegram es una app de mensajería gratis, parecida a WhatsApp. Es un plus: el Copilot ya funciona sin ella.',
    tags: ['telegram', 'instalar', 'descargar', 'app', 'que es telegram', 'opcional'],
    content: [
      { type: 'p', text: 'El Copilot del CRM no necesita Telegram para nada. Pero si te gusta trabajar desde una app de mensajería, puedes conectar el mismo asistente a tu Telegram y usarlo desde ahí también. Telegram es una aplicación gratuita, muy parecida a WhatsApp:' },
      { type: 'steps', items: [
        'En tu celular, abre la tienda de apps (Play Store en Android, App Store en iPhone).',
        'Busca "Telegram" y toca Instalar.',
        'Ábrela y regístrate con tu número de teléfono (te llega un código por SMS).',
        'Listo. Ahora sigue "Conecta tu Telegram" (siguiente sección).',
      ]},
    ],
  },
  {
    id: 'conectar',
    category: 'empezar',
    icon: 'LogIn',
    title: 'Conecta tu Telegram (opcional, una sola vez)',
    summary: 'OPCIONAL — el Copilot ya funciona sin esto. Si quieres operar también desde Telegram, vincúlalo con un código (una sola vez, 2 minutos).',
    tags: ['conectar', 'vincular', 'codigo', 'start', 'generar codigo', 'parear', 'primera vez', 'bot', 'opcional'],
    content: [
      { type: 'p', text: 'Ojo: esto es OPCIONAL. En el Copilot del CRM el asistente ya sabe quién eres por tu login y te muestra TUS clientes. Conecta Telegram solo si además quieres usarlo desde tu chat. Son 3 pasos:' },
      { type: 'flow', items: [
        { n: '1', title: 'Abre el bot en Telegram', text: 'En Telegram, en la lupa de buscar, escribe @Strato_sasistente_crm_bot. Abre ese chat y toca Iniciar (o escribe /start).' },
        { n: '2', title: 'Genera tu código en el CRM', text: 'Entra a app.stratoscapitalgroup.com, inicia sesión, y abajo busca la sección "Conectar Telegram". Toca "Generar código" — te da un código de 8 dígitos.' },
        { n: '3', title: 'Pega el código en el chat', text: 'Vuelve al chat del bot y mándale ese código. Cuando veas "Conectado, [tu nombre]" ya está. Escribe hola para empezar.' },
      ]},
      { type: 'warn', text: 'El bot correcto es @Strato_sasistente_crm_bot (revisa bien el nombre). El código vence en unos minutos: si se te pasa, genera uno nuevo.' },
      { type: 'tip', text: 'Tu Telegram queda ligado SOLO a tu perfil — nadie más ve ni toca tus clientes. Si cambias de teléfono, repite estos 3 pasos.' },
    ],
  },

  /* ═══════════ QUÉ LE PUEDES PEDIR ═══════════ */
  {
    id: 'crear-cliente',
    category: 'pedidos',
    icon: 'UserPlus',
    title: 'Crear un cliente nuevo (estés donde estés)',
    summary: 'Te llegó un lead y no estás frente a la computadora. Créalo desde el chat en segundos y queda asignado a ti.',
    tags: ['crear cliente', 'nuevo lead', 'registrar', 'agregar cliente', 'alta', 'fuera de la pc'],
    content: [
      { type: 'p', text: 'Estás en la calle, en un evento o saliendo de una reunión y te pasan un contacto. No esperes a llegar a la computadora: regístralo ahí mismo desde el chat.' },
      { type: 'ex', items: [
        '"crea el cliente Mariana, teléfono 5215512345678, llamarla en 4 horas"',
        '"nuevo lead: Diego Torres, 521..., contactarlo hoy 6pm"',
      ]},
      { type: 'p', text: 'Queda creado, asignado a ti, y con su primera próxima acción cargada. Por defecto entra en la etapa "Contáctame Ya".' },
      { type: 'tip', text: '¿Qué pasa si no dices la etapa? El asistente la pone en "Contáctame Ya" (la de contacto inmediato) y te avisa. Si quieres otra, agrega "…en etapa Segundo Intento".' },
      { type: 'tip', text: 'Reconoce la campaña aunque la digas o escribas un poco mal: "Bay View Grand" la entiende aunque pongas "bayview" o "BVG".' },
    ],
  },
  {
    id: 'registro-masivo',
    category: 'pedidos',
    icon: 'Users',
    title: 'Registrar muchos clientes de una vez',
    summary: 'Pega una lista de clientes (nombre y teléfono) en un solo mensaje y el asistente los registra todos juntos.',
    tags: ['masivo', 'varios clientes', 'lista', 'cargar muchos', 'importar', 'lote', 'varios a la vez'],
    content: [
      { type: 'p', text: 'Si tienes una lista de varios clientes para cargar, no los registres uno por uno. Pega la lista entera en un solo mensaje —una línea por cliente, con nombre y teléfono (y la campaña si quieres)— y el asistente los registra a todos juntos.' },
      { type: 'ex', items: [
        '"Registra estos clientes: Juan Pérez, 5215511112222 — María López, 5215533334444 Bay View Grand"',
      ]},
      { type: 'p', text: 'Te responde con un resumen (por ejemplo "Procesé 14 clientes: 14 nuevos"). Todos quedan en "Contáctame Ya". Si alguno ya existía, lo reasigna conservando su historial; y si a alguno le falta el nombre, te avisa cuál para que lo corrijas.' },
      { type: 'tip', text: 'Lo único obligatorio por cada cliente es el nombre y el teléfono. La campaña es opcional.' },
    ],
  },
  {
    id: 'proxima-accion',
    category: 'pedidos',
    icon: 'CheckSquare',
    title: 'Programar la próxima acción de un cliente',
    summary: 'Dile a quién, qué vas a hacer y cuándo. Lo guarda en la ficha y te lo recuerda a tiempo.',
    tags: ['proxima accion', 'tarea', 'recordatorio', 'agendar', 'pendiente', 'seguimiento'],
    content: [
      { type: 'p', text: 'Dile el cliente, la acción y la fecha/hora, todo en una frase:' },
      { type: 'ex', items: [
        '"pon la próxima acción de Ceci: enviar whatsapp, hoy 8pm"',
        '"próxima acción con Mariana: mandar la propuesta el viernes 11am"',
      ]},
      { type: 'p', text: 'La guarda en la ficha del cliente y se encarga de recordártela: un aviso 3 horas antes para que repases la ficha, y otro 10 minutos antes para que no se te pase (ver "Lo que hace solo").' },
      { type: 'tip', text: '¿Qué pasa si no pones la hora? Te la pregunta. Respóndele en el mismo chat con el día y la hora — él ya sabe de qué cliente se trata. También puedes ponerla desde el CRM (la ficha del cliente): los recordatorios salen igual.' },
    ],
  },
  {
    id: 'cambiar-accion',
    category: 'pedidos',
    icon: 'MoveRight',
    title: 'Cambiar o actualizar una acción del cliente',
    summary: 'Cambiaron los planes con un cliente. Actualiza su próxima acción o reagéndala desde el chat.',
    tags: ['cambiar accion', 'actualizar', 'reagendar', 'modificar', 'mover', 'reprogramar'],
    content: [
      { type: 'p', text: 'Si lo que tenías agendado cambió, díselo y lo actualiza:' },
      { type: 'ex', items: [
        '"cambia la próxima acción de Felipe a: reenviar cotización, mañana 3pm"',
        '"reagenda el zoom de Carlos para el lunes 10am"',
      ]},
      { type: 'p', text: 'El cambio queda registrado en el historial del cliente, y el asistente recalcula los recordatorios con la nueva fecha.' },
    ],
  },
  {
    id: 'agendar-zoom',
    category: 'pedidos',
    icon: 'Workflow',
    title: 'Agendar un Zoom',
    summary: 'Programa la reunión con el cliente. Pasa a la etapa Zoom Agendado y el asistente te prepara antes.',
    tags: ['zoom', 'agendar', 'reunion', 'cita', 'meet', 'zoom agendado'],
    content: [
      { type: 'ex', items: [
        '"pon el zoom de Carlos el viernes 11am"',
        '"cambia la etapa de Felipe a Zoom Agendado mañana 10am"',
      ]},
      { type: 'p', text: 'El cliente pasa a la etapa Zoom Agendado con la fecha y hora que diste. Y unas 3 horas antes, el asistente te manda un resumen del cliente para que entres preparado (ver "Lo que hace solo").' },
    ],
  },
  {
    id: 'agendar-visita',
    category: 'pedidos',
    icon: 'Home',
    title: 'Agendar una visita',
    summary: 'Programa la visita presencial del cliente. El asistente te recuerda 1 mes, 15 días, 1 semana y 1 día antes.',
    tags: ['visita', 'agendar visita', 'presencial', 'visita agendada', 'recorrido', 'tour'],
    content: [
      { type: 'ex', items: [
        '"agenda la visita de Carlos para el 15 de agosto a las 10am"',
        '(audio) "programa la visita de Mariana el viernes 2pm"',
      ]},
      { type: 'p', text: 'El cliente pasa a la etapa Visita Agendada con la fecha que diste, y el asistente se encarga de recordártela a tiempo (ver "Recordatorios de tus visitas").' },
      { type: 'warn', text: 'La fecha y hora de la visita es obligatoria. Si pasas un cliente a "Visita Agendada" sin decir cuándo, el asistente te la pide antes de guardar (igual que con el Zoom).' },
      { type: 'tip', text: 'También puedes agendarla desde el CRM web: al mover un cliente a "Visita Agendada" te pide la fecha y hora. En ambos casos salen los mismos recordatorios.' },
    ],
  },
  {
    id: 'cambiar-etapa',
    category: 'pedidos',
    icon: 'Layers',
    title: 'Mover un cliente de etapa',
    summary: 'Avanza un cliente en el pipeline desde el chat, sin abrir el CRM. Por nombre de etapa o por número.',
    tags: ['etapa', 'cambiar etapa', 'pipeline', 'mover', 'seguimiento', 'aparto', 'cierre', 'postventa', 'tercera etapa'],
    content: [
      { type: 'ex', items: [
        '"pasa a Felipe a Seguimiento"',
        '"mueve a Sofía a Apartó"',
        '"pasa a Pepito a la tercera etapa"',
        '"mueve a Beatriz a Cierre, ya firmó"',
      ]},
      { type: 'p', text: 'Reconoce todas las etapas de tu CRM (Contáctame Ya, Segundo Intento, Tercer Intento, Rotación, Remarketing IA, Zoom Agendado, Zoom Concretado, Seguimiento, Largo Plazo, Apartó, Visita Agendada, Cierre, Postventa), sin importar mayúsculas ni acentos. Y también entiende la POSICIÓN: "tercera etapa", "etapa 3" o "la 3" es la tercera del pipeline. Cada movimiento queda en el historial. ¿Te equivocaste? Dile la etapa correcta y lo corrige.' },
      { type: 'tip', text: 'Los nombres con número también los entiende como los digas: "Pepito 2" y "Pepito dos" son el mismo cliente para él.' },
    ],
  },
  {
    id: 'buscar-ficha',
    category: 'pedidos',
    icon: 'FileSearch',
    title: 'Buscar un cliente y consultar todo: ficha, notas, expediente',
    summary: 'Encuentra un cliente y consulta su información completa — por nombre o por teléfono, desde el chat.',
    tags: ['buscar', 'encontrar', 'ficha', 'expediente', 'notas', 'historial', 'informacion', 'consultar', 'telefono'],
    content: [
      { type: 'p', text: 'Antes de llamar a un cliente, repásalo en 5 segundos desde el chat:' },
      { type: 'ex', items: [
        '"busca a Diana"  → te muestra su ficha.',
        '"¿qué teléfono tiene Pepito dos?"  → la ficha con su número.',
        '"ver expediente de Carlos"  → notas, presupuesto, objeciones, resumen.',
        '"historial de Felipe"  → todos los movimientos del cliente.',
      ]},
      { type: 'p', text: 'En la ficha ves presupuesto, proyecto de interés, objeciones, etapa y un resumen. Puedes buscar por nombre (aunque tenga números: "Pepito 2" y "Pepito dos" son lo mismo) o por una parte del teléfono. Si hay dos clientes con el mismo nombre, te pregunta a cuál te refieres.' },
      { type: 'tip', text: 'Útil cuando estás por entrar a un Zoom o una llamada y necesitas recordar dónde quedó el cliente.' },
    ],
  },
  {
    id: 'kpis-agenda-pipeline',
    category: 'pedidos',
    icon: 'LayoutDashboard',
    title: 'Consultar tus KPIs, tu agenda y tu pipeline',
    summary: 'Tus números, tus pendientes y tu embudo, todo desde el chat.',
    tags: ['kpis', 'numeros', 'metricas', 'agenda', 'mis clientes', 'pipeline', 'dashboard', 'que tengo hoy'],
    content: [
      { type: 'ex', items: [
        '"kpis"           → leads, calientes, pipeline, pendientes y vencidos.',
        '"mis clientes"   → tu cartera con la próxima acción de cada uno.',
        '"¿qué tengo hoy?" → tu agenda personal y profesional del día.',
        '"pipeline"       → cuántos clientes tienes en cada etapa.',
      ]},
    ],
  },
  {
    id: 'crear-recordatorio',
    category: 'pedidos',
    icon: 'AlarmClock',
    title: 'Pedirle un recordatorio personal',
    summary: 'Dile "recuérdame…" y a la hora que pediste te escribe. Sirve para cualquier cosa, sea o no de un cliente.',
    tags: ['recordatorio', 'recuerdame', 'avisame', 'personal', 'alarma', 'recordar'],
    content: [
      { type: 'p', text: 'Además de los avisos automáticos, tú puedes pedirle recordatorios cuando quieras. Dile qué y cuándo, y a esa hora te escribe por el chat.' },
      { type: 'ex', items: [
        '"recuérdame llamar al banco en 2 horas"',
        '"avísame mañana 9am de mandar la propuesta a Carlos"',
        '(audio) "recuérdame el viernes a las 8 que tengo reunión"',
      ]},
      { type: 'tip', text: 'Entiende fechas en español ("el 3 de agosto", "el viernes 2pm", "en 30 minutos") y respeta tu zona horaria. Es para ti: no aparece en el CRM, es tu recordatorio personal.' },
    ],
  },
  {
    id: 'catalogo-propiedades',
    category: 'pedidos',
    icon: 'Building2',
    title: 'Pregúntale por propiedades del catálogo',
    summary: 'El asistente conoce el catálogo de desarrollos y te responde por zona, precio, recámaras o cercanía al mar.',
    tags: ['propiedades', 'catalogo', 'desarrollos', 'inmuebles', 'zona', 'precio', 'recamaras', 'mar', 'drive', 'proyectos'],
    content: [
      { type: 'p', text: 'El asistente ya conoce el catálogo de desarrollos. Pregúntale en lenguaje normal (o por audio) y te responde al instante con los proyectos que mejor coinciden y sus enlaces de Drive para ver fotos y detalles.' },
      { type: 'p', text: 'Filtra de verdad por PRESUPUESTO y por ZONA a la vez. Dile el monto como quieras ("menos de 200 mil", "más de 1 millón", "entre 250 y 350 mil") y te muestra solo las que entran.' },
      { type: 'ex', items: [
        '"Dame 3 propiedades en Cancún por menos de 200 mil"',
        '"Propiedades en Tulum de más de 1 millón"',
        '"Top 3 en Playa del Carmen entre 250 y 350 mil"',
        '"2 recámaras cerca del mar"',
      ]},
      { type: 'tip', text: 'Puedes pedir un "top 3" o "top 5" para acotar. Combina zona + presupuesto + recámaras + "cerca del mar" en una sola frase.' },
      { type: 'warn', text: 'Si en un rango de precio no hay desarrollos con precio cargado, el asistente te avisa y te muestra igual las de esa zona — no te deja sin respuesta.' },
    ],
  },
  {
    id: 'recomendar-a-cliente',
    category: 'pedidos',
    icon: 'Sparkles',
    title: 'Que te recomiende propiedades para un cliente puntual',
    summary: 'Le dices el nombre de tu cliente y el asistente mira su expediente (presupuesto y zona) y te propone las propiedades que le encajan, explicándote por qué.',
    tags: ['recomendar', 'recomiendame', 'propiedades', 'cliente', 'lead', 'presupuesto', 'zona', 'sugerir', 'que le ofrezco'],
    content: [
      { type: 'p', text: 'En vez de buscar a mano, deja que el asistente arme la recomendación. Le dices "recomiéndame una propiedad para [cliente]" y él revisa el expediente de ESE cliente: cuánto tiene de presupuesto y en qué zona quiere. Con eso te propone lo que mejor le calza y te dice el porqué.' },
      { type: 'ex', items: [
        '"¿Qué le recomiendo al cliente Pepito?"',
        '"Recomiéndame una propiedad para Marlene"',
        '"Qué propiedades le ofrezco a Juan"',
      ]},
      { type: 'tip', text: 'Si el cliente todavía no tiene presupuesto o zona en su expediente, el asistente te lo dice y te muestra igual las de su zona. Cárgale esos datos en las notas y las recomendaciones salen más finas.' },
      { type: 'warn', text: 'Si tienes dos clientes con el mismo nombre, primero te pregunta a cuál te refieres (nombre completo o teléfono) — así no recomienda para el cliente equivocado.' },
    ],
  },

  /* ═══════════ ACTIVIDADES DEL EQUIPO ═══════════ */
  {
    id: 'dictar-actividades',
    category: 'equipo',
    icon: 'UsersRound',
    title: 'Dicta varias actividades de una vez (el plan)',
    summary: 'Di todo lo que necesitas en un solo mensaje o audio — para una persona, para varias o para ti. El asistente arma el plan, te lo muestra y no crea nada hasta que confirmes.',
    tags: ['dictar', 'actividades', 'plan', 'varias tareas', 'programar actividades', 'confirmo', 'para mi', 'equipo'],
    content: [
      { type: 'p', text: 'La forma más poderosa de programar el trabajo: dilo todo de corrido, como se lo dirías a tu equipo en voz alta. El asistente separa cada actividad, identifica al responsable y la hora de cada una, y te muestra el PLAN antes de crear nada.' },
      { type: 'ex', items: [
        '(audio) "Necesito que Cecilia organice su CRM mañana a las 9:45, que haga entre 35 y 50 llamadas antes de las 5, y que reciba la capacitación de las nuevas funciones a las 2:30"',
        '"Que Carlos contacte los 20 leads de segunda etapa hoy antes de las 4 y les haga seguimiento a las 8"',
        '"Una cosa para mí: revisar los contratos del notario el viernes a las 4"',
      ]},
      { type: 'p', text: 'Te responde con el plan — cada responsable con sus actividades y horas — y la pregunta "¿Confirmo?". Ahí decides:' },
      { type: 'list', items: [
        'Confirmar: responde "sí", "dale" o "confirmo" → se crean todas y cada quien la ve en su Agenda.',
        'Corregir una: "la del reporte mejor a las 7 y media" o "la de los contratos que la haga Carlos" → solo esa cambia y te repite el plan.',
        'Cambiar el responsable: responde "para [nombre]" → se reasigna.',
        'Cancelar: "olvídalo" → no se crea nada.',
      ]},
      { type: 'tip', text: '"Para mí", "yo" o "conmigo" te asigna la actividad a ti mismo. Y puedes hacerle una PREGUNTA en medio ("¿qué tiene pendiente Carlos?") sin perder el plan: te responde y el plan sigue esperando tu confirmación.' },
      { type: 'warn', text: 'Si a una actividad le falta el responsable o la hora, el asistente te lo pide con claridad — no inventa. Y si no dices hora, la actividad queda "sin hora" ese día (los recordatorios de hora exacta solo salen cuando hay hora).' },
    ],
  },
  {
    id: 'equipo-que-es',
    category: 'equipo',
    icon: 'CheckSquare',
    title: 'La Agenda: donde viven las actividades',
    summary: 'Todo lo que confirmas por chat aparece en Mi Espacio → Agenda, y lo que asignas desde la pantalla también avisa por el chat. Son la misma cosa.',
    tags: ['agenda', 'mi espacio', 'actividades', 'lista', 'asignar desde pantalla', 'equipo'],
    content: [
      { type: 'p', text: 'Las actividades del equipo viven en Mi Espacio → Agenda. El chat y la pantalla son dos puertas a lo mismo: lo que confirmas por el Copilot aparece al instante en la Agenda, y lo que asignas desde la pantalla (el campo "Escribe la siguiente acción…" con responsable, fecha y hora) también dispara el aviso al asesor por su chat.' },
      { type: 'p', text: 'Cuando te asignan una actividad, te llega un aviso limpio: "Nueva actividad asignada: … — te la asignó [quien]. La ves en Mi Espacio → Agenda." (puede tardar 1 a 3 minutos: los avisos salen en una cola ordenada).' },
      { type: 'tip', text: 'Marca las actividades hechas — desde los botones del recordatorio o en la Agenda — y el avance del equipo se refleja en los indicadores del Comando Directivo.' },
    ],
  },
  {
    id: 'equipo-coach',
    category: 'equipo',
    icon: 'MessageCircle',
    title: 'El coach que no te deja quedar mal',
    summary: 'Antes de la hora de cada actividad te llegan recordatorios con botones: 1 hora antes, 10 minutos antes y a la hora exacta.',
    tags: ['coach', 'ya la hice', 'en proceso', 'no la hice', 'seguimiento equipo', 'recordatorios actividades'],
    content: [
      { type: 'p', text: 'Cada actividad con hora trae su cadena de recordatorios: "En 1 hora: … (hoy 3:00 p.m.)", "En 10 minutos: …" y "Es la hora: …". Los tres llegan con botones para responder en un toque:' },
      { type: 'list', items: [
        'Hecho → la marca completada y deja de recordártela.',
        'En proceso → la anota y te vuelve a preguntar en un rato.',
        'No la hice → la anota y avisa a los administradores para que te apoyen.',
      ]},
      { type: 'tip', text: 'El aviso de "Nueva actividad asignada" llega limpio, sin botones — los botones aparecen en los recordatorios, que es cuando tiene sentido responder.' },
    ],
  },

  /* ═══════════ FECHAS Y HORAS ═══════════ */
  {
    id: 'formato-fechas',
    category: 'fechas',
    icon: 'History',
    title: 'Cómo decir la fecha y la hora',
    summary: 'El asistente entiende muchas formas de decir cuándo — hasta la hora en palabras.',
    tags: ['fecha', 'hora', 'cuando', 'mañana', 'en 3 horas', 'viernes', 'formato', 'a las diez'],
    content: [
      { type: 'p', text: 'Puedes decir la fecha y hora de muchas formas, y las entiende todas:' },
      { type: 'ex', items: [
        'hoy 8pm    ·    mañana 10am    ·    mañana temprano',
        'en 3 horas    ·    en 30 minutos    ·    dentro de 2 días',
        'el viernes 3pm    ·    a las diez    ·    a la una de la tarde',
        '22/08 16:00    ·    24/08 9am',
      ]},
      { type: 'p', text: 'La hora también en PALABRAS: "a las diez", "a la una de la tarde", "a las doce". Y una hora pelada se entiende de día: "a las 8" es de la mañana/noche según el contexto laboral, y de la 1 a las 6 se asume de la tarde. Si dices "de la mañana" o "am", manda eso.' },
      { type: 'tip', text: '¿Error de dedo (ej. "ñamana")? El asistente no adivina mal: te vuelve a preguntar la fecha para que la escribas bien. Mejor eso que guardar una fecha equivocada.' },
    ],
  },
  {
    id: 'zona-horaria',
    category: 'fechas',
    icon: 'History',
    title: 'La zona horaria (importante)',
    summary: 'Por defecto el asistente interpreta y muestra todo en hora de Cancún. Si estás en otra zona, puedes cambiarla en el CRM.',
    tags: ['zona horaria', 'cancun', 'hora', 'huso', 'timezone'],
    content: [
      { type: 'p', text: 'El asistente interpreta y muestra todas las fechas en una zona horaria. Por defecto es Cancún (México). Si trabajas desde otra zona, conviene ajustarla para que las horas te caigan bien.' },
      { type: 'steps', items: [
        'En el CRM (app.stratoscapitalgroup.com), busca la sección "Zona horaria".',
        'Elige tu zona en la lista (o toca "Usar la detectada" para usar la de tu navegador).',
        'Toca "Guardar zona horaria".',
      ]},
      { type: 'tip', text: 'Cuando el asistente te confirma algo, te aclara la hora legible, por ejemplo "mañana 9:45 a.m.". Así nunca hay confusión.' },
    ],
  },

  /* ═══════════ LO QUE HACE SOLO ═══════════ */
  {
    id: 'avisos-intro',
    category: 'solo',
    icon: 'Workflow',
    title: 'Lo que el asistente hace por ti solo',
    summary: 'No tienes que estar pidiendo: él te escribe en el momento justo.',
    tags: ['avisos', 'recordatorios', 'automatico', 'proactivo', 'solo'],
    content: [
      { type: 'p', text: 'El asistente trabaja en segundo plano y te escribe cuando tienes que actuar:' },
      { type: 'list', items: [
        'Antes de un Zoom (3 horas, 1 hora y 15 minutos antes): resumen del cliente y repaso del plan.',
        'Antes de una visita (1 mes, 15 días, 1 semana y 1 día antes): para que llegues preparado.',
        'Próxima acción con un cliente: aviso 3 horas antes (repasa su ficha) y 10 minutos antes.',
        'Actividades del equipo: 1 hora antes, 10 minutos antes y a la hora, con botones de estado.',
        'Cliente sin movimiento: te avisa de un cliente que llevas días sin atender.',
        'Recordatorios personales que tú le pediste.',
      ]},
      { type: 'tip', text: 'Los avisos que pueden esperar respetan tu horario laboral (no te molesta de noche); lo urgente de una cita agendada llega igual. Y casi todos traen botones para responder en un toque.' },
    ],
  },
  {
    id: 'aviso-zoom',
    category: 'solo',
    icon: 'Send',
    title: 'Resumen antes de tu Zoom',
    summary: 'Antes de un Zoom agendado te llegan tres avisos: 3 horas, 1 hora y 15 minutos antes.',
    tags: ['zoom', 'resumen', 'briefing', 'antes del zoom', '3 horas', '1 hora', '15 minutos', 'preparado', 'plan'],
    content: [
      { type: 'p', text: 'Cuando tienes un Zoom Agendado, el asistente te acompaña con tres avisos: ~3 horas antes te llega el resumen del cliente (qué le interesa, presupuesto, objeciones y un plan sugerido); 1 hora antes te recuerda repasar el plan; y 15 minutos antes, el aviso final para que estés listo. El objetivo es simple: que nunca entres en frío.' },
      { type: 'warn', text: 'Si a 1 hora del Zoom todavía no armaste el plan, el asistente te lo marca y además avisa a los administradores, para que el equipo no pierda la reunión.' },
      { type: 'p', text: 'El primer mensaje trae botones para responder (ver la sección "Los botones").' },
    ],
  },
  {
    id: 'aviso-visita',
    category: 'solo',
    icon: 'Home',
    title: 'Recordatorios de tus visitas',
    summary: 'Si agendaste una visita, el asistente te avisa a tiempo: 1 mes, 15 días, 1 semana y 1 día antes.',
    tags: ['visita', 'aviso visita', 'recordatorio visita', 'presencial', '1 dia antes', 'un mes antes'],
    content: [
      { type: 'p', text: 'Cuando un cliente tiene una Visita Agendada, no tienes que acordarte tú: el asistente te escribe en cada momento clave, con la acción de cada etapa.' },
      { type: 'list', items: [
        '1 mes antes: confirma la asistencia y ayuda con los vuelos / la logística.',
        '15 días antes: reconfirma la visita y empieza a preparar la postventa.',
        '1 semana antes: aviso final, deja todo listo.',
        '1 día antes: último repaso — hora, dirección y que esté todo en orden.',
      ]},
    ],
  },
  {
    id: 'aviso-proxima',
    category: 'solo',
    icon: 'CheckSquare',
    title: 'Recordatorio de tu próxima acción',
    summary: 'Te recuerda lo que tenías agendado con un cliente: 3 horas antes y 10 minutos antes.',
    tags: ['proxima accion', 'recordatorio', 'aviso', 'agendado', 'pendiente'],
    content: [
      { type: 'p', text: 'Si programaste una próxima acción con un cliente (por chat o desde el CRM), el asistente te escribe unas 3 horas antes ("Tienes una acción programada con un cliente próximamente. Repasa su ficha antes de entrar.") y de nuevo 10 minutos antes. Si no confirmas tu plan, el aviso escala para que no quede en el aire.' },
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
      { type: 'p', text: 'El asistente vigila tus clientes de etapas tempranas. Si uno lleva días sin movimiento, te escribe algo así: "Oye, [cliente] lleva días sin movimiento desde la última actividad el [fecha]. ¿Qué pasó? Revisa el CRM y registra la acción o reagenda."' },
      { type: 'p', text: 'El mensaje trae 3 botones (ver la sección "Los botones" para saber qué hace cada uno). Estos avisos respetan tu horario laboral: te llegan dentro de tu jornada.' },
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
      { type: 'p', text: 'Los botones son la forma más rápida de responder: tocas uno y el asistente lo registra en el CRM al instante. No abren ninguna otra pantalla — la acción pasa en el momento.' },
      { type: 'warn', text: 'Cuando un botón te pide algo a cambio (por ejemplo, una fecha), respóndele en ESE mismo chat. El asistente ya sabe de qué cliente se trata; tú solo completas lo que falta.' },
    ],
  },
  {
    id: 'botones-actividades',
    category: 'botones',
    icon: 'UsersRound',
    title: 'Botones de los recordatorios de actividades',
    summary: 'Hecho · En proceso · No la hice — qué hace cada uno.',
    tags: ['hecho', 'en proceso', 'no la hice', 'botones actividades', 'recordatorio actividad'],
    content: [
      { type: 'p', text: 'Los recordatorios de tus actividades ("En 1 hora: …", "En 10 minutos: …", "Es la hora: …") traen 3 botones:' },
      { type: 'list', items: [
        'Hecho → la actividad se marca completada en la Agenda y dejan de llegarte recordatorios de esa.',
        'En proceso → queda anotado que estás en ello; el asistente te vuelve a preguntar en un rato.',
        'No la hice → queda anotado y se avisa a los administradores para que te apoyen (no para regañar: para destrabar).',
      ]},
      { type: 'tip', text: 'También puedes responder con texto ("ya la hice", "en proceso") — los botones son solo el atajo.' },
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
        'Definir próxima acción → el asistente te pregunta qué vas a hacer y para cuándo. Tú respondes y queda guardado en la ficha.',
        'Ver ficha del cliente → te muestra presupuesto, interés, objeciones y el resumen, sin salir del chat.',
      ]},
      { type: 'p', text: 'Ejemplo del flujo de "Definir próxima acción":' },
      { type: 'ex', items: [
        '(asistente) ¿Cuál es la próxima acción y para cuándo?',
        '(tú) reactivarlo — mañana 3pm',
        '(asistente) Listo, próxima acción de [cliente]: reactivarlo — mañana 3:00 p.m.',
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
        'Ya estudié, este es mi plan → confirmas que repasaste al cliente y mandas tu plan para la reunión. Queda registrado.',
        'Reagendar → el asistente te pregunta la nueva fecha del Zoom y lo reprograma.',
        'Ver expediente → te muestra la información completa del cliente para terminar de prepararte.',
      ]},
      { type: 'tip', text: 'Responder "este es mi plan" le dice al sistema que estás encima — si no confirmas, el aviso escala a tu director/admin.' },
    ],
  },

  /* ═══════════ SI ERES ADMIN ═══════════ */
  {
    id: 'admin-intro',
    category: 'admin',
    icon: 'ShieldUser',
    title: 'Lo extra que puedes hacer si eres admin',
    summary: 'Si tu rol es admin / super_admin / CEO / director, el asistente te da más poderes que a un asesor.',
    tags: ['admin', 'super admin', 'director', 'ceo', 'permisos'],
    content: [
      { type: 'p', text: 'Un asesor ve y trabaja solo con SUS clientes. Un admin opera sobre todo el equipo. Como admin sumas:' },
      { type: 'list', items: [
        'Ver los KPIs y el pipeline de TODOS los asesores, no solo los tuyos.',
        'Asignar / reasignar un cliente a un asesor del equipo.',
        'Dictar actividades para cualquier asesor — varias de una vez, con el plan y la confirmación (ver "Actividades del equipo").',
        'Recibir las escalaciones: cuando un asesor no confirma su plan de Zoom o responde "No la hice", te llega el aviso para apoyarlo.',
      ]},
      { type: 'tip', text: 'Las escalaciones te llegan a tu propio Copilot (y a Telegram si lo conectaste). El asistente conoce el roster solo: si entra un asesor nuevo al CRM, ya puedes asignarle sin configurar nada.' },
    ],
  },
  {
    id: 'admin-accion-equipo',
    category: 'admin',
    icon: 'UsersRound',
    title: 'Programar actividades para el equipo desde el chat',
    summary: 'Dicta las actividades — para un asesor, para varios o para todos — y confirma el plan. Sin abrir la Agenda.',
    tags: ['accion de equipo', 'tarea equipo', 'asignar tarea', 'responsable', 'todos', 'dictar actividades'],
    content: [
      { type: 'p', text: 'Como admin, programas el trabajo del equipo hablándole al asistente. Dile qué, quién y cuándo — de una actividad o de varias de corrido — y confirma el plan que te muestra (el detalle completo está en "Dicta varias actividades de una vez").' },
      { type: 'ex', items: [
        '"Que Cecilia organice su CRM mañana a las 9:45 y haga 35 llamadas antes de las 5"',
        '"Crea una actividad para Carlos: enviar 3 proyectos al cliente, mañana 10am"',
        '"Que cada uno de los asesores reporte sus cierres el viernes"',
      ]},
      { type: 'p', text: 'Si no dices para cuándo, el asistente te pide la fecha antes de crear. Si dices "todos" o "cada uno", la actividad se crea para todo el equipo. Y también puedes asignar desde la pantalla (Mi Espacio → Agenda → "Escribe la siguiente acción…"): el aviso al asesor sale igual.' },
      { type: 'warn', text: 'Solo los admins pueden asignar actividades a otros. Si un asesor dicta actividades, se le asignan a él mismo.' },
    ],
  },
  {
    id: 'admin-asignar',
    category: 'admin',
    icon: 'UserCheck',
    title: 'Asignar un cliente a un asesor',
    summary: 'Como admin puedes repartir o reasignar clientes entre tu equipo desde el chat.',
    tags: ['asignar cliente', 'reasignar', 'repartir', 'asesor', 'admin'],
    content: [
      { type: 'ex', items: [
        '"asigna el cliente Mariana a Araceli"',
        '"pasa a Felipe al asesor Emmanuel"',
      ]},
      { type: 'p', text: 'El cliente aparece de inmediato en la lista del asesor nuevo, con todo su historial y notas. Y ese asesor empieza a recibir los recordatorios de ese cliente.' },
      { type: 'tip', text: 'Si un asesor y un cliente se llaman igual, el asistente entiende por el contexto quién es quién ("asigna a Juana el cliente Pedro" vs "asigna el cliente Juana a Pedro").' },
    ],
  },
  {
    id: 'admin-clientes-asesor',
    category: 'admin',
    icon: 'Users',
    title: 'Ver la cartera de cualquier asesor',
    summary: 'Como admin puedes pedir los clientes de un asesor específico, y filtrar por etapa o por cantidad, desde el chat.',
    tags: ['clientes de', 'leads de', 'cartera', 'asesor', 'etapa', 'ultimos', 'admin'],
    content: [
      { type: 'p', text: 'Un asesor solo ve su propia cartera. Como admin puedes pedir la de cualquiera por su nombre, y acotarla por etapa o por cantidad.' },
      { type: 'ex', items: [
        '"¿Cuáles son los clientes de Gael en segunda etapa?"',
        '"Los últimos 2 leads de Cecilia"',
        '"Clientes de Emmanuel en Zoom Agendado"',
      ]},
      { type: 'p', text: 'Te responde con la lista filtrada (nombre, teléfono, etapa y próxima acción) y cuántos hay en total. Si hay dos asesores con nombres parecidos, te pregunta de cuál quieres.' },
      { type: 'tip', text: 'Si eres asesor y pides la cartera de otro, el asistente te avisa que solo puedes ver la tuya — así los datos quedan protegidos por rol.' },
    ],
  },
  {
    id: 'admin-kpis',
    category: 'admin',
    icon: 'LineChart',
    title: 'Ver los números del equipo completo',
    summary: 'Como admin ves los KPIs globales y por asesor, no solo los tuyos.',
    tags: ['kpis equipo', 'numeros globales', 'dashboard', 'pipeline equipo', 'kpis por asesor', 'admin'],
    content: [
      { type: 'p', text: 'Pídele los KPIs y ves el panorama de todo el equipo: leads totales, calientes, pipeline por etapa, pendientes y vencidos. También puedes pedirlos POR ASESOR ("KPIs por asesor") para comparar carteras de un vistazo.' },
      { type: 'tip', text: 'En el CRM web, el Comando Directivo tiene los indicadores completos: Leads, Zooms y Productividad (el avance de cada asesor en sus actividades).' },
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
        '¿Qué pasa si me equivoco en una fecha? El asistente te la vuelve a preguntar — escríbela bien y listo.',
        '¿Qué pasa si dicto un plan y cambio de opinión? Responde "olvídalo" y no se crea nada; o corrige solo la actividad que quieras antes de confirmar.',
        '¿Qué pasa si creo un cliente sin etapa? Lo pone en "Contáctame Ya" y te avisa.',
        '¿Qué pasa si no toco ningún botón del recordatorio? El aviso puede escalar a tu director/admin. Mejor responde.',
        '¿Otros ven mis clientes? No. Cada quien ve solo los suyos. Los admins ven los de todos.',
        '¿Puedo usarlo desde la computadora? Sí — el Copilot está en el CRM web, y en el celular con la misma cuenta.',
        '¿El aviso tarda en llegar? Los avisos salen en una cola ordenada: pueden tardar 1 a 3 minutos. Es normal.',
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
        'No te llegan avisos: entra al Copilot y revisa que uses tu cuenta correcta. Si además quieres los avisos en Telegram, revisa que esté conectado (sección "Conecta tu Telegram").',
        'Una actividad no notifica: asegúrate de que tenga responsable y hora. Sin responsable no hay a quién avisar; sin hora no hay recordatorios de hora exacta.',
        'El micrófono no transcribe: pasa en Brave y en la app de Android (no convierten voz en texto). Dicta desde Chrome o Safari, o escribe el mensaje.',
        'El asistente no entiende una fecha: casi siempre es un error de dedo. Vuelve a escribirla (mañana 3pm, en 3 horas, 24/08 16:00).',
        'Se envió pero no responde: si el mensaje no llegó al motor, el propio chat te lo dice y puedes reenviarlo con confianza. Si el motor está trabajando, la respuesta aparece sola en el hilo — no reenvíes la misma acción dos veces.',
        'No sabes cómo pedir algo: escribe "hola" para ver el resumen, o dilo con tus palabras.',
      ]},
      { type: 'tip', text: 'Si nada de esto lo resuelve, escríbele al soporte por WhatsApp (el botón de abajo) con una captura del chat.' },
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
