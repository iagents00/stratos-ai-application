/**
 * IACRM.jsx — Equipo de Agentes IA · WhatsApp + Telegram
 * ─────────────────────────────────────────────────────────
 * Producto principal: Agentes IA que trabajan 24/7 via WhatsApp Business
 * y Telegram junto a los asesores humanos — Claude como cerebro de cada agente.
 *
 * Flujo: Lead entra → Agente Calificador contacta en <5 min por WhatsApp
 *        → Asesor humano es notificado en Telegram con el briefing
 *        → Agente sigue dando seguimiento cuando el asesor está offline
 *        → El asesor puede tomar el control en cualquier momento
 * ─────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  MessageCircle, Phone, Zap, Clock, Send, User,
  CheckCircle2, AlertCircle, RefreshCw, Target, Timer,
  ChevronDown, ChevronRight, X, Plus, Activity,
  Wifi, WifiOff, Settings, ExternalLink, Copy, Check,
  Bell, Eye, TrendingUp, Users, DollarSign, Cpu,
  ArrowRight, Play, Pause, ToggleLeft, ToggleRight,
  Smartphone, Globe, Shield, Star, Atom
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

/* ─── PALETA LOCAL ─── */
const WA  = "#25D366"; // WhatsApp verde
const TG  = "#229ED9"; // Telegram azul
const ACC = "#6EE7C2"; // Stratos mint

/* ─── DATA DEMO ─── */
const CHANNELS = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: MessageCircle,
    color: WA,
    number: "+52 998 XXX XXXX",
    status: "conectado",
    desc: "Canal principal para contacto con clientes — mensajes personalizados de los agentes",
    messages_today: 47,
    response_rate: "82%",
  },
  {
    id: "telegram",
    name: "Telegram Bot",
    icon: Send,
    color: TG,
    number: "@StratosAI_bot",
    status: "conectado",
    desc: "Notificaciones al equipo — el asesor recibe alertas y briefings en tiempo real",
    messages_today: 23,
    response_rate: "—",
  },
];

