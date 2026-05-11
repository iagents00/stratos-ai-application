/**
 * DeliveryHubCRM.jsx — Hub de Entrega del CRM Stratos AI v1.0
 *
 * URL pública (sin login): stratoscapitalgroup.com/entrega-crm
 * Audiencia: socios y fundadores de Stratos (no-técnicos).
 * Tono: súper coloquial, sin jerga técnica.
 * Diseño: hereda paleta de LandingMarketing/PrivacyPolicy (verde menta #52D9B8).
 *
 * El componente es autocontenido: no importa primitives porque usan paleta P
 * de la app (#6EE7C2). Aquí necesitamos PL (#52D9B8) para coherencia con la
 * landing pública.
 */
import { useEffect } from "react";
import {
  ArrowRight, ArrowLeft, ChevronDown, CheckCircle2, Clock,
  Users, Database, MessageCircle, Bot, ShieldCheck, Zap,
  TrendingUp, FileText, Layers, Lock, Cloud, Mail,
  Layout, Building2, Wallet, BriefcaseBusiness, LineChart, Workflow,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   TOKENS DE DISEÑO — paleta landing (PL), verde menta más sobrio.
   Coherente con LandingMarketing.jsx y PrivacyPolicy.jsx
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
  rose:     "#E8818C",
  w:        "#FFFFFF",
  txt:      "#EDF2F7",
  txt2:     "#8A97AA",
  txt3:     "#3D4A5C",
  r:        14,
};
const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP_URL = "https://app.stratoscapitalgroup.com";
const WHATSAPP_URL = "https://wa.me/17479779711?text=Hola%2C%20necesito%20ayuda%20con%20el%20CRM%20Stratos%20AI";
const SUPPORT_EMAIL = "info@stratoscapitalgroup.com";

