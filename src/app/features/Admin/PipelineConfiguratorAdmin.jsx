import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, ChevronDown,
  ChevronUp, Copy, GripVertical, LayoutGrid, Loader2, LockKeyhole, Plus,
  RotateCcw, Save, Search, Sparkles, Trash2,
} from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { useIsMobile } from "../../../hooks/useViewport";
import {
  loadOrganizationPipeline,
  loadWhatsAppAdmin,
  saveOrganizationPipeline,
} from "../../../lib/whatsapp-admin";

const PALETTE = ["#94A3B8", "#38BDF8", "#22D3EE", "#FBBF24", "#A78BFA", "#FB923C", "#34D399", "#F87171", "#EC4899", "#14B8A6"];

const TEMPLATES = [
  {
    id: "general", label: "Ventas general", hint: "Prospecto a cierre",
    stages: [
      ["Prospecto", "#94A3B8"], ["Contactado", "#38BDF8"],
      ["En conversación", "#FBBF24"], ["Reunión", "#A78BFA"],
      ["Propuesta", "#FB923C"], ["Ganado", "#34D399"], ["Perdido", "#F87171"],
    ],
  },
  {
    id: "inmobiliaria", label: "Inmobiliaria", hint: "Seguimiento y visita",
    stages: [
      ["Nuevo lead", "#94A3B8"], ["Contactado", "#38BDF8"],
      ["Calificado", "#22D3EE"], ["Cita agendada", "#A78BFA"],
      ["Visita realizada", "#FBBF24"], ["Negociación", "#FB923C"],
      ["Cierre", "#34D399"], ["No interesado", "#F87171"],
    ],
  },
  {
    id: "servicios", label: "Servicios", hint: "Cotización y entrega",
    stages: [
      ["Solicitud nueva", "#94A3B8"], ["Diagnóstico", "#38BDF8"],
      ["Cotización enviada", "#A78BFA"], ["Aprobado", "#FBBF24"],
      ["En ejecución", "#FB923C"], ["Entregado", "#34D399"],
      ["Descartado", "#F87171"],
    ],
  },
];

const templateStages = (template) => template.stages.map(([name, color]) => ({ name, color }));
const cloneStages = (stages) => (stages || []).map(stage => ({ name: stage.name, color: stage.color }));
const stageKey = (name) => String(name || "").trim().toLocaleLowerCase("es");

