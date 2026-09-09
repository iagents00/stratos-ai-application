import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useClient } from "../hooks/useClient";

const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`;

/**
 * Acceso exclusivo del binario iOS/Android.
 *
 * Las cuentas las crea el administrador de la empresa contratante. Por eso el
 * binario solo permite iniciar sesión: no incluye alta, precios ni contratación.
 * La web conserva su flujo comercial independiente.
 */
export default function LoginScreenNative({ onLogin }) {
  const { config } = useClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const brandName = config?.name || "Stratos AI";
  const accent = config?.brand?.accent || "#6EE7C2";

  const submit = async (event) => {
    event?.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Completa correo y contraseña.");
      return;
    }
    setLoading(true);
    const result = await onLogin(email.trim().toLowerCase(), password);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="login-title">
        <div style={{ ...styles.mark, borderColor: `${accent}66`, color: accent }}>S</div>
        <p style={styles.brand}>{brandName}</p>
        <h1 id="login-title" style={styles.title}>Inicia sesión</h1>
        <p style={styles.subtitle}>Usa la cuenta que te proporcionó tu empresa.</p>

        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label} htmlFor="native-email">Correo</label>
          <input
            id="native-email"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={styles.input}
            disabled={loading}
          />

          <label style={styles.label} htmlFor="native-password">Contraseña</label>
          <div style={styles.passwordWrap}>
            <input
              id="native-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ ...styles.input, paddingRight: 48, width: "100%" }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              style={styles.eye}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          {error && <p role="alert" style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...styles.button, background: accent }}>
            <LogIn size={18} />
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p style={styles.help}>Si no tienes acceso, solicítalo al administrador de tu empresa.</p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    padding: "max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))",
    background: "radial-gradient(circle at 50% 10%, #132338 0, #070B12 42%, #05080D 100%)",
    color: "#E8EEF7",
    fontFamily: font,
  },
  card: {
    width: "min(100%, 420px)",
    boxSizing: "border-box",
    padding: "36px 26px 28px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 24,
    background: "rgba(10,17,28,.92)",
    boxShadow: "0 24px 70px rgba(0,0,0,.35)",
  },
  mark: {
    width: 54,
    height: 54,
    margin: "0 auto 14px",
    border: "1px solid",
    borderRadius: 17,
    display: "grid",
    placeItems: "center",
    fontSize: 29,
    fontWeight: 700,
  },
  brand: { margin: 0, textAlign: "center", color: "#AAB7C8", fontSize: 14, fontWeight: 650 },
  title: { margin: "20px 0 8px", textAlign: "center", fontSize: 28, letterSpacing: "-.5px" },
  subtitle: { margin: "0 auto 28px", textAlign: "center", color: "#8C9BAE", lineHeight: 1.45, fontSize: 15 },
  form: { display: "grid", gap: 10 },
  label: { marginTop: 6, color: "#B8C4D3", fontSize: 13, fontWeight: 600 },
  input: {
    boxSizing: "border-box",
    height: 50,
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 13,
    padding: "0 14px",
    outline: "none",
    background: "#0E1724",
    color: "#F2F6FB",
    fontSize: 16,
    fontFamily: font,
  },
  passwordWrap: { position: "relative", width: "100%" },
  eye: {
    position: "absolute",
    right: 5,
    top: 4,
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    border: 0,
    background: "transparent",
    color: "#8C9BAE",
  },
  error: { margin: "6px 0 0", color: "#F7A2AC", fontSize: 14, lineHeight: 1.4 },
  button: {
    height: 50,
    marginTop: 12,
    border: 0,
    borderRadius: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    color: "#07120F",
    fontSize: 16,
    fontWeight: 750,
    fontFamily: font,
  },
  help: { margin: "24px 0 0", textAlign: "center", color: "#657489", fontSize: 13, lineHeight: 1.45 },
};
