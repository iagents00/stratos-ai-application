/**
 * lib/recordatorios-locales.js — que el recordatorio suene aunque no haya nada
 * ─────────────────────────────────────────────────────────────────────────────
 * LA IDEA
 *
 * Un recordatorio tiene algo que ningún otro aviso tiene: se sabe la hora de
 * antemano. «Recordame en dos minutos sacar la basura» no necesita que un
 * servidor despierte al teléfono a las 2:46 — el teléfono puede tener esa
 * alarma guardada desde las 2:44 y dispararla solo.
 *
 * Eso lo cambia todo, porque las alarmas locales:
 *   · suenan con la app CERRADA, igual que un push,
 *   · no dependen de Firebase ni de APNs — funcionan hoy, sin credenciales,
 *   · no dependen de internet: en un sótano sin señal, suenan igual.
 *
 * Este archivo lee los recordatorios que el usuario ya tiene agendados y los
 * deja programados en el teléfono. Lo hace al entrar y cada vez que la app
 * vuelve al frente, así se mantiene al día si alguien agenda algo desde la
 * computadora.
 *
 * QUÉ NO RESUELVE (y por qué el push sigue haciendo falta)
 * Solo sirve para lo que tiene hora conocida. «Iván te está llamando» o «entró
 * un lead» pasan sin aviso previo: para eso hace falta que alguien despierte al
 * teléfono desde afuera, y eso es APNs/FCM (ver canales-nativos.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";
import { isNativeApp, nativePlugin } from "./native";
import { CANAL_AVISOS } from "./avisos-nativos";

/** Hasta dónde mirar hacia adelante. Más allá no vale la pena: la app se va a
 *  volver a abrir muchas veces antes, y cada apertura reprograma. */
const HORAS_ADELANTE = 48;

/** Android no deja tener miles de alarmas pendientes; iOS corta en 64. Se
 *  toman las más próximas, que son las que importan. */
const TOPE = 48;

/**
 * Las notificaciones locales se identifican con un número, y el recordatorio
 * con un UUID. Se deriva uno del otro con un hash estable: el mismo
 * recordatorio da siempre el mismo número, así reprogramar lo REEMPLAZA en vez
 * de apilar copias. Sin esto, abrir la app diez veces dejaría diez alarmas
 * iguales y el teléfono sonaría diez veces.
 */
function idNumerico(uuid) {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (h * 31 + uuid.charCodeAt(i)) | 0;
  }
  // Positivo y dentro del rango que acepta Android (int de 32 bits).
  return Math.abs(h) % 2000000000;
}

/** El mismo texto que arma el servidor, para que el aviso se lea igual venga
 *  de donde venga. Si el payload no trae nada, se usa el tipo. */
function textoDe(r) {
  const p = r.payload || {};
  const titulo = p.title || "Recordatorio · Stratos";
  const cuerpo = p.text || p.message || p.message_hint || p.next_action ||
    "Tienes un recordatorio pendiente.";
  return { titulo, cuerpo };
}

let programando = false;

/**
 * Sincroniza las alarmas del teléfono con los recordatorios del usuario.
 * Es seguro llamarla seguido: cancela lo que ya no aplica y reprograma el resto
 * con el mismo id, así nunca duplica.
 *
 * @param {string} userId
 * @returns {Promise<number>} cuántos quedaron programados
 */
export async function sincronizarRecordatorios(userId) {
  const ln = nativePlugin("LocalNotifications");
  if (!isNativeApp() || !ln || !userId) return 0;
  if (programando) return 0;          // evita dos corridas pisándose
  programando = true;

  try {
    const desde = new Date();
    const hasta = new Date(Date.now() + HORAS_ADELANTE * 3600 * 1000);

    const { data, error } = await supabase
      .from("proactive_reminders")
      .select("id, scheduled_at, payload, tipo, status")
      .eq("asesor_id", userId)
      .eq("status", "pending")
      .gte("scheduled_at", desde.toISOString())
      .lte("scheduled_at", hasta.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(TOPE);

    if (error) {
      console.warn("[recordatorios] no pude leerlos:", error.message);
      return 0;
    }

    // Lo que YA está programado en el teléfono. Todo lo que esté acá y no en la
    // lista nueva se cancela: el usuario pudo haberlo marcado como hecho desde
    // la computadora, y una alarma de algo ya hecho es peor que ninguna.
    let pendientes = [];
    try {
      const r = await ln.getPending();
      pendientes = r?.notifications || [];
    } catch { /* la primera vez todavía no hay nada */ }

    const quierenSonar = new Map();
    for (const r of data || []) {
      const cuando = new Date(r.scheduled_at);
      // Un margen de 20 segundos: programar algo para "ahora mismo" hace que
      // algunos Android lo descarten sin avisar.
      if (cuando.getTime() < Date.now() + 20000) continue;
      const { titulo, cuerpo } = textoDe(r);
      quierenSonar.set(idNumerico(r.id), {
        id: idNumerico(r.id),
        title: titulo,
        body: cuerpo,
        schedule: { at: cuando, allowWhileIdle: true },
        channelId: CANAL_AVISOS,
        // Sin smallIcon a proposito: Android usa el icono de la app. Nombrar un
        // drawable que no existe (el "ic_stat_icon_config_sample" de los
        // ejemplos de Capacitor) deja el aviso con un cuadrito en blanco o no
        // lo muestra, y no avisa de nada al compilar.
        extra: { view: "copilot", recordatorio: r.id },
      });
    }

    const sobran = pendientes
      .filter((n) => !quierenSonar.has(n.id))
      .map((n) => ({ id: n.id }));
    if (sobran.length > 0) {
      try { await ln.cancel({ notifications: sobran }); } catch { /* best-effort */ }
    }

    const lista = [...quierenSonar.values()];
    if (lista.length > 0) {
      await ln.schedule({ notifications: lista });
    }
    return lista.length;
  } catch (e) {
    console.warn("[recordatorios] error programando:", e?.message || e);
    return 0;
  } finally {
    programando = false;
  }
}

/** Al cerrar sesión: borrar las alarmas del usuario anterior. */
export async function limpiarRecordatorios() {
  const ln = nativePlugin("LocalNotifications");
  if (!ln) return;
  try {
    const r = await ln.getPending();
    const n = r?.notifications || [];
    if (n.length > 0) await ln.cancel({ notifications: n.map((x) => ({ id: x.id })) });
  } catch { /* best-effort */ }
}
