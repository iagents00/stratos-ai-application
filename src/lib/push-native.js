/**
 * lib/push-native.js — Push REAL dentro de la app nativa (APNs / FCM)
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE, HABIENDO YA UN push.js
 *
 * `push.js` implementa Web Push: VAPID, pushManager.subscribe() y la tabla
 * push_subscriptions. Funciona en el navegador y en la PWA instalada, y ahí se
 * queda como está. Pero Web Push necesita un Service Worker, y WKWebView solo
 * los permite si la app declara WKAppBoundDomains — la nuestra no lo hace, y
 * hacerlo traería otras restricciones. Conclusión: dentro de la app nativa,
 * Web Push NO funciona ni va a funcionar.
 *
 * Y las notificaciones locales que ya existen (notifyUser en native.js) solo se
 * disparan con la app ABIERTA, porque las dispara React al cambiar el estado.
 * Un lead que entra a las 11 de la noche, con la app cerrada, no avisa a nadie.
 * Eso es justo lo que este archivo resuelve.
 *
 * QUÉ HACE
 *   1. Pide permiso de notificaciones (diálogo nativo del sistema).
 *   2. Registra el dispositivo contra APNs y recibe un token.
 *   3. Guarda ese token en `device_tokens`, ligado al usuario.
 *   4. Escucha los pushes que llegan y el tap del usuario sobre ellos.
 *
 * QUÉ HACE FALTA DEL OTRO LADO (no es código: son dos credenciales)
 *   · iPhone  → una key de APNs (.p8) de la cuenta de Apple.
 *   · Android → un google-services.json y una cuenta de servicio de Firebase.
 *   Quien envía ya existe: la Edge Function send-push (canales-nativos.ts).
 *   Los pasos exactos para sacarlas están en mobile/NOTIFICACIONES.md.
 *
 * En web todo esto es no-op: los helpers devuelven false sin tocar nada.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";
import { isNativeApp, nativePlugin } from "./native";

/**
 * El plugin solo existe dentro del contenedor nativo.
 *
 * Usa el ayudante central de native.js A PROPÓSITO: antes leía
 * Capacitor.Plugins.PushNotifications directo, y eso devolvía null SIEMPRE —
 * Plugins solo se llena al llamar registerPlugin, cosa que nadie hacía. O sea
 * que el registro de push nunca llegó a ejecutarse dentro de la app, y sin un
 * solo error. El porqué completo está en el comentario de nativePlugin.
 */
function plugin() {
  return nativePlugin("PushNotifications");
}

/** "ios" | "android" | null */
function plataforma() {
  try { return window.Capacitor?.getPlatform?.() || null; } catch { return null; }
}

/**
 * Un token sacado con la app compilada desde Xcode vive en el SANDBOX de APNs,
 * y el servidor de producción lo rechaza con BadDeviceToken. Guardar cuál es
 * evita horas de depurar un envío que "no llega sin razón".
 */
function entorno() {
  try {
    // Vite reemplaza esto en tiempo de build: en un release es production.
    return import.meta.env.PROD ? "production" : "sandbox";
  } catch { return "production"; }
}

let yaRegistrado = false;

/**
 * Por que NO quedo registrado este telefono. Se muestra en Perfil.
 *
 * Existe por lo mismo que su equivalente en speech-native.js: TODO este archivo
 * falla en silencio. Se comprobo el 26-ago-2026 que device_tokens estaba vacio
 * despues de dias de uso real en un iPhone, y no habia forma de saber en cual
 * de los cuatro pasos se caia. Un fallo mudo no se arregla: se adivina.
 */
let motivo = "todavia-no-se-intento";
export function motivoPushNativo() { return motivo; }

/** true cuando el token quedo guardado contra el usuario. */
let registrado = false;
export function pushNativoRegistrado() { return registrado; }

/**
 * Guarda el token del dispositivo contra el usuario. Idempotente: la tabla
 * tiene UNIQUE(user_id, token), así que reabrir la app no duplica filas.
 */
