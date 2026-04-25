/**
 * app/constants/navigation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración de navegación y permisos por módulo.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Users, Hexagon, Activity, Building2, Atom,
  Trophy, Landmark, UserCheck, CreditCard, Shield
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
  { id: "planes",l: "Planes",    i: CreditCard, more: true },
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
  planes: ["super_admin","admin","director","ceo","asesor"],
  admin:  ["super_admin","admin"],
};

export const MODULE_NAMES = {
  d: "Comando", c: "CRM", ia: "iAgents", e: "ERP",
  a: "Asesores", lp: "Campañas", fa: "Finanzas",
  rrhh: "Personas", planes: "Planes", admin: "Usuarios",
};
