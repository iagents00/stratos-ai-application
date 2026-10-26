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
  return { edges, routes: [...horizontal(1), diagonal(-1, 1, 8, centerColumn - 4), diagonal(-1, -1, 8, centerColumn + 4), diagonal(1, -1), diagonal(1, 1), diagonal(-1, -1, 8, centerColumn - 1), diagonal(-1, 1, 8, centerColumn + 1), diagonal(-1, -1, 8, centerColumn - 2), diagonal(-1, 1, 8, centerColumn + 2)] };
}
const desktopNetwork = createNetwork(false);
const mobileNetwork = createNetwork(true);
const pathData = points => points.map((point, index) => `${index ? "L" : "M"}${point.join(" ")}`).join(" ");

// Mirrored pairs share a clock; outward blue signals enter between the main beats.
function Meteor({ route, index, mobile, quiet }) {
  // Keep the luminous head inside the SVG for the full flight.
  const first = route[0], last = route.at(-1);
  const delta = [last[0] - first[0], last[1] - first[1]];
  let enter = 0, exit = 1;
  [mobile ? 390 : 1440, mobile ? 560 : 500].forEach((size, axis) => {
    if (!delta[axis]) return;
    const bounds = [(8 - first[axis]) / delta[axis], (size - 8 - first[axis]) / delta[axis]].sort((a, b) => a - b);
    enter = Math.max(enter, bounds[0]);
    exit = Math.min(exit, bounds[1]);
  });
  const start = first.map((value, axis) => value + delta[axis] * enter);
  const end = first.map((value, axis) => value + delta[axis] * exit);
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
  const tail = mobile ? 238 : 504;
  const duration = 1.5;
  const delay = index < 6 ? -Math.floor(index / 2) * .5 : -(.25 + Math.floor((index - 6) / 2) * .5);
  const tone = index >= 6 ? "sky" : index % 2 ? "green" : "sky";
  return <g data-flow-route={pathData(route)} className={`smk-hero-flow-tone-${tone}`} transform={`translate(${start.join(" ")}) rotate(${angle})`}>
    <g className="smk-hero-flow-comet" data-brand-motion="true" style={{ "--comet-motion": `smk-hero-comet-travel ${duration}s linear ${delay}s infinite`, animation: "var(--comet-motion)", animationPlayState: "var(--flow-play)", "--comet-distance": `${distance}px`, "--comet-duration": `${duration.toFixed(3)}s`, "--comet-delay": `${delay.toFixed(3)}s` }}>
      <path d={`M${-tail} 0 L-3 -.65 Q1 -.65 1 0 Q1 .65 -3 .65 Z`} fill={`url(#${quiet}-comet-${tone})`} />
      <ellipse className="smk-hero-flow-head-halo" rx="2.6" ry="1.1" />
      <ellipse className="smk-hero-flow-head" rx="1.25" ry=".65" />
    </g>
  </g>;
}

function Network({ mobile, id }) {
  const quiet = `${id}-${mobile ? "mobile" : "desktop"}`;
  const { edges, routes } = mobile ? mobileNetwork : desktopNetwork;
  return <svg className={`smk-hero-flow-network${mobile ? " smk-hero-flow-network-mobile" : ""}`} viewBox={mobile ? "0 0 390 560" : "0 0 1440 500"} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      {[["sky", "#63ACD8"], ["green", "#64B79D"]].map(([tone, color]) => <linearGradient key={tone} id={`${quiet}-comet-${tone}`} gradientUnits="userSpaceOnUse" x1={mobile ? -238 : -504} y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor={color} stopOpacity="0" />
        <stop offset="45%" stopColor={color} stopOpacity=".38" />
        <stop offset="80%" stopColor={color} stopOpacity=".8" />
        <stop offset="100%" stopColor={color} stopOpacity=".95" />
      </linearGradient>)}
      <linearGradient id={`${quiet}-field`}>
        {[[0, 1], [18, .75], [32, .12], [50, .045], [68, .12], [82, .75], [100, 1]].map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      <linearGradient id={`${quiet}-edges`} x1="0" y1="0" x2="0" y2="1">
        {(mobile ? [[0, .35], [9, .2], [20, 0], [78, 0], [87, .65], [96, .75], [100, .3]] : [[0, .6], [12, .32], [24, 0], [76, 0], [86, .6], [96, .75], [100, .3]]).map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      <linearGradient id={`${quiet}-signals`}>
        {[[0, 1], [24, .95], [40, .3], [60, .3], [76, .95], [100, 1]].map(([offset, opacity]) => <stop key={offset} offset={`${offset}%`} stopColor="#fff" stopOpacity={opacity} />)}
      </linearGradient>
      <mask id={`${quiet}-motion`}><rect width="100%" height="100%" fill={`url(#${quiet}-signals)`} /></mask>
      {/* Lift the upper/lower lattice while retaining the quiet reading area. */}
      <mask id={quiet}><rect width="100%" height="100%" fill={`url(#${quiet}-field)`} /><rect width="100%" height="100%" fill={`url(#${quiet}-edges)`} /></mask>
    </defs>
    <g mask={`url(#${quiet})`}>
      <path className="smk-hero-flow-connections" d={edges.map(pathData).join(" ")} />
    </g>
    <g mask={`url(#${quiet}-motion)`}>
      {routes.map((route, index) => <Meteor key={index} route={route} index={index} mobile={mobile} quiet={quiet} />)}
    </g>
  </svg>;
}

export default function HeroFlowBackdrop() {
  const id = useId();
  const motionEnabled = true;
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
  // Restart the shared rhythm on re-entry; CSS pauses every pair together.
  return <div className="smk-hero-flow" data-motion-enabled={motionEnabled} ref={region} aria-hidden="true" data-running={environment.visible && !environment.hidden && !environment.lowfx && (!environment.reduced || motionEnabled)}><Network key={`desktop-${environment.cycle}`} id={id} /><Network key={`mobile-${environment.cycle}`} id={id} mobile /></div>;
}
