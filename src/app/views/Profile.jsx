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
import { useState, useEffect, useRef } from "react";
import { Send, Check, X, ExternalLink } from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, Pill } from "../SharedComponents";
import { useAuth } from "../../hooks/useAuth";
import {
  getPairingStatus,
  requestPairingCode,
  unpairTelegram,
} from "../../lib/telegram";

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin:       "Admin",
  ceo:         "CEO",
  director:    "Director",
  asesor:      "Asesor",
};

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div style={{ padding: "32px 28px 80px", maxWidth: 760, margin: "0 auto", fontFamily: font }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{
          margin: "0 0 8px",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.36)",
          fontFamily: fontDisp,
        }}>
          Perfil
        </p>
        <h1 style={{
          margin: "0 0 6px",
          fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em",
          color: P.txt, fontFamily: fontDisp,
        }}>
          {user?.name || "Sin nombre"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: P.txt2 }}>{user?.email}</span>
          <span style={{ color: P.txt3 }}>·</span>
          <Pill color={P.violet}>{ROLE_LABEL[user?.role] || user?.role}</Pill>
        </div>
      </div>

      <ConnectTelegramPanel />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Conectar Telegram                                                       */
/* ─────────────────────────────────────────────────────────────────────── */

function ConnectTelegramPanel() {
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

  // Polling: si esperamos pareo, refresca cada 5s
  const startPolling = () => {
    stopPolling();
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
  useEffect(() => () => stopPolling(), []);

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
      <G>
        <div style={{ padding: 8, color: P.txt3, fontSize: 13 }}>Cargando…</div>
      </G>
    );
  }

  return (
    <G style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${P.accent}14`, border: `1px solid ${P.accent}2A`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Send size={18} color={P.accent} strokeWidth={1.8} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{
            margin: "0 0 2px",
            fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
            color: P.txt, fontFamily: fontDisp,
          }}>
            Conectar Telegram
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: P.txt2 }}>
            Gestiona tus leads desde el chat del bot de Stratos.
          </p>
        </div>
        {status.paired && <Pill color={P.accent}>Conectado</Pill>}
      </div>

      <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${P.border}` }}>
        {status.paired ? (
          <PairedView pairedAt={status.pairedAt} onUnpair={handleUnpair} unpairing={busy} />
        ) : manualCode ? (
          <ManualCodeView code={manualCode} />
        ) : (
          <NotPairedView onConnect={handleConnect} busy={busy} />
        )}

        {errorMsg && (
          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
            borderRadius: 10,
            fontSize: 12, color: "#FCA5A5",
          }}>
            {errorMsg}
          </div>
        )}
      </div>
    </G>
  );
}

/* ── Vista por defecto: un botón ── */
function NotPairedView({ onConnect, busy }) {
  return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: P.txt2, lineHeight: 1.55 }}>
        {BOT_USERNAME
          ? "Te abrimos Telegram. Solo dale START en el bot — listo."
          : "Genera tu código y mándalo al bot de Telegram para conectarte."}
      </p>

      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: "12px 22px", borderRadius: 12,
          background: busy ? "rgba(110,231,194,0.18)" : P.accent,
          border: "none",
          color: "#041016",
          fontSize: 14, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.005em",
          cursor: busy ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {busy ? "Abriendo…" : (BOT_USERNAME ? "Conectar mi Telegram" : "Generar código")}
        {!busy && <ExternalLink size={14} strokeWidth={2.2} />}
      </button>
    </div>
  );
}

/* ── Vista fallback: sin bot username configurado, mostramos código manual ── */
function ManualCodeView({ code }) {
  return (
    <div>
      <p style={{
        margin: "0 0 12px",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: P.txt3, fontFamily: fontDisp,
      }}>
        Tu código
      </p>

      <div style={{
        padding: "20px 22px",
        background: `${P.accent}0A`, border: `1px solid ${P.accent}2E`,
        borderRadius: 14,
        fontSize: 36, fontWeight: 300, letterSpacing: "0.10em",
        fontFamily: fontDisp, color: P.txt,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        marginBottom: 14,
      }}>
        {code}
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: P.txt2 }}>
        Abre el bot en Telegram y envía:
      </p>
      <code style={{
        display: "block", padding: "10px 12px",
        background: "rgba(255,255,255,0.04)", border: `1px solid ${P.border}`,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        color: P.txt,
      }}>
        /conectar {code}
      </code>
      <p style={{ margin: "10px 0 0", fontSize: 11, color: P.txt3 }}>
        Esta pantalla se actualiza sola cuando el bot reciba el código.
      </p>
    </div>
  );
}

/* ── Vista: ya pareado ── */
function PairedView({ pairedAt, onUnpair, unpairing }) {
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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Check size={14} color={P.accent} strokeWidth={2.4} />
        <span style={{ fontSize: 13, color: P.txt, fontWeight: 600 }}>
          Tu Telegram está conectado.
        </span>
      </div>
      {fechaTxt && (
        <p style={{ margin: "0 0 16px 24px", fontSize: 12, color: P.txt3 }}>
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
              background: P.accent, border: "none",
              color: "#041016",
              fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
              cursor: "pointer", transition: "all 0.2s",
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
            background: "transparent", border: `1px solid rgba(248,113,113,0.32)`,
            color: "#F87171", fontSize: 12.5, fontWeight: 600, fontFamily: font,
            cursor: unpairing ? "default" : "pointer",
            transition: "all 0.18s",
          }}
          onMouseEnter={(e) => !unpairing && (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={12} />
          {unpairing ? "Desconectando…" : "Desconectar"}
        </button>
      </div>
    </div>
  );
}
