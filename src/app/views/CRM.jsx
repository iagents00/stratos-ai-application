import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  TrendingUp, Target, CheckCircle2, Mic, Search,
  Users, Building2, Send, Plus, Timer, Flame,
  Trophy, User, DollarSign, Zap, Phone,
  CalendarDays, FileText, ChevronRight, ChevronLeft,
  Settings, X, Atom, Signal,
  Activity, Clock, Eye, MessageCircle,
  Star, Waypoints, Shield, Aperture, Focus, Locate, Scan,
  AlertCircle, TrendingDown,
  LayoutGrid, CheckSquare,
  Globe, Wand2, Image,
  Download, ExternalLink, Copy, Check, Trash2,
  ChevronDown, ChevronUp, Heart, Share2, Maximize2,
  FilePlus, RefreshCw, BadgeCheck, ListChecks,
  UserCheck, List, SlidersHorizontal, Mail,
  Pencil, Save, Minus, GripVertical, ChevronsDown
} from "lucide-react";
import { P, LP, font, fontDisp, STAGES as STAGES_TOKENS } from "../../design-system/tokens";
import { G, KPI, Pill, Ico, ChipSelect } from "../SharedComponents";


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

/* ─── IAOS Score Engine — calcula el score real de un lead basado en:
   stage (0-35pts), presupuesto (0-25pts), seguimientos (0-15pts),
   completitud BANT (0-15pts), inactividad (hasta -15pts), hot (+10pts).
   Reemplaza el sc:40 estático — se recalcula en cada updateLead y al crear. ─── */
const calculateLeadScore = (lead) => {
  let score = 0;

  // 1. Stage progression — 0 a 35 pts
  const stages = ["Nuevo Registro","Primer Contacto","Seguimiento","Zoom Agendado",
    "Zoom Concretado","Visita Agendada","Visita Concretada","Negociación","Cierre","Perdido"];
  const stageIdx = stages.indexOf(lead.st ?? "Nuevo Registro");
  // Excluir "Perdido" del score positivo
  if (stageIdx >= 0 && lead.st !== "Perdido") {
    score += Math.round((stageIdx / 8) * 35);
  }

  // 2. Presupuesto — 0 a 25 pts
  const budget = lead.presupuesto || parseBudget(lead.budget) || 0;
  if      (budget >= 2_000_000) score += 25;
  else if (budget >= 1_000_000) score += 20;
  else if (budget >= 500_000)   score += 15;
  else if (budget >= 200_000)   score += 10;
  else if (budget >= 50_000)    score += 5;
  else if (budget > 0)          score += 2;

  // 3. Seguimientos activos — 0 a 15 pts
  const fu = lead.seguimientos || 0;
  if      (fu >= 6) score += 15;
  else if (fu >= 4) score += 11;
  else if (fu >= 2) score += 7;
  else if (fu >= 1) score += 4;

  // 4. BANT completitud — 0 a 15 pts (3.75 pts por criterio)
  let bant = 0;
  if (budget > 0)                                                bant++; // Budget
  if (lead.asesor && lead.asesor.trim())                         bant++; // Authority
  if (lead.bio && lead.bio.length > 40)                         bant++; // Need
  if (lead.nextActionDate && lead.nextActionDate !== "Por definir") bant++; // Timeline
  score += Math.round(bant * 3.75);

  // 5. Inactividad — penalización hasta -15 pts
  const inactive = lead.daysInactive || 0;
  if      (inactive >= 21) score -= 15;
  else if (inactive >= 14) score -= 12;
  else if (inactive >= 7)  score -= 8;
  else if (inactive >= 4)  score -= 4;

  // 6. HOT bonus — +10 pts
  if (lead.hot) score += 10;

  // "Perdido" — cap en 15
  if (lead.st === "Perdido") score = Math.min(score, 15);

  return Math.max(0, Math.min(100, Math.round(score)));
};

