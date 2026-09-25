import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Building2, Copy, Eye, EyeOff, FolderOpen, Gauge, KeyRound,
  LayoutDashboard, LogOut, Menu, MessageCircle, Plus, RefreshCw,
  ShieldCheck, Users, Waypoints, X,
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useAuth } from "../../../hooks/useAuth";
import { useIsMobile } from "../../../hooks/useViewport";
import {
  createPlatformPartner, loadTemporaryCredentials, loadWhatsAppAdmin, updatePlatformPartnerQuota,
} from "../../../lib/whatsapp-admin";
import WhatsAppOnboardingAdmin from "./WhatsAppOnboardingAdmin";
import PipelineConfiguratorAdmin from "./PipelineConfiguratorAdmin";
import CatalogConfiguratorAdmin from "./CatalogConfiguratorAdmin";
import CompanySetupAdmin from "./CompanySetupAdmin";

const EMPTY_PARTNER = { name: "", admin_name: "", email: "", company_limit: 100 };

const dateLabel = value => {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
};

function Metric({ icon, label, value, hint, T }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 17, background: T.glass }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: T.txt3, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
        {createElement(icon, { size: 17, color: T.accent })}
      </div>
      <div style={{ color: T.txt, fontFamily: fontDisp, fontSize: 29, fontWeight: 700, marginTop: 10 }}>{value}</div>
      <div style={{ color: T.txt3, fontSize: 11.5, marginTop: 5 }}>{hint}</div>
    </div>
  );
}

