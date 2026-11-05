import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import RecoveryForm from "./RecoveryForm";
import { LP, font, fontDisp } from "../design-system/tokens";
import { useClient } from "../hooks/useClient";
import { nativePlugin } from "../lib/native";
import { normalizeLoginIdentity } from "../lib/login-identity";
import "./LoginScreenNative.css";

// A clear sign-in surface shares the web identity while preserving the native
// enterprise flow: login, recovery and a local guest; no signup or purchasing.
const theme = { ...LP, actionG: "#10234B", actionBorder: "#10234B" };
export default function LoginScreenNative({ onLogin }) {
  const { config, clientId } = useClient();
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const isStratos = !clientId || ["duke", "stratos", "tenant"].includes(clientId);
  const brandName = isStratos ? "Stratos AI" : config?.name || "Stratos AI";
  const accent = isStratos ? theme.actionG : config?.brand?.accent || theme.actionG;
  const vars = { "--native-login-action": accent, fontFamily: font, "--native-login-title-font": fontDisp };

  useEffect(() => {
    const bars = nativePlugin("SystemBars");
    const apply = style => { try { Promise.resolve(bars?.setStyle({ style })).catch(() => {}); } catch { /* old shell */ } };
    apply("LIGHT");
    return () => apply("DEFAULT");
  }, []);

  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!email.trim() || !password) { setError("Completa tu correo o usuario y contraseña."); return; }
    submitting.current = true; setLoading(true);
    try {
      const result = await onLogin(normalizeLoginIdentity(email), password);
      if (result?.error) setError(result.error);
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    } finally { submitting.current = false; setLoading(false); }
  };

  return (
    <main className="native-login-page" style={vars}>
      <div className="native-login-content">
        <header className="native-login-brand" aria-label={brandName}>
          {isStratos ? <img src="/branding/stratos-logo-web-20261016.webp" alt="" width="52" height="52" />
            : <span className="native-login-monogram" aria-hidden="true">{brandName.charAt(0)}</span>}
          <span>{brandName}</span>
        </header>
        <section className="native-login-card" aria-labelledby={recovering ? undefined : "native-login-title"} aria-label={recovering ? "Recuperar acceso" : undefined}>
          {recovering ? <RecoveryForm T={theme} initialEmail={normalizeLoginIdentity(email)} onBack={() => setRecovering(false)} /> : <>
            <div className="native-login-heading">
              <p className="native-login-eyebrow">Acceso a la plataforma</p>
              <h1 id="native-login-title">Bienvenido de vuelta</h1>
              <p>Usa la cuenta que te proporcionó tu empresa.</p>
            </div>
            <form onSubmit={submit} className="native-login-form" aria-busy={loading}>
              <div className="native-login-field">
                <label htmlFor="native-email">Correo o usuario</label>
                <input id="native-email" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  autoComplete="username" placeholder="correo@empresa.com o usuario" value={email}
                  onChange={event => setEmail(event.target.value)} disabled={loading} aria-describedby="native-login-error" />
              </div>
              <div className="native-login-field">
                <div className="native-login-label-row"><label htmlFor="native-password">Contraseña</label>
                  <button type="button" className="native-login-recovery" onClick={() => setRecovering(true)} disabled={loading}>¿Olvidaste tu contraseña?</button>
                </div>
                <div className="native-login-password">
                  <input id="native-password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                    placeholder="Tu contraseña" value={password} onChange={event => setPassword(event.target.value)} disabled={loading}
                    aria-describedby="native-login-error" />
                  <button type="button" className="native-login-eye" onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <p id="native-login-error" className="native-login-error" role={error ? "alert" : undefined}>{error}</p>
              <button type="submit" className="native-login-primary" disabled={loading}>
                {loading ? <><Loader2 size={19} className="native-login-spinner" style={{ animation: "native-login-spin 1s linear infinite" }} /> Entrando…</> : <>Iniciar sesión <ArrowRight size={19} /></>}
              </button>
            </form>
            <div className="native-login-divider"><span>o prueba la demo</span></div>
            <a href="/guest.html" className="native-login-guest">Entrar como invitado <ArrowRight size={17} /></a>
            <p className="native-login-guest-help">Prueba el CRM con datos de ejemplo, sin cuenta.</p>
          </>}
        </section>
        <p className="native-login-help">¿Aún no tienes acceso?<br />Solicítalo al administrador de tu empresa.</p>
      </div>
    </main>
  );
}
