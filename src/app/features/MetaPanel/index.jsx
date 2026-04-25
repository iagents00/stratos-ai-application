/**
 * app/features/MetaPanel/index.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de tres pestañas: Lista de Acción · Plan Estratégico · Protocolo de Ventas
 * Extraído de App.jsx (ex líneas 3204–3998).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Target, Plus, Check, Minus, GripVertical, TrendingUp, ChevronRight,
  AlertCircle, Bell, X, Atom,
} from "lucide-react";
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
  stages: [
    { id: 1, name: "Nuevo Registro", color: "#34D399", sla: "< 2h",
      actions: ["Llamada de bienvenida inmediata", "Enviar presentación de proyectos", "Calificar BANT", "Registrar notas en CRM"] },
    { id: 2, name: "Primer Contacto", color: "#60A5FA", sla: "< 24h",
      actions: ["Zoom/llamada de descubrimiento 30 min", "Identificar proyecto de interés", "Confirmar presupuesto y timeline", "Enviar dossier del proyecto"] },
    { id: 3, name: "Zoom Agendado", color: "#A78BFA", sla: "Confirmado",
      actions: ["Preparar presentación personalizada", "Enviar recordatorio 24h antes", "Tener comparativos listos", "Confirmar asistencia 2h antes"] },
    { id: 4, name: "Zoom Concretado", color: "#4ADE80", sla: "< 48h",
      actions: ["Enviar resumen y propuesta formal", "Responder dudas por escrito", "Proponer visita presencial", "Seguimiento en 24h"] },
    { id: 5, name: "Negociación", color: "#FB923C", sla: "< 24h",
      actions: ["Revisar condiciones de pago", "Conectar con notaría aliada", "Validar costos notariales", "Preparar expediente de cierre"] },
    { id: 6, name: "Cierre", color: "#F59E0B", sla: "Inmediato",
      actions: ["Enviar contrato para revisión", "Coordinar firma con notaría", "Confirmar depósito inicial", "Celebrar + solicitar referido"] },
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
    { trigger: "Nuevo lead registrado",  resp: "Primer contacto",    time: "2 horas",   owner: "Asesor asignado" },
    { trigger: "Zoom concretado",        resp: "Envío de propuesta", time: "24 horas",  owner: "Asesor asignado" },
    { trigger: "Sin actividad 5+ días",  resp: "Reactivación activa", time: "Inmediato", owner: "Director de Ventas" },
    { trigger: "Negociación activa",     resp: "Seguimiento diario", time: "24 horas",  owner: "Asesor + Director" },
  ],
  objetivo: "Convertir leads en ventas mediante un proceso claro, rápido y consistente.",
  reglaBase: "Todo lead debe avanzar, seguir en proceso o cerrarse. Si no, está perdido.",
  principios: ["Responder rápido", "Calificar correctamente", "Mover al siguiente paso", "Dar seguimiento constante", "Registrar todo"],
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
  leadsData,
  T,
  isLight,
}) {
  if (!open) return null;

  const GOAL2  = metaPlan.goal;
  const aLeads = leadsData.filter(l => l.presupuesto > 0);
  const pipe2  = aLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const pct2   = Math.min(100, Math.round((pipe2 / GOAL2) * 100));
  const avgSc  = aLeads.length ? Math.round(aLeads.reduce((s, l) => s + (l.sc || 0), 0) / aLeads.length) : 0;
  const fmtM   = n => n >= 1e6 ? `$${(n/1e6).toFixed(1).replace(/\.0$/,"")}M` : `$${(n/1e3).toFixed(0)}K`;

  /* ── Helpers ── */
  const sectionHd = (label, color) => (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
      <div style={{ width:3, height:14, borderRadius:2, background:color }} />
      <span style={{ fontSize:9.5, fontWeight:800, fontFamily:fontDisp, letterSpacing:"0.11em", textTransform:"uppercase", color }}>{label}</span>
    </div>
  );
  const colHd = txt => (
    <p style={{ margin:"0 0 8px", fontSize:10, fontWeight:700, fontFamily:fontDisp, color:T.txt2, letterSpacing:"0.05em", textTransform:"uppercase" }}>{txt}</p>
  );
  const E = ({ val, onSave, style={}, multi=false }) => (
    <span
      contentEditable suppressContentEditableWarning
      onBlur={e => { const v=e.currentTarget.textContent.trim(); if(v) onSave(v); }}
      onKeyDown={e => { if(!multi && e.key==="Enter"){ e.preventDefault(); e.currentTarget.blur(); } }}
      title="Click para editar"
      style={{
        display:"block", outline:"none",
        borderBottom:`1px dashed ${isLight?"rgba(0,0,0,0.12)":"rgba(255,255,255,0.12)"}`,
        cursor:"text", minWidth:20,
        ...style,
      }}
    >{val}</span>
  );

  const tabs = [
    { id:"acciones",  label:"Lista de Acción" },
    { id:"plan",      label:"Plan Estratégico" },
    { id:"protocolo", label:"Protocolo de Ventas" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:"fixed", inset:0, zIndex:600,
        background: isLight ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.72)",
        backdropFilter:"blur(10px)",
        animation:"fadeIn 0.22s ease both",
      }} />

      {/* Modal */}
      <div style={{
        position:"fixed", top:"50%", left:"50%",
        width:"min(1020px, 96vw)", height:"min(720px, 94vh)",
        zIndex:601,
        background: isLight ? "#FFFFFF" : "#090D18",
        borderRadius:22,
        border:`1px solid ${isLight ? "rgba(13,154,118,0.11)" : "rgba(255,255,255,0.07)"}`,
        boxShadow: isLight
          ? "0 40px 120px rgba(15,23,42,0.15), 0 8px 32px rgba(15,23,42,0.08)"
          : "0 40px 120px rgba(0,0,0,0.70), 0 8px 32px rgba(0,0,0,0.40)",
        display:"flex", flexDirection:"column",
        overflow:"hidden",
        animation:"modalIn 0.28s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ── Header ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"17px 24px 15px",
          borderBottom:`1px solid ${T.border}`,
          flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${T.accent}12`, border:`1px solid ${T.accent}24`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Target size={17} color={T.accent} strokeWidth={2} />
            </div>
            <div>
              <p style={{ margin:0, fontSize:15.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.03em", color:T.txt }}>Duke del Caribe</p>
              <p style={{ margin:"1px 0 0", fontSize:10, color:T.txt3, fontFamily:font }}>Plan Estratégico · Scaling Up · 2026</p>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display:"flex", gap:2, background:T.glass, border:`1px solid ${T.border}`, borderRadius:12, padding:3 }}>
            {tabs.map(({ id, label }) => (
              <button key={id} onClick={() => setMetaTab(id)} style={{
                padding:"7px 16px", borderRadius:9, border:"none",
                background: metaTab===id ? (isLight?"#FFFFFF":"rgba(255,255,255,0.09)") : "transparent",
                color: metaTab===id ? T.txt : T.txt2,
                fontSize:12, fontWeight: metaTab===id ? 600 : 500,
                fontFamily:font, cursor:"pointer",
                boxShadow: metaTab===id ? (isLight?"0 1px 6px rgba(15,23,42,0.08)":"0 1px 4px rgba(0,0,0,0.30)") : "none",
                transition:"all 0.15s",
              }}>{label}</button>
            ))}
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:"50%", border:`1px solid ${T.border}`,
            background:T.glass, color:T.txt3, cursor:"pointer", fontSize:18,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"22px 24px 28px" }}>

          {/* ═══ TAB 1: LISTA DE ACCIÓN ══════════════════════════════════ */}
          {metaTab === "acciones" && (
            <div>
              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:15, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.03em", color:T.txt }}>Acciones del Equipo</h3>
                  <p style={{ margin:"3px 0 0", fontSize:11, color:T.txt3, fontFamily:font }}>
                    {metaActions.filter(a=>!a.done).length} pendientes · {metaActions.filter(a=>a.done).length} completadas
                    <span style={{ marginLeft:8, opacity:0.45, fontSize:10 }}>· Arrastra para reordenar</span>
                  </p>
                </div>
              </div>

              {/* Quick-add bar */}
              <div style={{ display:"flex", gap:8, marginBottom:18, alignItems:"stretch" }}>
                <input
                  value={metaNewText}
                  onChange={e => setMetaNewText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && metaNewText.trim()) {
                      setMetaActions(p => [{ id:Date.now(), text:metaNewText.trim(), lead:"General", asesor:"Equipo", date:"Hoy", done:false, priority:"normal", assignee:"", assigneeType:"human" }, ...p]);
                      setMetaNewText("");
                    }
                  }}
                  placeholder="Nueva acción — escribe y presiona Enter…"
                  style={{
                    flex:1, padding:"10px 15px", borderRadius:10,
                    background: isLight?"#FFFFFF":"rgba(255,255,255,0.05)",
                    border:`1.5px solid ${metaNewText ? T.accent : T.border}`,
                    color:T.txt, fontSize:12.5, fontFamily:font, outline:"none",
                    boxShadow: metaNewText ? `0 0 0 3px ${T.accent}18` : "none",
                    transition:"border 0.15s, box-shadow 0.15s",
                  }}
                />
                <button
                  onClick={() => {
                    const txt = metaNewText.trim();
                    if (!txt) return;
                    setMetaActions(p => [{ id:Date.now(), text:txt, lead:"General", asesor:"Equipo", date:"Hoy", done:false, priority:"normal", assignee:"", assigneeType:"human" }, ...p]);
                    setMetaNewText("");
                  }}
                  style={{
                    display:"flex", alignItems:"center", gap:7,
                    padding:"0 20px", borderRadius:10, border:"none",
                    background: metaNewText
                      ? `linear-gradient(135deg,#0D9A76,${T.accent})`
                      : (isLight?"rgba(0,0,0,0.06)":"rgba(255,255,255,0.07)"),
                    color: metaNewText ? "#041016" : T.txt3,
                    fontSize:12.5, fontWeight:700, fontFamily:fontDisp,
                    cursor: metaNewText ? "pointer" : "default",
                    flexShrink:0, letterSpacing:"-0.02em",
                    boxShadow: metaNewText ? "0 2px 12px rgba(13,154,118,0.30)" : "none",
                    transition:"background 0.18s, color 0.18s, box-shadow 0.18s",
                    minHeight:42,
                  }}>
                  <Plus size={14} strokeWidth={2.5} />
                  Agregar
                </button>
              </div>

              {/* Pending tasks */}
              {metaActions.filter(a=>!a.done).length === 0 && (
                <div style={{ textAlign:"center", padding:"30px 0 20px", color:T.txt3, fontSize:12, fontFamily:font, opacity:0.5 }}>
                  Sin acciones pendientes · Agrega la primera arriba
                </div>
              )}
              {metaActions.filter(a=>!a.done).map(a => {
                const isUrgent = a.priority==="urgente" || a.date?.toLowerCase().includes("hoy");
                const isHigh   = !isUrgent && (a.priority==="alto" || a.date?.toLowerCase().includes("mañana") || a.date?.toLowerCase().includes("semana"));
                const prioColor = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : T.txt3;
                const prioNext = a.priority==="normal" ? "alto" : a.priority==="alto" ? "urgente" : "normal";
                const prioDot  = isUrgent ? "#EF4444" : isHigh ? "#F59E0B" : (isLight?"#94A3B8":"#475569");
                const prioLabel = a.priority==="urgente" ? "Urgente" : a.priority==="alto" ? "Alto" : "Normal";
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData("maDragId", String(a.id)); e.currentTarget.style.opacity="0.35"; }}
                    onDragEnd={e => { e.currentTarget.style.opacity="1"; e.currentTarget.style.outline="none"; }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.outline=`2px solid ${T.accent}55`; e.currentTarget.style.borderRadius="10px"; }}
                    onDragLeave={e => { e.currentTarget.style.outline="none"; }}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.style.outline="none";
                      const fromId = Number(e.dataTransfer.getData("maDragId"));
                      const toId = a.id;
                      if (fromId === toId) return;
                      setMetaActions(p => {
                        const arr=[...p];
                        const fi=arr.findIndex(x=>x.id===fromId);
                        const ti=arr.findIndex(x=>x.id===toId);
                        const [item]=arr.splice(fi,1);
                        arr.splice(ti,0,item);
                        return arr;
                      });
                    }}
                    style={{
                      display:"flex", alignItems:"flex-start", gap:8,
                      padding:"10px 12px", borderRadius:10, marginBottom:5,
                      background: isUrgent
                        ? (isLight?"rgba(239,68,68,0.03)":"rgba(239,68,68,0.04)")
                        : (isLight?"#FFFFFF":"rgba(255,255,255,0.03)"),
                      border:`1px solid ${isUrgent ? "rgba(239,68,68,0.18)" : T.border}`,
                      transition:"background 0.15s, border 0.15s",
                    }}
                  >
                    {/* Drag handle */}
                    <GripVertical size={13} color={T.txt3} style={{ cursor:"grab", flexShrink:0, marginTop:4, opacity:0.30 }} />

                    {/* Checkbox */}
                    <button
                      onClick={() => setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:true} : x))}
                      style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${T.border}`, background:"transparent", cursor:"pointer", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                    />

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <E
                        val={a.text}
                        onSave={v => setMetaActions(p => p.map(x => x.id===a.id ? {...x,text:v} : x))}
                        style={{ fontSize:12.5, fontWeight:500, color:T.txt, fontFamily:font, lineHeight:1.4, marginBottom:4 }}
                      />
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                        <E val={a.lead}   onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,lead:v}:x))}   style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                        <span style={{ fontSize:8.5, color:T.txt3, opacity:0.4 }}>·</span>
                        <E val={a.asesor} onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,asesor:v}:x))} style={{ fontSize:10.5, color:T.txt3, fontFamily:font }} />
                        {/* Priority cycle pill */}
                        <button
                          onClick={() => setMetaActions(p => p.map(x => x.id===a.id?{...x,priority:prioNext}:x))}
                          title="Click para cambiar prioridad"
                          style={{
                            display:"inline-flex", alignItems:"center", gap:4,
                            fontSize:9.5, fontWeight:600, fontFamily:font,
                            color:prioColor, background:`${prioDot}10`,
                            border:`1px solid ${prioDot}28`, borderRadius:99,
                            padding:"2px 8px 2px 6px", cursor:"pointer",
                            letterSpacing:"0.01em", transition:"all 0.15s",
                          }}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background:prioDot, display:"inline-block", flexShrink:0 }} />
                          {prioLabel}
                        </button>
                      </div>
                      {/* Assignee row */}
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <select
                          value={a.assignee || ""}
                          onChange={e => setMetaActions(p => p.map(x => x.id===a.id ? {...x, assignee:e.target.value, assigneeType:"human"} : x))}
                          style={{
                            fontSize:9.5, fontFamily:font, fontWeight:500,
                            color: a.assignee ? T.txt2 : T.txt3,
                            background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                            border:`1px solid ${a.assignee ? T.accentB : T.border}`,
                            borderRadius:6, padding:"2px 6px",
                            cursor:"pointer", outline:"none", maxWidth:140,
                          }}
                        >
                          <option value="">＋ Responsable</option>
                          <optgroup label="── Equipo Humano">
                            {["Oscar Gálvez","Alexia Santillán","Alex Velázquez","Ken Lugo","Emmanuel Ortiz","Araceli Oneto","Cecilia Mendoza","Estefanía Valdes"].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          disabled
                          title="Próximamente — Asignación directa a iAgents IA"
                          style={{
                            display:"flex", alignItems:"center", gap:3,
                            padding:"2px 7px", borderRadius:6,
                            border:`1px solid ${T.blue}28`,
                            background:`${T.blue}07`,
                            color:T.blue, fontSize:9, fontFamily:font, fontWeight:600,
                            cursor:"not-allowed", opacity:0.38,
                          }}
                        >
                          <Atom size={9} />iAgent IA
                        </button>
                      </div>
                    </div>

                    {/* Date + delete */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                      <E
                        val={a.date || "—"}
                        onSave={v => setMetaActions(p => p.map(x => x.id===a.id?{...x,date:v}:x))}
                        style={{ fontSize:10, fontWeight:600, fontFamily:fontDisp, color:prioColor, background:`${prioColor}13`, border:`1px solid ${prioColor}25`, padding:"2px 9px", borderRadius:99, whiteSpace:"nowrap", cursor:"text" }}
                      />
                      <button onClick={() => setMetaActions(p => p.filter(x => x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.25, display:"flex", alignItems:"center" }}>
                        <Minus size={11} color={T.txt3} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Completed tasks — collapsible */}
              {metaActions.filter(a=>a.done).length > 0 && (
                <div style={{ marginTop:14 }}>
                  <button
                    onClick={() => setDoneCollapsed(x => !x)}
                    style={{ display:"flex", alignItems:"center", gap:7, background:"none", border:"none", cursor:"pointer", padding:"6px 0", width:"100%" }}>
                    <div style={{ flex:1, height:1, background:T.border }} />
                    <span style={{ fontSize:10.5, fontWeight:600, color:T.txt3, fontFamily:font, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
                      <Check size={11} color={T.accent} />
                      {metaActions.filter(a=>a.done).length} completadas
                      <span style={{ fontSize:9, opacity:0.6 }}>{doneCollapsed ? "▸ ver" : "▾ ocultar"}</span>
                    </span>
                    <div style={{ flex:1, height:1, background:T.border }} />
                  </button>
                  {!doneCollapsed && metaActions.filter(a=>a.done).map(a => (
                    <div key={a.id} style={{
                      display:"flex", alignItems:"flex-start", gap:8,
                      padding:"8px 12px", borderRadius:10, marginBottom:4,
                      background: isLight?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.025)",
                      border:`1px solid ${T.accent}14`,
                      opacity:0.60,
                    }}>
                      <button
                        onClick={() => setMetaActions(p => p.map(x => x.id===a.id ? {...x,done:false} : x))}
                        style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${T.accent}`, background:T.accent, cursor:"pointer", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Check size={9} strokeWidth={3} color="#041016" />
                      </button>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:12, color:T.txt3, fontFamily:font, textDecoration:"line-through", lineHeight:1.4 }}>{a.text}</span>
                        <p style={{ margin:"2px 0 0", fontSize:10, color:T.txt3, fontFamily:font, opacity:0.7 }}>{a.lead} · {a.asesor}</p>
                      </div>
                      <button onClick={() => setMetaActions(p => p.filter(x => x.id!==a.id))} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.25 }}>
                        <Minus size={11} color={T.txt3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB 2: PLAN ESTRATÉGICO ════════════════════════════════ */}
          {metaTab === "plan" && (
            <div>
              <div style={{ textAlign:"center", marginBottom:18 }}>
                <p style={{ margin:0, fontSize:19, fontWeight:800, fontFamily:fontDisp, letterSpacing:"-0.04em", color:T.txt }}>DUKE DEL CARIBE</p>
                <p style={{ margin:"3px 0 0", fontSize:10, color:T.txt3, fontFamily:font, letterSpacing:"0.08em", textTransform:"uppercase" }}>Plan Estratégico · Una Página · Scaling Up® · Q2 2026</p>
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

          {/* ═══ TAB 3: PROTOCOLO DE VENTAS ══════════════════════════════ */}
          {metaTab === "protocolo" && (
            <div>

              {/* ── Hero Header ── */}
              <div style={{ marginBottom:14, padding:"18px 20px", borderRadius:15, background:isLight?"linear-gradient(135deg,rgba(110,231,194,0.08),rgba(126,184,240,0.06))":"linear-gradient(135deg,rgba(110,231,194,0.06),rgba(126,184,240,0.04))", border:`1px solid ${T.accent}20`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <div style={{ width:3, height:18, borderRadius:2, background:`linear-gradient(180deg,${T.accent},${T.blue})` }} />
                    <span style={{ fontSize:8, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase", color:T.txt3, fontFamily:fontDisp }}>Protocolo Operativo · Stratos Capital Group</span>
                  </div>
                  <p style={{ margin:"0 0 3px", fontSize:21, fontWeight:800, color:T.txt, fontFamily:fontDisp, letterSpacing:"-0.04em" }}>Protocolo Duke del Caribe</p>
                  <p style={{ margin:0, fontSize:11, color:T.txt2, fontFamily:font }}>Sistema de ventas consultivo · Riviera Maya · Alta inversión</p>
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
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

        </div>
      </div>
    </>
  );
}
