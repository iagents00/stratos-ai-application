/**
 * lib/avisos-nativos.js — cómo SE VE y SE OYE un aviso dentro de la app
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PROBLEMA RESUELVE
 *
 * Que un aviso llegue al teléfono no alcanza. Android decide si suena, si vibra
 * y si aparece encima de lo que estás mirando según el CANAL por el que entra,
 * y ese canal lo tiene que crear la app — el servidor solo puede nombrarlo. Un
 * canal que no existe hace que Android use el de por defecto: silencioso y
 * enterrado en la persiana. Es la diferencia entre enterarse de una llamada y
 * verla al día siguiente.
 *
 * En iPhone el equivalente son las CATEGORÍAS: los botones «Contestar» y
 * «Rechazar» que se ven sin abrir la app existen solo si la app declaró antes
 * una categoría con ese nombre. El servidor la menciona (`category: "LLAMADA"`)
 * y iOS busca la que registró la app.
 *
 * Los dos registros son idempotentes y baratos: se hacen una vez al arrancar.
 *
 * ⚠️ Los nombres de acá tienen que coincidir EXACTO con los que usa el emisor
 * en supabase/functions/send-push/canales-nativos.ts. Si cambia uno, cambian
 * los dos, o el aviso vuelve a entrar mudo por el canal de por defecto.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { isNativeApp, nativePlugin } from "./native";

/** Los mismos identificadores que manda el servidor. NO tocar de un solo lado. */
export const CANAL_LLAMADAS = "llamadas";
export const CANAL_AVISOS = "avisos";
export const CATEGORIA_LLAMADA = "LLAMADA";

let yaPreparado = false;

function plataforma() {
  try { return window.Capacitor?.getPlatform?.() || null; } catch { return null; }
}

/**
 * Crea los canales de Android.
 *
 * `importance: 5` (MAX) es lo que convierte el aviso en un cartel que aparece
 * encima de la pantalla y suena, en vez de una línea callada en la persiana.
 * Android solo respeta esto la PRIMERA vez que se crea el canal: si después se
 * quiere cambiar el sonido o la importancia hay que crear un canal con OTRO id,
 * porque el usuario es el dueño de los ajustes de un canal ya existente.
 */
async function crearCanalesAndroid() {
  const ln = nativePlugin("LocalNotifications");
  if (!ln?.createChannel) return;

  try {
    await ln.createChannel({
      id: CANAL_LLAMADAS,
      name: "Llamadas",
      description: "Cuando alguien del equipo te llama",
      importance: 5,          // MAX: cartel emergente + sonido
      visibility: 1,          // se ve en la pantalla bloqueada
      sound: "ringtone",      // android/app/src/main/res/raw/ringtone.wav
      vibration: true,
      lights: true,
    });
    await ln.createChannel({
      id: CANAL_AVISOS,
      name: "Avisos de Stratos",
      description: "Recordatorios, mensajes y novedades de tus clientes",
      importance: 4,          // HIGH: suena, sin ser tan invasivo como una llamada
      visibility: 1,
      vibration: true,
    });
  } catch (e) {
    console.warn("[avisos] no pude crear los canales:", e?.message || e);
  }
}

/**
 * Registra la categoría «LLAMADA» con sus dos botones.
 *
 * `destructive` pinta «Rechazar» en rojo. `foreground: true` en Contestar hace
 * que tocar el botón abra la app — que es lo que hay que hacer para entrar a la
 * reunión. Rechazar NO la abre: se resuelve sin sacar al usuario de lo suyo.
 */
async function registrarCategoriasIOS() {
  const ln = nativePlugin("LocalNotifications");
  if (!ln?.registerActionTypes) return;

  try {
    await ln.registerActionTypes({
      types: [{
        id: CATEGORIA_LLAMADA,
        actions: [
          { id: "contestar", title: "Contestar", foreground: true },
          { id: "rechazar", title: "Rechazar", destructive: true },
        ],
      }],
    });
  } catch (e) {
    console.warn("[avisos] no pude registrar la categoría de llamada:", e?.message || e);
  }
}

/**
 * Deja el teléfono listo para recibir avisos como corresponde.
 * Llamar una vez al arrancar la app, antes de registrar el push.
 */
export async function prepararAvisos() {
  if (!isNativeApp() || yaPreparado) return;
  yaPreparado = true;
  if (plataforma() === "android") await crearCanalesAndroid();
  else await registrarCategoriasIOS();
}
