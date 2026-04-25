-- ═══════════════════════════════════════════════════════════
-- Crear usuario del equipo en Supabase
-- ═══════════════════════════════════════════════════════════
-- USO: Reemplaza los valores de abajo y ejecuta en SQL Editor
-- Necesitas: Dashboard → SQL Editor (con permisos de service_role)
-- ═══════════════════════════════════════════════════════════

-- Opción A: Invitar por email (Supabase envía el email automático)
-- Dashboard → Authentication → Users → Invite user
-- Es la forma más fácil y segura.

-- Opción B: Crear directo con SQL (requiere service_role)
-- Reemplaza los valores entre < > y ejecuta:

SELECT auth.uid(); -- verifica que estás autenticado

-- Para crear usuario y perfil manualmente:
-- 1. Ve a Authentication → Users → Add user
-- 2. Llena: Email, Password, confirma
-- 3. El trigger handle_new_user() crea el perfil automáticamente
-- 4. Si necesitas cambiar el rol, ejecuta:

UPDATE public.profiles
SET role = 'asesor'   -- opciones: asesor | director | ceo | admin | super_admin
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'email@ejemplo.com'
);

-- Verificar usuarios creados:
SELECT
  u.email,
  p.name,
  p.role,
  p.active,
  u.created_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;
