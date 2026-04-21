/**
 * design-system/primitives.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componentes UI atómicos compartidos entre landing y app.
 * Cada componente es puro (sin efectos, sin estado global) y composable.
 *
 * Exporta:
 *   StratosAtom  — Logo SVG
 *   GlassCard    — Contenedor glassmorphism (antes "G")
 *   Pill         — Badge de etiqueta
 *   IconBox      — Ícono en caja con color de acento (antes "Ico")
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { P, font, fontDisp } from "./tokens";

// ─── LOGO STRATOS ─────────────────────────────────────────────────────────────
export const StratosAtom = ({ size = 20, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.2" opacity="0.3" />
    <circle cx="16" cy="16" r="4"  stroke={color} strokeWidth="1.2" opacity="0.6" />
    <circle cx="16" cy="16" r="1.5" fill={color} />
  </svg>
);

// ─── GLASS CARD ───────────────────────────────────────────────────────────────
/**
 * Contenedor base con efecto glassmorphism. Soporta hover interactivo.
 *
 * Props:
 *   children  — contenido
 *   style     — estilos adicionales (se fusionan)
 *   hover     — activa estilo al pasar el mouse
 *   onClick   — callback de click (cambia cursor a pointer)
 *   noPadding — elimina el padding interno (útil para imágenes o layouts propios)
 */
export const GlassCard = ({ children, style, hover, onClick, noPadding }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background:          hovered ? P.glassH : P.glass,
        backdropFilter:      "blur(32px)",
        WebkitBackdropFilter:"blur(32px)",
        border:              `1px solid ${hovered ? P.borderH : P.border}`,
        borderRadius:        P.r,
        padding:             noPadding ? 0 : 18,
        cursor:              onClick ? "pointer" : "default",
        transition:          "all 0.3s cubic-bezier(.4,0,.2,1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Alias corto para compatibilidad interna
export const G = GlassCard;

// ─── PILL / BADGE ─────────────────────────────────────────────────────────────
/**
 * Etiqueta de estado o categoría.
 *
 * Props:
 *   children — texto del badge
 *   color    — color del texto y borde (default: P.accent)
 *   small    — variante compacta
 */
export const Pill = ({ children, color = P.accent, small }) => (
  <span style={{
    display:       "inline-flex",
    alignItems:    "center",
    gap:           4,
    padding:       small ? "2px 8px" : "4px 11px",
    borderRadius:  99,
    fontSize:      small ? 10 : 11,
    fontWeight:    600,
    color,
    background:    `${color}12`,
    border:        `1px solid ${color}1A`,
    letterSpacing: "0.02em",
    whiteSpace:    "nowrap",
    fontFamily:    font,
  }}>
    {children}
  </span>
);

// ─── ICON BOX ─────────────────────────────────────────────────────────────────
/**
 * Contenedor cuadrado con ícono centrado. Útil para KPIs y nav items.
 *
 * Props:
 *   icon  — componente de Lucide React
 *   size  — tamaño del contenedor (default 34)
 *   iconSize — tamaño del ícono (default 16)
 *   color — color del acento (default P.accent)
 */
export const IconBox = ({ icon: Icon, size = 34, iconSize = 16, color = P.accent }) => (
  <div style={{
    width:           size,
    height:          size,
    borderRadius:    size > 32 ? 12 : 8,
    flexShrink:      0,
    background:      `${color}0F`,
    border:          `1px solid ${color}1A`,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
  }}>
    <Icon size={iconSize} color={color} />
  </div>
);

// Alias corto para compatibilidad interna
export const Ico = IconBox;

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
/**
 * Tarjeta de métrica con valor grande, label y subtítulo opcional.
 */
import { ArrowUpRight } from "lucide-react";

export const KPICard = ({ label, value, sub, icon, color = P.accent }) => (
  <GlassCard hover style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
      <p style={{
        fontSize: 13, color: P.txt2, marginBottom: 8,
        letterSpacing: "0.01em", fontWeight: 400, fontFamily: font,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 32, fontWeight: 300, color: "#FFFFFF",
        letterSpacing: "-0.04em", lineHeight: 1, fontFamily: fontDisp,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{
          fontSize: 12, color: P.emerald, marginTop: 10,
          display: "flex", alignItems: "center", gap: 3, fontWeight: 500,
        }}>
          <ArrowUpRight size={12} />{sub}
        </p>
      )}
    </div>
    <IconBox icon={icon} color={color} />
  </GlassCard>
);

// Alias corto para compatibilidad interna
export const KPI = KPICard;
