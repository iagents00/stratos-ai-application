/**
 * CRM/index.jsx — Orquestador principal del módulo CRM
 * Los sub-componentes viven en ./components.jsx
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../hooks/useAuth";
import { supabase } from "../../../lib/supabase";
import { updateOfflineLead } from "../../../lib/offline-mode";
import { saveLead, findLeadDuplicate } from "../../../lib/lead-save";
import { saveDraft as saveLeadDraft, saveDraftImmediate as saveLeadDraftImmediate, loadDraft as loadLeadDraft, clearDraft as clearLeadDraft } from "../../../lib/lead-draft";
import {
  TrendingUp, Target, CheckCircle2, Mic, Search,
  Users, Building2, Send, Plus, Timer, Flame,
  Trophy, User, DollarSign, Zap, Phone,
  CalendarDays, FileText, ChevronRight, ChevronLeft,
  Settings, X, Atom, Signal,
  Activity, Clock, Eye, MessageCircle,
  Star, Waypoints,
  AlertCircle, AlertTriangle,
  CheckSquare, Wand2,
  Copy, Check, Trash2,
  ChevronDown, ChevronUp,
  FilePlus, RefreshCw, ListChecks,
  UserCheck, List, Mail,
  Save, Minus,
  History as HistoryIcon,
  Video
} from "lucide-react";
import { useIsMobile } from "../../../hooks/useViewport";
import { useClient } from "../../../hooks/useClient";
import { P, LP, font, fontDisp } from "../../../design-system/tokens";
import { G, KPI, Pill, Ico, ChipSelect } from "../../SharedComponents";
import { parseBudget, formatBudget, buildTelegramSummary, fmtNow, genId, formatFechaLarga, compareZoomProximity, fmtFechaCortaISO } from "../../../lib/utils";
import { StratosAtom, StratosAtomHex } from "../../components/Logo";
import HistoryDrawer from "../../components/HistoryDrawer";
import SuggestActionsModal from "../../components/SuggestActionsModal";
import { AI_AGENTS, AI_AGENT_LIST } from "../../constants/agents";
// Pipeline + vocabulario activos resueltos por cliente. Para Duke devuelven
// exactamente STAGES/stgC/labels históricos; Vega usa su pipeline y "proyecto".
import { STAGES, stgC, DEFAULT_STAGE } from "../../constants/pipeline";
import { L } from "../../constants/labels";
import {
  calculateLeadScore,
  SRC_META, SourceBadge,
  ScoreInput, ScoreBar,
  StageBadge,
  FollowUpBadge,
  NextActionHero,
  DRAWER_TABS, DrawerTabIsland,
  UpdateChatPanel,
  InlineEdit,
  TaskChecklist,
  ActionTimeline,
  COACHING_MOCKS, NotesModal,
  LeadPanel,
  AnalysisDrawer,
  ClickDropdown,
  hashAsesorColor, asesorInitials,
} from "./components";
import AdvisorMetrics from "./AdvisorMetrics";
import ScheduledCallBadge from "./ScheduledCallBadge";
import { zoomEventsOf } from "./zoom-metrics";
import { useScheduledCalls } from "../../../hooks/useScheduledCalls";

// Tamaño de "página" de render de la lista. La lista NO se virtualiza con una
// librería externa (regla del proyecto: no agregar deps sin confirmar). En su
// lugar hacemos windowing por scroll: pintamos LIST_PAGE filas y agregamos otra
// página al acercarse al fondo (IntersectionObserver). Así el DOM y el costo de
// render de React quedan acotados sin importar cuántos leads haya (594 hoy, 10k
// mañana). El filtro/orden/búsqueda siguen operando sobre el set COMPLETO; solo
// se acota lo que se PINTA. El contador "X resultados" muestra el total real.
const LIST_PAGE = 60;

// Checkbox de selección para la reasignación por lote. Definido a nivel de
// módulo (no dentro de CRM) para que NO se remonte en cada render — si se
// define inline, React lo trata como un tipo nuevo cada render y desmonta/
// remonta los ~60 checkboxes de la lista en cada cambio de estado.
const SelectCheck = ({ checked, indeterminate = false, onToggle, title, size = 19, T = P, isLight = false }) => {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      title={title}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0,
        background: on ? T.accent : (isLight ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)"),
        border: `1.5px solid ${on ? T.accent : (isLight ? "rgba(15,23,42,0.24)" : "rgba(255,255,255,0.24)")}`,
        boxShadow: on ? `0 0 0 3px ${T.accent}22` : "none",
        transition: "background 0.14s, border-color 0.14s, box-shadow 0.14s",
      }}
    >
      {indeterminate
        ? <Minus size={Math.round(size * 0.62)} strokeWidth={3.5} color="#fff" />
        : checked ? <Check size={Math.round(size * 0.62)} strokeWidth={3.5} color="#fff" /> : null}
    </button>
  );
};

// Tope de tarjetas renderizadas por columna del Kanban. Una columna con miles
// de tarjetas es inmanejable y costosa de montar; mostramos las primeras y un
// pie "+N más → usa Lista". El total y el monto del encabezado siguen siendo
// exactos (se calculan sobre el set completo).
const KANBAN_COL_CAP = 50;

// useDebounced — difiere la actualización de `value` hasta `ms` ms después del
// último cambio. La búsqueda del CRM lo usa para no re-filtrar ni re-renderizar
// la lista en cada tecla (con miles de leads, eso congela el tipeo). El input
// del campo sigue instantáneo; solo el cómputo pesado (sortedLeads) consume el
// valor diferido.
function useDebounced(value, ms = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function CRM({ oc, co, leadsData, setLeadsData, theme = "dark", setTheme = () => {}, autoOpenPriority1 = 0, onAutoOpenHandled, softDeleteLead, autoOpenLead = null, onAutoOpenLeadHandled = () => {} }) {
  const { user } = useAuth();
  const { config: clientConfig, clientId } = useClient();
  const { get: getScheduledCall } = useScheduledCalls();
  const isMobile = useIsMobile();
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  // Roles administrativos (director hacia arriba) ven todos los leads de la
  // organización POR DEFECTO. Excepción: si el admin tiene view_all_leads
  // explícitamente en false, queda restringido a sus propios leads (opt-out).
  // Esto permite cuentas con poderes admin pero sin visibilidad de leads
  // ajenos (ej. iagents@stratos.ai). Los asesores pueden hacer opt-in al
  // ver-todo seteando view_all_leads=true.
  //
  // NOTA: este filtro es SOLO de UI. El RLS de Supabase (leads_select) sigue
  // permitiendo que estos admins consulten todos los leads vía API directa.
  // Para restringir a nivel DB, hay que modificar la policy `leads_select`.
  const isAdminRole = ["super_admin", "admin", "ceo", "director"].includes(user?.role);
  const canSeeAll = (isAdminRole && user?.viewAllLeads !== false)
                 || user?.viewAllLeads === true;
  // Reasignación habilitada para todos los usuarios. La RLS de Supabase
  // (leads_update en migración 004_performance_tuning) ya asegura que un
  // asesor solo puede modificar leads donde `asesor_name = current_user_name()`,
  // así que un asesor puede transferir SUS leads pero no tocar los de otros.
  // El componente AsesorPicker avisa antes de transferir un lead propio
  // (la RLS le retirará acceso al lead después de la mutación).
  const canReassign = true;
  // Reasignación POR LOTE (selección múltiple → un asesor destino). Es una
  // acción de gestión: distribuir/repartir leads entre el equipo. Solo la
  // ofrecemos a quien ve todos los leads (admin/director). La RLS de Supabase
  // (leads_update) igual valida permisos por fila, así que es seguro.
  const canBulkReassign = canSeeAll;
  // Orden por defecto: fecha de creación descendente (los más recientes
  // arriba). Antes era "sc desc" (score), lo que hacía que un lead recién
  // registrado con score bajo (5 por default) cayera abajo en cuanto se
  // limpiaba la flag `isNew` a los 20s. Ahora los nuevos siempre quedan
  // arriba sin importar su score.
  const [sortField, setSortField]       = useState("fechaIngreso");
  const [sortDir, setSortDir]           = useState("desc");
  const [filterStage, setFilterStage]   = useState("TODO");
  const [filterAsesor, setFilterAsesor] = useState("TODO");
  const [searchQ, setSearchQ]           = useState("");
  // searchQ alimenta el input (instantáneo). El filtrado pesado de sortedLeads
  // usa la versión debounced para no recalcular en cada tecla con miles de leads.
  const debouncedSearch = useDebounced(searchQ, 200);
  // Windowing de la lista: cuántas filas renderizar (crece al hacer scroll).
  const [listLimit, setListLimit]       = useState(LIST_PAGE);
  const listSentinelRef = useRef(null);
  const [viewMode, setViewMode]         = useState("list");
  // En mobile el kanban es virtualmente inusable (columnas chicas, drag&drop
  // bloqueado en touch). Forzamos lista — el stage strip horizontal ya da
  // visibilidad por etapa.
  const effectiveViewMode = isMobile ? "list" : viewMode;
  const [selectedLead, setSelectedLead] = useState(null);
  const [notesLead, setNotesLead]       = useState(null);
  const [analyzingLead, setAnalyzingLead] = useState(null);
  const [historyLead, setHistoryLead]   = useState(null);
  const [suggestLead, setSuggestLead]   = useState(null);
  // Lead activo en cualquiera de los 3 drawers — base para el botón "Historial"
  const activeDrawerLead = analyzingLead || selectedLead || notesLead;

  // Apertura del expediente pedida desde OTRO módulo (ej. click en el nombre
  // del cliente en la bandeja de WhatsApp). Nonce {id, ts}: espera a que el
  // lead esté en leadsData (por si el CRM recién carga) y abre el MISMO panel
  // que un click en la fila (NotesModal).
  const autoOpenHandledRef = useRef(0);
  useEffect(() => {
    if (!autoOpenLead?.id || !autoOpenLead?.ts) return;
    if (autoOpenHandledRef.current === autoOpenLead.ts) return;
    const lead = leadsData.find((l) => l.id === autoOpenLead.id);
    if (!lead) return; // leadsData aún cargando: reintenta cuando cambie
    autoOpenHandledRef.current = autoOpenLead.ts;
    setNotesLead(lead);
    // Avisar al App para que limpie el nonce — sin esto, el CRM se desmonta al
    // cambiar de vista y al volver re-abriría este expediente para siempre.
    onAutoOpenLeadHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenLead?.ts, leadsData]);

  // ID del último cliente registrado en esta sesión. Determina el lead con
  // pulso animado + posición #1 garantizada. Decae a los 10 s (sólo afecta
  // la animación; el halo estático persiste mientras isNew=true).
  // Se declara aquí — antes que sortedLeads — para evitar TDZ.
  const [justRegisteredId, setJustRegisteredId] = useState(null);
  // Edición inline de la fecha/hora de la cita desde la fila del lead.
  // Solo una fila puede estar en modo edición a la vez. Click en el pill
  // de cita (o en el CTA "Sin fecha · agendar") activa el input.
  const [editingApptId, setEditingApptId] = useState(null);
  const [apptDraft, setApptDraft]         = useState("");
  const justRegisteredTimer = useRef(null);

  // ── Selección múltiple para reasignación por lote ───────────────────────
  // selectedIds: Set de lead.id marcados con el checkbox. Cuando hay ≥1,
  // aparece una barra flotante con "Reasignar". El modal pide el asesor
  // destino y (por defecto) mueve los leads a "Contáctame Ya" para que el
  // nuevo asesor los vea al inicio de su pipeline. La propagación al asesor
  // destino es automática vía realtime (App.jsx → handler UPDATE agrega el
  // lead si no lo tenía). Reusa updateLead, así que hereda RLS + auto-log.
  const [selectedIds, setSelectedIds]           = useState(() => new Set());
  const [reassignOpen, setReassignOpen]         = useState(false);
  const [reassignTarget, setReassignTarget]     = useState("");
  const [reassignQ, setReassignQ]               = useState("");
  const [reassignToContactame, setReassignToContactame] = useState(true);
  // Default del checkbox "mover a Contactame Ya" al reasignar. Cliente puede
  // override en su config (crm.bulkReassignToContactameByDefault: false) para
  // que la reasignacion preserve la etapa original en vez de resetear.
  const bulkReassignToContactameDefault =
    clientConfig?.crm?.bulkReassignToContactameByDefault !== false;
  // Modo "reasignar varios": se activa con un botón en la barra de herramientas.
  // Mientras está activo, la columna de Acciones muestra un checkbox por fila
  // (a la derecha, no a la izquierda) y aparece una barra para reasignar el grupo.
  const [bulkMode, setBulkMode] = useState(false);

  // ── Duración del halo verde ──────────────────────────────────────
  // El aura verde menta dura ~20 segundos desde que aparece el lead
  // como isNew. Después se limpia automáticamente y la fila se ve como
  // cualquier otra. updateLead propaga is_new=false a Supabase para que
  // no reaparezca al refrescar.
  const HALO_DURATION_MS = 20000;
  // Timestamp de "primera vista" por lead — registrado cuando aparece
  // por primera vez como isNew=true en esta sesión.
  const haloFirstSeenRef = useRef({});
  // Timers de auto-clear pendientes — cancelables si el lead deja de ser
  // isNew antes (p.ej. otro dispositivo lo limpió o un updateLead).
  const haloTimersRef = useRef({});

  // Para cada lead que es isNew, registrar firstSeen y programar
  // auto-clear después de HALO_DURATION_MS desde que se vio por
  // primera vez. Si ya pasó ese tiempo (refresh tardío), limpiar
  // inmediatamente.
  useEffect(() => {
    const seen = haloFirstSeenRef.current;
    const timers = haloTimersRef.current;
    const now = Date.now();
    leadsData.forEach(l => {
      if (!l.isNew) return;
      if (!seen[l.id]) seen[l.id] = now;
      if (timers[l.id]) return; // ya hay timer agendado
      const elapsed = now - seen[l.id];
      const remaining = Math.max(0, HALO_DURATION_MS - elapsed);
      timers[l.id] = setTimeout(() => {
        delete timers[l.id];
        const current = leadsDataRef.current.find(x => x.id === l.id);
        if (current?.isNew) updateLead({ ...current, isNew: false });
      }, remaining);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsData]);

  // Cleanup de timers al desmontar — separado del effect de programación
  // para no cancelarlos en cada cambio de leadsData.
  useEffect(() => () => {
    Object.values(haloTimersRef.current).forEach(t => clearTimeout(t));
    haloTimersRef.current = {};
  }, []);

  useEffect(() => {
    if (!autoOpenPriority1) return;
    const lead = priorityLeadsRef.current[0];
    // Abrir directo en Expediente — donde el asesor ve notas + próxima acción + historial.
    // El switcher inferior le permite saltar a Perfil o Análisis IA si lo necesita.
    if (lead) { setSelectedLead(null); setAnalyzingLead(null); setNotesLead(lead); }
    onAutoOpenHandled?.();
  }, [autoOpenPriority1]); // priorityLeadsRef is a ref, always current
  const [addingLead, setAddingLead]     = useState(false);
  // Vista "Indicadores de Asesores" — solo se ofrece si el cliente activo
  // tiene crm.advisorMetricsTab=true Y el usuario es admin/director/super_admin/ceo.
  const [showMetrics, setShowMetrics]   = useState(false);
  const metricsTabEnabled = clientConfig?.crm?.advisorMetricsTab === true && canSeeAll;
  // Bloqueo de doble submit:
  //   · submittingRef    → guard SÍNCRONO. Imprescindible porque React
  //     useState es async: 10 clics en el mismo tick verían el state
  //     viejo y todos pasarían. useRef.current se actualiza al instante.
  //   · submittingLead   → mismo flag pero como state, sólo para que el
  //     botón se pinte deshabilitado (no protege del race; el ref sí).
  const submittingRef                   = useRef(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [copiedId, setCopiedId]         = useState(null);
  const [saveToast, setSaveToast]       = useState(null); // { msg, type }
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type = "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setSaveToast({ msg, type });
    toastTimer.current = setTimeout(() => setSaveToast(null), 4000);
  }, []);
  const [budgetMenuOpen, setBudgetMenuOpen] = useState(false);
  const [stageMenuOpen, setStageMenuOpen]   = useState(false);
  const [newLead, setNewLead]           = useState({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", source: "manual", st: DEFAULT_STAGE, nextAction: "", notas: "" });
  // ── Detección de duplicados en alta ────────────────────────────────────
  // Cuando el asesor escribe phone o email, llamamos a la RPC find_lead_duplicate
  // (migración 013) con debounce. Si encuentra un lead existente en la misma
  // organización, mostramos un banner avisando quién lo tiene. El check es
  // SECURITY DEFINER, así que ve leads de otros asesores que RLS oculta.
  //
  // duplicateMatch shape: { lead_id, lead_name, lead_stage, lead_created_at,
  //                          asesor_id, asesor_name, is_mine, match_type } | null
  // duplicateChecking: hay una request en vuelo (para mostrar spinner sutil).
  // duplicateOverride: el usuario confirmó "registrar de todas formas".
  const [duplicateMatch, setDuplicateMatch]     = useState(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [duplicateOverride, setDuplicateOverride] = useState(false);
  const duplicateAbortRef = useRef(null);
  // ── Listas maestras de asesores y proyectos ──
  // Se alimentan de leadsData + registros "custom" hechos desde el modal.
  // Al registrar un nuevo asesor/proyecto desde el modal, se añade aquí para
  // que esté disponible en el próximo alta sin necesidad de volver a teclearlo.
  const [customAsesores, setCustomAsesores]   = useState([]);
  const [customProyectos, setCustomProyectos] = useState([]);
  const [customCampanas, setCustomCampanas]   = useState([]);
  // hoveredRow state ELIMINADO — causaba re-render de toda la lista de leads
  // (80+ rows) cada vez que el cursor pasaba de una fila a otra. Ahora el
  // hover visual se maneja con DOM directo en onMouseEnter/Leave, sin
  // setState ni re-render. Para visibility de chips/botones, todo es visible
  // siempre (más intuitivo, no hace falta descubrir nada con hover).
  // Edición inline de "próxima acción" en tarjetas de prioridad — sincroniza
  // estado con el lead activo y se cierra al guardar/cancelar.
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionDraft, setActionDraft]         = useState({ a: "", d: "" });
  const startInlineAction = (lead) => {
    setActionDraft({ a: lead.nextAction || "", d: lead.nextActionDate || "" });
    setEditingActionId(lead.id);
  };
  const saveInlineAction = (lead) => {
    // updateLead detecta automáticamente el cambio de nextAction y registra
    // la acción anterior en el historial del expediente.
    updateLead({ ...lead, nextAction: actionDraft.a.trim(), nextActionDate: actionDraft.d.trim() });
    setEditingActionId(null);
  };
  const cancelInlineAction = () => setEditingActionId(null);

  const [zoomSchedulingLead, setZoomSchedulingLead] = useState(null);
  const [visitaSchedulingLead, setVisitaSchedulingLead] = useState(null);

  const cancelZoomScheduling = () => {
    // Alta de cliente NUEVO: no hay nada que revertir en la lista (aún no se
    // creó). Reabrimos el formulario con el draft intacto para que el usuario
    // elija otra etapa o defina la cita.
    if (zoomSchedulingLead?.isNewLead) {
      setZoomSchedulingLead(null);
      setAddingLead(true);
      return;
    }
    if (zoomSchedulingLead) {
      const { lead, originalStage } = zoomSchedulingLead;
      const revertedLead = { ...lead, st: originalStage };
      leadsDataRef.current = leadsDataRef.current.map(l => l.id === revertedLead.id ? revertedLead : l);
      setLeadsData(prev => prev.map(l => l.id === revertedLead.id ? revertedLead : l));
      if (selectedLead?.id === revertedLead.id) setSelectedLead(revertedLead);
      if (notesLead?.id === revertedLead.id) setNotesLead(revertedLead);
      if (analyzingLead?.id === revertedLead.id) setAnalyzingLead(revertedLead);
    }
    setZoomSchedulingLead(null);
  };

  const confirmZoomScheduling = (dateTimeString, actionText) => {
    if (!zoomSchedulingLead) return;
    // Alta de un cliente NUEVO cuya etapa inicial es "Zoom Agendado": todavía no
    // existe en la lista, así que completamos el alta embebiendo la cita.
    if (zoomSchedulingLead.isNewLead) {
      setZoomSchedulingLead(null);
      finalizeAddLead({ dateTimeString, actionText });
      return;
    }
    const { lead } = zoomSchedulingLead;
    const formattedDateTime = dateTimeString.replace("T", " ");

    // Instante real de la cita. Es la fuente de verdad para mostrar la fecha y
    // ordenar por proximidad (igual que selected_time/next_action_at del backend).
    // dateTimeString viene del input datetime-local (hora local del asesor).
    let nextActionAtISO = null;
    try { nextActionAtISO = new Date(dateTimeString).toISOString(); } catch (_) { /* fecha inválida → null */ }

    // Display "con palabras" para que el cliente/asesor lea la fecha clara
    // (ej. "Sábado, 20 de junio, 2:30 p.m."). El crudo queda en next_action_date.
    const finalizedLead = {
      ...lead,
      st: "Zoom Agendado",
      nextAction: actionText || "Zoom",
      nextActionDate: formatFechaLarga(dateTimeString) || formattedDateTime,
      next_action_date: formattedDateTime,
      next_action_at: nextActionAtISO,
      _zoomConfirmed: true,
    };

    updateLead(finalizedLead);
    setZoomSchedulingLead(null);
  };

  // ── Visita Agendada: cita obligatoria (paridad con Zoom) ─────────────────
  // Sin fecha (visita_at) no salen los avisos −1mes/−15d/−7d que encola
  // fn_proactive_scan_visitas. Por eso se bloquea el cambio de etapa hasta
  // que el asesor define la fecha, igual que con "Zoom Agendado".
  const cancelVisitaScheduling = () => {
    if (visitaSchedulingLead) {
      const { lead, originalStage } = visitaSchedulingLead;
      const revertedLead = { ...lead, st: originalStage };
      leadsDataRef.current = leadsDataRef.current.map(l => l.id === revertedLead.id ? revertedLead : l);
      setLeadsData(prev => prev.map(l => l.id === revertedLead.id ? revertedLead : l));
      if (selectedLead?.id === revertedLead.id) setSelectedLead(revertedLead);
      if (notesLead?.id === revertedLead.id) setNotesLead(revertedLead);
      if (analyzingLead?.id === revertedLead.id) setAnalyzingLead(revertedLead);
    }
    setVisitaSchedulingLead(null);
  };

  const confirmVisitaScheduling = (dateTimeString) => {
    if (!visitaSchedulingLead) return;
    const { lead } = visitaSchedulingLead;
    // Instante real de la visita (ISO, hora local del asesor). Es lo que lee
    // fn_proactive_scan_visitas para encolar los avisos.
    let visitaAtISO = null;
    try { visitaAtISO = new Date(dateTimeString).toISOString(); } catch (_) { /* fecha inválida → null */ }
    const finalizedLead = {
      ...lead,
      st: "Visita Agendada",
      visita_at: visitaAtISO,
      _visitaConfirmed: true,
    };
    updateLead(finalizedLead);
    setVisitaSchedulingLead(null);
  };


  // Reset dropdowns cuando se cierra el modal
  useEffect(() => {
    if (!addingLead) {
      setBudgetMenuOpen(false);
      setStageMenuOpen(false);
      // Limpiar estado de duplicados al cerrar — la próxima vez que se abra,
      // empezamos en blanco (sin "fantasma" del cliente anterior).
      setDuplicateMatch(null);
      setDuplicateChecking(false);
      setDuplicateOverride(false);
      if (duplicateAbortRef.current) {
        try { duplicateAbortRef.current.abort(); } catch (_) {}
        duplicateAbortRef.current = null;
      }
    } else {
      // Modal recién abierto: si hay un draft persistido (TTL 24h), restaurarlo.
      // Esto cubre el caso "el browser crasheó / cerré el tab a medio escribir".
      // El draft solo se restaura si tiene contenido más allá del default.
      try {
        const stored = loadLeadDraft();
        if (stored?.draft && typeof stored.draft === "object") {
          // Solo restaurar si NO se está empezando con datos limpios.
          const incoming = stored.draft;
          const hasMeaningful = (incoming.n && incoming.n.trim().length > 0)
            || (incoming.phone && incoming.phone.trim().length > 0)
            || (incoming.email && incoming.email.trim().length > 0)
            || (incoming.notas && incoming.notas.trim().length > 0);
          if (hasMeaningful) {
            setNewLead(prev => ({ ...prev, ...incoming }));
          }
        }
      } catch (_) { /* ignore */ }
    }
  }, [addingLead]);

  // ── Autosave del draft del modal ──────────────────────────────────────────
  // En cada cambio del draft, persistir con debounce 400ms. Si el browser
  // crashea o el tab se cierra accidentalmente, al re-abrir el modal el
  // useEffect de arriba restaura el draft (TTL 24h en lead-draft.js).
  useEffect(() => {
    if (!addingLead) return;
    saveLeadDraft(newLead);
  }, [addingLead, newLead]);

  // ── Persistencia AGRESIVA al perder visibilidad ──────────────────────────
  // visibilitychange / pagehide se disparan ANTES del unload del tab. Aquí
  // forzamos un flush sin debounce para garantizar que la última versión
  // del draft queda guardada — incluso si el debounce de 400ms no alcanzó.
  useEffect(() => {
    if (!addingLead) return;
    const flush = () => { saveLeadDraftImmediate(newLead); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [addingLead, newLead]);

  // ── Debounced duplicate check ─────────────────────────────────────────
  // Se dispara cuando addingLead está abierto y el usuario cambia phone o
  // email. Cancela request previa con AbortController para evitar race
  // condition (la respuesta de un input viejo no debe pisar la del actual).
  // Skip explícito si:
  //   · El modal no está abierto
  //   · El usuario es demo (no toca Supabase)
  //   · Ambos campos están vacíos
  const dupEmail = newLead.email;
  const dupPhone = newLead.phone;
  useEffect(() => {
    if (!addingLead) return;
    if (user?.id === 'demo-user-local' || user?.isDemo) return;
    const e = (dupEmail || '').trim();
    const p = (dupPhone || '').trim();
    // Resetear si vaciaron ambos
    if (!e && !p) {
      setDuplicateMatch(null);
      setDuplicateChecking(false);
      setDuplicateOverride(false);
      return;
    }
    // Email muy corto (sin '@') o phone con < 7 dígitos: aún no vale la pena buscar
    const phoneDigits = p.replace(/\D/g, '');
    const emailReady  = e.includes('@') && e.length >= 5;
    const phoneReady  = phoneDigits.length >= 7;
    if (!emailReady && !phoneReady) {
      setDuplicateMatch(null);
      setDuplicateChecking(false);
      return;
    }

    // Si lo que tenemos ahora ya no coincide con el match cacheado, lo limpiamos
    // optimísticamente para no mostrar info stale mientras hace la nueva query.
    setDuplicateOverride(false);

    const ctrl = new AbortController();
    if (duplicateAbortRef.current) {
      try { duplicateAbortRef.current.abort(); } catch (_) {}
    }
    duplicateAbortRef.current = ctrl;

    setDuplicateChecking(true);
    const t = setTimeout(async () => {
      const { match } = await findLeadDuplicate(
        supabase,
        { email: emailReady ? e : null, phone: phoneReady ? p : null },
        { signal: ctrl.signal }
      );
      if (ctrl.signal.aborted) return;
      setDuplicateMatch(match);
      setDuplicateChecking(false);
    }, 400);

    return () => {
      clearTimeout(t);
      try { ctrl.abort(); } catch (_) {}
    };
  }, [addingLead, dupEmail, dupPhone, user?.id, user?.isDemo]);

  const [dragLeadId, setDragLeadId]     = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const kanbanRef = useRef(null);
  const [kanbanScrollPos, setKanbanScrollPos] = useState(0);

  // visibleLeads — leads accesibles según el rol del usuario.
  // Un lead es "mío" si me pertenece por asesor_id (UUID) O por asesor_name.
  // CLAVE: la RLS del servidor (leads_select, migración 005) ya entrega al
  // asesor SOLO los leads donde `asesor_name = current_user_name()`. Por eso
  // este filtro de cliente debe estar en PARIDAD con esa regla — si fuera más
  // estricto, escondería leads que el servidor sí considera del asesor.
  //
  // Antes este filtro era exclusivo (`asesor_id ? id===me : name===me`), lo que
  // causaba un bug de trazabilidad al reasignar: al transferir un lead a otro
  // asesor se cambia `asesor_name` pero el `asesor_id` podía quedar viejo (el
  // del asesor anterior) hasta que el trigger de la DB lo resincronizara. El
  // nuevo asesor recibía el lead por RLS (nombre) pero el filtro lo escondía
  // porque el `asesor_id` no coincidía → no salía en pipeline ni buscador (solo
  // lo encontraba el detector de duplicados, que ignora RLS) y sus notas
  // "desaparecían". Con OR (id || nombre) el lead reaparece apenas la RLS lo
  // entrega, sin depender de que asesor_id ya esté resincronizado.
  // useMemo: para admins devuelve la referencia estable de leadsData; para
  // asesores recalcula el filtro solo cuando cambian leadsData o el usuario,
  // no en cada render. Mantener la referencia estable evita que asesores/
  // sortedLeads/asesoresMaster recalculen de más con miles de leads.
  const visibleLeads = useMemo(() => (
    canSeeAll
      ? leadsData
      : leadsData.filter(l =>
          (l.asesor_id && user?.id && l.asesor_id === user.id)
          || (l.asesor && user?.name && l.asesor === user.name)
        )
  ), [canSeeAll, leadsData, user?.id, user?.name]);

  // leadsDataRef — fuente de verdad síncrona del array de leads.
  // Antes, updateLead() usaba `leadsData.find()` capturado en closure, lo que
  // producía datos stale si dos updates al mismo lead llegaban en el mismo
  // tick (ej. drag&drop + autosave). Con la ref, cada updateLead lee siempre
  // el snapshot más reciente y aplica auto-log + score sobre el estado actual.
  const leadsDataRef = useRef(leadsData);
  useEffect(() => { leadsDataRef.current = leadsData; }, [leadsData]);

  // updateLead — actualiza lead local + persiste en Supabase.
  //
  // Auto-log al historial del expediente — ocurre transparentemente, sin flags:
  //   · Si cambia nextAction y había una previa → se registra la previa como "completada".
  //   · Si nextAction se define por primera vez → se registra como "registrada".
  //   · Si seguimientos sube en +1 → se registra "Seguimiento #N".
  //   · Si cambia la etapa (st) → se registra el cambio de etapa.
  //
  // opts.skipAutoLog = true → desactiva el auto-log (útil para imports masivos
  // o ediciones que ya traen su propio actionHistory explícito).
  const updateLead = (updated, { skipAutoLog = false } = {}) => {
    // Interceptor para Zoom Agendado obligatorio en Stratos (aplica a todos los asesores)
    const prev = leadsDataRef.current.find(l => l.id === updated.id);
    const isTargetClient = true; // Aplica para todo Stratos
    const isChangingToZoom = updated.st === "Zoom Agendado" && prev?.st !== "Zoom Agendado";

    if (isTargetClient && isChangingToZoom && !updated._zoomConfirmed) {
      console.log("[ZoomInterceptor] Cambiando a Zoom Agendado. Bloqueando y abriendo modal...");
      setZoomSchedulingLead({
        lead: updated,
        originalStage: prev?.st || "Contáctame Ya",
      });
      return;
    }

    const isConfirmingZoom = updated.st === "Zoom Concretado" && prev?.st !== "Zoom Concretado";
    if (isConfirmingZoom) {
      const notes = (updated.notas ?? prev?.notas ?? "").trim();
      const nextAction = (updated.nextAction ?? updated.next_action ?? prev?.nextAction ?? "").trim();
      if (!notes || !nextAction) {
        setNotesLead(prev || updated);
        showToast(
          !notes && !nextAction
            ? "Antes de confirmar el Zoom registra las notas y la próxima acción."
            : !notes
              ? "Antes de confirmar el Zoom registra las notas de la sesión."
              : "Antes de confirmar el Zoom registra la próxima acción.",
          "error",
        );
        return;
      }
    }

    // Interceptor paralelo: "Visita Agendada" exige fecha/hora (visita_at) →
    // sin eso no salen los avisos −1mes/−15d/−7d (fn_proactive_scan_visitas).
    const isChangingToVisita = updated.st === "Visita Agendada" && prev?.st !== "Visita Agendada";
    if (isTargetClient && isChangingToVisita && !updated._visitaConfirmed) {
      setVisitaSchedulingLead({
        lead: updated,
        originalStage: prev?.st || "Contáctame Ya",
      });
      return;
    }

    if (prioritySort === "manual" && priorityOrder.length === 0) {
      const snap = priorityLeadsRef.current.map(l => l.id);
      if (snap.length > 0) setPriorityOrder(snap);
    }
    // Lectura del prev desde la ref (ya obtenida al inicio de la función).

    // ── Auto-log de eventos relevantes al historial ──────────────────────
    // Si el caller ya pasó un actionHistory explícito (ej: TaskChecklist al
    // completar una tarea), respetamos su decisión y NO añadimos eventos extra.
    const callerProvidedHistory = Array.isArray(updated.actionHistory)
      && updated.actionHistory !== prev?.actionHistory;
    const baseHistory = Array.isArray(updated.actionHistory)
      ? updated.actionHistory
      : (Array.isArray(prev?.actionHistory) ? prev.actionHistory : []);
    let newHistory = baseHistory;

    if (!skipAutoLog && !callerProvidedHistory && prev) {
      const events = [];
      const nowFmt = fmtNow();
      const nowIso = new Date().toISOString();
      const by     = user?.name || null;

      const prevAction = (prev.nextAction || "").trim();
      const newAction  = (updated.nextAction || "").trim();
      // 1) Cambio de próxima acción
      if (newAction && prevAction && newAction !== prevAction) {
        events.push({
          id: genId(),
          type: "completada",
          action: prevAction,
          date: prev.nextActionDate || "",
          doneAtFmt: nowFmt,
          completed_at: nowIso,
          by,
        });
      }
      // 1b) Primera vez que se define una próxima acción
      else if (newAction && !prevAction) {
        events.push({
          id: genId(),
          type: "registrada",
          action: `Próxima acción registrada: ${newAction}`,
          date: updated.nextActionDate || "",
          doneAtFmt: nowFmt,
          completed_at: nowIso,
          by,
        });
      }

      // 2) Incremento de seguimientos
      const prevSeg = prev.seguimientos || 0;
      const newSeg  = updated.seguimientos ?? prevSeg;
      if (newSeg > prevSeg) {
        // Pueden subir varios a la vez (raro, pero posible) — un evento por bump
        for (let i = prevSeg + 1; i <= newSeg; i++) {
          events.push({
            id: genId(),
            type: "seguimiento",
            action: `Seguimiento #${i} registrado`,
            doneAtFmt: nowFmt,
            completed_at: nowIso,
            by,
          });
        }
      }

      // 3) Cambio de etapa (CRM stage)
      if (updated.st && prev.st && updated.st !== prev.st) {
        events.push({
          id: genId(),
          type: "etapa",
          action: `Etapa: ${prev.st} → ${updated.st}`,
          doneAtFmt: nowFmt,
          completed_at: nowIso,
          by,
        });
      }

      // 4) Reasignación de asesor — visible en la timeline del lead
      if (updated.asesor && updated.asesor !== prev.asesor) {
        events.push({
          id: genId(),
          type: "reasignacion",
          action: prev.asesor
            ? `Reasignado: ${prev.asesor} → ${updated.asesor}`
            : `Asignado a ${updated.asesor}`,
          doneAtFmt: nowFmt,
          completed_at: nowIso,
          by,
        });
      }

      if (events.length > 0) {
        // Más reciente arriba; si hubo varios eventos en este update, conservamos
        // su orden lógico (acción, seguimiento, etapa) en el tope.
        newHistory = [...events, ...baseHistory];
      }
    }

    const segDelta = (updated.seguimientos || 0) - (prev?.seguimientos || 0);
    const baseSc   = updated.sc ?? prev?.sc ?? 0;
    const newSc    = Math.max(0, Math.min(100, baseSc + segDelta));

    // Reasignación de asesor — la sincronización de asesor_id ↔ asesor_name la
    // hace el trigger leads_sync_asesor_id de la migración 012. Aquí solo
    // pasamos asesor_name; la DB resuelve el UUID correcto desde profiles.
    // Si vino asesor_id explícito, lo respetamos (caso del bot).
    //
    // IMPORTANTE: si el NOMBRE del asesor cambió y no nos dieron un asesor_id
    // explícito, NO arrastramos `prev.asesor_id` — sería el id del asesor
    // ANTERIOR, dejando la fila inconsistente (asesor_name nuevo + asesor_id
    // viejo). Eso rompía la trazabilidad: el bot (que usa asesor_id) seguía
    // viendo al asesor viejo. Mandamos null y el trigger fija el UUID correcto.
    const asesorChanged = (updated.asesor ?? null) !== (prev?.asesor ?? null);
    const resolvedAsesorId =
      updated.asesor_id ?? (asesorChanged ? null : prev?.asesor_id) ?? null;

    const withScore = {
      ...updated,
      sc: newSc,
      actionHistory: newHistory,
      asesor_id: resolvedAsesorId,
    };

    // ── Reasignación a otro asesor: ¿este usuario pierde acceso? ─────────
    // Las RLS (leads_select/update) filtran por asesor_name = current_user_name.
    // Un asesor no-admin que transfiere su lead a otro deja de poder leerlo
    // después del UPDATE — debemos removerlo del state local inmediatamente y
    // cerrar cualquier drawer abierto sobre él, o queda fantasma hasta refetch.
    const losesAccess =
      !canSeeAll &&
      prev?.asesor &&
      prev.asesor === user?.name &&
      withScore.asesor &&
      withScore.asesor !== user?.name;

    if (losesAccess) {
      leadsDataRef.current = leadsDataRef.current.filter(l => l.id !== withScore.id);
      setLeadsData(prev => prev.filter(l => l.id !== withScore.id));
      if (selectedLead?.id  === withScore.id) setSelectedLead(null);
      if (notesLead?.id     === withScore.id) setNotesLead(null);
      if (analyzingLead?.id === withScore.id) setAnalyzingLead(null);
      // Limpia también los IDs de pinned/dismissed/priority order si quedaron.
      setPinnedIds(prev => { if (!prev.has(withScore.id)) return prev; const n = new Set(prev); n.delete(withScore.id); return n; });
      setDismissedIds(prev => { if (!prev.has(withScore.id)) return prev; const n = new Set(prev); n.delete(withScore.id); return n; });
    } else {
      // Update normal: replace en state, sync drawers abiertos.
      leadsDataRef.current = leadsDataRef.current.map(l => l.id === withScore.id ? withScore : l);
      setLeadsData(prev => prev.map(l => l.id === withScore.id ? withScore : l));
      if (selectedLead?.id   === withScore.id) setSelectedLead(withScore);
      if (notesLead?.id      === withScore.id) setNotesLead(withScore);
      if (analyzingLead?.id  === withScore.id) setAnalyzingLead(withScore);
    }

    // ── Modo demo — NO persistir en Supabase ─────────────────────────
    // Los leads demo tienen IDs numéricos ("1","2","5") que no son UUIDs,
    // y el demo user no debe escribir en la base de datos real.
    if (user?.id === 'demo-user-local' || user?.isDemo) {
      return;
    }

    const payload = {
      name:             withScore.n ?? withScore.name,
      stage:            withScore.st ?? withScore.stage,
      score:            withScore.sc,
      hot:              withScore.hot,
      is_new:           withScore.isNew ?? withScore.is_new ?? false,
      budget:           withScore.budget,
      presupuesto:      withScore.presupuesto || 0,
      project:          withScore.p ?? withScore.project,
      campaign:         withScore.campana ?? withScore.campaign,
      source:           withScore.source,
      next_action:      withScore.nextAction ?? withScore.next_action,
      // Camel primero: las ediciones inline setean `nextActionDate` (el valor que
      // teclea el asesor) y debe ganar. La fecha de la cita NO depende de este
      // campo — vive en `next_action_at` (abajo), que es la fuente de verdad para
      // mostrarla con palabras y ordenar. Por eso aquí no hay que proteger el
      // datetime crudo: aunque se guarde la versión larga, no rompe el orden.
      next_action_date: withScore.nextActionDate ?? withScore.next_action_date,
      // Instante real de la cita (Zoom/visita). Se preserva el valor previo si
      // este update no lo trae, para no borrar la cita que registró el backend
      // (fn_register_appointment) en una edición no relacionada.
      next_action_at:   (() => {
        // Si la edición trae una fecha ISO/datetime-local en nextActionDate, la
        // usamos como el instante real. Antes la edición solo guardaba
        // next_action_date (texto) y NO next_action_at; como el display de las
        // etapas-con-cita (normalizeLeads) lee next_action_at, la fecha "volvía"
        // a la vieja al recargar. Texto libre / no-fecha → se preserva el previo.
        const _ed = String(withScore.nextActionDate ?? '');
        const _m = _ed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
        if (_m) { try { return new Date(`${_m[1]}T${_m[2]}`).toISOString(); } catch (_) {} }
        return withScore.next_action_at ?? prev?.next_action_at ?? null;
      })(),
      // Instante real de la visita (etapa "Visita Agendada"). Se preserva el
      // valor previo si este update no lo trae (igual que next_action_at), para
      // no borrar la cita en ediciones no relacionadas.
      visita_at:        withScore.visita_at ?? prev?.visita_at ?? null,
      last_activity:    withScore.lastActivity ?? withScore.last_activity,
      days_inactive:    withScore.daysInactive ?? withScore.days_inactive ?? 0,
      seguimientos:     withScore.seguimientos ?? 0,
      bio:              withScore.bio,
      risk:             withScore.risk,
      friction:         withScore.friction,
      tag:              withScore.tag,
      ai_agent:         withScore.aiAgent ?? withScore.ai_agent,
      priority:         withScore.priority,
      priority_order:   withScore.priority_order,
      asesor_name:      withScore.asesor,
      asesor_id:        withScore.asesor_id ?? null,
      phone:            withScore.phone,
      email:            withScore.email,
      // ── Nuevos campos de historial / tareas ─────────────────────────────
      // Requieren columnas JSONB en Supabase:
      //   ALTER TABLE leads ADD COLUMN action_history jsonb DEFAULT '[]';
      //   ALTER TABLE leads ADD COLUMN tasks jsonb DEFAULT '[]';
      action_history:   newHistory,
      tasks:            Array.isArray(withScore.tasks) ? withScore.tasks : [],
      playbook:         Array.isArray(withScore.playbook) ? withScore.playbook : [],
    };

    // notas: SOLO se persiste si cambió respecto a la copia en memoria. Evita que una
    // edición de etapa / próxima acción (que arrastra una copia vieja del lead con
    // notas=null) PISE la nota que el bot agregó por Telegram — bug reportado: la nota
    // del registro desaparecía del expediente principal. El guardado explícito de notas
    // (saveNotes) sí manda un valor distinto → se persiste normal.
    if ((withScore.notas ?? '') !== (prev?.notas ?? '')) {
      payload.notas = withScore.notas;
    }

    // ── Modo offline: encolar el cambio en localStorage ─────────────────
    if (user?._offline) {
      updateOfflineLead(withScore.id, payload, user);
      return;
    }

    // Persistir en Supabase (sin bloquear la UI)
    // Para asesores: experiencia totalmente silenciosa. Si Supabase falla,
    // se encola en localStorage y se sincroniza después sin que se enteren.
    // Para admins: ven mensajes técnicos para diagnóstico.
    const isAdminUser = ["super_admin", "admin", "ceo"].includes(user?.role);
    supabase.from('leads').update(payload).eq('id', withScore.id).then(({ error }) => {
      if (error) {
        console.error('Error guardando lead:', error.message);
        if (user?.id) {
          updateOfflineLead(withScore.id, payload, user);
          if (isAdminUser) {
            showToast('Guardado localmente. Se sincronizará al volver Supabase.');
          }
          // Asesor: silencio total — el guardado fue exitoso desde su perspectiva.
        } else if (isAdminUser) {
          showToast(`Error al guardar "${withScore.n}": ${error.message}`);
        }
      }
    }).catch((err) => {
      console.error('Error de red al guardar lead:', err?.message);
      if (user?.id) {
        updateOfflineLead(withScore.id, payload, user);
        if (isAdminUser) {
          showToast('Sin conexión — guardado localmente, se sincronizará al volver.');
        }
      } else if (isAdminUser) {
        showToast('Sin conexión — verifica tu red e intenta de nuevo.');
      }
    });
  };
  // saveNotes — updateLead ya re-sincroniza notesLead/selectedLead/analyzingLead
  // con el resultado recomputado (score, actionHistory). El setNotesLead(u)
  // anterior pisaba ese resultado con el draft sin recomputar — bug latente.
  const saveNotes = (newNotas) => { updateLead({ ...notesLead, notas: newNotas }); };
  const copyLeadToClipboard = (lead) => {
    navigator.clipboard?.writeText(buildTelegramSummary(lead)).then(() => {
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  // Cliente con discoverySimplified=true → cualquier "abrir ficha del
  // lead" cae al NotesModal (Discovery), nunca al LeadPanel legacy con
  // sub-tabs Datos/Chat/Documentos. Helper único para que el listado y
  // los botones de "perfil" siempre rendericen el mismo drawer.
  const isDiscoverySimplified = clientConfig?.crm?.discoverySimplified === true;
  const openLeadDrawer = (lead) => {
    if (!lead) return;
    setAnalyzingLead(null);
    if (isDiscoverySimplified) {
      setSelectedLead(null);
      setNotesLead(lead);
    } else {
      setNotesLead(null);
      setSelectedLead(lead);
    }
  };

  // Click en la fila → abre el Discovery del cliente. Para que sea intuitivo,
  // basta con clickear el avatar (la inicial) o CUALQUIER zona "muerta" de la
  // fila (sin texto/números/controles). Si el click cae sobre un control
  // interactivo (botón, input, checkbox, campo editable inline, etc.) NO se
  // abre el Discovery: ese control conserva su comportamiento (editar, destacar,
  // reasignar, cambiar etapa…). Las celdas editables ya hacen stopPropagation;
  // este guard cubre además los botones de la columna de Acciones.
  const handleRowOpen = (e, lead) => {
    if (e.target.closest('button, input, select, textarea, a, [role="checkbox"], [contenteditable="true"]')) return;
    // Modo bulk reassign: clicar la fila la selecciona/deselecciona en vez
    // de abrir el drawer. Mejora UX porque el checkbox es muy chico.
    if (bulkMode && canBulkReassign) {
      toggleSelect(lead.id);
      return;
    }
    setNotesLead(lead);
  };

  // Switcher unificado del Dynamic Island — al cambiar de tab, cerramos el drawer
  // actual y abrimos el target con el MISMO lead.
  const openDrawerTab = (tab, lead) => {
    if (!lead) return;
    if (tab === "analisis") {
      setSelectedLead(null); setNotesLead(null); setAnalyzingLead(lead);
    } else if (tab === "perfil") {
      // En clientes simplified, "perfil" también cae al NotesModal —
      // ya no se expone el LeadPanel legacy.
      if (isDiscoverySimplified) {
        setAnalyzingLead(null); setSelectedLead(null); setNotesLead(lead);
      } else {
        setAnalyzingLead(null); setNotesLead(null); setSelectedLead(lead);
      }
    } else if (tab === "expediente" || tab === "discovery") {
      setAnalyzingLead(null); setSelectedLead(null); setNotesLead(lead);
    }
  };
  const handleDragStart = (e, id) => {
    setDragLeadId(id);
    e.dataTransfer.effectAllowed = "move";
    // Custom drag image for clarity
    const el = e.currentTarget;
    if (el) { e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20); }
  };
  const handleDragOver = (e, stage) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); };
  const handleDrop = (e, stage) => {
    e.preventDefault();
    if (dragLeadId) {
      const lead = leadsData.find(l => l.id === dragLeadId);
      if (lead && lead.st !== stage) updateLead({ ...lead, st: stage });
    }
    setDragLeadId(null);
    setDragOverStage(null);
  };
  const handleDragEnd = () => { setDragLeadId(null); setDragOverStage(null); };
  const [expandedPriority, setExpandedPriority] = useState(null);

  // ══════════════════════════════════════════════════════════════════════
  // PERSISTENCIA DE PREFERENCIAS CRM — Supabase como fuente de verdad
  // ══════════════════════════════════════════════════════════════════════
  // Antes: vivían en localStorage `stratos_crm_prio_<userId>` → no
  // sobrevivían cambios de dispositivo, modo incógnito, ni reinstalación.
  //
  // Ahora: profiles.crm_prefs (jsonb) guarda { pinned, pinnedOrder,
  // dismissed, order, prioritySort } por usuario. Se lee al login (auth.js
  // lo expone en user.crmPrefs) y se persiste con debounce de 600ms para
  // evitar saturar la red durante reordenamientos rápidos.
  //
  // Migración silenciosa: si el usuario tiene datos viejos en localStorage
  // y NO tiene aún crm_prefs server-side, los subimos al primer cambio.
  // Demo (sin id real) sigue usando localStorage como fallback.
  // ══════════════════════════════════════════════════════════════════════
  const prefsKey = user?.id ? `stratos_crm_prio_${user.id}` : null;

  // Defaults que se aplican cuando el usuario aún no tiene prefs guardadas.
  // sortField='fechaIngreso' desc → los leads que llegaron más recientemente
  // SIEMPRE arriba de la tabla (pedido explícito del cliente, jul-2026).
  const DEFAULT_PREFS = {
    pinned: [], pinnedOrder: [], dismissed: [], order: [], prioritySort: 'manual',
    customAsesores: [], customProyectos: [], customCampanas: [],
    sortField: 'fechaIngreso', sortDir: 'desc',
    filterStage: 'TODO', filterAsesor: 'TODO',
    viewMode: 'list',
  };

  const normalizePrefs = (raw) => {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
    return {
      pinned:          Array.isArray(raw.pinned)          ? raw.pinned          : [],
      pinnedOrder:     Array.isArray(raw.pinnedOrder)     ? raw.pinnedOrder     : [],
      dismissed:       Array.isArray(raw.dismissed)       ? raw.dismissed       : [],
      order:           Array.isArray(raw.order)           ? raw.order           : [],
      prioritySort:    typeof raw.prioritySort === 'string'   ? raw.prioritySort    : 'manual',
      customAsesores:  Array.isArray(raw.customAsesores)  ? raw.customAsesores  : [],
      customProyectos: Array.isArray(raw.customProyectos) ? raw.customProyectos : [],
      customCampanas:  Array.isArray(raw.customCampanas)  ? raw.customCampanas  : [],
      // El orden de la TABLA ya NO se lee de prefs guardadas (ni server ni
      // localStorage): el cliente pidió (jul-2026) que los leads recién
      // llegados estén SIEMPRE hasta arriba en cada carga, en toda cuenta y
      // dispositivo. Antes se respetaban órdenes guardados (proxZoom,
      // presupuesto, nombre, score…) y varios usuarios nunca veían los
      // recientes arriba. El selector y los headers siguen funcionando
      // durante la sesión; al recargar vuelve a "Más recientes".
      sortField:       'fechaIngreso',
      sortDir:         'desc',
      // Los filtros de etapa/asesor tampoco se restauran al abrir (misma
      // regla que el orden): un filtro guardado (p.ej. etapa "Contáctame Ya"
      // + asesor "Cecilia") ocultaba los leads recién llegados de los demás
      // asesores y el CRM parecía "desordenado" aunque el orden era correcto.
      // Abrir el CRM = ver TODO con lo más nuevo arriba. Durante la sesión
      // los filtros funcionan normal; al recargar se limpian.
      filterStage:     'TODO',
      filterAsesor:    'TODO',
      viewMode:        typeof raw.viewMode === 'string'       ? raw.viewMode        : 'list',
    };
  };

  const loadInitialPrefs = () => {
    // 1) Server-side (usuario real autenticado) — siempre prioritario
    const server = user?.crmPrefs;
    if (server && typeof server === 'object' && Object.keys(server).length > 0) {
      return normalizePrefs(server);
    }
    // 2) Fallback localStorage (legado o demo)
    if (!prefsKey) return { ...DEFAULT_PREFS };
    try {
      const raw = localStorage.getItem(prefsKey);
      if (!raw) return { ...DEFAULT_PREFS };
      return normalizePrefs(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_PREFS };
    }
  };

  const initialPrefs = useMemo(loadInitialPrefs, [user?.id, user?.crmPrefs]);
  const [pinnedIds,    setPinnedIds]    = useState(() => new Set(initialPrefs.pinned));
  const [pinnedOrder,  setPinnedOrder]  = useState(() => initialPrefs.pinnedOrder);
  const [dismissedIds, setDismissedIds] = useState(() => new Set(initialPrefs.dismissed));
  const [priorityOrder, setPriorityOrder] = useState(() => initialPrefs.order);
  const [prioritySort, setPrioritySort] = useState(() => initialPrefs.prioritySort);
  const [dragCardId,   setDragCardId]   = useState(null);
  const [dragInsertIdx, setDragInsertIdx] = useState(null);

  // Recargar prefs si cambia el usuario o sus crmPrefs server-side
  useEffect(() => {
    const p = loadInitialPrefs();
    setPinnedIds(new Set(p.pinned));
    setPinnedOrder(p.pinnedOrder);
    setDismissedIds(new Set(p.dismissed));
    setPriorityOrder(p.order);
    setPrioritySort(p.prioritySort);
    // Customs (asesor / proyecto / campaña) y vista — antes vivían en useState
    // efímero y se borraban al refrescar. Ahora persisten en crm_prefs.
    setCustomAsesores(p.customAsesores);
    setCustomProyectos(p.customProyectos);
    setCustomCampanas(p.customCampanas);
    setSortField(p.sortField);
    setSortDir(p.sortDir);
    setFilterStage(p.filterStage);
    setFilterAsesor(p.filterAsesor);
    setViewMode(p.viewMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Persistencia debounced (600ms) ──────────────────────────────────
  // Un drag&drop largo puede emitir 5-10 cambios de orden por segundo;
  // con debounce solo enviamos 1 UPDATE al final, ahorrando ancho de banda
  // y evitando rate-limits.
  const prefsSaveTimerRef = useRef(null);
  const prefsHydratedRef  = useRef(false);
  // Firma estable de los campos de prioridad que el bot de Telegram controla.
  // Sirve para distinguir el "eco" de nuestra propia escritura (a ignorar) de un
  // cambio externo real (a aplicar) en la suscripción realtime de más abajo.
  const lastWrittenPrioSigRef = useRef(null);
  const prioritySig = (raw) => {
    const p = normalizePrefs(raw);
    return JSON.stringify({
      pinned:       [...p.pinned].sort(),
      dismissed:    [...p.dismissed].sort(),
      pinnedOrder:  p.pinnedOrder,
      order:        p.order,
      prioritySort: p.prioritySort,
    });
  };
  useEffect(() => {
    if (!user?.id) return;
    // Skip el primer render para no escribir prefs inmediatamente al hidratar
    if (!prefsHydratedRef.current) { prefsHydratedRef.current = true; return; }

    const payload = {
      pinned:       [...pinnedIds],
      pinnedOrder,
      dismissed:    [...dismissedIds],
      order:        priorityOrder,
      prioritySort,
      // Persisten también las listas customs y la configuración de vista
      // del CRM. Antes se reseteaban a vacío/defaults en cada refresh.
      customAsesores,
      customProyectos,
      customCampanas,
      sortField,
      sortDir,
      filterStage,
      filterAsesor,
      viewMode,
    };

    // Cache local inmediato (resiliencia si Supabase está caído)
    if (prefsKey) {
      try { localStorage.setItem(prefsKey, JSON.stringify(payload)); } catch {}
    }

    // Demo no toca Supabase
    const isDemoUser = user.id === 'demo-user-local' || user.isDemo;
    if (isDemoUser) return;

    // Debounce 600ms — el último cambio gana
    clearTimeout(prefsSaveTimerRef.current);
    prefsSaveTimerRef.current = setTimeout(() => {
      // Registrar la firma que estamos a punto de escribir, para que la
      // suscripción realtime ignore el eco de nuestra propia escritura.
      lastWrittenPrioSigRef.current = prioritySig(payload);
      supabase
        .from('profiles')
        .update({ crm_prefs: payload })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) {
            // Silencioso — el localStorage ya guardó como fallback. Si Supabase
            // vuelve, el próximo cambio empuja el snapshot completo.
            console.warn('[Stratos] No se pudieron guardar prefs CRM:', error.message);
          }
        });
    }, 600);

    return () => clearTimeout(prefsSaveTimerRef.current);
  }, [user?.id, prefsKey, pinnedIds, pinnedOrder, dismissedIds, priorityOrder, prioritySort,
      customAsesores, customProyectos, customCampanas,
      sortField, sortDir, filterStage, filterAsesor, viewMode]);

  // ── Sincronización realtime de crm_prefs (gated por cliente) ───────────────
  // Sin esto, el front re-guarda su snapshot en memoria y pisa el reorden/pin
  // que el bot de Telegram escribe en profiles.crm_prefs (last-writer-wins).
  // Con la suscripción, cuando el bot reordena desde Telegram el CRM abierto lo
  // refleja en vivo. Solo mergeamos los campos de prioridad (el bot no toca
  // filtros/vista/customs). Default OFF; Duke lo prende en su config.
  const prefsRealtimeEnabled = clientConfig?.crm?.prefsRealtimeSync === true;
  useEffect(() => {
    if (!prefsRealtimeEnabled || !user?.id) return;
    const isDemoUser = user.id === 'demo-user-local' || user.isDemo;
    if (isDemoUser) return;

    const ch = supabase
      .channel(`crm_prefs_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const incoming = payload?.new?.crm_prefs;
          if (!incoming || typeof incoming !== 'object') return;
          // Ignorar el eco de nuestra propia escritura
          if (prioritySig(incoming) === lastWrittenPrioSigRef.current) return;
          // Cambio externo (bot de Telegram) → reflejarlo en vivo
          lastWrittenPrioSigRef.current = prioritySig(incoming);
          const p = normalizePrefs(incoming);
          setPinnedIds(new Set(p.pinned));
          setPinnedOrder(p.pinnedOrder);
          setDismissedIds(new Set(p.dismissed));
          setPriorityOrder(p.order);
          setPrioritySort(p.prioritySort);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsRealtimeEnabled, user?.id]);

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPinnedOrder(p => p.filter(x => x !== id));
        // Al despinear: removerlo también del orden manual para que no quede
        // "fantasma" ocupando una posición sin contenido visible.
        setPriorityOrder(p => p.filter(x => x !== id));
      } else {
        next.add(id);
        setDismissedIds(p => { const d = new Set(p); d.delete(id); return d; });
        setPinnedOrder(p => [...p.filter(x => x !== id), id]); // append → most recent last
        // FIX: el lead recién pinneado va AL INICIO de priorityOrder. Antes
        // sólo se actualizaba pinnedOrder/pinnedIds y, como priorityOrder
        // (modo "manual") usa indexOf, el lead nuevo quedaba con índice -1
        // → ordenado al FINAL del carrusel de prioridad. El cliente espera
        // lo contrario: al darle estrellita el cliente debe aparecer primero.
        setPriorityOrder(p => [id, ...p.filter(x => x !== id)]);
      }
      return next;
    });
    // Highlight inmediato + scroll al carousel — UX fluida
    triggerPriorityFocus(id);
  };
  const dismissPriority = (id) => {
    setDismissedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const asesores = useMemo(() => [...new Set(visibleLeads.map(l => l.asesor))], [visibleLeads]);
  // Listas maestras: únicas, sin vacíos, ordenadas alfabéticamente.
  // Se alimentan de leadsData (todos, no solo visibles — para que un director
  // también vea asesores completos) + customs añadidos desde el modal.
  const asesoresMaster = useMemo(() => {
    const set = new Set([...leadsData.map(l => l.asesor), ...customAsesores].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customAsesores]);
  const proyectosMaster = useMemo(() => {
    // Si el cliente declaró una lista curada en su config (ej. Grupo 28), esa
    // lista toma prioridad sobre los proyectos derivados de leads existentes.
    // Duke mantiene defaultProjects=[] → comportamiento histórico intacto.
    const curated = clientConfig?.crm?.defaultProjects;
    const useCurated = Array.isArray(curated) && curated.length > 0;
    const baseSource = useCurated
      ? [...curated, ...customProyectos]
      : [...leadsData.map(l => l.p), ...customProyectos];
    const set = new Set(baseSource.filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customProyectos, clientConfig]);
  // Campañas activas de marketing — las 3 campañas vigentes de Facebook Ads
  // están preregistradas para métricas consistentes. El asesor puede crear
  // campañas adicionales desde el modal si aparecen nuevas.
  const FB_CAMPAIGNS_BASE = [
    "Facebook Ads · Bay View Grand",
    "Facebook Ads · Cancún",
    "Facebook Ads · Tulum",
  ];
  const campanasMaster = useMemo(() => {
    const set = new Set([
      ...FB_CAMPAIGNS_BASE,
      ...leadsData.map(l => l.campana),
      ...customCampanas,
    ].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [leadsData, customCampanas]);



  const urgColor = (d) => d >= 10 ? T.violet : d >= 5 ? T.cyan : T.emerald;

  const sortedLeads = useMemo(() => {
    let data = visibleLeads.filter(l => {
      // Folding insensible a acentos: "hector zarate" debe encontrar a
      // "Héctor Zárate". Sin esto, .includes() compara é≠e y el asesor no
      // halla a sus propios leads con tildes (José, Hernández, Martínez…).
      const fold = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const q = fold(debouncedSearch);
      // Defensivo: cualquier campo puede venir null/undefined desde Supabase.
      // Antes: l.phone.includes(q) tiraba TypeError si phone era null y rompía
      // el render del CRM completo.
      const matchQ = !q
        || fold(l.n).includes(q)
        || String(l.phone || "").includes(q)
        || fold(l.asesor).includes(q)
        || fold(l.campana).includes(q)
        || fold(l.p).includes(q)
        || fold(l.tag).includes(q);
      // Búsqueda transversal: cuando el asesor escribe algo en el buscador,
      // busca en TODA su cuenta (todas las etapas y, para admins, todos los
      // asesores visibles), NO solo dentro de la etapa/asesor seleccionado en
      // las pestañas. Para un no-técnico es lo intuitivo: "buscar = encontrar
      // lo que tengo", no "buscar dentro de la pestaña abierta". Sin texto, las
      // pestañas de etapa/asesor filtran normal para navegar.
      const matchStage = !!q || filterStage === "TODO" || l.st === filterStage;
      const matchAsesor = !!q || filterAsesor === "TODO" || l.asesor === filterAsesor;
      return matchQ && matchStage && matchAsesor;
    });
    // Mapa de índice original → posición. Lo usamos como tiebreaker dentro
    // del grupo isNew: addNewLead prepende, así que el más reciente tiene
    // menor índice y queda #1 entre los recién registrados.
    const idxOf = new Map(data.map((l, i) => [l.id, i]));
    // "Ahora" estable para todo el sort por proximidad de Zoom (un solo Date.now
    // para que la comparación sea consistente y no cruce medianoche a mitad).
    const sortNow = Date.now();
    return [...data].sort((a, b) => {
      // 0. Cliente registrado en esta sesión SIEMPRE en posición #1.
      if (justRegisteredId && a.id === justRegisteredId) return -1;
      if (justRegisteredId && b.id === justRegisteredId) return 1;
      // "Más recientes" (el orden con el que SIEMPRE carga la tabla) es
      // ESTRICTO por llegada: sin saltos de grupo. Antes isNew y los pins
      // brincaban arriba y el cliente veía leads viejos tapando a los recién
      // llegados (pedido explícito jul-2026: los más recientes hasta arriba,
      // sin excepciones). El halo de "nuevo" y la estrella siguen visibles
      // en la fila; los pins conservan su efecto en el carrusel de prioridad
      // y en los demás órdenes del selector.
      if (sortField === "fechaIngreso") {
        const ar = a.created_at ? new Date(a.created_at).getTime() : 0;
        const br = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (ar !== br) return sortDir === "asc" ? ar - br : br - ar;
        return 0;
      }
      // 1. Clientes recién registrados (isNew=true) primero. Halo verde menta
      //    + posición arriba los hace inconfundibles. La marca se limpia
      //    cuando el asesor abre el lead (auto-clear via useEffect).
      const an = !!a.isNew;
      const bn = !!b.isNew;
      if (an !== bn) return an ? -1 : 1;
      // 1b. Entre dos isNew: el de menor índice original (= prepend reciente)
      //     queda primero — así el último registrado siempre lidera.
      if (an && bn) {
        const ai = idxOf.get(a.id) ?? 0;
        const bi = idxOf.get(b.id) ?? 0;
        if (ai !== bi) return ai - bi;
      }
      // 2. Después, los pinneados (estrella dorada).
      const ap = pinnedIds.has(a.id);
      const bp = pinnedIds.has(b.id);
      if (ap !== bp) return ap ? -1 : 1;
      if (ap && bp) {
        const ai = pinnedOrder.indexOf(a.id);
        const bi = pinnedOrder.indexOf(b.id);
        if (ai !== bi) return bi - ai; // mayor índice = más reciente = primero
      }
      // "Próximo Zoom" — orden por proximidad de la cita, agrupando por DÍA:
      // HOY arriba como bloque → días futuros → días pasados → sin cita al fondo
      // (compareZoomProximity, compartido con el panel). Ignora sortDir. Cuando
      // un lead no tiene cita (incl. clientes white-label sin Zoom), cae al grupo
      // final ordenado por recencia = el viejo "más reciente arriba".
      if (sortField === "proxZoom") {
        const c = compareZoomProximity(a, b, sortNow);
        if (c !== 0) return c;
        // tiebreak: lead más reciente primero
        const ar = a.created_at ? new Date(a.created_at).getTime() : 0;
        const br = b.created_at ? new Date(b.created_at).getTime() : 0;
        return br - ar;
      }
      let av = a[sortField], bv = b[sortField];
      // ("fechaIngreso" nunca llega aquí: se resuelve estricto arriba.)
      if (sortField === "presupuesto" || sortField === "sc" || sortField === "daysInactive") {
        av = Number(av) || 0; bv = Number(bv) || 0;
      } else {
        av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [visibleLeads, sortField, sortDir, filterStage, filterAsesor, debouncedSearch, pinnedIds, pinnedOrder]);

  // Windowing: reiniciar el límite de render cuando cambia el set de resultados
  // (búsqueda/filtro/orden), para no quedar pintando miles de filas tras filtrar.
  useEffect(() => { setListLimit(LIST_PAGE); }, [debouncedSearch, filterStage, filterAsesor, sortField, sortDir]);

  // Windowing: crecer el límite cuando el centinela del fondo entra en viewport.
  // rootMargin grande → precarga la siguiente página antes de llegar al borde,
  // así el scroll se siente continuo. Se re-observa si cambia el total.
  useEffect(() => {
    const el = listSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setListLimit(n => Math.min(n + LIST_PAGE, sortedLeads.length));
        }
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sortedLeads.length]);

  // El slice que efectivamente se pinta en la vista lista.
  const listLeads = useMemo(() => sortedLeads.slice(0, listLimit), [sortedLeads, listLimit]);

  // ── Reasignación ─────────────────────────────────────────────────────────
  // Dos formas, ambas reusan el MISMO modal + runReassign (que ya escribe en
  // lote vía fn_bulk_reassign_leads):
  //   1) Por fila: botón en la columna de Acciones (derecha) → reasigna ese lead.
  //   2) En grupo: botón "Reasignar varios" en la barra → activa bulkMode, los
  //      checkboxes aparecen en Acciones (derecha) y una barra reasigna el grupo.
  const clearSelection = () => setSelectedIds(new Set());
  const exitBulkMode = () => { setBulkMode(false); clearSelection(); };
  // Single: pre-selecciona un lead y abre el modal (sin entrar a bulkMode).
  const openReassignFor = (lead) => {
    setSelectedIds(new Set([lead.id]));
    setReassignTarget("");
    setReassignQ("");
    setReassignToContactame(bulkReassignToContactameDefault);
    setReassignOpen(true);
  };
  // Grupo: alterna la selección de un lead mientras bulkMode está activo.
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // "Seleccionar todos" opera sobre TODO el set filtrado (sortedLeads), no solo
  // las filas pintadas por el windowing. Memoizado para no recalcular O(N) en
  // cada render (hover, etc.).
  const allFilteredSelected  = useMemo(() => sortedLeads.length > 0 && sortedLeads.every(l => selectedIds.has(l.id)), [sortedLeads, selectedIds]);
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (sortedLeads.every(l => next.has(l.id))) sortedLeads.forEach(l => next.delete(l.id));
      else sortedLeads.forEach(l => next.add(l.id));
      return next;
    });
  };
  // Abre el modal con el grupo ya seleccionado (desde la barra de bulkMode).
  const openReassignGroup = () => {
    if (selectedIds.size === 0) return;
    setReassignTarget("");
    setReassignQ("");
    setReassignToContactame(bulkReassignToContactameDefault);
    setReassignOpen(true);
  };

  // Lista de asesores destino para el modal (filtrada por la búsqueda interna).
  const reassignOptions = useMemo(() => {
    const q = reassignQ.trim().toLowerCase();
    return asesoresMaster.filter(a => !q || a.toLowerCase().includes(q));
  }, [asesoresMaster, reassignQ]);

  // Reasignación MASIVA al asesor destino. A diferencia de la versión previa
  // (un updateLead por lead → N round-trips + N re-renders, inviable con miles),
  // hace UNA sola actualización optimista local + UNA sola escritura al backend
  // vía fn_bulk_reassign_leads. Los triggers de la DB resuelven asesor_id desde
  // asesor_name y auditan el cambio; la RLS valida permisos. Esto es lo que
  // mantiene la reasignación fluida incluso reasignando un grupo grande.
  const runReassign = async () => {
    const target = reassignTarget.trim();
    if (!target || selectedIds.size === 0) return;
    const toContactame = reassignToContactame;
    const ids = new Set(selectedIds);

    // Solo los que REALMENTE cambian (evita escrituras y echoes de realtime
    // inútiles). Snapshot desde la ref síncrona, no desde el render.
    const willChange = (l) => ids.has(l.id)
      && (l.asesor !== target || (toContactame && l.st !== "Contáctame Ya"));
    const originals = leadsDataRef.current.filter(willChange);
    const affectedIds = originals.map(l => l.id);
    const moved = affectedIds.length;

    // Cerrar modal + salir de selección múltiple + limpiar (ya se decidió).
    setReassignOpen(false);
    setReassignTarget("");
    setReassignQ("");
    clearSelection();
    setBulkMode(false);

    if (moved === 0) {
      showToast("Esos leads ya estaban con ese asesor", "success");
      return;
    }

    // ── 1 sola actualización optimista (no N) — clave para la fluidez ──
    const affectedSet = new Set(affectedIds);
    // Limpiamos asesor_id localmente: cambia el nombre del asesor, así que el
    // UUID viejo dejó de aplicar. El trigger/refetch fija el id canónico del
    // nuevo asesor; mientras tanto, el filtro visibleLeads cae al nombre (OR),
    // así que el destino lo ve igual y el origen lo deja de ver sin fantasmas.
    const applyLocal = (l) => affectedSet.has(l.id)
      ? { ...l, asesor: target, asesor_id: null, st: toContactame ? "Contáctame Ya" : l.st }
      : l;
    leadsDataRef.current = leadsDataRef.current.map(applyLocal);
    setLeadsData(prev => prev.map(applyLocal));
    showToast(
      `${moved} lead${moved !== 1 ? "s" : ""} reasignado${moved !== 1 ? "s" : ""} a ${target}${toContactame ? " · Contáctame Ya" : ""}`,
      "success"
    );

    // Modo demo / sin persistencia real → solo local.
    if (user?.id === 'demo-user-local' || user?.isDemo) return;

    // Cambios a persistir, en nombres de columna de la DB. El trigger
    // leads_sync_asesor_id resuelve asesor_id desde asesor_name en cada UPDATE,
    // así que con asesor_name (+ stage) alcanza — el mismo efecto que la RPC.
    const dbChanges = toContactame
      ? { asesor_name: target, stage: DEFAULT_STAGE }
      : { asesor_name: target };

    // ── Ya en modo offline ───────────────────────────────────────────────
    // No intentamos la RPC (Supabase no responde): encolamos cada lead en la
    // MISMA cola que updateLead (overlay en localStorage + stratos_pending_sync).
    // El auto-recovery de App.jsx la reaplica vía UPDATE en cuanto vuelve la
    // conexión. La UI ya quedó optimista y el overlay sobrevive al F5: nada se
    // pierde.
    if (user?._offline) {
      affectedIds.forEach(id => updateOfflineLead(id, dbChanges, user));
      showToast(`Sin conexión — ${moved} reasignado${moved !== 1 ? "s" : ""} local, se sincroniza al volver.`, "success");
      return;
    }

    // ── Online: UNA sola escritura vía la RPC bulk (atómica + auditada) ──
    try {
      const { error } = await supabase.rpc('fn_bulk_reassign_leads', {
        p_ids: affectedIds,
        p_asesor_name: target,
        p_to_contactame: toContactame,
      });
      if (error) throw error;
      // Éxito: el realtime + el refetch reconcilian el asesor_id canónico.
    } catch (e) {
      // SIN rollback — perder la reasignación sería peor que un sync diferido.
      // Encolamos cada lead (misma cola que updateLead); el auto-recovery
      // (cada 60 s / al recuperar foco) la reaplica vía UPDATE cuando Supabase
      // responde, y el trigger leads_sync_asesor_id fija asesor_id. La UI sigue
      // optimista y consistente. Si un op fallara 5 veces, va al dead-letter
      // (visible para admins), nunca a un loop silencioso.
      console.error('[Stratos] reasignación: RPC falló, encolando para sync diferido:', e?.message || e);
      affectedIds.forEach(id => updateOfflineLead(id, dbChanges, user));
      if (!navigator.onLine) {
        showToast(`Sin conexión — ${moved} reasignado${moved !== 1 ? "s" : ""} local, se sincroniza al volver.`, "success");
      }
      // Online con error transitorio: la cola + auto-recovery lo resuelven en
      // segundo plano; el toast de éxito optimista ya mostrado sigue válido.
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const addNewLead = async () => {
    if (!newLead.n.trim()) return;
    // Un admin DEBE asignar asesor: si no, el lead queda huérfano (sin dueño,
    // sin recordatorios proactivos). Bloqueamos el registro y avisamos.
    if (isAdminRole && !String(newLead.asesor || "").trim()) {
      showToast("Asigná un asesor para registrar el cliente.", "error");
      return;
    }
    // Guardia idempotente síncrona: si ya hay un submit en vuelo, ignoramos.
    // useRef se actualiza al instante; useState quedaría desfasado un render
    // y dejaría pasar todos los clics rápidos.
    if (submittingRef.current) return;

    // ── Guard de duplicado ────────────────────────────────────────────────
    // Si la RPC detectó un lead con mismo phone/email y el usuario NO ha
    // confirmado el override, bloqueamos el registro. El banner del modal
    // muestra el botón "Registrar de todas formas" que pone override=true.
    // Si el match es propio (is_mine), no bloqueamos pero el banner ya invita
    // a abrir la ficha en vez de duplicar.
    if (duplicateMatch && !duplicateOverride && !duplicateMatch.is_mine) {
      showToast(
        `Este cliente ya está registrado por ${duplicateMatch.asesor_name || 'otro asesor'}. Confirma el aviso del formulario antes de registrar.`,
        'error'
      );
      return;
    }

    // ── Override sobre lead de OTRO asesor → TRANSFERIR (no duplicar ni perder) ──
    // "Registrar de todas formas" sobre un cliente que ya tiene otro asesor MUEVE el
    // lead al asesor que lo registra (fn_claim_lead, org-scoped). Antes esto intentaba
    // INSERTAR y chocaba con el índice único de teléfono → la RPC fallaba → la app lo
    // tomaba como "sin conexión" y lo encolaba, pero el reintento volvía a chocar y el
    // lead se perdía. Ahora reasignamos el existente: queda con el nuevo asesor y se le
    // quita al anterior. NO toca el flujo de registro normal (solo override + no-mío).
    if (duplicateOverride && duplicateMatch && !duplicateMatch.is_mine && duplicateMatch.lead_id) {
      const targetAsesor = (newLead.asesor || user?.name || "").trim();
      if (!targetAsesor) {
        showToast("Asigná un asesor antes de transferir el cliente.", "error");
        return;
      }
      if (submittingRef.current) return;
      submittingRef.current = true; setSubmittingLead(true);
      try {
        const { error } = await supabase.rpc('fn_claim_lead', {
          p_lead_id: duplicateMatch.lead_id,
          p_asesor_name: targetAsesor,
          // Reasignar "de todas formas" SIEMPRE manda el lead a la 1ra etapa
          // "Contáctame Ya": el nuevo asesor arranca de cero y lo ubica fácil
          // (queda resaltado como nuevo — is_new=true lo pone fn_claim_lead).
          p_stage: 'Contáctame Ya',
        });
        if (error) throw error;
        showToast(`Cliente transferido a ${targetAsesor}. Aparece resaltado en "Contáctame Ya".`, "success");
        setAddingLead(false);
        setNewLead({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", source: "manual", st: DEFAULT_STAGE, nextAction: "", notas: "" });
        setDuplicateMatch(null); setDuplicateOverride(false); setDuplicateChecking(false);
        // El lead reclamado aparece en la lista del nuevo asesor vía realtime/refetch.
      } catch (e) {
        console.error('[Stratos] transferir (claim) lead falló:', e?.message || e);
        showToast(`No se pudo transferir el cliente: ${e?.message || 'error'}`, "error");
      } finally {
        submittingRef.current = false; setSubmittingLead(false);
      }
      return;
    }

    // ── Etapa inicial "Zoom Agendado" → pedir fecha/hora de la cita primero ──
    // Paridad con el interceptor de updateLead (al MOVER un lead existente a
    // "Zoom Agendado"): no creamos el cliente sin una cita definida. Abrimos el
    // MISMO modal de cita; el draft queda intacto en newLead por si se cancela.
    if ((newLead.st || "") === "Zoom Agendado") {
      setAddingLead(false);
      setStageMenuOpen(false);
      setBudgetMenuOpen(false);
      setZoomSchedulingLead({ lead: { n: newLead.n.trim() }, isNewLead: true });
      return;
    }

    await finalizeAddLead(null);
  };

  // finalizeAddLead — construye el payload + entry y persiste el lead nuevo.
  // zoomInfo (opcional) = { dateTimeString, actionText }: cuando la etapa inicial
  // es "Zoom Agendado" embebe la fecha/hora de la cita, igual que
  // confirmZoomScheduling hace al mover un lead existente.
  const finalizeAddLead = async (zoomInfo = null) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmittingLead(true);

    const now = new Date();
    const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const h = now.getHours(); const ampm = h >= 12 ? "pm" : "am"; const h12 = h % 12 || 12;
    const dateStr = `${now.getDate()} ${mos[now.getMonth()]}, ${h12}:${String(now.getMinutes()).padStart(2,"0")}${ampm}`;
    const parsedBudget = parseBudget(newLead.budget);
    const notasVal = newLead.notas?.trim()
      ? `📍 OBJETIVO\nPendiente — primer contacto.\n\n📋 NOTAS INICIALES\n${newLead.notas.trim()}\n\n⚡ PENDIENTE\nRealizar primer contacto y calificar necesidades.`
      : `📍 OBJETIVO\nPendiente — primer contacto.\n\n⚡ PENDIENTE\nRealizar primer contacto y calificar necesidades del cliente.`;

    // ── Id estable generado en cliente ─────────────────────────────────
    // Se usa como PK al insertar (la RPC create_lead lo respeta con
    // ON CONFLICT DO NOTHING) y como id del entry local. Si por cualquier
    // razón saveLead se llama 2 veces con este mismo id, sólo crea fila
    // la primera. Sin esto, cada clic generaría un id distinto y la BD
    // crearía un lead nuevo por clic.
    const localId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Capturamos el draft antes de limpiarlo (el setState es async).
    const draft = newLead;
    const isDemo = user?.id === 'demo-user-local' || user?.isDemo;

    // ── Cita del Zoom (solo si la etapa inicial es "Zoom Agendado") ─────────
    // next_action_at es el instante real (ISO); next_action_date guarda el
    // datetime crudo ("YYYY-MM-DD HH:MM"). El RPC create_lead persiste
    // next_action_date, y el fetch/orden reconstruyen la fecha desde ahí
    // (fallback de getZoomTime / formatFechaLarga). `display` va "con palabras".
    let zoomFields = null;
    if (zoomInfo?.dateTimeString) {
      const rawDateTime = zoomInfo.dateTimeString.replace("T", " ");
      let nextActionAtISO = null;
      try { nextActionAtISO = new Date(zoomInfo.dateTimeString).toISOString(); } catch (_) { /* fecha inválida → null */ }
      zoomFields = {
        nextAction: (zoomInfo.actionText || "").trim() || "Zoom",
        display: formatFechaLarga(zoomInfo.dateTimeString) || rawDateTime,
        rawDateTime,
        nextActionAtISO,
      };
    }

    const payload = {
      id:               localId,
      name:             draft.n.trim(),
      phone:            draft.phone || null,
      email:            draft.email || null,
      stage:            draft.st || DEFAULT_STAGE,
      score:            5,
      hot:              false,
      is_new:           true,
      budget:           parsedBudget ? formatBudget(parsedBudget) : (draft.budget || ""),
      presupuesto:      parsedBudget || 0,
      project:          draft.p || null,
      campaign:         draft.campana || null,
      source:           draft.source || "manual",
      next_action:      zoomFields ? zoomFields.nextAction : (draft.nextAction?.trim() || "Primer contacto en las próximas 24 horas"),
      next_action_date: zoomFields ? zoomFields.rawDateTime : "Hoy",
      // El RPC create_lead (mig. 008) hoy NO persiste next_action_at; lo mandamos
      // igual por claridad/forward-compat. La fecha de la cita se preserva vía
      // next_action_date (crudo), de donde el fetch la reconstruye.
      next_action_at:   zoomFields ? zoomFields.nextActionAtISO : null,
      last_activity:    "Registro manual",
      days_inactive:    0,
      seguimientos:     0,
      bio:              "Cliente recién registrado. Pendiente primer contacto.",
      risk:             "Sin información suficiente aún.",
      friction:         "Medio",
      notas:            notasVal,
      tag:              draft.tag || null,
      asesor_name:      draft.asesor || user?.name || "",
      asesor_id:        user?.id || null,
    };

    // ── Entry local (lo que se pinta en la UI) ─────────────────────────
    const newEntry = {
      id: localId, ...draft, st: draft.st || DEFAULT_STAGE,
      sc: 5,
      source: draft.source || "manual",
      tag: draft.tag || draft.st || DEFAULT_STAGE, hot: false, isNew: true, fechaIngreso: dateStr,
      bio: "Cliente recién registrado. Pendiente primer contacto.", risk: "Sin información suficiente aún.",
      friction: "Medio",
      nextAction: zoomFields ? zoomFields.nextAction : (draft.nextAction?.trim() || "Primer contacto en las próximas 24 horas"),
      nextActionDate: zoomFields ? zoomFields.display : "Hoy",
      // Para getZoomTime / orden por proximidad sobre el objeto local recién creado.
      next_action_date: zoomFields ? zoomFields.rawDateTime : undefined,
      next_action_at: zoomFields ? zoomFields.nextActionAtISO : undefined,
      lastActivity: "Registro manual", daysInactive: 0,
      email: draft.email || "",
      notas: notasVal,
      presupuesto: parsedBudget,
      budget: parsedBudget ? formatBudget(parsedBudget) : (draft.budget || ""),
      actionHistory: [],
      tasks: [],
      playbook: [],
      asesor_id: user?.id || null,
    };

    // ═══════════════════════════════════════════════════════════════════
    // OPTIMISTIC UI — todo lo de abajo ocurre ANTES del await.
    // El usuario ve la confirmación instantánea (modal cierra, lead aparece,
    // toast se muestra). El insert real va en background; si falla, la cola
    // de retries de saveLead se encarga y muestra un toast secundario.
    // ═══════════════════════════════════════════════════════════════════

    // 1. Cerrar modal y limpiar el draft → el botón "Registrar" desaparece
    //    de la pantalla. Imposible hacer doble clic a partir de aquí.
    setAddingLead(false);
    setNewLead({ n: "", asesor: canSeeAll ? "" : (user?.name || ""), phone: "", email: "", budget: "", p: "", campana: "", source: "manual", st: DEFAULT_STAGE, nextAction: "", notas: "" });
    // El lead ya entró al espejo local (saveLead garantiza eso síncrono),
    // así que el draft de recovery ya no tiene utilidad — lo limpiamos.
    clearLeadDraft();

    // 2. Insertar el lead en la lista visible y disparar halo + scroll.
    setLeadsData(prev => [newEntry, ...prev]);
    if (justRegisteredTimer.current) clearTimeout(justRegisteredTimer.current);
    setJustRegisteredId(localId);
    justRegisteredTimer.current = setTimeout(() => setJustRegisteredId(null), HALO_DURATION_MS);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = document.querySelector(`[data-lead-row="${localId}"]`);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      triggerPriorityFocus(localId);
    }));

    // 3. Refrescar listas maestras (asesor/proyecto/campaña nuevos).
    if (draft.asesor && !leadsData.some(l => l.asesor === draft.asesor) && !customAsesores.includes(draft.asesor)) {
      setCustomAsesores(prev => [...prev, draft.asesor]);
    }
    if (draft.p && !leadsData.some(l => l.p === draft.p) && !customProyectos.includes(draft.p)) {
      setCustomProyectos(prev => [...prev, draft.p]);
    }
    if (draft.campana
        && !FB_CAMPAIGNS_BASE.includes(draft.campana)
        && !leadsData.some(l => l.campana === draft.campana)
        && !customCampanas.includes(draft.campana)) {
      setCustomCampanas(prev => [...prev, draft.campana]);
    }

    // 4. Toast optimista (asume éxito; si falla, otro toast lo corrige).
    showToast(`Cliente "${draft.n.trim()}" registrado.`, "success");

    // ═══════════════════════════════════════════════════════════════════
    // PERSISTENCIA EN BACKGROUND — el usuario ya vio su lead, ahora la
    // sincronización con Supabase. saveLead nunca lanza; siempre resuelve.
    // ═══════════════════════════════════════════════════════════════════
    try {
      const { savedToCloud, queuedForRetry, error: saveErr } =
        await saveLead(supabase, payload, user, { skipCloud: isDemo });
      if (!savedToCloud) {
        if (queuedForRetry) {
          // Timeout = el INSERT probablemente sí pasó pero la respuesta
          // tardó (cold-start de Supabase, red lenta). Mensaje calmado,
          // sin "Sin conexión". Otros errores (RLS, validación) sí
          // disparan el banner alarmante porque la red real está caída
          // o hay un problema de permisos.
          const isTimeout = typeof saveErr === "string" && saveErr.startsWith("Tiempo de espera");
          if (isTimeout) {
            showToast(`Guardando "${draft.n.trim()}"… terminamos en segundos.`);
          } else {
            showToast(`Sin conexión: el cliente "${draft.n.trim()}" se sincronizará automáticamente cuando vuelva la red.`);
          }
        } else if (saveErr && !isDemo) {
          showToast(`Aviso al guardar "${draft.n.trim()}": ${saveErr}`);
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmittingLead(false);
    }
  };

  const SH = ({ label, field, align = "left" }) => {
    const active = sortField === field;
    const justify = align === "right"  ? "flex-end"
                  : align === "center" ? "center"
                  :                      "flex-start";
    return (
      <span onClick={() => handleSort(field)} style={{
        cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3,
        justifyContent: justify,
        color: active ? T.accent : T.txt3, fontSize: 9.5, fontWeight: 700,
        fontFamily: fontDisp, letterSpacing: "0.07em", textTransform: "uppercase",
        transition: "color 0.15s",
      }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>
      </span>
    );
  };

  // Lead automáticamente "prioritario" en la cola del asesor.
  // Pipeline Mayo 2026: Zoom Agendado | Reactivar Zoom (antes "No Show") |
  // Apartó (milestone reciente) | Seguimiento activo (antes "Zoom Concretado").
  const isAutoPriority = (l) => (l.isNew || l.st === "Zoom Agendado" || l.st === "Reactivar Zoom" || l.st === "Apartó" || l.st === "Seguimiento" || l.hot || l.daysInactive <= 3) && !dismissedIds.has(l.id);
  const rawPriorityLeads = visibleLeads.filter(l => pinnedIds.has(l.id) || isAutoPriority(l));
  // Orden final: modo manual respeta drag & dropdown de posición; los demás aplican criterio
  const priorityLeadsFull = (() => {
    const arr = [...rawPriorityLeads];
    // recency basada en created_at (Supabase usa UUID como id, no integer
    // autoincremental, así que `b.id - a.id` daría NaN). Cae a 0 si falta.
    const recency = (l) => {
      // updated_at primero: un lead con CAMBIOS recientes (nota, etapa, reasignación,
      // nuevo registro) sube al tope del carrusel de prioridad — no solo los recién
      // CREADOS. Así el asesor encuentra fácil lo que se movió. (pedido Ángel 25-jun)
      const t = new Date(l.updated_at || l.updatedAt || l.created_at || l.createdAt || l.fechaIngreso || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    switch (prioritySort) {
      case "newest":
        // Pinned recently → first (pinnedOrder: last element = most recent pin)
        return arr.sort((a, b) => {
          const ai = pinnedOrder.indexOf(a.id);
          const bi = pinnedOrder.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return bi - ai; // higher index = more recently pinned
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return ((b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)) || recency(b) - recency(a);
        });
      case "oldest":
        // Most recently pinned → last
        return arr.sort((a, b) => {
          const ai = pinnedOrder.indexOf(a.id);
          const bi = pinnedOrder.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return 1;
          if (bi !== -1) return -1;
          return ((a.isNew ? 1 : 0) - (b.isNew ? 1 : 0)) || recency(a) - recency(b);
        });
      case "concretado":
        // Después de Mayo 2026, "Zoom Concretado" se unificó con "Seguimiento".
        // Conservamos el case-id "concretado" para no romper preferencias guardadas.
        return arr.sort((a, b) => {
          const aCon = a.st === "Seguimiento" ? 1 : 0;
          const bCon = b.st === "Seguimiento" ? 1 : 0;
          return bCon - aCon || b.sc - a.sc;
        });
      case "proxZoom": {
        // "Los más próximos a Zoom arriba", agrupando por DÍA: HOY como bloque →
        // días futuros → días pasados → sin cita (compareZoomProximity, el MISMO
        // criterio que la tabla). Así las citas de hoy quedan juntas arriba aunque
        // ya haya pasado su hora, en vez de irse debajo de las de mañana.
        const now = Date.now();
        return arr.sort((a, b) => {
          const c = compareZoomProximity(a, b, now);
          if (c !== 0) return c;
          return recency(b) - recency(a); // tiebreak: lead más reciente
        });
      }
      case "manual":
      default:
        return priorityOrder.length
          ? arr.sort((a, b) => {
              const ia = priorityOrder.indexOf(a.id);
              const ib = priorityOrder.indexOf(b.id);
              if (ia === -1 && ib === -1) return recency(b) - recency(a);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            })
          : arr.sort((a, b) =>
              (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0)
              || recency(b) - recency(a)
            );
    }
  })();

  // Cap del render de la sección Prioridad. Es una lista de FOCO ("qué trabajar
  // ahora"), no un volcado de todos los leads activos. isAutoPriority marca como
  // prioridad cualquier lead reciente/activo, así que con miles de leads esto
  // renderizaría miles de tarjetas (carrusel + dots) y congelaría el montaje.
  // Mostramos el top y listo; lo pinneado va primero por el sort, así que nunca
  // se pierde lo importante. El resto se gestiona desde la Lista.
  const PRIORITY_RENDER_CAP = 60;
  const priorityLeads = priorityLeadsFull.length > PRIORITY_RENDER_CAP
    ? priorityLeadsFull.slice(0, PRIORITY_RENDER_CAP)
    : priorityLeadsFull;

  // ── Drag & drop para reordenar priority cards ──────────────────────────────
  // Usamos refs para los valores críticos del drop (siempre síncronos, sin closure stale)
  const [justDroppedId, setJustDroppedId] = useState(null);
  const justDroppedTimer  = useRef(null);
  const dragCardIdRef     = useRef(null);   // fuente de verdad para el drop
  const dragInsertIdxRef  = useRef(null);   // fuente de verdad para el drop
  const priorityLeadsRef  = useRef([]);     // snapshot del array para el drop
  // dragOverCardRef: evita re-renders excesivos durante dragover
  const dragOverCardRef   = useRef(null);

  // Sincronizar priorityLeadsRef en cada render
  priorityLeadsRef.current = priorityLeads;

  const handleCardDragStart = (e, id) => {
    // Si veníamos en modo sort automático, congelar el orden actual como "manual"
    if (prioritySort !== "manual") {
      setPriorityOrder(priorityLeadsRef.current.map(l => l.id));
      setPrioritySort("manual");
    }
    dragCardIdRef.current   = id;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(id);
    setDragInsertIdx(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleCardDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const inRightHalf = e.clientX > rect.left + rect.width / 2;
    const newInsert = inRightHalf ? idx + 1 : idx;
    dragInsertIdxRef.current = newInsert;   // siempre actualizar ref (síncrono)
    if (dragOverCardRef.current !== newInsert) {
      dragOverCardRef.current = newInsert;
      setDragInsertIdx(newInsert);           // state solo para la línea visual
    }
  };

  const handleCarouselDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const last = priorityLeadsRef.current.length;
    dragInsertIdxRef.current = last;
    if (dragOverCardRef.current !== last) {
      dragOverCardRef.current = last;
      setDragInsertIdx(last);
    }
  };

  const commitCardDrop = () => {
    // Leer SIEMPRE de refs — nunca del closure de estado
    const insertIdx = dragInsertIdxRef.current;
    const fromId    = dragCardIdRef.current;
    // Limpiar todo
    dragCardIdRef.current    = null;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(null);
    setDragInsertIdx(null);

    if (insertIdx === null || insertIdx === undefined || !fromId) return;

    const ids = priorityLeadsRef.current.map(l => l.id);
    const fromIdx = ids.indexOf(fromId);
    if (fromIdx === -1) return;

    const without = ids.filter(id => id !== fromId);
    const destIdx = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
    const clamped = Math.max(0, Math.min(destIdx, without.length));
    without.splice(clamped, 0, fromId);

    if (without.join(",") === ids.join(",")) return;  // sin cambio real

    // Guardar scroll actual ANTES del re-render para restaurarlo después
    const savedScroll = carouselRef.current ? carouselRef.current.scrollLeft : 0;

    setPriorityOrder(without);

    // Doble rAF: esperar que React termine el re-render y luego restaurar scroll
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (carouselRef.current) {
        carouselRef.current.scrollLeft = savedScroll;
      }
    }));

    // Highlight 3 segundos — solo borde blanco sutil
    if (justDroppedTimer.current) clearTimeout(justDroppedTimer.current);
    setJustDroppedId(fromId);
    justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 3000);
  };

  const handleCardDrop     = (e) => { e.preventDefault(); e.stopPropagation(); commitCardDrop(); };
  const handleCarouselDrop = (e) => { e.preventDefault(); commitCardDrop(); };

  // ── Foco en card de prioridad (UX fluida al togglear desde tabla) ────────
  // Resalta la card 3s y la centra en el carousel. Espera 2 frames para que
  // React termine el re-render con el nuevo orden antes de medir posiciones.
  const triggerPriorityFocus = (leadId) => {
    if (!leadId) return;
    if (justDroppedTimer.current) clearTimeout(justDroppedTimer.current);
    setJustDroppedId(leadId);
    justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 3000);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const carousel = carouselRef.current;
      if (!carousel) return;
      const el = carousel.querySelector(`[data-priority-id="${leadId}"]`);
      if (!el) return;
      const target = el.offsetLeft - (carousel.clientWidth - el.clientWidth) / 2;
      carousel.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }));
  };

  // Mover un lead a una posición específica (1-indexed) vía dropdown
  const moveToPriorityPosition = (leadId, newPos) => {
    const ids = priorityLeadsRef.current.map(l => l.id);
    const fromIdx = ids.indexOf(leadId);
    if (fromIdx === -1) return;
    const targetIdx = Math.max(0, Math.min(newPos - 1, ids.length - 1));
    if (targetIdx === fromIdx) return;

    const without = ids.filter(id => id !== leadId);
    without.splice(targetIdx, 0, leadId);

    const savedScroll = carouselRef.current ? carouselRef.current.scrollLeft : 0;
    // Asegurar modo manual para que el orden seleccionado prevalezca
    if (prioritySort !== "manual") setPrioritySort("manual");
    setPriorityOrder(without);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (carouselRef.current) carouselRef.current.scrollLeft = savedScroll;
    }));

    if (justDroppedTimer.current) clearTimeout(justDroppedTimer.current);
    setJustDroppedId(leadId);
    justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 3000);
  };
  const handleCardDragEnd  = () => {
    dragCardIdRef.current    = null;
    dragInsertIdxRef.current = null;
    dragOverCardRef.current  = null;
    setDragCardId(null);
    setDragInsertIdx(null);
  };

  const carouselRef = useRef(null);
  // FAB "dodge": mientras el carrusel de Prioridad está EN PANTALLA, el FAB
  // se esconde (tapaba el botón "Tomar acción" de la card en móvil). Al
  // scrollear hacia la lista, reaparece.
  const [fabDodge, setFabDodge] = useState(false);
  useEffect(() => {
    if (!isMobile || !carouselRef.current || typeof IntersectionObserver === "undefined") { setFabDodge(false); return; }
    const obs = new IntersectionObserver(
      // el ÚLTIMO registro del batch es el estado actual (IO puede encolar varios)
      (entries) => setFabDodge(entries[entries.length - 1].isIntersecting),
      { threshold: 0.15 }
    );
    obs.observe(carouselRef.current);
    return () => obs.disconnect();
  }, [isMobile, priorityLeads.length, showMetrics]);
  const [prioScrollX, setPrioScrollX] = useState(0);
  const scrollCarousel = (dir) => carouselRef.current?.scrollBy({ left: dir * 310, behavior: "smooth" });
  const totalPipeline = visibleLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const avgScore = visibleLeads.length ? Math.round(visibleLeads.reduce((s, l) => s + l.sc, 0) / visibleLeads.length) : 0;
  const hotLeads = visibleLeads.filter(l => l.hot || l.daysInactive <= 2).length;
  const newLeadsCount = visibleLeads.filter(l => l.isNew).length;
  // Cerca del cierre = Apartó + Visita Agendada + Cierre (milestones finales).
  const nearCloseLeads = visibleLeads.filter(l => l.st === "Apartó" || l.st === "Visita Agendada" || l.st === "Cierre").length;
  const zoomsAgendados   = visibleLeads.filter(l => l.st === "Zoom Agendado").length;
  // Post-Mayo 2026 "Zoom Concretado" se consolidó en "Seguimiento".
  const zoomsConcretados = visibleLeads.filter(l => l.st === "Seguimiento").length;

  // KPIs config-driven (clientes con `crm.kpis`, ej. Vega). Resuelve el valor
  // de un spec sobre los leads visibles. Duke no usa esto (su bloque es el else).
  const kpiCustom = Array.isArray(clientConfig?.crm?.kpis) ? clientConfig.crm.kpis : null;
  const kpiValue = (spec) => {
    if (!spec) return "";
    if (spec.type === "total") return visibleLeads.length;
    if (spec.type === "money") return `$${(totalPipeline / 1000000).toFixed(1)}M`;
    if (spec.type === "count") return visibleLeads.filter(l => l.st === spec.stage).length;
    return "";
  };
  const KPI_ICON_MAP = { Building2, Search, Trophy, DollarSign, Users, Target, CalendarDays, FileText };
  const KPI_COLOR_MAP = { blue: T.blue, cyan: T.cyan, accent: T.accent, emerald: T.emerald, violet: T.violet };
  const kanbanStages = STAGES.filter(s => s !== "Postventa");

  /* Responsive grid columns — 6 columnas en modo full, 5 en compact.
     · Cliente: avatar + nombre + tags + sub-línea (asesor · proyecto · fecha).
     · Presupuesto: columna propia con ancho fijo, alineada a la derecha. Antes
       vivía dentro de la celda Cliente con flex-spacer, pero con nombres cortos
       el monto quedaba flotando lejos del nombre. Columna propia = más fácil
       de escanear visualmente y alineado entre filas.
     · Etapa, Seguim., Score (solo full), Acciones. */
  const colsFull    = "1.9fr 110px 140px 140px 100px 110px";
  const colsCompact = "1.7fr 110px 130px 130px 110px";
  // En mobile: una sola columna que toma ancho completo — la fila se
  // re-organiza en stack vertical con info principal arriba y acciones abajo.
  const cols = isMobile ? "1fr" : (co ? colsCompact : colsFull);

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 18,
      color: T.txt,
      paddingBottom: isMobile ? 96 : 0,
      transition: "color 0.3s ease",
    }}>

      {/* ══════════════════════════════════════════════════════════════════
          HEADER — diseño dual: mobile minimalista (1 fila clean), desktop
          mantiene el tratamiento amplio con subtítulo y stats inline.
          ══════════════════════════════════════════════════════════════════ */}
      {isMobile ? (
        // ── MOBILE: 1 fila — título grande + count discreto. Sin subtítulo,
        // sin badge "vista personal" (eso vive en el perfil del asesor).
        // El botón de añadir se mueve al FAB (abajo) — más alcance de pulgar.
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{
            fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em",
            color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, margin: 0,
            lineHeight: 1,
          }}>
            {L.pageTitleMobile}
          </h2>
          <span style={{
            fontSize: 13, fontWeight: 500, color: T.txt3, fontFamily: fontDisp,
            letterSpacing: "-0.01em",
          }}>
            {visibleLeads.length} {visibleLeads.length === 1 ? L.entity : L.entityPlural}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.txt3, fontFamily: font, fontWeight: 500 }}>
            ${(totalPipeline/1000000).toFixed(1)}M
          </span>
        </div>
      ) : (
        // ── DESKTOP: layout amplio sin cambios respecto al original. ──
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>
                {L.pageTitle}{" "}
                <span style={{ fontWeight: 300, color: isLight ? T.txt3 : "rgba(255,255,255,0.38)" }}>{L.pageTitleAccent}</span>
              </h2>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.txt3, background: T.glass, border: `1px solid ${T.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{visibleLeads.length} {L.entityPlural}</span>
              {!canSeeAll && <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, background: `${T.amber}10`, border: `1px solid ${T.amber}28`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.04em" }}>Vista personal</span>}
            </div>
            <p style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, margin: 0 }}>
              <span style={{ color: T.txt2 }}>${(totalPipeline/1000000).toFixed(1)}M</span> en pipeline · <span style={{ color: T.emerald }}>{hotLeads} activos</span> · Score promedio <span style={{ color: T.blue }}>{avgScore}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {metricsTabEnabled && (
              <button
                onClick={() => setShowMetrics(v => !v)}
                title={showMetrics ? "Volver al CRM" : "Ver indicadores de asesores"}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "9px 14px",
                  borderRadius: 11,
                  background: showMetrics
                    ? (isLight ? `${T.accent}1A` : `${T.accent}18`)
                    : "transparent",
                  border: `1px solid ${showMetrics ? T.accentB : T.border}`,
                  color: showMetrics ? T.accent : T.txt2,
                  fontSize: 12, fontWeight: 600, fontFamily: fontDisp, cursor: "pointer",
                  letterSpacing: "0.01em", transition: "all 0.16s", flexShrink: 0,
                }}
              ><Activity size={13} /> Indicadores</button>
            )}
            <button onClick={() => setAddingLead(true)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              borderRadius: 11,
              background: isLight
                ? `linear-gradient(135deg, ${T.accent}, ${T.emerald})`
                : "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
              border: `1px solid ${isLight ? "transparent" : T.accentB}`,
              color: isLight ? "#FFFFFF" : T.accent,
              fontSize: 12, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
              letterSpacing: "0.01em", transition: "all 0.2s", flexShrink: 0,
              boxShadow: isLight ? `0 4px 14px ${T.accent}40` : "none",
            }}
              onMouseEnter={e => {
                if (isLight) {
                  e.currentTarget.style.boxShadow = `0 6px 18px ${T.accent}55`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                } else {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))";
                  e.currentTarget.style.boxShadow = `0 0 20px ${T.accent}18`;
                }
              }}
              onMouseLeave={e => {
                if (isLight) {
                  e.currentTarget.style.boxShadow = `0 4px 14px ${T.accent}40`;
                  e.currentTarget.style.transform = "none";
                } else {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            ><Plus size={14} /> {L.newEntity}</button>
          </div>
        </div>
      )}

      {/* ── Vista "Indicadores de Asesores" — toggle activo, ocupa el lugar
          de los KPIs/priority/listas. Solo disponible si el cliente tiene
          el flag prendido + rol admin (ambos chequeados en metricsTabEnabled). */}
      {showMetrics && metricsTabEnabled && (
        <AdvisorMetrics leadsData={visibleLeads} theme={theme} onOpenLead={setNotesLead} />
      )}

      {/* ── KPIs — solo desktop. En mobile son ruido visual: ocupan 1/3 de
          la pantalla para datos que el asesor ya conoce o puede consultar
          después en el Dashboard. La cifra crítica (pipeline) ya está en
          el header mobile. ── */}
      {!showMetrics && !isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
          {kpiCustom ? (
            // KPIs custom por cliente (ej. Vega: métricas de obra).
            kpiCustom.map((k, i) => (
              <KPI key={i} T={T} label={k.label}
                value={kpiValue(k.value)}
                sub={`${kpiValue(k.sub)} ${k.sub?.suffix || ""}`.trim()}
                icon={KPI_ICON_MAP[k.icon] || Users}
                color={KPI_COLOR_MAP[k.color] || T.blue} />
            ))
          ) : (
            // KPIs históricas de Stratos/Duke (sin cambios).
            <>
              <KPI T={T} label="Clientes en Pipeline" value={visibleLeads.length} sub={`${hotLeads} activos hoy`} icon={Users} color={T.blue} />
              <KPI T={T} label="Score Promedio" value={avgScore} sub={`promedio del pipeline`} icon={Target} color={T.cyan} />
              <KPI T={T} label="Zooms Agendados" value={zoomsAgendados} sub={`${zoomsConcretados} concretados`} icon={CalendarDays} color={T.accent} />
              <KPI T={T} label="Valor Total Pipeline" value={`$${(totalPipeline/1000000).toFixed(1)}M`} sub={`${nearCloseLeads} en cierre`} icon={DollarSign} color={T.emerald} />
            </>
          )}
        </div>
      )}

      {/* ── CLIENTES EN PRIORIDAD — todos, color por tipo, botones uniformes ── */}
      {!showMetrics && priorityLeads.length > 0 && (() => {

        // Paleta de tipo — cada categoría tiene identidad visual única.
        // Los colores vienen del design system (`T` = paleta activa: P en oscuro, LP en claro)
        // así que los cards quedan automáticamente alineados al tema y a la paleta global.
        // El topBar usa una versión clara del color base + transparencia para que respire.
        // ════════════════════════════════════════════════════════════════
        // TOP BAR UNIFICADO — todas las priority cards llevan la misma
        // línea verde accent en la parte superior para sentirse parte de
        // un mismo sistema. El contexto (hot, nuevo, zoom agendado, etc.)
        // se diferencia por el chip-label de texto + el color del rail
        // izquierdo y los badges secundarios. Estética súper coherente.
        // ════════════════════════════════════════════════════════════════
        const lighten = (hex) => `${hex}CC`;
        const tbAccent       = `linear-gradient(90deg, ${T.accent} 0%, ${lighten(T.accent)} 50%, ${T.accent} 100%)`;
        const tbAccentSubtle = `linear-gradient(90deg, ${T.accent} 0%, ${lighten(T.accent)} 50%, transparent 100%)`;

        const getCardMeta = (l) => {
          // Todas las tarjetas comparten estética: accent verde + topbar shimmer.
          // Excepción: `requiere-humano` rompe el verde y usa rojo urgente.
          if (l.tag === "requiere-humano") {
            const red = isLight ? "#DC2626" : "#EF4444";
            const tbRed = `linear-gradient(90deg, ${red} 0%, ${lighten(red)} 50%, ${red} 100%)`;
            return { color: red, topBar: tbRed, label: "🔥 REQUIERE HUMANO", sublabel: "El bot pidió handoff — atendé ya", pulse: true, glow: true };
          }
          if (l.hot)                       return { color: T.accent, topBar: tbAccent, label: `CALIENTE · ${l.daysInactive}D`,     sublabel: "Actuar ahora mismo",              pulse: true, glow: true };
          if (l.isNew)                     return { color: T.accent, topBar: tbAccent, label: "NUEVO REGISTRO",                    sublabel: "Primer contacto — no esperes",    pulse: true, glow: true };
          if (l.st === "Zoom Agendado")    return { color: T.accent, topBar: tbAccent, label: "ZOOM AGENDADO",                     sublabel: "Preparar presentación de cierre", pulse: true, glow: true };
          if (l.st === "Reactivar Zoom")   return { color: T.accent, topBar: tbAccent, label: "REACTIVAR ZOOM",                    sublabel: "No se conectó — reagendar hoy",   pulse: true, glow: true };
          if (l.st === "Seguimiento")      return { color: T.accent, topBar: tbAccent, label: "EN SEGUIMIENTO",                    sublabel: "Negociación / propuesta activa",  pulse: true, glow: true };
          if (l.st === "Apartó")           return { color: T.accent, topBar: tbAccent, label: "APARTÓ ✓",                          sublabel: "Validar comprobante con admin",   pulse: true, glow: true };
          if (l.daysInactive >= 7)         return { color: T.accent, topBar: tbAccent, label: `SIN CONTACTO · ${l.daysInactive}D`, sublabel: "Retomar antes de que enfríe",     pulse: true, glow: true };
          return                                  { color: T.accent, topBar: tbAccent, label: "ACCIÓN PENDIENTE",                  sublabel: "Revisar y avanzar hoy",           pulse: true, glow: true };
        };

        return (
          <div>
            {/* Header — 3 zonas. En mobile: título arriba, sort abajo, leyenda oculta. */}
            <div style={{
              position: "relative", display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center",
              justifyContent: "space-between",
              gap: isMobile ? 8 : 0,
              marginBottom: isMobile ? 10 : 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
                {isMobile ? (
                  // ── MOBILE: header simple — dot + título + count inline ──
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: T.accent, boxShadow: `0 0 8px ${T.accent}80`,
                      alignSelf: "center",
                    }} />
                    <h3 style={{
                      margin: 0, fontSize: 16, fontWeight: 600,
                      color: isLight ? T.txt : "#FFFFFF",
                      fontFamily: fontDisp, letterSpacing: "-0.025em",
                    }}>Prioridad</h3>
                    <span style={{
                      fontSize: 13, fontWeight: 500, color: T.accent,
                      fontFamily: fontDisp,
                    }}>{priorityLeads.length}</span>
                  </div>
                ) : (
                  // ── DESKTOP: header amplio con pill + sub-label ──
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 16px 7px 12px", borderRadius: 99,
                      position: "relative",
                      background: isLight
                        ? `linear-gradient(135deg, ${T.accent}18 0%, ${T.accent}08 100%)`
                        : "rgba(52,211,153,0.08)",
                      border: `1px solid ${isLight ? T.accent + "44" : "rgba(52,211,153,0.24)"}`,
                      boxShadow: isLight
                        ? `0 1px 4px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.9)`
                        : `0 0 12px ${T.accent}10`,
                    }}>
                      <div style={{
                        width: 9, height: 9, borderRadius: "50%",
                        background: `radial-gradient(circle at 30% 30%, #5CE0B0, ${T.accent})`,
                        animation: "priorityBreathe 2.4s ease-in-out infinite",
                      }} />
                      <span style={{
                        fontSize: 12.5, fontWeight: 800,
                        color: isLight ? T.accentDark : "#FFFFFF",
                        letterSpacing: "-0.005em", fontFamily: fontDisp,
                      }}>{L.priorityList}</span>
                    </div>
                    <span style={{
                      fontSize: 11, color: T.txt2, fontFamily: font, fontWeight: 500,
                    }}>
                      <span style={{ color: T.accent, fontWeight: 700 }}>{priorityLeads.length}</span> cliente{priorityLeads.length !== 1 ? "s" : ""} esperando acción
                    </span>
                  </>
                )}
              </div>
              {/* Selector de orden — al costado derecho */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 600 }}>Ordenar</span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <select
                    value={prioritySort}
                    onChange={e => setPrioritySort(e.target.value)}
                    title="Cambiar orden de las tarjetas de prioridad"
                    style={{
                      appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                      height: 28, padding: "0 26px 0 12px", minWidth: 168,
                      borderRadius: 8,
                      background: prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                        : `${T.accent}14`,
                      border: `1px solid ${prioritySort === "manual" ? T.border : `${T.accent}44`}`,
                      color: prioritySort === "manual" ? T.txt2 : (isLight ? T.accentDark || T.accent : T.accent),
                      fontSize: 11, fontWeight: 600, fontFamily: font,
                      outline: "none", cursor: "pointer",
                      transition: "background 0.15s, border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)")
                        : `${T.accent}22`;
                      e.currentTarget.style.borderColor = prioritySort === "manual" ? T.borderH : `${T.accent}77`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = prioritySort === "manual"
                        ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                        : `${T.accent}14`;
                      e.currentTarget.style.borderColor = prioritySort === "manual" ? T.border : `${T.accent}44`;
                    }}
                  >
                    <option value="manual"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Manual (arrastra)</option>
                    <option value="proxZoom"   style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Próximo Zoom</option>
                    <option value="newest"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Nuevos primero</option>
                    <option value="oldest"     style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>Nuevos al fondo</option>
                    <option value="concretado" style={{ background: isLight ? "#FFFFFF" : "#111318", color: T.txt }}>En Seguimiento</option>
                  </select>
                  <ChevronDown size={12} color={prioritySort === "manual" ? T.txt3 : T.accent} strokeWidth={2.5} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>
            </div>

            {/* Carrusel horizontal — wrapper relativo para anclar los botones superpuestos */}
            <div style={{ position: "relative" }}>
            <div style={{
              position: "relative",
              maskImage: "linear-gradient(90deg, #000 0%, #000 97%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 97%, transparent 100%)",
            }}>
            <div ref={carouselRef}
              onDragOver={handleCarouselDragOver}
              onDrop={handleCarouselDrop}
              onScroll={isMobile ? undefined : (e => setPrioScrollX(e.currentTarget.scrollLeft))}
              className="carousel-no-scroll"
              style={{
                display: "flex", gap: 12, overflowX: "auto",
                padding: isMobile ? "8px 16px 18px" : "10px 24px 20px 8px",
                scrollbarWidth: "none", msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                // En mobile: scroll-snap para que cada card "encaje" tras swipe.
                scrollSnapType: isMobile ? "x mandatory" : "none",
                scrollPaddingLeft: isMobile ? 16 : 0,
              }}>
              {priorityLeads.map((l, cardIdx) => {
                const sc = l.sc;
                const stageColor = stgC[l.st] || T.txt3;
                const meta = getCardMeta(l);
                const prioNum = cardIdx + 1;

                const isDraggingCard = dragCardId === l.id;
                const isJustDropped  = justDroppedId === l.id;
                const showInsertBefore = dragInsertIdx === cardIdx && dragCardId && dragCardId !== l.id;
                const showInsertAfter  = dragInsertIdx === cardIdx + 1 && dragCardId && cardIdx === priorityLeads.length - 1;
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                    {/* Insert-before indicator */}
                    {showInsertBefore && (
                      <div style={{ width: 3, borderRadius: 3, background: T.accent, boxShadow: `0 0 12px ${T.accent}80`, marginRight: 4, alignSelf: "stretch", flexShrink: 0, transition: "opacity 0.15s" }} />
                    )}
                  {(() => {
                    // ── Shadow budget ───────────────────────────────────────────────────
                    // The carousel is overflow-x:auto → overflow-y also clips.
                    // Carousel bottom-padding = 20px.  Hover translateY = -2px.
                    // Max downward shadow reach = -2 (translate) + y-offset + blur-radius.
                    // All shadow values below are sized so that reach ≤ 18px  (< 20px padding).
                    // ────────────────────────────────────────────────────────────────────
                    const restBorder = isLight
                      ? `${meta.color}30`
                      : `rgba(255,255,255,0.07)`;
                    const restShadow = isLight
                      ? `0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,1)`
                      : `0 2px 8px rgba(0,0,0,0.55), 0 12px 44px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`;
                    const hoverBorder = isLight ? `${meta.color}68` : `rgba(255,255,255,0.14)`;
                    const hoverShadow = isLight
                      ? `0 2px 6px rgba(15,23,42,0.07), 0 8px 22px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,1)`
                      : `0 6px 20px rgba(0,0,0,0.62), 0 20px 60px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08)`;
                    const droppedBorder = isLight ? `${meta.color}80` : `rgba(255,255,255,0.20)`;
                    const droppedShadow = isLight
                      ? `0 0 0 3px ${meta.color}18, 0 4px 14px rgba(15,23,42,0.08)`
                      : `0 0 0 1px rgba(255,255,255,0.12), 0 8px 28px rgba(0,0,0,0.55)`;
                    return (
                  <div
                    data-priority-id={l.id}
                    draggable={!isMobile}
                    onDragStart={e => handleCardDragStart(e, l.id)}
                    onDragOver={e => { e.stopPropagation(); handleCardDragOver(e, cardIdx); }}
                    onDrop={e => { e.stopPropagation(); handleCardDrop(e); }}
                    onDragEnd={handleCardDragEnd}
                    onClick={() => { if (!dragCardId && !isDraggingCard) setNotesLead(l); }}
                    title={isMobile ? "Tap para abrir expediente" : "Click para abrir expediente · arrastrar para reordenar"}
                    style={{
                      // En mobile: ~88% del viewport para que aparezca el peek
                      // de la siguiente card y se sienta carousel táctil natural.
                      width: isMobile ? "min(88vw, 360px)" : (co ? 256 : 288),
                      flexShrink: 0,
                      scrollSnapAlign: isMobile ? "start" : "none",
                      borderRadius: 18, overflow: "hidden",
                      position: "relative",
                      background: isLight
                        ? "#FFFFFF"
                        : `linear-gradient(160deg, #0A0F1E 0%, #060810 100%)`,
                      backdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
                      WebkitBackdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
                      border: `1px solid ${isJustDropped ? droppedBorder : restBorder}`,
                      boxShadow: isJustDropped ? droppedShadow : restShadow,
                      display: "flex", flexDirection: "column",
                      transition: "transform 0.22s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease",
                      opacity: isDraggingCard ? 0.35 : 1,
                      cursor: dragCardId ? (isDraggingCard ? "grabbing" : "copy") : "pointer",
                      transform: isDraggingCard ? "scale(0.97)" : "none",
                    }}
                    onMouseEnter={e => {
                      if (!dragCardId) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = hoverShadow;
                        e.currentTarget.style.borderColor = hoverBorder;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!dragCardId) {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = restShadow;
                        e.currentTarget.style.borderColor = restBorder;
                      }
                    }}
                  >
                    {/* Color wash — top ambient glow from card type color */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: isLight
                        ? `radial-gradient(ellipse 200px 120px at 50% -10%, ${meta.color}10 0%, transparent 65%)`
                        : `radial-gradient(ellipse 200px 100px at 50% -10%, ${meta.color}0A 0%, transparent 65%)`,
                      pointerEvents: "none",
                    }} />
                    {/* Top bar — 4px, shimmer on hot/new */}
                    <div
                      className={meta.glow ? "topbar-shimmer" : "topbar-static"}
                      style={{ height: 3, flexShrink: 0, backgroundImage: meta.topBar, opacity: isLight ? 1 : 0.40, boxShadow: isLight ? "none" : `0 2px 8px ${meta.color}22, 0 1px 3px ${meta.color}12` }}
                    />

                    <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>

                      {/* Fila superior: #N selector + dot + X — minimalista */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {/* Selector de posición — pill glassmorphic */}
                          <div
                            onMouseDown={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                            draggable={false}
                            title="Cambiar posición de prioridad"
                            style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}
                          >
                            <select
                              value={prioNum}
                              onChange={e => moveToPriorityPosition(l.id, parseInt(e.target.value, 10))}
                              style={{
                                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                                height: 28, padding: "0 26px 0 11px", minWidth: 108,
                                borderRadius: 9,
                                background: isLight
                                  ? "rgba(255,255,255,0.88)"
                                  : "rgba(255,255,255,0.07)",
                                border: `1px solid ${isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)"}`,
                                color: isLight ? "#0B1220" : "#FFFFFF",
                                fontSize: 11.5, fontWeight: 700, fontFamily: fontDisp,
                                letterSpacing: "-0.01em",
                                lineHeight: 1, outline: "none", cursor: "pointer",
                                textAlign: "center", textAlignLast: "center",
                                boxShadow: isLight
                                  ? "0 1px 4px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.85)"
                                  : "0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.12)";
                                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.22)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.07)";
                                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)";
                              }}
                            >
                              {priorityLeads.map((_, i) => (
                                <option key={i} value={i + 1} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#fff", fontFamily: fontDisp }}>Prioridad {i + 1}</option>
                              ))}
                            </select>
                            <ChevronDown size={9} color={isLight ? "rgba(11,18,32,0.38)" : "rgba(255,255,255,0.38)"} strokeWidth={2.5} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                          </div>
                        </div>
                        {/* X — quitar de prioridad */}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()}
                          onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                          draggable={false}
                          onClick={e => { e.stopPropagation(); dismissPriority(l.id); }}
                          title="Quitar de prioridad"
                          style={{
                            width: 24, height: 24, borderRadius: 7,
                            background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
                            color: T.txt3, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 0, flexShrink: 0, transition: "all 0.14s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = isLight ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.14)";
                            e.currentTarget.style.borderColor = isLight ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.40)";
                            e.currentTarget.style.color = isLight ? "#B91C1C" : "#FCA5A5";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)";
                            e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)";
                            e.currentTarget.style.color = T.txt3;
                          }}
                        >
                          <X size={10} strokeWidth={2.4} />
                        </button>
                      </div>

                      {/* Nombre + presupuesto + etapa */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                          {meta.pulse && (
                            <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: meta.color, boxShadow: `0 0 6px ${meta.color}90`, animation: "pulse 1.8s ease-in-out infinite" }} />
                          )}
                          <p style={{ fontSize: 17, fontWeight: 700, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.2, margin: 0 }}>{l.n}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flexWrap: "wrap" }}>
                            <Pill color={stageColor} s isLight={isLight}>{l.st}</Pill>
                            {(() => {
                              const sc = getScheduledCall(l);
                              return sc ? (
                                <ScheduledCallBadge scheduledAt={sc.scheduled_at} variant="card" T={T} isLight={isLight} />
                              ) : null;
                            })()}
                            <SourceBadge source={l.source} isLight={isLight} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily: fontDisp, letterSpacing: "-0.01em", flexShrink: 0 }}>{l.budget}</span>
                        </div>
                      </div>

                      {/* Agente IA asignado — badge contextual */}
                      {(() => {
                        const agent = l.aiAgent ? AI_AGENTS[l.aiAgent] : null;
                        if (!agent) return null;
                        const AI = agent.icon;
                        return (
                          <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, background: `${agent.color}12`, border: `1px solid ${agent.color}35`, boxShadow: `0 0 10px ${agent.color}18` }}>
                            <div style={{ width: 20, height: 20, borderRadius: 6, background: `${agent.color}22`, border: `1px solid ${agent.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                              <AI size={10} color={agent.color} strokeWidth={2.5} />
                              <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: agent.color, boxShadow: `0 0 5px ${agent.color}`, animation: "pulse 2s ease-in-out infinite" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: agent.color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp }}>IA activa · {agent.short}</p>
                              <p style={{ margin: 0, fontSize: 9, color: T.txt3, fontFamily: font }}>Tú conservas el control</p>
                            </div>
                            <button
                              onClick={() => updateLead({...l, aiAgent: null})}
                              title="Retomar control — liberar agente"
                              style={{ background: "transparent", border: "none", color: T.txt3, cursor: "pointer", padding: 4, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.14s" }}
                              onMouseEnter={e => { e.currentTarget.style.color = agent.color; e.currentTarget.style.background = `${agent.color}18`; }}
                              onMouseLeave={e => { e.currentTarget.style.color = T.txt3; e.currentTarget.style.background = "transparent"; }}
                            >
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })()}


                      {/* Score — solo visual en tarjetas, editable desde drawers */}
                      <ScoreInput sc={sc} onUpdate={n => updateLead({...l, sc: n})} color={isLight ? meta.color : "rgba(255,255,255,0.85)"} isLight={isLight} T={T} stopProp readOnly />

                      {/* Próxima acción — HERO del card */}
                      {(() => {
                        const isEditingAction = editingActionId === l.id;
                        return (
                          <div onClick={e => e.stopPropagation()} style={{
                            borderRadius: 12,
                            background: isLight
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isEditingAction
                              ? (meta.color + (isLight ? "60" : "50"))
                              : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)")}`,
                            overflow: "hidden", flex: 1,
                            boxShadow: isLight
                              ? "inset 0 1px 0 rgba(255,255,255,1), 0 1px 6px rgba(15,23,42,0.05)"
                              : "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 4px rgba(0,0,0,0.15)",
                            transition: "border-color 0.15s",
                          }}>
                            {/* Header row */}
                            <div style={{
                              padding: "8px 12px 7px",
                              borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"}`,
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {/* Left accent bar */}
                                <div style={{ width: 2.5, height: 14, borderRadius: 2, background: meta.color, flexShrink: 0, opacity: 0.85 }} />
                                <span style={{
                                  fontSize: 9, fontWeight: 700,
                                  color: isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.42)",
                                  letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: fontDisp,
                                }}>Próxima acción</span>
                              </div>
                              {!isEditingAction && l.nextActionDate && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700,
                                  color: isLight ? meta.color : "rgba(255,255,255,0.45)",
                                  background: isLight ? `${meta.color}12` : "rgba(255,255,255,0.06)",
                                  padding: "2px 8px", borderRadius: 99, fontFamily: fontDisp,
                                  border: isLight ? `1px solid ${meta.color}28` : "1px solid rgba(255,255,255,0.08)",
                                  letterSpacing: "0.01em",
                                  whiteSpace: "nowrap", flexShrink: 0,
                                }}>{(l.st === "Zoom Agendado" || l.stage === "Zoom Agendado") ? l.nextActionDate : fmtFechaCortaISO(l)}</span>
                              )}
                            </div>
                            {!isEditingAction && (
                              <div
                                onClick={() => startInlineAction(l)}
                                title="Click para editar"
                                style={{
                                  padding: "11px 13px", minHeight: 54,
                                  display: "flex", alignItems: "flex-start",
                                  cursor: "text",
                                  transition: "background 0.14s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.03)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                              >
                                <p style={{
                                  fontSize: 12.5, fontWeight: 500,
                                  color: isLight ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.88)",
                                  fontFamily: font, lineHeight: 1.50, margin: 0,
                                  letterSpacing: "-0.003em",
                                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                                  pointerEvents: "none",
                                }}>
                                  {l.nextAction || "Sin próxima acción registrada."}
                                </p>
                              </div>
                            )}
                            {isEditingAction && (
                              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                                <textarea
                                  value={actionDraft.a}
                                  onChange={e => setActionDraft(d => ({ ...d, a: e.target.value }))}
                                  autoFocus
                                  placeholder="Ej: Llamar mañana 10am para confirmar visita…"
                                  rows={3}
                                  style={{
                                    width: "100%", boxSizing: "border-box",
                                    padding: "8px 10px", borderRadius: 8,
                                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isLight ? meta.color + "55" : meta.color + "44"}`,
                                    color: isLight ? T.txt : "#E2E8F0",
                                    fontSize: 12.5, lineHeight: 1.45,
                                    fontFamily: font, fontWeight: 500,
                                    outline: "none", resize: "vertical", minHeight: 52,
                                  }}
                                />
                                <input
                                  value={actionDraft.d}
                                  onChange={e => setActionDraft(d => ({ ...d, d: e.target.value }))}
                                  placeholder="Fecha (Hoy 5pm, Mañana 10am…)"
                                  style={{
                                    width: "100%", boxSizing: "border-box",
                                    padding: "6px 10px", borderRadius: 7,
                                    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isLight ? meta.color + "44" : meta.color + "33"}`,
                                    color: isLight ? T.txt : "#E2E8F0",
                                    fontSize: 11, fontWeight: 600,
                                    fontFamily: fontDisp, letterSpacing: "0.01em",
                                    outline: "none",
                                  }}
                                />
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  <button
                                    onClick={cancelInlineAction}
                                    style={{
                                      padding: "6px 10px", borderRadius: 7,
                                      background: "transparent",
                                      border: `1px solid ${T.border}`,
                                      color: T.txt3, fontSize: 10.5, fontWeight: 700,
                                      fontFamily: fontDisp, letterSpacing: "0.02em",
                                      cursor: "pointer", transition: "all 0.15s",
                                    }}
                                  >Cancelar</button>
                                  <button
                                    onClick={() => saveInlineAction(l)}
                                    style={{
                                      padding: "6px 12px", borderRadius: 7,
                                      background: isLight
                                        ? `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}CC 100%)`
                                        : `linear-gradient(135deg, ${meta.color}33, ${meta.color}18)`,
                                      border: `1px solid ${isLight ? "transparent" : meta.color + "55"}`,
                                      color: isLight ? "#FFFFFF" : meta.color,
                                      fontSize: 10.5, fontWeight: 800,
                                      fontFamily: fontDisp, letterSpacing: "0.02em",
                                      cursor: "pointer", transition: "all 0.15s",
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                      boxShadow: isLight ? `0 2px 6px ${meta.color}44` : "none",
                                    }}
                                  ><Save size={10} strokeWidth={2.6} /> Guardar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Bottom actions — Seguimientos + Tomar acción, misma altura */}
                      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div onClick={e => e.stopPropagation()}>
                          <FollowUpBadge lead={l} onUpdate={updateLead} T={T} fullWidth tint={meta.color} />
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setNotesLead(l); }}
                          style={{
                            width: "100%", height: 40, padding: "0 16px",
                            boxSizing: "border-box", borderRadius: 10,
                            background: isLight ? T.accentG : "#FFFFFF",
                            border: isLight ? "none" : "1px solid rgba(255,255,255,0.90)",
                            color: isLight ? "#FFFFFF" : "#040C18",
                            fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
                            letterSpacing: "-0.02em",
                            cursor: "pointer",
                            transition: "all 0.20s ease",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            boxShadow: isLight ? "0 2px 12px rgba(13,154,118,0.30)" : "0 2px 16px rgba(255,255,255,0.12)",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = isLight ? T.accentDark : "rgba(238,244,255,0.97)";
                            e.currentTarget.style.boxShadow = isLight ? "0 4px 18px rgba(13,154,118,0.40)" : "0 4px 22px rgba(255,255,255,0.20)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.querySelector(".arr").style.opacity = "1";
                            e.currentTarget.querySelector(".arr").style.transform = "translateX(2px)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isLight ? T.accentG : "#FFFFFF";
                            e.currentTarget.style.boxShadow = isLight ? "0 2px 12px rgba(13,154,118,0.30)" : "0 2px 16px rgba(255,255,255,0.12)";
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.querySelector(".arr").style.opacity = "0";
                            e.currentTarget.querySelector(".arr").style.transform = "translateX(-3px)";
                          }}
                        >
                          <span style={{ letterSpacing: "-0.02em" }}>Tomar acción</span>
                          <span className="arr" style={{
                            opacity: 0, transform: "translateX(-3px)",
                            transition: "all 0.18s ease",
                            fontSize: 14, lineHeight: 1, fontWeight: 300,
                          }}>→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                  })()}
                  {/* Insert-after indicator (last card) */}
                  {showInsertAfter && (
                    <div style={{ width: 3, borderRadius: 3, background: T.accent, boxShadow: `0 0 12px ${T.accent}80`, marginLeft: 4, alignSelf: "stretch", flexShrink: 0 }} />
                  )}
                  </div>
                );
              })}
            </div>
            </div>

            {/* ── Flechas superpuestas — ancladas al wrapper relativo ──────────────
                Se montan sobre el carrusel (position:absolute) centradas en Y.
                La flecha izquierda aparece solo cuando hay scroll previo.
                Ambas tienen glass backdrop + fade en los bordes del mask.
                ─────────────────────────────────────────────────────────────── */}
            {!isMobile && priorityLeads.length > 2 && (() => {
              // Botones discretos: baja opacidad en reposo, se afirman solo en hover.
              // Sin backdrop blur ni sombra pesada — deben ser utilidad, no protagonistas.
              const base = {
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 10, padding: 0,
                opacity: 0.45,
                transition: "opacity 0.18s ease, background 0.18s ease, border-color 0.18s ease",
                background: isLight ? "rgba(255,255,255,0.80)" : "rgba(12,17,28,0.70)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"}`,
                boxShadow: "none",
              };
              const onEnter = (e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.background = isLight ? "#FFFFFF" : "rgba(12,17,28,0.92)";
                e.currentTarget.style.borderColor = isLight ? `${T.accent}40` : "rgba(255,255,255,0.22)";
              };
              const onLeave = (e) => {
                e.currentTarget.style.opacity = "0.45";
                e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.80)" : "rgba(12,17,28,0.70)";
                e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)";
              };
              const ic = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)";
              return (
                <>
                  {prioScrollX > 4 && (
                    <button onClick={() => scrollCarousel(-1)} title="Anterior"
                      style={{ ...base, left: 4 }}
                      onMouseEnter={onEnter} onMouseLeave={onLeave}
                    >
                      <ChevronLeft size={13} color={ic} strokeWidth={2} />
                    </button>
                  )}
                  <button onClick={() => scrollCarousel(1)} title="Siguiente"
                    style={{ ...base, right: 4 }}
                    onMouseEnter={onEnter} onMouseLeave={onLeave}
                  >
                    <ChevronRight size={13} color={ic} strokeWidth={2} />
                  </button>
                </>
              );
            })()}
            </div>{/* cierra wrapper relativo */}
          </div>
        );
      })()}

      {/* ── MODAL NUEVO LEAD ── */}
      {addingLead && createPortal(
        <>
          <div onClick={() => setAddingLead(false)} style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: isLight ? "rgba(15,23,42,0.22)" : "rgba(2,5,12,0.78)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            animation: "fadeIn 0.20s ease both",
          }} />
          <div style={isMobile ? {
            // En mobile: modal full-screen — más cómodo para llenar el form
            // sin que el teclado virtual lo recorte.
            position: "fixed", inset: 0, zIndex: 501,
            width: "100vw", height: "100dvh", maxHeight: "100dvh",
            overflowY: "auto",
            background: isLight ? "#FFFFFF" : "#111318",
            border: "none",
            borderRadius: 0,
            boxShadow: "none",
            animation: "modalInMobile 0.24s cubic-bezier(0.16,1,0.3,1) both",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          } : {
            position: "fixed", top: "50%", left: "50%",
            zIndex: 501, width: "min(720px, 96vw)", maxHeight: "94vh",
            overflowY: "auto",
            background: isLight ? "#FFFFFF" : "#111318",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.borderH}`,
            borderRadius: 18,
            boxShadow: isLight
              ? "0 4px 12px rgba(15,23,42,0.08), 0 28px 80px rgba(15,23,42,0.12), 0 48px 120px rgba(15,23,42,0.08)"
              : "0 52px 100px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: "modalIn 0.26s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <style>{`
              @keyframes modalInMobile{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
            `}</style>

            {/* ── Header compacto (icono + título + X) ── */}
            <div style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : T.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: isLight
                ? `linear-gradient(180deg, ${T.accent}08 0%, transparent 100%)`
                : "transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: isLight ? `${T.accent}14` : `${T.accent}12`,
                  border: `1px solid ${isLight ? `${T.accent}40` : T.accentB}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: isLight ? `0 2px 8px ${T.accent}18` : "none",
                }}>
                  <UserCheck size={14} color={isLight ? (T.accentDark || T.accent) : T.accent} strokeWidth={2.4} />
                </div>
                <h3 style={{
                  fontSize: 15.5, fontWeight: 700,
                  color: isLight ? T.txt : "#FFFFFF",
                  fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0,
                }}>{L.newEntity}</h3>
                {/* Subtítulo: oculto en mobile (no cabe y rompe el header) */}
                {!isMobile && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: T.txt3, fontFamily: font, letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}>· Completa los campos del formulario</span>
                )}
              </div>
              <button onClick={() => setAddingLead(false)} style={{
                width: 30, height: 30, borderRadius: 9,
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.border}`,
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.16s", flexShrink: 0,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.05)" : T.glass; }}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={14} color={T.txt3} /></button>
            </div>


            {/* ── Formulario denso — todo en una pantalla, 2 columnas ── */}
            {(() => {
              const inputBg       = isLight ? "rgba(255,255,255,0.85)" : T.glass;
              const inputBorder   = isLight ? "rgba(15,23,42,0.08)" : T.border;
              const chipBg        = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.03)";
              const accentStrong  = isLight ? (T.accentDark || T.accent) : T.accent;
              const labelStyle = {
                fontSize: 9, fontWeight: 700, color: T.txt3,
                letterSpacing: "0.06em", textTransform: "uppercase",
                fontFamily: fontDisp, display: "flex", alignItems: "center", gap: 4, marginBottom: 5,
              };
              const inputStyle = {
                width: "100%", height: 34, padding: "0 11px",
                borderRadius: 9, background: inputBg,
                border: `1px solid ${inputBorder}`, color: T.txt,
                fontSize: 12.5, outline: "none", fontFamily: font,
                boxSizing: "border-box", transition: "all 0.18s",
              };
              const focusOn = (e) => {
                e.target.style.borderColor = T.accentB;
                e.target.style.boxShadow = `0 0 0 3px ${T.accent}10`;
              };
              const focusOff = (e, borderOverride) => {
                e.target.style.borderColor = borderOverride || inputBorder;
                e.target.style.boxShadow = "none";
              };
              const parsed = parseBudget(newLead.budget);
              const hasParsed = parsed > 0 && String(newLead.budget || "").trim() !== "";
              const budgetBorder = hasParsed ? `${T.accent}55` : inputBorder;
              return (
            <div style={{ padding: "12px 18px 0", display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: isMobile ? "10px" : "10px 12px" }}>

              {/* Nombre — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  <User size={9} color={T.txt3} /> Nombre <span style={{ color: accentStrong }}>*</span>
                </label>
                <input placeholder="Ej. Rafael García López"
                  value={newLead.n || ""} onChange={e => setNewLead(p => ({...p, n: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              {/* Teléfono + Email — side by side */}
              <div>
                <label style={labelStyle}>
                  <Phone size={9} color={T.txt3} /> Teléfono
                </label>
                <input placeholder="+52 998 123 4567" value={newLead.phone || ""} onChange={e => setNewLead(p => ({...p, phone: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <Mail size={9} color={T.txt3} /> Email
                  <span style={{ color: T.txt3, fontSize: 8, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <input placeholder="correo@ejemplo.com" value={newLead.email || ""} onChange={e => setNewLead(p => ({...p, email: e.target.value}))}
                  style={inputStyle}
                  onFocus={focusOn} onBlur={e => focusOff(e)}
                />
              </div>

              {/* ── Banner de duplicado ───────────────────────────────────
                  Se muestra cuando find_lead_duplicate encontró un lead con
                  mismo phone o email en la organización. Dos variantes:
                    · is_mine = true  → el lead ya es del asesor actual
                      (color informativo, CTA "Abrir ficha")
                    · is_mine = false → lo tiene OTRO asesor (color de alerta,
                      datos del dueño + CTA "Registrar de todas formas")
                  Si duplicateChecking y todavía no hay match, mostramos un
                  pill discreto "Verificando…" para que el asesor sepa que
                  el sistema está mirando. */}
              {(() => {
                if (duplicateChecking && !duplicateMatch) {
                  return (
                    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: T.txt3, fontFamily: font, padding: "2px 0 0 2px" }}>
                      <Search size={10} strokeWidth={2.2} style={{ opacity: 0.7 }} />
                      Verificando si ya existe en el CRM…
                    </div>
                  );
                }
                if (!duplicateMatch) return null;

                const isMine = !!duplicateMatch.is_mine;
                const matchKind = duplicateMatch.match_type === 'both'
                  ? 'mismo teléfono y email'
                  : duplicateMatch.match_type === 'phone'
                    ? 'mismo teléfono'
                    : 'mismo email';
                const fechaStr = (() => {
                  try {
                    const d = new Date(duplicateMatch.lead_created_at);
                    const mos = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
                    return `${d.getDate()} ${mos[d.getMonth()]} ${d.getFullYear()}`;
                  } catch (_) { return ''; }
                })();
                const baseColor = isMine ? T.accent : "#F5A623";
                const tintBg    = isLight
                  ? (isMine ? `${T.accent}10` : "rgba(245,166,35,0.10)")
                  : (isMine ? `${T.accent}14` : "rgba(245,166,35,0.14)");
                const tintBorder = isLight
                  ? (isMine ? `${T.accent}48` : "rgba(245,166,35,0.40)")
                  : (isMine ? `${T.accent}55` : "rgba(245,166,35,0.55)");
                const headColor = isLight
                  ? (isMine ? (T.accentDark || T.accent) : "#9A6A0A")
                  : baseColor;

                return (
                  <div style={{
                    gridColumn: "1 / -1",
                    background: tintBg,
                    border: `1px solid ${tintBorder}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex", gap: 10, alignItems: "flex-start",
                    fontFamily: font,
                  }}>
                    <AlertTriangle size={15} color={baseColor} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: headColor, fontFamily: fontDisp, letterSpacing: "-0.01em", marginBottom: 3 }}>
                        {isMine ? "Ya tienes este cliente en tu CRM" : "Este cliente ya está registrado en el CRM"}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.txt2, lineHeight: 1.45 }}>
                        <strong style={{ color: T.txt, fontWeight: 700 }}>{duplicateMatch.lead_name || "Sin nombre"}</strong>
                        {!isMine && (
                          <> · asignado a <strong style={{ color: T.txt, fontWeight: 700 }}>{duplicateMatch.asesor_name || "Sin asesor"}</strong></>
                        )}
                        {duplicateMatch.lead_stage && (
                          <> · etapa <strong style={{ color: T.txt }}>{duplicateMatch.lead_stage}</strong></>
                        )}
                        {fechaStr && <> · desde {fechaStr}</>}
                        <span style={{ color: T.txt3 }}> · coincide por {matchKind}</span>
                      </div>
                      {!isMine && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              // Cierra el modal y abre la ficha del lead existente
                              // si el usuario tiene permiso para verlo. Si no
                              // tiene permiso (RLS lo oculta), al menos cierra
                              // el modal — admins pueden ir a buscarlo manual.
                              const existing = leadsData.find(l => l.id === duplicateMatch.lead_id);
                              setAddingLead(false);
                              if (existing) {
                                openLeadDrawer(existing);
                              } else {
                                showToast(`"${duplicateMatch.lead_name}" pertenece a ${duplicateMatch.asesor_name || "otro asesor"}. Pide al administrador acceso o reasignación.`, "info");
                              }
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.18)"; e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.22)" : "rgba(255,255,255,0.24)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "none"; }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "7px 13px", borderRadius: 9,
                              background: isLight
                                ? "linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.02))"
                                : "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.03))",
                              border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)"}`,
                              color: isLight ? T.txt2 : T.txt,
                              fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
                              cursor: "pointer", fontFamily: font,
                              transition: "transform .16s cubic-bezier(.4,0,.2,1), filter .16s ease, border-color .16s ease",
                              WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            <Eye size={13} strokeWidth={2.1} style={{ opacity: 0.82, flexShrink: 0 }} />
                            Ver ficha existente
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateOverride(v => !v)}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = duplicateOverride ? "0 5px 16px rgba(245,166,35,0.40)" : "0 2px 9px rgba(245,166,35,0.16)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = duplicateOverride ? "0 3px 12px rgba(245,166,35,0.30)" : "none"; }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "7px 14px", borderRadius: 9,
                              background: duplicateOverride
                                ? "linear-gradient(135deg, rgba(248,176,55,0.97), rgba(229,138,18,0.94))"
                                : (isLight ? "rgba(245,166,35,0.09)" : "rgba(245,166,35,0.07)"),
                              border: `1px solid ${duplicateOverride ? "rgba(245,166,35,0.92)" : "rgba(245,166,35,0.42)"}`,
                              color: duplicateOverride ? "#231800" : baseColor,
                              fontSize: 11, fontWeight: duplicateOverride ? 700 : 600, letterSpacing: "0.01em",
                              cursor: "pointer", fontFamily: font,
                              boxShadow: duplicateOverride ? "0 3px 12px rgba(245,166,35,0.30)" : "none",
                              transition: "transform .16s cubic-bezier(.4,0,.2,1), filter .16s ease, box-shadow .16s ease",
                              WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            {duplicateOverride
                              ? <Check size={13} strokeWidth={2.7} style={{ flexShrink: 0 }} />
                              : <UserCheck size={13} strokeWidth={2.1} style={{ flexShrink: 0 }} />}
                            Registrar de todas formas
                          </button>
                        </div>
                      )}
                      {isMine && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              const existing = leadsData.find(l => l.id === duplicateMatch.lead_id);
                              setAddingLead(false);
                              if (existing) openLeadDrawer(existing);
                            }}
                            style={{
                              padding: "5px 11px", borderRadius: 8,
                              background: isLight ? `${T.accent}1C` : `${T.accent}1A`,
                              border: `1px solid ${T.accent}55`,
                              color: headColor,
                              fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                              fontFamily: font,
                            }}
                          >
                            Abrir ficha del cliente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Presupuesto — selector compacto con menú desplegable */}
              {(() => {
                const BUDGET_PRESETS = [
                  { label: "$100k", key: "100k" }, { label: "$150k", key: "150k" },
                  { label: "$200k", key: "200k" }, { label: "$250k", key: "250k" },
                  { label: "$300k", key: "300k" }, { label: "$400k", key: "400k" },
                  { label: "$500k", key: "500k" }, { label: "$600k", key: "600k" },
                  { label: "$750k", key: "750k" }, { label: "$1M",   key: "1M"   },
                  { label: "$1.5M", key: "1.5M" }, { label: "$2M+",  key: "2M"   },
                ];
                const activePreset = BUDGET_PRESETS.find(o => o.key === newLead.budget);
                const displayVal = activePreset ? activePreset.label : (newLead.budget || "");
                const hasValue = !!displayVal;
                return (
                  <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                    <label style={{ ...labelStyle, justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <DollarSign size={9} color={T.txt3} /> Presupuesto
                      </span>
                      {hasParsed && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: accentStrong, fontFamily: fontDisp, letterSpacing: "-0.005em", textTransform: "none" }}>
                          = {formatBudget(parsed)}
                        </span>
                      )}
                    </label>

                    {/* Trigger button — muestra valor seleccionado o placeholder */}
                    <button
                      type="button"
                      onClick={() => setBudgetMenuOpen(v => !v)}
                      style={{
                        width: "100%", padding: "10px 13px",
                        borderRadius: 10,
                        background: hasValue
                          ? (isLight ? `${T.accent}0C` : `${T.accent}0A`)
                          : inputBg,
                        border: `1px solid ${hasValue
                          ? (isLight ? `${T.accent}3A` : T.accentB)
                          : inputBorder}`,
                        color: hasValue ? accentStrong : T.txt3,
                        fontSize: 13, fontWeight: hasValue ? 700 : 400,
                        fontFamily: fontDisp,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.16s",
                        letterSpacing: "-0.01em",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                    >
                      <span>{hasValue ? displayVal : "Seleccionar presupuesto…"}</span>
                      <ChevronDown size={14} color={hasValue ? accentStrong : T.txt3} strokeWidth={2} style={{ flexShrink: 0, transition: "transform 0.18s", transform: budgetMenuOpen ? "rotate(180deg)" : "none" }} />
                    </button>

                    {/* Dropdown — grid de presets + custom input */}
                    {budgetMenuOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                        zIndex: 80,
                        background: isLight ? "#FFFFFF" : "#0D1119",
                        border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 12,
                        boxShadow: isLight
                          ? "0 8px 28px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.07)"
                          : "0 8px 32px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35)",
                        padding: "12px",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        {/* Grid 4×3 */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                          {BUDGET_PRESETS.map(opt => {
                            const active = newLead.budget === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => { setNewLead(p => ({...p, budget: opt.key})); setBudgetMenuOpen(false); }}
                                style={{
                                  padding: "7px 0", borderRadius: 8, textAlign: "center",
                                  background: active ? (isLight ? `${T.accent}1A` : `${T.accent}18`) : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"),
                                  border: `1px solid ${active ? (isLight ? `${T.accent}44` : T.accentB) : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)")}`,
                                  color: active ? accentStrong : T.txt2,
                                  fontSize: 12, fontWeight: active ? 700 : 500,
                                  fontFamily: fontDisp, cursor: "pointer",
                                  transition: "all 0.12s", letterSpacing: "-0.01em",
                                }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${T.accent}0D` : `${T.accent}10`; e.currentTarget.style.borderColor = isLight ? `${T.accent}3A` : T.accentB; e.currentTarget.style.color = isLight ? accentStrong : T.accent; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"; e.currentTarget.style.color = T.txt2; } }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        {/* Divider + custom input */}
                        <div style={{ borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`, paddingTop: 8 }}>
                          <input
                            placeholder="O escribe un monto: 350k · 1.2M · 2 mdd"
                            value={activePreset ? "" : (newLead.budget || "")}
                            onChange={e => setNewLead(p => ({...p, budget: e.target.value}))}
                            style={{ ...inputStyle, fontSize: 12 }}
                            onFocus={focusOn}
                            onBlur={e => focusOff(e)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Proyecto de interés — full width para dar espacio */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  <Building2 size={9} color={T.txt3} /> Proyecto de interés
                </label>
                <ClickDropdown
                  value={newLead.p || ""}
                  onChange={(v) => {
                    setNewLead(p => ({...p, p: v}));
                    if (v && !proyectosMaster.includes(v)) setCustomProyectos(prev => [...prev, v]);
                  }}
                  options={proyectosMaster}
                  placeholder="Gobernador 28, Portofino, Torre Esmeralda, Monarca 28…"
                  label="proyecto"
                  icon={Building2}
                  createLabel="Registrar nuevo proyecto"
                  T={T} isLight={isLight}
                />
              </div>

              {/* Campaña */}
              <div>
                <label style={labelStyle}>
                  <Signal size={9} color={T.txt3} /> Campaña / Fuente
                </label>
                <ClickDropdown
                  value={newLead.campana || ""}
                  onChange={(v) => {
                    setNewLead(p => ({...p, campana: v}));
                    if (v && !campanasMaster.includes(v) && !FB_CAMPAIGNS_BASE.includes(v)) setCustomCampanas(prev => [...prev, v]);
                  }}
                  options={campanasMaster}
                  placeholder="Seleccionar campaña…"
                  label="campaña"
                  icon={Signal}
                  createLabel="Nueva campaña"
                  T={T} isLight={isLight}
                />
              </div>

              {/* Asesor — abierto a todos. La RLS de Supabase asegura que un
                  asesor solo puede crear leads asignados a sí mismo o sin asesor,
                  y los admins pueden asignar a cualquiera. */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  <Users size={9} color={T.txt3} /> Asesor asignado
                  {isAdminRole && <span style={{ color: "#F87171", fontWeight: 700 }}> *</span>}
                </label>
                <ClickDropdown
                  value={newLead.asesor || ""}
                  onChange={(v) => setNewLead(p => ({...p, asesor: v}))}
                  options={asesoresMaster}
                  placeholder="Seleccionar asesor…"
                  label="asesor"
                  icon={Users}
                  createLabel="Nuevo asesor"
                  T={T} isLight={isLight}
                />
                {isAdminRole && !String(newLead.asesor || "").trim() && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#F87171", fontFamily: font, lineHeight: 1.35 }}>
                    Obligatorio: asigná un asesor. Si no, el cliente queda sin dueño y sin recordatorios.
                  </div>
                )}
              </div>

              {/* Etapa — selector compacto con menú desplegable */}
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <label style={labelStyle}>
                  <Waypoints size={9} color={T.txt3} /> Etapa inicial
                </label>
                {/* Trigger button */}
                {(() => {
                  const stageVal = newLead.st || DEFAULT_STAGE;
                  const stageCol = stgC[stageVal] || T.accent;
                  const stageTitleC = isLight ? `color-mix(in srgb, ${stageCol} 55%, #0B1220 45%)` : stageCol;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setStageMenuOpen(v => !v)}
                        style={{
                          width: "100%", padding: "10px 13px", borderRadius: 10,
                          background: isLight ? `${stageCol}0E` : `${stageCol}0C`,
                          border: `1px solid ${isLight ? `${stageCol}38` : `${stageCol}44`}`,
                          color: stageTitleC,
                          fontSize: 13, fontWeight: 600, fontFamily: font,
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          transition: "all 0.16s",
                          boxSizing: "border-box",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: stageCol, flexShrink: 0 }} />
                          {stageVal}
                        </span>
                        <ChevronDown size={14} color={stageTitleC} strokeWidth={2} style={{ flexShrink: 0, transition: "transform 0.18s", transform: stageMenuOpen ? "rotate(180deg)" : "none" }} />
                      </button>

                      {stageMenuOpen && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                          zIndex: 80,
                          background: isLight ? "#FFFFFF" : "#0D1119",
                          border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 12,
                          boxShadow: isLight
                            ? "0 8px 28px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.07)"
                            : "0 8px 32px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35)",
                          padding: "6px",
                          display: "flex", flexDirection: "column", gap: 2,
                          maxHeight: 280, overflowY: "auto",
                        }}>
                          {STAGES.map(s => {
                            const c = stgC[s] || T.txt3;
                            const active = newLead.st === s;
                            const cTitle = isLight ? `color-mix(in srgb, ${c} 55%, #0B1220 45%)` : c;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setNewLead(p => ({...p, st: s})); setStageMenuOpen(false); }}
                                style={{
                                  padding: "9px 12px", borderRadius: 8, textAlign: "left",
                                  background: active ? (isLight ? `${c}14` : `${c}10`) : "transparent",
                                  border: "none",
                                  color: active ? cTitle : T.txt2,
                                  fontSize: 12.5, fontWeight: active ? 700 : 400,
                                  fontFamily: font, cursor: "pointer",
                                  display: "flex", alignItems: "center", gap: 9,
                                  transition: "background 0.1s",
                                  width: "100%",
                                }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${c}0A` : `${c}0C`; e.currentTarget.style.color = isLight ? cTitle : c; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt2; } }}
                              >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                                {s}
                                {active && <CheckCircle2 size={12} color={cTitle} strokeWidth={2.5} style={{ marginLeft: "auto" }} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Próxima acción + Notas — lado a lado, compactos */}
              <div>
                <label style={labelStyle}>
                  <Zap size={9} color={accentStrong} /> Próxima acción
                  <span style={{ color: T.txt3, fontSize: 8.5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <textarea
                  placeholder="¿Qué hace el asesor mañana? Ej. Llamar 10am, mandar Torre 25…"
                  value={newLead.nextAction || ""}
                  onChange={e => setNewLead(p => ({...p, nextAction: e.target.value}))}
                  rows={2}
                  style={{ width: "100%", padding: "8px 11px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 9, color: T.txt, fontSize: 12, fontWeight: 500, outline: "none", fontFamily: font, boxSizing: "border-box", lineHeight: 1.45, resize: "none", display: "block", minHeight: 52, maxHeight: 72, overflowY: "auto", transition: "all 0.18s" }}
                  onFocus={focusOn}
                  onBlur={e => focusOff(e)}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  <FileText size={9} color={T.txt3} /> Notas
                  <span style={{ color: T.txt3, fontSize: 8.5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>opcional</span>
                </label>
                <textarea
                  placeholder="Preferencias, contexto, insights…"
                  value={newLead.notas || ""}
                  onChange={e => setNewLead(p => ({...p, notas: e.target.value}))}
                  rows={2}
                  style={{ width: "100%", padding: "8px 11px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 9, color: T.txt, fontSize: 12, fontWeight: 500, outline: "none", fontFamily: font, boxSizing: "border-box", lineHeight: 1.45, resize: "none", display: "block", minHeight: 52, maxHeight: 72, overflowY: "auto", transition: "all 0.18s" }}
                  onFocus={focusOn}
                  onBlur={e => focusOff(e)}
                />
              </div>

              {/* Canal de origen */}
              {(() => {
                const SOURCES = [
                  { key: "manual",    label: "Manual",    color: T.txt3   },
                  { key: "telegram",  label: "Telegram",  color: "#29B6F6" },
                  { key: "whatsapp",  label: "WhatsApp",  color: "#25D366" },
                  { key: "facebook",  label: "Facebook",  color: "#7EB8F0" },
                  { key: "web",       label: "Web",       color: T.violet  },
                ];
                return (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>
                      <Send size={9} color={T.txt3} /> Canal de origen
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SOURCES.map(({ key, label, color }) => {
                        const active = (newLead.source || "manual") === key;
                        const c = isLight ? `color-mix(in srgb, ${color} 60%, #0B1220 40%)` : color;
                        return (
                          <button key={key} type="button"
                            onClick={() => setNewLead(p => ({...p, source: key}))}
                            style={{
                              padding: "5px 13px", borderRadius: 99,
                              background: active ? (isLight ? `${color}18` : `${color}14`) : inputBg,
                              border: `1px solid ${active ? (isLight ? `${color}50` : `${color}55`) : inputBorder}`,
                              color: active ? c : T.txt3,
                              fontSize: 11, fontWeight: active ? 700 : 500,
                              cursor: "pointer", fontFamily: font,
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isLight ? `${color}0A` : `${color}0C`; e.currentTarget.style.borderColor = isLight ? `${color}30` : `${color}30`; e.currentTarget.style.color = c; }}}
                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = inputBg; e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.color = T.txt3; }}}
                          >{label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            );
            })()}

            {/* ── Footer ── */}
            {(() => {
              const accentStrong = isLight ? (T.accentDark || T.accent) : T.accent;
              // Bloqueamos el submit si hay duplicado de OTRO asesor sin override.
              // Si is_mine, no bloqueamos (es decisión del asesor crear otro lead
              // con el mismo contacto — quizá es un caso distinto).
              const dupBlocks = !!(duplicateMatch && !duplicateOverride && !duplicateMatch.is_mine);
              // Un admin debe asignar asesor (no dejar leads huérfanos sin dueño).
              const asesorMissing = isAdminRole && !String(newLead.asesor || "").trim();
              const canSubmit = newLead.n.trim() && !dupBlocks && !asesorMissing;
              const primaryBg = canSubmit
                ? (isLight
                    ? `linear-gradient(135deg, ${T.accent} 0%, #14B892 100%)`
                    : "#FFFFFF")
                : (isLight ? "rgba(15,23,42,0.06)" : T.glass);
              const primaryColor = canSubmit
                ? (isLight ? "#FFFFFF" : "#040C18")
                : T.txt3;
              const primaryBorder = canSubmit
                ? (isLight ? "transparent" : "rgba(255,255,255,0.90)")
                : (isLight ? "rgba(15,23,42,0.08)" : T.border);
              const primaryShadow = canSubmit && isLight
                ? `0 4px 14px ${T.accent}48, 0 2px 6px ${T.accent}28, inset 0 1px 0 rgba(255,255,255,0.35)`
                : canSubmit
                  ? "0 2px 16px rgba(255,255,255,0.12)"
                  : "none";
              return (
            <div style={{ padding: "14px 18px 16px", display: "flex", gap: 8 }}>
              <button onClick={() => setAddingLead(false)} style={{
                flex: 1, height: 38, borderRadius: 10,
                background: "transparent",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.border}`,
                color: T.txt3, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer", fontFamily: font, transition: "all 0.18s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : T.glass; e.currentTarget.style.color = T.txt2; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; }}
              >Cancelar</button>
              <button
                onClick={addNewLead}
                disabled={!canSubmit || submittingLead}
                title={dupBlocks ? "Confirma el aviso de duplicado antes de registrar" : (asesorMissing ? "Asigná un asesor para registrar el cliente" : undefined)}
                style={{
                flex: 2.4, height: 40, borderRadius: 10,
                background: primaryBg,
                border: `1px solid ${primaryBorder}`,
                color: primaryColor,
                fontSize: 12.5, fontWeight: 700,
                cursor: (canSubmit && !submittingLead) ? "pointer" : "not-allowed",
                fontFamily: fontDisp, letterSpacing: "-0.02em",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: primaryShadow,
              }}
                onMouseEnter={e => {
                  if (!canSubmit) return;
                  if (isLight) {
                    e.currentTarget.style.boxShadow = `0 6px 20px ${T.accent}60, 0 3px 10px ${T.accent}38, inset 0 1px 0 rgba(255,255,255,0.45)`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  } else {
                    e.currentTarget.style.background = "rgba(238,244,255,0.97)";
                    e.currentTarget.style.boxShadow = "0 4px 22px rgba(255,255,255,0.20)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={e => {
                  if (!canSubmit) return;
                  e.currentTarget.style.background = primaryBg;
                  e.currentTarget.style.boxShadow = primaryShadow;
                  e.currentTarget.style.transform = "none";
                }}
              >
                <UserCheck size={13} strokeWidth={2.4} />
                {dupBlocks ? "Ya existe en el CRM" : (asesorMissing ? "Asigná un asesor" : "Registrar cliente")}
              </button>
            </div>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* ── PIPELINE STAGE STRIP ── En mobile: scroll horizontal con snap
          (cada etapa ocupa ~28% del viewport, suficiente para leer count+nombre).
          En desktop: una sola fila con flex-1 que comparte el ancho total.
          Cuando showMetrics está activo, ocultamos vía display:none para evitar
          unmounts que perderían estado del filtro/búsqueda. ── */}
      <div className={isMobile ? "carousel-no-scroll" : ""} style={{
        display: showMetrics ? "none" : "flex", gap: 0,
        borderRadius: 12,
        overflow: isMobile ? "auto" : "hidden",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
        background: isLight ? "#FFFFFF" : "rgba(11,16,26,0.72)",
        backdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
        WebkitBackdropFilter: isLight ? "none" : "blur(40px) saturate(150%)",
        boxShadow: isLight
          ? "0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 2px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
        scrollSnapType: isMobile ? "x mandatory" : "none",
        WebkitOverflowScrolling: "touch",
      }}>
        {STAGES.slice(0,-1).map((stage, idx) => {
          const cnt = visibleLeads.filter(l => l.st === stage).length;
          const c = stgC[stage] || T.txt3;
          const isActive = filterStage === stage;
          const hasCount = cnt > 0;
          const divider = idx < STAGES.length - 2;
          // Identidad visual consistente: cada etapa siempre tiene su acento de color,
          // solo varía la intensidad. Las etapas vacías (cnt=0) siguen siendo legibles
          // en lugar de quedar fantasmales — UX consistente sin huecos en el carrusel.
          const accentBg = isActive
            ? c
            : hasCount
              ? `${c}70`
              : `${c}38`;
          const countColor = isActive
            ? c
            : hasCount
              ? (isLight ? T.txt : "rgba(255,255,255,0.92)")
              : (isLight ? "rgba(15,23,42,0.42)" : "rgba(255,255,255,0.46)");
          const labelColor = isActive
            ? c
            : hasCount
              ? (isLight ? T.txt3 : "rgba(255,255,255,0.55)")
              : (isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.42)");
          return (
            <div key={stage} onClick={() => setFilterStage(isActive ? "TODO" : stage)}
              title={`${stage} · ${cnt} cliente${cnt !== 1 ? "s" : ""}`}
              style={{
                // En mobile: cada chip toma 30% del viewport → 3 visibles + peek;
                // en desktop: flex:1 reparte el ancho entre todas las etapas.
                flex: isMobile ? "0 0 30%" : 1,
                minWidth: isMobile ? "30%" : 0,
                scrollSnapAlign: isMobile ? "start" : "none",
                padding: isMobile ? "12px 4px 11px" : "10px 4px 9px",
                cursor: "pointer",
                borderRight: divider ? `1px solid ${isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.04)"}` : "none",
                background: isActive
                  ? (isLight ? `${c}10` : `${c}14`)
                  : "transparent",
                transition: "background 0.18s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                position: "relative",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isLight ? `${c}08` : "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Top accent line — siempre visible para mantener identidad de etapa */}
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%", height: 2, borderRadius: "0 0 2px 2px",
                background: accentBg,
                transition: "background 0.18s, box-shadow 0.18s",
                boxShadow: isActive ? `0 0 8px ${c}90` : "none",
              }} />
              {/* Count */}
              <span style={{
                fontSize: 19, fontWeight: 800, lineHeight: 1,
                color: countColor,
                fontFamily: fontDisp, letterSpacing: "-0.03em",
                transition: "color 0.18s",
              }}>{cnt}</span>
              {/* Stage label */}
              <span style={{
                fontSize: 8,
                color: labelColor,
                fontWeight: isActive ? 800 : 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                textAlign: "center", lineHeight: 1.25,
                maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: fontDisp, transition: "color 0.18s",
              }}>{stage}</span>
            </div>
          );
        })}
      </div>

      {/* ── MAIN TABLE / KANBAN ── Oculto cuando estamos viendo Indicadores. */}
      <G T={T} np style={{ display: showMetrics ? "none" : undefined }}>
        {/* ── Toolbar — solo desktop muestra el View toggle (Lista/Kanban).
              Mobile siempre fuerza Lista (kanban no es usable en teléfono). ── */}
        <div style={{
          padding: isMobile ? "10px 12px" : "11px 18px",
          borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.055)"}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}>

          {/* View toggle — solo desktop */}
          {!isMobile && (
            <div style={{
              display: "flex", borderRadius: 9, overflow: "hidden", flexShrink: 0,
              background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {[["list","Lista"],["kanban","Kanban"]].map(([m, lbl]) => {
                const isActive = viewMode === m;
                return (
                  <button key={m} onClick={() => setViewMode(m)} style={{
                    padding: "5px 13px", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: fontDisp,
                    letterSpacing: "0.01em",
                    background: isActive
                      ? (isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)")
                      : "transparent",
                    color: isActive
                      ? (isLight ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.88)")
                      : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)"),
                    borderRight: m === "list" ? `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)"}` : "none",
                    transition: "all 0.16s",
                    boxShadow: isActive && !isLight ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
                  }}>{lbl}</button>
                );
              })}
            </div>
          )}

          {/* Search — full width en mobile, max 240 en desktop */}
          <div style={{ position: "relative", flex: 1, minWidth: 140, maxWidth: isMobile ? "100%" : 240, width: isMobile ? "100%" : "auto" }}>
            <Search size={isMobile ? 14 : 11} color={isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.28)"} style={{ position: "absolute", left: isMobile ? 14 : 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={isMobile ? "Buscar cliente…" : "Buscar cliente, asesor, proyecto…"}
              data-stratos-search-input="1"
              style={{
                width: "100%", paddingLeft: isMobile ? 36 : 29, paddingRight: searchQ ? 32 : 11,
                height: isMobile ? 44 : 32, borderRadius: isMobile ? 12 : 9,
                background: isLight ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.042)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)"}`,
                fontSize: isMobile ? 14 : 11.5, color: isLight ? T.txt : "rgba(255,255,255,0.80)",
                outline: "none", fontFamily: fontDisp, boxSizing: "border-box", transition: "border-color 0.18s",
              }}
              onFocus={e => { e.target.style.borderColor = isLight ? T.accent : "rgba(255,255,255,0.22)"; }}
              onBlur={e => { e.target.style.borderColor = isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.08)"; }}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: isLight ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.30)", display: "flex", padding: 0 }}><X size={10} /></button>}
          </div>

          {/* Stage filter — solo desktop. En mobile el stage strip de arriba
              ya cumple la misma función con mejor affordance táctil. */}
          {!isMobile && (() => {
            const active = filterStage !== "TODO";
            const selBg  = isLight ? (active ? `${stgC[filterStage]}10` : "rgba(255,255,255,0.70)") : (active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.042)");
            const selBdr = isLight ? (active ? `${stgC[filterStage]}40` : "rgba(15,23,42,0.09)") : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
            const selClr = isLight ? (active ? stgC[filterStage] : "rgba(15,23,42,0.45)") : (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)");
            return (
              <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{
                  height: 32, padding: "0 30px 0 12px",
                  borderRadius: 9, appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                  background: selBg, border: `1px solid ${selBdr}`,
                  fontSize: 11, color: selClr, cursor: "pointer", outline: "none",
                  fontFamily: fontDisp, fontWeight: active ? 600 : 400, transition: "all 0.18s",
                }}>
                  <option value="TODO">Todas las etapas</option>
                  {STAGES.map(s => <option key={s} value={s} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>{s}</option>)}
                </select>
                <ChevronDown size={10} color={selClr} strokeWidth={2.2} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }} />
              </div>
            );
          })()}

          {/* Orden de la lista — "Más recientes" (default) mantiene a los
              leads recién llegados arriba. Desktop-only, igual que el filtro
              de etapa; en mobile el orden por defecto ya aplica aunque el
              control no se muestre. */}
          {!isMobile && (() => {
            const SORT_OPTS = [
              { v: 'fechaIngreso', label: 'Más recientes' },
              { v: 'proxZoom',     label: 'Próximo Zoom' },
              { v: 'presupuesto',  label: 'Mayor presupuesto' },
              { v: 'sc',           label: 'Mayor score' },
            ];
            const known  = SORT_OPTS.some(o => o.v === sortField);
            const active = sortField !== 'fechaIngreso';
            const selBg  = isLight ? (active ? `${T.accent}10` : "rgba(255,255,255,0.70)") : (active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.042)");
            const selBdr = isLight ? (active ? `${T.accent}40` : "rgba(15,23,42,0.09)") : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
            const selClr = isLight ? (active ? T.accent : "rgba(15,23,42,0.45)") : (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)");
            return (
              <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <select
                  value={known ? sortField : '__custom'}
                  onChange={e => { const v = e.target.value; if (v === '__custom') return; setSortField(v); setSortDir('desc'); }}
                  title="Ordenar la lista"
                  style={{
                    height: 32, padding: "0 30px 0 12px",
                    borderRadius: 9, appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                    background: selBg, border: `1px solid ${selBdr}`,
                    fontSize: 11, color: selClr, cursor: "pointer", outline: "none",
                    fontFamily: fontDisp, fontWeight: active ? 600 : 400, transition: "all 0.18s",
                  }}>
                  {SORT_OPTS.map(o => (
                    <option key={o.v} value={o.v} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>{o.label}</option>
                  ))}
                  {!known && <option value="__custom" disabled style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>Orden personalizado</option>}
                </select>
                <ChevronDown size={10} color={selClr} strokeWidth={2.2} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }} />
              </div>
            );
          })()}

          {/* Asesor filter — más alto en mobile (44px) para que sea cómodo el tap */}
          {canSeeAll && (() => {
            const active = filterAsesor !== "TODO";
            const selBg  = isLight ? (active ? `${T.accent}10` : "rgba(255,255,255,0.70)") : (active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.042)");
            const selBdr = isLight ? (active ? `${T.accent}40` : "rgba(15,23,42,0.09)") : (active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
            const selClr = isLight ? (active ? T.accent : "rgba(15,23,42,0.45)") : (active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)");
            return (
              <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0, width: isMobile ? "100%" : "auto" }}>
                <select value={filterAsesor} onChange={e => setFilterAsesor(e.target.value)} style={{
                  height: isMobile ? 44 : 32, width: isMobile ? "100%" : "auto",
                  padding: isMobile ? "0 36px 0 14px" : "0 30px 0 12px",
                  borderRadius: isMobile ? 12 : 9, appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                  background: selBg, border: `1px solid ${selBdr}`,
                  fontSize: isMobile ? 14 : 11, color: selClr, cursor: "pointer", outline: "none",
                  fontFamily: fontDisp, fontWeight: active ? 600 : 400, transition: "all 0.18s",
                }}>
                  <option value="TODO">Todos los asesores</option>
                  {asesores.map(a => <option key={a} value={a} style={{ background: isLight ? "#FFFFFF" : "#111318", color: isLight ? "#0B1220" : "#E2E8F0" }}>{a.split(" ")[0]} {a.split(" ")[1] || ""}</option>)}
                </select>
                <ChevronDown size={10} color={selClr} strokeWidth={2.2} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", flexShrink: 0 }} />
              </div>
            );
          })()}

          {/* Clear filters */}
          {(filterStage !== "TODO" || filterAsesor !== "TODO" || searchQ) && (
            <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }}
              style={{
                height: 32, padding: "0 11px", borderRadius: 9,
                background: "transparent",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.09)"}`,
                color: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
                fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: fontDisp,
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5, transition: "all 0.16s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.18)"; e.currentTarget.style.color = isLight ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.60)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.09)" : "rgba(255,255,255,0.09)"; e.currentTarget.style.color = isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)"; }}
            ><X size={10} strokeWidth={2} /> Limpiar</button>
          )}

          <div style={{ flex: 1 }} />

          {/* Reasignar varios — activa la selección múltiple para reasignar en
              grupo. Solo desktop + admin/director. */}
          {!isMobile && canBulkReassign && (
            <button
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
              title={bulkMode ? "Salir de selección múltiple" : "Seleccionar varios leads y reasignarlos en grupo"}
              style={{
                height: 32, padding: "0 12px", borderRadius: 9, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: fontDisp,
                border: `1px solid ${bulkMode ? T.accent : (isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)")}`,
                background: bulkMode ? (isLight ? `${T.accent}18` : `${T.accent}1E`) : "transparent",
                color: bulkMode
                  ? (isLight ? `color-mix(in srgb, ${T.accent} 55%, #0B1220 45%)` : T.accent)
                  : (isLight ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.6)"),
                transition: "all 0.15s",
              }}
            >
              {bulkMode ? <X size={13} strokeWidth={2.4} /> : <Users size={13} strokeWidth={2.2} />}
              {bulkMode ? "Cancelar" : "Reasignar varios"}
            </button>
          )}

          {/* Count badge — solo desktop. En mobile el header ya muestra el total. */}
          {!isMobile && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, fontFamily: fontDisp, letterSpacing: "0.02em",
              color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.32)",
              background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.07)"}`,
              padding: "4px 12px", borderRadius: 99, flexShrink: 0,
            }}>
              {sortedLeads.length} resultado{sortedLeads.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── LIST VIEW — Redesigned ── */}
        {effectiveViewMode === "list" && (
          <>
            {/* Column headers — solo visibles en desktop. En mobile cada fila
                es una "card" vertical sin necesidad de encabezados. */}
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", background: isLight ? "rgba(15,23,42,0.015)" : "rgba(255,255,255,0.012)" }}>
                <SH label="Cliente" field="n" />
                <SH label="Presupuesto" field="presupuesto" align="right" />
                <SH label="Etapa" field="st" align="center" />
                <SH label="Seguim." field="seguimientos" align="center" />
                {!co && <SH label="Score" field="sc" align="center" />}
                <span style={{ fontSize: 9.5, fontWeight: 700, color: T.txt3, fontFamily: fontDisp, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>Acciones</span>
              </div>
            )}

            {listLeads.map((l, rowIdx) => {
              const sc = l.sc;
              const scoreColor = T.accent;
              const showUrgency = l.daysInactive >= 5;
              const uc = urgColor(l.daysInactive);
              const stageC = stgC[l.st] || T.txt3;
              const isPinnedRow = pinnedIds.has(l.id);
              const isJustNew   = !!l.isNew;
              const isPulsing   = justRegisteredId === l.id; // solo los primeros 10s
              // Azul (T.blue) reemplaza al dorado para el highlight del lead pinneado.
              // Reduce saturación de amarillos en la lista: la estrella dorada
              // del botón estrella es el ÚNICO punto cálido — banda + fondo
              // ahora son azules para mantener coherencia con la paleta.
              const pinRow  = T.blue;
              // Verde menta de la marca — del design system (T.accent)
              const mintRow = T.accent;
              // Fila marcada para reasignación por lote. Tiene prioridad visual
              // sobre isNew/pinned: cuando marcas algo, debe verse marcado al
              // instante (el checkbox lleno + banda menta lo hacen inconfundible).
              const isSelected = canBulkReassign && selectedIds.has(l.id);

              // Fondo base — selección > isNew > pinneado.
              const baseBg = isSelected
                ? (isLight ? `${mintRow}16` : `${mintRow}20`)
                : isJustNew
                ? (isLight ? `${mintRow}12` : `${mintRow}1A`)
                : isPinnedRow
                  ? (isLight ? `${pinRow}0E` : `${pinRow}10`)
                  : "transparent";
              const hoverBg = isSelected
                ? (isLight ? `${mintRow}24` : `${mintRow}2E`)
                : isJustNew
                ? (isLight ? `${mintRow}1F` : `${mintRow}26`)
                : isPinnedRow
                  ? (isLight ? `${pinRow}1A` : `${pinRow}1C`)
                  : (isLight ? "rgba(15,23,42,0.022)" : "rgba(255,255,255,0.028)");

              // Banda izquierda + halo — menta para selección/isNew, azul para pinneado.
              const rowShadow = isSelected
                ? `inset 3px 0 0 ${mintRow}, 0 0 0 1px ${mintRow}45`
                : isJustNew
                ? `inset 4px 0 0 ${mintRow}, 0 0 0 1px ${mintRow}55, 0 0 18px ${mintRow}33`
                : isPinnedRow
                  ? `inset 3px 0 0 ${pinRow}`
                  : "none";

              return (
                <div key={l.id}
                  data-lead-row={l.id}
                  // Hover manejado vía DOM directo (no setState) para evitar
                  // re-render de TODA la lista al pasar el mouse de fila en
                  // fila — antes hoveredRow vivía en el state del padre y
                  // cambiarlo causaba que las 80+ filas se re-renderizaran.
                  onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                  onClick={(e) => handleRowOpen(e, l)}
                  style={{
                    display: "grid", gridTemplateColumns: cols,
                    gap: isMobile ? 8 : 14,
                    padding: isMobile ? "12px 14px" : "11px 20px",
                    borderBottom: `1px solid ${T.border}`,
                    alignItems: isMobile ? "stretch" : "center",
                    transition: "background 0.14s, box-shadow 0.4s",
                    background: baseBg,
                    position: "relative",
                    boxShadow: rowShadow,
                    // Pulso animado solo los primeros 10s tras registrar — atrae
                    // el ojo al instante y luego queda el halo estático mientras
                    // isNew=true (= hasta que el asesor abra el lead).
                    // 12 iteraciones × 1.6s ≈ 19.2s — respira durante toda la
                    // ventana de halo (HALO_DURATION_MS = 20s).
                    animation: isPulsing ? "stratosNewLeadPulse 1.6s ease-in-out 0s 12" : undefined,
                    // Fila clickeable (zonas vacías + avatar abren Discovery).
                    // En modo bulk reassign, cursor "cell" sugiere "esto se
                    // selecciona/deselecciona al clicar".
                    cursor: bulkMode && canBulkReassign ? "cell" : "pointer",
                  }}
                >

                  {/* ═══ CLIENTE ═══ Avatar + identidad. Primera línea tiene
                       nombre, tags y presupuesto (right-aligned con spacer flex).
                       Segunda línea: asesor · proyecto · fecha · campaña. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    {/* Avatar — rounded square, initial, accent tint.
                        Click → abre el Discovery (vía el onClick de la fila). */}
                    <div title={L.viewDetail} style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: isLight
                        ? `linear-gradient(145deg, ${T.violet}1A 0%, ${T.violet}0D 100%)`
                        : `linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
                      border: `1px solid ${isLight ? `${T.violet}38` : "rgba(255,255,255,0.10)"}`,
                      boxShadow: isLight
                        ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px ${T.violet}14`
                        : `inset 0 1px 0 rgba(255,255,255,0.07)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800,
                      color: isLight ? `color-mix(in srgb, ${T.violet} 62%, #0B1220 38%)` : "rgba(255,255,255,0.72)",
                      flexShrink: 0, fontFamily: fontDisp, letterSpacing: "-0.01em",
                    }}>{l.n.charAt(0)}</div>

                    {/* Identity block — fills remaining width */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Row 1: name · tags · [spacer] · budget — todos inline-editables */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, minWidth: 0 }}>
                        <span
                          onClick={e => e.stopPropagation()}
                          title={l.n}
                          style={{ minWidth: 0, flex: "1 1 auto", overflow: "hidden", display: "block" }}
                        >
                          <InlineEdit
                            value={l.n}
                            onSave={v => updateLead({ ...l, n: v })}
                            T={T} isLight={isLight}
                            placeholder={L.entityNamePlaceholder}
                            readStyle={{
                              fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.018em",
                              color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp,
                              // Una sola línea con ellipsis — ya no se rompe
                              // mid-word ("Aria m" o "Migu el"). El title del
                              // span padre muestra el nombre completo on hover.
                              display: "block", maxWidth: "100%",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}
                            editStyle={{ fontSize: 13.5, fontWeight: 700, fontFamily: fontDisp }}
                          />
                        </span>

                        {l.isNew && (
                          <span style={{
                            fontSize: 7, fontWeight: 800, letterSpacing: "0.09em",
                            color: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
                            background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)"}`,
                            padding: "1.5px 5px", borderRadius: 99, flexShrink: 0,
                          }}>NUEVO</span>
                        )}
                      </div>

                      {/* Row 2: asesor · proyecto · fecha · campaña · fuente —
                          metadata gris discreta. Tamaño reducido y opacidad baja
                          para que jerárquicamente quede por debajo del nombre +
                          presupuesto. La fuente (WhatsApp / Facebook / etc.)
                          vive aquí en lugar de un badge prominente — la info
                          está pero no roba protagonismo. */}
                      <div style={{
                        fontSize: 10, fontWeight: 500,
                        color: isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.42)",
                        fontFamily: font,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        lineHeight: 1.3, letterSpacing: "0.003em",
                      }}>
                        {[
                          l.asesor?.split(" ")[0],
                          (l.p || "").split("·")[0].trim() || null,
                          (!co && l.fechaIngreso) ? l.fechaIngreso : null,
                          l.campana || null,
                          l.source && l.source !== "manual" ? (SRC_META[l.source]?.label || l.source) : null,
                        ].filter(Boolean).join(" · ")}
                      </div>

                      {/* Row 3: info chips — fecha de cita + email + CTAs.
                          Para etapas con cita programada (Zoom Agendado,
                          Reactivar Zoom, Visita Agendada) la pill se renderea
                          PROMINENTE, y si falta la fecha aparece un CTA vibrante
                          para que el asesor la capture. Seguimiento + Apartó
                          también muestran fecha porque cargan próxima acción. */}
                      {(() => {
                        const isAgendaCritical = ["Zoom Agendado","Reactivar Zoom","Visita Agendada","Seguimiento","Apartó"].includes(l.st);
                        const hasAppt = !!l.nextActionDate;
                        const showMissingCita = isAgendaCritical && !hasAppt;
                        const isEditing = editingApptId === l.id;
                        const showEmpty = !hasAppt && !l.email && !l.phone && !showMissingCita && !isEditing;
                        if (showEmpty) return null;

                        const startEdit = (e) => {
                          e.stopPropagation();
                          setApptDraft(l.nextActionDate || "");
                          setEditingApptId(l.id);
                        };
                        const commitEdit = () => {
                          const v = apptDraft.trim();
                          const prevV = (l.nextActionDate || "").trim();
                          if (v !== prevV) updateLead({ ...l, nextActionDate: v });
                          setEditingApptId(null); setApptDraft("");
                        };
                        const cancelEdit = () => { setEditingApptId(null); setApptDraft(""); };

                        return (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 6, marginTop: 5,
                            flexWrap: "wrap",
                          }}>
                            {/* Input inline en modo edición — reemplaza la pill */}
                            {isEditing ? (
                              <span
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 7,
                                  padding: "5px 12px 5px 10px",
                                  borderRadius: 99,
                                  background: isLight ? `${stageC}1F` : `${stageC}24`,
                                  border: `1.5px solid ${stageC}`,
                                  boxShadow: isLight ? `0 1px 2px ${stageC}30` : `0 0 14px ${stageC}33`,
                                  flexShrink: 0,
                                }}
                              >
                                <CalendarDays size={13} strokeWidth={2.5}
                                  color={isLight ? `color-mix(in srgb, ${stageC} 50%, #0B1220 50%)` : stageC} />
                                <input
                                  autoFocus
                                  value={apptDraft}
                                  placeholder="Mañana 10am · Hoy 5pm · 14 may 4pm"
                                  onChange={e => setApptDraft(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onBlur={commitEdit}
                                  onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                                  }}
                                  style={{
                                    minWidth: 200, padding: 0,
                                    background: "transparent", border: "none", outline: "none",
                                    color: isLight ? `color-mix(in srgb, ${stageC} 35%, #0B1220 65%)` : "#FFFFFF",
                                    fontSize: 11.5, fontWeight: 800, fontFamily: font,
                                    letterSpacing: "0.005em",
                                  }}
                                />
                              </span>
                            ) : hasAppt ? (
                              /* Pill de cita — minimalista: borde discreto, sin sombra,
                                 sin gradient. Solo el icono y la fecha. La etapa ya
                                 indica que es una cita; no necesitamos un sub-label. */
                              <button
                                onClick={startEdit}
                                title={l.nextAction
                                  ? `${l.nextAction} — ${l.nextActionDate} · click para editar`
                                  : `Próxima acción · ${l.nextActionDate} · click para editar`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 10px 3px 8px",
                                  borderRadius: 99,
                                  background: "transparent",
                                  border: `1px solid ${stageC}${isLight ? "55" : "38"}`,
                                  color: isLight
                                    ? `color-mix(in srgb, ${stageC} 55%, #0B1220 45%)`
                                    : stageC,
                                  fontSize: 10.5, fontWeight: 600,
                                  fontFamily: font,
                                  cursor: "text", outline: "none",
                                  transition: "background 0.14s, border-color 0.14s",
                                  whiteSpace: "nowrap", flexShrink: 0,
                                  letterSpacing: "0.005em",
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = isLight ? `${stageC}10` : `${stageC}14`;
                                  e.currentTarget.style.borderColor = `${stageC}${isLight ? "80" : "55"}`;
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.borderColor = `${stageC}${isLight ? "55" : "38"}`;
                                }}
                              >
                                <CalendarDays size={11} strokeWidth={2.2} />
                                <span>{l.nextActionDate}</span>
                              </button>
                            ) : null}

                            {/* CTA cuando falta la fecha en etapa con cita — minimalista
                               (sin pulse, sin shadow). Color azul (derivado de T.blue)
                               en lugar de ámbar para reducir saturación de amarillos
                               en la lista. La estrella dorada del pinned ya aporta
                               un único punto cálido — no necesitamos competirle. */}
                            {!isEditing && showMissingCita && (
                              <button
                                onClick={startEdit}
                                title="Click para agendar fecha/hora de la cita"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 10px 3px 8px", borderRadius: 99,
                                  background: "transparent",
                                  border: `1px dashed ${T.blue}${isLight ? "60" : "44"}`,
                                  color: isLight ? `color-mix(in srgb, ${T.blue} 55%, #0B1220 45%)` : T.blue,
                                  fontSize: 10.5, fontWeight: 600, fontFamily: font,
                                  cursor: "text", outline: "none",
                                  transition: "background 0.14s, border-style 0.14s",
                                  whiteSpace: "nowrap", flexShrink: 0,
                                  letterSpacing: "0.005em",
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = `${T.blue}${isLight ? "12" : "16"}`;
                                  e.currentTarget.style.borderStyle = "solid";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.borderStyle = "dashed";
                                }}
                              >
                                <CalendarDays size={11} strokeWidth={2.2} />
                                <span>Agendar fecha</span>
                              </button>
                            )}

                            {/* Phone chip — junto al email, mismo estilo discreto.
                                Inline-editable. Para llamar, usar el botón de
                                contacto del drawer (no abrimos tel: aquí para
                                evitar dialer accidental al click). */}
                            <span
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: "inline-flex", flexShrink: 0, minWidth: 0,
                              }}
                            >
                              <InlineEdit
                                value={l.phone}
                                onSave={v => updateLead({ ...l, phone: (v || "").trim() || null })}
                                T={T} isLight={isLight}
                                placeholder="+52 998 123 4567"
                                emptyText=""
                                displayValue={v => (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                    <Phone
                                      size={11} strokeWidth={2.2}
                                      style={{ flexShrink: 0, opacity: 0.7 }}
                                    />
                                    <span style={{
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                      {v || "+ teléfono"}
                                    </span>
                                  </span>
                                )}
                                readStyle={{
                                  display: "inline-flex", alignItems: "center",
                                  padding: "3px 10px", borderRadius: 99,
                                  background: "transparent",
                                  border: `1px ${l.phone ? "solid" : "dashed"} ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                                  color: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)",
                                  fontSize: 10.5, fontWeight: 500,
                                  fontFamily: font,
                                  maxWidth: 180, overflow: "hidden",
                                  whiteSpace: "nowrap", flexShrink: 0, minWidth: 0,
                                  margin: 0, fontStyle: "normal",
                                }}
                                editStyle={{ fontSize: 11, fontFamily: font, width: isMobile ? "100%" : 180, maxWidth: "100%" }}
                              />
                            </span>

                            {/* Email chip — visible siempre con estilo discreto
                                para no competir con el chip de cita. Inline-editable.
                                Para abrir mailto, usar el botón de contacto del drawer. */}
                            <span
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: "inline-flex", flexShrink: 1, minWidth: 0,
                              }}
                            >
                              <InlineEdit
                                value={l.email}
                                onSave={v => updateLead({ ...l, email: (v || "").trim() || null })}
                                T={T} isLight={isLight}
                                placeholder="email@cliente.com"
                                emptyText=""
                                displayValue={v => (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                    <Mail
                                      size={11} strokeWidth={2.2}
                                      style={{ flexShrink: 0, opacity: 0.7 }}
                                    />
                                    <span style={{
                                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                      {v || "+ correo"}
                                    </span>
                                  </span>
                                )}
                                readStyle={{
                                  display: "inline-flex", alignItems: "center",
                                  padding: "3px 10px", borderRadius: 99,
                                  background: "transparent",
                                  border: `1px ${l.email ? "solid" : "dashed"} ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                                  color: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)",
                                  fontSize: 10.5, fontWeight: 500,
                                  fontFamily: font,
                                  maxWidth: 240, overflow: "hidden",
                                  whiteSpace: "nowrap", flexShrink: 1, minWidth: 0,
                                  margin: 0, fontStyle: "normal",
                                }}
                                editStyle={{ fontSize: 11, fontFamily: font, width: isMobile ? "100%" : 240, maxWidth: "100%" }}
                              />
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ═══ PRESUPUESTO ═══ Columna propia. Alineada a la derecha
                       para escaneo financiero rápido entre filas. Inline-editable. */}
                  {!isMobile && (
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}>
                    <InlineEdit
                      value={l.budget}
                      onSave={v => {
                        const parsed = parseBudget(v);
                        updateLead({ ...l,
                          budget: parsed ? formatBudget(parsed) : v,
                          presupuesto: parsed || l.presupuesto || 0,
                        });
                      }}
                      T={T} isLight={isLight}
                      placeholder="300k · 1.5M"
                      emptyText="+ presupuesto"
                      readStyle={{
                        fontSize: 13, fontWeight: 800, letterSpacing: "-0.022em",
                        color: l.budget
                          ? (isLight ? T.txt : "#FFFFFF")
                          : (isLight ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.30)"),
                        fontFamily: fontDisp, whiteSpace: "nowrap",
                        fontStyle: l.budget ? "normal" : "italic",
                        textAlign: "right",
                      }}
                      editStyle={{ fontSize: 13, fontWeight: 800, fontFamily: fontDisp, width: 100, textAlign: "right" }}
                    />
                  </div>
                  )}

                  {/* ─── META-ROW MOBILE ─── Línea compacta debajo del Cliente
                       cell con: LED de etapa + nombre de etapa, score badge,
                       días de inactividad y chevron de "abrir". Reemplaza las
                       3 columnas que se ocultan en mobile. ─── */}
                  {isMobile && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                      paddingTop: 9, borderTop: `1px dashed ${T.border}`,
                    }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 11, fontWeight: 700, color: isLight
                          ? `color-mix(in srgb, ${stageC} 55%, #0B1220 45%)`
                          : stageC,
                        fontFamily: fontDisp, letterSpacing: "0.01em",
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: stageC,
                          boxShadow: `0 0 0 2px ${stageC}24`,
                        }} />
                        {l.st}
                      </span>
                      {l.daysInactive >= 5 && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: uc, fontFamily: fontDisp,
                          background: `${uc}12`,
                          padding: "2px 7px", borderRadius: 99,
                          border: `1px solid ${uc}28`,
                        }}>{l.daysInactive}d</span>
                      )}
                      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: T.txt2,
                          fontFamily: fontDisp,
                        }}>{sc}</span>
                        <span style={{ fontSize: 9, color: T.txt3, fontFamily: fontDisp }}>score</span>
                        <ChevronRight size={14} color={T.txt3} strokeWidth={2.2} style={{ marginLeft: 4 }} />
                      </span>
                    </div>
                  )}

                  {/* ═══ ETAPA ═══ Pill minimalista: LED de color + texto + caret.
                       Sin gradient ni shadow — solo borde sutil. La pill cobra
                       sutil tinte de color al hover de la fila para indicar que
                       es clickeable (dropdown). Contenido centrado para alinear
                       con el header. */}
                  {!isMobile && (
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                    <div
                      onMouseEnter={e => {
                        e.currentTarget.style.background = isLight ? `${stageC}10` : `${stageC}14`;
                        e.currentTarget.style.borderColor = `${stageC}${isLight ? "60" : "44"}`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isLight ? `${stageC}08` : `${stageC}0E`;
                        e.currentTarget.style.borderColor = `${stageC}${isLight ? "38" : "28"}`;
                      }}
                      style={{
                      position: "relative", display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 18px 4px 9px", borderRadius: 99,
                      background: isLight ? `${stageC}08` : `${stageC}0E`,
                      border: `1px solid ${stageC}${isLight ? "38" : "28"}`,
                      transition: "background 0.16s, border-color 0.16s",
                      maxWidth: "100%", overflow: "hidden",
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: stageC,
                        flexShrink: 0,
                      }} />
                      <select value={l.st} onChange={e => { const v = e.target.value; updateLead({ ...l, st: v }); }}
                        style={{
                          background: "transparent", border: "none", padding: 0,
                          fontSize: 10.5, fontWeight: 600,
                          color: isLight ? `color-mix(in srgb, ${stageC} 50%, #0B1220 50%)` : stageC,
                          cursor: "pointer", outline: "none", appearance: "none",
                          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                          fontFamily: font, letterSpacing: "0.005em",
                        }}>
                        {STAGES.map(s => <option key={s} value={s} style={{ background: "#111318", color: "#fff", fontWeight: 600 }}>{s}</option>)}
                      </select>
                      <ChevronDown size={10} strokeWidth={2}
                        style={{
                          position: "absolute", right: 6, top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none", opacity: 0.5,
                          color: isLight ? `color-mix(in srgb, ${stageC} 50%, #0B1220 50%)` : stageC,
                        }}
                      />
                    </div>
                  </div>
                  )}

                  {/* ═══ SEGUIMIENTOS ═══ Stepper. Oculto en mobile — el meta
                       row del Cliente cell muestra el contador como pill.
                       Contenido centrado para simetría con el header. */}
                  {!isMobile && (
                  <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
                    <FollowUpBadge lead={l} onUpdate={updateLead} T={T} compact />
                  </div>
                  )}

                  {/* ═══ SCORE ═══ Solo desktop full mode — bar + número + ± manual.
                       Contenido centrado para alinear con el header. */}
                  {!co && !isMobile && (
                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)", maxWidth: 36 }}>
                        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: T.accent, transition: "width 0.4s", boxShadow: sc >= 80 ? `0 0 6px ${T.accent}60` : "none" }} />
                      </div>
                      {(() => {
                        const lead = l;
                        const mbs = { width: 15, height: 15, borderRadius: 4, border: `1px solid ${T.border}`, background: "transparent", color: T.txt3, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, fontFamily: fontDisp, transition: "all 0.15s" };
                        const mbe = e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; };
                        const mbl = e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.txt3; };
                        return (<>
                          <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.max(0, sc - 1)}); }} title="-1" style={mbs} onMouseEnter={mbe} onMouseLeave={mbl}>−</button>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.txt2, fontFamily: fontDisp, minWidth: 20, textAlign: "center" }}>{sc}</span>
                          <button onClick={e => { e.stopPropagation(); updateLead({...lead, sc: Math.min(100, sc + 1)}); }} title="+1" style={mbs} onMouseEnter={mbe} onMouseLeave={mbl}>+</button>
                        </>);
                      })()}
                    </div>
                  )}

                  {/* Acciones — 3 controles: ★ prioridad, ⚛ IA, "Ver perfil".
                     Solo desktop. En mobile el row entero abre el expediente. */}
                  {!isMobile && (() => {
                    const isPinned = pinnedIds.has(l.id);
                    const isAuto   = isAutoPriority(l);
                    const inPriority = isPinned || isAuto;

                    // Utility: devuelve un color seguro para tema claro (oscurece hacia slate)
                    const safeC = (c) => isLight ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;

                    // Estrella: cuando ESTÁ pinneada usa AZUL (T.blue) para borde+bg
                    // y mantiene el ícono dorado (señal universal de favorito).
                    // Cuando NO está pinneada, el botón es totalmente neutral.
                    // Esto evita inundar la lista de tonos amarillos: el único
                    // toque cálido es el fill del ícono ★ en los pinneados.
                    const goldC = isLight ? "#B8860B" : "#F5C542";
                    const blueC = safeC(T.blue);

                    // Estilo base de los botones de acción — borde y fondo
                    // sutiles SIEMPRE visibles (no hover-reveal). Más intuitivo:
                    // el usuario ve qué puede hacer sin tener que descubrirlo.
                    const starBorder = isPinned
                      ? `${T.blue}${isLight ? "55" : "48"}`
                      : (isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)");
                    const starBg = isPinned
                      ? `${T.blue}${isLight ? "12" : "14"}`
                      : "transparent";
                    const userBorder = isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.09)";
                    const userBg      = "transparent";

                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        {/* ★ Prioridad — siempre visible. Outline si no pinneado,
                            relleno dorado si lo está. */}
                        <button onClick={() => togglePin(l.id)}
                          title={inPriority ? "Quitar de prioridad" : "Marcar como prioridad"}
                          aria-label={inPriority ? "Quitar de prioridad" : "Marcar como prioridad"}
                          style={{
                            width: 30, height: 30, borderRadius: 8,
                            border: `1px solid ${starBorder}`,
                            background: starBg,
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.16s, border-color 0.16s",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = `${T.blue}${isLight ? "18" : "1C"}`;
                            e.currentTarget.style.borderColor = `${T.blue}${isLight ? "55" : "48"}`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = starBg;
                            e.currentTarget.style.borderColor = starBorder;
                          }}
                        >
                          <Star size={13} color={isPinned ? goldC : T.txt3} fill={isPinned ? goldC : "none"} strokeWidth={2} />
                        </button>

                        {/* 👤 Perfil — siempre visible con borde sutil. Hover
                            ilumina con accent azul para señal de acción. */}
                        <button onClick={() => openLeadDrawer(l)}
                          title={L.openProfile}
                          aria-label={L.openProfile}
                          style={{
                            width: 30, height: 30, borderRadius: 8,
                            border: `1px solid ${userBorder}`,
                            background: userBg,
                            cursor: "pointer", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.16s, border-color 0.16s",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background  = `${T.blue}${isLight ? "1A" : "1E"}`;
                            e.currentTarget.style.borderColor = `${T.blue}${isLight ? "55" : "48"}`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background  = userBg;
                            e.currentTarget.style.borderColor = userBorder;
                          }}
                        >
                          <User size={13} color={T.txt3} strokeWidth={2} />
                        </button>

                        {/* ⇄ Reasignar — en modo "Reasignar varios" es un
                            checkbox (selección de grupo); si no, un botón que
                            reasigna ESE lead. Siempre a la derecha. Solo admin. */}
                        {canBulkReassign && (bulkMode ? (
                          <span style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <SelectCheck
                              checked={selectedIds.has(l.id)}
                              onToggle={() => toggleSelect(l.id)}
                              title={selectedIds.has(l.id) ? "Quitar de la selección" : "Seleccionar para reasignar"}
                              size={20} T={T} isLight={isLight}
                            />
                          </span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); openReassignFor(l); }}
                            title="Reasignar a otro asesor"
                            aria-label="Reasignar a otro asesor"
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              border: `1px solid ${userBorder}`,
                              background: userBg,
                              cursor: "pointer", padding: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "background 0.16s, border-color 0.16s",
                              flexShrink: 0,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background  = `${T.accent}${isLight ? "1A" : "1E"}`;
                              e.currentTarget.style.borderColor = `${T.accent}${isLight ? "55" : "48"}`;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background  = userBg;
                              e.currentTarget.style.borderColor = userBorder;
                            }}
                          >
                            <UserCheck size={13} color={T.txt3} strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {/* Empty state */}
            {sortedLeads.length === 0 && (
              <div style={{ padding: "64px 32px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: T.glass, border: `1px solid ${T.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Search size={22} color={T.txt3} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: T.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Sin resultados</p>
                <p style={{ fontSize: 12, color: T.txt3, marginBottom: 20 }}>Intenta con otro término, etapa o asesor</p>
                <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ padding: "8px 20px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2, fontSize: 12, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.glassH; e.currentTarget.style.color = T.txt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}
                >Limpiar todos los filtros</button>
              </div>
            )}

            {/* Centinela de scroll infinito — al entrar en viewport, el
                IntersectionObserver crece listLimit en una página más. Solo se
                monta si quedan filas por mostrar. */}
            {listLimit < sortedLeads.length && (
              <div ref={listSentinelRef} style={{ padding: "18px", textAlign: "center", color: T.txt3, fontFamily: font, fontSize: 12, letterSpacing: "0.02em" }}>
                Cargando más… <span style={{ opacity: 0.7 }}>({listLimit} de {sortedLeads.length})</span>
              </div>
            )}
          </>
        )}

        {/* ── KANBAN — drag & drop ── */}
        {effectiveViewMode === "kanban" && (() => {
          // Cada columna: 244px + 10px gap = 254px. Avance de 2 columnas = 508px
          const COL_W = 254;
          const STEP  = COL_W * 2;
          const maxScroll = () => kanbanRef.current
            ? kanbanRef.current.scrollWidth - kanbanRef.current.clientWidth
            : 0;
          const canLeft  = kanbanScrollPos > 0;
          const canRight = kanbanScrollPos < maxScroll() - 4;

          const scrollTo = (dir) => {
            if (!kanbanRef.current) return;
            const next = Math.max(0, Math.min(
              kanbanRef.current.scrollLeft + dir * STEP,
              maxScroll()
            ));
            kanbanRef.current.scrollTo({ left: next, behavior: "smooth" });
          };

          const navBtnBase = {
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            zIndex: 20,
            width: 40, height: 40, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: `1px solid ${T.accentB}`,
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: fontDisp,
          };

          return (
            <div style={{ position: "relative" }}>
              {/* ← botón izquierda — oculto en mobile (touch swipe es natural) */}
              {canLeft && !isMobile && (
                <button
                  onClick={() => scrollTo(-1)}
                  style={{
                    ...navBtnBase,
                    left: 8,
                    background: T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)",
                    boxShadow: T === P
                      ? `0 4px 18px rgba(0,0,0,0.50), 0 0 0 1px ${T.accentB}, 0 0 16px ${T.accent}18`
                      : `0 4px 14px rgba(15,23,42,0.18), 0 0 0 1px ${T.accentB}`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
              )}

              {/* → botón derecha — oculto en mobile */}
              {canRight && !isMobile && (
                <button
                  onClick={() => scrollTo(1)}
                  style={{
                    ...navBtnBase,
                    right: 8,
                    background: T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)",
                    boxShadow: T === P
                      ? `0 4px 18px rgba(0,0,0,0.50), 0 0 0 1px ${T.accentB}, 0 0 16px ${T.accent}18`
                      : `0 4px 14px rgba(15,23,42,0.18), 0 0 0 1px ${T.accentB}`,
                    color: isLight ? `color-mix(in srgb, ${T.accent} 60%, #0B1220 40%)` : T.accent,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1E`; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T === P ? "rgba(10,13,20,0.82)" : "rgba(255,255,255,0.88)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              )}

          <div
            ref={kanbanRef}
            onScroll={e => setKanbanScrollPos(e.currentTarget.scrollLeft)}
            onWheel={e => { if (e.deltaX === 0 && e.deltaY !== 0) { e.currentTarget.scrollLeft += e.deltaY; } }}
            style={{
              display: "flex", gap: isMobile ? 8 : 10,
              overflowX: "auto",
              padding: isMobile ? "12px" : "16px",
              minHeight: isMobile ? 420 : 480,
              alignItems: "flex-start",
              scrollbarWidth: "none", msOverflowStyle: "none",
              // Scroll-snap por columna en mobile — tras un swipe se acomoda
              // a la siguiente etapa visualmente.
              scrollSnapType: isMobile ? "x mandatory" : "none",
              WebkitOverflowScrolling: "touch",
            }}>
            {kanbanStages.map(stage => {
              const stLeads = sortedLeads.filter(l => l.st === stage);
              const stVal = stLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              // Render acotado: una columna con miles de tarjetas congela el
              // montaje. Pintamos las primeras KANBAN_COL_CAP y un pie "+N más".
              // El conteo y el monto del encabezado siguen siendo del set completo.
              const stLeadsCapped = stLeads.length > KANBAN_COL_CAP ? stLeads.slice(0, KANBAN_COL_CAP) : stLeads;
              const stOverflow = stLeads.length - stLeadsCapped.length;
              const c = stgC[stage] || T.txt3;
              const isDragTarget = dragOverStage === stage;
              // Color de texto legible en blanco: mezcla hacia el slate profundo
              const cText = isLight ? `color-mix(in srgb, ${c} 58%, #0B1220 42%)` : c;
              // Alphas más fuertes en light para compensar el fondo blanco
              const headerBg = isLight
                ? (isDragTarget
                    ? `linear-gradient(135deg, ${c}32 0%, ${c}1A 100%)`
                    : `linear-gradient(135deg, ${c}22 0%, ${c}10 100%)`)
                : (isDragTarget ? `${c}18` : `${c}0C`);
              const headerBorder = isLight
                ? (isDragTarget ? `${c}78` : `${c}52`)
                : (isDragTarget ? `${c}50` : `${c}28`);
              const countBg = isLight
                ? `linear-gradient(135deg, ${c}38 0%, ${c}1C 100%)`
                : `${c}18`;
              const countBorder = isLight ? `${c}62` : `${c}28`;
              return (
                <div key={stage}
                  onDragOver={e => handleDragOver(e, stage)}
                  onDrop={e => handleDrop(e, stage)}
                  style={{
                    // En mobile cada etapa toma ~85vw para que sea cómoda;
                    // en desktop mantiene 244px para mostrar varias en pantalla.
                    minWidth: isMobile ? "min(85vw, 320px)" : 244,
                    flex: isMobile ? "0 0 min(85vw, 320px)" : "0 0 244px",
                    display: "flex", flexDirection: "column", gap: 8,
                    scrollSnapAlign: isMobile ? "start" : "none",
                  }}>
                  <div style={{ padding: "10px 13px 10px 11px", borderRadius: 11, background: headerBg, border: `1px solid ${headerBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, transition: "all 0.15s", boxShadow: isLight ? `0 1px 3px ${c}1E, inset 0 1px 0 rgba(255,255,255,0.65)` : "none", backdropFilter: isLight ? "blur(20px) saturate(160%)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: `0 0 0 2px ${c}2E${isLight ? ", 0 1px 3px " + c + "55" : ""}` }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 800, color: cText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.01em" }}>{stage}</p>
                        {stLeads.length > 0 && <p style={{ fontSize: 9.5, color: T.txt3, fontWeight: 600 }}>${(stVal/1000000).toFixed(1)}M</p>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: cText, background: countBg, border: `1px solid ${countBorder}`, padding: "2px 9px", borderRadius: 99, flexShrink: 0, fontFamily: fontDisp, boxShadow: isLight ? `inset 0 1px 0 rgba(255,255,255,0.5)` : "none" }}>{stLeads.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 7, minHeight: 60, borderRadius: 11, padding: isDragTarget ? "6px" : "0", background: isDragTarget ? "rgba(255,255,255,0.022)" : "transparent", transition: "all 0.15s" }}>
                    {stLeadsCapped.map(l => {
                      const sc = l.sc;
                      const isDragging = dragLeadId === l.id;
                      // ¿Este lead ya pasó por el Zoom? (Concretado o etapa
                      // posterior, ahora o en su historial). Misma fuente que la
                      // métrica de Filtro 2, así la etiqueta siempre cuadra.
                      const didZoom = !!zoomEventsOf(l).done;
                      return (
                        <div key={l.id}
                          draggable
                          onDragStart={e => handleDragStart(e, l.id)}
                          onDragEnd={handleDragEnd}
                          // content-visibility: el navegador omite layout/paint de
                          // tarjetas fuera de viewport en columnas largas (fluidez).
                          style={{ borderRadius: 13, background: "rgba(255,255,255,0.032)", border: `1px solid ${T.border}`, overflow: "hidden", transition: "all 0.2s", cursor: "grab", opacity: isDragging ? 0.4 : 1, contentVisibility: "auto", containIntrinsicSize: "0 168px" }}
                          onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.background = "rgba(255,255,255,0.052)"; e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.032)"; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ height: 2, background: `linear-gradient(90deg, ${c}AA, transparent)` }} />
                          <div style={{ padding: "12px 13px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 7, gap: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                                  {l.tag === "requiere-humano" && (
                                    <span title="Requiere humano" style={{
                                      flexShrink: 0, fontSize: 11, lineHeight: 1,
                                    }}>🔥</span>
                                  )}
                                  {(() => {
                                    const sc = getScheduledCall(l);
                                    return sc ? (
                                      <span title={`Llamada programada · ${new Date(sc.scheduled_at).toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})}`} style={{ flexShrink: 0, fontSize: 11, lineHeight: 1 }}>📅</span>
                                    ) : null;
                                  })()}
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.n}</span>
                                </p>
                                <p style={{ fontSize: 9.5, color: T.txt3 }}>{l.asesor?.split(" ")[0]} · {l.campana}</p>
                                {didZoom && (
                                  <span title="Este cliente ya pasó por Zoom (concretado o etapa posterior)" style={{
                                    display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4,
                                    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em",
                                    color: "#10B981", background: "rgba(16,185,129,0.12)",
                                    border: "1px solid rgba(16,185,129,0.32)", padding: "2px 8px",
                                    borderRadius: 99, textTransform: "uppercase", whiteSpace: "nowrap",
                                  }}><Video size={9} strokeWidth={2.5} /> Zoom Realizado</span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, letterSpacing: "-0.02em", flexShrink: 0 }}>{l.budget}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                                <div style={{ width: `${sc}%`, height: "100%", borderRadius: 2, background: T.accent,
                                  opacity: sc >= 80 ? 1 : sc >= 60 ? 0.85 : 0.65,
                                  boxShadow: sc >= 80 ? `0 0 6px ${T.accent}50` : "none" }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: fontDisp, minWidth: 18, color: T.accent }}>{sc}</span>
                            </div>
                            {l.daysInactive >= 7 && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: isLight ? "#B91C1C" : "#FF6B6B", background: isLight ? "linear-gradient(135deg, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.08) 100%)" : "rgba(255,107,107,0.10)", border: isLight ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,107,107,0.22)", borderRadius: 6, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, marginBottom: 7, boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                ⚠ {l.daysInactive}d sin actividad
                              </div>
                            )}
                            {l.daysInactive >= 3 && l.daysInactive < 7 && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: isLight ? `color-mix(in srgb, ${T.amber} 55%, #0B1220 45%)` : T.amber, background: isLight ? `linear-gradient(135deg, ${T.amber}2E 0%, ${T.amber}14 100%)` : `${T.amber}12`, border: `1px solid ${isLight ? T.amber + "5C" : T.amber + "25"}`, borderRadius: 6, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, marginBottom: 7, boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                {l.daysInactive}d sin actividad
                              </div>
                            )}
                            {/* Selector de etapa inline */}
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
                              <select value={l.st} onChange={e => updateLead({ ...l, st: e.target.value })}
                                style={{ width: "100%", padding: "5px 8px", borderRadius: 7, background: isLight ? `linear-gradient(135deg, ${c}26 0%, ${c}12 100%)` : `${c}0C`, border: `1px solid ${isLight ? c + "55" : c + "28"}`, color: cText, fontSize: 9.5, fontWeight: 700, cursor: "pointer", outline: "none", appearance: "none", boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none" }}>
                                {STAGES.map(s => <option key={s} value={s} style={{ background: "#111318", color: "#fff" }}>{s}</option>)}
                              </select>
                            </div>
                            {/* Contador de seguimientos — permite al asesor registrar
                                cada recontacto directamente desde la tarjeta */}
                            <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8, display: "flex" }}>
                              <FollowUpBadge lead={l} onUpdate={updateLead} T={T} compact />
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`, l)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, background: `${T.accent}10`, border: `1px solid ${T.accentB}`, color: T.accent, fontSize: 9.5, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = `${T.accent}1E`} onMouseLeave={e => e.currentTarget.style.background = `${T.accent}10`}>Analizar</button>
                              <button onClick={() => togglePin(l.id)} title={pinnedIds.has(l.id) ? "Quitar de prioridad" : "Añadir a prioridad"} style={{ width: 28, padding: "5px 0", borderRadius: 7, background: pinnedIds.has(l.id) ? `${T.accent}12` : "transparent", border: `1px solid ${pinnedIds.has(l.id) ? `${T.accent}36` : T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = `${T.accent}1A`; }} onMouseLeave={e => { e.currentTarget.style.background = pinnedIds.has(l.id) ? `${T.accent}12` : "transparent"; }}><Star size={10} color={pinnedIds.has(l.id) ? T.accent : T.txt3} fill={pinnedIds.has(l.id) ? T.accent : "none"} strokeWidth={2} /></button>
                              {!isDiscoverySimplified && (
                                <button onClick={() => openLeadDrawer(l)} title="Abrir perfil" style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}><User size={10} color={T.txt3} /></button>
                              )}
                              <button onClick={() => setNotesLead(l)} title="Abrir Discovery" style={{ width: 28, padding: "5px 0", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = T.border; }}><FileText size={10} color={T.txt3} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stOverflow > 0 && (
                      <div style={{ padding: "9px 10px", textAlign: "center", fontSize: 10, fontWeight: 600, color: T.txt3, fontFamily: font, borderRadius: 9, border: `1px dashed ${T.border}`, background: isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)" }}>
                        +{stOverflow} más · usa Lista o filtra para verlos
                      </div>
                    )}
                    {stLeads.length === 0 && (
                      <div style={{ padding: "28px 16px", borderRadius: 11, border: `1px dashed ${isDragTarget ? `${c}50` : T.border}`, textAlign: "center", background: isDragTarget ? `${c}06` : "transparent", transition: "all 0.15s" }}>
                        <p style={{ fontSize: 10.5, color: isDragTarget ? c : T.txt3 }}>{isDragTarget ? "Soltar aquí" : L.emptyList}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          );
        })()}
      </G>

      {/* ── CENTRO DE AGENTES IA — equipo virtual que trabaja con los asesores ── */}
      {(() => {
        // Clientes que no venden (ej. Vega) ocultan el panel de agentes de venta.
        if (clientConfig?.crm?.aiAgentsPanel === false) return null;
        // Cola por agente, derivada del pipeline real
        const reactivarQueue   = visibleLeads.filter(l => (l.daysInactive || 0) >= 5).sort((a, b) => (b.daysInactive || 0) - (a.daysInactive || 0));
        const seguimientoQueue = visibleLeads.filter(l => ["Segundo Intento", "Seguimiento"].includes(l.st) && !l.hot).sort((a, b) => b.sc - a.sc);
        const callcenterQueue  = visibleLeads.filter(l => l.hot || l.st === "Zoom Agendado").sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || b.sc - a.sc);
        const calificarQueue   = visibleLeads.filter(l => l.isNew).sort((a, b) => (b.id || 0) - (a.id || 0));

        const totalActions = reactivarQueue.length + seguimientoQueue.length + callcenterQueue.length + calificarQueue.length;
        const hoursSaved   = (totalActions * 0.3).toFixed(1);
        // Leads asignados por agente (aiAgent === key)
        const assignedByAgent = {
          reactivar:   visibleLeads.filter(l => l.aiAgent === "reactivar"),
          seguimiento: visibleLeads.filter(l => l.aiAgent === "seguimiento"),
          callcenter:  visibleLeads.filter(l => l.aiAgent === "callcenter"),
          calificar:   visibleLeads.filter(l => l.aiAgent === "calificar"),
        };
        const totalAssigned = Object.values(assignedByAgent).reduce((s, arr) => s + arr.length, 0);

        const agents = [
          {
            key: "reactivar",
            icon: AI_AGENTS.reactivar.icon,
            color: AI_AGENTS.reactivar.color,
            name: AI_AGENTS.reactivar.name,
            role: AI_AGENTS.reactivar.role,
            queue: reactivarQueue,
            metric: "68% re-enganche",
            verb: "Reactivar",
            actionText: "envió mensaje a",
            prompt: (l) => `__crm__ reactivar a ${l.n.toLowerCase()} con mensaje personalizado — lleva ${l.daysInactive} días sin contacto`,
            batchPrompt: (q) => `__crm__ reactivar a los ${q.length} leads fríos: ${q.slice(0, 5).map(l => l.n).join(", ")}${q.length > 5 ? "..." : ""}`,
            queueLabel: (l) => `${l.daysInactive}d`,
          },
          {
            key: "seguimiento",
            icon: AI_AGENTS.seguimiento.icon,
            color: AI_AGENTS.seguimiento.color,
            name: AI_AGENTS.seguimiento.name,
            role: AI_AGENTS.seguimiento.role,
            queue: seguimientoQueue,
            metric: "+42% respuesta",
            verb: "Ejecutar",
            actionText: "preparó next-step para",
            prompt: (l) => `__crm__ próxima acción para ${l.n.toLowerCase()} — etapa ${l.st}, score ${l.sc}`,
            batchPrompt: (q) => `__crm__ prepara next-steps para los ${q.length} leads en seguimiento`,
            queueLabel: (l) => `${l.st.split(" ")[0]} · ${l.sc}`,
          },
          {
            key: "callcenter",
            icon: AI_AGENTS.callcenter.icon,
            color: AI_AGENTS.callcenter.color,
            name: AI_AGENTS.callcenter.name,
            role: AI_AGENTS.callcenter.role,
            queue: callcenterQueue,
            metric: "3.2× conversión",
            verb: "Llamar",
            actionText: "completó llamada con",
            prompt: (l) => `__crm__ prepara briefing de llamada para ${l.n.toLowerCase()} — ${l.hot ? "HOT lead" : "Zoom agendado"}, presupuesto ${l.budget}`,
            batchPrompt: (q) => `__crm__ prepara la cola de ${q.length} llamadas con briefing IA`,
            queueLabel: (l) => l.hot ? "HOT" : "Zoom",
          },
          {
            key: "calificar",
            icon: AI_AGENTS.calificar.icon,
            color: AI_AGENTS.calificar.color,
            name: AI_AGENTS.calificar.name,
            role: AI_AGENTS.calificar.role,
            queue: calificarQueue,
            metric: "96% precisión",
            verb: "Calificar",
            actionText: "calificó a",
            prompt: (l) => `__crm__ califica al lead nuevo ${l.n.toLowerCase()} y dame recomendación de próximos pasos`,
            batchPrompt: (q) => `__crm__ prepara la cola de ${q.length} leads nuevos y ordénalos por prioridad`,
            queueLabel: (l) => l.campana ? l.campana.slice(0, 8) : "Nuevo",
          },
        ];

        // Feed de actividad reciente (determinista, a partir del pipeline)
        const activityLog = [
          { agent: agents[0], lead: reactivarQueue[1]   || reactivarQueue[0],   time: "hace 3m" },
          { agent: agents[1], lead: seguimientoQueue[1] || seguimientoQueue[0], time: "hace 9m" },
          { agent: agents[2], lead: callcenterQueue[1]  || callcenterQueue[0],  time: "hace 16m" },
          { agent: agents[3], lead: calificarQueue[1]   || calificarQueue[0],   time: "hace 24m" },
        ].filter(e => e.lead);

        return (
          <G T={T} style={{ padding: 0, overflow: "hidden" }}>
            {/* Halo superior sutil — sin barra, funciona en claro y oscuro */}
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: "60%", height: 1,
              background: isLight
                ? `linear-gradient(90deg, transparent, ${T.accent}66, transparent)`
                : `linear-gradient(90deg, transparent, ${T.accent}3A, transparent)`,
              pointerEvents: "none",
            }} />

            <div style={{ padding: "18px 20px 16px", position: "relative" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 13,
                    background: isLight
                      ? `radial-gradient(circle at 35% 28%, #FFFFFF 0%, ${T.accent}14 100%)`
                      : `radial-gradient(circle at 35% 28%, ${T.accent}1A 0%, ${T.accent}06 60%, rgba(255,255,255,0.02) 100%)`,
                    border: `1px solid ${isLight ? `${T.accent}3A` : `${T.accent}28`}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: isLight
                      ? `0 2px 8px ${T.accent}24, inset 0 1px 0 rgba(255,255,255,0.9)`
                      : `0 0 18px ${T.accent}14, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}>
                    <div style={{ animation: "stratosAtomSpin 14s cubic-bezier(0.45,0.05,0.55,0.95) infinite", transformOrigin: "center", display: "flex", filter: isLight ? `drop-shadow(0 1px 2px ${T.accent}55)` : `drop-shadow(0 0 6px ${T.accent}40)` }}>
                      <StratosAtomHex size={24} color={T.accent} edge={T.accent} />
                    </div>
                    <style>{`
                      @keyframes stratosAtomSpin {
                        0%   { transform: rotate(0deg) scale(1); }
                        18%  { transform: rotate(90deg) scale(1.03); }
                        32%  { transform: rotate(140deg) scale(1); }
                        50%  { transform: rotate(180deg) scale(1); }
                        68%  { transform: rotate(268deg) scale(1.03); }
                        82%  { transform: rotate(320deg) scale(1); }
                        100% { transform: rotate(360deg) scale(1); }
                      }
                    `}</style>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.02em" }}>Centro de Agentes IA</p>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "3.5px 11px", borderRadius: 99,
                        background: isLight
                          ? `linear-gradient(135deg, ${T.accent}3D 0%, ${T.accent}1F 55%, ${T.accent}12 100%)`
                          : `linear-gradient(135deg, ${T.accent}26 0%, ${T.accent}10 100%)`,
                        border: `1px solid ${isLight ? T.accent + "85" : T.accent + "44"}`,
                        boxShadow: isLight
                          ? `0 2px 8px ${T.accent}2E, 0 1px 2px ${T.accent}1A, inset 0 1px 0 rgba(255,255,255,0.7)`
                          : `0 1px 4px ${T.accent}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: `radial-gradient(circle at 30% 30%, #FFFFFFB3 0%, ${T.accent} 45%, ${T.accent} 100%)`,
                          boxShadow: `0 0 0 2px ${T.accent}2E, 0 0 6px ${T.accent}`,
                          animation: "pulse 2s ease-in-out infinite",
                        }} />
                        <span style={{
                          fontSize: 9, fontWeight: 800,
                          color: isLight ? `color-mix(in srgb, ${T.accent} 55%, #0B1220 45%)` : T.accent,
                          letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: font,
                          textShadow: isLight ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
                        }}>LIVE</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: T.txt3, margin: "3px 0 0", fontFamily: font, letterSpacing: "0.005em" }}>Tu equipo virtual — redacta, llama, califica y reactiva mientras tú cierras</p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {[
                    { label: "Asignados", value: totalAssigned, color: T.accent },
                    { label: "Acciones", value: totalActions, color: T.blue },
                    { label: "Ahorro",   value: `${hoursSaved}h`, color: T.violet },
                    { label: "Éxito IA", value: "91%", color: T.emerald },
                  ].map((k) => (
                    <div key={k.label} style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start",
                      padding: "7px 13px", borderRadius: 10,
                      background: isLight
                        ? `linear-gradient(135deg, ${k.color}28 0%, ${k.color}12 55%, ${k.color}08 100%)`
                        : `linear-gradient(135deg, ${k.color}1A 0%, ${k.color}08 100%)`,
                      border: `1px solid ${isLight ? k.color + "5C" : k.color + "30"}`,
                      boxShadow: isLight
                        ? `0 2px 6px ${k.color}22, 0 1px 2px ${k.color}14, inset 0 1px 0 rgba(255,255,255,0.7)`
                        : `0 1px 3px ${k.color}12, inset 0 1px 0 rgba(255,255,255,0.08)`,
                    }}>
                      <p style={{
                        fontSize: 8.5, margin: 0, fontFamily: font, letterSpacing: "0.1em",
                        textTransform: "uppercase", fontWeight: 800,
                        color: isLight ? `color-mix(in srgb, ${k.color} 55%, #0B1220 45%)` : k.color,
                        opacity: 0.85,
                      }}>{k.label}</p>
                      <p style={{
                        fontSize: 18, fontWeight: 800, fontFamily: fontDisp, margin: "1px 0 0",
                        letterSpacing: "-0.03em", lineHeight: 1,
                        color: isLight ? `color-mix(in srgb, ${k.color} 68%, #0B1220 32%)` : k.color,
                        textShadow: isLight ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
                      }}>{k.value}</p>
                    </div>
                  ))}

                </div>
              </div>

              {/* Grid de agentes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {agents.map(a => {
                  const { icon: Icon, color, queue } = a;
                  const isIdle = queue.length === 0;
                  const visibleQueue = queue.slice(0, 3);
                  const extra = queue.length - visibleQueue.length;
                  const assigned = assignedByAgent[a.key] || [];

                  // Text con contraste premium en ambos temas
                  const colorText = isLight
                    ? `color-mix(in srgb, ${color} 58%, #0B1220 42%)`
                    : color;

                  return (
                    <div key={a.key}
                      style={{
                        position: "relative",
                        borderRadius: 16,
                        background: isLight
                          ? (isIdle
                              ? `linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,252,0.72) 100%)`
                              : `radial-gradient(ellipse 320px 180px at 0% 0%, ${color}2E 0%, ${color}0E 42%, transparent 72%), linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,252,254,0.86) 100%)`)
                          : (isIdle
                              ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.012) 100%)"
                              : "linear-gradient(180deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.014) 100%)"),
                        backdropFilter: "blur(30px) saturate(180%)",
                        WebkitBackdropFilter: "blur(30px) saturate(180%)",
                        border: `1px solid ${isIdle ? T.border : (isLight ? `${color}5A` : `${color}22`)}`,
                        boxShadow: isLight
                          ? (isIdle
                              ? `0 1px 2px rgba(15,23,42,0.04), 0 4px 14px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.85)`
                              : `0 2px 4px ${color}1A, 0 8px 24px rgba(15,23,42,0.06), 0 4px 14px ${color}22, inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 ${color}0F`)
                          : (isIdle
                              ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                              : `0 2px 8px rgba(0,0,0,0.22), 0 8px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)`),
                        overflow: "hidden",
                        display: "flex", flexDirection: "column",
                        transition: "all 0.24s cubic-bezier(.4,0,.2,1)",
                      }}
                      onMouseEnter={e => {
                        if (!isIdle) {
                          e.currentTarget.style.borderColor = isLight ? `${color}82` : `${color}3A`;
                          e.currentTarget.style.transform = "translateY(-3px)";
                          e.currentTarget.style.boxShadow = isLight
                            ? `0 4px 14px rgba(15,23,42,0.08), 0 22px 48px rgba(15,23,42,0.1), 0 8px 28px ${color}3A, inset 0 1px 0 rgba(255,255,255,0.95)`
                            : `0 4px 12px rgba(0,0,0,0.32), 0 16px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isIdle) {
                          e.currentTarget.style.borderColor = isLight ? `${color}5A` : `${color}22`;
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = isLight
                            ? `0 2px 4px ${color}1A, 0 8px 24px rgba(15,23,42,0.06), 0 4px 14px ${color}22, inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 ${color}0F`
                            : `0 2px 8px rgba(0,0,0,0.22), 0 8px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)`;
                        }
                      }}
                    >
                      {/* Shimmer diagonal — solo en light theme (en dark estorba) */}
                      {!isIdle && isLight && (
                        <div style={{
                          position: "absolute", inset: 0, pointerEvents: "none",
                          background: `linear-gradient(135deg, rgba(255,255,255,0.45) 0%, transparent 35%)`,
                          borderRadius: 16,
                        }} />
                      )}

                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11, flex: 1, position: "relative" }}>
                        {/* Head */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: isLight
                              ? `radial-gradient(circle at 30% 25%, ${color}48 0%, ${color}22 55%, ${color}10 100%)`
                              : `radial-gradient(circle at 30% 25%, ${color}22 0%, ${color}0C 55%, ${color}04 100%)`,
                            border: `1px solid ${isLight ? color + "62" : color + "32"}`,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            position: "relative",
                            boxShadow: isIdle
                              ? "none"
                              : (isLight
                                  ? `0 3px 10px ${color}36, 0 1px 2px ${color}1A, inset 0 1px 0 rgba(255,255,255,0.75), inset 0 0 10px ${color}14`
                                  : `0 0 12px ${color}18, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 8px ${color}10`),
                          }}>
                            <Icon size={17} color={color} strokeWidth={2.3} />
                            {!isIdle && (
                              <div style={{
                                position: "absolute", top: -3, right: -3, width: 11, height: 11, borderRadius: "50%",
                                background: `radial-gradient(circle at 32% 30%, #FFFFFF 0%, #FFFFFF 18%, ${color} 55%, ${color} 100%)`,
                                boxShadow: isLight
                                  ? `0 0 0 2.5px #FFFFFF, 0 0 0 3.5px ${color}, 0 0 8px ${color}AA`
                                  : `0 0 0 2.5px ${T.bg}, 0 0 0 3.5px ${color}, 0 0 8px ${color}AA`,
                                animation: "pulse 2.2s ease-in-out infinite",
                              }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.015em" }}>{a.name}</p>
                            <p style={{ fontSize: 10, color: T.txt3, fontFamily: font, margin: "2px 0 0", letterSpacing: "0.005em" }}>{a.role}</p>
                          </div>
                          <div style={{
                            padding: "4px 12px", borderRadius: 99, minWidth: 32,
                            background: isIdle
                              ? (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)")
                              : (isLight
                                  ? `linear-gradient(135deg, ${color}42 0%, ${color}22 55%, ${color}14 100%)`
                                  : `linear-gradient(135deg, ${color}18 0%, ${color}0C 100%)`),
                            border: `1px solid ${isIdle ? T.border : (isLight ? `${color}82` : `${color}34`)}`,
                            flexShrink: 0, textAlign: "center",
                            boxShadow: !isIdle
                              ? (isLight
                                  ? `0 2px 8px ${color}32, 0 1px 2px ${color}1A, inset 0 1px 0 rgba(255,255,255,0.65)`
                                  : `inset 0 1px 0 rgba(255,255,255,0.07)`)
                              : "none",
                          }}>
                            <span style={{
                              fontSize: 12.5, fontWeight: 900,
                              color: isIdle ? T.txt3 : colorText,
                              fontFamily: fontDisp, letterSpacing: "-0.02em",
                              textShadow: !isIdle && isLight ? "0 1px 0 rgba(255,255,255,0.5)" : "none",
                            }}>{queue.length}</span>
                          </div>
                        </div>

                        {/* Métrica de éxito */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 10px", borderRadius: 8,
                          background: isIdle
                            ? "transparent"
                            : (isLight
                                ? `linear-gradient(135deg, ${color}1E 0%, ${color}08 100%)`
                                : `linear-gradient(135deg, ${color}0A 0%, ${color}03 100%)`),
                          border: isIdle ? "none" : `1px solid ${isLight ? color + "36" : color + "18"}`,
                          boxShadow: !isIdle && isLight ? "inset 0 1px 0 rgba(255,255,255,0.5)" : "none",
                        }}>
                          <TrendingUp size={11} color={isIdle ? T.txt3 : colorText} strokeWidth={2.5} />
                          <span style={{
                            fontSize: 10, fontWeight: 800,
                            color: isIdle ? T.txt3 : colorText,
                            fontFamily: font, letterSpacing: "0.02em",
                          }}>{a.metric}</span>
                          <span style={{ fontSize: 9, color: T.txt3, fontFamily: font, marginLeft: "auto", fontWeight: 600 }}>últ. 30 días</span>
                        </div>

                        {/* Clientes asignados por asesor */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9,
                          background: assigned.length > 0
                            ? (isLight
                                ? `linear-gradient(135deg, ${color}2A 0%, ${color}10 55%, ${color}06 100%)`
                                : `linear-gradient(135deg, ${color}0C 0%, ${color}03 100%)`)
                            : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.02)"),
                          border: `1px solid ${assigned.length > 0 ? (isLight ? `${color}5C` : `${color}20`) : T.border}`,
                          boxShadow: assigned.length > 0
                            ? (isLight ? `0 1px 2px ${color}18, inset 0 1px 0 rgba(255,255,255,0.55)` : "none")
                            : "none",
                        }}>
                          <Users size={11} color={assigned.length > 0 ? colorText : T.txt3} strokeWidth={2.5} />
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: assigned.length > 0 ? colorText : T.txt3,
                            fontFamily: font, letterSpacing: "0.015em",
                          }}>
                            {assigned.length > 0 ? `${assigned.length} asignado${assigned.length > 1 ? "s" : ""} por el asesor` : "Sin asignaciones directas"}
                          </span>
                          {assigned.length > 0 && (
                            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                              {assigned.slice(0, 3).map(l => (
                                <div key={l.id} title={l.n} style={{
                                  width: 19, height: 19, borderRadius: "50%",
                                  background: isLight
                                    ? `linear-gradient(135deg, ${color}48 0%, ${color}22 100%)`
                                    : `linear-gradient(135deg, ${color}2E 0%, ${color}14 100%)`,
                                  border: `1px solid ${isLight ? color + "7A" : color + "55"}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 8.5, fontWeight: 800, color: colorText, fontFamily: fontDisp,
                                  boxShadow: isLight ? `0 1px 2px ${color}22` : "none",
                                }}>{l.n.charAt(0)}</div>
                              ))}
                              {assigned.length > 3 && <span style={{ fontSize: 9, fontWeight: 800, color: colorText, fontFamily: fontDisp, alignSelf: "center", marginLeft: 2 }}>+{assigned.length - 3}</span>}
                            </div>
                          )}
                        </div>

                        {/* Cola */}
                        <div style={{ flex: 1, padding: 0, borderRadius: 10,
                          background: isLight
                            ? `linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(241,245,249,0.68) 100%)`
                            : `linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.14) 100%)`,
                          border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.05)"}`,
                          boxShadow: isLight
                            ? "inset 0 1px 3px rgba(15,23,42,0.04), inset 0 -1px 0 rgba(255,255,255,0.4)"
                            : "inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.2)",
                          overflow: "hidden", display: "flex", flexDirection: "column",
                        }}>
                          {isIdle ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "20px 10px" }}>
                              <CheckCircle2 size={12} color={T.emerald} />
                              <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, fontWeight: 600 }}>Sin pendientes — todo al día</span>
                            </div>
                          ) : (
                            <>
                              {visibleQueue.map((l, idx) => (
                                <div key={l.id}
                                  onClick={() => setNotesLead(l)}
                                  title={`Abrir expediente de ${l.n}`}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 9,
                                    padding: "8px 11px",
                                    borderBottom: idx < visibleQueue.length - 1 || extra > 0 ? `1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)"}` : "none",
                                    cursor: "pointer", transition: "all 0.15s",
                                    position: "relative",
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = isLight
                                      ? `linear-gradient(135deg, ${color}1E 0%, ${color}08 100%)`
                                      : `linear-gradient(135deg, ${color}0A 0%, ${color}03 100%)`;
                                    e.currentTarget.style.paddingLeft = "13px";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.paddingLeft = "11px";
                                  }}
                                >
                                  {/* LED dot premium */}
                                  <div style={{
                                    width: 7, height: 7, borderRadius: "50%",
                                    background: `radial-gradient(circle at 30% 30%, #FFFFFFB0 0%, ${color} 45%, ${color} 100%)`,
                                    boxShadow: isLight
                                      ? `0 0 0 2px ${color}22, 0 0 6px ${color}75`
                                      : `0 0 0 1.5px ${color}28, 0 0 5px ${color}90`,
                                    flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isLight ? T.txt : "#FFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, letterSpacing: "-0.005em" }}>{l.n}</span>
                                  <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    color: colorText,
                                    fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase",
                                    flexShrink: 0,
                                    padding: "2px 7px", borderRadius: 99,
                                    background: isLight
                                      ? `linear-gradient(135deg, ${color}2A 0%, ${color}12 100%)`
                                      : `${color}10`,
                                    border: `1px solid ${isLight ? color + "4E" : color + "22"}`,
                                    boxShadow: isLight ? `inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                                  }}>{a.queueLabel(l)}</span>
                                  {/* Botón de ejecución rápida del agente sobre este lead */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); oc(a.prompt(l), l); }}
                                    title={`Ejecutar ${a.name} para ${l.n}`}
                                    style={{
                                      width: 22, height: 22, borderRadius: 7,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      background: isLight ? `${color}1A` : `${color}14`,
                                      border: `1px solid ${isLight ? color + "40" : color + "26"}`,
                                      cursor: "pointer", flexShrink: 0, padding: 0,
                                      transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => {
                                      e.stopPropagation();
                                      e.currentTarget.style.background = isLight ? `${color}32` : `${color}24`;
                                      e.currentTarget.style.borderColor = isLight ? `${color}6A` : `${color}42`;
                                    }}
                                    onMouseLeave={e => {
                                      e.stopPropagation();
                                      e.currentTarget.style.background = isLight ? `${color}1A` : `${color}14`;
                                      e.currentTarget.style.borderColor = isLight ? `${color}40` : `${color}26`;
                                    }}
                                  >
                                    <Zap size={10} color={colorText} strokeWidth={2.6} />
                                  </button>
                                </div>
                              ))}
                              {extra > 0 && (
                                <div style={{
                                  padding: "6px 11px", textAlign: "center",
                                  background: isLight
                                    ? `linear-gradient(135deg, ${color}0C 0%, ${color}04 100%)`
                                    : "rgba(255,255,255,0.015)",
                                  borderTop: `1px solid ${isLight ? color + "18" : "rgba(255,255,255,0.04)"}`,
                                }}>
                                  <span style={{ fontSize: 9.5, color: colorText, fontFamily: font, fontWeight: 700, letterSpacing: "0.02em" }}>+{extra} más en cola</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            disabled={isIdle}
                            onClick={() => !isIdle && oc(a.batchPrompt(queue))}
                            style={{
                              flex: 1, padding: "10px 10px", borderRadius: 10,
                              background: isIdle
                                ? (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)")
                                : (isLight
                                    ? `linear-gradient(135deg, ${color}22, ${color}0C)`
                                    : `linear-gradient(135deg, ${color}18, ${color}08)`),
                              border: `1px solid ${isIdle ? T.border : (isLight ? `${color}4A` : `${color}38`)}`,
                              color: isIdle ? T.txt3 : colorText,
                              fontSize: 11.5, fontWeight: 800, fontFamily: fontDisp, letterSpacing: "-0.005em",
                              cursor: isIdle ? "not-allowed" : "pointer",
                              transition: "all 0.18s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              boxShadow: !isIdle && isLight ? `0 1px 3px ${color}14, inset 0 1px 0 rgba(255,255,255,0.55)` : "none",
                            }}
                            onMouseEnter={e => { if (!isIdle) { e.currentTarget.style.background = `linear-gradient(135deg, ${color}, ${color}DD)`; e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 5px 14px ${color}48, inset 0 1px 0 rgba(255,255,255,0.28)`; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                            onMouseLeave={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? `linear-gradient(135deg, ${color}22, ${color}0C)` : `linear-gradient(135deg, ${color}18, ${color}08)`; e.currentTarget.style.color = colorText; e.currentTarget.style.borderColor = isLight ? `${color}4A` : `${color}38`; e.currentTarget.style.boxShadow = isLight ? `0 1px 3px ${color}14, inset 0 1px 0 rgba(255,255,255,0.55)` : "none"; e.currentTarget.style.transform = "none"; } }}
                          >
                            <Zap size={12} strokeWidth={2.5} /> {a.verb} {!isIdle && `los ${queue.length}`}
                          </button>
                          <button
                            disabled={isIdle}
                            onClick={() => !isIdle && oc(`__crm__ muestra la cola completa del agente ${a.name.toLowerCase()}: ${queue.length} leads`)}
                            title={`Ver los ${queue.length} leads en cola`}
                            style={{
                              width: 36, height: 36, borderRadius: 9,
                              background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)",
                              border: `1px solid ${T.border}`,
                              color: isIdle ? T.txt3 : T.txt2,
                              cursor: isIdle ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.15s", flexShrink: 0, padding: 0,
                              boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.8)" : "none",
                            }}
                            onMouseEnter={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = T.borderH; } }}
                            onMouseLeave={e => { if (!isIdle) { e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = T.border; } }}
                          >
                            <List size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feed de actividad reciente */}
            {activityLog.length > 0 && (
              <div style={{
                padding: "10px 18px 14px",
                borderTop: `1px solid ${isLight ? T.borderMint : T.border}`,
                background: isLight
                  ? `linear-gradient(180deg, rgba(240,252,247,0.5) 0%, rgba(255,255,255,0.3) 100%)`
                  : "rgba(255,255,255,0.01)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={11} color={T.txt3} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: T.txt3, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: font }}>Actividad reciente</span>
                  </div>
                  <button onClick={() => oc("__crm__ muestra el historial completo de acciones ejecutadas por los agentes IA hoy")}
                    style={{ fontSize: 10, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: font, fontWeight: 600, padding: 0, letterSpacing: "0.01em" }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >Ver historial →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                  {activityLog.map(({ agent, lead, time }) => {
                    const A = agent.icon;
                    return (
                      <div key={agent.key} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8,
                        background: isLight
                          ? `linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(248,252,250,0.72) 100%)`
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${T.border}`,
                        boxShadow: isLight ? "0 1px 2px rgba(15,23,42,0.03), inset 0 1px 0 rgba(255,255,255,0.6)" : "none",
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: isLight ? `linear-gradient(135deg, ${agent.color}24, ${agent.color}0A)` : `${agent.color}16`,
                          border: `1px solid ${agent.color}34`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          boxShadow: isLight ? `0 1px 3px ${agent.color}1F, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                        }}>
                          <A size={11} color={agent.color} strokeWidth={2.2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10.5, color: T.txt2, margin: 0, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: agent.color, fontWeight: 700 }}>{agent.name}</span>
                            <span style={{ color: T.txt3 }}> {agent.actionText} </span>
                            <span style={{ color: isLight ? T.txt : "#FFF", fontWeight: 600 }}>{lead.n}</span>
                          </p>
                          <p style={{ fontSize: 9, color: T.txt3, margin: "1px 0 0", fontFamily: font }}>{time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </G>
        );
      })()}

      {/* Drawers — "Discovery" (NotesModal/Expediente) y los drawers
         legacy (Perfil, Análisis IA) comparten un switcher inferior. En
         clientes con crm.discoverySimplified=true, el drawer es una sola
         sección scrolleable sin Tareas. */}
      <NotesModal
        T={T}
        lead={notesLead}
        onClose={() => setNotesLead(null)}
        onSave={saveNotes}
        onUpdate={updateLead}
        asesoresMaster={asesoresMaster}
        currentUserName={user?.name || null}
        discoverySimplified={clientConfig?.crm?.discoverySimplified === true}
        projectMode={clientConfig?.crm?.projectMode === true}
        centered={clientConfig?.crm?.expedienteCentered === true}
        onSwitchTab={(tab) => openDrawerTab(tab, notesLead)}
        onShowHistory={() => setHistoryLead(notesLead)}
        onShowSuggest={() => setSuggestLead(notesLead)}
        onDelete={softDeleteLead ? async (l) => {
          const r = await softDeleteLead(l.id);
          if (r?.ok) showToast(`"${l.n}" movido a la papelera`, "success");
          else showToast(r?.error || "No se pudo eliminar", "error");
        } : undefined}
      />
      <LeadPanel
        T={T}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        oc={oc}
        onUpdate={updateLead}
        asesoresMaster={asesoresMaster}
        currentUserName={user?.name || null}
        onSwitchTab={(tab) => openDrawerTab(tab, selectedLead)}
        onShowHistory={() => setHistoryLead(selectedLead)}
        onDelete={softDeleteLead ? async (l) => {
          const r = await softDeleteLead(l.id);
          if (r?.ok) showToast(`"${l.n}" movido a la papelera`, "success");
          else showToast(r?.error || "No se pudo eliminar", "error");
        } : undefined}
      />
      <AnalysisDrawer
        T={T}
        lead={analyzingLead}
        onClose={() => setAnalyzingLead(null)}
        oc={oc}
        onUpdate={updateLead}
        onSwitchTab={(tab) => openDrawerTab(tab, analyzingLead)}
      />

      {/* Los botones "¿Qué hago ahora?" y "Historial" se removieron del
         layout flotante para limpiar la UX. La funcionalidad equivalente
         ahora vive integrada de forma profesional dentro del drawer:
            · El PLAYBOOK PERSONALIZADO en el Expediente ya muestra las
              acciones recomendadas según el Protocolo Duke (sin botón).
            · El acceso a "Sugerencias IA" se hace desde un link sutil
              dentro del header del Playbook, opcional.
            · El "Historial" se accede desde el ícono de reloj en el
              header del drawer (junto a editar/cerrar).

         Esto elimina ruido visual y centra la atención del asesor en
         lo único que importa: las acciones del cliente. */}

      <HistoryDrawer
        open={!!historyLead}
        entityType="leads"
        entityId={historyLead?.id}
        entityLabel={historyLead?.n || historyLead?.name}
        onClose={() => setHistoryLead(null)}
      />

      <SuggestActionsModal
        open={!!suggestLead}
        lead={suggestLead}
        onClose={() => setSuggestLead(null)}
        onAddTasks={(newTasks) => {
          // Agregar los tasks al lead actual + sincronizar drawers abiertos
          if (!suggestLead) return;
          const existingTasks = Array.isArray(suggestLead.tasks) ? suggestLead.tasks : [];
          const updated = { ...suggestLead, tasks: [...newTasks, ...existingTasks] };
          // Mirror a next_action si no hay
          if (!updated.next_action && !updated.nextAction && newTasks[0]) {
            updated.next_action = newTasks[0].action;
            updated.nextAction = newTasks[0].action;
            updated.next_action_date = newTasks[0].date || "";
            updated.nextActionDate = newTasks[0].date || "";
          }
          updateLead(updated);
        }}
      />

      <ZoomSchedulingModal
        open={!!zoomSchedulingLead}
        lead={zoomSchedulingLead?.lead}
        isNewLead={!!zoomSchedulingLead?.isNewLead}
        onClose={cancelZoomScheduling}
        onConfirm={confirmZoomScheduling}
        T={T}
      />

      <VisitaSchedulingModal
        open={!!visitaSchedulingLead}
        lead={visitaSchedulingLead?.lead}
        onClose={cancelVisitaScheduling}
        onConfirm={confirmVisitaScheduling}
        T={T}
      />

      {/* ── FAB "+ Nuevo cliente" — solo mobile ─────────────────────────────
          Floating Action Button en la zona del pulgar (bottom-right). Se
          posiciona ABOVE del bottom nav (z=200) y respeta safe-area.
          Cuando hay un drawer abierto se oculta para no chocar con el
          bottom-sheet (z drawer=401, FAB z=199). ─────────────────────── */}
      {isMobile && !notesLead && !selectedLead && !analyzingLead && !addingLead && createPortal(
        <button
          onClick={() => setAddingLead(true)}
          aria-label={L.newEntity}
          style={{
            position: "fixed",
            right: 18,
            bottom: `calc(58px + env(safe-area-inset-bottom, 0px) + 16px)`,
            zIndex: 199,
            /* dodge: invisible e inerte mientras el carrusel de Prioridad está
               a la vista (tapaba "Tomar acción"); reaparece al scrollear. */
            opacity: fabDodge ? 0 : 1,
            transform: fabDodge ? "scale(0.5)" : "scale(1)",
            pointerEvents: fabDodge ? "none" : "auto",
            width: 56, height: 56, borderRadius: 999,
            border: "none",
            background: isLight
              ? `linear-gradient(135deg, ${T.accent}, ${T.emerald || T.accent})`
              : `linear-gradient(135deg, ${T.accent}, color-mix(in srgb, ${T.accent} 60%, #0B1220 40%))`,
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isLight
              ? `0 6px 16px ${T.accent}55, 0 12px 28px rgba(15,23,42,0.18)`
              : `0 4px 14px ${T.accent}44, 0 16px 32px rgba(0,0,0,0.55)`,
            transition: "transform 0.22s ease, opacity 0.22s ease, box-shadow 0.2s ease",
          }}
          onTouchStart={e => { if (!fabDodge) e.currentTarget.style.transform = "scale(0.94)"; }}
          onTouchEnd={e => { if (!fabDodge) e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>,
        document.body
      )}

      {/* ── Barra de "Reasignar varios" ──────────────────────────────────────
            Visible mientras bulkMode está activo. Centro-abajo, sobre el
            contenido. Permite seleccionar todos, reasignar el grupo o salir. */}
      {canBulkReassign && bulkMode && createPortal(
        <div style={{
          position: "fixed", left: "50%",
          bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 74px)" : 26,
          transform: "translateX(-50%)", zIndex: 600,
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 10px 9px 14px", borderRadius: 14, maxWidth: "94vw",
          background: isLight ? "rgba(255,255,255,0.94)" : "rgba(17,19,24,0.94)",
          border: `1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)"}`,
          boxShadow: isLight
            ? "0 10px 30px rgba(15,23,42,0.16), 0 28px 70px rgba(15,23,42,0.14)"
            : "0 14px 44px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.04)",
          backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)",
          animation: "fadeIn 0.18s ease both",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span style={{
              minWidth: 24, height: 24, padding: "0 7px", borderRadius: 99,
              background: selectedIds.size > 0 ? T.accent : (isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"),
              color: selectedIds.size > 0 ? "#0B1220" : (isLight ? "rgba(15,23,42,0.5)" : "rgba(255,255,255,0.5)"),
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12.5, fontWeight: 800, fontFamily: fontDisp,
            }}>{selectedIds.size}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: isLight ? T.txt : "#fff", fontFamily: font, whiteSpace: "nowrap" }}>
              {selectedIds.size === 0 ? "Elegí leads" : `seleccionado${selectedIds.size !== 1 ? "s" : ""}`}
            </span>
          </span>
          <button onClick={toggleSelectAll} title="Seleccionar/quitar todos los resultados" style={{
            height: 32, padding: "0 10px", borderRadius: 9, background: "transparent",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"}`,
            color: isLight ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.62)",
            fontSize: 11.5, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap",
          }}>{allFilteredSelected ? "Quitar todos" : "Todos"}</button>
          <span style={{ width: 1, height: 22, background: isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)" }} />
          <button
            onClick={openReassignGroup}
            disabled={selectedIds.size === 0}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              height: 36, padding: "0 16px", borderRadius: 10, border: "none",
              background: selectedIds.size > 0
                ? `linear-gradient(135deg, ${T.accent}, color-mix(in srgb, ${T.accent} 70%, #0B1220 30%))`
                : (isLight ? "rgba(15,23,42,0.1)" : "rgba(255,255,255,0.1)"),
              color: selectedIds.size > 0 ? "#0B1220" : (isLight ? "rgba(15,23,42,0.4)" : "rgba(255,255,255,0.4)"),
              fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
              cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
              whiteSpace: "nowrap", boxShadow: selectedIds.size > 0 ? `0 4px 14px ${T.accent}40` : "none",
              transition: "all 0.14s",
            }}
          >
            <UserCheck size={15} strokeWidth={2.4} /> Reasignar{selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}
          </button>
          <button onClick={exitBulkMode} title="Cancelar" style={{
            height: 36, padding: "0 12px", borderRadius: 10, background: "transparent",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"}`,
            color: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.6)",
            fontSize: 12.5, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap",
          }}>Cancelar</button>
        </div>,
        document.body
      )}

      {/* ── Modal: reasignar leads seleccionados a un asesor ─────────────────── */}
      {reassignOpen && createPortal(
        <>
          <div onClick={() => setReassignOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 700,
            background: isLight ? "rgba(15,23,42,0.22)" : "rgba(2,5,12,0.78)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            animation: "fadeIn 0.2s ease both",
          }} />
          <div style={isMobile ? {
            position: "fixed", inset: 0, zIndex: 701,
            width: "100vw", height: "100dvh", display: "flex", flexDirection: "column",
            background: isLight ? "#FFFFFF" : "#111318",
            animation: "modalInMobile 0.24s cubic-bezier(0.16,1,0.3,1) both",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          } : {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 701, width: "min(460px, 96vw)", maxHeight: "88vh",
            display: "flex", flexDirection: "column",
            background: isLight ? "#FFFFFF" : "#111318",
            border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : T.borderH}`,
            borderRadius: 18, overflow: "hidden",
            boxShadow: isLight
              ? "0 4px 12px rgba(15,23,42,0.08), 0 28px 80px rgba(15,23,42,0.12)"
              : "0 52px 100px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: "modalIn 0.26s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <style>{`@keyframes modalInMobile{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <div style={{
              padding: "14px 16px", flexShrink: 0,
              borderBottom: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : T.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: isLight ? `${T.accent}14` : `${T.accent}12`,
                  border: `1px solid ${isLight ? `${T.accent}40` : T.accentB}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <UserCheck size={14} color={isLight ? (T.accentDark || T.accent) : T.accent} strokeWidth={2.4} />
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>
                  Reasignar {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""}
                </h3>
              </div>
              <button onClick={() => setReassignOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.txt3, display: "flex", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 16px 4px", overflowY: "auto", flex: 1 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.5, color: T.txt3, fontFamily: font }}>
                Elegí el asesor que recibirá {selectedIds.size === 1 ? "el lead" : "los leads"}.{" "}
                {reassignToContactame
                  ? <>Aparecerán al inicio de su pipeline en <strong style={{ color: isLight ? T.txt : "#fff", fontWeight: 700 }}>Contáctame Ya</strong>.</>
                  : "Conservarán su etapa actual."}
              </p>

              {/* Búsqueda de asesor */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={13} color={isLight ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.3)"} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  autoFocus
                  value={reassignQ}
                  onChange={e => setReassignQ(e.target.value)}
                  placeholder="Buscar asesor…"
                  style={{
                    width: "100%", height: 38, paddingLeft: 32, paddingRight: 12,
                    borderRadius: 10, boxSizing: "border-box",
                    background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.042)",
                    border: `1px solid ${isLight ? "rgba(15,23,42,0.1)" : "rgba(255,255,255,0.1)"}`,
                    fontSize: 13, color: isLight ? T.txt : "#fff", outline: "none", fontFamily: font,
                  }}
                />
              </div>

              {/* Lista de asesores */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: isMobile ? "none" : 280, overflowY: "auto" }}>
                {reassignOptions.length === 0 && (
                  <div style={{ padding: "14px 8px", fontSize: 12.5, color: T.txt3, fontFamily: font, textAlign: "center" }}>
                    Sin asesores que coincidan.
                  </div>
                )}
                {reassignOptions.map(name => {
                  const picked = reassignTarget === name;
                  const c = hashAsesorColor(name);
                  return (
                    <button key={name} type="button" onClick={() => setReassignTarget(name)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "8px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                        background: picked ? (isLight ? `${T.accent}14` : `${T.accent}1C`) : "transparent",
                        border: `1px solid ${picked ? `${T.accent}55` : "transparent"}`,
                        transition: "background 0.12s, border-color 0.12s",
                      }}
                      onMouseEnter={e => { if (!picked) e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (!picked) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: "50%", background: c, color: "#fff",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11.5, fontWeight: 800, fontFamily: fontDisp, flexShrink: 0,
                      }}>{asesorInitials(name)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: isLight ? T.txt : "#fff", fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      {picked && <Check size={16} strokeWidth={2.6} color={T.accent} style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* Toggle: mover a Contáctame Ya. Es un <div> (no <button>) porque
                  contiene el botón del checkbox y <button> no puede anidar
                  <button> (HTML inválido → hydration error). */}
              <div role="button" tabIndex={0} onClick={() => setReassignToContactame(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box",
                  margin: "12px 0 6px", padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <SelectCheck checked={reassignToContactame} onToggle={() => setReassignToContactame(v => !v)} size={18} title="Mover a Contáctame Ya" T={T} isLight={isLight} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: isLight ? T.txt : "#fff", fontFamily: font }}>Mover a Contáctame Ya</span>
                  <span style={{ display: "block", fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.4, marginTop: 1 }}>Reinicia el lead al inicio del pipeline del nuevo asesor.</span>
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "12px 16px", flexShrink: 0,
              borderTop: `1px solid ${isLight ? "rgba(15,23,42,0.06)" : T.border}`,
              display: "flex", gap: 10, justifyContent: "flex-end",
            }}>
              <button onClick={() => setReassignOpen(false)} style={{
                height: 38, padding: "0 16px", borderRadius: 10, background: "transparent",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.14)"}`,
                color: isLight ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.62)",
                fontSize: 13, fontWeight: 600, fontFamily: font, cursor: "pointer",
              }}>Cancelar</button>
              <button
                onClick={runReassign}
                disabled={!reassignTarget}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  height: 38, padding: "0 18px", borderRadius: 10, border: "none",
                  background: reassignTarget
                    ? `linear-gradient(135deg, ${T.accent}, color-mix(in srgb, ${T.accent} 70%, #0B1220 30%))`
                    : (isLight ? "rgba(15,23,42,0.1)" : "rgba(255,255,255,0.1)"),
                  color: reassignTarget ? "#0B1220" : (isLight ? "rgba(15,23,42,0.4)" : "rgba(255,255,255,0.4)"),
                  fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                  cursor: reassignTarget ? "pointer" : "not-allowed",
                  boxShadow: reassignTarget ? `0 4px 14px ${T.accent}40` : "none",
                  transition: "all 0.14s",
                }}>
                <UserCheck size={15} strokeWidth={2.4} />
                Reasignar {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Toast de error / confirmación ─────────────────────────────────── */}
      {saveToast && createPortal(
        <div style={{
          position:     "fixed",
          bottom:       24,
          left:         "50%",
          transform:    "translateX(-50%)",
          zIndex:       99999,
          display:      "flex",
          alignItems:   "center",
          gap:          10,
          padding:      "12px 20px",
          borderRadius: 10,
          background:   saveToast.type === "error"
            ? "rgba(239,68,68,0.95)"
            : "rgba(110,231,194,0.95)",
          color:         "#fff",
          fontSize:      13,
          fontWeight:    500,
          fontFamily:    font,
          boxShadow:    "0 8px 32px rgba(0,0,0,0.35)",
          maxWidth:     "90vw",
          backdropFilter: "blur(12px)",
          animation:    "fadeIn 0.2s ease",
          cursor:       "pointer",
          userSelect:   "none",
        }}
        onClick={() => setSaveToast(null)}
        >
          {saveToast.type === "error"
            ? <AlertCircle size={15} style={{ flexShrink: 0 }} />
            : <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          }
          {saveToast.msg}
        </div>,
        document.body
      )}
    </div>
  );
}

