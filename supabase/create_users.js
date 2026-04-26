/**
 * create_users.js — Script para crear los 30 usuarios del equipo en Supabase
 * ─────────────────────────────────────────────────────────────────────────────
 * USO:
 *   1. Pon tu SERVICE_ROLE_KEY abajo (Supabase → Settings → API)
 *   2. Edita el array TEAM con tu equipo
 *   3. Corre: node supabase/create_users.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL      = "https://ezlwrqlyebahulbienjs.supabase.co";
const SERVICE_ROLE_KEY  = "PEGA_AQUI_TU_SERVICE_ROLE_KEY";  // ← único dato que necesito de ti

// ── EQUIPO — edita esta lista con los datos reales ──────────────────────────
const TEAM = [
  // { name: "Juan Pérez",    email: "juan@ejemplo.com",   role: "asesor",    password: "Stratos2025!" },
  // { name: "María López",   email: "maria@ejemplo.com",  role: "director",  password: "Stratos2025!" },
  // { name: "Carlos Ruiz",   email: "carlos@ejemplo.com", role: "asesor",    password: "Stratos2025!" },
  // Agrega todos aquí...
];
// Roles disponibles: "asesor" | "director" | "ceo" | "admin" | "super_admin"
// ────────────────────────────────────────────────────────────────────────────

async function createUser({ name, email, role, password }) {
  // 1. Crear en Supabase Auth
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,           // sin necesidad de confirmar email
      user_metadata: { name, role },
    }),
  });

  const user = await res.json();
  if (!res.ok || user.error) {
    console.error(`❌ ${email}: ${user.error?.message || user.msg || JSON.stringify(user)}`);
    return false;
  }

  // 2. Actualizar perfil con rol correcto (el trigger lo crea pero puede necesitar ajuste)
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ name, role, active: true }),
    }
  );

  if (!profileRes.ok) {
    console.warn(`⚠️  ${email}: usuario creado pero perfil no actualizado`);
  }

  console.log(`✅ ${name} (${role}) — ${email}`);
  return true;
}

async function main() {
  if (SERVICE_ROLE_KEY === "PEGA_AQUI_TU_SERVICE_ROLE_KEY") {
    console.error("❌ Falta el SERVICE_ROLE_KEY — ábrelo en Supabase → Settings → API → service_role");
    process.exit(1);
  }
  if (TEAM.length === 0) {
    console.error("❌ El array TEAM está vacío — agrega a tu equipo");
    process.exit(1);
  }

  console.log(`\n🚀 Creando ${TEAM.length} usuarios...\n`);
  let ok = 0, fail = 0;

  for (const member of TEAM) {
    const success = await createUser(member);
    success ? ok++ : fail++;
    await new Promise(r => setTimeout(r, 300)); // evitar rate limit
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅ Creados: ${ok}   ❌ Fallidos: ${fail}`);
  console.log(`\nTodos pueden entrar en: https://app.stratoscapitalgroup.com`);
  console.log(`Con su email y la contraseña que pusiste en el script.`);
}

main();
