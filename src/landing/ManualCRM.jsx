import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Search, X, ChevronDown, ChevronRight, Lightbulb, AlertTriangle, Menu, Moon, Sun, Printer, Link as LinkIcon, ExternalLink, Check, Clock, MapPin, ShieldCheck, Home, Users, UsersRound, Layers, NotebookPen, CalendarDays, Bot, FolderOpen, CalendarRange, MessageCircle, MessagesSquare, Building2, Hexagon, Wallet, BarChart3, Megaphone, HardDrive, Send, Settings, LifeBuoy, LayoutGrid, Zap } from 'lucide-react';
import { P, LP, font } from '../design-system/tokens';
import { CATEGORIES, MANUAL_SECTIONS, MANUAL_REVIEWED_AT, searchManual, exposeManualToWindow } from './manual-content';
import './ManualCRM.css';

const APP_URL = 'https://app.stratoscapitalgroup.com';
const ICONS = { Home, Users, UsersRound, Layers, NotebookPen, CalendarDays, Bot, FolderOpen, CalendarRange, MessageCircle, MessagesSquare, Building2, Hexagon, Wallet, BarChart3, Megaphone, HardDrive, Send, Settings, LifeBuoy, LayoutGrid, Zap };
const categoryIcon = name => ICONS[name] || BookOpen;
const isSafeLink = url => typeof url === 'string' && (/^\/(?!\/)/.test(url) || /^(https:\/\/|mailto:)/.test(url));
function SectionLink({ section, onSelect, children, className = '' }) {
  if (!section) return null;
  return <a className={className} href={'#' + section.id} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onSelect(section.id);
  }}>{children || section.title}</a>;
}
function ContentBlock({ block, sections, categories, onSelect }) {
  if (block.type === 'p') return <p>{block.text}</p>;
  if (block.type === 'heading') return <h2>{block.text}</h2>;
  if (block.type === 'steps') return <ol className="mn-steps">{block.items.map((text,index) => <li key={index}><span className="mn-step-number" aria-hidden="true">{index + 1}</span><span>{text}</span></li>)}</ol>;
  if (block.type === 'list') return <ul className="mn-list">{block.items.map((text,index) => <li key={index}>{text}</li>)}</ul>;
  if (block.type === 'tip' || block.type === 'warn') {
    const Icon = block.type === 'tip' ? Lightbulb : AlertTriangle;
    return <aside className={'mn-callout mn-' + block.type}><Icon size={20} aria-hidden="true"/><div><strong>{block.type === 'tip' ? 'Para tener en cuenta' : 'Antes de continuar'}</strong><p>{block.text}</p></div></aside>;
  }
  if (block.type === 'ex') return <section className="mn-examples" aria-label="Ejemplos"><h2>Así puedes pedirlo</h2>{block.items.map((text,index) => <blockquote key={index}>{text}</blockquote>)}</section>;
  if (block.type === 'flow') return <ol className="mn-steps">{block.items.map((item,index) => <li key={index}><span className="mn-step-number" aria-hidden="true">{item.n || index + 1}</span><span><strong>{item.title}</strong><br/>{item.text}</span></li>)}</ol>;
  if (block.type === 'links') return <section className="mn-related"><h2>Continúa con estas guías</h2><div>{block.ids.map(id => <SectionLink key={id} section={sections.find(s => s.id === id)} onSelect={onSelect}><span>{sections.find(s => s.id === id)?.title}</span><ArrowRight size={17} aria-hidden="true"/></SectionLink>)}</div></section>;
  if (block.type === 'link' && isSafeLink(block.url)) return <a className="mn-external" href={block.url} {...(block.url.startsWith('https://') ? {target:'_blank', rel:'noopener noreferrer'} : {})}>{block.text}<ExternalLink size={16} aria-hidden="true"/></a>;
  if (block.type === 'directory') return <div className="mn-directory">{categories.filter(c => c.id !== 'funciones').map(cat => {
    const items = sections.filter(s => s.category === cat.id); const Icon = categoryIcon(cat.icon);
    if (!items.length) return null;
    return <section key={cat.id}><div className="mn-directory-heading"><Icon size={23} aria-hidden="true"/><h2>{cat.label}</h2><span>{items.length} guías</span></div><div>{items.map(s => <SectionLink key={s.id} section={s} onSelect={onSelect}><span>{s.title}</span><ChevronRight size={16} aria-hidden="true"/></SectionLink>)}</div></section>;
  })}</div>;
  return null;
}

