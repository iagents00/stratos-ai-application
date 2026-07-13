/**
 * app/components/IAOSIsland.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Indicador IAOS en el header — muestra métricas animadas del pipeline.
 * Extraído de App.jsx.
 *
 * El brandLabel viene como prop desde App.jsx (orgBrand). Permite que cada
 * cliente (Duke, Grupo 28, etc.) vea su propia marca en las notificaciones
 * sin tener strings hardcoded acá.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { fontDisp } from "../../design-system/tokens";
import { IosIcon } from "../icons/ios-icons";

export default function IAOSIsland({ leadsData, isLight, idx, brandLabel = "Duke", onOpen }) {
  const hot       = leadsData.filter(l => l.hot).length;
  // "Sin actividad": el campo daysInactive viene en 0 (stale) → daba siempre 0.
  // Proxy real y puro: leads sin próxima acción agendada (nadie definió el siguiente paso).
  const inact     = leadsData.filter(l => !l.nextActionDate && !l.next_action_date && !l.nextAction).length;
  const totalPipe = (leadsData.reduce((s, l) => s + (Number(l.presupuesto) || Number(l.budget) || 0), 0) / 1e6).toFixed(1);

  // Forma corta del brand para el indicador chico (primer token o "Duke" como fallback).
  // Ej: "Duke del Caribe" → "Duke" · "Grupo 28" → "Grupo 28".
  const shortBrand = brandLabel.split(" ")[0] || "Duke";

  const phrases = [
    `${shortBrand} · ${hot} alertas activas`,
    `$${totalPipe}M en pipeline`,
    `${inact} leads sin actividad`,
    `Protocolo ${shortBrand} activo`,
  ];

  return (
    /* className: en móvil el bloque CSS global (App.jsx) lo hace COMPRESIBLE
       (flex-shrink + min-width 0) para que nunca desborde bajo los íconos.
       onOpen: tocar la pill abre el Centro de Inteligencia — en móvil es el
       acceso SIEMPRE visible (la pill del DynIsland está oculta ahí). */
    <div className="stratos-iaos-pill" onClick={onOpen} role={onOpen ? "button" : undefined} style={{
      display: "flex", alignItems: "center", gap: 0,
      background: isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.05)",
      borderRadius: 10, padding: "5px 10px",
      border: `1px solid ${isLight ? "rgba(13,154,118,0.14)" : "rgba(110,231,194,0.10)"}`,
      flexShrink: 0, overflow: "hidden",
      cursor: onOpen ? "pointer" : "default",
    }}>
      {/* COMPACTO — SOLO móvil: chip "Inteligencia" (abre el Centro de
          Inteligencia). Oculto en escritorio (inline display:none); el bloque
          @media(max-width:768px) de App.jsx lo muestra y esconde IAOS+ticker. */}
      <span className="iaos-compact" style={{
        display: "none", alignItems: "center", gap: 5, lineHeight: 1,
        fontSize: 11.5, fontFamily: fontDisp, fontWeight: 700, letterSpacing: "-0.01em",
        color: isLight ? "rgba(13,154,118,0.92)" : "rgba(190,245,225,0.92)",
      }}>
        <IosIcon name="intel" filled size={13} color={isLight ? "#0D9A76" : "#6EE7C2"} />
        Inteligencia
      </span>

      {/* IAOS label (escritorio) */}
      <span className="iaos-full" style={{
        fontSize: 9, fontFamily: fontDisp, fontWeight: 800,
        letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1,
        color: isLight ? "rgba(13,154,118,0.70)" : "rgba(110,231,194,0.60)",
        flexShrink: 0, marginRight: 8,
      }}>IAOS</span>

      {/* Separator (escritorio) */}
      <div className="iaos-full-sep" style={{ width: 1, height: 10, background: isLight ? "rgba(13,154,118,0.20)" : "rgba(110,231,194,0.15)", flexShrink: 0, marginRight: 8 }} />

      {/* Slide text left→right — key on idx re-mounts span triggering CSS animation */}
      <div className="stratos-iaos-ticker" style={{ overflow: "hidden", height: 14, width: 118, flexShrink: 0 }}>
        <span key={idx} style={{
          display: "block",
          fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500,
          letterSpacing: "-0.012em", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
          color: isLight ? "rgba(10,20,15,0.62)" : "rgba(255,255,255,0.62)",
          animation: "iaosSlideIn 0.40s cubic-bezier(0.22,1,0.36,1) both",
        }}>{phrases[idx]}</span>
      </div>
    </div>
  );
}
