-- 086 — Hardening: fija search_path en zoom_agendados_touch_updated_at
-- (lint 0011 function_search_path_mutable del linter de Supabase; la función
-- de sync ya lo traía fijo, esta se quedó fuera en la 083).
-- APLICADA A PROD el 2026-07-10.
ALTER FUNCTION public.zoom_agendados_touch_updated_at() SET search_path = public, pg_temp;
