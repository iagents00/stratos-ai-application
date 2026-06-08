/**
 * views/Profile.jsx — vista de perfil del asesor.
 *
 * Único panel: "Conectar Telegram" (Fase 1, simple).
 *
 * Flujo:
 *   1. Asesor click "Conectar mi Telegram" → llama RPC para generar código (8 dígitos, vigente 10 min)
 *   2. Abre nueva pestaña a `https://t.me/<bot>?start=<code>` — Telegram pre-llena el botón START.
 *   3. Asesor da click START en Telegram → bot recibe `/start <code>` → consume el código.
 *   4. Esta pantalla detecta el pareo (polling cada 5s) y cambia a estado "Conectado".
 *
 * Si `VITE_TELEGRAM_BOT_USERNAME` no está seteado, fallback al flujo manual:
 * mostramos el código y las instrucciones para `/conectar XXXXXXXX`.
 *
 * Migración: 007_telegram_bot_asesor_mode.sql
 * Lib:       src/lib/telegram.js
 * Workflow:  n8n/workflows/stratos-telegram-bot-v3-asesor.json
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Check, X, ExternalLink, MessageCircle, RefreshCw, User, Bot, Lock, PhoneCall, Globe } from "lucide-react";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G, Pill } from "../SharedComponents";
import { useAuth } from "../../hooks/useAuth";
import { useClient } from "../../hooks/useClient";
import { supabase } from "../../lib/supabase";
import {
  getPairingStatus,
  requestPairingCode,
  unpairTelegram,
  getRecentBotActivity,
} from "../../lib/telegram";

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin:       "Admin",
  ceo:         "CEO",
  director:    "Director",
  asesor:      "Asesor",
};

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

export default function Profile({ theme = "dark", T: Tprop }) {
  const { user } = useAuth();
  const { config: clientConfig } = useClient();
  const isLight = theme === "light";
  const T = Tprop || (isLight ? LP : P);

  return (
    <div style={{ padding: "32px 28px 80px", maxWidth: 760, margin: "0 auto", fontFamily: font }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{
          margin: "0 0 8px",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: isLight ? T.txt3 : "rgba(255,255,255,0.36)",
          fontFamily: fontDisp,
        }}>
          Perfil
        </p>
        <h1 style={{
          margin: "0 0 6px",
          fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em",
          color: T.txt, fontFamily: fontDisp,
        }}>
          {user?.name || "Sin nombre"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: T.txt2 }}>{user?.email}</span>
          <span style={{ color: T.txt3 }}>·</span>
          <Pill color={T.violet} isLight={isLight}>{ROLE_LABEL[user?.role] || user?.role}</Pill>
        </div>
      </div>

      <PasswordPanel T={T} isLight={isLight} user={user} />
      <SupportPanel T={T} isLight={isLight} clientConfig={clientConfig} />
      <TimezonePanel T={T} isLight={isLight} user={user} />
      <ConnectTelegramPanel T={T} isLight={isLight} />
      <RecentBotActivity T={T} isLight={isLight} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  System (cambio de contrasena) + Soporte directo                         */
/* ─────────────────────────────────────────────────────────────────────── */

