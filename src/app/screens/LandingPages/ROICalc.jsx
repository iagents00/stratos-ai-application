import { useState } from "react";
import { P, font, fontDisp } from "../../../design-system/tokens";

/* ─── ROI Calculator ─── */
const ROICalc = ({ prop }) => {
  const [inv, setInv] = useState(prop.priceFrom);
  const roiPct = prop.roiNum / 100;
  const appPct = 0.10; // 10% annual appreciation
  const yearlyRental = inv * roiPct;
  const projections = [1,3,5,10].map(y => ({
    y, rental: yearlyRental * y,
    appreciation: inv * Math.pow(1 + appPct, y) - inv,
    total: yearlyRental * y + (inv * Math.pow(1 + appPct, y) - inv),
    propValue: inv * Math.pow(1 + appPct, y),
  }));
  const fmt = n => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n/1000)}K`;

  return (
    <div style={{ padding: "40px", background: "#030508", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: prop.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>CALCULADORA DE RETORNO</p>
        <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 8 }}>Proyección de Tu Inversión</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Basado en ROI {prop.roi} + plusvalía histórica del 10% anual en la Riviera Maya</p>
        {/* Slider */}
        <div style={{ marginBottom: 28, padding: "20px 24px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Inversión inicial</span>
            <span style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{fmt(inv)} USD</span>
          </div>
          <input type="range" min={prop.priceFrom} max={prop.priceTo} value={inv} onChange={e=>setInv(parseInt(e.target.value))} step={10000}
            style={{ width: "100%", accentColor: prop.accent, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceFrom)}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceTo)}</span>
          </div>
        </div>
        {/* Projections */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {projections.map(pr=>(
            <div key={pr.y} style={{ padding: "18px 16px", borderRadius: 14, background: `${prop.accent}06`, border: `1px solid ${prop.accent}15` }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>{pr.y} {pr.y===1?"AÑO":"AÑOS"}</p>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Rentas acumuladas</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.rental)}</p>
              </div>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Plusvalía</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: P.emerald, fontFamily: fontDisp }}>+{fmt(pr.appreciation)}</p>
              </div>
              <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Retorno total</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{fmt(pr.total)}</p>
              </div>
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${prop.accent}12` }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>Valor propiedad</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.propValue)}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 14, textAlign: "center" }}>* Proyecciones basadas en datos históricos del mercado. No garantizadas. Sujeto a condiciones del mercado.</p>
      </div>
    </div>
  );
};

export default ROICalc;
