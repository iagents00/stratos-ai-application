import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, Crown, Crosshair, Waypoints, Radar } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { StratosAtom } from "../../design-system/primitives";

const AgentIcons = {
  gerente: Crosshair,
  asistente: Waypoints,
  analista: Radar,
};

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

export default DynIsland;
