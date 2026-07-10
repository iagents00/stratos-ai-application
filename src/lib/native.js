/**
 * lib/native.js — Puente con la app nativa (Capacitor)
 * ─────────────────────────────────────────────────────────────────────────────
 * El CRM corre igual en el navegador y dentro del shell nativo Android/iOS
 * (carpeta mobile/). El shell carga esta web REMOTA e inyecta window.Capacitor
 * en la página, así que acá NO se importa ningún paquete @capacitor/* (no está
 * en el package.json del web — y no hace falta): se usa el bridge global.
 * En navegador cada helper cae al comportamiento web de siempre.
 *
 * Plugins nativos disponibles (instalados en mobile/package.json):
 *   Filesystem + Share      → guardar/compartir PDFs (doc.save no funciona en WebView)
 *   LocalNotifications      → notificaciones nativas (Notification API no existe en WebView Android)
 * ─────────────────────────────────────────────────────────────────────────────
 */

function cap() {
  return typeof window !== "undefined" ? window.Capacitor : undefined;
}

export function isNativeApp() {
  try { return !!cap()?.isNativePlatform?.(); } catch { return false; }
}

function nativePlugin(name) {
  try {
    const c = cap();
    if (!c?.isNativePlatform?.()) return null;
    return c.Plugins?.[name] || null;
  } catch { return null; }
}

/* ── Notificaciones ──────────────────────────────────────────────────────────
   Android 13+ exige el permiso POST_NOTIFICATIONS en runtime; el plugin
   LocalNotifications muestra el diálogo nativo. En web usamos Notification. */

export async function ensureNotifPermission() {
  const ln = nativePlugin("LocalNotifications");
  if (ln) {
    try {
      const st = await ln.checkPermissions();
      if (st?.display === "granted") return true;
      const req = await ln.requestPermissions();
      return req?.display === "granted";
    } catch { return false; }
  }
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "default") {
      const res = await Notification.requestPermission();
      return res === "granted";
    }
    return false;
  } catch { return false; }
}

/**
 * Muestra una notificación al usuario (nativa en la app, web en navegador).
 * `tag` evita apilar avisos repetidos: en nativo se traduce a un id fijo
 * derivado del tag (la nueva reemplaza a la anterior), en web es el tag normal.
 * `onClick` solo aplica en web — en nativo el tap se maneja con
 * addNotificationTapListener (el callback web no sobrevive al background).
 */
export async function notifyUser({ title, body, tag, onClick }) {
  const ln = nativePlugin("LocalNotifications");
  if (ln) {
    try {
      const st = await ln.checkPermissions();
      if (st?.display !== "granted") { ln.requestPermissions(); return false; }
      // id de 32 bits estable por tag (Java int) — mismo tag = reemplaza.
      let id = 1;
      if (tag) { id = 0; for (const ch of tag) id = ((id * 31) + ch.charCodeAt(0)) % 2147483647; id = id || 1; }
      await ln.schedule({ notifications: [{ id, title, body }] });
      return true;
    } catch { return false; }
  }
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "default") { Notification.requestPermission(); return false; }
    if (Notification.permission !== "granted") return false;
    const n = new Notification(title, { body, tag });
    if (onClick) n.onclick = () => { try { window.focus(); onClick(); n.close(); } catch { /* noop */ } };
    return true;
  } catch { return false; }
}

/**
 * Registra el tap sobre una notificación nativa (p.ej. navegar a WhatsApp).
 * Devuelve una función de cleanup para el useEffect. En web no hace nada
 * (ahí el onClick de notifyUser ya cubre el caso).
 */
export function addNotificationTapListener(callback) {
  const ln = nativePlugin("LocalNotifications");
  if (!ln) return () => {};
  let handle;
  try {
    const res = ln.addListener("localNotificationActionPerformed", () => { try { callback(); } catch { /* noop */ } });
    // addListener puede devolver el handle directo o una promesa de handle.
    if (res?.then) res.then(h => { handle = h; }).catch(() => {});
    else handle = res;
  } catch { /* noop */ }
  return () => { try { handle?.remove?.(); } catch { /* noop */ } };
}

/* ── Archivos / PDF ──────────────────────────────────────────────────────────
   En el WebView de Android/iOS los downloads por <a download>/blob (lo que
   hace jsPDF doc.save) NO abren nada: el botón parece muerto. En nativo se
   escribe el PDF al caché de la app y se abre la hoja de compartir del
   sistema (guardar en Archivos, WhatsApp, Drive, imprimir…). */

export async function savePdfDoc(doc, filename) {
  const c = cap();
  if (c?.isNativePlatform?.()) {
    const fs = c.Plugins?.Filesystem;
    const share = c.Plugins?.Share;
    if (fs) {
      const base64 = doc.output("datauristring").split(",")[1];
      const res = await fs.writeFile({ path: filename, data: base64, directory: "CACHE" });
      if (share) {
        try {
          await share.share({ title: filename, url: res.uri, dialogTitle: "Guardar o compartir el PDF" });
        } catch { /* usuario cerró la hoja de compartir — no es un error */ }
      }
      return true;
    }
  }
  doc.save(filename);
  return true;
}
