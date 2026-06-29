/**
 * CRM/components.jsx — Todos los sub-componentes del módulo CRM
 * Importados por CRM/index.jsx (el orquestador principal)
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useIsMobile } from "../../../hooks/useViewport";
import { supabase } from "../../../lib/supabase";
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
import { P, LP, font, fontDisp } from "../../../design-system/tokens";
import { G, KPI, Pill, Ico, ChipSelect } from "../../SharedComponents";
import { parseBudget, formatBudget, buildTelegramSummary, fmtNow, genId, nowLocalDateTime } from "../../../lib/utils";
import { zoomEventsOf } from "./zoom-metrics";
import { StratosAtom, StratosAtomHex } from "../../components/Logo";
import { AI_AGENTS, AI_AGENT_LIST } from "../../constants/agents";
// Pipeline + vocabulario activos por cliente (Duke: idéntico; Vega: su pipeline / "proyecto").
import { STAGES, stgC } from "../../constants/pipeline";
import { L } from "../../constants/labels";
import LeadNotesTimeline from "./LeadNotesTimeline";
import { getEntityHistory, fieldLabel, actionLabel } from "../../../lib/audit";
import { canTriggerIaActions } from "../../../lib/iagents-actions";
import LeadDiscoveryPanel from "./LeadDiscoveryPanel";
import LeadVoiceCalls from "./LeadVoiceCalls";
import LeadChatHistory from "./LeadChatHistory";
import CallActionButton from "./CallActionButton";
import RequiresHumanButton from "./RequiresHumanButton";
import ScheduledCallBadge from "./ScheduledCallBadge";
import { useScheduledCalls } from "../../../hooks/useScheduledCalls";

/* ─── IAOS Score Engine — calcula el score real de un lead basado en:
   stage (0-35pts), presupuesto (0-25pts), seguimientos (0-15pts),
   completitud BANT (0-15pts), inactividad (hasta -15pts), hot (+10pts).
   Reemplaza el sc:40 estático — se recalcula en cada updateLead y al crear. ─── */
const calculateLeadScore = (lead) => {
  let score = 0;

  // 1. Stage progression — 0 a 35 pts
  // Pipeline oficial Duke (12 etapas). Apartó y Cierre son los milestones más altos.
  const stages = ["Contáctame Ya","Segundo Intento","Tercer Intento","Rotación",
    "Remarketing IA","Zoom Agendado","Reactivar Zoom","Seguimiento","Largo Plazo","Apartó",
    "Visita Agendada","Cierre","Postventa"];
  const stageIdx = stages.indexOf(lead.st ?? "Contáctame Ya");
  // Excluir "Postventa" del score positivo
  if (stageIdx >= 0 && lead.st !== "Postventa") {
    score += Math.round((stageIdx / 10) * 35);
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

  // "Postventa" — cap en 15
  if (lead.st === "Postventa") score = Math.min(score, 15);

  return Math.max(0, Math.min(100, Math.round(score)));
};

const SRC_META = {
  telegram: { label: "Telegram", color: "#29B6F6" },
  whatsapp:  { label: "WhatsApp", color: "#25D366" },
  facebook:  { label: "Facebook", color: "#7EB8F0" },
  web:       { label: "Web",      color: "#A78BFA" },
  manual:    { label: null,       color: null      },
};
const SourceBadge = ({ source, isLight }) => {
  const meta = SRC_META[source] || null;
  if (!meta || !meta.label) return null;
  const c = isLight ? `color-mix(in srgb, ${meta.color} 60%, #0B1220 40%)` : meta.color;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.01em",
      color: c, background: isLight ? `${meta.color}14` : `${meta.color}16`,
      border: `1px solid ${isLight ? `${meta.color}38` : `${meta.color}30`}`,
      padding: "1px 8px", borderRadius: 99,
      fontFamily: "-apple-system, sans-serif", flexShrink: 0,
    }}>{meta.label}</span>
  );
};

/* ── ScoreInput: barra clicable + número editable inline ── */
const ScoreInput = ({ sc, onUpdate, color, isLight, T, stopProp = false, big = false, readOnly = false }) => {
  const [editSc, setEditSc] = useState(false);
  const [val, setVal] = useState("");
  const accentColor = color || (isLight ? T.accent : "rgba(255,255,255,0.85)");

  const commit = (v) => {
    const n = Math.max(0, Math.min(100, parseInt(v, 10)));
    if (!isNaN(n)) onUpdate(n);
    setEditSc(false);
  };

  const handleBarClick = (e) => {
    if (readOnly) return;
    if (stopProp) e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    onUpdate(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}
      onClick={stopProp ? e => e.stopPropagation() : undefined}
      onMouseDown={stopProp ? e => e.stopPropagation() : undefined}
      onPointerDown={stopProp ? e => e.stopPropagation() : undefined}
      draggable={false}
      onDragStart={stopProp ? e => { e.preventDefault(); e.stopPropagation(); } : undefined}
    >
      <span style={{ fontSize: 8.5, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.08em", textTransform: "uppercase", color: isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.25)", flexShrink: 0 }}>Score</span>
      <div
        onClick={handleBarClick}
        style={{ flex: 1, height: 3, borderRadius: 99, background: isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.09)", cursor: readOnly ? "default" : "ew-resize", position: "relative", overflow: "hidden" }}
      >
        <div style={{ width: `${sc}%`, height: "100%", borderRadius: 99, background: accentColor, boxShadow: `0 0 10px ${accentColor}40`, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      {!readOnly && editSc ? (
        <input
          autoFocus
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => commit(val)}
          onKeyDown={e => { if (e.key === "Enter") commit(val); if (e.key === "Escape") setEditSc(false); }}
          style={{ width: big ? 44 : 36, fontSize: big ? 16 : 13, fontWeight: 700, fontFamily: fontDisp, background: "transparent", border: `1px solid ${accentColor}60`, borderRadius: 6, color: accentColor, outline: "none", padding: "1px 4px", textAlign: "center" }}
          min={0} max={100}
        />
      ) : (
        <span
          onClick={readOnly ? undefined : e => { if (stopProp) e.stopPropagation(); setVal(String(sc)); setEditSc(true); }}
          style={{ fontSize: big ? 16 : 13, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.02em", color: accentColor, flexShrink: 0, minWidth: big ? 30 : 22, textAlign: "right", cursor: readOnly ? "default" : "text", userSelect: "none" }}
        >{sc}</span>
      )}
    </div>
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
        height: 40, borderRadius: 10,
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
                  Registrar
                </span>
              </>
            ) : (
              // Estado con registros — número + label vertical stack.
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={9} strokeWidth={1.8} color={T.txt3} style={{ opacity: 0.40, flexShrink: 0, marginTop: 1 }} />
                <span style={{
                  fontSize: 20, fontWeight: 200, fontFamily: fontDisp,
                  letterSpacing: "-0.04em", lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  color: accentSafe,
                }}>{count}</span>
              </div>
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
              ? (isLight ? `${accentC}10` : `${accentC}0E`)
              : (isLight ? `${accentC}1C` : `${accentC}16`),
            color: isEmpty ? accentSafe : accentSafe,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.18s, transform 0.18s, box-shadow 0.18s",
            flexShrink: 0,
            boxShadow: "none",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isLight ? `${accentC}22` : `${accentC}22`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isEmpty
              ? (isLight ? `${accentC}10` : `${accentC}0E`)
              : (isLight ? `${accentC}1C` : `${accentC}16`);
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
  // Si no hay nextAction pero el lead está en Zoom Agendado, sugerimos por
  // defecto "Asistir a Zoom" para que el cerrador no se confunda con qué
  // sigue. NO se persiste hasta que el asesor lo confirme manualmente
  // (markDone o edición); es solo placeholder visual.
  const zoomPending = lead.st === "Zoom Agendado" || lead.stage === "Zoom Agendado";
  const actionText = hasAction
    ? lead.nextAction
    : (zoomPending
        ? "Asistir a Zoom — preparar dossier, abrir link 5 min antes."
        : "Sin próxima acción definida. Agrega una para activar el cierre con este cliente.");
  const dateText   = lead.nextActionDate || "";
  // Fecha compacta para el chip: quita el día de semana y abrevia el mes
  // ("Martes, 16 de junio, 9:00 a.m." -> "16 jun, 9:00 a.m.") para que SIEMPRE
  // entre en un solo renglón, incluso en las tarjetas angostas del carrusel.
  const dateShort = (() => {
    const t0 = (dateText || "").trim();
    if (!t0) return "";
    const DOW = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];          // por índice getDay()
    const MON = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    // ISO crudo del datetime-local ("2026-06-25T15:50" / "2026-06-25 15:50")
    // -> "Jue 25 jun, 3:50 p.m." (día de semana abreviado, 1 renglón).
    const iso = t0.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (iso) {
      const y = +iso[1], mo = +iso[2], d = +iso[3];
      const dow = DOW[new Date(y, mo - 1, d).getDay()] || "";
      let h = +iso[4]; const min = iso[5];
      const ap = h < 12 ? "a.m." : "p.m.";
      h = h % 12; if (h === 0) h = 12;
      return `${dow} ${d} ${MON[mo - 1] || mo}, ${h}:${min} ${ap}`;
    }
    // Texto largo ("Jueves, 25 de junio, 11:00 a.m.") -> abrevia día y mes,
    // conservando el día de semana ("Jue 25 jun, 11:00 a.m.").
    let t = t0;
    const DMAP = { domingo:"Dom", lunes:"Lun", martes:"Mar", "miércoles":"Mié", miercoles:"Mié", jueves:"Jue", viernes:"Vie", "sábado":"Sáb", sabado:"Sáb" };
    t = t.replace(/^\s*(domingo|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado)\s*,?\s*/i, (m, w) => (DMAP[w.toLowerCase()] || w) + " ");
    t = t.replace(/\s+de\s+/gi, " ");                       // "25 de junio" -> "25 junio"
    const MMAP = { enero:"ene", febrero:"feb", marzo:"mar", abril:"abr", mayo:"may", junio:"jun", julio:"jul", agosto:"ago", septiembre:"sep", setiembre:"sep", octubre:"oct", noviembre:"nov", diciembre:"dic" };
    t = t.replace(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre/gi, (m) => MMAP[m.toLowerCase()] || m);
    return t.replace(/\s{2,}/g, " ").trim();
  })();
  const LONG = 160;
  const isLong   = actionText.length > LONG;
  const showFull = !isLong || expanded;
  const canEdit  = typeof onUpdate === "function";

  const openEdit = (e) => {
    e?.stopPropagation?.();
    setDraftA(lead.nextAction || "");
    // Normaliza el formato de la fecha al que acepta <input type="datetime-local">:
    // - "YYYY-MM-DD HH:MM" -> "YYYY-MM-DDTHH:MM" (normalizacion al separador T).
    // - Si el valor es texto libre antiguo ("Hoy 5pm", "Mañana 10am"), no matchea
    //   el regex y se deja como string crudo; el browser lo va a mostrar vacio y
    //   forzar al asesor a elegir una fecha real (que es lo que queremos).
    const rawDate = lead.nextActionDate || "";
    setDraftD(rawDate.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, "$1T$2"));
    setEditing(true);
  };
  const saveEdit = () => {
    onUpdate?.({ ...lead, nextAction: draftA.trim(), nextActionDate: draftD.trim() });
    setEditing(false);
  };
  // autoSaveOnBlur: si el asesor cierra el panel sin tocar "Guardar" pero
  // ya escribio algo (textarea o input), persistimos los cambios al perder
  // el foco. Antes el cambio se perdia silenciosamente y al recargar volvia
  // al valor anterior (queja repetida). Guard idempotencia: solo dispara
  // onUpdate si al menos uno de los dos campos cambio de su valor original.
  const autoSaveOnBlur = () => {
    const a = (draftA || "").trim();
    const d = (draftD || "").trim();
    const origA = (lead.nextAction || "").trim();
    const origD = (lead.nextActionDate || "").trim();
    if (a === origA && d === origD) return;
    if (!a && !d) return; // ambos vacios -> nada que guardar
    onUpdate?.({ ...lead, nextAction: a, nextActionDate: d });
  };
  const cancelEdit = () => setEditing(false);

  // ════════════════════════════════════════════════════════════════════
  // markDone — completa la próxima acción y abre el editor para definir
  // la siguiente. updateLead detecta el cambio de nextAction (ahora vacío
  // pero antes había una) y registra la previa como "completada" en el
  // historial automáticamente. Después de un breve delay, abrimos el
  // editor con foco en el textarea para que el asesor escriba la nueva
  // próxima acción sin fricción. UX orientada a resultados.
  // ════════════════════════════════════════════════════════════════════
  const markDone = (e) => {
    e?.stopPropagation?.();
    if (!hasAction) return;
    onUpdate?.({ ...lead, nextAction: "", nextActionDate: "" });
    // Pequeño delay para que el auto-log tenga tiempo de procesarse y se
    // sienta como un flujo natural ("hecho → ¿qué sigue?").
    setTimeout(() => {
      setDraftA("");
      setDraftD("");
      setEditing(true);
    }, 220);
  };

  const accentStrong = isLight ? (T.accentDark || T.accent) : T.accent;
  const textMain     = isLight ? T.txt : "#F1F5F9";
  // Normalización de teléfono — separamos formato visual del que va al dialer.
  // tel:  → mantiene "+" si lo trae, si no, dígitos puros (el SO sabe parsear).
  // wa.me → DEBE incluir código de país. Si no detecta uno (longitud típica
  //         de número de 10 dígitos sin lada), prepend "1" (USA) por default.
  //         La mayoría de los clientes son de Estados Unidos.
  const phoneClean = (lead.phone || "").replace(/[^0-9+]/g, "");
  const waDigits   = (lead.phone || "").replace(/[^0-9]/g, "");
  const waPhone    = (() => {
    if (!waDigits) return "";
    // Si ya empieza con "+" en el original, asumimos código de país explícito.
    if ((lead.phone || "").trim().startsWith("+")) return waDigits;
    // 10 dígitos sin código → asumimos USA (+1) por default
    if (waDigits.length === 10) return `1${waDigits}`;
    // Otros casos (más o menos dígitos): pasar como vienen, wa.me decide
    return waDigits;
  })();
  // Texto bonito para mostrar en el botón de copiar
  const phoneDisplay = lead.phone || "";

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

      {/* Header — ícono Zap + "PRÓXIMA ACCIÓN" + chip de fecha/hora al
          lado en la misma fila. Sin CLAVE pill (era ruido visual; la
          urgencia ya la comunica el accent rail vertical + animación). */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 10,
        flexWrap: "wrap",
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
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: accentStrong, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: fontDisp, whiteSpace: "nowrap" }}>Próxima acción</p>
        {dateShort && !editing && (
          <span title={dateText} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 99,
            background: isLight ? "#FFFFFF" : `${T.accent}12`,
            border: `1px solid ${isLight ? `${T.accent}3D` : `${T.accent}26`}`,
            color: accentStrong,
            fontSize: 10, fontWeight: 700, fontFamily: fontDisp,
            letterSpacing: "0.01em", whiteSpace: "nowrap", flexShrink: 0,
            boxShadow: isLight ? `0 1px 2px ${T.accent}18, inset 0 1px 0 rgba(255,255,255,0.8)` : "none",
          }}>
            <Clock size={9} strokeWidth={2.6} style={{ flexShrink: 0 }} />
            {dateShort}
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
            onBlur={autoSaveOnBlur}
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
                type="datetime-local"
                value={draftD}
                onChange={e => setDraftD(e.target.value)}
                onBlur={autoSaveOnBlur}
                // Bloquea fechas pasadas: si el asesor pone una fecha anterior
                // a "ahora", el browser la rechaza/marca invalida. Mejor un
                // error claro que un recordatorio que nunca se va a disparar.
                min={nowLocalDateTime()}
                style={{
                  flex: 1, padding: "7px 11px", borderRadius: 8,
                  background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isLight ? `${T.accent}44` : T.accentB}`,
                  color: textMain, fontSize: 11.5, fontWeight: 600,
                  fontFamily: fontDisp, letterSpacing: "0.01em",
                  outline: "none", boxSizing: "border-box",
                  colorScheme: isLight ? "light" : "dark",
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

      {/* ════════════════════════════════════════════════════════════════
          CTAs DE CONTACTO — Llamar · WhatsApp · Hecho (cuando aplica).
          Botones de altura uniforme, layout consistente, margins limpios.
          Sin botón "Copiar" (el número ya está en Datos generales) y sin
          warning triangle (el aviso de Zoom Agendado vive como chip de
          fecha arriba; aquí solo importan las acciones). ═══════════════ */}
      {!editing && phoneClean && (
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: `1px dashed ${isLight ? `${T.accent}2E` : `${T.accent}22`}`,
          display: "flex", gap: 8, flexWrap: "wrap",
          position: "relative",
        }}>
            <CallActionButton
              phone={phoneClean}
              label="Llamar ahora"
              variant="primary"
              T={T}
              isLight={isLight}
            />
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank" rel="noreferrer"
              style={{
                flex: 1, minWidth: 120, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "0 14px", borderRadius: 10,
                background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.07)",
                border: `1px solid ${isLight ? "rgba(37,211,102,0.45)" : "rgba(255,255,255,0.12)"}`,
                color: isLight ? "#128C7E" : "rgba(255,255,255,0.88)",
                fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
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
              <MessageCircle size={13} strokeWidth={2.4} /> WhatsApp
            </a>
            {/* Marcar como hecha — solo aparece cuando hay nextAction. */}
            {hasAction && (
              <button
                onClick={markDone}
                title="Marcar la próxima acción como hecha y agendar la siguiente"
                aria-label="Marcar como hecha"
                style={{
                  flexShrink: 0, height: 40,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "0 16px", borderRadius: 10,
                  background: "transparent",
                  border: `1px dashed ${isLight ? `${T.accent}66` : `${T.accent}55`}`,
                  color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                  fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
                  letterSpacing: "0.01em", cursor: "pointer",
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}${isLight ? "12" : "0E"}`; e.currentTarget.style.borderStyle = "solid"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderStyle = "dashed"; }}
              >
                <CheckCircle2 size={13} strokeWidth={2.4} /> Hecho
              </button>
            )}
          </div>
        )}

        {/* Si NO hay teléfono pero SÍ hay próxima acción, mostramos solo
            el botón "Hecho" en su propia fila — el asesor puede cerrar la
            acción aunque no esté llamando ni mandando WhatsApp. */}
        {!editing && !phoneClean && hasAction && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: `1px dashed ${isLight ? `${T.accent}2E` : `${T.accent}22`}`,
          }}>
            <button
              onClick={markDone}
              title="Marcar la próxima acción como hecha y agendar la siguiente"
              aria-label="Marcar como hecha"
              style={{
                width: "100%",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px", borderRadius: 10,
                background: "transparent",
                border: `1px dashed ${isLight ? `${T.accent}66` : `${T.accent}55`}`,
                color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
                letterSpacing: "0.01em", cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}${isLight ? "12" : "0E"}`; e.currentTarget.style.borderStyle = "solid"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderStyle = "dashed"; }}
            >
              <CheckCircle2 size={12} strokeWidth={2.4} /> Marcar como hecha
            </button>
          </div>
        )}

        {/* Sin teléfono → mini-form para agregarlo en un click. Esto evita
            que el asesor tenga que abrir el modo edición completo solo
            para registrar un número que necesita usar ya. */}
        {!editing && !phoneClean && canEdit && (
          <AddPhoneInline lead={lead} onUpdate={onUpdate} T={T} isLight={isLight} />
        )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   CopyPhoneButton — botón pequeño que copia el teléfono al portapapeles
   con confirmación visual de 1.4s. Útil cuando el navegador no abre
   el dialer (escritorio) o cuando el asesor quiere reutilizar el número.
   ────────────────────────────────────────────────────────────────────── */
const CopyPhoneButton = ({ phone, T = P, isLight = false }) => {
  const [copied, setCopied] = useState(false);
  if (!phone) return null;
  const doCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phone);
      } else {
        // Fallback legado para browsers viejos / contextos sin clipboard API
        const ta = document.createElement("textarea");
        ta.value = phone; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop — silencioso si el browser bloquea */ }
  };
  return (
    <button
      onClick={doCopy}
      title={`Copiar ${phone}`}
      aria-label={`Copiar ${phone}`}
      style={{
        flexShrink: 0,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "9px 12px", borderRadius: 10,
        background: copied
          ? (isLight ? `${T.accent}1A` : `${T.accent}18`)
          : "transparent",
        border: `1px solid ${copied ? `${T.accent}55` : (isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)")}`,
        color: copied
          ? (isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent)
          : (isLight ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.7)"),
        fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
        letterSpacing: "0.01em", cursor: "pointer", transition: "all 0.18s",
      }}
    >
      {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.2} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   AddPhoneInline — input chiquito siempre visible cuando el lead no
   tiene teléfono. El asesor pega/escribe el número y lo guarda con un
   tap. Sin abrir el modal de edición completo.
   ────────────────────────────────────────────────────────────────────── */