function normalizePhoneHref(value) {
  const cleaned = String(value || "").replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function normalizeWaHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent("Hola, necesito soporte con el CRM.")}` : null;
}

function PasswordPanel({ T = P, isLight = false, user }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const disabled = user?.isDemo || user?._offline;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setErrorMsg("");
    if (disabled) return setErrorMsg("Conectate a Supabase para cambiar la contrasena.");
    if (password.length < 8) return setErrorMsg("Usa minimo 8 caracteres.");
    if (password !== confirmPassword) return setErrorMsg("Las contrasenas no coinciden.");

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) return setErrorMsg(error.message || "No se pudo actualizar la contrasena.");
    setPassword("");
    setConfirmPassword("");
    setMessage("Contrasena actualizada correctamente.");
  };

  return (
    <G T={T} style={{ padding: 24, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lock size={18} color={T.accent} strokeWidth={1.9} />
        </div>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>System</h2>
          <p style={{ margin: 0, fontSize: 12, color: T.txt2 }}>Cambia tu contrasena de acceso sin pedir soporte.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contrasena" autoComplete="new-password" disabled={disabled || busy} style={inputStyle(T, isLight)} />
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar contrasena" autoComplete="new-password" disabled={disabled || busy} style={inputStyle(T, isLight)} />
        <button type="submit" disabled={disabled || busy} style={{ height: 40, borderRadius: 11, border: "none", background: disabled || busy ? (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)") : T.accent, color: disabled || busy ? T.txt3 : "#06120E", fontWeight: 800, fontFamily: fontDisp, cursor: disabled || busy ? "not-allowed" : "pointer" }}>
          {busy ? "Actualizando..." : "Actualizar contrasena"}
        </button>
      </form>
      {(message || errorMsg) && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 12, color: errorMsg ? (isLight ? "#B91C1C" : "#FCA5A5") : (isLight ? "#047857" : "#6EE7C2"), background: errorMsg ? (isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)") : `${T.accent}12`, border: `1px solid ${errorMsg ? (isLight ? "rgba(225,29,72,0.22)" : "rgba(248,113,113,0.22)") : `${T.accent}2A`}` }}>
          {errorMsg || message}
        </div>
      )}
    </G>
  );
}

function SupportPanel({ T = P, isLight = false, clientConfig }) {
  const label = clientConfig?.support?.phoneLabel || clientConfig?.support?.whatsapp || "";
  const telHref = normalizePhoneHref(label);
  const waHref = normalizeWaHref(clientConfig?.support?.whatsapp || label);
  if (!telHref && !waHref) return null;

  return (
    <G T={T} style={{ padding: 24, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <PhoneCall size={18} color={T.accent} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Soporte directo</h2>
          <p style={{ margin: 0, fontSize: 12, color: T.txt2 }}>Mientras activamos mas funciones, llama o escribe a soporte.</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {telHref && <a href={telHref} style={supportButtonStyle(T, isLight, true)}><PhoneCall size={14} /> Llamar {label}</a>}
        {waHref && <a href={waHref} target="_blank" rel="noreferrer" style={supportButtonStyle(T, isLight, false)}><MessageCircle size={14} /> WhatsApp soporte</a>}
      </div>
    </G>
  );
}

function inputStyle(T, isLight) {
  return { height: 40, borderRadius: 11, border: `1px solid ${T.border}`, background: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.045)", color: T.txt, padding: "0 12px", fontFamily: font, fontSize: 13, outline: "none" };
}

function supportButtonStyle(T, isLight, primary) {
  return { display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 13px", borderRadius: 11, textDecoration: "none", fontSize: 13, fontWeight: 800, fontFamily: fontDisp, color: primary ? "#06120E" : T.txt, background: primary ? T.accent : (isLight ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.055)"), border: primary ? "none" : `1px solid ${T.border}` };
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  TimezonePanel — zona horaria del asesor (default Cancun para Stratos)  */
/* ─────────────────────────────────────────────────────────────────────── */

// Lista curada de zonas IANA mas usadas para clientes Stratos.
// Cancun primero porque es el default para Duke (todos sus asesores estan en
// Quintana Roo, que NO tiene DST). El asesor puede elegir otra si vive en
// una zona diferente. Ordenadas por relevancia: Mexico/LATAM primero.
const TZ_OPTIONS = [
  { value: "America/Cancun",       label: "Cancun (UTC-5, sin horario verano)" },
  { value: "America/Mexico_City",  label: "Ciudad de Mexico (UTC-6/-5)" },
  { value: "America/Monterrey",    label: "Monterrey (UTC-6/-5)" },
  { value: "America/Tijuana",      label: "Tijuana / Mexicali (UTC-8/-7)" },
  { value: "America/Bogota",       label: "Bogota (UTC-5)" },
  { value: "America/Lima",         label: "Lima (UTC-5)" },
  { value: "America/Guayaquil",    label: "Guayaquil / Quito (UTC-5)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (UTC-3)" },
  { value: "America/Santiago",     label: "Santiago (UTC-4/-3)" },
  { value: "America/Caracas",      label: "Caracas (UTC-4)" },
  { value: "America/New_York",     label: "Nueva York / Miami (UTC-5/-4)" },
  { value: "America/Los_Angeles",  label: "Los Angeles (UTC-8/-7)" },
  { value: "Europe/Madrid",        label: "Madrid (UTC+1/+2)" },
  { value: "UTC",                  label: "UTC" },
];

function TimezonePanel({ T = P, isLight = false, user }) {
  const [currentTz, setCurrentTz] = useState("America/Cancun");
  const [draftTz, setDraftTz]     = useState("America/Cancun");
  const [busy, setBusy]           = useState(false);
  const [message, setMessage]     = useState("");
  const [errorMsg, setErrorMsg]   = useState("");
  const disabled = user?.isDemo || user?._offline;

  // Detectada del navegador (solo informativo - NO se aplica automaticamente
  // porque el default de Stratos es Cancun por decision operativa).
  const detected = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
    catch { return ""; }
  })();

  useEffect(() => {
    let mounted = true;
    if (disabled) return;
    supabase.rpc("fn_get_my_timezone")
      .then(({ data, error }) => {
        if (!mounted) return;
        const tz = (!error && data) ? String(data) : "America/Cancun";
        setCurrentTz(tz);
        setDraftTz(tz);
      });
    return () => { mounted = false; };
  }, [disabled]);

  const save = async (tz) => {
    setMessage(""); setErrorMsg("");
    if (disabled) return setErrorMsg("Conectate a Supabase para cambiar la zona horaria.");
    if (!tz) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("fn_set_my_timezone", { p_tz: tz });
    setBusy(false);
    if (error) return setErrorMsg(error.message || "No se pudo actualizar la zona horaria.");
    setCurrentTz(String(data || tz));
    setDraftTz(String(data || tz));
    setMessage(`Zona horaria actualizada a ${data || tz}.`);
  };

  // Si la detectada no esta en TZ_OPTIONS, la agregamos dinamicamente
  // para que el asesor pueda elegirla aunque sea una zona menos comun.
  const options = (() => {
    const arr = [...TZ_OPTIONS];
    if (detected && !arr.some(o => o.value === detected)) {
      arr.push({ value: detected, label: `${detected} (detectada)` });
    }
    if (currentTz && !arr.some(o => o.value === currentTz)) {
      arr.push({ value: currentTz, label: `${currentTz} (actual)` });
    }
    return arr;
  })();

  return (
    <G T={T} style={{ padding: 24, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Globe size={18} color={T.accent} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>Zona horaria</h2>
          <p style={{ margin: 0, fontSize: 12, color: T.txt2 }}>
            El bot de Telegram y los recordatorios usan esta zona para interpretar y mostrar fechas. Default: Cancun.
          </p>
        </div>
      </div>

      {detected && detected !== currentTz && (
        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, fontSize: 12, color: T.txt2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span>Detectada por tu navegador: <strong style={{ color: T.txt }}>{detected}</strong></span>
          <button type="button" onClick={() => save(detected)} disabled={disabled || busy} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.accent}40`, background: `${T.accent}14`, color: T.txt, fontSize: 11, fontWeight: 700, fontFamily: fontDisp, cursor: disabled || busy ? "not-allowed" : "pointer" }}>
            Usar la detectada
          </button>
        </div>
      )}

      <select
        value={draftTz}
        onChange={(e) => setDraftTz(e.target.value)}
        disabled={disabled || busy}
        style={{
          width: "100%", height: 40, borderRadius: 11, padding: "0 12px",
          border: `1px solid ${T.border}`,
          background: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.045)",
          color: T.txt, fontFamily: font, fontSize: 13, outline: "none",
          colorScheme: isLight ? "light" : "dark",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: isLight ? "#FFFFFF" : "#0F1B2D", color: T.txt }}>
            {o.label}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.txt3 }}>
          Actual: <strong style={{ color: T.txt }}>{currentTz}</strong>
        </span>
        <button
          type="button"
          onClick={() => save(draftTz)}
          disabled={disabled || busy || draftTz === currentTz}
          style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: (disabled || busy || draftTz === currentTz) ? (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)") : T.accent, color: (disabled || busy || draftTz === currentTz) ? T.txt3 : "#06120E", fontWeight: 800, fontFamily: fontDisp, fontSize: 12, cursor: (disabled || busy || draftTz === currentTz) ? "not-allowed" : "pointer" }}
        >
          {busy ? "Guardando..." : "Guardar zona horaria"}
        </button>
      </div>

      {(message || errorMsg) && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, fontSize: 12, color: errorMsg ? (isLight ? "#B91C1C" : "#FCA5A5") : (isLight ? "#047857" : "#6EE7C2"), background: errorMsg ? (isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)") : `${T.accent}12`, border: `1px solid ${errorMsg ? (isLight ? "rgba(225,29,72,0.22)" : "rgba(248,113,113,0.22)") : `${T.accent}2A`}` }}>
          {errorMsg || message}
        </div>
      )}
    </G>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Conectar Telegram                                                       */
