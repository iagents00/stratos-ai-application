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
      {/* ─── PILL — Centro de Inteligencia — Liquid Glass ────────────────
          Minimalista: una sola fuente de color (el átomo en tema claro).
          Dark: vidrio neutral sin ningún tinte de color — solo blanco y negro.
          Light: átomo verde accent, vidrio blanco, specular sutil.
          Sin punto de notificación — el átomo girando ya indica "sistema vivo".
          ──────────────────────────────────────────────────────────────── */}
      <div
        title="Centro de Inteligencia"
        onClick={() => { if (!expanded) { onExpand?.(); } }}
        style={{
          position: "relative",
          height: 34, width: 220, borderRadius: 50,

          background: isLight
            ? "rgba(255,255,255,0.88)"
            : "rgba(0,0,0,0.90)",

          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",

          border: isLight
            ? "1px solid rgba(255,255,255,0.85)"
            : "1px solid rgba(255,255,255,0.08)",

          boxShadow: isLight
            ? "0 4px 18px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)"
            : "0 8px 32px rgba(0,0,0,0.72), 0 2px 6px rgba(0,0,0,0.45)",

          display: expanded ? "none" : "flex",
          alignItems: "center", justifyContent: "center",
          padding: "0 14px", gap: 0, overflow: "hidden",
          cursor: "pointer",
          transition: "transform 0.24s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s ease, box-shadow 0.22s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.026)";
          e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.18)";
          e.currentTarget.style.boxShadow = isLight
            ? "inset 0 1px 0 rgba(255,255,255,1.0), 0 6px 24px rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.08)"
            : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.22), 0 10px 36px rgba(0,0,0,0.65), 0 3px 9px rgba(0,0,0,0.46)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.10)";
          e.currentTarget.style.boxShadow = isLight
            ? "inset 0 1px 0 rgba(255,255,255,1.0), 0 4px 18px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.07)"
            : "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.18), 0 6px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.38)";
        }}
        onMouseDown={e => {
          e.currentTarget.style.transform = "scale(0.96)";
          e.currentTarget.style.transition = "transform 0.10s ease";
        }}
        onMouseUp={e => {
          e.currentTarget.style.transition = "transform 0.24s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s ease, box-shadow 0.22s ease";
          e.currentTarget.style.transform = "scale(1.026)";
        }}
      >
        {/* ── Specular arc — glass rim catching light (solo en light) ── */}
        {isLight && (
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%", height: "50%",
            background: "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.45) 40%, transparent 70%)",
            borderRadius: "50% 50% 0 0 / 80% 80% 0 0",
            pointerEvents: "none",
          }} />
        )}

        {/* ── Shimmer — periodic light beam (color-neutral) ── */}
        <div style={{
          position: "absolute", inset: 0,
          background: isLight
            ? "linear-gradient(108deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)"
            : "linear-gradient(108deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)",
          animation: "pillShimmer 7s cubic-bezier(0.4,0,0.6,1) 2.5s infinite",
          pointerEvents: "none", borderRadius: "inherit",
        }} />

        {/* ── Content ── */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6, width: "100%",
        }}>
          {/* Live green pulse dot */}
          <div style={{
            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
            background: "#34D399",
            boxShadow: "0 0 6px rgba(52,211,153,0.90), 0 0 12px rgba(52,211,153,0.40)",
            animation: "pulse 2.4s ease-in-out infinite",
          }} />

          <span style={{
            fontSize: 12.5,
            color: isLight ? "#0A6448" : "rgba(255,255,255,0.88)",
            fontWeight: 500,
            letterSpacing: "-0.022em",
            fontFamily: fontDisp,
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

/* ─── Score bar helper ─── */
const ScoreBar = ({ sc, compact, isLight = false }) => {
  const c = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.cyan : P.violet;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}40`, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: c, fontFamily: fontDisp, minWidth: 20, textAlign: "right" }}>{sc}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════
   STAGE BADGE — selector de etapa (st) interactivo y reutilizable.
   El asesor ve la etapa actual como pill coloreada (stgC[lead.st]) y al hacer
   clic se despliega un menú con todas las etapas para cambiarla en un clic.
   Usa la paleta del stage de forma theme-aware y es segura AA en light.

   Props:
   · lead     — el cliente (debe tener .st)
   · onUpdate — callback que recibe el lead modificado
   · T        — tema (P dark | LP light)
   · compact  — variante pequeña para CRM list/cards
═══════════════════════════════════════════ */
const StageBadge = ({ lead, onUpdate, T = P, compact = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isLight = T !== P;

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!lead) return null;
  const stageColor = stgC[lead.st] || T.txt3;
  const stageColorSafe = isLight ? `color-mix(in srgb, ${stageColor} 62%, #0B1220 38%)` : stageColor;

  const handleSelect = (st) => {
    if (st === lead.st) { setOpen(false); return; }
    onUpdate?.({ ...lead, st });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: compact ? "5px 9px 5px 9px" : "7px 11px 7px 10px",
          borderRadius: 99,
          background: isLight ? `${stageColor}16` : `${stageColor}1E`,
          border: `1px solid ${isLight ? `${stageColor}55` : `${stageColor}44`}`,
          color: stageColorSafe,
          fontSize: compact ? 10 : 11, fontWeight: 700, fontFamily: fontDisp,
          letterSpacing: "0.01em", cursor: "pointer",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = isLight ? `${stageColor}26` : `${stageColor}2C`; }}
        onMouseLeave={e => { e.currentTarget.style.background = isLight ? `${stageColor}16` : `${stageColor}1E`; }}
      >
        <span style={{
          width: compact ? 7 : 8, height: compact ? 7 : 8, borderRadius: 99,
          background: stageColor, boxShadow: `0 0 6px ${stageColor}99`, flexShrink: 0,
        }} />
        {lead.st}
        <ChevronDown size={compact ? 9 : 10} strokeWidth={2.4} style={{ opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
          minWidth: 210,
          background: isLight ? "#FFFFFF" : "#111318",
          border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : T.borderH}`,
          borderRadius: 12,
          boxShadow: isLight
            ? "0 12px 28px rgba(15,23,42,0.16), 0 3px 8px rgba(15,23,42,0.08)"
            : "0 10px 32px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)",
          padding: 4, maxHeight: 320, overflowY: "auto",
        }}>
          <p style={{ margin: "6px 10px 6px", fontSize: 9, fontWeight: 800, color: T.txt3, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: fontDisp }}>Cambiar etapa</p>
          {STAGES.map(st => {
            const c = stgC[st] || T.txt3;
            const cSafe = isLight ? `color-mix(in srgb, ${c} 62%, #0B1220 38%)` : c;
            const active = lead.st === st;
            return (
              <button key={st} onClick={() => handleSelect(st)} style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                background: active ? (isLight ? `${c}14` : `${c}1E`) : "transparent",
                border: "none",
                color: active ? cSafe : (isLight ? T.txt : T.txt2),
                fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: font,
                textAlign: "left", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "background 0.12s",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0, boxShadow: active ? `0 0 8px ${c}` : "none" }} />
                <span style={{ flex: 1 }}>{st}</span>
                {active && <CheckCircle2 size={12} strokeWidth={2.4} style={{ color: cSafe }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   FOLLOW UP BADGE — contador de seguimientos / recontactos al cliente.
   El vendedor cada vez que contacta al cliente (llamada, WA, email) pulsa +1
   y queda registrado cuántos seguimientos lleva + fecha del último.
   Click en el contador abre un panel con el detalle y la opción de deshacer.

   Props iguales que StageBadge.
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   FollowUpBadge — stepper compacto para registrar seguimientos.
   Permite subir/bajar con − y + o escribir el número directamente
   (click en el dígito → input numérico). La fecha del último contacto
   se guarda automáticamente solo al incrementar (no al bajar ni editar
   a un número menor, para no falsear la señal temporal).

   Variantes:
   · compact   — pill ultra-compacto para filas de tabla (altura 26).
   · fullWidth — ancho completo con "Último: …" inline (tarjetas).
   · default   — intermedio (drawers).
   ═══════════════════════════════════════════════════════════════ */
const FollowUpBadge = ({ lead, onUpdate, T = P, compact = false, fullWidth = false, tint = null }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const [pulse, setPulse]     = useState(false);
  const inputRef = useRef(null);
  const isLight = T !== P;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  if (!lead) return null;
  const count = lead.seguimientos || 0;
  const accentC = tint || T.blue || "#60A5FA";
  const accentSafe = isLight ? `color-mix(in srgb, ${accentC} 62%, #0B1220 38%)` : accentC;

  // Aplica un nuevo valor (clampeado 0..999). Solo guarda la cuenta — sin
  // timestamps ni metadata de "último contacto" para mantener la UI limpia.
  const commitValue = (next) => {
    const clamped = Math.max(0, Math.min(999, Number.isFinite(next) ? next : 0));
    onUpdate?.({ ...lead, seguimientos: clamped });
    setPulse(true);
    setTimeout(() => setPulse(false), 260);
  };

  const inc = (e) => { e?.stopPropagation?.(); commitValue(count + 1); };
  const dec = (e) => { e?.stopPropagation?.(); if (count > 0) commitValue(count - 1); };

  const openEdit = (e) => { e?.stopPropagation?.(); setDraft(String(count)); setEditing(true); };
  const cancelEdit = () => { setEditing(false); };
  const commitEdit = () => {
    const parsed = parseInt(draft.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) commitValue(parsed);
    setEditing(false);
  };

  // Estado binario: ¿hay seguimientos registrados? — determina el lenguaje visual
  const isEmpty = count === 0;

  // ────────────────────────────────────────────────────────────────────────
  // fullWidth — variante pro para las tarjetas de clientes en prioridad.
  // Diseño Apple-like con dos estados muy diferenciados:
  //
  //   ESTADO VACÍO (count = 0):
  //     • Superficie neutra (glass sutil), sin tinte de color
  //     • Centro: "Registrar primer seguimiento" — CTA conversacional
  //     • + destacado (bg accent relleno, contraste fuerte) invita a empezar
  //
  //   ESTADO CON REGISTROS (count > 0):
  //     • Superficie con tinte accent (~6% dark · 5% light)
  //     • Centro: número gigante (24px bold) + caption "seguimiento(s)"
  //     • + sutil (tinte accent ligero), el peso está en el número
  //     • ↺ reset aparece como micro-botón ghost (solo count ≥ 2)
  //
  // En ambos estados los botones son ghost (sin bg por defecto, bg en hover).
  // El pulse de 260ms al cambiar da feedback kinestésico.
  // ────────────────────────────────────────────────────────────────────────
  if (fullWidth) {
    const pillBg = isEmpty
      ? (isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)")
      : (isLight ? `${accentC}0D` : `${accentC}0E`);
    const pillBorder = isEmpty
      ? (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)")
      : (isLight ? `${accentC}2E` : `${accentC}22`);

    return (
      <div onClick={e => e.stopPropagation()} style={{
        display: "flex", alignItems: "stretch", width: "100%",
        height: 46, borderRadius: 12,
        background: pillBg,
        border: `1px solid ${pillBorder}`,
        overflow: "hidden", position: "relative",
        transform: pulse ? "scale(1.018)" : "scale(1)",
        boxShadow: pulse
          ? `0 0 0 3px ${accentC}2C, 0 6px 20px ${accentC}36`
          : (isLight ? `0 1px 2px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.55)` : "inset 0 1px 0 rgba(255,255,255,0.025)"),
        transition: "transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1), background 0.22s, border-color 0.22s",
      }}>

        {/* ─── − (minus) ────────────────────────────────────────────────
            Ghost discreto; desaparece visualmente cuando no hay nada que
            restar (opacidad reducida + cursor not-allowed). */}
        <button
          onClick={dec}
          disabled={isEmpty}
          title="Restar un seguimiento"
          aria-label="Restar un seguimiento"
          style={{
            width: 46, height: "100%", padding: 0, border: "none",
            background: "transparent",
            color: isEmpty ? T.txt3 : accentSafe,
            opacity: isEmpty ? 0.32 : 0.85,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: isEmpty ? "not-allowed" : "pointer",
            borderRight: `1px solid ${isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.04)"}`,
            transition: "background 0.15s, opacity 0.15s, color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            if (!isEmpty) {
              e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)";
              e.currentTarget.style.opacity = "1";
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.opacity = isEmpty ? "0.32" : "0.85";
          }}
        >
          <Minus size={15} strokeWidth={2.6} />
        </button>

        {/* ─── Zona central — número + caption (o CTA vacío) ──────────── */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0, height: "100%",
              padding: 0, margin: 0,
              border: "none", outline: "none",
              background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
              color: accentSafe,
              fontSize: 22, fontWeight: 800, fontFamily: fontDisp,
              letterSpacing: "-0.03em", textAlign: "center",
              fontVariantNumeric: "tabular-nums",
              boxShadow: `inset 0 0 0 2px ${accentC}55`,
            }}
          />
        ) : (
          <button
            onClick={openEdit}
            title={isEmpty ? "Click para registrar el primer seguimiento" : "Click para editar el número"}
            style={{
              flex: 1, minWidth: 0, height: "100%",
              padding: "0 14px", margin: 0,
              border: "none", background: "transparent",
              cursor: "text",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 9,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {isEmpty ? (
              // Estado vacío — prompt conversacional, no un "0" frío.
              <>
                <Phone size={11} strokeWidth={2.4} color={T.txt3} style={{ opacity: 0.75 }} />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: T.txt3, fontFamily: font,
                  letterSpacing: "0.005em",
                }}>
                  Registrar primer seguimiento
                </span>
              </>
            ) : (
              // Estado con registros — número como protagonista.
              <>
                <Phone size={11} strokeWidth={2.6} color={accentSafe} style={{ opacity: 0.55, flexShrink: 0 }} />
                <span style={{
                  fontSize: 22, fontWeight: 800, fontFamily: fontDisp,
                  letterSpacing: "-0.03em", lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  color: accentSafe,
                }}>{count}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: T.txt3,
                  letterSpacing: "0.01em", fontFamily: font,
                  whiteSpace: "nowrap", lineHeight: 1,
                }}>
                  {count === 1 ? "seguimiento" : "seguimientos"}
                </span>
              </>
            )}
          </button>
        )}


        {/* ─── + (plus) — CTA principal ────────────────────────────────
            Vacío: bg relleno en accent → invita a empezar.
            Con registros: ghost tintado → acción secundaria. */}
        <button
          onClick={inc}
          title="Registrar un nuevo seguimiento"
          aria-label="Registrar un nuevo seguimiento"
          style={{
            width: 46, height: "100%", padding: 0, border: "none",
            borderLeft: isEmpty
              ? "none"
              : `1px solid ${isLight ? `${accentC}1F` : `${accentC}18`}`,
            background: isEmpty
              ? `linear-gradient(180deg, ${accentC} 0%, ${isLight ? "#14B892" : `${accentC}DD`} 100%)`
              : (isLight ? `${accentC}1C` : `${accentC}16`),
            color: isEmpty ? "#FFFFFF" : accentSafe,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.18s, transform 0.18s, box-shadow 0.18s",
            flexShrink: 0,
            boxShadow: isEmpty
              ? `inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px ${accentC}45`
              : "none",
          }}
          onMouseEnter={e => {
            if (isEmpty) {
              e.currentTarget.style.transform = "scale(1.04)";
              e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 12px ${accentC}60`;
            } else {
              e.currentTarget.style.background = isLight ? `${accentC}2E` : `${accentC}28`;
            }
          }}
          onMouseLeave={e => {
            if (isEmpty) {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px ${accentC}45`;
            } else {
              e.currentTarget.style.background = isLight ? `${accentC}1C` : `${accentC}16`;
            }
          }}
        >
          <Plus size={16} strokeWidth={2.8} />
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // compact / default — pill inline para tabla, kanban y drawers.
  //
  // PROGRESSIVE DISCLOSURE (clave de intuitividad):
  //   count = 0 → pill compacto con CTA "+ Registrar" (ícono ☎+ + label)
  //               nadie quiere restar de 0; mostrar [− 0 +] es ruido inútil.
  //   count ≥ 1 → stepper completo [☎ − N seguim. +] con semántica clara.
  //
  // compact (tabla, h=26): versión densa para listados, sin texto "seguim."
  // default (drawer, h=32): más aire, con mini-label "seguim." tras el número.
  //
  // Ambos: hover del + crece ligeramente (feedback kinestésico), pulse 260ms
  // al registrar, tabular-nums para estabilidad del dígito.
  // ────────────────────────────────────────────────────────────────────────
  const H       = compact ? 28 : 32;
  const btnW    = compact ? 24 : 28;
  const numFS   = compact ? 12 : 13;
  const iconSz  = compact ? 11 : 12;
  const numMinW = compact ? 18 : 20;

  // ── Estado vacío: un solo CTA "+ Registrar" — mucho más intuitivo que [− 0 +]
  if (isEmpty && !editing) {
    return (
      <button
        onClick={inc}
        onMouseEnter={e => {
          e.currentTarget.style.background = isLight ? `${accentC}18` : `${accentC}1C`;
          e.currentTarget.style.borderColor = isLight ? `${accentC}55` : `${accentC}44`;
          e.currentTarget.style.color = accentSafe;
          e.currentTarget.style.transform = "translateY(-0.5px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isLight ? `${accentC}0C` : `${accentC}10`;
          e.currentTarget.style.borderColor = isLight ? `${accentC}2E` : `${accentC}26`;
          e.currentTarget.style.color = accentSafe;
          e.currentTarget.style.transform = "translateY(0)";
        }}
        title="Registrar el primer seguimiento al cliente"
        aria-label="Registrar primer seguimiento"
        style={{
          display: "inline-flex", alignItems: "center", gap: compact ? 5 : 6,
          height: H, padding: compact ? "0 10px 0 9px" : "0 12px 0 11px",
          borderRadius: 99,
          background: isLight ? `${accentC}0C` : `${accentC}10`,
          border: `1px dashed ${isLight ? `${accentC}2E` : `${accentC}26`}`,
          color: accentSafe,
          fontSize: compact ? 11 : 12, fontWeight: 700, fontFamily: fontDisp,
          letterSpacing: "0.01em",
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
          boxShadow: pulse ? `0 0 0 3px ${accentC}22` : "none",
        }}
      >
        <Plus size={iconSz + 2} strokeWidth={2.8} style={{ marginLeft: -2 }} />
        {compact ? "Registrar" : "Registrar seguimiento"}
      </button>
    );
  }

  // ── Stepper (count ≥ 1): [☎ − N (seguim.) +] — el "+" es la acción primaria.
  return (
    <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      <div
        onClick={e => e.stopPropagation()}
        title={`${count} seguimiento${count === 1 ? "" : "s"} registrado${count === 1 ? "" : "s"} — click + para sumar otro`}
        style={{
          display: "inline-flex", alignItems: "stretch",
          height: H, borderRadius: 99,
          background: isLight ? `${accentC}0E` : `${accentC}12`,
          border: `1px solid ${isLight ? `${accentC}33` : `${accentC}28`}`,
          overflow: "hidden",
          transform: pulse ? "scale(1.06)" : "scale(1)",
          boxShadow: pulse ? `0 0 0 3px ${accentC}26, 0 3px 12px ${accentC}33` : "none",
          transition: "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s, background 0.18s, border-color 0.18s",
          flexShrink: 0,
        }}
      >
        {/* ☎ signifier — solo en variante default (drawers) */}
        {!compact && (
          <div aria-hidden="true" style={{
            width: 20, height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, color: accentSafe, opacity: 0.9,
            paddingLeft: 6,
          }}>
            <Phone size={iconSz} strokeWidth={2.5} />
          </div>
        )}

        {/* − restar (secundario) */}
        <button
          onClick={dec}
          title="Corregir: restar un seguimiento"
          aria-label="Restar un seguimiento"
          style={{
            width: btnW, height: "100%", padding: 0, border: "none",
            background: "transparent",
            color: accentSafe, opacity: 0.7,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.14s, opacity 0.14s",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isLight ? `${accentC}1C` : `${accentC}20`;
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.opacity = "0.7";
          }}
        >
          <Minus size={iconSz} strokeWidth={2.8} />
        </button>

        {/* Número — click edita directo. En default añade mini-label "seguim." */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              width: (compact ? numMinW : numMinW + 42),
              height: "100%", padding: 0, margin: 0,
              border: "none", outline: "none",
              background: isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.04)",
              color: accentSafe,
              fontSize: numFS, fontWeight: 800, fontFamily: fontDisp,
              letterSpacing: "-0.015em", textAlign: "center",
              fontVariantNumeric: "tabular-nums",
              boxShadow: `inset 0 0 0 1.5px ${accentC}55`,
            }}
          />
        ) : (
          <button
            onClick={openEdit}
            title="Click para escribir el número directamente"
            style={{
              height: "100%", padding: compact ? "0 3px" : "0 5px",
              border: "none", background: "transparent",
              color: accentSafe, cursor: "text",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
              transition: "background 0.14s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? `${accentC}16` : `${accentC}1A`}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{
              fontSize: numFS, fontWeight: 800, fontFamily: fontDisp,
              letterSpacing: "-0.015em",
              fontVariantNumeric: "tabular-nums",
              minWidth: numMinW, textAlign: "center",
              lineHeight: 1,
            }}>{count}</span>
            {!compact && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: `${accentC}B0`,
                letterSpacing: "0.03em", fontFamily: font, textTransform: "lowercase",
                opacity: 0.85,
                lineHeight: 1, whiteSpace: "nowrap",
              }}>{count === 1 ? "seguimiento" : "seguimientos"}</span>
            )}
          </button>
        )}

        {/* + sumar (PRIMARIO) — bg relleno sutil, hover con micro-scale */}
        <button
          onClick={inc}
          title="Registrar un nuevo seguimiento"
          aria-label="Registrar un nuevo seguimiento"
          style={{
            width: btnW, height: "100%", padding: 0, border: "none",
            background: isLight
              ? `linear-gradient(180deg, ${accentC}28, ${accentC}18)`
              : `linear-gradient(180deg, ${accentC}26, ${accentC}14)`,
            borderLeft: `1px solid ${isLight ? `${accentC}26` : `${accentC}20`}`,
            color: accentSafe,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.16s, box-shadow 0.16s",
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 ${isLight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)"}`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isLight
              ? `linear-gradient(180deg, ${accentC}40, ${accentC}28)`
              : `linear-gradient(180deg, ${accentC}38, ${accentC}22)`;
            e.currentTarget.style.boxShadow = `inset 0 1px 0 ${isLight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)"}, 0 0 10px ${accentC}40`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isLight
              ? `linear-gradient(180deg, ${accentC}28, ${accentC}18)`
              : `linear-gradient(180deg, ${accentC}26, ${accentC}14)`;
            e.currentTarget.style.boxShadow = `inset 0 1px 0 ${isLight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)"}`;
          }}
        >
          <Plus size={iconSz + 1} strokeWidth={2.9} />
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   NEXT ACTION HERO — el elemento MÁS IMPORTANTE de cada drawer del cliente.
   Pattern: el asesor abre un cliente → primero ve qué tiene que hacer HOY.
   Se usa idéntico en los 3 drawers (Análisis IA · Perfil · Expediente)
   para que el asesor tenga siempre la acción clave a la vista.

   Diseño aesthetic-pro:
   · Barra vertical mint de 5 px (accent rail) a la izquierda — firma visual.
   · Halo radial sutil superior-derecha.
   · Header con chip ZAP + badge "ACCIÓN CLAVE" animado + fecha pill.
   · Texto de acción grande (15.5 px, SF Pro Display, weight 600).
   · Quick actions inline: Llamar · WhatsApp · Ver más — realmente
     accionable, no solo decorativo.
   · Theme-aware (claro/oscuro), márgenes matemáticos 12-18-20.
   · Placeholder cálido en cursiva cuando no hay acción registrada. */
