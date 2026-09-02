/**
 * OnboardingCallCenter.jsx — Guía de configuración inicial del AI Call Center
 * ─────────────────────────────────────────────────────────────────────────────
 * URL pública (sin login): stratoscapitalgroup.com/onboarding-call-center
 * Alias: /call-center, /ai-call-center
 *
 * Qué es: el cuestionario de onboarding que NSG Consulting le manda a un
 * cliente nuevo del AI Call Center. Antes era un Word que se llenaba a mano;
 * ahora es una pantalla por sección, con barra de avance arriba, y al final
 * la respuesta cae en el CRM de Stratos Sales y le llega al equipo por correo
 * (edge function `form-submit`, migración 242).
 *
 * Experiencia:
 *   · Una sección por pantalla. Enter avanza (Cmd/Ctrl+Enter en textos largos).
 *   · Lo que va contestando se guarda en el navegador: si cierra la pestaña
 *     y vuelve, sigue donde iba.
 *   · Validación suave por paso: no deja avanzar si falta lo esencial, y dice
 *     exactamente qué falta.
 *
 * Diseño: misma paleta y tipografía de la landing pública (PL, verde menta
 * #52D9B8), inline styles + un bloque CSS para animaciones y responsive.
 * Sin Tailwind, como el resto de la app.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowRight, ArrowLeft, Check, Building2, Users, ListChecks, Target,
  MessageSquareText, Sparkles, Plus, X, Loader2, MessageCircle, Mail,
  PhoneCall, ClipboardList, FileSignature, Workflow, Plug, Rocket, AlertCircle,
} from "lucide-react";
import { enviarFormulario } from "../lib/form-submit";

/* ═══════════════════════════════════════════════════════════════════════════
   TOKENS — paleta landing (PL). Coherente con DeliveryHubCRM / ManualCRM.
   ═══════════════════════════════════════════════════════════════════════════ */
const P = {
  bg:       "#04080F",
  surface:  "#080D17",
  glass:    "rgba(255,255,255,0.028)",
  glassH:   "rgba(255,255,255,0.048)",
  border:   "rgba(255,255,255,0.07)",
  borderH:  "rgba(255,255,255,0.14)",
  accent:   "#52D9B8",
  accentS:  "rgba(82,217,184,0.07)",
  accentB:  "rgba(82,217,184,0.28)",
  accentG:  "linear-gradient(135deg, #52D9B8 0%, #34C49C 100%)",
  rose:     "#E8818C",
  roseS:    "rgba(232,129,140,0.08)",
  w:        "#FFFFFF",
  txt:      "#EDF2F7",
  txt2:     "#8A97AA",
  txt3:     "#3D4A5C",
  r:        14,
};
const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const FORMULARIO_SLUG = "onboarding-call-center";
const BORRADOR_KEY    = "stratos_onboarding_call_center_v1";
const NSG_WHATSAPP    = "5219842803001";
const NSG_EMAIL       = "info@stratoscapitalgroup.com";
const WA_EJEMPLOS_URL = `https://wa.me/${NSG_WHATSAPP}?text=${encodeURIComponent("Hola, ya llené la guía de configuración del AI Call Center. Aquí van mis ejemplos de conversaciones ideales:")}`;

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENIDO — replicado del documento "Guía de Configuración Inicial"
   ═══════════════════════════════════════════════════════════════════════════ */
const CRITERIOS = [
  { v: "Tipo de proyecto",       d: "Residencial, comercial, industrial, remodelación…" },
  { v: "Ubicación",              d: "Ciudad, zona o dirección de la obra." },
  { v: "Alcance y dimensiones",  d: "Metros cuadrados, número de unidades, etapas." },
  { v: "Fecha de inicio",        d: "Cuándo arranca o para cuándo necesitan la solución." },
  { v: "Presupuesto disponible", d: "Rango de inversión estimado." },
  { v: "Nivel de urgencia",      d: "Qué tan pronto necesitan una respuesta." },
];

const OBJETIVOS = [
  { v: "Obtener información general del cliente",              d: "Nombre, empresa, contacto y de qué se trata su proyecto." },
  { v: "Pedir planos, fotografías o documentos del proyecto",  d: "La IA solicita lo necesario para cotizar o evaluar." },
  { v: "Calificar al cliente",                                 d: "Filtrar según los criterios que definiste en el paso anterior." },
  { v: "Agendar una visita comercial o cita técnica",          d: "Reservar directamente en la agenda del equipo." },
  { v: "Dar seguimiento a propuestas o llamadas anteriores",   d: "Retomar conversaciones que quedaron abiertas." },
  { v: "Pasar la llamada en vivo a un vendedor humano",        d: "Transferir cuando el cliente está listo o lo pide." },
];

