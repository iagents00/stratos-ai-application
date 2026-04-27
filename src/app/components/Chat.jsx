import { useState, useEffect, useRef } from "react";
import { X, ArrowRight, Send, Mic2, MicOff, Target, Shield, Zap, User } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { StratosAtom, Ico } from "../../design-system/primitives";
import { getResp, examples } from "../data/chat";

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

export default Chat;
