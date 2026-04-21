import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, Target, Users, DollarSign, Zap, Plus, X,
  Search, User, FileText, Clock
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { leads, STAGES, stgC } from "../../data/leads";
import ScoreBar from "./ScoreBar";
import NotesModal from "./NotesModal";
import LeadPanel from "./LeadPanel";

/* ─── Local primitives (match App.jsx prop API) ─── */
const G = ({ children, style, hover, onClick, np }) => {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => setH(false)}
      onClick={onClick} style={{
        background: h ? P.glassH : P.glass,
        backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
        border: `1px solid ${h ? P.borderH : P.border}`,
        borderRadius: P.r, padding: np ? 0 : 18,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)", ...style,
      }}>{children}</div>
  );
};

const Pill = ({ children, color = P.accent, s }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: s ? "2px 8px" : "4px 11px", borderRadius: 99,
    fontSize: s ? 10 : 11, fontWeight: 600, color,
    background: `${color}12`, border: `1px solid ${color}1A`,
    letterSpacing: "0.02em", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Ico = ({ icon: I, sz = 34, is = 16, c = P.accent }) => (
  <div style={{
    width: sz, height: sz, borderRadius: sz > 32 ? 12 : 8, flexShrink: 0,
    background: `${c}0F`, border: `1px solid ${c}1A`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}><I size={is} color={c} /></div>
);

const KPI = ({ label, value, sub, icon, color = P.accent }) => (
  <G hover style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
      <p style={{ fontSize: 13, color: P.txt2, marginBottom: 8, letterSpacing: "0.01em", fontWeight: 400, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1, fontFamily: fontDisp }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: P.emerald, marginTop: 10, display: "flex", alignItems: "center", gap: 3, fontWeight: 500 }}><ArrowUpRight size={12} />{sub}</p>}
    </div>
    <Ico icon={icon} c={color} />
  </G>
);

