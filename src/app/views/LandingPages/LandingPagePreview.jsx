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
  Calendar, Home, Maximize2,
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../../SharedComponents";

const LandingPagePreview = ({ client, asesor, asesorWA = "", asesorCal = "", mensaje, agencyName = "STRATOS REALTY", properties, onClose, onCopyLink, copied, driveLinks = {}, T = P }) => {
  const [activeProperty, setActiveProperty] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const currentProp = properties[activeProperty] || properties[0];
  if (!currentProp) return null;

  const fmtPrice = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  const waPhone = asesorWA.replace(/\D/g, "");
  const propNames = properties.map(p => p.name).join(", ");
  const waText = encodeURIComponent(`Hola ${asesor.split(" ")[0]}, acabo de revisar la presentación de propiedades que me enviaste (${propNames}). Me gustaría conocer más detalles.`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const calUrl = asesorCal || null;

  const demoShareUrl = `${window.location.origin}${window.location.pathname}?lp=preview&c=${encodeURIComponent(client || "cliente")}`;

  const handleWhatsAppAdvisor = () => {
    if (waUrl) window.open(waUrl, "_blank");
  };
  const handleScheduleCall = () => {
    if (calUrl) window.open(calUrl, "_blank");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "#000000", overflowY: "auto",
      fontFamily: font,
    }}>
      {/* Share panel overlay */}
      {showSharePanel && (
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
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>Enviar al cliente</p>
              <button onClick={() => setShowSharePanel(false)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={T.txt2} />
              </button>
            </div>

            {/* Copy link */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enlace de la landing page</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={demoShareUrl} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, fontSize: 11, background: T.glass, border: `1px solid ${T.border}`, color: T.txt3, fontFamily: font, outline: "none" }} onClick={e => e.target.select()} />
                <button onClick={() => { onCopyLink(); navigator.clipboard.writeText(demoShareUrl).catch(()=>{}); }} style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: copied ? T.emerald : T.accent, color: "#000",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}>
                  {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* WhatsApp option */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enviar por WhatsApp</p>
              {waUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti:\n${demoShareUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                      borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                      color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
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
                    color: T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
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
                <p style={{ fontSize: 11, color: T.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agendar llamada</p>
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  borderRadius: 10, background: P.blueS || "rgba(126,184,240,0.08)", border: `1px solid ${T.blue}30`,
                  color: T.blue, textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
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

      {/* Top Bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pill color={T.accent}>Vista Previa</Pill>
          <span style={{ fontSize: 12, color: T.txt2 }}>Landing page para {client}</span>
          {properties.length > 1 && (
            <span style={{ fontSize: 11, color: T.txt3 }}>· {properties.length} propiedades</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onCopyLink} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: `1px solid ${copied ? T.emerald + "50" : T.border}`,
            background: copied ? "rgba(109,212,168,0.08)" : T.glass,
            cursor: "pointer", color: copied ? T.emerald : T.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
            transition: "all 0.25s",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button onClick={() => setShowSharePanel(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)",
            cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
          }}>
            <Share2 size={14} /> Enviar al cliente
          </button>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color={T.txt2} />
          </button>
        </div>
      </div>

      {/* ─── LANDING PAGE CONTENT ─── */}
      <div style={{ paddingTop: 60 }}>
        {/* HERO SECTION */}
        <div style={{
          minHeight: "100vh", position: "relative",
          background: currentProp.img,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: "0 0 60px 0",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)" }} />

          {/* Floating nav dots */}
          {properties.length > 1 && (
            <div style={{
              position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {properties.map((p, i) => (
                <button key={p.id} onClick={() => setActiveProperty(i)} style={{
                  width: i === activeProperty ? 12 : 8,
                  height: i === activeProperty ? 12 : 8,
                  borderRadius: "50%", border: "none", cursor: "pointer",
                  background: i === activeProperty ? p.accent : "rgba(255,255,255,0.3)",
                  boxShadow: i === activeProperty ? `0 0 12px ${p.accent}60` : "none",
                  transition: "all 0.3s",
                }} title={p.name} />
              ))}
            </div>
          )}

          <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 40px", width: "100%" }}>
            {/* Branding */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, animation: "fadeInUp 0.6s ease both" }}>
              <StratosAtom size={24} color={currentProp.accent} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 400, fontFamily: fontDisp, letterSpacing: "0.1em" }}>{agencyName}</span>
            </div>

            {/* Personalized greeting */}
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontFamily: font, marginBottom: 8, fontWeight: 400, animation: "fadeInUp 0.65s 0.08s ease both" }}>
              Preparado exclusivamente para
            </p>
            <h1 style={{ fontSize: 52, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, animation: "floatSoft 5s 0.3s ease-in-out infinite, fadeInUp 0.7s 0.15s ease both" }}>
              {client || "Estimado Cliente"}
            </h1>

            {mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                {mensaje || `Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.`}
              </p>
            )}

            {!mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.
              </p>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", animation: "fadeInUp 0.7s 0.25s ease both" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={15} style={{ verticalAlign: "middle" }} /> Agendar Llamada
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  <CalendarDays size={15} style={{ marginRight: 8, verticalAlign: "middle" }} />Agendar Llamada
                </button>
              )}
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                  color: "#25D366", fontSize: 14, fontWeight: 600, fontFamily: fontDisp,
                  backdropFilter: "blur(10px)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <Phone size={14} /> WhatsApp
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)",
                  color: "#FFFFFF", fontSize: 14, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                  backdropFilter: "blur(10px)",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: 40, marginTop: 50 }}>
              {[
                { label: "Propiedades", value: properties.length },
                { label: "ROI Estimado", value: "8-13%" },
                { label: "Ubicaciones", value: [...new Set(properties.map(p => p.location))].length },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontSize: 28, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROPERTIES SECTION */}
        <div style={{ background: "#050810", padding: "80px 40px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <p style={{ fontSize: 11, color: currentProp.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>PORTAFOLIO EXCLUSIVO</p>
              <h2 style={{ fontSize: 36, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                Propiedades Seleccionadas
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 12, fontFamily: font }}>
                Cada propiedad ha sido elegida en base a sus criterios de inversión
              </p>
            </div>

            {properties.map((prop, idx) => (
              <div key={prop.id} style={{
                marginBottom: 60, borderRadius: 20, overflow: "hidden",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                animation: `scaleIn 0.55s ${idx * 0.1}s ease both`,
              }}>
                {/* Property Header */}
                <div style={{
                  height: 280, background: prop.img, position: "relative",
                  display: "flex", alignItems: "flex-end", padding: 32,
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)" }} />
                  <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          <Pill color={prop.accent}>{prop.type}</Pill>
                          <Pill color={T.emerald}>ROI {prop.roi}</Pill>
                        </div>
                        <h3 style={{ fontSize: 32, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                          {prop.name} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 200 }}>{prop.brand}</span>
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                          <MapPin size={14} color="rgba(255,255,255,0.5)" />
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: font }}>{prop.location} — {prop.zone}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>DESDE</p>
                        <p style={{ fontSize: 38, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                          {fmtPrice(prop.priceFrom)}
                        </p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>hasta {fmtPrice(prop.priceTo)} USD</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Property Body */}
                <div style={{ padding: 32 }}>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, fontFamily: font, marginBottom: 28, maxWidth: 800 }}>
                    {prop.description}
                  </p>

                  {/* Key Metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                    {[
                      { label: "Recámaras", value: prop.bedrooms, icon: Home, c: prop.accent },
                      { label: "ROI Anual", value: prop.roi, icon: TrendingUp, c: T.emerald },
                      { label: "Entrega", value: prop.delivery, icon: Calendar, c: T.blue },
                      { label: "Tamaños", value: prop.sizes[0] + " – " + prop.sizes[prop.sizes.length - 1], icon: Maximize2, c: T.violet },
                    ].map(m => (
                      <div key={m.label} style={{
                        padding: "16px", borderRadius: 12,
                        background: `${m.c}08`, border: `1px solid ${m.c}15`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <m.icon size={14} color={m.c} />
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Por qué esta propiedad</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {prop.highlights.map((h, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <CheckCircle2 size={16} color={prop.accent} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Amenidades</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {prop.amenities.map((a, i) => (
                        <span key={i} style={{
                          fontSize: 11, color: "rgba(255,255,255,0.6)", padding: "5px 12px",
                          borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                        }}>{a}</span>
                      ))}
                    </div>
                  </div>

                  {/* Gallery / Drive link CTA */}
                  <div style={{
                    marginTop: 8, padding: "20px 24px", borderRadius: 14,
                    background: (driveLinks[prop.id] || prop.driveLink) ? `${prop.accent}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${(driveLinks[prop.id] || prop.driveLink) ? prop.accent + "30" : "rgba(255,255,255,0.05)"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, fontFamily: fontDisp, marginBottom: 4 }}>
                        {(driveLinks[prop.id] || prop.driveLink) ? "Galería de imágenes disponible" : "Galería de imágenes"}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font }}>
                        {(driveLinks[prop.id] || prop.driveLink)
                          ? "Fotos reales del proyecto, renders y planos disponibles"
                          : "El asesor puede agregar un link a la galería de fotos desde el panel"}
                      </p>
                    </div>
                    {(driveLinks[prop.id] || prop.driveLink) ? (
                      <a
                        href={driveLinks[prop.id] || prop.driveLink}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "12px 24px", borderRadius: 10,
                          border: `1px solid ${prop.accent}50`,
                          background: `${prop.accent}15`,
                          color: prop.accent, textDecoration: "none",
                          fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Image size={15} /> Ver galería <ExternalLink size={12} />
                      </a>
                    ) : (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "12px 24px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: fontDisp,
                      }}>
                        <Image size={14} /> Galería no configurada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MARKET DATA SECTION */}
        <div style={{ background: "#030508", padding: "80px 40px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 50 }}>
              <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>DATOS DEL MERCADO 2026</p>
              <h2 style={{ fontSize: 32, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                ¿Por qué la Riviera Maya?
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40 }}>
              {[
                { label: "Crecimiento Anual", value: "14%", sub: "Nominal YoY", icon: TrendingUp, c: T.emerald },
                { label: "ROI por Rentas", value: "8-15%", sub: "Neto anual", icon: DollarSign, c: T.accent },
                { label: "Ocupación", value: "75-90%", sub: "Promedio anual", icon: Building2, c: T.blue },
              ].map(s => (
                <div key={s.label} style={{
                  padding: 28, borderRadius: 16, textAlign: "center",
                  background: `${s.c}06`, border: `1px solid ${s.c}15`,
                }}>
                  <s.icon size={24} color={s.c} style={{ margin: "0 auto 14px" }} />
                  <p style={{ fontSize: 36, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: "0.05em" }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: s.c, marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 18 }}>Ventajas para Inversionistas</p>
                {[
                  "Propiedad 100% legal para extranjeros via fideicomiso",
                  "Impuestos prediales mínimos vs EE.UU./Canadá",
                  "Nuevo Aeropuerto Internacional de Tulum",
                  "Tren Maya conectando toda la región",
                  "Turismo 365 días — clima cálido todo el año",
                  "Mercado de nómadas digitales en expansión",
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 18 }}>Infraestructura</p>
                {[
                  { title: "Aeropuerto de Tulum", desc: "Nuevo aeropuerto internacional, abrió en 2025" },
                  { title: "Tren Maya", desc: "Conectividad ferroviaria regional — impulsa plusvalía" },
                  { title: "Precio promedio por m²", desc: "$3,600 USD/m² — potencial de apreciación significativo" },
                  { title: "Plusvalía real", desc: "8% anual después de inflación" },
                ].map((inf, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.txt, fontFamily: fontDisp }}>{inf.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.4 }}>{inf.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA SECTION */}
        <div style={{ background: "#000000", padding: "80px 40px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <StratosAtom size={40} color={T.accent} />
            <h2 style={{ fontSize: 32, fontWeight: 300, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em", marginTop: 20, marginBottom: 12 }}>
              ¿Listo para dar el siguiente paso?
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32 }}>
              Agenda una llamada con <strong style={{ color: "rgba(255,255,255,0.8)" }}>{asesor}</strong> para conocer todos los detalles, resolver tus dudas y asegurar la mejor oportunidad de inversión.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={16} /> Agendar con {asesor.split(" ")[0]}
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  Agendar Llamada con {asesor.split(" ")[0]}
                </button>
              )}
              {waUrl ? (
                <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${asesor.split(" ")[0]}, vi tu presentación de propiedades y me interesa agendar una llamada. ¿Cuándo tienes disponibilidad?`)}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: "16px 40px", borderRadius: 12,
                    border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                    color: "#25D366", fontSize: 15, fontWeight: 600, fontFamily: fontDisp,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <Phone size={15} /> WhatsApp
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#FFFFFF", fontSize: 15, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            <div style={{ marginTop: 60, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Stratos Realty · Riviera Maya, México · Presentación confidencial generada para {client}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>
                Asesor: {asesor} · Abril 2026 · Todos los precios en USD · Sujeto a disponibilidad
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPagePreview;
