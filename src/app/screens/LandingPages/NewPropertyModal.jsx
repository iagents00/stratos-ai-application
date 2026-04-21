import { useState } from "react";
import { createPortal } from "react-dom";
import { Building2, X, ExternalLink } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";

/* ─── Modal: Agregar Nueva Propiedad ─── */
const NewPropertyModal = ({ onClose, onSave, initialData = null }) => {
  const editing = !!initialData;
  const EMPTY = {
    name: "", brand: "", location: "Tulum", zone: "", type: "Condominios",
    priceFrom: "", priceTo: "", roi: "8-10%", delivery: "2026",
    bedrooms: "1-2 recámaras", sizes: "", badge: "NUEVO",
    description: "", highlights: "", amenities: "",
    accent: "#4ADE80", driveLink: "", unitsAvailable: "", totalUnits: "",
  };
  const [form, setForm] = useState(initialData ? {
    ...EMPTY,
    ...initialData,
    priceFrom: String(initialData.priceFrom || ""),
    priceTo: String(initialData.priceTo || ""),
    sizes: Array.isArray(initialData.sizes) ? initialData.sizes.join(", ") : (initialData.sizes || ""),
    highlights: Array.isArray(initialData.highlights) ? initialData.highlights.join(", ") : (initialData.highlights || ""),
    amenities: Array.isArray(initialData.amenities) ? initialData.amenities.join(", ") : (initialData.amenities || ""),
    unitsAvailable: String(initialData.unitsAvailable || ""),
    totalUnits: String(initialData.totalUnits || ""),
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: false })); };
  const accentOptions = ["#4ADE80","#22D3EE","#6DD4A8","#34D399","#38BDF8","#7EB8F0","#2DD4BF","#86EFAC"];
  const badgeOptions = ["NUEVO","EXCLUSIVO","PREVENTA","ÚLTIMAS UNIDADES","MAYOR ROI","ULTRA PREMIUM"];
  const locationOptions = ["Tulum","Playa del Carmen","Puerto Morelos","Puerto Aventuras","Cancún","Bacalar","Akumal","Holbox"];
  const typeOptions = ["Condominios","Villas","Penthouses","Condominios y Penthouses","Villas y Departamentos","Estudios y Condominios","Condominios de Lujo","Casas"];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.priceFrom || isNaN(parseInt(form.priceFrom))) e.priceFrom = true;
    if (!form.priceTo || isNaN(parseInt(form.priceTo))) e.priceTo = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const prop = {
      id: initialData?.id || Date.now(),
      name: form.name.trim(), brand: form.brand.trim(),
      location: form.location, zone: form.zone.trim() || form.location,
      type: form.type,
      sizes: form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : ["—"],
      bedrooms: form.bedrooms.trim() || "—",
      priceFrom: parseInt(form.priceFrom) || 0,
      priceTo: parseInt(form.priceTo) || 0,
      roi: form.roi.trim() || "8-10%",
      roiNum: parseFloat(form.roi) || 8,
      delivery: form.delivery.trim() || "2026",
      badge: form.badge,
      unitsAvailable: parseInt(form.unitsAvailable) || 10,
      totalUnits: parseInt(form.totalUnits) || 10,
      featured: initialData?.featured || false,
      accent: form.accent,
      amenities: form.amenities ? form.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
      highlights: form.highlights ? form.highlights.split(",").map(s => s.trim()).filter(Boolean) : [],
      description: form.description.trim(),
      img: `linear-gradient(135deg, ${form.accent}25 0%, ${form.accent}08 40%, #060a11 100%)`,
      custom: true,
      driveLink: form.driveLink.trim(),
      createdAt: initialData?.createdAt || new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      updatedAt: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    };
    onSave(prop);
    onClose();
  };

  const canSave = form.name.trim() && form.priceFrom && form.priceTo;

  const inputStyle = (key) => ({
    width: "100%", padding: "10px 14px", borderRadius: 8,
    background: P.glass, border: `1px solid ${errors[key] ? P.rose + "80" : P.border}`,
    color: P.txt, fontSize: 13, fontFamily: font, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  });
  const labelStyle = { fontSize: 10, color: P.txt2, display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: font };
  const sectionTitle = (accent) => ({ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontFamily: font });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: 680, maxHeight: "92vh", overflowY: "auto",
        background: "#0C1219", border: `1px solid ${P.border}`, borderRadius: 22,
        boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
      }}>
        {/* Header with accent preview */}
        <div style={{
          padding: "22px 28px", borderBottom: `1px solid ${P.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: `linear-gradient(135deg, ${form.accent}10 0%, transparent 60%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${form.accent}25 0%, #060a11 100%)`,
              border: `1px solid ${form.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={20} color={form.accent} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>
                {editing ? "Editar Propiedad" : "Registrar Propiedad"}
              </p>
              <p style={{ fontSize: 11, color: P.txt3, marginTop: 2 }}>
                {editing ? `Editando: ${initialData.name}` : "Agrega un nuevo desarrollo al catálogo permanente"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={P.txt2} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* SECCIÓN 1 — Identidad */}
          <div>
            <p style={sectionTitle(form.accent)}>Identidad del desarrollo</p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nombre del desarrollo *</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Almara Residences" style={inputStyle("name")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors.name?P.rose+"80":P.border} />
                {errors.name && <p style={{fontSize:10,color:P.rose,marginTop:3}}>Campo requerido</p>}
              </div>
              <div>
                <label style={labelStyle}>Marca / Sub-nombre</label>
                <input value={form.brand} onChange={e=>set("brand",e.target.value)} placeholder="Ej: by Four Seasons" style={inputStyle("brand")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Ubicación</label>
                <select value={form.location} onChange={e=>set("location",e.target.value)} style={{ ...inputStyle("location"), background: P.surface, cursor: "pointer" }}>
                  {locationOptions.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Referencia</label>
                <input value={form.zone} onChange={e=>set("zone",e.target.value)} placeholder="Ej: Aldea Zama, frente al mar" style={inputStyle("zone")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Badge</label>
                <select value={form.badge} onChange={e=>set("badge",e.target.value)} style={{ ...inputStyle("badge"), background: P.surface, cursor: "pointer" }}>
                  {badgeOptions.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 — Precios y financiero */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Precios y financiero</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                {k:"priceFrom",label:"Precio desde (USD) *",ph:"155000"},
                {k:"priceTo",label:"Precio hasta (USD) *",ph:"500000"},
                {k:"roi",label:"ROI anual",ph:"8-12%"},
                {k:"delivery",label:"Entrega estimada",ph:"2026"},
              ].map(f=>(
                <div key={f.k}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={inputStyle(f.k)}
                    onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors[f.k]?P.rose+"80":P.border} />
                  {errors[f.k] && <p style={{fontSize:10,color:P.rose,marginTop:3}}>Requerido</p>}
                </div>
              ))}
            </div>
            {/* Preview pricing */}
            {form.priceFrom && form.priceTo && (
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: `${form.accent}0A`, border: `1px solid ${form.accent}20`, fontSize: 12, color: form.accent, fontFamily: fontDisp }}>
                  Desde ${(parseInt(form.priceFrom)/1000).toFixed(0)}K USD
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}`, fontSize: 12, color: P.txt2, fontFamily: fontDisp }}>
                  Hasta ${(parseInt(form.priceTo)/1000).toFixed(0)}K USD
                </div>
                {form.roi && <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: 12, color: "#4ADE80", fontFamily: fontDisp }}>ROI {form.roi}</div>}
              </div>
            )}
          </div>

          {/* SECCIÓN 3 — Características */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Características</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle("type"), background: P.surface, cursor: "pointer" }}>
                  {typeOptions.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Recámaras</label>
                <input value={form.bedrooms} onChange={e=>set("bedrooms",e.target.value)} placeholder="1-3 recámaras" style={inputStyle("bedrooms")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Unidades disp.</label>
                <input value={form.unitsAvailable} onChange={e=>set("unitsAvailable",e.target.value)} placeholder="10" type="number" min="0" style={inputStyle("unitsAvailable")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
              <div>
                <label style={labelStyle}>Total unidades</label>
                <input value={form.totalUnits} onChange={e=>set("totalUnits",e.target.value)} placeholder="40" type="number" min="0" style={inputStyle("totalUnits")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tamaños disponibles (separados por coma)</label>
              <input value={form.sizes} onChange={e=>set("sizes",e.target.value)} placeholder="65 m², 85 m², 120 m², 180 m²" style={inputStyle("sizes")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
            </div>
          </div>

          {/* SECCIÓN 4 — Descripción y detalles */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Descripción y detalles</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Descripción del desarrollo</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3}
                placeholder="Describe el proyecto, su concepto, entorno y propuesta de valor..."
                style={{ ...inputStyle("description"), resize: "vertical", lineHeight: 1.6 }}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Puntos clave — highlights (separados por coma)</label>
              <input value={form.highlights} onChange={e=>set("highlights",e.target.value)}
                placeholder="Rooftop con piscina, Cenote natural, Solo 14 unidades exclusivas"
                style={inputStyle("highlights")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              {form.highlights && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.highlights.split(",").filter(h=>h.trim()).map((h,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: `${form.accent}10`, border: `1px solid ${form.accent}20`, color: form.accent }}>{h.trim()}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Amenidades (separadas por coma)</label>
              <input value={form.amenities} onChange={e=>set("amenities",e.target.value)}
                placeholder="Piscina, Rooftop, Gimnasio, Spa, Seguridad 24/7, Estacionamiento"
                style={inputStyle("amenities")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=P.border} />
              {form.amenities && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.amenities.split(",").filter(a=>a.trim()).map((a,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2 }}>{a.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5 — Media y visual */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${P.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Media y visual</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={10} color={P.accent} /> Link de galería de imágenes
                <span style={{ color: P.txt3, fontWeight: 400, textTransform: "none", marginLeft: 4 }}>— Google Drive, Dropbox o cualquier carpeta compartida</span>
              </label>
              <div style={{ position: "relative" }}>
                <ExternalLink size={13} color={form.driveLink ? form.accent : P.txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", flexShrink: 0 }} />
                <input
                  value={form.driveLink} onChange={e => set("driveLink", e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ ...inputStyle("driveLink"), paddingLeft: 34, borderColor: form.driveLink ? form.accent + "50" : P.border }}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=form.driveLink?form.accent+"50":P.border}
                />
              </div>
              {form.driveLink && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "#4ADE80" }}>✓ Link configurado</span>
                  <a href={form.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: form.accent, display: "flex", alignItems: "center", gap: 3 }}>
                    Verificar ↗
                  </a>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Color de acento para la tarjeta</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {accentOptions.map(c=>(
                  <button key={c} onClick={()=>set("accent",c)} title={c} style={{
                    width: 32, height: 32, borderRadius: 8, background: c,
                    border: form.accent===c ? `3px solid white` : "3px solid transparent",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: form.accent===c ? `0 0 12px ${c}80` : "none",
                  }} />
                ))}
                {/* Custom color */}
                <div style={{ position: "relative" }}>
                  <input type="color" value={form.accent} onChange={e=>set("accent",e.target.value)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", padding: 2, background: "transparent" }} title="Color personalizado" />
                </div>
              </div>
              {/* Preview card */}
              <div style={{
                marginTop: 12, padding: "14px 18px", borderRadius: 12,
                background: `linear-gradient(135deg, ${form.accent}15 0%, #060a11 100%)`,
                border: `1px solid ${form.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>{form.name || "Nombre del desarrollo"}</p>
                  {form.brand && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{form.brand}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {form.badge && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${form.accent}20`, border: `1px solid ${form.accent}30`, color: form.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{form.badge}</span>}
                    {form.type && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2 }}>{form.type}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {form.priceFrom && <p style={{ fontSize: 18, fontWeight: 700, color: form.accent, fontFamily: fontDisp }}>${(parseInt(form.priceFrom)/1000).toFixed(0)}K</p>}
                  {form.roi && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>ROI {form.roi}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${P.border}`, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: "13px 20px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.glass, color: P.txt2, fontSize: 13, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: "13px", borderRadius: 10, border: "none",
              background: canSave ? `linear-gradient(135deg, ${form.accent} 0%, ${form.accent}CC 100%)` : P.glass,
              color: canSave ? "#060A11" : P.txt3,
              fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: fontDisp,
              transition: "all 0.2s",
              boxShadow: canSave ? `0 4px 20px ${form.accent}40` : "none",
            }}>
              {editing ? "Guardar cambios" : "Registrar en catálogo"} {canSave && "→"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default NewPropertyModal;