export default function ManualCRM({ sections = MANUAL_SECTIONS, categories = CATEGORIES, search = searchManual, navLabel = 'Manual de Stratos', docTitle = 'Manual de Stratos AI · Guía completa', docDesc = 'Aprende a usar Stratos AI: CRM, Agenda, Equipos, Copilot, Space, WhatsApp, proyectos, portafolios y administración. Guías paso a paso.', footerLabel, waNumber = '17479779711', waText = 'Hola, necesito ayuda con Stratos AI' } = {}) {
  const [query,setQuery] = useState('');
  const [activeId,setActiveId] = useState(() => sections.find(s => s.id === window.location.hash.slice(1))?.id || sections[0]?.id);
  const [menuOpen,setMenuOpen] = useState(false);
  const [light,setLight] = useState(false);
  const [copied,setCopied] = useState(false);
  const [expanded,setExpanded] = useState(() => [sections.find(s=>s.id===window.location.hash.slice(1))?.category || sections[0]?.category]);
  const searchRef = useRef(null); const titleRef = useRef(null); const copyTimer = useRef(null);
  const isMain = sections === MANUAL_SECTIONS;
  const current = sections.find(s => s.id === activeId) || sections[0];
  const category = categories.find(c => c.id === current?.category);
  const filtered = useMemo(() => search(query), [query,search]);
  const grouped = useMemo(() => new Map(categories.map(c => [c.id, sections.filter(s => s.category === c.id)])), [categories,sections]);
  const currentIndex = sections.indexOf(current);
  const T = light ? LP : P;
  const theme = { '--mn-bg': T.bg, '--mn-panel': T.surface, '--mn-inset': T.glass, '--mn-hover': T.glassH, '--mn-text': T.txt, '--mn-muted': T.txt2, '--mn-border': T.border, '--mn-accent': T.accent, '--mn-accent-soft': T.accentS, '--mn-accent-border': T.accentB, '--mn-on-accent': T.onAccent, '--mn-danger': T.rose, fontFamily: font, colorScheme: light ? 'light' : 'dark' };
  const primaryId = isMain ? 'fn-indice' : sections[0]?.id;
  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.querySelector('meta[name="description"]');
    const previousDescription = existing?.getAttribute('content');
    const meta = existing || document.createElement('meta'); meta.name = 'description'; meta.content = docDesc;
    if (!existing) document.head.appendChild(meta);
    document.title = docTitle;
    exposeManualToWindow(sections,categories,search);
    return () => { document.title = previousTitle; if (!existing) meta.remove(); else if (previousDescription !== null) meta.setAttribute('content', previousDescription); };
  }, [docTitle,docDesc,sections,categories,search]);
  useEffect(() => {
    const sync = () => { const id = window.location.hash.slice(1); if (!id || sections.some(s => s.id === id)) { const nextId = id || sections[0]?.id; setActiveId(nextId);setQuery('');setMenuOpen(false);setExpanded(prev => [...new Set([...prev, sections.find(s=>s.id===nextId)?.category])]); } };
    window.addEventListener('popstate',sync); window.addEventListener('hashchange',sync);
    return () => {window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync);};
  }, [sections]);
  useEffect(() => { if (!menuOpen) return; const onKey = e => { if(e.key === 'Escape') setMenuOpen(false); }; window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey); }, [menuOpen]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const select = id => {
    setActiveId(id); setQuery(''); setMenuOpen(false); setCopied(false);
    setExpanded(prev => [...new Set([...prev, sections.find(s => s.id === id)?.category])]);
    if (window.location.hash !== '#' + id) window.history.pushState(null,'','#' + id);
    requestAnimationFrame(() => {titleRef.current?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});});
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#' + current.id); setCopied(true); clearTimeout(copyTimer.current); copyTimer.current=setTimeout(()=>setCopied(false),2500); }
    catch { setCopied(false); }
  };
  const renderBlock = (block,index) => <ContentBlock key={index} block={block} sections={sections} categories={categories} onSelect={select}/>;
  const wordCount = current ? JSON.stringify(current.content).split(/\s+/).length : 0;
  const featured = isMain ? ['agenda-crear','equipos-usuarios','copilot-registrar','fn-indice'] : sections.slice(0,4).map(s=>s.id);
  return <div className="mn-wrap" data-theme={light ? 'light' : 'dark'} style={theme}>
    <a className="mn-skip" href="#mn-content">Saltar al contenido</a>
    <header className="mn-nav"><div className="mn-nav-inner">
      <a className="mn-brand" href="https://stratoscapitalgroup.com"><img src="/branding/stratos-logo-web-20261016.webp" alt="" width="38" height="38"/><span>Stratos <span>AI</span></span></a>
      <span className="mn-nav-label">{navLabel}</span>
      <div className="mn-nav-actions"><button className="mn-icon-button" type="button" aria-label={light ? 'Usar tema oscuro' : 'Usar tema claro'} onClick={()=>setLight(v=>!v)}>{light ? <Moon size={19}/> : <Sun size={19}/>}</button><a className="mn-app-link" href={APP_URL}>Ir al sistema<ArrowRight size={16}/></a></div>
    </div></header>
    <div className="mn-mobile-bar"><button type="button" aria-expanded={menuOpen} aria-controls="mn-sidebar" onClick={()=>setMenuOpen(v=>!v)}><Menu size={19}/>Temas<ChevronDown size={16}/></button><span>{category?.label || 'Manual'}</span></div>
    <div className="mn-shell">
      <aside className={'mn-sidebar ' + (menuOpen ? 'mn-open' : '')} id="mn-sidebar" aria-label="Temas del manual">
        <div className="mn-sidebar-heading"><BookOpen size={17}/><span>Guía de uso</span><button className="mn-mobile-close mn-icon-button" type="button" aria-label="Cerrar temas" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
        <label className="mn-search" htmlFor="mn-search"><Search size={18} aria-hidden="true"/><input ref={searchRef} id="mn-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Buscar en todo el manual" onKeyDown={e=>{if(e.key==='Enter'&&query.trim()){setMenuOpen(false);titleRef.current?.focus();}}} placeholder="Buscar en todo el manual" autoComplete="off" spellCheck={false}/>{query && <button type="button" aria-label="Limpiar búsqueda" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={18}/></button>}</label>
        <p className="mn-search-help">Busca una función o una duda.</p>
        {query.trim()&&<button type="button" className="mn-button mn-mobile-results" onClick={()=>{setMenuOpen(false);titleRef.current?.focus();}}>Ver {filtered.length} resultados</button>}
        <nav className="mn-topics" aria-label="Índice del manual">
          <SectionLink section={sections.find(s=>s.id===primaryId)} onSelect={select} className="mn-all-link"><LayoutGrid size={17}/> {isMain ? 'Ver todas las funciones' : 'Empezar a leer'}<ArrowRight size={15}/></SectionLink>
          {categories.map(cat=>{const items=grouped.get(cat.id)||[];if(!items.length)return null;const Icon=categoryIcon(cat.icon); const open=expanded.includes(cat.id);
            return <details className="mn-topic" key={cat.id} open={open}><summary onClick={e=>{e.preventDefault();setExpanded(prev=>prev.includes(cat.id)?prev.filter(id=>id!==cat.id):[...prev,cat.id]);}}><Icon size={17}/><span>{cat.label}</span><small>{items.length}</small><ChevronDown size={14}/></summary><div>{items.map(s=><SectionLink key={s.id} section={s} onSelect={select} className={'mn-topic-link '+(s.id===current?.id?'mn-active':'')}><span aria-current={s.id===current?.id?'page':undefined}>{s.title}</span></SectionLink>)}</div></details>;
          })}
        </nav><div className="mn-sidebar-footer"><ShieldCheck size={16}/><span>Las funciones disponibles dependen de tu empresa y tus permisos.</span></div>
      </aside>
      <main id="mn-content" className="mn-content" tabIndex={-1}>
        {query.trim() ? <section className="mn-results" aria-labelledby="mn-title"><div className="mn-eyebrow">Búsqueda en el manual</div><h1 ref={titleRef} tabIndex={-1} id="mn-title">Resultados para «{query}»</h1><p role="status">{filtered.length} {filtered.length===1?'guía encontrada':'guías encontradas'}</p><div className="mn-result-list">{filtered.map(s=><SectionLink key={s.id} section={s} onSelect={select}><small>{categories.find(c=>c.id===s.category)?.label}</small><h2>{s.title}</h2><p>{s.summary}</p><ArrowRight size={19}/></SectionLink>)}</div>{!filtered.length&&<div className="mn-no-results"><Search size={28}/><h2>Prueba con otras palabras</h2><p>Por ejemplo: agenda, equipos, audio, teléfono o cambiar etapa.</p><button type="button" className="mn-button" onClick={()=>{setQuery('');searchRef.current?.focus();}}>Limpiar búsqueda</button></div>}</section> : current && <>
          <div className="mn-breadcrumb"><button type="button" onClick={()=>select(sections[0]?.id)}>Manual</button><ChevronRight size={14}/><span>{category?.label}</span></div>
          <div className="mn-article-tools"><span><Clock size={14}/>{Math.max(1,Math.ceil(wordCount/180))} min de lectura</span><div><button className="mn-icon-button" type="button" onClick={copyLink} aria-label={copied?'Enlace copiado':'Copiar enlace de esta guía'}>{copied?<Check size={17}/>:<LinkIcon size={17}/>}</button><button className="mn-icon-button" type="button" onClick={()=>window.print()} aria-label="Imprimir manual completo"><Printer size={17}/></button></div></div>
          <div className="mn-eyebrow">{isMain && current.id==='guia-inicio'?'Aprende a tu ritmo':category?.label}</div>
          <h1 id="mn-title" tabIndex={-1} ref={titleRef}>{current.title}</h1>
          <p className="mn-summary">{current.summary}</p>
          {current.id==='guia-inicio' && <div className="mn-featured">{featured.map(id=>{const s=sections.find(s=>s.id===id); const cat=categories.find(c=>c.id===s?.category); const Icon=categoryIcon(cat?.icon); return <SectionLink key={id} section={s} onSelect={select}><Icon size={22}/><strong>{id==='fn-indice'?'Todas las funciones':cat?.label}</strong><span>{id==='fn-indice'?'Explora el manual completo':s?.summary}</span><ArrowRight size={17}/></SectionLink>;})}</div>}
          {(current.where||current.access)&&<dl className="mn-context">{current.where&&<div><dt><MapPin size={16}/>Dónde está</dt><dd>{current.where}</dd></div>}{current.access&&<div><dt><ShieldCheck size={16}/>Quién puede usarlo</dt><dd>{current.access}</dd></div>}</dl>}
          <article className="mn-article" aria-label={current.title}>{current.content.map(renderBlock)}</article>
          <nav className="mn-prev-next" aria-label="Más guías">{currentIndex>0?<SectionLink section={sections[currentIndex-1]} onSelect={select}><ArrowLeft size={18}/><span><small>Guía anterior</small>{sections[currentIndex-1].title}</span></SectionLink>:<div/>}{currentIndex<sections.length-1&&<SectionLink section={sections[currentIndex+1]} onSelect={select}><span><small>Siguiente guía</small>{sections[currentIndex+1].title}</span><ArrowRight size={18}/></SectionLink>}</nav>
          <section className="mn-help"><LifeBuoy size={24}/><div><h2>¿Necesitas una mano?</h2><p>Tu administrador puede ayudarte con accesos y configuración. Para una falla, envía la hora, la pantalla y lo que intentabas hacer.</p><div><a href={'https://wa.me/'+waNumber+'?text='+encodeURIComponent(waText)} target="_blank" rel="noopener noreferrer">Soporte por WhatsApp<ExternalLink size={14}/></a><a href="mailto:info@stratoscapitalgroup.com">Escribir por correo<ArrowRight size={14}/></a></div></div></section>
        </>}
        <footer className="mn-footer"><span>{footerLabel || (isMain ? 'Revisado el 23 de noviembre de 2026' : navLabel)}</span><a href="https://stratoscapitalgroup.com">Stratos AI</a>{isMain&&<time dateTime={MANUAL_REVIEWED_AT}>Guía v3.0</time>}</footer>
      </main>
    </div>
    <div className="mn-print"><h1>{navLabel}</h1>{isMain&&<p>Revisado el 23 de noviembre de 2026 · stratoscapitalgroup.com/manual</p>}{sections.filter(s=>!s.id.startsWith('fn-')).map(s=><section key={s.id}><h2>{s.title}</h2><p>{s.summary}</p>{s.where&&<p><strong>Dónde:</strong> {s.where}</p>}{s.access&&<p><strong>Acceso:</strong> {s.access}</p>}{s.content.filter(b=>!['links','directory'].includes(b.type)).map(renderBlock)}</section>)}</div>
  </div>;
}
