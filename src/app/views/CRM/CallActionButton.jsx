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
import { Phone, Check, Loader2, AlertTriangle } from "lucide-react";
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
  // Cuando el lead ya tiene Zoom agendado, degradamos visualmente el botón
  // para evitar clicks accidentales que arruinen la cita pendiente. El click
  // SIGUE funcionando — solo cambia el aspecto y agregamos confirm() previo.
  warnZoom = false,
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

  // Confirm de seguridad si hay Zoom agendado y el user intenta llamar.
  const confirmIfWarn = () => {
    if (!warnZoom) return true;
    return window.confirm(
      "Este lead tiene un Zoom agendado. " +
      "¿Seguro que querés llamarlo ahora? La IA podría estar a punto de contactarlo."
    );
  };

  const handleIaCall = useCallback(async (e) => {
    e.preventDefault();
    if (state === "loading") return;
    if (!confirmIfWarn()) return;
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
  }, [phoneClean, state, warnZoom]);

  // ───────── Look base ─────────
  const isCompact = variant === "compact";

  // Cuando warnZoom=true, downgradeamos a un look "secondary" — outline en
  // lugar de gradient verde — para que no compita con la card de Zoom.
  const primaryBg = isLight
    ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
    : "rgba(255,255,255,0.92)";
  const primaryFg = isLight ? "#FFFFFF" : "#0A0F18";
  const secondaryBg = "transparent";
  const secondaryBd = isLight ? `1px solid ${T.accent}66` : `1px solid rgba(255,255,255,0.22)`;
  const secondaryFg = isLight ? (T.accentDark || T.accent) : T.accent;

  const baseStyle = {
    flex: 1, minWidth: isCompact ? 110 : 120,
    height: 40,
    padding: isCompact ? "0 12px" : "0 14px",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10,
    background: warnZoom ? secondaryBg : primaryBg,
    border: warnZoom ? secondaryBd : "none",
    color: warnZoom ? secondaryFg : primaryFg,
    fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
    letterSpacing: "0.01em", textDecoration: "none",
    whiteSpace: "nowrap",  // "Llamar ahora" siempre en 1 renglón (en Windows se partía)
    boxShadow: warnZoom ? "none" : (isLight
      ? `0 3px 10px ${T.accent}40, 0 1px 3px ${T.accent}26, inset 0 1px 0 rgba(255,255,255,0.35)`
      : "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)"),
    transition: "all 0.18s",
    cursor: "pointer",
    ...styleOverride,
  };

  // Tooltip + icono según contexto
  const warnTooltip = "Lead con Zoom agendado — confirma antes de llamar (puede chocar con la cita de la IA)";

  // ───────── User humano normal → <a tel:> con confirm opcional ─────────
  if (!useIa) {
    return (
      <a
        href={`tel:${phoneClean}`}
        title={warnZoom ? warnTooltip : undefined}
        onClick={(e) => {
          if (!confirmIfWarn()) e.preventDefault();
        }}
        style={baseStyle}
      >
        <Phone size={12} strokeWidth={2.4} />
        {label}
      </a>
    );
  }

  // ───────── iAgents → POST al webhook de n8n ─────────
  const stateStyle = (() => {
    if (state === "success") return { background: isLight ? "#0D9A76" : "rgba(110,231,194,0.96)", color: "#04130D", border: "none" };
    if (state === "error")   return { background: isLight ? "#DC2626" : "rgba(248,113,113,0.96)", color: "#3B0008", border: "none" };
    return {};
  })();

  return (
    <button
      type="button"
      onClick={handleIaCall}
      disabled={state === "loading"}
      title={state === "error" && errMsg ? `Error: ${errMsg}` : (warnZoom ? warnTooltip : "Disparar llamada vía Retell")}
      style={{ ...baseStyle, ...stateStyle, cursor: state === "loading" ? "wait" : "pointer", opacity: state === "loading" ? 0.92 : 1 }}
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