const TONOS = ["Cercano", "Ágil", "Formal", "Persuasivo", "Orientado a agendar rápido", "Consultivo", "Cálido y paciente"];

const EJEMPLOS_VIA = ["Los envío por WhatsApp", "Los envío por correo", "Prefiero que me contacten para coordinarlo"];

const PROXIMOS_PASOS = [
  { icon: ClipboardList, t: "Análisis y propuesta",           d: "Evaluamos tu información para estructurar la solución ideal y te enviamos una propuesta económica personalizada." },
  { icon: FileSignature, t: "Contratación",                   d: "Una vez aceptada la propuesta, te enviamos el contrato de servicios para su revisión y firma." },
  { icon: Workflow,      t: "Estructuración y entrenamiento", d: "Definimos los guiones, los flujos conversacionales y configuramos la voz y las reglas de negocio." },
  { icon: Plug,          t: "Integración tecnológica",        d: "Conectamos la IA con tus herramientas actuales: telefonía, CRM y calendarios." },
  { icon: Rocket,        t: "Implementación y piloto",        d: "Hacemos pruebas de llamada para asegurar la calidad antes de la activación definitiva." },
];

/* Pasos del recorrido. El intro no cuenta en la barra; el resto sí. */
const PASOS = [
  { id: "intro",      titulo: "Bienvenida" },
  { id: "proyecto",   titulo: "Datos del proyecto",             icon: Building2,         num: 1 },
  { id: "clientes",   titulo: "Tipos de clientes",              icon: Users,             num: 2 },
  { id: "criterios",  titulo: "Criterios de calificación",      icon: ListChecks,        num: 3 },
  { id: "objetivos",  titulo: "Objetivos de la llamada",        icon: Target,            num: 4 },
  { id: "tono",       titulo: "Experiencia y tono",             icon: MessageSquareText, num: 5 },
  { id: "siguientes", titulo: "Entrenamiento y próximos pasos", icon: Sparkles,          num: 6 },
];
const TOTAL_PASOS = PASOS.filter((p) => p.num).length;

