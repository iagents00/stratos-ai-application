import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Building2, CheckCircle2, CircleAlert, ExternalLink,
  Loader2, MessageCircle, Plus, RefreshCw, ShieldCheck, Users,
} from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { useClient } from "../../../hooks/useClient";
import { MANAGED_TENANT_FEATURES, managedTenantFeatures } from "../../../clients/tenant/managed-features";
import {
  approveWhatsAppTests, completeWhatsAppSignup, createWhatsAppOnboardingRun,
  createWhatsAppOrganization, createWhatsAppTenantUser, loadWhatsAppAdmin,
  retryWhatsAppShare, verifyInfobipPortalSender,
} from "../../../lib/whatsapp-admin";
import { isSignupConfigured, launchWhatsAppSignup } from "../../../lib/whatsapp-signup";

const STATUS = {
  draft: ["Borrador", "#94A3B8"],
  waiting_customer: ["Esperando al cliente", "#F59E0B"],
  meta_finished: ["Meta terminado", "#38BDF8"],
  infobip_registering: ["Registrando en Infobip", "#A78BFA"],
  ready_to_test: ["Listo para probar", "#22D3EE"],
  active: ["Activo", "#6EE7C2"],
  failed: ["Requiere atención", "#F87171"],
  disconnected: ["Desconectado", "#94A3B8"],
};

const EMPTY_ORG = { name: "", slug: "", seats: 30, features: managedTenantFeatures() };
const EMPTY_USER = { organization_id: "", name: "", email: "", role: "admin" };
const EMPTY_CHANNEL = { organization_id: "", advisor_id: "", owner_type: "company", owner_name: "", phone_e164: "" };
const INFOBIP_SENDERS_URL = "https://portal.infobip.com/channels-and-numbers/channels/whatsapp/senders";
const TENANT_LOGIN_PATH = "/tenant";
const slugify = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

function StatusPill({ status }) {
  const [label, color] = STATUS[status] || [status || "Sin estado", "#94A3B8"];
  return <span style={{ color, border: `1px solid ${color}45`, background: `${color}12`, borderRadius: 99, padding: "4px 9px", fontSize: 11.5, whiteSpace: "nowrap" }}>{label}</span>;
}

