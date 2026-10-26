import { useEffect, useRef, useState } from 'react';
import { requestRecoveryCode, verifyRecoveryCode } from '../lib/recovery';
import '../app/components/account-security.css';

export default function RecoveryForm({ T, initialEmail = '', onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => { if (!cooldown) return; const id = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(id); }, [cooldown]);
  const send = async () => {
    if (lock.current || cooldown) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await requestRecoveryCode(email);
      if (!result.ok) { setError(result.error); return; }
      setStep('code'); setCode(''); setCooldown(60);
    } finally { lock.current = false; setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (step === 'email') return send();
    if (lock.current) return;
    if (password !== confirm) { setError('Las contraseñas no coinciden. Revisa ambos campos.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await verifyRecoveryCode(email, code, password);
      if (!result.ok) { setError(result.error); return; }
      setPassword(''); setConfirm(''); setCode(''); setStep('done');
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="account-security" style={{ '--account-text': T.txt, '--account-muted': T.txt2, '--account-border': T.border, '--account-accent': T.accent, '--account-ink': T.onAccent }}>
    <h2 ref={heading} tabIndex={-1}>{step === 'done' ? 'Contraseña actualizada' : 'Recuperar acceso'}</h2>
    {step === 'done' ? <p role="status">Ya puedes iniciar sesión con tu nueva contraseña.</p> : <>
      <p>{step === 'email' ? 'Escribe tu correo de acceso o de recuperación. Si tu cuenta tiene un correo de recuperación configurado, recibirás allí un código.' : `Solicitud para ${email.trim()}. Revisa tu correo de recuperación y spam. El código más reciente vence en 15 minutos.`}</p>
      <form onSubmit={submit}>
        {step === 'email' ? <><label htmlFor="recovery-address">Correo de tu cuenta</label><input id="recovery-address" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></> : <>
          <label htmlFor="recovery-code">Código de 6 dígitos</label><input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} />
          <label htmlFor="recovery-password">Nueva contraseña · mínimo 8 caracteres</label><input id="recovery-password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
          <label htmlFor="recovery-confirm">Confirmar contraseña</label><input id="recovery-confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} />
          <button className="account-secondary" type="button" onClick={() => setVisible(value => !value)} aria-pressed={visible}>{visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</button>
        </>}
        {error && <p role="alert">{error}</p>}
        <button disabled={busy || (step === 'email' && cooldown > 0)}>{busy ? 'Procesando…' : step === 'email' ? cooldown ? `Reenviar en ${cooldown} s` : 'Enviar código' : 'Guardar nueva contraseña'}</button>
      </form>
      {step === 'code' && <div className="account-actions"><button className="account-secondary" type="button" disabled={busy || cooldown > 0} onClick={send}>{cooldown ? `Reenviar en ${cooldown} s` : 'Reenviar código'}</button><button className="account-secondary" type="button" disabled={busy} onClick={() => { setStep('email'); setError(''); }}>Corregir correo</button></div>}
      <p>Si no recibes el código o no tienes acceso al buzón, contacta al administrador de tu empresa.</p>
    </>}
    <button className="account-secondary" type="button" disabled={busy} onClick={onBack}>Volver a iniciar sesión</button>
  </section>;
}
