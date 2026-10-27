// Comparación editorial por capacidad, contrastada con documentación oficial el 27/10/2026.
// Una capacidad documentada no garantiza el mismo flujo ni su inclusión en todos los planes.
export const COMPARISON_REVIEWED = '27 de octubre de 2026';
export const COMPARISON_SOURCES = {
  hubSales: { label: 'HubSpot · Sales Hub y planes', url: 'https://www.hubspot.com/pricing/sales' },
  hubAssistant: { label: 'HubSpot · Breeze Assistant', url: 'https://knowledge.hubspot.com/ai/use-breeze-assistant' },
  hubFlows: { label: 'HubSpot · Acciones de workflows', url: 'https://knowledge.hubspot.com/workflows/choose-your-workflow-actions' },
  hubCatalog: { label: 'HubSpot · Catálogo de productos y servicios', url: 'https://legal.hubspot.com/hubspot-product-and-services-catalog/products' },
  sfSales: { label: 'Salesforce · Sales y planes', url: 'https://www.salesforce.com/sales/pricing/' },
  sfAgent: { label: 'Salesforce · Acciones de Agentforce', url: 'https://trailhead.salesforce.com/content/learn/modules/einstein-copilot-sales-actions-for-sellers-quick-look/maximize-sales-performance-with-einstein-copilot-actions' },
  sfVoice: { label: 'Salesforce · Conexión de agentes de voz', url: 'https://trailhead.salesforce.com/content/learn/modules/agentforce-deployment-quick-look/set-up-the-voice-connection' },
  ghlPlans: { label: 'GoHighLevel · Funciones y planes', url: 'https://www.gohighlevel.com/pricing' },
  ghlAsk: { label: 'GoHighLevel · Ask AI', url: 'https://help.gohighlevel.com/support/solutions/articles/155000005327' },
  ghlSummary: { label: 'GoHighLevel · Resumen de contactos', url: 'https://ideas.gohighlevel.com/changelog/now-live-contact-summary-agent-in-ask-ai' },
  ghlAlerts: { label: 'GoHighLevel · Notificaciones internas', url: 'https://help.gohighlevel.com/support/solutions/articles/155000003202-workflow-action-internal-notification' },
  ghlVoice: { label: 'GoHighLevel · Acciones de Voice AI', url: 'https://help.gohighlevel.com/support/solutions/articles/155000005267-separate-during-call-and-post-call-actions-in-voice-ai' },
  ghlAI: { label: 'GoHighLevel · Planes y consumo de IA', url: 'https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing-update' },
};
const cell = (status, text, sources = []) => ({ status, text, sources });
const copilot = (...ids) => ids.map(id => `copilot-${id}`);
export const CRM_COMPARISON = [
  {
    id: 'crm', title: 'Clientes y proceso comercial', featureIds: copilot(3,4,6,8,13,14,15,20,28),
    stratos: cell('Disponible', 'Alta, búsqueda, historial, etapas y carteras desde CRM y Copilot; acceso según rol.'),
    hubspot: cell('Disponible', 'Contactos, negocios y pipelines. Límites y automatizaciones según edición.', ['hubSales']),
    salesforce: cell('Disponible', 'Leads, contactos, cuentas y oportunidades. Personalización según edición.', ['sfSales']),
    highlevel: cell('Disponible', 'CRM y pipelines; Ask AI permite crear contactos y actualizar oportunidades.', ['ghlPlans','ghlAsk']),
  },
  {
    id: 'assistant', title: 'Pedir acciones y guardar notas', featureIds: copilot(1,2,5),
    stratos: cell('Disponible', 'Texto o dictado al Copilot para registrar lo conversado. Requiere transcripción habilitada.'),
    hubspot: cell('Disponible', 'Breeze crea registros y añade notas por instrucciones. Validar el flujo de nota de voz.', ['hubAssistant']),
    salesforce: cell('Según edición', 'Agentforce ofrece acciones sobre datos de ventas. Validar dictado y registro de notas del caso concreto.', ['sfAgent','sfSales']),
    highlevel: cell('Según plan de IA', 'Ask AI admite texto y voz, y gestiona contactos, notas y tareas.', ['ghlAsk']),
  },
  {
    id: 'context', title: 'Contexto antes de una reunión', featureIds: copilot(7,31),
    stratos: cell('Configurable', 'Perfil e historial del cliente; aviso previo y plan sugerido según reglas del equipo.'),
    hubspot: cell('Disponible', 'Breeze resume registros y ayuda a preparar reuniones. Requiere información y calendario conectados.', ['hubAssistant']),
    salesforce: cell('Según edición', 'Agentforce resume registros y propone próximos pasos con los datos disponibles.', ['sfAgent','sfSales']),
    highlevel: cell('Según plan de IA', 'Ask AI resume contactos, actividad, citas y tareas. Validar el aviso proactivo previo.', ['ghlSummary','ghlAsk']),
  },
  {
    id: 'agenda', title: 'Agenda, visitas y recordatorios', featureIds: copilot(9,10,11,12,19,22,23),
    stratos: cell('Disponible', 'Próximas acciones, visitas y reuniones en el CRM; fechas naturales y zona horaria del perfil.'),
    hubspot: cell('Disponible', 'Enlaces de reuniones y herramientas de seguimiento. La automatización avanzada depende del plan.', ['hubSales']),
    salesforce: cell('Según edición', 'Gestión comercial y automatización con Flow. Validar el flujo de agenda y recordatorios requerido.', ['sfSales']),
    highlevel: cell('Disponible', 'Calendarios de reservas; Ask AI consulta citas y gestiona agenda según permisos.', ['ghlPlans','ghlAsk']),
  },
  {
    id: 'tasks', title: 'Tareas y coordinación del equipo', featureIds: copilot(24,25,26,27,35,36),
    stratos: cell('Configurable', 'Dictar un plan, revisarlo y confirmarlo; responsables, estado y avisos de tareas.'),
    hubspot: cell('Configurable', 'Workflows para tareas y avisos internos en Professional/Enterprise. Diseñar las reglas del equipo.', ['hubFlows']),
    salesforce: cell('Configurable', 'Flow y procesos de aprobación según edición. El plan dictado con confirmación debe validarse.', ['sfSales']),
    highlevel: cell('Configurable', 'Ask AI gestiona tareas; workflows envían avisos a usuarios. Validar el plan dictado completo.', ['ghlAsk','ghlAlerts']),
  },
  {
    id: 'metrics', title: 'Pipeline, métricas y prioridad', featureIds: copilot(21,29,30),
    stratos: cell('Disponible', 'Consulta de pipeline y KPIs; score y señal HOT para orientar la revisión comercial.'),
    hubspot: cell('Según edición', 'Dashboards e informes con límites por plan; verificar la calificación de leads requerida.', ['hubSales']),
    salesforce: cell('Según edición', 'Pipeline, previsiones y lead scoring; algunas funciones de IA requieren compra adicional.', ['sfSales']),
    highlevel: cell('Disponible', 'Dashboards e informes. Validar un modelo de prioridad equivalente al score comercial de Stratos.', ['ghlPlans']),
  },
  {
    id: 'catalog', title: 'Catálogo inmobiliario y materiales', featureIds: copilot(16,17,18),
    stratos: cell('Configurable', 'Buscar por zona y presupuesto, recuperar materiales y sugerir propiedades según el perfil cargado.'),
    hubspot: cell('Validar alcance', 'Breeze gestiona productos. La selección inmobiliaria por perfil requiere validar datos y adaptación.', ['hubAssistant']),
    salesforce: cell('Validar alcance', 'Productos, listas de precios y archivos. La recomendación inmobiliaria requiere un diseño específico.', ['sfSales']),
    highlevel: cell('Validar alcance', 'Ask AI accede a datos y objetos personalizados. Validar catálogo inmobiliario y recomendación por perfil.', ['ghlAsk']),
  },
  {
    id: 'discipline', title: 'Disciplina y continuidad comercial', featureIds: copilot(32,33,34,37,38),
    stratos: cell('Configurable', 'Alertas por plan sin confirmar, inactividad y seguimiento pendiente; solicitud de nota y mensaje sugerido.'),
    hubspot: cell('Configurable', 'Workflows permiten construir avisos; Breeze prepara mensajes. El circuito concreto se debe diseñar y validar.', ['hubFlows','hubAssistant']),
    salesforce: cell('Configurable', 'Flow y acciones de Agentforce permiten diseñar procesos. Validar cada regla y escalamiento.', ['sfSales','sfAgent']),
    highlevel: cell('Configurable', 'Workflows y avisos internos permiten construir el seguimiento. Validar reglas, fechas y destinatarios.', ['ghlAlerts']),
  },
  {
    id: 'evidence', title: 'Evidencias y avisos al teléfono', featureIds: copilot(39,40),
    stratos: cell('Configurable', 'Foto o video en tareas habilitadas, notificaciones con permiso y Telegram opcional vinculado.'),
    hubspot: cell('Validar alcance', 'Avisos internos mediante workflows. Validar evidencia vinculada a tareas y el canal móvil requerido.', ['hubFlows']),
    salesforce: cell('Validar alcance', 'Gestión de archivos disponible según edición. Validar evidencia, notificaciones y canales del proceso.', ['sfSales']),
    highlevel: cell('Configurable', 'Avisos internos por app, correo, SMS o WhatsApp. Validar evidencia de tareas y Telegram.', ['ghlAlerts']),
  },
  {
    id: 'voice', title: 'Call Center con IA', featureIds: ['voz-1','voz-2','voz-3','voz-4','voz-5'],
    stratos: cell('Configurable', 'Agente de voz, calificación, cita o transferencia e historial disponible. Telefonía y consumo según propuesta.'),
    hubspot: cell('Validar alcance', 'Customer Agent contempla llamadas en beta. Validar llamadas salientes, traspaso e historial; no equivale a calling manual.', ['hubCatalog']),
    salesforce: cell('Complemento y configuración', 'Agentforce Voice requiere conexión de telefonía y flujos de enrutamiento; confirmar licencias y consumo.', ['sfVoice']),
    highlevel: cell('Plan de IA o consumo', 'Voice AI ofrece llamadas, reserva, transferencia y actualización de datos; telefonía y límites según contratación.', ['ghlVoice','ghlAI']),
  },
  {
    id: 'seats', title: 'Cómo crece la licencia', featureIds: [],
    stratos: cell('Oferta del evento', 'Sin cargo por usuario adicional en la oferta de lanzamiento. Implementación, alcance y consumo se acuerdan por separado.'),
    hubspot: cell('Por asiento', 'Sales Hub usa asientos por edición. IA y otros productos pueden añadir consumo o suscripciones.', ['hubSales']),
    salesforce: cell('Por usuario', 'Ediciones Sales con tarifa por usuario. Agentforce y telefonía dependen de edición y complementos.', ['sfSales']),
    highlevel: cell('Usuarios ilimitados', 'También incluye usuarios ilimitados. El plan cambia por subcuentas; IA y telecomunicaciones tienen condiciones propias.', ['ghlPlans','ghlAI']),
  },
];
