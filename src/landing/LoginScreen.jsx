/**
 * LoginScreen — Pantalla de autenticación completa para la app
 * Reside en: app.stratoscapitalgroup.com
 *
 * Modos: login | register | forgot | forgot-sent
 */
import { useState, useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";

const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

const P = {
  bg: "#060A11",
  surface: "#0B1220",
  accent: "#6EE7C2",
  accentS: "rgba(110,231,194,0.08)",
  accentB: "rgba(110,231,194,0.18)",
  border: "rgba(255,255,255,0.07)",
  txt: "#E2E8F0",
  txt2: "#8B99AE",
  txt3: "#4A5568",
  rose: "#E8818C",
};

// Logo Stratos (SVG inline)
function StratosAtom({ size = 20, color = "#FFFFFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.2" opacity="0.3" />
      <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.2" opacity="0.6" />
      <circle cx="16" cy="16" r="1.5" fill={color} />
      <ellipse cx="16" cy="16" rx="10" ry="4" stroke={color} strokeWidth="1"
        opacity="0.25" transform="rotate(-35 16 16)" />
    </svg>
  );
}

// Sembrar cuenta demo
function seedDemo() {
  try {
    const users = JSON.parse(localStorage.getItem("stratos_users") || "[]");
    if (!users.find(u => u.email === "demo@stratos.ai")) {
      users.unshift({ id: 1, name: "Usuario Demo", email: "demo@stratos.ai", password: "Demo2024" });
      localStorage.setItem("stratos_users", JSON.stringify(users));
    }
  } catch {}
}

export default function LoginScreen({ onLogin }) {
  useEffect(() => { seedDemo(); }, []);

  const [mode, setMode]       = useState("login"); // login | register | forgot | forgot-sent
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [showP, setShowP]     = useState(false);
  const [showC, setShowC]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoad]    = useState(false);
  const [focused, setFocused] = useState(null);

  // Fuerza de contraseña
  const pw = (() => {
    let s = 0;
    if (password.length >= 6)  s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9!@#$%^&*]/.test(password)) s++;
    return s;
  })();
  const strengthColor = ["#E8818C","#F59E0B","#67B7D1","#6EE7C2"][pw - 1] || P.txt3;
  const strengthLabel = ["Muy débil","Débil","Buena","Fuerte"][pw - 1] || "";

  const reset = () => { setName(""); setEmail(""); setPass(""); setConfirm(""); setError(""); };
  const go    = (m) => { setMode(m); reset(); };

  const inputStyle = (field, hasErr) => ({
    width: "100%", padding: "12px 14px", borderRadius: 10, outline: "none",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${hasErr ? "rgba(232,129,140,0.5)" : focused === field ? P.accentB : P.border}`,
    color: P.txt, fontSize: 13, fontFamily: font, transition: "border-color 0.2s",
  });

  const Label = ({ text, right }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <label style={{ fontSize: 10, color: P.txt2, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>{text}</label>
      {right}
    </div>
  );

  /* ─── ACCIONES ─── */
  const doLogin = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Completa todos los campos."); return; }
    setLoad(true);
    const result = await onLogin(email.trim().toLowerCase(), password);
    if (result?.error) { setError(result.error); setLoad(false); }
    // Si no hay error, App.jsx desmonta LoginScreen automáticamente
  };

  const doRegister = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password || !confirm) { setError("Completa todos los campos."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Correo electrónico inválido."); return; }
    if (password.length < 6) { setError("Mínimo 6 caracteres en la contraseña."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoad(true);
    const result = await onLogin(email.trim().toLowerCase(), password, { name: name.trim(), isRegister: true });
    if (result?.error) { setError(result.error); setLoad(false); }
  };

  const doForgot = () => {
    setError("");
    if (!email.trim()) { setError("Ingresa tu correo."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Correo inválido."); return; }
    setLoad(true);
    setTimeout(() => { setLoad(false); setMode("forgot-sent"); }, 900);
  };

  const doDemo = async () => {
    setLoad(true);
    const result = await onLogin("demo@stratos.ai", "Demo2024");
    if (result?.error) { setError(result.error); setLoad(false); }
  };

  const onKey = (e) => {
    if (e.key !== "Enter") return;
    if (mode === "login") doLogin();
    else if (mode === "register") doRegister();
    else if (mode === "forgot") doForgot();
  };

  return (
    <div style={{
      minHeight: "100vh", background: P.bg, display: "flex", fontFamily: font,
      backgroundImage: `
        radial-gradient(ellipse at 20% 10%, rgba(110,231,194,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 90%, rgba(110,231,194,0.03) 0%, transparent 40%)
      `,
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 2px; }
      `}</style>

      {/* Panel izquierdo — branding (desktop) */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 80px", borderRight: `1px solid ${P.border}`,
        background: "linear-gradient(145deg, rgba(110,231,194,0.02) 0%, transparent 60%)",
      }} className="brand-panel">
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
            <StratosAtom size={28} color={P.accent} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em" }}>
              Stratos <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>AI</span>
            </span>
          </div>

          <h1 style={{ fontSize: 38, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 20 }}>
            El sistema operativo<br />
            <span style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, rgba(110,231,194,0.7) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              que escala tu empresa
            </span>
          </h1>
          <p style={{ fontSize: 14, color: P.txt2, lineHeight: 1.75, marginBottom: 48 }}>
            CRM inteligente · Pipeline automático · IA comercial<br />
            Todo en un solo lugar, diseñado para cerrar más.
          </p>

          {/* Métricas */}
          <div style={{ display: "flex", gap: 32 }}>
            {[["$40M+","En transacciones gestionadas"],["8–13%","ROI anual documentado"],["47","Agentes IA activos"]].map(([v, l]) => (
              <div key={v}>
                <p style={{ fontSize: 22, fontWeight: 300, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.03em", lineHeight: 1 }}>{v}</p>
                <p style={{ fontSize: 10, color: P.txt3, marginTop: 4, lineHeight: 1.4 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{
        width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 40px",
        flexShrink: 0,
      }}>
        <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp 0.35s ease both" }}>

          {/* ─ EMAIL ENVIADO ─ */}
          {mode === "forgot-sent" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: P.accentS, border: `1px solid ${P.accentB}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <CheckCircle2 size={28} color={P.accent} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, marginBottom: 8 }}>Revisa tu correo</h2>
              <p style={{ fontSize: 13, color: P.txt2, lineHeight: 1.7, marginBottom: 6 }}>
                Enviamos un enlace de recuperación a
              </p>
              <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 600, marginBottom: 24 }}>{email}</p>
              <div style={{ padding: "10px 14px", borderRadius: 9, background: P.accentS, border: `1px solid ${P.accentB}`, marginBottom: 20, textAlign: "left" }}>
                <p style={{ fontSize: 11, color: "rgba(110,231,194,0.8)", lineHeight: 1.6 }}>
                  Para activar el envío real de emails conecta Supabase Auth. El plan completo está en <code style={{ fontSize: 10 }}>CLAUDE.md</code>.
                </p>
              </div>
              <button onClick={() => go("login")} style={{
                width: "100%", padding: "11px", borderRadius: 10,
                border: `1px solid ${P.border}`, background: "rgba(255,255,255,0.04)",
                color: P.txt, fontSize: 13, fontWeight: 500, fontFamily: font, cursor: "pointer",
              }}>← Volver al inicio de sesión</button>
            </div>
          ) : (
            <>
              {/* ─ Título ─ */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  {mode === "login" ? "Acceso a la plataforma" : mode === "register" ? "Nueva cuenta" : "Recuperar acceso"}
                </p>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", fontFamily: fontD, letterSpacing: "-0.02em" }}>
                  {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Crear cuenta gratis" : "Olvidé mi contraseña"}
                </h2>
              </div>

              {/* ─ Tabs ─ */}
              {(mode === "login" || mode === "register") && (
                <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, marginBottom: 24 }}>
                  {[["login","Iniciar sesión"],["register","Crear cuenta"]].map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => go(m)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                      background: mode === m ? "rgba(255,255,255,0.09)" : "transparent",
                      color: mode === m ? "#FFFFFF" : "rgba(255,255,255,0.38)",
                      fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.18s",
                    }}>{lbl}</button>
                  ))}
                </div>
              )}

              {/* ─ Google Sign-In ─ */}
              {(mode === "login" || mode === "register") && (
                <>
                  <button
                    type="button"
                    onClick={() => alert("Conecta Supabase Auth con Google OAuth para habilitar este acceso.")}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 14,
                      border: `1px solid ${P.border}`, background: "rgba(255,255,255,0.04)",
                      color: "#FFFFFF", fontSize: 13, fontWeight: 500, fontFamily: font,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = P.border; }}
                  >
                    {/* Google icon SVG */}
                    <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                    </svg>
                    Continuar con Google
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                    <span style={{ fontSize: 10, color: P.txt3, letterSpacing: "0.04em" }}>o con correo</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                  </div>
                </>
              )}

              {/* ─ Campos ─ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>

                {/* Nombre */}
                {mode === "register" && (
                  <div>
                    <Label text="Nombre completo" />
                    <input value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey}
                      onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                      placeholder="Tu nombre completo" style={inputStyle("name", false)} autoComplete="name" />
                  </div>
                )}

                {/* Email */}
                <div>
                  <Label text="Correo electrónico" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
                    onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                    placeholder="correo@empresa.com" style={inputStyle("email", false)} autoComplete="email" />
                </div>

                {/* Contraseña */}
                {(mode === "login" || mode === "register") && (
                  <div>
                    <Label text="Contraseña" right={
                      mode === "login" && (
                        <button type="button" onClick={() => go("forgot")} style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11, color: P.accent, fontFamily: font, padding: 0,
                        }}>¿Olvidaste tu contraseña?</button>
                      )
                    } />
                    <div style={{ position: "relative" }}>
                      <input type={showP ? "text" : "password"} value={password} onChange={e => setPass(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                        placeholder={mode === "register" ? "Mínimo 6 caracteres" : "••••••••"}
                        style={{ ...inputStyle("pass", false), paddingRight: 52 }}
                        autoComplete={mode === "login" ? "current-password" : "new-password"} />
                      <button type="button" onClick={() => setShowP(s => !s)} style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                      }}>{showP ? "Ocultar" : "Ver"}</button>
                    </div>
                    {/* Barra de fuerza */}
                    {mode === "register" && password.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, transition: "background 0.3s",
                              background: i < pw ? strengthColor : "rgba(255,255,255,0.07)" }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 10, color: strengthColor, fontFamily: font }}>{strengthLabel}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmar contraseña */}
                {mode === "register" && (
                  <div>
                    <Label text="Confirmar contraseña" right={
                      confirm && (
                        <span style={{ fontSize: 10, fontFamily: font, color: confirm === password ? P.accent : P.rose }}>
                          {confirm === password ? "✓ Coinciden" : "No coinciden"}
                        </span>
                      )
                    } />
                    <div style={{ position: "relative" }}>
                      <input type={showC ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onKey}
                        onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)}
                        placeholder="Repite tu contraseña"
                        style={{ ...inputStyle("confirm", !!(confirm && confirm !== password)), paddingRight: 52 }}
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowC(s => !s)} style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: P.txt3, fontSize: 11, fontFamily: font, padding: 0,
                      }}>{showC ? "Ocultar" : "Ver"}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─ Error ─ */}
              {error && (
                <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(232,129,140,0.07)", border: "1px solid rgba(232,129,140,0.2)", marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: "#E8A0A0", fontFamily: font }}>{error}</p>
                </div>
              )}

              {/* ─ Acción principal ─ */}
              <button type="button"
                onClick={mode === "login" ? doLogin : mode === "register" ? doRegister : doForgot}
                disabled={loading}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  background: loading
                    ? "rgba(110,231,194,0.25)"
                    : "linear-gradient(135deg, #6EE7C2 0%, #3BC9A8 100%)",
                  color: "#04080F", fontSize: 14, fontWeight: 700, fontFamily: fontD,
                  transition: "all 0.2s", marginBottom: 12,
                  boxShadow: loading ? "none" : "0 4px 20px rgba(110,231,194,0.20)",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = "0 6px 26px rgba(110,231,194,0.32)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = loading ? "none" : "0 4px 20px rgba(110,231,194,0.20)")}
              >
                {loading ? "Procesando..." :
                  mode === "login"    ? "Iniciar sesión →" :
                  mode === "register" ? "Crear cuenta gratis →" :
                                        "Enviar enlace de recuperación →"}
              </button>

              {/* ─ Volver (forgot) ─ */}
              {mode === "forgot" && (
                <button type="button" onClick={() => go("login")} style={{
                  width: "100%", padding: "10px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${P.border}`, background: "transparent",
                  color: P.txt2, fontSize: 12, fontFamily: font, marginBottom: 12,
                }}>← Volver al inicio de sesión</button>
              )}

              {/* ─ Demo ─ */}
              {(mode === "login" || mode === "register") && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                    <span style={{ fontSize: 10, color: P.txt3, letterSpacing: "0.04em" }}>o accede sin registro</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                  </div>
                  <button type="button" onClick={doDemo} disabled={loading} style={{
                    width: "100%", padding: "11px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer",
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`,
                    color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: font, transition: "all 0.18s",
                  }}
                    onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  >Entrar como Demo — acceso completo sin registro</button>
                </>
              )}

              {/* ─ Planes link ─ */}
              {mode === "login" && (
                <p style={{ fontSize: 11, color: P.txt3, textAlign: "center", marginTop: 14 }}>
                  ¿Aún no tienes cuenta?{" "}
                  <span onClick={() => alert("Visita la página de precios para conocer los planes disponibles.")} style={{ color: P.accent, cursor: "pointer", fontWeight: 600 }}>Ver planes →</span>
                </p>
              )}

              {/* ─ Legal ─ */}
              <p style={{ fontSize: 10, color: P.txt3, textAlign: "center", marginTop: 14, lineHeight: 1.65 }}>
                Al continuar aceptas los <span style={{ color: "rgba(110,231,194,0.6)", cursor: "pointer" }}>Términos de Servicio</span>{" "}
                y la <span style={{ color: "rgba(110,231,194,0.6)", cursor: "pointer" }}>Política de Privacidad</span>.
              </p>
            </>
          )}
        </div>
      </div>

      {/* CSS responsive */}
      <style>{`
        @media (max-width: 768px) {
          .brand-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
