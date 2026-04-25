/**
 * app/components/IAOSIsland.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Indicador IAOS en el header — muestra métricas animadas del pipeline.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { fontDisp } from "../../design-system/tokens";

export default function IAOSIsland({ leadsData, isLight, idx }) {
  const hot       = leadsData.filter(l => l.hot).length;
  const inact     = leadsData.filter(l => l.daysInactive >= 5).length;
  const totalPipe = (leadsData.reduce((s, l) => s + (l.presupuesto || 0), 0) / 1e6).toFixed(1);

  const phrases = [
    `Duke · ${hot} alertas activas`,
    `$${totalPipe}M en pipeline`,
    `${inact} leads sin actividad`,
    `Protocolo Duke activo`,
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.05)",
      borderRadius: 10, padding: "5px 10px",
      border: `1px solid ${isLight ? "rgba(13,154,118,0.14)" : "rgba(110,231,194,0.10)"}`,
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* IAOS label */}
      <span style={{
        fontSize: 9, fontFamily: fontDisp, fontWeight: 800,
        letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1,
        color: isLight ? "rgba(13,154,118,0.70)" : "rgba(110,231,194,0.60)",
        flexShrink: 0, marginRight: 8,
      }}>IAOS</span>

      {/* Separator */}
      <div style={{ width: 1, height: 10, background: isLight ? "rgba(13,154,118,0.20)" : "rgba(110,231,194,0.15)", flexShrink: 0, marginRight: 8 }} />

      {/* Slide text left→right — key on idx re-mounts span triggering CSS animation */}
      <div style={{ overflow: "hidden", height: 14, width: 118, flexShrink: 0 }}>
        <span key={idx} style={{
          display: "block",
          fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500,
          letterSpacing: "-0.012em", whiteSpace: "nowrap",
          color: isLight ? "rgba(10,20,15,0.62)" : "rgba(255,255,255,0.62)",
          animation: "iaosSlideIn 0.40s cubic-bezier(0.22,1,0.36,1) both",
        }}>{phrases[idx]}</span>
      </div>
    </div>
  );
}
