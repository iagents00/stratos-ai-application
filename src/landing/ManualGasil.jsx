/**
 * ManualGasil.jsx — Manual de uso de Stratos IA para GASIL RADIODIAGNÓSTICO DEL VALLE
 *
 * Audiencia: la gente del centro de imagen (recepción, técnicos radiólogos, la
 * dirección). 0-técnicos: a lo mucho manejan un celular. Español NEUTRO (tú),
 * cero jerga, tipografía grande. Vive en /manual-gasil (público, sin login) para
 * linkearlo desde Documentos y mandarlo por chat. Familia visual ManualNSG.
 *
 * Regla propia de este tenant, que aparece dos veces a propósito: el asistente NO
 * inventa preparaciones ni precios. Es un centro médico y un ayuno mal dicho manda
 * al paciente de vuelta a su casa.
 */
import { useState, useMemo } from "react";
import {
  Search, X, Activity, ClipboardList, Bot, Wallet, Stethoscope,
  Users, FileText, Smartphone, Bell, Lightbulb, AlertTriangle,
} from "lucide-react";

const P = {
  bg: "#0B0710", surface: "#150E18", glass: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)", accent: "#E455B4", accentS: "rgba(228,85,180,0.09)",
  accentB: "rgba(228,85,180,0.24)", warn: "#E8B488", warnS: "rgba(232,180,136,0.07)",
  warnB: "rgba(232,180,136,0.22)", w: "#FFFFFF", txt: "#EDE6EE", txt2: "#A99BAB", txt3: "#5C4E5E",
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP = "https://app.stratoscapitalgroup.com/gasil";

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
    id: "para-que", icono: FileText, titulo: "Para qué sirve esto",
    bloques: [
      { t: "p", v: "Para tres cosas, y todo lo demás es detalle:" },
      { t: "numerada", v: [
        "Que ningún mensaje se quede sin contestar. El que pregunta un sábado y nadie le responde hasta el lunes, se hace el estudio en otro lado.",
        "Que ningún estudio se quede sin entregar.",
        "Que cada quien sepa qué le toca hoy, sin que nadie ande recordándoselo.",
      ] },
    ],
  },
  {
    id: "prospectos", icono: Bell, titulo: "Prospectos — los que todavía no vienen",
    bloques: [
      { t: "p", v: "Acá está todo el que preguntó pero aún no pisa el centro. Cada persona es una tarjeta y va avanzando de columna. El nombre de la columna dice qué hay que hacer:" },
      { t: "ejemplos", v: [
        ["Mensaje nuevo", "escribió y nadie le ha respondido"],
        ["Ya se le informó", "sabe el precio y qué incluye; falta ponerle día"],
        ["Cita agendada", "tiene día y hora"],
        ["Preparación enviada", "ya sabe si viene en ayunas y qué traer"],
        ["No se presentó", "tenía cita y no vino: hay que recuperarlo"],
        ["No agendó", "preguntó y no siguió; anota siempre el motivo"],
      ] },
      { t: "tip", v: "La columna «Mensaje nuevo» es la más importante del sistema: cada tarjeta ahí es una persona esperando respuesta. Si está vacía al final del día, el día salió bien." },
    ],
  },
  {
    id: "pacientes", icono: ClipboardList, titulo: "Pacientes — los que ya vinieron",
    bloques: [
      { t: "p", v: "En cuanto la persona viene y se le hace el estudio, pasa a este tablero. Acá lo que importa es entregarle su resultado y traerla de vuelta:" },
      { t: "ejemplos", v: [
        ["Estudio realizado", "vino y se le hizo"],
        ["Esperando interpretación", "el radiólogo lo está leyendo y firmando"],
        ["Resultados entregados", "impresos o por la Aplicación Gasil"],
        ["Toca control", "hay que llamarle más adelante: la mamografía del año, el seguimiento del embarazo"],
      ] },
      { t: "tip", v: "La tarjeta se mueve arrastrándola, o diciéndoselo al asistente: «ya se le entregaron los resultados a la señora Martínez»." },
    ],
  },
  {
    id: "medicos", icono: Stethoscope, titulo: "Médicos — el tercer tablero",
    bloques: [
      { t: "p", v: "Buena parte de los pacientes no llega sola: la mandan médicos de la zona. Médicos generales que mandan placas, ginecólogos que mandan ultrasonidos, dentistas sin equipo que mandan panorámicas." },
      { t: "p", v: "Ese tablero va así: Médico por visitar, Visita hecha, Ya nos mandó pacientes, Nos manda seguido, y Dejó de mandar." },
      { t: "tip", v: "«Dejó de mandar» es la columna que más dinero vale. Un médico que mandaba pacientes y se apagó ya conoce el lugar y ya confió una vez: recuperarlo es más barato que conseguir uno nuevo. Cuando alguien caiga ahí, prográmale una visita." },
    ],
  },
  {
    id: "preparacion", icono: AlertTriangle, titulo: "La preparación de los estudios",
    bloques: [
      { t: "p", v: "Antes de dar cualquier indicación, pregunta QUÉ ESTUDIO le pidieron. «Un ultrasonido» no dice nada: el de hígado y vesícula lleva ayuno de 8 horas, y el 3D o 4D es otro proceso." },
      { t: "warn", v: "El asistente no inventa preparaciones. Si de ese estudio todavía no hay indicación cargada, te lo dice y lo pasas con el personal. Es a propósito: una preparación mal dicha hace que el paciente venga en ayunas sin necesidad, o que llegue sin ayuno y pierda el viaje." },
      { t: "p", v: "Lo mismo con los precios: mientras la lista no esté cargada, el asistente no estima. Se responde «déjame confirmarlo y en un momento te digo»." },
      { t: "p", v: "Al agendar conviene preguntar siempre tres cosas: qué estudio le pidieron, si trae orden médica, y si tiene estudios anteriores de lo mismo para traerlos." },
    ],
  },
  {
    id: "copilot", icono: Bot, titulo: "El asistente — háblale como a una persona",
    bloques: [
      { t: "p", v: "Es el chat del centro. Escríbele o dictale con el micrófono, con tus palabras — entiende aunque escribas con errores:" },
      { t: "ejemplos", v: [
        ["«ponme una tarea: llamar mañana a las 10 a los que no se presentaron»", "la crea y te avisa antes"],
        ["«que recepción entregue los resultados del señor López el jueves»", "se la asigna y el sistema la persigue"],
        ["«recuérdame en 2 horas mandar los resultados de la señora Martínez»", "te avisa a la hora exacta"],
        ["«¿qué tengo hoy?»", "te lista tu día"],
        ["«¿qué preparación lleva el ultrasonido de hígado?»", "te responde con lo que sabe del centro"],
        ["«¿qué estudios hacemos?»", "te da la lista completa"],
        ["«¿qué puedes hacer?»", "te explica todo esto"],
      ] },
      { t: "tip", v: "Si le preguntas algo que no sabe, te lo dice con honestidad y te ofrece lo que sí puede. Nunca se queda callado ni se inventa una respuesta." },
    ],
  },
  {
    id: "miespacio", icono: Activity, titulo: "Mi Espacio — tu agenda",
    bloques: [
      { t: "p", v: "Está en el menú de la izquierda. Adentro:" },
      { t: "lista", v: [
        "Agenda: tus pendientes y los del equipo, con fecha y hora.",
        "Documentos: los papeles del centro (este manual, y lo que carguen).",
        "Equipo: ver y repartir las actividades de cada quien.",
      ] },
    ],
  },
  {
    id: "caja", icono: Wallet, titulo: "Caja — el dinero del día",
    bloques: [
      { t: "p", v: "Lo que entra y lo que sale, anotado el mismo día. Cada movimiento son dos toques." },
      { t: "p", v: "Sirve para no tener que ir hasta el centro a ver cómo va la semana: al final del mes la historia completa está ahí sola, sin cuadernos." },
      { t: "p", v: "La ven los administradores." },
    ],
  },
  {
    id: "avisos", icono: Bell, titulo: "Los avisos",
    bloques: [
      { t: "p", v: "El sistema te avisa solo: cuando te asignan algo, 1 hora antes de que venza, 10 minutos antes, y después te pregunta si ya pudiste comenzar." },
      { t: "p", v: "Siempre dentro del horario de trabajo. Jamás de madrugada." },
      { t: "p", v: "A quien coordina le llega un solo resumen del equipo, no veinte mensajes." },
    ],
  },
  {
    id: "equipo", icono: Users, titulo: "Dar de alta al equipo",
    bloques: [
      { t: "p", v: "En el menú → Usuarios, el administrador crea la cuenta de cada persona con su correo." },
      { t: "p", v: "Apenas alguien tiene cuenta, el asistente ya lo reconoce: «que Lupita llame a los de control» le llega a Lupita." },
    ],
  },
  {
    id: "problemas", icono: AlertTriangle, titulo: "Si algo no sale",
    bloques: [
      { t: "lista", v: [
        "Escribe con tus palabras: el sistema entiende errores de dedo y frases a medias.",
        "Si el asistente dice que algo no lo sabe, no es tu culpa: falta cargarlo. Avísale al administrador.",
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
    <ol style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
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

export default function ManualGasil() {
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
          Todo lo que hay adentro del espacio de Gasil Radiodiagnóstico del Valle, módulo por módulo, en palabras simples.
        </p>
        <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: P.accent }}>
          La regla que resume todo: ningún mensaje sin contestar, ningún estudio sin entregar.
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
