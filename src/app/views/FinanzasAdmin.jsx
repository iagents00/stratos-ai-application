/**
 * views/FinanzasAdmin.jsx — Finanzas & Administración (DATOS REALES, sin SAT)
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo financiero de la organización sobre la MISMA tabla que la Caja
 * (`team_expenses`): ingresos y egresos que el equipo registra desde la web o
 * que entran por Telegram (texto/audio/ticket). Todo lo que ves acá es real y
 * en vivo, filtrado por `organization_id` (RLS + filtro explícito, defensa en
 * profundidad, igual que el resto del CRM).
 *
 * Tres pestañas:
 *   · Resumen  — KPIs del mes (ingresos/egresos/balance) + saldo acumulado,
 *                gráfica de los últimos 12 meses, últimos movimientos y egresos
 *                por categoría.
 *   · Caja     — libro de movimientos (registrar ingreso/egreso). Es el mismo
 *                componente `Caja`, ahora como pestaña.
 *   · Flujo    — flujo de caja mensual del año en curso (ingresos/egresos/saldo)
 *                con utilidad y margen.
 *
 * NOTA (2026-07): la versión anterior mostraba datos de demo estilo SAT México
 * (CFDI 4.0, RFC, obligaciones fiscales, CxC/CxP) que NO estaban conectados a
 * nada. Se quitaron para no confundir datos reales con datos falsos. La
 * facturación CFDI / integración SAT oficial es un proyecto aparte (requiere
 * PAC + timbrado); cuando se haga, vuelve como pestaña real.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Landmark, Download, RefreshCw, BarChart3, Banknote, TrendingUp, TrendingDown,
  Scale, Wallet, PiggyBank, Percent, Plus, Inbox,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Caja from "./Caja";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// $ genérico con abreviación de millones (la moneda real se muestra aparte).
const money = (n) => {
  const v = Number(n || 0);
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  const body = a >= 1_000_000 ? `${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a.toLocaleString("es-MX");
  return `${sign}$${body}`;
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return "—"; }
};

// Escapa un valor para una celda CSV.
const csvCell = (s) => {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const FinanzasAdmin = ({ T: _T }) => {
  const T = _T || P;
  const { user } = useAuth();
  const isLight = T?.bg !== P.bg;
  const orgId = user?.organizationId;

  const [tab, setTab] = useState("panel");
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState({});   // profile id → nombre
  const [obras, setObras] = useState({});     // lead id → nombre (obra)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const POS = T.emerald || "#34D399";  // ingreso
  const NEG = T.rose || "#F87171";     // egreso
  const ACC = T.accent || "#6EE7C2";   // balance / saldo

  // ─── Carga de datos reales (mismo origen que la Caja) ───
  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [mov, profs, leads] = await Promise.all([
        supabase.from("team_expenses")
          .select("id, tipo, amount, currency, account, category, description, spent_at, created_by, project_id, source")
          .eq("organization_id", orgId)
          .order("spent_at", { ascending: false })
          .limit(1000),
        supabase.from("profiles").select("id, name").eq("organization_id", orgId),
        supabase.from("leads").select("id, name").eq("organization_id", orgId).is("deleted_at", null).limit(400),
      ]);
      if (mov.error) throw mov.error;
      setRows(mov.data || []);
      setPeople(Object.fromEntries((profs.data || []).map(p => [p.id, p.name])));
      setObras(Object.fromEntries((leads.data || []).map(l => [l.id, l.name])));
    } catch {
      setError("No pude cargar los movimientos. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Moneda dominante del dataset (para mostrar el código junto a los totales).
  const currency = useMemo(() => {
    const c = {};
    rows.forEach(r => { const k = r.currency || ""; if (k) c[k] = (c[k] || 0) + 1; });
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  }, [rows]);

  // KPIs del mes en curso.
  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let ing = 0, egr = 0, count = 0;
    rows.forEach(r => {
      if (new Date(r.spent_at).getTime() < first) return;
      count++;
      const a = Number(r.amount || 0);
      if (r.tipo === "ingreso") ing += a; else egr += a;
    });
    return { ing, egr, bal: ing - egr, count };
  }, [rows]);

  // Saldo acumulado (todo el histórico cargado).
  const allTime = useMemo(() => {
    let ing = 0, egr = 0;
    rows.forEach(r => { const a = Number(r.amount || 0); if (r.tipo === "ingreso") ing += a; else egr += a; });
    return { ing, egr, bal: ing - egr };
  }, [rows]);

  // Serie de los últimos 12 meses.
  const series = useMemo(() => {
    const now = new Date();
    const buckets = [];
    const idx = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      idx[key] = buckets.length;
      buckets.push({ mes: MES[d.getMonth()], key, ingresos: 0, egresos: 0, saldo: 0 });
    }
    rows.forEach(r => {
      const d = new Date(r.spent_at);
      const b = buckets[idx[`${d.getFullYear()}-${d.getMonth()}`]];
      if (!b) return;
      const a = Number(r.amount || 0);
      if (r.tipo === "ingreso") b.ingresos += a; else b.egresos += a;
    });
    buckets.forEach(b => { b.saldo = b.ingresos - b.egresos; });
    return buckets;
  }, [rows]);

  // Agregado del año en curso (para la pestaña Flujo).
  const year = useMemo(() => {
    const y = new Date().getFullYear();
    let ing = 0, egr = 0;
    rows.forEach(r => {
      if (new Date(r.spent_at).getFullYear() !== y) return;
      const a = Number(r.amount || 0);
      if (r.tipo === "ingreso") ing += a; else egr += a;
    });
    const util = ing - egr;
    return { ing, egr, util, margen: ing > 0 ? (util / ing * 100) : 0 };
  }, [rows]);

  // Egresos por categoría del mes en curso (top 6).
  const catBreakdown = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const map = {};
    rows.forEach(r => {
      if ((r.tipo || "egreso") !== "egreso") return;
      if (new Date(r.spent_at).getTime() < first) return;
      const k = r.category || "Sin categoría";
      map[k] = (map[k] || 0) + Number(r.amount || 0);
    });
    const list = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = list.reduce((s, [, v]) => s + v, 0);
    return { list, total };
  }, [rows]);

  const latest = useMemo(() => rows.slice(0, 6), [rows]);

  // ─── Exportar movimientos a CSV (real) ───
  const exportCSV = useCallback(() => {
    if (!rows.length) return;
    const header = ["fecha", "tipo", "monto", "moneda", "cuenta", "categoria", "obra", "descripcion", "origen"];
    const lines = rows.map(r => [
      (r.spent_at || "").slice(0, 10), r.tipo || "", r.amount ?? "", r.currency || "",
      csvCell(r.account), csvCell(r.category), csvCell(obras[r.project_id]),
      csvCell(r.description), r.source || "",
    ].join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [rows, obras]);

  const curSuffix = currency ? ` ${currency}` : "";

  const tabs = [
    { id: "panel", label: "Resumen", icon: BarChart3 },
    { id: "caja", label: "Caja", icon: Banknote },
    { id: "flujo", label: "Flujo de Caja", icon: TrendingUp },
  ];

  const tipoColor = (t) => (t === "ingreso" ? POS : NEG);

  const emptyRows = !loading && rows.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Ico icon={Landmark} sz={42} is={20} c={ACC} />
          <div>
            <p style={{ fontSize: 22, fontWeight: 300, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
              Finanzas <span style={{ fontWeight: 400, color: ACC }}>&amp;</span> Administración
            </p>
            <p style={{ fontSize: 11, color: T.txt3, marginTop: 2, letterSpacing: "0.01em" }}>
              Ingresos, egresos y flujo de caja · datos en vivo{curSuffix ? ` · ${currency}` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} title="Actualizar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontWeight: 400, fontFamily: fontDisp }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> Actualizar
          </button>
          <button onClick={exportCSV} disabled={!rows.length} title={rows.length ? "Descargar movimientos en CSV" : "Sin movimientos para exportar"}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.glass, cursor: rows.length ? "pointer" : "not-allowed", opacity: rows.length ? 1 : 0.5, color: T.txt2, fontSize: 12, fontWeight: 400, fontFamily: fontDisp }}>
            <Download size={13} /> Exportar CSV
          </button>
          <button onClick={() => setTab("caja")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: isLight ? ACC : "rgba(255,255,255,0.95)", cursor: "pointer", color: isLight ? "#FFF" : "#0A0F18", fontSize: 12, fontWeight: 500, fontFamily: fontDisp, boxShadow: isLight ? `0 4px 18px ${ACC}44` : "0 4px 18px rgba(255,255,255,0.12)" }}>
            <Plus size={14} /> Nuevo movimiento
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${NEG}40`, background: `${NEG}10`, color: NEG, fontSize: 12.5 }}>{error}</div>
      )}

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: 4, padding: "4px", borderRadius: 12, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer",
              background: active ? (isLight ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)") : "transparent",
              color: active ? T.txt : T.txt3, fontSize: 12, fontWeight: active ? 700 : 400,
              fontFamily: fontDisp, transition: "all 0.2s",
              boxShadow: active ? (isLight ? "0 1px 6px rgba(15,23,42,0.08)" : "0 1px 8px rgba(0,0,0,0.3)") : "none",
            }}>
              <t.icon size={13} color={active ? ACC : T.txt3} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════ RESUMEN ═══════════════════════════════ */}
      {tab === "panel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs reales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <KPI T={T} label="Ingresos del mes" value={money(month.ing)} sub={curSuffix ? currency : "este mes"} icon={TrendingUp} color={POS} />
            <KPI T={T} label="Egresos del mes" value={money(month.egr)} sub={curSuffix ? currency : "este mes"} icon={TrendingDown} color={NEG} />
            <KPI T={T} label="Balance del mes" value={money(month.bal)} sub={`${month.count} movimiento${month.count === 1 ? "" : "s"}`} icon={Scale} color={month.bal >= 0 ? POS : NEG} />
            <KPI T={T} label="Saldo acumulado" value={money(allTime.bal)} sub="todo el histórico" icon={Wallet} color={ACC} />
          </div>

          {/* Gráfica + últimos movimientos */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
            <G T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Ingresos vs Egresos</p>
                  <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Últimos 12 meses</p>
                </div>
                <Pill color={POS} s isLight={isLight}>en vivo</Pill>
              </div>
              <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={100}>
                <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="faIng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={POS} stopOpacity={0.25} /><stop offset="95%" stopColor={POS} stopOpacity={0} /></linearGradient>
                    <linearGradient id="faEgr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={NEG} stopOpacity={0.2} /><stop offset="95%" stopColor={NEG} stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.txt3 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: T.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => money(v)} width={52} />
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`${money(v)}${curSuffix}`, ""]} labelStyle={{ color: T.txt2 }} />
                  <Area type="monotone" dataKey="ingresos" stroke={POS} strokeWidth={2} fill="url(#faIng)" name="Ingresos" />
                  <Area type="monotone" dataKey="egresos" stroke={NEG} strokeWidth={2} fill="url(#faEgr)" name="Egresos" />
                </AreaChart>
              </ResponsiveContainer>
            </G>
            <G T={T} np>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Últimos movimientos</p>
                <button onClick={() => setTab("caja")} style={{ fontSize: 11, color: ACC, background: "none", border: "none", cursor: "pointer" }}>Ver todo →</button>
              </div>
              {loading && <div style={{ padding: "24px 18px", color: T.txt3, fontSize: 12, textAlign: "center" }}>Cargando…</div>}
              {emptyRows && (
                <div style={{ padding: "28px 18px", color: T.txt3, fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
                  <Inbox size={22} color={T.txt3} style={{ marginBottom: 8, opacity: 0.7 }} />
                  <div>Sin movimientos todavía.</div>
                  <div style={{ marginTop: 2 }}>Registrá el primero en la pestaña <strong style={{ color: T.txt2 }}>Caja</strong>.</div>
                </div>
              )}
              {latest.map(r => {
                const c = tipoColor(r.tipo);
                const obra = obras[r.project_id];
                return (
                  <div key={r.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: c, background: `${c}15`, padding: "2px 7px", borderRadius: 4 }}>{r.tipo === "ingreso" ? "Ingreso" : "Egreso"}</span>
                        <span style={{ fontSize: 10, color: T.txt3 }}>{fmtDate(r.spent_at)}</span>
                      </div>
                      <p style={{ fontSize: 12, color: T.txt, fontWeight: 400, fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>
                        {r.category || (r.tipo === "ingreso" ? "Ingreso" : "Gasto")}{obra ? ` · ${obra}` : ""}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: c, fontFamily: fontDisp, flexShrink: 0 }}>{r.tipo === "ingreso" ? "+" : "−"}{money(r.amount)}</p>
                  </div>
                );
              })}
            </G>
          </div>

          {/* Egresos por categoría (mes) */}
          <G T={T}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Ico icon={TrendingDown} sz={32} is={14} c={NEG} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Egresos por categoría</p>
                  <p style={{ fontSize: 11, color: T.txt3 }}>Mes en curso{curSuffix ? ` · ${currency}` : ""}</p>
                </div>
              </div>
            </div>
            {catBreakdown.list.length === 0 ? (
              <div style={{ padding: "18px 4px", color: T.txt3, fontSize: 12 }}>Sin egresos este mes.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {catBreakdown.list.map(([cat, val]) => {
                  const pct = catBreakdown.total > 0 ? (val / catBreakdown.total * 100) : 0;
                  return (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: T.txt2, fontFamily: fontDisp, width: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{cat}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.border, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: NEG, opacity: 0.85 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: T.txt, fontFamily: fontDisp, width: 90, textAlign: "right", flexShrink: 0 }}>{money(val)}</span>
                      <span style={{ fontSize: 10, color: T.txt3, width: 38, textAlign: "right", flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </G>
        </div>
      )}

      {/* ═══════════════════════════════ CAJA (movimientos) ═══════════════════════════════ */}
      {tab === "caja" && <Caja T={T} />}

      {/* ═══════════════════════════════ FLUJO DE CAJA ═══════════════════════════════ */}
      {tab === "flujo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <KPI T={T} label={`Ingresos ${new Date().getFullYear()}`} value={money(year.ing)} sub="año en curso" icon={TrendingUp} color={POS} />
            <KPI T={T} label={`Egresos ${new Date().getFullYear()}`} value={money(year.egr)} sub="año en curso" icon={TrendingDown} color={NEG} />
            <KPI T={T} label="Utilidad neta" value={money(year.util)} sub="ingresos − egresos" icon={PiggyBank} color={year.util >= 0 ? ACC : NEG} />
            <KPI T={T} label="Margen" value={`${year.margen.toFixed(1)}%`} sub="utilidad / ingresos" icon={Percent} color={T.blue || "#7EB8F0"} />
          </div>

          <G T={T}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Flujo de caja mensual</p>
                <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Últimos 12 meses{curSuffix ? ` · ${currency}` : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[{ c: POS, l: "Ingresos" }, { c: NEG, l: "Egresos" }, { c: ACC, l: "Saldo" }].map(l => (
                  <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: l.c }} />
                    <span style={{ fontSize: 11, color: T.txt3 }}>{l.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
              <BarChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: 0 }} barGap={3}>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.txt3 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: T.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => money(v)} width={52} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`${money(v)}${curSuffix}`, ""]} labelStyle={{ color: T.txt2 }} cursor={{ fill: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="ingresos" fill={POS} radius={[4, 4, 0, 0]} name="Ingresos" opacity={0.85} />
                <Bar dataKey="egresos" fill={NEG} radius={[4, 4, 0, 0]} name="Egresos" opacity={0.85} />
                <Bar dataKey="saldo" fill={ACC} radius={[4, 4, 0, 0]} name="Saldo" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </G>

          {/* Detalle por mes */}
          <G T={T} np>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>Detalle mensual</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "9px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
              <span>Mes</span><span>Ingresos</span><span>Egresos</span><span>Saldo</span><span>Margen</span>
            </div>
            {series.map(d => {
              const margen = d.ingresos > 0 ? (d.saldo / d.ingresos * 100) : 0;
              const mpct = Math.max(0, Math.min(100, margen));
              return (
                <div key={d.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.txt, fontWeight: 400, fontFamily: fontDisp }}>{d.mes}</span>
                  <span style={{ fontSize: 12, fontWeight: 400, color: POS, fontFamily: fontDisp }}>{money(d.ingresos)}</span>
                  <span style={{ fontSize: 12, fontWeight: 400, color: NEG, fontFamily: fontDisp }}>{money(d.egresos)}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: d.saldo >= 0 ? ACC : NEG, fontFamily: fontDisp }}>{money(d.saldo)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                      <div style={{ width: `${mpct}%`, height: "100%", background: ACC, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: T.txt3, fontWeight: 400, fontFamily: fontDisp, width: 40, textAlign: "right" }}>{margen.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </G>
        </div>
      )}

    </div>
  );
};

export default FinanzasAdmin;
