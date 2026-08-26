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

import { nativePlugin } from "./native";

/** Por qué no arrancó el dictado nativo la última vez. Lo lee el Copilot. */
let ultimoMotivo = null;
export function motivoDictadoNativo() { return ultimoMotivo; }

/** El plugin solo existe dentro del contenedor nativo. */
function plugin() {
  return nativePlugin("SpeechRecognition");
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
 *
 * Cuando devuelve null, deja el MOTIVO en `ultimoMotivo`. Sin eso, un fallo
 * acá era indistinguible de "no estamos en la app": cuatro versiones seguidas
 * (25-ago-2026) con el mismo cartel de error y sin saber cuál de los cinco
 * pasos era el que fallaba. El motivo se muestra en el aviso del Copilot para
 * que la próxima prueba de una persona ya SEA el diagnóstico.
 */
export async function startNativeDictation({ onText, onError } = {}) {
  ultimoMotivo = null;
  const p = plugin();
  if (!p) { ultimoMotivo = "no-hay-plugin"; return null; }

  // El permiso se pide ACÁ y no al abrir la app: iOS muestra el diálogo en el
  // momento en que la persona toca el micrófono, que es cuando entiende para
  // qué se lo piden. Pedirlo al arrancar es la forma más rápida de que digan
  // que no.
  try {
    let perm = await p.checkPermissions();
    if (perm?.speechRecognition !== "granted") perm = await p.requestPermissions();
    if (perm?.speechRecognition !== "granted") {
      ultimoMotivo = "permiso-no-concedido: " + String(perm?.speechRecognition);
      onError?.("sin-permiso");
      return null;
    }
  } catch (e) {
    ultimoMotivo = "fallo-al-pedir-permiso: " + (e?.message || e);
    onError?.("sin-permiso");
    return null;
  }

  // La disponibilidad se consulta DESPUÉS del permiso, y solo para informar.
  //
  // En iOS `available()` devuelve SFSpeechRecognizer.isAvailable, que es FALSO
  // mientras el reconocimiento de voz no esté autorizado. Preguntarlo antes del
  // permiso es preguntarle a una puerta cerrada si se puede pasar: siempre dice
  // que no. Eso hacía este archivo, y por eso el dictado nunca arrancaba en el
  // iPhone aunque el plugin estuviera perfecto (Ángel, 25-ago-2026).
  //
  // Y no se corta si dice que no: se intenta arrancar igual. Si de verdad no se
  // puede, `start()` falla con un motivo REAL, que sirve mucho más que un "no
  // disponible" a secas.
  try {
    const disp = await p.available();
    if (!disp?.available) ultimoMotivo = "el-telefono-dice-que-no-esta-disponible (se intenta igual)";
  } catch { /* informativo: no frena nada */ }

  const oyentes = [];
  let vivo = true;
  // Se guarda lo ultimo transcrito para poder devolverlo al parar. Sin esto, el
  // texto solo existia dentro del callback y quien apagaba el microfono no
  // tenia forma de saber que se habia dicho.
  let textoFinal = "";

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
      // Verificado contra la interfaz real del plugin (8.1.11): el evento trae
      // accumulatedText (todo lo dicho, incluido el tramo actual), accumulated
      // (los tramos anteriores) y matches (solo el ultimo). Se prefiere el mas
      // completo, o un dictado largo pierde el principio.
      const t = ev?.accumulatedText ?? ev?.accumulated ?? ev?.matches?.[0] ?? "";
      if (t) { textoFinal = String(t); onText?.(textoFinal); }
    }));

    oyentes.push(await p.addListener("error", () => {
      if (vivo) onError?.("motor");
    }));

    const arranque = await p.start({
      language: "es-MX",
      partialResults: true,   // texto en vivo mientras habla, como el del teclado
      popup: false,           // sin la ventana de Google en Android: el chat es la interfaz
      addPunctuation: true,   // "punto", "coma" salen como signos
    });
    // start() devuelve las coincidencias finales cuando la sesion termina sola
    // (el usuario dejo de hablar). Es otro camino por el que puede llegar el
    // texto, y perderlo era quedarse sin nada teniendolo a mano.
    const deArranque = arranque?.matches?.[0];
    if (deArranque && !textoFinal) textoFinal = String(deArranque);
  } catch (e) {
    ultimoMotivo = "fallo-al-arrancar: " + (e?.message || e);
    vivo = false;
    await soltar();
    return null;
  }

  return {
    /**
     * Misma forma que un SpeechRecognition del navegador, pero DEVUELVE el
     * texto: quien apaga el microfono necesita saber que se dijo, y esperar a
     * que llegue un evento despues del stop es una carrera que se pierde.
     *
     * @returns {Promise<string>} lo transcrito, o "" si no hubo nada
     */
    stop: async () => {
      if (!vivo) return textoFinal;
      vivo = false;
      // forceStop cierra aunque el motor este esperando mas voz; sin el, en
      // Android la sesion puede quedar abierta unos segundos despues del toque.
      try { await p.forceStop?.({ timeout: 300 }); } catch { /* noop */ }
      try { await p.stop?.(); } catch { /* noop */ }

      // RED DE SEGURIDAD: en vez de confiar en que llego un evento, se le
      // PREGUNTA al motor cual fue el ultimo texto que reconocio. El plugin lo
      // guarda justo para esto (getLastPartialResult). Es la diferencia entre
      // "no se transcribio nada" y "se transcribio pero nadie lo recogio".
      try {
        const ultimo = await p.getLastPartialResult?.();
        if (ultimo?.text && String(ultimo.text).length > textoFinal.length) {
          textoFinal = String(ultimo.text);
        }
      } catch { /* si no esta, queda lo que junto onText */ }

      await soltar();
      return textoFinal;
    },
  };
}
