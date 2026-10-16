import { useEffect, useId, useRef, useState } from "react";
import "./HeroFlowBackdrop.css";

// One regular half-mesh is reflected, so both sides share exact geometry,
// animation timing and an outward direction without independent offsets.
function mesh(rows, diagonalWidth) {
  const nodes = [], edges = [];
  let previous = [];
  rows.forEach(([y, xs]) => {
    const current = xs.map(x => { nodes.push([x, y]); return nodes.length - 1; });
    current.forEach((node, index) => {
      if (index) edges.push([current[index - 1], node]);
      previous.forEach(from => { if (Math.abs(nodes[from][0] - nodes[node][0]) === diagonalWidth) edges.push([from, node]); });
    });
    previous = current;
  });
  return { nodes, edges };
}
const desktopMesh = mesh(Array.from({ length: 7 }, (_, row) => [44 + row * 64, row % 2 ? [88, 184, 280] : [40, 136, 232, 328]]), 48);
const mobileMesh = mesh(Array.from({ length: 9 }, (_, row) => [64 + row * 56, row % 2 ? [49] : [16, 82]]), 33);

function HalfNetwork({ mobile, quiet }) {
  const { nodes, edges } = mobile ? mobileMesh : desktopMesh;
  const routes = mobile ? [[4, 2, 0], [10, 11, 12]] : [[10, 9, 5, 1, 0], [17, 16, 19, 22, 21]];
  const lights = routes.flatMap((route, index) => [
    { node: route[1], tone: index ? "green" : "sky", delay: 0 },
    { node: route.at(-1), tone: index ? "green" : "sky", delay: 3 },
  ]);
  return <>
    <g className="smk-hero-flow-connections">{edges.map(([from, to]) => <line key={`${from}-${to}`} x1={nodes[from][0]} y1={nodes[from][1]} x2={nodes[to][0]} y2={nodes[to][1]} />)}</g>
    {routes.map((route, index) => <g key={route.join("-")} className={`smk-hero-flow-tone-${index ? "green" : "sky"}`}>
      {["trail", "core"].map(layer => <path key={layer} className={`smk-hero-flow-signal smk-hero-flow-${layer}`} d={route.map((node, step) => `${step ? "L" : "M"}${nodes[node].join(" ")}`).join(" ")} pathLength="100" />)}
    </g>)}
    {nodes.map(([x, y], index) => <g key={`${x}-${y}`} className="smk-hero-flow-node">{index % 5 === 0 && <circle className="smk-hero-flow-node-ring" cx={x} cy={y} r={mobile ? 7 : 9} />}<circle cx={x} cy={y} r={index % 5 === 0 ? 3.2 : 1.9} /></g>)}
    {lights.map(({ node, tone, delay }, index) => <g key={`${node}-${index}`} className={`smk-hero-flow-glint smk-hero-flow-tone-${tone}`} style={{ '--flow-delay': `${delay}s` }}><circle cx={nodes[node][0]} cy={nodes[node][1]} r={mobile ? 10 : 13} fill={`url(#${quiet}-${tone})`} /><circle className="smk-hero-flow-glint-core" cx={nodes[node][0]} cy={nodes[node][1]} r="2.8" /></g>)}
  </>;
}

function Network({ mobile, id }) {
  const quiet = `${id}-${mobile ? "mobile" : "desktop"}`;
  return <svg className={`smk-hero-flow-network${mobile ? " smk-hero-flow-network-mobile" : ""}`} viewBox={mobile ? "0 0 390 560" : "0 0 1440 500"} preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id={`${quiet}-field`} cx="50%" cy="45%" r="66%"><stop offset="34%" stopColor="#000" /><stop offset="96%" stopColor="#fff" /></radialGradient><mask id={quiet}><rect width="100%" height="100%" fill={`url(#${quiet}-field)`} /></mask>
      {[['sky', '#59BFF4'], ['green', '#00DB40']].map(([tone, color]) => <radialGradient id={`${quiet}-${tone}`} key={tone}><stop offset="0" stopColor={color} stopOpacity=".6" /><stop offset=".4" stopColor={color} stopOpacity=".24" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>)}
    </defs>
    <g mask={`url(#${quiet})`}>
      <g className="smk-hero-flow-half"><HalfNetwork mobile={mobile} quiet={quiet} /></g>
      <g className="smk-hero-flow-half" transform={`translate(${mobile ? 390 : 1440} 0) scale(-1 1)`}><HalfNetwork mobile={mobile} quiet={quiet} /></g>
    </g>
  </svg>;
}

export default function HeroFlowBackdrop() {
  const id = useId();
  const region = useRef(null);
  const [environment, setEnvironment] = useState(() => ({ visible: false, hidden: typeof document !== "undefined" && document.hidden, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, lowfx: typeof document !== "undefined" && document.documentElement.hasAttribute("data-lowfx"), cycle: 0 }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setEnvironment(value => ({ ...value, hidden: document.hidden, cycle: value.cycle + (value.hidden && !document.hidden ? 1 : 0) }));
    const preference = () => setEnvironment(value => ({ ...value, reduced: media.matches }));
    const safeMode = new MutationObserver(() => setEnvironment(value => ({ ...value, lowfx: document.documentElement.hasAttribute("data-lowfx") })));
    safeMode.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lowfx"] });
    const observer = new IntersectionObserver(entries => setEnvironment(value => ({ ...value, visible: entries[0].isIntersecting, cycle: value.cycle + (!value.visible && entries[0].isIntersecting ? 1 : 0) })), { threshold: .05 });
    observer.observe(region.current);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); safeMode.disconnect(); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", preference); };
  }, []);
  useEffect(() => {
    if (!environment.visible || environment.hidden || environment.lowfx) return;
    // A synchronized 6s pass, with arrival lights ending at9s, then idle.
    // Re-arm only while visible:7s rest, or13s with reduced motion.
    const timer = setTimeout(() => setEnvironment(value => ({ ...value, cycle: value.cycle + 1 })), environment.reduced ? 24000 : 16000);
    return () => clearTimeout(timer);
  }, [environment.visible, environment.hidden, environment.reduced, environment.lowfx, environment.cycle]);
  // A bounded sequence restarts on viewport entry and a low-frequency timer.
  // Reduced motion keeps gentle light changes, with no travelling particles.
  return <div className="smk-hero-flow" ref={region} aria-hidden="true" data-running={environment.visible && !environment.hidden && !environment.lowfx}><Network key={`desktop-${environment.cycle}`} id={id} /><Network key={`mobile-${environment.cycle}`} id={id} mobile /></div>;
}
