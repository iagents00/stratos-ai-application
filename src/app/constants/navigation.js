/**
 * app/constants/navigation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración de navegación y permisos por módulo.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Users, Hexagon, Activity, Building2, Atom,
  Trophy, Landmark, UserCheck, CreditCard, Shield, User, Trash2
} from "lucide-react";

export const nav = [
  { id: "c",     l: "CRM",       i: Users      },
  { id: "lp",    l: "Create",    i: Hexagon    },
  { id: "d",     l: "Comando",   i: Activity   },
  { id: "e",     l: "ERP",       i: Building2  },
  { id: "ia",    l: "iAgents",   i: Atom       },
  { id: "a",     l: "Asesores",  i: Trophy,    more: true },
  { id: "fa",    l: "Finanzas",  i: Landmark,  more: true },
  { id: "rrhh",  l: "Personas",  i: UserCheck, more: true },
  { id: "trash", l: "Papelera",  i: Trash2,    more: true },
  { id: "planes",l: "Planes",    i: CreditCard, more: true },
  { id: "perfil",l: "Perfil",    i: User,      more: true },
  { id: "admin", l: "Usuarios",  i: Shield,    more: true, adminOnly: true },
];

export const MODULE_ROLES = {
  d:      ["super_admin","admin","director","ceo"],
  c:      ["super_admin","admin","director","ceo","asesor"],
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
  d: "Comando", c: "CRM", ia: "iAgents", e: "ERP",
  a: "Asesores", lp: "Campañas", fa: "Finanzas",
  rrhh: "Personas", trash: "Papelera",
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

export function isStratosOrg(orgId) {
  return orgId === STRATOS_ORG_ID;
}

/**
 * Decide si un usuario puede acceder a un módulo.
 * Combina dos capas:
 *   1) Aislamiento por organización: clientes externos solo CRM + perfil + papelera.
 *   2) Permiso por rol dentro de la org (MODULE_ROLES).
 *
 * Si el módulo no está en MODULE_ROLES, se asume público (default true).
 */
export function canAccessModule(moduleId, user, clientConfig = null) {
  if (!user) return false;
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
