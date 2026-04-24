import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import LoginScreen from "../landing/LoginScreen.jsx";
import PricingScreen from "../landing/PricingScreen.jsx";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { adminGetAllUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetPassword } from "../lib/auth";
import {
  TrendingUp, Target, ArrowUpRight, ArrowRight, CheckCircle2, Mic, Search,
  Users, Building2, MapPin, Send, Plus, Timer, Flame, Crown,
  Trophy, Gauge, Bell, Filter, User, DollarSign, Zap, Phone,
  CalendarDays, FileText, Briefcase, ChevronRight, ChevronLeft, Lightbulb,
  Settings, X, Mic2, Atom, Orbit, Hexagon, Crosshair,
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
  UserCheck, List, SlidersHorizontal, Mail, LogOut, Power,
  Sun, Moon, Pencil, Save, Minus, GripVertical, ChevronsDown
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import "./App.css";
import Dash         from "./views/Dash";
import CRM          from "./views/CRM";
import ERP          from "./views/ERP";
import Team         from "./views/Team";
import IACRM        from "./views/IACRM";
import LandingPages  from "./views/LandingPages";
import FinanzasAdmin from "./views/FinanzasAdmin";
import RRHHModule   from "./views/RRHHModule";

/* ════════════════════════════════════════
   DESIGN SYSTEM
   ════════════════════════════════════════ */
const P = {
  bg: "#0C0E14", glass: "rgba(255,255,255,0.032)",
  glassH: "rgba(255,255,255,0.052)", border: "rgba(255,255,255,0.07)",
  borderH: "rgba(255,255,255,0.12)", surface: "#111318",
  accent: "#6EE7C2", accentS: "rgba(110,231,194,0.07)",
  accentB: "rgba(110,231,194,0.12)", blue: "#7EB8F0",
  violet: "#A78BFA", amber: "#67B7D1", rose: "#9B8EFF",
  emerald: "#6DD4A8", cyan: "#5DC8D9",
  txt: "#E2E8F0", txt2: "#8B99AE", txt3: "#4A5568",
  r: 16, rs: 10, rx: 6,
};

/* ── Paleta LIGHT (modo blanco premium) ──
   Diseñada con técnicas de "rich white background":
   · Fondo off-white con tinte cálido-azulado sutil (no blanco plano)
   · Glass ultra-traslúcido con layered shadow premium
   · Acentos saturados para contraste AA y "vida" visual
   · Tokens extra para shadows/gradients reutilizables */
const LP = {
  bg: "#EDF3F0",                      // off-white con tinte mint muy sutil — vibra con el branding
  bgSoft: "#F6FAF8",
  bgCool: "#EAF0EE",
  glass: "rgba(255,255,255,0.70)",
  glassH: "rgba(255,255,255,0.92)",
  glassStrong: "rgba(255,255,255,0.96)",
  glassMint: "rgba(236,251,246,0.75)", // glass con tinte mint para sidebar/elementos branded
  border: "rgba(15,23,42,0.08)",
  borderH: "rgba(15,23,42,0.16)",
  borderMint: "rgba(15,158,122,0.18)",
  surface: "#FFFFFF",
  accent: "#0D9A76",                  // mint-emerald brand, saturado y profundo
  accentDark: "#067A5E",
  accentS: "rgba(13,154,118,0.08)",
  accentB: "rgba(13,154,118,0.28)",
  accentG: "linear-gradient(135deg, #0D9A76 0%, #14B892 50%, #34D4AA 100%)",
  blue: "#2563EB",
  violet: "#7C3AED",
  amber: "#D97706",
  rose: "#E11D48",
  emerald: "#059669",
  cyan: "#0891B2",
  txt: "#0B1220",
  txt2: "#3B4A61",
  txt3: "#7A8699",
  // Tokens premium de sombra (layered shadows tipo Apple/Stripe)
  shadow1: "0 1px 2px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.04)",
  shadow2: "0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.07), 0 16px 40px rgba(15,23,42,0.04)",
  shadow3: "0 4px 12px rgba(15,23,42,0.08), 0 20px 56px rgba(15,23,42,0.10), 0 32px 80px rgba(15,23,42,0.06)",
  shadowMint: "0 2px 8px rgba(13,154,118,0.10), 0 8px 28px rgba(13,154,118,0.08)",
  r: 16, rs: 10, rx: 6,
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const fontDisp = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

/* ════════════════════════════════════════
   BUDGET PARSING — acepta shorthand del usuario
   ════════════════════════════════════════
   parseBudget("300k")     → 300000
   parseBudget("1.5M")     → 1500000
   parseBudget("2.5 mdd")  → 2500000
   parseBudget("500 mil")  → 500000
   parseBudget("$300,000") → 300000
   parseBudget("750")      → 750
*/
const parseBudget = (input) => {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return isFinite(input) ? input : 0;
  let s = String(input).trim().toLowerCase();
  if (!s) return 0;
  // limpia símbolos de moneda / separadores / sufijos de texto comunes
  s = s.replace(/usd|mxn|dolares|dólares|pesos|\$|€|,|\s+$/g, "").trim();
  // colapsar espacios internos
  s = s.replace(/\s+/g, " ");

  // Detectar sufijo multiplicador
  // k, mil, millar → 1_000
  // m, mm, mdd, millón, millones → 1_000_000
  // b, bn, billón → 1_000_000_000
  let multiplier = 1;
  const suffixMatch = s.match(/([0-9.,]+)\s*(k|mil(?:es|lar|lares)?|m|mm|mdd|millon(?:es)?|millón|b|bn|billon(?:es)?|billón)$/);
  if (suffixMatch) {
    const suf = suffixMatch[2];
    if (suf === "k" || suf.startsWith("mil") || suf === "millar" || suf === "millares") multiplier = 1_000;
    else if (suf === "m" || suf === "mm" || suf === "mdd" || suf.startsWith("millon") || suf === "millón") multiplier = 1_000_000;
    else if (suf === "b" || suf === "bn" || suf.startsWith("billon") || suf === "billón") multiplier = 1_000_000_000;
    s = suffixMatch[1];
  }

  // Normalizar coma como separador decimal si es relevante (ej. "1,5")
  // Si tiene una sola coma y no termina en dígitos de grupo de miles, tratar como decimal.
  if (/^[0-9]+,[0-9]{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");

  const num = parseFloat(s);
  if (!isFinite(num)) return 0;
  return Math.round(num * multiplier);
};

const formatBudget = (amount) => {
  const n = Number(amount) || 0;
  if (n === 0) return "";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, "")}M USD`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.?0+$/, "")}K USD`;
  }
  return `$${n.toLocaleString("en-US")} USD`;
};

/* Minimalist Stratos Logo */
/* Atom clásico — rings concéntricos (header, sidebar, cards generales) */
const StratosAtom = ({ size = 20, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="1.1" opacity="0.18" />
    <circle cx="16" cy="16" r="9"  stroke={color} strokeWidth="1.2" opacity="0.38" />
    <circle cx="16" cy="16" r="4.5" stroke={color} strokeWidth="1.25" opacity="0.68" />
    <circle cx="16" cy="16" r="1.6" fill={color} />
  </svg>
);

/* Atom hex — 3 órbitas elípticas rotadas + núcleo brillante (solo en Centro de Agentes IA) */
const StratosAtomHex = ({ size = 22, color = "#FFFFFF", edge = "#6EE7C2" }) => {
  const uid = `atomhex-${size}-${String(color).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "block" }}>
      <defs>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor={edge}   stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={`${uid}-ring`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor={edge}  stopOpacity="0.55" />
          <stop offset="50%"  stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={edge}  stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Tres órbitas elípticas — 0°, 60°, 120° */}
      <g fill="none" strokeWidth="1" stroke={`url(#${uid}-ring)`} strokeLinecap="round">
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(120 16 16)" />
      </g>

      {/* Núcleo — blanco brillante con borde mint sutil */}
      <circle cx="16" cy="16" r="2.4" fill={`url(#${uid}-core)`} />
      <circle cx="16" cy="16" r="2.4" fill="none" stroke={edge} strokeWidth="0.4" opacity="0.9" />
    </svg>
  );
};

/* Agent icons */
const AgentIcons = {
  gerente: Crosshair,
  asistente: Waypoints,
  analista: Radar,
};

/* ════════════════════════════════════════
   AI AGENT REGISTRY — equipo virtual asignable
   ════════════════════════════════════════ */
const AI_AGENTS = {
  reactivar: {
    key: "reactivar",
    name: "Reactivador",
    short: "Reactivador",
    role: "Recupera leads fríos",
    icon: RefreshCw,
    color: "#6EE7C2",
    bestFor: "Clientes con 5+ días sin contacto",
    how: "Envía mensajes personalizados por WhatsApp y email para reabrir la conversación sin sonar forzado.",
  },
  seguimiento: {
    key: "seguimiento",
    name: "Seguimiento",
    short: "Seguimiento",
    role: "Mantiene la relación activa",
    icon: MessageCircle,
    color: "#6EE7C2",
    bestFor: "Clientes activos en primer contacto o seguimiento",
    how: "Prepara next-steps, recordatorios y micro-compromisos para evitar que el lead se enfríe.",
  },
  callcenter: {
    key: "callcenter",
    name: "Callcenter IA",
    short: "Callcenter",
    role: "Prepara y asiste llamadas",
    icon: Phone,
    color: "#72A9F5",
    bestFor: "Leads HOT o Zooms agendados",
    how: "Genera briefing pre-llamada con objeciones esperadas, argumentos y tono del cliente.",
  },
  calificar: {
    key: "calificar",
    name: "Calificador",
    short: "Calificador",
    role: "Evalúa y prioriza leads nuevos",
    icon: Target,
    color: "#C9B1F8",
    bestFor: "Clientes recién registrados",
    how: "Analiza perfil, intención y fit del proyecto para darte un score y recomendación accionable.",
  },
};
const AI_AGENT_LIST = Object.values(AI_AGENTS);

/* ════════════════════════════════════════
   SHARED COMPONENTS
   ════════════════════════════════════════ */
const G = ({ children, style, hover, onClick, np, T: Tprop }) => {
  const [h, setH] = useState(false);
  const T = Tprop || P;
  const isLight = T !== P;
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => setH(false)}
      onClick={onClick} style={{
        background: isLight
          ? (h ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)")
          : (h ? T.glassH : T.glass),
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        border: `1px solid ${h ? T.borderH : T.border}`,
        borderRadius: isLight ? 20 : T.r, padding: np ? 0 : 18,
        cursor: onClick ? "pointer" : "default",
        boxShadow: isLight
          ? (h
              ? "0 2px 4px rgba(15,23,42,0.04), 0 12px 28px rgba(15,23,42,0.08), 0 24px 56px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.8)"
              : "0 1px 3px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06), 0 16px 40px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.8)")
          : "none",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)", ...style,
      }}>{children}</div>
  );
};

