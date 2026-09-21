/**
 * Entrada neutral para organizaciones creadas desde la consola de plataforma.
 *
 * No lleva organizationId a propósito: la identidad y el aislamiento los
 * determina el perfil autenticado + RLS. Así una empresa nueva puede entrar
 * inmediatamente por /tenant sin caer en la marca o configuración de Duke.
 */
const tenantConfig = {
  id: "tenant",
  name: "Stratos",
  legalName: "Stratos Capital Group",
  tagline: "Tu operación comercial, en un solo lugar",

  brand: {
    logoText: "Stratos",
    appWordmark: "Stratos",
    accent: "#6EE7C2",
    accentLight: "#A7F3D0",
    favicon: "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia",
  },

  tenant: {
    clientId: "tenant",
    organizationId: null,
    supabaseRef: "glulgyhkrqpykxmujodb",
  },

  features: {
    crm: true,
    dash: true,
    team: true,
    teamAdmin: true,
    iacrm: true,
    trash: true,
    whatsappSignup: false,
    whatsappModule: false,
    whatsappChat: false,
    erp: false,
    landingPages: false,
    finanzas: false,
    rrhh: false,
    comandoDirectivo: false,
    caja: false,
    cajaAsesores: false,
    copilotModule: false,
    mktModule: false,
    procesoGuiado: false,
  },

  support: {
    email: "soporte@stratoscapitalgroup.com",
    whatsapp: null,
    phoneLabel: null,
  },
};

export default tenantConfig;