/* ─────────────────────────────────────────────────────────────────────── */

function ConnectTelegramPanel({ T = P, isLight = false }) {
  const [status, setStatus] = useState({ loading: true, paired: false, pairedAt: null });
  const [busy, setBusy]     = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [manualCode, setManualCode] = useState(null);   // solo si no hay BOT_USERNAME
  const pollRef = useRef(null);

  // Estado inicial
  useEffect(() => {
    let mounted = true;
    getPairingStatus().then((r) => {
      if (!mounted) return;
      setStatus({ loading: false, paired: r.paired, pairedAt: r.pairedAt });
    });
    return () => { mounted = false; };
  }, []);

  // Polling: si esperamos pareo, refresca cada 5s. Pausa en background.
  const startPolling = () => {
    stopPolling();
    if (document.hidden) return; // arranca cuando vuelva al foreground
    pollRef.current = setInterval(async () => {
      const r = await getPairingStatus();
      if (r.paired) {
        setStatus({ loading: false, paired: true, pairedAt: r.pairedAt });
        setManualCode(null);
        stopPolling();
      }
    }, 5000);
  };
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopPolling();
      else if (status.loading && !status.paired) startPolling();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
    };
  }, [status.loading, status.paired]);

  const handleConnect = async () => {
    setBusy(true);
    setErrorMsg(null);
    const r = await requestPairingCode();
    setBusy(false);
    if (r.error || !r.code) {
      setErrorMsg(
        r.error === "not_authenticated"
          ? "No estás autenticado. Vuelve a iniciar sesión."
          : "No se pudo generar el código. Intenta en un minuto."
      );
      return;
    }

    if (BOT_USERNAME) {
      // Deep link: abre Telegram con START prellenado
      window.open(`https://t.me/${BOT_USERNAME}?start=${r.code}`, "_blank", "noopener,noreferrer");
      startPolling();
    } else {
      // Sin bot username configurado → flujo manual
      setManualCode(r.code);
      startPolling();
    }
  };

  const handleUnpair = async () => {
    if (!confirm("¿Desconectar el Telegram de tu cuenta?\nEl bot dejará de reconocerte hasta que vuelvas a conectar.")) return;
    setBusy(true);
    const r = await unpairTelegram();
    setBusy(false);
    if (r.error) {
      setErrorMsg("No se pudo desconectar. Intenta de nuevo.");
      return;
    }
    setStatus({ loading: false, paired: false, pairedAt: null });
    setManualCode(null);
    stopPolling();
  };

  /* ── Render ── */

  if (status.loading) {
    return (
      <G T={T}>
        <div style={{ padding: 8, color: T.txt3, fontSize: 13 }}>Cargando…</div>
      </G>
    );
  }

  return (
    <G T={T} style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${T.accent}14`, border: `1px solid ${T.accent}2A`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Send size={18} color={T.accent} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{
            margin: "0 0 2px",
            fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
            color: T.txt, fontFamily: fontDisp,
          }}>
            Conectar Telegram
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: T.txt2 }}>
            Gestiona tus leads desde el chat del bot de Stratos.
          </p>
        </div>
        {status.paired && <Pill color={T.accent} isLight={isLight}>Conectado</Pill>}
      </div>

      <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
        {status.paired ? (
          <PairedView pairedAt={status.pairedAt} onUnpair={handleUnpair} unpairing={busy} T={T} isLight={isLight} />
        ) : manualCode ? (
          <ManualCodeView code={manualCode} T={T} isLight={isLight} />
        ) : (
          <NotPairedView onConnect={handleConnect} busy={busy} T={T} />
        )}

        {errorMsg && (
          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${isLight ? "rgba(225,29,72,0.28)" : "rgba(248,113,113,0.22)"}`,
            borderRadius: 10,
            fontSize: 12, color: isLight ? "#B91C3A" : "#FCA5A5",
          }}>
            {errorMsg}
          </div>
        )}
      </div>
    </G>
  );
}

