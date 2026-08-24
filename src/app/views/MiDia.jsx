/**
 * app/views/MiDia.jsx — La lista del día (Stratos Rails, v0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Máximo SIETE tarjetas. No es una preferencia estética: una lista larga es una
 * lista que no se termina, y la que no se termina se abandona. El resto de la
 * cartera queda a un tap.
 *
 * Cada tarjeta es una intención de implementación, no un recordatorio. Por eso
 * el elemento más grande NO es el nombre del cliente: es la RAZÓN — qué pasó y
 * por qué hoy. Y siempre cierra con qué hay que pedir. Nunca "dar seguimiento
 * a X", que no es una acción sino una etiqueta.
 *
 * Al completar: fade + slide de 240 ms y el contador sube. Sin confeti, sin
 * sonido, sin medalla — la celebración es que la tarjeta desaparece y el número
 * avanza, en el mismo frame.
 *
 * v0 = solo lectura sobre los leads que ya tiene el CRM en memoria, con el
 * motor puro de lib/next-action-engine.js. Todavía NO escribe en agenda_items
 * (esa tabla llega en la migración 032): "Hecho" es optimista y local.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Phone, MessageCircle, Check, X, CalendarClock, Plus, LayoutGrid } from "lucide-react";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { listaDelDia, proximaAccion, MAX_DEL_DIA } from "../../lib/next-action-engine";
import { hrefDelCanal } from "../../lib/telefono";
import { agendaDeHoy, marcarAccion } from "../../lib/agenda";

/* Un solo punto de color por tarjeta, de 6px. Sin iconos decorativos. */
const COLOR_CUBETA = { prioritario: "accent", intermedio: "amber", reactivar: "blue" };

const ICONO_CANAL = { llamada: Phone, whatsapp: MessageCircle, zoom: CalendarClock };

// Tres opciones, no un calendario. Elegir día y hora en un date-picker toma
// diez segundos y rompe el ritmo de una lista que se trabaja en cinco minutos;
// además, "mañana" y "la próxima semana" es como el asesor ya piensa el
// seguimiento. Si necesita una fecha exacta, la pone en la ficha del cliente.
const OPCIONES_MOVER = [
  { dias: 1, label: "Mañana" },
  { dias: 3, label: "En 3 días" },
  { dias: 7, label: "La próxima semana" },
];

