/**
 * lib/transcribir.js — el plan B del dictado: que lo transcriba el servidor
 * ─────────────────────────────────────────────────────────────────────────────
 * CUÁNDO SE USA
 *
 * Solo cuando el aparato NO puede convertir voz en texto por su cuenta:
 *
 *   · Android sin los servicios de voz de Google. El teléfono contesta
 *     literalmente «Speech recognition service is not available» — pasa en
 *     emuladores, en teléfonos sin Google Play y en algunas marcas.
 *   · Brave y otros navegadores que definen la API pero le cortan el servicio.
 *
 * Hasta el 26-ago-2026, en esos casos la persona tocaba el micrófono, hablaba,
 * y no pasaba nada: el audio se grababa y se tiraba.
 *
 * NO REEMPLAZA AL DICTADO DEL TELÉFONO, y el orden importa. El del teléfono es
 * gratis, instantáneo y no saca la voz del aparato. Este cuesta, tarda unos
 * segundos y necesita internet. Por eso es el plan B: se intenta primero el
 * otro, siempre.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://glulgyhkrqpykxmujodb.supabase.co";

/**
 * Manda un audio grabado y devuelve lo que se dijo.
 *
 * @param {Blob} blob el audio (lo que produce MediaRecorder)
 * @returns {Promise<{texto?: string, error?: string}>}
 *          `texto` con lo transcrito, o `error` con un motivo legible.
 *          Nunca lanza: quien llama solo tiene que mirar qué vino.
 */
export async function transcribirEnServidor(blob) {
  if (!blob || blob.size === 0) return { error: "No se grabó nada." };

  try {
    // La función pide sesión: solo alguien con el CRM abierto puede usarla, o
    // cualquiera en internet podría gastar la cuenta transcribiendo.
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    if (!token) return { error: "Tu sesión se cerró. Vuelve a entrar." };

    const form = new FormData();
    // La extensión tiene que coincidir con lo que grabó el aparato: el
    // proveedor la usa para saber cómo abrir el archivo, y con la equivocada
    // rechaza un audio que estaba perfecto.
    const tipo = blob.type || "";
    const ext = tipo.includes("mp4") ? "mp4" : tipo.includes("ogg") ? "ogg" : "webm";
    form.append("audio", blob, `dictado.${ext}`);

    const r = await fetch(`${SUPABASE_URL}/functions/v1/transcribir-voz`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });

    const d = await r.json().catch(() => ({}));

    if (r.ok && d?.ok) {
      if (!d.texto) return { error: "No se entendió nada. Habla un poco más cerca." };
      return { texto: d.texto };
    }

    // Cada motivo manda a un lugar distinto a buscar el problema. Un
    // "no se pudo" a secas hace que la persona revise el micrófono, que es
    // justamente donde NO está la causa.
    if (d?.error === "sin_saldo") return { error: "La cuenta de transcripción se quedó sin saldo. Avísale a Ángel." };
    if (d?.error === "falta_credencial") return { error: "Falta configurar la transcripción. Avísale a Ángel." };
    if (d?.error === "audio_muy_largo") return { error: "El dictado es muy largo. Prueba con algo más corto." };
    return { error: "No se pudo convertir tu voz en texto. Escribe el mensaje." };
  } catch {
    return { error: "No hay internet para convertir tu voz en texto. Escribe el mensaje." };
  }
}
