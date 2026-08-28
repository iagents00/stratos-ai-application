/**
 * PricingScreen — Planes y pagos para Stratos AI
 * Reutilizable: puede montarse en App o LandingMarketing.
 */
import { useState } from "react";
import { useClient } from "../hooks/useClient";
import { Check, X, ChevronRight, Shield, Zap, Building2, Users, BarChart3, Brain, Phone, MessageCircle, Mail, ArrowLeft } from "lucide-react";

const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const P = {
  bg:      "#060A11",
  surface: "#0B1220",
  card:    "#0D1525",
  accent:  "#6EE7C2",
  accentS: "rgba(110,231,194,0.08)",
  accentB: "rgba(110,231,194,0.18)",
  border:  "rgba(255,255,255,0.07)",
  borderH: "rgba(255,255,255,0.13)",
  txt:     "#E2E8F0",
  txt2:    "#8B99AE",
  txt3:    "#4A5568",
  rose:    "#E8818C",
  violet:  "#A78BFA",
  blue:    "#67B7D1",
  amber:   "#F59E0B",
  emerald: "#34D399",
  glass:   "rgba(255,255,255,0.035)",
};

/* ─── Plan data ─── */
const plans = [
  {
    id: "starter",
    name: "Starter",
    label: "Para equipos que arrancan",
    icon: Zap,
    colorAccent: P.blue,
    monthlyPrice: 149,
    yearlyPrice: 99,
    ctaText: "Comenzar gratis 14 días",
    highlight: false,
    features: [
      { text: "CRM personal — hasta 50 clientes", inc: true },
      { text: "Pipeline con 10 etapas", inc: true },
      { text: "1 asesor incluido", inc: true },
      { text: "Landing pages (5/mes)", inc: true },
      { text: "Chat IA básico", inc: true },
      { text: "Métricas de desempeño personal", inc: true },
      { text: "Soporte por chat", inc: true },
      { text: "Agentes IA avanzados", inc: false },
      { text: "ERP de proyectos", inc: false },
      { text: "Módulo de Finanzas", inc: false },
      { text: "Acceso multi-asesor", inc: false },
      { text: "API + integraciones", inc: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    label: "Para equipos inmobiliarios",
    icon: Users,
    colorAccent: P.accent,
    monthlyPrice: 349,
    yearlyPrice: 249,
    ctaText: "Iniciar con Pro",
    highlight: true,
    badge: "Más popular",
    features: [
      { text: "CRM completo — clientes ilimitados", inc: true },
      { text: "Pipeline con 10 etapas", inc: true },
      { text: "Hasta 10 asesores", inc: true },
      { text: "Landing pages ilimitadas", inc: true },
      { text: "Chat IA avanzado", inc: true },
      { text: "Métricas de equipo y director", inc: true },
      { text: "Soporte prioritario", inc: true },
      { text: "Agentes IA (5 agentes)", inc: true },
      { text: "ERP de proyectos", inc: true },
      { text: "Módulo de Finanzas", inc: false },
      { text: "Acceso multi-asesor", inc: true },
      { text: "API + integraciones", inc: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    label: "Para brokers y agencias",
    icon: Building2,
    colorAccent: P.violet,
    monthlyPrice: null,
    yearlyPrice: null,
    ctaText: "Hablar con ventas",
    highlight: false,
    features: [
      { text: "CRM completo — clientes ilimitados", inc: true },
      { text: "Pipeline personalizable", inc: true },
      { text: "Asesores ilimitados", inc: true },
      { text: "Landing pages ilimitadas + white-label", inc: true },
      { text: "Chat IA — modelo propio", inc: true },
      { text: "Dashboard ejecutivo CEO", inc: true },
      { text: "Soporte dedicado 24/7", inc: true },
      { text: "Agentes IA ilimitados", inc: true },
      { text: "ERP de proyectos completo", inc: true },
      { text: "Módulo de Finanzas completo", inc: true },
      { text: "Multi-empresa + roles avanzados", inc: true },
      { text: "API + integraciones custom", inc: true },
    ],
  },
];

const faqs = [
  { q: "¿Puedo cambiar de plan en cualquier momento?", a: "Sí. Puedes hacer upgrade o downgrade desde tu panel de cuenta. Los cambios se aplican de forma prorrateada en tu próximo ciclo de facturación." },
  { q: "¿Cómo se contrata y cómo se paga?", a: "Se contrata hablando con tu ejecutivo: confirma el plan, da de alta a tu equipo y emite la factura. El pago se hace por transferencia bancaria contra factura." },
  { q: "¿Hay contratos de permanencia?", a: "No. Todos los planes son mes a mes o anuales sin penalización. Puedes cancelar en cualquier momento desde tu cuenta." },
  { q: "¿Incluye capacitación o onboarding?", a: "El plan Pro incluye una sesión de onboarding de 60 min con nuestro equipo. Enterprise incluye onboarding dedicado + capacitación al equipo completo." },
  { q: "¿Mis datos están seguros?", a: "Sí. Usamos Supabase con cifrado en reposo y en tránsito, servidores en región Latinoamérica, y cumplimos con GDPR y Ley Federal de Protección de Datos (México)." },
];


/* ─── Plan Card ─── */
function PlanCard({ plan, billing, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const savings = plan.monthlyPrice && plan.yearlyPrice
    ? Math.round(((plan.monthlyPrice - plan.yearlyPrice) / plan.monthlyPrice) * 100)
    : 0;
  const Icon = plan.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: 20,
        border: `1px solid ${plan.highlight ? `${P.accent}35` : hovered ? P.borderH : P.border}`,
        background: plan.highlight
          ? `linear-gradient(145deg, ${P.accentS} 0%, ${P.card} 100%)`
          : P.card,
        padding: "0 0 28px",
        display: "flex", flexDirection: "column",
        transition: "all 0.25s",
        transform: plan.highlight ? "translateY(-6px)" : hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: plan.highlight
          ? `0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px ${P.accent}18`
          : hovered ? "0 16px 32px rgba(0,0,0,0.3)" : "0 8px 16px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: plan.highlight ? P.accent : plan.colorAccent, borderRadius: "20px 20px 0 0", opacity: plan.highlight ? 1 : 0.5 }} />

      {/* Badge */}
      {plan.badge && (
        <div style={{ position: "absolute", top: 22, right: 18 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
            background: P.accent, color: "#04080F", padding: "3px 10px", borderRadius: 99,
          }}>{plan.badge}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "24px 28px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${plan.colorAccent}15`, border: `1px solid ${plan.colorAccent}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} color={plan.colorAccent} />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em", lineHeight: 1 }}>{plan.name}</p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: P.txt2, marginBottom: 20, marginTop: 2 }}>{plan.label}</p>

        {/* Price */}
        {price ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: P.txt2, fontFamily: font, marginBottom: 2 }}>USD</span>
            <span style={{ fontSize: 42, fontWeight: 200, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.04em", lineHeight: 1 }}>${price}</span>
            <span style={{ fontSize: 12, color: P.txt3, fontFamily: font }}>/mes</span>
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.03em" }}>A medida</p>
          </div>
        )}

        {billing === "yearly" && savings > 0 && (
          <p style={{ fontSize: 10, color: P.emerald, fontFamily: font, marginBottom: 0 }}>
            Ahorras {savings}% vs. mensual — facturado anualmente
          </p>
        )}
        {!price && (
          <p style={{ fontSize: 10, color: P.txt3, fontFamily: font }}>Precio según volumen y necesidades</p>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: "0 28px 20px" }}>
        <button
          onClick={() => onSelect(plan)}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: fontD,
            background: plan.highlight
              ? `linear-gradient(135deg, ${P.accent} 0%, #3BC9A8 100%)`
              : `rgba(255,255,255,0.07)`,
            color: plan.highlight ? "#04080F" : "#FFFFFF",
            transition: "all 0.2s",
            boxShadow: plan.highlight ? `0 4px 20px ${P.accent}30` : "none",
            letterSpacing: "0.01em",
            marginBottom: price ? 10 : 0,
          }}
          onMouseEnter={e => {
            if (plan.highlight) { e.currentTarget.style.boxShadow = `0 6px 28px ${P.accent}45`; e.currentTarget.style.transform = "translateY(-1px)"; }
            else { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; }
          }}
          onMouseLeave={e => {
            if (plan.highlight) { e.currentTarget.style.boxShadow = `0 4px 20px ${P.accent}30`; e.currentTarget.style.transform = "translateY(0)"; }
            else { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }
          }}
        >
          {plan.ctaText}
        </button>

        {/* Acá había un botón de Apple Pay. Prometía un método de pago que no
            está conectado; el plan se contrata hablando con un ejecutivo, y el
            botón de arriba ya lleva ahí. */}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: P.border, margin: "0 28px 20px" }} />

      {/* Features */}
      <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
              background: f.inc ? `${plan.colorAccent}15` : "rgba(255,255,255,0.04)",
              border: `1px solid ${f.inc ? `${plan.colorAccent}25` : "rgba(255,255,255,0.06)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {f.inc
                ? <Check size={10} color={plan.colorAccent} strokeWidth={2.5} />
                : <X size={9} color={P.txt3} strokeWidth={2} />
              }
            </div>
            <span style={{ fontSize: 12, color: f.inc ? P.txt : P.txt3, fontFamily: font, lineHeight: 1.5 }}>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Contratar un plan ───────────────────────────────────────────────────
   Acá vivía un checkout falso: un botón de Apple Pay, campos de NÚMERO DE
   TARJETA, MM/AA y CVC, y un `setTimeout` de 2.2 segundos que mostraba "Pago
   exitoso · Tu plan ha sido activado · Recibirás un correo con el recibo".

   No había procesador de pagos. No se cobraba nada, no se activaba ningún
   plan, no salía ningún correo. Y los campos de tarjeta recogían el número y
   el CVC de quien los llenara para tirarlos a la basura.

   La pantalla "Planes" la ve CUALQUIER rol, asesores incluidos. Un asesor de
   Duke podía teclear su tarjeta y quedarse esperando un recibo que no existe.

   Stratos se contrata hablando con un ejecutivo — así se cerró Duke, así se
   cerró NSG. Esto ahora hace exactamente eso, que además es lo único honesto
   que se puede hacer sin un procesador conectado. Cuando se conecte uno de
   verdad, este es el lugar. */
function ContratarModal({ plan, billing, onClose, whatsapp, email }) {
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const total = billing === "yearly" ? price * 12 : price;
  const periodo = billing === "yearly" ? "anual" : "mensual";

  const mensaje = `Hola, me interesa el plan ${plan.name} (${periodo}, $${total} USD). ¿Me ayudas con los siguientes pasos?`;
  const waLink = `https://wa.me/${String(whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
  const mailLink = `mailto:${email}?subject=${encodeURIComponent(`Plan ${plan.name}`)}&body=${encodeURIComponent(mensaje)}`;

  const boton = (principal) => ({
    width: "100%", padding: "13px 0", borderRadius: 11,
    border: principal ? "none" : `1px solid ${P.border}`,
    background: principal ? `linear-gradient(135deg, ${P.accent}, #3BC9A8)` : "transparent",
    color: principal ? "#04080F" : P.txt,
    fontSize: 13, fontWeight: 700, fontFamily: fontD, cursor: "pointer",
    textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: principal ? `0 4px 20px ${P.accent}25` : "none",
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,5,12,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0D1525", border: `1px solid ${P.border}`, borderRadius: 20, padding: "32px 32px", width: "min(420px, 92vw)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Contratar</p>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em" }}>Plan {plan.name}</h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={P.txt2} />
          </button>
        </div>

        <div style={{ background: P.glass, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: P.txt2 }}>Plan {plan.name} · {billing === "yearly" ? "Anual" : "Mensual"}</span>
            <span style={{ fontSize: 13, color: P.txt, fontWeight: 600 }}>${price}/mes</span>
          </div>
          {billing === "yearly" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: P.txt3 }}>Facturado anualmente</span>
              <span style={{ fontSize: 12, color: P.txt3 }}>${price * 12}/año</span>
            </div>
          )}
          <div style={{ height: 1, background: P.border, margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD }}>${total} USD</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: P.txt2, lineHeight: 1.7, marginBottom: 18 }}>
          Los planes se activan con tu ejecutivo: confirma la disponibilidad, da de alta a
          tu equipo y te manda la factura. Toma unos minutos.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href={waLink} target="_blank" rel="noreferrer" style={boton(true)}>
            <MessageCircle size={15} strokeWidth={2.2} /> Hablar con mi ejecutivo
          </a>
          <a href={mailLink} style={boton(false)}>
            <Mail size={15} strokeWidth={2.2} /> Escribir por correo
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PricingScreen({ onBack, embedded = false }) {
  const { config } = useClient();
  const [billing, setBilling] = useState("yearly");
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);


  const handleSelect = (plan) => {
    if (plan.monthlyPrice === null) {
      alert("Contáctanos en ventas@stratoscapitalgroup.com para un plan Enterprise a medida.");
      return;
    }
    setCheckoutPlan(plan);
  };

  return (
    <div style={{
      minHeight: embedded ? "auto" : "100vh",
      background: P.bg,
      fontFamily: font,
      color: P.txt,
      backgroundImage: `
        radial-gradient(ellipse at 20% 0%, rgba(110,231,194,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 100%, rgba(167,139,250,0.03) 0%, transparent 40%)
      `,
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: embedded ? "0 24px 60px" : "60px 24px 80px", animation: "fadeUp 0.35s ease both" }}>

        {/* Back button */}
        {onBack && (
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: P.txt2, fontSize: 13, fontFamily: font, padding: 0, marginBottom: 32 }}
            onMouseEnter={e => e.currentTarget.style.color = P.txt}
            onMouseLeave={e => e.currentTarget.style.color = P.txt2}
          >
            <ArrowLeft size={15} /> Volver
          </button>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: P.accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, padding: "4px 14px", borderRadius: 99, background: P.accentS, border: `1px solid ${P.accentB}` }}>
            Planes y Precios
          </span>
          <h1 style={{ fontSize: 44, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 16 }}>
            El sistema que cierra más ventas.<br />
            <span style={{ background: `linear-gradient(135deg, #FFFFFF, rgba(110,231,194,0.7))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Elige tu plan.
            </span>
          </h1>
          <p style={{ fontSize: 16, color: P.txt2, maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Sin contratos. Sin letra chica. Cancela en cualquier momento.
            Todos los planes incluyen 14 días de prueba gratuita.
          </p>

          {/* Billing toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 0, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, border: `1px solid ${P.border}` }}>
            {[["monthly","Mensual"],["yearly","Anual"]].map(([b, lbl]) => (
              <button key={b} onClick={() => setBilling(b)} style={{
                padding: "8px 22px", borderRadius: 9, border: "none", cursor: "pointer",
                background: billing === b ? "rgba(255,255,255,0.1)" : "transparent",
                color: billing === b ? "#FFFFFF" : P.txt3,
                fontSize: 13, fontWeight: billing === b ? 700 : 500, fontFamily: font,
                transition: "all 0.2s",
              }}>
                {lbl}
                {b === "yearly" && <span style={{ marginLeft: 7, fontSize: 9, fontWeight: 800, color: P.emerald, background: "rgba(52,211,153,0.12)", padding: "2px 7px", borderRadius: 99 }}>-30%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 64, alignItems: "start" }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 28, marginBottom: 64 }}>
          {[
            // "Pago cifrado SSL" prometía un procesador de pagos que no existe. Se
            // cobra por transferencia contra factura; eso sí es verdad.
            { icon: Shield, text: "Facturación fiscal en México" },
            { icon: Check, text: "14 días gratis sin tarjeta" },
            { icon: X, text: "Sin contratos de permanencia" },
            { icon: BarChart3, text: "Datos 100% en México / LATAM" },
            { icon: Phone, text: "Soporte en español" },
          ].map(({ icon: I, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <I size={13} color={P.accent} />
              <span style={{ fontSize: 12, color: P.txt2, fontFamily: font }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 64 }}>
          <div style={{ padding: "22px 28px", borderBottom: `1px solid ${P.border}` }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em" }}>Comparación de planes</p>
            <p style={{ fontSize: 12, color: P.txt3, marginTop: 4 }}>Todo lo que incluye cada nivel</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "14px 28px", textAlign: "left", fontSize: 11, color: P.txt3, fontFamily: font, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", width: "40%", borderBottom: `1px solid ${P.border}` }}>Funcionalidad</th>
                  {plans.map(p => (
                    <th key={p.id} style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: p.highlight ? P.accent : "#FFFFFF", fontFamily: fontD, borderBottom: `1px solid ${P.border}` }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans[0].features.map((f, fi) => (
                  <tr key={fi} style={{ borderBottom: `1px solid ${P.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = P.glass}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "11px 28px", fontSize: 12, color: P.txt2, fontFamily: font }}>{f.text}</td>
                    {plans.map(p => (
                      <td key={p.id} style={{ padding: "11px 16px", textAlign: "center" }}>
                        {p.features[fi].inc
                          ? <Check size={15} color={p.highlight ? P.accent : P.emerald} strokeWidth={2.5} style={{ display: "inline" }} />
                          : <X size={13} color={P.txt3} strokeWidth={2} style={{ display: "inline" }} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: "0 auto 64px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.03em", textAlign: "center", marginBottom: 32 }}>Preguntas frecuentes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderRadius: 12, border: `1px solid ${openFaq === i ? P.borderH : P.border}`, overflow: "hidden", transition: "all 0.2s" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  width: "100%", padding: "16px 20px", background: openFaq === i ? P.glass : "transparent",
                  border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textAlign: "left",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", fontFamily: fontD }}>{faq.q}</span>
                  <ChevronRight size={16} color={P.txt3} style={{ flexShrink: 0, transform: openFaq === i ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 20px 16px" }}>
                    <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.75 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div style={{ textAlign: "center", padding: "48px 40px", background: P.card, border: `1px solid ${P.border}`, borderRadius: 24 }}>
          <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Consultas empresariales</p>
          <h2 style={{ fontSize: 30, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.03em", marginBottom: 12 }}>
            ¿Necesitas un plan personalizado?
          </h2>
          <p style={{ fontSize: 14, color: P.txt2, marginBottom: 28, lineHeight: 1.7 }}>
            Para agencias grandes, franquicias o integraciones custom, habla con nuestro equipo.<br />
            Respuesta garantizada en menos de 2 horas hábiles.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{
              padding: "13px 28px", borderRadius: 11, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${P.accent}, #3BC9A8)`, color: "#04080F",
              fontSize: 13, fontWeight: 700, fontFamily: fontD,
              boxShadow: `0 4px 20px ${P.accent}30`,
            }}>
              Hablar con ventas
            </button>
            <button style={{
              padding: "13px 28px", borderRadius: 11, border: `1px solid ${P.border}`, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", color: P.txt,
              fontSize: 13, fontWeight: 500, fontFamily: font,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <MessageCircle size={14} /> Chat en vivo
            </button>
          </div>
        </div>
      </div>

      {/* Contratar un plan */}
      {checkoutPlan && (
        <ContratarModal
          plan={checkoutPlan}
          billing={billing}
          whatsapp={config?.support?.whatsapp || "17479779711"}
          email={config?.support?.email || "ventas@stratoscapitalgroup.com"}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </div>
  );
}
