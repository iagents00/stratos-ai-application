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

// Siete acciones por bloque; el total pendiente siempre permanece visible.
export const MAX_DEL_DIA = 7;

/**
 * Tipos de acción. `canal` es una sugerencia, no una imposición: la regla 3 de
 * Rails dice que pasadas 20 h el teléfono deja de ser canal primario.
 */
const REGLAS = [
  {
    tipo: "primer_contacto",
    label: "Primer contacto",
    cuando: "El cliente acaba de entrar o nadie lo ha llamado todavía.",
    cubeta: "prioritario",
    peso: 100,
    aplica: (l) => ETAPAS_SIN_CONTACTO.has(l.st) && (l.st === "Contáctame Ya" || l.isNew === true),
    razon: (l) => l.diasSinTocar >= 1
      ? `Está en primer contacto y lleva ${l.diasSinTocar} ${l.diasSinTocar === 1 ? "día" : "días"} sin actividad registrada.`
      : "Está en primer contacto. Revisa el historial antes de presentarte.",
    pedir: () => "Preséntate y consigue una cosa: para qué quiere invertir.",
    canal: "llamada",
    eta: "ahora",
  },
  {
    tipo: "zoom_hoy",
    label: "Zoom hoy",
    cuando: "Tiene un Zoom agendado para hoy.",
    cubeta: "prioritario",
    peso: 95,
    aplica: (l) => l.st === "Zoom Agendado" && l.zoomHoy && !l.zoomVencido,
    razon: () => "Tiene Zoom agendado. Sin briefing llegas a improvisar.",
    pedir: () => "Confirma asistencia y pregunta quién más participa.",
    canal: "whatsapp",
    eta: "antes del Zoom",
  },
  {
    tipo: "zoom_vencido", label: "Revisar cita pasada",
    cuando: "Pasó la hora del Zoom y falta registrar qué ocurrió.",
    cubeta: "prioritario", peso: 98,
    aplica: (l) => l.st === "Zoom Agendado" && l.zoomVencido,
    razon: () => "La hora de la cita ya pasó. Falta registrar el resultado.",
    pedir: () => "Revisa si se realizó, actualiza la etapa en la ficha y acuerda el siguiente paso.",
    canal: "llamada", eta: "hoy",
  },
  {
    tipo: "validar_apartado",
    label: "Validar apartado",
    cuando: "Está en Apartó; hay que comprobar el pago y el siguiente paso.",
    cubeta: "prioritario",
    peso: 92,
    aplica: (l) => l.st === "Apartó",
    razon: () => "Está en Apartó. Verifica si el pago y el comprobante están registrados.",
    pedir: () => "Confirma unidad, monto y desarrollo, y agenda la firma.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "lead_caliente",
    label: "Cliente caliente",
    cuando: "Mostró señales de compra activa.",
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
    label: "Reactivar Zoom",
    cuando: "Agendó un Zoom y no se conectó.",
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
    label: "Promesa vencida",
    cuando: "Quedaste en algo con él y ya pasó la fecha.",
    cubeta: "prioritario",
    peso: 99,
    aplica: (l) => l.proximaAccionVencida === true,
    razon: (l) => `La fecha del siguiente paso venció${l.diasVencida ? ` hace ${l.diasVencida} días` : ""}. Revisa si se cumplió.`,
    pedir: () => "Cumple lo prometido y cierra la siguiente fecha antes de colgar.",
    canal: "llamada",
    eta: "hoy",
  },
  {
    tipo: "post_zoom",
    label: "Seguimiento post-Zoom",
    cuando: "Ya pasó por Zoom y sigue en negociación.",
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
    label: "Calificar",
    cuando: "Le faltan datos (presupuesto, para qué lo quiere, fecha).",
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
    label: "Reactivar dormido",
    cuando: "Lleva días sin movimiento.",
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
  label: "Definir el siguiente paso",
  cuando: "Red de seguridad: no tiene un próximo paso puesto.",
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
  "Contáctame Ya", "Nuevo Registro",
]);

/**
 * El catálogo de reglas para el panel de configuración: qué existe, cómo se
 * llama en español y cuándo se dispara. El motor es la ÚNICA fuente — si mañana
 * se agrega una regla acá, aparece sola en el panel de admin sin tocar la UI.
 */
