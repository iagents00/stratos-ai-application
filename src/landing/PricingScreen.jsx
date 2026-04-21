/**
 * PricingScreen — Planes y pagos para Stratos AI
 * Reutilizable: puede montarse en App o LandingMarketing.
 */
import { useState } from "react";
import { Check, X, ChevronRight, Shield, Zap, Building2, Users, BarChart3, Brain, Phone, MessageCircle, ArrowLeft } from "lucide-react";

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
    label: "Para asesores independientes",
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
  { q: "¿Qué métodos de pago aceptan?", a: "Apple Pay, tarjeta de crédito/débito (Visa, Mastercard, Amex), transferencia bancaria y OXXO Pay para México. Todos los pagos son procesados de forma segura con cifrado TLS." },
  { q: "¿Hay contratos de permanencia?", a: "No. Todos los planes son mes a mes o anuales sin penalización. Puedes cancelar en cualquier momento desde tu cuenta." },
  { q: "¿Incluye capacitación o onboarding?", a: "El plan Pro incluye una sesión de onboarding de 60 min con nuestro equipo. Enterprise incluye onboarding dedicado + capacitación al equipo completo." },
  { q: "¿Mis datos están seguros?", a: "Sí. Usamos Supabase con cifrado en reposo y en tránsito, servidores en región Latinoamérica, y cumplimos con GDPR y Ley Federal de Protección de Datos (México)." },
];

/* ─── Apple Pay Button ─── */
function ApplePayButton({ onClick, plan }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
        background: "#000000", color: "#FFFFFF",
        fontSize: 15, fontWeight: 500, fontFamily: fontD,
        cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8,
        transition: "all 0.2s",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#000000"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Apple logo */}
      <svg width="14" height="17" viewBox="0 0 814 1000" fill="white">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.7 269-317.7 70.6 0 129.5 42.4 174 42.4 42.5 0 109.2-44.8 188.5-44.8 30.4 0 111.4 2.6 170.3 82.6zm-75.5-165.7c-28.6 35.3-75.7 62.3-128.1 62.3-5.6 0-11.2-.4-16.8-1.1-.8-5.8-1.2-11.6-1.2-17.8 0-40.1 20.9-80.9 50-108.8 28.6-27.7 76.6-47.2 118.2-47.2 5.6 0 11.2.4 16.8 1.1 1.1 7 1.5 13.6 1.5 19.8 0 41.9-18.2 83.8-40.4 91.7z"/>
      </svg>
      Pay
    </button>
  );
}

/* ─── Plan Card ─── */
function PlanCard({ plan, billing, onSelect, onApplePay }) {
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

        {/* Apple Pay button — only for paid plans */}
        {price && (
          <ApplePayButton onClick={() => onApplePay(plan)} plan={plan} />
        )}
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

/* ─── Apple Pay Checkout Modal ─── */
function ApplePayModal({ plan, billing, onClose }) {
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const [step, setStep] = useState("confirm"); // confirm | processing | success

  const handlePay = () => {
    setStep("processing");
    setTimeout(() => setStep("success"), 2200);
  };

  if (step === "success") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,5,12,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#0D1525", border: `1px solid ${P.border}`, borderRadius: 20, padding: "40px 36px", width: "min(440px, 92vw)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${P.accent}15`, border: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Check size={30} color={P.accent} strokeWidth={2} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, marginBottom: 8, letterSpacing: "-0.02em" }}>Pago exitoso</h3>
          <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.7, marginBottom: 24 }}>
            Tu plan <strong style={{ color: "#FFFFFF" }}>{plan.name}</strong> ha sido activado.<br />
            Recibirás un correo con el recibo y las instrucciones de acceso.
          </p>
          <button onClick={onClose} style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${P.accent}, #3BC9A8)`, color: "#04080F", fontSize: 14, fontWeight: 700, fontFamily: fontD, cursor: "pointer" }}>
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,5,12,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#0D1525", border: `1px solid ${P.border}`, borderRadius: 20, padding: "40px 36px", width: "min(440px, 92vw)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="20" height="24" viewBox="0 0 814 1000" fill="white" style={{ animation: "spin 1.5s linear infinite" }}>
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 135.4-317.7 269-317.7 70.6 0 129.5 42.4 174 42.4 42.5 0 109.2-44.8 188.5-44.8 30.4 0 111.4 2.6 170.3 82.6z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontD, marginBottom: 8 }}>Procesando pago con Apple Pay...</h3>
          <p style={{ fontSize: 12, color: P.txt3 }}>Verifica en tu dispositivo Apple</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,5,12,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0D1525", border: `1px solid ${P.border}`, borderRadius: 20, padding: "32px 32px", width: "min(420px, 92vw)" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Confirmación de pago</p>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em" }}>Plan {plan.name}</h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={P.txt2} />
          </button>
        </div>

        {/* Order summary */}
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
            <span style={{ fontSize: 13, fontWeight: 700, color: P.txt }}>Total hoy</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD }}>${billing === "yearly" ? price * 12 : price} USD</span>
          </div>
        </div>

        {/* Security note */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: "rgba(52,211,153,0.05)", border: `1px solid rgba(52,211,153,0.12)`, marginBottom: 18 }}>
          <Shield size={13} color={P.emerald} />
          <span style={{ fontSize: 11, color: "rgba(52,211,153,0.8)", lineHeight: 1.5 }}>Pago cifrado · Cancela en cualquier momento · Sin contratos</span>
        </div>

        {/* Apple Pay CTA */}
        <ApplePayButton onClick={handlePay} plan={plan} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <div style={{ flex: 1, height: 1, background: P.border }} />
          <span style={{ fontSize: 10, color: P.txt3 }}>o paga con tarjeta</span>
          <div style={{ flex: 1, height: 1, background: P.border }} />
        </div>

        {/* Card form (placeholder) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Número de tarjeta" style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: "rgba(255,255,255,0.04)", color: P.txt, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="MM / AA" style={{ padding: "11px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: "rgba(255,255,255,0.04)", color: P.txt, fontSize: 13, fontFamily: font, outline: "none" }} />
            <input placeholder="CVC" style={{ padding: "11px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: "rgba(255,255,255,0.04)", color: P.txt, fontSize: 13, fontFamily: font, outline: "none" }} />
          </div>
          <button onClick={handlePay} style={{
            width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
            background: `linear-gradient(135deg, ${P.accent}, #3BC9A8)`, color: "#04080F",
            fontSize: 13, fontWeight: 700, fontFamily: fontD, cursor: "pointer",
            boxShadow: `0 4px 20px ${P.accent}25`,
          }}>
            Pagar ${billing === "yearly" ? price * 12 : price} USD
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Pricing Screen ─── */
export default function PricingScreen({ onBack, embedded = false }) {
  const [billing, setBilling] = useState("yearly");
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  const handleApplePay = (plan) => {
    setCheckoutPlan(plan);
  };

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
              onApplePay={handleApplePay}
            />
          ))}
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 28, marginBottom: 64 }}>
          {[
            { icon: Shield, text: "Pago cifrado SSL" },
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

      {/* Apple Pay / checkout modal */}
      {checkoutPlan && (
        <ApplePayModal
          plan={checkoutPlan}
          billing={billing}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </div>
  );
}
