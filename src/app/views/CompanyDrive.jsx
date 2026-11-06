import { useEffect, useState } from 'react';
import { ExternalLink, FolderOpen, RefreshCw } from 'lucide-react';
import { font, fontDisp } from '../../design-system/tokens';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useViewport';
import { supabase } from '../../lib/supabase';
import { companyDriveFolders } from '../../lib/company-drive';

// Company folders share the same source as Space and Copilot. A new company
// starts empty; it never inherits the internal department folders of Duke.
export default function CompanyDrive({ T, onOpenSpace }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const orgId = user?.organizationId;
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (!orgId || user?._offline || user?.isDemo) {
      clearTimeout(timeout);
      return () => { active = false; controller.abort(); };
    }
    supabase.from('organizations').select('id,meta_config').eq('id', orgId)
      .maybeSingle().abortSignal(controller.signal)
      .then(({ data, error: readError }) => {
        if (!active) return;
        if (readError || data?.id !== orgId) throw new Error('read');
        setResult({ orgId, revision, folders: companyDriveFolders(data.meta_config?.documents), error: '' });
      })
      .catch(() => { if (active) setResult({ orgId, revision, folders: [], error: 'No se pudieron cargar tus carpetas. Puedes reintentar.' }); })
      .finally(() => { clearTimeout(timeout); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [orgId, user?._offline, user?.isDemo, revision]);
  const loading = !!orgId && !user?._offline && !user?.isDemo && (result?.orgId !== orgId || result?.revision !== revision);
  const folders = result?.orgId === orgId ? result.folders : [];
  const error = user?._offline ? 'Conéctate para ver las carpetas de tu empresa.' : !loading && result?.orgId === orgId ? result.error : '';
  const folder = folders.find(item => item.id === selected) || folders[0];
  const button = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 44, padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`,
    background: T.glass, color: T.accent, fontFamily: font, fontSize: 13, cursor: 'pointer', textDecoration: 'none' };
  return <section aria-label="Mi Drive" style={{ fontFamily: font, color: T.txt, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <FolderOpen size={26} color={T.accent} />
      <div style={{ flex: 1, minWidth: 160 }}><h1 style={{ fontFamily: fontDisp, fontSize: 22, margin: 0 }}>Mi Drive</h1>
        <p style={{ color: T.txt2, fontSize: 13, margin: '6px 0 0' }}>Las carpetas guardadas en los documentos de tu empresa.</p></div>
      <button type="button" onClick={() => setRevision(value => value + 1)} style={button} disabled={loading}><RefreshCw size={16} />Actualizar</button>
      {onOpenSpace && <button type="button" onClick={onOpenSpace} style={button}>Abrir Space</button>}
    </header>
    {loading ? <p role="status">Cargando tus carpetas…</p> : error ? <p role="alert" style={{ color: T.txt2 }}>{error}</p> : !folder ?
      <div style={{ padding: 24, border: `1px solid ${T.border}`, borderRadius: 14, background: T.glass }}>
        <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>Todavía no hay carpetas de Drive</h2>
        <p style={{ color: T.txt2, fontSize: 13, lineHeight: 1.6, margin: 0 }}>El administrador puede agregar el enlace de una carpeta de Google Drive en Space → Documentos. Aparecerá aquí y también podrás pedírsela al Copilot.</p>
      </div> : <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {folders.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)} aria-pressed={folder.id === item.id}
            style={{ ...button, fontWeight: folder.id === item.id ? 700 : 400 }}>{item.title}</button>)}
        </div>
        <a href={folder.url} target="_blank" rel="noopener noreferrer" style={{ ...button, alignSelf: 'flex-start' }}><ExternalLink size={16} />Abrir {folder.title} en Drive</a>
        <iframe key={`${folder.id}:${revision}`} title={`Drive · ${folder.title}`} src={folder.embed} loading="lazy"
          style={{ width: '100%', flex: 1, minHeight: isMobile ? 420 : 520, border: `1px solid ${T.border}`, borderRadius: 14, background: T.glass }} />
        <p style={{ color: T.txt3, fontSize: 12, lineHeight: 1.5, margin: 0 }}>Si la carpeta no se muestra, usa “Abrir en Drive”. Para subir o editar archivos se abre Google Drive con tus permisos.</p>
      </>}
  </section>;
}