const AddPhoneInline = ({ lead, onUpdate, T = P, isLight = false }) => {
  const [val, setVal] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  if (!lead) return null;
  const submit = async () => {
    const trimmed = (val || "").trim();
    if (!trimmed) return;
    setSavingPhone(true);
    try { onUpdate?.({ ...lead, phone: trimmed }); }
    finally { setTimeout(() => setSavingPhone(false), 400); }
  };
  return (
    <div style={{
      marginTop: 12, paddingTop: 10,
      borderTop: `1px dashed ${isLight ? `${T.accent}2E` : `${T.accent}22`}`,
      display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap",
    }}>
      <Phone size={12} color={T.txt3} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder="Agrega un teléfono…  +1 555 …"
        inputMode="tel"
        style={{
          flex: 1, minWidth: 140,
          height: 36, padding: "0 12px", borderRadius: 10,
          background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${T.border}`,
          color: T.txt, fontSize: 13, fontFamily: fontDisp,
          outline: "none", boxSizing: "border-box",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
        onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
      />
      <button
        onClick={submit}
        disabled={!val.trim() || savingPhone}
        style={{
          height: 36, padding: "0 14px", borderRadius: 10,
          background: val.trim() ? (isLight ? `linear-gradient(135deg, ${T.accent}, #14B892)` : T.accent) : T.glass,
          border: "none",
          color: val.trim() ? "#FFFFFF" : T.txt3,
          fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
          cursor: val.trim() ? "pointer" : "not-allowed",
          letterSpacing: "0.01em",
          boxShadow: val.trim() && isLight ? `0 3px 10px ${T.accent}40` : "none",
          transition: "all 0.18s",
        }}
      >
        {savingPhone ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
};

/* ─── Notes Modal — Rich sectioned view ─── */
/* ═══════════════════════════════════════════
   DRAWER TAB ISLAND — Pill flotante estilo Dynamic Island, colocada abajo
   en cada drawer (Discovery · Análisis IA). Permite al vendedor saltar
   entre las vistas del lead sin cerrar el drawer.

   Discovery agrupa Expediente + Perfil en una sola sección — la sub-vista
   activa se toggleea desde un segmented control dentro del propio drawer.
═══════════════════════════════════════════ */
const DRAWER_TABS = [
  // Discovery = Expediente + Perfil unificados (el asesor pasa 90% aquí)
  { id: "discovery", label: L.discoveryTab,  shortLabel: L.discoveryTabShort, colorKey: "blue"   },
  // Análisis IA bloqueado por ahora — se desbloqueará en siguiente etapa
  { id: "analisis",  label: "Análisis IA", shortLabel: "IA",     colorKey: "accent", locked: true, lockReason: "Próximamente" },
];

const DrawerTabIsland = ({ current, onSwitch, T = P }) => {
  const isLight = T !== P;
  const safeC = (c) => isLight ? `color-mix(in srgb, ${c} 60%, #0B1220 40%)` : c;

  return (
    <div style={{
      position: "absolute",
      // En mobile el drawer es bottom-sheet con safe-area; bajamos el island
      // un poco más para no chocar con el indicador inferior del iPhone.
      bottom: "max(20px, env(safe-area-inset-bottom, 20px))",
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
        const locked = !!tab.locked;
        const color = T[tab.colorKey] || T.accent;
        const txtC  = locked
          ? T.txt3
          : (active ? safeC(color) : (isLight ? T.txt2 : T.txt3));
        const iconNode =
          tab.id === "analisis"   ? <StratosAtom size={13} color={txtC} />
        :                           <Aperture size={13} color={txtC} strokeWidth={2.2} />;

        return (
          <button
            key={tab.id}
            onClick={() => { if (!active && !locked) onSwitch?.(tab.id); }}
            disabled={locked}
            title={locked ? tab.lockReason || "Próximamente" : tab.label}
            style={{
              height: 38, padding: "0 14px", borderRadius: 999,
              border: "none",
              background: locked
                ? "transparent"
                : (active
                  ? (isLight ? `${color}22` : `${color}26`)
                  : "transparent"),
              color: txtC,
              opacity: locked ? 0.45 : 1,
              fontSize: 12.5, fontWeight: active ? 700 : 600,
              fontFamily: font, letterSpacing: "0.01em",
              cursor: locked ? "not-allowed" : (active ? "default" : "pointer"),
              display: "flex", alignItems: "center", gap: 7,
              transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: active && isLight && !locked ? `inset 0 1px 0 rgba(255,255,255,0.55)` : "none",
              whiteSpace: "nowrap",
              position: "relative",
            }}
            onMouseEnter={e => {
              if (!active && !locked) {
                e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = isLight ? T.txt : "#FFFFFF";
              }
            }}
            onMouseLeave={e => {
              if (!active && !locked) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = txtC;
              }
            }}
          >
            {iconNode}
            <span>{tab.label}</span>
            {locked && (
              <span aria-hidden style={{
                fontSize: 10, marginLeft: 2, opacity: 0.7,
              }}>🔒</span>
            )}
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
const UpdateChatPanel = ({ isOpen, onClose, expedienteItems = [], onAddItem, onRemoveItem, T = P, lead, onUpdate }) => {
  const [inputText, setInputText] = useState("");
  const [organizing, setOrganizing] = useState(false);
  const [organizeError, setOrganizeError] = useState(null);
  // Estado de confirmación: si el AI devuelve preguntas, las mostramos como modal
  const [confirmQueue, setConfirmQueue] = useState(null); // { questions: [...], answers: {q: ''}, originalText, partialResult }
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

  // ── Aplicar resultado al lead (compartido entre primer turno y confirmación)
  const applyResult = (result, originalText) => {
    // Construir bio mejorada
    const bioParts = [];
    if (result.objetivo)  bioParts.push(`🎯 ${result.objetivo}`);
    if (result.ubicacion) bioParts.push(`📍 ${result.ubicacion}`);
    if (result.notas)     bioParts.push(`\n${result.notas}`);
    const newBio = bioParts.join(" · ").replace(/ · \n/g, "\n").trim();

    if (lead && onUpdate) {
      const updates = { ...lead };
      if (result.name && !lead.n && !lead.name) { updates.n = result.name; updates.name = result.name; }
      if (result.phone && !lead.phone)          updates.phone = result.phone;
      if (newBio)                               updates.bio = newBio;
      if (result.next_action)                   { updates.nextAction = result.next_action; updates.next_action = result.next_action; }
      if (result.next_action_date)              { updates.nextActionDate = result.next_action_date; updates.next_action_date = result.next_action_date; }
      if (result.presupuesto_num && result.presupuesto_num > 0) {
        updates.presupuesto = result.presupuesto_num;
        updates.budget = result.presupuesto;
      }
      if (result.stage_sugerido && !lead.st)    { updates.st = result.stage_sugerido; updates.stage = result.stage_sugerido; }
      if (result.score_sugerido > 0 && !lead.sc) { updates.sc = result.score_sugerido; updates.score = result.score_sugerido; }
      onUpdate(updates);
    }

    // Helper para formatear el resumen
    const lines = [];
    if (result.name)             lines.push(`👤 ${result.name}`);
    if (result.objetivo)         lines.push(`🎯 ${result.objetivo}`);
    if (result.ubicacion)        lines.push(`📍 ${result.ubicacion}`);
    if (result.presupuesto)      lines.push(`💰 ${result.presupuesto}`);
    if (result.next_action)      lines.push(`📅 ${result.next_action}${result.next_action_date ? " · " + result.next_action_date : ""}`);
    if (result.notas)            lines.push(`\n${result.notas}`);

    onAddItem?.({
      id: Date.now(),
      type: "transcripcion",
      title: result.source === "ai" ? "✨ Registro IA" : "✨ Registro",
      content: lines.join("\n") || originalText,
      details: { confidence: result.confidence, source: result.source },
      fecha: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      source: "asesor",
      fileName: null,
      size: null,
    });
  };

  // ── Organizar texto desordenado con IA ─────────────────────
  // Si el AI tiene dudas → muestra confirmQueue con preguntas concretas.
  // El asesor responde, y entonces SI registra. Nunca inventa info.
  const handleOrganize = async () => {
    if (!inputText.trim() || organizing) return;
    setOrganizing(true); setOrganizeError(null);
    try {
      const { organizeNotes } = await import("../../../lib/organize-notes");
      const result = await organizeNotes(inputText.trim(), { useAI: true });
      if (!result) { setOrganizeError("No se pudo procesar"); return; }

      // Si la IA pide confirmación, mostrar las preguntas en un panel
      if (Array.isArray(result.needs_confirmation) && result.needs_confirmation.length > 0) {
        const answers = {};
        result.needs_confirmation.forEach(q => { answers[q] = ""; });
        setConfirmQueue({
          questions: result.needs_confirmation,
          answers,
          originalText: inputText.trim(),
          partialResult: result,
        });
        // No reseteamos inputText — el asesor decide después
      } else {
        // Confianza alta — aplicar directo
        applyResult(result, inputText.trim());
        setInputText("");
      }
    } catch (e) {
      setOrganizeError(e?.message || "Error al organizar");
    } finally {
      setOrganizing(false);
    }
  };

  // Después de que el asesor responde las preguntas, reintentar
  const handleConfirmAnswers = async () => {
    if (!confirmQueue) return;
    setOrganizing(true);
    try {
      const { organizeWithConfirmations } = await import("../../../lib/organize-notes");
      const result = await organizeWithConfirmations(confirmQueue.originalText, confirmQueue.answers);
      if (!result) { setOrganizeError("No se pudo confirmar"); return; }
      applyResult(result, confirmQueue.originalText);
      setConfirmQueue(null);
      setInputText("");
    } catch (e) {
      setOrganizeError(e?.message || "Error");
    } finally {
      setOrganizing(false);
    }
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
                ¿Qué pasó con el cliente?
              </p>
              <p style={{ margin: 0, fontSize: 9.5, color: T.txt3, fontFamily: font }}>
                {expedienteItems.length > 0
                  ? `${expedienteItems.length} registro${expedienteItems.length !== 1 ? "s" : ""} · más reciente arriba`
                  : "Sin registros aún — escribe la primera nota"}
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
            Escribe lo que pasó · pega un audio · adjunta foto · 📝 yo lo organizo
          </span>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        {/* ── Panel de confirmación IA ──
           Cuando el agente IA encuentra ambigüedad, muestra preguntas
           concretas. El asesor responde y entonces registramos. Esto
           evita meter basura al CRM. */}
        {confirmQueue && (
          <div style={{
            margin: "8px 16px 4px",
            padding: "12px 14px",
            borderRadius: 12,
            background: `${T.violet}10`,
            border: `1px solid ${T.violet}33`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Wand2 size={13} color={violetC} strokeWidth={2.4} />
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: violetC, fontFamily: fontDisp, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Necesito aclarar antes de registrar
              </p>
            </div>
            {confirmQueue.questions.map((q, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11.5, color: T.txt, fontFamily: font, lineHeight: 1.4 }}>{q}</p>
                <input
                  type="text"
                  value={confirmQueue.answers[q] || ""}
                  onChange={e => setConfirmQueue(prev => ({ ...prev, answers: { ...prev.answers, [q]: e.target.value } }))}
                  placeholder="Tu respuesta…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "7px 10px", borderRadius: 8,
                    background: T === P ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
                    border: `1px solid ${T.border}`,
                    color: T.txt, fontSize: 11.5, fontFamily: font, outline: "none",
                  }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={handleConfirmAnswers}
                disabled={organizing}
                style={{
                  flex: 1, padding: "7px 12px", borderRadius: 8,
                  background: violetC, border: `1px solid ${violetC}`,
                  color: T === P ? "#0B1220" : "#FFF",
                  cursor: organizing ? "wait" : "pointer",
                  fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                {organizing ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={11} strokeWidth={2.5} />}
                Registrar con estas respuestas
              </button>
              <button
                onClick={() => setConfirmQueue(null)}
                style={{
                  padding: "7px 12px", borderRadius: 8,
                  background: "transparent", border: `1px solid ${T.border}`,
                  color: T.txt3, cursor: "pointer",
                  fontSize: 11.5, fontFamily: font,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

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
            {/* ── ✨ Organizar con IA ──
               Toma el texto desordenado del input y estructura los campos del lead
               (objetivo/ubicación/presupuesto/próxima acción/notas) automáticamente.
               Usa parser local (offline) primero; si la confianza es baja, llama al
               Edge Function `organize-lead-notes` que usa Claude Haiku 4.5. */}
            <button
              onClick={handleOrganize}
              disabled={!inputText.trim() || organizing}
              title="📝 Guardar lo que pasó — escríbelo desordenado y yo lo organizo"
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: organizing ? T.accentS : `linear-gradient(135deg, ${T.accent}26, ${T.violet}26)`,
                border: `1px solid ${T.accentB}`,
                color: accentC,
                cursor: !inputText.trim() || organizing ? "not-allowed" : "pointer",
                opacity: !inputText.trim() ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.18s",
                position: "relative",
              }}
              onMouseEnter={e => { if (inputText.trim() && !organizing) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 14px ${T.accent}33`; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {organizing
                ? <RefreshCw size={14} strokeWidth={2.4} style={{ animation: "spin 1s linear infinite" }} />
                : <Wand2 size={15} strokeWidth={2.2} />
              }
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
              placeholder="Cuéntame qué pasó con el cliente — escribe libre…"
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

/* ═══════════════════════════════════════════════════════════════════════════
   TASK CHECKLIST — lista de tareas pendientes por cliente.
   Cada tarea completada se auto-registra en el historial de acciones.
   Aparece en: Perfil (LeadPanel) y Expediente (NotesModal).
═══════════════════════════════════════════════════════════════════════════ */
const TaskChecklist = ({ lead, onUpdate, T = P }) => {
  const isLight = T !== P;
  const [input, setInput]       = useState("");
  const [addingTask, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef(null);

  const tasks   = Array.isArray(lead?.tasks) ? lead.tasks : [];
  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);

  useEffect(() => { if (addingTask && inputRef.current) inputRef.current.focus(); }, [addingTask]);

  const addTask = () => {
    const text = input.trim();
    if (!text) { setAdding(false); return; }
    const newTask = { id: genId(), text, done: false, createdAt: new Date().toISOString() };
    onUpdate?.({ ...lead, tasks: [newTask, ...tasks] });
    setInput(""); setAdding(false);
  };

  const toggleDone = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const nowFmt = fmtNow();
    const updatedTasks = tasks.map(t =>
      t.id === taskId
        ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined, doneAtFmt: !t.done ? nowFmt : undefined }
        : t
    );
    // Si se marca como completada → añadir al historial de acciones
    const prevHistory = Array.isArray(lead.actionHistory) ? lead.actionHistory : [];
    const newHistory = !task.done
      ? [{ id: genId(), action: task.text, doneAtFmt: nowFmt, type: "tarea" }, ...prevHistory]
      : prevHistory;
    onUpdate?.({ ...lead, tasks: updatedTasks, actionHistory: newHistory });
  };

  const removeTask = (taskId) => onUpdate?.({ ...lead, tasks: tasks.filter(t => t.id !== taskId) });

  const accentC = isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent;
  const hasContent = pending.length > 0 || done.length > 0;

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", background: T.glass }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: (hasContent || addingTask) ? `1px solid ${T.border}` : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <CheckSquare size={12} color={T.txt3} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>Tareas</span>
          {pending.length > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: accentC, background: `${T.accent}14`, padding: "1px 6px", borderRadius: 99, fontFamily: fontDisp }}>{pending.length}</span>
          )}
        </div>
        <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt2; e.currentTarget.style.borderColor = T.borderH; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; e.currentTarget.style.borderColor = T.border; }}
        ><Plus size={10} strokeWidth={2.5} /> Agregar</button>
      </div>

      {/* Input nueva tarea */}
      {addingTask && (
        <div style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTask(); if (e.key === "Escape") { setAdding(false); setInput(""); } }}
            placeholder="Describe la tarea..."
            style={{ flex: 1, padding: "6px 10px", borderRadius: 7, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", border: `1px solid ${T.borderH}`, color: T.txt, fontSize: 12, fontFamily: font, outline: "none" }}
          />
          <button onClick={addTask} style={{ padding: "6px 12px", borderRadius: 7, background: `${T.accent}18`, border: `1px solid ${T.accentB}`, color: accentC, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, whiteSpace: "nowrap" }}>+ Agregar</button>
          <button onClick={() => { setAdding(false); setInput(""); }} style={{ width: 26, height: 26, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: T.txt3, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
        </div>
      )}

      {/* Tareas pendientes */}
      {pending.map((task, i) => (
        <div key={task.id} style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10, borderBottom: i < pending.length - 1 || done.length > 0 ? `1px solid ${T.border}` : "none", transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = T.glassH}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <button onClick={() => toggleDone(task.id)} title="Marcar como completada"
            style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${T.borderH}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = `${T.accent}18`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.background = "transparent"; }}
          />
          <span style={{ flex: 1, fontSize: 12.5, color: T.txt, fontFamily: font, lineHeight: 1.45 }}>{task.text}</span>
          <button onClick={() => removeTask(task.id)} title="Eliminar"
            style={{ opacity: 0, width: 22, height: 22, borderRadius: 5, background: "transparent", border: "none", cursor: "pointer", color: T.txt3, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s", flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0"}
          ><X size={11} /></button>
        </div>
      ))}

      {/* Toggle completadas */}
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(v => !v)} style={{ width: "100%", padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", borderTop: pending.length > 0 ? `1px solid ${T.border}` : "none", cursor: "pointer", color: T.txt3, fontSize: 10.5, fontFamily: font, textAlign: "left", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = T.glass}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <CheckCircle2 size={11} color={T.txt3} strokeWidth={2} />
            {done.length} completada{done.length !== 1 ? "s" : ""}
            <ChevronDown size={10} strokeWidth={2.5} style={{ marginLeft: "auto", transform: showDone ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {showDone && done.map((task) => (
            <div key={task.id} style={{ padding: "8px 14px", display: "flex", alignItems: "flex-start", gap: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${T.accent}`, background: `${T.accent}18`, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={9} color={isLight ? accentC : T.accent} strokeWidth={3} />
              </div>
              <span style={{ flex: 1, fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.4, textDecoration: "line-through" }}>{task.text}</span>
              {task.doneAtFmt && <span style={{ fontSize: 9.5, color: T.txt3, fontFamily: fontDisp, whiteSpace: "nowrap", marginTop: 2 }}>{task.doneAtFmt}</span>}
            </div>
          ))}
        </>
      )}

      {/* Estado vacío */}
      {!hasContent && !addingTask && (
        <div style={{ padding: "20px 14px", textAlign: "center" }}>
          <p style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, marginBottom: 10 }}>Añade tareas concretas para este cliente</p>
          <button onClick={() => setAdding(true)} style={{ padding: "6px 16px", borderRadius: 7, background: `${T.accent}10`, border: `1px solid ${T.accentB}`, color: accentC, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>+ Primera tarea</button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PLAYBOOK SECTION — Lista de 4-5 acciones específicas para este cliente
   alineadas con el Protocolo Duke del Caribe.

   Cada acción incluye: técnica de venta, razón (por qué hacerlo ahora),
   categoría visual (reactivación / calificación / cita / etc).

   El asesor puede tickearlas como completadas. Es una "checklist viva"
   que cambia según la situación del lead.
═══════════════════════════════════════════════════════════════════════════ */
const PLAYBOOK_CATEGORIES = {
  reactivacion: { label: "Reactivación",   colorKey: "rose"    },
  calificacion: { label: "Calificación",   colorKey: "blue"    },
  cita:         { label: "Avance",         colorKey: "accent"  },
  propuesta:    { label: "Propuesta",      colorKey: "violet"  },
  cierre:       { label: "Cierre",         colorKey: "emerald" },
  retencion:    { label: "Post-venta",     colorKey: "cyan"    },
};

const PlaybookSection = ({ lead, T = P, onUpdate = null, onShowSuggest = null }) => {
  const isLight = T !== P;
  const [expanded, setExpanded] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);   // índice del item en edición
  const [editDraft, setEditDraft]   = useState("");
  const [adding, setAdding]         = useState(false);
  const [newDraft, setNewDraft]     = useState("");

  const playbook = Array.isArray(lead?.playbook) ? lead.playbook : [];

  const completed = playbook.filter(p => p.completed).length;
  const total     = playbook.length;
  const visible   = expanded ? playbook : playbook.slice(0, 3);

  const safeC   = (c) => isLight ? `color-mix(in srgb, ${c} 60%, #0B1220 40%)` : c;
  const headerC = isLight ? `color-mix(in srgb, ${T.violet} 58%, #0B1220 42%)` : T.violet;
  const canEdit = typeof onUpdate === 'function';

  const persistPlaybook = (newPlaybook) => {
    if (!canEdit) return;
    onUpdate({ ...lead, playbook: newPlaybook });
  };

  const toggleItem = (idx) => {
    persistPlaybook(playbook.map((p, i) =>
      i === idx ? { ...p, completed: !p.completed, completed_at: !p.completed ? new Date().toISOString() : null } : p
    ));
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditDraft(playbook[idx]?.action || "");
  };

  const saveEdit = () => {
    if (editingIdx == null) return;
    if (!editDraft.trim()) {
      setEditingIdx(null);
      return;
    }
    persistPlaybook(playbook.map((p, i) =>
      i === editingIdx ? { ...p, action: editDraft.trim() } : p
    ));
    setEditingIdx(null);
    setEditDraft("");
  };

  const cancelEdit = () => { setEditingIdx(null); setEditDraft(""); };

  const deleteItem = (idx) => {
    persistPlaybook(playbook.filter((_, i) => i !== idx));
  };

  const addNew = () => {
    if (!newDraft.trim()) {
      setAdding(false);
      return;
    }
    const newItem = {
      id: genId(),
      order: playbook.length + 1,
      icon: "",
      category: "cita",
      action: newDraft.trim(),
      technique: "",
      reason: "",
      completed: false,
    };
    persistPlaybook([...playbook, newItem]);
    setNewDraft("");
    setAdding(false);
    setExpanded(true);
  };

  // Si no hay playbook, mostrar solo el botón "Agregar acción"
  if (playbook.length === 0 && !adding) {
    if (!canEdit) return null;
    return (
      <div style={{
        marginBottom: 16,
        padding: "16px",
        borderRadius: 14,
        border: `1px dashed ${T.border}`,
        background: T.glass,
        textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font, marginBottom: 10 }}>
          Sin acciones registradas para este cliente.
        </p>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: "8px 16px", borderRadius: 9,
            background: `${T.violet}14`, border: `1px solid ${T.violet}38`,
            color: headerC, fontSize: 12, fontWeight: 700,
            fontFamily: fontDisp, cursor: "pointer",
            transition: "all 0.18s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = `${T.violet}24`}
          onMouseLeave={e => e.currentTarget.style.background = `${T.violet}14`}
        >
          + Agregar primera acción
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.glass,
      overflow: "hidden",
    }}>
      {/* Header — sin emoji, lenguaje claro */}
      <div style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 800, color: headerC,
            letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: fontDisp,
          }}>
            Acciones recomendadas
          </p>
          <p style={{
            margin: "2px 0 0", fontSize: 10.5, color: T.txt3, fontFamily: font,
          }}>
            {total > 0 ? `${total} acciones para avanzar la venta` : 'Agrega acciones para este cliente'}
          </p>
        </div>
        {/* Botón pedir sugerencias IA */}
        {canEdit && typeof onShowSuggest === 'function' && (
          <button
            onClick={onShowSuggest}
            title="Pedir sugerencias con IA"
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: T.txt2, fontSize: 11, fontWeight: 600,
              fontFamily: font, cursor: "pointer",
              transition: "all 0.18s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.color = T.txt; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt2; }}
          >
            Sugerencias IA
          </button>
        )}
        {/* Progreso */}
        {total > 0 && (
          <div style={{
            padding: "4px 10px", borderRadius: 99,
            background: completed > 0 ? `${T.emerald}14` : T.glass,
            border: `1px solid ${completed > 0 ? `${T.emerald}30` : T.border}`,
            fontSize: 10.5, fontWeight: 700, fontFamily: fontDisp,
            color: completed > 0 ? safeC(T.emerald) : T.txt3,
            whiteSpace: "nowrap",
          }}>
            {completed}/{total}
          </div>
        )}
      </div>

      {/* Items — sin emojis, con editar/eliminar */}
      <div style={{ padding: "4px 0" }}>
        {visible.map((item, idx) => {
          const realIdx = playbook.indexOf(item);
          const cat = PLAYBOOK_CATEGORIES[item.category] || { label: item.category, colorKey: "txt2" };
          const catColor = T[cat.colorKey] || T.txt2;
          const catC = safeC(catColor);
          const done = !!item.completed;
          const isEditing = editingIdx === realIdx;

          return (
            <div key={item.id || idx} style={{
              padding: "10px 16px",
              borderBottom: idx < visible.length - 1 ? `1px solid ${T.border}` : "none",
              display: "flex", alignItems: "flex-start", gap: 10,
              opacity: done ? 0.55 : 1,
              transition: "opacity 0.18s",
            }}>
              {/* Checkbox */}
              <button
                onClick={() => toggleItem(realIdx)}
                aria-label={done ? "Marcar como pendiente" : "Marcar como completada"}
                disabled={isEditing}
                style={{
                  flexShrink: 0, marginTop: 2,
                  width: 20, height: 20, borderRadius: 6,
                  background: done ? T.emerald : "transparent",
                  border: `1.5px solid ${done ? T.emerald : (isLight ? "rgba(15,23,42,0.20)" : "rgba(255,255,255,0.20)")}`,
                  cursor: canEdit && !isEditing ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.16s",
                  color: "#FFFFFF",
                  fontSize: 12, fontWeight: 800,
                }}
                onMouseEnter={e => { if (!done && !isEditing) e.currentTarget.style.borderColor = T.emerald; }}
                onMouseLeave={e => { if (!done && !isEditing) e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.20)" : "rgba(255,255,255,0.20)"; }}
              >
                {done && "✓"}
              </button>

              {/* Contenido */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Etiqueta de categoría sin emoji */}
                <div style={{ marginBottom: 6 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: catC,
                    background: `${catColor}${isLight ? "14" : "10"}`,
                    border: `1px solid ${catColor}${isLight ? "26" : "1E"}`,
                    padding: "2px 7px", borderRadius: 99,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    fontFamily: fontDisp,
                  }}>{cat.label}</span>
                </div>

                {/* Texto editable o display */}
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                      if (e.key === 'Escape')              { e.preventDefault(); cancelEdit(); }
                    }}
                    rows={2}
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 8,
                      background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.violet}55`,
                      color: isLight ? T.txt : "#FFFFFF",
                      fontSize: 12.5, fontFamily: font, lineHeight: 1.45,
                      outline: "none", resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <p style={{
                    margin: 0, fontSize: 12.5, fontWeight: 600,
                    color: isLight ? T.txt : "#FFFFFF",
                    fontFamily: fontDisp, lineHeight: 1.45,
                    textDecoration: done ? "line-through" : "none",
                  }}>
                    {/* Limpiar emojis del action si vienen del playbook generado */}
                    {(item.action || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/gu, "").trim()}
                  </p>
                )}

                {/* Técnica y razón sin emojis */}
                {!isEditing && item.technique && (
                  <p style={{
                    margin: "4px 0 0", fontSize: 11, color: T.txt3,
                    fontFamily: font, lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700, color: catC }}>Técnica:</span> {item.technique}
                  </p>
                )}
                {!isEditing && item.reason && (
                  <p style={{
                    margin: "2px 0 0", fontSize: 11, color: T.txt3,
                    fontFamily: font, lineHeight: 1.5,
                  }}>
                    {item.reason}
                  </p>
                )}

                {/* Botones de acción inline */}
                {canEdit && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEdit}
                          style={{
                            padding: "5px 12px", borderRadius: 7,
                            background: `${T.emerald}18`, border: `1px solid ${T.emerald}40`,
                            color: safeC(T.emerald),
                            fontSize: 11, fontWeight: 700, fontFamily: fontDisp,
                            cursor: "pointer",
                          }}
                        >Guardar</button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: "5px 12px", borderRadius: 7,
                            background: "transparent", border: `1px solid ${T.border}`,
                            color: T.txt3,
                            fontSize: 11, fontWeight: 600, fontFamily: font,
                            cursor: "pointer",
                          }}
                        >Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(realIdx)}
                          title="Editar acción"
                          style={{
                            padding: "5px 10px", borderRadius: 7,
                            background: "transparent", border: `1px solid ${T.border}`,
                            color: T.txt3,
                            fontSize: 10.5, fontWeight: 600, fontFamily: font,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.color = T.txt2; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
                        >Editar</button>
                        <button
                          onClick={() => deleteItem(realIdx)}
                          title="Eliminar acción"
                          style={{
                            padding: "5px 10px", borderRadius: 7,
                            background: "transparent", border: `1px solid ${T.border}`,
                            color: T.txt3,
                            fontSize: 10.5, fontWeight: 600, fontFamily: font,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${T.rose}50`; e.currentTarget.style.color = isLight ? `color-mix(in srgb, ${T.rose} 60%, #0B1220 40%)` : T.rose; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
                        >Eliminar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Form para nueva acción */}
        {adding && (
          <div style={{
            padding: "12px 16px",
            borderTop: playbook.length > 0 ? `1px solid ${T.border}` : "none",
            background: isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)",
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>
              Nueva acción
            </p>
            <textarea
              autoFocus
              value={newDraft}
              onChange={e => setNewDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNew(); }
                if (e.key === 'Escape')              { e.preventDefault(); setAdding(false); setNewDraft(""); }
              }}
              rows={2}
              placeholder="Ej. Llamar al cliente para confirmar visita del jueves"
              style={{
                width: "100%", padding: "9px 11px", borderRadius: 8,
                background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                color: isLight ? T.txt : "#FFFFFF",
                fontSize: 12.5, fontFamily: font, lineHeight: 1.45,
                outline: "none", resize: "vertical", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = `${T.violet}55`}
              onBlur={e => e.target.style.borderColor = T.border}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <button
                onClick={addNew}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  background: `${T.violet}20`, border: `1px solid ${T.violet}48`,
                  color: headerC,
                  fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                  cursor: "pointer",
                }}
              >Agregar</button>
              <button
                onClick={() => { setAdding(false); setNewDraft(""); }}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  background: "transparent", border: `1px solid ${T.border}`,
                  color: T.txt3,
                  fontSize: 11.5, fontWeight: 600, fontFamily: font,
                  cursor: "pointer",
                }}
              >Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: agregar nueva + expandir */}
      {(canEdit || playbook.length > 3) && (
        <div style={{
          padding: "10px 16px",
          borderTop: `1px solid ${T.border}`,
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        }}>
          {canEdit && !adding && (
            <button
              onClick={() => setAdding(true)}
              style={{
                padding: "7px 14px", borderRadius: 8,
                background: `${T.violet}12`, border: `1px solid ${T.violet}30`,
                color: headerC,
                fontSize: 11, fontWeight: 700, fontFamily: fontDisp,
                cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.violet}1E`}
              onMouseLeave={e => e.currentTarget.style.background = `${T.violet}12`}
            >
              + Agregar acción
            </button>
          )}
          {playbook.length > 3 && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                marginLeft: "auto",
                padding: "7px 12px", borderRadius: 8,
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.txt3,
                fontSize: 11, fontWeight: 600, fontFamily: font,
                cursor: "pointer",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.color = T.txt2; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
            >
              {expanded ? "Ver menos" : `Ver ${playbook.length - 3} más`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION TIMELINE — historial cronológico de acciones completadas.
   Se auto-popula cuando: se completa una tarea, cambia la próxima acción.
   Aparece en: Expediente (NotesModal) como sección principal.
═══════════════════════════════════════════════════════════════════════════ */
const ActionTimeline = ({ lead, T = P, maxItems = 6 }) => {
  const isLight = T !== P;
  const [expanded, setExpanded] = useState(false);
  const rawHistory = Array.isArray(lead?.actionHistory) ? lead.actionHistory : [];
  // Ordenar por fecha descendente (más reciente arriba). Items sin fecha
  // mantienen su posición relativa (sort estable).
  const history = [...rawHistory].sort((a, b) => {
    const da = new Date(a.completed_at || a.doneAt || a.done_at || 0).getTime();
    const db = new Date(b.completed_at || b.doneAt || b.done_at || 0).getTime();
    return db - da;
  });

  // Estado vacío — el asesor ve qué es esta sección y qué la activa.
  if (history.length === 0) {
    return (
      <div style={{ borderRadius: 12, border: `1px dashed ${T.border}`, padding: "14px 16px", background: T.glass }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <ListChecks size={12} color={T.txt3} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>Lista de acciones</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
          Cada vez que registres una próxima acción, sumes un seguimiento o cambies la etapa, quedará aquí como historial del cliente.
        </p>
      </div>
    );
  }

  const shown = expanded ? history : history.slice(0, maxItems);
  const typeColor  = (type) => ({
    tarea:        T.emerald,
    seguimiento:  T.blue,
    completada:   T.accent,
    registrada:   T.accent,
    etapa:        T.violet || T.blue,
  }[type] ?? T.accent);
  const TypeIcon   = (type) => ({
    tarea:        CheckCircle2,
    seguimiento:  RefreshCw,
    completada:   CheckCircle2,
    registrada:   Zap,
    etapa:        Waypoints,
  }[type] ?? CheckCircle2);
  const typeLabel  = (type) => ({
    tarea:        "Tarea",
    seguimiento:  "Seguimiento",
    completada:   "Acción completada",
    registrada:   "Acción registrada",
    etapa:        "Cambio de etapa",
  }[type] ?? "Registro");

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 15px", borderBottom: `1px solid ${T.border}`, background: T.glass, display: "flex", alignItems: "center", gap: 8 }}>
        <ListChecks size={12} color={T.txt3} strokeWidth={2} />
        <span style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>Lista de acciones</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}28`, padding: "1px 7px", borderRadius: 99, fontFamily: fontDisp }}>{history.length}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: T.txt3, fontFamily: font, opacity: 0.7 }}>más reciente arriba</span>
      </div>

      {/* Línea de tiempo */}
      <div>
        {shown.map((entry, i) => {
          const col  = typeColor(entry.type);
          const Icon = TypeIcon(entry.type);
          const colSafe = isLight ? `color-mix(in srgb, ${col} 62%, #0B1220 38%)` : col;
          const isLast = i === shown.length - 1;
          const label = typeLabel(entry.type);
          return (
            <div key={entry.id || i} style={{ display: "flex", gap: 0, borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
              {/* Línea vertical + icono */}
              <div style={{ width: 42, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", flexShrink: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${col}14`, border: `1px solid ${col}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={11} color={colSafe} strokeWidth={2.2} />
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 8, background: T.border, marginTop: 4 }} />}
              </div>
              {/* Contenido */}
              <div style={{ flex: 1, padding: "10px 14px 10px 0", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: colSafe, background: `${col}14`, border: `1px solid ${col}28`, padding: "1px 6px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: fontDisp }}>{label}</span>
                  {entry.by && (
                    <span style={{ fontSize: 9, color: T.txt3, fontFamily: font }}>· {entry.by}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: T.txt, fontFamily: font, lineHeight: 1.4, wordBreak: "break-word" }}>{entry.action}</p>
                {(entry.doneAtFmt || entry.date) && (
                  <p style={{ margin: "3px 0 0", fontSize: 9.5, color: T.txt3, fontFamily: fontDisp }}>
                    {entry.doneAtFmt}
                    {entry.date && entry.doneAtFmt ? ` · vencía ${entry.date}` : (entry.date || "")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ver más / menos */}
      {history.length > maxItems && (
        <button onClick={() => setExpanded(v => !v)} style={{ width: "100%", padding: "8px 15px", background: "transparent", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", color: T.txt3, fontSize: 10.5, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = T.glass}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {expanded ? "Ver menos" : `Ver ${history.length - maxItems} registro${history.length - maxItems !== 1 ? "s" : ""} más`}
          <ChevronDown size={10} strokeWidth={2.5} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   LeadActivityTimeline — Historial unificado del lead.
   Combina:
     · audit_log de Supabase  (cambios automáticos por triggers — todas
       las UPDATE/INSERT/SOFT_DELETE: reasignaciones, etapas, notas,
       teléfonos, etc.)
     · lead.actionHistory     (registros locales del flujo histórico:
       tareas completadas, seguimientos, próximas acciones)
   Sortea por fecha desc y muestra todo en una sola timeline aesthetic.
   En demo (no UUID) muestra solo el actionHistory local; en producción
   completa con el audit_log.
   ────────────────────────────────────────────────────────────────────── */
const ACTIVITY_ICON_FOR_FIELD = {
  asesor_name:      UserCheck,
  asesor_id:        UserCheck,
  stage:            Waypoints,
  next_action:      Zap,
  next_action_date: Clock,
  score:            Star,
  hot:              Flame,
  is_new:           Star,
  notas:            FileText,
  bio:              User,
  risk:             AlertCircle,
  phone:            Phone,
  email:            Mail,
  seguimientos:     RefreshCw,
  tag:              BadgeCheck,
  priority:         Target,
  priority_order:   List,
  budget:           DollarSign,
  presupuesto:      DollarSign,
  project:          Building2,
  campaign:         Target,
  source:           Target,
  ai_agent:         Atom,
  last_activity:    Activity,
  days_inactive:    Clock,
  friction:         AlertCircle,
};

function describeAuditRow(row) {
  // INSERT / DELETE / SOFT_DELETE → títulos directos
  if (row.action === "INSERT")      return { Icon: Plus,    title: "Lead creado",     body: null,                                                color: "emerald" };
  if (row.action === "DELETE")      return { Icon: Trash2,  title: "Lead eliminado",  body: null,                                                color: "rose" };
  if (row.action === "SOFT_DELETE") return { Icon: Trash2,  title: "Movido a papelera", body: null,                                              color: "amber" };

  // UPDATE: detectar el campo más significativo y armar título humano
  const fields = row.changed_fields && typeof row.changed_fields === "object"
    ? Object.keys(row.changed_fields) : [];
  if (fields.length === 0) return { Icon: Pencil, title: "Modificado", body: null, color: "blue" };

  // Casos especiales con narrativa propia
  if (fields.includes("asesor_name")) {
    const c = row.changed_fields.asesor_name;
    return { Icon: UserCheck, title: "Reasignado", body: `${fmtCell(c?.old) || "Sin asesor"} → ${fmtCell(c?.new) || "Sin asesor"}`, color: "violet" };
  }
  if (fields.includes("stage")) {
    const c = row.changed_fields.stage;
    return { Icon: Waypoints, title: "Cambio de etapa", body: `${fmtCell(c?.old) || "—"} → ${fmtCell(c?.new) || "—"}`, color: "blue" };
  }
  if (fields.includes("next_action")) {
    const c = row.changed_fields.next_action;
    return { Icon: Zap, title: "Próxima acción", body: fmtCell(c?.new) || "—", color: "accent" };
  }
  if (fields.includes("seguimientos")) {
    const c = row.changed_fields.seguimientos;
    return { Icon: RefreshCw, title: "Seguimiento registrado", body: `Total: ${fmtCell(c?.new) || "?"}`, color: "blue" };
  }
  if (fields.includes("notas") && fields.length === 1) {
    return { Icon: FileText, title: "Notas del expediente actualizadas", body: null, color: "blue" };
  }
  if (fields.includes("phone")) {
    const c = row.changed_fields.phone;
    return { Icon: Phone, title: "Teléfono actualizado", body: fmtCell(c?.new) || "—", color: "blue" };
  }
  if (fields.includes("email")) {
    const c = row.changed_fields.email;
    return { Icon: Mail, title: "Correo actualizado", body: fmtCell(c?.new) || "—", color: "blue" };
  }
  if (fields.includes("score")) {
    const c = row.changed_fields.score;
    return { Icon: Star, title: "Score", body: `${fmtCell(c?.old) ?? "—"} → ${fmtCell(c?.new) ?? "—"}`, color: "amber" };
  }

  // Fallback genérico: lista de campos modificados
  const labels = fields.slice(0, 3).map(fieldLabel).join(", ") + (fields.length > 3 ? "…" : "");
  const Icon = ACTIVITY_ICON_FOR_FIELD[fields[0]] || Pencil;
  return { Icon, title: "Modificado", body: labels, color: "blue" };
}

function fmtCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 60 ? s.slice(0, 57) + "…" : s;
    } catch { return String(v); }
  }
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

const LeadActivityTimeline = ({ lead, T = P, maxItems = 8 }) => {
  const isLight = T !== P;
  const { user } = useAuth();
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(false);

  // Fetch audit log — skip en demo o si el id no es UUID
  useEffect(() => {
    if (!lead?.id) { setLoading(false); return; }
    if (user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead.id))) {
      setAuditRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getEntityHistory("leads", lead.id, 100).then(({ data }) => {
      if (cancelled) return;
      setAuditRows(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lead?.id, user?.isDemo]);

  // Normalizar audit_log + actionHistory a una timeline única
  const events = useMemo(() => {
    const out = [];
    for (const row of auditRows) {
      const d = describeAuditRow(row);
      out.push({
        id:    row.id || `audit-${row.created_at}-${row.action}`,
        ts:    row.created_at ? new Date(row.created_at).getTime() : 0,
        source: "audit",
        Icon:  d.Icon,
        color: d.color,
        title: d.title,
        body:  d.body,
        actor: row.actor_name || null,
        date:  row.created_at,
      });
    }
    const local = Array.isArray(lead?.actionHistory) ? lead.actionHistory : [];
    for (const e of local) {
      const ts = new Date(e.completed_at || e.doneAt || e.done_at || e.created_at || 0).getTime();
      const isCompleted = e.type === "tarea" || e.type === "completada";
      const Icon = isCompleted ? CheckCircle2
        : e.type === "seguimiento" ? RefreshCw
        : e.type === "etapa"       ? Waypoints
        : Zap;
      const color = isCompleted ? "accent"
        : e.type === "seguimiento" ? "blue"
        : e.type === "etapa"       ? "violet"
        : "accent";
      out.push({
        id:    e.id || `local-${ts}-${e.action || ""}`,
        ts,
        source: "local",
        Icon, color,
        title: e.type === "tarea" ? "Tarea completada"
             : e.type === "seguimiento" ? "Seguimiento"
             : e.type === "etapa" ? "Cambio de etapa"
             : "Acción registrada",
        body:  e.action || null,
        actor: e.by || null,
        date:  e.completed_at || e.doneAt || e.done_at || e.created_at || null,
      });
    }
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [auditRows, lead?.actionHistory]);

  const colorOf = (key) => ({
    emerald: T.emerald || T.accent,
    accent:  T.accent,
    blue:    T.blue,
    violet:  T.violet || T.blue,
    amber:   T.amber,
    rose:    T.rose || "#F87171",
  }[key] || T.accent);

  if (loading) {
    return (
      <div style={{ padding: "16px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.glass, color: T.txt3, fontSize: 12, fontFamily: font, textAlign: "center" }}>
        Cargando historial…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ borderRadius: 12, border: `1px dashed ${T.border}`, padding: "14px 16px", background: T.glass }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Activity size={12} color={T.txt3} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>Sin actividad registrada</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
          Cada cambio (reasignación, etapa, notas, próxima acción, etc.) se registrará aquí automáticamente.
        </p>
      </div>
    );
  }

  const shown = expanded ? events : events.slice(0, maxItems);

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", background: T.glass }}>
      {/* Subtle inner header: count + ordering hint */}
      <div style={{ padding: "10px 15px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={12} color={T.txt3} strokeWidth={2} />
        <span style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>Línea de tiempo</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}28`, padding: "1px 7px", borderRadius: 99, fontFamily: fontDisp }}>{events.length}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: T.txt3, fontFamily: font, opacity: 0.7 }}>más reciente arriba</span>
      </div>

      <div>
        {shown.map((ev, i) => {
          const col     = colorOf(ev.color);
          const Icon    = ev.Icon || Activity;
          const colSafe = isLight ? `color-mix(in srgb, ${col} 62%, #0B1220 38%)` : col;
          const isLast  = i === shown.length - 1;
          const dateStr = ev.date ? new Date(ev.date).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
          return (
            <div key={ev.id} style={{ display: "flex", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
              <div style={{ width: 42, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", flexShrink: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${col}14`, border: `1px solid ${col}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={11} color={colSafe} strokeWidth={2.2} />
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 8, background: T.border, marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, padding: "10px 14px 10px 0", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: colSafe, background: `${col}14`, border: `1px solid ${col}28`, padding: "1px 6px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: fontDisp }}>
                    {ev.title}
                  </span>
                  {ev.actor && (
                    <span style={{ fontSize: 9, color: T.txt3, fontFamily: font }}>· {ev.actor}</span>
                  )}
                </div>
                {ev.body && (
                  <p style={{ margin: 0, fontSize: 12.5, color: T.txt, fontFamily: font, lineHeight: 1.4, wordBreak: "break-word" }}>{ev.body}</p>
                )}
                {dateStr && (
                  <p style={{ margin: "3px 0 0", fontSize: 9.5, color: T.txt3, fontFamily: fontDisp }}>{dateStr}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {events.length > maxItems && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ width: "100%", padding: "9px 15px", background: "transparent", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", color: T.txt3, fontSize: 11, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = T.glassH}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {expanded ? "Ver menos" : `Ver ${events.length - maxItems} registro${events.length - maxItems !== 1 ? "s" : ""} más`}
          <ChevronDown size={11} strokeWidth={2.5} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   SectionLabel — micro-encabezado consistente para las secciones del
   Expediente y del Perfil. Aesthetic minimalista: icono pequeño + texto
   uppercase pequeño. Sin chrome. Reutilizable.
   ────────────────────────────────────────────────────────────────────── */
const SectionLabel = ({ icon: Icon, children, T = P }) => (
  <p style={{
    margin: "0 0 8px",
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 10, fontWeight: 800, color: T.txt3,
    letterSpacing: "0.08em", textTransform: "uppercase",
    fontFamily: fontDisp,
  }}>
    {Icon && <Icon size={11} strokeWidth={2.2} />}
    {children}
  </p>
);

/* ═══════════════════════════════════════════
   AsesorPicker — pill clickable con avatar + dropdown buscable
   ═══════════════════════════════════════════
   Reasignación intuitiva del asesor de un lead.
   - Trigger: pill compacto con avatar (iniciales) + nombre + chevron.
   - Popover: búsqueda + lista con avatares + "Crear nuevo" opcional.
   - Si el usuario actual es el asesor del lead y elige otro, muestra
     aviso inline (la RLS removerá su acceso después de la transferencia).
   - Colores de avatar hasheados a la paleta verde/azul/naranja. */
const ASESOR_AVATAR_PALETTE = ["#3B82F6", "#10B981", "#FB923C", "#06B6D4", "#34D399", "#FBBF24", "#60A5FA", "#4ADE80"];
const hashAsesorColor = (name) => {
  if (!name) return "#94A3B8";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ASESOR_AVATAR_PALETTE[Math.abs(h) % ASESOR_AVATAR_PALETTE.length];
};
const asesorInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase() || parts[0][0].toUpperCase();
};

const AsesorPicker = ({
  value,
  options = [],
  onChange,
  currentUserName = null,
  allowCreate = true,
  fullWidth = false,
  size = "md",
  placeholder = "Sin asesor",
  T = P,
  isLight = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false); setQ("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const trimmedQ = q.trim();
  const filtered = (options || []).filter(o => !trimmedQ || o.toLowerCase().includes(trimmedQ.toLowerCase()));
  const showCreate = allowCreate && trimmedQ && !options.some(o => o.toLowerCase() === trimmedQ.toLowerCase());

  const isOwnLead = !!(currentUserName && value && value === currentUserName);

  const commit = (next) => {
    const n = String(next || "").trim();
    if (!n || n === value) { setOpen(false); setQ(""); return; }
    if (isOwnLead && n !== currentUserName) {
      const ok = typeof window !== "undefined" && window.confirm(
        `Vas a transferir este lead a ${n}.\n\nDespués de la reasignación ya no podrás ver este lead.\n\n¿Confirmar la transferencia?`
      );
      if (!ok) return;
    }
    onChange?.(n);
    setOpen(false); setQ("");
  };

  const avatarSize = size === "sm" ? 18 : 22;
  const pillFontSize = size === "sm" ? 11 : 12;
  const currentColor = hashAsesorColor(value);
  const pillBorder = value ? `${currentColor}40` : T.border;
  const pillBg     = isLight ? `${currentColor}10` : `${currentColor}14`;
  const pillBgH    = isLight ? `${currentColor}1C` : `${currentColor}22`;
  const pillTxt    = isLight ? `color-mix(in srgb, ${currentColor} 58%, #0B1220 42%)` : T.txt;

  return (
    <span
      ref={wrapperRef}
      style={{
        position: "relative",
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={value ? `Asesor: ${value} — click para reasignar` : "Asignar asesor"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "3px 9px 3px 3px", borderRadius: 99,
          background: pillBg,
          border: `1px solid ${pillBorder}`,
          color: pillTxt,
          fontSize: pillFontSize, fontWeight: 600, fontFamily: font,
          cursor: "pointer", outline: "none",
          transition: "all 0.15s",
          width: fullWidth ? "100%" : undefined,
          justifyContent: fullWidth ? "space-between" : undefined,
          boxSizing: "border-box",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = pillBgH; }}
        onMouseLeave={e => { e.currentTarget.style.background = pillBg; }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{
            width: avatarSize, height: avatarSize, borderRadius: "50%",
            background: value ? currentColor : `${T.txt3}40`,
            color: "#FFFFFF",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.round(avatarSize * 0.45), fontWeight: 800, fontFamily: fontDisp,
            flexShrink: 0,
            letterSpacing: "0.01em",
          }}>
            {value ? asesorInitials(value) : "?"}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown size={11} strokeWidth={2.4} style={{ opacity: 0.55, flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            minWidth: 260, maxWidth: 320,
            zIndex: 510,
            background: isLight ? "#FFFFFF" : "#111318",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 12,
            boxShadow: isLight
              ? "0 4px 12px rgba(15,23,42,0.08), 0 20px 40px rgba(15,23,42,0.10)"
              : "0 20px 44px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
            overflow: "hidden",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            animation: "fadeIn 0.14s ease",
          }}
        >
          <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"}` }}>
            <input
              autoFocus
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar asesor…"
              onKeyDown={e => {
                if (e.key === "Escape") { setOpen(false); setQ(""); }
                if (e.key === "Enter") {
                  if (filtered[0] && !showCreate) commit(filtered[0]);
                  else if (showCreate) commit(trimmedQ);
                }
              }}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 8,
                background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"}`,
                color: T.txt, fontSize: 12, fontFamily: font, outline: "none",
                boxSizing: "border-box",
              }}
            />
            {isOwnLead && (
              <div style={{
                marginTop: 8, padding: "6px 9px", borderRadius: 7,
                background: isLight ? "#FB923C18" : "#FB923C16",
                border: `1px solid #FB923C40`,
                color: isLight ? "color-mix(in srgb, #FB923C 55%, #0B1220 45%)" : "#FB923C",
                fontSize: 10.5, fontFamily: font, lineHeight: 1.4,
              }}>
                Si transfieres este lead dejarás de poder verlo.
              </div>
            )}
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", padding: "4px 0" }}>
            {filtered.length === 0 && !showCreate && (
              <div style={{ padding: "16px 12px", fontSize: 11.5, color: T.txt3, fontFamily: font, textAlign: "center" }}>
                Sin resultados
              </div>
            )}
            {filtered.map(name => {
              const isCurrent = name === value;
              const c = hashAsesorColor(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => commit(name)}
                  style={{
                    width: "100%", padding: "8px 12px",
                    border: "none", background: isCurrent
                      ? (isLight ? `${c}14` : `${c}1C`)
                      : "transparent",
                    color: T.txt, fontSize: 12.5, fontFamily: font, fontWeight: isCurrent ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 9,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: c, color: "#FFFFFF",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, fontFamily: fontDisp,
                    flexShrink: 0,
                  }}>
                    {asesorInitials(name)}
                  </span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  {isCurrent && <Check size={13} color={c} strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>

          {showCreate && (
            <div style={{ borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"}` }}>
              <button
                type="button"
                onClick={() => commit(trimmedQ)}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "none", background: "transparent",
                  color: T.accent, fontSize: 12, fontFamily: font, fontWeight: 700,
                  cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? `${T.accent}10` : `${T.accent}14`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <Plus size={13} strokeWidth={2.4} />
                <span>Crear "{trimmedQ}"</span>
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

/* ─── CollapsibleSectionToggle ─────────────────────────────────────────
   Header de sección colapsable estilo accordion: ícono · etiqueta · chip
   opcional de conteo · chevron rotativo. Solid border + glass background
   para leerse como un header real, no como un botón secundario.
   Patrón único que comparten cronograma · datos generales · historial.
   ─────────────────────────────────────────────────────────────────── */
const CollapsibleSectionToggle = ({ expanded, onToggle, label, icon: Icon, count, T = P }) => {
  const isLight = T !== P;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      style={{
        width: "100%",
        padding: "11px 14px",
        borderRadius: 11,
        background: expanded ? T.glassH : T.glass,
        border: `1px solid ${expanded ? T.borderH : T.border}`,
        color: expanded ? T.txt2 : T.txt3,
        fontSize: 12, fontWeight: 700,
        fontFamily: fontDisp, letterSpacing: "0.01em",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        transition: "all 0.18s",
        textAlign: "left",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt2; e.currentTarget.style.borderColor = T.borderH; }}
      onMouseLeave={e => { e.currentTarget.style.background = expanded ? T.glassH : T.glass; e.currentTarget.style.color = expanded ? T.txt2 : T.txt3; e.currentTarget.style.borderColor = expanded ? T.borderH : T.border; }}
    >
      {Icon && (
        <span style={{
          width: 22, height: 22, borderRadius: 7,
          background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={12} strokeWidth={2.2} color={expanded ? T.txt2 : T.txt3} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {typeof count === "number" && count > 0 && (
        <span style={{
          padding: "2px 8px",
          borderRadius: 99,
          background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)",
          color: T.txt2,
          fontSize: 10, fontWeight: 800, letterSpacing: "0.02em",
          fontFamily: fontDisp, flexShrink: 0,
        }}>{count}</span>
      )}
      <ChevronDown
        size={14} strokeWidth={2.3}
        color={expanded ? T.txt2 : T.txt3}
        style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
    </button>
  );
};

/* ─── DiscoveryGeneralData ─────────────────────────────────────────────
   Bloque "Datos generales del cliente" que vive al final del drawer
   Discovery (Duke). Muestra contacto + perfil + riesgo + última
   actividad, todo editable inline. Aesthetic minimal: pares label/valor
   en grid, sin chrome pesado.
   ─────────────────────────────────────────────────────────────────── */
const DiscoveryGeneralData = ({ lead, onUpdate, T = P, isLight = false }) => {
  if (!lead) return null;
  const labelC = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";
  const cardBg = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)";
  const Field = ({ label, value, onSave, placeholder, emptyText, multiline = false, rows = 2 }) => (
    <div style={{
      padding: "11px 13px",
      borderRadius: 11,
      background: cardBg,
      border: `1px solid ${T.border}`,
      minWidth: 0,
    }}>
      <p style={{
        margin: 0,
        marginBottom: 5,
        fontSize: 9.5, fontWeight: 800,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: labelC, fontFamily: fontDisp,
      }}>{label}</p>
      <div style={{ fontSize: 12.5, color: T.txt2, lineHeight: 1.55, wordBreak: "break-word" }}>
        <InlineEdit
          value={value}
          onSave={onSave}
          T={T} isLight={isLight}
          multiline={multiline} rows={rows}
          placeholder={placeholder}
          emptyText={emptyText}
          readStyle={{ fontSize: 12.5, width: "100%", display: "block" }}
          editStyle={{ fontSize: 12.5 }}
        />
      </div>
    </div>
  );

  return (
    <div>
      {/* Contacto: grid 2 columnas en desktop, 1 en mobile */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10, marginBottom: 10,
      }}>
        <Field
          label="Teléfono"
          value={lead.phone}
          onSave={v => onUpdate?.({ ...lead, phone: v })}
          placeholder="+1 555 ..."
          emptyText="+ Agregar teléfono"
        />
        <Field
          label="Correo"
          value={lead.email}
          onSave={v => onUpdate?.({ ...lead, email: v })}
          placeholder="cliente@correo.com"
          emptyText="+ Agregar correo"
        />
        <Field
          label="Etiqueta"
          value={lead.tag}
          onSave={v => onUpdate?.({ ...lead, tag: v })}
          placeholder="VIP, referido, web..."
          emptyText="+ Agregar etiqueta"
        />
        <Field
          label="Campaña / Fuente"
          value={lead.campana || lead.campaign || lead.source}
          onSave={v => onUpdate?.({ ...lead, campana: v, campaign: v })}
          placeholder="Google, referido..."
          emptyText="+ Agregar fuente"
        />
        <Field
          label="Fricción"
          value={lead.friction}
          onSave={v => onUpdate?.({ ...lead, friction: v })}
          placeholder="Bajo · Medio · Alto"
          emptyText="+ Calificar fricción"
        />
      </div>

      {/* Perfil del cliente (bio) — full width, textarea ampliable */}
      <div style={{ marginBottom: 10 }}>
        <Field
          label="Perfil del cliente"
          value={lead.bio}
          onSave={v => onUpdate?.({ ...lead, bio: v })}
          placeholder="Describe al cliente: necesidad, contexto, objeciones..."
          emptyText="+ Agregar perfil del cliente"
          multiline rows={4}
        />
      </div>

      {/* Riesgo identificado — destacado en ámbar para llamar la atención */}
      <div style={{
        padding: "11px 13px", borderRadius: 11, marginBottom: 10,
        background: isLight ? `${T.amber}10` : `${T.amber}0A`,
        border: `1px solid ${T.amber}${isLight ? "32" : "22"}`,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <AlertCircle size={13} color={isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber} strokeWidth={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: 0, marginBottom: 4,
            fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
            color: isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber,
            fontFamily: fontDisp,
          }}>Riesgo identificado</p>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6, wordBreak: "break-word" }}>
            <InlineEdit
              value={lead.risk}
              onSave={v => onUpdate?.({ ...lead, risk: v })}
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

      {/* Última actividad — chip horizontal compacto */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center",
        padding: "9px 12px", borderRadius: 11,
        background: T.glass, border: `1px solid ${T.border}`,
      }}>
        <Activity size={12} color={T.txt3} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: 0, marginBottom: 2,
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
            color: T.txt3, fontFamily: fontDisp,
          }}>Última actividad</p>
          <div style={{ fontSize: 11.5, color: T.txt2, lineHeight: 1.4, wordBreak: "break-word" }}>
            <InlineEdit
              value={lead.lastActivity}
              onSave={v => onUpdate?.({ ...lead, lastActivity: v })}
              T={T} isLight={isLight}
              placeholder="Llamada, WhatsApp, visita..."
              emptyText="+ Registrar última actividad"
              readStyle={{ fontSize: 11.5, width: "100%" }}
              editStyle={{ fontSize: 11.5 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const NotesModal = ({ lead, onClose, onSave, onUpdate, onSwitchTab, onShowHistory, onDelete, asesoresMaster = [], currentUserName = null, discoverySimplified = false, centered = false, T = P }) => {
  const isMobile = useIsMobile();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Llamadas programadas (Retell) — pendientes para este lead.
  const { get: getScheduledCall } = useScheduledCalls();
  const scheduledCallNM = getScheduledCall(lead);
  // El bloque de llamadas de voz (LeadVoiceCalls — audio + transcripción
  // de Retell IA) solo lo muestra la cuenta de iAgents, donde vive la
  // conexión con Retell. Los asesores normales no necesitan ver ese panel
  // y mantenemos la UI más limpia.
  const { user: notesUser } = useAuth();
  const canSeeVoiceCalls = canTriggerIaActions(notesUser);

  // ══════════════════════════════════════════════════════════════════════
  // EXPEDIENTE EN TEXTO PLANO + AUTO-SAVE PROFESIONAL
  // ══════════════════════════════════════════════════════════════════════
  // Diseño: textarea siempre editable. El asesor escribe lo que pasó con
  // el cliente — sin Telegram, sin voz, sin IA. Texto plano y listo.
  //
  // Garantías de persistencia:
  //  · Auto-save con debounce 1.5s (cualquier pausa de tipeo guarda)
  //  · Save forzado on blur (al hacer click fuera del textarea)
  //  · Save forzado on close (espera el flush antes de desmontar)
  //  · beforeunload: si hay cambios pendientes, el navegador advierte
  //  · saveStatus visible: idle/saving/saved/error con timestamp
  //
  // Si Supabase falla, updateLead encola el cambio en localStorage
  // (lib/offline-mode.js) y reintenta cuando vuelve la conexión.
  // ══════════════════════════════════════════════════════════════════════
  const [notesDraft, setNotesDraft] = useState(lead?.notas || "");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null);
  // En modo Discovery simplificado, las secciones secundarias viven
  // colapsadas por default. Cada una expone un toggle "Ver / Ocultar"
  // estilo dashed-button para revelarse sin quitar espacio al flujo
  // principal (próxima acción + notas).
  const [showMoreNotes, setShowMoreNotes]     = useState(!discoverySimplified);
  const [showGeneralData, setShowGeneralData] = useState(!discoverySimplified);
  const [showHistorial, setShowHistorial]     = useState(!discoverySimplified);
  // Trigger contador para arrancar el modo "agregar nota" dentro del
  // cronograma desde un CTA primario en el header. Bump → LeadNotesTimeline
  // auto-inicia su flujo de captura.
  const [addNoteTrigger, setAddNoteTrigger] = useState(0);
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const currentLeadIdRef = useRef(lead?.id);

  // Si cambia el lead activo (drawer abierto a otro lead), reset draft
  useEffect(() => {
    if (currentLeadIdRef.current !== lead?.id) {
      currentLeadIdRef.current = lead?.id;
      setNotesDraft(lead?.notas || "");
      setSaveStatus("idle");
      setLastSavedAt(null);
      dirtyRef.current = false;
    }
  }, [lead?.id, lead?.notas]);

  // Si lead.notas cambia desde fuera (otro device, sync) y NO estoy editando,
  // refresca el draft. Si dirtyRef=true, mantengo mi edición local.
  useEffect(() => {
    if (!dirtyRef.current && lead?.notas !== undefined && lead.notas !== notesDraft) {
      setNotesDraft(lead.notas || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.notas]);

  // Función de guardado — idempotente, segura para llamarse múltiples veces
  const flushSave = useCallback(() => {
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setSaveStatus("saving");
    try {
      onSave?.(notesDraft);
      dirtyRef.current = false;
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    } catch (e) {
      setSaveStatus("error");
    }
  }, [onSave, notesDraft]);

  // Debounce 1.5s después de cada cambio de tipeo
  const handleChange = (val) => {
    setNotesDraft(val);
    dirtyRef.current = true;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        onSave?.(val);
        dirtyRef.current = false;
        setSaveStatus("saved");
        setLastSavedAt(Date.now());
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
  };

  // Beforeunload: si hay cambios pendientes, avisa al usuario antes de cerrar
  useEffect(() => {
    const handler = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "Tienes cambios sin guardar en el expediente.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Wrap onClose para forzar flush
  const safeClose = () => {
    flushSave();
    onClose?.();
  };

  // Cleanup al desmontar
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (dirtyRef.current) onSave?.(notesDraft); // last-chance flush
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lead) return null;

  const isLight = T !== P;
  const titleC = isLight ? T.txt : "#FFFFFF";

  return createPortal(
    <>
      <div onClick={safeClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: T === P ? "rgba(2,5,12,0.5)" : "rgba(15,23,42,0.32)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={isMobile ? {
        // ── MOBILE: bottom-sheet full-width que ocupa 92% del viewport ──
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 401,
        height: "92dvh", maxHeight: "92dvh",
        background: T === P ? "#111318" : "#FFFFFF",
        borderTop: `1px solid ${T.borderH}`,
        borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column",
        animation: "slideInUp 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "0 -24px 80px rgba(0,0,0,0.55)" : "0 -16px 60px rgba(15,23,42,0.16)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      } : centered ? {
        // ── DESKTOP (centered): modal casi-fullscreen centrado ──
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401,
        width: "min(960px, 94vw)", height: "min(880px, 90vh)", maxHeight: "90vh",
        background: T === P ? "#111318" : "#FFFFFF",
        border: `1px solid ${T.borderH}`,
        borderRadius: 20,
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "modalPop 0.26s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "0 40px 120px rgba(0,0,0,0.62)" : "0 40px 120px rgba(15,23,42,0.18)",
      } : {
        // ── DESKTOP: drawer lateral 460px ──
        position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 460,
        background: T === P ? "#111318" : "#FFFFFF",
        borderLeft: `1px solid ${T.borderH}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.5)" : "-24px 0 80px rgba(15,23,42,0.12)",
      }}>
        <style>{`
          @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
          @keyframes slideInUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
          @keyframes modalPop{from{transform:translate(-50%,-50%) scale(0.97);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
        `}</style>
        {isMobile && (
          /* Drag handle visual — el sheet es full-width así que el handle solo es indicador */
          <div style={{ padding: "8px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: T === P ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)" }} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            HEADER MINIMAL — el nombre del cliente es lo único que importa.
            Acciones (chip de guardado, eliminar, cerrar) van pegadas a la
            derecha sin etiquetas redundantes. La info secundaria (asesor,
            etapa, presupuesto) vive en una sub-línea ligera. ════════════ */}
        <div style={{ padding: isMobile ? "10px 16px 14px" : "18px 24px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            {/* Izquierda: avatar + nombre + sub-línea */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <div style={{
                width: isMobile ? 40 : 44, height: isMobile ? 40 : 44, borderRadius: 12,
                background: isLight
                  ? `linear-gradient(145deg, ${T.blue}1A 0%, ${T.blue}0D 100%)`
                  : `linear-gradient(145deg, ${T.blue}24 0%, ${T.blue}10 100%)`,
                border: `1px solid ${isLight ? `${T.blue}38` : `${T.blue}44`}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 16 : 18, fontWeight: 700,
                color: isLight ? `color-mix(in srgb, ${T.blue} 60%, #0B1220 40%)` : T.blue,
                fontFamily: fontDisp, flexShrink: 0,
                boxShadow: isLight ? `0 1px 2px ${T.blue}18, inset 0 1px 0 rgba(255,255,255,0.6)` : "none",
                letterSpacing: "-0.02em",
              }}>{(lead.n || "?").charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 19,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: titleC,
                  fontFamily: fontDisp,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}>
                  <InlineEdit value={lead.n} onSave={v => onUpdate?.({...lead, n: v})} T={T} isLight={isLight} placeholder="Nombre" />
                </h2>
                <div style={{
                  marginTop: 3, fontSize: 11.5, color: T.txt3,
                  fontFamily: font, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                }}>
                  {/* Reasignar asesor — habilitado para todos. La RLS asegura
                      que un asesor solo puede modificar leads que le pertenecen,
                      y al transferir uno propio pierde acceso (avisamos antes). */}
                  <AsesorPicker
                    value={lead.asesor}
                    options={asesoresMaster}
                    onChange={v => onUpdate?.({ ...lead, asesor: v })}
                    currentUserName={currentUserName}
                    T={T} isLight={isLight}
                    size="sm"
                  />
                  {(lead.budget || lead.presupuesto) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <InlineEdit
                        value={lead.budget}
                        onSave={v => {
                          const parsed = parseBudget(v);
                          onUpdate?.({...lead, budget: parsed ? formatBudget(parsed) : v, presupuesto: parsed || lead.presupuesto || 0 });
                        }}
                        T={T} isLight={isLight} placeholder="300k · 1.5M" emptyText="Sin presupuesto"
                      />
                    </>
                  )}
                  {!!zoomEventsOf(lead).done && (
                    <span title="Este cliente ya pasó por Zoom (concretado o etapa posterior)" style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.01em",
                      color: "#10B981", background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.32)", padding: "2px 9px",
                      borderRadius: 99, whiteSpace: "nowrap",
                    }}><CheckCircle2 size={11} strokeWidth={2.5} /> Zoom Realizado</span>
                  )}
                </div>
              </div>
            </div>

            {/* Derecha: chip estado + acciones — apilados muy compactos */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {typeof onDelete === 'function' && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    title={L.deleteEntity}
                    aria-label="Eliminar cliente"
                    style={{
                      width: 32, height: 32, borderRadius: 9,
                      border: `1px solid ${T.border}`, background: "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.18s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.45)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "transparent"; }}
                  >
                    <Trash2 size={14} color="#EF4444" strokeWidth={2.2} />
                  </button>
                )}
                <button onClick={safeClose} title="Cerrar" aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.borderColor = T.borderH; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}
                ><X size={14} color={T.txt3} /></button>
              </div>
              {/* Chip de estado de guardado — solo aparece cuando hay actividad */}
              {saveStatus !== "idle" && (
                <span
                  title={lastSavedAt ? `Último guardado: ${new Date(lastSavedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 99,
                    fontSize: 10, fontWeight: 700, fontFamily: fontDisp,
                    letterSpacing: "0.02em", whiteSpace: "nowrap",
                    border: `1px solid ${
                      saveStatus === "saved" ? `${T.accent}${isLight ? "44" : "38"}` :
                      saveStatus === "error" ? "rgba(239,68,68,0.4)" :
                      T.border
                    }`,
                    background:
                      saveStatus === "saved" ? `${T.accent}${isLight ? "12" : "0E"}` :
                      saveStatus === "error" ? "rgba(239,68,68,0.10)" :
                      T.glass,
                    color:
                      saveStatus === "saved" ? (isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent) :
                      saveStatus === "error" ? "#F87171" : T.txt3,
                  }}
                >
                  {saveStatus === "saving" && <>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${T.txt3}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                    Guardando…
                  </>}
                  {saveStatus === "saved" && <><Check size={10} strokeWidth={3} /> Guardado</>}
                  {saveStatus === "error" && <><AlertCircle size={10} strokeWidth={2.5} /> Sin guardar</>}
                </span>
              )}
            </div>
          </div>

          {/* Modal de confirmación soft-delete */}
          {confirmDelete && (
            <div onClick={() => setConfirmDelete(false)} style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}>
              <div onClick={e => e.stopPropagation()} style={{
                width: "min(380px, 100%)", padding: 22, borderRadius: 16,
                background: T === P ? "#0F1419" : "#FFFFFF",
                border: `1px solid ${T.borderH}`,
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.32)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}>
                  <Trash2 size={20} color="#EF4444" />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                  ¿Eliminar a {lead.n}?
                </h3>
                <p style={{ margin: "8px 0 18px", fontSize: 12.5, color: T.txt2, lineHeight: 1.5 }}>
                  Se moverá a la <strong style={{ color: T.txt }}>Papelera</strong>. Podrás restaurarlo en cualquier momento desde ahí.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${T.border}`, background: "transparent",
                    color: T.txt2, fontSize: 13, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer",
                  }}>Cancelar</button>
                  <button onClick={async () => {
                    setConfirmDelete(false);
                    await onDelete?.(lead);
                    onClose?.();
                  }} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.4)",
                    background: "rgba(239,68,68,0.18)",
                    color: "#FCA5A5", fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  }}>Sí, eliminar</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            CUERPO DE DISCOVERY — una sola sección scrolleable. Próxima
            acción siempre arriba. Tareas se oculta si discoverySimplified.
              1. Próxima acción (qué hago AHORA)
              2. Etapa + seguimientos (cómo voy)
              3. Notas del expediente + cronograma (dónde anoto todo)
              4. Tareas (opcional, gated por crm.discoverySimplified)
              5. Historial de acciones (solo si hay registros)
            ════════════════════════════════════════════════════════════════ */}
        <div style={{ padding: isMobile ? "16px 16px 110px" : "18px 24px 90px", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 1. PRÓXIMA ACCIÓN — hero mint, lo primero accionable */}
          <NextActionHero lead={lead} T={T} onUpdate={onUpdate} />

          {/* 1.5. PERFILAMIENTO IA — perfilamiento extraído por Retell desde
              la llamada de voz. Solo aparece si discovery_data tiene contenido
              (la mayoría de leads no lo tendrán). */}
          <LeadDiscoveryPanel lead={lead} T={T} isLight={isLight} />

          {/* 2. ETAPA + SEGUIMIENTOS — pills compactos.
              RequiresHumanButton: solo visible para iagents@stratos.ai. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            <FollowUpBadge lead={lead} onUpdate={onUpdate} T={T} />
            <StageBadge lead={lead} onUpdate={onUpdate} T={T} />
            <RequiresHumanButton lead={lead} onUpdate={onUpdate} T={T} isLight={isLight} />
          </div>

          {/* 3. NOTAS DEL EXPEDIENTE — textarea siempre editable, auto-save.
              Es la sección estrella: aquí el asesor escribe TODO lo que
              pasó con el cliente (contexto, conversaciones, decisiones).
              Sin Telegram, sin voz, sin IA. Texto plano y persistente.

              Debajo aparece un CRONOGRAMA de notas individuales (botón
              "+ Agregar nota") — cada una con fecha y hora. El asesor
              decide: el textarea es para "todo el contexto narrativo
              acumulado", las notas separadas son para "anotaciones
              fechadas tipo registro de interacción". */}
          <div>
            <SectionLabel T={T} icon={FileText}>Notas del expediente</SectionLabel>
            <textarea
              value={notesDraft}
              onChange={e => handleChange(e.target.value)}
              onBlur={flushSave}
              placeholder={"Escribe lo que pasó con el cliente: contexto, conversaciones, objeciones, decisiones, lo que sea relevante…"}
              spellCheck={true}
              style={{
                width: "100%",
                minHeight: isMobile ? 220 : 280,
                padding: "14px 16px",
                borderRadius: 12,
                background: isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
                color: T.txt,
                fontSize: isMobile ? 15 : 13.5,
                fontFamily: font,
                lineHeight: 1.7,
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                transition: "border-color 0.18s, background 0.18s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.045)"; }}
            />

            {/* CTA primario "+ Agregar nota adicional" + toggle subtle de
                cronograma. El CTA expande la timeline y arranca el flujo de
                captura en LeadNotesTimeline vía addNoteTrigger. */}
            {discoverySimplified && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowMoreNotes(true); setAddNoteTrigger(t => t + 1); }}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 11,
                    background: isLight ? `${T.accent}14` : `${T.accent}1A`,
                    border: `1px solid ${isLight ? `${T.accent}44` : `${T.accent}38`}`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 58%, #0B1220 42%)` : T.accent,
                    fontSize: 12.5, fontWeight: 700,
                    fontFamily: fontDisp, letterSpacing: "0.01em",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isLight ? `${T.accent}22` : `${T.accent}26`; e.currentTarget.style.borderColor = isLight ? `${T.accent}60` : `${T.accent}55`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isLight ? `${T.accent}14` : `${T.accent}1A`; e.currentTarget.style.borderColor = isLight ? `${T.accent}44` : `${T.accent}38`; }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Agregar nota adicional
                </button>

                <CollapsibleSectionToggle
                  expanded={showMoreNotes}
                  onToggle={() => setShowMoreNotes(v => !v)}
                  label={showMoreNotes ? "Cronograma de notas" : "Ver notas anteriores"}
                  icon={MessageCircle}
                  T={T}
                />
              </div>
            )}

            {/* Cronograma de notas individuales con fecha y hora.
                Si no estamos en Discovery simplificado, se muestra siempre
                (compat con clientes que no tienen el toggle). */}
            {showMoreNotes && (
              <div style={{ marginTop: 12 }}>
                <LeadNotesTimeline lead={lead} T={T} isLight={isLight} autoStartAdding={addNoteTrigger} />
              </div>
            )}
          </div>

          {/* 3.5. LLAMADAS DE VOZ — grabaciones de Retell IA con audio nativo
              + transcript colapsable. Gated por canTriggerIaActions: solo
              la cuenta iagents@stratos.ai (crm_only=true) ve este panel
              porque ahí vive la integración con Retell. Los asesores
              normales no lo necesitan. */}
          {canSeeVoiceCalls && (
            <LeadVoiceCalls lead={lead} T={T} isLight={isLight} />
          )}

          {/* La conversación WhatsApp · Chatwoot vivía aquí como accordion
              extra, pero el cliente prefirió no mostrarla a usuarios
              normales en el drawer de Discovery. La data sigue en
              expediente_items (tipo='historial_chat') y se accede desde
              el tab "Chat" del Perfil legacy. LeadVoiceCalls arriba
              mantiene el audio + transcripción de Retell intactos. */}

          {/* 4. TAREAS — checklist accionable. Gated por crm.discoverySimplified
              en la config del cliente. Duke lo tiene ON → sin Tareas en el drawer.
              Otros clientes (Grupo 28, etc.) mantienen el comportamiento histórico. */}
          {!discoverySimplified && (
            <div>
              <SectionLabel T={T} icon={CheckSquare}>Tareas</SectionLabel>
              <TaskChecklist lead={lead} onUpdate={onUpdate} T={T} />
            </div>
          )}

          {/* 5. DATOS GENERALES DEL CLIENTE — colapsable en Discovery
              simplificado (Duke). En otros clientes se muestra siempre
              (mantiene compat con el comportamiento histórico). */}
          {discoverySimplified ? (
            <div>
              <CollapsibleSectionToggle
                expanded={showGeneralData}
                onToggle={() => setShowGeneralData(v => !v)}
                label="Datos generales del cliente"
                icon={User}
                T={T}
              />
              {showGeneralData && (
                <div style={{ marginTop: 12 }}>
                  <DiscoveryGeneralData lead={lead} onUpdate={onUpdate} T={T} isLight={isLight} />
                </div>
              )}
            </div>
          ) : null}

          {/* 6. HISTORIAL DE ACCIONES — siempre al final.
              · En Discovery simplificado (Duke): colapsable + timeline
                unificada con audit_log de Supabase (reasignaciones,
                etapas, notas, próximas acciones, todo). Aparece siempre
                porque la timeline puede tener actividad desde audit_log
                aunque actionHistory esté vacío.
              · En otros clientes: render histórico de ActionTimeline solo
                si hay registros en actionHistory. */}
          {discoverySimplified ? (
            <div>
              <CollapsibleSectionToggle
                expanded={showHistorial}
                onToggle={() => setShowHistorial(v => !v)}
                label="Historial de acciones y actividades"
                icon={Clock}
                T={T}
              />
              {showHistorial && (
                <div style={{ marginTop: 12 }}>
                  <LeadActivityTimeline lead={lead} T={T} />
                </div>
              )}
            </div>
          ) : (
            Array.isArray(lead?.actionHistory) && lead.actionHistory.length > 0 && (
              <div>
                <SectionLabel T={T} icon={Clock}>Historial</SectionLabel>
                <ActionTimeline lead={lead} T={T} />
              </div>
            )
          )}
        </div>

        {/* Dynamic Island — pill principal "Discovery" + "Análisis IA". */}
        <DrawerTabIsland current="discovery" onSwitch={onSwitchTab} T={T} />
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

const LeadPanel = ({ lead, onClose, oc, onUpdate, onSwitchTab, onShowHistory, onDelete, asesoresMaster = [], currentUserName = null, T = P }) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const [confirmDeleteLP, setConfirmDeleteLP] = useState(false);
  const [form, setForm] = useState(null);
  // Llamadas programadas (Retell) — pendientes para este lead.
  const { get: getScheduledCall } = useScheduledCalls();
  const scheduledCall = getScheduledCall(lead);
  const [panelCopied, setPanelCopied] = useState(false);
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
      <div style={isMobile ? {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 401,
        height: "92dvh", maxHeight: "92dvh",
        background: T === P ? "#111318" : "#FFFFFF",
        borderTop: `1px solid ${T.borderH}`,
        borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column",
        animation: "slideInUp 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "0 -24px 80px rgba(0,0,0,0.55)" : "0 -16px 60px rgba(15,23,42,0.16)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      } : {
        position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 440,
        background: T === P ? "#111318" : "#FFFFFF",
        borderLeft: `1px solid ${T.borderH}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.5)" : "-24px 0 80px rgba(15,23,42,0.12)",
      }}>
        <style>{`
          @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
          @keyframes slideInUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        `}</style>
        {isMobile && (
          <div style={{ padding: "8px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: T === P ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ padding: isMobile ? "8px 16px 12px" : "18px 22px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {lead.tag === "requiere-humano" && (
                <span title="El bot pidió que un humano tome control de la conversación" style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
                  color: "#FFFFFF",
                  background: isLight ? "#DC2626" : "#EF4444",
                  border: `1px solid ${isLight ? "#B91C1C" : "#F87171"}`,
                  padding: "3px 9px", borderRadius: 99,
                  boxShadow: `0 0 0 2px ${isLight ? "rgba(220,38,38,0.14)" : "rgba(239,68,68,0.18)"}`,
                  textTransform: "uppercase",
                }}>🔥 Requiere Humano</span>
              )}
              {lead.hot && lead.tag !== "requiere-humano" && (
                <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accentB}`, padding: "2px 8px", borderRadius: 99 }}>HOT</span>
              )}
              {scheduledCall && (
                <ScheduledCallBadge scheduledAt={scheduledCall.scheduled_at} variant="drawer" T={T} isLight={isLight} />
              )}
              {lead.daysInactive >= 7 && <span style={{ fontSize: 9, fontWeight: 600, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 99 }}>{lead.daysInactive}d inactivo</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!editing && <button onClick={startEditing} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; e.currentTarget.style.borderColor = T.border; }}>Editar</button>}
              <button onClick={() => { navigator.clipboard?.writeText(buildTelegramSummary(lead)).then(() => { setPanelCopied(true); setTimeout(() => setPanelCopied(false), 1800); }); }} title="Copiar resumen para Telegram" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: panelCopied ? `${T.accent}18` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", color: panelCopied ? T.accent : T.txt3 }}
                onMouseEnter={e => e.currentTarget.style.background = panelCopied ? `${T.accent}22` : T.glassH}
                onMouseLeave={e => e.currentTarget.style.background = panelCopied ? `${T.accent}18` : "transparent"}
              >{panelCopied ? <Check size={13} strokeWidth={2.8} /> : <Copy size={13} strokeWidth={2} />}</button>
              {!editing && typeof onShowHistory === 'function' && (
                <button onClick={onShowHistory} title="Ver historial de cambios" aria-label="Historial" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.borderColor = T.borderH; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}
                ><Clock size={13} color={T.txt3} strokeWidth={2.2} /></button>
              )}
              {typeof onDelete === 'function' && (
                <button
                  onClick={() => setConfirmDeleteLP(true)}
                  title={L.deleteEntity}
                  aria-label="Eliminar cliente"
                  style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.45)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "transparent"; }}
                >
                  <Trash2 size={13} color="#EF4444" strokeWidth={2.2} />
                </button>
              )}
              <button onClick={onClose} title="Cerrar" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }} onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}><X size={13} color={T.txt3} /></button>
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
          <div style={{ marginBottom: 14 }}>
            <ScoreInput sc={sc} onUpdate={n => onUpdate?.({...lead, sc: n})} isLight={isLight} T={T} />
          </div>
          {/* CTAs de contacto en el Perfil — usan los mismos helpers que el
              Expediente: tel:, wa.me con código USA por default si falta,
              copiar al portapapeles, y mini-form para agregar si no hay
              número. Todo en una sola fila táctil-friendly (44px de alto). */}
          {(() => {
            const rawPhone   = (editing ? f("phone") : lead.phone) || "";
            const phoneClean = rawPhone.replace(/[^0-9+]/g, "");
            const waDigits   = rawPhone.replace(/[^0-9]/g, "");
            // 10 dígitos sin "+" → USA por default (mayoría de los clientes).
            const waPhone    = !waDigits ? "" :
              rawPhone.trim().startsWith("+") ? waDigits :
              waDigits.length === 10 ? `1${waDigits}` : waDigits;
            if (!phoneClean) {
              return <AddPhoneInline lead={lead} onUpdate={onUpdate} T={T} isLight={isLight} />;
            }
            return (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <CallActionButton
                  phone={phoneClean}
                  label="Llamar"
                  variant="compact"
                  T={T}
                  isLight={isLight}
                  warnZoom={lead.st === "Zoom Agendado"}
                />
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer"
                  style={{
                    flex: 1, minWidth: 110, height: 40,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "0 12px", borderRadius: 10,
                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${isLight ? "rgba(37,211,102,0.45)" : "rgba(255,255,255,0.12)"}`,
                    color: isLight ? "#128C7E" : "rgba(255,255,255,0.88)",
                    fontSize: 12, fontWeight: 700, fontFamily: fontDisp, textDecoration: "none",
                    transition: "all 0.18s",
                  }}
                ><MessageCircle size={12} strokeWidth={2.4} /> WhatsApp</a>
                <CopyPhoneButton phone={rawPhone} T={T} isLight={isLight} />
              </div>
            );
          })()}
        </div>

        {/* Sub-tabs: Datos · Chat · Documentos
            "Chat" muestra solo historial de WhatsApp/Chatwoot (note_type=historial_chat
            inyectado por n8n vía fn_add_lead_note). El badge cuenta los items de
            historial cargados — se actualiza dentro del componente cuando refresca. */}
        <div style={{ display: "flex", padding: "0 22px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 0 }}>
          {[["perfil","Datos",null],["chat","Chat",null],["docs","Documentos",expedienteItems.length]].map(([id,label,badge]) => {
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
                y cambiar el estatus sin abrir el modal de edición completa.
                RequiresHumanButton solo aparece para iagents@stratos.ai. ── */}
            <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              <FollowUpBadge lead={lead} onUpdate={onUpdate} T={T} />
              <StageBadge lead={lead} onUpdate={onUpdate} T={T} />
              <RequiresHumanButton lead={lead} onUpdate={onUpdate} T={T} isLight={isLight} />
            </div>

            {/* ── Lista de tareas — múltiples acciones por cliente.
                Cada tarea completada se registra automáticamente en el Expediente. ── */}
            <TaskChecklist lead={lead} onUpdate={onUpdate} T={T} />

            {/* ── Lista de acciones — historial cronológico también visible
                desde el Perfil para que el asesor pueda revisar lo que
                pasó con el cliente sin saltar al Expediente. ── */}
            <ActionTimeline lead={lead} T={T} maxItems={4} />

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
                  <p style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: fontDisp }}>{L.entityProfile}</p>
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
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, fontFamily: fontDisp }}>Asesor</p>
                <AsesorPicker
                  value={f("asesor")}
                  options={asesoresMaster}
                  onChange={v => sf("asesor")(v)}
                  currentUserName={currentUserName}
                  T={T} isLight={isLight}
                  fullWidth
                />
              </div>
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
              TAB: CHAT — Historial de WhatsApp/Chatwoot
              Render limpio, sin mezclar con notas humanas o resúmenes IA.
              Datos vienen de expediente_items donde tipo='historial_chat'.
          ══════════════════════════════════════════════════ */}
          {activeTab === "chat" && (
            <LeadChatHistory lead={lead} T={T} isLight={isLight} />
          )}

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

        {/* Dynamic Island — pill principal "Discovery" (agrupa Expediente +
            Perfil) y "Análisis IA". El sub-toggle del header permite al
            asesor moverse entre las dos sub-vistas de Discovery. */}
        {!editing && <DrawerTabIsland current="discovery" onSwitch={onSwitchTab} T={T} />}

        {/* ── UpdateChatPanel — panel deslizable para registrar actualizaciones ── */}
        {!editing && (
          <UpdateChatPanel
            isOpen={updateChatOpen}
            onClose={() => setUpdateChatOpen(false)}
            expedienteItems={expedienteItems}
            onAddItem={item => {
              setExpedienteItems(prev => [item, ...prev]);
              // Persistir el registro al actionHistory del lead para que
              // aparezca arriba en "Últimos registros" del Expediente.
              if (lead && typeof onUpdate === 'function') {
                const summary = (item.title || item.content || 'Registro nuevo')
                  .toString()
                  .slice(0, 200);
                const action = {
                  id: item.id?.toString() || genId(),
                  action: summary,
                  type: 'tarea',
                  doneAtFmt: item.fecha || fmtNow(),
                  completed_at: new Date().toISOString(),
                  date: '',
                };
                const prevHistory = Array.isArray(lead.actionHistory) ? lead.actionHistory : [];
                onUpdate({ ...lead, actionHistory: [action, ...prevHistory] });
              }
            }}
            onRemoveItem={id => setExpedienteItems(prev => prev.filter(x => x.id !== id))}
            T={T}
            lead={lead}
            onUpdate={onUpdate}
          />
        )}

        {/* Modal de confirmación soft-delete (LeadPanel) */}
        {confirmDeleteLP && (
          <div onClick={() => setConfirmDeleteLP(false)} style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "min(380px, 100%)", padding: 22, borderRadius: 16,
              background: T === P ? "#0F1419" : "#FFFFFF",
              border: `1px solid ${T.borderH}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.32)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}>
                <Trash2 size={20} color="#EF4444" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                ¿Eliminar a {lead.n}?
              </h3>
              <p style={{ margin: "8px 0 18px", fontSize: 12.5, color: T.txt2, lineHeight: 1.5 }}>
                Se moverá a la <strong style={{ color: T.txt }}>Papelera</strong>. Podrás restaurarlo en cualquier momento desde ahí.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmDeleteLP(false)} style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${T.border}`, background: "transparent",
                  color: T.txt2, fontSize: 13, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={async () => {
                  setConfirmDeleteLP(false);
                  await onDelete?.(lead);
                  onClose?.();
                }} style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.18)",
                  color: "#FCA5A5", fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                }}>Sí, eliminar</button>
              </div>
            </div>
          </div>
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
  const isMobile = useIsMobile();
  const [analysisCopied, setAnalysisCopied] = useState(false);
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

  // SLA primer contacto — ≤ 1h (Protocolo Duke del Caribe — Mayo 2026)
  if (lead.st === "Contáctame Ya" || lead.isNew) {
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

  // Reactivar Zoom — el cliente no se conectó al Zoom agendado
  if (lead.st === "Reactivar Zoom") {
    nextActions.push({
      priority: "REACTIVAR", color: "#EA580C", icon: AlertCircle,
      title: "Reactivar y reagendar Zoom",
      detail: "Protocolo Duke: contacta al cliente, entiende por qué no se conectó (sin presión), recupera confianza y propón 2 ventanas alternativas para reagendar. Si no responde en 24h, mover a Remarketing IA.",
      eta: "< 2h",
    });
  }

  // Seguimiento — propuesta + negociación activa post-Zoom
  if (lead.st === "Seguimiento") {
    nextActions.push({
      priority: "ALTA", color: "#FBBF24", icon: FileText,
      title: "Mantener seguimiento de valor",
      detail: "Protocolo Duke — Fase Seguimiento: incluye Zoom concretado, envío de proyectos, corridas financieras, opciones y negociación. Cada touchpoint debe aportar valor (avances de obra, casos similares, disponibilidad).",
      eta: "Esta semana",
    });
  }

  // Apartó — validar comprobante de apartado
  if (lead.st === "Apartó") {
    nextActions.push({
      priority: "MILESTONE", color: "#4ADE80", icon: Trophy,
      title: "Validar comprobante de apartado",
      detail: "Protocolo Duke — Fase Apartó: el cliente envió dinero al desarrollador. Valida comprobante, unidad, monto y desarrollador con administración. Próximo paso: coordinar visita o Down Payment.",
      eta: "< 24h",
    });
  }

  // Score alto — oportunidad de mover etapa
  if (sc >= 72 && !["Apartó","Cierre","Postventa"].includes(lead.st)) {
    nextActions.push({
      priority: "OPORTUNIDAD", color: T.violet, icon: Target,
      title: `Score ${sc} — mover a la siguiente etapa`,
      detail: `Señales de intención alta. Protocolo Duke: propón el siguiente paso tangible — visita presencial, video de obra, o reunión con el director de proyecto.`,
      eta: "Esta semana",
    });
  }

  // BANT incompleto — calificar
  if (bantScore < 3 && !["Postventa","Contáctame Ya"].includes(lead.st)) {
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
      <div style={isMobile ? {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 401,
        height: "92dvh", maxHeight: "92dvh",
        background: T === P ? "#111318" : "#FFFFFF",
        borderTop: `1px solid ${T.borderH}`,
        borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column",
        animation: "slideInUp 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "0 -24px 80px rgba(0,0,0,0.55)" : "0 -16px 60px rgba(15,23,42,0.16)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      } : {
        position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401, width: 480,
        background: T === P ? "#111318" : "#FFFFFF",
        borderLeft: `1px solid ${T.borderH}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: T === P ? "-24px 0 80px rgba(0,0,0,0.55)" : "-24px 0 80px rgba(15,23,42,0.14)",
      }}>
        <style>{`
          @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
          @keyframes slideInUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        `}</style>
        {isMobile && (
          <div style={{ padding: "8px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: T === P ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ padding: isMobile ? "8px 16px 14px" : "18px 22px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
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
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { navigator.clipboard?.writeText(buildTelegramSummary(lead)).then(() => { setAnalysisCopied(true); setTimeout(() => setAnalysisCopied(false), 1800); }); }} title="Copiar resumen para Telegram" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: analysisCopied ? `${T.accent}18` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", color: analysisCopied ? T.accent : T.txt3 }}
                onMouseEnter={e => e.currentTarget.style.background = analysisCopied ? `${T.accent}22` : T.glassH}
                onMouseLeave={e => e.currentTarget.style.background = analysisCopied ? `${T.accent}18` : "transparent"}
              >{analysisCopied ? <Check size={13} strokeWidth={2.8} /> : <Copy size={13} strokeWidth={2} />}</button>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = T.glassH}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={13} color={T.txt3} /></button>
            </div>
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
            <div style={{ minWidth: 110, flexShrink: 0 }}>
              <ScoreInput sc={sc} onUpdate={n => onUpdate?.({...lead, sc: n})} isLight={isLight} T={T} big />
            </div>
          </div>

          {/* Etiquetas rápidas */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {lead.tag === "requiere-humano" && (
              <span title="El bot pidió que un humano tome control" style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
                color: "#FFFFFF",
                background: isLight ? "#DC2626" : "#EF4444",
                border: `1px solid ${isLight ? "#B91C1C" : "#F87171"}`,
                padding: "3px 9px", borderRadius: 99,
                textTransform: "uppercase",
                animation: "rhPulse 1.8s ease-in-out infinite",
              }}>🔥 Requiere Humano</span>
            )}
            {hot && lead.tag !== "requiere-humano" && <span style={{ fontSize: 9, fontWeight: 700, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accentB}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.05em" }}>HOT</span>}
            {scheduledCallNM && (
              <ScheduledCallBadge scheduledAt={scheduledCallNM.scheduled_at} variant="drawer" T={T} isLight={isLight} />
            )}
            {inactive >= 7 && <span style={{ fontSize: 9, fontWeight: 700, color: T.rose, background: `${T.rose}14`, border: `1px solid ${T.rose}33`, padding: "3px 9px", borderRadius: 99 }}>{inactive}d inactivo</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99 }}>Etapa {stageIdx + 1}/{STAGES.length}</span>
            <SourceBadge source={lead.source} isLight={isLight} />
            <style>{`@keyframes rhPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); } 50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); } }`}</style>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", padding: isMobile ? "16px 16px 130px" : "18px 22px 130px", display: "flex", flexDirection: "column", gap: 18 }}>

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

export {
  calculateLeadScore,
  SRC_META, SourceBadge,
  ScoreInput, ScoreBar,
  StageBadge,
  FollowUpBadge,
  NextActionHero,
  DRAWER_TABS, DrawerTabIsland,
  UpdateChatPanel,
  InlineEdit,
  TaskChecklist,
  ActionTimeline,
  COACHING_MOCKS, NotesModal,
  LeadPanel,
  AnalysisDrawer,
  ClickDropdown,
  hashAsesorColor, asesorInitials,
};
