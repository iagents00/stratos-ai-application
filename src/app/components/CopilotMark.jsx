/**
 * app/components/CopilotMark.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Marca animada de "Copilot AI" — un TRIÁNGULO de puntas redondeadas con la
 * PALETA DE MARCA STRATOS (verde menta → emerald → teal).
 *
 * MOVIMIENTO: gira fluido y en su lugar, con EXACTAMENTE la misma técnica y
 * ritmo que el "átomo" del header (DynIsland.jsx):
 *   • Un ENVOLTORIO HTML (`.cp-rotor`) rota con `transform` — un span HTML gira
 *     siempre sobre el centro exacto de su caja (pivote fijo, sin "bailar").
 *     Como el viewBox es 0 0 48 48 y el centroide del triángulo cae en (24,24)
 *     = centro de la caja, el giro queda estable y centrado.
 *   • Solo `transform: rotate` (compositado por GPU = fluido, sin repintar cada
 *     frame). NADA de `stroke-dashoffset`/"cometa": esa animación de PINTADO era
 *     lo que se veía "turbio"/con recortes, sobre todo en móvil.
 *   • `20s linear infinite` INLINE + `data-brand-motion="true"`: mismo ritmo que
 *     el átomo, y la whitelist de `mobile-perf.css` deja que siga fluido en el
 *     celular (el freno anti-crash congela las infinitas inline que NO llevan
 *     ese atributo). Un halo/glow suave con `drop-shadow` (igual que el átomo).
 *   • Solo se detiene con `prefers-reduced-motion` o pasando `animated={false}`.
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

// Keyframes globales (nombre fijo, compartido por todas las instancias). El giro
// se aplica INLINE en el rotor (con data-brand-motion) — mismo patrón que el
// átomo — así el freno de mobile-perf.css no lo congela en el celular. La única
// regla por clase es el respeto a prefers-reduced-motion.
const GLOBAL_CSS = `
  @keyframes cpmark-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .cpmark .cp-rotor { animation: none !important; } }
`;

export default function CopilotMark({ size = 24, animated = true, isLight = false, style, title }) {
  const uid = useId().replace(/[:]/g, "");
  const gradId = `cpg-${uid}`;
  // Glow suave estilo "átomo" (drop-shadow, NO backdrop-filter), escalado al tamaño.
  const glow = Math.max(2, Math.round(size * 0.22));
  const glowColor = isLight ? "rgba(13,154,118,0.30)" : "rgba(110,231,194,0.38)";

  return (
    <span
      className="cpmark"
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

      {/* Rotor HTML: gira estable sobre su centro (pivote = centro de la caja =
          centroide del triángulo). Solo transform → fluido, sin recortes.
          data-brand-motion lo mantiene vivo en móvil (whitelist mobile-perf). */}
      <span
        className="cp-rotor"
        data-brand-motion="true"
        style={{
          display: "inline-flex",
          transformOrigin: "center",
          filter: `drop-shadow(0 0 ${glow}px ${glowColor})`,
          ...(animated ? { animation: "cpmark-spin 20s linear infinite" } : null),
        }}
      >
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
          </defs>
          <path
            d={TRI_PATH}
            stroke={`url(#${gradId})`}
            strokeWidth={4.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
