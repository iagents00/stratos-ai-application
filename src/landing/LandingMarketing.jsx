import { createElement, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X, Pause, Play, Mic, MessageSquareText, BarChart3, PhoneCall, Users, Building2, Stethoscope, Cpu, ShieldCheck } from "lucide-react";
import ModuleShowcase from "./ModuleShowcase.jsx";
import { plans, faqs, rotatingWords, marketingLoginUrl } from "./marketing-content.js";
import "./LandingMarketing.css";

const contact = (message = "Hola, quiero solicitar acceso a Stratos AI") => `https://wa.me/17479779711?text=${encodeURIComponent(message)}`;
const navLinks = [["Solución", "#solución"], ["Características", "#modulos"], ["Precios", "#precios"], ["Enterprise", "#enterprise"], ["Nosotros", "#enterprise"]];
const services = ["Call Center + IA", "Marketing + IA", "CRM Inteligente", "Equipos de iAgents", "Avatars de IA", "ERPs Autónomos", "Automatización comercial", "Reportes en tiempo real"];


function Brand() {
  return <a className="smk-brand" href="#" aria-label="Stratos AI, inicio"><img src="/branding/stratos-logo-web-20261016.webp" width="40" height="40" alt="" /><span>Stratos <span>AI</span></span></a>;
}

function AccessButton({ message, children = "Solicitar acceso", secondary = false }) {
  return <a className={`smk-button${secondary ? " smk-secondary" : ""}`} href={contact(message)} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={17} aria-hidden="true" /></a>;
}

function Header({ loginUrl }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = event => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return <header className="smk-header"><nav className="smk-container smk-nav" aria-label="Navegación principal"><Brand /><div className="smk-desktop-links">{navLinks.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</div><div className="smk-nav-actions"><a href={loginUrl}>Iniciar sesión</a><AccessButton /></div><button ref={toggle} className="smk-menu-toggle" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="stratos-marketing-menu" aria-label={open ? "Cerrar menú" : "Abrir menú"}>{open ? <X size={22} /> : <Menu size={22} />}</button></nav>{open && <nav className="smk-mobile-menu" id="stratos-marketing-menu" aria-label="Menú móvil">{navLinks.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={16} aria-hidden="true" /></a>)}<a href={loginUrl}>Iniciar sesión<ArrowUpRight size={16} aria-hidden="true" /></a><AccessButton /></nav>}</header>;
}

function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval = null;
    let transition = null;
    const stop = () => { clearInterval(interval); clearTimeout(transition); interval = null; transition = null; setVisible(true); };
    const update = () => {
      stop();
      if (paused || media.matches || document.hidden) return;
      interval = setInterval(() => { setVisible(false); transition = setTimeout(() => { setIndex(value => (value + 1) % rotatingWords.length); setVisible(true); }, 180); }, 2600);
    };
    update();
    document.addEventListener("visibilitychange", update);
    media.addEventListener?.("change", update);
    return () => { clearInterval(interval); clearTimeout(transition); document.removeEventListener("visibilitychange", update); media.removeEventListener?.("change", update); };
  }, [paused]);
  return <div className="smk-hero-heading"><h1><span>Escalamos empresas con</span><span className={`smk-rotating-word${visible ? " is-visible" : ""}`} aria-hidden="true">{rotatingWords[index]}</span><span className="smk-sr-only">soluciones de inteligencia artificial</span></h1><button type="button" className="smk-headline-control" onClick={() => setPaused(value => !value)} aria-label={paused ? "Reanudar titular automático" : "Pausar titular automático"} aria-pressed={paused}>{paused ? <Play size={13} /> : <Pause size={13} />}</button></div>;
}

function Actions() {
  return <div className="smk-actions"><AccessButton /><a className="smk-button smk-secondary" href="/diagnostico">Iniciar diagnóstico<ArrowRight size={17} aria-hidden="true" /></a></div>;
}

