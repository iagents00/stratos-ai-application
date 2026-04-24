/**
 * IACRM.jsx — Centro de Agentes Claude · IAOS
 * ─────────────────────────────────────────────────────────────────────────────
 * Powered by Claude (Anthropic) · Stratos AI actúa como plataforma intermediaria
 * que conecta a los asesores con los modelos Claude, cumpliendo las políticas de uso
 * de Anthropic (anthropic.com/usage-policy).
 *
 * Modelo de fee (transparente):
 *   Usuario paga créditos Stratos → Stratos paga tokens Claude a Anthropic
 *   → Stratos retiene un margen por la plataforma, soporte y agentes IAOS.
 *
 * MCP: Este módulo incluye configuración para vincular Claude Code con los datos
 * de Stratos AI usando Model Context Protocol (MCP).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import {
  Atom, Phone, TrendingUp, CheckCircle2, Zap, Clock, User,
  Shield, Timer, Users, Send, MessageCircle, RefreshCw,
  Target, DollarSign, Activity, Copy, Check, ExternalLink,
  Key, Cpu, CreditCard, Sparkles, BarChart3, Globe,
  AlertCircle, Lock, Star, ChevronRight, ChevronDown,
  Rocket, Code2, Terminal, Webhook, Settings, Info,
  BookOpen, FileText, CheckSquare
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

/* ─── CONSTANTES ─── */
const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-6",    name: "Claude Sonnet 4.6",  tier: "Recomendado", speed: "Rápido",    quality: "Alto",   costIn: 3.00,  costOut: 15.00, color: "#6EE7C2", badge: "RECOMENDADO" },
  { id: "claude-opus-4-7",      name: "Claude Opus 4.7",    tier: "Premium",     speed: "Preciso",   quality: "Máximo", costIn: 15.00, costOut: 75.00, color: "#A78BFA", badge: "PREMIUM" },
  { id: "claude-haiku-4-5",     name: "Claude Haiku 4.5",   tier: "Económico",   speed: "Ultra-rápido", quality: "Bueno", costIn: 0.25, costOut: 1.25, color: "#67E8F9", badge: "ECONÓMICO" },
];

const AGENTS = [
  {
    key: "reactivador",
    name: "Reactivador",
    role: "Recupera leads fríos",
    model: "claude-sonnet-4-6",
    icon: RefreshCw,
    color: "#6EE7C2",
    description: "Detecta leads sin contacto 5+ días y genera mensajes de reactivación personalizados basados en el historial del cliente, técnica TAKE AWAY y el protocolo Duke del Caribe.",
    prompt: `Eres el Agente Reactivador de Stratos AI. Analiza este lead:
Nombre: {lead.n} | Días inactivo: {lead.daysInactive} | Última acción: {lead.lastActivity}
Etapa: {lead.st} | Presupuesto: {lead.budget} | Proyecto: {lead.p}

Genera un mensaje de WhatsApp de reactivación corto (3-4 líneas), personalizado,
usando la técnica Take Away del Protocolo Duke del Caribe. Tono: profesional, cálido,
con urgencia real (nunca falsa). No menciones que eres IA.`,
    kpis: { calls: 89, success: 34, queue: 12, rate: "38%" },
    status: "Activo",
  },
  {
    key: "seguimiento",
    name: "Seguimiento",
    role: "Mantiene la relación activa",
    model: "claude-sonnet-4-6",
    icon: MessageCircle,
    color: "#6EE7C2",
    description: "Prepara next-steps, recordatorios y micro-compromisos. Revisa el BANT del lead y sugiere el touchpoint de más valor para cada etapa del pipeline.",
    prompt: `Eres el Agente de Seguimiento de Stratos AI. Para este lead:
Nombre: {lead.n} | Etapa: {lead.st} | Score: {lead.sc} | BANT: {bantStatus}

Basándote en el Protocolo Duke del Caribe, genera:
1. El siguiente touchpoint óptimo (con fecha y canal sugerido)
2. Un mensaje de valor concreto (no "solo para dar seguimiento")
3. Una pregunta de calificación BANT pendiente si aplica`,
    kpis: { calls: 156, success: 68, queue: 8, rate: "44%" },
    status: "Activo",
  },
  {
    key: "callcenter",
    name: "Callcenter IA",
    role: "Prepara y asiste llamadas",
    model: "claude-opus-4-7",
    icon: Phone,
    color: "#A78BFA",
    description: "Genera briefing pre-llamada con objeciones esperadas y argumentos. Usa Opus para análisis profundo del perfil antes de Zooms y cierres de alto valor.",
    prompt: `Eres el Agente Callcenter de Stratos AI. Prepara el briefing pre-llamada:
Cliente: {lead.n} | Proyecto: {lead.p} | Presupuesto: {lead.budget}
Historial: {lead.notas} | Etapa actual: {lead.st}

Genera un briefing de 5 secciones:
1. Perfil rápido del cliente (2-3 puntos clave)
2. Objeciones probables (3 máximo con contraargumentos)
3. Argumento principal de cierre para su perfil
4. Preguntas de calificación pendientes (BANT)
5. Próximo paso concreto a proponer al final de la llamada`,
    kpis: { calls: 47, success: 19, queue: 5, rate: "40%" },
    status: "Activo",
  },
  {
    key: "calificador",
    name: "Calificador",
    role: "Evalúa leads nuevos",
    model: "claude-haiku-4-5",
    icon: Target,
    color: "#67E8F9",
    description: "Analiza leads recién registrados con Haiku (ultra-rápido y económico) para scoring inicial, detección de fit y asignación al asesor correcto en segundos.",
    prompt: `Eres el Agente Calificador de Stratos AI. Evalúa este nuevo lead:
Nombre: {lead.n} | Teléfono: {lead.tel} | Fuente: {lead.campana}
Notas iniciales: {lead.notas} | Proyecto de interés: {lead.p}

Devuelve JSON:
{
  "score": 0-100,
  "fit": "alto|medio|bajo",
  "asesor_recomendado": "perfil sugerido",
  "prioridad_contacto": "inmediata|normal|baja",
  "bant_inicial": { "budget": "...", "authority": "...", "need": "...", "timeline": "..." },
  "primer_mensaje": "mensaje de WhatsApp para primer contacto en <5 min"
}`,
    kpis: { calls: 203, success: 187, queue: 28, rate: "92%" },
    status: "Activo",
  },
];

