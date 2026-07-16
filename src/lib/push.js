/**
 * push.js — Sistema de suscripción a notificaciones Web Push
 * ─────────────────────────────────────────────────────────────────────────────
 * Esto es lo que permite que las notificaciones lleguen con la app CERRADA
 * en iPhone (PWA "Agregar a inicio") y Android.
 *
 * Flujo:
 *   1. Verificar si Push API está disponible en este navegador
 *   2. Pedir permiso de notificaciones (con await, desde gesto del usuario)
 *   3. Suscribirse al push service con nuestra VAPID public key
 *   4. Enviar la suscripción (endpoint + keys) a Supabase para guardarla
 *   5. El backend (Edge Function) usa esa info para mandar pushes
 *
 * iOS requiere iOS 16.4+ y que la PWA esté instalada en la pantalla de inicio.
 * Safari normal (sin instalar) NO soporta Web Push — solo la PWA instalada.
 */

// ── VAPID public key ──────────────────────────────────────────────────────
// Clave PÚBLICA de VAPID en formato RAW P-256 (base64url, 87 chars) — el que
// espera applicationServerKey de pushManager.subscribe(). La versión vieja
// estaba en formato DER/SPKI (91 bytes) → subscribe() fallaba y por eso NADIE
// quedaba suscrito (tabla push_subscriptions vacía). La clave PRIVADA que
// hace pareja vive en la DB (push_secure_config.vapid_private), NUNCA en git.
const VAPID_PUBLIC_KEY = 'BI73OWNrVS1mQwL825rbFkv7PxGCRklmJdrCgV6tvJtL2hx1cZSIbg_xs8sfnemFTBz0gtq-lBRFe_5Pypcif2o';

// URL base de Supabase (se inyecta desde el contexto de la app)
let _supabaseUrl = 'https://glulgyhkrqpykxmujodb.supabase.co';
let _supabaseAnonKey = '';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convierte ArrayBuffer a string base64url (sin padding) */
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verifica si este dispositivo soporta Web Push.
 * Requisitos: Service Worker activo + PushManager + Notification API.
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    'showNotification' in ServiceWorkerRegistration.prototype
  );
}

/**
 * Verifica si la PWA está instalada en la pantalla de inicio (standalone).
 * En iOS Safari normal, display-mode no es standalone → Web Push no funciona.
 */
export function isPwaInstalled() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
  return false;
}

/**
 * Inicializa el contexto de Supabase para guardar suscripciones.
 * Debe llamarse UNA vez al arrancar la app, después del login.
 */
export function initPushContext(supabaseUrl, supabaseAnonKey) {
  _supabaseUrl = supabaseUrl;
  _supabaseAnonKey = supabaseAnonKey;
}

// ── Permiso ─────────────────────────────────────────────────────────────────

/**
 * Pide permiso de notificaciones al usuario y devuelve el estado.
 * DEBE llamarse desde un gesto del usuario (click/tap) en iOS Safari/PWA.
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

/**
 * Devuelve el estado actual del permiso sin pedir nada.
 */
export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// ── Suscripción ─────────────────────────────────────────────────────────────

/**
 * Suscribe este dispositivo a notificaciones push.
 * Devuelve la suscripción (PushSubscription) o null si falla.
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    console.warn('[Stratos Push] Push API no disponible en este navegador');
    return null;
  }

  // El permiso debe estar concedido ANTES de suscribirse
  if (Notification.permission !== 'granted') {
    console.warn('[Stratos Push] Permiso de notificación no concedido aún');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const desiredKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);

    // Verificar si ya está suscrito
    let subscription = await registration.pushManager.getSubscription();

    // AUTO-SANACIÓN: si la suscripción existente usa OTRA VAPID key (p.ej. una
    // versión vieja con la key en formato DER que ya no sirve), la descartamos y
    // volvemos a suscribir con la key correcta. Sin esto, un device que quedó con
    // una suscripción vieja nunca recibiría push (el servidor no puede firmarla).
    if (subscription) {
      const currentKey = subscription.options?.applicationServerKey;
      if (currentKey && !sameKeyBytes(currentKey, desiredKey)) {
        console.warn('[Stratos Push] Suscripción con VAPID key vieja → re-suscribiendo');
        try { await subscription.unsubscribe(); } catch { /* noop */ }
        subscription = null;
      } else {
        console.log('[Stratos Push] Ya estábamos suscritos (key OK)');
        return subscription;
      }
    }

    // Suscribirse con la VAPID public key correcta
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: desiredKey,
    });

    console.log('[Stratos Push] Suscripción creada:', subscription.endpoint.substring(0, 60) + '...');
    return subscription;
  } catch (err) {
    console.error('[Stratos Push] Error al suscribir:', err);
    return null;
  }
}

