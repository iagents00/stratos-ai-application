import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { requestEmailChange, boundedAccountOperation } from '../../lib/account-security';
import './account-security.css';

export default function LoginEmailPanel({ T, user }) {
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const disabled = !user?.id || user.isDemo || user._offline;
  useEffect(() => {
    let active = true;
    if (!disabled) boundedAccountOperation(supabase.auth.getUser()).then(({ data, error: err }) => {
      if (!active) return;
      if (err || !data?.user) { setError('No se pudo consultar tu correo. Recarga la página para intentarlo de nuevo.'); return; }
      setCurrent(data.user.email || ''); setPending(data.user.new_email || '');
    }).catch(() => { if (active) setError('No se pudo consultar tu correo. Comprueba tu conexión y recarga la página.'); });
    return () => { active = false; };
  }, [disabled, user?.id, user?.email]);
  const submit = async event => {
    event.preventDefault();
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await requestEmailChange(supabase, email);
      if (!result.ok) { setError(result.error); return; }
      setPending(result.pending ? result.email : '');
      if (!result.pending) setCurrent(result.email);
      setEmail('');
      setMessage(result.pending ? 'Solicitud enviada. Sigue las instrucciones de los correos de confirmación. El correo de acceso actual sigue vigente hasta completar el cambio.' : 'Correo de acceso actualizado. Utilízalo la próxima vez que inicies sesión.');
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="account-security" style={{ '--account-text': T.txt, '--account-muted': T.txt2, '--account-border': T.border, '--account-accent': T.accent, '--account-ink': T.onAccent }} aria-labelledby="login-email-title">
    <h2 id="login-email-title">Correo de acceso</h2>
    <p>Es el correo con el que inicias sesión. Cambiarlo conserva tu cuenta, empresa y permisos.</p>
    {current && <p>Actual: <strong>{current}</strong></p>}
    {pending && <p role="status">Pendiente de confirmar: <strong>{pending}</strong>. Revisa ambos buzones y la carpeta de spam. Si ya confirmaste, recarga esta página.</p>}
    {disabled ? <p>Disponible al iniciar sesión en tu cuenta con conexión.</p> : <form onSubmit={submit}>
      <label htmlFor="new-login-email">Nuevo correo de acceso</label>
      <input id="new-login-email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy || !current} />
      <p>Necesitas acceso al buzón actual y al nuevo. El correo de recuperación se configura por separado más abajo.</p>
      <button disabled={busy || !current || !email.trim()}>{busy ? 'Solicitando cambio…' : 'Solicitar cambio de correo'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
