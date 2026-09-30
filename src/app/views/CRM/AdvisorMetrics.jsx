/**
 * CRM/AdvisorMetrics.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tabla de indicadores por asesor (Comando Directivo dentro del CRM).
 * Solo se renderiza si el cliente activo tiene `crm.advisorMetricsTab=true`
 * y el usuario tiene rol admin/director/super_admin/ceo. Esa lógica vive en
 * el caller (CRM/index.jsx); este componente asume que ya se autorizó.
 *
 * Todas las métricas se calculan en memoria desde `leadsData`. Los conteos
 * filtrables por período usan `lead.created_at` (leads creados en la ventana).
 * "Seguim." muestra el total acumulado del counter `lead.seguimientos` para
 * los leads del período → es el único valor que NO se puede filtrar finamente
 * por fecha porque no hay historial event-level disponible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useMemo, useState } from "react";
import { P, LP, font, fontDisp } from "../../../design-system/tokens";
import { INACTIVE_ADVISOR_GROUP } from "./zoom-metrics";
import { aggregateCommandMetrics } from "./command-metrics.js";
import DateRangeControl from "./DateRangeControl";
import { createDefaultDateFilter, resolveDateRange } from "./date-range";

import { INDICATORS } from "./indicators.js";

export default function AdvisorMetrics({ leadsData = [], theme = "dark", dateFilter: sharedDateFilter = null }) {
  const isLight = theme === "light";
  const T = isLight ? LP : { ...P, txt3: P.txt2 };
  const [localDateFilter, setLocalDateFilter] = useState(createDefaultDateFilter);

  const dateFilter = sharedDateFilter || localDateFilter;
  const dateRange = useMemo(
    () => resolveDateRange(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo),
    [dateFilter],
  );
  const { rows, totals } = useMemo(() => aggregateCommandMetrics(leadsData, dateRange), [leadsData, dateRange]);

  const headerBg   = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)";
  const rowBorder  = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const cellPad    = "10px 12px";
  const accent     = T.accent;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header con título — el período se controla con un único DateRangeControl */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 400, fontFamily: fontDisp, color: T.txt, letterSpacing: "-0.02em" }}>
          Indicadores de Asesores
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: T.txt3, fontFamily: font }}>
          Leads por fecha de creación y dueño actual; Zooms por fecha y autor del primer hito registrado.
        </p>
      </div>
      {!sharedDateFilter && (
        <div style={{ marginBottom: 14 }}>
          <DateRangeControl
            T={T}
            isLight={isLight}
            value={localDateFilter}
            onChange={setLocalDateFilter}
            label="Período"
          />
        </div>
      )}

      {/* Tabla */}
      <div style={{
        borderRadius: 14,
        background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${rowBorder}`,
        overflow: "hidden",
        overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: headerBg }}>
              <th style={{ ...thStyle(T), textAlign: "left", paddingLeft: 16 }}>Asesor</th>
              {INDICATORS.map(ind => {
                const Icon = ind.icon;
                return (
                  <th key={ind.key} title={ind.title} style={thStyle(T)}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon size={11} color={T.txt3} strokeWidth={2} />
                      <span>{ind.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={INDICATORS.length + 1} style={{ padding: 28, textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 13 }}>
                  No hay asesores con leads en este período.
                </td>
              </tr>
            )}
            {rows.map(({ asesor, metrics, count }, i) => (
              <tr key={asesor} style={{ borderTop: i === 0 ? "none" : `1px solid ${rowBorder}` }}>
                <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 400, color: T.txt, fontSize: 13 }}>
                  {asesor}
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: T.txt3 }}>
                    {count} {count === 1 ? "lead" : "leads"}
                  </span>
                </td>
                {INDICATORS.map(ind => (
                  <td key={ind.key} style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 400, color: T.txt, fontSize: 14 }}>
                    {metrics[ind.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${rowBorder}`, background: headerBg }}>
                <td style={{ padding: cellPad, paddingLeft: 16, fontFamily: fontDisp, fontWeight: 500, color: T.txt2, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Total
                </td>
                {INDICATORS.map(ind => (
                  <td key={ind.key} style={{ padding: cellPad, textAlign: "center", fontFamily: fontDisp, fontWeight: 500, color: accent, fontSize: 14 }}>
                    {totals[ind.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p style={{ margin: "10px 4px 0", fontSize: 10.5, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
        Asignados / Gestionados / Seguimiento+ / Activos se filtran por fecha de creación del lead y reflejan su etapa actual. Las columnas <strong>Zooms Ag./Real.</strong> son históricas: cuentan cada lead que alguna vez pasó por esa fase (aunque hoy esté en otra etapa o haya sido reasignado), acreditadas a <strong>quién registró el hito</strong> y filtradas por la fecha real del evento. La fila <strong>{INACTIVE_ADVISOR_GROUP}</strong> agrupa ex-asesores y cuentas de prueba/sistema: sus leads y Zooms cuentan en el total para que cuadre con el pipeline del CRM.
      </p>

    </div>
  );
}

function thStyle(T) {
  return {
    padding: "11px 12px",
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: 400,
    color: T.txt2,
    fontFamily: fontDisp,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  };
}
