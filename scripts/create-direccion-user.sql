-- ═══════════════════════════════════════════════════════════════════════════
-- Crear usuario de DIRECCIÓN en Supabase
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en Supabase Dashboard → SQL Editor cuando esté disponible.
-- Crea el auth.user + el profile correspondiente.
--
-- Email:    direccion@stratoscapitalgroup.com
-- Password: Direccion2026!
-- Role:     admin (UX limpia, acceso total al CRM)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Crear auth.user (necesita usar la función admin de Supabase)
--    NOTA: el password hash usa crypt() con bcrypt. Si Supabase no permite
--    INSERT directo a auth.users, créalo desde el Dashboard:
--      Authentication → Users → "Invite user" o "Add user"
--      Email: direccion@stratoscapitalgroup.com
--      Password: Direccion2026!
--      Auto Confirm: ✓ enabled

-- 2. Una vez creado el auth.user, crear el profile correspondiente.
--    Reemplaza '<USER_ID>' con el UUID que te asignó Supabase al crear
--    el auth.user (lo ves en la columna "User UID" del dashboard).

INSERT INTO profiles (id, name, role, active, organization_id, created_at, updated_at)
VALUES (
  '<USER_ID>',                                -- ← REEMPLAZA con el UUID real
  'Dirección Stratos',
  'admin',
  true,
  '00000000-0000-0000-0000-000000000001',     -- organization_id default
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 3. Verificar que se creó correctamente
SELECT
  p.id,
  u.email,
  p.name,
  p.role,
  p.active
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.email = 'direccion@stratoscapitalgroup.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- ALTERNATIVA: crear todo desde el Dashboard (más fácil)
-- ═══════════════════════════════════════════════════════════════════════════
--   1. Authentication → Users → "Add user"
--      • Email: direccion@stratoscapitalgroup.com
--      • Password: Direccion2026!
--      • Auto Confirm User: ✓
--      → Click "Create user"
--
--   2. Copia el User UID que se generó.
--
--   3. SQL Editor:
--      INSERT INTO profiles (id, name, role, active, organization_id)
--      VALUES (
--        '<UID_PEGAR_AQUI>',
--        'Dirección Stratos',
--        'admin',
--        true,
--        '00000000-0000-0000-0000-000000000001'
--      );
--
--   4. Logout y login con el nuevo usuario para verificar.
-- ═══════════════════════════════════════════════════════════════════════════
