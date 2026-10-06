import { useState } from "react";
import { Mic, FileText, Video, MapPin, GitBranch, Search, BarChart3, Bell, BookOpen, Sparkles, Zap, Gauge, UsersRound, ChevronRight, Check, X } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { INTEL_FEATURES } from "../constants/intelFeatures";
const FEATURE_ICONS = {
  Mic, FileText, Video, MapPin, GitBranch, Search,
  BarChart3, Bell, BookOpen, Sparkles, Zap, Gauge, UsersRound,
};

const FEATURE_PROMPTS = {
  "registrar-voz": "Crea un cliente: nombre, teléfono y próxima acción ",
  "actualizar-expediente": "Anota en el expediente de [cliente]: ",
  "agendar-zoom": "Agenda un Zoom con [cliente] para ",
  "agendar-visita": "Agenda una visita con [cliente] para ",
  "mover-etapa": "Mueve a [cliente] a la etapa ",
  "buscar-ficha": "Busca la ficha de ",
  kpis: "Muéstrame mis KPIs y cómo voy esta semana",
  recordatorio: "Recuérdame ",
};

const COPILOT_GUIDE_STEPS = {
  "registrar-voz": [
    "Escribe o dicta el nombre, teléfono y la próxima acción del cliente.",
    "Revisa la respuesta y confirma los datos cuando el Copilot te lo solicite.",
    "El registro queda asociado a tu organización y aparece en el CRM.",
  ],
  "actualizar-expediente": [
    "Indica el cliente y la novedad que quieres guardar.",
    "El Copilot localiza la ficha y agrega la nota con fecha y hora.",
  ],
  "agendar-zoom": [
    "Indica cliente, día y hora con lenguaje natural.",
    "La reunión queda en la agenda y activa los avisos operativos disponibles.",
  ],
  "agendar-visita": [
    "Indica cliente, propiedad, fecha y hora de la visita.",
    "El Copilot la organiza en tu agenda para que puedas darle seguimiento.",
  ],
  "mover-etapa": [
    "Escribe el nombre del cliente y la etapa de destino.",
    "El movimiento queda reflejado en el pipeline y en el historial del cliente.",
  ],
  "buscar-ficha": [
    "Busca por nombre o teléfono.",
    "Recibe la etapa, notas, próxima acción y contexto disponible de la ficha.",
  ],
  kpis: [
    "Pregunta por tus KPIs, tu pipeline o tu avance de la semana.",
    "El Copilot calcula la respuesta con los datos que tu usuario puede consultar.",
  ],
  recordatorio: [
    "Indica qué necesitas recordar y cuándo: fecha, hora o plazo relativo.",
    "El recordatorio queda en Mi Espacio y puede avisarte por los canales conectados.",
  ],
};

export default function CapabilitiesPanel({ T, isLight, onClose, onPrefill, features = INTEL_FEATURES }) {
  const [expanded, setExpanded] = useState(features[0]?.id || null);
  const requested = features.filter((feature) => feature.kind === "pedis");
  const automatic = features.filter((feature) => feature.kind === "agente");

  const renderGroup = (title, description, features) => (
    <section aria-label={title} style={{ padding: "18px 20px 4px" }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{title}</h3>
      <p style={{ margin: "4px 0 12px", fontSize: 12, lineHeight: 1.5, color: T.txt3, fontFamily: font }}>{description}</p>
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        {features.map((feature) => {
          const Icon = FEATURE_ICONS[feature.icon] || Sparkles;
          const isExpanded = expanded === feature.id;
          const prompt = feature.prompt || FEATURE_PROMPTS[feature.id];
          const steps = COPILOT_GUIDE_STEPS[feature.id] || feature.how;
          const channel = feature.chan || (feature.kind === "pedis" ? "Copilot web + Telegram" : feature.where);
          return (
            <div key={feature.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <button
                type="button"
                className="copilot-capability-row"
                onClick={() => setExpanded(isExpanded ? null : feature.id)}
                aria-expanded={isExpanded}
                style={{ width: "100%", minHeight: 64, padding: "12px 2px", border: "none", background: "transparent", color: T.txt, cursor: "pointer", display: "grid", gridTemplateColumns: "38px minmax(0,1fr) 18px", alignItems: "center", gap: 10, textAlign: "left" }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 12, background: `${feature.color}16`, color: feature.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 680, fontFamily: fontDisp }}>{feature.label}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 11.5, lineHeight: 1.4, color: T.txt3, fontFamily: font }}>{feature.tagline}</span>
                </span>
                <ChevronRight size={15} color={T.txt3} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform .16s ease" }} />
              </button>
              {isExpanded && (
                <div style={{ padding: "0 2px 15px 48px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, color: T.accent, fontFamily: font, fontSize: 11.5, fontWeight: 650 }}>
                    <Check size={13} strokeWidth={2.4} /> {channel}
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 6, color: T.txt2, fontFamily: font, fontSize: 12, lineHeight: 1.5 }}>
                    {steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  {prompt && (
                    <button type="button" onClick={() => onPrefill(prompt)} style={{ marginTop: 12, minHeight: 40, padding: "0 14px", borderRadius: 11, border: "none", background: T.accent, color: isLight ? "#FFFFFF" : "#041016", fontFamily: fontDisp, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                      Preparar ejemplo <ChevronRight size={14} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <aside id="copilot-capabilities" className="copilot-capabilities" aria-label="Guía de funciones del Copilot" style={{ position: "fixed", zIndex: 100002, top: 0, right: 0, bottom: 0, width: "min(430px, 100%)", display: "flex", flexDirection: "column", background: isLight ? "#FFFFFF" : "#0C0C0C", borderLeft: `1px solid ${T.border}`, boxShadow: isLight ? "-18px 0 44px rgba(15,23,42,0.12)" : "-18px 0 44px rgba(0,0,0,0.38)" }}>
      <header style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 18, fontWeight: 720, color: T.txt }}>Así te ayuda a operar</h2>
          <p style={{ margin: "5px 0 0", maxWidth: "42ch", fontFamily: font, fontSize: 12.5, lineHeight: 1.5, color: T.txt3 }}>Elige una función, revisa cómo trabaja y prepara una instrucción sin ejecutarla todavía.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar guía de funciones" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${T.border}`, background: "transparent", color: T.txt2, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <X size={17} />
        </button>
      </header>
      <div style={{ overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 20 }}>
        {renderGroup("Pídeselo al Copilot", "Consultas y cambios que inicias con texto o dictado.", requested)}
        {automatic.length > 0 && renderGroup("Agentes que trabajan solos", "Automatizaciones que vigilan la operación y te avisan cuando requieren atención.", automatic)}
      </div>
    </aside>
  );
}