const StratosAtom = ({ size = 20, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="1.1" opacity="0.18" />
    <circle cx="16" cy="16" r="9"  stroke={color} strokeWidth="1.2" opacity="0.38" />
    <circle cx="16" cy="16" r="4.5" stroke={color} strokeWidth="1.25" opacity="0.68" />
    <circle cx="16" cy="16" r="1.6" fill={color} />
  </svg>
);

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

const SRC_META = {
  telegram: { label: "TG",        color: "#29B6F6" },
  whatsapp:  { label: "WA",        color: "#25D366" },
  facebook:  { label: "FB",        color: "#7EB8F0" },
  web:       { label: "Web",       color: "#A78BFA" },
  manual:    { label: null,        color: null      },
};
const SourceBadge = ({ source, isLight }) => {
  const meta = SRC_META[source] || null;
  if (!meta || !meta.label) return null;
  const c = isLight ? `color-mix(in srgb, ${meta.color} 60%, #0B1220 40%)` : meta.color;
  return (
    <span style={{
      fontSize: 8, fontWeight: 800, letterSpacing: "0.06em",
      color: c, background: isLight ? `${meta.color}15` : `${meta.color}18`,
      border: `1px solid ${isLight ? `${meta.color}38` : `${meta.color}30`}`,
      padding: "1px 6px", borderRadius: 99,
      fontFamily: "-apple-system, sans-serif", flexShrink: 0,
    }}>{meta.label}</span>
  );
};

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
              <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: isLight ? `color-mix(in srgb, ${T.accent} 55%, #0B1220 45%)` : T.accent, opacity: 0.7, transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {[{d:-5,l:"−"},{d:5,l:"+"}].map(({d,l},i) => i === 0 ? (
                <button key={d} onClick={() => onUpdate?.({...lead, sc: Math.max(0, sc + d)})} title={`${d} puntos`} style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisp, lineHeight: 1, padding: 0, transition: "all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background=T.glassH;e.currentTarget.style.color=T.txt;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.txt3;}}>{l}</button>
              ) : null)}
              <span style={{ fontSize: 11, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, whiteSpace: "nowrap", minWidth: 44, textAlign: "center" }}>Score {sc}</span>
              {[{d:-5,l:"−"},{d:5,l:"+"}].map(({d,l},i) => i === 1 ? (
                <button key={d} onClick={() => onUpdate?.({...lead, sc: Math.min(100, sc + d)})} title={`+${d} puntos`} style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisp, lineHeight: 1, padding: 0, transition: "all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background=T.glassH;e.currentTarget.style.color=T.txt;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.txt3;}}>{l}</button>
              ) : null)}
            </div>
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

  // ── BANT completitud (Protocolo Duke del Caribe) ──
  const bantBudget   = (lead.presupuesto || parseBudget(lead.budget)) > 0;
  const bantAuthority = !!(lead.asesor?.trim());
  const bantNeed     = !!(lead.bio && lead.bio.length > 40);
  const bantTimeline = !!(lead.nextActionDate && lead.nextActionDate !== "Por definir");
  const bantScore    = [bantBudget, bantAuthority, bantNeed, bantTimeline].filter(Boolean).length;
  const bantPct      = Math.round((bantScore / 4) * 100);

  // ── Próximas acciones — alineadas con Protocolo Duke del Caribe ──
  const nextActions = [];

  // HOT lead — máxima prioridad, primer aviso
  if (hot) {
    nextActions.push({
      priority: "HOT", color: "#34D399", icon: Zap,
      title: "Lead caliente — actuar en las próximas horas",
      detail: "Protocolo Duke: lead con señales de compra activa. Contacto directo del director o asesor senior, NO delegar. Proponer visita o reserva simbólica hoy.",
      eta: "Hoy · inmediato",
    });
  }

  // SLA primer contacto — ≤ 5 min (Protocolo Duke del Caribe)
  if (lead.st === "Nuevo Registro" || lead.isNew) {
    nextActions.push({
      priority: "SLA", color: T.accent, icon: Timer,
      title: "Primer contacto — regla de los 5 minutos",
      detail: "Protocolo Duke del Caribe: contactar dentro de 5 minutos de registro aumenta 9× la probabilidad de calificación exitosa. Usa WhatsApp + llamada si no responde.",
      eta: "< 5 min",
    });
  }

  // Inactividad crítica (> 7 días)
  if (inactive >= 7) {
    nextActions.push({
      priority: "CRÍTICA", color: T.rose, icon: AlertCircle,
      title: `Reactivación urgente — ${inactive}d sin contacto`,
      detail: `Protocolo Duke: a partir de 7 días sin contacto el lead enfría 60%. Mensaje personalizado de WhatsApp: usa un dato específico del cliente para reabrir (proyecto, fecha que mencionó, avance de obra).`,
      eta: "Hoy · 2h",
    });
  } else if (inactive >= 3) {
    nextActions.push({
      priority: "ALTA", color: T.amber, icon: Clock,
      title: `Seguimiento de valor — ${inactive}d sin contacto`,
      detail: "Protocolo Duke — Fase Seguimiento: no contactes solo para 'dar seguimiento'. Lleva algo: update de precios, caso de éxito similar, disponibilidad de unidades. Que cada touchpoint aporte valor real.",
      eta: "Hoy",
    });
  }

  // Zoom agendado — preparar briefing
  if (lead.st === "Zoom Agendado") {
    nextActions.push({
      priority: "ALTA", color: T.blue, icon: CalendarDays,
      title: "Preparar briefing de Zoom (Protocolo Duke)",
      detail: "Genera dossier antes del Zoom: perfil del cliente, objeciones previstas, 2–3 proyectos alineados al presupuesto declarado. Confirma 24h y 1h antes por WhatsApp con el orden del día.",
      eta: "Antes del Zoom",
    });
  }

  // Zoom concretado — propuesta en 24h (Protocolo Duke)
  if (lead.st === "Zoom Concretado") {
    nextActions.push({
      priority: "ALTA", color: "#4ADE80", icon: FileText,
      title: "Enviar propuesta en las próximas 24h",
      detail: "Protocolo Duke — Post-Zoom: la propuesta debe llegar antes de 24 horas. Incluye: 3 opciones de proyecto (low-mid-premium), ROI proyectado a 5 años, carta de beneficios fiscales personalizada.",
      eta: "< 24h",
    });
  }

  // Negociación — cerrar condiciones
  if (lead.st === "Negociación") {
    nextActions.push({
      priority: "CIERRE", color: "#FB923C", icon: Trophy,
      title: "Cerrar condiciones esta semana",
      detail: "Protocolo Duke — Fase Cierre: define el triángulo decisión (precio · fecha de entrega · condiciones de pago). Propone una reserva simbólica reembolsable para anclar el compromiso.",
      eta: "Esta semana",
    });
  }

  // Score alto — oportunidad de mover etapa
  if (sc >= 72 && !["Negociación","Cierre","Perdido"].includes(lead.st)) {
    nextActions.push({
      priority: "OPORTUNIDAD", color: T.violet, icon: Target,
      title: `Score ${sc} — mover a la siguiente etapa`,
      detail: `Señales de intención alta. Protocolo Duke: propón el siguiente paso tangible — visita presencial, video de obra, o reunión con el director de proyecto.`,
      eta: "Esta semana",
    });
  }

  // BANT incompleto — calificar
  if (bantScore < 3 && !["Perdido","Nuevo Registro"].includes(lead.st)) {
    nextActions.push({
      priority: "CALIFICAR", color: T.cyan, icon: ListChecks,
      title: `BANT incompleto — ${bantScore}/4 criterios`,
      detail: `Protocolo Duke: BANT debe cubrirse en el primer contacto. Faltan: ${!bantBudget?"Presupuesto ":""} ${!bantAuthority?"Autoridad decisora ":""} ${!bantNeed?"Necesidad definida ":""} ${!bantTimeline?"Timeline de decisión":""}.`,
      eta: "Próximo contacto",
    });
  }

  if (nextActions.length === 0) {
    nextActions.push({
      priority: "PRÓXIMA", color: T.accent, icon: MessageCircle,
      title: lead.nextAction || "Definir próximo touchpoint",
      detail: `Etapa ${lead.st}. Protocolo Duke: contacto de valor cada 3–4 días máximo. No dejes enfriar — usa el agente de Seguimiento IA si el asesor está saturado.`,
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
              <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                <button onClick={() => onUpdate?.({...lead, sc: Math.max(0, sc - 5)})} title="-5 puntos" style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisp, lineHeight: 1, padding: 0, transition: "all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background=T.glassH;e.currentTarget.style.color=T.txt;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.txt3;}}>−</button>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.accent, fontFamily: fontDisp, lineHeight: 1, minWidth: 28, textAlign: "center" }}>{sc}</p>
                <button onClick={() => onUpdate?.({...lead, sc: Math.min(100, sc + 5)})} title="+5 puntos" style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontDisp, lineHeight: 1, padding: 0, transition: "all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background=T.glassH;e.currentTarget.style.color=T.txt;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.txt3;}}>+</button>
              </div>
              <p style={{ margin: 0, fontSize: 8.5, color: T.txt3, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>Score · Manual</p>
            </div>
          </div>

          {/* Etiquetas rápidas */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {hot && <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accentB}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.05em" }}>HOT</span>}
            {inactive >= 7 && <span style={{ fontSize: 9, fontWeight: 700, color: T.rose, background: `${T.rose}14`, border: `1px solid ${T.rose}33`, padding: "3px 9px", borderRadius: 99 }}>{inactive}d inactivo</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99 }}>Etapa {stageIdx + 1}/{STAGES.length}</span>
            <SourceBadge source={lead.source} isLight={isLight} />
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

          {/* ── 0.5 BANT — Protocolo Duke del Caribe (calificación estructurada) ── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <ListChecks size={12} color={T.cyan} strokeWidth={2.5} />
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: T.cyan, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>Calificación BANT</p>
              <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: bantScore >= 3 ? T.accent : T.amber, background: bantScore >= 3 ? `${T.accent}12` : `${T.amber}12`, border: `1px solid ${bantScore >= 3 ? T.accentB : `${T.amber}40`}`, padding: "2px 8px", borderRadius: 99 }}>{bantPct}% completo</span>
            </div>
            {/* Barra de progreso BANT */}
            <div style={{ height: 4, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)", marginBottom: 10, overflow: "hidden" }}>
              <div style={{ width: `${bantPct}%`, height: "100%", borderRadius: 2, background: bantScore >= 4 ? `linear-gradient(90deg, ${T.accent}, #34D399)` : bantScore >= 2 ? `linear-gradient(90deg, ${T.amber}, #FCD34D)` : T.rose, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { key: "B", label: "Budget", sub: bantBudget ? (lead.budget || "Registrado") : "Sin declarar", ok: bantBudget },
                { key: "A", label: "Authority", sub: bantAuthority ? lead.asesor : "Sin asesor asignado", ok: bantAuthority },
                { key: "N", label: "Need", sub: bantNeed ? "Perfil documentado" : "Perfil incompleto", ok: bantNeed },
                { key: "T", label: "Timeline", sub: bantTimeline ? (lead.nextActionDate || "Definido") : "Sin fecha de decisión", ok: bantTimeline },
              ].map(b => (
                <div key={b.key} style={{ padding: "8px 10px", borderRadius: 9, background: b.ok ? (isLight ? `${T.accent}08` : `${T.accent}06`) : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"), border: `1px solid ${b.ok ? (isLight ? `${T.accent}44` : `${T.accent}22`) : T.border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: b.ok ? `${T.accent}1C` : "transparent", border: `1px solid ${b.ok ? T.accentB : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: b.ok ? T.accent : T.txt3, fontFamily: fontDisp, flexShrink: 0 }}>{b.key}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: b.ok ? (isLight ? T.accent : T.accent) : T.txt3, fontFamily: fontDisp }}>{b.label}</p>
                    <p style={{ margin: 0, fontSize: 9.5, color: T.txt3, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.sub}</p>
                  </div>
                </div>
              ))}
            </div>
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
  const [newLead, setNewLead]           = useState({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", source: "manual", st: "Nuevo Registro", nextAction: "", notas: "" });
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
    if (prioritySort === "manual" && priorityOrder.length === 0) {
      const snap = priorityLeadsRef.current.map(l => l.id);
      if (snap.length > 0) setPriorityOrder(snap);
    }
    // Score manual: preserva el sc actual; cada seguimiento adicional suma +3 pts
    const prev = leadsData.find(l => l.id === updated.id);
    const segDelta = (updated.seguimientos || 0) - (prev?.seguimientos || 0);
    const baseSc = updated.sc ?? prev?.sc ?? 0;
    const newSc = Math.max(0, Math.min(100, baseSc + segDelta * 1));
    const withScore = { ...updated, sc: newSc };
    setLeadsData(prev => prev.map(l => l.id === withScore.id ? withScore : l));
    if (selectedLead?.id === withScore.id) setSelectedLead(withScore);
    if (notesLead?.id === withScore.id) setNotesLead(withScore);
    if (analyzingLead?.id === withScore.id) setAnalyzingLead(withScore);
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
      id: Date.now(), ...newLead, st: newLead.st || "Nuevo Registro",
      sc: 5,
      source: newLead.source || "manual",
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
    setNewLead({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", source: "manual", st: "Nuevo Registro", nextAction: "", notas: "" });
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
              if (ia === -1 && ib === -1) return b.id - a.id;
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            })
          : arr.sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0) || b.id - a.id);
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
                          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                            <Pill color={stageColor} s isLight={isLight}>{l.st}</Pill>
                            <SourceBadge source={l.source} isLight={isLight} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily: fontDisp, letterSpacing: "-0.01em", flexShrink: 0 }}>{l.budget}</span>
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


                      {/* Score row — label · bar · number · ± ajuste manual */}
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
                        <div
                          onMouseDown={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                          onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                          draggable={false}
                          onClick={e => e.stopPropagation()}
                          style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
                        >
                          {(() => {
                            const lead = l;
                            const btnStyle = { width: 16, height: 16, borderRadius: 4, border: `1px solid ${isLight?"rgba(15,23,42,0.10)":"rgba(255,255,255,0.10)"}`, background: "transparent", color: isLight?"rgba(15,23,42,0.35)":"rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, fontFamily: fontDisp, transition: "all 0.15s" };
                            const onEnter = e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.10)"; e.currentTarget.style.color = isLight ? T.txt : "#FFF"; };
                            const onLeave = e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = isLight ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.35)"; };
                            return (<>
                              <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.max(0, sc - 1)}); }} title="-1" style={btnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>−</button>
                              <span style={{ fontSize: 11, fontWeight: 300, fontFamily: fontDisp, letterSpacing: "-0.01em", lineHeight: 1, color: isLight ? "rgba(15,23,42,0.70)" : "rgba(255,255,255,0.80)", minWidth: 22, textAlign: "center" }}>{sc}</span>
                              <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.min(100, sc + 1)}); }} title="+1" style={btnStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>+</button>
                            </>);
                          })()}
                        </div>
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

              {/* Proyecto de interés — full width para dar espacio */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  <Building2 size={9} color={T.txt3} /> Proyecto de interés
                </label>
                <ClickDropdown
                  value={newLead.p || ""}
                  onChange={(v) => {
                    setNewLead(p => ({...p, p: v}));
                    if (v && !proyectosMaster.includes(v)) setCustomProyectos(prev => [...prev, v]);
                  }}
                  options={proyectosMaster}
                  placeholder="Gobernador 28, Portofino, Torre Esmeralda, Monarca 28…"
                  label="proyecto"
                  icon={Building2}
                  createLabel="Registrar nuevo proyecto"
                  T={T} isLight={isLight}
                />
              </div>

              {/* Campaña */}
              <div>
                <label style={labelStyle}>
                  <Signal size={9} color={T.txt3} /> Campaña / Fuente
                </label>
                <ClickDropdown
                  value={newLead.campana || ""}
                  onChange={(v) => {
                    setNewLead(p => ({...p, campana: v}));
                    if (v && !campanasMaster.includes(v) && !FB_CAMPAIGNS_BASE.includes(v)) setCustomCampanas(prev => [...prev, v]);
                  }}
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

              {/* Canal de origen */}
              {(() => {
                const SOURCES = [
                  { key: "manual",    label: "Manual",    color: T.txt3   },
                  { key: "telegram",  label: "Telegram",  color: "#29B6F6" },
                  { key: "whatsapp",  label: "WhatsApp",  color: "#25D366" },
                  { key: "facebook",  label: "Facebook",  color: "#7EB8F0" },
                  { key: "web",       label: "Web",       color: T.violet  },
                ];
                return (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>
                      <Send size={9} color={T.txt3} /> Canal de origen
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SOURCES.map(({ key, label, color }) => {
                        const active = (newLead.source || "manual") === key;
                        const c = isLight ? `color-mix(in srgb, ${color} 60%, #0B1220 40%)` : color;
                        return (
                          <button key={key} type="button"
                            onClick={() => setNewLead(p => ({...p, source: key}))}
                            style={{
                              padding: "5px 13px", borderRadius: 99,
                              background: active ? (isLight ? `${color}18` : `${color}14`) : inputBg,
                              border: `1px solid ${active ? (isLight ? `${color}50` : `${color}55`) : inputBorder}`,
                              color: active ? c : T.txt3,
                              fontSize: 11, fontWeight: active ? 700 : 500,
                              cursor: "pointer", fontFamily: font,
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${color}0A` : `${color}0C`; e.currentTarget.style.borderColor = isLight ? `${color}30` : `${color}30`; e.currentTarget.style.color = c; }}}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = inputBg; e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.color = T.txt3; }}}
                          >{label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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

                        <SourceBadge source={l.source} isLight={isLight} />

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

                  {/* ═══ SCORE ═══ Solo visible en modo full — bar + número + ± manual */}
                  {!co && (
                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)", maxWidth: 36 }}>
                        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: T.accent, transition: "width 0.4s", boxShadow: sc >= 80 ? `0 0 6px ${T.accent}60` : "none" }} />
                      </div>
                      {(() => {
                        const lead = l;
                        const mbs = { width: 15, height: 15, borderRadius: 4, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, fontFamily: fontDisp, transition: "all 0.15s" };
                        const mbe = e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; };
                        const mbl = e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; };
                        return (<>
                          <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.max(0, sc - 1)}); }} title="-1" style={mbs} onMouseEnter={mbe} onMouseLeave={mbl}>−</button>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.txt2, fontFamily: fontDisp, minWidth: 20, textAlign: "center" }}>{sc}</span>
                          <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.min(100, sc + 1)}); }} title="+1" style={mbs} onMouseEnter={mbe} onMouseLeave={mbl}>+</button>
                        </>);
                      })()}
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


export default CRM;
