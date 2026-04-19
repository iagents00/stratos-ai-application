import { useState, useEffect } from "react";
import {
  ArrowRight, Check, X, ChevronDown, Mic, BarChart3,
  Target, Workflow, Phone, MessageSquareText,
  Building2, Users, Stethoscope, CheckCircle2,
  Shield, Clock, PhoneCall, Headphones,
  CircleDollarSign, FileText, Cpu, ChevronRight,
  ArrowUpRight, Atom, CircuitBoard, ScanLine,
  Crosshair, Activity, Radio, GitBranch, Menu, LogIn
} from "lucide-react";

/* ═══════════════════════════════════
   DESIGN SYSTEM
   ═══════════════════════════════════ */
const P = {
  bg: "#04080F",
  surface: "#080D17",
  glass: "rgba(255,255,255,0.028)",
  glassH: "rgba(255,255,255,0.048)",
  border: "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.12)",
  /* accent — usar con moderación */
  accent: "#52D9B8",
  accentS: "rgba(82,217,184,0.07)",
  accentB: "rgba(82,217,184,0.13)",
  /* colores secundarios */
  blue: "#6BAED6",
  blueS: "rgba(107,174,214,0.08)",
  violet: "#9B8AF0",
  violetS: "rgba(155,138,240,0.08)",
  rose: "#D97070",
  roseS: "rgba(217,112,112,0.08)",
  /* texto — blanco dominante */
  w: "#FFFFFF",
  txt: "#EDF2F7",
  txt2: "#8A97AA",
  txt3: "#3D4A5C",
  r: 14,
};
const font    = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`;
const fontD   = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;
const mono    = `"SF Mono", "Fira Code", "Cascadia Code", monospace`;

/* ═══════════════════════════════════
   CSS GLOBAL (inyectado una vez)
   ═══════════════════════════════════ */
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #04080F; overflow-x: hidden; }

  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%       { transform: translate(24px, -16px) scale(1.06); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* Gradient text para las palabras rotantes */
  .rotating-word {
    display: inline-block;
    /* Padding en todos los lados para que ninguna letra sea recortada */
    padding: 0.08em 0.12em 0.2em 0.04em;
    margin: -0.08em -0.12em -0.2em -0.04em;
    /* Blanco brillante dominant → acento teal muy sutil al final */
    background: linear-gradient(145deg, #FFFFFF 0%, #F0FEFA 55%, rgba(82,217,184,0.38) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: none;
    filter: drop-shadow(0 0 28px rgba(255,255,255,0.18)) drop-shadow(0 0 10px rgba(82,217,184,0.12));
  }

  /* Badge OS */
  .os-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    backdrop-filter: blur(16px);
  }

  /* Btn primary premium */
  .btn-primary {
    position: relative;
    overflow: hidden;
  }
  .btn-primary::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border-top: 1px solid rgba(255,255,255,0.28);
    pointer-events: none;
  }

  .ticker-wrap {
    position: relative;
    overflow: hidden;
  }
  /* fade edges — profesional, sin corte brusco */
  .ticker-wrap::before,
  .ticker-wrap::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    width: 100px;
    z-index: 2;
    pointer-events: none;
  }
  .ticker-wrap::before {
    left: 0;
    background: linear-gradient(to right, #04080F 0%, transparent 100%);
  }
  .ticker-wrap::after {
    right: 0;
    background: linear-gradient(to left, #04080F 0%, transparent 100%);
  }
  .ticker-track {
    display: flex;
    width: max-content;
    animation: ticker 32s linear infinite;
    will-change: transform;
  }
  .ticker-track:hover { animation-play-state: paused; }

  .fade-up { animation: fade-up 0.7s ease both; }

  /* grid responsive */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .grid-plans {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .grid-plans { grid-template-columns: repeat(2, 1fr); }
    .grid-4     { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 900px) {
    .grid-2   { grid-template-columns: 1fr; }
    .grid-3   { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 640px) {
    .grid-2, .grid-3, .grid-4, .grid-plans {
      grid-template-columns: 1fr;
    }
    .hide-mobile { display: none !important; }
    .nav-links   { display: none !important; }
    .hamburger-btn { display: flex !important; }
    .enterprise-grid {
      grid-template-columns: 1fr !important;
    }
  }
  @media (max-width: 900px) {
    .enterprise-grid {
      grid-template-columns: 1fr !important;
    }
  }

  /* scroll bar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  /* table */
  .comp-table { width: 100%; border-collapse: separate; border-spacing: 0; }
  .comp-table th, .comp-table td { padding: 13px 16px; }
  .comp-table th { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .comp-table td { font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .comp-table tr:last-child td { border-bottom: none; }
  @media (max-width: 700px) {
    .comp-table { font-size: 11px; }
    .comp-table th, .comp-table td { padding: 10px 10px; }
    .comp-col-hide { display: none; }
  }
`;

/* ═══════════════════════════════════
   ATOM LOGO
   ═══════════════════════════════════ */
