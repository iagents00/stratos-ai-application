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
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { CalendarDays, SlidersHorizontal, Check } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { DATE_PRESETS, dateRangeLabel, resolveDateRange } from "./date-range";
import RangeCalendar from "./RangeCalendar";

export default function DateRangeControl({ T, isLight, value, onChange, label = "Período" }) {
  const range = resolveDateRange(value.preset, value.customFrom, value.customTo);
  const [calOpen, setCalOpen] = useState(value.preset === "custom");

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
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 999, padding: "8px 14px", cursor: "pointer",
    fontSize: 12, fontFamily: fontDisp, letterSpacing: "-0.005em",
    transition: "background 0.14s, color 0.14s, border-color 0.14s",
  };

  return (
    <div style={{
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

      {/* Presets + Personalizado */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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

      {/* Calendario de selección por clicks */}
      {calOpen && (
        <RangeCalendar
          T={T}
          isLight={isLight}
          fromStr={value.customFrom}
          toStr={value.customTo}
          onPick={(from, to) => onChange({ ...value, preset: "custom", customFrom: from, customTo: to })}
          onApply={() => setCalOpen(false)}
        />
      )}
    </div>
  );
}
