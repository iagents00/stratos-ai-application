/**
 * ManualCRM.jsx — Manual del CRM Stratos AI para asesores
 *
 * URL pública (sin login): stratoscapitalgroup.com/manual o /manual-crm
 * Audiencia: asesores y operadores del CRM (uso diario).
 * Tono: instructivo paso-a-paso, coloquial.
 *
 * Estructura:
 *   - Sidebar izquierdo con categorías y buscador.
 *   - Contenido central con la sección activa.
 *   - Placeholder de "Asistente IA — próximamente" (para conectar agente futuro).
 *
 * Datos en src/landing/manual-content.js — se exponen en window.__STRATOS_MANUAL__
 * para que un agente IA embebido los consuma.
 */
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, ArrowRight, Search, Sparkles, Bot, X,
  ChevronRight, Lightbulb, AlertTriangle, Mail, MessageCircle,
  // Iconos usados por las secciones (importados aquí para que esté en bundle)
  LogIn, KeyRound, Layout, UserPlus, FileSearch, MoveRight, Workflow,
  NotebookPen, CheckSquare, History, UserCheck, ShieldCheck,
  LayoutDashboard, Send, HelpCircle, AlertCircle, Users, Layers,
  FileText, UsersRound, LineChart, LifeBuoy,
} from "lucide-react";
import { CATEGORIES, MANUAL_SECTIONS, searchManual, exposeManualToWindow } from "./manual-content";

/* ═══════════════════════════════════════════════════════════════════════════
   PALETA — coherente con DeliveryHubCRM, LandingMarketing, PrivacyPolicy
   ═══════════════════════════════════════════════════════════════════════════ */
const P = {
  bg:       "#04080F",
  surface:  "#080D17",
  glass:    "rgba(255,255,255,0.028)",
  glassH:   "rgba(255,255,255,0.048)",
  border:   "rgba(255,255,255,0.06)",
  borderH:  "rgba(255,255,255,0.12)",
  accent:   "#52D9B8",
  accentS:  "rgba(82,217,184,0.07)",
  accentB:  "rgba(82,217,184,0.13)",
  accentG:  "linear-gradient(135deg, #52D9B8 0%, #34C49C 100%)",
  amber:    "#F0C674",
  amberS:   "rgba(240,198,116,0.08)",
  amberB:   "rgba(240,198,116,0.22)",
  blue:     "#7EB8F0",
  blueS:    "rgba(126,184,240,0.08)",
  blueB:    "rgba(126,184,240,0.22)",
  rose:     "#E8818C",
  roseS:    "rgba(232,129,140,0.08)",
  roseB:    "rgba(232,129,140,0.22)",
  w:        "#FFFFFF",
  txt:      "#EDF2F7",
  txt2:     "#8A97AA",
  txt3:     "#3D4A5C",
  r:        14,
};
const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP_URL = "https://app.stratoscapitalgroup.com";

/* ═══════════════════════════════════════════════════════════════════════════
   ICONOS — mapa nombre → componente Lucide
   Permite usar icon: 'LogIn' como string en manual-content.js
   ═══════════════════════════════════════════════════════════════════════════ */
