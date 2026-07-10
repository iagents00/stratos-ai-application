-- ─────────────────────────────────────────────────────────────────────────────
-- 089 — Hardening: quitar EXECUTE público de las funciones trigger de
--       zoom_agendados. (APLICADA a prod el 2026-07-10 vía apply_migration.)
--
-- Los advisors de Supabase marcaban 4 WARN: ambas funciones son
-- SECURITY DEFINER y quedaban expuestas por PostgREST en /rest/v1/rpc/*
-- para los roles anon y authenticated (por el grant implícito a PUBLIC).
--
-- Aunque Postgres rechaza invocar funciones trigger fuera de un trigger,
-- el REVOKE cierra la superficie de ataque y limpia los lints.
--
-- Los triggers siguen funcionando: el privilegio EXECUTE no se evalúa al
-- dispararse un trigger (verificado en prod con UPDATE + ROLLBACK).
-- ACL resultante: {postgres=X/postgres, service_role=X/postgres}.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.zoom_agendados_sync_from_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.zoom_agendados_cancel_on_lead_gone() FROM PUBLIC, anon, authenticated;
