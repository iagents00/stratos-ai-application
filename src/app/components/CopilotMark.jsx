/**
 * app/components/CopilotMark.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Marca animada de "Copilot AI" — un lazo/cinta (estilo el remolino de Copilot)
 * pero con la PALETA DE MARCA STRATOS (verde menta → emerald → teal) y el mismo
 * lenguaje visual que los demás íconos del CRM.
 *
 * Tiene MOVIMIENTO: un "cometa" de luz recorre el lazo + un giro lento del trazo
 * + un halo que respira. Todo en CSS (transform/dashoffset) para que sea barato
 * y no trabe el compositing en móvil. Se apaga solo con `prefers-reduced-motion`
 * o pasando `animated={false}` (útil para listas largas de burbujas).
 *
 * Uso:  <CopilotMark size={22} />            (animado por defecto)
 *       <CopilotMark size={16} animated={false} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useId } from "react";

// Lazo (lemniscata) tipo "cinta de Copilot", centrado en un viewBox 0 0 48 48.
const LOOP_PATH =
  "M24 24 C18 12 6 14 6 24 C6 34 18 36 24 24 C30 12 42 14 42 24 C42 34 30 36 24 24 Z";

// Keyframes + reglas GLOBALES (nombres fijos): así todas las instancias comparten
// el mismo CSS (no se multiplican reglas distintas por cada avatar del chat). Lo
// único que cambia por instancia son los ids de gradiente (useId), obligatorio
// para que no colisionen los <linearGradient> entre SVGs.
const GLOBAL_CSS = `
  @keyframes cpmark-spin  { to { transform: rotate(360deg); } }
  @keyframes cpmark-comet { to { stroke-dashoffset: -100; } }
  @keyframes cpmark-halo  {
    0%,100% { opacity:.35; transform: scale(0.92); }
    50%     { opacity:.7;  transform: scale(1.08); }
  }
  .cpmark .cp-halo   { transform-origin:center; }
  .cpmark .cp-ribbon { transform-origin:center; will-change:transform; }
  .cpmark .cp-comet  { stroke-dasharray:22 78; stroke-dashoffset:0; will-change:stroke-dashoffset; }
  @media (prefers-reduced-motion: no-preference) {
    .cpmark--anim .cp-halo   { animation: cpmark-halo 3.6s ease-in-out infinite; }
    .cpmark--anim .cp-ribbon { animation: cpmark-spin 16s linear infinite; }
    .cpmark--anim .cp-comet  { animation: cpmark-comet 2.6s linear infinite; }
  }
`;

export default function CopilotMark({ size = 24, animated = true, isLight = false, style, title }) {
  const uid = useId().replace(/[:]/g, "");
  const gradId = `cpg-${uid}`;
  const cometId = `cpc-${uid}`;
  // Halo sutil en tema claro (sobre blanco se ve "neblinoso" si es fuerte).
  const halo = isLight
    ? "radial-gradient(circle, rgba(13,154,118,0.22) 0%, rgba(52,211,153,0.08) 45%, transparent 70%)"
    : "radial-gradient(circle, rgba(110,231,194,0.42) 0%, rgba(52,211,153,0.12) 45%, transparent 72%)";

  return (
    <span
      className={`cpmark${animated ? " cpmark--anim" : ""}`}
      role="img"
      aria-label={title || "Copilot AI"}
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <style>{GLOBAL_CSS}</style>

      {/* Halo de marca detrás del lazo */}
      <span
        className="cp-halo"
        style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.22)}px`,
          borderRadius: "50%",
          background: halo,
          filter: "blur(1.5px)",
          pointerEvents: "none",
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        style={{ position: "relative", display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="4" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6EE7C2" />
            <stop offset="0.5" stopColor="#34D399" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
          <linearGradient id={cometId} x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={isLight ? "#0FB98B" : "#EAFFF8"} />
            <stop offset="1" stopColor={isLight ? "#0D9A76" : "#6EE7C2"} />
          </linearGradient>
        </defs>

        <g className="cp-ribbon" transform="rotate(-16 24 24)">
          {/* Trazo base del lazo con gradiente de marca */}
          <path
            d={LOOP_PATH}
            stroke={`url(#${gradId})`}
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cometa de luz que recorre el lazo (movimiento) */}
          <path
            className="cp-comet"
            d={LOOP_PATH}
            pathLength={100}
            stroke={`url(#${cometId})`}
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: isLight ? "none" : "drop-shadow(0 0 2px rgba(234,255,248,0.9))" }}
          />
        </g>
      </svg>
    </span>
  );
}