const ICON_MAP = {
  Sparkles, Users, Layers, FileText, UsersRound, LineChart,
  MessageCircle, LifeBuoy,
  LogIn, KeyRound, Layout, UserPlus, FileSearch, MoveRight, Workflow,
  NotebookPen, CheckSquare, History, UserCheck, ShieldUser: ShieldCheck,
  LayoutDashboard, Send, HelpCircle, AlertCircle,
};
const iconFor = (name) => ICON_MAP[name] || ChevronRight;

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = `
  .mn-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; }
  .mn-wrap *, .mn-wrap *::before, .mn-wrap *::after { box-sizing: border-box; }
  .mn-wrap a { color: ${P.accent}; text-decoration: none; }
  .mn-wrap a:hover { text-decoration: underline; }
  .mn-wrap h1, .mn-wrap h2, .mn-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.02em; margin: 0; }
  .mn-wrap p { margin: 0; line-height: 1.7; color: ${P.txt}; font-size: 15px; }
  .mn-wrap ::selection { background: ${P.accentB}; color: ${P.w}; }

  /* Top nav sticky */
  .mn-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(4,8,15,0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid ${P.border};
  }

  /* Layout grid */
  .mn-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    max-width: 1280px;
    margin: 0 auto;
    gap: 0;
  }
  @media (max-width: 900px) {
    .mn-shell { grid-template-columns: 1fr; }
    .mn-sidebar { position: static !important; height: auto !important; border-right: none !important; border-bottom: 1px solid ${P.border}; }
  }

  /* Sidebar */
  .mn-sidebar {
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    overflow-y: auto;
    border-right: 1px solid ${P.border};
    padding: 24px 16px;
    background: ${P.surface};
  }
  .mn-sidebar::-webkit-scrollbar { width: 6px; }
  .mn-sidebar::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 3px; }

  /* Sections list */
  .mn-cat-label {
    font-size: 11px; font-weight: 700; color: ${P.txt3};
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 14px 12px 8px;
    display: flex; align-items: center; gap: 8px;
  }
  .mn-link {
    display: block;
    padding: 9px 12px;
    border-radius: 9px;
    color: ${P.txt2};
    font-size: 13.5px;
    line-height: 1.4;
    transition: all 0.15s;
    border-left: 2px solid transparent;
    cursor: pointer;
    background: transparent;
    border-top: none; border-right: none; border-bottom: none;
    text-align: left;
    width: 100%;
    font-family: ${font};
  }
  .mn-link:hover {
    background: ${P.glass};
    color: ${P.w};
  }
  .mn-link.active {
    background: ${P.accentS};
    color: ${P.accent};
    border-left-color: ${P.accent};
    font-weight: 600;
  }

  /* Search */
  .mn-search {
    position: relative;
    margin-bottom: 18px;
  }
  .mn-search input {
    width: 100%;
    padding: 11px 14px 11px 38px;
    border-radius: 10px;
    background: ${P.glass};
    border: 1px solid ${P.border};
    color: ${P.txt};
    font-size: 13.5px;
    font-family: ${font};
    outline: none;
    transition: all 0.18s;
  }
  .mn-search input:focus {
    border-color: ${P.accentB};
    background: ${P.glassH};
  }
  .mn-search input::placeholder { color: ${P.txt3}; }
  .mn-search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: ${P.txt3};
    pointer-events: none;
  }
  .mn-search-clear {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: transparent; border: none; cursor: pointer;
    color: ${P.txt3};
    padding: 4px;
    display: flex; align-items: center;
    border-radius: 6px;
  }
  .mn-search-clear:hover { color: ${P.w}; background: ${P.glass}; }

  /* Content area */
  .mn-content {
    padding: 48px 56px 80px;
    max-width: 800px;
  }
  @media (max-width: 720px) {
    .mn-content { padding: 32px 20px 56px; }
  }

  .mn-eyebrow {
    font-size: 11px; font-weight: 700; color: ${P.accent};
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 12px;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .mn-title {
    font-size: clamp(28px, 4vw, 36px);
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 14px;
  }
  .mn-summary {
    font-size: 16.5px;
    color: ${P.txt2};
    line-height: 1.6;
    margin-bottom: 32px;
  }

  /* Content blocks */
  .mn-block { margin-bottom: 18px; }
  .mn-block ol, .mn-block ul { padding-left: 24px; margin: 8px 0; }
  .mn-block ol li, .mn-block ul li {
    color: ${P.txt}; font-size: 15px; line-height: 1.7;
    margin-bottom: 6px;
  }
  .mn-block ol li::marker { color: ${P.accent}; font-weight: 700; }
  .mn-block ul li::marker { color: ${P.txt3}; }

  /* Callouts */
  .mn-callout {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 14px 18px;
    border-radius: 11px;
    margin: 18px 0;
    line-height: 1.6;
    font-size: 14px;
  }
  .mn-callout-tip {
    background: ${P.blueS};
    border: 1px solid ${P.blueB};
    color: ${P.txt};
  }
  .mn-callout-tip .mn-callout-icon { color: ${P.blue}; }
  .mn-callout-warn {
    background: ${P.amberS};
    border: 1px solid ${P.amberB};
    color: ${P.txt};
  }
  .mn-callout-warn .mn-callout-icon { color: ${P.amber}; }
  .mn-callout-icon { flex-shrink: 0; margin-top: 2px; }

  /* AI Assistant card (placeholder) */
  .mn-ai-card {
    margin-top: 48px;
    padding: 24px;
    border-radius: 14px;
    background: linear-gradient(145deg, rgba(82,217,184,0.05) 0%, rgba(82,217,184,0.02) 100%);
    border: 1px solid ${P.accentB};
    position: relative;
    overflow: hidden;
  }
  .mn-ai-card::before {
    content: "";
    position: absolute;
    top: -40px; right: -40px;
    width: 160px; height: 160px;
    background: radial-gradient(circle, ${P.accentS} 0%, transparent 70%);
    pointer-events: none;
  }
  .mn-ai-input-row {
    display: flex; gap: 8px;
    margin-top: 14px;
    position: relative;
  }
  .mn-ai-input {
    flex: 1;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(0,0,0,0.25);
    border: 1px solid ${P.border};
    color: ${P.txt3};
    font-size: 14px;
    font-family: ${font};
    cursor: not-allowed;
  }
  .mn-ai-button {
    padding: 12px 18px;
    border-radius: 10px;
    background: ${P.glass};
    border: 1px solid ${P.border};
    color: ${P.txt3};
    font-weight: 600;
    cursor: not-allowed;
    font-family: ${font};
    font-size: 13px;
    display: inline-flex; align-items: center; gap: 6px;
  }

  /* Empty state */
  .mn-empty {
    text-align: center;
    padding: 80px 20px;
    color: ${P.txt2};
  }
  .mn-empty h3 { color: ${P.txt}; margin-bottom: 8px; font-size: 18px; }

  /* Footer */
  .mn-footer {
    border-top: 1px solid ${P.border};
    background: ${P.surface};
    padding: 32px 24px;
    color: ${P.txt2};
    font-size: 13px;
    margin-top: 60px;
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO
   ═══════════════════════════════════════════════════════════════════════════ */
function StratosAtom({ size = 22, color = P.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.2" opacity="0.32" />
      <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.2" opacity="0.62" />
      <circle cx="16" cy="16" r="1.5" fill={color} />
      <ellipse cx="16" cy="16" rx="10" ry="4" stroke={color} strokeWidth="1" opacity="0.25" transform="rotate(-35 16 16)" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDERER de bloques de contenido
   ═══════════════════════════════════════════════════════════════════════════ */
function ContentBlock({ block }) {
  if (block.type === 'p') {
    return <p className="mn-block">{block.text}</p>;
  }
  if (block.type === 'steps') {
    return (
      <div className="mn-block">
        <ol>
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      </div>
    );
  }
  if (block.type === 'list') {
    return (
      <div className="mn-block">
        <ul>
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      </div>
    );
  }
  if (block.type === 'tip') {
    return (
      <div className="mn-callout mn-callout-tip">
        <Lightbulb size={18} className="mn-callout-icon" />
        <div>{block.text}</div>
      </div>
    );
  }
  if (block.type === 'warn') {
    return (
      <div className="mn-callout mn-callout-warn">
        <AlertTriangle size={18} className="mn-callout-icon" />
        <div>{block.text}</div>
      </div>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ManualCRM() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(MANUAL_SECTIONS[0]?.id || "");

  // Resultados de búsqueda en vivo
  const filtered = useMemo(() => searchManual(query), [query]);

  // Sección activa = la del activeId, o la primera del filtrado si la activa no está
  const activeSection = useMemo(() => {
    return MANUAL_SECTIONS.find(s => s.id === activeId)
      || filtered[0]
      || MANUAL_SECTIONS[0];
  }, [activeId, filtered]);

  // Agrupar secciones por categoría para el sidebar (solo las que pasan el filtro)
  const sectionsByCategory = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) map[cat.id] = [];
    for (const s of filtered) {
      if (map[s.category]) map[s.category].push(s);
    }
    return map;
  }, [filtered]);

  // Setup inicial: title, meta, exponer manual a window
  useEffect(() => {
    document.title = "Manual del CRM · Stratos AI";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Manual operativo del CRM Stratos AI. Cómo agregar clientes, mover el pipeline, programar tareas y todo lo que tu equipo necesita para usar el sistema día a día."
    );
    document.documentElement.lang = "es";
    exposeManualToWindow();
  }, []);

  // Soportar deep-link via hash (#agregar-cliente-manual)
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (fromHash && MANUAL_SECTIONS.some(s => s.id === fromHash)) {
      setActiveId(fromHash);
    }
  }, []);

  // Actualizar hash al cambiar de sección (sin scroll)
  const selectSection = (id) => {
    setActiveId(id);
    if (window.history.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
    // En mobile, hacer scroll al contenido
    const main = document.querySelector('.mn-content');
    if (main && window.innerWidth < 900) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="mn-wrap">
      <style>{CSS}</style>

      {/* ─────────────── NAV ─────────────── */}
      <nav className="mn-nav">
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
        }}>
          <a href="https://stratoscapitalgroup.com" style={{
            display: "flex", alignItems: "center", gap: 9, color: P.w,
            fontWeight: 700, fontSize: 15, fontFamily: fontD, letterSpacing: "-0.01em",
          }}>
            <StratosAtom size={22} color={P.accent} />
            Stratos <span style={{ fontWeight: 300, opacity: 0.55 }}>AI</span>
            <span style={{
              marginLeft: 12, paddingLeft: 12, borderLeft: `1px solid ${P.border}`,
              fontSize: 13, fontWeight: 500, color: P.txt2, fontFamily: font,
            }}>Manual del CRM</span>
          </a>
          <a href={APP_URL} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10,
            background: "transparent", border: `1px solid ${P.border}`,
            color: P.txt, fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>
            Ir al sistema
            <ArrowRight size={13} />
          </a>
        </div>
      </nav>

      {/* ─────────────── SHELL ─────────────── */}
      <div className="mn-shell">
        {/* SIDEBAR */}
        <aside className="mn-sidebar">
          {/* Search */}
          <div className="mn-search">
            <Search size={16} className="mn-search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el manual..."
              autoComplete="off"
              spellCheck="false"
            />
            {query && (
              <button
                type="button"
                className="mn-search-clear"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lista por categoría */}
          {filtered.length === 0 ? (
            <div style={{ padding: "20px 12px", color: P.txt3, fontSize: 13, lineHeight: 1.6 }}>
              Sin resultados para "<span style={{ color: P.txt }}>{query}</span>".
              <br />
              Prueba con otras palabras o limpia la búsqueda.
            </div>
          ) : (
            CATEGORIES.map(cat => {
              const items = sectionsByCategory[cat.id] || [];
              if (items.length === 0) return null;
              const CatIcon = iconFor(cat.icon);
              return (
                <div key={cat.id}>
                  <div className="mn-cat-label">
                    <CatIcon size={12} color={P.txt3} />
                    {cat.label}
                  </div>
                  {items.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className={`mn-link ${activeId === s.id ? "active" : ""}`}
                      onClick={() => selectSection(s.id)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </aside>

        {/* CONTENT */}
        <main className="mn-content">
          {!activeSection ? (
            <div className="mn-empty">
              <h3>Sin sección seleccionada</h3>
              <p>Elige un tema del menú de la izquierda para empezar.</p>
            </div>
          ) : (
            <>
              <div className="mn-eyebrow">
                {(() => {
                  const cat = CATEGORIES.find(c => c.id === activeSection.category);
                  const Icon = iconFor(cat?.icon || 'ChevronRight');
                  return (
                    <>
                      <Icon size={12} />
                      {cat?.label || 'Manual'}
                    </>
                  );
                })()}
              </div>
              <h1 className="mn-title">{activeSection.title}</h1>
              <p className="mn-summary">{activeSection.summary}</p>

              <div>
                {activeSection.content.map((b, i) => (
                  <ContentBlock key={i} block={b} />
                ))}
              </div>

              {/* AI Assistant placeholder — listo para conectar agente futuro */}
              <div className="mn-ai-card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11,
                    background: P.accentS, border: `1px solid ${P.accentB}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Bot size={20} color={P.accent} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: P.w, fontWeight: 700, fontSize: 15, fontFamily: fontD }}>
                        Asistente del Manual
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 999,
                        background: P.amberS, color: P.amber,
                        border: `1px solid ${P.amberB}`,
                        fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>
                        Próximamente
                      </span>
                    </div>
                    <p style={{ color: P.txt2, fontSize: 13, marginTop: 2 }}>
                      Pronto vas a poder preguntarle al asistente cualquier duda en lenguaje natural.
                    </p>
                  </div>
                </div>
                <div className="mn-ai-input-row">
                  <input
                    type="text"
                    className="mn-ai-input"
                    placeholder="Pregúntale al asistente..."
                    disabled
                    aria-disabled="true"
                  />
                  <button type="button" className="mn-ai-button" disabled aria-disabled="true">
                    <Sparkles size={14} />
                    Preguntar
                  </button>
                </div>
                <p style={{ color: P.txt3, fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
                  El asistente leerá este manual y tu pregunta para darte la respuesta exacta paso-a-paso.
                  Mientras tanto, usa el buscador de la izquierda.
                </p>
              </div>

              {/* Quick contact */}
              <div style={{ marginTop: 32, padding: "20px 0", borderTop: `1px solid ${P.border}`,
                            display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: P.txt2, fontSize: 13 }}>
                  ¿No encuentras lo que buscas?
                </span>
                <a
                  href="https://wa.me/17479779711?text=Hola%2C%20necesito%20ayuda%20con%20el%20CRM%20Stratos%20AI"
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 600, color: P.accent,
                  }}
                >
                  <MessageCircle size={14} />
                  Pregunta por WhatsApp
                </a>
                <a
                  href="mailto:info@stratoscapitalgroup.com?subject=Soporte%20CRM%20Stratos%20AI"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 600, color: P.accent,
                  }}
                >
                  <Mail size={14} />
                  Escríbenos un correo
                </a>
              </div>
            </>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className="mn-footer">
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <StratosAtom size={18} color={P.accent} />
            <span style={{ color: P.txt2 }}>
              © {new Date().getFullYear()} Stratos Capital Group · Manual del CRM v1.0
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="/entrega-crm" style={{ color: P.txt2 }}>Entrega oficial</a>
            <a href="https://stratoscapitalgroup.com" style={{ color: P.txt2 }}>Sitio principal</a>
            <a href={APP_URL} style={{ color: P.accent, fontWeight: 600 }}>Ir al sistema →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