/* ── Vista por defecto: un botón ── */
function NotPairedView({ onConnect, busy, T = P }) {
  return (
    <div>
      <div style={{ margin: "0 0 16px", fontSize: 13, color: T.txt2, lineHeight: 1.55 }}>
        {BOT_USERNAME ? (
          "Te abrimos Telegram. Solo dale START en el bot — listo."
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>1. Busca en Telegram: <strong>@Strato_sasistente_crm_bot</strong> y presiona <strong>/start</strong></span>
            <span>2. Da clic en "Generar código" aquí abajo.</span>
            <span>3. Mándale el código al bot.</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: "12px 22px", borderRadius: 12,
          background: busy ? `${T.accent}30` : T.accent,
          border: "none",
          color: "#FFFFFF",
          fontSize: 14, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.005em",
          cursor: busy ? "default" : "pointer",
          transition: "all 0.2s",
          boxShadow: `0 4px 14px ${T.accent}55`,
        }}
      >
        {busy ? "Abriendo…" : (BOT_USERNAME ? "Conectar mi Telegram" : "Generar código")}
        {!busy && <ExternalLink size={14} strokeWidth={2.2} />}
      </button>
    </div>
  );
}

/* ── Vista fallback: sin bot username configurado, mostramos código manual ── */
function ManualCodeView({ code, T = P, isLight = false }) {
  return (
    <div>
      <p style={{
        margin: "0 0 12px",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.txt3, fontFamily: fontDisp,
      }}>
        Tu código
      </p>

      <div style={{
        padding: "20px 22px",
        background: `${T.accent}0A`, border: `1px solid ${T.accent}2E`,
        borderRadius: 14,
        fontSize: 36, fontWeight: 300, letterSpacing: "0.10em",
        fontFamily: fontDisp, color: T.txt,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        marginBottom: 14,
      }}>
        {code}
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.txt2 }}>
        Abre el bot <strong>@Strato_sasistente_crm_bot</strong> en Telegram y envía:
      </p>
      <code style={{
        display: "block", padding: "10px 12px",
        background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        color: T.txt,
      }}>
        /conectar {code}
      </code>
      <p style={{ margin: "10px 0 0", fontSize: 11, color: T.txt3 }}>
        Esta pantalla se actualiza sola cuando el bot reciba el código.
      </p>
    </div>
  );
}

