/**
 * src/landing/Diagnostico.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnóstico estratégico de Stratos AI — landing pública.
 *
 * Ruta:  https://stratoscapitalgroup.com/diagnostico
 *
 * Diseño y contenido por el equipo de Stratos / NSG. Replicado fielmente
 * del prototipo en Gemini Canvas.
 *
 * Funnel:
 *   Hero → Wizard (4 preguntas) → Loader anticipación → Form contacto
 *   → Loader compilación → Blueprint (reporte ejecutivo) → CTA agenda
 *
 * Submisión:
 *   Al pulsar "Desbloquear Blueprint" se envía el payload completo al
 *   webhook n8n `STRATOS-SALES - 01 - Diagnostico Webhook` que:
 *     1. Upsert lead en Supabase (org Stratos Sales)
 *     2. Notifica Telegram con resumen
 *     3. Responde con análisis enriquecido por RAG
 *
 * Estilos: Tailwind CSS via CDN (cargado on-demand al montar). El resto
 * de la app no usa Tailwind — esta página es el primer consumidor.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from "react";
import {
  AlertTriangle, Target, ArrowRight, ArrowLeft, Check, Zap, Clock, Atom,
  PhoneCall, Database, Network, Terminal, CalendarDays,
  Cpu, TrendingUp, Lock, Workflow, Layers,
  XCircle, Bot, Smartphone, Headset,
  Building2, ChevronRight
} from "lucide-react";
import { sendDiagnosticoStratosResult } from "../lib/webhook-diagnostico-stratos";

/* ═══════════════════════════════════════════════════════════════════════════
   CAL.COM — link público al event type de asesoría Stratos.
   La URL se puede sobreescribir vía VITE_DIAGNOSTICO_CALCOM_URL si en el
   futuro el username cambia o se mueve a un dominio propio.
   ═══════════════════════════════════════════════════════════════════════════ */
const CAL_BOOKING_URL =
  import.meta.env.VITE_DIAGNOSTICO_CALCOM_URL ||
  "https://cal.com/ivan-rodriguez-m3fi2w/stratos-asesoria";

