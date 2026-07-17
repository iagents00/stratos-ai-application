/**
 * app/components/CopilotMark.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Marca animada de "Copilot AI" — un TRIÁNGULO de puntas redondeadas con la
 * PALETA DE MARCA STRATOS (verde menta → emerald → teal).
 *
 * MOVIMIENTO: gira fluido y en su lugar, con la misma técnica y ritmo que el
 * "átomo" del header (DynIsland.jsx):
 *   • Un ENVOLTORIO HTML (`.cp-rotor`) rota con `transform` — un span HTML gira
 *     siempre sobre el centro exacto de su caja (pivote fijo, sin "bailar").
 *     El centroide del triángulo cae en (24,24) = centro de la caja → estable.
 *   • Solo `transform: rotate` (compositado por GPU = fluido, sin repintar cada
 *     frame). NADA de `stroke-dashoffset`/"cometa": esa animación de PINTADO era
 *     lo que se veía "turbio"/con recortes.
 *   • `20s linear infinite` INLINE + `data-brand-motion="true"`: mismo ritmo que
 *     el átomo, y la whitelist de `mobile-perf.css` deja que siga fluido en el
 *     celular. Glow suave con `drop-shadow` (igual que el átomo).
 *   • Los @keyframes se inyectan UNA sola vez en <head> (no por instancia), así
 *     montar/desmontar marcas nunca re-evalúa el keyframe ni reinicia el giro.
 *   • Solo se detiene con `prefers-reduced-motion` o pasando `animated={false}`.
 *
 * Uso:  <CopilotMark size={22} />            (animado por defecto)
 *       <CopilotMark size={16} animated={false} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useId } from "react";

// LAZO/lemniscata (la "cinta" ∞ verde de marca) — la forma ORIGINAL del Copilot
// que pidió Ángel de vuelta (2026-07-17: "no el triángulo; el verde que parecía
// un círculo o un rombo"). Centrado en (24,24) → el giro del rotor es estable.
// Se conserva la técnica nueva de animación (rotor HTML, sin cometa turbio);
// solo volvió la FORMA.
const LOOP_PATH =
  "M24 24 C18 12 6 14 6 24 C6 34 18 36 24 24 C30 12 42 14 42 24 C42 34 30 36 24 24 Z";

// Inyectá los @keyframes + la regla de reduced-motion UNA sola vez, a nivel de
// documento (no un <style> por instancia). Definir el mismo keyframe en muchos
// <style> que montan/desmontan puede hacer que el navegador re-evalúe la
// animación; con una única definición estable eso no pasa nunca.
const KEYFRAMES_ID = "cpmark-keyframes";
if (typeof document !== "undefined" && !document.getElementById(KEYFRAMES_ID)) {
  const el = document.createElement("style");
  el.id = KEYFRAMES_ID;
  el.textContent =
    "@keyframes cpmark-spin{to{transform:rotate(360deg)}}" +
    "@media (prefers-reduced-motion: reduce){.cpmark .cp-rotor{animation:none!important}}";
  document.head.appendChild(el);
}

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
          <g transform="rotate(-16 24 24)">
            <path
              d={LOOP_PATH}
              stroke={`url(#${gradId})`}
              strokeWidth={4.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </span>
    </span>
  );
}
