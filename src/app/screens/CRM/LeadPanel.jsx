import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Zap, Phone, MessageCircle, Send, AlertCircle, Activity,
  CalendarDays, Signal, Building2, User, Clock, Check
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { STAGES, stgC } from "../../data/leads";

const Pill = ({ children, color = P.accent, s }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: s ? "2px 8px" : "4px 11px", borderRadius: 99,
    fontSize: s ? 10 : 11, fontWeight: 600, color,
    background: `${color}12`, border: `1px solid ${color}1A`,
    letterSpacing: "0.02em", whiteSpace: "nowrap",
  }}>{children}</span>
);

const LeadPanel = ({ lead, onClose, oc, onOpenNotes }) => {
  const [activeTab, setActiveTab] = useState("perfil");
  if (!lead) return null;
  const sc = lead.sc;
  const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
  const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.amber : P.rose;
  const stageColor = stgC[lead.st] || P.txt3;
  const stageIdx = STAGES.indexOf(lead.st);

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(2,5,12,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 401,
        width: 420, background: "#07080F",
        borderLeft: `1px solid ${P.borderH}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.3s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: "-24px 0 80px rgba(0,0,0,0.5)",
      }}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

        <div style={{ height: 3, background: `linear-gradient(90deg, ${stageColor}, ${stageColor}40, transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {lead.isNew && <span style={{ fontSize: 9, fontWeight: 800, color: P.accent, background: `${P.accent}14`, border: `1px solid ${P.accentB}`, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.06em" }}>NUEVO</span>}
              {lead.hot && <span style={{ fontSize: 9, fontWeight: 800, color: P.rose, background: `${P.rose}12`, border: `1px solid ${P.rose}28`, padding: "2px 8px", borderRadius: 99, letterSpacing: "0.06em" }}>HOT</span>}
              {lead.daysInactive >= 7 && <span style={{ fontSize: 9, fontWeight: 700, color: P.amber, background: `${P.amber}12`, border: `1px solid ${P.amber}25`, padding: "2px 8px", borderRadius: 99 }}>{lead.daysInactive}d inactivo</span>}
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.background = P.glass}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            ><X size={13} color={P.txt3} /></button>
          </div>

          {/* Avatar + Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width={54} height={54} style={{ position: "absolute", top: -3, left: -3 }}>
                <circle cx={27} cy={27} r={24} fill="none" stroke={`${scoreColor}20`} strokeWidth={2.5} />
                <circle cx={27} cy={27} r={24} fill="none" stroke={scoreColor} strokeWidth={2.5}
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - sc / 100)}`}
                  strokeLinecap="round"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "27px 27px", transition: "stroke-dashoffset 0.8s ease" }} />
              </svg>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: `${scoreColor}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: scoreColor, fontFamily: fontDisp }}>
                {lead.n.charAt(0)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", marginBottom: 3, lineHeight: 1.1 }}>{lead.n}</p>
              <p style={{ fontSize: 11, color: P.txt2, marginBottom: 4 }}>{lead.tag}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Pill color={stageColor} s>{lead.st}</Pill>
                <span style={{ fontSize: 10, color: P.txt3 }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{lead.budget}</span>
              </div>
            </div>
          </div>

          {/* Score bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${sc}%`, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${scoreColor}99, ${scoreColor})`, boxShadow: `0 0 8px ${scoreColor}50`, transition: "width 0.6s ease" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor, fontFamily: fontDisp, minWidth: 50, textAlign: "right" }}>Score {sc}</span>
          </div>

          {/* Quick contact buttons */}
          <div style={{ display: "flex", gap: 7 }}>
            <a href={`tel:${lead.phone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; }}
              onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
            ><Phone size={12} /> Llamar</a>
            <a href={`https://wa.me/${lead.phone?.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.18)", color: "rgba(37,211,102,0.85)", fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,0.12)"; e.currentTarget.style.color = "rgba(37,211,102,1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,211,102,0.07)"; e.currentTarget.style.color = "rgba(37,211,102,0.85)"; }}
            ><MessageCircle size={12} /> WhatsApp</a>
            {lead.email && (
              <a href={`mailto:${lead.email}`} style={{ width: 38, display: "flex", alignItems: "center", justifyContent: "center", padding: "9px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt3, textDecoration: "none", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt2; }}
                onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt3; }}
              ><Send size={12} /></a>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", padding: "0 22px", borderBottom: `1px solid ${P.border}`, flexShrink: 0 }}>
          {[["perfil", "Perfil"], ["pipeline", "Pipeline"], ["notas", "Notas"]].map(([id, label]) => (
            <button key={id} onClick={() => id === "notas" ? onOpenNotes?.() : setActiveTab(id)}
              style={{ padding: "12px 0", marginRight: 20, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font,
                color: activeTab === id && id !== "notas" ? P.accent : P.txt3,
                borderBottom: activeTab === id && id !== "notas" ? `2px solid ${P.accent}` : "2px solid transparent",
                transition: "all 0.18s", marginBottom: -1,
              }}
              onMouseEnter={e => { if (activeTab !== id || id === "notas") e.currentTarget.style.color = P.txt2; }}
              onMouseLeave={e => { if (activeTab !== id || id === "notas") e.currentTarget.style.color = P.txt3; }}
            >{label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {activeTab === "perfil" && <>
            <div style={{ borderRadius: 13, background: `${P.accent}08`, border: `1px solid ${P.accentB}`, overflow: "hidden" }}>
              <div style={{ padding: "9px 14px", borderBottom: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", gap: 6, background: `${P.accent}05` }}>
                <Zap size={12} color={P.accent} />
                <p style={{ fontSize: 10, fontWeight: 700, color: P.accent, letterSpacing: "0.07em", textTransform: "uppercase" }}>PRÓXIMA ACCIÓN</p>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: P.accent, background: `${P.accent}18`, padding: "2px 8px", borderRadius: 99 }}>{lead.nextActionDate}</span>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: 13, color: "#FFFFFF", lineHeight: 1.55, fontFamily: fontDisp, fontWeight: 500 }}>{lead.nextAction}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ padding: "10px 12px", borderRadius: 11, background: P.glass, border: `1px solid ${P.border}` }}>
                <p style={{ fontSize: 9, color: P.txt3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Fricción</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: frictionColor, boxShadow: `0 0 6px ${frictionColor}60` }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: frictionColor, fontFamily: fontDisp }}>{lead.friction}</span>
                </div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 11, background: P.glass, border: `1px solid ${P.border}` }}>
                <p style={{ fontSize: 9, color: P.txt3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Inactividad</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={11} color={lead.daysInactive >= 7 ? P.rose : lead.daysInactive >= 3 ? P.amber : P.emerald} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: lead.daysInactive >= 7 ? P.rose : lead.daysInactive >= 3 ? P.amber : P.emerald, fontFamily: fontDisp }}>{lead.daysInactive} días</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { l: "Ingresó", v: lead.fechaIngreso, icon: CalendarDays },
                { l: "Campaña", v: lead.campana, icon: Signal },
                { l: "Proyecto", v: lead.p.split("·")[0].trim(), icon: Building2 },
                { l: "Asesor", v: lead.asesor.split(" ")[0] + " " + (lead.asesor.split(" ")[1] || ""), icon: User },
              ].map(x => (
                <div key={x.l} style={{ padding: "9px 11px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <x.icon size={11} color={P.txt3} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 9, color: P.txt3, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>{x.l}</p>
                    <p style={{ fontSize: 11, color: P.txt, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.v}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Perfil del Cliente</p>
              <p style={{ fontSize: 12.5, color: P.txt2, lineHeight: 1.7 }}>{lead.bio}</p>
            </div>

            <div style={{ padding: "11px 13px", borderRadius: 11, background: `${P.rose}07`, border: `1px solid ${P.rose}18`, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={13} color={P.rose} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: P.rose, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Riesgo Identificado</p>
                <p style={{ fontSize: 12, color: P.txt2, lineHeight: 1.55 }}>{lead.risk}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 7, alignItems: "center", padding: "8px 11px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}` }}>
              <Activity size={11} color={P.txt3} />
              <div>
                <p style={{ fontSize: 9, color: P.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>Última actividad</p>
                <p style={{ fontSize: 11.5, color: P.txt2 }}>{lead.lastActivity}</p>
              </div>
            </div>
          </>}

          {activeTab === "pipeline" && <>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Progreso en el Pipeline</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {STAGES.map((stage, idx) => {
                  const isActive = stage === lead.st;
                  const isPast = idx < stageIdx;
                  const c = stgC[stage] || P.txt3;
                  return (
                    <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: isActive ? `${c}12` : "transparent", border: `1px solid ${isActive ? `${c}30` : "transparent"}`, transition: "all 0.2s" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? c : isPast ? `${c}30` : "rgba(255,255,255,0.04)", border: `1px solid ${isActive ? c : isPast ? `${c}50` : "rgba(255,255,255,0.08)"}` }}>
                        {isPast ? <Check size={10} color={c} /> : isActive ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#000" }} /> : null}
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: isActive ? 700 : 500, color: isActive ? "#FFFFFF" : isPast ? P.txt2 : P.txt3 }}>{stage}</span>
                      {isActive && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: c, background: `${c}18`, padding: "2px 8px", borderRadius: 99 }}>ACTUAL</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: 12, background: P.glass, border: `1px solid ${P.border}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Inversión</p>
              <p style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>{lead.budget}</p>
              <p style={{ fontSize: 11, color: P.txt2 }}>{lead.p}</p>
            </div>
          </>}
        </div>

        {/* Footer CTA */}
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => { oc(`__crm__ ${lead.n.toLowerCase()}`); onClose(); }} style={{
            flex: 1, padding: "12px 0", borderRadius: 12,
            background: "linear-gradient(135deg, rgba(110,231,194,0.18), rgba(110,231,194,0.08))",
            border: `1px solid ${P.accentB}`, color: P.accent,
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.25), rgba(110,231,194,0.12))"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.18), rgba(110,231,194,0.08))"; }}
          ><Zap size={14} /> Analizar con IA</button>
        </div>
      </div>
    </>,
    document.body
  );
};

export default LeadPanel;
