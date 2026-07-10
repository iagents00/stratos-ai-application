/**
 * app/views/ZoomControl/ZoomLista.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lista compacta y clickeable de Zooms — la usan los apartados "Calentitos" y
 * "Reactivación" (los que Ema llevaba como pestañas en su sheet). Cada fila
 * abre el modal de edición del panel (onOpenZoom = openEdit).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Flame } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { estatusColor } from "./constants";
import { prettyDate } from "./dates";

export default function ZoomLista({ items = [], T, isLight, onOpenZoom = null, emptyMsg = "Sin Zooms aquí." }) {
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  if (items.length === 0) {
    return (
      <div style={{
        borderRadius: 12, border: `1px dashed ${rowBorder}`, padding: "26px 16px",
        textAlign: "center", fontSize: 13, color: T.txt3, fontFamily: font,
      }}>{emptyMsg}</div>
    );
  }
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${rowBorder}`, overflow: "hidden" }}>
      {items.map((r, i) => {
        const c = estatusColor(r.estatus);
        return (
          <div
            key={r.id}
            onClick={onOpenZoom ? () => onOpenZoom(r) : undefined}
            title={onOpenZoom ? "Abrir este Zoom" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderTop: i === 0 ? "none" : `1px solid ${rowBorder}`,
              cursor: onOpenZoom ? "pointer" : "default",
              background: r.calentito ? "rgba(234,88,12,0.07)" : "transparent",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = r.calentito ? "rgba(234,88,12,0.07)" : "transparent"; }}
          >
            <span style={{ width: 92, flexShrink: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{prettyDate(r.fecha_zoom)}</span>
              <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.txt2, fontFamily: fontDisp }}>{r.hora || "sin hora"}</span>
            </span>
            <span style={{ flex: "1 1 26%", minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.calentito && <Flame size={13} color="#EA580C" strokeWidth={2.6} />}
              {r.cliente || "—"}
            </span>
            <span style={{ flex: "1 1 16%", minWidth: 0, fontSize: 12, color: T.txt2, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.liner || "—"}</span>
            <span style={{ flex: "1 1 16%", minWidth: 0, fontSize: 12, color: T.txt2, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.presentador_principal || "—"}</span>
            <span style={{ flex: "1 1 22%", minWidth: 0, fontSize: 11.5, color: T.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.comentarios || ""}>
              {r.comentarios || ""}
            </span>
            <span style={{
              flexShrink: 0, padding: "3px 10px", borderRadius: 99,
              fontSize: 11, fontWeight: 700, fontFamily: fontDisp,
              color: isLight ? `color-mix(in srgb, ${c} 62%, #0B1220 38%)` : c,
              background: isLight ? `${c}1F` : `${c}22`, border: `1px solid ${c}55`,
            }}>{r.estatus}</span>
          </div>
        );
      })}
    </div>
  );
}
