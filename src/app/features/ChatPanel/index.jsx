/**
 * app/features/ChatPanel/index.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de chat con Agente Stratos IA.
 * Extraído de App.jsx (ex líneas 1150–1605).
 * Incluye getResp avanzado que acepta datos en vivo del CRM.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef } from "react";
import {
  TrendingUp, Target, ArrowRight, Crown,
  Trophy, Gauge, Send, Timer,
  CalendarDays, FileText, Building2,
  BarChart3, Activity,
  Mic2, MicOff, X,
  Shield, Focus,
  AlertCircle, AlertTriangle,
  User, DollarSign, Zap, Phone,
  Users,
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { StratosAtom } from "../../components/Logo";
import { Ico } from "../../SharedComponents";
import { leads, stgC } from "../../data/leads";

/* ── Static response templates ───────────────────────────────────────────── */
const responses = {
  macro_erp: {
    content: "Escaneo de mercado completado. El **Modelo de Absorción** muestra un despunte comercial:",
    metrics: [
      { label: "Ritmo de Ventas", val: "Supera en 14.2% la media histórica proyectada.", i: TrendingUp, c: P.emerald },
      { label: "Demanda Premium", val: "Las unidades de mayor valor concentran el 82% de interés.", i: Target, c: P.blue },
      { label: "Acción Recomendada", val: "Redirigir inversión publicitaria al segmento de alto valor.", i: Zap, c: P.amber }
    ],
    follow: "Implementar esta estrategia acelerará las ventas. ¿Deseas que reajuste el presupuesto automáticamente?"
  },
  macro_autorizar: {
    content: "Validación de mercado completada con datos en tiempo real.",
    metrics: [
      { label: "Capacidad del Mercado", val: "La demanda actual soporta un alza de precios del 5%.", i: Activity, c: P.blue },
      { label: "Beneficio Estimado", val: "Generará $950,000 adicionales en los próximos 3 meses.", i: DollarSign, c: P.emerald },
      { label: "Riesgo de No Actuar", val: "Se perdería posicionamiento frente a la competencia.", i: Shield, c: P.rose }
    ],
    follow: "Ajuste de precios dinámicos preparado. ¿Autorizas la actualización en todos los canales de venta?"
  },
  macro_cierre: {
    content: "**Protocolo de Cierre** ejecutado exitosamente:",
    metrics: [
      { label: "Documentación Financiera", val: "Expediente generado y protegido digitalmente.", i: Shield, c: P.blue },
      { label: "Carta de Intención", val: "Borrador legal listo con beneficios fiscales incluidos.", i: FileText, c: P.emerald },
      { label: "Asistente de Cierre", val: "Preparado para resolver cualquier duda del cliente.", i: Mic2, c: P.amber }
    ],
    follow: "Documentación lista y protegida. ¿Envío el expediente al cliente por WhatsApp?"
  },
  crm_update: {
    content: "La visita y seguimiento de la **Familia Rodríguez** ha sido registrada:",
    metrics: [
      { label: "Probabilidad de Cierre", val: "Recalculada al 92% — avance positivo confirmado.", i: TrendingUp, c: P.emerald },
      { label: "Valor del Proyecto", val: "El monto total del proyecto aumentó un 45%.", i: BarChart3, c: P.blue },
      { label: "Ahorro de Tiempo", val: "Datos sincronizados automáticamente. Ahorro: 35 minutos.", i: Timer, c: P.violet }
    ],
    follow: "¿Quieres que prepare un borrador de contrato para avanzar más rápido?",
    btn: "Preparar Contrato",
    action: "Generar borrador de contrato para Rodríguez"
  },
  default: {
    content: "Recibí tu mensaje. Para generar un análisis preciso, necesito un poco más de contexto:",
    metrics: [
      { label: "Nombre del Cliente", val: "Indica el nombre del cliente a analizar (ej. 'Familia Rodríguez').", i: User, c: P.blue },
      { label: "Proyecto o Desarrollo", val: "Especifica el desarrollo a revisar (ej. 'Portofino' o 'Monarca').", i: Building2, c: P.amber }
    ],
    follow: "¿Prefieres que te muestre un resumen general del sistema?"
  },
  priority: {
    content: "Análisis de Prioridades completado. Estos son tus clientes más importantes hoy:",
    metrics: [
      { label: "Familias de Alto Valor", val: "$4.2M comprometidos — en etapa avanzada de negociación.", i: Crown, c: P.emerald },
      { label: "Inversionistas Destacados", val: "$2.8M en proceso — altísima probabilidad de retención.", i: Target, c: P.blue },
      { label: "Impacto en el Objetivo", val: "Representan el 62% de la meta de ventas del año.", i: Focus, c: P.amber }
    ],
    follow: "¿Deseas que active campañas de seguimiento automático hacia estos clientes?",
    btn: "Activar Seguimiento",
    action: "Activar seguimiento automático para clientes prioritarios"
  },
  schedule: {
    content: "Cita agendada correctamente sin conflictos de horario:",
    metrics: [
      { label: "Cita Confirmada", val: "Registrada en el calendario sin ningún cruce.", i: CalendarDays, c: P.blue },
      { label: "Oportunidad de Venta", val: "Buen momento para ofrecer incentivos por cierre rápido.", i: Target, c: P.amber },
      { label: "Tiempo Ahorrado", val: "Se automatizaron 25 minutos de gestión administrativa.", i: Activity, c: P.emerald }
    ],
    follow: "Guía de conversación preparada. ¿Quieres un recordatorio 5 minutos antes de la cita?"
  },
  teamrep: {
    content: "Reporte de rendimiento del equipo generado para este trimestre:",
    metrics: [
      { label: "Asesores con IA", val: "Están cerrando ventas un 30% más rápido que el promedio.", i: Trophy, c: P.emerald },
      { label: "Áreas de Mejora", val: "Algunos miembros necesitan más soporte en seguimiento.", i: Activity, c: P.amber },
      { label: "Oportunidad de Eficiencia", val: "Se pierden 14 horas semanales en tareas repetitivas.", i: Shield, c: P.rose }
    ],
    follow: "¿Deseas que envíe recomendaciones personalizadas a cada miembro del equipo?"
  },
  inventory: {
    content: "Análisis completo del inventario de **Portofino**:",
    metrics: [
      { label: "Velocidad de Ventas", val: "Muy superior al promedio de la zona costera.", i: TrendingUp, c: P.emerald },
      { label: "Tiempo Estimado", val: "Se estima vender todas las unidades en 4 meses.", i: Target, c: P.blue },
      { label: "Oportunidad de Precio", val: "Las condiciones permiten un aumento del 4%.", i: DollarSign, c: P.amber }
    ],
    follow: "Las condiciones son ideales. ¿Autorizas el aumento de precios ahora?",
    btn: "Autorizar Aumento",
    action: "Autorizar ajuste de precios en Portofino"
  },
  proposal: {
    content: "Propuesta comercial preparada para el cliente:",
    metrics: [
      { label: "Análisis Financiero", val: "Incluye protección fiscal y rendimientos proyectados.", i: BarChart3, c: P.blue },
      { label: "Proyección a 10 Años", val: "Crecimiento estimado del capital invertido.", i: TrendingUp, c: P.emerald },
      { label: "Velocidad de Creación", val: "Documento generado en menos de 3 segundos.", i: Zap, c: P.amber }
    ],
    follow: "El documento es confidencial. ¿Deseas enviarlo al cliente con enlace seguro?"
  }
};

