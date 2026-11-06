import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ShieldCheck, Plus, Pencil, Trash2, X, Eye, Download, ExternalLink, Upload } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { documentFileExtension, leadDocuments } from '../../../lib/lead-documents.mjs';
import { P, font } from '../../../design-system/tokens';

export default function LeadDocuments({ lead, onUpdate, T = P, isLight = false }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState(() => leadDocuments(lead));
  const [draft, setDraft] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [viewer, setViewer] = useState(null);
  const active = useRef(true);
  const viewerClose = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setDocuments(leadDocuments(lead)); }, [lead.documents, lead.id_document, lead.id_document_path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!viewer) return;
    const previous = document.activeElement;
    viewerClose.current?.focus();
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setViewer(null); } };
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('keydown', escape, true); previous?.focus?.(); };
  }, [!!viewer]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDemo = user?.isDemo || !/^[0-9a-f]{8}-/i.test(String(lead.id));
  const accent = isLight ? (T.accentDark || T.accent) : T.accent;
  const input = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 11px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.bg, color: T.txt, fontFamily: font, fontSize: 13 };
  const button = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 34, padding: '6px 9px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.txt2, font: 'inherit', fontSize: 12, cursor: 'pointer' };
  const label = { display: 'grid', gap: 5, color: T.txt2, fontSize: 12 };

  const edit = (kind, doc) => {
    setDraft(doc || { id: crypto.randomUUID(), kind, name: '', number: '', path: null });
    setFile(null); setError(''); setRemoving(null);
  };
  const persist = async (doc, remove = false) => {
    if (isDemo) {
      const next = remove ? documents.filter(item => item.id !== doc.id)
        : documents.some(item => item.id === doc.id) ? documents.map(item => item.id === doc.id ? doc : item) : [...documents, doc];
      const first = next.find(item => item.kind === 'identity');
      return { documents: next, id_document: first?.number || null, id_document_path: first?.path || null };
    }
    const { data, error: saveError } = await supabase.rpc('fn_lead_document_save', { p_lead_id: lead.id, p_document: doc, p_remove: remove });
    if (saveError) throw saveError;
    return data;
  };
  const apply = data => {
    if (!active.current) return;
    setDocuments(data.documents);
    // Already persisted atomically by the RPC. Never resend a stale full lead.
    onUpdate?.({ id: lead.id, ...data }, { persist: false });
  };
  const save = async () => {
    if (busy || !draft) return;
    const doc = { ...draft, name: draft.name.trim(), number: (draft.number || '').trim() };
    if (!doc.name) { setError(doc.kind === 'identity' ? 'Escribe el nombre del titular del ID.' : 'Escribe el nombre de la propiedad.'); return; }
    if (!file && !doc.path && (doc.kind === 'offer' || !doc.number)) { setError(doc.kind === 'offer' ? 'Adjunta la carta oferta.' : 'Registra el número del ID o adjunta su archivo.'); return; }
    setBusy(true); setError('');
    try {
      if (file) {
        const ext = documentFileExtension(file);
        if (isDemo) throw new Error('La carga de archivos requiere una cuenta activa.');
        if (!user?.organizationId) throw new Error('No hay una organización activa. Vuelve a iniciar sesión.');
        const uploadedPath = `id-doc/${user.organizationId}/${lead.id}/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from('evidencia').upload(uploadedPath, file, { upsert: false, contentType: file.type });
        if (upload.error) throw upload.error;
        Object.assign(doc, { path: uploadedPath, filename: file.name, content_type: file.type });
        // Keep the upload for retry if the metadata response is lost. Deleting
        // it after a network error could erase a successfully committed file.
        if (active.current) { setDraft(doc); setFile(null); }
      }
      const data = await persist(doc);
      apply(data);
      if (active.current) { setDraft(null); setFile(null); }
    } catch (err) {
      if (active.current) setError(`No se pudo guardar: ${err.message || 'intenta de nuevo'}`);
    } finally { if (active.current) setBusy(false); }
  };
  const remove = async doc => {
    if (busy) return;
    setBusy(true); setError('');
    try { apply(await persist(doc, true)); if (active.current) setRemoving(null); }
    catch (err) { if (active.current) setError(`No se pudo quitar: ${err.message || 'intenta de nuevo'}`); }
    finally { if (active.current) setBusy(false); }
  };
  const open = async doc => {
    setError(''); setViewer({ loading: true, name: doc.name, id: doc.id });
    try {
      const [view, download] = await Promise.all([
        supabase.storage.from('evidencia').createSignedUrl(doc.path, 3600),
        supabase.storage.from('evidencia').createSignedUrl(doc.path, 3600, { download: doc.filename || true }),
      ]);
      if (view.error) throw view.error;
      if (active.current) setViewer(current => current?.id === doc.id ? ({ id: doc.id, name: doc.name, url: view.data.signedUrl, download: download.data?.signedUrl || view.data.signedUrl, pdf: /\.pdf$/i.test(doc.path) }) : current);
    } catch (err) { if (active.current) { setViewer(null); setError(`No se pudo abrir: ${err.message || 'intenta de nuevo'}`); } }
  };

  return <section aria-label="Documentos del expediente" style={{ display: 'grid', gap: 14, fontFamily: font }}>
    {[{ kind: 'identity', title: 'Identificaciones', add: 'Agregar ID', hint: 'Guarda cada INE o pasaporte con el nombre de su titular.', Icon: ShieldCheck },
      { kind: 'offer', title: 'Cartas oferta', add: 'Agregar carta', hint: 'Adjunta la carta oferta e identifica la propiedad.', Icon: FileText }].map(({ kind, title, add, hint, Icon }) => <div key={kind}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.txt2, display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={14} />{title}</h3>
        <button type="button" disabled={busy || !!draft} onClick={() => edit(kind)} style={{ ...button, color: accent }}><Plus size={13} />{add}</button>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {!documents.some(doc => doc.kind === kind) && <p style={{ margin: '0 0 4px', fontSize: 12, lineHeight: 1.5, color: T.txt3 }}>{hint}</p>}
        {documents.filter(doc => doc.kind === kind).map(doc => <div key={doc.id} style={{ padding: '10px 11px', border: `1px solid ${T.border}`, borderRadius: 11, background: isLight ? 'rgba(15,23,42,.025)' : 'rgba(255,255,255,.025)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: T.txt, fontWeight: 600, overflowWrap: 'anywhere' }}>{doc.name}</div>
              {doc.number && <div style={{ color: T.txt2, fontSize: 12, marginTop: 3, overflowWrap: 'anywhere' }}>ID: {doc.number}</div>}
              <div style={{ color: T.txt3, fontSize: 11, marginTop: 3, overflowWrap: 'anywhere' }}>{doc.path ? doc.filename || 'Archivo adjunto' : 'Sin archivo adjunto'}</div>
            </div>
            <button type="button" aria-label={`Editar ${doc.name}`} disabled={busy || !!draft} onClick={() => edit(kind, doc)} style={button}><Pencil size={13} /></button>
            <button type="button" aria-label={`Quitar ${doc.name}`} disabled={busy || !!draft} onClick={() => setRemoving(doc.id)} style={button}><Trash2 size={13} /></button>
          </div>
          {doc.path && <button type="button" onClick={() => open(doc)} style={{ ...button, marginTop: 8 }}><Eye size={13} />Ver documento</button>}
          {removing === doc.id && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: T.txt2 }}>
            ¿Quitar este documento del expediente?
            <div style={{ display: 'flex', gap: 7, marginTop: 7 }}><button type="button" disabled={busy} onClick={() => setRemoving(null)} style={button}>Cancelar</button><button type="button" disabled={busy} onClick={() => remove(doc)} style={{ ...button, color: isLight ? '#B42318' : '#FCA5A5' }}>Sí, quitar</button></div>
          </div>}
        </div>)}
        {draft?.kind === kind && <div style={{ padding: 12, borderRadius: 11, border: `1px solid ${T.border}`, display: 'grid', gap: 10 }}>
          <label style={label}>{kind === 'identity' ? 'Nombre del titular del ID' : 'Propiedad de la carta oferta'}
            <input aria-label={kind === 'identity' ? 'Nombre del titular del ID' : 'Propiedad de la carta oferta'} autoFocus maxLength={200} value={draft.name} disabled={busy} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder={kind === 'identity' ? 'Ej. María Pérez · INE' : 'Ej. Departamento 204 · Torre Mar'} style={input} /></label>
          {kind === 'identity' && <label style={label}>Número de identificación (opcional con archivo)<input aria-label="Número de identificación" value={draft.number || ''} disabled={busy} maxLength={200} onChange={event => setDraft({ ...draft, number: event.target.value })} style={input} /></label>}
          <label style={{ ...label, padding: 10, border: `1px dashed ${T.border}`, borderRadius: 9 }}><span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Upload size={13} />{draft.path ? 'Reemplazar archivo (opcional)' : 'Adjuntar archivo'}</span>
            <input aria-label={kind === 'identity' ? 'Archivo de identificación' : 'Archivo de carta oferta'} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy} onChange={event => { const chosen = event.target.files?.[0]; try { if (chosen) documentFileExtension(chosen); setFile(chosen || null); setError(''); } catch (err) { event.target.value = ''; setFile(null); setError(err.message); } }} style={{ maxWidth: '100%', color: T.txt2, fontSize: 12 }} />
            <span style={{ color: T.txt3, fontSize: 11 }}>PDF o imagen · Máximo 15 MB</span></label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button type="button" disabled={busy} onClick={() => { setDraft(null); setFile(null); setError(''); }} style={button}>Cancelar</button><button type="button" disabled={busy} onClick={save} style={{ ...button, background: T.accent, color: '#fff', borderColor: 'transparent', padding: '8px 14px' }}>{busy ? 'Guardando…' : 'Guardar documento'}</button></div>
        </div>}
      </div>
    </div>)}
    {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: isLight ? '#B42318' : '#FCA5A5', lineHeight: 1.5 }}>{error}</p>}
    {viewer && createPortal(<div role="dialog" aria-modal="true" aria-label={`Documento: ${viewer.name}`} onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.85)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <button ref={viewerClose} type="button" aria-label="Cerrar documento" onClick={() => setViewer(null)} style={{ ...button, position: 'absolute', top: 18, right: 18, color: '#fff', background: '#202833' }}><X size={22} /></button>
      <div onClick={event => event.stopPropagation()} style={{ display: 'grid', gap: 18, justifyItems: 'center', maxWidth: '90vw', color: '#fff' }}>
        {viewer.loading ? 'Abriendo documento…' : <>
          {viewer.pdf ? <div style={{ padding: 30, textAlign: 'center' }}><FileText size={48} /><p>{viewer.name}</p><span>Documento PDF</span></div> : <img src={viewer.url} alt={viewer.name} style={{ maxWidth: '90vw', maxHeight: '72dvh', objectFit: 'contain', borderRadius: 10 }} />}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}><a href={viewer.download} download style={{ ...button, background: '#fff', color: '#0B1220', textDecoration: 'none', padding: '12px 18px' }}><Download size={15} />Descargar</a><a href={viewer.url} target="_blank" rel="noreferrer" style={{ ...button, color: '#fff', textDecoration: 'none', padding: '12px 18px' }}><ExternalLink size={15} />Abrir aparte</a></div>
        </>}
      </div>
    </div>, document.body)}
  </section>;
}
