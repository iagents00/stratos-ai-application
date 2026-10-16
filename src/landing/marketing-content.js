export const plans = [
  {
    "name": "Start",
    "desc": "Entra rápido. Ordena seguimiento y logra adopción real del sistema.",
    "price": 37,
    "regular": 147,
    "users": "3 usuarios incluidos",
    "cta": "Activar Start",
    "features": [
      "CRM base y pipeline",
      "Registro por voz o texto",
      "Notas, tareas y seguimiento",
      "Dashboard ejecutivo básico",
      "Onboarding guiado",
      "Soporte incluido"
    ]
  },
  {
    "name": "Growth",
    "desc": "Para equipos que ya venden y necesitan más velocidad y visibilidad.",
    "price": 97,
    "regular": 297,
    "badge": "Más elegido",
    "highlight": true,
    "users": "10 usuarios incluidos",
    "cta": "Escalar con Growth",
    "features": [
      "Todo lo de Start",
      "Hasta 10 usuarios",
      "Reportes por asesor",
      "Flujos de reactivación",
      "Recomendaciones de siguiente paso",
      "Prioridad en soporte",
      "Visibilidad completa para dirección"
    ]
  },
  {
    "name": "Scale",
    "desc": "Estructura, workflows y advisory mensual para empresas en crecimiento.",
    "price": 297,
    "regular": 797,
    "users": "25 usuarios incluidos",
    "cta": "Activar Scale",
    "features": [
      "Todo lo de Growth",
      "Hasta 25 usuarios",
      "Advisory estratégico mensual",
      "Workflows y playbooks",
      "Revisión ejecutiva periódica",
      "Soporte prioritario",
      "Optimización continua"
    ]
  }
];

export const faqs = [
  {
    "q": "¿Cuánto tiempo tarda la implementación?",
    "a": "Start puede estar activo en 24-48 horas. Growth y Scale incluyen onboarding guiado de 1 a 2 semanas para garantizar adopción real. Enterprise varía según alcance."
  },
  {
    "q": "¿Pueden migrar nuestros datos desde otro CRM?",
    "a": "Sí. Acompañamos la migración desde cualquier sistema: Excel, HubSpot, Salesforce, Pipedrive o cualquier base de datos existente."
  },
  {
    "q": "¿Qué pasa al terminar el periodo de oferta especial?",
    "a": "Tu cuenta pasa al precio regular del plan elegido. Siempre avisamos con al menos 30 días de anticipación. Sin cargos automáticos sin previo aviso."
  },
  {
    "q": "¿Puedo agregar usuarios adicionales?",
    "a": "Sí. En cualquier plan puedes agregar usuarios adicionales con un costo mensual por asiento. Consulta la tarifa exacta en tu diagnóstico."
  },
  {
    "q": "¿El agente de voz funciona en WhatsApp?",
    "a": "El registro por texto funciona desde cualquier canal. La integración completa con WhatsApp está disponible como módulo adicional."
  },
  {
    "q": "¿Qué tan difícil es que el equipo adopte el sistema?",
    "a": "Esa es la razón de existir de Stratos AI. El registro por voz o texto elimina la fricción principal. El onboarding guiado asegura que el equipo vea el valor desde el primer día."
  },
  {
    "q": "¿Ofrecen soporte en español y en mi zona horaria?",
    "a": "Sí. El equipo opera en español con soporte en horario de negocio México/Latinoamérica. Growth, Scale y Enterprise tienen acceso a soporte prioritario."
  },
  {
    "q": "¿Puedo subir de plan después?",
    "a": "Completamente. La escalera está diseñada para que crezcas conforme ves utilidad real. Subir de plan preserva todos tus datos, flujos e historial."
  }
];

export const rotatingWords = [
  "Call Centers de IA",
  "Marketing + IA",
  "Equipos de iAgents",
  "CRM Inteligente",
  "ERPs Autónomos",
  "Avatars de IA",
  "seguimiento real"
];

export function marketingLoginUrl(appUrl = "/login") {
  try {
    const url = new URL(appUrl, "https://www.getstratosai.com");
    if (url.pathname === "/") { url.pathname = "/login"; url.searchParams.delete("app"); }
    return /^https?:\/\//i.test(appUrl) ? url.href : `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/login"; }
}