const DATOS_INICIALES = {
  empresa: "", responsable: "", email: "", whatsapp: "",
  tipos_clientes: ["", "", ""],
  criterios: [], criterios_otro: "",
  objetivos: [], objetivos_otro: "",
  tono_etiquetas: [], tono: "",
  ejemplos_via: "",
};

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Lo que iba contestando, si cerró la pestaña y volvió. Sin borrador → desde cero. */
function leerBorrador() {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR_KEY) || "null");
    if (b && typeof b === "object") {
      const paso = Number.isInteger(b.paso) && b.paso > 0 && b.paso < PASOS.length ? b.paso : 0;
      return { datos: { ...DATOS_INICIALES, ...(b.datos || {}) }, paso };
    }
  } catch { /* storage bloqueado o borrador corrupto */ }
  return { datos: DATOS_INICIALES, paso: 0 };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS — animaciones, foco y responsive. Todo con prefijo .oc- para no chocar.
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = `
  .oc-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  .oc-wrap *, .oc-wrap *::before, .oc-wrap *::after { box-sizing: border-box; }
  .oc-wrap h1, .oc-wrap h2, .oc-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.025em; margin: 0; }
  .oc-wrap p { margin: 0; line-height: 1.6; }
  .oc-wrap button, .oc-wrap input, .oc-wrap textarea { font-family: inherit; }
  .oc-wrap a { color: ${P.accent}; text-decoration: none; }
  .oc-wrap ::selection { background: rgba(82,217,184,0.28); }

  .oc-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      radial-gradient(ellipse 70% 45% at 50% -5%, rgba(82,217,184,0.13) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 90% 105%, rgba(82,217,184,0.05) 0%, transparent 55%),
      linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: auto, auto, 44px 44px, 44px 44px;
  }

  @keyframes oc-in   { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes oc-pop  { from { opacity: 0; transform: scale(0.94); }      to { opacity: 1; transform: scale(1); } }
  @keyframes oc-spin { to { transform: rotate(360deg); } }
  .oc-slide { animation: oc-in 0.45s cubic-bezier(.2,.8,.2,1) both; }
  .oc-pop   { animation: oc-pop 0.5s cubic-bezier(.2,.8,.2,1) both; }
  .oc-spin  { animation: oc-spin 0.9s linear infinite; }
  .oc-d1 { animation-delay: .06s } .oc-d2 { animation-delay: .12s } .oc-d3 { animation-delay: .18s }
  .oc-d4 { animation-delay: .24s } .oc-d5 { animation-delay: .30s } .oc-d6 { animation-delay: .36s }
  @media (prefers-reduced-motion: reduce) { .oc-slide, .oc-pop { animation: none; } }

  .oc-input {
    width: 100%; background: rgba(255,255,255,0.03); border: 1px solid ${P.border}; border-radius: 12px;
    color: ${P.w}; font-size: 16px; padding: 14px 16px; outline: none; transition: border-color .18s, background .18s, box-shadow .18s;
  }
  .oc-input::placeholder { color: ${P.txt3}; }
  .oc-input:hover { border-color: ${P.borderH}; }
  .oc-input:focus { border-color: ${P.accentB}; background: rgba(82,217,184,0.03); box-shadow: 0 0 0 4px rgba(82,217,184,0.08); }
  .oc-input.oc-err { border-color: rgba(232,129,140,0.5); }
  textarea.oc-input { resize: vertical; min-height: 140px; line-height: 1.55; }

  .oc-opt {
    width: 100%; text-align: left; cursor: pointer; display: flex; gap: 14px; align-items: flex-start;
    background: rgba(255,255,255,0.02); border: 1px solid ${P.border}; border-radius: 14px; padding: 16px 18px;
    color: ${P.txt}; transition: border-color .18s, background .18s, transform .18s, box-shadow .18s;
  }
  .oc-opt:hover { border-color: ${P.borderH}; background: ${P.glassH}; }
  .oc-opt:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(82,217,184,0.25); }
  .oc-opt.on { border-color: ${P.accentB}; background: ${P.accentS}; box-shadow: 0 0 24px rgba(82,217,184,0.08); }
  .oc-opt.on:active { transform: scale(0.995); }

  .oc-chip {
    cursor: pointer; border-radius: 99px; padding: 9px 15px; font-size: 14px; font-weight: 500;
    background: rgba(255,255,255,0.03); border: 1px solid ${P.border}; color: ${P.txt2};
    display: inline-flex; align-items: center; gap: 7px; transition: all .16s;
  }
  .oc-chip:hover { border-color: ${P.borderH}; color: ${P.txt}; }
  .oc-chip.on { background: ${P.accentS}; border-color: ${P.accentB}; color: ${P.accent}; }
  .oc-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(82,217,184,0.25); }

  .oc-btn {
    cursor: pointer; border: none; border-radius: 12px; font-weight: 600; font-size: 15px;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 22px;
    transition: transform .15s, opacity .15s, box-shadow .15s, background .15s;
  }
  /* Con .oc-wrap delante para ganarle a la regla de <a> de arriba: un enlace
     con clase de botón se pinta como botón, no con el color del enlace. */
  .oc-wrap .oc-btn-primary { background: ${P.accentG}; color: #04110D; box-shadow: 0 8px 28px rgba(82,217,184,0.22); }
  .oc-wrap .oc-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(82,217,184,0.30); }
  .oc-wrap .oc-btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }
  .oc-wrap .oc-btn-ghost { background: transparent; color: ${P.txt2}; padding: 14px 14px; }
  .oc-wrap .oc-btn-ghost:hover { color: ${P.w}; background: rgba(255,255,255,0.04); }
  .oc-wrap .oc-btn-outline { background: rgba(255,255,255,0.03); color: ${P.txt}; border: 1px solid ${P.border}; text-decoration: none; }
  .oc-wrap .oc-btn-outline:hover { border-color: ${P.borderH}; background: ${P.glassH}; }
  .oc-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(82,217,184,0.3); }

  .oc-main { position: relative; z-index: 1; flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 128px 24px 150px; }
  .oc-foot {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
    background: linear-gradient(to top, ${P.bg} 60%, rgba(4,8,15,0)); padding: 26px 24px 22px;
  }
  .oc-foot-in { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .oc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .oc-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

  @media (max-width: 640px) {
    .oc-main { padding: 112px 18px 140px; }
    .oc-grid2 { grid-template-columns: 1fr; }
    .oc-steps { grid-template-columns: 1fr; }
    .oc-h1 { font-size: 30px !important; }
    .oc-h2 { font-size: 25px !important; }
    .oc-hide-sm { display: none !important; }
    .oc-foot { padding: 18px 16px 16px; }
    .oc-btn { padding: 13px 18px; font-size: 14.5px; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   PIEZAS
   ═══════════════════════════════════════════════════════════════════════════ */
const StratosAtom = ({ size = 22, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.1" opacity="0.25" />
    <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.1" opacity="0.55" />
    <circle cx="16" cy="16" r="1.6" fill={color} />
  </svg>
);

const Etiqueta = ({ children, opcional }) => (
  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: P.txt2, marginBottom: 8, letterSpacing: "0.01em" }}>
    {children}{opcional && <span style={{ color: P.txt3, fontWeight: 400 }}> · opcional</span>}
  </label>
);

const Campo = ({ label, opcional, error, ...props }) => (
  <div>
    <Etiqueta opcional={opcional}>{label}</Etiqueta>
    <input className={`oc-input${error ? " oc-err" : ""}`} {...props} />
    {error && <p style={{ color: P.rose, fontSize: 12.5, marginTop: 6 }}>{error}</p>}
  </div>
);

const Kicker = ({ children }) => (
  <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: P.accent, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
    {children}
  </p>
);

const Titulo = ({ icon: Icon, children, sub }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 className="oc-h2" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.12, display: "flex", gap: 16, alignItems: "flex-start" }}>
      {Icon && (
        <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, marginTop: 2, display: "grid", placeItems: "center", background: P.accentS, border: `1px solid ${P.accentB}`, color: P.accent }}>
          <Icon size={22} strokeWidth={1.7} />
        </span>
      )}
      <span>{children}</span>
    </h2>
    {sub && <p style={{ color: P.txt2, fontSize: 16.5, marginTop: 14, maxWidth: 600 }}>{sub}</p>}
  </div>
);

const Marca = ({ on }) => (
  <span style={{
    width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
    border: `1.5px solid ${on ? P.accent : "rgba(255,255,255,0.18)"}`, background: on ? P.accent : "transparent",
    color: "#04110D", transition: "all .16s",
  }}>
    {on && <Check size={14} strokeWidth={3.2} />}
  </span>
);

const Opcion = ({ on, titulo, desc, onClick }) => (
  <button type="button" className={`oc-opt${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}>
    <Marca on={on} />
    <span>
      <span style={{ display: "block", fontSize: 16, fontWeight: 600, color: on ? P.accent : P.w, lineHeight: 1.3 }}>{titulo}</span>
      {desc && <span style={{ display: "block", fontSize: 13.5, color: P.txt2, marginTop: 4, lineHeight: 1.45 }}>{desc}</span>}
    </span>
  </button>
);

