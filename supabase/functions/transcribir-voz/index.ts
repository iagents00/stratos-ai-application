// transcribir-voz — convertir un audio en texto cuando el teléfono no puede
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
//
// El dictado del Copilot usa el motor de voz del propio aparato: es gratis,
// instantáneo y el audio no sale de ahí. Es lo mejor cuando existe. Pero no
// siempre existe:
//
//   · Android sin los servicios de voz de Google (emuladores, teléfonos sin
//     Google Play, algunas marcas). El teléfono contesta literalmente
//     "Speech recognition service is not available" — reportado el 26-ago-2026.
//   · Brave y otros navegadores que definen la API pero cortan el servicio.
//
// En esos casos el usuario tocaba el micrófono, hablaba, y no pasaba nada. Esta
// función es la red: se le manda el audio ya grabado y devuelve el texto.
//
// EL ORDEN IMPORTA. Primero se intenta el motor del teléfono; esto es el plan B.
// No al revés: mandar audio a un servidor cuesta dinero, tarda, necesita
// internet, y hace que la voz del usuario salga del aparato. Que sea el plan B
// y no el plan A es una decisión, no un descuido.
//
// ─────────────────────────────────────────────────────────────────────────────
// COSTO — leer antes de subir el límite
//
// Se usa gpt-4o-mini-transcribe, el más barato de OpenAI para esto. Un dictado
// típico del Copilot dura entre 5 y 20 segundos. El tope de 60 segundos de abajo
// no es un capricho: sin él, un teléfono en un bolsillo puede mandar minutos de
// ruido y pagarlos.
// ─────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

// DOS proveedores, y no por gusto: el 26-ago-2026 la cuenta de OpenAI contestó
// "credit_balance_exhausted" en la primera prueba real. Un dictado que deja de
// funcionar porque se acabó el saldo de UNA cuenta es un solo punto de falla
// para algo que los asesores usan todos los días.
//
// Se intenta primero el que tenga saldo; si el primero se queda sin, el segundo
// sigue respondiendo. El orden lo decide QUÉ_PRIMERO.
const QUE_PRIMERO = (Deno.env.get("TRANSCRIPTOR") ?? "eleven").toLowerCase();

/** Tope de tamaño: ~1 minuto de audio comprimido. Más que eso no es un dictado. */
const MAX_BYTES = 2 * 1024 * 1024;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  // Va con verify_jwt: solo alguien con sesión abierta en el CRM puede usarla.
  // Sin eso, cualquiera en internet podría gastar la cuenta transcribiendo.
  if (!OPENAI_KEY && !ELEVEN_KEY) {
    // Se dice, no se calla: un "no se pudo transcribir" a secas manda a buscar
    // el problema al teléfono, que es donde NO está.
    return json({ ok: false, error: "falta_credencial", detalle: "no hay ninguna credencial de transcripción cargada en esta función" }, 503, origin);
  }

  let audio: Blob;
  let nombre = "dictado.webm";
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (!(f instanceof File)) return json({ ok: false, error: "sin_audio" }, 400, origin);
    if (f.size === 0) return json({ ok: false, error: "audio_vacio" }, 400, origin);
    if (f.size > MAX_BYTES) {
      return json({ ok: false, error: "audio_muy_largo", detalle: "el dictado no puede pasar de un minuto" }, 413, origin);
    }
    audio = f;
    if (f.name) nombre = f.name;
  } catch {
    return json({ ok: false, error: "peticion_invalida" }, 400, origin);
  }

  const intentos: string[] = [];

  /** Devuelve el texto, o lanza con un motivo legible. */
  async function conOpenAI(): Promise<string> {
    const envio = new FormData();
    envio.append("file", audio, nombre);
    envio.append("model", "gpt-4o-mini-transcribe");
    // El idioma se fija: sin esto, un "sí" suelto se puede transcribir como
    // inglés y el asistente recibe una palabra que no existe en su vocabulario.
    envio.append("language", "es");
    envio.append("response_format", "json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_KEY}` },
      body: envio,
    });
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 220);
      const sinSaldo = detalle.includes("insufficient_quota") || detalle.includes("credit_balance_exhausted");
      throw new Error((sinSaldo ? "sin_saldo" : "fallo") + ": openai " + r.status + " " + detalle);
    }
    const d = await r.json();
    return String(d?.text ?? "").trim();
  }

  async function conEleven(): Promise<string> {
    const envio = new FormData();
    envio.append("file", audio, nombre);
    envio.append("model_id", "scribe_v1");
    envio.append("language_code", "spa");
    // Sin esto la respuesta trae la marca de tiempo de cada palabra: no se usa
    // para nada y hace el viaje más pesado.
    envio.append("timestamps_granularity", "none");
    envio.append("diarize", "false");

    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY },
      body: envio,
    });
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 220);
      const sinSaldo = r.status === 401 || detalle.includes("quota") || detalle.includes("credits");
      throw new Error((sinSaldo ? "sin_saldo" : "fallo") + ": eleven " + r.status + " " + detalle);
    }
    const d = await r.json();
    return String(d?.text ?? "").trim();
  }

  const orden = QUE_PRIMERO === "openai"
    ? [["openai", OPENAI_KEY, conOpenAI], ["eleven", ELEVEN_KEY, conEleven]] as const
    : [["eleven", ELEVEN_KEY, conEleven], ["openai", OPENAI_KEY, conOpenAI]] as const;

  for (const [nombreProv, llave, fn] of orden) {
    if (!llave) { intentos.push(`${nombreProv}: sin credencial`); continue; }
    try {
      const texto = await fn();
      if (!texto) return json({ ok: true, texto: "", vacio: true, via: nombreProv }, 200, origin);
      return json({ ok: true, texto, via: nombreProv }, 200, origin);
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[transcribir-voz]", msg);
      intentos.push(msg);
      // Se sigue al siguiente proveedor: que uno se quede sin saldo no puede
      // dejar mudo el dictado de todo el equipo.
    }
  }

  // Ninguno pudo. Se dice CUÁL falló y por qué: un "no se pudo" a secas manda a
  // revisar el micrófono, que es justo donde no está el problema.
  const todosSinSaldo = intentos.length > 0 && intentos.every((x) => x.startsWith("sin_saldo") || x.endsWith("sin credencial"));
  return json(
    { ok: false, error: todosSinSaldo ? "sin_saldo" : "proveedor_fallo", intentos },
    todosSinSaldo ? 402 : 502,
    origin,
  );
});
