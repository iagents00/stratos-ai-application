/**
 * app/features/MetaPanel/index.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de cuatro pestañas: Lista de Acción · Documentos · Plan Estratégico · Protocolo de Ventas
 * Extraído de App.jsx (ex líneas 3204–3998).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Target, Plus, Check, Minus, GripVertical, TrendingUp, ChevronRight,
  AlertCircle, Bell, X, Atom, CalendarDays, Clock, ChevronLeft,
  FileText, Table, Presentation, ClipboardList, HardDrive, BookOpen,
  PenTool, Palette, Video, Globe, Cloud, ExternalLink, Trash2, FolderOpen,
  Users, UserRound,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { font, fontDisp } from "../../../design-system/tokens";

/* ── INITIAL STATE DEFAULTS (used by App.jsx to seed useState) ─────────────── */
export const DEFAULT_META_PLAN = {
  coreValues: ["Integridad en cada transacción", "Excelencia en experiencia de lujo", "Confianza y transparencia total", "Resultados medibles y reales"],
  purpose: "Conectar inversionistas globales con las mejores propiedades de lujo en la Riviera Maya, creando riqueza y legado generacional.",
  xfactor: "Única firma con expertise legal completo USA-México + acceso exclusivo a propiedades pre-mercado.",
  swt: [
    { type: "F", text: "Acceso exclusivo a propiedades pre-mercado premium" },
    { type: "F", text: "Red activa de +200 clientes referidos HNW" },
    { type: "D", text: "Proceso de cierre 52 días (meta: 45)" },
    { type: "D", text: "Equipo pequeño vs. competencia (7 vs. 25+ agentes)" },
    { type: "T", text: "8% apreciación anual PDC · Nómadas digitales en auge" },
    { type: "T", text: "Crypto payments en real estate +15% deals 2026" },
  ],
  bhag: "#1 bróker de lujo en la Riviera Maya · $500M en transacciones anuales para 2030",
  targets3yr: ["$200M pipeline activo", "15 asesores élite en equipo", "40% cierres por referido", "Reconocimiento internacional de marca"],
  sandbox: { zona: "Playa del Carmen · Riviera Maya", precio: "$1.5M – $6.5M USD", cliente: "HNW 45–65 años", origen: "EEUU · Canadá · Latam · EU", producto: "Beachfront · Penthouses · Resort" },
  brandPromises: [
    { title: "Experiencia sin fricciones", sub: "Legal MX-USA resuelto para ti" },
    { title: "ROI con inteligencia real", sub: "Proyecciones reales de plusvalía" },
    { title: "Servicio clase mundial", sub: "Concierge personal 360°" },
  ],
  rocks: [
    { n: "Cerrar 12 propiedades $2M+", owner: "Todo el equipo", pct: 42 },
    { n: "Lanzar Red Inversionistas PDC", owner: "Dir. Desarrollo", pct: 65 },
    { n: "Contratar 3 asesores élite", owner: "RRHH", pct: 30 },
    { n: "Reducir cierre a 45 días", owner: "Operaciones", pct: 55 },
  ],
  anualTheme: "El Año del Inversionista",
  anualThemeDesc: "Cultivar capital institucional y compradores recurrentes. Bono de equipo al alcanzar $50M.",
  goal: 48_000_000,
};

export const DEFAULT_META_PROTOCOL = {
  // Protocolo oficial Duke del Caribe (Mayo 2026). 12 etapas con SLA y
  // acciones obligatorias por etapa. Orden alineado con CRM kanban.
  stages: [
    { id: 1, name: "Contáctame Ya", color: "#34D399", sla: "< 1h",
      actions: ["Contacto inmediato por llamada y WhatsApp", "Calificar BANT en el primer contacto", "Si no contesta, registrar intento y mover a Segundo Intento", "No acumular en esta bandeja — máxima urgencia"] },
    { id: 2, name: "Segundo Intento", color: "#60A5FA", sla: "< 24h",
      actions: ["Segundo intento de llamada y mensaje", "Registrar intento y resultado en CRM", "Si no contesta, mover a Tercer Intento"] },
    { id: 3, name: "Tercer Intento", color: "#7EB8F0", sla: "< 24h",
      actions: ["Tercer intento de llamada", "Registrar evidencia (hora, canal, resultado)", "Si no contesta, mover a Rotación"] },
    { id: 4, name: "Rotación", color: "#A8A29E", sla: "< 12h",
      actions: ["Emanuel (gerente) reasigna a otro asesor", "Nuevo asesor inicia ciclo de contacto", "Es segunda oportunidad, no abandono"] },
    { id: 5, name: "Remarketing IA", color: "#FB923C", sla: "Continuo",
      actions: ["Leads no calificados o no listos para invertir", "La IA programa publicidad, info y nutrición", "Mantener comunicación automatizada hasta reactivación"] },
    { id: 6, name: "Zoom Agendado", color: "#3B82F6", sla: "Confirmado",
      actions: ["Discovery completo previo al Zoom", "Confirmar 24h y 1h antes por WhatsApp", "Tener comparativos y dossier listos", "Llegar al Zoom con perfil + intención"] },
    { id: 7, name: "Reactivar Zoom", color: "#EA580C", sla: "< 2h",
      actions: ["Mensaje empático sin presión — confirmar interés real", "Proponer 2 ventanas alternativas para reagendar", "Recuperar confianza y fijar nuevo horario", "Si en 24h no responde, mover a Remarketing IA"] },
    { id: 8, name: "Seguimiento", color: "#FBBF24", sla: "< 24h",
      actions: ["Incluye Zoom concretado, envío de proyectos, corridas y negociación", "Cada touchpoint debe aportar valor (avance de obra, caso similar, disponibilidad)", "Mantener próxima acción + fecha siempre definidas"] },
    { id: 9, name: "Apartó", color: "#4ADE80", sla: "< 24h",
      actions: ["Validar comprobante, unidad, monto y desarrollador", "Coordinar siguiente paso (visita o Down Payment)", "El cliente envió dinero al desarrollador"] },
    { id: 10, name: "Visita Agendada", color: "#06B6D4", sla: "Confirmado",
      actions: ["Confirmar fechas, vuelos y horarios", "Coordinar recorrido, propiedades y responsables", "Diseñar experiencia VIP del cliente"] },
    { id: 11, name: "Cierre", color: "#34D399", sla: "Inmediato",
      actions: ["Solo entra aquí con Down Payment pagado", "Validar comprobante y documentación de cierre", "Coordinar firma con notaría aliada"] },
    { id: 12, name: "Postventa", color: "#64748B", sla: "Continuo",
      actions: ["Lili da seguimiento formal de avances de obra", "Compartir comprobantes y estados de cuenta", "Mantener comunicación formal, ordenada y documentada"] },
  ],
  qualification: [
    { label: "Budget",    q: "¿Cuál es tu presupuesto disponible para esta inversión?" },
    { label: "Authority", q: "¿Eres tú quien toma la decisión final?" },
    { label: "Need",      q: "¿Buscas inversión, disfrute personal o ambos?" },
    { label: "Timeline",  q: "¿En qué plazo planeas concretar la compra?" },
    { label: "Financing", q: "¿Tienes capital disponible o necesitas financiamiento?" },
  ],
  objections: [
    { obj: "Está muy caro",         resp: "El precio refleja la ubicación premium y el ROI proyectado de 8% anual. ¿Cuál es tu referencia de precio?" },
    { obj: "Necesito pensarlo",     resp: "Entendido. ¿Qué información adicional necesitas para decidir? Tengo disponibilidad esta semana." },
    { obj: "No conozco la zona",    resp: "Perfecto, hagamos un tour virtual o te agendo una visita VIP con traslado incluido. ¿Cuándo tienes disponibilidad?" },
    { obj: "¿Y si no se vende?",    resp: "Tiene 8% apreciación anual + programa de renta vacacional con 10-12% ROI. ¿Te muestro los números?" },
    { obj: "Quiero esperar precios bajos", resp: "En PDC los precios suben 8% anual. Cada mes de espera equivale a pagar más. ¿Te muestro la proyección?" },
  ],
  slas: [
    { trigger: "Nuevo lead registrado",  resp: "Primer contacto",     time: "< 1 hora",  owner: "Asesor asignado" },
    { trigger: "Zoom realizado",         resp: "Envío de propuesta",  time: "24 horas",  owner: "Asesor asignado" },
    { trigger: "Sin actividad 5+ días",  resp: "Reactivación activa", time: "Inmediato", owner: "Director de Ventas" },
    { trigger: "Negociación activa",     resp: "Seguimiento diario",  time: "24 horas",  owner: "Asesor + Director" },
  ],
  objetivo: "Convertir leads en ventas mediante un proceso claro, rápido y consistente.",
  reglaBase: "Todo lead debe avanzar, seguir en proceso o cerrarse. Si no, está perdido.",
  principios: ["Califica rápido", "Calificar correctamente", "Mover al siguiente paso", "Dar seguimiento constante", "Registrar todo"],
  reglaRegistro: "Lo que no está registrado en el CRM, no existe.",
  velocidadIdeal: "< 5 minutos",
  velocidadMax: "30 minutos",
  flujoSteps: [
    { n: "Contacto Inicial", desc: "Objetivo: obtener respuesta", action: "Mensaje + llamada. Sin respuesta → mensaje breve + siguiente intento." },
    { n: "Calificación",     desc: "Objetivo: entender al cliente", action: "Nombre · presupuesto · zona · objetivo · tiempo · ubicación · objeciones" },
    { n: "Avance",           desc: "Toda conversación termina en un siguiente paso", action: "Zoom agendado · Recorrido agendado · Seguimiento con fecha definida" },
    { n: "Registro",         desc: "Después de cada interacción", action: "Registrar en Stratos AI: resumen · etapa · próxima acción · fecha · nivel del lead" },
  ],
  pipelineStages: ["Lead nuevo", "Contactado", "Conversación", "Zoom agendado", "Recorrido", "Seguimiento", "Apartado", "Venta cerrada", "Post-venta", "Referidos"],
  reglasOp: ["Todo lead tiene próxima acción y fecha", "3 intentos sin respuesta → riesgo", "24h sin avance → alerta", "5 días sin actividad → frío"],
  seguimientoFases: [
    { range: "1–5 intentos",   desc: "Contacto y respuesta" },
    { range: "6–15 intentos",  desc: "Interés y valor" },
    { range: "16–30 intentos", desc: "Confianza y decisión" },
    { range: "31–45 intentos", desc: "Cierre o reactivación" },
  ],
  seguimientoFreq: [
    { tipo: "Caliente", freq: "cada 24h",     color: "#EF4444" },
    { tipo: "Medio",    freq: "cada 48h",     color: "#F59E0B" },
    { tipo: "Frío",     freq: "cada 3–5 días", color: "#60A5FA" },
  ],
  kpis: [
    { cat: "Actividad",  color: "#60A5FA", items: ["Tiempo de respuesta", "Contactos diarios", "Seguimientos activos"] },
    { cat: "Conversión", color: "#34D399", items: ["Zooms realizados", "Recorridos agendados", "Cierres del mes"] },
    { cat: "Calidad",    color: "#A78BFA", items: ["Leads sin seguimiento", "Registros incompletos"] },
    { cat: "Resultado",  color: "#FB923C", items: ["Ventas cerradas", "Ingresos generados"] },
  ],
  alertas: ["Lead sin contacto", "Seguimiento vencido", "Lead caliente sin avance", "Cliente sin próxima acción"],
  errores: ["No registrar en CRM", "No dar seguimiento", "No definir siguiente paso", "Responder tarde", "No calificar al lead"],
  principioFinal: "El dinero está en el seguimiento.",
  cierre: "Un lead solo se cierra si: compra, se descarta con motivo claro, o deja de ser viable.",
};

