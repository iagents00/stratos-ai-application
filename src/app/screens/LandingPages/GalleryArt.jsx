import { P, font } from "../../../design-system/tokens";

/* Gallery art — 6 frames per property */
const GalleryArt = ({ prop, index }) => {
  const frames = [
    { label: "Piscina", grad: `linear-gradient(135deg, ${prop.accent}30, ${prop.accent}08)` },
    { label: "Vista aérea", grad: "linear-gradient(180deg, #0a1520 0%, #1a3a5a 100%)" },
    { label: "Lobby", grad: "linear-gradient(135deg, #1a1a2a, #2a2a4a)" },
    { label: "Terraza", grad: `linear-gradient(180deg, ${prop.accent}20, #050810)` },
    { label: "Amenidades", grad: "linear-gradient(135deg, #1a2a1a, #2a4a2a)" },
    { label: "Recámara", grad: "linear-gradient(135deg, #1a1510, #2a2515)" },
  ];
  const f = frames[index % 6];
  return (
    <div style={{ height: 90, borderRadius: 8, background: f.grad, border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", padding: "8px 10px" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 8px)" }} />
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", position: "relative" }}>{f.label}</span>
    </div>
  );
};

export default GalleryArt;