function ServicesTicker() {
  return <div className="smk-service-strip" aria-label="Soluciones de Stratos AI"><div className="smk-ticker-track"><div>{services.map(service => <span key={service}>{service}</span>)}</div><div aria-hidden="true">{services.map(service => <span key={service}>{service}</span>)}</div></div></div>;
}

const workflow = [
  { label: "Habla", icon: Mic, title: "Empieza con una conversación.", text: "El asesor habla o escribe en lenguaje natural. Copilot ayuda a convertir el contexto en una propuesta de siguiente paso.", image: "copilot" },
  { label: "Procesa", icon: MessageSquareText, title: "El contexto encuentra su lugar.", text: "El CRM reúne clientes, etapas, notas y próximos seguimientos. La información queda conectada a la oportunidad.", image: "crm" },
  { label: "Claridad", icon: BarChart3, title: "Tu equipo ve lo importante.", text: "Comando reúne la cartera y la actividad registrada para revisar prioridades y dar dirección al equipo.", image: "comando" },
];

function WorkflowPreview() {
  const [step, setStep] = useState(0);
  const item = workflow[step];
  return <div className="smk-workflow"><div className="smk-workflow-tabs" aria-label="Flujo de trabajo">{workflow.map(({ label, icon }, index) => <button type="button" key={label} aria-pressed={step === index} onClick={() => setStep(index)}>{createElement(icon, { size: 17, "aria-hidden": true })}{label}</button>)}</div><div className="smk-workflow-stage"><img src={`/marketing/modules/framed-20261016/${item.image}.webp`} alt={`Captura real del módulo ${item.image} de Stratos AI con datos de demostración`} loading="lazy" width="1440" height="1020" /><div><h3>{item.title}</h3><p>{item.text}</p></div></div><p className="smk-caption">Capturas del sistema con datos de demostración.</p></div>;
}

function PricingCard({ plan }) {
  return <article className={`smk-price-card${plan.highlight ? " smk-featured" : ""}`}><div className="smk-plan-name"><h3>{plan.name}</h3>{plan.badge && <span>{plan.badge}</span>}</div><p className="smk-plan-description">{plan.desc}</p><p className="smk-price"><span>${plan.price}</span><span>USD/mes</span></p><p className="smk-regular-price">Regular: <s>${plan.regular}/mes</s></p><AccessButton secondary={!plan.highlight} message={`Hola, quiero conocer el plan ${plan.name} de Stratos AI`}>{plan.cta}</AccessButton><p className="smk-plan-users">{plan.users}</p><ul>{plan.features.map(feature => <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>)}</ul><p className="smk-plan-activation"><Check size={15} aria-hidden="true" />Implementación gratis este mes</p></article>;
}

