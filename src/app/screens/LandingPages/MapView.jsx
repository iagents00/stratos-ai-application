import { P, font, fontDisp } from "../../../design-system/tokens";

/* ─── Map/Location visual ─── */
const RivieraMayaMap = ({ properties }) => {
  // Positions on simplified coastline map
  const locations = {
    "Cancún": { x: 82, y: 8 },
    "Puerto Morelos": { x: 76, y: 28 },
    "Playa del Carmen": { x: 68, y: 50 },
    "Puerto Aventuras": { x: 62, y: 62 },
    "Tulum": { x: 52, y: 78 },
    "Bacalar": { x: 38, y: 92 },
    "Akumal": { x: 58, y: 68 },
    "Holbox": { x: 30, y: 5 },
  };
  const propLocations = [...new Set(properties.map(p => p.location))];

  return (
    <div style={{ padding: "60px 40px", background: "#020406" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 40, alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>UBICACIÓN</p>
          <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 16 }}>Riviera Maya, México</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 20 }}>
            La Riviera Maya se extiende a lo largo de 120 km de costa caribeña. Con el nuevo Aeropuerto Internacional de Tulum y el Tren Maya, el acceso nunca ha sido mejor.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {propLocations.map(loc => (
              <div key={loc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: properties.find(p=>p.location===loc)?.accent || P.accent, boxShadow: `0 0 8px ${properties.find(p=>p.location===loc)?.accent || P.accent}` }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: font }}>{loc}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>— {properties.filter(p=>p.location===loc).length} propiedad{properties.filter(p=>p.location===loc).length>1?"es":""}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
            {[{l:"Cancún →",d:"15-45 min"},{l:"Playa del Carmen →",d:"5-90 min"},{l:"Aeropuerto Tulum →",d:"Nuevo 2025"}].map(r=>(
              <div key={r.l} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{r.l}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
        {/* SVG Map */}
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#020408" }}>
          <svg width="100%" viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg">
            {/* Caribbean Sea */}
            <rect width="120" height="110" fill="#030d1a"/>
            {/* Coastline */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L120 110 L120 0 Z" fill="#0a2040" opacity="0.8"/>
            {/* Land */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L0 110 L0 0 Z" fill="#0f1f0a" opacity="0.9"/>
            {/* Caribbean text */}
            <text x="100" y="55" fill="#1a4a7a" fontSize="5" opacity="0.6" fontFamily="sans-serif" transform="rotate(-70 100 55)">Mar Caribe</text>
            {/* Road/highway */}
            <path d="M85 18 Q82 28 78 36 Q72 46 68 53 Q62 63 58 70 Q54 78 50 88" stroke="#2a3a1a" strokeWidth="1.5" fill="none" strokeDasharray="2,1"/>
            {/* City dots */}
            {Object.entries(locations).map(([city, pos]) => {
              const isProp = propLocations.includes(city);
              const propAccent = isProp ? (properties.find(p=>p.location===city)?.accent || P.accent) : null;
              return (
                <g key={city}>
                  {isProp && <circle cx={pos.x} cy={pos.y} r="5" fill={propAccent} opacity="0.15"/>}
                  <circle cx={pos.x} cy={pos.y} r={isProp?"3":"1.5"} fill={isProp ? propAccent : "rgba(255,255,255,0.3)"} opacity={isProp?0.9:0.5}/>
                  <text x={pos.x+4} y={pos.y+1} fill="white" fontSize="3.5" opacity={isProp?0.8:0.4} fontFamily="sans-serif">{city}</text>
                </g>
              );
            })}
            {/* Airport icon */}
            <text x="73" y="79" fill="#FFD700" fontSize="5" opacity="0.5">✈</text>
            <text x="73" y="83" fill="#FFD700" fontSize="2.5" opacity="0.4" fontFamily="sans-serif">TULUM</text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default RivieraMayaMap;
