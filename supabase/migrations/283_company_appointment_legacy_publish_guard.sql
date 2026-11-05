CREATE OR REPLACE FUNCTION public.fn_company_pipeline_publish(p_actor_id uuid, p_organization_id uuid, p_expected_updated_at timestamp with time zone, p_pipeline jsonb, p_copilot jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org public.organizations%rowtype;
  v_profile public.profiles%rowtype;
  v_pipeline jsonb;
  v_current jsonb;
  v_preserved jsonb := '{}'::jsonb;
  v_usage jsonb;
  v_stage record;
  v_color text;
  v_base integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
  select * into v_profile from public.profiles where id=p_actor_id for share;
  if not exists(select 1 from public.platform_admins a join public.organizations o on o.id=p_organization_id
    where a.user_id=p_actor_id and a.active is true and (a.scope_organization_id is null or a.scope_organization_id=o.parent_organization_id)
      and not exists(select 1 from public.profiles p where p.id=p_actor_id and p.active is false)) and (not found or v_profile.organization_id is distinct from p_organization_id
     or v_profile.active is not true or coalesce(v_profile.role,'') not in ('admin','super_admin')
     or v_profile.crm_only is true
     or (v_profile.is_marketing_admin is true and p_organization_id='00000000-0000-0000-0000-000000000001')) then
    raise exception 'Solo el administrador activo de tu propia empresa puede configurar sus etapas.' using errcode='42501';
  end if;
  select * into v_org from public.organizations where id=p_organization_id for update;
  if not found or v_org.active is not true or v_org.meta_config#>>'{features,crm}'='false' then
    raise exception 'La empresa no está activa o no tiene CRM.' using errcode='42501';
  end if;
  if p_expected_updated_at is null or v_org.updated_at is distinct from p_expected_updated_at then
    raise exception 'La configuración cambió en otra sesión. Recarga el pipeline antes de guardar.' using errcode='40001';
  end if;
  if jsonb_typeof(v_org.meta_config#>'{crm,pipelines}')='array'
     and jsonb_array_length(v_org.meta_config#>'{crm,pipelines}')>0 then
    raise exception 'Esta empresa tiene varios tableros. Solicita su configuración a soporte.' using errcode='40001';
  end if;
  if jsonb_typeof(p_pipeline) is distinct from 'array' then
    raise exception 'El pipeline debe ser una lista de etapas.' using errcode='22023';
  end if;
  if jsonb_array_length(p_pipeline) not between 2 and 30 then
    raise exception 'El pipeline debe tener entre 2 y 30 etapas.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_pipeline) s
    where jsonb_typeof(s->'name') is distinct from 'string' or jsonb_typeof(s->'color') is distinct from 'string'
      or length(regexp_replace(btrim(s->>'name'),'\s+',' ','g')) not between 2 and 48
      or s->>'color' !~ '^#[0-9A-Fa-f]{6}$') then
    raise exception 'Revisa los nombres y colores de las etapas.' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('name',regexp_replace(btrim(s->>'name'),'\s+',' ','g'),
    'color',upper(s->>'color')) order by ord) into v_pipeline
    from jsonb_array_elements(p_pipeline) with ordinality x(s,ord);
  if exists(select 1 from jsonb_array_elements(v_pipeline) s group by lower(s->>'name') having count(*)>1) then
    raise exception 'Los nombres de las etapas no se pueden repetir.' using errcode='22023';
  end if;
  v_current:=public.fn_platform_crm_pipeline(p_organization_id);
  select coalesce(jsonb_object_agg(stage,total),'{}'::jsonb) into v_usage from (
    select stage,count(*) total from public.leads where organization_id=p_organization_id
      and deleted_at is null and nullif(stage,'') is not null group by stage
  ) counts;
  for v_stage in select key as name,value as total from jsonb_each(v_usage) loop
    if exists(select 1 from jsonb_array_elements(v_pipeline) s where s->>'name'=v_stage.name) then continue; end if;
    v_preserved:=v_preserved||jsonb_build_object(v_stage.name,v_stage.total);
    if exists(select 1 from jsonb_array_elements(v_pipeline) s where lower(s->>'name')=lower(v_stage.name)) then
      select jsonb_agg(case when lower(s->>'name')=lower(v_stage.name)
        then jsonb_set(s,'{name}',to_jsonb(v_stage.name)) else s end order by ord) into v_pipeline
        from jsonb_array_elements(v_pipeline) with ordinality x(s,ord);
    else
      select s->>'color' into v_color from jsonb_array_elements(v_current) s where s->>'name'=v_stage.name limit 1;
      v_pipeline:=v_pipeline||jsonb_build_array(jsonb_build_object('name',v_stage.name,'color',coalesce(v_color,'#64748B')));
    end if;
  end loop;
  if jsonb_array_length(v_pipeline)>30 then
    raise exception 'Hay más de 30 etapas al conservar las que tienen clientes. Muévelos antes de publicar.' using errcode='40001';
  end if;
  -- Older installed apps do not send the appointment selection. Their stage
  -- edit must never silently orphan the role chosen by the administrator.
  if p_copilot is null and nullif(v_org.meta_config#>>'{crm,appointmentStage}','') is not null
    and not exists(select 1 from jsonb_array_elements(v_pipeline) s
      where s->>'name'=v_org.meta_config#>>'{crm,appointmentStage}') then
    raise exception 'Para cambiar la etapa de citas, selecciona su nueva etapa en la versión actual de Pipeline de mi empresa.' using errcode='40001';
  end if;
  -- Both legacy uniqueness constraints include inactive rows. Park ALL former
  -- positions below the existing minimum before reordering/reactivating names.
  -- Keep removed names as inactive history; no rows or clients are deleted.
  select least(coalesce(min(orden),0),0)-1 into v_base from public.org_stages where organization_id=p_organization_id;
  with parked as (select id,row_number() over(order by orden,id)::integer pos
    from public.org_stages where organization_id=p_organization_id)
  update public.org_stages s set orden=v_base-p.pos,activo=false from parked p
    where s.id=p.id and s.organization_id=p_organization_id;
  insert into public.org_stages(organization_id,orden,nombre,color,activo)
    select p_organization_id,ord::integer,s->>'name',s->>'color',true
    from jsonb_array_elements(v_pipeline) with ordinality x(s,ord)
    on conflict (organization_id,nombre) do update set orden=excluded.orden,color=excluded.color,activo=true,deleted_at=null;
  update public.organizations set meta_config=jsonb_set(coalesce(v_org.meta_config,'{}'::jsonb),'{crm}',
    coalesce(v_org.meta_config->'crm','{}'::jsonb)||jsonb_build_object('pipeline',v_pipeline,
      'pipelineUpdatedAt',clock_timestamp(),'pipelineUpdatedBy',p_actor_id)),updated_at=clock_timestamp()
    where id=p_organization_id returning * into v_org;
  if p_copilot is not null then
    if jsonb_typeof(p_copilot) is distinct from 'object' or not(p_copilot ? 'appointment_stage')
      or (p_copilot-array['appointment_stage'])<>'{}'::jsonb
      or jsonb_typeof(p_copilot->'appointment_stage') not in ('string','null') then
      raise exception 'Configuración de cita inválida.' using errcode='22023'; end if;
    perform public.fn_company_appointment_config(p_organization_id,nullif(btrim(p_copilot->>'appointment_stage'),''));
    select * into v_org from public.organizations where id=p_organization_id;
  end if;
  return jsonb_build_object('copilot',jsonb_build_object('configured',coalesce(v_org.meta_config->'crm','{}'::jsonb)?'appointmentStage',
    'appointment_stage',public.fn_org_appointment_stage(p_organization_id)), 'ok',true,'organization',jsonb_build_object('id',v_org.id,'name',v_org.name,
    'meta_config',v_org.meta_config),'pipeline',v_pipeline,'usage',v_usage,'updated_at',v_org.updated_at,
    'preserved_stages',v_preserved);
end $function$;

revoke all on function public.fn_company_pipeline_publish(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.fn_company_pipeline_publish(uuid,uuid,timestamptz,jsonb,jsonb) to service_role;

