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
  AlertTriangle, Target, ArrowRight, Check, Zap, Clock,
  PhoneCall, Database, Network, Terminal, CalendarDays,
  Cpu, TrendingUp, Lock, Workflow, Layers,
  XCircle, Bot, Smartphone, Headset,
  Building2, ChevronRight
} from "lucide-react";
import { sendDiagnosticoStratosResult } from "../lib/webhook-diagnostico-stratos";

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION BANK — replicado exacto del Gemini Canvas del equipo
   ═══════════════════════════════════════════════════════════════════════════ */
const QUESTION_BANK = [
  {
    id: "mainPain",
    icon: AlertTriangle,
    label: "Seamos brutales con los números: ¿Dónde estás perdiendo más dinero hoy?",
    insight: "El tiempo mata los tratos. Identificar la fuga de capital exacta nos permite inyectar Inteligencia Artificial donde el retorno de inversión sea inmediato.",
    options: [
      { value: "unqualified_leads", label: "El Cementerio de Curiosos", desc: "Pago pauta cara, llegan decenas de leads, pero mi equipo pierde horas con gente que no tiene crédito o presupuesto." },
      { value: "slow_followup", label: "El Síndrome de la Respuesta Lenta", desc: "Mis asesores tardan en contestar o no dan seguimiento. La competencia nos roba clientes por ser más rápida." },
      { value: "call_overload", label: "Llamadas Perdidas = Dinero Quemado", desc: "Entran leads de noche o fines de semana y nadie atiende en menos de 5 minutos. Los leads se enfrían al instante." }
    ],
    dynamicPrompt: "Precisa la hemorragia de tu equipo (Selecciona las que apliquen):",
    quickTags: {
      unqualified_leads: ["Leads sin pre-calificación", "Dejan en visto en WhatsApp", "Agendan pero no asisten (No-shows)", "CPA (Costo por Adquisición) muy alto"],
      slow_followup: ["Asesores desorganizados", "Respuestas tardan +1 hora", "Cero seguimiento después de 30 días", "Fuga a competidores locales"],
      call_overload: ["Leads nocturnos perdidos", "Imposible contactar en < 5 min", "Alta rotación de personal", "Asesores colapsados de trabajo"]
    }
  },
  {
    id: "role",
    icon: Building2,
    label: "¿Cuál es el volumen real de tu operación?",
    insight: "Los sistemas genéricos fracasan. Un Asesor Top necesita un 'clon digital'; un Broker necesita una máquina de control y vigilancia masiva.",
    options: [
      { value: "broker_owner", label: "Broker / Dueño (Escalando Agencia)", desc: "Busco estandarizar procesos. Que mis ventas no dependan de si el asesor amaneció de buen humor. Quiero control total." },
      { value: "top_producer", label: "Top Producer (Alto Volumen)", desc: "Tengo leads pero mi tiempo es el cuello de botella. Necesito una IA que atienda WhatsApp mientras yo estoy cerrando firmas." }
    ],
    dynamicPrompt: "¿Qué tipo de ticket / inventario dominas?",
    quickTags: {
      broker_owner: ["Múltiples Desarrollos", "Vivienda Media/Residencial", "Equipo de 5+ asesores", "Gestión de exclusivas"],
      top_producer: ["Residencial Premium (High-Ticket)", "Inversionistas / Fondos", "Pre-ventas exclusivas", "Rentas corporativas"]
    }
  },
  {
    id: "maturity",
    icon: Database,
    label: "¿Dónde vive la 'verdad' de tu negocio actualmente?",
    insight: "Para que nuestro motor de IA funcione como una máquina de imprimir dinero, necesitamos conectarlo directamente a la fuente de tu inventario.",
    options: [
      { value: "low", label: "El Caos (WhatsApp y Excel)", desc: "Si un asesor renuncia, se lleva mi cartera. No hay procesos, dependo 100% de la memoria humana y notas de voz." },
      { value: "medium", label: "CRM Inmobiliario Tradicional", desc: "Uso Tokko, EasyBroker o similar. El inventario está ahí, pero el seguimiento y las respuestas en WhatsApp siguen siendo manuales." },
      { value: "advanced", label: "Ecosistema CRM Avanzado", desc: "Tengo HubSpot o Salesforce. Solo me falta la capa de IA autónoma (Voz y RAG) para cerrar el ciclo sin humanos." }
    ],
    dynamicPrompt: "Marca las herramientas que pagan tu nómina hoy:",
    quickTags: {
      low: ["WhatsApp Personal", "Google Sheets", "Libretas físicas", "Memoria del equipo"],
      medium: ["EasyBroker", "Tokko Broker", "Nocnok", "Wasi / AlterEstate"],
      advanced: ["HubSpot", "Salesforce", "Make / Zapier", "ActiveCampaign"]
    }
  },
  {
    id: "primaryGoal",
    icon: Target,
    label: "Si resolviéramos UN solo cuello de botella en los próximos 14 días, ¿cuál eliges?",
    insight: "El enfoque radical trae resultados radicales. Instalamos un motor, lo hacemos hiper-rentable y luego escalamos al resto de la agencia.",
    options: [
      { value: "ai_whatsapp", label: "El Cerrador de WhatsApp (IA Conversacional)", desc: "Un Agente IA que entiende audios, busca en mi inventario, descarta curiosos y me agenda visitas calificadas 24/7." },
      { value: "ai_callcenter", label: "Call Center Autónomo (Voz IA en 5 seg)", desc: "Una IA que llama al lead 5 segundos después de que deja sus datos en Meta, evalúa su crédito y me transfiere la llamada caliente." },
      { value: "full_iaos", label: "IAOS: Dominio Total del Mercado", desc: "El ecosistema definitivo. Voz, WhatsApp y CRM sincronizados para absorber a toda la competencia de mi zona." }
    ],
    dynamicPrompt: "¿Qué métrica te urge reventar este trimestre?",
    quickTags: {
      ai_whatsapp: ["Citas Efectivas (+200%)", "Filtro Automático de Crédito", "Seguimiento a 6 meses", "Automatización de Fichas Técnicas"],
      ai_callcenter: ["Tiempo de Contacto (< 1 min)", "Calificación de Presupuesto Inmediata", "Transferencia en vivo a cerradores", "Reducir CPA drásticamente"],
      full_iaos: ["Escalabilidad absoluta (Cero contrataciones)", "Recuperar leads de hace 1 año", "Control militar de la data", "Posicionamiento Dominante"]
    }
  }
];

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
  let module = "Motor Central Stratos IAOS";
  let description = "El sistema operativo que eliminará tu carga administrativa. Tu equipo dejará de perseguir prospectos fríos y se dedicará exclusivamente a firmar contratos pre-calificados.";
  let futureStateText = "Una operación hiper-eficiente. Tu IA califica, nutre y agenda. Tú solo te presentas a estrechar la mano y cobrar la comisión.";
  let primaryMetric = { label: "Tasa de Contacto", value: "< 5 Segundos", icon: Zap };
  let strategicMission = `Implementar un motor de automatización 'Done-For-You' que permita a ${firstName} duplicar cierres sin contratar personal extra.`;

  if (goals.includes("ai_callcenter") || pains.includes("call_overload")) {
    module = "Agente de Voz Ultra-Realista (Call Center IA)";
    description = "Implementaremos un motor de voz sintética que contacta a tus leads en milisegundos tras entrar por Ads. Evalúa presupuesto y transfiere la llamada caliente directo a tu celular.";
    futureStateText = "Cientos de llamadas simultáneas sin descansos ni rotación de personal. El prospecto siente que habla con tu mejor asesor premium.";
    primaryMetric = { label: "Capacidad Operativa", value: "24/7", icon: PhoneCall };
  } else if (goals.includes("ai_whatsapp") || pains.includes("unqualified_leads")) {
    module = "Clonador Digital de WhatsApp (LLM RAG)";
    description = "Una IA conectada a tu inventario. Entiende audios complejos, perfila la capacidad crediticia del cliente, envía PDFs exactos y agenda la visita sola.";
    futureStateText = "Tu WhatsApp filtrando curiosos con precisión quirúrgica y tratando con guante de seda a los inversionistas listos para comprar.";
    primaryMetric = { label: "Aumento de Citas", value: "+250%", icon: CalendarDays };
  }

  if (contextText.toLowerCase().includes("premium") || contextText.toLowerCase().includes("high ticket")) {
    description += " Calibrado con prompts de negociación High-Ticket para manejar clientes exigentes con absoluta naturalidad.";
  }

  return {
    fullName: safeName,
    firstName,
    profile,
    score,
    module,
    moduleDesc: description,
    strategicMission,
    futureStateText,
    metrics: [
      primaryMetric,
      { label: "Horas Liberadas / Mes", value: "+160 hrs", icon: Clock },
      { label: "Multiplicador de ROI", value: "x3.5 GCI", icon: TrendingUp }
    ],
    techStack: [
      { label: "Vapi / Retell AI para Voz Ultra-Realista (Latencia <800ms)", icon: Headset },
      { label: "Make.com (Integromat) para orquestación de flujos y CRM", icon: Workflow },
      { label: "Modelos LLM (GPT-4o / Claude 3.5) con memoria RAG", icon: Bot },
      { label: "Meta Cloud API nativa para WhatsApp Business", icon: Smartphone }
    ],
    architectureNodes: [
      { id: "1", title: "Captación Inbound Omnicanal", desc: "El motor intercepta leads desde Meta, Web o Portales en milisegundos. Latencia cero.", icon: Network },
      { id: "2", title: "Procesador Lógico Stratos", desc: tools.length > 0 ? `Conexión directa con ${tools[0]}. Cruza peticiones del lead con tu stock disponible.` : "Motor RAG entrenado con tu inventario y scripts de cierre.", icon: Cpu },
      { id: "3", title: "Ejecución Automática", desc: "La IA envía la ficha técnica, agenda en Calendly y empuja el trato en tu CRM.", icon: Layers }
    ],
    timeline: [
      { day: "Días 1-3", title: "Ingeniería Inversa", desc: "Mapeamos tu embudo de ventas y conectamos nuestras APIs a tus orígenes de leads." },
      { day: "Días 4-8", title: "Inyección RAG", desc: "Entrenamos a la IA con todo tu inventario, PDFs y el 'tono de voz' exacto de tu agencia." },
      { day: "Días 9-12", title: "Pruebas de Estrés", desc: "Atacamos a la IA con objeciones duras e insultos simulados para garantizar que reaccione perfecto." },
      { day: "Día 14", title: "Go-Live Operativo", desc: "Encendemos el interruptor. Empiezas a recibir notificaciones de citas calificadas en tu teléfono." }
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
    <p className="text-[#34d399] font-mono text-[10px] uppercase tracking-[0.3em] font-medium">{subtext}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DIAGNOSTICO COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Diagnostico() {
  const [stage, setStage] = useState('gate');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [reportData, setReportData] = useState(null);

  const [activeSelections, setActiveSelections] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [contextText, setContextText] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");

  // Tailwind se carga via CDN desde index.html (preload sincrono para evitar FOUC).
  // Antes lo inyectabamos en runtime aqui, pero el primer paint del hero quedaba
  // sin estilos hasta que descargaba el CDN. Movido a <head> en PR #163.

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [stage, step]);

  const handleOptionToggle = (val) => {
    setActiveSelections(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const submitWizardStep = () => {
    if (activeSelections.length === 0) return;
    setAnswers(prev => ({
      ...prev,
      [QUESTION_BANK[step].id]: { values: activeSelections, tags: selectedTags, context: contextText }
    }));
    setActiveSelections([]); setSelectedTags([]); setContextText("");

    if (step < QUESTION_BANK.length - 1) {
      setStep(s => s + 1);
    } else {
      setStage('pre-form');
      let ticks = 0;
      const msgs = ["Compilando respuestas...", "Identificando fugas de capital...", "Estructurando topología IAOS...", "Blueprint Listo."];
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
    const msgs = ["Autorizando acceso...", "Conectando nodos RAG...", "Proyectando ROI estratégico...", "Desplegando Dashboard."];
    const int = setInterval(() => {
      setLoadingMsg(msgs[ticks]);
      ticks++;
      if (ticks === msgs.length) { clearInterval(int); }
    }, 1100);

    // Generar el blueprint local (mismo cálculo que en el prototipo)
    const blueprint = generateBlueprint(answers, contact.name);

    // Disparar el webhook a n8n (no bloquea la experiencia visual del lead)
    sendDiagnosticoStratosResult({ contact, answers, blueprint })
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
      <div className="min-h-screen bg-[#060A11] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-[#34d399]/30">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#34d399]/5 blur-[120px] rounded-full animate-[pulse_8s_ease-in-out_infinite] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] bg-[#22d3ee]/5 blur-[100px] rounded-full animate-[pulse_10s_ease-in-out_infinite_alternate] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none"></div>

        <div className="z-10 max-w-5xl text-center flex flex-col items-center">
          <div className="mb-10 px-6 py-2.5 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-md inline-flex">
            <span className="text-[11px] md:text-xs font-bold tracking-[0.3em] uppercase text-slate-300">
              Auditoría Ejecutiva Stratos
            </span>
          </div>

          <h1 className="text-5xl md:text-[5.5rem] lg:text-[6.5rem] font-medium tracking-tighter leading-[1.02] text-white mb-8 md:mb-10 w-full px-2">
            El <span className="text-[#34d399]">60% de tus comisiones</span><br className="hidden md:block"/> muere en el seguimiento.
          </h1>

          <p className="text-lg md:text-[1.35rem] text-slate-300 font-light max-w-3xl mx-auto leading-relaxed mb-12 md:mb-16 tracking-wide">
            Mapeamos tu operación y diseñamos la arquitectura IA para automatizar tus citas. Todo en menos de 90 segundos.
          </p>

          <button
            onClick={() => setStage('wizard')}
            className="relative inline-flex items-center justify-center gap-4 px-10 py-5 md:px-12 md:py-6 bg-white text-black rounded-full text-[13px] md:text-[15px] font-bold uppercase tracking-[0.15em] transition-all duration-300 hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.1)] group mx-auto"
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
    const progress = (step / QUESTION_BANK.length) * 100;

    return (
      <div className="min-h-screen bg-[#060A11] text-white p-4 md:p-8 relative selection:bg-[#34d399]/30 pb-32 font-sans flex flex-col items-center">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none fixed"></div>
        <div className="absolute top-0 w-full h-[500px] bg-[#34d399]/5 blur-[150px] rounded-full pointer-events-none fixed -translate-y-1/2"></div>

        <div className="w-full max-w-3xl relative z-10 pt-4 md:pt-10 flex-1">
          <div className="mb-12 md:mb-16">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-4">
              <span>Auditoría Estructural</span>
              <span className="text-[#34d399]">{Math.round(progress)}%</span>
            </div>
            <div className="h-[2px] w-full bg-white/5 overflow-hidden">
              <div className="h-full bg-[#34d399] transition-all duration-700 ease-out shadow-[0_0_10px_#34d399]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div key={step}>
            <div className="mb-10 md:mb-14">
              <h2 className="text-3xl md:text-5xl font-medium tracking-tighter leading-[1.1] mb-6 flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                <CurrentIcon className="w-8 h-8 md:w-10 md:h-10 text-[#34d399] shrink-0 mt-1 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" strokeWidth={1.5} />
                <span>{q.label}</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl font-light pl-0 md:pl-16 leading-relaxed">{q.insight}</p>
            </div>

            <div className="grid gap-4 md:gap-5 pl-0 md:pl-16">
              {q.options.map(opt => {
                const isActive = activeSelections.includes(opt.value);
                const tags = q.quickTags[opt.value] || [];
                return (
                  <div key={opt.value} className={`transition-all duration-300 ${activeSelections.length > 0 && !isActive ? 'opacity-30 scale-[0.99]' : ''}`}>
                    <button
                      onClick={() => handleOptionToggle(opt.value)}
                      className={`w-full text-left p-6 md:p-8 rounded-2xl md:rounded-[2rem] border transition-all duration-300 relative overflow-hidden group ${isActive ? 'bg-[#34d399]/[0.03] border-[#34d399]/50 shadow-[0_0_30px_rgba(52,211,153,0.15)]' : 'bg-white/[0.01] border-white/10 hover:border-white/20 hover:bg-white/[0.03]'}`}
                    >
                      {isActive && <ElectricPulse />}
                      <div className="relative z-10 pr-8">
                        <h3 className={`text-xl md:text-2xl font-medium mb-3 tracking-tight transition-colors ${isActive ? 'text-[#34d399]' : 'text-white'}`}>{opt.label}</h3>
                        <p className="text-slate-400 font-light leading-relaxed text-sm md:text-base">{opt.desc}</p>
                      </div>
                    </button>

                    {isActive && tags.length > 0 && (
                      <div className="mt-6 ml-4 md:ml-8 border-l-[2px] border-[#34d399]/30 pl-6 pb-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#34d399] font-bold mb-4 flex items-center gap-2"><ChevronRight size={14}/> {q.dynamicPrompt}</p>
                        <div className="flex flex-wrap gap-2.5">
                          {tags.map(tag => {
                            const isTagSelected = selectedTags.includes(tag);
                            return (
                              <button key={tag} onClick={() => handleTagToggle(tag)} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all flex items-center gap-2 border ${isTagSelected ? 'bg-[#34d399]/10 border-[#34d399]/40 text-[#34d399] shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'bg-[#060A11] border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                                {isTagSelected && <Check size={14} strokeWidth={3}/>} {tag}
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
          <div className="fixed bottom-0 left-0 w-full bg-[#060A11]/90 backdrop-blur-2xl border-t border-white/10 p-5 md:p-6 z-50">
            <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-4 items-center md:pl-16">
              <div className="relative w-full flex-1">
                <Terminal className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={contextText} onChange={e => setContextText(e.target.value)} placeholder="Añade contexto adicional (Opcional)..." className="w-full bg-[#030508] border border-white/10 rounded-full pl-12 pr-6 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/40 font-light placeholder:text-slate-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors" />
              </div>
              <button onClick={submitWizardStep} className="w-full md:w-auto px-10 py-4 bg-white text-black text-xs md:text-sm font-bold uppercase tracking-[0.2em] rounded-full hover:bg-slate-200 flex items-center justify-center gap-3 transition-all active:scale-95 shrink-0 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                Siguiente <ArrowRight size={16} strokeWidth={2.5}/>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'pre-form') return <div className="min-h-screen bg-[#060A11]"><AnticipationLoader text="Sintetizando Data..." subtext={loadingMsg} /></div>;
  if (stage === 'loading') return <div className="min-h-screen bg-[#060A11]"><AnticipationLoader text="Compilando Blueprint..." subtext={loadingMsg} /></div>;

  /* ── STAGE: FORM (squeeze) ─────────────────────────────────────────────── */
  if (stage === 'form') {
    return (
      <div className="min-h-screen bg-[#060A11] text-white flex items-center justify-center p-6 relative font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.05)_0%,transparent_60%)] pointer-events-none"></div>
        <div className="z-10 max-w-xl w-full">
          <div className="bg-[#030508] border border-white/10 rounded-[2rem] p-10 md:p-14 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#34d399] to-transparent opacity-50"></div>

            <div className="mb-12 text-center">
              <div className="w-16 h-16 bg-[#34d399]/10 border border-[#34d399]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
                <Lock className="w-7 h-7 text-[#34d399]" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-medium tracking-tight text-white mb-2">Arquitectura Calculada</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#34d399] font-bold">Blueprint Valorado en $1,500 USD</p>
            </div>

            <p className="text-slate-400 text-[15px] font-light mb-10 text-center px-4 leading-relaxed">
              El motor lógico ha diseñado tu sistema exacto. Ingresa tus datos para compilar y desencriptar tu hoja de ruta.
            </p>

            <form onSubmit={unlockReport} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold ml-1 block mb-2">Tu Nombre</label>
                  <input required value={contact.name} onChange={e => setContact({...contact, name: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="Ej. Alex Hormozi" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold ml-1 block mb-2">Agencia / Empresa</label>
                  <input required value={contact.company} onChange={e => setContact({...contact, company: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="Ej. Acquisition.com" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold ml-1 block mb-2">Correo Profesional</label>
                  <input required type="email" value={contact.email} onChange={e => setContact({...contact, email: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="ceo@empresa.com" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold ml-1 block mb-2">WhatsApp Directo</label>
                  <input required type="tel" value={contact.phone} onChange={e => setContact({...contact, phone: e.target.value})} className="w-full bg-[#060A11] border border-white/10 rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#34d399]/50 transition-colors placeholder:text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]" placeholder="+1 234 567 890" />
                </div>
              </div>

              <button type="submit" className="w-full mt-6 bg-[#34d399] text-[#030508] text-[13px] font-bold uppercase tracking-[0.2em] py-5 rounded-xl transition-all flex items-center justify-center gap-3 hover:bg-[#2dd4bf] active:scale-95 shadow-[0_0_30px_rgba(52,211,153,0.3)] group">
                 Desbloquear Blueprint
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
      <div className="min-h-screen bg-[#030508] text-white py-12 md:py-20 px-4 md:px-10 relative overflow-x-hidden font-sans print:bg-white print:text-black">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#34d399]/5 blur-[150px] rounded-full pointer-events-none print:hidden"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#22d3ee]/5 blur-[150px] rounded-full pointer-events-none print:hidden"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-12 mb-16 print:border-black/10">
            <div className="space-y-5">
              <div className="inline-block px-4 py-1.5 rounded-full border border-[#34d399]/20 bg-[#34d399]/10 print:border-black/20 print:bg-transparent">
                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#34d399] print:text-black">Diagnóstico Estratégico Confidencial</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-medium tracking-tighter leading-none text-white">
                Stratos IAOS <span className="text-slate-400 font-light">Blueprint</span>
              </h1>
              <p className="text-lg text-slate-400 font-light print:text-black/60 tracking-wide">Preparado exclusivamente para: <strong className="text-white print:text-black font-medium">{reportData.fullName}</strong></p>
            </div>
            <div className="mt-10 md:mt-0 text-left md:text-right">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500 mb-2">Viabilidad de Escala IA</p>
              <div className="text-6xl font-light font-mono flex items-baseline md:justify-end tracking-tighter">{reportData.score}<span className="text-2xl text-[#34d399] ml-2 font-medium print:text-black">/100</span></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-12">
              <div className="p-10 md:p-12 rounded-[2rem] bg-gradient-to-r from-[#34d399]/10 to-transparent border-l-[3px] border-[#34d399] print:bg-black/5 print:border-black">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#34d399] mb-5 print:text-black">Misión Operativa Definitiva</h3>
                <p className="text-2xl font-light leading-relaxed tracking-tight print:text-black/80">{reportData.strategicMission}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-10 rounded-3xl bg-[#060A11] border border-red-500/10 shadow-[inset_0_2px_20px_rgba(239,68,68,0.03)] print:border-black/20">
                  <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-red-400 mb-5 flex items-center gap-3"><XCircle size={16}/> Modelo Actual (Infierno)</h4>
                  <p className="text-[15px] text-slate-400 font-light leading-relaxed print:text-black/70">Tu equipo no puede escalar sin aumentar costos. Los leads se enfrían por falta de seguimiento inmediato y pierdes comisiones en el caos.</p>
                </div>
                <div className="p-10 rounded-3xl bg-[#34d399]/[0.02] border border-[#34d399]/20 shadow-[0_0_30px_rgba(52,211,153,0.05)] print:border-black">
                  <h4 className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#34d399] mb-5 flex items-center gap-3"><Check size={16}/> Stratos IAOS (Cielo)</h4>
                  <p className="text-[15px] text-emerald-50 font-light leading-relaxed print:text-black">{reportData.futureStateText}</p>
                </div>
              </div>

              <div className="p-10 md:p-12 rounded-[2.5rem] bg-[#060A11] border border-white/5 print:border-black/20 print:bg-transparent">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-8 flex items-center gap-3"><Workflow size={16}/> Motor Lógico: {reportData.module}</h3>
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
                      <div className="text-4xl font-light tracking-tighter mb-2 print:text-black">{m.value}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 print:text-black/60">{m.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="p-8 md:p-10 rounded-[2rem] bg-[#060A11] border border-white/5 print:border-black/20 print:bg-transparent">
                <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-8 flex items-center gap-3"><CalendarDays size={16}/> Roadmap 14 Días</h3>
                <div className="relative border-l border-white/10 ml-4 space-y-8 print:border-black/20">
                  {reportData.timeline.map((step, i) => (
                    <div key={i} className="relative pl-8">
                      <div className="absolute w-2.5 h-2.5 bg-[#34d399] rounded-full -left-[5.5px] top-1.5 print:bg-black ring-4 ring-[#060A11] print:ring-white"></div>
                      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#34d399] mb-1 print:text-black/50">{step.day}</div>
                      <div className="text-[15px] font-medium text-white mb-1.5 tracking-tight print:text-black">{step.title}</div>
                      <div className="text-[13px] font-light text-slate-400 print:text-black/70 leading-relaxed">{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 p-12 md:p-16 rounded-[2.5rem] bg-gradient-to-br from-[#34d399]/10 to-[#060A11] border border-[#34d399]/30 text-center print:hidden relative overflow-hidden shadow-[0_0_60px_rgba(52,211,153,0.1)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.1)_0%,transparent_60%)] pointer-events-none"></div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6 text-white relative z-10">La Ejecución "Llave en Mano"</h2>
            <p className="text-[17px] text-slate-300 font-light max-w-3xl mx-auto mb-10 leading-relaxed relative z-10">
              Ya tienes la arquitectura exacta, <strong className="text-white font-medium">{reportData.firstName}</strong>. Puedes intentar armar esto internamente (arriesgando meses de prueba y error), o permitir que nuestro equipo instale este motor <strong className="text-[#34d399] font-medium">100% "Done-For-You"</strong>.<br/><br/>
              Nos encargamos del código, de los LLMs y de la integración total. Tú solo recibes las citas pre-calificadas.
            </p>
            <button className="px-10 py-5 bg-white text-black text-[13px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-slate-100 transition-all inline-flex items-center gap-4 relative z-10 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)]">
              Agendar Llamada de Implementación <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
