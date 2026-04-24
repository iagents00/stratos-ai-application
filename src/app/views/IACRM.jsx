import {
  Atom, Phone, TrendingUp, CheckCircle2, Zap, Clock, User,
  Shield, Timer, Users, Crown, Send, MapPin, CalendarDays
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

/* Professional Atom Logo for IA CRM */
const CRMAtomLogo = ({ size = 40, color = P.accent }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <ellipse cx="24" cy="24" rx="18" ry="7" stroke={color} strokeWidth="1" opacity="0.3" transform="rotate(0 24 24)" />
    <ellipse cx="24" cy="24" rx="18" ry="7" stroke={color} strokeWidth="1" opacity="0.3" transform="rotate(60 24 24)" />
    <ellipse cx="24" cy="24" rx="18" ry="7" stroke={color} strokeWidth="1" opacity="0.3" transform="rotate(120 24 24)" />
    <circle cx="24" cy="24" r="4" fill={color} opacity="0.8" />
    <circle cx="24" cy="24" r="2" fill="#FFFFFF" />
    <circle cx="42" cy="24" r="2.5" fill={color} opacity="0.6"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" /></circle>
    <circle cx="15" cy="9.4" r="2.5" fill={color} opacity="0.6"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" /></circle>
    <circle cx="15" cy="38.6" r="2.5" fill={color} opacity="0.6"><animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" /></circle>
  </svg>
);

const aiAgents = [
  { id: 1, name: "Agente Reactivación", type: "Reactivación", status: "Activo", calls: 89, success: 34, queue: 12, technique: "Take Away", c: P.rose },
  { id: 2, name: "Agente Seguimiento", type: "Follow-up", status: "Activo", calls: 156, success: 68, queue: 8, technique: "Urgencia", c: P.blue },
  { id: 3, name: "Agente Confirmación", type: "Confirmación", status: "Activo", calls: 203, success: 187, queue: 3, technique: "Recordatorio", c: P.emerald },
  { id: 4, name: "Agente Cierre", type: "Cierre", status: "Activo", calls: 47, success: 19, queue: 5, technique: "Exclusividad", c: P.violet },
  { id: 5, name: "Agente Nurturing", type: "Educación", status: "En Pausa", calls: 124, success: 52, queue: 0, technique: "Valor", c: P.amber },
];

const coldClients = [
  { id: 1, name: "Ricardo Fuentes", event: "Zoom", daysInactive: 5, lastContact: "28 Mar", value: "$1.8M", project: "Gobernador 28", technique: "Take Away", msg: "Esta oportunidad tiene fecha límite. Solo quedan 2 unidades en su rango.", priority: "Alta", c: P.rose },
  { id: 2, name: "Ana María López", event: "Zoom", daysInactive: 3, lastContact: "30 Mar", value: "$2.4M", project: "Portofino", technique: "Prueba Social", msg: "5 familias adquirieron esta semana. La demanda está en máximos.", priority: "Alta", c: P.amber },
  { id: 3, name: "David Chen", event: "Sun (Visita)", daysInactive: 7, lastContact: "26 Mar", value: "$3.2M", project: "Monarca 28", technique: "Exclusividad", msg: "Acceso VIP: precios de pre-lanzamiento disponibles solo 48h más.", priority: "Media", c: P.violet },
  { id: 4, name: "Patricia Reyes", event: "Zoom", daysInactive: 10, lastContact: "23 Mar", value: "$1.5M", project: "Gobernador 28", technique: "Take Away", msg: "La unidad que le interesó ya tiene otro comprador interesado.", priority: "Crítica", c: P.rose },
  { id: 5, name: "Michael Brown", event: "Sun (Visita)", daysInactive: 4, lastContact: "29 Mar", value: "$4.1M", project: "Portofino", technique: "Urgencia", msg: "El precio aumentará 5% la próxima semana. Asegure su inversión ahora.", priority: "Alta", c: P.blue },
  { id: 6, name: "Laura Martínez", event: "Zoom", daysInactive: 14, lastContact: "19 Mar", value: "$900K", project: "Monarca 28", technique: "Valor", msg: "Nuevo análisis: su inversión generaría $180K anuales en rentas.", priority: "Crítica", c: P.emerald },
];

const reactivationTechniques = [
  { name: "Take Away", desc: "Crear sensación de pérdida. El cliente siente que puede perder la oportunidad.", success: 42, icon: Shield, c: P.rose, example: "\"La unidad que le interesó ya tiene otro comprador...\"" },
  { name: "Urgencia", desc: "Deadlines reales: aumento de precio, cierre de etapa, últimas unidades.", success: 38, icon: Timer, c: P.amber, example: "\"El precio sube 5% el lunes. Asegure su inversión hoy.\"" },
  { name: "Prueba Social", desc: "Mostrar actividad de otros compradores para generar confianza.", success: 35, icon: Users, c: P.blue, example: "\"5 familias compraron esta semana en el mismo desarrollo.\"" },
  { name: "Exclusividad", desc: "Acceso VIP, condiciones especiales solo para clientes selectos.", success: 31, icon: Crown, c: P.violet, example: "\"Condiciones pre-lanzamiento disponibles solo 48h más.\"" },
];

const automatedCampaigns = [
  { name: "Post-Zoom 48h", status: "Activa", sent: 34, opened: 28, replied: 12, conversion: "35%", c: P.emerald },
  { name: "Reactivación 7 días", status: "Activa", sent: 18, opened: 14, replied: 6, conversion: "33%", c: P.blue },
  { name: "Take Away 14 días", status: "Activa", sent: 22, opened: 15, replied: 8, conversion: "36%", c: P.rose },
  { name: "Nurturing Mensual", status: "Programada", sent: 0, opened: 0, replied: 0, conversion: "—", c: P.amber },
];

const callCenterData = [
  { h: "8am", v: 12 }, { h: "9am", v: 28 }, { h: "10am", v: 45 },
  { h: "11am", v: 52 }, { h: "12pm", v: 38 }, { h: "1pm", v: 22 },
  { h: "2pm", v: 41 }, { h: "3pm", v: 56 }, { h: "4pm", v: 48 },
  { h: "5pm", v: 35 }, { h: "6pm", v: 18 },
];

const priorityC = { Alta: P.amber, Media: P.blue, Crítica: P.rose };

const IACRM = ({ oc }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {/* Header con logo */}
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 0" }}>
      <CRMAtomLogo size={44} color={P.accent} />
      <div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Call Center IA</p>
        <p style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>Automatización · Reactivación · Agentes Inteligentes</p>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Pill color={P.emerald}><div style={{ width: 6, height: 6, borderRadius: "50%", background: P.emerald, animation: "pulse 2s infinite" }} /> Sistema Activo</Pill>
        <Pill color={P.blue}>5 Agentes IA</Pill>
      </div>
    </div>

    {/* KPIs */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Agentes IA Activos" value="5" sub="4 en línea" icon={Atom} color={P.violet} />
      <KPI label="Llamadas Hoy" value="619" sub="+22%" icon={Phone} color={P.blue} />
      <KPI label="Tasa de Reactivación" value="34.2%" sub="+8.1pp" icon={TrendingUp} color={P.emerald} />
      <KPI label="Clientes Recuperados" value="28" sub="esta semana" icon={CheckCircle2} />
    </div>

    {/* Agentes IA + Volumen de llamadas */}
    <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 14 }}>
      <G np>
        <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Agentes de Inteligencia Artificial</p>
          <Pill color={P.accent} s>Automatizados</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.6fr 0.5fr 0.5fr 0.6fr", gap: 8, padding: "8px 18px", borderBottom: `1px solid ${P.border}`, fontSize: 10, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          <span>Agente</span><span>Tipo</span><span>Llamadas</span><span>Éxito</span><span>Cola</span><span>Estado</span>
        </div>
        {aiAgents.map(a => (
          <div key={a.id} onClick={() => oc(`Reporte del ${a.name}: métricas, rendimiento y optimización`)} style={{
            display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.6fr 0.5fr 0.5fr 0.6fr",
            gap: 8, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${P.border}`,
            fontSize: 12, cursor: "pointer", transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ico icon={Atom} sz={30} is={14} c={a.c} />
              <span style={{ color: P.txt, fontWeight: 500, fontFamily: font }}>{a.name}</span>
            </div>
            <Pill color={a.c} s>{a.type}</Pill>
            <span style={{ color: "#FFFFFF", fontWeight: 500, fontFamily: fontDisp }}>{a.calls}</span>
            <span style={{ color: P.emerald, fontWeight: 600, fontFamily: fontDisp }}>{a.success}</span>
            <span style={{ color: a.queue > 5 ? P.amber : P.txt3, fontWeight: 500, fontFamily: fontDisp }}>{a.queue}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.status === "Activo" ? P.emerald : P.amber, boxShadow: `0 0 6px ${a.status === "Activo" ? P.emerald : P.amber}50` }} />
              <span style={{ fontSize: 11, color: a.status === "Activo" ? P.emerald : P.amber, fontWeight: 500 }}>{a.status}</span>
            </div>
          </div>
        ))}
      </G>
      <G>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 12 }}>Volumen de Llamadas (Hoy)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={callCenterData}>
            <XAxis dataKey="h" tick={{ fill: P.txt3, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: P.txt3, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, color: P.txt, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} name="Llamadas">
              {callCenterData.map((_, i) => <Cell key={i} fill={P.accent} opacity={0.6 + (callCenterData[i].v / 56) * 0.4} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </G>
    </div>

    {/* Clientes para reactivar */}
    <G np>
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Clientes para Reactivar</p>
          <Pill color={P.rose} s><Zap size={9} /> {coldClients.length} pendientes</Pill>
        </div>
        <button onClick={() => oc("Ejecutar campaña de reactivación masiva con IA")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: P.rx, background: P.accentS, border: `1px solid ${P.accentB}`, fontSize: 11, color: P.accent, cursor: "pointer", fontFamily: font }}><Zap size={12} />Reactivar Todos</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.5fr 0.6fr 0.7fr 0.5fr 0.7fr", gap: 8, padding: "8px 18px", borderBottom: `1px solid ${P.border}`, fontSize: 10, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        <span>Cliente</span><span>Evento</span><span>Inactivo</span><span>Proyecto</span><span>Técnica</span><span>Prioridad</span><span>Acción</span>
      </div>
      {coldClients.map(cl => (
        <div key={cl.id} style={{
          display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.5fr 0.6fr 0.7fr 0.5fr 0.7fr",
          gap: 8, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${P.border}`, fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Ico icon={User} sz={30} is={13} c={cl.daysInactive > 7 ? P.rose : P.blue} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: P.txt, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.name}</p>
              <p style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>{cl.value}</p>
            </div>
          </div>
          <Pill color={cl.event.includes("Sun") ? P.emerald : P.blue} s>{cl.event}</Pill>
          <span style={{ color: cl.daysInactive > 7 ? P.rose : cl.daysInactive > 4 ? P.amber : P.txt2, fontWeight: 600, fontFamily: fontDisp }}>{cl.daysInactive}d</span>
          <span style={{ color: P.txt3, fontSize: 11, fontFamily: font }}>{cl.project}</span>
          <Pill color={cl.c} s>{cl.technique}</Pill>
          <Pill color={priorityC[cl.priority]} s>{cl.priority}</Pill>
          <button onClick={() => oc(`Reactivar a ${cl.name} con técnica ${cl.technique}: "${cl.msg}"`)} style={{
            padding: "6px 10px", borderRadius: P.rx, border: `1px solid ${P.accentB}`,
            background: P.accentS, fontSize: 10, color: P.accent, cursor: "pointer",
            fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center", gap: 4,
          }}><Send size={10} />Enviar</button>
        </div>
      ))}
    </G>

    {/* Técnicas + Campañas */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <G>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14 }}>Técnicas de Reactivación</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reactivationTechniques.map(t => (
            <div key={t.name} onClick={() => oc(`Ejecutar técnica "${t.name}" en todos los clientes inactivos`)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: P.rs,
              background: `${t.c}08`, border: `1px solid ${t.c}14`, cursor: "pointer", transition: "all 0.2s",
            }}>
              <Ico icon={t.icon} sz={36} is={16} c={t.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{t.name}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.c, fontFamily: fontDisp }}>{t.success}%</span>
                </div>
                <p style={{ fontSize: 10.5, color: P.txt2, lineHeight: 1.4, fontFamily: font }}>{t.desc}</p>
                <p style={{ fontSize: 10, color: P.txt3, marginTop: 4, fontStyle: "italic", fontFamily: font }}>{t.example}</p>
              </div>
            </div>
          ))}
        </div>
      </G>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <G>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14 }}>Campañas Automatizadas</p>
          {automatedCampaigns.map(cp => (
            <div key={cp.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${P.border}` }}>
              <Ico icon={cp.status === "Activa" ? Zap : Clock} sz={30} is={14} c={cp.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: P.txt, fontFamily: font }}>{cp.name}</p>
                  <Pill color={cp.status === "Activa" ? P.emerald : P.amber} s>{cp.status}</Pill>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: P.txt3 }}>
                  <span>Enviados: <b style={{ color: P.txt2 }}>{cp.sent}</b></span>
                  <span>Abiertos: <b style={{ color: P.txt2 }}>{cp.opened}</b></span>
                  <span>Respondidos: <b style={{ color: P.txt2 }}>{cp.replied}</b></span>
                  <span>Conversión: <b style={{ color: P.emerald }}>{cp.conversion}</b></span>
                </div>
              </div>
            </div>
          ))}
        </G>
        <G>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 10 }}>Recordatorios Activos</p>
          {[
            { t: "Zoom: Ricardo Fuentes", time: "Hoy 3:00 PM", status: "Pendiente", c: P.blue, i: CalendarDays },
            { t: "Follow-up: Ana María López", time: "Hoy 5:30 PM", status: "Programado", c: P.amber, i: Phone },
            { t: "Reactivar: Patricia Reyes", time: "Mañana 10:00 AM", status: "Automático", c: P.rose, i: Zap },
            { t: "Sun Visit: Michael Brown", time: "Mañana 2:00 PM", status: "Confirmado", c: P.emerald, i: MapPin },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < 3 ? `1px solid ${P.border}` : "none" }}>
              <Ico icon={r.i} sz={30} is={14} c={r.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: P.txt, fontFamily: font }}>{r.t}</p>
                <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginTop: 1 }}>{r.time}</p>
              </div>
              <Pill color={r.c} s>{r.status}</Pill>
            </div>
          ))}
        </G>
      </div>
    </div>
  </div>
);

export default IACRM;
