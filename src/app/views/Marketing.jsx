/**
 * views/Marketing.jsx — ERP de actividades del equipo de MARKETING (rol `marketing`)
 *
 * El "Monday/ClickUp interno" pedido por el equipo de marketing de Duke (reunión
 * 15-jul-2026): tabs Mi Día · Marcas · Pipeline · Solicitudes (+ Equipo solo admin).
 *   · Mi Día: rodaje de hoy → vencidas → para hoy → bloqueadas → mañana.
 *   · Marcas: tableros por marca con proyectos y barra de progreso (tareas hechas/total).
 *   · Registro de Propiedades: la hoja de Alex adentro del CRM. Arranca en TABLA
 *     (se edita celda por celda, Enter baja / Tab va a la derecha, columnas a
 *     elegir y columnas propias); el kanban queda como vista alterna. Las 9
 *     etapas son las de SU hoja, con "Cambios" (retrabajo) y "Sin voz en off"
 *     marcadas en rojo cuando se acumulan.
 *   · Solicitudes: bandeja de pedidos de diseño con complejidad A/AA/AAA.
 *
 * Datos: tablas `mkt_*` (stratos-prod) — RLS org-scoped + is_marketing_or_above(),
 * DELETE prohibido (soft-delete con deleted_at). Acá además se filtra explícito por
 * organization_id (defensa en profundidad, mismo patrón que Caja/CRM).
 *
 * Reglas de diseño (anti-ClickUp): 4 estados de tarea fijos; "bloqueada" NO es un
 * estado — se DERIVA de depends_on (la dependencia no está hecha). El "desbloqueo"
 * es un chip sobre la tarea, no una sección.
 *
 * ⚠️ Patrón de render: los bloques internos (taskRow, projectCard, tabs) son
 * FUNCIONES render llamadas como `taskRow(t)`, NO componentes `<TaskRow/>`.
 * Un componente definido dentro del padre cambia de identidad en cada render
 * → React desmonta/remonta el subtree → los inputs pierden el foco al tipear.
 * No convertir a <JSX/> sin hoistearlos fuera del componente.
 *
 * Aesthetic: paleta `T` del theme de App.jsx (glass/border/txt/accent) igual que
 * el resto del CRM; isLight por luminancia del bg (patrón Caja.jsx).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Megaphone, Plus, X, RefreshCw, Folder, ExternalLink, Lock, Check,
  ChevronLeft, ChevronRight, ChevronDown, Clapperboard, Mic, CalendarDays,
  Search, Camera, CircleCheck, Layers, SlidersHorizontal, Trash2, Maximize2,
  GripVertical, ClipboardList,
} from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import { resolveClientFromLocation } from "../../clients";

/* ── Constantes del dominio ─────────────────────────────────────────────── */

// Rótulo del módulo por tenant: Duke lo ve como "Marketing"; un tenant que reusa
// el motor como sistema de tareas lo renombra vía navLabels.mkt (NSG → "Proyectos").
// El cliente es fijo durante la sesión (mismo patrón que labels.js/pipeline.js).
const MODULE_LABEL = (() => {
  try { return resolveClientFromLocation()?.navLabels?.mkt || "Marketing"; }
  catch { return "Marketing"; }
})();

// Ajustes del módulo por tenant (config `mkt` del cliente): ocultar pestañas que
// no aplican (ej. NSG no produce videos → fuera "Pipeline") y renombrar otras
// (NSG: "Marcas" → "Proyectos"). Duke sin config = comportamiento idéntico.
const TENANT_MKT = (() => {
  try { return resolveClientFromLocation()?.mkt || {}; } catch { return {}; }
})();
const HIDDEN_TABS = new Set(Array.isArray(TENANT_MKT.hideTabs) ? TENANT_MKT.hideTabs : []);
/* Pedido de Ángel 29-jul: «Mi Día» no se usa más y en Propiedades la hoja ya
   vive en Actividades → Espacio 1. Quedan OCULTOS (no borrados): volver a
   true si algún día se necesitan. */
const SHOW_TAB_DIA = false;
const SHOW_VISTA_TABLA = false;
const tabLabel = (id, fallback) => (TENANT_MKT.tabLabels && TENANT_MKT.tabLabels[id]) || fallback;

/* Las etapas son LAS DE ALEX, en el orden de su hoja y con sus palabras:
   Sin edición → esperando aprobación → CAMBIOS → Aprovado → sin Voz en Off →
   Publicado. Al cargar sus 21 propiedades habíamos aplastado «CAMBIOS» y
   «esperando aprobación» dentro de «en edición» — y ahí se perdía lo único que
   él mira: qué está en RETRABAJO. Un video que volvió con cambios no es lo
   mismo que uno que se edita por primera vez. (Migración 182.) */
const ETAPAS = [
  { id: "seleccionada",         l: "Seleccionada" },
  { id: "agendada",             l: "Agendada" },
  { id: "grabada",              l: "Sin edición" },
  { id: "en_edicion",           l: "En edición" },
  { id: "esperando_aprobacion", l: "Esperando aprobación" },
  { id: "cambios",              l: "Cambios" },
  { id: "lista",                l: "Aprobado" },
  { id: "esperando_voz",        l: "Sin voz en off" },
  { id: "publicada",            l: "Publicada" },
];

/* Colores del «Estatus» COPIADOS DE SU HOJA — no son decoración: el equipo
   escanea la columna por color, sin leer. En su Sheet: Sin edición ROJO ·
   CAMBIOS NARANJA · esperando aprobación y sin Voz en Off en tonos pálidos ·
   Aprovado VERDE · Publicado AZUL. Si cambiás estos colores, les cambiás el
   idioma con el que leen su propio trabajo. */
const ETAPA_HEX = {
  seleccionada:         { d: "#94A3B8", l: "#64748B" },  // (nuestra, previa a su hoja)
  agendada:             { d: "#A78BFA", l: "#7C3AED" },  // (nuestra)
  grabada:              { d: "#F87171", l: "#DC2626" },  // «Sin edición» — ROJO
  en_edicion:           { d: "#FBBF24", l: "#D97706" },
  esperando_aprobacion: { d: "#86EFAC", l: "#16A34A" },  // verde pálido
  cambios:              { d: "#FB923C", l: "#EA580C" },  // NARANJA — retrabajo
  lista:                { d: "#4ADE80", l: "#15803D" },  // «Aprobado» — VERDE
  esperando_voz:        { d: "#BEF264", l: "#65A30D" },  // «Sin voz en off» — lima pálido
  publicada:            { d: "#60A5FA", l: "#1D4ED8" },  // AZUL
};

/* Los DESPLEGABLES de su hoja. Ubicación y Tipo NO son texto libre allá: son
   listas con color. Si acá los dejamos como texto, cada quien escribe «Cancún»,
   «cancun» y «Cancun» y los filtros dejan de servir.
   La lista NO es cerrada: a estas opciones se les suman las que ya estén usadas
   en los datos, y siempre queda «Otra…» para escribir una nueva. */
/* Las opciones y los colores están COPIADOS de su hoja (pestañas 2026 y 2025),
   con su ortografía exacta — incluida «Puerto Avenuras», que es como está
   escrito allá. Si lo «corrigiéramos» a Aventuras aparecerían las dos opciones
   y volvería el desorden que el desplegable viene a evitar. */
const CAT_UBICACION = [
  { v: "Cancun",          c: { d: "#7EB8F0", l: "#2563EB" } },
  { v: "Puerto Cancun",   c: { d: "#60A5FA", l: "#1D4ED8" } },
  { v: "Tulum",           c: { d: "#4ADE80", l: "#15803D" } },
  { v: "PDC",             c: { d: "#FBBF24", l: "#D97706" } },
  { v: "Puerto Morelos",  c: { d: "#FDA4AF", l: "#BE123C" } },
  { v: "Puerto Avenuras", c: { d: "#C4B5FD", l: "#6D28D9" } },
  { v: "Miami",           c: null },
];
const CAT_TIPO = [
  { v: "Casa - Villa" },
  { v: "Depto" },
  { v: "Terreno" },
  { v: "Hotel" },
];

/* Las columnas del registro, en el orden en que se leen. «Propiedad» y
   «Estatus» van juntas al principio y no se pueden apagar: son las dos cosas
   que Alex mira primero (qué es y en qué va). El resto se puede esconder desde
   el botón «Columnas» — 17 columnas a la vez no las usa nadie todos los días.
   `nombre`, `etapa` y `marca` se pintan distinto; el resto son celdas normales. */
const COLS_REGISTRO = [
  { key: "nombre",            l: "Propiedad",   tipo: "nombre", ancho: 190, fija: true },
  { key: "etapa",             l: "Estatus",     tipo: "etapa",  ancho: 160, fija: true },
  { key: "brand_id",          l: "Empresa",     tipo: "marca",  ancho: 140 },
  { key: "fecha_rodaje",      l: "Rodaje",      tipo: "date",   ancho: 130 },
  { key: "fecha_publicacion", l: "Publicación", tipo: "date",   ancho: 130 },
  // Ubicación y Tipo son LISTAS en su hoja, no texto libre.
  { key: "locacion",          l: "Ubicación",   tipo: "catalogo", cat: CAT_UBICACION, ancho: 150 },
  // Precio SÍ es texto a propósito: su hoja mezcla «$22.88 MDP» con «$2.1M USD»
  // y usa «Precio Reservado». Numérico obligaría a inventar una conversión.
  { key: "precio",            l: "Precio",      tipo: "text",   ancho: 130, ph: "$22.88 MDP" },
  { key: "tipo",              l: "Tipo",        tipo: "catalogo", cat: CAT_TIPO, ancho: 140 },
  { key: "crudos_url",        l: "Crudos",      tipo: "enlace" },
  { key: "video_url",         l: "Video",       tipo: "enlace" },
  { key: "ig_url",            l: "Reel",        tipo: "enlace" },
  { key: "story_url",         l: "Story",       tipo: "enlace" },
  { key: "cine_url",          l: "Cine",        tipo: "enlace" },
  { key: "ficha_url",         l: "Ficha téc.",  tipo: "enlace" },
  { key: "info_url",          l: "Info",        tipo: "enlace" },
  { key: "drive_url",         l: "Drive",       tipo: "enlace" },
  { key: "notas",             l: "Notas",       tipo: "text",   ancho: 220 },
];

const TASK_STATES = [
  { id: "por_hacer",   l: "Por hacer" },
  { id: "en_curso",    l: "En curso" },
  { id: "en_revision", l: "En revisión" },
  { id: "hecha",       l: "Hecha" },
];

const REQ_STATES = [
  { id: "nueva",       l: "Nueva" },
  { id: "en_curso",    l: "En curso" },
  { id: "en_revision", l: "En revisión" },
  { id: "entregada",   l: "Entregada" },
];

// Color FIJO por marca (regla del diseño: el ojo escanea sin leer).
// Variante clara/oscura para que respire en ambos temas.
const BRAND_HEX = {
  "duke-del-caribe": { d: "#6EE7C2", l: "#0D9A76" },
  "mueblar":         { d: "#FBBF24", l: "#D97706" },
  "brazo-y-piedra":  { d: "#F97316", l: "#EA580C" },
  "nk23":            { d: "#7EB8F0", l: "#2563EB" },
  "casa-agata":      { d: "#A78BFA", l: "#7C3AED" },
  "nsg":             { d: "#F472B6", l: "#DB2777" },
};
const BRAND_FALLBACK = { d: "#5DC8D9", l: "#0891B2" };

/* ── Helpers de fecha (hora local del navegador) ────────────────────────── */

const dayStr = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const todayStr    = () => dayStr(new Date());
const tomorrowStr = () => dayStr(new Date(Date.now() + 86400000));

