import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function CopilotReminderSettings({ T, compact = false }) {
  const { user } = useAuth();
  const [preference, setPreference] = useState({ owner: null, enabled: null });
  const enabled = preference.owner === user?.id ? preference.enabled : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const available = !!user?.id && !user.isDemo;

  useEffect(() => {
    const refresh = () => setReload(n => n + 1);
    window.addEventListener('stratos:reminder-settings-changed', refresh);
    return () => window.removeEventListener('stratos:reminder-settings-changed', refresh);
  }, []);

  useEffect(() => {
    if (!available) return;
    let current = true;
    supabase.rpc('copilot_reminder_settings', { p_enabled: null }).then(({ data, error: rpcError }) => {
      if (!current) return;
      if (rpcError || typeof data?.enabled !== 'boolean') {
        setError('No pudimos consultar tu preferencia.');
        return;
      }
      setPreference({ owner: user.id, enabled: data.enabled });
      setError('');
    }).catch(() => { if (current) setError('No pudimos consultar tu preferencia.'); });
    return () => { current = false; };
  }, [available, user?.id, reload]);

  const toggle = async () => {
    if (!available || busy || enabled === null) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('copilot_reminder_settings', { p_enabled: !enabled });
      if (rpcError || typeof data?.enabled !== 'boolean') throw new Error('unconfirmed');
      setPreference({ owner: user.id, enabled: data.enabled });
    } catch {
      setPreference({ owner: user.id, enabled: null });
      setError('No pudimos confirmar el cambio. Consulta de nuevo tu preferencia.');
    } finally { setBusy(false); }
  };

  return <section aria-label="Insistencia de Copilot" style={{ padding: compact ? '14px 16px' : 20, marginBottom: compact ? 0 : 18, border: compact ? 'none' : `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, borderRadius: compact ? 0 : 14, background: T.surface, flexShrink: 0, color: T.txt }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Insistencia de Copilot</h2>
        <p aria-live="polite" style={{ margin: '5px 0 0', fontSize: 12, color: T.txt2 }}>
          {!available ? 'Disponible al iniciar sesión en tu cuenta.' : enabled === null ? (error ? 'Preferencia por confirmar' : 'Consultando preferencia…') : enabled ? 'Activa · cada 3 minutos hasta responder' : 'Reducida · 2 avisos adicionales'}
        </p>
      </div>
      <button type="button" role="switch" aria-label="Insistencia de Copilot" aria-checked={enabled === true} aria-busy={busy}
        disabled={!available || busy || enabled === null} onClick={toggle}
        style={{ width: 48, minWidth: 48, height: 30, padding: 3, borderRadius: 20, border: `1px solid ${enabled ? T.accent : T.border}`, background: enabled ? T.accent : T.bg, cursor: !available || busy || enabled === null ? 'default' : 'pointer', opacity: busy || enabled === null ? .5 : 1 }}>
        <span style={{ display: 'block', width: 22, height: 22, borderRadius: '50%', background: '#fff', transform: `translateX(${enabled ? 18 : 0}px)`, boxShadow: '0 1px 3px rgba(0,0,0,.16)' }} />
      </button>
    </div>
    <p style={{ margin: '10px 0 0', color: T.txt3, fontSize: 12, lineHeight: 1.5 }}>
      Para tareas, Zooms, citas y recordatorios. Al desactivarla, recibirás como máximo dos avisos adicionales, cada tres minutos. Responder detiene el seguimiento. Se respeta tu horario de avisos.
    </p>
    {error && <div role="alert" style={{ marginTop: 10, color: T.txt2, fontSize: 12 }}>
      {error}{' '}<button type="button" disabled={busy} onClick={() => setReload(n => n + 1)} style={{ color: T.accent, border: 0, padding: 3, background: 'transparent', font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Volver a consultar</button>
    </div>}
  </section>;
}
