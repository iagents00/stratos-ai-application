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
import { useState, useMemo, useCallback } from "react";
import { Phone, MessageCircle, Check, X, CalendarClock, Plus, LayoutGrid } from "lucide-react";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { listaDelDia } from "../../lib/next-action-engine";

/* Un solo punto de color por tarjeta, de 6px. Sin iconos decorativos. */
const COLOR_CUBETA = { prioritario: "accent", intermedio: "amber", reactivar: "blue" };

const ICONO_CANAL = { llamada: Phone, whatsapp: MessageCircle, zoom: CalendarClock };

function Tarjeta({ accion, indice, total, T, isLight, onCerrar }) {
  const [saliendo, setSaliendo] = useState(false);
  const color = T[COLOR_CUBETA[accion.cubeta]] || T.accent;
  const IconoCanal = ICONO_CANAL[accion.canal] || Phone;

  const cerrar = (resultado) => {
    setSaliendo(true);
    // 240 ms: lo que dura el fade. Se avisa al final para que el contador suba
    // en el mismo frame en que la tarjeta termina de irse.
    setTimeout(() => onCerrar(accion.leadId, resultado), 240);
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {accion.telefono && (
          <a href={`tel:${accion.telefono}`} style={{ ...btn({ background: color, color: "#041016", border: "none", textDecoration: "none" }) }}>
            <IconoCanal size={15} strokeWidth={2.2} /> {accion.canal === "whatsapp" ? "Escribir" : "Llamar"}
          </a>
        )}
        <button onClick={() => cerrar("hecho")} style={btn({ color: T.txt })}>
          <Check size={15} strokeWidth={2.2} /> Hecho
        </button>
        <button onClick={() => cerrar("no_contesto")} style={btn()}>
          <X size={15} strokeWidth={2.2} /> No contestó
        </button>
        <button onClick={() => cerrar("movido")} style={btn()}>
          <CalendarClock size={15} strokeWidth={2.2} /> Mover
        </button>
      </div>
    </article>
  );
}

export default function MiDia({ leads = [], T: Tprop, theme = "dark", onNuevoCliente, onVerCRM }) {
  const isLight = theme === "light";
  const T = Tprop || (isLight ? LP : P);

  const [cerradas, setCerradas] = useState({});   // leadId -> resultado

  const { visibles, total } = useMemo(() => listaDelDia(leads), [leads]);
  const pendientes = visibles.filter((a) => !cerradas[a.leadId]);
  const hechas = visibles.length - pendientes.length;

  const cerrar = useCallback((leadId, resultado) => {
    setCerradas((prev) => ({ ...prev, [leadId]: resultado }));
  }, []);

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
          {pendientes.length === 0
            ? "Terminaste tu día"
            : `${pendientes.length} ${pendientes.length === 1 ? "acción" : "acciones"}`}
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
          Nada más por hoy. Lo que cerraste no vuelve a aparecer.
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
            onCerrar={cerrar}
          />
        ))
      )}
    </div>
  );
}
