/**
 * IACRM.jsx — iAgents · Equipo de Agentes IA
 * ─────────────────────────────────────────────────────────
 * Agentes IA que trabajan 24/7 via WhatsApp Business y Telegram
 * junto a los asesores humanos — Claude como cerebro de cada agente.
 * ─────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  MessageCircle, Phone, Zap, Clock, Send, User,
  CheckCircle2, RefreshCw, Target, ChevronDown,
  Settings, Eye, TrendingUp, Play, Atom
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill } from "../SharedComponents";

/* ─── COLORES DE CANAL ─── */
const WA  = "#25D366";
const TG  = "#229ED9";

/* ─── AGENTES — iconos y colores 100% azul/verde ─── */
const AGENTS = [
  {
    key: "calificador",
    name: "Calificador",
    role: "Primer contacto < 5 min",
    model: "claude-haiku-4-5",
    icon: Target,
    colorKey: "accent",   // mint
    channel: "whatsapp",
    active: true,
    trigger: "Nuevo lead registrado",
    description: "Contacta por WhatsApp en menos de 5 minutos. Califica BANT, asigna score y prepara el briefing para el asesor en Telegram.",
    queue: 4,
    today: { sent: 12, responded: 9, converted: 3 },
    lastActions: [
      { name: "Carlos Mendoza", time: "hace 8 min",  msg: "Hola Carlos, vi tu interés en Torre Esmeralda. Tengo disponibilidad para contarte sobre las últimas unidades esta tarde, ¿te funciona a las 4pm?", status: "respondió", channel: "wa" },
      { name: "Sandra Ruiz",    time: "hace 22 min", msg: "Sandra, gracias por registrarte. Para ayudarte mejor, ¿cuál es tu rango de inversión y en qué plazo estás pensando?", status: "leído", channel: "wa" },
      { name: "Luis Paredes",   time: "hace 1h",     msg: "Luis, encontré 2 opciones perfectas para tu perfil. ¿Tienes 10 minutos hoy para verlas juntos?", status: "respondió", channel: "wa" },
    ],
    teamAlert: "Notifica al asesor en Telegram con briefing completo cuando el lead responde",
  },
  {
    key: "reactivador",
    name: "Reactivador",
    role: "Clientes fríos 5+ días",
    model: "claude-sonnet-4-6",
    icon: RefreshCw,
    colorKey: "cyan",     // teal
    channel: "whatsapp",
    active: true,
    trigger: "Lead sin contacto ≥ 5 días",
    description: "Detecta leads fríos y envía mensajes de reactivación personalizados — técnica Take Away del Protocolo Duke del Caribe.",
    queue: 6,
    today: { sent: 18, responded: 11, converted: 4 },
    lastActions: [
      { name: "Patricia Reyes", time: "hace 3h", msg: "Patricia, la unidad que viste en Gobernador tiene otro interesado. Si quieres asegurarla, hoy sería el día.", status: "respondió", channel: "wa" },
      { name: "David Chen",     time: "hace 5h", msg: "David, el precio de Monarca sube el lunes. ¿Quieres aprovechar el precio actual esta semana?", status: "no leído", channel: "wa" },
    ],
    teamAlert: "Alerta al asesor cuando el cliente responde después de >7 días inactivo",
  },
  {
    key: "seguimiento",
    name: "Seguimiento",
    role: "Mantiene relación activa",
    model: "claude-sonnet-4-6",
    icon: MessageCircle,
    colorKey: "blue",     // azul
    channel: "whatsapp",
    active: true,
    trigger: "Lead activo sin acción en 3 días",
    description: "Envía touchpoints de valor cada 3-4 días — artículos, avances de obra, casos de éxito. Nunca 'solo para dar seguimiento'.",
    queue: 8,
    today: { sent: 11, responded: 7, converted: 2 },
    lastActions: [
      { name: "Tony Nakamura", time: "hace 1h", msg: "Tony, salió el reporte Q1 de Riviera Maya — plusvalía de 18% en proyectos similares al tuyo. Te lo comparto.", status: "respondió", channel: "wa" },
      { name: "Ana López",     time: "hace 4h", msg: "Ana, la alberca del piso 12 ya tiene fecha de inauguración. ¿Quieres que te agende una visita de obra?", status: "leído", channel: "wa" },
    ],
    teamAlert: "Briefing diario al asesor cada mañana con el estado de sus leads activos",
  },
  {
    key: "callcenter",
    name: "Briefing Zoom",
    role: "Prepara cierres y Zooms",
    model: "claude-opus-4-7",
    icon: Phone,
    colorKey: "blue",     // azul (mismo family)
    channel: "telegram",
    active: true,
    trigger: "Zoom o visita agendada",
    description: "30 minutos antes de cada Zoom envía al asesor por Telegram el briefing completo: historial, objeciones, argumentos y próximo paso.",
    queue: 2,
    today: { sent: 6, responded: 5, converted: 2 },
    lastActions: [
      { name: "Fam. Rodríguez", time: "hace 30 min", msg: "📋 BRIEFING ZOOM 4pm\n\n👤 Roberto Rodríguez — inversionista, $4.2M\n⚠️ Objeción probable: tasa de retorno\n💡 ROI 14% vs 8% bancario\n✅ Próximo paso: reserva simbólica hoy", status: "leído", channel: "tg" },
    ],
    teamAlert: "Envía briefing 30 min antes. Post-llamada recibe resumen del asesor para actualizar CRM.",
  },
];

