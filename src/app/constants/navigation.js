/**
 * app/constants/navigation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración de navegación y permisos por módulo.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Users, Hexagon, Activity, Building2, Atom,
  Trophy, Landmark, UserCheck, CreditCard, Shield, User, Trash2, Wallet, MessageCircle, Bot, Sparkles
} from "lucide-react";

export const nav = [
  { id: "c",     l: "CRM",       i: Users      },
  { id: "copilot", l: "Copilot", i: Bot        },
  { id: "wa",    l: "WhatsApp",  i: MessageCircle },
  { id: "lp",    l: "Create",    i: Hexagon    },
  { id: "d",     l: "Comando",   i: Activity   },
  { id: "caja",  l: "Caja",      i: Wallet     },
  { id: "e",     l: "Proyectos", i: Building2  },
  { id: "ia",    l: "iAgents",   i: Atom       },
  { id: "fa",    l: "Finanzas",  i: Landmark,  more: true },
  { id: "rrhh",  l: "Stratos RH",i: UserCheck, more: true },
  { id: "trash", l: "Papelera",  i: Trash2,    more: true },
  { id: "planes",l: "Planes",    i: CreditCard, more: true },
  { id: "perfil",l: "Perfil",    i: User,      more: true },
  { id: "admin", l: "Usuarios",  i: Shield,    more: true, adminOnly: true },
];

/* Módulos PRIMARIOS del bottom-nav móvil (máximo 4 + "Más"): con los 8 de
   antes cada botón quedaba en ~45px a 360px — labels cortados y targets por
   debajo del mínimo táctil. Los demás módulos viven en el sheet "Más".
   (El sidebar de desktop NO usa esta lista — muestra todo como siempre.) */
export const MOBILE_PRIMARY_NAV = ["c", "copilot", "wa", "lp", "d"];

export const MODULE_ROLES = {
  d:      ["super_admin","admin","director","ceo"],
  c:      ["super_admin","admin","director","ceo","asesor"],
  // Copilot: chat con el asistente IA (el mismo del bot de Telegram) embebido en
  // el CRM. Es para el asesor (su asistente para operar leads), así que todos los
  // roles lo ven. Gateado por features.copilotModule.
  copilot: ["super_admin","admin","director","ceo","asesor"],
  // Caja: cuentas / ingresos / egresos sobre team_expenses. Por defecto SOLO
  // mando (admin/director/ceo): la RLS de team_expenses filtra únicamente por
  // organización (no por rol), así que dar el módulo a los asesores les
  // mostraría TODO el libro de la org. Los clientes que quieran que sus
  // asesores/empleados también carguen desde la web (ej. Constructora Vega)
  // lo habilitan con `features.cajaAsesores: true` en su config.
  caja:   ["super_admin","admin","director","ceo"],
  // WhatsApp: bandeja de conversaciones — el asesor DEBE verla (es donde se
  // entera de que un cliente le escribió). Gateada por flag whatsappModule.
  wa:     ["super_admin","admin","director","ceo","asesor"],
  ia:     ["super_admin","admin","director","ceo"],
  e:      ["super_admin","admin","director","ceo"],
  a:      ["super_admin","admin","director","ceo"],
  lp:     ["super_admin","admin","director","ceo"],
  fa:     ["super_admin","admin","director","ceo"],
  rrhh:   ["super_admin","admin","director","ceo"],
  trash:  ["super_admin","admin","director","ceo","asesor"],
  planes: ["super_admin","admin","director","ceo","asesor"],
  perfil: ["super_admin","admin","director","ceo","asesor"],
  admin:  ["super_admin","admin"],
};

export const MODULE_NAMES = {
  d: "Comando", c: "CRM", ia: "iAgents", e: "Proyectos",
  a: "Asesores", lp: "Campañas", fa: "Finanzas",
  rrhh: "Stratos RH", trash: "Papelera", caja: "Caja",
  wa: "WhatsApp", copilot: "Copilot",
  planes: "Planes", perfil: "Perfil", admin: "Usuarios",
};

// ─── Aislamiento por organización ─────────────────────────────────────────────
// Stratos Capital Group es la org "matriz" — sus usuarios ven todos los módulos
// según su rol. Cualquier OTRA organización (clientes que usan la plataforma,
// p.ej. Grupo 28) tiene acceso ÚNICAMENTE al CRM y módulos esenciales para
// operar (perfil para cambiar contraseña, papelera del propio CRM).
// Esto aplica a TODOS los roles del cliente, incluyendo super_admin/ceo: el
// super_admin de Grupo 28 administra Grupo 28, no los módulos internos de
// Stratos (Finanzas, Personas, Comando, ERP, iAgents, Campañas, Asesores).
export const STRATOS_ORG_ID = "00000000-0000-0000-0000-000000000001";
export const EXTERNAL_ORG_MODULES = new Set(["c", "perfil", "trash"]);
// Módulos visibles para usuarios con flag crm_only=true (cuentas tipo bot/IA
// como iagents@stratos.ai). Conservan su rol pero solo navegan CRM + Perfil.
export const CRM_ONLY_MODULES = new Set(["c", "perfil"]);

