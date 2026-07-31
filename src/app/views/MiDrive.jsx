/**
 * views/MiDrive.jsx — la carpeta de Drive del área, DENTRO de Stratos.
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto (30-jul-2026): con el «Plan de Trabajo Semanal» cada área ya tiene su
 * carpeta en Drive. Este módulo la trae adentro para que la persona no viva
 * saltando de pestaña: entra a su espacio y su carpeta está ahí.
 *
 * Qué ve quién:
 *   · Colaborador → SU carpeta (la de `profiles.area`). Sin selector: una sola.
 *   · Mando (super_admin/admin/director/ceo) → chips para saltar entre las 6.
 *     Es lo que necesitan los viernes, cuando revisan el plan de cada área.
 *
 * El iframe es el visor embebible de Google (solo lectura). Para subir, renombrar
 * o comentar está el botón «Abrir en Drive» — el visor embebido no lo permite y
 * fingir que sí sería peor que no tenerlo.
 *
 * Si Google deja de servir el embed (carpeta con enlace cerrado, bloqueo de
 * terceros en el navegador), el iframe queda en blanco: por eso SIEMPRE se
 * muestra arriba el botón que abre la carpeta real.
 *
 * Aesthetic: paleta `T` del theme de App.jsx, isLight por luminancia (patrón
 * Caja.jsx/Marketing.jsx).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo } from "react";
import { FolderOpen, ExternalLink, RefreshCw } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import { AREAS, AREA_ORDER, getArea, driveUrlOf, driveEmbedUrlOf } from "../constants/areas";

const MANDO = ["super_admin", "admin", "director", "ceo"];

export default function MiDrive({ T }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");

  const esMando = MANDO.includes(user?.role);
  const propia  = getArea(user?.area);

  // El mando puede saltar entre áreas; el colaborador arranca (y se queda) en la suya.
  const [sel, setSel] = useState(() => {
    if (propia) return AREA_ORDER.find(k => AREAS[k] === propia) || AREA_ORDER[0];
    return esMando ? AREA_ORDER[0] : null;
  });
  // Cambiar la key remonta el iframe → sirve de "recargar" sin tocar toda la página.
  const [nonce, setNonce] = useState(0);

  const area     = sel ? AREAS[sel] : null;
  const embedUrl = useMemo(() => (area ? driveEmbedUrlOf(sel) : null), [area, sel]);
  const openUrl  = useMemo(() => (area ? driveUrlOf(sel) : null), [area, sel]);

  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 14,
    padding: isMobile ? 14 : 18,
  };

  /* Sin área asignada y sin ser mando: no hay carpeta que mostrar. Se dice qué
     hacer (pedírsela a RRHH) en vez de dejar la pantalla muda. */
  if (!area) {
    return (
      <div style={{ ...card, fontFamily: font, color: txt2, maxWidth: 560 }}>
        <div style={{ fontFamily: fontDisp, fontSize: 16, color: txt, marginBottom: 6 }}>
          Todavía no tienes un área asignada
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          Tu carpeta de Drive aparece acá en cuanto Recursos Humanos te asigne un área
          (Marketing, Comercial, Operativo, Administrativo, Finanzas o RRHH).
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>

      {/* ── Encabezado: qué carpeta es + cómo abrirla de verdad ── */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${accent}18`, border: `1px solid ${bd}`,
        }}>
          <FolderOpen size={19} color={accent} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: fontDisp, fontSize: isMobile ? 15 : 16.5, color: txt, fontWeight: 600 }}>
            {esMando ? area.label : `Mi Drive · ${area.label}`}
          </div>
          <div style={{ fontSize: 12.5, color: txt3, marginTop: 2 }}>
            Carpeta {area.driveName} — aquí vive el Plan de Trabajo Semanal del área.
          </div>
        </div>

        <button
          onClick={() => setNonce(n => n + 1)}
          title="Recargar la carpeta"
          style={{
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
            padding: "8px 11px", borderRadius: 10, fontFamily: font, fontSize: 12.5,
            background: "transparent", border: `1px solid ${bd}`, color: txt2,
          }}
        >
          <RefreshCw size={13} /> {isMobile ? "" : "Recargar"}
        </button>

        <a
          href={openUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
            padding: "9px 14px", borderRadius: 10, fontFamily: font, fontSize: 13, fontWeight: 600,
            background: `${accent}1F`, border: `1px solid ${accent}55`, color: accent,
          }}
        >
          <ExternalLink size={14} /> Abrir en Drive
        </a>
      </div>

      {/* ── Chips de área: solo para quien revisa a todas (viernes) ── */}
      {esMando && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {AREA_ORDER.map(k => {
            const on = k === sel;
            return (
              <button
                key={k}
                onClick={() => setSel(k)}
                style={{
                  cursor: "pointer", padding: "7px 12px", borderRadius: 999,
                  fontFamily: font, fontSize: 12.5, fontWeight: on ? 600 : 500,
                  background: on ? `${accent}1F` : (isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.045)"),
                  border: `1px solid ${on ? `${accent}55` : bd}`,
                  color: on ? accent : txt2,
                }}
              >
                {AREAS[k].label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── La carpeta ── */}
      <div style={{ ...card, padding: 0, overflow: "hidden", flex: 1, minHeight: isMobile ? 420 : 520, display: "flex" }}>
        <iframe
          key={`${sel}-${nonce}`}
          src={embedUrl}
          title={`Drive · ${area.label}`}
          style={{ width: "100%", height: "100%", minHeight: isMobile ? 420 : 520, border: 0, background: isLight ? "#FFFFFF" : "transparent" }}
          loading="lazy"
        />
      </div>

      <div style={{ fontSize: 11.5, color: txt3, lineHeight: 1.5 }}>
        Vista de solo lectura. Para subir archivos, renombrar o comentar, usa «Abrir en Drive».
        Si el recuadro queda en blanco, tu navegador está bloqueando contenido de terceros —
        el botón de arriba abre la carpeta igual.
      </div>
    </div>
  );
}
