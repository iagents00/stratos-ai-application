import { useEffect, useId, useRef, useState } from "react";
import "./HeroFlowBackdrop.css";

const desktopNodes = [[38,92],[129,44],[228,85],[324,38],[77,189],[179,150],[297,195],[21,301],[122,268],[225,314],[349,277],[65,411],[188,446],[308,390],[1107,74],[1223,36],[1348,89],[1420,166],[1164,181],[1286,154],[1380,257],[1088,290],[1215,302],[1314,367],[1430,399],[1126,429],[1234,460],[1390,472]];
const desktopEdges = [[0,1],[0,4],[1,2],[1,5],[2,3],[2,5],[2,6],[4,5],[4,7],[4,8],[5,6],[5,8],[6,9],[6,10],[7,8],[8,9],[8,11],[9,10],[9,12],[9,13],[11,12],[12,13],[14,15],[14,18],[15,16],[15,19],[16,17],[16,19],[17,20],[18,19],[18,21],[18,22],[19,20],[19,22],[20,23],[20,24],[21,22],[21,25],[22,23],[22,25],[22,26],[23,24],[23,26],[24,27],[25,26],[26,27]];
const mobileNodes = [[16,38],[92,15],[161,45],[301,20],[373,62],[35,143],[87,226],[11,301],[40,397],[111,475],[318,139],[376,216],[330,302],[383,379],[297,452],[367,512]];
const mobileEdges = [[0,1],[0,5],[1,2],[1,5],[3,4],[3,10],[4,10],[4,11],[5,6],[5,7],[6,7],[6,8],[7,8],[8,9],[10,11],[10,12],[11,12],[11,13],[12,13],[12,14],[13,15],[14,15]];

function Network({ mobile, id }) {
  const nodes = mobile ? mobileNodes : desktopNodes;
  const edges = mobile ? mobileEdges : desktopEdges;
  const routes = mobile ? [[1,0,5,6,8,9],[3,4,11,12,14,15]] : [[1,5,8,9,13],[3,2,6,10],[15,19,22,26,27],[17,20,23,22,25]];
  const quiet = `${id}-${mobile ? "mobile" : "desktop"}`;
  return <svg className={`smk-hero-flow-network${mobile ? " smk-hero-flow-network-mobile" : ""}`} viewBox={mobile ? "0 0 390 560" : "0 0 1440 500"} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id={`${quiet}-field`} cx="50%" cy="45%" r="66%"><stop offset="34%" stopColor="#000" /><stop offset="96%" stopColor="#fff" /></radialGradient><mask id={quiet}><rect width="100%" height="100%" fill={`url(#${quiet}-field)`} /></mask></defs>
    <g mask={`url(#${quiet})`}>
      <g className="smk-hero-flow-connections">{edges.map(([from, to]) => <line key={`${from}-${to}`} x1={nodes[from][0]} y1={nodes[from][1]} x2={nodes[to][0]} y2={nodes[to][1]} />)}</g>
      {routes.map((route, index) => <path key={route.join("-")} className={`smk-hero-flow-signal smk-hero-flow-signal-${index}`} d={route.map((node, step) => `${step ? "L" : "M"}${nodes[node].join(" ")}`).join(" ")} pathLength="100" />)}
      {nodes.map(([x, y], index) => <g key={`${x}-${y}`} className="smk-hero-flow-node">{index % 5 === 0 && <circle className="smk-hero-flow-node-ring" cx={x} cy={y} r={mobile ? 8 : 10} />}<circle cx={x} cy={y} r={index % 5 === 0 ? 3.6 : 2.1} /></g>)}
    </g>
  </svg>;
}

export default function HeroFlowBackdrop() {
  const id = useId();
  const region = useRef(null);
  const [environment, setEnvironment] = useState(() => ({ visible: false, hidden: typeof document !== "undefined" && document.hidden, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setEnvironment(value => ({ ...value, hidden: document.hidden }));
    const preference = () => setEnvironment(value => ({ ...value, reduced: media.matches }));
    const observer = new IntersectionObserver(entries => setEnvironment(value => ({ ...value, visible: entries[0].isIntersecting })), { threshold: .05 });
    observer.observe(region.current);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", preference); };
  }, []);
  return <div className="smk-hero-flow" ref={region} aria-hidden="true" data-running={environment.visible && !environment.hidden && !environment.reduced}><Network id={id} /><Network id={id} mobile /></div>;
}
