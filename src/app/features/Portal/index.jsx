/**
 * app/features/Portal/index.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Portal de Candidatos — Stratos People
 * Página pública de aplicación a vacantes con IA.
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useRef } from "react";
import { CheckCircle2, Bell, X, Check, FileText, Download } from "lucide-react";
import { StratosAtom } from "../../../design-system/primitives";

const pf  = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
const pfb = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;

/* ── Minimal AI Atom for portal ── */
const AIAtom = ({ size = 20, color = "#A78BFA", spin = false }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
    style={spin ? { animation: "spin 2s linear infinite" } : {}}>
    <ellipse cx="16" cy="16" rx="12.6" ry="4.6" stroke={color} strokeWidth="1" opacity="0.7" />
    <ellipse cx="16" cy="16" rx="12.6" ry="4.6" stroke={color} strokeWidth="1" opacity="0.7" transform="rotate(60 16 16)" />
    <ellipse cx="16" cy="16" rx="12.6" ry="4.6" stroke={color} strokeWidth="1" opacity="0.7" transform="rotate(120 16 16)" />
    <circle cx="16" cy="16" r="2.4" fill={color} />
  </svg>
);

export const PORTAL_VACANTES = [
  { id: 1, titulo: "Asesor de Ventas Senior", dept: "Ventas", ubicacion: "Playa del Carmen", salario: "$25,000–$45,000 MXN", tipo: "Tiempo completo" },
  { id: 2, titulo: "Coordinadora de Marketing Digital", dept: "Marketing", ubicacion: "Remoto / Cancún", salario: "$28,000–$42,000 MXN", tipo: "Tiempo completo" },
  { id: 3, titulo: "Contador Fiscal Sr. — CFDI 4.0", dept: "Finanzas", ubicacion: "Cancún", salario: "$22,000–$35,000 MXN", tipo: "Tiempo completo" },
  { id: 4, titulo: "Asistente de Dirección Ejecutiva", dept: "Dirección", ubicacion: "Cancún", salario: "$18,000–$26,000 MXN", tipo: "Tiempo completo" },
];

