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
  const centerColumn = mobile ? 4 : 8;
  const horizontal = row => [rows[row].slice(0, centerColumn + 1).reverse(), rows[row].slice(centerColumn)];
  const diagonal = (vertical, horizontal, startRow = 4, startColumn = centerColumn) => {
    const points = [rows[startRow][startColumn]];
    for (let row = startRow + vertical; rows[row]; row += vertical) {
      const next = rows[row].find(point => point[0] === points.at(-1)[0] + horizontal * step / 2);
      if (!next) break;
      points.push(next);
    }
    return points;
  };
  return { edges, routes: [...horizontal(1), ...horizontal(mobile ? 8 : 7), diagonal(-1, 1, 8, centerColumn - 4), diagonal(-1, -1, 8, centerColumn + 4), diagonal(1, -1), diagonal(1, 1)] };
}
const desktopNetwork = createNetwork(false);
const mobileNetwork = createNetwork(true);
const pathData = points => points.map((point, index) => `${index ? "L" : "M"}${point.join(" ")}`).join(" ");

// Independent deterministic sequences: no shared restart or repeating direction flip.
const variation = seed => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
function Meteor({ route, index, mobile, quiet, cycle }) {
  const [pass, setPass] = useState(cycle);
  const start = route[0], end = route.at(-1);
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
  const tail = mobile ? 170 : 360;
  const seed = pass * 19 + index * 43;
  const duration = 1.8 + variation(seed) * 2;
  const delay = .08 + variation(seed + 7) * 1.1;
  return <g data-flow-route={pathData(route)} className={`smk-hero-flow-tone-${index % 2 ? "green" : "sky"}`} transform={`translate(${start.join(" ")}) rotate(${angle})`}>
    <g key={pass} className="smk-hero-flow-comet" onAnimationEnd={event => { if (event.target === event.currentTarget) setPass(value => value + 1); }} style={{ "--comet-distance": `${distance + tail}px`, "--comet-duration": `${duration.toFixed(3)}s`, "--comet-delay": `${delay.toFixed(3)}s`, "--comet-acceleration": (.18 + variation(seed + 13) * .25).toFixed(3) }}>
      <path d={`M${-tail} 0 L-4 -1.4 Q2 -1.4 2 0 Q2 1.4 -4 1.4 Z`} fill={`url(#${quiet}-comet-${index % 2 ? "green" : "sky"})`} />
      <ellipse className="smk-hero-flow-head-halo" rx="5" ry="3" />
      <ellipse className="smk-hero-flow-head" rx="2.2" ry="1.6" />
    </g>
  </g>;
}

function Network({ mobile, id, cycle }) {
  const quiet = `${id}-${mobile ? "mobile" : "desktop"}`;
  const { edges, routes } = mobile ? mobileNetwork : desktopNetwork;
  return <svg className={`smk-hero-flow-network${mobile ? " smk-hero-flow-network-mobile" : ""}`} viewBox={mobile ? "0 0 390 560" : "0 0 1440 500"} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      {[["sky", "#62B8E8"], ["green", "#56C99B"]].map(([tone, color]) => <linearGradient key={tone} id={`${quiet}-comet-${tone}`} gradientUnits="userSpaceOnUse" x1={mobile ? -170 : -360} y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor={color} stopOpacity="0" />
        <stop offset="45%" stopColor={color} stopOpacity=".16" />
        <stop offset="80%" stopColor={color} stopOpacity=".58" />
        <stop offset="100%" stopColor={color} stopOpacity=".95" />
      </linearGradient>)}
      <linearGradient id={`${quiet}-field`}>
        {[[0, 1], [18, .75], [32, .12], [50, .045], [68, .12], [82, .75], [100, 1]].map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      <linearGradient id={`${quiet}-edges`} x1="0" y1="0" x2="0" y2="1">
        {(mobile ? [[0, .35], [9, .2], [20, 0], [78, 0], [87, .65], [96, .75], [100, .3]] : [[0, .6], [12, .32], [24, 0], [76, 0], [86, .6], [96, .75], [100, .3]]).map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      {/* Lift the upper/lower lattice while retaining the quiet reading area. */}
      <mask id={quiet}><rect width="100%" height="100%" fill={`url(#${quiet}-field)`} /><rect width="100%" height="100%" fill={`url(#${quiet}-edges)`} /></mask>
    </defs>
    <g mask={`url(#${quiet})`}>
      <path className="smk-hero-flow-connections" d={edges.map(pathData).join(" ")} />
      {routes.map((route, index) => <Meteor key={index} route={route} index={index} mobile={mobile} quiet={quiet} cycle={cycle} />)}
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
  // Visibility changes restart the field; individual meteors manage their own cadence.
  return <div className="smk-hero-flow" ref={region} aria-hidden="true" data-running={environment.visible && !environment.hidden && !environment.lowfx && !environment.reduced}><div className="smk-hero-auras" key={`auras-${auraCycle}`}><div className="smk-hero-aura smk-hero-aura-blue" onAnimationEnd={() => setAuraCycle(value => value + 1)} /><div className="smk-hero-aura smk-hero-aura-green" /></div><Network key={`desktop-${environment.cycle}`} id={id} cycle={environment.cycle} /><Network key={`mobile-${environment.cycle}`} id={id} cycle={environment.cycle} mobile /></div>;
}
