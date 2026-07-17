/**
 * LandingPages/LandingPagePreview.jsx
 * Pantalla de preview completa — landing pública para el cliente
 */
import { useState } from "react";
import {
  TrendingUp, Target, Plus, Heart, Users, Crown, Building2,
  Globe, Palmtree, Waves, Wand2, Image, Download, ExternalLink,
  Copy, Check, Trash2, ChevronDown, ChevronRight, Eye, Share2,
  DollarSign, Shield, MapPin, FileText, X, Phone, CalendarDays, User,
  Calendar, Home, Maximize2, CheckCircle2,
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useIsMobile } from "../../../hooks/useViewport";
import { StratosAtom } from "../../../design-system/primitives";
import { G, KPI, Pill, Ico } from "../../SharedComponents";

const LandingPagePreview = ({ client, asesor, asesorWA = "", asesorCal = "", mensaje, agencyName = "STRATOS REALTY", properties, onClose, onCopyLink, copied, driveLinks = {}, publicMode = false, shareUrl = null, T = P }) => {
  const isMobile = useIsMobile();
  // La barra del asesor en móvil ocupa 2 filas (título + botones) → el contenido
  // arranca más abajo para no quedar tapado (captura IMG_8504: botones desbordados).
  const topBarH = isMobile ? 104 : 56;
  const [activeProperty, setActiveProperty] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const currentProp = properties[activeProperty] || properties[0];
  if (!currentProp) return null;

  const fmtPrice = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  const waDigits = asesorWA.replace(/\D/g, "");
  const waPhone = waDigits.length === 10 ? "52" + waDigits : waDigits; // MX sin código de país
  const propNames = properties.map(p => p.name).join(", ");
  const waText = encodeURIComponent(`Hola ${asesor.split(" ")[0]}, acabo de revisar la presentación de propiedades que me enviaste (${propNames}). Me gustaría conocer más detalles.`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const calUrl = asesorCal || null;

  const demoShareUrl = shareUrl || `${window.location.origin}/p`;

  const handleWhatsAppAdvisor = () => {
    if (waUrl) window.open(waUrl, "_blank");
  };
  const handleScheduleCall = () => {
    if (calUrl) window.open(calUrl, "_blank");
  };

  // ── Sistema de diseño del entregable (Apple-grade) ──
  const UI = {
    page:  "#0A0B0D", panel: "#0E0F13", card: "rgba(255,255,255,0.045)",
    hair:  "rgba(255,255,255,0.10)", hair2: "rgba(255,255,255,0.06)",
    hi:    "#F6F8FB", mid: "rgba(246,248,251,0.66)", lo: "rgba(246,248,251,0.42)",
    pad:   "clamp(22px, 5vw, 44px)", sec: "clamp(76px, 12vw, 136px)", maxW: 1080,
  };
  const acc = currentProp.accent || (T.accent || "#6EE7C2");
  const primaryHref = calUrl || waUrl || null;
  const primaryLabel = calUrl ? "Agendar llamada" : (waUrl ? "Escríbeme por WhatsApp" : "Contactar asesor");
  const sPrimary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
    padding: "15px 30px", borderRadius: 980, border: "none", cursor: "pointer", textDecoration: "none",
    background: "linear-gradient(180deg,#FFFFFF 0%,#E9ECEF 100%)", color: "#0A0C10",
    fontSize: 15, fontWeight: 600, fontFamily: fontDisp, letterSpacing: "-0.01em",
    boxShadow: "0 16px 44px -14px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.95)",
  };
  const sGhost = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "15px 26px", borderRadius: 980, cursor: "pointer", textDecoration: "none",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.16)",
    color: "#F6F8FB", fontSize: 15, fontWeight: 600, fontFamily: fontDisp, backdropFilter: "blur(10px)",
  };
  const renderCTAs = (size) => {
    const pad = size === "lg" ? "17px 36px" : "15px 30px";
    const PIcon = calUrl ? CalendarDays : Phone;
    const primary = primaryHref
      ? <a href={primaryHref} target="_blank" rel="noreferrer" style={{ ...sPrimary, padding: pad }}><PIcon size={16} /> {primaryLabel}</a>
      : (!publicMode ? <button onClick={() => setShowSharePanel(true)} style={{ ...sPrimary, padding: pad }}><CalendarDays size={16} /> {primaryLabel}</button> : null);
    const secondary = (calUrl && waUrl)
      ? <a href={waUrl} target="_blank" rel="noreferrer" style={{ ...sGhost, padding: pad, color: "#3DDC84", borderColor: "rgba(61,220,132,0.32)", background: "rgba(61,220,132,0.08)" }}><Phone size={15} /> WhatsApp</a>
      : null;
    return <>{primary}{secondary}</>;
  };

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
              <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enlace de la landing page</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={demoShareUrl} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, fontSize: 11, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, fontFamily: font, outline: "none" }} onClick={e => e.target.select()} />
                <button onClick={() => { onCopyLink(); navigator.clipboard.writeText(demoShareUrl).catch(()=>{}); }} style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: copied ? T.emerald : T.accent, color: "#000",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: fontDisp,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}>
                  {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* WhatsApp option */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enviar por WhatsApp</p>
              {waUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti:\n${demoShareUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                      borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                      color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: fontDisp,
                      transition: "all 0.2s",
                    }}
                  >
                    <Phone size={16} /> Abrir WhatsApp con cliente
                  </a>
                  <button onClick={() => {
                    const waMsg = `Hola ${client || "estimado cliente"} 🏡\n\nPrepare una presentación exclusiva con propiedades seleccionadas especialmente para ti.\n\nVe las propiedades aquí:\n${demoShareUrl}\n\n¿Cuándo te viene bien una llamada para revisarlas juntos?`;
                    navigator.clipboard.writeText(waMsg).then(() => onCopyLink()).catch(() => {});
                  }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                    borderRadius: 9, background: T.glass, border: `1px solid ${T.border}`,
                    color: T.txt2, fontSize: 12, fontWeight: 400, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.color = T.txt2; }}
                  >
                    <Copy size={13} /> Copiar mensaje completo para WhatsApp
                  </button>
                </div>
              ) : (
                <div style={{ padding: "12px 18px", borderRadius: 10, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, fontSize: 12 }}>
                  Configura el WhatsApp del asesor en el Paso 1 para activar esta opción
                </div>
              )}
            </div>

            {/* Calendly / meeting link */}
            {calUrl && (
              <div>
                <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agendar llamada</p>
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  borderRadius: 10, background: P.blueS || "rgba(126,184,240,0.08)", border: `1px solid ${T.blue}30`,
                  color: T.blue, textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: fontDisp,
                }}>
                  <CalendarDays size={16} /> Abrir link de agenda
                </a>
              </div>
            )}

            <p style={{ fontSize: 10, color: T.txt3, marginTop: 18, lineHeight: 1.6, textAlign: "center" }}>
              La landing page muestra las propiedades seleccionadas con todos sus datos,<br />galería de imágenes y botones de contacto directo con el asesor.
            </p>
          </div>
        </div>
      )}

      {/* Top Bar — solo para el asesor; el cliente no la ve */}
      {!publicMode && (<>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        padding: isMobile ? "10px 12px" : "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 8 : 0,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto" }}>
          <Pill color={T.accent}>Vista Previa</Pill>
          <span style={{ fontSize: 12, color: T.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>Landing page para {client}</span>
          {properties.length > 1 && !isMobile && (
            <span style={{ fontSize: 11, color: T.txt3, whiteSpace: "nowrap" }}>· {properties.length} propiedades</span>
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
            cursor: "pointer", color: copied ? T.emerald : T.txt2, fontSize: 12, fontWeight: 400, fontFamily: font,
            transition: "all 0.25s", whiteSpace: "nowrap",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button onClick={() => setShowSharePanel(true)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: isMobile ? "11px 12px" : "8px 16px", flex: isMobile ? 1 : "0 0 auto", minWidth: 0,
            borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)",
            cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 500, fontFamily: fontDisp, whiteSpace: "nowrap",
          }}>
            <Share2 size={14} /> Enviar al cliente
          </button>
          {!isMobile && (
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} color={T.txt2} />
            </button>
          )}
        </div>
      </div>
      </>)}

      {/* ─── LANDING PAGE CONTENT · rediseño Apple-grade ─── */}
      <div style={{ paddingTop: publicMode ? 0 : topBarH, background: UI.page }}>

        {/* HERO */}
        <section style={{
          position: "relative", minHeight: publicMode ? "100svh" : `calc(100svh - ${topBarH}px)`,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: `clamp(88px, 15vh, 168px) ${UI.pad} clamp(64px, 11vh, 112px)`, overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(80% 55% at 16% 6%, ${acc}2A 0%, transparent 55%), radial-gradient(70% 50% at 104% 108%, ${acc}14 0%, transparent 60%)` }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(130% 100% at 50% -10%, transparent 58%, rgba(0,0,0,0.55) 100%)" }} />

          {properties.length > 1 && (
            <div style={{ position: "absolute", right: "clamp(14px,4vw,32px)", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10, zIndex: 2 }}>
              {properties.map((p, i) => (
                <button key={p.id} onClick={() => setActiveProperty(i)} title={p.name} style={{
                  width: 7, height: i === activeProperty ? 22 : 7, borderRadius: 8, border: "none", cursor: "pointer", padding: 0,
                  background: i === activeProperty ? acc : "rgba(255,255,255,0.25)",
                  boxShadow: i === activeProperty ? `0 0 14px ${acc}70` : "none", transition: "all .35s cubic-bezier(.2,.8,.2,1)",
                }} />
              ))}
            </div>
          )}

          <div style={{ position: "relative", zIndex: 1, maxWidth: UI.maxW, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 26, animation: "fadeInUp .6s ease both" }}>
              <StratosAtom size={20} color={acc} />
              <span style={{ fontSize: 11.5, color: UI.mid, fontWeight: 600, fontFamily: fontDisp, letterSpacing: "0.24em", textTransform: "uppercase" }}>Portafolio Privado</span>
            </div>
            <p style={{ fontSize: 13, color: UI.lo, fontFamily: font, marginBottom: 14, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", animation: "fadeInUp .65s .06s ease both" }}>Preparado para</p>
            <h1 style={{ fontSize: "clamp(42px, 8.6vw, 84px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.035em", lineHeight: 1.01, marginBottom: 22, animation: "fadeInUp .7s .12s ease both" }}>{client || "Estimado Cliente"}</h1>
            <p style={{ fontSize: "clamp(15px, 2.1vw, 19px)", color: UI.mid, fontFamily: font, lineHeight: 1.6, maxWidth: 620, marginBottom: 34, animation: "fadeInUp .72s .18s ease both" }}>
              {mensaje || "Una selección curada de las mejores oportunidades de inversión en la Riviera Maya, elegidas específicamente para tus objetivos."}
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", animation: "fadeInUp .74s .24s ease both" }}>
              {renderCTAs()}
            </div>
            <div style={{ display: "flex", marginTop: "clamp(44px, 7vh, 72px)", flexWrap: "wrap", rowGap: 22, animation: "fadeInUp .78s .3s ease both" }}>
              {[
                { l: "Propiedades", v: properties.length },
                { l: "ROI estimado", v: "8–13%" },
                { l: "Ubicaciones", v: [...new Set(properties.map(p => p.location))].length },
              ].map((st, i) => (
                <div key={st.l} style={{ paddingLeft: i ? "clamp(20px,4vw,42px)" : 0, marginLeft: i ? "clamp(20px,4vw,42px)" : 0, borderLeft: i ? `1px solid ${UI.hair}` : "none" }}>
                  <p style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>{st.v}</p>
                  <p style={{ fontSize: 11.5, color: UI.lo, fontFamily: font, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 9 }}>{st.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROPIEDADES */}
        <section style={{ background: UI.panel, padding: `${UI.sec} ${UI.pad}`, borderTop: `1px solid ${UI.hair2}` }}>
          <div style={{ maxWidth: UI.maxW, margin: "0 auto" }}>
            <div style={{ marginBottom: "clamp(34px,6vw,60px)" }}>
              <p style={{ fontSize: 12, color: acc, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14, fontFamily: fontDisp }}>Portafolio · {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}</p>
              <h2 style={{ fontSize: "clamp(28px,5.4vw,46px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: 720 }}>Propiedades seleccionadas para ti</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(20px,3vw,30px)" }}>
              {properties.map((prop, idx) => {
                const pacc = prop.accent || acc;
                const dl = driveLinks[prop.id] || prop.driveLink;
                const specs = [
                  prop.bedrooms && { l: "Tipología", v: prop.bedrooms },
                  prop.delivery && { l: "Entrega", v: prop.delivery },
                  prop.roi && { l: "ROI anual", v: prop.roi },
                  (prop.zone && prop.zone !== prop.location) && { l: "Zona", v: prop.zone },
                ].filter(Boolean);
                const priceLabel = prop.ticket
                  ? prop.ticket
                  : (prop.priceFrom > 0 ? (prop.priceTo > prop.priceFrom ? `${fmtPrice(prop.priceFrom)} – ${fmtPrice(prop.priceTo)}` : `Desde ${fmtPrice(prop.priceFrom)}`) : "A consultar");
                return (
                  <article key={prop.id} style={{
                    borderRadius: 26, overflow: "hidden", background: UI.card, border: `1px solid ${UI.hair}`,
                    boxShadow: "0 44px 100px -56px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06)",
                    animation: `fadeInUp .6s ${Math.min(idx * 0.08, 0.4)}s ease both`,
                  }}>
                    {/* Cover: gradiente refinado (sin foto falsa) */}
                    <div style={{ position: "relative", padding: "clamp(24px,4vw,40px)", minHeight: 172, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20,
                      background: `radial-gradient(130% 150% at 100% 0%, ${pacc}40 0%, transparent 55%), linear-gradient(135deg, ${pacc}22 0%, rgba(255,255,255,0.02) 42%, transparent 100%)`,
                      borderBottom: `1px solid ${UI.hair2}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: UI.lo, fontFamily: fontDisp, letterSpacing: "0.06em" }}>{String(idx + 1).padStart(2, "0")}</span>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {prop.badge && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, color: pacc, background: `${pacc}1F`, border: `1px solid ${pacc}3A`, fontFamily: fontDisp, whiteSpace: "nowrap" }}>{prop.badge}</span>}
                          {prop.type && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 999, color: "#F6F8FB", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: fontDisp, whiteSpace: "nowrap" }}>{prop.type}</span>}
                        </div>
                      </div>
                      <div>
                        <h3 style={{ fontSize: "clamp(25px,4.6vw,40px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{prop.name}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11 }}>
                          <MapPin size={14} color={pacc} />
                          <span style={{ fontSize: 13.5, color: UI.mid, fontFamily: font }}>{prop.location}{prop.zone && prop.zone !== prop.location ? ` · ${prop.zone}` : ""}</span>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: "clamp(24px,4vw,40px)" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26, paddingBottom: 24, borderBottom: `1px solid ${UI.hair2}` }}>
                        <div>
                          <p style={{ fontSize: 11, color: UI.lo, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7, fontFamily: font }}>Precio</p>
                          <p style={{ fontSize: "clamp(24px,3.6vw,34px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.02em", textTransform: "uppercase", lineHeight: 1 }}>{priceLabel}</p>
                        </div>
                        {dl && <a href={dl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 980, textDecoration: "none", fontSize: 13.5, fontWeight: 600, fontFamily: fontDisp, whiteSpace: "nowrap", color: pacc, background: `${pacc}14`, border: `1px solid ${pacc}4D` }}><Image size={15} /> Ver galería <ExternalLink size={13} /></a>}
                      </div>

                      <p style={{ fontSize: "clamp(14px,1.7vw,15.5px)", color: UI.mid, lineHeight: 1.65, fontFamily: font, marginBottom: specs.length || (prop.highlights || []).length ? 26 : 0, maxWidth: 760 }}>{prop.description}</p>

                      {specs.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 1, background: UI.hair2, borderRadius: 16, overflow: "hidden", border: `1px solid ${UI.hair2}`, marginBottom: (prop.highlights || []).length ? 24 : 0 }}>
                          {specs.map(sp => (
                            <div key={sp.l} style={{ background: UI.panel, padding: "16px 18px" }}>
                              <p style={{ fontSize: 10.5, color: UI.lo, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: font }}>{sp.l}</p>
                              <p style={{ fontSize: 14.5, color: UI.hi, fontWeight: 500, fontFamily: fontDisp, lineHeight: 1.3 }}>{sp.v}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {(prop.highlights || []).length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 11 }}>
                          {prop.highlights.map((h, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: `${pacc}22`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Check size={11} color={pacc} strokeWidth={3} /></span>
                              <span style={{ fontSize: 13.5, color: UI.mid, fontFamily: font, lineHeight: 1.5 }}>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(prop.amenities || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 20 }}>
                          {prop.amenities.map((a, i) => (
                            <span key={i} style={{ fontSize: 12, color: UI.mid, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${UI.hair2}`, fontFamily: font }}>{a}</span>
                          ))}
                        </div>
                      )}

                      {!dl && (
                        <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px dashed ${UI.hair}`, fontSize: 12.5, color: UI.lo, fontFamily: font, display: "flex", alignItems: "center", gap: 8 }}>
                          <Image size={14} /> Galería de imágenes disponible con tu asesor
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* MERCADO */}
        <section style={{ background: UI.page, padding: `${UI.sec} ${UI.pad}`, borderTop: `1px solid ${UI.hair2}` }}>
          <div style={{ maxWidth: UI.maxW, margin: "0 auto" }}>
            <div style={{ marginBottom: "clamp(30px,5vw,50px)", maxWidth: 640 }}>
              <p style={{ fontSize: 12, color: acc, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14, fontFamily: fontDisp }}>El mercado</p>
              <h2 style={{ fontSize: "clamp(26px,5vw,42px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.06 }}>¿Por qué la Riviera Maya?</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 1, background: UI.hair2, border: `1px solid ${UI.hair2}`, borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
              {[
                { l: "Crecimiento anual", v: "14%", s: "Nominal YoY" },
                { l: "ROI por rentas", v: "8–15%", s: "Neto anual" },
                { l: "Ocupación", v: "75–90%", s: "Promedio anual" },
              ].map(x => (
                <div key={x.l} style={{ background: UI.panel, padding: "26px 24px" }}>
                  <p style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1 }}>{x.v}</p>
                  <p style={{ fontSize: 13, color: UI.mid, marginTop: 10, fontFamily: font }}>{x.l}</p>
                  <p style={{ fontSize: 11.5, color: acc, marginTop: 3, fontFamily: font }}>{x.s}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14 }}>
              <div style={{ padding: "26px 24px", borderRadius: 20, background: UI.card, border: `1px solid ${UI.hair2}` }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: UI.hi, fontFamily: fontDisp, marginBottom: 18 }}>Ventajas para inversionistas</p>
                {[
                  "Propiedad 100% legal para extranjeros vía fideicomiso",
                  "Impuestos prediales mínimos vs EE.UU. / Canadá",
                  "Nuevo Aeropuerto Internacional de Tulum",
                  "Tren Maya conectando toda la región",
                  "Turismo los 365 días del año",
                  "Mercado de nómadas digitales en expansión",
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 13 }}>
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: `${acc}22`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Check size={11} color={acc} strokeWidth={3} /></span>
                    <span style={{ fontSize: 13.5, color: UI.mid, lineHeight: 1.5, fontFamily: font }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "26px 24px", borderRadius: 20, background: UI.card, border: `1px solid ${UI.hair2}` }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: UI.hi, fontFamily: fontDisp, marginBottom: 18 }}>Infraestructura</p>
                {[
                  { t: "Aeropuerto de Tulum", d: "Nuevo aeropuerto internacional, en operación" },
                  { t: "Tren Maya", d: "Conectividad ferroviaria que impulsa la plusvalía" },
                  { t: "Precio por m²", d: "≈ $3,600 USD/m² con recorrido de apreciación" },
                  { t: "Plusvalía real", d: "≈ 8% anual después de inflación" },
                ].map((inf, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: "13px 15px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${UI.hair2}` }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: UI.hi, fontFamily: fontDisp }}>{inf.t}</p>
                    <p style={{ fontSize: 12, color: UI.lo, marginTop: 4, lineHeight: 1.45, fontFamily: font }}>{inf.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ position: "relative", overflow: "hidden", background: UI.panel, padding: `${UI.sec} ${UI.pad}`, textAlign: "center", borderTop: `1px solid ${UI.hair2}` }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(60% 60% at 50% 0%, ${acc}1C 0%, transparent 62%)` }} />
          <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
            <StratosAtom size={34} color={acc} />
            <h2 style={{ fontSize: "clamp(26px,5vw,44px)", fontWeight: 600, color: UI.hi, fontFamily: fontDisp, letterSpacing: "-0.03em", marginTop: 22, marginBottom: 16, lineHeight: 1.05 }}>¿Listo para dar el siguiente paso?</h2>
            <p style={{ fontSize: "clamp(15px,2vw,18px)", color: UI.mid, lineHeight: 1.6, marginBottom: 34, fontFamily: font }}>
              {asesor ? <>Agenda una llamada con <strong style={{ color: UI.hi, fontWeight: 600 }}>{asesor}</strong> para conocer todos los detalles y asegurar la mejor oportunidad.</> : "Contáctanos para conocer todos los detalles y asegurar la mejor oportunidad de inversión."}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>{renderCTAs("lg")}</div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: UI.page, padding: `40px ${UI.pad}`, borderTop: `1px solid ${UI.hair2}`, textAlign: "center" }}>
          <p style={{ fontSize: 11.5, color: UI.lo, fontFamily: font, lineHeight: 1.7 }}>Riviera Maya, México · Presentación confidencial para {client || "el cliente"}</p>
          <p style={{ fontSize: 10.5, color: "rgba(246,248,251,0.28)", marginTop: 6, fontFamily: font }}>{asesor ? `Asesor: ${asesor} · ` : ""}{new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })} · Precios en USD · Sujeto a disponibilidad</p>
        </footer>

      </div>
    </div>
  );
};

export default LandingPagePreview;
