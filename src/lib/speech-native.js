/**
 * lib/speech-native.js — Dictado REAL dentro de la app nativa
 * ───────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 *
 * El Copilot dicta con `SpeechRecognition`, la API del navegador. Funciona en
 * Chrome y en Safari, pero **el navegador que corre dentro de una app no la
 * trae**: ni WKWebView en iPhone ni el WebView de Android. Resultado, hasta el
 * 25-ago-2026: el micrófono del Copilot grababa, el audio se descartaba y el
 * usuario veía «No pude convertir tu voz en texto». Reporte de Ángel probando
 * la app de TestFlight en su iPhone.
 *
 * Acá el dictado lo hace **el sistema operativo**, el mismo motor que usa el
 * micrófono del teclado. Es gratis, es instantáneo y —lo que más importa— el
 * audio NO sale del teléfono.
 *
 * CÓMO SE USA
 *   const sesion = await startNativeDictation({ onText, onError });
 *   if (sesion) { ...  sesion.stop()  ... }   // null ⇒ no hay dictado nativo
 *
 * Devuelve un objeto con `.stop()` a propósito: es la MISMA forma que tiene un
 * `SpeechRecognition` del navegador, así quien lo llama no necesita saber cuál
 * de los dos motores le tocó.
 *
 * EN WEB ES NO-OP. `startNativeDictation` devuelve null y el llamador sigue con
 * el camino de siempre. Ningún navegador se entera de que este archivo existe.
 *
 * PERMISOS
 *   iOS      NSSpeechRecognitionUsageDescription + NSMicrophoneUsageDescription
 *            (los dos declarados en mobile/ios/App/App/Info.plist)
 *   Android  RECORD_AUDIO (declarado en AndroidManifest.xml)
 * ───────────────────────────────────────────────────────────
 */

/** El plugin solo existe dentro del contenedor nativo. */
function plugin() {
  try {
    const c = typeof window !== "undefined" ? window.Capacitor : undefined;
    if (!c?.isNativePlatform?.()) return null;
    return c.Plugins?.SpeechRecognition || null;
  } catch { return null; }
}

/** ¿Este dispositivo puede dictar? Falso en web, siempre. */
export async function nativeDictationAvailable() {
  const p = plugin();
  if (!p) return false;
  try {
    const r = await p.available();
    return !!r?.available;
  } catch { return false; }
}

/**
 * Arranca el dictado nativo.
 *
 * @param {object}   opts
 * @param {Function} opts.onText   recibe el texto acumulado, en vivo
 * @param {Function} [opts.onError] se llama si el motor falla a mitad
 * @returns {Promise<{stop: Function}|null>} null si no hay dictado nativo
 */
export async function startNativeDictation({ onText, onError } = {}) {
  const p = plugin();
  if (!p) return null;

  try {
    const disp = await p.available();
    if (!disp?.available) return null;
  } catch { return null; }

  // El permiso se pide ACÁ y no al abrir la app: iOS muestra el diálogo en el
  // momento en que la persona toca el micrófono, que es cuando entiende para
  // qué se lo piden. Pedirlo al arrancar es la forma más rápida de que digan
  // que no.
  try {
    let perm = await p.checkPermissions();
    if (perm?.speechRecognition !== "granted") perm = await p.requestPermissions();
    if (perm?.speechRecognition !== "granted") {
      onError?.("sin-permiso");
      return null;
    }
  } catch {
    onError?.("sin-permiso");
    return null;
  }

  const oyentes = [];
  let vivo = true;

  const soltar = async () => {
    for (const h of oyentes) { try { await h?.remove?.(); } catch { /* noop */ } }
    oyentes.length = 0;
  };

  try {
    // `accumulated` trae TODO lo dicho en la sesión; `matches[0]` solo el último
    // tramo. Se prefiere el acumulado y se cae a matches solo si no vino, para
    // que un dictado largo no pierda el principio.
    oyentes.push(await p.addListener("partialResults", (ev) => {
      if (!vivo) return;
      const t = ev?.accumulated ?? ev?.accumulatedText ?? ev?.matches?.[0] ?? "";
      if (t) onText?.(String(t));
    }));

    oyentes.push(await p.addListener("error", () => {
      if (vivo) onError?.("motor");
    }));

    await p.start({
      language: "es-MX",
      partialResults: true,   // texto en vivo mientras habla, como el del teclado
      popup: false,           // sin la ventana de Google en Android: el chat es la interfaz
      addPunctuation: true,   // "punto", "coma" salen como signos
    });
  } catch {
    vivo = false;
    await soltar();
    return null;
  }

  return {
    /** Misma forma que un SpeechRecognition del navegador. */
    stop: () => {
      if (!vivo) return;
      vivo = false;
      // forceStop cierra aunque el motor esté esperando más voz; sin él, en
      // Android la sesión puede quedar abierta unos segundos después del toque.
      try { p.forceStop?.({ timeout: 300 }); } catch { /* noop */ }
      try { p.stop?.(); } catch { /* noop */ }
      soltar();
    },
  };
}
