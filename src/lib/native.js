/**
 * lib/native.js — Puente con la app nativa (Capacitor)
 * ─────────────────────────────────────────────────────────────────────────────
 * El CRM corre igual en el navegador y dentro del shell nativo Android/iOS
 * (carpeta mobile/). El shell EMPAQUETA este mismo bundle dentro del binario
 * (capacitor.config.json → webDir: "../dist") y lo sirve desde
 * capacitor://localhost, así que la app abre sin red y los datos siguen
 * viniendo en vivo de Supabase.
 *
 * Capacitor inyecta window.Capacitor en la página, así que acá NO se importa
 * ningún paquete @capacitor/* (no está en el package.json del web — y no hace
 * falta): se usa el bridge global.
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

/**
 * Devuelve el plugin nativo, o null si no estamos dentro de la app.
 *
 * ⚠️ EL registerPlugin NO ES OPCIONAL, aunque lo parezca.
 *
 * window.Capacitor.Plugins arranca VACÍO y solo se llena cuando alguien llama
 * registerPlugin. Se ve en el motor (@capacitor/core, createCapacitor):
 *
 *     const Plugins = (cap.Plugins = cap.Plugins || {});   // arranca vacío
 *     ...
 *     Plugins[pluginName] = proxy;                         // dentro de registerPlugin
 *
 * El lado nativo publica QUÉ plugins existen en Capacitor.PluginHeaders, pero
 * NO crea las entradas de Plugins. Por eso leer Plugins?.[name] a secas
 * devolvía null SIEMPRE dentro de la app — en silencio, sin un error en
 * consola. Eso dejaba mudos a Filesystem, Share, LocalNotifications, las
 * notificaciones push y el dictado: todos caían al camino "no hay plugin" y
 * usaban el respaldo web, que dentro de una app no existe.
 *
 * Lo encontró Ángel el 25-ago-2026: en la app de TestFlight el micrófono del
 * Copilot decía "no pude convertir tu voz en texto" aunque el dictado nativo
 * ya estaba instalado. La causa no era el dictado: era este renglón.
 *
 * registerPlugin(name) arma el proxy desde PluginHeaders y lo deja cacheado en
 * Plugins, así que llamarlo de más es gratis: la segunda vez devuelve el mismo.
 */
export function nativePlugin(name) {
  try {
    const c = cap();
    if (!c?.isNativePlatform?.()) return null;
    return c.Plugins?.[name] || c.registerPlugin?.(name) || null;
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
      // Si el permiso no está dado, se pide UNA vez con await y se sigue si lo
      // conceden en ese mismo diálogo (antes: requestPermissions sin await y
      // return false → el diálogo salía en momentos raros y la notificación
      // que lo gatilló se perdía aunque el usuario aceptara).
      const st = await ln.checkPermissions();
      if (st?.display !== "granted") {
        const req = await ln.requestPermissions();
        if (req?.display !== "granted") return false;
      }
      // id de 32 bits estable por tag (Java int) — mismo tag = reemplaza.
      let id = 1;
      if (tag) { id = 0; for (const ch of tag) id = ((id * 31) + ch.charCodeAt(0)) % 2147483647; id = id || 1; }
      await ln.schedule({ notifications: [{ id, title, body }] });
      return true;
    } catch { return false; }
  }
  try {
    if (typeof Notification === "undefined") return false;
    // antes: fire-and-forget (requestPermission sin await + return false)
    // ahora: esperamos la respuesta del diálogo antes de decidir
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }
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
  let removed = false; // por si el cleanup corre ANTES de que la promesa resuelva
  try {
    const res = ln.addListener("localNotificationActionPerformed", () => { try { callback(); } catch { /* noop */ } });
    // addListener puede devolver el handle directo o una promesa de handle.
    if (res?.then) res.then(h => { if (removed) h?.remove?.(); else handle = h; }).catch(() => {});
    else handle = res;
  } catch { /* noop */ }
  return () => { removed = true; try { handle?.remove?.(); } catch { /* noop */ } };
}

/* ── Archivos / PDF ──────────────────────────────────────────────────────────
   En el WebView de Android/iOS los downloads por <a download>/blob (lo que
   hace jsPDF doc.save) NO abren nada: el botón parece muerto. En nativo se
   escribe el PDF al caché de la app y se abre la hoja de compartir del
   sistema (guardar en Archivos, WhatsApp, Drive, imprimir…). */