/** Compara dos applicationServerKey (ArrayBuffer/Uint8Array) byte a byte. */
function sameKeyBytes(a, b) {
  try {
    const ua = new Uint8Array(a);
    const ub = new Uint8Array(b);
    if (ua.length !== ub.length) return false;
    for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Cancela la suscripción push de este dispositivo.
 */
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Stratos Push] Suscripción cancelada');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Stratos Push] Error al cancelar suscripción:', err);
    return false;
  }
}

/**
 * Devuelve la suscripción actual, o null si no hay.
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// ── Guardar en Supabase ─────────────────────────────────────────────────────

/**
 * Envía la suscripción push al backend para guardarla.
 * El userId es el auth.uid() de Supabase.
 */
export async function saveSubscriptionToBackend(userId, subscription) {
  if (!_supabaseUrl || !_supabaseAnonKey || !userId) {
    console.warn('[Stratos Push] Falta contexto de Supabase o userId');
    return false;
  }

  try {
    const sub = subscription.toJSON();
    const body = {
      p_user_id: userId,
      p_endpoint: sub.endpoint,
      p_p256dh: sub.keys.p256dh,
      p_auth: sub.keys.auth,
      p_platform: getPlatform(),
    };

    const res = await fetch(`${_supabaseUrl}/rest/v1/rpc/push_subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': _supabaseAnonKey,
        'Authorization': `Bearer ${_supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[Stratos Push] Error al guardar suscripción:', res.status);
      return false;
    }
    console.log('[Stratos Push] Suscripción guardada en backend');
    return true;
  } catch (err) {
    console.error('[Stratos Push] Error de red al guardar:', err);
    return false;
  }
}

/**
 * Elimina la suscripción del backend.
 */
export async function removeSubscriptionFromBackend(userId) {
  if (!_supabaseUrl || !_supabaseAnonKey || !userId) return false;

  try {
    const res = await fetch(
      `${_supabaseUrl}/rest/v1/rpc/push_unsubscribe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': _supabaseAnonKey,
          'Authorization': `Bearer ${_supabaseAnonKey}`,
        },
        body: JSON.stringify({ p_user_id: userId }),
      },
    );

    return res.ok;
  } catch {
    return false;
  }
}

// ── Flujo completo ──────────────────────────────────────────────────────────

/**
 * Flujo completo: pide permiso → suscribe → guarda en backend.
 * Ideal para un botón "Activar notificaciones".
 * Devuelve { success, permission, subscription }
 */
export async function enablePushNotifications(userId) {
  // Paso 1: pedir permiso
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, permission, subscription: null };
  }

  // Paso 2: suscribirse al push service
  const subscription = await subscribeToPush();
  if (!subscription) {
    return { success: false, permission, subscription: null };
  }

  // Paso 3: guardar en el backend
  const saved = await saveSubscriptionToBackend(userId, subscription);
  if (!saved) {
    // La suscripción existe localmente pero no se guardó en backend
    // El usuario recibiría pushes si alguien se los manda, pero no tenemos
    // su endpoint → intentar de nuevo más tarde
    console.warn('[Stratos Push] Suscripción local OK pero no se guardó en backend');
  }

  return { success: true, permission, subscription };
}

/**
 * Verifica el estado completo del sistema push en este dispositivo.
 * Útil para debugging y para mostrar el estado en la UI.
 */
export async function getPushStatus() {
  const supported = isPushSupported();
  const permission = getNotificationPermission();
  const installed = isPwaInstalled();
  let subscription = null;

  if (supported && permission === 'granted') {
    subscription = await getCurrentSubscription();
  }

  return {
    supported,
    permission,
    installed,
    isActive: !!(supported && permission === 'granted' && subscription),
    subscription,
    needsPermission: supported && permission === 'default',
    // Instalar (Agregar a inicio) SOLO es requisito en iOS: ahí el Web Push
    // exige la PWA en pantalla de inicio. En desktop/Android el push anda en el
    // navegador sin instalar → NO pedimos instalar, se activa directo.
    needsInstall: !installed && isIOSDevice(),
  };
}

/** True si es un iPhone/iPad (donde el push exige instalar la PWA). */
export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se hace pasar por Mac; detectarlo por touch.
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return iOS || iPadOS;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Convierte una VAPID key base64 (URL-safe) a Uint8Array para pushManager.subscribe()
 */
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getPlatform() {
  const ua = navigator.userAgent || '';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  if (ua.includes('Android')) return 'android';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Windows')) return 'windows';
  return 'other';
}

// Escuchar clicks en notificaciones (el SW manda postMessage al abrir)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      // Si hay un callback registrado, lo llamamos
      if (_onNotificationClick) {
        _onNotificationClick(event.data);
      }
    }
  });
}

let _onNotificationClick = null;

/**
 * Registra un callback para cuando el usuario toca una notificación.
 * La app debe llamar esto UNA vez para manejar la navegación.
 */
export function onNotificationClick(callback) {
  _onNotificationClick = callback;
}
