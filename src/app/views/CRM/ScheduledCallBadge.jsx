/**
 * CRM/ScheduledCallBadge.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pill que muestra cuándo está agendada la próxima llamada Retell.
 * Lee directo de un row de scheduled_calls (`{ id, scheduled_at, ... }`).
 *
 * Tres variantes visuales:
 *   - "card"   → versión compacta para priority cards y kanban (1 línea).
 *   - "drawer" → versión grande para el header del LeadPanel.
 *   - "inline" → versión mínima (solo emoji + tiempo) para listas chicas.
 *
 * Formato del texto según proximidad:
 *   - Si scheduled_at <= now (atrasada / ya lista para CRON):
 *       "📅 Llamada lista para CRON"  (color: ámbar, "urge")
 *   - Si scheduled_at en los próximos 60 min:
 *       "📅 En 12 min"                (color: azul, normal)
 *   - Si scheduled_at hoy (más de 1h):
 *       "📅 Hoy 16:30"
 *   - Si scheduled_at otro día:
 *       "📅 Mar 19 · 09:00"
 *
 * El badge se RE-RENDERIZA con un useState/setInterval propio cada minuto
 * para que "en X min" sea preciso. Si renderás muchas (lista grande), pasale
 * `staticTime={true}` para evitar el timer.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";

const MS_MIN = 60_000;

function formatRelative(scheduledAt) {
  if (!scheduledAt) return null;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  const diffMs = t - now;
  const overdue = diffMs <= 0;
  const minsAbs = Math.abs(Math.round(diffMs / MS_MIN));

  if (overdue) {
    return { label: "Llamada lista para CRON", urgency: "overdue" };
  }
  if (minsAbs <= 60) {
    return { label: `En ${minsAbs} min`, urgency: "soon" };
  }
  // Mismo día calendario
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return {
      label: `Hoy ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
      urgency: "today",
    };
  }
  return {
    label: `${d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit" })} · ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}`,
    urgency: "later",
  };
}

export default function ScheduledCallBadge({
  scheduledAt,
  variant = "card",
  T = P,
  isLight = false,
  staticTime = false,
}) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (staticTime) return;
    const id = setInterval(() => forceTick((n) => n + 1), MS_MIN);
    return () => clearInterval(id);
  }, [staticTime]);

  const fmt = useMemo(() => formatRelative(scheduledAt), [scheduledAt]);
  if (!fmt) return null;

  // Paleta por urgencia
  const palette = (() => {
    if (fmt.urgency === "overdue") return {
      bg: isLight ? "rgba(217,119,6,0.10)"  : "rgba(251,191,36,0.10)",
      bd: isLight ? "rgba(217,119,6,0.40)"  : "rgba(251,191,36,0.30)",
      fg: isLight ? "#B45309" : "#FBBF24",
    };
    if (fmt.urgency === "soon") return {
      bg: isLight ? "rgba(37,99,235,0.10)"  : "rgba(96,165,250,0.10)",
      bd: isLight ? "rgba(37,99,235,0.34)"  : "rgba(96,165,250,0.28)",
      fg: isLight ? "#1D4ED8" : "#60A5FA",
    };
    return {  // today / later
      bg: isLight ? "rgba(13,154,118,0.08)" : "rgba(110,231,194,0.08)",
      bd: isLight ? "rgba(13,154,118,0.30)" : "rgba(110,231,194,0.22)",
      fg: isLight ? "#0D9A76" : "#6EE7C2",
    };
  })();

  if (variant === "inline") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10.5, fontWeight: 500, color: palette.fg,
        fontFamily: fontDisp, letterSpacing: "0.01em",
      }} title={`Llamada IA programada: ${fmt.label}`}>
        <CalendarClock size={11} strokeWidth={2.4} />
        {fmt.label}
      </span>
    );
  }

  if (variant === "drawer") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 99,
        background: palette.bg, border: `1px solid ${palette.bd}`,
        color: palette.fg, fontSize: 11, fontWeight: 500,
        fontFamily: fontDisp, letterSpacing: "0.02em",
        textTransform: "uppercase",
      }} title="Esta llamada la dispara el CRON de n8n cuando vence el horario">
        <CalendarClock size={12} strokeWidth={2.4} />
        Llamada IA · {fmt.label}
      </span>
    );
  }

  // variant === "card" (default — compacto para priority cards)
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 99,
      background: palette.bg, border: `1px solid ${palette.bd}`,
      color: palette.fg, fontSize: 10, fontWeight: 500,
      fontFamily: fontDisp, letterSpacing: "0.02em",
    }} title={`Llamada IA programada: ${fmt.label}`}>
      <CalendarClock size={10} strokeWidth={2.4} />
      {fmt.label}
    </span>
  );
}
