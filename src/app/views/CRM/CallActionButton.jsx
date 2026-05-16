/**
 * CRM/CallActionButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Botón "Llamar" del lead drawer con dos comportamientos según el usuario:
 *
 *   · Usuario común (Ivan, Alex, cualquier asesor de Duke):
 *       → <a href="tel:...">  abre el dialer del SO (comportamiento histórico).
 *
 *   · Usuario IA (iagents@stratos.ai, identificado por user.crmOnly=true):
 *       → POST a n8n /webhook/api-interna-stratos con action="llamar_ia".
 *       Estado de carga ("Conectando…") + confirmación inline ("✓ Llamada
 *       enviada a Retell") por 3s tras éxito. Si falla, muestra el error
 *       sobre el botón.
 *
 * Mismo look visual en ambos casos (gradient mint) para no romper el design.
 *
 * Props:
 *   phone     — número del lead (formato libre, se normaliza a E.164 antes de POST).
 *   label     — texto del botón. Default "Llamar".
 *   variant   — "primary" (default, gradient verde) | "compact" (más chico).
 *   T, isLight, style — design tokens / overrides.
 *
 * El componente lee user con useAuth() — no necesita prop drilling.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, Check, Loader2 } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useAuth } from "../../../hooks/useAuth";
import { triggerIaCall, canTriggerIaActions } from "../../../lib/iagents-actions";

const RESULT_DISPLAY_MS = 3000;

export default function CallActionButton({
  phone,
  label = "Llamar",
  variant = "primary",
  T = P,
  isLight = false,
  style: styleOverride,
}) {
  const { user } = useAuth();
  const useIa = canTriggerIaActions(user);
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState(null);
  const resetTimer = useRef(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  // Normalización de teléfono igual que el botón tel: histórico.
  const rawPhone   = String(phone || "").trim();
  const phoneClean = rawPhone.replace(/[^0-9+]/g, "");
  if (!phoneClean) return null;

  const handleIaCall = useCallback(async (e) => {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setErrMsg(null);
    const res = await triggerIaCall(phoneClean);
    if (res.ok) {
      setState("success");
    } else {
      setState("error");
      setErrMsg(res.error || "Error desconocido");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setState("idle"); setErrMsg(null);
    }, RESULT_DISPLAY_MS);
  }, [phoneClean, state]);

  // ───────── Look base ─────────
  const isCompact = variant === "compact";
  const baseStyle = {
    flex: 1, minWidth: isCompact ? 110 : 120,
    ...(isCompact ? { height: 40, padding: "0 12px" } : { padding: "9px 12px" }),
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10,
    background: isLight
      ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
      : "rgba(255,255,255,0.92)",
    border: "none",
    color: isLight ? "#FFFFFF" : "#0A0F18",
    fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
    letterSpacing: "0.01em", textDecoration: "none",
    boxShadow: isLight
      ? `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26, inset 0 1px 0 rgba(255,255,255,0.35)`
      : "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
    transition: "all 0.18s",
    cursor: "pointer",
    ...styleOverride,
  };

  // ───────── User humano normal → <a tel:> de toda la vida ─────────
  if (!useIa) {
    return (
      <a
        href={`tel:${phoneClean}`}
        style={baseStyle}
        onMouseEnter={(e) => {
          if (isLight) {
            e.currentTarget.style.boxShadow = `0 5px 16px ${T.accent}55, 0 2px 5px ${T.accent}30`;
            e.currentTarget.style.transform = "translateY(-1px)";
          } else {
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          if (isLight) {
            e.currentTarget.style.boxShadow = `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26`;
          } else {
            e.currentTarget.style.background = "rgba(255,255,255,0.92)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)";
          }
        }}
      >
        <Phone size={12} strokeWidth={2.4} /> {label}
      </a>
    );
  }

  // ───────── iAgents → POST al webhook de n8n ─────────
  const stateStyle = (() => {
    if (state === "success") return { background: isLight ? "#0D9A76" : "rgba(110,231,194,0.96)", color: "#04130D" };
    if (state === "error")   return { background: isLight ? "#DC2626" : "rgba(248,113,113,0.96)", color: "#3B0008" };
    return {};
  })();

  return (
    <button
      type="button"
      onClick={handleIaCall}
      disabled={state === "loading"}
      title={state === "error" && errMsg ? `Error: ${errMsg}` : "Disparar llamada vía Retell"}
      style={{ ...baseStyle, ...stateStyle, cursor: state === "loading" ? "wait" : "pointer", opacity: state === "loading" ? 0.92 : 1 }}
      onMouseEnter={(e) => {
        if (state !== "idle") return;
        if (isLight) {
          e.currentTarget.style.boxShadow = `0 5px 16px ${T.accent}55, 0 2px 5px ${T.accent}30`;
          e.currentTarget.style.transform = "translateY(-1px)";
        } else {
          e.currentTarget.style.background = "#FFFFFF";
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.45)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (state !== "idle") return;
        e.currentTarget.style.transform = "none";
        if (isLight) {
          e.currentTarget.style.boxShadow = `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26`;
        } else {
          e.currentTarget.style.background = "rgba(255,255,255,0.92)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)";
        }
      }}
    >
      {state === "loading" && (
        <>
          <Loader2 size={12} strokeWidth={2.4} style={{ animation: "iaCallSpin 0.9s linear infinite" }} />
          Conectando…
        </>
      )}
      {state === "success" && (
        <>
          <Check size={12} strokeWidth={2.8} />
          Llamada enviada a Retell
        </>
      )}
      {state === "error" && (
        <>
          <Phone size={12} strokeWidth={2.4} />
          Error · reintentar
        </>
      )}
      {state === "idle" && (
        <>
          <Phone size={12} strokeWidth={2.4} />
          {label}
        </>
      )}
      <style>{`@keyframes iaCallSpin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
