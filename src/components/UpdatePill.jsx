/**
 * components/UpdatePill.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Aviso de "hay versión nueva" DENTRO DE LA APP NATIVA (shell de mobile/).
 *
 * POR QUÉ EXISTE
 * El shell carga la web remota, así que cada apertura de la app trae la última
 * versión sola: la navegación del SW es network-first y el HTML de Vercel viene
 * con `max-age=0, must-revalidate`. El único hueco es la app que queda VIVA en
 * memoria durante días sin relanzarse: ahí el JavaScript que ya está corriendo
 * sigue siendo el que cargó ese día.
 *
 * POR QUÉ NO RECARGA SOLA  ← LEER ANTES DE "MEJORARLO"
 * La tentación obvia es recargar al detectar versión nueva. Eso YA EXISTIÓ y se
 * eliminó en el PR #594 por el reporte «la abro en la Mac o en el iPhone y se
 * recarga varias veces sola, como lageada». Volver a poner un reload automático
 * (por controllerchange, por SW_UPDATED o por lo que sea) reintroduce ese bug.
 * Acá la recarga la dispara SIEMPRE el usuario tocando el botón: una sola, sin
 * posibilidad de loop.
 *
 * CÓMO DETECTA
 * No mira el Service Worker: main.jsx le manda SKIP_WAITING apenas se instala,
 * así que para cuando este componente miraría, ya no hay worker en `waiting`.
 * En vez de eso compara el bundle de entrada — `/assets/index-<hash>.js` — que
 * tiene el HASH DEL CONTENIDO en el nombre. Si el HTML del servidor apunta a un
 * hash distinto del que está corriendo, hay build nuevo. Es automático: no
 * depende de que nadie se acuerde de subir un número de versión.
 *
 * SOLO EN NATIVO: en el navegador la gente recarga sola y no hace falta ruido.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { isNativeApp } from "../lib/native";
import { P, font, fontDisp } from "../design-system/tokens";

// Ritmo de chequeo. Es un GET del HTML (unos pocos KB) y solo con la app en
// primer plano, así que no pesa ni en datos ni en batería.
const CHECK_EVERY_MS = 15 * 60 * 1000; // 15 min con la app abierta
const MIN_GAP_MS     = 60 * 1000;      // nunca dos chequeos en menos de 1 min

const ENTRY_RE = /<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/i;

/** Bundle de entrada que está corriendo AHORA, leído del propio DOM. */
function entradaActual() {
  try {
    const s = document.querySelector('script[type="module"][src*="/assets/"]');
    return s ? new URL(s.src, window.location.origin).pathname : null;
  } catch { return null; }
}

/** Bundle de entrada que el servidor está sirviendo en este momento. */
async function entradaDelServidor() {
  // cache:"no-store" salta el caché HTTP. El SW no intercepta esto como
  // navegación (no lleva Accept: text/html), así que sale a la red de verdad.
  const res = await fetch(`/?_uv=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(ENTRY_RE);
  return m ? m[1] : null;
}

export default function UpdatePill() {
  const [hayUpdate, setHayUpdate] = useState(false);
  const [oculto, setOculto]       = useState(false);
  const ultimoChequeo             = useRef(0);

  const chequear = useCallback(async () => {
    const ahora = Date.now();
    if (ahora - ultimoChequeo.current < MIN_GAP_MS) return;
    ultimoChequeo.current = ahora;
    try {
      const actual = entradaActual();
      if (!actual) return;                       // dev server: no hay /assets/
      const servidor = await entradaDelServidor();
      if (servidor && servidor !== actual) setHayUpdate(true);
    } catch { /* sin red o servidor caído: se reintenta al próximo ciclo */ }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;

    // Handlers con nombre + cleanup explícito: función anónima inline deja
    // listeners huérfanos en cada render. Ver ZONA CRÍTICA en CLAUDE.md.
    const alVolverAlFrente = () => { if (!document.hidden) chequear(); };

    const arranque = setTimeout(chequear, 20000); // no competir con el boot
    const timer    = setInterval(() => { if (!document.hidden) chequear(); }, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", alVolverAlFrente);

    return () => {
      clearTimeout(arranque);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolverAlFrente);
    };
  }, [chequear]);

  if (!hayUpdate || oculto) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        // Por encima de la barra inferior (58px) + el indicador de inicio.
        bottom: "calc(72px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "calc(100vw - 32px)",
        padding: "8px 8px 8px 16px",
        borderRadius: 999,
        background: "rgba(9,18,37,0.94)",
        border: `1px solid ${P.border}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
        animation: "fadeIn 0.28s ease",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent, flexShrink: 0 }} />
      <span style={{ fontFamily: font, fontSize: 13, color: P.txt, whiteSpace: "nowrap" }}>
        Versión nueva disponible
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          fontFamily: fontDisp, fontSize: 13, fontWeight: 700,
          color: "#041016", background: P.accent,
          border: "none", borderRadius: 999,
          // 40px de alto: el mínimo cómodo para un dedo (Apple pide 44x44).
          minHeight: 40, padding: "0 18px",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        Actualizar
      </button>
      <button
        onClick={() => setOculto(true)}
        aria-label="Ocultar aviso"
        style={{
          fontFamily: font, fontSize: 18, lineHeight: 1,
          color: "rgba(255,255,255,0.38)", background: "transparent",
          border: "none", cursor: "pointer", flexShrink: 0,
          // Área táctil cuadrada de 40px aunque la "×" se vea chica.
          width: 40, height: 40, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}