export async function savePdfDoc(doc, filename) {
  const c = cap();
  if (c?.isNativePlatform?.()) {
    // Por el ayudante central: leer c.Plugins?.X directo devolvia null SIEMPRE
    // (ver el comentario de nativePlugin). Guardar un PDF dentro de la app
    // nunca funciono por esto.
    const fs = nativePlugin("Filesystem");
    const share = nativePlugin("Share");
    if (fs) {
      const base64 = doc.output("datauristring").split(",")[1];
      const res = await fs.writeFile({ path: filename, data: base64, directory: "CACHE" });
      // Sin Share no hay forma de mostrarle el archivo al usuario: mejor
      // fallar ruidoso (el catch del caller avisa) que un "listo" silencioso.
      if (!share) throw new Error("plugin Share no disponible en el shell");
      try {
        await share.share({ title: filename, url: res.uri, dialogTitle: "Guardar o compartir el PDF" });
      } catch { /* usuario cerró la hoja de compartir — no es un error */ }
      return true;
    }
  }
  doc.save(filename);
  return true;
}

/* ── Descargar un archivo ─────────────────────────────────────────────────────
   POR QUÉ EXISTE

   En el navegador, descargar es crear un <a download> y tocarlo. Dentro de la
   app eso NO HACE NADA: WKWebView ignora el atributo `download` y las URLs
   blob:, sin error ni aviso. Para el usuario el botón simplemente no responde.

   Lo reportó Ángel el 25-ago-2026 con el botón CSV de Control de Zooms, pero el
   mismo patrón estaba en SIETE lugares del CRM: los tres CSV, el respaldo, los
   documentos Word y la entrega del Hub.

   Acá el archivo se escribe en el almacenamiento de la app y se abre la hoja de
   compartir del sistema — que es como se guarda un archivo en un teléfono: el
   usuario elige Archivos, Drive, WhatsApp o lo que quiera.
   ────────────────────────────────────────────────────────────────────────── */

/** Convierte texto a base64 respetando acentos y ñ (btoa solo entiende latin1). */
function textoABase64(texto) {
  const bytes = new TextEncoder().encode(String(texto));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Guarda un archivo de texto (CSV, JSON, lo que sea) de la forma que corresponda
 * a cada plataforma. Devuelve true si se pudo.
 *
 * @param {string} nombre    nombre del archivo, con extensión
 * @param {string} contenido el texto
 * @param {string} [mime]    tipo, por defecto text/csv
 */
/**
 * Igual que descargarArchivo pero para archivos BINARIOS (un .docx, un .pdf, una
 * imagen). No se puede reusar la otra: aquella recibe texto, y pasar bytes por
 * un string los corrompe en silencio — el archivo se guarda, pesa lo esperado y
 * al abrirlo esta dañado, que es la peor forma de fallar.
 *
 * @param {string} nombre nombre del archivo, con extension
 * @param {Blob}   blob   el contenido
 */
export async function descargarBlob(nombre, blob) {
  if (isNativeApp()) {
    const fs = nativePlugin("Filesystem");
    const share = nativePlugin("Share");
    if (fs && share) {
      try {
        // FileReader devuelve "data:<mime>;base64,<datos>"; el plugin quiere
        // solo la parte de despues de la coma.
        const b64 = await new Promise((ok, mal) => {
          const fr = new FileReader();
          fr.onload = () => ok(String(fr.result).split(",")[1] || "");
          fr.onerror = mal;
          fr.readAsDataURL(blob);
        });
        const res = await fs.writeFile({ path: nombre, data: b64, directory: "CACHE" });
        try {
          await share.share({ title: nombre, url: res.uri, dialogTitle: "Guardar o compartir" });
        } catch { /* el usuario cerro la hoja de compartir: no es un error */ }
        return true;
      } catch { /* cae al camino del navegador */ }
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}

export async function descargarArchivo(nombre, contenido, mime = "text/csv;charset=utf-8") {
  if (isNativeApp()) {
    const fs = nativePlugin("Filesystem");
    const share = nativePlugin("Share");
    if (fs && share) {
      try {
        const res = await fs.writeFile({ path: nombre, data: textoABase64(contenido), directory: "CACHE" });
        try {
          await share.share({ title: nombre, url: res.uri, dialogTitle: "Guardar o compartir" });
        } catch { /* el usuario cerró la hoja de compartir: no es un error */ }
        return true;
      } catch { /* cae al camino del navegador, que al menos no rompe nada */ }
    }
  }
  try {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}
