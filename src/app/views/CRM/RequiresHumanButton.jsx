/**
 * CRM/RequiresHumanButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Botón "Marcar como Requiere Humano" — handoff outbound del bot al humano.
 *
 * Flujo al click:
 *   1. POST a n8n webhook con action="marcar_requiere_humano" (fire-and-forget
 *      con feedback visual).
 *   2. Actualización optimista local del lead: hot=true, priority='urgente',
 *      tag='requiere-humano'. Se persiste vía onUpdate() del parent, que
 *      escribe en Supabase y refresca el cache de leadsData.
 *   3. Esto hace que el badge "🔥 REQUIERE HUMANO" aparezca instantáneamente
 *      sin necesidad de reload.
 *
 * Gating: solo visible para users con crm_only=true (iagents@stratos.ai).
 * Para otros usuarios el componente retorna null → el botón no aparece.
 *
 * Si el lead YA está marcado (lead.tag === 'requiere-humano') → muestra
 * estado "Marcado" disabled, no hace nada al click.
 *
 * Props:
 *   lead     — el lead actual (necesitamos phone + el id para actualizar).
 *   onUpdate — función del parent que persiste el cambio (saveLead etc.).
 *   T, isLight — design tokens.
 *   style    — overrides opcionales del estilo del botón.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useAuth } from "../../../hooks/useAuth";
import { markRequiresHuman, canTriggerIaActions } from "../../../lib/iagents-actions";

const FEEDBACK_RESET_MS = 3500;

export default function RequiresHumanButton({
  lead,
  onUpdate,
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

  if (!useIa) return null;            // solo iAgents ve este botón
  if (!lead) return null;

  const rawPhone   = String(lead.phone || lead.whatsapp_phone_e164 || "").trim();
  const phoneClean = rawPhone.replace(/[^0-9+]/g, "");
  const alreadyMarked = lead.tag === "requiere-humano";

  const handleClick = useCallback(async () => {
    if (state === "loading" || alreadyMarked) return;
    if (!phoneClean) {
      setState("error");
      setErrMsg("Lead sin teléfono — no se puede notificar.");
      return;
    }
    setState("loading");
    setErrMsg(null);

    // Optimistic UI: actualiza el lead local YA, antes de esperar al webhook.
    // Si el webhook falla, dejamos un toast de error pero NO revertimos el
    // estado local porque el operador puede querer mantener la marca.
    try {
      onUpdate?.({
        ...lead,
        hot: true,
        priority: "urgente",
        tag: "requiere-humano",
      });
    } catch (_) { /* parent maneja sus propios errores */ }

    const res = await markRequiresHuman(phoneClean);
    if (res.ok) {
      setState("success");
    } else {
      setState("error");
      setErrMsg(res.error || "El webhook no respondió OK");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => { setState("idle"); setErrMsg(null); }, FEEDBACK_RESET_MS);
  }, [phoneClean, state, alreadyMarked, lead, onUpdate]);

  // ───────── Colores semánticos rojos (urgente) ─────────
  const danger        = isLight ? "#DC2626" : "#F87171";
  const dangerStrong  = isLight ? "#B91C1C" : "#EF4444";
  const dangerBgIdle  = isLight ? "rgba(220,38,38,0.08)" : "rgba(248,113,113,0.10)";
  const dangerBdIdle  = isLight ? "rgba(220,38,38,0.42)" : "rgba(248,113,113,0.34)";
  const dangerBgHover = isLight ? "rgba(220,38,38,0.14)" : "rgba(248,113,113,0.18)";
  const dangerBgSolid = isLight ? "#DC2626" : "rgba(248,113,113,0.95)";

  // Estado "ya marcado" — neutralizamos visualmente, deja claro que se cumplió.
  if (alreadyMarked && state === "idle") {
    return (
      <button
        type="button"
        disabled
        title="Este lead ya está marcado como requiere humano. Cualquier asesor con el CRM abierto lo verá como urgente."
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "9px 14px", borderRadius: 10,
          background: dangerBgIdle, border: `1px solid ${dangerBdIdle}`,
          color: danger, fontSize: 12, fontWeight: 500, fontFamily: fontDisp,
          letterSpacing: "0.01em", cursor: "default",
          ...styleOverride,
        }}
      >
        <Check size={13} strokeWidth={2.6} />
        Marcado como Requiere Humano
      </button>
    );
  }

  // Estados visuales del flujo activo.
  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "9px 14px", borderRadius: 10,
    fontSize: 12, fontWeight: 500, fontFamily: fontDisp,
    letterSpacing: "0.01em", cursor: state === "loading" ? "wait" : "pointer",
    transition: "all 0.18s",
    ...styleOverride,
  };

  if (state === "loading") {
    return (
      <button type="button" disabled style={{ ...baseStyle, background: dangerBgIdle, border: `1px solid ${dangerBdIdle}`, color: danger }}>
        <Loader2 size={13} strokeWidth={2.4} style={{ animation: "rhSpin 0.9s linear infinite" }} />
        Notificando humanos…
        <style>{`@keyframes rhSpin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  }

  if (state === "success") {
    return (
      <button type="button" disabled style={{ ...baseStyle, background: dangerBgSolid, border: `1px solid ${dangerStrong}`, color: "#FFFFFF" }}>
        <Check size={13} strokeWidth={2.6} />
        Handoff enviado
      </button>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button" onClick={handleClick}
        title={errMsg ? `Error: ${errMsg}` : "Error al notificar"}
        style={{ ...baseStyle, background: dangerBgSolid, border: `1px solid ${dangerStrong}`, color: "#FFFFFF" }}
      >
        <AlertTriangle size={13} strokeWidth={2.4} />
        Error · reintentar
      </button>
    );
  }

  // idle
  return (
    <button
      type="button" onClick={handleClick}
      title="Marca el lead como requiere humano: el bot deja de responder y los asesores reciben la alerta."
      style={{ ...baseStyle, background: dangerBgIdle, border: `1px solid ${dangerBdIdle}`, color: danger }}
      onMouseEnter={(e) => { e.currentTarget.style.background = dangerBgHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = dangerBgIdle; }}
    >
      <AlertTriangle size={13} strokeWidth={2.4} />
      Marcar Requiere Humano
    </button>
  );
}
