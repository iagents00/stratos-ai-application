/**
 * app/components/Logo.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Logos SVG de Stratos AI.
 * Extraído de App.jsx y CRM.jsx para eliminar duplicación.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * StratosAtom — Logo clásico con rings concéntricos.
 * Usado en header, sidebar, cards generales.
 */
export const StratosAtom = ({ size = 20, color = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="1.1" opacity="0.18" />
    <circle cx="16" cy="16" r="9"  stroke={color} strokeWidth="1.2" opacity="0.38" />
    <circle cx="16" cy="16" r="4.5" stroke={color} strokeWidth="1.25" opacity="0.68" />
    <circle cx="16" cy="16" r="1.6" fill={color} />
  </svg>
);

/**
 * StratosAtomHex — Logo con 3 órbitas elípticas rotadas + núcleo brillante.
 * Usado exclusivamente en el Centro de Agentes IA.
 */
export const StratosAtomHex = ({ size = 22, color = "#FFFFFF", edge = "#6EE7C2" }) => {
  const uid = `atomhex-${size}-${String(color).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "block" }}>
      <defs>
        <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor={edge}   stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={`${uid}-ring`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor={edge}  stopOpacity="0.55" />
          <stop offset="50%"  stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={edge}  stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Tres órbitas elípticas — 0°, 60°, 120° */}
      <g fill="none" strokeWidth="1" stroke={`url(#${uid}-ring)`} strokeLinecap="round">
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(120 16 16)" />
      </g>

      {/* Núcleo — blanco brillante con borde mint sutil */}
      <circle cx="16" cy="16" r="2.4" fill={`url(#${uid}-core)`} />
      <circle cx="16" cy="16" r="2.4" fill="none" stroke={edge} strokeWidth="0.4" opacity="0.9" />
    </svg>
  );
};