export default function PipelineConfiguratorAdmin({ T, onBack }) {
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [stages, setStages] = useState([]);
  const [baseline, setBaseline] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  const loadOrganizations = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const data = await loadWhatsAppAdmin();
      const rows = data?.organizations || [];
      setOrganizations(rows);
      setSelectedId(current => current || rows[0]?.id || "");
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudieron cargar las empresas.", retry: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoadingPipeline(true); setMessage(null);
    loadOrganizationPipeline(selectedId)
      .then(data => {
        if (!active) return;
        const saved = Array.isArray(data.pipeline) && data.pipeline.length
          ? data.pipeline
          : templateStages(TEMPLATES[0]);
        setStages(cloneStages(saved));
        setBaseline(cloneStages(saved));
        setUsage(data.usage || {});
      })
      .catch(error => active && setMessage({ type: "error", text: error.message || "No se pudo cargar el pipeline." }))
      .finally(() => active && setLoadingPipeline(false));
    return () => { active = false; };
  }, [selectedId]);

  const selectedOrg = organizations.find(org => org.id === selectedId);
  const filteredOrganizations = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es");
    return organizations.filter(org => !q || org.name?.toLocaleLowerCase("es").includes(q) || org.slug?.toLocaleLowerCase("es").includes(q));
  }, [organizations, search]);
  const dirty = JSON.stringify(stages) !== JSON.stringify(baseline);
  const totalClients = Object.values(usage).reduce((sum, count) => sum + Number(count || 0), 0);
  const occupiedMissing = Object.entries(usage).filter(([name, count]) =>
    Number(count || 0) > 0 && !stages.some(stage => stageKey(stage.name) === stageKey(name))
  );

  const input = {
    minHeight: 40, borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.glass, color: T.txt, fontFamily: font, fontSize: 12.5,
    outline: "none", boxSizing: "border-box",
  };
  const button = {
    minHeight: 40, borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.glass, color: T.txt2, fontFamily: font, fontSize: 12.5,
    fontWeight: 600, padding: "0 14px", cursor: "pointer", display: "inline-flex",
    alignItems: "center", justifyContent: "center", gap: 7,
  };
  const card = { border: `1px solid ${T.border}`, background: T.glass, borderRadius: 16 };

  const patchStage = (index, patch) => setStages(current => current.map((stage, i) => i === index ? { ...stage, ...patch } : stage));
  const moveStage = (from, to) => {
    if (to < 0 || to >= stages.length || from === to) return;
    setStages(current => {
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };
  const addStage = () => setStages(current => [
    ...current,
    { name: `Nueva etapa ${current.length + 1}`, color: PALETTE[current.length % PALETTE.length] },
  ]);
  const duplicateStage = (index) => setStages(current => {
    const copy = [...current];
    const source = current[index];
    copy.splice(index + 1, 0, { ...source, name: `${source.name} copia` });
    return copy;
  });
  const removeStage = (index) => {
    if (stages.length <= 2) {
      setMessage({ type: "error", text: "El pipeline necesita al menos dos etapas." });
      return;
    }
    const stage = stages[index];
    const count = Number(usage[stage.name] || 0);
    if (count > 0) {
      setMessage({ type: "error", text: `“${stage.name}” tiene ${count} cliente${count === 1 ? "" : "s"}. Muévelos primero desde el CRM antes de borrar esa etapa.` });
      return;
    }
    setStages(current => current.filter((_, i) => i !== index));
  };

  const applyTemplate = (template) => {
    const draft = templateStages(template);
    const protectedStages = Object.entries(usage)
      .filter(([name, count]) => Number(count || 0) > 0 && !draft.some(next => stageKey(next.name) === stageKey(name)))
      .map(([name]) => baseline.find(stage => stageKey(stage.name) === stageKey(name)) || { name, color: "#64748B" });
    if (protectedStages.length > 0) {
      setMessage({ type: "warning", text: `Borrador todavía no publicado. Stratos conservó ${protectedStages.length} etapa${protectedStages.length === 1 ? "" : "s"} con clientes al final del pipeline; mueve esos clientes antes de eliminarla${protectedStages.length === 1 ? "" : "s"}.` });
    } else {
      setMessage({ type: "warning", text: "Plantilla aplicada como borrador. Para verla en el CRM debes pulsar “Guardar y publicar”." });
    }
    setStages([...draft, ...protectedStages]);
  };

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const result = await saveOrganizationPipeline(selectedId, stages);
      const saved = cloneStages(result.pipeline);
      setStages(saved); setBaseline(saved);
      const preserved = Object.entries(result.preserved_stages || {});
      const preservedText = preserved.length
        ? ` Stratos conservó automáticamente ${preserved.map(([name, count]) => `“${name}” (${count})`).join(", ")} porque todavía tiene clientes.`
        : "";
      setMessage({ type: "success", text: `Pipeline publicado para ${selectedOrg?.name || "la empresa"}.${preservedText} Sus usuarios lo verán al recargar el CRM.` });
      setOrganizations(current => current.map(org => org.id === selectedId
        ? { ...org, meta_config: result.organization?.meta_config || org.meta_config }
        : org));
      window.dispatchEvent(new CustomEvent("stratos:pipeline-saved", {
        detail: { organizationId: selectedId, pipeline: saved },
      }));
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo guardar el pipeline." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? "12px 10px 48px" : "22px 24px 60px", color: T.txt, fontFamily: font, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <button onClick={onBack} style={{ ...button, marginBottom: 16, background: "transparent" }}><ArrowLeft size={14} /> Usuarios</button>

      <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18, padding: "10px 0 12px", background: T.bg || "#050B14", borderBottom: dirty ? `1px solid ${T.accentB}` : "1px solid transparent" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22, fontWeight: 650 }}>Pipelines por empresa</h2>
          <p style={{ color: T.txt3, fontSize: 12.5, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.55 }}>
            Personaliza el recorrido comercial de cada cliente sin tocar código. Cada cambio se guarda solo en la empresa seleccionada.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setStages(cloneStages(baseline))} disabled={!dirty || saving} style={{ ...button, opacity: dirty ? 1 : .45 }}><RotateCcw size={14} /> Descartar</button>
          <button onClick={save} disabled={!dirty || saving || !selectedId} style={{ ...button, color: T.accent, borderColor: T.accentB, background: T.accentS, opacity: dirty ? 1 : .55 }}>
            {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} {dirty ? `Guardar y publicar en ${selectedOrg?.name || "empresa"}` : "Sin cambios por publicar"}
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: "11px 14px", marginBottom: 14, color: T.txt2, fontSize: 11.5, lineHeight: 1.55 }}>
        <strong style={{ color: T.txt }}>Cómo funciona:</strong> 1. Selecciona la empresa · 2. Edita nombres, colores y orden · 3. Pulsa <strong>Guardar y publicar</strong> · 4. Los usuarios de esa empresa recargan su CRM. El cambio no afecta a ningún otro white label.
      </div>

      {message && (
        <div style={{ ...card, padding: "11px 14px", marginBottom: 14, display: "flex", gap: 9, alignItems: "flex-start", color: message.type === "success" ? T.accent : message.type === "warning" ? "#FBBF24" : "#FCA5A5", borderColor: message.type === "success" ? T.accentB : message.type === "warning" ? "rgba(251,191,36,.35)" : "rgba(248,113,113,.35)" }}>
          {message.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{message.text}</span>
          {message.retry && <button onClick={loadOrganizations} style={{ ...button, minHeight: 30, marginLeft: "auto", padding: "0 11px" }}>Reintentar</button>}
        </div>
      )}

      {occupiedMissing.length > 0 && (
        <div style={{ ...card, padding: "13px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start", color: "#FBBF24", borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.06)" }}>
          <LockKeyhole size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>Tu borrador no perderá clientes.</strong> Al publicar, Stratos añadirá al final {occupiedMissing.map(([name, count]) => `“${name}” (${count} cliente${Number(count) === 1 ? "" : "s"})`).join(", ")} porque todavía está en uso. Si ya no quieres esa etapa, mueve primero esos clientes desde el CRM y luego elimínala.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(230px,290px) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <aside style={{ ...card, padding: 14, position: isMobile ? "static" : "sticky", top: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><Building2 size={16} color={T.accent} /><strong style={{ fontSize: 13.5 }}>Empresa</strong><span style={{ marginLeft: "auto", color: T.txt3, fontSize: 11.5 }}>{organizations.length}</span></div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={13} color={T.txt3} style={{ position: "absolute", left: 11, top: 13 }} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa…" style={{ ...input, width: "100%", padding: "0 10px 0 32px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: isMobile ? 240 : "58vh", overflowY: "auto" }}>
            {loading ? <div style={{ padding: 18, color: T.txt3, fontSize: 12 }}>Cargando empresas…</div> : filteredOrganizations.map(org => {
              const active = org.id === selectedId;
              const configured = Array.isArray(org.meta_config?.crm?.pipeline);
              return <button key={org.id} onClick={() => { if (!dirty || window.confirm("Hay cambios sin guardar. ¿Cambiar de empresa y descartarlos?")) setSelectedId(org.id); }} style={{ border: `1px solid ${active ? T.accentB : T.border}`, background: active ? T.accentS : "transparent", borderRadius: 11, padding: "10px 11px", color: active ? T.accent : T.txt2, cursor: "pointer", textAlign: "left", fontFamily: font }}>
                <div style={{ fontSize: 12.5, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{org.name}</div>
                <div style={{ fontSize: 10.5, color: T.txt3, marginTop: 3 }}>{configured ? "Pipeline personalizado" : "Plantilla inicial"} · {org.seats || 0} licencias</div>
              </button>;
            })}
          </div>
        </aside>

        <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fontDisp }}>{selectedOrg?.name || "Selecciona una empresa"}</div>
                <div style={{ fontSize: 11.5, color: T.txt3, marginTop: 4 }}>{stages.length} etapas · {totalClients} clientes activos contabilizados</div>
              </div>
              {dirty && <span style={{ border: "1px solid rgba(251,191,36,.32)", background: "rgba(251,191,36,.08)", color: "#FBBF24", borderRadius: 99, padding: "4px 9px", fontSize: 10.5 }}>Cambios sin guardar</span>}
            </div>
          </section>

          <section style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><Sparkles size={16} color={T.accent} /><strong style={{ fontSize: 13.5 }}>Empezar con una plantilla</strong></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 8 }}>
              {TEMPLATES.map(template => <button key={template.id} onClick={() => applyTemplate(template)} style={{ ...button, minHeight: 58, padding: "9px 12px", justifyContent: "flex-start", textAlign: "left" }}><div><div style={{ color: T.txt, fontWeight: 650 }}>{template.label}</div><div style={{ color: T.txt3, fontSize: 10.5, marginTop: 3 }}>{template.hint}</div></div></button>)}
            </div>
          </section>

          <section style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><LayoutGrid size={16} color={T.accent} /><strong style={{ fontSize: 13.5 }}>Diseñar etapas</strong></div>
              <button onClick={addStage} style={{ ...button, minHeight: 34 }}><Plus size={13} /> Agregar etapa</button>
            </div>

            {loadingPipeline ? <div style={{ padding: 24, color: T.txt3, fontSize: 12.5 }}>Cargando pipeline…</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowX: "auto" }}>
                {stages.map((stage, index) => {
                  const count = Number(usage[stage.name] || 0);
                  return <div key={`${index}-${stage.name}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragIndex != null) moveStage(dragIndex, index); setDragIndex(null); }} style={{ display: "grid", gridTemplateColumns: "28px 42px minmax(150px,1fr) 86px 112px", minWidth: isMobile ? 530 : 0, gap: 9, alignItems: "center", border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 10px", background: dragIndex === index ? T.accentS : "transparent" }}>
                    <GripVertical size={16} color={T.txt3} style={{ cursor: "grab" }} />
                    <input aria-label={`Color de ${stage.name}`} type="color" value={stage.color} onChange={event => patchStage(index, { color: event.target.value.toUpperCase() })} style={{ width: 38, height: 34, padding: 2, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer" }} />
                    <input value={stage.name} disabled={count > 0} title={count > 0 ? "Mueve primero los clientes de esta etapa desde el CRM" : "Escribe el nombre de la etapa"} onChange={event => patchStage(index, { name: event.target.value })} style={{ ...input, width: "100%", padding: "0 11px", opacity: count > 0 ? .62 : 1, cursor: count > 0 ? "not-allowed" : "text" }} />
                    <span title={count > 0 ? "Etapa protegida mientras tenga clientes" : "Etapa disponible para editar o borrar"} style={{ color: count ? T.txt2 : T.txt3, fontSize: 11.5, textAlign: "right", display: "inline-flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>{count > 0 && <LockKeyhole size={11} />}{count} cliente{count === 1 ? "" : "s"}</span>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <IconButton title="Subir" disabled={index === 0} onClick={() => moveStage(index, index - 1)} T={T}><ChevronUp size={13} /></IconButton>
                      <IconButton title="Bajar" disabled={index === stages.length - 1} onClick={() => moveStage(index, index + 1)} T={T}><ChevronDown size={13} /></IconButton>
                      <IconButton title="Duplicar" onClick={() => duplicateStage(index)} T={T}><Copy size={12} /></IconButton>
                      <IconButton title="Eliminar" disabled={count > 0} onClick={() => removeStage(index)} T={T} danger><Trash2 size={12} /></IconButton>
                    </div>
                  </div>;
                })}
              </div>
            )}
          </section>

          <section style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 10 }}>Vista previa</div>
            <div style={{ overflowX: "auto", paddingBottom: 4 }}><div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>{stages.map((stage, index) => <div key={`${stage.name}-${index}`} style={{ width: 145, border: `1px solid ${stage.color}55`, background: `${stage.color}12`, borderRadius: 12, padding: 11 }}><div style={{ display: "flex", gap: 7, alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: 99, background: stage.color }} /><strong style={{ color: T.txt, fontSize: 11.5, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage.name || "Sin nombre"}</strong></div><div style={{ color: T.txt3, fontSize: 10.5, marginTop: 10 }}>{Number(usage[stage.name] || 0)} tarjetas</div></div>)}</div></div>
            <p style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.55, margin: "11px 0 0" }}>La primera etapa recibe los clientes nuevos. El orden de izquierda a derecha será el mismo en el CRM. Esta vista es un borrador hasta pulsar “Guardar y publicar”.</p>
          </section>
        </main>
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick, disabled, danger, T }) {
  return <button title={title} onClick={onClick} disabled={disabled} style={{ width: 25, height: 25, borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: danger ? "#F87171" : T.txt3, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .35 : 1, padding: 0, display: "grid", placeItems: "center" }}>{children}</button>;
}
