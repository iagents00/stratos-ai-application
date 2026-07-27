/**
 * ManualNSG.jsx — Manual de uso de Stratos IA para NSG
 *
 * Pedido de Ángel (27-jul): «agregá el manual de usuario donde todo Stratos hay
 * para NSG. Funciona todo, todo, cada módulo.»
 *
 * Audiencia: Iván y quien entre nuevo al equipo. Gente NO técnica. Tono simple,
 * español neutro, cero jerga. Una sola página, pensada primero para el CELULAR:
 * todo centrado, tipografía grande, nada que se corte.
 *
 * Vive en /manual-nsg (público, sin login) para poder linkearlo desde
 * "Documentos del Equipo" y mandarlo por chat. Misma familia visual que
 * ManualCRM/ManualMarketing.
 */
import { useState, useMemo } from "react";
import {
  Search, X, Sun, Activity, FolderKanban, Bot, MessagesSquare, Wallet,
  Users, FileText, Smartphone, Bell, Lightbulb, AlertTriangle, CircleCheck,
} from "lucide-react";

const P = {
  bg: "#060A11", surface: "#0A101B", glass: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)", accent: "#F472B6", accentS: "rgba(244,114,182,0.08)",
  accentB: "rgba(244,114,182,0.2)", warn: "#E8A488", warnS: "rgba(232,164,136,0.07)",
  warnB: "rgba(232,164,136,0.22)", w: "#FFFFFF", txt: "#E2E8F0", txt2: "#8A97AA", txt3: "#3D4A5C",
};
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const APP = "https://app.stratoscapitalgroup.com/nsg";

