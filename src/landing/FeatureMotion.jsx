import { createElement, useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, ChartNoAxesCombined, ListTodo, Users } from "lucide-react";
import "./FeatureMotion.css";

const flows = [
  {
    id: "contexto", title: "Una pregunta.\nTodo el contexto.",
    description: "Consulta clientes, pendientes y próximos pasos con Copilot. Prepara el seguimiento desde el mismo espacio.",
    input: "Consultar cartera", hub: "Copilot",
    outputs: [[Users, "Clientes"], [ListTodo, "Pendientes"], [CalendarDays, "Próximos pasos"]],
    accessible: "Consulta tu cartera con Copilot para encontrar clientes, pendientes y próximos pasos.",
    link: "Conocer los módulos",
  },
  {
    id: "visibilidad", title: "Tu equipo avanza.\nTú ves lo importante.",
    description: "Comando y Métricas reúnen la actividad registrada para revisar la cartera, el seguimiento y su evolución.",
    input: "Actividad registrada", hub: "Comando",
    outputs: [[ChartNoAxesCombined, "Cartera"], [Users, "Equipo"], [BarChart3, "Métricas"]],
    accessible: "La actividad registrada se puede revisar en Comando y Métricas: cartera, actividad del equipo e histórico.",
    link: "Conocer los módulos",
  },
];

function connectionPaths(width, vertical) {
  const center = width / 2;
  if (vertical) return [`M${center} 44V103`, `M${center} 202C${center} 220 ${width * .15665} 220 ${width * .15665} 244`, `M${center} 202V244`, `M${center} 202C${center} 220 ${width * .84335} 220 ${width * .84335} 244`];
  const input = width * .32, hubLeft = center - 32, hubRight = center + 32, output = width * .72, bend = (hubRight + output) / 2;
  return [`M${input} 140H${hubLeft}`, `M${hubRight} 140C${bend} 140 ${bend} 44 ${output} 44`, `M${hubRight} 140H${output}`, `M${hubRight} 140C${bend} 140 ${bend} 236 ${output} 236`];
}

function Connections({ vertical = false, width }) {
  const measuredWidth = width || (vertical ? 300 : 500);
  return <svg className={`smk-flow-lines${vertical ? " smk-flow-lines-vertical" : ""}`} viewBox={`0 0 ${measuredWidth} ${vertical ? 310 : 280}`} preserveAspectRatio="none" aria-hidden="true">
    {connectionPaths(measuredWidth, vertical).map((path, index) => <g key={index} className={`smk-flow-tone-${index === 2 ? "green" : "sky"}`}>
      <path className="smk-flow-track" d={path} />
      {["trail", "core"].map(layer => <path key={layer} data-flow-cycle={index === 0 && layer === "core" ? "true" : undefined} className={`smk-flow-signal smk-flow-${layer}${index ? " smk-flow-branch" : " smk-flow-incoming"}`} d={path} pathLength="100" />)}
    </g>)}
  </svg>;
}

function FlowDiagram({ flow, region, cycle }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(region.current);
    return () => observer.disconnect();
  }, [region]);
  return <div className="smk-flow-diagram" ref={region} role="img" aria-label={flow.accessible}>
    <div className="smk-flow-art" key={cycle} aria-hidden="true">
      <Connections width={width} /><Connections vertical width={width} />
      <span className="smk-flow-input">{flow.input}</span>
      <div className="smk-flow-hub"><div><i className="smk-flow-glint smk-flow-hub-glint smk-flow-tone-sky" /><img src="/branding/stratos-logo-web-20261016.webp" width="52" height="52" alt="" loading="lazy" /></div><span>{flow.hub}</span></div>
      <div className="smk-flow-outputs">{flow.outputs.map(([icon, label], index) => <div className={`smk-flow-output smk-flow-output-${index}`} key={label}><span><i className={`smk-flow-glint smk-flow-output-glint smk-flow-tone-${index === 1 ? "green" : "sky"}`} />{createElement(icon, { size: 21, strokeWidth: 1.5 })}</span><span>{label}</span></div>)}</div>
    </div>
  </div>;
}

function FlowCard({ flow }) {
  const region = useRef(null);
  const [environment, setEnvironment] = useState(() => ({ visible: false, hidden: typeof document !== "undefined" && document.hidden, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, lowfx: typeof document !== "undefined" && document.documentElement.hasAttribute("data-lowfx"), cycle: 0 }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setEnvironment(value => ({ ...value, hidden: document.hidden, cycle: value.cycle + (value.hidden && !document.hidden ? 1 : 0) }));
    const preference = () => setEnvironment(value => ({ ...value, reduced: media.matches, cycle: value.cycle + 1 }));
    const safeMode = new MutationObserver(() => setEnvironment(value => ({ ...value, lowfx: document.documentElement.hasAttribute("data-lowfx"), cycle: value.cycle + 1 })));
    safeMode.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lowfx"] });
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
      setEnvironment(value => ({ ...value, visible, cycle: value.cycle + (!value.visible && visible ? 1 : 0) }));
    }, { threshold: .15 });
    observer.observe(region.current);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); safeMode.disconnect(); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", preference); };
  }, []);
  // Restart on completion, with no idle gap; finite passes retain mobile safeguards.
  return <article onAnimationEnd={event => { if (event.target.dataset.flowCycle === "true" && environment.visible && !environment.hidden && !environment.lowfx && !environment.reduced) setEnvironment(value => ({ ...value, cycle: value.cycle + 1 })); }} className="smk-motion-card" data-running={environment.visible && !environment.hidden && !environment.lowfx && !environment.reduced}>
    <h3>{flow.title.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h3>
    <p>{flow.description}</p><FlowDiagram flow={flow} region={region} cycle={environment.cycle} /><a href="#modulos">{flow.link}<ArrowRight size={16} aria-hidden="true" /></a>
  </article>;
}

export default function FeatureMotion() {
  return <section className="smk-section smk-container smk-feature-motion" aria-labelledby="smk-motion-title">
    <div className="smk-section-heading"><h2 id="smk-motion-title">Menos trabajo disperso.<br />Más contexto para avanzar.</h2><p>De una consulta al panorama del equipo. Así se conecta el trabajo en Stratos AI.</p></div>
    <div className="smk-motion-grid">{flows.map(flow => <FlowCard flow={flow} key={flow.id} />)}</div>
    <div className="smk-motion-footer"><p>Flujos ilustrativos. Disponibilidad según los permisos y la configuración de cada empresa.</p></div>
  </section>;
}