async function guardarToken(userId, token) {
  if (!userId || !token) return false;
  try {
    const { error } = await supabase
      .from("device_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: plataforma() === "android" ? "android" : "ios",
          entorno: entorno(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      );
    if (error) {
      console.warn("[push-native] no se pudo guardar el token:", error.message);
      return false;
    }

    // UN TELEFONO, UNA IDENTIFICACION.
    //
    // Cada vez que se reinstala la app, el sistema entrega una identificacion
    // NUEVA — la vieja no se borra sola. Se comprobo el 27-ago-2026: despues de
    // tres reinstalaciones habia tres guardadas, y cada aviso salia TRES VECES
    // al mismo telefono. El usuario ve el mismo recordatorio repetido y no
    // entiende por que.
    //
    // Se borran las anteriores de esta misma plataforma. Para un equipo donde
    // cada persona usa un telefono es lo correcto; el dia que alguien use dos
    // aparatos a la vez habra que guardar tambien cual es cual.
    try {
      await supabase
        .from("device_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("platform", plataforma() === "android" ? "android" : "ios")
        .neq("token", token);
    } catch { /* si falla, lo peor que pasa es un aviso repetido */ }

    return true;
  } catch (e) {
    console.warn("[push-native] error guardando el token:", e?.message || e);
    return false;
  }
}

/**
 * Arranca el push nativo para un usuario. Llamar DESPUÉS del login: sin userId
 * el token no se puede ligar a nadie y el envío no sabría a qué teléfono ir.
 *
 * @param {string} userId
 * @param {(data:object)=>void} [alTocar] - qué hacer cuando el usuario toca la
 *        notificación. Recibe el payload (ej. { view: "c", leadId: 123 }).
 * @returns {Promise<boolean>} true si quedó registrado
 */
export async function iniciarPushNativo(userId, alTocar) {
  const PN = plugin();
  if (!PN) { motivo = "no-hay-plugin"; return false; }
  if (!userId) { motivo = "sin-sesion"; return false; }
  // Solo se sale temprano si el telefono QUEDO REGISTRADO de verdad. Antes
  // bastaba con haber INTENTADO, y eso dejaba un callejon sin salida: si el
  // primer intento se topaba con el permiso todavia sin responder, el motivo
  // quedaba congelado en "falta permiso" y nadie reintentaba nunca — ni cuando
  // la persona daba el permiso un segundo despues. Es lo que le paso a Angel el
  // 27-ago-2026: iOS decia que el permiso estaba dado y la app seguia diciendo
  // que faltaba.
  if (registrado) return true;
  yaRegistrado = false;

  // Los oyentes se limpian antes de volver a intentar: si no, cada reintento
  // deja uno mas y el token se guarda tantas veces como intentos hubo.
  try { await PN.removeAllListeners(); } catch { /* la primera vez no hay nada */ }

  // ⛔ ANDROID: registrar push SIN Firebase CIERRA LA APP.
  //
  // En Android el push va por Firebase. Si el APK no lleva google-services.json,
  // register() lanza del lado nativo "Default FirebaseApp is not initialized",
  // y eso NO lo atrapa el try/catch de acá: revienta en el hilo principal y la
  // app se cierra sola. Como esto corre en el efecto del login, se cerraba
  // JUSTO al entrar — lo que reportó Ángel el 25-ago-2026 probando el APK.
  //
  // La protección no puede ser "intentar y ver": para cuando falla, la app ya
  // se cerró. Por eso el interruptor lo pone quien COMPILA: el workflow de
  // Android escribe VITE_ANDROID_PUSH=1 solo si el secreto con el
  // google-services.json existe. Sin ese archivo, este código ni lo intenta.
  //
  // En iPhone no aplica: APNs no usa Firebase.
  if (plataforma() === "android" && import.meta.env.VITE_ANDROID_PUSH !== "1") {
    motivo = "este-APK-se-compilo-sin-Firebase";
    console.info("[push-native] este APK se compiló sin Firebase: no se registra push.");
    return false;
  }

  try {
    // El permiso se pide una sola vez: si el usuario ya dijo que no, iOS no
    // vuelve a mostrar el diálogo y hay que mandarlo a Ajustes.
    let permiso = await PN.checkPermissions();
    if (permiso?.receive === "prompt" || permiso?.receive === "prompt-with-rationale") {
      permiso = await PN.requestPermissions();
    }
    if (permiso?.receive !== "granted") {
      motivo = "permiso-de-avisos-no-concedido: " + String(permiso?.receive);
      return false;
    }

    // Los listeners se registran ANTES de register(): el evento 'registration'
    // puede llegar de inmediato y perderlo significa quedarse sin token.
    await PN.addListener("registration", async (t) => {
      const ok = await guardarToken(userId, t?.value);
      registrado = !!ok;
      motivo = ok ? "registrado" : "el-telefono-dio-su-numero-pero-no-se-pudo-guardar";
    });

    await PN.addListener("registrationError", (err) => {
      // El caso típico es que falte la capability de Push en el proyecto Xcode.
      motivo = "el-sistema-rechazo-el-registro: " + String(err?.error || err);
      console.warn("[push-native] APNs rechazó el registro:", err?.error || err);
    });

    // Llega con la app ABIERTA. iOS no muestra banner en ese caso, así que si
    // se quiere avisar visualmente hay que hacerlo desde la app.
    await PN.addListener("pushNotificationReceived", (n) => {
      if (import.meta.env.DEV) console.info("[push-native] recibido:", n?.title);
    });

    // El usuario tocó la notificación: acá se navega a donde corresponda.
    await PN.addListener("pushNotificationActionPerformed", (accion) => {
      try { alTocar?.(accion?.notification?.data || {}); } catch { /* noop */ }
    });

    await PN.register();
    yaRegistrado = true;
    // register() vuelve enseguida; el numero del telefono llega despues por el
    // listener de arriba.
    //
    // ⚠️ Solo se pisa el motivo si TODAVIA no paso nada. Antes se pisaba
    // siempre, y eso tapaba el error de verdad: si Apple rechazaba el registro
    // un instante antes de que register() retornara, el motivo real quedaba
    // reemplazado por un inocente "esperando..." y nadie se enteraba nunca de
    // cual habia sido el rechazo. Un diagnostico que borra su propia evidencia
    // es peor que no tener diagnostico.
    if (motivo === "todavia-no-se-intento" || motivo === "sin-sesion") {
      motivo = "esperando-que-el-sistema-de-el-numero";
    }
    return true;
  } catch (e) {
    motivo = "fallo-al-registrar: " + (e?.message || e);
    console.warn("[push-native] no se pudo iniciar:", e?.message || e);
    return false;
  }
}

/**
 * Borra el token de este dispositivo. Llamar al cerrar sesión: si no, el
 * teléfono sigue recibiendo los leads del usuario anterior.
 */
export async function detenerPushNativo(userId) {
  const PN = plugin();
  yaRegistrado = false;
  if (!PN || !userId) return;
  try {
    await PN.removeAllListeners();
    const { data } = await supabase
      .from("device_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("platform", plataforma() === "android" ? "android" : "ios");
    return data;
  } catch (e) {
    console.warn("[push-native] no se pudo limpiar el token:", e?.message || e);
  }
}

/** ¿Este dispositivo puede recibir push nativo? En web siempre false. */
export function soportaPushNativo() {
  return isNativeApp() && !!plugin();
}
