/**
 * src/clients/demo/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del espacio de DEMOSTRACIÓN — «Inmobiliaria Aurora».
 *
 * PARA QUÉ EXISTE
 *
 * Para que el revisor de Apple pueda entrar y ver el sistema completo sin que
 * nadie le entregue la puerta de los datos de un cliente real. Es una empresa
 * inventada, con clientes inventados y teléfonos 555.
 *
 * ⚠️ POR QUÉ NO ALCANZABA CON CREAR LA EMPRESA EN LA BASE
 *
 * Una empresa cuyo identificador no esté registrado acá **cae en la
 * configuración de Duke** — es la fuga que encontró la auditoría del 13-ago. Sin
 * este archivo, el revisor de Apple habría entrado y visto la marca y el
 * pipeline de un cliente real. Por eso el archivo existe: no es decoración.
 *
 * Marca deliberadamente NEUTRA: no es Duke, no es NSG, no es ningún cliente.
 * Un azul genérico y un nombre que se lee como lo que es, una demostración.
 *
 * Se llega por app.stratoscapitalgroup.com/demo, y también solo: al entrar el
 * usuario de demostración, el sistema resuelve su empresa por su perfil
 * (getClientIdByOrgId), que es lo que hace que funcione dentro de la app del
 * teléfono, donde no hay dirección web.
 *
 * CÓMO SE QUITA cuando la app esté publicada: borrar este archivo, su línea del
 * registry en index.js, y los datos de la base (las instrucciones están en la
 * migración `empresa_demo_para_la_revision_de_apple`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const demoConfig = {
  id:        "demo",
  name:      "Inmobiliaria Aurora",
  legalName: "Inmobiliaria Aurora (demostración)",
  tagline:   "Tus clientes y tu día, en orden",

  brand: {
    logoText:                "Inmobiliaria Aurora",
    accent:                  "#3B82F6",
    accentLight:             "#60A5FA",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia",
  },

  tenant: {
    clientId:       "demo",
    organizationId: "deded000-0000-4000-a000-000000000001",
    supabaseRef:    "glulgyhkrqpykxmujodb",
    copilotWebhook: "https://personal-n8n.suwsiw.easypanel.host/webhook/copilot-tenant",
    copilotHelp:
      "Esto es lo que puedo hacer por ti:\n\n" +
      "• Tu día: «¿qué tengo hoy?»\n" +
      "• Recordatorios: «recuérdame llamar a Mariana el jueves a las 3»\n" +
      "• Tus clientes: pregúntame por cualquiera de tu cartera\n" +
      "• Anotar al vuelo: dicta una nota y queda guardada en el expediente\n\n" +
      "Todo por texto o por voz.",
  },

  // Lo que se muestra: el CRM y el asistente, que es lo que cuenta la ficha de
  // App Store. Lo demás apagado para que el revisor vea un sistema claro y no
  // un menú lleno de módulos vacíos.
  features: {
    crm:              true,
    dash:             true,
    iacrm:            true,
    copilotModule:    true,
    copilotBrain:     "tareas",
    trash:            true,
    erp:              false,
    team:             false,
    landingPages:     false,
    finanzas:         false,
    rrhh:             false,
    comandoDirectivo: false,
    caja:             false,
    cajaAsesores:     false,
    mktModule:        false,
    teamAdmin:        false,
    teamChat:         false,
    procesoGuiado:    false,
  },

  crm: {
    stages: [
      "Nuevo",
      "Contactado",
      "En conversación",
      "Visita agendada",
      "Visita hecha",
      "Propuesta",
      "Cerrado",
    ],
  },

  support: { email: null, whatsapp: null, phoneLabel: null },

  labels: {
    entity:          "cliente",
    entityCap:       "Cliente",
    entityPlural:    "clientes",
    noAdvisor:       "Sin asesor",
    advisorAll:      "Todos los asesores",
    relatedContacts: "Contactos",
    pageTitle:       "Clientes",
    pageTitleAccent: "",
    pageTitleMobile: "Clientes",
  },
};

export default demoConfig;
