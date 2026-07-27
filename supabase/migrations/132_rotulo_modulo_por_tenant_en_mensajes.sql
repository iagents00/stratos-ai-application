-- El motor nació en marketing y decía "La ves en el módulo Marketing" a TODOS los tenants.
-- En NSG ese módulo se llama "Proyectos". Se vuelve configurable por organización.
CREATE OR REPLACE FUNCTION public.fn_mkt_create_task(p_profile_id uuid, p_titulo text, p_assignee text DEFAULT NULL::text, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_brand text DEFAULT NULL::text, p_project text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_org uuid; v_asg record; v_brand record;
  v_proj_id uuid; v_proj_nombre text; v_proj_brand uuid;
  v_modulo text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return 'Decime qué hay que hacer (el título de la tarea).'; end if;

  select * into v_asg from _mkt_find_profile(v_org, p_assignee);
  if p_assignee is not null and v_asg.id is null then
    return 'No encontré a «'||p_assignee||'» en el equipo. ¿Yazz, Luis o Emmanuel?';
  end if;
  select * into v_brand from _mkt_find_brand(v_org, p_brand);
  if p_project is not null then
    select id, nombre, brand_id into v_proj_id, v_proj_nombre, v_proj_brand from mkt_projects
    where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_project||'%'
    order by created_at desc limit 1;
  end if;

  insert into mkt_tasks (organization_id, brand_id, project_id, titulo, assignee_id, created_by,
                         estado, prioridad, avance_pct, due_at, origen)
  values (v_org, coalesce(v_proj_brand, v_brand.id), v_proj_id, trim(p_titulo),
          coalesce(v_asg.id, p_profile_id), p_profile_id, 'por_hacer', 'media', 0, p_due, 'copilot');

  -- rótulo del módulo según el tenant (NSG = "Proyectos"; default histórico "Marketing")
  select coalesce(o.meta_config->'mkt'->>'moduleLabel', 'Marketing') into v_modulo
  from organizations o where o.id = v_org;

  return '✓ Tarea creada: «'||trim(p_titulo)||'»'
    || ' · para '||coalesce(v_asg.name,'ti')
    || coalesce(' · marca '||v_brand.nombre, '')
    || coalesce(' · proyecto '||v_proj_nombre, '')
    || coalesce(' · vence '||to_char(p_due at time zone 'America/Cancun','DD Mon HH24:MI'), '')
    || '. La ves en el módulo '||v_modulo||'.';
end $function$;

update organizations
set meta_config = jsonb_set(coalesce(meta_config,'{}'::jsonb), '{mkt}',
      coalesce(meta_config->'mkt','{}'::jsonb) || '{"moduleLabel":"Proyectos"}'::jsonb, true)
where id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc';;
