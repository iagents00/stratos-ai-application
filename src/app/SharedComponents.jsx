/**
 * SharedComponents.jsx
 * Shared primitive components used by all views.
 * These are extracted from App.jsx so view files can import them.
 */
import { useState, useEffect, useRef } from "react";
import { Users, Search, Plus, X, ChevronDown, Check } from "lucide-react";
import { P, font, fontDisp } from "../design-system/tokens";

/* ── GlassCard (G) ── */
export const G = ({ children, style, hover, onClick, np, T: Tprop }) => {
  const [h, setH] = useState(false);
  const T = Tprop || P;
  const isLight = T !== P;
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => setH(false)}
      onClick={onClick} style={{
        background: isLight
          ? (h ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)")
          : (h ? T.glassH : T.glass),
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        border: `1px solid ${h ? T.borderH : T.border}`,
        borderRadius: isLight ? 20 : T.r, padding: np ? 0 : 18,
        cursor: onClick ? "pointer" : "default",
        boxShadow: isLight
          ? (h
              ? "0 2px 4px rgba(15,23,42,0.04), 0 12px 28px rgba(15,23,42,0.08), 0 24px 56px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.8)"
              : "0 1px 3px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06), 0 16px 40px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.8)")
          : "none",
        transition: "all 0.3s cubic-bezier(.4,0,.2,1)", ...style,
      }}>{children}</div>
  );
};

