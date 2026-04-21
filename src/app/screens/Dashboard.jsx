import { useState } from "react";
import { DollarSign, Target, TrendingUp, Atom, Crosshair, Waypoints, Radar, CalendarDays, Trophy, Mic2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, Pill, Ico, KPI } from "../../design-system/primitives";
import { revenue, pipe } from "../data/dashboard";
import { leads, stgC } from "../data/leads";
import { examples } from "../data/chat";
import Team from "./Team";

const AgentIcons = {
  gerente: Crosshair,
  asistente: Waypoints,
  analista: Radar,
};

const Dash = ({ oc, co }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Ingresos Acumulados" value="$35.9M" sub="+28%" icon={DollarSign} />
      <KPI label="Proyección Comercial" value="70" sub="+12 mes" icon={Target} color={P.blue} />
      <KPI label="Tasa de Conversión" value="18.4%" sub="+3.2pp" icon={TrendingUp} color={P.emerald} />
      <KPI label="Agentes IA" value="47" sub="12 auto" icon={Atom} color={P.violet} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: co ? "1fr" : "3fr 1.3fr", gap: 14 }}>
      <G>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Ingresos vs Objetivo</p>
          <Pill color={P.emerald} s>+28% target</Pill>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={revenue}>
            <XAxis dataKey="m" tick={{ fill: P.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: P.txt3, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 10]} />
            <Tooltip contentStyle={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, color: P.txt, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
            <Area type="monotone" dataKey="v" stroke={P.accent} strokeWidth={2.5} fill={`${P.accent}14`} dot={{ r: 3, fill: P.accent, stroke: P.bg, strokeWidth: 2 }} name="$M" />
          </AreaChart>
        </ResponsiveContainer>
      </G>
      <G>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 8 }}>Proyección por Etapas</p>
        {pipe.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: P.txt2, width: 74 }}>{d.name}</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: P.glass }}>
              <div style={{ height: 6, borderRadius: 3, width: `${(d.val / 70) * 100}%`, background: d.c, transition: "width 0.8s ease", boxShadow: `0 0 8px ${d.c}30` }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: d.c, width: 24, textAlign: "right" }}>{d.val}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: P.rx, background: P.accentS, border: `1px solid ${P.accentB}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: P.txt2 }}>Total</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: P.accent, fontFamily: "'Outfit'" }}>70</span>
        </div>
      </G>
    </div>

    {/* Quick actions */}
    <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
      {[
        { l: "Nota de voz", i: Mic2, c: P.accent, q: examples[0].t },
        { l: "Mis prioridades", i: Crosshair, c: P.amber, q: examples[1].t },
        { l: "Agendar tarea", i: CalendarDays, c: P.blue, q: examples[2].t },
        { l: "Reporte equipo", i: Trophy, c: P.violet, q: examples[3].t },
      ].map(a => (
        <button key={a.l} onClick={() => oc(a.q)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          borderRadius: P.rs, border: `1px solid ${a.c}18`,
          background: `${a.c}08`, cursor: "pointer", color: P.txt2,
          fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.25s",
        }}><Ico icon={a.i} sz={30} is={14} c={a.c} />{a.l}</button>
      ))}
    </div>

    {/* Priority leads — new registrations + zoom scheduled */}
    <G np>
      <div style={{ padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent, boxShadow: `0 0 8px ${P.accent}` }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Atención Inmediata</p>
          <Pill color={P.accent} s>Nuevos · Zoom agendado</Pill>
        </div>
        <button onClick={() => {}} style={{ fontSize: 11, color: P.txt3, background: "none", border: "none", cursor: "pointer", fontFamily: font }}>Ver todos →</button>
      </div>
      {leads.filter(l => l.isNew || l.st === "Zoom Agendado").sort((a,b) => b.sc - a.sc).slice(0, 4).map(l => (
        <div key={l.id} onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`)} style={{
          display: "grid", gridTemplateColumns: "2fr 0.55fr 0.9fr 0.7fr 1.4fr",
          alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${P.border}`,
          gap: 8, cursor: "pointer", transition: "background 0.18s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${l.hot ? P.accent : P.blue}12`, border: `1px solid ${l.hot ? P.accent : P.blue}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: l.hot ? P.accent : P.blue, flexShrink: 0, fontFamily: fontDisp }}>{l.n.charAt(0)}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{l.n}</span>
                {l.isNew && <span style={{ fontSize: 8, fontWeight: 800, color: P.accent, background: `${P.accent}14`, padding: "1px 5px", borderRadius: 99, letterSpacing: "0.06em" }}>NEW</span>}
              </div>
              <p style={{ fontSize: 9, color: P.txt3, marginTop: 1 }}>{l.tag}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 24, height: 3, borderRadius: 2, background: P.border }}>
              <div style={{ width: `${l.sc}%`, height: 3, borderRadius: 2, background: l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.amber }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.amber, fontFamily: fontDisp }}>{l.sc}</span>
          </div>
          <Pill color={stgC[l.st]} s>{l.st}</Pill>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{l.budget}</span>
          <div style={{ padding: "5px 8px", borderRadius: 7, background: `${P.accent}07`, border: `1px solid ${P.accentB}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: P.accent, letterSpacing: "0.04em", marginBottom: 2 }}>{l.nextActionDate?.toUpperCase()}</p>
            <p style={{ fontSize: 10, color: P.txt2, lineHeight: 1.35 }}>{l.nextAction?.substring(0, 45)}{l.nextAction?.length > 45 ? "…" : ""}</p>
          </div>
        </div>
      ))}
    </G>

    {/* Agent status strip */}
    <div style={{ display: "grid", gridTemplateColumns: co ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
      {[
        { n: "Estrategia", r: "Pipeline 80/20 · Alertas", i: AgentIcons.gerente, c: P.amber, s: "342 acciones" },
        { n: "Coordinación", r: "Voz→CRM · Tareas", i: AgentIcons.asistente, c: P.blue, s: "1,248 acciones" },
        { n: "Análisis", r: "ROI · Scoring · Proyecciones", i: AgentIcons.analista, c: P.emerald, s: "186 acciones" },
      ].map(a => (
        <G key={a.n} hover>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Ico icon={a.i} sz={32} is={15} c={a.c} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: P.txt }}>{a.n}</p>
              <p style={{ fontSize: 10, color: P.txt3 }}>{a.r}</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: P.txt3 }}>{a.s}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: P.emerald, boxShadow: `0 0 6px ${P.emerald}50` }} />
              <span style={{ fontSize: 10, color: P.emerald, fontWeight: 600 }}>Activo</span>
            </div>
          </div>
        </G>
      ))}
    </div>

    {/* Team */}
    <Team />
  </div>
);

export default Dash;
