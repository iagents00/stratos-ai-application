import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill } from "../SharedComponents";
import { Building2, CheckCircle2, Banknote, Percent, MapPin } from "lucide-react";

const ERP = ({ oc, T: _T }) => {
  const isLight = !!_T && _T !== P;
  const T = _T || P;
  const erpProjects = [
    { id: 1, n: "Gobernador 28", loc: "Playa del Carmen", st: "Construcción", c: P.blue, roi: "24%", u: 48, s: 36, v: "$4.2M", m: 31, f: "Q2 2026", t: "Residencial Premium" },
    { id: 2, n: "Monarca 28", loc: "Playa del Carmen", st: "Preventa", c: P.emerald, roi: "28%", u: 56, s: 42, v: "$5.8M", m: 29, f: "Q3 2026", t: "Condominios de Lujo" },
    { id: 3, n: "Portofino", loc: "Cancún", st: "Disponible", c: P.amber, roi: "26%", u: 32, s: 26, v: "$3.8M", m: 32, f: "Q1 2026", t: "Casas Residenciales" },
    { id: 4, n: "Casa Blanca", loc: "Playa del Carmen", st: "Reserva", c: P.violet, roi: "22%", u: 20, s: 14, v: "$2.2M", m: 27, f: "Q4 2025", t: "Villas Exclusivas" },
  ];

  const inventorySummary = {
    total: 156,
    sold: 118,
    available: 38,
    reserved: 28,
    value: "$72.4M",
    avgMargin: "26.5%",
    absorption: 75.6,
    pipeline: "$18.7M"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs Principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Unidades Totales" value={inventorySummary.total} sub="Portafolio" icon={Building2} color={T.blue} T={T} />
        <KPI label="Unidades Vendidas" value={inventorySummary.sold} sub={`${inventorySummary.absorption.toFixed(1)}%`} icon={CheckCircle2} color={T.emerald} T={T} />
        <KPI label="Valor Inventario" value={inventorySummary.value} sub="Valuación" icon={Banknote} T={T} />
        <KPI label="Margen Promedio" value={inventorySummary.avgMargin} sub="Rentabilidad" icon={Percent} color={T.violet} T={T} />
      </div>

      {/* Matriz de Proyectos */}
      <G np T={T}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Portafolio de Proyectos</p>
          <Pill color={T.blue} s isLight={isLight}>{erpProjects.length} Proyectos Activos</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr", gap: 12, padding: "14px 22px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Proyecto</span><span>Ubicación</span><span>Estado</span><span>Unidades</span><span>Venta Rápida</span><span>Margen</span><span>Cierre</span>
        </div>
        {erpProjects.map((proj) => (
          <div key={proj.id} onClick={() => oc(`Análisis detallado de ${proj.n}: Inventario ${proj.s}/${proj.u}, ROI ${proj.roi}, Absorción ${((proj.s / proj.u) * 100).toFixed(1)}%, Próximo: ${proj.f}`)} style={{
            display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.2fr 1fr 1fr",
            gap: 12, padding: "16px 22px", borderBottom: `1px solid ${T.border}`,
            cursor: "pointer", transition: "all 0.2s",
          }} onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 3 }}>{proj.n}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>{proj.t}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={12} color={T.txt3} />
              <span style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>{proj.loc}</span>
            </div>
            <Pill color={proj.c} s isLight={isLight}>{proj.st}</Pill>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>{proj.s}/{proj.u}</p>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>Vendidas</p>
            </div>
            <div>
              <div style={{ height: 5, background: T.glass, borderRadius: 3, marginBottom: 4, overflow: "hidden" }}>
                <div style={{ width: `${(proj.s / proj.u) * 100}%`, height: "100%", background: proj.c, borderRadius: 3 }} />
              </div>
              <p style={{ fontSize: 10, color: T.txt3, textAlign: "center" }}>{((proj.s / proj.u) * 100).toFixed(0)}%</p>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: proj.m > 28 ? T.emerald : proj.m > 25 ? T.blue : T.amber, fontFamily: fontDisp, textAlign: "center" }}>{proj.m}%</p>
            <p style={{ fontSize: 11, color: T.txt2, fontFamily: font, textAlign: "center" }}>{proj.f}</p>
          </div>
        ))}
      </G>

      {/* Análisis de Inventario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <G T={T}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 14, fontFamily: fontDisp }}>Distribución de Inventario</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Vendidas", val: inventorySummary.sold, c: T.emerald },
              { label: "Disponibles", val: inventorySummary.available, c: T.blue },
              { label: "Reservadas", val: inventorySummary.reserved, c: T.amber },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: T.txt2, fontFamily: font, minWidth: 80 }}>{s.label}</span>
                <div style={{ flex: 1, height: 8, background: T.glass, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(s.val / inventorySummary.total) * 100}%`, height: "100%", background: s.c }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.c, fontFamily: fontDisp, minWidth: 45, textAlign: "right" }}>{s.val}</span>
              </div>
            ))}
          </div>
        </G>

        <G T={T}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 14, fontFamily: fontDisp }}>Métricas Financieras</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Valor Generado</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.emerald, fontFamily: fontDisp }}>${(inventorySummary.sold * 0.6).toFixed(1)}M</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Pipeline Activo</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: fontDisp }}>{inventorySummary.pipeline}</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Tiempo Absorción</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.violet, fontFamily: fontDisp }}>6.8 meses</p>
            </div>
            <div style={{ padding: "12px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, marginBottom: 6 }}>Proyección Q4</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.amber, fontFamily: fontDisp }}>142 Sold</p>
            </div>
          </div>
        </G>
      </div>
    </div>
  );
};

export default ERP;