export default function LandingMarketing({ appUrl = "/login" }) {
  const loginUrl = marketingLoginUrl(appUrl);
  useEffect(() => { document.body.classList.add("stratos-public-site"); return () => document.body.classList.remove("stratos-public-site"); }, []);
  return <div className="stratos-marketing"><a className="smk-skip-link" href="#marketing-main">Saltar al contenido</a><Header loginUrl={loginUrl} /><main id="marketing-main">
    <section className="smk-hero smk-container" aria-label="Stratos AI, sistema operativo comercial"><RotatingHeadline /><p>CRM, Copilot y agentes de IA para ordenar el seguimiento y darle claridad a tu equipo.</p><Actions /></section>
    <div className="smk-container smk-modules-wrap"><ModuleShowcase appUrl={loginUrl} /></div><ServicesTicker />
    <section className="smk-section smk-problem smk-container"><h2>El problema no es el CRM.<br />Es que nadie lo alimenta.</h2><p className="smk-section-intro">Tu equipo quiere vender. La dirección necesita claridad. El sistema debe ayudar a los dos.</p><div className="smk-problem-points"><p>El contexto se pierde entre WhatsApp, llamadas y memoria.</p><p>Los reportes llegan tarde porque alguien tiene que reconstruirlos.</p><p>El seguimiento depende de lo que cada persona recuerda.</p></div></section>
    <section id="solución" className="smk-section smk-solution"><div className="smk-container"><div className="smk-section-heading"><h2>El agente que hace que<br />el equipo sí registre.</h2><p>Hablar, registrar y decidir. Un flujo conectado para que la operación comercial avance con contexto.</p></div><WorkflowPreview /></div></section>
    <section className="smk-section smk-container smk-benefits"><div className="smk-section-heading"><h2>Lo que cambia en tu empresa.</h2><p>Una operación con más contexto y menos trabajo repetido.</p></div><div className="smk-benefit-grid"><article className="smk-benefit-visual"><img src="/marketing/modules/framed-20261016/mi-espacio.webp" alt="Agenda real de Mi Espacio, con datos de demostración" loading="lazy" width="1440" height="1020" /><div><h3>Menos fricción.</h3><p>Registrar, actualizar y reportar deja de sentirse como trabajo extra.</p></div></article><article className="smk-benefit-text"><h3>Más claridad.<br />Mejores siguientes pasos.</h3><p>La información se convierte en contexto, prioridad y seguimiento para tu equipo.</p><a href="#modulos">Explorar los módulos<ArrowRight size={18} aria-hidden="true" /></a></article><article className="smk-benefit-text smk-muted-panel"><h3>Dirección con<br />la operación a la vista.</h3><p>Lee el pipeline, la actividad por asesor y los hitos registrados en un mismo espacio.</p><a href="#modulos">Ver Comando<ArrowRight size={18} aria-hidden="true" /></a></article><article className="smk-benefit-visual"><img src="/marketing/modules/framed-20261016/metricas.webp" alt="Indicadores reales de Stratos AI, con datos de demostración" loading="lazy" width="1440" height="1020" /><div><h3>Seguimiento que se puede revisar.</h3><p>Observa la cartera y su actividad para detectar oportunidades de atención.</p></div></article></div></section>
    <section className="smk-call-center smk-container"><div><PhoneCall size={28} strokeWidth={1.5} aria-hidden="true" /><h2>Atención conectada.<br />Desde el primer contacto.</h2><p>Integra la atención, la calificación y el seguimiento comercial con soluciones de AI Call Center según las necesidades de tu empresa.</p><a className="smk-button smk-white" href="/diagnostico">Iniciar diagnóstico<ArrowRight size={17} aria-hidden="true" /></a></div><ul><li>Primer contacto y calificación de leads</li><li>Agendamiento y seguimiento</li><li>Contexto conectado al CRM</li><li>Configuración según tu operación</li></ul></section>
    <section id="sectores" className="smk-section smk-container smk-sectors"><h2>Diseñado para tu industria.</h2><div className="smk-sector-grid">{[{ icon: Building2, title: "Real Estate", text: "Brokers, inmobiliarias y desarrolladoras con seguimiento de leads y pipeline claro." },{ icon: Stethoscope, title: "Clínicas y salud", text: "Coordinadores, pacientes y atención al cliente con flujos de seguimiento precisos." },{ icon: Users, title: "Equipos comerciales", text: "Empresas con fuerza de ventas, leads y ciclos de seguimiento que controlar." },{ icon: Cpu, title: "Proyectos Enterprise", text: "IA, software, apps y ERP a medida para necesidades específicas." }].map(({ icon, title, text }) => <article key={title}>{createElement(icon, { size: 25, strokeWidth: 1.5, "aria-hidden": true })}<h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="precios" className="smk-section smk-pricing"><div className="smk-container"><div className="smk-section-heading"><h2>Empieza fácil.<br />Escala con claridad.</h2><p>Elige el acompañamiento que tu operación necesita.</p></div><div className="smk-promo"><strong>Oferta especial de lanzamiento</strong><p>Activación sin costo. Hasta 75% de descuento en planes seleccionados.</p><span>Vigente este mes para nuevos clientes.</span></div><div className="smk-price-grid">{plans.map(plan => <PricingCard key={plan.name} plan={plan} />)}</div><p className="smk-caption">Precios promocionales vigentes este mes para nuevos clientes. Al terminar el periodo, cada plan regresa a tarifa regular.</p></div></section>
    <section id="enterprise" className="smk-section smk-container smk-enterprise"><div><h2>Tu empresa es única.<br />Tu sistema puede serlo.</h2><p>Diseñamos proyectos de inteligencia artificial a medida: agentes, CRM, ERP, software, call centers y automatización comercial.</p><div className="smk-enterprise-services">{["AI Call Centers", "Marketing + IA", "Equipos de iAgents", "CRMs Inteligentes", "ERPs Autónomos", "Avatars de IA", "Software a medida", "Agentes autónomos"].map(service => <span key={service}>{service}</span>)}</div></div><div className="smk-enterprise-offer"><h3>Enterprise</h3><p>Inversión desde</p><p className="smk-enterprise-price">$1,200 <span>USD/mes</span></p><p>Implementación desde $5,000 USD</p><AccessButton message="Hola, quiero una propuesta Enterprise de Stratos AI">Solicitar propuesta</AccessButton><p className="smk-caption">Cotización personalizada según alcance e integraciones.</p></div></section>
    <section id="comparativa" className="smk-section smk-container smk-comparison"><h2>Una forma más natural de trabajar.</h2><p className="smk-section-intro">Del registro disperso a una operación con contexto.</p><div className="smk-comparison-table" role="region" aria-label="Comparativa de flujos de trabajo" tabIndex={0}><table><thead><tr><th scope="col">Tu operación</th><th scope="col">Flujo manual</th><th scope="col">Con Stratos AI</th></tr></thead><tbody>{[["Registro", "Formularios por completar", "Voz, texto y contexto conectado"],["Seguimiento", "Notas y canales separados", "Clientes, etapas y próxima acción"],["Visibilidad", "Información por reconstruir", "Cartera y actividad en un espacio"],["Adopción", "Otro sistema que alimentar", "Una conversación como punto de entrada"]].map(row => <tr key={row[0]}>{row.map((cell,index) => index === 0 ? <th key={cell} scope="row">{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div></section>
    <section className="smk-section smk-container smk-faq"><h2>Todo lo que necesitas saber.</h2><div>{faqs.map(({ q, a }) => <details key={q}><summary>{q}<ChevronDown size={19} aria-hidden="true" /></summary><p>{a}</p></details>)}</div></section>
    <section id="diagnostico" className="smk-section smk-container smk-close"><ShieldCheck size={28} strokeWidth={1.5} aria-hidden="true" /><h2>Ordena tu operación.<br />Dale espacio al crecimiento.</h2><p>Un diagnóstico sin compromiso para entender qué está frenando a tu equipo y qué se puede mejorar.</p><Actions /><a className="smk-close-login" href={loginUrl}>¿Ya tienes cuenta? Iniciar sesión<ArrowRight size={15} aria-hidden="true" /></a></section>
  </main><footer className="smk-footer"><div className="smk-container"><div className="smk-footer-top"><div><Brand /><p>Inteligencia aplicada a tu operación comercial.</p></div><nav aria-label="Navegación de pie de página"><a href="#solución">Solución</a><a href="#precios">Precios</a><a href="#enterprise">Enterprise</a><a href="#diagnostico">Diagnóstico</a><a href={loginUrl}>Iniciar sesión</a></nav></div><div className="smk-footer-bottom"><p>© {new Date().getFullYear()} Stratos AI</p><div><a href="/politica-de-privacidad">Aviso de privacidad</a><a href="/terminos-stratos-ai.html">Términos y condiciones</a></div></div></div></footer></div>;
}