const StratosAtom = ({ size = 22, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.1" opacity="0.25" />
    <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.1" opacity="0.55" />
    <circle cx="16" cy="16" r="1.6" fill={color} />
  </svg>
);

/* Icono científico para IA */
const AtomIcon = ({ size = 18, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round">
    <circle cx="12" cy="12" r="2" fill={color} fillOpacity="0.9" stroke="none"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
  </svg>
);

const DNAIcon = ({ size = 18, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <path d="M4 4c0 0 4 2 8 2s8-2 8-2"/>
    <path d="M4 20c0 0 4-2 8-2s8 2 8 2"/>
    <path d="M4 4 4 20"/>
    <path d="M20 4 20 20"/>
    <path d="M4 9c4 1 8 1 16 0"/>
    <path d="M4 15c4-1 8-1 16 0"/>
  </svg>
);

/* ═══════════════════════════════════
   GLASS CARD
   ═══════════════════════════════════ */
const G = ({ children, style, hover, onClick, accent }) => {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: accent
          ? `linear-gradient(135deg, rgba(82,217,184,0.06) 0%, rgba(82,217,184,0.02) 100%)`
          : (h ? P.glassH : P.glass),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${accent ? "rgba(82,217,184,0.18)" : (h ? P.borderH : P.border)}`,
        borderRadius: P.r,
        transition: "all 0.28s cubic-bezier(.4,0,.2,1)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >{children}</div>
  );
};

/* ═══════════════════════════════════
   BADGE
   ═══════════════════════════════════ */
const Badge = ({ children, color = P.accent }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 13px", borderRadius: 99,
    fontSize: 11, fontWeight: 600, color,
    background: `${color}10`, border: `1px solid ${color}1E`,
    letterSpacing: "0.06em", textTransform: "uppercase",
    fontFamily: font,
  }}>{children}</span>
);

/* ═══════════════════════════════════
   BUTTON
   ═══════════════════════════════════ */
const Btn = ({ children, primary, sm, onClick, style }) => {
  const [h, setH] = useState(false);
  if (primary) return (
    <button
      className="btn-primary"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 9,
        padding: sm ? "10px 22px" : "15px 32px",
        borderRadius: 11, cursor: "pointer", fontFamily: fontD,
        fontSize: sm ? 13 : 14, fontWeight: 600, letterSpacing: "0.01em",
        border: "none",
        background: h
          ? "linear-gradient(135deg, #6AEDC8 0%, #4EC9A8 100%)"
          : "linear-gradient(135deg, #52D9B8 0%, #3BBFA0 100%)",
        color: "#061412",
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        transform: h ? "translateY(-2px)" : "none",
        boxShadow: h
          ? "0 8px 32px rgba(82,217,184,0.35), 0 2px 8px rgba(0,0,0,0.3)"
          : "0 4px 16px rgba(82,217,184,0.18), 0 1px 4px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >{children}</button>
  );
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: sm ? "9px 20px" : "14px 28px",
        borderRadius: 11, cursor: "pointer", fontFamily: fontD,
        fontSize: sm ? 13 : 14, fontWeight: 500, letterSpacing: "0.01em",
        border: `1px solid ${h ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.09)"}`,
        background: h ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        color: h ? P.txt : P.txt2,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        transition: "all 0.22s ease",
        transform: h ? "translateY(-1px)" : "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >{children}</button>
  );
};

/* ═══════════════════════════════════
   ROTATING HEADLINE
   ═══════════════════════════════════ */
const RotatingWord = () => {
  const words = [
    "Call Centers de IA",
    "Marketing + IA",
    "Equipos de iAgents",
    "CRM Inteligente",
    "ERPs Autónomos",
    "Avatars de IA",
    "seguimiento real",
  ];
  const [idx, setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % words.length); setVisible(true); }, 320);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className="rotating-word"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >{words[idx]}</span>
  );
};

/* ═══════════════════════════════════
   TICKER — servicios
   ═══════════════════════════════════ */
const TickerItem = ({ label, icon: Icon }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 12,
    padding: "13px 32px",
    borderRight: `1px solid rgba(255,255,255,0.05)`,
    whiteSpace: "nowrap", flexShrink: 0,
  }}>
    <div style={{
      width: 24, height: 24, borderRadius: 7,
      background: P.accentS, border: `1px solid ${P.accentB}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon size={12} color={P.accent} strokeWidth={1.6} />
    </div>
    <span style={{
      color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500,
      fontFamily: font, letterSpacing: "0.02em",
    }}>
      {label}
    </span>
  </div>
);

const Ticker = () => {
  const items = [
    { label: "Call Center + IA",       icon: PhoneCall      },
    { label: "Marketing + IA",          icon: Activity       },
    { label: "CRM Inteligente",         icon: GitBranch      },
    { label: "Equipos de iAgents",      icon: Radio          },
    { label: "Avatars de IA",           icon: ScanLine       },
    { label: "ERPs Autónomos",          icon: CircuitBoard   },
    { label: "Automatización comercial",icon: Cpu            },
    { label: "Reportes en tiempo real", icon: BarChart3      },
  ];
  // triplicar para que el loop sea completamente continuo sin saltos
  const track = [...items, ...items, ...items];
  return (
    <div
      className="ticker-wrap"
      style={{
        borderTop: `1px solid ${P.border}`,
        borderBottom: `1px solid ${P.border}`,
        background: "rgba(255,255,255,0.01)",
        height: 50,
        display: "flex", alignItems: "center",
      }}
    >
      <div className="ticker-track">
        {track.map((item, i) => <TickerItem key={i} {...item} />)}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════
   TRUST STATS — glass institucional
   ═══════════════════════════════════ */
const StatCard = ({ value, label, sub, accent }) => (
  <G accent={accent} style={{ padding: "22px 20px", borderRadius: 14 }}>
    {/* top accent line */}
    {accent && <div style={{ width: 28, height: 2, background: P.accent, borderRadius: 1, marginBottom: 14, boxShadow: `0 0 8px ${P.accent}` }}/>}
    <div style={{ marginBottom: 6 }}>
      <span style={{
        fontSize: "clamp(22px, 2.6vw, 32px)", fontWeight: 300,
        fontFamily: fontD, letterSpacing: "-0.04em",
        color: accent ? P.accent : P.w,
      }}>{value}</span>
    </div>
    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, fontFamily: font, marginBottom: 4, letterSpacing: "0.01em" }}>{label}</p>
    {sub && <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 10, fontFamily: mono, letterSpacing: "0.02em" }}>{sub}</p>}
  </G>
);

/* ═══════════════════════════════════
   VOICE DEMO
   ═══════════════════════════════════ */
const VoiceDemo = () => {
  const [step, setStep] = useState(0);
  const [text, setText]  = useState("");
  const [typing, setTyping] = useState(false);
  const inputText = `"Actualiza a Carlos Ramírez. Interesado en premium. Cambia estatus a negociación, recuérdame seguimiento mañana."`;

  useEffect(() => {
    if (step !== 1) return;
    setTyping(true); setText("");
    let i = 0;
    const t = setInterval(() => {
      setText(inputText.slice(0, i + 1)); i++;
      if (i >= inputText.length) { clearInterval(t); setTyping(false); }
    }, 22);
    return () => clearInterval(t);
  }, [step]);

  const steps = [
    { icon: Mic,          color: P.accent,  title: "El asesor habla o escribe",  desc: "En lenguaje natural. Sin pantallas extra ni formularios." },
    { icon: CircuitBoard, color: P.blue,    title: "Stratos AI procesa",          desc: "Actualiza estatus, guarda contexto, crea tarea automática." },
    { icon: BarChart3,    color: P.violet,  title: "La empresa gana claridad",   desc: "Pipeline actualizado. Dirección ve el estado real." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            flex: 1, padding: "10px 6px", borderRadius: 9, cursor: "pointer",
            border: `1px solid ${step === i ? s.color + "35" : P.border}`,
            background: step === i ? `${s.color}08` : "transparent",
            color: step === i ? s.color : P.txt3,
            fontSize: 11, fontWeight: 600, fontFamily: mono,
            transition: "all 0.2s", letterSpacing: "0.02em",
          }}>
            <span style={{ opacity: 0.5 }}>0{i + 1}.</span> {["Habla","Procesa","Claridad"][i]}
          </button>
        ))}
      </div>

      {/* card */}
      <G style={{ padding: 22, minHeight: 164 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${steps[step].color}10`, border: `1px solid ${steps[step].color}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {(() => { const I = steps[step].icon; return <I size={16} color={steps[step].color} />; })()}
          </div>
          <div>
            <p style={{ color: P.w, fontSize: 14, fontWeight: 600, fontFamily: fontD }}>{steps[step].title}</p>
            <p style={{ color: P.txt2, fontSize: 12, marginTop: 3, fontFamily: font }}>{steps[step].desc}</p>
          </div>
        </div>

        {step === 0 && (
          <div style={{
            background: P.accentS, border: `1px solid ${P.accentB}`,
            borderRadius: 9, padding: "12px 14px",
          }}>
            <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, lineHeight: 1.6 }}>{inputText}</p>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              background: P.blueS, border: `1px solid rgba(107,174,214,0.18)`,
              borderRadius: 9, padding: "11px 14px", minHeight: 44,
            }}>
              <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, lineHeight: 1.6 }}>
                {text}<span style={{ opacity: typing ? 1 : 0, color: P.blue }}>▌</span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["→ Estatus: Negociación", "→ Contexto guardado", "→ Tarea: mañana"].map((t, i) => (
                <span key={i} style={{
                  padding: "3px 9px", borderRadius: 5, fontSize: 11, fontFamily: mono,
                  color: P.blue, background: P.blueS, border: `1px solid rgba(107,174,214,0.16)`,
                }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "Pipeline", v: "8 oportunidades" },
              { l: "Próximo follow-up", v: "Mañana 9 AM" },
              { l: "Actualización del equipo", v: "+94% este mes" },
              { l: "Asesor", v: "Libre para vender" },
            ].map((it, i) => (
              <div key={i} style={{
                background: P.violetS, border: "1px solid rgba(155,138,240,0.14)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <p style={{ color: P.txt2, fontSize: 10, fontFamily: mono, marginBottom: 3 }}>{it.l}</p>
                <p style={{ color: P.violet, fontSize: 13, fontWeight: 600, fontFamily: fontD }}>{it.v}</p>
              </div>
            ))}
          </div>
        )}
      </G>

      <button onClick={() => setStep(s => (s + 1) % 3)} style={{
        padding: "10px", borderRadius: 8, border: `1px solid ${P.border}`,
        background: "transparent", color: P.txt2, fontSize: 12, cursor: "pointer",
        fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        transition: "all 0.2s",
      }}>
        Siguiente paso <ChevronRight size={13} />
      </button>
    </div>
  );
};

/* ═══════════════════════════════════
   FAQ ACCORDION
   ═══════════════════════════════════ */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <G hover onClick={() => setOpen(o => !o)} style={{ padding: "18px 22px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <p style={{ color: P.txt, fontSize: 14, fontWeight: 500, fontFamily: fontD, lineHeight: 1.4 }}>{q}</p>
        <div style={{
          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
          background: P.accentS, border: `1px solid ${P.accentB}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.22s",
        }}>
          <ChevronDown size={12} color={P.accent} />
        </div>
      </div>
      {open && (
        <p style={{ color: P.txt2, fontSize: 13, fontFamily: font, marginTop: 13, lineHeight: 1.75 }}>{a}</p>
      )}
    </G>
  );
};