const ZoomSchedulingModal = ({ open, lead, isNewLead = false, onClose, onConfirm, T = P }) => {
  const [dateVal, setDateVal] = useState(""); // "YYYY-MM-DD"
  const [timeVal, setTimeVal] = useState(""); // "HH:MM"
  const isLight = T !== P;

  useEffect(() => {
    if (open) {
      setDateVal("");
      setTimeVal("");
    }
  }, [open]);

  if (!open || !lead) return null;

  // Fecha y hora son campos separados; los unimos al formato que ya espera el
  // resto del flujo (igual que un input datetime-local): "YYYY-MM-DDTHH:MM",
  // en hora local del asesor. La "próxima acción" se fija a "Zoom" por defecto.
  const canConfirm = !!dateVal && !!timeVal;
  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(`${dateVal}T${timeVal}`, "Zoom");
  };

  const modalBg = isLight ? "#FFFFFF" : "#111318";
  const overlayBg = "rgba(10, 16, 28, 0.75)";
  const borderC = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.08)";
  const inputBg = isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)";

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center",
      background: overlayBg, backdropFilter: "blur(8px)",
      padding: 16,
    }}>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div style={{
        width: "100%", maxWidth: 420,
        background: modalBg, border: `1px solid ${borderC}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        animation: "modalIn 0.26s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${borderC}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3B82F6",
          }}>
            <CalendarDays size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              fontFamily: fontDisp, color: T.txt,
            }}>Programar Zoom Agendado</h3>
            <span style={{ fontSize: 11, color: T.txt3, fontWeight: 500 }}>
              Cita obligatoria para etapa Zoom Agendado
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: T.txt2, lineHeight: 1.5 }}>
            Para {isNewLead ? "registrar a" : "mover a"} <strong style={{ color: T.txt }}>{lead.n || lead.name}</strong> {isNewLead ? "en" : "a"} la etapa de <strong style={{ color: "#3B82F6" }}>Zoom Agendado</strong>, es obligatorio definir la fecha y hora de la sesión.
          </p>

          {/* Fecha y Hora — campos separados */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.txt3 }}>
                Fecha del Zoom *
              </label>
              <input
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  background: inputBg, border: `1px solid ${T.border}`,
                  color: T.txt, fontSize: 13, fontFamily: font,
                  outline: "none", cursor: "pointer",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.txt3 }}>
                Hora del Zoom *
              </label>
              <input
                type="time"
                value={timeVal}
                onChange={e => setTimeVal(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  background: inputBg, border: `1px solid ${T.border}`,
                  color: T.txt, fontSize: 13, fontFamily: font,
                  outline: "none", cursor: "pointer",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "16px 24px 20px",
          borderTop: `1px solid ${borderC}`,
          background: isLight ? "rgba(15,23,42,0.01)" : "rgba(255,255,255,0.01)",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.glassH; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "none",
              background: canConfirm ? (T.accent || "#3B82F6") : (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"),
              color: canConfirm ? "#FFFFFF" : T.txt3,
              fontSize: 12, fontWeight: 700, fontFamily: font,
              cursor: canConfirm ? "pointer" : "not-allowed",
              transition: "all 0.15s",
              boxShadow: canConfirm ? `0 4px 12px ${(T.accent || "#3B82F6")}33` : "none",
            }}
            onMouseEnter={e => { if (canConfirm) e.currentTarget.style.opacity = 0.9; }}
            onMouseLeave={e => { if (canConfirm) e.currentTarget.style.opacity = 1; }}
          >
            Confirmar Zoom
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// VisitaSchedulingModal — espejo de ZoomSchedulingModal para la etapa
// "Visita Agendada". Pide fecha + hora obligatorias y las entrega como
// "YYYY-MM-DDTHH:MM" (hora local del asesor). El que confirma (confirmVisitaScheduling)
// las guarda en leads.visita_at, de donde fn_proactive_scan_visitas encola los
// avisos −1mes/−15d/−7d. Acento verde para diferenciarlo del de Zoom (azul).
const VisitaSchedulingModal = ({ open, lead, onClose, onConfirm, T = P }) => {
  const [dateVal, setDateVal] = useState(""); // "YYYY-MM-DD"
  const [timeVal, setTimeVal] = useState(""); // "HH:MM"
  const isLight = T !== P;

  useEffect(() => {
    if (open) {
      setDateVal("");
      setTimeVal("");
    }
  }, [open]);

  if (!open || !lead) return null;

  const canConfirm = !!dateVal && !!timeVal;
  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(`${dateVal}T${timeVal}`);
  };

  const modalBg = isLight ? "#FFFFFF" : "#111318";
  const overlayBg = "rgba(10, 16, 28, 0.75)";
  const borderC = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.08)";
  const inputBg = isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)";

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center",
      background: overlayBg, backdropFilter: "blur(8px)",
      padding: 16,
    }}>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div style={{
        width: "100%", maxWidth: 420,
        background: modalBg, border: `1px solid ${borderC}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        animation: "modalIn 0.26s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${borderC}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(52, 211, 153, 0.15)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#34D399",
          }}>
            <CalendarDays size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              fontFamily: fontDisp, color: T.txt,
            }}>Programar Visita Agendada</h3>
            <span style={{ fontSize: 11, color: T.txt3, fontWeight: 500 }}>
              Cita obligatoria para etapa Visita Agendada
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: T.txt2, lineHeight: 1.5 }}>
            Para mover a <strong style={{ color: T.txt }}>{lead.n || lead.name}</strong> a la etapa de <strong style={{ color: "#34D399" }}>Visita Agendada</strong>, es obligatorio definir la fecha y hora de la visita. El asesor recibirá avisos 1 mes, 15 días y 1 semana antes.
          </p>

          {/* Fecha y Hora — campos separados */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.txt3 }}>
                Fecha de la visita *
              </label>
              <input
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  background: inputBg, border: `1px solid ${T.border}`,
                  color: T.txt, fontSize: 13, fontFamily: font,
                  outline: "none", cursor: "pointer",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.txt3 }}>
                Hora de la visita *
              </label>
              <input
                type="time"
                value={timeVal}
                onChange={e => setTimeVal(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  background: inputBg, border: `1px solid ${T.border}`,
                  color: T.txt, fontSize: 13, fontFamily: font,
                  outline: "none", cursor: "pointer",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "16px 24px 20px",
          borderTop: `1px solid ${borderC}`,
          background: isLight ? "rgba(15,23,42,0.01)" : "rgba(255,255,255,0.01)",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: "transparent",
              color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.glassH; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "none",
              background: canConfirm ? "#34D399" : (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"),
              color: canConfirm ? "#04201A" : T.txt3,
              fontSize: 12, fontWeight: 700, fontFamily: font,
              cursor: canConfirm ? "pointer" : "not-allowed",
              transition: "all 0.15s",
              boxShadow: canConfirm ? "0 4px 12px rgba(52,211,153,0.25)" : "none",
            }}
            onMouseEnter={e => { if (canConfirm) e.currentTarget.style.opacity = 0.9; }}
            onMouseLeave={e => { if (canConfirm) e.currentTarget.style.opacity = 1; }}
          >
            Confirmar Visita
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CRM;
