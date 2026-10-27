export const DEMO_URL = "https://cal.com/ivanrr.oficial/nsg";
export const formatUSD = value => value.toLocaleString("en-US");

export const plans = [
  {
    id: "connect", name: "Connect",
    desc: "CRM y Copilot para ordenar clientes, dar seguimiento y dirigir a tu equipo con contexto.",
    implementation: 1750, monthly: 297, includedMonths: 3,
    cta: "Agendar demo de Connect",
    features: [
      "CRM, cartera, etapas y expediente del cliente",
      "Copilot por texto y dictado; notas y contexto",
      "Agenda, tareas y próximas acciones",
      "Catálogo y materiales de tu empresa",
      "Métricas por asesor y para la dirección",
      "Disciplina comercial y notificaciones configuradas",
      "Configuración del proceso y permisos",
      "Capacitación y seguimiento de adopción"
    ]
  },
  {
    id: "connect-voice", name: "Connect + Call Center",
    desc: "Toda tu operación comercial, conectada con un agente de voz que atiende y da continuidad.",
    implementation: 3200, monthly: 549, includedMonths: 3,
    badge: "CRM + voz con IA", highlight: true,
    cta: "Agendar demo con voz",
    features: [
      "Todo lo incluido en Connect",
      "Configuración de tu agente de voz con IA",
      "Guion y criterios de calificación de clientes",
      "Llamadas según los flujos acordados",
      "Agendamiento o transferencia al equipo",
      "Historial y contexto de llamadas disponibles",
      "Integración del flujo de voz con el CRM",
      "Capacitación para operar y supervisar el agente"
    ]
  },
  {
    id: "enterprise", name: "Enterprise",
    desc: "Desarrollo a medida para construir la operación y el equipo interno de IA que tu empresa necesita.",
    implementation: 12000, monthly: 1200, accompanimentMonths: 3, custom: true,
    cta: "Definir mi proyecto",
    features: [
      "Consultoría inicial y definición del alcance",
      "Diseño de procesos y arquitectura de la solución",
      "Agentes e integraciones según el proyecto",
      "Aplicación o software a medida según alcance",
      "Preparación de tu equipo interno de IA",
      "Capacitación sobre la solución entregada",
      "Soporte y acompañamiento durante tres meses",
      "Continuidad posterior definida en la propuesta"
    ]
  }
];
export const enterprisePlan = plans.find(plan => plan.id === "enterprise");

export const faqs = [
  {
    q: "¿Qué incluye el costo de implementación?",
    a: "Definimos el proceso, configuramos permisos y flujos, capacitamos al equipo y damos seguimiento a la adopción según el alcance acordado. Connect tiene una implementación de USD 1,750; Connect + Call Center, USD 3,200 en total. Enterprise parte de USD 12,000 y se cotiza a medida."
  },
  {
    q: "¿Cuándo empieza el cobro mensual?",
    a: "En la oferta de lanzamiento de Connect y Connect + Call Center, las primeras tres mensualidades están incluidas. La mensualidad se cobra desde el mes 4: USD 297 para Connect y USD 549 para Connect + Call Center. La implementación sí se paga al inicio."
  },
  {
    q: "¿Cuánto ahorro con las tres mensualidades incluidas?",
    a: "Connect incluye USD 891 en mensualidades (3 × USD 297). Connect + Call Center incluye USD 1,647 (3 × USD 549). Este beneficio corresponde a la suscripción; no elimina el costo de implementación ni los consumos que se acuerden por separado."
  },
  {
    q: "¿Hay un costo por agregar usuarios?",
    a: "No hay cargo por usuario adicional en estos paquetes de lanzamiento. Definimos los roles y permisos de cada persona durante la implementación. Esto no implica consumo ilimitado de telefonía, IA o servicios externos."
  },
  {
    q: "¿La telefonía y los minutos de IA están incluidos?",
    a: "El alcance de telefonía, minutos, consumo de IA y servicios externos se especifica en la propuesta antes de contratar. Las tres mensualidades incluidas de Connect y Connect + Call Center corresponden a la suscripción de la plataforma."
  },
  {
    q: "¿Cómo se cotiza Enterprise?",
    a: "La implementación parte de USD 12,000. El soporte y acompañamiento se cotizan desde USD 1,200 al mes durante tres meses, por separado de la implementación. El desarrollo, las integraciones y la continuidad posterior se definen en la consultoría inicial. La promoción de mensualidades incluidas corresponde a Connect y Connect + Call Center."
  },
  {
    q: "¿Pueden migrar nuestros datos y capacitar al equipo?",
    a: "Revisamos tus datos y herramientas actuales para definir la migración y las conexiones necesarias. La capacitación se adapta a los roles del equipo; el calendario de implementación y seguimiento se acuerda según el alcance del proyecto."
  },
  {
    q: "¿Puedo empezar con Connect y añadir el Call Center después?",
    a: "Sí. En la demo podemos definir una primera etapa con Connect y cotizar después la ampliación al Call Center. El costo de la ampliación y las condiciones aplicables se confirman en la propuesta."
  }
];

export const rotatingWords = [
  "Call Centers de IA",
  "Marketing + IA",
  "Equipos de iAgents",
  "CRM Inteligente",
  "ERPs Autónomos",
  "Avatars de IA"
];

export function marketingLoginUrl(appUrl = "/login") {
  try {
    const url = new URL(appUrl, "https://www.getstratosai.com");
    if (url.pathname === "/") { url.pathname = "/login"; url.searchParams.delete("app"); }
    return /^https?:\/\//i.test(appUrl) ? url.href : `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/login"; }
}