function PartnersPanel({ T, data, refresh }) {
  const [form, setForm] = useState(EMPTY_PARTNER);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const partners = data?.partners || [];
  const organizations = data?.organizations || [];
  const input = { width: "100%", minHeight: 42, boxSizing: "border-box", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt, padding: "0 12px", outline: "none", fontFamily: font, fontSize: 12.5 };
  const button = { minHeight: 40, borderRadius: 10, border: `1px solid ${T.accentB}`, background: T.accentS, color: T.accent, padding: "0 14px", fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
  const card = { border: `1px solid ${T.border}`, background: T.glass, borderRadius: 16, padding: 17 };
  const label = { color: T.txt3, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 6 };

  const create = async () => {
    setBusy("create"); setMessage(null); setCredentials(null);
    try {
      const result = await createPlatformPartner(form);
      setCredentials({ email: result.user.email, password: result.temp_password });
      setMessage({ ok: true, text: `${result.partner.name} quedó limitado a ${result.company_limit} empresas. La creación quedó registrada${result.notification_status === "sent" ? " y notificada por Telegram" : "; la alerta de Telegram está pendiente de configuración"}.${result.credential_saved === false ? " Copia la clave ahora porque no pudo guardarse en Accesos temporales." : " Su acceso quedará consultable hasta que cambie la contraseña."}` });
      setForm(EMPTY_PARTNER);
      await refresh();
    } catch (error) { setMessage({ ok: false, text: error.message || "No se pudo crear el partner." }); }
    finally { setBusy(""); }
  };

  const changeQuota = async (partner, value) => {
    setBusy(partner.user_id); setMessage(null);
    try {
      await updatePlatformPartnerQuota(partner.user_id, Number(value));
      setMessage({ ok: true, text: "Cupo actualizado y registrado." });
      await refresh();
    } catch (error) { setMessage({ ok: false, text: error.message || "No se pudo cambiar el cupo." }); }
    finally { setBusy(""); }
  };

  return (
    <div style={{ padding: "22px 24px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div><h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22 }}>Partners y cupos de empresas</h2><p style={{ color: T.txt3, fontSize: 12.5, lineHeight: 1.55, maxWidth: 780 }}>Cada partner recibe un cupo de empresas. Nunca ve los clientes directos de Stratos ni las empresas de otro partner.</p></div>
      {message && <div style={{ ...card, color: message.ok ? T.accent : "#FCA5A5", borderColor: message.ok ? T.accentB : "rgba(248,113,113,.35)" }}>{message.text}</div>}
      {credentials && <div style={{ ...card, borderColor: T.accentB }}><strong>Acceso temporal — cópialo ahora</strong><div style={{ color: T.txt2, marginTop: 8, fontSize: 13 }}>Correo: <code>{credentials.email}</code><br />Contraseña: <code>{credentials.password}</code></div><button onClick={() => setCredentials(null)} style={{ ...button, marginTop: 10 }}>Ya lo guardé</button></div>}
      <section style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}><Plus size={16} color={T.accent} /><strong>Crear administrador partner</strong></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <div><label style={label}>Nombre del partner</label><input style={input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Distribuidor regional" /></div>
          <div><label style={label}>Nombre del administrador</label><input style={input} value={form.admin_name} onChange={e => setForm(p => ({ ...p, admin_name: e.target.value }))} /></div>
          <div><label style={label}>Correo de acceso</label><input style={input} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label style={label}>Cupo de empresas</label><input style={input} type="number" min="1" max="10000" value={form.company_limit} onChange={e => setForm(p => ({ ...p, company_limit: Number(e.target.value) }))} /></div>
        </div>
        <button onClick={create} disabled={busy === "create"} style={{ ...button, marginTop: 13 }}><ShieldCheck size={15} /> Crear partner con acceso aislado</button>
      </section>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Partners activos</strong><span style={{ color: T.txt3, fontSize: 12 }}>{partners.length}</span></div>
        {!partners.length ? <div style={{ color: T.txt3, padding: 14 }}>Todavía no hay partners creados.</div> : partners.map(partner => {
          const scopeId = partner.scope_organization_id;
          const org = partner.organizations || {};
          const profile = partner.profiles || {};
          const used = organizations.filter(item => item.parent_organization_id === scopeId).length;
          return <div key={partner.user_id} style={{ borderTop: `1px solid ${T.border}`, padding: "13px 0", display: "grid", gridTemplateColumns: "minmax(180px,1fr) 120px minmax(180px,240px)", gap: 12, alignItems: "center" }}>
            <div><div style={{ fontWeight: 700 }}>{org.name || "Partner"}</div><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{profile.name || "Administrador"} · {used} empresas creadas</div></div>
            <div style={{ color: T.txt2, fontSize: 12 }}>{used}/{partner.company_limit || 0} cupos</div>
            <div style={{ display: "flex", gap: 7 }}><input data-quota={partner.user_id} style={{ ...input, minHeight: 38 }} type="number" min={Math.max(1, used)} defaultValue={partner.company_limit || 1} /><button disabled={busy === partner.user_id} onClick={e => { const field = e.currentTarget.parentElement.querySelector("input"); changeQuota(partner, field.value); }} style={{ ...button, minHeight: 38 }}>Guardar</button></div>
          </div>;
        })}
      </section>
    </div>
  );
}

function ActivityPanel({ T, events }) {
  const labels = { partner_created: "Partner creado", company_created: "Empresa creada", quota_changed: "Cupo actualizado" };
  return <div style={{ padding: "22px 24px 60px" }}><h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22 }}>Actividad y alertas</h2><p style={{ color: T.txt3, fontSize: 12.5 }}>Registro independiente de Telegram: ningún alta desaparece si el aviso externo falla.</p><div style={{ marginTop: 16, border: `1px solid ${T.border}`, borderRadius: 16, background: T.glass, overflow: "hidden" }}>{!events?.length ? <div style={{ padding: 24, color: T.txt3 }}>Sin eventos todavía.</div> : events.map(event => <div key={event.id} style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}><div><strong style={{ fontSize: 13 }}>{labels[event.event_type] || event.event_type}</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{event.payload?.organization_name || event.payload?.partner_name || "Stratos"} · {dateLabel(event.created_at)}</div></div><span style={{ fontSize: 11.5, color: event.notification_status === "sent" ? T.accent : "#FBBF24" }}>{event.notification_status === "sent" ? "Telegram enviado" : event.notification_status === "not_configured" ? "Telegram por configurar" : event.notification_status}</span></div>)}</div></div>;
}