/* ── El contenido, módulo por módulo ─────────────────────────────────────── */
const SECCIONES = [
  {
    id: "empezar", icono: Smartphone, titulo: "Cómo entrar",
    bloques: [
      { t: "p", v: `En la computadora: ${APP}` },
      { t: "p", v: "En el celular: la misma dirección. En Android está el APK; en iPhone se abre en Safari, tocás Compartir y después «Agregar a inicio» — queda como una app en la pantalla." },
      { t: "tip", v: "La primera vez el celular te va a preguntar si permitís notificaciones. Decí que sí: de eso dependen los avisos de llamada, las menciones del chat y el resumen de la mañana." },
      { t: "warn", v: "Si alguna vez la app queda en negro y no abre, esperá unos segundos: se recupera sola. Si insiste, te va a aparecer un botón «Volver a intentar»." },
    ],
  },
  {
    id: "mañana", icono: Sun, titulo: "El resumen de la mañana",
    bloques: [
      { t: "p", v: "A primera hora te llega solo: qué venció, qué hay para hoy, en qué va cada cliente y cómo está la caja." },
      { t: "p", v: "Llega al teléfono y también queda en la campanita del CRM. No tenés que preguntarle nada a nadie para saber a dónde vas." },
    ],
  },
  {
    id: "comando", icono: Activity, titulo: "Comando — el tablero",
    bloques: [
      { t: "p", v: "Es la primera pantalla. De un vistazo:" },
      { t: "lista", v: [
        "El pulso del trabajo: qué está vencido, qué es de hoy, qué está en curso y qué se cerró.",
        "Cada cliente con sus objetivos y una barra de cuánto se avanzó.",
        "Los proyectos en los que estamos.",
        "La caja del mes y cuánto se le debe a cada uno.",
      ] },
    ],
  },
  {
    id: "proyectos", icono: FolderKanban, titulo: "Proyectos — el trabajo",
    bloques: [
      { t: "p", v: "Ahí viven los proyectos y las tareas. Se pueden crear, empezar, terminar y posponer." },
      { t: "p", v: "Si algo se te pasa, el sistema te persigue: te avisa una hora antes, diez minutos antes, y después te pregunta «¿ya pudiste comenzar?» — siempre dentro de tu horario de trabajo, no a las 2 de la mañana." },
      { t: "tip", v: "Lo más cómodo es no tocar esta pantalla y decírselo al Copilot." },
    ],
  },
  {
    id: "copilot", icono: Bot, titulo: "Copilot — hablarle al sistema",
    bloques: [
      { t: "p", v: "Es el chat. Le hablás como le hablarías a una persona:" },
      { t: "ejemplos", v: [
        ["«ponme una tarea: llamar a Duke el jueves»", "la crea con fecha"],
        ["«ya terminé lo del reporte»", "la cierra"],
        ["«pospón lo de la propuesta para mañana a las 3»", "la mueve"],
        ["«¿qué tengo hoy?»", "te lista tu día"],
        ["«crea el proyecto Mueblería»", "lo crea"],
        ["«¿en qué va Duke?»", "te da el expediente y el avance de sus objetivos"],
        ["«apunta que a Duke le entregamos el módulo de marketing»", "lo deja en la bitácora del cliente"],
        ["«armá la cuenta de cobro de Duke de esta quincena»", "arma el borrador"],
        ["«pasame el manual de uso»", "te trae este documento"],
        ["«¿qué dice la nota de…?»", "busca en las ~200 notas del cerebro"],
      ] },
      { t: "p", v: "El botón del clip sirve para mandarle una imagen. Te va a preguntar qué es: si entró plata, si salió plata, o si es la evidencia de una tarea. Si es un pago, queda registrado en la Caja con la captura de soporte." },
      { t: "tip", v: "El Copilot está acá y en Telegram: los dos usan el mismo cerebro, así que da igual por dónde le hables." },
    ],
  },
  {
    id: "chat", icono: MessagesSquare, titulo: "Chat del equipo — reemplaza al WhatsApp",
    bloques: [
      { t: "p", v: "Está organizado en canales (General, Desarrollo, Clientes, y los que quieras crear con el «+»)." },
      { t: "lista", v: [
        "Escribís y le llega al otro al instante, sin recargar nada.",
        "Mencioná con @ (por ejemplo @Iván) y a esa persona le suena el teléfono. Es la única forma de que algo no se pierda en el scroll.",
        "Podés adjuntar archivos y capturas; quedan ahí, no en una conversación de WhatsApp que después nadie encuentra.",
        "Doble clic sobre un mensaje para responderlo.",
      ] },
      { t: "warn", v: "Por qué importa: cuando el plan del día llega por WhatsApp, el sistema no lo ve y no puede hacer nada con él. Cuando llega acá, sí." },
    ],
  },
  {
    id: "caja", icono: Wallet, titulo: "Caja — la plata",
    bloques: [
      { t: "p", v: "Tiene tres apartados arriba: Movimientos, Nómina y Cuentas de cobro." },
      { t: "sub", v: "Movimientos" },
      { t: "p", v: "Todo lo que entra y sale. La contabilidad se mira desde NSG: Duke le paga a NSG (ingreso de la empresa) y NSG paga la nómina (egreso de NSG + ingreso de la persona). Ni Iván ni Ángel tienen egresos: ellos solo reciben." },
      { t: "p", v: "Los servicios (Claude, Retell, Sidance…) son egresos de NSG, aunque los pague la tarjeta de Duke: igual tienen que estar en la contabilidad." },
      { t: "p", v: "Filtros: «Lo mío», «NSG» y «Todo», y las secciones Nómina, Servicios y Clientes. Cada pago sin comprobante tiene un botón «Agregar soporte» para pegarle la captura después; y si ya lo tiene, «Ver comprobante» lo abre y lo podés descargar." },
      { t: "sub", v: "Nómina" },
      { t: "p", v: "Cuánto le toca a cada uno y cada cuánto — y se puede cambiar si mañana sube. Muestra lo que lleva ganado, lo que ya cobró y lo que falta. Se cuenta por quincenas completas desde que arrancó cada uno." },
      { t: "tip", v: "Cambiar el monto aplica de hoy en adelante: no reescribe lo que ya se pagó." },
      { t: "sub", v: "Cuentas de cobro" },
      { t: "p", v: "El borrador se arma solo con lo que de verdad se cerró en la quincena (las tareas terminadas y los objetivos que se movieron). Vos ponés el monto — el sistema no adivina cuánto se cobra — y bajás el Word para firmarlo a mano. Después lo marcás «ya la firmé» y «ya la pagaron»." },
    ],
  },
  {
    id: "clientes", icono: Users, titulo: "Pipeline y equipo",
    bloques: [
      { t: "p", v: "En el CRM cada registro es una inmobiliaria prospecto en su camino hacia «usando Stratos». Duke ya está en Activa, con sus objetivos y su bitácora." },
      { t: "p", v: "En «Usuarios» se da de alta gente nueva del equipo: creás su perfil y desde ese momento entra al chat, recibe avisos y tiene su propio Mi Día." },
    ],
  },
  {
    id: "documentos", icono: FileText, titulo: "Documentos",
    bloques: [
      { t: "p", v: "En «Mi Espacio → Documentos» están los enlaces del equipo. Y las ~200 notas del cerebro (contexto del negocio, decisiones, reuniones, cómo hacemos las cosas, entregables) se las podés pedir directo al Copilot en vez de buscarlas a mano." },
    ],
  },
  {
    id: "solo", icono: Bell, titulo: "Lo que el sistema hace solo",
    bloques: [
      { t: "lista", v: [
        "Lee las reuniones y los reportes del día y mueve el progreso solo. Si en una llamada decís «ya pagué Retell», deja de recordártelo.",
        "Persigue las tareas que se están venciendo, en el horario de cada quien.",
        "Manda el resumen de la mañana.",
        "Avisa el día de pago (15 y 30).",
        "Registra los gastos que mandás por Telegram (texto, audio o foto del ticket).",
      ] },
      { t: "warn", v: "Lo que toca plata nunca se aplica solo. Si el sistema entiende que se pagó algo, te lo pregunta antes de tocarlo. Es a propósito." },
    ],
  },
  {
    id: "costumbres", icono: CircleCheck, titulo: "Las 5 costumbres",
    bloques: [
      { t: "numerada", v: [
        "Todo adentro. Nada de plan del día por WhatsApp, nada de documentos sueltos.",
        "Hablale al Copilot en vez de llenar formularios. Es más rápido y queda igual de bien.",
        "Mencioná con @ cuando algo es para el otro. Es lo único que le suena el teléfono.",
        "Contá lo que pasó, aunque sea en una frase. El sistema conecta el resto.",
        "Si algo se ve mal, decilo. No lo arregles por afuera: si se arregla afuera, vuelve a pasar.",
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

export default function ManualNSG() {
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
          Todo lo que hay adentro del espacio de NSG, módulo por módulo, en palabras simples.
        </p>
        <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: P.accent }}>
          La regla que resume todo: si pasó, va adentro de Stratos.
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
        Si algo no funciona como dice acá, decilo — el que está mal es el sistema, no vos.
      </footer>
    </div>
  );
}