/* ── Vista: ya pareado ── */
function PairedView({ pairedAt, onUnpair, unpairing, T = P, isLight = false }) {
  const fechaTxt = pairedAt
    ? new Date(pairedAt).toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const handleOpenBot = () => {
    if (BOT_USERNAME) {
      window.open(`https://t.me/${BOT_USERNAME}`, "_blank", "noopener,noreferrer");
    }
  };

  const dangerColor       = isLight ? "#B91C3A" : "#F87171";
  const dangerBorder      = isLight ? "rgba(225,29,72,0.34)" : "rgba(248,113,113,0.32)";
  const dangerHoverBg     = isLight ? "rgba(225,29,72,0.08)" : "rgba(248,113,113,0.08)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Check size={14} color={T.accent} strokeWidth={2.4} />
        <span style={{ fontSize: 13, color: T.txt, fontWeight: 600 }}>
          Tu Telegram está conectado.
        </span>
      </div>
      {fechaTxt && (
        <p style={{ margin: "0 0 16px 24px", fontSize: 12, color: T.txt3 }}>
          Conectado desde el {fechaTxt}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {BOT_USERNAME && (
          <button
            type="button"
            onClick={handleOpenBot}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 16px", borderRadius: 11,
              background: T.accent, border: "none",
              color: "#FFFFFF",
              fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: `0 4px 12px ${T.accent}44`,
            }}
          >
            <Send size={13} strokeWidth={2.2} />
            Abrir bot
          </button>
        )}
        <button
          type="button"
          onClick={onUnpair}
          disabled={unpairing}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "10px 14px", borderRadius: 11,
            background: "transparent", border: `1px solid ${dangerBorder}`,
            color: dangerColor, fontSize: 12.5, fontWeight: 600, fontFamily: font,
            cursor: unpairing ? "default" : "pointer",
            transition: "all 0.18s",
          }}
          onMouseEnter={(e) => !unpairing && (e.currentTarget.style.background = dangerHoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={12} />
          {unpairing ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Últimas acciones desde Telegram                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function RecentBotActivity({ T = P, isLight = false }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paired, setPaired]     = useState(null); // null = unknown, true/false

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    const r = await getRecentBotActivity(20);
    setMessages(r.messages || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Verificar pareo antes de mostrar nada
  useEffect(() => {
    let mounted = true;
    getPairingStatus().then((r) => {
      if (!mounted) return;
      setPaired(r.paired);
      if (r.paired) load(false);
      else setLoading(false);
    });
    return () => { mounted = false; };
  }, [load]);

  // Si no está paireado, no mostramos esta sección (no tiene sentido)
  if (paired === false) return null;
  if (paired === null || loading) {
    return (
      <G T={T} style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontSize: 12, color: T.txt3 }}>Cargando actividad…</div>
      </G>
    );
  }

  const violetText = isLight ? "#6D28D9" : "#C084FC";
  const violetBg   = isLight ? "rgba(124,58,237,0.10)" : "rgba(168,85,247,0.10)";
  const violetBd   = isLight ? "rgba(124,58,237,0.26)" : "rgba(168,85,247,0.24)";
  const subtleBg   = isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.04)";
  const subtleHov  = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)";

  return (
    <G T={T} style={{ padding: 24, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: violetBg, border: `1px solid ${violetBd}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <MessageCircle size={18} color={violetText} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{
            margin: "0 0 2px",
            fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
            color: T.txt, fontFamily: fontDisp,
          }}>
            Últimas acciones desde Telegram
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: T.txt2 }}>
            Tu historial reciente con el bot (mostrando últimos 20).
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refrescar"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: 10,
            background: subtleBg, border: `1px solid ${T.border}`,
            color: T.txt2,
            cursor: refreshing ? "default" : "pointer",
            transition: "all 0.18s",
          }}
          onMouseEnter={(e) => !refreshing && (e.currentTarget.style.background = subtleHov)}
          onMouseLeave={(e) => (e.currentTarget.style.background = subtleBg)}
        >
          <RefreshCw size={14} strokeWidth={2} style={refreshing ? { animation: "spin 0.9s linear infinite" } : undefined} />
        </button>
      </div>

      {messages.length === 0 ? (
        <div style={{
          padding: "24px 18px",
          textAlign: "center",
          background: isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)",
          border: `1px dashed ${T.border}`,
          borderRadius: 12,
          fontSize: 13, color: T.txt3,
        }}>
          Sin actividad reciente. Manda un mensaje al bot para verlo aquí.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m) => (
            <BotMessageRow key={m.id} msg={m} T={T} isLight={isLight} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </G>
  );
}

function BotMessageRow({ msg, T = P, isLight = false }) {
  const isAi = msg.role === "ai";
  const time = msg.occurred_at
    ? new Date(msg.occurred_at).toLocaleString("es-MX", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "";

  // Limita el preview a algo razonable y respeta saltos de línea
  const content = (msg.content || "").trim();
  const isLong  = content.length > 280;
  const preview = isLong ? content.slice(0, 280) + "…" : content;

  // Colores por rol: el "AI" usa accent del tema (verde claro en dark, verde
  // oscuro en light para que el texto se lea bien). El "user" usa violeta.
  const aiColor      = T.accent;
  const userColor    = isLight ? "#6D28D9" : "#C084FC";
  const roleColor    = isAi ? aiColor : userColor;
  const bubbleBg     = isAi
    ? `${aiColor}10`
    : (isLight ? "rgba(124,58,237,0.07)" : "rgba(168,85,247,0.05)");
  const bubbleBorder = isAi
    ? `${aiColor}26`
    : (isLight ? "rgba(124,58,237,0.20)" : "rgba(168,85,247,0.16)");
  const avatarBg     = isAi
    ? `${aiColor}1F`
    : (isLight ? "rgba(124,58,237,0.14)" : "rgba(168,85,247,0.12)");

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 12px",
      background: bubbleBg,
      border: `1px solid ${bubbleBorder}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: avatarBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: roleColor,
      }}>
        {isAi ? <Bot size={13} strokeWidth={2} /> : <User size={13} strokeWidth={2} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            textTransform: "uppercase", fontFamily: fontDisp,
            color: roleColor,
          }}>
            {isAi ? "Bot" : "Tú"}
          </span>
          {time && (
            <span style={{ fontSize: 11, color: T.txt3 }}>{time}</span>
          )}
        </div>
        <pre style={{
          margin: 0,
          fontSize: 12.5, lineHeight: 1.5,
          color: T.txt, fontFamily: font,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {preview || "(mensaje vacío)"}
        </pre>
      </div>
    </div>
  );
}
