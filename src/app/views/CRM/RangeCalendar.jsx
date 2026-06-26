/**
 * CRM/RangeCalendar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendario de selección de RANGO por clicks. Se usa dentro de DateRangeControl
 * cuando el usuario elige "Personalizado": un clic fija la fecha inicial, el
 * siguiente clic fija la final (se ordenan solas). Mientras se está eligiendo el
 * segundo extremo, el hover muestra una vista previa del rango.
 *
 * Diseño: panel OSCURO degradado (independiente del tema de la página) para que
 * resalte como un popover premium. Los días seleccionados y el botón "Ver
 * métricas" usan un verde profundo con texto BLANCO (resalta bien, sin negros).
 * No usa librerías externas: grilla mensual propia con inicio en lunes. Las
 * fechas futuras se deshabilitan. Comunica con onPick(fromYMD, toYMD).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fontDisp } from "../../../design-system/tokens";
import { dateInputValue, parseDateInput, dateRangeLabel, resolveDateRange } from "./date-range";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Paleta fija del popover oscuro (no depende del tema de la página).
const MINT      = "#6EE7C2";                                              // acento (anillo, banda, glow)
const FILL      = "linear-gradient(135deg, #18B795 0%, #0A7C5D 100%)";    // relleno verde profundo
const FILL_SH   = "0 6px 16px rgba(10,124,93,0.55)";                       // sombra del relleno
const TXT_MONTH = "#F1F5F9";
const TXT_DAY   = "#CBD5E1";
const TXT_OUT   = "#46505E";
const TXT_FUT   = "#333C49";
const TXT_MUTE  = "#5C6B7D";
const BAND_BG   = "rgba(110,231,194,0.16)";
const HOVER_BG  = "rgba(255,255,255,0.07)";

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const ymd = (d) => dateInputValue(d);

export default function RangeCalendar({ fromStr, toStr, onPick, onApply }) {
  const today = startOfDay(new Date());
  const fromD = parseDateInput(fromStr);
  const toD = parseDateInput(toStr);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = fromD || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [anchor, setAnchor] = useState(null); // primer extremo, a la espera del segundo
  const [hover, setHover] = useState(null);   // celda bajo el cursor

  // Rango a resaltar: el confirmado (from/to) o la vista previa anchor→hover.
  let rangeStart = fromD;
  let rangeEnd = toD;
  if (anchor) {
    const h = hover || anchor;
    rangeStart = h < anchor ? h : anchor;
    rangeEnd = h < anchor ? anchor : h;
  }

  const handleClick = (day) => {
    if (!anchor) {
      setAnchor(day);
      setHover(day);
      onPick(ymd(day), ymd(day));
    } else {
      const s = day < anchor ? day : anchor;
      const e = day < anchor ? anchor : day;
      onPick(ymd(s), ymd(e));
      setAnchor(null);
      setHover(null);
    }
  };

  // Grilla de 42 celdas (6 semanas) con inicio en lunes.
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const dow = first.getDay();                 // 0=dom..6=sáb
  const offset = dow === 0 ? 6 : dow - 1;     // lunes como primer día
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const navBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 10, cursor: "pointer",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)", color: "#AEBAC8",
  };

  const canGoNext = viewMonth.getFullYear() < today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() < today.getMonth());

  return (
    <div style={{
      marginTop: 10, padding: 16, borderRadius: 18,
      background: "linear-gradient(165deg, #101D2B 0%, #070E18 100%)",
      border: "1px solid rgba(110,231,194,0.20)",
      boxShadow: "0 22px 55px rgba(0,0,0,0.55), 0 0 0 1px rgba(110,231,194,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
      maxWidth: 330,
    }}>
      {/* Navegación de mes */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} style={navBtn} aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: fontDisp, fontWeight: 700, color: TXT_MONTH, fontSize: 14.5, letterSpacing: "-0.01em" }}>
          {MONTHS_FULL[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => canGoNext && setViewMonth(addMonths(viewMonth, 1))}
          style={{ ...navBtn, opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? "pointer" : "not-allowed" }}
          aria-label="Mes siguiente"
          disabled={!canGoNext}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Encabezado de días de la semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 7 }}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: TXT_MUTE, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {w}
          </span>
        ))}
      </div>

      {/* Grilla de días */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}
        onMouseLeave={() => { if (!anchor) setHover(null); }}
      >
        {days.map((day, i) => {
          const inMonth = day.getMonth() === viewMonth.getMonth();
          const isFuture = day > today;
          const ds = ymd(day);
          const isStart = rangeStart && ds === ymd(rangeStart);
          const isEnd = rangeEnd && ds === ymd(rangeEnd);
          const endpoint = isStart || isEnd;
          const inRange = rangeStart && rangeEnd && day >= startOfDay(rangeStart) && day <= startOfDay(rangeEnd);
          const isToday = ds === ymd(today);
          const isHovered = hover && ds === ymd(hover) && !endpoint && !inRange;

          let bg = "transparent";
          let color = inMonth ? TXT_DAY : TXT_OUT;
          let fontWeight = 600;
          let boxShadow = "none";
          let textShadow = "none";

          if (inRange && !endpoint) { bg = BAND_BG; color = "#EAF2F7"; }
          if (isToday && !endpoint) boxShadow = `inset 0 0 0 1.5px ${MINT}88`;
          if (isHovered) bg = HOVER_BG;
          if (endpoint) { bg = FILL; color = "#FFFFFF"; fontWeight = 800; boxShadow = FILL_SH; textShadow = "0 1px 2px rgba(0,0,0,0.35)"; }
          if (isFuture) { color = TXT_FUT; }

          // Bordes redondeados de la banda: redondea solo los extremos.
          let radius = 10;
          if (inRange && !endpoint) radius = 6;
          if (isStart && !isEnd) radius = "10px 6px 6px 10px";
          if (isEnd && !isStart) radius = "6px 10px 10px 6px";

          return (
            <button
              key={i}
              type="button"
              disabled={isFuture}
              onClick={() => !isFuture && handleClick(day)}
              onMouseEnter={() => !isFuture && setHover(day)}
              style={{
                height: 38, border: "none", borderRadius: radius,
                background: bg, color, fontWeight, fontFamily: fontDisp, fontSize: 13,
                cursor: isFuture ? "not-allowed" : "pointer",
                fontVariantNumeric: "tabular-nums", boxShadow, textShadow,
                transition: "background 0.12s, color 0.12s",
                opacity: inMonth || endpoint || inRange ? 1 : 0.6,
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <p style={{ margin: "14px 2px 9px", fontSize: 10.5, color: TXT_MUTE, fontFamily: fontDisp, lineHeight: 1.5, textAlign: "center" }}>
        {anchor
          ? "Elige la fecha final…"
          : "Haz clic en la fecha inicial y luego en la final."}
      </p>

      {/* Botón de aplicar/buscar el rango elegido */}
      {onApply && (() => {
        const ready = !anchor && !!fromStr && !!toStr;
        const label = ready ? dateRangeLabel(resolveDateRange("custom", fromStr, toStr)) : "Selecciona el rango";
        return (
          <button
            type="button"
            onClick={() => ready && onApply()}
            disabled={!ready}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", marginTop: 2, padding: "12px 14px", borderRadius: 13,
              border: ready ? "1px solid rgba(110,231,194,0.30)" : "1px solid rgba(255,255,255,0.06)",
              cursor: ready ? "pointer" : "not-allowed",
              background: ready ? FILL : "rgba(255,255,255,0.05)",
              color: ready ? "#FFFFFF" : TXT_MUTE,
              fontFamily: fontDisp, fontWeight: 750, fontSize: 13,
              textShadow: ready ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
              boxShadow: ready ? "0 8px 22px rgba(16,160,120,0.45)" : "none",
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
            <Search size={15} strokeWidth={2.6} />
            {ready ? `Ver métricas · ${label}` : label}
          </button>
        );
      })()}
    </div>
  );
}