export function isStratosOrg(orgId) {
  return orgId === STRATOS_ORG_ID;
}

/**
 * Decide si un usuario puede acceder a un módulo.
 * Combina tres capas:
 *   1) Restricción per-usuario `crm_only`: cuentas bot/IA solo ven CRM + Perfil.
 *   2) Aislamiento por organización: clientes externos solo CRM + perfil + papelera.
 *   3) Permiso por rol dentro de la org (MODULE_ROLES).
 *
 * Si el módulo no está en MODULE_ROLES, se asume público (default true).
 */
export function canAccessModule(moduleId, user, clientConfig = null) {
  if (!user) return false;
  // (1) Restricción per-usuario — gana sobre todo lo demás.
  if (user.crmOnly === true && !CRM_ONLY_MODULES.has(moduleId)) return false;

  // Caja (cuentas / ingresos / egresos) es 100% por feature flag del cliente,
  // y se evalúa ANTES del aislamiento por org para que también aplique a los
  // tenants externos (Grupo 28, Vega, …). Con `features.caja: true` los roles
  // de mando (admin/director/ceo/super_admin) la ven. Los asesores/empleados
  // SOLO la ven si el cliente además prende `features.cajaAsesores: true`
  // (ej. Vega, donde el equipo de campo registra gastos por Telegram/web).
  // Se separa así porque la RLS de team_expenses es org-scoped, no por rol.
  if (moduleId === "caja") {
    // Caja ahora vive como PESTAÑA dentro de Finanzas. Si el usuario tiene
    // acceso a Finanzas, no la mostramos como opción suelta (evita duplicar).
    // Los tenants con Caja pero SIN Finanzas (p.ej. Vega asesores) la siguen
    // viendo standalone.
    if (canAccessModule("fa", user, clientConfig)) return false;
    if (clientConfig?.features?.caja !== true) return false;
    if (MODULE_ROLES.caja.includes(user.role)) return true;
    if (user.role === "asesor" && clientConfig?.features?.cajaAsesores === true) return true;
    return false;
  }

  // WhatsApp (bandeja de conversaciones): igual que Caja, 100% por feature flag.
  // Sin `features.whatsappModule: true` nadie lo ve. Con el flag, el rol decide
  // (incluye asesor: es justo quien necesita enterarse de los mensajes nuevos).
  if (moduleId === "wa") {
    if (clientConfig?.features?.whatsappModule !== true) return false;
    if (user.isDemo) return false; // la cuenta demo no tiene datos reales de WhatsApp
    // ⏸️ OCULTO temporalmente (09-jul-2026): la funcionalidad está COMPLETA pero
    // NO se expone a los asesores todavía — los números se están conectando por
    // COEXISTENCIA directo a Meta (ver context/whatsapp-multicliente-plan.md del
    // AIOS + changelog 09-jul cont. 7). Mientras tanto solo super_admin (nosotros)
    // lo ve, para seguir probando/demostrando sin desbloquearlo al equipo.
    //   • Reactivar para TODOS: borrar esta línea.
    //   • Apagarlo del todo (ni super_admin): whatsappModule:false en el config.
    if (user.role !== "super_admin") return false;
    return MODULE_ROLES.wa.includes(user.role);
  }

  // Copilot (chat del asistente IA): igual que WhatsApp/Caja, 100% por feature flag.
  // Sin `features.copilotModule: true` nadie lo ve. Con el flag, el rol decide
  // (incluye asesor: es justo quien usa el asistente para operar sus leads).
  // Se evalúa ANTES del aislamiento por org para que también aplique a tenants
  // externos que lo habiliten (usan el mismo bot multi-tenant).
  if (moduleId === "copilot") {
    if (clientConfig?.features?.copilotModule !== true) return false;
    return MODULE_ROLES.copilot.includes(user.role);
  }

  if (!isStratosOrg(user.organizationId) && !EXTERNAL_ORG_MODULES.has(moduleId)) {
    // Excepción: si el cliente externo prendió Comando Directivo (`d`)
    // en su config, lo dejamos pasar para que el rol decida después.
    const isComandoDirectivoOpenIn = (
      moduleId === "d" && clientConfig?.features?.comandoDirectivo === true
    );
    if (!isComandoDirectivoOpenIn) return false;
  }
  const roles = MODULE_ROLES[moduleId];
  if (!roles) return true;
  return roles.includes(user.role);
}
