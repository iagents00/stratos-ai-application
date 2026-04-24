import { User, Gauge, Timer, Trophy, Flame, Crosshair, Lightbulb } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Ico } from "../SharedComponents";

const team = [
  { n: "Oscar Gálvez",      r: "CEO Ejecutivo",           d: 28, rv: "$24.8M", e: 98, sk: 12, role: "CEO",       c: P.violet,  wa: "+52 998 000 0001", cal: "" },
  { n: "Emmanuel Ortiz",    r: "Director de Ventas",      d: 14, rv: "$12.4M", e: 94, sk: 9,  role: "Directivo", c: P.blue,    wa: "+52 998 000 0002", cal: "" },
  { n: "Alexia Santillán",  r: "Directora Administrativa",d: 14, rv: "$11.2M", e: 91, sk: 8,  role: "Directiva", c: P.emerald, wa: "+52 998 000 0003", cal: "" },
  { n: "Alex Velázquez",    r: "Director de Marketing",   d: 12, rv: "$9.8M",  e: 89, sk: 7,  role: "Directivo", c: P.amber,   wa: "+52 998 000 0004", cal: "" },
  { n: "Ken Lugo Ríos",     r: "Asesor Senior",           d: 11, rv: "$8.7M",  e: 88, sk: 6,  role: "Directivo", c: P.cyan,    wa: "+52 998 000 0005", cal: "" },
  { n: "Araceli Oneto",     r: "Asesora Especialista",    d: 10, rv: "$7.5M",  e: 85, sk: 5,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0006", cal: "" },
  { n: "Cecilia Mendoza",   r: "Asesora Premium",         d: 10, rv: "$7.2M",  e: 83, sk: 4,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0007", cal: "" },
  { n: "Estefanía Valdes",  r: "Asesora Premium",         d: 9,  rv: "$6.8M",  e: 82, sk: 4,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0008", cal: "" },
];

const Team = ({ T: _T }) => {
  const isLight = !!_T && _T !== P;
  const T = _T || P;
  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Eficiencia Operativa" value="87.5%" sub="+5.2%" icon={Gauge} color={T.emerald} T={T} />
      <KPI label="Horas de Concentración" value="24.6h" icon={Timer} color={T.violet} T={T} />
      <KPI label="Ventas Cerradas (Trim.)" value="42" sub="+18%" icon={Trophy} T={T} />
      <KPI label="Ventas Consecutivas" value="8" icon={Flame} color={T.rose} T={T} />
    </div>
    <G np T={T}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, fontFamily: font }}>Rendimiento del Equipo</p>
      </div>
      {/* Header row */}
      <div style={{
        display: "grid", gridTemplateColumns: "220px 60px 80px 100px 90px 50px",
        gap: 12, alignItems: "center", padding: "8px 20px", borderBottom: `1px solid ${T.border}`,
        fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600,
      }}>
        <span>Asesor</span><span>Deals</span><span>Revenue</span><span>Eficiencia</span><span>Tendencia</span><span style={{ textAlign: "right" }}>Racha</span>
      </div>
      {team.map((m, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "220px 60px 80px 100px 90px 50px",
          gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Ico icon={User} sz={36} is={15} c={T.accent} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.n}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginTop: 2 }}>{m.r}</p>
            </div>
          </div>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 14, fontFamily: fontDisp }}>{m.d}</span>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 13, fontFamily: fontDisp }}>{m.rv}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: T.border }}>
              <div style={{ width: `${m.e}%`, height: 4, borderRadius: 2, background: m.e > 85 ? T.emerald : m.e > 70 ? T.blue : T.rose, boxShadow: `0 0 8px ${m.e > 85 ? T.emerald : m.e > 70 ? T.blue : T.rose}40` }} />
            </div>
            <span style={{ fontSize: 11, color: m.e > 85 ? T.emerald : m.e > 70 ? T.blue : T.rose, fontWeight: 600, fontFamily: fontDisp }}>{m.e}%</span>
          </div>
          <div style={{ height: 28 }}>
            <ResponsiveContainer width="100%" height={28}>
              <AreaChart data={[{ v: 2 }, { v: 5 }, { v: 3 }, { v: 7 }, { v: 5 }, { v: 8 }]}>
                <Area type="monotone" dataKey="v" stroke={T.accent} strokeWidth={1.2} fill={`${T.accent}14`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <Flame size={14} color={m.sk >= 7 ? T.accent : T.txt3} />
            <span style={{ color: T.txt, fontWeight: 600, fontSize: 15, fontFamily: fontDisp }}>{m.sk}</span>
          </div>
        </div>
      ))}
    </G>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <G T={T}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, marginBottom: 12, fontFamily: font }}>Metodología</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { t: "Concentración 4h/día", d: "Bloques sin interrupciones", i: Timer, c: T.violet },
            { t: "Principio 80/20", d: "IA asigna leads de impacto", i: Crosshair, c: T.accent },
            { t: "Coaching Inteligente", d: "Feedback post-llamada", i: Lightbulb, c: T.amber },
            { t: "Sprints Semanales", d: "OKRs en metas medibles", i: Flame, c: T.rose },
          ].map(m => (
            <div key={m.t} style={{ display: "flex", gap: 10, padding: 12, borderRadius: T.rs, background: `${m.c}06`, border: `1px solid ${m.c}10` }}>
              <Ico icon={m.i} sz={32} is={15} c={m.c} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: T.txt, fontFamily: font }}>{m.t}</p>
                <p style={{ fontSize: 10.5, color: T.txt3, marginTop: 1, fontFamily: font }}>{m.d}</p>
              </div>
            </div>
          ))}
        </div>
      </G>
      <G T={T}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 12 }}>Revenue por asesor</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={team} layout="vertical">
            <XAxis type="number" tick={{ fill: T.txt3, fontSize: 10, fontFamily: fontDisp }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="n" tick={{ fill: T.txt2, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} width={95} />
            <Bar dataKey="d" fill={T.accent} radius={[0, 4, 4, 0]} barSize={14} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
      </G>
    </div>
  </div>
  );
};

export default Team;