export function catalogoDeReglas() {
  return [...REGLAS, DEFINIR_PASO].map((r) => ({
    tipo: r.tipo,
    label: r.label || r.tipo,
    cuando: r.cuando || "",
    cubeta: r.cubeta,
    peso: r.peso,
    canal: r.canal,
    // Texto de fábrica, para mostrarlo de marca de agua en el panel. Se calcula
    // con un cliente de ejemplo porque varias razones son dinámicas.
    razonDefault: seguro(() => r.razon(LEAD_EJEMPLO)),
    pedirDefault: seguro(() => r.pedir(LEAD_EJEMPLO)),
    // definir_paso es la red de seguridad; apagarla dejaría leads sin dueño de
    // su futuro, que es justo el problema que Rails viene a resolver.
    fija: r.tipo === "definir_paso",
  }));
}

const LEAD_EJEMPLO = {
  n: "tu cliente", st: "Seguimiento", diasSinTocar: 3, diasVencida: 2,
  bantFaltantes: ["presupuesto"], presupuesto: 0,
};
function seguro(fn) { try { return fn() || ""; } catch { return ""; } }

/** Reemplaza las fichas {nombre} {dias} … por los datos reales del cliente. */
export function interpolar(texto, lead) {
  if (!texto) return texto;
  const d = lead?.diasSinTocar ?? 0;
  const v = lead?.diasVencida ?? 0;
  // {dias} es el número pelado, para quien quiera escribir "3 d" o "hace 3".
  // {dias_txt} viene conjugado: nadie quiere leerle a su equipo "llevas 1 días".
  const plural = (n) => `${n} ${n === 1 ? "día" : "días"}`;
  const fichas = {
    nombre: lead?.n || lead?.nombre || "tu cliente",
    dias: d,
    dias_txt: plural(d),
    diasVencida: v,
    diasVencida_txt: plural(v),
    etapa: lead?.st || "sin etapa",
    faltantes: Array.isArray(lead?.bantFaltantes) ? lead.bantFaltantes.join(", ") : "",
  };
  return String(texto).replace(/\{(\w+)\}/g, (crudo, k) =>
    (k in fichas ? String(fichas[k]) : crudo));
}

export const FICHAS_DISPONIBLES = ["nombre", "dias_txt", "dias", "diasVencida", "etapa", "faltantes"];

/** Solo fechas con hora: un texto libre no prueba que haya un compromiso. */
export function instanteRails(value) {
  if (value instanceof Date) return Number.isFinite(+value) ? +value : null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) return null;
  const time = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(time) ? time : null;
}

export function diaRails(fecha = new Date(), timeZone) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", ...(timeZone ? { timeZone } : {}),
  }).formatToParts(fecha);
  return ["year", "month", "day"].map(k => partes.find(p => p.type === k).value).join("-");
}

export function normalizarLead(lead, ahora = new Date(), timeZone) {
  const st = lead.st ?? lead.stage;
  const siguiente = instanteRails(lead.next_action_at ?? lead.nextActionAt)
    ?? instanteRails(lead.next_action_date ?? lead.nextActionDate);
  const zoom = instanteRails(lead.selected_time) ?? siguiente;
  const contacto = instanteRails(lead.last_contact_at ?? lead.lastContactAt ?? lead.sprint_ultimo_contacto_at);
  const inactividad = lead.days_inactive ?? lead.daysInactive;
  const creado = instanteRails(lead.created_at);
  const diasSinTocar = contacto !== null ? Math.max(0, Math.floor((ahora - contacto) / 864e5))
    : Number.isFinite(inactividad) ? Math.max(0, inactividad)
      : creado !== null ? Math.max(0, Math.floor((ahora - creado) / 864e5)) : 0;
  const bant = {
    presupuesto: (Number(lead.presupuesto) || Number(lead.budget)) > 0,
    asesor: !!String(lead.asesor ?? lead.asesor_name ?? "").trim(),
    necesidad: !!String(lead.uso || lead.necesidad || "").trim(),
    fecha: siguiente !== null,
  };
  const nombres = { presupuesto: "presupuesto", asesor: "asesor asignado", necesidad: "para qué lo quiere", fecha: "fecha del siguiente paso" };
  return {
    ...lead, st, n: lead.n ?? lead.name ?? lead.nombre, isNew: lead.isNew ?? lead.is_new,
    siguiente, diasSinTocar,
    zoomHoy: zoom !== null && diaRails(new Date(zoom), timeZone) === diaRails(ahora, timeZone),
    zoomVencido: zoom !== null && zoom < +ahora,
    proximaAccionVencida: siguiente !== null && siguiente <= +ahora,
    diasVencida: siguiente !== null && siguiente <= +ahora ? Math.floor((ahora - siguiente) / 864e5) : null,
    bantScore: Object.values(bant).filter(Boolean).length,
    bantFaltantes: Object.entries(bant).filter(([, v]) => !v).map(([k]) => nombres[k]),
  };
}

