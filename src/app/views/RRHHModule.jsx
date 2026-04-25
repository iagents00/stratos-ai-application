import { useState, useEffect, useRef } from "react";
import {
  Users, UserCheck, Search, Filter, Plus, X, CheckCircle2, 
  AlertCircle, TrendingUp, Target, Zap, Star, BarChart3,
  Clock, Calendar, Building2, Briefcase, FileText, Activity,
  ChevronDown, ChevronRight, SlidersHorizontal, Mail, Phone,
  Shield, Atom, RefreshCw, ListChecks
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

const AIAtom = ({ size = 20, color = T.violet, spin = false }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={spin ? { animation: "atomSpin 3s linear infinite" } : {}}>
    {/* Nucleus */}
    <circle cx="18" cy="18" r="3" fill={color} opacity="0.95" />
    <circle cx="18" cy="18" r="1.4" fill="#fff" opacity="0.5" />
    {/* Ring 1 — horizontal */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.85" />
    {/* Ring 2 — 60° */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.6" transform="rotate(60 18 18)" />
    {/* Ring 3 — 120° */}
    <ellipse cx="18" cy="18" rx="15" ry="5.5" stroke={color} strokeWidth="1.3" opacity="0.38" transform="rotate(120 18 18)" />
    {/* Electron dots */}
    <circle cx="33" cy="18" r="1.8" fill={color} opacity="0.9" />
    <circle cx="10.5" cy="7.8" r="1.8" fill={color} opacity="0.65" />
    <circle cx="10.5" cy="28.2" r="1.8" fill={color} opacity="0.42" />
  </svg>
);

/* ════════════════════════════════════════════════════════
   RECURSOS HUMANOS — STRATOS PEOPLE
   IA para Selección, Evaluación y Gestión de Talento 2026
   Inspirado en: Workday, Greenhouse, HireVue, Paradox AI
   ════════════════════════════════════════════════════════ */
const RRHHModule = ({ T: _T }) => {
  const T = _T || P;
  const [tab, setTab] = useState("panel");
  const [pipelineFilter, setPipelineFilter] = useState("todos");
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [aiScanning, setAiScanning] = useState(false);
  const [aiScanStep, setAiScanStep] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showNewVacante, setShowNewVacante] = useState(false);

  // ─── Datos: Candidatos ───
  const candidates = [
    { id: 1, nombre: "Sofía Ramírez Torres", cargo: "Asesor de Ventas Senior", etapa: "Entrevista", score: 94, habilidades: ["Ventas B2B", "CRM", "Inglés C1", "Bienes Raíces"], exp: "6 años", educacion: "Lic. Administración — ITAM", salario: 28000, cultureFit: 91, tecnico: 88, actitud: 97, fuente: "LinkedIn", avatar: "SR", color: T.emerald, tags: ["Top Pick", "Inglés Nativo"], nota: "Excelente experiencia en ventas de lujo. Cerró +$12M en 2025." },
    { id: 2, nombre: "Carlos Eduardo Mena", cargo: "Asesor de Ventas", etapa: "Assessment", score: 87, habilidades: ["Ventas", "Negociación", "Español", "Excel"], exp: "4 años", educacion: "Lic. Marketing — UNAM", salario: 22000, cultureFit: 84, tecnico: 82, actitud: 92, fuente: "Indeed", avatar: "CM", color: T.blue, tags: ["Motivado"], nota: "Perfil sólido. Requiere capacitación en lujo." },
    { id: 3, nombre: "Valentina Cruz Díaz", cargo: "Coordinadora de Marketing", etapa: "Oferta", score: 96, habilidades: ["Marketing Digital", "SEO", "Meta Ads", "Inglés C2", "Diseño"], exp: "5 años", educacion: "Lic. Comunicación — TEC de Monterrey", salario: 32000, cultureFit: 98, tecnico: 94, actitud: 96, fuente: "Referido", avatar: "VC", color: T.violet, tags: ["Top Pick", "Referida"], nota: "Referida por Emmanuel Ortiz. Portafolio excepcional." },
    { id: 4, nombre: "Roberto Fuentes Gil", cargo: "Asesor de Ventas", etapa: "Screening", score: 62, habilidades: ["Ventas", "Atención al cliente"], exp: "2 años", educacion: "Bachillerato", salario: 18000, cultureFit: 68, tecnico: 55, actitud: 74, fuente: "OCC", avatar: "RF", color: T.amber, tags: ["En revisión"], nota: "Poca experiencia en inmobiliario. Potencial de desarrollo." },
    { id: 5, nombre: "Isabella Moreno Park", cargo: "Asesor Internacional", etapa: "Entrevista", score: 91, habilidades: ["Ventas Internacionales", "Inglés C2", "Coreano básico", "CRM", "Lujo"], exp: "7 años", educacion: "MBA — EGADE Business School", salario: 38000, cultureFit: 89, tecnico: 93, actitud: 90, fuente: "LinkedIn", avatar: "IM", color: T.accent, tags: ["Bilingüe", "Internacional"], nota: "Especialista en clientes asiáticos y americanos." },
    { id: 6, nombre: "Miguel Ángel Reyes", cargo: "Contador Junior", etapa: "Postulado", score: 72, habilidades: ["Contabilidad", "CFDI 4.0", "SAT", "Excel avanzado"], exp: "3 años", educacion: "Lic. Contaduría Pública — UANL", salario: 19000, cultureFit: 78, tecnico: 80, actitud: 68, fuente: "Indeed", avatar: "MR", color: T.cyan, tags: [], nota: "Conocimiento sólido en CFDI. Perfil técnico." },
    { id: 7, nombre: "Camila Ortega Vidal", cargo: "Asistente de Dirección", etapa: "Rechazado", score: 41, habilidades: ["Office", "Organización"], exp: "1 año", educacion: "Carrera trunca", salario: 14000, cultureFit: 52, tecnico: 38, actitud: 60, fuente: "OCC", avatar: "CO", color: T.rose, tags: ["No apto"], nota: "Experiencia insuficiente para el rol." },
    { id: 8, nombre: "Daniel Vargas Leal", cargo: "Asesor de Ventas Senior", etapa: "Contratado", score: 89, habilidades: ["Ventas B2C", "Inglés B2", "CRM", "Bienes Raíces", "Negociación"], exp: "5 años", educacion: "Lic. Negocios Internacionales — UP", salario: 26000, cultureFit: 88, tecnico: 85, actitud: 93, fuente: "Referido", avatar: "DV", color: T.emerald, tags: ["Activo"], nota: "Incorporado 01/04/2026. Zona Tulum." },
  ];

  // ─── Datos: Vacantes ───
  const vacantes = [
    { id: 1, titulo: "Asesor de Ventas Senior — Riviera Maya", dept: "Ventas", tipo: "Tiempo completo", ubicacion: "Playa del Carmen", postulados: 18, entrevistas: 4, status: "Activa", prioridad: "Alta", salarioMin: 25000, salarioMax: 45000, publicada: "02/04/2026", cierre: "30/04/2026", desc: "Buscamos asesor con experiencia en bienes raíces de lujo, inglés avanzado y red de contactos internacionales." },
    { id: 2, titulo: "Coordinadora de Marketing Digital", dept: "Marketing", tipo: "Tiempo completo", ubicacion: "Remoto / Cancún", postulados: 34, entrevistas: 6, status: "Activa", prioridad: "Media", salarioMin: 28000, salarioMax: 42000, publicada: "28/03/2026", cierre: "25/04/2026", desc: "Experta en performance marketing, Meta Ads, Google, contenido lujo y marca personal de asesores." },
    { id: 3, titulo: "Contador Fiscal Sr. — CFDI 4.0", dept: "Finanzas", tipo: "Tiempo completo", ubicacion: "Cancún", postulados: 11, entrevistas: 2, status: "Activa", prioridad: "Alta", salarioMin: 22000, salarioMax: 35000, publicada: "01/04/2026", cierre: "20/04/2026", desc: "CPC con sólidos conocimientos en RMF 2026, declaraciones, IMSS y contabilidad electrónica SAT." },
    { id: 4, titulo: "Asistente de Dirección Ejecutiva", dept: "Dirección", tipo: "Tiempo completo", ubicacion: "Cancún", postulados: 47, entrevistas: 8, status: "Pausada", prioridad: "Baja", salarioMin: 18000, salarioMax: 26000, publicada: "15/03/2026", cierre: "15/05/2026", desc: "Soporte a CEO: agenda, reportes, coordinación de viajes y gestión de información confidencial." },
  ];

  // ─── Datos: Empleados activos ───
  const empleados = [
    { id: 1, nombre: "Emmanuel Ortiz Vázquez", cargo: "Director de Ventas", dept: "Ventas", desde: "Mar 2023", salario: 85000, score: 98, estado: "Activo", avatar: "EO", color: T.emerald },
    { id: 2, nombre: "Ken Lugo Ríos", cargo: "Asesor Senior", dept: "Ventas", desde: "Jun 2023", salario: 55000, score: 92, estado: "Activo", avatar: "KL", color: T.accent },
    { id: 3, nombre: "Cecilia Mendoza Flores", cargo: "Asesora Internacional", dept: "Ventas", desde: "Sep 2023", salario: 48000, score: 88, estado: "Activo", avatar: "CM", color: T.violet },
    { id: 4, nombre: "Araceli Oneto Peña", cargo: "Asesora de Ventas", dept: "Ventas", desde: "Jan 2024", salario: 38000, score: 85, estado: "Activo", avatar: "AO", color: T.blue },
    { id: 5, nombre: "Oscar Gálvez Torres", cargo: "CEO / Director General", dept: "Dirección", desde: "Jan 2022", salario: 150000, score: 100, estado: "Activo", avatar: "OG", color: T.accent },
    { id: 6, nombre: "Daniel Vargas Leal", cargo: "Asesor de Ventas", dept: "Ventas", desde: "Abr 2026", salario: 26000, score: 72, estado: "Onboarding", avatar: "DV", color: T.amber },
  ];

  const etapas = ["Postulado", "Screening", "Entrevista", "Assessment", "Oferta", "Contratado", "Rechazado"];
  const etapaColor = { Postulado: T.txt3, Screening: T.blue, Entrevista: T.violet, Assessment: T.amber, Oferta: T.emerald, Contratado: T.accent, Rechazado: T.rose };
  const prioColor = { Alta: T.rose, Media: T.amber, Baja: T.blue };
  const scoreColor = (s) => s >= 85 ? T.emerald : s >= 70 ? T.accent : s >= 55 ? T.amber : T.rose;
  const scoreLabel = (s) => s >= 85 ? "Excelente" : s >= 70 ? "Bueno" : s >= 55 ? "Regular" : "No apto";

  const filteredCandidates = pipelineFilter === "todos" ? candidates : candidates.filter(c => c.etapa === pipelineFilter);
  const totalPostulados = vacantes.reduce((s, v) => s + v.postulados, 0);
  const enProceso = candidates.filter(c => !["Contratado", "Rechazado"].includes(c.etapa)).length;
  const tasaConversion = Math.round((candidates.filter(c => c.etapa === "Contratado").length / candidates.length) * 100);

  const simulateAIScan = () => {
    setAiScanning(true);
    setAiScanStep(0);
    setAiResult(null);
    setTimeout(() => setAiScanStep(1), 600);
    setTimeout(() => setAiScanStep(2), 1300);
    setTimeout(() => setAiScanStep(3), 1900);
    setTimeout(() => {
      setAiScanning(false);
      setAiScanStep(0);
      setAiResult({
        nombre: "Ana Patricia Solís Medina",
        cargo: "Asesor de Ventas Senior",
        exp: "8 años en ventas inmobiliarias de lujo",
        educacion: "Lic. Administración — Universidad Anáhuac",
        habilidades: ["Ventas B2B", "Inglés C2", "CRM Salesforce", "Bienes raíces premium", "Negociación Harvard"],
        scoreIA: 93,
        cultureFit: 89,
        tecnico: 92,
        actitud: 96,
        fortalezas: ["Experiencia comprobada en ventas de lujo", "Dominio de inglés C2", "Red de contactos internacionales"],
        debilidades: ["Sin experiencia específica en mercado Tulum/Riviera Maya"],
        recomendacion: "PROCEDER — Candidata altamente compatible. Agendar entrevista técnica esta semana.",
        compatibilidad: "Alta",
        salarioSug: "$32,000–$42,000 MXN mensual",
      });
    }, 2200);
  };

  const tabs = [
    { id: "panel", label: "Panel", icon: BarChart3, hint: "Resumen ejecutivo" },
    { id: "pipeline", label: "Pipeline IA", icon: Workflow, hint: `${candidates.length} candidatos` },
    { id: "vacantes", label: "Vacantes", icon: Briefcase, hint: `${vacantes.filter(v=>v.status==="Activa").length} activas` },
    { id: "empleados", label: "Directorio", icon: Users, hint: `${empleados.length} empleados` },
    { id: "ia_scan", label: "Escáner IA", icon: null, hint: "Analiza CVs con IA" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Atom icon container */}
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${T.violet}14`, border: `1.5px solid ${T.violet}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 24px ${T.violet}18` }}>
            <AIAtom size={28} color={T.violet} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                Stratos <span style={{ fontWeight: 700, color: T.violet }}>People</span>
              </p>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.violet, background: `${T.violet}15`, border: `1px solid ${T.violet}30`, padding: "2px 8px", borderRadius: 5, letterSpacing: "0.06em" }}>2026</span>
            </div>
            <p style={{ fontSize: 11, color: T.txt3, marginTop: 3 }}>
              Recursos Humanos · <span style={{ color: T.violet }}>Selección con IA</span> · Gestión de Talento
            </p>
          </div>
        </div>
        {/* Stats rápidas */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            { v: candidates.filter(c=>c.etapa!=="Rechazado").length, l: "En proceso", c: T.blue },
            { v: vacantes.filter(x=>x.status==="Activa").length, l: "Vacantes", c: T.violet },
            { v: `${tasaConversion}%`, l: "Conversión", c: T.emerald },
          ].map(s => (
            <div key={s.l} style={{ padding: "7px 14px", borderRadius: 9, background: `${s.c}08`, border: `1px solid ${s.c}20`, textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: s.c, fontFamily: fontDisp, lineHeight: 1 }}>{s.v}</p>
              <p style={{ fontSize: 9, color: T.txt3, marginTop: 3, fontWeight: 600 }}>{s.l}</p>
            </div>
          ))}
          <div style={{ width: 1, height: 32, background: T.border, margin: "0 4px" }} />
          <button onClick={() => setTab("ia_scan")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: `1.5px solid ${T.violet}45`, background: `${T.violet}0D`, cursor: "pointer", color: T.violet, fontSize: 12, fontWeight: 700, fontFamily: fontDisp, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = `${T.violet}18`; e.currentTarget.style.borderColor = `${T.violet}70`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${T.violet}0D`; e.currentTarget.style.borderColor = `${T.violet}45`; }}
          >
            <AIAtom size={15} color={T.violet} spin />
            Analizar CV con IA
          </button>
          <button
            onClick={() => {
              const url = window.location.origin + "/?apply";
              navigator.clipboard?.writeText(url).then(() => {}).catch(() => {});
              window.open(url, "_blank");
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: `1px solid rgba(110,231,194,0.3)`, background: "rgba(110,231,194,0.07)", cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp }}
          >
            <ExternalLink size={13} /> Portal Candidatos
          </button>
          <button onClick={() => setShowNewVacante(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.93)", cursor: "pointer", color: "#080D14", fontSize: 12, fontWeight: 700, fontFamily: fontDisp, boxShadow: "0 2px 14px rgba(255,255,255,0.10)" }}>
            <Plus size={13} /> Nueva Vacante
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 3, padding: "4px", borderRadius: 13, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          const isAI = t.id === "ia_scan";
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
              background: active ? (isAI ? `${T.violet}14` : "rgba(255,255,255,0.07)") : "transparent",
              color: active ? T.txt : T.txt3, fontSize: 11, fontWeight: active ? 700 : 400,
              fontFamily: fontDisp, transition: "all 0.2s",
              outline: active && isAI ? `1px solid ${T.violet}35` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isAI
                  ? <AIAtom size={13} color={active ? T.violet : T.txt3} />
                  : <t.icon size={13} color={active ? (isAI ? T.violet : T.accent) : T.txt3} />
                }
                <span style={{ color: active ? (isAI ? T.violet : "#FFF") : T.txt3 }}>{t.label}</span>
              </div>
              <span style={{ fontSize: 9, color: active ? (isAI ? `${T.violet}90` : T.txt3) : T.txt3, fontWeight: 400 }}>{t.hint}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ PANEL ═══ */}
      {tab === "panel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { l: "Vacantes Activas", v: vacantes.filter(v => v.status === "Activa").length, c: T.violet, i: Briefcase, sub: "abiertas" },
              { l: "Candidatos en Proceso", v: enProceso, c: T.blue, i: Users, sub: "evaluando" },
              { l: "Total Postulados", v: totalPostulados, c: T.accent, i: FileText, sub: "este mes" },
              { l: "Contratados Mes", v: candidates.filter(c => c.etapa === "Contratado").length, c: T.emerald, i: BadgeCheck, sub: "activos" },
              { l: "Tasa de Conversión", v: `${tasaConversion}%`, c: T.amber, i: Target, sub: "postulado→hire" },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600, marginTop: 4 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          {/* Pipeline visual */}
          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Pipeline de Selección — Resumen</p>
                <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Estado actual de todos los candidatos</p>
              </div>
              <button onClick={() => setTab("pipeline")} style={{ fontSize: 11, color: T.violet, background: "none", border: "none", cursor: "pointer" }}>Ver pipeline completo →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {etapas.map(e => {
                const count = candidates.filter(c => c.etapa === e).length;
                const pct = (count / candidates.length) * 100;
                return (
                  <div key={e} style={{ textAlign: "center" }}>
                    <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 8 }}>
                      <div style={{ width: 32, borderRadius: 4, background: `${etapaColor[e]}30`, border: `1px solid ${etapaColor[e]}40`, height: `${Math.max(pct * 0.6, 8)}px`, position: "relative" }}>
                        <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 700, color: etapaColor[e], fontFamily: fontDisp }}>{count}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 9, color: etapaColor[e], fontWeight: 700, letterSpacing: "0.04em" }}>{e.toUpperCase()}</p>
                  </div>
                );
              })}
            </div>
          </G>

          {/* Top candidatos + vacantes urgentes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <G np>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Top Candidatos IA</p>
                <Pill color={T.violet} s>Ordenados por Score</Pill>
              </div>
              {candidates.filter(c => c.etapa !== "Rechazado").sort((a, b) => b.score - a.score).slice(0, 5).map(c => (
                <div key={c.id} onClick={() => { setSelectedCandidate(c); setTab("pipeline"); }}
                  style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${c.color}20`, border: `2px solid ${c.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.avatar}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</p>
                    <p style={{ fontSize: 10, color: T.txt3 }}>{c.cargo}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: scoreColor(c.score), fontFamily: fontDisp }}>{c.score}</p>
                    <p style={{ fontSize: 9, color: scoreColor(c.score) }}>{scoreLabel(c.score)}</p>
                  </div>
                </div>
              ))}
            </G>
            <G np>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Vacantes Prioritarias</p>
                <button onClick={() => setTab("vacantes")} style={{ fontSize: 11, color: T.accent, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
              </div>
              {vacantes.map(v => (
                <div key={v.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp, flex: 1, paddingRight: 8 }}>{v.titulo}</p>
                    <span style={{ fontSize: 9, fontWeight: 700, color: prioColor[v.prioridad], background: `${prioColor[v.prioridad]}15`, padding: "3px 8px", borderRadius: 5, flexShrink: 0 }}>{v.prioridad}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: T.txt3 }}>{v.postulados} postulados</span>
                    <span style={{ fontSize: 10, color: T.txt3 }}>·</span>
                    <span style={{ fontSize: 10, color: T.txt3 }}>{v.entrevistas} en entrevista</span>
                    <span style={{ fontSize: 10, color: v.status === "Activa" ? T.emerald : T.amber }}>{v.status}</span>
                  </div>
                </div>
              ))}
            </G>
          </div>
        </div>
      )}

      {/* ═══ PIPELINE IA ═══ */}
      {tab === "pipeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search + filters row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, flex: "0 0 220px" }}>
              <Search size={13} color={T.txt3} />
              <input value={pipelineSearch} onChange={e => setPipelineSearch(e.target.value)}
                placeholder="Buscar candidato..." style={{ background: "none", border: "none", outline: "none", color: T.txt, fontSize: 12, fontFamily: font, width: "100%" }} />
              {pipelineSearch && <button onClick={() => setPipelineSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.txt3, padding: 0, display: "flex" }}><X size={11} /></button>}
            </div>
            <span style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>ETAPA:</span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["todos", ...etapas].map(e => {
                const count = e === "todos" ? candidates.length : candidates.filter(c => c.etapa === e).length;
                const isActive = pipelineFilter === e;
                const col = etapaColor[e] || T.accent;
                return (
                  <button key={e} onClick={() => setPipelineFilter(e)} style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${isActive ? col + "55" : T.border}`,
                    background: isActive ? `${col}14` : T.glass,
                    color: isActive ? col : T.txt3,
                    cursor: "pointer", transition: "all 0.18s", fontFamily: fontDisp,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {e === "todos" ? "Todos" : e}
                    <span style={{ fontSize: 9, background: isActive ? `${col}25` : "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>{count}</span>
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 10, color: T.txt3, marginLeft: "auto" }}>
              {filteredCandidates.filter(c => !pipelineSearch || c.nombre.toLowerCase().includes(pipelineSearch.toLowerCase())).length} resultado(s)
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredCandidates.filter(c => !pipelineSearch || c.nombre.toLowerCase().includes(pipelineSearch.toLowerCase()) || c.cargo.toLowerCase().includes(pipelineSearch.toLowerCase())).map(c => (
              <G key={c.id} hover onClick={() => setSelectedCandidate(selectedCandidate?.id === c.id ? null : c)} style={{ cursor: "pointer", padding: 0 }}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${c.color}18`, border: `2px solid ${c.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.avatar}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 14, color: T.txt, fontWeight: 700, fontFamily: fontDisp }}>{c.nombre}</p>
                        {c.tags.map(t => (
                          <span key={t} style={{ fontSize: 9, color: t === "Top Pick" ? T.accent : T.txt3, background: t === "Top Pick" ? `${T.accent}15` : "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{t}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: T.txt2 }}>{c.cargo} · {c.exp} · {c.educacion}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {c.habilidades.slice(0, 4).map(h => (
                          <span key={h} style={{ fontSize: 9, color: T.txt3, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, padding: "2px 8px", borderRadius: 4 }}>{h}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", border: `3px solid ${scoreColor(c.score)}40`, background: `${scoreColor(c.score)}08`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: scoreColor(c.score), fontFamily: fontDisp }}>{c.score}</p>
                        </div>
                        <p style={{ fontSize: 9, color: scoreColor(c.score), marginTop: 4, fontWeight: 700 }}>Score IA</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>${c.salario.toLocaleString("es-MX")}</p>
                        <p style={{ fontSize: 9, color: T.txt3 }}>Expectativa / mes</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: etapaColor[c.etapa], background: `${etapaColor[c.etapa]}15`, padding: "5px 12px", borderRadius: 8, textAlign: "center", minWidth: 88, border: `1px solid ${etapaColor[c.etapa]}25` }}>{c.etapa}</span>
                      <span style={{ fontSize: 9, color: T.txt3, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 5 }}>{c.fuente}</span>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedCandidate?.id === c.id
                          ? <ChevronUp size={11} color={T.txt3} />
                          : <ChevronDown size={11} color={T.txt3} />}
                      </div>
                    </div>
                  </div>

                  {selectedCandidate?.id === c.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 16 }}>
                        {[
                          { l: "Culture Fit", v: c.cultureFit, c: T.violet },
                          { l: "Técnico", v: c.tecnico, c: T.blue },
                          { l: "Actitud", v: c.actitud, c: T.emerald },
                        ].map(s => (
                          <div key={s.l} style={{ padding: "12px 14px", borderRadius: 10, background: `${s.c}08`, border: `1px solid ${s.c}18` }}>
                            <p style={{ fontSize: 10, color: T.txt2, marginBottom: 8, fontWeight: 600 }}>{s.l}</p>
                            <p style={{ fontSize: 22, fontWeight: 300, color: s.c, fontFamily: fontDisp }}>{s.v}<span style={{ fontSize: 12 }}>/100</span></p>
                            <div style={{ height: 3, borderRadius: 2, background: T.border, marginTop: 8, overflow: "hidden" }}>
                              <div style={{ width: `${s.v}%`, height: "100%", background: s.c, borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: "12px 14px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}` }}>
                          <p style={{ fontSize: 10, color: T.txt2, marginBottom: 8, fontWeight: 600 }}>Nota del Reclutador</p>
                          <p style={{ fontSize: 11, color: T.txt, lineHeight: 1.6 }}>{c.nota}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        {["Agendar Entrevista", "Avanzar Etapa", "Enviar Oferta", "Descartar"].map((a, i) => (
                          <button key={a} style={{
                            padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            border: i === 2 ? "none" : `1px solid ${T.border}`,
                            background: i === 2 ? T.emerald : i === 3 ? `${T.rose}10` : T.glass,
                            color: i === 2 ? "#000" : i === 3 ? T.rose : T.txt2, fontFamily: fontDisp,
                          }}>{a}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </G>
            ))}
          </div>
        </div>
      )}

      {/* ═══ VACANTES ═══ */}
      {tab === "vacantes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { l: "Vacantes Activas", v: vacantes.filter(v => v.status === "Activa").length, c: T.violet, i: Briefcase },
              { l: "Total Postulados", v: totalPostulados, c: T.blue, i: Users },
              { l: "Tiempo Promedio de Llenado", v: "18 días", c: T.accent, i: Clock },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                <Ico icon={k.i} sz={36} is={16} c={k.c} />
                <div>
                  <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                  <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>{k.v}</p>
                </div>
              </G>
            ))}
          </div>
          {vacantes.map(v => (
            <G key={v.id} hover style={{ padding: 0 }}>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{v.titulo}</p>
                      <span style={{ fontSize: 9, fontWeight: 700, color: prioColor[v.prioridad], background: `${prioColor[v.prioridad]}15`, padding: "3px 8px", borderRadius: 5 }}>{v.prioridad}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: v.status === "Activa" ? T.emerald : T.amber, background: v.status === "Activa" ? `${T.emerald}15` : `${T.amber}15`, padding: "3px 8px", borderRadius: 5 }}>{v.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ fontSize: 11, color: T.txt3 }}>{v.dept}</span>
                      <span style={{ fontSize: 11, color: T.txt3 }}>· {v.ubicacion}</span>
                      <span style={{ fontSize: 11, color: T.txt3 }}>· {v.tipo}</span>
                      <span style={{ fontSize: 11, color: T.txt3 }}>· Cierra: {v.cierre}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>${v.salarioMin.toLocaleString("es-MX")} – ${v.salarioMax.toLocaleString("es-MX")}</p>
                    <p style={{ fontSize: 10, color: T.txt3 }}>MXN / mes</p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6, marginBottom: 12 }}>{v.desc}</p>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 18, fontWeight: 300, color: T.violet, fontFamily: fontDisp }}>{v.postulados}</p><p style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase" }}>Postulados</p></div>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 18, fontWeight: 300, color: T.blue, fontFamily: fontDisp }}>{v.entrevistas}</p><p style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase" }}>Entrevistas</p></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    {["Ver candidatos", "Editar", "Pausar"].map((a, i) => (
                      <button key={a} style={{ padding: "7px 14px", borderRadius: 7, border: i === 0 ? `1px solid ${T.violet}40` : `1px solid ${T.border}`, background: i === 0 ? `${T.violet}10` : T.glass, color: i === 0 ? T.violet : T.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fontDisp }}>{a}</button>
                    ))}
                  </div>
                </div>
              </div>
            </G>
          ))}
        </div>
      )}

      {/* ═══ DIRECTORIO ═══ */}
      {tab === "empleados" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Total Empleados", v: empleados.length, c: T.violet, i: Users },
              { l: "En Onboarding", v: empleados.filter(e => e.estado === "Onboarding").length, c: T.amber, i: ClipboardList },
              { l: "Score Promedio", v: Math.round(empleados.reduce((s, e) => s + e.score, 0) / empleados.length), c: T.emerald, i: Target },
              { l: "Nómina Total Mensual", v: `$${empleados.reduce((s, e) => s + e.salario, 0).toLocaleString("es-MX")}`, c: T.accent, i: Banknote },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                <Ico icon={k.i} sz={36} is={16} c={k.c} />
                <div>
                  <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                  <p style={{ fontSize: 20, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>{k.v}</p>
                </div>
              </G>
            ))}
          </div>
          <G np>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Empleado</span><span>Cargo / Departamento</span><span>Desde</span><span>Salario</span><span>Score</span><span>Estado</span>
            </div>
            {empleados.map(e => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr", gap: 8, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                onMouseEnter={el => el.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={el => el.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${e.color}18`, border: `2px solid ${e.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: e.color }}>{e.avatar}</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{e.nombre}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: T.txt, fontWeight: 600 }}>{e.cargo}</p>
                  <p style={{ fontSize: 10, color: T.txt3 }}>{e.dept}</p>
                </div>
                <span style={{ fontSize: 11, color: T.txt2 }}>{e.desde}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>${e.salario.toLocaleString("es-MX")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                    <div style={{ width: `${e.score}%`, height: "100%", background: scoreColor(e.score), borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: scoreColor(e.score), fontWeight: 700, width: 24 }}>{e.score}</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: e.estado === "Activo" ? T.emerald : T.amber, background: e.estado === "Activo" ? `${T.emerald}15` : `${T.amber}15`, padding: "3px 10px", borderRadius: 5, textAlign: "center" }}>{e.estado}</span>
              </div>
            ))}
          </G>
        </div>
      )}

      {/* ═══ ESCÁNER IA ═══ */}
      {tab === "ia_scan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <G style={{ padding: 0 }}>
            {/* Header del escáner */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${T.violet}14`, border: `1.5px solid ${T.violet}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AIAtom size={24} color={T.violet} spin={aiScanning} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>Escáner IA de Candidatos</p>
                  <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Sube un CV (PDF o imagen) — la IA extrae datos, evalúa y genera un score en segundos</p>
                </div>
              </div>
              {aiResult && (
                <button onClick={() => { setAiResult(null); setAiScanning(false); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 11, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={12} /> Nuevo escáner
                </button>
              )}
            </div>
            <div style={{ padding: 24 }}>
              {/* Upload zone */}
              {!aiResult && (
                <div
                  style={{
                    border: `2px dashed ${aiScanning ? T.violet : T.border}`,
                    borderRadius: 18, padding: aiScanning ? "32px" : "44px 32px", textAlign: "center",
                    cursor: aiScanning ? "default" : "pointer",
                    background: aiScanning ? `${T.violet}06` : "rgba(255,255,255,0.01)",
                    transition: "all 0.35s", position: "relative", overflow: "hidden",
                  }}
                  onClick={!aiScanning ? simulateAIScan : undefined}
                  onMouseEnter={e => { if (!aiScanning) { e.currentTarget.style.borderColor = `${T.violet}55`; e.currentTarget.style.background = `${T.violet}04`; }}}
                  onMouseLeave={e => { if (!aiScanning) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}}
                >
                  {aiScanning ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
                      {/* Atom spinner */}
                      <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${T.violet}20`, borderTop: `2px solid ${T.violet}`, animation: "spin 1.2s linear infinite" }} />
                        <AIAtom size={32} color={T.violet} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, color: T.violet, fontWeight: 700, fontFamily: fontDisp, marginBottom: 16 }}>Procesando con IA...</p>
                        {/* Step indicators */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 340, margin: "0 auto" }}>
                          {[
                            { step: 1, label: "Extrayendo texto y datos del documento" },
                            { step: 2, label: "Identificando experiencia, habilidades y educación" },
                            { step: 3, label: "Calculando score IA y compatibilidad del perfil" },
                          ].map(s => {
                            const done = aiScanStep > s.step;
                            const active = aiScanStep === s.step;
                            return (
                              <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 9, background: done ? `${T.emerald}08` : active ? `${T.violet}10` : "rgba(255,255,255,0.02)", border: `1px solid ${done ? T.emerald + "25" : active ? T.violet + "35" : T.border}`, transition: "all 0.4s", animation: active ? "stepFade 0.3s ease" : "none" }}>
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? `${T.emerald}20` : active ? `${T.violet}20` : T.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {done ? <CheckCircle2 size={12} color={T.emerald} /> : <span style={{ fontSize: 9, fontWeight: 700, color: active ? T.violet : T.txt3 }}>{s.step}</span>}
                                </div>
                                <span style={{ fontSize: 11, color: done ? T.txt : active ? T.violet : T.txt3, fontWeight: active ? 600 : 400 }}>{s.label}</span>
                                {active && <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: T.violet, animation: `blink 1.4s ${i * 0.2}s infinite` }} />)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 64, height: 64, borderRadius: 18, background: `${T.violet}10`, border: `1px solid ${T.violet}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        <AIAtom size={32} color={T.violet} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 8 }}>Arrastra el CV aquí o haz clic para subir</p>
                      <p style={{ fontSize: 12, color: T.txt3, marginBottom: 20, lineHeight: 1.6 }}>
                        La IA extrae nombre, experiencia, habilidades y educación automáticamente.<br />
                        Genera score de compatibilidad y recomendación de contratación.
                      </p>
                      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                        {[
                          { l: "PDF", c: T.rose },
                          { l: "JPG / PNG", c: T.blue },
                          { l: "Texto libre", c: T.accent },
                          { l: "LinkedIn URL", c: T.violet },
                        ].map(f => (
                          <span key={f.l} style={{ fontSize: 10, color: f.c, background: `${f.c}10`, border: `1px solid ${f.c}25`, padding: "5px 14px", borderRadius: 7, fontWeight: 600 }}>{f.l}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 10, color: T.txt3 }}>Haz clic para simular un análisis de CV con IA</p>
                    </>
                  )}
                </div>
              )}


              {!aiScanning && aiResult && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 16px", borderRadius: 10, background: `${T.emerald}08`, border: `1px solid ${T.emerald}25` }}>
                    <BadgeCheck size={18} color={T.emerald} />
                    <p style={{ fontSize: 13, color: T.emerald, fontWeight: 700 }}>Análisis completado — {aiResult.compatibilidad} compatibilidad detectada</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ padding: "16px 18px", borderRadius: 12, background: T.glass, border: `1px solid ${T.border}` }}>
                        <p style={{ fontSize: 11, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>CANDIDATO IDENTIFICADO</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>{aiResult.nombre}</p>
                        <p style={{ fontSize: 11, color: T.txt2, marginTop: 2 }}>{aiResult.cargo}</p>
                        <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>{aiResult.exp}</p>
                        <p style={{ fontSize: 11, color: T.txt3 }}>{aiResult.educacion}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                          {aiResult.habilidades.map(h => (
                            <span key={h} style={{ fontSize: 9, color: T.accent, background: `${T.accent}10`, border: `1px solid ${T.accent}20`, padding: "2px 8px", borderRadius: 4 }}>{h}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "14px 18px", borderRadius: 12, background: T.glass, border: `1px solid ${T.border}` }}>
                        <p style={{ fontSize: 11, color: T.txt3, marginBottom: 8, fontWeight: 600 }}>SALARIO SUGERIDO POR IA</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>{aiResult.salarioSug}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { l: "Score IA General", v: aiResult.scoreIA, c: T.violet },
                        { l: "Culture Fit", v: aiResult.cultureFit, c: T.blue },
                        { l: "Técnico", v: aiResult.tecnico, c: T.accent },
                        { l: "Actitud / Soft Skills", v: aiResult.actitud, c: T.emerald },
                      ].map(s => (
                        <div key={s.l} style={{ padding: "10px 14px", borderRadius: 10, background: `${s.c}08`, border: `1px solid ${s.c}18`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <p style={{ fontSize: 11, color: T.txt2, fontWeight: 600 }}>{s.l}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 80, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                              <div style={{ width: `${s.v}%`, height: "100%", background: s.c, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: s.c, fontFamily: fontDisp, width: 30, textAlign: "right" }}>{s.v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: `${T.emerald}06`, border: `1px solid ${T.emerald}20` }}>
                      <p style={{ fontSize: 10, color: T.emerald, fontWeight: 700, textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Fortalezas detectadas</p>
                      {aiResult.fortalezas.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <CheckCircle2 size={13} color={T.emerald} />
                          <span style={{ fontSize: 11, color: T.txt, lineHeight: 1.5 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 10, background: `${T.amber}06`, border: `1px solid ${T.amber}20` }}>
                      <p style={{ fontSize: 10, color: T.amber, fontWeight: 700, textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.05em" }}>Áreas de atención</p>
                      {aiResult.debilidades.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <AlertCircle size={13} color={T.amber} />
                          <span style={{ fontSize: 11, color: T.txt, lineHeight: 1.5 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "14px 18px", borderRadius: 12, background: `${T.violet}06`, border: `1px solid ${T.violet}25`, marginBottom: 16 }}>
                    <p style={{ fontSize: 10, color: T.violet, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Recomendación IA</p>
                    <p style={{ fontSize: 13, color: T.txt, fontWeight: 600, lineHeight: 1.6 }}>{aiResult.recomendacion}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ flex: 2, padding: "12px 20px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.95)", color: "#0A0F18", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
                      <Plus size={14} style={{ marginRight: 8, verticalAlign: "middle" }} /> Agregar al Pipeline
                    </button>
                    <button onClick={simulateAIScan} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 12, cursor: "pointer", fontFamily: font }}>Nuevo análisis</button>
                    <button onClick={() => setAiResult(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 12, cursor: "pointer", fontFamily: font }}>Limpiar</button>
                  </div>
                </div>
              )}
            </div>
          </G>

          {!aiResult && !aiScanning && (
            <G>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 14 }}>¿Cómo funciona el Escáner IA?</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { n: "01", t: "Sube el CV", d: "PDF, imagen o texto del candidato", c: T.violet },
                  { n: "02", t: "Extracción IA", d: "Detecta nombre, experiencia, habilidades y educación automáticamente", c: T.blue },
                  { n: "03", t: "Evaluación 360°", d: "Score técnico, cultural y de actitud basado en el perfil del puesto", c: T.accent },
                  { n: "04", t: "Recomendación", d: "PROCEDER / REVISAR / DESCARTAR con justificación detallada", c: T.emerald },
                ].map(s => (
                  <div key={s.n} style={{ padding: 16, borderRadius: 12, background: `${s.c}06`, border: `1px solid ${s.c}18` }}>
                    <p style={{ fontSize: 20, fontWeight: 300, color: s.c, fontFamily: fontDisp, marginBottom: 8 }}>{s.n}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, marginBottom: 4 }}>{s.t}</p>
                    <p style={{ fontSize: 11, color: T.txt3, lineHeight: 1.5 }}>{s.d}</p>
                  </div>
                ))}
              </div>
            </G>
          )}
        </div>
      )}
    </div>
  );
};


export default RRHHModule;