const fmtHora = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return ""; }
};
const fmtDia = (isoOrDate) => {
  if (!isoOrDate) return "—";
  try {
    const d = new Date(String(isoOrDate).length === 10 ? isoOrDate + "T12:00:00" : isoOrDate);
    const mos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${d.getDate()} ${mos[d.getMonth()]}`;
  } catch { return "—"; }
};
/* El tiempo que tardó, sacado del propio relato. En la hoja real de Duke la
   columna «tiempo» del formulario está VACÍA en el 100% de las filas, pero el
   tiempo SÍ está escrito adentro del texto: «edición 7 hrs», «de 9 a 9:50».
   Yolanda pidió medir tiempos; Alex pidió menos campos. Esto resuelve las dos:
   se lee del texto y no se le pide nada más a nadie.
   Un rango solo cuenta si viene con «de …» o con hora con minutos — si no,
   «hice 2 a 3 fichas» se leería como un horario. */
const tiempoDelTexto = (texto) => {
  const t = String(texto || "");
  const conDe = t.match(/\bde\s*(\d{1,2}(?::\d{2})?)\s*(?:a|hasta|-|–|—)\s*(\d{1,2}(?::\d{2})?)\b/i);
  if (conDe) return `${conDe[1]} a ${conDe[2]}`;
  const conReloj = t.match(/\b(\d{1,2}:\d{2})\s*(?:a|hasta|-|–|—)\s*(\d{1,2}(?::\d{2})?)\b/i)
                || t.match(/\b(\d{1,2})\s*(?:a|hasta|-|–|—)\s*(\d{1,2}:\d{2})\b/i);
  if (conReloj) return `${conReloj[1]} a ${conReloj[2]}`;
  const horas = t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|hs|hr|hrs|hora|horas)\b/i);
  if (horas) return `${horas[1]} h`;
  const mins = t.match(/\b(\d{1,3})\s*(?:min|mins|minutos)\b/i);
  if (mins) return `${mins[1]} min`;
  return "";
};

const diasDesde = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
};

/* ── Componente principal ───────────────────────────────────────────────── */

export default function Marketing({ T, onOpenCopilot, initialTab }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const orgId = user?.organizationId;
  const isAdmin = ["super_admin", "admin"].includes(user?.role);

  // Paleta theme-aware (patrón Caja.jsx: isLight por luminancia del bg).
  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");
  const RED    = isLight ? "#E02424" : "#F87171";
  const AMBER  = isLight ? "#D97706" : "#FBBF24";

  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 16,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
  };
  const inputStyle = {
    // ⚠️ `backgroundColor`, NUNCA el atajo `background`. Los <select> le suman la
    // flechita con backgroundImage/Repeat/Position (ver `caret`), y React aplica
    // los estilos por separado: al cambiar de tema reaplica SOLO el atajo, que
    // resetea background-repeat a «repeat» y background-position al origen. Los
    // valores largos no cambiaron, así que React no los vuelve a poner y la
    // flechita queda EN MOSAICO. Eso era el «¿En qué empresa?» rayado en gris y
    // blanco: cientos de flechitas repetidas, no un color de fondo feo.
    backgroundColor: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
    border: `1px solid ${bd}`, borderRadius: 10, padding: "10px 12px",
    fontSize: 13, fontFamily: font, outline: "none", width: "100%", boxSizing: "border-box",
    // colorScheme hace que el desplegable NATIVO del <select> use el tema correcto:
    // antes en oscuro las opciones salían con fondo blanco y texto claro (ilegible).
    colorScheme: isLight ? "light" : "dark",
  };

  /* Flechita ▾ para todo lo seleccionable (pedido de Ángel 29-jul): en los
     filtros la nativa quedaba PEGADA al borde derecho; en las pastillas de la
     hoja (estatus, empresa, ubicación…) no había ninguna y no se notaba que
     eran desplegables. Dibujamos la nuestra, del color del texto de cada uno,
     unos milímetros adentro. */
  const caret = useCallback((c, right = 9) => ({
    backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'><path d='M1 1l3 3 3-3' fill='none' stroke='${c}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`
    )}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `right ${right}px center`,
    paddingRight: right + 15,
  }), []);

  /* Estilo para los <select> de filtros: como selStyle pero con nuestra
     flechita, corrida unos milímetros del borde. */
  const selStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", cursor: "pointer", ...caret(txt2, 12) };

  const brandColor = useCallback(
    (brand) => ((brand && BRAND_HEX[brand.slug]) || BRAND_FALLBACK)[isLight ? "l" : "d"],
    [isLight]
  );

  /* ── Estado / datos ── */
  // El rol marketing entra por las 4 secciones del SIDEBAR (mkt_dia/mkt_marcas/…)
  // y los tabs siguen funcionando adentro ("en ambas" — Iván 21-jul).
  const [tab, setTab] = useState(() => {
    const t = initialTab || "reporte"; // reporte | dia | marcas | pipeline | solicitudes | equipo
    return HIDDEN_TABS.has(t) ? "reporte" : t; // pestaña oculta para este tenant → Actividades
  });
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [brands, setBrands]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [requests, setRequests] = useState([]);
  const [people, setPeople]     = useState([]); // profiles de la org (nombres + asignar)
  // Bitácora: lo que cada quien reporta que hizo en el día. Vive aparte de las
  // tareas a propósito — una tarea es algo que ALGUIEN pidió; la bitácora es el
  // relato del día, incluido todo lo que no estaba en ninguna lista.
  const [bitacora, setBitacora] = useState([]);
  // Columnas que el equipo agregó al registro (viven en mkt_pipeline_columns;
  // sus valores, en mkt_pipeline_items.datos).
  const [colsExtra, setColsExtra] = useState([]);
  const [bitaAbierta, setBitaAbierta] = useState(() => new Set()); // ids con el texto completo desplegado
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const [b, pj, tk, pl, rq, pr, bi, cols] = await Promise.all([
        supabase.from("mkt_brands").select("id, nombre, slug, activo, orden")
          .eq("organization_id", orgId).eq("activo", true).order("orden"),
        supabase.from("mkt_projects").select("id, brand_id, nombre, descripcion, drive_url, due_date, estado, orden, created_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("orden").order("created_at"),
        supabase.from("mkt_tasks").select("id, brand_id, project_id, titulo, descripcion, assignee_id, created_by, prioridad, estado, avance_pct, due_at, depends_on, drive_url, evidencia_url, evidencia_tipo, updated_at, created_at")
          .eq("organization_id", orgId).is("deleted_at", null)
          .order("due_at", { ascending: true, nullsFirst: false }).limit(600),
        supabase.from("mkt_pipeline_items").select("id, brand_id, nombre, locacion, etapa, fecha_rodaje, fecha_publicacion, precio, tipo, drive_url, ig_url, crudos_url, video_url, story_url, cine_url, ficha_url, info_url, notas, datos, orden, updated_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("orden").order("updated_at"),
        supabase.from("mkt_requests").select("id, brand_id, titulo, detalle, objetivo, complejidad, ref_image_url, fecha_entrega, solicitante, assignee_id, estado, orden, created_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, name, role").eq("organization_id", orgId),
        supabase.from("mkt_daily_reports").select("id, profile_id, fecha, texto, evidencia_url, origen, created_at, brand_id, tiempo_texto, area")
          .eq("organization_id", orgId)
          .order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(400),
        supabase.from("mkt_pipeline_columns").select("id, clave, nombre, tipo, opciones, orden")
          .eq("organization_id", orgId).is("deleted_at", null).order("orden"),
      ]);
      for (const r of [b, pj, tk, pl, rq, pr, bi, cols]) if (r.error) throw r.error;
      setBrands(b.data || []);
      setProjects(pj.data || []);
      setTasks(tk.data || []);
      setPipeline(pl.data || []);
      setRequests(rq.data || []);
      setPeople(pr.data || []);
      setBitacora(bi.data || []);
      setColsExtra(cols.data || []);
    } catch (e) {
      setError(`No pude cargar el módulo de ${MODULE_LABEL}. Probá actualizar.`);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  /* ── Índices y derivados ── */
  const brandById   = useMemo(() => Object.fromEntries(brands.map(b => [b.id, b])), [brands]);
  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const taskById    = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);
  const nameOf      = useCallback((id) => people.find(p => p.id === id)?.name || "—", [people]);
  // Asignables: el equipo de marketing + el propio usuario (admin que se auto-asigna).
  const assignees = useMemo(() => {
    const mk = people.filter(p => p.role === "marketing");
    if (user?.id && !mk.some(p => p.id === user.id)) {
      const me = people.find(p => p.id === user.id);
      if (me) mk.unshift(me);
    }
    return mk;
  }, [people, user?.id]);

  // Bitácora agrupada por persona, ya ordenada de lo más reciente a lo más viejo
  // (la consulta viene ordenada; acá solo se reparte por dueño).
  const bitacoraPor = useMemo(() => {
    const idx = {};
    for (const r of bitacora) (idx[r.profile_id] ||= []).push(r);
    return idx;
  }, [bitacora]);
  const toggleBita = useCallback((id) => {
    setBitaAbierta(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Bloqueada = su dependencia existe y NO está hecha (estado derivado, no guardado).
  const isBlocked  = useCallback((t) => !!(t.depends_on && taskById[t.depends_on] && taskById[t.depends_on].estado !== "hecha"), [taskById]);
  // Desbloqueada = tenía dependencia, ya se cumplió, y la tarea sigue pendiente.
  const isUnlocked = useCallback((t) => !!(t.depends_on && taskById[t.depends_on] && taskById[t.depends_on].estado === "hecha" && t.estado !== "hecha"), [taskById]);

  /* ── Mutaciones ── */
  const patch = useCallback(async (table, id, fields) => {
    setError("");
    const { error: e } = await supabase.from(table)
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", orgId);
    if (e) { setError("No se pudo guardar el cambio. Probá de nuevo."); return false; }
    return true;
  }, [orgId]);

  // Al completar: pedir EVIDENCIA de forma amigable y OPCIONAL (decisión Iván 21-jul:
  // "si tienes alguna evidencia la puedes enviar — suma a tu reporte"). Nunca obligatoria.
  const [evidence, setEvidence] = useState(null); // { task, url }
  const markTaskDone = useCallback(async (t, done) => {
    const ok = await patch("mkt_tasks", t.id, done
      ? { estado: "hecha", avance_pct: 100 }
      : { estado: "por_hacer" });
    if (ok) {
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, estado: done ? "hecha" : "por_hacer", avance_pct: done ? 100 : x.avance_pct } : x));
      if (done) setEvidence({ task: t, url: "" });
    }
  }, [patch]);
  const saveEvidence = useCallback(async () => {
    if (!evidence?.task) return;
    const url = (evidence.url || "").trim();
    if (url) {
      await patch("mkt_tasks", evidence.task.id, { evidencia_url: url, evidencia_tipo: "link" });
      setTasks(prev => prev.map(x => x.id === evidence.task.id ? { ...x, evidencia_url: url, evidencia_tipo: "link" } : x));
    }
    setEvidence(null);
  }, [evidence, patch]);
  const [evUploading, setEvUploading] = useState(false);
  const uploadEvidence = useCallback(async (file) => {
    if (!evidence?.task || !file) return;
    setEvUploading(true);
    setError("");
    try {
      const safe = String(file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `mkt/${orgId}/${evidence.task.id}/${Date.now()}-${safe}`;
      const { error: e } = await supabase.storage.from("evidencia").upload(path, file);
      if (e) throw e;
      const tipo = String(file.type || "").startsWith("video") ? "video" : "foto";
      await patch("mkt_tasks", evidence.task.id, { evidencia_url: path, evidencia_tipo: tipo });
      setTasks(prev => prev.map(x => x.id === evidence.task.id ? { ...x, evidencia_url: path, evidencia_tipo: tipo } : x));
      setEvidence(null);
    } catch {
      setError("No pude subir el archivo — puedes pegar un link en su lugar.");
    } finally {
      setEvUploading(false);
    }
  }, [evidence, orgId, patch]);

  // VER la evidencia (hallazgo de la auditoría 21-jul: se subía pero no se veía en
  // ningún lado). El bucket `evidencia` es privado → URL firmada al vuelo (mismo
  // patrón que Caja.jsx). Los links (evidencia_tipo='link') se abren directo.
  const [evViewer, setEvViewer] = useState(null); // { url, tipo, titulo } | { loading }
  /* ── FICHA DE LA PROPIEDAD ──
     Es el reemplazo del renglón de la hoja de cálculo: todo lo que había en el
     Sheet (precio, tipo, fechas y los seis enlaces) editable desde la tarjeta.
     Se abre tocando el nombre en el tablero. ── */
  const [ficha, setFicha] = useState(null);   // { id, ...campos como texto }
  const [fichaSaving, setFichaSaving] = useState(false);

  // `it` en null = ALTA. Es la MISMA ficha para crear y para editar: una sola
  // pantalla que aprender y una sola que mantener. Trae todos los campos de la
  // hoja, así se puede cargar una propiedad completa de una sentada — o solo el
  // nombre y llenar el resto después en la tabla.
  const openFicha = useCallback((it) => {
    const x = it || {};
    setFicha({
      id: x.id || null,
      nombre: x.nombre || "", etapa: x.etapa || "seleccionada",
      brand_id: x.brand_id || "", locacion: x.locacion || "",
      precio: x.precio || "", tipo: x.tipo || "",
      fecha_rodaje: x.fecha_rodaje || "", fecha_publicacion: x.fecha_publicacion || "",
      crudos_url: x.crudos_url || "", video_url: x.video_url || "", ig_url: x.ig_url || "",
      story_url: x.story_url || "", cine_url: x.cine_url || "", ficha_url: x.ficha_url || "",
      info_url: x.info_url || "", drive_url: x.drive_url || "", notas: x.notas || "",
      datos: x.datos || {},
    });
  }, []);

  const saveFicha = useCallback(async () => {
    if (!ficha) return;
    if (!String(ficha.nombre || "").trim()) { setError("Ponle un nombre a la propiedad."); return; }
    setFichaSaving(true);
    // Los vacíos se guardan como null, no como "": así un campo sin llenar no
    // se distingue de uno borrado y las condiciones `if (it.video_url)` siguen
    // funcionando en la tarjeta.
    const limpio = (s) => (String(s || "").trim() || null);
    const dukeBrand = brands.find(b => b.slug === "duke-del-caribe");
    const campos = {
      nombre: limpio(ficha.nombre) || ficha.nombre,
      etapa: ficha.etapa || "seleccionada",
      brand_id: ficha.brand_id || dukeBrand?.id || brands[0]?.id || null,
      locacion: limpio(ficha.locacion), precio: limpio(ficha.precio), tipo: limpio(ficha.tipo),
      fecha_rodaje: ficha.fecha_rodaje || null, fecha_publicacion: ficha.fecha_publicacion || null,
      crudos_url: limpio(ficha.crudos_url), video_url: limpio(ficha.video_url), ig_url: limpio(ficha.ig_url),
      story_url: limpio(ficha.story_url), cine_url: limpio(ficha.cine_url), ficha_url: limpio(ficha.ficha_url),
      info_url: limpio(ficha.info_url), drive_url: limpio(ficha.drive_url), notas: limpio(ficha.notas),
      datos: ficha.datos || {},
      updated_at: new Date().toISOString(),
    };
    // Sin id es una propiedad NUEVA. Nace al final de la lista con posición
    // propia, para que la tabla no se reacomode cuando la empiecen a llenar.
    const e = ficha.id
      ? (await supabase.from("mkt_pipeline_items").update(campos).eq("id", ficha.id)).error
      : (await supabase.from("mkt_pipeline_items").insert({
          ...campos, organization_id: orgId, created_by: user?.id || null,
          orden: pipeline.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1,
        })).error;
    setFichaSaving(false);
    if (e) { setError("No pude guardar la ficha. Probá de nuevo."); return; }
    setFicha(null);
    load();
  }, [ficha, brands, orgId, user?.id, pipeline, load]);

  const openEvidence = useCallback(async (t) => {
    const path = t?.evidencia_url;
    if (!path) return;
    if (/^https?:\/\//i.test(path)) { window.open(path, "_blank", "noopener"); return; }
    setEvViewer({ loading: true });
    try {
      const { data, error: e } = await supabase.storage.from("evidencia").createSignedUrl(path, 3600);
      if (e) throw e;
      setEvViewer({ url: data.signedUrl, tipo: t.evidencia_tipo || "foto", titulo: t.titulo });
    } catch {
      setEvViewer(null);
      setError("No pude abrir la evidencia. Probá de nuevo.");
    }
  }, []);

  const setTaskState = useCallback(async (t, estado) => {
    const fields = { estado };
    if (estado === "hecha") fields.avance_pct = 100;
    const ok = await patch("mkt_tasks", t.id, fields);
    if (ok) setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...fields } : x));
  }, [patch]);

  const moveStage = useCallback(async (item, dir) => {
    const idx = ETAPAS.findIndex(e => e.id === item.etapa);
    const next = typeof dir === "string" ? dir : ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, idx + dir))]?.id;
    if (!next || next === item.etapa) return;
    const ok = await patch("mkt_pipeline_items", item.id, { etapa: next });
    if (ok) setPipeline(prev => prev.map(x => x.id === item.id ? { ...x, etapa: next } : x));
  }, [patch]);

  /* ── Piezas de UI (funciones render, NO componentes — ver nota de cabecera) ── */

  const brandChip = (brandId, small = true) => {
    const b = brandById[brandId];
    if (!b) return null;
    const c = brandColor(b);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: small ? "2px 8px" : "3px 10px",
        borderRadius: 999, fontSize: small ? 11.5 : 12, fontWeight: 600, fontFamily: font,
        color: c, background: `${c}1A`, border: `1px solid ${c}40`, whiteSpace: "nowrap",
      }}>{b.nombre}</span>
    );
  };

  const statePill = (estado, list = TASK_STATES) => {
    const l = list.find(s => s.id === estado)?.l || estado;
    const done = estado === "hecha" || estado === "entregada";
    return (
      <span style={{
        padding: "3px 10px", borderRadius: 999, fontSize: 12, fontFamily: font, whiteSpace: "nowrap",
        color: done ? accent : txt2, background: done ? `${accent}14` : (isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)"),
        border: `1px solid ${done ? `${accent}40` : bd}`,
      }}>{l}</span>
    );
  };

  const sectionTitle = (label, color) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: color || txt, fontFamily: fontDisp, letterSpacing: "-0.01em", margin: "6px 0 2px" }}>
      {label}
    </div>
  );

  const emptyRow = (text) => (
    <div style={{ ...card, padding: 20, textAlign: "center", color: txt3, fontSize: 12.5 }}>{text}</div>
  );

  // Tabs SEGMENTADOS estilo "Mi Espacio" (mockup aprobado por Iván/Ángel 21-jul):
  // contenedor tipo pastilla, activo = pill elevada. Sin subrayados.
  const tabBtn = (id, label, badge) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: isMobile ? "8px 13px" : "9px 20px", borderRadius: 12, cursor: "pointer",
      fontSize: isMobile ? 12.5 : 13.5, fontFamily: font, whiteSpace: "nowrap",
      fontWeight: tab === id ? 650 : 500,
      border: `1px solid ${tab === id ? bd : "transparent"}`,
      background: tab === id ? (isLight ? "#FFFFFF" : "rgba(255,255,255,0.07)") : "transparent",
      color: tab === id ? txt : txt2,
      boxShadow: tab === id ? (isLight ? "0 1px 3px rgba(15,23,42,0.10)" : "0 2px 8px rgba(0,0,0,0.35)") : "none",
      display: "inline-flex", alignItems: "center", gap: 6, transition: "all .15s ease",
    }}>
      {label}
      {badge > 0 && (
        <span style={{
          minWidth: 17, height: 17, borderRadius: 999, background: RED, color: "#fff",
          fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
        }}>{badge}</span>
      )}
    </button>
  );

  /* ════════════════════ TAB: MI DÍA ════════════════════ */

  const hoy = todayStr(), man = tomorrowStr();
  const rodajesHoy = useMemo(() => pipeline.filter(p => p.fecha_rodaje === hoy), [pipeline, hoy]);
  // ¿Esta persona ya contó su día? Decide si mostrarle el recordatorio en Mi Día.
  const yaReporteHoy = useMemo(
    () => bitacora.some(r => r.profile_id === user?.id && r.fecha === hoy),
    [bitacora, user?.id, hoy]);
  const mine = useMemo(() => tasks.filter(t => t.assignee_id === user?.id && t.estado !== "hecha"), [tasks, user?.id]);
  const vencidas   = useMemo(() => mine.filter(t => t.due_at && dayStr(t.due_at) < hoy && !isBlocked(t)), [mine, hoy, isBlocked]);
  const paraHoy    = useMemo(() => mine.filter(t => !isBlocked(t) && (!t.due_at || dayStr(t.due_at) === hoy)), [mine, hoy, isBlocked]);
  const bloqueadas = useMemo(() => mine.filter(t => isBlocked(t)), [mine, isBlocked]);
  const deManana   = useMemo(() => mine.filter(t => t.due_at && dayStr(t.due_at) === man && !isBlocked(t)), [mine, man, isBlocked]);
  const [showManana, setShowManana] = useState(false);

  const taskRow = (t, { overdue = false, blocked = false } = {}) => {
    const p = t.project_id ? projectById[t.project_id] : null;
    const unlocked = isUnlocked(t);
    const dep = t.depends_on ? taskById[t.depends_on] : null;
    return (
      <div key={t.id} style={{
        ...card, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
        opacity: blocked ? 0.62 : 1,
        borderLeft: overdue ? `3px solid ${RED}` : `1px solid ${bd}`,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        {blocked ? (
          <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)", border: `1px solid ${bd}` }}>
            <Lock size={14} color={txt3} />
          </div>
        ) : (
          <button onClick={() => markTaskDone(t, true)} title="Marcar hecha" style={{
            width: 22, height: 22, borderRadius: 999, flexShrink: 0, cursor: "pointer",
            border: `1.5px solid ${txt3}`, background: "transparent",
          }} />
        )}
        <div style={{ flex: 1, minWidth: isMobile ? "60%" : 0 }}>
          <div style={{ fontSize: 13.5, color: txt, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {t.titulo}
            {unlocked && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999,
                fontSize: 11.5, fontWeight: 700, color: isLight ? "#FFFFFF" : "#04140F",
                background: accent, whiteSpace: "nowrap",
              }}><Check size={11} strokeWidth={3} /> Desbloqueada</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: txt3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {p && <span>Proyecto: {p.nombre}</span>}
            {unlocked && dep && <span style={{ color: txt2 }}>· se completó “{dep.titulo}”</span>}
            {blocked && dep && (
              <span>Esperando: “{dep.titulo}” {dep.assignee_id ? `· ${nameOf(dep.assignee_id)}` : ""} · hace {diasDesde(dep.created_at)} días</span>
            )}
          </div>
        </div>
        {brandChip(t.brand_id)}
        {!blocked && statePill(t.estado)}
        <div style={{ fontSize: 12.5, color: overdue ? RED : txt2, fontFamily: font, whiteSpace: "nowrap", fontWeight: overdue ? 700 : 400 }}>
          {overdue ? `Venció ${fmtDia(t.due_at)}` : (t.due_at ? fmtHora(t.due_at) || fmtDia(t.due_at) : "")}
        </div>
        {t.drive_url && (
          <a href={t.drive_url} target="_blank" rel="noreferrer" title="Abrir carpeta en Drive" style={{ color: txt3, display: "flex" }}>
            <Folder size={15} />
          </a>
        )}
      </div>
    );
  };

  const miDia = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Recordatorio de la bitácora. El líder solo ve el trabajo del equipo si
          el equipo lo cuenta, así que acá va el empujón — discreto, una sola
          línea, y desaparece en cuanto la persona reportó. No es obligatorio:
          si alguien no reporta, no pasa nada y nadie lo persigue. */}
      {!yaReporteHoy && (
        <div style={{ ...card, borderRadius: 13, padding: "11px 15px", display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
          <CircleCheck size={16} color={txt3} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 170, fontSize: 12.5, color: txt2, lineHeight: 1.45 }}>
            Todavía no cuentas tu reporte de hoy.
            <span style={{ color: txt3 }}> Son dos minutos y tu líder ya no tiene que preguntarte.</span>
          </div>
          {/* Lleva a la CAJA, no al chat: es donde Alex pidió que se reporte. */}
          <button onClick={() => setTab("reporte")} style={{
            background: "transparent", border: `1px solid ${accent}44`, borderRadius: 9, padding: "5px 11px",
            cursor: "pointer", color: accent, fontSize: 12.5, fontFamily: font, whiteSpace: "nowrap",
          }}>Contarlo ahora</button>
        </div>
      )}

      {rodajesHoy.map(r => (
        <div key={r.id} style={{ ...card, borderRadius: 13, padding: "11px 15px", display: "flex", alignItems: "center", gap: 11 }}>
          <Clapperboard size={16} color={accent} />
          <div style={{ flex: 1, fontSize: 13, color: txt }}>
            <b style={{ fontWeight: 600 }}>Rodaje de hoy</b> — {r.nombre}{r.locacion ? ` · ${r.locacion}` : ""}
          </div>
          {r.drive_url && (
            <a href={r.drive_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: txt2, fontSize: 12.5, textDecoration: "none" }}>
              <Folder size={14} /> {isMobile ? "" : "Carpeta en Drive"}
            </a>
          )}
        </div>
      ))}

      {vencidas.length > 0 && (
        <>
          {sectionTitle("Vencidas", RED)}
          {vencidas.map(t => taskRow(t, { overdue: true }))}
        </>
      )}

      {sectionTitle("Para hoy")}
      {paraHoy.length === 0 && emptyRow(`Nada pendiente para hoy. Crea una tarea desde ${tabLabel("marcas", "Marcas")}${onOpenCopilot ? " o dictala con voz" : ""}.`)}
      {paraHoy.map(t => taskRow(t))}

      {bloqueadas.length > 0 && (
        <>
          {sectionTitle("Bloqueadas — no dependen de ti")}
          {bloqueadas.map(t => taskRow(t, { blocked: true }))}
        </>
      )}

      {deManana.length > 0 && (
        <button onClick={() => setShowManana(s => !s)} style={{
          ...card, borderRadius: 13, padding: "11px 15px", cursor: "pointer", textAlign: "left",
          color: txt2, fontSize: 13, fontFamily: font, display: "flex", alignItems: "center", gap: 8,
        }}>
          <ChevronDown size={15} style={{ transform: showManana ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
          Mañana ({deManana.length})
        </button>
      )}
      {showManana && deManana.map(t => taskRow(t))}
    </div>
  );

  /* ════════════════════ TAB: MARCAS ════════════════════ */

  const [openProject, setOpenProject] = useState(null);   // id del proyecto expandido
  const [newProjBrand, setNewProjBrand] = useState(null); // brand_id con form abierto
  const [projForm, setProjForm] = useState({ nombre: "", due: "", drive: "" });
  const [taskForm, setTaskForm] = useState({ titulo: "", assignee: "", due: "", dependsOn: "", drive: "" });
  const [saving, setSaving] = useState(false);

  const projectProgress = useCallback((pid) => {
    const tt = tasks.filter(t => t.project_id === pid);
    if (!tt.length) return { done: 0, total: 0, pct: 0 };
    const done = tt.filter(t => t.estado === "hecha").length;
    return { done, total: tt.length, pct: Math.round((done / tt.length) * 100) };
  }, [tasks]);

  const createProject = async (brandId) => {
    if (!projForm.nombre.trim()) return;
    setSaving(true);
    const { error: e } = await supabase.from("mkt_projects").insert({
      organization_id: orgId, brand_id: brandId, nombre: projForm.nombre.trim(),
      due_date: projForm.due || null, drive_url: projForm.drive.trim() || null, created_by: user?.id || null,
    });
    setSaving(false);
    if (e) { setError("No se pudo crear el proyecto."); return; }
    setProjForm({ nombre: "", due: "", drive: "" });
    setNewProjBrand(null);
    load();
  };

  const createTask = async (project) => {
    if (!taskForm.titulo.trim()) return;
    setSaving(true);
    const { error: e } = await supabase.from("mkt_tasks").insert({
      organization_id: orgId, brand_id: project.brand_id, project_id: project.id,
      titulo: taskForm.titulo.trim(),
      assignee_id: taskForm.assignee || null,
      due_at: taskForm.due ? new Date(taskForm.due).toISOString() : null,
      depends_on: taskForm.dependsOn || null,
      drive_url: taskForm.drive.trim() || null,
      estado: "por_hacer", prioridad: "media", avance_pct: 0,
      created_by: user?.id || null, origen: "web",
    });
    setSaving(false);
    if (e) { setError("No se pudo crear la tarea."); return; }
    setTaskForm({ titulo: "", assignee: "", due: "", dependsOn: "", drive: "" });
    load();
  };

  const projectCard = (p) => {
    const prog = projectProgress(p.id);
    const open = openProject === p.id;
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const c = brandColor(brandById[p.brand_id]);
    return (
      <div key={p.id} style={{ borderRadius: 12, border: `1px solid ${open ? `${accent}44` : bd}`, background: isLight ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.025)" }}>
        <button onClick={() => setOpenProject(open ? null : p.id)} style={{
          width: "100%", padding: "11px 13px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left", fontFamily: font,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, fontSize: 13, color: txt, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
            {p.due_date && <span style={{ fontSize: 12, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(p.due_date)}</span>}
            {p.drive_url && <Folder size={13} color={txt3} />}
            <span style={{ fontSize: 12, color: txt2, whiteSpace: "nowrap" }}>{prog.done}/{prog.total}</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${prog.pct}%`, height: "100%", borderRadius: 999, background: c, transition: "width .3s ease" }} />
          </div>
        </button>
        {open && (
          <div style={{ padding: "2px 13px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
            {projTasks.length === 0 && <div style={{ fontSize: 12.5, color: txt3 }}>Sin tareas todavía.</div>}
            {projTasks.map(t => {
              const blocked = isBlocked(t);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, opacity: blocked ? 0.6 : 1, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                  {blocked ? <Lock size={13} color={txt3} style={{ flexShrink: 0 }} /> : (
                    <button onClick={() => markTaskDone(t, t.estado !== "hecha")} title={t.estado === "hecha" ? "Reabrir" : "Marcar hecha"} style={{
                      width: 17, height: 17, borderRadius: 999, flexShrink: 0, cursor: "pointer",
                      border: `1.5px solid ${t.estado === "hecha" ? accent : txt3}`,
                      background: t.estado === "hecha" ? accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}>{t.estado === "hecha" && <Check size={11} color={isLight ? "#fff" : "#04140F"} strokeWidth={3} />}</button>
                  )}
                  <span style={{ flex: 1, fontSize: 12.5, color: t.estado === "hecha" ? txt3 : txt, textDecoration: t.estado === "hecha" ? "line-through" : "none", minWidth: 0 }}>
                    {t.titulo}
                    {blocked && <span style={{ color: txt3 }}> · esperando “{taskById[t.depends_on]?.titulo}”</span>}
                  </span>
                  {t.assignee_id && <span style={{ fontSize: 12, color: txt2, whiteSpace: "nowrap" }}>{nameOf(t.assignee_id)}</span>}
                  {t.due_at && <span style={{ fontSize: 12, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(t.due_at)}</span>}
                  {t.evidencia_url && (
                    <button onClick={() => openEvidence(t)} title="Ver evidencia" style={{
                      background: "transparent", border: `1px solid ${accent}44`, borderRadius: 7,
                      padding: "3px 7px", cursor: "pointer", color: accent, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontFamily: font,
                    }}><Camera size={12} /> Evidencia</button>
                  )}
                  <select value={t.estado} onChange={e => setTaskState(t, e.target.value)} style={{ ...selStyle, width: "auto", padding: "3px 6px", fontSize: 12, ...caret(txt2, 7) }}>
                    {TASK_STATES.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
                  </select>
                </div>
              );
            })}
            {/* Alta de tarea dentro del proyecto */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 7, marginTop: 6 }}>
              <input placeholder="Nueva tarea…" value={taskForm.titulo} onChange={e => setTaskForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
              <select value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} style={selStyle}>
                <option value="">Asignar a…</option>
                {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="datetime-local" value={taskForm.due} onChange={e => setTaskForm(f => ({ ...f, due: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 7 }}>
              <select value={taskForm.dependsOn} onChange={e => setTaskForm(f => ({ ...f, dependsOn: e.target.value }))} style={selStyle} title="La tarea queda bloqueada hasta que ésta se complete">
                <option value="">Sin dependencia</option>
                {projTasks.filter(t => t.estado !== "hecha").map(t => <option key={t.id} value={t.id}>Bloqueada por: {t.titulo}</option>)}
              </select>
              <input placeholder="Link Drive (opcional)" value={taskForm.drive} onChange={e => setTaskForm(f => ({ ...f, drive: e.target.value }))} style={inputStyle} />
              <button onClick={() => createTask(p)} disabled={saving || !taskForm.titulo.trim()} style={{
                background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 10, padding: "9px 16px",
                cursor: "pointer", color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: font,
                opacity: saving || !taskForm.titulo.trim() ? 0.55 : 1, whiteSpace: "nowrap",
              }}><Plus size={13} style={{ verticalAlign: "-2px" }} /> Tarea</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const marcas = () => (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14 }}>
      {brands.map(b => {
        const bProjects = projects.filter(p => p.brand_id === b.id && p.estado !== "terminado");
        // Tareas de la marca SIN proyecto (ej. creadas por el Copilot): antes no se
        // renderizaban en ningún lado de esta tab (solo viven dentro de projectCard).
        const bLoose = tasks.filter(t => t.brand_id === b.id && !t.project_id && t.estado !== "hecha");
        const c = brandColor(b);
        return (
          <div key={b.id} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: txt, fontFamily: fontDisp }}>{b.nombre}</div>
              <span style={{ fontSize: 12, color: txt3 }}>{bProjects.length} proyecto{bProjects.length === 1 ? "" : "s"}</span>
              <button onClick={() => { setNewProjBrand(newProjBrand === b.id ? null : b.id); setProjForm({ nombre: "", due: "", drive: "" }); }} title="Nuevo proyecto" style={{
                background: "transparent", border: `1px solid ${bd}`, borderRadius: 9, padding: "5px 8px",
                cursor: "pointer", color: txt2, display: "flex", alignItems: "center",
              }}>{newProjBrand === b.id ? <X size={13} /> : <Plus size={13} />}</button>
            </div>
            {newProjBrand === b.id && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <input autoFocus placeholder="Nombre del proyecto *" value={projForm.nombre} onChange={e => setProjForm(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 7 }}>
                  <input type="date" value={projForm.due} onChange={e => setProjForm(f => ({ ...f, due: e.target.value }))} style={inputStyle} />
                  <input placeholder="Link Drive" value={projForm.drive} onChange={e => setProjForm(f => ({ ...f, drive: e.target.value }))} style={inputStyle} />
                  <button onClick={() => createProject(b.id)} disabled={saving || !projForm.nombre.trim()} style={{
                    background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 10, padding: "9px 14px",
                    cursor: "pointer", color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: font,
                    opacity: saving || !projForm.nombre.trim() ? 0.55 : 1,
                  }}>Crear</button>
                </div>
              </div>
            )}
            {bProjects.length === 0 && newProjBrand !== b.id && (
              <div style={{ fontSize: 12.5, color: txt3 }}>Sin proyectos activos. Agregá el primero con “+”.</div>
            )}
            {bProjects.map(p => projectCard(p))}
            {bLoose.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: bProjects.length ? `1px solid ${bd}` : "none", paddingTop: bProjects.length ? 8 : 0 }}>
                <div style={{ fontSize: 12, color: txt3, fontWeight: 600 }}>Sin proyecto · {bLoose.length}</div>
                {bLoose.map(t => taskRow(t, { overdue: !!(t.due_at && dayStr(t.due_at) < hoy), blocked: isBlocked(t) }))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ════════════════════ TAB: PIPELINE (kanban) ════════════════════ */

  const [dragId, setDragId] = useState(null);
  const [showPipeForm, setShowPipeForm] = useState(false);
  const [pipeForm, setPipeForm] = useState({ nombre: "", locacion: "", brand: "", etapa: "seleccionada", rodaje: "", drive: "", ig: "" });

  const createPipeline = async () => {
    if (!pipeForm.nombre.trim()) return;
    setSaving(true);
    const dukeBrand = brands.find(b => b.slug === "duke-del-caribe");
    const { error: e } = await supabase.from("mkt_pipeline_items").insert({
      organization_id: orgId,
      brand_id: pipeForm.brand || dukeBrand?.id || null,
      nombre: pipeForm.nombre.trim(), locacion: pipeForm.locacion.trim() || null,
      etapa: pipeForm.etapa, fecha_rodaje: pipeForm.rodaje || null,
      drive_url: pipeForm.drive.trim() || null, ig_url: pipeForm.ig.trim() || null,
      // Igual que el alta desde la tabla: posición explícita para que la fila
      // no se reacomode sola cuando la editen.
      orden: pipeline.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1,
      created_by: user?.id || null,
    });
    setSaving(false);
    if (e) { setError("No se pudo agregar la propiedad."); return; }
    setPipeForm({ nombre: "", locacion: "", brand: "", etapa: "seleccionada", rodaje: "", drive: "", ig: "" });
    setShowPipeForm(false);
    load();
  };

  /* ════════════ LAS DOS HOJAS, COMO HOJAS ════════════
     Alex y su equipo vienen de dos Google Sheets y así es como leen su trabajo:
     de corrido, con filtros y con el color del estatus. El tablero kanban y la
     caja de reporte sirven para OPERAR; estas tablas sirven para MIRAR — que es
     lo que él hace cuando pregunta «¿cuáles casas grabamos en Cancún?».
     Ambas viven al lado de su vista operativa, no la reemplazan. */

  const hoja = {
    wrap:  { ...card, borderRadius: 14, overflowX: "auto", WebkitOverflowScrolling: "touch" },
    table: { borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 1180, fontFamily: font },
    th: {
      position: "sticky", top: 0, zIndex: 1, textAlign: "left", whiteSpace: "nowrap",
      padding: "9px 11px", fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3,
      color: txt2, background: isLight ? "#EEF2F7" : "rgba(255,255,255,0.055)",
      borderBottom: `1px solid ${bd}`,
    },
    td: { padding: "9px 11px", fontSize: 12.5, color: txt2, borderBottom: `1px solid ${bd}`, verticalAlign: "top" },
    /* La primera columna queda fija al desplazarse a lo ancho: con 17 columnas,
       sin esto se pierde de vista de qué propiedad es la fila que estás llenando.
       El fondo tiene que ser OPACO (el de la tarjeta es translúcido y dejaría
       ver el contenido pasando por debajo). */
    congelada: {
      position: "sticky", left: 0, zIndex: 2,
      background: isLight ? "#FBFCFE" : "#0C1119",
      borderRight: `1px solid ${bd}`,
    },
  };
  const chip = (texto, color) => (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap",
      fontSize: 11.5, fontWeight: 600, color, background: `${color}1E`, border: `1px solid ${color}44`,
    }}>{texto}</span>
  );
  const linkCel = (url, label) => url
    ? <a href={url} target="_blank" rel="noreferrer" style={{ color: accent, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>{label}</a>
    : <span style={{ color: txt3, fontSize: 12 }}>—</span>;

  /* ── HOJA 1: el registro de propiedades y grabaciones ── */

  /* La TABLA es la vista de arranque, no el tablero: Alex trabaja en una hoja,
     no en un kanban. Y se recuerda lo último que eligió cada persona — el que
     prefiera el tablero lo tiene ahí y no se lo volvemos a cambiar. */
  const vistaKey = user?.id ? `stratos.mkt.registro.vista.${user.id}` : null;
  const [pipeVista, setPipeVista] = useState(() => {
    if (!SHOW_VISTA_TABLA) return "tablero"; // la hoja vive en Actividades → Espacio 1
    try { return (vistaKey && localStorage.getItem(vistaKey)) || "tabla"; } catch (_) { return "tabla"; }
  });
  const elegirVista = useCallback((v) => {
    setPipeVista(v);
    try { if (vistaKey) localStorage.setItem(vistaKey, v); } catch (_) {}
  }, [vistaKey]);

  /* El AÑO reemplaza a las pestañas de su hoja (2026 · 2025 · …). Arranca en el
     año en curso, como cuando ellos abren el archivo, y desde el mismo lugar se
     ve el histórico sin cambiar de pantalla. */
  const anioDe = (p) => String(p.fecha_publicacion || p.fecha_rodaje || "").slice(0, 4);
  // El filtro es UNO SOLO: texto. Los cinco desplegables (año, estatus, empresa,
  // ubicación y tipo) se fueron —Iván, 30-jul: «son muchos botones»— y su
  // trabajo lo hace el buscador, que mira todos esos campos.
  const [pipeFiltro, setPipeFiltro] = useState({ q: "" });

  /* UN SOLO BUSCADOR en vez de seis desplegables. Mira todo lo que antes
     filtraba cada uno —nombre, ubicación, estatus (con SU nombre: «Sin voz en
     off», no «esperando_voz»), empresa, tipo, precio, año y notas— así que
     escribir «Tulum», «2025», «Publicada» o «Depto» hace el mismo trabajo, y
     nadie tiene que aprenderse qué desplegable usa cada cosa.
     Se pueden encadenar palabras: «tulum publicada» filtra por las dos. */
  const textoDe = useCallback((p) => [
    p.nombre, p.locacion, p.tipo, p.precio, p.notas,
    ETAPAS.find(e => e.id === p.etapa)?.l,
    brandById[p.brand_id]?.nombre,
    anioDe(p),
    ...Object.values(p.datos || {}),
  ].filter(Boolean).join(" ").toLowerCase(), [brandById]);

  const pipeFiltrado = useMemo(() => {
    const palabras = pipeFiltro.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!palabras.length) return pipeline;
    return pipeline.filter(p => {
      const t = textoDe(p);
      return palabras.every(w => t.includes(w));
    });
  }, [pipeline, pipeFiltro.q, textoDe]);

  const locaciones = useMemo(() => [...new Set(pipeline.map(p => p.locacion).filter(Boolean))].sort(), [pipeline]);
  const tipos      = useMemo(() => [...new Set(pipeline.map(p => p.tipo).filter(Boolean))].sort(), [pipeline]);

  /* ── Qué columnas se ven ──────────────────────────────────────────────────
     Son 17 columnas y nadie usa las 17 todos los días. Cada quien apaga las que
     no mira y la tabla se le queda a su medida (se guarda en su navegador, no
     en la base: es una preferencia personal, no un dato del equipo).
     Propiedad y Estatus no se pueden apagar — sin ellas la tabla no se lee. */
  const colsKey = user?.id ? `stratos.mkt.registro.cols.${user.id}` : null;
  const [colsOcultas, setColsOcultas] = useState(() => {
    try { return new Set(JSON.parse((colsKey && localStorage.getItem(colsKey)) || "[]")); }
    catch (_) { return new Set(); }
  });
  const [showCols, setShowCols] = useState(false);
  const toggleCol = useCallback((key) => {
    setColsOcultas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { if (colsKey) localStorage.setItem(colsKey, JSON.stringify([...next])); } catch (_) {}
      return next;
    });
  }, [colsKey]);

  // Las columnas visibles, ya mezcladas: las de siempre + las que inventó el equipo.
  const colsVista = useMemo(() => ([
    ...COLS_REGISTRO.filter(c => c.fija || !colsOcultas.has(c.key)),
    ...colsExtra.map(c => ({
      key: c.clave, l: c.nombre, extra: true, propia: c,
      tipo: c.tipo === "enlace" ? "enlace" : c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text",
      ancho: c.tipo === "enlace" ? 180 : 120,
    })),
  ]), [colsOcultas, colsExtra]);

  // Sobre cuáles salta el cursor con Enter / Tab (las que se escriben a mano;
  // las de desplegable se resuelven con un clic y no necesitan el salto).
  const colsNav = useMemo(
    () => colsVista.filter(c => !["etapa", "marca", "catalogo"].includes(c.tipo)),
    [colsVista]
  );

  /* Guardar una celda. Optimista NO: se guarda y se recarga, porque el dato de
     una propiedad lo pueden estar tocando dos personas a la vez y prefiero que
     la tabla muestre lo que hay en la base, no lo que yo creo que hay. */
  // { id, campo, valor, extra?, tabla? } — `tabla` permite que la MISMA celda
  // editable sirva para el registro de propiedades y para la bitácora.
  const [celda, setCelda] = useState(null);
  const [celdaSaving, setCeldaSaving] = useState(false);

  const PIPE = "mkt_pipeline_items";
  const BITA = "mkt_daily_reports";
  const filaDe = useCallback(
    (tabla, id) => (tabla === BITA ? bitacora : pipeline).find(x => x.id === id),
    [bitacora, pipeline]
  );

  const guardarCelda = useCallback(async (siguiente = null) => {
    if (!celda?.id) return;
    const { id, campo, valor, extra, tabla = PIPE } = celda;
    const fila = filaDe(tabla, id);
    const antes = extra ? (fila?.datos?.[campo] ?? "") : (fila?.[campo] ?? "");
    const limpio = String(valor ?? "").trim() || null;

    // Si no cambió nada (entró a la celda y se fue), no se escribe ni se recarga.
    // Además de ahorrar viajes, esto evita el doble guardado cuando el salto con
    // Enter/Tab desmonta el input y dispara su onBlur.
    if (String(antes ?? "") === String(limpio ?? "")) { setCelda(siguiente); return; }

    setCeldaSaving(true);
    // Columna propia → se mezcla dentro del jsonb sin pisar las demás llaves.
    const payload = extra
      ? { datos: { ...(fila?.datos || {}), [campo]: limpio } }
      : { [campo]: limpio };
    // La bitácora no tiene `updated_at`; el registro sí y lo usa para ordenar.
    if (tabla === PIPE) payload.updated_at = new Date().toISOString();
    const { error: e } = await supabase.from(tabla).update(payload).eq("id", id);
    setCeldaSaving(false);
    setCelda(siguiente);
    if (e) { setError("No pude guardar ese dato. Probá de nuevo."); return; }
    load();
  }, [celda, filaDe, load]);

  /* Guardar un campo de un tirón (los desplegables: estatus, empresa, ubicación,
     tipo). No pasa por el modo edición porque se resuelven con un solo clic. */
  const guardarCampo = useCallback(async (tabla, id, campo, valor) => {
    const payload = { [campo]: valor || null };
    if (tabla === PIPE) payload.updated_at = new Date().toISOString();
    const { error: e } = await supabase.from(tabla).update(payload).eq("id", id);
    if (e) { setError("No pude guardar ese cambio. Probá de nuevo."); return; }
    load();
  }, [load]);

  /* Moverse como en Excel: Enter baja, Tab va a la derecha (y al final de la
     fila salta a la siguiente). Devuelve la celda destino o null si ya no hay. */
  const celdaVecina = useCallback((desde, dir) => {
    if (!desde) return null;
    const fi = pipeFiltrado.findIndex(p => p.id === desde.id);
    const ci = colsNav.findIndex(c => c.key === desde.campo && !!c.extra === !!desde.extra);
    if (fi < 0 || ci < 0) return null;
    let nf = fi, nc = ci;
    if (dir === "abajo") nf = fi + 1;
    else { nc = ci + 1; if (nc >= colsNav.length) { nc = 0; nf = fi + 1; } }
    if (nf >= pipeFiltrado.length || nf < 0) return null;
    const col = colsNav[nc];
    const destino = pipeFiltrado[nf];
    const valor = col.extra ? (destino.datos?.[col.key] ?? "") : (destino[col.key] ?? "");
    return { id: destino.id, campo: col.key, valor: valor || "", extra: !!col.extra };
  }, [pipeFiltrado, colsNav]);

  /* El estatus NO se edita por clic: es un desplegable siempre visible, porque
     cambiarlo es la acción más frecuente de la tabla (lo pidió Alex así). */
  const cambiarEtapa   = useCallback((id, etapa)   => guardarCampo(PIPE, id, "etapa", etapa),      [guardarCampo]);
  // Empresa (marca): Alex lo pidió expreso en la reunión — el equipo graba para
  // varias empresas del corporativo y sin esta columna no sabe de cuál es cada video.
  const cambiarEmpresa = useCallback((id, brandId) => guardarCampo(PIPE, id, "brand_id", brandId), [guardarCampo]);

  /* Sacar una fila de la tabla. NO se borra (la tabla no tiene permiso de
     DELETE, a propósito): se marca con fecha de archivado y deja de mostrarse.
     Se puede devolver desde la base si alguien se equivoca. */
  const [archivarId, setArchivarId] = useState(null);
  const archivarPropiedad = useCallback(async (id) => {
    const { error: e } = await supabase.from("mkt_pipeline_items")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setArchivarId(null);
    if (e) { setError("No pude quitar esa propiedad."); return; }
    load();
  }, [load]);

  /* Alta desde la última fila de la tabla, como en una hoja: se escribe el
     nombre, Enter, y ya está. El formulario de arriba sigue existiendo para
     quien quiera cargarla completa de una vez. */
  const [filaNueva, setFilaNueva] = useState("");
  const [filaNuevaSaving, setFilaNuevaSaving] = useState(false);
  const crearDesdeTabla = useCallback(async () => {
    const nombre = filaNueva.trim();
    if (!nombre || !orgId) return;
    setFilaNuevaSaving(true);
    const dukeBrand = brands.find(b => b.slug === "duke-del-caribe");
    const { error: e } = await supabase.from("mkt_pipeline_items").insert({
      organization_id: orgId,
      brand_id: dukeBrand?.id || brands[0]?.id || null,
      nombre, etapa: "seleccionada",
      // Posición explícita: la tabla ordena por `orden` y recién después por
      // fecha de cambio. Sin esto, la fila nueva se movería de lugar cada vez
      // que alguien le escribe algo — y no se puede trabajar en una tabla que
      // se reacomoda sola.
      orden: pipeline.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1,
      created_by: user?.id || null,
    });
    setFilaNuevaSaving(false);
    if (e) { setError("No pude agregar esa propiedad."); return; }
    setFilaNueva("");
    load();
  }, [filaNueva, orgId, brands, pipeline, user?.id, load]);

  /* ── Columnas propias: agregarlas sin que nosotros toquemos el esquema ── */
  const [colForm, setColForm] = useState(null);   // { nombre, tipo } | null

  const crearColumna = useCallback(async () => {
    const nombre = String(colForm?.nombre || "").trim();
    if (!nombre || !orgId) return;
    // La clave se deriva del nombre: estable aunque después lo renombren.
    const clave = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || `col_${Date.now()}`;
    const { error: e } = await supabase.from("mkt_pipeline_columns").insert({
      organization_id: orgId, clave, nombre, tipo: colForm.tipo || "texto",
      orden: colsExtra.length + 1, created_by: user?.id || null,
    });
    if (e) { setError(e.code === "23505" ? "Ya existe una columna con ese nombre." : "No pude crear la columna."); return; }
    setColForm(null);
    load();
  }, [colForm, orgId, colsExtra.length, user?.id, load]);

  const archivarColumna = useCallback(async (col) => {
    // No se borra: se archiva. Los valores siguen en `datos` por si vuelven.
    const { error: e } = await supabase.from("mkt_pipeline_columns")
      .update({ deleted_at: new Date().toISOString() }).eq("id", col.id);
    if (e) { setError("No pude quitar la columna."); return; }
    load();
  }, [load]);

  /* Celda editable. Se renderiza como JSX suelto (NO como componente anidado):
     un componente definido acá adentro cambiaría de identidad en cada render y
     el input perdería el foco al tipear — está avisado arriba en este archivo. */
  const celdaEditable = (fila, campo, {
    tipo = "text", extra = false, ancho = 110, placeholder = "—", fuerte = false,
    tabla = PIPE, multilinea = false, clamp = false,
  } = {}) => {
    const editando = celda && celda.id === fila.id && celda.campo === campo
      && !!celda.extra === !!extra && (celda.tabla || PIPE) === tabla;
    const valor = extra ? (fila.datos?.[campo] ?? "") : (fila[campo] ?? "");
    if (editando) {
      // TEXTO LARGO (las actividades del día son listas numeradas de varias
      // líneas): va en textarea, donde Enter hace salto de línea. Se guarda al
      // salir del campo o con Ctrl/⌘+Enter. Un input de una línea destruiría
      // el formato con el que el equipo escribe su día.
      if (multilinea) {
        return (
          <textarea
            autoFocus
            rows={Math.min(16, Math.max(4, String(celda.valor || "").split("\n").length + 1))}
            value={celda.valor}
            disabled={celdaSaving}
            onChange={e => setCelda(c => ({ ...c, valor: e.target.value }))}
            onBlur={() => guardarCelda()}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); guardarCelda(); }
              else if (e.key === "Escape") { e.preventDefault(); setCelda(null); }
            }}
            style={{ ...inputStyle, padding: "7px 9px", fontSize: 12.5, lineHeight: 1.5, resize: "vertical", width: "100%" }} />
        );
      }
      return (
        <input
          autoFocus
          type={tipo}
          value={celda.valor}
          disabled={celdaSaving}
          onChange={e => setCelda(c => ({ ...c, valor: e.target.value }))}
          onBlur={() => guardarCelda()}
          onKeyDown={e => {
            // El salto entre celdas es solo del registro de propiedades: en la
            // bitácora las filas son párrafos largos y saltar no tiene sentido.
            const nav = tabla === PIPE;
            if (e.key === "Enter")       { e.preventDefault(); guardarCelda(nav ? celdaVecina(celda, "abajo") : null); }
            else if (e.key === "Tab")    { e.preventDefault(); guardarCelda(nav ? celdaVecina(celda, "derecha") : null); }
            else if (e.key === "Escape") { e.preventDefault(); setCelda(null); }
          }}
          style={{ ...inputStyle, padding: "4px 7px", fontSize: 12.5, width: ancho, minWidth: ancho }} />
      );
    }
    const mostrar = tipo === "date" && valor ? fmtDia(valor) : valor;
    return (
      <button
        onClick={() => setCelda({ id: fila.id, campo, valor: valor || "", extra, tabla })}
        title={multilinea ? "Clic para editar · ⌘/Ctrl+Enter guarda" : "Clic para editar · Enter baja · Tab va a la derecha"}
        style={{
          background: "transparent", border: "none", padding: "2px 0", cursor: "text", textAlign: "left",
          color: mostrar ? (fuerte ? txt : txt2) : txt3,
          fontSize: fuerte ? 12.5 : 12.5, fontWeight: fuerte ? 500 : 400,
          fontFamily: font, minWidth: 34, width: "100%",
          whiteSpace: multilinea ? "pre-wrap" : undefined, lineHeight: multilinea ? 1.55 : undefined,
          ...(clamp ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal", lineHeight: 1.45 } : {}),
        }}>{mostrar || placeholder}</button>
    );
  };

  /* Celda de DESPLEGABLE (Ubicación, Tipo). En su hoja son listas con color, no
     texto libre — si cada quien escribe «Cancún»/«cancun», los filtros mueren.
     La lista se arma con: las opciones base + lo que YA esté usado en los datos
     (para no perder nada) + «Otra…», que abre el campo para escribir una nueva. */
  const celdaCatalogo = (fila, campo, catalogo, usados, ancho = 150) => {
    const editando = celda && celda.id === fila.id && celda.campo === campo && !celda.extra;
    if (editando) return celdaEditable(fila, campo, { ancho, placeholder: "Escribí el valor" });
    const valor = fila[campo] || "";
    const base = catalogo.map(o => o.v);
    const opciones = [...new Set([...base, ...usados])].filter(Boolean);
    const def = catalogo.find(o => o.v.toLowerCase() === String(valor).toLowerCase());
    const hex = def?.c ? def.c[isLight ? "l" : "d"] : null;
    return (
      <select
        value={valor}
        title="Elegí de la lista, o «Otra…» para escribir una nueva"
        onChange={e => {
          if (e.target.value === "__otra__") { setCelda({ id: fila.id, campo, valor: "", extra: false, tabla: PIPE }); return; }
          guardarCampo(PIPE, fila.id, campo, e.target.value);
        }}
        style={{
          appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: "100%",
          padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: font,
          fontSize: 11.5, fontWeight: 600, colorScheme: isLight ? "light" : "dark",
          color: hex || (valor ? txt2 : txt3),
          backgroundColor: hex ? `${hex}1E` : "transparent",
          border: `1px solid ${hex ? `${hex}44` : bd}`,
          ...caret(hex || (valor ? txt2 : txt3), 8),
        }}>
        <option value="">—</option>
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__otra__">Otra…</option>
      </select>
    );
  };

  /* Celda de enlace: si hay URL muestra «Abrir» y un lápiz para cambiarla. */
  const celdaEnlace = (fila, campo, { tabla = PIPE } = {}) => {
    const editando = celda && celda.id === fila.id && celda.campo === campo
      && !celda.extra && (celda.tabla || PIPE) === tabla;
    if (editando) return celdaEditable(fila, campo, { ancho: 190, placeholder: "Pegá el enlace", tabla });
    const url = fila[campo];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        {url
          ? <a href={url} target="_blank" rel="noreferrer" style={{ color: accent, fontSize: 12, textDecoration: "none" }}>Abrir</a>
          : <span style={{ color: txt3, fontSize: 12 }}>—</span>}
        <button onClick={() => setCelda({ id: fila.id, campo, valor: url || "", extra: false, tabla })}
          title={url ? "Cambiar el enlace" : "Poner un enlace"} style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer", color: txt3, fontSize: 11.5, fontFamily: font,
          }}>{url ? "editar" : "+"}</button>
      </span>
    );
  };

  /* ── ESPACIO 1 EN EL TELÉFONO: TARJETAS, no tabla (auditoría móvil 29-jul).
     La tabla de 17 columnas en 390px era inusable (2 columnas visibles y
     scroll infinito). En móvil: una tarjeta por propiedad con lo esencial
     (estatus y empresa editables, fechas, enlaces) y el botón Ficha para
     editar TODO (el modal ya es 1 columna en móvil). ── */
  const pipeCards = () => {
    const pillSel = (c, empty) => ({
      appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: "100%",
      padding: "5px 12px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: font,
      fontSize: 12, fontWeight: 600, colorScheme: isLight ? "light" : "dark",
      color: empty ? txt3 : c, backgroundColor: empty ? "transparent" : `${c}1E`,
      border: `1px solid ${empty ? bd : `${c}44`}`, ...caret(empty ? txt3 : c, 8),
    });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pipeFiltrado.map(p => {
          const col = (ETAPA_HEX[p.etapa] || ETAPA_HEX.seleccionada)[isLight ? "l" : "d"];
          const b = brandById[p.brand_id];
          const bc = brandColor(b);
          const enlaces = [["Crudos", p.crudos_url], ["Video", p.video_url], ["Reel", p.ig_url], ["Story", p.story_url], ["Cine", p.cine_url], ["Ficha", p.ficha_url], ["Info", p.info_url], ["Drive", p.drive_url]].filter(([, u]) => u);
          const meta = [p.fecha_rodaje && `Rodaje ${fmtDia(p.fecha_rodaje)}`, p.fecha_publicacion && `Publica ${fmtDia(p.fecha_publicacion)}`, p.locacion, p.tipo, p.precio].filter(Boolean).join(" · ");
          return (
            <div key={p.id} style={{ ...card, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre || "Sin nombre"}</span>
                <button onClick={() => openFicha(p)} title="Abrir la ficha completa — acá se edita todo" style={{
                  background: "transparent", border: `1px solid ${accent}44`, borderRadius: 9, padding: "6px 11px",
                  cursor: "pointer", color: accent, fontSize: 12, fontFamily: font,
                  display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                }}><Maximize2 size={12} /> Ficha</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={p.etapa} onChange={e => cambiarEtapa(p.id, e.target.value)} style={pillSel(col)}>
                  {ETAPAS.map(x => <option key={x.id} value={x.id}>{x.l}</option>)}
                </select>
                <select value={p.brand_id || ""} onChange={e => cambiarEmpresa(p.id, e.target.value)} style={pillSel(b ? bc : txt3, !b)}>
                  <option value="">— empresa —</option>
                  {brands.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
              </div>
              {meta && <div style={{ fontSize: 12, color: txt3, lineHeight: 1.5 }}>{meta}</div>}
              {p.notas && <div style={{ fontSize: 12, color: txt2, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.notas}</div>}
              {enlaces.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {enlaces.map(([l, u]) => (
                    <a key={l} href={u} target="_blank" rel="noreferrer" style={{
                      fontSize: 12, color: accent, textDecoration: "none", borderRadius: 99,
                      border: `1px solid ${accent}33`, background: `${accent}0E`, padding: "4px 11px",
                    }}>{l}</a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {pipeFiltrado.length === 0 && emptyRow(pipeline.length === 0 ? "Todavía no hay propiedades cargadas." : "Ninguna propiedad coincide con ese filtro.")}
        <div style={{ ...card, borderRadius: 14, padding: "10px 12px" }}>
          <input value={filaNueva} disabled={filaNuevaSaving} onChange={e => setFilaNueva(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); crearDesdeTabla(); } }}
            onBlur={() => { if (filaNueva.trim()) crearDesdeTabla(); }}
            placeholder={filaNuevaSaving ? "Agregando…" : "+ Agregar propiedad… (Enter)"}
            style={{ ...inputStyle, border: `1px dashed ${bd}`, background: "transparent" }} />
        </div>
      </div>
    );
  };

  const pipelineTabla = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* UNA SOLA BARRA. Iván: «son muchos botones, ellos quieren que todo sea
          más simple; ahí no se necesita nada de lo que está: solamente buscar
          propiedad, y una parte de agregar». Los cinco desplegables (año,
          estatus, empresa, ubicación, tipo) se fueron: el buscador ahora mira
          TODOS esos campos, así que escribir «Tulum», «2025», «Publicada» o
          «Depto» filtra igual — un control en vez de seis, y no hay que
          aprenderse cuál usa cada cosa.
          «Columnas» y «Columna nueva» quedan SOLO para administración: son
          para armar la hoja, no para el día a día de quien la llena. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "1 1 320px", maxWidth: isMobile ? "none" : 420 }}>
          <Search size={14} color={txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={pipeFiltro.q} onChange={e => setPipeFiltro(f => ({ ...f, q: e.target.value }))}
            placeholder="Buscar propiedad, ubicación, estatus, año…"
            style={{ ...inputStyle, paddingLeft: 34, paddingRight: pipeFiltro.q ? 32 : 12, minHeight: 38 }} />
          {pipeFiltro.q && (
            <button onClick={() => setPipeFiltro(f => ({ ...f, q: "" }))} title="Limpiar" style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer", color: txt3, display: "inline-flex", padding: 2,
            }}><X size={13} /></button>
          )}
        </div>

        {/* Agregar una propiedad abre LA MISMA ficha con la que se edita: todos
            los campos de la hoja, agrupados. Con poner el nombre alcanza; el
            resto se completa acá o después, en la tabla. */}
        <button onClick={() => openFicha(null)} style={{
          minHeight: 38, padding: "0 16px", borderRadius: 10, cursor: "pointer", fontFamily: font,
          fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
          background: `${accent}18`, border: `1px solid ${accent}55`, color: accent,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}><Plus size={14} /> Agregar propiedad</button>

        {/* Solo administración: armar la hoja (qué columnas se ven, columnas propias). */}
        {isAdmin && !isMobile && (
          <>
            <button onClick={() => { setShowCols(s => !s); setColForm(null); }} title="Elegir qué columnas ver" style={{
              minHeight: 38, padding: "0 13px", borderRadius: 10, cursor: "pointer", fontFamily: font, fontSize: 12.5,
              background: showCols ? `${accent}14` : "transparent", border: `1px solid ${bd}`, color: txt2,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><SlidersHorizontal size={13} /> Columnas{colsOcultas.size > 0 ? ` (${colsOcultas.size})` : ""}</button>
            <button onClick={() => { setColForm(c => c ? null : { nombre: "", tipo: "texto" }); setShowCols(false); }}
              title="Agregar una columna propia a la hoja" style={{
              minHeight: 38, padding: "0 13px", borderRadius: 10, cursor: "pointer", fontFamily: font, fontSize: 12.5,
              background: "transparent", border: `1px solid ${bd}`, color: txt2,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><Plus size={13} /> Columna nueva</button>
          </>
        )}
        <span style={{ fontSize: 12, color: celdaSaving ? accent : txt3, marginLeft: "auto", whiteSpace: "nowrap" }}>
          {celdaSaving ? "Guardando…" : `${pipeFiltrado.length} de ${pipeline.length}`}
        </span>
      </div>

      {/* Elegir qué columnas ver. Es preferencia de cada quien: se guarda en su
          navegador y no le cambia la tabla a nadie más del equipo. */}
      {showCols && (
        <div style={{ ...card, borderRadius: 12, padding: 12, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: txt3, marginRight: 4 }}>Se ven:</span>
          {COLS_REGISTRO.map(c => {
            const visible = c.fija || !colsOcultas.has(c.key);
            return (
              <button key={c.key} onClick={() => { if (!c.fija) toggleCol(c.key); }}
                title={c.fija ? "Esta siempre se ve" : visible ? "Ocultarla" : "Mostrarla"}
                style={{
                  padding: "5px 11px", borderRadius: 999, fontFamily: font, fontSize: 12,
                  cursor: c.fija ? "default" : "pointer",
                  border: `1px solid ${visible ? `${accent}55` : bd}`,
                  background: visible ? `${accent}16` : "transparent",
                  color: visible ? accent : txt3, opacity: c.fija ? 0.7 : 1,
                }}>{c.l}</button>
            );
          })}
          <button onClick={() => { setColsOcultas(new Set()); try { if (colsKey) localStorage.setItem(colsKey, "[]"); } catch (_) {} }}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: txt3, fontSize: 12, fontFamily: font, marginLeft: "auto" }}>
            Ver todas
          </button>
        </div>
      )}

      {colForm && (
        <div style={{ ...card, borderRadius: 12, padding: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: 11.5, color: txt3 }}>Nombre de la columna</span>
            <input autoFocus value={colForm.nombre} onChange={e => setColForm(c => ({ ...c, nombre: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") crearColumna(); }}
              placeholder="Voz en off · Responsable · Campaña…" style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11.5, color: txt3 }}>Qué guarda</span>
            <select value={colForm.tipo} onChange={e => setColForm(c => ({ ...c, tipo: e.target.value }))} style={{ ...selStyle, width: "auto" }}>
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
              <option value="fecha">Fecha</option>
              <option value="enlace">Enlace</option>
            </select>
          </label>
          <button onClick={crearColumna} disabled={!String(colForm.nombre || "").trim()} style={{
            padding: "9px 16px", borderRadius: 9, fontFamily: font, fontSize: 12.5, fontWeight: 600,
            cursor: "pointer", background: `${accent}18`, border: `1px solid ${accent}55`, color: accent,
            opacity: String(colForm.nombre || "").trim() ? 1 : 0.55,
          }}>Agregar</button>
          <button onClick={() => setColForm(null)} style={{
            background: "transparent", border: "none", cursor: "pointer", color: txt3, fontSize: 12.5, fontFamily: font, padding: "9px 4px",
          }}>Cancelar</button>
        </div>
      )}

      {isMobile && pipeCards()}
      {!isMobile && <div style={hoja.wrap}>
        <table className="mkt-hoja" style={hoja.table}>
          <thead>
            <tr>
              {colsVista.map((c, i) => (
                <th key={c.extra ? `x-${c.key}` : c.key}
                  style={i === 0
                    ? { ...hoja.th, ...hoja.congelada, top: 0, zIndex: 4, background: isLight ? "#EEF2F7" : "#141A24" }
                    : hoja.th}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {c.l}
                    {c.extra && (
                      <button onClick={() => archivarColumna(c.propia)} title="Quitar esta columna (lo escrito se conserva)" style={{
                        background: "transparent", border: "none", padding: 0, cursor: "pointer", color: txt3, display: "inline-flex",
                      }}><X size={11} /></button>
                    )}
                  </span>
                </th>
              ))}
              <th style={{ ...hoja.th, width: 34 }} aria-label="Quitar" />
            </tr>
          </thead>
          <tbody>
            {pipeFiltrado.map(p => {
              const col = (ETAPA_HEX[p.etapa] || ETAPA_HEX.seleccionada)[isLight ? "l" : "d"];
              return (
                <tr key={p.id}>
                  {colsVista.map((c, i) => {
                    const base = i === 0 ? { ...hoja.td, ...hoja.congelada, zIndex: 2 } : hoja.td;
                    if (c.tipo === "nombre") return (
                      // El nombre se edita como cualquier celda; la ficha completa
                      // se abre con el icono de al lado (antes el clic hacía las dos
                      // cosas a la vez y no se podía corregir un nombre mal escrito).
                      <td key={c.key} style={{ ...base, minWidth: c.ancho }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {celdaEditable(p, "nombre", { ancho: c.ancho - 30, fuerte: true, placeholder: "Sin nombre" })}
                          </span>
                          <button onClick={() => openFicha(p)} title="Abrir la ficha completa" style={{
                            background: "transparent", border: "none", padding: 0, cursor: "pointer",
                            color: txt3, display: "inline-flex", flexShrink: 0,
                          }}><Maximize2 size={11} /></button>
                        </span>
                      </td>
                    );
                    if (c.tipo === "etapa") return (
                      // Cambiar el estatus es lo que más se hace: va siempre listo,
                      // con su color, sin tener que entrar a ningún lado.
                      <td key={c.key} style={base}>
                        <select value={p.etapa} onChange={e => cambiarEtapa(p.id, e.target.value)} title="Cambiar el estatus" style={{
                          appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: "100%",
                          padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: font,
                          fontSize: 11.5, fontWeight: 600, color: col, backgroundColor: `${col}1E`, border: `1px solid ${col}44`,
                          colorScheme: isLight ? "light" : "dark",
                          ...caret(col, 8),
                        }}>
                          {ETAPAS.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
                        </select>
                      </td>
                    );
                    if (c.tipo === "marca") {
                      const b = brandById[p.brand_id];
                      const bc = brandColor(b);
                      return (
                        <td key={c.key} style={base}>
                          <select value={p.brand_id || ""} onChange={e => cambiarEmpresa(p.id, e.target.value)} title="¿De qué empresa es?" style={{
                            appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: "100%",
                            padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: font,
                            fontSize: 11.5, fontWeight: 600,
                            color: b ? bc : txt3, backgroundColor: b ? `${bc}1E` : "transparent",
                            border: `1px solid ${b ? `${bc}44` : bd}`, colorScheme: isLight ? "light" : "dark",
                            ...caret(b ? bc : txt3, 8),
                          }}>
                            <option value="">— empresa —</option>
                            {brands.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                          </select>
                        </td>
                      );
                    }
                    if (c.tipo === "catalogo") return (
                      <td key={c.key} style={base}>
                        {celdaCatalogo(p, c.key, c.cat, c.key === "locacion" ? locaciones : tipos, c.ancho)}
                      </td>
                    );
                    if (c.tipo === "enlace" && !c.extra) return <td key={c.key} style={base}>{celdaEnlace(p, c.key)}</td>;
                    return (
                      <td key={c.extra ? `x-${c.key}` : c.key} style={{
                        ...base, whiteSpace: c.key === "notas" ? "normal" : "nowrap",
                        /* Notas: SIN mínimo, la tabla apretada la dejaba de ~60px y 95
                           caracteres se partían en ~10 renglones → la fila entera se
                           estiraba (el «hueco» bajo Casa 392 que vio Iván, 29-jul). */
                        ...(c.key === "notas" ? { minWidth: 220, maxWidth: 340 } : {}),
                      }}>
                        {celdaEditable(p, c.key, {
                          extra: !!c.extra, tipo: c.tipo === "enlace" ? "text" : c.tipo,
                          ancho: c.ancho || 130, placeholder: c.ph || "—",
                          clamp: c.key === "notas",
                        })}
                      </td>
                    );
                  })}
                  <td style={{ ...hoja.td, textAlign: "right" }}>
                    {archivarId === p.id ? (
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
                        <button onClick={() => archivarPropiedad(p.id)} style={{
                          background: "transparent", border: "none", cursor: "pointer", color: RED, fontSize: 12, fontFamily: font, padding: 0,
                        }}>Quitar</button>
                        <button onClick={() => setArchivarId(null)} style={{
                          background: "transparent", border: "none", cursor: "pointer", color: txt3, fontSize: 12, fontFamily: font, padding: 0,
                        }}>No</button>
                      </span>
                    ) : (
                      <button onClick={() => setArchivarId(p.id)} title="Sacar esta propiedad de la tabla (no se borra)" style={{
                        background: "transparent", border: "none", padding: 0, cursor: "pointer", color: txt3, display: "inline-flex",
                      }}><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Última fila: se escribe el nombre, Enter, y la propiedad ya existe.
                Como en la hoja — sin abrir ningún formulario. */}
            <tr>
              <td style={{ ...hoja.td, ...hoja.congelada, zIndex: 2 }}>
                <input
                  value={filaNueva}
                  disabled={filaNuevaSaving}
                  onChange={e => setFilaNueva(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); crearDesdeTabla(); } }}
                  onBlur={() => { if (filaNueva.trim()) crearDesdeTabla(); }}
                  placeholder="+ Agregar propiedad…"
                  style={{ ...inputStyle, padding: "5px 8px", fontSize: 12.5, border: `1px dashed ${bd}`, background: "transparent" }} />
              </td>
              <td colSpan={colsVista.length} style={{ ...hoja.td, color: txt3, fontSize: 12 }}>
                {filaNuevaSaving ? "Agregando…" : "Escribí el nombre y presioná Enter — el resto se llena después, en la misma tabla."}
              </td>
            </tr>

            {pipeFiltrado.length === 0 && (
              <tr><td colSpan={colsVista.length + 1} style={{ ...hoja.td, textAlign: "center", color: txt3, padding: "18px 0" }}>
                {pipeline.length === 0
                  ? "Todavía no hay propiedades cargadas."
                  : "Ninguna propiedad coincide con ese filtro."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>}
      {!isMobile && <div style={{ fontSize: 11.5, color: txt3, lineHeight: 1.6 }}>
        Toca cualquier celda para escribir · <b style={{ color: txt2 }}>Enter</b> baja a la de abajo ·{" "}
        <b style={{ color: txt2 }}>Tab</b> pasa a la de al lado · <b style={{ color: txt2 }}>Escape</b> cancela.
        El estatus y la empresa se cambian con su desplegable. «Columnas» esconde las que no uses y
        «Columna nueva» agrega las tuyas. El icono ⤢ abre la ficha completa de la propiedad.
      </div>}
    </div>
  );


  /* ── HOJA 2: el registro de actividades (el morado) ── */
  const [repFiltro, setRepFiltro] = useState({ q: "", persona: "", fecha: "" });

  const bitacoraFiltrada = useMemo(() => {
    const q = repFiltro.q.trim().toLowerCase();
    return bitacora.filter(r =>
      (!q || String(r.texto || "").toLowerCase().includes(q)) &&
      (!repFiltro.persona || r.profile_id === repFiltro.persona) &&
      (!repFiltro.fecha   || r.fecha === repFiltro.fecha)
    );
  }, [bitacora, repFiltro]);

  /* El «Puesto/Área» es un campo del formulario, no algo que se deduzca del rol.
     Quienes reportan son de TRES áreas — Marketing (Yazmin, Luis, Emmanuel S.),
     Gerencia de Ventas (Emmanuel Ortiz) y Postventa (Carolina Curiel) — y
     deducirlo del rol los mandaba a todos a «Administración». Si la fila ya
     trae su área, manda esa; si no, se deduce como antes. */
  const puestoDe = useCallback((r) => {
    if (r?.area) return r.area;
    const rol = people.find(p => p.id === (r?.profile_id ?? r))?.role;
    return rol === "marketing" ? "Marketing"
      : rol === "asesor" ? "Ventas"
      : rol === "director" ? "Dirección"
      : rol ? "Administración" : "—";
  }, [people]);

  /* ── ESPACIO 2 EN EL TELÉFONO: tarjetas (la tabla dejaba las actividades
     —lo único que importa— fuera de la pantalla). Mismo poder que la tabla:
     empresa editable, texto con «ver todo» y editar, tiempo y evidencia. ── */
  const bitaCards = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {bitacoraFiltrada.map(r => {
        const mio = r.profile_id === user?.id;
        const edit = mio || isAdmin;
        const editandoTexto = celda && celda.id === r.id && celda.campo === "texto" && (celda.tabla || PIPE) === BITA;
        const bcol = r.brand_id ? brandColor(brandById[r.brand_id]) : null;
        const tiempo = r.tiempo_texto || tiempoDelTexto(r.texto);
        return (
          <div key={r.id} style={{ ...card, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: txt }}>{nameOf(r.profile_id)}</span>
              <span style={{ fontSize: 11.5, color: txt3 }}>{puestoDe(r)}</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(r.fecha)} · {fmtHora(r.created_at)}</span>
            </div>
            {edit ? (
              <select value={r.brand_id || ""} title="¿De qué empresa?"
                onChange={e => guardarCampo(BITA, r.id, "brand_id", e.target.value)}
                style={{
                  alignSelf: "flex-start", appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                  padding: "3px 10px", borderRadius: 999, fontFamily: font, fontSize: 11.5, fontWeight: 600,
                  colorScheme: isLight ? "light" : "dark", color: bcol || txt3,
                  backgroundColor: bcol ? `${bcol}1E` : "transparent",
                  border: `1px solid ${bcol ? `${bcol}44` : bd}`, ...caret(bcol || txt3, 8),
                }}>
                <option value="">— empresa —</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            ) : (bcol && (
              <span style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: bcol, background: `${bcol}1E`, border: `1px solid ${bcol}44` }}>
                {brandById[r.brand_id]?.nombre}
              </span>
            ))}
            {editandoTexto
              ? celdaEditable(r, "texto", { tabla: BITA, multilinea: true })
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {reporteTexto(r)}
                  {edit && (
                    <button onClick={() => setCelda({ id: r.id, campo: "texto", valor: r.texto || "", extra: false, tabla: BITA })}
                      style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: txt3, fontSize: 11.5, fontFamily: font }}>editar</button>
                  )}
                </div>
              )}
            <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 11.5, color: txt3, flexWrap: "wrap" }}>
              <span>Tiempo · {tiempo || "—"}</span>
              {r.evidencia_url && <a href={r.evidencia_url} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: "none" }}>Evidencia →</a>}
            </div>
          </div>
        );
      })}
      {bitacoraFiltrada.length === 0 && emptyRow(bitacora.length === 0
        ? "Todavía no hay reportes. En cuanto alguien cuente su día, aparece acá."
        : "Ningún reporte coincide con ese filtro.")}
    </div>
  );

  const reporteTabla = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "0 0 240px" }}>
          <Search size={13} color={txt3} style={{ position: "absolute", left: 10, top: 12 }} />
          <input value={repFiltro.q} onChange={e => setRepFiltro(f => ({ ...f, q: e.target.value }))}
            placeholder="Buscar en las actividades…" style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <select value={repFiltro.persona} onChange={e => setRepFiltro(f => ({ ...f, persona: e.target.value }))} style={{ ...selStyle, width: "auto", minWidth: 150 }}>
          <option value="">Todo el equipo</option>
          {assignees.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input type="date" value={repFiltro.fecha} onChange={e => setRepFiltro(f => ({ ...f, fecha: e.target.value }))}
          title="Filtrar por día" style={{ ...inputStyle, width: "auto" }} />
        {(repFiltro.q || repFiltro.persona || repFiltro.fecha) && (
          <button onClick={() => setRepFiltro({ q: "", persona: "", fecha: "" })} style={{
            background: "transparent", border: "none", cursor: "pointer", color: txt3, fontSize: 12, fontFamily: font,
          }}>Limpiar</button>
        )}
        <span style={{ fontSize: 12, color: txt3, marginLeft: "auto", whiteSpace: "nowrap" }}>
          {bitacoraFiltrada.length} de {bitacora.length}
        </span>
      </div>

      {isMobile && bitaCards()}
      {!isMobile && <div style={hoja.wrap}>
        <table className="mkt-hoja" style={{ ...hoja.table, minWidth: 900 }}>
          <thead>
            <tr>
              {["Fecha", "Nombre", "Puesto / Área", "Empresa", "Actividades realizadas", "Tiempo", "Evidencia"]
                .map(h => <th key={h} style={hoja.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {bitacoraFiltrada.map(r => {
              // Quién puede corregir un reporte: su AUTOR (para arreglar lo suyo)
              // y el líder. Nadie más edita el día de otro. El nombre y el área
              // NO se editan: salen del perfil de la persona, no se escriben acá.
              const mio  = r.profile_id === user?.id;
              const edit = mio || isAdmin;
              const editandoTexto = celda && celda.id === r.id && celda.campo === "texto" && (celda.tabla || PIPE) === BITA;
              return (
                <tr key={r.id}>
                  <td style={{ ...hoja.td, whiteSpace: "nowrap" }}>
                    {edit
                      ? celdaEditable(r, "fecha", { tipo: "date", ancho: 130, tabla: BITA })
                      : fmtDia(r.fecha)}
                    <div style={{ fontSize: 11, color: txt3 }} title="Cuándo se registró">{fmtHora(r.created_at)}</div>
                  </td>
                  <td style={{ ...hoja.td, whiteSpace: "nowrap", color: txt }}>{nameOf(r.profile_id)}</td>
                  <td style={{ ...hoja.td, whiteSpace: "nowrap" }}>{puestoDe(r)}</td>
                  <td style={{ ...hoja.td, whiteSpace: "nowrap" }}>
                    {edit ? (
                      <select value={r.brand_id || ""} title="¿De qué empresa?"
                        onChange={e => guardarCampo(BITA, r.id, "brand_id", e.target.value)}
                        style={{
                          appearance: "none", WebkitAppearance: "none", cursor: "pointer", maxWidth: "100%",
                          padding: "3px 10px", borderRadius: 999, fontFamily: font, fontSize: 11.5, fontWeight: 600,
                          colorScheme: isLight ? "light" : "dark",
                          color: r.brand_id ? brandColor(brandById[r.brand_id]) : txt3,
                          backgroundColor: r.brand_id ? `${brandColor(brandById[r.brand_id])}1E` : "transparent",
                          border: `1px solid ${r.brand_id ? `${brandColor(brandById[r.brand_id])}44` : bd}`,
                          ...caret(r.brand_id ? brandColor(brandById[r.brand_id]) : txt3, 8),
                        }}>
                        <option value="">— empresa —</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                      </select>
                    ) : (r.brand_id ? (brandById[r.brand_id]?.nombre || "—") : "—")}
                  </td>
                  <td style={{ ...hoja.td, minWidth: 330, maxWidth: 520 }}>
                    {editandoTexto
                      ? celdaEditable(r, "texto", { tabla: BITA, multilinea: true })
                      : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {reporteTexto(r)}
                          {edit && (
                            <button onClick={() => setCelda({ id: r.id, campo: "texto", valor: r.texto || "", extra: false, tabla: BITA })}
                              title="Corregir lo que escribiste" style={{
                                alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                                cursor: "pointer", color: txt3, fontSize: 11.5, fontFamily: font,
                              }}>editar</button>
                          )}
                        </div>
                      )}
                  </td>
                  <td style={{ ...hoja.td, whiteSpace: "nowrap" }}>
                    {/* Si nadie lo escribió, se muestra el que se leyó del texto
                        —en cursiva, para que se note que es deducido—. Al tocarlo
                        se puede fijar a mano y deja de deducirse. */}
                    {edit
                      ? celdaEditable(r, "tiempo_texto", {
                          ancho: 110, tabla: BITA,
                          placeholder: tiempoDelTexto(r.texto) || "—",
                        })
                      : (r.tiempo_texto || tiempoDelTexto(r.texto) || "—")}
                    {edit && !r.tiempo_texto && tiempoDelTexto(r.texto) && (
                      <div style={{ fontSize: 10.5, color: txt3, fontStyle: "italic" }} title="Tomado de lo que escribió — no se lo pedimos aparte">
                        del texto
                      </div>
                    )}
                  </td>
                  <td style={hoja.td}>
                    {edit ? celdaEnlace(r, "evidencia_url", { tabla: BITA }) : linkCel(r.evidencia_url, "Abrir")}
                  </td>
                </tr>
              );
            })}
            {bitacoraFiltrada.length === 0 && (
              <tr><td colSpan={7} style={{ ...hoja.td, textAlign: "center", color: txt3, padding: "18px 0" }}>
                {bitacora.length === 0
                  ? "Todavía no hay reportes. En cuanto alguien cuente su día, aparece acá."
                  : "Ningún reporte coincide con ese filtro."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>}
      {!isMobile && <div style={{ fontSize: 11.5, color: txt3, lineHeight: 1.6 }}>
        Cada quien puede corregir sus propios reportes{isAdmin ? " (y vos, los de todo el equipo)" : ""} —
        toca la fecha, la empresa, el tiempo o «editar» debajo del texto.
        En el texto largo, <b style={{ color: txt2 }}>Enter</b> hace salto de línea y{" "}
        <b style={{ color: txt2 }}>⌘/Ctrl+Enter</b> guarda. El <b style={{ color: txt2 }}>nombre</b> y el{" "}
        <b style={{ color: txt2 }}>área</b> salen del perfil de cada persona, no se escriben acá.
      </div>}
    </div>
  );

  const pipelineTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Tablero para OPERAR (mover etapas) · Tabla para MIRAR (la hoja de Alex,
            con sus filtros). Conviven: cada una sirve para algo distinto. */}
        {SHOW_VISTA_TABLA ? (
        <div style={{ display: "flex", gap: 3, padding: 4, borderRadius: 12, border: `1px solid ${bd}`,
          background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)" }}>
          {[["tabla", "Tabla"], ["tablero", "Tablero"]].map(([id, l]) => (
            <button key={id} onClick={() => elegirVista(id)} style={{
              padding: "5px 13px", borderRadius: 9, cursor: "pointer", fontFamily: font, fontSize: 12.5,
              fontWeight: pipeVista === id ? 600 : 500, border: "none",
              background: pipeVista === id ? (isLight ? "#FFFFFF" : "rgba(255,255,255,0.09)") : "transparent",
              color: pipeVista === id ? txt : txt3,
            }}>{l}</button>
          ))}
        </div>
        ) : <span />}{/* sin toggle: solo Tablero (la hoja vive en Espacio 1) */}
        <button onClick={() => setShowPipeForm(s => !s)} style={{
          background: showPipeForm ? "transparent" : `${accent}1A`, border: `1px solid ${accent}55`,
          borderRadius: 10, padding: "9px 15px", cursor: "pointer", color: accent,
          fontSize: 12.5, fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center", gap: 6,
        }}>{showPipeForm ? <X size={14} /> : <Plus size={14} />} {showPipeForm ? "Cerrar" : "Propiedad"}</button>
      </div>
      {showPipeForm && (
        <div style={{ ...card, padding: 14, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8 }}>
          <input autoFocus placeholder="Propiedad *" value={pipeForm.nombre} onChange={e => setPipeForm(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
          <input placeholder="Locación (Tulum, Playa…)" value={pipeForm.locacion} onChange={e => setPipeForm(f => ({ ...f, locacion: e.target.value }))} style={inputStyle} />
          <select value={pipeForm.brand} onChange={e => setPipeForm(f => ({ ...f, brand: e.target.value }))} style={selStyle}>
            <option value="">Marca (Duke)</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <select value={pipeForm.etapa} onChange={e => setPipeForm(f => ({ ...f, etapa: e.target.value }))} style={selStyle}>
            {ETAPAS.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
          </select>
          <input type="date" title="Fecha de rodaje" value={pipeForm.rodaje} onChange={e => setPipeForm(f => ({ ...f, rodaje: e.target.value }))} style={inputStyle} />
          <input placeholder="Link Drive" value={pipeForm.drive} onChange={e => setPipeForm(f => ({ ...f, drive: e.target.value }))} style={inputStyle} />
          <input placeholder="Link Instagram" value={pipeForm.ig} onChange={e => setPipeForm(f => ({ ...f, ig: e.target.value }))} style={inputStyle} />
          <button onClick={createPipeline} disabled={saving || !pipeForm.nombre.trim()} style={{
            background: accent, border: `1px solid ${accent}`, borderRadius: 10, padding: "9px 14px",
            cursor: "pointer", color: isLight ? "#FFFFFF" : "#04140F", fontSize: 12.5, fontWeight: 600, fontFamily: font,
            opacity: saving || !pipeForm.nombre.trim() ? 0.6 : 1,
          }}>Agregar</button>
        </div>
      )}
      {pipeVista === "tabla" && pipelineTabla()}
      {pipeVista === "tablero" && (
      <div style={{ display: "flex", gap: isMobile ? 10 : 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start", WebkitOverflowScrolling: "touch", scrollSnapType: isMobile ? "x mandatory" : undefined }}>
        {ETAPAS.map((col, colIdx) => {
          const items = pipeline.filter(p => p.etapa === col.id);
          // Se marcan en rojo los dos atascos que le duelen al equipo: lo que
          // espera voz en off (el cuello viejo) y lo que volvió con CAMBIOS
          // (retrabajo — es trabajo que ya se había hecho y hay que rehacer).
          const isCuello = (col.id === "esperando_voz" || col.id === "cambios") && items.length >= 3;
          return (
            <div key={col.id}
              onDragOver={e => { if (dragId) e.preventDefault(); }}
              onDrop={() => { const it = pipeline.find(p => p.id === dragId); if (it) moveStage(it, col.id); setDragId(null); }}
              style={{
                // Móvil: columna ancha con snap. Web: las 7 columnas LLENAN el ancho de forma
                // pareja (flex) — sin ancho fijo que dejaba margen feo a la derecha; se estrechan
                // con scroll horizontal solo si la pantalla es muy angosta (minWidth 200).
                ...(isMobile
                  ? { minWidth: "82vw", width: "82vw", maxWidth: 300, flexShrink: 0, scrollSnapAlign: "start" }
                  : { flex: "1 1 0", minWidth: 200 }),
                borderRadius: 14, padding: 10,
                background: isCuello
                  ? (isLight ? "rgba(225,29,72,0.05)" : "rgba(248,113,113,0.06)")
                  : (isLight ? "rgba(15,23,42,0.028)" : "rgba(255,255,255,0.022)"),
                border: `1px solid ${isCuello ? `${RED}55` : bd}`,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px" }}>
                {col.id === "esperando_voz" && <Mic size={13} color={isCuello ? RED : txt2} />}
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: isCuello ? RED : txt2, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.l}</span>
                <span style={{
                  minWidth: 20, height: 20, borderRadius: 999, padding: "0 5px",
                  background: isCuello ? RED : (isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.08)"),
                  color: isCuello ? "#fff" : txt2, fontSize: 12, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{items.length}</span>
              </div>
              {/* Lista de tarjetas con scroll interno: una columna llena (LISTA) ya no alarga todo el tablero */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? "none" : "calc(100vh - 340px)", paddingRight: 1 }}>
              {items.map(it => {
                const c = brandColor(brandById[it.brand_id]);
                return (
                  <div key={it.id}
                    draggable={!isMobile}
                    onDragStart={() => setDragId(it.id)}
                    onDragEnd={() => setDragId(null)}
                    style={{
                      ...card, borderRadius: 12, padding: "10px 11px",
                      cursor: isMobile ? "default" : "grab",
                      opacity: dragId === it.id ? 0.45 : 1,
                      display: "flex", flexDirection: "column", gap: 6,
                    }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: c, marginTop: 5, flexShrink: 0 }} />
                      {/* El nombre abre la ficha: es el renglón de la hoja de cálculo,
                          con precio, tipo, fechas y todos los enlaces. */}
                      <button onClick={() => openFicha(it)} title="Abrir la ficha de la propiedad" style={{
                        flex: 1, textAlign: "left", background: "transparent", border: "none", padding: 0,
                        cursor: "pointer", fontSize: 12.5, color: txt, fontWeight: 500, lineHeight: 1.3, fontFamily: font,
                      }}>{it.nombre}</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {it.locacion && <span style={{ fontSize: 11.5, color: txt2, padding: "2px 8px", borderRadius: 999, background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)", border: `1px solid ${bd}` }}>{it.locacion}</span>}
                      {it.precio && <span style={{ fontSize: 11.5, color: txt2 }}>{it.precio}</span>}
                      {it.tipo && <span style={{ fontSize: 11.5, color: txt3 }}>{it.tipo}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {it.fecha_rodaje && (
                        <span style={{ fontSize: 11.5, color: it.fecha_rodaje === hoy ? accent : txt3, display: "inline-flex", alignItems: "center", gap: 3 }} title="Fecha de rodaje">
                          <CalendarDays size={10} /> {fmtDia(it.fecha_rodaje)}
                        </span>
                      )}
                      {it.fecha_publicacion && (
                        <span style={{ fontSize: 11.5, color: txt3, display: "inline-flex", alignItems: "center", gap: 3 }} title="Fecha de publicación">
                          <ExternalLink size={10} /> {fmtDia(it.fecha_publicacion)}
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      {/* Los enlaces del registro, cada uno con su ícono. Se muestran
                          solo los que existen: una tarjeta a medio llenar no se ve rota. */}
                      {it.crudos_url && <a href={it.crudos_url} target="_blank" rel="noreferrer" title="Carpeta de crudos" style={{ color: txt3, display: "flex" }}><Folder size={13} /></a>}
                      {it.video_url  && <a href={it.video_url}  target="_blank" rel="noreferrer" title="Video editado" style={{ color: txt3, display: "flex" }}><Clapperboard size={13} /></a>}
                      {it.ficha_url  && <a href={it.ficha_url}  target="_blank" rel="noreferrer" title="Ficha técnica" style={{ color: txt3, display: "flex" }}><Search size={13} /></a>}
                      {it.drive_url  && <a href={it.drive_url}  target="_blank" rel="noreferrer" title="Drive" style={{ color: txt3, display: "flex" }}><Layers size={13} /></a>}
                      {it.ig_url     && <a href={it.ig_url}     target="_blank" rel="noreferrer" title="Ver publicación" style={{ color: txt3, display: "flex" }}><ExternalLink size={13} /></a>}
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button disabled={colIdx === 0} onClick={() => moveStage(it, -1)} title="Etapa anterior" style={{
                        flex: 1, padding: "4px 0", borderRadius: 8, cursor: colIdx === 0 ? "default" : "pointer",
                        background: "transparent", border: `1px solid ${bd}`, color: colIdx === 0 ? txt3 : txt2,
                        opacity: colIdx === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                      }}><ChevronLeft size={13} /></button>
                      <button disabled={colIdx === ETAPAS.length - 1} onClick={() => moveStage(it, +1)} title="Siguiente etapa" style={{
                        flex: 1, padding: "4px 0", borderRadius: 8, cursor: colIdx === ETAPAS.length - 1 ? "default" : "pointer",
                        background: `${accent}12`, border: `1px solid ${accent}40`, color: accent,
                        opacity: colIdx === ETAPAS.length - 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                      }}><ChevronRight size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div style={{ fontSize: 12, color: txt3, textAlign: "center", padding: "14px 0" }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );

  /* ════════════════════ TAB: SOLICITUDES ════════════════════ */

  const [showReqForm, setShowReqForm] = useState(false);
  const [reqForm, setReqForm] = useState({ titulo: "", brand: "", complejidad: "A", entrega: "", assignee: "", detalle: "", objetivo: "", ref: "" });
  const [reqSearch, setReqSearch] = useState("");

  const createRequest = async () => {
    if (!reqForm.titulo.trim()) return;
    setSaving(true);
    const { error: e } = await supabase.from("mkt_requests").insert({
      organization_id: orgId, brand_id: reqForm.brand || null,
      titulo: reqForm.titulo.trim(), detalle: reqForm.detalle.trim() || null,
      objetivo: reqForm.objetivo.trim() || null, complejidad: reqForm.complejidad,
      fecha_entrega: reqForm.entrega || null, assignee_id: reqForm.assignee || null,
      ref_image_url: reqForm.ref.trim() || null, solicitante: user?.id || null,
    });
    setSaving(false);
    if (e) { setError("No se pudo crear la solicitud."); return; }
    setReqForm({ titulo: "", brand: "", complejidad: "A", entrega: "", assignee: "", detalle: "", objetivo: "", ref: "" });
    setShowReqForm(false);
    load();
  };

  const cplxBadge = (c) => {
    const color = c === "AAA" ? AMBER : c === "AA" ? (isLight ? "#B45309" : "#FCD34D") : txt2;
    return (
      <span style={{ padding: "2px 9px", borderRadius: 7, fontSize: 11.5, fontWeight: 800, fontFamily: font, color, border: `1px solid ${color}55`, background: `${c === "A" ? "transparent" : color + "14"}` }}>{c}</span>
    );
  };

  /* Orden de PRIORIDAD (arrastrable): las priorizadas van por su `orden` (1 =
     más urgente); las recién llegadas (orden null) arriba de todo, la más
     nueva primero, para que ningún pedido nuevo pase desapercibido. */
  const reqPrio = useCallback((a, b) => {
    const ao = a.orden ?? null, bo = b.orden ?? null;
    if (ao == null && bo == null) return new Date(b.created_at) - new Date(a.created_at);
    if (ao == null) return -1;
    if (bo == null) return 1;
    return ao - bo;
  }, []);

  const filteredReqs = useMemo(() => requests.filter(r => {
    if (!reqSearch) return true;
    const q = reqSearch.toLowerCase();
    return [r.titulo, r.detalle, r.objetivo, brandById[r.brand_id]?.nombre, nameOf(r.solicitante), nameOf(r.assignee_id)]
      .some(s => String(s || "").toLowerCase().includes(q));
  }).sort(reqPrio), [requests, reqSearch, brandById, nameOf, reqPrio]);

  /* ── Arrastrar para priorizar (mouse Y dedo, sin librerías) ──────────────
     Se agarra del mango ⋮⋮; mientras se mueve, la lista se reacomoda en vivo;
     al soltar, el nuevo orden (1..n) se guarda para TODA la org. Con búsqueda
     activa el mango se esconde: reordenar media lista sería ambiguo. */
  const [dragReq, setDragReq] = useState(null);
  const dragReqSnapshot = useRef(null); // orden previo por id, para persistir solo lo cambiado

  const onReqGripDown = useCallback((e, id) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) { /* noop */ }
    dragReqSnapshot.current = Object.fromEntries(requests.map(x => [x.id, x.orden ?? null]));
    setDragReq(id);
  }, [requests]);

  useEffect(() => {
    if (!dragReq) return;
    const onMove = (e) => {
      const el = document.elementsFromPoint(e.clientX, e.clientY)
        .find(n => n.dataset && n.dataset.reqid);
      if (!el) return;
      const overId = el.dataset.reqid;
      if (!overId || overId === dragReq) return;
      setRequests(prev => {
        const vis = [...prev].sort(reqPrio);
        const from = vis.findIndex(x => x.id === dragReq);
        const to   = vis.findIndex(x => x.id === overId);
        if (from < 0 || to < 0 || from === to) return prev;
        vis.splice(to, 0, vis.splice(from, 1)[0]);
        return vis.map((x, i) => ({ ...x, orden: i + 1 }));
      });
    };
    const onUp = () => {
      const snap = dragReqSnapshot.current || {};
      dragReqSnapshot.current = null;
      setDragReq(null);
      // Persistir en background solo las filas cuyo orden cambió.
      setRequests(prev => {
        const vis = [...prev].sort(reqPrio);
        vis.forEach((x, i) => {
          const nuevo = i + 1;
          if (snap[x.id] !== nuevo) patch("mkt_requests", x.id, { orden: nuevo });
        });
        return vis.map((x, i) => ({ ...x, orden: i + 1 }));
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragReq, reqPrio, patch]);

  const solicitudes = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 170, position: "relative" }}>
          <Search size={14} color={txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input placeholder="Buscar solicitudes…" value={reqSearch} onChange={e => setReqSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 33 }} />
        </div>
        <button onClick={() => setShowReqForm(s => !s)} style={{
          background: showReqForm ? "transparent" : `${accent}1A`, border: `1px solid ${accent}55`,
          borderRadius: 10, padding: "9px 15px", cursor: "pointer", color: accent,
          fontSize: 12.5, fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center", gap: 6,
        }}>{showReqForm ? <X size={14} /> : <Plus size={14} />} {showReqForm ? "Cerrar" : "Nueva solicitud"}</button>
      </div>

      {showReqForm && (
        <div style={{ ...card, padding: 15, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 8 }}>
            <input autoFocus placeholder="¿Qué necesitas? (ej. Flyer promo…) *" value={reqForm.titulo} onChange={e => setReqForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
            <select value={reqForm.brand} onChange={e => setReqForm(f => ({ ...f, brand: e.target.value }))} style={selStyle}>
              <option value="">Marca…</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: txt2 }}>Complejidad:</span>
            {["A", "AA", "AAA"].map(c => (
              <button key={c} onClick={() => setReqForm(f => ({ ...f, complejidad: c }))} style={{
                padding: "6px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: font,
                border: `1px solid ${reqForm.complejidad === c ? accent : bd}`,
                background: reqForm.complejidad === c ? `${accent}18` : "transparent",
                color: reqForm.complejidad === c ? accent : txt2,
              }}>{c}</button>
            ))}
            <span style={{ fontSize: 11.5, color: txt3 }}>A = simple · AAA = producción compleja (fija expectativas)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 2fr", gap: 8 }}>
            <input type="date" title="Fecha de entrega" value={reqForm.entrega} onChange={e => setReqForm(f => ({ ...f, entrega: e.target.value }))} style={inputStyle} />
            <select value={reqForm.assignee} onChange={e => setReqForm(f => ({ ...f, assignee: e.target.value }))} style={selStyle}>
              <option value="">Asignar a…</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input placeholder="Link a imagen de referencia (opcional)" value={reqForm.ref} onChange={e => setReqForm(f => ({ ...f, ref: e.target.value }))} style={inputStyle} />
          </div>
          <input placeholder="Objetivo (¿para qué es? ¿qué debe lograr?)" value={reqForm.objetivo} onChange={e => setReqForm(f => ({ ...f, objetivo: e.target.value }))} style={inputStyle} />
          <textarea placeholder="Detalle: estilo, textos, medidas…" rows={2} value={reqForm.detalle} onChange={e => setReqForm(f => ({ ...f, detalle: e.target.value }))} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={createRequest} disabled={saving || !reqForm.titulo.trim()} style={{
              background: accent, border: `1px solid ${accent}`, borderRadius: 10, padding: "10px 22px",
              cursor: "pointer", color: isLight ? "#FFFFFF" : "#04140F", fontSize: 13, fontWeight: 600, fontFamily: font,
              opacity: saving || !reqForm.titulo.trim() ? 0.6 : 1,
            }}>Enviar solicitud</button>
          </div>
        </div>
      )}

      {filteredReqs.length === 0 && emptyRow("Sin solicitudes. El pedido por nota de voz llega en la siguiente fase — por ahora se cargan acá.")}
      {filteredReqs.map(r => (
        <div key={r.id} data-reqid={r.id} style={{
          ...card, borderRadius: 14, padding: "12px 15px", display: "flex", alignItems: "center", gap: 11,
          flexWrap: isMobile ? "wrap" : "nowrap",
          border: dragReq === r.id ? `1px solid ${accent}` : card.border,
          boxShadow: dragReq === r.id ? `0 8px 24px ${accent}33` : card.boxShadow,
          opacity: dragReq && dragReq !== r.id ? 0.75 : 1,
          userSelect: dragReq ? "none" : undefined,
          transition: "border-color 0.12s, box-shadow 0.12s, opacity 0.12s",
        }}>
          {/* Mango de arrastre: prioridad a mano (se esconde durante una búsqueda) */}
          {!reqSearch && (
            <span
              onPointerDown={(e) => onReqGripDown(e, r.id)}
              title="Arrastra para cambiar la prioridad"
              style={{
                display: "inline-flex", alignItems: "center", flexShrink: 0,
                cursor: dragReq === r.id ? "grabbing" : "grab",
                touchAction: "none", color: dragReq === r.id ? accent : txt3,
                padding: "6px 2px", margin: "-6px 0",
              }}
            ><GripVertical size={15} /></span>
          )}
          <div style={{ flex: 1, minWidth: isMobile ? "60%" : 0 }}>
            <div style={{ fontSize: 13.5, color: txt, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {r.titulo} {cplxBadge(r.complejidad)}
            </div>
            <div style={{ fontSize: 12, color: txt3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span>{nameOf(r.solicitante)} → {r.assignee_id ? nameOf(r.assignee_id) : "sin asignar"}</span>
              {r.fecha_entrega && <span>· entrega {fmtDia(r.fecha_entrega)}</span>}
              {r.objetivo && <span>· {r.objetivo}</span>}
            </div>
            {r.detalle && <div style={{ fontSize: 12, color: txt2, marginTop: 3 }}>{r.detalle}</div>}
            {r.ref_image_url && (
              <a href={r.ref_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: accent, textDecoration: "none" }}>Ver referencia →</a>
            )}
          </div>
          {brandChip(r.brand_id)}
          <select value={r.estado} onChange={async e => {
            const estado = e.target.value;
            const ok = await patch("mkt_requests", r.id, { estado });
            if (ok) setRequests(prev => prev.map(x => x.id === r.id ? { ...x, estado } : x));
          }} style={{ ...selStyle, width: "auto", padding: "5px 8px", fontSize: 12, ...caret(txt2, 8) }}>
            {REQ_STATES.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
          </select>
        </div>
      ))}
    </div>
  );

  /* ════════════════════ TAB: EQUIPO (solo admin) ════════════════════ */

  /* ── Bloque de texto de un reporte: plegado a 2 líneas, con "ver todo" y su
     evidencia. Se usa igual en el panel de hoy y en el historial de la
     persona, para que el líder no tenga que aprender dos formatos. ── */
  /* ════════════ REPORTE DE ACTIVIDADES ════════════
     La caja que pidió Alex en la llamada del 27-jul: «que se metan a una pestaña
     como reporte de actividades y automáticamente ya te aparezca el día de hoy:
     ¿qué hiciste hoy, Luis Ángel Landeros?».
     Reemplaza al Google Form. Cuatro campos y un botón — él insistió cuatro veces
     en lo mismo: «entre menos rutas y menos botones tenga, mejor». */
  const [repForm, setRepForm]   = useState({ empresa: "", texto: "", tiempo: "", evidencia: "" });
  const [repSaving, setRepSaving] = useState(false);
  const [repOtro, setRepOtro]   = useState(false); // ya reportó pero quiere sumar otro
  // hoy | espacio1 (registro de propiedades) | espacio2 (bitácora, solo líder)
  const [repVista, setRepVista] = useState("espacio1");
  // La captura del día vive plegada arriba: la pantalla abre en la hoja, no en un formulario.
  const [repAbierto, setRepAbierto] = useState(false);

  const misReportesHoy = useMemo(
    () => bitacora.filter(r => r.profile_id === user?.id && r.fecha === hoy),
    [bitacora, user?.id, hoy]);

  const saveReporte = useCallback(async () => {
    const texto = String(repForm.texto || "").trim();
    if (!texto || !orgId) return;
    setRepSaving(true);
    const { error: e } = await supabase.from("mkt_daily_reports").insert({
      organization_id: orgId,
      profile_id: user?.id,
      fecha: hoy,
      texto,
      brand_id: repForm.empresa || null,
      tiempo_texto: String(repForm.tiempo || "").trim() || null,
      evidencia_url: String(repForm.evidencia || "").trim() || null,
      origen: "web",
    });
    setRepSaving(false);
    if (e) { setError("No pude guardar tu reporte. Intenta de nuevo."); return; }
    setError("");   // si venía de un intento fallido, el aviso rojo se va al guardar bien
    // Se conserva la empresa elegida: casi siempre es la misma en el mismo día.
    setRepForm(f => ({ empresa: f.empresa, texto: "", tiempo: "", evidencia: "" }));
    setRepOtro(false);
    setRepAbierto(false);   // se pliega sola: reportar y volver a la hoja
    load();
  }, [repForm, orgId, user?.id, hoy, load]);

  const reporteTexto = (r) => {
    const abierta = bitaAbierta.has(r.id);
    const texto = String(r.texto || "").trim();
    const largo = texto.length > 110 || texto.includes("\n");
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5, color: txt2, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
            ...(abierta ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }),
          }}>{texto || "Sin detalle"}</div>
          {largo && (
            <button onClick={() => toggleBita(r.id)} style={{
              background: "transparent", border: "none", padding: "2px 0 0", cursor: "pointer",
              color: accent, fontSize: 13.5, fontFamily: font,
            }}>{abierta ? "ver menos" : "ver todo"}</button>
          )}
        </div>
        {r.evidencia_url && (
          <a href={r.evidencia_url} target="_blank" rel="noreferrer" title="Abrir evidencia" style={{
            border: `1px solid ${accent}44`, borderRadius: 7, padding: "2px 7px", flexShrink: 0,
            color: accent, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13.5, textDecoration: "none",
          }}><Folder size={11} /> Evidencia</a>
        )}
      </div>
    );
  };

  /* ════════════ TAB: ACTIVIDADES (la pantalla de entrada de marketing) ════════════ */

  const reporteTab = () => {
    const primerNombre = String(user?.name || "").split(" ")[0] || "";
    const yaReporte    = misReportesHoy.length > 0;
    const mostrarCaja  = !yaReporte || repOtro;
    // `orgId` entra en la condición porque `saveReporte` se planta si no lo tiene:
    // sin esto el botón se veía habilitado, la persona lo apretaba y NO PASABA NADA
    // (sin error ni aviso). Mejor que se vea apagado hasta que la empresa cargue.
    const puedeGuardar = String(repForm.texto || "").trim().length > 0 && !repSaving && !!orgId;

    // Para el líder: qué reportó su gente hoy, arriba de su propia caja.
    const reportesHoy = bitacora.filter(r => r.fecha === hoy);
    const equipoHoy   = assignees
      .filter(m => m.id !== user?.id)
      .map(m => ({ m, rs: reportesHoy.filter(r => r.profile_id === m.id) }))
      .sort((a, b) => (b.rs.length > 0) - (a.rs.length > 0));
    const reportaron  = equipoHoy.filter(p => p.rs.length > 0).length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* LA CAPTURA DEL DÍA, PLEGADA. Iván pidió sacar «Hoy» del selector; la
            caja no se elimina porque es la que reemplazó al Google Form y es la
            única vía que tiene el equipo para reportar. Queda como un renglón:
            se ve de un vistazo si ya reportaste, y se abre con un toque. */}
        <div style={{
          ...card, borderRadius: 14, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          borderColor: yaReporte ? `${accent}33` : bd,
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 999, flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: yaReporte ? `${accent}1A` : (isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)"),
          }}>
            {yaReporte ? <Check size={14} color={accent} strokeWidth={3} /> : <ClipboardList size={14} color={txt3} />}
          </span>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: txt, fontFamily: fontDisp }}>
              {yaReporte ? "Ya reportaste hoy" : `¿Qué hiciste hoy${primerNombre ? `, ${primerNombre}` : ""}?`}
            </div>
            <div style={{ fontSize: 11.5, color: txt3, marginTop: 1 }}>
              {yaReporte ? "Si hiciste algo más, súmalo." : `Queda registrado al instante · ${fmtDia(hoy)}`}
            </div>
          </div>
          {/* Para el líder: cómo viene su equipo hoy, sin entrar a ningún lado. */}
          {isAdmin && equipoHoy.length > 0 && (
            <button onClick={() => setRepVista("espacio2")} title="Ver la bitácora del equipo" style={{
              fontSize: 11.5, whiteSpace: "nowrap", padding: "4px 11px", borderRadius: 999, cursor: "pointer",
              fontFamily: font, background: "transparent",
              color: reportaron === equipoHoy.length ? accent : reportaron === 0 ? txt3 : AMBER,
              border: `1px solid ${reportaron === equipoHoy.length ? `${accent}44` : reportaron === 0 ? bd : `${AMBER}44`}`,
            }}>{reportaron} de {equipoHoy.length} reportaron</button>
          )}
          <button onClick={() => { setRepAbierto(o => !o); if (yaReporte) setRepOtro(true); }} style={{
            minHeight: 34, padding: "0 15px", borderRadius: 10, cursor: "pointer", fontFamily: font,
            fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
            background: repAbierto ? "transparent" : `${accent}18`,
            border: `1px solid ${accent}55`, color: accent,
          }}>{repAbierto ? "Cerrar" : yaReporte ? "Agregar otro" : "Contar mi día"}</button>
        </div>

        {repAbierto && (<>

        {/* ── LA CAJA ── */}
        {mostrarCaja ? (
          /* Tipografía +10% en toda la caja (pedido de Iván: «deja las letras un
             10% más grandes de este apartado»). Es el formulario que el equipo
             llena TODOS los días — es donde menos se puede forzar la vista.
             UX aplicada, no decoración: (1) `.mkt-campo` da anillo de FOCO
             visible — `inputStyle` trae `outline:none` y sin esto quien llena la
             hoja con Tab no sabe dónde está parado; (2) ⌘/Ctrl+Enter guarda desde
             el propio texto, que es donde están las manos; (3) el único campo
             obligatorio se marca con * y se dice qué falta, en vez de dejar el
             botón apagado sin explicación; (4) los opcionales lo dicen en la
             etiqueta para que nadie se frene buscando el dato. */
          <div style={{ ...card, borderRadius: 15, padding: isMobile ? "16px 16px" : "20px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <div style={{ fontSize: isMobile ? 18.5 : 21, fontWeight: 600, color: txt, fontFamily: fontDisp, lineHeight: 1.25 }}>
                ¿Qué hiciste hoy{primerNombre ? `, ${primerNombre}` : ""}?
              </div>
              <div style={{ fontSize: 13, color: txt3, marginTop: 3 }}>
                Cuéntalo con tus palabras, como se lo dirías a un compañero · {fmtDia(hoy)}
              </div>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12.5, color: txt3 }}>
                Lo que hiciste <span style={{ color: accent }}>*</span>
              </span>
              <textarea
                className="mkt-campo"
                autoFocus={!isMobile}
                rows={isMobile ? 6 : 5}
                value={repForm.texto}
                onChange={e => setRepForm(f => ({ ...f, texto: e.target.value }))}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && puedeGuardar) saveReporte(); }}
                placeholder={"De 9 a 9:30 generé dos fichas técnicas.\nDe 9:30 a 12 edición del video de Casa Sol y Luna.\nDe 1 a 3 ensamble del proyecto…"}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, fontSize: 15, padding: "12px 13px" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: txt3 }}>¿En qué empresa? (opcional)</span>
                <select className="mkt-campo" value={repForm.empresa}
                  onChange={e => setRepForm(f => ({ ...f, empresa: e.target.value }))}
                  style={{ ...selStyle, fontSize: 14.5, padding: "11px 13px", paddingRight: 27 }}>
                  <option value="">— elegir —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: txt3 }}>¿Cuánto te llevó? (opcional)</span>
                <input className="mkt-campo" value={repForm.tiempo} onChange={e => setRepForm(f => ({ ...f, tiempo: e.target.value }))}
                  placeholder="de 9 a 12 · 3 hrs · toda la tarde"
                  style={{ ...inputStyle, fontSize: 14.5, padding: "11px 13px" }} />
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12.5, color: txt3 }}>Evidencia (opcional) — el enlace de la carpeta o el archivo</span>
              <input className="mkt-campo" value={repForm.evidencia} onChange={e => setRepForm(f => ({ ...f, evidencia: e.target.value }))}
                placeholder="Pega el enlace de Drive"
                style={{ ...inputStyle, fontSize: 14.5, padding: "11px 13px" }} />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
              <button onClick={saveReporte} disabled={!puedeGuardar} title="⌘/Ctrl + Enter" style={{
                padding: "11px 24px", borderRadius: 10, fontFamily: font, fontSize: 15, fontWeight: 600,
                cursor: puedeGuardar ? "pointer" : "default", backgroundColor: `${accent}1C`,
                border: `1px solid ${accent}66`, color: accent, opacity: puedeGuardar ? 1 : 0.55,
              }}>{repSaving ? "Guardando…" : "Guardar"}</button>
              {/* Que el botón apagado DIGA por qué lo está: un control gris sin
                  explicación es el clásico «no me deja guardar y no sé por qué». */}
              {!puedeGuardar && !repSaving && (
                <span style={{ fontSize: 13, color: txt3 }}>
                  {String(repForm.texto || "").trim() ? "Un momento, cargando tu empresa…" : "Escribe lo que hiciste para poder guardar."}
                </span>
              )}
              {yaReporte && (
                <button onClick={() => setRepOtro(false)} style={{
                  background: "transparent", border: "none", cursor: "pointer", color: txt3, fontSize: 13.5, fontFamily: font,
                }}>Cancelar</button>
              )}
              {onOpenCopilot && (
                <span style={{ fontSize: 13, color: txt3, marginLeft: "auto" }}>
                  ¿Vas manejando?{" "}
                  <button onClick={onOpenCopilot} style={{
                    background: "transparent", border: "none", padding: 0, cursor: "pointer", color: accent, fontSize: 13, fontFamily: font,
                  }}>cuéntaselo al Copilot por voz</button>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ ...card, borderRadius: 15, padding: "15px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Check size={17} color={accent} strokeWidth={3} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 14, color: txt, fontWeight: 500, fontFamily: fontDisp }}>Ya reportaste hoy</div>
              <div style={{ fontSize: 12, color: txt3 }}>Gracias. Si hiciste algo más, súmalo.</div>
            </div>
            <button onClick={() => setRepOtro(true)} style={{
              padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontFamily: font, fontSize: 12.5,
              background: "transparent", border: `1px solid ${accent}44`, color: accent,
            }}>Agregar otro</button>
          </div>
        )}

        {/* ── Lo que ya cargó hoy ── */}
        {misReportesHoy.length > 0 && (
          <div style={{ ...card, borderRadius: 14, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 11.5, color: txt3, letterSpacing: 0.5, textTransform: "uppercase" }}>Tu reporte de hoy</div>
            {misReportesHoy.map(r => (
              <div key={r.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", borderTop: `1px solid ${bd}`, paddingTop: 9 }}>
                <span style={{ fontSize: 11.5, color: txt3, whiteSpace: "nowrap", flexShrink: 0, minWidth: 38, paddingTop: 1 }}>{fmtHora(r.created_at)}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(r.brand_id || r.tiempo_texto) && (
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", fontSize: 11.5, color: txt2 }}>
                      {r.brand_id && <span>{brandById[r.brand_id]?.nombre || ""}</span>}
                      {r.tiempo_texto && <span style={{ color: txt3 }}>· {r.tiempo_texto}</span>}
                    </div>
                  )}
                  {reporteTexto(r)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Para el líder: qué reportó su gente hoy ── */}
        {isAdmin && equipoHoy.length > 0 && (
          <div style={{ ...card, borderRadius: 14, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: txt, fontFamily: fontDisp }}>Tu equipo hoy</div>
              <div style={{
                fontSize: 12, whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 999,
                color: reportaron === equipoHoy.length ? accent : reportaron === 0 ? txt3 : AMBER,
                border: `1px solid ${reportaron === equipoHoy.length ? `${accent}44` : reportaron === 0 ? bd : `${AMBER}44`}`,
              }}>{reportaron} de {equipoHoy.length} reportaron</div>
            </div>
            {equipoHoy.map(({ m, rs }) => (
              <div key={m.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", borderTop: `1px solid ${bd}`, paddingTop: 9 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0, marginTop: 5,
                  background: rs.length > 0 ? accent : "transparent",
                  border: rs.length > 0 ? "none" : `1.5px solid ${txt3}66`,
                }} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: rs.length > 0 ? txt : txt2, fontWeight: 500 }}>{m.name}</span>
                    {rs.length > 0
                      ? <span style={{ fontSize: 11.5, color: txt3 }}>
                          {fmtHora(rs[0].created_at)}
                          {rs[0].brand_id ? ` · ${brandById[rs[0].brand_id]?.nombre || ""}` : ""}
                          {rs.length > 1 ? ` · ${rs.length} reportes` : ""}
                        </span>
                      : <span style={{ fontSize: 12, color: txt3 }}>todavía no reportó</span>}
                  </div>
                  {rs.map(r => <div key={r.id}>{reporteTexto(r)}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
        </>)}


        {/* LOS DOS ESPACIOS. Iván: «quita el módulo de hoy y solo se quede el
            espacio 1 y 2». La CAPTURA del día no se pierde —es la que reemplazó
            al Google Form y sin ella el equipo no tiene dónde reportar—: se
            movió a la barra plegada de acá abajo, a un toque.
            Espacio 2 es SOLO del líder: nadie del equipo necesita leer la
            bitácora de sus compañeros (misma regla que la sección Equipo). */}
        {(() => {
          const espacios = [
            ["espacio1", "Espacio 1", "Registro de propiedades y grabaciones",
             "Cada propiedad, en qué va su video y todos sus enlaces.", pipeline.length],
            ...(isAdmin ? [["espacio2", "Espacio 2", "Bitácora del equipo",
             "Lo que reportó cada quien, día por día.", bitacora.length]] : []),
          ];
          const actual = espacios.find(e => e[0] === repVista) || espacios[0];
          return (
            <>
              <div role="tablist" aria-label="Espacios" style={{
                display: "inline-flex", gap: 4, padding: 4, borderRadius: 14, alignSelf: "flex-start",
                border: `1px solid ${bd}`, background: isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.035)",
              }}>
                {espacios.map(([id, l, titulo, , n]) => {
                  const on = repVista === id;
                  return (
                    <button key={id} className="mkt-seg-btn" role="tab" aria-selected={on} title={titulo}
                      onClick={() => setRepVista(id)}
                      style={{
                        // 36px de alto: el mínimo cómodo para tocar en móvil.
                        display: "inline-flex", alignItems: "center", gap: 8, minHeight: 36,
                        padding: "0 16px", borderRadius: 11, cursor: "pointer", border: "none",
                        fontFamily: fontDisp, fontSize: 13, fontWeight: on ? 600 : 500,
                        letterSpacing: "-0.01em",
                        background: on ? (isLight ? "#FFFFFF" : "rgba(255,255,255,0.10)") : "transparent",
                        color: on ? txt : txt3,
                        boxShadow: on ? (isLight ? "0 1px 3px rgba(15,23,42,0.10)" : "0 2px 10px rgba(0,0,0,0.35)") : "none",
                      }}>
                      {l}
                      {/* El conteo evita tener que entrar para saber cuánto hay. */}
                      <span style={{
                        fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                        padding: "1px 7px", borderRadius: 999,
                        color: on ? accent : txt3,
                        background: on ? `${accent}1A` : (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"),
                      }}>{n}</span>
                    </button>
                  );
                })}
              </div>

              {/* Título del espacio + qué es. «Espacio 1» y «Espacio 2» son los
                  nombres que pidió Iván, pero solos no dicen nada: el nombre
                  real va grande y la explicación en segundo plano. */}
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 600, color: txt, fontFamily: fontDisp, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {actual[2]}
                </div>
                <div style={{ fontSize: 12.5, color: txt3, marginTop: 3 }}>{actual[3]}</div>
              </div>
            </>
          );
        })()}

        {repVista === "espacio1" && pipelineTabla()}
        {isAdmin && repVista === "espacio2" && reporteTabla()}
      </div>
    );
  };

  const equipo = () => {
    const week = Date.now() - 7 * 86400000;

    /* El panel del día ya no vive acá: se mudó a la pestaña Actividades, que es
       la pantalla de entrada. Equipo queda para la vista PROFUNDA de la semana
       (avance por persona, evidencia y bitácora de días anteriores). */

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {assignees.length === 0 && emptyRow("Sin usuarios con rol marketing en la organización.")}
        {assignees.map(m => {
          const tt = tasks.filter(t => t.assignee_id === m.id);
          const enCurso  = tt.filter(t => t.estado !== "hecha" && !isBlocked(t)).length;
          const bloq     = tt.filter(t => t.estado !== "hecha" && isBlocked(t)).length;
          const venc     = tt.filter(t => t.estado !== "hecha" && t.due_at && dayStr(t.due_at) < hoy).length;
          // Pendientes LISTADAS (no solo contadas): sin esta lista, una tarea recién
          // asignada (ej. por el Copilot) era invisible para el admin — solo el
          // asignado la veía en SU Mi Día al llegar el día.
          const pendientes = tt.filter(t => t.estado !== "hecha")
            .sort((a, b) => ((a.due_at || "9999") < (b.due_at || "9999") ? -1 : 1));
          // Tareas HECHAS de la semana (no solo el conteo): el admin las ve listadas
          // con su EVIDENCIA clicable — así "le llega" la foto/video que subió cada quien.
          const hechasSemana = tt.filter(t => t.estado === "hecha" && t.updated_at && new Date(t.updated_at).getTime() > week);
          const hechas7  = hechasSemana.length;
          // Bitácora de DÍAS ANTERIORES. Lo de hoy ya está arriba en el panel:
          // repetirlo acá haría que el líder lea dos veces lo mismo.
          const bita = (bitacoraPor[m.id] || []).filter(r => r.fecha !== hoy);
          const bitaVisible = bita.slice(0, 3);
          const stat = (label, n, color) => (
            <div key={label} style={{ textAlign: "center", minWidth: isMobile ? 0 : 74, flex: isMobile ? "1 1 0" : "0 0 auto" }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: color || txt, fontFamily: fontDisp }}>{n}</div>
              <div style={{ fontSize: 13.5, color: txt3 }}>{label}</div>
            </div>
          );
          return (
            <div key={m.id} style={{ ...card, borderRadius: 14, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${accent}16`, border: `1px solid ${accent}40`, color: accent, fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
                }}>{String(m.name || "?").charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13.5, color: txt, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 14, color: txt3 }}>{m.id === user?.id ? "tú" : "marketing"}</div>
                </div>
                {/* Stats: en móvil ocupan su propia fila a lo ancho, repartidas parejas */}
                <div style={{ display: "flex", gap: isMobile ? 4 : 10, flex: isMobile ? "1 1 100%" : "0 0 auto", justifyContent: isMobile ? "space-between" : "flex-end" }}>
                  {stat("En curso", enCurso)}
                  {stat("Bloqueadas", bloq, bloq > 0 ? AMBER : undefined)}
                  {stat("Vencidas", venc, venc > 0 ? RED : undefined)}
                  {stat("Hechas · 7d", hechas7, hechas7 > 0 ? accent : undefined)}
                </div>
              </div>
              {pendientes.length > 0 && (
                <div style={{ borderTop: `1px solid ${bd}`, paddingTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
                  {pendientes.slice(0, 8).map(t => {
                    const vencida = t.due_at && dayStr(t.due_at) < hoy;
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: vencida ? RED : isBlocked(t) ? AMBER : `${accent}88` }} />
                        <span style={{ flex: 1, fontSize: 14.5, color: txt2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</span>
                        {isBlocked(t) && <span style={{ fontSize: 13, color: AMBER, flexShrink: 0 }}>bloqueada</span>}
                        <span style={{ fontSize: 13.5, color: vencida ? RED : txt3, whiteSpace: "nowrap", flexShrink: 0 }}>{t.due_at ? fmtDia(t.due_at) : "sin fecha"}</span>
                      </div>
                    );
                  })}
                  {pendientes.length > 8 && (
                    <div style={{ fontSize: 13.5, color: txt3 }}>+{pendientes.length - 8} más</div>
                  )}
                </div>
              )}
              {/* Hechas de la semana con su EVIDENCIA — el admin abre la foto/video de cada una */}
              {hechasSemana.length > 0 && (
                <div style={{ borderTop: `1px solid ${bd}`, paddingTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
                  {hechasSemana.slice(0, 6).map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Check size={12} color={accent} strokeWidth={3} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14.5, color: txt2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</span>
                      <span style={{ fontSize: 13.5, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(t.updated_at)}</span>
                      {t.evidencia_url ? (
                        <button onClick={() => openEvidence(t)} title="Ver evidencia" style={{
                          background: "transparent", border: `1px solid ${accent}44`, borderRadius: 7,
                          padding: "2px 7px", cursor: "pointer", color: accent, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13.5, fontFamily: font, flexShrink: 0,
                        }}><Camera size={11} /> Evidencia</button>
                      ) : (
                        <span style={{ fontSize: 13.5, color: txt3, flexShrink: 0 }}>sin evidencia</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* BITÁCORA — lo que la persona reportó que hizo cada día, con su
                  evidencia. Es el complemento de las tareas: acá aparece el
                  trabajo que nadie había pedido en una lista. */}
              {bitaVisible.length > 0 && (
                <div style={{ borderTop: `1px solid ${bd}`, paddingTop: 9, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 13, color: txt3, letterSpacing: 0.5, textTransform: "uppercase" }}>Días anteriores</div>
                  {bitaVisible.map(r => (
                    <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 13.5, color: txt3, whiteSpace: "nowrap", flexShrink: 0, minWidth: 40, paddingTop: 1 }}>
                        {fmtDia(r.fecha)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>{reporteTexto(r)}</div>
                    </div>
                  ))}
                  {bita.length > bitaVisible.length && (
                    <div style={{ fontSize: 13.5, color: txt3 }}>
                      +{bita.length - bitaVisible.length} {bita.length - bitaVisible.length === 1 ? "reporte anterior" : "reportes anteriores"}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 14, color: txt3, textAlign: "center" }}>
          Los conteos salen de las tareas del módulo; la bitácora, de lo que reporta cada quien. Vista solo para administración.
        </div>
      </div>
    );
  };

  /* ════════════════════ Render ════════════════════ */

  // El número rojo de la pestaña: lo atascado. Cuenta el retrabajo (CAMBIOS) y
  // lo que espera voz en off — las dos cosas que frenan una publicación.
  const esperandoVoz = pipeline.filter(p => p.etapa === "esperando_voz").length;
  const enCambios    = pipeline.filter(p => p.etapa === "cambios").length;
  const atascadas    = esperandoVoz + enCambios;

  const firstName = String(user?.name || "").split(" ")[0] || "Marketing";
  // Título + explicación EN SIMPLE por sección (la gente no es técnica: cada tab
  // se explica sola — pedido de Ángel 21-jul).
  const TAB_META = {
    // El subtítulo va CORTO a propósito: el largo ("…lo bloqueado no depende de ti")
    // se partía en dos renglones y dejaba la palabra «ti» sola abajo — se veía roto
    // en el iPhone (reporte de Ángel con captura, 27-jul).
    // Ya no es un formulario: la pantalla son las DOS HOJAS del equipo, y el
    // reporte del día quedó como una barra plegada arriba (Iván, 30-jul).
    reporte:     { title: "Actividades", sub: "Las dos hojas del equipo, en un solo lugar" },
    dia:         { title: `Hoy — ${firstName}`, sub: "Lo vencido primero, después lo de hoy" },
    // El rótulo lo pone cada empresa (NSG: "Proyectos"). Antes el encabezado decía
    // "Marcas" aunque el botón ya dijera "Proyectos" — el vocabulario de marketing
    // se colaba en NSG. Duke sin config sigue viendo "Marcas".
    marcas:      { title: tabLabel("marcas", "Marcas"),
                   sub: TENANT_MKT.tabLabels?.marcas
                     ? "Cada proyecto con su avance"
                     : "Los proyectos de cada marca, con su avance" },
    // «Pipeline» era jerga nuestra. El equipo de Alex lo llama por lo que es:
    // el registro de las propiedades y sus grabaciones.
    pipeline:    { title: tabLabel("pipeline", "Registro de Propiedades"),
                   sub: "Cada propiedad y en qué va su video · se edita acá mismo" },
    solicitudes: { title: "Solicitudes",  sub: "Pedidos de diseño · A es simple, AAA es complejo" },
    equipo:      { title: "Equipo",       sub: "Qué hizo hoy cada quien, y cómo viene la semana" },
  };
  const meta = TAB_META[tab] || TAB_META.dia;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 16, color: txt, fontFamily: font,
      // TODAS las tabs ocupan TODO el ancho como el Pipeline (decisión Ángel 24-jul):
      // antes solo Pipeline iba full y las demás quedaban en una columna de 1180
      // centrada, con márgenes muertos a los lados en monitor grande. Ahora parejo.
      maxWidth: "none",
      width: "100%", margin: "0 auto", overflowX: "hidden",
    }}>
      {/* Fila 1 — identidad del espacio + tabs segmentados (estilo mockup aprobado).
          En móvil se apila: identidad arriba, tabs a lo ancho abajo (scroll horizontal limpio). */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: isMobile ? undefined : 1,
                      justifyContent: isMobile ? "center" : "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}33` }}>
            <Megaphone size={20} color={accent} strokeWidth={1.9} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 650, color: txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Mi Espacio</div>
            <div style={{ fontSize: 12, color: txt2 }}>{firstName} · {MODULE_LABEL}</div>
          </div>
        </div>
        <div style={{
          display: "flex", gap: 3, padding: 5, borderRadius: 16, overflowX: "auto", WebkitOverflowScrolling: "touch",
          background: isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.035)", border: `1px solid ${bd}`,
          maxWidth: "100%", width: isMobile ? "100%" : undefined, flexShrink: 0,
        }}>
          {tabBtn("reporte", tabLabel("reporte", "Actividades"))}
          {SHOW_TAB_DIA && tabBtn("dia", tabLabel("dia", "Mi Día"))}
          {!HIDDEN_TABS.has("marcas") && tabBtn("marcas", tabLabel("marcas", "Marcas"))}
          {!HIDDEN_TABS.has("pipeline") && tabBtn("pipeline", tabLabel("pipeline", "Propiedades"), atascadas >= 3 ? atascadas : 0)}
          {!HIDDEN_TABS.has("solicitudes") && tabBtn("solicitudes", tabLabel("solicitudes", "Solicitudes"), requests.filter(r => r.estado === "nueva").length)}
          {isAdmin && tabBtn("equipo", tabLabel("equipo", "Equipo"))}
        </div>
        {!isMobile && <div style={{ flex: 1 }} />}
      </div>

      {/* Fila 2 — título de la sección + acciones.
          En el celular el bloque va CENTRADO y los botones a lo ancho: antes el
          título quedaba pegado a la izquierda y los dos botoncitos abajo se veían
          sueltos (pedido de Ángel 27-jul, con captura). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ textAlign: isMobile ? "center" : "left", width: isMobile ? "100%" : "auto" }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 23 : 26, fontFamily: fontDisp, fontWeight: 600, letterSpacing: "-0.02em", color: txt }}>
            {meta.title}
          </h1>
          <p style={{ margin: "5px auto 0", fontSize: 13, color: txt2, maxWidth: 640, textWrap: "balance" }}>{meta.sub}</p>
        </div>
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
          <button onClick={load} title="Actualizar" style={{ background: glass, border: `1px solid ${bd}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", color: txt2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <RefreshCw size={16} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          {onOpenCopilot && (
            <button onClick={onOpenCopilot} title="Crear con voz — díctale al Copilot" style={{
              background: "transparent", border: `1px solid ${accent}55`, borderRadius: 12, padding: "12px 18px",
              cursor: "pointer", color: accent, fontSize: 13.5, fontWeight: 600, fontFamily: font,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              flex: isMobile ? 1 : "none",
            }}><Mic size={15} /> Crear con voz</button>
          )}
        </div>
      </div>

      {evidence && (
        <div style={{ ...card, borderColor: `${accent}44`, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Check size={16} color={accent} strokeWidth={2.5} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, color: txt, fontWeight: 600 }}>«{evidence.task.titulo}» completada</div>
            <div style={{ fontSize: 12, color: txt2, marginTop: 2 }}>Si tienes alguna evidencia (foto, video o link), envíala — suma a tu reporte. Es opcional.</div>
          </div>
          <label style={{
            background: `${accent}12`, border: `1px dashed ${accent}55`, borderRadius: 10, padding: "9px 13px",
            cursor: evUploading ? "wait" : "pointer", color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: font,
            display: "inline-flex", alignItems: "center", gap: 6, opacity: evUploading ? 0.6 : 1,
          }}>
            <Camera size={14} /> {evUploading ? "Subiendo…" : "Foto / video"}
            <input type="file" accept="image/*,video/*" disabled={evUploading} style={{ display: "none" }}
              onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadEvidence(f); e.target.value = ""; }} />
          </label>
          <input placeholder="…o pega un link (opcional)" value={evidence.url}
            onChange={e => setEvidence(ev => ({ ...ev, url: e.target.value }))}
            style={{ ...inputStyle, width: isMobile ? "100%" : 220 }} />
          <button onClick={saveEvidence} disabled={evUploading} style={{
            background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 10, padding: "9px 15px",
            cursor: "pointer", color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: font, opacity: evUploading ? 0.6 : 1,
          }}>{(evidence.url || "").trim() ? "Guardar evidencia" : "Listo, sin evidencia"}</button>
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: RED }}>{error}</div>}
      {loading && tasks.length === 0 ? (
        <div style={{ color: txt2, fontSize: 13, padding: 30, textAlign: "center" }}>Cargando…</div>
      ) : (
        <>
          {tab === "reporte" && reporteTab()}
          {tab === "dia" && miDia()}
          {tab === "marcas" && marcas()}
          {tab === "pipeline" && pipelineTab()}
          {tab === "solicitudes" && solicitudes()}
          {tab === "equipo" && isAdmin && equipo()}
        </>
      )}

      {/* Visor de EVIDENCIA (foto/video del bucket privado, vía URL firmada) */}
      {evViewer && (
        <div onClick={() => setEvViewer(null)} style={{
          position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: isLight ? "#FFFFFF" : "#0B1220", border: `1px solid ${bd}`, borderRadius: 16,
            padding: 14, maxWidth: "min(92vw, 860px)", maxHeight: "88vh", display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Camera size={15} color={accent} />
              <div style={{ flex: 1, fontSize: 13, color: txt, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {evViewer.loading ? "Abriendo evidencia…" : `Evidencia — ${evViewer.titulo || ""}`}
              </div>
              <button onClick={() => setEvViewer(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: txt2, padding: 4 }}><X size={16} /></button>
            </div>
            {!evViewer.loading && evViewer.url && (
              evViewer.tipo === "video"
                ? <video src={evViewer.url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "72vh", borderRadius: 10, background: "#000" }} />
                : <img src={evViewer.url} alt="Evidencia" style={{ maxWidth: "100%", maxHeight: "72vh", borderRadius: 10, objectFit: "contain" }} />
            )}
          </div>
        </div>
      )}

      {/* FICHA DE LA PROPIEDAD — el renglón de la hoja de cálculo, adentro del CRM.
          Todo lo que el registro guardaba en Sheets se llena y se lee acá. */}
      {ficha && (
        <div onClick={() => setFicha(null)} style={{
          position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: isLight ? "#FFFFFF" : "#0B1220", border: `1px solid ${bd}`, borderRadius: 16,
            padding: 16, width: "min(94vw, 620px)", maxHeight: "88vh", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Clapperboard size={15} color={accent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, color: txt, fontWeight: 600, fontFamily: fontDisp }}>
                  {ficha.id ? "Ficha de la propiedad" : "Nueva propiedad"}
                </div>
                <div style={{ fontSize: 11.5, color: txt3, marginTop: 1 }}>
                  {ficha.id ? "Todo lo de la hoja, en un solo lugar." : "Con el nombre alcanza — el resto se llena cuando lo tengas."}
                </div>
              </div>
              <button onClick={() => setFicha(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: txt2, padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11.5, color: txt3 }}>Estatus</span>
                <select value={ficha.etapa} onChange={e => setFicha(f => ({ ...f, etapa: e.target.value }))} style={selStyle}>
                  {ETAPAS.map(x => <option key={x.id} value={x.id}>{x.l}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11.5, color: txt3 }}>Empresa</span>
                <select value={ficha.brand_id} onChange={e => setFicha(f => ({ ...f, brand_id: e.target.value }))} style={selStyle}>
                  <option value="">— elegir —</option>
                  {brands.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
              </label>
              {[
                ["nombre",            "Propiedad",            "text",  "Casa Lago"],
                ["locacion",          "Ubicación",            "text",  "Tulum, Cancún, PDC…"],
                ["precio",            "Precio",               "text",  "$22.88 MDP · $2.1M USD · Reservado"],
                ["tipo",              "Tipo",                 "text",  "Casa - Villa · Depto · Terreno"],
                ["fecha_rodaje",      "Fecha de rodaje",      "date",  ""],
                ["fecha_publicacion", "Fecha de publicación", "date",  ""],
              ].map(([k, label, type, ph]) => (
                <label key={k} style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  gridColumn: k === "nombre" && !isMobile ? "1 / -1" : undefined,
                  order: k === "nombre" ? -1 : undefined,
                }}>
                  <span style={{ fontSize: 11.5, color: txt3 }}>
                    {label}{k === "nombre" && <span style={{ color: accent }}> *</span>}
                  </span>
                  <input type={type} placeholder={ph} value={ficha[k]} autoFocus={k === "nombre" && !ficha.id}
                    list={k === "locacion" ? "mkt-cat-ubicacion" : k === "tipo" ? "mkt-cat-tipo" : undefined}
                    onChange={e => setFicha(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
                </label>
              ))}
              {/* Ubicación y Tipo SUGIEREN el catálogo de la hoja (mismas plazas y
                  mismos tipos que ya usa el equipo) pero dejan escribir algo nuevo:
                  así no se inventan cinco formas de decir «Cancún» y tampoco hay que
                  pedir permiso para dar de alta una plaza que todavía no está. */}
              <datalist id="mkt-cat-ubicacion">{CAT_UBICACION.map(o => <option key={o.v} value={o.v} />)}</datalist>
              <datalist id="mkt-cat-tipo">{CAT_TIPO.map(o => <option key={o.v} value={o.v} />)}</datalist>
            </div>

            <div style={{ fontSize: 11.5, color: txt3, letterSpacing: 0.4, textTransform: "uppercase", paddingTop: 2 }}>Enlaces</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9 }}>
              {[
                ["crudos_url", "Carpeta de crudos"],
                ["video_url",  "Video editado"],
                ["ig_url",     "Reel de Instagram"],
                ["story_url",  "Versión story"],
                ["cine_url",   "Versión cine"],
                ["ficha_url",  "Ficha técnica"],
                ["info_url",   "Carpeta de información"],
                ["drive_url",  "Drive de la propiedad"],
              ].map(([k, label]) => (
                <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: txt3, display: "flex", alignItems: "center", gap: 6 }}>
                    {label}
                    {ficha[k] && <a href={ficha[k]} target="_blank" rel="noreferrer" style={{ color: accent, display: "inline-flex" }} title="Abrir"><ExternalLink size={11} /></a>}
                  </span>
                  <input placeholder="Pegá el enlace" value={ficha[k]}
                    onChange={e => setFicha(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
                </label>
              ))}
            </div>

            {colsExtra.length > 0 && (<>
              <div style={{ fontSize: 11.5, color: txt3, letterSpacing: 0.4, textTransform: "uppercase", paddingTop: 2 }}>Columnas del equipo</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 9 }}>
                {colsExtra.map(c => (
                  <label key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11.5, color: txt3 }}>{c.nombre}</span>
                    <input
                      type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
                      value={ficha.datos?.[c.clave] || ""}
                      onChange={e => setFicha(f => ({ ...f, datos: { ...(f.datos || {}), [c.clave]: e.target.value } }))}
                      style={inputStyle} />
                  </label>
                ))}
              </div>
            </>)}

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11.5, color: txt3 }}>Notas</span>
              <textarea rows={2} placeholder="Lo que haga falta recordar de esta propiedad" value={ficha.notas}
                onChange={e => setFicha(f => ({ ...f, notas: e.target.value }))}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 2 }}>
              <button onClick={() => setFicha(null)} style={{
                padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontFamily: font, fontSize: 12.5,
                background: "transparent", border: `1px solid ${bd}`, color: txt2,
              }}>Cancelar</button>
              <button onClick={saveFicha} disabled={fichaSaving || !String(ficha.nombre || "").trim()} style={{
                padding: "8px 16px", borderRadius: 9, fontFamily: font, fontSize: 12.5, fontWeight: 600,
                cursor: fichaSaving ? "default" : "pointer", background: `${accent}18`,
                border: `1px solid ${accent}55`, color: accent,
                opacity: fichaSaving || !String(ficha.nombre || "").trim() ? 0.6 : 1,
              }}>{fichaSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
