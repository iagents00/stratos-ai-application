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
export const StratosAtomHex = ({ size = 22, color = "#FFFFFF", edge = "#6EE7C2", motion = false }) => {
  const uid = `atomhex-${size}-${String(color + edge).replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "block", overflow: "visible" }}>
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
      {motion && (
        <style>{`
          @keyframes ${uid}-core-breathe {
            0%, 100% { opacity: .9; transform: scale(.985); }
            50% { opacity: 1; transform: scale(1.035); }
          }
        `}</style>
      )}

      {/* Tres órbitas elípticas — 0°, 60°, 120° */}
      <g
        data-brand-motion={motion ? "true" : undefined}
        fill="none"
        strokeWidth="1.05"
        strokeLinecap="round"
        style={motion ? { transformOrigin: "16px 16px", transformBox: "view-box", willChange: "transform" } : undefined}
      >
        {motion && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 16 16; 34 16 16; 118 16 16; 205 16 16; 282 16 16; 360 16 16"
            keyTimes="0; .18; .42; .66; .84; 1"
            calcMode="spline"
            keySplines=".46 0 .24 1; .18 .82 .24 1; .58 0 .3 1; .18 .72 .28 1; .44 0 .2 1"
            dur="10.8s"
            repeatCount="indefinite"
          />
        )}
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" stroke={`url(#${uid}-ring)`} opacity="1" />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(60 16 16)" stroke={motion ? edge : `url(#${uid}-ring)`} opacity={motion ? "0.62" : "1"} />
        <ellipse cx="16" cy="16" rx="12.6" ry="4.6" transform="rotate(120 16 16)" stroke={motion ? color : `url(#${uid}-ring)`} opacity={motion ? "0.78" : "1"} />
      </g>

      {/* Núcleo — blanco brillante con borde mint sutil */}
      <circle
        data-brand-motion={motion ? "true" : undefined}
        cx="16"
        cy="16"
        r="2.4"
        fill={`url(#${uid}-core)`}
        style={motion ? { transformOrigin: "center", animation: `${uid}-core-breathe 5.8s ease-in-out infinite` } : undefined}
      />
      <circle cx="16" cy="16" r="2.4" fill="none" stroke={edge} strokeWidth="0.4" opacity="0.9" />
    </svg>
  );
};