/**
 * Devuelve LA acción del día para un lead, o null si el lead está cerrado.
 * Una sola: la lista de siete tarjetas no admite empates.
 */
export function proximaAccion(leadCrudo, ahora = new Date(), config = null) {
  if (!leadCrudo?.id || leadCrudo.opt_out === true || leadCrudo.optOut === true
    || leadCrudo.deleted_at || leadCrudo.deletedAt || ETAPAS_CERRADAS.has(leadCrudo.st ?? leadCrudo.stage)) return null;
  const lead = normalizarLead(leadCrudo, ahora, config?.timeZone);
  const reactivar = instanteRails(lead.reactivar_at);
  if (reactivar !== null && reactivar > +ahora) return null;
  // Respeta los compromisos futuros. Una cita de hoy sí permite preparar el Zoom.
  if (lead.siguiente > +ahora && !(lead.st === "Zoom Agendado" && lead.zoomHoy)) return null;
  if (lead.st === "Zoom Agendado" && instanteRails(lead.selected_time) > +ahora && !lead.zoomHoy) return null;

  // La organización puede apagar reglas enteras y cambiarles el peso. `definir_paso`
  // no se puede apagar: es la red de seguridad.
  const ajuste = (tipo) => config?.reglas?.[tipo] || null;
  const pesoDe = (r) => {
    const p = ajuste(r.tipo)?.peso;
    return Number.isFinite(p) ? p : r.peso;
  };

  const candidatas = REGLAS.filter((r) => {
    if (lead.st === "Zoom Agendado" && !lead.zoomHoy && !lead.zoomVencido) return false;
    if (ajuste(r.tipo)?.activa === false) return false;
    try { return r.aplica(lead); } catch { return false; }
  });
  const regla = candidatas.sort((a, b) => pesoDe(b) - pesoDe(a))[0]
    || (lead.bantFaltantes.includes("fecha del siguiente paso") ? DEFINIR_PASO : null);

  if (!regla) return null;

  // Si la empresa escribió su propio texto, el suyo manda tal cual (con las
  // fichas resueltas). Si no, el del motor.
  const propio = ajuste(regla.tipo);
  const razon = propio?.razon ? interpolar(propio.razon, lead) : regla.razon(lead);
  const pedir = propio?.pedir ? interpolar(propio.pedir, lead) : regla.pedir(lead);

  return {
    leadId: lead.id,
    version: lead.updated_at ?? lead.updatedAt ?? null,
    siguiente: lead.siguiente,
    nombre: lead.n || lead.nombre || "Sin nombre",
    telefono: lead.phone || lead.telefono || null,
    etapa: lead.st,
    tipo: regla.tipo,
    cubeta: regla.cubeta,
    peso: pesoDe(regla),
    canal: regla.canal,
    eta: regla.eta,
    razon,
    pedir,
    // Contexto de apoyo: la tarjeta lo muestra pequeño, debajo de la razón.
    contexto: [
      lead.presupuesto || lead.budget ? `Presupuesto ${lead.budget || lead.presupuesto}` : null,
      lead.sc != null ? `Score ${lead.sc}` : null,
      lead.st ? `Etapa ${lead.st}` : null,
    ].filter(Boolean),
  };
}

/** Excluye gestiones confirmadas ANTES de limitar el bloque. */
export function listaDelDia(leads, { max, ahora = new Date(), config = null, cerradas = {}, orden = [] } = {}) {
  const limite = max ?? config?.maxTarjetas ?? MAX_DEL_DIA;
  const tope = Number.isFinite(limite) ? Math.max(1, Math.min(12, Math.floor(limite))) : MAX_DEL_DIA;
  const unicos = new Map();
  for (const l of Array.isArray(leads) ? leads : []) {
    const accion = proximaAccion(l, ahora, config);
    if (!accion) continue;
    const cierre = cerradas[accion.leadId];
    const nuevaCitaVencida = accion.siguiente !== null && accion.siguiente <= +ahora
      && instanteRails(cierre?.completado_at) !== null && accion.siguiente > instanteRails(cierre.completado_at);
    if (!cierre || nuevaCitaVencida) unicos.set(accion.leadId, accion);
  }
  const acciones = [...unicos.values()].sort((a, b) => b.peso - a.peso || (a.siguiente ?? Infinity) - (b.siguiente ?? Infinity) || String(a.leadId).localeCompare(String(b.leadId)));
  const conservadas = orden.map(id => unicos.get(id)).filter(Boolean);
  const existentes = new Set(conservadas.map(a => a.leadId));
  return { visibles: [...conservadas, ...acciones.filter(a => !existentes.has(a.leadId))].slice(0, tope), total: acciones.length };
}
