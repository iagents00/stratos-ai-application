/**
 * app/views/ProductividadTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 3ª pestaña del Comando Directivo: "Indicadores · Productividad".
 * Muestra, por asesor, las acciones de su Lista de Acción (tabla team_actions):
 * cuántas pendientes / completadas y el % de avance. RLS de Supabase ya filtra
 * por la organización del usuario logueado.
 *
 * DESPLEGABLE (Jun 2026): cada asesor se puede expandir para ver el detalle de
 * sus acciones — Pendientes vs Completadas — con su estado, fecha y la nota que
 * dejó al responder por Telegram.
 *
 * ESTADOS (el coach de Telegram los setea al tocar un botón):
 *   · "Ya la hice"   → done=true                    → Completada (verde)
 *   · "En proceso"   → status='in_progress'         → En proceso (ámbar)
 *   · "No la hice"   → status='not_done' + escala   → No la hice (rosa, ya avisó a admins)
 *   · (sin responder)                               → Pendiente (neutral)
 * Forward-compatible: si la columna `status` aún no existe en la DB, todo cae a
 * Pendiente/Completada (binario por `done`) sin romperse. El % de avance es
 * SIEMPRE completadas/total (en-proceso y no-la-hice NO son avance).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { font, fontDisp } from "../../design-system/tokens";
import { useAuth } from "../../hooks/useAuth";
import { readAllRows } from "../../lib/read-all-rows.js";
import { resolveDateRange, toTimestamp } from "./CRM/date-range.js";
import { productivityRows } from "./CRM/productivity-metrics.js";

const fmtDate = (iso) => {
  const timestamp = toTimestamp(iso);
  if (timestamp === null) return "";
  const options = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  return new Date(timestamp).toLocaleString("es-MX", options);
};

export default function ProductividadTab({ T, isLight, dateFilter = null }) {
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const isDemo = !!user?.isDemo;
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const requestId = useRef(0);
  const range = useMemo(() => dateFilter ? resolveDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo) : null, [dateFilter]);
  const rows = useMemo(() => productivityRows(actions, range), [actions, range]);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    if (!orgId || isDemo) {
      setActions([]); setError(null); setLoading(false); return;
    }
    setLoading(true);
    const result = await readAllRows(() => supabase.from("team_actions").select("*")
      .eq("organization_id", orgId).order("due_at", { ascending: true }).order("id"));
    if (request !== requestId.current) return;
    setError(result.error?.message || null);
    if (!result.error) setActions(result.data);
    setLoading(false);
  }, [orgId, isDemo]);
  useEffect(() => {
    // Reset the previous organization before the next external data subscription.
    setActions([]);
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    let channel;
    if (orgId && !isDemo) {
      channel = supabase.channel("command-productivity-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "team_actions", filter: "organization_id=eq." + orgId }, refresh).subscribe();
    }
    return () => {
      // This is a request generation token, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++requestId.current;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh, orgId, isDemo]);

  const toggle = (asesor) =>
    setOpen(prev => { const n = new Set(prev); n.has(asesor) ? n.delete(asesor) : n.add(asesor); return n; });

  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  // Mapa de presentación por estado. Colores desde el theme (sin hardcodear).
  const STATE_META = {
    done:        { label: "Completada", color: T.accent },
    in_progress: { label: "En proceso", color: T.amber },
    not_done:    { label: "No la hice", color: T.rose },
    pending:     { label: "Pendiente",  color: T.txt3 },
  };

  // Resumen textual de la fila (pendientes · completadas [· en proceso] [· sin hacer]).
  const summary = (r) => {
    const parts = [`${r.pend - r.inProg - r.notDone} pendientes sin respuesta`, `${r.done} completadas`];
    if (r.inProg)  parts.push(`${r.inProg} en proceso`);
    if (r.notDone) parts.push(`${r.notDone} sin hacer`);
    return parts.join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
          Indicadores · Productividad
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
          Acciones por fecha programada (o creación si no tienen fecha). El avance es completadas / total del rango. Tocá una fila para ver el detalle.
        </p>
      </div>

      <button onClick={refresh} disabled={loading} style={{ alignSelf: "flex-start" }}>Recargar productividad</button>
      {error && <p role="alert" style={{ color: T.txt2 }}>No se pudo cargar la productividad: {error}. Usa Recargar para reintentar.</p>}
      {loading && (
        <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>Cargando…</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>
          No hay acciones de equipo en este rango.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            const isOpen = open.has(r.asesor);
            const pendItems = r.items.filter(i => i.state !== "done");
            const doneItems = r.items.filter(i => i.state === "done");
            return (
              <div key={r.asesor} style={{
                borderRadius: 14, background: headerBg, border: `1px solid ${rowBorder}`, overflow: "hidden",
              }}>
                {/* Cabecera (clickable para expandir) */}
                <div
                  onClick={() => toggle(r.asesor)}
                  role="button"
                  aria-expanded={isOpen}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.asesor); } }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
                >
                  <ChevronRight
                    size={16}
                    style={{ color: T.txt3, flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "none" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.asesor}</div>
                    <div style={{ fontSize: 12, color: T.txt3, fontFamily: font, marginTop: 2 }}>{summary(r)}</div>
                    <div style={{ height: 6, borderRadius: 6, background: rowBorder, marginTop: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: T.accent }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: fontDisp, color: pct >= 70 ? T.accent : T.txt, letterSpacing: "-0.03em" }}>{pct}%</div>
                    <div style={{ fontSize: 11.5, color: T.txt3, fontFamily: font }}>avance</div>
                  </div>
                </div>

                {/* Detalle desplegable */}
                {isOpen && (
                  <div style={{ padding: "4px 18px 16px 18px", borderTop: `1px solid ${rowBorder}` }}>
                    {pendItems.length > 0 && (
                      <ActionGroup title={`Pendientes (${pendItems.length})`} items={pendItems} STATE_META={STATE_META} T={T} rowBorder={rowBorder} />
                    )}
                    {doneItems.length > 0 && (
                      <ActionGroup title={`Completadas (${doneItems.length})`} items={doneItems} STATE_META={STATE_META} T={T} rowBorder={rowBorder} />
                    )}
                    {r.items.length === 0 && (
                      <p style={{ fontSize: 12.5, color: T.txt3, fontFamily: font, margin: "10px 0 0" }}>Sin acciones.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Lista de acciones de un grupo (Pendientes o Completadas) dentro del desplegable.
function ActionGroup({ title, items, STATE_META, T, rowBorder }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: T.txt3, fontFamily: font, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((it, idx) => {
          const meta = STATE_META[it.state] || STATE_META.pending;
          const when = it.state === "done" ? it.completed_at : it.due_at;
          const whenLabel = it.state === "done" ? "Completada" : "Para";
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: idx === items.length - 1 ? "none" : `1px solid ${rowBorder}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.txt, fontFamily: font, lineHeight: 1.35, textDecoration: it.state === "done" ? "line-through" : "none", opacity: it.state === "done" ? 0.7 : 1 }}>
                  {it.text}
                </div>
                <div style={{ fontSize: 12, color: T.txt3, fontFamily: font, marginTop: 2 }}>
                  {fmtDate(when) ? `${whenLabel} ${fmtDate(when)}` : ""}
                </div>
                {it.nota && (
                  <div style={{ fontSize: 12, color: T.txt2, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>
                    📝 {it.nota}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: meta.color, fontFamily: font, flexShrink: 0, marginTop: 2 }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
