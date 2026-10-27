// Catálogo público: alcance contrastado con manuales y funciones de la plataforma.
export const FEATURE_CATEGORIES = [
  {
    "id": "captura",
    "label": "Captura y contexto"
  },
  {
    "id": "clientes",
    "label": "Clientes y seguimiento"
  },
  {
    "id": "proceso",
    "label": "Proceso comercial"
  },
  {
    "id": "catalogo",
    "label": "Catálogo y agenda"
  },
  {
    "id": "planes",
    "label": "Planes y recordatorios"
  },
  {
    "id": "equipo",
    "label": "Dirección y equipo"
  },
  {
    "id": "disciplina",
    "label": "Disciplina comercial"
  },
  {
    "id": "avisos",
    "label": "Notificaciones y evidencia"
  },
  {
    "id": "voz",
    "label": "Call Center de voz"
  }
];
export const FEATURES = [
  {
    "id": "copilot-1",
    "category": "captura",
    "title": "Texto natural",
    "before": "Encontrar pantallas y campos para cada acción.",
    "after": "Pedir la acción con una frase.",
    "benefit": "Menos navegación para operar.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-2",
    "category": "captura",
    "title": "Voz/dictado",
    "before": "Escribir mientras aún recuerdas la conversación.",
    "after": "Dictar al micrófono y enviar al asistente.",
    "benefit": "Capturar contexto desde el teléfono.",
    "condition": "Requiere acceso al micrófono y transcripción habilitada."
  },
  {
    "id": "copilot-3",
    "category": "captura",
    "title": "Alta de cliente",
    "before": "Dejar un contacto en notas hasta volver a la oficina.",
    "after": "Crear nombre, teléfono y próxima acción desde el chat.",
    "benefit": "El contacto entra al CRM con dueño.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-4",
    "category": "captura",
    "title": "Alta de varios clientes",
    "before": "Capturar una lista uno por uno.",
    "after": "Pegar nombre y teléfono por cliente en un mensaje.",
    "benefit": "Reducir captura repetida.",
    "condition": "Los datos se validan antes de completar el registro."
  },
  {
    "id": "copilot-5",
    "category": "captura",
    "title": "Notas de conversación",
    "before": "Repartir acuerdos entre WhatsApp, papel y memoria.",
    "after": "Contar lo sucedido y añadirlo al expediente con fecha.",
    "benefit": "Historial útil para el siguiente contacto.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-6",
    "category": "clientes",
    "title": "Buscar por nombre o teléfono",
    "before": "Recorrer tarjetas para encontrar al cliente.",
    "after": "Pedir la ficha por nombre o teléfono.",
    "benefit": "Acceso rápido al registro correcto.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-7",
    "category": "clientes",
    "title": "Recuperar perfil y contexto",
    "before": "Reconstruir interés, presupuesto y objeciones.",
    "after": "Consultar expediente, notas, etapa y resumen disponible.",
    "benefit": "Prepararse con información registrada.",
    "condition": "El contexto se construye con la información guardada en el expediente."
  },
  {
    "id": "copilot-8",
    "category": "clientes",
    "title": "Revisar historial",
    "before": "Preguntar a cada asesor qué pasó.",
    "after": "Consultar los movimientos del cliente.",
    "benefit": "Trazabilidad de su avance.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-9",
    "category": "clientes",
    "title": "Programar próxima acción",
    "before": "Confiar en recordar qué sigue.",
    "after": "Indicar cliente, acción, fecha y hora.",
    "benefit": "Seguimiento con compromiso concreto.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-10",
    "category": "clientes",
    "title": "Cambiar/reagendar próxima acción",
    "before": "Corregir agenda y avisos por separado.",
    "after": "Pedir la nueva fecha o acción.",
    "benefit": "El seguimiento se adapta al cambio.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-11",
    "category": "proceso",
    "title": "Agendar videollamada",
    "before": "Crear pendiente y actualizar etapa por separado.",
    "after": "Agendar el Zoom del cliente con día y hora.",
    "benefit": "Reunión y seguimiento en el CRM.",
    "condition": "Registra la reunión en el CRM; la conexión con la agenda se define en la implementación."
  },
  {
    "id": "copilot-12",
    "category": "proceso",
    "title": "Agendar visita",
    "before": "Coordinar recorridos con mensajes sueltos.",
    "after": "Registrar visita y fecha en la ficha.",
    "benefit": "Preparación y recordatorios.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-13",
    "category": "proceso",
    "title": "Mover etapa",
    "before": "Volver al tablero después de cada avance.",
    "after": "«Pasa a Mariana a Seguimiento».",
    "benefit": "Pipeline al día desde la conversación.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-14",
    "category": "proceso",
    "title": "Asignar/reasignar lead",
    "before": "Perder claridad sobre quién continúa.",
    "after": "Pasar el cliente al asesor autorizado.",
    "benefit": "Responsable claro y continuidad.",
    "condition": "Disponible para los responsables con permisos de administración."
  },
  {
    "id": "copilot-15",
    "category": "proceso",
    "title": "Tomar un lead autorizado",
    "before": "Atender un cliente sin reflejar la responsabilidad.",
    "after": "«Ponlo en mi cartera» según permisos.",
    "benefit": "Alinear atención y asignación.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-16",
    "category": "catalogo",
    "title": "Consultar catálogo",
    "before": "Buscar entre carpetas y listados.",
    "after": "Preguntar por zona, presupuesto, recámaras o cercanía al mar.",
    "benefit": "Encontrar opciones pertinentes.",
    "condition": "Requiere catálogo y materiales actualizados por tu empresa."
  },
  {
    "id": "copilot-17",
    "category": "catalogo",
    "title": "Obtener material/Drive",
    "before": "Pedir cada vez el enlace de un desarrollo.",
    "after": "Solicitar el Drive o carpeta disponible.",
    "benefit": "Compartir material correcto con rapidez.",
    "condition": "Requiere catálogo y materiales actualizados por tu empresa."
  },
  {
    "id": "copilot-18",
    "category": "catalogo",
    "title": "Recomendar por perfil",
    "before": "Comparar manualmente perfil contra catálogo.",
    "after": "Pedir propiedades para un cliente.",
    "benefit": "Primera selección alineada con presupuesto y zona.",
    "condition": "Requiere catálogo y materiales actualizados por tu empresa."
  },
  {
    "id": "copilot-19",
    "category": "catalogo",
    "title": "Ver agenda de hoy",
    "before": "Revisar varios pendientes por separado.",
    "after": "«¿Qué tengo hoy?»",
    "benefit": "Saber por dónde empezar.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-20",
    "category": "catalogo",
    "title": "Ver cartera propia",
    "before": "Exportar o filtrar manualmente.",
    "after": "«Mis clientes».",
    "benefit": "Clientes y próximas acciones en conversación.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-21",
    "category": "planes",
    "title": "Ver pipeline y KPIs",
    "before": "Armar un resumen para saber cómo vas.",
    "after": "Consultar leads, etapas, calientes y pendientes.",
    "benefit": "Decidir con datos disponibles.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-22",
    "category": "planes",
    "title": "Recordatorio personal",
    "before": "Usar otra lista o alarma sin contexto.",
    "after": "«Recuérdame enviar la propuesta mañana a las 10».",
    "benefit": "Recuperar la acción a tiempo.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-23",
    "category": "planes",
    "title": "Fechas naturales/zona horaria",
    "before": "Convertir horas mentalmente.",
    "after": "Decir mañana, viernes o en 30 minutos.",
    "benefit": "Menos fricción al programar.",
    "condition": "Se utiliza la zona horaria configurada en el perfil."
  },
  {
    "id": "copilot-24",
    "category": "planes",
    "title": "Dictar varias actividades",
    "before": "Repetir alta de tarea para cada encargo.",
    "after": "Dictar un plan con varias tareas, responsables y fechas.",
    "benefit": "Convertir instrucciones en trabajo ordenado.",
    "condition": "El plan se revisa y confirma antes de crear las actividades."
  },
  {
    "id": "copilot-25",
    "category": "planes",
    "title": "Revisar/corregir plan",
    "before": "Crear tareas con una interpretación equivocada.",
    "after": "Revisar, corregir responsable/hora y confirmar.",
    "benefit": "Control antes de ejecutar.",
    "condition": "El plan se revisa y confirma antes de crear las actividades."
  },
  {
    "id": "copilot-26",
    "category": "equipo",
    "title": "Asignar actividades al equipo",
    "before": "Repartir encargos en mensajes sin seguimiento.",
    "after": "Asignarlas desde Copilot al equipo autorizado.",
    "benefit": "Cada actividad tiene dueño y fecha.",
    "condition": "Disponible para los responsables con permisos de administración."
  },
  {
    "id": "copilot-27",
    "category": "equipo",
    "title": "Completar o reportar estado",
    "before": "Decir «ya quedó» sin actualizar el sistema.",
    "after": "Responder Hecho, En proceso o No la hice.",
    "benefit": "El avance queda registrado y guía seguimiento.",
    "condition": "Según los permisos y canales habilitados para tu equipo."
  },
  {
    "id": "copilot-28",
    "category": "equipo",
    "title": "Cartera de un asesor",
    "before": "Pedir reportes individuales.",
    "after": "Consultar clientes, etapas y actividad de un asesor.",
    "benefit": "Supervisión directa.",
    "condition": "Disponible para los responsables con permisos de administración."
  },
  {
    "id": "copilot-29",
    "category": "equipo",
    "title": "KPIs del equipo",
    "before": "Consolidar cifras de varias personas.",
    "after": "Preguntar por números globales o por asesor.",
    "benefit": "Identificar pendientes y distribución de trabajo.",
    "condition": "Disponible para los responsables con permisos de administración."
  },
  {
    "id": "copilot-30",
    "category": "equipo",
    "title": "Calificación automática",
    "before": "Priorizar solo por intuición.",
    "after": "Consultar score y señal HOT en el CRM.",
    "benefit": "Orientar la revisión comercial.",
    "condition": "Es una señal de prioridad para orientar al equipo, no una garantía de cierre."
  },
  {
    "id": "copilot-31",
    "category": "disciplina",
    "title": "Briefing pre-reunión",
    "before": "Entrar a una llamada buscando contexto.",
    "after": "Recibir aviso con perfil y plan sugerido.",
    "benefit": "Preparar una conversación informada.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-32",
    "category": "disciplina",
    "title": "Seguimiento de preparación",
    "before": "Descubrir tarde que no hay plan registrado.",
    "after": "Avisar al asesor y escalar al director si falta confirmación.",
    "benefit": "Detectar reuniones que necesitan apoyo.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización. La alerta indica falta de confirmación del plan."
  },
  {
    "id": "copilot-33",
    "category": "disciplina",
    "title": "Recuperar clientes inactivos",
    "before": "Olvidar conversaciones que dejaron de moverse.",
    "after": "Recibir una alerta y definir próxima acción.",
    "benefit": "Reabrir oportunidades con contexto.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-34",
    "category": "disciplina",
    "title": "Preparar mensaje de reactivación",
    "before": "Redactar desde cero cada seguimiento.",
    "after": "Recibir un texto sugerido y abrir WhatsApp para revisarlo/enviarlo.",
    "benefit": "Menos preparación por conversación.",
    "condition": "El asesor revisa el mensaje sugerido antes de enviarlo."
  },
  {
    "id": "copilot-35",
    "category": "disciplina",
    "title": "Coach de tareas",
    "before": "La dirección persigue manualmente cada pendiente.",
    "after": "Avisos antes del vencimiento y respuestas de estado.",
    "benefit": "Seguimiento constante del trabajo.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-36",
    "category": "avisos",
    "title": "Avisar al asignar",
    "before": "El asesor no se entera de un encargo nuevo.",
    "after": "Recibir «Nueva actividad asignada» y responsable que la creó.",
    "benefit": "La tarea llega a quien debe actuar.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-37",
    "category": "avisos",
    "title": "Nota posterior al Zoom",
    "before": "Termina la llamada y el aprendizaje se pierde.",
    "after": "Aviso para enviar audio y completar expediente.",
    "benefit": "Conservar acuerdos y objeciones.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-38",
    "category": "avisos",
    "title": "Seguimiento después del Zoom",
    "before": "Un cliente avanzado se queda sin atención.",
    "after": "Alertar por falta de seguimiento posterior.",
    "benefit": "Proteger el trabajo comercial ya realizado.",
    "condition": "Los avisos, horarios y reglas se configuran para cada organización."
  },
  {
    "id": "copilot-39",
    "category": "avisos",
    "title": "Adjuntar evidencia de tarea",
    "before": "Confiar solo en «está hecho».",
    "after": "Adjuntar foto/video y vincularlo a la tarea elegida.",
    "benefit": "Trabajo con soporte verificable.",
    "condition": "Disponible en tareas y módulos con evidencia habilitada."
  },
  {
    "id": "copilot-40",
    "category": "avisos",
    "title": "Avisos al teléfono y canal opcional",
    "before": "Revisar constantemente el CRM.",
    "after": "Notificaciones con app cerrada y Telegram si está vinculado.",
    "benefit": "Enterarse fuera de la pantalla de trabajo.",
    "condition": "Requiere permisos de notificación; Telegram es un canal opcional vinculado."
  },
  {
    "id": "voz-1",
    "category": "voz",
    "title": "Llamadas de voz con IA",
    "before": "Iniciar manualmente cada primer contacto.",
    "after": "Un flujo configurado inicia una llamada con tu agente de voz.",
    "benefit": "Atender interés con un proceso consistente.",
    "condition": "Requiere configuración del agente, telefonía, canales y reglas de atención. El alcance y consumo se definen en la propuesta."
  },
  {
    "id": "voz-2",
    "category": "voz",
    "title": "Conversación y calificación",
    "before": "Repetir las mismas preguntas para conocer cada necesidad.",
    "after": "El agente conversa con el guion y los criterios de tu negocio.",
    "benefit": "Llegar al siguiente paso con información útil.",
    "condition": "Requiere configuración del agente, telefonía, canales y reglas de atención. El alcance y consumo se definen en la propuesta."
  },
  {
    "id": "voz-3",
    "category": "voz",
    "title": "Cita o transferencia",
    "before": "Dejar una conversación sin un siguiente paso acordado.",
    "after": "Configurar el flujo para agendar o pasar la atención a una persona.",
    "benefit": "Dar continuidad a cada conversación.",
    "condition": "Requiere configuración del agente, telefonía, canales y reglas de atención. El alcance y consumo se definen en la propuesta."
  },
  {
    "id": "voz-4",
    "category": "voz",
    "title": "Historial de llamadas",
    "before": "Perder el contexto después de colgar.",
    "after": "Consultar duración, grabación, resumen y transcripción disponibles.",
    "benefit": "Revisar lo conversado desde el expediente.",
    "condition": "Requiere configuración del agente, telefonía, canales y reglas de atención. El alcance y consumo se definen en la propuesta."
  },
  {
    "id": "voz-5",
    "category": "voz",
    "title": "Atención humana",
    "before": "Resolver todas las situaciones con un único flujo.",
    "after": "Identificar conversaciones que requieren intervención del equipo.",
    "benefit": "Dar al cliente la atención que necesita.",
    "condition": "Requiere configuración del agente, telefonía, canales y reglas de atención. El alcance y consumo se definen en la propuesta."
  }
];

const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function filterFeatures(query = "", category = "all") {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return FEATURES.filter(feature => {
    const content = normalize([feature.title, feature.before, feature.after, feature.benefit].join(" "));
    return (category === "all" || feature.category === category) && words.every(word => content.includes(word));
  });
}