/** Build a Cal.com booking link with the lead's name/email prefilled. */
function buildCalLink(contact) {
  const params = new URLSearchParams();
  if (contact?.name) params.set("name", contact.name);
  if (contact?.email) params.set("email", contact.email);
  const qs = params.toString();
  return qs ? `${CAL_BOOKING_URL}?${qs}` : CAL_BOOKING_URL;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIAL CODES — lista corta de paises objetivo para Stratos / Gvintell.
   El usuario elige el indicativo en un <select>; el campo de telefono
   captura SOLO digitos locales. En el submit reconstruimos el E.164.
   ═══════════════════════════════════════════════════════════════════════════ */
const DIAL_CODES = [
  { code: '+52',  flag: 'MX', name: 'Mexico' },
  { code: '+57',  flag: 'CO', name: 'Colombia' },
  { code: '+1',   flag: 'US', name: 'EE.UU. / Canada' },
  { code: '+34',  flag: 'ES', name: 'Espana' },
  { code: '+54',  flag: 'AR', name: 'Argentina' },
  { code: '+51',  flag: 'PE', name: 'Peru' },
  { code: '+56',  flag: 'CL', name: 'Chile' },
  { code: '+593', flag: 'EC', name: 'Ecuador' },
  { code: '+55',  flag: 'BR', name: 'Brasil' },
  { code: '+591', flag: 'BO', name: 'Bolivia' },
  { code: '+58',  flag: 'VE', name: 'Venezuela' },
  { code: '+507', flag: 'PA', name: 'Panama' },
  { code: '+502', flag: 'GT', name: 'Guatemala' },
  { code: '+503', flag: 'SV', name: 'El Salvador' },
  { code: '+504', flag: 'HN', name: 'Honduras' },
  { code: '+505', flag: 'NI', name: 'Nicaragua' },
  { code: '+506', flag: 'CR', name: 'Costa Rica' },
  { code: '+598', flag: 'UY', name: 'Uruguay' },
  { code: '+595', flag: 'PY', name: 'Paraguay' },
  { code: '+1809', flag: 'DO', name: 'Rep. Dominicana' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION BANK — replicado exacto del Gemini Canvas del equipo
   ═══════════════════════════════════════════════════════════════════════════ */
const QUESTION_BANK = [
  {
    id: "mainPain",
    icon: AlertTriangle,
    label: "¿Dónde estás perdiendo más ventas hoy?",
    insight: "Responder rápido y dar seguimiento es lo que más mueve las ventas. Saber dónde está tu mayor pérdida nos dice por dónde conviene empezar.",
    options: [
      { value: "unqualified_leads", label: "Recibo muchos leads que no califican", desc: "Invierto en publicidad y llegan muchos contactos, pero mi equipo pierde tiempo con gente sin presupuesto o sin crédito." },
      { value: "slow_followup", label: "Respondemos tarde o sin seguimiento", desc: "Mis asesores tardan en contestar o no dan seguimiento, y perdemos clientes frente a quien responde más rápido." },
      { value: "call_overload", label: "Entran leads y no alcanzamos a atender", desc: "Llegan contactos de noche o en fin de semana y no logramos responder a tiempo, así que se enfrían." }
    ],
    dynamicPrompt: "¿Qué de esto te pasa? (marca lo que aplique)",
    quickTags: {
      unqualified_leads: ["Leads sin precalificar", "Me dejan en visto", "Agendan y no llegan", "Pago alto por cada lead (CPA)"],
      slow_followup: ["Equipo desorganizado", "Tardamos más de 1 hora en responder", "Sin seguimiento después de un tiempo", "Perdemos clientes con la competencia"],
      call_overload: ["Perdemos leads de noche", "No contactamos en menos de 5 min", "Mucha rotación de personal", "Asesores saturados"]
    }
  },
  {
    id: "role",
    icon: Building2,
    label: "¿Cómo es tu operación hoy?",
    insight: "No es lo mismo un dueño que quiere ordenar a su equipo que un asesor que necesita ganar tiempo. Esto define cómo armamos tu solución.",
    options: [
      { value: "broker_owner", label: "Dueño o broker con equipo", desc: "Quiero estandarizar el proceso para que las ventas no dependan del ánimo de cada asesor, y tener más control." },
      { value: "top_producer", label: "Asesor independiente con buen volumen", desc: "Tengo leads, pero mi tiempo es el límite. Necesito ayuda para atender WhatsApp mientras cierro." }
    ],
    dynamicPrompt: "¿Qué tipo de propiedades manejas?",
    quickTags: {
      broker_owner: ["Varios desarrollos", "Vivienda media y residencial", "Equipo de 5+ asesores", "Manejo exclusivas"],
      top_producer: ["Residencial premium (ticket alto)", "Inversionistas o fondos", "Preventas exclusivas", "Rentas corporativas"]
    }
  },
  {
    id: "maturity",
    icon: Database,
    label: "¿Dónde guardas hoy la información de tus clientes?",
    insight: "Para que la IA responda con datos reales, necesita conectarse a donde ya tienes tu inventario y tus contactos.",
    options: [
      { value: "low", label: "WhatsApp y Excel", desc: "Si un asesor se va, se lleva su cartera. Casi todo depende de la memoria del equipo y de notas sueltas." },
      { value: "medium", label: "Un CRM inmobiliario", desc: "Uso EasyBroker, Tokko o similar. El inventario está ahí, pero el seguimiento y WhatsApp siguen siendo manuales." },
      { value: "advanced", label: "Un CRM avanzado", desc: "Uso HubSpot, Salesforce o parecido. Solo me falta sumar la capa de IA para responder y dar seguimiento solo." }
    ],
    dynamicPrompt: "¿Qué herramientas usas hoy?",
    quickTags: {
      low: ["WhatsApp personal", "Google Sheets", "Libretas", "Memoria del equipo"],
      medium: ["EasyBroker", "Tokko", "Nocnok", "Wasi / AlterEstate"],
      advanced: ["HubSpot", "Salesforce", "Make / Zapier", "ActiveCampaign"]
    }
  },
  {
    id: "primaryGoal",
    icon: Target,
    label: "Si pudiéramos resolver un solo problema esta semana, ¿cuál eliges?",
    insight: "Empezamos por un punto concreto, lo dejamos funcionando bien y desde ahí escalamos al resto de tu operación.",
    options: [
      { value: "ai_whatsapp", label: "Atender WhatsApp automáticamente", desc: "Un asistente de IA que entiende audios, busca en tu inventario, filtra curiosos y agenda visitas a cualquier hora." },
      { value: "ai_callcenter", label: "Llamar a los leads al instante", desc: "Una IA que llama al lead segundos después de que deja sus datos, valida su interés y te pasa la llamada lista." },
      { value: "full_iaos", label: "Integrar todo en un solo sistema", desc: "WhatsApp, llamadas y CRM conectados, para ordenar toda la operación en un mismo lugar." }
    ],
    dynamicPrompt: "¿Qué te gustaría mejorar primero?",
    quickTags: {
      ai_whatsapp: ["Más citas agendadas", "Filtrar leads automáticamente", "Seguimiento constante", "Fichas técnicas automáticas"],
      ai_callcenter: ["Contacto en menos de 1 min", "Validar presupuesto al instante", "Pasar la llamada en vivo", "Reducir el costo por lead"],
      full_iaos: ["Escalar sin contratar más", "Recuperar leads viejos", "Centralizar la información", "Ordenar todo el proceso"]
    }
  }
];

/* ═══════════════════════════════════════════════════════════════════════════
   ESTIMADOR DE FUGA DE CAPITAL — solo matemáticas, sin humo.
   ─────────────────────────────────────────────────────────────────────────
   No inventamos un número exacto: derivamos un ESTIMADO CONSERVADOR a partir
   de lo que el lead respondió, con cada supuesto a la vista. La fuga se mide
   en COMISIÓN (lo que gana la agencia por cierre), no en precio de propiedad,
   para que el número sea creíble y no inflado.

   Fórmula:
     fuga_mensual = leadsMes × tasaCierre × %quesecae × factorMadurez × comisión
   El número fino se valida con el lead en la llamada — esto es un piso, no
   una promesa.
   ═══════════════════════════════════════════════════════════════════════════ */
const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");
const roundTo = (n, step) => Math.round(n / step) * step;

function estimateLeak(answers) {
  const pains = answers.mainPain?.values || [];
  const role = answers.role?.values || [];
  const maturity = answers.maturity?.values || [];
  const allTags = Object.values(answers).flatMap(a => a?.tags || []);
  const has = (t) => allTags.some(x => x.toLowerCase().includes(t));

  // 1) Leads nuevos al mes (estimado por perfil). Banda, no número falso-preciso.
  let leadsMes = role.includes('broker_owner') ? 120 : 50;
  if (has('5+')) leadsMes += 70;            // "Equipo de 5+ asesores"
  if (has('desarrollos')) leadsMes += 30; // varios desarrollos
  if (has('cpa')) leadsMes += 20;           // pauta pagada = más volumen

  // 2) Comisión promedio por cierre (USD que gana la agencia, no precio del inmueble).
  let comision = 2500;
  if (has('premium') || has('inversionistas') || has('fondos') ||
      has('corporativas') || has('pre-venta') || has('preventa')) comision = 6000;
  else if (has('media') || has('residencial')) comision = 3000;

  // 3) Tasa de cierre base del sector (lead → contrato). Conservador.
  const tasaCierre = 0.03;

  // 4) % de esos cierres potenciales que HOY se cae por el dolor elegido
  //    (la parte recuperable con automatización). Si hay varios, tomamos el
  //    mayor — NO sumamos, para no inflar.
  const fugaPorDolor = { slow_followup: 0.30, call_overload: 0.35, unqualified_leads: 0.20 };
  const dolorLabel = {
    slow_followup: "respuesta lenta y sin seguimiento",
    call_overload: "leads sin atender a tiempo (noches/fines de semana)",
    unqualified_leads: "horas perdidas con leads sin precalificar",
  };
  let fuga = 0.25, dolor = "fuga de leads por procesos manuales";
  pains.forEach(p => { if ((fugaPorDolor[p] || 0) >= fuga) { fuga = fugaPorDolor[p]; dolor = dolorLabel[p]; } });

  // 5) Factor de madurez: el caos pierde más; un stack avanzado pierde menos.
  let factorMadurez = 1.0;
  if (maturity.includes('low')) factorMadurez = 1.15;
  else if (maturity.includes('advanced')) factorMadurez = 0.85;

  const mid = leadsMes * tasaCierre * fuga * factorMadurez * comision;
  const low = roundTo(mid * 0.75, 500);
  const high = roundTo(mid * 1.25, 500);
  // Stratos recupera de forma realista ~55% de esa fuga (conservador).
  const recLow = roundTo(low * 0.55, 500);
  const recHigh = roundTo(high * 0.55, 500);

  return {
    low, high, recLow, recHigh,
    annualLow: low * 12, annualHigh: high * 12,
    inputs: { leadsMes, comision, tasaCierre, fuga, dolor, factorMadurez },
    assumptions: [
      `≈ ${leadsMes} leads nuevos/mes (estimado para tu perfil)`,
      `Comisión promedio por cierre: ${fmtUSD(comision)} USD`,
      `Tasa de cierre base del sector: ${Math.round(tasaCierre * 100)}% de los leads`,
      `Se cae por ${dolor}: ${Math.round(fuga * 100)}% de esos cierres potenciales`,
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING — replicado exacto del prototipo
   ═══════════════════════════════════════════════════════════════════════════ */
function generateBlueprint(answers, contactName) {
  const pains = answers.mainPain?.values || [];
  const goals = answers.primaryGoal?.values || [];
  const tools = answers.maturity?.tags || [];
  const contextText = Object.values(answers).map(a => a.context).filter(Boolean).join(" | ");

  const safeName = contactName?.trim() || 'Líder';
  const firstName = safeName.split(' ')[0];

  let score = 68;
  if (answers.maturity?.values.includes('medium') || answers.maturity?.values.includes('advanced')) score += 14;
  if (pains.includes('unqualified_leads')) score += 9;
  if (goals.includes('full_iaos')) score += 8;
  score = Math.min(score, 99);

  let profile = score >= 85 ? "Fase 3: Escala Masiva IAOS" : "Fase 2: Aceleración con IA Conversacional";
  let module = "Sistema Central de Inteligencia Comercial Stratos";
  let description = "El sistema operativo que eliminará tu carga administrativa. Tu equipo dejará de perseguir prospectos fríos y se dedicará exclusivamente a firmar contratos pre-calificados.";
  let futureStateText = "Una operación hiper-eficiente. Tu IA califica, nutre y agenda. Tú solo te presentas a estrechar la mano y cobrar la comisión.";
  let primaryMetric = { label: "Tasa de Contacto", value: "< 5 Segundos", icon: Zap };
  let strategicMission = `Implementar un motor de automatización 'Llave en Mano' que permita a ${firstName} duplicar cierres sin contratar personal extra.`;

  if (goals.includes("ai_callcenter") || pains.includes("call_overload")) {
    module = "Agente de Voz Ultra-Realista (Centro de Llamadas IA)";
    description = "Implementaremos un motor de voz sintética que contacta a tus leads en milisegundos tras entrar por tus anuncios. Evalúa presupuesto y transfiere la llamada caliente directo a tu celular.";
    futureStateText = "Cientos de llamadas simultáneas sin descansos ni rotación de personal. El prospecto siente que habla con tu mejor asesor premium.";
    primaryMetric = { label: "Capacidad Operativa", value: "24/7", icon: PhoneCall };
  } else if (goals.includes("ai_whatsapp") || pains.includes("unqualified_leads")) {
    module = "Clonador Digital de WhatsApp (IA Conversacional)";
    description = "Una IA conectada a tu inventario. Entiende audios complejos, perfila la capacidad crediticia del cliente, envía PDFs exactos y agenda la visita sola.";
    futureStateText = "Tu WhatsApp filtrando curiosos con precisión quirúrgica y tratando con guante de seda a los inversionistas listos para comprar.";
    primaryMetric = { label: "Aumento de Citas", value: "+250%", icon: CalendarDays };
  }

  if (contextText.toLowerCase().includes("premium") || contextText.toLowerCase().includes("high ticket")) {
    description += " Calibrado con técnicas de negociación de alto valor para manejar clientes exigentes con absoluta naturalidad.";
  }

  return {
    fullName: safeName,
    firstName,
    profile,
    score,
    leak: estimateLeak(answers),
    module,
    moduleDesc: description,
    strategicMission,
    futureStateText,
    metrics: [
      primaryMetric,
      { label: "Horas Liberadas / Mes", value: "+160 hrs", icon: Clock },
      { label: "Multiplicador de ROI", value: "x3.5", icon: TrendingUp }
    ],
    techStack: [
      { label: "Vapi / Retell AI para Voz Ultra-Realista (Latencia <800ms)", icon: Headset },
      { label: "Make.com (Integromat) para orquestación de flujos y CRM", icon: Workflow },
      { label: "Modelos LLM (GPT-4o / Claude 3.5) con memoria RAG", icon: Bot },
      { label: "Meta Cloud API nativa para WhatsApp Business", icon: Smartphone }
    ],
    architectureNodes: [
      { id: "1", title: "Captación Omnicanal de Leads", desc: "El sistema intercepta leads desde Meta, tu web o portales en milisegundos. Latencia cero.", icon: Network },
      { id: "2", title: "Procesador Lógico Stratos", desc: tools.length > 0 ? `Conexión directa con ${tools[0]}. Cruza lo que pide el lead con tu inventario disponible.` : "Motor de IA entrenado con tu inventario y tus guiones de cierre.", icon: Cpu },
      { id: "3", title: "Ejecución Automática", desc: "La IA envía la ficha técnica, agenda la cita y empuja el trato en tu CRM.", icon: Layers }
    ],
    timeline: [
      { day: "Día 1", title: "Diagnóstico y conexión", desc: "Conectamos tus fuentes de leads (Meta, web y portales) y mapeamos tu proceso de venta actual." },
      { day: "Día 2", title: "Carga de tu inventario", desc: "Subimos propiedades, precios y preguntas frecuentes para que la IA responda con datos reales, no genéricos." },
      { day: "Día 3", title: "Tu IA con tu voz", desc: "Configuramos el agente de WhatsApp y/o voz con el tono de tu marca y tus mejores guiones de cierre." },
      { day: "Día 4", title: "Calificación y agenda", desc: "La IA aprende a filtrar curiosos, calificar presupuesto y agendar citas directo en tu calendario." },
      { day: "Día 5", title: "Conexión con tu CRM", desc: "Cada conversación queda registrada y el trato avanza solo en tu CRM. Cero captura manual." },
      { day: "Día 6", title: "Pruebas reales", desc: "Atacamos a la IA con objeciones, audios y casos difíciles hasta que responda impecable." },
      { day: "Día 7", title: "En marcha contigo", desc: "Encendemos el sistema con leads reales y un estratega de Stratos te acompaña en el arranque." }
    ]
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const ElectricPulse = () => (
  <div className="absolute top-1/2 -translate-y-1/2 right-6 flex items-center justify-center">
    <div className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-70"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34d399] shadow-[0_0_15px_#34d399]"></span>
    </div>
  </div>
);

const AnticipationLoader = ({ text, subtext }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="relative w-32 h-32 mb-10 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-[#34d399]/20 border-t-[#34d399] animate-[spin_3s_linear_infinite] shadow-[0_0_30px_rgba(52,211,153,0.15)]"></div>
      <Network className="absolute w-12 h-12 text-[#34d399] animate-[pulse_1.5s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" strokeWidth={1.5} />
    </div>
    <h3 className="text-2xl font-light text-white mb-2 tracking-tight">{text}</h3>
    <p className="text-[#34d399] font-mono text-[11px] uppercase tracking-[0.16em] font-medium">{subtext}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE — credenciales públicas del proyecto Stratos (anon key, no es
   secreto: es la misma que ya está en src/lib/supabase.js como FALLBACK).
   Se duplica acá para mantener este componente standalone — no requiere
   importar el cliente pesado de @supabase/supabase-js en la landing.
   ═══════════════════════════════════════════════════════════════════════════ */
const SUPA_URL = "https://glulgyhkrqpykxmujodb.supabase.co";
const SUPA_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdWxneWhrcnFweWt4bXVqb2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjc0ODQsImV4cCI6MjA5Mjg0MzQ4NH0.GUPRPxZM8G50TVpvTDegzADO8n117clpTgSQpaMJAEk";

/** Si la URL es /diagnostico/view/<uuid>, devuelve el UUID; si no, null. */
function parseViewLeadId(pathname) {
  const m = pathname.match(/^\/diagnostico\/view\/([A-Za-z0-9-]{8,})\/?$/);
  return m ? m[1] : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DIAGNOSTICO COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Diagnostico() {
  const [stage, setStage] = useState('gate');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '', dialCode: '+52' });
  const [reportData, setReportData] = useState(null);

  const [activeSelections, setActiveSelections] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [contextText, setContextText] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");

  // Modo "vista compartida": cuando la URL es /diagnostico/view/<lead_id>,
  // cargamos el Blueprint exactamente como lo vio el cliente. El equipo
  // recibe este link en el Telegram que dispara n8n cuando se crea un lead
  // nuevo. Permite ver el mismo reporte sin tener que volver a llenar el form.
  const [viewMode, setViewMode] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState(null);

  // Tailwind se carga via CDN desde index.html (preload sincrono para evitar FOUC).
  // Antes lo inyectabamos en runtime aqui, pero el primer paint del hero quedaba
  // sin estilos hasta que descargaba el CDN. Movido a <head> en PR #163.

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [stage, step]);

  // Detectar si estamos en modo vista compartida y cargar el Blueprint del lead.
  // Corre una sola vez al montar el componente. Si la URL no es de vista, no
  // hace nada y el wizard normal se renderea como siempre.
  useEffect(() => {
    const leadId = parseViewLeadId(window.location.pathname);
    if (!leadId) return;

    setViewMode(true);
    setViewLoading(true);

    // Llamamos a un RPC publico de solo-lectura (SECURITY DEFINER) en vez de
    // leer la tabla `leads` directo: la tabla tiene RLS que exige org + rol y
    // la anon key del navegador no cumple eso => devolveria vacio. El RPC
    // bypassa RLS pero solo expone los campos del diagnostico, gateado por el
    // UUID del lead (no enumerable). La data vive permanente en
    // leads.diagnostico_payload; esto es solo la capa de lectura publica.
    const url = `${SUPA_URL}/rest/v1/rpc/fn_get_diagnostico_publico`;

    fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPA_ANON_KEY,
        Authorization: `Bearer ${SUPA_ANON_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ p_lead_id: leadId }),
    })
      .then(r => r.json())
      .then(data => {
        // El RPC devuelve el objeto directamente (o null si no existe).
        // PostgREST puede envolverlo en array segun version: normalizamos.
        const lead = Array.isArray(data) ? data[0] : data;
        if (!lead || !lead.diagnostico_payload) throw new Error('not_found');
        const payload = lead.diagnostico_payload || {};
        const answersRaw = payload.answers_raw || {};
        if (!Object.keys(answersRaw).length) throw new Error('no_answers');

        const blueprint = generateBlueprint(answersRaw, lead.name || 'Líder');
        setReportData(blueprint);
        setContact({
          name: lead.name || '',
          company: payload.company || '',
          email: lead.email || '',
          phone: lead.whatsapp_phone_e164 || '',
          dialCode: '+52',
        });
        setStage('report');
        setViewLoading(false);
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.warn('[Diagnostico/view] fallo carga:', err?.message || err);
        setViewError(err?.message || 'load_failed');
        setViewLoading(false);
      });
  }, []);

  /* ── VIEW MODE: loader / error ─────────────────────────────────────────── */
  if (viewMode && viewLoading) {
    return (
      <div className="min-h-screen bg-[#060A11]">
        <AnticipationLoader text="Cargando diagnóstico del cliente..." subtext="Recuperando blueprint" />
      </div>
    );
  }
  if (viewMode && viewError) {
    return (
      <div className="min-h-screen bg-[#060A11] text-white flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-medium tracking-tight mb-3">Diagnóstico no disponible</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">
            No pudimos cargar este diagnóstico. Es posible que el link esté incorrecto
            o que el cliente todavía no haya completado el formulario.
          </p>
          <a
            href="/diagnostico"
            className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#34d399] text-[#030508] text-[12px] font-bold uppercase tracking-[0.12em] rounded-full hover:bg-[#2dd4bf] transition-all"
          >
            Iniciar un diagnóstico nuevo <ArrowRight size={14} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    );
  }

  const handleOptionToggle = (val) => {
    setActiveSelections(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // Carga en el estado activo lo ya respondido de un paso. Permite ir y volver
  // entre preguntas sin perder la selección y poder corregir un error.
  const loadStepIntoState = (idx, source) => {
    const saved = (source || answers)[QUESTION_BANK[idx]?.id];
    setActiveSelections(saved?.values || []);
    setSelectedTags(saved?.tags || []);
    setContextText(saved?.context || "");
  };

  const goBack = () => {
    if (step === 0) { setStage('gate'); return; }
    const prev = step - 1;
    loadStepIntoState(prev);
    setStep(prev);
  };

  const submitWizardStep = () => {
    if (activeSelections.length === 0) return;
    const nextAnswers = {
      ...answers,
      [QUESTION_BANK[step].id]: { values: activeSelections, tags: selectedTags, context: contextText }
    };
    setAnswers(nextAnswers);

    if (step < QUESTION_BANK.length - 1) {
      const next = step + 1;
      loadStepIntoState(next, nextAnswers);
      setStep(next);
    } else {
      setActiveSelections([]); setSelectedTags([]); setContextText("");
      setStage('pre-form');
      let ticks = 0;
      const msgs = ["Analizando tus respuestas...", "Identificando fugas de capital...", "Diseñando tu sistema de inteligencia comercial...", "Plano Listo."];
      const int = setInterval(() => {
        setLoadingMsg(msgs[ticks]);
        ticks++;
        if (ticks === msgs.length) { clearInterval(int); setTimeout(() => setStage('form'), 600); }
      }, 900);
    }
  };

  const unlockReport = async (e) => {
    e.preventDefault();
    setStage('loading');
    let ticks = 0;
    const msgs = ["Autorizando acceso...", "Conectando la inteligencia...", "Proyectando tu ROI...", "Desplegando tu Panel."];
    const int = setInterval(() => {
      setLoadingMsg(msgs[ticks]);
      ticks++;
      if (ticks === msgs.length) { clearInterval(int); }
    }, 1100);

    // Generar el blueprint local (mismo cálculo que en el prototipo)
    const blueprint = generateBlueprint(answers, contact.name);

    // Disparar el webhook a n8n (no bloquea la experiencia visual del lead).
    // Reconstruimos el telefono en formato E.164 combinando dialCode + digitos
    // locales. Sin esto el backend no puede llamar al lead (Twilio exige +<pais>).
    const digitsLocal = String(contact.phone || '').replace(/\D/g, '').replace(/^0+/, '');
    const fullContact = { ...contact, phone: `${contact.dialCode}${digitsLocal}` };
    sendDiagnosticoStratosResult({ contact: fullContact, answers, blueprint })
      .catch((err) => console.warn('[Diagnostico] Webhook error (no bloqueante):', err));

    // Mostrar el report tras la animación
    setTimeout(() => {
      setReportData(blueprint);
      setStage('report');
    }, 4600);
  };

  /* ── STAGE: GATE (hero) ───────────────────────────────────────────────── */
  if (stage === 'gate') {
    return (
      <div className="min-h-screen bg-[#060A11] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans antialiased selection:bg-[#34d399]/30">
        <style>{`
          @keyframes stratosAuroraA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(9%,7%) scale(1.22)}}
          @keyframes stratosAuroraB{0%,100%{transform:translate(0,0) scale(1.15)}50%{transform:translate(-8%,-6%) scale(1)}}
          @keyframes stratosGlow{0%,100%{opacity:.28}50%{opacity:.62}}
          @keyframes stratosRise{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
          @keyframes stratosNeon{0%,100%{text-shadow:0 0 2px rgba(52,211,153,.85),0 0 7px rgba(52,211,153,.5),0 0 18px rgba(52,211,153,.32),0 0 36px rgba(52,211,153,.16)}50%{text-shadow:0 0 2px rgba(52,211,153,1),0 0 11px rgba(52,211,153,.7),0 0 26px rgba(52,211,153,.48),0 0 52px rgba(52,211,153,.26)}}
        `}</style>

        {/* Aurora en movimiento — deriva lenta y elegante en el fondo */}
        <div className="absolute top-[-20%] left-[-12%] w-[55vw] h-[55vw] bg-[#34d399]/10 blur-[130px] rounded-full animate-[stratosAuroraA_16s_ease-in-out_infinite] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-12%] w-[48vw] h-[48vw] bg-[#22d3ee]/10 blur-[120px] rounded-full animate-[stratosAuroraB_20s_ease-in-out_infinite] pointer-events-none"></div>
        {/* Glow que respira detrás del titular */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[900px] h-[420px] bg-[#34d399]/10 blur-[140px] rounded-full animate-[stratosGlow_7s_ease-in-out_infinite] pointer-events-none"></div>
        {/* Grid sutil */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none"></div>
        <div className="z-10 max-w-5xl text-center flex flex-col items-center animate-[stratosRise_0.9s_ease-out_both]">
          <div className="mb-10 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md inline-flex items-center gap-2">
            <Atom className="w-3.5 h-3.5 text-[#34d399]" strokeWidth={1.75} />
            <span className="text-[11px] md:text-xs font-bold tracking-[0.16em] uppercase text-slate-300">
              Auditoría Ejecutiva Stratos
            </span>
          </div>

          <h1 className="text-[2.5rem] sm:text-5xl md:text-[5.5rem] lg:text-[6.5rem] font-medium tracking-tight leading-[1.05] md:leading-[1.02] text-white mb-8 md:mb-10 w-full px-1 sm:px-2 [text-shadow:0_0_60px_rgba(255,255,255,0.07)]">
            El <span className="text-white animate-[stratosNeon_3.5s_ease-in-out_infinite]">60% de tus comisiones</span><br className="hidden md:block"/> muere en el seguimiento.
          </h1>

          <p className="text-lg md:text-[1.35rem] text-slate-300 font-light max-w-3xl mx-auto leading-relaxed mb-12 md:mb-16 tracking-wide">
            Mapeamos tu operación y diseñamos tu sistema de inteligencia comercial con IA para automatizar tus citas. Todo en menos de 90 segundos.
          </p>

          <button
            onClick={() => setStage('wizard')}
            className="relative inline-flex items-center justify-center gap-4 px-10 py-5 md:px-12 md:py-6 bg-white text-black rounded-full text-[14px] md:text-[15px] font-bold uppercase tracking-[0.1em] transition-all duration-300 hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.12)] hover:shadow-[0_0_60px_rgba(52,211,153,0.25)] group mx-auto"
          >
            Iniciar Diagnóstico
            <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-emerald-700 group-hover:translate-x-1 transition-transform" strokeWidth={2.5}/>
          </button>
        </div>
      </div>
    );
  }

  /* ── STAGE: WIZARD ────────────────────────────────────────────────────── */
  if (stage === 'wizard') {
    const q = QUESTION_BANK[step];
    const CurrentIcon = q.icon;
    const progress = ((step + 1) / QUESTION_BANK.length) * 100;

    return (
      <div className="min-h-screen bg-[#060A11] text-white p-4 md:p-8 relative selection:bg-[#34d399]/30 pb-44 md:pb-32 overflow-x-hidden font-sans antialiased flex flex-col items-center">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none fixed"></div>
        <div className="absolute top-0 w-full h-[500px] bg-[#34d399]/5 blur-[150px] rounded-full pointer-events-none fixed -translate-y-1/2"></div>

        <div className="w-full max-w-3xl relative z-10 pt-4 md:pt-10 flex-1">
          <div className="mb-12 md:mb-16">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-200 transition-colors mb-5 -ml-1 focus:outline-none focus-visible:text-slate-200"
            >
              <ArrowLeft size={14} strokeWidth={2.5} /> Volver
            </button>
            <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-4">
              <span>Auditoría Estructural</span>
              <span className="text-[#34d399]">Pregunta {step + 1} de {QUESTION_BANK.length}</span>
            </div>
            <div className="h-[3px] w-full bg-white/5 overflow-hidden rounded-full">
              <div className="h-full bg-[#34d399] rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_#34d399]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div key={step}>
            <div className="mb-10 md:mb-14">
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.1] mb-6 flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                <CurrentIcon className="w-8 h-8 md:w-10 md:h-10 text-[#34d399] shrink-0 mt-1 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" strokeWidth={1.5} />
                <span>{q.label}</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl font-light pl-0 md:pl-16 leading-relaxed">{q.insight}</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#34d399]/90 font-bold pl-0 md:pl-16 mt-5 flex items-center gap-2">
                <Check size={13} strokeWidth={3} className="shrink-0" /> Puedes elegir más de una opción
              </p>
            </div>

            <div className="grid gap-4 md:gap-5 pl-0 md:pl-16">
              {q.options.map(opt => {
                const isActive = activeSelections.includes(opt.value);
                const tags = q.quickTags[opt.value] || [];
                return (
                  <div key={opt.value} className={`transition-all duration-300 ${activeSelections.length > 0 && !isActive ? 'opacity-30 scale-[0.99]' : ''}`}>
                    <button
                      type="button"
                      onClick={() => handleOptionToggle(opt.value)}
                      aria-pressed={isActive}
                      className={`w-full text-left p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-[2rem] border transition-all duration-300 relative overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/50 ${isActive ? 'bg-[#34d399]/[0.03] border-[#34d399]/50 shadow-[0_0_30px_rgba(52,211,153,0.15)]' : 'bg-white/[0.01] border-white/10 hover:border-white/20 hover:bg-white/[0.03]'}`}
                    >
                      {isActive && <ElectricPulse />}
                      <div className="relative z-10 pr-8">
                        <h3 className={`text-xl md:text-2xl font-medium mb-3 tracking-tight transition-colors ${isActive ? 'text-[#34d399]' : 'text-white'}`}>{opt.label}</h3>
                        <p className="text-slate-400 font-light leading-relaxed text-sm md:text-base">{opt.desc}</p>
                      </div>
                    </button>

                    {isActive && tags.length > 0 && (
                      <div className="mt-5 ml-1 md:ml-8 border-l-2 border-[#34d399]/30 pl-4 md:pl-6 pb-2">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[#34d399] font-bold mb-4 flex items-center gap-2"><ChevronRight size={14} className="shrink-0"/> {q.dynamicPrompt}</p>
                        <div className="flex flex-wrap gap-2.5">
                          {tags.map(tag => {
                            const isTagSelected = selectedTags.includes(tag);
                            return (
                              <button type="button" key={tag} onClick={() => handleTagToggle(tag)} aria-pressed={isTagSelected} className={`px-4 sm:px-5 py-2.5 rounded-full text-[14px] font-medium transition-all inline-flex items-center gap-2 border max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399]/40 ${isTagSelected ? 'bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399] shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'bg-[#060A11] border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                                {isTagSelected && <Check size={14} strokeWidth={3} className="shrink-0"/>} {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {activeSelections.length > 0 && (
          <div className="fixed bottom-0 left-0 w-full bg-[#060A11]/90 backdrop-blur-2xl border-t border-white/10 px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:px-6 md:pt-6 md:pb-6 z-50">
            <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-4 items-center md:pl-16">
              <div className="relative w-full flex-1">
                <Terminal className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={contextText} onChange={e => setContextText(e.target.value)} placeholder="Agrega algún detalle (opcional)…" className="w-full bg-[#030508] border border-white/10 rounded-full pl-12 pr-6 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/40 font-light placeholder:text-slate-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors" />
              </div>
              <button type="button" onClick={submitWizardStep} className="w-full md:w-auto px-10 py-4 bg-white text-black text-xs md:text-sm font-bold uppercase tracking-[0.12em] rounded-full hover:bg-slate-200 flex items-center justify-center gap-3 transition-all active:scale-95 shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                {step === QUESTION_BANK.length - 1 ? 'Generar mi Plano' : 'Siguiente'} <ArrowRight size={16} strokeWidth={2.5}/>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'pre-form') return <div className="min-h-screen bg-[#060A11]"><AnticipationLoader text="Procesando tus datos..." subtext={loadingMsg} /></div>;
  if (stage === 'loading') return <div className="min-h-screen bg-[#060A11]"><AnticipationLoader text="Compilando tu Plano..." subtext={loadingMsg} /></div>;

  /* ── STAGE: FORM (squeeze) ─────────────────────────────────────────────── */
  if (stage === 'form') {
    return (
      <div className="min-h-screen bg-[#060A11] text-white flex items-center justify-center p-6 relative font-sans antialiased">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.05)_0%,transparent_60%)] pointer-events-none"></div>
        <div className="z-10 max-w-xl w-full">
          <div className="bg-[#030508] border border-white/10 rounded-[2rem] p-6 sm:p-10 md:p-14 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#34d399] to-transparent opacity-50"></div>

            <div className="mb-12 text-center">
              <div className="w-16 h-16 bg-[#34d399]/10 border border-[#34d399]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
                <Lock className="w-7 h-7 text-[#34d399]" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-medium tracking-tight text-white mb-2">Arquitectura Calculada</h2>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#34d399] font-bold">Plano estratégico valorado en $1,500 USD</p>
            </div>

            <p className="text-slate-400 text-[15px] font-light mb-10 text-center px-4 leading-relaxed">
              El sistema ya diseñó tu solución exacta. Déjanos tus datos para generar y ver tu plan completo.
            </p>

            <form onSubmit={unlockReport} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-bold ml-1 block mb-2">Tu Nombre</label>
                  <input required value={contact.name} onChange={e => setContact({...contact, name: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="Ej. Juan Pérez" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-bold ml-1 block mb-2">Agencia / Empresa</label>
                  <input required value={contact.company} onChange={e => setContact({...contact, company: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="Ej. Inmobiliaria del Valle" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-bold ml-1 block mb-2">Correo Profesional</label>
                  <input required type="email" value={contact.email} onChange={e => setContact({...contact, email: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="tucorreo@empresa.com" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-bold ml-1 block mb-2">WhatsApp Directo</label>
                  <div className="flex gap-2">
                    <select
                      value={contact.dialCode}
                      onChange={e => setContact({...contact, dialCode: e.target.value})}
                      aria-label="Indicativo pais"
                      className="bg-[#060A11] border border-white/10 rounded-xl px-3 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] font-mono w-[116px] shrink-0 cursor-pointer"
                    >
                      {DIAL_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-[#060A11] text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={contact.phone}
                      onChange={e => setContact({...contact, phone: e.target.value.replace(/\D/g, '')})}
                      className="flex-1 min-w-0 bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]"
                      placeholder="55 1234 5678"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full mt-6 bg-[#34d399] text-[#030508] text-[14px] font-bold uppercase tracking-[0.12em] py-5 rounded-xl transition-all flex items-center justify-center gap-3 hover:bg-[#2dd4bf] active:scale-95 shadow-[0_0_30px_rgba(52,211,153,0.3)] group">
                 Desbloquear mi Plano
                 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ── STAGE: REPORT (blueprint dashboard) ──────────────────────────────── */
  if (stage === 'report' && reportData) {
    return (
      <div className="min-h-screen bg-[#030508] text-white py-12 md:py-20 px-4 md:px-10 relative overflow-x-hidden font-sans antialiased print:bg-white print:text-black">
        {/* Sticky CTA — visible apenas el lead empieza a leer el reporte. Cierra la fricción
            de "¿y ahora qué?" al ofrecer el agendamiento en todo momento sin tener que
            scrollear hasta el final. Oculto en print. */}
        <a
          href={buildCalLink(contact)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-4 right-4 md:top-6 md:right-6 z-50 px-5 py-3 md:px-6 md:py-3.5 bg-[#34d399] text-[#030508] text-[11px] md:text-[12px] font-bold uppercase tracking-[0.12em] rounded-full shadow-[0_0_30px_rgba(52,211,153,0.35)] hover:bg-[#2dd4bf] hover:scale-[1.03] active:scale-[0.97] transition-all inline-flex items-center gap-2 print:hidden"
        >
          <CalendarDays size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">Agendar mi asesoría sin costo</span>
          <span className="sm:hidden">Agendar sin costo</span>
          <ArrowRight size={14} strokeWidth={2.5} />
        </a>

        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#34d399]/5 blur-[150px] rounded-full pointer-events-none print:hidden"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#22d3ee]/5 blur-[150px] rounded-full pointer-events-none print:hidden"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-12 mb-16 print:border-black/10">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full border border-[#34d399]/20 bg-[#34d399]/[0.07] print:border-black/20 print:bg-transparent">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399] print:shadow-none print:bg-black shrink-0"></span>
                <span className="text-[11px] sm:text-[11px] uppercase tracking-[0.12em] font-bold text-[#34d399] print:text-black leading-none">Diagnóstico Estratégico Confidencial</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-medium tracking-tight leading-[1.05] md:leading-none text-white">
                <span className="text-white [text-shadow:0_0_18px_rgba(52,211,153,0.45)]">Stratos</span> <span className="text-slate-400 font-light">· Plano Estratégico</span>
              </h1>
              <p className="text-lg text-slate-400 font-light print:text-black/60 tracking-wide">Preparado exclusivamente para: <strong className="text-white print:text-black font-medium">{reportData.fullName}</strong></p>
            </div>
            <div className="mt-10 md:mt-0 text-left md:text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">Viabilidad de Escala IA</p>
              <div className="text-6xl font-light font-mono flex items-baseline md:justify-end tracking-tight [text-shadow:0_0_30px_rgba(52,211,153,0.25)] print:[text-shadow:none]">{reportData.score}<span className="text-2xl text-[#34d399] ml-2 font-medium print:text-black">/100</span></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-12">
              {/* ── FUGA DE CAPITAL ESTIMADA — solo matemáticas, supuestos a la vista ── */}
              {reportData.leak && (
                <div className="rounded-[2rem] bg-[#060A11] border border-red-500/20 overflow-hidden print:border-black/30">
                  <div className="p-8 md:p-10 bg-gradient-to-r from-red-500/[0.07] to-transparent">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-red-400 print:text-black">Fuga de capital estimada</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500 border border-white/10 rounded-full px-2.5 py-1">Estimado</span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-4xl md:text-6xl font-light tracking-tight text-red-400 [text-shadow:0_0_30px_rgba(239,68,68,0.2)] print:text-black print:[text-shadow:none]">
                        {fmtUSD(reportData.leak.low)} – {fmtUSD(reportData.leak.high)}
                      </span>
                      <span className="text-base md:text-lg text-slate-400 font-light">en comisiones / mes</span>
                    </div>
                    <p className="text-[14px] text-slate-500 font-light mt-2">
                      ≈ {fmtUSD(reportData.leak.annualLow)} – {fmtUSD(reportData.leak.annualHigh)} al año que hoy se quedan en la mesa.
                    </p>
                  </div>

                  {/* La matemática — sin humo, todo a la vista */}
                  <div className="px-8 md:px-10 py-7 border-t border-white/5">
                    <h4 className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-4">Cómo lo calculamos</h4>
                    <ul className="space-y-2.5 mb-5">
                      {reportData.leak.assumptions.map((a, i) => (
                        <li key={i} className="flex items-start gap-3 text-[14px] text-slate-300 font-light leading-relaxed print:text-black/80">
                          <ChevronRight size={15} className="text-red-400/70 shrink-0 mt-1 print:text-black" strokeWidth={2.5} />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12.5px] text-slate-500 font-light leading-relaxed italic">
                      Es un estimado conservador basado solo en tus respuestas, no una promesa. El número exacto lo validamos contigo en la llamada.
                    </p>
                  </div>

                  {/* Lo recuperable con Stratos */}
                  <div className="px-8 md:px-10 py-7 border-t border-white/5 bg-[#34d399]/[0.03]">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-[#34d399] w-full mb-1 print:text-black">Recuperable con Stratos (≈55%)</span>
                      <span className="text-3xl md:text-4xl font-light tracking-tight text-[#34d399] print:text-black">
                        {fmtUSD(reportData.leak.recLow)} – {fmtUSD(reportData.leak.recHigh)}
                      </span>
                      <span className="text-[14px] text-slate-400 font-light">/ mes, sin contratar a nadie más.</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-10 md:p-12 rounded-[2rem] bg-gradient-to-r from-[#34d399]/10 to-transparent border-l-[3px] border-[#34d399] print:bg-black/5 print:border-black">
                <h3 className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#34d399] mb-5 print:text-black">Misión Operativa Definitiva</h3>
                <p className="text-2xl font-light leading-relaxed tracking-tight print:text-black/80">{reportData.strategicMission}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-10 rounded-3xl bg-[#060A11] border border-red-500/10 shadow-[inset_0_2px_20px_rgba(239,68,68,0.03)] print:border-black/20">
                  <h4 className="text-[11px] uppercase tracking-[0.12em] font-bold text-red-400 mb-5 flex items-center gap-3"><XCircle size={16}/> Cómo trabajas hoy</h4>
                  <p className="text-[15px] text-slate-400 font-light leading-relaxed print:text-black/70">Tu equipo no puede escalar sin aumentar costos. Los leads se enfrían por falta de seguimiento inmediato y pierdes comisiones en el caos.</p>
                </div>
                <div className="p-10 rounded-3xl bg-[#34d399]/[0.02] border border-[#34d399]/20 shadow-[0_0_30px_rgba(52,211,153,0.05)] print:border-black">
                  <h4 className="text-[11px] uppercase tracking-[0.12em] font-bold text-[#34d399] mb-5 flex items-center gap-3"><Check size={16} className="shrink-0"/> Cómo trabajarías con Stratos</h4>
                  <p className="text-[15px] text-emerald-50 font-light leading-relaxed print:text-black">{reportData.futureStateText}</p>
                </div>
              </div>

              <div className="p-10 md:p-12 rounded-[2.5rem] bg-[#060A11] border border-white/5 print:border-black/20 print:bg-transparent">
                <h3 className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-8 flex items-center gap-3"><Workflow size={16}/> Motor Lógico: {reportData.module}</h3>
                <div className="space-y-4">
                  {reportData.architectureNodes.map((node, i) => {
                    const NIcon = node.icon;
                    return (
                      <div key={i} className="flex gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-2xl items-center print:border-black/20 print:bg-black/5 hover:bg-white/[0.04] transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-[#34d399]/10 border border-[#34d399]/20 flex items-center justify-center shrink-0 print:border-black">
                          <NIcon className="w-5 h-5 text-[#34d399] print:text-black" />
                        </div>
                        <div>
                          <h4 className="text-[17px] font-medium text-white mb-1.5 tracking-tight print:text-black">{node.title}</h4>
                          <p className="text-[14px] text-slate-400 font-light leading-relaxed print:text-black/70">{node.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="grid gap-4">
                {reportData.metrics.map((m, i) => {
                  const MIcon = m.icon;
                  return (
                    <div key={i} className="p-8 rounded-3xl bg-[#060A11] border border-white/5 flex flex-col justify-center items-start print:border-black/20 print:bg-transparent relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#34d399]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <MIcon className="w-6 h-6 text-[#34d399]/50 mb-5 print:text-black" />
                      <div className="text-4xl font-light tracking-tight mb-2 print:text-black">{m.value}</div>
                      <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 print:text-black/60">{m.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="p-8 md:p-10 rounded-[2rem] bg-[#060A11] border border-white/5 print:border-black/20 print:bg-transparent">
                <h3 className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-8 flex items-center gap-3"><CalendarDays size={16} className="shrink-0"/> Plan de 7 Días</h3>
                <div className="relative border-l border-white/10 ml-4 space-y-8 print:border-black/20">
                  {reportData.timeline.map((step, i) => (
                    <div key={i} className="relative pl-8">
                      <div className="absolute w-2.5 h-2.5 bg-[#34d399] rounded-full -left-[5.5px] top-1.5 print:bg-black ring-4 ring-[#060A11] print:ring-white"></div>
                      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#34d399] mb-1 print:text-black/50">{step.day}</div>
                      <div className="text-[15px] font-medium text-white mb-1.5 tracking-tight print:text-black">{step.title}</div>
                      <div className="text-[14px] font-light text-slate-400 print:text-black/70 leading-relaxed">{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Acompañamiento Stratos — el valor humano: no lo haces solo */}
          <div className="mt-16 p-8 sm:p-12 rounded-[2.5rem] bg-[#060A11] border border-white/10 print:hidden">
            <div className="text-center mb-10">
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#34d399] mb-3">No lo haces solo</p>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-white">Stratos lo activa <span className="text-[#34d399]">contigo</span>, paso a paso</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: Headset, t: "Te contactamos en 24h", d: "Un estratega de Stratos revisa tu diagnóstico y te llama para resolver dudas, sin costo y sin compromiso." },
                { icon: Workflow, t: "Lo construimos contigo", d: "Instalamos y configuramos todo el sistema con tu inventario y tu marca. Tú solo apruebas; nosotros ejecutamos." },
                { icon: TrendingUp, t: "Hasta tu primer cierre", d: "Te acompañamos en el arranque y ajustamos la IA hasta que empiece a traerte citas reales calificadas." },
              ].map((it, i) => { const Ic = it.icon; return (
                <div key={i} className="p-7 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#34d399]/30 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#34d399]/10 border border-[#34d399]/20 flex items-center justify-center shrink-0"><Ic className="w-[18px] h-[18px] text-[#34d399]" strokeWidth={1.8} /></div>
                    <span className="text-[#34d399] font-mono text-xs font-bold">0{i + 1}</span>
                  </div>
                  <h4 className="text-[16px] font-medium text-white tracking-tight mb-2">{it.t}</h4>
                  <p className="text-[14px] text-slate-400 font-light leading-relaxed">{it.d}</p>
                </div>
              ); })}
            </div>
          </div>

          <div className="mt-16 p-8 sm:p-12 md:p-16 rounded-[2.5rem] bg-gradient-to-br from-[#34d399]/10 to-[#060A11] border border-[#34d399]/30 text-center print:hidden relative overflow-hidden shadow-[0_0_60px_rgba(52,211,153,0.1)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.1)_0%,transparent_60%)] pointer-events-none"></div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6 text-white relative z-10">La Ejecución "Llave en Mano"</h2>
            <p className="text-[17px] text-slate-300 font-light max-w-3xl mx-auto mb-10 leading-relaxed relative z-10">
              Ya tienes la arquitectura exacta, <strong className="text-white font-medium">{reportData.firstName}</strong>. Puedes intentar armar esto internamente (arriesgando meses de prueba y error), o permitir que nuestro equipo instale este motor <strong className="text-[#34d399] font-medium">100% "Llave en Mano"</strong>.<br/><br/>
              Nos encargamos del código, de los LLMs y de la integración total. Tú solo recibes las citas pre-calificadas.
            </p>
            <a
              href={buildCalLink(contact)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 bg-white text-black text-[14px] font-bold uppercase tracking-[0.12em] rounded-full hover:bg-slate-100 transition-all inline-flex items-center gap-4 relative z-10 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)]"
            >
              Agendar mi llamada con Stratos <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
