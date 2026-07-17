/**
 * PublicLanding.jsx — La landing personalizada que abre el CLIENTE FINAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Ruta pública /p#d=<base64url> (sin login, sin backend). El asesor la genera
 * en el Marketing Studio y comparte el link; toda la presentación va codificada
 * en la URL (nombre del cliente, mensaje, asesor y propiedades seleccionadas).
 * Nunca incluye datos internos del equipo (masterbroker/contacto no se codifican).
 */
import { useEffect, useMemo, useState } from "react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import LandingPagePreview from "./LandingPagePreview";
import { decodeLanding } from "./catalogAdapter";
import { supabase } from "../../../lib/supabase";

const Shell = ({ children }) => (
  <div style={{
    position: "fixed", inset: 0, background: "#04070d",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 12, fontFamily: font, padding: 24, textAlign: "center",
  }}>{children}</div>
);

const PublicLanding = () => {
  const initial = useMemo(() => {
    // Camino 1 (legacy, sigue vivo): el payload viaja en el fragmento (#d=...).
    const hash = (window.location.hash || "").replace(/^#/, "");
    const q = new URLSearchParams(hash);
    const d = q.get("d") || new URLSearchParams(window.location.search).get("d");
    return d ? decodeLanding(d) : null;
  }, []);
  // Camino 2 (nuevo, el que se comparte): LINK CORTO /p/<código>. El código se
  // resuelve vía la RPC pública resolve_portfolio_link → devuelve el MISMO
  // base64 que el camino 1 → misma decodificación, misma landing.
  const code = useMemo(() => {
    const m = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]{4,32})\/?$/);
    return m ? m[1] : null;
  }, []);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial && !!code);
  useEffect(() => {
    if (initial || !code) return;
    let alive = true;
    supabase.rpc("resolve_portfolio_link", { p_code: code })
      .then(({ data: d }) => {
        if (!alive) return;
        setData(d && typeof d === "string" ? decodeLanding(d) : null);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [initial, code]);

  if (loading) {
    return (
      <Shell>
        <p style={{ fontSize: 18, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>
          Preparando tu portafolio…
        </p>
      </Shell>
    );
  }

  if (!data || !data.properties || data.properties.length === 0) {
    return (
      <Shell>
        <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>
          Esta presentación no está disponible
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 420, lineHeight: 1.6 }}>
          El enlace pudo copiarse incompleto o ser incorrecto. Pídele a tu asesor que te comparta uno nuevo.
        </p>
      </Shell>
    );
  }

  return (
    <LandingPagePreview
      publicMode
      client={data.client}
      asesor={data.asesor}
      asesorWA={data.asesorWA}
      asesorCal={data.asesorCal}
      mensaje={data.mensaje}
      agencyName={data.agencyName}
      properties={data.properties}
      driveLinks={{}}
      onClose={() => {}}
      onCopyLink={() => {}}
      copied={false}
    />
  );
};

export default PublicLanding;
