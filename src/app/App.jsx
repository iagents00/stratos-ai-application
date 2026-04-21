import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import LoginScreen from "../landing/LoginScreen.jsx";
import PricingScreen from "../landing/PricingScreen.jsx";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { useLeads } from "../hooks/useLeads";
import { useProperties } from "../hooks/useProperties";
import { useTeam } from "../hooks/useTeam";
import { supabase } from "../lib/supabase";




import { adminGetAllUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetPassword } from "../lib/auth";
import {
  TrendingUp, Target, ArrowUpRight, ArrowRight, CheckCircle2, Mic, Search,
  Users, Building2, MapPin, Send, Plus, Timer, Flame, Crown,
  Trophy, Gauge, Bell, Filter, User, DollarSign, Zap, Phone,
  CalendarDays, FileText, Briefcase, ChevronRight, Lightbulb,
  Settings, X, Mic2, MicOff, Atom, Orbit, Hexagon, Crosshair,
  BarChart3, Activity, Clock, Wallet, Eye, MessageCircle,
  Star, Radar, Signal, Waypoints, ScanLine, CircuitBoard,
  Workflow, Shield, Aperture, Focus, Locate, Scan,
  AlertCircle, TrendingDown, Home, Hammer, FileCheck,
  LayoutGrid, AlertTriangle, CheckSquare,
  Banknote, Percent, Calendar, MapPinOff,
  Globe, Palmtree, Waves, Wand2, Image,
  Download, ExternalLink, Copy, Check, Trash2,
  ChevronDown, ChevronUp, Heart, Share2, Maximize2,
  Receipt, CreditCard, BookOpen, PiggyBank, ArrowDownLeft,
  ClipboardList, FilePlus, RefreshCw, BadgeCheck, ListChecks,
  Landmark, Scale, Calculator,
  UserCheck, Sparkles, List, SlidersHorizontal
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import "./App.css";

/* ════════════════════════════════════════
   DESIGN SYSTEM
   ════════════════════════════════════════ */
const P = {
  bg: "#060A11", glass: "rgba(255,255,255,0.035)",
  glassH: "rgba(255,255,255,0.055)", border: "rgba(255,255,255,0.07)",
  borderH: "rgba(255,255,255,0.12)", surface: "#0C1219",
  accent: "#6EE7C2", accentS: "rgba(110,231,194,0.08)",
  accentB: "rgba(110,231,194,0.14)", blue: "#7EB8F0",
  violet: "#A78BFA", amber: "#67B7D1", rose: "#9B8EFF",
  emerald: "#6DD4A8", cyan: "#5DC8D9",
  txt: "#E2E8F0", txt2: "#8B99AE", txt3: "#4A5568",
  r: 16, rs: 10, rx: 6,
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const fontDisp = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

/* Minimalist Stratos Logo */
const StratosAtom = ({ size = 20, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.2" opacity="0.3" />
    <circle cx="16" cy="16" r="4" stroke={color} strokeWidth="1.2" opacity="0.6" />
    <circle cx="16" cy="16" r="1.5" fill={color} />
  </svg>
);

/* Agent icons */
const AgentIcons = {
  gerente: Crosshair,
  asistente: Waypoints,
  analista: Radar,
};

/* ════════════════════════════════════════
   SHARED COMPONENTS
   ════════════════════════════════════════ */
const G = ({ children, style, hover, onClick, np }) => {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => setH(false)}
      onClick={onClick} style={{
        background: h ? P.glassH : P.glass,
        backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
        border: `1px solid ${h ? P.borderH : P.border}`,
        borderRadius: P.r, padding: np ? 0 : 18,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)", ...style,
      }}>{children}</div>
  );
};

const Pill = ({ children, color = P.accent, s }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: s ? "2px 8px" : "4px 11px", borderRadius: 99,
    fontSize: s ? 10 : 11, fontWeight: 600, color,
    background: `${color}12`, border: `1px solid ${color}1A`,
    letterSpacing: "0.02em", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Ico = ({ icon: I, sz = 34, is = 16, c = P.accent }) => (
  <div style={{
    width: sz, height: sz, borderRadius: sz > 32 ? 12 : 8, flexShrink: 0,
    background: `${c}0F`, border: `1px solid ${c}1A`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}><I size={is} color={c} /></div>
);

const KPI = ({ label, value, sub, icon, color = P.accent }) => (
  <G hover style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
      <p style={{ fontSize: 13, color: P.txt2, marginBottom: 8, letterSpacing: "0.01em", fontWeight: 400, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1, fontFamily: fontDisp }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: P.emerald, marginTop: 10, display: "flex", alignItems: "center", gap: 3, fontWeight: 500 }}><ArrowUpRight size={12} />{sub}</p>}
    </div>
    <Ico icon={icon} color={color} />
  </G>
);

/* ════════════════════════════════════════
   DYNAMIC ISLAND
   ════════════════════════════════════════ */
const DynIsland = ({ onExpand, notifications = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const msgs = notifications.length > 0 ? notifications : [
    { agent: "Agente Estratégico", text: "Optimización de cierre: Familia Rodríguez.", detail: "Probabilidad de cierre detectada al 92%. Dossier de alta fidelidad preparado para envío inmediato.", c: P.blue, icon: AgentIcons.gerente, btn: "Ejecutar Protocolo", action: "¿Cuáles son mis leads prioritarios hoy?" },
    { agent: "Inteligencia de Datos", text: "Alerta de Mercado: Portofino +32%.", detail: "Demanda inusual detectada. Análisis predictivo recomienda ajuste de precios para maximizar rendimientos.", c: P.emerald, icon: AgentIcons.analista, btn: "Validar Ajuste", action: "Reporte de Riesgo: Portofino" },
    { agent: "Equipo Stratos", text: "Actividad del Equipo: Cecilia y Alexia.", detail: "Cecilia Mendoza cerró venta de $2.1M. Alexia Santillán tiene 3 visitas VIP confirmadas para hoy.", c: P.violet, icon: Crown, btn: "Ver Reporte", action: "Resumen de rendimiento del equipo esta semana" },
    { agent: "Agente de Ventas", text: "Alerta de Riesgo: James Mitchell.", detail: "Inactividad detectada en últimas 72h. Se recomienda activar protocolo de confianza para evitar enfriamiento.", c: P.rose, icon: AgentIcons.asistente, btn: "Enviar Avance", action: "Dossier: James Mitchell" },
  ];

  const expanded = isOpen || selectedNotif;

  return (
    <>
      {/* Collapsed pill */}
      <div
        onClick={() => !selectedNotif && !isOpen && setIsOpen(true)}
        style={{
          position: "relative",
          height: 38, width: 220, borderRadius: 50,
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%), #000000",
          border: "0.5px solid rgba(255,255,255,0.12)",
          display: expanded ? "none" : "flex", alignItems: "center", justifyContent: "center",
          padding: "0 14px", gap: 8, overflow: "hidden",
          cursor: "pointer",
        }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit", overflow: "hidden"
        }}>
          <div style={{
            position: "absolute", top: -20, left: -20, width: 40, height: 40,
            borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 75%)",
            filter: "blur(10px)",
            offsetPath: "path('M 19 0 H 201 A 19 19 0 0 1 201 38 H 19 A 19 19 0 0 1 19 0 Z')",
            animation: "orbitSmart 7s cubic-bezier(0.19, 1, 0.22, 1) infinite, orbitColor 7s linear infinite"
          }} />
          <div style={{
            position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)",
            animation: "shine 6s ease-in-out infinite"
          }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
          <div style={{ filter: `drop-shadow(0 0 4px ${P.accent}44)`, display: "flex" }}>
            <StratosAtom size={16} color={P.accent} />
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 500, letterSpacing: "-0.01em", fontFamily: fontDisp }}>Centro de Inteligencia</span>
        </div>
      </div>

      {/* Expanded state */}
      {expanded && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 99998 }} onClick={() => { setIsOpen(false); setSelectedNotif(null); }} />
          <div style={{
            position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
            width: selectedNotif ? 540 : 500,
            borderRadius: selectedNotif ? 20 : 22,
            background: selectedNotif ? `radial-gradient(ellipse at top, ${selectedNotif.c}14 0%, #000000 80%)` : "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%), #000000",
            border: "0.5px solid rgba(255,255,255,0.12)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.7)",
            overflow: "hidden",
            animation: "fadeIn 0.25s ease",
          }}>
            {isOpen && !selectedNotif && (
              <div style={{ padding: "16px 0" }}>
                <div style={{ padding: "0 24px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: P.txt3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Centro de Inteligencia — Activo</span>
                  <button onClick={() => { setIsOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: P.txt2, display: "flex", alignItems: "center" }}><X size={14} /></button>
                </div>
                {msgs.map((m, i) => (
                  <div key={i} onClick={() => setSelectedNotif(m)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 24px", borderTop: `1px solid rgba(255,255,255,0.05)`, transition: "all 0.2s", cursor: "pointer" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${m.c}14`, border: `1px solid ${m.c}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <m.icon size={16} color={m.c} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, fontFamily: fontDisp, marginBottom: 2 }}>{m.agent}</p>
                      <p style={{ fontSize: 12, color: P.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: font }}>{m.text}</p>
                    </div>
                    <ChevronRight size={14} color={P.txt3} />
                  </div>
                ))}

              </div>
            )}

            {selectedNotif && (
              <div style={{ padding: 20, animation: "fadeIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${selectedNotif.c}1A`, border: `1px solid ${selectedNotif.c}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <selectedNotif.icon size={16} color={selectedNotif.c} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 600, fontFamily: fontDisp }}>{selectedNotif.agent}</p>
                    <p style={{ fontSize: 11, color: P.txt2 }}>Actualización Importante</p>
                  </div>
                  <button onClick={() => setSelectedNotif(null)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#FFF", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                </div>
                <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.6, fontFamily: font, marginBottom: 18 }}>{selectedNotif.detail}</p>
                <button onClick={() => { onExpand(selectedNotif.action); setIsOpen(false); setSelectedNotif(null); }}
                  style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,0.95)", color: "#0A0F18", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, boxShadow: "0 4px 15px rgba(255,255,255,0.15)", letterSpacing: "0.01em", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.boxShadow = "0 6px 25px rgba(255,255,255,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.boxShadow = "0 4px 15px rgba(255,255,255,0.15)"; }}
                >{selectedNotif.btn}</button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

/* ════════════════════════════════════════
   DATA
   ════════════════════════════════════════ */
const revenue = [
  { m: "Ene", v: 4.2 }, { m: "Feb", v: 5.1 }, { m: "Mar", v: 4.8 },
  { m: "Abr", v: 6.3 }, { m: "May", v: 7.1 }, { m: "Jun", v: 8.4 },
];
const pipe = [
  { name: "Prospecto", val: 34, c: "#7EB8F0" },
  { name: "Visita", val: 18, c: "#A78BFA" },
  { name: "Negociación", val: 12, c: "#67B7D1" },
  { name: "Cierre", val: 6, c: "#6DD4A8" },
];
/* ─────────────────────────────────────────
   PIPELINE STAGES
───────────────────────────────────────── */
const STAGES = [
  "Nuevo Registro", "Primer Contacto", "Seguimiento",
  "Zoom Agendado", "Zoom Concretado",
  "Visita Agendada", "Visita Concretada",
  "Negociación", "Cierre", "Perdido",
];

const stgC = {
  "Nuevo Registro":     "#64748B",   // gris slate    — lead recién llegado
  "Primer Contacto":    "#7EB8F0",   // azul suave    — iniciando conversación
  "Seguimiento":        "#67B7D1",   // cyan-azul      — en proceso
  "Zoom Agendado":      "#818CF8",   // índigo         — cita en calendario
  "Zoom Concretado":    "#4ADE80",   // verde lima     — reunión exitosa ✓
  "Visita Agendada":    "#F59E0B",   // ámbar dorado   — visita próxima
  "Visita Concretada":  "#6EE7C2",   // menta          — visita realizada ✓
  "Negociación":        "#FB923C",   // naranja        — en negociación activa
  "Cierre":             "#34D399",   // verde esmeralda— ¡cerrando!
  "Perdido":            "#9B8EFF",   // violeta suave  — perdido
};

/* ─────────────────────────────────────────
   CRM LEADS DATA  (schema: fecha ingreso, asesor, nombre, tel, estatus,
   presupuesto, proyecto, notas, campaña)
───────────────────────────────────────── */
const MOCK_LEADS = [
  {
    id: 1,
    fechaIngreso: "2 Abr, 12:07pm",
    asesor: "Estefanía Valdes",
    n: "Rafael",
    tag: "Inversión + Disfrute",
    phone: "+1 817 682 3272",
    email: "",
    st: "Zoom Concretado",
    budget: "$200K USD",
    presupuesto: 200000,
    p: "Torre 25 · BAGA · Kaab On The Beach",
    campana: "Cancún",
    sc: 72,
    hot: false,
    isNew: true,
    bio: "Mexicano radicado en Texas. Busca inversión + disfrute en Playa del Carmen. Perfil decisor — toma consejos de su esposa pero él decide. Ya ha invertido en otros mercados. Conoce Cancún y zona hotelera, no Tulum.",
    risk: "Ya evaluó Amares sin cerrar. Requiere propiedad construida y céntrica. Viaje a Riviera Maya programado para el 4 de julio.",
    friction: "Medio",
    nextAction: "Enviar videos de las propiedades + comparativo Torre 25 vs BAGA vs Kaab",
    nextActionDate: "Esta semana",
    lastActivity: "Zoom concretado — 9 de Abril 6pm",
    daysInactive: 9,
    notas: `OBJETIVO
Inversión y disfrute personal. Playa del Carmen como destino principal.

PRESUPUESTO
$200K USD · Entrega inmediata.
Puede extender presupuesto con financiamiento de desarrollador o crédito hipotecario — planea hipotecar su casa en Texas.

PERFIL DEL CLIENTE
Mexicano viviendo en Texas. Ya evaluó Amares pero no le gustó. Busca algo ya construido y más céntrico. Viaja el 4 de julio a Riviera Maya. Conoce Cancún y la zona hotelera; no conoce Tulum. Toma consejos de su esposa pero él decide. Ya tiene inversiones en otros mercados. Actualmente en Guerrero por temas personales.

HISTORIAL DE CONTACTO
• Sáb 4 Abr — Cita presencial en Guerrero 10am / PDC 11am
• Reagendado → Jue 9 Abr 6pm
• Zoom concretado el 9 de Abril

PENDIENTE
Sacar y enviar videos de las propiedades de interés (Torre 25, BAGA, Kaab On The Beach).`,
  },
  {
    id: 2,
    fechaIngreso: "28 Mar, 9:15am",
    asesor: "Ken Lugo Ríos",
    n: "Fam. Rodríguez",
    tag: "Penthouse Élite",
    phone: "+52 984 123 0001",
    email: "familia@rodriguez.com",
    st: "Negociación",
    budget: "$4.2M USD",
    presupuesto: 4200000,
    p: "Gobernador 28",
    campana: "Referido",
    sc: 92,
    hot: true,
    isNew: false,
    bio: "Familia inversionista buscando propiedades premium para crecimiento patrimonial. Alto potencial de referidos.",
    risk: "Costos notariales pendientes de confirmar con banco.",
    friction: "Bajo",
    nextAction: "Enviar expediente a notaría y confirmar fecha de firma",
    nextActionDate: "Hoy",
    lastActivity: "Visita al penthouse — reacción muy positiva",
    daysInactive: 2,
    notas: `OBJETIVO
Crecimiento patrimonial. Penthouse de lujo como activo principal.

PRESUPUESTO
$4.2M USD · Financiamiento propio confirmado.

PERFIL DEL CLIENTE
Familia con historial de inversión inmobiliaria. Muy orientados a calidad y exclusividad. Alto potencial de referidos dentro de su red.

HISTORIAL DE CONTACTO
• Primera visita al penthouse — excelente reacción
• Propuesta enviada y revisada
• En etapa activa de negociación de condiciones

PENDIENTE
Conectar con notaría aliada. Confirmar costos notariales con el banco. Preparar expediente de cierre.`,
  },
  {
    id: 3,
    fechaIngreso: "30 Mar, 11:00am",
    asesor: "Emmanuel Ortiz",
    n: "James Mitchell",
    tag: "CEO · Tecnología",
    phone: "+1 310 555 0002",
    email: "james@mitchell.co",
    st: "Zoom Agendado",
    budget: "$2.8M USD",
    presupuesto: 2800000,
    p: "Monarca 28",
    campana: "LinkedIn",
    sc: 85,
    hot: true,
    isNew: true,
    bio: "Director de empresa de tecnología. Busca diversificar patrimonio. Muy analítico, basa decisiones en datos y proyecciones.",
    risk: "Solicita garantías de construcción y avances de obra documentados.",
    friction: "Bajo",
    nextAction: "Zoom mañana 10:00am — presentar avances de obra y proyección ROI a 3 años",
    nextActionDate: "Mañana 10:00am",
    lastActivity: "Llamada 25 min — muy interesado en ROI",
    daysInactive: 3,
    notas: `OBJETIVO
Diversificación patrimonial. Busca activos de alto ROI con respaldo constructivo sólido.

PRESUPUESTO
$2.8M USD · Capital propio disponible.

PERFIL DEL CLIENTE
CEO de empresa tecnológica. Perfil analítico — necesita datos, no emoción. Valora la transparencia en avances de obra y proyecciones financieras reales.

HISTORIAL DE CONTACTO
• Primer contacto vía LinkedIn
• Llamada de 25 min — alto interés en ROI y garantías
• Zoom agendado

PENDIENTE
Preparar reporte de avance de obra actualizado + proyección ROI a 3 años antes del zoom.`,
  },
  {
    id: 4,
    fechaIngreso: "1 Abr, 3:30pm",
    asesor: "Araceli Oneto",
    n: "Sarah Williams",
    tag: "Inversionista Internacional",
    phone: "+44 20 7946 0004",
    email: "sarah@williams-capital.com",
    st: "Seguimiento",
    budget: "$3.1M USD",
    presupuesto: 3100000,
    p: "Gobernador 28",
    campana: "Facebook Ads",
    sc: 65,
    hot: false,
    isNew: true,
    bio: "Analista de bienes raíces de Londres. Muy detallista con números y comparativas de rendimiento por zona.",
    risk: "Compara activamente con otras zonas de la Riviera Maya. Alta exigencia documental.",
    friction: "Alto",
    nextAction: "Enviar comparativo Riviera Maya vs Cancún + llamar hoy 5pm",
    nextActionDate: "Hoy 5:00pm",
    lastActivity: "Visitó proyecto — solicitó comparativas de zona",
    daysInactive: 8,
    notas: `OBJETIVO
Inversión de portafolio con criterio internacional. Busca rendimientos superiores al mercado londinense.

PRESUPUESTO
$3.1M USD · Capital de inversión institucional.

PERFIL DEL CLIENTE
Analista de bienes raíces con base en Londres. Muy detallista y comparativa. Exige documentación completa y comparativas por zona antes de tomar cualquier decisión.

HISTORIAL DE CONTACTO
• Contacto vía Facebook Ads
• Visita al proyecto — buena reacción inicial
• Solicitó comparativo de rendimientos por zona

PENDIENTE
Enviar comparativo detallado: Riviera Maya vs Cancún vs CDMX. Llamar hoy 5pm para resolver dudas.`,
  },
  {
    id: 5,
    fechaIngreso: "25 Mar, 2:00pm",
    asesor: "Emmanuel Ortiz",
    n: "Tony Norberto",
    tag: "Inversionista VIP",
    phone: "+52 998 555 0006",
    email: "tony.norberto@inv.com",
    st: "Zoom Concretado",
    budget: "$5.1M USD",
    presupuesto: 5100000,
    p: "Portofino",
    campana: "Referido VIP",
    sc: 88,
    hot: true,
    isNew: false,
    bio: "Empresario con portafolio diversificado. Busca activo de alta liquidez en zona costera premium.",
    risk: "Evalúa otra propiedad en paralelo. Plazo de decisión muy corto.",
    friction: "Medio",
    nextAction: "Enviar propuesta formal con condiciones de pago + carta de exclusividad",
    nextActionDate: "Hoy",
    lastActivity: "Zoom concretado — confirmó alto interés en Portofino",
    daysInactive: 1,
    notas: `OBJETIVO
Alta liquidez y plusvalía en zona costera premium. Portafolio de inversión diversificado.

PRESUPUESTO
$5.1M USD · Capital disponible inmediato.

PERFIL DEL CLIENTE
Empresario experimentado. Portafolio diversificado en distintos mercados. Evalúa decisiones rápido pero requiere condiciones claras y exclusividad.

HISTORIAL DE CONTACTO
• Referido VIP directo
• Zoom concretado — alto interés confirmado en Portofino

PENDIENTE
Enviar propuesta formal con condiciones de pago. Carta de exclusividad de unidad. Actúa rápido o pierde a otro comprador.`,
  },
  {
    id: 6,
    fechaIngreso: "3 Abr, 10:00am",
    asesor: "Araceli Oneto",
    n: "Daniela Vega",
    tag: "Nuevo Registro",
    phone: "+52 984 555 0007",
    email: "dra.vega@clinica.com",
    st: "Seguimiento",
    budget: "$2.2M USD",
    presupuesto: 2200000,
    p: "Gobernador 28",
    campana: "Referido",
    sc: 55,
    hot: false,
    isNew: true,
    bio: "Médica especialista. Primera inversión inmobiliaria. Alto poder adquisitivo, poco conocimiento del sector.",
    risk: "Necesita educación sobre el proceso de compra y retorno real antes de decidir.",
    friction: "Medio",
    nextAction: "Enviar guía de inversión + llamar mañana para explicar el proceso",
    nextActionDate: "Mañana",
    lastActivity: "Registro web — referida por Fam. Rodríguez",
    daysInactive: 1,
    notas: `OBJETIVO
Primera inversión inmobiliaria. Busca seguridad y crecimiento patrimonial.

PRESUPUESTO
$2.2M USD · Recursos propios disponibles.

PERFIL DEL CLIENTE
Médica especialista. Ingresos altos pero sin experiencia en bienes raíces. Requiere acompañamiento y educación en el proceso. Referida directamente por Fam. Rodríguez.

HISTORIAL DE CONTACTO
• Registro vía formulario web
• Referida por Fam. Rodríguez — contacto cálido

PENDIENTE
Enviar guía personalizada de inversión inmobiliaria. Llamar mañana para resolver dudas sobre el proceso de compra.`,
  },
  {
    id: 7,
    fechaIngreso: "3 Abr, 4:45pm",
    asesor: "Cecilia Mendoza",
    n: "Marco Aurelio",
    tag: "Nuevo Registro",
    phone: "+52 998 555 0008",
    email: "marco.aurelio@arqui.mx",
    st: "Primer Contacto",
    budget: "$1.5M USD",
    presupuesto: 1500000,
    p: "Monarca 28",
    campana: "Google Ads",
    sc: 62,
    hot: false,
    isNew: true,
    bio: "Arquitecto independiente. Perfil técnico, valora calidad constructiva. Busca primera inversión inmobiliaria.",
    risk: "Quiere inspección técnica detallada de la obra antes de comprometerse.",
    friction: "Bajo",
    nextAction: "Confirmar tour técnico de obra — jueves 9:00am con ingeniero residente",
    nextActionDate: "Jueves 9:00am",
    lastActivity: "Registro web — preguntó por especificaciones técnicas de construcción",
    daysInactive: 0,
    notas: `OBJETIVO
Inversión con alta calidad constructiva. Como arquitecto, evalúa técnicamente la obra.

PRESUPUESTO
$1.5M USD · Recursos propios.

PERFIL DEL CLIENTE
Arquitecto independiente. Muy técnico — evalúa especificaciones, materiales y procesos constructivos. Baja fricción porque entiende el sector, pero requiere validación técnica antes de comprometerse.

HISTORIAL DE CONTACTO
• Registro vía Google Ads
• Preguntó específicamente por especificaciones técnicas de construcción

PENDIENTE
Confirmar tour técnico de obra con el ingeniero residente para el jueves 9:00am. Preparar dossier técnico con especificaciones.`,
  },
  {
    id: 8,
    fechaIngreso: "20 Mar, 8:30am",
    asesor: "Oscar Gálvez",
    n: "Carlos Slim Jr.",
    tag: "Gran Inversionista",
    phone: "+52 55 555 0003",
    email: "csj@grupofinanciero.com",
    st: "Seguimiento",
    budget: "$6.5M USD",
    presupuesto: 6500000,
    p: "Portofino",
    campana: "Evento VIP",
    sc: 78,
    hot: false,
    isNew: false,
    bio: "Inversionista de alto perfil. Busca proteger capital con propiedades de lujo a largo plazo. Portafolio diversificado.",
    risk: "Necesita proyección financiera a 10 años antes de comprometerse.",
    friction: "Medio",
    nextAction: "Enviar proyección financiera a 10 años y proponer sesión ejecutiva",
    nextActionDate: "Esta semana",
    lastActivity: "Reunión inicial en evento VIP — intrigado por rendimientos",
    daysInactive: 5,
    notas: `OBJETIVO
Protección de capital a largo plazo. Activo de lujo en destino premium.

PRESUPUESTO
$6.5M USD · Capacidad de inversión amplia.

PERFIL DEL CLIENTE
Inversionista de alto perfil con portafolio diversificado. Tomador de decisiones lento pero con alto poder de cierre. Requiere proyecciones financieras sólidas.

HISTORIAL DE CONTACTO
• Contacto en evento VIP exclusivo
• Reunión inicial — interés en rendimientos a largo plazo

PENDIENTE
Preparar proyección financiera a 10 años. Proponer sesión ejecutiva con Director de Arquitectura y CEO.`,
  },
];
const MOCK_PROPS = [
  { n: "Gobernador 28", u: 48, s: 31, roi: "24%", pr: "$280K–$1.2M", loc: "Playa del Carmen", st: "Pre-venta", c: P.blue },
  { n: "Monarca 28", u: 72, s: 45, roi: "19%", pr: "$180K–$650K", loc: "Playa del Carmen", st: "Construcción", c: P.amber },
  { n: "Portofino", u: 36, s: 12, roi: "32%", pr: "$520K–$2.1M", loc: "Puerto Aventuras", st: "Lanzamiento", c: P.emerald },
];
const MOCK_TEAM = [
  { n: "Oscar Gálvez",      r: "CEO Ejecutivo",          d: 28, rv: "$24.8M", e: 98, sk: 12, role: "CEO",       c: P.violet,  wa: "+52 998 000 0001", cal: "" },
  { n: "Emmanuel Ortiz",    r: "Director de Ventas",     d: 14, rv: "$12.4M", e: 94, sk: 9,  role: "Directivo", c: P.blue,    wa: "+52 998 000 0002", cal: "" },
  { n: "Alexia Santillán",  r: "Directora Administrativa",d:14, rv: "$11.2M", e: 91, sk: 8,  role: "Directiva", c: P.emerald, wa: "+52 998 000 0003", cal: "" },
  { n: "Alex Velázquez",    r: "Director de Marketing",  d: 12, rv: "$9.8M",  e: 89, sk: 7,  role: "Directivo", c: P.amber,   wa: "+52 998 000 0004", cal: "" },
  { n: "Ken Lugo Ríos",     r: "Asesor Senior",          d: 11, rv: "$8.7M",  e: 88, sk: 6,  role: "Directivo", c: P.cyan,    wa: "+52 998 000 0005", cal: "" },
  { n: "Araceli Oneto",     r: "Asesora Especialista",   d: 10, rv: "$7.5M",  e: 85, sk: 5,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0006", cal: "" },
  { n: "Cecilia Mendoza",   r: "Asesora Premium",        d: 10, rv: "$7.2M",  e: 83, sk: 4,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0007", cal: "" },
  { n: "Estefanía Valdes",  r: "Asesora Premium",        d: 9,  rv: "$6.8M",  e: 82, sk: 4,  role: "Asesor",    c: P.accent,  wa: "+52 998 000 0008", cal: "" },
];

/* ════════════════════════════════════════
   CHAT SYSTEM
   ════════════════════════════════════════ */
const examples = [
  { t: "Acabo de visitar Gobernador con la Fam. Rodríguez, les encantó el penthouse", i: Mic2, cat: "Actualizar CRM" },
  { t: "¿Cuáles son mis leads prioritarios hoy?", i: Target, cat: "Análisis 80/20" },
  { t: "Agenda llamada con James Mitchell mañana 10am", i: CalendarDays, cat: "Crear tarea" },
  { t: "Resumen de rendimiento del equipo esta semana", i: Trophy, cat: "Reporte" },
  { t: "¿Cuántas unidades quedan en Portofino?", i: Building2, cat: "Inventario" },
  { t: "Genera propuesta para Carlos Slim Jr.", i: FileText, cat: "Documento" },
];

const responses = {
  macro_erp: {
    content: "Escaneo de mercado completado. El **Modelo de Absorción** muestra un despunte comercial:",
    metrics: [
      { label: "Ritmo de Ventas", val: "Supera en 14.2% la media histórica proyectada.", i: TrendingUp, c: P.emerald },
      { label: "Demanda Premium", val: "Las unidades de mayor valor concentran el 82% de interés.", i: Target, c: P.blue },
      { label: "Acción Recomendada", val: "Redirigir inversión publicitaria al segmento de alto valor.", i: Zap, c: P.amber }
    ],
    follow: "Implementar esta estrategia acelerará las ventas. ¿Deseas que reajuste el presupuesto automáticamente?"
  },
  macro_autorizar: {
    content: "Validación de mercado completada con datos en tiempo real.",
    metrics: [
      { label: "Capacidad del Mercado", val: "La demanda actual soporta un alza de precios del 5%.", i: Activity, c: P.blue },
      { label: "Beneficio Estimado", val: "Generará $950,000 adicionales en los próximos 3 meses.", i: DollarSign, c: P.emerald },
      { label: "Riesgo de No Actuar", val: "Se perdería posicionamiento frente a la competencia.", i: Shield, c: P.rose }
    ],
    follow: "Ajuste de precios dinámicos preparado. ¿Autorizas la actualización en todos los canales de venta?"
  },
  macro_cierre: {
    content: "**Protocolo de Cierre** ejecutado exitosamente:",
    metrics: [
      { label: "Documentación Financiera", val: "Expediente generado y protegido digitalmente.", i: Shield, c: P.blue },
      { label: "Carta de Intención", val: "Borrador legal listo con beneficios fiscales incluidos.", i: FileText, c: P.emerald },
      { label: "Asistente de Cierre", val: "Preparado para resolver cualquier duda del cliente.", i: Mic2, c: P.amber }
    ],
    follow: "Documentación lista y protegida. ¿Envío el expediente al cliente por WhatsApp?"
  },
  crm_update: {
    content: "La visita y seguimiento de la **Familia Rodríguez** ha sido registrada:",
    metrics: [
      { label: "Probabilidad de Cierre", val: "Recalculada al 92% — avance positivo confirmado.", i: TrendingUp, c: P.emerald },
      { label: "Valor del Proyecto", val: "El monto total del proyecto aumentó un 45%.", i: BarChart3, c: P.blue },
      { label: "Ahorro de Tiempo", val: "Datos sincronizados automáticamente. Ahorro: 35 minutos.", i: Timer, c: P.violet }
    ],
    follow: "¿Quieres que prepare un borrador de contrato para avanzar más rápido?",
    btn: "Preparar Contrato",
    action: "Generar borrador de contrato para Rodríguez"
  },
  default: {
    content: "Recibí tu mensaje. Para generar un análisis preciso, necesito un poco más de contexto:",
    metrics: [
      { label: "Nombre del Cliente", val: "Indica el nombre del cliente a analizar (ej. 'Familia Rodríguez').", i: User, c: P.blue },
      { label: "Proyecto o Desarrollo", val: "Especifica el desarrollo a revisar (ej. 'Portofino' o 'Monarca').", i: Building2, c: P.amber }
    ],
    follow: "¿Prefieres que te muestre un resumen general del sistema?"
  },
  priority: {
    content: "Análisis de Prioridades completado. Estos son tus clientes más importantes hoy:",
    metrics: [
      { label: "Familias de Alto Valor", val: "$4.2M comprometidos — en etapa avanzada de negociación.", i: Crown, c: P.emerald },
      { label: "Inversionistas Destacados", val: "$2.8M en proceso — altísima probabilidad de retención.", i: Target, c: P.blue },
      { label: "Impacto en el Objetivo", val: "Representan el 62% de la meta de ventas del año.", i: Focus, c: P.amber }
    ],
    follow: "¿Deseas que active campañas de seguimiento automático hacia estos clientes?",
    btn: "Activar Seguimiento",
    action: "Activar seguimiento automático para clientes prioritarios"
  },
  schedule: {
    content: "Cita agendada correctamente sin conflictos de horario:",
    metrics: [
      { label: "Cita Confirmada", val: "Registrada en el calendario sin ningún cruce.", i: CalendarDays, c: P.blue },
      { label: "Oportunidad de Venta", val: "Buen momento para ofrecer incentivos por cierre rápido.", i: Target, c: P.amber },
      { label: "Tiempo Ahorrado", val: "Se automatizaron 25 minutos de gestión administrativa.", i: Activity, c: P.emerald }
    ],
    follow: "Guía de conversación preparada. ¿Quieres un recordatorio 5 minutos antes de la cita?"
  },
  teamrep: {
    content: "Reporte de rendimiento del equipo generado para este trimestre:",
    metrics: [
      { label: "Asesores con IA", val: "Están cerrando ventas un 30% más rápido que el promedio.", i: Trophy, c: P.emerald },
      { label: "Áreas de Mejora", val: "Algunos miembros necesitan más soporte en seguimiento.", i: Activity, c: P.amber },
      { label: "Oportunidad de Eficiencia", val: "Se pierden 14 horas semanales en tareas repetitivas.", i: Shield, c: P.rose }
    ],
    follow: "¿Deseas que envíe recomendaciones personalizadas a cada miembro del equipo?"
  },
  inventory: {
    content: "Análisis completo del inventario de **Portofino**:",
    metrics: [
      { label: "Velocidad de Ventas", val: "Muy superior al promedio de la zona costera.", i: TrendingUp, c: P.emerald },
      { label: "Tiempo Estimado", val: "Se estima vender todas las unidades en 4 meses.", i: Target, c: P.blue },
      { label: "Oportunidad de Precio", val: "Las condiciones permiten un aumento del 4%.", i: DollarSign, c: P.amber }
    ],
    follow: "Las condiciones son ideales. ¿Autorizas el aumento de precios ahora?",
    btn: "Autorizar Aumento",
    action: "Autorizar ajuste de precios en Portofino"
  },
  proposal: {
    content: "Propuesta comercial preparada para el cliente:",
    metrics: [
      { label: "Análisis Financiero", val: "Incluye protección fiscal y rendimientos proyectados.", i: BarChart3, c: P.blue },
      { label: "Proyección a 10 Años", val: "Crecimiento estimado del capital invertido.", i: TrendingUp, c: P.emerald },
      { label: "Velocidad de Creación", val: "Documento generado en menos de 3 segundos.", i: Zap, c: P.amber }
    ],
    follow: "El documento es confidencial. ¿Deseas enviarlo al cliente con enlace seguro?"
  }
};

const getResp = (t, leadData, currentLeads = MOCK_LEADS) => {
  const l = t?.toLowerCase() || "";
  // Si viene leadData directo (desde un botón en el UI), lo usamos
  const lead = leadData || currentLeads.find(le => l.includes(le.n.toLowerCase()) || l.includes(le.n.split(" ")[0].toLowerCase()));

  // — CRM direct brief — usa datos en vivo si se pasan, o busca en el array dinámico —
  if (l.startsWith("__crm__") || leadData) {
    if (lead) {
      const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.cyan : P.violet;
      const stageColor = stgC[lead.st] || P.txt3;
      const scoreColor = lead.sc >= 80 ? P.emerald : lead.sc >= 60 ? P.blue : lead.sc >= 40 ? P.cyan : P.violet;
      const hasPhone = lead.phone && lead.phone !== "";
      const hasNotes = lead.notas && lead.notas.trim() !== "";
      return {
        content: `Expediente CRM — **${lead.n}** · Score ${lead.sc}/100`,
        metrics: [
          { label: `Etapa actual · ${lead.st}`, val: `Ingresó: ${lead.fechaIngreso || "Reciente"} · Campaña: ${lead.campana || "—"} · Asesor: ${lead.asesor || "—"}`, i: CalendarDays, c: stageColor },
          { label: "Perfil del cliente", val: lead.bio || lead.tag || "Sin perfil registrado aún.", i: User, c: P.blue },
          { label: `Presupuesto · ${lead.budget || "Por definir"}`, val: `Proyecto: ${lead.p || "Sin proyecto asignado"} · Tel: ${hasPhone ? lead.phone : "No registrado"}`, i: DollarSign, c: scoreColor },
          ...(lead.risk ? [{ label: `Riesgo + Fricción · ${lead.friction || "—"}`, val: lead.risk, i: Shield, c: frictionColor }] : []),
          { label: `Próxima acción · ${lead.nextActionDate || "Sin fecha"}`, val: lead.nextAction || "Sin próxima acción registrada.", i: Zap, c: P.accent },
          ...(hasNotes ? [{ label: "Notas del expediente", val: lead.notas.replace(/[📍🎯💰👤📋⚠️✅]/g, "").substring(0, 180) + (lead.notas.length > 180 ? "…" : ""), i: FileText, c: P.txt2 }] : []),
        ],
        follow: lead.lastActivity
          ? `Última actividad: ${lead.lastActivity}. ¿Preparo la estrategia de cierre completa para **${lead.n}**?`
          : `Cliente recién registrado. ¿Preparo el plan de primer contacto para **${lead.n}**?`,
        btn: lead.lastActivity ? "Preparar Estrategia" : "Plan de Primer Contacto",
        action: `Dame la estrategia de cierre completa para ${lead.n} con presupuesto de ${lead.budget || "a definir"} en ${lead.p || "proyecto por asignar"}`,
      };
    }
  }

  // — Match a specific lead by name —
  if (lead) {
    const frictionIcon = lead.friction === "Bajo" ? CheckCircle2 : lead.friction === "Medio" ? AlertCircle : AlertTriangle;
    const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.cyan : P.violet;
    const frictionLabel = lead.friction === "Bajo" ? "Fricción baja — buen momento para avanzar" : lead.friction === "Medio" ? "Fricción media — resolver objeción primero" : "Fricción alta — reforzar confianza antes de cerrar";
    return {
      content: `Expediente de **${lead.n}** · Score ${lead.sc}/100 · ${lead.tag}`,
      metrics: [
        { label: "Perfil del cliente", val: lead.bio, i: User, c: P.blue },
        { label: `Estado · ${lead.st}`, val: frictionLabel, i: frictionIcon, c: frictionColor },
        { label: "Riesgo identificado", val: lead.risk, i: Shield, c: P.rose },
        { label: `Próxima acción · ${lead.nextActionDate}`, val: lead.nextAction, i: Zap, c: P.accent },
      ],
      follow: `Última actividad: ${lead.lastActivity}. ¿Preparamos la estrategia de cierre ahora?`,
      btn: "Preparar Estrategia",
      action: `Dame la estrategia de cierre completa para ${lead.n}`,
    };
  }

  // — Priority / today's focus —
  if (l.includes("priorit") || l.includes("hoy") || l.includes("80/20") || l.includes("importante") || l.includes("focus")) {
    const hot = currentLeads.filter(x => x.isNew || x.sc >= 80 || x.st === "Zoom Agendado").slice(0, 3);
    const totalV = hot.reduce((s, x) => s + (x.presupuesto || 0), 0);
    return {
      content: "Tus **3 prioridades de hoy** — Análisis 80/20 del pipeline activo:",
      metrics: [
        { label: `1. ${hot[0]?.n} · ${hot[0]?.st}`, val: `${hot[0]?.nextAction}  ·  ${hot[0]?.nextActionDate}`, i: Crown, c: P.emerald },
        { label: `2. ${hot[1]?.n} · ${hot[1]?.st}`, val: `${hot[1]?.nextAction}  ·  ${hot[1]?.nextActionDate}`, i: Target, c: P.blue },
        { label: `3. ${hot[2]?.n} · ${hot[2]?.st}`, val: `${hot[2]?.nextAction}  ·  ${hot[2]?.nextActionDate}`, i: Zap, c: P.amber },
      ],
      follow: `Estas 3 oportunidades representan **$${(totalV/1000000).toFixed(1)}M** combinados. Atenderlos hoy puede detonar el ciclo de cierre esta semana.`,
      btn: "Activar Seguimiento",
      action: "Activar seguimiento automático para clientes prioritarios",
    };
  }

  // — New / recently registered leads —
  if (l.includes("nuevo") || l.includes("registr") || l.includes("reciente") || l.includes("ingres")) {
    const newLeads = leads.filter(x => x.isNew);
    return {
      content: `**${newLeads.length} clientes nuevos** registrados recientemente — requieren primer contacto:`,
      metrics: newLeads.slice(0, 3).map((x, i) => ({
        label: `${x.n} · ${x.p} · ${x.budget}`,
        val: `${x.nextAction}  ·  ${x.nextActionDate}`,
        i: [User, Phone, CalendarDays][i] || User,
        c: [P.accent, P.blue, P.violet][i] || P.accent,
      })),
      follow: `El primer contacto en menos de 24h aumenta la tasa de conversión hasta un 70%. ¿Activo seguimiento automático para estos clientes?`,
      btn: "Contactar ahora",
      action: "Activar primer contacto para clientes nuevos",
    };
  }

  // — Zoom / scheduled meetings —
  if (l.includes("zoom") || l.includes("reunión") || l.includes("videollamada")) {
    const zooms = leads.filter(x => x.st === "Zoom Agendado");
    return {
      content: `**${zooms.length} Zooms agendados** — Prepara cada sesión con los siguientes puntos:`,
      metrics: zooms.map((x, i) => ({
        label: `${x.n} — ${x.nextActionDate}`,
        val: `${x.nextAction}. Riesgo a resolver: ${x.risk}`,
        i: [Mic2, CalendarDays, Target][i] || Mic2,
        c: [P.violet, P.blue, P.amber][i] || P.violet,
      })),
      follow: "¿Quieres que prepare un brief personalizado con los puntos clave para cada sesión?",
      btn: "Preparar briefs",
      action: "Preparar brief para zooms del día",
    };
  }

  // — Update CRM / just visited —
  if (l.includes("visitar") || l.includes("penthouse") || l.includes("actualizar") || l.includes("acabo de") || l.includes("registr")) {
    return responses.crm_update;
  }

  // — Proposal / document —
  if (l.includes("propuesta") || l.includes("genera") || l.includes("documento") || l.includes("dossier") || l.includes("contrato")) return responses.proposal;

  // — Project analysis —
  if (l.includes("portofino") || l.includes("gobernador") || l.includes("monarca")) return responses.macro_erp;

  // — Price / market authorization —
  if (l.includes("autorizar") || l.includes("validar") || l.includes("ajuste") || l.includes("precio")) return responses.macro_autorizar;

  // — Schedule / appointment —
  if (l.includes("agenda") || l.includes("llamada") || l.includes("cita") || l.includes("tarea")) return responses.schedule;

  // — Team report —
  if (l.includes("rendimiento") || l.includes("equipo") || l.includes("reporte") || l.includes("métricas")) return responses.teamrep;

  // — Inventory —
  if (l.includes("inventario") || l.includes("unidades") || l.includes("quedan") || l.includes("disponible")) return responses.inventory;

  // — Pipeline / cierre macro —
  if (l.includes("pipeline") || l.includes("cierre") || l.includes("macro")) return responses.macro_cierre;

  return responses.default;
};

/* ════════════════════════════════════════
   VIEWS
   ════════════════════════════════════════ */
const Dash = ({ oc, co, leads = [] }) => {
  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.st === "Cerrado" || l.st === "Escritura");
  const accumulatedRevenue = closedLeads.reduce((s, l) => s + (l.budget || 0), 0);
  const totalPipeline = leads.reduce((s, l) => s + (l.budget || 0), 0);
  const conversionRate = totalLeads ? ((closedLeads.length / totalLeads) * 100).toFixed(1) : 0;
  const hotLeads = leads.filter(l => l.hot || l.sc >= 80).length;

  const dynamicPipe = STAGES.map(st => ({
    name: st,
    val: leads.filter(l => l.st === st).length,
    c: stgC[st] || P.txt3
  })).filter(d => d.val > 0);

  const revenueTrend = [
    { m: "Ene", v: 4.2 }, { m: "Feb", v: 5.8 }, { m: "Mar", v: 3.5 },
    { m: "Abr", v: 7.2 }, { m: "May", v: 8.4 }, 
    { m: "Jun", v: accumulatedRevenue / 1000000 || 6.9 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Ingresos Reales" value={`$${(accumulatedRevenue / 1000000).toFixed(1)}M`} sub="En caja" icon={DollarSign} color={P.emerald} />
        <KPI label="Pipeline Activo" value={`$${(totalPipeline / 1000000).toFixed(1)}M`} sub={`${totalLeads} prospectos`} icon={Target} color={P.blue} />
        <KPI label="Tasa de Conversión" value={`${conversionRate}%`} sub="Lead a Cierre" icon={TrendingUp} color={P.amber} />
        <KPI label="Clientes High-Score" value={hotLeads} sub="Score > 80" icon={Atom} color={P.violet} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: co ? "1fr" : "3fr 1.3fr", gap: 14 }}>
        <G>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Tendencia de Ingresos ($M)</p>
            <Pill color={P.accent} s>Actualizado hoy</Pill>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={revenueTrend}>
              <XAxis dataKey="m" tick={{ fill: P.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: P.txt3, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, color: P.txt, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
              <Area type="monotone" dataKey="v" stroke={P.accent} strokeWidth={2.5} fill={`${P.accent}14`} dot={{ r: 3, fill: P.accent, stroke: P.bg, strokeWidth: 2 }} name="$M" />
            </AreaChart>
          </ResponsiveContainer>
        </G>
        <G>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 8 }}>Estado del Pipeline</p>
          {dynamicPipe.length > 0 ? dynamicPipe.map(d => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: P.txt2, width: 85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: P.glass }}>
                <div style={{ height: 6, borderRadius: 3, width: `${(d.val / totalLeads) * 100}%`, background: d.c, transition: "width 0.8s ease", boxShadow: `0 0 8px ${d.c}30` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.c, width: 24, textAlign: "right" }}>{d.val}</span>
            </div>
          )) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: P.txt3, fontSize: 11 }}>Sin datos en pipeline</div>
          )}
          <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: P.rx, background: P.accentS, border: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: P.txt2 }}>Total Prospectos</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: P.accent, fontFamily: fontDisp }}>{totalLeads}</span>
          </div>
        </G>
      </div>

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

      <G np>
        <div style={{ padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent, boxShadow: `0 0 8px ${P.accent}` }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Atención Inmediata</p>
            <Pill color={P.accent} s>Nuevos · Zoom agendado</Pill>
          </div>
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
                <div style={{ width: `${l.sc}%`, height: 3, borderRadius: 2, background: l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.cyan }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.cyan, fontFamily: fontDisp }}>{l.sc}</span>
            </div>
            <Pill color={stgC[l.st] || P.txt3} s>{l.st}</Pill>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{l.budget}</span>
            <div style={{ padding: "5px 8px", borderRadius: 7, background: `${P.accent}07`, border: `1px solid ${P.accentB}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: P.accent, letterSpacing: "0.04em", marginBottom: 2 }}>{l.nextActionDate?.toUpperCase() || "HOY"}</p>
              <p style={{ fontSize: 10, color: P.txt2, lineHeight: 1.35 }}>{l.nextAction?.substring(0, 45) || "Pendiente contacto"}{l.nextAction?.length > 45 ? "…" : ""}</p>
            </div>
          </div>
        ))}
      </G>

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
    </div>
  );
};



/* ─── Score bar helper ─── */
const ScoreBar = ({ sc, compact }) => {
  const c = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.cyan : P.violet;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}40`, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: c, fontFamily: fontDisp, minWidth: 20, textAlign: "right" }}>{sc}</span>
    </div>
  );
};

/* ─── Notes Modal — Rich sectioned view ─── */
const NotesModal = ({ lead, onClose, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!lead) return null;

  const KNOWN_SECTIONS = ["OBJETIVO", "PRESUPUESTO", "PERFIL DEL CLIENTE", "HISTORIAL DE CONTACTO", "PENDIENTE"];
  const sectionColors = { "OBJETIVO": P.blue, "PRESUPUESTO": P.emerald, "PERFIL DEL CLIENTE": P.txt2, "HISTORIAL DE CONTACTO": P.amber, "PENDIENTE": P.accent };

  const parseSections = (raw = "") => {
    const sections = []; const lines = raw.split("\n"); let cur = null;
    for (const line of lines) {
      if (line.trim() === "") { if (cur) cur.body += "\n"; continue; }
      const stripped = line.replace(/^[^\w\s]+\s*/, "").trim();
      const hk = KNOWN_SECTIONS.find(s => stripped.toUpperCase() === s || line.trim() === s);
      if (hk) { if (cur) sections.push(cur); cur = { title: hk, body: "", key: hk }; }
      else { if (cur) cur.body += (cur.body ? "\n" : "") + line; else sections.push({ title: "", body: line, key: "" }); }
    }
    if (cur) sections.push(cur); return sections;
  };
  const sections = parseSections(lead.notas);

  const startEdit = () => { setDraft(lead.notas || ""); setEditing(true); };
  const saveEdit = () => { onSave?.(draft); setEditing(false); };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(2,5,12,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(660px, 94vw)", background: "#080D17", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 48px 96px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", animation: "fadeIn 0.22s ease", maxHeight: "85vh" }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${stgC[lead.st] || P.accent}, transparent)`, borderRadius: "22px 22px 0 0" }} />
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: P.glass, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: P.txt2, fontFamily: fontDisp, flexShrink: 0 }}>{lead.n.charAt(0)}</div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 3 }}>{lead.n}</p>
              <p style={{ fontSize: 11, color: P.txt3 }}>{lead.asesor} · {lead.budget}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {!editing && (
              <button onClick={startEdit} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", color: P.txt3, fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; e.currentTarget.style.borderColor = P.borderH; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.txt3; e.currentTarget.style.borderColor = P.border; }}
              >Editar notas</button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.background = P.glassH}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            ><X size={14} color={P.txt2} /></button>
          </div>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {editing ? (
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={"OBJETIVO\nDescripción...\n\nPENDIENTE\nAcciones pendientes..."}
              style={{ width: "100%", minHeight: 300, padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${P.borderH}`, color: P.txt, fontSize: 13, fontFamily: font, lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sections.filter(s => s.title || s.body).map((s, i) => {
                const c = sectionColors[s.key] || P.txt2;
                return (
                  <div key={i} style={{ borderRadius: 12, border: `1px solid ${s.key ? `${c}18` : P.border}`, overflow: "hidden" }}>
                    {s.title && <div style={{ padding: "8px 14px", background: s.key ? `${c}08` : P.glass, borderBottom: `1px solid ${s.key ? `${c}18` : P.border}` }}><p style={{ fontSize: 10, fontWeight: 700, color: s.key ? c : P.txt3, letterSpacing: "0.07em", textTransform: "uppercase" }}>{s.title}</p></div>}
                    <div style={{ padding: s.title ? "12px 14px" : "14px" }}><pre style={{ fontSize: 12.5, color: P.txt2, lineHeight: 1.8, fontFamily: font, whiteSpace: "pre-wrap", margin: 0 }}>{s.body.trim()}</pre></div>
                  </div>
                );
              })}
              {sections.length === 0 && (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: P.txt3, marginBottom: 12 }}>Sin notas registradas.</p>
                  <button onClick={startEdit} style={{ padding: "8px 20px", borderRadius: 9, background: `${P.accent}12`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Agregar primera nota</button>
                </div>
              )}
            </div>
          )}
        </div>
        {editing && (
          <div style={{ padding: "14px 22px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt2; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.txt3; }}
            >Cancelar</button>
            <button onClick={saveEdit} style={{ flex: 2, padding: "11px 0", borderRadius: 11, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.background = `${P.accent}24`}
              onMouseLeave={e => e.currentTarget.style.background = `${P.accent}16`}
            >Guardar notas</button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

const LeadPanel = ({ lead, onClose, oc, onOpenNotes, onUpdate }) => {
  const [activeTab, setActiveTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  if (!lead) return null;
  const sc = lead.sc;
  const scoreColor = P.accent;
  const stageColor = stgC[lead.st] || P.txt3;
  const stageIdx = STAGES.indexOf(lead.st);
  const startEditing = () => { setForm({ n: lead.n, phone: lead.phone||"", budget: lead.budget||"", asesor: lead.asesor||"", campana: lead.campana||"", p: lead.p||"", st: lead.st, nextAction: lead.nextAction||"", nextActionDate: lead.nextActionDate||"", bio: lead.bio||"" }); setEditing(true); };
  const saveEditing = () => { if (!form.n.trim()) return; onUpdate?.({...lead,...form}); setEditing(false); setForm(null); };
  const cancelEditing = () => { setEditing(false); setForm(null); };
  const f = k => form?.[k] ?? ""; const sf = k => v => setForm(p => ({...p,[k]:v}));
  const inp = (label, key, ph, full) => (
    <div style={full ? { gridColumn: "1 / -1" } : {}}>
      <p style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <input value={f(key)} onChange={e => sf(key)(e.target.value)} placeholder={ph}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: `1px solid ${P.borderH}`, color: P.txt, fontSize: 12, outline: "none", fontFamily: font, boxSizing: "border-box" }} />
    </div>
  );
  const textarea = (label, key, ph) => (
    <div style={{ gridColumn: "1 / -1" }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <textarea value={f(key)} onChange={e => sf(key)(e.target.value)} placeholder={ph} rows={3}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: `1px solid ${P.borderH}`, color: P.txt, fontSize: 12, outline: "none", fontFamily: font, resize: "vertical", boxSizing: "border-box" }} />
    </div>
  );

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(2,5,12,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 440, background: "#07080F", borderLeft: `1px solid ${P.borderH}`, display: "flex", flexDirection: "column", animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)", boxShadow: "-24px 0 80px rgba(0,0,0,0.5)" }}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${stgC[editing ? form?.st : lead.st] || stageColor}, transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {lead.hot && <span style={{ fontSize: 9, fontWeight: 700, color: P.accent, background: `${P.accent}12`, border: `1px solid ${P.accentB}`, padding: "2px 8px", borderRadius: 99 }}>HOT</span>}
              {lead.daysInactive >= 7 && <span style={{ fontSize: 9, fontWeight: 600, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "2px 8px", borderRadius: 99 }}>{lead.daysInactive}d inactivo</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!editing && <button onClick={startEditing} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", color: P.txt3, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; e.currentTarget.style.borderColor = P.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.txt3; e.currentTarget.style.borderColor = P.border; }}>Editar</button>}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }} onMouseEnter={e => e.currentTarget.style.background = P.glassH} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><X size={13} color={P.txt3} /></button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width={54} height={54} style={{ position: "absolute", top: -3, left: -3 }}>
                <circle cx={27} cy={27} r={24} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
                <circle cx={27} cy={27} r={24} fill="none" stroke={P.accent} strokeWidth={2.5} strokeDasharray={`${2*Math.PI*24}`} strokeDashoffset={`${2*Math.PI*24*(1-sc/100)}`} strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "27px 27px" }} />
              </svg>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: P.txt2, fontFamily: fontDisp }}>{lead.n.charAt(0)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? <input value={f("n")} onChange={e => sf("n")(e.target.value)} style={{ width: "100%", fontSize: 17, fontWeight: 700, fontFamily: fontDisp, background: "transparent", border: "none", borderBottom: `1px solid ${P.borderH}`, color: "#FFF", outline: "none", paddingBottom: 3, marginBottom: 6, boxSizing: "border-box" }} />
                : <p style={{ fontSize: 17, fontWeight: 700, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.025em", marginBottom: 4, lineHeight: 1.1 }}>{lead.n}</p>}
              <p style={{ fontSize: 11, color: P.txt3, marginBottom: 6 }}>{lead.tag}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {editing ? <select value={f("st")} onChange={e => sf("st")(e.target.value)} style={{ padding: "3px 8px", borderRadius: 99, background: `${stgC[f("st")]||P.txt3}18`, border: `1px solid ${stgC[f("st")]||P.txt3}30`, color: stgC[f("st")]||P.txt3, fontSize: 10, fontWeight: 700, cursor: "pointer", outline: "none" }}>{STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: "#fff" }}>{s}</option>)}</select>
                  : <Pill color={stageColor} s>{lead.st}</Pill>}
                <span style={{ fontSize: 10, color: P.txt3 }}>·</span>
                {editing ? <input value={f("budget")} onChange={e => sf("budget")(e.target.value)} style={{ fontSize: 12, fontWeight: 700, fontFamily: fontDisp, background: "transparent", border: "none", borderBottom: `1px solid ${P.border}`, color: "#FFF", outline: "none", width: 90 }} />
                  : <span style={{ fontSize: 12, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{lead.budget}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}><div style={{ width: `${sc}%`, height: 4, borderRadius: 2, background: P.accent }} /></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: P.txt2, fontFamily: fontDisp, minWidth: 50, textAlign: "right" }}>Score {sc}</span>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <a href={`tel:${editing ? f("phone") : lead.phone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; }} onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}><Phone size={12} /> Llamar</a>
            <a href={`https://wa.me/${(editing?f("phone"):lead.phone)?.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.18)", color: "rgba(37,211,102,0.85)", fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,0.13)"; e.currentTarget.style.color = "rgba(37,211,102,1)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,211,102,0.07)"; e.currentTarget.style.color = "rgba(37,211,102,0.85)"; }}><MessageCircle size={12} /> WhatsApp</a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "0 22px", borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
          {[["perfil","Perfil"],["pipeline","Pipeline"],["notas","Notas"]].map(([id,label]) => (
            <button key={id} onClick={() => id==="notas" ? onOpenNotes?.() : setActiveTab(id)} style={{ padding: "11px 0", marginRight: 20, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, color: activeTab===id&&id!=="notas"?P.accent:P.txt3, borderBottom: activeTab===id&&id!=="notas"?`2px solid ${P.accent}`:"2px solid transparent", transition: "all 0.18s", marginBottom: -1 }} onMouseEnter={e=>{if(activeTab!==id||id==="notas")e.currentTarget.style.color=P.txt2;}} onMouseLeave={e=>{if(activeTab!==id||id==="notas")e.currentTarget.style.color=P.txt3;}}>{label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          {activeTab==="perfil" && !editing && <>
            <div style={{ borderRadius: 12, background: `${P.accent}08`, border: `1px solid ${P.accentB}`, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: P.accent, letterSpacing: "0.07em", textTransform: "uppercase", flex: 1 }}>Próxima acción</p>
                <span style={{ fontSize: 10, fontWeight: 600, color: P.accent, background: `${P.accent}18`, padding: "2px 8px", borderRadius: 99 }}>{lead.nextActionDate}</span>
              </div>
              <div style={{ padding: "11px 14px" }}><p style={{ fontSize: 13, color: "#FFF", lineHeight: 1.55, fontFamily: fontDisp, fontWeight: 500 }}>{lead.nextAction}</p></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[{l:"Teléfono",v:lead.phone,icon:Phone},{l:"Ingresó",v:lead.fechaIngreso,icon:CalendarDays},{l:"Campaña",v:lead.campana,icon:Signal},{l:"Proyecto",v:lead.p?.split("·")[0]?.trim(),icon:Building2},{l:"Asesor",v:lead.asesor,icon:User},{l:"Inactividad",v:`${lead.daysInactive} días`,icon:Clock}].map(x=>(
                <div key={x.l} style={{ padding: "9px 11px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <x.icon size={11} color={P.txt3} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 9, color: P.txt3, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>{x.l}</p>
                    <p style={{ fontSize: 11, color: P.txt, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.v}</p>
                  </div>
                </div>
              ))}
            </div>
            <div><p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Perfil del cliente</p><p style={{ fontSize: 12.5, color: P.txt2, lineHeight: 1.7 }}>{lead.bio}</p></div>
            {lead.risk && <div style={{ padding: "11px 13px", borderRadius: 11, background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, display: "flex", gap: 8 }}><AlertCircle size={13} color={P.txt3} style={{ marginTop: 1, flexShrink: 0 }} /><div><p style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Riesgo identificado</p><p style={{ fontSize: 12, color: P.txt2, lineHeight: 1.55 }}>{lead.risk}</p></div></div>}
            <div style={{ display: "flex", gap: 7, alignItems: "center", padding: "8px 11px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}` }}><Activity size={11} color={P.txt3} /><div><p style={{ fontSize: 9, color: P.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>Última actividad</p><p style={{ fontSize: 11.5, color: P.txt2 }}>{lead.lastActivity}</p></div></div>
          </>}

          {activeTab==="perfil" && editing && form && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {inp("Nombre completo","n","Nombre del cliente",true)}
              {inp("Teléfono","phone","+1 817 682...")}
              {inp("Presupuesto","budget","$500K USD")}
              {inp("Asesor","asesor","Nombre asesor")}
              {inp("Campaña / Fuente","campana","Referido, Google...")}
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Etapa del pipeline</p>
                <select value={f("st")} onChange={e => sf("st")(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: `1px solid ${P.borderH}`, color: P.txt, fontSize: 12, outline: "none", fontFamily: font, cursor: "pointer" }}>{STAGES.map(s=><option key={s} value={s} style={{ background: "#0C1219" }}>{s}</option>)}</select>
              </div>
              {inp("Proyecto de interés","p","Gobernador 28, Portofino...",true)}
              {textarea("Próxima acción","nextAction","Descripción de la próxima acción...")}
              {inp("Fecha acción","nextActionDate","Hoy, Mañana 10am...")}
              {textarea("Perfil del cliente","bio","Descripción del cliente...")}
            </div>
          )}

          {activeTab==="pipeline" && <>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Progreso en el pipeline</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {STAGES.map((stage,idx) => { const isActive=stage===lead.st; const isPast=idx<stageIdx; const c=stgC[stage]||P.txt3; return (
                  <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: isActive?`${c}10`:"transparent", border: `1px solid ${isActive?`${c}28`:"transparent"}`, transition: "all 0.2s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isActive?c:isPast?`${c}28`:"rgba(255,255,255,0.04)", border: `1px solid ${isActive?c:isPast?`${c}45`:"rgba(255,255,255,0.08)"}` }}>
                      {isPast&&<Check size={10} color={c} />}{isActive&&<div style={{ width: 6, height: 6, borderRadius: "50%", background: "#000" }} />}
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: isActive?700:500, color: isActive?"#FFF":isPast?P.txt2:P.txt3 }}>{stage}</span>
                    {isActive&&<span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: c, background: `${c}16`, padding: "2px 8px", borderRadius: 99 }}>ACTUAL</span>}
                  </div>
                ); })}
              </div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: P.glass, border: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Inversión</p>
              <p style={{ fontSize: 28, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>{lead.budget}</p>
              <p style={{ fontSize: 11, color: P.txt2 }}>{lead.p}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Mover de etapa</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {STAGES.filter(s=>s!==lead.st).map(stage => { const c=stgC[stage]||P.txt3; const isAhead=STAGES.indexOf(stage)>stageIdx; return (
                  <button key={stage} onClick={()=>onUpdate?.({...lead,st:stage})} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: "transparent", border: `1px solid ${P.border}`, cursor: "pointer", transition: "all 0.16s", textAlign: "left" }} onMouseEnter={e=>{e.currentTarget.style.background=`${c}0C`;e.currentTarget.style.borderColor=`${c}28`;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=P.border;}}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: P.txt2, flex: 1 }}>{stage}</span>
                    <span style={{ fontSize: 9, color: P.txt3 }}>{isAhead?"avanzar →":"← retroceder"}</span>
                  </button>
                ); })}
              </div>
            </div>
          </>}
        </div>

        {/* Footer */}
        <div style={{ padding: "13px 22px", borderTop: `1px solid ${P.border}`, flexShrink: 0 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelEditing} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }} onMouseEnter={e=>{e.currentTarget.style.background=P.glassH;e.currentTarget.style.color=P.txt2;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=P.txt3;}}>Cancelar</button>
              <button onClick={saveEditing} disabled={!form?.n?.trim()} style={{ flex: 2, padding: "11px 0", borderRadius: 11, background: form?.n?.trim()?`${P.accent}18`:"transparent", border: `1px solid ${form?.n?.trim()?P.accentB:P.border}`, color: form?.n?.trim()?P.accent:P.txt3, fontSize: 13, fontWeight: 700, cursor: form?.n?.trim()?"pointer":"not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.18s" }}>Guardar cambios</button>
            </div>
          ) : (
            <button onClick={()=>{oc(`__crm__ ${lead.n.toLowerCase()}`, lead);onClose();}} style={{ width: "100%", padding: "11px 0", borderRadius: 11, background: `${P.accent}14`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", transition: "background 0.18s" }} onMouseEnter={e=>e.currentTarget.style.background=`${P.accent}22`} onMouseLeave={e=>e.currentTarget.style.background=`${P.accent}14`}>Analizar con IA</button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

/* ═══════════════════════════════════════════
   CRM — Pipeline Pro
═══════════════════════════════════════════ */
function CRM({ oc, co, leads = MOCK_LEADS, updateDb }) {
  const { user } = useAuth();

  // Solo director, admin y super_admin ven todos los leads
  const canSeeAll = ["super_admin", "admin", "director"].includes(user?.role);

  const [leadsData, setLeadsData]       = useState(() =>
    canSeeAll ? leads : leads.filter(l => l.asesor === user?.name)
  );

  // Sincronizar con Supabase cuando los datos cambian
  useEffect(() => {
    setLeadsData(canSeeAll ? leads : leads.filter(l => l.asesor === user?.name));
  }, [leads, canSeeAll, user?.name]);

  const [sortField, setSortField]       = useState("sc");
  const [sortDir, setSortDir]           = useState("desc");
  const [filterStage, setFilterStage]   = useState("TODO");
  const [filterAsesor, setFilterAsesor] = useState("TODO");
  const [searchQ, setSearchQ]           = useState("");
  const [viewMode, setViewMode]         = useState("list");
  const [selectedLead, setSelectedLead] = useState(null);
  const [notesLead, setNotesLead]       = useState(null);
  const [addingLead, setAddingLead]     = useState(false);
  const [newLead, setNewLead]           = useState({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", budget: "", p: "", campana: "", st: "Nuevo Registro" });
  const [hoveredRow, setHoveredRow]     = useState(null);
  const [dragLeadId, setDragLeadId]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // visibleLeads = leads accesibles según el rol del usuario
  const visibleLeads = canSeeAll ? leadsData : leadsData.filter(l => l.asesor === user?.name);

  const updateLead = (updated) => {
    setLeadsData(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (selectedLead?.id === updated.id) setSelectedLead(updated);
    if (notesLead?.id === updated.id) setNotesLead(updated);
    // Persistir en Supabase
    if (updateDb) updateDb(updated.id, updated);
  };
  const saveNotes = (newNotas) => { const u = {...notesLead, notas: newNotas}; updateLead(u); setNotesLead(u); };
  const handleDragStart = (e, id) => { setDragLeadId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, stage) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); };
  const handleDrop = (e, stage) => { e.preventDefault(); if (dragLeadId) setLeadsData(prev => prev.map(l => l.id === dragLeadId ? {...l,st:stage} : l)); setDragLeadId(null); setDragOverStage(null); };
  const handleDragEnd = () => { setDragLeadId(null); setDragOverStage(null); };
  const [expandedPriority, setExpandedPriority] = useState(null);
  const [pinnedIds,    setPinnedIds]    = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); setDismissedIds(p => { const d = new Set(p); d.delete(id); return d; }); }
      return next;
    });
  };
  const dismissPriority = (id) => {
    setDismissedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const asesores = [...new Set(visibleLeads.map(l => l.asesor))];
  const urgColor = (d) => d >= 10 ? P.violet : d >= 5 ? P.cyan : P.emerald;

  const sortedLeads = useMemo(() => {
    let data = visibleLeads.filter(l => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || l.n.toLowerCase().includes(q) || l.phone.includes(q) || l.asesor.toLowerCase().includes(q) || l.campana.toLowerCase().includes(q) || l.p.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q);
      const matchStage = filterStage === "TODO" || l.st === filterStage;
      const matchAsesor = filterAsesor === "TODO" || l.asesor === filterAsesor;
      return matchQ && matchStage && matchAsesor;
    });
    return [...data].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === "presupuesto" || sortField === "sc" || sortField === "daysInactive") { av = Number(av) || 0; bv = Number(bv) || 0; }
      else { av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [visibleLeads, sortField, sortDir, filterStage, filterAsesor, searchQ]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const addNewLead = () => {
    if (!newLead.n.trim()) return;
    const now = new Date();
    const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const h = now.getHours(); const ampm = h >= 12 ? "pm" : "am"; const h12 = h % 12 || 12;
    const dateStr = `${now.getDate()} ${mos[now.getMonth()]}, ${h12}:${String(now.getMinutes()).padStart(2,"0")}${ampm}`;
    const newEntry = {
      id: Date.now(), ...newLead, sc: 40, st: newLead.st || "Nuevo Registro",
      tag: newLead.st || "Nuevo Registro", hot: false, isNew: true, fechaIngreso: dateStr,
      bio: "Cliente recién registrado. Pendiente primer contacto.", risk: "Sin información suficiente aún.",
      friction: "Medio", nextAction: "Primer contacto en las próximas 24 horas",
      nextActionDate: "Hoy", lastActivity: "Registro manual", daysInactive: 0, email: "",
      notas: `OBJETIVO\nPendiente — primer contacto.\n\nPENDIENTE\nRealizar primer contacto y calificar necesidades del cliente.`,
      presupuesto: parseFloat(String(newLead.budget).replace(/[^0-9.]/g, "")) || 0,
    };
    setLeadsData(prev => [newEntry, ...prev]);
    setAddingLead(false);
    setNewLead({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", budget: "", p: "", campana: "", st: "Nuevo Registro" });
  };

  const SH = ({ label, field, align = "left" }) => {
    const active = sortField === field;
    return (
      <span onClick={() => handleSort(field)} style={{
        cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        color: active ? P.accent : P.txt3, fontSize: 9, fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", transition: "color 0.15s",
      }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>
      </span>
    );
  };

  const isAutoPriority = (l) => (l.isNew || l.st === "Zoom Concretado" || l.st === "Zoom Agendado" || l.hot) && !dismissedIds.has(l.id);
  const priorityLeads = visibleLeads.filter(l => pinnedIds.has(l.id) || isAutoPriority(l)).sort((a,b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0) || b.sc - a.sc);
  const totalPipeline = visibleLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const avgScore = visibleLeads.length ? Math.round(visibleLeads.reduce((s, l) => s + l.sc, 0) / visibleLeads.length) : 0;
  const hotLeads = visibleLeads.filter(l => l.hot || l.daysInactive <= 2).length;
  const kanbanStages = STAGES.filter(s => s !== "Perdido");

  /* Responsive grid columns */
  const colsFull    = "88px 110px 1.6fr 120px 1fr 110px 1.1fr 68px 120px";
  const colsCompact = "1.6fr 110px 1fr 110px 68px 120px";
  const cols = co ? colsCompact : colsFull;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── HEADER ROW ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: P.accent, boxShadow: `0 0 10px ${P.accent}80` }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>Pipeline CRM</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{visibleLeads.length} clientes</span>
            {!canSeeAll && <span style={{ fontSize: 10, fontWeight: 700, color: P.amber, background: `${P.amber}10`, border: `1px solid ${P.amber}28`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.04em" }}>Vista personal</span>}
          </div>
          <p style={{ fontSize: 11.5, color: P.txt3, fontFamily: font, margin: 0 }}>
            <span style={{ color: P.txt2 }}>${(totalPipeline/1000000).toFixed(1)}M</span> en pipeline · <span style={{ color: P.emerald }}>{hotLeads} activos</span> · Score promedio <span style={{ color: P.blue }}>{avgScore}</span>
          </p>
        </div>
        <button onClick={() => setAddingLead(true)} style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
          borderRadius: 11, background: "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
          border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12, fontWeight: 700,
          fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.01em", transition: "all 0.2s", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))"; e.currentTarget.style.boxShadow = `0 0 20px ${P.accent}18`; }}
          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))"; e.currentTarget.style.boxShadow = "none"; }}
        ><Plus size={14} /> Nuevo cliente</button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Clientes en Pipeline" value={visibleLeads.length} icon={Users} color={P.blue} />
        <KPI label="Score Promedio" value={avgScore} sub="+4.8 este mes" icon={Target} color={P.amber} />
        <KPI label="Tasa de Conversión" value="18.4%" sub="+3.2pp" icon={TrendingUp} color={P.emerald} />
        <KPI label="Valor Total Pipeline" value={`$${(totalPipeline/1000000).toFixed(1)}M`} icon={DollarSign} />
      </div>

      {/* ── CLIENTES EN PRIORIDAD — todos, color por tipo, botones uniformes ── */}
      {priorityLeads.length > 0 && (() => {

        // Paleta de tipo — cada categoría tiene identidad visual única
        const getCardMeta = (l) => {
          // 🟢 Verde pulsante — urgente, nuevos, calientes
          if (l.hot) return {
            color: "#34D399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.22)",
            topBar: "linear-gradient(90deg,#34D399,#6EE7C2,#34D399)",
            label: `CALIENTE · ${l.daysInactive}D`, sublabel: "Actuar ahora mismo",
            pulse: true, glow: true,
          };
          if (l.isNew) return {
            color: "#34D399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.22)",
            topBar: "linear-gradient(90deg,#34D399,#6EE7C2,#34D399)",
            label: "NUEVO REGISTRO", sublabel: "Primer contacto — no esperes",
            pulse: true, glow: true,
          };
          // 🔵 Índigo — zoom agendado
          if (l.st === "Zoom Agendado") return {
            color: "#818CF8", bg: "rgba(129,140,248,0.07)", border: "rgba(129,140,248,0.24)",
            topBar: "linear-gradient(90deg,#818CF8,#6366F1 55%,transparent)",
            label: "ZOOM AGENDADO", sublabel: "Preparar presentación de cierre",
            pulse: false, glow: false,
          };
          // 🟩 Verde lima — zoom concretado (reunión exitosa, paso a cierre)
          if (l.st === "Zoom Concretado") return {
            color: "#4ADE80", bg: "rgba(74,222,128,0.07)", border: "rgba(74,222,128,0.24)",
            topBar: "linear-gradient(90deg,#4ADE80,#16A34A 55%,transparent)",
            label: "ZOOM CONCRETADO ✓", sublabel: "Enviar propuesta y cerrar hoy",
            pulse: false, glow: false,
          };
          // 🩵 Cyan — sin contacto
          if (l.daysInactive >= 7) return {
            color: P.cyan, bg: `${P.cyan}07`, border: `${P.cyan}1E`,
            topBar: `linear-gradient(90deg,${P.cyan},${P.cyan}40,transparent)`,
            label: `SIN CONTACTO · ${l.daysInactive}D`, sublabel: "Retomar antes de que enfríe",
            pulse: false, glow: false,
          };
          return {
            color: P.blue, bg: `${P.blue}07`, border: `${P.blue}1A`,
            topBar: `linear-gradient(90deg,${P.blue},${P.blue}40,transparent)`,
            label: "ACCIÓN PENDIENTE", sublabel: "Revisar y avanzar hoy",
            pulse: false, glow: false,
          };
        };

        return (
          <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 10px", borderRadius: 99, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 9px rgba(52,211,153,0.85)", animation: "pulse 1.8s ease-in-out infinite" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em", fontFamily: fontDisp }}>Clientes en prioridad</span>
                </div>
                <span style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>{priorityLeads.length} cliente{priorityLeads.length !== 1 ? "s" : ""} esperando acción</span>
              </div>
              {/* Leyenda de tipos */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {[
                  { color: "#34D399", label: "Urgente / Nuevo" },
                  { color: "#818CF8", label: "Zoom agendado" },
                  { color: "#4ADE80", label: "Zoom concretado" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 9.5, color: P.txt3, fontFamily: font }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll horizontal — todos los leads */}
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
              {priorityLeads.map((l, cardIdx) => {
                const sc = l.sc;
                const stageColor = stgC[l.st] || P.txt3;
                const meta = getCardMeta(l);

                return (
                  <div key={l.id} style={{
                    minWidth: co ? 256 : 284, maxWidth: 284, flexShrink: 0,
                    borderRadius: 18, overflow: "hidden",
                    background: meta.bg, border: `1px solid ${meta.border}`,
                    display: "flex", flexDirection: "column",
                    transition: "transform 0.2s ease",
                    animation: meta.glow ? "urgentGlow 2.8s ease-in-out infinite" : "none",
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "none"}
                  >
                    {/* Barra top — shimmer animado en urgentes */}
                    <div style={{
                      height: 3, flexShrink: 0,
                      background: meta.topBar,
                      backgroundSize: meta.glow ? "300% 100%" : "100%",
                      animation: meta.glow ? "shimmer 2.2s linear infinite" : "none",
                    }} />

                    <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>

                      {/* Fila superior: tipo · × */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {meta.pulse && <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }} />}
                          <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: font }}>{meta.label}</span>
                        </div>
                        <button onClick={() => dismissPriority(l.id)} title="Quitar de prioridad"
                          style={{ width: 20, height: 20, borderRadius: 5, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.14s", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                        ><X size={9} color="rgba(255,255,255,0.40)" strokeWidth={2.5} /></button>
                      </div>

                      {/* Nombre + presupuesto + etapa */}
                      <div>
                        <p style={{ fontSize: 15.5, fontWeight: 800, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", lineHeight: 1.2, margin: "0 0 5px" }}>{l.n}</p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <Pill color={stageColor} s>{l.st}</Pill>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: P.txt3, fontFamily: fontDisp }}>{l.budget}</span>
                        </div>
                      </div>

                      {/* Score bar — discreta */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                          <div style={{ width: `${sc}%`, height: "100%", borderRadius: 2, background: meta.color, opacity: 0.8 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, fontFamily: fontDisp, flexShrink: 0 }}>Score {sc}</span>
                      </div>

                      {/* Próxima acción */}
                      <div style={{ borderRadius: 10, background: "rgba(0,0,0,0.22)", border: `1px solid rgba(255,255,255,0.06)`, overflow: "hidden", flex: 1 }}>
                        <div style={{ padding: "7px 11px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Timer size={9} color={meta.color} strokeWidth={2.5} />
                            <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: font }}>Próxima acción</span>
                          </div>
                          <span style={{ fontSize: 8.5, color: P.txt3, background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 99, fontFamily: font }}>{l.nextActionDate}</span>
                        </div>
                        <div style={{ padding: "9px 11px", minHeight: 52, display: "flex", alignItems: "flex-start" }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", fontFamily: font, lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {l.nextAction || "Sin próxima acción registrada."}
                          </p>
                        </div>
                      </div>

                      {/* Cambio de etapa */}
                      <div style={{ position: "relative" }}>
                        <select value={l.st} onChange={e => updateLead({...l, st: e.target.value})}
                          style={{ width: "100%", padding: "6px 28px 6px 10px", borderRadius: 8, background: `${stageColor}0C`, border: `1px solid ${stageColor}22`, color: stageColor, fontSize: 10.5, fontWeight: 600, outline: "none", cursor: "pointer", fontFamily: font, appearance: "none", WebkitAppearance: "none" }}>
                          {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: "#fff" }}>{s}</option>)}
                        </select>
                        <ChevronDown size={11} color={stageColor} strokeWidth={2.5} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      </div>

                      {/* Botones */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                        <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`, l)} style={{
                          width: "100%", padding: "10px 12px", borderRadius: 9,
                          background: "linear-gradient(135deg, rgba(110,231,194,0.15), rgba(110,231,194,0.07))",
                          border: `1px solid ${P.accentB}`,
                          color: P.accent, fontSize: 11.5, fontWeight: 700,
                          fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.005em",
                          transition: "all 0.18s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.26), rgba(110,231,194,0.12))"; e.currentTarget.style.boxShadow = `0 4px 16px ${P.accent}12`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.15), rgba(110,231,194,0.07))"; e.currentTarget.style.boxShadow = "none"; }}
                        ><Zap size={11} strokeWidth={2.5} /> Analizar y actuar</button>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {[
                            { label: "Perfil", icon: User, fn: () => setSelectedLead(l) },
                            { label: "Notas",  icon: FileText, fn: () => setNotesLead(l) },
                          ].map(({ label, icon: Icon, fn }) => (
                            <button key={label} onClick={fn} style={{
                              padding: "8px 0", borderRadius: 8,
                              background: "rgba(255,255,255,0.035)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                              color: P.txt2, fontSize: 10.5, fontWeight: 600,
                              fontFamily: font, cursor: "pointer", transition: "all 0.14s",
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = P.txt2; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                            ><Icon size={10} /> {label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── MODAL NUEVO LEAD ── */}
      {addingLead && createPortal(
        <>
          <div onClick={() => setAddingLead(false)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(540px, 95vw)", background: "#07090F", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 52px 100px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04)", animation: "fadeIn 0.2s ease", overflow: "hidden" }}>

            {/* ── Barra accent — azul menta solamente ── */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${P.accent}, ${P.accent}CC 60%, ${P.accent}44)` }} />

            {/* ── Header ── */}
            <div style={{ padding: "20px 26px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: `${P.accent}12`, border: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <UserCheck size={14} color={P.accent} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>Registrar Nuevo Cliente</h3>
                </div>
                <p style={{ fontSize: 11, color: P.txt3, fontFamily: font, margin: 0, paddingLeft: 36 }}>
                  Etapa <span style={{ color: stgC[newLead.st] || P.accent, fontWeight: 600, fontFamily: fontDisp }}>{newLead.st}</span>
                  <span style={{ color: P.txt3 }}> · Score 40</span>
                </p>
              </div>
              <button onClick={() => setAddingLead(false)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.16s", flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={13} color={P.txt3} /></button>
            </div>

            {/* ── Campos ── */}
            <div style={{ padding: "20px 26px 4px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 14px" }}>
              {[
                { label: "Nombre completo", key: "n", ph: "Ej. Rafael García López", full: true, required: true, icon: User },
                { label: "Teléfono", key: "phone", ph: "+52 998 123 4567", icon: Phone },
                ...(canSeeAll ? [{ label: "Asesor asignado", key: "asesor", ph: "Estefanía Valdes", icon: Users }] : []),
                { label: "Presupuesto estimado", key: "budget", ph: "$200,000 USD", icon: DollarSign },
                { label: "Fuente / Campaña", key: "campana", ph: "Google Ads, Referido, Expo…", icon: Crosshair },
                { label: "Proyecto de interés", key: "p", ph: "Gobernador 28, Monarca 28, Torre 25…", full: true, icon: Building2 },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                    {f.icon && <f.icon size={10} color={P.txt3} />}
                    <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.055em", textTransform: "uppercase", fontFamily: fontDisp }}>
                      {f.label}
                      {f.required && <span style={{ color: P.accent, marginLeft: 3 }}>*</span>}
                    </span>
                  </div>
                  <input
                    placeholder={f.ph}
                    value={newLead[f.key] || ""}
                    onChange={e => setNewLead(p => ({...p, [f.key]: e.target.value}))}
                    style={{
                      width: "100%", height: 42, padding: "0 14px",
                      borderRadius: 11,
                      background: newLead[f.key] ? "rgba(110,231,194,0.04)" : P.glass,
                      border: `1px solid ${newLead[f.key] ? P.accentB : P.border}`,
                      color: P.txt, fontSize: 13, fontWeight: 400,
                      outline: "none", fontFamily: font,
                      boxSizing: "border-box", transition: "all 0.2s",
                    }}
                    onFocus={e => { e.target.style.borderColor = P.accentB; e.target.style.background = "rgba(110,231,194,0.05)"; e.target.style.boxShadow = `0 0 0 3px ${P.accent}0A`; }}
                    onBlur={e => { e.target.style.borderColor = newLead[f.key] ? P.accentB : P.border; e.target.style.background = newLead[f.key] ? "rgba(110,231,194,0.04)" : P.glass; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}

              {/* ── Estatus / Etapa — pills compactos ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <Waypoints size={10} color={P.txt3} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.055em", textTransform: "uppercase", fontFamily: fontDisp }}>Estatus / Etapa</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {STAGES.map(s => {
                    const c = stgC[s] || P.txt3;
                    const active = newLead.st === s;
                    return (
                      <button key={s} onClick={() => setNewLead(p => ({...p, st: s}))} style={{
                        padding: "5px 11px", borderRadius: 99, cursor: "pointer",
                        background: active ? `${c}18` : "transparent",
                        border: `1px solid ${active ? `${c}55` : P.border}`,
                        color: active ? c : P.txt3,
                        fontSize: 10.5, fontWeight: active ? 700 : 400,
                        fontFamily: font, transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                      }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = `${c}35`; e.currentTarget.style.color = c; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.txt3; } }}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0, opacity: active ? 1 : 0.55 }} />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Notas iniciales ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                  <FileText size={10} color={P.txt3} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.055em", textTransform: "uppercase", fontFamily: fontDisp }}>Notas iniciales</span>
                </div>
                <textarea
                  placeholder="Observaciones del primer contacto, intereses específicos, objeciones detectadas…"
                  value={newLead.notas || ""}
                  onChange={e => setNewLead(p => ({...p, notas: e.target.value}))}
                  rows={3}
                  style={{
                    width: "100%", padding: "11px 14px",
                    borderRadius: 11, resize: "vertical",
                    background: newLead.notas ? "rgba(110,231,194,0.04)" : P.glass,
                    border: `1px solid ${newLead.notas ? P.accentB : P.border}`,
                    color: P.txt, fontSize: 13, fontWeight: 400,
                    outline: "none", fontFamily: font,
                    boxSizing: "border-box", transition: "all 0.2s",
                    lineHeight: 1.55,
                  }}
                  onFocus={e => { e.target.style.borderColor = P.accentB; e.target.style.background = "rgba(110,231,194,0.05)"; e.target.style.boxShadow = `0 0 0 3px ${P.accent}0A`; }}
                  onBlur={e => { e.target.style.borderColor = newLead.notas ? P.accentB : P.border; e.target.style.background = newLead.notas ? "rgba(110,231,194,0.04)" : P.glass; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: "18px 26px 22px", display: "flex", gap: 10 }}>
              <button onClick={() => setAddingLead(false)} style={{ flex: 1, height: 43, borderRadius: 12, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.txt3; }}
              >Cancelar</button>
              <button onClick={addNewLead} disabled={!newLead.n.trim()} style={{
                flex: 2.2, height: 43, borderRadius: 12,
                background: newLead.n.trim()
                  ? "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.10))"
                  : P.glass,
                border: `1px solid ${newLead.n.trim() ? P.accentB : P.border}`,
                color: newLead.n.trim() ? P.accent : P.txt3,
                fontSize: 13, fontWeight: 700,
                cursor: newLead.n.trim() ? "pointer" : "not-allowed",
                fontFamily: fontDisp, letterSpacing: "0.005em",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: newLead.n.trim() ? `0 0 20px ${P.accent}10` : "none",
              }}
                onMouseEnter={e => { if (newLead.n.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.32), rgba(110,231,194,0.16))"; e.currentTarget.style.boxShadow = `0 4px 24px ${P.accent}18`; } }}
                onMouseLeave={e => { if (newLead.n.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.10))"; e.currentTarget.style.boxShadow = `0 0 20px ${P.accent}10`; } }}
              >
                <UserCheck size={14} />
                Registrar Cliente
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── PIPELINE STAGE STRIP ── */}
      <div style={{ display: "flex", gap: 0, borderRadius: 13, overflow: "hidden", border: `1px solid ${P.border}`, background: P.glass }}>
        {STAGES.slice(0,-1).map((stage, idx) => {
          const cnt = visibleLeads.filter(l => l.st === stage).length;
          const c = stgC[stage] || P.txt3;
          const isActive = filterStage === stage;
          return (
            <div key={stage} onClick={() => setFilterStage(isActive ? "TODO" : stage)}
              title={`${stage} · ${cnt} clientes`}
              style={{ flex: 1, padding: "10px 8px", cursor: "pointer", borderRight: idx < STAGES.length - 2 ? `1px solid ${P.border}` : "none",
                background: isActive ? `${c}18` : "transparent",
                transition: "background 0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: "100%", height: 3, borderRadius: 2, background: isActive ? c : `${c}30`, transition: "background 0.2s" }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: cnt > 0 ? (isActive ? c : "#FFFFFF") : P.txt3, fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1 }}>{cnt}</span>
              <span style={{ fontSize: 8.5, color: isActive ? c : P.txt3, fontWeight: isActive ? 700 : 500, letterSpacing: "0.02em", textAlign: "center", lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage}</span>
            </div>
          );
        })}
      </div>

      {/* ── MAIN TABLE / KANBAN ── */}
      <G np>
        {/* ── Toolbar — refined ── */}
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {/* View toggle — pill style */}
          <div style={{ display: "flex", borderRadius: 9, border: `1px solid ${P.border}`, overflow: "hidden", flexShrink: 0, background: P.glass }}>
            {[["list","Lista"],["kanban","Kanban"]].map(([m, lbl]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font,
                background: viewMode === m ? "rgba(255,255,255,0.08)" : "transparent",
                color: viewMode === m ? "#FFFFFF" : P.txt3,
                borderRight: m === "list" ? `1px solid ${P.border}` : "none",
                transition: "all 0.18s",
              }}>{lbl}</button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 140, maxWidth: 240 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.txt3, pointerEvents: "none" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar cliente, asesor, proyecto…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: searchQ ? 30 : 12, height: 32, borderRadius: 9, background: P.glass, border: `1px solid ${searchQ ? P.accentB : P.border}`, fontSize: 11.5, color: P.txt, outline: "none", fontFamily: font, boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = P.accentB}
              onBlur={e => e.target.style.borderColor = searchQ ? P.accentB : P.border}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: P.txt3, display: "flex", padding: 0 }}><X size={11} /></button>}
          </div>

          {/* Stage filter */}
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: filterStage !== "TODO" ? `${stgC[filterStage]}16` : P.glass, border: `1px solid ${filterStage !== "TODO" ? `${stgC[filterStage]}45` : P.border}`, fontSize: 11, color: filterStage !== "TODO" ? stgC[filterStage] : P.txt3, cursor: "pointer", outline: "none", fontFamily: font, fontWeight: filterStage !== "TODO" ? 700 : 400, transition: "all 0.2s" }}>
            <option value="TODO">Todas las etapas</option>
            {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: P.txt }}>{s}</option>)}
          </select>

          {/* Asesor filter — solo visible para directivos y admin */}
          {canSeeAll && (
            <select value={filterAsesor} onChange={e => setFilterAsesor(e.target.value)} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: filterAsesor !== "TODO" ? `${P.violet}14` : P.glass, border: `1px solid ${filterAsesor !== "TODO" ? `${P.violet}45` : P.border}`, fontSize: 11, color: filterAsesor !== "TODO" ? P.violet : P.txt3, cursor: "pointer", outline: "none", fontFamily: font, fontWeight: filterAsesor !== "TODO" ? 700 : 400 }}>
              <option value="TODO">Todos los asesores</option>
              {asesores.map(a => <option key={a} value={a} style={{ background: "#0C1219", color: P.txt }}>{a.split(" ")[0]} {a.split(" ")[1] || ""}</option>)}
            </select>
          )}

          {/* Filters count + clear */}
          {(filterStage !== "TODO" || filterAsesor !== "TODO" || searchQ) && (
            <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: `${P.rose}0C`, border: `1px solid ${P.rose}28`, color: P.rose, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font, flexShrink: 0, display: "flex", alignItems: "center", gap: 5, transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = `${P.rose}18`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${P.rose}0C`; }}
            ><X size={11} /> Limpiar</button>
          )}

          <div style={{ flex: 1 }} />

          {/* Count badge */}
          <span style={{ fontSize: 11, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "4px 11px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.02em" }}>
            {sortedLeads.length} resultado{sortedLeads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── LIST VIEW — Redesigned ── */}
        {viewMode === "list" && (
          <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "8px 18px", borderBottom: `1px solid ${P.border}`, alignItems: "center", background: "rgba(255,255,255,0.012)" }}>
              {!co && <SH label="Fecha" field="fechaIngreso" />}
              {!co && <SH label="Asesor" field="asesor" />}
              <SH label="Cliente" field="n" />
              <SH label="Teléfono" field="phone" />
              <SH label="Etapa" field="st" />
              <SH label="Presupuesto" field="presupuesto" align="right" />
              {!co && <SH label="Proyecto" field="p" />}
              <SH label="Score" field="sc" align="right" />
              <span style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>Acciones</span>
            </div>

            {sortedLeads.map((l, rowIdx) => {
              const isHov = hoveredRow === l.id;
              const sc = l.sc;
              const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
              const showUrgency = l.daysInactive >= 5;
              const uc = urgColor(l.daysInactive);
              const stageC = stgC[l.st] || P.txt3;

              return (
                <div key={l.id}
                  onMouseEnter={() => setHoveredRow(l.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: "grid", gridTemplateColumns: cols, gap: 8, padding: "12px 18px",
                    borderBottom: `1px solid ${P.border}`, alignItems: "center",
                    transition: "background 0.14s",
                    background: isHov ? "rgba(255,255,255,0.028)" : "transparent",
                    position: "relative",
                  }}
                >
                  {/* Left urgency bar */}
                  {showUrgency && (
                    <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3, borderRadius: "0 3px 3px 0", background: uc, opacity: 0.75 }} />
                  )}

                  {/* Fecha */}
                  {!co && <span style={{ fontSize: 10.5, color: P.txt3, fontFamily: font }}>{l.fechaIngreso}</span>}

                  {/* Asesor */}
                  {!co && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${P.violet}16`, border: `1px solid ${P.violet}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, color: P.violet, flexShrink: 0, fontFamily: fontDisp }}>{l.asesor?.charAt(0)}</div>
                      <span style={{ fontSize: 11, color: P.txt2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.asesor?.split(" ")[0]}</span>
                    </div>
                  )}

                  {/* Cliente */}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: P.txt2, flexShrink: 0, fontFamily: fontDisp }}>{l.n.charAt(0)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.n}</span>
                        {l.isNew && <span style={{ fontSize: 7.5, fontWeight: 700, color: P.txt3, background: "rgba(255,255,255,0.06)", border: `1px solid ${P.border}`, padding: "1px 5px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.05em" }}>NUEVO</span>}
                        {l.hot && <span style={{ fontSize: 7.5, fontWeight: 700, color: P.accent, background: `${P.accent}10`, border: `1px solid ${P.accentB}`, padding: "1px 5px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.05em" }}>HOT</span>}
                      </div>
                      <p style={{ fontSize: 10, color: P.txt3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {co ? `${l.asesor?.split(" ")[0]} · ${l.campana}` : l.tag}
                      </p>
                    </div>
                  </div>

                  {/* Teléfono */}
                  <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: isHov ? P.txt2 : P.txt3, textDecoration: "none", fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>{l.phone}</a>

                  {/* Etapa con inline change */}
                  <div onClick={e => e.stopPropagation()}>
                    <select value={l.st} onChange={e => { const v = e.target.value; setLeadsData(prev => prev.map(x => x.id === l.id ? {...x, st: v} : x)); }}
                      style={{ background: `${stageC}14`, border: `1px solid ${stageC}30`, borderRadius: 99, padding: "4px 10px 4px 8px", fontSize: 10.5, fontWeight: 700, color: stageC, cursor: "pointer", outline: "none", appearance: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.2s" }}>
                      {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: P.txt }}>{s}</option>)}
                    </select>
                  </div>

                  {/* Presupuesto */}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", textAlign: "right" }}>{l.budget}</span>

                  {/* Proyecto */}
                  {!co && (
                    <span style={{ fontSize: 10.5, color: P.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.p.split("·")[0].trim()}
                    </span>
                  )}

                  {/* Score */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", maxWidth: 36 }}>
                      <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: P.accent, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: P.txt2, fontFamily: fontDisp, minWidth: 22, textAlign: "right" }}>{sc}</span>
                  </div>

                  {/* Acciones — siempre visibles */}
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    {/* Pin — añadir/quitar de prioridad */}
                    {(() => {
                      const isPinned = pinnedIds.has(l.id);
                      const isAuto   = isAutoPriority(l);
                      const inPriority = isPinned || isAuto;
                      return (
                        <button onClick={() => togglePin(l.id)} title={inPriority ? "Quitar de prioridad" : "Añadir a prioridad"}
                          style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${inPriority ? `${P.accent}40` : P.border}`, background: inPriority ? `${P.accent}12` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = inPriority ? `${P.accent}20` : "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = inPriority ? `${P.accent}12` : "transparent"; }}
                        ><Star size={11} color={inPriority ? P.accent : P.txt3} fill={isPinned ? P.accent : "none"} strokeWidth={2} /></button>
                      );
                    })()}
                    <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`, l)} title="Analizar con IA"
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${P.accentB}`, background: `${P.accent}10`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: P.accent, fontSize: 10.5, fontWeight: 600, fontFamily: font, transition: "background 0.15s", whiteSpace: "nowrap" }}
                      onMouseEnter={e => e.currentTarget.style.background = `${P.accent}1E`}
                      onMouseLeave={e => e.currentTarget.style.background = `${P.accent}10`}
                    >IA</button>
                    <button onClick={() => setNotesLead(l)} title="Ver notas"
                      style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = P.borderH; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                    ><FileText size={12} color={P.txt3} /></button>
                    <button onClick={() => setSelectedLead(l)} title="Ver perfil"
                      style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = P.borderH; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                    ><User size={12} color={P.txt3} /></button>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {sortedLeads.length === 0 && (
              <div style={{ padding: "64px 32px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: P.glass, border: `1px solid ${P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Search size={22} color={P.txt3} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: P.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Sin resultados</p>
                <p style={{ fontSize: 12, color: P.txt3, marginBottom: 20 }}>Intenta con otro término, etapa o asesor</p>
                <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ padding: "8px 20px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 12, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                >Limpiar todos los filtros</button>
              </div>
            )}
          </>
        )}

        {/* ── KANBAN — drag & drop ── */}
        {viewMode === "kanban" && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "16px", minHeight: 480, alignItems: "flex-start", scrollbarWidth: "thin", scrollbarColor: `${P.border} transparent` }}>
            {kanbanStages.map(stage => {
              const stLeads = sortedLeads.filter(l => l.st === stage);
              const stVal = stLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              const c = stgC[stage] || P.txt3;
              const isDragTarget = dragOverStage === stage;
              return (
                <div key={stage}
                  onDragOver={e => handleDragOver(e, stage)}
                  onDrop={e => handleDrop(e, stage)}
                  style={{ minWidth: 222, flex: "0 0 222px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "10px 13px 10px 11px", borderRadius: 11, background: isDragTarget ? `${c}18` : `${c}0C`, border: `1px solid ${isDragTarget ? `${c}50` : `${c}28`}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 700, color: c, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage}</p>
                        {stLeads.length > 0 && <p style={{ fontSize: 9.5, color: P.txt3 }}>${(stVal/1000000).toFixed(1)}M</p>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c, background: `${c}18`, border: `1px solid ${c}28`, padding: "2px 9px", borderRadius: 99, flexShrink: 0, fontFamily: fontDisp }}>{stLeads.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 7, minHeight: 60, borderRadius: 11, padding: isDragTarget ? "6px" : "0", background: isDragTarget ? "rgba(255,255,255,0.022)" : "transparent", transition: "all 0.15s" }}>
                    {stLeads.map(l => {
                      const sc = l.sc;
                      const isDragging = dragLeadId === l.id;
                      return (
                        <div key={l.id}
                          draggable
                          onDragStart={e => handleDragStart(e, l.id)}
                          onDragEnd={handleDragEnd}
                          style={{ borderRadius: 13, background: "rgba(255,255,255,0.032)", border: `1px solid ${P.border}`, overflow: "hidden", transition: "all 0.2s", cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.background = "rgba(255,255,255,0.052)"; e.currentTarget.style.borderColor = P.borderH; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.032)"; e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ height: 2, background: `linear-gradient(90deg, ${c}AA, transparent)` }} />
                          <div style={{ padding: "12px 13px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 7, gap: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#FFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{l.n}</p>
                                <p style={{ fontSize: 9.5, color: P.txt3 }}>{l.asesor?.split(" ")[0]} · {l.campana}</p>
                              </div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.02em", flexShrink: 0 }}>{l.budget}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}><div style={{ width: `${sc}%`, height: "100%", borderRadius: 2, background: P.accent }} /></div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: P.txt2, fontFamily: fontDisp, minWidth: 18 }}>{sc}</span>
                            </div>
                            {l.daysInactive >= 5 && <p style={{ fontSize: 9.5, color: P.txt3, marginBottom: 7 }}>{l.daysInactive}d sin actividad</p>}
                            {/* Selector de etapa inline */}
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
                              <select value={l.st} onChange={e => setLeadsData(prev => prev.map(x => x.id === l.id ? {...x, st: e.target.value} : x))}
                                style={{ width: "100%", padding: "5px 8px", borderRadius: 7, background: `${c}0C`, border: `1px solid ${c}28`, color: c, fontSize: 9.5, fontWeight: 700, cursor: "pointer", outline: "none", appearance: "none" }}>
                                {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: "#fff" }}>{s}</option>)}
                              </select>
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`, l)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, background: `${P.accent}10`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 9.5, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = `${P.accent}1E`} onMouseLeave={e => e.currentTarget.style.background = `${P.accent}10`}>Analizar</button>
                              <button onClick={() => togglePin(l.id)} title={pinnedIds.has(l.id) ? "Quitar de prioridad" : "Añadir a prioridad"} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: pinnedIds.has(l.id) ? `${P.accent}12` : "transparent", border: `1px solid ${pinnedIds.has(l.id) ? `${P.accent}36` : P.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = `${P.accent}1A`; }} onMouseLeave={e => { e.currentTarget.style.background = pinnedIds.has(l.id) ? `${P.accent}12` : "transparent"; }}><Star size={10} color={pinnedIds.has(l.id) ? P.accent : P.txt3} fill={pinnedIds.has(l.id) ? P.accent : "none"} strokeWidth={2} /></button>
                              <button onClick={() => setSelectedLead(l)} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = P.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}><User size={10} color={P.txt3} /></button>
                              <button onClick={() => setNotesLead(l)} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = P.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}><FileText size={10} color={P.txt3} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stLeads.length === 0 && (
                      <div style={{ padding: "28px 16px", borderRadius: 11, border: `1px dashed ${isDragTarget ? `${c}50` : P.border}`, textAlign: "center", background: isDragTarget ? `${c}06` : "transparent", transition: "all 0.15s" }}>
                        <p style={{ fontSize: 10.5, color: isDragTarget ? c : P.txt3 }}>{isDragTarget ? "Soltar aquí" : "Sin clientes"}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </G>

      {/* ── ANALYTICS ROW — responsive wrap ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>

        {/* Score por Cliente */}
        <G style={{ paddingBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp, margin: 0 }}>Score por Cliente</p>
            <Pill color={P.blue} s>Top {Math.min(sortedLeads.length, 8)}</Pill>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={[...sortedLeads].sort((a,b) => b.sc - a.sc).slice(0,8).map(l => ({ n: l.n.split(" ")[0], sc: l.sc }))}
              margin={{ top: 2, right: 4, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="n" tick={{ fill: P.txt3, fontSize: 9, fontFamily: font }} axisLine={false} tickLine={false} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fill: P.txt3, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: "#0C1219", border: `1px solid ${P.border}`, borderRadius: 10, color: P.txt, fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v) => [`Score: ${v}`, ""]} />
              <Bar dataKey="sc" radius={[5, 5, 0, 0]} maxBarSize={32}>
                {[...sortedLeads].sort((a,b) => b.sc - a.sc).slice(0,8).map((l, i) => (
                  <Cell key={i} fill={l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.cyan} opacity={0.88} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </G>

        {/* Distribución por etapa */}
        <G style={{ paddingBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp, margin: 0 }}>Distribución</p>
            {filterStage !== "TODO" && (
              <button onClick={() => setFilterStage("TODO")} style={{ fontSize: 9.5, color: P.txt3, background: "none", border: "none", cursor: "pointer", fontFamily: font, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = P.txt2}
                onMouseLeave={e => e.currentTarget.style.color = P.txt3}
              >✕ Quitar filtro</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {STAGES.map(st => {
              const cnt = visibleLeads.filter(l => l.st === st).length;
              if (cnt === 0) return null;
              const pct = Math.round((cnt / visibleLeads.length) * 100);
              const isActive = filterStage === st;
              const c = stgC[st] || P.txt3;
              return (
                <div key={st} onClick={() => setFilterStage(isActive ? "TODO" : st)}
                  style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "3px 5px", borderRadius: 6, transition: "background 0.15s", background: isActive ? `${c}0C` : "transparent" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: isActive ? `0 0 5px ${c}` : "none" }} />
                  <span style={{ fontSize: 10, color: isActive ? "#FFF" : P.txt2, flex: "0 0 auto", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive ? 700 : 400, fontFamily: font }}>{st}</span>
                  <div style={{ flex: 1, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.05)", minWidth: 12 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: c, transition: "width 0.5s", opacity: isActive ? 1 : 0.6 }} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: isActive ? c : P.txt2, fontFamily: fontDisp, minWidth: 16, textAlign: "right", flexShrink: 0 }}>{cnt}</span>
                </div>
              );
            })}
          </div>
        </G>

        {/* Por Asesor */}
        <G style={{ paddingBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp, margin: 0 }}>Por Asesor</p>
            {filterAsesor !== "TODO" && (
              <button onClick={() => setFilterAsesor("TODO")} style={{ fontSize: 9.5, color: P.txt3, background: "none", border: "none", cursor: "pointer", fontFamily: font, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = P.txt2}
                onMouseLeave={e => e.currentTarget.style.color = P.txt3}
              >✕ Quitar</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {asesores.map((a, i) => {
              const aLeads = visibleLeads.filter(l => l.asesor === a);
              const cnt = aLeads.length;
              const val = aLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              const avgSc = Math.round(aLeads.reduce((s, l) => s + l.sc, 0) / cnt);
              const aCols = [P.accent, P.blue, P.violet, P.amber, P.cyan, P.emerald];
              const c = aCols[i % aCols.length];
              const isActive = filterAsesor === a;
              return (
                <div key={a} onClick={() => setFilterAsesor(isActive ? "TODO" : a)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 10, background: isActive ? `${c}12` : P.glass, border: `1px solid ${isActive ? `${c}35` : P.border}`, cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; } }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${c}1E`, border: `1px solid ${c}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: c, flexShrink: 0, fontFamily: fontDisp }}>{a.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11.5, color: isActive ? "#FFF" : P.txt2, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, fontFamily: fontDisp }}>{a.split(" ")[0]}</p>
                    <p style={{ fontSize: 9, color: P.txt3, margin: 0, fontFamily: font }}>{cnt} clientes · score {avgSc}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: fontDisp, flexShrink: 0 }}>${(val/1000000).toFixed(1)}M</span>
                </div>
              );
            })}
          </div>
        </G>
      </div>

      {/* Panels */}
      <NotesModal lead={notesLead} onClose={() => setNotesLead(null)} onSave={saveNotes} />
      <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} oc={oc} onUpdate={updateLead} onOpenNotes={() => { setNotesLead(selectedLead); setSelectedLead(null); }} />
    </div>
  );
}


const ERP = ({ oc, properties = MOCK_PROPS }) => {
  const erpProjects = properties.length > 0 ? properties : [
    { n: "Gobernador 28", loc: "Playa del Carmen", st: "Construcción", c: P.blue, roi: "24%", u: 48, s: 36, v: "$4.2M", m: 31, f: "Q2 2026", t: "Residencial Premium" },
    { n: "Monarca 28", loc: "Playa del Carmen", st: "Preventa", c: P.emerald, roi: "28%", u: 56, s: 42, v: "$5.8M", m: 29, f: "Q3 2026", t: "Condominios de Lujo" },
    { n: "Portofino", loc: "Cancún", st: "Disponible", c: P.amber, roi: "26%", u: 32, s: 26, v: "$3.8M", m: 32, f: "Q1 2026", t: "Casas Residenciales" },
  ];

  const inventorySummary = {
    total: erpProjects.reduce((s, p) => s + p.u, 0),
    sold: erpProjects.reduce((s, p) => s + p.s, 0),
    available: erpProjects.reduce((s, p) => s + (p.u - p.s), 0),
    value: "$72.4M",
    avgMargin: "26.5%",
    absorption: 75.6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs Principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Unidades Totales" value={inventorySummary.total} sub="Portafolio" icon={Building2} color={P.blue} />
        <KPI label="Unidades Vendidas" value={inventorySummary.sold} sub={`${inventorySummary.absorption.toFixed(1)}%`} icon={CheckCircle2} color={P.emerald} />
        <KPI label="Valor Inventario" value={inventorySummary.value} sub="Valuación" icon={Banknote} />
        <KPI label="Margen Promedio" value={inventorySummary.avgMargin} sub="Rentabilidad" icon={Percent} color={P.violet} />
      </div>

      {/* Matriz de Proyectos */}
      <G np>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Portafolio de Proyectos</p>
          <Pill color={P.blue} s>{erpProjects.length} Proyectos Activos</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr", gap: 12, padding: "14px 22px", borderBottom: `1px solid ${P.border}`, fontSize: 10, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Proyecto</span><span>Ubicación</span><span>Estado</span><span>Unidades</span><span>Venta Rápida</span><span>Margen</span><span>Cierre</span>
        </div>
        {erpProjects.map((proj, i) => (
          <div key={i} onClick={() => oc(`Análisis detallado de ${proj.n}: Inventario ${proj.s}/${proj.u}, ROI ${proj.roi}`)} style={{
            display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr",
            gap: 12, padding: "16px 22px", borderBottom: `1px solid ${P.border}`,
            cursor: "pointer", transition: "all 0.2s",
          }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp, marginBottom: 3 }}>{proj.n}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={12} color={P.txt3} />
              <span style={{ fontSize: 11, color: P.txt2, fontFamily: font }}>{proj.loc}</span>
            </div>
            <Pill color={proj.c} s>{proj.st}</Pill>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>{proj.s}/{proj.u}</p>
              <p style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>Vendidas</p>
            </div>
            <div>
              <div style={{ height: 5, background: P.glass, borderRadius: 3, marginBottom: 4, overflow: "hidden" }}>
                <div style={{ width: `${(proj.s / proj.u) * 100}%`, height: "100%", background: proj.c, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 10, color: P.txt3, textAlign: "center" }}>{((proj.s / proj.u) * 100).toFixed(0)}%</p>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: P.emerald, fontFamily: fontDisp, textAlign: "center" }}>{proj.roi}</p>
            <p style={{ fontSize: 11, color: P.txt2, fontFamily: font, textAlign: "center" }}>Q4 2025</p>
          </div>
        ))}
      </G>

      {/* Análisis de Inventario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <G>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14, fontFamily: fontDisp }}>Distribución de Inventario</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Vendidas", val: inventorySummary.sold, c: P.emerald },
              { label: "Disponibles", val: inventorySummary.available, c: P.blue },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: P.txt2, fontFamily: font, minWidth: 80 }}>{s.label}</span>
                <div style={{ flex: 1, height: 8, background: P.glass, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(s.val / inventorySummary.total) * 100}%`, height: "100%", background: s.c }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.c, fontFamily: fontDisp, minWidth: 45, textAlign: "right" }}>{s.val}</span>
              </div>
            ))}
          </div>
        </G>

        <G>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14, fontFamily: fontDisp }}>Métricas Financieras</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "12px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginBottom: 6 }}>Valor Generado</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: P.emerald, fontFamily: fontDisp }}>${(inventorySummary.sold * 0.6).toFixed(1)}M</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginBottom: 6 }}>Pipeline Activo</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: P.blue, fontFamily: fontDisp }}>$18.7M</p>
            </div>
          </div>
        </G>
      </div>
    </div>
  );
};

const Team = ({ team = MOCK_TEAM, properties = MOCK_PROPS }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Eficiencia Operativa" value="87.5%" sub="+5.2%" icon={Gauge} color={P.emerald} />
      <KPI label="Horas de Concentración" value="24.6h" icon={Timer} color={P.violet} />
      <KPI label="Ventas Cerradas (Trim.)" value="42" sub="+18%" icon={Trophy} />
      <KPI label="Ventas Consecutivas" value="8" icon={Flame} color={P.rose} />
    </div>
    <G np>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.border}` }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: P.txt, fontFamily: font }}>Rendimiento del Equipo</p>
      </div>
      {/* Header row */}
      <div style={{
        display: "grid", gridTemplateColumns: "220px 60px 80px 100px 90px 50px",
        gap: 12, alignItems: "center", padding: "8px 20px", borderBottom: `1px solid ${P.border}`,
        fontSize: 10, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600,
      }}>
        <span>Asesor</span><span>Deals</span><span>Revenue</span><span>Eficiencia</span><span>Tendencia</span><span style={{ textAlign: "right" }}>Racha</span>
      </div>
      {team.map((m, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "220px 60px 80px 100px 90px 50px",
          gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Ico icon={User} sz={36} is={15} c={P.accent} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: P.txt, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.n}</p>
              <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginTop: 2 }}>{m.r}</p>
            </div>
          </div>
          <span style={{ color: "#FFFFFF", fontWeight: 500, fontSize: 14, fontFamily: fontDisp }}>{m.d}</span>
          <span style={{ color: "#FFFFFF", fontWeight: 500, fontSize: 13, fontFamily: fontDisp }}>{m.rv}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: P.border }}>
              <div style={{ width: `${m.e}%`, height: 4, borderRadius: 2, background: m.e > 85 ? P.emerald : m.e > 70 ? P.blue : P.rose, boxShadow: `0 0 8px ${m.e > 85 ? P.emerald : m.e > 70 ? P.blue : P.rose}40` }} />
            </div>
            <span style={{ fontSize: 11, color: m.e > 85 ? P.emerald : m.e > 70 ? P.blue : P.rose, fontWeight: 600, fontFamily: fontDisp }}>{m.e}%</span>
          </div>
          <div style={{ height: 28 }}>
            <ResponsiveContainer width="100%" height={28}>
              <BarChart data={properties.map(p=>({name:p.n, s:p.s}))}>
                <Bar dataKey="s" fill={P.accent} radius={[0, 4, 4, 0]} name="Vendidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <Flame size={14} color={m.sk >= 7 ? P.accent : P.txt3} />
            <span style={{ color: "#FFFFFF", fontWeight: 600, fontSize: 15, fontFamily: fontDisp }}>{m.sk}</span>
          </div>
        </div>
      ))}
    </G>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <G>
        <p style={{ fontSize: 13, fontWeight: 500, color: P.txt, marginBottom: 12, fontFamily: font }}>Metodología</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { t: "Concentración 4h/día", d: "Bloques sin interrupciones", i: Timer, c: P.violet },
            { t: "Principio 80/20", d: "IA asigna leads de impacto", i: Crosshair, c: P.accent },
            { t: "Coaching Inteligente", d: "Feedback post-llamada", i: Lightbulb, c: P.amber },
            { t: "Sprints Semanales", d: "OKRs en metas medibles", i: Flame, c: P.rose },
          ].map(m => (
            <div key={m.t} style={{ display: "flex", gap: 10, padding: 12, borderRadius: P.rs, background: `${m.c}06`, border: `1px solid ${m.c}10` }}>
              <Ico icon={m.i} sz={32} is={15} c={m.c} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#FFFFFF", fontFamily: font }}>{m.t}</p>
                <p style={{ fontSize: 10.5, color: P.txt3, marginTop: 1, fontFamily: font }}>{m.d}</p>
              </div>
            </div>
          ))}
        </div>
      </G>
      <G>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 12 }}>Revenue por asesor</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={team} layout="vertical">
            <XAxis type="number" tick={{ fill: P.txt3, fontSize: 10, fontFamily: fontDisp }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="n" tick={{ fill: P.txt2, fontSize: 10, fontFamily: font }} axisLine={false} tickLine={false} width={95} />
            <Bar dataKey="d" fill={P.accent} radius={[0, 4, 4, 0]} barSize={14} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
      </G>
    </div>
  </div>
);

/* ════════════════════════════════════════
   IA CRM — CALL CENTER INTELLIGENCE
   ════════════════════════════════════════ */

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

const AsesorCRM = ({ oc, leads = MOCK_LEADS, updateDb }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODO");

  // Filtro y búsqueda optimizados con useMemo
  const filteredData = useMemo(() => {
    return leads.filter(r => {
      const matchesSearch = (r.n || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.asesor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (r.tel || "").includes(searchTerm);
      const matchesFilter = filterStatus === "TODO" || (r.st || "").includes(filterStatus);
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, filterStatus, leads]);

  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>CRM de Asesores</p>
        <p style={{ fontSize: 11, color: P.txt3, fontFamily: font, marginTop: 2 }}>Backup de Datos · Gestión de Clientes · Seguimiento Integral</p>
      </div>
      <Pill color={P.accent} s>{crmAsesores.length} registros</Pill>
    </div>

    {/* Stats */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <KPI label="Registros Totales" value={leads.length} icon={FileText} color={P.blue} />
      <KPI label="Zeta Agendados" value={leads.filter(r => (r.st || "").includes("ZOOM")).length} sub="próximos" icon={CalendarDays} color={P.emerald} />
      <KPI label="En Seguimiento" value={leads.filter(r => (r.st || "").includes("SEGUIMIENTO")).length} sub="active" icon={Phone} color={P.amber} />
      <KPI label="Sin Respuesta" value={leads.filter(r => (r.st || "").includes("NO CONTESTA")).length} sub="reactivar" icon={Bell} color={P.rose} />
    </div>

    {/* Tabla de datos con búsqueda y filtrado */}
    <G np>
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "8px 12px", background: P.glass, border: `1px solid ${P.border}`, borderRadius: P.rx }}>
            <Search size={14} color={P.txt3} />
            <input
              type="text"
              placeholder="Buscar cliente, asesor o teléfono..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                background: "transparent", border: "none", outline: "none",
                fontSize: 12, color: P.txt, width: "100%", fontFamily: font
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px", background: P.glass, border: `1px solid ${P.border}`,
              borderRadius: P.rx, fontSize: 11, color: P.txt2, fontFamily: font, cursor: "pointer"
            }}
          >
            <option value="TODO">Todos los status</option>
            <option value="ZOOM">Zoom Agendado</option>
            <option value="SEGUIMIENTO">Seguimiento</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="NO CONTESTA">No Contesta</option>
          </select>
        </div>
        <button onClick={() => oc("Exportar datos de CRM para respaldo")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: P.rx, background: P.glass, border: `1px solid ${P.border}`, fontSize: 11, color: P.txt2, cursor: "pointer", fontFamily: font, marginLeft: 12 }}><Download size={12} /> Exportar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 1.2fr 0.9fr 0.9fr 1fr 0.6fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
        <span>Fecha</span><span>Asesor</span><span>Cliente</span><span>Teléfono</span><span>Status</span><span>Presupuesto</span><span>Proyecto</span><span>Campaña</span>
      </div>
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {filteredData.length > 0 ? filteredData.map((r, i) => {
          const statusColor = (r.st || "").includes("ZOOM") ? P.emerald : (r.st || "").includes("SEGUIMIENTO") ? P.blue : (r.st || "").includes("WHATSAPP") ? P.cyan : P.rose;
          return (
            <div key={i} onClick={() => oc(`Detalles de ${r.n}: ${r.notes || "Sin notas"}`)} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 1.2fr 0.9fr 0.9fr 1fr 0.6fr",
              gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: `1px solid ${P.border}`,
              fontSize: 11, cursor: "pointer", transition: "background 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: P.txt3, fontFamily: font, fontSize: 10 }}>{r.date || "—"}</span>
              <span style={{ color: P.txt, fontWeight: 500, fontFamily: font }}>{r.asesor}</span>
              <span style={{ color: P.txt, fontWeight: 500, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.n}</span>
              <span style={{ color: P.txt2, fontFamily: "monospace", fontSize: 10 }}>{r.tel}</span>
              <Pill color={statusColor} s>{r.st}</Pill>
              <span style={{ color: r.budget ? P.emerald : P.txt3, fontWeight: 500, fontFamily: fontDisp, fontSize: 10 }}>{r.budget || "—"}</span>
              <span style={{ color: P.txt2, fontSize: 10, fontFamily: font }}>{r.project}</span>
              <span style={{ color: P.txt3, fontSize: 9 }}>{r.camp || "—"}</span>
            </div>
          );
        }) : (
          <div style={{ padding: "40px 20px", textAlign: "center", color: P.txt3 }}>
            <Search size={32} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 12, fontFamily: font }}>No se encontraron registros con "{searchTerm}"</p>
          </div>
        )}
      </div>
    </G>

    {/* Pipeline por Etapas - Kanban View */}
    <G np>
      <div style={{ padding: "18px 22px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Pipeline de Ventas</p>
        <Pill color={P.emerald} s>{pipe.reduce((a, b) => a + b.val, 0)} Total</Pill>
      </div>
      <div style={{ padding: "16px 22px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {pipe.map((stage, idx) => {
          const icons = [Target, Eye, Briefcase, CheckCircle2];
          const Icon = icons[idx];
          const statusLabel = stage.val > 25 ? "Volumen Alto" : stage.val >= 12 ? "Moderado" : "Necesita Impulso";
          return (
            <div key={stage.name} style={{
              display: "flex", flexDirection: "column",
              padding: "16px", borderRadius: 12,
              background: `${stage.c}06`, border: `1.5px solid ${stage.c}20`,
              boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
            }}>
              {/* Header con Icono */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ padding: "8px", background: `${stage.c}16`, borderRadius: 8 }}>
                  <Icon size={18} color={stage.c} strokeWidth={2.2} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>{stage.name}</p>
                  <p style={{ fontSize: 9, color: P.txt3, fontFamily: font }}>Etapa {idx + 1}</p>
                </div>
              </div>

              {/* Contador Principal */}
              <div style={{
                background: `${stage.c}12`,
                padding: "14px",
                borderRadius: 8,
                marginBottom: 14,
                border: `1px solid ${stage.c}24`,
              }}>
                <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginBottom: 4 }}>Clientes Activos</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: stage.c, fontFamily: fontDisp }}>{stage.val}</p>
              </div>

              {/* Barra de Progreso */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ height: 7, borderRadius: 4, background: P.glass, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{
                    height: "100%",
                    width: `${(stage.val / 70) * 100}%`,
                    background: `linear-gradient(90deg, ${stage.c}, ${stage.c}dd)`,
                    boxShadow: `0 0 12px ${stage.c}60`,
                    transition: "width 0.6s ease"
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 9, color: P.txt3, fontFamily: font }}>Tasa Conversión</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: stage.c, fontFamily: fontDisp }}>
                    {((stage.val / 70) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Status Label */}
              <div style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: stage.val > 25 ? "rgba(109,212,168,0.1)" : stage.val >= 12 ? "rgba(123,183,209,0.1)" : "rgba(232,129,140,0.1)",
                border: `1px solid ${stage.val > 25 ? P.emerald : stage.val >= 12 ? P.blue : P.rose}30`,
                fontSize: 10,
                color: stage.val > 25 ? P.emerald : stage.val >= 12 ? P.blue : P.rose,
                fontFamily: font,
                textAlign: "center",
                fontWeight: 600
              }}>
                {statusLabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen de Pipeline */}
      <div style={{ padding: "14px 22px", borderTop: `1px solid ${P.border}`, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div style={{ padding: "10px 12px", background: P.glass, border: `1px solid ${P.border}`, borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginBottom: 4 }}>Tasa Conv. Prom.</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.accent, fontFamily: fontDisp }}>
            {(pipe.reduce((a, b) => a + (b.val / 70) * 100, 0) / 4).toFixed(1)}%
          </p>
        </div>
        <div style={{ padding: "10px 12px", background: P.glass, border: `1px solid ${P.border}`, borderRadius: 8, textAlign: "center" }}>
          <p style={{ fontSize: 10, color: P.txt3, fontFamily: font, marginBottom: 4 }}>Próxima Etapa</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: P.blue, fontFamily: fontDisp }}>
            {pipe[1].val} clientes
          </p>
        </div>
      </div>
    </G>

    {/* Notas de clientes */}
    <G>
      <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14 }}>Notas y Contexto de Clientes</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {crmAsesores.slice(0, 6).map((r, i) => (
          <div key={i} style={{ padding: "12px", borderRadius: P.rs, background: `${r.status.includes("ZOOM") ? P.emerald : r.status.includes("SEGUIMIENTO") ? P.blue : r.status.includes("NO CONTESTA") ? P.rose : P.cyan}08`, border: `1px solid ${r.status.includes("ZOOM") ? P.emerald : r.status.includes("SEGUIMIENTO") ? P.blue : r.status.includes("NO CONTESTA") ? P.rose : P.cyan}14` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: P.txt, fontFamily: font }}>{r.cliente}</p>
              <Pill color={r.status.includes("ZOOM") ? P.emerald : r.status.includes("SEGUIMIENTO") ? P.blue : r.status.includes("NO CONTESTA") ? P.rose : P.cyan} s>{r.status}</Pill>
            </div>
            <p style={{ fontSize: 11, color: P.txt2, lineHeight: 1.5, fontFamily: font }}>{r.notas}</p>
            <p style={{ fontSize: 10, color: P.txt3, marginTop: 8, fontFamily: font }}>Asesor: <b>{r.asesor}</b> | Presupuesto: <b>{r.presupuesto || "Por determinar"}</b></p>
          </div>
        ))}
      </div>
    </G>
  </div>
  );
};

const IACRM = ({ oc, leads = MOCK_LEADS, updateDb }) => (
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

/* ════════════════════════════════════════
   CHAT PANEL
   ════════════════════════════════════════ */
const Chat = ({ open, onClose, msgs, setMsgs, inp, setInp, leads = MOCK_LEADS }) => {
  const endRef = useRef(null);
  const [typing, setTyping] = useState(false);
  const [rec, setRec] = useState(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const send = (t) => {
    if (!t?.trim()) return;
    setMsgs(p => [...p, { role: "u", text: t.trim() }]);
    setInp(""); setTyping(true);
    setTimeout(() => {
      const r = getResp(t, null, leads);
      setMsgs(p => [...p, { role: "a", ...r }]);
      setTyping(false);
    }, 1000 + Math.random() * 600);
  };

  const doVoice = () => {
    if (rec) { setRec(false); send(examples[0].t); }
    else { setRec(true); setTimeout(() => { setRec(false); send(examples[0].t); }, 2800); }
  };

  if (!open) return null;
  return (
    <div style={{
      width: 400, height: "100%", borderLeft: `1px solid ${P.border}`,
      background: "rgba(6,10,17,0.96)", backdropFilter: "blur(32px)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(110,231,194,0.06)", border: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StratosAtom size={18} color={P.accent} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Agente Stratos</p>
            <p style={{ fontSize: 10, color: P.txt3, fontWeight: 400, fontFamily: font }}>Inteligencia Activa</p>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} color={P.txt3} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, paddingTop: 20 }}>
            <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: P.glass, border: `1px solid ${P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <StratosAtom size={32} color={P.accent} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Agente Ejecutivo</p>
              <p style={{ fontSize: 12, color: P.txt3, marginTop: 6, fontFamily: font, lineHeight: 1.5 }}>Inteligencia estratégica lista. ¿Qué decisión tomamos?</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { t: "Reporte de Riesgo: Portofino", i: Shield, c: P.rose, cat: "Análisis Crítico" },
                { t: "Dossier: James Mitchell", i: User, c: P.blue, cat: "Cierre Inminente" },
                { t: "Resumen de Pipeline 80/20", i: Target, c: P.emerald, cat: "Estratégico" },
                { t: "Protocolo de Cierre: Rodríguez", i: Zap, c: P.amber, cat: "VIP Intelligence" }
              ].map((e, i) => (
                <button key={i} onClick={() => send(e.t)} style={{
                  padding: "16px 14px", borderRadius: 16, border: `1px solid ${P.border}`,
                  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(4px)",
                  cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 10,
                  transition: "all 0.3s cubic-bezier(.4,0,.2,1)", position: "relative", overflow: "hidden"
                }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = P.accentB; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = P.border; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${e.c}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <e.i size={16} color={e.c} />
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: P.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{e.cat}</p>
                    <p style={{ fontSize: 11, color: P.txt, fontWeight: 600, lineHeight: 1.3 }}>{e.t}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "u" ? "flex-end" : "flex-start" }}>
            {m.role === "u" ? (
              <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: `${P.accent}14`, border: `1px solid ${P.accentB}`, fontSize: 12.5, color: P.txt, lineHeight: 1.5 }}>{m.text}</div>
            ) : (
              <div style={{ maxWidth: "95%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(110,231,194,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}><StratosAtom size={14} color={P.accent} /></div>
                  <span style={{ fontSize: 10, color: P.txt2, fontWeight: 600, letterSpacing: "0.04em" }}>Agente Stratos</span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "4px 14px 14px 14px", background: P.glass, border: `1px solid ${P.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                  <p style={{ fontSize: 13, color: P.txt, lineHeight: 1.6, marginBottom: m.metrics ? 12 : 0 }} dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFFFFF">$1</strong>') }} />
                  {m.metrics && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {m.metrics.map((x, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: P.rx, background: `${x.c}0D`, border: `1px solid ${x.c}22` }}>
                          <Ico icon={x.i} sz={32} is={16} c={x.c} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 600, fontFamily: fontDisp }}>{x.label}</p>
                            <p style={{ fontSize: 11, color: P.txt2, lineHeight: 1.4 }}>{x.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.follow && <p style={{ fontSize: 11.5, color: P.txt3, marginTop: 14, lineHeight: 1.5, fontStyle: "italic", borderTop: `1px solid ${P.border}`, paddingTop: 10 }} dangerouslySetInnerHTML={{ __html: m.follow.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#E2E8F0">$1</strong>') }} />}
                  {m.btn && (
                    <button onClick={() => m.action && send(m.action)} style={{
                      marginTop: 14, width: "100%", padding: "11px 16px", borderRadius: 10,
                      background: "rgba(255,255,255,0.93)", color: "#0A0F18", fontWeight: 700, fontSize: 12,
                      border: "none", cursor: "pointer", transition: "all 0.25s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 2px 12px rgba(255,255,255,0.1)", letterSpacing: "0.01em"
                    }} onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,255,255,0.2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.93)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(255,255,255,0.1)"; }}>
                      {m.btn} <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StratosAtom size={16} color={P.accent} />
            <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderRadius: 12, background: P.glass }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: P.accent, animation: `blink 1.2s ease ${i * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "10px 14px", borderTop: `1px solid ${P.border}` }}>
        {rec && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "7px 12px", borderRadius: P.rx, background: `${P.rose}0C`, border: `1px solid ${P.rose}1A` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.rose, animation: "blink 0.8s infinite" }} />
            <span style={{ fontSize: 11, color: P.rose, fontWeight: 600 }}>Grabando...</span>
            <div style={{ flex: 1, display: "flex", gap: 2, justifyContent: "center" }}>
              {[...Array(14)].map((_, i) => <div key={i} style={{ width: 2, borderRadius: 1, background: P.rose, height: 3 + Math.random() * 12, opacity: 0.4, animation: `wave 0.35s ease ${i * 0.04}s infinite alternate` }} />)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 14, background: P.glass, border: `1px solid ${rec ? P.rose + "30" : P.border}` }}>
          <button onClick={doVoice} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: rec ? `${P.rose}18` : P.accentS, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {rec ? <MicOff size={15} color={P.rose} /> : <Mic2 size={15} color={P.accent} />}
          </button>
          <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send(inp)}
            placeholder="Escribe o usa voz..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: P.txt, fontSize: 13, fontFamily: font }} />
          <button onClick={() => send(inp)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: inp.trim() ? P.accentS : "transparent", display: "flex", alignItems: "center", justifyContent: "center", opacity: inp.trim() ? 1 : 0.25 }}>
            <Send size={14} color={P.accent} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════ */
/* CRM de Asesores - Backup de datos */
const crmAsesores = [
  { fecha: "1 Abril 8:37pm", asesor: "Emmanuel Ortiz", cliente: "Tony Norberto", tel: "1 818 359 3113", status: "ZOOM AGENDADO", presupuesto: "200k max", proyecto: "Gobernador 28", notas: "Alta intención", campaña: "CANCUN" },
  { fecha: "1 Abril 10:26 AM", asesor: "Araceli Oneto", cliente: "Jesus", tel: "1 254 426 1946", status: "ZOOM AGENDADO", presupuesto: "300 a 350 K", proyecto: "Portofino", notas: "2 REC. Entrega inmediata", campaña: "CANCUN" },
  { fecha: "1 Abril 9:48 AM", asesor: "Araceli Oneto", cliente: "Manny", tel: "1(949)2958831", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Monarca 28", notas: "Llamar 2 de Abril", campaña: "CANCUN" },
  { fecha: "1 Abril 9:48 AM", asesor: "Araceli Oneto", cliente: "Vanezza", tel: "1(469)4325125", status: "NO CONTESTA", presupuesto: "", proyecto: "Gobernador 28", notas: "Revisar", campaña: "" },
  { fecha: "1 Abril 10:46 AM", asesor: "Araceli Oneto", cliente: "Thiago", tel: "1(203)2407136", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Portofino", notas: "Llamar 2 de abril nos quedamos a medias del discovery", campaña: "CANCUN" },
  { fecha: "1 Abril 1:49 PM", asesor: "Araceli Oneto", cliente: "Valente", tel: "1(747)3249111", status: "NO CONTESTA", presupuesto: "", proyecto: "Monarca 28", notas: "Intentar nuevamente", campaña: "" },
  { fecha: "1 Abril 4:59 PM", asesor: "Araceli Oneto", cliente: "Karina", tel: "1(915)8417793", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Gobernador 28", notas: "Su esposo fue el que pidió la info", campaña: "CANCUN" },
  { fecha: "1 Abril 4:59 PM", asesor: "Cecilia Mendoza", cliente: "ELISABETH STORE", tel: "1 323 425 1090", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Portofino", notas: "Está ocupada, buscando horario para Discovery", campaña: "CANCUN" },
  { fecha: "1 Abril 6:41 PM", asesor: "Araceli Oneto", cliente: "Miguel Angel", tel: "1(562)8261691", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Monarca 28", notas: "Seguimiento", campaña: "" },
  { fecha: "1 Abril 9:21 PM", asesor: "Araceli Oneto", cliente: "Jairo", tel: "1(470)8853451", status: "ZOOM AGENDADO", presupuesto: "1,000,000.00 USD", proyecto: "Gobernador 28", notas: "Quiere depa beach front", campaña: "CANCUN" },
  { fecha: "1 Abril 9:21 PM", asesor: "Cecilia Mendoza", cliente: "EMOJI MARIPOSA TREBOL BANDERA", tel: "1 305 338 4643", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Portofino", notas: "Está ocupada, buscando horario para Discovery", campaña: "CANCUN" },
  { fecha: "1 Abril 04:35 AM", asesor: "Cecilia Mendoza", cliente: "JMZ", tel: "1 760 409 9288", status: "NO CONTESTA", presupuesto: "", proyecto: "Monarca 28", notas: "2 llamada, intentando x msj", campaña: "" },
  { fecha: "1 Abril 10:53 AM", asesor: "Araceli Oneto", cliente: "Oscar", tel: "1(972)6076102", status: "NO CONTESTA", presupuesto: "", proyecto: "Gobernador 28", notas: "Revisar", campaña: "" },
  { fecha: "1 Abril 12:24 PM", asesor: "Araceli Oneto", cliente: "Alex Rojo", tel: "1(818)7547696", status: "WHATSAPP", presupuesto: "", proyecto: "Portofino", notas: "Me pidió precio del depa", campaña: "CANCUN" },
  { fecha: "2 Abril 3:30PM", asesor: "Emmanuel Ortiz", cliente: "FANI HERNANDEZ", tel: "1 (512) 952 5076", status: "SEGUIMIENTO", presupuesto: "", proyecto: "Monarca 28", notas: "Seguimiento", campaña: "CANCUN" },
  { fecha: "2 Abril 12:07 PM", asesor: "Estefanía Valdes", cliente: "RAFAEL", tel: "1 8176823272", status: "ZOOM AGENDADO", presupuesto: "200 K", proyecto: "Gobernador 28", notas: "Meet: Sábado 4 de abril 10 am", campaña: "CANCUN" },
  { fecha: "2 Abril 03:58 PM", asesor: "Cecilia Mendoza", cliente: "KALLO", tel: "1 720 459 0388", status: "NO CONTESTA", presupuesto: "", proyecto: "Portofino", notas: "2 llamada, intentando x msj", campaña: "CANCUN" },
];

const nav = [
  { id: "d", l: "Comando", i: Activity },
  { id: "c", l: "CRM", i: Users },
  { id: "ia", l: "IA CRM", i: Atom },
  { id: "e", l: "ERP", i: Building2 },
  { id: "a", l: "Asesores", i: Trophy },
  { id: "lp", l: "Landing Pages", i: Globe },
  { id: "fa", l: "Finanzas", i: Landmark },
  { id: "rrhh", l: "Personas", i: UserCheck },
  { id: "planes", l: "Planes", i: CreditCard, sep: true },
  { id: "admin", l: "Usuarios", i: Shield, sep: true, adminOnly: true },
];

/* ════════════════════════════════════════
   LANDING PAGES — GENERADOR PREMIUM v2
   Propiedades Reales Riviera Maya 2025-2026
   ════════════════════════════════════════ */

/* WriterSection: Rich message composer for client personalization */
const WriterSection = ({ value, onChange, clientName }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("formal");
  const charLimit = 500;
  const charCount = value.length;

  const templates = {
    formal: {
      label: "Formal",
      text: `Estimado ${clientName || "cliente"}, fue un placer hablar contigo. Aquí te presento una selección curada de las mejores oportunidades de inversión en la Riviera Maya, elegidas específicamente para tus objetivos financieros.`
    },
    warm: {
      label: "Cálido",
      text: `Hola ${clientName || "cliente"}, basándome en nuestra conversación, seleccioné estas propiedades que creo que se adaptan perfectamente a lo que buscas. Cada una ofrece excelentes rendimientos y ubicación estratégica en la Riviera Maya.`
    },
    exclusive: {
      label: "Exclusivo",
      text: `${clientName || "Cliente"}, te presentamos acceso exclusivo a nuestras propiedades premium seleccionadas. Estas oportunidades limitadas combinan ubicación de ensueño, diseño arquitectónico de clase mundial y rendimientos superiores.`
    },
    investment: {
      label: "Inversión",
      text: `${clientName || "Cliente"}, esta cartera de propiedades representa el mejor análisis de rentabilidad en el mercado actual. Proyecciones de ROI 8-13% anual con plusvalía garantizada en la Riviera Maya.`
    }
  };

  const applyTemplate = (templateKey) => {
    setSelectedTemplate(templateKey);
    onChange(templates[templateKey].text);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 10, fontWeight: 600, letterSpacing: "0.03em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Mensaje personalizado</span>
        <span style={{ fontSize: 10, color: P.txt3, fontWeight: 400 }}>{charCount}/{charLimit}</span>
      </label>

      {/* Templates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            onClick={() => applyTemplate(key)}
            style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${selectedTemplate === key ? P.accent + "60" : P.border}`,
              background: selectedTemplate === key ? P.accentS : P.glass,
              color: selectedTemplate === key ? P.accent : P.txt2,
              cursor: "pointer", fontFamily: font, transition: "all 0.2s",
            }}
          >
            {template.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <textarea
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= charLimit) onChange(e.target.value);
          }}
          placeholder="Escribe un mensaje personalizado o elige una plantilla arriba..."
          rows={4}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 13,
            background: P.glass, border: `1px solid ${P.border}`, color: P.txt,
            fontFamily: font, outline: "none", resize: "vertical", lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = P.accent + "60"}
          onBlur={e => e.target.style.borderColor = P.border}
          maxLength={charLimit}
        />
        <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: charCount > charLimit * 0.8 ? P.rose : P.txt3 }}>
            {charCount}/{charLimit}
          </span>
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          fontSize: 11, fontWeight: 600, color: P.accent, background: "transparent",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Vista previa en landing page
      </button>

      {/* Preview */}
      {showPreview && value && (
        <G style={{ padding: 16, background: "rgba(110,231,194,0.05)", border: `1px solid ${P.accent}1A` }}>
          <p style={{ fontSize: 10, color: P.accent, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 10, textTransform: "uppercase" }}>Cómo verá el cliente</p>
          <p style={{ fontSize: 14, color: P.txt, lineHeight: 1.7, fontFamily: font, fontStyle: "italic" }}>
            "{value}"
          </p>
        </G>
      )}
    </div>
  );
};

/* SVG art para cada propiedad — simula fotografía arquitectónica premium */
const PropArt = ({ prop, height = 220 }) => {
  const arts = {
    1: ( // Mayakaan — selva + cenote + resort
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mg1" cx="50%" cy="60%"><stop offset="0%" stopColor="#2d9b6e"/><stop offset="100%" stopColor="#061a10"/></radialGradient>
          <radialGradient id="mc1" cx="50%" cy="50%"><stop offset="0%" stopColor="#4dd8a0" stopOpacity="0.9"/><stop offset="100%" stopColor="#1a7a5a" stopOpacity="0.2"/></radialGradient>
        </defs>
        <rect width="400" height={height} fill="url(#mg1)"/>
        {/* Sky */}
        <rect width="400" height="90" fill="url(#mg1)" opacity="0.6"/>
        {/* Jungle trees */}
        {[20,60,100,140,260,300,340,380].map((x,i)=><ellipse key={i} cx={x} cy={40+i%3*12} rx={18+i%2*8} ry={35+i%3*10} fill={i%2?"#1a5a35":"#2d7a4e"} opacity="0.8"/>)}
        {/* Building silhouette */}
        <rect x="120" y="70" width="160" height="100" rx="4" fill="#0a3d22" opacity="0.9"/>
        <rect x="140" y="85" width="40" height="35" rx="2" fill="#1a7a5a" opacity="0.7"/>
        <rect x="195" y="85" width="40" height="35" rx="2" fill="#1a7a5a" opacity="0.7"/>
        <rect x="140" y="130" width="40" height="40" rx="2" fill="#2d9b6e" opacity="0.5"/>
        {/* Infinity pool */}
        <ellipse cx="200" cy="185" rx="90" ry="22" fill="#4dd8a0" opacity="0.35"/>
        <ellipse cx="200" cy="183" rx="80" ry="16" fill="#6EEDC2" opacity="0.25"/>
        {/* Cenote */}
        <ellipse cx="320" cy="170" rx="45" ry="28" fill="#1a5a8a" opacity="0.7"/>
        <ellipse cx="320" cy="170" rx="35" ry="20" fill="#4da8d8" opacity="0.5"/>
        <ellipse cx="318" cy="168" rx="18" ry="10" fill="#7DD4F0" opacity="0.6"/>
        {/* Light rays */}
        <line x1="200" y1="0" x2="200" y2="220" stroke="#6EE7C2" strokeWidth="0.5" opacity="0.1"/>
        <circle cx="80" cy="25" r="15" fill="#FFE08A" opacity="0.2"/>
        <text x="200" y="210" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PUERTO MORELOS · RIVIERA MAYA</text>
      </svg>
    ),
    2: ( // Hoxul — ocean view, Playa del Carmen
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0a1f3d"/><stop offset="50%" stopColor="#1a4a7a"/><stop offset="100%" stopColor="#0d2a4e"/></linearGradient>
          <linearGradient id="hw1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#1a6aaa" stopOpacity="0.6"/><stop offset="50%" stopColor="#4a9fd4" stopOpacity="0.8"/><stop offset="100%" stopColor="#1a6aaa" stopOpacity="0.6"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#hg1)"/>
        {/* Ocean */}
        <rect x="0" y="140" width="400" height="80" fill="url(#hw1)"/>
        {/* Wave lines */}
        {[145,158,170,182].map((y,i)=><path key={i} d={`M0 ${y} Q100 ${y-6} 200 ${y} Q300 ${y+6} 400 ${y}`} stroke="#7EB8F0" strokeWidth="1" fill="none" opacity={0.3-i*0.06}/>)}
        {/* Modern building */}
        <rect x="80" y="40" width="240" height="120" rx="6" fill="#0d2a4e" opacity="0.95"/>
        {/* Building facade grid */}
        {[0,1,2,3,4].map(col=>[0,1,2].map(row=><rect key={`${col}-${row}`} x={100+col*42} y={58+row*30} width="30" height="20" rx="2" fill="#1a5a9a" opacity="0.7"/>))}
        {/* Penthouse level */}
        <rect x="110" y="25" width="180" height="25" rx="4" fill="#0f3366" opacity="0.9"/>
        <rect x="150" y="18" width="100" height="12" rx="2" fill="#142d55" opacity="0.8"/>
        {/* Rooftop pool */}
        <ellipse cx="200" cy="35" rx="50" ry="10" fill="#4a9fd4" opacity="0.4"/>
        {/* Ocean glow */}
        <ellipse cx="200" cy="200" rx="180" ry="30" fill="#7EB8F0" opacity="0.1"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PLAYA DEL CARMEN · FRENTE AL CARIBE</text>
      </svg>
    ),
    3: ( // Zenesis — Tulum ecológico
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="zg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1a3308"/><stop offset="60%" stopColor="#2d5a14"/><stop offset="100%" stopColor="#1a3a0d"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#zg1)"/>
        {/* Sky with golden hour */}
        <rect width="400" height="80" fill="#1a2e05" opacity="0.8"/>
        <ellipse cx="350" cy="30" r="25" fill="#FFB74D" opacity="0.3"/>
        {/* Dense jungle */}
        {[0,30,70,110,160,210,260,310,360,400].map((x,i)=><ellipse key={i} cx={x} cy={20+i%4*8} rx={25+i%3*10} ry={45+i%4*15} fill={["#2d5a14","#3d7a1e","#1a4a0a","#4a8a28"][i%4]} opacity="0.85"/>)}
        {/* Low-density units — eco architecture */}
        <rect x="60" y="100" width="80" height="80" rx="8" fill="#1a3a0d" opacity="0.92"/>
        <rect x="160" y="110" width="80" height="70" rx="8" fill="#1a3a0d" opacity="0.92"/>
        <rect x="260" y="95" width="80" height="85" rx="8" fill="#1a3a0d" opacity="0.92"/>
        {/* Rooftop gardens */}
        <ellipse cx="100" cy="98" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        <ellipse cx="200" cy="108" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        <ellipse cx="300" cy="93" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        {/* Plunge pools on rooftop */}
        <ellipse cx="100" cy="97" rx="12" ry="4" fill="#4dd8a0" opacity="0.6"/>
        <ellipse cx="300" cy="92" rx="12" ry="4" fill="#4dd8a0" opacity="0.6"/>
        {/* Communal pool */}
        <ellipse cx="200" cy="198" rx="100" ry="18" fill="#4dd8a0" opacity="0.3"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM · ECO-LUXURY</text>
      </svg>
    ),
    4: ( // Oniric — boutique, cenote floral
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="og1" cx="40%" cy="40%"><stop offset="0%" stopColor="#6a2d9a"/><stop offset="100%" stopColor="#1a082a"/></radialGradient>
          <radialGradient id="oc1" cx="50%" cy="50%"><stop offset="0%" stopColor="#c084fc" stopOpacity="0.9"/><stop offset="40%" stopColor="#7c3aed" stopOpacity="0.6"/><stop offset="100%" stopColor="#1a082a" stopOpacity="0"/></radialGradient>
        </defs>
        <rect width="400" height={height} fill="url(#og1)"/>
        {/* Stars */}
        {[40,80,130,170,220,260,320,360,50,150,250,350,100,200,300].map((x,i)=><circle key={i} cx={x} cy={15+i%5*8} r="1" fill="white" opacity={0.4+i%3*0.2}/>)}
        {/* Boutique building */}
        <rect x="130" y="50" width="140" height="130" rx="10" fill="#2d0d4d" opacity="0.95"/>
        {/* Floating staircases */}
        {[0,1,2].map(i=><rect key={i} x={155+i*20} y={80+i*22} width="35" height="8" rx="4" fill="#9f7aea" opacity="0.5"/>)}
        {/* CENOTE FLORAL — el centerpiece */}
        <circle cx="200" cy="175" r="38" fill="#4a1575" opacity="0.5"/>
        {/* Flower petals */}
        {[0,60,120,180,240,300].map((angle,i)=>{
          const rad = angle * Math.PI / 180;
          return <ellipse key={i} cx={200+Math.cos(rad)*22} cy={175+Math.sin(rad)*22} rx="16" ry="10" transform={`rotate(${angle},${200+Math.cos(rad)*22},${175+Math.sin(rad)*22})`} fill="#7c3aed" opacity="0.7"/>;
        })}
        <circle cx="200" cy="175" r="18" fill="#a78bfa" opacity="0.6"/>
        <circle cx="200" cy="175" r="10" fill="#c4b5fd" opacity="0.8"/>
        <circle cx="200" cy="175" r="4" fill="white" opacity="0.9"/>
        {/* Glow */}
        <circle cx="200" cy="175" r="45" fill="url(#oc1)"/>
        <text x="200" y="215" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM REGIÓN 8 · 27 UNIDADES EXCLUSIVAS</text>
      </svg>
    ),
    5: ( // Kokoon — pueblo yucateco
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="kg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7a5a2d"/><stop offset="50%" stopColor="#9a7a3d"/><stop offset="100%" stopColor="#4d3a1a"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#kg1)"/>
        {/* Sky with warm tones */}
        <rect width="400" height="70" fill="#3d2510" opacity="0.7"/>
        <ellipse cx="320" cy="25" r="20" fill="#FFB74D" opacity="0.4"/>
        {/* Pueblo-style villas */}
        {[30,130,230,330].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={90+i%2*5} width="75" height="90" rx="4" fill={["#5a3d1a","#6a4d2a","#4d3010","#5d4020"][i]} opacity="0.95"/>
            {/* Arch entrance */}
            <path d={`M${x+20} ${160} Q${x+37.5} ${140} ${x+55} ${160}`} fill={["#7a5a2d","#8a6a3d"][i%2]} opacity="0.9"/>
            {/* Rooftop wall (pretil) */}
            <rect x={x-2} y={87+i%2*5} width="79" height="12" rx="2" fill={["#9a7a4d","#7a5a30"][i%2]} opacity="0.9"/>
            {/* Rooftop plunge pool */}
            <ellipse cx={x+37} cy={93+i%2*5} rx="18" ry="6" fill="#4dd8a0" opacity="0.5"/>
            {/* Windows */}
            <rect x={x+8} y={108+i%2*5} width="20" height="20" rx="2" fill="#e8b84d" opacity="0.3"/>
            <rect x={x+47} y={108+i%2*5} width="20" height="20" rx="2" fill="#e8b84d" opacity="0.3"/>
          </g>
        ))}
        {/* Communal pool */}
        <ellipse cx="200" cy="195" rx="120" ry="20" fill="#4dd8a0" opacity="0.3"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM · 10 VILLAS BOUTIQUE</text>
      </svg>
    ),
    6: ( // Gran Tulum — Aldea Zama
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#082030"/><stop offset="50%" stopColor="#0d3d5a"/><stop offset="100%" stopColor="#0a2a40"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#gg1)"/>
        {/* Night sky */}
        {[30,80,140,200,260,320,370,50,150,250,350].map((x,i)=><circle key={i} cx={x} cy={5+i%4*10} r="1.2" fill="white" opacity={0.3+i%3*0.2}/>)}
        {/* Aldea Zama master plan - multiple buildings */}
        {[20,100,180,260,340].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={60+i%3*12} width="65" height={100-i%3*8} rx="5" fill={["#0f3a5c","#0d2a45","#132f52"][i%3]} opacity="0.95"/>
            {/* Lit windows */}
            {[0,1,2].map(row=>[0,1].map(col=><rect key={`${i}-${row}-${col}`} x={x+8+col*28} y={75+i%3*12+row*22} width="18" height="14" rx="2" fill="#5DC8D9" opacity={0.2+Math.random()*0.4}/>))}
          </g>
        ))}
        {/* Rooftop bar highlight */}
        <rect x="0" y="55" width="400" height="12" fill="#5DC8D9" opacity="0.05"/>
        {/* Pool level */}
        <ellipse cx="200" cy="195" rx="140" ry="20" fill="#5DC8D9" opacity="0.2"/>
        {/* Airbnb badge glow */}
        <rect x="145" y="38" width="110" height="20" rx="10" fill="#FF5A5F" opacity="0.2"/>
        <text x="200" y="51" textAnchor="middle" fill="#FF5A5F" fontSize="8" opacity="0.7" fontFamily="sans-serif">★ ZONA #1 AIRBNB TULUM</text>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">ALDEA ZAMA · TULUM</text>
      </svg>
    ),
    7: ( // Senzik — golf, luxury
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#041208"/><stop offset="60%" stopColor="#0d3318"/><stop offset="100%" stopColor="#061a0c"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#sg1)"/>
        {/* Golf course */}
        <ellipse cx="200" cy="160" rx="200" ry="60" fill="#1a4d22" opacity="0.8"/>
        <ellipse cx="200" cy="160" rx="150" ry="40" fill="#206b2a" opacity="0.7"/>
        <ellipse cx="200" cy="160" rx="100" ry="25" fill="#2d8a38" opacity="0.6"/>
        {/* Golf flag */}
        <line x1="320" y1="110" x2="320" y2="145" stroke="white" strokeWidth="1.5" opacity="0.7"/>
        <polygon points="320,110 340,118 320,126" fill="#FF5252" opacity="0.8"/>
        {/* Three luxury towers */}
        {[70,185,300].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={35+i%2*10} width="55" height={110-i%2*10} rx="6" fill={["#0a1e0d","#0d2912","#091808"][i]} opacity="0.97"/>
            {/* Tower windows */}
            {[0,1,2,3].map(row=>[0,1].map(col=><rect key={`${i}-${row}-${col}`} x={x+8+col*24} y={48+i%2*10+row*20} width="16" height="12" rx="2" fill="#4CAF50" opacity={0.15+row*0.08}/>))}
            {/* Rooftop pool */}
            <ellipse cx={x+27} cy={38+i%2*10} rx="20" ry="6" fill="#4dd8a0" opacity="0.4"/>
            {/* Tower name */}
            <text x={x+27} y={155-i%2*10} textAnchor="middle" fill="white" fontSize="6" opacity="0.4" fontFamily="sans-serif">{["JUNGLE","POOLSIDE","CENOTE"][i]}</text>
          </g>
        ))}
        {/* PGA badge */}
        <rect x="150" y="15" width="100" height="18" rx="9" fill="#4CAF50" opacity="0.2"/>
        <text x="200" y="27" textAnchor="middle" fill="#4CAF50" fontSize="8" opacity="0.8" fontFamily="sans-serif">⛳ CAMPO GOLF PGA</text>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM COUNTRY CLUB · 14 UNIDADES</text>
      </svg>
    ),
    8: ( // Blue House Marina
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bw1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1a3a6a"/><stop offset="100%" stopColor="#0a1a40"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="#0d1f3d"/>
        {/* Ocean/marina water */}
        <rect x="0" y="150" width="400" height="70" fill="url(#bw1)" opacity="0.9"/>
        {/* Water ripples */}
        {[155,165,175,185].map((y,i)=><path key={i} d={`M0 ${y} Q100 ${y-4} 200 ${y} Q300 ${y+4} 400 ${y}`} stroke="#64B5F6" strokeWidth="0.8" fill="none" opacity={0.2-i*0.04}/>)}
        {/* European-style building */}
        <rect x="80" y="45" width="240" height="115" rx="4" fill="#0d2550" opacity="0.95"/>
        {/* Arched windows — European style */}
        {[0,1,2,3,4].map(col=>[0,1,2].map(row=>(
          <g key={`${col}-${row}`}>
            <rect x={95+col*42} y={65+row*28} width="26" height="18" rx="1" fill="#1a4a8a" opacity="0.6"/>
            <path d={`M${95+col*42} ${65+row*28} Q${108+col*42} ${58+row*28} ${121+col*42} ${65+row*28}`} fill="#1a5a9a" opacity="0.4"/>
          </g>
        )))}
        {/* Marina dock */}
        <rect x="60" y="148" width="280" height="6" rx="3" fill="#8B6914" opacity="0.7"/>
        {[80,140,200,260,320].map((x,i)=><rect key={i} x={x} y={154} width="5" height="30" rx="2" fill="#8B6914" opacity="0.5"/>)}
        {/* Boats */}
        <ellipse cx="110" cy="180" rx="25" ry="8" fill="#E8D5A3" opacity="0.6"/>
        <ellipse cx="290" cy="183" rx="30" ry="8" fill="#E8D5A3" opacity="0.5"/>
        {/* Marina flag */}
        <line x1="200" y1="20" x2="200" y2="45" stroke="white" strokeWidth="1" opacity="0.5"/>
        <rect x="200" y="20" width="20" height="12" fill="#64B5F6" opacity="0.7"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PUERTO AVENTURAS · MARINA EXCLUSIVA</text>
      </svg>
    ),
  };
  return arts[prop.id] || arts[1];
};

/* Gallery art — 6 frames per property */
const GalleryArt = ({ prop, index }) => {
  const frames = [
    { label: "Piscina", grad: `linear-gradient(135deg, ${prop.accent}30, ${prop.accent}08)` },
    { label: "Vista aérea", grad: "linear-gradient(180deg, #0a1520 0%, #1a3a5a 100%)" },
    { label: "Lobby", grad: "linear-gradient(135deg, #1a1a2a, #2a2a4a)" },
    { label: "Terraza", grad: `linear-gradient(180deg, ${prop.accent}20, #050810)` },
    { label: "Amenidades", grad: "linear-gradient(135deg, #1a2a1a, #2a4a2a)" },
    { label: "Recámara", grad: "linear-gradient(135deg, #1a1510, #2a2515)" },
  ];
  const f = frames[index % 6];
  return (
    <div style={{ height: 90, borderRadius: 8, background: f.grad, border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", padding: "8px 10px" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 8px)" }} />
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", position: "relative" }}>{f.label}</span>
    </div>
  );
};

const rivieraProperties = [
  {
    id: 1, name: "Mayakaan Residences", brand: "by Wyndham Grand",
    location: "Puerto Morelos", zone: "15 min del Aeropuerto de Cancún",
    type: "Condominios", sizes: ["77 m²", "84 m²", "122 m²", "143 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 183340, priceTo: 515000,
    roi: "8-10%", roiNum: 9, delivery: "2026", badge: "PREVENTA",
    unitsAvailable: 48, totalUnits: 300, featured: true,
    amenities: ["5,000 m² de piscinas", "8 Skypools elevados", "Cenote natural", "Zipline de 300m", "Spa con cenote", "Cine al aire libre", "Canchas de tenis y pádel", "Parque acuático", "Gimnasio", "Co-working", "Restaurantes temáticos", "Seguridad 24/7", "Domótica"],
    highlights: ["Marca hotelera Wyndham Grand", "Programa de renta administrada", "300 unidades en ambiente de selva", "Beach club exclusivo"],
    description: "Complejo residencial-vacacional de 300 unidades en un entorno de selva con beach club propio, administrado bajo la marca hotelera Wyndham Grand. El programa de renta hotelera lo hace ideal para inversionistas que buscan retorno sin complicaciones.",
    img: "linear-gradient(135deg, #0a4d3c 0%, #1a7a5a 30%, #2d9b6e 60%, #0d3d2e 100%)",
    accent: "#6DD4A8",
  },
  {
    id: 2, name: "Hoxul Residences", brand: "at Corasol",
    location: "Playa del Carmen", zone: "Comunidad Corasol, 450m del Mar Caribe",
    type: "Condominios y Penthouses", sizes: ["92 m²", "186 m²", "416 m²"],
    bedrooms: "2-5 recámaras", priceFrom: 345731, priceTo: 1578298,
    roi: "8-12%", roiNum: 10, delivery: "2026", badge: "EXCLUSIVO",
    unitsAvailable: 12, totalUnits: 40, featured: true,
    amenities: ["Terraza con vista al mar", "Rooftop pool con vista al océano", "Cenote artificial", "Pool bar", "Restaurant bar", "Sports bar", "Gimnasio premium", "Jacuzzis", "Alberca infantil", "Acceso a playa", "Seguridad 24/7"],
    highlights: ["Diseño Sordo Madaleno & Cuaik", "Dentro de Corasol master plan", "5,000 m² de paisajismo tropical", "Segmento ultra-premium"],
    description: "Diseñado por los reconocidos arquitectos Sordo Madaleno & Cuaik, Hoxul se encuentra dentro de la prestigiosa comunidad Corasol con 5,000 m² de paisajismo tropical. Posicionamiento oceanview para el segmento de lujo de Playa del Carmen.",
    img: "linear-gradient(135deg, #1a3a5c 0%, #2a5a8c 30%, #3a7ab0 60%, #0d2a4e 100%)",
    accent: "#7EB8F0",
  },
  {
    id: 3, name: "Zenesis", brand: "Tulum",
    location: "Tulum", zone: "10 min de la playa, 5 min del centro",
    type: "Condominios y Villas", sizes: ["65 m²", "85 m²", "120 m²", "180 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 155000, priceTo: 400000,
    roi: "8-10%", roiNum: 9, delivery: "2025-2027", badge: "NUEVO",
    unitsAvailable: 38, totalUnits: 72, featured: false,
    amenities: ["Rooftop con plunge pool", "Corredores verdes", "Cancha de pickleball", "Club palapa", "Piscina", "Área BBQ", "Co-working", "Gimnasio", "Área infantil", "Seguridad 24/7", "Paneles solares"],
    highlights: ["60 condominios + 12 villas", "9 prototipos diferentes", "Plunge pools privados opcionales", "Precios de preventa"],
    description: "Comunidad de 60 condominios y 12 villas con 9 prototipos diferentes. Las unidades incluyen opciones de plunge pool privado y jardines en rooftop. Posicionado en una zona de alta plusvalía cerca del centro de Tulum.",
    img: "linear-gradient(135deg, #2d4a1a 0%, #4a7a2d 30%, #5d9a3a 60%, #1a3a0d 100%)",
    accent: "#8BC34A",
  },
  {
    id: 4, name: "Oniric", brand: "Tulum",
    location: "Tulum", zone: "Región 8 — La más cercana a la playa",
    type: "Condominios y Penthouses", sizes: ["106 m²", "150 m²", "200 m²", "250 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 190000, priceTo: 500000,
    roi: "8-12%", roiNum: 10, delivery: "2026", badge: "ÚLTIMAS UNIDADES",
    unitsAvailable: 5, totalUnits: 27, featured: true,
    amenities: ["Cenote floral de 20m de diámetro", "Speakeasy bar", "Temazcal tradicional", "Rooftop pool", "Escaleras flotantes", "Diseño de baja densidad"],
    highlights: ["Solo 27 unidades exclusivas", "Cenote en forma de flor como pieza central", "Región 8 — mayor plusvalía de Tulum", "Arquitectura boutique única"],
    description: "Desarrollo exclusivo de baja densidad con solo 27 apartamentos privados en la Región 8 de Tulum. La pieza arquitectónica central es un dramático cenote en forma de flor con escaleras flotantes. Para compradores que buscan propiedades boutique únicas.",
    img: "linear-gradient(135deg, #0d2a4d 0%, #1a4a7a 30%, #2a6a9a 60%, #0a1e3e 100%)",
    accent: "#60A5FA",
  },
  {
    id: 5, name: "Kokoon Pueblo", brand: "",
    location: "Tulum", zone: "Región 15",
    type: "Villas y Departamentos", sizes: ["180 m²", "220 m²", "298 m²"],
    bedrooms: "2-3 recámaras", priceFrom: 257698, priceTo: 389850,
    roi: "8-10%", roiNum: 9, delivery: "2025-2026", badge: "EXCLUSIVO",
    unitsAvailable: 3, totalUnits: 10, featured: false,
    amenities: ["Jardín privado por unidad", "Rooftop privado con plunge pool", "Piscina comunal grande", "Lounge y sundeck", "Almacenamiento", "Estacionamiento", "Paneles solares", "Seguridad 24/7"],
    highlights: ["Solo 10 unidades totales", "Inspirado en pueblos yucatecos", "Jardín + rooftop + plunge pool privados", "Máxima privacidad"],
    description: "Desarrollo boutique inspirado en pueblos tradicionales yucatecos, con solo 10 unidades. Cada villa incluye jardín privado, rooftop y plunge pool, combinando la comodidad de una casa con la seguridad de un condominio.",
    img: "linear-gradient(135deg, #0d3d2e 0%, #1a6d4d 30%, #2d9a6e 60%, #082a1e 100%)",
    accent: "#34D399",
  },
  {
    id: 6, name: "Gran Tulum", brand: "at Selvazama",
    location: "Tulum", zone: "Aldea Zama / Selva Zama — Zona #1 Airbnb",
    type: "Estudios y Condominios", sizes: ["77 m²", "110 m²", "155 m²"],
    bedrooms: "Estudio, 2-3 recámaras", priceFrom: 251400, priceTo: 528000,
    roi: "10-13%", roiNum: 11.5, delivery: "2025-2027", badge: "MAYOR ROI",
    unitsAvailable: 22, totalUnits: 60, featured: true,
    amenities: ["Piscina", "Rooftop bar", "Spa", "Temazcal", "Área de yoga", "Anfiteatro", "Restaurante", "Estacionamiento bici", "Sistema Lock Off"],
    highlights: ["Aldea Zama: zona #1 de Airbnb en Tulum", "Sistema Lock Off para maximizar rentas", "ROI proyectado 10-13%", "Entrega escalonada 2025-2027"],
    description: "En la codiciada zona de Aldea Zama, la comunidad más establecida de Tulum para inversión vacacional. El sistema Lock Off permite dividir unidades en secciones rentables independientes, maximizando ocupación e ingresos.",
    img: "linear-gradient(135deg, #1a3d4d 0%, #2d5a7a 30%, #3d7a9a 60%, #0d2a3e 100%)",
    accent: "#5DC8D9",
  },
  {
    id: 7, name: "Senzik", brand: "Tulum Country Club",
    location: "Tulum", zone: "Corredor Akumal — Tulum Country Club",
    type: "Condominios de Lujo", sizes: ["180 m²", "220 m²", "280 m²"],
    bedrooms: "2-4 recámaras", priceFrom: 475000, priceTo: 561610,
    roi: "7-9%", roiNum: 8, delivery: "2026-2027", badge: "ULTRA PREMIUM",
    unitsAvailable: 6, totalUnits: 14, featured: false,
    amenities: ["Campo de golf PGA", "Beach club", "Parque central", "Áreas comerciales", "3 torres temáticas (Jungle, Pool Side, Cenote)", "Rooftop y piscinas privadas"],
    highlights: ["Solo 14 unidades de lujo", "Campo de golf certificado PGA", "Beach club dedicado", "Unidades de dos niveles con rooftop"],
    description: "Desarrollo exclusivo de solo 14 unidades de lujo distribuidas en tres torres temáticas: Jungle, Pool Side y Cenote. Ubicado dentro de Tulum Country Club con acceso a campo de golf PGA y beach club dedicado.",
    img: "linear-gradient(135deg, #0d2e1a 0%, #1a4d2d 30%, #2d6e3d 60%, #0a1e12 100%)",
    accent: "#4CAF50",
  },
  {
    id: 8, name: "Blue House Marina", brand: "Residences",
    location: "Puerto Aventuras", zone: "Comunidad de marina con muelle",
    type: "Condominios frente a Marina", sizes: ["120 m²", "165 m²", "210 m²"],
    bedrooms: "2-3 recámaras", priceFrom: 300000, priceTo: 600000,
    roi: "7-9%", roiNum: 8, delivery: "2026", badge: "NUEVO",
    unitsAvailable: 9, totalUnits: 19, featured: false,
    amenities: ["Acceso a marina y muelles", "Arquitectura europea", "Acceso a playa", "Campo de golf", "Comunidad cerrada 24/7", "Restaurantes y tiendas"],
    highlights: ["Única marina de servicio completo en Riviera Maya", "Arquitectura europea del siglo XIX", "Acceso directo a botes", "Popular con retirados americanos y canadienses"],
    description: "Arquitectura europea del siglo XIX fusionada con diseño caribeño moderno, en el distrito marina de Puerto Aventuras. La única comunidad de marina de servicio completo en la costa de la Riviera Maya.",
    img: "linear-gradient(135deg, #1a2a4d 0%, #2d4a7a 30%, #4a6a9a 60%, #0d1a3e 100%)",
    accent: "#64B5F6",
  },
];

const marketData = {
  avgPriceM2: "$3,600 USD/m²",
  yearGrowth: "14%",
  realGrowth: "8%",
  rentalROI: "8-15%",
  capitalAppreciation: "8-12%",
  occupancy: "75-90%",
  foreignOwnership: "Fideicomiso bancario (100% legal para extranjeros)",
  propertyTax: "Mínimo comparado con EE.UU./Canadá",
  infrastructure: ["Aeropuerto Internacional de Tulum (nuevo)", "Tren Maya conectando la región", "Carretera federal renovada"],
};

/* ─── Modal: Agregar Nueva Propiedad ─── */
const NewPropertyModal = ({ onClose, onSave, initialData = null }) => {
  const editing = !!initialData;
  const EMPTY = {
    name: "", brand: "", location: "Tulum", zone: "", type: "Condominios",
    priceFrom: "", priceTo: "", roi: "8-10%", delivery: "2026",
    bedrooms: "1-2 recámaras", sizes: "", badge: "NUEVO",
    description: "", highlights: "", amenities: "",
    accent: "#4ADE80", driveLink: "", unitsAvailable: "", totalUnits: "",
  };
  const [form, setForm] = useState(initialData ? {
    ...EMPTY,
    ...initialData,
    priceFrom: String(initialData.priceFrom || ""),
    priceTo: String(initialData.priceTo || ""),
    sizes: Array.isArray(initialData.sizes) ? initialData.sizes.join(", ") : (initialData.sizes || ""),
    highlights: Array.isArray(initialData.highlights) ? initialData.highlights.join(", ") : (initialData.highlights || ""),
    amenities: Array.isArray(initialData.amenities) ? initialData.amenities.join(", ") : (initialData.amenities || ""),
    unitsAvailable: String(initialData.unitsAvailable || ""),
    totalUnits: String(initialData.totalUnits || ""),
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: false })); };
  const accentOptions = ["#4ADE80","#22D3EE","#6DD4A8","#34D399","#38BDF8","#7EB8F0","#2DD4BF","#86EFAC"];
  const badgeOptions = ["NUEVO","EXCLUSIVO","PREVENTA","ÚLTIMAS UNIDADES","MAYOR ROI","ULTRA PREMIUM"];
  const locationOptions = ["Tulum","Playa del Carmen","Puerto Morelos","Puerto Aventuras","Cancún","Bacalar","Akumal","Holbox"];
  const typeOptions = ["Condominios","Villas","Penthouses","Condominios y Penthouses","Villas y Departamentos","Estudios y Condominios","Condominios de Lujo","Casas"];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.priceFrom || isNaN(parseInt(form.priceFrom))) e.priceFrom = true;
    if (!form.priceTo || isNaN(parseInt(form.priceTo))) e.priceTo = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const prop = {
      id: initialData?.id || Date.now(),
      name: form.name.trim(), brand: form.brand.trim(),
      location: form.location, zone: form.zone.trim() || form.location,
      type: form.type,
      sizes: form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : ["—"],
      bedrooms: form.bedrooms.trim() || "—",
      priceFrom: parseInt(form.priceFrom) || 0,
      priceTo: parseInt(form.priceTo) || 0,
      roi: form.roi.trim() || "8-10%",
      roiNum: parseFloat(form.roi) || 8,
      delivery: form.delivery.trim() || "2026",
      badge: form.badge,
      unitsAvailable: parseInt(form.unitsAvailable) || 10,
      totalUnits: parseInt(form.totalUnits) || 10,
      featured: initialData?.featured || false,
      accent: form.accent,
      amenities: form.amenities ? form.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
      highlights: form.highlights ? form.highlights.split(",").map(s => s.trim()).filter(Boolean) : [],
      description: form.description.trim(),
      img: `linear-gradient(135deg, ${form.accent}25 0%, ${form.accent}08 40%, #060a11 100%)`,
      custom: true,
      driveLink: form.driveLink.trim(),
      createdAt: initialData?.createdAt || new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      updatedAt: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    };
    onSave(prop);
    onClose();
  };

  const canSave = form.name.trim() && form.priceFrom && form.priceTo;

  const inputStyle = (key) => ({
    width: "100%", padding: "10px 14px", borderRadius: 8,
    background: P.glass, border: `1px solid ${errors[key] ? P.rose + "80" : P.border}`,
    color: P.txt, fontSize: 13, fontFamily: font, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  });
  const labelStyle = { fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: font };
  const sectionTitle = (accent) => ({ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontFamily: font });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: 680, maxHeight: "92vh", overflowY: "auto",
        background: "#0C1219", border: `1px solid ${P.border}`, borderRadius: 22,
        boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
      }}>
        {/* Header with accent preview */}
        <div style={{
          padding: "22px 28px", borderBottom: `1px solid ${P.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: `linear-gradient(135deg, ${form.accent}10 0%, transparent 60%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${form.accent}25 0%, #060a11 100%)`,
              border: `1px solid ${form.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={20} color={form.accent} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>
                {editing ? "Editar Propiedad" : "Registrar Propiedad"}
              </p>
              <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>
                {editing ? `Editando: ${initialData.name}` : "Agrega un nuevo desarrollo al catálogo permanente"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={P.txt2} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* SECCIÓN 1 — Identidad */}
          <div>
            <p style={sectionTitle(form.accent)}>Identidad del desarrollo</p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nombre del desarrollo *</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Almara Residences" style={inputStyle("name")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors.name?P.rose+"80":P.border} />
                {errors.name && <p style={{fontSize:10,color:P.rose,marginTop:3}}>Campo requerido</p>}
              </div>
              <div>
                <label style={labelStyle}>Marca / Sub-nombre</label>
                <input value={form.brand} onChange={e=>set("brand",e.target.value)} placeholder="Ej: by Four Seasons" style={inputStyle("brand")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Ubicación</label>
                <select value={form.location} onChange={e=>set("location",e.target.value)} style={{ ...inputStyle("location"), background: P.surface, cursor: "pointer" }}>
                  {locationOptions.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Referencia</label>
                <input value={form.zone} onChange={e=>set("zone",e.target.value)} placeholder="Ej: Aldea Zama, frente al mar" style={inputStyle("zone")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Badge</label>
                <select value={form.badge} onChange={e=>set("badge",e.target.value)} style={{ ...inputStyle("badge"), background: P.surface, cursor: "pointer" }}>
                  {badgeOptions.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 — Precios y financiero */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Precios y financiero</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                {k:"priceFrom",label:"Precio desde (USD) *",ph:"155000"},
                {k:"priceTo",label:"Precio hasta (USD) *",ph:"500000"},
                {k:"roi",label:"ROI anual",ph:"8-12%"},
                {k:"delivery",label:"Entrega estimada",ph:"2026"},
              ].map(f=>(
                <div key={f.k}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={inputStyle(f.k)}
                    onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors[f.k]?P.rose+"80":P.border} />
                  {errors[f.k] && <p style={{fontSize:10,color:P.rose,marginTop:3}}>Requerido</p>}
                </div>
              ))}
            </div>
            {/* Preview pricing */}
            {form.priceFrom && form.priceTo && (
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: `${form.accent}0A`, border: `1px solid ${form.accent}20`, fontSize: 12, color: form.accent, fontFamily: fontDisp }}>
                  Desde ${(parseInt(form.priceFrom)/1000).toFixed(0)}K USD
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, fontSize: 12, color: P.txt2, fontFamily: fontDisp }}>
                  Hasta ${(parseInt(form.priceTo)/1000).toFixed(0)}K USD
                </div>
                {form.roi && <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: 12, color: "#4ADE80", fontFamily: fontDisp }}>ROI {form.roi}</div>}
              </div>
            )}
          </div>

          {/* SECCIÓN 3 — Características */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Características</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle("type"), background: P.surface, cursor: "pointer" }}>
                  {typeOptions.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Recámaras</label>
                <input value={form.bedrooms} onChange={e=>set("bedrooms",e.target.value)} placeholder="1-3 recámaras" style={inputStyle("bedrooms")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Unidades disp.</label>
                <input value={form.unitsAvailable} onChange={e=>set("unitsAvailable",e.target.value)} placeholder="10" type="number" min="0" style={inputStyle("unitsAvailable")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Total unidades</label>
                <input value={form.totalUnits} onChange={e=>set("totalUnits",e.target.value)} placeholder="40" type="number" min="0" style={inputStyle("totalUnits")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tamaños disponibles (separados por coma)</label>
              <input value={form.sizes} onChange={e=>set("sizes",e.target.value)} placeholder="65 m², 85 m², 120 m², 180 m²" style={inputStyle("sizes")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
            </div>
          </div>

          {/* SECCIÓN 4 — Descripción y detalles */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Descripción y detalles</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Descripción del desarrollo</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3}
                placeholder="Describe el proyecto, su concepto, entorno y propuesta de valor..."
                style={{ ...inputStyle("description"), resize: "vertical", lineHeight: 1.6 }}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Puntos clave — highlights (separados por coma)</label>
              <input value={form.highlights} onChange={e=>set("highlights",e.target.value)}
                placeholder="Rooftop con piscina, Cenote natural, Solo 14 unidades exclusivas"
                style={inputStyle("highlights")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              {form.highlights && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.highlights.split(",").filter(h=>h.trim()).map((h,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: `${form.accent}10`, border: `1px solid ${form.accent}20`, color: form.accent }}>{h.trim()}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Amenidades (separadas por coma)</label>
              <input value={form.amenities} onChange={e=>set("amenities",e.target.value)}
                placeholder="Piscina, Rooftop, Gimnasio, Spa, Seguridad 24/7, Estacionamiento"
                style={inputStyle("amenities")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              {form.amenities && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.amenities.split(",").filter(a=>a.trim()).map((a,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2 }}>{a.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5 — Media y visual */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Media y visual</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={10} color={P.accent} /> Link de galería de imágenes
                <span style={{ color: P.txt3, fontWeight: 400, textTransform: "none", marginLeft: 4 }}>— Google Drive, Dropbox o cualquier carpeta compartida</span>
              </label>
              <div style={{ position: "relative" }}>
                <ExternalLink size={13} color={form.driveLink ? form.accent : P.txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", flexShrink: 0 }} />
                <input
                  value={form.driveLink} onChange={e => set("driveLink", e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ ...inputStyle("driveLink"), paddingLeft: 34, borderColor: form.driveLink ? form.accent + "50" : P.border }}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=form.driveLink?form.accent+"50":P.border}
                />
              </div>
              {form.driveLink && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "#4ADE80" }}>✓ Link configurado</span>
                  <a href={form.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: form.accent, display: "flex", alignItems: "center", gap: 3 }}>
                    Verificar ↗
                  </a>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Color de acento para la tarjeta</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {accentOptions.map(c=>(
                  <button key={c} onClick={()=>set("accent",c)} title={c} style={{
                    width: 32, height: 32, borderRadius: 8, background: c,
                    border: form.accent===c ? `3px solid white` : "3px solid transparent",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: form.accent===c ? `0 0 12px ${c}80` : "none",
                  }} />
                ))}
                {/* Custom color */}
                <div style={{ position: "relative" }}>
                  <input type="color" value={form.accent} onChange={e=>set("accent",e.target.value)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", padding: 2, background: "transparent" }} title="Color personalizado" />
                </div>
              </div>
              {/* Preview card */}
              <div style={{
                marginTop: 12, padding: "14px 18px", borderRadius: 12,
                background: `linear-gradient(135deg, ${form.accent}15 0%, #060a11 100%)`,
                border: `1px solid ${form.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>{form.name || "Nombre del desarrollo"}</p>
                  {form.brand && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{form.brand}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {form.badge && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${form.accent}20`, border: `1px solid ${form.accent}30`, color: form.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{form.badge}</span>}
                    {form.type && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2 }}>{form.type}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {form.priceFrom && <p style={{ fontSize: 18, fontWeight: 700, color: form.accent, fontFamily: fontDisp }}>${(parseInt(form.priceFrom)/1000).toFixed(0)}K</p>}
                  {form.roi && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>ROI {form.roi}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${P.border}`, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: "13px 20px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 13, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: "13px", borderRadius: 10, border: "none",
              background: canSave ? `linear-gradient(135deg, ${form.accent} 0%, ${form.accent}CC 100%)` : P.glass,
              color: canSave ? "#060A11" : P.txt3,
              fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: fontDisp,
              transition: "all 0.2s",
              boxShadow: canSave ? `0 4px 20px ${form.accent}40` : "none",
            }}>
              {editing ? "Guardar cambios" : "Registrar en catálogo"} {canSave && "→"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

/* ─── ROI Calculator ─── */
const ROICalc = ({ prop }) => {
  const [inv, setInv] = useState(prop.priceFrom);
  const roiPct = prop.roiNum / 100;
  const appPct = 0.10; // 10% annual appreciation
  const yearlyRental = inv * roiPct;
  const projections = [1,3,5,10].map(y => ({
    y, rental: yearlyRental * y,
    appreciation: inv * Math.pow(1 + appPct, y) - inv,
    total: yearlyRental * y + (inv * Math.pow(1 + appPct, y) - inv),
    propValue: inv * Math.pow(1 + appPct, y),
  }));
  const fmt = n => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n/1000)}K`;

  return (
    <div style={{ padding: "40px", background: "#030508", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: prop.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>CALCULADORA DE RETORNO</p>
        <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 8 }}>Proyección de Tu Inversión</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Basado en ROI {prop.roi} + plusvalía histórica del 10% anual en la Riviera Maya</p>
        {/* Slider */}
        <div style={{ marginBottom: 28, padding: "20px 24px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Inversión inicial</span>
            <span style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{fmt(inv)} USD</span>
          </div>
          <input type="range" min={prop.priceFrom} max={prop.priceTo} value={inv} onChange={e=>setInv(parseInt(e.target.value))} step={10000}
            style={{ width: "100%", accentColor: prop.accent, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceFrom)}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceTo)}</span>
          </div>
        </div>
        {/* Projections */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {projections.map(pr=>(
            <div key={pr.y} style={{ padding: "18px 16px", borderRadius: 14, background: `${prop.accent}06`, border: `1px solid ${prop.accent}15` }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>{pr.y} {pr.y===1?"AÑO":"AÑOS"}</p>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Rentas acumuladas</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.rental)}</p>
              </div>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Plusvalía</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: P.emerald, fontFamily: fontDisp }}>+{fmt(pr.appreciation)}</p>
              </div>
              <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Retorno total</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{fmt(pr.total)}</p>
              </div>
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${prop.accent}12` }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>Valor propiedad</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.propValue)}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 14, textAlign: "center" }}>* Proyecciones basadas en datos históricos del mercado. No garantizadas. Sujeto a condiciones del mercado.</p>
      </div>
    </div>
  );
};

/* ─── Map/Location visual ─── */
const RivieraMayaMap = ({ properties }) => {
  // Positions on simplified coastline map
  const locations = {
    "Cancún": { x: 82, y: 8 },
    "Puerto Morelos": { x: 76, y: 28 },
    "Playa del Carmen": { x: 68, y: 50 },
    "Puerto Aventuras": { x: 62, y: 62 },
    "Tulum": { x: 52, y: 78 },
    "Bacalar": { x: 38, y: 92 },
    "Akumal": { x: 58, y: 68 },
    "Holbox": { x: 30, y: 5 },
  };
  const propLocations = [...new Set(properties.map(p => p.location))];

  return (
    <div style={{ padding: "60px 40px", background: "#020406" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 40, alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>UBICACIÓN</p>
          <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 16 }}>Riviera Maya, México</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 20 }}>
            La Riviera Maya se extiende a lo largo de 120 km de costa caribeña. Con el nuevo Aeropuerto Internacional de Tulum y el Tren Maya, el acceso nunca ha sido mejor.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {propLocations.map(loc => (
              <div key={loc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: properties.find(p=>p.location===loc)?.accent || P.accent, boxShadow: `0 0 8px ${properties.find(p=>p.location===loc)?.accent || P.accent}` }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: font }}>{loc}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>— {properties.filter(p=>p.location===loc).length} propiedad{properties.filter(p=>p.location===loc).length>1?"es":""}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
            {[{l:"Cancún →",d:"15-45 min"},{l:"Playa del Carmen →",d:"5-90 min"},{l:"Aeropuerto Tulum →",d:"Nuevo 2025"}].map(r=>(
              <div key={r.l} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{r.l}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
        {/* SVG Map */}
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#020408" }}>
          <svg width="100%" viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg">
            {/* Caribbean Sea */}
            <rect width="120" height="110" fill="#030d1a"/>
            {/* Coastline */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L120 110 L120 0 Z" fill="#0a2040" opacity="0.8"/>
            {/* Land */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L0 110 L0 0 Z" fill="#0f1f0a" opacity="0.9"/>
            {/* Caribbean text */}
            <text x="100" y="55" fill="#1a4a7a" fontSize="5" opacity="0.6" fontFamily="sans-serif" transform="rotate(-70 100 55)">Mar Caribe</text>
            {/* Road/highway */}
            <path d="M85 18 Q82 28 78 36 Q72 46 68 53 Q62 63 58 70 Q54 78 50 88" stroke="#2a3a1a" strokeWidth="1.5" fill="none" strokeDasharray="2,1"/>
            {/* City dots */}
            {Object.entries(locations).map(([city, pos]) => {
              const isProp = propLocations.includes(city);
              const propAccent = isProp ? (properties.find(p=>p.location===city)?.accent || P.accent) : null;
              return (
                <g key={city}>
                  {isProp && <circle cx={pos.x} cy={pos.y} r="5" fill={propAccent} opacity="0.15"/>}
                  <circle cx={pos.x} cy={pos.y} r={isProp?"3":"1.5"} fill={isProp ? propAccent : "rgba(255,255,255,0.3)"} opacity={isProp?0.9:0.5}/>
                  <text x={pos.x+4} y={pos.y+1} fill="white" fontSize="3.5" opacity={isProp?0.8:0.4} fontFamily="sans-serif">{city}</text>
                </g>
              );
            })}
            {/* Airport icon */}
            <text x="73" y="79" fill="#FFD700" fontSize="5" opacity="0.5">✈</text>
            <text x="73" y="83" fill="#FFD700" fontSize="2.5" opacity="0.4" fontFamily="sans-serif">TULUM</text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const LandingPages = () => {
  const [step, setStep] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientBudgetMin, setClientBudgetMin] = useState(120000);
  const [clientBudgetMax, setClientBudgetMax] = useState(600000);
  const [clientPrefs, setClientPrefs] = useState({ beach: false, golf: false, marina: false, jungle: false, investment: false, retirement: false, family: false, boutique: false });
  const [selectedProps, setSelectedProps] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [customProperties, setCustomProperties] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stratos_custom_props") || "[]"); } catch { return []; }
  });
  const [showNewPropModal, setShowNewPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [showCatalogSection, setShowCatalogSection] = useState(false);
  const [savedPages, setSavedPages] = useState([
    { id: 1, client: "Fam. Rodríguez", date: "3 Abr 2026", props: 3, status: "Enviada", budget: "$280K-$1.2M", opens: 4, asesor: "Ken Lugo Ríos" },
    { id: 2, client: "James Mitchell", date: "2 Abr 2026", props: 4, status: "Vista", budget: "$180K-$650K", opens: 2, asesor: "Emmanuel Ortiz" },
    { id: 3, client: "Sarah Williams", date: "1 Abr 2026", props: 2, status: "Generada", budget: "$300K-$600K", opens: 0, asesor: "Cecilia Mendoza" },
  ]);
  const [asesor, setAsesor] = useState("Emmanuel Ortiz");
  const [asesorWA, setAsesorWA] = useState("+52 998 000 0002");
  const [asesorCal, setAsesorCal] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [lpTheme, setLpTheme] = useState("dark");
  const [generatedId, setGeneratedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Drive links per property (id → url), persisted in localStorage
  const [driveLinks, setDriveLinks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stratos_drive_links") || "{}"); } catch { return {}; }
  });
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editLinkValue, setEditLinkValue] = useState("");
  const [agencyName, setAgencyName] = useState(() => localStorage.getItem("stratos_agency_name") || "STRATOS REALTY");

  // Persist drive links to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("stratos_drive_links", JSON.stringify(driveLinks)); } catch {}
  }, [driveLinks]);

  // Persist custom properties to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("stratos_custom_props", JSON.stringify(customProperties)); } catch {}
  }, [customProperties]);

  const saveCustomProp = (prop) => {
    setCustomProperties(prev => {
      const exists = prev.find(p => p.id === prop.id);
      return exists ? prev.map(p => p.id === prop.id ? prop : p) : [prop, ...prev];
    });
    // Also update driveLinks if the prop has one
    if (prop.driveLink) {
      setDriveLinks(prev => ({ ...prev, [prop.id]: prop.driveLink }));
    }
  };

  const deleteCustomProp = (id) => {
    setCustomProperties(prev => prev.filter(p => p.id !== id));
    setDriveLinks(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedProps(prev => prev.filter(x => x !== id));
  };

  // When asesor changes, auto-fill contact info from team data
  useEffect(() => {
    const member = team.find(t => t.n === asesor);
    if (member) { setAsesorWA(member.wa || ""); setAsesorCal(member.cal || ""); }
  }, [asesor]);

  const budgetOptions = [
    { label: "$120K", value: 120000 },
    { label: "$200K", value: 200000 },
    { label: "$300K", value: 300000 },
    { label: "$400K", value: 400000 },
    { label: "$500K", value: 500000 },
    { label: "$750K", value: 750000 },
    { label: "$1M+", value: 1000000 },
    { label: "$1.5M+", value: 1500000 },
  ];

  const prefOptions = [
    { key: "beach", label: "Cerca de playa", icon: Waves },
    { key: "golf", label: "Campo de golf", icon: Palmtree },
    { key: "marina", label: "Marina/Náutico", icon: Waves },
    { key: "jungle", label: "Entorno de selva", icon: Palmtree },
    { key: "investment", label: "Alta rentabilidad", icon: TrendingUp },
    { key: "retirement", label: "Retiro/Lifestyle", icon: Heart },
    { key: "family", label: "Familiar", icon: Users },
    { key: "boutique", label: "Boutique/Exclusivo", icon: Crown },
  ];

  const allProperties = useMemo(() => [...rivieraProperties, ...customProperties], [customProperties]);

  const inBudget = (p) => p.priceFrom <= clientBudgetMax && p.priceTo >= clientBudgetMin;
  const filteredProperties = useMemo(() => {
    const inB = allProperties.filter(p => inBudget(p));
    const outB = allProperties.filter(p => !inBudget(p));
    return [...inB, ...outB];
  }, [allProperties, clientBudgetMin, clientBudgetMax]);

  const saveDriveLink = (propId) => {
    setDriveLinks(prev => ({ ...prev, [propId]: editLinkValue }));
    // Also persist link inside the custom property object itself
    setCustomProperties(prev => prev.map(p => p.id === propId ? { ...p, driveLink: editLinkValue } : p));
    setEditingLinkId(null);
    setEditLinkValue("");
  };

  const startEditLink = (propId, currentLink, e) => {
    e.stopPropagation();
    setEditingLinkId(propId);
    setEditLinkValue(currentLink || "");
  };

  const toggleProp = (id) => {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    const newId = Date.now();
    setGeneratedId(newId);
    setSavedPages(prev => [{
      id: newId,
      client: clientName || "Cliente",
      date: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      propIds: [...selectedProps],
      props: selectedProps.length,
      status: "Generada",
      budget: `$${(clientBudgetMin / 1000).toFixed(0)}K-$${(clientBudgetMax / 1000).toFixed(0)}K`,
      asesor,
    }, ...prev]);
    setPreviewOpen(true);
  };

  const handleCopyLink = () => {
    const demoUrl = `${window.location.origin}${window.location.pathname}?lp=${generatedId || "preview"}&c=${encodeURIComponent(clientName || "cliente")}`;
    navigator.clipboard.writeText(demoUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const resetForm = () => {
    setStep(0);
    setClientName("");
    setClientBudgetMin(120000);
    setClientBudgetMax(500000);
    setClientPrefs({ beach: false, golf: false, marina: false, jungle: false, investment: false, retirement: false, family: false, boutique: false });
    setSelectedProps([]);
    setMensaje("");
    setGeneratedId(null);
    setShowShareModal(false);
  };

  const statusColors = { Generada: P.blue, Enviada: P.emerald, Vista: P.accent, Expirada: P.rose };

  // ─── Step 0: Lista de Landing Pages ───
  if (step === 0) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 21, fontWeight: 400, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
            Landing Pages <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.4)" }}>Premium</span>
          </p>
          <p style={{ fontSize: 12, color: P.txt3, fontFamily: font, marginTop: 4 }}>Genera presentaciones personalizadas para cada cliente en un clic</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowNewPropModal(true)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "11px 18px",
            borderRadius: 11, border: `1px solid ${P.accent}40`, background: P.accentS,
            cursor: "pointer", color: P.accent, fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
            transition: "all 0.22s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = P.accentB; e.currentTarget.style.borderColor = P.accent + "70"; }}
            onMouseLeave={e => { e.currentTarget.style.background = P.accentS; e.currentTarget.style.borderColor = P.accent + "40"; }}
          >
            <Plus size={15} /> Registrar propiedad
          </button>
          <button onClick={() => setStep(1)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 22px",
            borderRadius: 11, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.95)", color: "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={15} /> Nueva Landing Page
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Pages Generadas" value={savedPages.length} sub="total" icon={Globe} color={P.blue} />
        <KPI label="Propiedades en catálogo" value={rivieraProperties.length + customProperties.length} sub={`${customProperties.length} registradas`} icon={Building2} color={P.emerald} />
        <KPI label="Tasa de Apertura" value="87%" sub="+12%" icon={Eye} color={P.accent} />
        <KPI label="Conversión a Zoom" value="34%" sub="+8pp" icon={Target} color={P.violet} />
      </div>

      {/* Landing Pages Recientes */}
      <G np>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Landing Pages Recientes</p>
          <Pill color={P.accent} s>{savedPages.length} páginas</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 10, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Cliente</span><span>Fecha</span><span>Props.</span><span>Presupuesto</span><span>Status</span><span>Asesor</span><span>Acciones</span>
        </div>
        {savedPages.map(pg => (
          <div key={pg.id} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr",
            gap: 10, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${P.border}`,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ico icon={User} sz={30} is={13} c={P.accent} />
              <span style={{ fontSize: 13, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{pg.client}</span>
            </div>
            <span style={{ fontSize: 11, color: P.txt2, fontFamily: font }}>{pg.date}</span>
            <span style={{ fontSize: 12, color: P.txt, fontWeight: 500, fontFamily: fontDisp }}>{pg.props}</span>
            <span style={{ fontSize: 11, color: P.emerald, fontWeight: 600, fontFamily: fontDisp }}>{pg.budget}</span>
            <Pill color={statusColors[pg.status] || P.txt3} s>{pg.status}</Pill>
            <span style={{ fontSize: 11, color: P.txt2, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pg.asesor?.split(" ")[0] || "—"}</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => { setClientName(pg.client); setSelectedProps(pg.propIds || allProperties.slice(0, pg.props).map(p => p.id)); setPreviewOpen(true); }} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Eye size={11} color={P.txt2} /></button>
              <button onClick={handleCopyLink} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center" }}>{copied ? <Check size={11} color={P.accent} /> : <Copy size={11} color={P.txt2} />}</button>
              <button style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Share2 size={11} color={P.txt2} /></button>
            </div>
          </div>
        ))}
      </G>

      {/* Catálogo de Propiedades */}
      <G np>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: showCatalogSection ? `1px solid ${P.border}` : "none", cursor: "pointer" }}
          onClick={() => setShowCatalogSection(s => !s)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ico icon={Building2} sz={30} is={14} c={P.emerald} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Catálogo de Propiedades</p>
              <p style={{ fontSize: 11, color: P.txt3, marginTop: 1 }}>
                {rivieraProperties.length} predeterminadas · <span style={{ color: customProperties.length > 0 ? P.accent : P.txt3 }}>{customProperties.length} registradas por el equipo</span>
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); setShowNewPropModal(true); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, border: `1px solid ${P.accent}40`, background: P.accentS,
              cursor: "pointer", color: P.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = P.accentB; }}
              onMouseLeave={e => { e.currentTarget.style.background = P.accentS; }}
            >
              <Plus size={13} /> Registrar nueva
            </button>
            <div style={{ color: P.txt3, transition: "transform 0.2s", transform: showCatalogSection ? "rotate(180deg)" : "none" }}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {showCatalogSection && (
          <div style={{ padding: "16px 20px" }}>
            {/* Custom properties */}
            {customProperties.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                  Registradas por el equipo ({customProperties.length})
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {customProperties.map(prop => (
                    <div key={prop.id} style={{
                      borderRadius: 12, overflow: "hidden",
                      background: `linear-gradient(135deg, ${prop.accent}12 0%, #060a11 100%)`,
                      border: `1px solid ${prop.accent}25`,
                    }}>
                      {/* Card header */}
                      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${prop.accent}20`, border: `1px solid ${prop.accent}30`, color: prop.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{prop.badge}</span>
                            <span style={{ fontSize: 9, color: P.txt3, fontFamily: font }}>{prop.location}</span>
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                          {prop.brand && <p style={{ fontSize: 11, color: P.txt3 }}>{prop.brand}</p>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                          <p style={{ fontSize: 10, color: P.txt3 }}>ROI {prop.roi}</p>
                        </div>
                      </div>
                      {/* Drive link status */}
                      <div style={{ padding: "8px 16px", borderTop: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <ExternalLink size={11} color={driveLinks[prop.id] || prop.driveLink ? prop.accent : P.txt3} />
                          <span style={{ fontSize: 10, color: driveLinks[prop.id] || prop.driveLink ? prop.accent : P.txt3 }}>
                            {driveLinks[prop.id] || prop.driveLink ? "Galería configurada" : "Sin galería"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => { setEditingProp(prop); setShowNewPropModal(true); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 10, fontFamily: font, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = P.txt; e.currentTarget.style.borderColor = P.borderH; }}
                            onMouseLeave={e => { e.currentTarget.style.color = P.txt2; e.currentTarget.style.borderColor = P.border; }}
                          >
                            <FileText size={10} /> Editar
                          </button>
                          <button onClick={() => { if (window.confirm(`¿Eliminar "${prop.name}" del catálogo?`)) deleteCustomProp(prop.id); }} style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.rose, fontSize: 10, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.08)"; e.currentTarget.style.borderColor = P.rose + "40"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      {prop.createdAt && (
                        <div style={{ padding: "4px 16px 8px", fontSize: 9, color: P.txt3, fontFamily: font }}>
                          Registrada: {prop.createdAt}{prop.updatedAt && prop.updatedAt !== prop.createdAt ? ` · Editada: ${prop.updatedAt}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default properties summary */}
            <div>
              <p style={{ fontSize: 11, color: P.txt2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Propiedades Riviera Maya ({rivieraProperties.length})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {rivieraProperties.map(prop => {
                  const dl = driveLinks[prop.id] || prop.driveLink || "";
                  return (
                    <div key={prop.id} style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: `${prop.accent}06`, border: `1px solid ${prop.accent}18`,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                        <p style={{ fontSize: 10, color: P.txt3 }}>{prop.location} · ${(prop.priceFrom/1000).toFixed(0)}K–${(prop.priceTo/1000).toFixed(0)}K · ROI {prop.roi}</p>
                      </div>
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        {editingLinkId === prop.id ? (
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            <input
                              autoFocus
                              value={editLinkValue}
                              onChange={e => setEditLinkValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveDriveLink(prop.id); if (e.key === "Escape") { setEditingLinkId(null); setEditLinkValue(""); } }}
                              placeholder="Link Drive..."
                              style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, background: P.glass, border: `1px solid ${P.accent}50`, color: P.txt, fontFamily: font, outline: "none", width: 180 }}
                            />
                            <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: P.accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>OK</button>
                            <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "4px 6px", borderRadius: 5, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt3 }}><X size={10} /></button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {dl && <a href={dl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 6, border: `1px solid ${prop.accent}40`, background: `${prop.accent}10`, color: prop.accent, fontSize: 10, fontWeight: 700, textDecoration: "none" }}><Image size={10} /> Galería</a>}
                            <button onClick={e => { e.stopPropagation(); startEditLink(prop.id, dl, e); }} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 6, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 10, fontFamily: font }}>
                              <FileText size={9} /> {dl ? "Editar link" : "Añadir link"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {customProperties.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
                <p style={{ fontSize: 13, color: P.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Aún no has registrado propiedades personalizadas</p>
                <p style={{ fontSize: 11, color: P.txt3, marginBottom: 16 }}>Registra desarrollos adicionales para incluirlos en tus landing pages</p>
                <button onClick={() => setShowNewPropModal(true)} style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  borderRadius: 10, border: `1px solid ${P.accent}40`, background: P.accentS,
                  cursor: "pointer", color: P.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                }}>
                  <Plus size={15} /> Registrar primera propiedad
                </button>
              </div>
            )}
          </div>
        )}
      </G>

      {/* Quick Market Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <G>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={TrendingUp} sz={32} is={15} c={P.emerald} />
            <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Mercado Riviera Maya</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Precio promedio", v: marketData.avgPriceM2 },
              { l: "Crecimiento anual", v: marketData.yearGrowth },
              { l: "Plusvalía real", v: marketData.realGrowth },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.border}` }}>
                <span style={{ fontSize: 11, color: P.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={DollarSign} sz={32} is={15} c={P.accent} />
            <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Rendimientos</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "ROI por rentas", v: marketData.rentalROI },
              { l: "Plusvalía capital", v: marketData.capitalAppreciation },
              { l: "Ocupación promedio", v: marketData.occupancy },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.border}` }}>
                <span style={{ fontSize: 11, color: P.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.accent, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={Shield} sz={32} is={15} c={P.blue} />
            <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Para Inversionistas</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Propiedad extranjera", v: "100% legal" },
              { l: "Impuesto predial", v: "Mínimo" },
              { l: "Aeropuerto Tulum", v: "Nuevo" },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${P.border}` }}>
                <span style={{ fontSize: 11, color: P.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.blue, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
      </div>

      {/* New Property Modal accessible from step 0 */}
      {showNewPropModal && (
        <NewPropertyModal
          onClose={() => { setShowNewPropModal(false); setEditingProp(null); }}
          onSave={saveCustomProp}
          initialData={editingProp}
        />
      )}
    </div>
  );

  // ─── Step 1: Datos del Cliente ───
  if (step === 1) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setStep(0)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>Crear Landing Page</p>
          <p style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>Paso 1 de 2 — Información del cliente</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.accent, boxShadow: `0 0 8px ${P.accent}40` }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.border }} />
      </div>

      <G>
        <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, marginBottom: 16, fontFamily: fontDisp }}>Datos del Cliente</p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Nombre del cliente</label>
          <input
            type="text" value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="Ej: Familia Rodríguez, James Mitchell..."
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 14,
              background: P.glass, border: `1px solid ${P.border}`, color: P.txt,
              fontFamily: font, outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = P.accent + "60"}
            onBlur={e => e.target.style.borderColor = P.border}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: P.txt2, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
            <Building2 size={11} color={P.accent} /> Nombre de la agencia / bróker
          </label>
          <input
            type="text" value={agencyName}
            onChange={e => { setAgencyName(e.target.value); localStorage.setItem("stratos_agency_name", e.target.value); }}
            placeholder="Ej: STRATOS REALTY, Inmobiliaria Azul, RE/MAX Elite…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: P.glass, border: `1px solid ${P.accentB}`, color: P.txt, fontFamily: font, outline: "none" }}
            onFocus={e => e.target.style.borderColor = P.accent + "60"}
            onBlur={e => e.target.style.borderColor = P.accentB}
          />
          <p style={{ fontSize: 10, color: P.txt3, marginTop: 4 }}>Aparece en el encabezado de la landing page del cliente. Se guarda automáticamente.</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Asesor asignado</label>
          <select value={asesor} onChange={e => setAsesor(e.target.value)} style={{
            width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 13,
            background: P.surface, border: `1px solid ${P.border}`, color: P.txt,
            fontFamily: font, cursor: "pointer",
          }}>
            {team.map(t => <option key={t.n} value={t.n}>{t.n} — {t.r}</option>)}
          </select>
        </div>

        {/* Asesor contact info */}
        <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: P.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <Phone size={11} color={P.emerald} /> WhatsApp del asesor
            </label>
            <input
              type="text" value={asesorWA} onChange={e => setAsesorWA(e.target.value)}
              placeholder="+52 998 000 0000"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: P.glass, border: `1px solid ${asesorWA ? P.emerald + "50" : P.border}`, color: P.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = P.emerald + "70"}
              onBlur={e => e.target.style.borderColor = asesorWA ? P.emerald + "50" : P.border}
            />
            {asesorWA && (
              <a href={`https://wa.me/${asesorWA.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: P.emerald, marginTop: 4, display: "inline-block" }}>
                Verificar número →
              </a>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: P.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <CalendarDays size={11} color={P.blue} /> Link de agenda (Calendly, Cal.com…)
            </label>
            <input
              type="text" value={asesorCal} onChange={e => setAsesorCal(e.target.value)}
              placeholder="https://calendly.com/..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: P.glass, border: `1px solid ${asesorCal ? P.blue + "50" : P.border}`, color: P.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = P.blue + "70"}
              onBlur={e => e.target.style.borderColor = asesorCal ? P.blue + "50" : P.border}
            />
            {asesorCal && (
              <a href={asesorCal} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: P.blue, marginTop: 4, display: "inline-block" }}>
                Verificar link →
              </a>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Rango de presupuesto</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: P.txt3, marginBottom: 4 }}>Desde</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(0, 5).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMin(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMin === b.value ? P.accent + "60" : P.border}`,
                    background: clientBudgetMin === b.value ? P.accentS : P.glass,
                    color: clientBudgetMin === b.value ? P.accent : P.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
            <div style={{ color: P.txt3, fontSize: 14 }}>—</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: P.txt3, marginBottom: 4 }}>Hasta</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(2).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMax(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMax === b.value ? P.accent + "60" : P.border}`,
                    background: clientBudgetMax === b.value ? P.accentS : P.glass,
                    color: clientBudgetMax === b.value ? P.accent : P.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Preferencias del cliente</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {prefOptions.map(pref => {
              const active = clientPrefs[pref.key];
              return (
                <button key={pref.key} onClick={() => setClientPrefs(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "14px 8px", borderRadius: 10,
                  border: `1px solid ${active ? P.accent + "50" : P.border}`,
                  background: active ? P.accentS : P.glass,
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <pref.icon size={18} color={active ? P.accent : P.txt3} />
                  <span style={{ fontSize: 10, color: active ? P.accent : P.txt2, fontWeight: 600, fontFamily: font, textAlign: "center" }}>{pref.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <WriterSection value={mensaje} onChange={setMensaje} clientName={clientName} />
      </G>

      <button onClick={() => setStep(2)} disabled={!clientName.trim()} style={{
        padding: "14px 28px", borderRadius: 12, border: "none", cursor: clientName.trim() ? "pointer" : "not-allowed",
        background: clientName.trim() ? "rgba(255,255,255,0.95)" : P.glass,
        color: clientName.trim() ? "#0A0F18" : P.txt3,
        fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
        boxShadow: clientName.trim() ? "0 4px 20px rgba(255,255,255,0.15)" : "none",
        transition: "all 0.25s", width: "100%",
      }}>
        Seleccionar Propiedades <ArrowRight size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />
      </button>
    </div>
  );

  // ─── Step 2: Selección de Propiedades ───
  if (step === 2) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setStep(1)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>Seleccionar Propiedades</p>
          <p style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>Paso 2 de 2 — Landing page para <span style={{ color: P.accent, fontWeight: 600 }}>{clientName}</span> · Presupuesto: <span style={{ color: P.emerald, fontWeight: 600 }}>${(clientBudgetMin / 1000).toFixed(0)}K – ${(clientBudgetMax / 1000).toFixed(0)}K</span></p>
        </div>
        {selectedProps.length > 0 && (
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 22px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.95)", color: "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={16} /> Generar Landing Page ({selectedProps.length})
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.accent }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.accent, boxShadow: `0 0 8px ${P.accent}40` }} />
      </div>

      {/* Toolbar: hint + register button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image size={14} color={P.txt3} />
          <span style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>Haz clic para seleccionar · </span>
          <span style={{ fontSize: 11, color: P.accent, fontWeight: 600, fontFamily: font }}>{filteredProperties.filter(inBudget).length} en presupuesto</span>
          <span style={{ fontSize: 11, color: P.txt3, fontFamily: font }}>· {filteredProperties.length} totales</span>
        </div>
        <button
          onClick={() => setShowNewPropModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: `1px solid ${P.accent}40`, background: P.accentS,
            cursor: "pointer", color: P.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
            transition: "all 0.2s", whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = P.accentB; e.currentTarget.style.borderColor = P.accent + "80"; }}
          onMouseLeave={e => { e.currentTarget.style.background = P.accentS; e.currentTarget.style.borderColor = P.accent + "40"; }}
        >
          <Plus size={14} /> Registrar propiedad
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {filteredProperties.map(prop => {
          const selected = selectedProps.includes(prop.id);
          const driveLink = driveLinks[prop.id] || prop.driveLink || "";
          const isEditingThis = editingLinkId === prop.id;
          const matchesBudget = inBudget(prop);

          return (
            <div key={prop.id} style={{
              borderRadius: 16, overflow: "visible", cursor: "pointer",
              border: `2px solid ${selected ? prop.accent + "80" : P.border}`,
              background: P.glass, transition: "all 0.3s",
              boxShadow: selected ? `0 0 24px ${prop.accent}20` : "none",
              transform: selected ? "scale(1.01)" : "scale(1)",
              position: "relative",
              opacity: matchesBudget ? 1 : 0.75,
            }}>
              {/* Clickable area for selection */}
              <div onClick={() => toggleProp(prop.id)} style={{ cursor: "pointer" }}>
                {/* Property Image Header */}
                <div style={{
                  height: 140, background: prop.img, position: "relative",
                  display: "flex", alignItems: "flex-end", padding: 16,
                  borderRadius: "14px 14px 0 0", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
                  <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{prop.name}</p>
                        {prop.brand && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: font }}>{prop.brand}</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MapPin size={12} color="rgba(255,255,255,0.7)" />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: font }}>{prop.location}</span>
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 28, height: 28, borderRadius: "50%",
                      background: prop.accent, display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 0 12px ${prop.accent}60`,
                    }}>
                      <Check size={16} color="#000" strokeWidth={3} />
                    </div>
                  )}
                  {!selected && !matchesBudget && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      padding: "3px 8px", borderRadius: 6,
                      background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: font, whiteSpace: "nowrap",
                    }}>Fuera de rango</div>
                  )}
                  {!selected && matchesBudget && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 28, height: 28, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.3)",
                    }} />
                  )}
                </div>

                {/* Property Details */}
                <div style={{ padding: "14px 16px 10px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <Pill color={prop.accent} s>{prop.type}</Pill>
                    <Pill color={P.emerald} s>ROI {prop.roi}</Pill>
                    <Pill color={P.txt2} s>{prop.bedrooms}</Pill>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: `${prop.accent}0A`, border: `1px solid ${prop.accent}18` }}>
                      <p style={{ fontSize: 9, color: P.txt3, marginBottom: 2 }}>Desde</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
                      <p style={{ fontSize: 9, color: P.txt3, marginBottom: 2 }}>Hasta</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>${(prop.priceTo / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: P.txt2, lineHeight: 1.5, fontFamily: font, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{prop.description}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                    {prop.highlights.slice(0, 3).map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: `${prop.accent}18`, border: `1px solid ${prop.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <CheckCircle2 size={8} color={prop.accent} />
                        </div>
                        <span style={{ fontSize: 10, color: P.txt2, fontFamily: font, lineHeight: 1.3 }}>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── Drive Link Bar ─── */}
              <div onClick={e => e.stopPropagation()} style={{
                borderTop: `1px solid ${P.border}`,
                padding: "10px 14px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "0 0 14px 14px",
              }}>
                {isEditingThis ? (
                  /* Edit mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ExternalLink size={13} color={P.txt3} style={{ flexShrink: 0 }} />
                    <input
                      autoFocus
                      value={editLinkValue}
                      onChange={e => setEditLinkValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDriveLink(prop.id); if (e.key === "Escape") { setEditingLinkId(null); setEditLinkValue(""); } }}
                      placeholder="Pega aquí el link de Google Drive..."
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 11,
                        background: P.glass, border: `1px solid ${P.accent}50`, color: P.txt,
                        fontFamily: font, outline: "none",
                      }}
                    />
                    <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: P.accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, whiteSpace: "nowrap" }}>
                      Guardar
                    </button>
                    <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt3 }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  /* View mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <ExternalLink size={12} color={driveLink ? P.accent : P.txt3} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 11, color: driveLink ? P.accent : P.txt3, fontFamily: font,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 200,
                      }} title={driveLink || ""}>
                        {driveLink
                          ? (driveLink.length > 38 ? driveLink.slice(0, 35) + "…" : driveLink)
                          : "Sin link de imágenes"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {driveLink && (
                        <a
                          href={driveLink} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                            borderRadius: 7, border: `1px solid ${prop.accent}50`,
                            background: `${prop.accent}12`, color: prop.accent,
                            fontSize: 11, fontWeight: 700, textDecoration: "none",
                            fontFamily: fontDisp, transition: "all 0.2s",
                          }}
                        >
                          <Image size={11} /> Ver imágenes
                        </a>
                      )}
                      <button
                        onClick={e => startEditLink(prop.id, driveLink, e)}
                        title={driveLink ? "Cambiar link" : "Agregar link de Drive"}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                          borderRadius: 7, border: `1px solid ${P.border}`,
                          background: P.glass, color: P.txt3, cursor: "pointer",
                          fontSize: 11, fontFamily: font, transition: "all 0.2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = P.borderH; e.currentTarget.style.color = P.txt; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.txt3; }}
                      >
                        {driveLink ? <><Copy size={11} /> Cambiar</> : <><Plus size={11} /> Agregar link</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProperties.length === 0 && (
        <G style={{ textAlign: "center", padding: 40 }}>
          <Building2 size={40} color={P.txt3} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, color: P.txt2, fontFamily: fontDisp }}>No hay propiedades en este rango de presupuesto</p>
          <p style={{ fontSize: 12, color: P.txt3, marginTop: 4 }}>Ajusta el rango en el paso anterior</p>
          <button onClick={() => setShowNewPropModal(true)} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 10, border: `1px solid ${P.accent}40`, background: P.accentS, color: P.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
            <Plus size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />Registrar propiedad nueva
          </button>
        </G>
      )}

      {selectedProps.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, padding: "14px 20px",
          background: "rgba(6,10,17,0.95)", backdropFilter: "blur(16px)",
          borderRadius: 14, border: `1px solid ${P.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
        }}>
          <div>
            <p style={{ fontSize: 13, color: P.txt, fontWeight: 600 }}>{selectedProps.length} propiedad{selectedProps.length > 1 ? "es" : ""} seleccionada{selectedProps.length > 1 ? "s" : ""}</p>
            <p style={{ fontSize: 11, color: P.txt3 }}>para {clientName}</p>
          </div>
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 28px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.95)", color: "#0A0F18",
            fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
          }}>
            <Wand2 size={16} /> Generar Landing Page
          </button>
        </div>
      )}

      {/* New Property Modal */}
      {showNewPropModal && (
        <NewPropertyModal
          onClose={() => { setShowNewPropModal(false); setEditingProp(null); }}
          onSave={saveCustomProp}
          initialData={editingProp}
        />
      )}

      {/* Full-screen Landing Page Preview */}
      {previewOpen && createPortal(
        <LandingPagePreview
          client={clientName}
          asesor={asesor}
          asesorWA={asesorWA}
          asesorCal={asesorCal}
          mensaje={mensaje}
          agencyName={agencyName}
          properties={allProperties.filter(p => selectedProps.includes(p.id))}
          driveLinks={driveLinks}
          onClose={() => { setPreviewOpen(false); resetForm(); }}
          onCopyLink={handleCopyLink}
          copied={copied}
        />,
        document.body
      )}
    </div>
  );

  return null;
};

/* ════════════════════════════════════════
   LANDING PAGE PREVIEW — FULL SCREEN
   ════════════════════════════════════════ */
const LandingPagePreview = ({ client, asesor, asesorWA = "", asesorCal = "", mensaje, agencyName = "STRATOS REALTY", properties, onClose, onCopyLink, copied, driveLinks = {} }) => {
  const [activeProperty, setActiveProperty] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const currentProp = properties[activeProperty] || properties[0];
  if (!currentProp) return null;

  const fmtPrice = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  const waPhone = asesorWA.replace(/\D/g, "");
  const propNames = properties.map(p => p.name).join(", ");
  const waText = encodeURIComponent(`Hola ${asesor.split(" ")[0]}, acabo de revisar la presentación de propiedades que me enviaste (${propNames}). Me gustaría conocer más detalles.`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const calUrl = asesorCal || null;

  const demoShareUrl = `${window.location.origin}${window.location.pathname}?lp=preview&c=${encodeURIComponent(client || "cliente")}`;

  const handleWhatsAppAdvisor = () => {
    if (waUrl) window.open(waUrl, "_blank");
  };
  const handleScheduleCall = () => {
    if (calUrl) window.open(calUrl, "_blank");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "#000000", overflowY: "auto",
      fontFamily: font,
    }}>
      {/* Share panel overlay */}
      {showSharePanel && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowSharePanel(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0C1219", border: `1px solid ${P.border}`,
            borderRadius: 20, padding: "28px 32px", width: 500, maxWidth: "95vw",
            boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>Enviar al cliente</p>
              <button onClick={() => setShowSharePanel(false)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={P.txt2} />
              </button>
            </div>

            {/* Copy link */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enlace de la landing page</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={demoShareUrl} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, fontSize: 11, background: P.glass, border: `1px solid ${P.border}`, color: P.txt3, fontFamily: font, outline: "none" }} onClick={e => e.target.select()} />
                <button onClick={() => { onCopyLink(); navigator.clipboard.writeText(demoShareUrl).catch(()=>{}); }} style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: copied ? P.emerald : P.accent, color: "#000",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}>
                  {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* WhatsApp option */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enviar por WhatsApp</p>
              {waUrl ? (
                <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti: ${demoShareUrl}`)}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                    borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                    color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                    transition: "all 0.2s",
                  }}
                >
                  <Phone size={16} /> Enviar enlace al cliente por WhatsApp
                </a>
              ) : (
                <div style={{ padding: "12px 18px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt3, fontSize: 12 }}>
                  Configura el WhatsApp del asesor en el Paso 1 para activar esta opción
                </div>
              )}
            </div>

            {/* Calendly / meeting link */}
            {calUrl && (
              <div>
                <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agendar llamada</p>
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  borderRadius: 10, background: P.blueS || "rgba(126,184,240,0.08)", border: `1px solid ${P.blue}30`,
                  color: P.blue, textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                }}>
                  <CalendarDays size={16} /> Abrir link de agenda
                </a>
              </div>
            )}

            <p style={{ fontSize: 10, color: P.txt3, marginTop: 18, lineHeight: 1.6, textAlign: "center" }}>
              La landing page muestra las propiedades seleccionadas con todos sus datos,<br />galería de imágenes y botones de contacto directo con el asesor.
            </p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pill color={P.accent}>Vista Previa</Pill>
          <span style={{ fontSize: 12, color: P.txt2 }}>Landing page para {client}</span>
          {properties.length > 1 && (
            <span style={{ fontSize: 11, color: P.txt3 }}>· {properties.length} propiedades</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onCopyLink} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: `1px solid ${copied ? P.emerald + "50" : P.border}`,
            background: copied ? "rgba(109,212,168,0.08)" : P.glass,
            cursor: "pointer", color: copied ? P.emerald : P.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
            transition: "all 0.25s",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button onClick={() => setShowSharePanel(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)",
            cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
          }}>
            <Share2 size={14} /> Enviar al cliente
          </button>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${P.border}`,
            background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color={P.txt2} />
          </button>
        </div>
      </div>

      {/* ─── LANDING PAGE CONTENT ─── */}
      <div style={{ paddingTop: 60 }}>
        {/* HERO SECTION */}
        <div style={{
          minHeight: "100vh", position: "relative",
          background: currentProp.img,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: "0 0 60px 0",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)" }} />

          {/* Floating nav dots */}
          {properties.length > 1 && (
            <div style={{
              position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {properties.map((p, i) => (
                <button key={p.id} onClick={() => setActiveProperty(i)} style={{
                  width: i === activeProperty ? 12 : 8,
                  height: i === activeProperty ? 12 : 8,
                  borderRadius: "50%", border: "none", cursor: "pointer",
                  background: i === activeProperty ? p.accent : "rgba(255,255,255,0.3)",
                  boxShadow: i === activeProperty ? `0 0 12px ${p.accent}60` : "none",
                  transition: "all 0.3s",
                }} title={p.name} />
              ))}
            </div>
          )}

          <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 40px", width: "100%" }}>
            {/* Branding */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
              <StratosAtom size={24} color={currentProp.accent} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 400, fontFamily: fontDisp, letterSpacing: "0.1em" }}>{agencyName}</span>
            </div>

            {/* Personalized greeting */}
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontFamily: font, marginBottom: 8, fontWeight: 400 }}>
              Preparado exclusivamente para
            </p>
            <h1 style={{ fontSize: 52, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20 }}>
              {client || "Estimado Cliente"}
            </h1>

            {mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                {mensaje || `Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.`}
              </p>
            )}

            {!mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.
              </p>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={15} style={{ verticalAlign: "middle" }} /> Agendar Llamada
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  <CalendarDays size={15} style={{ marginRight: 8, verticalAlign: "middle" }} />Agendar Llamada
                </button>
              )}
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                  color: "#25D366", fontSize: 14, fontWeight: 600, fontFamily: fontDisp,
                  backdropFilter: "blur(10px)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <Phone size={14} /> WhatsApp
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)",
                  color: "#FFFFFF", fontSize: 14, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                  backdropFilter: "blur(10px)",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: 40, marginTop: 50 }}>
              {[
                { label: "Propiedades", value: properties.length },
                { label: "ROI Estimado", value: "8-13%" },
                { label: "Ubicaciones", value: [...new Set(properties.map(p => p.location))].length },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROPERTIES SECTION */}
        <div style={{ background: "#050810", padding: "80px 40px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <p style={{ fontSize: 11, color: currentProp.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>PORTAFOLIO EXCLUSIVO</p>
              <h2 style={{ fontSize: 36, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                Propiedades Seleccionadas
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 12, fontFamily: font }}>
                Cada propiedad ha sido elegida en base a sus criterios de inversión
              </p>
            </div>

            {properties.map((prop, idx) => (
              <div key={prop.id} style={{
                marginBottom: 60, borderRadius: 20, overflow: "hidden",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                {/* Property Header */}
                <div style={{
                  height: 280, background: prop.img, position: "relative",
                  display: "flex", alignItems: "flex-end", padding: 32,
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)" }} />
                  <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          <Pill color={prop.accent}>{prop.type}</Pill>
                          <Pill color={P.emerald}>ROI {prop.roi}</Pill>
                        </div>
                        <h3 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                          {prop.name} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 200 }}>{prop.brand}</span>
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                          <MapPin size={14} color="rgba(255,255,255,0.5)" />
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: font }}>{prop.location} — {prop.zone}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>DESDE</p>
                        <p style={{ fontSize: 38, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                          {fmtPrice(prop.priceFrom)}
                        </p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>hasta {fmtPrice(prop.priceTo)} USD</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Property Body */}
                <div style={{ padding: 32 }}>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, fontFamily: font, marginBottom: 28, maxWidth: 800 }}>
                    {prop.description}
                  </p>

                  {/* Key Metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                    {[
                      { label: "Recámaras", value: prop.bedrooms, icon: Home, c: prop.accent },
                      { label: "ROI Anual", value: prop.roi, icon: TrendingUp, c: P.emerald },
                      { label: "Entrega", value: prop.delivery, icon: Calendar, c: P.blue },
                      { label: "Tamaños", value: prop.sizes[0] + " – " + prop.sizes[prop.sizes.length - 1], icon: Maximize2, c: P.violet },
                    ].map(m => (
                      <div key={m.label} style={{
                        padding: "16px", borderRadius: 12,
                        background: `${m.c}08`, border: `1px solid ${m.c}15`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <m.icon size={14} color={m.c} />
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Por qué esta propiedad</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {prop.highlights.map((h, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <CheckCircle2 size={16} color={prop.accent} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Amenidades</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {prop.amenities.map((a, i) => (
                        <span key={i} style={{
                          fontSize: 11, color: "rgba(255,255,255,0.6)", padding: "5px 12px",
                          borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                        }}>{a}</span>
                      ))}
                    </div>
                  </div>

                  {/* Gallery / Drive link CTA */}
                  <div style={{
                    marginTop: 8, padding: "20px 24px", borderRadius: 14,
                    background: (driveLinks[prop.id] || prop.driveLink) ? `${prop.accent}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${(driveLinks[prop.id] || prop.driveLink) ? prop.accent + "30" : "rgba(255,255,255,0.05)"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 4 }}>
                        {(driveLinks[prop.id] || prop.driveLink) ? "Galería de imágenes disponible" : "Galería de imágenes"}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font }}>
                        {(driveLinks[prop.id] || prop.driveLink)
                          ? "Fotos reales del proyecto, renders y planos disponibles"
                          : "El asesor puede agregar un link a la galería de fotos desde el panel"}
                      </p>
                    </div>
                    {(driveLinks[prop.id] || prop.driveLink) ? (
                      <a
                        href={driveLinks[prop.id] || prop.driveLink}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "12px 24px", borderRadius: 10,
                          border: `1px solid ${prop.accent}50`,
                          background: `${prop.accent}15`,
                          color: prop.accent, textDecoration: "none",
                          fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Image size={15} /> Ver galería <ExternalLink size={12} />
                      </a>
                    ) : (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "12px 24px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: fontDisp,
                      }}>
                        <Image size={14} /> Galería no configurada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MARKET DATA SECTION */}
        <div style={{ background: "#030508", padding: "80px 40px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 50 }}>
              <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>DATOS DEL MERCADO 2026</p>
              <h2 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                ¿Por qué la Riviera Maya?
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40 }}>
              {[
                { label: "Crecimiento Anual", value: "14%", sub: "Nominal YoY", icon: TrendingUp, c: P.emerald },
                { label: "ROI por Rentas", value: "8-15%", sub: "Neto anual", icon: DollarSign, c: P.accent },
                { label: "Ocupación", value: "75-90%", sub: "Promedio anual", icon: Building2, c: P.blue },
              ].map(s => (
                <div key={s.label} style={{
                  padding: 28, borderRadius: 16, textAlign: "center",
                  background: `${s.c}06`, border: `1px solid ${s.c}15`,
                }}>
                  <s.icon size={24} color={s.c} style={{ margin: "0 auto 14px" }} />
                  <p style={{ fontSize: 36, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: "0.05em" }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: s.c, marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 18 }}>Ventajas para Inversionistas</p>
                {[
                  "Propiedad 100% legal para extranjeros via fideicomiso",
                  "Impuestos prediales mínimos vs EE.UU./Canadá",
                  "Nuevo Aeropuerto Internacional de Tulum",
                  "Tren Maya conectando toda la región",
                  "Turismo 365 días — clima cálido todo el año",
                  "Mercado de nómadas digitales en expansión",
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={16} color={P.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 18 }}>Infraestructura</p>
                {[
                  { title: "Aeropuerto de Tulum", desc: "Nuevo aeropuerto internacional, abrió en 2025" },
                  { title: "Tren Maya", desc: "Conectividad ferroviaria regional — impulsa plusvalía" },
                  { title: "Precio promedio por m²", desc: "$3,600 USD/m² — potencial de apreciación significativo" },
                  { title: "Plusvalía real", desc: "8% anual después de inflación" },
                ].map((inf, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{inf.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.4 }}>{inf.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA SECTION */}
        <div style={{ background: "#000000", padding: "80px 40px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <StratosAtom size={40} color={P.accent} />
            <h2 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginTop: 20, marginBottom: 12 }}>
              ¿Listo para dar el siguiente paso?
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32 }}>
              Agenda una llamada con <strong style={{ color: "rgba(255,255,255,0.8)" }}>{asesor}</strong> para conocer todos los detalles, resolver tus dudas y asegurar la mejor oportunidad de inversión.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={16} /> Agendar con {asesor.split(" ")[0]}
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  Agendar Llamada con {asesor.split(" ")[0]}
                </button>
              )}
              {waUrl ? (
                <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${asesor.split(" ")[0]}, vi tu presentación de propiedades y me interesa agendar una llamada. ¿Cuándo tienes disponibilidad?`)}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: "16px 40px", borderRadius: 12,
                    border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                    color: "#25D366", fontSize: 15, fontWeight: 600, fontFamily: fontDisp,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <Phone size={15} /> WhatsApp
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#FFFFFF", fontSize: 15, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            <div style={{ marginTop: 60, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Stratos Realty · Riviera Maya, México · Presentación confidencial generada para {client}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>
                Asesor: {asesor} · Abril 2026 · Todos los precios en USD · Sujeto a disponibilidad
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   FINANZAS & ADMINISTRACIÓN
   Sistema Contable-Fiscal · México 2026
   CFDI 4.0 | SAT | NIF | ISR | IVA | IMSS
   ════════════════════════════════════════ */
const FinanzasAdmin = ({ leads = [] }) => {
  const [tab, setTab]         = useState("panel");
  const [cfdiFilter, setCfdiFilter] = useState("todos");
  const [showNewCFDI, setShowNewCFDI] = useState(false);
  const [cxTab, setCxTab]     = useState("cobrar");



  const [cfdiForm, setCfdiForm] = useState({
    receptor: "", rfc: "", uso: "G03", tipo: "I", concepto: "",
    subtotal: "", iva: "16", metodoPago: "PUE", formaPago: "03", moneda: "MXN",
  });

  // ─── Datos: CFDI 4.0 ───
  const cfdiData = [
    { id: 1, uuid: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890", fecha: "07/04/2026", tipo: "I", receptor: "Desarrolladora Riviera SA de CV", rfc: "DRI950301AB3", concepto: "Honorarios asesoría fiscal Q1-2026", subtotal: 45000, iva: 7200, total: 52200, status: "Vigente", metodo: "PUE", forma: "03", uso: "G03", serie: "A", folio: "001" },
    { id: 2, uuid: "B2C3D4E5-F6A7-8901-BCDE-F12345678901", fecha: "04/04/2026", tipo: "I", receptor: "Stratos Realty SC", rfc: "SRE200115P72", concepto: "Contabilidad mensual Abril 2026", subtotal: 8500, iva: 1360, total: 9860, status: "Vigente", metodo: "PPD", forma: "99", uso: "G03", serie: "A", folio: "002" },
    { id: 3, uuid: "C3D4E5F6-A7B8-9012-CDEF-123456789012", fecha: "01/04/2026", tipo: "I", receptor: "Inversiones Costa SA de CV", rfc: "ICO180420HJ5", concepto: "Declaración anual ISR personas morales 2025", subtotal: 22000, iva: 3520, total: 25520, status: "Vigente", metodo: "PUE", forma: "03", uso: "G03", serie: "A", folio: "003" },
    { id: 4, uuid: "D4E5F6A7-B8C9-0123-DEF0-234567890123", fecha: "28/03/2026", tipo: "E", receptor: "Adobe Systems Inc.", rfc: "XEXX010101000", concepto: "Nota de crédito — ajuste honorarios Q4-2025", subtotal: 3500, iva: 560, total: 4060, status: "Vigente", metodo: "PUE", forma: "03", uso: "G01", serie: "NC", folio: "001" },
    { id: 5, uuid: "E5F6A7B8-C9D0-1234-EF01-345678901234", fecha: "25/03/2026", tipo: "I", receptor: "Grupo Inmobiliario del Caribe SA", rfc: "GIC150630KM9", concepto: "Auditoría fiscal preventiva 2025", subtotal: 35000, iva: 5600, total: 40600, status: "Cancelado", metodo: "PUE", forma: "04", uso: "G03", serie: "A", folio: "004" },
    { id: 6, uuid: "F6A7B8C9-D0E1-2345-F012-456789012345", fecha: "20/03/2026", tipo: "P", receptor: "Stratos Realty SC", rfc: "SRE200115P72", concepto: "Complemento de pago — Factura A-002", subtotal: 0, iva: 0, total: 9860, status: "Vigente", metodo: "PPD", forma: "03", uso: "CP01", serie: "P", folio: "001" },
    { id: 7, uuid: "A7B8C9D0-E1F2-3456-0123-567890123456", fecha: "15/03/2026", tipo: "I", receptor: "Promotora Tulum Norte SA de CV", rfc: "PTN190805RF2", concepto: "Asesoría fiscal — reestructuración corporativa", subtotal: 60000, iva: 9600, total: 69600, status: "Vigente", metodo: "PUE", forma: "02", uso: "G03", serie: "A", folio: "005" },
    { id: 8, uuid: "B8C9D0E1-F2A3-4567-1234-678901234567", fecha: "10/03/2026", tipo: "I", receptor: "Publico en General", rfc: "XAXX010101000", concepto: "Servicios contables — cliente general", subtotal: 1200, iva: 192, total: 1392, status: "Vigente", metodo: "PUE", forma: "01", uso: "S01", serie: "A", folio: "006" },
  ];

  // ─── Datos: Calendario Fiscal 2026 ───
  const obligaciones = [
    { id: 1, fecha: "17/04/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Marzo 2026", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 14 LISR" },
    { id: 2, fecha: "17/04/2026", tipo: "IVA", desc: "Declaración mensual IVA — Marzo 2026", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 5-D LIVA" },
    { id: 3, fecha: "17/04/2026", tipo: "IMSS", desc: "Liquidación cuotas IMSS — Marzo 2026 (SUA)", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 39 LSS" },
    { id: 4, fecha: "17/04/2026", tipo: "CFDI", desc: "Emisión CFDI nómina mensual — Abril 2026 (timbrar)", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 99 LISR" },
    { id: 5, fecha: "30/04/2026", tipo: "ISR", desc: "Declaración anual ISR personas físicas — Ejercicio 2025", periodicidad: "Anual", status: "En proceso", urgente: true, articulo: "Art. 150 LISR" },
    { id: 6, fecha: "17/05/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Abril 2026", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 14 LISR" },
    { id: 7, fecha: "17/05/2026", tipo: "IVA", desc: "Declaración mensual IVA — Abril 2026", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 5-D LIVA" },
    { id: 8, fecha: "30/05/2026", tipo: "DIOT", desc: "DIOT — Declaración Informativa Operaciones con Terceros Abril", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 32 LIVA" },
    { id: 9, fecha: "17/05/2026", tipo: "CONT", desc: "Envío contabilidad electrónica SAT — Abril 2026 (XML)", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 28 CFF" },
    { id: 10, fecha: "03/04/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Febrero 2026", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 14 LISR" },
    { id: 11, fecha: "03/04/2026", tipo: "IVA", desc: "Declaración mensual IVA — Febrero 2026", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 5-D LIVA" },
    { id: 12, fecha: "31/03/2026", tipo: "ISR", desc: "Declaración anual ISR personas morales — Ejercicio 2025", periodicidad: "Anual", status: "Completada", urgente: false, articulo: "Art. 76 LISR" },
  ];

  // ─── Datos: Cuentas por Cobrar ───
  const cxcData = [
    { id: 1, cliente: "Desarrolladora Riviera SA de CV", rfc: "DRI950301AB3", factura: "A-001", monto: 52200, vencimiento: "21/04/2026", diasVenc: -14, status: "Vigente" },
    { id: 2, cliente: "Grupo Inmobiliario del Caribe SA", rfc: "GIC150630KM9", factura: "A-005", monto: 69600, vencimiento: "04/04/2026", diasVenc: 3, status: "Vencida" },
    { id: 3, cliente: "Promotora Tulum Norte SA de CV", rfc: "PTN190805RF2", factura: "A-007", monto: 69600, vencimiento: "14/04/2026", diasVenc: -7, status: "Vigente" },
    { id: 4, cliente: "Inversiones Costa SA de CV", rfc: "ICO180420HJ5", factura: "A-003", monto: 25520, vencimiento: "01/05/2026", diasVenc: -24, status: "Vigente" },
    { id: 5, cliente: "Stratos Realty SC", rfc: "SRE200115P72", factura: "A-002", monto: 9860, vencimiento: "20/03/2026", diasVenc: 18, status: "Pagada" },
    { id: 6, cliente: "Constructora Akumal SRL", rfc: "CAK200710LP3", factura: "A-008", monto: 15400, vencimiento: "10/03/2026", diasVenc: 28, status: "Vencida" },
  ];

  // ─── Datos: Cuentas por Pagar ───
  const cxpData = [
    { id: 1, proveedor: "Colegio de Contadores Públicos", rfc: "CCP550101LP8", concepto: "Cuota anual membresía 2026", monto: 4800, vencimiento: "30/04/2026", status: "Pendiente" },
    { id: 2, proveedor: "Facturaelectronicaplus SA de CV", rfc: "FEP180910KJ2", concepto: "Licencia software facturación CFDI 4.0 (anual)", monto: 12500, vencimiento: "15/04/2026", status: "Pendiente" },
    { id: 3, proveedor: "Arrendadora Polanco SA de CV", rfc: "APO150220RF5", concepto: "Renta oficina Abril 2026", monto: 22000, vencimiento: "05/04/2026", status: "Pagada" },
    { id: 4, proveedor: "CFE (Comisión Federal Electricidad)", rfc: "CFE370814QI0", concepto: "Servicio eléctrico bimestral", monto: 1850, vencimiento: "20/04/2026", status: "Pendiente" },
    { id: 5, proveedor: "SAT — Resolución Miscelánea", rfc: "SAT970701NN3", concepto: "Contribuciones fiscales — ISR provisional Febrero", monto: 18400, vencimiento: "17/03/2026", status: "Pagada" },
  ];

  // ─── Datos: Flujo de Caja ───
  const flujoData = [
    { mes: "Ene", ingresos: 95400, egresos: 62000, saldo: 33400 },
    { mes: "Feb", ingresos: 112800, egresos: 71500, saldo: 41300 },
    { mes: "Mar", ingresos: 148600, egresos: 89200, saldo: 59400 },
    { mes: "Abr", ingresos: 158000, egresos: 95800, saldo: 62200 },
    { mes: "May", ingresos: 134500, egresos: 84300, saldo: 50200 },
    { mes: "Jun", ingresos: 162000, egresos: 98000, saldo: 64000 },
    { mes: "Jul", ingresos: 178000, egresos: 101000, saldo: 77000 },
    { mes: "Ago", ingresos: 155000, egresos: 96000, saldo: 59000 },
    { mes: "Sep", ingresos: 171000, egresos: 104000, saldo: 67000 },
    { mes: "Oct", ingresos: 188000, egresos: 112000, saldo: 76000 },
    { mes: "Nov", ingresos: 195000, egresos: 118000, saldo: 77000 },
    { mes: "Dic", ingresos: 210000, egresos: 132000, saldo: 78000 },
  ];

  // ─── Helpers ───
  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString("es-MX")}`;
  const fmtPct = (n) => `${n.toFixed(1)}%`;
  const tipoColor = { I: P.emerald, E: P.rose, P: P.blue, T: P.violet };
  const tipoLabel = { I: "Ingreso", E: "Egreso", P: "Pago", T: "Traslado" };
  const tipoObl = { ISR: P.blue, IVA: P.emerald, IMSS: P.violet, CFDI: P.accent, DIOT: P.amber, CONT: P.cyan };
  const statusCFDI = { Vigente: P.emerald, Cancelado: P.rose, "Por cobrar": P.amber };
  const statusObl = { Completada: P.emerald, Pendiente: P.amber, "En proceso": P.blue, Próxima: P.txt3, Vencida: P.rose };
  const statusCX = { Vigente: P.accent, Vencida: P.rose, Pagada: P.emerald, Pendiente: P.amber };

  const totalIngresos = (leads.filter(l => l.st === "Cerrado").reduce((s, l) => s + (l.budget || 0), 0)) || cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.total, 0);
  const totalIVA = cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.iva, 0) || (totalIngresos * 0.16);
  const totalCXC = (leads.filter(l => ["Contrato", "Escritura"].includes(l.st)).reduce((s, l) => s + (l.budget || 0), 0)) || cxcData.filter(c => c.status !== "Pagada").reduce((s, c) => s + c.monto, 0);
  const cxcVencidas = cxcData.filter(c => c.status === "Vencida").reduce((s, c) => s + c.monto, 0) || (totalCXC * 0.12);
  const totalCXP = cxpData.filter(c => c.status === "Pendiente").reduce((s, c) => s + c.monto, 0);
  const isrProvisional = Math.round(totalIngresos * 0.30); 

  const cfdiFiltered = cfdiFilter === "todos" ? cfdiData : cfdiFilter === "cancelado" ? cfdiData.filter(c => c.status === "Cancelado") : cfdiData.filter(c => c.tipo === cfdiFilter);

  const tabs = [
    { id: "panel", label: "Panel General", icon: BarChart3 },
    { id: "cfdi", label: "Facturación CFDI 4.0", icon: Receipt },
    { id: "fiscal", label: "Obligaciones Fiscales", icon: ListChecks },
    { id: "cuentas", label: "Cuentas CxC / CxP", icon: Wallet },
    { id: "flujo", label: "Flujo de Caja", icon: TrendingUp },
  ];

  // ─── Render Modal: Nueva Factura ───
  const NewCFDIModal = () => {
    const usoCFDI = [
      { c: "G01", l: "Adquisición de mercancias" }, { c: "G03", l: "Gastos en general" },
      { c: "I01", l: "Construcciones" }, { c: "I03", l: "Equipo de transporte" },
      { c: "I06", l: "Comunicaciones telefónicas" }, { c: "D01", l: "Honorarios médicos, dentales y hospitalarios" },
      { c: "S01", l: "Sin efectos fiscales" }, { c: "CP01", l: "Pagos" },
    ];
    const formasPago = [
      { c: "01", l: "Efectivo" }, { c: "02", l: "Cheque nominativo" },
      { c: "03", l: "Transferencia electrónica de fondos" }, { c: "04", l: "Tarjeta de crédito" },
      { c: "28", l: "Tarjeta de débito" }, { c: "99", l: "Por definir" },
    ];
    const subtotalNum = parseFloat(cfdiForm.subtotal) || 0;
    const ivaNum = subtotalNum * (parseFloat(cfdiForm.iva) / 100);
    const totalNum = subtotalNum + ivaNum;
    const set = (k, v) => setCfdiForm(p => ({ ...p, [k]: v }));

    return createPortal(
      <>
        <div onClick={() => setShowNewCFDI(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 300000 }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300001,
          width: 680, maxHeight: "92vh", overflowY: "auto",
          background: "#0C1219", border: `1px solid ${P.border}`, borderRadius: 22,
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
        }}>
          {/* Header */}
          <div style={{ padding: "22px 28px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(110,231,194,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Ico icon={FilePlus} sz={38} is={18} c={P.accent} />
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>Nueva Factura — CFDI 4.0</p>
                <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Conforme a la Resolución Miscelánea Fiscal 2026 · SAT</p>
              </div>
            </div>
            <button onClick={() => setShowNewCFDI(false)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} color={P.txt2} /></button>
          </div>
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Tipo CFDI */}
            <div>
              <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo de Comprobante</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "I", l: "Ingreso", c: P.emerald }, { v: "E", l: "Egreso", c: P.rose }, { v: "P", l: "Pago", c: P.blue }, { v: "T", l: "Traslado", c: P.violet }].map(t => (
                  <button key={t.v} onClick={() => set("tipo", t.v)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1px solid ${cfdiForm.tipo === t.v ? t.c + "60" : P.border}`, background: cfdiForm.tipo === t.v ? `${t.c}12` : P.glass, color: cfdiForm.tipo === t.v ? t.c : P.txt2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Receptor */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Receptor / Razón social</label>
                <input value={cfdiForm.receptor} onChange={e => set("receptor", e.target.value)} placeholder="Nombre o razón social..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font, outline: "none" }} onFocus={e => e.target.style.borderColor = P.accent + "50"} onBlur={e => e.target.style.borderColor = P.border} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>RFC del Receptor</label>
                <input value={cfdiForm.rfc} onChange={e => set("rfc", e.target.value.toUpperCase())} placeholder="XAXX010101000" maxLength={13} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.accent, fontSize: 13, fontFamily: "monospace", outline: "none", letterSpacing: "0.06em" }} onFocus={e => e.target.style.borderColor = P.accent + "50"} onBlur={e => e.target.style.borderColor = P.border} />
              </div>
            </div>
            {/* Concepto */}
            <div>
              <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Descripción / Concepto</label>
              <textarea value={cfdiForm.concepto} onChange={e => set("concepto", e.target.value)} rows={2} placeholder="Descripción detallada del servicio o producto..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font, outline: "none", resize: "vertical" }} />
            </div>
            {/* Importes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal (MXN)</label>
                <input type="number" value={cfdiForm.subtotal} onChange={e => set("subtotal", e.target.value)} placeholder="0.00" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt, fontSize: 14, fontFamily: fontDisp, outline: "none", fontWeight: 600 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>IVA %</label>
                <select value={cfdiForm.iva} onChange={e => set("iva", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.surface, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font }}>
                  <option value="16">16%</option>
                  <option value="8">8% (Zona fronteriza)</option>
                  <option value="0">0% (Tasa cero)</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: `${P.accent}08`, border: `1px solid ${P.accent}20`, textAlign: "right" }}>
                  <p style={{ fontSize: 10, color: P.txt3, marginBottom: 3 }}>TOTAL CFDI</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: P.accent, fontFamily: fontDisp }}>${totalNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            {/* Fiscal fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Método de pago</label>
                <select value={cfdiForm.metodoPago} onChange={e => set("metodoPago", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.surface, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font }}>
                  <option value="PUE">PUE — Pago en una sola exhibición</option>
                  <option value="PPD">PPD — Pago en parcialidades o diferido</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Forma de pago</label>
                <select value={cfdiForm.formaPago} onChange={e => set("formaPago", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.surface, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font }}>
                  {[{ c: "01", l: "Efectivo" }, { c: "02", l: "Cheque" }, { c: "03", l: "Transferencia" }, { c: "04", l: "T. Crédito" }, { c: "28", l: "T. Débito" }, { c: "99", l: "Por definir" }].map(f => (
                    <option key={f.c} value={f.c}>{f.c} — {f.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Uso CFDI</label>
                <select value={cfdiForm.uso} onChange={e => set("uso", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: P.surface, border: `1px solid ${P.border}`, color: P.txt, fontSize: 13, fontFamily: font }}>
                  {usoCFDI.map(u => <option key={u.c} value={u.c}>{u.c} — {u.l}</option>)}
                </select>
              </div>
            </div>
            {/* SAT notice */}
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,194,0.05)", border: `1px solid ${P.accent}20`, display: "flex", gap: 10 }}>
              <BadgeCheck size={16} color={P.accent} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: P.txt2, lineHeight: 1.6, fontFamily: font }}>
                Este CFDI se generará conforme al <strong style={{ color: P.accent }}>Estándar CFDI 4.0</strong> (Anexo 20, RMF 2026). El timbrado se realizará vía PAC autorizado por el SAT. El archivo XML quedará disponible para descarga inmediata. Vigencia: hasta cancelación o 5 años.
              </p>
            </div>
            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowNewCFDI(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 13, cursor: "pointer", fontFamily: font }}>Cancelar</button>
              <button
                disabled={!cfdiForm.receptor || !cfdiForm.rfc || !cfdiForm.subtotal}
                onClick={() => setShowNewCFDI(false)}
                style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: cfdiForm.receptor && cfdiForm.rfc && cfdiForm.subtotal ? "rgba(255,255,255,0.95)" : P.glass, color: cfdiForm.receptor && cfdiForm.rfc && cfdiForm.subtotal ? "#0A0F18" : P.txt3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}
              >
                <FilePlus size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Timbrar CFDI 4.0 — Total: ${totalNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <Ico icon={Landmark} sz={42} is={20} c={P.accent} />
            <div>
              <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                Finanzas <span style={{ fontWeight: 600, color: P.accent }}>&amp;</span> Administración
              </p>
              <p style={{ fontSize: 11, color: P.txt3, marginTop: 2, letterSpacing: "0.01em" }}>
                Sistema Contable-Fiscal · México 2026 · CFDI 4.0 · RMF 2026 · NIF · SAT
              </p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 12, fontWeight: 600, fontFamily: fontDisp }}>
            <Download size={13} /> Exportar
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 12, fontWeight: 600, fontFamily: fontDisp }}>
            <RefreshCw size={13} /> Sincronizar SAT
          </button>
          <button onClick={() => setShowNewCFDI(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp, boxShadow: "0 4px 18px rgba(255,255,255,0.12)" }}>
            <FilePlus size={14} /> Nueva Factura CFDI
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: 4, padding: "4px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: `1px solid ${P.border}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer",
              background: active ? "rgba(255,255,255,0.08)" : "transparent",
              color: active ? "#FFF" : P.txt3, fontSize: 12, fontWeight: active ? 700 : 400,
              fontFamily: fontDisp, transition: "all 0.2s",
              boxShadow: active ? "0 1px 8px rgba(0,0,0,0.3)" : "none",
            }}>
              <t.icon size={13} color={active ? P.accent : P.txt3} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════
          TAB 1: PANEL GENERAL
          ═══════════════════════════════ */}
      {tab === "panel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {[
              { l: "Ingresos del Periodo", v: fmt(totalIngresos), sub: "CFDIs vigentes", c: P.emerald, i: TrendingUp },
              { l: "IVA Acreditable", v: fmt(totalIVA), sub: "Por declarar", c: P.accent, i: Percent },
              { l: "ISR Provisional", v: fmt(isrProvisional), sub: "Estimado periodo", c: P.blue, i: Banknote },
              { l: "Cuentas por Cobrar", v: fmt(totalCXC), sub: "Activas", c: P.violet, i: Wallet },
              { l: "CxC Vencidas", v: fmt(cxcVencidas), sub: "Requieren acción", c: P.rose, i: AlertCircle },
              { l: "Cuentas por Pagar", v: fmt(totalCXP), sub: "Pendientes", c: P.amber, i: CreditCard },
            ].map(k => (
              <G key={k.l} hover style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1 }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          {/* Gráfica + últimas facturas */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
            <G>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Flujo de Ingresos vs Egresos</p>
                  <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Ejercicio fiscal 2026</p>
                </div>
                <Pill color={P.emerald} s>+18% vs 2025</Pill>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={flujoData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ingG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={P.emerald} stopOpacity={0.25} /><stop offset="95%" stopColor={P.emerald} stopOpacity={0} /></linearGradient>
                    <linearGradient id="egG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={P.rose} stopOpacity={0.2} /><stop offset="95%" stopColor={P.rose} stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: P.txt3 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: P.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`$${v.toLocaleString("es-MX")}`, ""]} />
                  <Area type="monotone" dataKey="ingresos" stroke={P.emerald} strokeWidth={2} fill="url(#ingG)" name="Ingresos" />
                  <Area type="monotone" dataKey="egresos" stroke={P.rose} strokeWidth={2} fill="url(#egG)" name="Egresos" />
                </AreaChart>
              </ResponsiveContainer>
            </G>
            <G np>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Últimas Facturas</p>
                <button onClick={() => setTab("cfdi")} style={{ fontSize: 11, color: P.accent, background: "none", border: "none", cursor: "pointer" }}>Ver todo →</button>
              </div>
              {cfdiData.slice(0, 5).map(c => (
                <div key={c.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: tipoColor[c.tipo], background: `${tipoColor[c.tipo]}15`, padding: "2px 7px", borderRadius: 4 }}>{tipoLabel[c.tipo]}</span>
                      <span style={{ fontSize: 10, color: P.txt3 }}>{c.fecha}</span>
                    </div>
                    <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{c.receptor}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: c.tipo === "E" ? P.rose : P.emerald, fontFamily: fontDisp, flexShrink: 0 }}>{c.tipo === "E" ? "-" : "+"}{fmt(c.total)}</p>
                </div>
              ))}
            </G>
          </div>

          {/* Próximas Obligaciones */}
          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Ico icon={AlertTriangle} sz={32} is={14} c={P.amber} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Obligaciones Fiscales Próximas</p>
                  <p style={{ fontSize: 11, color: P.txt3 }}>Declaraciones y pagos al SAT pendientes · RMF 2026</p>
                </div>
              </div>
              <button onClick={() => setTab("fiscal")} style={{ fontSize: 11, color: P.accent, background: "none", border: "none", cursor: "pointer" }}>Ver calendario completo →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {obligaciones.filter(o => o.status !== "Completada").slice(0, 3).map(o => (
                <div key={o.id} style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${o.urgente ? P.amber + "40" : P.border}`, background: o.urgente ? `${P.amber}06` : P.glass }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tipoObl[o.tipo], background: `${tipoObl[o.tipo]}15`, padding: "3px 8px", borderRadius: 5 }}>{o.tipo}</span>
                    <span style={{ fontSize: 10, color: o.urgente ? P.amber : P.txt3, fontWeight: 600 }}>{o.fecha}</span>
                  </div>
                  <p style={{ fontSize: 11, color: P.txt, lineHeight: 1.5, marginBottom: 6 }}>{o.desc}</p>
                  <p style={{ fontSize: 9, color: P.txt3, fontStyle: "italic" }}>{o.articulo}</p>
                </div>
              ))}
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 2: FACTURACIÓN CFDI 4.0
          ═══════════════════════════════ */}
      {tab === "cfdi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter + search bar */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { v: "todos", l: "Todos" },
              { v: "I", l: "Ingresos" },
              { v: "E", l: "Egresos" },
              { v: "P", l: "Pagos" },
              { v: "T", l: "Traslados" },
              { v: "cancelado", l: "Cancelados" },
            ].map(f => (
              <button key={f.v} onClick={() => setCfdiFilter(f.v)} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: fontDisp,
                border: `1px solid ${cfdiFilter === f.v ? P.accent + "50" : P.border}`,
                background: cfdiFilter === f.v ? P.accentS : P.glass,
                color: cfdiFilter === f.v ? P.accent : P.txt2, cursor: "pointer", transition: "all 0.2s",
              }}>{f.l}</button>
            ))}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
              <Search size={13} color={P.txt3} />
              <input placeholder="Buscar RFC, receptor, UUID..." style={{ background: "transparent", border: "none", outline: "none", color: P.txt, fontSize: 12, flex: 1, fontFamily: font }} />
            </div>
            <button onClick={() => setShowNewCFDI(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)", cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp }}>
              <FilePlus size={13} /> Nueva Factura
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", color: P.txt2, fontSize: 12, fontFamily: fontDisp }}>
              <Download size={13} /> XML/PDF
            </button>
          </div>

          {/* CFDI Table */}
          <G np>
            <div style={{ display: "grid", gridTemplateColumns: "0.6fr 0.7fr 1.6fr 0.8fr 0.7fr 0.7fr 0.7fr 0.5fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Tipo</span><span>Fecha</span><span>Receptor / RFC</span><span>Concepto</span><span>Subtotal</span><span>IVA</span><span>Total</span><span>Status</span>
            </div>
            {cfdiFiltered.map(c => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 0.7fr 1.6fr 0.8fr 0.7fr 0.7fr 0.7fr 0.5fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: tipoColor[c.tipo], background: `${tipoColor[c.tipo]}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{tipoLabel[c.tipo]}</span>
                <span style={{ fontSize: 11, color: P.txt2 }}>{c.fecha}</span>
                <div>
                  <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.receptor}</p>
                  <p style={{ fontSize: 9, color: P.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                </div>
                <p style={{ fontSize: 11, color: P.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.concepto.substring(0, 30)}…</p>
                <span style={{ fontSize: 12, color: P.txt, fontFamily: fontDisp, fontWeight: 600 }}>{fmt(c.subtotal)}</span>
                <span style={{ fontSize: 11, color: P.amber, fontFamily: fontDisp }}>{fmt(c.iva)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.tipo === "E" ? P.rose : P.emerald, fontFamily: fontDisp }}>{fmt(c.total)}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: statusCFDI[c.status] || P.txt3, background: `${statusCFDI[c.status] || P.txt3}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
              </div>
            ))}
          </G>

          {/* UUID info bar */}
          <G style={{ padding: "12px 18px", background: "rgba(110,231,194,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BadgeCheck size={15} color={P.accent} />
              <p style={{ fontSize: 11, color: P.txt2, fontFamily: font }}>
                <strong style={{ color: P.accent }}>CFDI 4.0</strong> · Complemento de Pago · Carta Porte · Nómina 1.2 · Resolución Miscelánea Fiscal 2026 ·
                Los UUID se validan en tiempo real con el servicio de verificación del SAT.
              </p>
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 3: OBLIGACIONES FISCALES
          ═══════════════════════════════ */}
      {tab === "fiscal" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Summary pills */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Completadas", v: obligaciones.filter(o => o.status === "Completada").length, c: P.emerald, i: CheckSquare },
              { l: "Pendientes", v: obligaciones.filter(o => o.status === "Pendiente").length, c: P.amber, i: Clock },
              { l: "En Proceso", v: obligaciones.filter(o => o.status === "En proceso").length, c: P.blue, i: RefreshCw },
              { l: "Próximas", v: obligaciones.filter(o => o.status === "Próxima").length, c: P.txt3, i: CalendarDays },
            ].map(k => (
              <G key={k.l} hover style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                <Ico icon={k.i} sz={38} is={17} c={k.c} />
                <div>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                  <p style={{ fontSize: 11, color: P.txt2 }}>{k.l}</p>
                </div>
              </G>
            ))}
          </div>

          {/* Obligations list */}
          <G np>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Calendario de Obligaciones Fiscales 2026</p>
                <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>SAT · CFF · LISR · LIVA · LSS · RMF 2026</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["ISR", "IVA", "IMSS", "CFDI", "DIOT", "CONT"].map(t => (
                  <span key={t} style={{ fontSize: 9, fontWeight: 700, color: tipoObl[t], background: `${tipoObl[t]}15`, padding: "3px 8px", borderRadius: 5 }}>{t}</span>
                ))}
              </div>
            </div>
            {obligaciones.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 90, flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: o.urgente ? P.amber : P.txt2, fontFamily: fontDisp }}>{o.fecha}</p>
                  <p style={{ fontSize: 9, color: P.txt3, marginTop: 2 }}>{o.periodicidad}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: tipoObl[o.tipo], background: `${tipoObl[o.tipo]}15`, padding: "3px 10px", borderRadius: 5, width: 52, textAlign: "center", flexShrink: 0 }}>{o.tipo}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{o.desc}</p>
                  <p style={{ fontSize: 10, color: P.txt3, marginTop: 3, fontStyle: "italic" }}>{o.articulo}</p>
                </div>
                {o.urgente && (
                  <span style={{ fontSize: 9, color: P.amber, background: `${P.amber}15`, border: `1px solid ${P.amber}30`, padding: "3px 8px", borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>URGENTE</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: statusObl[o.status], background: `${statusObl[o.status]}15`, padding: "4px 12px", borderRadius: 6, flexShrink: 0 }}>{o.status}</span>
              </div>
            ))}
          </G>

          {/* Legal notice */}
          <G style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Scale size={18} color={P.txt3} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, color: P.txt3, lineHeight: 1.7, fontFamily: font }}>
                Fechas conforme al <strong style={{ color: P.txt2 }}>Código Fiscal de la Federación (CFF)</strong>, <strong style={{ color: P.txt2 }}>Ley del ISR</strong>, <strong style={{ color: P.txt2 }}>Ley del IVA</strong> y <strong style={{ color: P.txt2 }}>Resolución Miscelánea Fiscal 2026</strong>. Las fechas de vencimiento se recorren al día hábil siguiente cuando caen en sábado, domingo o día inhábil. Verificar el <strong style={{ color: P.accent }}>Buzón Tributario</strong> del SAT para notificaciones adicionales.
              </p>
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 4: CUENTAS CxC / CxP
          ═══════════════════════════════ */}
      {tab === "cuentas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "cobrar", l: "Cuentas por Cobrar (CxC)" }, { id: "pagar", l: "Cuentas por Pagar (CxP)" }].map(t => (
              <button key={t.id} onClick={() => setCxTab(t.id)} style={{ padding: "9px 22px", borderRadius: 9, border: `1px solid ${cxTab === t.id ? P.accent + "50" : P.border}`, background: cxTab === t.id ? P.accentS : P.glass, color: cxTab === t.id ? P.accent : P.txt2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s" }}>
                {t.l}
              </button>
            ))}
          </div>

          {cxTab === "cobrar" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { l: "Total por Cobrar", v: fmt(totalCXC), c: P.emerald, i: Wallet },
                  { l: "Al Corriente", v: fmt(cxcData.filter(c => c.status === "Vigente").reduce((s, c) => s + c.monto, 0)), c: P.accent, i: CheckCircle2 },
                  { l: "Vencidas", v: fmt(cxcVencidas), c: P.rose, i: AlertCircle },
                  { l: "Cobradas este mes", v: fmt(cxcData.filter(c => c.status === "Pagada").reduce((s, c) => s + c.monto, 0)), c: P.blue, i: Check },
                ].map(k => (
                  <G key={k.l} hover style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600 }}>{k.l}</p>
                      <Ico icon={k.i} sz={26} is={12} c={k.c} />
                    </div>
                    <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                  </G>
                ))}
              </div>
              <G np>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  <span>Cliente / RFC</span><span>Factura</span><span>Monto</span><span>Vencimiento</span><span>Días</span><span>Status</span>
                </div>
                {cxcData.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.cliente}</p>
                      <p style={{ fontSize: 9, color: P.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                    </div>
                    <span style={{ fontSize: 11, color: P.accent, fontFamily: fontDisp, fontWeight: 600 }}>{c.factura}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>{fmt(c.monto)}</span>
                    <span style={{ fontSize: 11, color: P.txt2 }}>{c.vencimiento}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.diasVenc > 0 ? P.rose : P.emerald, fontFamily: fontDisp }}>
                      {c.diasVenc > 0 ? `+${c.diasVenc}d` : `${Math.abs(c.diasVenc)}d`}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusCX[c.status], background: `${statusCX[c.status]}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
                  </div>
                ))}
              </G>
            </>
          )}

          {cxTab === "pagar" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { l: "Total por Pagar", v: fmt(totalCXP), c: P.rose, i: CreditCard },
                  { l: "Vencen esta semana", v: fmt(cxpData.filter(c => c.status === "Pendiente").slice(0, 2).reduce((s, c) => s + c.monto, 0)), c: P.amber, i: AlertTriangle },
                  { l: "Pagadas este mes", v: fmt(cxpData.filter(c => c.status === "Pagada").reduce((s, c) => s + c.monto, 0)), c: P.emerald, i: CheckSquare },
                ].map(k => (
                  <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                    <Ico icon={k.i} sz={36} is={16} c={k.c} />
                    <div>
                      <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                      <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                    </div>
                  </G>
                ))}
              </div>
              <G np>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  <span>Proveedor / RFC</span><span>Concepto</span><span>Monto</span><span>Vencimiento</span><span>Status</span>
                </div>
                {cxpData.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.proveedor}</p>
                      <p style={{ fontSize: 9, color: P.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                    </div>
                    <p style={{ fontSize: 11, color: P.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.concepto}</p>
                    <span style={{ fontSize: 13, fontWeight: 700, color: P.rose, fontFamily: fontDisp }}>{fmt(c.monto)}</span>
                    <span style={{ fontSize: 11, color: P.txt2 }}>{c.vencimiento}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusCX[c.status] || P.txt3, background: `${(statusCX[c.status] || P.txt3)}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
                  </div>
                ))}
              </G>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 5: FLUJO DE CAJA
          ═══════════════════════════════ */}
      {tab === "flujo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Ingresos Año 2026", v: fmt(flujoData.reduce((s, d) => s + d.ingresos, 0)), sub: "proyectado", c: P.emerald, i: TrendingUp },
              { l: "Egresos Año 2026", v: fmt(flujoData.reduce((s, d) => s + d.egresos, 0)), sub: "proyectado", c: P.rose, i: TrendingDown },
              { l: "Utilidad Neta", v: fmt(flujoData.reduce((s, d) => s + d.saldo, 0)), sub: "antes ISR", c: P.accent, i: PiggyBank },
              { l: "Margen Operativo", v: fmtPct(flujoData.reduce((s, d) => s + d.saldo, 0) / flujoData.reduce((s, d) => s + d.ingresos, 0) * 100), sub: "utilidad/ingreso", c: P.blue, i: Percent },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 24, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600, marginTop: 6 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Proyección de Flujo de Caja — 2026</p>
                <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Ingresos, egresos y saldo neto mensual</p>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[{ c: P.emerald, l: "Ingresos" }, { c: P.rose, l: "Egresos" }, { c: P.accent, l: "Saldo Neto" }].map(l => (
                  <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: l.c }} />
                    <span style={{ fontSize: 11, color: P.txt3 }}>{l.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={flujoData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }} barGap={3}>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: P.txt3 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: P.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                <Tooltip contentStyle={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`$${v.toLocaleString("es-MX")}`, ""]} />
                <Bar dataKey="ingresos" fill={P.emerald} radius={[4, 4, 0, 0]} name="Ingresos" opacity={0.85} />
                <Bar dataKey="egresos" fill={P.rose} radius={[4, 4, 0, 0]} name="Egresos" opacity={0.85} />
                <Bar dataKey="saldo" fill={P.accent} radius={[4, 4, 0, 0]} name="Saldo" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </G>

          {/* Tabla detalle por mes */}
          <G np>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Detalle Mensual</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "9px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Mes</span><span>Ingresos</span><span>Egresos</span><span>Saldo Neto</span><span>Margen</span>
            </div>
            {flujoData.map((d, i) => {
              const margen = ((d.saldo / d.ingresos) * 100).toFixed(1);
              return (
                <div key={d.mes} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: `1px solid ${P.border}`, background: i < 4 ? "rgba(255,255,255,0.01)" : "transparent", transition: "background 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{d.mes} 2026</span>
                    {i < 4 && <span style={{ fontSize: 9, color: P.accent, background: `${P.accent}12`, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Real</span>}
                    {i >= 4 && <span style={{ fontSize: 9, color: P.txt3, background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Proy.</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: P.emerald, fontFamily: fontDisp }}>{fmt(d.ingresos)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: P.rose, fontFamily: fontDisp }}>{fmt(d.egresos)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: P.accent, fontFamily: fontDisp }}>{fmt(d.saldo)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: P.border, overflow: "hidden" }}>
                      <div style={{ width: `${margen}%`, height: "100%", background: P.accent, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: P.accent, fontWeight: 600, fontFamily: fontDisp, width: 34, textAlign: "right" }}>{margen}%</span>
                  </div>
                </div>
              );
            })}
          </G>
        </div>
      )}

      {/* Modal CFDI */}
      {showNewCFDI && <NewCFDIModal />}

    </div>
  );
};

/* ─── Ícono átomo 3 aros IA (pro SVG) ─── */
const AIAtom = ({ size = 20, color = P.violet, spin = false }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={spin ? { animation: "atomSpin 3s linear infinite" } : {}}>
    {/* Nucleus */}
    <circle cx="18" cy="18" r="3" fill={color} opacity="0.95" />
    <circle cx="18" cy="18" r="1.4" fill="#fff" opacity="0.5" />
    {/* Ring 1 — horizontal */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.85" />
    {/* Ring 2 — 60° */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.6" transform="rotate(60 18 18)" />
    {/* Ring 3 — 120° */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.38" transform="rotate(120 18 18)" />
    {/* Electron dots */}
    <circle cx="33" cy="18" r="1.8" fill={color} opacity="0.9" />
    <circle cx="10.5" cy="7.8" r="1.8" fill={color} opacity="0.65" />
    <circle cx="10.5" cy="28.2" r="1.8" fill={color} opacity="0.42" />
  </svg>
);

/* ════════════════════════════════════════════════════════
   RECURSOS HUMANOS — STRATOS PEOPLE
   IA para Selección, Evaluación y Gestión de Talento 2026
   Inspirado en: Workday, Greenhouse, HireVue, Paradox AI
   ════════════════════════════════════════════════════════ */
const RRHHModule = () => {
  const [tab, setTab] = useState("panel");
  const [pipelineFilter, setPipelineFilter] = useState("todos");
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [aiScanning, setAiScanning] = useState(false);
  const [aiScanStep, setAiScanStep] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showNewVacante, setShowNewVacante] = useState(false);

  // ─── Datos: Candidatos ───
  const candidates = [
    { id: 1, nombre: "Sofía Ramírez Torres", cargo: "Asesor de Ventas Senior", etapa: "Entrevista", score: 94, habilidades: ["Ventas B2B", "CRM", "Inglés C1", "Bienes Raíces"], exp: "6 años", educacion: "Lic. Administración — ITAM", salario: 28000, cultureFit: 91, tecnico: 88, actitud: 97, fuente: "LinkedIn", avatar: "SR", color: P.emerald, tags: ["Top Pick", "Inglés Nativo"], nota: "Excelente experiencia en ventas de lujo. Cerró +$12M en 2025." },
    { id: 2, nombre: "Carlos Eduardo Mena", cargo: "Asesor de Ventas", etapa: "Assessment", score: 87, habilidades: ["Ventas", "Negociación", "Español", "Excel"], exp: "4 años", educacion: "Lic. Marketing — UNAM", salario: 22000, cultureFit: 84, tecnico: 82, actitud: 92, fuente: "Indeed", avatar: "CM", color: P.blue, tags: ["Motivado"], nota: "Perfil sólido. Requiere capacitación en lujo." },
    { id: 3, nombre: "Valentina Cruz Díaz", cargo: "Coordinadora de Marketing", etapa: "Oferta", score: 96, habilidades: ["Marketing Digital", "SEO", "Meta Ads", "Inglés C2", "Diseño"], exp: "5 años", educacion: "Lic. Comunicación — TEC de Monterrey", salario: 32000, cultureFit: 98, tecnico: 94, actitud: 96, fuente: "Referido", avatar: "VC", color: P.violet, tags: ["Top Pick", "Referida"], nota: "Referida por Emmanuel Ortiz. Portafolio excepcional." },
    { id: 4, nombre: "Roberto Fuentes Gil", cargo: "Asesor de Ventas", etapa: "Screening", score: 62, habilidades: ["Ventas", "Atención al cliente"], exp: "2 años", educacion: "Bachillerato", salario: 18000, cultureFit: 68, tecnico: 55, actitud: 74, fuente: "OCC", avatar: "RF", color: P.amber, tags: ["En revisión"], nota: "Poca experiencia en inmobiliario. Potencial de desarrollo." },
    { id: 5, nombre: "Isabella Moreno Park", cargo: "Asesor Internacional", etapa: "Entrevista", score: 91, habilidades: ["Ventas Internacionales", "Inglés C2", "Coreano básico", "CRM", "Lujo"], exp: "7 años", educacion: "MBA — EGADE Business School", salario: 38000, cultureFit: 89, tecnico: 93, actitud: 90, fuente: "LinkedIn", avatar: "IM", color: P.accent, tags: ["Bilingüe", "Internacional"], nota: "Especialista en clientes asiáticos y americanos." },
    { id: 6, nombre: "Miguel Ángel Reyes", cargo: "Contador Junior", etapa: "Postulado", score: 72, habilidades: ["Contabilidad", "CFDI 4.0", "SAT", "Excel avanzado"], exp: "3 años", educacion: "Lic. Contaduría Pública — UANL", salario: 19000, cultureFit: 78, tecnico: 80, actitud: 68, fuente: "Indeed", avatar: "MR", color: P.cyan, tags: [], nota: "Conocimiento sólido en CFDI. Perfil técnico." },
    { id: 7, nombre: "Camila Ortega Vidal", cargo: "Asistente de Dirección", etapa: "Rechazado", score: 41, habilidades: ["Office", "Organización"], exp: "1 año", educacion: "Carrera trunca", salario: 14000, cultureFit: 52, tecnico: 38, actitud: 60, fuente: "OCC", avatar: "CO", color: P.rose, tags: ["No apto"], nota: "Experiencia insuficiente para el rol." },
    { id: 8, nombre: "Daniel Vargas Leal", cargo: "Asesor de Ventas Senior", etapa: "Contratado", score: 89, habilidades: ["Ventas B2C", "Inglés B2", "CRM", "Bienes Raíces", "Negociación"], exp: "5 años", educacion: "Lic. Negocios Internacionales — UP", salario: 26000, cultureFit: 88, tecnico: 85, actitud: 93, fuente: "Referido", avatar: "DV", color: P.emerald, tags: ["Activo"], nota: "Incorporado 01/04/2026. Zona Tulum." },
  ];

  // ─── Datos: Vacantes ───
  const vacantes = [
    { id: 1, titulo: "Asesor de Ventas Senior — Riviera Maya", dept: "Ventas", tipo: "Tiempo completo", ubicacion: "Playa del Carmen", postulados: 18, entrevistas: 4, status: "Activa", prioridad: "Alta", salarioMin: 25000, salarioMax: 45000, publicada: "02/04/2026", cierre: "30/04/2026", desc: "Buscamos asesor con experiencia en bienes raíces de lujo, inglés avanzado y red de contactos internacionales." },
    { id: 2, titulo: "Coordinadora de Marketing Digital", dept: "Marketing", tipo: "Tiempo completo", ubicacion: "Remoto / Cancún", postulados: 34, entrevistas: 6, status: "Activa", prioridad: "Media", salarioMin: 28000, salarioMax: 42000, publicada: "28/03/2026", cierre: "25/04/2026", desc: "Experta en performance marketing, Meta Ads, Google, contenido lujo y marca personal de asesores." },
    { id: 3, titulo: "Contador Fiscal Sr. — CFDI 4.0", dept: "Finanzas", tipo: "Tiempo completo", ubicacion: "Cancún", postulados: 11, entrevistas: 2, status: "Activa", prioridad: "Alta", salarioMin: 22000, salarioMax: 35000, publicada: "01/04/2026", cierre: "20/04/2026", desc: "CPC con sólidos conocimientos en RMF 2026, declaraciones, IMSS y contabilidad electrónica SAT." },
    { id: 4, titulo: "Asistente de Dirección Ejecutiva", dept: "Dirección", tipo: "Tiempo completo", ubicacion: "Cancún", postulados: 47, entrevistas: 8, status: "Pausada", prioridad: "Baja", salarioMin: 18000, salarioMax: 26000, publicada: "15/03/2026", cierre: "15/05/2026", desc: "Soporte a CEO: agenda, reportes, coordinación de viajes y gestión de información confidencial." },
  ];

  // ─── Datos: Empleados activos ───
  const empleados = [
    { id: 1, nombre: "Emmanuel Ortiz Vázquez", cargo: "Director de Ventas", dept: "Ventas", desde: "Mar 2023", salario: 85000, score: 98, estado: "Activo", avatar: "EO", color: P.emerald },
    { id: 2, nombre: "Ken Lugo Ríos", cargo: "Asesor Senior", dept: "Ventas", desde: "Jun 2023", salario: 55000, score: 92, estado: "Activo", avatar: "KL", color: P.accent },
    { id: 3, nombre: "Cecilia Mendoza Flores", cargo: "Asesora Internacional", dept: "Ventas", desde: "Sep 2023", salario: 48000, score: 88, estado: "Activo", avatar: "CM", color: P.violet },
    { id: 4, nombre: "Araceli Oneto Peña", cargo: "Asesora de Ventas", dept: "Ventas", desde: "Jan 2024", salario: 38000, score: 85, estado: "Activo", avatar: "AO", color: P.blue },
    { id: 5, nombre: "Oscar Gálvez Torres", cargo: "CEO / Director General", dept: "Dirección", desde: "Jan 2022", salario: 150000, score: 100, estado: "Activo", avatar: "OG", color: P.accent },
    { id: 6, nombre: "Daniel Vargas Leal", cargo: "Asesor de Ventas", dept: "Ventas", desde: "Abr 2026", salario: 26000, score: 72, estado: "Onboarding", avatar: "DV", color: P.amber },
  ];

  const etapas = ["Postulado", "Screening", "Entrevista", "Assessment", "Oferta", "Contratado", "Rechazado"];
  const etapaColor = { Postulado: P.txt3, Screening: P.blue, Entrevista: P.violet, Assessment: P.amber, Oferta: P.emerald, Contratado: P.accent, Rechazado: P.rose };
  const prioColor = { Alta: P.rose, Media: P.amber, Baja: P.blue };
  const scoreColor = (s) => s >= 85 ? P.emerald : s >= 70 ? P.accent : s >= 55 ? P.amber : P.rose;
  const scoreLabel = (s) => s >= 85 ? "Excelente" : s >= 70 ? "Bueno" : s >= 55 ? "Regular" : "No apto";

  const filteredCandidates = pipelineFilter === "todos" ? candidates : candidates.filter(c => c.etapa === pipelineFilter);
  const totalPostulados = vacantes.reduce((s, v) => s + v.postulados, 0);
  const enProceso = candidates.filter(c => !["Contratado", "Rechazado"].includes(c.etapa)).length;
  const tasaConversion = Math.round((candidates.filter(c => c.etapa === "Contratado").length / candidates.length) * 100);

  const simulateAIScan = () => {
    setAiScanning(true);
    setAiScanStep(0);
    setAiResult(null);
    setTimeout(() => setAiScanStep(1), 600);
    setTimeout(() => setAiScanStep(2), 1300);
    setTimeout(() => setAiScanStep(3), 1900);
    setTimeout(() => {
      setAiScanning(false);
      setAiScanStep(0);
      setAiResult({
        nombre: "Ana Patricia Solís Medina",
        cargo: "Asesor de Ventas Senior",
        exp: "8 años en ventas inmobiliarias de lujo",
        educacion: "Lic. Administración — Universidad Anáhuac",
        habilidades: ["Ventas B2B", "Inglés C2", "CRM Salesforce", "Bienes raíces premium", "Negociación Harvard"],
        scoreIA: 93,
        cultureFit: 89,
        tecnico: 92,
        actitud: 96,
        fortalezas: ["Experiencia comprobada en ventas de lujo", "Dominio de inglés C2", "Red de contactos internacionales"],
        debilidades: ["Sin experiencia específica en mercado Tulum/Riviera Maya"],
        recomendacion: "PROCEDER — Candidata altamente compatible. Agendar entrevista técnica esta semana.",
        compatibilidad: "Alta",
        salarioSug: "$32,000–$42,000 MXN mensual",
      });
    }, 2200);
  };

  const tabs = [
    { id: "panel", label: "Panel", icon: BarChart3, hint: "Resumen ejecutivo" },
    { id: "pipeline", label: "Pipeline IA", icon: Workflow, hint: `${candidates.length} candidatos` },
    { id: "vacantes", label: "Vacantes", icon: Briefcase, hint: `${vacantes.filter(v=>v.status==="Activa").length} activas` },
    { id: "empleados", label: "Directorio", icon: Users, hint: `${empleados.length} empleados` },
    { id: "ia_scan", label: "Escáner IA", icon: null, hint: "Analiza CVs con IA" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Atom icon container */}
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${P.violet}14`, border: `1.5px solid ${P.violet}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 24px ${P.violet}18` }}>
            <AIAtom size={28} color={P.violet} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                Stratos <span style={{ fontWeight: 700, color: P.violet }}>People</span>
              </p>
              <span style={{ fontSize: 9, fontWeight: 700, color: P.violet, background: `${P.violet}15`, border: `1px solid ${P.violet}30`, padding: "2px 8px", borderRadius: 5, letterSpacing: "0.06em" }}>2026</span>
            </div>
            <p style={{ fontSize: 11, color: P.txt3, marginTop: 3 }}>
              Recursos Humanos · <span style={{ color: P.violet }}>Selección con IA</span> · Gestión de Talento
            </p>
          </div>
        </div>
        {/* Stats rápidas */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            { v: candidates.filter(c=>c.etapa!=="Rechazado").length, l: "En proceso", c: P.blue },
            { v: vacantes.filter(x=>x.status==="Activa").length, l: "Vacantes", c: P.violet },
            { v: `${tasaConversion}%`, l: "Conversión", c: P.emerald },
          ].map(s => (
            <div key={s.l} style={{ padding: "7px 14px", borderRadius: 9, background: `${s.c}08`, border: `1px solid ${s.c}20`, textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: s.c, fontFamily: fontDisp, lineHeight: 1 }}>{s.v}</p>
              <p style={{ fontSize: 9, color: P.txt3, marginTop: 3, fontWeight: 600 }}>{s.l}</p>
            </div>
          ))}
          <div style={{ width: 1, height: 32, background: P.border, margin: "0 4px" }} />
          <button onClick={() => setTab("ia_scan")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: `1.5px solid ${P.violet}45`, background: `${P.violet}0D`, cursor: "pointer", color: P.violet, fontSize: 12, fontWeight: 700, fontFamily: fontDisp, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = `${P.violet}18`; e.currentTarget.style.borderColor = `${P.violet}70`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${P.violet}0D`; e.currentTarget.style.borderColor = `${P.violet}45`; }}
          >
            <AIAtom size={15} color={P.violet} spin />
            Analizar CV con IA
          </button>
          <button
            onClick={() => {
              const url = window.location.origin + "/?apply";
              navigator.clipboard?.writeText(url).then(() => {}).catch(() => {});
              window.open(url, "_blank");
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: `1px solid rgba(110,231,194,0.3)`, background: "rgba(110,231,194,0.07)", cursor: "pointer", color: P.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp }}
          >
            <ExternalLink size={13} /> Portal Candidatos
          </button>
          <button onClick={() => setShowNewVacante(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.93)", cursor: "pointer", color: "#080D14", fontSize: 12, fontWeight: 700, fontFamily: fontDisp, boxShadow: "0 2px 14px rgba(255,255,255,0.10)" }}>
            <Plus size={13} /> Nueva Vacante
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 3, padding: "4px", borderRadius: 13, background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          const isAI = t.id === "ia_scan";
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
              background: active ? (isAI ? `${P.violet}14` : "rgba(255,255,255,0.07)") : "transparent",
              color: active ? "#FFF" : P.txt3, fontSize: 11, fontWeight: active ? 700 : 400,
              fontFamily: fontDisp, transition: "all 0.2s",
              outline: active && isAI ? `1px solid ${P.violet}35` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isAI
                  ? <AIAtom size={13} color={active ? P.violet : P.txt3} />
                  : <t.icon size={13} color={active ? (isAI ? P.violet : P.accent) : P.txt3} />
                }
                <span style={{ color: active ? (isAI ? P.violet : "#FFF") : P.txt3 }}>{t.label}</span>
              </div>
              <span style={{ fontSize: 9, color: active ? (isAI ? `${P.violet}90` : P.txt3) : P.txt3, fontWeight: 400 }}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ PANEL ═══ */}
      {tab === "panel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { l: "Vacantes Activas", v: vacantes.filter(v => v.status === "Activa").length, c: P.violet, i: Briefcase, sub: "abiertas" },
              { l: "Candidatos en Proceso", v: enProceso, c: P.blue, i: Users, sub: "evaluando" },
              { l: "Total Postulados", v: totalPostulados, c: P.accent, i: FileText, sub: "este mes" },
              { l: "Contratados Mes", v: candidates.filter(c => c.etapa === "Contratado").length, c: P.emerald, i: BadgeCheck, sub: "activos" },
              { l: "Tasa de Conversión", v: `${tasaConversion}%`, c: P.amber, i: Target, sub: "postulado→hire" },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600, marginTop: 4 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          {/* Pipeline visual */}
          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Pipeline de Selección — Resumen</p>
                <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Estado actual de todos los candidatos</p>
              </div>
              <button onClick={() => setTab("pipeline")} style={{ fontSize: 11, color: P.violet, background: "none", border: "none", cursor: "pointer" }}>Ver pipeline completo →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {etapas.map(e => {
                const count = candidates.filter(c => c.etapa === e).length;
                const pct = (count / candidates.length) * 100;
                return (
                  <div key={e} style={{ textAlign: "center" }}>
                    <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 8 }}>
                      <div style={{ width: 32, borderRadius: 4, background: `${etapaColor[e]}30`, border: `1px solid ${etapaColor[e]}40`, height: `${Math.max(pct * 0.6, 8)}px`, position: "relative" }}>
                        <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 700, color: etapaColor[e], fontFamily: fontDisp }}>{count}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 9, color: etapaColor[e], fontWeight: 700, letterSpacing: "0.04em" }}>{e.toUpperCase()}</p>
                  </div>
                );
              })}
            </div>
          </G>

          {/* Top candidatos + vacantes urgentes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <G np>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Top Candidatos IA</p>
                <Pill color={P.violet} s>Ordenados por Score</Pill>
              </div>
              {candidates.filter(c => c.etapa !== "Rechazado").sort((a, b) => b.score - a.score).slice(0, 5).map(c => (
                <div key={c.id} onClick={() => { setSelectedCandidate(c); setTab("pipeline"); }}
                  style={{ padding: "12px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${c.color}20`, border: `2px solid ${c.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.avatar}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</p>
                    <p style={{ fontSize: 10, color: P.txt3 }}>{c.cargo}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: scoreColor(c.score), fontFamily: fontDisp }}>{c.score}</p>
                    <p style={{ fontSize: 9, color: scoreColor(c.score) }}>{scoreLabel(c.score)}</p>
                  </div>
                </div>
              ))}
            </G>
            <G np>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Vacantes Prioritarias</p>
                <button onClick={() => setTab("vacantes")} style={{ fontSize: 11, color: P.accent, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
              </div>
              {vacantes.map(v => (
                <div key={v.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp, flex: 1, paddingRight: 8 }}>{v.titulo}</p>
                    <span style={{ fontSize: 9, fontWeight: 700, color: prioColor[v.prioridad], background: `${prioColor[v.prioridad]}15`, padding: "3px 8px", borderRadius: 5, flexShrink: 0 }}>{v.prioridad}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: P.txt3 }}>{v.postulados} postulados</span>
                    <span style={{ fontSize: 10, color: P.txt3 }}>·</span>
                    <span style={{ fontSize: 10, color: P.txt3 }}>{v.entrevistas} en entrevista</span>
                    <span style={{ fontSize: 10, color: v.status === "Activa" ? P.emerald : P.amber }}>{v.status}</span>
                  </div>
                </div>
              ))}
            </G>
          </div>
        </div>
      )}

      {/* ═══ PIPELINE IA ═══ */}
      {tab === "pipeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search + filters row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, flex: "0 0 220px" }}>
              <Search size={13} color={P.txt3} />
              <input value={pipelineSearch} onChange={e => setPipelineSearch(e.target.value)}
                placeholder="Buscar candidato..." style={{ background: "none", border: "none", outline: "none", color: P.txt, fontSize: 12, fontFamily: font, width: "100%" }} />
              {pipelineSearch && <button onClick={() => setPipelineSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: P.txt3, padding: 0, display: "flex" }}><X size={11} /></button>}
            </div>
            <span style={{ fontSize: 10, color: P.txt3, fontWeight: 600 }}>ETAPA:</span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["todos", ...etapas].map(e => {
                const count = e === "todos" ? candidates.length : candidates.filter(c => c.etapa === e).length;
                const isActive = pipelineFilter === e;
                const col = etapaColor[e] || P.accent;
                return (
                  <button key={e} onClick={() => setPipelineFilter(e)} style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${isActive ? col + "55" : P.border}`,
                    background: isActive ? `${col}14` : P.glass,
                    color: isActive ? col : P.txt3,
                    cursor: "pointer", transition: "all 0.18s", fontFamily: fontDisp,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {e === "todos" ? "Todos" : e}
                    <span style={{ fontSize: 9, background: isActive ? `${col}25` : "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>{count}</span>
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 10, color: P.txt3, marginLeft: "auto" }}>
              {filteredCandidates.filter(c => !pipelineSearch || c.nombre.toLowerCase().includes(pipelineSearch.toLowerCase())).length} resultado(s)
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredCandidates.filter(c => !pipelineSearch || c.nombre.toLowerCase().includes(pipelineSearch.toLowerCase()) || c.cargo.toLowerCase().includes(pipelineSearch.toLowerCase())).map(c => (
              <G key={c.id} hover onClick={() => setSelectedCandidate(selectedCandidate?.id === c.id ? null : c)} style={{ cursor: "pointer", padding: 0 }}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${c.color}18`, border: `2px solid ${c.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.avatar}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, color: P.txt, fontWeight: 700, fontFamily: fontDisp }}>{c.nombre}</p>
                        {c.tags.map(t => (
                          <span key={t} style={{ fontSize: 9, color: t === "Top Pick" ? P.accent : P.txt3, background: t === "Top Pick" ? `${P.accent}15` : "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{t}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: P.txt2 }}>{c.cargo} · {c.exp} · {c.educacion}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {c.habilidades.slice(0, 4).map(h => (
                          <span key={h} style={{ fontSize: 9, color: P.txt3, background: "rgba(255,255,255,0.04)", border: `1px solid ${P.border}`, padding: "2px 8px", borderRadius: 4 }}>{h}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", border: `3px solid ${scoreColor(c.score)}40`, background: `${scoreColor(c.score)}08`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: scoreColor(c.score), fontFamily: fontDisp }}>{c.score}</p>
                        </div>
                        <p style={{ fontSize: 9, color: scoreColor(c.score), marginTop: 4, fontWeight: 700 }}>Score IA</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>${c.salario.toLocaleString("es-MX")}</p>
                        <p style={{ fontSize: 9, color: P.txt3 }}>Expectativa / mes</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: etapaColor[c.etapa], background: `${etapaColor[c.etapa]}15`, padding: "5px 12px", borderRadius: 8, textAlign: "center", minWidth: 88, border: `1px solid ${etapaColor[c.etapa]}25` }}>{c.etapa}</span>
                      <span style={{ fontSize: 9, color: P.txt3, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 5 }}>{c.fuente}</span>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedCandidate?.id === c.id
                          ? <ChevronUp size={11} color={P.txt3} />
                          : <ChevronDown size={11} color={P.txt3} />}
                      </div>
                    </div>
                  </div>

                  {selectedCandidate?.id === c.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${P.border}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 16 }}>
                        {[
                          { l: "Culture Fit", v: c.cultureFit, c: P.violet },
                          { l: "Técnico", v: c.tecnico, c: P.blue },
                          { l: "Actitud", v: c.actitud, c: P.emerald },
                        ].map(s => (
                          <div key={s.l} style={{ padding: "12px 14px", borderRadius: 10, background: `${s.c}08`, border: `1px solid ${s.c}18` }}>
                            <p style={{ fontSize: 10, color: P.txt2, marginBottom: 8, fontWeight: 600 }}>{s.l}</p>
                            <p style={{ fontSize: 22, fontWeight: 300, color: s.c, fontFamily: fontDisp }}>{s.v}<span style={{ fontSize: 12 }}>/100</span></p>
                            <div style={{ height: 3, borderRadius: 2, background: P.border, marginTop: 8, overflow: "hidden" }}>
                              <div style={{ width: `${s.v}%`, height: "100%", background: s.c, borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: "12px 14px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}` }}>
                          <p style={{ fontSize: 10, color: P.txt2, marginBottom: 8, fontWeight: 600 }}>Nota del Reclutador</p>
                          <p style={{ fontSize: 11, color: P.txt, lineHeight: 1.6 }}>{c.nota}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        {["Agendar Entrevista", "Avanzar Etapa", "Enviar Oferta", "Descartar"].map((a, i) => (
                          <button key={a} style={{
                            padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            border: i === 2 ? "none" : `1px solid ${P.border}`,
                            background: i === 2 ? P.emerald : i === 3 ? `${P.rose}10` : P.glass,
                            color: i === 2 ? "#000" : i === 3 ? P.rose : P.txt2, fontFamily: fontDisp,
                          }}>{a}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </G>
            ))}
          </div>
        </div>
      )}

      {/* ═══ VACANTES ═══ */}
      {tab === "vacantes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { l: "Vacantes Activas", v: vacantes.filter(v => v.status === "Activa").length, c: P.violet, i: Briefcase },
              { l: "Total Postulados", v: totalPostulados, c: P.blue, i: Users },
              { l: "Tiempo Promedio de Llenado", v: "18 días", c: P.accent, i: Clock },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                <Ico icon={k.i} sz={36} is={16} c={k.c} />
                <div>
                  <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                  <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>{k.v}</p>
                </div>
              </G>
            ))}
          </div>
          {vacantes.map(v => (
            <G key={v.id} hover style={{ padding: 0 }}>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{v.titulo}</p>
                      <span style={{ fontSize: 9, fontWeight: 700, color: prioColor[v.prioridad], background: `${prioColor[v.prioridad]}15`, padding: "3px 8px", borderRadius: 5 }}>{v.prioridad}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: v.status === "Activa" ? P.emerald : P.amber, background: v.status === "Activa" ? `${P.emerald}15` : `${P.amber}15`, padding: "3px 8px", borderRadius: 5 }}>{v.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ fontSize: 11, color: P.txt3 }}>{v.dept}</span>
                      <span style={{ fontSize: 11, color: P.txt3 }}>· {v.ubicacion}</span>
                      <span style={{ fontSize: 11, color: P.txt3 }}>· {v.tipo}</span>
                      <span style={{ fontSize: 11, color: P.txt3 }}>· Cierra: {v.cierre}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>${v.salarioMin.toLocaleString("es-MX")} – ${v.salarioMax.toLocaleString("es-MX")}</p>
                    <p style={{ fontSize: 10, color: P.txt3 }}>MXN / mes</p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: P.txt2, lineHeight: 1.6, marginBottom: 12 }}>{v.desc}</p>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 18, fontWeight: 300, color: P.violet, fontFamily: fontDisp }}>{v.postulados}</p><p style={{ fontSize: 9, color: P.txt3, textTransform: "uppercase" }}>Postulados</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 18, fontWeight: 300, color: P.blue, fontFamily: fontDisp }}>{v.entrevistas}</p><p style={{ fontSize: 9, color: P.txt3, textTransform: "uppercase" }}>Entrevistas</p></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    {["Ver candidatos", "Editar", "Pausar"].map((a, i) => (
                      <button key={a} style={{ padding: "7px 14px", borderRadius: 7, border: i === 0 ? `1px solid ${P.violet}40` : `1px solid ${P.border}`, background: i === 0 ? `${P.violet}10` : P.glass, color: i === 0 ? P.violet : P.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fontDisp }}>{a}</button>
                    ))}
                  </div>
                </div>
              </div>
            </G>
          ))}
        </div>
      )}

      {/* ═══ DIRECTORIO ═══ */}
      {tab === "empleados" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Total Empleados", v: empleados.length, c: P.violet, i: Users },
              { l: "En Onboarding", v: empleados.filter(e => e.estado === "Onboarding").length, c: P.amber, i: ClipboardList },
              { l: "Score Promedio", v: Math.round(empleados.reduce((s, e) => s + e.score, 0) / empleados.length), c: P.emerald, i: Target },
              { l: "Nómina Total Mensual", v: `$${empleados.reduce((s, e) => s + e.salario, 0).toLocaleString("es-MX")}`, c: P.accent, i: Banknote },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                <Ico icon={k.i} sz={36} is={16} c={k.c} />
                <div>
                  <p style={{ fontSize: 10, color: P.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                  <p style={{ fontSize: 20, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>{k.v}</p>
                </div>
              </G>
            ))}
          </div>
          <G np>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 9, color: P.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Empleado</span><span>Cargo / Departamento</span><span>Desde</span><span>Salario</span><span>Score</span><span>Estado</span>
            </div>
            {empleados.map(e => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${P.border}`, transition: "background 0.15s" }}
                onMouseEnter={el => el.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={el => el.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${e.color}18`, border: `2px solid ${e.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: e.color }}>{e.avatar}</span>
                  </div>
                  <p style={{ fontSize: 12, color: P.txt, fontWeight: 600, fontFamily: fontDisp }}>{e.nombre}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: P.txt, fontWeight: 600 }}>{e.cargo}</p>
                  <p style={{ fontSize: 10, color: P.txt3 }}>{e.dept}</p>
                </div>
                <span style={{ fontSize: 11, color: P.txt2 }}>{e.desde}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>${e.salario.toLocaleString("es-MX")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.border, overflow: "hidden" }}>
                    <div style={{ width: `${e.score}%`, height: "100%", background: scoreColor(e.score), borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: scoreColor(e.score), fontWeight: 700, width: 24 }}>{e.score}</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: e.estado === "Activo" ? P.emerald : P.amber, background: e.estado === "Activo" ? `${P.emerald}15` : `${P.amber}15`, padding: "3px 10px", borderRadius: 5, textAlign: "center" }}>{e.estado}</span>
              </div>
            ))}
          </G>
        </div>
      )}

      {/* ═══ ESCÁNER IA ═══ */}
      {tab === "ia_scan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <G style={{ padding: 0 }}>
            {/* Header del escáner */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${P.violet}14`, border: `1.5px solid ${P.violet}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AIAtom size={24} color={P.violet} spin={aiScanning} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>Escáner IA de Candidatos</p>
                  <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Sube un CV (PDF o imagen) — la IA extrae datos, evalúa y genera un score en segundos</p>
                </div>
              </div>
              {aiResult && (
                <button onClick={() => { setAiResult(null); setAiScanning(false); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 11, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={12} /> Nuevo escáner
                </button>
              )}
            </div>
            <div style={{ padding: 24 }}>
              {/* Upload zone */}
              {!aiResult && (
                <div
                  style={{
                    border: `2px dashed ${aiScanning ? P.violet : P.border}`,
                    borderRadius: 18, padding: aiScanning ? "32px" : "44px 32px", textAlign: "center",
                    cursor: aiScanning ? "default" : "pointer",
                    background: aiScanning ? `${P.violet}06` : "rgba(255,255,255,0.01)",
                    transition: "all 0.35s", position: "relative", overflow: "hidden",
                  }}
                  onClick={!aiScanning ? simulateAIScan : undefined}
                  onMouseEnter={e => { if (!aiScanning) { e.currentTarget.style.borderColor = `${P.violet}55`; e.currentTarget.style.background = `${P.violet}04`; }}}
                  onMouseLeave={e => { if (!aiScanning) { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}}
                >
                  {aiScanning ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
                      {/* Atom spinner */}
                      <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${P.violet}20`, borderTop: `2px solid ${P.violet}`, animation: "spin 1.2s linear infinite" }} />
                        <AIAtom size={32} color={P.violet} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, color: P.violet, fontWeight: 700, fontFamily: fontDisp, marginBottom: 16 }}>Procesando con IA...</p>
                        {/* Step indicators */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 340, margin: "0 auto" }}>
                          {[
                            { step: 1, label: "Extrayendo texto y datos del documento" },
                            { step: 2, label: "Identificando experiencia, habilidades y educación" },
                            { step: 3, label: "Calculando score IA y compatibilidad del perfil" },
                          ].map(s => {
                            const done = aiScanStep > s.step;
                            const active = aiScanStep === s.step;
                            return (
                              <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 9, background: done ? `${P.emerald}08` : active ? `${P.violet}10` : "rgba(255,255,255,0.02)", border: `1px solid ${done ? P.emerald + "25" : active ? P.violet + "35" : P.border}`, transition: "all 0.4s", animation: active ? "stepFade 0.3s ease" : "none" }}>
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? `${P.emerald}20` : active ? `${P.violet}20` : P.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {done ? <CheckCircle2 size={12} color={P.emerald} /> : <span style={{ fontSize: 9, fontWeight: 700, color: active ? P.violet : P.txt3 }}>{s.step}</span>}
                                </div>
                                <span style={{ fontSize: 11, color: done ? P.txt : active ? P.violet : P.txt3, fontWeight: active ? 600 : 400 }}>{s.label}</span>
                                {active && <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: P.violet, animation: `blink 1.4s ${i * 0.2}s infinite` }} />)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 64, height: 64, borderRadius: 18, background: `${P.violet}10`, border: `1px solid ${P.violet}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        <AIAtom size={32} color={P.violet} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: P.txt, fontFamily: fontDisp, marginBottom: 8 }}>Arrastra el CV aquí o haz clic para subir</p>
                      <p style={{ fontSize: 12, color: P.txt3, marginBottom: 20, lineHeight: 1.6 }}>
                        La IA extrae nombre, experiencia, habilidades y educación automáticamente.<br />
                        Genera score de compatibilidad y recomendación de contratación.
                      </p>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                        {[
                          { l: "PDF", c: P.rose },
                          { l: "JPG / PNG", c: P.blue },
                          { l: "Texto libre", c: P.accent },
                          { l: "LinkedIn URL", c: P.violet },
                        ].map(f => (
                          <span key={f.l} style={{ fontSize: 10, color: f.c, background: `${f.c}10`, border: `1px solid ${f.c}25`, padding: "5px 14px", borderRadius: 7, fontWeight: 600 }}>{f.l}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 10, color: P.txt3 }}>Haz clic para simular un análisis de CV con IA</p>
                    </>
                  )}
                </div>
              )}


              {!aiScanning && aiResult && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 16px", borderRadius: 10, background: `${P.emerald}08`, border: `1px solid ${P.emerald}25` }}>
                    <BadgeCheck size={18} color={P.emerald} />
                    <p style={{ fontSize: 13, color: P.emerald, fontWeight: 700 }}>Análisis completado — {aiResult.compatibilidad} compatibilidad detectada</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ padding: "16px 18px", borderRadius: 12, background: P.glass, border: `1px solid ${P.border}` }}>
                        <p style={{ fontSize: 11, color: P.txt3, marginBottom: 6, fontWeight: 600 }}>CANDIDATO IDENTIFICADO</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{aiResult.nombre}</p>
                        <p style={{ fontSize: 11, color: P.txt2, marginTop: 2 }}>{aiResult.cargo}</p>
                        <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>{aiResult.exp}</p>
                        <p style={{ fontSize: 11, color: P.txt3 }}>{aiResult.educacion}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                          {aiResult.habilidades.map(h => (
                            <span key={h} style={{ fontSize: 9, color: P.accent, background: `${P.accent}10`, border: `1px solid ${P.accent}20`, padding: "2px 8px", borderRadius: 4 }}>{h}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "14px 18px", borderRadius: 12, background: P.glass, border: `1px solid ${P.border}` }}>
                        <p style={{ fontSize: 11, color: P.txt3, marginBottom: 8, fontWeight: 600 }}>SALARIO SUGERIDO POR IA</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: P.emerald, fontFamily: fontDisp }}>{aiResult.salarioSug}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { l: "Score IA General", v: aiResult.scoreIA, c: P.violet },
                        { l: "Culture Fit", v: aiResult.cultureFit, c: P.blue },
                        { l: "Técnico", v: aiResult.tecnico, c: P.accent },
                        { l: "Actitud / Soft Skills", v: aiResult.actitud, c: P.emerald },
                      ].map(s => (
                        <div key={s.l} style={{ padding: "10px 14px", borderRadius: 10, background: `${s.c}08`, border: `1px solid ${s.c}18`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={{ fontSize: 11, color: P.txt2, fontWeight: 600 }}>{s.l}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 80, height: 4, borderRadius: 2, background: P.border, overflow: "hidden" }}>
                              <div style={{ width: `${s.v}%`, height: "100%", background: s.c, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: s.c, fontFamily: fontDisp, width: 30, textAlign: "right" }}>{s.v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: `${P.emerald}06`, border: `1px solid ${P.emerald}20` }}>
                      <p style={{ fontSize: 10, color: P.emerald, fontWeight: 700, textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Fortalezas detectadas</p>
                      {aiResult.fortalezas.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <CheckCircle2 size={13} color={P.emerald} />
                          <span style={{ fontSize: 11, color: P.txt, lineHeight: 1.5 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: `${P.amber}06`, border: `1px solid ${P.amber}20` }}>
                      <p style={{ fontSize: 10, color: P.amber, fontWeight: 700, textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Áreas de atención</p>
                      {aiResult.debilidades.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <AlertCircle size={13} color={P.amber} />
                          <span style={{ fontSize: 11, color: P.txt, lineHeight: 1.5 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "14px 18px", borderRadius: 12, background: `${P.violet}06`, border: `1px solid ${P.violet}25`, marginBottom: 16 }}>
                    <p style={{ fontSize: 10, color: P.violet, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Recomendación IA</p>
                    <p style={{ fontSize: 13, color: P.txt, fontWeight: 600, lineHeight: 1.6 }}>{aiResult.recomendacion}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ flex: 2, padding: "12px 20px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.95)", color: "#0A0F18", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
                      <Plus size={14} style={{ marginRight: 8, verticalAlign: "middle" }} /> Agregar al Pipeline
                    </button>
                    <button onClick={simulateAIScan} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 12, cursor: "pointer", fontFamily: font }}>Nuevo análisis</button>
                    <button onClick={() => setAiResult(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 12, cursor: "pointer", fontFamily: font }}>Limpiar</button>
                  </div>
                </div>
              )}
            </div>
          </G>

          {!aiResult && !aiScanning && (
            <G>
              <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: fontDisp, marginBottom: 14 }}>¿Cómo funciona el Escáner IA?</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { n: "01", t: "Sube el CV", d: "PDF, imagen o texto del candidato", c: P.violet },
                  { n: "02", t: "Extracción IA", d: "Detecta nombre, experiencia, habilidades y educación automáticamente", c: P.blue },
                  { n: "03", t: "Evaluación 360°", d: "Score técnico, cultural y de actitud basado en el perfil del puesto", c: P.accent },
                  { n: "04", t: "Recomendación", d: "PROCEDER / REVISAR / DESCARTAR con justificación detallada", c: P.emerald },
                ].map(s => (
                  <div key={s.n} style={{ padding: 16, borderRadius: 12, background: `${s.c}06`, border: `1px solid ${s.c}18` }}>
                    <p style={{ fontSize: 20, fontWeight: 300, color: s.c, fontFamily: fontDisp, marginBottom: 8 }}>{s.n}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: P.txt, marginBottom: 4 }}>{s.t}</p>
                    <p style={{ fontSize: 11, color: P.txt3, lineHeight: 1.5 }}>{s.d}</p>
                  </div>
                ))}
              </div>
            </G>
          )}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   ADMIN PANEL — Gestión de Usuarios
   ════════════════════════════════════════ */
const ROLE_META = {
  super_admin: { label: "Super Admin", color: "#A78BFA", level: 1 },
  admin:       { label: "Admin",       color: "#F59E0B", level: 2 },
  ceo:         { label: "CEO",         color: "#7EB8F0", level: 3 },
  director:    { label: "Director",    color: "#5DC8D9", level: 4 },
  asesor:      { label: "Asesor",      color: "#6EE7C2", level: 5 },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || { label: role, color: P.txt3 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 99, fontSize: 10.5, fontWeight: 700,
      color: m.color, background: `${m.color}12`, border: `1px solid ${m.color}28`,
      letterSpacing: "0.03em",
    }}>{m.label}</span>
  );
}

function AdminPanel() {
  console.log("AdminPanel Rendering...");
  const { user: me } = useAuth();
  const { users, refresh, loading: loadingUsers } = useTeam();
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [modal, setModal]           = useState(null); // null | { mode: "create"|"edit"|"reset", user? }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // userId
  const [form, setForm]             = useState({});
  const [formErr, setFormErr]       = useState("");
  const [formOk, setFormOk]         = useState("");
  const [seeding, setSeeding]       = useState(false);

  // Funciones de Seed
  const handleSeedProjects = async () => {
    try {
      setSeeding(true);
      const { error } = await supabase.from('projects').upsert(
        MOCK_PROPS.map(p => ({
          name: p.n,
          units: p.u,
          sold: p.s,
          roi: p.roi,
          price_range: p.pr,
          location: p.loc,
          status: p.st,
          color: p.c
        }))
      );
      if (error) throw error;
      setFormOk("Proyectos sincronizados con Supabase.");
    } catch (e) {
      setFormErr("Error al sembrar proyectos: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedLeads = async () => {
    try {
      setSeeding(true);
      const { error } = await supabase.from('LEADS').upsert(
        MOCK_LEADS.map(l => ({
          "NOMBRE DEL CLIENTE": l.n,
          "ASESOR": l.asesor,
          "FECHA INGRESO": l.fechaIngreso,
          "TELEFONO": l.phone,
          "ESTATUS": l.st,
          "PRESUPUESTO": l.presupuesto,
          "PROYECTO DE INTERES": l.p,
          "CAMPAÑA": l.campana,
          "NOTAS": [{ nota: l.bio, fecha: new Date().toISOString() }]
        }))
      );
      if (error) throw error;
      setFormOk("Leads sincronizados con Supabase.");
    } catch (e) {
      setFormErr("Error al sembrar leads: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedTeam = async () => {
    try {
      setSeeding(true);
      const { error } = await supabase.from('profiles').upsert(
        MOCK_TEAM.map(t => ({
          name: t.n,
          role_display: t.r,
          deals: t.d,
          revenue: t.rv,
          efficiency: t.e,
          skills_count: t.sk,
          role: t.role,
          color: t.c,
          whatsapp: t.wa,
          calendly: t.cal
        }))
      );
      if (error) throw error;
      setFormOk("Equipo sincronizado con Supabase.");
    } catch (e) {
      setFormErr("Error al sembrar equipo: " + e.message);
    } finally {
      setSeeding(false);
    }
  };



  const isSuper = me?.role === "super_admin";
  const canManage = ["super_admin", "admin"].includes(me?.role);

  const sf = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === "string" ? v : v.target.value }));

  const openCreate = () => {
    setForm({ name: "", email: "", password: "", role: "asesor", isActive: true });
    setFormErr(""); setFormOk("");
    setModal({ mode: "create" });
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive !== false });
    setFormErr(""); setFormOk("");
    setModal({ mode: "edit", user: u });
  };

  const openReset = (u) => {
    setForm({ password: "" });
    setFormErr(""); setFormOk("");
    setModal({ mode: "reset", user: u });
  };

  const handleCreate = () => {
    if (!form.name?.trim()) { setFormErr("El nombre es requerido."); return; }
    if (!form.email?.trim() || !form.email.includes("@")) { setFormErr("Email inválido."); return; }
    if (!form.password || form.password.length < 6) { setFormErr("La contraseña debe tener al menos 6 caracteres."); return; }
    const { data, error } = adminCreateUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role });
    if (error) { setFormErr(error); return; }
    refresh(); setFormOk(`Usuario ${data.name} creado exitosamente.`);
    setTimeout(() => setModal(null), 1400);
  };

  const handleEdit = () => {
    if (!form.name?.trim()) { setFormErr("El nombre es requerido."); return; }
    const { data, error } = adminUpdateUser(modal.user.id, { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, isActive: form.isActive });
    if (error) { setFormErr(error); return; }
    refresh(); setFormOk("Cambios guardados."); setTimeout(() => setModal(null), 1000);
  };

  const handleReset = () => {
    if (!form.password || form.password.length < 6) { setFormErr("Mínimo 6 caracteres."); return; }
    const { error } = adminResetPassword(modal.user.id, form.password);
    if (error) { setFormErr(error); return; }
    setFormOk("Contraseña actualizada."); setTimeout(() => setModal(null), 1000);
  };

  const handleDelete = (id) => {
    const { error } = adminDeleteUser(id, me?.id);
    if (error) return;
    setDeleteConfirm(null); refresh();
  };

  const handleToggleActive = (u) => {
    adminUpdateUser(u.id, { isActive: !u.isActive }); refresh();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchR = roleFilter === "ALL" || u.role === roleFilter;
    return matchQ && matchR;
  });

  const stats = Object.entries(ROLE_META).map(([key, m]) => ({
    ...m, key, count: users.filter(u => u.role === key).length,
  })).filter(s => s.count > 0);

  const availableRoles = Object.entries(ROLE_META)
    .filter(([key]) => isSuper || ROLE_META[key].level > (ROLE_META[me?.role]?.level ?? 99))
    .map(([key, m]) => ({ key, ...m }));

  const inputStyle = {
    width: "100%", height: 40, padding: "0 14px", borderRadius: 11,
    background: P.glass, border: `1px solid ${P.border}`, color: P.txt,
    fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ padding: "28px 28px 0", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>Gestión de Usuarios</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{users.length} usuarios</span>
          </div>
          <p style={{ fontSize: 11.5, color: P.txt3, margin: 0 }}>
            {users.filter(u => u.isActive !== false).length} activos · {users.filter(u => u.isActive === false).length} inactivos
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
            borderRadius: 11, background: "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
            border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12.5, fontWeight: 700,
            fontFamily: fontDisp, cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))"; }}
          ><Plus size={14} /> Nuevo Usuario</button>
        )}
      </div>

      {/* Database Seeding — Solo Super Admins */}
      {isSuper && (
        <div style={{ marginBottom: 4 }}>
          <G style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (formOk || formErr) ? 14 : 0 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>Base de Datos: Supabase</p>
                <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>Sincroniza los datos iniciales del demo con tu base de datos real.</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleSeedProjects} disabled={seeding} style={{ padding: "8px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e=>e.currentTarget.style.borderColor=P.blue} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>Sembrar Proyectos</button>
                <button onClick={handleSeedLeads} disabled={seeding} style={{ padding: "8px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e=>e.currentTarget.style.borderColor=P.emerald} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>Sembrar Leads</button>
                <button onClick={handleSeedTeam} disabled={seeding} style={{ padding: "8px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e=>e.currentTarget.style.borderColor=P.violet} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>Sembrar Equipo</button>
              </div>
            </div>
            {(formOk || formErr) && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: formOk ? `${P.emerald}10` : `${P.rose}10`, border: `1px solid ${formOk ? `${P.emerald}30` : `${P.rose}30`}`, display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                {formOk ? <CheckCircle2 size={14} color={P.emerald} /> : <AlertCircle size={14} color={P.rose} />}
                <span style={{ fontSize: 11, color: formOk ? P.emerald : P.rose, fontWeight: 600 }}>{formOk || formErr}</span>
              </div>
            )}
          </G>
        </div>
      )}

      {/* ── Role stats strip ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stats.map(s => (
          <div key={s.key} onClick={() => setRoleFilter(roleFilter === s.key ? "ALL" : s.key)}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
              borderRadius: 12, background: roleFilter === s.key ? `${s.color}10` : P.glass,
              border: `1px solid ${roleFilter === s.key ? `${s.color}35` : P.border}`,
              cursor: "pointer", transition: "all 0.18s",
            }}
            onMouseEnter={e => { if (roleFilter !== s.key) e.currentTarget.style.borderColor = P.borderH; }}
            onMouseLeave={e => { if (roleFilter !== s.key) e.currentTarget.style.borderColor = P.border; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: roleFilter === s.key ? s.color : P.txt2 }}>{s.label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: roleFilter === s.key ? s.color : "#FFFFFF", fontFamily: fontDisp }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <G np>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 300 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.txt3, pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre o email…"
              style={{ ...inputStyle, paddingLeft: 30, height: 34, fontSize: 12 }}
              onFocus={e => e.target.style.borderColor = P.accentB}
              onBlur={e => e.target.style.borderColor = P.border}
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: P.glass, border: `1px solid ${P.border}`, fontSize: 11, color: P.txt3, cursor: "pointer", outline: "none", fontFamily: font }}>
            <option value="ALL">Todos los roles</option>
            {Object.entries(ROLE_META).map(([k, m]) => <option key={k} value={k} style={{ background: "#0C1219" }}>{m.label}</option>)}
          </select>
          {(search || roleFilter !== "ALL") && (
            <button onClick={() => { setSearch(""); setRoleFilter("ALL"); }} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: `${P.rose}0C`, border: `1px solid ${P.rose}28`, color: P.rose, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
              <X size={11} /> Limpiar
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: P.txt3 }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Table header ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 2fr 1fr 1fr 100px", gap: 0, padding: "9px 20px", borderBottom: `1px solid ${P.border}` }}>
          {["Usuario", "Email", "Rol", "Estado", "Acciones"].map((h, i) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i === 4 ? "center" : "left" }}>{h}</span>
          ))}
        </div>

        {/* ── User rows ── */}
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 380px)" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: P.txt3 }}>No se encontraron usuarios.</p>
            </div>
          )}
          {filtered.map((u, idx) => {
            const m = ROLE_META[u.role] || { label: u.role, color: P.txt3 };
            const active = u.isActive !== false;
            const isMe = u.id === me?.id;
            const canEdit = canManage && (isSuper || (ROLE_META[u.role]?.level ?? 99) > (ROLE_META[me?.role]?.level ?? 0));
            const initials = (u.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            const avatarColors = ["#A78BFA", "#7EB8F0", "#6EE7C2", "#F59E0B", "#5DC8D9", "#E8818C"];
            const ac = avatarColors[u.id % avatarColors.length];
            return (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "2.2fr 2fr 1fr 1fr 100px",
                padding: "13px 20px", borderBottom: idx < filtered.length - 1 ? `1px solid ${P.border}` : "none",
                background: "transparent", transition: "background 0.15s", alignItems: "center",
              }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Name + avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ac}18`, border: `1.5px solid ${ac}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: ac, fontFamily: fontDisp, flexShrink: 0 }}>{initials}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: active ? "#FFFFFF" : P.txt3, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>
                      {u.name}
                      {isMe && <span style={{ fontSize: 9, color: P.accent, fontWeight: 700, marginLeft: 7, background: `${P.accent}12`, border: `1px solid ${P.accentB}`, padding: "1px 7px", borderRadius: 99 }}>Tú</span>}
                    </p>
                    <p style={{ fontSize: 10.5, color: P.txt3, marginTop: 1 }}>ID #{u.id}</p>
                  </div>
                </div>

                {/* Email */}
                <span style={{ fontSize: 12, color: active ? P.txt2 : P.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{u.email}</span>

                {/* Role */}
                <RoleBadge role={u.role} />

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? P.emerald : P.txt3, boxShadow: active ? `0 0 6px ${P.emerald}80` : "none" }} />
                  <span style={{ fontSize: 11, color: active ? P.txt2 : P.txt3, fontWeight: active ? 600 : 400 }}>{active ? "Activo" : "Inactivo"}</span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                  {canEdit ? (
                    <>
                      <button onClick={() => openEdit(u)} title="Editar usuario" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(126,184,240,0.1)"; e.currentTarget.style.borderColor = "rgba(126,184,240,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                      ><User size={12} color={P.blue} /></button>
                      <button onClick={() => handleToggleActive(u)} title={active ? "Desactivar" : "Activar"} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = active ? "rgba(232,129,140,0.1)" : "rgba(110,231,194,0.1)"; e.currentTarget.style.borderColor = active ? "rgba(232,129,140,0.35)" : "rgba(110,231,194,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                      >{active ? <X size={12} color={P.rose} /> : <CheckCircle2 size={12} color={P.emerald} />}</button>
                      {!isMe && (
                        <button onClick={() => setDeleteConfirm(u.id)} title="Eliminar usuario" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.1)"; e.currentTarget.style.borderColor = "rgba(232,129,140,0.35)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                        ><Trash2 size={12} color={P.rose} /></button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: P.txt3, fontStyle: "italic" }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </G>

      {/* ── Delete confirmation ── */}
      {deleteConfirm !== null && createPortal(
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.78)", backdropFilter: "blur(8px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(400px, 92vw)", background: "#07080F", border: `1px solid ${P.rose}30`, borderRadius: 20, boxShadow: "0 32px 64px rgba(0,0,0,0.7)", padding: "26px 28px", animation: "fadeIn 0.2s ease" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${P.rose}12`, border: `1px solid ${P.rose}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={20} color={P.rose} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 8 }}>¿Eliminar usuario?</p>
            <p style={{ fontSize: 12.5, color: P.txt3, lineHeight: 1.6, marginBottom: 22 }}>
              Esta acción es permanente. El usuario perderá acceso inmediatamente y no podrá recuperarse.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 40, borderRadius: 10, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, height: 40, borderRadius: 10, background: `${P.rose}14`, border: `1px solid ${P.rose}35`, color: P.rose, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>Eliminar</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Create / Edit / Reset modal ── */}
      {modal !== null && createPortal(
        <>
          <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.78)", backdropFilter: "blur(8px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(500px, 94vw)", background: "#07080F", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)", animation: "fadeIn 0.22s ease" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${P.accent}, ${P.accent}40)`, borderRadius: "22px 22px 0 0" }} />
            <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 3 }}>
                  {modal.mode === "create" ? "Crear Nuevo Usuario" : modal.mode === "reset" ? "Restablecer Contraseña" : `Editar: ${modal.user?.name}`}
                </p>
                <p style={{ fontSize: 11, color: P.txt3 }}>
                  {modal.mode === "create" ? "El usuario podrá iniciar sesión inmediatamente." : modal.mode === "reset" ? "Define una nueva contraseña temporal." : "Modifica los datos y el rol del usuario."}
                </p>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={14} color={P.txt3} /></button>
            </div>

            <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 15 }}>
              {modal.mode !== "reset" && (
                <>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Nombre completo <span style={{ color: P.accent }}>*</span></p>
                    <input value={form.name || ""} onChange={e => sf("name")(e.target.value)} placeholder="Ej. María González" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Email <span style={{ color: P.accent }}>*</span></p>
                    <input value={form.email || ""} onChange={e => sf("email")(e.target.value)} placeholder="maria@stratos.ai" type="email" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Rol</p>
                    <select value={form.role || "asesor"} onChange={e => sf("role")(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    >
                      {availableRoles.map(r => (
                        <option key={r.key} value={r.key} style={{ background: "#0C1219" }}>{r.label} — Nivel {r.level}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 10, color: P.txt3, marginTop: 5 }}>
                      {ROLE_META[form.role]?.level === 1 && "Acceso total al sistema. Puede crear y eliminar cualquier usuario."}
                      {ROLE_META[form.role]?.level === 2 && "Acceso administrativo. Gestiona directores y asesores."}
                      {ROLE_META[form.role]?.level === 3 && "Acceso ejecutivo. Ve KPIs globales y métricas del equipo."}
                      {ROLE_META[form.role]?.level === 4 && "Acceso de gestión. Supervisa su equipo de asesores."}
                      {ROLE_META[form.role]?.level === 5 && "Acceso personal. Ve solo sus propios clientes y registros."}
                    </p>
                  </div>
                </>
              )}

              {modal.mode === "create" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Contraseña inicial <span style={{ color: P.accent }}>*</span></p>
                  <input value={form.password || ""} onChange={e => sf("password")(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = P.accentB}
                    onBlur={e => e.target.style.borderColor = P.border}
                  />
                </div>
              )}

              {modal.mode === "reset" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Nueva contraseña <span style={{ color: P.accent }}>*</span></p>
                  <input value={form.password || ""} onChange={e => sf("password")(e.target.value)} placeholder="Nueva contraseña (mín. 6 caracteres)" type="password" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = P.accentB}
                    onBlur={e => e.target.style.borderColor = P.border}
                  />
                  <p style={{ fontSize: 10.5, color: P.txt3, marginTop: 8 }}>Reseteando contraseña para: <span style={{ color: P.txt2 }}>{modal.user?.name}</span></p>
                </div>
              )}

              {modal.mode === "edit" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 9 }}>Estado de la cuenta</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: true, label: "Activo", c: P.emerald }, { v: false, label: "Inactivo", c: P.rose }].map(o => (
                      <button key={String(o.v)} onClick={() => sf("isActive")(o.v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.18s", background: form.isActive === o.v ? `${o.c}14` : "transparent", border: `1px solid ${form.isActive === o.v ? `${o.c}40` : P.border}`, color: form.isActive === o.v ? o.c : P.txt3 }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {modal.mode === "edit" && (
                <button onClick={() => openReset(modal.user)} style={{ padding: "9px 0", borderRadius: 10, background: "transparent", border: `1px solid ${P.amber}28`, color: P.amber, fontSize: 11.5, fontWeight: 600, fontFamily: font, cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={e => e.currentTarget.style.background = `${P.amber}0C`}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >Restablecer contraseña</button>
              )}

              {formErr && <p style={{ fontSize: 11.5, color: P.rose, background: `${P.rose}0C`, border: `1px solid ${P.rose}22`, padding: "10px 14px", borderRadius: 10 }}>{formErr}</p>}
              {formOk  && <p style={{ fontSize: 11.5, color: P.emerald, background: `${P.emerald}0C`, border: `1px solid ${P.emerald}22`, padding: "10px 14px", borderRadius: 10 }}>{formOk}</p>}
            </div>

            <div style={{ padding: "16px 26px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, height: 42, borderRadius: 12, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}>Cancelar</button>
              <button
                onClick={modal.mode === "create" ? handleCreate : modal.mode === "reset" ? handleReset : handleEdit}
                style={{ flex: 2, height: 42, borderRadius: 12, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = `${P.accent}24`}
                onMouseLeave={e => e.currentTarget.style.background = `${P.accent}16`}
              >
                {modal.mode === "create" ? <><Plus size={14} /> Crear Usuario</> : modal.mode === "reset" ? <><CheckCircle2 size={14} /> Guardar Contraseña</> : <><CheckCircle2 size={14} /> Guardar Cambios</>}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   PERMISOS POR MÓDULO
   ════════════════════════════════════════ */
const MODULE_ROLES = {
  d:      ["super_admin","admin","director","ceo"],
  c:      ["super_admin","admin","director","ceo","asesor"],
  ia:     ["super_admin","admin","director","ceo"],
  e:      ["super_admin","admin","director","ceo"],
  a:      ["super_admin","admin","director","ceo"],
  lp:     ["super_admin","admin","director","ceo"],
  fa:     ["super_admin","admin","director","ceo"],
  rrhh:   ["super_admin","admin","director","ceo"],
  planes: ["super_admin","admin","director","ceo","asesor"],
  admin:  ["super_admin","admin"],
};

const MODULE_NAMES = {
  d: "Comando", c: "CRM", ia: "IA CRM", e: "ERP",
  a: "Asesores", lp: "Landing Pages", fa: "Finanzas",
  rrhh: "Personas", planes: "Planes", admin: "Usuarios",
};

function PermissionGate({ moduleId, onGoBack }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 20, padding: 40,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Shield size={32} color={P.txt3} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 8 }}>
          Acceso restringido
        </p>
        <p style={{ fontSize: 13, color: P.txt3, lineHeight: 1.7, marginBottom: 6 }}>
          No tienes permiso para acceder al módulo <span style={{ color: P.txt2, fontWeight: 600 }}>{MODULE_NAMES[moduleId] || moduleId}</span>.
        </p>
        <p style={{ fontSize: 12, color: P.txt3, lineHeight: 1.6 }}>
          Contacta a tu director o administrador para solicitar acceso.
        </p>
      </div>
      <button onClick={onGoBack} style={{
        marginTop: 8, padding: "10px 24px", borderRadius: 11,
        background: `${P.accent}14`, border: `1px solid ${P.accentB}`,
        color: P.accent, fontSize: 13, fontWeight: 700,
        fontFamily: fontDisp, cursor: "pointer", transition: "background 0.18s",
        display: "flex", alignItems: "center", gap: 8,
      }}
        onMouseEnter={e => e.currentTarget.style.background = `${P.accent}22`}
        onMouseLeave={e => e.currentTarget.style.background = `${P.accent}14`}
      >
        <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} />
        Ir a mi CRM
      </button>
    </div>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();
  console.log("Current User:", user);
  const { leads, updateLead } = useLeads();
  const { properties } = useProperties();
  const { team } = useTeam();
  const isAsesorRole = !["super_admin","admin","director","ceo"].includes(user?.role);
  const [v, setV] = useState(isAsesorRole ? "c" : "d");
  const [co, setCo] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [notifs, setNotifs] = useState([]);

  const onLogout = () => {
    logout();
  };

  useEffect(() => {
    if (!user) return;
    const notificationsData = [
      { agent: "Cartera de Cierre", text: "$8.7M en negociación final — 3 cierres esperados esta semana", detail: "Gobernador 28 ($4.2M), Monarca 28 ($2.8M), Portofino ($1.7M). Documentación lista. Notarías confirmadas.", c: P.emerald, icon: Banknote, btn: "Gestionar Cierre", action: "Mostrar cartera de cierre" },
      { agent: "Alerta de Conversión", text: "Tasa de conversión pipeline: 32.1% — Superó meta mensual (+8.2%)", detail: "Prospecto→Visita: 52% | Visita→Negociación: 67% | Negociación→Cierre: 50%. Emmanuel Ortiz lidera con 94% eficiencia.", c: P.blue, icon: TrendingUp, btn: "Ver Detalles", action: "Análisis de conversión por asesor" },
      { agent: "Urgencia Operativa", text: "Portofino: Disponibilidad crítica — 3 unidades restantes", detail: "Demanda: 8 clientes pre-calificados esperando. Recomendación: Acelerar visitas. Margen actual: 28.5%", c: P.amber, icon: AlertCircle, btn: "Acelerar Venta", action: "Protocolo urgencia Portofino" },
      { agent: "Desempeño Equipo", text: "Cecilia Mendoza cerró $2.1M | Ken Lugo lidera con $8.7M acumulado", detail: "Meta trimestral: $48M. Avance: $35.9M (74.8%). 3 semanas para alcanzar objetivo. Araceli con 85% eficiencia.", c: P.violet, icon: Trophy, btn: "Panel de Control", action: "Métricas de equipo en tiempo real" },
      { agent: "Inventory Alert", text: "Gobernador 28: Stock bajo — 12% disponibilidad proyectada", detail: "Próxima fase: 8 unidades liberadas en 14 días. Pre-ventas ya asignadas a 6. Margen proyectado: 31%", c: P.cyan, icon: Home, btn: "Estrategia Stock", action: "Planificación de inventario trimestral" },
      { agent: "Oportunidad Comercial", text: "5 leads califican para VIP: Ingresos >$500K | 85% probabilidad cierre", detail: "James Mitchell, Fam. Rodríguez, Carlos Slim Jr., Sarah Williams, Tony Norberto. Negociación activa. Valores: $4.2M-$6.5M", c: P.rose, icon: Star, btn: "Activar VIP", action: "Protocolo de cierre VIP" },
    ];

    const timers = [];
    notificationsData.forEach((notif, idx) => {
      timers.push(setTimeout(() => {
        setNotifs(prev => {
          const updated = prev.includes(notif) ? prev : [...prev, notif];
          return updated.length > 4 ? updated.slice(-4) : updated;
        });
      }, (idx % 2 === 0 ? 3000 : 7000) + (idx * 2000)));
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [user]);

  const oc = useCallback((t, leadData) => {
    setCo(true);
    if (t) setTimeout(() => {
      const displayText = leadData ? `Analizar expediente de ${leadData.n}` : t;
      setMsgs(p => [...p, { role: "u", text: displayText }]);
      setTimeout(() => { setMsgs(p => [...p, { role: "a", ...getResp(t, leadData, leads) }]); }, 1105);
    }, 150);
  }, [leads]);

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <div style={{
      height: "100vh", display: "flex", fontFamily: font, color: P.txt,
      background: `radial-gradient(ellipse at 15% 0%, rgba(0,228,184,0.03) 0%, transparent 50%),
                    radial-gradient(ellipse at 85% 100%, rgba(76,158,255,0.02) 0%, transparent 50%), ${P.bg}`,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wave{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes atomSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:0}100%{top:100%}}
        @keyframes stepFade{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${P.border};border-radius:4px}
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: 60, height: "100vh", flexShrink: 0, borderRight: `1px solid ${P.border}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "24px 0 16px", background: "rgba(6,10,17,0.5)",
        zIndex: 20,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, marginBottom: 28,
          background: `linear-gradient(135deg, ${P.accent}20, ${P.accent}06)`,
          border: `1px solid ${P.accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 24px ${P.accent}0D`,
        }}>
          <StratosAtom size={22} color={P.accent} />
        </div>

        {nav.filter(n => !n.adminOnly || ["super_admin","admin"].includes(user?.role || "asesor")).map(n => {
          const a = v === n.id;
          const isAdmin = n.adminOnly;
          const hasAccess = MODULE_ROLES[n.id]?.includes(user?.role || "asesor") ?? true;
          const activeColor = isAdmin ? "#A78BFA" : P.accent;
          const activeBg = isAdmin ? "rgba(167,139,250,0.1)" : P.accentS;
          return (
            <div key={n.id}>
              {n.sep && <div style={{ height: 1, background: P.border, margin: "6px 0 10px" }} />}
              <button onClick={() => setV(n.id)} title={`${n.l}${!hasAccess ? " · Sin acceso" : ""}`} style={{
                width: 40, height: 40, borderRadius: 11, border: "none", cursor: "pointer",
                background: a ? activeBg : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 4, transition: "all 0.25s", position: "relative", opacity: hasAccess ? 1 : 0.45,
              }}>
                <n.i size={18} color={a ? activeColor : P.txt3} strokeWidth={a ? 2.2 : 1.8} />
                {a && <div style={{ position: "absolute", left: -1, top: "50%", transform: "translateY(-50%)", width: 2, height: 14, borderRadius: 1, background: activeColor, boxShadow: `0 0 6px ${activeColor}60` }} />}
              </button>
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        <button onClick={() => setCo(!co)} title="Agente Stratos" style={{
          width: 40, height: 40, borderRadius: 11,
          border: `1px solid ${co ? P.accentB : P.border}`,
          background: co ? P.accentS : P.glass,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", transition: "all 0.25s", marginBottom: 6,
          boxShadow: co ? `0 0 16px ${P.accent}0A` : "none",
        }}>
          <Atom size={17} color={co ? P.accent : P.txt3} />
        </button>
        <button title={["super_admin","admin"].includes(user?.role || "asesor") ? "Gestión de Usuarios" : "Configuración"}
          onClick={() => ["super_admin","admin"].includes(user?.role || "asesor") ? setV("admin") : null}
          style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${v === "admin" ? "rgba(167,139,250,0.3)" : "transparent"}`, background: v === "admin" ? "rgba(167,139,250,0.1)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
          onMouseEnter={e => { if (["super_admin","admin"].includes(user?.role)) { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; } }}
          onMouseLeave={e => { e.currentTarget.style.background = v === "admin" ? "rgba(167,139,250,0.1)" : "transparent"; e.currentTarget.style.borderColor = v === "admin" ? "rgba(167,139,250,0.3)" : "transparent"; }}
        >
          <Settings size={16} color={["super_admin","admin"].includes(user?.role || "asesor") ? (v === "admin" ? "#A78BFA" : P.txt2) : P.txt3} />
        </button>
        <button title="Volver al inicio" onClick={() => window.location.href = "/"} style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.borderH; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
        >
          <Home size={15} color={P.txt3} />
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          position: "relative",
          padding: "16px 28px", borderBottom: `1px solid ${P.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "rgba(6,10,17,0.4)", backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <p style={{
              fontSize: 21, fontWeight: 400, fontFamily: fontDisp, letterSpacing: "-0.02em", color: "#FFFFFF"
            }}>
              Stratos
              <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>IA</span>
            </p>
            <div style={{ height: 14, width: 1, background: P.border, alignSelf: "center" }} />
            <span style={{ fontSize: 13, color: P.txt2, fontWeight: 400, fontFamily: font, letterSpacing: "0.02em" }}>
              {nav.find(n => n.id === v)?.l}
            </span>
          </div>
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12 }}>
            <DynIsland onExpand={oc} notifications={notifs} />
            {/* Agent Orb */}
            <button onClick={() => setCo(!co)} style={{
              width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer",
              background: co ? "rgba(110,231,194,0.12)" : "#000000",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", transition: "all 0.55s cubic-bezier(0.32, 0.72, 0, 1)",
              boxShadow: co ? `0 0 20px rgba(110,231,194,0.15)` : "none",
              outline: co ? `1.5px solid rgba(110,231,194,0.3)` : `0.5px solid rgba(255,255,255,0.12)`,
            }}>
              <StratosAtom size={20} color={co ? P.accent : "rgba(255,255,255,0.7)"} />
              {notifs.length > 0 && !co && <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: P.accent, boxShadow: `0 0 8px ${P.accent}`, animation: "pulse 2s infinite" }} />}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 99, background: P.glass, border: `1px solid ${P.border}` }}>
              <Search size={13} color={P.txt3} />
              <span style={{ fontSize: 11, color: P.txt3 }}>Buscar...</span>
              <span style={{ fontSize: 9, color: P.txt3, padding: "1px 5px", borderRadius: 4, background: P.border }}>⌘K</span>
            </div>
            <button style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <Bell size={14} color={P.txt3} />
              <div style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: P.rose }} />
            </button>
            {/* User avatar + logout */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: `linear-gradient(135deg, ${P.accent}30, ${P.accent}08)`,
                border: `1px solid ${P.accentB}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: P.accent, fontFamily: fontDisp,
                flexShrink: 0,
              }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 11, color: P.txt, fontWeight: 600, fontFamily: fontDisp, lineHeight: 1.2, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.name || "Usuario"}
                </span>
                {user?.isDemo && <span style={{ fontSize: 9, color: P.amber, fontFamily: font, lineHeight: 1 }}>Demo</span>}
              </div>
              <button onClick={onLogout} title="Cerrar sesión" style={{
                width: 28, height: 28, borderRadius: 7,
                border: `1px solid ${P.border}`, background: "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.08)"; e.currentTarget.style.borderColor = "rgba(232,129,140,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
              >
                <UserCheck size={13} color={P.txt3} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto", animation: "fadeIn 0.4s ease", display: "flex", flexDirection: "column" }}>
            {/* Permission gate — solo bloquea si el rol está definido y NO tiene acceso */}
            {MODULE_ROLES[v] && !MODULE_ROLES[v].includes(user?.role || "asesor")
              ? <PermissionGate moduleId={v} onGoBack={() => setV("c")} />
              : <>
                  {v === "d" && <Dash oc={oc} co={co} leads={leads} />}
                  {v === "c" && <CRM oc={oc} co={co} leads={leads} updateDb={updateLead} />}
                  {v === "ia" && <IACRM oc={oc} leads={leads} updateDb={updateLead} />}
                  {v === "v" && <Team team={team || MOCK_TEAM} properties={properties || MOCK_PROPS} />}
                  {v === "e" && <ERP oc={oc} properties={properties || MOCK_PROPS} />}
                  {v === "a" && <AsesorCRM oc={oc} leads={leads} updateDb={updateLead} />}
                  {v === "lp" && <LandingPages />}
                  {v === "fa" && <FinanzasAdmin leads={leads} />}
                  {v === "rrhh" && <RRHHModule />}
                  {v === "planes" && <PricingScreen embedded onBack={() => setV(isAsesorRole ? "c" : "d")} />}
                  {v === "admin" && ["super_admin","admin"].includes(user?.role || "asesor") && <AdminPanel />}
                </>
            }
          </div>
          <Chat open={co} onClose={() => setCo(false)} msgs={msgs} setMsgs={setMsgs} inp={inp} setInp={setInp} leads={leads} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PORTAL DE CANDIDATOS — STRATOS PEOPLE
   Página pública de aplicación a vacantes con IA
   Accesible en: /?apply  o  /#apply
═══════════════════════════════════════════════════════════════ */
const PORTAL_VACANTES = [
  { id: 1, titulo: "Asesor de Ventas Senior", dept: "Ventas", ubicacion: "Playa del Carmen", salario: "$25,000–$45,000 MXN", tipo: "Tiempo completo" },
  { id: 2, titulo: "Coordinadora de Marketing Digital", dept: "Marketing", ubicacion: "Remoto / Cancún", salario: "$28,000–$42,000 MXN", tipo: "Tiempo completo" },
  { id: 3, titulo: "Contador Fiscal Sr. — CFDI 4.0", dept: "Finanzas", ubicacion: "Cancún", salario: "$22,000–$35,000 MXN", tipo: "Tiempo completo" },
  { id: 4, titulo: "Asistente de Dirección Ejecutiva", dept: "Dirección", ubicacion: "Cancún", salario: "$18,000–$26,000 MXN", tipo: "Tiempo completo" },
];

const PREGUNTAS_BASE = {
  "Asesor de Ventas Senior": [
    { id: "exp_ventas", q: "¿Cuántos años de experiencia tienes en ventas de bienes raíces o productos de alto valor?", tipo: "opciones", opts: ["Menos de 1 año", "1–3 años", "3–6 años", "Más de 6 años"] },
    { id: "cierre", q: "¿Cuál fue la venta más grande que has cerrado y cómo lo lograste?", tipo: "texto", placeholder: "Describe brevemente el proceso, el monto aproximado y tu estrategia..." },
    { id: "ingles", q: "¿Cuál es tu nivel de inglés?", tipo: "opciones", opts: ["Básico (A1–A2)", "Intermedio (B1–B2)", "Avanzado (C1)", "Nativo / Bilingüe (C2)"] },
    { id: "herramientas", q: "¿Qué herramientas digitales usas en tu trabajo de ventas?", tipo: "multiselect", opts: ["CRM (Salesforce, HubSpot)", "WhatsApp Business", "Instagram / Meta Ads", "Google Workspace", "Zoom / Meet", "LinkedIn Sales Navigator"] },
    { id: "motivacion", q: "¿Por qué quieres trabajar en el mercado inmobiliario de lujo de la Riviera Maya?", tipo: "texto", placeholder: "Sé honesto y específico. Esto nos ayuda a conocerte mejor..." },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
  "Coordinadora de Marketing Digital": [
    { id: "especialidad", q: "¿Cuál es tu mayor fortaleza en marketing digital?", tipo: "opciones", opts: ["Performance / Paid Ads", "Contenido y Social Media", "SEO / SEM", "Estrategia de marca"] },
    { id: "herramientas", q: "¿Qué plataformas manejas con mayor expertise?", tipo: "multiselect", opts: ["Meta Ads Manager", "Google Ads", "TikTok Ads", "Canva / Adobe", "HubSpot", "Analytics / Tag Manager"] },
    { id: "portafolio", q: "Comparte una campaña de la que estés orgullosa y sus resultados (ROAS, CTR, conversiones, etc.)", tipo: "texto", placeholder: "Describe la campaña, la estrategia y los KPIs obtenidos..." },
    { id: "ingles", q: "¿Cuál es tu nivel de inglés?", tipo: "opciones", opts: ["Básico", "Intermedio", "Avanzado", "Nativo / Bilingüe"] },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
  default: [
    { id: "exp", q: "¿Cuántos años de experiencia tienes en el área para la que aplicas?", tipo: "opciones", opts: ["0–1 año", "1–3 años", "3–5 años", "Más de 5 años"] },
    { id: "fortaleza", q: "¿Cuál consideras que es tu principal fortaleza profesional?", tipo: "texto", placeholder: "Sé específico con un ejemplo concreto..." },
    { id: "reto", q: "¿Cuál ha sido el reto más difícil en tu carrera y cómo lo superaste?", tipo: "texto", placeholder: "Describe la situación y tu solución..." },
    { id: "expectativa", q: "¿Qué esperas del equipo y la empresa donde trabajes?", tipo: "texto", placeholder: "Cultura, crecimiento, ambiente, beneficios..." },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
};

const CandidatePortal = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", telefono: "", linkedin: "", vacante: null });
  const [cvFile, setCvFile] = useState(null);
  const [cvDragging, setCvDragging] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [multiSel, setMultiSel] = useState({});
  const [pregIdx, setPregIdx] = useState(0);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [folio, setFolio] = useState("");
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const preguntas = form.vacante ? (PREGUNTAS_BASE[form.vacante.titulo] || PREGUNTAS_BASE.default) : PREGUNTAS_BASE.default;
  const pregActual = preguntas[pregIdx];
  const totalPregs = preguntas.length;

  const setF = (k, val) => setForm(p => ({ ...p, [k]: val }));

  const validateStep1 = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.apellido.trim()) e.apellido = "Requerido";
    if (!form.email.includes("@")) e.email = "Email inválido";
    if (form.telefono.replace(/\D/g,"").length < 10) e.telefono = "Mínimo 10 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCvDrop = (e) => {
    e.preventDefault(); setCvDragging(false);
    const file = e.dataTransfer?.files[0] || e.target?.files?.[0];
    if (file) setCvFile(file);
  };

  const handleNextPreg = () => {
    const val = respuestas[pregActual.id] || (multiSel[pregActual.id]?.length > 0 ? multiSel[pregActual.id].join(", ") : "");
    if (!val && pregActual.tipo !== "multiselect") return;
    if (pregActual.tipo === "multiselect") {
      setRespuestas(p => ({ ...p, [pregActual.id]: (multiSel[pregActual.id] || []).join(", ") }));
    }
    if (pregIdx < totalPregs - 1) {
      setPregIdx(i => i + 1);
    } else {
      setAiProcessing(true);
      setTimeout(() => {
        setAiProcessing(false);
        setFolio("STRP-" + Math.random().toString(36).substring(2, 8).toUpperCase());
        setStep(5);
      }, 2800);
    }
  };

  const toggleMulti = (id, opt) => {
    setMultiSel(p => {
      const curr = p[id] || [];
      return { ...p, [id]: curr.includes(opt) ? curr.filter(x => x !== opt) : [...curr, opt] };
    });
  };

  const pf = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
  const pfb = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
  const progColors = ["#A78BFA", "#7EB8F0", "#6EE7C2", "#6EE7C2"];
  const stepLabels = ["Tus datos", "Posición", "Tu CV", "Preguntas IA"];

  const PortalInp = ({ label, id, type = "text", placeholder = "", error, val, onChange, required }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: error ? "#E8818C" : "rgba(255,255,255,0.55)", fontFamily: pfb }}>
        {label}{required && <span style={{ color: "#6EE7C2", marginLeft: 3 }}>*</span>}
      </label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding: "12px 16px", borderRadius: 10, fontSize: 13, fontFamily: pfb, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#E8818C50" : val ? "#6EE7C230" : "rgba(255,255,255,0.08)"}`, color: "#E2E8F0", outline: "none", transition: "border 0.2s" }}
        onFocus={e => e.target.style.borderColor = error ? "#E8818C80" : "#6EE7C240"}
        onBlur={e => e.target.style.borderColor = error ? "#E8818C50" : val ? "#6EE7C230" : "rgba(255,255,255,0.08)"}
      />
      {error && <span style={{ fontSize: 10, color: "#E8818C", fontWeight: 600 }}>{error}</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060A11", display: "flex", flexDirection: "column", fontFamily: pfb, backgroundImage: `radial-gradient(ellipse at 20% 0%, rgba(167,139,250,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(110,231,194,0.04) 0%, transparent 55%)` }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        *{box-sizing:border-box;margin:0}
        ::placeholder{color:rgba(255,255,255,0.2)!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
      `}</style>

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,10,17,0.85)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(110,231,194,0.1)", border: "1px solid rgba(110,231,194,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StratosAtom size={21} color="#6EE7C2" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: pf, letterSpacing: "-0.02em" }}>Stratos <span style={{ color: "#6EE7C2" }}>People</span></p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Portal de Candidatos · Riviera Maya 2026</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 8, background: "rgba(110,231,194,0.05)", border: "1px solid rgba(110,231,194,0.12)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6EE7C2", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: "#6EE7C2", fontWeight: 600 }}>{PORTAL_VACANTES.length} vacantes abiertas</span>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 640, width: "100%", margin: "0 auto", padding: "36px 20px 72px" }}>

        {/* ─── STEP 5 CONFIRMACIÓN ─── */}
        {step === 5 && (
          <div style={{ textAlign: "center", padding: "48px 24px", animation: "fadeIn 0.5s ease" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(110,231,194,0.1)", border: "2px solid rgba(110,231,194,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 0 48px rgba(110,231,194,0.12)" }}>
              <CheckCircle2 size={36} color="#6EE7C2" />
            </div>
            <p style={{ fontSize: 28, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.04em", marginBottom: 10 }}>
              ¡Aplicación <span style={{ fontWeight: 700, color: "#6EE7C2" }}>enviada!</span>
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 36 }}>
              Recibimos tu aplicación para <strong style={{ color: "rgba(255,255,255,0.75)" }}>{form.vacante?.titulo}</strong>.<br />
              Te contactaremos a <strong style={{ color: "rgba(255,255,255,0.65)" }}>{form.email}</strong> en 2–5 días hábiles.
            </p>
            <div style={{ padding: "22px 36px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 32, display: "inline-block" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>NÚMERO DE FOLIO</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: "#A78BFA", fontFamily: pf, letterSpacing: "0.08em" }}>{folio}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>Guarda este número para dar seguimiento</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
              {[
                { icon: <AIAtom size={18} color="#A78BFA" />, t: "Análisis IA en proceso", s: "Tu perfil está siendo evaluado automáticamente", c: "#A78BFA" },
                { icon: <Bell size={16} color="#6EE7C2" />, t: "Respuesta en 2–5 días hábiles", s: `Te avisaremos a ${form.email}`, c: "#6EE7C2" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: `${i === 0 ? "rgba(167,139,250,0.05)" : "rgba(110,231,194,0.04)"}`, border: `1px solid ${i === 0 ? "rgba(167,139,250,0.12)" : "rgba(110,231,194,0.1)"}` }}>
                  <div style={{ flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{item.t}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 4 PREGUNTAS IA ─── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: pf }}>Pregunta {pregIdx + 1} de {totalPregs}</p>
                <p style={{ fontSize: 11, color: "#A78BFA", fontWeight: 700 }}>{Math.round((pregIdx / totalPregs) * 100)}% completado</p>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #A78BFA, #7EB8F0)", width: `${(pregIdx / totalPregs) * 100}%`, transition: "width 0.4s ease" }} />
              </div>
            </div>

            {aiProcessing ? (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 28px" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.2)", borderTop: "2px solid #A78BFA", animation: "spin 1s linear infinite" }} />
                  <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "2px solid rgba(110,231,194,0.12)", borderTop: "2px solid #6EE7C2", animation: "spin 1.6s linear infinite reverse" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AIAtom size={28} color="#A78BFA" spin />
                  </div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FFF", fontFamily: pf, marginBottom: 10 }}>Evaluando tu perfil con IA...</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, marginBottom: 20 }}>
                  Calculando score de compatibilidad,<br />analizando respuestas y generando tu perfil.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#A78BFA", animation: `blink 1.4s ${i * 0.25}s infinite` }} />)}
                </div>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ padding: "26px 24px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <AIAtom size={18} color="#A78BFA" />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#FFF", fontFamily: pf, lineHeight: 1.55 }}>{pregActual?.q}</p>
                  </div>

                  {pregActual?.tipo === "opciones" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pregActual.opts.map(opt => {
                        const sel = respuestas[pregActual.id] === opt;
                        return (
                          <button key={opt} onClick={() => setRespuestas(p => ({ ...p, [pregActual.id]: opt }))} style={{ padding: "13px 18px", borderRadius: 11, textAlign: "left", cursor: "pointer", border: `1.5px solid ${sel ? "#A78BFA50" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)", color: sel ? "#A78BFA" : "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: pfb, fontWeight: sel ? 700 : 400, transition: "all 0.18s", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? "#A78BFA" : "rgba(255,255,255,0.18)"}`, background: sel ? "#A78BFA" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFF" }} />}
                            </div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {pregActual?.tipo === "multiselect" && (
                    <div>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: pfb }}>Selecciona todas las que apliquen</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {pregActual.opts.map(opt => {
                          const sel = (multiSel[pregActual.id] || []).includes(opt);
                          return (
                            <button key={opt} onClick={() => toggleMulti(pregActual.id, opt)} style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", border: `1.5px solid ${sel ? "#6EE7C250" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(110,231,194,0.08)" : "rgba(255,255,255,0.02)", color: sel ? "#6EE7C2" : "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: pfb, fontWeight: sel ? 700 : 400, transition: "all 0.18s", display: "flex", alignItems: "center", gap: 6 }}>
                              {sel && <Check size={11} color="#6EE7C2" />} {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pregActual?.tipo === "texto" && (
                    <textarea value={respuestas[pregActual.id] || ""} onChange={e => setRespuestas(p => ({ ...p, [pregActual.id]: e.target.value }))} placeholder={pregActual.placeholder} rows={4}
                      style={{ width: "100%", padding: "13px 16px", borderRadius: 11, fontSize: 13, fontFamily: pfb, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#E2E8F0", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.4)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                    />
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {pregIdx > 0 && <button onClick={() => setPregIdx(i => i - 1)} style={{ padding: "13px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Anterior</button>}
                  <button onClick={handleNextPreg}
                    disabled={!respuestas[pregActual?.id] && !(multiSel[pregActual?.id]?.length > 0)}
                    style={{ flex: 1, padding: "14px 24px", borderRadius: 11, border: "none", fontSize: 14, fontWeight: 700, cursor: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "pointer" : "default", fontFamily: pf, background: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "#FFF" : "rgba(255,255,255,0.07)", color: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "#080D14" : "rgba(255,255,255,0.2)", transition: "all 0.2s" }}>
                    {pregIdx === totalPregs - 1 ? "Enviar aplicación →" : "Siguiente →"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 18 }}>
                  {preguntas.map((_, i) => <div key={i} style={{ width: i === pregIdx ? 22 : 6, height: 4, borderRadius: 3, background: i < pregIdx ? "#6EE7C2" : i === pregIdx ? "#A78BFA" : "rgba(255,255,255,0.1)", transition: "all 0.3s" }} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEPS 1–3 ─── */}
        {step <= 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {stepLabels.map((label, i) => {
                const n = i + 1; const done = step > n; const active = step === n;
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", flex: i < stepLabels.length - 1 ? 1 : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${done ? "#6EE7C2" : active ? progColors[i] : "rgba(255,255,255,0.1)"}`, background: done ? "rgba(110,231,194,0.12)" : active ? `${progColors[i]}14` : "transparent", transition: "all 0.35s" }}>
                        {done ? <Check size={13} color="#6EE7C2" /> : <span style={{ fontSize: 11, fontWeight: 700, color: active ? progColors[i] : "rgba(255,255,255,0.2)" }}>{n}</span>}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? progColors[i] : done ? "rgba(110,231,194,0.5)" : "rgba(255,255,255,0.18)", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && <div style={{ flex: 1, height: 1, background: done ? "rgba(110,231,194,0.25)" : "rgba(255,255,255,0.06)", margin: "0 6px", marginBottom: 18, transition: "background 0.4s" }} />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 26 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    Cuéntanos sobre <span style={{ fontWeight: 700, color: "#A78BFA" }}>ti</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>Ingresa tus datos de contacto para iniciar tu aplicación. Solo tomará 2 minutos.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <PortalInp label="Nombre" placeholder="Ej. Sofía" required val={form.nombre} onChange={v => setF("nombre", v)} error={errors.nombre} />
                    <PortalInp label="Apellido" placeholder="Ej. Ramírez Torres" required val={form.apellido} onChange={v => setF("apellido", v)} error={errors.apellido} />
                  </div>
                  <PortalInp label="Correo electrónico" type="email" placeholder="tu@email.com" required val={form.email} onChange={v => setF("email", v)} error={errors.email} />
                  <PortalInp label="Teléfono (WhatsApp)" type="tel" placeholder="+52 55 1234 5678" required val={form.telefono} onChange={v => setF("telefono", v)} error={errors.telefono} />
                  <PortalInp label="LinkedIn (opcional)" placeholder="linkedin.com/in/tu-perfil" val={form.linkedin} onChange={v => setF("linkedin", v)} />
                </div>
                <button onClick={() => { if (validateStep1()) setStep(2); }} style={{ marginTop: 24, width: "100%", padding: "15px", borderRadius: 12, border: "none", background: "#FFF", color: "#080D14", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: pf }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    ¿A qué posición <span style={{ fontWeight: 700, color: "#7EB8F0" }}>aplicas?</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>Selecciona la vacante que mejor encaje con tu perfil.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {PORTAL_VACANTES.map(v => {
                    const sel = form.vacante?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => setF("vacante", v)} style={{ padding: "18px 20px", borderRadius: 14, textAlign: "left", cursor: "pointer", border: `2px solid ${sel ? "#7EB8F055" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(126,184,240,0.07)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: sel ? "#7EB8F0" : "#FFF", fontFamily: pf }}>{v.titulo}</p>
                          {sel && <Check size={16} color="#7EB8F0" />}
                        </div>
                        <div style={{ display: "flex", gap: 14 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{v.dept} · {v.ubicacion}</span>
                          <span style={{ fontSize: 11, color: sel ? "#6EE7C2" : "rgba(110,231,194,0.55)", fontWeight: 600 }}>{v.salario}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ padding: "14px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Atrás</button>
                  <button onClick={() => { if (form.vacante) setStep(3); }} style={{ flex: 1, padding: "14px", borderRadius: 11, border: "none", background: form.vacante ? "#FFF" : "rgba(255,255,255,0.07)", color: form.vacante ? "#080D14" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: form.vacante ? "pointer" : "default", fontFamily: pf }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — CV */}
            {step === 3 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    Sube tu <span style={{ fontWeight: 700, color: "#6EE7C2" }}>CV</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>La IA lo analiza automáticamente para agilizar tu proceso.</p>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setCvDragging(true); }}
                  onDragLeave={() => setCvDragging(false)}
                  onDrop={handleCvDrop}
                  onClick={() => !cvFile && fileRef.current?.click()}
                  style={{ padding: cvFile ? "22px" : "48px 28px", borderRadius: 18, textAlign: "center", border: `2px dashed ${cvDragging ? "#6EE7C2" : cvFile ? "#6EE7C250" : "rgba(255,255,255,0.1)"}`, background: cvDragging ? "rgba(110,231,194,0.05)" : cvFile ? "rgba(110,231,194,0.03)" : "rgba(255,255,255,0.01)", cursor: cvFile ? "default" : "pointer", transition: "all 0.25s", marginBottom: 16 }}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleCvDrop} style={{ display: "none" }} />
                  {cvFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(110,231,194,0.1)", border: "1px solid rgba(110,231,194,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText size={20} color="#6EE7C2" />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginBottom: 3 }}>{cvFile.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(110,231,194,0.7)" }}>{(cvFile.size / 1024).toFixed(0)} KB · Listo para analizar con IA</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setCvFile(null); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={12} color="rgba(255,255,255,0.4)" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(110,231,194,0.07)", border: "1px solid rgba(110,231,194,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <Download size={24} color="#6EE7C2" style={{ transform: "rotate(180deg)" }} />
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: pf, marginBottom: 8 }}>{cvDragging ? "¡Suelta aquí!" : "Arrastra tu CV o haz clic"}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>PDF, Word o imagen JPG/PNG · Máx. 10 MB</p>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        {["PDF", "DOC / DOCX", "JPG / PNG"].map(f => <span key={f} style={{ fontSize: 10, color: "rgba(110,231,194,0.55)", background: "rgba(110,231,194,0.05)", border: "1px solid rgba(110,231,194,0.12)", padding: "3px 10px", borderRadius: 5, fontWeight: 600 }}>{f}</span>)}
                      </div>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 20 }}>
                  ¿No tienes CV listo?{" "}
                  <button onClick={() => setStep(4)} style={{ background: "none", border: "none", color: "rgba(167,139,250,0.65)", cursor: "pointer", fontSize: 11, textDecoration: "underline", fontFamily: pfb }}>Continuar sin CV</button>
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(2)} style={{ padding: "14px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Atrás</button>
                  <button onClick={() => setStep(4)} style={{ flex: 1, padding: "14px", borderRadius: 11, border: "none", background: cvFile ? "#FFF" : "rgba(255,255,255,0.07)", color: cvFile ? "#080D14" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: pf }}>
                    {cvFile ? "Analizar y continuar →" : "Continuar sin CV →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 28px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <StratosAtom size={13} color="rgba(255,255,255,0.18)" />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>Stratos AI · Datos protegidos con cifrado · 2026</span>
      </div>
    </div>
  );
};

/* Root entry point — detecta si es portal o app principal */
export function PortalApp() {
  return <CandidatePortal />;
}
