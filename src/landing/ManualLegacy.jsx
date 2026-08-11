/**
 * ManualLegacy.jsx — Manual de uso de Stratos IA para LEGACY DESIGN
 *
 * Audiencia: Shadai, Mario Coria y la dirección. Gente 0-técnica: a lo mucho
 * manejan un celular. Español NEUTRO (tú), cero jerga, tipografía grande.
 * Vive en /manual-legacy (público, sin login) para linkearlo desde Documentos
 * y mandarlo por chat. Misma familia visual que ManualNSG.
 */
import { useState, useMemo } from "react";
import {
  Search, X, Activity, FolderKanban, Bot, Wallet,
  Users, FileText, Smartphone, Bell, Lightbulb, AlertTriangle, Building2,
} from "lucide-react";

const P = {
  bg: "#060A11", surface: "#0A101B", glass: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)", accent: "#38BDF8", accentS: "rgba(56,189,248,0.08)",
  accentB: "rgba(56,189,248,0.22)", warn: "#E8A488", warnS: "rgba(232,164,136,0.07)",
  warnB: "rgba(232,164,136,0.22)", w: "#FFFFFF", txt: "#E2E8F0", txt2: "#8A97AA", txt3: "#3D4A5C",
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP = "https://app.stratoscapitalgroup.com/legacy-design";

/* ── El contenido, módulo por módulo ─────────────────────────────────────── */
const SECCIONES = [
  {
    id: "empezar", icono: Smartphone, titulo: "Cómo entrar",
    bloques: [
      { t: "p", v: `En la computadora: ${APP}` },
      { t: "p", v: "En el celular: la misma dirección. En iPhone se abre en Safari, tocas Compartir y después «Agregar a inicio» — queda como una app en la pantalla." },
      { t: "tip", v: "La primera vez el celular pregunta si permites notificaciones. Di que sí: de eso dependen los avisos de tus pendientes." },
    ],
  },
  {
    id: "tablero", icono: Building2, titulo: "El tablero de casas",
    bloques: [
      { t: "p", v: "Es el módulo CRM. Cada casa es una tarjeta y avanza por 8 etapas:" },
      { t: "numerada", v: [
        "Terreno y contrato", "Diseño y proyecto ejecutivo", "Licencias y permisos",
        "Cimientos", "Obra gris", "Acabados", "Entrega", "Postventa",
      ] },
      { t: "p", v: "Sustituye la pregunta «¿cuándo se entrega Casa Ágata?»: abres el tablero y ahí está, con su etapa y su siguiente paso." },
      { t: "lista", v: [
        "Para mover una casa de etapa: ábrela y elige la etapa nueva en el desplegable.",
        "El texto que aparece en cada casa es su situación real (qué sigue y con qué arquitecto).",
        "Con el buscador encuentras una casa por nombre, cliente o ubicación.",
      ] },
    ],
  },
  {
    id: "copilot", icono: Bot, titulo: "Copilot — háblale como a una persona",
    bloques: [
      { t: "p", v: "Es el chat con el botón verde. Escríbele o dictale con el micrófono, con tus palabras — entiende aunque escribas con errores:" },
      { t: "ejemplos", v: [
        ["«ponme una tarea: llamar al notario de Casa Ágata mañana a las 10»", "la crea y te avisa antes"],
        ["«que Mario revise los planos de Sol y Luna el jueves»", "se la asigna a Mario y el sistema la persigue"],
        ["«¿qué tengo hoy?»", "te lista tu día"],
        ["«recuérdame en 2 horas pedir la licencia de tala»", "te avisa a la hora exacta"],
        ["«ya terminé lo del notario»", "cierra la tarea"],
        ["«¿qué documentos hay?»", "te lista los documentos y te pasa el enlace del que pidas"],
        ["«¿qué puedes hacer?»", "te explica todo esto"],
      ] },
      { t: "tip", v: "Si le preguntas algo que no sabe, te lo dice con honestidad y te ofrece lo que sí puede. Nunca se queda callado." },
    ],
  },
  {
    id: "miespacio", icono: Activity, titulo: "Mi Espacio — tu agenda",
    bloques: [
      { t: "p", v: "Está en el menú de la izquierda. Adentro:" },
      { t: "lista", v: [
        "Agenda: tus pendientes y los del equipo, con fecha y hora.",
        "Documentos: los archivos de la empresa (contratos, licencias, pólizas).",
        "Plan y Protocolo: el plan de Legacy — empieza vacío y se llena con lo de ustedes.",
      ] },
    ],
  },
  {
    id: "proyectos", icono: FolderKanban, titulo: "Proyectos — el trabajo del despacho",
    bloques: [
      { t: "p", v: "Las tareas del equipo organizadas por proyecto. Se pueden crear, empezar, terminar y posponer." },
      { t: "tip", v: "Lo más cómodo es no tocar esta pantalla y decírselo al Copilot." },
    ],
  },
  {
    id: "avisos", icono: Bell, titulo: "Los avisos",
    bloques: [
      { t: "p", v: "El sistema te avisa solo: cuando te asignan algo, 1 hora antes de que venza, 10 minutos antes, y después te pregunta «¿ya pudiste comenzar?»." },
      { t: "p", v: "Siempre dentro del horario de trabajo (10:00 a 21:00). Jamás de madrugada." },
      { t: "p", v: "Al líder le llega un solo resumen del equipo, no veinte mensajes." },
    ],
  },
  {
    id: "caja", icono: Wallet, titulo: "Caja",
    bloques: [
      { t: "p", v: "El libro de ingresos y egresos de Legacy. Lo ven los administradores." },
    ],
  },
  {
    id: "equipo", icono: Users, titulo: "Dar de alta al equipo",
    bloques: [
      { t: "p", v: "En el menú → Usuarios, el administrador crea la cuenta de cada persona con su correo." },
      { t: "p", v: "Quiénes editan el tablero: Shadai y Mario. La dirección entra y mira, sin mover nada." },
    ],
  },
  {
    id: "problemas", icono: AlertTriangle, titulo: "Si algo no sale",
    bloques: [
      { t: "lista", v: [
        "Escribe con tus palabras: el sistema entiende errores de dedo y frases a medias.",
        "Si el Copilot dice que algo no lo sabe, no es tu culpa: falta cargarlo. Avísale al administrador.",
        "Si la pantalla se ve rara, cierra la app y vuelve a entrar. Si insiste, avisa.",
      ] },
    ],
  },
];

