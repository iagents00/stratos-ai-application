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
import { L } from "../constants/labels";
import { IS_CUSTOM_PIPELINE } from "../constants/pipeline";
import { resolveClientFromLocation } from "../../clients";

// ¿El tenant tiene el CRM apagado? (Brasa y Piedra). Sin CRM no hay leads ni
// protocolo de ventas que anunciar en la pill.
const CRM_APAGADO = (() => {
  try { return resolveClientFromLocation()?.features?.crm === false; } catch { return false; }
})();

/* `phrases`: si viene, manda. Lo usa MARKETING, que no tiene leads y muestra
   sus propios números (tareas vencidas, videos parados, quién no reportó).
   Sin esa prop se comporta exactamente como siempre — ventas no cambia. */
export default function IAOSIsland({ leadsData = [], isLight, idx, brandLabel = "Duke", onOpen, phrases: phrasesProp }) {
  const hot       = leadsData.filter(l => l.hot).length;
  // "Sin actividad": el campo daysInactive viene en 0 (stale) → daba siempre 0.
  // Proxy real y puro: leads sin próxima acción agendada (nadie definió el siguiente paso).
  const inact     = leadsData.filter(l => !l.nextActionDate && !l.next_action_date && !l.nextAction).length;
  const totalPipe = (leadsData.reduce((s, l) => s + (Number(l.presupuesto) || Number(l.budget) || 0), 0) / 1e6).toFixed(1);

  // Forma corta del brand para el indicador chico (primer token o "Duke" como fallback).
  // Ej: "Duke del Caribe" → "Duke" · "Grupo 28" → "Grupo 28".
  const shortBrand = brandLabel.split(" ")[0] || "Duke";

  // Pipelines custom (Legacy, Vega, NSG…): sin dinero-en-pipeline ni la palabra
  // «leads» — el registro se llama como esa empresa lo llama (casa, pedido…).
  const phrases = phrasesProp && phrasesProp.length ? phrasesProp : (CRM_APAGADO ? [
    `${shortBrand} al día`,
    `Avisos solo en tu jornada`,
  ] : IS_CUSTOM_PIPELINE ? [
    `${shortBrand} · ${hot} alertas activas`,
    `${inact} ${L.entityPlural} sin siguiente paso`,
    `${shortBrand} al día`,
  ] : [
    `${shortBrand} · ${hot} alertas activas`,
    `$${totalPipe}M en pipeline`,
    `${inact} leads sin actividad`,
    `Protocolo ${shortBrand} activo`,
  ]);

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
      {/* IAOS label */}
      <span style={{
        fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500,
        letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1,
        color: isLight ? "rgba(13,154,118,0.70)" : "rgba(110,231,194,0.60)",
        flexShrink: 0, marginRight: 8,
      }}>IAOS</span>

      {/* Separator */}
      <div style={{ width: 1, height: 10, background: isLight ? "rgba(13,154,118,0.20)" : "rgba(110,231,194,0.15)", flexShrink: 0, marginRight: 8 }} />

      {/* Slide text left→right — key on idx re-mounts span triggering CSS animation */}
      <div className="stratos-iaos-ticker" style={{ overflow: "hidden", height: 14, width: 118, flexShrink: 0 }}>
        <span key={idx} style={{
          display: "block",
          fontSize: 11.5, fontFamily: fontDisp, fontWeight: 500,
          letterSpacing: "-0.012em", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
          color: isLight ? "rgba(10,20,15,0.62)" : "rgba(255,255,255,0.62)",
          animation: "iaosSlideIn 0.40s cubic-bezier(0.22,1,0.36,1) both",
        }}>{phrases[idx]}</span>
      </div>
    </div>
  );
}
