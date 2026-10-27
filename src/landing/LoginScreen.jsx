/**
 * LoginScreen — Pantalla de autenticación completa para la app
 * Reside en: app.stratoscapitalgroup.com
 *
 * Modos: login | register | forgot | forgot-sent
 */
import { useState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { pingSupabase } from "../lib/offline-mode";
import { LP } from "../design-system/tokens";
import "./LoginScreen.css";

// El acceso público siempre es claro; no modifica el tema guardado del CRM.
const P = { ...LP, bg: "#FFFFFF", bg3: "#EDF3F9", actionG: "#10234B", actionBorder: "#10234B" };
import { useClient } from "../hooks/useClient";
import { requestRecoveryCode, verifyRecoveryCode } from "../lib/recovery";
import { isNativeApp } from "../lib/native";
import { isCommonEntryLocation } from "../lib/common-entry";

const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;


// Sembrar cuenta demo
function seedDemo() {
  try {
    const users = JSON.parse(localStorage.getItem("stratos_users") || "[]");
    if (!users.find(u => u.email === "demo@stratos.ai")) {
      users.unshift({ id: 1, name: "Usuario Demo", email: "demo@stratos.ai", password: "demo2027" });
      localStorage.setItem("stratos_users", JSON.stringify(users));
    }
  } catch {}
}

export default function LoginScreen({ onLogin }) {
  // ⚠️ APP NATIVA: no hay alta de cuenta. Dos motivos distintos, y los dos pesan.
  //
  // 1) Apple. Bajo la Guideline 3.1.3(c) (Enterprise Services) la app se sostiene
  //    porque se le vende a EMPRESAS y el empleado solo entra a usar lo que su
  //    empresa contrató. Una pantalla de alta dentro de la app sugiere que desde
  //    ahí se puede crear una suscripción, y hay rechazos documentados por eso.
  // 2) Seguridad. El alta pública crea una organización nueva y deja al que se
  //    registra como 'admin' de ella. Cerrar esta puerta en la app achica esa
  //    superficie (la web sigue igual: acá NO se toca ese flujo).
  //
  // El alta real de un asesor la hace el admin de su empresa desde el CRM, que
  // es como funciona el producto de todos modos.
  const nativo = isNativeApp();

  // Si viene de landing con ?register=true → abrir tab de registro directamente.
  // En nativo se ignora: si no, el parámetro sería la puerta lateral a la pantalla
  // que acabamos de esconder.
  const initialMode = !nativo && new URLSearchParams(window.location.search).get("register") === "true"
    ? "register" : "login";

  // La entrada común usa Stratos; las rutas de empresa conservan su marca.
  const { config: clientConfig, clientId } = useClient();
  // El acceso común mantiene la marca Stratos incluso tras cerrar una sesión
  // cuya empresa se había aplicado en memoria. Las portadas específicas siguen.
  const commonEntry = isCommonEntryLocation(window.location);
  const config = commonEntry ? null : clientConfig;
  const brandName   = config?.name || "Stratos AI";
  const brandWord   = config?.brand?.logoText || "Stratos";
  const brandSuffix = brandName.startsWith(brandWord)
    ? brandName.slice(brandWord.length).trim()
    : "";
  const isDuke   = commonEntry || clientId === "duke";
  const heroTop   = config?.login?.heroTop   || "El sistema operativo";
  const heroBot   = config?.login?.heroBot   || "con IA para tu negocio.";
  const heroSub   = config?.login?.sub       || ["Tu equipo, tus clientes y tu Copilot.", "Conectados en un mismo espacio."];
  const heroStats = config?.login?.stats     || [["CRM","Organiza"],["Copilot","Simplifica"],["Equipo","Conecta"]];
  // El WhatsApp de "solicitar acceso" cae al de Stratos (operador del white-label)
  // salvo que el cliente declare el suyo; el texto siempre nombra a la marca activa.
  const waNumber = config?.support?.whatsapp || "17479779711";
  const waHref   = `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola, quiero solicitar acceso a ${brandName}`)}`;

  useEffect(() => { seedDemo(); }, []);

  // ── Warm-up de Supabase al montar ────────────────────────────────
  // Cuando el usuario llega al login, lanzamos un ping silencioso a
  // Supabase. Para cuando teclee email + password (típicamente 4-8s),
  // la conexión ya esta caliente y signInWithPassword responde rapido.
  // Sin esto, el primer auth tras inactividad puede tardar >12s.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // pingSupabase hace SELECT count(*) FROM profiles LIMIT 0 — query
        // ligerísima, no devuelve datos pero abre el pipe TCP/HTTP.
        await pingSupabase(supabase, 8000);
      } catch (_) { /* silencioso — solo es un warm-up */ }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, []);

  const recoveryBusy = useRef(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => { if (!resendSeconds) return; const timer = setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [resendSeconds]);
  const [mode, setMode]       = useState(initialMode); // login | register | forgot | forgot-code | forgot-done
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode]       = useState("");                 // código de recuperación (6 dígitos)
  const [recoveryEmail, setRecoveryEmail] = useState("");     // correo de recuperación (registro)
  const [showP, setShowP]     = useState(false);
  const [showC, setShowC]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoad]    = useState(false);
  const [focused, setFocused] = useState(null);
  // Texto progresivo del botón mientras carga — da feedback al usuario
  // que no está atascado, especialmente en redes lentas (México→us-west-2).
  const [loadingPhase, setLoadingPhase] = useState(0);
  useEffect(() => {
    if (!loading) { setLoadingPhase(0); return; }
    const t1 = setTimeout(() => setLoadingPhase(1), 5000);
    const t2 = setTimeout(() => setLoadingPhase(2), 15000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);
  const loadingLabel = loadingPhase >= 2
    ? "Casi listo, un momento…"
    : loadingPhase >= 1
      ? "Conectando con el servidor…"
      : "Verificando…";

  // Fuerza de contraseña
  const pw = (() => {
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9!@#$%^&*]/.test(password)) s++;
    return s;
  })();
  const strengthColor = ["#E8818C","#F59E0B","#67B7D1",P.success][pw - 1] || P.txt3;
  const strengthLabel = ["Muy débil","Débil","Buena","Fuerte"][pw - 1] || "";

  const reset = () => { setName(""); setEmail(""); setPass(""); setConfirm(""); setCode(""); setRecoveryEmail(""); setError(""); };
  const go    = (m) => { if (loading) return; const previousEmail = email; setMode(m); reset(); setShowP(false); setShowC(false); if (m === "forgot" || m === "login") setEmail(previousEmail); };

  const inputStyle = (field, hasErr) => ({
    width: "100%", padding: "12px 14px", borderRadius: 10, outline: "none",
    background: "#F7FAFD",
    border: `1px solid ${hasErr ? "#B42338" : focused === field ? P.accent : "#D5DFE9"}`,
    color: P.txt, fontSize: 16, fontFamily: font, boxShadow: focused === field ? "0 0 0 3px rgba(0,111,145,.10)" : "none", transition: "border-color 0.2s",
  });

  const Label = ({ text, right, htmlFor }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13, color: P.txt2, fontWeight: 600 }}>{text}</label>
      {right}
    </div>
  );

  /* ─── ACCIONES ─── */
  const doLogin = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Completa todos los campos."); return; }
    setLoad(true);
    const identity = email.trim().toLowerCase();
    // Alias de acceso para el operador. La clave nunca vive en el bundle:
    // sigue validándose exclusivamente en Supabase Auth.
    const loginEmail = identity === "admin2026"
      ? "admin2026@stratoscapitalgroup.com"
      : identity;
    const result = await onLogin(loginEmail, password);
    if (result?.error) { setError(result.error); setLoad(false); }
    // Si no hay error, App.jsx desmonta LoginScreen automáticamente
  };

  const doRegister = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password || !confirm) { setError("Completa todos los campos."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Correo electrónico inválido."); return; }
    // 8, igual que al recuperar la clave (doVerifyCode). Antes acá pedía 6 y allá
    // 8: se podía crear una contraseña que después el propio sistema rechazaba.
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoad(true);
    const result = await onLogin(email.trim().toLowerCase(), password, { name: name.trim(), isRegister: true, recoveryEmail: recoveryEmail.trim().toLowerCase() });
    if (result?.error) { setError(result.error); setLoad(false); }
  };

  // Paso 1 — pedir el código de recuperación (se envía al correo de recuperación).
  const doForgot = async () => {
    if (recoveryBusy.current || resendSeconds > 0) return;
    setError("");
    if (!email.trim()) { setError("Ingresa tu correo."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Correo inválido."); return; }
    recoveryBusy.current = true;
    setLoad(true);
    const r = await requestRecoveryCode(email.trim().toLowerCase());
    recoveryBusy.current = false;
    setLoad(false);
    if (r.ok) { setResendSeconds(60); setPass(""); setConfirm(""); setCode(""); setError(""); setMode("forgot-code"); }
    else setError(r.error || "No se pudo enviar el código. Intenta de nuevo.");
  };

  // Paso 2 — validar el código y fijar la nueva contraseña.
  const doVerifyCode = async () => {
    if (recoveryBusy.current) return;
    setError("");
    if (!/^\d{6}$/.test(code.trim())) { setError("Ingresa el código de 6 dígitos que te llegó."); return; }
    if (password.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    recoveryBusy.current = true;
    setLoad(true);
    const r = await verifyRecoveryCode(email.trim().toLowerCase(), code.trim(), password);
    recoveryBusy.current = false;
    setLoad(false);
    if (r.ok) { setPass(""); setConfirm(""); setCode(""); setError(""); setMode("forgot-done"); }
    else setError(r.error || "Código incorrecto.");
  };

  const doDemo = async () => {
    setLoad(true);
    const result = await onLogin("demo@stratos.ai", "demo2027");
    if (result?.error) { setError(result.error); setLoad(false); }
  };

  const onKey = (e) => {
    if (e.key !== "Enter" || loading) return;
    if (mode === "login") doLogin();
    else if (mode === "register") doRegister();
    else if (mode === "forgot") doForgot();
    else if (mode === "forgot-code") doVerifyCode();
  };

  return (
    <main className="stratos-login">
      <section className="login-brand-panel" aria-label={brandName}>
        <div className="login-wordmark">
          {isDuke && <img src="/branding/stratos-logo-web-20261016.webp" alt="" width="48" height="48" />}
          <span>{brandWord}{brandSuffix && <> <span>{brandSuffix}</span></>}</span>
        </div>
        <div className="login-intro">
          <p className="login-eyebrow">Tu espacio de trabajo inteligente</p>
          <h1>{heroTop}<br /><span>{heroBot}</span></h1>
          <p className="login-description">{heroSub.map((linea, i) => <span key={i}>{linea}{i < heroSub.length - 1 && <br />}</span>)}</p>
          <div className="login-capabilities">
            {heroStats.map(([v, l]) => <div key={v}><strong>{v}</strong><span>{l}</span></div>)}
          </div>
        </div>
        <div className="login-orbit" aria-hidden="true"><i /><i /><i /></div>
        <p className="login-brand-caption">{brandName} · Todo empieza aquí.</p>
      </section>
      <section className="login-form-panel" aria-label="Acceso a tu cuenta">
        <div className="login-form-content">
          {/* ─ CONTRASEÑA ACTUALIZADA ─ */}
          {mode === "forgot-done" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: P.successS, border: `1px solid ${P.successB}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <CheckCircle2 size={28} color={P.success} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: P.txt, fontFamily: fontD, marginBottom: 8 }}>¡Listo!</h2>
              <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.7, marginBottom: 6 }}>
                Tu contraseña fue actualizada.
              </p>
              <p style={{ fontSize: 13, color: P.txt, fontWeight: 600, marginBottom: 24 }}>
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button onClick={() => go("login")} style={{
                width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${P.actionBorder}`,
                background: P.actionG,
                color: P.actionInk, fontSize: 13, fontWeight: 700, fontFamily: fontD, cursor: "pointer",
              }}>Ir al inicio de sesión →</button>
            </div>
          ) : mode === "forgot-code" ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  Recuperar acceso
                </p>
                <h2 style={{ fontSize: 28, fontWeight: 600, color: P.txt, fontFamily: fontD, letterSpacing: "-0.02em" }}>
                  Ingresa el código
                </h2>
              </div>

              <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.6, marginBottom: 18 }}>
                Solicitud para {email.trim()}. Si la cuenta tiene un correo de recuperación configurado, recibirás un código de 6 dígitos. Revisa también spam. Usa el código más reciente; vence en 15 minutos. Si ya tienes uno, escríbelo aquí.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {/* Código */}
                <div>
                  <Label htmlFor="auth-code" text="Código de 6 dígitos" />
                  <input id="auth-code" type="text" inputMode="numeric" maxLength={6} value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={onKey}
                    onFocus={() => setFocused("code")} onBlur={() => setFocused(null)}
                    placeholder="000000"
                    style={{ ...inputStyle("code", false), letterSpacing: "0.35em", textAlign: "center", fontSize: 18, fontWeight: 600 }}
                    autoComplete="one-time-code" />
                </div>

                {/* Nueva contraseña */}
                <div>
                  <Label htmlFor="auth-password" text="Nueva contraseña" right={password ? (
                    <span style={{ fontSize: 10, color: strengthColor, fontWeight: 600, fontFamily: font }}>{strengthLabel}</span>
                  ) : null} />
                  <div style={{ position: "relative" }}>
                    <input id="auth-password" type={showP ? "text" : "password"} value={password} onChange={e => setPass(e.target.value)} onKeyDown={onKey}
                      onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                      placeholder="Mínimo 8 caracteres"
                      style={{ ...inputStyle("pass", false), paddingRight: 52 }}
                      autoComplete="new-password" />
                    <button type="button" aria-label={showP ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showP} onClick={() => setShowP(s => !s)} style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                    }}>{showP ? "Ocultar" : "Ver"}</button>
                  </div>
                </div>

                {/* Confirmar nueva contraseña */}
                <div>
                  <Label htmlFor="auth-confirm" text="Confirmar nueva contraseña" />
                  <input id="auth-confirm" type={showP ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onKey}
                    onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                    placeholder="Repite la nueva contraseña"
                    style={inputStyle("confirm", confirm && password !== confirm)}
                    autoComplete="new-password" />
                </div>
              </div>

              {error && (
                <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(232,129,140,0.07)", border: "1px solid rgba(232,129,140,0.2)", marginBottom: 14 }}>
                  <p role="alert" style={{ fontSize: 12, color: "#A1263A", fontFamily: font }}>{error}</p>
                </div>
              )}

              <button type="button" onClick={doVerifyCode} disabled={loading} style={{
                width: "100%", padding: "13px 0", borderRadius: 11, border: `1px solid ${P.actionBorder}`,
                cursor: loading ? "not-allowed" : "pointer",
                background: loading ? P.bg3 : P.actionG,
                color: P.actionInk, fontSize: 14, fontWeight: 700, fontFamily: fontD, marginBottom: 12,
              }}>
                {loading ? loadingLabel : "Cambiar contraseña →"}
              </button>

              <button type="button" disabled={loading} onClick={() => go("forgot")} style={{ color: P.accent, background: "transparent", border: "none", minHeight: 44 }}>Corregir correo</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={doForgot} disabled={loading || resendSeconds > 0} style={{
                  flex: 1, padding: "10px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                  border: `1px solid ${P.border}`, background: "transparent",
                  color: P.txt2, fontSize: 12, fontFamily: font,
                }}>{resendSeconds ? `Reenviar en ${resendSeconds} s` : "Reenviar código"}</button>
                <button type="button" onClick={() => go("login")} disabled={loading} style={{
                  flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${P.border}`, background: "transparent",
                  color: P.txt2, fontSize: 12, fontFamily: font,
                }}>Volver al acceso</button>
              </div>
            </div>
          ) : (
            <>
              {/* ─ Título ─ */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  {mode === "login" ? "Acceso a la plataforma" : mode === "register" ? "Acceso por invitación" : "Recuperar acceso"}
                </p>
                <h2 style={{ fontSize: 28, fontWeight: 600, color: P.txt, fontFamily: fontD, letterSpacing: "-0.02em" }}>
                  {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Solicitar acceso" : "Olvidé mi contraseña"}
                </h2>
              </div>

              {/* ─ Tabs ─ (en la app nativa no hay alta: queda solo iniciar sesión) */}
              {!nativo && (mode === "login" || mode === "register") && (
                <div style={{ display: "flex", gap: 3, background: "#F7FAFD", borderRadius: 10, padding: 3, marginBottom: 24 }}>
                  {[["login","Iniciar sesión"],["register","Solicitar acceso"]].map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => go(m)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                      background: mode === m ? "#E4EFF8" : "transparent",
                      color: mode === m ? P.txt : P.txt2,
                      fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.18s",
                    }}>{lbl}</button>
                  ))}
                </div>
              )}


              {/* ─ SOLICITAR ACCESO (modo register) — formulario self-service ─ */}
              {mode === "register" ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                    {/* Nombre completo */}
                    <div>
                      <Label htmlFor="auth-name" text="Nombre completo" />
                      <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                        placeholder="Tu nombre y apellido" style={inputStyle("name", false)} autoComplete="name" />
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="auth-email" text="Correo electrónico" />
                      <input id="auth-email" type="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                        placeholder="correo@empresa.com" style={inputStyle("email", false)} autoComplete="email" />
                    </div>

                    {/* Contraseña */}
                    <div>
                      <Label htmlFor="auth-password" text="Contraseña" right={password ? (
                        <span style={{ fontSize: 10, color: strengthColor, fontWeight: 600, fontFamily: font }}>
                          {strengthLabel}
                        </span>
                      ) : null} />
                      <div style={{ position: "relative" }}>
                        <input id="auth-password" type={showP ? "text" : "password"} value={password} onChange={e => setPass(e.target.value)} onKeyDown={onKey}
                          onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                          placeholder="Mínimo 8 caracteres"
                          style={{ ...inputStyle("pass", false), paddingRight: 52 }}
                          autoComplete="new-password" />
                        <button type="button" aria-label={showP ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showP} onClick={() => setShowP(s => !s)} style={{
                          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                        }}>{showP ? "Ocultar" : "Ver"}</button>
                      </div>
                      {/* Indicador de fuerza */}
                      {password && (
                        <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} style={{
                              flex: 1, height: 3, borderRadius: 2,
                              background: n <= pw ? strengthColor : "#EAF2F8",
                              transition: "background 0.2s",
                            }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Confirmar contraseña */}
                    <div>
                      <Label htmlFor="auth-confirm" text="Confirmar contraseña" />
                      <div style={{ position: "relative" }}>
                        <input id="auth-confirm" type={showC ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onKey}
                          onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                          placeholder="Repite la contraseña"
                          style={{ ...inputStyle("confirm", confirm && password !== confirm), paddingRight: 52 }}
                          autoComplete="new-password" />
                        <button type="button" aria-label={showC ? "Ocultar confirmación" : "Mostrar confirmación"} aria-pressed={showC} onClick={() => setShowC(s => !s)} style={{
                          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                        }}>{showC ? "Ocultar" : "Ver"}</button>
                      </div>
                    </div>

                    {/* Correo de recuperación (opcional) — a donde llega el código si olvidas la clave */}
                    <div>
                      <Label htmlFor="auth-recovery" text="Correo de recuperación (opcional)" />
                      <input id="auth-recovery" type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("recovery")} onBlur={() => setFocused(null)}
                        placeholder="Para recuperar tu acceso si olvidas la clave" style={inputStyle("recovery", false)} autoComplete="email" />
                    </div>
                  </div>

                  {/* ─ Error ─ */}
                  {error && (
                    <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(232,129,140,0.07)", border: "1px solid rgba(232,129,140,0.2)", marginBottom: 14 }}>
                      <p role="alert" style={{ fontSize: 12, color: "#A1263A", fontFamily: font }}>{error}</p>
                    </div>
                  )}

                  {/* ─ Botón crear cuenta ─ */}
                  <button type="button"
                    onClick={doRegister}
                    disabled={loading}
                    style={{
                      width: "100%", padding: "13px 0", borderRadius: 11, border: `1px solid ${P.actionBorder}`,
                      cursor: loading ? "not-allowed" : "pointer",
                      background: loading
                        ? P.bg3
                        : P.actionG,
                      color: P.actionInk, fontSize: 14, fontWeight: 700, fontFamily: fontD,
                      transition: "all 0.2s", marginBottom: 12,
                      boxShadow: loading ? "none" : `0 4px 20px ${P.accent}33`,
                      letterSpacing: "0.01em",
                    }}
                    onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = `0 6px 26px ${P.accent}52`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = loading ? "none" : `0 4px 20px ${P.accent}33`)}
                  >
                    {loading ? loadingLabel : "Crear cuenta →"}
                  </button>

                  {/* ─ Alternativa: contacto directo por WhatsApp ─ */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 1, background: P.border }} />
                    <span style={{ fontSize: 10, color: P.txt3, letterSpacing: "0.04em" }}>o contáctanos directo</span>
                    <div style={{ flex: 1, height: 1, background: P.border }} />
                  </div>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", padding: "11px 0", borderRadius: 10,
                      border: `1px solid ${P.border}`, background: "#F7FAFD",
                      color: P.txt2, fontSize: 12, fontFamily: font,
                      textDecoration: "none", transition: "all 0.18s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#EAF2F8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#F7FAFD"; }}
                  >Solicitar acceso por WhatsApp</a>

                  <p style={{ fontSize: 11, color: P.txt3, textAlign: "center", marginTop: 14 }}>
                    ¿Ya tienes cuenta?{" "}
                    <button type="button" className="login-text-button" onClick={() => go("login")}>Iniciar sesión →</button>
                  </p>
                </>
              ) : (
                <>
                  {/* ─ Campos (login / forgot) ─ */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>

                    {/* Email */}
                    <div>
                      <Label htmlFor="auth-email" text={mode === "login" ? "Correo o usuario" : "Correo electrónico"} />
                      <input id="auth-email" type={mode === "login" ? "text" : "email"} autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                        placeholder={mode === "login" ? "correo@empresa.com o usuario" : "correo@empresa.com"} style={inputStyle("email", false)} autoComplete={mode === "login" ? "username" : "email"} />
                    </div>

                    {/* Contraseña */}
                    {mode === "login" && (
                      <div>
                        <Label htmlFor="auth-password" text="Contraseña" right={
                          <button type="button" onClick={() => go("forgot")} style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 11, color: P.accent, fontFamily: font, padding: 0,
                          }}>¿Olvidaste tu contraseña?</button>
                        } />
                        <div style={{ position: "relative" }}>
                          <input id="auth-password" type={showP ? "text" : "password"} value={password} onChange={e => setPass(e.target.value)} onKeyDown={onKey}
                            onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                            placeholder="••••••••"
                            style={{ ...inputStyle("pass", false), paddingRight: 52 }}
                            autoComplete="current-password" />
                          <button type="button" aria-label={showP ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showP} onClick={() => setShowP(s => !s)} style={{
                            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer",
                            color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                          }}>{showP ? "Ocultar" : "Ver"}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─ Error ─ */}
                  {error && (
                    <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(232,129,140,0.07)", border: "1px solid rgba(232,129,140,0.2)", marginBottom: 14 }}>
                      <p role="alert" style={{ fontSize: 12, color: "#A1263A", fontFamily: font }}>{error}</p>
                    </div>
                  )}

                  {/* ─ Acción principal ─ */}
                  <button type="button"
                    onClick={mode === "login" ? doLogin : doForgot}
                    disabled={loading || (mode === "forgot" && resendSeconds > 0)}
                    style={{
                      width: "100%", padding: "13px 0", borderRadius: 11, border: `1px solid ${P.actionBorder}`,
                      cursor: loading ? "not-allowed" : "pointer",
                      background: loading
                        ? P.bg3
                        : P.actionG,
                      color: P.actionInk, fontSize: 14, fontWeight: 700, fontFamily: fontD,
                      transition: "all 0.2s", marginBottom: 12,
                      boxShadow: loading ? "none" : `0 4px 20px ${P.accent}33`,
                      letterSpacing: "0.01em",
                    }}
                    onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = `0 6px 26px ${P.accent}52`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = loading ? "none" : `0 4px 20px ${P.accent}33`)}
                  >
                    {loading ? loadingLabel :
                      mode === "login" ? "Iniciar sesión →" : resendSeconds ? `Reenviar en ${resendSeconds} s` : "Enviar código de recuperación →"}
                  </button>

                  {mode === "forgot" && (
                    <button type="button" disabled={loading} onClick={() => {
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                        setError("Ingresa el correo de tu cuenta antes de continuar."); return;
                      }
                      setError(""); setPass(""); setConfirm(""); setCode(""); setMode("forgot-code");
                    }} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${P.border}`, background: "transparent", color: P.txt2, cursor: "pointer", marginBottom: 12 }}>
                      Ya tengo un código
                    </button>
                  )}

                  {/* ─ Volver (forgot) ─ */}
                  {mode === "forgot" && (
                    <button type="button" disabled={loading} onClick={() => go("login")} style={{
                      width: "100%", padding: "10px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${P.border}`, background: "transparent",
                      color: P.txt2, fontSize: 12, fontFamily: font, marginBottom: 12,
                    }}>← Volver al inicio de sesión</button>
                  )}

                  {/* ─ Demo (solo Stratos/Duke — clientes white-label no la ven) ─ */}
                  {mode === "login" && isDuke && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, height: 1, background: P.border }} />
                        <span style={{ fontSize: 10, color: P.txt3, letterSpacing: "0.04em" }}>o prueba la demo</span>
                        <div style={{ flex: 1, height: 1, background: P.border }} />
                      </div>
                      <button type="button" onClick={doDemo} disabled={loading} style={{
                        width: "100%", padding: "11px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                        background: "#F7FAFD", border: `1px solid ${P.border}`,
                        color: P.txt2, fontSize: 12, fontFamily: font, transition: "all 0.18s",
                      }}
                        onMouseEnter={e => !loading && (e.currentTarget.style.background = "#EAF2F8")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#F7FAFD")}
                      >Entrar como Demo — acceso completo sin registro</button>
                    </>
                  )}

                  {/* ─ Solicitar acceso link ─ */}
                  {mode === "login" && !nativo && (
                    <p style={{ fontSize: 11, color: P.txt3, textAlign: "center", marginTop: 14 }}>
                      ¿No tienes cuenta?{" "}
                      <button type="button" className="login-text-button" onClick={() => go("register")}>Solicitar acceso →</button>
                    </p>
                  )}
                </>
              )}

              {/* ─ Legal ─ */}
              <p style={{ fontSize: 12, color: P.txt3, textAlign: "center", marginTop: 20, lineHeight: 1.65 }}>
                {/* Eran <span> decorativos: no abrían nada, y App Review comprueba que
                      los enlaces legales funcionen. target="_blank" los manda al
                      navegador del sistema, que es lo correcto dentro de la app:
                      esas páginas viven en el sitio y no se empaquetan en el binario. */}
                  Al continuar aceptas los{" "}
                  <a href="https://stratoscapitalgroup.com/terminos" target="_blank" rel="noopener noreferrer"
                     style={{ color: P.accent, textDecoration: "none" }}>Términos de Servicio</a>{" "}
                  y la{" "}
                  <a href="https://stratoscapitalgroup.com/politica-de-privacidad" target="_blank" rel="noopener noreferrer"
                     style={{ color: P.accent, textDecoration: "none" }}>Política de Privacidad</a>.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
