import { createPortal } from "react-dom";
import { X, Target, DollarSign, User, CalendarDays, Zap } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { stgC } from "../../data/leads";

const NotesModal = ({ lead, onClose }) => {
  if (!lead) return null;
  const sc = lead.sc;
  const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;

  const KNOWN_SECTIONS = ["OBJETIVO", "PRESUPUESTO", "PERFIL DEL CLIENTE", "HISTORIAL DE CONTACTO", "PENDIENTE"];
  const sectionColors = { "OBJETIVO": P.blue, "PRESUPUESTO": P.emerald, "PERFIL DEL CLIENTE": P.violet, "HISTORIAL DE CONTACTO": P.amber, "PENDIENTE": P.accent };
  const sectionIcons = { "OBJETIVO": Target, "PRESUPUESTO": DollarSign, "PERFIL DEL CLIENTE": User, "HISTORIAL DE CONTACTO": CalendarDays, "PENDIENTE": Zap };

  const sections = [];
  const raw = lead.notas || "";
  const lines = raw.split("\n");
  let curSection = null;
  for (const line of lines) {
    if (line.trim() === "") { if (curSection) curSection.body += "\n"; continue; }
    const stripped = line.replace(/^[^\w\s]+\s*/, "").trim();
    const isHeader = KNOWN_SECTIONS.some(s => stripped.toUpperCase() === s || line.trim() === s);
    const headerKey = KNOWN_SECTIONS.find(s => stripped.toUpperCase() === s || line.trim() === s) || "";
    if (isHeader) {
      if (curSection) sections.push(curSection);
      curSection = { title: headerKey, body: "", key: headerKey };
    } else {
      if (curSection) curSection.body += (curSection.body ? "\n" : "") + line;
      else sections.push({ title: "", body: line, key: "" });
    }
  }
  if (curSection) sections.push(curSection);

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(2,5,12,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 501, width: "min(640px, 94vw)",
        background: "#080D17",
        border: `1px solid ${P.borderH}`,
        borderRadius: 22,
        boxShadow: "0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        display: "flex", flexDirection: "column",
        animation: "fadeIn 0.22s ease",
        maxHeight: "82vh",
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${stgC[lead.st] || P.accent}, transparent)`, borderRadius: "22px 22px 0 0" }} />
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${scoreColor}14`, border: `1px solid ${scoreColor}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: scoreColor, fontFamily: fontDisp, flexShrink: 0 }}>{lead.n.charAt(0)}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{lead.n}</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600, color: stgC[lead.st] || P.accent, background: `${stgC[lead.st] || P.accent}12`, border: `1px solid ${stgC[lead.st] || P.accent}1A`, whiteSpace: "nowrap" }}>{lead.st}</span>
              </div>
              <p style={{ fontSize: 11, color: P.txt3 }}>{lead.tag} · {lead.asesor} · {lead.budget}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; }}
            onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
          ><X size={14} color={P.txt2} /></button>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {sections.filter(s => s.title || s.body).map((s, i) => {
            const c = sectionColors[s.key] || P.txt2;
            const SIcon = sectionIcons[s.key] || null;
            return (
              <div key={i} style={{ borderRadius: 13, border: `1px solid ${s.key ? `${c}20` : P.border}`, overflow: "hidden" }}>
                {s.title && (
                  <div style={{ padding: "9px 14px", background: s.key ? `${c}0A` : P.glass, borderBottom: `1px solid ${s.key ? `${c}18` : P.border}`, display: "flex", alignItems: "center", gap: 7 }}>
                    {SIcon && <SIcon size={12} color={c} />}
                    <p style={{ fontSize: 10, fontWeight: 700, color: s.key ? c : P.txt3, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.title}</p>
                  </div>
                )}
                <div style={{ padding: s.title ? "12px 14px" : "14px" }}>
                  <pre style={{ fontSize: 12.5, color: P.txt2, lineHeight: 1.8, fontFamily: font, whiteSpace: "pre-wrap", margin: 0 }}>{s.body.trim()}</pre>
                </div>
              </div>
            );
          })}
          {sections.length === 0 && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: P.txt3 }}>Sin notas registradas para este cliente.</p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default NotesModal;
