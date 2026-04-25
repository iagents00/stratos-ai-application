/**
 * app/components/DynIsland.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Centro de Inteligencia — Dynamic Island con soporte de tema y animaciones.
 * Versión actualizada extraída de App.jsx (soporta theme y beamIdx).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, Crown } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { StratosAtom } from "./Logo";
import { AgentIcons } from "../constants/agents";

const DynIsland = ({ onExpand, notifications = [], theme = "dark", beamIdx = 0 }) => {
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

  return (
    <>
      {/* ─── PILL — Centro de Inteligencia ─────────────────────────────── */}
      <div
        title="Centro de Inteligencia"
        onClick={() => { if (!expanded) { onExpand?.(); } }}
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
        {/* Shimmer beam */}
        <div key={beamIdx} style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: "52%",
          background: isLight
            ? "linear-gradient(90deg, transparent 0%, rgba(13,154,118,0.11) 50%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
          animation: "pillBeamOnce 1.8s ease-in-out both",
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: -2, borderRadius: "50%", background: "rgba(52,211,153,0.20)", animation: "pulse 2.6s ease-in-out infinite" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,0.85), 0 0 12px rgba(52,211,153,0.30)" }} />
          </div>
          <span style={{
            fontSize: 12.5, fontWeight: 600, letterSpacing: "-0.025em", fontFamily: fontDisp,
            color: isLight ? "#0A0A0A" : "rgba(255,255,255,0.88)",
            whiteSpace: "nowrap", flexShrink: 0,
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

export default DynIsland;
