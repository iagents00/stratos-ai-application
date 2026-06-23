/**
 * app/views/ProductividadTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 3ª pestaña del Comando Directivo: "Indicadores · Productividad".
 * Muestra, por asesor, las acciones de su Lista de Acción (tabla team_actions):
 * cuántas pendientes / completadas y el % de avance. RLS de Supabase ya filtra
 * por la organización del usuario logueado.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { font, fontDisp } from "../../design-system/tokens";

export default function ProductividadTab({ T, isLight }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("team_actions").select("asesor_name, done, due_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn("[Stratos] productividad load:", error.message); setRows([]); return; }
        const byAsesor = {};
        (data || []).forEach(a => {
          const k = (a.asesor_name && a.asesor_name.trim()) || "Sin asignar";
          byAsesor[k] = byAsesor[k] || { asesor: k, pend: 0, done: 0 };
          if (a.done) byAsesor[k].done += 1; else byAsesor[k].pend += 1;
        });
        const arr = Object.values(byAsesor).sort((x, y) => (y.pend + y.done) - (x.pend + x.done));
        setRows(arr);
      });
    return () => { cancelled = true; };
  }, []);

  const headerBg  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.025em" }}>
          Indicadores · Productividad
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.txt3, fontFamily: font }}>
          Lista de Acción por asesor · pendientes, completadas y % de avance. El coach de Telegram da seguimiento a estas acciones.
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
            const total = r.pend + r.done;
            const pct = total ? Math.round((r.done / total) * 100) : 0;
            return (
              <div key={r.asesor} style={{
                display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
                borderRadius: 14, background: headerBg, border: `1px solid ${rowBorder}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>{r.asesor}</div>
                  <div style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, marginTop: 2 }}>
                    {r.pend} pendientes · {r.done} completadas
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: rowBorder, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: T.accent, transition: "width 0.3s" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fontDisp, color: pct >= 70 ? T.accent : T.txt, letterSpacing: "-0.03em" }}>{pct}%</div>
                  <div style={{ fontSize: 10.5, color: T.txt3, fontFamily: font }}>avance</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
