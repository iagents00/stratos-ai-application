/**
 * ManualMuebleria.jsx — Manual de uso de Stratos IA para la MUEBLERÍA
 *
 * Audiencia: la gente del taller (corte, armado, laca, entregas, encargado).
 * 0-técnicos: a lo mucho manejan un celular. Español NEUTRO (tú), tono cercano
 * de taller, cero jerga, tipografía grande. Vive en /manual-muebleria (público,
 * sin login) para linkearlo desde Documentos y mandarlo por chat.
 * Familia visual ManualNSG/ManualBrasa.
 */
import { useState, useMemo } from "react";
import {
  Search, X, Activity, FolderKanban, Bot, Wallet,
  Users, FileText, Smartphone, Bell, Lightbulb, AlertTriangle,
} from "lucide-react";

const P = {
  bg: "#0C0905", surface: "#151006", glass: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)", accent: "#F59E0B", accentS: "rgba(245,158,11,0.09)",
  accentB: "rgba(245,158,11,0.24)", warn: "#E8A488", warnS: "rgba(232,164,136,0.07)",
  warnB: "rgba(232,164,136,0.22)", w: "#FFFFFF", txt: "#EFE7DA", txt2: "#AA9D89", txt3: "#5C503E",
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP = "https://app.stratoscapitalgroup.com/muebleria";

/* ── El contenido, módulo por módulo ─────────────────────────────────────── */
const SECCIONES = [
  {
    id: "empezar", icono: Smartphone, titulo: "Cómo entrar",
    bloques: [
      { t: "p", v: `En la computadora: ${APP}` },
      { t: "p", v: "En el celular: la misma dirección. En iPhone se abre en Safari, tocas Compartir y después «Agregar a inicio»: queda como una app en la pantalla." },
      { t: "tip", v: "La primera vez el celular pregunta si permites notificaciones. Di que sí: de eso dependen los avisos de tus pendientes." },
    ],
  },
  {
    id: "copilot", icono: Bot, titulo: "Copilot — háblale como a una persona",
    bloques: [
      { t: "p", v: "Es el chat del taller. Escríbele o díctale con el micrófono, con tus palabras. Entiende aunque escribas con errores:" },
      { t: "ejemplos", v: [
        ["«ponme una tarea: pedir la laca mañana a las 10»", "la crea y te avisa antes"],
        ["«que Juan arme el comedor de los López el jueves»", "se la asigna y el sistema la persigue"],
        ["«¿qué tengo hoy?»", "te lista tu día"],
        ["«recuérdame a las 5 confirmar la entrega del ropero»", "te avisa a la hora exacta"],
        ["«ya quedó lo de la laca»", "cierra la tarea"],
        ["«¿cómo va el comedor de los López?»", "te dice en qué etapa está el pedido"],
        ["«¿qué puedes hacer?»", "te explica todo esto"],
      ] },
      { t: "tip", v: "Si le preguntas algo que no sabe, te lo dice con honestidad y te ofrece lo que sí puede. Nunca se queda callado." },
    ],
  },
  {
    id: "pedidos", icono: FolderKanban, titulo: "Pedidos — el tablero del taller",
    bloques: [
      { t: "p", v: "Cada pedido es una tarjeta y avanza por sus etapas: Cotización, Anticipo recibido, Corte, Armado, Laca, Entrega, y Ajustes y garantía." },
      { t: "warn", v: "La etapa que manda es «Anticipo recibido»: sin anticipo no se corta madera. Un pedido no pasa a Corte si no está el dinero." },
      { t: "p", v: "En la tarjeta de cada pedido vive su próxima acción: qué sigue y para cuándo. Si alguien pregunta «¿cuándo está el comedor?», se abre el tablero y está." },
    ],
  },
  {
    id: "miespacio", icono: Activity, titulo: "Mi Espacio — tu agenda",
    bloques: [
      { t: "p", v: "Está en el menú de la izquierda. Adentro:" },
      { t: "lista", v: [
        "Agenda: tus pendientes y los del equipo, con fecha y hora.",
        "Documentos: los papeles de la mueblería (este manual, cotizaciones, lo que carguen).",
        "Equipo: ver y repartir el trabajo de cada quien.",
      ] },
    ],
  },
  {
    id: "caja", icono: Wallet, titulo: "Caja — el dinero del taller",
    bloques: [
      { t: "p", v: "Lo que entra y lo que sale, anotado el mismo día: el anticipo de un pedido, la madera, la laca, cualquier gasto." },
      { t: "lista", v: [
        "Cada movimiento se anota en el momento: dos toques y ya.",
        "Al final de la semana o del mes, la historia completa está ahí sola, sin cuadernos.",
        "La ven los administradores.",
      ] },
    ],
  },
  {
    id: "avisos", icono: Bell, titulo: "Los avisos",
    bloques: [
      { t: "p", v: "El sistema te avisa solo: cuando te asignan algo, 1 hora antes de que venza, 10 minutos antes, y después te pregunta «¿ya pudiste comenzar?»." },
      { t: "p", v: "Siempre dentro del horario de trabajo. Jamás de madrugada." },
      { t: "p", v: "Al encargado le llega un solo resumen del equipo, no veinte mensajes." },
    ],
  },
  {
    id: "equipo", icono: Users, titulo: "Dar de alta al equipo",
    bloques: [
      { t: "p", v: "En el menú → Usuarios, el administrador crea la cuenta de cada persona con su correo." },
      { t: "p", v: "Apenas alguien tiene cuenta, el Copilot ya lo reconoce: «que Juan lije el ropero» le llega a Juan." },
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

export default function ManualMuebleria() {
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
      <header style={{ padding: "56px 20px 30px", textAlign: "center", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", background: P.accentS, border: `1px solid ${P.accentB}` }}>
          <FileText size={24} color={P.accent} strokeWidth={1.8} />
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(26px, 6vw, 38px)", fontWeight: 600, letterSpacing: "-0.02em", fontFamily: fontD, color: P.w }}>
          Manual de Stratos IA
        </h1>
        <p style={{ margin: "10px auto 0", maxWidth: 520, fontSize: 16, lineHeight: 1.6, color: P.txt2 }}>
          Todo lo que hay adentro del espacio de la Mueblería, módulo por módulo, en palabras simples.
        </p>
        <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: P.accent }}>
          La regla que resume todo: si hay que hacerlo, se anota — y el sistema lo persigue solo.
        </p>
      </header>

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
