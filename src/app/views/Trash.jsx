/**
 * views/Trash.jsx — Papelera del CRM
 *
 * Lista los leads con deleted_at NOT NULL (soft-deleted). Ofrece:
 *   · Restaurar  → vuelve al CRM principal
 *   · Eliminar definitivamente → DELETE real, solo super_admin/admin (con doble confirmación)
 *
 * Aesthetic: minimalista, mismo design system que el resto del CRM.
 * Mobile-first: card por lead, acciones grandes accesibles con el pulgar.
 */
import { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

export default function Trash({ trashedLeads = [], onRestore, onHardDelete, onRefresh, T }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isLight = T?.bg !== "#060A11" && T?.bg !== "#04080F";
  const canHardDelete = ["super_admin", "admin"].includes(user?.role);

  const [searchQ, setSearchQ] = useState("");
  const [confirmHard, setConfirmHard] = useState(null); // lead pending hard-delete confirmation
  const [busy, setBusy] = useState(null); // id of lead being processed

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      return `${d.getDate()} ${mos[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return "—"; }
  };

  const filtered = trashedLeads.filter(l => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return String(l.n || l.name || "").toLowerCase().includes(q)
        || String(l.asesor || "").toLowerCase().includes(q)
        || String(l.phone || "").includes(q);
  });

  const doRestore = async (lead) => {
    setBusy(lead.id);
    await onRestore?.(lead.id);
    setBusy(null);
  };
  const doHardDelete = async () => {
    if (!confirmHard) return;
    setBusy(confirmHard.id);
    await onHardDelete?.(confirmHard.id);
    setBusy(null);
    setConfirmHard(null);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 18,
      color: T.txt, fontFamily: font,
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{
          margin: 0, fontSize: isMobile ? 24 : 22, fontWeight: 600,
          letterSpacing: "-0.03em", color: isLight ? T.txt : "#FFFFFF",
          fontFamily: fontDisp,
        }}>Papelera</h2>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.txt3, fontFamily: fontDisp }}>
          {trashedLeads.length} cliente{trashedLeads.length !== 1 ? "s" : ""} eliminado{trashedLeads.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onRefresh}
          title="Actualizar"
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 9,
            border: `1px solid ${T.border}`, background: "transparent",
            color: T.txt3, fontSize: 11.5, cursor: "pointer", fontFamily: fontDisp,
            transition: "all 0.16s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; }}
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ position: "relative", maxWidth: isMobile ? "100%" : 360 }}>
        <Search size={isMobile ? 14 : 12} color={T.txt3} style={{ position: "absolute", left: isMobile ? 14 : 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Buscar en papelera…"
          style={{
            width: "100%", height: isMobile ? 44 : 36,
            paddingLeft: isMobile ? 38 : 32, paddingRight: 14,
            borderRadius: 12, border: `1px solid ${T.border}`,
            background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.04)",
            color: T.txt, fontSize: isMobile ? 14 : 12,
            outline: "none", fontFamily: fontDisp, boxSizing: "border-box",
          }}
        />
      </div>

      {/* ── Empty state ── */}
      {trashedLeads.length === 0 && (
        <div style={{
          padding: "60px 20px", textAlign: "center",
          border: `1px dashed ${T.border}`, borderRadius: 14,
          background: T.glass,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: T.glass, border: `1px solid ${T.border}`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
          }}>
            <Trash2 size={22} color={T.txt3} />
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.txt2, fontFamily: fontDisp }}>
            La papelera está vacía
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.txt3 }}>
            Los clientes eliminados aparecerán aquí y podrás restaurarlos en cualquier momento.
          </p>
        </div>
      )}

      {/* ── Lista de leads en papelera ── */}
      {filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(l => {
            const initial = String(l.n || l.name || "?").charAt(0).toUpperCase();
            const isBusy = busy === l.id;
            return (
              <div key={l.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: isMobile ? "12px 14px" : "12px 16px",
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)",
                opacity: isBusy ? 0.5 : 1,
                transition: "opacity 0.18s",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: T.txt2, fontFamily: fontDisp,
                  flexShrink: 0,
                }}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.n || l.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: T.txt3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[l.asesor, l.p, fmtDate(l.deleted_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => doRestore(l)}
                    disabled={isBusy}
                    title="Restaurar"
                    aria-label="Restaurar"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: isMobile ? "9px 12px" : "7px 11px",
                      borderRadius: 9,
                      border: `1px solid ${T.accent}55`,
                      background: `${T.accent}14`,
                      color: T.accent, fontSize: isMobile ? 12 : 11, fontWeight: 700,
                      fontFamily: fontDisp, cursor: isBusy ? "not-allowed" : "pointer",
                      transition: "all 0.16s",
                    }}
                  >
                    <RotateCcw size={12} strokeWidth={2.4} /> Restaurar
                  </button>
                  {canHardDelete && (
                    <button
                      onClick={() => setConfirmHard(l)}
                      disabled={isBusy}
                      title="Eliminar definitivamente"
                      aria-label="Eliminar definitivamente"
                      style={{
                        display: "inline-flex", alignItems: "center",
                        padding: isMobile ? "9px 11px" : "7px 9px",
                        borderRadius: 9,
                        border: `1px solid ${T.border}`,
                        background: "transparent",
                        color: T.txt3,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        transition: "all 0.16s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; e.currentTarget.style.color = "#EF4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
                    >
                      <Trash2 size={12} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal de confirmación hard-delete ── */}
      {confirmHard && (
        <div
          onClick={() => setConfirmHard(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              padding: 22, borderRadius: 16,
              background: isLight ? "#FFFFFF" : "#0F1419",
              border: `1px solid ${T.borderH}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.32)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}>
              <AlertTriangle size={20} color="#EF4444" />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
              ¿Eliminar definitivamente?
            </h3>
            <p style={{ margin: "8px 0 18px", fontSize: 12.5, color: T.txt2, lineHeight: 1.5 }}>
              <strong style={{ color: T.txt }}>{confirmHard.n || confirmHard.name}</strong> se borrará permanentemente de la base de datos. Esta acción <strong>no se puede deshacer</strong>.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmHard(null)}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${T.border}`, background: "transparent",
                  color: T.txt2, fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
                  cursor: "pointer",
                }}
              >Cancelar</button>
              <button
                onClick={doHardDelete}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.18)",
                  color: "#FCA5A5", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                  cursor: "pointer",
                }}
              >Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
