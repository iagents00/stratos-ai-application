import {
  TrendingUp, Target, ArrowUpRight, CheckCircle2, Mic2,
  Users, Building2, Send, Timer, Crown,
  Trophy, User, DollarSign, Zap, Phone,
  CalendarDays, FileText,
  BarChart3, Activity, Clock,
  Shield, Focus,
  AlertCircle, AlertTriangle,
} from "lucide-react";
import { P } from "../../design-system/tokens";
import { leads, stgC } from "./leads";

export const examples = [
  { t: "Acabo de visitar Gobernador con la Fam. Rodríguez, les encantó el penthouse", i: Mic2, cat: "Actualizar CRM" },
  { t: "¿Cuáles son mis leads prioritarios hoy?", i: Target, cat: "Análisis 80/20" },
  { t: "Agenda llamada con James Mitchell mañana 10am", i: CalendarDays, cat: "Crear tarea" },
  { t: "Resumen de rendimiento del equipo esta semana", i: Trophy, cat: "Reporte" },
  { t: "¿Cuántas unidades quedan en Portofino?", i: Building2, cat: "Inventario" },
  { t: "Genera propuesta para Carlos Slim Jr.", i: FileText, cat: "Documento" },
];

export const responses = {
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

export const getResp = (t) => {
  const l = t.toLowerCase();

  // — CRM direct brief (when user clicks a client row in the CRM) —
  if (l.startsWith("__crm__")) {
    const lead = leads.find(le => l.includes(le.n.toLowerCase()) || l.includes(le.n.split(" ")[0].toLowerCase()));
    if (lead) {
      const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.amber : P.rose;
      const stageColor = stgC[lead.st] || P.txt3;
      const scoreColor = lead.sc >= 80 ? P.emerald : lead.sc >= 60 ? P.blue : lead.sc >= 40 ? P.amber : P.rose;
      return {
        content: `Expediente CRM — **${lead.n}** · Score ${lead.sc}/100`,
        metrics: [
          { label: `Estatus · ${lead.st}`, val: `Ingresó ${lead.fechaIngreso} · Campaña: ${lead.campana} · Asesor: ${lead.asesor}`, i: CalendarDays, c: stageColor },
          { label: "Perfil del cliente", val: lead.bio, i: User, c: P.blue },
          { label: `Presupuesto · ${lead.budget}`, val: `Proyecto de interés: ${lead.p} · Tel: ${lead.phone}`, i: DollarSign, c: scoreColor },
          { label: "Riesgo + Fricción", val: `${lead.risk} · Fricción: ${lead.friction}`, i: Shield, c: frictionColor },
          { label: `Próxima Acción · ${lead.nextActionDate}`, val: lead.nextAction, i: Zap, c: P.accent },
        ],
        follow: `Última actividad: ${lead.lastActivity}. ¿Quieres que prepare la estrategia de cierre completa para **${lead.n}**?`,
        btn: "Preparar Estrategia",
        action: `Dame la estrategia de cierre completa para ${lead.n} con presupuesto de ${lead.budget} en ${lead.p}`,
      };
    }
  }

  // — Match a specific lead by name —
  const lead = leads.find(le => {
    const parts = le.n.toLowerCase().split(" ");
    return l.includes(le.n.toLowerCase()) || parts.some(p => p.length > 3 && l.includes(p));
  });

  if (lead) {
    const frictionIcon = lead.friction === "Bajo" ? CheckCircle2 : lead.friction === "Medio" ? AlertCircle : AlertTriangle;
    const frictionColor = lead.friction === "Bajo" ? P.emerald : lead.friction === "Medio" ? P.amber : P.rose;
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
  if (l.includes("priorit") || l.includes("hoy") || l.includes("80/20") || l.includes("importante") || l.includes("focus")) {
    const hot = leads.filter(x => x.isNew || x.sc >= 80 || x.st === "Zoom Agendado").slice(0, 3);
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
    const newLeads = leads.filter(x => x.isNew);
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
    const zooms = leads.filter(x => x.st === "Zoom Agendado");
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

  // — Team report —
  if (l.includes("rendimiento") || l.includes("equipo") || l.includes("reporte") || l.includes("métricas")) return responses.teamrep;

  // — Inventory —
  if (l.includes("inventario") || l.includes("unidades") || l.includes("quedan") || l.includes("disponible")) return responses.inventory;

  // — Pipeline / cierre macro —
  if (l.includes("pipeline") || l.includes("cierre") || l.includes("macro")) return responses.macro_cierre;

  return responses.default;
};
