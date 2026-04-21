import { P, fontDisp } from "../../../design-system/tokens";

const ScoreBar = ({ sc, compact }) => {
  const c = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 4 : 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}40`, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: c, fontFamily: fontDisp, minWidth: 20, textAlign: "right" }}>{sc}</span>
    </div>
  );
};

export default ScoreBar;