export default function WhatsAppOnboardingAdmin({ T, onBack }) {
  const { config } = useClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orgForm, setOrgForm] = useState(EMPTY_ORG);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [channelForm, setChannelForm] = useState(EMPTY_CHANNEL);
  const [credentials, setCredentials] = useState(null);
  const [testRun, setTestRun] = useState(null);
  const [checks, setChecks] = useState({ inbound: false, outbound: false, media: false, isolation: false });

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadWhatsAppAdmin()); }
    catch (err) { setError(err.message || "No se pudo cargar la consola."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const organizations = data?.organizations || [];
  const profiles = useMemo(() => data?.profiles || [], [data?.profiles]);
  const runs = data?.runs || [];
  const configured = isSignupConfigured(config);
  const providerReady = configured && data?.provider?.infobipConfigured;
  const missingSetup = [
    !config?.meta?.appId && "Meta App ID",
    !config?.meta?.configId && "Meta Configuration ID",
    !config?.meta?.solutionId && "solutionID de Infobip",
    !data?.provider?.infobipConfigured && "clave API de Infobip",
  ].filter(Boolean);
  const selectedProfiles = useMemo(
    () => profiles.filter(p => p.organization_id === channelForm.organization_id && p.active !== false),
    [profiles, channelForm.organization_id],
  );

  const input = {
    width: "100%", minHeight: 42, padding: "0 12px", borderRadius: 10,
    border: `1px solid ${T.border}`, background: T.glass, color: T.txt,
    fontSize: 12.5, fontFamily: font, outline: "none", boxSizing: "border-box",
  };
  const card = { border: `1px solid ${T.border}`, background: T.glass, borderRadius: 16, padding: 18 };
  const label = { color: T.txt3, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6, display: "block" };
  const button = { border: `1px solid ${T.accentB}`, background: T.accentS, color: T.accent, borderRadius: 10, minHeight: 40, padding: "0 15px", fontFamily: font, fontSize: 12.5, fontWeight: 650, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };

  const runAction = async (key, fn, message) => {
    setBusy(key); setError(""); setSuccess("");
    try { const result = await fn(); setSuccess(typeof message === "function" ? message(result) : message); await refresh(); return result; }
    catch (err) { setError(err.message || "No se pudo completar la acción."); return null; }
    finally { setBusy(""); }
  };

  const createOrg = () => runAction("org", async () => {
    const result = await createWhatsAppOrganization({ ...orgForm, features: data?.access?.root ? orgForm.features : undefined, slug: orgForm.slug || slugify(orgForm.name) });
    setOrgForm(EMPTY_ORG);
    setUserForm(p => ({ ...p, organization_id: result.organization.id }));
    setChannelForm(p => ({ ...p, organization_id: result.organization.id }));
    return result;
  }, result => `${result.organization.name} creada con ${result.organization.seats} licencias. Ahora crea su administrador; el acceso neutral será ${TENANT_LOGIN_PATH}.`);

  const createUser = () => runAction("user", async () => {
    const result = await createWhatsAppTenantUser(userForm);
    setCredentials({ email: result.user.email, password: result.temp_password });
    setUserForm(p => ({ ...EMPTY_USER, organization_id: p.organization_id }));
    return result;
  }, result => result.credential_saved === false
    ? "Usuario creado. Copia la clave ahora: no pudo guardarse en Accesos temporales."
    : "Usuario creado. También podrás consultar este acceso hasta que la persona cambie su contraseña.");

  const selectedUserOrganization = organizations.find(org => org.id === userForm.organization_id);
  const selectedUserCount = userForm.organization_id
    ? profiles.filter(profile => profile.organization_id === userForm.organization_id && profile.active !== false).length
    : 0;
  const selectedSeatLimit = Number(selectedUserOrganization?.seats || 0);
  const noSeatsAvailable = !!selectedUserOrganization && selectedUserCount >= selectedSeatLimit;

  const connect = async () => {
    if (!providerReady) { setError("Primero hay que completar las aprobaciones de Meta y configurar Infobip en el servidor."); return; }
    const created = await runAction("channel", () => createWhatsAppOnboardingRun(channelForm), "Proceso creado. Completa ahora la ventana de Meta.");
    if (!created?.run) return;
    setBusy("meta"); setError("");
    try {
      const meta = await launchWhatsAppSignup({
        appId: config.meta.appId,
        configId: config.meta.configId,
        solutionId: config.meta.solutionId,
      });
      await completeWhatsAppSignup({ run_id: created.run.id, waba_id: meta.wabaId, phone_number_id: meta.phoneNumberId });
      setSuccess("Meta terminó. Infobip está registrando el número; la pantalla se actualizará con su webhook.");
      setChannelForm(p => ({ ...EMPTY_CHANNEL, organization_id: p.organization_id }));
      await refresh();
    } catch (err) {
      if (err?.reason !== "cancelled") setError(err.message || "No se pudo completar el alta.");
    } finally { setBusy(""); }
  };

  const startQuickRegistration = async () => {
    if (!data?.provider?.portalRegistrationReady) {
      setError("Falta configurar la clave API de Infobip en el servidor para poder verificar el número.");
      return;
    }
    if (!channelForm.organization_id || !channelForm.phone_e164.trim()) {
      setError("Selecciona la empresa y escribe el número completo con código de país.");
      return;
    }
    const portalWindow = window.open("", "_blank");
    if (portalWindow) portalWindow.opener = null;
    const created = await runAction("quick-channel", () => createWhatsAppOnboardingRun({
      ...channelForm,
      registration_mode: "infobip_portal",
    }), "Proceso guardado. Completa el registro en Infobip y después pulsa Verificar en Infobip.");
    if (!created?.run) { portalWindow?.close(); return; }
    if (portalWindow) portalWindow.location.href = INFOBIP_SENDERS_URL;
    else setSuccess("Proceso guardado. Tu navegador bloqueó la pestaña; usa “Abrir registro” en Procesos recientes y luego vuelve a verificar.");
    setChannelForm(p => ({ ...EMPTY_CHANNEL, organization_id: p.organization_id }));
  };

  const approve = () => runAction("approve", () => approveWhatsAppTests(testRun.id, checks), "Canal activado después de verificar las cuatro pruebas.").then(() => { setTestRun(null); setChecks({ inbound: false, outbound: false, media: false, isolation: false }); });

  return (
    <div style={{ padding: "22px 24px 60px", color: T.txt, fontFamily: font, overflowY: "auto" }}>
      {onBack && <button onClick={onBack} style={{ ...button, marginBottom: 16, background: "transparent", color: T.txt2, borderColor: T.border }}><ArrowLeft size={14} /> Volver</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22, fontWeight: 650 }}>Alta de empresas y WhatsApp</h2>
          <p style={{ color: T.txt3, fontSize: 12.5, margin: "6px 0 0", maxWidth: 720 }}>Crea el tenant, incorpora su equipo y conecta números por coexistencia sin mezclar activos con Duke.</p>
        </div>
        <button onClick={refresh} disabled={loading} style={button}><RefreshCw size={14} /> Actualizar</button>
      </div>

      {!providerReady && (
        <div style={{ ...card, marginBottom: 16, display: "flex", gap: 12, borderColor: "rgba(245,158,11,.35)", background: "rgba(245,158,11,.06)" }}>
          <CircleAlert size={19} color="#F59E0B" style={{ flexShrink: 0 }} />
          <div><strong style={{ fontSize: 13 }}>El alta automática espera el solutionID; el piloto rápido sí está disponible.</strong><div style={{ color: T.txt2, fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>Pendiente para automatizar: {missingSetup.join(", ") || "aprobación de Tech Provider/Partner Solution"}. Mientras tanto usa “Registro rápido con Infobip”: abre el portal oficial, haces el QR y Stratos verifica y asigna el número.</div></div>
        </div>
      )}
      {error && <div style={{ ...card, marginBottom: 14, color: "#FCA5A5", borderColor: "rgba(248,113,113,.35)" }}>{error}</div>}
      {success && <div style={{ ...card, marginBottom: 14, color: T.accent, borderColor: T.accentB }}>{success}</div>}

      {!data?.access?.root && data?.access?.companyLimit != null && <div style={{ ...card, marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><strong style={{ fontSize: 13 }}>Cupos de empresas</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>Cada empresa nueva consume un cupo; los usuarios internos se controlan por separado.</div></div><div style={{ color: T.accent, fontFamily: fontDisp, fontSize: 20, fontWeight: 750 }}>{data.access.companiesUsed || 0}/{data.access.companyLimit}</div></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 14, marginBottom: 18 }}>
        <section style={card}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 14 }}><Building2 size={17} color={T.accent} /><strong>1. Crear empresa</strong></div>
          <label style={label}>Nombre de la empresa</label><input style={input} value={orgForm.name} onChange={e => { const name = e.target.value; setOrgForm(p => ({ ...p, name, slug: slugify(name) })); }} placeholder="Inmobiliaria Horizonte" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 9, marginTop: 10 }}><div><label style={label}>Identificador automático</label><input style={{ ...input, opacity: .72 }} value={orgForm.slug} readOnly placeholder="se genera con el nombre" /></div><div><label style={label}>Usuarios incluidos</label><input style={input} type="number" min="1" max="1000" value={orgForm.seats} onChange={e => setOrgForm(p => ({ ...p, seats: Number(e.target.value) }))} /></div></div>
          {data?.access?.root && <div style={{ marginTop: 12 }}><div style={label}>Módulos iniciales</div>{MANAGED_TENANT_FEATURES.map(item => <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 12.5, color: T.txt2 }}><input type="checkbox" checked={orgForm.features[item.key]} onChange={e => setOrgForm(p => ({ ...p, features: { ...p.features, [item.key]: e.target.checked } }))} />{item.label}</label>)}<div style={{ color: T.txt3, fontSize: 11, marginTop: 8 }}>CRM incluido. WhatsApp, Caja y Copilot se preparan aparte.</div></div>}
          <div style={{ color: T.txt3, fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>No necesitas crear una URL. El equipo entrará por <strong style={{ color: T.txt2 }}>{TENANT_LOGIN_PATH}</strong>; al iniciar sesión, Stratos abre únicamente su empresa. Cada usuario activo consume una licencia, incluido el administrador.</div>
          <button onClick={createOrg} disabled={busy === "org" || (!data?.access?.root && data?.access?.companyLimit != null && data.access.companiesUsed >= data.access.companyLimit)} style={{ ...button, width: "100%", marginTop: 13, opacity: (!data?.access?.root && data?.access?.companyLimit != null && data.access.companiesUsed >= data.access.companyLimit) ? .5 : 1 }}>{busy === "org" ? <Loader2 size={14} /> : <Plus size={14} />} Crear empresa</button>
        </section>

        <section style={card}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 14 }}><Users size={17} color={T.accent} /><strong>2. Crear usuario</strong></div>
          <label style={label}>Empresa donde se creará</label><select style={input} value={userForm.organization_id} onChange={e => setUserForm(p => ({ ...p, organization_id: e.target.value }))}><option value="">Seleccionar…</option>{organizations.map(o => { const used = profiles.filter(profile => profile.organization_id === o.id && profile.active !== false).length; return <option key={o.id} value={o.id}>{o.name} — {used}/{o.seats || 0} licencias</option>; })}</select>
          {selectedUserOrganization && <div style={{ color: noSeatsAvailable ? "#FCA5A5" : T.txt3, fontSize: 11, lineHeight: 1.5, marginTop: 7 }}>{noSeatsAvailable ? `Sin licencias disponibles en ${selectedUserOrganization.name}. Amplía el límite antes de crear otro usuario.` : `Se creará dentro de ${selectedUserOrganization.name}. Quedan ${Math.max(0, selectedSeatLimit - selectedUserCount)} de ${selectedSeatLimit} licencias.`}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}><div><label style={label}>Nombre</label><input style={input} value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} /></div><div><label style={label}>Rol</label><select style={input} value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}><option value="admin">Administrador</option><option value="director">Director</option><option value="asesor">Asesor</option></select></div></div>
          <label style={{ ...label, marginTop: 10 }}>Correo</label><input style={input} type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
          <button onClick={createUser} disabled={busy === "user" || noSeatsAvailable} style={{ ...button, width: "100%", marginTop: 13, opacity: noSeatsAvailable ? .5 : 1 }}>{busy === "user" ? <Loader2 size={14} /> : <Plus size={14} />} Crear usuario en {selectedUserOrganization?.name || "empresa"}</button>
        </section>

        <section style={card}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 14 }}><MessageCircle size={17} color={T.accent} /><strong>3. Conectar número</strong></div>
          <label style={label}>Empresa</label><select style={input} value={channelForm.organization_id} onChange={e => setChannelForm(p => ({ ...p, organization_id: e.target.value, advisor_id: "" }))}><option value="">Seleccionar…</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}><div><label style={label}>Propietario</label><select style={input} value={channelForm.owner_type} onChange={e => setChannelForm(p => ({ ...p, owner_type: e.target.value }))}><option value="company">Empresa</option><option value="advisor">Asesor</option></select></div><div><label style={label}>Asignar a</label><select style={input} value={channelForm.advisor_id} onChange={e => setChannelForm(p => ({ ...p, advisor_id: e.target.value }))}><option value="">Sin asignar</option>{selectedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
          <label style={{ ...label, marginTop: 10 }}>Número internacional</label><input style={input} value={channelForm.phone_e164} onChange={e => setChannelForm(p => ({ ...p, phone_e164: e.target.value }))} placeholder="+57 300 123 4567" />
          <button onClick={startQuickRegistration} disabled={!data?.provider?.portalRegistrationReady || busy === "quick-channel"} style={{ ...button, width: "100%", marginTop: 13, opacity: data?.provider?.portalRegistrationReady ? 1 : .5 }}>{busy === "quick-channel" ? <Loader2 size={14} /> : <ExternalLink size={14} />} Registro rápido con Infobip</button>
          <div style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.5, marginTop: 8 }}>Abre directamente WhatsApp → Remitentes en Infobip. Pulsa “Registrar remitente”, elige coexistencia, escanea el QR y selecciona “Don’t share chats”. Si debes iniciar sesión, Infobip te devolverá automáticamente a Remitentes.</div>
          <button onClick={connect} disabled={!providerReady || busy === "meta" || busy === "channel"} style={{ ...button, width: "100%", marginTop: 10, background: "transparent", borderColor: T.border, color: T.txt2, opacity: providerReady ? 1 : .5 }}>{busy === "meta" || busy === "channel" ? <Loader2 size={14} /> : <ExternalLink size={14} />} Alta automática Stratos</button>
        </section>
      </div>

      {credentials && <div style={{ ...card, marginBottom: 18, borderColor: T.accentB }}><strong>Credenciales temporales — cópialas ahora</strong><div style={{ marginTop: 8, color: T.txt2, fontSize: 13 }}>Correo: <code>{credentials.email}</code><br />Contraseña: <code>{credentials.password}</code></div><button onClick={() => setCredentials(null)} style={{ ...button, marginTop: 10 }}>Ya las guardé</button></div>}

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}><div><strong>Procesos recientes</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 3 }}>{runs.length} altas registradas</div></div><ShieldCheck size={18} color={T.accent} /></div>
        {loading ? <div style={{ color: T.txt3, padding: 16 }}>Cargando…</div> : runs.length === 0 ? <div style={{ color: T.txt3, padding: 16 }}>Todavía no hay procesos.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runs.map(run => {
              const org = organizations.find(o => o.id === run.organization_id);
              const advisor = profiles.find(p => p.id === run.advisor_id);
              return <div key={run.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div><div style={{ fontWeight: 650, fontSize: 13 }}>{org?.name || "Empresa"} · {run.phone_e164 || "Número por confirmar"}</div><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{advisor?.name || "Sin asignar"}{run.last_error ? ` · ${run.last_error}` : ""}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><StatusPill status={run.status} />{run.status === "waiting_customer" && run.provider_state?.mode === "infobip_portal" && <><a href={INFOBIP_SENDERS_URL} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", background: "transparent", borderColor: T.border, color: T.txt2 }}><ExternalLink size={14} /> 1. Abrir registro</a><button onClick={() => runAction(`verify-${run.id}`, () => verifyInfobipPortalSender(run.id), "Infobip confirmó el remitente. Ahora ejecuta las cuatro pruebas reales.")} style={button}>2. Verificar en Infobip</button></>}{run.status === "failed" && run.waba_id && <button onClick={() => runAction(`retry-${run.id}`, () => retryWhatsAppShare(run.id), "Reintento enviado a Infobip.")} style={button}>Reintentar</button>}{run.status === "ready_to_test" && <button onClick={() => setTestRun(run)} style={button}><CheckCircle2 size={14} /> Verificar pruebas</button>}</div>
              </div>;
            })}
          </div>
        )}
      </section>

      {testRun && <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 18 }}><div style={{ ...card, width: "min(520px,100%)", background: T.bg }}><h3 style={{ margin: "0 0 6px" }}>Prueba final del canal</h3><p style={{ color: T.txt3, fontSize: 12.5, lineHeight: 1.55 }}>Confirma únicamente después de hacer pruebas reales. El canal no se activa con el estado de registro solamente.</p>{[["inbound","Mensaje entrante llegó al CRM"],["outbound","Respuesta del CRM llegó al teléfono"],["media","Imagen o audio funcionó"],["isolation","El mensaje quedó en la empresa correcta"]].map(([key,text]) => <label key={key} style={{ display: "flex", gap: 9, alignItems: "center", padding: "8px 0", fontSize: 13 }}><input type="checkbox" checked={checks[key]} onChange={e => setChecks(p => ({ ...p, [key]: e.target.checked }))} />{text}</label>)}<div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}><button onClick={() => setTestRun(null)} style={{ ...button, background: "transparent", borderColor: T.border, color: T.txt2 }}>Cancelar</button><button onClick={approve} disabled={busy === "approve"} style={button}>Activar canal</button></div></div></div>}
    </div>
  );
}