const Chip = ({ on, children, onClick }) => (
  <button type="button" className={`oc-chip${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}>
    {on && <Check size={13} strokeWidth={3} />}{children}
  </button>
);

const Aviso = ({ children }) => (
  <div className="oc-pop" role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: P.roseS, border: "1px solid rgba(232,129,140,0.28)", borderRadius: 12, padding: "12px 14px", color: P.txt, fontSize: 14, marginTop: 18 }}>
    <AlertCircle size={17} color={P.rose} style={{ flexShrink: 0, marginTop: 1 }} />
    <span>{children}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════════════════════ */
export default function OnboardingCallCenter() {
  // Arranca donde se quedó: el borrador vive en el navegador (ver leerBorrador).
  const [paso, setPaso]       = useState(() => leerBorrador().paso);
  const [datos, setDatos]     = useState(() => leerBorrador().datos);
  const [intento, setIntento] = useState(false);   // ya intentó avanzar: mostrar errores
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [listo, setListo]     = useState(false);
  const [trampa, setTrampa]   = useState("");      // honeypot
  const inicioRef = useRef(0);   // cuándo abrió la página; se fija al montar

  /* ── Título, estilos y borrador ─────────────────────────────────────────── */
  useEffect(() => {
    inicioRef.current = Date.now();
    const prev = document.title;
    document.title = "Configuración inicial · AI Call Center · Stratos AI";
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    return () => { document.title = prev; st.remove(); };
  }, []);

  useEffect(() => {
    if (listo) return;
    try { localStorage.setItem(BORRADOR_KEY, JSON.stringify({ datos, paso })); } catch { /* storage lleno o bloqueado */ }
  }, [datos, paso, listo]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [paso, listo]);

  const set = useCallback((k, v) => setDatos((d) => ({ ...d, [k]: v })), []);
  const toggleEn = useCallback((k, v) => setDatos((d) => {
    const arr = d[k] || [];
    return { ...d, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
  }), []);

  /* ── Validación por paso ────────────────────────────────────────────────── */
  const errores = useMemo(() => {
    const e = {};
    const id = PASOS[paso].id;
    if (id === "proyecto") {
      if (!datos.empresa.trim())     e.empresa = "Escribe el nombre de tu empresa o proyecto.";
      if (!datos.responsable.trim()) e.responsable = "¿Quién está llenando esta guía?";
      if (!emailValido(datos.email)) e.email = "Necesitamos un correo válido para enviarte la propuesta.";
    }
    if (id === "clientes" && !datos.tipos_clientes.some((t) => t.trim())) e.tipos = "Describe al menos un tipo de cliente.";
    if (id === "criterios" && datos.criterios.length === 0 && !datos.criterios_otro.trim()) e.criterios = "Elige al menos un criterio.";
    if (id === "objetivos" && datos.objetivos.length === 0 && !datos.objetivos_otro.trim()) e.objetivos = "Marca al menos un objetivo.";
    if (id === "tono" && datos.tono.trim().length < 10 && datos.tono_etiquetas.length === 0) e.tono = "Cuéntanos cómo quieres que suene la atención, aunque sea en una línea.";
    return e;
  }, [datos, paso]);
  const valido = Object.keys(errores).length === 0;

  /* ── Navegación ─────────────────────────────────────────────────────────── */
  const siguiente = useCallback(() => {
    if (!valido) { setIntento(true); return; }
    setIntento(false);
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }, [valido]);
  const atras = useCallback(() => { setIntento(false); setPaso((p) => Math.max(p - 1, 0)); }, []);

  const enviar = useCallback(async () => {
    if (enviando) return;
    setEnviando(true); setErrorEnvio("");
    const r = await enviarFormulario({
      formulario: FORMULARIO_SLUG,
      contacto: { empresa: datos.empresa, responsable: datos.responsable, email: datos.email, whatsapp: datos.whatsapp },
      respuestas: {
        tipos_clientes: datos.tipos_clientes.map((t) => t.trim()).filter(Boolean),
        criterios: datos.criterios, criterios_otro: datos.criterios_otro,
        objetivos: datos.objetivos, objetivos_otro: datos.objetivos_otro,
        tono_etiquetas: datos.tono_etiquetas, tono: datos.tono,
        ejemplos_via: datos.ejemplos_via,
      },
      meta: { duracion_seg: Math.round((Date.now() - inicioRef.current) / 1000) },
      trampa,
    });
    setEnviando(false);
    if (!r.ok) { setErrorEnvio(r.error || "No se pudo enviar."); return; }
    try { localStorage.removeItem(BORRADOR_KEY); } catch { /* noop */ }
    setListo(true);
  }, [datos, enviando, trampa]);

  // Enter avanza. En textareas, Cmd/Ctrl+Enter (Enter solo hace salto de línea).
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Enter" || listo || enviando) return;
      const enTextarea = ev.target?.tagName === "TEXTAREA";
      if (enTextarea && !(ev.metaKey || ev.ctrlKey)) return;
      if (ev.target?.tagName === "BUTTON" || ev.target?.tagName === "A") return;
      ev.preventDefault();
      if (PASOS[paso].id === "siguientes") enviar(); else siguiente();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paso, listo, enviando, siguiente, enviar]);

  /* ── Barra de avance ────────────────────────────────────────────────────── */
  const actual = PASOS[paso];
  const num = actual.num || 0;
  // El 100% se gana al enviar, no al llegar al último paso: en el paso 6
  // todavía falta el envío, y una barra llena con un botón pendiente confunde.
  const progreso = listo ? 100 : Math.round((num / (TOTAL_PASOS + 1)) * 100);

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="oc-wrap">
      <div className="oc-bg" />

      {/* ── Cabecera fija + barra de avance ──────────────────────────────── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 6, background: "rgba(4,8,15,0.78)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="https://stratoscapitalgroup.com" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <StratosAtom size={22} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: fontD, letterSpacing: "-0.025em",
              background: "linear-gradient(135deg, #FFFFFF 40%, rgba(255,255,255,0.60) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Stratos <span style={{ fontWeight: 300 }}>AI</span>
            </span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: P.txt2 }}>
            <span className="oc-hide-sm">AI Call Center</span>
            <span className="oc-hide-sm" style={{ width: 1, height: 14, background: P.border }} />
            <span style={{ fontWeight: 600, color: P.txt }}>NSG Consulting</span>
          </div>
        </div>
        {/* barrita */}
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: P.txt3, marginBottom: 8 }}>
            <span style={{ color: P.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {listo ? "Enviado" : num ? `Paso ${num} de ${TOTAL_PASOS} · ${actual.titulo}` : "Guía de configuración inicial"}
            </span>
            <span style={{ color: P.accent, flexShrink: 0 }}>{progreso}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progreso}%`, borderRadius: 99, background: P.accentG, boxShadow: "0 0 12px rgba(82,217,184,0.6)", transition: "width .7s cubic-bezier(.2,.8,.2,1)" }} />
          </div>
        </div>
      </header>

      <main className="oc-main">
        {/* Honeypot: invisible para personas, irresistible para bots. */}
        <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} style={{ position: "absolute", left: -9999, opacity: 0, height: 0, width: 0 }} aria-hidden="true" />

        {listo ? (
          <Listo datos={datos} />
        ) : (
          <div key={actual.id} className="oc-slide">
            {actual.id === "intro" && <Intro onStart={siguiente} />}

            {actual.id === "proyecto" && (
              <>
                <Kicker><Building2 size={13} /> Sección 1</Kicker>
                <Titulo icon={Building2} sub="Con esto sabemos de quién es el proyecto y a dónde enviarte la propuesta.">Datos del proyecto</Titulo>
                <div style={{ display: "grid", gap: 18 }}>
                  <Campo label="Nombre de la empresa o proyecto" placeholder="Ej. Constructora Vega" value={datos.empresa} onChange={(e) => set("empresa", e.target.value)} error={intento && errores.empresa} autoFocus />
                  <Campo label="Responsable de llenado" placeholder="Ej. Juan Pérez" value={datos.responsable} onChange={(e) => set("responsable", e.target.value)} error={intento && errores.responsable} autoComplete="name" />
                  <div className="oc-grid2">
                    <Campo label="Correo electrónico" type="email" inputMode="email" placeholder="juan@empresa.com" value={datos.email} onChange={(e) => set("email", e.target.value)} error={intento && errores.email} autoComplete="email" />
                    <Campo label="WhatsApp" opcional type="tel" inputMode="tel" placeholder="+52 1 998 000 0000" value={datos.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} autoComplete="tel" />
                  </div>
                </div>
              </>
            )}

            {actual.id === "clientes" && (
              <>
                <Kicker><Users size={13} /> Sección 2</Kicker>
                <Titulo icon={Users} sub="Define los perfiles o segmentos de usuarios principales con los que va a interactuar el agente telefónico.">Tipos de clientes</Titulo>
                <div style={{ display: "grid", gap: 12 }}>
                  {datos.tipos_clientes.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: t.trim() ? P.accent : P.txt3, background: t.trim() ? P.accentS : "rgba(255,255,255,0.03)", border: `1px solid ${t.trim() ? P.accentB : P.border}`, transition: "all .16s" }}>{i + 1}</span>
                      <input
                        className="oc-input"
                        placeholder={["Ej. Developers / Desarrolladores", "Ej. Clientes residenciales", "Escribe otro tipo de cliente…"][i] || "Otro tipo de cliente…"}
                        value={t}
                        autoFocus={i === 0}
                        onChange={(e) => set("tipos_clientes", datos.tipos_clientes.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                      {datos.tipos_clientes.length > 3 && (
                        <button type="button" className="oc-btn oc-btn-ghost" aria-label="Quitar" style={{ padding: 10 }} onClick={() => set("tipos_clientes", datos.tipos_clientes.filter((_, j) => j !== i))}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {datos.tipos_clientes.length < 6 && (
                    <button type="button" className="oc-chip" style={{ justifySelf: "start", marginTop: 4 }} onClick={() => set("tipos_clientes", [...datos.tipos_clientes, ""])}>
                      <Plus size={14} /> Agregar otro tipo
                    </button>
                  )}
                </div>
                {intento && errores.tipos && <Aviso>{errores.tipos}</Aviso>}
              </>
            )}

            {actual.id === "criterios" && (
              <>
                <Kicker><ListChecks size={13} /> Sección 3</Kicker>
                <Titulo icon={ListChecks} sub="Selecciona los criterios esenciales que la IA debe recopilar durante la llamada. Puedes marcar varios.">Criterios de calificación</Titulo>
                <div style={{ display: "grid", gap: 10 }}>
                  {CRITERIOS.map((c) => (
                    <Opcion key={c.v} on={datos.criterios.includes(c.v)} titulo={c.v} desc={c.d} onClick={() => toggleEn("criterios", c.v)} />
                  ))}
                </div>
                <div style={{ marginTop: 22 }}>
                  <Campo label="Otro dato necesario" opcional placeholder="Ej. ¿Ya tienen terreno? ¿Cuentan con crédito aprobado?" value={datos.criterios_otro} onChange={(e) => set("criterios_otro", e.target.value)} />
                </div>
                {intento && errores.criterios && <Aviso>{errores.criterios}</Aviso>}
              </>
            )}

            {actual.id === "objetivos" && (
              <>
                <Kicker><Target size={13} /> Sección 4</Kicker>
                <Titulo icon={Target} sub="Marca todas las opciones que correspondan a los objetivos de la atención telefónica.">Objetivos de la llamada</Titulo>
                <div style={{ display: "grid", gap: 10 }}>
                  {OBJETIVOS.map((o) => (
                    <Opcion key={o.v} on={datos.objetivos.includes(o.v)} titulo={o.v} desc={o.d} onClick={() => toggleEn("objetivos", o.v)} />
                  ))}
                </div>
                <div style={{ marginTop: 22 }}>
                  <Etiqueta opcional>Otro objetivo o contexto</Etiqueta>
                  <textarea className="oc-input" style={{ minHeight: 100 }} placeholder="Ej. Que la IA explique nuestros tiempos de entrega antes de agendar." value={datos.objetivos_otro} onChange={(e) => set("objetivos_otro", e.target.value)} />
                </div>
                {intento && errores.objetivos && <Aviso>{errores.objetivos}</Aviso>}
              </>
            )}

            {actual.id === "tono" && (
              <>
                <Kicker><MessageSquareText size={13} /> Sección 5</Kicker>
                <Titulo icon={MessageSquareText} sub="¿Cómo te gustaría que sea la atención? Elige las etiquetas que más se acerquen y luego cuéntanoslo con tus palabras.">Experiencia y tono</Titulo>
                <Etiqueta>Estilo de atención</Etiqueta>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                  {TONOS.map((t) => <Chip key={t} on={datos.tono_etiquetas.includes(t)} onClick={() => toggleEn("tono_etiquetas", t)}>{t}</Chip>)}
                </div>
                <Etiqueta>Descríbelo con tus palabras</Etiqueta>
                <textarea className={`oc-input${intento && errores.tono ? " oc-err" : ""}`} autoFocus placeholder="Ej. Tono cercano y ágil, que no suene a robot; que resuelva dudas rápido y lleve la conversación hacia agendar una cita técnica." value={datos.tono} onChange={(e) => set("tono", e.target.value)} />
                <p style={{ fontSize: 12.5, color: P.txt3, marginTop: 8 }}>Tip: piensa en tu mejor vendedor. ¿Cómo saluda, cómo pregunta, cómo cierra?</p>
                {intento && errores.tono && <Aviso>{errores.tono}</Aviso>}
              </>
            )}

            {actual.id === "siguientes" && (
              <>
                <Kicker><Sparkles size={13} /> Sección 6</Kicker>
                <Titulo icon={Sparkles} sub="Para entrenar a la IA necesitamos ver cómo suena una conversación ideal en tu empresa.">Entrenamiento y próximos pasos</Titulo>

                <div style={{ background: P.glass, border: `1px solid ${P.border}`, borderRadius: P.r, padding: "20px 22px", marginBottom: 26 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Envíanos tus ejemplos</h3>
                  <p style={{ color: P.txt2, fontSize: 14.5, marginBottom: 16 }}>Audios, videos o transcripciones de conversaciones ideales. Con eso afinamos el guion y la voz. Puedes mandarlos ahora o después de enviar esta guía.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                    <a className="oc-btn oc-btn-outline" href={WA_EJEMPLOS_URL} target="_blank" rel="noopener noreferrer" style={{ padding: "11px 16px", fontSize: 14 }}><MessageCircle size={16} /> Por WhatsApp</a>
                    <a className="oc-btn oc-btn-outline" href={`mailto:${NSG_EMAIL}?subject=${encodeURIComponent("Ejemplos de conversaciones · AI Call Center")}`} style={{ padding: "11px 16px", fontSize: 14 }}><Mail size={16} /> Por correo</a>
                  </div>
                  <Etiqueta opcional>¿Cómo prefieres mandarlos?</Etiqueta>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {EJEMPLOS_VIA.map((v) => <Chip key={v} on={datos.ejemplos_via === v} onClick={() => set("ejemplos_via", datos.ejemplos_via === v ? "" : v)}>{v}</Chip>)}
                  </div>
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: P.txt2, marginBottom: 14 }}>Lo que sigue por parte de NSG Consulting</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {PROXIMOS_PASOS.map((s, i) => {
                    const I = s.icon;
                    return (
                      <div key={s.t} className={`oc-slide oc-d${i + 1}`} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}>
                        <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: P.accentS, color: P.accent, border: `1px solid ${P.accentB}` }}><I size={17} strokeWidth={1.8} /></span>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 600, color: P.w }}><span style={{ color: P.txt3, marginRight: 8 }}>{i + 1}</span>{s.t}</p>
                          <p style={{ fontSize: 13.5, color: P.txt2, marginTop: 3 }}>{s.d}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {errorEnvio && <Aviso>{errorEnvio}</Aviso>}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Pie con navegación ───────────────────────────────────────────── */}
      {!listo && actual.id !== "intro" && (
        <footer className="oc-foot">
          <div className="oc-foot-in">
            <button type="button" className="oc-btn oc-btn-ghost" onClick={atras} disabled={enviando}>
              <ArrowLeft size={17} /> <span className="oc-hide-sm">Atrás</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="oc-hide-sm" style={{ fontSize: 12, color: P.txt3 }}>
                {actual.id === "siguientes" ? "⌘ + Enter para enviar" : "Enter para continuar"}
              </span>
              {actual.id === "siguientes" ? (
                <button type="button" className="oc-btn oc-btn-primary" onClick={enviar} disabled={enviando}>
                  {enviando ? <><Loader2 size={17} className="oc-spin" /> Enviando…</> : <>Enviar respuestas <ArrowRight size={17} /></>}
                </button>
              ) : (
                <button type="button" className="oc-btn oc-btn-primary" onClick={siguiente}>
                  Continuar <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PORTADA
   ═══════════════════════════════════════════════════════════════════════════ */
function Intro({ onStart }) {
  return (
    <div style={{ paddingTop: 12 }}>
      <Kicker><PhoneCall size={13} /> AI Call Center · Cuestionario de onboarding</Kicker>
      <h1 className="oc-h1" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.08, marginBottom: 18 }}>
        Guía de configuración inicial
      </h1>
      <p style={{ color: P.txt2, fontSize: 17.5, maxWidth: 580, marginBottom: 30 }}>
        Con tus respuestas construimos los guiones, configuramos la voz, estructuramos la lógica conversacional e integramos tu sistema. Son 6 secciones cortas: te toma unos 5 minutos.
      </p>

      <div className="oc-steps" style={{ marginBottom: 34 }}>
        {PASOS.filter((p) => p.num).map((p, i) => {
          const I = p.icon;
          return (
            <div key={p.id} className={`oc-slide oc-d${i + 1}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: P.accentS, color: P.accent, border: `1px solid ${P.accentB}` }}><I size={15} strokeWidth={1.8} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: P.txt, lineHeight: 1.25 }}><span style={{ color: P.txt3, marginRight: 6 }}>{p.num}</span>{p.titulo}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        <button type="button" className="oc-btn oc-btn-primary" onClick={onStart} autoFocus style={{ padding: "16px 28px", fontSize: 16 }}>
          Empezar <ArrowRight size={18} />
        </button>
        <span style={{ fontSize: 13, color: P.txt3 }}>Tus respuestas se guardan en este navegador mientras avanzas.</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CIERRE
   ═══════════════════════════════════════════════════════════════════════════ */
function Listo({ datos }) {
  const nombre = datos.responsable.trim().split(/\s+/)[0] || "";
  return (
    <div className="oc-pop" style={{ textAlign: "center", paddingTop: 30 }}>
      <div style={{ width: 76, height: 76, borderRadius: 24, margin: "0 auto 26px", display: "grid", placeItems: "center", background: P.accentS, border: `1px solid ${P.accentB}`, color: P.accent, boxShadow: "0 0 50px rgba(82,217,184,0.18)" }}>
        <Check size={36} strokeWidth={2.5} />
      </div>
      <h1 className="oc-h1" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.1, marginBottom: 14 }}>
        Listo{nombre ? `, ${nombre}` : ""}. Recibimos la información de {datos.empresa.trim()}.
      </h1>
      <p style={{ color: P.txt2, fontSize: 17, maxWidth: 540, margin: "0 auto 30px" }}>
        El equipo de NSG Consulting la revisa y te enviará una propuesta personalizada a <span style={{ color: P.txt }}>{datos.email.trim()}</span>. Si aún no nos mandas tus ejemplos de conversaciones, este es el momento.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        <a className="oc-btn oc-btn-primary" href={WA_EJEMPLOS_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Enviar mis ejemplos por WhatsApp</a>
        <a className="oc-btn oc-btn-outline" href={`mailto:${NSG_EMAIL}?subject=${encodeURIComponent("Ejemplos de conversaciones · AI Call Center")}`}><Mail size={17} /> Por correo</a>
      </div>
      <p style={{ fontSize: 12.5, color: P.txt3, marginTop: 40 }}>Stratos AI · NSG Consulting</p>
    </div>
  );
}
