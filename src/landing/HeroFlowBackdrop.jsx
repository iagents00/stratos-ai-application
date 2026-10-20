import { useEffect, useId, useRef, useState } from "react";
import "./HeroFlowBackdrop.css";

// Every signal follows real edges in one connected, full-width lattice.
function createNetwork(mobile) {
  const step = mobile ? 66 : 96;
  const columns = mobile ? 9 : 18;
  const rows = Array.from({ length: mobile ? 10 : 9 }, (_, row) =>
    Array.from({ length: columns }, (_, col) => [
      -step + col * step + (row % 2) * step / 2,
      (mobile ? 0 : -6) + row * (mobile ? 62 : 64),
    ]));
  const edges = [];
  rows.forEach((nodes, row) => nodes.forEach((point, col) => {
    if (col) edges.push([nodes[col - 1], point]);
    if (row) rows[row - 1].forEach(previous => {
      if (Math.abs(previous[0] - point[0]) === step / 2) edges.push([previous, point]);
    });
  }));
  const diagonal = (column, upward = false) => Array.from({ length: 9 }, (_, row) =>
    rows[upward ? 8 - row : row][column + Math.floor(row / 2)]);
  return { edges, routes: [rows[1], diagonal(1), diagonal(columns - 6, true), rows[7]] };
}
const desktopNetwork = createNetwork(false);
const mobileNetwork = createNetwork(true);
const pathData = points => points.map((point, index) => `${index ? "L" : "M"}${point.join(" ")}`).join(" ");

function Network({ mobile, id, cycle }) {
  const quiet = `${id}-${mobile ? "mobile" : "desktop"}`;
  const { edges, routes } = mobile ? mobileNetwork : desktopNetwork;
  return <svg className={`smk-hero-flow-network${mobile ? " smk-hero-flow-network-mobile" : ""}`} viewBox={mobile ? "0 0 390 560" : "0 0 1440 500"} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      {[["sky", "#62B8E8"], ["green", "#56C99B"]].map(([tone, color]) => <linearGradient key={tone} id={`${quiet}-comet-${tone}`} gradientUnits="userSpaceOnUse" x1={mobile ? -90 : -180} y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor={color} stopOpacity="0" />
        <stop offset="45%" stopColor={color} stopOpacity=".16" />
        <stop offset="80%" stopColor={color} stopOpacity=".58" />
        <stop offset="100%" stopColor={color} stopOpacity=".95" />
      </linearGradient>)}
      <linearGradient id={`${quiet}-field`}>
        {[[0, 1], [18, .75], [32, .12], [50, .045], [68, .12], [82, .75], [100, 1]].map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      <linearGradient id={`${quiet}-edges`} x1="0" y1="0" x2="0" y2="1">
        {(mobile ? [[0, .35], [9, .2], [20, 0], [90, 0], [100, .2]] : [[0, .6], [12, .32], [24, 0], [80, 0], [100, .38]]).map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      {/* Lift the upper/lower lattice while retaining the quiet reading area. */}
      <mask id={quiet}><rect width="100%" height="100%" fill={`url(#${quiet}-field)`} /><rect width="100%" height="100%" fill={`url(#${quiet}-edges)`} /></mask>
    </defs>
    <g mask={`url(#${quiet})`}>
      <path className="smk-hero-flow-connections" d={edges.map(pathData).join(" ")} />
      {routes.map((route, index) => {
        const reversed = (index + cycle) % 2 === 1;
        const start = reversed ? route.at(-1) : route[0];
        const end = reversed ? route[0] : route.at(-1);
        const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
        const tail = mobile ? 90 : 180;
        return <g key={index} data-flow-route={pathData(route)} className={`smk-hero-flow-tone-${index % 2 ? "green" : "sky"}`} transform={`translate(${start.join(" ")}) rotate(${angle})`}>
          <g data-flow-cycle={index === 0 ? "true" : undefined} className="smk-hero-flow-comet" style={{ "--comet-distance": `${distance + tail}px` }}>
            <path d={`M${-tail} 0 L-4 -1.4 Q2 -1.4 2 0 Q2 1.4 -4 1.4 Z`} fill={`url(#${quiet}-comet-${index % 2 ? "green" : "sky"})`} />
            <ellipse className="smk-hero-flow-head-halo" rx="5" ry="3" />
            <ellipse className="smk-hero-flow-head" rx="2.2" ry="1.6" />
          </g>
        </g>;
      })}
    </g>
  </svg>;
}

export default function HeroFlowBackdrop() {
  const id = useId();
  const [auraCycle, setAuraCycle] = useState(0);
  const region = useRef(null);
  const [environment, setEnvironment] = useState(() => ({ visible: false, hidden: typeof document !== "undefined" && document.hidden, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, lowfx: typeof document !== "undefined" && document.documentElement.hasAttribute("data-lowfx"), cycle: 0 }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setEnvironment(value => ({ ...value, hidden: document.hidden, cycle: value.cycle + (value.hidden && !document.hidden ? 1 : 0) }));
    const preference = () => setEnvironment(value => ({ ...value, reduced: media.matches, cycle: value.cycle + 1 }));
    const safeMode = new MutationObserver(() => setEnvironment(value => ({ ...value, lowfx: document.documentElement.hasAttribute("data-lowfx"), cycle: value.cycle + 1 })));
    safeMode.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lowfx"] });
    const observer = new IntersectionObserver(entries => setEnvironment(value => ({ ...value, visible: entries[0].isIntersecting, cycle: value.cycle + (!value.visible && entries[0].isIntersecting ? 1 : 0) })), { threshold: .05 });
    observer.observe(region.current);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); safeMode.disconnect(); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", preference); };
  }, []);
  // Restart on completion, with no idle gap; finite passes retain mobile safeguards.
  return <div className="smk-hero-flow" ref={region} onAnimationEnd={event => { if (event.target.dataset.flowCycle === "true" && environment.visible && !environment.hidden && !environment.lowfx && !environment.reduced) setEnvironment(value => ({ ...value, cycle: value.cycle + 1 })); }} aria-hidden="true" data-running={environment.visible && !environment.hidden && !environment.lowfx && !environment.reduced}><div className="smk-hero-auras" key={`auras-${auraCycle}`}><div className="smk-hero-aura smk-hero-aura-blue" onAnimationEnd={() => setAuraCycle(value => value + 1)} /><div className="smk-hero-aura smk-hero-aura-green" /></div><Network key={`desktop-${environment.cycle}`} id={id} cycle={environment.cycle} /><Network key={`mobile-${environment.cycle}`} id={id} cycle={environment.cycle} mobile /></div>;
}
