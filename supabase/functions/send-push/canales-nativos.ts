// canales-nativos.ts — mandar avisos al TELÉFONO, no al navegador
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
//
// Hasta el 25-ago-2026 `send-push` solo hablaba un idioma: Web Push. Eso llega
// al navegador y a la PWA, y por eso en la computadora las notificaciones se
// veían perfectas. Dentro de la app instalada NO llegaba ninguna, y nadie sabía
// por qué: no había error, simplemente no existía el canal.
//
// La razón de fondo es que Web Push necesita un Service Worker, y ni el WebView
// de Android ni WKWebView en iOS lo permiten para push. El teléfono tiene su
// propio cartero:
//
//     iPhone  → APNs  (Apple Push Notification service)
//     Android → FCM   (Firebase Cloud Messaging)
//
// Este archivo es el traductor a esos dos idiomas. `index.ts` sigue mandando
// Web Push como siempre y ahora, además, llama acá.
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS CREDENCIALES NO VIVEN EN EL REPO
//
// El repositorio es PÚBLICO. Las llaves se cargan como secretos de la Edge
// Function (panel de Supabase → Edge Functions → Secrets), nunca en el código:
//
//     APNS_KEY_P8         contenido del archivo .p8 de Apple (texto completo)
//     APNS_KEY_ID         los 10 caracteres del nombre del archivo
//     APNS_TEAM_ID        5683F2CFT6
//     APNS_BUNDLE_ID      com.stratoscapitalgroup.crm   (opcional, ya viene por defecto)
//     FCM_SERVICE_ACCOUNT el JSON completo de la cuenta de servicio de Firebase
//
// Si una credencial falta, ese canal se salta y lo DICE en la respuesta. No se
// cae ni se queda mudo: un aviso que no llega tiene que dejar rastro, porque un
// fallo silencioso cuesta días de buscar dónde está el problema.
// ─────────────────────────────────────────────────────────────────────────────

const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.stratoscapitalgroup.crm";

/** Un teléfono registrado, tal como sale de la tabla `device_tokens`. */
export interface Dispositivo {
  token: string;
  platform: string;          // "ios" | "android" | "ios-voip"
  entorno?: string | null;   // "production" | "sandbox" (solo importa en iOS)
}

/** Lo que se quiere avisar, independiente del sistema operativo. */
export interface Aviso {
  title: string;
  body: string;
  tag: string;
  url: string;
  view: string;
  leadId: string | null;
  /** "llamada" hace que suene y se muestre como llamada entrante. */
  kind?: string | null;
}

export interface Resultado {
  enviados: number;
  fallidos: number;
  /** Tokens que el sistema operativo dio por muertos: hay que borrarlos. */
  muertos: string[];
  /** Por qué no se pudo enviar. Vacío = todo bien. */
  notas: string[];
}

const vacio = (): Resultado => ({ enviados: 0, fallidos: 0, muertos: [], notas: [] });

// ── Utilidades de firma ──────────────────────────────────────────────────────

