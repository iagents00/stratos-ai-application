-- Solo lectura. Ejecutar en el proyecto glulgyhkrqpykxmujodb antes de 243.
SELECT to_regclass('public.leads') AS leads,
       to_regclass('public.profiles') AS profiles,
       to_regclass('public.organizations') AS organizations,
       to_regclass('public.agenda_items') AS agenda,
       to_regclass('public.front_rpc_registry') AS registry;
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND (
  (table_name = 'leads' AND column_name IN ('id','organization_id','asesor_name','stage','updated_at','deleted_at','opt_out','next_action','next_action_at','next_action_date','sprint_toques','sprint_ultimo_canal','sprint_inicio','action_history','is_new')) OR
  (table_name = 'profiles' AND column_name IN ('id','organization_id','name','role','active')) OR
  (table_name = 'organizations' AND column_name IN ('id','meta_config')) OR table_name = 'agenda_items')
ORDER BY table_name, ordinal_position;
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'agenda_items';
SELECT c.relname AS tabla, t.tgname AS trigger, p.proname AS funcion
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
WHERE c.oid IN ('public.leads'::regclass,'public.agenda_items'::regclass,'public.organizations'::regclass) AND NOT t.tgisinternal;
SELECT count(*) FILTER (WHERE meta_config->'rails'->>'activo' = 'true') AS organizaciones_con_rails_activo,
       count(*) AS organizaciones FROM public.organizations;
SELECT * FROM public.fn_qa_rpc_del_front() WHERE estado <> 'OK';
