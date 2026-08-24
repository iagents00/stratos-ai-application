/**
 * lib/next-action-engine.js — Qué tiene que hacer un asesor con cada lead
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMERA PIEZA DE STRATOS RAILS (paso 4 del plan).
 *
 * El motor ya existía, pero atrapado dentro del AnalysisDrawer de
 * views/CRM/components.jsx: devolvía JSX con colores e iconos de lucide, así
 * que solo servía para pintar ese panel. Acá sale limpio — datos semánticos,
 * cero React — para que lo puedan usar Mi Día, el Copiloto, el clasificador
 * nocturno de n8n y las pruebas.
 *
 * LA LEY QUE GOBIERNA TODO
 * Ningún lead vivo existe sin un próximo paso con fecha y hora. Hoy la violan
 * 1,495 de 1,834 leads de Duke (81.5%). Cuando un lead no tiene próximo paso,
 * este motor NO lo deja en blanco: genera la tarjeta "definir el siguiente
 * paso", que es en sí misma la acción del día.
 *
 * QUÉ DEVUELVE Y QUÉ NO
 * Devuelve `razon` (por qué este lead, hoy, en palabras de lo que pasó) y
 * `pedir` (qué hay que conseguir de la llamada). Nunca "dar seguimiento a X":
 * eso no es una acción, es una etiqueta. Los colores y los iconos los pone la
 * interfaz, no este archivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Cubetas de clasificación. El orden es el de atención. */
export const CUBETAS = ["prioritario", "intermedio", "reactivar"];

// Siete. Ni una más. Una lista que no se puede terminar deja de ser una lista y
// vuelve a ser el pipeline con otro nombre — que es justo de lo que Rails saca
// al asesor.
export const MAX_DEL_DIA = 7;

/**
 * Tipos de acción. `canal` es una sugerencia, no una imposición: la regla 3 de
 * Rails dice que pasadas 20 h el teléfono deja de ser canal primario.
 */
const REGLAS = [
  {
    tipo: "primer_contacto",
    cubeta: "prioritario",
    peso: 100,
    aplica: (l) => l.st === "Contáctame Ya" || (l.isNew && ETAPAS_SIN_CONTACTO.has(l.st)),
    razon: (l) => l.diasSinTocar >= 1
      ? `Entró hace ${l.diasSinTocar} ${l.diasSinTocar === 1 ? "día" : "días"} y todavía nadie lo llamó.`
      : "Acaba de entrar. La contactabilidad cae 100× entre el minuto 5 y el 30.",
    pedir: () => "Preséntate y consigue una cosa: para qué quiere invertir.",
    canal: "llamada",
    eta: "ahora",
  },
  {
    tipo: "zoom_hoy",
    cubeta: "prioritario",
    peso: 95,
    aplica: (l) => l.st === "Zoom Agendado",
    razon: () => "Tiene Zoom agendado. Sin briefing llegas a improvisar.",
    pedir: () => "Confirma asistencia y pregunta quién más participa.",
    canal: "whatsapp",
    eta: "antes del Zoom",
  },
  {
    tipo: "validar_apartado",
    cubeta: "prioritario",
    peso: 92,
    aplica: (l) => l.st === "Apartó",
    razon: () => "Ya mandó dinero. Falta validar el comprobante.",
    pedir: () => "Confirma unidad, monto y desarrollo, y agenda la firma.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "lead_caliente",
    cubeta: "prioritario",
    peso: 90,
    aplica: (l) => l.hot === true,
    razon: () => "Mostró señales de compra activa.",
    pedir: () => "Propón fecha concreta para el siguiente paso, no 'te aviso'.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "reactivar_zoom",
    cubeta: "prioritario",
    peso: 88,
    aplica: (l) => l.st === "Reactivar Zoom",
    razon: () => "Agendó un Zoom y no se conectó.",
    pedir: () => "Entiende por qué faltó, sin reproche, y ofrece dos horarios.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "promesa_vencida",
    cubeta: "prioritario",
    peso: 85,
    aplica: (l) => l.proximaAccionVencida === true,
    razon: (l) => `Quedaste en algo con él${l.diasVencida ? ` hace ${l.diasVencida} días` : ""} y no pasó.`,
    pedir: () => "Cumple lo prometido y cierra la siguiente fecha antes de colgar.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "post_zoom",
    cubeta: "intermedio",
    peso: 70,
    aplica: (l) => l.st === "Seguimiento" || l.st === "Zoom Concretado",
    razon: (l) => l.diasSinTocar >= 7
      ? `Ya tuvo el Zoom y lleva ${l.diasSinTocar} días sin noticias tuyas.`
      : "Ya tuvo el Zoom. Es la ventana donde se decide.",
    pedir: () => "No preguntes '¿qué opinas?'. Lleva la corrida y pide la fecha de visita.",
    canal: "whatsapp",
    eta: "hoy",
  },
  {
    tipo: "calificar",
    cubeta: "intermedio",
    peso: 60,
    // Solo se califica una conversación VIVA. A alguien que lleva dos semanas
    // sin contestar no le pides el presupuesto: primero lo reactivas. Sin este
    // guard, un lead de 83 días caía en "calificar" y la tarjeta pedía algo
    // imposible.
    aplica: (l) => l.bantScore < 3 && l.diasSinTocar < 14
      && !["Postventa", "Contáctame Ya"].includes(l.st),
    razon: (l) => `Le faltan datos para calificar: ${l.bantFaltantes.join(", ")}.`,
    pedir: () => "Consigue el dato que falta antes de invertir más tiempo.",
    canal: "whatsapp",
    eta: "esta semana",
  },
  {
    tipo: "reactivar",
    cubeta: "reactivar",
    peso: 40,
    aplica: (l) => l.diasSinTocar >= 14,
    razon: (l) => `${l.diasSinTocar} días sin movimiento.`,
    pedir: () => "Llega con algo nuevo: avance de obra, precio, unidad liberada.",
    canal: "whatsapp",
    eta: "esta semana",
  },
];