const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp Business", icon: MessageCircle, color: WA, number: "+52 998 XXX XXXX", status: "conectado", desc: "Canal principal — mensajes personalizados de los agentes a clientes", messages_today: 47, response_rate: "82%" },
  { id: "telegram", name: "Telegram Bot",       icon: Send,          color: TG, number: "@StratosAI_bot",   status: "conectado", desc: "Notificaciones al equipo — briefings y alertas en tiempo real",      messages_today: 23, response_rate: "—" },
];

const PRICING = [
  { name: "Starter",  price: 49,  desc: "Para asesores individuales",          colorKey: "accent",  popular: false, agents: 2, messages: 500,  features: ["2 agentes activos","500 mensajes/mes","Notificaciones Telegram","Dashboard de conversaciones"] },
  { name: "Pro",      price: 129, desc: "Para equipos de hasta 5 asesores",    colorKey: "blue",    popular: true,  agents: 4, messages: 2000, features: ["4 agentes activos (todos)","2,000 mensajes/mes","Briefings Zoom (Opus)","CRM integrado en tiempo real","Reportes semanales automáticos"] },
  { name: "Business", price: 299, desc: "Para equipos grandes y franquicias",  colorKey: "cyan",    popular: false, agents: 4, messages: 8000, features: ["Mensajes ilimitados","Múltiples números WhatsApp","Agentes personalizados","Integración API","Account manager dedicado"] },
];

const activityData = [
  { h: "8am", wa: 3, tg: 1 }, { h: "9am", wa: 8, tg: 4 },
  { h: "10am", wa: 12, tg: 6 }, { h: "11am", wa: 15, tg: 8 },
  { h: "12pm", wa: 9, tg: 5 }, { h: "2pm", wa: 11, tg: 7 },
  { h: "3pm", wa: 14, tg: 9 }, { h: "4pm", wa: 18, tg: 11 },
  { h: "5pm", wa: 13, tg: 7 }, { h: "6pm", wa: 7, tg: 4 },
];

/* ─── SUBCOMPONENTES ─── */
const ChannelBadge = ({ ch, T, isLight }) => {
  const c = ch === "wa" ? WA : TG;
  const label = ch === "wa" ? "WhatsApp" : "Telegram";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: c, background: `${c}12`, border: `1px solid ${c}28`, padding: "2px 7px", borderRadius: 6, fontFamily: fontDisp, letterSpacing: "0.04em" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: c, flexShrink: 0 }} />
      {label}
    </span>
  );
};

const StatusChip = ({ s }) => {
  const c = s === "respondió" ? "#4ADE80" : s === "leído" ? "#67E8F9" : "#64748B";
  const l = s === "respondió" ? "Respondió" : s === "leído" ? "Leído" : "Sin leer";
  return <span style={{ fontSize: 9, fontWeight: 700, color: c, fontFamily: fontDisp }}>{l}</span>;
};