const Pill = ({ children, color = P.accent, s, isLight = false }) => {
  // En tema claro, oscurecemos el texto para que contraste sobre blanco
  // y subimos los alphas del fondo/borde para darle presencia sin saturar.
  const textColor = isLight
    ? `color-mix(in srgb, ${color} 62%, #0B1220 38%)`
    : color;
  const bgGrad = isLight
    ? `linear-gradient(135deg, ${color}2E 0%, ${color}18 100%)`
    : `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)`;
  const borderCol = isLight ? `${color}5C` : `${color}3A`;
  const shadow = isLight
    ? `0 1px 3px ${color}26, inset 0 1px 0 rgba(255,255,255,0.55)`
    : `0 1px 2px ${color}14, inset 0 1px 0 rgba(255,255,255,0.18)`;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: s ? "2px 8px" : "4px 11px", borderRadius: 99,
      fontSize: s ? 10 : 11, fontWeight: 700, color: textColor,
      background: bgGrad,
      border: `1px solid ${borderCol}`,
      boxShadow: shadow,
      letterSpacing: "0.015em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

const Ico = ({ icon: I, sz = 34, is = 16, c = P.accent }) => (
  <div style={{
    width: sz, height: sz, borderRadius: sz > 32 ? 12 : 8, flexShrink: 0,
    background: `${c}0F`, border: `1px solid ${c}1A`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}><I size={is} color={c} /></div>
);

/* ────────────────────────────────────────────────────────────
   ChipSelect — Selector click-first con "+ Registrar nuevo"
   ──────────────────────────────────────────────────────────── */
const ChipSelect = ({ value, onChange, options = [], onAddNew, placeholder = "Seleccionar", icon: Icon = Users, color = P.accent, newLabel = "Registrar nuevo", searchPlaceholder = "Buscar o escribir…" }) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [newVal, setNewVal] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); setQuery(""); setNewVal(""); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const uniqueOptions = Array.from(new Set(options.filter(Boolean).map(s => String(s).trim()).filter(Boolean)));
  const filtered = query
    ? uniqueOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : uniqueOptions;

  const handlePick = (v) => { onChange?.(v); setOpen(false); setAdding(false); setQuery(""); setNewVal(""); };
  const handleAdd = () => {
    const v = newVal.trim();
    if (!v) return;
    onAddNew?.(v);
    handlePick(v);
  };

  const hasValue = !!value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger — pill full-width */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: 44, padding: "0 12px",
          borderRadius: 11,
          background: hasValue ? `${color}10` : P.glass,
          border: `1px solid ${hasValue ? `${color}44` : (open ? P.borderH : P.border)}`,
          color: hasValue ? "#FFF" : P.txt3,
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: hasValue ? 600 : 500,
          letterSpacing: "-0.005em",
          transition: "all 0.18s",
          boxShadow: open ? `0 0 0 3px ${color}1A` : "none",
          textAlign: "left",
        }}
        onMouseEnter={e => { if (!hasValue) { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; } }}
        onMouseLeave={e => { if (!hasValue && !open) { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; } }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}2E`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} color={color} strokeWidth={2.5} />
        </div>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font }}>
          {value || placeholder}
        </span>
        {hasValue && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); handlePick(""); }}
            title="Limpiar"
            style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <X size={10} color={P.txt3} strokeWidth={2.5} />
          </span>
        )}
        <ChevronDown size={12} color={P.txt3} strokeWidth={2.5} style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 600,
          background: "#0B101A", border: `1px solid ${P.borderH}`, borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
          overflow: "hidden", animation: "fadeIn 0.14s ease",
          fontFamily: font,
        }}>
          {!adding && (
            <>
              {/* Search */}
              {uniqueOptions.length > 3 && (
                <div style={{ padding: "9px 10px 8px", borderBottom: `1px solid ${P.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
                    <Search size={11} color={P.txt3} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      style={{ flex: 1, border: "none", background: "transparent", outline: "none", color: P.txt, fontSize: 12, fontFamily: font, minWidth: 0 }}
                    />
                  </div>
                </div>
              )}
              {/* Options */}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filtered.length === 0 && (
                  <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 11.5, color: P.txt3, fontFamily: font }}>
                    {uniqueOptions.length === 0 ? "Sin registros — crea el primero abajo." : "Sin coincidencias."}
                  </div>
                )}
                {filtered.map(opt => {
                  const active = opt === value;
                  return (
                    <button key={opt} type="button" onClick={() => handlePick(opt)} style={{
                      width: "100%", padding: "9px 12px", background: active ? `${color}14` : "transparent",
                      border: "none", borderLeft: `2px solid ${active ? color : "transparent"}`,
                      display: "flex", alignItems: "center", gap: 9,
                      cursor: "pointer", transition: "background 0.12s",
                      color: active ? "#FFF" : P.txt2, fontSize: 12.5, fontWeight: active ? 600 : 500, fontFamily: font,
                      textAlign: "left",
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}38`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 800, color, fontFamily: fontDisp }}>
                        {opt.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
                      {active && <Check size={13} color={color} strokeWidth={2.8} />}
                    </button>
                  );
                })}
              </div>
              {/* Add new footer */}
              <button type="button" onClick={() => { setAdding(true); setNewVal(query); }} style={{
                width: "100%", padding: "10px 12px", background: `${color}08`, borderTop: `1px solid ${P.border}`, border: "none",
                display: "flex", alignItems: "center", gap: 8,
                cursor: "pointer", transition: "background 0.14s",
                color, fontSize: 12, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.01em",
                textAlign: "left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = `${color}14`}
                onMouseLeave={e => e.currentTarget.style.background = `${color}08`}
              >
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}22`, border: `1px dashed ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Plus size={12} color={color} strokeWidth={2.8} />
                </div>
                <span>{newLabel}</span>
              </button>
            </>
          )}
          {adding && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp, margin: "0 0 7px 2px" }}>{newLabel}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  ref={inputRef}
                  value={newVal}
                  onChange={e => setNewVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } if (e.key === "Escape") { setAdding(false); setNewVal(""); } }}
                  placeholder="Nombre…"
                  style={{ flex: 1, height: 34, padding: "0 11px", borderRadius: 8, background: P.glass, border: `1px solid ${color}44`, color: P.txt, fontSize: 12.5, outline: "none", fontFamily: font, boxSizing: "border-box" }}
                />
                <button type="button" onClick={() => { setAdding(false); setNewVal(""); }} style={{ height: 34, padding: "0 10px", borderRadius: 8, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                  Cancelar
                </button>
                <button type="button" disabled={!newVal.trim()} onClick={handleAdd} style={{ height: 34, padding: "0 12px", borderRadius: 8, background: newVal.trim() ? color : "rgba(255,255,255,0.04)", border: `1px solid ${newVal.trim() ? color : P.border}`, color: newVal.trim() ? "#041016" : P.txt3, fontSize: 11, fontWeight: 800, cursor: newVal.trim() ? "pointer" : "not-allowed", fontFamily: fontDisp, letterSpacing: "0.01em" }}>
                  Guardar
                </button>
              </div>
              <p style={{ fontSize: 9.5, color: P.txt3, margin: "7px 2px 0", fontFamily: font }}>Disponible al registrar otros clientes más adelante.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const KPI = ({ label, value, sub, icon: I, color, T: Tprop }) => {
  const [h, setH] = useState(false);
  const T = Tprop || P;
  const isLight = T !== P;
  const rawC = color || T.accent;
  const isAmber = rawC === T.amber || rawC === "#F59E0B" || rawC === "#D97706";
  const c = isAmber ? T.accent : rawC;

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative", overflow: "hidden",
        padding: "22px 20px 20px",
        borderRadius: 20,
        background: isLight
          ? "rgba(255,255,255,0.88)"
          : "rgba(9,14,24,0.80)",
        backdropFilter: "blur(28px) saturate(110%)",
        WebkitBackdropFilter: "blur(28px) saturate(110%)",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.068)"}`,
        boxShadow: isLight
          ? `inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 16px rgba(15,23,42,0.06)`
          : `inset 0 1px 0 rgba(255,255,255,0.055), 0 8px 32px rgba(0,0,0,0.30)`,
        transition: "transform 0.26s cubic-bezier(.4,0,.2,1), box-shadow 0.26s ease",
        transform: h ? "translateY(-3px)" : "translateY(0)",
        cursor: "default",
      }}
    >
      {/* Neutral hairline — top edge, no color */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: isLight
          ? "linear-gradient(90deg, transparent, rgba(15,23,42,0.10) 40%, rgba(15,23,42,0.10) 60%, transparent)"
          : "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.08) 60%, transparent)",
        pointerEvents: "none",
      }} />

      {/* Icon — top right, bare white */}
      <div style={{
        position: "absolute", top: 18, right: 18,
        width: 32, height: 32, borderRadius: 9,
        background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.055)",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.08)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <I size={15} color={isLight ? "rgba(15,23,42,0.50)" : "rgba(255,255,255,0.55)"} strokeWidth={1.8} />
      </div>

      {/* Label — micro uppercase, wide tracking */}
      <p style={{
        margin: "0 0 14px",
        fontSize: 9.5, fontFamily: fontDisp, fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)",
        whiteSpace: "nowrap",
      }}>{label}</p>

      {/* Hero value — the visual anchor */}
      <p style={{
        margin: 0,
        fontSize: 40, fontWeight: 250,
        letterSpacing: "-0.01em", lineHeight: 1,
        fontFamily: fontDisp,
        color: isLight ? "rgba(15,23,42,0.93)" : "rgba(255,255,255,0.96)",
      }}>{value}</p>

      {/* Sub — left accent bar + muted text */}
      {sub && (
        <div style={{
          marginTop: 14,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{
            width: 2.5, height: 13, borderRadius: 2, flexShrink: 0,
            background: `linear-gradient(180deg, ${c} 0%, ${c}55 100%)`,
          }} />
          <span style={{
            fontSize: 11, fontFamily: fontDisp, fontWeight: 500,
            letterSpacing: "-0.008em",
            color: isLight ? "rgba(15,23,42,0.46)" : "rgba(255,255,255,0.40)",
            whiteSpace: "nowrap",
          }}>{sub}</span>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   DYNAMIC ISLAND
   ════════════════════════════════════════ */
const DynIsland = ({ onExpand, notifications = [], theme = "dark" }) => {
  const isLight = theme === "light";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const msgs = notifications.length > 0 ? notifications : [
    { agent: "Agente Estratégico", text: "Optimización de cierre: Familia Rodríguez.", detail: "Probabilidad de cierre detectada al 92%. Dossier de alta fidelidad preparado para envío inmediato.", c: P.blue, icon: AgentIcons.gerente, btn: "Ejecutar Protocolo", action: "¿Cuáles son mis leads prioritarios hoy?" },
    { agent: "Inteligencia de Datos", text: "Alerta de Mercado: Portofino +32%.", detail: "Demanda inusual detectada. Análisis predictivo recomienda ajuste de precios para maximizar rendimientos.", c: P.emerald, icon: AgentIcons.analista, btn: "Validar Ajuste", action: "Reporte de Riesgo: Portofino" },
    { agent: "Equipo Stratos", text: "Actividad del Equipo: Cecilia y Alexia.", detail: "Cecilia Mendoza cerró venta de $2.1M. Alexia Santillán tiene 3 visitas VIP confirmadas para hoy.", c: P.violet, icon: Crown, btn: "Ver Reporte", action: "Resumen de rendimiento del equipo esta semana" },
    { agent: "Agente de Ventas", text: "Alerta de Riesgo: James Mitchell.", detail: "Inactividad detectada en últimas 72h. Se recomienda activar protocolo de confianza para evitar enfriamiento.", c: P.rose, icon: AgentIcons.asistente, btn: "Enviar Avance", action: "Dossier: James Mitchell" },
  ];

  const expanded = isOpen || selectedNotif;

  /* ── colores aurora según tema ── */
  const MC  = isLight ? "13,154,118"  : "110,231,194";   // mint RGB
  const MC2 = isLight ? "52,211,153"  : "52,211,153";    // teal secundario

  return (
    <>
      {/* ─── PILL — Centro de Inteligencia — Liquid Glass Aurora ───────────
          Tres capas de movimiento simultáneo:
          1. Aurora primaria: blob mint que flota de izq→der (auroraShift)
          2. Aurora secundaria: blob teal contramovimiento (auroraShift2)
          3. Shimmer sweep: rayo de luz diagonal periódico (pillShimmer)
          + Specular top highlight + border glow pulse en dark mode
          ──────────────────────────────────────────────────────────────── */}
      <div
        title="Centro de Inteligencia"
        onClick={() => { if (!expanded) { onExpand?.(); } }}
        style={{
          position: "relative",
          height: 36, width: 226, borderRadius: 50,

          background: isLight
            ? "linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(236,251,246,0.88) 100%)"
            : "linear-gradient(145deg, rgba(20,36,56,0.72) 0%, rgba(8,16,30,0.80) 100%)",

          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",

          border: isLight
            ? "1px solid rgba(255,255,255,0.92)"
            : "1px solid rgba(110,231,194,0.28)",

          boxShadow: isLight
            ? "inset 0 1px 0 rgba(255,255,255,1.0), 0 0 0 1px rgba(13,154,118,0.06), 0 4px 20px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)"
            : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(110,231,194,0.14), 0 0 24px rgba(110,231,194,0.18), 0 8px 32px rgba(0,0,0,0.70), 0 2px 6px rgba(0,0,0,0.50)",

          display: expanded ? "none" : "flex",
          alignItems: "center", justifyContent: "center",
          padding: "0 16px", gap: 0, overflow: "hidden",
          cursor: "pointer",
          transition: "transform 0.24s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s ease, box-shadow 0.22s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.028)";
          e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,1.0)" : "rgba(110,231,194,0.45)";
          e.currentTarget.style.boxShadow = isLight
            ? "inset 0 1px 0 rgba(255,255,255,1.0), 0 0 0 1px rgba(13,154,118,0.10), 0 6px 26px rgba(0,0,0,0.10), 0 2px 5px rgba(0,0,0,0.06)"
            : "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.38), 0 0 0 1px rgba(110,231,194,0.22), 0 0 36px rgba(110,231,194,0.26), 0 10px 38px rgba(0,0,0,0.72), 0 3px 9px rgba(0,0,0,0.52)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,0.92)" : "rgba(110,231,194,0.28)";
          e.currentTarget.style.boxShadow = isLight
            ? "inset 0 1px 0 rgba(255,255,255,1.0), 0 0 0 1px rgba(13,154,118,0.06), 0 4px 20px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)"
            : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(110,231,194,0.14), 0 0 24px rgba(110,231,194,0.18), 0 8px 32px rgba(0,0,0,0.70), 0 2px 6px rgba(0,0,0,0.50)";
        }}
        onMouseDown={e => {
          e.currentTarget.style.transform = "scale(0.965)";
          e.currentTarget.style.transition = "transform 0.10s ease";
        }}
        onMouseUp={e => {
          e.currentTarget.style.transition = "transform 0.24s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s ease, box-shadow 0.22s ease";
          e.currentTarget.style.transform = "scale(1.028)";
        }}
      >
        {/* ── Aurora primaria — blob mint flotante ── */}
        <div style={{
          position: "absolute",
          width: "60%", height: "200%",
          left: "2%", top: "-50%",
          background: isLight
            ? "radial-gradient(ellipse, rgba(13,154,118,0.15) 0%, transparent 68%)"
            : "radial-gradient(ellipse, rgba(110,231,194,0.36) 0%, rgba(52,211,153,0.12) 55%, transparent 72%)",
          animation: "auroraShift 9s ease-in-out infinite",
          pointerEvents: "none",
          filter: isLight ? "blur(6px)" : "blur(5px)",
        }} />

        {/* ── Aurora secundaria — blob teal contramovimiento ── */}
        <div style={{
          position: "absolute",
          width: "50%", height: "180%",
          right: "5%", top: "-40%",
          background: isLight
            ? "radial-gradient(ellipse, rgba(52,211,153,0.10) 0%, transparent 65%)"
            : "radial-gradient(ellipse, rgba(94,234,212,0.24) 0%, rgba(110,231,194,0.08) 55%, transparent 70%)",
          animation: "auroraShift2 12s ease-in-out infinite",
          pointerEvents: "none",
          filter: isLight ? "blur(8px)" : "blur(6px)",
        }} />

        {/* ── Specular arc — borde superior que capta la luz ── */}
        <div style={{
          position: "absolute", top: 0, left: "6%", right: "6%", height: "52%",
          background: isLight
            ? "radial-gradient(ellipse at 50% -8%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.50) 38%, transparent 68%)"
            : "radial-gradient(ellipse at 50% -6%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.10) 40%, transparent 68%)",
          borderRadius: "50% 50% 0 0 / 80% 80% 0 0",
          pointerEvents: "none",
        }} />

        {/* ── Bottom edge shadow — liquid glass depth ── */}
        {!isLight && (
          <div style={{
            position: "absolute", bottom: 0, left: "12%", right: "12%", height: "30%",
            background: "radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.45) 0%, transparent 70%)",
            borderRadius: "0 0 50% 50% / 0 0 80% 80%",
            pointerEvents: "none",
          }} />
        )}

        {/* ── Shimmer sweep — rayo de luz diagonal periódico ── */}
        <div style={{
          position: "absolute", inset: 0,
          background: isLight
            ? "linear-gradient(112deg, transparent 25%, rgba(255,255,255,0.70) 48%, transparent 68%)"
            : "linear-gradient(112deg, transparent 20%, rgba(255,255,255,0.22) 46%, rgba(110,231,194,0.06) 52%, transparent 70%)",
          animation: "pillShimmer 6s cubic-bezier(0.4,0,0.6,1) 1.8s infinite",
          pointerEvents: "none", borderRadius: "inherit",
        }} />

        {/* ── Borde glow pulse — solo dark ── */}
        {!isLight && (
          <div style={{
            position: "absolute", inset: -1, borderRadius: "inherit",
            border: "1px solid rgba(110,231,194,0.30)",
            animation: "borderGlowPulse 3.5s ease-in-out infinite",
            pointerEvents: "none",
          }} />
        )}

        {/* ── Content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 7, width: "100%",
        }}>
          {/* Live dot — doble anillo en dark */}
          <div style={{ position: "relative", width: 6, height: 6, flexShrink: 0 }}>
            {!isLight && (
              <div style={{
                position: "absolute", inset: -3, borderRadius: "50%",
                background: "rgba(52,211,153,0.18)",
                animation: "pulse 2.4s ease-in-out infinite",
              }} />
            )}
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isLight ? "#059669" : "#34D399",
              boxShadow: isLight
                ? "0 0 5px rgba(5,150,105,0.70), 0 0 10px rgba(5,150,105,0.30)"
                : "0 0 7px rgba(52,211,153,1.0), 0 0 14px rgba(52,211,153,0.50), 0 0 24px rgba(52,211,153,0.20)",
              animation: "pulse 2.4s ease-in-out infinite",
            }} />
          </div>

          <span style={{
            fontSize: 12.5,
            color: isLight ? "#0A6448" : "#FFFFFF",
            fontWeight: 600,
            letterSpacing: "-0.028em",
            fontFamily: fontDisp,
            textShadow: isLight ? "none" : "0 1px 8px rgba(0,0,0,0.40), 0 0 16px rgba(110,231,194,0.28)",
          }}>Centro de Inteligencia</span>
        </div>
      </div>

      {/* Expanded state */}
      {expanded && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 99998 }}
            onClick={() => { setIsOpen(false); setSelectedNotif(null); }}
          />
          <div style={{
            position: "fixed", top: 66, left: "50%", transform: "translateX(-50%)",
            zIndex: 99999,
            width: selectedNotif ? 520 : 480,
            borderRadius: 20,
            background: selectedNotif
              ? `radial-gradient(ellipse at top, ${selectedNotif.c}10 0%, #03060F 70%)`
              : "#03060F",
            border: "0.5px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(255,255,255,0.04)",
            overflow: "hidden",
            animation: "fadeSlideDown 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>
            <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

            {isOpen && !selectedNotif && (
              <div style={{ padding: "18px 0 6px" }}>
                {/* Header */}
                <div style={{ padding: "0 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ animation: "stratosAtomSpin 20s linear infinite", filter: "drop-shadow(0 0 5px rgba(110,231,194,0.35))" }}>
                      <StratosAtom size={14} color="#6EE7C2" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.88)", fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Centro de Inteligencia</p>
                      <p style={{ margin: 0, fontSize: 9.5, color: "rgba(255,255,255,0.38)", fontFamily: font, letterSpacing: "0.02em", marginTop: 1 }}>{msgs.length} actualizaciones del equipo IA</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.50)", transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#FFF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.50)"; }}
                  ><X size={13} /></button>
                </div>

                {/* Notification items */}
                <div style={{ padding: "6px 0 10px" }}>
                  {msgs.map((m, i) => (
                    <div key={i} onClick={() => setSelectedNotif(m)}
                      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 20px", cursor: "pointer", transition: "background 0.16s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${m.c}12`, border: `1px solid ${m.c}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <m.icon size={14} color={m.c} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.88)", fontWeight: 600, fontFamily: fontDisp, marginBottom: 2 }}>{m.agent}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.42)", fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</p>
                      </div>
                      <ChevronRight size={13} color="rgba(255,255,255,0.22)" strokeWidth={2} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNotif && (
              <div style={{ padding: "20px", animation: "fadeSlideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${selectedNotif.c}16`, border: `1px solid ${selectedNotif.c}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <selectedNotif.icon size={15} color={selectedNotif.c} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "#FFFFFF", fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{selectedNotif.agent}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: "rgba(255,255,255,0.40)", fontFamily: font, marginTop: 2 }}>Actualización del sistema</p>
                  </div>
                  <button onClick={() => setSelectedNotif(null)} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.55)", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FFF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
                  ><X size={13} /></button>
                </div>

                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, fontFamily: font, marginBottom: 20 }}>{selectedNotif.detail}</p>

                <button
                  onClick={() => { onExpand(selectedNotif.action); setIsOpen(false); setSelectedNotif(null); }}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 12,
                    background: "rgba(255,255,255,0.92)", color: "#06080F",
                    border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: fontDisp, letterSpacing: "0.005em",
                    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: "0 2px 10px rgba(255,255,255,0.12)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,255,255,0.22)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.92)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(255,255,255,0.12)"; }}
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
  "Nuevo Registro":     "#94A3B8",   // slate neutro   — lead recién llegado
  "Primer Contacto":    "#38BDF8",   // sky azul claro — iniciando conversación
  "Seguimiento":        "#22D3EE",   // cyan           — en proceso activo
  "Zoom Agendado":      "#60A5FA",   // azul claro     — cita en calendario (sin morado)
  "Zoom Concretado":    "#4ADE80",   // verde lima     — reunión exitosa ✓
  "Visita Agendada":    "#F59E0B",   // ámbar dorado   — visita próxima
  "Visita Concretada":  "#6EE7C2",   // menta brand    — visita realizada ✓
  "Negociación":        "#FB923C",   // naranja        — en negociación activa
  "Cierre":             "#34D399",   // verde esmeralda— ¡cerrando!
  "Perdido":            "#F87171",   // rojo suave     — perdido (lógico y sin morado)
};

/* ─────────────────────────────────────────
   CRM LEADS DATA  (schema: fecha ingreso, asesor, nombre, tel, estatus,
   presupuesto, proyecto, notas, campaña)
───────────────────────────────────────── */
const leads = [
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
    hot: true,
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
const props = [
  { n: "Gobernador 28", u: 48, s: 31, roi: "24%", pr: "$280K–$1.2M", loc: "Playa del Carmen", st: "Pre-venta", c: P.blue },
  { n: "Monarca 28", u: 72, s: 45, roi: "19%", pr: "$180K–$650K", loc: "Playa del Carmen", st: "Construcción", c: P.amber },
  { n: "Portofino", u: 36, s: 12, roi: "32%", pr: "$520K–$2.1M", loc: "Puerto Aventuras", st: "Lanzamiento", c: P.emerald },
];
const team = [
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

const getResp = (t, leadData, liveLeads) => {
  const l = t.toLowerCase();
  const allLeads = liveLeads && liveLeads.length ? liveLeads : leads; // Usa datos en vivo si están disponibles

  // — CRM direct brief — usa datos en vivo si se pasan, o busca en el array —
  if (l.startsWith("__crm__") || leadData) {
    const lead = leadData || allLeads.find(le => l.includes(le.n.toLowerCase()) || l.includes(le.n.split(" ")[0].toLowerCase()));
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
          ...(hasNotes ? [{ label: "Expediente del cliente", val: lead.notas.replace(/[📍🎯💰👤📋⚠️✅]/g, "").substring(0, 180) + (lead.notas.length > 180 ? "…" : ""), i: FileText, c: P.txt2 }] : []),
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
  const lead = allLeads.find(le => {
    const parts = le.n.toLowerCase().split(" ");
    return l.includes(le.n.toLowerCase()) || parts.some(p => p.length > 3 && l.includes(p));
  });

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
  if (l.includes("priorit") || l.includes("hoy") || l.includes("80/20") || l.includes("importante") || l.includes("focus") || l.includes("cerrar") || l.includes("listo")) {
    const hot = [...allLeads].filter(x => x.isNew || x.sc >= 80 || x.st === "Zoom Agendado").sort((a,b) => b.sc - a.sc).slice(0, 3);
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
    const newLeads = allLeads.filter(x => x.isNew);
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
    const zooms = allLeads.filter(x => x.st === "Zoom Agendado" || x.st === "Zoom Concretado");
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

  // — Inactivity — using live data
  if (l.includes("inactividad") || l.includes("inactiv") || l.includes("sin actividad") || l.includes("olvidado")) {
    const inactive = [...allLeads].filter(x => x.daysInactive > 4 && x.st !== "Cierre" && x.st !== "Perdido").sort((a,b) => b.daysInactive - a.daysInactive).slice(0, 4);
    return {
      content: `⚠️ **${inactive.length} clientes con inactividad crítica** — requieren contacto inmediato:`,
      metrics: inactive.map((x, i) => ({
        label: `${x.n} · ${x.st} · ${x.daysInactive}d inactivo`,
        val: `Acción sugerida: ${x.nextAction || "Llamar o enviar mensaje de seguimiento"}`,
        i: [AlertCircle, AlertTriangle, Timer, Phone][i] || AlertCircle,
        c: x.daysInactive >= 10 ? P.rose : x.daysInactive >= 7 ? "#FF6B6B" : P.amber,
      })),
      follow: `Reactivar estos clientes esta semana puede recuperar hasta **$${(inactive.reduce((s,x) => s+(x.presupuesto||0),0)/1000000).toFixed(1)}M** en pipeline.`,
      btn: "Reactivar todos",
      action: "Ejecutar campaña de reactivación para clientes inactivos",
    };
  }

  // — Team report — using live data
  if (l.includes("rendimiento") || l.includes("equipo") || l.includes("reporte") || l.includes("métricas")) {
    const asesoresMap = {};
    allLeads.forEach(x => {
      if (!asesoresMap[x.asesor]) asesoresMap[x.asesor] = { leads: 0, zooms: 0, cierres: 0, totalSc: 0 };
      asesoresMap[x.asesor].leads++;
      if (x.st === "Zoom Agendado" || x.st === "Zoom Concretado") asesoresMap[x.asesor].zooms++;
      if (x.st === "Cierre") asesoresMap[x.asesor].cierres++;
      asesoresMap[x.asesor].totalSc += x.sc;
    });
    const asesorList = Object.entries(asesoresMap).map(([name, d]) => ({ name, ...d, avgSc: Math.round(d.totalSc / d.leads) })).sort((a,b) => b.avgSc - a.avgSc);
    return {
      content: `📊 **Reporte del equipo** — ${allLeads.length} clientes · ${asesorList.length} asesores activos:`,
      metrics: asesorList.slice(0, 4).map((a, i) => ({
        label: `${a.name.split(" ")[0]} · ${a.leads} leads · Score promedio ${a.avgSc}`,
        val: `Zooms: ${a.zooms} · Cierres: ${a.cierres} · Pipeline activo: ${a.leads - a.cierres}`,
        i: [Crown, Trophy, Target, Users][i] || Users,
        c: [P.emerald, P.blue, P.cyan, P.violet][i] || P.txt2,
      })),
      follow: `El equipo mantiene un score promedio de **${Math.round(allLeads.reduce((s,x)=>s+x.sc,0)/allLeads.length)}** puntos. ¿Quieres el análisis detallado por asesor?`,
      btn: "Ver análisis completo",
      action: "Análisis completo de rendimiento por asesor",
    };
  }

  // — Inventory —
  if (l.includes("inventario") || l.includes("unidades") || l.includes("quedan") || l.includes("disponible")) return responses.inventory;

  // — Pipeline / cierre macro —
  if (l.includes("pipeline") || l.includes("cierre") || l.includes("macro")) return responses.macro_cierre;

  return responses.default;
};

/* ════════════════════════════════════════
   VIEWS
   ════════════════════════════════════════ */

/* ─── Score bar helper ─── */




/* ════════════════════════════════════════
   IA CRM — CALL CENTER INTELLIGENCE
   ════════════════════════════════════════ */

/* Professional Atom Logo for IA CRM */

/* ════════════════════════════════════════
   CHAT PANEL
   ════════════════════════════════════════ */
const Chat = ({ open, onClose, msgs, setMsgs, inp, setInp }) => {
  const endRef = useRef(null);
  const [typing, setTyping] = useState(false);
  const [rec, setRec] = useState(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const send = (t) => {
    if (!t?.trim()) return;
    setMsgs(p => [...p, { role: "u", text: t.trim() }]);
    setInp(""); setTyping(true);
    setTimeout(() => {
      const r = getResp(t);
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
  { id: "c",     l: "CRM",       i: Users     },
  { id: "lp",    l: "Create",    i: Hexagon   },
  { id: "d",     l: "Comando",   i: Activity  },
  { id: "e",     l: "ERP",       i: Building2 },
  { id: "ia",    l: "iAgents",   i: Atom      },
  { id: "a",     l: "Asesores",  i: Trophy,   more: true },
  { id: "fa",    l: "Finanzas",  i: Landmark, more: true },
  { id: "rrhh",  l: "Personas",  i: UserCheck,more: true },
  { id: "planes",l: "Planes",    i: CreditCard,more: true },
  { id: "admin", l: "Usuarios",  i: Shield,   more: true, adminOnly: true },
];

/* ════════════════════════════════════════
   LANDING PAGES — GENERADOR PREMIUM v2
   Propiedades Reales Riviera Maya 2025-2026
   ════════════════════════════════════════ */

/* WriterSection: Rich message composer for client personalization */

/* ════════════════════════════════════════
   FINANZAS & ADMINISTRACIÓN
   Sistema Contable-Fiscal · México 2026
   CFDI 4.0 | SAT | NIF | ISR | IVA | IMSS
   ════════════════════════════════════════ */

/* ─── Ícono átomo 3 aros IA (pro SVG) ─── */

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
  const { user: me } = useAuth();
  const [users, setUsers]           = useState(() => adminGetAllUsers());
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [modal, setModal]           = useState(null); // null | { mode: "create"|"edit"|"reset", user? }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // userId
  const [form, setForm]             = useState({});
  const [formErr, setFormErr]       = useState("");
  const [formOk, setFormOk]         = useState("");

  const isSuper = me?.role === "super_admin";
  const canManage = ["super_admin", "admin"].includes(me?.role);

  const refresh = () => setUsers(adminGetAllUsers());

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
            {Object.entries(ROLE_META).map(([k, m]) => <option key={k} value={k} style={{ background: "#111318" }}>{m.label}</option>)}
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
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(400px, 92vw)", background: "#111318", border: `1px solid ${P.rose}30`, borderRadius: 20, boxShadow: "0 32px 64px rgba(0,0,0,0.7)", padding: "26px 28px", animation: "fadeIn 0.2s ease" }}>
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
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(500px, 94vw)", background: "#111318", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)", animation: "fadeIn 0.22s ease" }}>
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
                        <option key={r.key} value={r.key} style={{ background: "#111318" }}>{r.label} — Nivel {r.level}</option>
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
  d: "Comando", c: "CRM", ia: "iAgents", e: "ERP",
  a: "Asesores", lp: "Campañas", fa: "Finanzas",
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

const IAOSIsland = ({ leadsData, isLight, fontDisp }) => {
  const hot      = leadsData.filter(l => l.hot).length;
  const waAct    = leadsData.filter(l => l.phone && l.daysInactive <= 3).length;
  const totalPipe = (leadsData.reduce((s, l) => s + (l.presupuesto || 0), 0) / 1e6).toFixed(1);

  const phrases = [
    `Calificando ${hot} leads`,
    `$${totalPipe}M en pipeline`,
    `${waAct} chats activos`,
  ];

  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % phrases.length); setShow(true); }, 300);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: isLight ? "rgba(0,0,0,0.028)" : "rgba(255,255,255,0.042)",
      borderRadius: 9, padding: "5px 12px 5px 10px",
      border: `1px solid ${isLight ? "rgba(0,0,0,0.048)" : "rgba(255,255,255,0.065)"}`,
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* IAOS label */}
      <span style={{
        fontSize: 9, fontFamily: fontDisp, fontWeight: 800,
        letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1,
        color: isLight ? "rgba(13,154,118,0.55)" : "rgba(110,231,194,0.50)",
        flexShrink: 0,
      }}>IAOS</span>

      {/* Single power-on dot */}
      <div style={{
        width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
        background: "#34D399",
        boxShadow: "0 0 7px rgba(52,211,153,0.90), 0 0 14px rgba(52,211,153,0.40)",
        animation: "pulse 2.4s ease-in-out infinite",
      }} />

      {/* Sliding status text — fixed width prevents layout shift between phrases */}
      <div style={{ position: "relative", overflow: "hidden", height: 14, width: 132, flexShrink: 0 }}>
        <span style={{
          display: "block",
          fontSize: 10.5, fontFamily: fontDisp, fontWeight: 400,
          letterSpacing: "-0.015em", whiteSpace: "nowrap",
          color: isLight ? "rgba(15,23,42,0.58)" : "rgba(255,255,255,0.65)",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}>{phrases[idx]}</span>
      </div>
    </div>
  );
};

export default function App() {
  const { user, login, logout } = useAuth();
  const isAsesorRole = !["super_admin","admin","director","ceo"].includes(user?.role);
  const canSeeAllGlobal = ["super_admin","admin","director"].includes(user?.role);
  const [v, setV] = useState(isAsesorRole ? "c" : "d");
  const [co, setCo] = useState(false);
  const [autoOpenPriority1, setAutoOpenPriority1] = useState(0);
  const [sidebarMore, setSidebarMore] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [notifs, setNotifs] = useState([]);

  // ── THEME (dark ↔ light) — global para CRM, header, sidebar ──
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("stratos_crm_theme") || "dark"; }
    catch { return "dark"; }
  });
  const setTheme = useCallback((next) => {
    setThemeState(next);
    try { localStorage.setItem("stratos_crm_theme", next); } catch {}
  }, []);
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  // ── leadsData global — compartido entre Dash y CRM ───────────────────────
  // Inicializamos con TODOS los leads; el filtro por rol lo hace visibleLeads en CRM
  const [leadsData, setLeadsData] = useState(leads);
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaTab, setMetaTab] = useState("acciones");
  const [metaActions, setMetaActions] = useState(() =>
    leads.filter(l => l.nextAction).map(l => ({
      id: l.id, text: l.nextAction, lead: l.n,
      asesor: l.asesor.split(" ")[0],
      date: l.nextActionDate, done: false,
      priority: l.hot ? "urgente" : l.daysInactive >= 7 ? "alto" : "normal",
      assignee: l.asesor,
      assigneeType: "human",
    }))
  );
  const [metaNewText, setMetaNewText] = useState("");
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [metaPlan, setMetaPlan] = useState({
    coreValues: ["Integridad en cada transacción", "Excelencia en experiencia de lujo", "Confianza y transparencia total", "Resultados medibles y reales"],
    purpose: "Conectar inversionistas globales con las mejores propiedades de lujo en la Riviera Maya, creando riqueza y legado generacional.",
    xfactor: "Única firma con expertise legal completo USA-México + acceso exclusivo a propiedades pre-mercado.",
    swt: [
      { type: "F", text: "Acceso exclusivo a propiedades pre-mercado premium" },
      { type: "F", text: "Red activa de +200 clientes referidos HNW" },
      { type: "D", text: "Proceso de cierre 52 días (meta: 45)" },
      { type: "D", text: "Equipo pequeño vs. competencia (7 vs. 25+ agentes)" },
      { type: "T", text: "8% apreciación anual PDC · Nómadas digitales en auge" },
      { type: "T", text: "Crypto payments en real estate +15% deals 2026" },
    ],
    bhag: "#1 bróker de lujo en la Riviera Maya · $500M en transacciones anuales para 2030",
    targets3yr: ["$200M pipeline activo", "15 asesores élite en equipo", "40% cierres por referido", "Reconocimiento internacional de marca"],
    sandbox: { zona: "Playa del Carmen · Riviera Maya", precio: "$1.5M – $6.5M USD", cliente: "HNW 45–65 años", origen: "EEUU · Canadá · Latam · EU", producto: "Beachfront · Penthouses · Resort" },
    brandPromises: [
      { title: "Experiencia sin fricciones", sub: "Legal MX-USA resuelto para ti" },
      { title: "ROI con inteligencia real", sub: "Proyecciones reales de plusvalía" },
      { title: "Servicio clase mundial", sub: "Concierge personal 360°" },
    ],
    rocks: [
      { n: "Cerrar 12 propiedades $2M+", owner: "Todo el equipo", pct: 42 },
      { n: "Lanzar Red Inversionistas PDC", owner: "Dir. Desarrollo", pct: 65 },
      { n: "Contratar 3 asesores élite", owner: "RRHH", pct: 30 },
      { n: "Reducir cierre a 45 días", owner: "Operaciones", pct: 55 },
    ],
    anualTheme: "El Año del Inversionista",
    anualThemeDesc: "Cultivar capital institucional y compradores recurrentes. Bono de equipo al alcanzar $50M.",
    goal: 48_000_000,
  });
  const [metaProtocol, setMetaProtocol] = useState({
    stages: [
      { id: 1, name: "Nuevo Registro", color: "#34D399", sla: "< 2h",
        actions: ["Llamada de bienvenida inmediata", "Enviar presentación de proyectos", "Calificar BANT", "Registrar notas en CRM"] },
      { id: 2, name: "Primer Contacto", color: "#60A5FA", sla: "< 24h",
        actions: ["Zoom/llamada de descubrimiento 30 min", "Identificar proyecto de interés", "Confirmar presupuesto y timeline", "Enviar dossier del proyecto"] },
      { id: 3, name: "Zoom Agendado", color: "#A78BFA", sla: "Confirmado",
        actions: ["Preparar presentación personalizada", "Enviar recordatorio 24h antes", "Tener comparativos listos", "Confirmar asistencia 2h antes"] },
      { id: 4, name: "Zoom Concretado", color: "#4ADE80", sla: "< 48h",
        actions: ["Enviar resumen y propuesta formal", "Responder dudas por escrito", "Proponer visita presencial", "Seguimiento en 24h"] },
      { id: 5, name: "Negociación", color: "#FB923C", sla: "< 24h",
        actions: ["Revisar condiciones de pago", "Conectar con notaría aliada", "Validar costos notariales", "Preparar expediente de cierre"] },
      { id: 6, name: "Cierre", color: "#F59E0B", sla: "Inmediato",
        actions: ["Enviar contrato para revisión", "Coordinar firma con notaría", "Confirmar depósito inicial", "Celebrar + solicitar referido"] },
    ],
    qualification: [
      { label: "Budget", q: "¿Cuál es tu presupuesto disponible para esta inversión?" },
      { label: "Authority", q: "¿Eres tú quien toma la decisión final?" },
      { label: "Need", q: "¿Buscas inversión, disfrute personal o ambos?" },
      { label: "Timeline", q: "¿En qué plazo planeas concretar la compra?" },
      { label: "Financing", q: "¿Tienes capital disponible o necesitas financiamiento?" },
    ],
    objections: [
      { obj: "Está muy caro", resp: "El precio refleja la ubicación premium y el ROI proyectado de 8% anual. ¿Cuál es tu referencia de precio?" },
      { obj: "Necesito pensarlo", resp: "Entendido. ¿Qué información adicional necesitas para decidir? Tengo disponibilidad esta semana." },
      { obj: "No conozco la zona", resp: "Perfecto, hagamos un tour virtual o te agendo una visita VIP con traslado incluido. ¿Cuándo tienes disponibilidad?" },
      { obj: "¿Y si no se vende?", resp: "Tiene 8% apreciación anual + programa de renta vacacional con 10-12% ROI. ¿Te muestro los números?" },
      { obj: "Quiero esperar precios bajos", resp: "En PDC los precios suben 8% anual. Cada mes de espera equivale a pagar más. ¿Te muestro la proyección?" },
    ],
    slas: [
      { trigger: "Nuevo lead registrado", resp: "Primer contacto", time: "2 horas", owner: "Asesor asignado" },
      { trigger: "Zoom concretado", resp: "Envío de propuesta", time: "24 horas", owner: "Asesor asignado" },
      { trigger: "Sin actividad 5+ días", resp: "Reactivación activa", time: "Inmediato", owner: "Director de Ventas" },
      { trigger: "Negociación activa", resp: "Seguimiento diario", time: "24 horas", owner: "Asesor + Director" },
    ],
    objetivo: "Convertir leads en ventas mediante un proceso claro, rápido y consistente.",
    reglaBase: "Todo lead debe avanzar, seguir en proceso o cerrarse. Si no, está perdido.",
    principios: ["Responder rápido", "Calificar correctamente", "Mover al siguiente paso", "Dar seguimiento constante", "Registrar todo"],
    reglaRegistro: "Lo que no está registrado en el CRM, no existe.",
    velocidadIdeal: "< 5 minutos",
    velocidadMax: "30 minutos",
    flujoSteps: [
      { n: "Contacto Inicial", desc: "Objetivo: obtener respuesta", action: "Mensaje + llamada. Sin respuesta → mensaje breve + siguiente intento." },
      { n: "Calificación", desc: "Objetivo: entender al cliente", action: "Nombre · presupuesto · zona · objetivo · tiempo · ubicación · objeciones" },
      { n: "Avance", desc: "Toda conversación termina en un siguiente paso", action: "Zoom agendado · Recorrido agendado · Seguimiento con fecha definida" },
      { n: "Registro", desc: "Después de cada interacción", action: "Registrar en Stratos AI: resumen · etapa · próxima acción · fecha · nivel del lead" },
    ],
    pipelineStages: ["Lead nuevo", "Contactado", "Conversación", "Zoom agendado", "Recorrido", "Seguimiento", "Apartado", "Venta cerrada", "Post-venta", "Referidos"],
    reglasOp: ["Todo lead tiene próxima acción y fecha", "3 intentos sin respuesta → riesgo", "24h sin avance → alerta", "5 días sin actividad → frío"],
    seguimientoFases: [
      { range: "1–5 intentos", desc: "Contacto y respuesta" },
      { range: "6–15 intentos", desc: "Interés y valor" },
      { range: "16–30 intentos", desc: "Confianza y decisión" },
      { range: "31–45 intentos", desc: "Cierre o reactivación" },
    ],
    seguimientoFreq: [
      { tipo: "Caliente", freq: "cada 24h", color: "#EF4444" },
      { tipo: "Medio",    freq: "cada 48h", color: "#F59E0B" },
      { tipo: "Frío",     freq: "cada 3–5 días", color: "#60A5FA" },
    ],
    kpis: [
      { cat: "Actividad",  color: "#60A5FA", items: ["Tiempo de respuesta", "Contactos diarios", "Seguimientos activos"] },
      { cat: "Conversión", color: "#34D399", items: ["Zooms realizados", "Recorridos agendados", "Cierres del mes"] },
      { cat: "Calidad",    color: "#A78BFA", items: ["Leads sin seguimiento", "Registros incompletos"] },
      { cat: "Resultado",  color: "#FB923C", items: ["Ventas cerradas", "Ingresos generados"] },
    ],
    alertas: ["Lead sin contacto", "Seguimiento vencido", "Lead caliente sin avance", "Cliente sin próxima acción"],
    errores: ["No registrar en CRM", "No dar seguimiento", "No definir siguiente paso", "Responder tarde", "No calificar al lead"],
    principioFinal: "El dinero está en el seguimiento.",
    cierre: "Un lead solo se cierra si: compra, se descarta con motivo claro, o deja de ser viable.",
  });

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
    // Chat reserved for future use — currently unused from header buttons
    if (t) setTimeout(() => {
      const displayText = leadData ? `Analizar expediente de ${leadData.n}` : t;
      setMsgs(p => [...p, { role: "u", text: displayText }]);
      setTimeout(() => { setMsgs(p => [...p, { role: "a", ...getResp(t, leadData, leadsData) }]); }, 1105);
    }, 150);
  }, [leadsData]);

  // Header buttons: Centro de Inteligencia + Agent Orb → open actual priority #1 from CRM
  const openPriorityLead = useCallback(() => {
    setV("c");
    setAutoOpenPriority1(n => n + 1);
  }, []);

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <div style={{
      height: "100vh", display: "flex", fontFamily: font,
      color: T.txt,
      background: isLight
        ? `radial-gradient(1400px 900px at 50% -10%, rgba(13,154,118,0.10) 0%, rgba(13,154,118,0.04) 35%, transparent 65%),
           radial-gradient(1200px 800px at 50% 110%, rgba(20,184,146,0.08) 0%, rgba(20,184,146,0.03) 35%, transparent 65%),
           linear-gradient(180deg, #F4F9F6 0%, #F8FBF9 45%, #F4F9F6 100%)`
        : `radial-gradient(1400px 700px at 50% -8%, rgba(52,211,153,0.028) 0%, transparent 58%),
           #0C0E14`,
      transition: "background 0.3s ease, color 0.3s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .topbar-shimmer{background-size:300% 100%;animation:shimmer 2.4s linear infinite}
        .topbar-static{background-size:100%}
        .widget-shimmer{animation:pillShimmer 5s ease-in-out infinite}
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wave{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes atomSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes agentOrbBreathe{
          0%,100%{box-shadow:0 2px 8px ${T.accent}40,0 6px 20px ${T.accent}38,0 0 0 0 ${T.accent}44,inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(0,0,0,0.15)}
          50%{box-shadow:0 2px 8px ${T.accent}55,0 8px 28px ${T.accent}60,0 0 0 6px ${T.accent}18,inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -1px 0 rgba(0,0,0,0.15)}
        }
        @keyframes priorityBreathe{
          0%,100%{box-shadow:0 0 0 0 ${T.accent}40,0 0 14px ${T.accent}55}
          50%{box-shadow:0 0 0 6px ${T.accent}00,0 0 22px ${T.accent}88}
        }
        @keyframes scanLine{0%{top:0}100%{top:100%}}
        @keyframes stepFade{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes modalIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
      `}</style>

      {/* ══ Sidebar — Apple-style Navigation ══ */}
      <div style={{
        width: 72, flexShrink: 0, zIndex: 10,
        borderRight: `1px solid ${isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 0, paddingBottom: 0,
        position: "relative", overflow: "hidden",
        background: isLight ? "rgba(246,248,247,0.98)" : "rgba(5,7,13,0.98)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        boxShadow: isLight
          ? "1px 0 0 rgba(0,0,0,0.05)"
          : "1px 0 0 rgba(255,255,255,0.04), 8px 0 28px rgba(0,0,0,0.30)",
      }}>

        {/* ══ TOP: Atom identity + LIVE badge ══ */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 11, paddingBottom: 10, flexShrink: 0, gap: 6,
        }}>
          {/* Atom — no circle, pure spinning icon */}
          <div style={{ animation: "atomSpin 16s linear infinite",
            filter: isLight
              ? "drop-shadow(0 0 5px rgba(13,154,118,0.45)) drop-shadow(0 0 12px rgba(52,211,153,0.18))"
              : "drop-shadow(0 0 4px rgba(255,255,255,0.40)) drop-shadow(0 0 10px rgba(255,255,255,0.10))",
          }}>
            <StratosAtomHex
              size={30}
              color={isLight ? "#0D9A76" : "#FFFFFF"}
              edge={isLight ? "#34D399" : "#C8DED8"}
            />
          </div>

          {/* LIVE badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "#34D399",
              boxShadow: "0 0 5px rgba(52,211,153,0.80), 0 0 10px rgba(52,211,153,0.30)",
              animation: "pulse 2.2s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 7, fontFamily: fontDisp, fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: isLight ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.28)",
              lineHeight: 1,
            }}>Live</span>
          </div>

          {/* Separator */}
          <div style={{
            width: 28, height: 1,
            background: isLight
              ? "linear-gradient(90deg, transparent, rgba(13,154,118,0.18), transparent)"
              : "linear-gradient(90deg, transparent, rgba(110,231,194,0.12), transparent)",
          }} />
        </div>

        {/* ── Nav items — vertically centered ── */}
        <div style={{
          flex: 1, width: "100%",
          overflowY: "auto", overflowX: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center",
          paddingBottom: 4, gap: 6,
        }}>
          {(() => {
            const NavBtn = ({ n }) => {
              const a = v === n.id;
              const isAdmin = n.adminOnly;
              const hasAccess = MODULE_ROLES[n.id]?.includes(user?.role) ?? true;
              const mintC = isAdmin ? "#A78BFA" : "#6EE7C2";
              const activeColor = isAdmin ? "#A78BFA" : (isLight ? T.accent : mintC);
              return (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 4, width: "100%", padding: "0 8px",
                }}>
                  <button
                    onClick={() => { setV(n.id); if (n.more) setSidebarMore(true); }}
                    title={n.l + (!hasAccess ? " · Sin acceso" : "")}
                    style={{
                      width: 48, height: 40, borderRadius: 12,
                      cursor: hasAccess ? "pointer" : "not-allowed",
                      opacity: hasAccess ? 1 : 0.32,
                      border: "none", outline: "none",
                      background: a
                        ? (isLight ? `${T.accent}18` : "rgba(110,231,194,0.11)")
                        : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.18s ease, transform 0.15s ease",
                      position: "relative",
                    }}
                    onMouseEnter={e => {
                      if (!a && hasAccess) {
                        e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
                        e.currentTarget.style.transform = "scale(1.04)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!a) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.transform = "scale(1)";
                      }
                    }}
                    onMouseDown={e => { if (hasAccess) e.currentTarget.style.transform = "scale(0.94)"; }}
                    onMouseUp={e => { if (hasAccess && !a) e.currentTarget.style.transform = "scale(1.04)"; }}
                  >
                    {/* Active left accent bar */}
                    {a && (
                      <div style={{
                        position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                        width: 3, height: 20, borderRadius: "0 3px 3px 0",
                        background: isAdmin ? "#A78BFA" : "#6EE7C2",
                        boxShadow: isAdmin ? "0 0 8px rgba(167,139,250,0.60)" : "0 0 8px rgba(110,231,194,0.55)",
                      }} />
                    )}
                    <n.i
                      size={20}
                      color={a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.32)")}
                      strokeWidth={a ? 1.8 : 1.5}
                    />
                  </button>
                  <span style={{
                    fontSize: 7, fontFamily: fontDisp, fontWeight: a ? 600 : 400,
                    letterSpacing: a ? "0.01em" : "0.005em", textAlign: "center",
                    color: a ? activeColor : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.22)"),
                    lineHeight: 1, userSelect: "none",
                    transition: "color 0.18s ease",
                  }}>{n.l}</span>
                </div>
              );
            };

            const primary   = nav.filter(n => !n.more);
            const secondary = nav.filter(n => n.more && (!n.adminOnly || ["super_admin","admin"].includes(user?.role)));
            const hasActiveMore = secondary.some(n => n.id === v);

            // ── Live plan metrics — reactive to leadsData ──────────────────
            const GOAL        = 48_000_000;
            const activeLeads = leadsData.filter(l => l.presupuesto > 0);
            const totalPipe   = activeLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
            const pc          = Math.min(100, Math.round((totalPipe / GOAL) * 100));
            const avgScore    = activeLeads.length
              ? Math.round(activeLeads.reduce((s, l) => s + (l.sc || 0), 0) / activeLeads.length)
              : 0;
            const fmt = n => n >= 1e6 ? `$${(n/1e6).toFixed(1).replace(/\.0$/,"")}M` : `$${(n/1e3).toFixed(0)}K`;

            return (
              <>
                {/* ── Live Plan metrics — widget ── */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  paddingBottom: 10, width: "100%",
                }}>
                  {/* Card — Liquid Glass (light) / Dark gradient + rim glow (dark) */}
                  <div onClick={() => setMetaOpen(true)} style={{
                    position: "relative",
                    width: "calc(100% - 14px)",
                    borderRadius: 19,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: isLight
                      ? "rgba(255,255,255,0.62)"
                      : "linear-gradient(155deg, #0D1E18 0%, #080F10 55%, #040810 100%)",
                    backdropFilter: isLight ? "blur(32px) saturate(180%)" : "none",
                    WebkitBackdropFilter: isLight ? "blur(32px) saturate(180%)" : "none",
                    border: isLight
                      ? "1px solid rgba(255,255,255,0.92)"
                      : "1px solid rgba(52,211,153,0.22)",
                    boxShadow: isLight
                      ? "inset 0 1.5px 0 rgba(255,255,255,1), 0 6px 28px rgba(13,154,118,0.10)"
                      : [
                          "inset 0 1px 0 rgba(52,211,153,0.38)",
                          "inset 0 -1px 0 rgba(0,0,0,0.40)",
                          "inset 1px 0 0 rgba(52,211,153,0.10)",
                          "inset -1px 0 0 rgba(52,211,153,0.10)",
                          "0 0 0 1px rgba(52,211,153,0.06)",
                          "0 0 28px rgba(52,211,153,0.10)",
                          "0 16px 48px rgba(0,0,0,0.70)",
                        ].join(", "),
                    padding: "11px 9px 12px",
                  }}>
                    {/* Light: specular sheen | Dark: green rim gradient at top */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "45%",
                      background: isLight
                        ? "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)"
                        : "linear-gradient(180deg, rgba(52,211,153,0.07) 0%, transparent 100%)",
                      pointerEvents: "none", borderRadius: "20px 20px 0 0",
                    }} />
                    {/* Light: shimmer sweep | Dark: none */}
                    {isLight && (
                      <div className="widget-shimmer" style={{
                        position: "absolute", top: 0, bottom: 0, left: 0, width: "60%",
                        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
                        pointerEvents: "none",
                      }} />
                    )}
                    {/* Ambient mint glow — bottom */}
                    <div style={{
                      position: "absolute", bottom: -6, left: "50%",
                      transform: "translateX(-50%)",
                      width: 72, height: 40,
                      background: isLight
                        ? "radial-gradient(ellipse, rgba(13,154,118,0.18) 0%, transparent 70%)"
                        : "radial-gradient(ellipse, rgba(52,211,153,0.22) 0%, transparent 70%)",
                      filter: "blur(12px)", pointerEvents: "none",
                    }} />

                    {/* Stats row — TOP, space-between */}
                    <div style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between",
                      position: "relative", zIndex: 1, marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 7.5, fontFamily: fontDisp, fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: isLight ? "rgba(15,23,42,0.46)" : "rgba(255,255,255,0.38)",
                      }}>{fmt(totalPipe)}</span>
                      <span style={{
                        fontSize: 7.5, fontFamily: fontDisp, fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: isLight ? "rgba(13,154,118,0.82)" : "rgba(52,211,153,0.72)",
                      }}>{avgScore}</span>
                    </div>

                    {/* Hero number — clean, no % */}
                    <span style={{
                      fontSize: 33, fontWeight: 200, fontFamily: fontDisp,
                      letterSpacing: "-0.04em", lineHeight: 1,
                      color: isLight ? "#082818" : "#FFFFFF",
                      display: "block", position: "relative", zIndex: 1,
                    }}>{pc}</span>

                    {/* Progress bar */}
                    <div style={{
                      width: "100%", height: 2.5, borderRadius: 99,
                      background: isLight ? "rgba(13,154,118,0.09)" : "rgba(255,255,255,0.08)",
                      marginTop: 9, overflow: "hidden", position: "relative", zIndex: 1,
                    }}>
                      <div style={{
                        width: `${pc}%`, height: "100%", borderRadius: 99,
                        background: isLight
                          ? "linear-gradient(90deg, #0D9A76, #34D399)"
                          : "linear-gradient(90deg, #34D399, #6EE7C2)",
                        boxShadow: isLight ? "none" : "0 0 8px rgba(52,211,153,0.55)",
                        transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>

                    {/* META label — bottom */}
                    <span style={{
                      fontSize: 5.5, fontWeight: 700, fontFamily: fontDisp,
                      letterSpacing: "0.17em", textTransform: "uppercase",
                      color: isLight ? "rgba(13,154,118,0.48)" : "rgba(52,211,153,0.36)",
                      display: "block", marginTop: 8, position: "relative", zIndex: 1,
                    }}>META</span>
                  </div>

                  {/* Separator */}
                  <div style={{
                    width: 32, height: 1, marginTop: 10,
                    background: isLight
                      ? "linear-gradient(90deg, transparent, rgba(15,23,42,0.07), transparent)"
                      : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
                  }} />
                </div>

                {/* Primary apps — always visible */}
                {primary.map(n => <NavBtn key={n.id} n={n} />)}

                {/* ── More apps toggle — Apple minimal ── */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 4, width: "100%", padding: "0 8px" }}>
                  <div style={{ height: 1, width: 32, background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)" }} />
                  <button
                    onClick={() => setSidebarMore(s => !s)}
                    title={sidebarMore ? "Ocultar" : "Más"}
                    style={{
                      width: 48, height: 30, borderRadius: 10, border: "none",
                      background: (sidebarMore || hasActiveMore)
                        ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.09)")
                        : "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      transition: "background 0.18s ease, transform 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = (sidebarMore || hasActiveMore) ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.09)") : "transparent"; }}
                  >
                    <ChevronDown
                      size={13}
                      color={(sidebarMore || hasActiveMore) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.25)")}
                      strokeWidth={1.8}
                      style={{ transform: sidebarMore ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.26s cubic-bezier(0.34,1.56,0.64,1)" }}
                    />
                  </button>
                  <span style={{
                    fontSize: 7, fontFamily: fontDisp, fontWeight: 400,
                    letterSpacing: "0.01em", userSelect: "none",
                    color: (sidebarMore || hasActiveMore) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.28)" : "rgba(255,255,255,0.20)"),
                    transition: "color 0.18s ease",
                  }}>
                    {sidebarMore ? "Menos" : "Más"}
                  </span>
                </div>

                {/* Secondary apps — animated expand/collapse */}
                <div style={{
                  width: "100%", overflow: "hidden",
                  maxHeight: sidebarMore ? `${secondary.length * 66}px` : "0px",
                  opacity: sidebarMore ? 1 : 0,
                  transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.26s ease",
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <div style={{ height: 1, width: 34, background: isLight ? "rgba(13,154,118,0.08)" : "rgba(255,255,255,0.05)", margin: "4px 0 4px" }} />
                  {secondary.map(n => <NavBtn key={n.id} n={n} />)}
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Bottom: System button ── */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 12 }}>
          <div style={{ height: 1, width: 34, background: isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)", margin: "4px auto 8px" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <button
              title={["super_admin","admin"].includes(user?.role) ? "Gestión de Usuarios" : "Configuración"}
              onClick={() => ["super_admin","admin"].includes(user?.role) ? setV("admin") : null}
              style={{
                width: 44, height: 44, borderRadius: 13, cursor: "pointer",
                background: v === "admin"
                  ? "rgba(167,139,250,0.14)"
                  : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)"),
                border: v === "admin"
                  ? "1px solid rgba(167,139,250,0.28)"
                  : `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isLight
                  ? "inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(15,23,42,0.04)"
                  : "inset 0 1px 0 rgba(255,255,255,0.05)",
                transition: "all 0.22s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isLight ? `${T.accent}10` : "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "scale(1.08)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = v === "admin" ? "rgba(167,139,250,0.14)" : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)");
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <Settings size={17} color={v === "admin" ? "#A78BFA" : (isLight ? T.txt2 : "rgba(255,255,255,0.34)")} strokeWidth={1.9} />
            </button>
            <span style={{ fontSize: 7.5, fontFamily: font, fontWeight: 500, color: isLight ? T.txt3 : "rgba(255,255,255,0.22)", userSelect: "none" }}>System</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ══ HEADER — Pure Dark Shell ═══════════════════════════════════════
            Filosofía: el header desaparece como "chrome" para que el contenido
            y el Centro de Inteligencia sean los protagonistas.
            Dark: negro puro, sin blur, sin glass en la barra.
            El único elemento con Liquid Glass es el pill del centro.
            Light: blanco cristal limpio, mismo esquema sin exceso.
            ═══════════════════════════════════════════════════════════════ */}
        {(() => {
          /* ── Shared micro-tokens ── */
          const hBg   = isLight
            ? "linear-gradient(180deg,#FFFFFF 0%,rgba(248,253,250,0.96) 100%)"
            : "#050810";
          const hBorder = isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)";

          /* Icon button style — flat, hover fills. */
          const iBtnBase = {
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 0.14s ease",
          };
          const iBtnHoverBg  = isLight ? `${T.accent}0D` : "rgba(255,255,255,0.07)";
          const iBtnActiveBg = isLight ? `${T.accent}18` : "rgba(255,255,255,0.12)";

          /* Icon color resting / hover */
          const icoRest  = isLight ? T.txt3  : "rgba(255,255,255,0.40)";
          const icoHover = isLight ? T.txt   : "rgba(255,255,255,0.82)";

          /* Hairline divider */
          const hDiv = (
            <div style={{
              width: 1, height: 16, flexShrink: 0,
              background: isLight ? `${T.accent}22` : "rgba(255,255,255,0.07)",
              margin: "0 2px",
            }} />
          );

          /* Hover helpers for icon buttons */
          const onIco  = e => { e.currentTarget.style.background = iBtnHoverBg; };
          const offIco = e => { e.currentTarget.style.background = "transparent"; };
          const dnIco  = e => { e.currentTarget.style.background = iBtnActiveBg; e.currentTarget.style.transform = "scale(0.92)"; };
          const upIco  = e => { e.currentTarget.style.background = iBtnHoverBg;  e.currentTarget.style.transform = "scale(1)"; };

          return (
            <div style={{
              position: "relative", flexShrink: 0,
              padding: "0 20px", height: 52,
              borderBottom: `1px solid ${hBorder}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: hBg,
              backdropFilter: isLight ? "blur(24px) saturate(180%)" : "none",
              WebkitBackdropFilter: isLight ? "blur(24px) saturate(180%)" : "none",
              boxShadow: isLight
                ? "inset 0 -1px 0 rgba(13,154,118,0.08), 0 2px 16px rgba(15,23,42,0.04)"
                : "none",
              transition: "background 0.3s ease",
            }}>

              {/* ══ LEFT: Brand + IAOS ══ */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                {/* Wordmark — compact single-line */}
                <p style={{
                  margin: 0, fontSize: 14, fontFamily: fontDisp,
                  letterSpacing: "-0.030em", fontWeight: 600,
                  color: isLight ? T.txt : "#FFFFFF", lineHeight: 1, whiteSpace: "nowrap",
                }}>
                  Stratos
                  <span style={{
                    marginLeft: 3, fontWeight: 600,
                    color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.30)",
                    letterSpacing: "0.01em",
                  }}>IA</span>
                </p>

                {/* ── IAOS Dynamic Island ── */}
                <IAOSIsland leadsData={leadsData} isLight={isLight} T={T} fontDisp={fontDisp} font={font} />
              </div>

              {/* ══ CENTER: Solo Centro de Inteligencia ══ */}
              <div style={{
                position: "absolute", left: "50%", transform: "translateX(-50%)",
              }}>
                <DynIsland onExpand={openPriorityLead} notifications={notifs} theme={theme} />
              </div>

              {/* ══ RIGHT: Minimal icon controls ══ */}
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>

                {/* Search */}
                <button
                  title="Buscar (⌘K)"
                  style={{ ...iBtnBase, width: "auto", padding: "0 10px", gap: 6 }}
                  onMouseEnter={onIco} onMouseLeave={offIco}
                  onMouseDown={dnIco} onMouseUp={upIco}
                >
                  <Search size={13} color={icoRest} strokeWidth={2.1} />
                  <span style={{
                    fontSize: 11, fontFamily: font,
                    color: isLight ? T.txt3 : "rgba(255,255,255,0.36)",
                    letterSpacing: "-0.005em",
                  }}>Buscar</span>
                  <kbd style={{
                    fontSize: 8.5, fontFamily: fontDisp, fontWeight: 700,
                    padding: "2px 5px", borderRadius: 4,
                    background: isLight ? `${T.accent}0C` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isLight ? `${T.accent}20` : "rgba(255,255,255,0.08)"}`,
                    color: isLight ? T.accentDark : "rgba(255,255,255,0.28)",
                    lineHeight: 1.4,
                  }}>⌘K</kbd>
                </button>

                {hDiv}

                {/* Theme toggle — icon only, swaps sun↔moon */}
                <button
                  onClick={() => setTheme(isLight ? "dark" : "light")}
                  title={isLight ? "Modo oscuro" : "Modo claro"}
                  style={iBtnBase}
                  onMouseEnter={onIco} onMouseLeave={offIco}
                  onMouseDown={dnIco} onMouseUp={upIco}
                >
                  {isLight
                    ? <Sun  size={14} color={T.amber}  strokeWidth={2.2} />
                    : <Moon size={13} color="rgba(255,255,255,0.50)" strokeWidth={2} fill="rgba(255,255,255,0.50)" />}
                </button>

                {/* Bell */}
                <button
                  title="Notificaciones"
                  style={{ ...iBtnBase, position: "relative" }}
                  onMouseEnter={onIco} onMouseLeave={offIco}
                  onMouseDown={dnIco} onMouseUp={upIco}
                >
                  <Bell size={13} color={icoRest} strokeWidth={2.1} />
                  <div style={{
                    position: "absolute", top: 5, right: 5,
                    width: 5, height: 5, borderRadius: "50%",
                    background: T.rose,
                    border: `1.5px solid ${isLight ? "#FAFCFA" : "#050810"}`,
                  }} />
                </button>

                {hDiv}

                {/* User — avatar + name/role */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0 8px 0 3px", height: 32, borderRadius: 8,
                  cursor: "default", transition: "background 0.14s",
                  flexShrink: 0,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = iBtnHoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Avatar circle */}
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: isLight
                      ? `linear-gradient(135deg, ${T.accent} 0%, #10B48A 100%)`
                      : `linear-gradient(145deg, rgba(110,231,194,0.28) 0%, rgba(52,211,153,0.12) 100%)`,
                    border: isLight
                      ? "1.5px solid rgba(255,255,255,0.30)"
                      : `1.5px solid rgba(110,231,194,0.24)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10.5, fontWeight: 800, fontFamily: fontDisp,
                    color: isLight ? "#FFFFFF" : T.accent,
                    boxShadow: isLight
                      ? `0 2px 8px ${T.accent}45`
                      : `inset 0 1px 0 rgba(110,231,194,0.22)`,
                  }}>
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  {/* Name + role */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                      letterSpacing: "-0.01em", lineHeight: 1.2,
                      color: isLight ? T.txt : "rgba(255,255,255,0.82)",
                      whiteSpace: "nowrap",
                    }}>
                      {user?.name?.split(" ")[0] || "Usuario"}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, fontFamily: font,
                      letterSpacing: "0.02em", lineHeight: 1.1,
                      color: user?.isDemo
                        ? T.amber
                        : (isLight ? T.txt3 : "rgba(255,255,255,0.30)"),
                      whiteSpace: "nowrap",
                    }}>
                      {user?.isDemo ? "Demo" : (user?.role || "Miembro")}
                    </span>
                  </div>
                </div>

                {hDiv}

                {/* Logout — icon only, red on hover */}
                <button
                  onClick={onLogout}
                  title="Cerrar sesión"
                  style={iBtnBase}
                  onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                  onMouseLeave={offIco}
                  onMouseDown={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.13)" : "rgba(239,68,68,0.18)"; }}
                  onMouseUp={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                >
                  <LogOut size={13} color={icoRest} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          );
        })()}

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto", animation: "fadeIn 0.4s ease", display: "flex", flexDirection: "column" }}>
            {/* Permission gate — solo bloquea si el rol está definido y NO tiene acceso */}
            {user?.role && MODULE_ROLES[v] && !MODULE_ROLES[v].includes(user.role)
              ? <PermissionGate moduleId={v} onGoBack={() => setV("c")} />
              : <>
                  {v === "d" && <Dash oc={oc} co={co} leadsData={leadsData} T={T} />}
                  {v === "c" && <CRM oc={oc} co={co} leadsData={leadsData} setLeadsData={setLeadsData} theme={theme} setTheme={setTheme} autoOpenPriority1={autoOpenPriority1} onAutoOpenHandled={() => setAutoOpenPriority1(0)} />}
                  {v === "ia" && <IACRM oc={oc} />}
                  {v === "e" && <ERP oc={oc} T={T} />}
                  {v === "a" && <AsesorCRM oc={oc} />}
                  {v === "lp" && <LandingPages T={T} />}
                  {v === "fa" && <FinanzasAdmin />}
                  {v === "rrhh" && <RRHHModule />}
                  {v === "planes" && <PricingScreen embedded onBack={() => setV(isAsesorRole ? "c" : "d")} />}
                  {v === "admin" && ["super_admin","admin"].includes(user?.role) && <AdminPanel />}
                </>
            }
          </div>
          <Chat open={co} onClose={() => setCo(false)} msgs={msgs} setMsgs={setMsgs} inp={inp} setInp={setInp} />
        </div>
      </div>

      {/* ── META PANEL — Lista de Acción · Plan Estratégico · Protocolo de Ventas ── */}
      {metaOpen && (() => {
        const GOAL2  = metaPlan.goal;
        const aLeads = leadsData.filter(l => l.presupuesto > 0);
        const pipe2  = aLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
        const pct2   = Math.min(100, Math.round((pipe2 / GOAL2) * 100));
        const avgSc  = aLeads.length ? Math.round(aLeads.reduce((s, l) => s + (l.sc || 0), 0) / aLeads.length) : 0;
        const fmtM   = n => n >= 1e6 ? `$${(n/1e6).toFixed(1).replace(/\.0$/,"")}M` : `$${(n/1e3).toFixed(0)}K`;

        /* ── Helpers ── */
        const sectionHd = (label, color) => (
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
            <div style={{ width:3, height:14, borderRadius:2, background:color }} />
            <span style={{ fontSize:9.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.11em", textTransform:"uppercase", color }}>{label}</span>
          </div>
        );
        const colHd = txt => (
          <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, fontFamily:fontDisp, color:T.txt2, letterSpacing:"0.05em", textTransform:"uppercase" }}>{txt}</p>
        );
        const E = ({ val, onSave, style={}, multi=false }) => (
          <span
            contentEditable suppressContentEditableWarning
            onBlur={e => { const v=e.currentTarget.textContent.trim(); if(v) onSave(v); }}
            onKeyDown={e => { if(!multi && e.key==="Enter"){ e.preventDefault(); e.currentTarget.blur(); } }}
            title="Click para editar"
            style={{
              display:"block", outline:"none",
              borderBottom:`1px dashed ${isLight?"rgba(0,0,0,0.12)":"rgba(255,255,255,0.12)"}`,
              cursor:"text", minWidth:20,
              ...style,
            }}
          >{val}</span>
        );

        const groups = [
          { label:"Hoy · Urgente", color:"#EF4444", f: a => !a.done && (a.date?.toLowerCase().includes("hoy") || a.priority==="urgente") },
          { label:"Esta Semana",   color:"#F59E0B", f: a => !a.done && !a.date?.toLowerCase().includes("hoy") && a.priority!=="urgente" && (a.date?.toLowerCase().includes("semana")||a.date?.toLowerCase().includes("mañana")) },
          { label:"Próximo",       color:T.blue,    f: a => !a.done && !a.date?.toLowerCase().includes("hoy") && !a.date?.toLowerCase().includes("semana") && !a.date?.toLowerCase().includes("mañana") && a.priority!=="urgente" },
          { label:"Completadas",   color:T.accent,  f: a => a.done },
        ];

        const tabs = [
          { id:"acciones",  label:"Lista de Acción" },
          { id:"plan",      label:"Plan Estratégico" },
          { id:"protocolo", label:"Protocolo de Ventas" },
        ];

        return (
          <>
            {/* Backdrop */}
            <div onClick={() => setMetaOpen(false)} style={{
              position:"fixed", inset:0, zIndex:600,
              background: isLight ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.72)",
              backdropFilter:"blur(10px)",
              animation:"fadeIn 0.22s ease both",
            }} />

            {/* Modal */}
            <div style={{
              position:"fixed", top:"50%", left:"50%",
              width:"min(1020px, 96vw)", height:"min(720px, 94vh)",
              zIndex:601,
              background: isLight ? "#FFFFFF" : "#090D18",
              borderRadius:22,
              border:`1px solid ${isLight ? "rgba(13,154,118,0.11)" : "rgba(255,255,255,0.07)"}`,
              boxShadow: isLight
                ? "0 40px 120px rgba(15,23,42,0.15), 0 8px 32px rgba(15,23,42,0.08)"
                : "0 40px 120px rgba(0,0,0,0.70), 0 8px 32px rgba(0,0,0,0.40)",
              display:"flex", flexDirection:"column",
              overflow:"hidden",
              animation:"modalIn 0.28s cubic-bezier(0.16,1,0.3,1) both",
            }}>

              {/* ── Header ── */}
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"17px 24px 15px",
                borderBottom:`1px solid ${T.border}`,
                flexShrink:0,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${T.accent}12`, border:`1px solid ${T.accent}24`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Target size={17} color={T.accent} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:15.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.03em", color:T.txt }}>Duke del Caribe</p>
                    <p style={{ margin:"1px 0 0", fontSize:10, color:T.txt3, fontFamily:font }}>Plan Estratégico · Scaling Up · 2026</p>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display:"flex", gap:2, background:T.glass, border:`1px solid ${T.border}`, borderRadius:12, padding:3 }}>
                  {tabs.map(({ id, label }) => (
                    <button key={id} onClick={() => setMetaTab(id)} style={{
                      padding:"7px 16px", borderRadius:9, border:"none",
                      background: metaTab===id ? (isLight?"#FFFFFF":"rgba(255,255,255,0.09)") : "transparent",
                      color: metaTab===id ? T.txt : T.txt2,
                      fontSize:12, fontWeight: metaTab===id ? 600 : 500,
                      fontFamily:font, cursor:"pointer",
                      boxShadow: metaTab===id ? (isLight?"0 1px 6px rgba(15,23,42,0.08)":"0 1px 4px rgba(0,0,0,0.30)") : "none",
                      transition:"all 0.15s",
                    }}>{label}</button>
                  ))}
                </div>
                <button onClick={() => setMetaOpen(false)} style={{
                  width:32, height:32, borderRadius:"50%", border:`1px solid ${T.border}`,
                  background:T.glass, color:T.txt3, cursor:"pointer", fontSize:18,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>×</button>
              </div>

              {/* ── Scrollable body ── */}
              <div style={{ flex:1, overflowY:"auto", padding:"22px 24px 28px" }}>

                {/* ═══ TAB 1: LISTA DE ACCIÓN ══════════════════════════════════ */}
                {metaTab === "acciones" && (
                  <div>
                    {/* Header */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                      <div>
                        <h3 style={{ margin:0, fontSize:15, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.03em", color:T.txt }}>Acciones del Equipo</h3>
                        <p style={{ margin:"3px 0 0", fontSize:11, color:T.txt3, fontFamily:font }}>
                          {metaActions.filter(a=>!a.done).length} pendientes · {metaActions.filter(a=>a.done).length} completadas
                          <span style={{ marginLeft:8, opacity:0.45, fontSize:10 }}>· Arrastra para reordenar</span>
                        </p>
                      </div>
                    </div>

                    {/* Quick-add bar */}
                    <div style={{ display:"flex", gap:8, marginBottom:18, alignItems:"stretch" }}>
                      <input
                        value={metaNewText}
                        onChange={e => setMetaNewText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && metaNewText.trim()) {
                            setMetaActions(p => [{ id:Date.now(), text:metaNewText.trim(), lead:"General", asesor:"Equipo", date:"Hoy", done:false, priority:"normal", assignee:"", assigneeType:"human" }, ...p]);
                            setMetaNewText("");
                          }
                        }}
                        placeholder="Nueva acción — escribe y presiona Enter…"
                        style={{
                          flex:1, padding:"10px 15px", borderRadius:10,
                          background: isLight?"#FFFFFF":"rgba(255,255,255,0.05)",
                          border:`1.5px solid ${metaNewText ? T.accent : T.border}`,
                          color:T.txt, fontSize:12.5, fontFamily:font, outline:"none",
                          boxShadow: metaNewText ? `0 0 0 3px ${T.accent}18` : "none",
                          transition:"border 0.15s, box-shadow 0.15s",
                        }}
                      />
                      <button
                        onClick={() => {
                          const txt = metaNewText.trim();
                          if (!txt) return;
                          setMetaActions(p => [{ id:Date.now(), text:txt, lead:"General", asesor:"Equipo", date:"Hoy", done:false, priority:"normal", assignee:"", assigneeType:"human" }, ...p]);
                          setMetaNewText("");
                        }}
                        style={{
                          display:"flex", alignItems:"center", gap:7,
                          padding:"0 20px", borderRadius:10, border:"none",
                          background: metaNewText
                            ? `linear-gradient(135deg,#0D9A76,${T.accent})`
                            : (isLight?"rgba(0,0,0,0.06)":"rgba(255,255,255,0.07)"),
                          color: metaNewText ? "#041016" : T.txt3,
                          fontSize:12.5, fontWeight:700, fontFamily:fontDisp,
                          cursor: metaNewText ? "pointer" : "default",
                          flexShrink:0, letterSpacing:"-0.02em",
                          boxShadow: metaNewText ? "0 2px 12px rgba(13,154,118,0.30)" : "none",
                          transition:"background 0.18s, color 0.18s, box-shadow 0.18s",
                          minHeight:42,
                        }}>
                        <Plus size={14} strokeWidth={2.5} />
                        Agregar
                      </button>
                    </div>

                    {/* Pending tasks */}
                    {metaActions.filter(a=>!a.done).length === 0 && (
                      <div style={{ textAlign:"center", padding:"30px 0 20px", color:T.txt3, fontSize:12, fontFamily:font, opacity:0.5 }}>
                        Sin acciones pendientes · Agrega la primera arriba
                      </div>
                    )}
                    {metaActions.filter(a=>!a.done).map(a => {
                      const isUrgent = a.priority==="urgente" || a.date?.toLowerCase().includes("hoy");
                      const isHigh   = !isUrgent && (a.priority==="alto" || a.date?.toLowerCase().includes("mañana") || a.date?.toLowerCase().includes("semana"));
                      const prioColor = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : T.txt3;
                      const prioNext = a.priority==="normal" ? "alto" : a.priority==="alto" ? "urgente" : "normal";
                      const prioDot  = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : (isLight?"#94A3B8":"#475569");
                      const prioLabel = a.priority==="urgente" ? "Urgente" : a.priority==="alto" ? "Alto" : "Normal";
                      return (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={e => { e.dataTransfer.setData("maDragId", String(a.id)); e.currentTarget.style.opacity="0.35"; }}
                          onDragEnd={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.outline="none"; }}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.outline=`2px solid ${T.accent}55`; e.currentTarget.style.borderRadius="10px"; }}
                          onDragLeave={e => { e.currentTarget.style.outline="none"; }}
                          onDrop={e => {
                            e.preventDefault(); e.currentTarget.style.outline="none";
                            const fromId = Number(e.dataTransfer.getData("maDragId"));
                            const toId = a.id;
                            if (fromId === toId) return;
                            setMetaActions(p => {
                              const arr=[...p];
                              const fi=arr.findIndex(x=>x.id===fromId);
                              const ti=arr.findIndex(x=>x.id===toId);
                              const [item]=arr.splice(fi,1);
                              arr.splice(ti,0,item);
                              return arr;
                            });
                          }}
                          style={{
                            display:"flex", alignItems:"flex-start", gap:8,
                            padding:"10px 12px", borderRadius:10, marginBottom:5,
                            background: isUrgent
                              ? (isLight?"rgba(239,68,68,0.03)":"rgba(239,68,68,0.04)")
                              : (isLight?"#FFFFFF":"rgba(255,255,255,0.03)"),
                            border:`1px solid ${isUrgent ? "rgba(239,68,68,0.18)" : T.border}`,
                            transition:"background 0.15s, border 0.15s",
                          }}
                        >
                          {/* Drag handle */}
                          <GripVertical size={13} color={T.txt3} style={{ cursor:"grab", flexShrink:0, marginTop:4, opacity:0.30 }} />

                          {/* Checkbox */}
                          <button
                            onClick={() => setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:true} : x))}
                            style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${T.border}`, background:"transparent", cursor:"pointer", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                          />

                          {/* Content */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <E
                              val={a.text}
                              onSave={v => setMetaActions(p => p.map(x => x.id===a.id ? {...x,text:v} : x))}
                              style={{ fontSize:12.5, fontWeight:500, color:T.txt, fontFamily:font, lineHeight:1.4, marginBottom:4 }}
                            />
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                              <E val={a.lead}   onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,lead:v}:x))}   style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                              <span style={{ fontSize:8.5, color:T.txt3, opacity:0.4 }}>·</span>
                              <E val={a.asesor} onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,asesor:v}:x))} style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                              {/* Priority cycle pill */}
                              <button
                                onClick={() => setMetaActions(p => p.map(x => x.id===a.id?{...x,priority:prioNext}:x))}
                                title="Click para cambiar prioridad"
                                style={{
                                  display:"inline-flex", alignItems:"center", gap:4,
                                  fontSize:9.5, fontWeight:600, fontFamily:font,
                                  color:prioColor, background:`${prioDot}10`,
                                  border:`1px solid ${prioDot}28`, borderRadius:99,
                                  padding:"2px 8px 2px 6px", cursor:"pointer",
                                  letterSpacing:"0.01em", transition:"all 0.15s",
                                }}>
                                <span style={{ width:6, height:6, borderRadius:"50%", background:prioDot, display:"inline-block", flexShrink:0 }} />
                                {prioLabel}
                              </button>
                            </div>
                            {/* Assignee row */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <select
                                value={a.assignee || ""}
                                onChange={e => setMetaActions(p => p.map(x => x.id===a.id ? {...x, assignee:e.target.value, assigneeType:"human"} : x))}
                                style={{
                                  fontSize:9.5, fontFamily:font, fontWeight:500,
                                  color: a.assignee ? T.txt2 : T.txt3,
                                  background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                                  border:`1px solid ${a.assignee ? T.accentB : T.border}`,
                                  borderRadius:6, padding:"2px 6px",
                                  cursor:"pointer", outline:"none", maxWidth:140,
                                }}
                              >
                                <option value="">＋ Responsable</option>
                                <optgroup label="── Equipo Humano">
                                  {["Oscar Gálvez","Alexia Santillán","Alex Velázquez","Ken Lugo","Emmanuel Ortiz","Araceli Oneto","Cecilia Mendoza","Estefanía Valdes"].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </optgroup>
                              </select>
                              <button
                                disabled
                                title="Próximamente — Asignación directa a iAgents IA"
                                style={{
                                  display:"flex", alignItems:"center", gap:3,
                                  padding:"2px 7px", borderRadius:6,
                                  border:`1px solid ${T.blue}28`,
                                  background:`${T.blue}07`,
                                  color:T.blue, fontSize:9, fontFamily:font, fontWeight:600,
                                  cursor:"not-allowed", opacity:0.38,
                                }}
                              >
                                <Atom size={9} />iAgent IA
                              </button>
                            </div>
                          </div>

                          {/* Date + delete */}
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                            <E
                              val={a.date || "—"}
                              onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,date:v}:x))}
                              style={{ fontSize:10, fontWeight:600, fontFamily:fontDisp, color:prioColor, background:`${prioColor}13`, border:`1px solid ${prioColor}25`, padding:"2px 9px", borderRadius:99, whiteSpace:"nowrap", cursor:"text" }}
                            />
                            <button onClick={() => setMetaActions(p => p.filter(x => x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.25, display:"flex", alignItems:"center" }}>
                              <Minus size={11} color={T.txt3} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Completed tasks — collapsible */}
                    {metaActions.filter(a=>a.done).length > 0 && (
                      <div style={{ marginTop:14 }}>
                        <button
                          onClick={() => setDoneCollapsed(x => !x)}
                          style={{ display:"flex", alignItems:"center", gap:7, background:"none", border:"none", cursor:"pointer", padding:"6px 0", width:"100%" }}>
                          <div style={{ flex:1, height:1, background:T.border }} />
                          <span style={{ fontSize:10.5, fontWeight:600, color:T.txt3, fontFamily:font, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
                            <Check size={11} color={T.accent} />
                            {metaActions.filter(a=>a.done).length} completadas
                            <span style={{ fontSize:9, opacity:0.6 }}>{doneCollapsed ? "▸ ver" : "▾ ocultar"}</span>
                          </span>
                          <div style={{ flex:1, height:1, background:T.border }} />
                        </button>
                        {!doneCollapsed && metaActions.filter(a=>a.done).map(a => (
                          <div key={a.id} style={{
                            display:"flex", alignItems:"flex-start", gap:8,
                            padding:"8px 12px", borderRadius:10, marginBottom:4,
                            background: isLight?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.025)",
                            border:`1px solid ${T.accent}14`,
                            opacity:0.60,
                          }}>
                            <button
                              onClick={() => setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:false} : x))}
                              style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${T.accent}`, background:T.accent, cursor:"pointer", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Check size={9} strokeWidth={3} color="#041016" />
                            </button>
                            <div style={{ flex:1, minWidth:0 }}>
                              <span style={{ fontSize:12, color:T.txt3, fontFamily:font, textDecoration:"line-through", lineHeight:1.4 }}>{a.text}</span>
                              <p style={{ margin:"2px 0 0", fontSize:10, color:T.txt3, fontFamily:font, opacity:0.7 }}>{a.lead} · {a.asesor}</p>
                            </div>
                            <button onClick={() => setMetaActions(p => p.filter(x => x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.25 }}>
                              <Minus size={11} color={T.txt3} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB 2: PLAN ESTRATÉGICO ════════════════════════════════ */}
                {metaTab === "plan" && (
                  <div>
                    <div style={{ textAlign:"center", marginBottom:18 }}>
                      <p style={{ margin:0, fontSize:19, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.04em", color:T.txt }}>DUKE DEL CARIBE</p>
                      <p style={{ margin:"3px 0 0", fontSize:10, color:T.txt3, fontFamily:font, letterSpacing:"0.08em", textTransform:"uppercase" }}>Plan Estratégico · Una Página · Scaling Up® · Q2 2026</p>
                    </div>

                    {/* CORE */}
                    <div style={{ background:isLight?"#F7FBF9":"rgba(52,211,153,0.025)", border:`1px solid ${isLight?"rgba(13,154,118,0.12)":"rgba(52,211,153,0.09)"}`, borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
                      {sectionHd("CORE — Por qué existimos", T.accent)}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1.1fr", gap:14 }}>
                        <div>
                          {colHd("Valores Core")}
                          {metaPlan.coreValues.map((v, i) => (
                            <div key={i} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                              <div style={{ width:4, height:4, borderRadius:"50%", background:T.accent, marginTop:6, flexShrink:0 }} />
                              <E val={v} onSave={nv => setMetaPlan(p => { const c=[...p.coreValues]; c[i]=nv; return {...p,coreValues:c}; })} style={{ fontSize:11, color:T.txt, fontFamily:font, lineHeight:1.45, flex:1 }} />
                            </div>
                          ))}
                        </div>
                        <div>
                          {colHd("Propósito")}
                          <E val={metaPlan.purpose} onSave={v => setMetaPlan(p=>({...p,purpose:v}))} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.65, fontStyle:"italic", marginBottom:10 }} />
                          {colHd("X-Factor")}
                          <E val={metaPlan.xfactor} onSave={v => setMetaPlan(p=>({...p,xfactor:v}))} multi style={{ fontSize:11, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                        </div>
                        <div>
                          {colHd("SWT")}
                          {metaPlan.swt.map((s, i) => {
                            const col = s.type==="F"?"#34D399":s.type==="D"?"#F87171":T.blue;
                            return (
                              <div key={i} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                                <span style={{ fontSize:7.5, fontWeight:800, color:col, background:`${col}18`, borderRadius:3, padding:"1px 4px", flexShrink:0, marginTop:2 }}>{s.type}</span>
                                <E val={s.text} onSave={v => setMetaPlan(p => { const sw=[...p.swt]; sw[i]={...sw[i],text:v}; return {...p,swt:sw}; })} style={{ fontSize:10.5, color:T.txt, fontFamily:font, lineHeight:1.4, flex:1 }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ESTRATEGIA */}
                    <div style={{ background:isLight?"rgba(126,184,240,0.04)":"rgba(126,184,240,0.025)", border:`1px solid ${isLight?"rgba(126,184,240,0.16)":"rgba(126,184,240,0.09)"}`, borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
                      {sectionHd("ESTRATEGIA — Qué hacemos", T.blue)}
                      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 0.9fr 1fr", gap:14 }}>
                        <div>
                          {colHd("BHAG 2030")}
                          <E val={metaPlan.bhag} onSave={v => setMetaPlan(p=>({...p,bhag:v}))} multi style={{ fontSize:13.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.025em", color:T.txt, lineHeight:1.4, marginBottom:10 }} />
                          {colHd("Meta 3–5 Años")}
                          {metaPlan.targets3yr.map((t, i) => (
                            <div key={i} style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center" }}>
                              <TrendingUp size={9} color={T.accent} strokeWidth={2.5} style={{ flexShrink:0 }} />
                              <E val={t} onSave={v => setMetaPlan(p => { const ts=[...p.targets3yr]; ts[i]=v; return {...p,targets3yr:ts}; })} style={{ fontSize:11, color:T.txt, fontFamily:font, flex:1 }} />
                            </div>
                          ))}
                        </div>
                        <div>
                          {colHd("Sandbox")}
                          {Object.entries(metaPlan.sandbox).map(([k, v]) => (
                            <div key={k} style={{ marginBottom:6 }}>
                              <span style={{ fontSize:8.5, fontWeight:700, color:T.txt3, fontFamily:fontDisp, letterSpacing:"0.04em", textTransform:"uppercase" }}>{k} </span>
                              <E val={v} onSave={nv => setMetaPlan(p=>({...p,sandbox:{...p.sandbox,[k]:nv}}))} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                            </div>
                          ))}
                        </div>
                        <div>
                          {colHd("Brand Promise")}
                          {metaPlan.brandPromises.map((bp, i) => (
                            <div key={i} style={{ marginBottom:7, padding:"8px 10px", borderRadius:9, background:`${T.accent}07`, border:`1px solid ${T.accent}14` }}>
                              <E val={bp.title} onSave={v => setMetaPlan(p => { const b=[...p.brandPromises]; b[i]={...b[i],title:v}; return {...p,brandPromises:b}; })} style={{ fontSize:11, fontWeight:700, color:isLight?"#082818":T.accent, fontFamily:fontDisp, marginBottom:2 }} />
                              <E val={bp.sub}   onSave={v => setMetaPlan(p => { const b=[...p.brandPromises]; b[i]={...b[i],sub:v};   return {...p,brandPromises:b}; })} style={{ fontSize:10, color:T.txt2, fontFamily:font, lineHeight:1.4 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* EJECUCIÓN */}
                    <div style={{ background:isLight?"rgba(167,139,250,0.03)":"rgba(167,139,250,0.025)", border:`1px solid ${isLight?"rgba(167,139,250,0.14)":"rgba(167,139,250,0.09)"}`, borderRadius:14, padding:"14px 16px" }}>
                      {sectionHd("EJECUCIÓN — Cómo lo hacemos", T.violet)}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr 0.85fr", gap:14 }}>
                        <div>
                          {colHd("Rocks Q2 2026")}
                          {metaPlan.rocks.map((r, i) => (
                            <div key={i} style={{ marginBottom:12 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <E val={r.n} onSave={v => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],n:v}; return {...p,rocks:rs}; })} style={{ fontSize:11, fontWeight:600, color:T.txt, fontFamily:font, lineHeight:1.35, flex:1 }} />
                                <span style={{ fontSize:10, fontWeight:700, fontFamily:fontDisp, marginLeft:6, flexShrink:0, color:r.pct>=60?"#34D399":r.pct>=40?"#F59E0B":"#F87171" }}>{r.pct}%</span>
                              </div>
                              <input type="range" min="0" max="100" value={r.pct}
                                onChange={e => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],pct:+e.target.value}; return {...p,rocks:rs}; })}
                                style={{ width:"100%", accentColor:r.pct>=60?"#34D399":r.pct>=40?"#F59E0B":"#F87171", height:3, marginBottom:3, cursor:"pointer" }} />
                              <E val={r.owner} onSave={v => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],owner:v}; return {...p,rocks:rs}; })} style={{ fontSize:9, color:T.txt3, fontFamily:font }} />
                            </div>
                          ))}
                        </div>
                        <div>
                          {colHd("Números Críticos · Live")}
                          {[
                            { label:"Pipeline Total", value:fmtM(pipe2), target:"$48M",  pct:pct2, type:"leading" },
                            { label:"Score Promedio", value:`${avgSc}`,  target:"80+",   pct:Math.round((avgSc/80)*100), type:"leading" },
                            { label:"Leads Activos",  value:`${aLeads.length}`, target:"15", pct:Math.round((aLeads.length/15)*100), type:"people" },
                            { label:"Tasa de Cierre", value:"18.4%",     target:"25%",   pct:Math.round((18.4/25)*100), type:"result" },
                          ].map((k, i) => {
                            const kCol = k.type==="leading"?T.blue:k.type==="people"?T.violet:T.accent;
                            return (
                              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:9, marginBottom:6, background:isLight?"rgba(255,255,255,0.80)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                                <div style={{ flex:1 }}>
                                  <p style={{ margin:"0 0 1px", fontSize:9, color:T.txt3, fontFamily:font }}>{k.label}</p>
                                  <p style={{ margin:"0 0 5px", fontSize:15, fontWeight:700, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.025em" }}>{k.value}</p>
                                  <div style={{ height:2.5, borderRadius:99, background:isLight?"rgba(0,0,0,0.07)":"rgba(255,255,255,0.07)", overflow:"hidden", width:"88%" }}>
                                    <div style={{ width:`${Math.min(k.pct,100)}%`, height:"100%", background:k.pct>=80?"#34D399":k.pct>=50?"#F59E0B":"#F87171", borderRadius:99 }} />
                                  </div>
                                </div>
                                <div style={{ textAlign:"right", paddingLeft:8 }}>
                                  <p style={{ margin:"0 0 2px", fontSize:8, color:T.txt3 }}>Meta</p>
                                  <p style={{ margin:"0 0 4px", fontSize:12, fontWeight:700, color:T.accent, fontFamily:fontDisp }}>{k.target}</p>
                                  <span style={{ fontSize:7.5, fontWeight:700, padding:"2px 6px", borderRadius:99, background:`${kCol}14`, color:kCol }}>{k.type}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div>
                          {colHd("Meta Anual 2026")}
                          <div style={{ padding:"12px", borderRadius:11, background:`${T.accent}07`, border:`1px solid ${T.accent}16`, marginBottom:12 }}>
                            <p style={{ margin:"0 0 1px", fontSize:24, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.045em", color:T.txt }}>{fmtM(metaPlan.goal)}</p>
                            <p style={{ margin:"0 0 9px", fontSize:10, color:T.txt2, fontFamily:font }}>Pipeline · 12 cierres/trimestre</p>
                            <div style={{ height:5, borderRadius:99, background:isLight?"rgba(13,154,118,0.09)":"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:5 }}>
                              <div style={{ width:`${pct2}%`, height:"100%", background:"linear-gradient(90deg,#0D9A76,#34D399,#6EE7C2)", borderRadius:99 }} />
                            </div>
                            <p style={{ margin:0, fontSize:11, fontWeight:700, color:T.accent, fontFamily:fontDisp }}>{pct2}% · {fmtM(pipe2)}</p>
                          </div>
                          {colHd("Tema 2026")}
                          <div style={{ padding:"10px 11px", borderRadius:10, background:isLight?"#FFFCF0":"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.22)" }}>
                            <E val={metaPlan.anualTheme} onSave={v => setMetaPlan(p=>({...p,anualTheme:v}))} style={{ fontSize:12.5, fontWeight:700, color:"#D97706", fontFamily:fontDisp, marginBottom:4 }} />
                            <E val={metaPlan.anualThemeDesc} onSave={v => setMetaPlan(p=>({...p,anualThemeDesc:v}))} multi style={{ fontSize:10.5, color:T.txt2, fontFamily:font, lineHeight:1.55 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ TAB 3: PROTOCOLO DE VENTAS ══════════════════════════════ */}
                {metaTab === "protocolo" && (
                  <div>

                    {/* ── Hero Header ── */}
                    <div style={{ marginBottom:14, padding:"18px 20px", borderRadius:15, background:isLight?"linear-gradient(135deg,rgba(110,231,194,0.08),rgba(126,184,240,0.06))":"linear-gradient(135deg,rgba(110,231,194,0.06),rgba(126,184,240,0.04))", border:`1px solid ${T.accent}20`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                          <div style={{ width:3, height:18, borderRadius:2, background:`linear-gradient(180deg,${T.accent},${T.blue})` }} />
                          <span style={{ fontSize:8, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase", color:T.txt3, fontFamily:fontDisp }}>Protocolo Operativo · Stratos Capital Group</span>
                        </div>
                        <p style={{ margin:"0 0 3px", fontSize:21, fontWeight:800, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.04em" }}>Protocolo Duke del Caribe</p>
                        <p style={{ margin:0, fontSize:11, color:T.txt2, fontFamily:font }}>Sistema de ventas consultivo · Riviera Maya · Alta inversión</p>
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        {[
                          { label:"Etapas", value:"10", color:T.accent },
                          { label:"SLA Contacto", value:"5 min", color:T.blue },
                          { label:"Seguimiento", value:"45+", color:T.violet },
                          { label:"Tasa Meta", value:"25%", color:"#34D399" },
                        ].map((s,i) => (
                          <div key={i} style={{ textAlign:"center", padding:"9px 14px", borderRadius:11, background:isLight?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.04)", border:`1px solid ${s.color}22` }}>
                            <p style={{ margin:"0 0 1px", fontSize:18, fontWeight:800, color:s.color, fontFamily:fontDisp, letterSpacing:"-0.03em" }}>{s.value}</p>
                            <p style={{ margin:0, fontSize:8, color:T.txt3, fontFamily:font, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── A: Objetivo + Principios + Velocidad ── */}
                    <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr 1fr", gap:10, marginBottom:10 }}>

                      {/* Objetivo */}
                      <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(110,231,194,0.06)":"rgba(110,231,194,0.04)", border:`1px solid ${T.accent}22` }}>
                        {sectionHd("1. Objetivo", T.accent)}
                        <E val={metaProtocol.objetivo} onSave={v=>setMetaProtocol(p=>({...p,objetivo:v}))} multi style={{ fontSize:12, fontWeight:600, color:T.txt, fontFamily:font, lineHeight:1.6, marginBottom:10 }} />
                        <div style={{ padding:"8px 10px", borderRadius:8, background:`${T.accent}08`, border:`1px solid ${T.accent}18` }}>
                          <p style={{ margin:"0 0 3px", fontSize:8.5, fontWeight:800, color:T.accent, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>Regla Base</p>
                          <E val={metaProtocol.reglaBase} onSave={v=>setMetaProtocol(p=>({...p,reglaBase:v}))} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }} />
                        </div>
                      </div>

                      {/* Principios */}
                      <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(126,184,240,0.06)":"rgba(126,184,240,0.03)", border:`1px solid ${T.blue}22` }}>
                        {sectionHd("2. Principios del Asesor", T.blue)}
                        <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt3, fontFamily:font }}>Tu responsabilidad es:</p>
                        {metaProtocol.principios.map((pr, i) => (
                          <div key={i} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"flex-start" }}>
                            <span style={{ fontSize:9.5, fontWeight:800, color:T.blue, background:`${T.blue}14`, borderRadius:99, minWidth:19, height:19, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:fontDisp }}>{i+1}</span>
                            <E val={pr} onSave={v=>setMetaProtocol(p=>{const arr=[...p.principios];arr[i]=v;return{...p,principios:arr};})} style={{ fontSize:12, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                          </div>
                        ))}
                        <div style={{ marginTop:10, padding:"7px 10px", borderRadius:8, background:`${T.blue}09`, border:`1px solid ${T.blue}1A` }}>
                          <p style={{ margin:"0 0 2px", fontSize:8.5, fontWeight:800, color:T.blue, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>Regla Crítica</p>
                          <E val={metaProtocol.reglaRegistro} onSave={v=>setMetaProtocol(p=>({...p,reglaRegistro:v}))} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }} />
                        </div>
                      </div>

                      {/* Velocidad de Respuesta */}
                      <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(167,139,250,0.05)":"rgba(167,139,250,0.03)", border:`1px solid ${T.violet}22` }}>
                        {sectionHd("3. Velocidad de Respuesta", T.violet)}
                        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                          <div style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(52,211,153,0.10)", border:"1px solid rgba(52,211,153,0.22)", textAlign:"center" }}>
                            <p style={{ margin:"0 0 2px", fontSize:8.5, color:"#34D399", fontFamily:fontDisp, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Ideal</p>
                            <E val={metaProtocol.velocidadIdeal} onSave={v=>setMetaProtocol(p=>({...p,velocidadIdeal:v}))} style={{ fontSize:16, fontWeight:800, color:"#34D399", fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center" }} />
                          </div>
                          <div style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.22)", textAlign:"center" }}>
                            <p style={{ margin:"0 0 2px", fontSize:8.5, color:"#EF4444", fontFamily:fontDisp, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Máximo</p>
                            <E val={metaProtocol.velocidadMax} onSave={v=>setMetaProtocol(p=>({...p,velocidadMax:v}))} style={{ fontSize:16, fontWeight:800, color:"#EF4444", fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center" }} />
                          </div>
                        </div>
                        <p style={{ margin:"0 0 6px", fontSize:9, fontWeight:700, color:T.violet, fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>Protocolo Inmediato</p>
                        {["Mensaje por WhatsApp", "Llamada directa", "Sin respuesta → mensaje breve + siguiente intento"].map((s, i) => (
                          <div key={i} style={{ display:"flex", gap:7, marginBottom:5, alignItems:"flex-start" }}>
                            <div style={{ width:16, height:16, borderRadius:"50%", background:`${T.violet}14`, border:`1px solid ${T.violet}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                              <span style={{ fontSize:7.5, fontWeight:800, color:T.violet, fontFamily:fontDisp }}>{i+1}</span>
                            </div>
                            <span style={{ fontSize:11.5, color:T.txt2, fontFamily:font, lineHeight:1.45 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── B: Flujo de Trabajo (4 pasos) ── */}
                    <div style={{ marginBottom:10 }}>
                      {sectionHd("4. Flujo de Trabajo", T.violet)}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                        {metaProtocol.flujoSteps.map((step, si) => {
                          const stepColors = [T.accent, T.blue, T.violet, "#34D399"];
                          const c = stepColors[si];
                          return (
                            <div key={si} style={{ padding:"13px 14px", borderRadius:12, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.03)", border:`1px solid ${c}25` }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                                <div style={{ width:24, height:24, borderRadius:"50%", background:`${c}18`, border:`1.5px solid ${c}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                  <span style={{ fontSize:10, fontWeight:800, color:c, fontFamily:fontDisp }}>{si+1}</span>
                                </div>
                                <E val={step.n} onSave={v=>setMetaProtocol(p=>{const f=[...p.flujoSteps];f[si]={...f[si],n:v};return{...p,flujoSteps:f};})} style={{ fontSize:12, fontWeight:700, color:T.txt, fontFamily:fontDisp }} />
                              </div>
                              <p style={{ margin:"0 0 7px", fontSize:10, color:c, fontFamily:font, fontStyle:"italic", paddingLeft:32 }}>{step.desc}</p>
                              <E val={step.action} onSave={v=>setMetaProtocol(p=>{const f=[...p.flujoSteps];f[si]={...f[si],action:v};return{...p,flujoSteps:f};})} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.55, paddingLeft:32 }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── C: Pipeline 10 Etapas ── */}
                    <div style={{ marginBottom:10 }}>
                      {sectionHd("5. Pipeline de 10 Etapas", T.accent)}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                        {metaProtocol.pipelineStages.map((st, i) => {
                          const pct = i / 9;
                          const r = Math.round(110 + pct*50);
                          const g = Math.round(231 - pct*80);
                          const b = Math.round(194 - pct*50);
                          const c = `rgb(${r},${g},${b})`;
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px 5px 7px", borderRadius:99, background:`${c}14`, border:`1px solid ${c}30` }}>
                                <span style={{ fontSize:8, fontWeight:800, color:c, fontFamily:fontDisp, minWidth:13, textAlign:"center" }}>{i+1}</span>
                                <span style={{ fontSize:10.5, fontWeight:600, color:T.txt, fontFamily:fontDisp }}>{st}</span>
                              </div>
                              {i < 9 && <ChevronRight size={10} color={T.txt3} style={{ opacity:0.35 }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── D: Reglas + Seguimiento ── */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.9fr", gap:10, marginBottom:10 }}>

                      {/* Reglas Operativas */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.03)", border:"1px solid rgba(239,68,68,0.15)" }}>
                        {sectionHd("6. Reglas Operativas", "#EF4444")}
                        {metaProtocol.reglasOp.map((r, i) => (
                          <div key={i} style={{ display:"flex", gap:7, marginBottom:7, alignItems:"flex-start" }}>
                            <AlertCircle size={11} color="#EF4444" style={{ marginTop:2, flexShrink:0 }} />
                            <E val={r} onSave={v=>setMetaProtocol(p=>{const arr=[...p.reglasOp];arr[i]=v;return{...p,reglasOp:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                          </div>
                        ))}
                      </div>

                      {/* Seguimiento Fases */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(126,184,240,0.05)":"rgba(126,184,240,0.03)", border:`1px solid ${T.blue}20` }}>
                        {sectionHd("7. Fases de Seguimiento", T.blue)}
                        <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }}>Las ventas ocurren hasta después de 30–45 intentos. <strong style={{ color:T.txt }}>No abandonar sin razón clara.</strong></p>
                        {metaProtocol.seguimientoFases.map((f, i) => {
                          const fc = i===0?"#60A5FA":i===1?"#34D399":i===2?"#A78BFA":"#F59E0B";
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"7px 9px", borderRadius:8, background:`${fc}09`, border:`1px solid ${fc}18` }}>
                              <span style={{ fontSize:9, fontWeight:800, color:fc, background:`${fc}18`, padding:"2px 7px", borderRadius:99, flexShrink:0, fontFamily:fontDisp, whiteSpace:"nowrap" }}>{f.range}</span>
                              <E val={f.desc} onSave={v=>setMetaProtocol(p=>{const arr=[...p.seguimientoFases];arr[i]={...arr[i],desc:v};return{...p,seguimientoFases:arr};})} style={{ fontSize:11.5, color:T.txt2, fontFamily:font, flex:1 }} />
                            </div>
                          );
                        })}
                      </div>

                      {/* Frecuencia */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(52,211,153,0.04)":"rgba(52,211,153,0.025)", border:`1px solid ${T.accent}18` }}>
                        {sectionHd("Frecuencia", T.accent)}
                        {metaProtocol.seguimientoFreq.map((f, i) => (
                          <div key={i} style={{ padding:"9px 11px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.04)", border:`1px solid ${f.color}22` }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:f.color, fontFamily:fontDisp }}>{f.tipo}</span>
                              <E val={f.freq} onSave={v=>setMetaProtocol(p=>{const arr=[...p.seguimientoFreq];arr[i]={...arr[i],freq:v};return{...p,seguimientoFreq:arr};})} style={{ fontSize:10.5, fontWeight:600, color:T.txt2, fontFamily:fontDisp }} />
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop:4, padding:"8px 10px", borderRadius:8, background:`${T.accent}08`, border:`1px solid ${T.accent}16` }}>
                          <p style={{ margin:"0 0 2px", fontSize:8, fontWeight:700, color:T.accent, fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>Reglas</p>
                          <p style={{ margin:0, fontSize:10, color:T.txt3, fontFamily:font, lineHeight:1.55 }}>No repetir mensajes · Cada contacto aporta valor · Siempre cerrar con siguiente paso</p>
                        </div>
                      </div>
                    </div>

                    {/* ── E: KPIs (4 cards) ── */}
                    <div style={{ marginBottom:10 }}>
                      {sectionHd("9. KPIs Clave", T.violet)}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                        {metaProtocol.kpis.map((k, i) => (
                          <div key={i} style={{ padding:"11px 12px", borderRadius:12, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.04)", border:`1px solid ${k.color}25` }}>
                            <p style={{ margin:"0 0 8px", fontSize:9.5, fontWeight:800, color:k.color, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>{k.cat}</p>
                            {k.items.map((item, ii) => (
                              <div key={ii} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                                <div style={{ width:4, height:4, borderRadius:"50%", background:k.color, marginTop:6, flexShrink:0 }} />
                                <span style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.45 }}>{item}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── F: Alertas + Errores + Principio Final ── */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>

                      {/* Alertas */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(245,158,11,0.05)":"rgba(245,158,11,0.03)", border:"1px solid rgba(245,158,11,0.20)" }}>
                        {sectionHd("10. Alertas", "#F59E0B")}
                        {metaProtocol.alertas.map((al, i) => (
                          <div key={i} style={{ display:"flex", gap:7, marginBottom:6, alignItems:"flex-start" }}>
                            <Bell size={11} color="#F59E0B" style={{ marginTop:2, flexShrink:0 }} />
                            <E val={al} onSave={v=>setMetaProtocol(p=>{const arr=[...p.alertas];arr[i]=v;return{...p,alertas:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                          </div>
                        ))}
                      </div>

                      {/* Errores Críticos */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(248,113,113,0.05)":"rgba(248,113,113,0.03)", border:"1px solid rgba(248,113,113,0.18)" }}>
                        {sectionHd("11. Errores Críticos", "#F87171")}
                        {metaProtocol.errores.map((er, i) => (
                          <div key={i} style={{ display:"flex", gap:7, marginBottom:6, alignItems:"flex-start" }}>
                            <X size={11} color="#F87171" style={{ marginTop:2, flexShrink:0 }} />
                            <E val={er} onSave={v=>setMetaProtocol(p=>{const arr=[...p.errores];arr[i]=v;return{...p,errores:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                          </div>
                        ))}
                        <div style={{ marginTop:8, padding:"8px 10px", borderRadius:8, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.16)" }}>
                          <p style={{ margin:"0 0 2px", fontSize:8.5, fontWeight:800, color:"#F87171", fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>12. Cierre de Proceso</p>
                          <E val={metaProtocol.cierre} onSave={v=>setMetaProtocol(p=>({...p,cierre:v}))} multi style={{ fontSize:10, color:T.txt2, fontFamily:font, lineHeight:1.55 }} />
                        </div>
                      </div>

                      {/* Principio Final */}
                      <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(110,231,194,0.08)":"rgba(110,231,194,0.04)", border:`1px solid ${T.accent}25`, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                        {sectionHd("13. Principio Final", T.accent)}
                        <div style={{ textAlign:"center", padding:"10px 0" }}>
                          <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt3, fontFamily:font, lineHeight:1.6 }}>No gana el que más leads tiene.</p>
                          <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.02em" }}>Gana el que mejor los trabaja.</p>
                          <div style={{ padding:"12px 14px", borderRadius:10, background:`${T.accent}10`, border:`1px solid ${T.accent}25` }}>
                            <E val={metaProtocol.principioFinal} onSave={v=>setMetaProtocol(p=>({...p,principioFinal:v}))} style={{ fontSize:15, fontWeight:800, color:T.accent, fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center", lineHeight:1.4 }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── G: BANT + Objeciones ── */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                          <div style={{ width:3, height:13, borderRadius:2, background:T.blue }} />
                          <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:T.blue }}>8. Calificación BANT · Stratos AI</span>
                        </div>
                        {metaProtocol.qualification.map((q, qi) => (
                          <div key={qi} style={{ padding:"9px 12px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                              <span style={{ fontSize:8.5, fontWeight:800, color:T.blue, background:`${T.blue}14`, borderRadius:5, padding:"2px 7px", flexShrink:0 }}>{q.label}</span>
                            </div>
                            <E val={q.q} onSave={v => setMetaProtocol(p => { const qq=[...p.qualification]; qq[qi]={...qq[qi],q:v}; return {...p,qualification:qq}; })} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                          <div style={{ width:3, height:13, borderRadius:2, background:"#F87171" }} />
                          <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:"#F87171" }}>Manejo de Objeciones</span>
                        </div>
                        {metaProtocol.objections.map((o, oi) => (
                          <div key={oi} style={{ padding:"9px 12px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                            <E val={o.obj} onSave={v => setMetaProtocol(p => { const ob=[...p.objections]; ob[oi]={...ob[oi],obj:v}; return {...p,objections:ob}; })} style={{ fontSize:11, fontWeight:700, color:"#F87171", fontFamily:fontDisp, marginBottom:4 }} />
                            <E val={o.resp} onSave={v => setMetaProtocol(p => { const ob=[...p.objections]; ob[oi]={...ob[oi],resp:v}; return {...p,objections:ob}; })} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── H: SLA Table ── */}
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                        <div style={{ width:3, height:13, borderRadius:2, background:T.violet }} />
                        <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:T.violet }}>SLA de Respuesta · Tiempos Críticos</span>
                      </div>
                      <div style={{ borderRadius:11, overflow:"hidden", border:`1px solid ${T.border}` }}>
                        <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 0.7fr 1.2fr", padding:"7px 12px", background:isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.04)", borderBottom:`1px solid ${T.border}` }}>
                          {["Evento","Respuesta","Tiempo","Responsable"].map(h => (
                            <span key={h} style={{ fontSize:8.5, fontWeight:700, color:T.txt2, fontFamily:fontDisp, letterSpacing:"0.05em", textTransform:"uppercase" }}>{h}</span>
                          ))}
                        </div>
                        {metaProtocol.slas.map((sl, si) => (
                          <div key={si} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 0.7fr 1.2fr", padding:"8px 12px", borderBottom: si < metaProtocol.slas.length-1 ? `1px solid ${T.border}` : "none", background: si%2===0 ? "transparent" : (isLight?"rgba(0,0,0,0.015)":"rgba(255,255,255,0.015)") }}>
                            <E val={sl.trigger} onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],trigger:v}; return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                            <E val={sl.resp}    onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],resp:v};    return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                            <E val={sl.time}    onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],time:v};    return {...p,slas:ss}; })} style={{ fontSize:11, fontWeight:700, color:T.accent, fontFamily:fontDisp }} />
                            <E val={sl.owner}   onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],owner:v};   return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt2, fontFamily:font }} />
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>
          </>
        );
      })()}

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
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.03) 0%, transparent 55%), #0C0E14`, display: "flex", flexDirection: "column", fontFamily: pfb }}>
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