const NextActionHero = ({ lead, T = P, onUpdate = null }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [draftA, setDraftA]     = useState("");
  const [draftD, setDraftD]     = useState("");
  const isLight = T !== P;
  if (!lead) return null;

  const hasAction  = !!(lead.nextAction && lead.nextAction.trim());
  const actionText = hasAction
    ? lead.nextAction
    : "Sin próxima acción definida. Agrega una para activar el cierre con este cliente.";
  const dateText   = lead.nextActionDate || "";
  const LONG = 160;
  const isLong   = actionText.length > LONG;
  const showFull = !isLong || expanded;
  const canEdit  = typeof onUpdate === "function";

  const openEdit = (e) => {
    e?.stopPropagation?.();
    setDraftA(lead.nextAction || "");
    setDraftD(lead.nextActionDate || "");
    setEditing(true);
  };
  const saveEdit = () => {
    onUpdate?.({ ...lead, nextAction: draftA.trim(), nextActionDate: draftD.trim() });
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const accentStrong = isLight ? (T.accentDark || T.accent) : T.accent;
  const textMain     = isLight ? T.txt : "#F1F5F9";
  const phoneClean   = (lead.phone || "").replace(/[^0-9+]/g, "");
  const waPhone      = (lead.phone || "").replace(/[^0-9]/g, "");

  return (
    <div style={{
      position: "relative",
      borderRadius: 16,
      flexShrink: 0,
      padding: "14px 16px 14px 20px",
      background: isLight
        ? `linear-gradient(180deg, ${T.accent}14 0%, ${T.accent}06 100%)`
        : `linear-gradient(180deg, ${T.accent}1E 0%, ${T.accent}08 100%)`,
      border: `1.5px solid ${isLight ? `${T.accent}4A` : `${T.accent}3A`}`,
      boxShadow: isLight
        ? `0 1px 3px ${T.accent}14, 0 8px 22px ${T.accent}1A, inset 0 1px 0 rgba(255,255,255,0.7)`
        : `0 0 0 1px ${T.accent}14, 0 6px 22px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.05)`,
      isolation: "isolate",
    }}>
      {/* Accent rail vertical — firma visual mint que grita "esto es lo más importante" */}
      <div style={{
        position: "absolute", left: 0, top: 10, bottom: 10, width: 4,
        borderRadius: "0 4px 4px 0",
        background: isLight
          ? `linear-gradient(180deg, ${T.accent} 0%, ${T.accentDark || T.accent} 100%)`
          : `linear-gradient(180deg, ${T.accent} 0%, ${T.accent}AA 100%)`,
        boxShadow: `0 0 12px ${T.accent}${isLight ? "55" : "66"}`,
      }} />

      {/* Mini header row — etiqueta + fecha. Sin borderBottom para que fluya */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 8, flexWrap: "wrap",
        position: "relative",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7,
          background: isLight
            ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
            : `linear-gradient(135deg, ${T.accent}3C 0%, ${T.accent}18 100%)`,
          border: `1px solid ${isLight ? "transparent" : T.accentB}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: isLight
            ? `0 2px 6px ${T.accent}44, inset 0 1px 0 rgba(255,255,255,0.4)`
            : `0 0 10px ${T.accent}40`,
        }}>
          <Zap size={12} color={isLight ? "#FFFFFF" : accentStrong} strokeWidth={2.6} fill={isLight ? "#FFFFFF" : "none"} />
        </div>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: accentStrong, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: fontDisp }}>Próxima acción</p>
        <span style={{
          fontSize: 8.5, fontWeight: 800, color: accentStrong,
          background: isLight ? `${T.accent}22` : `${T.accent}2A`,
          border: `1px solid ${isLight ? `${T.accent}55` : T.accentB}`,
          padding: "2px 7px", borderRadius: 99, letterSpacing: "0.1em",
          fontFamily: fontDisp, animation: "pulse 2.4s ease-in-out infinite",
          flexShrink: 0,
        }}>CLAVE</span>
        {dateText && !editing && (
          <span style={{
            marginLeft: "auto",
            fontSize: 10, fontWeight: 700, color: accentStrong,
            background: isLight ? "#FFFFFF" : `${T.accent}16`,
            border: `1px solid ${isLight ? `${T.accent}55` : T.accentB}`,
            padding: "3px 9px", borderRadius: 99, fontFamily: fontDisp,
            letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0,
            boxShadow: isLight ? `0 1px 3px ${T.accent}22, inset 0 1px 0 rgba(255,255,255,0.8)` : "none",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Clock size={9} strokeWidth={2.6} />
            {dateText}
          </span>
        )}
      </div>

      {/* Cuerpo — texto de la acción, clickeable directamente para editar */}
      {!editing && (
        <p
          onClick={canEdit ? openEdit : undefined}
          title={canEdit ? "Click para editar" : undefined}
          style={{
            margin: 0,
            fontSize: 15, lineHeight: 1.5,
            color: hasAction ? textMain : T.txt3,
            fontFamily: fontDisp,
            fontWeight: hasAction ? 600 : 500,
            letterSpacing: "-0.012em",
            fontStyle: hasAction ? "normal" : "italic",
            position: "relative",
            cursor: canEdit ? "text" : "default",
            borderRadius: 8,
            padding: "4px 6px",
            margin: "-4px -6px",
            transition: "background 0.14s",
            ...(showFull ? {} : {
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }),
          }}
          onMouseEnter={e => { if (canEdit) e.currentTarget.style.background = isLight ? `${T.accent}0C` : "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { if (canEdit) e.currentTarget.style.background = "transparent"; }}
        >{actionText}</p>
      )}

      {/* Modo edición — textarea para acción + input para fecha + guardar/cancelar */}
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
          <textarea
            value={draftA}
            onChange={e => setDraftA(e.target.value)}
            autoFocus
            placeholder="¿Qué tienes que hacer con este cliente? Ej: Llamar mañana 10am para confirmar visita, enviar propuesta, agendar Zoom…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px", borderRadius: 10,
              background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isLight ? `${T.accent}55` : T.accentB}`,
              color: textMain, fontSize: 14, lineHeight: 1.45,
              fontFamily: fontDisp, fontWeight: 600, letterSpacing: "-0.01em",
              outline: "none", resize: "vertical", minHeight: 60,
              boxShadow: isLight ? `0 1px 2px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.6)` : "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 180 }}>
              <Clock size={11} color={accentStrong} strokeWidth={2.6} />
              <input
                value={draftD}
                onChange={e => setDraftD(e.target.value)}
                placeholder="Fecha (ej: Hoy 5pm, Mañana 10am, Jueves)"
                style={{
                  flex: 1, padding: "7px 11px", borderRadius: 8,
                  background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isLight ? `${T.accent}44` : T.accentB}`,
                  color: textMain, fontSize: 11.5, fontWeight: 600,
                  fontFamily: fontDisp, letterSpacing: "0.01em",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                onClick={cancelEdit}
                style={{
                  padding: "7px 12px", borderRadius: 8,
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  color: T.txt3, fontSize: 11, fontWeight: 700,
                  fontFamily: fontDisp, letterSpacing: "0.02em",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = T.txt2; e.currentTarget.style.borderColor = T.borderH; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.txt3; e.currentTarget.style.borderColor = T.border; }}
              >Cancelar</button>
              <button
                onClick={saveEdit}
                style={{
                  padding: "7px 14px", borderRadius: 8,
                  background: isLight
                    ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
                    : `linear-gradient(135deg, ${T.accent}28, ${T.accent}10)`,
                  border: `1px solid ${isLight ? "transparent" : T.accentB}`,
                  color: isLight ? "#FFFFFF" : accentStrong,
                  fontSize: 11, fontWeight: 800,
                  fontFamily: fontDisp, letterSpacing: "0.02em",
                  cursor: "pointer", transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: 5,
                  boxShadow: isLight ? `0 2px 6px ${T.accent}40` : "none",
                }}
              ><Save size={11} strokeWidth={2.6} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Ver más / menos */}
      {isLong && !editing && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 8, padding: "4px 11px", borderRadius: 99,
            background: "transparent",
            border: `1px solid ${isLight ? `${T.accent}55` : T.accentB}`,
            color: accentStrong, fontSize: 10, fontWeight: 700,
            fontFamily: fontDisp, letterSpacing: "0.02em",
            cursor: "pointer", transition: "all 0.16s",
            display: "inline-flex", alignItems: "center", gap: 4,
            position: "relative",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `${T.accent}${isLight ? "1A" : "16"}`;
            e.currentTarget.style.borderColor = `${T.accent}${isLight ? "88" : "55"}`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = isLight ? `${T.accent}55` : T.accentB;
          }}
        >
          {expanded ? "Ver menos" : "Ver más"}
          <ChevronDown size={10} strokeWidth={2.6} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      )}

      {/* Quick-action CTAs — hacen la acción realmente ejecutable sin salir del drawer */}
      {hasAction && phoneClean && !editing && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: `1px dashed ${isLight ? `${T.accent}2E` : `${T.accent}22`}`,
          display: "flex", gap: 7, flexWrap: "wrap",
          position: "relative",
        }}>
            <a
              href={`tel:${phoneClean}`}
              style={{
                flex: 1, minWidth: 120,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px", borderRadius: 10,
                background: isLight
                  ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
                  : "rgba(255,255,255,0.92)",
                border: isLight ? "none" : "none",
                color: isLight ? "#FFFFFF" : "#0A0F18",
                fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
                letterSpacing: "0.01em", textDecoration: "none",
                boxShadow: isLight
                  ? `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26, inset 0 1px 0 rgba(255,255,255,0.35)`
                  : "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => {
                if (isLight) {
                  e.currentTarget.style.boxShadow = `0 5px 16px ${T.accent}55, 0 2px 5px ${T.accent}30`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                } else {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                if (isLight) {
                  e.currentTarget.style.boxShadow = `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26`;
                  e.currentTarget.style.transform = "none";
                } else {
                  e.currentTarget.style.background = "rgba(255,255,255,0.92)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              <Phone size={12} strokeWidth={2.4} /> Llamar ahora
            </a>
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank" rel="noreferrer"
              style={{
                flex: 1, minWidth: 120,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px", borderRadius: 10,
                background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.07)",
                border: `1px solid ${isLight ? "rgba(37,211,102,0.45)" : "rgba(255,255,255,0.12)"}`,
                color: isLight ? "#128C7E" : "rgba(255,255,255,0.88)",
                fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
                letterSpacing: "0.01em", textDecoration: "none",
                boxShadow: isLight
                  ? "0 1px 3px rgba(18,140,126,0.14)"
                  : "inset 0 1px 0 rgba(255,255,255,0.08)",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => {
                if (isLight) {
                  e.currentTarget.style.background = "rgba(37,211,102,0.08)";
                  e.currentTarget.style.borderColor = "rgba(37,211,102,0.65)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                } else {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                if (isLight) {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.borderColor = "rgba(37,211,102,0.45)";
                  e.currentTarget.style.transform = "none";
                } else {
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              <MessageCircle size={12} strokeWidth={2.4} /> WhatsApp
            </a>
          </div>
        )}
    </div>
  );
};

/* ─── Notes Modal — Rich sectioned view ─── */
/* ═══════════════════════════════════════════
   DRAWER TAB ISLAND — Pill flotante estilo Dynamic Island, colocada abajo
   en cada drawer (Análisis IA · Perfil · Expediente). Permite al vendedor
   saltar entre las 3 vistas del lead sin cerrar el drawer.
═══════════════════════════════════════════ */
const DRAWER_TABS = [
  { id: "analisis",   label: "Análisis IA", shortLabel: "IA",     colorKey: "accent" },
  { id: "perfil",     label: "Perfil",      shortLabel: "Perfil", colorKey: "violet" },
  { id: "expediente", label: "Expediente",  shortLabel: "Exped.", colorKey: "blue"   },
];

const DrawerTabIsland = ({ current, onSwitch, T = P }) => {
  const isLight = T !== P;
  const safeC = (c) => isLight ? `color-mix(in srgb, ${c} 60%, #0B1220 40%)` : c;

  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 10,
      display: "flex", alignItems: "center", gap: 3,
      padding: 5,
      borderRadius: 999,
      background: isLight
        ? "rgba(255,255,255,0.92)"
        : "rgba(12,17,28,0.78)",
      backdropFilter: "blur(28px) saturate(180%)",
      WebkitBackdropFilter: "blur(28px) saturate(180%)",
      border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
      boxShadow: isLight
        ? "0 14px 32px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)"
        : "0 14px 36px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
      fontFamily: font,
    }}>
      {DRAWER_TABS.map(tab => {
        const active = tab.id === current;
        const color = T[tab.colorKey] || T.accent;
        const txtC  = active ? safeC(color) : (isLight ? T.txt2 : T.txt3);
        const iconNode =
          tab.id === "analisis"   ? <StratosAtom size={13} color={txtC} />
        : tab.id === "perfil"     ? <User size={13} color={txtC} strokeWidth={2.2} />
        :                           <FileText size={13} color={txtC} strokeWidth={2.2} />;

        return (
          <button
            key={tab.id}
            onClick={() => !active && onSwitch?.(tab.id)}
            style={{
              height: 38, padding: "0 14px", borderRadius: 999,
              border: "none",
              background: active
                ? (isLight ? `${color}22` : `${color}26`)
                : "transparent",
              color: txtC,
              fontSize: 12.5, fontWeight: active ? 700 : 600,
              fontFamily: font, letterSpacing: "0.01em",
              cursor: active ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 7,
              transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: active && isLight ? `inset 0 1px 0 rgba(255,255,255,0.55)` : "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = isLight ? T.txt : "#FFFFFF";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = txtC;
              }
            }}
          >
            {iconNode}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   UpdateChatPanel — Actualizar expediente
   ═══════════════════════════════════════════
   Panel deslizable desde el fondo de cualquier drawer.
   El vendedor registra notas, transcripciones y archivos
   tal como lo hace en Telegram — texto libre, voz o adjunto.
   ═══════════════════════════════════════════ */
const UpdateChatPanel = ({ isOpen, onClose, expedienteItems = [], onAddItem, onRemoveItem, T = P }) => {
  const [inputText, setInputText] = useState("");
  const fileInputRef = useRef(null);
  if (!isOpen) return null;

  const isLight = T !== P;
  const titleC  = isLight ? T.txt : "#FFFFFF";
  const accentC = isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent;
  const blueC   = isLight ? `color-mix(in srgb, ${T.blue}   60%, #0B1220 40%)` : T.blue;
  const amberC  = isLight ? `color-mix(in srgb, ${T.amber}  58%, #0B1220 42%)` : T.amber;
  const violetC = isLight ? `color-mix(in srgb, ${T.violet} 60%, #0B1220 40%)` : T.violet;

  const handleSend = () => {
    if (!inputText.trim()) return;
    const isLong = inputText.trim().length > 200;
    onAddItem?.({
      id: Date.now(),
      type: isLong ? "transcripcion" : "texto",
      title: isLong ? "Transcripción manual" : "Nota del asesor",
      content: inputText.trim(),
      details: null,
      fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      source: "asesor",
      fileName: null,
      size: null,
    });
    setInputText("");
  };

  const handleFile = (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    arr.forEach((f, i) => {
      const isAudio = f.type.startsWith("audio/");
      const isPDF   = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      onAddItem?.({
        id: Date.now() + i,
        type: isAudio ? "audio" : isPDF ? "pdf" : "documento",
        title: f.name.replace(/\.[^.]+$/, ""),
        content: isAudio ? "Mensaje de voz · transcripción automática disponible"
          : isPDF ? "Documento PDF adjunto" : "Documento adjunto",
        details: null,
        fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        source: "asesor",
        fileName: f.name,
        size: f.size < 1048576 ? `${(f.size/1024).toFixed(0)} KB` : `${(f.size/1048576).toFixed(1)} MB`,
      });
    });
  };

  const getMeta = (item) => {
    switch (item.type) {
      case "texto":         return { Icon: MessageCircle, color: T.blue,   safe: blueC,   label: "Nota" };
      case "transcripcion": return { Icon: FileText,      color: T.accent, safe: accentC, label: "Transcripción" };
      case "pdf":           return { Icon: FileText,      color: T.violet, safe: violetC, label: "PDF" };
      case "audio":         return { Icon: Mic,           color: T.amber,  safe: amberC,  label: "Voz" };
      default:              return { Icon: FileText,      color: T.txt3,   safe: T.txt3,  label: "Doc" };
    }
  };

  return (
    <>
      {/* Backdrop — tap fuera para cerrar */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, zIndex: 19,
          background: T === P ? "rgba(0,0,0,0.30)" : "rgba(15,23,42,0.18)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />

      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "68%", minHeight: 320,
        zIndex: 20,
        borderRadius: "20px 20px 0 0",
        background: T === P ? "#080A10" : "#FAFBFD",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)"}`,
        borderBottom: "none",
        boxShadow: T === P
          ? "0 -16px 52px rgba(0,0,0,0.68), 0 -3px 16px rgba(0,0,0,0.42)"
          : "0 -10px 40px rgba(15,23,42,0.16), 0 -2px 10px rgba(15,23,42,0.08)",
        display: "flex", flexDirection: "column",
        animation: "slideUpChat 0.3s cubic-bezier(0.32,0.72,0,1)",
        overflow: "hidden",
      }}>
        <style>{`@keyframes slideUpChat{from{transform:translateY(100%);opacity:0.5}to{transform:translateY(0);opacity:1}}`}</style>

        {/* ── Drag handle ── */}
        <div style={{ padding: "11px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.11)" : "rgba(255,255,255,0.10)" }} />
        </div>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 18px 11px", borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `${T.accent}12`, border: `1px solid ${T.accentB}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RefreshCw size={14} color={accentC} strokeWidth={2.2} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: titleC, fontFamily: fontDisp, letterSpacing: "-0.015em" }}>
                Actualizar expediente
              </p>
              <p style={{ margin: 0, fontSize: 9.5, color: T.txt3, fontFamily: font }}>
                {expedienteItems.length > 0
                  ? `${expedienteItems.length} registro${expedienteItems.length !== 1 ? "s" : ""} · más reciente arriba`
                  : "Sin registros — escribe la primera actualización"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.16s" }}
            onMouseEnter={e => e.currentTarget.style.background = T.glassH}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <X size={13} color={T.txt3} />
          </button>
        </div>

        {/* ── Telegram hint ── */}
        <div style={{ padding: "9px 18px 4px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <span style={{ fontSize: 9.5, color: T.txt3, fontFamily: font, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
            Pega tu mensaje de Telegram · nota de voz · adjunto
          </span>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        {/* ── Feed de registros ── */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: "6px 16px 6px", display: "flex", flexDirection: "column", gap: 7 }}>
          {expedienteItems.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0", textAlign: "center" }}>
              <MessageCircle size={24} color={T.txt3} strokeWidth={1.2} style={{ opacity: 0.28, marginBottom: 10 }} />
              <p style={{ fontSize: 12.5, fontWeight: 600, color: T.txt3, fontFamily: fontDisp, marginBottom: 5 }}>Sin actualizaciones</p>
              <p style={{ fontSize: 10.5, color: T.txt3, lineHeight: 1.55, maxWidth: 240, fontFamily: font }}>
                Escribe, pega un mensaje de Telegram o adjunta un archivo para registrar la primera actualización.
              </p>
            </div>
          ) : expedienteItems.map(item => {
            const meta = getMeta(item);
            const { Icon } = meta;
            return (
              <div key={item.id} style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                padding: "9px 11px", borderRadius: 12,
                background: T.glass, border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${meta.color}16`, border: `1px solid ${meta.color}26`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={12} color={meta.safe} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: meta.safe, background: `${meta.color}14`, border: `1px solid ${meta.color}22`, padding: "1px 6px", borderRadius: 99, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: fontDisp }}>{meta.label}</span>
                    {item.source === "telegram" && <span style={{ fontSize: 8, fontWeight: 700, color: isLight ? "#0088CC" : "#60B8E0", background: "rgba(0,136,204,0.12)", border: "1px solid rgba(0,136,204,0.20)", padding: "1px 6px", borderRadius: 99, fontFamily: fontDisp }}>Telegram</span>}
                    {item.fileName && <span style={{ fontSize: 9, color: T.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{item.fileName}</span>}
                    <span style={{ fontSize: 9, color: T.txt3, marginLeft: "auto", fontFamily: font, whiteSpace: "nowrap" }}>{item.fecha}</span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font, wordBreak: "break-word",
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>{item.content}</p>
                  {item.size && <span style={{ fontSize: 9, color: T.txt3, fontFamily: fontDisp, marginTop: 2, display: "block" }}>{item.size}</span>}
                </div>
                <button
                  onClick={() => onRemoveItem?.(item.id)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.14s", opacity: 0.6 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.12)"; e.currentTarget.style.borderColor = "rgba(232,129,140,0.28)"; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.opacity = "0.6"; }}
                >
                  <Trash2 size={10} color={T.txt3} strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Barra de entrada — estilo Telegram ── */}
        <div style={{
          padding: "9px 16px 14px",
          borderTop: `1px solid ${T.border}`,
          background: T === P ? "rgba(8,10,16,0.94)" : "rgba(250,251,253,0.94)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          flexShrink: 0,
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,audio/*"
            multiple
            style={{ display: "none" }}
            onChange={e => handleFile(e.target.files)}
          />
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar PDF, documento o audio"
              style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.16s" }}
              onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = isLight ? T.txt : "#FFF"; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt3; }}
            >
              <FilePlus size={15} strokeWidth={2} />
            </button>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && inputText.trim()) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nota, transcripción, mensaje del agente Telegram…"
              rows={Math.min(Math.max(inputText.split("\n").length, 1), 4)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 10,
                background: T.glass, border: `1px solid ${T.border}`,
                color: T.txt, fontSize: 12.5, fontFamily: font,
                outline: "none", resize: "none", lineHeight: 1.5,
                transition: "border-color 0.16s", boxSizing: "border-box",
              }}
              onFocus={e => e.currentTarget.style.borderColor = T.borderH}
              onBlur={e => e.currentTarget.style.borderColor = T.border}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              title="Registrar · Enter"
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: inputText.trim() ? `${T.accent}18` : T.glass,
                border: `1px solid ${inputText.trim() ? T.accentB : T.border}`,
                color: inputText.trim() ? T.accent : T.txt3,
                cursor: inputText.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.16s",
              }}
            >
              <Send size={14} strokeWidth={2.2} />
            </button>
          </div>
          <p style={{ fontSize: 9.5, color: T.txt3, fontFamily: font, marginTop: 6, letterSpacing: "0.01em" }}>
            Enter para registrar · Shift+Enter nueva línea · Soporta mensajes Telegram
          </p>
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════
   InlineEdit — click-to-edit universal
   ═══════════════════════════════════════════
   Convierte cualquier texto en editable al hacer clic. Escape cancela,
   Enter guarda (en modo text/select) o Cmd+Enter (en modo multiline).
   Un hint sutil (underline en hover) invita a editar sin añadir ruido. */
const InlineEdit = ({
  value, onSave, T, isLight,
  type = "text", options, placeholder = "—",
  multiline = false, rows = 3,
  parse,
  readStyle = {}, editStyle = {},
  displayValue,
  emptyText = "—",
  autoCommitSelect = true,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current.select && !multiline && type !== "select") ref.current.select();
    }
  }, [editing, multiline, type]);

  const start = () => { setDraft(value == null ? "" : String(value)); setEditing(true); };
  const commit = (val) => {
    const raw = val === undefined ? draft : val;
    const final = parse ? parse(raw) : raw;
    onSave?.(final);
    setEditing(false);
  };
  const cancel = () => { setEditing(false); };

  const baseInput = {
    width: "100%", padding: "6px 9px", borderRadius: 8,
    background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
    border: `1px solid ${T.accentB}`, color: T.txt,
    fontSize: 12, fontFamily: font, outline: "none",
    boxSizing: "border-box",
    boxShadow: `0 0 0 3px ${T.accent}14`,
    ...editStyle,
  };

  if (editing) {
    if (type === "select") {
      return (
        <select
          ref={ref}
          value={draft}
          onChange={e => { setDraft(e.target.value); if (autoCommitSelect) commit(e.target.value); }}
          onBlur={() => commit(draft)}
          onKeyDown={e => { if (e.key === "Escape") cancel(); }}
          style={{ ...baseInput, cursor: "pointer" }}
        >
          {(options || []).map(o => (
            <option key={o} value={o} style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>{o}</option>
          ))}
        </select>
      );
    }
    if (multiline) {
      return (
        <textarea
          ref={ref}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={e => {
            if (e.key === "Escape") cancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          }}
          rows={rows}
          placeholder={placeholder}
          style={{ ...baseInput, resize: "vertical", lineHeight: 1.55 }}
        />
      );
    }
    return (
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder={placeholder}
        style={baseInput}
      />
    );
  }

  const shown = displayValue ? displayValue(value) : (value ?? "");
  const isEmpty = shown === "" || shown == null;

  return (
    <span
      onClick={e => { e.stopPropagation?.(); start(); }}
      title="Click para editar"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } }}
      style={{
        cursor: "text",
        display: "inline-block",
        borderRadius: 4,
        padding: "1px 3px",
        margin: "-1px -3px",
        transition: "background 0.15s, box-shadow 0.15s",
        color: isEmpty ? T.txt3 : undefined,
        fontStyle: isEmpty ? "italic" : undefined,
        ...readStyle,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.boxShadow = `inset 0 -1px 0 ${T.accent}55`; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {isEmpty ? emptyText : shown}
    </span>
  );
};

const NotesModal = ({ lead, onClose, onSave, onUpdate, onSwitchTab, T = P }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [expedienteItems, setExpedienteItems] = useState(() => {
    if (lead?.id <= 3) {
      const mock = COACHING_MOCKS[lead.id % COACHING_MOCKS.length];
      return [{
        id: `mock_notes_${lead.id}`,
        type: "transcripcion",
        title: "Llamada inicial · Zoom",
        content: mock.resumen,
        details: null,
        fecha: lead?.lastActivity?.split("—")?.[1]?.trim() || "9 Abr, 6:00pm",
        source: "asesor",
        fileName: null,
        size: null,
      }];
    }
    return [];
  });
  const [updateChatOpen, setUpdateChatOpen] = useState(true);
  if (!lead) return null;

  const KNOWN_SECTIONS = ["OBJETIVO", "PRESUPUESTO", "PERFIL DEL CLIENTE", "HISTORIAL DE CONTACTO", "PENDIENTE"];
  const sectionColors = { "OBJETIVO": T.blue, "PRESUPUESTO": T.emerald, "PERFIL DEL CLIENTE": T.txt2, "HISTORIAL DE CONTACTO": T.amber, "PENDIENTE": T.accent };

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

  const isLight = T !== P;
  const titleC = isLight ? T.txt : "#FFFFFF";

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: T === P ? "rgba(2,5,12,0.5)" : "rgba(15,23,42,0.32)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 460, background: T === P ? "#111318" : "#FFFFFF", borderLeft: `1px solid ${T.borderH}`, display: "flex", flexDirection: "column", animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)", boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.5)" : "-24px 0 80px rgba(15,23,42,0.12)" }}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header: identidad + botón cerrar */}
        <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${T.blue}22, ${T.blue}10)`, border: `1px solid ${T.blue}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 14px ${T.blue}20` }}>
                <FileText size={14} color={isLight ? `color-mix(in srgb, ${T.blue} 58%, #0B1220 42%)` : T.blue} strokeWidth={2.2} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: isLight ? `color-mix(in srgb, ${T.blue} 58%, #0B1220 42%)` : T.blue, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: fontDisp }}>Expediente</p>
                <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font }}>Todo sobre el cliente en un vistazo</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {!editing && (
                <button
                  onClick={() => setUpdateChatOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    border: `1px solid ${T.accentB}`,
                    background: `${T.accent}10`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 62%, #0B1220 38%)` : T.accent,
                    fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    fontFamily: fontDisp, transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; e.currentTarget.style.boxShadow = `0 0 14px ${T.accent}18`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${T.accent}10`; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <RefreshCw size={11} strokeWidth={2.5} />
                  Actualizar
                </button>
              )}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = T.glassH}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={13} color={T.txt3} /></button>
            </div>
          </div>

          {/* Snapshot del lead */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: T.glass, border: `1px solid ${T.border}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `${T.blue}18`, border: `1px solid ${T.blue}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: isLight ? `color-mix(in srgb, ${T.blue} 58%, #0B1220 42%)` : T.blue, fontFamily: fontDisp, flexShrink: 0 }}>{lead.n.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: titleC, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                <InlineEdit value={lead.n} onSave={v => onUpdate?.({...lead, n: v})} T={T} isLight={isLight} placeholder="Nombre" />
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
                <InlineEdit value={lead.asesor} onSave={v => onUpdate?.({...lead, asesor: v})} T={T} isLight={isLight} placeholder="Asesor" emptyText="Sin asesor" />
                {" · "}
                <InlineEdit
                  value={lead.budget}
                  onSave={v => {
                    const parsed = parseBudget(v);
                    onUpdate?.({...lead, budget: parsed ? formatBudget(parsed) : v, presupuesto: parsed || lead.presupuesto || 0 });
                  }}
                  T={T} isLight={isLight} placeholder="300k · 1.5M" emptyText="Sin presupuesto"
                />
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div style={{ padding: "18px 24px 130px", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", flex: 1 }}>
          {/* ── Próxima acción — hero unificado (siempre visible en modo lectura).
              Mismo componente que Perfil y Análisis IA: es lo primero
              accionable que ve el asesor en el expediente del cliente. ── */}
          {!editing && (
            <div style={{ marginBottom: 16 }}>
              <NextActionHero lead={lead} T={T} onUpdate={onUpdate} />
            </div>
          )}
          {/* ── Acciones rápidas — seguimientos + etapa editable ── */}
          {!editing && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", marginBottom: 16 }}>
              <FollowUpBadge lead={lead} onUpdate={onUpdate} T={T} />
              <StageBadge lead={lead} onUpdate={onUpdate} T={T} />
            </div>
          )}
          {editing ? (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, fontFamily: fontDisp }}>Editar expediente</p>
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                placeholder={"OBJETIVO\nDescripción...\n\nPENDIENTE\nAcciones pendientes..."}
                style={{ width: "100%", minHeight: 360, padding: "14px", borderRadius: 12, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${T.borderH}`, color: T.txt, fontSize: 13, fontFamily: font, lineHeight: 1.75, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sections.filter(s => s.title || s.body).map((s, i) => {
                const c = sectionColors[s.key] || T.txt2;
                const titleCol = isLight && s.key ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;
                return (
                  <div key={i} style={{ borderRadius: 12, border: `1px solid ${s.key ? `${c}${isLight ? "30" : "20"}` : T.border}`, overflow: "hidden", background: isLight && s.key ? `${c}08` : "transparent" }}>
                    {s.title && (
                      <div style={{ padding: "9px 15px", background: s.key ? (isLight ? `${c}14` : `${c}0C`) : T.glass, borderBottom: `1px solid ${s.key ? `${c}${isLight ? "28" : "1C"}` : T.border}` }}>
                        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: titleCol, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>{s.title}</p>
                      </div>
                    )}
                    <div style={{ padding: s.title ? "13px 15px" : "15px" }}>
                      {/* div con whiteSpace: pre-wrap en vez de <pre> —
                          el tag <pre> del navegador aplica fuente monospace
                          por defecto (aspecto "antigua"); usando <div> con
                          fontFamily SF Pro se ve consistente con el resto. */}
                      <div style={{ fontSize: 13, color: isLight ? T.txt : T.txt2, lineHeight: 1.75, fontFamily: font, whiteSpace: "pre-wrap", margin: 0, fontWeight: 500 }}>{s.body.trim()}</div>
                    </div>
                  </div>
                );
              })}
              {sections.length === 0 && (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: T.txt3, marginBottom: 14, fontFamily: font }}>Sin información registrada en el expediente.</p>
                  <button
                    onClick={() => setUpdateChatOpen(true)}
                    style={{
                      padding: "9px 22px", borderRadius: 9,
                      background: `${T.accent}12`, border: `1px solid ${T.accentB}`,
                      color: isLight ? `color-mix(in srgb, ${T.accent} 62%, #0B1220 38%)` : T.accent,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
                      display: "inline-flex", alignItems: "center", gap: 7, transition: "all 0.16s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${T.accent}12`; }}
                  >
                    <RefreshCw size={12} strokeWidth={2.5} />
                    Actualizar expediente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexShrink: 0, background: T === P ? "#111318" : "#FFFFFF" }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, fontSize: 13, fontWeight: 600, fontFamily: font, cursor: "pointer", transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt2; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; }}
            >Cancelar</button>
            <button onClick={saveEdit} style={{ flex: 2, padding: "11px 0", borderRadius: 11, background: `${T.blue}18`, border: `1px solid ${T.blue}44`, color: isLight ? `color-mix(in srgb, ${T.blue} 58%, #0B1220 42%)` : T.blue, fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}28`}
              onMouseLeave={e => e.currentTarget.style.background = `${T.blue}18`}
            >Guardar expediente</button>
          </div>
        )}

        {/* Dynamic Island — switcher Análisis IA · Perfil · Expediente */}
        {!editing && <DrawerTabIsland current="expediente" onSwitch={onSwitchTab} T={T} />}

        {/* ── UpdateChatPanel ── */}
        {!editing && (
          <UpdateChatPanel
            isOpen={updateChatOpen}
            onClose={() => setUpdateChatOpen(false)}
            expedienteItems={expedienteItems}
            onAddItem={item => setExpedienteItems(prev => [item, ...prev])}
            onRemoveItem={id => setExpedienteItems(prev => prev.filter(x => x.id !== id))}
            T={T}
          />
        )}
      </div>
    </>,
    document.body
  );
};

/* ─── Mock AI coaching analysis generator ─── */
const COACHING_MOCKS = [
  {
    score: 84,
    duracion: "18:32",
    resumen: "Llamada sólida. El asesor establece rapport efectivo y explora necesidades con buenas preguntas abiertas. Se pierde momentum en el cierre.",
    fortalezas: ["Escucha activa excelente — deja al cliente hablar sin interrumpir", "Manejo de objeción de precio con beneficios concretos", "Tono cálido y profesional durante toda la llamada"],
    mejoras: ["El cierre llegó 4 minutos tarde — proponer siguiente paso antes de que el cliente desvíe tema", "Evitar frases de relleno: 'básicamente', 'o sea' aparecen 12 veces", "Confirmar compromisos con fecha específica, no 'esta semana'"],
    tecnica: "SPIN Selling — aumentar preguntas de Implicación para ampliar el dolor antes de presentar la solución.",
    nextStep: "Practicar el cierre de prueba: '¿Le parece si agendamos la visita para el jueves?'",
  },
  {
    score: 71,
    duracion: "9:14",
    resumen: "Primer contacto correcto. Falta profundidad en la calificación — el asesor no detectó el presupuesto real ni el plazo de decisión.",
    fortalezas: ["Presentación de la empresa clara y concisa", "Logra agendar siguiente reunión — buen cierre parcial"],
    mejoras: ["Calificar presupuesto en los primeros 5 minutos (BANT)", "No presentar propiedades sin entender el objetivo de inversión", "El silencio posterior a una pregunta duró < 2s — dejar más tiempo al cliente"],
    tecnica: "BANT Framework — Budget, Authority, Need, Timeline. Cubrir los 4 en todo primer contacto.",
    nextStep: "Usar el script de calificación: '¿Cuál es el rango que tienes disponible y en qué plazo piensas decidir?'",
  },
  {
    score: 93,
    duracion: "24:07",
    resumen: "Llamada de alto rendimiento. Manejo de objeciones magistral y cierre efectivo. Uno de los mejores registros del equipo este mes.",
    fortalezas: ["Manejo de la objeción 'lo voy a pensar' con pregunta de reversión perfecta", "Uso de prueba social (caso de cliente similar) en el momento correcto", "Cierre con alternativa: 'jueves a las 10 o viernes a las 3' — sin dejar espacio al 'no'"],
    mejoras: ["Reducir duración de la presentación inicial de 6 a 3 minutos", "Incluir referencia al ROI específico del proyecto desde la apertura"],
    tecnica: "Cierre con Alternativa — siempre ofrecer dos opciones concretas, nunca preguntar '¿te parece bien?'",
    nextStep: "Compartir esta grabación como caso de estudio en la próxima reunión del equipo.",
  },
];

const LeadPanel = ({ lead, onClose, oc, onUpdate, onSwitchTab, T = P }) => {
  const [activeTab, setActiveTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [expandBio, setExpandBio] = useState(false);
  const [updateChatOpen, setUpdateChatOpen] = useState(false);

  /* ── Expediente items state ── */
  const [expedienteItems, setExpedienteItems] = useState(() => {
    const mock = COACHING_MOCKS[lead?.id % COACHING_MOCKS.length || 0];
    return lead?.id <= 3 ? [{
      id: 1,
      type: "transcripcion",
      title: "Llamada inicial · Zoom",
      content: mock.resumen,
      details: mock,
      fecha: lead?.lastActivity?.split("—")?.[1]?.trim() || "9 Abr, 6:00pm",
      source: "asesor",
      fileName: null,
      size: null,
    }] : [];
  });
  const [inputText, setInputText] = useState("");
  const [expandedAnalysisId, setExpandedAnalysisId] = useState(null);
  const [uploadDragging, setUploadDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const isLong = inputText.trim().length > 200;
    setExpedienteItems(prev => [{
      id: Date.now(),
      type: isLong ? "transcripcion" : "texto",
      title: isLong ? "Transcripción manual" : "Nota del asesor",
      content: inputText.trim(),
      details: null,
      fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      source: "asesor",
      fileName: null,
      size: null,
    }, ...prev]);
    setInputText("");
  };

  const handleDocsFile = (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    const newItems = arr.map((f, i) => {
      const isAudio = f.type.startsWith("audio/");
      const isPDF   = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      return {
        id: Date.now() + i,
        type: isAudio ? "audio" : isPDF ? "pdf" : "documento",
        title: f.name.replace(/\.[^.]+$/, ""),
        content: isAudio
          ? "Mensaje de voz · transcripción automática disponible"
          : isPDF
          ? "Documento PDF adjunto"
          : "Documento adjunto",
        details: null,
        fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        source: "asesor",
        fileName: f.name,
        size: f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
      };
    });
    setExpedienteItems(prev => [...newItems, ...prev]);
  };
  if (!lead) return null;
  const isLight = T !== P;
  const sc = lead.sc;
  const scoreColor = T.accent;
  const stageColor = stgC[lead.st] || T.txt3;
  const stageIdx = STAGES.indexOf(lead.st);
  const startEditing = () => { setForm({ n: lead.n, phone: lead.phone||"", budget: lead.budget||"", asesor: lead.asesor||"", campana: lead.campana||"", p: lead.p||"", st: lead.st, nextAction: lead.nextAction||"", nextActionDate: lead.nextActionDate||"", bio: lead.bio||"" }); setEditing(true); };
  const saveEditing = () => {
    if (!form.n.trim()) return;
    const parsed = parseBudget(form.budget);
    const normalized = {
      ...form,
      budget: parsed ? formatBudget(parsed) : form.budget,
      presupuesto: parsed || lead.presupuesto || 0,
    };
    onUpdate?.({...lead, ...normalized});
    setEditing(false); setForm(null);
  };
  const cancelEditing = () => { setEditing(false); setForm(null); };
  const f = k => form?.[k] ?? ""; const sf = k => v => setForm(p => ({...p,[k]:v}));
  // Color primario "fuerte" para títulos — respeta el tema claro/oscuro
  const titleC = isLight ? T.txt : "#FFFFFF";
  const inputBg = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)";
  const inp = (label, key, ph, full) => (
    <div style={full ? { gridColumn: "1 / -1" } : {}}>
      <p style={{ fontSize: 9, fontWeight: 700, color: T.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>{label}</p>
      <input value={f(key)} onChange={e => sf(key)(e.target.value)} placeholder={ph}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: inputBg, border: `1px solid ${T.borderH}`, color: T.txt, fontSize: 12, outline: "none", fontFamily: font, boxSizing: "border-box" }} />
    </div>
  );
  const textarea = (label, key, ph) => (
    <div style={{ gridColumn: "1 / -1" }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: T.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>{label}</p>
      <textarea value={f(key)} onChange={e => sf(key)(e.target.value)} placeholder={ph} rows={3}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: inputBg, border: `1px solid ${T.borderH}`, color: T.txt, fontSize: 12, outline: "none", fontFamily: font, resize: "vertical", boxSizing: "border-box" }} />
    </div>
  );

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: T === P ? "rgba(2,5,12,0.5)" : "rgba(15,23,42,0.32)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 440, background: T === P ? "#111318" : "#FFFFFF", borderLeft: `1px solid ${T.borderH}`, display: "flex", flexDirection: "column", animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)", boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.5)" : "-24px 0 80px rgba(15,23,42,0.12)" }}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {lead.hot && <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accentB}`, padding: "2px 8px", borderRadius: 99 }}>HOT</span>}
              {lead.daysInactive >= 7 && <span style={{ fontSize: 9, fontWeight: 600, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 99 }}>{lead.daysInactive}d inactivo</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!editing && <button onClick={startEditing} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; e.currentTarget.style.borderColor = T.border; }}>Editar</button>}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }} onMouseEnter={e => e.currentTarget.style.background = T.glassH} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><X size={13} color={T.txt3} /></button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: isLight ? `${T.accent}10` : `${T.accent}0E`,
                border: `1px solid ${isLight ? `${T.accent}28` : `${T.accent}20`}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent,
                fontFamily: fontDisp,
              }}>{lead.n.charAt(0)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? <input value={f("n")} onChange={e => sf("n")(e.target.value)} style={{ width: "100%", fontSize: 17, fontWeight: 700, fontFamily: fontDisp, background: "transparent", border: "none", borderBottom: `1px solid ${T.borderH}`, color: titleC, outline: "none", paddingBottom: 3, marginBottom: 6, boxSizing: "border-box" }} />
                : <p style={{ fontSize: 17, fontWeight: 700, color: titleC, fontFamily: fontDisp, letterSpacing: "-0.025em", marginBottom: 4, lineHeight: 1.1 }}>
                    <InlineEdit value={lead.n} onSave={v => onUpdate?.({...lead, n: v})} T={T} isLight={isLight} placeholder="Nombre" editStyle={{ fontSize: 17, fontWeight: 700 }} />
                  </p>}
              <p style={{ fontSize: 11, color: T.txt3, marginBottom: 6 }}>
                {editing ? lead.tag : <InlineEdit value={lead.tag} onSave={v => onUpdate?.({...lead, tag: v})} T={T} isLight={isLight} placeholder="Etiqueta / segmento" emptyText="Sin etiqueta" />}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {editing ? <select value={f("st")} onChange={e => sf("st")(e.target.value)} style={{ padding: "3px 8px", borderRadius: 99, background: `${stgC[f("st")]||T.txt3}18`, border: `1px solid ${stgC[f("st")]||T.txt3}30`, color: isLight ? `color-mix(in srgb, ${stgC[f("st")]||T.txt3} 60%, #0B1220 40%)` : (stgC[f("st")]||T.txt3), fontSize: 10, fontWeight: 700, cursor: "pointer", outline: "none" }}>{STAGES.map(s => <option key={s} value={s} style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>{s}</option>)}</select>
                  : <Pill color={stageColor} s isLight={isLight}>{lead.st}</Pill>}
                <span style={{ fontSize: 10, color: T.txt3 }}>·</span>
                {editing ? (
                  (() => {
                    const prev = parseBudget(f("budget"));
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input value={f("budget")} onChange={e => sf("budget")(e.target.value)} placeholder="300k"
                          title="Acepta 300k, 1.5M, 2 mdd, $500,000"
                          style={{ fontSize: 12, fontWeight: 700, fontFamily: fontDisp, background: "transparent", border: "none", borderBottom: `1px solid ${T.border}`, color: titleC, outline: "none", width: 90 }} />
                        {prev > 0 && <span style={{ fontSize: 10, color: T.accent, fontFamily: fontDisp, fontWeight: 700 }}>= {formatBudget(prev)}</span>}
                      </span>
                    );
                  })()
                ) : <span style={{ fontSize: 12, fontWeight: 700, color: titleC, fontFamily: fontDisp }}>
                    <InlineEdit
                      value={lead.budget}
                      onSave={v => { const parsed = parseBudget(v); onUpdate?.({...lead, budget: parsed ? formatBudget(parsed) : v, presupuesto: parsed || lead.presupuesto || 0 }); }}
                      T={T} isLight={isLight} placeholder="300k · 1.5M" emptyText="Sin presupuesto"
                      editStyle={{ fontSize: 12, fontWeight: 700, width: 110 }}
                    />
                  </span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)" }}>
              <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: isLight ? `color-mix(in srgb, ${T.accent} 55%, #0B1220 45%)` : T.accent, opacity: 0.7 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.txt3, fontFamily: fontDisp, whiteSpace: "nowrap" }}>Score {sc}</span>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <a href={`tel:${editing ? f("phone") : lead.phone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2, fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; }} onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}><Phone size={12} /> Llamar</a>
            <a href={`https://wa.me/${(editing?f("phone"):lead.phone)?.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", borderRadius: 9, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2, fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; }} onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}><MessageCircle size={12} /> WhatsApp</a>
          </div>
        </div>

        {/* Sub-tabs: Datos · Documentos */}
        <div style={{ display: "flex", padding: "0 22px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 0 }}>
          {[["perfil","Datos",null],["docs","Documentos",expedienteItems.length]].map(([id,label,badge]) => {
            const active = activeTab === id;
            const accentC = isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent;
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "11px 0", marginRight: 20, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, color: active ? accentC : T.txt3, borderBottom: active ? `2px solid ${T.accent}` : "2px solid transparent", transition: "all 0.18s", marginBottom: -1, letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.color=T.txt2;}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.color=T.txt3;}}
              >
                {label}
                {badge > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: active ? accentC : T.txt3, background: active ? `${T.accent}18` : T.glass, border: `1px solid ${active ? T.accentB : T.border}`, padding: "1px 5px", borderRadius: 99, minWidth: 16, textAlign: "center" }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* Content — extra padding-bottom para no chocar con el Dynamic Island flotante */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", padding: `20px 22px 130px`, display: "flex", flexDirection: "column", gap: 14 }}>
          {activeTab==="perfil" && !editing && <>
            {/* ── Próxima acción — hero unificado (mismo componente en los 3 drawers).
                Wrapper con flexShrink: 0 para garantizar que en un contenedor
                flex-column el hero nunca se comprima/recorte. ── */}
            <div style={{ flexShrink: 0 }}>
              <NextActionHero lead={lead} T={T} onUpdate={onUpdate} />
            </div>

            {/* ── Acciones rápidas — contador de seguimientos + etapa editable.
                El asesor puede registrar cada recontacto con el cliente en un clic
                y cambiar el estatus sin abrir el modal de edición completa. ── */}
            <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              <FollowUpBadge lead={lead} onUpdate={onUpdate} T={T} />
              <StageBadge lead={lead} onUpdate={onUpdate} T={T} />
            </div>

            {/* ── Datos del cliente — 2 columnas, todos editables inline ──
                Click en el valor → input. Enter guarda, Escape cancela.
                "Inactividad" es derivado y no se edita. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {[
                { l:"Teléfono",    k:"phone",        v:lead.phone,                    icon:Phone,        ph:"+1 817 682..." },
                { l:"Ingresó",     k:"fechaIngreso", v:lead.fechaIngreso,             icon:CalendarDays, ph:"Hoy, 10 Oct..." },
                { l:"Campaña",     k:"campana",      v:lead.campana,                  icon:Signal,       ph:"Referido, Google..." },
                { l:"Proyecto",    k:"p",            v:lead.p,                        icon:Building2,    ph:"Gobernador 28..." },
                { l:"Asesor",      k:"asesor",       v:lead.asesor,                   icon:User,         ph:"Nombre asesor" },
                { l:"Inactividad", k:null,           v:`${lead.daysInactive} días`,   icon:Clock,        ph:"" },
              ].map(x => (
                <div key={x.l} style={{ padding: "10px 12px", borderRadius: 11, background: T.glass, border: `1px solid ${T.border}`, display: "flex", gap: 9, alignItems: "flex-start", minHeight: 48 }}>
                  <x.icon size={11} color={T.txt3} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 9, color: T.txt3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3, fontFamily: fontDisp }}>{x.l}</p>
                    <div style={{ fontSize: 11.5, color: T.txt, fontWeight: 500, wordBreak: "break-word", lineHeight: 1.35 }}>
                      {x.k
                        ? <InlineEdit value={x.v} onSave={v => onUpdate?.({...lead, [x.k]: v})} T={T} isLight={isLight} placeholder={x.ph} readStyle={{ width: "100%" }} editStyle={{ fontSize: 11.5 }} />
                        : (x.v || "—")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Perfil del cliente (bio) — siempre visible y editable inline.
                Click en el texto → textarea. Si no hay bio, prompt para agregar. */}
            {(() => {
              const BIO_THRESHOLD = 220;
              const hasBio = !!lead.bio;
              const isBioLong = hasBio && lead.bio.length > BIO_THRESHOLD;
              const showBio = !isBioLong || expandBio;
              const accentC = isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent;
              return (
                <div style={{ padding: "4px 2px" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: fontDisp }}>Perfil del cliente</p>
                  <div style={{
                    fontSize: 12.5, color: T.txt2, lineHeight: 1.7, margin: 0,
                    ...(showBio ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }),
                  }}>
                    <InlineEdit
                      value={lead.bio}
                      onSave={v => onUpdate?.({...lead, bio: v})}
                      T={T} isLight={isLight}
                      multiline rows={4}
                      placeholder="Describe al cliente: necesidad, contexto, objeciones..."
                      emptyText="+ Agregar perfil del cliente"
                      readStyle={{ fontSize: 12.5, lineHeight: 1.7, display: "block" }}
                      editStyle={{ fontSize: 12.5 }}
                    />
                  </div>
                  {isBioLong && (
                    <button
                      onClick={() => setExpandBio(v => !v)}
                      style={{
                        marginTop: 8, padding: "4px 10px", borderRadius: 99,
                        background: "transparent", border: `1px solid ${T.border}`,
                        color: accentC, fontSize: 10.5, fontWeight: 700,
                        fontFamily: fontDisp, letterSpacing: "0.02em",
                        cursor: "pointer", transition: "all 0.16s",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.borderColor = T.borderH; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}
                    >
                      {expandBio ? "Ver menos" : "Ver más"}
                      <ChevronDown size={10} strokeWidth={2.5} style={{ transform: expandBio ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                  )}
                </div>
              );
            })()}

            {/* ── Riesgo identificado — editable inline, se oculta solo si no hay riesgo
                y el asesor no lo ha querido agregar. Mostramos siempre en modo lectura
                para que pueda editarse desde el drawer. ── */}
            <div style={{
              padding: "12px 14px", borderRadius: 11,
              background: isLight ? `${T.amber}12` : `${T.amber}0A`,
              border: `1px solid ${T.amber}${isLight ? "3A" : "26"}`,
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <AlertCircle size={13} color={isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber} strokeWidth={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, color: isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>Riesgo identificado</p>
                <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6, margin: 0, wordBreak: "break-word" }}>
                  <InlineEdit
                    value={lead.risk}
                    onSave={v => onUpdate?.({...lead, risk: v})}
                    T={T} isLight={isLight}
                    multiline rows={2}
                    placeholder="Describe el riesgo: competencia, presupuesto, timing..."
                    emptyText="+ Registrar riesgo u objeción"
                    readStyle={{ fontSize: 12, lineHeight: 1.6, display: "block", width: "100%" }}
                    editStyle={{ fontSize: 12 }}
                  />
                </div>
              </div>
            </div>

            {/* ── Última actividad ── */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", borderRadius: 11, background: T.glass, border: `1px solid ${T.border}` }}>
              <Activity size={12} color={T.txt3} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, fontFamily: fontDisp }}>Última actividad</p>
                <div style={{ fontSize: 11.5, color: T.txt2, wordBreak: "break-word", lineHeight: 1.4, margin: 0 }}>
                  <InlineEdit
                    value={lead.lastActivity}
                    onSave={v => onUpdate?.({...lead, lastActivity: v})}
                    T={T} isLight={isLight}
                    placeholder="Llamada, WhatsApp, visita..."
                    emptyText="+ Registrar última actividad"
                    readStyle={{ fontSize: 11.5, width: "100%" }}
                    editStyle={{ fontSize: 11.5 }}
                  />
                </div>
              </div>
            </div>
          </>}

          {activeTab==="perfil" && editing && form && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {inp("Nombre completo","n","Nombre del cliente",true)}
              {inp("Teléfono","phone","+1 817 682...")}
              {inp("Presupuesto","budget","300k · 1.5M · 2 mdd")}
              {inp("Asesor","asesor","Nombre asesor")}
              {inp("Campaña / Fuente","campana","Referido, Google...")}
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Etapa del pipeline</p>
                <select value={f("st")} onChange={e => sf("st")(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, background: inputBg, border: `1px solid ${T.borderH}`, color: T.txt, fontSize: 12, outline: "none", fontFamily: font, cursor: "pointer" }}>{STAGES.map(s=><option key={s} value={s} style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>{s}</option>)}</select>
              </div>
              {inp("Proyecto de interés","p","Gobernador 28, Portofino...",true)}
              {textarea("Próxima acción","nextAction","Descripción de la próxima acción...")}
              {inp("Fecha acción","nextActionDate","Hoy, Mañana 10am...")}
              {textarea("Perfil del cliente","bio","Descripción del cliente...")}
            </div>
          )}

          {/* Pipeline tab removed — no longer available */}

          {/* ══════════════════════════════════════════════════
              TAB: DOCUMENTOS — Expediente · Transcripciones · Agente Telegram
          ══════════════════════════════════════════════════ */}
          {activeTab === "docs" && (() => {
            const accentC = isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent;
            const blueC   = isLight ? `color-mix(in srgb, ${T.blue}  60%, #0B1220 40%)` : T.blue;
            const violetC = isLight ? `color-mix(in srgb, ${T.violet} 60%, #0B1220 40%)` : T.violet;
            const amberC  = isLight ? `color-mix(in srgb, ${T.amber}  58%, #0B1220 42%)` : T.amber;

            const getItemMeta = (item) => {
              switch(item.type) {
                case "texto":         return { Icon: MessageCircle, color: T.blue,   safeColor: blueC,   label: "Nota" };
                case "transcripcion": return { Icon: FileText,      color: T.accent, safeColor: accentC, label: "Transcripción" };
                case "pdf":           return { Icon: FileText,      color: T.violet, safeColor: violetC, label: "PDF" };
                case "audio":         return { Icon: Mic,           color: T.amber,  safeColor: amberC,  label: "Voz" };
                case "documento":     return { Icon: FileText,      color: T.blue,   safeColor: blueC,   label: "Doc" };
                default:              return { Icon: MessageCircle, color: T.txt3,   safeColor: T.txt3,  label: "Nota" };
              }
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── Upload / drag-drop area ── */}
                <div
                  onDragOver={e => { e.preventDefault(); setUploadDragging(true); }}
                  onDragLeave={() => setUploadDragging(false)}
                  onDrop={e => { e.preventDefault(); setUploadDragging(false); handleDocsFile(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${uploadDragging ? T.accent : (isLight ? "rgba(15,23,42,0.11)" : "rgba(255,255,255,0.09)")}`,
                    borderRadius: 13,
                    padding: "13px 14px",
                    cursor: "pointer",
                    background: uploadDragging ? `${T.accent}07` : "transparent",
                    transition: "all 0.18s",
                    display: "flex", alignItems: "center", gap: 11,
                  }}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,audio/*" multiple style={{ display: "none" }} onChange={e => handleDocsFile(e.target.files)} />
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: isLight ? `${T.accent}12` : `${T.accent}0E`, border: `1px solid ${T.accentB}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FilePlus size={15} color={accentC} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: uploadDragging ? accentC : titleC, fontFamily: fontDisp, marginBottom: 2 }}>
                      {uploadDragging ? "Suelta para adjuntar" : "Adjuntar PDF, documento o audio"}
                    </p>
                    <p style={{ fontSize: 10.5, color: T.txt3, fontFamily: font }}>PDF, DOC, MP3, M4A, WAV · arrastra o haz clic</p>
                  </div>
                </div>

                {/* ── Empty state ── */}
                {expedienteItems.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 0 8px", color: T.txt3 }}>
                    <FileText size={26} color={T.txt3} strokeWidth={1.2} style={{ marginBottom: 10, opacity: 0.3 }} />
                    <p style={{ fontSize: 12.5, fontFamily: fontDisp, fontWeight: 600, color: T.txt3, marginBottom: 4 }}>Sin registros aún</p>
                    <p style={{ fontSize: 11, color: T.txt3, lineHeight: 1.55, fontFamily: font }}>
                      Adjunta PDFs, docs o usa el chat de abajo<br/>para registrar notas y mensajes del agente.
                    </p>
                  </div>
                )}

                {/* ── Items list ── */}
                {expedienteItems.map(item => {
                  const meta = getItemMeta(item);
                  const { Icon } = meta;
                  const isExpanded = expandedAnalysisId === item.id;
                  const hasDetails = !!item.details;

                  return (
                    <div key={item.id} style={{ borderRadius: 13, border: `1px solid ${T.border}`, overflow: "hidden", background: T.glass }}>

                      {/* Entry header */}
                      <div style={{ padding: "12px 13px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${meta.color}18`, border: `1px solid ${meta.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={14} color={meta.safeColor} strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 8.5, fontWeight: 800, color: meta.safeColor, background: `${meta.color}14`, border: `1px solid ${meta.color}22`, padding: "1px 7px", borderRadius: 99, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: fontDisp }}>{meta.label}</span>
                            {item.source === "telegram" && <span style={{ fontSize: 8.5, fontWeight: 700, color: isLight ? "#0088CC" : "#60B8E0", background: isLight ? "rgba(0,136,204,0.10)" : "rgba(96,184,224,0.12)", border: "1px solid rgba(0,136,204,0.22)", padding: "1px 7px", borderRadius: 99, letterSpacing: "0.04em", fontFamily: fontDisp }}>Telegram</span>}
                            {item.fileName && <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{item.fileName}</span>}
                            <span style={{ fontSize: 9.5, color: T.txt3, marginLeft: "auto", whiteSpace: "nowrap", fontFamily: font }}>{item.fecha}</span>
                          </div>
                          <p style={{ fontSize: 11.5, color: T.txt2, lineHeight: 1.55, fontFamily: font, wordBreak: "break-word", margin: 0,
                            ...(isExpanded || item.content.length <= 180 ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }),
                          }}>{item.content}</p>
                          {item.content.length > 180 && !hasDetails && (
                            <button onClick={() => setExpandedAnalysisId(isExpanded ? null : item.id)} style={{ marginTop: 5, fontSize: 10.5, color: accentC, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font, fontWeight: 600 }}>
                              {isExpanded ? "Ver menos ↑" : "Ver más ↓"}
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                          {item.size && <span style={{ fontSize: 9, color: T.txt3, fontFamily: fontDisp }}>{item.size}</span>}
                          <button onClick={() => setExpedienteItems(prev => prev.filter(x => x.id !== item.id))} style={{ width: 24, height: 24, borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.16s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.12)"; e.currentTarget.style.borderColor = "rgba(232,129,140,0.28)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}>
                            <Trash2 size={11} color={T.txt3} strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      {/* ── IA Coaching analysis — for transcripcion items with details ── */}
                      {hasDetails && (() => {
                        const a = item.details;
                        const scoreCol = a.score >= 85 ? T.accent : a.score >= 70 ? T.blue : T.amber;
                        const scoreSafe = isLight ? `color-mix(in srgb, ${scoreCol} 58%, #0B1220 42%)` : scoreCol;
                        return (
                          <div style={{ margin: "0 13px 13px", borderRadius: 11, border: `1px solid ${isLight ? `${T.accent}28` : `${T.accent}20`}`, overflow: "hidden", background: `${T.accent}05` }}>
                            <div onClick={() => setExpandedAnalysisId(isExpanded ? null : item.id)} style={{ padding: "10px 12px", borderBottom: isExpanded ? `1px solid ${T.accent}14` : "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                              <StratosAtom size={13} color={accentC} />
                              <p style={{ fontSize: 10.5, fontWeight: 800, color: accentC, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: fontDisp, flex: 1 }}>Coaching IA · Análisis</p>
                              <span style={{ fontSize: 13, fontWeight: 800, color: scoreSafe, fontFamily: fontDisp }}>{a.score}<span style={{ fontSize: 9, fontWeight: 600, color: T.txt3 }}>/100</span></span>
                              <ChevronDown size={12} color={T.txt3} strokeWidth={2.5} style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }} />
                            </div>
                            {isExpanded && (
                              <div style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
                                <p style={{ fontSize: 11.5, color: T.txt2, lineHeight: 1.65, fontFamily: font }}>{a.resumen}</p>
                                <div>
                                  <p style={{ fontSize: 9, fontWeight: 800, color: accentC, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, fontFamily: fontDisp }}>✓ Fortalezas</p>
                                  {a.fortalezas.map((f, i) => <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: T.accent, marginTop: 5, flexShrink: 0 }} /><p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font }}>{f}</p></div>)}
                                </div>
                                <div>
                                  <p style={{ fontSize: 9, fontWeight: 800, color: isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, fontFamily: fontDisp }}>⚡ Mejoras</p>
                                  {a.mejoras.map((m, i) => <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: T.amber, marginTop: 5, flexShrink: 0 }} /><p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font }}>{m}</p></div>)}
                                </div>
                                <div style={{ padding: "9px 11px", borderRadius: 9, background: isLight ? `${T.violet}0E` : `${T.violet}0A`, border: `1px solid ${T.violet}${isLight ? "28" : "20"}` }}>
                                  <p style={{ fontSize: 9, fontWeight: 800, color: violetC, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>Técnica recomendada</p>
                                  <p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font }}>{a.tecnica}</p>
                                </div>
                                <div style={{ padding: "9px 11px", borderRadius: 9, background: isLight ? `${T.blue}0E` : `${T.blue}0A`, border: `1px solid ${T.blue}${isLight ? "28" : "1E"}` }}>
                                  <p style={{ fontSize: 9, fontWeight: 800, color: blueC, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>Siguiente paso</p>
                                  <p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font }}>{a.nextStep}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Footer — solo aparece cuando se edita (Cancelar / Guardar). En modo lectura,
           el switcher inferior (Dynamic Island) ocupa el lugar del CTA. */}
        {editing && (
          <div style={{ padding: "13px 22px", borderTop: `1px solid ${T.border}`, flexShrink: 0, background: T === P ? "#111318" : "#FFFFFF" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelEditing} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }} onMouseEnter={e=>{e.currentTarget.style.background=T.glassH;e.currentTarget.style.color=T.txt2;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.txt3;}}>Cancelar</button>
              <button onClick={saveEditing} disabled={!form?.n?.trim()} style={{ flex: 2, padding: "11px 0", borderRadius: 11, background: form?.n?.trim()?`${T.accent}18`:"transparent", border: `1px solid ${form?.n?.trim()?T.accentB:T.border}`, color: form?.n?.trim()?(isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent):T.txt3, fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: form?.n?.trim()?"pointer":"not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.18s" }}>Guardar cambios</button>
            </div>
          </div>
        )}

        {/* Dynamic Island — switcher entre Análisis IA · Perfil · Expediente */}
        {!editing && <DrawerTabIsland current="perfil" onSwitch={onSwitchTab} T={T} />}

        {/* ── UpdateChatPanel — panel deslizable para registrar actualizaciones ── */}
        {!editing && (
          <UpdateChatPanel
            isOpen={updateChatOpen}
            onClose={() => setUpdateChatOpen(false)}
            expedienteItems={expedienteItems}
            onAddItem={item => setExpedienteItems(prev => [item, ...prev])}
            onRemoveItem={id => setExpedienteItems(prev => prev.filter(x => x.id !== id))}
            T={T}
          />
        )}
      </div>
    </>,
    document.body
  );
};

/* ═══════════════════════════════════════════
   ANALYSIS DRAWER — Análisis IA contextual sobre Pipeline
═══════════════════════════════════════════ */
const AnalysisDrawer = ({ lead, onClose, oc, onUpdate, onSwitchTab, T = P }) => {
  const [expedienteItems, setExpedienteItems] = useState(() => {
    if (lead?.id <= 3) {
      const mock = COACHING_MOCKS[lead.id % COACHING_MOCKS.length];
      return [{
        id: `mock_analysis_${lead.id}`,
        type: "transcripcion",
        title: "Llamada inicial · Zoom",
        content: mock.resumen,
        details: null,
        fecha: lead?.lastActivity?.split("—")?.[1]?.trim() || "9 Abr, 6:00pm",
        source: "asesor",
        fileName: null,
        size: null,
      }];
    }
    return [];
  });
  const [updateChatOpen, setUpdateChatOpen] = useState(false);
  if (!lead) return null;
  const isLight = T !== P;
  // Color primario fuerte para títulos — respeta el tema claro/oscuro
  const titleC = isLight ? T.txt : "#FFFFFF";
  const assignAgent = (key) => onUpdate?.({...lead, aiAgent: key });
  const releaseAgent = () => onUpdate?.({...lead, aiAgent: null });
  const sc = lead.sc;
  const stageColor = stgC[lead.st] || T.accent;
  const stageIdx = STAGES.indexOf(lead.st);
  const inactive = lead.daysInactive || 0;
  const hot = !!lead.hot;

  // ── Próximas acciones recomendadas ──
  const nextActions = [];
  if (inactive >= 7) {
    nextActions.push({
      priority: "CRÍTICA", color: T.rose, icon: AlertCircle,
      title: "Reactivación inmediata",
      detail: `Lleva ${inactive} días sin contacto. Envía WhatsApp personalizado en las próximas 2 horas antes de enfriarse más.`,
      eta: "Hoy · 2h",
    });
  } else if (inactive >= 3) {
    nextActions.push({
      priority: "ALTA", color: T.amber, icon: Clock,
      title: "Seguimiento de cortesía",
      detail: `${inactive} días sin contacto. Mantén la conversación activa con un mensaje de valor (case study, update de obra).`,
      eta: "Hoy",
    });
  }
  if (lead.st === "Zoom Agendado") {
    nextActions.push({
      priority: "ALTA", color: T.accent, icon: CalendarDays,
      title: "Preparar Zoom con briefing IA",
      detail: "Genera dossier: historial, objeciones previstas, 3 proyectos alineados al presupuesto. Envía confirmación 24h y 1h antes.",
      eta: "Antes del Zoom",
    });
  }
  if (lead.st === "Propuesta Enviada") {
    nextActions.push({
      priority: "ALTA", color: T.accent, icon: FileText,
      title: "Seguimiento a propuesta",
      detail: "48h desde el envío es la ventana dorada. Llamada breve para resolver dudas + escasez controlada (últimas unidades).",
      eta: "+48h",
    });
  }
  if (sc >= 75 && lead.st !== "Cierre Concretado") {
    nextActions.push({
      priority: "OPORTUNIDAD", color: T.accent, icon: Target,
      title: "Movimiento de cierre",
      detail: `Score ${sc} indica alta intención. Propón siguiente paso tangible: visita, reserva simbólica o carta de intención.`,
      eta: "Esta semana",
    });
  }
  if (hot) {
    nextActions.push({
      priority: "HOT", color: T.accent, icon: Zap,
      title: "Acelerar cierre",
      detail: "Lead caliente detectado por IA. Prioriza agenda: contacto directo del director, no delegues.",
      eta: "24h",
    });
  }
  if (nextActions.length === 0) {
    nextActions.push({
      priority: "PRÓXIMA", color: T.accent, icon: MessageCircle,
      title: lead.nextAction || "Definir próximo touchpoint",
      detail: `Etapa ${lead.st}. Mantén ritmo de contacto cada 3–4 días para evitar enfriamiento.`,
      eta: lead.nextActionDate || "Por definir",
    });
  }

  // ── Estrategias técnicas sugeridas ──
  const strategies = [
    {
      icon: Target,
      title: "Anclaje de valor",
      detail: `Presenta primero la unidad premium del desarrollo — luego la recomendada. Esto posiciona su presupuesto de ${lead.budget || "referencia"} como una decisión inteligente, no un tope.`,
    },
    {
      icon: Shield,
      title: "Prueba social específica",
      detail: `Comparte 1–2 casos de clientes del mismo perfil (${lead.tag || "inversión"}) que cerraron en ${lead.p?.split("·")[0]?.trim() || "el mismo proyecto"}. Especifica ROI y timeline.`,
    },
    {
      icon: Clock,
      title: "Escasez temporal real",
      detail: "Comunica hitos concretos: 'quedan 3 unidades en esta línea de precio', 'la preventa sube 8% en 15 días'. Nunca inventes urgencia.",
    },
    {
      icon: Activity,
      title: "Micro-compromisos",
      detail: "Antes de pedir el gran sí, pide 3 pequeños sí: confirmar Zoom, revisar el dossier, responder a 2 preguntas. Escalera de compromiso.",
    },
  ];

  // ── Acciones inteligentes para cerrar ──
  const closingActions = [
    {
      icon: DollarSign,
      title: "Proponer reserva simbólica",
      detail: "USD $5,000 reembolsables 72h. Baja la fricción y convierte interés en decisión medible.",
      cta: "Generar acuerdo",
    },
    {
      icon: FileText,
      title: "Carta de intención personalizada",
      detail: "Dossier legal con beneficios fiscales + proyección a 10 años. IA lo genera en 3 segundos.",
      cta: "Generar borrador",
    },
    {
      icon: Phone,
      title: "Llamada de cierre asistida",
      detail: "Callcenter IA prepara briefing: objeciones esperadas, argumentos de cierre, tono del cliente.",
      cta: "Preparar llamada",
    },
  ];

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: T === P ? "rgba(2,5,12,0.45)" : "rgba(15,23,42,0.32)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 480, background: T === P ? "#111318" : "#FFFFFF", borderLeft: `1px solid ${T.borderH}`, display: "flex", flexDirection: "column", animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)", boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.55)" : "-24px 0 80px rgba(15,23,42,0.14)" }}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}22, ${T.blue}22)`, border: `1px solid ${T.accentB}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${T.accent}22` }}>
                <Zap size={15} color={T.accent} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: T.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Análisis IA</p>
                <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font }}>Estrategia personalizada de cierre</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.glassH}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            ><X size={13} color={T.txt3} /></button>
          </div>

          {/* Lead snapshot */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: T.glass, border: `1px solid ${T.border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `${stageColor}18`, border: `1px solid ${stageColor}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: stageColor, fontFamily: fontDisp, flexShrink: 0 }}>
              {lead.n.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: titleC, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                <InlineEdit value={lead.n} onSave={v => onUpdate?.({...lead, n: v})} T={T} isLight={isLight} placeholder="Nombre" editStyle={{ fontSize: 14, fontWeight: 700 }} />
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <Pill color={stageColor} s isLight={isLight}>{lead.st}</Pill>
                <span style={{ fontSize: 10.5, color: T.txt3 }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.txt2, fontFamily: fontDisp }}>
                  <InlineEdit
                    value={lead.budget}
                    onSave={v => { const parsed = parseBudget(v); onUpdate?.({...lead, budget: parsed ? formatBudget(parsed) : v, presupuesto: parsed || lead.presupuesto || 0 }); }}
                    T={T} isLight={isLight} placeholder="300k · 1.5M" emptyText="Sin presupuesto"
                    editStyle={{ fontSize: 11, fontWeight: 700, width: 110 }}
                  />
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.accent, fontFamily: fontDisp, lineHeight: 1 }}>{sc}</p>
              <p style={{ margin: 0, fontSize: 8.5, color: T.txt3, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>Score IA</p>
            </div>
          </div>

          {/* Etiquetas rápidas */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {hot && <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accentB}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.05em" }}>HOT</span>}
            {inactive >= 7 && <span style={{ fontSize: 9, fontWeight: 700, color: T.rose, background: `${T.rose}14`, border: `1px solid ${T.rose}33`, padding: "3px 9px", borderRadius: 99 }}>{inactive}d inactivo</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99 }}>Etapa {stageIdx + 1}/{STAGES.length}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", padding: "18px 22px 130px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Próxima acción — hero unificado, mismo componente que Perfil y Expediente.
              Es lo primero que ve el asesor al abrir el drawer: qué tiene que hacer
              concretamente con este cliente, antes de cualquier análisis.
              Wrapper con flexShrink: 0 para que el contenedor flex-column no lo comprima. ── */}
          <div style={{ flexShrink: 0 }}>
            <NextActionHero lead={lead} T={T} onUpdate={onUpdate} />
          </div>

          {/* ── Acciones rápidas — seguimientos + etapa editable ── */}
          <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            <FollowUpBadge lead={lead} onUpdate={onUpdate} T={T} />
            <StageBadge lead={lead} onUpdate={onUpdate} T={T} />
          </div>

          {/* ── 0. Delegar al equipo IA ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Atom size={12} color={T.accent} strokeWidth={2.2} />
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Delegar al equipo IA</p>
              {lead.aiAgent && (
                <button onClick={releaseAgent} style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: fontDisp, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.accent; e.currentTarget.style.borderColor = T.accentB; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.txt3; e.currentTarget.style.borderColor = T.border; }}
                ><X size={9} strokeWidth={2.5} /> Retomar control</button>
              )}
            </div>
            {!lead.aiAgent && (
              <p style={{ margin: "0 0 10px", fontSize: 11, color: T.txt3, lineHeight: 1.5 }}>
                Asigna un miembro de tu equipo IA. Tú conservas el control — puedes retomarlo en cualquier momento.
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {AI_AGENT_LIST.map(a => {
                const AI = a.icon;
                const isActive = lead.aiAgent === a.key;
                return (
                  <button key={a.key} onClick={() => assignAgent(a.key)} style={{
                    padding: "11px 12px", borderRadius: 11, textAlign: "left",
                    background: isActive ? `${a.color}14` : (isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)"),
                    border: `1px solid ${isActive ? `${a.color}55` : T.border}`,
                    cursor: "pointer", transition: "all 0.18s",
                    display: "flex", gap: 9, alignItems: "flex-start",
                    position: "relative", overflow: "hidden",
                    boxShadow: isActive ? `0 0 18px ${a.color}22, inset 0 1px 0 ${a.color}22` : "none",
                  }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = `${a.color}40`; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = T.border; } }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${a.color}20`, border: `1px solid ${a.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <AI size={13} color={a.color} strokeWidth={2.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isActive ? (isLight ? `color-mix(in srgb, ${a.color} 60%, #0B1220 40%)` : a.color) : titleC, fontFamily: fontDisp }}>{a.short}</p>
                        {isActive && <span style={{ fontSize: 8, fontWeight: 800, color: a.color, background: `${a.color}20`, padding: "1px 5px", borderRadius: 4, letterSpacing: "0.08em" }}>ACTIVO</span>}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: T.txt3, lineHeight: 1.4 }}>{a.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {lead.aiAgent && (() => {
              const a = AI_AGENTS[lead.aiAgent];
              const AI = a.icon;
              return (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: `${a.color}08`, border: `1px solid ${a.color}2A`, display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <AI size={13} color={a.color} strokeWidth={2.5} style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
                    <span style={{ color: a.color, fontWeight: 700, fontFamily: fontDisp }}>{a.name}</span> trabajará este cliente: {a.how}
                  </p>
                </div>
              );
            })()}
          </section>

          {/* ── 1. Próximas acciones recomendadas ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Target size={12} color={T.accent} strokeWidth={2.5} />
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Próximas acciones</p>
              <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 99 }}>{nextActions.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nextActions.map((a, i) => {
                const I = a.icon;
                return (
                  <div key={i} style={{ padding: "11px 13px", borderRadius: 11, background: `${a.color}08`, border: `1px solid ${a.color}2A` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <I size={13} color={a.color} strokeWidth={2.5} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: titleC, fontFamily: fontDisp }}>{a.title}</p>
                          <span style={{ fontSize: 8.5, fontWeight: 800, color: a.color, background: `${a.color}18`, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{a.priority}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: T.txt2, lineHeight: 1.5 }}>{a.detail}</p>
                        <p style={{ margin: "6px 0 0", fontSize: 9.5, color: a.color, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.05em" }}>⏱ {a.eta}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 2. Estrategias técnicas ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Activity size={12} color={T.blue} strokeWidth={2.5} />
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.blue, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Estrategias técnicas</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {strategies.map((s, i) => {
                const I = s.icon;
                return (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, display: "flex", gap: 9, alignItems: "flex-start", transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.borderColor = T.borderH; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.borderColor = T.border; }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `${T.blue}12`, border: `1px solid ${T.blue}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <I size={12} color={T.blue} strokeWidth={2.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: titleC, fontFamily: fontDisp }}>{s.title}</p>
                      <p style={{ margin: 0, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>{s.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 3. Acciones inteligentes de cierre ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Zap size={12} color={T.amber} strokeWidth={2.5} />
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.amber, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Acciones de cierre IA</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {closingActions.map((a, i) => {
                const I = a.icon;
                return (
                  <div key={i} style={{ padding: "11px 13px", borderRadius: 11, background: `${T.amber}06`, border: `1px solid ${T.amber}24`, display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${T.amber}16`, border: `1px solid ${T.amber}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <I size={13} color={T.amber} strokeWidth={2.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{a.title}</p>
                      <p style={{ margin: 0, fontSize: 10.5, color: T.txt3, lineHeight: 1.45 }}>{a.detail}</p>
                    </div>
                    <button onClick={() => oc(`__crm__ ${a.title.toLowerCase()} para ${lead.n.toLowerCase()}`, lead)} style={{
                      padding: "7px 11px", borderRadius: 8, background: `${T.amber}14`, border: `1px solid ${T.amber}40`, color: T.amber, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.16s"
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${T.amber}26`; e.currentTarget.style.boxShadow = `0 0 14px ${T.amber}30`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${T.amber}14`; e.currentTarget.style.boxShadow = "none"; }}
                    >{a.cta}</button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Dynamic Island — switcher entre Análisis IA · Perfil · Expediente */}
        <DrawerTabIsland current="analisis" onSwitch={onSwitchTab} T={T} />

        {/* ── UpdateChatPanel ── */}
        <UpdateChatPanel
          isOpen={updateChatOpen}
          onClose={() => setUpdateChatOpen(false)}
          expedienteItems={expedienteItems}
          onAddItem={item => setExpedienteItems(prev => [item, ...prev])}
          onRemoveItem={id => setExpedienteItems(prev => prev.filter(x => x.id !== id))}
          T={T}
        />
      </div>
    </>,
    document.body
  );
};

/* ═══════════════════════════════════════════
   ClickDropdown — selector con búsqueda + crear nuevo
   ═══════════════════════════════════════════
   Usado en el modal "Nuevo Cliente" para Asesor y Proyecto.
   - Muestra las opciones existentes (extraídas de leadsData + customs).
   - Permite filtrar por texto.
   - Al final del menú hay un CTA "Crear nuevo <entidad>" que abre un input
     inline; al confirmar, se agrega a la lista y queda seleccionado.
   - Theme-aware (T + isLight) y tipografía SF Pro en todos los elementos. */
const ClickDropdown = ({
  value, onChange, options, placeholder, label, icon: IconC,
  createLabel = "Crear nuevo", T = P, isLight = false,
}) => {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft]     = useState("");
  const wrapperRef = useRef(null);

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false); setCreating(false); setDraft(""); setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = (options || []).filter(o => !query || o.toLowerCase().includes(query.toLowerCase()));
  const showCreate = query && !options.some(o => o.toLowerCase() === query.toLowerCase());

  const commitCreate = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false); setCreating(false); setDraft(""); setQuery("");
  };

  const triggerBg   = isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.035)";
  const triggerBgH  = isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)";
  const menuBg      = isLight ? "#FFFFFF" : "#111318";
  const menuBorder  = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)";
  const menuShadow  = isLight
    ? "0 4px 12px rgba(15,23,42,0.08), 0 20px 40px rgba(15,23,42,0.10)"
    : "0 20px 44px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)";
  const itemHoverBg = isLight ? `${T.accent}10` : "rgba(255,255,255,0.06)";
  const activeBg    = isLight ? `${T.accent}14` : `${T.accent}18`;
  const activeBor   = isLight ? `${T.accent}55` : T.accentB;
  const activeC     = isLight ? T.accentDark || T.accent : T.accent;

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {/* Trigger con apariencia de input */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setCreating(false); }}
        style={{
          width: "100%", height: 40, padding: "0 13px",
          borderRadius: 10, background: triggerBg,
          border: `1px solid ${open ? T.accentB : (isLight ? T.border : "rgba(255,255,255,0.07)")}`,
          color: value ? T.txt : T.txt3,
          fontSize: 13, fontFamily: font, textAlign: "left",
          cursor: "pointer", outline: "none", boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: open ? `0 0 0 3px ${T.accent}0F` : "none",
          transition: "all 0.18s",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = triggerBgH; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = triggerBg; }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: value ? 600 : 400 }}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} color={T.txt3} strokeWidth={2.2}
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>

      {/* Menú */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          zIndex: 510, background: menuBg, border: `1px solid ${menuBorder}`,
          borderRadius: 12, boxShadow: menuShadow, overflow: "hidden",
          animation: "fadeIn 0.14s ease",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}>
          {/* Buscador / creador */}
          {creating ? (
            <div style={{ padding: 10, borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`, display: "flex", gap: 6 }}>
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitCreate(draft); if (e.key === "Escape") { setCreating(false); setDraft(""); } }}
                placeholder={`Nombre del ${label?.toLowerCase() || "elemento"}`}
                style={{
                  flex: 1, height: 34, padding: "0 11px", borderRadius: 8,
                  background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.accentB}`, color: T.txt,
                  fontSize: 12.5, fontFamily: font, outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button type="button" onClick={() => commitCreate(draft)}
                style={{ padding: "0 12px", height: 34, borderRadius: 8, background: activeBg, border: `1px solid ${activeBor}`, color: activeC, fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.01em" }}
              >Añadir</button>
            </div>
          ) : (
            <div style={{ padding: 8, borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`, position: "relative" }}>
              <Search size={11} color={T.txt3} strokeWidth={2.3}
                style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Buscar ${label?.toLowerCase() || "opción"}...`}
                style={{
                  width: "100%", height: 34, padding: "0 11px 0 32px", borderRadius: 8,
                  background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
                  color: T.txt, fontSize: 12.5, fontFamily: font, outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={e => { e.target.style.borderColor = T.accentB; }}
                onBlur={e => { e.target.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"; }}
              />
            </div>
          )}

          {/* Lista */}
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "6px 0" }}>
            {filtered.length === 0 && !showCreate && !creating && (
              <div style={{ padding: "14px 16px", fontSize: 12, color: T.txt3, fontFamily: font, textAlign: "center" }}>
                Sin resultados
              </div>
            )}
            {filtered.map(opt => {
              const active = opt === value;
              return (
                <button type="button" key={opt}
                  onClick={() => { onChange(opt); setOpen(false); setCreating(false); setQuery(""); }}
                  style={{
                    width: "100%", padding: "9px 14px",
                    background: active ? activeBg : "transparent",
                    border: "none", textAlign: "left", cursor: "pointer",
                    color: active ? activeC : T.txt2,
                    fontSize: 12.5, fontWeight: active ? 700 : 500,
                    fontFamily: font, display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = itemHoverBg; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {IconC && <IconC size={12} color={active ? activeC : T.txt3} strokeWidth={2.2} />}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
                  {active && <CheckCircle2 size={12} color={activeC} strokeWidth={2.4} />}
                </button>
              );
            })}
          </div>

          {/* CTA crear nuevo */}
          {!creating && (
            <button type="button"
              onClick={() => { setCreating(true); setDraft(showCreate ? query : ""); }}
              style={{
                width: "100%", padding: "11px 14px",
                background: isLight ? `${T.accent}08` : `${T.accent}10`,
                border: "none", borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`,
                textAlign: "left", cursor: "pointer",
                color: activeC, fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em",
                transition: "background 0.14s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = isLight ? `${T.accent}14` : `${T.accent}1C`}
              onMouseLeave={e => e.currentTarget.style.background = isLight ? `${T.accent}08` : `${T.accent}10`}
            >
              <Plus size={13} strokeWidth={2.6} />
              <span>{showCreate ? `Usar "${query}" como nuevo` : createLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   CRM — Pipeline Pro
═══════════════════════════════════════════ */
function CRM({ oc, co, leadsData, setLeadsData, theme = "dark", setTheme = () => {}, autoOpenPriority1 = 0, onAutoOpenHandled }) {
  const { user } = useAuth();
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  // Solo director, admin y super_admin ven todos los leads
  const canSeeAll = ["super_admin", "admin", "director"].includes(user?.role);
  const [sortField, setSortField]       = useState("sc");
  const [sortDir, setSortDir]           = useState("desc");
  const [filterStage, setFilterStage]   = useState("TODO");
  const [filterAsesor, setFilterAsesor] = useState("TODO");
  const [searchQ, setSearchQ]           = useState("");
  const [viewMode, setViewMode]         = useState("list");
  const [selectedLead, setSelectedLead] = useState(null);
  const [notesLead, setNotesLead]       = useState(null);
  const [analyzingLead, setAnalyzingLead] = useState(null);

  useEffect(() => {
    if (!autoOpenPriority1) return;
    const lead = priorityLeadsRef.current[0];
    if (lead) { setSelectedLead(null); setNotesLead(null); setAnalyzingLead(lead); }
    onAutoOpenHandled?.();
  }, [autoOpenPriority1]); // priorityLeadsRef is a ref, always current
  const [addingLead, setAddingLead]     = useState(false);
  const [budgetMenuOpen, setBudgetMenuOpen] = useState(false);
  const [stageMenuOpen, setStageMenuOpen]   = useState(false);
  const [newLead, setNewLead]           = useState({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", st: "Nuevo Registro", nextAction: "", notas: "" });
  // ── Listas maestras de asesores y proyectos ──
  // Se alimentan de leadsData + registros "custom" hechos desde el modal.
  // Al registrar un nuevo asesor/proyecto desde el modal, se añade aquí para
  // que esté disponible en el próximo alta sin necesidad de volver a teclearlo.
  const [customAsesores, setCustomAsesores]   = useState([]);
  const [customProyectos, setCustomProyectos] = useState([]);
  const [customCampanas, setCustomCampanas]   = useState([]);
  const [hoveredRow, setHoveredRow]     = useState(null);
  // Edición inline de "próxima acción" en tarjetas de prioridad — sincroniza
  // estado con el lead activo y se cierra al guardar/cancelar.
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionDraft, setActionDraft]         = useState({ a: "", d: "" });
  const startInlineAction = (lead) => {
    setActionDraft({ a: lead.nextAction || "", d: lead.nextActionDate || "" });
    setEditingActionId(lead.id);
  };
  const saveInlineAction = (lead) => {
    updateLead({ ...lead, nextAction: actionDraft.a.trim(), nextActionDate: actionDraft.d.trim() });
    setEditingActionId(null);
  };
  const cancelInlineAction = () => setEditingActionId(null);


  // Reset dropdowns cuando se cierra el modal
  useEffect(() => {
    if (!addingLead) { setBudgetMenuOpen(false); setStageMenuOpen(false); }
  }, [addingLead]);

  const [dragLeadId, setDragLeadId]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const kanbanRef = useRef(null);
  const [kanbanScrollPos, setKanbanScrollPos] = useState(0);

  // visibleLeads = leads accesibles según el rol del usuario
  const visibleLeads = canSeeAll ? leadsData : leadsData.filter(l => l.asesor === user?.name);

  const updateLead = (updated) => {
    setLeadsData(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (selectedLead?.id === updated.id) setSelectedLead(updated);
    if (notesLead?.id === updated.id) setNotesLead(updated);
    if (analyzingLead?.id === updated.id) setAnalyzingLead(updated);
  };
  const saveNotes = (newNotas) => { const u = {...notesLead, notas: newNotas}; updateLead(u); setNotesLead(u); };

  // Switcher unificado del Dynamic Island — al cambiar de tab, cerramos el drawer
  // actual y abrimos el target con el MISMO lead. Así el vendedor navega Análisis IA
  // · Perfil · Expediente sin fricción.
  const openDrawerTab = (tab, lead) => {
    if (!lead) return;
    if (tab === "analisis") {
      setSelectedLead(null); setNotesLead(null); setAnalyzingLead(lead);
    } else if (tab === "perfil") {
      setAnalyzingLead(null); setNotesLead(null); setSelectedLead(lead);
    } else if (tab === "expediente") {
      setAnalyzingLead(null); setSelectedLead(null); setNotesLead(lead);
    }
  };
  const handleDragStart = (e, id) => {
    setDragLeadId(id);
    e.dataTransfer.effectAllowed = "move";
    // Custom drag image for clarity
    const el = e.currentTarget;
    if (el) { e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20); }
  };
  const handleDragOver = (e, stage) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); };
  const handleDrop = (e, stage) => {
    e.preventDefault();
    if (dragLeadId) {
      setLeadsData(prev => prev.map(l => l.id === dragLeadId ? {...l, st: stage} : l));
      // If we pinned/auto-prioritized this lead, update its stage in pinnedIds context too
    }
    setDragLeadId(null);
    setDragOverStage(null);
  };
  const handleDragEnd = () => { setDragLeadId(null); setDragOverStage(null); };
  const [expandedPriority, setExpandedPriority] = useState(null);
  const [pinnedIds,    setPinnedIds]    = useState(new Set());
  const [pinnedOrder,  setPinnedOrder]  = useState([]); // tracks pin history: last element = most recently pinned
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [priorityOrder, setPriorityOrder] = useState([]); // IDs ordered manually
  const [prioritySort, setPrioritySort] = useState("manual"); // manual | newest | oldest | concretado
  const [dragCardId,   setDragCardId]   = useState(null);
  const [dragInsertIdx, setDragInsertIdx] = useState(null); // index where card will be inserted

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPinnedOrder(p => p.filter(x => x !== id));
      } else {
        next.add(id);
        setDismissedIds(p => { const d = new Set(p); d.delete(id); return d; });
        setPinnedOrder(p => [...p.filter(x => x !== id), id]); // append → most recent last
      }
      return next;
    });
  };
  const dismissPriority = (id) => {
    setDismissedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const asesores = [...new Set(visibleLeads.map(l => l.asesor))];
  // Listas maestras: únicas, sin vacíos, ordenadas alfabéticamente.
  // Se alimentan de leadsData (todos, no solo visibles — para que un director
  // también vea asesores completos) + customs añadidos desde el modal.
  const asesoresMaster = useMemo(() => {
    const set = new Set([...leadsData.map(l => l.asesor), ...customAsesores].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customAsesores]);
  const proyectosMaster = useMemo(() => {
    const set = new Set([...leadsData.map(l => l.p), ...customProyectos].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customProyectos]);
  // Campañas activas de marketing — las 3 campañas vigentes de Facebook Ads
  // están preregistradas para métricas consistentes. El asesor puede crear
  // campañas adicionales desde el modal si aparecen nuevas.
  const FB_CAMPAIGNS_BASE = [
    "Facebook Ads · Bay View Grand",
    "Facebook Ads · Cancún",
    "Facebook Ads · Tulum",
  ];
  const campanasMaster = useMemo(() => {
    const set = new Set([
      ...FB_CAMPAIGNS_BASE,
      ...leadsData.map(l => l.campana),
      ...customCampanas,
    ].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customCampanas]);



  const urgColor = (d) => d >= 10 ? T.violet : d >= 5 ? T.cyan : T.emerald;

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
    const parsedBudget = parseBudget(newLead.budget);
    const newEntry = {
      id: Date.now(), ...newLead, sc: 40, st: newLead.st || "Nuevo Registro",
      tag: newLead.tag || newLead.st || "Nuevo Registro", hot: false, isNew: true, fechaIngreso: dateStr,
      bio: "Cliente recién registrado. Pendiente primer contacto.", risk: "Sin información suficiente aún.",
      friction: "Medio",
      nextAction: newLead.nextAction?.trim() || "Primer contacto en las próximas 24 horas",
      nextActionDate: "Hoy", lastActivity: "Registro manual", daysInactive: 0,
      email: newLead.email || "",
      notas: newLead.notas?.trim()
        ? `📍 OBJETIVO\nPendiente — primer contacto.\n\n📋 NOTAS INICIALES\n${newLead.notas.trim()}\n\n⚡ PENDIENTE\nRealizar primer contacto y calificar necesidades.`
        : `📍 OBJETIVO\nPendiente — primer contacto.\n\n⚡ PENDIENTE\nRealizar primer contacto y calificar necesidades del cliente.`,
      presupuesto: parsedBudget,
      budget: parsedBudget ? formatBudget(parsedBudget) : (newLead.budget || ""),
    };
    setLeadsData(prev => [newEntry, ...prev]);
    // Si el asesor o proyecto son nuevos (no existían en leadsData), los
    // registramos como custom para que aparezcan en los dropdowns del
    // siguiente alta. Así el usuario no tiene que volver a teclearlos.
    if (newLead.asesor && !leadsData.some(l => l.asesor === newLead.asesor) && !customAsesores.includes(newLead.asesor)) {
      setCustomAsesores(prev => [...prev, newLead.asesor]);
    }
    if (newLead.p && !leadsData.some(l => l.p === newLead.p) && !customProyectos.includes(newLead.p)) {
      setCustomProyectos(prev => [...prev, newLead.p]);
    }
    // Registrar campaña nueva si no estaba en base ni en leads ni en customs.
    if (newLead.campana
        && !FB_CAMPAIGNS_BASE.includes(newLead.campana)
        && !leadsData.some(l => l.campana === newLead.campana)
        && !customCampanas.includes(newLead.campana)) {
      setCustomCampanas(prev => [...prev, newLead.campana]);
    }
    setAddingLead(false);
    setNewLead({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", st: "Nuevo Registro", nextAction: "", notas: "" });
    setQuickText("");
  };

  const SH = ({ label, field, align = "left" }) => {
    const active = sortField === field;
    return (
      <span onClick={() => handleSort(field)} style={{
        cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        color: active ? T.accent : T.txt3, fontSize: 9.5, fontWeight: 700,
        fontFamily: fontDisp, letterSpacing: "0.07em", textTransform: "uppercase",
        transition: "color 0.15s",
      }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>
      </span>
    );
  };

  const isAutoPriority = (l) => (l.isNew || l.st === "Zoom Concretado" || l.st === "Zoom Agendado" || l.hot || l.daysInactive <= 3) && !dismissedIds.has(l.id);
  const rawPriorityLeads = visibleLeads.filter(l => pinnedIds.has(l.id) || isAutoPriority(l));
  // Orden final: modo manual respeta drag & dropdown de posición; los demás aplican criterio
  const priorityLeads = (() => {
    const arr = [...rawPriorityLeads];
    const recency = (l) => l.id || 0; // id mayor = registro más reciente
    switch (prioritySort) {
      case "newest":
        // Pinned recently → first (pinnedOrder: last element = most recent pin)
        return arr.sort((a, b) => {
          const ai = pinnedOrder.indexOf(a.id);
          const bi = pinnedOrder.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return bi - ai; // higher index = more recently pinned
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return ((b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)) || recency(b) - recency(a);
        });
      case "oldest":
        // Most recently pinned → last
        return arr.sort((a, b) => {
          const ai = pinnedOrder.indexOf(a.id);
          const bi = pinnedOrder.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return 1;
          if (bi !== -1) return -1;
          return ((a.isNew ? 1 : 0) - (b.isNew ? 1 : 0)) || recency(a) - recency(b);
        });
      case "concretado":
        return arr.sort((a, b) => {
          const aCon = a.st === "Zoom Concretado" ? 1 : 0;
          const bCon = b.st === "Zoom Concretado" ? 1 : 0;
          return bCon - aCon || b.sc - a.sc;
        });
      case "manual":
      default:
        return priorityOrder.length
          ? arr.sort((a, b) => {
              const ia = priorityOrder.indexOf(a.id);
              const ib = priorityOrder.indexOf(b.id);
              if (ia === -1 && ib === -1) return b.sc - a.sc;
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            })
          : arr.sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0) || b.sc - a.sc);
    }
  })();

  // ── Drag & drop para reordenar priority cards ──────────────────────────────
  // Usamos refs para los valores críticos del drop (siempre síncronos, sin closure stale)
  const [justDroppedId, setJustDroppedId] = useState(null);
  const justDroppedTimer  = useRef(null);
  const dragCardIdRef     = useRef(null);   // fuente de verdad para el drop
  const dragInsertIdxRef  = useRef(null);   // fuente de verdad para el drop
  const priorityLeadsRef  = useRef([]);     // snapshot del array para el drop
  // dragOverCardRef: evita re-renders excesivos durante dragover
  const dragOverCardRef   = useRef(null);

  // Sincronizar priorityLeadsRef en cada render
  priorityLeadsRef.current = priorityLeads;

  const handleCardDragStart = (e, id) => {
    // Si veníamos en modo sort automático, congelar el orden actual como "manual"
    if (prioritySort !== "manual") {
      setPriorityOrder(priorityLeadsRef.current.map(l => l.id));
      setPrioritySort("manual");
    }
    dragCardIdRef.current   = id;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(id);
    setDragInsertIdx(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleCardDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const inRightHalf = e.clientX > rect.left + rect.width / 2;
    const newInsert = inRightHalf ? idx + 1 : idx;
    dragInsertIdxRef.current = newInsert;   // siempre actualizar ref (síncrono)
    if (dragOverCardRef.current !== newInsert) {
      dragOverCardRef.current = newInsert;
      setDragInsertIdx(newInsert);           // state solo para la línea visual
    }
  };

  const handleCarouselDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const last = priorityLeadsRef.current.length;
    dragInsertIdxRef.current = last;
    if (dragOverCardRef.current !== last) {
      dragOverCardRef.current = last;
      setDragInsertIdx(last);
    }
  };

  const commitCardDrop = () => {
    // Leer SIEMPRE de refs — nunca del closure de estado
    const insertIdx = dragInsertIdxRef.current;
    const fromId    = dragCardIdRef.current;
    // Limpiar todo
    dragCardIdRef.current    = null;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(null);
    setDragInsertIdx(null);

    if (insertIdx === null || insertIdx === undefined || !fromId) return;

    const ids = priorityLeadsRef.current.map(l => l.id);
    const fromIdx = ids.indexOf(fromId);
    if (fromIdx === -1) return;

    const without = ids.filter(id => id !== fromId);
    const destIdx = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
    const clamped = Math.max(0, Math.min(destIdx, without.length));
    without.splice(clamped, 0, fromId);

    if (without.join(",") === ids.join(",")) return;  // sin cambio real

    // Guardar scroll actual ANTES del re-render para restaurarlo después
    const savedScroll = carouselRef.current ? carouselRef.current.scrollLeft : 0;

    setPriorityOrder(without);

    // Doble rAF: esperar que React termine el re-render y luego restaurar scroll
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (carouselRef.current) {
        carouselRef.current.scrollLeft = savedScroll;
      }
    }));

    // Highlight 3 segundos — solo borde blanco sutil
    if (justDroppedTimer.current) clearTimeout(justDroppedTimer.current);
    setJustDroppedId(fromId);
    justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 3000);
  };

  const handleCardDrop     = (e) => { e.preventDefault(); e.stopPropagation(); commitCardDrop(); };
  const handleCarouselDrop = (e) => { e.preventDefault(); commitCardDrop(); };

  // Mover un lead a una posición específica (1-indexed) vía dropdown
  const moveToPriorityPosition = (leadId, newPos) => {
    const ids = priorityLeadsRef.current.map(l => l.id);
    const fromIdx = ids.indexOf(leadId);
    if (fromIdx === -1) return;
    const targetIdx = Math.max(0, Math.min(newPos - 1, ids.length - 1));
    if (targetIdx === fromIdx) return;

    const without = ids.filter(id => id !== leadId);
    without.splice(targetIdx, 0, leadId);

    const savedScroll = carouselRef.current ? carouselRef.current.scrollLeft : 0;
    // Asegurar modo manual para que el orden seleccionado prevalezca
    if (prioritySort !== "manual") setPrioritySort("manual");
    setPriorityOrder(without);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (carouselRef.current) carouselRef.current.scrollLeft = savedScroll;
    }));

    if (justDroppedTimer.current) clearTimeout(justDroppedTimer.current);
    setJustDroppedId(leadId);
    justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 3000);
  };
  const handleCardDragEnd  = () => {
    dragCardIdRef.current    = null;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(null);
    setDragInsertIdx(null);
  };

  const carouselRef = useRef(null);
  const [prioScrollX, setPrioScrollX] = useState(0);
  const scrollCarousel = (dir) => carouselRef.current?.scrollBy({ left: dir * 310, behavior: "smooth" });
  const totalPipeline = visibleLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const avgScore = visibleLeads.length ? Math.round(visibleLeads.reduce((s, l) => s + l.sc, 0) / visibleLeads.length) : 0;
  const hotLeads = visibleLeads.filter(l => l.hot || l.daysInactive <= 2).length;
  const newLeadsCount = visibleLeads.filter(l => l.isNew).length;
  const nearCloseLeads = visibleLeads.filter(l => l.st === "Negociación" || l.st === "Cierre").length;
  const kanbanStages = STAGES.filter(s => s !== "Perdido");

  /* Responsive grid columns — 5 columnas en modo full, 4 en compact.
     · Cliente: absorbe avatar + nombre + tags + sub-línea (asesor · proyecto · fecha)
       y el presupuesto a la derecha dentro de la misma celda, para que lo
       monetario viva junto al nombre sin una columna extra.
     · Etapa, Seguim., Score (solo full), Acciones. */
  const colsFull    = "2.4fr 140px 140px 110px 140px";
  const colsCompact = "2fr 130px 130px 120px";
  const cols = co ? colsCompact : colsFull;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 18,
      color: T.txt,
      transition: "color 0.3s ease",
    }}>

      {/* ── HEADER ROW ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, boxShadow: `0 0 10px ${T.accent}80` }} />
            <h2 style={{ fontSize: 20, fontWeight: 400, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>
              CRM{" "}
              <span style={{ fontWeight: 300, color: isLight ? T.txt3 : "rgba(255,255,255,0.38)" }}>Asesores</span>
            </h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{visibleLeads.length} clientes</span>
            {!canSeeAll && <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, background: `${T.amber}10`, border: `1px solid ${T.amber}28`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.04em" }}>Vista personal</span>}
          </div>
          <p style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, margin: 0 }}>
            <span style={{ color: T.txt2 }}>${(totalPipeline/1000000).toFixed(1)}M</span> en pipeline · <span style={{ color: T.emerald }}>{hotLeads} activos</span> · Score promedio <span style={{ color: T.blue }}>{avgScore}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setAddingLead(true)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 11,
            background: isLight
              ? `linear-gradient(135deg, ${T.accent}, ${T.emerald})`
              : "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
            border: `1px solid ${isLight ? "transparent" : T.accentB}`,
            color: isLight ? "#FFFFFF" : T.accent,
            fontSize: 12, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
            letterSpacing: "0.01em", transition: "all 0.2s", flexShrink: 0,
            boxShadow: isLight ? `0 4px 14px ${T.accent}40` : "none",
          }}
            onMouseEnter={e => {
              if (isLight) {
                e.currentTarget.style.boxShadow = `0 6px 18px ${T.accent}55`;
                e.currentTarget.style.transform = "translateY(-1px)";
              } else {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))";
                e.currentTarget.style.boxShadow = `0 0 20px ${T.accent}18`;
              }
            }}
            onMouseLeave={e => {
              if (isLight) {
                e.currentTarget.style.boxShadow = `0 4px 14px ${T.accent}40`;
                e.currentTarget.style.transform = "none";
              } else {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          ><Plus size={14} /> Nuevo cliente</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <KPI T={T} label="Clientes en Pipeline" value={visibleLeads.length} sub={`${hotLeads} activos hoy`} icon={Users} />
        <KPI T={T} label="Score Promedio" value={avgScore} sub="+4.8 este mes" icon={Target} />
        <KPI T={T} label="Tasa de Conversión" value="18.4%" sub="+3.2pp este mes" icon={TrendingUp} />
        <KPI T={T} label="Valor Total Pipeline" value={`$${(totalPipeline/1000000).toFixed(1)}M`} sub={`${nearCloseLeads} en cierre`} icon={DollarSign} />
      </div>

      {/* ── CLIENTES EN PRIORIDAD — todos, color por tipo, botones uniformes ── */}
      {priorityLeads.length > 0 && (() => {

        // Paleta de tipo — cada categoría tiene identidad visual única
        const getCardMeta = (l) => {
          if (l.hot) return {
            color: "#34D399",
            topBar: "linear-gradient(90deg, #34D399 0%, #6EE7C2 50%, #34D399 100%)",
            label: `CALIENTE · ${l.daysInactive}D`, sublabel: "Actuar ahora mismo",
            pulse: true, glow: true,
          };
          if (l.isNew) return {
            color: "#34D399",
            topBar: "linear-gradient(90deg, #34D399 0%, #6EE7C2 50%, #34D399 100%)",
            label: "NUEVO REGISTRO", sublabel: "Primer contacto — no esperes",
            pulse: true, glow: true,
          };
          if (l.st === "Zoom Agendado") return {
            color: "#60A5FA",
            topBar: "linear-gradient(90deg, #60A5FA 0%, #93C5FD 50%, transparent 100%)",
            label: "ZOOM AGENDADO", sublabel: "Preparar presentación de cierre",
            pulse: false, glow: false,
          };
          if (l.st === "Zoom Concretado") return {
            color: "#4ADE80",
            topBar: "linear-gradient(90deg, #4ADE80 0%, #86EFAC 50%, transparent 100%)",
            label: "ZOOM CONCRETADO ✓", sublabel: "Enviar propuesta y cerrar hoy",
            pulse: false, glow: false,
          };
          if (l.st === "Negociación") return {
            color: "#FB923C",
            topBar: "linear-gradient(90deg, #FB923C 0%, #FDBA74 50%, transparent 100%)",
            label: "EN NEGOCIACIÓN", sublabel: "Cerrar condiciones esta semana",
            pulse: false, glow: false,
          };
          if (l.daysInactive >= 7) return {
            color: "#67E8F9",
            topBar: "linear-gradient(90deg, #67E8F9 0%, #A5F3FC 50%, transparent 100%)",
            label: `SIN CONTACTO · ${l.daysInactive}D`, sublabel: "Retomar antes de que enfríe",
            pulse: false, glow: false,
          };
          return {
            color: "#7EB8F0",
            topBar: "linear-gradient(90deg, #7EB8F0 0%, #BAD4F5 50%, transparent 100%)",
            label: "ACCIÓN PENDIENTE", sublabel: "Revisar y avanzar hoy",
            pulse: false, glow: false,
          };
        };

        return (
          <div>
            {/* Header — 3 zonas: título (izq) · leyenda (centro absoluto) · orden (der) */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 16px 7px 12px", borderRadius: 99,
                  position: "relative",
                  background: isLight
                    ? `linear-gradient(135deg, ${T.accent}18 0%, ${T.accent}08 100%)`
                    : "rgba(52,211,153,0.08)",
                  border: `1px solid ${isLight ? T.accent + "44" : "rgba(52,211,153,0.24)"}`,
                  boxShadow: isLight
                    ? `0 1px 4px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.9)`
                    : `0 0 12px ${T.accent}10`,
                }}>
                  {/* Dot respirando */}
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, #5CE0B0, ${T.accent})`,
                    animation: "priorityBreathe 2.4s ease-in-out infinite",
                  }} />
                  <span style={{
                    fontSize: 12.5, fontWeight: 800,
                    color: isLight ? T.accentDark : "#FFFFFF",
                    letterSpacing: "-0.005em", fontFamily: fontDisp,
                  }}>Clientes en prioridad</span>
                </div>
                <span style={{
                  fontSize: 11, color: T.txt2, fontFamily: font, fontWeight: 500,
                }}>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{priorityLeads.length}</span> cliente{priorityLeads.length !== 1 ? "s" : ""} esperando acción
                </span>
              </div>
              {/* Leyenda de tipos — centrada absolutamente, no afectada por
                  los anchos del título y el selector de orden. */}
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex", alignItems: "center", gap: 14,
                padding: "5px 14px", borderRadius: 99,
                background: isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`,
                pointerEvents: "none",
              }}>
                {[
                  { color: "#34D399", label: "Urgente / Nuevo" },
                  { color: "#60A5FA", label: "Zoom agendado" },
                  { color: "#4ADE80", label: "Zoom concretado" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: color,
                      boxShadow: `0 0 0 2px ${isLight ? "#FFFFFF" : "#0B0F17"}, 0 0 0 3px ${color}40`,
                    }} />
                    <span style={{ fontSize: 10, color: T.txt2, fontFamily: font, fontWeight: 500, letterSpacing: "0.01em" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Selector de orden — al costado derecho */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 600 }}>Ordenar</span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <select
                    value={prioritySort}
                    onChange={e => setPrioritySort(e.target.value)}
                    title="Cambiar orden de las tarjetas de prioridad"
                    style={{
                      appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                      height: 28, padding: "0 26px 0 12px", minWidth: 168,
                      borderRadius: 8,
                      background: prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                        : `${T.accent}14`,
                      border: `1px solid ${prioritySort === "manual" ? T.border : `${T.accent}44`}`,
                      color: prioritySort === "manual" ? T.txt2 : (isLight ? T.accentDark || T.accent : T.accent),
                      fontSize: 11, fontWeight: 600, fontFamily: font,
                      outline: "none", cursor: "pointer",
                      transition: "background 0.15s, border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)")
                        : `${T.accent}22`;
                      e.currentTarget.style.borderColor = prioritySort === "manual" ? T.borderH : `${T.accent}77`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                        : `${T.accent}14`;
                      e.currentTarget.style.borderColor = prioritySort === "manual" ? T.border : `${T.accent}44`;
                    }}
                  >
                    <option value="manual"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Manual (arrastra)</option>
                    <option value="newest"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Nuevos primero</option>
                    <option value="oldest"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Nuevos al fondo</option>
                    <option value="concretado" style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Zoom Concretado</option>
                  </select>
                  <ChevronDown size={12} color={prioritySort === "manual" ? T.txt3 : T.accent} strokeWidth={2.5} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>
            </div>

            {/* Carrusel horizontal — wrapper relativo para anclar los botones superpuestos */}
            <div style={{ position: "relative" }}>
            <div style={{
              position: "relative",
              maskImage: "linear-gradient(90deg, #000 0%, #000 97%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 97%, transparent 100%)",
            }}>
            <div ref={carouselRef}
              onDragOver={handleCarouselDragOver}
              onDrop={handleCarouselDrop}
              onScroll={e => setPrioScrollX(e.currentTarget.scrollLeft)}
              className="carousel-no-scroll"
              style={{ display: "flex", gap: 12, overflowX: "auto", padding: "10px 24px 20px 8px", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
              {priorityLeads.map((l, cardIdx) => {
                const sc = l.sc;
                const stageColor = stgC[l.st] || T.txt3;
                const meta = getCardMeta(l);
                const prioNum = cardIdx + 1;

                const isDraggingCard = dragCardId === l.id;
                const isJustDropped  = justDroppedId === l.id;
                const showInsertBefore = dragInsertIdx === cardIdx && dragCardId && dragCardId !== l.id;
                const showInsertAfter  = dragInsertIdx === cardIdx + 1 && dragCardId && cardIdx === priorityLeads.length - 1;
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                    {/* Insert-before indicator */}
                    {showInsertBefore && (
                      <div style={{ width: 3, borderRadius: 3, background: T.accent, boxShadow: `0 0 12px ${T.accent}80`, marginRight: 4, alignSelf: "stretch", flexShrink: 0, transition: "opacity 0.15s" }} />
                    )}
                  {(() => {
                    // ── Shadow budget ───────────────────────────────────────────────────
                    // The carousel is overflow-x:auto → overflow-y also clips.
                    // Carousel bottom-padding = 20px.  Hover translateY = -2px.
                    // Max downward shadow reach = -2 (translate) + y-offset + blur-radius.
                    // All shadow values below are sized so that reach ≤ 18px  (< 20px padding).
                    // ────────────────────────────────────────────────────────────────────
                    const restBorder = isLight
                      ? `${meta.color}30`
                      : `${meta.color}22`;
                    const restShadow = isLight
                      ? `0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,1)`
                      : `0 1px 4px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)`;
                    const hoverBorder = isLight ? `${meta.color}68` : `${meta.color}55`;
                    const hoverShadow = isLight
                      ? `0 2px 6px rgba(15,23,42,0.07), 0 8px 22px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,1)`
                      : `0 3px 10px rgba(0,0,0,0.38), 0 8px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)`;
                    const droppedBorder = isLight ? `${meta.color}80` : `${meta.color}66`;
                    const droppedShadow = isLight
                      ? `0 0 0 3px ${meta.color}18, 0 4px 14px rgba(15,23,42,0.08)`
                      : `0 0 0 2px ${meta.color}30, 0 4px 16px rgba(0,0,0,0.42)`;
                    return (
                  <div
                    draggable
                    onDragStart={e => handleCardDragStart(e, l.id)}
                    onDragOver={e => { e.stopPropagation(); handleCardDragOver(e, cardIdx); }}
                    onDrop={e => { e.stopPropagation(); handleCardDrop(e); }}
                    onDragEnd={handleCardDragEnd}
                    onClick={() => { if (!dragCardId && !isDraggingCard) setSelectedLead(l); }}
                    title="Click para ver perfil completo · arrastrar para reordenar"
                    style={{
                      width: co ? 256 : 288, flexShrink: 0,
                      borderRadius: 18, overflow: "hidden",
                      position: "relative",
                      background: isLight
                        ? "#FFFFFF"
                        : `linear-gradient(175deg, rgba(10,14,24,0.97) 0%, rgba(5,7,14,0.99) 100%)`,
                      backdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
                      WebkitBackdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
                      border: `1px solid ${isJustDropped ? droppedBorder : restBorder}`,
                      boxShadow: isJustDropped ? droppedShadow : restShadow,
                      display: "flex", flexDirection: "column",
                      transition: "transform 0.22s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease",
                      opacity: isDraggingCard ? 0.35 : 1,
                      cursor: dragCardId ? (isDraggingCard ? "grabbing" : "copy") : "pointer",
                      transform: isDraggingCard ? "scale(0.97)" : "none",
                    }}
                    onMouseEnter={e => {
                      if (!dragCardId) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = hoverShadow;
                        e.currentTarget.style.borderColor = hoverBorder;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!dragCardId) {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = restShadow;
                        e.currentTarget.style.borderColor = restBorder;
                      }
                    }}
                  >
                    {/* Color wash — top ambient glow from card type color */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: isLight
                        ? `radial-gradient(ellipse 200px 120px at 50% -10%, ${meta.color}10 0%, transparent 65%)`
                        : `radial-gradient(ellipse 220px 130px at 50% -10%, ${meta.color}0C 0%, transparent 65%)`,
                      pointerEvents: "none",
                    }} />
                    {/* Top bar — 4px, shimmer on hot/new */}
                    <div
                      className={meta.glow ? "topbar-shimmer" : "topbar-static"}
                      style={{ height: 4, flexShrink: 0, backgroundImage: meta.topBar }}
                    />

                    <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>

                      {/* Fila superior: #N selector + dot + X — minimalista */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {/* Selector de posición — pill glassmorphic */}
                          <div
                            onMouseDown={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                            draggable={false}
                            title="Cambiar posición de prioridad"
                            style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}
                          >
                            <select
                              value={prioNum}
                              onChange={e => moveToPriorityPosition(l.id, parseInt(e.target.value, 10))}
                              style={{
                                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                                height: 28, padding: "0 26px 0 11px", minWidth: 108,
                                borderRadius: 9,
                                background: isLight
                                  ? "rgba(255,255,255,0.88)"
                                  : "rgba(255,255,255,0.07)",
                                border: `1px solid ${isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)"}`,
                                color: isLight ? "#0B1220" : "#FFFFFF",
                                fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                                letterSpacing: "-0.01em",
                                lineHeight: 1, outline: "none", cursor: "pointer",
                                textAlign: "center", textAlignLast: "center",
                                boxShadow: isLight
                                  ? "0 1px 4px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.85)"
                                  : "0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.12)";
                                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.22)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.07)";
                                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)";
                              }}
                            >
                              {priorityLeads.map((_, i) => (
                                <option key={i} value={i + 1} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#fff", fontFamily: fontDisp }}>Prioridad {i + 1}</option>
                              ))}
                            </select>
                            <ChevronDown size={9} color={isLight ? "rgba(11,18,32,0.38)" : "rgba(255,255,255,0.38)"} strokeWidth={2.5} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                          </div>
                        </div>
                        {/* X — quitar de prioridad */}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                          onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                          draggable={false}
                          onClick={e => { e.stopPropagation(); dismissPriority(l.id); }}
                          title="Quitar de prioridad"
                          style={{
                            width: 24, height: 24, borderRadius: 7,
                            background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
                            color: T.txt3, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 0, flexShrink: 0, transition: "all 0.14s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = isLight ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.14)";
                            e.currentTarget.style.borderColor = isLight ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.40)";
                            e.currentTarget.style.color = isLight ? "#B91C1C" : "#FCA5A5";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)";
                            e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)";
                            e.currentTarget.style.color = T.txt3;
                          }}
                        >
                          <X size={10} strokeWidth={2.4} />
                        </button>
                      </div>

                      {/* Nombre + presupuesto + etapa */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                          {meta.pulse && (
                            <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: meta.color, boxShadow: `0 0 6px ${meta.color}90`, animation: "pulse 1.8s ease-in-out infinite" }} />
                          )}
                          <p style={{ fontSize: 15.5, fontWeight: 600, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.022em", lineHeight: 1.2, margin: 0 }}>{l.n}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <Pill color={stageColor} s isLight={isLight}>{l.st}</Pill>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{l.budget}</span>
                        </div>
                      </div>

                      {/* Agente IA asignado — badge contextual */}
                      {(() => {
                        const agent = l.aiAgent ? AI_AGENTS[l.aiAgent] : null;
                        if (!agent) return null;
                        const AI = agent.icon;
                        return (
                          <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, background: `${agent.color}12`, border: `1px solid ${agent.color}35`, boxShadow: `0 0 10px ${agent.color}18` }}>
                            <div style={{ width: 20, height: 20, borderRadius: 6, background: `${agent.color}22`, border: `1px solid ${agent.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                              <AI size={10} color={agent.color} strokeWidth={2.5} />
                              <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: agent.color, boxShadow: `0 0 5px ${agent.color}`, animation: "pulse 2s ease-in-out infinite" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: agent.color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>IA activa · {agent.short}</p>
                              <p style={{ margin: 0, fontSize: 9, color: T.txt3, fontFamily: font }}>Tú conservas el control</p>
                            </div>
                            <button
                              onClick={() => updateLead({...l, aiAgent: null})}
                              title="Retomar control — liberar agente"
                              style={{ background: "transparent", border: "none", color: T.txt3, cursor: "pointer", padding: 4, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.14s" }}
                              onMouseEnter={e => { e.currentTarget.style.color = agent.color; e.currentTarget.style.background = `${agent.color}18`; }}
                              onMouseLeave={e => { e.currentTarget.style.color = T.txt3; e.currentTarget.style.background = "transparent"; }}
                            >
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })()}

                      {/* Score row — label · bar · number */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: fontDisp,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          color: isLight ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.28)",
                          flexShrink: 0,
                        }}>SC</span>
                        <div style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)",
                          overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${sc}%`, height: "100%", borderRadius: 99,
                            background: isLight
                              ? `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}BB 100%)`
                              : "rgba(255,255,255,0.82)",
                            boxShadow: sc >= 80
                              ? (isLight ? `0 0 6px ${meta.color}66` : "0 0 8px rgba(255,255,255,0.30)")
                              : "none",
                            transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 300, fontFamily: fontDisp,
                          letterSpacing: "-0.01em", lineHeight: 1,
                          color: isLight ? "rgba(15,23,42,0.70)" : "rgba(255,255,255,0.80)",
                          flexShrink: 0, minWidth: 22, textAlign: "right",
                        }}>{sc}</span>
                      </div>

                      {/* Próxima acción — HERO del card */}
                      {(() => {
                        const isEditingAction = editingActionId === l.id;
                        return (
                          <div onClick={e => e.stopPropagation()} style={{
                            borderRadius: 12,
                            background: isLight
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isEditingAction
                              ? (meta.color + (isLight ? "60" : "50"))
                              : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)")}`,
                            overflow: "hidden", flex: 1,
                            boxShadow: isLight
                              ? "inset 0 1px 0 rgba(255,255,255,1), 0 1px 6px rgba(15,23,42,0.05)"
                              : "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 4px rgba(0,0,0,0.15)",
                            transition: "border-color 0.15s",
                          }}>
                            {/* Header row */}
                            <div style={{
                              padding: "8px 12px 7px",
                              borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`,
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {/* Left accent bar */}
                                <div style={{ width: 2.5, height: 14, borderRadius: 2, background: meta.color, flexShrink: 0, opacity: 0.85 }} />
                                <span style={{
                                  fontSize: 9, fontWeight: 700,
                                  color: isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.42)",
                                  letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: fontDisp,
                                }}>Próxima acción</span>
                              </div>
                              {!isEditingAction && l.nextActionDate && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700,
                                  color: isLight ? meta.color : "rgba(255,255,255,0.45)",
                                  background: isLight ? `${meta.color}12` : "rgba(255,255,255,0.06)",
                                  padding: "2px 8px", borderRadius: 99, fontFamily: fontDisp,
                                  border: isLight ? `1px solid ${meta.color}28` : "1px solid rgba(255,255,255,0.08)",
                                  letterSpacing: "0.01em",
                                }}>{l.nextActionDate}</span>
                              )}
                            </div>
                            {!isEditingAction && (
                              <div
                                onClick={() => startInlineAction(l)}
                                title="Click para editar"
                                style={{
                                  padding: "11px 13px", minHeight: 54,
                                  display: "flex", alignItems: "flex-start",
                                  cursor: "text",
                                  transition: "background 0.14s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.03)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                              >
                                <p style={{
                                  fontSize: 12.5, fontWeight: 500,
                                  color: isLight ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.88)",
                                  fontFamily: font, lineHeight: 1.50, margin: 0,
                                  letterSpacing: "-0.003em",
                                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                                  pointerEvents: "none",
                                }}>
                                  {l.nextAction || "Sin próxima acción registrada."}
                                </p>
                              </div>
                            )}
                            {isEditingAction && (
                              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                                <textarea
                                  value={actionDraft.a}
                                  onChange={e => setActionDraft(d => ({ ...d, a: e.target.value }))}
                                  autoFocus
                                  placeholder="Ej: Llamar mañana 10am para confirmar visita…"
                                  rows={3}
                                  style={{
                                    width: "100%", boxSizing: "border-box",
                                    padding: "8px 10px", borderRadius: 8,
                                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isLight ? meta.color + "55" : meta.color + "44"}`,
                                    color: isLight ? T.txt : "#E2E8F0",
                                    fontSize: 12.5, lineHeight: 1.45,
                                    fontFamily: font, fontWeight: 500,
                                    outline: "none", resize: "vertical", minHeight: 52,
                                  }}
                                />
                                <input
                                  value={actionDraft.d}
                                  onChange={e => setActionDraft(d => ({ ...d, d: e.target.value }))}
                                  placeholder="Fecha (Hoy 5pm, Mañana 10am…)"
                                  style={{
                                    width: "100%", boxSizing: "border-box",
                                    padding: "6px 10px", borderRadius: 7,
                                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isLight ? meta.color + "44" : meta.color + "33"}`,
                                    color: isLight ? T.txt : "#E2E8F0",
                                    fontSize: 11, fontWeight: 600,
                                    fontFamily: fontDisp, letterSpacing: "0.01em",
                                    outline: "none",
                                  }}
                                />
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  <button
                                    onClick={cancelInlineAction}
                                    style={{
                                      padding: "6px 10px", borderRadius: 7,
                                      background: "transparent",
                                      border: `1px solid ${T.border}`,
                                      color: T.txt3, fontSize: 10.5, fontWeight: 700,
                                      fontFamily: fontDisp, letterSpacing: "0.02em",
                                      cursor: "pointer", transition: "all 0.15s",
                                    }}
                                  >Cancelar</button>
                                  <button
                                    onClick={() => saveInlineAction(l)}
                                    style={{
                                      padding: "6px 12px", borderRadius: 7,
                                      background: isLight
                                        ? `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}CC 100%)`
                                        : `linear-gradient(135deg, ${meta.color}33, ${meta.color}18)`,
                                      border: `1px solid ${isLight ? "transparent" : meta.color + "55"}`,
                                      color: isLight ? "#FFFFFF" : meta.color,
                                      fontSize: 10.5, fontWeight: 800,
                                      fontFamily: fontDisp, letterSpacing: "0.02em",
                                      cursor: "pointer", transition: "all 0.15s",
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      boxShadow: isLight ? `0 2px 6px ${meta.color}44` : "none",
                                    }}
                                  ><Save size={10} strokeWidth={2.6} /> Guardar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Seguimientos — pill horizontal completo, color del meta.
                          Permite registrar recontactos sin abrir el drawer. */}
                      <div onClick={e => e.stopPropagation()}>
                        <FollowUpBadge lead={l} onUpdate={updateLead} T={T} fullWidth tint={meta.color} />
                      </div>

                      {/* CTA única — "Analizar y actuar" es la acción principal del card.
                          Perfil/Expediente se acceden con click en cualquier zona libre
                          del card (abre el drawer con tabs completos). Minimalista. */}
                      <button
                        onClick={e => { e.stopPropagation(); setAnalyzingLead(l); }}
                        style={{
                          width: "100%", padding: "12px 14px", borderRadius: 11,
                          marginTop: "auto",
                          background: isLight
                            ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
                            : "rgba(255,255,255,0.95)",
                          border: isLight ? "1px solid transparent" : "1px solid rgba(255,255,255,0.20)",
                          color: isLight ? "#FFFFFF" : "#0A3D2A",
                          fontSize: 12.5, fontWeight: 650,
                          fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.005em",
                          transition: "all 0.18s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          boxShadow: isLight
                            ? `0 4px 14px ${T.accent}48, 0 2px 6px ${T.accent}28, inset 0 1px 0 rgba(255,255,255,0.35)`
                            : "0 2px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,1)",
                        }}
                        onMouseEnter={e => {
                          if (isLight) {
                            e.currentTarget.style.boxShadow = `0 6px 20px ${T.accent}60, 0 3px 10px ${T.accent}38, inset 0 1px 0 rgba(255,255,255,0.45)`;
                            e.currentTarget.style.transform = "translateY(-1px)";
                          } else {
                            e.currentTarget.style.background = "rgba(255,255,255,1)";
                            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,1)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (isLight) {
                            e.currentTarget.style.boxShadow = `0 4px 14px ${T.accent}48, 0 2px 6px ${T.accent}28, inset 0 1px 0 rgba(255,255,255,0.35)`;
                            e.currentTarget.style.transform = "none";
                          } else {
                            e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                            e.currentTarget.style.boxShadow = "0 2px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,1)";
                            e.currentTarget.style.transform = "none";
                          }
                        }}
                      ><Zap size={12.5} strokeWidth={2.5} color={isLight ? "#FFFFFF" : "#0A3D2A"} /> Analizar y actuar</button>
                    </div>
                  </div>
                    );
                  })()}
                  {/* Insert-after indicator (last card) */}
                  {showInsertAfter && (
                    <div style={{ width: 3, borderRadius: 3, background: T.accent, boxShadow: `0 0 12px ${T.accent}80`, marginLeft: 4, alignSelf: "stretch", flexShrink: 0 }} />
                  )}
                  </div>
                );
              })}
            </div>
            </div>

            {/* ── Flechas superpuestas — ancladas al wrapper relativo ──────────────
                Se montan sobre el carrusel (position:absolute) centradas en Y.
                La flecha izquierda aparece solo cuando hay scroll previo.
                Ambas tienen glass backdrop + fade en los bordes del mask.
                ─────────────────────────────────────────────────────────────── */}
            {priorityLeads.length > 2 && (() => {
              // Botones discretos: baja opacidad en reposo, se afirman solo en hover.
              // Sin backdrop blur ni sombra pesada — deben ser utilidad, no protagonistas.
              const base = {
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 10, padding: 0,
                opacity: 0.45,
                transition: "opacity 0.18s ease, background 0.18s ease, border-color 0.18s ease",
                background: isLight ? "rgba(255,255,255,0.80)" : "rgba(12,17,28,0.70)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"}`,
                boxShadow: "none",
              };
              const onEnter = (e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.background = isLight ? "#FFFFFF" : "rgba(12,17,28,0.92)";
                e.currentTarget.style.borderColor = isLight ? `${T.accent}40` : "rgba(255,255,255,0.22)";
              };
              const onLeave = (e) => {
                e.currentTarget.style.opacity = "0.45";
                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.80)" : "rgba(12,17,28,0.70)";
                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)";
              };
              const ic = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";
              return (
                <>
                  {prioScrollX > 4 && (
                    <button onClick={() => scrollCarousel(-1)} title="Anterior"
                      style={{ ...base, left: 4 }}
                      onMouseEnter={onEnter} onMouseLeave={onLeave}
                    >
                      <ChevronLeft size={13} color={ic} strokeWidth={2} />
                    </button>
                  )}
                  <button onClick={() => scrollCarousel(1)} title="Siguiente"
                    style={{ ...base, right: 4 }}
                    onMouseEnter={onEnter} onMouseLeave={onLeave}
                  >
                    <ChevronRight size={13} color={ic} strokeWidth={2} />
                  </button>
                </>
              );
            })()}
            </div>{/* cierra wrapper relativo */}
          </div>
        );
      })()}

      {/* ── MODAL NUEVO LEAD ── */}
      {addingLead && createPortal(
        <>
          <div onClick={() => setAddingLead(false)} style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: isLight ? "rgba(15,23,42,0.22)" : "rgba(2,5,12,0.78)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            animation: "fadeIn 0.20s ease both",
          }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            zIndex: 501, width: "min(720px, 96vw)", maxHeight: "94vh",
            overflowY: "auto",
            background: isLight ? "#FFFFFF" : "#111318",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.borderH}`,
            borderRadius: 18,
            boxShadow: isLight
              ? "0 4px 12px rgba(15,23,42,0.08), 0 28px 80px rgba(15,23,42,0.12), 0 48px 120px rgba(15,23,42,0.08)"
              : "0 52px 100px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: "modalIn 0.26s cubic-bezier(0.16,1,0.3,1) both",
          }}>

            {/* ── Header compacto (icono + título + X) ── */}
            <div style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : T.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: isLight
                ? `linear-gradient(180deg, ${T.accent}08 0%, transparent 100%)`
                : "transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: isLight ? `${T.accent}14` : `${T.accent}12`,
                  border: `1px solid ${isLight ? `${T.accent}40` : T.accentB}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: isLight ? `0 2px 8px ${T.accent}18` : "none",
                }}>
                  <UserCheck size={14} color={isLight ? (T.accentDark || T.accent) : T.accent} strokeWidth={2.4} />
                </div>
                <h3 style={{
                  fontSize: 15.5, fontWeight: 700,
                  color: isLight ? T.txt : "#FFFFFF",
                  fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0,
                }}>Nuevo cliente</h3>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: T.txt3, fontFamily: font, letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}>· Completa los campos del formulario</span>
              </div>
              <button onClick={() => setAddingLead(false)} style={{
                width: 30, height: 30, borderRadius: 9,
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.border}`,
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.16s", flexShrink: 0,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : T.glass; }}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={14} color={T.txt3} /></button>
            </div>


            {/* ── Formulario denso — todo en una pantalla, 2 columnas ── */}
            {(() => {
              const inputBg       = isLight ? "rgba(255,255,255,0.85)" : T.glass;
              const inputBorder   = isLight ? "rgba(15,23,42,0.08)" : T.border;
              const chipBg        = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)";
              const accentStrong  = isLight ? (T.accentDark || T.accent) : T.accent;
              const labelStyle = {
                fontSize: 9, fontWeight: 700, color: T.txt3,
                letterSpacing: "0.06em", textTransform: "uppercase",
                fontFamily: fontDisp, display: "flex", alignItems: "center", gap: 4, marginBottom: 5,
              };
              const inputStyle = {
                width: "100%", height: 34, padding: "0 11px",
                borderRadius: 9, background: inputBg,
                border: `1px solid ${inputBorder}`, color: T.txt,
                fontSize: 12.5, outline: "none", fontFamily: font,
                boxSizing: "border-box", transition: "all 0.18s",
              };
              const focusOn = (e) => {
                e.target.style.borderColor = T.accentB;
                e.target.style.boxShadow = `0 0 0 3px ${T.accent}10`;
              };
              const focusOff = (e, borderOverride) => {
                e.target.style.borderColor = borderOverride || inputBorder;
                e.target.style.boxShadow = "none";
              };
              const parsed = parseBudget(newLead.budget);
              const hasParsed = parsed > 0 && String(newLead.budget || "").trim() !== "";
              const budgetBorder = hasParsed ? `${T.accent}55` : inputBorder;
              return (
            <div style={{ padding: "12px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>

              {/* Nombre — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  <User size={9} color={T.txt3} /> Nombre <span style={{ color: accentStrong }}>*</span>
                </label>
                <input placeholder="Ej. Rafael García López"
                  value={newLead.n || ""} onChange={e => setNewLead(p => ({...p, n: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              {/* Teléfono + Email — side by side */}
              <div>
                <label style={labelStyle}>
                  <Phone size={9} color={T.txt3} /> Teléfono
                </label>
                <input placeholder="+52 998 123 4567" value={newLead.phone || ""} onChange={e => setNewLead(p => ({...p, phone: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <Mail size={9} color={T.txt3} /> Email
                  <span style={{ color: T.txt3, fontSize: 8, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <input placeholder="correo@ejemplo.com" value={newLead.email || ""} onChange={e => setNewLead(p => ({...p, email: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              {/* Presupuesto — selector compacto con menú desplegable */}
              {(() => {
                const BUDGET_PRESETS = [
                  { label: "$100k", key: "100k" }, { label: "$150k", key: "150k" },
                  { label: "$200k", key: "200k" }, { label: "$250k", key: "250k" },
                  { label: "$300k", key: "300k" }, { label: "$400k", key: "400k" },
                  { label: "$500k", key: "500k" }, { label: "$600k", key: "600k" },
                  { label: "$750k", key: "750k" }, { label: "$1M",   key: "1M"   },
                  { label: "$1.5M", key: "1.5M" }, { label: "$2M+",  key: "2M"   },
                ];
                const activePreset = BUDGET_PRESETS.find(o => o.key === newLead.budget);
                const displayVal = activePreset ? activePreset.label : (newLead.budget || "");
                const hasValue = !!displayVal;
                return (
                  <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                    <label style={{ ...labelStyle, justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <DollarSign size={9} color={T.txt3} /> Presupuesto
                      </span>
                      {hasParsed && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: accentStrong, fontFamily: fontDisp, letterSpacing: "-0.005em", textTransform: "none" }}>
                          = {formatBudget(parsed)}
                        </span>
                      )}
                    </label>

                    {/* Trigger button — muestra valor seleccionado o placeholder */}
                    <button
                      type="button"
                      onClick={() => setBudgetMenuOpen(v => !v)}
                      style={{
                        width: "100%", padding: "10px 13px",
                        borderRadius: 10,
                        background: hasValue
                          ? (isLight ? `${T.accent}0C` : `${T.accent}0A`)
                          : inputBg,
                        border: `1px solid ${hasValue
                          ? (isLight ? `${T.accent}3A` : T.accentB)
                          : inputBorder}`,
                        color: hasValue ? accentStrong : T.txt3,
                        fontSize: 13, fontWeight: hasValue ? 700 : 400,
                        fontFamily: fontDisp,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.16s",
                        letterSpacing: "-0.01em",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                    >
                      <span>{hasValue ? displayVal : "Seleccionar presupuesto…"}</span>
                      <ChevronDown size={14} color={hasValue ? accentStrong : T.txt3} strokeWidth={2} style={{ flexShrink: 0, transition: "transform 0.18s", transform: budgetMenuOpen ? "rotate(180deg)" : "none" }} />
                    </button>

                    {/* Dropdown — grid de presets + custom input */}
                    {budgetMenuOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                        zIndex: 80,
                        background: isLight ? "#FFFFFF" : "#0D1119",
                        border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 12,
                        boxShadow: isLight
                          ? "0 8px 28px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.07)"
                          : "0 8px 32px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35)",
                        padding: "12px",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        {/* Grid 4×3 */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                          {BUDGET_PRESETS.map(opt => {
                            const active = newLead.budget === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => { setNewLead(p => ({...p, budget: opt.key})); setBudgetMenuOpen(false); }}
                                style={{
                                  padding: "7px 0", borderRadius: 8, textAlign: "center",
                                  background: active ? (isLight ? `${T.accent}1A` : `${T.accent}18`) : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"),
                                  border: `1px solid ${active ? (isLight ? `${T.accent}44` : T.accentB) : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)")}`,
                                  color: active ? accentStrong : T.txt2,
                                  fontSize: 12, fontWeight: active ? 700 : 500,
                                  fontFamily: fontDisp, cursor: "pointer",
                                  transition: "all 0.12s", letterSpacing: "-0.01em",
                                }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${T.accent}0D` : `${T.accent}10`; e.currentTarget.style.borderColor = isLight ? `${T.accent}3A` : T.accentB; e.currentTarget.style.color = isLight ? accentStrong : T.accent; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"; e.currentTarget.style.color = T.txt2; } }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        {/* Divider + custom input */}
                        <div style={{ borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`, paddingTop: 8 }}>
                          <input
                            placeholder="O escribe un monto: 350k · 1.2M · 2 mdd"
                            value={activePreset ? "" : (newLead.budget || "")}
                            onChange={e => setNewLead(p => ({...p, budget: e.target.value}))}
                            style={{ ...inputStyle, fontSize: 12 }}
                            onFocus={focusOn}
                            onBlur={e => focusOff(e)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Proyecto */}
              <div>
                <label style={labelStyle}>
                  <Building2 size={9} color={T.txt3} /> Proyecto
                </label>
                <ClickDropdown
                  value={newLead.p || ""}
                  onChange={(v) => setNewLead(p => ({...p, p: v}))}
                  options={proyectosMaster}
                  placeholder="Seleccionar proyecto…"
                  label="proyecto"
                  icon={Building2}
                  createLabel="Nuevo proyecto"
                  T={T} isLight={isLight}
                />
              </div>

              {/* Campaña */}
              <div>
                <label style={labelStyle}>
                  <Signal size={9} color={T.txt3} /> Campaña FB
                </label>
                <ClickDropdown
                  value={newLead.campana || ""}
                  onChange={(v) => setNewLead(p => ({...p, campana: v}))}
                  options={campanasMaster}
                  placeholder="Seleccionar campaña…"
                  label="campaña"
                  icon={Signal}
                  createLabel="Nueva campaña"
                  T={T} isLight={isLight}
                />
              </div>

              {/* Asesor — solo admins */}
              {canSeeAll && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>
                    <Users size={9} color={T.txt3} /> Asesor asignado
                  </label>
                  <ClickDropdown
                    value={newLead.asesor || ""}
                    onChange={(v) => setNewLead(p => ({...p, asesor: v}))}
                    options={asesoresMaster}
                    placeholder="Seleccionar asesor…"
                    label="asesor"
                    icon={Users}
                    createLabel="Nuevo asesor"
                    T={T} isLight={isLight}
                  />
                </div>
              )}

              {/* Etapa — selector compacto con menú desplegable */}
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <label style={labelStyle}>
                  <Waypoints size={9} color={T.txt3} /> Etapa inicial
                </label>
                {/* Trigger button */}
                {(() => {
                  const stageVal = newLead.st || "Nuevo Registro";
                  const stageCol = stgC[stageVal] || T.accent;
                  const stageTitleC = isLight ? `color-mix(in srgb, ${stageCol} 55%, #0B1220 45%)` : stageCol;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setStageMenuOpen(v => !v)}
                        style={{
                          width: "100%", padding: "10px 13px", borderRadius: 10,
                          background: isLight ? `${stageCol}0E` : `${stageCol}0C`,
                          border: `1px solid ${isLight ? `${stageCol}38` : `${stageCol}44`}`,
                          color: stageTitleC,
                          fontSize: 13, fontWeight: 600, fontFamily: font,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          transition: "all 0.16s",
                          boxSizing: "border-box",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: stageCol, flexShrink: 0 }} />
                          {stageVal}
                        </span>
                        <ChevronDown size={14} color={stageTitleC} strokeWidth={2} style={{ flexShrink: 0, transition: "transform 0.18s", transform: stageMenuOpen ? "rotate(180deg)" : "none" }} />
                      </button>

                      {stageMenuOpen && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                          zIndex: 80,
                          background: isLight ? "#FFFFFF" : "#0D1119",
                          border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 12,
                          boxShadow: isLight
                            ? "0 8px 28px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.07)"
                            : "0 8px 32px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35)",
                          padding: "6px",
                          display: "flex", flexDirection: "column", gap: 2,
                          maxHeight: 280, overflowY: "auto",
                        }}>
                          {STAGES.map(s => {
                            const c = stgC[s] || T.txt3;
                            const active = newLead.st === s;
                            const cTitle = isLight ? `color-mix(in srgb, ${c} 55%, #0B1220 45%)` : c;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setNewLead(p => ({...p, st: s})); setStageMenuOpen(false); }}
                                style={{
                                  padding: "9px 12px", borderRadius: 8, textAlign: "left",
                                  background: active ? (isLight ? `${c}14` : `${c}10`) : "transparent",
                                  border: "none",
                                  color: active ? cTitle : T.txt2,
                                  fontSize: 12.5, fontWeight: active ? 700 : 400,
                                  fontFamily: font, cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 9,
                                  transition: "background 0.1s",
                                  width: "100%",
                                }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${c}0A` : `${c}0C`; e.currentTarget.style.color = isLight ? cTitle : c; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt2; } }}
                              >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                                {s}
                                {active && <CheckCircle2 size={12} color={cTitle} strokeWidth={2.5} style={{ marginLeft: "auto" }} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Próxima acción + Notas — lado a lado, compactos */}
              <div>
                <label style={labelStyle}>
                  <Zap size={9} color={accentStrong} /> Próxima acción
                  <span style={{ color: T.txt3, fontSize: 8.5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <textarea
                  placeholder="¿Qué hace el asesor mañana? Ej. Llamar 10am, mandar Torre 25…"
                  value={newLead.nextAction || ""}
                  onChange={e => setNewLead(p => ({...p, nextAction: e.target.value}))}
                  rows={2}
                  style={{ width: "100%", padding: "8px 11px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 9, color: T.txt, fontSize: 12, fontWeight: 500, outline: "none", fontFamily: font, boxSizing: "border-box", lineHeight: 1.45, resize: "none", display: "block", minHeight: 52, maxHeight: 72, overflowY: "auto", transition: "all 0.18s" }}
                  onFocus={focusOn}
                  onBlur={e => focusOff(e)}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  <FileText size={9} color={T.txt3} /> Notas
                  <span style={{ color: T.txt3, fontSize: 8.5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <textarea
                  placeholder="Preferencias, contexto, insights…"
                  value={newLead.notas || ""}
                  onChange={e => setNewLead(p => ({...p, notas: e.target.value}))}
                  rows={2}
                  style={{ width: "100%", padding: "8px 11px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 9, color: T.txt, fontSize: 12, fontWeight: 500, outline: "none", fontFamily: font, boxSizing: "border-box", lineHeight: 1.45, resize: "none", display: "block", minHeight: 52, maxHeight: 72, overflowY: "auto", transition: "all 0.18s" }}
                  onFocus={focusOn}
                  onBlur={e => focusOff(e)}
                />
              </div>
            </div>
            );
            })()}

            {/* ── Footer ── */}
            {(() => {
              const accentStrong = isLight ? (T.accentDark || T.accent) : T.accent;
              const canSubmit = newLead.n.trim();
              const primaryBg = canSubmit
                ? (isLight
                    ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
                    : `linear-gradient(135deg, ${T.accent}38, ${T.accent}14)`)
                : (isLight ? "rgba(15,23,42,0.06)" : T.glass);
              const primaryColor = canSubmit
                ? (isLight ? "#FFFFFF" : T.accent)
                : T.txt3;
              const primaryBorder = canSubmit
                ? (isLight ? "transparent" : T.accentB)
                : (isLight ? "rgba(15,23,42,0.08)" : T.border);
              const primaryShadow = canSubmit && isLight
                ? `0 4px 14px ${T.accent}48, 0 2px 6px ${T.accent}28, inset 0 1px 0 rgba(255,255,255,0.35)`
                : canSubmit
                  ? `0 0 24px ${T.accent}18`
                  : "none";
              return (
            <div style={{ padding: "14px 18px 16px", display: "flex", gap: 8 }}>
              <button onClick={() => setAddingLead(false)} style={{
                flex: 1, height: 38, borderRadius: 10,
                background: "transparent",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.border}`,
                color: T.txt3, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer", fontFamily: font, transition: "all 0.18s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : T.glass; e.currentTarget.style.color = T.txt2; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; }}
              >Cancelar</button>
              <button onClick={addNewLead} disabled={!canSubmit} style={{
                flex: 2.4, height: 38, borderRadius: 10,
                background: primaryBg,
                border: `1px solid ${primaryBorder}`,
                color: primaryColor,
                fontSize: 12.5, fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: fontDisp, letterSpacing: "0.01em",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                boxShadow: primaryShadow,
              }}
                onMouseEnter={e => {
                  if (!canSubmit) return;
                  if (isLight) {
                    e.currentTarget.style.boxShadow = `0 6px 20px ${T.accent}60, 0 3px 10px ${T.accent}38, inset 0 1px 0 rgba(255,255,255,0.45)`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  } else {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${T.accent}50, ${T.accent}20)`;
                    e.currentTarget.style.boxShadow = `0 6px 28px ${T.accent}2C`;
                  }
                }}
                onMouseLeave={e => {
                  if (!canSubmit) return;
                  if (isLight) {
                    e.currentTarget.style.boxShadow = primaryShadow;
                    e.currentTarget.style.transform = "none";
                  } else {
                    e.currentTarget.style.background = primaryBg;
                    e.currentTarget.style.boxShadow = primaryShadow;
                  }
                }}
              >
                <UserCheck size={13} strokeWidth={2.4} />
                Registrar cliente
              </button>
            </div>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* ── PIPELINE STAGE STRIP ── */}
      <div style={{
        display: "flex", gap: 0, borderRadius: 12, overflow: "hidden",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
        background: isLight ? "#FFFFFF" : "rgba(11,16,26,0.72)",
        backdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
        WebkitBackdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
        boxShadow: isLight
          ? "0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 2px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {STAGES.slice(0,-1).map((stage, idx) => {
          const cnt = visibleLeads.filter(l => l.st === stage).length;
          const c = stgC[stage] || T.txt3;
          const isActive = filterStage === stage;
          const hasCount = cnt > 0;
          const divider = idx < STAGES.length - 2;
          return (
            <div key={stage} onClick={() => setFilterStage(isActive ? "TODO" : stage)}
              title={`${stage} · ${cnt} cliente${cnt !== 1 ? "s" : ""}`}
              style={{
                flex: 1, padding: "10px 4px 9px", cursor: "pointer",
                borderRight: divider ? `1px solid ${isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.04)"}` : "none",
                background: isActive
                  ? (isLight ? `${c}10` : `${c}12`)
                  : "transparent",
                transition: "background 0.18s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                position: "relative",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isLight ? `${c}08` : "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Top accent line */}
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%", height: 2, borderRadius: "0 0 2px 2px",
                background: isActive ? c : (hasCount ? `${c}55` : "transparent"),
                transition: "background 0.18s, box-shadow 0.18s",
                boxShadow: isActive ? `0 0 6px ${c}80` : "none",
              }} />
              {/* Count */}
              <span style={{
                fontSize: 19, fontWeight: 800, lineHeight: 1,
                color: isActive ? c
                  : hasCount
                    ? (isLight ? T.txt : "rgba(255,255,255,0.88)")
                    : (isLight ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.22)"),
                fontFamily: fontDisp, letterSpacing: "-0.03em",
                transition: "color 0.18s",
              }}>{cnt}</span>
              {/* Stage label */}
              <span style={{
                fontSize: 8,
                color: isActive ? c
                  : hasCount
                    ? (isLight ? T.txt3 : "rgba(255,255,255,0.42)")
                    : (isLight ? "rgba(15,23,42,0.28)" : "rgba(255,255,255,0.22)"),
                fontWeight: isActive ? 800 : 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                textAlign: "center", lineHeight: 1.25,
                maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: fontDisp, transition: "color 0.18s",
              }}>{stage}</span>
            </div>
          );
        })}
      </div>

      {/* ── MAIN TABLE / KANBAN ── */}
      <G T={T} np>
        {/* ── Toolbar — refined ── */}
        <div style={{
          padding: "11px 18px",
          borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.055)"}`,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>

          {/* View toggle */}
          <div style={{
            display: "flex", borderRadius: 9, overflow: "hidden", flexShrink: 0,
            background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
          }}>
            {[["list","Lista"],["kanban","Kanban"]].map(([m, lbl]) => {
              const isActive = viewMode === m;
              return (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: "5px 13px", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: fontDisp,
                  letterSpacing: "0.01em",
                  background: isActive
                    ? (isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)")
                    : "transparent",
                  color: isActive
                    ? (isLight ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.88)")
                    : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)"),
                  borderRight: m === "list" ? `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)"}` : "none",
                  transition: "all 0.16s",
                  boxShadow: isActive && !isLight ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
                }}>{lbl}</button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 140, maxWidth: 240 }}>
            <Search size={11} color={isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.28)"} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar cliente, asesor, proyecto…"
              style={{
                width: "100%", paddingLeft: 29, paddingRight: searchQ ? 28 : 11,
                height: 32, borderRadius: 9,
                background: isLight ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.042)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)"}`,
                fontSize: 11.5, color: isLight ? T.txt : "rgba(255,255,255,0.80)",
                outline: "none", fontFamily: fontDisp, boxSizing: "border-box", transition: "border-color 0.18s",
              }}
              onFocus={e => { e.target.style.borderColor = isLight ? T.accent : "rgba(255,255,255,0.22)"; }}
              onBlur={e => { e.target.style.borderColor = isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)"; }}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: isLight ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.30)", display: "flex", padding: 0 }}><X size={10} /></button>}
          </div>

          {/* Stage filter — custom wrapper */}
          {(() => {
            const active = filterStage !== "TODO";
            const selBg  = isLight ? (active ? `${stgC[filterStage]}10` : "rgba(255,255,255,0.70)") : (active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.042)");
            const selBdr = isLight ? (active ? `${stgC[filterStage]}40` : "rgba(15,23,42,0.09)") : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
            const selClr = isLight ? (active ? stgC[filterStage] : "rgba(15,23,42,0.45)") : (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)");
            return (
              <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{
                  height: 32, padding: "0 30px 0 12px",
                  borderRadius: 9, appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                  background: selBg, border: `1px solid ${selBdr}`,
                  fontSize: 11, color: selClr, cursor: "pointer", outline: "none",
                  fontFamily: fontDisp, fontWeight: active ? 600 : 400, transition: "all 0.18s",
                }}>
                  <option value="TODO">Todas las etapas</option>
                  {STAGES.map(s => <option key={s} value={s} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>{s}</option>)}
                </select>
                <ChevronDown size={10} color={selClr} strokeWidth={2.2} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }} />
              </div>
            );
          })()}

          {/* Asesor filter */}
          {canSeeAll && (() => {
            const active = filterAsesor !== "TODO";
            const selBg  = isLight ? (active ? `${T.accent}10` : "rgba(255,255,255,0.70)") : (active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.042)");
            const selBdr = isLight ? (active ? `${T.accent}40` : "rgba(15,23,42,0.09)") : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
            const selClr = isLight ? (active ? T.accent : "rgba(15,23,42,0.45)") : (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)");
            return (
              <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <select value={filterAsesor} onChange={e => setFilterAsesor(e.target.value)} style={{
                  height: 32, padding: "0 30px 0 12px",
                  borderRadius: 9, appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                  background: selBg, border: `1px solid ${selBdr}`,
                  fontSize: 11, color: selClr, cursor: "pointer", outline: "none",
                  fontFamily: fontDisp, fontWeight: active ? 600 : 400, transition: "all 0.18s",
                }}>
                  <option value="TODO">Todos los asesores</option>
                  {asesores.map(a => <option key={a} value={a} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>{a.split(" ")[0]} {a.split(" ")[1] || ""}</option>)}
                </select>
                <ChevronDown size={10} color={selClr} strokeWidth={2.2} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }} />
              </div>
            );
          })()}

          {/* Clear filters */}
          {(filterStage !== "TODO" || filterAsesor !== "TODO" || searchQ) && (
            <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }}
              style={{
                height: 32, padding: "0 11px", borderRadius: 9,
                background: "transparent",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.09)"}`,
                color: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
                fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: fontDisp,
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5, transition: "all 0.16s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.18)"; e.currentTarget.style.color = isLight ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.60)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.09)"; e.currentTarget.style.color = isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)"; }}
            ><X size={10} strokeWidth={2} /> Limpiar</button>
          )}

          <div style={{ flex: 1 }} />

          {/* Count badge */}
          <span style={{
            fontSize: 10.5, fontWeight: 600, fontFamily: fontDisp, letterSpacing: "0.02em",
            color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)",
            background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)"}`,
            padding: "4px 12px", borderRadius: 99, flexShrink: 0,
          }}>
            {sortedLeads.length} resultado{sortedLeads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── LIST VIEW — Redesigned ── */}
        {viewMode === "list" && (
          <>
            {/* Column headers — 5 columnas full / 4 compact. "Cliente" abarca
                identidad y presupuesto juntos; Seguim. es el stepper editable. */}
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", background: isLight ? "rgba(15,23,42,0.015)" : "rgba(255,255,255,0.012)" }}>
              <SH label="Cliente" field="n" />
              <SH label="Etapa" field="st" />
              <SH label="Seguim." field="seguimientos" />
              {!co && <SH label="Score" field="sc" align="right" />}
              <span style={{ fontSize: 9.5, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>Acciones</span>
            </div>

            {sortedLeads.map((l, rowIdx) => {
              const isHov = hoveredRow === l.id;
              const sc = l.sc;
              const scoreColor = T.accent;
              const showUrgency = l.daysInactive >= 5;
              const uc = urgColor(l.daysInactive);
              const stageC = stgC[l.st] || T.txt3;

              return (
                <div key={l.id}
                  onMouseEnter={() => setHoveredRow(l.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: "grid", gridTemplateColumns: cols, gap: 12, padding: "14px 20px",
                    borderBottom: `1px solid ${T.border}`, alignItems: "center",
                    transition: "background 0.14s",
                    background: isHov ? (isLight ? "rgba(15,23,42,0.022)" : "rgba(255,255,255,0.028)") : "transparent",
                    position: "relative",
                  }}
                >

                  {/* ═══ CLIENTE ═══ Avatar + identidad. Primera línea tiene
                       nombre, tags y presupuesto (right-aligned con spacer flex).
                       Segunda línea: asesor · proyecto · fecha · campaña. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {/* Avatar — rounded square, initial, accent tint */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 11,
                      background: isLight
                        ? `linear-gradient(145deg, ${T.violet}1A 0%, ${T.violet}0D 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
                      border: `1px solid ${isLight ? `${T.violet}38` : "rgba(255,255,255,0.10)"}`,
                      boxShadow: isLight
                        ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px ${T.violet}14`
                        : `inset 0 1px 0 rgba(255,255,255,0.07)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 800,
                      color: isLight ? `color-mix(in srgb, ${T.violet} 62%, #0B1220 38%)` : "rgba(255,255,255,0.72)",
                      flexShrink: 0, fontFamily: fontDisp, letterSpacing: "-0.01em",
                    }}>{l.n.charAt(0)}</div>

                    {/* Identity block — fills remaining width */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Row 1: name · tags · [spacer] · budget */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.018em",
                          color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          flexShrink: 1,
                        }}>{l.n}</span>

                        {l.isNew && (
                          <span style={{
                            fontSize: 7, fontWeight: 800, letterSpacing: "0.09em",
                            color: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
                            background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)"}`,
                            padding: "1.5px 5px", borderRadius: 99, flexShrink: 0,
                          }}>NUEVO</span>
                        )}
                        {l.hot && (
                          <span style={{
                            fontSize: 7, fontWeight: 800, letterSpacing: "0.09em",
                            color: isLight ? `color-mix(in srgb, ${T.accent} 62%, #0B1220 38%)` : T.accent,
                            background: `${T.accent}${isLight ? "18" : "0E"}`,
                            border: `1px solid ${T.accentB}`,
                            padding: "1.5px 5px", borderRadius: 99, flexShrink: 0,
                          }}>HOT</span>
                        )}

                        {/* flex spacer — pushes budget to right edge */}
                        <div style={{ flex: 1, minWidth: 6 }} />

                        {l.budget && (
                          <span style={{
                            fontSize: 13, fontWeight: 800, letterSpacing: "-0.022em",
                            color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp,
                            whiteSpace: "nowrap", flexShrink: 0,
                          }}>{l.budget}</span>
                        )}
                      </div>

                      {/* Row 2: asesor · proyecto · fecha · campaña */}
                      <p style={{
                        fontSize: 10.5, color: T.txt3, fontFamily: font, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        lineHeight: 1.3,
                      }}>
                        {[
                          l.asesor?.split(" ")[0],
                          (l.p || "").split("·")[0].trim() || null,
                          (!co && l.fechaIngreso) ? l.fechaIngreso : null,
                          l.campana || null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* ═══ ETAPA ═══ Pill con LED y cambio inline por select */}
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    <div style={{
                      position: "relative", display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "5px 20px 5px 11px", borderRadius: 99,
                      background: isLight
                        ? `linear-gradient(135deg, ${stageC}3D 0%, ${stageC}1F 55%, ${stageC}12 100%)`
                        : `linear-gradient(135deg, ${stageC}26 0%, ${stageC}10 100%)`,
                      border: `1px solid ${isLight ? stageC + "85" : stageC + "44"}`,
                      boxShadow: isLight
                        ? `0 2px 8px ${stageC}2E, 0 1px 2px ${stageC}1A, inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 ${stageC}14`
                        : `0 1px 4px ${stageC}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
                      transition: "all 0.2s ease",
                      maxWidth: "100%", overflow: "hidden",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = isLight ? `0 4px 14px ${stageC}3A, 0 2px 4px ${stageC}22, inset 0 1px 0 rgba(255,255,255,0.8)` : `0 3px 10px ${stageC}26, inset 0 1px 0 rgba(255,255,255,0.15)`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = isLight ? `0 2px 8px ${stageC}2E, 0 1px 2px ${stageC}1A, inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 ${stageC}14` : `0 1px 4px ${stageC}18, inset 0 1px 0 rgba(255,255,255,0.12)`; }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: `radial-gradient(circle at 30% 30%, #FFFFFFB3 0%, ${stageC} 45%, ${stageC} 100%)`,
                        boxShadow: `0 0 0 2px ${stageC}2E, 0 0 6px ${stageC}70`,
                        flexShrink: 0,
                      }} />
                      <select value={l.st} onChange={e => { const v = e.target.value; setLeadsData(prev => prev.map(x => x.id === l.id ? {...x, st: v} : x)); }}
                        style={{
                          background: "transparent", border: "none", padding: 0,
                          fontSize: 10.5, fontWeight: 800,
                          color: isLight ? `color-mix(in srgb, ${stageC} 55%, #0B1220 45%)` : stageC,
                          cursor: "pointer", outline: "none", appearance: "none",
                          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                          fontFamily: font, letterSpacing: "0.015em",
                          textShadow: isLight ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
                        }}>
                        {STAGES.map(s => <option key={s} value={s} style={{ background: "#111318", color: "#fff", fontWeight: 600 }}>{s}</option>)}
                      </select>
                      {/* Indicador sutil de selector — dos puntos verticales */}
                      <div style={{
                        position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                        display: "flex", flexDirection: "column", gap: 2.5,
                        pointerEvents: "none", opacity: 0.5,
                      }}>
                        <div style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: isLight ? `color-mix(in srgb, ${stageC} 55%, #0B1220 45%)` : stageC }} />
                        <div style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: isLight ? `color-mix(in srgb, ${stageC} 55%, #0B1220 45%)` : stageC }} />
                      </div>
                    </div>
                  </div>

                  {/* ═══ SEGUIMIENTOS ═══ Stepper con −/número editable/+ —
                       el asesor registra recontactos directo, o escribe el total */}
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                    <FollowUpBadge lead={l} onUpdate={updateLead} T={T} compact />
                  </div>

                  {/* ═══ SCORE ═══ Solo visible en modo full — bar + número */}
                  {!co && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)", maxWidth: 40 }}>
                        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: T.accent, transition: "width 0.4s", boxShadow: sc >= 80 ? `0 0 6px ${T.accent}60` : "none" }} />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: isLight ? T.txt2 : T.txt2, fontFamily: fontDisp, minWidth: 22, textAlign: "right" }}>{sc}</span>
                    </div>
                  )}

                  {/* Acciones — 3 controles: ★ prioridad (icono solo), ⚛ IA (icono solo),
                     y "Ver perfil" (CTA con label). Aesthetic pro, minimalista, cada uno con su color. */}
                  {(() => {
                    const isPinned = pinnedIds.has(l.id);
                    const isAuto   = isAutoPriority(l);
                    const inPriority = isPinned || isAuto;

                    // Utility: devuelve un color seguro para tema claro (oscurece hacia slate)
                    const safeC = (c) => isLight ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;

                    // Estrella en dorado auténtico (más pro y cálido que ámbar puro)
                    const goldC = isLight ? "#B8860B" : "#F5C542";
                    const goldBorder = isPinned ? (isLight ? "#B8860B" : "#F5C542") : (isLight ? "#D4A84433" : "#F5C54238");
                    const goldBg     = isPinned ? (isLight ? "#F5C54228" : "#F5C54222") : (isLight ? "#F5C54212" : "#F5C5420E");
                    const blueC = safeC(T.blue);

                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        {/* ★ Prioridad — dorado, icono solamente */}
                        <button onClick={() => togglePin(l.id)}
                          title={inPriority ? "Quitar de prioridad" : "Marcar como prioridad"}
                          aria-label={inPriority ? "Quitar de prioridad" : "Marcar como prioridad"}
                          style={{
                            width: 34, height: 34, borderRadius: 9,
                            border: `1px solid ${goldBorder}`,
                            background: goldBg,
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.16s ease",
                            boxShadow: isPinned
                              ? (isLight
                                  ? `0 1px 2px rgba(184,134,11,0.28), inset 0 1px 0 rgba(255,255,255,0.6)`
                                  : `0 0 12px rgba(245,197,66,0.22)`)
                              : "none",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = isLight ? "#F5C5423A" : "#F5C54230";
                            e.currentTarget.style.borderColor = isLight ? "#B8860B" : "#F5C54266";
                            e.currentTarget.style.transform   = "translateY(-1px)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = goldBg;
                            e.currentTarget.style.borderColor = goldBorder;
                            e.currentTarget.style.transform   = "none";
                          }}
                        >
                          <Star size={14} color={goldC} fill={isPinned ? goldC : "none"} strokeWidth={2.2} />
                        </button>

                        {/* ⚛ IA — abre el panel "Analizar y actuar" del Agente con
                            contexto completo del lead (mismo flujo que AURA, sin ir al chat).
                            Siempre resaltado en mint: es el CTA suave del módulo. */}
                        <button onClick={() => openDrawerTab("analisis", l)}
                          title="Analizar y actuar con el Agente IA"
                          aria-label="Analizar y actuar con el Agente IA"
                          style={{
                            width: 34, height: 34, borderRadius: 9,
                            border: `1px solid ${T.accentB}`,
                            background: `${T.accent}${isLight ? "18" : "12"}`,
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.16s ease",
                            boxShadow: isLight ? `0 1px 2px ${T.accent}1A, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = `${T.accent}${isLight ? "28" : "22"}`;
                            e.currentTarget.style.borderColor = `${T.accent}${isLight ? "88" : "66"}`;
                            e.currentTarget.style.transform   = "translateY(-1px)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = `${T.accent}${isLight ? "18" : "12"}`;
                            e.currentTarget.style.borderColor = T.accentB;
                            e.currentTarget.style.transform   = "none";
                          }}
                        >
                          <Atom size={14} color={isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent} strokeWidth={2.2} />
                        </button>

                        {/* 👤 Perfil — abre el drawer completo del cliente */}
                        <button onClick={() => setSelectedLead(l)}
                          title="Abrir perfil del cliente"
                          aria-label="Abrir perfil del cliente"
                          style={{
                            width: 34, height: 34, borderRadius: 9,
                            border: `1px solid ${T.blue}${isLight ? "3A" : "38"}`,
                            background: `${T.blue}${isLight ? "14" : "14"}`,
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.16s ease",
                            boxShadow: isLight ? `0 1px 2px ${T.blue}1A, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = `${T.blue}${isLight ? "24" : "26"}`;
                            e.currentTarget.style.borderColor = `${T.blue}${isLight ? "66" : "5C"}`;
                            e.currentTarget.style.transform   = "translateY(-1px)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = `${T.blue}${isLight ? "14" : "14"}`;
                            e.currentTarget.style.borderColor = `${T.blue}${isLight ? "3A" : "38"}`;
                            e.currentTarget.style.transform   = "none";
                          }}
                        >
                          <User size={14} color={blueC} strokeWidth={2.2} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {/* Empty state */}
            {sortedLeads.length === 0 && (
              <div style={{ padding: "64px 32px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: T.glass, border: `1px solid ${T.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Search size={22} color={T.txt3} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Sin resultados</p>
                <p style={{ fontSize: 12, color: T.txt3, marginBottom: 20 }}>Intenta con otro término, etapa o asesor</p>
                <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ padding: "8px 20px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2, fontSize: 12, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}
                >Limpiar todos los filtros</button>
              </div>
            )}
          </>
        )}

        {/* ── KANBAN — drag & drop ── */}
        {viewMode === "kanban" && (() => {
          // Cada columna: 244px + 10px gap = 254px. Avance de 2 columnas = 508px
          const COL_W = 254;
          const STEP  = COL_W * 2;
          const maxScroll = () => kanbanRef.current
            ? kanbanRef.current.scrollWidth - kanbanRef.current.clientWidth
            : 0;
          const canLeft  = kanbanScrollPos > 0;
          const canRight = kanbanScrollPos < maxScroll() - 4;

          const scrollTo = (dir) => {
            if (!kanbanRef.current) return;
            const next = Math.max(0, Math.min(
              kanbanRef.current.scrollLeft + dir * STEP,
              maxScroll()
            ));
            kanbanRef.current.scrollTo({ left: next, behavior: "smooth" });
          };

          const navBtnBase = {
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            zIndex: 20,
            width: 40, height: 40, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: `1px solid ${T.accentB}`,
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: fontDisp,
          };

          return (
            <div style={{ position: "relative" }}>
              {/* ← botón izquierda */}
              {canLeft && (
                <button
                  onClick={() => scrollTo(-1)}
                  style={{
                    ...navBtnBase,
                    left: 8,
                    background: T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)",
                    boxShadow: T === P
                      ? `0 4px 18px rgba(0,0,0,0.50), 0 0 0 1px ${T.accentB}, 0 0 16px ${T.accent}18`
                      : `0 4px 14px rgba(15,23,42,0.18), 0 0 0 1px ${T.accentB}`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
              )}

              {/* → botón derecha */}
              {canRight && (
                <button
                  onClick={() => scrollTo(1)}
                  style={{
                    ...navBtnBase,
                    right: 8,
                    background: T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)",
                    boxShadow: T === P
                      ? `0 4px 18px rgba(0,0,0,0.50), 0 0 0 1px ${T.accentB}, 0 0 16px ${T.accent}18`
                      : `0 4px 14px rgba(15,23,42,0.18), 0 0 0 1px ${T.accentB}`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              )}

          <div
            ref={kanbanRef}
            onScroll={e => setKanbanScrollPos(e.currentTarget.scrollLeft)}
            onWheel={e => { if (e.deltaX === 0 && e.deltaY !== 0) { e.currentTarget.scrollLeft += e.deltaY; } }}
            style={{ display: "flex", gap: 10, overflowX: "auto", padding: "16px", minHeight: 480, alignItems: "flex-start", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {kanbanStages.map(stage => {
              const stLeads = sortedLeads.filter(l => l.st === stage);
              const stVal = stLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              const c = stgC[stage] || T.txt3;
              const isDragTarget = dragOverStage === stage;
              // Color de texto legible en blanco: mezcla hacia el slate profundo
              const cText = isLight ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;
              // Alphas más fuertes en light para compensar el fondo blanco
              const headerBg = isLight
                ? (isDragTarget
                    ? `linear-gradient(135deg, ${c}32 0%, ${c}1A 100%)`
                    : `linear-gradient(135deg, ${c}22 0%, ${c}10 100%)`)
                : (isDragTarget ? `${c}18` : `${c}0C`);
              const headerBorder = isLight
                ? (isDragTarget ? `${c}78` : `${c}52`)
                : (isDragTarget ? `${c}50` : `${c}28`);
              const countBg = isLight
                ? `linear-gradient(135deg, ${c}38 0%, ${c}1C 100%)`
                : `${c}18`;
              const countBorder = isLight ? `${c}62` : `${c}28`;
              return (
                <div key={stage}
                  onDragOver={e => handleDragOver(e, stage)}
                  onDrop={e => handleDrop(e, stage)}
                  style={{ minWidth: 244, flex: "0 0 244px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "10px 13px 10px 11px", borderRadius: 11, background: headerBg, border: `1px solid ${headerBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, transition: "all 0.15s", boxShadow: isLight ? `0 1px 3px ${c}1E, inset 0 1px 0 rgba(255,255,255,0.65)` : "none", backdropFilter: isLight ? "blur(20px) saturate(160%)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: `0 0 0 2px ${c}2E${isLight ? ", 0 1px 3px " + c + "55" : ""}` }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 800, color: cText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>{stage}</p>
                        {stLeads.length > 0 && <p style={{ fontSize: 9.5, color: T.txt3, fontWeight: 600 }}>${(stVal/1000000).toFixed(1)}M</p>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: cText, background: countBg, border: `1px solid ${countBorder}`, padding: "2px 9px", borderRadius: 99, flexShrink: 0, fontFamily: fontDisp, boxShadow: isLight ? `inset 0 1px 0 rgba(255,255,255,0.5)` : "none" }}>{stLeads.length}</span>
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
                          style={{ borderRadius: 13, background: "rgba(255,255,255,0.032)", border: `1px solid ${T.border}`, overflow: "hidden", transition: "all 0.2s", cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
                          onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.background = "rgba(255,255,255,0.052)"; e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.032)"; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ height: 2, background: `linear-gradient(90deg, ${c}AA, transparent)` }} />
                          <div style={{ padding: "12px 13px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 7, gap: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{l.n}</p>
                                <p style={{ fontSize: 9.5, color: T.txt3 }}>{l.asesor?.split(" ")[0]} · {l.campana}</p>
                              </div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, letterSpacing: "-0.02em", flexShrink: 0 }}>{l.budget}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                                <div style={{ width: `${sc}%`, height: "100%", borderRadius: 2, background: T.accent,
                                  opacity: sc >= 80 ? 1 : sc >= 60 ? 0.85 : 0.65,
                                  boxShadow: sc >= 80 ? `0 0 6px ${T.accent}50` : "none" }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: fontDisp, minWidth: 18, color: T.accent }}>{sc}</span>
                            </div>
                            {l.daysInactive >= 7 && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: isLight ? "#B91C1C" : "#FF6B6B", background: isLight ? "linear-gradient(135deg, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.08) 100%)" : "rgba(255,107,107,0.10)", border: isLight ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,107,107,0.22)", borderRadius: 6, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, marginBottom: 7, boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                ⚠ {l.daysInactive}d sin actividad
                              </div>
                            )}
                            {l.daysInactive >= 3 && l.daysInactive < 7 && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber, background: isLight ? `linear-gradient(135deg, ${T.amber}2E 0%, ${T.amber}14 100%)` : `${T.amber}12`, border: `1px solid ${isLight ? T.amber + "5C" : T.amber + "25"}`, borderRadius: 6, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, marginBottom: 7, boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                {l.daysInactive}d sin actividad
                              </div>
                            )}
                            {/* Selector de etapa inline */}
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
                              <select value={l.st} onChange={e => setLeadsData(prev => prev.map(x => x.id === l.id ? {...x, st: e.target.value} : x))}
                                style={{ width: "100%", padding: "5px 8px", borderRadius: 7, background: isLight ? `linear-gradient(135deg, ${c}26 0%, ${c}12 100%)` : `${c}0C`, border: `1px solid ${isLight ? c + "55" : c + "28"}`, color: cText, fontSize: 9.5, fontWeight: 700, cursor: "pointer", outline: "none", appearance: "none", boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                {STAGES.map(s => <option key={s} value={s} style={{ background: "#111318", color: "#fff" }}>{s}</option>)}
                              </select>
                            </div>
                            {/* Contador de seguimientos — permite al asesor registrar
                                cada recontacto directamente desde la tarjeta */}
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8, display: "flex" }}>
                              <FollowUpBadge lead={l} onUpdate={updateLead} T={T} compact />
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`, l)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, background: `${T.accent}10`, border: `1px solid ${T.accentB}`, color: T.accent, fontSize: 9.5, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = `${T.accent}1E`} onMouseLeave={e => e.currentTarget.style.background = `${T.accent}10`}>Analizar</button>
                              <button onClick={() => togglePin(l.id)} title={pinnedIds.has(l.id) ? "Quitar de prioridad" : "Añadir a prioridad"} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: pinnedIds.has(l.id) ? `${T.accent}12` : "transparent", border: `1px solid ${pinnedIds.has(l.id) ? `${T.accent}36` : T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1A`; }} onMouseLeave={e => { e.currentTarget.style.background = pinnedIds.has(l.id) ? `${T.accent}12` : "transparent"; }}><Star size={10} color={pinnedIds.has(l.id) ? T.accent : T.txt3} fill={pinnedIds.has(l.id) ? T.accent : "none"} strokeWidth={2} /></button>
                              <button onClick={() => setSelectedLead(l)} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}><User size={10} color={T.txt3} /></button>
                              <button onClick={() => setNotesLead(l)} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}><FileText size={10} color={T.txt3} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stLeads.length === 0 && (
                      <div style={{ padding: "28px 16px", borderRadius: 11, border: `1px dashed ${isDragTarget ? `${c}50` : T.border}`, textAlign: "center", background: isDragTarget ? `${c}06` : "transparent", transition: "all 0.15s" }}>
                        <p style={{ fontSize: 10.5, color: isDragTarget ? c : T.txt3 }}>{isDragTarget ? "Soltar aquí" : "Sin clientes"}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          );
        })()}
      </G>

      {/* ── CENTRO DE AGENTES IA — equipo virtual que trabaja con los asesores ── */}
      {(() => {
        // Cola por agente, derivada del pipeline real
        const reactivarQueue   = visibleLeads.filter(l => (l.daysInactive || 0) >= 5).sort((a, b) => (b.daysInactive || 0) - (a.daysInactive || 0));
        const seguimientoQueue = visibleLeads.filter(l => ["Primer Contacto", "Seguimiento"].includes(l.st) && !l.hot).sort((a, b) => b.sc - a.sc);
        const callcenterQueue  = visibleLeads.filter(l => l.hot || l.st === "Zoom Agendado").sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || b.sc - a.sc);
        const calificarQueue   = visibleLeads.filter(l => l.isNew).sort((a, b) => (b.id || 0) - (a.id || 0));

        const totalActions = reactivarQueue.length + seguimientoQueue.length + callcenterQueue.length + calificarQueue.length;
        const hoursSaved   = (totalActions * 0.3).toFixed(1);
        // Leads asignados por agente (aiAgent === key)
        const assignedByAgent = {
          reactivar:   visibleLeads.filter(l => l.aiAgent === "reactivar"),
          seguimiento: visibleLeads.filter(l => l.aiAgent === "seguimiento"),
          callcenter:  visibleLeads.filter(l => l.aiAgent === "callcenter"),
          calificar:   visibleLeads.filter(l => l.aiAgent === "calificar"),
        };
        const totalAssigned = Object.values(assignedByAgent).reduce((s, arr) => s + arr.length, 0);

        const agents = [
          {
            key: "reactivar",
            icon: AI_AGENTS.reactivar.icon,
            color: AI_AGENTS.reactivar.color,
            name: AI_AGENTS.reactivar.name,
            role: AI_AGENTS.reactivar.role,
            queue: reactivarQueue,
            metric: "68% re-enganche",
            verb: "Reactivar",
            actionText: "envió mensaje a",
            prompt: (l) => `__crm__ reactivar a ${l.n.toLowerCase()} con mensaje personalizado — lleva ${l.daysInactive} días sin contacto`,
            batchPrompt: (q) => `__crm__ reactivar a los ${q.length} leads fríos: ${q.slice(0, 5).map(l => l.n).join(", ")}${q.length > 5 ? "..." : ""}`,
            queueLabel: (l) => `${l.daysInactive}d`,
          },
          {
            key: "seguimiento",
            icon: AI_AGENTS.seguimiento.icon,
            color: AI_AGENTS.seguimiento.color,
            name: AI_AGENTS.seguimiento.name,
            role: AI_AGENTS.seguimiento.role,
            queue: seguimientoQueue,
            metric: "+42% respuesta",
            verb: "Ejecutar",
            actionText: "preparó next-step para",
            prompt: (l) => `__crm__ próxima acción para ${l.n.toLowerCase()} — etapa ${l.st}, score ${l.sc}`,
            batchPrompt: (q) => `__crm__ prepara next-steps para los ${q.length} leads en seguimiento`,
            queueLabel: (l) => `${l.st.split(" ")[0]} · ${l.sc}`,
          },
          {
            key: "callcenter",
            icon: AI_AGENTS.callcenter.icon,
            color: AI_AGENTS.callcenter.color,
            name: AI_AGENTS.callcenter.name,
            role: AI_AGENTS.callcenter.role,
            queue: callcenterQueue,
            metric: "3.2× conversión",
            verb: "Llamar",
            actionText: "completó llamada con",
            prompt: (l) => `__crm__ prepara briefing de llamada para ${l.n.toLowerCase()} — ${l.hot ? "HOT lead" : "Zoom agendado"}, presupuesto ${l.budget}`,
            batchPrompt: (q) => `__crm__ prepara la cola de ${q.length} llamadas con briefing IA`,
            queueLabel: (l) => l.hot ? "HOT" : "Zoom",
          },
          {
            key: "calificar",
            icon: AI_AGENTS.calificar.icon,
            color: AI_AGENTS.calificar.color,
            name: AI_AGENTS.calificar.name,
            role: AI_AGENTS.calificar.role,
            queue: calificarQueue,
            metric: "96% precisión",
            verb: "Calificar",
            actionText: "calificó a",
            prompt: (l) => `__crm__ califica al lead nuevo ${l.n.toLowerCase()} y dame recomendación de próximos pasos`,
            batchPrompt: (q) => `__crm__ prepara la cola de ${q.length} leads nuevos y ordénalos por prioridad`,
            queueLabel: (l) => l.campana ? l.campana.slice(0, 8) : "Nuevo",
          },
        ];

        // Feed de actividad reciente (determinista, a partir del pipeline)
        const activityLog = [
          { agent: agents[0], lead: reactivarQueue[1]   || reactivarQueue[0],   time: "hace 3m" },
          { agent: agents[1], lead: seguimientoQueue[1] || seguimientoQueue[0], time: "hace 9m" },
          { agent: agents[2], lead: callcenterQueue[1]  || callcenterQueue[0],  time: "hace 16m" },
          { agent: agents[3], lead: calificarQueue[1]   || calificarQueue[0],   time: "hace 24m" },
        ].filter(e => e.lead);

        return (
          <G T={T} style={{ padding: 0, overflow: "hidden" }}>
            {/* Halo superior sutil — sin barra, funciona en claro y oscuro */}
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: "60%", height: 1,
              background: isLight
                ? `linear-gradient(90deg, transparent, ${T.accent}66, transparent)`
                : `linear-gradient(90deg, transparent, ${T.accent}3A, transparent)`,
              pointerEvents: "none",
            }} />

            <div style={{ padding: "18px 20px 16px", position: "relative" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 13,
                    background: isLight
                      ? `radial-gradient(circle at 35% 28%, #FFFFFF 0%, ${T.accent}14 100%)`
                      : `radial-gradient(circle at 35% 28%, ${T.accent}1A 0%, ${T.accent}06 60%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${isLight ? `${T.accent}3A` : `${T.accent}28`}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: isLight
                      ? `0 2px 8px ${T.accent}24, inset 0 1px 0 rgba(255,255,255,0.9)`
                      : `0 0 18px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}>
                    <div style={{ animation: "stratosAtomSpin 14s cubic-bezier(0.45,0.05,0.55,0.95) infinite", transformOrigin: "center", display: "flex", filter: isLight ? `drop-shadow(0 1px 2px ${T.accent}55)` : `drop-shadow(0 0 6px ${T.accent}40)` }}>
                      <StratosAtomHex size={24} color={T.accent} edge={T.accent} />
                    </div>
                    <style>{`
                      @keyframes stratosAtomSpin {
                        0%   { transform: rotate(0deg) scale(1); }
                        18%  { transform: rotate(90deg) scale(1.03); }
                        32%  { transform: rotate(140deg) scale(1); }
                        50%  { transform: rotate(180deg) scale(1); }
                        68%  { transform: rotate(268deg) scale(1.03); }
                        82%  { transform: rotate(320deg) scale(1); }
                        100% { transform: rotate(360deg) scale(1); }
                      }
                    `}</style>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.02em" }}>Centro de Agentes IA</p>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "3.5px 11px", borderRadius: 99,
                        background: isLight
                          ? `linear-gradient(135deg, ${T.accent}3D 0%, ${T.accent}1F 55%, ${T.accent}12 100%)`
                          : `linear-gradient(135deg, ${T.accent}26 0%, ${T.accent}10 100%)`,
                        border: `1px solid ${isLight ? T.accent + "85" : T.accent + "44"}`,
                        boxShadow: isLight
                          ? `0 2px 8px ${T.accent}2E, 0 1px 2px ${T.accent}1A, inset 0 1px 0 rgba(255,255,255,0.7)`
                          : `0 1px 4px ${T.accent}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: `radial-gradient(circle at 30% 30%, #FFFFFFB3 0%, ${T.accent} 45%, ${T.accent} 100%)`,
                          boxShadow: `0 0 0 2px ${T.accent}2E, 0 0 6px ${T.accent}`,
                          animation: "pulse 2s ease-in-out infinite",
                        }} />
                        <span style={{
                          fontSize: 9, fontWeight: 800,
                          color: isLight ? `color-mix(in srgb, ${T.accent} 55%, #0B1220 45%)` : T.accent,
                          letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: font,
                          textShadow: isLight ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
                        }}>LIVE</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: T.txt3, margin: "3px 0 0", fontFamily: font, letterSpacing: "0.005em" }}>Tu equipo virtual — redacta, llama, califica y reactiva mientras tú cierras</p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {[
                    { label: "Asignados", value: totalAssigned, color: T.accent },
                    { label: "Acciones", value: totalActions, color: T.blue },
                    { label: "Ahorro",   value: `${hoursSaved}h`, color: T.violet },
                    { label: "Éxito IA", value: "91%", color: T.emerald },
                  ].map((k) => (
                    <div key={k.label} style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start",
                      padding: "7px 13px", borderRadius: 10,
                      background: isLight
                        ? `linear-gradient(135deg, ${k.color}28 0%, ${k.color}12 55%, ${k.color}08 100%)`
                        : `linear-gradient(135deg, ${k.color}1A 0%, ${k.color}08 100%)`,
                      border: `1px solid ${isLight ? k.color + "5C" : k.color + "30"}`,
                      boxShadow: isLight
                        ? `0 2px 6px ${k.color}22, 0 1px 2px ${k.color}14, inset 0 1px 0 rgba(255,255,255,0.7)`
                        : `0 1px 3px ${k.color}12, inset 0 1px 0 rgba(255,255,255,0.08)`,
                    }}>
                      <p style={{
                        fontSize: 8.5, margin: 0, fontFamily: font, letterSpacing: "0.1em",
                        textTransform: "uppercase", fontWeight: 800,
                        color: isLight ? `color-mix(in srgb, ${k.color} 55%, #0B1220 45%)` : k.color,
                        opacity: 0.85,
                      }}>{k.label}</p>
                      <p style={{
                        fontSize: 18, fontWeight: 800, fontFamily: fontDisp, margin: "1px 0 0",
                        letterSpacing: "-0.03em", lineHeight: 1,
                        color: isLight ? `color-mix(in srgb, ${k.color} 68%, #0B1220 32%)` : k.color,
                        textShadow: isLight ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
                      }}>{k.value}</p>
                    </div>
                  ))}

                </div>
              </div>

              {/* Grid de agentes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {agents.map(a => {
                  const { icon: Icon, color, queue } = a;
                  const isIdle = queue.length === 0;
                  const visibleQueue = queue.slice(0, 3);
                  const extra = queue.length - visibleQueue.length;
                  const assigned = assignedByAgent[a.key] || [];

                  // Text con contraste premium en ambos temas
                  const colorText = isLight
                    ? `color-mix(in srgb, ${color} 58%, #0B1220 42%)`
                    : color;

                  return (
                    <div key={a.key}
                      style={{
                        position: "relative",
                        borderRadius: 16,
                        background: isLight
                          ? (isIdle
                              ? `linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,252,0.72) 100%)`
                              : `radial-gradient(ellipse 320px 180px at 0% 0%, ${color}2E 0%, ${color}0E 42%, transparent 72%), linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,252,254,0.86) 100%)`)
                          : (isIdle
                              ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.012) 100%)"
                              : "linear-gradient(180deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.014) 100%)"),
                        backdropFilter: "blur(30px) saturate(180%)",
                        WebkitBackdropFilter: "blur(30px) saturate(180%)",
                        border: `1px solid ${isIdle ? T.border : (isLight ? `${color}5A` : `${color}22`)}`,
                        boxShadow: isLight
                          ? (isIdle
                              ? `0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.85)`
                              : `0 2px 4px ${color}1A, 0 8px 24px rgba(15,23,42,0.06), 0 4px 14px ${color}22, inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 ${color}0F`)
                          : (isIdle
                              ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                              : `0 2px 8px rgba(0,0,0,0.22), 0 8px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)`),
                        overflow: "hidden",
                        display: "flex", flexDirection: "column",
                        transition: "all 0.24s cubic-bezier(.4,0,.2,1)",
                      }}
                      onMouseEnter={e => {
                        if (!isIdle) {
                          e.currentTarget.style.borderColor = isLight ? `${color}82` : `${color}3A`;
                          e.currentTarget.style.transform = "translateY(-3px)";
                          e.currentTarget.style.boxShadow = isLight
                            ? `0 4px 14px rgba(15,23,42,0.08), 0 22px 48px rgba(15,23,42,0.1), 0 8px 28px ${color}3A, inset 0 1px 0 rgba(255,255,255,0.95)`
                            : `0 4px 12px rgba(0,0,0,0.32), 0 16px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isIdle) {
                          e.currentTarget.style.borderColor = isLight ? `${color}5A` : `${color}22`;
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = isLight
                            ? `0 2px 4px ${color}1A, 0 8px 24px rgba(15,23,42,0.06), 0 4px 14px ${color}22, inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 ${color}0F`
                            : `0 2px 8px rgba(0,0,0,0.22), 0 8px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)`;
                        }
                      }}
                    >
                      {/* Shimmer diagonal — solo en light theme (en dark estorba) */}
                      {!isIdle && isLight && (
                        <div style={{
                          position: "absolute", inset: 0, pointerEvents: "none",
                          background: `linear-gradient(135deg, rgba(255,255,255,0.45) 0%, transparent 35%)`,
                          borderRadius: 16,
                        }} />
                      )}

                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11, flex: 1, position: "relative" }}>
                        {/* Head */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: isLight
                              ? `radial-gradient(circle at 30% 25%, ${color}48 0%, ${color}22 55%, ${color}10 100%)`
                              : `radial-gradient(circle at 30% 25%, ${color}22 0%, ${color}0C 55%, ${color}04 100%)`,
                            border: `1px solid ${isLight ? color + "62" : color + "32"}`,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            position: "relative",
                            boxShadow: isIdle
                              ? "none"
                              : (isLight
                                  ? `0 3px 10px ${color}36, 0 1px 2px ${color}1A, inset 0 1px 0 rgba(255,255,255,0.75), inset 0 0 10px ${color}14`
                                  : `0 0 12px ${color}18, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 8px ${color}10`),
                          }}>
                            <Icon size={17} color={color} strokeWidth={2.3} />
                            {!isIdle && (
                              <div style={{
                                position: "absolute", top: -3, right: -3, width: 11, height: 11, borderRadius: "50%",
                                background: `radial-gradient(circle at 32% 30%, #FFFFFF 0%, #FFFFFF 18%, ${color} 55%, ${color} 100%)`,
                                boxShadow: isLight
                                  ? `0 0 0 2.5px #FFFFFF, 0 0 0 3.5px ${color}, 0 0 8px ${color}AA`
                                  : `0 0 0 2.5px ${T.bg}, 0 0 0 3.5px ${color}, 0 0 8px ${color}AA`,
                                animation: "pulse 2.2s ease-in-out infinite",
                              }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.015em" }}>{a.name}</p>
                            <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, margin: "2px 0 0", letterSpacing: "0.005em" }}>{a.role}</p>
                          </div>
                          <div style={{
                            padding: "4px 12px", borderRadius: 99, minWidth: 32,
                            background: isIdle
                              ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                              : (isLight
                                  ? `linear-gradient(135deg, ${color}42 0%, ${color}22 55%, ${color}14 100%)`
                                  : `linear-gradient(135deg, ${color}18 0%, ${color}0C 100%)`),
                            border: `1px solid ${isIdle ? T.border : (isLight ? `${color}82` : `${color}34`)}`,
                            flexShrink: 0, textAlign: "center",
                            boxShadow: !isIdle
                              ? (isLight
                                  ? `0 2px 8px ${color}32, 0 1px 2px ${color}1A, inset 0 1px 0 rgba(255,255,255,0.65)`
                                  : `inset 0 1px 0 rgba(255,255,255,0.07)`)
                              : "none",
                          }}>
                            <span style={{
                              fontSize: 12.5, fontWeight: 900,
                              color: isIdle ? T.txt3 : colorText,
                              fontFamily: fontDisp, letterSpacing: "-0.02em",
                              textShadow: !isIdle && isLight ? "0 1px 0 rgba(255,255,255,0.5)" : "none",
                            }}>{queue.length}</span>
                          </div>
                        </div>

                        {/* Métrica de éxito */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 10px", borderRadius: 8,
                          background: isIdle
                            ? "transparent"
                            : (isLight
                                ? `linear-gradient(135deg, ${color}1E 0%, ${color}08 100%)`
                                : `linear-gradient(135deg, ${color}0A 0%, ${color}03 100%)`),
                          border: isIdle ? "none" : `1px solid ${isLight ? color + "36" : color + "18"}`,
                          boxShadow: !isIdle && isLight ? "inset 0 1px 0 rgba(255,255,255,0.5)" : "none",
                        }}>
                          <TrendingUp size={11} color={isIdle ? T.txt3 : colorText} strokeWidth={2.5} />
                          <span style={{
                            fontSize: 10, fontWeight: 800,
                            color: isIdle ? T.txt3 : colorText,
                            fontFamily: font, letterSpacing: "0.02em",
                          }}>{a.metric}</span>
                          <span style={{ fontSize: 9, color: T.txt3, fontFamily: font, marginLeft: "auto", fontWeight: 600 }}>últ. 30 días</span>
                        </div>

                        {/* Clientes asignados por asesor */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9,
                          background: assigned.length > 0
                            ? (isLight
                                ? `linear-gradient(135deg, ${color}2A 0%, ${color}10 55%, ${color}06 100%)`
                                : `linear-gradient(135deg, ${color}0C 0%, ${color}03 100%)`)
                            : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.02)"),
                          border: `1px solid ${assigned.length > 0 ? (isLight ? `${color}5C` : `${color}20`) : T.border}`,
                          boxShadow: assigned.length > 0
                            ? (isLight ? `0 1px 2px ${color}18, inset 0 1px 0 rgba(255,255,255,0.55)` : "none")
                            : "none",
                        }}>
                          <Users size={11} color={assigned.length > 0 ? colorText : T.txt3} strokeWidth={2.5} />
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: assigned.length > 0 ? colorText : T.txt3,
                            fontFamily: font, letterSpacing: "0.015em",
                          }}>
                            {assigned.length > 0 ? `${assigned.length} asignado${assigned.length > 1 ? "s" : ""} por el asesor` : "Sin asignaciones directas"}
                          </span>
                          {assigned.length > 0 && (
                            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                              {assigned.slice(0, 3).map(l => (
                                <div key={l.id} title={l.n} style={{
                                  width: 19, height: 19, borderRadius: "50%",
                                  background: isLight
                                    ? `linear-gradient(135deg, ${color}48 0%, ${color}22 100%)`
                                    : `linear-gradient(135deg, ${color}2E 0%, ${color}14 100%)`,
                                  border: `1px solid ${isLight ? color + "7A" : color + "55"}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 8.5, fontWeight: 800, color: colorText, fontFamily: fontDisp,
                                  boxShadow: isLight ? `0 1px 2px ${color}22` : "none",
                                }}>{l.n.charAt(0)}</div>
                              ))}
                              {assigned.length > 3 && <span style={{ fontSize: 9, fontWeight: 800, color: colorText, fontFamily: fontDisp, alignSelf: "center", marginLeft: 2 }}>+{assigned.length - 3}</span>}
                            </div>
                          )}
                        </div>

                        {/* Cola */}
                        <div style={{ flex: 1, padding: 0, borderRadius: 10,
                          background: isLight
                            ? `linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(241,245,249,0.68) 100%)`
                            : `linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.14) 100%)`,
                          border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.05)"}`,
                          boxShadow: isLight
                            ? "inset 0 1px 3px rgba(15,23,42,0.04), inset 0 -1px 0 rgba(255,255,255,0.4)"
                            : "inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.2)",
                          overflow: "hidden", display: "flex", flexDirection: "column",
                        }}>
                          {isIdle ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "20px 10px" }}>
                              <CheckCircle2 size={12} color={T.emerald} />
                              <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, fontWeight: 600 }}>Sin pendientes — todo al día</span>
                            </div>
                          ) : (
                            <>
                              {visibleQueue.map((l, idx) => (
                                <div key={l.id}
                                  onClick={() => setSelectedLead(l)}
                                  title={`Ver perfil de ${l.n}`}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 9,
                                    padding: "8px 11px",
                                    borderBottom: idx < visibleQueue.length - 1 || extra > 0 ? `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"}` : "none",
                                    cursor: "pointer", transition: "all 0.15s",
                                    position: "relative",
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = isLight
                                      ? `linear-gradient(135deg, ${color}1E 0%, ${color}08 100%)`
                                      : `linear-gradient(135deg, ${color}0A 0%, ${color}03 100%)`;
                                    e.currentTarget.style.paddingLeft = "13px";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.paddingLeft = "11px";
                                  }}
                                >
                                  {/* LED dot premium */}
                                  <div style={{
                                    width: 7, height: 7, borderRadius: "50%",
                                    background: `radial-gradient(circle at 30% 30%, #FFFFFFB0 0%, ${color} 45%, ${color} 100%)`,
                                    boxShadow: isLight
                                      ? `0 0 0 2px ${color}22, 0 0 6px ${color}75`
                                      : `0 0 0 1.5px ${color}28, 0 0 5px ${color}90`,
                                    flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, letterSpacing: "-0.005em" }}>{l.n}</span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    color: colorText,
                                    fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase",
                                    flexShrink: 0,
                                    padding: "2px 7px", borderRadius: 99,
                                    background: isLight
                                      ? `linear-gradient(135deg, ${color}2A 0%, ${color}12 100%)`
                                      : `${color}10`,
                                    border: `1px solid ${isLight ? color + "4E" : color + "22"}`,
                                    boxShadow: isLight ? `inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                                  }}>{a.queueLabel(l)}</span>
                                  {/* Botón de ejecución rápida del agente sobre este lead */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); oc(a.prompt(l), l); }}
                                    title={`Ejecutar ${a.name} para ${l.n}`}
                                    style={{
                                      width: 22, height: 22, borderRadius: 7,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      background: isLight ? `${color}1A` : `${color}14`,
                                      border: `1px solid ${isLight ? color + "40" : color + "26"}`,
                                      cursor: "pointer", flexShrink: 0, padding: 0,
                                      transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => {
                                      e.stopPropagation();
                                      e.currentTarget.style.background = isLight ? `${color}32` : `${color}24`;
                                      e.currentTarget.style.borderColor = isLight ? `${color}6A` : `${color}42`;
                                    }}
                                    onMouseLeave={e => {
                                      e.stopPropagation();
                                      e.currentTarget.style.background = isLight ? `${color}1A` : `${color}14`;
                                      e.currentTarget.style.borderColor = isLight ? `${color}40` : `${color}26`;
                                    }}
                                  >
                                    <Zap size={10} color={colorText} strokeWidth={2.6} />
                                  </button>
                                </div>
                              ))}
                              {extra > 0 && (
                                <div style={{
                                  padding: "6px 11px", textAlign: "center",
                                  background: isLight
                                    ? `linear-gradient(135deg, ${color}0C 0%, ${color}04 100%)`
                                    : "rgba(255,255,255,0.015)",
                                  borderTop: `1px solid ${isLight ? color + "18" : "rgba(255,255,255,0.04)"}`,
                                }}>
                                  <span style={{ fontSize: 9.5, color: colorText, fontFamily: font, fontWeight: 700, letterSpacing: "0.02em" }}>+{extra} más en cola</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            disabled={isIdle}
                            onClick={() => !isIdle && oc(a.batchPrompt(queue))}
                            style={{
                              flex: 1, padding: "10px 10px", borderRadius: 10,
                              background: isIdle
                                ? (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)")
                                : (isLight
                                    ? `linear-gradient(135deg, ${color}22, ${color}0C)`
                                    : `linear-gradient(135deg, ${color}18, ${color}08)`),
                              border: `1px solid ${isIdle ? T.border : (isLight ? `${color}4A` : `${color}38`)}`,
                              color: isIdle ? T.txt3 : colorText,
                              fontSize: 11.5, fontWeight: 800, fontFamily: fontDisp, letterSpacing: "-0.005em",
                              cursor: isIdle ? "not-allowed" : "pointer",
                              transition: "all 0.18s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              boxShadow: !isIdle && isLight ? `0 1px 3px ${color}14, inset 0 1px 0 rgba(255,255,255,0.55)` : "none",
                            }}
                            onMouseEnter={e => { if (!isIdle) { e.currentTarget.style.background = `linear-gradient(135deg, ${color}, ${color}DD)`; e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 5px 14px ${color}48, inset 0 1px 0 rgba(255,255,255,0.28)`; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                            onMouseLeave={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? `linear-gradient(135deg, ${color}22, ${color}0C)` : `linear-gradient(135deg, ${color}18, ${color}08)`; e.currentTarget.style.color = colorText; e.currentTarget.style.borderColor = isLight ? `${color}4A` : `${color}38`; e.currentTarget.style.boxShadow = isLight ? `0 1px 3px ${color}14, inset 0 1px 0 rgba(255,255,255,0.55)` : "none"; e.currentTarget.style.transform = "none"; } }}
                          >
                            <Zap size={12} strokeWidth={2.5} /> {a.verb} {!isIdle && `los ${queue.length}`}
                          </button>
                          <button
                            disabled={isIdle}
                            onClick={() => !isIdle && oc(`__crm__ muestra la cola completa del agente ${a.name.toLowerCase()}: ${queue.length} leads`)}
                            title={`Ver los ${queue.length} leads en cola`}
                            style={{
                              width: 36, height: 36, borderRadius: 9,
                              background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)",
                              border: `1px solid ${T.border}`,
                              color: isIdle ? T.txt3 : T.txt2,
                              cursor: isIdle ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s", flexShrink: 0, padding: 0,
                              boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.8)" : "none",
                            }}
                            onMouseEnter={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; } }}
                            onMouseLeave={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = T.border; } }}
                          >
                            <List size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feed de actividad reciente */}
            {activityLog.length > 0 && (
              <div style={{
                padding: "10px 18px 14px",
                borderTop: `1px solid ${isLight ? T.borderMint : T.border}`,
                background: isLight
                  ? `linear-gradient(180deg, rgba(240,252,247,0.5) 0%, rgba(255,255,255,0.3) 100%)`
                  : "rgba(255,255,255,0.01)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={11} color={T.txt3} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: font }}>Actividad reciente</span>
                  </div>
                  <button onClick={() => oc("__crm__ muestra el historial completo de acciones ejecutadas por los agentes IA hoy")}
                    style={{ fontSize: 10, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontWeight: 600, padding: 0, letterSpacing: "0.01em" }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >Ver historial →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                  {activityLog.map(({ agent, lead, time }) => {
                    const A = agent.icon;
                    return (
                      <div key={agent.key} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8,
                        background: isLight
                          ? `linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(248,252,250,0.72) 100%)`
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${T.border}`,
                        boxShadow: isLight ? "0 1px 2px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.6)" : "none",
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: isLight ? `linear-gradient(135deg, ${agent.color}24, ${agent.color}0A)` : `${agent.color}16`,
                          border: `1px solid ${agent.color}34`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          boxShadow: isLight ? `0 1px 3px ${agent.color}1F, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                        }}>
                          <A size={11} color={agent.color} strokeWidth={2.2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10.5, color: T.txt2, margin: 0, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: agent.color, fontWeight: 700 }}>{agent.name}</span>
                            <span style={{ color: T.txt3 }}> {agent.actionText} </span>
                            <span style={{ color: isLight ? T.txt : "#FFF", fontWeight: 600 }}>{lead.n}</span>
                          </p>
                          <p style={{ fontSize: 9, color: T.txt3, margin: "1px 0 0", fontFamily: font }}>{time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </G>
        );
      })()}

      {/* Drawers — los 3 (Análisis IA, Perfil, Expediente) comparten un switcher
         "Dynamic Island" en la parte inferior que permite al vendedor saltar
         entre vistas del mismo lead sin cerrar. */}
      <NotesModal
        T={T}
        lead={notesLead}
        onClose={() => setNotesLead(null)}
        onSave={saveNotes}
        onUpdate={(u) => { updateLead(u); if (notesLead && u.id === notesLead.id) setNotesLead(u); }}
        onSwitchTab={(tab) => openDrawerTab(tab, notesLead)}
      />
      <LeadPanel
        T={T}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        oc={oc}
        onUpdate={updateLead}
        onSwitchTab={(tab) => openDrawerTab(tab, selectedLead)}
      />
      <AnalysisDrawer
        T={T}
        lead={analyzingLead}
        onClose={() => setAnalyzingLead(null)}
        oc={oc}
        onUpdate={updateLead}
        onSwitchTab={(tab) => openDrawerTab(tab, analyzingLead)}
      />
    </div>
  );
}


const ERP = ({ oc, T: _T }) => {
  const isLight = !!_T && _T !== P;
  const T = _T || P;
  const erpProjects = [
    { id: 1, n: "Gobernador 28", loc: "Playa del Carmen", st: "Construcción", c: P.blue, roi: "24%", u: 48, s: 36, v: "$4.2M", m: 31, f: "Q2 2026", t: "Residencial Premium" },
    { id: 2, n: "Monarca 28", loc: "Playa del Carmen", st: "Preventa", c: P.emerald, roi: "28%", u: 56, s: 42, v: "$5.8M", m: 29, f: "Q3 2026", t: "Condominios de Lujo" },
    { id: 3, n: "Portofino", loc: "Cancún", st: "Disponible", c: P.amber, roi: "26%", u: 32, s: 26, v: "$3.8M", m: 32, f: "Q1 2026", t: "Casas Residenciales" },
    { id: 4, n: "Casa Blanca", loc: "Playa del Carmen", st: "Reserva", c: P.violet, roi: "22%", u: 20, s: 14, v: "$2.2M", m: 27, f: "Q4 2025", t: "Villas Exclusivas" },
  ];

  const inventorySummary = {
    total: 156,
    sold: 118,
    available: 38,
    reserved: 28,
    value: "$72.4M",
    avgMargin: "26.5%",
    absorption: 75.6,
    pipeline: "$18.7M"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs Principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Unidades Totales" value={inventorySummary.total} sub="Portafolio" icon={Building2} color={T.blue} T={T} />
        <KPI label="Unidades Vendidas" value={inventorySummary.sold} sub={`${inventorySummary.absorption.toFixed(1)}%`} icon={CheckCircle2} color={T.emerald} T={T} />
        <KPI label="Valor Inventario" value={inventorySummary.value} sub="Valuación" icon={Banknote} T={T} />
        <KPI label="Margen Promedio" value={inventorySummary.avgMargin} sub="Rentabilidad" icon={Percent} color={T.violet} T={T} />
      </div>

      {/* Matriz de Proyectos */}
      <G np T={T}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Portafolio de Proyectos</p>
          <Pill color={T.blue} s isLight={isLight}>{erpProjects.length} Proyectos Activos</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr", gap: 12, padding: "14px 22px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Proyecto</span><span>Ubicación</span><span>Estado</span><span>Unidades</span><span>Venta Rápida</span><span>Margen</span><span>Cierre</span>
        </div>
        {erpProjects.map((proj) => (
          <div key={proj.id} onClick={() => oc(`Análisis detallado de ${proj.n}: Inventario ${proj.s}/${proj.u}, ROI ${proj.roi}, Absorción ${((proj.s / proj.u) * 100).toFixed(1)}%, Próximo: ${proj.f}`)} style={{
            display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr",
            gap: 12, padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
            cursor: "pointer", transition: "all 0.2s",
          }} onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 3 }}>{proj.n}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>{proj.t}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={12} color={T.txt3} />
              <span style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>{proj.loc}</span>
            </div>
            <Pill color={proj.c} s isLight={isLight}>{proj.st}</Pill>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{proj.s}/{proj.u}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>Vendidas</p>
            </div>
            <div>
              <div style={{ height: 5, background: T.glass, borderRadius: 3, marginBottom: 4, overflow: "hidden" }}>
                <div style={{ width: `${(proj.s / proj.u) * 100}%`, height: "100%", background: proj.c, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 10, color: T.txt3, textAlign: "center" }}>{((proj.s / proj.u) * 100).toFixed(0)}%</p>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: proj.m > 28 ? T.emerald : proj.m > 25 ? T.blue : T.amber, fontFamily: fontDisp, textAlign: "center" }}>{proj.m}%</p>
            <p style={{ fontSize: 11, color: T.txt2, fontFamily: font, textAlign: "center" }}>{proj.f}</p>
          </div>
        ))}
      </G>

      {/* Análisis de Inventario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <G T={T}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 14, fontFamily: fontDisp }}>Distribución de Inventario</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Vendidas", val: inventorySummary.sold, c: T.emerald },
              { label: "Disponibles", val: inventorySummary.available, c: T.blue },
              { label: "Reservadas", val: inventorySummary.reserved, c: T.amber },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: T.txt2, fontFamily: font, minWidth: 80 }}>{s.label}</span>
                <div style={{ flex: 1, height: 8, background: T.glass, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(s.val / inventorySummary.total) * 100}%`, height: "100%", background: s.c }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.c, fontFamily: fontDisp, minWidth: 45, textAlign: "right" }}>{s.val}</span>
              </div>
            ))}
          </div>
        </G>

        <G T={T}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 14, fontFamily: fontDisp }}>Métricas Financieras</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Valor Generado</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.emerald, fontFamily: fontDisp }}>${(inventorySummary.sold * 0.6).toFixed(1)}M</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Pipeline Activo</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: fontDisp }}>{inventorySummary.pipeline}</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Tiempo Absorción</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.violet, fontFamily: fontDisp }}>6.8 meses</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Proyección Q4</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.amber, fontFamily: fontDisp }}>142 Sold</p>
            </div>
          </div>
        </G>
      </div>
    </div>
  );
};

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

const AsesorCRM = ({ oc }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODO");

  // Filtro y búsqueda optimizados con useMemo
  const filteredData = useMemo(() => {
    return crmAsesores.filter(r => {
      const matchesSearch = r.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            r.asesor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            r.tel.includes(searchTerm);
      const matchesFilter = filterStatus === "TODO" || r.status.includes(filterStatus);
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, filterStatus]);

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
      <KPI label="Registros Totales" value={crmAsesores.length} icon={FileText} color={P.blue} />
      <KPI label="Zeta Agendados" value={crmAsesores.filter(r => r.status.includes("ZOOM")).length} sub="próximos" icon={CalendarDays} color={P.emerald} />
      <KPI label="En Seguimiento" value={crmAsesores.filter(r => r.status.includes("SEGUIMIENTO")).length} sub="active" icon={Phone} color={P.amber} />
      <KPI label="Sin Respuesta" value={crmAsesores.filter(r => r.status.includes("NO CONTESTA")).length} sub="reactivar" icon={Bell} color={P.rose} />
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
          const statusColor = r.status.includes("ZOOM") ? P.emerald : r.status.includes("SEGUIMIENTO") ? P.blue : r.status.includes("WHATSAPP") ? P.cyan : P.rose;
          return (
            <div key={i} onClick={() => oc(`Detalles de ${r.cliente}: ${r.notas}`)} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr 1.2fr 0.9fr 0.9fr 1fr 0.6fr",
              gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: `1px solid ${P.border}`,
              fontSize: 11, cursor: "pointer", transition: "background 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: P.txt3, fontFamily: font, fontSize: 10 }}>{r.fecha}</span>
              <span style={{ color: P.txt, fontWeight: 500, fontFamily: font }}>{r.asesor}</span>
              <span style={{ color: P.txt, fontWeight: 500, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cliente}</span>
              <span style={{ color: P.txt2, fontFamily: "monospace", fontSize: 10 }}>{r.tel}</span>
              <Pill color={statusColor} s>{r.status}</Pill>
              <span style={{ color: r.presupuesto ? P.emerald : P.txt3, fontWeight: 500, fontFamily: fontDisp, fontSize: 10 }}>{r.presupuesto || "—"}</span>
              <span style={{ color: P.txt2, fontSize: 10, fontFamily: font }}>{r.proyecto}</span>
              <span style={{ color: P.txt3, fontSize: 9 }}>{r.campaña || "—"}</span>
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

    {/* Expediente de clientes */}
    <G>
      <p style={{ fontSize: 13, fontWeight: 700, color: P.txt, marginBottom: 14 }}>Expediente y Contexto de Clientes</p>
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
const WriterSection = ({ value, onChange, clientName, T = P }) => {
  const isLight = T !== P;
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
      <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 10, fontWeight: 600, letterSpacing: "0.03em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Mensaje personalizado</span>
        <span style={{ fontSize: 10, color: T.txt3, fontWeight: 400 }}>{charCount}/{charLimit}</span>
      </label>

      {/* Templates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            onClick={() => applyTemplate(key)}
            style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${selectedTemplate === key ? T.accent + "60" : T.border}`,
              background: selectedTemplate === key ? T.accentS : T.glass,
              color: selectedTemplate === key ? T.accent : T.txt2,
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
            background: T.glass, border: `1px solid ${T.border}`, color: T.txt,
            fontFamily: font, outline: "none", resize: "vertical", lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = T.accent + "60"}
          onBlur={e => e.target.style.borderColor = T.border}
          maxLength={charLimit}
        />
        <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: charCount > charLimit * 0.8 ? T.rose : T.txt3 }}>
            {charCount}/{charLimit}
          </span>
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          fontSize: 11, fontWeight: 600, color: T.accent, background: "transparent",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Vista previa en landing page
      </button>

      {/* Preview */}
      {showPreview && value && (
        <G T={T} style={{ padding: 16, background: `${T.accent}08`, border: `1px solid ${T.accent}1A` }}>
          <p style={{ fontSize: 10, color: T.accent, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 10, textTransform: "uppercase" }}>Cómo verá el cliente</p>
          <p style={{ fontSize: 14, color: T.txt, lineHeight: 1.7, fontFamily: font, fontStyle: "italic" }}>
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
const NewPropertyModal = ({ onClose, onSave, initialData = null, T = P }) => {
  const isLight = T !== P;
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
      img: `linear-gradient(135deg, ${form.accent}25 0%, ${form.accent}08 40%, #020406 100%)`,
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
    background: T.glass, border: `1px solid ${errors[key] ? T.rose + "80" : T.border}`,
    color: T.txt, fontSize: 13, fontFamily: font, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  });
  const labelStyle = { fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: font };
  const sectionTitle = (accent) => ({ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontFamily: font });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: 680, maxHeight: "92vh", overflowY: "auto",
        background: isLight ? "#FFFFFF" : "#111318", border: `1px solid ${T.border}`, borderRadius: 22,
        boxShadow: isLight ? T.shadow3 || "0 40px 100px rgba(15,23,42,0.15)" : "0 40px 100px rgba(0,0,0,0.7)",
      }}>
        {/* Header with accent preview */}
        <div style={{
          padding: "22px 28px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: `linear-gradient(135deg, ${form.accent}10 0%, transparent 60%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: isLight ? `${form.accent}18` : `linear-gradient(135deg, ${form.accent}25 0%, #020406 100%)`,
              border: `1px solid ${form.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={20} color={form.accent} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>
                {editing ? "Editar Propiedad" : "Registrar Propiedad"}
              </p>
              <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                {editing ? `Editando: ${initialData.name}` : "Agrega un nuevo desarrollo al catálogo permanente"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={T.txt2} />
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
                {errors.name && <p style={{fontSize:10,color:T.rose,marginTop:3}}>Campo requerido</p>}
              </div>
              <div>
                <label style={labelStyle}>Marca / Sub-nombre</label>
                <input value={form.brand} onChange={e=>set("brand",e.target.value)} placeholder="Ej: by Four Seasons" style={inputStyle("brand")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Ubicación</label>
                <select value={form.location} onChange={e=>set("location",e.target.value)} style={{ ...inputStyle("location"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {locationOptions.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Referencia</label>
                <input value={form.zone} onChange={e=>set("zone",e.target.value)} placeholder="Ej: Aldea Zama, frente al mar" style={inputStyle("zone")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Badge</label>
                <select value={form.badge} onChange={e=>set("badge",e.target.value)} style={{ ...inputStyle("badge"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {badgeOptions.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 — Precios y financiero */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
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
                    onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors[f.k]?T.rose+"80":T.border} />
                  {errors[f.k] && <p style={{fontSize:10,color:T.rose,marginTop:3}}>Requerido</p>}
                </div>
              ))}
            </div>
            {/* Preview pricing */}
            {form.priceFrom && form.priceTo && (
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: `${form.accent}0A`, border: `1px solid ${form.accent}20`, fontSize: 12, color: form.accent, fontFamily: fontDisp }}>
                  Desde ${(parseInt(form.priceFrom)/1000).toFixed(0)}K USD
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, fontSize: 12, color: T.txt2, fontFamily: fontDisp }}>
                  Hasta ${(parseInt(form.priceTo)/1000).toFixed(0)}K USD
                </div>
                {form.roi && <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: 12, color: "#4ADE80", fontFamily: fontDisp }}>ROI {form.roi}</div>}
              </div>
            )}
          </div>

          {/* SECCIÓN 3 — Características */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Características</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle("type"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {typeOptions.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Recámaras</label>
                <input value={form.bedrooms} onChange={e=>set("bedrooms",e.target.value)} placeholder="1-3 recámaras" style={inputStyle("bedrooms")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Unidades disp.</label>
                <input value={form.unitsAvailable} onChange={e=>set("unitsAvailable",e.target.value)} placeholder="10" type="number" min="0" style={inputStyle("unitsAvailable")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Total unidades</label>
                <input value={form.totalUnits} onChange={e=>set("totalUnits",e.target.value)} placeholder="40" type="number" min="0" style={inputStyle("totalUnits")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tamaños disponibles (separados por coma)</label>
              <input value={form.sizes} onChange={e=>set("sizes",e.target.value)} placeholder="65 m², 85 m², 120 m², 180 m²" style={inputStyle("sizes")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
            </div>
          </div>

          {/* SECCIÓN 4 — Descripción y detalles */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Descripción y detalles</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Descripción del desarrollo</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3}
                placeholder="Describe el proyecto, su concepto, entorno y propuesta de valor..."
                style={{ ...inputStyle("description"), resize: "vertical", lineHeight: 1.6 }}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Puntos clave — highlights (separados por coma)</label>
              <input value={form.highlights} onChange={e=>set("highlights",e.target.value)}
                placeholder="Rooftop con piscina, Cenote natural, Solo 14 unidades exclusivas"
                style={inputStyle("highlights")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
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
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              {form.amenities && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.amenities.split(",").filter(a=>a.trim()).map((a,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2 }}>{a.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5 — Media y visual */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Media y visual</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={10} color={T.accent} /> Link de galería de imágenes
                <span style={{ color: T.txt3, fontWeight: 400, textTransform: "none", marginLeft: 4 }}>— Google Drive, Dropbox o cualquier carpeta compartida</span>
              </label>
              <div style={{ position: "relative" }}>
                <ExternalLink size={13} color={form.driveLink ? form.accent : T.txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", flexShrink: 0 }} />
                <input
                  value={form.driveLink} onChange={e => set("driveLink", e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ ...inputStyle("driveLink"), paddingLeft: 34, borderColor: form.driveLink ? form.accent + "50" : T.border }}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=form.driveLink?form.accent+"50":T.border}
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
                background: `linear-gradient(135deg, ${form.accent}15 0%, #020406 100%)`,
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
          <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: "13px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 13, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: "13px", borderRadius: 10, border: "none",
              background: canSave ? `linear-gradient(135deg, ${form.accent} 0%, ${form.accent}CC 100%)` : T.glass,
              color: canSave ? "#060A11" : T.txt3,
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

const LandingPages = ({ T = P }) => {
  const isLight = T !== P;
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

  const statusColors = { Generada: T.blue, Enviada: T.emerald, Vista: T.accent, Expirada: T.rose };

  // ─── Step 0: Lista de Landing Pages ───
  if (step === 0) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 21, fontWeight: 400, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
            Marketing <span style={{ fontWeight: 300, color: isLight ? T.txt3 : "rgba(255,255,255,0.4)" }}>Studio</span>
          </p>
          <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, marginTop: 4 }}>Crea campañas y presentaciones de propiedades con IA en un clic</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowNewPropModal(true)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "11px 18px",
            borderRadius: 11, border: `1px solid ${T.accent}40`, background: T.accentS,
            cursor: "pointer", color: T.accent, fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
            transition: "all 0.22s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = T.accentB; e.currentTarget.style.borderColor = T.accent + "70"; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.accentS; e.currentTarget.style.borderColor = T.accent + "40"; }}
          >
            <Plus size={15} /> Registrar propiedad
          </button>
          <button onClick={() => setStep(1)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 22px",
            borderRadius: 11, border: isLight ? "none" : "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? (T.accentDark || T.accent) : "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? T.accent : "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={15} /> Nueva Landing Page
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Pages Generadas" value={savedPages.length} sub="total" icon={Globe} color={T.blue} T={T} />
        <KPI label="Propiedades en catálogo" value={rivieraProperties.length + customProperties.length} sub={`${customProperties.length} registradas`} icon={Building2} color={T.emerald} T={T} />
        <KPI label="Tasa de Apertura" value="87%" sub="+12%" icon={Eye} color={T.accent} T={T} />
        <KPI label="Conversión a Zoom" value="34%" sub="+8pp" icon={Target} color={T.violet} T={T} />
      </div>

      {/* Landing Pages Recientes */}
      <G np T={T}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Campañas Recientes</p>
          <Pill color={T.accent} s isLight={isLight}>{savedPages.length} páginas</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Cliente</span><span>Fecha</span><span>Props.</span><span>Presupuesto</span><span>Status</span><span>Asesor</span><span>Acciones</span>
        </div>
        {savedPages.map(pg => (
          <div key={pg.id} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr",
            gap: 10, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${T.border}`,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ico icon={User} sz={30} is={13} c={T.accent} />
              <span style={{ fontSize: 13, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{pg.client}</span>
            </div>
            <span style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>{pg.date}</span>
            <span style={{ fontSize: 12, color: T.txt, fontWeight: 500, fontFamily: fontDisp }}>{pg.props}</span>
            <span style={{ fontSize: 11, color: T.emerald, fontWeight: 600, fontFamily: fontDisp }}>{pg.budget}</span>
            <Pill color={statusColors[pg.status] || T.txt3} s isLight={isLight}>{pg.status}</Pill>
            <span style={{ fontSize: 11, color: T.txt2, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pg.asesor?.split(" ")[0] || "—"}</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => { setClientName(pg.client); setSelectedProps(pg.propIds || allProperties.slice(0, pg.props).map(p => p.id)); setPreviewOpen(true); }} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Eye size={11} color={T.txt2} /></button>
              <button onClick={handleCopyLink} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}>{copied ? <Check size={11} color={T.accent} /> : <Copy size={11} color={T.txt2} />}</button>
              <button style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Share2 size={11} color={T.txt2} /></button>
            </div>
          </div>
        ))}
      </G>

      {/* Catálogo de Propiedades */}
      <G np T={T}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: showCatalogSection ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
          onClick={() => setShowCatalogSection(s => !s)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ico icon={Building2} sz={30} is={14} c={T.emerald} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Catálogo de Propiedades</p>
              <p style={{ fontSize: 11, color: T.txt3, marginTop: 1 }}>
                {rivieraProperties.length} predeterminadas · <span style={{ color: customProperties.length > 0 ? T.accent : T.txt3 }}>{customProperties.length} registradas por el equipo</span>
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); setShowNewPropModal(true); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, border: `1px solid ${T.accent}40`, background: T.accentS,
              cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = T.accentB; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accentS; }}
            >
              <Plus size={13} /> Registrar nueva
            </button>
            <div style={{ color: T.txt3, transition: "transform 0.2s", transform: showCatalogSection ? "rotate(180deg)" : "none" }}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {showCatalogSection && (
          <div style={{ padding: "16px 20px" }}>
            {/* Custom properties */}
            {customProperties.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                  Registradas por el equipo ({customProperties.length})
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {customProperties.map(prop => (
                    <div key={prop.id} style={{
                      borderRadius: 12, overflow: "hidden",
                      background: isLight ? `${prop.accent}08` : `linear-gradient(135deg, ${prop.accent}12 0%, #020406 100%)`,
                      border: `1px solid ${prop.accent}25`,
                    }}>
                      {/* Card header */}
                      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${prop.accent}20`, border: `1px solid ${prop.accent}30`, color: prop.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{prop.badge}</span>
                            <span style={{ fontSize: 9, color: T.txt3, fontFamily: font }}>{prop.location}</span>
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                          {prop.brand && <p style={{ fontSize: 11, color: T.txt3 }}>{prop.brand}</p>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                          <p style={{ fontSize: 10, color: T.txt3 }}>ROI {prop.roi}</p>
                        </div>
                      </div>
                      {/* Drive link status */}
                      <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <ExternalLink size={11} color={driveLinks[prop.id] || prop.driveLink ? prop.accent : T.txt3} />
                          <span style={{ fontSize: 10, color: driveLinks[prop.id] || prop.driveLink ? prop.accent : T.txt3 }}>
                            {driveLinks[prop.id] || prop.driveLink ? "Galería configurada" : "Sin galería"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => { setEditingProp(prop); setShowNewPropModal(true); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 10, fontFamily: font, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = T.txt; e.currentTarget.style.borderColor = T.borderH; }}
                            onMouseLeave={e => { e.currentTarget.style.color = T.txt2; e.currentTarget.style.borderColor = T.border; }}
                          >
                            <FileText size={10} /> Editar
                          </button>
                          <button onClick={() => { if (window.confirm(`¿Eliminar "${prop.name}" del catálogo?`)) deleteCustomProp(prop.id); }} style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.rose, fontSize: 10, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${T.rose}18`; e.currentTarget.style.borderColor = T.rose + "40"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.borderColor = T.border; }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      {prop.createdAt && (
                        <div style={{ padding: "4px 16px 8px", fontSize: 9, color: T.txt3, fontFamily: font }}>
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
              <p style={{ fontSize: 11, color: T.txt2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
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
                        <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                        <p style={{ fontSize: 10, color: T.txt3 }}>{prop.location} · ${(prop.priceFrom/1000).toFixed(0)}K–${(prop.priceTo/1000).toFixed(0)}K · ROI {prop.roi}</p>
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
                              style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, background: T.glass, border: `1px solid ${T.accent}50`, color: T.txt, fontFamily: font, outline: "none", width: 180 }}
                            />
                            <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: T.accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>OK</button>
                            <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "4px 6px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt3 }}><X size={10} /></button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {dl && <a href={dl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 6, border: `1px solid ${prop.accent}40`, background: `${prop.accent}10`, color: prop.accent, fontSize: 10, fontWeight: 700, textDecoration: "none" }}><Image size={10} /> Galería</a>}
                            <button onClick={e => { e.stopPropagation(); startEditLink(prop.id, dl, e); }} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 10, fontFamily: font }}>
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
                <p style={{ fontSize: 13, color: T.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Aún no has registrado propiedades personalizadas</p>
                <p style={{ fontSize: 11, color: T.txt3, marginBottom: 16 }}>Registra desarrollos adicionales para incluirlos en tus landing pages</p>
                <button onClick={() => setShowNewPropModal(true)} style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  borderRadius: 10, border: `1px solid ${T.accent}40`, background: T.accentS,
                  cursor: "pointer", color: T.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
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
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={TrendingUp} sz={32} is={15} c={T.emerald} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Mercado Riviera Maya</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Precio promedio", v: marketData.avgPriceM2 },
              { l: "Crecimiento anual", v: marketData.yearGrowth },
              { l: "Plusvalía real", v: marketData.realGrowth },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={DollarSign} sz={32} is={15} c={T.accent} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Rendimientos</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "ROI por rentas", v: marketData.rentalROI },
              { l: "Plusvalía capital", v: marketData.capitalAppreciation },
              { l: "Ocupación promedio", v: marketData.occupancy },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={Shield} sz={32} is={15} c={T.blue} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Para Inversionistas</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Propiedad extranjera", v: "100% legal" },
              { l: "Impuesto predial", v: "Mínimo" },
              { l: "Aeropuerto Tulum", v: "Nuevo" },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: fontDisp }}>{x.v}</span>
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
          T={T}
        />
      )}
    </div>
  );

  // ─── Step 1: Datos del Cliente ───
  if (step === 1) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setStep(0)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp }}>Crear Landing Page</p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Paso 1 de 2 — Información del cliente</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}40` }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.border }} />
      </div>

      <G T={T}>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16, fontFamily: fontDisp }}>Datos del Cliente</p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Nombre del cliente</label>
          <input
            type="text" value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="Ej: Familia Rodríguez, James Mitchell..."
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 14,
              background: T.glass, border: `1px solid ${T.border}`, color: T.txt,
              fontFamily: font, outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = T.accent + "60"}
            onBlur={e => e.target.style.borderColor = T.border}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
            <Building2 size={11} color={T.accent} /> Nombre de la agencia / bróker
          </label>
          <input
            type="text" value={agencyName}
            onChange={e => { setAgencyName(e.target.value); localStorage.setItem("stratos_agency_name", e.target.value); }}
            placeholder="Ej: STRATOS REALTY, Inmobiliaria Azul, RE/MAX Elite…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${T.accentB}`, color: T.txt, fontFamily: font, outline: "none" }}
            onFocus={e => e.target.style.borderColor = T.accent + "60"}
            onBlur={e => e.target.style.borderColor = T.accentB}
          />
          <p style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>Aparece en el encabezado de la landing page del cliente. Se guarda automáticamente.</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Asesor asignado</label>
          <select value={asesor} onChange={e => setAsesor(e.target.value)} style={{
            width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 13,
            background: T.surface || T.glass, border: `1px solid ${T.border}`, color: T.txt,
            fontFamily: font, cursor: "pointer",
          }}>
            {team.map(t => <option key={t.n} value={t.n}>{t.n} — {t.r}</option>)}
          </select>
        </div>

        {/* Asesor contact info */}
        <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <Phone size={11} color={T.emerald} /> WhatsApp del asesor
            </label>
            <input
              type="text" value={asesorWA} onChange={e => setAsesorWA(e.target.value)}
              placeholder="+52 998 000 0000"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${asesorWA ? T.emerald + "50" : T.border}`, color: T.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = T.emerald + "70"}
              onBlur={e => e.target.style.borderColor = asesorWA ? T.emerald + "50" : T.border}
            />
            {asesorWA && (
              <a href={`https://wa.me/${asesorWA.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.emerald, marginTop: 4, display: "inline-block" }}>
                Verificar número →
              </a>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <CalendarDays size={11} color={T.blue} /> Link de agenda (Calendly, Cal.com…)
            </label>
            <input
              type="text" value={asesorCal} onChange={e => setAsesorCal(e.target.value)}
              placeholder="https://calendly.com/..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${asesorCal ? T.blue + "50" : T.border}`, color: T.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = T.blue + "70"}
              onBlur={e => e.target.style.borderColor = asesorCal ? T.blue + "50" : T.border}
            />
            {asesorCal && (
              <a href={asesorCal} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.blue, marginTop: 4, display: "inline-block" }}>
                Verificar link →
              </a>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Rango de presupuesto</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: T.txt3, marginBottom: 4 }}>Desde</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(0, 5).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMin(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMin === b.value ? T.accent + "60" : T.border}`,
                    background: clientBudgetMin === b.value ? T.accentS : T.glass,
                    color: clientBudgetMin === b.value ? T.accent : T.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
            <div style={{ color: T.txt3, fontSize: 14 }}>—</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: T.txt3, marginBottom: 4 }}>Hasta</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(2).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMax(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMax === b.value ? T.accent + "60" : T.border}`,
                    background: clientBudgetMax === b.value ? T.accentS : T.glass,
                    color: clientBudgetMax === b.value ? T.accent : T.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Preferencias del cliente</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {prefOptions.map(pref => {
              const active = clientPrefs[pref.key];
              return (
                <button key={pref.key} onClick={() => setClientPrefs(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "14px 8px", borderRadius: 10,
                  border: `1px solid ${active ? T.accent + "50" : T.border}`,
                  background: active ? T.accentS : T.glass,
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <pref.icon size={18} color={active ? T.accent : T.txt3} />
                  <span style={{ fontSize: 10, color: active ? T.accent : T.txt2, fontWeight: 600, fontFamily: font, textAlign: "center" }}>{pref.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <WriterSection value={mensaje} onChange={setMensaje} clientName={clientName} T={T} />
      </G>

      <button onClick={() => setStep(2)} disabled={!clientName.trim()} style={{
        padding: "14px 28px", borderRadius: 12, border: "none", cursor: clientName.trim() ? "pointer" : "not-allowed",
        background: clientName.trim() ? (isLight ? T.accent : "rgba(255,255,255,0.95)") : T.glass,
        color: clientName.trim() ? (isLight ? "#FFFFFF" : "#0A0F18") : T.txt3,
        fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
        boxShadow: clientName.trim() ? (isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)") : "none",
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
        <button onClick={() => setStep(1)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp }}>Seleccionar Propiedades</p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Paso 2 de 2 — Landing page para <span style={{ color: T.accent, fontWeight: 600 }}>{clientName}</span> · Presupuesto: <span style={{ color: T.emerald, fontWeight: 600 }}>${(clientBudgetMin / 1000).toFixed(0)}K – ${(clientBudgetMax / 1000).toFixed(0)}K</span></p>
        </div>
        {selectedProps.length > 0 && (
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 22px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? (T.accentDark || T.accent) : "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? T.accent : "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={16} /> Generar Landing Page ({selectedProps.length})
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}40` }} />
      </div>

      {/* Toolbar: hint + register button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image size={14} color={T.txt3} />
          <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Haz clic para seleccionar · </span>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, fontFamily: font }}>{filteredProperties.filter(inBudget).length} en presupuesto</span>
          <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>· {filteredProperties.length} totales</span>
        </div>
        <button
          onClick={() => setShowNewPropModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: `1px solid ${T.accent}40`, background: T.accentS,
            cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
            transition: "all 0.2s", whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.accentB; e.currentTarget.style.borderColor = T.accent + "80"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.accentS; e.currentTarget.style.borderColor = T.accent + "40"; }}
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
              border: `2px solid ${selected ? prop.accent + "80" : T.border}`,
              background: T.glass, transition: "all 0.3s",
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
                    <Pill color={prop.accent} s isLight={isLight}>{prop.type}</Pill>
                    <Pill color={T.emerald} s isLight={isLight}>ROI {prop.roi}</Pill>
                    <Pill color={T.txt2} s isLight={isLight}>{prop.bedrooms}</Pill>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: `${prop.accent}0A`, border: `1px solid ${prop.accent}18` }}>
                      <p style={{ fontSize: 9, color: T.txt3, marginBottom: 2 }}>Desde</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 9, color: T.txt3, marginBottom: 2 }}>Hasta</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>${(prop.priceTo / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{prop.description}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                    {prop.highlights.slice(0, 3).map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: `${prop.accent}18`, border: `1px solid ${prop.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <CheckCircle2 size={8} color={prop.accent} />
                        </div>
                        <span style={{ fontSize: 10, color: T.txt2, fontFamily: font, lineHeight: 1.3 }}>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── Drive Link Bar ─── */}
              <div onClick={e => e.stopPropagation()} style={{
                borderTop: `1px solid ${T.border}`,
                padding: "10px 14px",
                background: isLight ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.2)",
                borderRadius: "0 0 14px 14px",
              }}>
                {isEditingThis ? (
                  /* Edit mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ExternalLink size={13} color={T.txt3} style={{ flexShrink: 0 }} />
                    <input
                      autoFocus
                      value={editLinkValue}
                      onChange={e => setEditLinkValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDriveLink(prop.id); if (e.key === "Escape") { setEditingLinkId(null); setEditLinkValue(""); } }}
                      placeholder="Pega aquí el link de Google Drive..."
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 11,
                        background: T.glass, border: `1px solid ${T.accent}50`, color: T.txt,
                        fontFamily: font, outline: "none",
                      }}
                    />
                    <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: T.accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, whiteSpace: "nowrap" }}>
                      Guardar
                    </button>
                    <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt3 }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  /* View mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <ExternalLink size={12} color={driveLink ? T.accent : T.txt3} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 11, color: driveLink ? T.accent : T.txt3, fontFamily: font,
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
                          borderRadius: 7, border: `1px solid ${T.border}`,
                          background: T.glass, color: T.txt3, cursor: "pointer",
                          fontSize: 11, fontFamily: font, transition: "all 0.2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.color = T.txt; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
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
        <G T={T} style={{ textAlign: "center", padding: 40 }}>
          <Building2 size={40} color={T.txt3} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, color: T.txt2, fontFamily: fontDisp }}>No hay propiedades en este rango de presupuesto</p>
          <p style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>Ajusta el rango en el paso anterior</p>
          <button onClick={() => setShowNewPropModal(true)} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 10, border: `1px solid ${T.accent}40`, background: T.accentS, color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
            <Plus size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />Registrar propiedad nueva
          </button>
        </G>
      )}

      {selectedProps.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, padding: "14px 20px",
          background: isLight ? "rgba(255,255,255,0.98)" : "rgba(6,10,17,0.95)", backdropFilter: "blur(16px)",
          borderRadius: 14, border: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: isLight ? T.shadow2 || "0 -4px 20px rgba(15,23,42,0.10)" : "0 -8px 32px rgba(0,0,0,0.4)",
        }}>
          <div>
            <p style={{ fontSize: 13, color: T.txt, fontWeight: 600 }}>{selectedProps.length} propiedad{selectedProps.length > 1 ? "es" : ""} seleccionada{selectedProps.length > 1 ? "s" : ""}</p>
            <p style={{ fontSize: 11, color: T.txt3 }}>para {clientName}</p>
          </div>
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 28px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
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
          T={T}
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
            background: "#111318", border: `1px solid ${P.border}`,
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti:\n${demoShareUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                      borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                      color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                      transition: "all 0.2s",
                    }}
                  >
                    <Phone size={16} /> Abrir WhatsApp con cliente
                  </a>
                  <button onClick={() => {
                    const waMsg = `Hola ${client || "estimado cliente"} 🏡\n\nPrepare una presentación exclusiva con propiedades seleccionadas especialmente para ti.\n\nVe las propiedades aquí:\n${demoShareUrl}\n\n¿Cuándo te viene bien una llamada para revisarlas juntos?`;
                    navigator.clipboard.writeText(waMsg).then(() => onCopyLink()).catch(() => {});
                  }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                    borderRadius: 9, background: P.glass, border: `1px solid ${P.border}`,
                    color: P.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                  >
                    <Copy size={13} /> Copiar mensaje completo para WhatsApp
                  </button>
                </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, animation: "fadeInUp 0.6s ease both" }}>
              <StratosAtom size={24} color={currentProp.accent} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 400, fontFamily: fontDisp, letterSpacing: "0.1em" }}>{agencyName}</span>
            </div>

            {/* Personalized greeting */}
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontFamily: font, marginBottom: 8, fontWeight: 400, animation: "fadeInUp 0.65s 0.08s ease both" }}>
              Preparado exclusivamente para
            </p>
            <h1 style={{ fontSize: 52, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, animation: "floatSoft 5s 0.3s ease-in-out infinite, fadeInUp 0.7s 0.15s ease both" }}>
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

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", animation: "fadeInUp 0.7s 0.25s ease both" }}>
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
                animation: `scaleIn 0.55s ${idx * 0.1}s ease both`,
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
const FinanzasAdmin = () => {
  const [tab, setTab] = useState("panel");
  const [cfdiFilter, setCfdiFilter] = useState("todos");
  const [showNewCFDI, setShowNewCFDI] = useState(false);
  const [cxTab, setCxTab] = useState("cobrar");
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

  const totalIngresos = cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.total, 0);
  const totalIVA = cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.iva, 0);
  const totalCXC = cxcData.filter(c => c.status !== "Pagada").reduce((s, c) => s + c.monto, 0);
  const cxcVencidas = cxcData.filter(c => c.status === "Vencida").reduce((s, c) => s + c.monto, 0);
  const totalCXP = cxpData.filter(c => c.status === "Pendiente").reduce((s, c) => s + c.monto, 0);
  const isrProvisional = Math.round(totalIngresos * 0.30 * 0.17); // 30% base × 17% coeficiente simplificado

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
          background: "#111318", border: `1px solid ${P.border}`, borderRadius: 22,
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
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                      <div>
                        <h3 style={{ margin:0, fontSize:15, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.03em", color:T.txt }}>Acciones del Equipo</h3>
                        <p style={{ margin:"3px 0 0", fontSize:11, color:T.txt3, fontFamily:font }}>
                          {metaActions.filter(a=>!a.done).length} pendientes · {metaActions.filter(a=>a.done).length} completadas
                          <span style={{ marginLeft:8, opacity:0.45, fontSize:10 }}>· Arrastra para reordenar</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setMetaActions(p => [...p, { id: Date.now(), text:"Nueva acción", lead:"General", asesor:"Equipo", date:"Esta semana", done:false, priority:"normal", assignee:"", assigneeType:"human" }])}
                        style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 15px", borderRadius:9, background:`${T.accent}12`, border:`1px solid ${T.accent}25`, color: isLight?"#082818":T.accent, fontSize:12, fontWeight:600, fontFamily:font, cursor:"pointer" }}>
                        <Plus size={13} strokeWidth={2.5} /> Nueva acción
                      </button>
                    </div>

                    {/* Flat drag-and-drop list — tasks stay in place when checked */}
                    {metaActions.map(a => {
                      const isUrgent = !a.done && (a.priority==="urgente" || a.date?.toLowerCase().includes("hoy"));
                      const isHigh   = !a.done && !isUrgent && (a.priority==="alto" || a.date?.toLowerCase().includes("mañana") || a.date?.toLowerCase().includes("semana"));
                      const prioColor = a.done ? T.accent : isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : T.txt3;
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
                            background: a.done
                              ? (isLight?"rgba(52,211,153,0.04)":"rgba(52,211,153,0.03)")
                              : isUrgent
                                ? (isLight?"rgba(239,68,68,0.03)":"rgba(239,68,68,0.04)")
                                : (isLight?"#FFFFFF":"rgba(255,255,255,0.03)"),
                            border:`1px solid ${a.done
                              ? (isLight?"rgba(52,211,153,0.18)":"rgba(52,211,153,0.10)")
                              : isUrgent ? "rgba(239,68,68,0.18)" : T.border}`,
                            transition:"background 0.15s, border 0.15s",
                            opacity: a.done ? 0.65 : 1,
                          }}
                        >
                          {/* Drag handle */}
                          <GripVertical size={13} color={T.txt3} style={{ cursor:"grab", flexShrink:0, marginTop:4, opacity:0.30 }} />

                          {/* Checkbox */}
                          <button
                            onClick={() => setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:!x.done} : x))}
                            style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${a.done?T.accent:T.border}`, background:a.done?T.accent:"transparent", cursor:"pointer", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                            {a.done && <Check size={10} strokeWidth={3} color="#041016" />}
                          </button>

                          {/* Content */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <E
                              val={a.text}
                              onSave={v => setMetaActions(p => p.map(x => x.id===a.id ? {...x,text:v} : x))}
                              style={{ fontSize:12.5, fontWeight:500, color:a.done?T.txt3:T.txt, fontFamily:font, textDecoration:a.done?"line-through":"none", lineHeight:1.4, marginBottom:3 }}
                            />
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                              <E val={a.lead}   onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,lead:v}:x))}   style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                              <span style={{ fontSize:8.5, color:T.txt3, opacity:0.4 }}>·</span>
                              <E val={a.asesor} onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,asesor:v}:x))} style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                            </div>
                            {/* Assignee row */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              {/* Human team assignee selector */}
                              <select
                                value={a.assignee || ""}
                                onChange={e => setMetaActions(p => p.map(x => x.id===a.id ? {...x, assignee:e.target.value, assigneeType:"human"} : x))}
                                style={{
                                  fontSize:9.5, fontFamily:font, fontWeight:500,
                                  color: a.assignee ? T.txt2 : T.txt3,
                                  background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                                  border:`1px solid ${a.assignee ? T.accentB : T.border}`,
                                  borderRadius:6, padding:"2px 6px",
                                  cursor:"pointer", outline:"none", maxWidth:130,
                                }}
                              >
                                <option value="">＋ Responsable</option>
                                <optgroup label="── Equipo Humano">
                                  {["Oscar Gálvez","Alexia Santillán","Alex Velázquez","Ken Lugo","Emmanuel Ortiz","Araceli Oneto","Cecilia Mendoza","Estefanía Valdes"].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </optgroup>
                              </select>
                              {/* iAgent button — disabled, próximamente */}
                              <button
                                disabled
                                title="Próximamente — Asignación directa a iAgents IA"
                                style={{
                                  display:"flex", alignItems:"center", gap:3,
                                  padding:"2px 7px", borderRadius:6,
                                  border:`1px solid ${T.blue}28`,
                                  background:`${T.blue}07`,
                                  color:T.blue, fontSize:9, fontFamily:font, fontWeight:600,
                                  cursor:"not-allowed", opacity:0.38, letterSpacing:"0.01em",
                                }}
                              >
                                <Atom size={9} />iAgent IA
                              </button>
                            </div>
                          </div>

                          {/* Date + action buttons */}
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                            <E
                              val={a.date || "—"}
                              onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,date:v}:x))}
                              style={{ fontSize:10, fontWeight:600, fontFamily:fontDisp, color:prioColor, background:`${prioColor}15`, border:`1px solid ${prioColor}28`, padding:"2px 8px", borderRadius:99, whiteSpace:"nowrap", cursor:"text" }}
                            />
                            <div style={{ display:"flex", gap:2 }}>
                              {a.done && (
                                <button
                                  onClick={() => setMetaActions(p => { const arr=p.filter(x=>x.id!==a.id); return [...arr, a]; })}
                                  title="Enviar al fondo"
                                  style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.35, display:"flex", alignItems:"center" }}>
                                  <ChevronsDown size={11} color={T.txt3} />
                                </button>
                              )}
                              <button onClick={() => setMetaActions(p => p.filter(x => x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.28, display:"flex", alignItems:"center" }}>
                                <Minus size={11} color={T.txt3} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {metaActions.length === 0 && (
                      <div style={{ textAlign:"center", padding:"40px 0", color:T.txt3, fontSize:12, fontFamily:font, opacity:0.5 }}>
                        Sin acciones pendientes · Agrega la primera
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
