/**
 * src/clients/brasa-y-piedra/config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración del tenant BRASA Y PIEDRA (corporativo Duke — restaurante).
 *
 * Doctrina 11-ago-2026 (skill replicar-equipo-stratos):
 *   - Molde EQUIPO (NSG) puro. ⛔ SIN pipeline de ventas: un restaurante no
 *     persigue leads — sus actividades son cortas y entre ellos (pedidos y
 *     proteínas, mandar algo a marketing, un platillo nuevo, buscar cocinero
 *     o mesero). Lo suyo son tareas rápidas, recordatorios y el chat.
 *     (Decidido en plan-replicacion-corporativo, de lo que describió Iván.)
 *   - Un menú con módulos vacíos es peor que un menú corto: CRM apagado.
 *   - Tono: claro, cercano y sin tecnicismos — que lo entienda cualquiera.
 *
 * Activación: app.stratoscapitalgroup.com/brasa-y-piedra (path-based).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const brasaYPiedraConfig = {
  id:        "brasa-y-piedra",
  name:      "Brasa y Piedra",
  legalName: "Brasa y Piedra",
  tagline:   "El equipo del restaurante, en orden",

  brand: {
    logoText:                "Brasa y Piedra",
    accent:                  "#DC2626",   // rojo brasa
    accentLight:             "#EF4444",
    favicon:                 "/favicon.ico",
    intelligenceCenterLabel: "Centro de Inteligencia · Brasa y Piedra",
  },

  tenant: {
    clientId:       "brasa-y-piedra",
    organizationId: "ea74b69a-6904-4c65-a0ca-e0af58f1473a",
    supabaseRef:    "glulgyhkrqpykxmujodb",
  },

  // ⛔ CRM APAGADO a propósito: este tenant vive de tareas + agenda + chat
  // (molde equipo). Si algún día venden EVENTOS con cotización y anticipo,
  // ahí sí se prende con un pipeline corto de 5 etapas (ya está diseñado
  // en context/plan-pipelines-por-industria.md del AIOS).
  features: {
    crm:          false,
    dash:         false,
    erp:          false,
    team:         false,
    iacrm:        false,
    landingPages: false,
    finanzas:     false,
    rrhh:         false,
    trash:        true,
    comandoDirectivo: false,
  },

  support: { email: null, whatsapp: null, phoneLabel: null },
};

export default brasaYPiedraConfig;
