/**
 * CRM/LeadVoiceCalls.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección con las llamadas de voz hechas por Retell AI a este lead.
 * Lee de `public.voice_call_logs` (1:N por lead).
 *
 * Cada item muestra:
 *   - Fecha/hora + duración + dirección (inbound/outbound)
 *   - Reproductor nativo HTML5 <audio controls> con la grabación
 *   - Resumen ejecutivo (call_summary) si la IA lo extrajo
 *   - Transcripción colapsable (click para expandir; está truncada por defecto)
 *
 * Si no hay calls → no renderiza nada (se oculta para no contaminar el panel).
 * RLS hereda visibilidad de leads.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, ChevronDown, ChevronUp } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";

const fmtDateTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const fmtDuration = (sec) => {
  if (sec === null || sec === undefined) return "";
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "";
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

function CallRow({ log, T, isLight }) {
  const [expanded, setExpanded] = useState(false);
  const isIncoming = (log.direction || "").toLowerCase() === "inbound";
  const DirIcon = isIncoming ? PhoneIncoming : PhoneOutgoing;
  const rowBg     = isLight ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.025)";
  const subC      = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";

  return (
    <div style={{
      padding: 12, borderRadius: 11,
      background: rowBg, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${T.accent}18`, border: `1px solid ${T.accent}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <DirIcon size={13} color={T.accent} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 12.5, fontWeight: 600,
              color: T.txt, fontFamily: fontDisp,
            }}>
              {isIncoming ? "Llamada entrante" : "Llamada saliente"}
              {log.duration_seconds != null && (
                <span style={{ color: subC, fontWeight: 500, marginLeft: 8 }}>
                  · {fmtDuration(log.duration_seconds)}
                </span>
              )}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 10.5, color: subC, fontFamily: font }}>
              {fmtDateTime(log.created_at)}
              {log.disconnection_reason && (
                <span style={{ marginLeft: 8, opacity: 0.85 }}>· {log.disconnection_reason}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Audio player nativo */}
      {log.recording_url && (
        <div style={{ marginTop: 10 }}>
          <audio
            src={log.recording_url}
            controls
            preload="none"
            style={{ width: "100%", height: 32 }}
          />
        </div>
      )}

      {/* Resumen */}
      {log.call_summary && (
        <div style={{
          marginTop: 10, padding: "8px 10px", borderRadius: 8,
          background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
          fontSize: 12.5, color: T.txt, fontFamily: font, lineHeight: 1.55,
        }}>
          <p style={{
            margin: "0 0 4px", fontSize: 9.5, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: subC, fontFamily: fontDisp,
          }}>Resumen IA</p>
          {log.call_summary}
        </div>
      )}

      {/* Transcript colapsable */}
      {log.transcript && log.transcript.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 9px", borderRadius: 6,
              background: "transparent", border: `1px solid ${T.border}`,
              color: subC, fontSize: 10.5, fontWeight: 600, fontFamily: fontDisp,
              cursor: "pointer", letterSpacing: "0.02em",
            }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? "Ocultar transcript" : "Ver transcript"}
          </button>
          {expanded && (
            <pre style={{
              marginTop: 8, padding: 10, borderRadius: 8,
              background: isLight ? "#FFFFFF" : "rgba(0,0,0,0.18)",
              border: `1px solid ${T.border}`,
              color: T.txt2, fontSize: 11.5, lineHeight: 1.55,
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 260, overflowY: "auto",
            }}>{log.transcript}</pre>
          )}
        </>
      )}
    </div>
  );
}

export default function LeadVoiceCalls({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!lead?.id) { setLoading(false); return; }
      if (user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead.id))) {
        setLogs([]); setLoading(false); return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("voice_call_logs")
        .select("id, call_id, direction, duration_seconds, call_summary, transcript, recording_url, disconnection_reason, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      setLogs(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [lead?.id, user?.isDemo]);

  if (user?.isDemo) return null;
  if (loading) return null;
  if (logs.length === 0) return null;

  const headerC = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC, fontFamily: fontDisp,
        }}>
          <Phone size={11} />
          Llamadas de voz (Retell IA)
          <span style={{ fontWeight: 600, color: T.txt3, marginLeft: 4 }}>· {logs.length}</span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {logs.map((l) => <CallRow key={l.id} log={l} T={T} isLight={isLight} />)}
      </div>
    </div>
  );
}