const AGENTS = [
  {
    key: "calificador",
    name: "Calificador",
    emoji: "⚡",
    role: "Primer contacto < 5 min",
    model: "claude-haiku-4-5",
    icon: Target,
    color: ACC,
    channel: "whatsapp",
    active: true,
    trigger: "Nuevo lead registrado",
    description: "Contacta por WhatsApp en menos de 5 minutos. Califica BANT, asigna score y prepara el briefing para el asesor en Telegram.",
    queue: 4,
    today: { sent: 12, responded: 9, converted: 3 },
    lastActions: [
      { name: "Carlos Mendoza", time: "hace 8 min", msg: "Hola Carlos, vi tu interés en Torre Esmeralda. Tengo disponibilidad para contarte sobre las últimas unidades esta tarde, ¿te funciona a las 4pm?", status: "respondió", channel: "wa" },
      { name: "Sandra Ruiz",   time: "hace 22 min", msg: "Sandra, gracias por registrarte. Para ayudarte mejor, ¿cuál es tu rango de inversión y en qué plazo estás pensando?", status: "leído", channel: "wa" },
      { name: "Luis Paredes",  time: "hace 1h",     msg: "Luis, encontré 2 opciones perfectas para tu perfil. ¿Tienes 10 minutos hoy para verlas juntos?", status: "respondió", channel: "wa" },
    ],
    teamAlert: "Notifica al asesor en Telegram con briefing completo cuando el lead responde",
  },
  {
    key: "reactivador",
    name: "Reactivador",
    emoji: "🔁",
    role: "Clientes fríos 5+ días",
    model: "claude-sonnet-4-6",
    icon: RefreshCw,
    color: "#F59E0B",
    channel: "whatsapp",
    active: true,
    trigger: "Lead sin contacto ≥ 5 días",
    description: "Detecta leads fríos y envía mensajes de reactivación personalizados — técnica Take Away del Protocolo Duke del Caribe.",
    queue: 6,
    today: { sent: 18, responded: 11, converted: 4 },
    lastActions: [
      { name: "Patricia Reyes", time: "hace 3h",  msg: "Patricia, la unidad que viste en Gobernador tiene otro interesado. Si quieres asegurarla, hoy sería el día.", status: "respondió", channel: "wa" },
      { name: "David Chen",     time: "hace 5h",  msg: "David, el precio de Monarca sube el lunes. ¿Quieres aprovechar el precio actual esta semana?", status: "no leído", channel: "wa" },
      { name: "Laura Martínez", time: "hace 6h",  msg: "Laura, calculé que tu inversión en Gobernador 28 genera $180K anuales en renta. ¿Te comparto el análisis?", status: "respondió", channel: "wa" },
    ],
    teamAlert: "Alerta al asesor cuando el cliente responde después de >7 días inactivo",
  },
  {
    key: "seguimiento",
    name: "Seguimiento",
    emoji: "💬",
    role: "Mantiene relación activa",
    model: "claude-sonnet-4-6",
    icon: MessageCircle,
    color: "#7EB8F0",
    channel: "whatsapp",
    active: true,
    trigger: "Lead activo sin acción en 3 días",
    description: "Envía touchpoints de valor cada 3-4 días — artículos, avances de obra, casos de éxito. Nunca 'solo para dar seguimiento'.",
    queue: 8,
    today: { sent: 11, responded: 7, converted: 2 },
    lastActions: [
      { name: "Tony Nakamura", time: "hace 1h",  msg: "Tony, salió el reporte Q1 de Riviera Maya — plusvalía de 18% en proyectos similares al tuyo. Te lo comparto.", status: "respondió", channel: "wa" },
      { name: "Ana López",     time: "hace 4h",  msg: "Ana, la alberca del piso 12 ya tiene fecha de inauguración. ¿Quieres que te agende una visita de obra?", status: "leído", channel: "wa" },
    ],
    teamAlert: "Briefing diario al asesor cada mañana con el estado de sus leads activos",
  },
  {
    key: "callcenter",
    name: "Briefing Zoom",
    emoji: "📋",
    role: "Prepara cierres y Zooms",
    model: "claude-opus-4-7",
    icon: Phone,
    color: "#A78BFA",
    channel: "telegram",
    active: true,
    trigger: "Zoom o visita agendada",
    description: "30 minutos antes de cada Zoom envía al asesor por Telegram el briefing completo: historial, objeciones, argumentos y próximo paso.",
    queue: 2,
    today: { sent: 6, responded: 5, converted: 2 },
    lastActions: [
      { name: "Fam. Rodríguez", time: "hace 30 min", msg: "📋 BRIEFING ZOOM 4pm\n\n👤 Roberto Rodríguez — inversionista, $4.2M, plazo 60 días\n⚠️ Objeción probable: tasa de retorno\n💡 Argumento: ROI 14% vs 8% bancario\n✅ Próximo paso: reserva simbólica hoy", status: "leído", channel: "tg" },
      { name: "Tony Nakamura",  time: "hace 2h",     msg: "📋 BRIEFING VISITA 6pm\n\n👤 Tony — comprador final, no inversor\n⚠️ Sensible al precio\n💡 Mostrar unit 8B primero (mejor vista)\n✅ Objetivo: firmar carta de intención", status: "leído", channel: "tg" },
    ],
    teamAlert: "Envía briefing 30 min antes. Post-llamada recibe resumen del asesor para actualizar CRM.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: 49,
    desc: "Para asesores individuales",
    color: ACC,
    popular: false,
    agents: 2,
    messages: 500,
    features: [
      "2 agentes activos (Calificador + Seguimiento)",
      "500 mensajes WhatsApp/mes",
      "Notificaciones Telegram",
      "1 número WhatsApp Business",
      "Dashboard de conversaciones",
    ],
  },
  {
    name: "Pro",
    price: 129,
    desc: "Para equipos de hasta 5 asesores",
    color: "#A78BFA",
    popular: true,
    agents: 4,
    messages: 2000,
    features: [
      "4 agentes activos (todos incluidos)",
      "2,000 mensajes WhatsApp/mes",
      "Briefings Zoom por Telegram (Opus)",
      "Hasta 5 asesores",
      "CRM integrado en tiempo real",
      "Reportes semanales automáticos",
    ],
  },
  {
    name: "Business",
    price: 299,
    desc: "Para equipos grandes y franquicias",
    color: "#F59E0B",
    popular: false,
    agents: 4,
    messages: 8000,
    features: [
      "Agentes y mensajes ilimitados",
      "Múltiples números WhatsApp",
      "Agentes personalizados con tu protocolo",
      "Integración API con tu CRM actual",
      "Capacitación del equipo incluida",
      "Account manager dedicado",
    ],
  },
];

