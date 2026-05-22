/**
 * CRM/LeadDiscoveryPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Render del perfilamiento extraído por la IA de voz (Retell) en la tabla
 * `public.discovery_data` (1:1 con el lead). El JSONB es flexible — la IA
 * puede sumar/quitar campos según la conversación.
 *
 * UX: pares clave→valor en grid 2 columnas, con etiquetas amigables para los
 * campos conocidos (zona, presupuesto, etc.) y fallback al snake_case del
 * JSON para campos nuevos que no mapeemos.
 *
 * Si `discovery_data` no existe para ese lead → no renderiza nada (para que
 * no aparezca un wrapper vacío).
 *
 * RLS hereda visibilidad de leads — los asesores que ven el lead ven su data.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";

// Etiqueta amigable para campos comunes que la IA extrae. Si llega un campo
// nuevo, mostramos el snake_case del JSON convertido a Title Case.
const FIELD_LABELS = {
  zona:               "Zona de interés",
  objetivo:           "Objetivo",
  presupuesto:        "Presupuesto",
  enganche_30:        "Enganche 30 %",
  recamaras:          "Recámaras",
  cita_pactada:       "Cita pactada",
  duracion_segundos:  "Duración llamada (s)",
  timezone:           "Zona horaria",
  intencion:          "Intención de compra",
  decisor:            "Toma de decisión",
  prioridad:          "Prioridad",
  email_confirmado:   "Email confirmado",
  motivo_compra:      "Motivo de compra",
  forma_de_pago:      "Forma de pago",
  tipo_uso:           "Uso del inmueble",
  ciudad_origen:      "Ciudad origen",
};

const prettyLabel = (key) =>
  FIELD_LABELS[key] ||
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const prettyValue = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object")  return JSON.stringify(v);
  return String(v);
};

export default function LeadDiscoveryPanel({ lead, T = P, isLight = false }) {
  const { user } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!lead?.id) { setLoading(false); return; }
      // Modo demo: no hay BD real, no consultamos.
      if (user?.isDemo || !/^[0-9a-f]{8}-/.test(String(lead.id))) {
        setRow(null); setLoading(false); return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("discovery_data")
        .select("data, updated_at")
        .eq("lead_id", lead.id)
        .maybeSingle();
      if (cancelled) return;
      setRow(data || null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [lead?.id, user?.isDemo]);

  if (user?.isDemo) return null;
  if (loading) return null;            // silencioso mientras carga
  if (!row || !row.data || Object.keys(row.data).length === 0) return null;

  const entries = Object.entries(row.data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;

  const headerC      = isLight ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.62)";
  const cardBg       = isLight ? "rgba(110,231,194,0.05)" : "rgba(110,231,194,0.04)";
  const cardBorder   = `1px solid ${isLight ? "rgba(13,154,118,0.22)" : "rgba(110,231,194,0.18)"}`;
  const labelC       = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: headerC,
          fontFamily: fontDisp,
        }}>
          <Brain size={11} />
          Perfilamiento IA (Retell)
        </span>
        <span style={{
          padding: "1px 6px", borderRadius: 4,
          background: `${T.accent}1A`, color: T.accent,
          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          Solo lectura
        </span>
      </div>

      <div style={{
        padding: 14, borderRadius: 11,
        background: cardBg, border: cardBorder,
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          columnGap: 16, rowGap: 10,
        }}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <p style={{
                margin: 0, fontSize: 10, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: labelC, fontFamily: fontDisp,
              }}>{prettyLabel(k)}</p>
              <p style={{
                margin: "2px 0 0", fontSize: 13, fontWeight: 500,
                color: T.txt, fontFamily: font,
                wordBreak: "break-word",
              }}>{prettyValue(v)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
