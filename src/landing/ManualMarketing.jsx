/**
 * ManualMarketing.jsx — Manual de usuario del equipo de MARKETING de Duke
 *
 * Cubre el módulo "Mi Espacio" (Mi Día, Marcas, Pipeline de videos,
 * Solicitudes, Evidencia) y el Copilot de marketing.
 *
 * Audiencia: equipo de marketing (gente NO técnica). Tono: español neutro
 * "tú", lenguaje simple, cero jerga, cero emojis.
 *
 * Estructura: una sola página con sidebar de navegación por anclas +
 * buscador que filtra las secciones. Misma familia visual que ManualCRM.jsx
 * (fondo oscuro, acento menta, inline styles, sin Tailwind ni librerías nuevas).
 *
 * Componente standalone: no recibe props obligatorias.
 */
import { useState, useEffect, useMemo } from "react";
import {
  ArrowRight, Search, X, ChevronRight, Lightbulb, AlertTriangle,
  MessageCircle, Mail, Smartphone,
  LayoutGrid, Sun, Building2, Clapperboard, Palette, Camera, Bot,
  Crown, HelpCircle, Mic, Lock, CircleCheck,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PALETA — misma familia que la app (P de App.jsx) y que ManualCRM
   ═══════════════════════════════════════════════════════════════════════════ */
const P = {
  bg:       "#060A11",
  surface:  "#0A101B",
  glass:    "rgba(255,255,255,0.03)",
  glassH:   "rgba(255,255,255,0.05)",
  border:   "rgba(255,255,255,0.07)",
  accent:   "#6EE7C2",
  accentS:  "rgba(110,231,194,0.07)",
  accentB:  "rgba(110,231,194,0.16)",
  warn:     "#E8A488",
  warnS:    "rgba(232,164,136,0.07)",
  warnB:    "rgba(232,164,136,0.22)",
  blue:     "#7EB8F0",
  blueS:    "rgba(126,184,240,0.08)",
  blueB:    "rgba(126,184,240,0.22)",
  rose:     "#F87171",
  roseS:    "rgba(248,113,113,0.08)",
  roseB:    "rgba(248,113,113,0.25)",
  w:        "#FFFFFF",
  txt:      "#E2E8F0",
  txt2:     "#8A97AA",
  txt3:     "#3D4A5C",
};
const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
const fontM = `"SF Mono", ui-monospace, Menlo, Consolas, monospace`;

const APP_URL = "https://app.stratoscapitalgroup.com";

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENIDO — secciones del manual (una sola página, navegación por anclas)
   Tipos de bloque: p, steps, list, tip, warn, danger, flow, stages,
                    abilities, faq
   ═══════════════════════════════════════════════════════════════════════════ */
const SECTIONS = [
  {
    id: "espacio",
    icon: LayoutGrid,
    title: "Tu espacio de trabajo",
    summary: "Qué es Mi Espacio, cómo entrar y cómo usarlo desde el celular.",
    tags: ["mi espacio", "entrar", "acceso", "login", "celular", "iphone", "android", "app"],
    content: [
      { type: "p", text: "Mi Espacio es el lugar donde vive todo el trabajo del equipo de marketing: tus tareas del día, los proyectos de cada marca, el tablero de videos y las solicitudes de diseño. Todo lo que haces (o lo que pides por el Copilot) aparece aquí." },
      { type: "steps", items: [
        "Abre el navegador y entra a app.stratoscapitalgroup.com",
        "Inicia sesión con tu cuenta (el correo y la contraseña que te dieron).",
        "En el menú, entra a Mi Espacio.",
      ]},
      { type: "p", text: "También funciona en el celular, con el mismo link. Si tienes iPhone, puedes dejarlo como una app en tu pantalla de inicio:" },
      { type: "steps", items: [
        "Abre Safari y entra a app.stratoscapitalgroup.com",
        "Toca el botón Compartir (el cuadrito con la flecha hacia arriba).",
        "Toca \"Agregar a inicio\". Listo: queda el icono como una app.",
      ]},
      { type: "tip", text: "No importa si entras desde la computadora o desde el celular: es la misma información, siempre al día." },
    ],
  },
  {
    id: "mi-dia",
    icon: Sun,
    title: "Mi Día",
    summary: "Tu enfoque diario: lo vencido, lo de hoy, lo bloqueado y lo de mañana.",
    tags: ["mi dia", "hoy", "tareas", "vencido", "bloqueada", "desbloqueada", "mañana", "hecha"],
    content: [
      { type: "p", text: "Mi Día es tu vista de enfoque: te dice exactamente qué te toca hoy, sin que tengas que buscar nada. Se ordena así:" },
      { type: "flow", items: [
        { n: 1, title: "Vencido (en rojo, arriba de todo)", text: "Tareas que ya pasaron de su fecha. Van primero para que no se te escapen." },
        { n: 2, title: "Para hoy", text: "Tus tareas con fecha de hoy. Este es tu plan del día." },
        { n: 3, title: "Bloqueadas — no dependen de ti", text: "Tareas que esperan a que otra persona termine algo primero. No tienes que hacer nada con ellas todavía." },
        { n: 4, title: "Mañana", text: "Lo que viene. Sirve para ver qué te espera y organizarte." },
      ]},
      { type: "p", text: "Para marcar una tarea como hecha, toca el círculo que está a la izquierda de la tarea. Así de simple." },
      { type: "tip", text: "Cuando la persona de la que dependía tu tarea bloqueada termina lo suyo, tu tarea se desbloquea sola y te aparece con la etiqueta \"Desbloqueada, ya puedes avanzar\". No tienes que estar revisando: el sistema te avisa." },
    ],
  },
  {
    id: "marcas",
    icon: Building2,
    title: "Marcas",
    summary: "Las marcas del grupo, sus proyectos y sus tareas.",
    tags: ["marcas", "proyectos", "duke", "muebleria", "brasa y piedra", "nk23", "casa agata", "nsg", "responsable", "fecha", "dependencia", "drive"],
    content: [
      { type: "p", text: "En la pestaña Marcas están todas las marcas del grupo:" },
      { type: "list", items: [
        "Duke del Caribe",
        "Mueblería",
        "Brasa y Piedra",
        "NK23",
        "Casa Ágata",
        "NSG",
      ]},
      { type: "p", text: "Cada marca tiene sus proyectos, y cada proyecto tiene sus tareas. La barra de progreso de cada proyecto te muestra cuánto va completado de un vistazo." },
      { type: "p", text: "Con el botón \"+\" agregas proyectos y tareas nuevas. A cada tarea le puedes poner:" },
      { type: "list", items: [
        "Responsable: quién la va a hacer.",
        "Fecha: para cuándo debe estar.",
        "Dependencia: \"no se puede hacer hasta que X termine\". Mientras X no esté lista, la tarea aparece bloqueada; cuando X se completa, se desbloquea sola.",
        "Link de Drive: la carpeta o archivo donde está el material.",
      ]},
      { type: "tip", text: "Si una tarea depende de otra, ponle la dependencia al crearla. Así nadie pierde tiempo preguntando \"¿ya puedo empezar con esto?\"." },
    ],
  },
  {
    id: "pipeline-videos",
    icon: Clapperboard,
    title: "Pipeline (el tablero de videos)",
    summary: "El tablero donde cada video de propiedad avanza por etapas hasta publicarse.",
    tags: ["pipeline", "videos", "tablero", "etapas", "grabada", "edicion", "esperando voz", "publicada", "arrastrar", "flechas", "cuello de botella"],
    content: [
      { type: "p", text: "El Pipeline es el tablero donde cada video de propiedad avanza de izquierda a derecha por etapas, desde que se elige la propiedad hasta que el video se publica:" },
      { type: "stages", items: [
        "Seleccionada", "Agendada", "Grabada", "En edición", "Esperando voz", "Lista", "Publicada",
      ]},
      { type: "list", items: [
        "En la computadora: arrastras las tarjetas de una columna a otra con el mouse.",
        "En el celular: usas las flechas ‹ › de cada tarjeta para moverla.",
      ]},
      { type: "danger", text: "Si en \"Esperando voz\" se acumulan 3 videos o más, la columna se pinta en rojo: ahí está el cuello de botella. Es la señal de que hay que grabar voces antes de seguir produciendo." },
      { type: "tip", text: "También puedes mover videos sin abrir el tablero, pidiéndoselo al Copilot. Por ejemplo: \"mueve Bay View Grand 2 a lista\"." },
    ],
  },
  {
    id: "solicitudes",
    icon: Palette,
    title: "Solicitudes",
    summary: "Pedidos de diseño para el equipo, con su complejidad y su estado.",
    tags: ["solicitudes", "diseño", "flyer", "carrusel", "video", "complejidad", "a", "aa", "aaa", "estado", "entregada"],
    content: [
      { type: "p", text: "Las Solicitudes son los pedidos de diseño para el equipo. Cada una lleva una letra según su complejidad:" },
      { type: "list", items: [
        "A — simple. Por ejemplo: un flyer.",
        "AA — media. Por ejemplo: un carrusel.",
        "AAA — producción compleja. Por ejemplo: un video con rodaje.",
      ]},
      { type: "p", text: "Cada solicitud tiene su marca, su fecha de entrega y su responsable. Y su estado avanza así:" },
      { type: "stages", items: ["Nueva", "En curso", "En revisión", "Entregada"] },
      { type: "tip", text: "Puedes crear una solicitud desde el módulo o pidiéndosela al Copilot. Por ejemplo: \"necesito un flyer AA para Mueblería el sábado\"." },
    ],
  },
  {
    id: "evidencia",
    icon: Camera,
    title: "Evidencia de tu trabajo",
    summary: "Adjunta una foto, un video o un link al completar una tarea. Es opcional.",
    tags: ["evidencia", "foto", "video", "link", "adjuntar", "camara", "reporte", "opcional"],
    content: [
      { type: "p", text: "Al completar una tarea puedes adjuntar una foto o un video (o un link) como evidencia de lo que hiciste. Suma a tu reporte y tu líder la puede ver. Es opcional: si no adjuntas nada, la tarea igual queda como hecha." },
      { type: "p", text: "Hay dos formas de subirla:" },
      { type: "steps", items: [
        "Desde el módulo: al marcar la tarea como hecha, aparece el recuadro para subir la evidencia ahí mismo.",
        "Desde el Copilot: con el botón de cámara que está junto al micrófono del chat.",
      ]},
      { type: "tip", text: "Una foto del diseño terminado o un video corto del resultado es suficiente. No tiene que ser nada elaborado." },
    ],
  },
  {
    id: "copilot",
    icon: Bot,
    title: "El Copilot (tu asistente)",
    summary: "El asistente que entiende texto y voz, y hace las cosas por ti.",
    tags: ["copilot", "asistente", "chat", "voz", "audio", "microfono", "crear tarea", "mover video", "pedir diseño", "drive", "pendientes"],
    content: [
      { type: "p", text: "El Copilot es tu asistente dentro del sistema. Entiende texto y voz, hace las cosas por ti, y todo lo que le pides aparece al instante en tu módulo: no tienes que ir a registrarlo a ningún lado." },
      { type: "p", text: "Esto es todo lo que puede hacer, con la frase de ejemplo de cada cosa:" },
      { type: "abilities", items: [
        { what: "Tu día", phrase: "\"¿qué tengo hoy?\"" },
        { what: "Crear tareas", phrase: "\"créale una tarea a Luis: editar el video de Casa Banana para el viernes\"" },
        { what: "Mover videos del tablero", phrase: "\"mueve Bay View Grand 2 a lista\" / \"ya se grabó Monarca 28\"" },
        { what: "Pedir diseños", phrase: "\"necesito un flyer AA para Mueblería el sábado\"" },
        { what: "Cómo van los videos", phrase: "\"¿cómo van los videos?\" o \"¿cómo va el pipeline?\"" },
        { what: "Pendientes de una persona", phrase: "\"¿qué tiene pendiente Emmanuel?\"" },
        { what: "El Drive de una propiedad", phrase: "\"pásame el drive de Bay View Grand\"" },
        { what: "Adjuntar evidencia", phrase: "Con el botón de cámara del chat: sube una foto o un video de una tarea terminada." },
      ]},
      { type: "warn", text: "El Copilot de marketing no maneja clientes ni ventas — eso es del CRM de los asesores. Si le preguntas algo de clientes, te lo va a decir y te va a orientar a dónde ir." },
      { type: "tip", text: "Puedes hablarle por voz: toca el micrófono y habla normal, como si le mandaras un audio a un compañero." },
    ],
  },
  {
    id: "lider",
    icon: Crown,
    title: "Para el líder del equipo (admin)",
    summary: "La pestaña Equipo y la vista del día de todo el equipo.",
    tags: ["lider", "admin", "equipo", "avance", "vencidas", "bloqueadas", "evidencia", "responsables"],
    content: [
      { type: "p", text: "Si eres el líder del equipo, tienes una vista extra: la pestaña Equipo. Ahí ves cómo va cada persona:" },
      { type: "list", items: [
        "Cuántas tareas tiene en curso.",
        "Cuántas están bloqueadas.",
        "Cuántas están vencidas.",
        "Cuántas terminó esta semana, con su evidencia.",
      ]},
      { type: "p", text: "Y en el Copilot, cuando el líder pregunta \"¿qué tenemos hoy?\", no ve solo su día: ve el día de todo el equipo, con el nombre de cada responsable junto a cada tarea." },
      { type: "tip", text: "Con esa vista es fácil detectar a tiempo a quién ayudar: si alguien acumula vencidas o lleva días bloqueado, ahí es donde hace falta una mano." },
    ],
  },
  {
    id: "faq",
    icon: HelpCircle,
    title: "Preguntas frecuentes",
    summary: "Voz, celular, tareas bloqueadas y qué pasa al cerrar la app.",
    tags: ["preguntas", "faq", "voz", "cerrar", "guardado", "celular", "bloqueada", "ayuda"],
    content: [
      { type: "faq", items: [
        { q: "¿Qué pasa si le hablo por voz al Copilot?", a: "Nada raro: toca el micrófono y habla normal. El Copilot te entiende igual que si escribieras." },
        { q: "¿Se pierde algo si cierro la app?", a: "No. Todo queda guardado. Cuando vuelvas a entrar, encuentras todo exactamente como lo dejaste." },
        { q: "¿Puedo usarlo desde el celular?", a: "Sí, con el mismo link: app.stratoscapitalgroup.com. En iPhone puedes dejarlo como app: Safari, botón Compartir, \"Agregar a inicio\"." },
        { q: "¿Qué hago si una tarea me aparece bloqueada?", a: "Nada: no depende de ti. Cuando la otra persona termine lo suyo, tu tarea se desbloquea sola y te avisa. Si lleva varios días bloqueada, avísale al responsable de la tarea que la está frenando." },
      ]},
    ],
  },
];

/* Búsqueda simple: filtra secciones por título, resumen y tags */
function searchSections(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return SECTIONS;
  const tokens = q.split(/\s+/).filter(Boolean);
  return SECTIONS.filter((s) => {
    const haystack = [s.title, s.summary, ...(s.tags || [])].join(" ").toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = `
  .mm-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; }
  .mm-wrap *, .mm-wrap *::before, .mm-wrap *::after { box-sizing: border-box; }
  .mm-wrap a { color: ${P.accent}; text-decoration: none; }
  .mm-wrap a:hover { text-decoration: underline; }
  .mm-wrap h1, .mm-wrap h2, .mm-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.02em; margin: 0; }
  .mm-wrap p { margin: 0; line-height: 1.7; color: ${P.txt}; font-size: 15px; }
  .mm-wrap ::selection { background: ${P.accentB}; color: ${P.w}; }
  html { scroll-behavior: smooth; }

  /* Top nav sticky */
  .mm-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(6,10,17,0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid ${P.border};
  }

  /* Layout grid */
  .mm-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    max-width: 1280px;
    margin: 0 auto;
  }
  @media (max-width: 900px) {
    .mm-shell { grid-template-columns: 1fr; }
    .mm-sidebar { position: static !important; height: auto !important; border-right: none !important; border-bottom: 1px solid ${P.border}; }
  }

  /* Sidebar */
  .mm-sidebar {
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    overflow-y: auto;
    border-right: 1px solid ${P.border};
    padding: 24px 16px;
    background: ${P.surface};
  }
  .mm-sidebar::-webkit-scrollbar { width: 6px; }
  .mm-sidebar::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 3px; }

  .mm-side-label {
    font-size: 11px; font-weight: 700; color: ${P.txt3};
    letter-spacing: 0.14em; text-transform: uppercase;
    padding: 6px 12px 8px;
  }
  .mm-link {
    display: flex; align-items: center; gap: 10px;
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
  .mm-link:hover { background: ${P.glass}; color: ${P.w}; }
  .mm-link.active {
    background: ${P.accentS};
    color: ${P.accent};
    border-left-color: ${P.accent};
    font-weight: 600;
  }

  /* Search */
  .mm-search { position: relative; margin-bottom: 18px; }
  .mm-search input {
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
  .mm-search input:focus { border-color: ${P.accentB}; background: ${P.glassH}; }
  .mm-search input::placeholder { color: ${P.txt3}; }
  .mm-search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: ${P.txt3}; pointer-events: none;
  }
  .mm-search-clear {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: transparent; border: none; cursor: pointer;
    color: ${P.txt3}; padding: 4px;
    display: flex; align-items: center; border-radius: 6px;
  }
  .mm-search-clear:hover { color: ${P.w}; background: ${P.glass}; }

  /* Content area */
  .mm-content { padding: 48px 56px 80px; max-width: 800px; }
  @media (max-width: 720px) { .mm-content { padding: 32px 20px 56px; } }

  .mm-hero-title {
    font-size: clamp(28px, 4vw, 38px);
    font-weight: 700;
    line-height: 1.15;
    margin-bottom: 14px;
  }
  .mm-hero-sub {
    font-size: 16.5px; color: ${P.txt2}; line-height: 1.65; margin-bottom: 8px;
  }

  /* Section card */
  .mm-section { padding: 44px 0 8px; border-bottom: 1px solid ${P.border}; scroll-margin-top: 84px; }
  .mm-section:last-of-type { border-bottom: none; }
  .mm-sec-head { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
  .mm-sec-icon {
    flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px;
    background: ${P.accentS}; border: 1px solid ${P.accentB};
    display: flex; align-items: center; justify-content: center;
    color: ${P.accent};
  }
  .mm-sec-title { font-size: clamp(21px, 3vw, 26px); font-weight: 700; line-height: 1.25; }
  .mm-sec-summary { color: ${P.txt2}; font-size: 15px; line-height: 1.6; margin-bottom: 20px; }

  /* Content blocks */
  .mm-block { margin-bottom: 18px; }
  .mm-block ol, .mm-block ul { padding-left: 24px; margin: 8px 0; }
  .mm-block ol li, .mm-block ul li {
    color: ${P.txt}; font-size: 15px; line-height: 1.7; margin-bottom: 6px;
  }
  .mm-block ol li::marker { color: ${P.accent}; font-weight: 700; }
  .mm-block ul li::marker { color: ${P.txt3}; }

  /* Callouts */
  .mm-callout {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 14px 18px;
    border-radius: 11px;
    margin: 18px 0;
    line-height: 1.6;
    font-size: 14px;
  }
  .mm-callout-tip { background: ${P.blueS}; border: 1px solid ${P.blueB}; color: ${P.txt}; }
  .mm-callout-tip .mm-callout-icon { color: ${P.blue}; }
  .mm-callout-warn { background: ${P.warnS}; border: 1px solid ${P.warnB}; color: ${P.txt}; }
  .mm-callout-warn .mm-callout-icon { color: ${P.warn}; }
  .mm-callout-danger { background: ${P.roseS}; border: 1px solid ${P.roseB}; color: ${P.txt}; }
  .mm-callout-danger .mm-callout-icon { color: ${P.rose}; }
  .mm-callout-icon { flex-shrink: 0; margin-top: 2px; }

  /* Flow — tarjetas numeradas */
  .mm-flow { display: flex; flex-direction: column; gap: 12px; margin: 22px 0; }
  .mm-flow-step {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 16px 18px; border-radius: 12px;
    background: ${P.glass}; border: 1px solid ${P.border};
  }
  .mm-flow-n {
    flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px;
    background: ${P.accentB}; color: ${P.accent};
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 15px; font-family: ${fontD};
  }
  .mm-flow-title { color: ${P.w}; font-weight: 700; font-size: 14.5px; margin-bottom: 3px; font-family: ${fontD}; }
  .mm-flow-text { color: ${P.txt2}; font-size: 14px; line-height: 1.6; }

  /* Stages — chips de etapas con flechas */
  .mm-stages {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    margin: 20px 0;
  }
  .mm-stage {
    padding: 8px 13px; border-radius: 999px;
    background: ${P.glass}; border: 1px solid ${P.border};
    color: ${P.txt}; font-size: 13px; font-weight: 600;
    white-space: nowrap;
  }
  .mm-stage-arrow { color: ${P.txt3}; display: flex; align-items: center; }

  /* Abilities — lo que puede hacer el Copilot */
  .mm-ab { display: flex; flex-direction: column; gap: 10px; margin: 20px 0; }
  .mm-ab-item {
    padding: 14px 16px; border-radius: 12px;
    background: ${P.glass}; border: 1px solid ${P.border};
  }
  .mm-ab-what {
    color: ${P.accent}; font-weight: 700; font-size: 12px;
    letter-spacing: 0.08em; text-transform: uppercase;
    margin-bottom: 7px; font-family: ${fontD};
  }
  .mm-ab-phrase {
    color: ${P.txt}; font-size: 13.5px; line-height: 1.55;
    font-family: ${fontM};
  }

  /* FAQ */
  .mm-faq { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }
  .mm-faq-item {
    padding: 16px 18px; border-radius: 12px;
    background: ${P.glass}; border: 1px solid ${P.border};
  }
  .mm-faq-q { color: ${P.w}; font-weight: 700; font-size: 15px; margin-bottom: 6px; font-family: ${fontD}; }
  .mm-faq-a { color: ${P.txt2}; font-size: 14px; line-height: 1.65; }

  /* Empty state */
  .mm-empty { text-align: center; padding: 80px 20px; color: ${P.txt2}; }
  .mm-empty h3 { color: ${P.txt}; margin-bottom: 8px; font-size: 18px; }

  /* Footer */
  .mm-footer {
    border-top: 1px solid ${P.border};
    background: ${P.surface};
    padding: 32px 24px;
    color: ${P.txt2};
    font-size: 13px;
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO Stratos (átomo, igual familia que ManualCRM)
   ═══════════════════════════════════════════════════════════════════════════ */
function PowerAtom({ size = 16, color = P.accent }) {
  const uid = `mmpa-${size}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.85" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.55" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke={color} strokeWidth="1.4" opacity="0.55" transform="rotate(-60 16 16)" />
      <circle cx="16" cy="16" r="6" fill={`url(#${uid}-core)`} />
      <circle cx="16" cy="16" r="2.6" fill={color} />
      <circle cx="29" cy="16" r="1.7" fill={color} />
      <circle cx="9.5" cy="5.2" r="1.7" fill={color} />
      <circle cx="9.5" cy="26.8" r="1.7" fill={color} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDERER de bloques de contenido
   ═══════════════════════════════════════════════════════════════════════════ */
function ContentBlock({ block }) {
  if (block.type === "p") {
    return <p className="mm-block">{block.text}</p>;
  }
  if (block.type === "steps") {
    return (
      <div className="mm-block">
        <ol>{block.items.map((it, i) => <li key={i}>{it}</li>)}</ol>
      </div>
    );
  }
  if (block.type === "list") {
    return (
      <div className="mm-block">
        <ul>{block.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      </div>
    );
  }
  if (block.type === "tip") {
    return (
      <div className="mm-callout mm-callout-tip">
        <Lightbulb size={18} className="mm-callout-icon" />
        <div>{block.text}</div>
      </div>
    );
  }
  if (block.type === "warn") {
    return (
      <div className="mm-callout mm-callout-warn">
        <AlertTriangle size={18} className="mm-callout-icon" />
        <div>{block.text}</div>
      </div>
    );
  }
  if (block.type === "danger") {
    return (
      <div className="mm-callout mm-callout-danger">
        <AlertTriangle size={18} className="mm-callout-icon" />
        <div>{block.text}</div>
      </div>
    );
  }
  if (block.type === "flow") {
    return (
      <div className="mm-block mm-flow">
        {block.items.map((it, i) => (
          <div key={i} className="mm-flow-step">
            <div className="mm-flow-n">{it.n}</div>
            <div>
              <div className="mm-flow-title">{it.title}</div>
              <div className="mm-flow-text">{it.text}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "stages") {
    return (
      <div className="mm-block mm-stages">
        {block.items.map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="mm-stage">{it}</span>
            {i < block.items.length - 1 && (
              <span className="mm-stage-arrow"><ChevronRight size={14} /></span>
            )}
          </span>
        ))}
      </div>
    );
  }
  if (block.type === "abilities") {
    return (
      <div className="mm-block mm-ab">
        {block.items.map((it, i) => (
          <div key={i} className="mm-ab-item">
            <div className="mm-ab-what">{it.what}</div>
            <div className="mm-ab-phrase">{it.phrase}</div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "faq") {
    return (
      <div className="mm-block mm-faq">
        {block.items.map((it, i) => (
          <div key={i} className="mm-faq-item">
            <div className="mm-faq-q">{it.q}</div>
            <div className="mm-faq-a">{it.a}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ManualMarketing() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  const filtered = useMemo(() => searchSections(query), [query]);

  // Título del documento + idioma
  useEffect(() => {
    document.title = "Manual de Marketing · Stratos AI";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Manual del equipo de marketing de Duke: Mi Espacio, Mi Día, Marcas, el tablero de videos, Solicitudes, Evidencia y el Copilot de marketing."
    );
    document.documentElement.lang = "es";
  }, []);

  // Deep-link por hash (#mi-dia)
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash && SECTIONS.some((s) => s.id === fromHash)) {
      setActiveId(fromHash);
      const el = document.getElementById(fromHash);
      if (el) el.scrollIntoView({ block: "start" });
    }
  }, []);

  // Scroll-spy: marca en el sidebar la sección visible
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    const nodes = document.querySelectorAll(".mm-section[id]");
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [filtered]);

  const goTo = (id) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.history.replaceState) {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <div className="mm-wrap">
      <style>{CSS}</style>

      {/* ─────────────── NAV ─────────────── */}
      <nav className="mm-nav">
        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
        }}>
          <a href="https://stratoscapitalgroup.com" style={{
            display: "flex", alignItems: "center", gap: 10, color: P.w,
            fontWeight: 700, fontSize: 15, fontFamily: fontD, letterSpacing: "-0.01em",
          }}>
            <PowerAtom size={22} color={P.accent} />
            Stratos <span style={{ fontWeight: 300, opacity: 0.55 }}>AI</span>
            <span style={{
              marginLeft: 12, paddingLeft: 12, borderLeft: `1px solid ${P.border}`,
              fontSize: 13, fontWeight: 500, color: P.txt2, fontFamily: font,
            }}>Manual de Marketing</span>
          </a>
          <a href={APP_URL} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10,
            background: "transparent", border: `1px solid ${P.border}`,
            color: P.txt, fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>
            Ir a Mi Espacio
            <ArrowRight size={13} />
          </a>
        </div>
      </nav>

      {/* ─────────────── SHELL ─────────────── */}
      <div className="mm-shell">
        {/* SIDEBAR */}
        <aside className="mm-sidebar">
          <div className="mm-search">
            <Search size={16} className="mm-search-icon" />
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
                className="mm-search-clear"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mm-side-label">Contenido</div>
          {filtered.length === 0 ? (
            <div style={{ padding: "20px 12px", color: P.txt3, fontSize: 13, lineHeight: 1.6 }}>
              Sin resultados para "<span style={{ color: P.txt }}>{query}</span>".
              <br />
              Prueba con otras palabras o limpia la búsqueda.
            </div>
          ) : (
            filtered.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`mm-link ${activeId === s.id ? "active" : ""}`}
                  onClick={() => goTo(s.id)}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {s.title}
                </button>
              );
            })
          )}

          {/* Ayudas rápidas */}
          <div style={{
            marginTop: 22, padding: "14px 14px",
            borderRadius: 12, background: P.glass, border: `1px solid ${P.border}`,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: P.txt2, fontSize: 12.5, lineHeight: 1.5, marginBottom: 8,
            }}>
              <Mic size={13} color={P.accent} style={{ flexShrink: 0 }} />
              Al Copilot puedes hablarle por voz.
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: P.txt2, fontSize: 12.5, lineHeight: 1.5,
            }}>
              <Smartphone size={13} color={P.accent} style={{ flexShrink: 0 }} />
              Funciona igual en el celular.
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="mm-content">
          {/* Hero */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 999,
            background: P.accentS, border: `1px solid ${P.accentB}`,
            color: P.accent, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 18,
          }}>
            <PowerAtom size={13} color={P.accent} />
            Equipo de Marketing · Duke
          </div>
          <h1 className="mm-hero-title">Manual de tu espacio de trabajo</h1>
          <p className="mm-hero-sub">
            Todo lo que necesitas para trabajar con Mi Espacio y con el Copilot de
            marketing: tu día, las marcas, el tablero de videos, las solicitudes de
            diseño y la evidencia de tu trabajo. Explicado en simple, sin tecnicismos.
          </p>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: P.txt3, fontSize: 13, marginBottom: 8, marginTop: 14,
          }}>
            <CircleCheck size={14} color={P.accent} />
            Lectura de 10 minutos. Puedes ir directo a la sección que necesites.
          </div>

          {/* Secciones */}
          {filtered.length === 0 ? (
            <div className="mm-empty">
              <h3>Sin resultados</h3>
              <p>No encontramos nada con "{query}". Limpia la búsqueda para ver el manual completo.</p>
            </div>
          ) : (
            filtered.map((s) => {
              const Icon = s.icon;
              return (
                <section key={s.id} id={s.id} className="mm-section">
                  <div className="mm-sec-head">
                    <div className="mm-sec-icon"><Icon size={20} /></div>
                    <h2 className="mm-sec-title">{s.title}</h2>
                  </div>
                  <p className="mm-sec-summary">{s.summary}</p>
                  <div>
                    {s.content.map((b, i) => <ContentBlock key={i} block={b} />)}
                  </div>
                </section>
              );
            })
          )}

          {/* Contacto */}
          <div style={{
            marginTop: 40, padding: "20px 0", borderTop: `1px solid ${P.border}`,
            display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
          }}>
            <span style={{ color: P.txt2, fontSize: 13 }}>
              ¿Algo no te queda claro o algo no funciona?
            </span>
            <a
              href={`https://wa.me/17479779711?text=${encodeURIComponent("Hola, necesito ayuda con Mi Espacio de marketing")}`}
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
              href="mailto:info@stratoscapitalgroup.com?subject=Ayuda%20Mi%20Espacio%20Marketing"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, color: P.accent,
              }}
            >
              <Mail size={14} />
              Escríbenos un correo
            </a>
          </div>
        </main>
      </div>

      {/* ─────────────── CIERRE — el Copilot te acompaña ─────────────── */}
      <section style={{
        borderTop: `1px solid ${P.border}`,
        background: `linear-gradient(180deg, ${P.bg} 0%, ${P.surface} 100%)`,
        padding: "64px 24px",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            width: 60, height: 60, borderRadius: 17,
            background: P.accentS, border: `1px solid ${P.accentB}`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 18,
            boxShadow: `0 8px 32px ${P.accentS}`,
          }}>
            <Bot size={28} color={P.accent} />
          </div>
          <h2 style={{
            fontSize: "clamp(22px, 3vw, 27px)", fontWeight: 700,
            color: P.w, fontFamily: fontD, letterSpacing: "-0.02em",
            marginBottom: 12,
          }}>
            ¿Con duda? Pregúntale al Copilot
          </h2>
          <p style={{
            color: P.txt2, fontSize: 15, lineHeight: 1.65,
            maxWidth: 520, margin: "0 auto 24px",
          }}>
            No necesitas memorizar este manual. Entra a Mi Espacio, abre el Copilot
            y pídele las cosas con tus palabras — por texto o por voz. Empieza con
            "¿qué tengo hoy?" y deja que él te lleve.
          </p>
          <a href={APP_URL} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 22px", borderRadius: 12,
            background: P.accent, color: "#04231A",
            fontSize: 14, fontWeight: 700, fontFamily: fontD,
            textDecoration: "none",
          }}>
            Ir a Mi Espacio
            <ArrowRight size={15} />
          </a>
          <p style={{
            color: P.txt3, fontSize: 12, marginTop: 18, lineHeight: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Lock size={11} />
            Solo tu equipo puede entrar: se necesita cuenta y contraseña.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mm-footer">
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PowerAtom size={18} color={P.accent} />
            <span style={{ color: P.txt2 }}>
              © {new Date().getFullYear()} Stratos Capital Group · Manual de Marketing v1.0
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="https://stratoscapitalgroup.com" style={{ color: P.txt2 }}>Sitio principal</a>
            <a href={APP_URL} style={{ color: P.accent, fontWeight: 600 }}>Ir a Mi Espacio →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
