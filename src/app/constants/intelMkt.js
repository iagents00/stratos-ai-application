/**
 * app/constants/intelMkt.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centro de Inteligencia de MARKETING.
 *
 * Por qué existe aparte: el de ventas (`intelNotifs.js`) se arma con LEADS —
 * score, presupuesto en dólares, días sin contactar. Alex es director de
 * marketing y no tiene CRM: mostrarle eso sería ponerle los datos de ventas de
 * Duke en la pantalla, que es justo lo que la regla de oro prohíbe.
 *
 * Así que es el mismo lugar del header, con el contenido que sí es suyo:
 * tareas vencidas del equipo, videos parados en el tablero, quién no reportó
 * su bitácora y solicitudes que nadie tomó.
 *
 * Los datos y los textos vienen de la base (`fn_mkt_intel`) — acá solo se les
 * pone el color y el ícono, que es lo único que el back no sabe.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { AlertTriangle, Clapperboard, NotebookPen, Inbox } from "lucide-react";

const ESTILO = {
  vencida:  { c: "#F87171", icon: AlertTriangle },
  parado:   { c: "#FBBF24", icon: Clapperboard  },
  bitacora: { c: "#7EB8F0", icon: NotebookPen   },
  huerfana: { c: "#A78BFA", icon: Inbox         },
};

/** Convierte lo que devuelve fn_mkt_intel en lo que espera DynIsland. */
export function buildMktIntelNotifs(intel) {
  const notifs = intel?.notifs;
  if (!Array.isArray(notifs) || notifs.length === 0) return [];
  return notifs.map((n) => {
    const e = ESTILO[n.tipo] || ESTILO.vencida;
    return {
      agent: n.agent,
      text: n.text,
      detail: n.detail,
      btn: n.btn,
      c: e.c,
      icon: e.icon,
      action: null,
    };
  });
}

/**
 * Las frases que rotan en la píldora del header.
 * Se muestran SOLO las que tienen algo que decir: una píldora que dice
 * "0 vencidas" ocupa lugar y no informa. Si no hay nada, queda la de marca.
 */
export function buildMktIntelPhrases(intel, brandLabel = "Marketing") {
  const marca = (brandLabel || "Marketing").split(" ")[0];
  const out = [];
  if (intel?.vencidas > 0)     out.push(`${intel.vencidas} tarea${intel.vencidas === 1 ? "" : "s"} vencida${intel.vencidas === 1 ? "" : "s"}`);
  if (intel?.sin_bitacora > 0) out.push(`${intel.sin_bitacora} sin reportar hoy`);
  if (intel?.parados > 0)      out.push(`${intel.parados} video${intel.parados === 1 ? "" : "s"} parado${intel.parados === 1 ? "" : "s"}`);
  if (intel?.huerfanas > 0)    out.push(`${intel.huerfanas} sin responsable`);
  out.push(`${marca} · al día`);
  return out;
}
