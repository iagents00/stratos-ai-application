/**
 * PublicLanding.jsx — Landing personalizada que abre el CLIENTE FINAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Ruta pública /p/<slug> (sin login). El asesor la genera en el Marketing
 * Studio; aquí se lee vía fn_landing_public (RPC anon, migración 066):
 *   · Personalizada: "Preparado exclusivamente para <cliente>" + mensaje.
 *   · Propiedades del catálogo con datos EN VIVO (precios/entrega al día).
 *   · Nunca llegan datos internos (masterbroker/contacto se excluyen en SQL).
 *   · Cada apertura suma al contador de vistas → el asesor ve "Vista" en Create.
 */
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { P, font, fontDisp } from "../../../design-system/tokens";
import LandingPagePreview from "./LandingPagePreview";
import { fichaToLandingProp } from "./FichasTecnicas";

const Shell = ({ children }) => (
  <div style={{
    position: "fixed", inset: 0, background: "#000",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 14, fontFamily: font, padding: 24, textAlign: "center",
  }}>{children}</div>
);

const PublicLanding = ({ slug }) => {
  // undefined = cargando · null = no encontrada · objeto = landing
  const [data, setData] = useState(undefined);

  useEffect(() => {
    let alive = true;
    supabase.rpc("fn_landing_public", { p_slug: slug })
      .then(({ data: d, error }) => {
        if (!alive) return;
        if (error || !d?.ok) {
          if (error) console.warn("[Stratos] landing pública:", error.message);
          setData(null);
          return;
        }
        setData(d);
      })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [slug]);

  if (data === undefined) return (
    <Shell>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.12)", borderTopColor: P.accent,
        animation: "spin 0.9s linear infinite",
      }} />
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Preparando tu presentación…</p>
    </Shell>
  );

  if (data === null) return (
    <Shell>
      <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>Esta presentación ya no está disponible</p>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 420, lineHeight: 1.6 }}>
        El enlace pudo haber expirado o ser incorrecto. Pide a tu asesor que te comparta uno nuevo.
      </p>
    </Shell>
  );

  const properties = [
    ...(Array.isArray(data.properties) ? data.properties.map(fichaToLandingProp) : []),
    ...(Array.isArray(data.props_snapshot) ? data.props_snapshot : []),
  ];
  if (properties.length === 0) return (
    <Shell>
      <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp }}>Presentación en actualización</p>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Las propiedades de esta presentación fueron actualizadas. Pide a tu asesor el enlace nuevo.</p>
    </Shell>
  );

  return (
    <LandingPagePreview
      publicMode
      client={data.client_name}
      asesor={data.asesor_name || ""}
      asesorWA={data.asesor_wa || ""}
      asesorCal={data.asesor_cal || ""}
      mensaje={data.mensaje || ""}
      agencyName={data.agency_name || "STRATOS REALTY"}
      properties={properties}
      driveLinks={{}}
      onClose={() => {}}
      onCopyLink={() => {}}
      copied={false}
    />
  );
};

export default PublicLanding;
