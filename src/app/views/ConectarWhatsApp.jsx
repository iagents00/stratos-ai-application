/**
 * views/ConectarWhatsApp.jsx — Conectar WhatsApp Business en tres clics
 *
 * Lanza el Embedded Signup de Meta: el cliente elige su número en un popup de
 * Meta y queda conectado, sin apps por asesor ni consola de desarrolladores.
 *
 * ⚠️ TODAVÍA NO ESTÁ MONTADO. El id de navegación `wa` ya lo usa la bandeja de
 * conversaciones (views/WhatsApp.jsx). Este panel está pensado para embeberse
 * DENTRO de esa bandeja, gated por `features.whatsappSignup`, el día que exista
 * la app de Meta real y se pueda probar el flujo completo.
 *
 * Contexto completo: ops/META-TECH-PROVIDER-briefing.md
 */
import { useState } from "react";
import { MessageCircle, Check, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { useClient } from "../../hooks/useClient";
import { useAuth } from "../../hooks/useAuth";
import {
  isSignupConfigured,
  launchWhatsAppSignup,
  finishWhatsAppSignup,
} from "../../lib/whatsapp-signup";

export default function ConectarWhatsApp({ T }) {
  const { config } = useClient();
  const { user } = useAuth();

  const [estado, setEstado] = useState("idle"); // idle | conectando | listo | error
  const [error, setError]   = useState(null);
  const [canal, setCanal]   = useState(null);

  const configurado = isSignupConfigured(config);
  const txt    = T?.txt    || "#E2E8F0";
  const dim    = T?.dim    || "rgba(226,232,240,0.55)";
  const accent = T?.accent || "#6EE7C2";
  const border = T?.border || "rgba(255,255,255,0.07)";
  const card   = T?.card   || "rgba(255,255,255,0.03)";

  async function conectar() {
    setEstado("conectando");
    setError(null);
    try {
      const resultado = await launchWhatsAppSignup({
        appId:    config.meta.appId,
        configId: config.meta.configId,
      });

      const alta = await finishWhatsAppSignup(config.meta.signupCallbackUrl, {
        ...resultado,
        orgSlug:        config.tenant?.clientId ?? null,
        organizationId: user?.organizationId ?? config.tenant?.organizationId ?? null,
        asesorName:     user?.name ?? null,
      });

      setCanal(alta);
      setEstado("listo");
    } catch (err) {
      if (err?.reason === "cancelled") { setEstado("idle"); return; }
      setError(err?.message || "No se pudo conectar el número");
      setEstado("error");
    }
  }

  const caja = {
    background: card,
    border: `1px solid ${border}`,
    borderRadius: 16,
    padding: 24,
    maxWidth: 560,
  };

  return (
    <div style={{ fontFamily: font, color: txt, padding: 4 }}>
      <h2 style={{ fontFamily: fontDisp, fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>
        Conectar WhatsApp
      </h2>
      <p style={{ color: dim, fontSize: 14, margin: "0 0 24px", maxWidth: 560 }}>
        Conecta tu número de WhatsApp Business para que los mensajes de tus
        clientes lleguen directo al CRM. El número sigue funcionando normal en
        tu celular.
      </p>

      <div style={caja}>
        {!configurado && (
          <div style={{ display: "flex", gap: 12 }}>
            <AlertTriangle size={18} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Todavía no disponible</div>
              <p style={{ color: dim, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Falta que Meta apruebe a Stratos como proveedor de tecnología.
                Mientras tanto los números se conectan a mano.
              </p>
            </div>
          </div>
        )}

        {configurado && estado !== "listo" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <MessageCircle size={20} style={{ color: accent }} />
              <div style={{ fontWeight: 600 }}>WhatsApp Business</div>
            </div>
            <ol style={{ color: dim, fontSize: 13, lineHeight: 1.9, margin: "0 0 20px", paddingLeft: 18 }}>
              <li>Se abre una ventana de Meta</li>
              <li>Eliges el número que quieres conectar</li>
              <li>Confirmas y listo</li>
            </ol>
            <button
              onClick={conectar}
              disabled={estado === "conectando"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: accent, color: "#04080F", border: "none",
                borderRadius: 10, padding: "11px 18px", fontFamily: font,
                fontSize: 14, fontWeight: 600,
                cursor: estado === "conectando" ? "wait" : "pointer",
                opacity: estado === "conectando" ? 0.6 : 1,
              }}
            >
              {estado === "conectando"
                ? <><Loader2 size={16} className="stratos-spin" /> Conectando…</>
                : <><ExternalLink size={16} /> Conectar mi WhatsApp</>}
            </button>
          </>
        )}

        {estado === "listo" && (
          <div style={{ display: "flex", gap: 12 }}>
            <Check size={18} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Número conectado</div>
              <p style={{ color: dim, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Los mensajes nuevos van a empezar a caer en el CRM.
                {canal?.phone_number_id && (
                  <> Identificador: <code style={{ fontSize: 12 }}>{canal.phone_number_id}</code></>
                )}
              </p>
            </div>
          </div>
        )}

        {estado === "error" && (
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <AlertTriangle size={18} style={{ color: "#F87171", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No se pudo conectar</div>
              <p style={{ color: dim, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