/* ── getResp — genera respuesta contextual del agente ────────────────────── */
export const getResp = (t, leadData, liveLeads) => {
  const l = t.toLowerCase();
  const allLeads = liveLeads && liveLeads.length ? liveLeads : leads; // Usa datos en vivo si están disponibles

  // — CRM direct brief — usa datos en vivo si se pasan, o busca en el array —
  if (l.startsWith("__crm__") || leadData) {
    const lead = leadData || allLeads.find(le => l.includes(le.n.toLowerCase()) || l.includes(le.n.split(" ")[0].toLowerCase()));
    if (lead) {
      const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.cyan : P.violet;
      const stageColor = stgC[lead.st] || P.txt3;
      const scoreColor = lead.sc >= 80 ? P.emerald : lead.sc >= 60 ? P.blue : lead.sc >= 40 ? P.cyan : P.violet;
      const hasPhone = lead.phone && lead.phone !== "";
      const hasNotes = lead.notas && lead.notas.trim() !== "";
      return {
        content: `Expediente CRM — **${lead.n}** · Score ${lead.sc}/100`,
        metrics: [
          { label: `Etapa actual · ${lead.st}`, val: `Ingresó: ${lead.fechaIngreso || "Reciente"} · Campaña: ${lead.campana || "—"} · Asesor: ${lead.asesor || "—"}`, i: CalendarDays, c: stageColor },
          { label: "Perfil del cliente", val: lead.bio || lead.tag || "Sin perfil registrado aún.", i: User, c: P.blue },
          { label: `Presupuesto · ${lead.budget || "Por definir"}`, val: `Proyecto: ${lead.p || "Sin proyecto asignado"} · Tel: ${hasPhone ? lead.phone : "No registrado"}`, i: DollarSign, c: scoreColor },
          ...(lead.risk ? [{ label: `Riesgo + Fricción · ${lead.friction || "—"}`, val: lead.risk, i: Shield, c: frictionColor }] : []),
          { label: `Próxima acción · ${lead.nextActionDate || "Sin fecha"}`, val: lead.nextAction || "Sin próxima acción registrada.", i: Zap, c: P.accent },
          ...(hasNotes ? [{ label: "Expediente del cliente", val: lead.notas.replace(/[📍🎯💰👤📋⚠️✅]/g, "").substring(0, 180) + (lead.notas.length > 180 ? "…" : ""), i: FileText, c: P.txt2 }] : []),
        ],
        follow: lead.lastActivity
          ? `Última actividad: ${lead.lastActivity}. ¿Preparo la estrategia de cierre completa para **${lead.n}**?`
          : `Cliente recién registrado. ¿Preparo el plan de primer contacto para **${lead.n}**?`,
        btn: lead.lastActivity ? "Preparar Estrategia" : "Plan de Primer Contacto",
        action: `Dame la estrategia de cierre completa para ${lead.n} con presupuesto de ${lead.budget || "a definir"} en ${lead.p || "proyecto por asignar"}`,
      };
    }
  }

  // — Match a specific lead by name —
  const lead = allLeads.find(le => {
    const parts = le.n.toLowerCase().split(" ");
    return l.includes(le.n.toLowerCase()) || parts.some(p => p.length > 3 && l.includes(p));
  });

  if (lead) {
    const frictionIcon = lead.friction === "Bajo" ? AlertCircle : lead.friction === "Medio" ? AlertCircle : AlertTriangle;
    const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.cyan : P.violet;
    const frictionLabel = lead.friction === "Bajo" ? "Fricción baja — buen momento para avanzar" : lead.friction === "Medio" ? "Fricción media — resolver objeción primero" : "Fricción alta — reforzar confianza antes de cerrar";
    return {
      content: `Expediente de **${lead.n}** · Score ${lead.sc}/100 · ${lead.tag}`,
      metrics: [
        { label: "Perfil del cliente", val: lead.bio, i: User, c: P.blue },
        { label: `Estado · ${lead.st}`, val: frictionLabel, i: frictionIcon, c: frictionColor },
        { label: "Riesgo identificado", val: lead.risk, i: Shield, c: P.rose },
        { label: `Próxima acción · ${lead.nextActionDate}`, val: lead.nextAction, i: Zap, c: P.accent },
      ],
      follow: `Última actividad: ${lead.lastActivity}. ¿Preparamos la estrategia de cierre ahora?`,
      btn: "Preparar Estrategia",
      action: `Dame la estrategia de cierre completa para ${lead.n}`,
    };
  }

  // — Priority / today's focus —
  if (l.includes("priorit") || l.includes("hoy") || l.includes("80/20") || l.includes("importante") || l.includes("focus") || l.includes("cerrar") || l.includes("listo")) {
    const hot = [...allLeads].filter(x => x.isNew || x.sc >= 80 || x.st === "Zoom Agendado").sort((a,b) => b.sc - a.sc).slice(0, 3);
    const totalV = hot.reduce((s, x) => s + (x.presupuesto || 0), 0);
    return {
      content: "Tus **3 prioridades de hoy** — Análisis 80/20 del pipeline activo:",
      metrics: [
        { label: `1. ${hot[0]?.n} · ${hot[0]?.st}`, val: `${hot[0]?.nextAction}  ·  ${hot[0]?.nextActionDate}`, i: Crown, c: P.emerald },
        { label: `2. ${hot[1]?.n} · ${hot[1]?.st}`, val: `${hot[1]?.nextAction}  ·  ${hot[1]?.nextActionDate}`, i: Target, c: P.blue },
        { label: `3. ${hot[2]?.n} · ${hot[2]?.st}`, val: `${hot[2]?.nextAction}  ·  ${hot[2]?.nextActionDate}`, i: Zap, c: P.amber },
      ],
      follow: `Estas 3 oportunidades representan **$${(totalV/1000000).toFixed(1)}M** combinados. Atenderlos hoy puede detonar el ciclo de cierre esta semana.`,
      btn: "Activar Seguimiento",
      action: "Activar seguimiento automático para clientes prioritarios",
    };
  }

  // — New / recently registered leads —
  if (l.includes("nuevo") || l.includes("registr") || l.includes("reciente") || l.includes("ingres")) {
    const newLeads = allLeads.filter(x => x.isNew);
    return {
      content: `**${newLeads.length} clientes nuevos** registrados recientemente — requieren primer contacto:`,
      metrics: newLeads.slice(0, 3).map((x, i) => ({
        label: `${x.n} · ${x.p} · ${x.budget}`,
        val: `${x.nextAction}  ·  ${x.nextActionDate}`,
        i: [User, Phone, CalendarDays][i] || User,
        c: [P.accent, P.blue, P.violet][i] || P.accent,
      })),
      follow: `El primer contacto en menos de 24h aumenta la tasa de conversión hasta un 70%. ¿Activo seguimiento automático para estos clientes?`,
      btn: "Contactar ahora",
      action: "Activar primer contacto para clientes nuevos",
    };
  }

  // — Zoom / scheduled meetings —
  if (l.includes("zoom") || l.includes("reunión") || l.includes("videollamada")) {
    const zooms = allLeads.filter(x => x.st === "Zoom Agendado" || x.st === "Zoom Concretado");
    return {
      content: `**${zooms.length} Zooms agendados** — Prepara cada sesión con los siguientes puntos:`,
      metrics: zooms.map((x, i) => ({
        label: `${x.n} — ${x.nextActionDate}`,
        val: `${x.nextAction}. Riesgo a resolver: ${x.risk}`,
        i: [Mic2, CalendarDays, Target][i] || Mic2,
        c: [P.violet, P.blue, P.amber][i] || P.violet,
      })),
      follow: "¿Quieres que prepare un brief personalizado con los puntos clave para cada sesión?",
      btn: "Preparar briefs",
      action: "Preparar brief para zooms del día",
    };
  }

  // — Update CRM / just visited —
  if (l.includes("visitar") || l.includes("penthouse") || l.includes("actualizar") || l.includes("acabo de") || l.includes("registr")) {
    return responses.crm_update;
  }

  // — Proposal / document —
  if (l.includes("propuesta") || l.includes("genera") || l.includes("documento") || l.includes("dossier") || l.includes("contrato")) return responses.proposal;

  // — Project analysis —
  if (l.includes("portofino") || l.includes("gobernador") || l.includes("monarca")) return responses.macro_erp;

  // — Price / market authorization —
  if (l.includes("autorizar") || l.includes("validar") || l.includes("ajuste") || l.includes("precio")) return responses.macro_autorizar;

  // — Schedule / appointment —
  if (l.includes("agenda") || l.includes("llamada") || l.includes("cita") || l.includes("tarea")) return responses.schedule;

  // — Inactivity — using live data
  if (l.includes("inactividad") || l.includes("inactiv") || l.includes("sin actividad") || l.includes("olvidado")) {
    const inactive = [...allLeads].filter(x => x.daysInactive > 4 && x.st !== "Cierre" && x.st !== "Perdido").sort((a,b) => b.daysInactive - a.daysInactive).slice(0, 4);
    return {
      content: `**${inactive.length} clientes con inactividad crítica** — requieren contacto inmediato:`,
      metrics: inactive.map((x, i) => ({
        label: `${x.n} · ${x.st} · ${x.daysInactive}d inactivo`,
        val: `Acción sugerida: ${x.nextAction || "Llamar o enviar mensaje de seguimiento"}`,
        i: [AlertCircle, AlertTriangle, Timer, Phone][i] || AlertCircle,
        c: x.daysInactive >= 10 ? P.rose : x.daysInactive >= 7 ? "#FF6B6B" : P.amber,
      })),
      follow: `Reactivar estos clientes esta semana puede recuperar hasta **$${(inactive.reduce((s,x) => s+(x.presupuesto||0),0)/1000000).toFixed(1)}M** en pipeline.`,
      btn: "Reactivar todos",
      action: "Ejecutar campaña de reactivación para clientes inactivos",
    };
  }

  // — Team report — using live data
  if (l.includes("rendimiento") || l.includes("equipo") || l.includes("reporte") || l.includes("métricas")) {
    const asesoresMap = {};
    allLeads.forEach(x => {
      if (!asesoresMap[x.asesor]) asesoresMap[x.asesor] = { leads: 0, zooms: 0, cierres: 0, totalSc: 0 };
      asesoresMap[x.asesor].leads++;
      if (x.st === "Zoom Agendado" || x.st === "Zoom Concretado") asesoresMap[x.asesor].zooms++;
      if (x.st === "Cierre") asesoresMap[x.asesor].cierres++;
      asesoresMap[x.asesor].totalSc += x.sc;
    });
    const asesorList = Object.entries(asesoresMap).map(([name, d]) => ({ name, ...d, avgSc: Math.round(d.totalSc / d.leads) })).sort((a,b) => b.avgSc - a.avgSc);
    return {
      content: `**Reporte del equipo** — ${allLeads.length} clientes · ${asesorList.length} asesores activos:`,
      metrics: asesorList.slice(0, 4).map((a, i) => ({
        label: `${a.name.split(" ")[0]} · ${a.leads} leads · Score promedio ${a.avgSc}`,
        val: `Zooms: ${a.zooms} · Cierres: ${a.cierres} · Pipeline activo: ${a.leads - a.cierres}`,
        i: [Crown, Trophy, Target, Users][i] || Users,
        c: [P.emerald, P.blue, P.cyan, P.violet][i] || P.txt2,
      })),
      follow: `El equipo mantiene un score promedio de **${Math.round(allLeads.reduce((s,x)=>s+x.sc,0)/allLeads.length)}** puntos. ¿Quieres el análisis detallado por asesor?`,
      btn: "Ver análisis completo",
      action: "Análisis completo de rendimiento por asesor",
    };
  }

  // — Inventory —
  if (l.includes("inventario") || l.includes("unidades") || l.includes("quedan") || l.includes("disponible")) return responses.inventory;

  // — Pipeline / cierre macro —
  if (l.includes("pipeline") || l.includes("cierre") || l.includes("macro")) return responses.macro_cierre;

  return responses.default;
};