const CREDIT_PLANS = [
  {
    name: "Starter",
    price: 29,
    tokens: 500_000,
    agentsIncluded: 2,
    color: "#6EE7C2",
    features: ["2 agentes IA activos", "500K tokens Claude/mes", "Calificador + Seguimiento", "Soporte por chat"],
    claudeCost: 1.50,  // ≈ lo que Stratos paga a Anthropic por 500K tokens mix
    popular: false,
  },
  {
    name: "Pro",
    price: 79,
    tokens: 2_000_000,
    agentsIncluded: 4,
    color: "#A78BFA",
    features: ["4 agentes IA activos", "2M tokens Claude/mes", "Todos los agentes", "Briefings pre-llamada Opus", "Historial 90 días"],
    claudeCost: 6.00,
    popular: true,
  },
  {
    name: "Business",
    price: 199,
    tokens: 8_000_000,
    agentsIncluded: 4,
    color: "#F59E0B",
    features: ["Agentes ilimitados", "8M tokens Claude/mes", "Modelos Opus para cierres", "API directa + MCP", "Onboarding personalizado", "SLA garantizado"],
    claudeCost: 24.00,
    popular: false,
  },
];

const usageData = [
  { d: "L", tokens: 42000 }, { d: "M", tokens: 68000 }, { d: "X", tokens: 55000 },
  { d: "J", tokens: 91000 }, { d: "V", tokens: 74000 }, { d: "S", tokens: 38000 },
  { d: "D", tokens: 28000 },
];

const MCP_CONFIG = `{
  "mcpServers": {
    "stratos-ai": {
      "command": "npx",
      "args": ["stratos-mcp-server"],
      "env": {
        "STRATOS_API_KEY": "sk-stratos-xxxx",
        "STRATOS_WORKSPACE": "your-workspace-id"
      }
    }
  }
}`;

const MCP_TOOLS = [
  { name: "get_leads", desc: "Obtiene leads del CRM con filtros por etapa, score, asesor e inactividad." },
  { name: "update_lead_stage", desc: "Avanza o retrocede la etapa de un lead en el pipeline." },
  { name: "add_followup", desc: "Registra un seguimiento en el historial del lead." },
  { name: "get_priority_leads", desc: "Retorna los leads que requieren acción inmediata hoy." },
  { name: "run_agent", desc: "Ejecuta un agente IA sobre un lead específico y devuelve el resultado." },
  { name: "get_bant_status", desc: "Retorna el score BANT de un lead y los criterios pendientes." },
  { name: "get_pipeline_stats", desc: "Estadísticas del pipeline: conversión, valor total, score promedio." },
];

