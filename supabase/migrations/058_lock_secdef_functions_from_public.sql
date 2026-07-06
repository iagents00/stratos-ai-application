-- 058 — Cerrar la puerta PÚBLICA en las funciones SECURITY DEFINER.
-- En Postgres el EXECUTE se concede a PUBLIC por defecto → anon (llave pública) las podía
-- ejecutar. Quitamos PUBLIC/anon en todas, damos service_role (n8n/edge) siempre, y
-- authenticated solo a las que el app llama con sesión de usuario. Las familias de backend
-- (bot_*, fn_sales_*, fn_stratos_*, fn_proactive_*, ingest_*, fn_recovery_*) quedan SOLO
-- para service_role (el grep del front confirma que el app no llama ninguna de esas).
-- Reversible: GRANT EXECUTE ... TO authenticated/PUBLIC según haga falta.
DO $$
DECLARE r record; v_backend boolean;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    v_backend := starts_with(r.proname,'bot_')  OR starts_with(r.proname,'_bot')
              OR starts_with(r.proname,'_bsc')  OR starts_with(r.proname,'fn_recovery_')
              OR starts_with(r.proname,'fn_sales_') OR starts_with(r.proname,'fn_stratos_')
              OR starts_with(r.proname,'fn_proactive_') OR starts_with(r.proname,'ingest_');

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', r.sig);

    IF v_backend THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
