/**
 * LandingPages/LandingPagePreview.jsx
 * Pantalla de preview completa — landing pública para el cliente
 */
import { useState } from "react";
import { Copy, Check, X, Phone, CalendarDays, Share2 } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useIsMobile } from "../../../hooks/useViewport";
import { Pill } from "../../SharedComponents";
import PortfolioDocument from "./PortfolioDocument";
import { safePortfolioUrl } from "./portfolio-presentation.js";

const LandingPagePreview = ({ client, asesor, asesorWA = "", asesorCal = "", mensaje, agencyName = "STRATOS REALTY", properties, onClose, onCopyLink, copied, driveLinks = {}, publicMode = false, shareUrl = null, T = P }) => {
  const isMobile = useIsMobile();
  // La barra del asesor en móvil ocupa 2 filas (título + botones) → el contenido
  // arranca más abajo para no quedar tapado (captura IMG_8504: botones desbordados).
  const topBarH = isMobile ? 104 : 56;
  const [messageCopied, setMessageCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [showSharePanel, setShowSharePanel] = useState(false);

  const waDigits = asesorWA.replace(/\D/g, "");
  const waPhone = waDigits.length === 10 ? "52" + waDigits : waDigits; // MX sin código de país
  const propNames = properties.map(p => p.name).join(", ");
  const waText = encodeURIComponent(`Hola ${(asesor || "").split(" ")[0]}, acabo de revisar la presentación de propiedades que me enviaste (${propNames}). Me gustaría conocer más detalles.`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const calUrl = safePortfolioUrl(asesorCal);

  const demoShareUrl = shareUrl || `${window.location.origin}/p`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "#06070A", overflowY: "auto",
      fontFamily: font,
    }}>
      {/* Share panel overlay — solo para el asesor (modo preview) */}
      {showSharePanel && !publicMode && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowSharePanel(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 20, padding: "28px 32px", width: 500, maxWidth: "95vw",
            boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 500, color: "#fff", fontFamily: fontDisp }}>Enviar al cliente</p>
              <button onClick={() => setShowSharePanel(false)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={T.txt2} />
              </button>
            </div>

            {/* Copy link */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enlace de la landing page</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={demoShareUrl} style={{ flex: 1, minWidth: 0, padding: "10px 14px", borderRadius: 9, fontSize: 12, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, fontFamily: font, outline: "none" }} onClick={e => e.target.select()} />
                <button onClick={onCopyLink} style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: copied ? T.success : T.accent, color: T.onAccent,
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: fontDisp,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}>
                  {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>

            {copyError && <p role="alert">{copyError}</p>}
            {/* WhatsApp option */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enviar por WhatsApp</p>
              {waUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti:\n${demoShareUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                      borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                      color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: fontDisp,
                      transition: "all 0.2s",
                    }}
                  >
                    <Phone size={16} /> Elegir cliente en WhatsApp
                  </a>
                  <button onClick={() => {
                    const waMsg = `Hola ${client || "estimado cliente"} 🏡\n\nPrepare una presentación exclusiva con propiedades seleccionadas especialmente para ti.\n\nVe las propiedades aquí:\n${demoShareUrl}\n\n¿Cuándo te viene bien una llamada para revisarlas juntos?`;
                    navigator.clipboard.writeText(waMsg).then(() => { setMessageCopied(true); setCopyError(""); }).catch(() => setCopyError("No se pudo copiar el mensaje."));
                  }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                    borderRadius: 9, background: T.glass, border: `1px solid ${T.border}`,
                    color: T.txt2, fontSize: 12.5, fontWeight: 400, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}
                  >
                    <Copy size={13} /> {messageCopied ? "Mensaje copiado" : "Copiar mensaje completo para WhatsApp"}
                  </button>
                </div>
              ) : (
                <div style={{ padding: "12px 18px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, fontSize: 12.5 }}>
                  Configura el WhatsApp del asesor en el Paso 1 para activar esta opción
                </div>
              )}
            </div>

            {/* Calendly / meeting link */}
            {calUrl && (
              <div>
                <p style={{ fontSize: 12, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agendar llamada</p>
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  borderRadius: 10, background: P.blueS || "rgba(126,184,240,0.08)", border: `1px solid ${T.blue}30`,
                  color: T.blue, textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: fontDisp,
                }}>
                  <CalendarDays size={16} /> Abrir link de agenda
                </a>
              </div>
            )}

            <p style={{ fontSize: 11, color: T.txt3, marginTop: 18, lineHeight: 1.6, textAlign: "center" }}>
              El portafolio reúne las propiedades seleccionadas, sus datos disponibles,<br />enlaces a materiales y opciones de contacto con el asesor.
            </p>
          </div>
        </div>
      )}

      {/* Top Bar — solo para el asesor; el cliente no la ve */}
      {!publicMode && (<>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        padding: isMobile ? "10px 12px" : "12px 24px",
        // PWA iOS: la app puede dibujar bajo el RELOJ (status bar) → la primera
        // fila necesita el safe-area-top o queda debajo de la hora (IMG_8510).
        paddingTop: `calc(${isMobile ? 10 : 12}px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 8 : 0,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
          <Pill color={T.accent}>Vista Previa</Pill>
          <span style={{ fontSize: 12.5, color: T.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>Landing page para {client}</span>
          {properties.length > 1 && !isMobile && (
            <span style={{ fontSize: 12, color: T.txt3, whiteSpace: "nowrap" }}>· {properties.length} propiedades</span>
          )}
          {isMobile && (
            <button onClick={onClose} aria-label="Cerrar vista previa" style={{
              width: 38, height: 38, borderRadius: 9, border: `1px solid ${T.border}`, marginLeft: "auto", flexShrink: 0,
              background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} color={T.txt2} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
          <button onClick={onCopyLink} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: isMobile ? "11px 12px" : "8px 16px", flex: isMobile ? 1 : "0 0 auto", minWidth: 0,
            borderRadius: 8, border: `1px solid ${copied ? T.emerald + "50" : T.border}`,
            background: copied ? "rgba(109,212,168,0.08)" : T.glass,
            cursor: "pointer", color: copied ? T.emerald : T.txt2, fontSize: 12.5, fontWeight: 400, fontFamily: font,
            transition: "all 0.25s", whiteSpace: "nowrap",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button onClick={() => setShowSharePanel(true)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: isMobile ? "11px 12px" : "8px 16px", flex: isMobile ? 1 : "0 0 auto", minWidth: 0,
            borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)",
            cursor: "pointer", color: "#0A0F18", fontSize: 12.5, fontWeight: 500, fontFamily: fontDisp, whiteSpace: "nowrap",
          }}>
            <Share2 size={14} /> Enviar al cliente
          </button>
          {!isMobile && (
            <button onClick={onClose} aria-label="Cerrar vista previa" style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} color={T.txt2} />
            </button>
          )}
        </div>
      </div>
      </>)}

      <div style={{ paddingTop: publicMode ? 0 : `calc(${topBarH}px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))` }}>
        <PortfolioDocument client={client} asesor={asesor} asesorWA={asesorWA} asesorCal={asesorCal} mensaje={mensaje} agencyName={agencyName} properties={properties} driveLinks={driveLinks} />
      </div>

    </div>
  );
};

export default LandingPagePreview;
