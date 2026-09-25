import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { MANAGED_TENANT_FEATURES, managedTenantFeatures } from "../../../clients/tenant/managed-features";
import { saveCompanySetup } from "../../../lib/whatsapp-admin";

const isManagedCompany = org => org?.meta_config?.onboarding?.createdFrom === "whatsapp_admin"
  && org?.meta_config?.platform?.kind !== "partner";

export default function CompanySetupAdmin({ T, data, refresh }) {
  const companies = useMemo(() => (data?.organizations || []).filter(isManagedCompany), [data?.organizations]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selected = companies.find(org => org.id === selectedId) || null;
  const activeUsers = (data?.profiles || []).filter(user => user.organization_id === selectedId && user.active !== false).length;

  useEffect(() => {
    if (!companies.length) { setSelectedId(""); return; }
    if (!companies.some(org => org.id === selectedId)) setSelectedId(companies[0].id);
  }, [companies, selectedId]);

  useEffect(() => {
    if (!selected) { setDraft(null); return; }
    setDraft({ seats: Number(selected.seats || 1), features: managedTenantFeatures(selected.meta_config?.features) });
    setError(""); setSuccess("");
  }, [selected]);

  const input = { minHeight: 40, borderRadius: 10, padding: "0 10px", border: `1px solid ${T.border}`, background: T.glass, color: T.txt, fontFamily: font, fontSize: 13 };
  const card = { padding: 18, borderRadius: 16, border: `1px solid ${T.border}`, background: T.glass };
  const save = async () => {
    if (!selected || !draft) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await saveCompanySetup(selected.id, selected.updated_at, Number(draft.seats), draft.features);
      setSuccess(result.audit_saved === false
        ? "Configuración guardada. El historial de auditoría no pudo registrarse; revisa el servidor."
        : "Módulos y licencias guardados. La empresa verá la nueva configuración al actualizar su sesión.");
      await refresh();
    } catch (err) { setError(err.message || "No se pudo guardar la empresa."); }
    finally { setSaving(false); }
  };

  return <div style={{ padding: "22px 24px 60px", display: "grid", gap: 16, fontFamily: font }}>
    <div><h1 style={{ margin: 0, fontFamily: fontDisp, fontSize: 24 }}>Configuración de empresas nuevas</h1>
      <p style={{ color: T.txt3, fontSize: 12.5, lineHeight: 1.5, maxWidth: 780 }}>Administra los módulos que ya funcionan en la entrada neutral de Stratos y el cupo de usuarios. Las empresas con configuración personalizada, incluida Duke, conservan sus ajustes actuales.</p></div>
    {!companies.length ? <div style={card}>Todavía no hay empresas creadas mediante el alta nueva. Crea una en «Empresas y WhatsApp».</div>
      : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ ...card, display: "grid", gap: 7 }}><strong style={{ fontSize: 13, marginBottom: 5 }}>Empresas administrables</strong>
          {companies.map(org => <button key={org.id} onClick={() => setSelectedId(org.id)} style={{ ...input, textAlign: "left", cursor: "pointer", borderColor: selectedId === org.id ? T.accentB : T.border, color: selectedId === org.id ? T.accent : T.txt2, height: "auto", padding: "10px 12px" }}><Building2 size={14} style={{ marginRight: 7, verticalAlign: "middle" }} />{org.name}</button>)}
        </div>
        {selected && draft && <div style={{ ...card, display: "grid", gap: 17 }}>
          <div><strong style={{ fontSize: 17 }}>{selected.name}</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 5 }}>Identificador: {selected.slug} · {activeUsers} usuario{activeUsers === 1 ? "" : "s"} activo{activeUsers === 1 ? "" : "s"}</div></div>
          <div><label htmlFor="company-seats" style={{ display: "block", fontWeight: 700, fontSize: 12, marginBottom: 7 }}>Usuarios incluidos</label>
            <input id="company-seats" type="number" min={Math.max(1, activeUsers)} max="1000" value={draft.seats} onChange={e => setDraft(prev => ({ ...prev, seats: e.target.value }))} style={{ ...input, width: 110 }} />
            <div style={{ color: T.txt3, fontSize: 11.5, marginTop: 6 }}>El administrador también ocupa un cupo. No se puede bajar por debajo de los usuarios activos.</div></div>
          <div><strong style={{ fontSize: 12 }}>Módulos de esta empresa</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 6 }}>El CRM de clientes es la base de la entrada neutral y permanece activo.</div><div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {MANAGED_TENANT_FEATURES.map(item => <label key={item.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer", color: T.txt2, fontSize: 13 }}>
              <input type="checkbox" checked={draft.features[item.key]} onChange={e => setDraft(prev => ({ ...prev, features: { ...prev.features, [item.key]: e.target.checked } }))} />{item.label}
            </label>)}
          </div><div style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.5, marginTop: 9 }}>WhatsApp, Caja y Copilot necesitan conexión o controles adicionales; aquí no se activan por accidente. Esta selección organiza la interfaz; los permisos sobre los datos siguen aplicándose por usuario y empresa.</div></div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving || Number(draft.seats) < activeUsers} style={{ ...input, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", color: T.accent, borderColor: T.accentB, opacity: saving ? .6 : 1 }}><Save size={14} />{saving ? "Guardando…" : "Guardar configuración"}</button>
            <button onClick={refresh} disabled={saving} style={{ ...input, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}><RefreshCw size={14} />Actualizar</button>
          </div>
          {error && <div role="alert" style={{ color: "#FCA5A5", fontSize: 12.5 }}>{error}</div>}
          {success && <div role="status" style={{ color: T.accent, fontSize: 12.5 }}>{success}</div>}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, color: T.txt3, fontSize: 11.5, lineHeight: 1.5 }}><ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />Cada cambio conserva quién lo hizo, cuándo y qué cupo o módulo cambió. Otras organizaciones no reciben esta configuración.</div>
        </div>}
      </div>}
  </div>;
}