function b64url(datos: ArrayBuffer | Uint8Array): string {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const textoAB64url = (s: string) => b64url(new TextEncoder().encode(s));

/**
 * Un .p8 (Apple) y el private_key de una cuenta de servicio (Google) son los
 * dos PEM en formato PKCS#8. Cambia solo el algoritmo con el que se firma.
 */
function pemABytes(pem: string): Uint8Array {
  const limpio = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(limpio);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── APNs (iPhone) ────────────────────────────────────────────────────────────

// Apple pide no regenerar el token de autorización más de una vez cada 20
// minutos y lo rechaza pasada 1 hora. Se guarda entre invocaciones "calientes".
let _apnsJwt: { valor: string; vence: number } | null = null;

async function jwtDeApple(): Promise<string | null> {
  const p8 = Deno.env.get("APNS_KEY_P8") ?? "";
  const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
  const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
  if (!p8 || !keyId || !teamId) return null;

  const ahora = Math.floor(Date.now() / 1000);
  if (_apnsJwt && _apnsJwt.vence > ahora + 60) return _apnsJwt.valor;

  const clave = await crypto.subtle.importKey(
    "pkcs8",
    pemABytes(p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const cabecera = textoAB64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const cuerpo = textoAB64url(JSON.stringify({ iss: teamId, iat: ahora }));
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    clave,
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  const jwt = `${cabecera}.${cuerpo}.${b64url(firma)}`;
  _apnsJwt = { valor: jwt, vence: ahora + 45 * 60 };
  return jwt;
}

/**
 * Arma el paquete que entiende iOS.
 *
 * `interruption-level: time-sensitive` es la pieza que hace que el aviso
 * atraviese el modo Concentración y se quede visible en la pantalla bloqueada.
 * Sin eso, un aviso de una llamada puede quedar guardado en el resumen y verse
 * media hora tarde — que para una llamada es lo mismo que no llegar.
 */
function cuerpoAPNs(aviso: Aviso) {
  const esLlamada = aviso.kind === "llamada";
  return {
    aps: {
      alert: { title: aviso.title, body: aviso.body },
      // Siempre "default": un nombre de archivo que no esté DENTRO del paquete
      // de la app hace que iOS no suene nada. Lo que distingue a una llamada no
      // es el sonido sino el interruption-level de abajo.
      sound: "default",
      badge: 1,
      "thread-id": aviso.tag,
      "interruption-level": esLlamada ? "time-sensitive" : "active",
      // Deja que iOS muestre los botones Contestar / Rechazar que la app
      // declara para esta categoría.
      category: esLlamada ? "LLAMADA" : "GENERAL",
      "mutable-content": 1,
    },
    // Lo que la app lee al tocar el aviso para saber a dónde llevar al usuario.
    url: aviso.url,
    view: aviso.view,
    lead_id: aviso.leadId,
    kind: aviso.kind ?? null,
    tag: aviso.tag,
  };
}

/**
 * El canal de LLAMADAS de Apple, que es distinto del de avisos normales.
 *
 * Usa la MISMA llave, pero cambian dos cosas y las dos son obligatorias:
 *   · el buzon lleva ".voip" al final del identificador de la app;
 *   · el tipo de aviso es "voip" en vez de "alert".
 *
 * Con eso iOS despierta la app aunque este cerrada y le exige mostrar la
 * pantalla de llamada. El cuerpo NO lleva la parte de "alert": no es un aviso
 * que se lea, es una orden para que la app dibuje la pantalla.
 *
 * ⚠️ Es un canal SEPARADO a proposito. Si esto falla, el aviso normal de la
 * llamada sigue llegando como una tira — se pierde la pantalla completa, no el
 * aviso.
 */
export async function enviarLlamadaVoIP(
  dispositivos: Dispositivo[],
  aviso: Aviso,
): Promise<Resultado> {
  const r = vacio();
  if (dispositivos.length === 0) return r;

  const jwt = await jwtDeApple();
  if (!jwt) {
    r.notas.push(`voip: faltan credenciales — ${dispositivos.length} iPhone(s) sin pantalla de llamada`);
    return r;
  }

  const cuerpo = JSON.stringify({
    caller: aviso.title.replace(/\s+te est[aá] llamando.*$/i, "").trim() || "Stratos AI",
    motivo: aviso.body,
    url: aviso.url,
    tag: aviso.tag,
  });

  await Promise.all(dispositivos.map(async (d) => {
    const host = d.entorno === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
    try {
      const resp = await fetch(`${host}/3/device/${d.token}`, {
        method: "POST",
        headers: {
          "authorization": `bearer ${jwt}`,
          // El ".voip" NO es opcional: sin el, Apple rechaza con BadTopic.
          "apns-topic": `${APNS_BUNDLE_ID}.voip`,
          "apns-push-type": "voip",
          "apns-priority": "10",
          // Una llamada de hace un minuto ya no sirve.
          "apns-expiration": String(Math.floor(Date.now() / 1000) + 45),
          "content-type": "application/json",
        },
        body: cuerpo,
      });
      if (resp.ok) { r.enviados++; return; }
      const texto = await resp.text();
      r.fallidos++;
      if (resp.status === 410 || texto.includes("BadDeviceToken") || texto.includes("Unregistered")) {
        r.muertos.push(d.token);
      }
      if (r.notas.length < 5) r.notas.push(`voip ${resp.status}: ${texto.slice(0, 160)}`);
    } catch (e) {
      r.fallidos++;
      if (r.notas.length < 5) r.notas.push(`voip error: ${(e as Error).message}`);
    }
  }));

  return r;
}

export async function enviarAPNs(
  dispositivos: Dispositivo[],
  aviso: Aviso,
): Promise<Resultado> {
  const r = vacio();
  if (dispositivos.length === 0) return r;

  const jwt = await jwtDeApple();
  if (!jwt) {
    r.notas.push(
      `apns: faltan credenciales (APNS_KEY_P8/APNS_KEY_ID/APNS_TEAM_ID) — ${dispositivos.length} iPhone(s) sin avisar`,
    );
    return r;
  }

  const esLlamada = aviso.kind === "llamada";
  const cuerpo = JSON.stringify(cuerpoAPNs(aviso));

  await Promise.all(dispositivos.map(async (d) => {
    // Un token sacado con la app compilada desde Xcode vive en el sandbox y el
    // servidor de producción lo rechaza con BadDeviceToken. Por eso se guarda
    // de qué entorno vino cada uno.
    const host = d.entorno === "sandbox"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
    try {
      const resp = await fetch(`${host}/3/device/${d.token}`, {
        method: "POST",
        headers: {
          "authorization": `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "apns-collapse-id": aviso.tag.slice(0, 64),
          // CUÁNTO VALE LA PENA GUARDAR ESTE AVISO SI EL TELÉFONO NO ESTÁ.
          //
          // Estaba justo al revés y era grave: los recordatorios llevaban
          // expiration 0 —«entregar ahora o descartar para siempre»— así que un
          // asesor con el teléfono apagado o sin señal los perdía sin enterarse,
          // y la llamada, que es lo único que de verdad caduca, no llevaba nada
          // y Apple podía entregarla horas después.
          //
          // Una llamada de hace diez minutos no sirve; un recordatorio o un lead
          // sirven igual cuando el teléfono vuelve a tener señal.
          ...(esLlamada
            ? { "apns-expiration": String(Math.floor(Date.now() / 1000) + 60) }
            : {}),
          "content-type": "application/json",
        },
        body: cuerpo,
      });
      if (resp.ok) {
        r.enviados++;
        return;
      }
      const texto = await resp.text();
      r.fallidos++;
      // 410 = el usuario desinstaló la app. BadDeviceToken = token de otro
      // entorno o de otra app. En ambos casos el token ya no sirve.
      if (resp.status === 410 || texto.includes("BadDeviceToken") || texto.includes("Unregistered")) {
        r.muertos.push(d.token);
      }
      if (r.notas.length < 5) r.notas.push(`apns ${resp.status}: ${texto.slice(0, 160)}`);
    } catch (e) {
      r.fallidos++;
      if (r.notas.length < 5) r.notas.push(`apns error: ${(e as Error).message}`);
    }
  }));

  return r;
}

// ── FCM (Android) ────────────────────────────────────────────────────────────

let _googleToken: { valor: string; vence: number } | null = null;

interface CuentaServicio {
  client_email: string;
  private_key: string;
  project_id: string;
}

function cuentaDeServicio(): CuentaServicio | null {
  const crudo = Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "";
  if (!crudo.trim()) return null;
  try {
    const j = JSON.parse(crudo);
    if (!j.client_email || !j.private_key || !j.project_id) return null;
    return j as CuentaServicio;
  } catch {
    return null;
  }
}

/**
 * Google no acepta la llave directamente: hay que cambiarla por un permiso de
 * una hora. Se firma un JWT con la llave privada de la cuenta de servicio y se
 * canjea en el endpoint de OAuth.
 */
async function tokenDeGoogle(sa: CuentaServicio): Promise<string | null> {
  const ahora = Math.floor(Date.now() / 1000);
  if (_googleToken && _googleToken.vence > ahora + 60) return _googleToken.valor;

  const clave = await crypto.subtle.importKey(
    "pkcs8",
    pemABytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const cabecera = textoAB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = textoAB64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  }));
  const firma = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    clave,
    new TextEncoder().encode(`${cabecera}.${cuerpo}`),
  );
  const assertion = `${cabecera}.${cuerpo}.${b64url(firma)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!resp.ok) {
    console.error("[fcm] no pude canjear el token:", (await resp.text()).slice(0, 200));
    return null;
  }
  const j = await resp.json();
  if (!j.access_token) return null;
  _googleToken = { valor: j.access_token, vence: ahora + 55 * 60 };
  return j.access_token;
}

export async function enviarFCM(
  dispositivos: Dispositivo[],
  aviso: Aviso,
): Promise<Resultado> {
  const r = vacio();
  if (dispositivos.length === 0) return r;

  const sa = cuentaDeServicio();
  if (!sa) {
    r.notas.push(
      `fcm: falta la credencial FCM_SERVICE_ACCOUNT — ${dispositivos.length} Android sin avisar`,
    );
    return r;
  }
  const acceso = await tokenDeGoogle(sa);
  if (!acceso) {
    r.notas.push("fcm: la credencial existe pero Google la rechazó");
    return r;
  }

  const esLlamada = aviso.kind === "llamada";
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  await Promise.all(dispositivos.map(async (d) => {
    const mensaje = {
      message: {
        token: d.token,
        notification: { title: aviso.title, body: aviso.body },
        // Los datos viajan aparte del texto: son los que lee la app al abrirse
        // desde el aviso para saber a qué pantalla ir.
        data: {
          url: aviso.url,
          view: aviso.view,
          lead_id: aviso.leadId ?? "",
          kind: aviso.kind ?? "",
          tag: aviso.tag,
        },
        android: {
          priority: "HIGH",
          // Mismo criterio que en iPhone: la llamada caduca en un minuto, todo
          // lo demás se guarda y se entrega cuando el teléfono vuelva.
          ttl: esLlamada ? "60s" : "86400s",
          notification: {
            // El canal decide el sonido y si el aviso aparece encima de todo.
            // Los crea la app al arrancar (ver avisos-nativos.js).
            channel_id: esLlamada ? "llamadas" : "avisos",
            tag: aviso.tag,
            default_vibrate_timings: true,
            notification_priority: esLlamada ? "PRIORITY_MAX" : "PRIORITY_HIGH",
            visibility: "PUBLIC",
          },
        },
      },
    };
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${acceso}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(mensaje),
      });
      if (resp.ok) {
        r.enviados++;
        return;
      }
      const texto = await resp.text();
      r.fallidos++;
      // UNREGISTERED = desinstalaron la app o el token caducó.
      if (
        resp.status === 404 || texto.includes("UNREGISTERED") ||
        texto.includes("INVALID_ARGUMENT")
      ) {
        r.muertos.push(d.token);
      }
      if (r.notas.length < 5) r.notas.push(`fcm ${resp.status}: ${texto.slice(0, 160)}`);
    } catch (e) {
      r.fallidos++;
      if (r.notas.length < 5) r.notas.push(`fcm error: ${(e as Error).message}`);
    }
  }));

  return r;
}

/**
 * Manda a los teléfonos de un usuario y devuelve el resumen combinado.
 * Reparte por plataforma y junta los resultados.
 */
export async function enviarANativos(
  dispositivos: Dispositivo[],
  aviso: Aviso,
): Promise<Resultado> {
  const ios = dispositivos.filter((d) => d.platform === "ios");
  const android = dispositivos.filter((d) => d.platform === "android");
  // El buzon de llamadas es otro: el mismo telefono tiene DOS identificaciones,
  // una para avisos y otra para llamadas, y no son intercambiables.
  const voip = dispositivos.filter((d) => d.platform === "ios-voip");

  const esLlamada = aviso.kind === "llamada";
  const [a, f, v] = await Promise.all([
    enviarAPNs(ios, aviso),
    enviarFCM(android, aviso),
    // La pantalla completa SOLO para llamadas. Mandar un aviso de llamada por
    // cualquier otra cosa haria que iOS le quite el permiso a la app.
    esLlamada ? enviarLlamadaVoIP(voip, aviso) : Promise.resolve(vacio()),
  ]);
  return {
    enviados: a.enviados + f.enviados + v.enviados,
    fallidos: a.fallidos + f.fallidos + v.fallidos,
    muertos: [...a.muertos, ...f.muertos, ...v.muertos],
    notas: [...a.notas, ...f.notas, ...v.notas],
  };
}
