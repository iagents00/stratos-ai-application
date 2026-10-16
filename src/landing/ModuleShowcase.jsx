import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { createModuleRotation, moduleIndexForKey, SHOWCASE_MODULES } from "./module-showcase.mjs";
import "./ModuleShowcase.css";

export default function ModuleShowcase({ appUrl = "/login" }) {
  const id = useId();
  const region = useRef(null);
  const tabList = useRef(null);
  const tabs = useRef([]);
  const rotation = useRef(null);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  const [state, setState] = useState({ index: 0, paused: true, reducedMotion: false });
  const [missingImages, setMissingImages] = useState([]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const controller = createModuleRotation({
      count: SHOWCASE_MODULES.length,
      pauseReasons: ["outside", ...(document.hidden ? ["hidden"] : []), ...(media?.matches ? ["reduced-motion"] : []), ...(pointerInside.current ? ["hover"] : []), ...(focusInside.current ? ["focus"] : [])],
      onUpdate: setState,
    });
    rotation.current = controller;
    const visibility = () => controller.setPaused("hidden", document.hidden);
    const motion = event => controller.setPaused("reduced-motion", event.matches);
    document.addEventListener("visibilitychange", visibility);
    if (media?.addEventListener) media.addEventListener("change", motion);
    else media?.addListener?.(motion);
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === region.current);
      if (entry) controller.setPaused("outside", !entry.isIntersecting || entry.intersectionRatio < .2);
    }, { threshold: [0, .2] }) : null;
    if (observer && region.current) observer.observe(region.current);
    // Browsers without observation keep manual navigation available and avoid
    // playing a carousel that may be outside the viewport.
    return () => {
      observer?.disconnect(); controller.destroy(); rotation.current = null;
      document.removeEventListener("visibilitychange", visibility);
      if (media?.removeEventListener) media.removeEventListener("change", motion);
      else media?.removeListener?.(motion);
    };
  }, []);

  useEffect(() => {
    const list = tabList.current;
    const selected = tabs.current[state.index];
    if (!list || !selected || list.scrollWidth <= list.clientWidth) return;
    const left = selected.offsetLeft - list.offsetLeft - (list.clientWidth - selected.offsetWidth) / 2;
    list.scrollTo({ left, behavior: state.reducedMotion || focusInside.current ? "auto" : "smooth" });
  }, [state.index, state.reducedMotion]);

  const selectModule = (index, focus = false) => {
    rotation.current?.select(index);
    if (focus) tabs.current[index]?.focus();
  };
  const onTabKey = (event, index) => {
    const next = moduleIndexForKey(index, event.key, SHOWCASE_MODULES.length);
    if (next === null) return;
    event.preventDefault(); selectModule(next, true);
  };
  const setHover = value => { pointerInside.current = value; rotation.current?.setPaused("hover", value); };
  const setFocus = value => { focusInside.current = value; rotation.current?.setPaused("focus", value); };

  return <section id="modulos" ref={region} className="stratos-modules" aria-labelledby={`${id}-title`} aria-roledescription="carrusel"
    onPointerEnter={event => { if (event.pointerType !== "touch") setHover(true); }} onPointerLeave={() => setHover(false)}
    onPointerDownCapture={() => setFocus(false)} onKeyDownCapture={() => setFocus(true)}
    onFocusCapture={event => setFocus(event.target.matches(":focus-visible"))} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false); }}>
    <div className="stratos-modules__heading"><h2 id={`${id}-title`}>Toda tu operación, conectada.</h2><p>Explora los espacios de Stratos para trabajar, dar seguimiento y decidir.</p></div>
    <div className="stratos-modules__navigation">
      <div className="stratos-modules__tabs" role="tablist" aria-label="Módulos de Stratos" aria-orientation="horizontal" ref={tabList}>
        {SHOWCASE_MODULES.map((module, index) => <button type="button" key={module.id} ref={element => { tabs.current[index] = element; }} role="tab"
          id={`${id}-tab-${module.id}`} aria-controls={`${id}-panel-${module.id}`} aria-selected={state.index === index} tabIndex={state.index === index ? 0 : -1}
          className="stratos-modules__tab" onClick={() => selectModule(index)} onKeyDown={event => onTabKey(event, index)}>{module.name}</button>)}
      </div>
    </div>
    <div className="stratos-modules__panels" aria-live="off">
      {SHOWCASE_MODULES.map((module, index) => <div key={module.id} id={`${id}-panel-${module.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${module.id}`}
        className="stratos-modules__panel" hidden={state.index !== index} tabIndex={0}>
        <div className="stratos-modules__intro"><h3>{module.title}</h3><p>{module.description}</p></div>
        <figure className="stratos-modules__visual">
          {missingImages.includes(module.id) ? <div className="stratos-modules__image-fallback">Vista previa de {module.name}</div>
            : <img src={`/marketing/modules/framed-20261016/${module.id}.webp`} alt={`Captura real del módulo ${module.name} de Stratos AI con marco translúcido y datos de demostración`} width={1440} height={1020}
              loading={index === 0 ? "eager" : "lazy"} decoding="async" onError={() => setMissingImages(current => current.includes(module.id) ? current : [...current, module.id])} />}
          <figcaption>Datos de demostración</figcaption>
        </figure>
        <div className="stratos-modules__details"><ul>{module.capabilities.map(([title, description]) => <li key={title}><Check size={17} aria-hidden="true" /><div><h4>{title}</h4><p>{description}</p></div></li>)}</ul><a className="stratos-modules__link" href={appUrl}>Conocer Stratos<ArrowUpRight size={17} aria-hidden="true" /></a></div>
      </div>)}
    </div>
    <p className="stratos-modules__disclosure">Capturas reales de Stratos AI con datos de demostración. Los módulos y conexiones disponibles dependen de la configuración de tu empresa.</p>
  </section>;
}
