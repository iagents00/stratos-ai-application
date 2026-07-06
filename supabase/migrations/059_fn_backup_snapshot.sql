-- 059 — Snapshot de las tablas de negocio como un solo jsonb, para el backup diario.
-- Se llama por PostgREST con service_role (flujo n8n "STRATOS - Backup Diario a Drive",
-- id 43fyfBIDcyLB0y2t). SECURITY DEFINER para leer todas las orgs (es un backup completo,
-- corre server-side, nunca desde el navegador).
CREATE OR REPLACE FUNCTION public.fn_backup_snapshot()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
  SELECT jsonb_build_object(
    'generated_at', now(),
    'project', 'stratos-prod',
    'tables', jsonb_build_object(
      'organizations',    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.organizations x),
      'profiles',         (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.profiles x),
      'leads',            (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.leads x),
      'lead_assignments', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.lead_assignments x),
      'expediente_items', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.expediente_items x),
      'comunicaciones',   (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.comunicaciones x),
      'discovery_data',   (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.discovery_data x),
      'appointments',     (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.appointments x),
      'voice_call_logs',  (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.voice_call_logs x),
      'deals',            (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.deals x),
      'projects',         (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.projects x),
      'project_units',    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.project_units x),
      'campaigns',        (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.campaigns x),
      'team_actions',     (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.team_actions x),
      'team_expenses',    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.team_expenses x),
      'lead_tasks',       (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.lead_tasks x),
      'tasks_catalog',    (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.tasks_catalog x),
      'incentives',       (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.incentives x),
      'content_plan_30d', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.content_plan_30d x),
      'bot_config',       (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM public.bot_config x)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.fn_backup_snapshot() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_backup_snapshot() TO service_role;
