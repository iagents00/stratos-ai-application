/**
 * CRM/DateRangeControl.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Control ÚNICO de período del Comando / CRM. Presets rápidos (Hoy, Semana, Mes,
 * 30 días, Histórico) + "Personalizado", que despliega un calendario de selección
 * por clicks (RangeCalendar). No hay selectores duplicados: el rango elegido aquí
 * decide TODO lo que se mide; la agrupación día/semana/mes es automática.
 *
 * value  = { preset, customFrom, customTo }   (customFrom/To en "YYYY-MM-DD")
 * onChange(nextValue)
 *
 * ⚠️ El calendario se monta en un PORTAL a document.body, NO como hijo de esta
 * tarjeta. Motivo (bug 2026-07-27): la tarjeta usa `backdrop-filter`, que crea un
 * contexto de apilamiento propio → el z-index del popover quedaba encerrado ahí
 * dentro y las tarjetas siguientes (Embudo, gráficas) se pintaban ENCIMA del
 * calendario. Ese mismo `backdrop-filter` además vuelve a la tarjeta el bloque
 * contenedor de los hijos `position: fixed`, así que el backdrop de "cerrar al
 * hacer clic afuera" solo cubría la tarjeta. Con el portal se arreglan las dos.
 * Si mueves esto de vuelta adentro del div raíz, vuelve el bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, SlidersHorizontal, Check } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { DATE_PRESETS, dateRangeLabel, resolveDateRange } from "./date-range";
import RangeCalendar from "./RangeCalendar";
import { useIsMobile } from "../../../hooks/useViewport";

// Ancho del popover: RangeCalendar es maxWidth 330 + 16px de padding a cada lado
// (no hay reset global de box-sizing), o sea 362 reales. 366 le deja aire.
const CAL_W = 366;
const CAL_MIN_H = 380;    // alto aproximado; debajo de esto conviene abrir hacia arriba
const Z_BACKDROP = 99920; // sobre el contenido de la página, debajo de los modales (100000+)
const Z_PANEL = 99921;

export default function DateRangeControl({ T, isLight, value, onChange, label = "Período" }) {
  const isMobile = useIsMobile();
  const range = resolveDateRange(value.preset, value.customFrom, value.customTo);
  const [calOpen, setCalOpen] = useState(value.preset === "custom");
  const rootRef = useRef(null);
  const [calPos, setCalPos] = useState(null);

  // Ancla el popover a la tarjeta y lo mantiene dentro de la pantalla.
  const placeCalendar = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CAL_W, vw - 16);
    const left = Math.max(8, Math.min(r.left + (isMobile ? 8 : 14), vw - width - 8));
    const spaceBelow = vh - r.bottom - 12;
    const spaceAbove = r.top - 12;
    // Abre hacia abajo salvo que no quepa y arriba haya más aire.
    const below = spaceBelow >= CAL_MIN_H || spaceBelow >= spaceAbove;
    setCalPos({
      left, width,
      top: below ? r.bottom + 8 : undefined,
      bottom: below ? undefined : vh - r.top + 8,
      maxHeight: Math.max(240, below ? spaceBelow : spaceAbove),
    });
  }, [isMobile]);

  // Reposiciona al abrir y ante scroll/resize; Escape cierra.
  useLayoutEffect(() => {
    if (!calOpen) return undefined;
    placeCalendar();
    const onScroll = () => placeCalendar();
    const onResize = () => placeCalendar();
    const onKeyDown = (e) => { if (e.key === "Escape") setCalOpen(false); };
    // capture: el scroll real ocurre en un contenedor interno, no en window.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [calOpen, placeCalendar]);

  const isCustom = value.preset === "custom";
  const presets = DATE_PRESETS.filter((p) => p.id !== "custom");

  const border = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)";
  const surface = isLight
    ? "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.80))"
    : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))";
  const chipBorder = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)";
  // Relleno verde profundo para los chips activos: el blanco resalta bien (sin
  // texto negro), tanto en claro como en oscuro.
  const FILL = "linear-gradient(135deg, #18B795 0%, #0A7C5D 100%)";

  const selectPreset = (id) => {
    onChange({ ...value, preset: id });
    setCalOpen(false);
  };

  const openCustom = () => {
    if (isCustom) {
      setCalOpen((o) => !o);
    } else {
      onChange({ ...value, preset: "custom" });
      setCalOpen(true);
    }
  };

  const chipBase = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: isMobile ? "100%" : "auto", minWidth: 0, minHeight: isMobile ? 44 : undefined,
    borderRadius: isMobile ? 12 : 999, padding: isMobile ? "0 12px" : "8px 14px", cursor: "pointer",
    fontSize: 12, fontFamily: fontDisp, letterSpacing: "-0.005em", whiteSpace: "nowrap",
    transition: "background 0.14s, color 0.14s, border-color 0.14s",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <div ref={rootRef} style={{
      position: "relative",
      display: "flex", flexDirection: "column", gap: 12,
      padding: 14, borderRadius: 18,
      background: surface, border: `1px solid ${border}`,
      boxShadow: isLight ? "0 10px 30px rgba(15,23,42,0.07)" : "0 16px 40px rgba(0,0,0,0.22)",
      backdropFilter: "blur(12px)",
    }}>
      {/* Encabezado: etiqueta + rango resuelto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          color: T.txt2, fontSize: 11, fontWeight: 500, fontFamily: fontDisp,
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>
          <span style={{ display: "inline-flex", padding: 6, borderRadius: 9, background: `${T.accent}1A` }}>
            <CalendarDays size={13} color={T.accent} strokeWidth={2.2} />
          </span>
          {label}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 11px", borderRadius: 999,
          background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${chipBorder}`,
          fontSize: 11.5, color: T.txt2, fontFamily: font, fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
        }}>
          {dateRangeLabel(range)}
        </span>
      </div>

      {/* Presets + Personalizado. En móvil: grid 3-up que llena el ancho (sin
          margen suelto a la derecha) + celdas ≥44px. En desktop: pills flex-wrap. */}
      <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : undefined, gap: isMobile ? 8 : 7, flexWrap: "wrap" }}>
        {presets.map((preset) => {
          const active = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset.id)}
              style={{
                ...chipBase,
                border: `1px solid ${active ? "rgba(110,231,194,0.32)" : chipBorder}`,
                background: active ? FILL : "transparent",
                color: active ? "#FFFFFF" : T.txt2,
                fontWeight: active ? 750 : 600,
                textShadow: active ? "0 1px 2px rgba(0,0,0,0.30)" : "none",
                boxShadow: active ? "0 6px 16px rgba(10,124,93,0.42)" : "none",
              }}
            >
              {active && <Check size={13} strokeWidth={3} />}
              {preset.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={openCustom}
          style={{
            ...chipBase,
            border: `1px solid ${isCustom ? T.accent : chipBorder}`,
            background: isCustom ? `${T.accent}1F` : "transparent",
            color: isCustom ? T.accent : T.txt2,
            fontWeight: isCustom ? 750 : 600,
          }}
        >
          <SlidersHorizontal size={13} strokeWidth={2.4} />
          Personalizado
        </button>
      </div>

      {/* Calendario de selección por clicks — FLOTA sobre TODO el contenido vía
          portal (ver nota del encabezado). Backdrop invisible a pantalla completa
          para cerrar al hacer clic afuera. */}
      {calOpen && calPos && createPortal(
        <>
          <div
            onClick={() => setCalOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: Z_BACKDROP }}
          />
          <div style={{
            position: "fixed",
            left: calPos.left, top: calPos.top, bottom: calPos.bottom,
            width: calPos.width, maxHeight: calPos.maxHeight, overflowY: "auto",
            zIndex: Z_PANEL, display: "flex", justifyContent: "center",
          }}>
            <RangeCalendar
              isLight={isLight}
              fromStr={value.customFrom}
              toStr={value.customTo}
              onPick={(from, to) => onChange({ ...value, preset: "custom", customFrom: from, customTo: to })}
              onApply={() => setCalOpen(false)}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