const CSS = `
  .dh-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; overflow-x: hidden; }
  .dh-wrap *, .dh-wrap *::before, .dh-wrap *::after { box-sizing: border-box; }
  .dh-wrap a:not(.dh-btn-primary):not(.dh-btn-secondary) { color: ${P.accent}; text-decoration: none; transition: opacity 0.2s; }
  .dh-wrap a:not(.dh-btn-primary):not(.dh-btn-secondary):hover { opacity: 0.85; }
  .dh-wrap .dh-btn-primary,
  .dh-wrap .dh-btn-secondary { text-decoration: none; }
  .dh-wrap h1, .dh-wrap h2, .dh-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.025em; margin: 0; }
  .dh-wrap p { margin: 0; line-height: 1.65; }
  .dh-wrap button { font-family: inherit; }

  /* Hero gradient bg */
  .dh-hero-bg {
    background-image:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(82,217,184,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(82,217,184,0.06) 0%, transparent 50%);
  }

  /* Animations on scroll */
  @keyframes dh-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .dh-reveal {
    opacity: 0;
    animation: dh-fadeUp 0.7s cubic-bezier(.2,.8,.2,1) forwards;
  }

  /* Container */
  .dh-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 24px;
  }
  @media (max-width: 720px) {
    .dh-container { padding: 0 18px; }
  }

  /* Cards grid */
  .dh-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .dh-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (max-width: 900px) {
    .dh-grid-3, .dh-grid-2 { grid-template-columns: 1fr; }
  }

  /* GlassCard inline (no usamos primitives porque usan paleta P de app) */
  .dh-glass {
    background: ${P.glass};
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid ${P.border};
    border-radius: ${P.r}px;
    padding: 24px;
    transition: all 0.3s cubic-bezier(.4,0,.2,1);
  }
  .dh-glass.dh-hover:hover {
    background: ${P.glassH};
    border-color: ${P.borderH};
    transform: translateY(-2px);
  }

  /* Pill */
  .dh-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: ${P.accentS};
    border: 1px solid ${P.accentB};
    color: ${P.accent};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dh-pill.dh-pill-soon {
    background: rgba(240,198,116,0.07);
    border-color: rgba(240,198,116,0.25);
    color: ${P.amber};
  }

  /* CTA buttons — alta legibilidad sobre cualquier fondo */
  .dh-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 15px 26px;
    border-radius: 12px;
    /* gradiente más oscuro hacia los bordes para resaltar texto */
    background: linear-gradient(135deg, #6FE7C6 0%, #34C49C 60%, #2BA882 100%);
    color: #021712;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.005em;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.4),
      inset 0 -1px 0 rgba(0,0,0,0.18),
      0 6px 20px rgba(82,217,184,0.32),
      0 2px 6px rgba(0,0,0,0.25);
    font-family: ${fontD};
  }
  .dh-btn-primary:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.5),
      inset 0 -1px 0 rgba(0,0,0,0.2),
      0 10px 28px rgba(82,217,184,0.44),
      0 3px 10px rgba(0,0,0,0.3);
  }
  .dh-btn-primary:active {
    transform: translateY(0);
    filter: brightness(0.96);
  }
  .dh-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 24px;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    color: ${P.w};
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.005em;
    text-decoration: none;
    border: 1px solid ${P.borderH};
    cursor: pointer;
    transition: all 0.2s;
    font-family: ${font};
  }
  .dh-btn-secondary:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.22);
    color: ${P.w};
    transform: translateY(-1px);
  }
  .dh-btn-secondary:active { transform: translateY(0); }

  /* Icon box */
  .dh-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: ${P.accentS};
    border: 1px solid ${P.accentB};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .dh-icon-box.amber {
    background: rgba(240,198,116,0.07);
    border-color: rgba(240,198,116,0.20);
  }

  /* Section spacing */
  .dh-section { padding: 80px 0; }
  .dh-section-eyebrow {
    font-size: 11px;
    font-weight: 700;
    color: ${P.accent};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .dh-section-title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    line-height: 1.15;
    margin-bottom: 14px;
  }
  .dh-section-sub {
    font-size: 16px;
    color: ${P.txt2};
    max-width: 640px;
    line-height: 1.6;
  }
  @media (max-width: 720px) {
    .dh-section { padding: 60px 0; }
  }

  /* Hero specific */
  .dh-hero-title {
    font-size: clamp(36px, 6vw, 64px);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.035em;
    margin-bottom: 20px;
  }
  .dh-hero-title .accent {
    background: linear-gradient(135deg, #FFFFFF 0%, ${P.accent} 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .dh-hero-sub {
    font-size: clamp(16px, 2vw, 19px);
    color: ${P.txt2};
    max-width: 580px;
    line-height: 1.55;
    margin-bottom: 36px;
  }
  .dh-hero-cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  /* KPI */
  .dh-kpi-value {
    font-family: ${fontD};
    font-size: clamp(36px, 5vw, 52px);
    font-weight: 300;
    color: ${P.w};
    letter-spacing: -0.035em;
    line-height: 1;
    margin-bottom: 8px;
  }
  .dh-kpi-label {
    font-size: 13px;
    color: ${P.txt2};
    line-height: 1.5;
  }
  .dh-kpi-tag {
    font-size: 10px;
    color: ${P.txt3};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 8px;
  }

  /* Feature card */
  .dh-feature-title {
    font-size: 17px;
    font-weight: 700;
    color: ${P.w};
    margin: 14px 0 8px;
    line-height: 1.3;
  }
  .dh-feature-desc {
    font-size: 14px;
    color: ${P.txt2};
    line-height: 1.6;
  }

  /* Sticky nav */
  .dh-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(4,8,15,0.78);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid ${P.border};
  }

  /* Footer */
  .dh-footer {
    border-top: 1px solid ${P.border};
    background: ${P.surface};
    padding: 40px 0;
    color: ${P.txt2};
    font-size: 13px;
  }

  /* Selection */
  .dh-wrap ::selection {
    background: ${P.accentB};
    color: ${P.w};
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO Stratos clásico (uso sutil en footer)
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
   PowerAtom — átomo potente para destacar marca y momentos importantes
   3 órbitas elípticas rotadas + núcleo radial brillante + 3 electrones
   ═══════════════════════════════════════════════════════════════════════════ */
function PowerAtom({ size = 16, color = P.accent }) {
  const uid = `pa-${size}-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%" stopColor={color}   stopOpacity="0.95" />
          <stop offset="100%" stopColor={color}  stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 3 órbitas a 0°, 60°, -60° */}
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.85" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.55" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.55" transform="rotate(-60 16 16)" />
      {/* Halo del núcleo */}
      <circle cx="16" cy="16" r="6" fill={`url(#${uid}-core)`} />
      {/* Núcleo sólido */}
      <circle cx="16" cy="16" r="2.6" fill={color} />
      {/* Electrones */}
      <circle cx="29"  cy="16"  r="1.7" fill={color} />
      <circle cx="9.5" cy="5.2" r="1.7" fill={color} />
      <circle cx="9.5" cy="26.8" r="1.7" fill={color} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DeliveryHubCRM() {
  // Title + meta para compartir el link
  useEffect(() => {
    document.title = "Entrega CRM · Stratos AI v1.0";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Stratos AI v1.0 — entrega oficial del módulo CRM. Pipeline inteligente, agentes IA y captura automática de leads. Listo para tu equipo hoy."
    );
    document.documentElement.lang = "es";
  }, []);

  // Smooth scroll a sección
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" });
  };

  return (
    <div className="dh-wrap">
      <style>{CSS}</style>

      {/* ─────────────── NAV ─────────────── */}
      <nav className="dh-nav">
        <div className="dh-container" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", gap: 16,
        }}>
          <a href="https://stratoscapitalgroup.com" style={{
            display: "flex", alignItems: "center", gap: 10, color: P.w,
            fontWeight: 700, fontSize: 15, fontFamily: fontD, letterSpacing: "-0.01em",
          }}>
            <PowerAtom size={22} color={P.accent} />
            Stratos <span style={{ fontWeight: 300, opacity: 0.55 }}>AI</span>
          </a>
          <a href={APP_URL} className="dh-btn-secondary" style={{ padding: "9px 16px", fontSize: 13 }}>
            Entrar al sistema
            <ArrowRight size={14} />
          </a>
        </div>
      </nav>

      {/* ─────────────── HERO ─────────────── */}
      <section className="dh-hero-bg" style={{ padding: "100px 0 60px", borderBottom: `1px solid ${P.border}` }}>
        <div className="dh-container">
          <div className="dh-reveal" style={{ animationDelay: "0.05s" }}>
            <span className="dh-pill" style={{ marginBottom: 24 }}>
              <PowerAtom size={14} color={P.accent} />
              Entrega oficial · Mayo 2026
            </span>
          </div>

          <h1 className="dh-hero-title dh-reveal" style={{ animationDelay: "0.15s" }}>
            Tu <span className="accent">CRM Stratos AI</span><br />
            está listo para tu equipo.
          </h1>

          <p className="dh-hero-sub dh-reveal" style={{ animationDelay: "0.25s" }}>
            La primera entrega de Stratos AI ya está en producción. Te explicamos en
            menos de 2 minutos qué construimos por ti, qué puedes hacer hoy mismo,
            y qué viene en las próximas entregas.
          </p>

          <div className="dh-hero-cta-row dh-reveal" style={{ animationDelay: "0.35s" }}>
            <a href={APP_URL} className="dh-btn-primary">
              Entrar al sistema
              <ArrowRight size={16} />
            </a>
            <button onClick={() => scrollTo("entregamos")} className="dh-btn-secondary">
              Ver qué te entregamos
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────── KPI ROW ─────────────── */}
      <section style={{ padding: "60px 0", borderBottom: `1px solid ${P.border}` }}>
        <div className="dh-container">
          <p className="dh-section-eyebrow">Tu sistema en números</p>
          <div className="dh-grid-3" style={{ marginTop: 20 }}>
            {[
              {
                value: "12",
                label: "Personas de tu equipo listas para usar el sistema",
                tag: "Real · cargados hoy",
                icon: Users,
              },
              {
                value: "143",
                label: "Clientes ya cargados en el pipeline",
                tag: "Real · vivos en producción",
                icon: Database,
              },
              {
                value: "$40M+",
                label: "En transacciones del sector inmobiliario que el CRM puede gestionar",
                tag: "Referencia · industria Riviera Maya",
                icon: TrendingUp,
              },
            ].map((kpi) => (
              <div key={kpi.value} className="dh-glass dh-hover">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="dh-kpi-value">{kpi.value}</p>
                    <p className="dh-kpi-label">{kpi.label}</p>
                    <p className="dh-kpi-tag">{kpi.tag}</p>
                  </div>
                  <div className="dh-icon-box">
                    <kpi.icon size={20} color={P.accent} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── ¿QUÉ HICIMOS POR TI? ─────────────── */}
      <section id="entregamos" className="dh-section">
        <div className="dh-container">
          <p className="dh-section-eyebrow">Qué hicimos por ti</p>
          <h2 className="dh-section-title">Sin tecnicismos: esto es lo que tu equipo gana hoy.</h2>
          <p className="dh-section-sub" style={{ marginBottom: 40 }}>
            No te vamos a hablar de bases de datos ni de código. Te explicamos el cambio real
            que va a vivir tu equipo cuando empiece a usar el sistema.
          </p>

          <div className="dh-grid-3">
            {[
              {
                icon: Users,
                title: "Tu equipo trabaja sincronizado",
                desc: "Si Cecilia mueve un cliente a 'Negociación', Emmanuel lo ve en su pantalla al instante. Nadie pisa el trabajo de nadie.",
              },
              {
                icon: FileText,
                title: "Cada cliente tiene su historia completa",
                desc: "Cuándo entró, qué se le ofreció, qué dijo, quién lo atendió. Si un asesor se va, el siguiente toma el caso sin perder nada.",
              },
              {
                icon: Zap,
                title: "Nadie pierde un lead caliente",
                desc: "El sistema te avisa cuando un cliente está listo para comprar — antes de que se enfríe o se vaya con la competencia.",
              },
              {
                icon: LineChart,
                title: "Sabes en 1 segundo cuánto vendió el equipo hoy",
                desc: "El dashboard te muestra los números reales sin pedirle reporte a nadie. Decides con datos, no con suposiciones.",
              },
              {
                icon: ShieldCheck,
                title: "Quién hizo qué cambio queda registrado",
                desc: "Cualquier modificación queda en bitácora con nombre y hora. Si algo se borra por error, se recupera. Si hay duda, se aclara.",
              },
              {
                icon: Cloud,
                title: "Funciona aunque se vaya internet",
                desc: "Tus asesores pueden seguir registrando leads desde el celular sin señal. Cuando vuelve el wifi, todo se sincroniza solo.",
              },
            ].map((f) => (
              <div key={f.title} className="dh-glass dh-hover">
                <div className="dh-icon-box">
                  <f.icon size={20} color={P.accent} />
                </div>
                <h3 className="dh-feature-title">{f.title}</h3>
                <p className="dh-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── EL CRM POR DENTRO ─────────────── */}
      <section className="dh-section" style={{ background: P.surface, borderTop: `1px solid ${P.border}`, borderBottom: `1px solid ${P.border}` }}>
        <div className="dh-container">
          <p className="dh-section-eyebrow">El CRM por dentro</p>
          <h2 className="dh-section-title">Cuatro herramientas que cambian cómo se vende.</h2>
          <p className="dh-section-sub" style={{ marginBottom: 40 }}>
            Todas ya están operando con tu equipo. No necesitas instalar nada — abres el sistema y están ahí.
          </p>

          <div className="dh-grid-2">
            {[
              {
                icon: Layers,
                title: "Pipeline visual estilo tablero",
                desc: "Ves de un solo vistazo todos los clientes, en qué etapa están y cuáles necesitan atención. Mover un cliente entre etapas es arrastrar y soltar — como mover papelitos en un corcho, pero digital.",
              },
              {
                icon: PowerAtom,
                title: "Asistente IA que califica clientes",
                desc: "Cada cliente recibe un puntaje del 0 al 100 según qué tan probable es que cierre. El asistente lee los datos, los movimientos y la actividad — y te dice quién priorizar HOY.",
              },
              {
                icon: MessageCircle,
                title: "Bot de Telegram que registra clientes nuevos",
                desc: "Tu cliente potencial te escribe por Telegram. El bot le hace las preguntas correctas, captura sus datos y los mete al CRM antes de que tú leas el primer mensaje. Tu asesor llega con todo listo.",
              },
              {
                icon: Lock,
                title: "Auditoría inmutable de cada cambio",
                desc: "Quien cambió la etapa de un cliente, cuándo, desde qué dispositivo. Cada movimiento queda en piedra. Útil para resolver dudas, capacitar y, si crece, cumplir con auditorías formales.",
              },
            ].map((f) => (
              <div key={f.title} className="dh-glass dh-hover" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <div className="dh-icon-box" style={{ marginTop: 4 }}>
                  <f.icon size={20} color={P.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="dh-feature-title" style={{ marginTop: 0 }}>{f.title}</h3>
                  <p className="dh-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── LO QUE VIENE DESPUÉS ─────────────── */}
      <section className="dh-section">
        <div className="dh-container">
          <span className="dh-pill dh-pill-soon" style={{ marginBottom: 14 }}>
            <Clock size={12} />
            Próximas entregas
          </span>
          <h2 className="dh-section-title">Esto es solo el principio.</h2>
          <p className="dh-section-sub" style={{ marginBottom: 40 }}>
            En el menú lateral del sistema ya verás más módulos. Están en construcción y se van a entregar
            uno a uno en las siguientes semanas — cada uno con su propia entrega oficial como esta.
          </p>

          <div className="dh-grid-3">
            {[
              {
                icon: LineChart,
                title: "Dashboard ejecutivo",
                desc: "Vista de control para directivos: ventas del día, conversión por asesor, ROI de cada campaña.",
              },
              {
                icon: Building2,
                title: "ERP de proyectos inmobiliarios",
                desc: "Gestiona tus desarrollos: unidades, disponibilidad, documentos, cierres. Todo conectado al CRM.",
              },
              {
                icon: Wallet,
                title: "Gestión de finanzas",
                desc: "Ingresos, egresos, comisiones por asesor. Sin pelearte con Excel cada fin de mes.",
              },
              {
                icon: BriefcaseBusiness,
                title: "RRHH y reclutamiento",
                desc: "Portal de candidatos, evaluaciones, contratos digitales. Construye tu equipo desde el sistema.",
              },
              {
                icon: Layout,
                title: "Constructor de landing pages",
                desc: "Crea páginas de captura para tus campañas sin pedirle nada al diseñador o al programador.",
              },
              {
                icon: Bot,
                title: "Agentes IA — versión completa",
                desc: "Atención automatizada multicanal (WhatsApp, Telegram, web), generación de propuestas, negociación asistida.",
              },
            ].map((f) => (
              <div key={f.title} className="dh-glass" style={{ opacity: 0.85 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div className="dh-icon-box amber">
                    <f.icon size={20} color={P.amber} />
                  </div>
                  <span style={{ fontSize: 10, color: P.amber, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Próxima entrega
                  </span>
                </div>
                <h3 className="dh-feature-title" style={{ marginTop: 0 }}>{f.title}</h3>
                <p className="dh-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── EL TRABAJO INVISIBLE ─────────────── */}
      <section className="dh-section" style={{ background: P.surface, borderTop: `1px solid ${P.border}`, borderBottom: `1px solid ${P.border}` }}>
        <div className="dh-container">
          <p className="dh-section-eyebrow">El trabajo silencioso que no se ve</p>
          <h2 className="dh-section-title">Por debajo del capó, también pasaron cosas.</h2>
          <p className="dh-section-sub" style={{ marginBottom: 40 }}>
            Estas son cosas que tu equipo nunca va a notar — pero que evitan dolores de cabeza grandes
            cuando el negocio crezca. Te las contamos para que sepas qué tienes.
          </p>

          <div className="dh-grid-2">
            {[
              {
                icon: Lock,
                title: "Cada cliente vive en su espacio aislado",
                desc: "El sistema está hecho para crecer: si mañana abres una sucursal o le vendes el CRM a otra empresa, los datos de cada quien quedan separados a nivel de base de datos. Imposible mezclar.",
              },
              {
                icon: ShieldCheck,
                title: "Encriptación de punta a punta",
                desc: "Toda la información viaja y se guarda cifrada con los estándares que usan los bancos. Las contraseñas no se pueden ver — ni siquiera por nosotros.",
              },
              {
                icon: Cloud,
                title: "Copias de seguridad automáticas todos los días",
                desc: "Si algo se borra por error, se puede regresar al punto exacto del día anterior. No tienes que pensar en respaldar nada manualmente.",
              },
              {
                icon: Workflow,
                title: "Listo para escalar a 10,000 clientes",
                desc: "La arquitectura ya soporta crecer 100x sin que tengamos que rehacer nada. Te ahorras la 'crisis de éxito' que mata a muchos negocios cuando empiezan a vender mucho.",
              },
            ].map((f) => (
              <div key={f.title} className="dh-glass dh-hover" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                <div className="dh-icon-box" style={{ marginTop: 4 }}>
                  <f.icon size={20} color={P.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="dh-feature-title" style={{ marginTop: 0 }}>{f.title}</h3>
                  <p className="dh-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── SOPORTE ─────────────── */}
      <section className="dh-section">
        <div className="dh-container">
          <p className="dh-section-eyebrow">Soporte</p>
          <h2 className="dh-section-title">Si necesitas algo, escríbenos.</h2>
          <p className="dh-section-sub" style={{ marginBottom: 40 }}>
            Estamos pendientes para resolver dudas, ajustar cosas y acompañar a tu equipo en el cambio.
          </p>

          <div className="dh-grid-2">
            <div className="dh-glass dh-hover" style={{ padding: 28 }}>
              <div className="dh-icon-box" style={{ marginBottom: 16 }}>
                <MessageCircle size={20} color={P.accent} />
              </div>
              <h3 className="dh-feature-title" style={{ marginTop: 0 }}>WhatsApp directo</h3>
              <p className="dh-feature-desc" style={{ marginBottom: 18 }}>
                La forma más rápida. Respondemos en menos de 24 horas hábiles.
              </p>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="dh-btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }}>
                Abrir WhatsApp
                <ArrowRight size={13} />
              </a>
            </div>

            <div className="dh-glass dh-hover" style={{ padding: 28 }}>
              <div className="dh-icon-box" style={{ marginBottom: 16 }}>
                <Mail size={20} color={P.accent} />
              </div>
              <h3 className="dh-feature-title" style={{ marginTop: 0 }}>Correo electrónico</h3>
              <p className="dh-feature-desc" style={{ marginBottom: 18 }}>
                Para temas más extensos o que requieran adjuntar archivos.
              </p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="dh-btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }}>
                {SUPPORT_EMAIL}
                <ArrowRight size={13} />
              </a>
            </div>
          </div>

          <div className="dh-glass" style={{ marginTop: 24, padding: 24, borderColor: P.accentB }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <CheckCircle2 size={22} color={P.accent} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ color: P.w, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                  Soporte incluido durante esta entrega
                </p>
                <p className="dh-feature-desc">
                  Cualquier ajuste menor, capacitación a tu equipo o duda sobre cómo usar el CRM
                  está cubierto sin costo adicional. Te acompañamos hasta que tu equipo sienta el sistema como propio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── CTA FINAL ─────────────── */}
      <section className="dh-section" style={{ background: P.surface, borderTop: `1px solid ${P.border}` }}>
        <div className="dh-container" style={{ textAlign: "center", maxWidth: 720 }}>
          <h2 className="dh-section-title" style={{ marginBottom: 18 }}>
            Tu CRM te espera.<br />
            <span style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, " + P.accent + " 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Empieza ahora.
            </span>
          </h2>
          <p className="dh-section-sub" style={{ marginBottom: 32, marginLeft: "auto", marginRight: "auto" }}>
            Comparte este link con todo tu equipo. Cada uno entra con su propia cuenta y empieza a trabajar en minutos.
          </p>
          <a href={APP_URL} className="dh-btn-primary" style={{ padding: "16px 28px", fontSize: 15 }}>
            Entrar al sistema
            <ArrowRight size={17} />
          </a>
        </div>
      </section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer className="dh-footer">
        <div className="dh-container" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <StratosAtom size={18} color={P.accent} />
            <span style={{ color: P.txt2 }}>
              © {new Date().getFullYear()} Stratos Capital Group · Entrega CRM v1.0 · Mayo 2026
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="https://stratoscapitalgroup.com" style={{ color: P.txt2 }}>Sitio principal</a>
            <a href="https://stratoscapitalgroup.com/politica-de-privacidad" style={{ color: P.txt2 }}>Privacidad</a>
            <a href={APP_URL} style={{ color: P.accent, fontWeight: 600 }}>Entrar al sistema →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