/* ── Piezas visuales ─────────────────────────────────────────────────────── */
const Bloque = ({ b }) => {
  if (b.t === "p") return <p style={{ margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: P.txt2, fontFamily: font }}>{b.v}</p>;
  if (b.t === "sub") return <h3 style={{ margin: "24px 0 10px", fontSize: 15, fontWeight: 600, color: P.txt, fontFamily: fontD }}>{b.v}</h3>;
  if (b.t === "lista") return (
    <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
      {b.v.map((x, i) => (
        <li key={i} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.6, color: P.txt2, fontFamily: font }}>
          <span style={{ color: P.accent, flexShrink: 0, marginTop: 1 }}>·</span><span>{x}</span>
        </li>
      ))}
    </ul>
  );
  if (b.t === "numerada") return (
    <ol style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, counterReset: "n" }}>
      {b.v.map((x, i) => (
        <li key={i} style={{ display: "flex", gap: 12, fontSize: 15, lineHeight: 1.6, color: P.txt2, fontFamily: font }}>
          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 8, background: P.accentS, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          <span style={{ paddingTop: 1 }}>{x}</span>
        </li>
      ))}
    </ol>
  );
  if (b.t === "ejemplos") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "0 0 16px" }}>
      {b.v.map(([q, a], i) => (
        <div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: P.glass, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 14.5, color: P.txt, fontFamily: font, lineHeight: 1.5 }}>{q}</div>
          <div style={{ fontSize: 13, color: P.accent, fontFamily: font, marginTop: 4 }}>{a}</div>
        </div>
      ))}
    </div>
  );
  if (b.t === "tip" || b.t === "warn") {
    const esWarn = b.t === "warn";
    const Icono = esWarn ? AlertTriangle : Lightbulb;
    return (
      <div style={{ display: "flex", gap: 11, padding: "13px 15px", borderRadius: 12, margin: "0 0 16px", background: esWarn ? P.warnS : P.accentS, border: `1px solid ${esWarn ? P.warnB : P.accentB}` }}>
        <Icono size={17} color={esWarn ? P.warn : P.accent} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 14.5, lineHeight: 1.6, color: P.txt2, fontFamily: font }}>{b.v}</span>
      </div>
    );
  }
  return null;
};

export default function ManualLegacy() {
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return SECCIONES;
    return SECCIONES.filter(s =>
      s.titulo.toLowerCase().includes(t) ||
      JSON.stringify(s.bloques).toLowerCase().includes(t)
    );
  }, [q]);

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.txt, fontFamily: font, WebkitFontSmoothing: "antialiased" }}>
      {/* Encabezado — centrado, se lee igual en el celular que en la compu */}
      <header style={{ padding: "56px 20px 30px", textAlign: "center", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", background: P.accentS, border: `1px solid ${P.accentB}` }}>
          <FileText size={24} color={P.accent} strokeWidth={1.8} />
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(26px, 6vw, 38px)", fontWeight: 600, letterSpacing: "-0.02em", fontFamily: fontD, color: P.w }}>
          Manual de Stratos IA
        </h1>
        <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 16, lineHeight: 1.6, color: P.txt2 }}>
          Todo lo que hay adentro del espacio de Legacy Design, módulo por módulo, en palabras simples.
        </p>
        <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: P.accent }}>
          La regla que resume todo: si pasó con una casa, va adentro de Stratos.
        </p>
      </header>

      {/* Buscador */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 0" }}>
        <div style={{ position: "relative" }}>
          <Search size={17} color={P.txt3} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en el manual…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "14px 44px", borderRadius: 14,
              background: P.surface, border: `1px solid ${P.border}`, color: P.txt,
              fontSize: 15.5, fontFamily: font, outline: "none",
            }} />
          {q && (
            <button onClick={() => setQ("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: P.txt3, display: "flex" }}>
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Secciones */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 90px" }}>
        {!visibles.length && (
          <p style={{ textAlign: "center", color: P.txt3, fontSize: 15, padding: "40px 0" }}>
            No encontré nada con «{q}».
          </p>
        )}
        {visibles.map((s) => {
          const Icono = s.icono;
          return (
            <section key={s.id} id={s.id} style={{ marginBottom: 44, scrollMarginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: P.accentS, border: `1px solid ${P.accentB}` }}>
                  <Icono size={18} color={P.accent} strokeWidth={1.9} />
                </div>
                <h2 style={{ margin: 0, fontSize: "clamp(19px, 4.6vw, 23px)", fontWeight: 600, letterSpacing: "-0.01em", fontFamily: fontD, color: P.w }}>
                  {s.titulo}
                </h2>
              </div>
              {s.bloques.map((b, i) => <Bloque key={i} b={b} />)}
            </section>
          );
        })}
      </main>

      <footer style={{ padding: "26px 20px 46px", textAlign: "center", borderTop: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, lineHeight: 1.7 }}>
        Este manual es un documento vivo: se actualiza cuando cambia algo.<br />
        Si algo no funciona como dice aquí, dilo — el que está mal es el sistema, no tú.
      </footer>
    </div>
  );
}
