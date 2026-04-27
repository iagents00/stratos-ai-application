/**
 * ProFeatureGate — pantalla elegante para funciones que requieren
 * activación con el ejecutivo Stratos.
 *
 * Cuando una función premium (ej: agente IA, integración Telegram)
 * no está activa, en lugar de mostrar un error técnico mostramos
 * un mensaje claro con beneficios y un CTA.
 *
 * Filosofía:
 *   • "No es un error, es una función que aún no activas"
 *   • Beneficios concretos para el asesor (vender más, ahorrar tiempo)
 *   • CTA único: "Solicitar activación con mi ejecutivo"
 *   • Diseño coherente con el resto de Stratos AI
 */
import { Lock, Sparkles, Send, X } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";

export default function ProFeatureGate({
  open,
  onClose,
  title = "Función Premium",
  subtitle = "Disponible para clientes activos de Stratos AI",
  benefits = [],
  contactWhatsapp = "+52 998 000 0000",
  contactEmail = "ventas@stratoscapitalgroup.com",
}) {
  if (!open) return null;

  const message = encodeURIComponent(
    `Hola, soy asesor de Stratos AI y me interesa activar la función "${title}" para mi cuenta. ¿Me ayudas con los detalles?`
  );
  const waLink = `https://wa.me/${contactWhatsapp.replace(/\D/g, "")}?text=${message}`;
  const emailLink = `mailto:${contactEmail}?subject=${encodeURIComponent(`Activación · ${title}`)}&body=${message}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100050,
        background: "rgba(3,8,16,0.86)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "proFadeIn 0.22s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 96vw)",
          background: P.bg2,
          border: `1px solid ${P.accentB}`,
          borderRadius: 18,
          boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(110,231,194,0.08)",
          overflow: "hidden",
          fontFamily: font,
        }}
      >
        {/* Hero header con gradient */}
        <div style={{
          padding: "28px 26px 22px",
          background: `linear-gradient(135deg, ${P.accent}1F 0%, ${P.violet}18 100%)`,
          borderBottom: `1px solid ${P.border}`,
          position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 14, right: 14,
              width: 30, height: 30, borderRadius: 999,
              border: `1px solid ${P.border}`,
              background: P.glass, color: P.txt2, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>

          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${P.accent}, ${P.violet})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
            boxShadow: `0 8px 30px ${P.accent}55`,
          }}>
            <Sparkles size={24} color="#0B1220" strokeWidth={2.4} />
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 99,
            background: `${P.accent}22`,
            border: `1px solid ${P.accentB}`,
            marginBottom: 10,
          }}>
            <Lock size={10} color={P.accent} strokeWidth={2.4} />
            <span style={{ fontSize: 9.5, fontWeight: 800, color: P.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: fontDisp }}>
              Función Premium Stratos
            </span>
          </div>

          <h2 style={{
            margin: 0,
            fontSize: 22, fontWeight: 800, color: P.txt,
            fontFamily: fontDisp, letterSpacing: "-0.025em",
            lineHeight: 1.2,
          }}>{title}</h2>

          <p style={{
            margin: "6px 0 0", fontSize: 13, color: P.txt2,
            fontFamily: font, lineHeight: 1.5,
          }}>{subtitle}</p>
        </div>

        {/* Benefits */}
        {benefits.length > 0 && (
          <div style={{ padding: "20px 26px 8px" }}>
            <p style={{
              margin: "0 0 12px", fontSize: 10, fontWeight: 800,
              color: P.txt3, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: fontDisp,
            }}>
              ¿Qué obtienes al activarla?
            </p>
            {benefits.map((b, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                marginBottom: 10,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: `${P.accent}1A`,
                  border: `1px solid ${P.accentB}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <span style={{ fontSize: 10, color: P.accent, fontWeight: 800, fontFamily: fontDisp }}>{i + 1}</span>
                </div>
                <p style={{
                  margin: 0, fontSize: 12.5, color: P.txt,
                  fontFamily: font, lineHeight: 1.5, flex: 1,
                }}>{b}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{
          padding: "16px 26px 24px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "13px 18px", borderRadius: 11,
              background: `linear-gradient(135deg, #25D366, #128C7E)`,
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 8px 24px rgba(37,211,102,0.35)",
              transition: "transform 0.18s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2s-.8.9-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.4-1.4-.9-.8-1.5-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5-.2 0-.4 0-.6 0-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.2-.2-.5-.3z M12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.7c1.7.9 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0z M12 22c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.5 15.7 2 13.9 2 12c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10z"/>
            </svg>
            Solicitar activación por WhatsApp
          </a>

          <a
            href={emailLink}
            style={{
              padding: "11px 16px", borderRadius: 11,
              background: P.glass,
              color: P.txt,
              border: `1px solid ${P.borderH}`,
              textDecoration: "none",
              fontSize: 13, fontWeight: 600, fontFamily: font,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.glassH; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = P.glass; }}
          >
            <Send size={13} strokeWidth={2.2} />
            Solicitar por correo
          </a>

          <p style={{
            margin: "8px 0 0", fontSize: 10.5, color: P.txt3,
            fontFamily: font, textAlign: "center",
          }}>
            Tu ejecutivo Stratos te responderá hoy mismo con detalles y precio.
          </p>
        </div>
      </div>

      <style>{`@keyframes proFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
