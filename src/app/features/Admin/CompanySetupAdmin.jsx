import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { MANAGED_TENANT_FEATURES, managedTenantFeatures } from "../../../clients/tenant/managed-features";
import { saveCompanySetup, updatePlatformCompany } from "../../../lib/whatsapp-admin";
import { getClientConfigByOrgId } from "../../../clients";
import CajaPermissionsAdmin from "./CajaPermissionsAdmin";

const isManagedCompany = org => org?.meta_config?.onboarding?.createdFrom === "whatsapp_admin"
  && org?.meta_config?.platform?.kind !== "partner";

export default function CompanySetupAdmin({ T, data, refresh, initialOrganizationId = "" }) {
  const companies = useMemo(() => data?.organizations || [], [data?.organizations]);
  const [selectedId, setSelectedId] = useState(initialOrganizationId);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const previousCompany = useRef("");
  const selected = companies.find(org => org.id === selectedId) || null;
  const activeUsers = (data?.profiles || []).filter(user => user.organization_id === selectedId && user.active !== false).length;

  useEffect(() => { if (initialOrganizationId) setSelectedId(initialOrganizationId); }, [initialOrganizationId]);

  useEffect(() => {
    if (!companies.length) { setSelectedId(""); return; }
    if (!companies.some(org => org.id === selectedId)) setSelectedId(companies[0].id);
  }, [companies, selectedId]);

  useEffect(() => {
    if (!selected) { setDraft(null); return; }
    setDraft({ name: selected.name, active: selected.active === true, seats: Number(selected.seats || 1), features: managedTenantFeatures(selected.meta_config?.features) });
    if (previousCompany.current !== selected.id) { setError(""); setSuccess(""); }
    previousCompany.current = selected.id;
  }, [selected]);

  const input = { minHeight: 40, borderRadius: 10, padding: "0 10px", border: `1px solid ${T.border}`, background: T.glass, color: T.txt, fontFamily: font, fontSize: 13 };
  const card = { padding: 18, borderRadius: 16, border: `1px solid ${T.border}`, background: T.glass };
  const saveGeneral = async () => {
    if (!selected || !draft || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await updatePlatformCompany({ organization_id: selected.id, expected_updated_at: selected.updated_at, name: draft.name.trim(), seats: Number(draft.seats), active: draft.active });
      setSuccess(await refresh() ? "Datos generales, estado y licencias guardados." : "Datos guardados. Pulsa Actualizar antes de volver a editar.");
    } catch (err) { setError(err.message || "No se pudo guardar la empresa. Tus cambios siguen aquí."); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (!selected || !draft) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await saveCompanySetup(selected.id, selected.updated_at, Number(draft.seats), draft.features);
      setSuccess(result.audit_saved === false
        ? "Configuración guardada. El historial de auditoría no pudo registrarse; revisa el servidor."
        : "Módulos y licencias guardados. La empresa verá la nueva configuración al actualizar su sesión.");
      if (!await refresh()) {
        setSuccess("Configuración guardada, pero no se pudo actualizar la pantalla. Pulsa Actualizar antes de editarla otra vez.");
      }
    } catch (err) { setError(err.message || "No se pudo guardar la empresa."); }
    finally { setSaving(false); }
  };

  return <div style={{ padding: "22px 24px 60px", display: "grid", gap: 16, fontFamily: font }}>
    <div><h1 style={{ margin: 0, fontFamily: fontDisp, fontSize: 24 }}>Empresas, estado y licencias</h1>
      <p style={{ color: T.txt3, fontSize: 14, lineHeight: 1.5, maxWidth: 780 }}>Edita los datos generales y el cupo de cualquier empresa. El enlace de acceso y la configuración propia de cada cliente se conservan.</p></div>
    {!companies.length ? <div style={card}>Todavía no hay empresas disponibles. Crea una desde Empresas.</div>
      : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ ...card, display: "grid", gap: 7, maxHeight: "55vh", overflowY: "auto" }}><strong style={{ fontSize: 13, marginBottom: 5 }}>Empresas administrables</strong>
          {companies.map(org => <button key={org.id} disabled={saving} onClick={() => setSelectedId(org.id)} style={{ ...input, textAlign: "left", cursor: "pointer", borderColor: selectedId === org.id ? T.accentB : T.border, color: selectedId === org.id ? T.accent : T.txt2, height: "auto", padding: "10px 12px" }}><Building2 size={14} style={{ marginRight: 7, verticalAlign: "middle" }} />{org.name}{getClientConfigByOrgId(org.id)?.id === 'duke' ? ' · Duke' : ''}</button>)}
        </div>
        {selected && draft && <div style={{ ...card, display: "grid", gap: 17 }}>
          <div><strong style={{ fontSize: 17 }}>{selected.name}</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 5 }}>Identificador: {selected.slug} · {activeUsers} usuario{activeUsers === 1 ? "" : "s"} activo{activeUsers === 1 ? "" : "s"}</div></div>
          <div><label htmlFor="company-edit-name" style={{ display: "block", marginBottom: 7 }}>Nombre de la empresa</label><input id="company-edit-name" value={draft.name} minLength={2} maxLength={120} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} style={{ ...input, width: "100%" }} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}><input type="checkbox" checked={draft.active} onChange={e => setDraft(prev => ({ ...prev, active: e.target.checked }))} />Empresa activa</label>
          {!draft.active && <p style={{ margin: 0, color: T.txt2, lineHeight: 1.5 }}>La empresa quedará inactiva para nuevas altas y traslados. Sus datos y usuarios actuales se conservan.</p>}
          <div><label htmlFor="company-seats" style={{ display: "block", fontWeight: 700, fontSize: 12, marginBottom: 7 }}>Usuarios incluidos</label>
            <input id="company-seats" type="number" min="1" max="1000" value={draft.seats} onChange={e => setDraft(prev => ({ ...prev, seats: e.target.value }))} style={{ ...input, width: 110 }} />
            <div style={{ color: T.txt3, fontSize: 12, marginTop: 6 }}>El administrador también ocupa un cupo. Si cambias las licencias, deben cubrir a los {activeUsers} usuarios activos.</div>
            {activeUsers > Number(selected.seats) && <p style={{ color: T.txt2, lineHeight: 1.5, fontSize: 13 }}>Este espacio histórico tiene más usuarios que su cupo registrado. Puedes editar sus datos o ajustar las licencias antes de incorporar más personas.</p>}</div>
          <button onClick={saveGeneral} disabled={saving || draft.name.trim().length < 2 || !Number.isInteger(Number(draft.seats)) || Number(draft.seats) < 1 || (Number(draft.seats) !== Number(selected.seats) && Number(draft.seats) < activeUsers) || Number(draft.seats) > 1000} style={{ ...input, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer", color: T.accent, borderColor: T.accentB }}><Save size={16} />{saving ? "Guardando…" : "Guardar datos de empresa"}</button>
          {isManagedCompany(selected) ? <><div><strong style={{ fontSize: 12 }}>Módulos de esta empresa</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 6 }}>El CRM de clientes es la base de la entrada neutral y permanece activo.</div><div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {MANAGED_TENANT_FEATURES.map(item => <label key={item.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer", color: T.txt2, fontSize: 13 }}>
              <input type="checkbox" checked={draft.features[item.key]} onChange={e => setDraft(prev => ({ ...prev, features: { ...prev.features, [item.key]: e.target.checked } }))} />{item.label}
            </label>)}
          </div><div style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.5, marginTop: 9 }}>WhatsApp y Copilot requieren configuración propia. Caja se administra en la matriz contigua. Estos tres interruptores organizan la interfaz; sus datos siguen sujetos a los permisos actuales.</div></div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving || Number(draft.seats) < activeUsers} style={{ ...input, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", color: T.accent, borderColor: T.accentB, opacity: saving ? .6 : 1 }}><Save size={14} />{saving ? "Guardando…" : "Guardar configuración"}</button>
            <button onClick={refresh} disabled={saving} style={{ ...input, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}><RefreshCw size={14} />Actualizar</button>
          </div></> : <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.txt3 }}>Este cliente conserva sus módulos personalizados. Sus usuarios y roles se administran desde Usuarios; los datos generales y las licencias se guardan arriba.</p>}
          {error && <div role="alert" style={{ color: T.rose, fontSize: 13 }}>{error}</div>}
          {success && <div role="status" style={{ color: T.success, fontSize: 12.5 }}>{success}</div>}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, color: T.txt3, fontSize: 11.5, lineHeight: 1.5 }}><ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />Cada cambio conserva quién lo hizo, cuándo y qué cupo o módulo cambió. Otras organizaciones no reciben esta configuración.</div>
        </div>}
        {selected && <CajaPermissionsAdmin key={selected.id} T={T} organization={selected}
          users={data?.profiles || []} refresh={refresh} />}
      </div>}
  </div>;
}
