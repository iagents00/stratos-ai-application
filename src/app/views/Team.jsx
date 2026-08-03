/**
 * app/views/Team.jsx — vista "Asesores"
 * ─────────────────────────────────────────────────────────────────────────────
 * Equipo REAL de la organización con métricas REALES.
 *
 * Antes esta vista era un array de 6 personas escrito a mano, con deals,
 * revenue, eficiencia y rachas inventados. Eso significaba que un asesor nuevo
 * jamás aparecía aquí, y que seguía saliendo gente que ya no trabaja en Duke.
 *
 * Ahora las filas salen de `profiles` (vía useTeam) unidas con quien tenga
 * leads, y cada número se calcula de leadsData con los mismos criterios que el
 * Dashboard: Zooms = "Zoom Agendado" + "Seguimiento", Cierres = "Cierre".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo } from "react";
import { User, Users, Target, TrendingUp, Trophy, Timer, Crosshair, Lightbulb, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Ico } from "../SharedComponents";
import { useIsMobile } from "../../hooks/useViewport";
import { useTeam, SALES_ROLES } from "../../hooks/useTeam";

const ROLE_LABEL = {
  super_admin: "Dirección",
  admin:       "Administración",
  ceo:         "CEO",
  director:    "Director",
  asesor:      "Asesor",
  marketing:   "Marketing",
  colaborador: "Colaborador",
};

/** $1.2M / $840k / $0 — compacto, para que la columna no se desborde. */
const money = (n) => {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
};

const COLS = "220px 70px 70px 70px 110px 100px";

