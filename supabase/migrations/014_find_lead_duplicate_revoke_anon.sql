-- ═══════════════════════════════════════════════════════════════════════════
-- 014_find_lead_duplicate_revoke_anon.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Hot-fix de seguridad post-013:
--
-- Supabase concede EXECUTE en TODAS las funciones del schema public al rol
-- `anon` por default (vía la role hierarchy: anon → public). El REVOKE FROM
-- PUBLIC en 013 no afecta a anon porque es un grant explícito, no derivado.
--
-- La función find_lead_duplicate ya rechaza si auth.uid() es NULL (cuando
-- no hay sesión), pero por defensa en profundidad — y para que el security
-- advisor de Supabase quede limpio — revocamos explícitamente del anon.
-- Solo `authenticated` puede llamarla.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.find_lead_duplicate(text, text) FROM anon;

COMMENT ON FUNCTION public.find_lead_duplicate(text, text) IS
  'Devuelve el lead existente (mismo org) que matchea email o phone — incluso si '
  'pertenece a otro asesor (bypassa RLS via SECURITY DEFINER). El frontend lo '
  'llama mientras el asesor escribe en el modal Registrar, para avisar antes de '
  'crear un duplicado. Datos devueltos son mínimos: id, name, stage, asesor, '
  'is_mine, match_type. NUNCA cruza organizaciones. EXECUTE: authenticated only.';
