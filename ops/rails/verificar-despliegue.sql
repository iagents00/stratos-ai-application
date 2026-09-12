-- Solo lectura. Tras aplicar 243, verificar firmas y acceso.
SELECT proname, pg_get_function_identity_arguments(oid) AS firma,
       prosecdef AS security_definer,
       has_function_privilege('authenticated',oid,'EXECUTE') AS app_puede_ejecutar,
       has_function_privilege('anon',oid,'EXECUTE') AS anon_puede_ejecutar
FROM pg_proc WHERE pronamespace='public'::regnamespace
AND proname IN ('rails_resolver_accion','rails_agenda_del_dia','rails_guardar_config');
SELECT relname,relrowsecurity FROM pg_class WHERE oid='public.rails_eventos'::regclass;
SELECT has_table_privilege('authenticated','public.rails_eventos','INSERT') AS app_inserta_eventos,
       has_table_privilege('authenticated','public.agenda_items','INSERT') AS app_inserta_agenda;
SELECT * FROM public.fn_qa_rpc_del_front() WHERE estado <> 'OK';