function CRM({ oc, co }) {
  const [leadsData, setLeadsData]       = useState(leads);
  const [sortField, setSortField]       = useState("sc");
  const [sortDir, setSortDir]           = useState("desc");
  const [filterStage, setFilterStage]   = useState("TODO");
  const [filterAsesor, setFilterAsesor] = useState("TODO");
  const [searchQ, setSearchQ]           = useState("");
  const [viewMode, setViewMode]         = useState("list");
  const [selectedLead, setSelectedLead] = useState(null);
  const [notesLead, setNotesLead]       = useState(null);
  const [addingLead, setAddingLead]     = useState(false);
  const [newLead, setNewLead]           = useState({ n: "", asesor: "", phone: "", budget: "", p: "", campana: "" });
  const [hoveredRow, setHoveredRow]     = useState(null);
  const [expandedPriority, setExpandedPriority] = useState(null);

  const asesores = [...new Set(leadsData.map(l => l.asesor))];
  const urgColor = (d) => d >= 10 ? P.rose : d >= 5 ? P.amber : P.emerald;

  const sortedLeads = useMemo(() => {
    let data = leadsData.filter(l => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || l.n.toLowerCase().includes(q) || l.phone.includes(q) || l.asesor.toLowerCase().includes(q) || l.campana.toLowerCase().includes(q) || l.p.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q);
      const matchStage = filterStage === "TODO" || l.st === filterStage;
      const matchAsesor = filterAsesor === "TODO" || l.asesor === filterAsesor;
      return matchQ && matchStage && matchAsesor;
    });
    return [...data].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === "presupuesto" || sortField === "sc" || sortField === "daysInactive") { av = Number(av) || 0; bv = Number(bv) || 0; }
      else { av = String(av || "").toLowerCase(); bv = String(bv || "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [leadsData, sortField, sortDir, filterStage, filterAsesor, searchQ]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const addNewLead = () => {
    if (!newLead.n.trim()) return;
    const now = new Date();
    const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const h = now.getHours(); const ampm = h >= 12 ? "pm" : "am"; const h12 = h % 12 || 12;
    const dateStr = `${now.getDate()} ${mos[now.getMonth()]}, ${h12}:${String(now.getMinutes()).padStart(2,"0")}${ampm}`;
    const newEntry = {
      id: Date.now(), ...newLead, sc: 40, st: "Nuevo Registro",
      tag: "Nuevo Registro", hot: false, isNew: true, fechaIngreso: dateStr,
      bio: "Cliente recién registrado. Pendiente primer contacto.", risk: "Sin información suficiente aún.",
      friction: "Medio", nextAction: "Primer contacto en las próximas 24 horas",
      nextActionDate: "Hoy", lastActivity: "Registro manual", daysInactive: 0, email: "",
      notas: `OBJETIVO\nPendiente — primer contacto.\n\nPENDIENTE\nRealizar primer contacto y calificar necesidades del cliente.`,
      presupuesto: parseFloat(String(newLead.budget).replace(/[^0-9.]/g, "")) || 0,
    };
    setLeadsData(prev => [newEntry, ...prev]);
    setAddingLead(false);
    setNewLead({ n: "", asesor: "", phone: "", budget: "", p: "", campana: "" });
  };

  const SH = ({ label, field, align = "left" }) => {
    const active = sortField === field;
    return (
      <span onClick={() => handleSort(field)} style={{
        cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        color: active ? P.accent : P.txt3, fontSize: 9, fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", transition: "color 0.15s",
      }}>
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}</span>
      </span>
    );
  };

  const priorityLeads = leadsData.filter(l => l.isNew || l.st === "Zoom Concretado" || l.st === "Zoom Agendado" || l.hot).sort((a,b) => (b.sc - a.sc));
  const totalPipeline = leadsData.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const avgScore = Math.round(leadsData.reduce((s, l) => s + l.sc, 0) / leadsData.length);
  const hotLeads = leadsData.filter(l => l.hot || l.daysInactive <= 2).length;
  const kanbanStages = STAGES.filter(s => s !== "Perdido");

  const colsFull    = "88px 110px 1.6fr 120px 1fr 110px 1.1fr 68px 96px";
  const colsCompact = "1.6fr 110px 1fr 110px 68px 90px";
  const cols = co ? colsCompact : colsFull;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── HEADER ROW ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: P.accent, boxShadow: `0 0 10px ${P.accent}80` }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>Pipeline CRM</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{leadsData.length} clientes</span>
          </div>
          <p style={{ fontSize: 11.5, color: P.txt3, fontFamily: font, margin: 0 }}>
            <span style={{ color: P.txt2 }}>${(totalPipeline/1000000).toFixed(1)}M</span> en pipeline · <span style={{ color: P.emerald }}>{hotLeads} activos</span> · Score promedio <span style={{ color: P.blue }}>{avgScore}</span>
          </p>
        </div>
        <button onClick={() => setAddingLead(true)} style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
          borderRadius: 11, background: "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
          border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12, fontWeight: 700,
          fontFamily: fontDisp, cursor: "pointer", letterSpacing: "0.01em", transition: "all 0.2s", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))"; e.currentTarget.style.boxShadow = `0 0 20px ${P.accent}18`; }}
          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))"; e.currentTarget.style.boxShadow = "none"; }}
        ><Plus size={14} /> Nuevo cliente</button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: co ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Clientes en Pipeline" value={leadsData.length} icon={Users} color={P.blue} />
        <KPI label="Score Promedio" value={avgScore} sub="+4.8 este mes" icon={Target} color={P.amber} />
        <KPI label="Tasa de Conversión" value="18.4%" sub="+3.2pp" icon={TrendingUp} color={P.emerald} />
        <KPI label="Valor Total Pipeline" value={`$${(totalPipeline/1000000).toFixed(1)}M`} icon={DollarSign} />
      </div>

      {/* ── PIPELINE STAGE STRIP ── */}
      <div style={{ display: "flex", gap: 0, borderRadius: 13, overflow: "hidden", border: `1px solid ${P.border}`, background: P.glass }}>
        {STAGES.slice(0,-1).map((stage, idx) => {
          const cnt = leadsData.filter(l => l.st === stage).length;
          const c = stgC[stage] || P.txt3;
          const isActive = filterStage === stage;
          return (
            <div key={stage} onClick={() => setFilterStage(isActive ? "TODO" : stage)}
              title={`${stage} · ${cnt} clientes`}
              style={{ flex: 1, padding: "10px 8px", cursor: "pointer", borderRight: idx < STAGES.length - 2 ? `1px solid ${P.border}` : "none",
                background: isActive ? `${c}18` : "transparent",
                transition: "background 0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: "100%", height: 3, borderRadius: 2, background: isActive ? c : `${c}30`, transition: "background 0.2s" }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: cnt > 0 ? (isActive ? c : "#FFFFFF") : P.txt3, fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1 }}>{cnt}</span>
              <span style={{ fontSize: 8.5, color: isActive ? c : P.txt3, fontWeight: isActive ? 700 : 500, letterSpacing: "0.02em", textAlign: "center", lineHeight: 1.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage}</span>
            </div>
          );
        })}
      </div>

      {/* ── ATENCIÓN INMEDIATA ── */}
      {priorityLeads.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: P.rose, boxShadow: `0 0 8px ${P.rose}`, animation: "pulse 1.8s infinite" }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em", fontFamily: fontDisp }}>Requieren Atención</p>
            </div>
            <div style={{ width: 1, height: 12, background: P.border }} />
            <span style={{ fontSize: 11, color: P.txt3 }}>{priorityLeads.length} con acción pendiente</span>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
            {priorityLeads.map(l => {
              const sc = l.sc;
              const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
              const borderAccent = l.hot ? P.rose : l.daysInactive >= 7 ? P.amber : l.isNew ? P.accentB : `${stgC[l.st] || P.border}50`;
              const isExp = expandedPriority === l.id;
              return (
                <div key={l.id} style={{
                  minWidth: isExp ? 320 : (co ? 210 : 256), flexShrink: 0, borderRadius: 15, overflow: "hidden",
                  background: "linear-gradient(160deg, rgba(255,255,255,0.042) 0%, rgba(255,255,255,0.014) 100%)",
                  border: `1px solid ${borderAccent}`,
                  transition: "all 0.3s cubic-bezier(0.32,0.72,0,1)",
                  boxShadow: l.hot ? `0 0 24px ${P.rose}10` : "none",
                  cursor: "default",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 10px 36px rgba(0,0,0,0.35), 0 0 0 1px ${borderAccent}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = l.hot ? `0 0 24px ${P.rose}10` : "none"; }}
                >
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${stgC[l.st] || P.border}CC, ${stgC[l.st] || P.border}20)` }} />
                  <div style={{ padding: "13px 15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                          {l.isNew && <span style={{ fontSize: 8.5, fontWeight: 800, color: P.accent, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, padding: "1px 6px", borderRadius: 99, letterSpacing: "0.06em" }}>NUEVO</span>}
                          {l.hot && <span style={{ fontSize: 8.5, fontWeight: 800, color: P.rose, background: `${P.rose}12`, border: `1px solid ${P.rose}28`, padding: "1px 6px", borderRadius: 99 }}>HOT</span>}
                          {l.daysInactive >= 7 && !l.isNew && !l.hot && <span style={{ fontSize: 8.5, fontWeight: 700, color: P.amber, background: `${P.amber}12`, border: `1px solid ${P.amber}25`, padding: "1px 6px", borderRadius: 99 }}>{l.daysInactive}d sin contacto</span>}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.015em", lineHeight: 1.1, marginBottom: 2 }}>{l.n}</p>
                        <p style={{ fontSize: 10, color: P.txt3 }}>{l.asesor?.split(" ")[0]} · {l.campana}</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 4 }}>{l.budget}</p>
                        <Pill color={stgC[l.st]} s>{l.st}</Pill>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`, transition: "width 0.5s ease" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, fontFamily: fontDisp, minWidth: 40, textAlign: "right" }}>Score {sc}</span>
                    </div>

                    <div style={{ padding: "8px 10px", borderRadius: 9, background: `${P.accent}08`, border: `1px solid ${P.accentB}`, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <Zap size={9} color={P.accent} />
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: P.accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l.nextActionDate}</span>
                      </div>
                      <p style={{ fontSize: 10.5, color: P.txt2, lineHeight: 1.45 }}>{l.nextAction?.substring(0, 72)}{(l.nextAction?.length || 0) > 72 ? "…" : ""}</p>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 8, background: P.accentS, border: `1px solid ${P.accentB}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, color: P.accent, fontFamily: fontDisp, transition: "all 0.18s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${P.accent}18`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = P.accentS; }}
                      ><Zap size={10} /> Analizar</button>
                      <button onClick={() => setSelectedLead(l)} title="Ver perfil" style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", padding: "7px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, cursor: "pointer", transition: "all 0.18s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; }}
                        onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
                      ><User size={11} color={P.txt3} /></button>
                      <button onClick={() => setNotesLead(l)} title="Ver notas" style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", padding: "7px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, cursor: "pointer", transition: "all 0.18s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; }}
                        onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
                      ><FileText size={11} color={P.txt3} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL NUEVO LEAD ── */}
      {addingLead && createPortal(
        <>
          <div onClick={() => setAddingLead(false)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(540px, 95vw)", background: "#07080F", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)", animation: "fadeIn 0.22s ease" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${P.accent}, ${P.accent}40)`, borderRadius: "22px 22px 0 0" }} />
            <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 3 }}>Registrar Nuevo Cliente</p>
                <p style={{ fontSize: 11, color: P.txt3 }}>Se crea en etapa <span style={{ color: stgC["Nuevo Registro"], fontWeight: 600 }}>Nuevo Registro</span> · Score inicial 40</p>
              </div>
              <button onClick={() => setAddingLead(false)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={14} color={P.txt3} /></button>
            </div>
            <div style={{ padding: "22px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
              {[
                { label: "Nombre completo", key: "n", ph: "Ej. Rafael García", full: true, required: true },
                { label: "Teléfono", key: "phone", ph: "+1 817 682 3272" },
                { label: "Asesor asignado", key: "asesor", ph: "Estefanía Valdes" },
                { label: "Presupuesto", key: "budget", ph: "$200K USD" },
                { label: "Fuente / Campaña", key: "campana", ph: "Cancún, Google Ads, Referido…" },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{f.label}{f.required && <span style={{ color: P.accent }}> *</span>}</p>
                  <input placeholder={f.ph} value={newLead[f.key]} onChange={e => setNewLead(p => ({...p, [f.key]: e.target.value}))}
                    style={{ width: "100%", height: 40, padding: "0 14px", borderRadius: 11, background: P.glass, border: `1px solid ${newLead[f.key] ? P.accentB : P.border}`, color: P.txt, fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = P.accentB}
                    onBlur={e => e.target.style.borderColor = newLead[f.key] ? P.accentB : P.border}
                  />
                </div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Proyecto de interés</p>
                <select value={newLead.p} onChange={e => setNewLead(p => ({...p, p: e.target.value}))} style={{ width: "100%", height: 40, padding: "0 14px", borderRadius: 11, background: P.glass, border: `1px solid ${newLead.p ? P.accentB : P.border}`, color: newLead.p ? P.txt : P.txt3, fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box", cursor: "pointer" }}>
                  <option value="">Seleccionar proyecto…</option>
                  {["Gobernador 28","Monarca 28","Portofino","Torre 25","BAGA","Kaab On The Beach"].map(pr => <option key={pr} value={pr} style={{ background: "#0C1219", color: P.txt }}>{pr}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: "16px 26px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 10 }}>
              <button onClick={() => setAddingLead(false)} style={{ flex: 1, height: 42, borderRadius: 12, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.txt3; }}
              >Cancelar</button>
              <button onClick={addNewLead} disabled={!newLead.n.trim()} style={{ flex: 2, height: 42, borderRadius: 12, background: newLead.n.trim() ? "linear-gradient(135deg, rgba(110,231,194,0.22), rgba(110,231,194,0.1))" : P.glass, border: `1px solid ${newLead.n.trim() ? P.accentB : P.border}`, color: newLead.n.trim() ? P.accent : P.txt3, fontSize: 13, fontWeight: 700, cursor: newLead.n.trim() ? "pointer" : "not-allowed", fontFamily: fontDisp, letterSpacing: "0.01em", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => { if (newLead.n.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.3), rgba(110,231,194,0.15))"; } }}
                onMouseLeave={e => { if (newLead.n.trim()) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.22), rgba(110,231,194,0.1))"; } }}
              ><Plus size={14} /> Registrar Cliente</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── MAIN TABLE / KANBAN ── */}
      <G np>
        {/* Toolbar */}
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: 9, border: `1px solid ${P.border}`, overflow: "hidden", flexShrink: 0, background: P.glass }}>
            {[["list","Lista"],["kanban","Kanban"]].map(([m, lbl]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font,
                background: viewMode === m ? "rgba(255,255,255,0.08)" : "transparent",
                color: viewMode === m ? "#FFFFFF" : P.txt3,
                borderRight: m === "list" ? `1px solid ${P.border}` : "none",
                transition: "all 0.18s",
              }}>{lbl}</button>
            ))}
          </div>

          <div style={{ position: "relative", flex: 1, minWidth: 140, maxWidth: 240 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.txt3, pointerEvents: "none" }} />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar cliente, asesor, proyecto…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: searchQ ? 30 : 12, height: 32, borderRadius: 9, background: P.glass, border: `1px solid ${searchQ ? P.accentB : P.border}`, fontSize: 11.5, color: P.txt, outline: "none", fontFamily: font, boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = P.accentB}
              onBlur={e => e.target.style.borderColor = searchQ ? P.accentB : P.border}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: P.txt3, display: "flex", padding: 0 }}><X size={11} /></button>}
          </div>

          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: filterStage !== "TODO" ? `${stgC[filterStage]}16` : P.glass, border: `1px solid ${filterStage !== "TODO" ? `${stgC[filterStage]}45` : P.border}`, fontSize: 11, color: filterStage !== "TODO" ? stgC[filterStage] : P.txt3, cursor: "pointer", outline: "none", fontFamily: font, fontWeight: filterStage !== "TODO" ? 700 : 400, transition: "all 0.2s" }}>
            <option value="TODO">Todas las etapas</option>
            {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: P.txt }}>{s}</option>)}
          </select>

          <select value={filterAsesor} onChange={e => setFilterAsesor(e.target.value)} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: filterAsesor !== "TODO" ? `${P.violet}14` : P.glass, border: `1px solid ${filterAsesor !== "TODO" ? `${P.violet}45` : P.border}`, fontSize: 11, color: filterAsesor !== "TODO" ? P.violet : P.txt3, cursor: "pointer", outline: "none", fontFamily: font, fontWeight: filterAsesor !== "TODO" ? 700 : 400 }}>
            <option value="TODO">Todos los asesores</option>
            {asesores.map(a => <option key={a} value={a} style={{ background: "#0C1219", color: P.txt }}>{a.split(" ")[0]} {a.split(" ")[1] || ""}</option>)}
          </select>

          {(filterStage !== "TODO" || filterAsesor !== "TODO" || searchQ) && (
            <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ height: 32, padding: "0 12px", borderRadius: 9, background: `${P.rose}0C`, border: `1px solid ${P.rose}28`, color: P.rose, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font, flexShrink: 0, display: "flex", alignItems: "center", gap: 5, transition: "all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = `${P.rose}18`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${P.rose}0C`; }}
            ><X size={11} /> Limpiar</button>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 11, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "4px 11px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.02em" }}>
            {sortedLeads.length} resultado{sortedLeads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── LIST VIEW ── */}
        {viewMode === "list" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "8px 18px", borderBottom: `1px solid ${P.border}`, alignItems: "center", background: "rgba(255,255,255,0.012)" }}>
              {!co && <SH label="Fecha" field="fechaIngreso" />}
              {!co && <SH label="Asesor" field="asesor" />}
              <SH label="Cliente" field="n" />
              <SH label="Teléfono" field="phone" />
              <SH label="Etapa" field="st" />
              <SH label="Presupuesto" field="presupuesto" align="right" />
              {!co && <SH label="Proyecto" field="p" />}
              <SH label="Score" field="sc" align="right" />
              <span style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "center" }}>Acciones</span>
            </div>

            {sortedLeads.map((l) => {
              const isHov = hoveredRow === l.id;
              const sc = l.sc;
              const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
              const showUrgency = l.daysInactive >= 5;
              const uc = urgColor(l.daysInactive);
              const stageC = stgC[l.st] || P.txt3;

              return (
                <div key={l.id}
                  onMouseEnter={() => setHoveredRow(l.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: "grid", gridTemplateColumns: cols, gap: 8, padding: "12px 18px",
                    borderBottom: `1px solid ${P.border}`, alignItems: "center",
                    transition: "background 0.14s",
                    background: isHov ? "rgba(255,255,255,0.028)" : "transparent",
                    position: "relative",
                  }}
                >
                  {showUrgency && (
                    <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3, borderRadius: "0 3px 3px 0", background: uc, opacity: 0.75 }} />
                  )}

                  {!co && <span style={{ fontSize: 10.5, color: P.txt3, fontFamily: font }}>{l.fechaIngreso}</span>}

                  {!co && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${P.violet}16`, border: `1px solid ${P.violet}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, color: P.violet, flexShrink: 0, fontFamily: fontDisp }}>{l.asesor?.charAt(0)}</div>
                      <span style={{ fontSize: 11, color: P.txt2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.asesor?.split(" ")[0]}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${scoreColor}12`, border: `1px solid ${scoreColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: scoreColor, flexShrink: 0, fontFamily: fontDisp }}>{l.n.charAt(0)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.n}</span>
                        {l.isNew && <span style={{ fontSize: 7.5, fontWeight: 800, color: P.accent, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, padding: "1px 5px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.05em" }}>NEW</span>}
                        {l.hot && <span style={{ fontSize: 7.5, fontWeight: 800, color: P.rose, background: `${P.rose}12`, border: `1px solid ${P.rose}28`, padding: "1px 5px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.05em" }}>HOT</span>}
                      </div>
                      <p style={{ fontSize: 10, color: P.txt3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {co ? `${l.asesor?.split(" ")[0]} · ${l.campana}` : l.tag}
                      </p>
                    </div>
                  </div>

                  <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: isHov ? P.txt2 : P.txt3, textDecoration: "none", fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>{l.phone}</a>

                  <div onClick={e => e.stopPropagation()}>
                    <select value={l.st} onChange={e => { const v = e.target.value; setLeadsData(prev => prev.map(x => x.id === l.id ? {...x, st: v} : x)); }}
                      style={{ background: `${stageC}14`, border: `1px solid ${stageC}30`, borderRadius: 99, padding: "4px 10px 4px 8px", fontSize: 10.5, fontWeight: 700, color: stageC, cursor: "pointer", outline: "none", appearance: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.2s" }}>
                      {STAGES.map(s => <option key={s} value={s} style={{ background: "#0C1219", color: P.txt }}>{s}</option>)}
                    </select>
                  </div>

                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", textAlign: "right" }}>{l.budget}</span>

                  {!co && (
                    <span style={{ fontSize: 10.5, color: P.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.p.split("·")[0].trim()}
                    </span>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", maxWidth: 36 }}>
                      <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: scoreColor, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: scoreColor, fontFamily: fontDisp, minWidth: 22, textAlign: "right" }}>{sc}</span>
                  </div>

                  <div style={{ display: "flex", gap: 4, justifyContent: "center", opacity: isHov ? 1 : 0.35, transition: "opacity 0.15s" }}>
                    <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`)} title="Analizar con IA"
                      style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${P.accentB}`, background: isHov ? `${P.accent}18` : P.accentS, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${P.accent}28`; e.currentTarget.style.boxShadow = `0 0 12px ${P.accent}20`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${P.accent}18`; e.currentTarget.style.boxShadow = "none"; }}
                    ><Zap size={12} color={P.accent} /></button>
                    <button onClick={() => setNotesLead(l)} title="Ver notas"
                      style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; }}
                      onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
                    ><FileText size={12} color={P.txt3} /></button>
                    <button onClick={() => setSelectedLead(l)} title="Ver perfil"
                      style={{ width: 29, height: 29, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; }}
                      onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; }}
                    ><User size={12} color={P.txt3} /></button>
                  </div>
                </div>
              );
            })}

            {sortedLeads.length === 0 && (
              <div style={{ padding: "64px 32px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: P.glass, border: `1px solid ${P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Search size={22} color={P.txt3} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: P.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Sin resultados</p>
                <p style={{ fontSize: 12, color: P.txt3, marginBottom: 20 }}>Intenta con otro término, etapa o asesor</p>
                <button onClick={() => { setFilterStage("TODO"); setFilterAsesor("TODO"); setSearchQ(""); }} style={{ padding: "8px 20px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2, fontSize: 12, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = P.glassH; e.currentTarget.style.color = P.txt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                >Limpiar todos los filtros</button>
              </div>
            )}
          </>
        )}

        {/* ── KANBAN VIEW ── */}
        {viewMode === "kanban" && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "16px", minHeight: 480, alignItems: "flex-start", scrollbarWidth: "thin", scrollbarColor: `${P.border} transparent` }}>
            {kanbanStages.map((stage) => {
              const stLeads = sortedLeads.filter(l => l.st === stage);
              const stVal = stLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              const c = stgC[stage] || P.txt3;
              return (
                <div key={stage} style={{ minWidth: 220, flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "10px 13px 10px 11px", borderRadius: 11, background: `${c}0C`, border: `1px solid ${c}28`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: stLeads.length > 0 ? `0 0 8px ${c}60` : "none" }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 800, color: c, letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage}</p>
                        {stLeads.length > 0 && <p style={{ fontSize: 9.5, color: P.txt3, fontFamily: fontDisp }}>${(stVal/1000000).toFixed(1)}M</p>}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: c, background: `${c}18`, border: `1px solid ${c}28`, padding: "3px 9px", borderRadius: 99, flexShrink: 0, fontFamily: fontDisp }}>{stLeads.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {stLeads.map(l => {
                      const sc = l.sc;
                      const scoreColor = sc >= 80 ? P.emerald : sc >= 60 ? P.blue : sc >= 40 ? P.amber : P.rose;
                      return (
                        <div key={l.id} style={{ borderRadius: 13, background: "rgba(255,255,255,0.032)", border: `1px solid ${P.border}`, overflow: "hidden", transition: "all 0.2s", cursor: "default" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.054)"; e.currentTarget.style.borderColor = P.borderH; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.032)"; e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ height: 2.5, background: `linear-gradient(90deg, ${c}CC, ${c}20)` }} />
                          <div style={{ padding: "12px 13px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{l.n}</p>
                                  {l.isNew && <span style={{ fontSize: 7, fontWeight: 800, color: P.accent, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, padding: "1px 4px", borderRadius: 99, flexShrink: 0 }}>NEW</span>}
                                  {l.hot && <span style={{ fontSize: 7, fontWeight: 800, color: P.rose, background: `${P.rose}12`, border: `1px solid ${P.rose}25`, padding: "1px 4px", borderRadius: 99, flexShrink: 0, letterSpacing: "0.04em" }}>HOT</span>}
                                </div>
                                <p style={{ fontSize: 9.5, color: P.txt3 }}>{l.asesor?.split(" ")[0]} · {l.campana}</p>
                              </div>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", flexShrink: 0 }}>{l.budget}</p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                              <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                                <div style={{ width: `${sc}%`, height: 3, borderRadius: 2, background: scoreColor, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: scoreColor, fontFamily: fontDisp, minWidth: 18 }}>{sc}</span>
                            </div>

                            {l.daysInactive >= 5 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, padding: "4px 8px", borderRadius: 7, background: `${urgColor(l.daysInactive)}0C`, border: `1px solid ${urgColor(l.daysInactive)}22` }}>
                                <Clock size={9} color={urgColor(l.daysInactive)} />
                                <span style={{ fontSize: 9.5, color: urgColor(l.daysInactive), fontWeight: 600 }}>{l.daysInactive}d sin actividad</span>
                              </div>
                            )}

                            <p style={{ fontSize: 10, color: P.txt3, lineHeight: 1.45, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                              <Zap size={9} color={P.accent} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} /> {l.nextAction}
                            </p>

                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => oc(`__crm__ ${l.n.toLowerCase()}`)} style={{ flex: 1, padding: "5px 0", borderRadius: 7, background: P.accentS, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${P.accent}18`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = P.accentS; }}
                              ><Zap size={9} /> IA</button>
                              <button onClick={() => setSelectedLead(l)} title="Perfil" style={{ width: 29, padding: "5px 0", borderRadius: 7, background: P.glass, border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = P.glassH; }}
                                onMouseLeave={e => { e.currentTarget.style.background = P.glass; }}
                              ><User size={10} color={P.txt3} /></button>
                              <button onClick={() => setNotesLead(l)} title="Notas" style={{ width: 29, padding: "5px 0", borderRadius: 7, background: P.glass, border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = P.glassH; }}
                                onMouseLeave={e => { e.currentTarget.style.background = P.glass; }}
                              ><FileText size={10} color={P.txt3} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stLeads.length === 0 && (
                      <div style={{ padding: "24px 16px", borderRadius: 11, border: `1px dashed ${P.border}`, textAlign: "center" }}>
                        <p style={{ fontSize: 10.5, color: P.txt3 }}>Sin clientes</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </G>

      {/* ── ANALYTICS ROW ── */}
      <div style={{ display: "grid", gridTemplateColumns: co ? "1fr 1fr" : "1.2fr 1fr 1fr", gap: 14 }}>

        <G>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Score por Cliente</p>
            <Pill color={P.blue} s>Top {Math.min(sortedLeads.length, 6)}</Pill>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={[...sortedLeads].sort((a,b) => b.sc - a.sc).slice(0,6).map(l => ({ n: l.n.split(" ")[0], sc: l.sc }))} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="n" tick={{ fill: P.txt3, fontSize: 9, fontFamily: font }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: P.txt3, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0C1219", border: `1px solid ${P.border}`, borderRadius: 10, color: P.txt, fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="sc" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {[...sortedLeads].sort((a,b) => b.sc - a.sc).slice(0,6).map((l, i) => (
                  <Cell key={i} fill={l.sc >= 80 ? P.emerald : l.sc >= 60 ? P.blue : P.amber} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </G>

        <G>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Distribución</p>
            {filterStage !== "TODO" && (
              <button onClick={() => setFilterStage("TODO")} style={{ fontSize: 9.5, color: P.rose, background: "none", border: "none", cursor: "pointer", fontFamily: font, padding: 0 }}>✕ Quitar filtro</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {STAGES.map(st => {
              const cnt = leadsData.filter(l => l.st === st).length;
              if (cnt === 0) return null;
              const pct = Math.round((cnt / leadsData.length) * 100);
              const isActive = filterStage === st;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0" }} onClick={() => setFilterStage(isActive ? "TODO" : st)}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: stgC[st] || P.txt3, flexShrink: 0, boxShadow: isActive ? `0 0 6px ${stgC[st] || P.txt3}` : "none" }} />
                  <span style={{ fontSize: 10, color: isActive ? "#FFF" : P.txt3, width: 98, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive ? 700 : 400, transition: "color 0.18s" }}>{st}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: stgC[st] || P.txt3, transition: "width 0.5s", opacity: isActive ? 1 : 0.7 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? (stgC[st] || P.txt3) : P.txt2, fontFamily: fontDisp, minWidth: 14, textAlign: "right" }}>{cnt}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 9.5, color: P.txt3, marginTop: 10 }}>Haz clic en una etapa para filtrar</p>
        </G>

        <G>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: P.txt, fontFamily: fontDisp }}>Por Asesor</p>
            {filterAsesor !== "TODO" && (
              <button onClick={() => setFilterAsesor("TODO")} style={{ fontSize: 9.5, color: P.rose, background: "none", border: "none", cursor: "pointer", fontFamily: font, padding: 0 }}>✕ Quitar</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {asesores.map((a, i) => {
              const aLeads = leadsData.filter(l => l.asesor === a);
              const cnt = aLeads.length;
              const val = aLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
              const avgSc = Math.round(aLeads.reduce((s, l) => s + l.sc, 0) / cnt);
              const aCols = [P.accent, P.blue, P.violet, P.amber, P.cyan, P.emerald, P.rose];
              const c = aCols[i % aCols.length];
              const isActive = filterAsesor === a;
              return (
                <div key={a} onClick={() => setFilterAsesor(isActive ? "TODO" : a)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: isActive ? `${c}12` : P.glass, border: `1px solid ${isActive ? `${c}35` : P.border}`, cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; } }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${c}20`, border: `1px solid ${c}32`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: c, flexShrink: 0 }}>{a.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11.5, color: isActive ? "#FFF" : P.txt2, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.split(" ")[0]}</p>
                    <p style={{ fontSize: 9.5, color: P.txt3 }}>{cnt} clientes · score {avgSc}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: fontDisp }}>${(val/1000000).toFixed(1)}M</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 9.5, color: P.txt3, marginTop: 8 }}>Haz clic para filtrar por asesor</p>
        </G>
      </div>

      {/* Panels */}
      <NotesModal lead={notesLead} onClose={() => setNotesLead(null)} />
      <LeadPanel lead={selectedLead} onClose={() => setSelectedLead(null)} oc={oc} onOpenNotes={() => { setNotesLead(selectedLead); setSelectedLead(null); }} />
    </div>
  );
}

export default CRM;
