import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Building2, CheckCircle2, ExternalLink, FileSpreadsheet,
  FolderOpen, HardDrive, Loader2, RefreshCw, Search, ShieldCheck,
} from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { useIsMobile } from "../../../hooks/useViewport";
import {
  importOrganizationCatalog,
  loadOrganizationCatalog,
  loadWhatsAppAdmin,
  previewOrganizationCatalog,
} from "../../../lib/whatsapp-admin";

const fmtDate = (value) => {
  if (!value) return "Todavía no se ha importado";
  try { return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
};

export default function CatalogConfiguratorAdmin({ T, onBack }) {
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  const input = {
    width: "100%", minHeight: 42, padding: "0 12px", borderRadius: 10,
    border: `1px solid ${T.border}`, background: T.glass, color: T.txt,
    fontSize: 12.5, fontFamily: font, outline: "none", boxSizing: "border-box",
  };
  const card = { border: `1px solid ${T.border}`, background: T.glass, borderRadius: 16 };
  const button = {
    minHeight: 40, borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.glass, color: T.txt2, fontFamily: font, fontSize: 12.5,
    fontWeight: 600, padding: "0 14px", cursor: "pointer", display: "inline-flex",
    alignItems: "center", justifyContent: "center", gap: 7,
  };

  const loadOrganizations = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const data = await loadWhatsAppAdmin();
      const rows = data?.organizations || [];
      setOrganizations(rows);
      setSelectedId(current => current || rows[0]?.id || "");
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudieron cargar las empresas." });
    } finally { setLoading(false); }
  }, []);

  const loadCatalog = useCallback(async (organizationId) => {
    if (!organizationId) return;
    setBusy("load"); setMessage(null); setPreview(null);
    try {
      const data = await loadOrganizationCatalog(organizationId);
      setCatalog(data);
      setSourceUrl(data?.catalog?.sourceUrl || "");
      setOrganizations(current => current.map(org => org.id === organizationId
        ? { ...org, meta_config: { ...(org.meta_config || {}), catalog: data?.catalog || null } }
        : org));
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo cargar el catálogo." });
    } finally { setBusy(""); }
  }, []);

  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => { if (selectedId) loadCatalog(selectedId); }, [selectedId, loadCatalog]);

  const selectedOrg = organizations.find(org => org.id === selectedId);
  const filteredOrganizations = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es");
    return organizations.filter(org => !q || org.name?.toLocaleLowerCase("es").includes(q));
  }, [organizations, search]);

  const analyze = async () => {
    setBusy("preview"); setMessage(null); setPreview(null);
    try {
      const data = await previewOrganizationCatalog(selectedId, sourceUrl.trim());
      setPreview({ ...data, sourceUrl: sourceUrl.trim() });
      setMessage({ type: "success", text: `Archivo leído correctamente: ${data.summary.total} proyectos listos para revisar.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo leer el archivo." });
    } finally { setBusy(""); }
  };

  const publish = async () => {
    setBusy("publish"); setMessage(null);
    try {
      const data = await importOrganizationCatalog(selectedId, preview.sourceUrl);
      setPreview(null);
      await loadCatalog(selectedId);
      const pendingDrive = Math.max(0, Number(data.total || 0) - Number(data.with_drive || 0));
      const pendingText = pendingDrive
        ? ` ${pendingDrive} fila${pendingDrive === 1 ? " quedó" : "s quedaron"} guardada${pendingDrive === 1 ? "" : "s"}, pero no aparecerá${pendingDrive === 1 ? "" : "n"} en Proyectos hasta tener enlace de Drive.`
        : "";
      setMessage({ type: "success", text: `Catálogo publicado en ${selectedOrg?.name}: ${data.total} proyectos, ${data.with_drive} con Drive. Los proyectos con Drive ya aparecen en Proyectos y el catálogo de esa empresa queda disponible para el Copilot.${pendingText}` });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo publicar el catálogo." });
    } finally { setBusy(""); }
  };

  return (
    <div style={{ padding: isMobile ? "12px 10px 48px" : "22px 24px 60px", color: T.txt, fontFamily: font, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <button onClick={onBack} style={{ ...button, marginBottom: 16, background: "transparent" }}><ArrowLeft size={14} /> Usuarios</button>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: fontDisp, fontSize: 22, fontWeight: 650 }}>Catálogos y Drives por empresa</h2>
          <p style={{ color: T.txt3, fontSize: 12.5, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.55 }}>Pega el enlace público del Excel o Google Sheet. Stratos lo revisa antes de publicar y lo limita a la empresa seleccionada.</p>
        </div>
        <button onClick={() => loadCatalog(selectedId)} disabled={!selectedId || busy === "load"} style={button}><RefreshCw size={14} /> Actualizar</button>
      </div>

      {message && <div style={{ ...card, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 9, color: message.type === "success" ? T.accent : "#FCA5A5", borderColor: message.type === "success" ? T.accentB : "rgba(248,113,113,.35)" }}>{message.type === "success" ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}<span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{message.text}</span></div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(230px,290px) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <aside style={{ ...card, padding: 14, position: isMobile ? "static" : "sticky", top: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><Building2 size={16} color={T.accent} /><strong style={{ fontSize: 13.5 }}>Empresa</strong><span style={{ marginLeft: "auto", color: T.txt3, fontSize: 11.5 }}>{organizations.length}</span></div>
          <div style={{ position: "relative", marginBottom: 10 }}><Search size={13} color={T.txt3} style={{ position: "absolute", left: 11, top: 14 }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa…" style={{ ...input, paddingLeft: 32 }} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: isMobile ? 240 : "64vh", overflowY: "auto" }}>
            {loading ? <div style={{ padding: 18, color: T.txt3, fontSize: 12 }}>Cargando…</div> : filteredOrganizations.map(org => {
              const active = org.id === selectedId;
              return <button key={org.id} onClick={() => setSelectedId(org.id)} style={{ border: `1px solid ${active ? T.accentB : T.border}`, background: active ? T.accentS : "transparent", borderRadius: 11, padding: "10px 11px", color: active ? T.accent : T.txt2, cursor: "pointer", textAlign: "left", fontFamily: font }}><div style={{ fontSize: 12.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</div><div style={{ color: T.txt3, fontSize: 10.5, marginTop: 3 }}>{org.meta_config?.catalog?.total ? `${org.meta_config.catalog.total} proyectos importados` : "Sin importación administrada"}</div></button>;
            })}
          </div>
        </aside>

        <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <section style={{ ...card, padding: 17 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div><div style={{ fontFamily: fontDisp, fontWeight: 700 }}>{selectedOrg?.name || "Selecciona una empresa"}</div><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{catalog?.total || 0} proyectos visibles actualmente · última importación: {fmtDate(catalog?.catalog?.importedAt)}</div></div>
              <FolderOpen size={19} color={T.accent} />
            </div>
          </section>

          <section style={{ ...card, padding: 17 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><FileSpreadsheet size={17} color={T.accent} /><strong>1. Pegar el catálogo</strong></div>
            <p style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.55, margin: "0 0 12px" }}>Acepta Google Sheets, archivos de Google Drive, OneDrive y SharePoint. Debe estar compartido como “cualquiera con el enlace puede ver”. No pegues contraseñas ni enlaces privados.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={sourceUrl} onChange={event => { setSourceUrl(event.target.value); setPreview(null); }} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ ...input, flex: "1 1 360px" }} /><button onClick={analyze} disabled={!selectedId || !sourceUrl.trim() || busy === "preview"} style={{ ...button, color: T.accent, borderColor: T.accentB, background: T.accentS }}>{busy === "preview" ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Analizar enlace</button></div>
          </section>

          {preview && <section style={{ ...card, padding: 17 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}><div><strong>2. Revisar antes de publicar</strong><div style={{ color: T.txt3, fontSize: 11.5, marginTop: 4 }}>{preview.summary.total} proyectos · {preview.summary.with_drive} con Drive · {preview.summary.sheets.length} pestañas leídas{preview.summary.truncated ? " · se aplicó el máximo de 2.500 filas" : ""}</div><div style={{ color: T.txt3, fontSize: 10.5, marginTop: 4 }}>Solo los proyectos con enlace de Drive se muestran en Proyectos; las demás filas quedan guardadas para completar después.</div></div><button onClick={publish} disabled={busy === "publish"} style={{ ...button, color: T.accent, borderColor: T.accentB, background: T.accentS }}>{busy === "publish" ? <Loader2 size={14} className="spin" /> : <HardDrive size={14} />} Publicar en {selectedOrg?.name}</button></div>
            <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 12 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}><thead><tr>{["Proyecto","Ubicación","Precio / ticket","Pestaña","Drive"].map(label => <th key={label} style={{ padding: 10, color: T.txt3, fontSize: 10.5, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>{label}</th>)}</tr></thead><tbody>{preview.sample.map((row, index) => <tr key={`${row.desarrollo}-${index}`}><td style={{ padding: 10, fontSize: 12, color: T.txt, borderBottom: `1px solid ${T.border}` }}>{row.desarrollo}</td><td style={{ padding: 10, fontSize: 12, color: T.txt2, borderBottom: `1px solid ${T.border}` }}>{row.ubicacion || row.zona || "—"}</td><td style={{ padding: 10, fontSize: 12, color: T.txt2, borderBottom: `1px solid ${T.border}` }}>{row.ticket || "—"}</td><td style={{ padding: 10, fontSize: 12, color: T.txt2, borderBottom: `1px solid ${T.border}` }}>{row.seccion_nombre}</td><td style={{ padding: 10, borderBottom: `1px solid ${T.border}` }}>{row.drive ? <a href={row.drive} target="_blank" rel="noreferrer" style={{ color: T.accent, display: "inline-flex", alignItems: "center", gap: 4 }}><ExternalLink size={12} /> Abrir</a> : <span style={{ color: T.txt3, fontSize: 12 }}>Pendiente</span>}</td></tr>)}</tbody></table></div>
            <p style={{ color: T.txt3, fontSize: 11.5, lineHeight: 1.55, margin: "12px 0 0" }}>Al publicar, la carga anterior queda oculta pero se conserva para reversa. Las propiedades añadidas manualmente en el CRM permanecen visibles.</p>
          </section>}
        </main>
      </div>
    </div>
  );
}