function TemporaryAccessPanel({ T, credentials, organizations, partners, loading, error }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const [copied, setCopied] = useState("");
  const organizationName = id => organizations?.find(item => item.id === id)?.name
    || partners?.find(item => item.scope_organization_id === id)?.organizations?.name
    || "Administración partner";
  const toggle = id => setRevealed(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const copy = async (credential) => {
    await navigator.clipboard.writeText(`Usuario: ${credential.login_email}\nContraseña temporal: ${credential.temporary_password}`);
    setCopied(credential.user_id);
    setTimeout(() => setCopied(""), 1800);
  };
  return <div style={{ padding: "22px 24px 60px" }}>
    <h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22 }}>Accesos temporales</h2>
    <p style={{ color: T.txt3, fontSize: 12.5, lineHeight: 1.55, maxWidth: 820 }}>
      Aquí aparecen únicamente usuarios que todavía conservan la contraseña inicial. La contraseña está cifrada y su registro desaparece automáticamente cuando la persona la cambia o la recupera.
    </p>
    {error && <div style={{ marginTop: 14, padding: 13, borderRadius: 12, border: "1px solid rgba(248,113,113,.35)", color: "#FCA5A5" }}>{error}</div>}
    <div style={{ marginTop: 16, border: `1px solid ${T.border}`, borderRadius: 16, background: T.glass, overflow: "hidden" }}>
      {loading ? <div style={{ padding: 24, color: T.txt3 }}>Cargando accesos…</div> : !credentials?.length ? <div style={{ padding: 24, color: T.txt3 }}>No hay contraseñas temporales vigentes.</div> : credentials.map(credential => {
        const isVisible = revealed.has(credential.user_id);
        return <div key={credential.user_id} style={{ padding: "15px 16px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, alignItems: "center" }}>
          <div><strong style={{ fontSize: 13 }}>{credential.user_name}</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{organizationName(credential.organization_id)}</div></div>
          <div><div style={{ color: T.txt3, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>Usuario</div><code style={{ color: T.txt2, fontSize: 12 }}>{credential.login_email}</code></div>
          <div><div style={{ color: T.txt3, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>Contraseña temporal</div><code style={{ color: T.txt2, fontSize: 12 }}>{isVisible ? credential.temporary_password : "••••••••••••"}</code></div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => toggle(credential.user_id)} title={isVisible ? "Ocultar contraseña" : "Ver contraseña"} style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.txt2, cursor: "pointer" }}>{isVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            <button onClick={() => copy(credential)} title="Copiar usuario y contraseña" style={{ minWidth: 88, height: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, border: `1px solid ${T.accentB}`, background: T.accentS, color: T.accent, cursor: "pointer", fontWeight: 700, fontSize: 11.5 }}><Copy size={14} /> {copied === credential.user_id ? "Copiado" : "Copiar"}</button>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

export default function PlatformAdminConsole({ initialData }) {
  const { logout, user } = useAuth();
  const isMobile = useIsMobile();
  const T = P;
  const [data, setData] = useState(initialData || null);
  const [section, setSection] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [temporaryCredentials, setTemporaryCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadWhatsAppAdmin()); return true; }
    catch (err) { setError(err.message || "No se pudo cargar la consola."); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!initialData) refresh(); }, [initialData, refresh]);

  const refreshCredentials = useCallback(async () => {
    setCredentialsLoading(true); setCredentialsError("");
    try {
      const result = await loadTemporaryCredentials();
      setTemporaryCredentials(result.credentials || []);
    } catch (err) {
      setCredentialsError(err.message || "No se pudieron cargar los accesos temporales.");
    } finally { setCredentialsLoading(false); }
  }, []);

  const root = data?.access?.root === true;
  const used = Number(data?.access?.companiesUsed || 0);
  const limit = data?.access?.companyLimit;
  const nav = useMemo(() => [
    ["home", "Resumen", LayoutDashboard], ["companies", "Empresas y WhatsApp", Building2],
    ["credentials", "Accesos temporales", KeyRound], ["pipelines", "Pipelines", Waypoints], ["catalogs", "Catálogos", FolderOpen],
    ...(root ? [["setup", "Módulos y licencias", ShieldCheck], ["partners", "Partners y cupos", Users], ["activity", "Actividad", Activity]] : []),
  ], [root]);
  const choose = id => { setSection(id); setMenuOpen(false); if (id === "credentials") refreshCredentials(); };

  const content = section === "companies" ? <WhatsAppOnboardingAdmin T={T} />
    : section === "credentials" ? <TemporaryAccessPanel T={T} credentials={temporaryCredentials} organizations={data?.organizations || []} partners={data?.partners || []} loading={credentialsLoading} error={credentialsError} />
    : section === "pipelines" ? <PipelineConfiguratorAdmin T={T} onBack={() => choose("home")} />
      : section === "catalogs" ? <CatalogConfiguratorAdmin T={T} onBack={() => choose("home")} />
        : section === "setup" && root ? <CompanySetupAdmin T={T} data={data} refresh={refresh} />
        : section === "partners" && root ? <PartnersPanel T={T} data={data} refresh={refresh} />
          : section === "activity" && root ? <ActivityPanel T={T} events={data?.events || []} />
            : <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div><div style={{ color: T.accent, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em" }}>{root ? "Superadministración Stratos" : "Administración partner"}</div><h1 style={{ margin: "6px 0 0", fontFamily: fontDisp, fontSize: 28 }}>Centro de soporte</h1><p style={{ color: T.txt3, fontSize: 13, maxWidth: 720, lineHeight: 1.55 }}>Empresas, usuarios, WhatsApp, pipelines y catálogos en una consola sin módulos comerciales que distraigan.</p></div>
              {error && <div style={{ padding: 14, border: "1px solid rgba(248,113,113,.35)", borderRadius: 13, color: "#FCA5A5" }}>{error}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
                <Metric T={T} icon={Building2} label="Empresas visibles" value={data?.organizations?.length || 0} hint={root ? "Todo el portafolio administrado" : "Solo tus empresas cliente"} />
                {root ? <Metric T={T} icon={Users} label="Partners" value={data?.partners?.length || 0} hint="Administradores con alcance aislado" /> : <Metric T={T} icon={Gauge} label="Cupos de empresa" value={`${used}/${limit || 0}`} hint={`${Math.max(0, Number(limit || 0) - used)} disponibles`} />}
                <Metric T={T} icon={MessageCircle} label="Altas WhatsApp" value={data?.runs?.length || 0} hint="Procesos visibles en tu alcance" />
                {root && <Metric T={T} icon={Activity} label="Eventos recientes" value={data?.events?.length || 0} hint="Altas y cambios auditados" />}
              </div>
              {!root && limit != null && used >= limit && <div style={{ padding: 15, borderRadius: 14, border: "1px solid rgba(245,158,11,.35)", background: "rgba(245,158,11,.06)", color: "#FBBF24", fontSize: 13 }}>Ya utilizaste todos tus cupos de empresa. Stratos debe ampliar el límite antes de crear otra.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>{nav.filter(([id]) => id !== "home").map(([id, label, icon]) => <button key={id} onClick={() => choose(id)} style={{ border: `1px solid ${T.border}`, borderRadius: 16, background: T.glass, color: T.txt, padding: 18, textAlign: "left", cursor: "pointer", fontFamily: font }}>{createElement(icon, { size: 19, color: T.accent })}<div style={{ fontWeight: 750, marginTop: 13 }}>{label}</div><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 5 }}>Abrir sección</div></button>)}</div>
            </div>;

  return <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: T.bg, color: T.txt, fontFamily: font, display: "flex", overflow: "hidden" }}>
    {isMobile && <button onClick={() => setMenuOpen(v => !v)} style={{ position: "fixed", top: 14, left: 14, zIndex: 10003, width: 42, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, color: T.txt, display: "grid", placeItems: "center" }}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>}
    <aside style={{ width: 248, flexShrink: 0, padding: "22px 14px", borderRight: `1px solid ${T.border}`, background: "#050B14", display: isMobile && !menuOpen ? "none" : "flex", flexDirection: "column", position: isMobile ? "fixed" : "relative", inset: isMobile ? 0 : "auto", zIndex: 10002 }}>
      <div style={{ padding: "4px 10px 22px" }}><div style={{ color: T.accent, fontWeight: 800, letterSpacing: ".04em" }}>STRATOS</div><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{root ? "Superadministrador" : "Administrador partner"}</div></div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 5 }}>{nav.map(([id, label, icon]) => <button key={id} onClick={() => choose(id)} style={{ minHeight: 43, borderRadius: 11, border: `1px solid ${section === id ? T.accentB : "transparent"}`, background: section === id ? T.accentS : "transparent", color: section === id ? T.accent : T.txt2, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", cursor: "pointer", fontFamily: font, fontWeight: 650, textAlign: "left" }}>{createElement(icon, { size: 16 })}{label}</button>)}</nav>
      <div style={{ marginTop: "auto", borderTop: `1px solid ${T.border}`, paddingTop: 14 }}><div style={{ padding: "0 10px 12px", color: T.txt3, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || user?.name}</div><button onClick={logout} style={{ width: "100%", minHeight: 41, borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.txt2, display: "flex", alignItems: "center", gap: 9, padding: "0 12px", cursor: "pointer" }}><LogOut size={15} /> Cerrar sesión</button></div>
    </aside>
    <main style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingTop: isMobile ? 68 : 0 }}>
      <div style={{ minHeight: 62, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px 0 66px" : "0 24px" }}><div><strong style={{ fontSize: 13.5 }}>{nav.find(([id]) => id === section)?.[1] || "Centro de soporte"}</strong><div style={{ color: T.txt3, fontSize: 10.5, marginTop: 3 }}>{root ? "Control total de Stratos" : `${used} de ${limit || 0} empresas utilizadas`}</div></div><button onClick={refresh} disabled={loading} style={{ minHeight: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, padding: "0 12px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}><RefreshCw size={14} />{!isMobile && "Actualizar"}</button></div>
      {content}
    </main>
  </div>;
}
