/**
 * api/push/refresh.js — Refresca la suscripción push cuando el navegador ROTA el token.
 * ─────────────────────────────────────────────────────────────────────────────
 * El Service Worker (evento `pushsubscriptionchange`, en public/sw.js) detecta
 * cuando iOS/Android invalida y regenera la suscripción de push, y POSTea acá
 * `{ oldEndpoint, newSubscription }`. ANTES esta ruta NO existía → daba 404 → el
 * token nuevo se PERDÍA y el viejo quedaba muerto → a ese usuario le dejaban de
 * llegar notificaciones con la app cerrada hasta que la abriera (motivo de
 * "llegan unas sí y otras no"). Ahora guardamos el token nuevo para el MISMO
 * dueño (lo resuelve la RPC `push_refresh` por el endpoint viejo).
 *
 * Seguridad: usa la ANON key (pública, la misma que ya viaja en el bundle) y la
 * RPC `push_refresh` es SECURITY DEFINER pero solo puede MOVER una suscripción
 * existente (hay que conocer el endpoint viejo, una URL larga secreta). No lee
 * ni expone datos de nadie.
 */
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://glulgyhkrqpykxmujodb.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdWxneWhrcnFweWt4bXVqb2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjc0ODQsImV4cCI6MjA5Mjg0MzQ4NH0.GUPRPxZM8G50TVpvTDegzADO8n117clpTgSQpaMJAEk";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("method_not_allowed");
  }

  // Body: Vercel a veces lo parsea (objeto) y a veces no (string/stream).
  let payload = req.body;
  if (!payload || typeof payload === "string") {
    try {
      const raw =
        typeof payload === "string"
          ? payload
          : await new Promise((resolve, reject) => {
              let d = "";
              req.on("data", (c) => (d += c));
              req.on("end", () => resolve(d));
              req.on("error", reject);
            });
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
  }

  const oldEndpoint = (payload && payload.oldEndpoint) || "";
  const ns = (payload && payload.newSubscription) || {};
  const endpoint = ns.endpoint;
  const keys = ns.keys || {};
  const p256dh = keys.p256dh;
  const auth = keys.auth;

  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");

  if (!endpoint || !p256dh || !auth) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "missing_subscription" }));
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        p_old_endpoint: oldEndpoint,
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_platform: "web",
      }),
    });
    // push_refresh devuelve true/false; ok=true si el POST llegó bien.
    let moved = false;
    try {
      moved = await r.json();
    } catch {
      /* body vacío */
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: r.ok, moved: moved === true }));
  } catch (e) {
    // best-effort: nunca romper el SW; al abrir la app se re-suscribe igual.
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false }));
  }
}