function Tarjeta({ accion, indice, total, T, isLight, onCerrar, onMover }) {
  const [saliendo, setSaliendo] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const color = T[COLOR_CUBETA[accion.cubeta]] || T.accent;
  const IconoCanal = ICONO_CANAL[accion.canal] || Phone;
  const esWhatsApp = accion.canal === "whatsapp";
  // El mensaje ya lleva la instrucción del día: el asesor abre WhatsApp con el
  // contexto puesto, en vez de mirar un chat en blanco.
  const enlace = hrefDelCanal(accion.canal, accion.telefono, esWhatsApp ? accion.pedir : null);

  const cerrar = (estado, detalle = null) => {
    setSaliendo(true);
    // 240 ms: lo que dura el fade. Se avisa al final para que el contador suba
    // en el mismo frame en que la tarjeta termina de irse.
    setTimeout(() => onCerrar(accion.leadId, estado, detalle), 240);
  };

  const btn = (extra = {}) => ({
    minHeight: 44, padding: "0 16px", borderRadius: 11, fontFamily: font,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "inline-flex",
    alignItems: "center", gap: 7, whiteSpace: "nowrap",
    border: `1px solid ${T.borderH || T.border}`, background: "transparent",
    color: T.txt2, ...extra,
  });

  return (
    <article
      style={{
        background: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.028)",
        border: `1px solid ${T.border}`, borderRadius: P.r,
        padding: "20px 22px", marginBottom: 12,
        opacity: saliendo ? 0 : 1,
        transform: saliendo ? "translateX(24px)" : "none",
        transition: "opacity 240ms ease, transform 240ms ease",
      }}
    >
      {/* Orden + canal: lo más chico de la tarjeta. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: font, fontSize: 11, color: T.txt3, letterSpacing: "0.04em" }}>
          {indice} de {total} · {accion.canal === "whatsapp" ? "WhatsApp" : "Llamada"} · {accion.eta}
        </span>
      </div>

      <h3 style={{
        margin: "0 0 8px", fontFamily: fontDisp, fontSize: 28, fontWeight: 700,
        letterSpacing: "-0.025em", color: T.txt, lineHeight: 1.1,
      }}>
        {accion.nombre}
      </h3>

      {/* LA RAZÓN. Es lo que más importa de la tarjeta. */}
      <p style={{ margin: "0 0 12px", fontFamily: font, fontSize: 16, lineHeight: 1.5, color: T.txt2 }}>
        {accion.razon}
      </p>

      {/* Qué hay que pedir. */}
      <p style={{ margin: "0 0 16px", fontFamily: font, fontSize: 15, lineHeight: 1.45, color: color }}>
        → {accion.pedir}
      </p>

      {accion.contexto?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {accion.contexto.map((c) => (
            <span key={c} style={{
              fontFamily: font, fontSize: 11.5, color: T.txt3,
              border: `1px solid ${T.border}`, borderRadius: 999, padding: "4px 10px",
            }}>{c}</span>
          ))}
        </div>
      )}

        {/* "Mover" antes solo hacía desaparecer la tarjeta: no agendaba nada, no
            tocaba la próxima acción del cliente, no dejaba compromiso. En un
            sistema cuya premisa es que ningún cliente se cae, ese era el agujero
            más grande. Ahora mover obliga a decir CUÁNDO, y eso se escribe en la
            ficha del cliente igual que si lo hubieras puesto desde el pipeline. */}
        {eligiendo ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: T.txt2, fontFamily: font, marginRight: 2 }}>
              ¿Cuándo lo retomas?
            </span>
            {OPCIONES_MOVER.map((o) => (
              <button
                key={o.dias}
                onClick={() => {
                  const fecha = onMover?.(accion, o.dias);
                  // La agenda guarda A QUÉ DÍA se movió, no solo que se movió:
                  // "lo pospuse" sin fecha no es información, es ruido.
                  cerrar("movido", fecha ? `Retoma ${fecha}` : `Retoma en ${o.dias} d`);
                }}
                style={btn({ color: T.txt })}
              >{o.label}</button>
            ))}
            <button onClick={() => setEligiendo(false)} style={btn()}>Cancelar</button>
          </div>
        ) : (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* El botón decía "Escribir" y el enlace era `tel:` SIEMPRE: en las
            tarjetas de WhatsApp abría el marcador telefónico. Y varias reglas
            sugieren WhatsApp a propósito — la regla 3 de Rails dice que pasadas
            20 h el teléfono deja de ser el canal primario. Ahora el enlace lo
            decide el canal, con el código de país que wa.me exige. */}
        {enlace && (
          <a
            href={enlace.href}
            {...(enlace.externo ? { target: "_blank", rel: "noreferrer" } : {})}
            style={{ ...btn({ background: color, color: "#041016", border: "none", textDecoration: "none" }) }}
          >
            <IconoCanal size={15} strokeWidth={2.2} /> {esWhatsApp ? "Escribir" : "Llamar"}
          </a>
        )}
        <button onClick={() => cerrar("hecho")} style={btn({ color: T.txt })}>
          <Check size={15} strokeWidth={2.2} /> Hecho
        </button>
        <button onClick={() => cerrar("no_contesto")} style={btn()}>
          <X size={15} strokeWidth={2.2} /> No contestó
        </button>
        <button onClick={() => setEligiendo(true)} style={btn()}>
          <CalendarClock size={15} strokeWidth={2.2} /> Mover
        </button>
      </div>
      )}
    </article>
  );
}

/** Dos listas son "la misma" si traen los mismos clientes, en el mismo orden y
 *  pidiendo lo mismo. Compara lo que el asesor ve, no identidad de objetos. */
function mismaLista(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) =>
    x.leadId === b[i].leadId && x.razon === b[i].razon && x.pedir === b[i].pedir);
}

