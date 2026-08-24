// manual-stratos-doc.js — el manual de Stratos IA como DATOS, no como pantalla.
//
// Pedido de Ángel (27-jul): «quiero mostrarle a Iván todo lo que puede hacer NSG
// de Stratos IA, módulo por módulo, función por función, y cómo nos cambia el
// trabajo. Genera ese documento en Word y lo pones en Mis Documentos».
//
// Está acá y no dentro de la pantalla del manual porque el mismo contenido tiene
// que salir por dos lados: la página web y el .docx. Si viviera en el JSX, el Word
// sería una segunda copia que se desactualiza — y ya nos pasó con los documentos
// que quedaron viejos.
//
// Cada función se cuenta en tres líneas: QUÉ es, CÓMO se usa, y QUÉ CAMBIA. La
// tercera es la que le importa a quien decide: sin ella esto es una lista de
// botones.

export const MANUAL = {
  titulo: "Stratos IA de NSG",
  bajada: "Todo lo que hace el sistema, módulo por módulo y función por función.",
  regla: "La regla que resume todo: si pasó, va adentro de Stratos.",

  secciones: [
    {
      titulo: "Cómo se entra",
      intro: "Un solo lugar, tres formas de abrirlo. Es la misma cuenta en todas.",
      items: [
        { que: "En la computadora", como: "app.stratoscapitalgroup.com/nsg, con tu correo y tu clave.",
          cambia: "No hay que instalar nada ni pedirle acceso a nadie." },
        { que: "En Android", como: "Se instala el APK desde el link fijo del equipo.",
          cambia: "Queda como una app más del teléfono, con su ícono." },
        { que: "En iPhone", como: "Se abre en Safari, botón Compartir → «Agregar a inicio».",
          cambia: "Mismo resultado que una app, sin pasar por la App Store." },
        { que: "Los avisos", como: "La primera vez el teléfono pregunta si permites notificaciones. Hay que decir que sí.",
          cambia: "De eso dependen las llamadas, las menciones del chat y el resumen de la mañana." },
      ],
    },

    {
      titulo: "El Copilot — el asistente",
      intro: "Es la puerta de entrada a todo. Se le habla como a una persona: por texto, por voz o mandándole una foto.",
      items: [
        { que: "Hablarle por texto o por voz", como: "«Creá una tarea para revisar el CRM mañana a las 9», «¿qué tengo hoy?», «¿cuánto le debo a Ángel?».",
          cambia: "No hay que aprender dónde está cada botón: se pide y se hace." },
        { que: "Mandarle una foto", como: "Botón del clip. Pregunta qué es: entró plata, salió plata, evidencia de una tarea, o solo guardarla.",
          cambia: "Un comprobante deja de vivir en la galería del teléfono y pasa a ser un movimiento con soporte." },
        { que: "Leer el comprobante solo (OCR)", como: "Al mandar la captura de un pago, lee el monto y el concepto y los deja escritos.",
          cambia: "Registrar un pago pasa de escribir todo a confirmar lo que ya leyó. Si no lo ve claro, deja el campo vacío en vez de inventar una cifra." },
        { que: "Consultar el segundo cerebro", como: "«¿en qué estamos?», «¿qué se hizo esta semana?», «¿por qué decidimos X?».",
          cambia: "El contexto del negocio deja de estar en la cabeza de uno y queda disponible para los dos." },
        { que: "Perseguir sin que se lo pidan", como: "Avisa una hora antes y diez minutos antes de que algo se venza, dentro de tu horario laboral.",
          cambia: "Nadie tiene que acordarse de acordarse. Y si algo se vence, insiste." },
        { que: "Recordatorios cortos", como: "«Recuérdame en 20 minutos llamar al proveedor» — crea la tarea y avisa cuando llega la hora, aunque falten pocos minutos.",
          cambia: "Antes un recordatorio muy corto podía caer en la rendija entre chequeos y no sonar; eso ya está cerrado." },
      ],
    },

    {
      titulo: "Proyectos y tareas",
      intro: "El trabajo de verdad, con dueño y con fecha. El porcentaje de cada proyecto sale de sus propias tareas, no de una opinión.",
      items: [
        { que: "Crear una tarea", como: "Por el Copilot o desde el módulo. Lleva responsable y vencimiento.",
          cambia: "Deja de existir la tarea que «alguien dijo en una llamada» y nadie anotó." },
        { que: "Empezar, completar, posponer", como: "«Ya terminé X», «pasalo para el jueves». También con un toque desde la pantalla.",
          cambia: "El estado del trabajo está siempre al día, sin reuniones de status." },
        { que: "Eliminar", como: "Eliminar es archivar: se puede restaurar.",
          cambia: "Nadie borra nada por error de forma definitiva." },
        { que: "Evidencia", como: "Al cerrar una tarea se puede adjuntar una foto o un video.",
          cambia: "«Está hecho» deja de ser una afirmación y pasa a ser algo que se puede ver." },
        { que: "Proyectos", como: "Agrupan tareas y muestran el avance real en una barra.",
          cambia: "Se puede responder «¿cómo vamos?» sin abrir nada más." },
      ],
    },

    {
      titulo: "Comando — el tablero de operación",
      intro: "La foto del negocio en una pantalla. Está pensado para NSG, no para una inmobiliaria.",
      items: [
        { que: "Clientes con objetivos", como: "Cada cliente tiene sus objetivos con meta y avance.",
          cambia: "La relación con el cliente se mide, no se recuerda." },
        { que: "Pulso del equipo", como: "Vencido, para hoy, en curso y cerrado en los últimos 7 días.",
          cambia: "Se ve dónde está trabado el trabajo sin preguntarle a nadie." },
        { que: "Proyectos y caja", como: "El avance de cada proyecto y el dinero del mes, en el mismo lugar.",
          cambia: "Operación y plata dejan de ser dos mundos separados." },
      ],
    },

    {
      titulo: "Caja — el dinero",
      intro: "Contada desde NSG: Duke le paga a NSG (entra), NSG paga la nómina (sale). Las personas reciben; no tienen egresos propios.",
      items: [
        { que: "Movimientos", como: "Todo lo que entra y sale, con su comprobante adjunto.",
          cambia: "Se puede abrir cualquier pago y ver la captura, meses después." },
        { que: "Nómina", como: "El monto y la periodicidad de cada quien, editables. Muestra lo devengado, lo pagado y el saldo.",
          cambia: "«¿Cuánto me deben?» tiene una respuesta con números, no una charla incómoda." },
        { que: "Cuentas de cobro", como: "Se arman solas con el trabajo que de verdad se cerró en el periodo, y se bajan en Word para firmarlas a mano.",
          cambia: "Cobrar deja de ser una tarde de trabajo. Y va en las dos direcciones: NSG le cobra al cliente, y cada quien le cobra a NSG." },
        { que: "Informe de avances", como: "Se elige el periodo y el sistema junta lo que se hizo y lo cuenta sin tecnicismos.",
          cambia: "Se le puede mandar al cliente sin que nadie se siente a escribirlo." },
      ],
    },

    {
      titulo: "Chat del equipo",
      intro: "Para reemplazar el WhatsApp del trabajo. La diferencia es que acá la conversación queda donde el sistema la puede ver.",
      items: [
        { que: "Canales", como: "Un canal por tema. Con dos personas da igual; con cinco, no.",
          cambia: "Nace ordenado en vez de ser un hilo infinito." },
        { que: "Avisos al teléfono", como: "Cada mensaje suena; mencionando con @ le llega directo a esa persona.",
          cambia: "Se puede dejar de mirar WhatsApp para el trabajo." },
        { que: "Adjuntos y respuestas", como: "Se mandan imágenes y se responde a un mensaje puntual.",
          cambia: "Lo que se comparte queda adentro del sistema, no en la galería de un teléfono." },
      ],
    },

    {
      titulo: "Mi Espacio",
      intro: "Lo tuyo y lo de la empresa: agenda, documentos, el plan y el protocolo.",
      items: [
        { que: "Agenda", como: "Lo personal y lo profesional en la misma vista.",
          cambia: "Un solo lugar para saber qué sigue." },
        { que: "Documentos", como: "Los manuales, los informes y los reportes. Se bajan en Word para leerlos o editarlos.",
          cambia: "Deja de haber documentos que solo existen en el chat de alguien." },
        { que: "Plan Estratégico", como: "El propósito, la meta grande, los objetivos del trimestre.",
          cambia: "La estrategia deja de ser una conversación y pasa a ser algo que se abre y se revisa." },
        { que: "Protocolo", como: "Cómo se prospecta en NSG, paso a paso, con las reglas que no se negocian.",
          cambia: "Cuando entre alguien nuevo, no hay que explicárselo de memoria." },
      ],
    },

    {
      titulo: "Equipo y llamadas",
      intro: "El sistema crece con la gente que entra.",
      items: [
        { que: "Dar de alta a alguien", como: "Desde el CRM: nombre, correo y rol. Sale una clave temporal para pasarle.",
          cambia: "Sumar un desarrollador no depende de tocar la base de datos." },
        { que: "Llamar y contestar", como: "Botón de llamar en el encabezado; al otro le suena el teléfono con Contestar o Rechazar.",
          cambia: "No hace falta salir a otra app para hablar." },
      ],
    },

    {
      titulo: "Qué cambia, en resumen",
      intro: "Si hubiera que explicarlo en una reunión, es esto:",
      items: [
        { que: "Antes se avisaba; ahora el sistema persigue",
          como: "Los recordatorios salen solos, en el horario de cada quien y en su zona horaria.",
          cambia: "El seguimiento deja de depender de la memoria de alguien." },
        { que: "Antes se contaba; ahora se muestra",
          como: "Cada avance tiene evidencia y cada proyecto un porcentaje que sale de sus tareas.",
          cambia: "Las reuniones se usan para decidir, no para averiguar cómo vamos." },
        { que: "Antes estaba repartido; ahora está junto",
          como: "Tareas, dinero, documentos, conversación y contexto en un solo lugar.",
          cambia: "Se deja de perder tiempo buscando dónde quedó algo." },
        { que: "Antes era de nosotros; ahora es replicable",
          como: "Cada empresa nueva es una configuración, no un sistema nuevo.",
          cambia: "Lo que se construyó para NSG se enciende para Duke, Mueblería, Legacy Design y Brasa y Piedra." },
      ],
    },
  ],
};

