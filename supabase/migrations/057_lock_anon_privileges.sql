-- 057 — Blindaje del rol anon (su llave es PÚBLICA: va en el bundle JS).
-- El app usa authenticated tras login; n8n y las edge functions usan service_role;
-- anon solo hace un SELECT de warm-up. Por eso anon NO necesita escribir ni ejecutar
-- funciones. Todo reversible con GRANT ... TO anon.

-- 1) anon NO puede escribir ni vaciar NINGUNA tabla (mantiene SELECT para el warm-up).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- 2) anon NO puede ejecutar NINGUNA función SECURITY DEFINER (bot_* = impersonar asesor
--    y borrar leads con un chat_id ajeno; ingest_*/cross-tenant = inyectar datos en otra org;
--    todas saltan RLS por correr como dueño). Las funciones de extensión (pgvector/pg_trgm)
--    NO son SECURITY DEFINER → no se tocan.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;