export default function MiDia({ leads = [], T: Tprop, theme = "dark", config = null, recienRegistrado = null, onNuevoCliente, onVerCRM, onMover }) {
  const isLight = theme === "light";
  const T = Tprop || (isLight ? LP : P);

  const [cerradas, setCerradas] = useState({});   // leadId -> estado

  // ── LA LISTA DEL DÍA NO SE MUEVE SOLA ──────────────────────────────────
  // `leads` cambia de referencia seguido (el CRM sondea cada 5s y hay realtime),
  // y cada recálculo usa un `ahora` nuevo. Sin congelar, una tarjeta que sigue
  // siendo válida se reordena o se CAE de la lista mientras el asesor la está
  // trabajando: verificado en producción — a los 10 segundos, sin tocar nada, el
  // primero de la lista desapareció solo. Si estás marcando el teléfono de
  // alguien y su tarjeta se esfuma, el proceso deja de ser confiable, y un
  // proceso en el que no confías no se usa.
  //
  // Entonces: el orden y la membresía se deciden UNA vez y se sostienen. Después
  // solo pueden AGREGARSE clientes nuevos, al final. Nada que ya está en pantalla
  // se va ni se mueve, salvo que el asesor lo cierre.
  // La configuración de la organización decide qué reglas corren, con qué peso,
  // con qué texto y cuántas tarjetas caben. Ver lib/rails-config.js.
  const fresca = useMemo(() => listaDelDia(leads, { config }), [leads, config]);
  const [congelada, setCongelada] = useState(null);
  const [ultimaFresca, setUltimaFresca] = useState(null);

  // Ajuste de estado durante el render (patrón documentado de React): React
  // reintenta el render antes de pintar, así que no hay parpadeo ni cascada.
  // Va acá y no en un useEffect para que la lista quede resuelta en el MISMO
  // render — con un efecto, el asesor vería un frame con el orden viejo.
  // Un cambio de CONFIGURACIÓN sí rompe el congelado, y debe: si un admin apagó
  // una regla o reescribió un texto, fue un acto deliberado y la lista tiene que
  // reflejarlo ya. Lo que no puede moverla sola es el paso del tiempo o un
  // sondeo del CRM. La tienda de config solo publica cuando algo cambió de
  // verdad, así que comparar por identidad alcanza.
  const [ultimaConfig, setUltimaConfig] = useState(config);
  const configCambio = config !== ultimaConfig;
  if (configCambio) setUltimaConfig(config);

  // Un cliente que el asesor ACABA de registrar va hasta arriba, aunque la lista
  // ya esté llena. Es la única excepción a "nada se cuela": no es el sistema
  // moviéndole el piso, es él viendo lo que él mismo creó hace tres segundos. Y
  // es la tarjeta más urgente que existe — la contactabilidad cae 100× entre el
  // minuto 5 y el 30, así que mandarla al lugar 8 de una lista de 7 es tirarla.
  const [ultimoNuevo, setUltimoNuevo] = useState(recienRegistrado);
  const hayNuevo = !!recienRegistrado && recienRegistrado !== ultimoNuevo;
  if (hayNuevo) setUltimoNuevo(recienRegistrado);

  if (fresca !== ultimaFresca || configCambio || hayNuevo) {
    setUltimaFresca(fresca);
    setCongelada((prev) => {
      if (!prev || configCambio) return fresca.visibles;


      const porId   = new Map(fresca.visibles.map((a) => [a.leadId, a]));
      const yaEstan = new Set(prev.map((a) => a.leadId));

      // Lo ya mostrado se queda, en su lugar. Si el motor dejó de proponer acción
      // para ese cliente (cambió de etapa, lo tocaron desde el móvil), se conserva
      // la última que sí tuvo: la tarjeta no puede evaporarse bajo el asesor.
      const sostenidas = prev.map((a) => porId.get(a.leadId) || a);
      // Los que entraron después van al final, nunca intercalados. Un lead recién
      // registrado SÍ tiene que aparecer: es la tarjeta más valiosa del sistema.
      const nuevas = fresca.visibles.filter((a) => !yaEstan.has(a.leadId));
      const tope    = config?.maxTarjetas || MAX_DEL_DIA;
      let sig = sostenidas.concat(nuevas);

      // El recién registrado, al frente. Se calcula su acción aparte porque
      // listaDelDia ya cortó en el tope y podría haber quedado fuera.
      if (hayNuevo) {
        const lead = leads.find((l) => l.id === recienRegistrado);
        const suya = lead ? proximaAccion(lead, new Date(), config) : null;
        if (suya) sig = [suya, ...sig.filter((a) => a.leadId !== recienRegistrado)];
      }

      sig = sig.slice(0, tope);

      // Devolver `prev` hace que React se salte el render. Sin esto, cada sondeo
      // de 5s repintaría la lista aunque nada haya cambiado.
      return mismaLista(prev, sig) ? prev : sig;
    });
  }

  // Antes de que corra el efecto (primer pintado) se usa la fresca: sin parpadeo.
  const visibles = congelada ?? fresca.visibles;
  const total = fresca.total;

  const pendientes = visibles.filter((a) => !cerradas[a.leadId]);
  const hechas = visibles.length - pendientes.length;

  // Lo que ya se cerró hoy no vuelve a aparecer, ni siquiera tras un F5.
  useEffect(() => {
    let vivo = true;
    agendaDeHoy().then((mapa) => { if (vivo) setCerradas((prev) => ({ ...mapa, ...prev })); });
    return () => { vivo = false; };
  }, []);

  const cerrar = useCallback((leadId, estado, detalle = null) => {
    // Optimista a propósito: la tarjeta se va en el acto y el guardado ocurre
    // detrás. Si falla, se avisa en consola pero no se le devuelve la tarjeta
    // al asesor — nada peor que trabajar algo y que reaparezca.
    setCerradas((prev) => ({ ...prev, [leadId]: estado }));
    const accion = visibles.find((a) => a.leadId === leadId);
    if (accion) marcarAccion(accion, estado === "no_contesto" ? "saltado" : estado, detalle);
  }, [visibles]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "4px 0 24px" }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{
          margin: "0 0 4px", fontFamily: font, fontSize: 11, letterSpacing: "0.14em",
          textTransform: "uppercase", color: T.txt3,
        }}>Mi Día</p>
        <h2 style={{
          margin: 0, fontFamily: fontDisp, fontSize: 30, fontWeight: 800,
          letterSpacing: "-0.03em", color: T.txt,
        }}>
          {pendientes.length > 0
            ? `${pendientes.length} ${pendientes.length === 1 ? "acción" : "acciones"}`
            : hechas > 0
              ? "Terminaste tu día"
              : "Nada que trabajar todavía"}
        </h2>
        <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 13.5, color: T.txt2 }}>
          {hechas > 0 && <strong style={{ color: T.accent }}>{hechas} hecha{hechas !== 1 ? "s" : ""} · </strong>}
          {total > visibles.length
            ? `${total} en total en tu cartera. Estas son las que mueven la aguja hoy.`
            : "Estas son las que mueven la aguja hoy."}
        </p>

        {/* Las DOS únicas cosas que puede hacer desde acá: trabajar la lista o
            dar de alta un cliente. Ver el CRM completo existe, pero se ofrece
            en tono secundario a propósito: no debe competir con la lista. */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <button
            onClick={() => onNuevoCliente?.()}
            style={{
              minHeight: 44, padding: "0 18px", borderRadius: 11, border: "none",
              background: T.accent, color: "#041016", fontFamily: font,
              fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 7,
            }}
          >
            <Plus size={16} strokeWidth={2.4} /> Nuevo cliente
          </button>
          <button
            onClick={() => onVerCRM?.()}
            style={{
              minHeight: 44, padding: "0 16px", borderRadius: 11,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.txt3, fontFamily: font, fontSize: 13, fontWeight: 500,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
            }}
          >
            <LayoutGrid size={15} strokeWidth={2} /> Ver el CRM completo
          </button>
        </div>
      </header>

      {pendientes.length === 0 ? (
        <div style={{
          border: `1px solid ${T.border}`, borderRadius: P.r, padding: "36px 24px",
          textAlign: "center", fontFamily: font, fontSize: 14.5, color: T.txt2,
        }}>
          {/* Felicitar por "terminar" a quien no hizo nada es burlarse: no
              terminó, no tuvo con qué empezar. */}
          {hechas > 0
            ? "Nada más por hoy. Lo que cerraste no vuelve a aparecer."
            : "Ningún cliente pide atención hoy. Registra uno y aparece aquí arriba."}
        </div>
      ) : (
        pendientes.map((accion, i) => (
          <Tarjeta
            key={accion.leadId}
            accion={accion}
            indice={i + 1}
            total={pendientes.length}
            T={T}
            isLight={isLight}
            onCerrar={cerrar} onMover={onMover}
          />
        ))
      )}
    </div>
  );
}
