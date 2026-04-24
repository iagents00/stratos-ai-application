import { useState } from "react";
import {
  Target, CalendarDays, TrendingUp, Atom,
  Mic2, Crosshair, Trophy,
  Radar, Waypoints
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";
import Team from "./Team";

const stgC = {
  "Nuevo Registro":     "#94A3B8",
  "Primer Contacto":    "#38BDF8",
  "Seguimiento":        "#22D3EE",
  "Zoom Agendado":      "#60A5FA",
  "Zoom Concretado":    "#4ADE80",
  "Visita Agendada":    "#F59E0B",
  "Visita Concretada":  "#6EE7C2",
  "Negociación":        "#FB923C",
  "Cierre":             "#34D399",
  "Perdido":            "#F87171",
};

const AgentIcons = {
  gerente:   Crosshair,
  asistente: Waypoints,
  analista:  Radar,
};

const examples = [
  { t: "Acabo de visitar Gobernador con la Fam. Rodríguez, les encantó el penthouse", i: Mic2, cat: "Actualizar CRM" },
  { t: "¿Cuáles son mis leads prioritarios hoy?", i: Target, cat: "Análisis 80/20" },
  { t: "Agenda llamada con James Mitchell mañana 10am", i: CalendarDays, cat: "Crear tarea" },
  { t: "Resumen de rendimiento del equipo esta semana", i: Trophy, cat: "Reporte" },
];

const Dash = ({ oc, co, leadsData = [], T: _T }) => {
  const isLight = !!_T && _T !== P;
  const T = _T || P;
  const [dashPeriod, setDashPeriod] = useState("semana");
  const total    = leadsData.length || 1;
  const cierres  = leadsData.filter(l => l.st === "Cierre").length;
  const zooms    = leadsData.filter(l => l.st === "Zoom Agendado" || l.st === "Zoom Concretado").length;
  const activos  = leadsData.filter(l => l.st !== "Perdido" && l.st !== "Cierre").length;
  const tasaConv = ((cierres / total) * 100).toFixed(1);
  const actionStages = ["Primer Contacto","Seguimiento","Zoom Agendado","Zoom Concretado","Visita Agendada","Negociación","Cierre"];
  const actionData   = actionStages.map(st => ({
    label: st.length > 10 ? st.substring(0, 10) + "…" : st,
    fullName: st, val: leadsData.filter(l => l.st === st).length, color: stgC[st] || P.txt3,
  })).filter(d => d.val > 0);
  const totalAcciones = actionData.reduce((s, d) => s + d.val, 0);
  const asesorList  = [...new Set(leadsData.map(l => l.asesor).filter(Boolean))];
  const asesorStats = asesorList.map(a => {
    const al = leadsData.filter(l => l.asesor === a);
    return { name: a, total: al.length, zooms: al.filter(l => l.st === "Zoom Agendado" || l.st === "Zoom Concretado").length, cierres: al.filter(l => l.st === "Cierre").length, avgSc: al.length ? Math.round(al.reduce((s, l) => s + l.sc, 0) / al.length) : 0 };
  }).sort((a, b) => b.total - a.total);
  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Pipeline Activo"     value={activos}         sub={`de ${leadsData.length} leads`} icon={Target} T={T} />
      <KPI label="Zooms Totales"       value={zooms}           sub="agendados + concretados"         icon={CalendarDays} color={T.blue}    T={T} />
      <KPI label="Tasa de Conversión"  value={`${tasaConv}%`}  sub={`${cierres} cierres`}            icon={TrendingUp}   color={T.emerald} T={T} />
      <KPI label="Score Promedio"      value={leadsData.length ? Math.round(leadsData.reduce((s,l)=>s+l.sc,0)/leadsData.length) : 0} sub="del equipo" icon={Atom} color={T.violet} T={T} />
    </div>
    {/* Gráfica acciones del equipo + pipeline por etapa */}
    <div style={{ display: "grid", gridTemplateColumns: co ? "1fr" : "3fr 1.3fr", gap: 14 }}>
      <G T={T}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0 }}>Rendimiento del Equipo</p>
            <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, margin: "2px 0 0" }}>Acciones acumuladas · Asesores vs. iAgents</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {["semana","mes"].map(p => (
              <button key={p} onClick={() => setDashPeriod(p)} style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 9.5, fontWeight: 600,
                fontFamily: font, cursor: "pointer", transition: "all 0.15s",
                background: dashPeriod === p ? `${T.accent}18` : "transparent",
                border: `1px solid ${dashPeriod === p ? T.accentB : T.border}`,
                color: dashPeriod === p ? T.accent : T.txt3,
              }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        {/* Legend pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          {[
            { label: "Asesores", color: T.emerald, desc: "Seguimientos · Zooms · Cierres" },
            { label: "iAgents IA", color: T.blue, desc: "Calificaciones · Respuestas automáticas" },
          ].map(lg => (
            <div key={lg.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 24, height: 3, borderRadius: 2, background: lg.color, opacity: 0.85 }} />
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: lg.color, fontFamily: fontDisp }}>{lg.label}</span>
                <span style={{ fontSize: 9, color: T.txt3, fontFamily: font, marginLeft: 5 }}>{lg.desc}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Summary stats */}
        {(() => {
          const teamData = dashPeriod === "semana"
            ? [
                { d: "Lun", asesores: 3,  iagents: 5  },
                { d: "Mar", asesores: 5,  iagents: 7  },
                { d: "Mié", asesores: 2,  iagents: 8  },
                { d: "Jue", asesores: 8,  iagents: 6  },
                { d: "Vie", asesores: 6,  iagents: 9  },
                { d: "Sáb", asesores: 4,  iagents: 8  },
                { d: "Hoy", asesores: 7,  iagents: 11 },
              ]
            : [
                { d: "S-7",  asesores: 12, iagents: 8  },
                { d: "S-6",  asesores: 15, iagents: 14 },
                { d: "S-5",  asesores: 11, iagents: 16 },
                { d: "S-4",  asesores: 18, iagents: 20 },
                { d: "S-3",  asesores: 22, iagents: 18 },
                { d: "S-2",  asesores: 19, iagents: 25 },
                { d: "S-1",  asesores: 24, iagents: 22 },
                { d: "Esta", asesores: 21, iagents: 28 },
              ];
          const totAsesores = teamData.reduce((s, d) => s + d.asesores, 0);
          const totIAgents  = teamData.reduce((s, d) => s + d.iagents,  0);
          const gradId = isLight ? "teamGradLight" : "teamGradDark";
          return (
            <>
              <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.emerald, fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{totAsesores}</span>
                  <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginLeft: 4 }}>acciones asesores</span>
                </div>
                <div style={{ width: 1, background: T.border }} />
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.blue, fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{totIAgents}</span>
                  <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginLeft: 4 }}>acciones iAgents</span>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <Pill color={totIAgents > totAsesores ? T.blue : T.emerald} s isLight={isLight}>
                    {totIAgents > totAsesores ? "iAgents lideran" : "Asesores lideran"} +{Math.abs(totIAgents - totAsesores)}
                  </Pill>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={teamData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`${gradId}_em`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.emerald} stopOpacity={isLight ? 0.18 : 0.22} />
                      <stop offset="95%" stopColor={T.emerald} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`${gradId}_bl`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.blue} stopOpacity={isLight ? 0.15 : 0.20} />
                      <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tick={{ fill: T.txt3, fontSize: 9, fontFamily: font }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: T.txt3, fontSize: 9 }} axisLine={false} tickLine={false} width={22} />
                  <Tooltip
                    contentStyle={{ background: isLight ? "#FFFFFF" : "#111318", border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 11, boxShadow: isLight ? "0 8px 28px rgba(15,23,42,0.14)" : "0 8px 32px rgba(0,0,0,0.4)" }}
                    cursor={{ stroke: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)", strokeWidth: 1 }}
                    formatter={(val, name) => [
                      `${val} acciones`,
                      name === "asesores" ? "Asesores" : "iAgents IA"
                    ]}
                  />
                  <Area type="monotone" dataKey="asesores" stroke={T.emerald} strokeWidth={2} fill={`url(#${gradId}_em)`} dot={false} activeDot={{ r: 4, fill: T.emerald, stroke: isLight ? "#fff" : "#111318", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="iagents"  stroke={T.blue}    strokeWidth={2} fill={`url(#${gradId}_bl)`} dot={false} activeDot={{ r: 4, fill: T.blue,    stroke: isLight ? "#fff" : "#111318", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          );
        })()}
      </G>
      <G T={T}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 10 }}>Pipeline por Etapa</p>
        {actionStages.map(st => {
          const cnt = leadsData.filter(l => l.st === st).length;
          if (cnt === 0) return null;
          const c = stgC[st] || T.txt3;
          const pct = Math.round((cnt / total) * 100);
          return (
            <div key={st} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: T.txt2, flex: 1, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st}</span>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.05)" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: c, opacity: 0.75 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: fontDisp, minWidth: 16, textAlign: "right" }}>{cnt}</span>
            </div>
          );
        })}
        <div style={{ marginTop: 6, padding: "7px 10px", borderRadius: T.rx, background: T.accentS, border: `1px solid ${T.accentB}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10.5, color: T.txt2, fontFamily: font }}>Total activos</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.accent, fontFamily: fontDisp }}>{activos}</span>
        </div>
      </G>
    </div>

    {/* Quick actions */}
    <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
      {[
        { l: "Nota de voz",    i: Mic2,        c: T.accent, q: examples[0].t },
        { l: "Mis prioridades",i: Crosshair,   c: T.amber,  q: examples[1].t },
        { l: "Agendar tarea",  i: CalendarDays,c: T.blue,   q: examples[2].t },
        { l: "Reporte equipo", i: Trophy,      c: T.violet, q: examples[3].t },
      ].map(a => (
        <button key={a.l} onClick={() => oc(a.q)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          borderRadius: T.rs, border: `1px solid ${a.c}${isLight ? "44" : "18"}`,
          background: isLight ? `${a.c}10` : `${a.c}08`,
          cursor: "pointer", color: T.txt2,
          fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.25s",
        }}><Ico icon={a.i} sz={30} is={14} c={a.c} />{a.l}</button>
      ))}
    </div>

    {/* Atención Inmediata — datos reales */}
    <G np T={T}>
      <div style={{ padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, boxShadow: `0 0 8px ${T.accent}`, animation: "pulse 1.8s ease-in-out infinite" }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Atención Inmediata</p>
          <Pill color={T.accent} s isLight={isLight}>Nuevos · Zoom agendado</Pill>
        </div>
        <button onClick={() => oc("Dame un resumen de los clientes que necesitan atención inmediata")} style={{ fontSize: 11, color: T.txt3, background: "none", border: "none", cursor: "pointer", fontFamily: font }}
          onMouseEnter={e => e.currentTarget.style.color = T.txt2}
          onMouseLeave={e => e.currentTarget.style.color = T.txt3}
        >Analizar con IA →</button>
      </div>
      {leadsData.filter(l => l.isNew || l.st === "Zoom Agendado").sort((a,b) => b.sc - a.sc).slice(0, 4).length === 0
        ? <div style={{ padding: "22px 18px", textAlign: "center" }}><p style={{ fontSize: 12, color: T.txt3, fontFamily: font }}>Sin clientes urgentes ✓</p></div>
        : leadsData.filter(l => l.isNew || l.st === "Zoom Agendado").sort((a,b) => b.sc - a.sc).slice(0, 4).map(l => (
          <div key={l.id} onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`)} style={{
            display: "grid", gridTemplateColumns: co ? "2fr 0.7fr 1fr" : "2fr 0.55fr 0.9fr 0.7fr 1.4fr",
            alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${T.border}`,
            gap: 8, cursor: "pointer", transition: "background 0.18s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.025)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${l.hot ? T.accent : T.blue}12`, border: `1px solid ${l.hot ? T.accent : T.blue}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: l.hot ? T.accent : T.blue, flexShrink: 0, fontFamily: fontDisp }}>{l.n.charAt(0)}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{l.n}</span>
                  {l.isNew && <span style={{ fontSize: 8, fontWeight: 800, color: T.accent, background: `${T.accent}14`, padding: "1px 5px", borderRadius: 99, letterSpacing: "0.06em" }}>NEW</span>}
                </div>
                <p style={{ fontSize: 9, color: T.txt3, marginTop: 1, fontFamily: font }}>{l.asesor}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 24, height: 3, borderRadius: 2, background: T.border }}>
                <div style={{ width: `${l.sc}%`, height: 3, borderRadius: 2, background: l.sc >= 80 ? T.emerald : l.sc >= 60 ? T.blue : T.cyan }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: l.sc >= 80 ? T.emerald : l.sc >= 60 ? T.blue : T.cyan, fontFamily: fontDisp }}>{l.sc}</span>
            </div>
            <Pill color={stgC[l.st]} s isLight={isLight}>{l.st}</Pill>
            {!co && <span style={{ fontSize: 13, fontWeight: 600, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{l.budget}</span>}
            {!co && <div style={{ padding: "5px 8px", borderRadius: 7, background: `${T.accent}07`, border: `1px solid ${T.accentB}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: T.accent, letterSpacing: "0.04em", marginBottom: 2, fontFamily: font }}>{l.nextActionDate?.toUpperCase()}</p>
              <p style={{ fontSize: 10, color: T.txt2, lineHeight: 1.35, fontFamily: font }}>{l.nextAction?.substring(0, 45)}{l.nextAction?.length > 45 ? "…" : ""}</p>
            </div>}
          </div>
        ))
      }
    </G>

    {/* Rendimiento del equipo por asesor */}
    {asesorStats.length > 0 && (
      <G T={T}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 12 }}>Rendimiento del Equipo</p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 0 }}>
          {["Asesor","Leads","Zooms","Cierres","Score"].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, letterSpacing: "0.06em", textTransform: "uppercase", paddingBottom: 8 }}>{h}</span>
          ))}
        </div>
        {asesorStats.map((a, i) => {
          const cols = [T.accent, T.blue, T.violet, T.amber, T.cyan, T.emerald];
          const c = cols[i % cols.length];
          return (
            <div key={a.name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 0, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: `${c}14`, border: `1px solid ${c}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: c, fontFamily: fontDisp }}>{a.name.charAt(0)}</div>
                <span style={{ fontSize: 11.5, color: T.txt, fontFamily: font }}>{a.name.split(" ")[0]}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.txt,     fontFamily: fontDisp }}>{a.total}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.blue,    fontFamily: fontDisp }}>{a.zooms}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>{a.cierres}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c,         fontFamily: fontDisp }}>{a.avgSc}</span>
            </div>
          );
        })}
      </G>
    )}

    {/* Agent status strip */}
    <div style={{ display: "grid", gridTemplateColumns: co ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
      {[
        { n: "Estrategia",   r: "Pipeline 80/20 · Alertas",      i: AgentIcons.gerente,   c: T.emerald, s: "342 acciones" },
        { n: "Coordinación", r: "Voz→CRM · Tareas",              i: AgentIcons.asistente, c: T.blue,    s: "1,248 acciones" },
        { n: "Análisis",     r: "ROI · Scoring · Proyecciones",   i: AgentIcons.analista,  c: T.emerald, s: "186 acciones" },
      ].map(a => (
        <G key={a.n} hover T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Ico icon={a.i} sz={32} is={15} c={a.c} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{a.n}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>{a.r}</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>{a.s}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.emerald, boxShadow: `0 0 6px ${T.emerald}50` }} />
              <span style={{ fontSize: 10, color: T.emerald, fontWeight: 600, fontFamily: font }}>Activo</span>
            </div>
          </div>
        </G>
      ))}
    </div>

    <Team T={T} />
  </div>
  );
};


export default Dash;
