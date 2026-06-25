import { CalendarDays } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { DATE_PRESETS, dateRangeLabel, resolveDateRange } from "./date-range";

export default function DateRangeControl({
  T,
  isLight,
  value,
  onChange,
  compact = false,
  label = "Período",
}) {
  const range = resolveDateRange(value.preset, value.customFrom, value.customTo);
  const border = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)";
  const surface = isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.035)";

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      padding: compact ? 10 : 12, borderRadius: 16,
      background: surface, border: `1px solid ${border}`,
      boxShadow: isLight ? "0 8px 28px rgba(15,23,42,0.06)" : "0 12px 34px rgba(0,0,0,0.20)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          color: T.txt2, fontSize: 11, fontWeight: 700, fontFamily: fontDisp,
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>
          <CalendarDays size={13} color={T.accent} /> {label}
        </span>
        <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>
          {dateRangeLabel(range)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {DATE_PRESETS.map((preset) => {
          const active = value.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...value, preset: preset.id })}
              style={{
                border: `1px solid ${active ? `${T.accent}66` : border}`,
                borderRadius: 999, padding: compact ? "6px 10px" : "7px 12px",
                background: active ? `${T.accent}1F` : "transparent",
                color: active ? T.accent : T.txt2,
                fontSize: 11.5, fontWeight: active ? 750 : 600,
                fontFamily: fontDisp, cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {value.preset === "custom" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(140px, 1fr))", gap: 8 }}>
          {[
            ["Desde", "customFrom"],
            ["Hasta", "customTo"],
          ].map(([fieldLabel, key]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 5, fontFamily: font }}>
              <span style={{ fontSize: 10, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {fieldLabel}
              </span>
              <input
                type="date"
                value={value[key]}
                onChange={(event) => onChange({ ...value, [key]: event.target.value })}
                style={{
                  width: "100%", borderRadius: 10, padding: "8px 10px",
                  border: `1px solid ${border}`, background: surface,
                  color: T.txt, fontFamily: font, fontSize: 12,
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
