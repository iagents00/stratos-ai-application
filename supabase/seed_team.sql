-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Seed del equipo
--
-- USO:
-- 1. Primero crea cada usuario en Supabase Dashboard:
--    Authentication → Users → Add user → "Create new user"
--    (marca "Auto Confirm User" para evitar verificación por email)
--
-- 2. Después, edita los emails de abajo y ejecuta este script
--    en SQL Editor para asignar nombres y roles correctos.
-- ═══════════════════════════════════════════════════════════

-- ── 1. SUPER ADMIN — control total del sistema ──
UPDATE public.profiles SET
  name = 'Super Admin Stratos',
  role = 'super_admin',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@stratoscapitalgroup.com');

-- ── 2. CEO — Ivan Rodriguez Ruelas ──
UPDATE public.profiles SET
  name = 'Ivan Rodriguez Ruelas',
  role = 'ceo',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'ivan@stratoscapitalgroup.com');

-- ── 3. DIRECTORES (uno por cada equipo) ──
-- Edita los emails y nombres reales:
UPDATE public.profiles SET
  name = 'Nombre Director 1',
  role = 'director',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'director1@stratoscapitalgroup.com');

UPDATE public.profiles SET
  name = 'Nombre Director 2',
  role = 'director',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'director2@stratoscapitalgroup.com');

-- ── 4. ASESORES ──
-- Asignación: el asesor solo verá leads donde `leads.asesor_name = profiles.name`
-- (debe coincidir EXACTO — sin espacios extra, mismas tildes).
UPDATE public.profiles SET
  name = 'Asesor 1',
  role = 'asesor',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'asesor1@stratoscapitalgroup.com');

UPDATE public.profiles SET
  name = 'Asesor 2',
  role = 'asesor',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'asesor2@stratoscapitalgroup.com');

UPDATE public.profiles SET
  name = 'Asesor 3',
  role = 'asesor',
  active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'asesor3@stratoscapitalgroup.com');

-- ── DUPLICA y EDITA estas líneas para cada asesor adicional ──
-- UPDATE public.profiles SET name = '...', role = 'asesor'
-- WHERE id = (SELECT id FROM auth.users WHERE email = '...');

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN — Lista todo el equipo y sus roles
-- ═══════════════════════════════════════════════════════════
SELECT
  u.email,
  p.name,
  p.role,
  p.active,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY
  CASE p.role
    WHEN 'super_admin' THEN 1
    WHEN 'admin'       THEN 2
    WHEN 'ceo'         THEN 3
    WHEN 'director'    THEN 4
    WHEN 'asesor'      THEN 5
    ELSE 6
  END,
  p.name;

-- ═══════════════════════════════════════════════════════════
-- BONUS — Si ya tenías leads creados con nombres de asesor que
-- no coinciden con los profiles, este query te ayuda a detectarlos
-- (los asesores no van a verlos hasta que se corrija):
-- ═══════════════════════════════════════════════════════════
SELECT
  l.asesor_name AS leads_asesor,
  COUNT(*) AS total_leads,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.name = l.asesor_name)
    THEN '✅ matchea con profile'
    ELSE '❌ NO matchea — el asesor no verá estos leads'
  END AS estado
FROM public.leads l
WHERE l.deleted_at IS NULL AND l.asesor_name IS NOT NULL
GROUP BY l.asesor_name
ORDER BY total_leads DESC;
