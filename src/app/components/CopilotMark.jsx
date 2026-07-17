/**
 * app/components/CopilotMark.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Marca animada de "Copilot AI" — un TRIÁNGULO de puntas redondeadas con la
 * PALETA DE MARCA STRATOS (verde menta → emerald → teal) y el mismo lenguaje
 * visual que los demás íconos del CRM.
 *
 * MOVIMIENTO CONTINUO Y ESTABLE (nunca se detiene): el triángulo gira LIMPIO
 * sobre su propio centro + un "cometa" de luz recorre el trazo + un halo que
 * respira. El giro se aplica a un ENVOLTORIO HTML (`.cp-rotor`), no al <g> del
 * SVG: un span HTML rota siempre sobre el centro exacto de su caja, sin la
 * ambigüedad de `transform-box`/`transform-origin` en SVG que hacía que el
 * ícono "bailara"/se saliera de centro. Como el viewBox es 0 0 48 48 y el
 * centroide del triángulo cae en (24,24) = centro de la caja, el giro queda
 * perfectamente centrado y en el mismo lugar. Todo en CSS (transform/
 * dashoffset), barato y sin trabar el compositing en móvil. Se apaga solo con
 * `prefers-reduced-motion` o pasando `animated={false}`.
 *
 * Uso:  <CopilotMark size={22} />            (animado por defecto)
 *       <CopilotMark size={16} animated={false} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useId } from "react";

// Triángulo equilátero (punta arriba) de esquinas redondeadas, centrado en
// (24,24) dentro de un viewBox 0 0 48 48. El centroide cae exactamente en
// (24,24) = centro de la caja → el giro es estable y en el mismo lugar.
const TRI_PATH =
  "M27.25 12.63 L35.47 26.87 Q38.72 32.5 32.22 32.5 L15.78 32.5 " +
  "Q9.28 32.5 12.53 26.87 L20.75 12.63 Q24 7 27.25 12.63 Z";

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
  .cpmark .cp-halo  { transform-origin:center; }
  /* El giro vive en un span HTML → pivote SIEMPRE en el centro de la caja
     (50% 50%), estable en todo navegador. No rotar el <g> del SVG. */
  .cpmark .cp-rotor { display:inline-flex; transform-origin:50% 50%; will-change:transform; }
  .cpmark .cp-comet { stroke-dasharray:24 76; stroke-dashoffset:0; will-change:stroke-dashoffset; }
  @media (prefers-reduced-motion: no-preference) {
    .cpmark--anim .cp-halo  { animation: cpmark-halo 3.6s ease-in-out infinite; }
    .cpmark--anim .cp-rotor { animation: cpmark-spin 9s linear infinite; }
    .cpmark--anim .cp-comet { animation: cpmark-comet 3.2s linear infinite; }
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

      {/* Halo de marca detrás del triángulo (no gira; solo respira) */}
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

      {/* Rotor HTML: gira estable sobre su centro. El SVG (triángulo + cometa)
          vive adentro y ocupa toda la caja, así el centro del giro = (24,24). */}
      <span className="cp-rotor" style={{ position: "relative" }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          style={{ display: "block", overflow: "visible" }}
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

          {/* Trazo base del triángulo con gradiente de marca */}
          <path
            d={TRI_PATH}
            stroke={`url(#${gradId})`}
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cometa de luz que recorre el triángulo (movimiento perpetuo) */}
          <path
            className="cp-comet"
            d={TRI_PATH}
            pathLength={100}
            stroke={`url(#${cometId})`}
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: isLight ? "none" : "drop-shadow(0 0 2px rgba(234,255,248,0.9))" }}
          />
        </svg>
      </span>
    </span>
  );
}