/**
 * La red de seguridad. Si ninguna regla aplicó pero el lead sigue vivo, la
 * acción del día ES ponerle un próximo paso. Sin esto volveríamos a tener
 * leads sin dueño de su futuro, que es el problema que Rails viene a resolver.
 */
const DEFINIR_PASO = {
  tipo: "definir_paso",
  cubeta: "intermedio",
  peso: 50,
  razon: () => "No tiene un próximo paso definido.",
  pedir: () => "Decide qué sigue con él y ponle fecha.",
  canal: "llamada",
  eta: "hoy",
};

const ETAPAS_CERRADAS = new Set(["Cierre", "Postventa", "Descartado"]);

/**
 * Etapas donde "primer contacto" todavía tiene sentido. El campo `isNew` del
 * CRM marca leads recientes SIN mirar la etapa, así que por sí solo hacía que
 * un lead con Zoom ya agendado apareciera como "nadie lo ha llamado". Se vio
 * en la primera pantalla de Mi Día: Rafael en Seguimiento y James Mitchell en
 * Zoom Agendado, ambos con esa tarjeta absurda.
 */
const ETAPAS_SIN_CONTACTO = new Set([
  "Contáctame Ya", "Segundo Intento", "Tercer Intento", "Rotación",
]);

/** Normaliza un lead del CRM a lo que el motor necesita. Tolera campos ausentes. */
export function normalizarLead(lead, ahora = new Date()) {
  const dias = (fecha) => {
    if (!fecha) return null;
    const t = new Date(fecha).getTime();
    return Number.isNaN(t) ? null : Math.floor((ahora - t) / 86400000);
  };

  const presupuesto = Number(lead.presupuesto) || Number(lead.budget) || 0;
  const bant = {
    presupuesto: presupuesto > 0,
    asesor: !!String(lead.asesor || "").trim(),
    necesidad: !!(lead.bio && String(lead.bio).length > 40),
    fecha: !!(lead.nextActionDate && lead.nextActionDate !== "Por definir"),
  };
  const faltantes = Object.entries(bant).filter(([, v]) => !v).map(([k]) => ({
    presupuesto: "presupuesto", asesor: "asesor asignado",
    necesidad: "para qué lo quiere", fecha: "fecha del siguiente paso",
  }[k]));

  const vencida = lead.nextActionAt ? new Date(lead.nextActionAt) < ahora : false;

  return {
    ...lead,
    diasSinTocar: dias(lead.updatedAt || lead.updated_at) ?? lead.daysInactive ?? 0,
    proximaAccionVencida: vencida,
    diasVencida: vencida ? dias(lead.nextActionAt) : null,
    bantScore: Object.values(bant).filter(Boolean).length,
    bantFaltantes: faltantes,
  };
}

/**
 * Devuelve LA acción del día para un lead, o null si el lead está cerrado.
 * Una sola: la lista de siete tarjetas no admite empates.
 */
export function proximaAccion(leadCrudo, ahora = new Date()) {
  if (!leadCrudo || ETAPAS_CERRADAS.has(leadCrudo.st)) return null;
  const lead = normalizarLead(leadCrudo, ahora);

  const candidatas = REGLAS.filter((r) => {
    try { return r.aplica(lead); } catch { return false; }
  });
  const regla = candidatas.sort((a, b) => b.peso - a.peso)[0]
    || (lead.bantFaltantes.includes("fecha del siguiente paso") ? DEFINIR_PASO : null);

  if (!regla) return null;

  return {
    leadId: lead.id,
    nombre: lead.n || lead.nombre || "Sin nombre",
    telefono: lead.phone || lead.telefono || null,
    etapa: lead.st,
    tipo: regla.tipo,
    cubeta: regla.cubeta,
    peso: regla.peso,
    canal: regla.canal,
    eta: regla.eta,
    razon: regla.razon(lead),
    pedir: regla.pedir(lead),
    // Contexto de apoyo: la tarjeta lo muestra pequeño, debajo de la razón.
    contexto: [
      lead.presupuesto || lead.budget ? `Presupuesto ${lead.budget || lead.presupuesto}` : null,
      lead.sc != null ? `Score ${lead.sc}` : null,
      lead.st ? `Etapa ${lead.st}` : null,
    ].filter(Boolean),
  };
}

/**
 * La lista del día. Máximo 7 por diseño: una lista larga es una lista que no
 * se termina, y la que no se termina se abandona.
 */
export function listaDelDia(leads, { max = MAX_DEL_DIA, ahora = new Date() } = {}) {
  const acciones = (leads || []).map((l) => proximaAccion(l, ahora)).filter(Boolean);
  const orden = { prioritario: 0, intermedio: 1, reactivar: 2 };
  acciones.sort((a, b) => (orden[a.cubeta] - orden[b.cubeta]) || (b.peso - a.peso));
  return { visibles: acciones.slice(0, max), total: acciones.length };
}
