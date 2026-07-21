/**
 * views/Marketing.jsx — ERP de actividades del equipo de MARKETING (rol `marketing`)
 *
 * El "Monday/ClickUp interno" pedido por el equipo de marketing de Duke (reunión
 * 15-jul-2026): tabs Mi Día · Marcas · Pipeline · Solicitudes (+ Equipo solo admin).
 *   · Mi Día: rodaje de hoy → vencidas → para hoy → bloqueadas → mañana.
 *   · Marcas: tableros por marca con proyectos y barra de progreso (tareas hechas/total).
 *   · Pipeline: kanban de propiedades con 7 etapas reales (drag & drop nativo en
 *     desktop, botones ‹ › en móvil). La columna "Esperando voz" marca el cuello.
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
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Megaphone, Plus, X, RefreshCw, Folder, ExternalLink, Lock, Check,
  ChevronLeft, ChevronRight, ChevronDown, Clapperboard, Mic, CalendarDays,
  Search, Camera,
} from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

/* ── Constantes del dominio ─────────────────────────────────────────────── */

const ETAPAS = [
  { id: "seleccionada",  l: "Seleccionada" },
  { id: "agendada",      l: "Agendada" },
  { id: "grabada",       l: "Grabada" },
  { id: "en_edicion",    l: "En edición" },
  { id: "esperando_voz", l: "Esperando voz" },
  { id: "lista",         l: "Lista" },
  { id: "publicada",     l: "Publicada" },
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
    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
    border: `1px solid ${bd}`, borderRadius: 10, padding: "10px 12px",
    fontSize: 13, fontFamily: font, outline: "none", width: "100%", boxSizing: "border-box",
    // colorScheme hace que el desplegable NATIVO del <select> use el tema correcto:
    // antes en oscuro las opciones salían con fondo blanco y texto claro (ilegible).
    colorScheme: isLight ? "light" : "dark",
  };

  const brandColor = useCallback(
    (brand) => ((brand && BRAND_HEX[brand.slug]) || BRAND_FALLBACK)[isLight ? "l" : "d"],
    [isLight]
  );

  /* ── Estado / datos ── */
  // El rol marketing entra por las 4 secciones del SIDEBAR (mkt_dia/mkt_marcas/…)
  // y los tabs siguen funcionando adentro ("en ambas" — Iván 21-jul).
  const [tab, setTab] = useState(initialTab || "dia"); // dia | marcas | pipeline | solicitudes | equipo
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [brands, setBrands]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [requests, setRequests] = useState([]);
  const [people, setPeople]     = useState([]); // profiles de la org (nombres + asignar)
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const [b, pj, tk, pl, rq, pr] = await Promise.all([
        supabase.from("mkt_brands").select("id, nombre, slug, activo, orden")
          .eq("organization_id", orgId).eq("activo", true).order("orden"),
        supabase.from("mkt_projects").select("id, brand_id, nombre, descripcion, drive_url, due_date, estado, orden, created_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("orden").order("created_at"),
        supabase.from("mkt_tasks").select("id, brand_id, project_id, titulo, descripcion, assignee_id, created_by, prioridad, estado, avance_pct, due_at, depends_on, drive_url, updated_at, created_at")
          .eq("organization_id", orgId).is("deleted_at", null)
          .order("due_at", { ascending: true, nullsFirst: false }).limit(600),
        supabase.from("mkt_pipeline_items").select("id, brand_id, nombre, locacion, etapa, fecha_rodaje, drive_url, ig_url, notas, orden, updated_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("orden").order("updated_at"),
        supabase.from("mkt_requests").select("id, brand_id, titulo, detalle, objetivo, complejidad, ref_image_url, fecha_entrega, solicitante, assignee_id, estado, created_at")
          .eq("organization_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, name, role").eq("organization_id", orgId),
      ]);
      for (const r of [b, pj, tk, pl, rq, pr]) if (r.error) throw r.error;
      setBrands(b.data || []);
      setProjects(pj.data || []);
      setTasks(tk.data || []);
      setPipeline(pl.data || []);
      setRequests(rq.data || []);
      setPeople(pr.data || []);
    } catch (e) {
      setError("No pude cargar el módulo de Marketing. Probá actualizar.");
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
    if (url) await patch("mkt_tasks", evidence.task.id, { evidencia_url: url, evidencia_tipo: "link" });
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
      await patch("mkt_tasks", evidence.task.id, {
        evidencia_url: path,
        evidencia_tipo: String(file.type || "").startsWith("video") ? "video" : "foto",
      });
      setEvidence(null);
    } catch {
      setError("No pude subir el archivo — puedes pegar un link en su lugar.");
    } finally {
      setEvUploading(false);
    }
  }, [evidence, orgId, patch]);

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
        borderRadius: 999, fontSize: small ? 10.5 : 11.5, fontWeight: 600, fontFamily: font,
        color: c, background: `${c}1A`, border: `1px solid ${c}40`, whiteSpace: "nowrap",
      }}>{b.nombre}</span>
    );
  };

  const statePill = (estado, list = TASK_STATES) => {
    const l = list.find(s => s.id === estado)?.l || estado;
    const done = estado === "hecha" || estado === "entregada";
    return (
      <span style={{
        padding: "3px 10px", borderRadius: 999, fontSize: 11, fontFamily: font, whiteSpace: "nowrap",
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
          fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
        }}>{badge}</span>
      )}
    </button>
  );

  /* ════════════════════ TAB: MI DÍA ════════════════════ */

  const hoy = todayStr(), man = tomorrowStr();
  const rodajesHoy = useMemo(() => pipeline.filter(p => p.fecha_rodaje === hoy), [pipeline, hoy]);
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
                fontSize: 10.5, fontWeight: 700, color: isLight ? "#FFFFFF" : "#04140F",
                background: accent, whiteSpace: "nowrap",
              }}><Check size={11} strokeWidth={3} /> Desbloqueada</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: txt3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {p && <span>Proyecto: {p.nombre}</span>}
            {unlocked && dep && <span style={{ color: txt2 }}>· se completó “{dep.titulo}”</span>}
            {blocked && dep && (
              <span>Esperando: “{dep.titulo}” {dep.assignee_id ? `· ${nameOf(dep.assignee_id)}` : ""} · hace {diasDesde(dep.created_at)} días</span>
            )}
          </div>
        </div>
        {brandChip(t.brand_id)}
        {!blocked && statePill(t.estado)}
        <div style={{ fontSize: 12, color: overdue ? RED : txt2, fontFamily: font, whiteSpace: "nowrap", fontWeight: overdue ? 700 : 400 }}>
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
      {rodajesHoy.map(r => (
        <div key={r.id} style={{ ...card, borderRadius: 13, padding: "11px 15px", display: "flex", alignItems: "center", gap: 11 }}>
          <Clapperboard size={16} color={accent} />
          <div style={{ flex: 1, fontSize: 13, color: txt }}>
            <b style={{ fontWeight: 600 }}>Rodaje de hoy</b> — {r.nombre}{r.locacion ? ` · ${r.locacion}` : ""}
          </div>
          {r.drive_url && (
            <a href={r.drive_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: txt2, fontSize: 12, textDecoration: "none" }}>
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
      {paraHoy.length === 0 && emptyRow(`Nada pendiente para hoy. Creá una tarea desde Marcas${onOpenCopilot ? " o dictala con voz" : ""}.`)}
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
            {p.due_date && <span style={{ fontSize: 11, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(p.due_date)}</span>}
            {p.drive_url && <Folder size={13} color={txt3} />}
            <span style={{ fontSize: 11, color: txt2, whiteSpace: "nowrap" }}>{prog.done}/{prog.total}</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${prog.pct}%`, height: "100%", borderRadius: 999, background: c, transition: "width .3s ease" }} />
          </div>
        </button>
        {open && (
          <div style={{ padding: "2px 13px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
            {projTasks.length === 0 && <div style={{ fontSize: 12, color: txt3 }}>Sin tareas todavía.</div>}
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
                  {t.assignee_id && <span style={{ fontSize: 11, color: txt2, whiteSpace: "nowrap" }}>{nameOf(t.assignee_id)}</span>}
                  {t.due_at && <span style={{ fontSize: 11, color: txt3, whiteSpace: "nowrap" }}>{fmtDia(t.due_at)}</span>}
                  <select value={t.estado} onChange={e => setTaskState(t, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "3px 6px", fontSize: 11 }}>
                    {TASK_STATES.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
                  </select>
                </div>
              );
            })}
            {/* Alta de tarea dentro del proyecto */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 7, marginTop: 6 }}>
              <input placeholder="Nueva tarea…" value={taskForm.titulo} onChange={e => setTaskForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
              <select value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))} style={inputStyle}>
                <option value="">Asignar a…</option>
                {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="datetime-local" value={taskForm.due} onChange={e => setTaskForm(f => ({ ...f, due: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 7 }}>
              <select value={taskForm.dependsOn} onChange={e => setTaskForm(f => ({ ...f, dependsOn: e.target.value }))} style={inputStyle} title="La tarea queda bloqueada hasta que ésta se complete">
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
        const c = brandColor(b);
        return (
          <div key={b.id} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: txt, fontFamily: fontDisp }}>{b.nombre}</div>
              <span style={{ fontSize: 11.5, color: txt3 }}>{bProjects.length} proyecto{bProjects.length === 1 ? "" : "s"}</span>
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
              <div style={{ fontSize: 12, color: txt3 }}>Sin proyectos activos. Agregá el primero con “+”.</div>
            )}
            {bProjects.map(p => projectCard(p))}
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
      created_by: user?.id || null,
    });
    setSaving(false);
    if (e) { setError("No se pudo agregar la propiedad."); return; }
    setPipeForm({ nombre: "", locacion: "", brand: "", etapa: "seleccionada", rodaje: "", drive: "", ig: "" });
    setShowPipeForm(false);
    load();
  };

  const pipelineTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
          <select value={pipeForm.brand} onChange={e => setPipeForm(f => ({ ...f, brand: e.target.value }))} style={inputStyle}>
            <option value="">Marca (Duke)</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <select value={pipeForm.etapa} onChange={e => setPipeForm(f => ({ ...f, etapa: e.target.value }))} style={inputStyle}>
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
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch", scrollSnapType: isMobile ? "x mandatory" : undefined }}>
        {ETAPAS.map((col, colIdx) => {
          const items = pipeline.filter(p => p.etapa === col.id);
          const isCuello = col.id === "esperando_voz" && items.length >= 3;
          return (
            <div key={col.id}
              onDragOver={e => { if (dragId) e.preventDefault(); }}
              onDrop={() => { const it = pipeline.find(p => p.id === dragId); if (it) moveStage(it, col.id); setDragId(null); }}
              style={{
                minWidth: isMobile ? "82vw" : 235, width: isMobile ? "82vw" : 235, maxWidth: isMobile ? 300 : undefined, flexShrink: 0,
                scrollSnapAlign: isMobile ? "start" : undefined,
                borderRadius: 14, padding: 10,
                background: isLight ? "rgba(15,23,42,0.028)" : "rgba(255,255,255,0.022)",
                border: `1px solid ${isCuello ? `${RED}55` : bd}`,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px" }}>
                {col.id === "esperando_voz" && <Mic size={13} color={isCuello ? RED : txt2} />}
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: isCuello ? RED : txt2, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.04em" }}>{col.l}</span>
                <span style={{
                  minWidth: 20, height: 20, borderRadius: 999, padding: "0 5px",
                  background: isCuello ? RED : (isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.08)"),
                  color: isCuello ? "#fff" : txt2, fontSize: 11, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{items.length}</span>
              </div>
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
                      <div style={{ flex: 1, fontSize: 12.5, color: txt, fontWeight: 500, lineHeight: 1.3 }}>{it.nombre}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {it.locacion && <span style={{ fontSize: 10.5, color: txt2, padding: "2px 8px", borderRadius: 999, background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)", border: `1px solid ${bd}` }}>{it.locacion}</span>}
                      {it.fecha_rodaje && (
                        <span style={{ fontSize: 10.5, color: it.fecha_rodaje === hoy ? accent : txt3, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <CalendarDays size={10} /> {fmtDia(it.fecha_rodaje)}
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      {it.drive_url && <a href={it.drive_url} target="_blank" rel="noreferrer" title="Drive" style={{ color: txt3, display: "flex" }}><Folder size={13} /></a>}
                      {it.ig_url && <a href={it.ig_url} target="_blank" rel="noreferrer" title="Ver publicación" style={{ color: txt3, display: "flex" }}><ExternalLink size={13} /></a>}
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
              {items.length === 0 && <div style={{ fontSize: 11, color: txt3, textAlign: "center", padding: "14px 0" }}>—</div>}
            </div>
          );
        })}
      </div>
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
      <span style={{ padding: "2px 9px", borderRadius: 7, fontSize: 10.5, fontWeight: 800, fontFamily: font, color, border: `1px solid ${color}55`, background: `${c === "A" ? "transparent" : color + "14"}` }}>{c}</span>
    );
  };

  const filteredReqs = useMemo(() => requests.filter(r => {
    if (!reqSearch) return true;
    const q = reqSearch.toLowerCase();
    return [r.titulo, r.detalle, r.objetivo, brandById[r.brand_id]?.nombre, nameOf(r.solicitante), nameOf(r.assignee_id)]
      .some(s => String(s || "").toLowerCase().includes(q));
  }), [requests, reqSearch, brandById, nameOf]);

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
            <select value={reqForm.brand} onChange={e => setReqForm(f => ({ ...f, brand: e.target.value }))} style={inputStyle}>
              <option value="">Marca…</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: txt2 }}>Complejidad:</span>
            {["A", "AA", "AAA"].map(c => (
              <button key={c} onClick={() => setReqForm(f => ({ ...f, complejidad: c }))} style={{
                padding: "6px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: font,
                border: `1px solid ${reqForm.complejidad === c ? accent : bd}`,
                background: reqForm.complejidad === c ? `${accent}18` : "transparent",
                color: reqForm.complejidad === c ? accent : txt2,
              }}>{c}</button>
            ))}
            <span style={{ fontSize: 10.5, color: txt3 }}>A = simple · AAA = producción compleja (fija expectativas)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 2fr", gap: 8 }}>
            <input type="date" title="Fecha de entrega" value={reqForm.entrega} onChange={e => setReqForm(f => ({ ...f, entrega: e.target.value }))} style={inputStyle} />
            <select value={reqForm.assignee} onChange={e => setReqForm(f => ({ ...f, assignee: e.target.value }))} style={inputStyle}>
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
        <div key={r.id} style={{ ...card, borderRadius: 14, padding: "12px 15px", display: "flex", alignItems: "center", gap: 11, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 0 }}>
            <div style={{ fontSize: 13.5, color: txt, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {r.titulo} {cplxBadge(r.complejidad)}
            </div>
            <div style={{ fontSize: 11.5, color: txt3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span>{nameOf(r.solicitante)} → {r.assignee_id ? nameOf(r.assignee_id) : "sin asignar"}</span>
              {r.fecha_entrega && <span>· entrega {fmtDia(r.fecha_entrega)}</span>}
              {r.objetivo && <span>· {r.objetivo}</span>}
            </div>
            {r.detalle && <div style={{ fontSize: 11.5, color: txt2, marginTop: 3 }}>{r.detalle}</div>}
            {r.ref_image_url && (
              <a href={r.ref_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: accent, textDecoration: "none" }}>Ver referencia →</a>
            )}
          </div>
          {brandChip(r.brand_id)}
          <select value={r.estado} onChange={async e => {
            const estado = e.target.value;
            const ok = await patch("mkt_requests", r.id, { estado });
            if (ok) setRequests(prev => prev.map(x => x.id === r.id ? { ...x, estado } : x));
          }} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 11.5 }}>
            {REQ_STATES.map(s => <option key={s.id} value={s.id}>{s.l}</option>)}
          </select>
        </div>
      ))}
    </div>
  );

  /* ════════════════════ TAB: EQUIPO (solo admin) ════════════════════ */

  const equipo = () => {
    const week = Date.now() - 7 * 86400000;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {assignees.length === 0 && emptyRow("Sin usuarios con rol marketing en la organización.")}
        {assignees.map(m => {
          const tt = tasks.filter(t => t.assignee_id === m.id);
          const enCurso  = tt.filter(t => t.estado !== "hecha" && !isBlocked(t)).length;
          const bloq     = tt.filter(t => t.estado !== "hecha" && isBlocked(t)).length;
          const venc     = tt.filter(t => t.estado !== "hecha" && t.due_at && dayStr(t.due_at) < hoy).length;
          const hechas7  = tt.filter(t => t.estado === "hecha" && t.updated_at && new Date(t.updated_at).getTime() > week).length;
          const stat = (label, n, color) => (
            <div key={label} style={{ textAlign: "center", minWidth: isMobile ? 0 : 74, flex: isMobile ? "1 1 0" : "0 0 auto" }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: color || txt, fontFamily: fontDisp }}>{n}</div>
              <div style={{ fontSize: 10.5, color: txt3 }}>{label}</div>
            </div>
          );
          return (
            <div key={m.id} style={{ ...card, borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${accent}16`, border: `1px solid ${accent}40`, color: accent, fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
              }}>{String(m.name || "?").charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 13.5, color: txt, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: txt3 }}>{m.id === user?.id ? "tú" : "marketing"}</div>
              </div>
              {/* Stats: en móvil ocupan su propia fila a lo ancho, repartidas parejas */}
              <div style={{ display: "flex", gap: isMobile ? 4 : 10, flex: isMobile ? "1 1 100%" : "0 0 auto", justifyContent: isMobile ? "space-between" : "flex-end" }}>
                {stat("En curso", enCurso)}
                {stat("Bloqueadas", bloq, bloq > 0 ? AMBER : undefined)}
                {stat("Vencidas", venc, venc > 0 ? RED : undefined)}
                {stat("Hechas · 7d", hechas7, hechas7 > 0 ? accent : undefined)}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: txt3, textAlign: "center" }}>
          Los conteos salen de las tareas del módulo. Vista solo para administración.
        </div>
      </div>
    );
  };

  /* ════════════════════ Render ════════════════════ */

  const esperandoVoz = pipeline.filter(p => p.etapa === "esperando_voz").length;

  const firstName = String(user?.name || "").split(" ")[0] || "Marketing";
  // Título + explicación EN SIMPLE por sección (la gente no es técnica: cada tab
  // se explica sola — pedido de Ángel 21-jul).
  const TAB_META = {
    dia:         { title: `Hoy — ${firstName}`, sub: "Tu enfoque del día · lo vencido arriba, lo bloqueado no depende de ti" },
    marcas:      { title: "Marcas",       sub: "Los proyectos de cada marca — la barra muestra cuánto va completado" },
    pipeline:    { title: "Pipeline",     sub: "El tablero de los videos de propiedades — cada tarjeta avanza de izquierda a derecha hasta Publicada" },
    solicitudes: { title: "Solicitudes",  sub: "Pedidos de diseño para el equipo — A es simple, AAA es producción compleja" },
    equipo:      { title: "Equipo",       sub: "Cómo va cada persona — en curso, bloqueadas, vencidas y hechas de la semana" },
  };
  const meta = TAB_META[tab] || TAB_META.dia;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: txt, fontFamily: font, maxWidth: 1180, width: "100%", margin: "0 auto", overflowX: "hidden" }}>
      {/* Fila 1 — identidad del espacio + tabs segmentados (estilo mockup aprobado).
          En móvil se apila: identidad arriba, tabs a lo ancho abajo (scroll horizontal limpio). */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}33` }}>
            <Megaphone size={20} color={accent} strokeWidth={1.9} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 650, color: txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Mi Espacio</div>
            <div style={{ fontSize: 11.5, color: txt2 }}>{firstName} · Marketing</div>
          </div>
        </div>
        {!isMobile && <div style={{ flex: 1 }} />}
        <div style={{
          display: "flex", gap: 3, padding: 5, borderRadius: 16, overflowX: "auto", WebkitOverflowScrolling: "touch",
          background: isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.035)", border: `1px solid ${bd}`,
          maxWidth: "100%", width: isMobile ? "100%" : undefined,
        }}>
          {tabBtn("dia", "Mi Día")}
          {tabBtn("marcas", "Marcas")}
          {tabBtn("pipeline", "Pipeline", esperandoVoz >= 3 ? esperandoVoz : 0)}
          {tabBtn("solicitudes", "Solicitudes", requests.filter(r => r.estado === "nueva").length)}
          {isAdmin && tabBtn("equipo", "Equipo")}
        </div>
      </div>

      {/* Fila 2 — título de la sección + acciones */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 21 : 26, fontFamily: fontDisp, fontWeight: 600, letterSpacing: "-0.02em", color: txt }}>
            {meta.title}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: txt2, maxWidth: 640 }}>{meta.sub}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} title="Actualizar" style={{ background: glass, border: `1px solid ${bd}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: txt2, display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          {onOpenCopilot && (
            <button onClick={onOpenCopilot} title="Crear con voz — díctale al Copilot" style={{
              background: "transparent", border: `1px solid ${accent}55`, borderRadius: 10, padding: "9px 15px",
              cursor: "pointer", color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: font,
              display: "flex", alignItems: "center", gap: 7,
            }}><Mic size={14} /> {isMobile ? "Voz" : "Crear con voz"}</button>
          )}
        </div>
      </div>

      {evidence && (
        <div style={{ ...card, borderColor: `${accent}44`, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Check size={16} color={accent} strokeWidth={2.5} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, color: txt, fontWeight: 600 }}>«{evidence.task.titulo}» completada</div>
            <div style={{ fontSize: 11.5, color: txt2, marginTop: 2 }}>Si tienes alguna evidencia (foto, video o link), envíala — suma a tu reporte. Es opcional.</div>
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
          {tab === "dia" && miDia()}
          {tab === "marcas" && marcas()}
          {tab === "pipeline" && pipelineTab()}
          {tab === "solicitudes" && solicitudes()}
          {tab === "equipo" && isAdmin && equipo()}
        </>
      )}
    </div>
  );
}
