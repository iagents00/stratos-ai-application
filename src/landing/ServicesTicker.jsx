import { useEffect, useRef, useState } from "react";
import "./ServicesTicker.css";

const services = ["Call Center + IA", "Marketing + IA", "CRM Inteligente", "Equipos de iAgents", "Avatars de IA", "ERPs Autónomos", "Automatización comercial", "Reportes en tiempo real"];

export default function ServicesTicker() {
  const region = useRef(null);
  const [motion, setMotion] = useState({ running: false, static: true });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let enabled = false;
    try { enabled = localStorage.getItem("stratos.marketing.meteors") === "enabled"; } catch { /* Respect system preference when storage is unavailable. */ }
    const update = () => {
      const isStatic = (media.matches && !enabled) || document.documentElement.hasAttribute("data-lowfx");
      setMotion({ static: isStatic, running: visible && !document.hidden && !isStatic });
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }, { threshold: .05 });
    observer.observe(region.current);
    const safeMode = new MutationObserver(update);
    safeMode.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lowfx"] });
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); safeMode.disconnect(); media.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  return <div className="smk-service-flow" ref={region} role="region" aria-label="Soluciones de Stratos AI" tabIndex={0} data-running={motion.running} data-static={motion.static}>
    <div className="smk-service-flow-track" data-brand-motion="true" style={{ "--service-motion": "smk-services-travel 44s linear infinite", animation: "var(--service-motion)", animationPlayState: "var(--service-play)" }}>
      {[0, 1].map(copy => <div className="smk-service-flow-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>{services.map(service => <span key={service}>{service}</span>)}</div>)}
    </div>
  </div>;
}
