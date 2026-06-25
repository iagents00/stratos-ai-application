/**
 * CRM/RangeCalendar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendario de selección de RANGO por clicks. Se usa dentro de DateRangeControl
 * cuando el usuario elige "Personalizado": un clic fija la fecha inicial, el
 * siguiente clic fija la final (se ordenan solas). Mientras se está eligiendo el
 * segundo extremo, el hover muestra una vista previa del rango.
 *
 * No usa librerías externas (regla del proyecto): grilla mensual propia con
 * inicio en lunes, navegación de mes, banda de rango y extremos resaltados.
 * Las fechas futuras se deshabilitan (no tiene sentido medir métricas a futuro).
 * Comunica la selección con onPick(fromYMD, toYMD) en formato "YYYY-MM-DD".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fontDisp } from "../../../design-system/tokens";
import { dateInputValue, parseDateInput } from "./date-range";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const ymd = (d) => dateInputValue(d);

export default function RangeCalendar({ T, isLight, fromStr, toStr, onPick }) {
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

  const accent = T.accent;
  const surface = isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.025)";
  const border = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)";
  const bandBg = isLight ? `${accent}26` : `${accent}1E`;
  const hoverBg = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const onAccent = isLight ? "#06140F" : "#06080F";

  const navBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 9, cursor: "pointer",
    background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${border}`, color: T.txt2,
  };

  const canGoNext = viewMonth.getFullYear() < today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() < today.getMonth());

  return (
    <div style={{
      marginTop: 10, padding: 14, borderRadius: 16,
      background: surface, border: `1px solid ${border}`,
      boxShadow: isLight ? "0 10px 30px rgba(15,23,42,0.08)" : "0 16px 40px rgba(0,0,0,0.30)",
      maxWidth: 320,
    }}>
      {/* Navegación de mes */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} style={navBtn} aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: fontDisp, fontWeight: 700, color: T.txt, fontSize: 14, letterSpacing: "-0.01em" }}>
          {MONTHS_FULL[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => canGoNext && setViewMonth(addMonths(viewMonth, 1))}
          style={{ ...navBtn, opacity: canGoNext ? 1 : 0.35, cursor: canGoNext ? "pointer" : "not-allowed" }}
          aria-label="Mes siguiente"
          disabled={!canGoNext}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Encabezado de días de la semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
          let color = inMonth ? T.txt2 : T.txt3;
          let fontWeight = 600;
          let boxShadow = "none";

          if (inRange && !endpoint) { bg = bandBg; color = T.txt; }
          if (isToday && !endpoint) boxShadow = `inset 0 0 0 1.5px ${accent}66`;
          if (isHovered) bg = hoverBg;
          if (endpoint) { bg = accent; color = onAccent; fontWeight = 800; boxShadow = "none"; }
          if (isFuture) { color = isLight ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.16)"; }

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
                height: 36, border: "none", borderRadius: radius,
                background: bg, color, fontWeight, fontFamily: fontDisp, fontSize: 12.5,
                cursor: isFuture ? "not-allowed" : "pointer",
                fontVariantNumeric: "tabular-nums", boxShadow,
                transition: "background 0.12s, color 0.12s",
                opacity: inMonth || endpoint || inRange ? 1 : 0.55,
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <p style={{ margin: "12px 2px 0", fontSize: 10.5, color: T.txt3, fontFamily: fontDisp, lineHeight: 1.5, textAlign: "center" }}>
        {anchor
          ? "Elige la fecha final…"
          : "Haz clic en la fecha inicial y luego en la final."}
      </p>
    </div>
  );
}
