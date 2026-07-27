/**
 * ProyectoModal — Alta y edición de un desarrollo del catálogo, desde el CRM.
 * ─────────────────────────────────────────────────────────────────────────────
 * Es LA pantalla con la que el equipo de Duke registra sus propios proyectos:
 * pega la carpeta de Google Drive del desarrollo, completa los datos y queda
 * guardado en `catalogo_proyectos` (Supabase). Al guardarse aparece de una en:
 *   · Proyectos (este módulo)
 *   · Create → catálogo de propiedades para armar landings
 *   · el asistente de Telegram / Copilot (lee la misma tabla)
 *
 * Lo usan ERP.jsx y LandingPages/index.jsx — mismo modal en los dos lados para
 * que registrar sea idéntico se entre por donde se entre.
 *
 * Nada se borra: "Quitar del catálogo" es `visible = false`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2, X, HardDrive, ExternalLink, AlertCircle, Check, Eye, EyeOff, Loader2,
} from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { parseDriveLink, SECCION_CRM, SECCION_CRM_NOMBRE } from "../../lib/catalogo-proyectos";

const EMPTY = {
  desarrollo: "", ubicacion: "", zona: "", drive: "", maps: "",
  ticket: "", clasificacion: "", tipologia: "", entrega: "", entregaComo: "",
  financiamiento: "", mantenimiento: "", highlights: "",
  masterbroker: "", contacto: "", asesor: "",
  seccion: SECCION_CRM, seccionNombre: SECCION_CRM_NOMBRE, visible: true,
};

// Sugerencias (datalist) tomadas de lo que ya está cargado en el catálogo real.
const UBICACIONES = ["Playa del Carmen", "Tulum", "Cancún", "Puerto Morelos", "Puerto Aventuras", "Costa Mujeres", "Bacalar", "Akumal", "Holbox", "Mérida"];
const CLASIFICACIONES = ["STUDIO", "CONDO", "DEPARTAMENTO", "VILLA", "PENTHOUSE", "LUXURY", "CONDO LOCK OFF", "RENTA VACACIONAL", "LOTE RESIDENCIAL", "TERRENO"];
const TICKETS = ["0 a 150 k", "150k a 250k", "250k a 350k", "350k a 450k", "450k < +"];

/**
 * Campo de texto. VA FUERA del componente a propósito: si se define adentro,
 * React lo trata como un tipo nuevo en cada render, desmonta el <input> y el
 * usuario pierde el foco a cada letra que escribe.
 */
