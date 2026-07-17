/**
 * app/components/DynIsland.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Centro de Inteligencia — Dynamic Island con soporte de tema y animaciones.
 * Versión actualizada extraída de App.jsx (soporta theme y beamIdx).
 *
 * Panel expandido = 2 zonas:
 *   1) NOVEDADES  → notificaciones (idealmente datos reales vía prop `notifications`)
 *   2) QUÉ PUEDE HACER → carrusel de funciones (INTEL_FEATURES) + tutorial por función
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronRight, ChevronLeft, Crown,
  Mic, FileText, Video, MapPin, GitBranch, Search, BarChart3, Bell, Sparkles, Zap, Gauge, UsersRound, Bot,
  Home, FolderOpen, UserPlus, Users, Smartphone,
} from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { StratosAtom } from "./Logo";
import { AgentIcons } from "../constants/agents";
import { useClient } from "../../hooks/useClient";
import { INTEL_FEATURES } from "../constants/intelFeatures";

// Mapa nombre→componente de ícono (los datos guardan solo el string)
const FEATURE_ICONS = { Mic, FileText, Video, MapPin, GitBranch, Search, BarChart3, Bell, Sparkles, Zap, Gauge, UsersRound, Bot, Home, FolderOpen, UserPlus, Users, Smartphone };

const DynIsland = ({ onExpand, onOpenLead, notifications = [], theme = "dark", beamIdx = 0, openSignal = 0 }) => {
  const isLight = theme === "light";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Apertura EXTERNA (móvil): la pill vive en el header y en móvil está
  // display:none, así que el panel "+" del bottom-nav manda un contador que
  // incrementa en cada tap → acá abrimos. El panel expandido es un portal a
  // <body>, así que se ve aunque la pill esté oculta. Patrón "ajustar estado
  // durante el render" (sin useEffect: ni render extra ni lint de setState).
  const [seenSignal, setSeenSignal] = useState(0);
  if (openSignal !== seenSignal) {
    setSeenSignal(openSignal);
    if (openSignal > 0) setIsOpen(true);
  }
  const { config: clientConfig } = useClient();
  const centerLabel = clientConfig?.brand?.intelligenceCenterLabel || "Centro de Inteligencia";
  // Rótulo distinto en móvil (opcional por cliente). Duke: "Intelligence" en móvil,
  // "Centro de Inteligencia" en escritorio. Si el cliente no define el móvil, usa el mismo.
  const centerLabelMobile = clientConfig?.brand?.intelligenceCenterLabelMobile || centerLabel;

  // SOLO datos reales (buildIntelNotifs sobre los leads). Antes había 4
  // notificaciones DEMO de fallback ("Familia Rodríguez", "Portofino +32%"…)
  // que aparecían cuando el asesor no tenía novedades → parecían reales y
  // eran humo. Fuera: sin novedades se muestra un estado vacío honesto.
  const msgs = notifications;

  const expanded = isOpen || selectedNotif || selectedFeature || showAll;

  const closeAll = () => { setIsOpen(false); setSelectedNotif(null); setSelectedFeature(null); setShowAll(false); };

  // Panel expandido — colores tema-aware (antes estaba hardcodeado en oscuro).
  const D = {
    bg:   isLight ? "#FFFFFF" : "#03060F",
    bd:   isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)",
    line: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.05)",
    sh:   isLight ? "0 28px 80px rgba(15,23,42,0.22), 0 8px 24px rgba(15,23,42,0.10), 0 0 0 0.5px rgba(15,23,42,0.06)" : "0 24px 80px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(255,255,255,0.04)",
    t92:  isLight ? "#0B1220" : "rgba(255,255,255,0.92)",
    t88:  isLight ? "rgba(11,18,32,0.90)" : "rgba(255,255,255,0.88)",
    t74:  isLight ? "rgba(11,18,32,0.70)" : "rgba(255,255,255,0.74)",
    t66:  isLight ? "rgba(11,18,32,0.62)" : "rgba(255,255,255,0.66)",
    t65:  isLight ? "rgba(11,18,32,0.62)" : "rgba(255,255,255,0.65)",
    t55:  isLight ? "rgba(11,18,32,0.55)" : "rgba(255,255,255,0.55)",
    t50:  isLight ? "rgba(11,18,32,0.52)" : "rgba(255,255,255,0.50)",
    t46:  isLight ? "rgba(11,18,32,0.48)" : "rgba(255,255,255,0.46)",
    t44:  isLight ? "rgba(11,18,32,0.46)" : "rgba(255,255,255,0.44)",
    t42:  isLight ? "rgba(11,18,32,0.44)" : "rgba(255,255,255,0.42)",
    t40:  isLight ? "rgba(11,18,32,0.42)" : "rgba(255,255,255,0.40)",
    t38:  isLight ? "rgba(11,18,32,0.42)" : "rgba(255,255,255,0.38)",
    t34:  isLight ? "rgba(11,18,32,0.38)" : "rgba(255,255,255,0.34)",
    t22:  isLight ? "rgba(11,18,32,0.28)" : "rgba(255,255,255,0.22)",
    w:    isLight ? "#0B1220" : "#FFFFFF",
    hov:  isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)",
    btn:  isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
    btnH: isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)",
    acc:  isLight ? "#0D9A76" : "#6EE7C2",
    cardG2: isLight ? "#FFFFFF" : "rgba(255,255,255,0.02)",
    ctaBg:  isLight ? "#0D9A76" : "rgba(255,255,255,0.92)",
    ctaTxt: isLight ? "#FFFFFF" : "#06080F",
    ctaSh:  isLight ? "0 4px 16px rgba(13,154,118,0.30)" : "0 2px 10px rgba(255,255,255,0.12)",
    ctaHov: isLight ? "#0B8A69" : "#FFFFFF",
  };
  const featureCardBg = (color) => isLight
    ? `linear-gradient(180deg, #FFFFFF 0%, ${color}08 100%)`
    : `linear-gradient(160deg, ${color}14 0%, ${D.cardG2} 60%)`;
  const featureCardShadow = isLight
    ? "0 10px 26px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.95)"
    : "none";

  return (
    <>
      <style>{`
        @keyframes stratosIntelSweepLoop {
          0% { transform: translate3d(-110px, 0, 0) skewX(-18deg); opacity: 0; }
          16% { opacity: 0.38; }
          48% { opacity: 0.24; }
          100% { transform: translate3d(260px, 0, 0) skewX(-18deg); opacity: 0; }
        }
        @keyframes stratosIntelAuraLoop {
          0% { transform: rotate(0deg) scale(1); opacity: 0.16; }
          50% { transform: rotate(180deg) scale(1.01); opacity: 0.30; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.16; }
        }
        @keyframes stratosIntelPulseDot {
          0%, 100% { opacity: 0.72; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        /* Rótulo del pill: escritorio muestra el largo (centerLabel), móvil el
           corto (centerLabelMobile, ej. "Intelligence" para Duke). */
        .dyn-lbl-mob { display: none; }
        .intel-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .intel-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .dyn-lbl-desk { display: none; }
          .dyn-lbl-mob { display: inline; }
        }
      `}</style>
      {/* ─── PILL — Centro de Inteligencia ─────────────────────────────── */}
      <div
        title={centerLabel}
        onClick={() => { if (!expanded) { setIsOpen(true); } }}
        style={{
          position: "relative",
          height: 30, borderRadius: 50,
          background: isLight ? "rgba(255,255,255,0.94)" : "#050507",
          border: isLight
            ? "1px solid rgba(13,154,118,0.13)"
            : "1px solid rgba(255,255,255,0.07)",
          boxShadow: isLight
            ? "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)"
            : "inset 0 1px 0 rgba(255,255,255,0.09), 0 4px 24px rgba(0,0,0,0.80)",
          display: expanded ? "none" : "flex",
          alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          padding: "0 14px", gap: 0,
          cursor: "pointer",
          transition: "transform 0.20s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.022)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        onMouseDown={e => { e.currentTarget.style.transform = "scale(0.972)"; e.currentTarget.style.transition = "transform 0.08s ease"; }}
        onMouseUp={e => { e.currentTarget.style.transition = "transform 0.20s cubic-bezier(0.34,1.56,0.64,1)"; e.currentTarget.style.transform = "scale(1.022)"; }}
      >
        <div data-brand-motion="true" style={{
          position: "absolute", inset: -18, borderRadius: "50%",
          background: isLight
            ? "conic-gradient(from 0deg, transparent 0deg, rgba(13,154,118,0.00) 128deg, rgba(13,154,118,0.06) 182deg, rgba(255,255,255,0.30) 204deg, rgba(13,154,118,0.00) 238deg, transparent 360deg)"
            : "conic-gradient(from 0deg, transparent 0deg, rgba(52,211,153,0.00) 128deg, rgba(52,211,153,0.11) 182deg, rgba(255,255,255,0.14) 204deg, rgba(52,211,153,0.00) 238deg, transparent 360deg)",
          filter: "blur(10px)",
          animation: "stratosIntelAuraLoop 8.5s linear infinite",
          willChange: "transform, opacity",
          pointerEvents: "none",
        }} />
        <div data-brand-motion="true" style={{
          position: "absolute", top: -1, bottom: -1, left: 0, width: 72,
          background: isLight
            ? "linear-gradient(90deg, transparent, rgba(13,154,118,0.045), rgba(255,255,255,0.30), rgba(13,154,118,0.045), transparent)"
            : "linear-gradient(90deg, transparent, rgba(110,231,194,0.045), rgba(255,255,255,0.12), rgba(110,231,194,0.045), transparent)",
          animation: "stratosIntelSweepLoop 6.2s cubic-bezier(0.16,1,0.3,1) infinite",
          willChange: "transform, opacity",
          pointerEvents: "none",
        }} />
        {/* Shimmer beam */}
        {/* will-change: Safari congela animaciones dentro de un ancestro con
            backdrop-filter (el header). Promoverlo a su propia capa GPU lo destraba. */}
        <div key={beamIdx} style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: "52%",
          background: isLight
            ? "linear-gradient(90deg, transparent 0%, rgba(13,154,118,0.11) 50%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
          animation: "pillBeamOnce 1.8s ease-in-out both",
          willChange: "transform, opacity",
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div data-brand-motion="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 5px rgba(52,211,153,0.42)", animation: "stratosIntelPulseDot 3.4s ease-in-out infinite", willChange: "transform, opacity" }} />
          </div>
          <span className="dyn-lbl-desk" style={{
            fontSize: 12.5, fontWeight: 400, letterSpacing: "-0.025em", fontFamily: fontDisp,
            color: isLight ? "#0A0A0A" : "rgba(255,255,255,0.88)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{centerLabel}</span>
          <span className="dyn-lbl-mob" style={{
            fontSize: 12.5, fontWeight: 400, letterSpacing: "-0.025em", fontFamily: fontDisp,
            color: isLight ? "#0A0A0A" : "rgba(255,255,255,0.88)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>{centerLabelMobile}</span>
        </div>
      </div>

      {/* Expanded state */}
      {expanded && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 99998 }}
            onClick={closeAll}
          />
          <div style={{
            /* top con safe-area: en la app nativa (notch/status bar) el panel
               no debe quedar debajo de la barra de estado. */
            position: "fixed", top: "calc(66px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))", left: "50%", transform: "translateX(-50%)",
            zIndex: 99999,
            width: selectedNotif || selectedFeature ? 600 : 580,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100dvh - 90px - var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
            borderRadius: 20,
            background: D.bg,
            border: `0.5px solid ${D.bd}`,
            boxShadow: D.sh,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            animation: "fadeSlideDown 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>
            <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
              @keyframes stratosAtomSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
              @keyframes intelMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>

            {isOpen && !selectedNotif && !selectedFeature && !showAll && (
              <div style={{ padding: "18px 0 6px" }}>
                {/* Header */}
                <div style={{ padding: "0 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${D.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div data-brand-motion="true" style={{ animation: "stratosAtomSpin 20s linear infinite", transformOrigin: "center", display: "flex", filter: "drop-shadow(0 0 5px rgba(110,231,194,0.35))" }}>
                      <StratosAtom size={14} color={D.acc} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: D.t88, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{centerLabel}</p>
                      <p style={{ margin: 0, fontSize: 9.5, color: D.t38, fontFamily: font, letterSpacing: "0.02em", marginTop: 1 }}>{msgs.length} actualizaciones del equipo IA</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} style={{ background: D.btn, border: "none", cursor: "pointer", width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: D.t50, transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = D.btnH; e.currentTarget.style.color = D.w; }}
                    onMouseLeave={e => { e.currentTarget.style.background = D.btn; e.currentTarget.style.color = D.t50; }}
                  ><X size={13} /></button>
                </div>

                {/* Notification items */}
                <div style={{ padding: "6px 0 10px" }}>
                  {msgs.length === 0 && (
                    <div style={{ padding: "18px 20px", textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 12.5, color: D.t88, fontFamily: fontDisp, fontWeight: 500 }}>Todo en orden</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: D.t42, fontFamily: font, lineHeight: 1.5 }}>
                        El equipo IA está monitoreando tu cartera. Las novedades de tus clientes aparecerán aquí.
                      </p>
                    </div>
                  )}
                  {msgs.map((m, i) => (
                    <div key={i} onClick={() => setSelectedNotif(m)}
                      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 20px", cursor: "pointer", transition: "background 0.16s" }}
                      onMouseEnter={e => e.currentTarget.style.background = D.hov}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${m.c}12`, border: `1px solid ${m.c}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <m.icon size={14} color={m.c} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: D.t88, fontWeight: 400, fontFamily: fontDisp, marginBottom: 2 }}>{m.agent}</p>
                        <p style={{ margin: 0, fontSize: 11, color: D.t42, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</p>
                      </div>
                      <ChevronRight size={13} color={D.t22} strokeWidth={2} />
                    </div>
                  ))}
                </div>

                {/* ─── QUÉ PUEDE HACER EL SISTEMA — carrusel de funciones ─── */}
                <div style={{ padding: "10px 20px 4px", borderTop: `1px solid ${D.line}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 10, color: D.t55, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "0.10em", textTransform: "uppercase" }}>Qué puede hacer el sistema</p>
                    <p style={{ margin: 0, fontSize: 9.5, color: D.t34, fontFamily: font }}>Tocá una función para ver cómo se usa</p>
                  </div>
                  <button onClick={() => setShowAll(true)}
                    style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, background: "rgba(110,231,194,0.10)", border: "1px solid rgba(110,231,194,0.22)", color: D.acc, borderRadius: 8, padding: "6px 10px", fontSize: 10.5, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(110,231,194,0.18)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(110,231,194,0.10)"; }}
                  >Ver todas <span style={{ opacity: 0.7 }}>({INTEL_FEATURES.length})</span><ChevronRight size={12} strokeWidth={2.4} /></button>
                </div>
                <div className="intel-scroll" style={{ overflowX: "auto", overflowY: "hidden", padding: "10px 20px 16px", WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity", overscrollBehaviorX: "contain" }}>
                  <div
                    style={{ display: "flex", gap: 12, width: "max-content", paddingRight: 2 }}
                  >
                    {INTEL_FEATURES.map((f) => {
                      const Ic = FEATURE_ICONS[f.icon] || Sparkles;
                      const isAgent = f.kind === "agente";
                      const chan = f.chan || (f.where.includes("Copilot")
                        ? (f.where.includes("CRM") && !f.where.includes("del CRM") ? "Copilot · CRM" : "Copilot")
                        : f.where.includes("Telegram") ? "Telegram" : (f.where.includes("CRM") ? "En el CRM" : "Automático"));
                      return (
                        <div key={f.id} onClick={() => setSelectedFeature(f)}
                          style={{
                            flex: "0 0 auto", width: 174,
                            borderRadius: 16, padding: "14px 14px 15px", cursor: "pointer",
                            background: featureCardBg(f.color),
                            border: `1px solid ${isLight ? `${f.color}24` : `${f.color}22`}`,
                            boxShadow: featureCardShadow,
                            scrollSnapAlign: "start",
                            transition: "border-color 0.16s, transform 0.16s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}66`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? `${f.color}24` : `${f.color}22`; e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${f.color}1E`, border: `1px solid ${f.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Ic size={17} color={f.color} strokeWidth={2} />
                            </div>
                            <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: isAgent ? D.acc : D.t46, background: isAgent ? "rgba(110,231,194,0.10)" : D.btn, border: `1px solid ${isAgent ? "rgba(110,231,194,0.22)" : D.bd}`, borderRadius: 6, padding: "3px 6px" }}>
                              {isAgent ? "Auto" : "Vos pedís"}
                            </span>
                          </div>
                          <p style={{ margin: "0 0 4px", fontSize: 13, color: D.t92, fontWeight: 400, fontFamily: fontDisp, lineHeight: 1.2 }}>{f.label}</p>
                          <p style={{ margin: 0, fontSize: 10.5, color: D.t44, fontFamily: font, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.tagline}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${D.line}` }}>
                            <MapPin size={10} color={f.color} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: f.color, opacity: 0.9, fontWeight: 400, fontFamily: font }}>{chan}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─── TODAS LAS FUNCIONES (grid completo) ─── */}
            {showAll && !selectedFeature && (
              <div style={{ padding: "18px 0 8px", animation: "fadeSlideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
                {/* Header */}
                <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${D.line}` }}>
                  <button onClick={() => setShowAll(false)} style={{ background: D.btn, border: "none", color: D.t55, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = D.btnH; e.currentTarget.style.color = D.w; }}
                    onMouseLeave={e => { e.currentTarget.style.background = D.btn; e.currentTarget.style.color = D.t55; }}
                  ><ChevronLeft size={15} /></button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: D.w, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Todas las funciones</p>
                    <p style={{ margin: 0, fontSize: 10, color: D.t40, fontFamily: font, marginTop: 2 }}>{INTEL_FEATURES.length} funciones · tocá una para ver cómo se usa</p>
                  </div>
                  <button onClick={() => setShowAll(false)} style={{ background: D.btn, border: "none", cursor: "pointer", width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: D.t50, flexShrink: 0, transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = D.btnH; e.currentTarget.style.color = D.w; }}
                    onMouseLeave={e => { e.currentTarget.style.background = D.btn; e.currentTarget.style.color = D.t50; }}
                  ><X size={13} /></button>
                </div>
                {/* Grid 2 columnas con TODAS las funciones */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 20px 18px" }}>
                  {INTEL_FEATURES.map((f) => {
                    const Ic = FEATURE_ICONS[f.icon] || Sparkles;
                    const isAgent = f.kind === "agente";
                    const chan = f.chan || (f.where.includes("Copilot")
                      ? (f.where.includes("CRM") && !f.where.includes("del CRM") ? "Copilot · CRM" : "Copilot")
                      : f.where.includes("Telegram") ? "Telegram" : (f.where.includes("CRM") ? "En el CRM" : "Automático"));
                    return (
                      <div key={f.id} onClick={() => setSelectedFeature(f)}
                        style={{ borderRadius: 14, padding: "13px 13px 14px", cursor: "pointer", background: featureCardBg(f.color), border: `1px solid ${isLight ? `${f.color}24` : `${f.color}22`}`, boxShadow: featureCardShadow, transition: "border-color 0.16s, transform 0.16s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}66`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? `${f.color}24` : `${f.color}22`; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${f.color}1E`, border: `1px solid ${f.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Ic size={16} color={f.color} strokeWidth={2} />
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: isAgent ? D.acc : D.t46, background: isAgent ? "rgba(110,231,194,0.10)" : D.btn, border: `1px solid ${isAgent ? "rgba(110,231,194,0.22)" : D.bd}`, borderRadius: 6, padding: "3px 6px" }}>
                            {isAgent ? "Auto" : "Tú pides"}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: 12.5, color: D.t92, fontWeight: 400, fontFamily: fontDisp, lineHeight: 1.2 }}>{f.label}</p>
                        <p style={{ margin: 0, fontSize: 10, color: D.t44, fontFamily: font, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.tagline}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, paddingTop: 8, borderTop: `1px solid ${D.line}` }}>
                          <MapPin size={10} color={f.color} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: f.color, opacity: 0.9, fontWeight: 400, fontFamily: font }}>{chan}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Detalle de una NOTIFICACIÓN ─── */}
            {selectedNotif && (
              <div style={{ padding: "20px", animation: "fadeSlideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${selectedNotif.c}16`, border: `1px solid ${selectedNotif.c}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <selectedNotif.icon size={15} color={selectedNotif.c} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, color: D.w, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{selectedNotif.agent}</p>
                    <p style={{ margin: 0, fontSize: 10.5, color: D.t40, fontFamily: font, marginTop: 2 }}>Actualización del sistema</p>
                  </div>
                  <button onClick={() => setSelectedNotif(null)} style={{ background: D.btn, border: "none", color: D.t55, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.16s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = D.btnH; e.currentTarget.style.color = D.w; }}
                    onMouseLeave={e => { e.currentTarget.style.background = D.btn; e.currentTarget.style.color = D.t55; }}
                  ><X size={13} /></button>
                </div>

                <p style={{ fontSize: 13, color: D.t65, lineHeight: 1.65, fontFamily: font, marginBottom: 20 }}>{selectedNotif.detail}</p>

                <button
                  onClick={() => { if (selectedNotif.leadId) { onOpenLead?.(selectedNotif.leadId); } else { onExpand?.(); } closeAll(); }}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 12,
                    background: D.ctaBg, color: D.ctaTxt,
                    border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
                    fontFamily: fontDisp, letterSpacing: "0.005em",
                    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: D.ctaSh,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = D.ctaHov; }}
                  onMouseLeave={e => { e.currentTarget.style.background = D.ctaBg; }}
                >{selectedNotif.btn}</button>
              </div>
            )}

            {/* ─── TUTORIAL de una FUNCIÓN ─── */}
            {selectedFeature && (() => {
              const Ic = FEATURE_ICONS[selectedFeature.icon] || Sparkles;
              const isAgent = selectedFeature.kind === "agente";
              return (
                <div style={{ padding: "18px 20px 22px", animation: "fadeSlideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <button onClick={() => setSelectedFeature(null)} style={{ background: D.btn, border: "none", color: D.t55, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.16s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = D.btnH; e.currentTarget.style.color = D.w; }}
                      onMouseLeave={e => { e.currentTarget.style.background = D.btn; e.currentTarget.style.color = D.t55; }}
                    ><ChevronLeft size={15} /></button>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${selectedFeature.color}18`, border: `1px solid ${selectedFeature.color}2E`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Ic size={16} color={selectedFeature.color} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, color: D.w, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{selectedFeature.label}</p>
                      <p style={{ margin: 0, fontSize: 10, color: isAgent ? D.acc : D.t40, fontFamily: font, marginTop: 2, fontWeight: 400 }}>{isAgent ? "El sistema lo hace solo" : "Lo pides al asistente"}</p>
                    </div>
                    <button onClick={closeAll} style={{ background: D.btn, border: "none", color: D.t55, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                    ><X size={13} /></button>
                  </div>

                  <p style={{ fontSize: 12.5, color: D.t66, lineHeight: 1.6, fontFamily: font, margin: "0 0 14px" }}>{selectedFeature.tagline}</p>

                  {/* DÓNDE se usa — lo primero que el asesor necesita saber */}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 11, background: `${selectedFeature.color}12`, border: `1px solid ${selectedFeature.color}2A`, marginBottom: 18 }}>
                    <MapPin size={14} color={selectedFeature.color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                    <div>
                      <span style={{ display: "block", fontSize: 8.5, color: D.t40, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "0.09em", textTransform: "uppercase" }}>Dónde</span>
                      <span style={{ fontSize: 12.5, color: D.t88, fontFamily: fontDisp, fontWeight: 400 }}>{selectedFeature.where}</span>
                    </div>
                  </div>

                  <p style={{ margin: "0 0 9px", fontSize: 9.5, color: D.t42, fontWeight: 500, fontFamily: fontDisp, letterSpacing: "0.08em", textTransform: "uppercase" }}>Cómo se usa</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedFeature.how.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 6, background: `${selectedFeature.color}1A`, border: `1px solid ${selectedFeature.color}30`, color: selectedFeature.color, fontSize: 9.5, fontWeight: 500, fontFamily: fontDisp, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                        <p style={{ margin: 0, fontSize: 12, color: D.t74, fontFamily: font, lineHeight: 1.5 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default DynIsland;
