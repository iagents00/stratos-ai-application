/**
 * IACRMPlanes.jsx — La pestaña "Planes" del módulo iAgents
 * ─────────────────────────────────────────────────────────
 * ⚠️ POR QUÉ VIVE EN SU PROPIO ARCHIVO Y NO DENTRO DE IACRM.jsx
 *
 * Muestra precios de suscripción, un botón "Contratar" y un plan descrito como
 * "Para asesores individuales". Dentro del binario de la app eso es superficie
 * de compra, y trae dos problemas a la vez con Apple:
 *
 *   1. Guideline 3.1.3: para vender bienes digitales dentro de la app, Apple
 *      exige su propio sistema de pagos y su comisión.
 *   2. El argumento que sostiene a esta app es la 3.1.3(c) Enterprise Services:
 *      se le vende a EMPRESAS, y el empleado solo entra a usar lo que su
 *      empresa contrató. La palabra "individuales" rompe justo ese argumento.
 *
 * Esconder la pestaña no alcanzaba: el texto seguía viajando dentro del paquete
 * que abre el revisor. Por eso está en un archivo aparte listado en SOLO_WEB
 * (vite.config.js), igual que se hizo con PricingScreen: así Rollup nunca lo
 * lee y no genera su chunk. Es el mismo criterio que dejó escrito el equipo:
 * "una pasarela falsa es peor que no tener ninguna".
 *
 * Los planes se contratan por la web.
 */
import { CheckCircle2, Atom } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";

const WA = "#25D366";

const PRICING = [
  { name: "Starter",  price: 49,  desc: "Para asesores individuales",          colorKey: "accent",  popular: false, agents: 2, messages: 500,  features: ["2 agentes activos","500 mensajes/mes","Notificaciones Telegram","Dashboard de conversaciones"] },
  { name: "Pro",      price: 129, desc: "Para equipos de hasta 5 asesores",    colorKey: "blue",    popular: true,  agents: 4, messages: 2000, features: ["4 agentes activos (todos)","2,000 mensajes/mes","Briefings Zoom (Opus)","CRM integrado en tiempo real","Reportes semanales automáticos"] },
  { name: "Business", price: 299, desc: "Para equipos grandes y franquicias",  colorKey: "cyan",    popular: false, agents: 4, messages: 8000, features: ["Mensajes ilimitados","Múltiples números WhatsApp","Agentes personalizados","Integración API","Account manager dedicado"] },
];

const IACRMPlanes = ({ T, isLight, oc }) => {
  const col = (key) => T[key] || T.accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 14 }}>
        {PRICING.map(plan => {
          const pc = col(plan.colorKey);
          const pcSafe = isLight ? `color-mix(in srgb, ${pc} 58%, #0B1220 42%)` : pc;
          return (
            <div key={plan.name} style={{
              borderRadius: 20,
              background: plan.popular
                ? (isLight ? `linear-gradient(160deg, ${pc}10 0%, rgba(255,255,255,0.95) 100%)` : `linear-gradient(160deg, ${pc}10 0%, rgba(6,10,17,0.99) 100%)`)
                : (isLight ? "rgba(255,255,255,0.82)" : "rgba(6,10,17,0.98)"),
              border: `1px solid ${plan.popular ? pc + (isLight ? "44" : "50") : T.border}`,
              padding: "22px", position: "relative",
              boxShadow: plan.popular
                ? (isLight ? `0 4px 24px ${pc}18, 0 1px 4px rgba(15,23,42,0.06)` : `0 0 36px ${pc}12`)
                : (isLight ? T.shadow1 : "none"),
              backdropFilter: isLight ? "blur(40px)" : "none",
            }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", fontSize: 10.5, fontWeight: 500, color: "#FFFFFF", background: isLight ? `color-mix(in srgb, ${pc} 80%, #000 20%)` : pc, padding: "3px 14px", borderRadius: "0 0 9px 9px", letterSpacing: "0.08em", fontFamily: fontDisp, whiteSpace: "nowrap" }}>MÁS POPULAR</div>
              )}
              <p style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 500, color: plan.popular ? pcSafe : T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{plan.name}</p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: T.txt3, fontFamily: font }}>{plan.desc}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 7 }}>
                <span style={{ fontSize: 36, fontWeight: 500, color: plan.popular ? pcSafe : T.txt, fontFamily: fontDisp, lineHeight: 1, letterSpacing: "-0.04em" }}>${plan.price}</span>
                <span style={{ fontSize: 12.5, color: T.txt3, fontFamily: font }}>/mes</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: isLight ? "#15803D" : WA, background: isLight ? "rgba(21,128,61,0.08)" : `${WA}10`, border: `1px solid ${isLight ? "rgba(21,128,61,0.20)" : WA + "25"}`, padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.messages.toLocaleString()} msgs</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: T.txt2, background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 6, fontFamily: fontDisp }}>{plan.agents} agentes</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <CheckCircle2 size={13} color={plan.popular ? pcSafe : T.accent} strokeWidth={2.5} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: plan.popular ? T.txt : T.txt2, fontFamily: font, lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => oc(`Iniciar proceso de contratación del plan ${plan.name} de agentes IA por $${plan.price}/mes`)}
                style={{
                  width: "100%", padding: "11px", borderRadius: 11,
                  background: plan.popular
                    ? (isLight ? T.accentG : `linear-gradient(135deg, ${pc}30, ${pc}14)`)
                    : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"),
                  border: `1px solid ${plan.popular ? pc + (isLight ? "44" : "55") : T.border}`,
                  color: plan.popular ? (isLight ? "#FFFFFF" : pcSafe) : T.txt2,
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: fontDisp, letterSpacing: "0.015em", transition: "all 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = plan.popular ? (isLight ? T.accentDark : `linear-gradient(135deg, ${pc}44, ${pc}22)`) : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)"); }}
                onMouseLeave={e => { e.currentTarget.style.background = plan.popular ? (isLight ? T.accentG : `linear-gradient(135deg, ${pc}30, ${pc}14)`) : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)"); }}
              >
                Contratar {plan.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Nota Anthropic */}
      <G T={T}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: isLight ? `${T.accent}14` : `${T.accent}12`, border: `1px solid ${T.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Atom size={18} color={T.accent} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.015em" }}>Powered by Claude · Anthropic</p>
            <p style={{ margin: 0, fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.55 }}>
              Cada agente usa los modelos más avanzados de Anthropic — Haiku para velocidad, Sonnet para razonamiento, Opus para briefings complejos. Tu equipo, amplificado.
            </p>
          </div>
        </div>
      </G>
    </div>
  );
};

export default IACRMPlanes;