const TextField = ({ label, value, onChange, ph, list, wide, error, disabled, T, isLight }) => (
  <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
    <label style={{
      fontSize: 10, color: T.txt3, display: "block", marginBottom: 5, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: fontDisp,
    }}>{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={ph}
      list={list}
      disabled={disabled}
      style={{
        width: "100%", padding: "10px 13px", borderRadius: 9, boxSizing: "border-box",
        background: isLight ? "#FFFFFF" : T.glass,
        border: `1px solid ${error ? T.rose : T.border}`,
        color: T.txt, fontSize: 13, fontFamily: font, outline: "none",
        transition: "border-color 0.16s",
      }}
      onFocus={(e) => { e.target.style.borderColor = T.accent; }}
      onBlur={(e) => { e.target.style.borderColor = error ? T.rose : T.border; }}
    />
    {error && <p style={{ fontSize: 10.5, color: T.rose, margin: "4px 0 0", fontFamily: font }}>{error}</p>}
  </div>
);

export default function ProyectoModal({ onClose, onSave, onHide, initialData = null, T = P, canEdit = true }) {
  const isLight = T?.bg !== P.bg;
  const editing = !!initialData?.id;
  const fromSeed = initialData?.source === "seed";

  const [form, setForm] = useState(initialData ? { ...EMPTY, ...initialData } : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
    setServerError("");
  };

  const drive = parseDriveLink(form.drive);

  const validate = () => {
    const e = {};
    if (!form.desarrollo.trim()) e.desarrollo = "Ponle el nombre del desarrollo.";
    if (!form.ubicacion.trim()) e.ubicacion = "La ciudad/zona es lo que usa el buscador y el bot.";
    if (!form.drive.trim()) e.drive = "Pega la carpeta de Drive del desarrollo.";
    else if (!drive.ok) e.drive = drive.message;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving || !canEdit) return;
    if (!validate()) return;
    setSaving(true);
    setServerError("");
    // El link se guarda normalizado (sin ?usp=sharing ni /u/0/) para que no se
    // dupliquen carpetas iguales escritas de formas distintas.
    const payload = { ...form, drive: drive.url || form.drive.trim() };
    const res = await onSave(payload);
    setSaving(false);
    if (res?.ok === false) { setServerError(res.message || "No se pudo guardar."); return; }
    onClose();
  };

  const handleHide = async () => {
    if (saving || !onHide || !editing) return;
    setSaving(true);
    const res = await onHide(initialData.id);
    setSaving(false);
    if (res?.ok === false) { setServerError(res.message || "No se pudo quitar."); return; }
    onClose();
  };

  // ─── estilos ───
  const inputStyle = (key) => ({
    width: "100%", padding: "10px 13px", borderRadius: 9, boxSizing: "border-box",
    background: isLight ? "#FFFFFF" : T.glass,
    border: `1px solid ${errors[key] ? T.rose : T.border}`,
    color: T.txt, fontSize: 13, fontFamily: font, outline: "none",
    transition: "border-color 0.16s",
  });
  const labelStyle = {
    fontSize: 10, color: T.txt3, display: "block", marginBottom: 5, fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: fontDisp,
  };
  const sectionTitle = {
    fontSize: 10.5, color: T.accent, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", margin: "0 0 12px", fontFamily: fontDisp,
  };
  const errText = (key) => errors[key] ? (
    <p style={{ fontSize: 10.5, color: T.rose, margin: "4px 0 0", fontFamily: font }}>{errors[key]}</p>
  ) : null;

  // Props comunes de cada campo (TextField vive fuera del componente, ver arriba).
  const fieldProps = (k) => ({
    value: form[k], onChange: (v) => set(k, v), error: errors[k],
    disabled: !canEdit, T, isLight,
  });

  const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: "min(700px, calc(100vw - 24px))", maxHeight: "92vh", overflowY: "auto",
        background: isLight ? "#FFFFFF" : "#111318",
        border: `1px solid ${T.border}`, borderRadius: 22,
        boxShadow: isLight ? T.shadow3 : "0 40px 100px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 26px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          background: `linear-gradient(135deg, ${T.accent}0F 0%, transparent 60%)`,
          position: "sticky", top: 0, zIndex: 2,
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: `${T.accent}16`, border: `1px solid ${T.accent}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={19} color={T.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                {editing ? "Editar proyecto" : "Registrar proyecto"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: T.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {editing ? initialData.desarrollo : "Queda en el catálogo del equipo y en el asistente de Telegram"}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0, border: `1px solid ${T.border}`,
            background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} color={T.txt2} />
          </button>
        </div>

        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Aviso: sin permiso de escritura */}
          {!canEdit && (
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: `${T.amber}12`, border: `1px solid ${T.amber}33` }}>
              <AlertCircle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.5 }}>
                Estás viendo el proyecto en modo lectura. Para registrar o editar el catálogo hace falta perfil de
                administrador o director — pídeselo a quien administre el CRM.
              </p>
            </div>
          )}

          {/* Aviso: viene de la semilla del repo */}
          {fromSeed && (
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: `${T.blue}12`, border: `1px solid ${T.blue}33` }}>
              <AlertCircle size={16} color={T.blue} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.5 }}>
                Este desarrollo viene del catálogo de respaldo del repositorio, no de la base. Al guardarlo se crea
                como registro nuevo, ya editable por el equipo.
              </p>
            </div>
          )}

          {/* SECCIÓN 1 — La carpeta de Drive (lo que reemplaza el "mándanos el Drive") */}
          <div>
            <p style={sectionTitle}>Carpeta del desarrollo</p>
            <label style={labelStyle}>Enlace de Google Drive *</label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <input
                value={form.drive}
                onChange={(e) => set("drive", e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1Z0kcwoN7Bih…"
                disabled={!canEdit}
                style={{ ...inputStyle("drive"), flex: "1 1 300px", minWidth: 0 }}
                onFocus={(e) => { e.target.style.borderColor = T.accent; }}
                onBlur={(e) => { e.target.style.borderColor = errors.drive ? T.rose : T.border; }}
              />
              {drive.ok && (
                <a href={drive.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 9,
                  textDecoration: "none", color: T.emerald, background: `${T.emerald}14`,
                  border: `1px solid ${T.emerald}33`, fontSize: 12, fontFamily: fontDisp, fontWeight: 500, whiteSpace: "nowrap",
                }}>
                  <ExternalLink size={13} /> Abrir
                </a>
              )}
            </div>
            {errText("drive")}
            {!errors.drive && drive.ok && (
              <p style={{
                margin: "7px 0 0", fontSize: 11, fontFamily: font, lineHeight: 1.5,
                color: drive.message ? T.amber : T.emerald,
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                {drive.message
                  ? <><AlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} /> {drive.message}</>
                  : <><Check size={12} style={{ flexShrink: 0, marginTop: 2 }} /> Carpeta detectada. Ábrela para confirmar que el equipo la puede ver.</>}
              </p>
            )}
            <p style={{ margin: "9px 0 0", fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.55 }}>
              Es la carpeta con planos, renders y brochure. <strong style={{ color: T.txt2, fontWeight: 500 }}>Compártela
              como «cualquier persona con el enlace»</strong> antes de pegarla, o los asesores verán «solicitar acceso».
            </p>
          </div>

          {/* SECCIÓN 2 — Identidad */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <p style={sectionTitle}>Identidad</p>
            <div style={grid2}>
              <TextField {...fieldProps("desarrollo")} label="Nombre del desarrollo *" ph="Ej: Almara Residences" wide />
              <TextField {...fieldProps("ubicacion")} label="Ciudad / Ubicación *" ph="Ej: Tulum" list="ubicaciones-catalogo" />
              <TextField {...fieldProps("zona")} label="Zona / Referencia" ph="Ej: Aldea Zama" />
            </div>
            <datalist id="ubicaciones-catalogo">
              {UBICACIONES.map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>

          {/* SECCIÓN 3 — Producto y precio */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <p style={sectionTitle}>Producto y precio</p>
            <div style={grid2}>
              <TextField {...fieldProps("ticket")} label="Ticket (rango de precio)" ph="Ej: 250k a 350k" list="tickets-catalogo" />
              <TextField {...fieldProps("clasificacion")} label="Clasificación" ph="Ej: CONDO" list="clases-catalogo" />
              <TextField {...fieldProps("tipologia")} label="Tipología" ph="Ej: 2 HABS 2 BAÑOS" />
              <TextField {...fieldProps("entrega")} label="Entrega" ph="Ej: dic 2026 · INMEDIATA" />
              <TextField {...fieldProps("entregaComo")} label="Cómo se entrega" ph="Ej: Equipado · Llave en mano" />
              <TextField {...fieldProps("financiamiento")} label="Financiamiento" ph="Ej: 30-70" />
              <TextField {...fieldProps("mantenimiento")} label="Mantenimiento" ph="Ej: 2.5 USD / m²" />
              <TextField {...fieldProps("highlights")} label="Lo que lo vende" ph="Ej: VISTA AL MAR" />
            </div>
            <datalist id="tickets-catalogo">{TICKETS.map((t) => <option key={t} value={t} />)}</datalist>
            <datalist id="clases-catalogo">{CLASIFICACIONES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>

          {/* SECCIÓN 4 — Contacto interno + mapa */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <p style={sectionTitle}>Contacto y ubicación</p>
            <div style={grid2}>
              <TextField {...fieldProps("masterbroker")} label="Masterbroker / Desarrollador" ph="Ej: Caribbean Real Estate" />
              <TextField {...fieldProps("contacto")} label="Contacto" ph="Ej: 984 151 1761 Leslie Suaste" />
              <TextField {...fieldProps("asesor")} label="Asesor a cargo" ph="Opcional" />
              <TextField {...fieldProps("maps")} label="Google Maps" ph="https://www.google.com/maps/…" />
            </div>
            <p style={{ margin: "9px 0 0", fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.55 }}>
              Masterbroker y contacto son datos internos: no salen en las landings que se le mandan al cliente.
            </p>
          </div>

          {/* SECCIÓN 5 — Visibilidad */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <p style={sectionTitle}>Visibilidad</p>
            <button
              type="button"
              onClick={() => canEdit && set("visible", !form.visible)}
              disabled={!canEdit}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                padding: "12px 14px", borderRadius: 12, cursor: canEdit ? "pointer" : "default",
                background: form.visible ? `${T.emerald}10` : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"),
                border: `1px solid ${form.visible ? `${T.emerald}38` : T.border}`,
                transition: "background 0.16s, border-color 0.16s",
              }}
            >
              {form.visible
                ? <Eye size={16} color={T.emerald} style={{ flexShrink: 0 }} />
                : <EyeOff size={16} color={T.txt3} style={{ flexShrink: 0 }} />}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp }}>
                  {form.visible ? "Visible para el equipo" : "Oculto"}
                </span>
                <span style={{ display: "block", fontSize: 11, color: T.txt3, fontFamily: font, marginTop: 2, lineHeight: 1.45 }}>
                  {form.visible
                    ? "Aparece en Proyectos, en Create y cuando alguien le pregunta al asistente de Telegram."
                    : "Queda guardado pero no se lo muestra a los asesores ni al bot."}
                </span>
              </span>
            </button>
          </div>

          {/* Error del servidor */}
          {serverError && (
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: `${T.rose}12`, border: `1px solid ${T.rose}38` }}>
              <AlertCircle size={16} color={T.rose} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.5 }}>{serverError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 26px", borderTop: `1px solid ${T.border}`,
          display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap",
          position: "sticky", bottom: 0,
          background: isLight ? "#FFFFFF" : "#111318",
        }}>
          {editing && onHide && canEdit && !fromSeed ? (
            <button onClick={handleHide} disabled={saving} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10,
              border: `1px solid ${T.border}`, background: "transparent", color: T.txt3,
              fontSize: 12, fontFamily: fontDisp, cursor: saving ? "default" : "pointer",
            }}>
              <EyeOff size={13} /> Quitar del catálogo
            </button>
          ) : <span />}

          <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
            <button onClick={onClose} style={{
              padding: "11px 18px", borderRadius: 10, border: `1px solid ${T.border}`,
              background: "transparent", color: T.txt2, fontSize: 12.5, fontFamily: fontDisp, cursor: "pointer",
            }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canEdit}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "11px 20px", borderRadius: 10, border: "none",
                background: canEdit ? T.accent : T.border,
                color: canEdit ? "#04121A" : T.txt3,
                fontSize: 12.5, fontWeight: 600, fontFamily: fontDisp,
                cursor: saving || !canEdit ? "default" : "pointer",
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving
                ? <><Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> Guardando…</>
                : <><HardDrive size={14} /> {editing ? "Guardar cambios" : "Registrar proyecto"}</>}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