const activityData = [
  { h: "8am", wa: 3, tg: 1 }, { h: "9am", wa: 8, tg: 4 },
  { h: "10am", wa: 12, tg: 6 }, { h: "11am", wa: 15, tg: 8 },
  { h: "12pm", wa: 9, tg: 5 }, { h: "2pm", wa: 11, tg: 7 },
  { h: "3pm", wa: 14, tg: 9 }, { h: "4pm", wa: 18, tg: 11 },
  { h: "5pm", wa: 13, tg: 7 }, { h: "6pm", wa: 7, tg: 4 },
];

/* ─── SUBCOMPONENTES ─── */
const ChannelDot = ({ ch, size = 8 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
    <span style={{ width: size, height: size, borderRadius: "50%", background: ch === "wa" ? WA : TG, flexShrink: 0 }} />
    <span style={{ fontSize: 9, fontWeight: 700, color: ch === "wa" ? WA : TG, fontFamily: fontDisp, letterSpacing: "0.05em" }}>
      {ch === "wa" ? "WhatsApp" : "Telegram"}
    </span>
  </span>
);

const StatusDot = ({ s }) => {
  const c = s === "respondió" ? "#4ADE80" : s === "leído" ? "#67E8F9" : "#4A5568";
  const l = s === "respondió" ? "Respondió ✓" : s === "leído" ? "Leído" : "No leído";
  return <span style={{ fontSize: 9, fontWeight: 700, color: c, fontFamily: fontDisp }}>{l}</span>;
};

const AgentToggle = ({ active, onChange }) => (
  <button onClick={onChange} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: active ? "rgba(110,231,194,0.10)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(110,231,194,0.30)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", transition: "all 0.18s" }}>
    <div style={{ width: 28, height: 16, borderRadius: 8, background: active ? ACC : "rgba(255,255,255,0.12)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 2, left: active ? 14 : 2, transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 700, color: active ? ACC : P.txt3, fontFamily: fontDisp }}>{active ? "Activo" : "Pausado"}</span>
  </button>
);

/* ─── VISTA PRINCIPAL ─── */
const IACRM = ({ oc }) => {
  const [tab, setTab]                     = useState("agentes");
  const [expandedAgent, setExpandedAgent] = useState("calificador");
  const [agentStates, setAgentStates]     = useState({ calificador: true, reactivador: true, seguimiento: true, callcenter: true });

  const toggleAgent = (key) => setAgentStates(p => ({ ...p, [key]: !p[key] }));

  const totalSent   = AGENTS.reduce((s, a) => s + a.today.sent, 0);
  const totalResp   = AGENTS.reduce((s, a) => s + a.today.responded, 0);
  const totalConv   = AGENTS.reduce((s, a) => s + a.today.converted, 0);
  const totalQueue  = AGENTS.reduce((s, a) => s + a.queue, 0);

  const TABS = [
    { id: "agentes",  label: "Mis Agentes" },
    { id: "canales",  label: "WhatsApp + Telegram" },
    { id: "planes",   label: "Planes" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── HERO ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em" }}>
              Tu equipo IA en WhatsApp
            </h2>
            <span style={{ fontSize: 9, fontWeight: 800, color: ACC, background: `${ACC}14`, border: `1px solid ${ACC}30`, padding: "3px 9px", borderRadius: 6, letterSpacing: "0.08em", fontFamily: fontDisp }}>IAOS</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: P.txt3, fontFamily: font, lineHeight: 1.6 }}>
            Agentes de IA que trabajan <strong style={{ color: P.txt2 }}>24/7</strong> junto a tus asesores — contactan leads, dan seguimiento y preparan cierres via{" "}
            <strong style={{ color: WA }}>WhatsApp</strong> y <strong style={{ color: TG }}>Telegram</strong>. Powered by Claude.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: `${WA}10`, border: `1px solid ${WA}30` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: WA, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: WA, fontFamily: fontDisp }}>WhatsApp activo</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: `${TG}10`, border: `1px solid ${TG}30` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: TG, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: TG, fontFamily: fontDisp }}>Telegram activo</span>
            </div>
          </div>
          <button onClick={() => oc("¿Qué leads necesitan atención urgente ahora mismo? Dame el resumen del equipo de agentes")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: `${ACC}12`, border: `1px solid ${ACC}30`, color: ACC, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = `${ACC}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${ACC}12`}
          >
            <Atom size={12} strokeWidth={2} /> Estado del equipo IA
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Mensajes hoy" value={totalSent} sub={`${totalQueue} en cola`} icon={MessageCircle} />
        <KPI label="Clientes respondieron" value={totalResp} sub={`${Math.round(totalResp/totalSent*100)}% tasa respuesta`} icon={CheckCircle2} />
        <KPI label="Convertidos hoy" value={totalConv} sub="leads → acción concreta" icon={TrendingUp} />
        <KPI label="Agentes activos" value={Object.values(agentStates).filter(Boolean).length} sub="de 4 disponibles" icon={Zap} />
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 3, padding: "3px", borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "7px 18px", borderRadius: 8, background: active ? "rgba(110,231,194,0.10)" : "transparent", border: active ? "1px solid rgba(110,231,194,0.28)" : "1px solid transparent", color: active ? ACC : P.txt3, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.18s" }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════
          TAB: MIS AGENTES
      ════════════════════════════════════ */}
      {tab === "agentes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Gráfica de actividad hoy */}
          <G>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Actividad de agentes — hoy</p>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: P.txt3, fontFamily: font }}>
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: WA, display: "inline-block" }} /> WhatsApp
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: P.txt3, fontFamily: font }}>
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: TG, display: "inline-block" }} /> Telegram
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={activityData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={WA} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={WA} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TG} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={TG} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: "#E2E8F0", fontSize: 11 }} />
                <Area type="monotone" dataKey="wa" stroke={WA} strokeWidth={2} fill="url(#waGrad)" name="WhatsApp" />
                <Area type="monotone" dataKey="tg" stroke={TG} strokeWidth={2} fill="url(#tgGrad)" name="Telegram" />
              </AreaChart>
            </ResponsiveContainer>
          </G>

          {/* Agentes */}
          {AGENTS.map(agent => {
            const AI = agent.icon;
            const expanded = expandedAgent === agent.key;
            const isActive = agentStates[agent.key];
            const chColor  = agent.channel === "whatsapp" ? WA : TG;
            const chLabel  = agent.channel === "whatsapp" ? "WhatsApp" : "Telegram";

            return (
              <div key={agent.key} style={{ borderRadius: 16, background: "rgba(6,10,17,0.98)", border: `1px solid ${expanded ? agent.color + "44" : "rgba(255,255,255,0.07)"}`, overflow: "hidden", transition: "all 0.22s", boxShadow: expanded ? `0 0 24px ${agent.color}0E` : "none" }}>

                {/* Header del agente */}
                <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedAgent(expanded ? null : agent.key)}>
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: `${agent.color}14`, border: `1px solid ${agent.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {agent.emoji}
                    </div>
                    {/* Canal badge */}
                    <div style={{ position: "absolute", bottom: -3, right: -3, width: 16, height: 16, borderRadius: "50%", background: chColor, border: "2px solid #060A11", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {agent.channel === "whatsapp"
                        ? <MessageCircle size={8} color="#FFF" strokeWidth={2.5} />
                        : <Send size={8} color="#FFF" strokeWidth={2.5} />}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isActive ? "#FFFFFF" : P.txt3, fontFamily: fontDisp }}>{agent.name}</p>
                      <ChannelDot ch={agent.channel === "whatsapp" ? "wa" : "tg"} />
                      {!isActive && <span style={{ fontSize: 8.5, fontWeight: 800, color: P.txt3, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em", fontFamily: fontDisp }}>PAUSADO</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font }}>
                      {agent.role} · <span style={{ color: agent.color, fontWeight: 600 }}>{agent.queue} en cola</span>
                    </p>
                  </div>

                  {/* Métricas rápidas */}
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
                    {[
                      { l: "Enviados", v: agent.today.sent, c: P.txt2 },
                      { l: "Respuestas", v: agent.today.responded, c: "#4ADE80" },
                      { l: "Convertidos", v: agent.today.converted, c: agent.color },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: m.c, fontFamily: fontDisp, lineHeight: 1 }}>{m.v}</p>
                        <p style={{ margin: 0, fontSize: 8.5, color: P.txt3, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <AgentToggle active={isActive} onChange={() => toggleAgent(agent.key)} />
                    <ChevronDown size={14} color={P.txt3} strokeWidth={2} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </div>
                </div>

                {/* Panel expandido */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${agent.color}18` }}>

                    {/* Descripción + trigger */}
                    <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "10px 12px", borderRadius: 10, background: `${agent.color}06`, border: `1px solid ${agent.color}14` }}>
                        <p style={{ margin: "0 0 4px", fontSize: 9.5, fontWeight: 700, color: agent.color, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Descripción</p>
                        <p style={{ margin: 0, fontSize: 11, color: P.txt2, fontFamily: font, lineHeight: 1.55 }}>{agent.description}</p>
                      </div>
                      <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p style={{ margin: "0 0 6px", fontSize: 9.5, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Se activa cuando</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Zap size={12} color={agent.color} strokeWidth={2.5} />
                          <p style={{ margin: 0, fontSize: 11.5, color: "#FFFFFF", fontFamily: fontDisp, fontWeight: 600 }}>{agent.trigger}</p>
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 9.5, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Notifica al asesor</p>
                        <p style={{ margin: "4px 0 0", fontSize: 10.5, color: TG, fontFamily: font }}>{agent.teamAlert}</p>
                      </div>
                    </div>

                    {/* Últimas conversaciones */}
                    <div style={{ padding: "0 16px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Últimas conversaciones</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {agent.lastActions.map((a, i) => (
                          <div key={i} style={{ padding: "10px 12px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 8, background: `${agent.color}14`, border: `1px solid ${agent.color}26`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <User size={12} color={agent.color} strokeWidth={2.2} />
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{a.name}</p>
                                  <ChannelDot ch={a.channel} size={6} />
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 9.5, color: P.txt3, fontFamily: font }}>{a.time}</span>
                                <StatusDot s={a.status} />
                              </div>
                            </div>
                            {/* Burbuja de mensaje */}
                            <div style={{ marginLeft: 33, padding: "8px 11px", borderRadius: "4px 11px 11px 11px", background: `${agent.color}10`, border: `1px solid ${agent.color}1C` }}>
                              <p style={{ margin: 0, fontSize: 11.5, color: P.txt2, fontFamily: font, lineHeight: 1.55, whiteSpace: "pre-line" }}>{a.msg}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTAs */}
                    <div style={{ padding: "0 16px 14px", display: "flex", gap: 8 }}>
                      <button onClick={() => oc(`Ejecutar ${agent.name}: revisa la cola y genera los mensajes para los ${agent.queue} leads pendientes`)} style={{ flex: 1, padding: "9px 14px", borderRadius: 10, background: `linear-gradient(135deg, ${agent.color}24, ${agent.color}0C)`, border: `1px solid ${agent.color}44`, color: agent.color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s" }}
                        onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${agent.color}35, ${agent.color}18)`}
                        onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${agent.color}24, ${agent.color}0C)`}
                      >
                        <Play size={12} strokeWidth={2.5} /> Ejecutar ahora ({agent.queue} en cola)
                      </button>
                      <button onClick={() => oc(`Ver todas las conversaciones del agente ${agent.name} y el historial completo`)} style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: P.txt3, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: fontDisp, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFFFFF"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = P.txt3; }}
                      >
                        <Eye size={12} strokeWidth={2} /> Ver historial
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════
          TAB: CANALES
      ════════════════════════════════════ */}
      {tab === "canales" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Cards de canales */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {CHANNELS.map(ch => {
              const I = ch.icon;
              return (
                <G key={ch.id}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 15, background: `${ch.color}14`, border: `1px solid ${ch.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <I size={20} color={ch.color} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{ch.name}</p>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: ch.color, background: `${ch.color}12`, border: `1px solid ${ch.color}28`, padding: "2px 7px", borderRadius: 5, fontFamily: fontDisp }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.color, animation: "pulse 2s ease-in-out infinite" }} />
                          {ch.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font }}>{ch.number}</p>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 14px", fontSize: 11.5, color: P.txt2, fontFamily: font, lineHeight: 1.55 }}>{ch.desc}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: ch.color, fontFamily: fontDisp }}>{ch.messages_today}</p>
                      <p style={{ margin: 0, fontSize: 9.5, color: P.txt3, fontFamily: font }}>mensajes hoy</p>
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#4ADE80", fontFamily: fontDisp }}>{ch.response_rate}</p>
                      <p style={{ margin: 0, fontSize: 9.5, color: P.txt3, fontFamily: font }}>tasa respuesta</p>
                    </div>
                  </div>
                  <button onClick={() => oc(`Configurar canal ${ch.name}: número, horario de envío y límites diarios`)} style={{ width: "100%", padding: "9px", borderRadius: 10, background: `${ch.color}0C`, border: `1px solid ${ch.color}30`, color: ch.color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${ch.color}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${ch.color}0C`}
                  >
                    <Settings size={12} strokeWidth={2.2} /> Configurar canal
                  </button>
                </G>
              );
            })}
          </div>

          {/* Flujo de trabajo */}
          <G>
            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Cómo trabaja el equipo IA</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { step: "1", color: ACC,    icon: User,           title: "Lead nuevo entra al CRM",                    desc: "Por Facebook Ads, referido, landing page o registro manual del asesor.", channel: null },
                { step: "2", color: ACC,    icon: MessageCircle,  title: "Calificador contacta en < 5 min por WhatsApp", desc: "Primer mensaje personalizado — saludo, calificación BANT inicial, propuesta de Zoom.", channel: "wa" },
                { step: "3", color: TG,     icon: Send,           title: "Asesor recibe briefing en Telegram",           desc: "Al responder el lead, el asesor recibe score, BANT detectado y sugerencia de siguiente paso.", channel: "tg" },
                { step: "4", color: "#F59E0B", icon: Clock,       title: "Seguimiento automático si no hay respuesta",   desc: "Si el lead no responde en 24h, el Reactivador entra con un mensaje de diferente ángulo.", channel: "wa" },
                { step: "5", color: "#A78BFA", icon: Phone,       title: "Briefing de Zoom en Telegram",                 desc: "30 min antes de cada reunión, el asesor recibe el dossier completo del cliente por Telegram.", channel: "tg" },
                { step: "6", color: "#4ADE80", icon: CheckCircle2, title: "Asesor toma el control en cualquier momento", desc: "Con un comando en Telegram, el asesor pausa el agente y toma la conversación directamente.", channel: null },
              ].map((s, i) => {
                const I = s.icon;
                return (
                  <div key={s.step} style={{ display: "flex", gap: 14, paddingBottom: i < 5 ? 16 : 0, borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none", marginBottom: i < 5 ? 16 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 10, background: `${s.color}14`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <I size={14} color={s.color} strokeWidth={2.2} />
                      </div>
                      {i < 5 && <div style={{ width: 1.5, flex: 1, background: `linear-gradient(${s.color}30, transparent)`, marginTop: 6 }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{s.title}</p>
                        {s.channel && <ChannelDot ch={s.channel} />}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font, lineHeight: 1.5 }}>{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </G>

          {/* Horario de envío */}
          <G>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Horario de envío</p>
              <button onClick={() => oc("Configurar el horario de envío de los agentes IA")} style={{ fontSize: 11, fontWeight: 600, color: ACC, background: `${ACC}0C`, border: `1px solid ${ACC}28`, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: fontDisp }}>Editar horario</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {["L","M","X","J","V","S","D"].map((d, i) => (
                <div key={d} style={{ padding: "10px 6px", borderRadius: 9, background: i < 5 ? `${ACC}08` : "rgba(255,255,255,0.03)", border: `1px solid ${i < 5 ? ACC + "22" : "rgba(255,255,255,0.06)"}`, textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: i < 5 ? ACC : P.txt3, fontFamily: fontDisp }}>{d}</p>
                  <p style={{ margin: 0, fontSize: 9, color: i < 5 ? P.txt2 : P.txt3, fontFamily: font }}>{i < 5 ? "9–8pm" : "—"}</p>
                </div>
              ))}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 10.5, color: P.txt3, fontFamily: font }}>Los agentes solo envían mensajes en horario permitido por la <strong style={{ color: P.txt2 }}>API de WhatsApp Business</strong> (no spam, no horarios nocturnos). Lunes a viernes 9am–8pm.</p>
          </G>
        </div>
      )}

      {/* ════════════════════════════════════
          TAB: PLANES
      ════════════════════════════════════ */}
      {tab === "planes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {PRICING.map(plan => (
              <div key={plan.name} style={{ borderRadius: 18, background: plan.popular ? `linear-gradient(160deg, ${plan.color}10 0%, rgba(6,10,17,0.99) 100%)` : "rgba(6,10,17,0.98)", border: `1px solid ${plan.popular ? plan.color + "50" : "rgba(255,255,255,0.08)"}`, padding: "22px", position: "relative", boxShadow: plan.popular ? `0 0 36px ${plan.color}12` : "none" }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "#060A11", background: plan.color, padding: "3px 14px", borderRadius: "0 0 9px 9px", letterSpacing: "0.08em", fontFamily: fontDisp, whiteSpace: "nowrap" }}>MÁS POPULAR</div>
                )}
                <p style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 800, color: plan.popular ? plan.color : "#FFFFFF", fontFamily: fontDisp }}>{plan.name}</p>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: P.txt3, fontFamily: font }}>{plan.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: plan.popular ? plan.color : "#FFFFFF", fontFamily: fontDisp, lineHeight: 1, letterSpacing: "-0.03em" }}>${plan.price}</span>
                  <span style={{ fontSize: 12, color: P.txt3, fontFamily: font }}>/mes</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: WA, background: `${WA}10`, border: `1px solid ${WA}25`, padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.messages.toLocaleString()} msgs WA</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.agents} agentes</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <CheckCircle2 size={12} color={plan.popular ? plan.color : ACC} strokeWidth={2.5} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: plan.popular ? P.txt : P.txt3, fontFamily: font, lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => oc(`Iniciar proceso de contratación del plan ${plan.name} de agentes IA por $${plan.price}/mes`)} style={{ width: "100%", padding: "11px", borderRadius: 11, background: plan.popular ? `linear-gradient(135deg, ${plan.color}30, ${plan.color}14)` : "rgba(255,255,255,0.05)", border: `1px solid ${plan.popular ? plan.color + "55" : "rgba(255,255,255,0.10)"}`, color: plan.popular ? plan.color : P.txt2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.02em", transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = plan.popular ? `linear-gradient(135deg, ${plan.color}44, ${plan.color}22)` : "rgba(255,255,255,0.09)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = plan.popular ? `linear-gradient(135deg, ${plan.color}30, ${plan.color}14)` : "rgba(255,255,255,0.05)"; }}
                >
                  Contratar {plan.name}
                </button>
              </div>
            ))}
          </div>

          {/* FAQ monetización */}
          <G>
            <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Preguntas frecuentes</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { q: "¿Los agentes envían mensajes solos o necesito aprobar cada uno?", a: "Puedes elegir modo automático (el agente envía sin aprobación) o modo supervisado (recibes cada mensaje en Telegram y tú apruebas antes de enviar). Recomendamos automático para reactivación y supervisado para cierres." },
                { q: "¿Qué pasa si el cliente responde algo inesperado?", a: "El agente detecta respuestas fuera de su flujo y te alerta inmediatamente en Telegram. Puedes tomar el control del chat con un clic desde el bot. El agente nunca improvisa en situaciones complejas." },
                { q: "¿WhatsApp Business API tiene costos adicionales?", a: "Sí — Meta cobra por conversación iniciada por la empresa (~$0.05 USD). Estos costos están incluidos en tu plan Stratos AI. No pagas nada adicional a Meta directamente." },
                { q: "¿Puedo usar mi número de WhatsApp actual?", a: "Depende. WhatsApp Business API requiere un número dedicado (no puede ser tu número personal que ya usas en WhatsApp). Te ayudamos a conseguir y configurar el número en el onboarding." },
              ].map((item, i, arr) => (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{item.q}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: P.txt3, fontFamily: font, lineHeight: 1.55 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </G>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>
          <strong style={{ color: P.txt2 }}>Stratos AI</strong> · Agentes powered by{" "}
          <a href="https://www.anthropic.com/claude" target="_blank" rel="noopener noreferrer" style={{ color: ACC, textDecoration: "none", fontWeight: 600 }}>Claude · Anthropic</a>
          {" "}· WhatsApp Business API · Telegram Bot API
        </span>
        <button onClick={() => oc("Configuración completa del sistema de agentes IA: horarios, límites y flujos")} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: P.txt3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = P.txt3; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        >
          <Settings size={11} strokeWidth={2} /> Configuración avanzada
        </button>
      </div>

    </div>
  );
};

export default IACRM;
