/**
 * HistoryDrawer — Modal de historial de cambios para cualquier entidad.
 *
 * Usa la RPC `get_entity_history` (Supabase) que respeta RLS:
 *   • super_admin / admin / ceo ven todo
 *   • cualquier usuario ve los eventos donde fue actor
 *
 * Uso:
 *   <HistoryDrawer
 *     open={true}
 *     entityType="leads"
 *     entityId={lead.id}
 *     entityLabel={lead.n}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useEffect, useState } from "react";
import { X, Clock, User, Plus, Edit3, Trash2, Archive, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { P, font, fontDisp, mono } from "../../design-system/tokens";
import { getEntityHistory, fieldLabel, actionLabel } from "../../lib/audit";

const ACTION_META = {
  INSERT:         { icon: Plus,        color: P.emerald, label: "Creado" },
  UPDATE:         { icon: Edit3,       color: P.blue,    label: "Modificado" },
  DELETE:         { icon: Trash2,      color: P.rose,    label: "Eliminado" },
  SOFT_DELETE:    { icon: Archive,     color: P.amber,   label: "Archivado" },
  LOGIN:          { icon: LogIn,       color: P.emerald, label: "Inicio de sesión" },
  LOGIN_FAIL:     { icon: ShieldAlert, color: P.rose,    label: "Intento fallido" },
  LOGOUT:         { icon: LogOut,      color: P.txt2,    label: "Cierre de sesión" },
  SIGNUP:         { icon: Plus,        color: P.violet,  label: "Registro de cuenta" },
  PASSWORD_RESET: { icon: ShieldAlert, color: P.amber,   label: "Recuperación de contraseña" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtValue(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 60 ? s.slice(0, 57) + "…" : s;
    } catch { return String(v); }
  }
  const s = String(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

const ChangeRow = ({ field, change }) => {
  const old = change?.old;
  const neu = change?.new;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      gap: 8,
      fontSize: 12, fontFamily: font,
      padding: "4px 0",
    }}>
      <div style={{ color: P.txt3, fontWeight: 600 }}>{fieldLabel(field)}</div>
      <div style={{ color: P.txt2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          color: P.txt3, textDecoration: "line-through",
          fontFamily: mono, fontSize: 11,
        }}>{fmtValue(old)}</span>
        <span style={{ color: P.txt3 }}>→</span>
        <span style={{
          color: P.txt, fontWeight: 600,
          fontFamily: mono, fontSize: 11,
        }}>{fmtValue(neu)}</span>
      </div>
    </div>
  );
};

const HistoryEntry = ({ row }) => {
  const meta = ACTION_META[row.action] || { icon: Clock, color: P.txt2, label: row.action };
  const Icon = meta.icon;
  const fields = row.changed_fields ? Object.keys(row.changed_fields) : [];

  return (
    <div style={{
      padding: 14,
      background: P.glass,
      border: `1px solid ${P.border}`,
      borderRadius: P.r,
      fontFamily: font,
    }}>
      {/* Header: icon + action + when + by */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${meta.color}1F`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={16} color={meta.color} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: P.txt,
            fontFamily: fontDisp,
          }}>
            {actionLabel(row.action)}
          </div>
          <div style={{ fontSize: 11, color: P.txt3, display: "flex", gap: 6, marginTop: 2 }}>
            <Clock size={11} />
            <span>{fmtDate(row.created_at)}</span>
            {row.actor_name && (
              <>
                <span>·</span>
                <User size={11} />
                <span>{row.actor_name}{row.actor_role ? ` (${row.actor_role})` : ""}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fields changed */}
      {fields.length > 0 && (
        <div style={{
          paddingTop: 8,
          borderTop: `1px solid ${P.border}`,
        }}>
          {fields.map(f => (
            <ChangeRow key={f} field={f} change={row.changed_fields[f]} />
          ))}
        </div>
      )}

      {/* Metadata for auth events */}
      {row.metadata && Object.keys(row.metadata).length > 0 && row.action.startsWith("LOGIN") && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px solid ${P.border}`,
          fontSize: 11, color: P.txt3, fontFamily: mono,
        }}>
          {row.metadata.email && <div>email: {row.metadata.email}</div>}
          {row.metadata.reason && <div>razón: {row.metadata.reason}</div>}
        </div>
      )}
    </div>
  );
};

export default function HistoryDrawer({
  open,
  onClose,
  entityType,
  entityId,
  entityLabel,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getEntityHistory(entityType, entityId, 100).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error);
      else setRows(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, entityType, entityId]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100000,
        background: "rgba(3,8,16,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", justifyContent: "flex-end",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100vw)",
          height: "100%",
          background: P.bg2,
          borderLeft: `1px solid ${P.border}`,
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          fontFamily: font,
          animation: "slideInRight 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${P.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontSize: 11, color: P.txt3, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              Historial de cambios
            </div>
            <div style={{
              fontSize: 17, color: P.txt, fontWeight: 700, marginTop: 4,
              fontFamily: fontDisp,
              maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {entityLabel || "—"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 999,
              border: `1px solid ${P.border}`,
              background: P.glass, color: P.txt2,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: 20,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: P.txt3, fontSize: 13 }}>
              Cargando historial…
            </div>
          )}
          {error && (
            <div style={{
              padding: 16,
              background: `${P.rose}14`,
              border: `1px solid ${P.rose}33`,
              borderRadius: P.r,
              color: P.rose, fontSize: 12,
            }}>
              No se pudo cargar el historial: {error}
              <div style={{ color: P.txt3, fontSize: 11, marginTop: 6 }}>
                Asegúrate de haber corrido la migración 003 en Supabase.
              </div>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: P.txt3, fontSize: 13 }}>
              <Clock size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div>Sin cambios registrados todavía.</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>
                Cualquier edición desde ahora quedará en el historial.
              </div>
            </div>
          )}
          {!loading && !error && rows.map(r => (
            <HistoryEntry key={r.id} row={r} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