const AgentToggle = ({ active, onChange, T, isLight }) => (
  <button onClick={onChange} style={{
    display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8,
    background: active ? (isLight ? `${T.accent}14` : `${T.accent}10`) : (isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.04)"),
    border: `1px solid ${active ? T.accent + "38" : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)")}`,
    cursor: "pointer", transition: "all 0.18s",
  }}>
    <div style={{ width: 26, height: 14, borderRadius: 7, background: active ? T.accent : (isLight ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.12)"), position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 2, left: active ? 14 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </div>
    <span style={{ fontSize: 10, fontWeight: 700, color: active ? T.accent : T.txt3, fontFamily: fontDisp }}>{active ? "Activo" : "Pausado"}</span>
  </button>
);

/* ─── VISTA PRINCIPAL ─── */
const IACRM = ({ oc, theme = "dark" }) => {
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  const [tab, setTab]                     = useState("agentes");
  const [expandedAgent, setExpandedAgent] = useState("calificador");
  const [agentStates, setAgentStates]     = useState({ calificador: true, reactivador: true, seguimiento: true, callcenter: true });

  const toggleAgent = (key) => setAgentStates(p => ({ ...p, [key]: !p[key] }));

  const totalSent  = AGENTS.reduce((s, a) => s + a.today.sent, 0);
  const totalResp  = AGENTS.reduce((s, a) => s + a.today.responded, 0);
  const totalConv  = AGENTS.reduce((s, a) => s + a.today.converted, 0);
  const totalQueue = AGENTS.reduce((s, a) => s + a.queue, 0);
  const activeCount = Object.values(agentStates).filter(Boolean).length;

  /* Resuelve color por key (accent, blue, cyan, emerald) */
  const col = (key) => T[key] || T.accent;

  const TABS = [
    { id: "agentes", label: "Mis Agentes" },
    { id: "canales", label: "Canales" },
    { id: "planes",  label: "Planes" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ══ HEADER — estilo CRM Asesores ══════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          {/* Fila título */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            {/* Dot vivo */}
            <div style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
              background: T.accent,
              boxShadow: isLight
                ? `0 0 6px ${T.accent}60, 0 0 12px ${T.accent}30`
                : `0 0 8px ${T.accent}CC, 0 0 18px ${T.accent}55`,
              animation: "pulse 2.4s ease-in-out infinite",
            }} />
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 800,
              color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em",
            }}>
              iAgents{" "}
              <span style={{ fontWeight: 300, color: T.txt2, letterSpacing: "-0.01em" }}>IA</span>
            </h2>
            <Pill color={T.accent} isLight={isLight} s>LIVE</Pill>
          </div>
          {/* Subtítulo métricas */}
          <p style={{ margin: 0, fontSize: 12.5, color: T.txt2, fontFamily: font, letterSpacing: "-0.01em" }}>
            {totalSent} mensajes hoy · <span style={{ color: T.accent }}>{totalResp} respondieron</span> · {activeCount} agentes activos · {totalQueue} en cola
          </p>
        </div>

        {/* Acciones derecha */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* Status chips */}
          <div style={{ display: "flex", gap: 6 }}>
            {[{ c: WA, l: "WhatsApp" }, { c: TG, l: "Telegram" }].map(({ c, l }) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 9, background: `${c}10`, border: `1px solid ${c}28` }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: c, animation: "pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: c, fontFamily: fontDisp }}>{l}</span>
              </div>
            ))}
          </div>
          {/* CTA */}
          <button
            onClick={() => oc("¿Qué leads necesitan atención urgente ahora mismo? Dame el resumen del equipo de agentes")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
              background: isLight ? T.accentG : `${T.accent}14`,
              border: `1px solid ${T.accent}38`,
              color: isLight ? "#FFFFFF" : T.accent,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
              transition: "all 0.15s",
              boxShadow: isLight ? T.shadowMint : "none",
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? T.accentDark : `${T.accent}22`}
            onMouseLeave={e => e.currentTarget.style.background = isLight ? T.accentG : `${T.accent}14`}
          >
            <Atom size={13} strokeWidth={2} /> Estado del equipo
          </button>
        </div>
      </div>

      {/* ══ KPIs ══════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Mensajes hoy"        value={totalSent}  sub={`${totalQueue} en cola`}               icon={MessageCircle} T={T} />
        <KPI label="Respondieron"        value={totalResp}  sub={`${Math.round(totalResp/totalSent*100)}% tasa`} icon={CheckCircle2} T={T} />
        <KPI label="Convertidos hoy"     value={totalConv}  sub="leads → acción concreta"               icon={TrendingUp}    T={T} />
        <KPI label="Agentes activos"     value={activeCount} sub="de 4 disponibles"                    icon={Zap}           T={T} />
      </div>

      {/* ══ TABS ══════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", gap: 2, padding: "3px",
        borderRadius: 12,
        background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        width: "fit-content",
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "7px 20px", borderRadius: 9,
              background: active ? (isLight ? "rgba(255,255,255,0.95)" : `${T.accent}12`) : "transparent",
              border: active ? `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.accent + "28"}` : "1px solid transparent",
              color: active ? (isLight ? T.accent : T.accent) : T.txt3,
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: "pointer", fontFamily: fontDisp, transition: "all 0.18s",
              boxShadow: active && isLight ? T.shadow1 : "none",
            }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          TAB: MIS AGENTES
      ══════════════════════════════════════════════ */}
      {tab === "agentes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Gráfica actividad */}
          <G T={T}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Actividad del equipo IA — hoy</p>
              <div style={{ display: "flex", gap: 12 }}>
                {[{ c: WA, l: "WhatsApp" }, { c: TG, l: "Telegram" }].map(({ c, l }) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.txt3, fontFamily: font }}>
                    <span style={{ width: 10, height: 3, borderRadius: 2, background: c, display: "inline-block" }} /> {l}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={activityData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={WA} stopOpacity={isLight ? 0.18 : 0.22} />
                    <stop offset="95%" stopColor={WA} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={TG} stopOpacity={isLight ? 0.18 : 0.22} />
                    <stop offset="95%" stopColor={TG} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ background: isLight ? "#FFFFFF" : "#111318", border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 11 }} />
                <Area type="monotone" dataKey="wa" stroke={WA} strokeWidth={2} fill="url(#waGrad)" name="WhatsApp" />
                <Area type="monotone" dataKey="tg" stroke={TG} strokeWidth={2} fill="url(#tgGrad)" name="Telegram" />
              </AreaChart>
            </ResponsiveContainer>
          </G>

          {/* Accordion de agentes */}
          {AGENTS.map(agent => {
            const AI = agent.icon;
            const expanded = expandedAgent === agent.key;
            const isActive = agentStates[agent.key];
            const c = col(agent.colorKey);
            const cSafe = isLight ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;
            const chColor = agent.channel === "whatsapp" ? WA : TG;

            return (
              <div key={agent.key} style={{
                borderRadius: 16,
                background: isLight
                  ? (expanded ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.80)")
                  : (expanded ? "rgba(6,10,17,0.98)" : T.glass),
                border: `1px solid ${expanded ? c + (isLight ? "40" : "38") : T.border}`,
                overflow: "hidden", transition: "all 0.22s",
                boxShadow: expanded
                  ? (isLight ? `0 4px 24px ${c}14, 0 1px 4px rgba(15,23,42,0.06)` : `0 0 28px ${c}0C`)
                  : (isLight ? T.shadow1 : "none"),
                backdropFilter: isLight ? "blur(40px)" : "none",
              }}>

                {/* ─ Header del agente ─ */}
                <div
                  style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpandedAgent(expanded ? null : agent.key)}
                >
                  {/* Icono */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 13,
                      background: isLight
                        ? `linear-gradient(135deg, ${c}20 0%, ${c}0C 100%)`
                        : `${c}14`,
                      border: `1px solid ${c}${isLight ? "40" : "28"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: isLight ? `0 2px 8px ${c}18` : "none",
                    }}>
                      <AI size={20} color={cSafe} strokeWidth={1.8} />
                    </div>
                    {/* Canal badge */}
                    <div style={{
                      position: "absolute", bottom: -3, right: -3, width: 16, height: 16,
                      borderRadius: "50%", background: chColor,
                      border: `2px solid ${isLight ? "#FFFFFF" : "#060A11"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {agent.channel === "whatsapp"
                        ? <MessageCircle size={7} color="#FFF" strokeWidth={2.5} />
                        : <Send size={7} color="#FFF" strokeWidth={2.5} />}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isActive ? T.txt : T.txt3, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{agent.name}</p>
                      <ChannelBadge ch={agent.channel === "whatsapp" ? "wa" : "tg"} />
                      {!isActive && (
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: T.txt3, background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 5, letterSpacing: "0.07em", fontFamily: fontDisp }}>PAUSADO</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font }}>
                      {agent.role} · <span style={{ color: cSafe, fontWeight: 600 }}>{agent.queue} en cola</span>
                    </p>
                  </div>

                  {/* Métricas rápidas */}
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                    {[
                      { l: "Enviados",   v: agent.today.sent,      c2: T.txt2 },
                      { l: "Respuestas", v: agent.today.responded, c2: isLight ? "#059669" : "#4ADE80" },
                      { l: "Convertidos",v: agent.today.converted, c2: cSafe },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: m.c2, fontFamily: fontDisp, lineHeight: 1, letterSpacing: "-0.03em" }}>{m.v}</p>
                        <p style={{ margin: 0, fontSize: 8.5, color: T.txt3, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{m.l}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <AgentToggle active={isActive} onChange={() => toggleAgent(agent.key)} T={T} isLight={isLight} />
                    <ChevronDown size={14} color={T.txt3} strokeWidth={2} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </div>
                </div>

                {/* ─ Panel expandido ─ */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${c}${isLight ? "22" : "16"}` }}>

                    <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ padding: "11px 14px", borderRadius: 11, background: isLight ? `${c}08` : `${c}06`, border: `1px solid ${c}${isLight ? "20" : "14"}` }}>
                        <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 700, color: cSafe, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Descripción</p>
                        <p style={{ margin: 0, fontSize: 11, color: T.txt2, fontFamily: font, lineHeight: 1.6 }}>{agent.description}</p>
                      </div>
                      <div style={{ padding: "11px 14px", borderRadius: 11, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
                        <p style={{ margin: "0 0 7px", fontSize: 9.5, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Se activa cuando</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                          <Zap size={12} color={cSafe} strokeWidth={2.5} />
                          <p style={{ margin: 0, fontSize: 11.5, color: T.txt, fontFamily: fontDisp, fontWeight: 600 }}>{agent.trigger}</p>
                        </div>
                        <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Notifica al asesor</p>
                        <p style={{ margin: 0, fontSize: 10.5, color: isLight ? "#0066BB" : TG, fontFamily: font, lineHeight: 1.5 }}>{agent.teamAlert}</p>
                      </div>
                    </div>

                    {/* Conversaciones */}
                    <div style={{ padding: "0 18px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 9.5, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Últimas conversaciones</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {agent.lastActions.map((a, i) => (
                          <div key={i} style={{ padding: "11px 13px", borderRadius: 12, background: isLight ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, boxShadow: isLight ? T.shadow1 : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: isLight ? `${c}14` : `${c}14`, border: `1px solid ${c}${isLight ? "30" : "26"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <User size={13} color={cSafe} strokeWidth={2} />
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{a.name}</p>
                                  <ChannelBadge ch={a.channel} />
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 9.5, color: T.txt3, fontFamily: font }}>{a.time}</span>
                                <StatusChip s={a.status} />
                              </div>
                            </div>
                            <div style={{ marginLeft: 36, padding: "8px 12px", borderRadius: "4px 12px 12px 12px", background: isLight ? `${c}08` : `${c}10`, border: `1px solid ${c}${isLight ? "18" : "1C"}` }}>
                              <p style={{ margin: 0, fontSize: 11.5, color: T.txt2, fontFamily: font, lineHeight: 1.58, whiteSpace: "pre-line" }}>{a.msg}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTAs */}
                    <div style={{ padding: "0 18px 16px", display: "flex", gap: 8 }}>
                      <button
                        onClick={() => oc(`Ejecutar ${agent.name}: revisa la cola y genera los mensajes para los ${agent.queue} leads pendientes`)}
                        style={{
                          flex: 1, padding: "9px 14px", borderRadius: 10,
                          background: isLight
                            ? `linear-gradient(135deg, ${c}20, ${c}0C)`
                            : `linear-gradient(135deg, ${c}22, ${c}0C)`,
                          border: `1px solid ${c}${isLight ? "40" : "40"}`,
                          color: cSafe, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isLight ? `linear-gradient(135deg, ${c}30, ${c}18)` : `linear-gradient(135deg, ${c}34, ${c}18)`}
                        onMouseLeave={e => e.currentTarget.style.background = isLight ? `linear-gradient(135deg, ${c}20, ${c}0C)` : `linear-gradient(135deg, ${c}22, ${c}0C)`}
                      >
                        <Play size={12} strokeWidth={2.5} /> Ejecutar ({agent.queue} en cola)
                      </button>
                      <button
                        onClick={() => oc(`Ver todas las conversaciones del agente ${agent.name}`)}
                        style={{
                          padding: "9px 14px", borderRadius: 10,
                          background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${T.border}`,
                          color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: fontDisp, transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"; e.currentTarget.style.color = T.txt; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)"; e.currentTarget.style.color = T.txt3; }}
                      >
                        <Eye size={12} strokeWidth={2} /> Historial
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: CANALES
      ══════════════════════════════════════════════ */}
      {tab === "canales" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {CHANNELS.map(ch => {
              const I = ch.icon;
              return (
                <G key={ch.id} T={T}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${ch.color}12`, border: `1px solid ${ch.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <I size={22} color={ch.color} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{ch.name}</p>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: ch.color, background: `${ch.color}12`, border: `1px solid ${ch.color}28`, padding: "2px 7px", borderRadius: 6, fontFamily: fontDisp }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: ch.color, animation: "pulse 2s ease-in-out infinite" }} />
                          {ch.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font }}>{ch.number}</p>
                    </div>
                  </div>
                  <p style={{ margin: "0 0 16px", fontSize: 11.5, color: T.txt2, fontFamily: font, lineHeight: 1.6 }}>{ch.desc}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { l: "mensajes hoy", v: ch.messages_today, c: ch.color },
                      { l: "tasa respuesta", v: ch.response_rate, c: isLight ? "#059669" : "#4ADE80" },
                    ].map(({ l, v, c: mc }) => (
                      <div key={l} style={{ padding: "9px 12px", borderRadius: 10, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: mc, fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{v}</p>
                        <p style={{ margin: 0, fontSize: 9.5, color: T.txt3, fontFamily: font, marginTop: 2 }}>{l}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => oc(`Configurar canal ${ch.name}`)}
                    style={{ width: "100%", padding: "9px", borderRadius: 10, background: `${ch.color}0C`, border: `1px solid ${ch.color}28`, color: ch.color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s" }}
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
          <G T={T}>
            <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Cómo trabaja el equipo IA</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { step: "1", colorKey: "accent",  icon: User,           title: "Lead nuevo entra al CRM",                     desc: "Por Facebook Ads, referido, landing page o registro manual del asesor.", channel: null },
                { step: "2", colorKey: "accent",  icon: MessageCircle,  title: "Calificador contacta en < 5 min por WhatsApp", desc: "Primer mensaje personalizado — saludo, calificación BANT, propuesta de Zoom.", channel: "wa" },
                { step: "3", colorKey: "blue",    icon: Send,           title: "Asesor recibe briefing en Telegram",            desc: "Al responder el lead, el asesor recibe score, BANT detectado y siguiente paso.", channel: "tg" },
                { step: "4", colorKey: "cyan",    icon: Clock,          title: "Seguimiento automático si no hay respuesta",    desc: "Si el lead no responde en 24h, el Reactivador entra con un ángulo diferente.", channel: "wa" },
                { step: "5", colorKey: "blue",    icon: Phone,          title: "Briefing de Zoom en Telegram",                  desc: "30 min antes de cada reunión, el asesor recibe el dossier completo por Telegram.", channel: "tg" },
                { step: "6", colorKey: "accent",  icon: CheckCircle2,   title: "Asesor toma el control en cualquier momento",   desc: "Con un comando en Telegram, el asesor pausa el agente y toma la conversación.", channel: null },
              ].map((s, i) => {
                const SI = s.icon;
                const sc = col(s.colorKey);
                const scSafe = isLight ? `color-mix(in srgb, ${sc} 58%, #0B1220 42%)` : sc;
                return (
                  <div key={s.step} style={{ display: "flex", gap: 14, paddingBottom: i < 5 ? 16 : 0, borderBottom: i < 5 ? `1px solid ${T.border}` : "none", marginBottom: i < 5 ? 16 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: isLight ? `${sc}14` : `${sc}12`, border: `1px solid ${sc}${isLight ? "28" : "24"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <SI size={14} color={scSafe} strokeWidth={2} />
                      </div>
                      {i < 5 && <div style={{ width: 1.5, flex: 1, background: `linear-gradient(${sc}28, transparent)`, marginTop: 5 }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.018em" }}>{s.title}</p>
                        {s.channel && <ChannelBadge ch={s.channel} />}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.55 }}>{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </G>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: PLANES
      ══════════════════════════════════════════════ */}
      {tab === "planes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {PRICING.map(plan => {
              const pc = col(plan.colorKey);
              const pcSafe = isLight ? `color-mix(in srgb, ${pc} 58%, #0B1220 42%)` : pc;
              return (
                <div key={plan.name} style={{
                  borderRadius: 20,
                  background: plan.popular
                    ? (isLight ? `linear-gradient(160deg, ${pc}10 0%, rgba(255,255,255,0.95) 100%)` : `linear-gradient(160deg, ${pc}10 0%, rgba(6,10,17,0.99) 100%)`)
                    : (isLight ? "rgba(255,255,255,0.82)" : "rgba(6,10,17,0.98)"),
                  border: `1px solid ${plan.popular ? pc + (isLight ? "44" : "50") : T.border}`,
                  padding: "22px", position: "relative",
                  boxShadow: plan.popular
                    ? (isLight ? `0 4px 24px ${pc}18, 0 1px 4px rgba(15,23,42,0.06)` : `0 0 36px ${pc}12`)
                    : (isLight ? T.shadow1 : "none"),
                  backdropFilter: isLight ? "blur(40px)" : "none",
                }}>
                  {plan.popular && (
                    <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "#FFFFFF", background: isLight ? `color-mix(in srgb, ${pc} 80%, #000 20%)` : pc, padding: "3px 14px", borderRadius: "0 0 9px 9px", letterSpacing: "0.08em", fontFamily: fontDisp, whiteSpace: "nowrap" }}>MÁS POPULAR</div>
                  )}
                  <p style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 800, color: plan.popular ? pcSafe : T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{plan.name}</p>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: T.txt3, fontFamily: font }}>{plan.desc}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 7 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: plan.popular ? pcSafe : T.txt, fontFamily: fontDisp, lineHeight: 1, letterSpacing: "-0.04em" }}>${plan.price}</span>
                    <span style={{ fontSize: 12, color: T.txt3, fontFamily: font }}>/mes</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isLight ? "#15803D" : WA, background: isLight ? "rgba(21,128,61,0.08)" : `${WA}10`, border: `1px solid ${isLight ? "rgba(21,128,61,0.20)" : WA + "25"}`, padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.messages.toLocaleString()} msgs</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.txt2, background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.agents} agentes</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <CheckCircle2 size={13} color={plan.popular ? pcSafe : (isLight ? T.accent : T.accent)} strokeWidth={2.5} style={{ marginTop: 1, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: plan.popular ? T.txt : T.txt2, fontFamily: font, lineHeight: 1.45 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => oc(`Iniciar proceso de contratación del plan ${plan.name} de agentes IA por $${plan.price}/mes`)}
                    style={{
                      width: "100%", padding: "11px", borderRadius: 11,
                      background: plan.popular
                        ? (isLight ? T.accentG : `linear-gradient(135deg, ${pc}30, ${pc}14)`)
                        : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"),
                      border: `1px solid ${plan.popular ? pc + (isLight ? "44" : "55") : T.border}`,
                      color: plan.popular ? (isLight ? "#FFFFFF" : pcSafe) : T.txt2,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.015em", transition: "all 0.18s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = plan.popular ? (isLight ? T.accentDark : `linear-gradient(135deg, ${pc}44, ${pc}22)`) : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)"); }}
                    onMouseLeave={e => { e.currentTarget.style.background = plan.popular ? (isLight ? T.accentG : `linear-gradient(135deg, ${pc}30, ${pc}14)`) : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"); }}
                  >
                    Contratar {plan.name}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Nota Anthropic */}
          <G T={T}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: isLight ? `${T.accent}14` : `${T.accent}12`, border: `1px solid ${T.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Atom size={18} color={isLight ? T.accent : T.accent} strokeWidth={1.8} />
              </div>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.015em" }}>Powered by Claude · Anthropic</p>
                <p style={{ margin: 0, fontSize: 11, color: T.txt2, fontFamily: font, lineHeight: 1.55 }}>
                  Cada agente usa los modelos más avanzados de Anthropic — Haiku para velocidad, Sonnet para razonamiento, Opus para briefings complejos. Tu equipo, amplificado.
                </p>
              </div>
            </div>
          </G>
        </div>
      )}

    </div>
  );
};

export default IACRM;
