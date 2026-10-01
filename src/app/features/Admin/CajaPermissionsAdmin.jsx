import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import { font } from "../../../design-system/tokens";
import { loadCompanyCajaAccess, saveCompanyCajaAccess } from "../../../lib/whatsapp-admin";

const ROLES = [
  ["super_admin", "Superadministrador"], ["admin", "Administrador"],
  ["director", "Director"], ["ceo", "Dirección"],
  ["asesor", "Asesor"], ["marketing", "Marketing"],
  ["colaborador", "Colaborador"],
];
const CAPABILITIES = [
  ["read_all", "Ver todos los movimientos"],
  ["read_own", "Ver los propios"],
  ["create", "Registrar movimientos"],
  ["update_all", "Editar todos y administrar nómina"],
  ["update_own", "Editar los propios"],
];
const keyOf = (type, id, capability) => `${type}:${id}:${capability}`;
const defaultRoleDecision = (role) => ["super_admin", "admin"].includes(role) ? "allow" : "deny";

export default function CajaPermissionsAdmin({ T, organization, users, refresh }) {
  const organizationId = organization.id;
  const [version, setVersion] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [decisions, setDecisions] = useState({});
  const [existingUserKeys, setExistingUserKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const result = await loadCompanyCajaAccess(organizationId);
      const next = {};
      const storedUserKeys = [];
      for (const row of result.permissions || []) {
        const key = keyOf(row.principal_type, row.principal_id, row.capability);
        next[key] = row.decision;
        if (row.principal_type === "user") storedUserKeys.push(key);
      }
      for (const [role] of ROLES) for (const [capability] of CAPABILITIES) {
        const key = keyOf("role", role, capability);
        if (!next[key]) next[key] = defaultRoleDecision(role);
      }
      setDecisions(next);
      setExistingUserKeys(storedUserKeys);
      setEnabled(result.enabled === true);
      setVersion(result.updated_at);
    } catch (err) { setError(err.message || "No se pudo leer la matriz de Caja."); }
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { reload(); }, [reload]);

  const activeUsers = useMemo(() => users.filter(user =>
    user.organization_id === organizationId && user.active !== false), [users, organizationId]);
  const control = { minHeight: 34, borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.glass, color: T.txt, fontFamily: font, fontSize: 12 };
  const change = (type, id, capability, decision) => setDecisions(previous => ({
    ...previous, [keyOf(type, id, capability)]: decision,
  }));

  const save = async () => {
    if (!version || loading || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const permissions = [];
      for (const [role] of ROLES) for (const [capability] of CAPABILITIES) {
        permissions.push({ principal_type: "role", principal_id: role, capability,
          decision: decisions[keyOf("role", role, capability)] || "deny" });
      }
      const usersById = new Map(activeUsers.map(user => [user.id, user]));
      const keys = new Set(existingUserKeys);
      for (const user of activeUsers) for (const [capability] of CAPABILITIES) {
        const key = keyOf("user", user.id, capability);
        if (decisions[key] && decisions[key] !== "inherit") keys.add(key);
      }
      for (const key of keys) {
        const [, userId, capability] = key.split(":");
        if (!usersById.has(userId) || !CAPABILITIES.some(([name]) => name === capability)) continue;
        permissions.push({ principal_type: "user", principal_id: userId, capability,
          decision: decisions[key] || "inherit" });
      }
      await saveCompanyCajaAccess(organizationId, version, enabled, permissions);
      setSuccess("Contrato y permisos de Caja guardados en el servidor.");
      await refresh();
      await reload();
      setSuccess("Contrato y permisos de Caja guardados en el servidor.");
    } catch (err) { setError(err.message || "No se pudo guardar Caja."); }
    finally { setSaving(false); }
  };

  return <section style={{ padding: 18, borderRadius: 16, border: `1px solid ${T.border}`,
    background: T.glass, display: "grid", gap: 14, minWidth: 0 }}>
    <div><strong style={{ fontSize: 17 }}>Caja: contrato y permisos</strong>
      <div style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.5, marginTop: 5 }}>
        Incluye movimientos, nómina, cuentas de cobro y comprobantes. La base verifica cada lectura y cada cambio.
      </div></div>
    {loading ? <div style={{ color: T.txt3, fontSize: 12 }}>Cargando permisos…</div> : <>
      <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 700 }}>
        <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
        Caja contratada por esta empresa
      </label>
      <div style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.5 }}>
        Al activar Caja, solo acceden los roles o usuarios autorizados abajo. Desactivarla bloquea Caja aunque un permiso individual diga «Permitir».
      </div>
      <div style={{ overflowX: "auto" }}>
        <strong style={{ fontSize: 12 }}>Permisos por rol</strong>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, marginTop: 8 }}>
          <thead><tr><th style={{ textAlign: "left", padding: 7 }}>Rol</th>
            {CAPABILITIES.map(([name, label]) => <th key={name} title={label} style={{ padding: 7, minWidth: 78 }}>{label}</th>)}
          </tr></thead>
          <tbody>{ROLES.map(([role, label]) => <tr key={role} style={{ borderTop: `1px solid ${T.border}` }}>
            <th style={{ textAlign: "left", padding: 7, whiteSpace: "nowrap" }}>{label}</th>
            {CAPABILITIES.map(([capability]) => <td key={capability} style={{ textAlign: "center", padding: 7 }}>
              <input aria-label={`${label}: ${capability}`} type="checkbox"
                checked={decisions[keyOf("role", role, capability)] === "allow"}
                onChange={event => change("role", role, capability, event.target.checked ? "allow" : "deny")} />
            </td>)}</tr>)}</tbody>
        </table>
      </div>
      <div><strong style={{ fontSize: 12 }}>Excepciones por usuario</strong>
        <div style={{ color: T.txt3, fontSize: 11.5, marginTop: 5 }}>«Heredar» usa el permiso de su rol; «Denegar» prevalece incluso si su rol permite.</div>
        {!activeUsers.length ? <div style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>Aún no hay usuarios activos.</div>
          : <div style={{ maxHeight: 380, overflowY: "auto", display: "grid", gap: 10, marginTop: 10 }}>
            {activeUsers.map(user => <div key={user.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10 }}>
              <strong style={{ fontSize: 12 }}>{user.name}</strong><span style={{ color: T.txt3, fontSize: 11 }}> · {user.role}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8, marginTop: 8 }}>
                {CAPABILITIES.map(([capability, label]) => <label key={capability} style={{ fontSize: 11, color: T.txt2 }}>
                  {label}<select style={{ ...control, width: "100%", marginTop: 4 }}
                    value={decisions[keyOf("user", user.id, capability)] || "inherit"}
                    onChange={event => change("user", user.id, capability, event.target.value)}>
                    <option value="inherit">Heredar del rol</option><option value="allow">Permitir</option><option value="deny">Denegar</option>
                  </select></label>)}
              </div></div>)}
          </div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button style={{ ...control, padding: "0 12px", color: T.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={save} disabled={saving || !version}><Save size={14} />{saving ? "Guardando…" : "Guardar Caja y permisos"}</button>
        <button style={{ ...control, padding: "0 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={reload} disabled={saving}><RefreshCw size={14} />Recargar</button>
      </div>
      <div style={{ color: T.txt3, fontSize: 11.5 }}><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />
        Duke y los clientes con configuración histórica no cambian desde esta pantalla.</div>
    </>}
    {error && <div role="alert" style={{ color: "#FCA5A5", fontSize: 12 }}>{error}</div>}
    {success && <div role="status" style={{ color: T.accent, fontSize: 12 }}>{success}</div>}
  </section>;
}