/** Convierte el manual en los bloques que entiende `docx.js`.
 *
 *  Sigue la MISMA plantilla que la cuenta de cobro y los reportes de Stratos:
 *  marca arriba a la derecha, título grande centrado, una raya, y secciones
 *  numeradas con su propia raya. Ángel: «recordá la plantilla de Stratos de Word
 *  que hemos estado haciendo en otros documentos, y buen tamaño de letra».
 *
 *  Los tamaños son de documento impreso, no de pantalla: cuerpo en 11.5, que es
 *  lo que se lee cómodo en una hoja; nada por debajo de 10.5 salvo el pie.
 */
export function manualEnBloques(fechaISO) {
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [y, m, d] = String(fechaISO || new Date().toISOString()).slice(0, 10).split("-").map(Number);

  const VERDE = "0D9A76";   // el verde de Stratos, en versión impresa
  const GRIS  = "667085";
  const TINTA = "1D2939";

  const b = [
    { text: "NSG", bold: true, size: 12.5, align: "right", after: 0, color: GRIS },
    { text: `${d} de ${MESES[m - 1]} de ${y}`, size: 10.5, align: "right", after: 30, color: GRIS },

    { text: MANUAL.titulo.toUpperCase(), bold: true, size: 25, align: "center", after: 8, color: TINTA },
    { text: MANUAL.bajada, size: 12.5, align: "center", color: GRIS, after: 14 },
    { text: MANUAL.regla, size: 12, align: "center", bold: true, color: VERDE, after: 8 },
    { text: "", after: 20, linea: true },
  ];

  MANUAL.secciones.forEach((s, i) => {
    // Cada sección arranca con su número en verde y el título en tinta, con la
    // raya abajo — igual que los apartados de la cuenta de cobro.
    b.push({
      text: [{ t: `${i + 1}.  `, bold: true, color: VERDE }, { t: s.titulo.toUpperCase(), bold: true, color: TINTA }],
      size: 14, before: 22, after: 5, linea: true,
    });
    if (s.intro) b.push({ text: s.intro, size: 11.5, color: "475467", italic: true, after: 12 });

    s.items.forEach((it) => {
      b.push({ text: it.que, bold: true, size: 12, color: TINTA, before: 10, after: 3 });
      if (it.como)   b.push({ text: [{ t: "Cómo:  ", bold: true, color: GRIS }, { t: it.como }], size: 11.5, indent: 16, after: 3 });
      if (it.cambia) b.push({ text: [{ t: "Qué cambia:  ", bold: true, color: VERDE }, { t: it.cambia }], size: 11.5, indent: 16, after: 6 });
    });
  });

  b.push(
    { text: "", after: 22, linea: true },
    { text: "Este documento lo genera el propio sistema: si algo cambia, se vuelve a bajar y sale actualizado.",
      size: 10, color: GRIS, align: "center", before: 10 },
  );

  return b;
}

/** El texto plano — es lo que se guarda en Stratos y lo que puede leer el Copilot. */
export function manualEnTexto() {
  const out = [MANUAL.titulo.toUpperCase(), MANUAL.bajada, MANUAL.regla, ""];
  MANUAL.secciones.forEach((s, i) => {
    out.push(`${i + 1}. ${s.titulo.toUpperCase()}`);
    if (s.intro) out.push(s.intro);
    s.items.forEach((it) => {
      out.push(`• ${it.que}`);
      if (it.como)   out.push(`   Cómo: ${it.como}`);
      if (it.cambia) out.push(`   Qué cambia: ${it.cambia}`);
    });
    out.push("");
  });
  return out.join("\n");
}