/* ── Detección de proveedor para el apartado Documentos ────────────────────── */
const DOC_PROVIDERS = [
  { test: u => u.includes("docs.google.com/document"),               name: "Google Docs",   color: "#4285F4", Icon: FileText },
  { test: u => u.includes("docs.google.com/spreadsheets"),           name: "Google Sheets", color: "#34A853", Icon: Table },
  { test: u => u.includes("docs.google.com/presentation"),           name: "Google Slides", color: "#F4B400", Icon: Presentation },
  { test: u => u.includes("docs.google.com/forms"),                  name: "Google Forms",  color: "#A78BFA", Icon: ClipboardList },
  { test: u => u.includes("drive.google.com"),                       name: "Google Drive",  color: "#4285F4", Icon: HardDrive },
  { test: u => u.includes("notion.so") || u.includes("notion.site"), name: "Notion",        color: "#94A3B8", Icon: BookOpen },
  { test: u => u.includes("figma.com"),                              name: "Figma",         color: "#A259FF", Icon: PenTool },
  { test: u => u.includes("canva.com"),                              name: "Canva",         color: "#00C4CC", Icon: Palette },
  { test: u => u.includes("dropbox.com"),                            name: "Dropbox",       color: "#0061FF", Icon: Cloud },
  { test: u => u.includes("onedrive") || u.includes("sharepoint"),   name: "OneDrive",      color: "#0078D4", Icon: Cloud },
  { test: u => u.includes("loom.com"),                               name: "Loom",          color: "#625DF5", Icon: Video },
  { test: u => u.includes("youtube.com") || u.includes("youtu.be"),  name: "YouTube",       color: "#F87171", Icon: Video },
  { test: u => /\.pdf(\?|#|$)/.test(u),                              name: "PDF",           color: "#EF4444", Icon: FileText },
];
const detectDocProvider = (url) => {
  const u = (url || "").toLowerCase();
  const hit = DOC_PROVIDERS.find(p => p.test(u));
  if (hit) return hit;
  let host = "";
  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { /* url inválida */ }
  return { name: host || "Enlace", color: "#7EB8F0", Icon: Globe };
};
const docHost = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

const pad2 = (n) => String(n).padStart(2, "0");
const localYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const AGENDA_CATEGORIES = [
  { id: "personal", label: "Personal", accent: "#10B981" },
  { id: "profesional", label: "Profesional", accent: "#3B82F6" },
];
const normalizeAgendaCategory = (value) => {
  const v = String(value || "").trim().toLowerCase();
  return v === "personal" ? "personal" : "profesional";
};
const agendaCategoryMeta = (value) =>
  AGENDA_CATEGORIES.find(c => c.id === normalizeAgendaCategory(value)) || AGENDA_CATEGORIES[0];

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function MetaPanel({
  open,
  onClose,
  metaTab,
  setMetaTab,
  metaActions,
  setMetaActions,
  metaNewText,
  setMetaNewText,
  doneCollapsed,
  setDoneCollapsed,
  metaPlan,
  setMetaPlan,
  metaProtocol,
  setMetaProtocol,
  metaDocs,
  setMetaDocs,
  leadsData,
  T,
  isLight,
  // Nuevos props para multi-tenant (Grupo 28 / Stratos / futuras orgs):
  orgBrand,          // string mostrado en header — viene de DB (org.meta_config.brand o nombre de org).
  canEdit,           // true solo si el role del usuario es super_admin o admin.
  savingConfig,      // bool — true cuando hay un cambio pendiente de guardar en DB.
  user,              // usuario actual (org id) — para persistir acciones manuales en team_actions.
}) {
  // ── Persistencia de acciones MANUALES en Supabase (tabla team_actions) ──
  // Las derivadas de leads se siembran en App.jsx (efímeras, se regeneran). Las que el usuario
  // crea acá SÍ se guardan, con fecha/hora límite OBLIGATORIA (la usa el coach de Telegram).
  const [metaNewDate, setMetaNewDate] = useState("");
  const [metaNewCategory, setMetaNewCategory] = useState("profesional");
  const [metaNewAssignee, setMetaNewAssignee] = useState("");
  const [agendaView, setAgendaView] = useState("mine");
  const [duePickerOpen, setDuePickerOpen] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [teamMembers, setTeamMembers] = useState([]);   // responsables dinámicos (todos los activos del org, incl. nuevos)
  const _orgId = user?.organizationId;
  const _isManager = ['super_admin','admin','ceo','director'].includes(user?.role);
  const _selfName = user?.name || user?.fullName || user?.email || "Admin";
  const _nameKey = (value) => String(value || "").trim().toLowerCase();
  const _actionOwner = (action) => action?.assignee || action?.asesor || "";
  const _isOwnAction = (action) => {
    const owner = _nameKey(_actionOwner(action));
    if (!_isManager) return true;
    return owner && owner !== "todos" && owner !== "equipo" && owner === _nameKey(_selfName);
  };
  const fallbackTeamMembers = ["Oscar Gálvez","Alexia Santillán","Araceli Oneto","Ken Duke","Emmanuel Ortiz","Cecilia Mendoza"];
  const teamMemberOptions = teamMembers.length ? teamMembers : fallbackTeamMembers;
  const creatingForTeam = _isManager && agendaView === "team";
  // Persistimos si hay un usuario REAL logueado. NO exigimos conocer el org en el front:
  // team_actions tiene DEFAULT organization_id = current_organization_id() (la DB lo pone desde el
  // JWT) y RLS lo valida, así que guarda bien aunque user.organizationId no esté cargado en la sesión.
  const _online = !!(user?.id && !user?._offline && user.id !== 'demo-user-local');
  useEffect(() => {
    if (!open || !_online) return;
    let cancelled = false;
    supabase.from('team_actions').select('*')   // RLS ya filtra por el org del usuario logueado
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error || !data) { if (error) console.warn('[Stratos] team_actions load:', error.message); return; }
        const mapped = data.map(r => ({
          id: r.id, text: r.text,
          lead: r.category && !['personal','profesional'].includes(String(r.category).toLowerCase()) ? r.category : agendaCategoryMeta(r.category).label,
          agendaCategory: normalizeAgendaCategory(r.agenda_scope || r.category),
          asesor: r.asesor_name || '',
          date: r.due_at ? new Date(r.due_at).toLocaleString('es-MX',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '',
          done: r.done, priority: r.priority || 'normal', assignee: r.asesor_name || '',
          assigneeType: r.assignee_type || 'human', due_at: r.due_at, status: r.status || 'pending', _persisted: true,
        }));
        setMetaActions(p => { const ids = new Set(mapped.map(m => m.id)); return [...mapped, ...p.filter(a => !a._persisted && !ids.has(a.id))]; });
      });
    return () => { cancelled = true; };
  }, [open, _online]);

  useEffect(() => {
    if (!_isManager && agendaView !== "mine") setAgendaView("mine");
    if (_isManager && agendaView === "mine" && metaNewAssignee) setMetaNewAssignee("");
  }, [_isManager, agendaView, metaNewAssignee]);

  // Lista dinámica de responsables: TODOS los activos del org (asesores + admins,
  // incluye nuevos). Reemplaza la lista hardcodeada. fn_org_team_members es
  // SECURITY DEFINER + org-scoped, así que el admin ve a todo su equipo.
  useEffect(() => {
    if (!open || !_online) return;
    let cancelled = false;
    supabase.rpc('fn_org_team_members').then(({ data, error }) => {
      if (cancelled || error || !data) { if (error) console.warn('[Stratos] team members load:', error.message); return; }
      setTeamMembers(data.map(m => m.name).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [open, _online]);

  const createAction = async () => {
    const txt = metaNewText.trim();
    if (!txt || !metaNewDate) return;               // fecha/hora OBLIGATORIA
    if (creatingForTeam && !metaNewAssignee) return; // responsable OBLIGATORIO para que Telegram recuerde a la persona correcta
    const dueIso = new Date(metaNewDate).toISOString();
    const localDate = new Date(metaNewDate).toLocaleString('es-MX',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    // Mi agenda se auto-asigna al usuario logueado. En modo equipo el admin elige
    // responsable explícito para que el recordatorio llegue a la persona correcta.
    const _selfId = creatingForTeam ? null : (user?.id || null);
    const assigneeName = creatingForTeam ? metaNewAssignee : _selfName;
    const category = normalizeAgendaCategory(metaNewCategory);
    const base = {
      text: txt,
      lead: agendaCategoryMeta(category).label,
      agendaCategory: category,
      asesor: assigneeName || 'Equipo',
      date: localDate,
      done: false,
      priority: 'normal',
      assignee: assigneeName || '',
      assigneeType: 'human',
      due_at: dueIso,
      status: 'pending',
    };
    setMetaNewText(''); setMetaNewDate('');
    if (_online) {
      const { data, error } = await supabase.from('team_actions')
        .insert({ text: txt, due_at: dueIso, priority: 'normal', category, asesor_id: _selfId, asesor_name: assigneeName })   // org lo pone el trigger team_actions_force_org
        .select('id').single();
      if (!error && data) {
        if (assigneeName) {
          supabase.rpc('fn_assign_team_action', { p_action_id: data.id, p_asesor_name: assigneeName })
            .then(({ error }) => { if (error) console.warn('[Stratos] assign team_action:', error.message); });
        }
        setMetaActions(p => [{ ...base, id: data.id, _persisted: true }, ...p]);
        return;
      }
      console.warn('[Stratos] team_action insert:', error?.message);
    }
    setMetaActions(p => [{ ...base, id: Date.now() }, ...p]);   // fallback offline
  };
  const persistDone = (a, done) => { if (a._persisted && _online) supabase.from('team_actions').update({ done, status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null, last_response_at: done ? new Date().toISOString() : null }).eq('id', a.id).then(({ error }) => { if (error) console.warn('[Stratos] team_action done:', error.message); }); };
  const persistDelete = (a) => { if (a._persisted && _online) supabase.from('team_actions').delete().eq('id', a.id).then(({ error }) => { if (error) console.warn('[Stratos] team_action delete:', error.message); }); };

  // ── Documentos del equipo (links) — persisten vía setMetaDocs (App.jsx → meta_config.documents)
  const [docUrl, setDocUrl] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const addDoc = () => {
    let u = docUrl.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try { new URL(u); } catch { return; }          // enlace inválido → no agregar
    const prov = detectDocProvider(u);
    const doc = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      url: u,
      title: docTitle.trim() || prov.name,
      addedBy: user?.name || "",
      addedAt: new Date().toISOString(),
    };
    setMetaDocs([doc, ...(metaDocs || [])]);
    setDocUrl(""); setDocTitle("");
  };
  const removeDoc = (id) => setMetaDocs((metaDocs || []).filter(d => d.id !== id));

  if (!open) return null;
  // Brand label fallback (compat con instancias legacy que no pasen el prop)
  const brandLabel = orgBrand || 'Duke del Caribe';
  // canEdit puede venir indefinido en versiones legacy → permitir edición por defecto
  const canEditFinal = canEdit === undefined ? true : canEdit;

  // Si la org no tiene goal configurado (placeholder Grupo 28 etc.), evitamos
  // división por 0 y mostramos % de pipeline contra un fallback simbólico.
  const GOAL2  = metaPlan?.goal > 0 ? metaPlan.goal : 48_000_000;
  const hasGoal = (metaPlan?.goal || 0) > 0;
  const aLeads = leadsData.filter(l => l.presupuesto > 0);
  const pipe2  = aLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const pct2   = hasGoal ? Math.min(100, Math.round((pipe2 / GOAL2) * 100)) : 0;
  const avgSc  = aLeads.length ? Math.round(aLeads.reduce((s, l) => s + (l.sc || 0), 0) / aLeads.length) : 0;
  const fmtM   = n => n >= 1e6 ? `$${(n/1e6).toFixed(1).replace(/\.0$/,"")}M` : `$${(n/1e3).toFixed(0)}K`;

  /* ── Helpers ── */
  const sectionHd = (label, color) => (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:13 }}>
      <div style={{ width:3, height:16, borderRadius:2, background:color }} />
      <span style={{ fontSize:11, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.1em", textTransform:"uppercase", color }}>{label}</span>
    </div>
  );
  const colHd = txt => (
    <p style={{ margin:"0 0 9px", fontSize:11.5, fontWeight:700, fontFamily:fontDisp, color:T.txt2, letterSpacing:"0.04em", textTransform:"uppercase" }}>{txt}</p>
  );
  // Componente in-line: editable solo si canEditFinal (super_admin/admin); en
  // modo solo-lectura se renderiza como <span> normal sin borde dashed ni cursor text,
  // y los asesores no pueden mutar el contenido.
  // Para placeholders vacíos (Grupo 28 recién creado) mostramos un dim "—" para
  // que el usuario sepa que hay un campo editable ahí.
  const placeholderEmpty = (v) => (v === '' || v == null);
  const E = ({ val, onSave, style={}, multi=false }) => {
    const displayVal = placeholderEmpty(val) ? (canEditFinal ? '— Click para configurar —' : '') : val;
    const isEmptyHint = placeholderEmpty(val);
    if (!canEditFinal) {
      return <span style={{ display:"block", ...style }}>{displayVal}</span>;
    }
    // Afordancia de edición discreta (estilo Apple): texto limpio por defecto;
    // el resalte y el anillo de foco aparecen solo en hover/focus (clase .mp-edit).
    // Adiós al subrayado punteado permanente que ensuciaba las 4 pestañas.
    return (
      <span
        className="mp-edit"
        contentEditable suppressContentEditableWarning
        onFocus={e => { if (isEmptyHint) e.currentTarget.textContent = ''; }}
        onBlur={e => {
          const v = e.currentTarget.textContent.trim();
          if (v && v !== '— Click para configurar —') onSave(v);
          else if (!v && !isEmptyHint) onSave('');  // permitir borrar
          else if (!v) e.currentTarget.textContent = '— Click para configurar —';
        }}
        onKeyDown={e => { if(!multi && e.key==="Enter"){ e.preventDefault(); e.currentTarget.blur(); } }}
        title="Click para editar"
        style={{
          display:"block", width:"fit-content", maxWidth:"100%",
          outline:"none", minWidth:20,
          opacity: isEmptyHint ? 0.5 : 1,
          fontStyle: isEmptyHint ? 'italic' : (style.fontStyle || 'normal'),
          ...style,
        }}
      >{displayVal}</span>
    );
  };

  const tabs = [
    { id:"acciones",  label:"Agenda" },
    { id:"docs",      label:"Documentos" },
    { id:"plan",      label:"Plan Estratégico" },
    { id:"protocolo", label:"Protocolo de Ventas" },
  ];

  // En móvil la barra lateral (widget AVANCE que abre este panel en desktop)
  // no existe; el panel se abre desde el menú "+" y debe encajar en pantalla.
  const isMobile = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 768);

  // ── Lenguaje visual del panel (auditoría "ERP pro × Apple", Jul 2026) ─────────
  // Variables CSS por tema + una capa <style> para hover/focus/afinaciones que el
  // estilo inline no puede expresar (pseudo-clases, scrollbar, transiciones al hover).
  const _hex = (c, a) => (typeof c === "string" && c[0] === "#" && c.length === 7) ? c + a : c;
  const ring     = _hex(T.accent, "66");
  const ringSoft = _hex(T.accent, "26");
  const selectedDueDate = metaNewDate ? metaNewDate.slice(0, 10) : "";
  const selectedDueTime = metaNewDate ? metaNewDate.slice(11, 16) : "";
  const dueTimeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
  const dayNames = ["L", "M", "M", "J", "V", "S", "D"];
  const monthLabel = calendarMonth.toLocaleDateString("es-MX", { month:"long", year:"numeric" }).replace(/^\w/, c => c.toUpperCase());
  const calendarDays = (() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, m, 1 - startOffset + i);
      return { date: d, value: localYmd(d), inMonth: d.getMonth() === m };
    });
  })();
  const addDays = (days) => {
    const next = new Date();
    next.setDate(next.getDate() + days);
    return localYmd(next);
  };
  const currentTimeValue = () => {
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  };
  const openDuePicker = (mode) => {
    if (mode === "date" && selectedDueDate) setCalendarMonth(new Date(`${selectedDueDate}T12:00:00`));
    setDuePickerOpen(prev => prev === mode ? null : mode);
  };
  const moveCalendarMonth = (delta) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
  const dateChipLabel = (dateValue) => {
    if (!dateValue) return "Fecha";
    const today = localYmd(new Date());
    const tomorrow = addDays(1);
    if (dateValue === today) return "Hoy";
    if (dateValue === tomorrow) return "Mañana";
    const date = new Date(`${dateValue}T12:00:00`);
    return date.toLocaleDateString("es-MX", { weekday:"short", day:"numeric", month:"short" }).replace(".", "");
  };
  const timeChipLabel = (timeValue) => {
    if (!timeValue) return "Hora";
    return new Date(`2026-01-01T${timeValue}:00`).toLocaleTimeString("es-MX", { hour:"numeric", minute:"2-digit" }).replace(/\s/g, " ");
  };
  const setActionDueDate = (dateValue) => {
    setMetaNewDate(dateValue ? `${dateValue}T${selectedDueTime || "09:00"}` : "");
  };
  const setActionDueTime = (timeValue) => {
    setMetaNewDate(timeValue ? `${selectedDueDate || localYmd(new Date())}T${timeValue}` : "");
  };
  const clearActionDue = () => {
    setMetaNewDate("");
    setDuePickerOpen(null);
  };
  const agendaActions = (_isManager && agendaView === "team")
    ? metaActions
    : metaActions.filter(_isOwnAction);
  const pendingAgendaActions = agendaActions.filter(a => !a.done);
  const completedAgendaActions = agendaActions.filter(a => a.done);
  const ownPendingCount = metaActions.filter(a => !a.done && _isOwnAction(a)).length;
  const teamPendingCount = metaActions.filter(a => !a.done).length;
  const chevron  = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${isLight ? "%235C6B82" : "%238B99AE"}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>")`;
  const panelBg  = isLight
    ? "#F1F3F6"
    : "radial-gradient(130% 90% at 50% -25%, rgba(110,231,194,0.06), rgba(126,184,240,0.028) 34%, transparent 62%), #080C15";
  const mpVars = {
    "--mp-txt": T.txt, "--mp-txt2": T.txt2, "--mp-txt3": T.txt3,
    "--mp-accent": T.accent, "--mp-border": T.border, "--mp-borderH": T.borderH,
    "--mp-hairline": isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)",
    "--mp-bg": panelBg,
    "--mp-topbar": isLight ? "rgba(244,246,249,0.82)" : "rgba(10,14,22,0.72)",
    "--mp-seg-bg": isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.045)",
    "--mp-seg-on": isLight ? "#FFFFFF" : "rgba(255,255,255,0.10)",
    "--mp-edit": isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
    "--mp-ring": ring, "--mp-ringSoft": ringSoft,
    "--mp-scroll": isLight ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.12)",
    "--mp-rowShadow": isLight ? "0 1px 2px rgba(15,23,42,0.05), 0 10px 28px rgba(15,23,42,0.08)" : "0 1px 2px rgba(0,0,0,0.40), 0 12px 32px rgba(0,0,0,0.32)",
    "--mp-chevron": chevron,
  };
  const MP_CSS = `
    .mp{position:fixed;inset:0;z-index:601;display:flex;flex-direction:column;overflow:hidden;background:var(--mp-bg);animation:mpIn .3s ease both;-webkit-font-smoothing:antialiased}
    @keyframes mpIn{from{opacity:0}to{opacity:1}}
    .mp-body{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:var(--mp-scroll) transparent}
    .mp-body::-webkit-scrollbar{width:12px;height:12px}
    .mp-body::-webkit-scrollbar-thumb{background:var(--mp-scroll);border-radius:99px;border:4px solid transparent;background-clip:padding-box}
    .mp-body::-webkit-scrollbar-thumb:hover{background:var(--mp-txt3)}
    .mp-topbar{position:sticky;top:0;z-index:20;flex-shrink:0;background:var(--mp-topbar);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);border-bottom:1px solid var(--mp-hairline)}
    .mp-seg{display:inline-flex;gap:2px;padding:4px;border-radius:15px;background:var(--mp-seg-bg);border:1px solid var(--mp-hairline)}
    .mp-seg>button{appearance:none;-webkit-appearance:none;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;letter-spacing:-.015em;color:var(--mp-txt2);padding:9px 20px;border-radius:11px;white-space:nowrap;transition:color .2s ease,background .2s ease,box-shadow .2s ease}
    .mp-seg>button:hover{color:var(--mp-txt)}
    .mp-seg>button[data-on="1"]{color:var(--mp-txt);background:var(--mp-seg-on);box-shadow:0 1px 3px rgba(0,0,0,.16),0 0 0 .5px rgba(255,255,255,.05)}
    .mp-edit{border-radius:6px;margin:0 -4px;padding:0 4px;transition:background .15s ease,box-shadow .15s ease;cursor:text}
    .mp-edit:hover{background:var(--mp-edit)}
    .mp-edit:focus{background:var(--mp-edit);box-shadow:0 0 0 2px var(--mp-ring)}
    .mp-row{transition:background .18s ease,border-color .18s ease,box-shadow .2s ease}
    .mp-row:hover{border-color:var(--mp-borderH)!important;box-shadow:var(--mp-rowShadow)}
    .mp-grip{opacity:0;transition:opacity .16s ease}
    .mp-row:hover .mp-grip{opacity:.4}
    .mp-del{opacity:0;transition:opacity .16s ease}
    .mp-row:hover .mp-del{opacity:.5}
    .mp-del:hover{opacity:1!important}
    .mp-actions{transition:transform .2s cubic-bezier(.16,1,.3,1)}
    .mp-row:hover .mp-actions{transform:translateX(-34px)}
    .mp-rowdel{position:absolute;right:16px;top:50%;transform:translateY(-50%);opacity:0;transition:opacity .18s ease}
    .mp-row:hover .mp-rowdel{opacity:.55}
    .mp-rowdel:hover{opacity:1!important}
    .mp-check{transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}
    .mp-check:hover{border-color:var(--mp-accent)!important;box-shadow:0 0 0 4px var(--mp-ringSoft)}
    .mp-select{appearance:none;-webkit-appearance:none;background-image:var(--mp-chevron);background-repeat:no-repeat;background-position:right 9px center;background-size:10px;padding-right:26px!important;transition:border-color .16s ease,background-color .16s ease}
    .mp-select:hover{border-color:var(--mp-borderH)!important}
    .mp-input{transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}
    .mp-input::placeholder{color:var(--mp-txt3);opacity:1}
    .mp-datechip{transition:transform .14s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease,color .16s ease}
    .mp-datechip:hover{transform:translateY(-1px);border-color:var(--mp-borderH)!important;box-shadow:0 10px 24px rgba(15,23,42,.08)}
    .mp-datechip:active{transform:translateY(0) scale(.98)}
    .mp-due-popover{animation:mpPop .16s cubic-bezier(.16,1,.3,1) both}
    @keyframes mpPop{from{opacity:0}to{opacity:1}}
    .mp-calday,.mp-timebtn,.mp-iconbtn{transition:background .14s ease,border-color .14s ease,color .14s ease,transform .12s ease,box-shadow .14s ease}
    .mp-calday:hover,.mp-timebtn:hover,.mp-iconbtn:hover{transform:translateY(-1px);border-color:var(--mp-accent)!important;box-shadow:0 10px 22px rgba(15,23,42,.10)}
    .mp-calday:active,.mp-timebtn:active,.mp-iconbtn:active{transform:translateY(0) scale(.97)}
    .mp-quickchip{transition:background .14s ease,border-color .14s ease,color .14s ease,transform .14s ease}
    .mp-quickchip:hover{transform:translateY(-1px);border-color:var(--mp-accent)!important;color:var(--mp-accent)!important}
    .mp-ghost{transition:background .16s ease,border-color .16s ease,color .16s ease}
    .mp-fade{animation:mpFade .3s cubic-bezier(.16,1,.3,1) both}
    @keyframes mpFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:768px){.mp-seg{display:grid;grid-template-columns:1fr 1fr;width:100%}.mp-mobilebody [style*="grid-template-columns"]{grid-template-columns:1fr!important}.mp-mobilebody [style*="min-width"]{min-width:0!important}}
  `;

  return (
    <>
      {/* Panel como SECCIÓN dentro del contenido: en escritorio se confina al área
          de contenido (debajo del header de 52px y a la derecha del sidebar de 72px),
          dejando visibles el header y el menú izquierdo. En móvil (sin sidebar) ocupa
          toda la pantalla. La clase .mp trae position:fixed; inset:0 — acá sólo movemos
          top/left para dejar el marco de la app a la vista. */}
      <div className="mp" style={{ ...mpVars, top: isMobile ? 0 : 52, left: isMobile ? 0 : 72 }}>
        <style>{MP_CSS}</style>

        {/* ── Barra superior (sticky, translúcida, alineada al contenedor) ── */}
        <div className="mp-topbar">
          <div style={{
            width:"100%", maxWidth:1840, margin:"0 auto",
            padding: isMobile ? "12px 16px" : "0 48px",
            minHeight: isMobile ? 0 : 72,
            display: isMobile ? "flex" : "grid",
            gridTemplateColumns: isMobile ? undefined : "1fr auto 1fr",
            alignItems:"center", gap:16,
            flexWrap: isMobile ? "wrap" : undefined, rowGap: isMobile ? 12 : 0,
          }}>
            {/* Marca */}
            <div style={{ display:"flex", alignItems:"center", gap:13, minWidth:0, order: isMobile ? 1 : 0 }}>
              <div style={{ width:42, height:42, borderRadius:13, background:`linear-gradient(135deg, ${T.accent}26, ${T.accent}08)`, border:`1px solid ${T.accent}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`inset 0 1px 0 ${T.accent}1F` }}>
                <Target size={20} color={T.accent} strokeWidth={2} />
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, fontSize:17, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.025em", color:T.txt, display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  Mi Espacio
                  {savingConfig && (
                    <span style={{ fontSize:10, fontWeight:600, color:T.accent, background:`${T.accent}18`, borderRadius:99, padding:"2px 9px", letterSpacing:0, flexShrink:0 }}>guardando…</span>
                  )}
                </p>
                <p style={{ margin:"2px 0 0", fontSize:11.5, color:T.txt3, fontFamily:font, letterSpacing:"0.02em", whiteSpace:"nowrap" }}>{user?.name || "Plan Estratégico · Scaling Up · 2026"}</p>
              </div>
            </div>
            {/* Control segmentado */}
            <div className="mp-seg" style={{ order: isMobile ? 3 : 0, flexBasis: isMobile ? "100%" : "auto", justifySelf:"center" }}>
              {tabs.map(({ id, label }) => (
                <button key={id} data-on={metaTab===id ? "1" : "0"} onClick={() => setMetaTab(id)}>{label}</button>
              ))}
            </div>
            {/* Cerrar */}
            <button onClick={onClose} title="Cerrar" style={{
              order: isMobile ? 2 : 0, justifySelf:"end", flexShrink:0,
              width:38, height:38, borderRadius:"50%", border:`1px solid ${T.border}`,
              background:T.glass, color:T.txt2, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}><X size={18} strokeWidth={2} /></button>
          </div>
        </div>

        {/* ── Cuerpo scrolleable ── */}
        <div className={"mp-body meta-body" + (isMobile ? " mp-mobilebody" : "")}>
          <div className="mp-fade" key={metaTab} style={{
            width:"100%", maxWidth:1840, margin:"0 auto",
            padding: isMobile ? "18px 16px calc(28px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "40px 48px 72px",
          }}>

          {/* ═══ TAB 1: LISTA DE ACCIÓN ══════════════════════════════════ */}
          {metaTab === "acciones" && (
            <div style={{ width:"100%" }}>
              {/* Header + progreso */}
              {(() => {
                const pend = pendingAgendaActions.length;
                const done = completedAgendaActions.length;
                const total = pend + done;
                const pct = total ? Math.round((done/total)*100) : 0;
                const isTeamView = _isManager && agendaView === "team";
                return (
                  <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:24, flexWrap:"wrap", marginBottom:26 }}>
                    <div>
                      <h3 style={{ margin:0, fontSize:28, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.045em", color:T.txt }}>
                        Agenda personal y profesional
                      </h3>
                      <p style={{ margin:"8px 0 0", fontSize:14, color:T.txt3, fontFamily:font }}>
                        <span style={{ color:T.txt2, fontWeight:600 }}>{pend}</span> pendientes · {done} completadas
                        <span style={{ marginLeft:8, opacity:0.55 }}>
                          · {isTeamView ? "Vista de todo el equipo" : "Tu espacio de trabajo"}
                        </span>
                      </p>
                    </div>
                    {total > 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:210, flex: isMobile ? "1 1 100%" : "0 1 300px" }}>
                        <div style={{ flex:1, height:7, borderRadius:99, background: isLight?"rgba(15,23,42,0.07)":"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", borderRadius:99, background:`linear-gradient(90deg, #0D9A76, ${T.accent})`, transition:"width .5s cubic-bezier(.16,1,.3,1)" }} />
                        </div>
                        <span style={{ fontSize:13.5, fontWeight:700, fontFamily:fontDisp, color:T.txt2, whiteSpace:"nowrap", minWidth:38, textAlign:"right" }}>{pct}%</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {_isManager && (
                <div style={{
                  display:"grid",
                  gridTemplateColumns:isMobile ? "1fr" : "repeat(2, minmax(220px, 1fr))",
                  gap:10,
                  margin:"-10px 0 18px",
                }}>
                  {[
                    { id:"mine", title:"Mi agenda", sub:"Personal y profesional del admin", count:ownPendingCount, Icon:UserRound },
                    { id:"team", title:"Equipo completo", sub:"Ver y asignar actividades", count:teamPendingCount, Icon:Users },
                  ].map(({ id, title, sub, count, Icon }) => {
                    const active = agendaView === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAgendaView(id)}
                        style={{
                          minHeight:74,
                          borderRadius:24,
                          padding:"14px 16px",
                          display:"flex",
                          alignItems:"center",
                          gap:13,
                          textAlign:"left",
                          cursor:"pointer",
                          border:`1px solid ${active ? _hex(T.accent,"58") : (isLight ? "rgba(15,23,42,0.075)" : "rgba(255,255,255,0.085)")}`,
                          background:active
                            ? `linear-gradient(135deg, ${_hex(T.accent,"16")}, ${isLight ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.05)"})`
                            : (isLight ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.035)"),
                          boxShadow:active ? `0 14px 34px ${_hex(T.accent,"14")}, inset 0 1px 0 rgba(255,255,255,0.48)` : "none",
                        }}
                      >
                        <span style={{
                          width:42, height:42, borderRadius:17,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:active ? T.accent : T.txt3,
                          background:active ? `${T.accent}14` : (isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.055)"),
                          flexShrink:0,
                        }}>
                          <Icon size={19} strokeWidth={2.05} />
                        </span>
                        <span style={{ minWidth:0, flex:1 }}>
                          <span style={{ display:"block", color:T.txt, fontSize:14.5, fontWeight:850, fontFamily:fontDisp, letterSpacing:"-0.025em" }}>{title}</span>
                          <span style={{ display:"block", color:T.txt3, fontSize:11.5, fontWeight:650, fontFamily:font, marginTop:2 }}>{sub}</span>
                        </span>
                        <span style={{
                          minWidth:34, height:28, padding:"0 10px", borderRadius:999,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:active ? T.accent : T.txt2,
                          background:active ? `${T.accent}12` : (isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.05)"),
                          border:`1px solid ${active ? _hex(T.accent,"26") : "transparent"}`,
                          fontSize:12.5, fontWeight:850, fontFamily:fontDisp,
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Composer premium */}
              <div style={{
                position:"relative",
                zIndex: duePickerOpen ? 80 : 1,
                display:"grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(420px, 1.08fr) minmax(380px, 0.78fr) 156px",
                gap:12,
                marginBottom:30,
                alignItems:"stretch",
              }}>
                <div style={{
                  minHeight:118,
                  borderRadius:30,
                  padding:14,
                  background:isLight
                    ? "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.028))",
                  border:`1px solid ${metaNewText ? _hex(T.accent,"70") : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.085)")}`,
                  boxShadow: metaNewText
                    ? `0 0 0 1px ${_hex(T.accent,"22")}, 0 18px 48px ${_hex(T.accent,"12")}`
                    : (isLight ? "0 20px 55px rgba(15,23,42,0.075), inset 0 1px 0 rgba(255,255,255,0.75)" : "inset 0 1px 0 rgba(255,255,255,0.055)"),
                  backdropFilter:"saturate(180%) blur(22px)",
                  WebkitBackdropFilter:"saturate(180%) blur(22px)",
                }}>
                  <label style={{ display:"flex", alignItems:"center", gap:13, minHeight:48 }}>
                    <span style={{
                      width:34, height:34, borderRadius:14, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: metaNewText ? `${T.accent}18` : (isLight ? "rgba(15,23,42,0.045)" : "rgba(255,255,255,0.055)"),
                      color: metaNewText ? T.accent : T.txt3,
                    }}>
                      <Plus size={18} strokeWidth={2.35} />
                    </span>
                    <input
                      className="mp-input"
                      value={metaNewText}
                      onChange={e => setMetaNewText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createAction(); }}
                      placeholder="Escribe la siguiente acción…"
                      style={{
                        width:"100%", border:"none", background:"transparent",
                        color:T.txt, fontSize:isMobile ? 16 : 17, fontWeight:520,
                        fontFamily:font, outline:"none", padding:"4px 0",
                        letterSpacing:"-0.025em",
                      }}
                    />
                  </label>
                  <div style={{
                    display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
                    marginTop:12, paddingTop:12,
                    borderTop:`1px solid ${isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.065)"}`,
                  }}>
                    <select
                      className="mp-select"
                      value={metaNewCategory}
                      onChange={e => {
                        const value = e.target.value;
                        setMetaNewCategory(value);
                        if (value === "personal" && metaNewAssignee === "Todos") setMetaNewAssignee("");
                      }}
                      title="Tipo de agenda"
                      style={{
                        height:36, borderRadius:999, padding:"0 30px 0 13px",
                        background:isLight ? "rgba(248,250,252,0.92)" : "rgba(255,255,255,0.052)",
                        border:`1px solid ${isLight ? "rgba(15,23,42,0.075)" : "rgba(255,255,255,0.085)"}`,
                        color:T.txt2, fontSize:12.5, fontWeight:800, fontFamily:fontDisp,
                        outline:"none", cursor:"pointer",
                      }}
                    >
                      {AGENDA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {creatingForTeam ? (
                      <select
                        className="mp-select"
                        value={metaNewAssignee}
                        onChange={e => setMetaNewAssignee(e.target.value)}
                        title="Asignar responsable"
                        style={{
                          height:36, maxWidth:isMobile ? "100%" : 280,
                          borderRadius:999, padding:"0 30px 0 13px",
                          background:isLight ? "rgba(248,250,252,0.92)" : "rgba(255,255,255,0.052)",
                          border:`1px solid ${metaNewAssignee ? _hex(T.accent,"45") : (isLight ? "rgba(15,23,42,0.075)" : "rgba(255,255,255,0.085)")}`,
                          color:metaNewAssignee ? T.txt2 : T.txt3,
                          fontSize:12.5, fontWeight:750, fontFamily:font,
                          outline:"none", cursor:"pointer",
                        }}
                      >
                        <option value="">Asignar a un asesor</option>
                        {metaNewCategory !== "personal" && <option value="Todos">Todos (equipo)</option>}
                        {teamMemberOptions.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{
                        height:36, maxWidth:isMobile ? "100%" : 280,
                        borderRadius:999, padding:"0 13px",
                        display:"inline-flex", alignItems:"center", gap:8,
                        background:isLight ? "rgba(248,250,252,0.92)" : "rgba(255,255,255,0.052)",
                        border:`1px solid ${_hex(T.accent,"35")}`,
                        color:T.txt2,
                        fontSize:12.5, fontWeight:750, fontFamily:font,
                      }}>
                        <UserRound size={13} color={T.accent} strokeWidth={2.2} />
                        Para mí · {_selfName}
                      </span>
                    )}
                    <span style={{ marginLeft:"auto", fontSize:11.5, fontFamily:font, color:T.txt3, whiteSpace:"nowrap" }}>
                      Enter crea si está completo
                    </span>
                  </div>
                </div>
                <div style={{
                  position:"relative",
                  zIndex: duePickerOpen ? 90 : 1,
                  overflow:"visible",
                  minHeight:118,
                  padding:12,
                  borderRadius:30,
                  background:isLight
                    ? "linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.68))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.026))",
                  border:`1px solid ${metaNewDate ? _hex(T.accent,"58") : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.085)")}`,
                  boxShadow: metaNewDate
                    ? `0 0 0 1px ${_hex(T.accent,"18")}, 0 18px 48px ${_hex(T.accent,"10")}`
                    : (isLight ? "0 20px 55px rgba(15,23,42,0.075), inset 0 1px 0 rgba(255,255,255,0.75)" : "inset 0 1px 0 rgba(255,255,255,0.055)"),
                  backdropFilter:"saturate(180%) blur(22px)",
                  WebkitBackdropFilter:"saturate(180%) blur(22px)",
                }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <button
                      type="button"
                      className="mp-datechip"
                      onClick={() => openDuePicker("date")}
                      style={{
                        height:50, borderRadius:18, border:`1px solid ${duePickerOpen === "date" || selectedDueDate ? _hex(T.accent,"58") : (isLight ? "rgba(15,23,42,0.075)" : "rgba(255,255,255,0.085)")}`,
                        background: duePickerOpen === "date" || selectedDueDate ? `${T.accent}11` : (isLight?"rgba(248,250,252,0.82)":"rgba(255,255,255,0.045)"),
                        color: selectedDueDate ? T.txt : T.txt2, cursor:"pointer", fontFamily:fontDisp,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                        fontSize:14.5, fontWeight:800, letterSpacing:"-0.025em",
                      }}
                    >
                      <CalendarDays size={17} color={duePickerOpen === "date" || selectedDueDate ? T.accent : T.txt3} strokeWidth={2.25} />
                      {dateChipLabel(selectedDueDate)}
                    </button>
                    <button
                      type="button"
                      className="mp-datechip"
                      onClick={() => openDuePicker("time")}
                      style={{
                        height:50, borderRadius:18, border:`1px solid ${duePickerOpen === "time" || selectedDueTime ? _hex(T.accent,"58") : (isLight ? "rgba(15,23,42,0.075)" : "rgba(255,255,255,0.085)")}`,
                        background: duePickerOpen === "time" || selectedDueTime ? `${T.accent}11` : (isLight?"rgba(248,250,252,0.82)":"rgba(255,255,255,0.045)"),
                        color: selectedDueTime ? T.txt : T.txt2, cursor:"pointer", fontFamily:fontDisp,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                        fontSize:14.5, fontWeight:800, letterSpacing:"-0.025em",
                      }}
                    >
                      <Clock size={17} color={duePickerOpen === "time" || selectedDueTime ? T.accent : T.txt3} strokeWidth={2.25} />
                      {timeChipLabel(selectedDueTime)}
                    </button>
                  </div>
                  <div style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap",
                    padding:"12px 4px 0",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      {[
                        ["Hoy", addDays(0)],
                        ["Mañana", addDays(1)],
                        ["+2 días", addDays(2)],
                      ].map(([label, value]) => (
                        <button
                          key={label}
                          type="button"
                          className="mp-quickchip"
                          onClick={() => { setActionDueDate(value); setCalendarMonth(new Date(`${value}T12:00:00`)); }}
                          style={{
                            border:`1px solid ${selectedDueDate === value ? _hex(T.accent,"58") : "transparent"}`,
                            background:selectedDueDate === value ? `${T.accent}12` : "transparent",
                            color:selectedDueDate === value ? T.accent : T.txt3,
                            borderRadius:99, padding:"6px 10px", fontSize:11.5, fontWeight:800,
                            fontFamily:fontDisp, cursor:"pointer", letterSpacing:"-0.01em",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      {["09:00", "11:00", "16:00"].map((timeValue) => (
                        <button
                          key={timeValue}
                          type="button"
                          className="mp-quickchip"
                          onClick={() => setActionDueTime(timeValue)}
                          style={{
                            border:`1px solid ${selectedDueTime === timeValue ? _hex(T.accent,"58") : "transparent"}`,
                            background:selectedDueTime === timeValue ? `${T.accent}12` : "transparent",
                            color:selectedDueTime === timeValue ? T.accent : T.txt3,
                            borderRadius:99, padding:"6px 10px", fontSize:11.5, fontWeight:800,
                            fontFamily:fontDisp, cursor:"pointer", letterSpacing:"-0.01em",
                          }}
                        >
                          {timeValue}
                        </button>
                      ))}
                    </div>
                  </div>
                  {duePickerOpen && (
                    <div
                      className="mp-due-popover"
                      style={{
                        position:isMobile ? "fixed" : "absolute",
                        top:isMobile ? "auto" : "calc(100% + 12px)",
                        left:isMobile ? 14 : 0,
                        right:isMobile ? 14 : 0,
                        bottom:isMobile ? "calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" : "auto",
                        width:isMobile ? "auto" : "100%",
                        maxHeight:isMobile ? "70dvh" : "min(470px, calc(100vh - 260px))",
                        overflowY:"auto",
                        zIndex:120,
                        marginTop:0,
                        padding:14,
                        borderRadius:24,
                        background:isLight ? "#FFFFFF" : "#0D121D",
                        border:`1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.12)"}`,
                        boxShadow:isLight ? "0 30px 80px rgba(15,23,42,0.24), 0 2px 8px rgba(15,23,42,0.10)" : "0 34px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.05)",
                        backdropFilter:"none",
                        WebkitBackdropFilter:"none",
                      }}
                    >
                      {duePickerOpen === "date" ? (
                        <>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:12 }}>
                            <button
                              type="button"
                              className="mp-iconbtn"
                              onClick={() => moveCalendarMonth(-1)}
                              title="Mes anterior"
                              style={{ width:34, height:34, borderRadius:12, border:`1px solid ${T.border}`, background:isLight?"rgba(15,23,42,0.035)":"rgba(255,255,255,0.055)", color:T.txt2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <div style={{ textAlign:"center", minWidth:0 }}>
                              <p style={{ margin:0, fontSize:14.5, fontWeight:800, fontFamily:fontDisp, color:T.txt, letterSpacing:"-0.02em" }}>{monthLabel}</p>
                              <p style={{ margin:"2px 0 0", fontSize:10.5, fontFamily:font, color:T.txt3 }}>Selecciona el día del pendiente</p>
                            </div>
                            <button
                              type="button"
                              className="mp-iconbtn"
                              onClick={() => moveCalendarMonth(1)}
                              title="Mes siguiente"
                              style={{ width:34, height:34, borderRadius:12, border:`1px solid ${T.border}`, background:isLight?"rgba(15,23,42,0.035)":"rgba(255,255,255,0.055)", color:T.txt2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5, marginBottom:6 }}>
                            {dayNames.map((d, i) => (
                              <div key={`${d}-${i}`} style={{ height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10.5, fontWeight:800, fontFamily:fontDisp, color:T.txt3 }}>
                                {d}
                              </div>
                            ))}
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
                            {calendarDays.map(({ date, value, inMonth }) => {
                              const isSelected = selectedDueDate === value;
                              const isToday = value === localYmd(new Date());
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className="mp-calday"
                                  onClick={() => { setActionDueDate(value); setDuePickerOpen("time"); }}
                                  style={{
                                    height:34,
                                    borderRadius:11,
                                    border:`1px solid ${isSelected ? `${T.accent}88` : isToday ? `${T.accent}35` : "transparent"}`,
                                    background:isSelected ? `linear-gradient(135deg, ${T.accent}, #0D9A76)` : isToday ? `${T.accent}10` : "transparent",
                                    color:isSelected ? "#041016" : inMonth ? T.txt : T.txt3,
                                    opacity:inMonth ? 1 : 0.38,
                                    fontSize:13,
                                    fontWeight:isSelected || isToday ? 800 : 650,
                                    fontFamily:fontDisp,
                                    cursor:"pointer",
                                  }}
                                >
                                  {date.getDate()}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr auto auto", alignItems:"center", gap:8, marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                            <label style={{
                              display:"flex", alignItems:"center", gap:8,
                              minHeight:36, borderRadius:13, padding:"0 11px",
                              border:`1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                              background:isLight ? "rgba(248,250,252,0.88)" : "rgba(255,255,255,0.045)",
                              color:T.txt2, fontSize:11.5, fontWeight:800, fontFamily:fontDisp,
                            }}>
                              Fecha exacta
                              <input
                                type="date"
                                value={selectedDueDate}
                                onChange={e => {
                                  const value = e.target.value;
                                  if (!value) return;
                                  setCalendarMonth(new Date(`${value}T12:00:00`));
                                  setActionDueDate(value);
                                  setDuePickerOpen("time");
                                }}
                                style={{
                                  minWidth:132, border:"none", outline:"none", background:"transparent",
                                  color:T.txt, fontSize:12.5, fontWeight:800, fontFamily:fontDisp,
                                  colorScheme:isLight ? "light" : "dark",
                                }}
                              />
                            </label>
                            <button type="button" onClick={() => { const today = localYmd(new Date()); setCalendarMonth(new Date(`${today}T12:00:00`)); setActionDueDate(today); setDuePickerOpen("time"); }} className="mp-quickchip" style={{ border:`1px solid ${T.border}`, background:isLight?"rgba(15,23,42,0.035)":"rgba(255,255,255,0.045)", color:T.txt2, borderRadius:99, padding:"7px 11px", fontSize:11.5, fontWeight:800, fontFamily:fontDisp, cursor:"pointer" }}>Hoy</button>
                            <button type="button" onClick={clearActionDue} className="mp-quickchip" style={{ border:"1px solid transparent", background:"transparent", color:T.txt3, borderRadius:99, padding:"7px 11px", fontSize:11.5, fontWeight:750, fontFamily:fontDisp, cursor:"pointer" }}>Limpiar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:12 }}>
                            <div>
                              <p style={{ margin:0, fontSize:14.5, fontWeight:800, fontFamily:fontDisp, color:T.txt, letterSpacing:"-0.02em" }}>Horario</p>
                              <p style={{ margin:"2px 0 0", fontSize:10.5, fontFamily:font, color:T.txt3 }}>{dateChipLabel(selectedDueDate)} · recordatorio automático</p>
                            </div>
                            <button type="button" onClick={() => setDuePickerOpen("date")} className="mp-quickchip" style={{ border:`1px solid ${T.border}`, background:isLight?"rgba(15,23,42,0.035)":"rgba(255,255,255,0.045)", color:T.txt2, borderRadius:99, padding:"7px 11px", fontSize:11.5, fontWeight:800, fontFamily:fontDisp, cursor:"pointer" }}>Cambiar fecha</button>
                          </div>
                          <div style={{ marginBottom:10 }}>
                            <label
                              onClick={e => {
                                const input = e.currentTarget.querySelector("input");
                                if (e.target !== input && typeof input?.showPicker === "function") input.showPicker();
                              }}
                              style={{
                                display:"grid",
                                gridTemplateColumns:isMobile ? "1fr" : "1fr minmax(170px, 220px)",
                                alignItems:"center",
                                gap:12,
                                minHeight:74,
                                borderRadius:20,
                                padding:"12px",
                                border:`1px solid ${selectedDueTime ? _hex(T.accent,"62") : (isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)")}`,
                                background:selectedDueTime ? `${T.accent}10` : (isLight ? "rgba(248,250,252,0.94)" : "rgba(255,255,255,0.048)"),
                                boxShadow:selectedDueTime ? `inset 0 0 0 1px ${_hex(T.accent,"18")}` : "none",
                                cursor:"pointer",
                              }}
                            >
                              <span style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
                                <span style={{ color:T.txt, fontSize:14, fontWeight:850, fontFamily:fontDisp, letterSpacing:"-0.02em" }}>Hora exacta</span>
                                <span style={{ color:T.txt3, fontSize:11, fontWeight:650, fontFamily:font, lineHeight:1.35 }}>Toca el campo y elige cualquier hora/minuto</span>
                              </span>
                              <span style={{
                                display:"flex", alignItems:"center", gap:9,
                                height:50, borderRadius:16, padding:"0 12px",
                                border:`1px solid ${isLight ? "rgba(15,23,42,0.11)" : "rgba(255,255,255,0.11)"}`,
                                background:isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)",
                              }}>
                                <Clock size={17} color={selectedDueTime ? T.accent : T.txt3} strokeWidth={2.25} />
                                <input
                                  type="time"
                                  step="60"
                                  value={selectedDueTime}
                                  aria-label="Hora exacta de la acción"
                                  onChange={e => setActionDueTime(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter" && selectedDueTime) setDuePickerOpen(null); }}
                                  style={{
                                    width:"100%", minWidth:0, height:48, border:"none",
                                    background:"transparent", color:T.txt, fontSize:18,
                                    fontWeight:900, fontFamily:fontDisp, letterSpacing:"-0.03em",
                                    outline:"none", colorScheme:isLight ? "light" : "dark",
                                    cursor:"pointer",
                                  }}
                                />
                              </span>
                            </label>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:8, padding:"0 2px" }}>
                              <button
                                type="button"
                                className="mp-quickchip"
                                onClick={() => setActionDueTime(currentTimeValue())}
                                style={{
                                  border:`1px solid ${T.border}`,
                                  background:isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.045)",
                                  color:T.txt2, borderRadius:99, padding:"7px 11px",
                                  fontSize:11.5, fontWeight:850, fontFamily:fontDisp, cursor:"pointer",
                                }}
                              >
                                Ahora
                              </button>
                              <span style={{ color:T.txt3, fontSize:10.5, fontWeight:650, fontFamily:font, textAlign:"right" }}>
                                También puedes escribir la hora con teclado
                              </span>
                            </div>
                          </div>
                          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(3,1fr)" : "repeat(4,1fr)", gap:8 }}>
                            {dueTimeSlots.map(timeValue => {
                              const isSelected = selectedDueTime === timeValue;
                              return (
                                <button
                                  key={timeValue}
                                  type="button"
                                  className="mp-timebtn"
                                  onClick={() => { setActionDueTime(timeValue); setDuePickerOpen(null); }}
                                  style={{
                                    minHeight:40,
                                    borderRadius:13,
                                    border:`1px solid ${isSelected ? `${T.accent}88` : T.border}`,
                                    background:isSelected ? `linear-gradient(135deg, ${T.accent}, #0D9A76)` : isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.045)",
                                    color:isSelected ? "#041016" : T.txt,
                                    fontSize:13,
                                    fontWeight:800,
                                    fontFamily:fontDisp,
                                    cursor:"pointer",
                                  }}
                                >
                                  {timeValue}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                            <button type="button" onClick={clearActionDue} className="mp-quickchip" style={{ border:"1px solid transparent", background:"transparent", color:T.txt3, borderRadius:99, padding:"7px 11px", fontSize:11.5, fontWeight:750, fontFamily:fontDisp, cursor:"pointer" }}>Limpiar fecha y hora</button>
                            <button type="button" onClick={() => selectedDueTime && setDuePickerOpen(null)} className="mp-quickchip" style={{ border:`1px solid ${selectedDueTime ? _hex(T.accent,"60") : "transparent"}`, background:selectedDueTime ? `${T.accent}12` : "transparent", color:selectedDueTime ? T.accent : T.txt3, borderRadius:99, padding:"7px 12px", fontSize:11.5, fontWeight:850, fontFamily:fontDisp, cursor:selectedDueTime ? "pointer" : "default" }}>Listo</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {(() => { const canAdd = !!(metaNewText.trim() && metaNewDate && (!creatingForTeam || metaNewAssignee)); return (
                <button
                  onClick={createAction}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                    padding:"0 22px", borderRadius:30, border:"none",
                    background: canAdd
                      ? `linear-gradient(135deg,#0D9A76,${T.accent})`
                      : (isLight?"rgba(15,23,42,0.055)":"rgba(255,255,255,0.055)"),
                    color: canAdd ? "#041016" : T.txt3,
                    fontSize:15.5, fontWeight:800, fontFamily:fontDisp,
                    cursor: canAdd ? "pointer" : "default",
                    flexShrink:0, letterSpacing:"-0.02em",
                    boxShadow: canAdd ? `0 18px 42px ${_hex(T.accent,'32')}, inset 0 1px 0 rgba(255,255,255,0.24)` : (isLight ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "inset 0 1px 0 rgba(255,255,255,0.05)"),
                    transition:"background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s",
                    minHeight:118,
                  }}
                  onMouseDown={e => { if(canAdd) e.currentTarget.style.transform="scale(0.97)"; }}
                  onMouseUp={e => { e.currentTarget.style.transform="scale(1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; }}
                >
                  <Plus size={17} strokeWidth={2.5} />
                  Agregar
                </button>
                ); })()}
              </div>

              {/* Empty state */}
              {pendingAgendaActions.length === 0 && (
                <div style={{ textAlign:"center", padding:"56px 20px 44px" }}>
                  <div style={{ width:56, height:56, borderRadius:16, background:`${T.accent}0D`, border:`1px solid ${T.accent}1F`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                    <Check size={24} color={T.accent} strokeWidth={1.8} style={{ opacity:0.8 }} />
                  </div>
                  <p style={{ margin:"0 0 5px", fontSize:15, fontWeight:600, fontFamily:fontDisp, letterSpacing:"-0.02em", color:T.txt }}>Todo al día</p>
                  <p style={{ margin:0, fontSize:12.5, color:T.txt3, fontFamily:font }}>
                    {creatingForTeam ? "Sin pendientes del equipo — asigna la primera arriba." : "Sin pendientes en tu agenda — agrega la primera arriba."}
                  </p>
                </div>
              )}
              {pendingAgendaActions.slice().sort((a, b) => {
                const order = { personal: 0, profesional: 1 };
                const ca = normalizeAgendaCategory(a.agendaCategory || a.category || a.lead);
                const cb = normalizeAgendaCategory(b.agendaCategory || b.category || b.lead);
                return (order[ca] ?? 9) - (order[cb] ?? 9);
              }).map((a, index, arr) => {
                const isUrgent = a.priority==="urgente" || a.date?.toLowerCase().includes("hoy");
                const isHigh   = !isUrgent && (a.priority==="alto" || a.date?.toLowerCase().includes("mañana") || a.date?.toLowerCase().includes("semana"));
                const prioColor = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : T.txt2;
                const prioNext = a.priority==="normal" ? "alto" : a.priority==="alto" ? "urgente" : "normal";
                const prioDot  = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : (isLight?"#94A3B8":"#64748B");
                const prioLabel = a.priority==="urgente" ? "Urgente" : a.priority==="alto" ? "Alto" : "Normal";
                const categoryMeta = agendaCategoryMeta(a.agendaCategory || a.category || a.lead);
                const previousCategory = index > 0 ? normalizeAgendaCategory(arr[index - 1].agendaCategory || arr[index - 1].category || arr[index - 1].lead) : null;
                const showCategoryHeader = index === 0 || previousCategory !== categoryMeta.id;
                const countInCategory = arr.filter(x => normalizeAgendaCategory(x.agendaCategory || x.category || x.lead) === categoryMeta.id).length;
                const categoryChip = (
                  <span style={{
                    display:"inline-flex", alignItems:"center", gap:6,
                    padding:"4px 9px", borderRadius:99,
                    background:`${categoryMeta.accent}12`,
                    border:`1px solid ${categoryMeta.accent}28`,
                    color:categoryMeta.accent,
                    fontSize:11,
                    fontWeight:750,
                    fontFamily:fontDisp,
                    letterSpacing:"-0.01em",
                  }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:categoryMeta.accent }} />
                    {categoryMeta.label}
                  </span>
                );
                // ── Elementos compartidos (misma lógica, se acomodan distinto en PC vs iPhone) ──
                const checkBtn = (
                  <button
                    className="mp-check"
                    onClick={() => { persistDone(a, true); setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:true,status:'done'} : x)); }}
                    title="Marcar como completada"
                    style={{ width:24, height:24, borderRadius:"50%", border:`1.5px solid ${isLight?"rgba(15,23,42,0.26)":"rgba(255,255,255,0.30)"}`, background:"transparent", cursor:"pointer", flexShrink:0 }}
                  />
                );
                const titleEl = (
                  <E val={a.text} onSave={v => setMetaActions(p => p.map(x => x.id===a.id ? {...x,text:v} : x))}
                    style={{ fontSize:16.5, fontWeight:560, color:T.txt, fontFamily:font, lineHeight:1.35, letterSpacing:"-0.014em" }} />
                );
                const metaEl = (
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                    {categoryChip}
                    <E val={a.lead}   onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,lead:v}:x))}   style={{ fontSize:12.5, color:T.txt3, fontFamily:font }} />
                    <span style={{ fontSize:10, color:T.txt3, opacity:0.4 }}>·</span>
                    <E val={a.asesor} onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,asesor:v}:x))} style={{ fontSize:12.5, color:T.txt3, fontFamily:font }} />
                  </div>
                );
                const prioBtn = (
                  <button
                    onClick={() => setMetaActions(p => p.map(x => x.id===a.id?{...x,priority:prioNext}:x))}
                    title="Cambiar prioridad"
                    style={{
                      display:"inline-flex", alignItems:"center", gap:6,
                      fontSize:12, fontWeight:600, fontFamily:font,
                      color:prioColor, background:`${prioDot}12`,
                      border:`1px solid ${prioDot}2E`, borderRadius:99,
                      padding:"6px 12px 6px 10px", cursor:"pointer",
                      letterSpacing:"0.01em", transition:"background 0.15s, border 0.15s",
                    }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:prioDot, display:"inline-block", flexShrink:0 }} />
                    {prioLabel}
                  </button>
                );
                const assigneeSel = (
                  <select
                    className="mp-select"
                    value={a.assignee || ""}
                    onChange={e => {
                      const v = e.target.value;
                      setMetaActions(p => p.map(x => x.id===a.id ? {...x, assignee:v, assigneeType:"human"} : x));
                      // Persistir el responsable en la DB (resuelve asesor_id; 'Todos' → broadcast).
                      // Sin esto, el coach de Telegram no se enteraba de la asignación.
                      if (a._persisted && _online) {
                        supabase.rpc('fn_assign_team_action', { p_action_id: a.id, p_asesor_name: v })
                          .then(({ error }) => { if (error) console.warn('[Stratos] assign team_action:', error.message); });
                      }
                    }}
                    style={{
                      fontSize:12.5, fontFamily:font, fontWeight:500,
                      color: a.assignee ? T.txt2 : T.txt3,
                      background: isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.045)",
                      border:`1px solid ${a.assignee ? T.accentB : T.border}`,
                      borderRadius:10, padding:"7px 12px",
                      cursor:"pointer", outline:"none", maxWidth: isMobile ? 200 : 190,
                    }}
                  >
                    <option value="">＋ Responsable</option>
                    <option value="Todos">👥 Todos (todo el equipo)</option>
                    <optgroup label="── Equipo Humano">
                      {teamMemberOptions.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </optgroup>
                  </select>
                );
                const iagentBtn = (
                  <button
                    className="mp-ghost"
                    disabled
                    title="Próximamente — Asignación directa a iAgents IA"
                    style={{
                      display:"flex", alignItems:"center", gap:5,
                      padding:"7px 12px", borderRadius:10,
                      border:`1px solid ${T.blue}28`,
                      background:`${T.blue}07`,
                      color:T.blue, fontSize:11.5, fontFamily:font, fontWeight:600,
                      cursor:"not-allowed", opacity:0.4,
                    }}
                  >
                    <Atom size={11} />iAgent IA
                  </button>
                );
                const dateEl = (
                  <E val={a.date || "—"} onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,date:v}:x))}
                    style={{
                      display:"inline-block",
                      fontSize:12.5,
                      fontWeight:650,
                      fontFamily:fontDisp,
                      color:prioColor,
                      background:`${prioColor}14`,
                      border:`1px solid ${prioColor}28`,
                      padding:"6px 14px",
                      borderRadius:99,
                      whiteSpace:"nowrap",
                      letterSpacing:"-0.01em",
                      textAlign:"center",
                    }} />
                );
                const delBtn = (
                  <button className={isMobile ? "" : "mp-del"} onClick={() => { persistDelete(a); setMetaActions(p => p.filter(x => x.id!==a.id)); }} title="Eliminar acción" style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center", opacity: isMobile ? 0.5 : undefined }}>
                    <Trash2 size={15} color={T.txt3} />
                  </button>
                );

                return (
                  <div key={a.id}>
                    {showCategoryHeader && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:10,
                        margin:index === 0 ? "2px 0 12px" : "26px 0 12px",
                      }}>
                        <div style={{ width:9, height:9, borderRadius:"50%", background:categoryMeta.accent, boxShadow:`0 0 0 5px ${categoryMeta.accent}12` }} />
                        <h4 style={{ margin:0, fontSize:15, fontWeight:800, fontFamily:fontDisp, color:T.txt, letterSpacing:"-0.025em" }}>
                          Agenda {categoryMeta.label}
                        </h4>
                        <span style={{ fontSize:11.5, fontFamily:font, color:T.txt3 }}>
                          {countInCategory} pendiente{countInCategory !== 1 ? "s" : ""}
                        </span>
                        <div style={{ flex:1, height:1, background:T.border }} />
                      </div>
                    )}
                  <div
                    className="mp-row"
                    draggable={!isMobile}
                    onDragStart={e => { e.dataTransfer.setData("maDragId", String(a.id)); e.currentTarget.style.opacity="0.35"; }}
                    onDragEnd={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.outline="none"; }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.outline=`2px solid ${ring}`; e.currentTarget.style.outlineOffset="-1px"; }}
                    onDragLeave={e => { e.currentTarget.style.outline="none"; }}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.style.outline="none";
                      const fromId = e.dataTransfer.getData("maDragId");
                      const toId = String(a.id);
                      if (fromId === toId) return;
                      setMetaActions(p => {
                        const arr=[...p];
                        const fi=arr.findIndex(x=>String(x.id)===fromId);
                        const ti=arr.findIndex(x=>String(x.id)===toId);
                        if (fi < 0 || ti < 0) return p;
                        const [item]=arr.splice(fi,1);
                        arr.splice(ti,0,item);
                        return arr;
                      });
                    }}
                    style={{
                      position:"relative",
                      padding: isMobile ? "14px 16px" : "16px 18px",
                      borderRadius:18, marginBottom:10,
                      background: isUrgent
                        ? (isLight?"rgba(239,68,68,0.045)":"rgba(239,68,68,0.05)")
                        : (isLight?"#FFFFFF":"rgba(255,255,255,0.028)"),
                      border:`1px solid ${isUrgent ? "rgba(239,68,68,0.20)" : T.border}`,
                      boxShadow: isLight ? "0 1px 2px rgba(15,23,42,0.05)" : "none",
                    }}
                  >
                    {isMobile ? (
                      /* ── iPhone: tarjeta apilada, TODO alineado al borde izquierdo (sin
                            gutter). El check va a la derecha (trailing) para no crear el
                            "margen" lateral izquierdo. ── */
                      <>
                        {/* Fila 1 — título a ancho completo (flush-left) + check a la derecha */}
                        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                          <div style={{ flex:1, minWidth:0 }}>{titleEl}</div>
                          <div style={{ flexShrink:0, marginTop:1 }}>{checkBtn}</div>
                        </div>
                        {/* Fila 2 — contexto, flush-left */}
                        <div style={{ marginTop:8 }}>{metaEl}</div>
                        {/* Fila 3 — fecha primero, estatus a la derecha; después responsables */}
                        <div style={{ marginTop:13, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <div style={{ flex:"1 1 210px", minWidth:0 }}>{dateEl}</div>
                          <div style={{ flexShrink:0 }}>{prioBtn}</div>
                          {assigneeSel}{iagentBtn}
                          <div style={{ marginLeft:"auto" }}>{delBtn}</div>
                        </div>
                      </>
                    ) : (
                      /* ── PC: una línea. Contexto + responsable a la IZQUIERDA;
                            fecha a la izquierda del bloque de metadatos y estatus a la
                            derecha. Sin columnas fijas: evita recortes cuando la fecha
                            es larga. Borrar flota al pasar (no reserva espacio). ── */
                      <>
                        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                          {checkBtn}
                          <div style={{ flex:"1 1 360px", minWidth:0 }}>
                            <div style={{ marginBottom:7 }}>{titleEl}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                              {metaEl}
                              {assigneeSel}
                              {iagentBtn}
                            </div>
                          </div>
                          <div className="mp-actions" style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0, justifyContent:"flex-end" }}>
                            <div style={{ flexShrink:0 }}>{dateEl}</div>
                            <div style={{ flexShrink:0 }}>{prioBtn}</div>
                          </div>
                        </div>
                        {/* Eliminar — flota a la derecha, aparece al pasar (no reserva espacio) */}
                        <button className="mp-rowdel" onClick={() => { persistDelete(a); setMetaActions(p => p.filter(x => x.id!==a.id)); }} title="Eliminar acción" style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center" }}>
                          <Trash2 size={15} color={T.txt3} />
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                );
              })}

              {/* Completed tasks — collapsible */}
              {completedAgendaActions.length > 0 && (
                <div style={{ marginTop:18 }}>
                  <button
                    onClick={() => setDoneCollapsed(x => !x)}
                    style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:"8px 0", width:"100%" }}>
                    <div style={{ flex:1, height:1, background:T.border }} />
                    <span style={{ fontSize:12, fontWeight:600, color:T.txt3, fontFamily:font, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                      <Check size={12} color={T.accent} />
                      {completedAgendaActions.length} completadas
                      <span style={{ fontSize:10.5, opacity:0.6 }}>{doneCollapsed ? "▸ ver" : "▾ ocultar"}</span>
                    </span>
                    <div style={{ flex:1, height:1, background:T.border }} />
                  </button>
                  {!doneCollapsed && completedAgendaActions.map(a => (
                    <div key={a.id} style={{
                      display:"flex", alignItems:"flex-start", gap:11,
                      padding:"11px 16px", borderRadius:12, marginBottom:6,
                      background: isLight?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.025)",
                      border:`1px solid ${T.accent}14`,
                      opacity:0.65,
                    }}>
                      <button
                        onClick={() => { persistDone(a, false); setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:false,status:'pending'} : x)); }}
                        title="Marcar como pendiente"
                        style={{ width:20, height:20, borderRadius:"50%", border:`1.5px solid ${T.accent}`, background:T.accent, cursor:"pointer", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Check size={11} strokeWidth={3} color="#041016" />
                      </button>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:13.5, color:T.txt3, fontFamily:font, textDecoration:"line-through", lineHeight:1.45 }}>{a.text}</span>
                        <p style={{ margin:"3px 0 0", fontSize:11.5, color:T.txt3, fontFamily:font, opacity:0.7 }}>{a.lead} · {a.asesor}</p>
                      </div>
                      <button onClick={() => { persistDelete(a); setMetaActions(p => p.filter(x => x.id!==a.id)); }} title="Eliminar acción" style={{ background:"none", border:"none", cursor:"pointer", padding:3, opacity:0.30 }}>
                        <Minus size={13} color={T.txt3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB 2: DOCUMENTOS ═══════════════════════════════════════ */}
          {metaTab === "docs" && (
            <div style={{ width:"100%" }}>
              {/* Header */}
              <div style={{ marginBottom:22 }}>
                <h3 style={{ margin:0, fontSize:26, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.045em", color:T.txt }}>Documentos del Equipo</h3>
                <p style={{ margin:"8px 0 0", fontSize:13.5, color:T.txt3, fontFamily:font, lineHeight:1.5 }}>
                  Enlaces a Google Docs, Drive, Notion, Figma y más — siempre a la mano para todo el equipo.
                </p>
              </div>

              {/* Add bar — solo admins (RLS solo les permite escribir a ellos) */}
              {canEditFinal && (
                <div style={{ display:"flex", gap:10, marginBottom:24, alignItems:"stretch", flexWrap:"wrap" }}>
                  <input
                    className="mp-input"
                    value={docUrl}
                    onChange={e => setDocUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addDoc(); }}
                    placeholder="Pega el enlace — https://docs.google.com/…"
                    style={{
                      flex:"2 1 280px", padding:"14px 18px", borderRadius:14,
                      background: isLight?"#FFFFFF":"rgba(255,255,255,0.04)",
                      border:`1px solid ${docUrl ? T.accent : T.border}`,
                      color:T.txt, fontSize:14.5, fontFamily:font, outline:"none",
                      boxShadow: docUrl ? `0 0 0 3px ${ringSoft}` : (isLight?"0 1px 2px rgba(15,23,42,0.04)":"none"),
                    }}
                  />
                  <input
                    className="mp-input"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addDoc(); }}
                    placeholder="Nombre (opcional)"
                    style={{
                      flex:"1 1 170px", padding:"14px 18px", borderRadius:14,
                      background: isLight?"#FFFFFF":"rgba(255,255,255,0.04)",
                      border:`1px solid ${T.border}`,
                      color:T.txt, fontSize:14.5, fontFamily:font, outline:"none",
                    }}
                  />
                  {(() => { const canAdd = !!docUrl.trim(); return (
                  <button
                    onClick={addDoc}
                    style={{
                      display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      padding:"0 24px", borderRadius:14, border:"none",
                      background: canAdd
                        ? `linear-gradient(135deg,#0D9A76,${T.accent})`
                        : (isLight?"rgba(0,0,0,0.05)":"rgba(255,255,255,0.06)"),
                      color: canAdd ? "#041016" : T.txt3,
                      fontSize:13.5, fontWeight:700, fontFamily:fontDisp,
                      cursor: canAdd ? "pointer" : "default",
                      flexShrink:0, letterSpacing:"-0.02em",
                      boxShadow: canAdd ? `0 4px 16px ${_hex(T.accent,'40')}` : "none",
                      transition:"background 0.18s, color 0.18s, box-shadow 0.18s",
                      minHeight:50,
                    }}>
                    <Plus size={16} strokeWidth={2.5} />
                    Agregar
                  </button>
                  ); })()}
                </div>
              )}

              {/* Empty state */}
              {(!metaDocs || metaDocs.length === 0) && (
                <div style={{ textAlign:"center", padding:"52px 20px 40px" }}>
                  <div style={{ width:60, height:60, borderRadius:18, background:`${T.accent}0D`, border:`1px solid ${T.accent}1F`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                    <FolderOpen size={26} color={T.accent} strokeWidth={1.6} style={{ opacity:0.75 }} />
                  </div>
                  <p style={{ margin:"0 0 5px", fontSize:14.5, fontWeight:600, fontFamily:fontDisp, letterSpacing:"-0.02em", color:T.txt }}>Aún no hay documentos</p>
                  <p style={{ margin:0, fontSize:12.5, color:T.txt3, fontFamily:font, lineHeight:1.55, maxWidth:380, marginLeft:"auto", marginRight:"auto" }}>
                    {canEditFinal
                      ? "Pega arriba un enlace de Google Docs, Drive, Notion o cualquier otra herramienta para tenerlo a la mano del equipo."
                      : "Un administrador puede agregar aquí los enlaces importantes del equipo."}
                  </p>
                </div>
              )}

              {/* Document list */}
              {(metaDocs || []).map(d => {
                const prov = detectDocProvider(d.url);
                const host = docHost(d.url);
                const added = d.addedAt ? new Date(d.addedAt).toLocaleDateString("es-MX", { day:"numeric", month:"short" }) : "";
                const meta = [prov.name, host, d.addedBy, added].filter(Boolean).join(" · ");
                return (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${prov.color}50`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                    style={{
                      display:"flex", alignItems:"center", gap:13,
                      padding:"13px 16px", borderRadius:14, marginBottom:8,
                      background: isLight?"#FFFFFF":"rgba(255,255,255,0.03)",
                      border:`1px solid ${T.border}`,
                      textDecoration:"none",
                      transition:"border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div style={{ width:40, height:40, borderRadius:11, background:`${prov.color}14`, border:`1px solid ${prov.color}26`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <prov.Icon size={18} color={prov.color} strokeWidth={1.9} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:0, fontSize:14.5, fontWeight:600, fontFamily:fontDisp, letterSpacing:"-0.015em", color:T.txt, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.title}</p>
                      <p style={{ margin:"3px 0 0", fontSize:12, color:T.txt3, fontFamily:font, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{meta}</p>
                    </div>
                    <ExternalLink size={15} color={T.txt3} style={{ flexShrink:0, opacity:0.45 }} />
                    {canEditFinal && (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeDoc(d.id); }}
                        title="Eliminar documento"
                        style={{ background:"none", border:"none", cursor:"pointer", padding:4, opacity:0.35, display:"flex", flexShrink:0, transition:"opacity 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.35"; }}
                      >
                        <Trash2 size={15} color="#F87171" />
                      </button>
                    )}
                  </a>
                );
              })}

              {/* Nota para asesores (solo lectura) */}
              {!canEditFinal && (metaDocs || []).length > 0 && (
                <p style={{ margin:"14px 0 0", fontSize:11.5, color:T.txt3, fontFamily:font, textAlign:"center", opacity:0.7 }}>
                  Solo los administradores pueden agregar o quitar documentos.
                </p>
              )}
            </div>
          )}

          {/* ═══ TAB 3: PLAN ESTRATÉGICO ════════════════════════════════ */}
          {metaTab === "plan" && (
            <div>
              <div style={{ textAlign:"center", marginBottom:18 }}>
                <p style={{ margin:0, fontSize:25, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.045em", color:T.txt }}>{brandLabel.toUpperCase()}</p>
                <p style={{ margin:"4px 0 0", fontSize:11.5, color:T.txt3, fontFamily:font, letterSpacing:"0.07em", textTransform:"uppercase" }}>Plan Estratégico · Una Página · Scaling Up® · Q2 2026</p>
              </div>

              {/* CORE */}
              <div style={{ background:isLight?"#F7FBF9":"rgba(52,211,153,0.025)", border:`1px solid ${isLight?"rgba(13,154,118,0.12)":"rgba(52,211,153,0.09)"}`, borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
                {sectionHd("CORE — Por qué existimos", T.accent)}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1.1fr", gap:14 }}>
                  <div>
                    {colHd("Valores Core")}
                    {metaPlan.coreValues.map((v, i) => (
                      <div key={i} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                        <div style={{ width:4, height:4, borderRadius:"50%", background:T.accent, marginTop:6, flexShrink:0 }} />
                        <E val={v} onSave={nv => setMetaPlan(p => { const c=[...p.coreValues]; c[i]=nv; return {...p,coreValues:c}; })} style={{ fontSize:11, color:T.txt, fontFamily:font, lineHeight:1.45, flex:1 }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    {colHd("Propósito")}
                    <E val={metaPlan.purpose} onSave={v => setMetaPlan(p=>({...p,purpose:v}))} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.65, fontStyle:"italic", marginBottom:10 }} />
                    {colHd("X-Factor")}
                    <E val={metaPlan.xfactor} onSave={v => setMetaPlan(p=>({...p,xfactor:v}))} multi style={{ fontSize:11, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                  </div>
                  <div>
                    {colHd("SWT")}
                    {metaPlan.swt.map((s, i) => {
                      const col = s.type==="F"?"#34D399":s.type==="D"?"#F87171":T.blue;
                      return (
                        <div key={i} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                          <span style={{ fontSize:7.5, fontWeight:800, color:col, background:`${col}18`, borderRadius:3, padding:"1px 4px", flexShrink:0, marginTop:2 }}>{s.type}</span>
                          <E val={s.text} onSave={v => setMetaPlan(p => { const sw=[...p.swt]; sw[i]={...sw[i],text:v}; return {...p,swt:sw}; })} style={{ fontSize:10.5, color:T.txt, fontFamily:font, lineHeight:1.4, flex:1 }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ESTRATEGIA */}
              <div style={{ background:isLight?"rgba(126,184,240,0.04)":"rgba(126,184,240,0.025)", border:`1px solid ${isLight?"rgba(126,184,240,0.16)":"rgba(126,184,240,0.09)"}`, borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
                {sectionHd("ESTRATEGIA — Qué hacemos", T.blue)}
                <div style={{ display:"grid", gridTemplateColumns:"1.2fr 0.9fr 1fr", gap:14 }}>
                  <div>
                    {colHd("BHAG 2030")}
                    <E val={metaPlan.bhag} onSave={v => setMetaPlan(p=>({...p,bhag:v}))} multi style={{ fontSize:13.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.025em", color:T.txt, lineHeight:1.4, marginBottom:10 }} />
                    {colHd("Meta 3–5 Años")}
                    {metaPlan.targets3yr.map((t, i) => (
                      <div key={i} style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center" }}>
                        <TrendingUp size={9} color={T.accent} strokeWidth={2.5} style={{ flexShrink:0 }} />
                        <E val={t} onSave={v => setMetaPlan(p => { const ts=[...p.targets3yr]; ts[i]=v; return {...p,targets3yr:ts}; })} style={{ fontSize:11, color:T.txt, fontFamily:font, flex:1 }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    {colHd("Sandbox")}
                    {Object.entries(metaPlan.sandbox).map(([k, v]) => (
                      <div key={k} style={{ marginBottom:6 }}>
                        <span style={{ fontSize:8.5, fontWeight:700, color:T.txt3, fontFamily:fontDisp, letterSpacing:"0.04em", textTransform:"uppercase" }}>{k} </span>
                        <E val={v} onSave={nv => setMetaPlan(p=>({...p,sandbox:{...p.sandbox,[k]:nv}}))} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    {colHd("Brand Promise")}
                    {metaPlan.brandPromises.map((bp, i) => (
                      <div key={i} style={{ marginBottom:7, padding:"8px 10px", borderRadius:9, background:`${T.accent}07`, border:`1px solid ${T.accent}14` }}>
                        <E val={bp.title} onSave={v => setMetaPlan(p => { const b=[...p.brandPromises]; b[i]={...b[i],title:v}; return {...p,brandPromises:b}; })} style={{ fontSize:11, fontWeight:700, color:isLight?"#082818":T.accent, fontFamily:fontDisp, marginBottom:2 }} />
                        <E val={bp.sub}   onSave={v => setMetaPlan(p => { const b=[...p.brandPromises]; b[i]={...b[i],sub:v};   return {...p,brandPromises:b}; })} style={{ fontSize:10, color:T.txt2, fontFamily:font, lineHeight:1.4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* EJECUCIÓN */}
              <div style={{ background:isLight?"rgba(167,139,250,0.03)":"rgba(167,139,250,0.025)", border:`1px solid ${isLight?"rgba(167,139,250,0.14)":"rgba(167,139,250,0.09)"}`, borderRadius:14, padding:"14px 16px" }}>
                {sectionHd("EJECUCIÓN — Cómo lo hacemos", T.violet)}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr 0.85fr", gap:14 }}>
                  <div>
                    {colHd("Rocks Q2 2026")}
                    {metaPlan.rocks.map((r, i) => (
                      <div key={i} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <E val={r.n} onSave={v => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],n:v}; return {...p,rocks:rs}; })} style={{ fontSize:11, fontWeight:600, color:T.txt, fontFamily:font, lineHeight:1.35, flex:1 }} />
                          <span style={{ fontSize:10, fontWeight:700, fontFamily:fontDisp, marginLeft:6, flexShrink:0, color:r.pct>=60?"#34D399":r.pct>=40?"#F59E0B":"#F87171" }}>{r.pct}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={r.pct}
                          onChange={e => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],pct:+e.target.value}; return {...p,rocks:rs}; })}
                          style={{ width:"100%", accentColor:r.pct>=60?"#34D399":r.pct>=40?"#F59E0B":"#F87171", height:3, marginBottom:3, cursor:"pointer" }} />
                        <E val={r.owner} onSave={v => setMetaPlan(p => { const rs=[...p.rocks]; rs[i]={...rs[i],owner:v}; return {...p,rocks:rs}; })} style={{ fontSize:9, color:T.txt3, fontFamily:font }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    {colHd("Números Críticos · Live")}
                    {[
                      { label:"Pipeline Total", value:fmtM(pipe2), target:"$48M",  pct:pct2, type:"leading" },
                      { label:"Score Promedio", value:`${avgSc}`,  target:"80+",   pct:Math.round((avgSc/80)*100), type:"leading" },
                      { label:"Leads Activos",  value:`${aLeads.length}`, target:"15", pct:Math.round((aLeads.length/15)*100), type:"people" },
                      { label:"Tasa de Cierre", value:"18.4%",     target:"25%",   pct:Math.round((18.4/25)*100), type:"result" },
                    ].map((k, i) => {
                      const kCol = k.type==="leading"?T.blue:k.type==="people"?T.violet:T.accent;
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:9, marginBottom:6, background:isLight?"rgba(255,255,255,0.80)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                          <div style={{ flex:1 }}>
                            <p style={{ margin:"0 0 1px", fontSize:9, color:T.txt3, fontFamily:font }}>{k.label}</p>
                            <p style={{ margin:"0 0 5px", fontSize:15, fontWeight:700, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.025em" }}>{k.value}</p>
                            <div style={{ height:2.5, borderRadius:99, background:isLight?"rgba(0,0,0,0.07)":"rgba(255,255,255,0.07)", overflow:"hidden", width:"88%" }}>
                              <div style={{ width:`${Math.min(k.pct,100)}%`, height:"100%", background:k.pct>=80?"#34D399":k.pct>=50?"#F59E0B":"#F87171", borderRadius:99 }} />
                            </div>
                          </div>
                          <div style={{ textAlign:"right", paddingLeft:8 }}>
                            <p style={{ margin:"0 0 2px", fontSize:8, color:T.txt3 }}>Meta</p>
                            <p style={{ margin:"0 0 4px", fontSize:12, fontWeight:700, color:T.accent, fontFamily:fontDisp }}>{k.target}</p>
                            <span style={{ fontSize:7.5, fontWeight:700, padding:"2px 6px", borderRadius:99, background:`${kCol}14`, color:kCol }}>{k.type}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    {colHd("Meta Anual 2026")}
                    <div style={{ padding:"12px", borderRadius:11, background:`${T.accent}07`, border:`1px solid ${T.accent}16`, marginBottom:12 }}>
                      <p style={{ margin:"0 0 1px", fontSize:24, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.045em", color:T.txt }}>{fmtM(metaPlan.goal)}</p>
                      <p style={{ margin:"0 0 9px", fontSize:10, color:T.txt2, fontFamily:font }}>Pipeline · 12 cierres/trimestre</p>
                      <div style={{ height:5, borderRadius:99, background:isLight?"rgba(13,154,118,0.09)":"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:5 }}>
                        <div style={{ width:`${pct2}%`, height:"100%", background:"linear-gradient(90deg,#0D9A76,#34D399,#6EE7C2)", borderRadius:99 }} />
                      </div>
                      <p style={{ margin:0, fontSize:11, fontWeight:700, color:T.accent, fontFamily:fontDisp }}>{pct2}% · {fmtM(pipe2)}</p>
                    </div>
                    {colHd("Tema 2026")}
                    <div style={{ padding:"10px 11px", borderRadius:10, background:isLight?"#FFFCF0":"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.22)" }}>
                      <E val={metaPlan.anualTheme} onSave={v => setMetaPlan(p=>({...p,anualTheme:v}))} style={{ fontSize:12.5, fontWeight:700, color:"#D97706", fontFamily:fontDisp, marginBottom:4 }} />
                      <E val={metaPlan.anualThemeDesc} onSave={v => setMetaPlan(p=>({...p,anualThemeDesc:v}))} multi style={{ fontSize:10.5, color:T.txt2, fontFamily:font, lineHeight:1.55 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 4: PROTOCOLO DE VENTAS ══════════════════════════════ */}
          {metaTab === "protocolo" && (
            <div>

              {/* ── Hero Header ── */}
              <div style={{ marginBottom:14, padding:"18px 20px", borderRadius:15, background:isLight?"linear-gradient(135deg,rgba(110,231,194,0.08),rgba(126,184,240,0.06))":"linear-gradient(135deg,rgba(110,231,194,0.06),rgba(126,184,240,0.04))", border:`1px solid ${T.accent}20`, display:"flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent:"space-between", gap:16 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <div style={{ width:3, height:18, borderRadius:2, background:`linear-gradient(180deg,${T.accent},${T.blue})` }} />
                    <span style={{ fontSize:8, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase", color:T.txt3, fontFamily:fontDisp }}>Protocolo Operativo · Stratos Capital Group</span>
                  </div>
                  <p style={{ margin:"0 0 4px", fontSize:25, fontWeight:800, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.045em" }}>Protocolo {brandLabel}</p>
                  <p style={{ margin:0, fontSize:12.5, color:T.txt2, fontFamily:font }}>Sistema de ventas consultivo · Riviera Maya · Alta inversión</p>
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap: isMobile ? "wrap" : "nowrap", width: isMobile ? "100%" : "auto" }}>
                  {[
                    { label:"Etapas", value:"10", color:T.accent },
                    { label:"SLA Contacto", value:"5 min", color:T.blue },
                    { label:"Seguimiento", value:"45+", color:T.violet },
                    { label:"Tasa Meta", value:"25%", color:"#34D399" },
                  ].map((s,i) => (
                    <div key={i} style={{ textAlign:"center", padding:"9px 14px", borderRadius:11, background:isLight?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.04)", border:`1px solid ${s.color}22` }}>
                      <p style={{ margin:"0 0 1px", fontSize:18, fontWeight:800, color:s.color, fontFamily:fontDisp, letterSpacing:"-0.03em" }}>{s.value}</p>
                      <p style={{ margin:0, fontSize:8, color:T.txt3, fontFamily:font, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── A: Objetivo + Principios + Velocidad ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr 1fr", gap:10, marginBottom:10 }}>

                {/* Objetivo */}
                <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(110,231,194,0.06)":"rgba(110,231,194,0.04)", border:`1px solid ${T.accent}22` }}>
                  {sectionHd("1. Objetivo", T.accent)}
                  <E val={metaProtocol.objetivo} onSave={v=>setMetaProtocol(p=>({...p,objetivo:v}))} multi style={{ fontSize:12, fontWeight:600, color:T.txt, fontFamily:font, lineHeight:1.6, marginBottom:10 }} />
                  <div style={{ padding:"8px 10px", borderRadius:8, background:`${T.accent}08`, border:`1px solid ${T.accent}18` }}>
                    <p style={{ margin:"0 0 3px", fontSize:8.5, fontWeight:800, color:T.accent, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>Regla Base</p>
                    <E val={metaProtocol.reglaBase} onSave={v=>setMetaProtocol(p=>({...p,reglaBase:v}))} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }} />
                  </div>
                </div>

                {/* Principios */}
                <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(126,184,240,0.06)":"rgba(126,184,240,0.03)", border:`1px solid ${T.blue}22` }}>
                  {sectionHd("2. Principios del Asesor", T.blue)}
                  <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt3, fontFamily:font }}>Tu responsabilidad es:</p>
                  {metaProtocol.principios.map((pr, i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"flex-start" }}>
                      <span style={{ fontSize:9.5, fontWeight:800, color:T.blue, background:`${T.blue}14`, borderRadius:99, minWidth:19, height:19, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:fontDisp }}>{i+1}</span>
                      <E val={pr} onSave={v=>setMetaProtocol(p=>{const arr=[...p.principios];arr[i]=v;return{...p,principios:arr};})} style={{ fontSize:12, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                    </div>
                  ))}
                  <div style={{ marginTop:10, padding:"7px 10px", borderRadius:8, background:`${T.blue}09`, border:`1px solid ${T.blue}1A` }}>
                    <p style={{ margin:"0 0 2px", fontSize:8.5, fontWeight:800, color:T.blue, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>Regla Crítica</p>
                    <E val={metaProtocol.reglaRegistro} onSave={v=>setMetaProtocol(p=>({...p,reglaRegistro:v}))} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }} />
                  </div>
                </div>

                {/* Velocidad de Respuesta */}
                <div style={{ padding:"14px 15px", borderRadius:13, background:isLight?"rgba(167,139,250,0.05)":"rgba(167,139,250,0.03)", border:`1px solid ${T.violet}22` }}>
                  {sectionHd("3. Velocidad de Respuesta", T.violet)}
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    <div style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(52,211,153,0.10)", border:"1px solid rgba(52,211,153,0.22)", textAlign:"center" }}>
                      <p style={{ margin:"0 0 2px", fontSize:8.5, color:"#34D399", fontFamily:fontDisp, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Ideal</p>
                      <E val={metaProtocol.velocidadIdeal} onSave={v=>setMetaProtocol(p=>({...p,velocidadIdeal:v}))} style={{ fontSize:16, fontWeight:800, color:"#34D399", fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center" }} />
                    </div>
                    <div style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.22)", textAlign:"center" }}>
                      <p style={{ margin:"0 0 2px", fontSize:8.5, color:"#EF4444", fontFamily:fontDisp, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Máximo</p>
                      <E val={metaProtocol.velocidadMax} onSave={v=>setMetaProtocol(p=>({...p,velocidadMax:v}))} style={{ fontSize:16, fontWeight:800, color:"#EF4444", fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center" }} />
                    </div>
                  </div>
                  <p style={{ margin:"0 0 6px", fontSize:9, fontWeight:700, color:T.violet, fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>Protocolo Inmediato</p>
                  {["Mensaje por WhatsApp", "Llamada directa", "Sin respuesta → mensaje breve + siguiente intento"].map((s, i) => (
                    <div key={i} style={{ display:"flex", gap:7, marginBottom:5, alignItems:"flex-start" }}>
                      <div style={{ width:16, height:16, borderRadius:"50%", background:`${T.violet}14`, border:`1px solid ${T.violet}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                        <span style={{ fontSize:7.5, fontWeight:800, color:T.violet, fontFamily:fontDisp }}>{i+1}</span>
                      </div>
                      <span style={{ fontSize:11.5, color:T.txt2, fontFamily:font, lineHeight:1.45 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── B: Flujo de Trabajo (4 pasos) ── */}
              <div style={{ marginBottom:10 }}>
                {sectionHd("4. Flujo de Trabajo", T.violet)}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {metaProtocol.flujoSteps.map((step, si) => {
                    const stepColors = [T.accent, T.blue, T.violet, "#34D399"];
                    const c = stepColors[si];
                    return (
                      <div key={si} style={{ padding:"13px 14px", borderRadius:12, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.03)", border:`1px solid ${c}25` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:`${c}18`, border:`1.5px solid ${c}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontSize:10, fontWeight:800, color:c, fontFamily:fontDisp }}>{si+1}</span>
                          </div>
                          <E val={step.n} onSave={v=>setMetaProtocol(p=>{const f=[...p.flujoSteps];f[si]={...f[si],n:v};return{...p,flujoSteps:f};})} style={{ fontSize:12, fontWeight:700, color:T.txt, fontFamily:fontDisp }} />
                        </div>
                        <p style={{ margin:"0 0 7px", fontSize:10, color:c, fontFamily:font, fontStyle:"italic", paddingLeft:32 }}>{step.desc}</p>
                        <E val={step.action} onSave={v=>setMetaProtocol(p=>{const f=[...p.flujoSteps];f[si]={...f[si],action:v};return{...p,flujoSteps:f};})} multi style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.55, paddingLeft:32 }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── C: Pipeline 10 Etapas ── */}
              <div style={{ marginBottom:10 }}>
                {sectionHd("5. Pipeline de 10 Etapas", T.accent)}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                  {metaProtocol.pipelineStages.map((st, i) => {
                    const pct = i / 9;
                    const r = Math.round(110 + pct*50);
                    const g = Math.round(231 - pct*80);
                    const b = Math.round(194 - pct*50);
                    const c = `rgb(${r},${g},${b})`;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px 5px 7px", borderRadius:99, background:`${c}14`, border:`1px solid ${c}30` }}>
                          <span style={{ fontSize:8, fontWeight:800, color:c, fontFamily:fontDisp, minWidth:13, textAlign:"center" }}>{i+1}</span>
                          <span style={{ fontSize:10.5, fontWeight:600, color:T.txt, fontFamily:fontDisp }}>{st}</span>
                        </div>
                        {i < 9 && <ChevronRight size={10} color={T.txt3} style={{ opacity:0.35 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── D: Reglas + Seguimiento ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr 0.9fr", gap:10, marginBottom:10 }}>

                {/* Reglas Operativas */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.03)", border:"1px solid rgba(239,68,68,0.15)" }}>
                  {sectionHd("6. Reglas Operativas", "#EF4444")}
                  {metaProtocol.reglasOp.map((r, i) => (
                    <div key={i} style={{ display:"flex", gap:7, marginBottom:7, alignItems:"flex-start" }}>
                      <AlertCircle size={11} color="#EF4444" style={{ marginTop:2, flexShrink:0 }} />
                      <E val={r} onSave={v=>setMetaProtocol(p=>{const arr=[...p.reglasOp];arr[i]=v;return{...p,reglasOp:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                    </div>
                  ))}
                </div>

                {/* Seguimiento Fases */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(126,184,240,0.05)":"rgba(126,184,240,0.03)", border:`1px solid ${T.blue}20` }}>
                  {sectionHd("7. Fases de Seguimiento", T.blue)}
                  <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.5 }}>Las ventas ocurren hasta después de 30–45 intentos. <strong style={{ color:T.txt }}>No abandonar sin razón clara.</strong></p>
                  {metaProtocol.seguimientoFases.map((f, i) => {
                    const fc = i===0?"#60A5FA":i===1?"#34D399":i===2?"#A78BFA":"#F59E0B";
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"7px 9px", borderRadius:8, background:`${fc}09`, border:`1px solid ${fc}18` }}>
                        <span style={{ fontSize:9, fontWeight:800, color:fc, background:`${fc}18`, padding:"2px 7px", borderRadius:99, flexShrink:0, fontFamily:fontDisp, whiteSpace:"nowrap" }}>{f.range}</span>
                        <E val={f.desc} onSave={v=>setMetaProtocol(p=>{const arr=[...p.seguimientoFases];arr[i]={...arr[i],desc:v};return{...p,seguimientoFases:arr};})} style={{ fontSize:11.5, color:T.txt2, fontFamily:font, flex:1 }} />
                      </div>
                    );
                  })}
                </div>

                {/* Frecuencia */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(52,211,153,0.04)":"rgba(52,211,153,0.025)", border:`1px solid ${T.accent}18` }}>
                  {sectionHd("Frecuencia", T.accent)}
                  {metaProtocol.seguimientoFreq.map((f, i) => (
                    <div key={i} style={{ padding:"9px 11px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.04)", border:`1px solid ${f.color}22` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:f.color, fontFamily:fontDisp }}>{f.tipo}</span>
                        <E val={f.freq} onSave={v=>setMetaProtocol(p=>{const arr=[...p.seguimientoFreq];arr[i]={...arr[i],freq:v};return{...p,seguimientoFreq:arr};})} style={{ fontSize:10.5, fontWeight:600, color:T.txt2, fontFamily:fontDisp }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:4, padding:"8px 10px", borderRadius:8, background:`${T.accent}08`, border:`1px solid ${T.accent}16` }}>
                    <p style={{ margin:"0 0 2px", fontSize:8, fontWeight:700, color:T.accent, fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>Reglas</p>
                    <p style={{ margin:0, fontSize:10, color:T.txt3, fontFamily:font, lineHeight:1.55 }}>No repetir mensajes · Cada contacto aporta valor · Siempre cerrar con siguiente paso</p>
                  </div>
                </div>
              </div>

              {/* ── E: KPIs (4 cards) ── */}
              <div style={{ marginBottom:10 }}>
                {sectionHd("9. KPIs Clave", T.violet)}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {metaProtocol.kpis.map((k, i) => (
                    <div key={i} style={{ padding:"11px 12px", borderRadius:12, background:isLight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.04)", border:`1px solid ${k.color}25` }}>
                      <p style={{ margin:"0 0 8px", fontSize:9.5, fontWeight:800, color:k.color, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase" }}>{k.cat}</p>
                      {k.items.map((item, ii) => (
                        <div key={ii} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"flex-start" }}>
                          <div style={{ width:4, height:4, borderRadius:"50%", background:k.color, marginTop:6, flexShrink:0 }} />
                          <span style={{ fontSize:11, color:T.txt2, fontFamily:font, lineHeight:1.45 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── F: Alertas + Errores + Principio Final ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>

                {/* Alertas */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(245,158,11,0.05)":"rgba(245,158,11,0.03)", border:"1px solid rgba(245,158,11,0.20)" }}>
                  {sectionHd("10. Alertas", "#F59E0B")}
                  {metaProtocol.alertas.map((al, i) => (
                    <div key={i} style={{ display:"flex", gap:7, marginBottom:6, alignItems:"flex-start" }}>
                      <Bell size={11} color="#F59E0B" style={{ marginTop:2, flexShrink:0 }} />
                      <E val={al} onSave={v=>setMetaProtocol(p=>{const arr=[...p.alertas];arr[i]=v;return{...p,alertas:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                    </div>
                  ))}
                </div>

                {/* Errores Críticos */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(248,113,113,0.05)":"rgba(248,113,113,0.03)", border:"1px solid rgba(248,113,113,0.18)" }}>
                  {sectionHd("11. Errores Críticos", "#F87171")}
                  {metaProtocol.errores.map((er, i) => (
                    <div key={i} style={{ display:"flex", gap:7, marginBottom:6, alignItems:"flex-start" }}>
                      <X size={11} color="#F87171" style={{ marginTop:2, flexShrink:0 }} />
                      <E val={er} onSave={v=>setMetaProtocol(p=>{const arr=[...p.errores];arr[i]=v;return{...p,errores:arr};})} style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5, flex:1 }} />
                    </div>
                  ))}
                  <div style={{ marginTop:8, padding:"8px 10px", borderRadius:8, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.16)" }}>
                    <p style={{ margin:"0 0 2px", fontSize:8.5, fontWeight:800, color:"#F87171", fontFamily:fontDisp, letterSpacing:"0.07em", textTransform:"uppercase" }}>12. Cierre de Proceso</p>
                    <E val={metaProtocol.cierre} onSave={v=>setMetaProtocol(p=>({...p,cierre:v}))} multi style={{ fontSize:10, color:T.txt2, fontFamily:font, lineHeight:1.55 }} />
                  </div>
                </div>

                {/* Principio Final */}
                <div style={{ padding:"13px 14px", borderRadius:13, background:isLight?"rgba(110,231,194,0.08)":"rgba(110,231,194,0.04)", border:`1px solid ${T.accent}25`, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  {sectionHd("13. Principio Final", T.accent)}
                  <div style={{ textAlign:"center", padding:"10px 0" }}>
                    <p style={{ margin:"0 0 8px", fontSize:11, color:T.txt3, fontFamily:font, lineHeight:1.6 }}>No gana el que más leads tiene.</p>
                    <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.02em" }}>Gana el que mejor los trabaja.</p>
                    <div style={{ padding:"12px 14px", borderRadius:10, background:`${T.accent}10`, border:`1px solid ${T.accent}25` }}>
                      <E val={metaProtocol.principioFinal} onSave={v=>setMetaProtocol(p=>({...p,principioFinal:v}))} style={{ fontSize:15, fontWeight:800, color:T.accent, fontFamily:fontDisp, letterSpacing:"-0.02em", textAlign:"center", lineHeight:1.4 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── G: BANT + Objeciones ── */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                    <div style={{ width:3, height:13, borderRadius:2, background:T.blue }} />
                    <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:T.blue }}>8. Calificación BANT · Stratos AI</span>
                  </div>
                  {metaProtocol.qualification.map((q, qi) => (
                    <div key={qi} style={{ padding:"9px 12px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                        <span style={{ fontSize:8.5, fontWeight:800, color:T.blue, background:`${T.blue}14`, borderRadius:5, padding:"2px 7px", flexShrink:0 }}>{q.label}</span>
                      </div>
                      <E val={q.q} onSave={v => setMetaProtocol(p => { const qq=[...p.qualification]; qq[qi]={...qq[qi],q:v}; return {...p,qualification:qq}; })} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                    <div style={{ width:3, height:13, borderRadius:2, background:"#F87171" }} />
                    <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:"#F87171" }}>Manejo de Objeciones</span>
                  </div>
                  {metaProtocol.objections.map((o, oi) => (
                    <div key={oi} style={{ padding:"9px 12px", borderRadius:10, marginBottom:6, background:isLight?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                      <E val={o.obj} onSave={v => setMetaProtocol(p => { const ob=[...p.objections]; ob[oi]={...ob[oi],obj:v}; return {...p,objections:ob}; })} style={{ fontSize:11, fontWeight:700, color:"#F87171", fontFamily:fontDisp, marginBottom:4 }} />
                      <E val={o.resp} onSave={v => setMetaProtocol(p => { const ob=[...p.objections]; ob[oi]={...ob[oi],resp:v}; return {...p,objections:ob}; })} multi style={{ fontSize:11.5, color:T.txt, fontFamily:font, lineHeight:1.5 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── H: SLA Table ── */}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
                  <div style={{ width:3, height:13, borderRadius:2, background:T.violet }} />
                  <span style={{ fontSize:8.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.13em", textTransform:"uppercase", color:T.violet }}>SLA de Respuesta · Tiempos Críticos</span>
                </div>
                <div style={{ borderRadius:11, overflow:"hidden", border:`1px solid ${T.border}` }}>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 0.7fr 1.2fr", padding:"7px 12px", background:isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.04)", borderBottom:`1px solid ${T.border}` }}>
                    {["Evento","Respuesta","Tiempo","Responsable"].map(h => (
                      <span key={h} style={{ fontSize:8.5, fontWeight:700, color:T.txt2, fontFamily:fontDisp, letterSpacing:"0.05em", textTransform:"uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {metaProtocol.slas.map((sl, si) => (
                    <div key={si} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 0.7fr 1.2fr", padding:"8px 12px", borderBottom: si < metaProtocol.slas.length-1 ? `1px solid ${T.border}` : "none", background: si%2===0 ? "transparent" : (isLight?"rgba(0,0,0,0.015)":"rgba(255,255,255,0.015)") }}>
                      <E val={sl.trigger} onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],trigger:v}; return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                      <E val={sl.resp}    onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],resp:v};    return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt, fontFamily:font }} />
                      <E val={sl.time}    onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],time:v};    return {...p,slas:ss}; })} style={{ fontSize:11, fontWeight:700, color:T.accent, fontFamily:fontDisp }} />
                      <E val={sl.owner}   onSave={v => setMetaProtocol(p => { const ss=[...p.slas]; ss[si]={...ss[si],owner:v};   return {...p,slas:ss}; })} style={{ fontSize:11, color:T.txt2, fontFamily:font }} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          </div>{/* /.mp-fade */}
        </div>{/* /.mp-body */}
      </div>{/* /.mp */}
    </>
  );
}