const Team = ({ T: _T, leadsData = [] }) => {
  const T = _T || P;
  // Móvil: 4 KPIs en fila cortaban los números ("87…"); 2×2 respira.
  const isMobile = useIsMobile();
  const { team, loading } = useTeam();

  // Filas = asesores del equipo (perfiles) ∪ cualquiera que ya tenga leads.
  // La unión importa: en Duke hay leads a nombre de super_admins, y filtrar
  // solo por rol `asesor` los desaparecería de la tabla.
  const rows = useMemo(() => {
    const conLeads = new Set(leadsData.map(l => l.asesor).filter(Boolean));
    const porNombre = new Map();

    team.forEach(p => {
      if (SALES_ROLES.includes(p.role) || conLeads.has(p.name)) {
        porNombre.set(p.name, { name: p.name, role: p.role });
      }
    });
    // Si la query de perfiles no respondió (offline/demo), al menos mostramos a
    // quien tiene leads en vez de dejar la vista en blanco.
    conLeads.forEach(n => { if (!porNombre.has(n)) porNombre.set(n, { name: n, role: null }); });

    return [...porNombre.values()].map(p => {
      const suyos    = leadsData.filter(l => l.asesor === p.name);
      const zooms    = suyos.filter(l => l.st === "Zoom Agendado" || l.st === "Seguimiento").length;
      const cierres  = suyos.filter(l => l.st === "Cierre").length;
      const pipeline = suyos.reduce((s, l) => s + (l.presupuesto || 0), 0);
      return {
        ...p,
        total: suyos.length,
        zooms,
        cierres,
        pipeline,
        conv: suyos.length ? Math.round((cierres / suyos.length) * 100) : 0,
      };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  }, [team, leadsData]);

  const totLeads   = rows.reduce((s, r) => s + r.total, 0);
  const totCierres = rows.reduce((s, r) => s + r.cierres, 0);
  const totZooms   = rows.reduce((s, r) => s + r.zooms, 0);
  const convGlobal = totLeads ? ((totCierres / totLeads) * 100).toFixed(1) : "0.0";

  const chartData = rows.slice(0, 8).map(r => ({
    n: r.name.split(" ").slice(0, 2).join(" "),
    total: r.total,
  }));

  return (
  <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
      <KPI label="Asesores Activos"   value={rows.length}      sub="en la organización"     icon={Users}      color={T.violet}  T={T} />
      <KPI label="Leads del Equipo"   value={totLeads}         sub={`${totZooms} con Zoom`} icon={Target}                       T={T} />
      <KPI label="Cierres"            value={totCierres}       sub="acumulados"             icon={Trophy}     color={T.amber}   T={T} />
      <KPI label="Tasa de Conversión" value={`${convGlobal}%`} sub="cierres / leads"        icon={TrendingUp} color={T.emerald} T={T} />
    </div>
    <G np T={T}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, fontFamily: font }}>Rendimiento del Equipo</p>
        <span style={{ fontSize: 11.5, color: T.txt3, fontFamily: font }}>
          {loading ? "Cargando equipo…" : `${rows.length} personas · datos en vivo del CRM`}
        </span>
      </div>
      {/* La tabla mide ~640px de columnas fijas: en móvil scrollea horizontal
          DENTRO de la tarjeta (encabezado y filas juntos) en vez de cortarse. */}
      <div style={{ overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
      <div style={{ minWidth: isMobile ? 700 : 0 }}>
      {/* Header row */}
      <div style={{
        display: "grid", gridTemplateColumns: COLS,
        gap: 12, alignItems: "center", padding: "8px 20px", borderBottom: `1px solid ${T.border}`,
        fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 400,
      }}>
        <span>Asesor</span><span>Leads</span><span>Zooms</span><span>Cierres</span><span>Conversión</span>
        <span style={{ textAlign: "right" }}>Pipeline</span>
      </div>

      {rows.length === 0 && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>
            {loading ? "Cargando equipo…" : "Todavía no hay asesores registrados en esta organización."}
          </p>
        </div>
      )}

      {rows.map(m => (
        <div key={m.name} style={{
          display: "grid", gridTemplateColumns: COLS,
          gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 12.5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Ico icon={User} sz={36} is={15} c={T.accent} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 400, color: T.txt, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
              <p style={{ fontSize: 11, color: T.txt3, fontFamily: font, marginTop: 2 }}>
                {ROLE_LABEL[m.role] || (m.total === 0 ? "Sin leads asignados" : "Asesor")}
              </p>
            </div>
          </div>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 14, fontFamily: fontDisp }}>{m.total}</span>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 14, fontFamily: fontDisp }}>{m.zooms}</span>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 14, fontFamily: fontDisp }}>{m.cierres}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: T.border, flexShrink: 0 }}>
              <div style={{ width: `${Math.min(m.conv, 100)}%`, height: 4, borderRadius: 2, background: m.conv >= 15 ? T.emerald : m.conv >= 5 ? T.blue : T.txt3 }} />
            </div>
            <span style={{ fontSize: 12, color: m.conv >= 15 ? T.emerald : m.conv >= 5 ? T.blue : T.txt3, fontWeight: 400, fontFamily: fontDisp }}>{m.conv}%</span>
          </div>
          <span style={{ color: T.txt, fontWeight: 500, fontSize: 13, fontFamily: fontDisp, textAlign: "right" }}>{money(m.pipeline)}</span>
        </div>
      ))}
      </div>
      </div>
    </G>
    {/* Móvil: Metodología y Leads por asesor apilados (lado a lado truncaba los nombres) */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
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
                <p style={{ fontSize: 12.5, fontWeight: 500, color: T.txt, fontFamily: font }}>{m.t}</p>
                <p style={{ fontSize: 11.5, color: T.txt3, marginTop: 1, fontFamily: font }}>{m.d}</p>
              </div>
            </div>
          ))}
        </div>
      </G>
      <G T={T}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.txt, marginBottom: 12 }}>Leads por asesor</p>
        <ResponsiveContainer width="100%" height={190} minWidth={100} minHeight={100}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" tick={{ fill: T.txt3, fontSize: 11, fontFamily: fontDisp }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="n" tick={{ fill: T.txt2, fontSize: 11, fontFamily: font }} axisLine={false} tickLine={false} width={95} />
            <Bar dataKey="total" fill={T.accent} radius={[0, 4, 4, 0]} barSize={14} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
      </G>
    </div>
  </div>
  );
};

export default Team;
