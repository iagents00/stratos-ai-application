/**
 * app/features/Admin/RoleBadge.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Badge de rol de usuario con colores según nivel.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { P } from "../../../design-system/tokens";

export const ROLE_META = {
  super_admin: { label: "Super Admin", color: "#A78BFA", level: 1 },
  admin:       { label: "Admin",       color: "#F59E0B", level: 2 },
  ceo:         { label: "CEO",         color: "#7EB8F0", level: 3 },
  director:    { label: "Director",    color: "#5DC8D9", level: 4 },
  asesor:      { label: "Asesor",      color: "#6EE7C2", level: 5 },
};

export function RoleBadge({ role }) {
  const m = ROLE_META[role] || { label: role, color: P.txt3 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 99, fontSize: 10.5, fontWeight: 700,
      color: m.color, background: `${m.color}12`, border: `1px solid ${m.color}28`,
      letterSpacing: "0.03em",
    }}>{m.label}</span>
  );
}