/* ─── SUBCOMPONENTES ─── */
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: copied ? "rgba(110,231,194,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${copied ? "rgba(110,231,194,0.35)" : "rgba(255,255,255,0.10)"}`, color: copied ? "#6EE7C2" : "#8B99AE", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s" }}
    >
      {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
};

const ModelBadge = ({ modelId }) => {
  const m = CLAUDE_MODELS.find(x => x.id === modelId);
  if (!m) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: m.color, background: `${m.color}12`, border: `1px solid ${m.color}30`, padding: "2px 7px", borderRadius: 5, letterSpacing: "0.06em", fontFamily: fontDisp }}>
      <Cpu size={8} strokeWidth={2.5} /> {m.id}
    </span>
  );
};

/* ─── VISTA PRINCIPAL ─── */
const IACRM = ({ oc }) => {
  const [activeTab, setActiveTab] = useState("agentes");
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("Pro");

  const TABS = [
    { id: "agentes",    label: "Equipo IA",       icon: Atom },
    { id: "creditos",   label: "Créditos",        icon: CreditCard },
    { id: "mcp",        label: "Claude Code MCP", icon: Terminal },
    { id: "compliance", label: "Transparencia",   icon: Shield },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── HERO HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo Claude */}
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, rgba(110,231,194,0.18) 0%, rgba(167,139,250,0.18) 100%)", border: "1px solid rgba(110,231,194,0.28)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(110,231,194,0.14)" }}>
            <Atom size={24} color="#6EE7C2" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em" }}>Centro de Agentes Claude</h2>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#6EE7C2", background: "rgba(110,231,194,0.10)", border: "1px solid rgba(110,231,194,0.28)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.08em", fontFamily: fontDisp }}>IAOS</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6EE7C2", animation: "pulse 2s ease-in-out infinite", boxShadow: "0 0 6px #6EE7C2" }} />
              <span style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>4 agentes activos · Powered by Claude · Anthropic</span>
            </div>
          </div>
        </div>

        {/* Estado de conexión */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: "rgba(110,231,194,0.06)", border: "1px solid rgba(110,231,194,0.20)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6EE7C2", boxShadow: "0 0 8px #6EE7C2", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6EE7C2", fontFamily: fontDisp }}>Anthropic API · Conectado</span>
          </div>
          <button
            onClick={() => oc("Muéstrame el estado completo de los agentes IA y las acciones pendientes en el CRM")}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: P.txt3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.03em", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(110,231,194,0.08)"; e.currentTarget.style.borderColor = "rgba(110,231,194,0.22)"; e.currentTarget.style.color = "#6EE7C2"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = P.txt3; }}
          >
            <MessageCircle size={11} strokeWidth={2} /> Preguntar a Claude
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Créditos Disponibles" value="1.4M" sub="tokens restantes" icon={Zap} />
        <KPI label="Tokens Este Mes" value="612K" sub="de 2M incluidos" icon={Activity} />
        <KPI label="Acciones IA Hoy" value="47" sub="+18 vs ayer" icon={CheckCircle2} />
        <KPI label="Tasa de Éxito IA" value="68%" sub="+6pp este mes" icon={TrendingUp} />
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 4, padding: "4px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {TABS.map(t => {
          const I = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: active ? "rgba(110,231,194,0.10)" : "transparent", border: active ? "1px solid rgba(110,231,194,0.28)" : "1px solid transparent", color: active ? "#6EE7C2" : P.txt3, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.01em", transition: "all 0.18s" }}>
              <I size={13} strokeWidth={active ? 2.4 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════
          TAB: EQUIPO DE AGENTES IA
      ══════════════════════════════════════════ */}
      {activeTab === "agentes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Agentes grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {AGENTS.map(agent => {
              const AI = agent.icon;
              const isExpanded = expandedAgent === agent.key;
              const m = CLAUDE_MODELS.find(x => x.id === agent.model);
              return (
                <div key={agent.key} style={{ borderRadius: 16, background: `linear-gradient(160deg, rgba(10,14,24,0.97) 0%, rgba(5,7,14,0.99) 100%)`, border: `1px solid ${isExpanded ? `${agent.color}44` : `${agent.color}18`}`, overflow: "hidden", transition: "all 0.24s", boxShadow: isExpanded ? `0 0 32px ${agent.color}14` : "none" }}>
                  {/* Card header */}
                  <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Ícono */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 13, background: `${agent.color}14`, border: `1px solid ${agent.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <AI size={18} color={agent.color} strokeWidth={2} />
                      </div>
                      {/* Status dot */}
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: "#6DD4A8", border: "2px solid #060A11", boxShadow: "0 0 6px #6DD4A8", animation: "pulse 2s ease-in-out infinite" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{agent.name}</p>
                        <ModelBadge modelId={agent.model} />
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font }}>{agent.description}</p>
                    </div>

                    {/* Toggle */}
                    <button onClick={() => setExpandedAgent(isExpanded ? null : agent.key)} style={{ width: 28, height: 28, borderRadius: 8, background: isExpanded ? `${agent.color}12` : "rgba(255,255,255,0.04)", border: `1px solid ${isExpanded ? agent.color + "33" : "rgba(255,255,255,0.08)"}`, color: isExpanded ? agent.color : P.txt3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s", flexShrink: 0 }}>
                      <ChevronDown size={13} strokeWidth={2.4} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.22s" }} />
                    </button>
                  </div>

                  {/* KPIs row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                    {[
                      { l: "Acciones", v: agent.kpis.calls },
                      { l: "Éxitos", v: agent.kpis.success },
                      { l: "Cola", v: agent.kpis.queue },
                      { l: "Tasa", v: agent.kpis.rate },
                    ].map((k, i) => (
                      <div key={k.l} style={{ padding: "8px 12px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: i === 3 ? agent.color : "#FFFFFF", fontFamily: fontDisp }}>{k.v}</p>
                        <p style={{ margin: 0, fontSize: 9, color: P.txt3, fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase" }}>{k.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Expanded — prompt y acciones */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${agent.color}1C`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Modelo info */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, background: `${m?.color}08`, border: `1px solid ${m?.color}1C` }}>
                        <Cpu size={12} color={m?.color} strokeWidth={2.2} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: m?.color, fontFamily: fontDisp }}>{m?.name}</p>
                          <p style={{ margin: 0, fontSize: 10, color: P.txt3, fontFamily: font }}>${m?.costIn}/M tokens entrada · ${m?.costOut}/M salida · {m?.speed}</p>
                        </div>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: m?.color, background: `${m?.color}18`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.08em", fontFamily: fontDisp }}>{m?.badge}</span>
                      </div>

                      {/* System prompt */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>System Prompt</p>
                          <CopyButton text={agent.prompt} />
                        </div>
                        <pre style={{ margin: 0, padding: "10px 12px", borderRadius: 9, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 10, color: "#A0B3C8", fontFamily: '"SF Mono","Fira Code",monospace', lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto" }}>
                          {agent.prompt}
                        </pre>
                      </div>

                      {/* CTA */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => oc(`Ejecutar ${agent.name}: revisa la cola de leads y genera las acciones correspondientes usando el protocolo del agente`)} style={{ flex: 1, padding: "9px 14px", borderRadius: 10, background: `linear-gradient(135deg, ${agent.color}22, ${agent.color}0A)`, border: `1px solid ${agent.color}44`, color: agent.color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.18s" }}
                          onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${agent.color}30, ${agent.color}14)`}
                          onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${agent.color}22, ${agent.color}0A)`}
                        >
                          <Zap size={12} strokeWidth={2.5} /> Ejecutar en Claude
                        </button>
                        <button onClick={() => oc(`Configura el agente ${agent.name}: ajusta el prompt, el modelo y los criterios de activación`)} style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: P.txt3, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: fontDisp, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFFFFF"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = P.txt3; }}
                        >
                          <Settings size={12} strokeWidth={2} /> Config
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Uso de tokens esta semana */}
          <G>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Uso de tokens — esta semana</p>
              <div style={{ display: "flex", gap: 6 }}>
                <Pill color={P.txt3} s>Sonnet: 68%</Pill>
                <Pill color="#A78BFA" s>Opus: 22%</Pill>
                <Pill color="#67E8F9" s>Haiku: 10%</Pill>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={usageData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6EE7C2" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#6EE7C2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fill: P.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "#111318", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: "#E2E8F0", fontSize: 11 }} formatter={v => [`${(v/1000).toFixed(0)}K tokens`, ""]} />
                <Area type="monotone" dataKey="tokens" stroke="#6EE7C2" strokeWidth={2} fill="url(#tokenGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </G>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: CRÉDITOS
      ══════════════════════════════════════════ */}
      {activeTab === "creditos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Balance actual */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <G>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Balance</p>
              <p style={{ margin: "0 0 2px", fontSize: 28, fontWeight: 800, color: "#6EE7C2", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>1.4M</p>
              <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font }}>tokens Claude disponibles</p>
            </G>
            <G>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Plan activo</p>
              <p style={{ margin: "0 0 2px", fontSize: 28, fontWeight: 800, color: "#A78BFA", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>Pro</p>
              <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font }}>$79/mes · Renueva 1 May</p>
            </G>
            <G>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Usado este mes</p>
              {/* Mini progress */}
              <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>612K <span style={{ fontSize: 12, fontWeight: 500, color: P.txt3 }}>/ 2M</span></p>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: "30.6%", height: "100%", background: "linear-gradient(90deg, #6EE7C2, #34D399)", borderRadius: 2 }} />
              </div>
            </G>
          </div>

          {/* Planes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Planes de Créditos Claude</p>
              <span style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>— facturación mensual, cancela cuando quieras</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {CREDIT_PLANS.map(plan => {
                const active = selectedPlan === plan.name;
                return (
                  <div key={plan.name} onClick={() => setSelectedPlan(plan.name)} style={{ borderRadius: 16, background: active ? `linear-gradient(160deg, ${plan.color}10 0%, rgba(10,14,24,0.99) 100%)` : "rgba(10,14,24,0.97)", border: `1px solid ${active ? plan.color + "50" : "rgba(255,255,255,0.07)"}`, padding: "20px", cursor: "pointer", transition: "all 0.22s", position: "relative", boxShadow: active ? `0 0 28px ${plan.color}14` : "none" }}>
                    {plan.popular && (
                      <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "#060A11", background: plan.color, padding: "3px 12px", borderRadius: "0 0 8px 8px", letterSpacing: "0.08em", fontFamily: fontDisp }}>MÁS POPULAR</div>
                    )}
                    <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: active ? plan.color : "#FFFFFF", fontFamily: fontDisp }}>{plan.name}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: active ? plan.color : "#FFFFFF", fontFamily: fontDisp, lineHeight: 1, letterSpacing: "-0.03em" }}>${plan.price}</span>
                      <span style={{ fontSize: 12, color: P.txt3, fontFamily: font }}>/mes</span>
                    </div>
                    <div style={{ fontSize: 11, color: P.txt3, fontFamily: font, marginBottom: 14 }}>
                      <span style={{ color: active ? plan.color : P.txt2, fontWeight: 700, fontFamily: fontDisp }}>{(plan.tokens / 1_000_000).toFixed(1)}M</span> tokens Claude/mes
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <CheckSquare size={11} color={active ? plan.color : P.txt3} strokeWidth={2.5} />
                          <span style={{ fontSize: 11, color: active ? P.txt : P.txt3, fontFamily: font }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); oc(`Iniciar proceso de pago para el plan ${plan.name} de Stratos AI por $${plan.price}/mes`); }}
                      style={{ width: "100%", padding: "10px", borderRadius: 10, background: active ? `linear-gradient(135deg, ${plan.color}30, ${plan.color}14)` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? plan.color + "55" : "rgba(255,255,255,0.09)"}`, color: active ? plan.color : P.txt3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.02em", transition: "all 0.18s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = active ? `linear-gradient(135deg, ${plan.color}40, ${plan.color}20)` : "rgba(255,255,255,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = active ? `linear-gradient(135deg, ${plan.color}30, ${plan.color}14)` : "rgba(255,255,255,0.04)"; }}
                    >
                      {active ? "Plan actual" : `Cambiar a ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transparencia de fee */}
          <G>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Info size={14} color={P.txt3} strokeWidth={2} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>¿Cómo funciona el modelo de precios?</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { icon: CreditCard, label: "Tú pagas a Stratos", value: "$79/mes (Plan Pro)", desc: "Acceso a la plataforma IAOS + agentes + soporte", color: "#6EE7C2" },
                { icon: Cpu, label: "Stratos paga a Anthropic", value: "~$6/mes en tokens", desc: "Consumo real de API Claude según tu uso de agentes", color: "#A78BFA" },
                { icon: Rocket, label: "Stratos retiene el margen", value: "~$73/mes", desc: "Plataforma, infraestructura, soporte y desarrollo IAOS", color: "#F59E0B" },
              ].map(item => {
                const I = item.icon;
                return (
                  <div key={item.label} style={{ padding: "14px", borderRadius: 12, background: `${item.color}06`, border: `1px solid ${item.color}18` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color}14`, border: `1px solid ${item.color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <I size={13} color={item.color} strokeWidth={2.2} />
                      </div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: P.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</p>
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: item.color, fontFamily: fontDisp }}>{item.value}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: P.txt3, fontFamily: font, lineHeight: 1.45 }}>{item.desc}</p>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 10.5, color: P.txt3, fontFamily: font, lineHeight: 1.6 }}>
              Stratos AI cumple las <span style={{ color: "#6EE7C2" }}>Políticas de Uso de Anthropic</span>. Los tokens se consumen directamente en la API de Claude — nunca almacenamos conversaciones de IA sin tu consentimiento. Puedes verificar tu consumo real en el dashboard de Anthropic en cualquier momento.
            </p>
          </G>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: CLAUDE CODE MCP
      ══════════════════════════════════════════ */}
      {activeTab === "mcp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Hero MCP */}
          <div style={{ padding: "22px 24px", borderRadius: 18, background: "linear-gradient(135deg, rgba(110,231,194,0.07) 0%, rgba(167,139,250,0.07) 100%)", border: "1px solid rgba(110,231,194,0.18)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(110,231,194,0.12)", border: "1px solid rgba(110,231,194,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Terminal size={20} color="#6EE7C2" strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Conecta Claude Code con Stratos AI</h3>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: P.txt2, fontFamily: font, lineHeight: 1.6 }}>
                  Con <strong style={{ color: "#6EE7C2" }}>Model Context Protocol (MCP)</strong>, Claude Code puede leer y actualizar tu CRM directamente desde la terminal. Pregunta a Claude sobre tus leads, mueve etapas, registra seguimientos — todo sin abrir el navegador.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Leer leads del pipeline", "Registrar seguimientos", "Ejecutar agentes IA", "Ver BANT de clientes", "Estadísticas de pipeline"].map(f => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 600, color: "#6EE7C2", background: "rgba(110,231,194,0.08)", border: "1px solid rgba(110,231,194,0.20)", padding: "3px 9px", borderRadius: 6, fontFamily: fontDisp }}>✓ {f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Setup steps */}
          <G>
            <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Configuración en 3 pasos</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                {
                  step: "1",
                  title: "Instala el servidor MCP de Stratos",
                  color: "#6EE7C2",
                  code: "npm install -g stratos-mcp-server",
                  note: "Requiere Node.js 18+. El servidor expone tu CRM como herramientas nativas para Claude.",
                },
                {
                  step: "2",
                  title: "Agrega Stratos a tu Claude Code settings",
                  color: "#A78BFA",
                  code: MCP_CONFIG,
                  note: "Archivo: ~/.claude/settings.json — o úsalo solo en este proyecto con .claude/settings.local.json",
                },
                {
                  step: "3",
                  title: "Obtén tu API Key de Stratos",
                  color: "#F59E0B",
                  code: null,
                  isKeyStep: true,
                  note: "Genera tu clave desde Configuración → API Keys. Tiene permisos limitados al CRM de tu workspace.",
                },
              ].map((s, i) => (
                <div key={s.step} style={{ display: "flex", gap: 14, paddingBottom: i < 2 ? 18 : 0, borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none", marginBottom: i < 2 ? 18 : 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, background: `${s.color}14`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: s.color, fontFamily: fontDisp }}>{s.step}</div>
                    {i < 2 && <div style={{ width: 1.5, flex: 1, background: `linear-gradient(${s.color}30, transparent)`, marginTop: 6 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{s.title}</p>
                    {s.code && (
                      <div style={{ position: "relative", marginBottom: 8 }}>
                        <pre style={{ margin: 0, padding: "10px 44px 10px 14px", borderRadius: 9, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#A0C8A8", fontFamily: '"SF Mono","Fira Code",monospace', lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {s.code}
                        </pre>
                        <div style={{ position: "absolute", top: 8, right: 8 }}>
                          <CopyButton text={s.code} />
                        </div>
                      </div>
                    )}
                    {s.isKeyStep && (
                      <button onClick={() => oc("Genera una nueva API Key de Stratos AI con permisos de CRM")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, background: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))", border: "1px solid rgba(245,158,11,0.35)", color: "#F59E0B", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, marginBottom: 8, transition: "all 0.18s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,158,11,0.24), rgba(245,158,11,0.12))"}
                        onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))"}
                      >
                        <Key size={13} strokeWidth={2.4} /> Generar API Key
                      </button>
                    )}
                    <p style={{ margin: 0, fontSize: 10.5, color: P.txt3, fontFamily: font, lineHeight: 1.55 }}>{s.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </G>

          {/* Herramientas disponibles */}
          <G>
            <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Herramientas MCP disponibles</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {MCP_TOOLS.map((t, i) => (
                <div key={t.name} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < MCP_TOOLS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#6EE7C2", background: "rgba(110,231,194,0.08)", border: "1px solid rgba(110,231,194,0.18)", padding: "3px 8px", borderRadius: 5, fontFamily: '"SF Mono","Fira Code",monospace', flexShrink: 0, marginTop: 1 }}>{t.name}</span>
                  <p style={{ margin: 0, fontSize: 11.5, color: P.txt2, fontFamily: font, lineHeight: 1.5 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </G>

          {/* Ejemplo de uso con Claude Code */}
          <G>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Ejemplo de uso desde Claude Code</p>
            <div style={{ position: "relative" }}>
              <pre style={{ margin: 0, padding: "14px 48px 14px 14px", borderRadius: 11, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#A0C8A8", fontFamily: '"SF Mono","Fira Code",monospace', lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
{`# En tu terminal, con Claude Code:
> Muéstrame los 5 leads con más días sin contacto en el CRM

Claude: [usa get_leads con filtro daysInactive desc]
→ 1. Patricia Reyes — 14d sin contacto · Zoom · $1.5M
→ 2. Laura Martínez — 14d sin contacto · Zoom · $900K
→ 3. David Chen — 7d sin contacto · Visita · $3.2M
...

> Ejecuta el agente Reactivador para Patricia Reyes

Claude: [usa run_agent con key=reactivador y lead=patriciaReyes]
→ Generando mensaje personalizado...
→ "Patricia, la unidad que te interesó en Gobernador 28
   tiene otro interesado activo. ¿Podemos hablar hoy
   para asegurar tu opción antes de que avance?"
→ ¿Enviarlo por WhatsApp? (requiere confirmación)`}
              </pre>
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <CopyButton text="claude --mcp stratos-ai 'Muéstrame los leads con más días sin contacto'" />
              </div>
            </div>
          </G>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: TRANSPARENCIA / COMPLIANCE
      ══════════════════════════════════════════ */}
      {activeTab === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Anthropic badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", borderRadius: 16, background: "linear-gradient(135deg, rgba(110,231,194,0.06) 0%, rgba(167,139,250,0.06) 100%)", border: "1px solid rgba(110,231,194,0.20)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: "rgba(110,231,194,0.10)", border: "1px solid rgba(110,231,194,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield size={22} color="#6EE7C2" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Powered by Claude · Anthropic</p>
              <p style={{ margin: 0, fontSize: 11.5, color: P.txt2, fontFamily: font, lineHeight: 1.6 }}>
                Stratos AI usa la API oficial de Claude de Anthropic. Cumplimos las <a href="https://www.anthropic.com/usage-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#6EE7C2", textDecoration: "none" }}>Políticas de Uso de Anthropic</a> y los <a href="https://www.anthropic.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#6EE7C2", textDecoration: "none" }}>Términos de Servicio</a>.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(110,231,194,0.08)", border: "1px solid rgba(110,231,194,0.22)" }}>
              <CheckCircle2 size={14} color="#6EE7C2" strokeWidth={2.2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6EE7C2", fontFamily: fontDisp }}>Compliant</span>
            </div>
          </div>

          {/* Políticas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              {
                icon: CheckSquare, color: "#6EE7C2", title: "Uso permitido por Anthropic",
                items: [
                  "Plataforma SaaS que usa Claude como motor IA ✓",
                  "Cobrar por acceso a la plataforma (no por tokens raw) ✓",
                  "Agregar valor real sobre la API (IAOS, agentes, CRM) ✓",
                  "Atribución correcta: 'Powered by Claude' ✓",
                  "Usuarios interactúan con Stratos AI, no directamente con Anthropic ✓",
                ],
              },
              {
                icon: AlertCircle, color: "#F87171", title: "Restricciones aplicadas",
                items: [
                  "No llamamos 'Claude' a Stratos AI — somos Stratos AI ✓",
                  "No revendemos acceso raw a la API — solo a través de la plataforma ✓",
                  "No prometemos capacidades que Claude no tiene ✓",
                  "No generamos contenido que viole la Usage Policy de Anthropic ✓",
                  "No almacenamos conversaciones de IA sin consentimiento ✓",
                ],
              },
            ].map(section => {
              const I = section.icon;
              return (
                <G key={section.title}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <I size={14} color={section.color} strokeWidth={2.2} />
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{section.title}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {section.items.map(item => (
                      <p key={item} style={{ margin: 0, fontSize: 11, color: P.txt2, fontFamily: font, lineHeight: 1.5, paddingLeft: 4 }}>{item}</p>
                    ))}
                  </div>
                </G>
              );
            })}
          </div>

          {/* Modelo de negocio transparente */}
          <G>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <DollarSign size={14} color="#F59E0B" strokeWidth={2.2} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Modelo de negocio — 100% transparente</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "¿Qué pagas realmente?", text: "Pagas por acceso a la plataforma Stratos AI (CRM IAOS, agentes, analytics, soporte). Los tokens Claude son un componente del costo de operación." },
                { label: "¿Quién paga a Anthropic?", text: "Stratos AI (Ivan Rodriguez Ruelas) paga directamente a Anthropic por el uso de la API de Claude. Tú nunca interactúas financieramente con Anthropic." },
                { label: "¿Cómo se calcula el margen?", text: "Stratos cobra la plataforma completa. Del total, una fracción cubre el costo real de tokens Claude en Anthropic. El resto financia infraestructura, desarrollo, soporte y mejoras continuas del IAOS." },
                { label: "¿Puedo llevar mi propia API key?", text: "Plan Business incluye la opción de conectar tu propia API key de Anthropic. En ese caso el costo de tokens va directo a tu cuenta Anthropic, y Stratos cobra solo la plataforma." },
              ].map(item => (
                <div key={item.label} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: P.txt3, fontFamily: font, lineHeight: 1.55 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </G>

          {/* Links oficiales */}
          <G>
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontDisp }}>Recursos oficiales de Anthropic</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "Políticas de Uso", url: "https://www.anthropic.com/usage-policy" },
                { label: "Términos de Servicio", url: "https://www.anthropic.com/terms" },
                { label: "Privacidad", url: "https://www.anthropic.com/privacy" },
                { label: "Documentación API", url: "https://docs.anthropic.com" },
                { label: "Modelos Claude", url: "https://www.anthropic.com/claude" },
              ].map(link => (
                <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: P.txt3, fontSize: 11, fontWeight: 600, fontFamily: fontDisp, textDecoration: "none", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(110,231,194,0.08)"; e.currentTarget.style.borderColor = "rgba(110,231,194,0.22)"; e.currentTarget.style.color = "#6EE7C2"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = P.txt3; }}
                >
                  <ExternalLink size={10} strokeWidth={2} />
                  {link.label}
                </a>
              ))}
            </div>
          </G>
        </div>
      )}

      {/* ── FOOTER ATTRIBUTION ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Atom size={12} color="#6EE7C2" strokeWidth={1.8} />
          <span style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>
            <strong style={{ color: P.txt2 }}>Stratos AI</strong> · Powered by{" "}
            <a href="https://www.anthropic.com/claude" target="_blank" rel="noopener noreferrer" style={{ color: "#6EE7C2", textDecoration: "none", fontWeight: 600 }}>Claude</a>
            {" "}· Made by Anthropic
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>Modelos activos:</span>
          {CLAUDE_MODELS.map(m => (
            <span key={m.id} style={{ fontSize: 9, fontWeight: 700, color: m.color, background: `${m.color}10`, border: `1px solid ${m.color}22`, padding: "2px 7px", borderRadius: 4, fontFamily: '"SF Mono","Fira Code",monospace' }}>{m.id}</span>
          ))}
        </div>
      </div>

    </div>
  );
};

export default IACRM;