/* ── Chat Panel Component ────────────────────────────────────────────────── */
const examples = [
  { t: "Acabo de visitar Gobernador con la Fam. Rodríguez, les encantó el penthouse", i: Mic2, cat: "Actualizar CRM" },
  { t: "¿Cuáles son mis leads prioritarios hoy?", i: Target, cat: "Análisis 80/20" },
  { t: "Agenda llamada con James Mitchell mañana 10am", i: CalendarDays, cat: "Crear tarea" },
  { t: "Resumen de rendimiento del equipo esta semana", i: Trophy, cat: "Reporte" },
  { t: "¿Cuántas unidades quedan en Portofino?", i: Building2, cat: "Inventario" },
  { t: "Genera propuesta para Carlos Slim Jr.", i: FileText, cat: "Documento" },
];

const Chat = ({ open, onClose, msgs, setMsgs, inp, setInp }) => {
  const endRef = useRef(null);
  const [typing, setTyping] = useState(false);
  const [rec, setRec] = useState(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const send = (t) => {
    if (!t?.trim()) return;
    setMsgs(p => [...p, { role: "u", text: t.trim() }]);
    setInp(""); setTyping(true);
    setTimeout(() => {
      const r = getResp(t);
      setMsgs(p => [...p, { role: "a", ...r }]);
      setTyping(false);
    }, 1000 + Math.random() * 600);
  };

  const doVoice = () => {
    if (rec) { setRec(false); send(examples[0].t); }
    else { setRec(true); setTimeout(() => { setRec(false); send(examples[0].t); }, 2800); }
  };

  if (!open) return null;
  return (
    <div style={{
      width: 400, height: "100%", borderLeft: `1px solid ${P.border}`,
      background: "rgba(4,7,20,0.96)", backdropFilter: "blur(32px)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(110,231,194,0.06)", border: `1px solid ${P.accentB}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <StratosAtom size={18} color={P.accent} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em" }}>Agente Stratos</p>
            <p style={{ fontSize: 10, color: P.txt3, fontWeight: 400, fontFamily: font }}>Inteligencia Activa</p>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} color={P.txt3} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, paddingTop: 20 }}>
            <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: P.glass, border: `1px solid ${P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <StratosAtom size={32} color={P.accent} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>Agente Ejecutivo</p>
              <p style={{ fontSize: 12, color: P.txt3, marginTop: 6, fontFamily: font, lineHeight: 1.5 }}>Inteligencia estratégica lista. ¿Qué decisión tomamos?</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { t: "Reporte de Riesgo: Portofino", i: Shield, c: P.rose, cat: "Análisis Crítico" },
                { t: "Dossier: James Mitchell", i: User, c: P.blue, cat: "Cierre Inminente" },
                { t: "Resumen de Pipeline 80/20", i: Target, c: P.emerald, cat: "Estratégico" },
                { t: "Protocolo de Cierre: Rodríguez", i: Zap, c: P.amber, cat: "VIP Intelligence" }
              ].map((e, i) => (
                <button key={i} onClick={() => send(e.t)} style={{
                  padding: "16px 14px", borderRadius: 16, border: `1px solid ${P.border}`,
                  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(4px)",
                  cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 10,
                  transition: "all 0.3s cubic-bezier(.4,0,.2,1)", position: "relative", overflow: "hidden"
                }} onMouseEnter={ev => { ev.currentTarget.style.background = "rgba(255,255,255,0.06)"; ev.currentTarget.style.borderColor = P.accentB; }} onMouseLeave={ev => { ev.currentTarget.style.background = "rgba(255,255,255,0.03)"; ev.currentTarget.style.borderColor = P.border; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${e.c}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <e.i size={16} color={e.c} />
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: P.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{e.cat}</p>
                    <p style={{ fontSize: 11, color: P.txt, fontWeight: 600, lineHeight: 1.3 }}>{e.t}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "u" ? "flex-end" : "flex-start" }}>
            {m.role === "u" ? (
              <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "14px 14px 4px 14px", background: `${P.accent}14`, border: `1px solid ${P.accentB}`, fontSize: 12.5, color: P.txt, lineHeight: 1.5 }}>{m.text}</div>
            ) : (
              <div style={{ maxWidth: "95%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(110,231,194,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}><StratosAtom size={14} color={P.accent} /></div>
                  <span style={{ fontSize: 10, color: P.txt2, fontWeight: 600, letterSpacing: "0.04em" }}>Agente Stratos</span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "4px 14px 14px 14px", background: P.glass, border: `1px solid ${P.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                  <p style={{ fontSize: 13, color: P.txt, lineHeight: 1.6, marginBottom: m.metrics ? 12 : 0 }} dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFFFFF">$1</strong>') }} />
                  {m.metrics && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {m.metrics.map((x, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: P.rx, background: `${x.c}0D`, border: `1px solid ${x.c}22` }}>
                          <Ico icon={x.i} sz={32} is={16} c={x.c} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, color: "#FFFFFF", fontWeight: 600, fontFamily: fontDisp }}>{x.label}</p>
                            <p style={{ fontSize: 11, color: P.txt2, lineHeight: 1.4 }}>{x.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.follow && <p style={{ fontSize: 11.5, color: P.txt3, marginTop: 14, lineHeight: 1.5, fontStyle: "italic", borderTop: `1px solid ${P.border}`, paddingTop: 10 }} dangerouslySetInnerHTML={{ __html: m.follow.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#E2E8F0">$1</strong>') }} />}
                  {m.btn && (
                    <button onClick={() => m.action && send(m.action)} style={{
                      marginTop: 14, width: "100%", padding: "11px 16px", borderRadius: 10,
                      background: "rgba(255,255,255,0.93)", color: "#0A0F18", fontWeight: 700, fontSize: 12,
                      border: "none", cursor: "pointer", transition: "all 0.25s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 2px 12px rgba(255,255,255,0.1)", letterSpacing: "0.01em"
                    }} onMouseEnter={ev => { ev.currentTarget.style.background = "#FFFFFF"; ev.currentTarget.style.boxShadow = "0 4px 20px rgba(255,255,255,0.2)"; }} onMouseLeave={ev => { ev.currentTarget.style.background = "rgba(255,255,255,0.93)"; ev.currentTarget.style.boxShadow = "0 2px 12px rgba(255,255,255,0.1)"; }}>
                      {m.btn} <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StratosAtom size={16} color={P.accent} />
            <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderRadius: 12, background: P.glass }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: P.accent, animation: `blink 1.2s ease ${i * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "10px 14px", borderTop: `1px solid ${P.border}` }}>
        {rec && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "7px 12px", borderRadius: P.rx, background: `${P.rose}0C`, border: `1px solid ${P.rose}1A` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.rose, animation: "blink 0.8s infinite" }} />
            <span style={{ fontSize: 11, color: P.rose, fontWeight: 600 }}>Grabando...</span>
            <div style={{ flex: 1, display: "flex", gap: 2, justifyContent: "center" }}>
              {[...Array(14)].map((_, i) => <div key={i} style={{ width: 2, borderRadius: 1, background: P.rose, height: 3 + Math.random() * 12, opacity: 0.4, animation: `wave 0.35s ease ${i * 0.04}s infinite alternate` }} />)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 14, background: P.glass, border: `1px solid ${rec ? P.rose + "30" : P.border}` }}>
          <button onClick={doVoice} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: rec ? `${P.rose}18` : P.accentS, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {rec ? <MicOff size={15} color={P.rose} /> : <Mic2 size={15} color={P.accent} />}
          </button>
          <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send(inp)}
            placeholder="Escribe o usa voz..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: P.txt, fontSize: 13, fontFamily: font }} />
          <button onClick={() => send(inp)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: inp.trim() ? P.accentS : "transparent", display: "flex", alignItems: "center", justifyContent: "center", opacity: inp.trim() ? 1 : 0.25 }}>
            <Send size={14} color={P.accent} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