/* ═══════════════════════════════════
   COMPARISON TABLE
   ═══════════════════════════════════ */
const CompareTable = () => {
  const features = [
    "Precio de entrada mensual",
    "Setup / Activación",
    "Agente IA por voz o texto",
    "Enfoque en adopción del equipo",
    "Call center con IA incluido",
    "Soporte en español",
    "Onboarding incluido",
  ];
  const cols = [
    { name: "Stratos AI", highlight: true,
      vals: ["Desde $37/mes", "Sin costo este mes", true, true, true, true, true] },
    { name: "HubSpot",
      vals: ["$15–$150/usuario", "$1,500–$3,500", false, false, false, "Parcial", "Costo extra"] },
    { name: "Salesforce",
      vals: ["$25–$550/usuario", "Impl. externo", false, false, false, "Parcial", "Costo extra"] },
    { name: "HighLevel",
      vals: ["$97–$497/mes", "$0", false, false, false, "Inglés", "Básico"] },
    { name: "Pipedrive",
      vals: ["$14–$69/usuario", "$0", false, false, false, "Limitado", "Solo videos"] },
  ];

  return (
    <div style={{ overflowX: "auto", borderRadius: P.r }}>
      <table className="comp-table" style={{ fontFamily: font }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", color: P.txt2, width: "20%" }}>Característica</th>
            {cols.map((c, i) => (
              <th key={i} style={{
                textAlign: "center",
                color: c.highlight ? P.accent : P.txt2,
                background: c.highlight ? P.accentS : "transparent",
                borderBottom: c.highlight ? `1px solid rgba(82,217,184,0.18)` : `1px solid ${P.border}`,
              }}>
                {c.highlight && <span style={{ display: "block", fontSize: 8, letterSpacing: "0.1em", marginBottom: 2, opacity: 0.7 }}>★</span>}
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feat, fi) => (
            <tr key={fi}>
              <td style={{ color: P.txt2, fontFamily: font }}>{feat}</td>
              {cols.map((c, ci) => {
                const v = c.vals[fi];
                return (
                  <td key={ci} style={{
                    textAlign: "center",
                    background: c.highlight ? "rgba(82,217,184,0.03)" : "transparent",
                  }}>
                    {typeof v === "boolean"
                      ? v
                        ? <Check size={15} color={P.accent} />
                        : <X size={13} color={P.txt3} strokeWidth={1.5} />
                      : <span style={{
                        color: c.highlight ? P.txt : P.txt2,
                        fontWeight: c.highlight ? 500 : 400,
                        fontSize: 12,
                      }}>{v}</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════
   PRICING CARD
   ═══════════════════════════════════ */
const PricingCard = ({ plan }) => {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        borderRadius: P.r + 4,
        border: plan.highlight
          ? `1px solid rgba(82,217,184,0.28)`
          : `1px solid ${h ? P.borderH : P.border}`,
        background: plan.highlight
          ? `linear-gradient(160deg, rgba(82,217,184,0.08) 0%, rgba(82,217,184,0.02) 100%)`
          : (h ? P.glassH : P.glass),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: 24,
        position: "relative",
        transition: "all 0.28s ease",
        transform: plan.highlight ? "none" : h ? "translateY(-2px)" : "none",
        boxShadow: plan.highlight ? `0 0 48px rgba(82,217,184,0.08)` : "none",
        display: "flex", flexDirection: "column",
      }}
    >
      {plan.badge && (
        <div style={{
          position: "absolute", top: -12, left: 20,
          padding: "4px 14px", borderRadius: 99,
          background: plan.highlight ? P.accent : "rgba(155,138,240,0.9)",
          color: plan.highlight ? "#060A11" : "#fff",
          fontSize: 10, fontWeight: 700, fontFamily: font,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>{plan.badge}</div>
      )}

      {/* nombre + desc */}
      <div style={{ marginBottom: 18 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, fontFamily: mono,
          color: plan.highlight ? P.accent : P.txt2,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4,
        }}>{plan.name}</p>
        <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, lineHeight: 1.55 }}>{plan.desc}</p>
      </div>

      {/* precio */}
      {plan.enterprise ? (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: P.w, fontSize: 22, fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em" }}>
            Proyecto a medida
          </p>
          <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, marginTop: 5 }}>
            Desde <b style={{ color: P.violet }}>$1,200 USD/mes</b>
          </p>
          <p style={{ color: P.txt3, fontSize: 11, fontFamily: font, marginTop: 3 }}>
            Implementación desde <b style={{ color: P.violet }}>$5,000 USD</b>
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <span style={{ color: P.txt2, fontSize: 16, fontFamily: fontD, verticalAlign: "top", lineHeight: "2.2" }}>$</span>
            <span style={{
              color: P.w, fontSize: 40, fontWeight: 300,
              fontFamily: fontD, letterSpacing: "-0.04em", lineHeight: 1,
            }}>{plan.price}</span>
            <span style={{ color: P.txt2, fontSize: 12, fontFamily: font, marginBottom: 4, paddingLeft: 2 }}>USD/mes</span>
          </div>
          <p style={{ color: P.txt3, fontSize: 11, fontFamily: font, marginTop: 6 }}>
            Regular: <s style={{ color: P.txt3 }}>${plan.regular}/mes</s>
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
              color: "#4ADE80", background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.16)", fontFamily: mono,
            }}>✓ Implementación gratis este mes</span>
          </div>
        </div>
      )}

      {/* features */}
      <div style={{ flex: 1, marginBottom: 20, display: "flex", flexDirection: "column", gap: 9 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
              background: plan.highlight ? P.accentB : "rgba(255,255,255,0.04)",
              border: `1px solid ${plan.highlight ? "rgba(82,217,184,0.25)" : P.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={9} color={plan.highlight ? P.accent : P.txt2} />
            </div>
            <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, lineHeight: 1.5 }}>{f}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Btn
        primary={plan.highlight}
        style={{ width: "100%", justifyContent: "center", fontSize: 13 }}
        onClick={() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth" })}
      >
        {plan.cta} <ArrowRight size={13} />
      </Btn>

      {plan.users && (
        <p style={{ color: P.txt3, fontSize: 10, fontFamily: font, marginTop: 10, textAlign: "center" }}>
          {plan.users}
        </p>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN — LANDING PAGE
   ═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   MAIN — LANDING PAGE (auth removed — lives in app subdomain)
   ═══════════════════════════════════════════════════════ */

// Auth lives in LoginScreen.jsx (app subdomain only)
// This stub keeps demo data seeded for local dev convenience
function seedDemoAccount() {
  try {
    const users = JSON.parse(localStorage.getItem("stratos_users") || "[]");
    if (!users.find(u => u.email === "demo@stratos.ai")) {
      users.unshift({ id: 1, name: "Usuario Demo", email: "demo@stratos.ai", password: "Demo2024" });
      localStorage.setItem("stratos_users", JSON.stringify(users));
    }
  } catch {}
}

/* ═══════════════════════════════════════════════════════
   MAIN — LANDING PAGE
   ═══════════════════════════════════════════════════════ */
export default function LandingMarketing({ appUrl = "/?app" }) {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 640) setMobileMenu(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const W = { maxWidth: 1080, margin: "0 auto", padding: "0 20px" };

  /* ── Data ── */
  const plans = [
    {
      name: "Start", desc: "Entra rápido. Ordena seguimiento y logra adopción real del sistema.",
      price: 37, regular: 147, users: "3 usuarios incluidos", cta: "Activar Start",
      features: ["CRM base y pipeline", "Registro por voz o texto", "Notas, tareas y seguimiento", "Dashboard ejecutivo básico", "Onboarding guiado", "Soporte incluido"],
    },
    {
      name: "Growth", desc: "Para equipos que ya venden y necesitan más velocidad y visibilidad.",
      price: 97, regular: 297, badge: "Más elegido", highlight: true,
      users: "10 usuarios incluidos", cta: "Escalar con Growth",
      features: ["Todo lo de Start", "Hasta 10 usuarios", "Reportes por asesor", "Flujos de reactivación", "Recomendaciones de siguiente paso", "Prioridad en soporte", "Visibilidad completa para dirección"],
    },
    {
      name: "Scale", desc: "Estructura, workflows y advisory mensual para empresas en crecimiento.",
      price: 297, regular: 797, users: "25 usuarios incluidos", cta: "Activar Scale",
      features: ["Todo lo de Growth", "Hasta 25 usuarios", "Advisory estratégico mensual", "Workflows y playbooks", "Revisión ejecutiva periódica", "Soporte prioritario", "Optimización continua"],
    },
  ];

  const faqs = [
    { q: "¿Cuánto tiempo tarda la implementación?", a: "Start puede estar activo en 24–48 horas. Growth y Scale incluyen onboarding guiado de 1 a 2 semanas para garantizar adopción real. Enterprise varía según alcance." },
    { q: "¿Pueden migrar nuestros datos desde otro CRM?", a: "Sí. Acompañamos la migración desde cualquier sistema — Excel, HubSpot, Salesforce, Pipedrive o cualquier base de datos existente." },
    { q: "¿Qué pasa al terminar el periodo de oferta especial?", a: "Tu cuenta pasa al precio regular del plan elegido. Siempre avisamos con al menos 30 días de anticipación. Sin cargos automáticos sin previo aviso." },
    { q: "¿Puedo agregar usuarios adicionales?", a: "Sí. En cualquier plan puedes agregar usuarios adicionales con un costo mensual por asiento. Consulta la tarifa exacta en tu diagnóstico." },
    { q: "¿El agente de voz funciona en WhatsApp?", a: "El registro por texto funciona desde cualquier canal. La integración completa con WhatsApp está disponible como módulo adicional." },
    { q: "¿Qué tan difícil es que el equipo adopte el sistema?", a: "Esa es la razón de existir de Stratos AI. El registro por voz o texto elimina la fricción principal. El onboarding guiado asegura que el equipo vea el valor desde el primer día." },
    { q: "¿Ofrecen soporte en español y en mi zona horaria?", a: "Sí. El equipo opera en español con soporte en horario de negocio México/Latinoamérica. Growth, Scale y Enterprise tienen acceso a soporte prioritario." },
    { q: "¿Puedo subir de plan después?", a: "Completamente. La escalera está diseñada para que crezcas conforme ves utilidad real. Subir de plan preserva todos tus datos, flujos e historial." },
  ];

  return (
    <div style={{ background: P.bg, minHeight: "100vh", fontFamily: font, color: P.txt, overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: navScrolled ? "rgba(4,8,15,0.92)" : "transparent",
        backdropFilter: navScrolled ? "blur(24px)" : "none",
        WebkitBackdropFilter: navScrolled ? "blur(24px)" : "none",
        borderBottom: navScrolled ? `1px solid ${P.border}` : "none",
        transition: "all 0.3s ease",
      }}>
        <div style={{ ...W, display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          {/* Logo — todo blanco, sin color acento */}
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
            <StratosAtom size={22} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: fontD, letterSpacing: "-0.025em",
              background: "linear-gradient(135deg, #FFFFFF 40%, rgba(255,255,255,0.60) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Stratos <span style={{ fontWeight: 300 }}>AI</span>
            </span>
          </a>

          {/* Desktop links — Dynamic Island pill */}
          <div className="nav-links" style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 99,
            padding: "4px 6px",
            backdropFilter: "blur(12px)",
          }}>
            {[["Solución","#solución"],["Características","#solución"],["Precios","#precios"],["Enterprise","#enterprise"],["Nosotros","#enterprise"]].map(([l, h]) => (
              <a key={l} href={h} style={{
                color: "rgba(255,255,255,0.50)", fontSize: 13, textDecoration: "none", fontWeight: 500,
                padding: "5px 14px", borderRadius: 99,
                transition: "all 0.18s",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.50)"; e.currentTarget.style.background = "transparent"; }}
              >{l}</a>
            ))}
          </div>

          {/* Desktop CTA buttons */}
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={appUrl} style={{
              padding: "8px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.10)",
              background: "transparent", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500,
              fontFamily: font, cursor: "pointer", transition: "all 0.2s", textDecoration: "none",
              display: "inline-block",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
            >
              Iniciar sesión
            </a>
            <a href={appUrl} className="btn-white-glow" style={{
              padding: "8px 20px", borderRadius: 9, border: "none",
              background: "linear-gradient(145deg, #FFFFFF 0%, #E8F4F0 100%)",
              color: "#060A12", fontSize: 13, fontWeight: 700,
              fontFamily: fontD, cursor: "pointer",
              boxShadow: "0 1px 0 rgba(255,255,255,0.3) inset, 0 4px 18px rgba(255,255,255,0.10)",
              transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              textDecoration: "none", display: "inline-block",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
                e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 28px rgba(255,255,255,0.18)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.3) inset, 0 4px 18px rgba(255,255,255,0.10)";
              }}
            >
              Empezar gratis →
            </a>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenu(m => !m)} style={{
            display: "none", width: 36, height: 36, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
            cursor: "pointer", alignItems: "center", justifyContent: "center",
            color: P.txt,
          }} className="hamburger-btn">
            {mobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div style={{
            position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 199,
            background: "rgba(4,8,15,0.98)", backdropFilter: "blur(20px)",
            display: "flex", flexDirection: "column", padding: "24px 24px 40px",
            overflowY: "auto",
          }}>
            {/* Nav links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 28 }}>
              {[["Solución","#solución"],["Características","#solución"],["Precios","#precios"],["Enterprise","#enterprise"],["Nosotros","#enterprise"]].map(([l, h]) => (
                <a key={l} href={h} onClick={() => setMobileMenu(false)} style={{
                  color: P.txt, fontSize: 18, textDecoration: "none", fontWeight: 500,
                  fontFamily: fontD, padding: "14px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  {l} <ChevronRight size={16} color={P.txt2} />
                </a>
              ))}
            </div>

            {/* CTA buttons mobile */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              <a href={appUrl} onClick={() => setMobileMenu(false)} style={{
                display: "block", width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${P.accent} 0%, #3BC9A8 100%)`,
                color: "#04080F", fontSize: 15, fontWeight: 700, fontFamily: fontD, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(82,217,184,0.30)", textDecoration: "none", textAlign: "center",
              }}>
                Empezar gratis →
              </a>
              <a href={appUrl} onClick={() => setMobileMenu(false)} style={{
                display: "block", width: "100%", padding: "13px 0", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
                color: P.txt, fontSize: 15, fontWeight: 600, fontFamily: font, cursor: "pointer",
                textDecoration: "none", textAlign: "center",
              }}>
                Iniciar sesión
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* glows */}
        <div style={{
          position: "absolute", width: 560, height: 560, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(82,217,184,0.09) 0%, transparent 70%)`,
          top: "5%", right: "10%", animation: "drift 10s ease-in-out infinite", pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", width: 420, height: 420, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(107,174,214,0.07) 0%, transparent 70%)`,
          top: "30%", left: "5%", animation: "drift 14s ease-in-out infinite reverse", pointerEvents: "none",
        }}/>
        {/* grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.018, pointerEvents: "none",
          backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
        }}/>

        {/* contenido hero */}
        <div style={{ ...W, width: "100%", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: 100, paddingBottom: 56 }} className="fade-up">
          {/* OS badge — system tag design */}
          <div style={{ marginBottom: 28 }}>
            <div className="os-badge">
              {/* live dot */}
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: P.accent,
                boxShadow: `0 0 0 2px rgba(82,217,184,0.18), 0 0 10px rgba(82,217,184,0.5)`,
                animation: "pulse-dot 2.4s ease-in-out infinite",
              }}/>
              <span style={{
                fontFamily: mono, fontSize: 11, fontWeight: 500,
                color: "rgba(255,255,255,0.55)", letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}>
                Sistema Operativo Comercial
              </span>
              <span style={{
                width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0,
              }}/>
              <span style={{
                fontFamily: mono, fontSize: 11, fontWeight: 700,
                color: P.accent, letterSpacing: "0.05em",
              }}>+ iAgents</span>
            </div>
          </div>

          {/* H1 */}
          <h1 style={{
            fontSize: "clamp(34px, 6vw, 76px)", fontWeight: 300,
            fontFamily: fontD, letterSpacing: "-0.04em", lineHeight: 1.12,
            color: P.w, marginBottom: 22, maxWidth: 900,
            overflow: "visible",
          }}>
            Escalamos empresas con<br />
            <RotatingWord />
          </h1>

          {/* subtítulo */}
          <p style={{
            color: "rgba(255,255,255,0.45)", fontSize: "clamp(14px, 1.7vw, 17px)",
            maxWidth: 480, lineHeight: 1.85, marginBottom: 40, fontWeight: 400,
            fontFamily: font,
          }}>
            El sistema operativo que hace que tu equipo registre mejor,
            siga mejor y convierta más — con IA aplicada a la operación comercial real.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
            <Btn primary onClick={() => window.location.href = appUrl}>
              Empezar gratis — sin tarjeta <ArrowRight size={15} />
            </Btn>
            <Btn onClick={() => window.location.href = appUrl}>
              Iniciar sesión <ChevronRight size={14} />
            </Btn>
          </div>

          {/* divider + trust stats */}
          <div style={{ width: "100%", borderTop: `1px solid rgba(255,255,255,0.06)`, paddingTop: 40 }}>
            <p style={{
              color: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: mono,
              letterSpacing: "0.12em", marginBottom: 24, textTransform: "uppercase",
            }}>
              Resultados documentados
            </p>
            <div className="grid-4" style={{ maxWidth: 860, margin: "0 auto" }}>
              <StatCard value="USD 40M+" label="Duke del Caribe" sub="Las mismas técnicas para tu empresa" accent />
              <StatCard value="3.5 años"  label="Ventana de referencia" sub="comercial verificada" />
              <StatCard value="Ventas + IA" label="Enfoque del sistema" sub="integración total" />
              <StatCard value="Ecosistema" label="Modelo de trabajo" sub="consultoría + plataforma" />
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ─────────────────────────── */}
      <Ticker />

      {/* ── PAIN ─────────────────────────── */}
      <section style={{ padding: "88px 0", background: "rgba(255,255,255,0.01)" }}>
        <div style={W}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <Badge color={P.rose}>Problema real</Badge>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 46px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, marginBottom: 14, color: P.w }}>
              El problema no es el CRM.<br />
              <span style={{ color: P.rose }}>Es que nadie lo alimenta.</span>
            </h2>
            <p style={{ color: P.txt2, fontSize: 15, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
              La mayoría de los equipos tiene un sistema que no refleja la realidad. Y eso le cuesta más de lo que parece.
            </p>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            {[
              { icon: Mic,             color: P.rose,   text: "El equipo quiere vender, no llenar formularios." },
              { icon: BarChart3,       color: P.blue,   text: "La dirección quiere reportes, pero el CRM queda incompleto." },
              { icon: MessageSquareText, color: P.violet, text: "Los seguimientos se pierden entre WhatsApp, llamadas y memoria humana." },
              { icon: Activity,        color: P.accent, text: "La empresa tiene oportunidades, pero todavía no tiene suficiente sistema." },
            ].map((item, i) => (
              <G key={i} hover style={{ padding: "22px 24px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${item.color}0E`, border: `1px solid ${item.color}1E`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={17} color={item.color} strokeWidth={1.6} />
                </div>
                <p style={{ color: P.txt, fontSize: 14, lineHeight: 1.65, fontFamily: font, fontWeight: 400 }}>{item.text}</p>
              </G>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUCIÓN — VOICE ─────────────────────────── */}
      <section id="solución" style={{ padding: "88px 0" }}>
        <div style={W}>
          <div className="grid-2" style={{ alignItems: "center", gap: 52 }}>
            <div>
              <Badge color={P.accent}><Atom size={10} strokeWidth={1.5} /> Agente IA</Badge>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 42px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, marginBottom: 14, color: P.w }}>
                El agente que hace que<br />
                <span style={{ color: P.accent }}>el equipo sí registre</span>
              </h2>
              <p style={{ color: P.txt2, fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
                El asesor habla o escribe en lenguaje natural. El agente actualiza el CRM, guarda el contexto, crea la tarea y recomienda el siguiente paso. Sin formularios, sin fricción.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Actualiza estatus con voz o texto",
                  "Registra contexto, objeciones y notas",
                  "Crea tareas y recordatorios automáticos",
                  "Resume interacción para dirección",
                  "Recomienda el siguiente paso más útil",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: P.accentS, border: `1px solid ${P.accentB}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={9} color={P.accent} />
                    </div>
                    <p style={{ color: P.txt2, fontSize: 13, fontFamily: font }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
            <VoiceDemo />
          </div>
        </div>
      </section>

      {/* ── RESULTADOS ─────────────────────────── */}
      <section style={{ padding: "80px 0", background: "rgba(255,255,255,0.01)" }}>
        <div style={W}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", color: P.w }}>
              Lo que cambia en tu empresa
            </h2>
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            {[
              { icon: Target,       color: P.accent, title: "Más conversión",         text: "Menos fugas entre lead y cierre. Más claridad sobre qué sí funciona." },
              { icon: Workflow,     color: P.blue,   title: "Menos fricción",          text: "Registrar, actualizar y reportar deja de sentirse pesado." },
              { icon: CircuitBoard, color: P.violet, title: "IA que sí ayuda",        text: "La información se convierte en contexto, prioridad y siguientes pasos." },
              { icon: BarChart3,    color: "#4ADE80", title: "Claridad para dirección", text: "Mejor lectura del pipeline, del equipo y de las oportunidades." },
            ].map((item, i) => (
              <G key={i} hover style={{ padding: "24px 20px" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, marginBottom: 14,
                  background: `${item.color}0E`, border: `1px solid ${item.color}1C`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={18} color={item.color} strokeWidth={1.5} />
                </div>
                <p style={{ color: P.w, fontSize: 14, fontWeight: 600, fontFamily: fontD, marginBottom: 6 }}>{item.title}</p>
                <p style={{ color: P.txt2, fontSize: 12, lineHeight: 1.65, fontFamily: font }}>{item.text}</p>
              </G>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI CALL CENTER ─────────────────────────── */}
      <section style={{ padding: "88px 0" }}>
        <div style={W}>
          <div className="grid-2" style={{ alignItems: "center", gap: 52 }}>
            {/* stats card */}
            <G style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: P.blueS, border: `1px solid rgba(107,174,214,0.18)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Atom size={14} color={P.blue} strokeWidth={1.4} />
                </div>
                <span style={{ color: P.txt2, fontSize: 11, fontFamily: mono, letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Call Center</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { l: "Primera respuesta",  v: "< 90 seg",             c: P.accent },
                  { l: "Discovery",          v: "Perfil en 1ª llamada", c: P.blue   },
                  { l: "Agendamiento",       v: "Directo al calendario", c: P.violet },
                  { l: "Seguimiento auto",   v: "Sin intervención",     c: "#4ADE80" },
                ].map((it, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 14px", borderRadius: 9,
                    background: `${it.c}08`, border: `1px solid ${it.c}16`,
                  }}>
                    <p style={{ color: P.txt2, fontSize: 12, fontFamily: font }}>{it.l}</p>
                    <p style={{ color: it.c, fontSize: 13, fontWeight: 600, fontFamily: fontD }}>{it.v}</p>
                  </div>
                ))}
              </div>
            </G>

            <div>
              <Badge color={P.blue}><Radio size={10} strokeWidth={1.5} /> Atención instantánea</Badge>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 42px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, marginBottom: 14, color: P.w }}>
                Atención en segundos.<br />
                <span style={{ color: P.blue }}>No en horas.</span>
              </h2>
              <p style={{ color: P.txt2, fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
                El AI Call Center responde leads al instante, hace discovery en la primera interacción y agenda citas directo al calendario del asesor.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Respuesta automática 24/7 a nuevos leads",
                  "Calificación inteligente antes del asesor",
                  "Agendamiento sin fricción para el cliente",
                  "Registro automático en el CRM al instante",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={14} color={P.blue} strokeWidth={1.6} />
                    <p style={{ color: P.txt2, fontSize: 13, fontFamily: font }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTORES ─────────────────────────── */}
      <section id="sectores" style={{ padding: "80px 0", background: "rgba(255,255,255,0.01)" }}>
        <div style={W}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <Badge color={P.violet}><ScanLine size={10} strokeWidth={1.5} /> Sectores</Badge>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, color: P.w }}>
              Diseñado para tu industria
            </h2>
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            {[
              { icon: Building2,   color: P.accent,  title: "Real Estate",          text: "Brokers, inmobiliarias y desarrolladoras con seguimiento de leads y pipeline claro.", badge: "Principal" },
              { icon: Stethoscope, color: P.blue,    title: "Clínicas y salud",      text: "Coordinadores, pacientes y atención al cliente con flujos de seguimiento precisos." },
              { icon: Users,       color: P.violet,  title: "Equipos comerciales",   text: "Cualquier empresa con fuerza de ventas, leads y ciclos de seguimiento que controlar." },
              { icon: Cpu,         color: "#4ADE80", title: "Proyectos Enterprise",  text: "IA, software, apps y ERP a medida para empresas con necesidades específicas.", badge: "A medida" },
            ].map((item, i) => (
              <G key={i} hover style={{ padding: "24px 20px", position: "relative" }}>
                {item.badge && (
                  <div style={{
                    position: "absolute", top: 14, right: 14,
                    padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700,
                    color: item.color, background: `${item.color}12`,
                    border: `1px solid ${item.color}1E`, fontFamily: mono, letterSpacing: "0.05em",
                  }}>{item.badge}</div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: 11, marginBottom: 14,
                  background: `${item.color}0E`, border: `1px solid ${item.color}1C`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={18} color={item.color} strokeWidth={1.5} />
                </div>
                <p style={{ color: P.w, fontSize: 14, fontWeight: 600, fontFamily: fontD, marginBottom: 6 }}>{item.title}</p>
                <p style={{ color: P.txt2, fontSize: 12, lineHeight: 1.65, fontFamily: font }}>{item.text}</p>
              </G>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────── */}
      <section id="precios" style={{ padding: "96px 0" }}>
        <div style={W}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <Badge color={P.accent}><CircleDollarSign size={10} strokeWidth={1.5} /> Precios</Badge>
            <h2 style={{ fontSize: "clamp(26px, 4.5vw, 54px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.04em", marginTop: 14, marginBottom: 14, color: P.w }}>
              Empieza fácil.<br />
              <span style={{ color: P.accent }}>Escala con claridad.</span>
            </h2>
            <p style={{ color: P.txt2, fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
              Diseñado para que el primer sí sea fácil, la adopción sea natural y el crecimiento llegue por utilidad real.
            </p>
          </div>

          {/* promo banner */}
          <G accent style={{ padding: "18px 24px", margin: "36px 0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: P.accentB, border: `1px solid rgba(82,217,184,0.25)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Atom size={16} color={P.accent} strokeWidth={1.4} />
              </div>
              <div>
                <p style={{ color: P.w, fontSize: 14, fontWeight: 600, fontFamily: fontD }}>Oferta especial de lanzamiento</p>
                <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, marginTop: 2 }}>
                  Activación sin costo · Hasta 75% de descuento en planes seleccionados
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                color: P.accent, background: P.accentS, border: `1px solid ${P.accentB}`,
                fontFamily: mono,
              }}>Vigente este mes</span>
              <span style={{ color: P.txt3, fontSize: 11, fontFamily: font }}>Nuevos clientes únicamente</span>
            </div>
          </G>

          {/* plans — 3 tarjetas */}
          <div className="grid-plans">
            {plans.map((plan, i) => <PricingCard key={i} plan={plan} />)}
          </div>

          <p style={{ textAlign: "center", color: P.txt3, fontSize: 11, fontFamily: font, marginTop: 20, lineHeight: 1.8 }}>
            Precios promocionales vigentes este mes para nuevos clientes. Al terminar el periodo, cada plan regresa a tarifa regular.
          </p>
        </div>
      </section>

      {/* ── ENTERPRISE ─────────────────────────── */}
      <section id="enterprise" style={{ padding: "80px 0" }}>
        <div style={W}>
          {/* card full-width */}
          <div style={{
            borderRadius: 20,
            border: `1px solid rgba(155,138,240,0.22)`,
            background: `linear-gradient(135deg, rgba(155,138,240,0.07) 0%, rgba(155,138,240,0.02) 60%, rgba(82,217,184,0.03) 100%)`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            padding: "clamp(28px, 4vw, 52px)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* glow decoration */}
            <div style={{
              position: "absolute", width: 300, height: 300, borderRadius: "50%",
              background: `radial-gradient(circle, rgba(155,138,240,0.12) 0%, transparent 70%)`,
              top: "-80px", right: "5%", pointerEvents: "none",
            }}/>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center", position: "relative" }} className="enterprise-grid">
              {/* left */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{
                    padding: "4px 13px", borderRadius: 99,
                    background: "rgba(155,138,240,0.14)", border: "1px solid rgba(155,138,240,0.25)",
                    color: P.violet, fontSize: 10, fontWeight: 700, fontFamily: mono,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>Enterprise · A medida</span>
                </div>
                <h2 style={{
                  fontSize: "clamp(22px, 3.5vw, 44px)", fontWeight: 300,
                  fontFamily: fontD, letterSpacing: "-0.03em", color: P.w,
                  marginBottom: 14, lineHeight: 1.1,
                }}>
                  Proyectos de inteligencia artificial<br />
                  <span style={{ color: P.violet }}>completamente a medida.</span>
                </h2>
                <p style={{ color: P.txt2, fontSize: 14, lineHeight: 1.75, maxWidth: 580, marginBottom: 28 }}>
                  Diseñamos y construimos ecosistemas de IA desde cero: agentes autónomos, software personalizado, CRM/ERP a medida, call centers de IA, avatars, marketing performance y mucho más. Cada proyecto es único.
                </p>

                {/* capabilities grid */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {[
                    { icon: PhoneCall,    label: "AI Call Centers" },
                    { icon: Activity,    label: "Marketing + IA" },
                    { icon: Radio,       label: "Equipos de iAgents" },
                    { icon: GitBranch,   label: "CRMs Inteligentes" },
                    { icon: CircuitBoard,label: "ERPs Autónomos" },
                    { icon: ScanLine,    label: "Avatars de IA" },
                    { icon: Cpu,         label: "Software a medida" },
                    { icon: Atom,        label: "Agentes autónomos" },
                  ].map((cap, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "6px 12px", borderRadius: 8,
                      background: "rgba(155,138,240,0.07)", border: "1px solid rgba(155,138,240,0.14)",
                    }}>
                      <cap.icon size={12} color={P.violet} strokeWidth={1.5} />
                      <span style={{ color: P.txt2, fontSize: 12, fontFamily: font, fontWeight: 500 }}>{cap.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* right — pricing */}
              <div style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid rgba(155,138,240,0.18)`,
                borderRadius: 16, padding: "28px 32px", minWidth: 220, textAlign: "center", flexShrink: 0,
              }}>
                <p style={{ color: P.txt3, fontSize: 10, fontFamily: mono, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Inversión desde</p>
                <p style={{ color: P.w, fontSize: 36, fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.04em", lineHeight: 1 }}>$1,200</p>
                <p style={{ color: P.txt2, fontSize: 12, fontFamily: font, marginTop: 4 }}>USD / mes</p>
                <div style={{ width: "100%", height: 1, background: P.border, margin: "16px 0" }} />
                <p style={{ color: P.txt3, fontSize: 11, fontFamily: font, marginBottom: 16, lineHeight: 1.6 }}>
                  Implementación<br />
                  <b style={{ color: P.violet }}>desde $5,000 USD</b>
                </p>
                <Btn
                  primary={false}
                  style={{ width: "100%", justifyContent: "center", fontSize: 13, borderColor: "rgba(155,138,240,0.3)", color: P.violet }}
                  onClick={() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Solicitar propuesta <ArrowRight size={13} />
                </Btn>
                <p style={{ color: P.txt3, fontSize: 10, fontFamily: font, marginTop: 10, lineHeight: 1.5 }}>
                  Cotización personalizada<br />según alcance e integraciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARATIVA ─────────────────────────── */}
      <section id="comparativa" style={{ padding: "88px 0", background: "rgba(255,255,255,0.01)" }}>
        <div style={W}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <Badge color={P.blue}><BarChart3 size={10} strokeWidth={1.5} /> Comparativa</Badge>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 42px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, marginBottom: 12, color: P.w }}>
              Aprendimos de lo mejor del mercado.<br />
              <span style={{ color: P.blue }}>Y resolvimos lo que ellos no resuelven.</span>
            </h2>
            <p style={{ color: P.txt2, fontSize: 14, maxWidth: 520, margin: "0 auto" }}>
              No competimos por más funciones. Ganamos en adopción real, registro sin fricción y claridad para dirección.
            </p>
          </div>
          <G style={{ padding: 0, overflow: "hidden" }}>
            <CompareTable />
          </G>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
            {["Precios públicos aproximados","HubSpot: onboarding $1,500–$3,500 en Pro+","Salesforce y HubSpot cobran por usuario","Stratos AI: activación sin costo este mes"].map((n, i) => (
              <span key={i} style={{
                padding: "3px 10px", borderRadius: 5, fontSize: 10, fontFamily: mono,
                color: P.txt3, background: P.glass, border: `1px solid ${P.border}`,
              }}>* {n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────── */}
      <section style={{ padding: "88px 0" }}>
        <div style={{ ...W, maxWidth: 720 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <Badge color={P.blue}><FileText size={10} strokeWidth={1.5} /> FAQ</Badge>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.03em", marginTop: 14, color: P.w }}>
              Todo lo que necesitas saber
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {faqs.map((faq, i) => <FaqItem key={i} {...faq} />)}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────── */}
      <section id="diagnostico" style={{ padding: "96px 0", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(82,217,184,0.07) 0%, transparent 70%)`,
          top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none",
        }}/>
        <div style={{ ...W, textAlign: "center", position: "relative" }}>
          <Badge color={P.accent}><Atom size={10} strokeWidth={1.5} /> Sin compromiso</Badge>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 62px)", fontWeight: 300, fontFamily: fontD, letterSpacing: "-0.04em", marginTop: 20, marginBottom: 18, color: P.w, maxWidth: 660, margin: "20px auto 18px" }}>
            ¿Listo para ordenar tu<br />
            <span style={{ color: P.accent }}>operación comercial?</span>
          </h2>
          <p style={{ color: P.txt2, fontSize: 15, maxWidth: 420, margin: "0 auto 36px", lineHeight: 1.75 }}>
            Un diagnóstico sin compromiso. Te decimos exactamente qué está frenando a tu equipo y qué se puede mejorar.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <Btn primary style={{ fontSize: 15, padding: "16px 34px" }} onClick={() => window.location.href = appUrl}>
              Empezar gratis ahora <ArrowRight size={15} />
            </Btn>
            <Btn style={{ padding: "15px 28px" }} onClick={() => window.location.href = appUrl}>
              <LogIn size={14} strokeWidth={1.6} /> Iniciar sesión
            </Btn>
          </div>

          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              [Shield,        "Sin compromiso"],
              [Clock,         "Respuesta en 24 horas"],
              [CheckCircle2,  "100% personalizado"],
            ].map(([Icon, label], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Icon size={13} color={P.txt3} strokeWidth={1.5} />
                <span style={{ color: P.txt3, fontSize: 12, fontFamily: font }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${P.border}`, padding: "36px 0" }}>
        <div style={{ ...W, display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <StratosAtom size={19} color={P.accent} />
            <span style={{ color: P.txt2, fontSize: 14, fontFamily: fontD, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Stratos <span style={{ color: P.accent }}>AI</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["Solución","#solución"],["Precios","#precios"],["Enterprise","#enterprise"],["Diagnóstico","#diagnostico"]].map(([l,h]) => (
              <a key={l} href={h} style={{ color: P.txt3, fontSize: 12, textDecoration: "none", fontFamily: font, transition: "color 0.18s" }}
                onMouseEnter={e => e.target.style.color = P.txt2}
                onMouseLeave={e => e.target.style.color = P.txt3}
              >{l}</a>
            ))}
          </div>
          <p style={{ color: P.txt3, fontSize: 11, fontFamily: mono }}>
            © {new Date().getFullYear()} Stratos AI
          </p>
        </div>
      </footer>

    </div>
  );
}
