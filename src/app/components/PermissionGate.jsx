/**
 * app/components/PermissionGate.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla de acceso restringido por rol.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Shield, ArrowRight } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { MODULE_NAMES } from "../constants/navigation";

export default function PermissionGate({ moduleId, onGoBack }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 20, padding: 40,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Shield size={32} color={P.txt3} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 8 }}>
          Acceso restringido
        </p>
        <p style={{ fontSize: 13, color: P.txt3, lineHeight: 1.7, marginBottom: 6 }}>
          No tienes permiso para acceder al módulo <span style={{ color: P.txt2, fontWeight: 600 }}>{MODULE_NAMES[moduleId] || moduleId}</span>.
        </p>
        <p style={{ fontSize: 12, color: P.txt3, lineHeight: 1.6 }}>
          Contacta a tu director o administrador para solicitar acceso.
        </p>
      </div>
      <button onClick={onGoBack} style={{
        marginTop: 8, padding: "10px 24px", borderRadius: 11,
        background: `${P.accent}14`, border: `1px solid ${P.accentB}`,
        color: P.accent, fontSize: 13, fontWeight: 700,
        fontFamily: fontDisp, cursor: "pointer", transition: "background 0.18s",
        display: "flex", alignItems: "center", gap: 8,
      }}
        onMouseEnter={e => e.currentTarget.style.background = `${P.accent}22`}
        onMouseLeave={e => e.currentTarget.style.background = `${P.accent}14`}
      >
        <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} />
        Ir a mi CRM
      </button>
    </div>
  );
}