/* ── Pill badge ── */
export const Pill = ({ children, color = P.accent, s, isLight = false }) => {
  const textColor = isLight
    ? `color-mix(in srgb, ${color} 62%, #0B1220 38%)`
    : color;
  const bgGrad = isLight
    ? `linear-gradient(135deg, ${color}2E 0%, ${color}18 100%)`
    : `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)`;
  const borderCol = isLight ? `${color}5C` : `${color}3A`;
  const shadow = isLight
    ? `0 1px 3px ${color}26, inset 0 1px 0 rgba(255,255,255,0.55)`
    : `0 1px 2px ${color}14, inset 0 1px 0 rgba(255,255,255,0.18)`;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: s ? "2px 8px" : "4px 11px", borderRadius: 99,
      fontSize: s ? 10 : 11, fontWeight: 700, color: textColor,
      background: bgGrad,
      border: `1px solid ${borderCol}`,
      boxShadow: shadow,
      letterSpacing: "0.015em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

/* ── Icon Box (Ico) ── */
export const Ico = ({ icon: I, sz = 34, is = 16, c = P.accent }) => (
  <div style={{
    width: sz, height: sz, borderRadius: sz > 32 ? 12 : 8, flexShrink: 0,
    background: `${c}0F`, border: `1px solid ${c}1A`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}><I size={is} color={c} /></div>
);

/* ── KPI Card ── */
export const KPI = ({ label, value, sub, icon: I, color, T: Tprop }) => {
  const [h, setH] = useState(false);
  const T = Tprop || P;
  const isLight = T !== P;
  const c = color || T.accent;

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative", overflow: "hidden",
        padding: "22px 20px 20px",
        borderRadius: 20,
        background: isLight
          ? "rgba(255,255,255,0.90)"
          : "rgba(8,12,24,0.85)",
        backdropFilter: "blur(28px) saturate(110%)",
        WebkitBackdropFilter: "blur(28px) saturate(110%)",
        border: `1px solid ${isLight ? "rgba(15,23,42,0.07)" : `${c}0C`}`,
        boxShadow: isLight
          ? `inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 16px rgba(15,23,42,0.06)`
          : `inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(255,255,255,0.04)`,
        transition: "transform 0.26s cubic-bezier(.4,0,.2,1), box-shadow 0.26s ease",
        transform: h ? "translateY(-3px)" : "translateY(0)",
        cursor: "default",
      }}
    >
      {/* Ambient glow — top-right, matches icon color */}
      <div style={{
        position: "absolute", top: -24, right: -24,
        width: 88, height: 88, borderRadius: "50%",
        background: isLight
          ? `radial-gradient(circle, ${c}0E 0%, transparent 70%)`
          : `radial-gradient(circle, ${c}10 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Top accent line — colored */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: isLight
          ? `linear-gradient(90deg, transparent, ${c}25 40%, ${c}25 60%, transparent)`
          : `linear-gradient(90deg, transparent, ${c}28 40%, ${c}28 60%, transparent)`,
        pointerEvents: "none",
      }} />

      {/* Icon — naked, branded color, no box */}
      <div style={{
        position: "absolute", top: 20, right: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: isLight ? 0.80 : 0.90,
      }}>
        <I size={17} color={c} strokeWidth={1.6} />
      </div>

      <p style={{
        margin: "0 0 14px",
        fontSize: 9.5, fontFamily: fontDisp, fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.28)",
        whiteSpace: "nowrap",
      }}>{label}</p>

      <p style={{
        margin: 0,
        fontSize: 40, fontWeight: 250,
        letterSpacing: "-0.025em", lineHeight: 1,
        fontFamily: fontDisp,
        color: isLight ? "rgba(15,23,42,0.93)" : "#FFFFFF",
      }}>{value}</p>

      {sub && (
        <div style={{
          marginTop: 14,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{
            width: 2, height: 12, borderRadius: 2, flexShrink: 0,
            background: `linear-gradient(180deg, ${c} 0%, ${c}44 100%)`,
          }} />
          <span style={{
            fontSize: 10.5, fontFamily: fontDisp, fontWeight: 500,
            letterSpacing: "-0.008em",
            color: isLight ? "rgba(15,23,42,0.44)" : "rgba(255,255,255,0.36)",
            whiteSpace: "nowrap",
          }}>{sub}</span>
        </div>
      )}
    </div>
  );
};

/* ── ChipSelect ── */
export const ChipSelect = ({ value, onChange, options = [], onAddNew, placeholder = "Seleccionar", icon: Icon = Users, color = P.accent, newLabel = "Registrar nuevo", searchPlaceholder = "Buscar o escribir…" }) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [newVal, setNewVal] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); setQuery(""); setNewVal(""); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const uniqueOptions = Array.from(new Set(options.filter(Boolean).map(s => String(s).trim()).filter(Boolean)));
  const filtered = query
    ? uniqueOptions.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : uniqueOptions;

  const handlePick = (v) => { onChange?.(v); setOpen(false); setAdding(false); setQuery(""); setNewVal(""); };
  const handleAdd = () => {
    const v = newVal.trim();
    if (!v) return;
    onAddNew?.(v);
    handlePick(v);
  };

  const hasValue = !!value;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height: 44, padding: "0 12px",
          borderRadius: 11,
          background: hasValue ? `${color}10` : P.glass,
          border: `1px solid ${hasValue ? `${color}44` : (open ? P.borderH : P.border)}`,
          color: hasValue ? "#FFF" : P.txt3,
          display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: hasValue ? 600 : 500,
          letterSpacing: "-0.005em",
          transition: "all 0.18s",
          boxShadow: open ? `0 0 0 3px ${color}1A` : "none",
          textAlign: "left",
        }}
        onMouseEnter={e => { if (!hasValue) { e.currentTarget.style.background = P.glassH; e.currentTarget.style.borderColor = P.borderH; } }}
        onMouseLeave={e => { if (!hasValue && !open) { e.currentTarget.style.background = P.glass; e.currentTarget.style.borderColor = P.border; } }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}2E`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} color={color} strokeWidth={2.5} />
        </div>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font }}>
          {value || placeholder}
        </span>
        {hasValue && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); handlePick(""); }}
            title="Limpiar"
            style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <X size={10} color={P.txt3} strokeWidth={2.5} />
          </span>
        )}
        <ChevronDown size={12} color={P.txt3} strokeWidth={2.5} style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 600,
          background: "#0B101A", border: `1px solid ${P.borderH}`, borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
          overflow: "hidden", animation: "fadeIn 0.14s ease",
          fontFamily: font,
        }}>
          {!adding && (
            <>
              {uniqueOptions.length > 3 && (
                <div style={{ padding: "9px 10px 8px", borderBottom: `1px solid ${P.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, background: P.glass, border: `1px solid ${P.border}` }}>
                    <Search size={11} color={P.txt3} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      style={{ flex: 1, border: "none", background: "transparent", outline: "none", color: P.txt, fontSize: 12, fontFamily: font, minWidth: 0 }}
                    />
                  </div>
                </div>
              )}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {filtered.length === 0 && (
                  <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 11.5, color: P.txt3, fontFamily: font }}>
                    {uniqueOptions.length === 0 ? "Sin registros — crea el primero abajo." : "Sin coincidencias."}
                  </div>
                )}
                {filtered.map(opt => {
                  const active = opt === value;
                  return (
                    <button key={opt} type="button" onClick={() => handlePick(opt)} style={{
                      width: "100%", padding: "9px 12px", background: active ? `${color}14` : "transparent",
                      border: "none", borderLeft: `2px solid ${active ? color : "transparent"}`,
                      display: "flex", alignItems: "center", gap: 9,
                      cursor: "pointer", transition: "background 0.12s",
                      color: active ? "#FFF" : P.txt2, fontSize: 12.5, fontWeight: active ? 600 : 500, fontFamily: font,
                      textAlign: "left",
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}38`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 800, color, fontFamily: fontDisp }}>
                        {opt.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
                      {active && <Check size={13} color={color} strokeWidth={2.8} />}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => { setAdding(true); setNewVal(query); }} style={{
                width: "100%", padding: "10px 12px", background: `${color}08`, borderTop: `1px solid ${P.border}`, border: "none",
                display: "flex", alignItems: "center", gap: 8,
                cursor: "pointer", transition: "background 0.14s",
                color, fontSize: 12, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.01em",
                textAlign: "left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = `${color}14`}
                onMouseLeave={e => e.currentTarget.style.background = `${color}08`}
              >
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}22`, border: `1px dashed ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Plus size={12} color={color} strokeWidth={2.8} />
                </div>
                <span>{newLabel}</span>
              </button>
            </>
          )}
          {adding && (
            <div style={{ padding: 10 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: fontDisp, margin: "0 0 7px 2px" }}>{newLabel}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  ref={inputRef}
                  value={newVal}
                  onChange={e => setNewVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } if (e.key === "Escape") { setAdding(false); setNewVal(""); } }}
                  placeholder="Nombre…"
                  style={{ flex: 1, height: 34, padding: "0 11px", borderRadius: 8, background: P.glass, border: `1px solid ${color}44`, color: P.txt, fontSize: 12.5, outline: "none", fontFamily: font, boxSizing: "border-box" }}
                />
                <button type="button" onClick={() => { setAdding(false); setNewVal(""); }} style={{ height: 34, padding: "0 10px", borderRadius: 8, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                  Cancelar
                </button>
                <button type="button" disabled={!newVal.trim()} onClick={handleAdd} style={{ height: 34, padding: "0 12px", borderRadius: 8, background: newVal.trim() ? color : "rgba(255,255,255,0.04)", border: `1px solid ${newVal.trim() ? color : P.border}`, color: newVal.trim() ? "#041016" : P.txt3, fontSize: 11, fontWeight: 800, cursor: newVal.trim() ? "pointer" : "not-allowed", fontFamily: fontDisp, letterSpacing: "0.01em" }}>
                  Guardar
                </button>
              </div>
              <p style={{ fontSize: 9.5, color: P.txt3, margin: "7px 2px 0", fontFamily: font }}>Disponible al registrar otros clientes más adelante.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
