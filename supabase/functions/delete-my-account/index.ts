// delete-my-account — que una persona pueda borrar su propia cuenta desde la app.
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// Apple lo exige (App Store Review Guideline 5.1.1(v)): una app que permite
// crear cuentas tiene que permitir borrarlas DESDE ADENTRO. Stratos tenía la
// página /eliminar-mis-datos, pero es informativa y para leads de formularios
// de Meta, no para usuarios del CRM. Sin esto, el rechazo en App Review es
// seguro.
//
// REGLA DE SEGURIDAD (la importante): a quién se borra NO se recibe del
// navegador. Se saca del JWT de quien llama. Así nadie puede mandar el id de
// otro y borrarle la cuenta, aunque manipule el request.
//
// QUÉ SE BORRA Y QUÉ NO
// Se borra: la cuenta de auth, el perfil, los tokens de push y las
// suscripciones web.
// NO se borran los leads ni las acciones del CRM: son registros de la EMPRESA,
// no de la persona. Borrarlos destruiría la operación del cliente, y Apple no
// pide eso — pide borrar la cuenta y los datos personales. Los leads conservan
// el nombre del asesor como texto, que es un dato de negocio.
//
// GUARDA CONTRA DEJAR LA ORG HUÉRFANA: si quien llama es el último admin de su
// organización, se rechaza. Si no, nadie podría volver a dar de alta a nadie.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ??
  "https://glulgyhkrqpykxmujodb.supabase.co";
const SERVICE_ROLE =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON =
  Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ROLES_DE_MANDO = new Set(["super_admin", "admin"]);

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);

  if (!SERVICE_ROLE) {
    return json({ error: "El servidor no está configurado para borrar cuentas." }, 500, origin);
  }

  // ── Identidad: SOLO del token, nunca del body ──────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Falta la sesión." }, 401, origin);

  const comoUsuario = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: quien, error: errQuien } = await comoUsuario.auth.getUser();
  if (errQuien || !quien?.user) return json({ error: "Sesión inválida o vencida." }, 401, origin);

  const uid = quien.user.id;
  const email = quien.user.email ?? "";

  // ── Confirmación explícita: hay que escribir el propio correo ──────────────
  // Evita el borrado por un toque accidental, y deja constancia de intención.
  let body: { confirmacion?: string } = {};
  try { body = await req.json(); } catch { /* body vacío */ }
  const escrito = (body.confirmacion ?? "").trim().toLowerCase();
  if (!escrito || escrito !== email.toLowerCase()) {
    return json(
      { error: "Para confirmar, escribe exactamente el correo de tu cuenta." },
      400, origin,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Guarda: no dejar la organización sin nadie que pueda administrarla ─────
  const { data: perfil } = await admin
    .from("profiles")
    .select("role, organization_id, name")
    .eq("id", uid)
    .maybeSingle();

  if (perfil?.organization_id && ROLES_DE_MANDO.has(perfil.role)) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", perfil.organization_id)
      .in("role", [...ROLES_DE_MANDO]);

    if ((count ?? 0) <= 1) {
      return json({
        error:
          "Eres la única persona con permisos de administración en tu organización. " +
          "Si borras tu cuenta, nadie podría volver a dar de alta a nadie. " +
          "Nombra a otro administrador primero.",
      }, 409, origin);
    }
  }

  // ── Borrado ────────────────────────────────────────────────────────────────
  // Los leads y las acciones NO se tocan: son de la empresa, no de la persona.
  const fallos: string[] = [];

  for (const tabla of ["device_tokens", "push_subscriptions"]) {
    const { error } = await admin.from(tabla).delete().eq("user_id", uid);
    // Que falte una tabla no debe impedir el borrado de la cuenta.
    if (error && !/does not exist/i.test(error.message)) fallos.push(`${tabla}: ${error.message}`);
  }

  const { error: errPerfil } = await admin.from("profiles").delete().eq("id", uid);
  if (errPerfil) fallos.push(`profiles: ${errPerfil.message}`);

  // Esto es lo que de verdad cierra la cuenta. Va al final: si falla, la
  // persona sigue pudiendo entrar y reintentar, en vez de quedar en un limbo
  // con el perfil borrado pero la sesión viva.
  const { error: errAuth } = await admin.auth.admin.deleteUser(uid);
  if (errAuth) {
    return json({
      error: "No se pudo cerrar la cuenta. Inténtalo de nuevo o escribe a soporte.",
      detalle: errAuth.message,
    }, 500, origin);
  }

  return json({
    ok: true,
    mensaje: "Tu cuenta fue eliminada.",
    // Se informan los fallos parciales en vez de callarlos: la cuenta ya no
    // existe, pero conviene saber si quedó algo suelto.
    avisos: fallos.length ? fallos : undefined,
  }, 200, origin);
});
