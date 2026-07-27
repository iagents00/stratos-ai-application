// admin-create-user — dar de alta a alguien del equipo desde el propio CRM.
// ─────────────────────────────────────────────────────────────────────────────
// Pedido de Ángel (27-jul): «yo puedo agregar ahí en el grupo otro desarrollador,
// que va a tener otro perfil». Hasta hoy `adminCreateUser()` era un stub que
// devolvía "creá el usuario desde el Dashboard de Supabase": el formulario del
// CRM siempre fallaba.
//
// REGLA DE SEGURIDAD (la importante): la organización del usuario nuevo NO se
// recibe del navegador — se lee del PERFIL DE QUIEN LLAMA. Así un admin de NSG
// solo puede crear gente en NSG, aunque manipule el request. Y solo pueden
// llamar los roles de mando de esa org.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON =
  Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ROLES_QUE_PUEDEN_CREAR = new Set(["super_admin", "admin"]);
const ROLES_VALIDOS = new Set(["super_admin", "admin", "director", "ceo", "asesor", "marketing"]);

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) },
  });

// Contraseña temporal legible: la tiene que poder dictar por teléfono.
function claveTemporal(): string {
  const letras = "abcdefghijkmnopqrstuvwxyz";     // sin la ele, se confunde con el uno
  const nums = "23456789";                        // sin cero ni uno
  const b = crypto.getRandomValues(new Uint8Array(10));
  let s = "";
  for (let i = 0; i < 6; i++) s += letras[b[i] % letras.length];
  s += "-";
  for (let i = 6; i < 10; i++) s += nums[b[i] % nums.length];
  return s;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (!SERVICE_ROLE) return json({ ok: false, error: "server_misconfigured" }, 500, origin);

  // 1) ¿Quién llama? Se resuelve con SU token, no con lo que diga el body.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ ok: false, error: "Falta la sesión. Volvé a entrar." }, 401, origin);

  const comoUsuario = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: quien, error: eQuien } = await comoUsuario.auth.getUser();
  if (eQuien || !quien?.user?.id) {
    return json({ ok: false, error: "Tu sesión venció. Volvé a entrar." }, 401, origin);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: perfil } = await admin
    .from("profiles")
    .select("id, role, organization_id, name")
    .eq("id", quien.user.id)
    .maybeSingle();

  if (!perfil?.organization_id) {
    return json({ ok: false, error: "No encontré tu perfil." }, 403, origin);
  }
  if (!ROLES_QUE_PUEDEN_CREAR.has(String(perfil.role))) {
    return json({ ok: false, error: "Solo un administrador puede dar de alta gente." }, 403, origin);
  }

  // 2) Lo que sí viene del navegador: nombre, email y rol. Nada más.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400, origin); }

  const nombre = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const rol = String(body.role ?? "asesor").trim();
  const phone = String(body.phone ?? "").trim() || null;

  if (!nombre) return json({ ok: false, error: "Ponele el nombre." }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Ese correo no parece válido." }, 400, origin);
  if (!ROLES_VALIDOS.has(rol)) return json({ ok: false, error: "Ese rol no existe." }, 400, origin);

  // 3) Crear la cuenta con una clave temporal.
  const clave = claveTemporal();
  const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true,
    user_metadata: { name: nombre },
  });

  if (eCrear) {
    const msg = String(eCrear.message || "");
    if (/already|registered|exists/i.test(msg)) {
      return json({ ok: false, error: "Ya hay una cuenta con ese correo." }, 409, origin);
    }
    return json({ ok: false, error: `No pude crear la cuenta: ${msg}` }, 500, origin);
  }

  const nuevoId = creado?.user?.id;
  if (!nuevoId) return json({ ok: false, error: "La cuenta no devolvió id." }, 500, origin);

  // 4) El perfil hereda la organización de QUIEN CREA. Nunca del request.
  const { error: ePerfil } = await admin.from("profiles").upsert({
    id: nuevoId,
    name: nombre,
    role: rol,
    phone,
    active: true,
    organization_id: perfil.organization_id,
  });

  if (ePerfil) {
    // Si el perfil falla, la cuenta suelta no sirve para nada: se limpia.
    try { await admin.auth.admin.deleteUser(nuevoId); } catch { /* best-effort */ }
    return json({ ok: false, error: `No pude crear el perfil: ${ePerfil.message}` }, 500, origin);
  }

  return json({
    ok: true,
    id: nuevoId,
    email,
    name: nombre,
    role: rol,
    temp_password: clave,
    mensaje: `Listo. Pasale el correo ${email} y la clave temporal ${clave}; que la cambie al entrar.`,
  }, 200, origin);
});
