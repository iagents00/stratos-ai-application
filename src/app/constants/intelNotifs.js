/**
 * app/constants/intelNotifs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Construye las notificaciones REALES del Centro de Inteligencia a partir de los
 * leads del CRM (leadsData). Reemplaza los placeholders demo ("Familia Rodríguez…").
 *
 * Devuelve objetos con la forma que espera DynIsland:
 *   { agent, text, detail, c (hex), icon (componente lucide), btn, action }
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Target, AlertTriangle, CalendarClock, TrendingUp } from "lucide-react";

const MS_DAY = 86400000;

// nombre / score / presupuesto con fallbacks (el modelo usa campos cortos: n, sc)
const nom = (l) => l.n ?? l.nombre ?? l.name ?? "Cliente";
const score = (l) => l.sc ?? l.score ?? 0;
const monto = (l) => Number(l.presupuesto) || Number(l.budget) || 0;

// Días sin movimiento: usa daysInactive si viene con dato; si no (está en 0 para
// todos = campo stale), lo calcula desde la última fecha real conocida.
function diasInactivo(l, now) {
  if (l.daysInactive && l.daysInactive > 0) return l.daysInactive;
  const d = l.updated_at || l.updatedAt || l.created_at || l.fechaIngreso;
  if (!d) return 0;
  const t = new Date(d).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / MS_DAY));
}

export function buildIntelNotifs(leadsData, now = Date.now()) {
  if (!Array.isArray(leadsData) || leadsData.length === 0) return [];
  const out = [];

  // 1) Lead prioritario — hot primero, luego mayor score
  const top = [...leadsData].sort(
    (a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || score(b) - score(a)
  )[0];
  if (top) {
    out.push({
      agent: "Lead prioritario",
      text: `${nom(top)} · score ${score(top)}${top.hot ? " · HOT" : ""}`,
      detail: `${nom(top)} está en "${top.st || "—"}"${monto(top) ? ` · ${Math.round(monto(top) / 1000)}K USD` : ""}. ${
        top.nextAction ? `Próxima acción: ${top.nextAction}.` : "Sin próxima acción registrada — agendá el siguiente paso."
      }`,
      c: "#34D399", icon: Target, btn: "Ver en el CRM", action: null, leadId: top.id,
    });
  }

  // 2) En riesgo de enfriarse — lead importante (hot o score alto) sin movimiento
  const riesgo = leadsData
    .filter((l) => l.hot || score(l) >= 7)
    .map((l) => ({ l, inact: diasInactivo(l, now) }))
    .filter((x) => x.inact >= 4 && x.l.id !== top?.id)
    .sort((a, b) => b.inact - a.inact)[0];
  if (riesgo) {
    out.push({
      agent: "En riesgo de enfriarse",
      text: `${nom(riesgo.l)} · ${riesgo.inact} días sin avance`,
      detail: `${nom(riesgo.l)} (score ${score(riesgo.l)}) lleva ~${riesgo.inact} días sin movimiento. Reactivalo antes de que se enfríe.`,
      c: "#F43F5E", icon: AlertTriangle, btn: "Ver en el CRM", action: null, leadId: riesgo.l.id,
    });
  }

  // 3) Tu día — Zooms en agenda + leads nuevos sin contactar
  const zooms = leadsData.filter((l) => l.st === "Zoom Agendado" || l.st === "Reactivar Zoom").length;
  const nuevos = leadsData.filter((l) => l.isNew).length;
  const pipeM = (leadsData.reduce((s, l) => s + monto(l), 0) / 1e6).toFixed(1);
  out.push({
    agent: "Tu día",
    text: `${zooms} Zoom(s) · ${nuevos} nuevos sin contactar`,
    detail: `Tenés ${zooms} Zoom(s) en agenda y ${nuevos} lead(s) nuevo(s) sin contactar todavía. Empezá por los HOT.`,
    c: "#A78BFA", icon: CalendarClock, btn: "Ver en el CRM", action: null,
  });

  // 4) Pipeline — foto global
  out.push({
    agent: "Pipeline",
    text: `$${pipeM}M en ${leadsData.length} clientes`,
    detail: `Tu pipeline suma $${pipeM}M en ${leadsData.length} clientes activos${nuevos ? `, ${nuevos} entraron nuevos` : ""}.`,
    c: "#60A5FA", icon: TrendingUp, btn: "Ver en el CRM", action: null,
  });

  return out;
}