export const PREGUNTAS_BASE = {
  "Asesor de Ventas Senior": [
    { id: "exp_ventas", q: "¿Cuántos años de experiencia tienes en ventas de bienes raíces o productos de alto valor?", tipo: "opciones", opts: ["Menos de 1 año", "1–3 años", "3–6 años", "Más de 6 años"] },
    { id: "cierre", q: "¿Cuál fue la venta más grande que has cerrado y cómo lo lograste?", tipo: "texto", placeholder: "Describe brevemente el proceso, el monto aproximado y tu estrategia..." },
    { id: "ingles", q: "¿Cuál es tu nivel de inglés?", tipo: "opciones", opts: ["Básico (A1–A2)", "Intermedio (B1–B2)", "Avanzado (C1)", "Nativo / Bilingüe (C2)"] },
    { id: "herramientas", q: "¿Qué herramientas digitales usas en tu trabajo de ventas?", tipo: "multiselect", opts: ["CRM (Salesforce, HubSpot)", "WhatsApp Business", "Instagram / Meta Ads", "Google Workspace", "Zoom / Meet", "LinkedIn Sales Navigator"] },
    { id: "motivacion", q: "¿Por qué quieres trabajar en el mercado inmobiliario de lujo de la Riviera Maya?", tipo: "texto", placeholder: "Sé honesto y específico. Esto nos ayuda a conocerte mejor..." },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
  "Coordinadora de Marketing Digital": [
    { id: "especialidad", q: "¿Cuál es tu mayor fortaleza en marketing digital?", tipo: "opciones", opts: ["Performance / Paid Ads", "Contenido y Social Media", "SEO / SEM", "Estrategia de marca"] },
    { id: "herramientas", q: "¿Qué plataformas manejas con mayor expertise?", tipo: "multiselect", opts: ["Meta Ads Manager", "Google Ads", "TikTok Ads", "Canva / Adobe", "HubSpot", "Analytics / Tag Manager"] },
    { id: "portafolio", q: "Comparte una campaña de la que estés orgullosa y sus resultados (ROAS, CTR, conversiones, etc.)", tipo: "texto", placeholder: "Describe la campaña, la estrategia y los KPIs obtenidos..." },
    { id: "ingles", q: "¿Cuál es tu nivel de inglés?", tipo: "opciones", opts: ["Básico", "Intermedio", "Avanzado", "Nativo / Bilingüe"] },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
  default: [
    { id: "exp", q: "¿Cuántos años de experiencia tienes en el área para la que aplicas?", tipo: "opciones", opts: ["0–1 año", "1–3 años", "3–5 años", "Más de 5 años"] },
    { id: "fortaleza", q: "¿Cuál consideras que es tu principal fortaleza profesional?", tipo: "texto", placeholder: "Sé específico con un ejemplo concreto..." },
    { id: "reto", q: "¿Cuál ha sido el reto más difícil en tu carrera y cómo lo superaste?", tipo: "texto", placeholder: "Describe la situación y tu solución..." },
    { id: "expectativa", q: "¿Qué esperas del equipo y la empresa donde trabajes?", tipo: "texto", placeholder: "Cultura, crecimiento, ambiente, beneficios..." },
    { id: "disponibilidad", q: "¿Cuándo podrías incorporarte?", tipo: "opciones", opts: ["Inmediatamente", "En 2 semanas", "En 1 mes", "En más de 1 mes"] },
  ],
};

const CandidatePortal = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", telefono: "", linkedin: "", vacante: null });
  const [cvFile, setCvFile] = useState(null);
  const [cvDragging, setCvDragging] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [multiSel, setMultiSel] = useState({});
  const [pregIdx, setPregIdx] = useState(0);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [folio, setFolio] = useState("");
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const preguntas = form.vacante ? (PREGUNTAS_BASE[form.vacante.titulo] || PREGUNTAS_BASE.default) : PREGUNTAS_BASE.default;
  const pregActual = preguntas[pregIdx];
  const totalPregs = preguntas.length;

  const setF = (k, val) => setForm(p => ({ ...p, [k]: val }));

  const validateStep1 = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.apellido.trim()) e.apellido = "Requerido";
    if (!form.email.includes("@")) e.email = "Email inválido";
    if (form.telefono.replace(/\D/g,"").length < 10) e.telefono = "Mínimo 10 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCvDrop = (e) => {
    e.preventDefault(); setCvDragging(false);
    const file = e.dataTransfer?.files[0] || e.target?.files?.[0];
    if (file) setCvFile(file);
  };

  const handleNextPreg = () => {
    const val = respuestas[pregActual.id] || (multiSel[pregActual.id]?.length > 0 ? multiSel[pregActual.id].join(", ") : "");
    if (!val && pregActual.tipo !== "multiselect") return;
    if (pregActual.tipo === "multiselect") {
      setRespuestas(p => ({ ...p, [pregActual.id]: (multiSel[pregActual.id] || []).join(", ") }));
    }
    if (pregIdx < totalPregs - 1) {
      setPregIdx(i => i + 1);
    } else {
      setAiProcessing(true);
      setTimeout(() => {
        setAiProcessing(false);
        setFolio("STRP-" + Math.random().toString(36).substring(2, 8).toUpperCase());
        setStep(5);
      }, 2800);
    }
  };

  const toggleMulti = (id, opt) => {
    setMultiSel(p => {
      const curr = p[id] || [];
      return { ...p, [id]: curr.includes(opt) ? curr.filter(x => x !== opt) : [...curr, opt] };
    });
  };

  const progColors = ["#A78BFA", "#7EB8F0", "#6EE7C2", "#6EE7C2"];
  const stepLabels = ["Tus datos", "Posición", "Tu CV", "Preguntas IA"];

  const PortalInp = ({ label, type = "text", placeholder = "", error, val, onChange, required }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: error ? "#E8818C" : "rgba(255,255,255,0.55)", fontFamily: pfb }}>
        {label}{required && <span style={{ color: "#6EE7C2", marginLeft: 3 }}>*</span>}
      </label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding: "12px 16px", borderRadius: 10, fontSize: 13, fontFamily: pfb, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#E8818C50" : val ? "#6EE7C230" : "rgba(255,255,255,0.08)"}`, color: "#E2E8F0", outline: "none", transition: "border 0.2s" }}
        onFocus={e => e.target.style.borderColor = error ? "#E8818C80" : "#6EE7C240"}
        onBlur={e => e.target.style.borderColor = error ? "#E8818C50" : val ? "#6EE7C230" : "rgba(255,255,255,0.08)"}
      />
      {error && <span style={{ fontSize: 10, color: "#E8818C", fontWeight: 600 }}>{error}</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.03) 0%, transparent 55%), #0C0E14`, display: "flex", flexDirection: "column", fontFamily: pfb }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        *{box-sizing:border-box;margin:0}
        ::placeholder{color:rgba(255,255,255,0.2)!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
      `}</style>

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6,10,17,0.85)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(110,231,194,0.1)", border: "1px solid rgba(110,231,194,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StratosAtom size={21} color="#6EE7C2" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: pf, letterSpacing: "-0.02em" }}>Stratos <span style={{ color: "#6EE7C2" }}>People</span></p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Portal de Candidatos · Riviera Maya 2026</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 8, background: "rgba(110,231,194,0.05)", border: "1px solid rgba(110,231,194,0.12)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6EE7C2", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: "#6EE7C2", fontWeight: 600 }}>{PORTAL_VACANTES.length} vacantes abiertas</span>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 640, width: "100%", margin: "0 auto", padding: "36px 20px 72px" }}>

        {/* ─── STEP 5 CONFIRMACIÓN ─── */}
        {step === 5 && (
          <div style={{ textAlign: "center", padding: "48px 24px", animation: "fadeIn 0.5s ease" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(110,231,194,0.1)", border: "2px solid rgba(110,231,194,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 0 48px rgba(110,231,194,0.12)" }}>
              <CheckCircle2 size={36} color="#6EE7C2" />
            </div>
            <p style={{ fontSize: 28, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.04em", marginBottom: 10 }}>
              ¡Aplicación <span style={{ fontWeight: 700, color: "#6EE7C2" }}>enviada!</span>
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 36 }}>
              Recibimos tu aplicación para <strong style={{ color: "rgba(255,255,255,0.75)" }}>{form.vacante?.titulo}</strong>.<br />
              Te contactaremos a <strong style={{ color: "rgba(255,255,255,0.65)" }}>{form.email}</strong> en 2–5 días hábiles.
            </p>
            <div style={{ padding: "22px 36px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 32, display: "inline-block" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>NÚMERO DE FOLIO</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: "#A78BFA", fontFamily: pf, letterSpacing: "0.08em" }}>{folio}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>Guarda este número para dar seguimiento</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
              {[
                { icon: <AIAtom size={18} color="#A78BFA" />, t: "Análisis IA en proceso", s: "Tu perfil está siendo evaluado automáticamente", c: "#A78BFA" },
                { icon: <Bell size={16} color="#6EE7C2" />, t: "Respuesta en 2–5 días hábiles", s: `Te avisaremos a ${form.email}`, c: "#6EE7C2" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: `${i === 0 ? "rgba(167,139,250,0.05)" : "rgba(110,231,194,0.04)"}`, border: `1px solid ${i === 0 ? "rgba(167,139,250,0.12)" : "rgba(110,231,194,0.1)"}` }}>
                  <div style={{ flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{item.t}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 4 PREGUNTAS IA ─── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: pf }}>Pregunta {pregIdx + 1} de {totalPregs}</p>
                <p style={{ fontSize: 11, color: "#A78BFA", fontWeight: 700 }}>{Math.round((pregIdx / totalPregs) * 100)}% completado</p>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #A78BFA, #7EB8F0)", width: `${(pregIdx / totalPregs) * 100}%`, transition: "width 0.4s ease" }} />
              </div>
            </div>

            {aiProcessing ? (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 28px" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.2)", borderTop: "2px solid #A78BFA", animation: "spin 1s linear infinite" }} />
                  <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "2px solid rgba(110,231,194,0.12)", borderTop: "2px solid #6EE7C2", animation: "spin 1.6s linear infinite reverse" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AIAtom size={28} color="#A78BFA" spin />
                  </div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FFF", fontFamily: pf, marginBottom: 10 }}>Evaluando tu perfil con IA...</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, marginBottom: 20 }}>
                  Calculando score de compatibilidad,<br />analizando respuestas y generando tu perfil.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#A78BFA", animation: `blink 1.4s ${i * 0.25}s infinite` }} />)}
                </div>
              </div>
            ) : (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ padding: "26px 24px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <AIAtom size={18} color="#A78BFA" />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#FFF", fontFamily: pf, lineHeight: 1.55 }}>{pregActual?.q}</p>
                  </div>

                  {pregActual?.tipo === "opciones" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pregActual.opts.map(opt => {
                        const sel = respuestas[pregActual.id] === opt;
                        return (
                          <button key={opt} onClick={() => setRespuestas(p => ({ ...p, [pregActual.id]: opt }))} style={{ padding: "13px 18px", borderRadius: 11, textAlign: "left", cursor: "pointer", border: `1.5px solid ${sel ? "#A78BFA50" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)", color: sel ? "#A78BFA" : "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: pfb, fontWeight: sel ? 700 : 400, transition: "all 0.18s", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? "#A78BFA" : "rgba(255,255,255,0.18)"}`, background: sel ? "#A78BFA" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFF" }} />}
                            </div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {pregActual?.tipo === "multiselect" && (
                    <div>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 12, fontFamily: pfb }}>Selecciona todas las que apliquen</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {pregActual.opts.map(opt => {
                          const sel = (multiSel[pregActual.id] || []).includes(opt);
                          return (
                            <button key={opt} onClick={() => toggleMulti(pregActual.id, opt)} style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", border: `1.5px solid ${sel ? "#6EE7C250" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(110,231,194,0.08)" : "rgba(255,255,255,0.02)", color: sel ? "#6EE7C2" : "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: pfb, fontWeight: sel ? 700 : 400, transition: "all 0.18s", display: "flex", alignItems: "center", gap: 6 }}>
                              {sel && <Check size={11} color="#6EE7C2" />} {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pregActual?.tipo === "texto" && (
                    <textarea value={respuestas[pregActual.id] || ""} onChange={e => setRespuestas(p => ({ ...p, [pregActual.id]: e.target.value }))} placeholder={pregActual.placeholder} rows={4}
                      style={{ width: "100%", padding: "13px 16px", borderRadius: 11, fontSize: 13, fontFamily: pfb, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#E2E8F0", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(167,139,250,0.4)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                    />
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {pregIdx > 0 && <button onClick={() => setPregIdx(i => i - 1)} style={{ padding: "13px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Anterior</button>}
                  <button onClick={handleNextPreg}
                    disabled={!respuestas[pregActual?.id] && !(multiSel[pregActual?.id]?.length > 0)}
                    style={{ flex: 1, padding: "14px 24px", borderRadius: 11, border: "none", fontSize: 14, fontWeight: 700, cursor: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "pointer" : "default", fontFamily: pf, background: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "#FFF" : "rgba(255,255,255,0.07)", color: (respuestas[pregActual?.id] || multiSel[pregActual?.id]?.length > 0) ? "#080D14" : "rgba(255,255,255,0.2)", transition: "all 0.2s" }}>
                    {pregIdx === totalPregs - 1 ? "Enviar aplicación →" : "Siguiente →"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 18 }}>
                  {preguntas.map((_, i) => <div key={i} style={{ width: i === pregIdx ? 22 : 6, height: 4, borderRadius: 3, background: i < pregIdx ? "#6EE7C2" : i === pregIdx ? "#A78BFA" : "rgba(255,255,255,0.1)", transition: "all 0.3s" }} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEPS 1–3 ─── */}
        {step <= 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {stepLabels.map((label, i) => {
                const n = i + 1; const done = step > n; const active = step === n;
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", flex: i < stepLabels.length - 1 ? 1 : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${done ? "#6EE7C2" : active ? progColors[i] : "rgba(255,255,255,0.1)"}`, background: done ? "rgba(110,231,194,0.12)" : active ? `${progColors[i]}14` : "transparent", transition: "all 0.35s" }}>
                        {done ? <Check size={13} color="#6EE7C2" /> : <span style={{ fontSize: 11, fontWeight: 700, color: active ? progColors[i] : "rgba(255,255,255,0.2)" }}>{n}</span>}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? progColors[i] : done ? "rgba(110,231,194,0.5)" : "rgba(255,255,255,0.18)", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && <div style={{ flex: 1, height: 1, background: done ? "rgba(110,231,194,0.25)" : "rgba(255,255,255,0.06)", margin: "0 6px", marginBottom: 18, transition: "background 0.4s" }} />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 26 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    Cuéntanos sobre <span style={{ fontWeight: 700, color: "#A78BFA" }}>ti</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>Ingresa tus datos de contacto para iniciar tu aplicación. Solo tomará 2 minutos.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <PortalInp label="Nombre" placeholder="Ej. Sofía" required val={form.nombre} onChange={v => setF("nombre", v)} error={errors.nombre} />
                    <PortalInp label="Apellido" placeholder="Ej. Ramírez Torres" required val={form.apellido} onChange={v => setF("apellido", v)} error={errors.apellido} />
                  </div>
                  <PortalInp label="Correo electrónico" type="email" placeholder="tu@email.com" required val={form.email} onChange={v => setF("email", v)} error={errors.email} />
                  <PortalInp label="Teléfono (WhatsApp)" type="tel" placeholder="+52 55 1234 5678" required val={form.telefono} onChange={v => setF("telefono", v)} error={errors.telefono} />
                  <PortalInp label="LinkedIn (opcional)" placeholder="linkedin.com/in/tu-perfil" val={form.linkedin} onChange={v => setF("linkedin", v)} />
                </div>
                <button onClick={() => { if (validateStep1()) setStep(2); }} style={{ marginTop: 24, width: "100%", padding: "15px", borderRadius: 12, border: "none", background: "#FFF", color: "#080D14", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: pf }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    ¿A qué posición <span style={{ fontWeight: 700, color: "#7EB8F0" }}>aplicas?</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>Selecciona la vacante que mejor encaje con tu perfil.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {PORTAL_VACANTES.map(v => {
                    const sel = form.vacante?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => setF("vacante", v)} style={{ padding: "18px 20px", borderRadius: 14, textAlign: "left", cursor: "pointer", border: `2px solid ${sel ? "#7EB8F055" : "rgba(255,255,255,0.07)"}`, background: sel ? "rgba(126,184,240,0.07)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: sel ? "#7EB8F0" : "#FFF", fontFamily: pf }}>{v.titulo}</p>
                          {sel && <Check size={16} color="#7EB8F0" />}
                        </div>
                        <div style={{ display: "flex", gap: 14 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{v.dept} · {v.ubicacion}</span>
                          <span style={{ fontSize: 11, color: sel ? "#6EE7C2" : "rgba(110,231,194,0.55)", fontWeight: 600 }}>{v.salario}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ padding: "14px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Atrás</button>
                  <button onClick={() => { if (form.vacante) setStep(3); }} style={{ flex: 1, padding: "14px", borderRadius: 11, border: "none", background: form.vacante ? "#FFF" : "rgba(255,255,255,0.07)", color: form.vacante ? "#080D14" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: form.vacante ? "pointer" : "default", fontFamily: pf }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — CV */}
            {step === 3 && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: pf, letterSpacing: "-0.03em", marginBottom: 8 }}>
                    Sube tu <span style={{ fontWeight: 700, color: "#6EE7C2" }}>CV</span>
                  </p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>La IA lo analiza automáticamente para agilizar tu proceso.</p>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setCvDragging(true); }}
                  onDragLeave={() => setCvDragging(false)}
                  onDrop={handleCvDrop}
                  onClick={() => !cvFile && fileRef.current?.click()}
                  style={{ padding: cvFile ? "22px" : "48px 28px", borderRadius: 18, textAlign: "center", border: `2px dashed ${cvDragging ? "#6EE7C2" : cvFile ? "#6EE7C250" : "rgba(255,255,255,0.1)"}`, background: cvDragging ? "rgba(110,231,194,0.05)" : cvFile ? "rgba(110,231,194,0.03)" : "rgba(255,255,255,0.01)", cursor: cvFile ? "default" : "pointer", transition: "all 0.25s", marginBottom: 16 }}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleCvDrop} style={{ display: "none" }} />
                  {cvFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(110,231,194,0.1)", border: "1px solid rgba(110,231,194,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText size={20} color="#6EE7C2" />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginBottom: 3 }}>{cvFile.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(110,231,194,0.7)" }}>{(cvFile.size / 1024).toFixed(0)} KB · Listo para analizar con IA</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setCvFile(null); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={12} color="rgba(255,255,255,0.4)" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(110,231,194,0.07)", border: "1px solid rgba(110,231,194,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <Download size={24} color="#6EE7C2" style={{ transform: "rotate(180deg)" }} />
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: pf, marginBottom: 8 }}>{cvDragging ? "¡Suelta aquí!" : "Arrastra tu CV o haz clic"}</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>PDF, Word o imagen JPG/PNG · Máx. 10 MB</p>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        {["PDF", "DOC / DOCX", "JPG / PNG"].map(f => <span key={f} style={{ fontSize: 10, color: "rgba(110,231,194,0.55)", background: "rgba(110,231,194,0.05)", border: "1px solid rgba(110,231,194,0.12)", padding: "3px 10px", borderRadius: 5, fontWeight: 600 }}>{f}</span>)}
                      </div>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 20 }}>
                  ¿No tienes CV listo?{" "}
                  <button onClick={() => setStep(4)} style={{ background: "none", border: "none", color: "rgba(167,139,250,0.65)", cursor: "pointer", fontSize: 11, textDecoration: "underline", fontFamily: pfb }}>Continuar sin CV</button>
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(2)} style={{ padding: "14px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, cursor: "pointer", fontFamily: pfb }}>← Atrás</button>
                  <button onClick={() => setStep(4)} style={{ flex: 1, padding: "14px", borderRadius: 11, border: "none", background: cvFile ? "#FFF" : "rgba(255,255,255,0.07)", color: cvFile ? "#080D14" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: pf }}>
                    {cvFile ? "Analizar y continuar →" : "Continuar sin CV →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 28px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <StratosAtom size={13} color="rgba(255,255,255,0.18)" />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>Stratos AI · Datos protegidos con cifrado · 2026</span>
      </div>
    </div>
  );
};

export default CandidatePortal;

/* Root entry point — detecta si es portal o app principal */
export function PortalApp() {
  return <CandidatePortal />;
}
