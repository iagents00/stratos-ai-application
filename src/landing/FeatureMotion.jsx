import { createElement, useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, ChartNoAxesCombined, ListTodo, Pause, Play, Users } from "lucide-react";
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

const horizontalPaths = ["M158 140H218", "M282 140C322 140 322 45 360 45", "M282 140H360", "M282 140C322 140 322 235 360 235"];
const verticalPaths = ["M150 44V105", "M150 202C150 220 47 220 47 245", "M150 202V245", "M150 202C150 220 253 220 253 245"];

function Connections({ vertical = false }) {
  return <svg className={`smk-flow-lines${vertical ? " smk-flow-lines-vertical" : ""}`} viewBox={vertical ? "0 0 300 310" : "0 0 500 280"} preserveAspectRatio="none" aria-hidden="true">
    {(vertical ? verticalPaths : horizontalPaths).map((path, index) => <g key={path}>
      <path className="smk-flow-track" d={path} />
      <path className={`smk-flow-signal smk-flow-signal-${index}`} d={path} pathLength="100" />
    </g>)}
  </svg>;
}

function FlowDiagram({ flow }) {
  return <div className="smk-flow-diagram" role="img" aria-label={flow.accessible}>
    <div className="smk-flow-art" aria-hidden="true">
      <Connections /><Connections vertical />
      <span className="smk-flow-input">{flow.input}</span>
      <div className="smk-flow-hub"><div><img src="/branding/stratos-logo-web-20261016.webp" width="52" height="52" alt="" loading="lazy" /></div><span>{flow.hub}</span></div>
      <div className="smk-flow-outputs">{flow.outputs.map(([icon, label], index) => <div className={`smk-flow-output smk-flow-output-${index}`} key={label}><span>{createElement(icon, { size: 21, strokeWidth: 1.5 })}</span><span>{label}</span></div>)}</div>
    </div>
  </div>;
}

export default function FeatureMotion() {
  const section = useRef(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [replay, setReplay] = useState(0);
  const [environment, setEnvironment] = useState(() => ({ visible: false, hidden: typeof document !== "undefined" && document.hidden, reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setEnvironment(value => ({ ...value, hidden: document.hidden }));
    const preference = () => setEnvironment(value => ({ ...value, reduced: media.matches }));
    const observer = new IntersectionObserver(entries => setEnvironment(value => ({ ...value, visible: entries[0].isIntersecting })), { threshold: .15 });
    observer.observe(section.current);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); media.removeEventListener("change", preference); };
  }, []);
  const running = environment.visible && !environment.hidden && !environment.reduced && !paused && !finished;
  const playback = () => {
    if (finished) { setReplay(value => value + 1); setFinished(false); setPaused(false); }
    else setPaused(value => !value);
  };
  const complete = event => {
    if (event.animationName === "smk-flow-branch" && event.target.classList.contains("smk-flow-signal-3")) setFinished(true);
  };
  const playbackLabel = environment.reduced ? "Animaciones desactivadas por movimiento reducido" : finished ? "Repetir animaciones de flujos" : paused ? "Reanudar animaciones de flujos" : "Pausar animaciones de flujos";
  return <section className="smk-section smk-container smk-feature-motion" ref={section} aria-labelledby="smk-motion-title" data-running={running} onAnimationEnd={complete}>
    <div className="smk-section-heading"><h2 id="smk-motion-title">Menos trabajo disperso.<br />Más contexto para avanzar.</h2><p>De una consulta al panorama del equipo. Así se conecta el trabajo en Stratos AI.</p></div>
    <div className="smk-motion-grid">{flows.map(flow => <article className="smk-motion-card" key={flow.id}>
      <h3>{flow.title.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h3>
      <p>{flow.description}</p><FlowDiagram flow={flow} key={replay} /><a href="#modulos">{flow.link}<ArrowRight size={16} aria-hidden="true" /></a>
    </article>)}</div>
    <div className="smk-motion-footer"><p>Flujos ilustrativos. Disponibilidad según los permisos y la configuración de cada empresa.</p><button type="button" disabled={environment.reduced} aria-pressed={paused} onClick={playback} aria-label={playbackLabel}>{paused || finished || environment.reduced ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span>{environment.reduced ? "Movimiento reducido" : finished ? "Repetir animación" : paused ? "Reanudar animación" : "Pausar animación"}</span></button></div>
  </section>;
}
