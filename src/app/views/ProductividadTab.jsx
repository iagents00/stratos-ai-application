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
import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { font, fontDisp } from "../../design-system/tokens";
import { isHiddenAdvisor } from "./CRM/zoom-metrics";

// Deriva el estado mostrable de una acción a partir de los campos de la DB.
// `done` manda (es la fuente de verdad del avance); `status` solo afina los no-hechos.
const deriveState = (a) => {
  if (a.done) return "done";
  if (a.status === "in_progress") return "in_progress";
  if (a.status === "not_done") return "not_done";
  return "pending";
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function ProductividadTab({ T, isLight }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(() => new Set());   // asesores expandidos

  useEffect(() => {
    let cancelled = false;
    // select('*') → traemos también `status` y `nota` SI existen (forward-compatible).
    supabase.from("team_actions").select("*").order("due_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn("[Stratos] productividad load:", error.message); setRows([]); return; }
        const byAsesor = {};
        (data || []).forEach(a => {
          // Cuentas de prueba/sistema fuera — mismo criterio que el resto del Comando.
          if (isHiddenAdvisor(a.asesor_name)) return;
          const k = (a.asesor_name && a.asesor_name.trim()) || "Sin asignar";
          byAsesor[k] = byAsesor[k] || { asesor: k, items: [] };
          byAsesor[k].items.push({
            id: a.id,
            text: a.text || "(sin descripción)",
            state: deriveState(a),
            due_at: a.due_at,
            completed_at: a.completed_at,
            nota: a.nota || "",
          });
        });
        const arr = Object.values(byAsesor).map(g => {
          const done = g.items.filter(i => i.state === "done").length;
          const inProg = g.items.filter(i => i.state === "in_progress").length;
          const notDone = g.items.filter(i => i.state === "not_done").length;
          const pend = g.items.length - done;   // todo lo no-hecho cuenta como pendiente
          return { ...g, done, inProg, notDone, pend, total: g.items.length };
        }).sort((x, y) => y.total - x.total);
        setRows(arr);
      });
    return () => { cancelled = true; };
  }, []);

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
    const parts = [`${r.pend} pendientes`, `${r.done} completadas`];
    if (r.inProg)  parts.push(`${r.inProg} en proceso`);
    if (r.notDone) parts.push(`${r.notDone} sin hacer`);
    return parts.join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
          Indicadores · Productividad
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
          Lista de Acción por asesor · tocá una fila para ver el detalle. El coach de Telegram da seguimiento a estas acciones.
        </p>
      </div>

      {rows === null && (
        <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>Cargando…</p>
      )}
      {rows !== null && rows.length === 0 && (
        <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>
          Aún no hay acciones de equipo. Agregá acciones desde la Lista de Acción (botón de la meta).
        </p>
      )}

      {rows !== null && rows.length > 0 && (
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
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.asesor); } }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", userSelect: "none" }}
                >
                  <ChevronRight
                    size={16}
                    style={{ color: T.txt3, flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "none" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>{r.asesor}</div>
                    <div style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, marginTop: 2 }}>{summary(r)}</div>
                    <div style={{ height: 6, borderRadius: 6, background: rowBorder, marginTop: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: T.accent, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: pct >= 70 ? T.accent : T.txt, letterSpacing: "-0.03em" }}>{pct}%</div>
                    <div style={{ fontSize: 10.5, color: T.txt3, fontFamily: font }}>avance</div>
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
                      <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, margin: "10px 0 0" }}>Sin acciones.</p>
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
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.txt3, fontFamily: font, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map(it => {
          const meta = STATE_META[it.state] || STATE_META.pending;
          const when = it.state === "done" ? it.completed_at : it.due_at;
          const whenLabel = it.state === "done" ? "Completada" : "Para";
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${rowBorder}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.txt, fontFamily: font, lineHeight: 1.35, textDecoration: it.state === "done" ? "line-through" : "none", opacity: it.state === "done" ? 0.7 : 1 }}>
                  {it.text}
                </div>
                <div style={{ fontSize: 11, color: T.txt3, fontFamily: font, marginTop: 2 }}>
                  {fmtDate(when) ? `${whenLabel} ${fmtDate(when)}` : ""}
                </div>
                {it.nota && (
                  <div style={{ fontSize: 11.5, color: T.txt2, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>
                    📝 {it.nota}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, fontFamily: font, flexShrink: 0, marginTop: 2 }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
