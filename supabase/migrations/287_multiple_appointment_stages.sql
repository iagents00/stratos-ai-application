-- An organization can associate more than one stage with a real appointment.
-- The first remains the primary role for older installed clients.
create or replace function public.fn_org_appointment_stages(p_org uuid) returns text[]
language sql stable set search_path=public,pg_temp as $f$
 select case when jsonb_typeof(o.meta_config#>'{crm,appointmentStages}')='array' then
   array(select value from jsonb_array_elements_text(o.meta_config#>'{crm,appointmentStages}') with ordinality a(value,ord)
     where exists(select 1 from public.fn_effective_org_stages(p_org) s where s.nombre=a.value) order by ord)
   else array_remove(array[public.fn_org_appointment_stage(p_org)],null) end
 from public.organizations o where o.id=p_org
$f$;
create or replace function public.fn_is_org_appointment_stage(p_org uuid,p_stage text) returns boolean
language sql stable set search_path=public,pg_temp as $f$
 select coalesce(exists(select 1 from unnest(public.fn_org_appointment_stages(p_org)) s where lower(s)=lower(p_stage)),false)
$f$;
revoke all on function public.fn_org_appointment_stages(uuid),public.fn_is_org_appointment_stage(uuid,text) from public,anon;
grant execute on function public.fn_org_appointment_stages(uuid),public.fn_is_org_appointment_stage(uuid,text) to authenticated,service_role;

create or replace function public.fn_company_appointments_config(p_org uuid,p_stages jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_names text[]; v_stage record; v_name text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
 if jsonb_typeof(p_stages) is distinct from 'array' or jsonb_array_length(p_stages)>30
  or exists(select 1 from jsonb_array_elements(p_stages) s where jsonb_typeof(s) is distinct from 'string') then
  raise exception 'Elige las etapas del pipeline donde hay citas.' using errcode='22023'; end if;
 v_names:='{}'::text[];
 for v_stage in select value,ord from jsonb_array_elements_text(p_stages) with ordinality s(value,ord) order by ord loop
  select nombre into v_name from public.fn_effective_org_stages(p_org)
   where lower(nombre)=lower(regexp_replace(btrim(v_stage.value),'[[:space:]]+',' ','g')) limit 1;
  if not found or v_name=any(v_names) then
   raise exception 'Elige etapas distintas que existan en el pipeline.' using errcode='22023'; end if;
  v_names:=array_append(v_names,v_name);
 end loop;
 perform public.fn_company_appointment_config(p_org,v_names[1]);
 update public.organizations set meta_config=jsonb_set(meta_config,'{crm,appointmentStages}',to_jsonb(v_names)),updated_at=clock_timestamp()
 where id=p_org;
end $f$;
revoke all on function public.fn_company_appointments_config(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fn_company_appointments_config(uuid,jsonb) to service_role;

create or replace function public.fn_resolve_appointment_stage(p_org uuid,p_current text,p_requested text default null) returns text
language plpgsql stable set search_path=public,pg_temp as $f$
declare v_names text[]:=public.fn_org_appointment_stages(p_org); v_name text;
begin
 if nullif(btrim(p_requested),'') is not null then
  v_name:=public.fn_org_stage(p_org,p_requested);
  if public.fn_is_org_appointment_stage(p_org,v_name) then return v_name; end if;
  return null;
 end if;
 if public.fn_is_org_appointment_stage(p_org,p_current) then return p_current; end if;
 if cardinality(v_names)=1 then return v_names[1]; end if;
 return null;
end $f$;
create or replace function public.fn_appointment_stage_from_text(p_org uuid,p_text text) returns text
language sql stable set search_path=public,pg_temp as $f$
 select case when count(*)=1 then min(s) end from unnest(public.fn_org_appointment_stages(p_org)) s
 where position(public.unaccent(lower(s)) in public.unaccent(lower(coalesce(p_text,''))))>0
$f$;
revoke all on function public.fn_resolve_appointment_stage(uuid,text,text),public.fn_appointment_stage_from_text(uuid,text) from public,anon;
grant execute on function public.fn_resolve_appointment_stage(uuid,text,text),public.fn_appointment_stage_from_text(uuid,text) to authenticated,service_role;


CREATE OR REPLACE FUNCTION public.fn_org_appointment_stage(p_org uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select case when jsonb_typeof(o.meta_config#>'{crm,appointmentStages}')='array' then
   (select value from jsonb_array_elements_text(o.meta_config#>'{crm,appointmentStages}') with ordinality a(value,ord)
     where exists(select 1 from public.fn_effective_org_stages(p_org) s where s.nombre=a.value) order by ord limit 1)
   when coalesce(o.meta_config->'crm','{}'::jsonb) ? 'appointmentStage'
   then nullif(o.meta_config#>>'{crm,appointmentStage}','')
   else coalesce(c.zoom_stage_label,case when exists(select 1 from public.fn_effective_org_stages(p_org) s where s.nombre='Zoom Agendado') then 'Zoom Agendado' end) end
 from public.organizations o left join public.proactive_config c on c.organization_id=o.id where o.id=p_org
$function$;

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
  v_renames jsonb := '{}'::jsonb;
  v_aliases jsonb;
  v_rename record;
  v_previous_context text;
  v_renamed_clients integer := 0;
  v_appointment text;
  v_appointments text[];
  v_mapped_appointments text[];
  v_requested_appointments jsonb;
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
      or s->>'color' !~ '^#[0-9A-Fa-f]{6}$'
      or (s ? 'previous_name' and jsonb_typeof(s->'previous_name') is distinct from 'string')) then
    raise exception 'Revisa los nombres y colores de las etapas.' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('name',regexp_replace(btrim(s->>'name'),'\s+',' ','g'),
    'color',upper(s->>'color')) order by ord) into v_pipeline
    from jsonb_array_elements(p_pipeline) with ordinality x(s,ord);
  if exists(select 1 from jsonb_array_elements(v_pipeline) s group by lower(s->>'name') having count(*)>1) then
    raise exception 'Los nombres de las etapas no se pueden repetir.' using errcode='22023';
  end if;
  v_current:=public.fn_platform_crm_pipeline(p_organization_id);
  v_appointments:=public.fn_org_appointment_stages(p_organization_id);
  -- The original name comes from a stable editor row; never infer by position.
  for v_rename in select s->>'previous_name' old_name,s->>'name' raw_name
    from jsonb_array_elements(p_pipeline) s where s ? 'previous_name' loop
    if v_rename.old_name is null or not exists(select 1 from jsonb_array_elements(v_current) c where c->>'name'=v_rename.old_name) then
      raise exception 'La etapa original ya no existe. Recarga el pipeline.' using errcode='40001'; end if;
    if (select count(*) from jsonb_array_elements(p_pipeline) c where c->>'previous_name'=v_rename.old_name)>1 then
      raise exception 'Una etapa original no se puede renombrar dos veces.' using errcode='22023'; end if;
    v_rename.raw_name:=regexp_replace(btrim(v_rename.raw_name),'[[:space:]]+',' ','g');
    if exists(select 1 from jsonb_array_elements(v_current) c where lower(c->>'name')=lower(v_rename.raw_name) and c->>'name'<>v_rename.old_name) then
      raise exception 'El nuevo nombre ya pertenece a otra etapa. Usa un nombre diferente.' using errcode='22023'; end if;
    if v_rename.old_name<>v_rename.raw_name then v_renames:=v_renames||jsonb_build_object(v_rename.old_name,v_rename.raw_name); end if;
  end loop;
  if v_renames<>'{}'::jsonb then
    -- Freeze this tenant's rows before relabeling; other companies stay independent.
    perform 1 from public.leads where organization_id=p_organization_id order by id for update;
    if p_copilot is null and exists(select 1 from unnest(v_appointments) s where v_renames ? s) then
      p_copilot:=jsonb_build_object('appointment_stages',(select coalesce(jsonb_agg(coalesce(v_renames->>s,s)),'[]'::jsonb) from unnest(v_appointments) s));
    end if;
    select coalesce(jsonb_object_agg(key,coalesce(v_renames->>value,value)),'{}'::jsonb) into v_aliases
      from jsonb_each_text(case when jsonb_typeof(v_org.meta_config#>'{crm,stageAliases}')='object'
        then v_org.meta_config#>'{crm,stageAliases}' else '{}'::jsonb end);
    v_aliases:=v_aliases||v_renames;
    -- Existing names always retain their explicit meaning, rather than becoming aliases.
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_aliases from jsonb_each_text(v_aliases) a
      where not exists(select 1 from jsonb_array_elements(v_pipeline) s where lower(s->>'name')=lower(a.key));
    v_previous_context:=current_setting('stratos.pipeline_label_rename',true);
    perform set_config('stratos.pipeline_label_rename',jsonb_build_object('organization_id',p_organization_id,'names',v_renames)::text,true);
    update public.leads set stage=v_renames->>stage
      where organization_id=p_organization_id and v_renames ? stage;
    get diagnostics v_renamed_clients=row_count;
    perform set_config('stratos.pipeline_label_rename',coalesce(v_previous_context,''),true);
    update public.proactive_config c set
      terminal_stages=case when c.terminal_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.terminal_stages) s) end,
      inactivity_include_stages=case when c.inactivity_include_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.inactivity_include_stages) s) end,
      inactivity_exclude_stages=case when c.inactivity_exclude_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.inactivity_exclude_stages) s) end
      where c.organization_id=p_organization_id;
    update public.lead_assignment_pools set default_stage=v_renames->>default_stage
      where organization_id=p_organization_id and v_renames ? default_stage;
    update public.bot_pending_stage_move set from_stage=coalesce(v_renames->>from_stage,from_stage),to_stage=coalesce(v_renames->>to_stage,to_stage)
      where organization_id=p_organization_id and (v_renames ? from_stage or v_renames ? to_stage);
  end if;
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
  if p_copilot is null and (coalesce(v_org.meta_config->'crm','{}') ?| array['appointmentStage','appointmentStages'])
    and exists(select 1 from unnest(v_appointments) a
      where not exists(select 1 from jsonb_array_elements(v_pipeline) x where x->>'name'=coalesce(v_renames->>a,a))) then
    raise exception 'Para cambiar una etapa de citas, actualiza también su selección en Pipeline de mi empresa.' using errcode='40001';
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
      'pipelineUpdatedAt',clock_timestamp(),'pipelineUpdatedBy',p_actor_id)
      ||case when v_renames<>'{}'::jsonb then jsonb_build_object('stageAliases',v_aliases) else '{}'::jsonb end),updated_at=clock_timestamp()
    where id=p_organization_id returning * into v_org;
  if p_copilot is not null then
    if jsonb_typeof(p_copilot) is distinct from 'object'
      or (p_copilot-array['appointment_stage','appointment_stages'])<>'{}'::jsonb
      or not(p_copilot ?| array['appointment_stage','appointment_stages'])
      or (p_copilot ? 'appointment_stage' and p_copilot ? 'appointment_stages') then
      raise exception 'Configuración de citas inválida.' using errcode='22023'; end if;
    if p_copilot ? 'appointment_stages' then
      v_requested_appointments:=p_copilot->'appointment_stages';
    else
      if jsonb_typeof(p_copilot->'appointment_stage') not in ('string','null') then
        raise exception 'Configuración de cita inválida.' using errcode='22023'; end if;
      select coalesce(array_agg(coalesce(v_renames->>a,a)),'{}'::text[]) into v_mapped_appointments from unnest(v_appointments) a;
      v_appointment:=nullif(btrim(p_copilot->>'appointment_stage'),'');
      if cardinality(v_mapped_appointments)>1 then
        if v_appointment is distinct from v_mapped_appointments[1] then
          raise exception 'Esta empresa tiene varias etapas de cita. Usa la versión actual para cambiar su selección.' using errcode='40001'; end if;
        v_requested_appointments:=to_jsonb(v_mapped_appointments);
      else
        v_requested_appointments:=case when v_appointment is null then '[]'::jsonb else jsonb_build_array(v_appointment) end;
      end if;
    end if;
    perform public.fn_company_appointments_config(p_organization_id,v_requested_appointments);
    select * into v_org from public.organizations where id=p_organization_id;
  end if;
  return jsonb_build_object('copilot',jsonb_build_object('configured',coalesce(v_org.meta_config->'crm','{}'::jsonb)?'appointmentStage',
    'appointment_stage',public.fn_org_appointment_stage(p_organization_id),'appointment_stages',to_jsonb(public.fn_org_appointment_stages(p_organization_id))), 'ok',true,'organization',jsonb_build_object('id',v_org.id,'name',v_org.name,
    'meta_config',v_org.meta_config),'pipeline',v_pipeline,'usage',v_usage,'updated_at',v_org.updated_at,
    'preserved_stages',v_preserved,'renamed_stages',v_renames,'renamed_clients',v_renamed_clients);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_zooms(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_enqueued int := 0;
  v_multiple boolean;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  select jsonb_typeof(meta_config#>'{crm,appointmentStages}')='array' into v_multiple from public.organizations where id=v_org_id;
  WITH candidates AS (
    SELECT l.id, l.asesor_id, l.asesor_name, l.name AS lead_name, l.next_action_at, l.stage, case when v_multiple then l.stage else 'Zoom' end as appointment_label,
           GREATEST(l.next_action_at - (v_cfg.zoom_reminder_hours * interval '1 hour'), now()) AS fire_at
    FROM public.leads l
    WHERE l.organization_id = v_org_id
      AND l.deleted_at IS NULL
      AND public.fn_is_org_appointment_stage(v_org_id,l.stage)
      AND l.next_action_at IS NOT NULL
      AND l.next_action_at > now()
      AND l.next_action_at <= now() + interval '24 hours'
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  admins AS (
    SELECT p.id, p.name FROM public.profiles p
    WHERE p.organization_id = v_org_id AND COALESCE(p.active,true)=true
      AND p.role IN ('super_admin','admin','ceo','director') AND p.telegram_chat_id IS NOT NULL
      AND COALESCE(p.receives_sales_alerts,true)
  ),
  ins AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'zoom_brief', c.fire_at,
           'zoom_brief:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true, jsonb_build_object('appointment_stage',c.stage,'zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at))
    FROM candidates c
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  ins_admin AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, a.id, a.name, 'zoom_brief', c.fire_at,
           'zoom_brief:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI') || ':admincc:' || a.id::text,
           true, jsonb_build_object('appointment_stage',c.stage,'zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'admin_cc', true)
    FROM candidates c CROSS JOIN admins a
    WHERE c.asesor_id IS NULL AND (c.asesor_name IS NULL OR btrim(c.asesor_name) = '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  t1h AS (
    SELECT c.*,
           EXISTS (SELECT 1 FROM public.proactive_pending_reports o
                   WHERE o.organization_id=v_org_id AND o.lead_id=c.id
                     AND o.kind IN ('zoom_brief','awaiting_plan') AND o.status='open') AS plan_missing
    FROM candidates c
    WHERE c.next_action_at <= now() + interval '1 hour'
  ),
  ins_1h AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name,
           CASE WHEN c.plan_missing THEN 'zoom_1h_missing' ELSE 'zoom_1h_ok' END,
           now(),
           'zoom_1h:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true,
           jsonb_build_object('appointment_stage',c.stage,'zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'text',
             CASE WHEN c.plan_missing
               THEN 'En 1 hora el '||c.appointment_label||' de '||coalesce(c.lead_name,'tu cliente')||' y todavía no cargaste el plan. Armalo ya para llegar listo.'
               ELSE 'En 1 hora tu '||c.appointment_label||' con '||coalesce(c.lead_name,'tu cliente')||'. Plan listo — repasá los puntos clave y a darle.' END)
    FROM t1h c
    WHERE c.asesor_id IS NOT NULL OR (c.asesor_name IS NOT NULL AND btrim(c.asesor_name) <> '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  ins_1h_admin AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, a.id, a.name, 'zoom_1h_missing', now(),
           'zoom_1h:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI') || ':admincc:' || a.id::text,
           true,
           jsonb_build_object('appointment_stage',c.stage,'zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'admin_cc', true, 'text',
             ''||coalesce(c.asesor_name,'Un asesor')||' tiene '||c.appointment_label||' en 1h con '||coalesce(c.lead_name,'un cliente')||' y NO cargó el plan.')
    FROM t1h c CROSS JOIN admins a
    WHERE c.plan_missing
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  t15 AS (
    SELECT c.* FROM candidates c WHERE c.next_action_at <= now() + interval '15 minutes'
  ),
  ins_15 AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'zoom_15min', now(),
           'zoom_15min:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true,
           jsonb_build_object('appointment_stage',c.stage,'zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'text',
             'En 15 min tu '||c.appointment_label||' con '||coalesce(c.lead_name,'tu cliente')||'. Last check: link, cámara y el plan a mano.')
    FROM t15 c
    WHERE c.asesor_id IS NOT NULL OR (c.asesor_name IS NOT NULL AND btrim(c.asesor_name) <> '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM (
    SELECT 1 FROM ins UNION ALL SELECT 1 FROM ins_admin
    UNION ALL SELECT 1 FROM ins_1h UNION ALL SELECT 1 FROM ins_1h_admin
    UNION ALL SELECT 1 FROM ins_15
  ) z;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_next_action_reminders(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(nullif(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%rowtype; v_enq int := 0;
begin
  select * into v_cfg from public.proactive_config where organization_id = v_org;
  if not found or not v_cfg.enabled then return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled'); end if;
  with candidates as (
    select l.id as lead_id, l.asesor_id, l.asesor_name, l.name as lead_name, l.next_action, l.next_action_at,
           pf.telegram_chat_id as advisor_telegram_id, k.kind, k.win_start, k.win_end
    from public.leads l
    join public.profiles pf on pf.id = l.asesor_id and pf.organization_id = v_org
    cross join lateral (values
        ('next_action_3h',    l.next_action_at - interval '3 hours',    l.next_action_at - interval '10 minutes'),
        ('next_action_10min', l.next_action_at - interval '10 minutes', l.next_action_at)
      ) as k(kind, win_start, win_end)
    where l.organization_id = v_org and l.deleted_at is null and l.asesor_name is not null and l.next_action_at is not null
      and now() >= k.win_start and now() < k.win_end
      and not public.fn_is_org_appointment_stage(v_org,l.stage)
      and not exists (select 1 from unnest(v_cfg.terminal_stages) t where lower(t) = lower(l.stage))
      and (not v_cfg.shadow_mode or l.asesor_name = any (v_cfg.test_asesor_names))
      and coalesce(pf.active,true) = true and pf.telegram_chat_id is not null
  ),
  ins_queue as (
    insert into public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    select v_org, c.lead_id, c.asesor_id, c.asesor_name, c.kind, now(),
           c.kind || ':' || c.lead_id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           (c.kind = 'next_action_10min'),
           jsonb_build_object('next_action_at', c.next_action_at, 'next_action', c.next_action, 'lead_name', c.lead_name, 'advisor_telegram_id', c.advisor_telegram_id)
    from candidates c
    on conflict (dedupe_key) do nothing returning 1
  )
  select count(*) into v_enq from ins_queue;
  return jsonb_build_object('ok', true, 'enqueued', v_enq, 'organization_id', v_org);
end; $function$;

CREATE OR REPLACE FUNCTION public.fn_company_copilot_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o record; v_payload jsonb; v_result jsonb; v_item jsonb; v_escalation jsonb;
 v_recipient record; v_out jsonb:='[]'; v_synthetic int:=0; v_failures jsonb:='[]';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(794115026) then return jsonb_build_object('ok',true,'reminders','[]'::jsonb,'reason','busy'); end if;
 for o in select org.id,public.fn_org_appointment_stages(org.id) appointment_stages,c.timezone
  from public.organizations org join public.proactive_config c on c.organization_id=org.id
  where org.active is true and org.meta_config#>>'{crm,copilotReminders}'='true'
    and org.meta_config#>>'{onboarding,createdFrom}'='whatsapp_admin'
    and coalesce(org.meta_config#>>'{features,copilotModule}','true')<>'false' and c.enabled
 loop
  begin
   v_payload:=jsonb_build_object('organization_id',o.id);
   -- Cancel obsolete reminders, never delete history. Rescheduling gets a new dedupe key.
   update public.proactive_reminders r set status='cancelled'
   where r.organization_id=o.id and r.status='pending' and r.lead_id is not null
    and (r.tipo like 'zoom%' or r.tipo like 'next_action%' or r.tipo like 'visita%')
    and not exists(select 1 from public.leads l where l.organization_id=o.id and l.id=r.lead_id and l.deleted_at is null
      and (case when r.tipo like 'zoom%' then public.fn_is_org_appointment_stage(o.id,l.stage)
        and l.next_action_at=nullif(r.payload->>'zoom_at','')::timestamptz and l.next_action_at>now()
       when r.tipo like 'next_action%' then l.next_action_at=nullif(r.payload->>'next_action_at','')::timestamptz and l.next_action_at>now()
       else l.visita_at>now() end));
   update public.proactive_pending_reports rep set status='closed',outcome='schedule_changed'
    from public.proactive_reminders r
    where rep.organization_id=o.id and r.organization_id=o.id and rep.reminder_id=r.id and rep.status='open'
      and r.tipo in ('zoom_brief','next_action_3h','next_action_10min')
      and not exists(select 1 from public.leads l where l.organization_id=o.id and l.id=r.lead_id and l.deleted_at is null
        and case when r.tipo='zoom_brief' then public.fn_is_org_appointment_stage(o.id,l.stage)
          and l.next_action_at=nullif(r.payload->>'zoom_at','')::timestamptz
         else l.next_action_at=nullif(r.payload->>'next_action_at','')::timestamptz end);
   perform public.fn_proactive_scan_zooms(v_payload);
   perform public.fn_proactive_next_action_reminders(v_payload);
   perform public.fn_proactive_scan_inactive(v_payload);
   perform public.fn_proactive_scan_insist(v_payload);
   -- The shared team-action worker already scans all enabled organizations.
   update public.proactive_reminders r set payload=r.payload||jsonb_build_object('appointment_stage',l.stage,'text',
    case when r.tipo='zoom_brief' then '▸ '||l.stage||' — '||public.fn_fmt_fecha_legible(l.next_action_at)
      ||chr(10)||coalesce(public.fn_lead_briefing_text(l.id),'')||chr(10)||'Prepara tu plan para la cita. Puedes enviarlo aquí o abrir la ficha del cliente.'
     when r.tipo in ('zoom_1h_ok','zoom_1h_missing') then
      '▸ '||l.stage||' en 1 hora con '||coalesce(l.name,'tu cliente')||chr(10)||
      case when exists(select 1 from public.proactive_pending_reports p where p.organization_id=o.id and p.lead_id=l.id
        and p.advisor_telegram_id=(select telegram_chat_id from public.profiles where id=r.asesor_id and organization_id=o.id)
        and p.status='open' and p.kind in ('zoom_brief','awaiting_plan')) then 'Todavía falta registrar el plan. Prepáralo antes de la cita.'
       else 'Repasa la información y el plan antes de la cita.' end
     when r.tipo='zoom_15min' then '▸ '||l.stage||' en 15 minutos con '||coalesce(l.name,'tu cliente')||chr(10)||'Revisa el lugar o enlace y ten listo tu plan.'
     else coalesce(r.payload->>'text','Recordatorio de cita') end)
    from public.leads l where r.organization_id=o.id and l.organization_id=o.id and r.lead_id=l.id and r.status='pending' and r.tipo like 'zoom%';
   v_result:=public.fn_proactive_scan_next_action_escalations(v_payload);
   for v_escalation in select value from jsonb_array_elements(v_result->'escalations') loop
    for v_recipient in select p.id,p.name,p.telegram_chat_id from public.profiles p where p.organization_id=o.id and p.active is true
      and (p.telegram_chat_id=(v_escalation->>'advisor_telegram_id')::bigint
       or p.telegram_chat_id in(select value::text::bigint from jsonb_array_elements_text(v_escalation->'manager_telegram_ids'))) loop
     insert into public.proactive_reminders(organization_id,lead_id,asesor_id,asesor_name,tipo,scheduled_at,dedupe_key,ignore_quiet,payload)
      values(o.id,(v_escalation->>'lead_id')::uuid,v_recipient.id,v_recipient.name,'admin_overdue',now(),
       'company_escalation:'||(v_escalation->>'report_id')||':'||v_recipient.id,true,
       jsonb_build_object('text','▸ Seguimiento pendiente con '||coalesce(v_escalation->>'lead_name','un cliente')||chr(10)||'No se recibió la respuesta o el plan solicitado. Revisa el cliente en el CRM.'))
      on conflict(dedupe_key) do nothing;
    end loop;
   end loop;
   v_result:=public.fn_proactive_get_pending(v_payload||jsonb_build_object('tipo_in',jsonb_build_array(
    'zoom_brief','zoom_1h_missing','zoom_1h_ok','zoom_15min','next_action_3h','next_action_10min','inactividad','inactividad_insist','personal','admin_overdue')));
   v_synthetic:=v_synthetic+coalesce((v_result->>'synthetic_logged')::int,0);
   for v_item in select value from jsonb_array_elements(v_result->'reminders') loop
    -- Telegram-positive identities need the same activity record as Copilot-only identities.
    perform public.fn_log_proactive_copilot((v_item->>'advisor_telegram_id')::bigint,
      coalesce(v_item#>>'{payload,text}',v_item#>>'{payload,message}',v_item#>>'{payload,next_action}','Recordatorio de seguimiento'),'ai');
    v_out:=v_out||jsonb_build_array(v_item||jsonb_build_object('organization_id',o.id));
   end loop;
  exception when others then
   -- Roll back this organization only; another tenant must keep receiving reminders.
   v_failures:=v_failures||jsonb_build_array(jsonb_build_object('organization_id',o.id,'code',sqlstate));
  end;
 end loop;
 return jsonb_build_object('ok',jsonb_array_length(v_failures)=0,'reminders',v_out,'count',jsonb_array_length(v_out),'synthetic_logged',v_synthetic,'failures',v_failures);
end $function$;

CREATE OR REPLACE FUNCTION public.fn_managed_appointment_date_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_stage text; v_managed boolean;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF public.fn_is_pipeline_label_rename(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
  END IF;
 select meta_config#>>'{crm,copilotReminders}'='true' into v_managed from public.organizations where id=new.organization_id;
 if not coalesce(v_managed,false) then return new; end if;
 v_stage:=public.fn_org_appointment_stage(new.organization_id);
 if lower(coalesce(new.stage,'')) in ('zoom agendado','visita agendada') and not exists(
   select 1 from public.fn_effective_org_stages(new.organization_id) where nombre=new.stage
 ) and v_stage is not null then new.stage:=v_stage; end if;
 if public.fn_is_org_appointment_stage(new.organization_id,new.stage) then
  if tg_op='INSERT' or old.stage is distinct from new.stage or new.next_action_at is distinct from old.next_action_at then
   new.next_action_at:=coalesce(new.next_action_at,new.selected_time,new.visita_at);
   new.selected_time:=new.next_action_at;
  elsif new.selected_time is distinct from old.selected_time then new.next_action_at:=new.selected_time;
  end if;
 end if;
 if public.fn_is_org_appointment_stage(new.organization_id,new.stage) and (tg_op='INSERT' or old.stage is distinct from new.stage) then
   new.next_action_at:=coalesce(new.next_action_at,new.selected_time,new.visita_at);
   if new.next_action_at is null or new.next_action_at<=now() then
    raise exception 'Para la etapa «%», indica una fecha y hora futuras para la cita.',new.stage using errcode='22023'; end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_reschedule_apply(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_new timestamptz; v_ai timestamptz; v_parsed timestamptz;
  v_agent_id uuid; v_name text; v_stage text; v_legible text; v_is_zoom boolean;
  v_label text;
  v_raw text := NULLIF(btrim(payload->>'raw_text'),'');
  v_now_cancun timestamptz := now() AT TIME ZONE 'America/Cancun';
BEGIN
  IF v_lead IS NULL OR v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Faltan datos.'); END IF;
  IF v_raw IS NOT NULL THEN
    BEGIN v_parsed := public.parse_relative_or_abs_es(v_raw, 'America/Cancun'); EXCEPTION WHEN others THEN v_parsed := NULL; END;
  END IF;
  BEGIN v_ai := (payload->>'new_datetime_iso')::timestamptz; EXCEPTION WHEN others THEN v_ai := NULL; END;
  IF v_parsed IS NOT NULL THEN v_new := v_parsed;
  ELSIF v_raw IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'text','No entendí la fecha. Mándame algo como: mañana 3pm, en 3 horas, el jueves 3pm, o '||public.fn_fecha_humana((v_now_cancun + interval '1 day'),'America/Cancun',true)||'.');
  ELSIF v_ai IS NOT NULL THEN v_new := v_ai;
  ELSE RETURN jsonb_build_object('ok',false,'text','No entendí la fecha. Mándame algo como: mañana 3pm, en 3 horas, el jueves 3pm, o 22/05 15:00.'); END IF;
  IF (v_new AT TIME ZONE 'America/Cancun') < (v_now_cancun - interval '2 hours')
     OR extract(year FROM (v_new AT TIME ZONE 'America/Cancun')) < extract(year FROM v_now_cancun)
     OR extract(year FROM (v_new AT TIME ZONE 'America/Cancun')) > extract(year FROM v_now_cancun) + 1 THEN
    RETURN jsonb_build_object('ok',false,'text','Esa fecha quedó en pasado. Mándame una futura, ej: mañana 3pm, en 3 horas, el jueves 3pm, o '||public.fn_fecha_humana((v_now_cancun + interval '1 day'),'America/Cancun',true)||'.');
  END IF;

  SELECT name, stage INTO v_name, v_stage FROM public.leads WHERE id=v_lead AND organization_id=v_org AND deleted_at IS NULL;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;
  v_is_zoom := coalesce(v_stage,'') ILIKE 'Zoom%' or public.fn_is_org_appointment_stage(v_org,v_stage);
  v_label := case when v_is_zoom then case when public.fn_is_org_appointment_stage(v_org,v_stage) then v_stage else coalesce(public.fn_org_appointment_stage(v_org),'Zoom') end else 'la próxima acción' end;
  v_legible := public.fn_fecha_es(v_new,'America/Cancun');

  IF v_is_zoom THEN
    UPDATE public.leads SET stage=case when public.fn_is_org_appointment_stage(v_org,stage) then stage else coalesce(public.fn_org_appointment_stage(v_org),stage) end, next_action=v_label||' con cliente (reagendado)', next_action_at=v_new,
      next_action_date=public.fn_fecha_humana(v_new,'America/Cancun',true), updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI')
    WHERE id=v_lead AND organization_id=v_org;
  ELSE
    -- Próxima acción: cambiar SOLO el cuándo; conservar la acción original (el qué).
    UPDATE public.leads SET next_action_at=v_new,
      next_action_date=public.fn_fecha_humana(v_new,'America/Cancun',true), updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI')
    WHERE id=v_lead AND organization_id=v_org;
  END IF;

  INSERT INTO public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en)
  VALUES (v_lead,v_org,'nota',(case when v_is_zoom then v_label else 'Próxima acción' end)||' reagendado para '||v_legible||'.',v_agent_id,now());
  INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata)
  VALUES (v_lead,v_org,'nota',(case when v_is_zoom then v_label else 'Próxima acción' end)||' reagendada (recordatorio IA)',
          (case when v_is_zoom then v_label else 'Próxima acción' end)||' reagendada para '||v_legible||'.',v_agent_id,
          jsonb_build_object('source','proactive_reschedule_apply','new_datetime',v_new,'raw_text',v_raw));
  UPDATE public.proactive_pending_reports SET status='closed', outcome='reagendado'
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND lead_id=v_lead AND status='open';

  RETURN jsonb_build_object('ok',true,'text','Listo, reagendé '||v_label||' de '||v_name||' para '||v_legible||'.','next_action_at',v_new);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_org_stage(p_org uuid, p_in text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_t   text := public.unaccent(lower(btrim(coalesce(p_in,''))));
  v_w   text;
  v_n   int;
  v_out text;
  v_has boolean;
  v_cnt int;
  v_grupo text;
begin
  if v_t = '' then return null; end if;
  v_out:=public.fn_pipeline_stage_alias(p_org,p_in);
  if v_out is not null then return v_out; end if;
  if cardinality(public.fn_org_appointment_stages(p_org))>1
    and v_t in ('zoom','zoom agendado','cita','cita agendada','reunion','reunion agendada','videollamada')
    and not exists(select 1 from public.fn_effective_org_stages(p_org) s where public.unaccent(lower(s.nombre))=v_t) then
    return null;
  end if;

  select exists(select 1 from public.fn_effective_org_stages(p_org)
                 where organization_id = p_org and activo and deleted_at is null)
    into v_has;

  if not v_has then return null; end if;
  -- A configured appointment role takes precedence over an occupied historical
  -- Zoom column preserved by the editor. No records are moved or renamed.
  if v_t in ('zoom agendado','zoom') and public.fn_org_appointment_stage(p_org) is not null
    and exists(select 1 from public.organizations o where o.id=p_org
      and coalesce(o.meta_config->'crm','{}'::jsonb)?'appointmentStage') then
    return public.fn_org_appointment_stage(p_org);
  end if;
  -- Common old creation defaults mean the FIRST stage of this company only
  -- when they are not themselves an explicitly configured stage.
  if v_t in ('nuevo registro','contactame ya','primer contacto','nuevo','new','inbound') and not exists(
    select 1 from public.fn_effective_org_stages(p_org) s where public.unaccent(lower(s.nombre))=v_t
  ) then
    select nombre into v_out from public.fn_effective_org_stages(p_org) order by orden limit 1;
    return v_out;
  end if;

  if v_t in ('zoom agendado','cita agendada','reunion agendada','zoom') and not exists(
    select 1 from public.fn_effective_org_stages(p_org) where public.unaccent(lower(nombre))=v_t
  ) then return public.fn_org_appointment_stage(p_org); end if;

  -- ¿La pregunta nombra un SUB-TABLERO de esta org? («de taller», «de pacientes»)
  -- Basta una palabra significativa del nombre del grupo.
  select s.grupo into v_grupo
    from public.fn_effective_org_stages(p_org) s
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and s.grupo is not null
     and exists (
       select 1
         from unnest(regexp_split_to_array(public.unaccent(lower(s.grupo)), '[^a-z0-9]+')) gw
        where length(gw) >= 5 and v_t ~ ('(^|[^a-z])'||gw)
     )
   group by s.grupo
   order by min(s.orden)
   limit 1;

  -- «la última etapa» / «el final» → la de mayor orden (del grupo, si lo nombró)
  if v_t ~ '^(la\s+|el\s+)?(ultim[ao]|final)(\s+(etapa|fase|paso))?$'
     or (v_grupo is not null and v_t ~ '(ultim[ao]|final)') then
    select nombre into v_out from public.fn_effective_org_stages(p_org)
     where organization_id = p_org and activo and deleted_at is null
       and (v_grupo is null or grupo = v_grupo)
     order by orden desc limit 1;
    return v_out;
  end if;

  -- Ordinal: «etapa 3», «la tercera» → esa posición (DENTRO del grupo si lo nombró)
  v_w := (regexp_match(v_t,
    '(?:(?:la|el|etapa|fase|numero)\s+)*(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa]|\d{1,2})(?:\s*(?:ra|da|ta|va|era|nda|°|ª))?(?:\s+(?:etapa|fase))?'))[1];
  -- Sin grupo nombrado la frase tiene que ser SOLO el ordinal (v3 byte a byte).
  if v_grupo is null then
    v_w := (regexp_match(v_t,
      '^(?:(?:la|el|etapa|fase|numero)\s+)*(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa]|\d{1,2})(?:\s*(?:ra|da|ta|va|era|nda|°|ª))?(?:\s+(?:etapa|fase))?$'))[1];
  end if;
  if v_w is not null then
    v_n := case
      when v_w ~ '^\d+$'       then v_w::int
      when v_w like 'primer%'  then 1
      when v_w like 'segund%'  then 2
      when v_w like 'tercer%'  then 3
      when v_w like 'cuart%'   then 4
      when v_w like 'quint%'   then 5
      when v_w like 'sext%'    then 6
      when v_w like 'septim%'  then 7
      when v_w like 'octav%'   then 8
      when v_w like 'noven%'   then 9
      when v_w like 'decim%'   then 10
    end;
    if v_n is not null then
      if v_grupo is not null then
        select nombre into v_out from (
          select nombre, row_number() over (order by orden) as pos
            from public.fn_effective_org_stages(p_org)
           where organization_id = p_org and activo and deleted_at is null and grupo = v_grupo
        ) q where q.pos = v_n;
      else
        select nombre into v_out from public.fn_effective_org_stages(p_org)
         where organization_id = p_org and activo and deleted_at is null and orden = v_n;
      end if;
      return v_out;  -- NULL si esa posición no existe: mejor preguntar que adivinar
    end if;
  end if;

  -- Por texto: exacta primero; después subcadena en ambas direcciones (gana la más corta)
  select nombre into v_out
    from public.fn_effective_org_stages(p_org)
   where organization_id = p_org and activo and deleted_at is null
     and ( public.unaccent(lower(nombre)) = v_t
        or public.unaccent(lower(nombre)) like '%'||v_t||'%'
        or v_t like '%'||public.unaccent(lower(nombre))||'%' )
   order by (case when public.unaccent(lower(nombre)) = v_t then 0 else 1 end), length(nombre)
   limit 1;
  if v_out is not null then return v_out; end if;

  -- Palabra parcial coloquial: alguna palabra significativa (≥4) del pedido es palabra
  -- de UNA SOLA etapa («los permisos», «el diseño»). Si varias la comparten → NULL.
  select count(distinct s.nombre), min(s.nombre) into v_cnt, v_out
    from public.fn_effective_org_stages(p_org) s
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and exists (
       select 1
         from unnest(regexp_split_to_array(v_t, '[^a-z0-9]+')) qw
         join unnest(regexp_split_to_array(public.unaccent(lower(s.nombre)), '[^a-z0-9]+')) sw on qw = sw
        where length(qw) >= 4
          and qw not in ('etapa','fase','paso','esta','este','para','donde','como','cuando')
     );
  if v_cnt = 1 then return v_out; end if;

  -- Typos de seseo/oído: c/z→s, v→b, sin h — frase entera y palabra por palabra.
  select count(distinct s.nombre), min(s.nombre) into v_cnt, v_out
    from public.fn_effective_org_stages(p_org) s
    cross join lateral (
      select translate(replace(public.unaccent(lower(s.nombre)),'h',''),'zcv','ssb') as sn
    ) n
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and (
       n.sn like '%'||translate(replace(v_t,'h',''),'zcv','ssb')||'%'
       or exists (
         select 1
           from unnest(regexp_split_to_array(translate(replace(v_t,'h',''),'zcv','ssb'), '[^a-z0-9]+')) qw
           join unnest(regexp_split_to_array(n.sn, '[^a-z0-9]+')) sw on qw = sw
          where length(qw) >= 5
       )
     );
  if v_cnt = 1 then return v_out; end if;

  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell_v2(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', ''));
  v_org_id uuid; v_profile_id uuid; v_view_all boolean := false; v_role text;
  v_name text; v_stage text; v_stage_in text; v_next_action text; v_zoom_at_text text; v_zoom_at timestamptz;
  v_lead record; m_name text[]; v_client_name text; v_advisor_name text;
  v_advisor_id uuid; v_advisor_label text; v_lead_id uuid; v_lead_name text; v_tz text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
    v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', v_text));
  end if;
  select p.organization_id, p.id, coalesce(p.view_all_leads,false), coalesce(p.role,'asesor')
    into v_org_id, v_profile_id, v_view_all, v_role
  from public.profiles p where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org_id, p_telegram_chat_id);

  if v_tool in ('assign_client','reassign_client','assign_lead') then
    if v_role not in ('super_admin','admin','ceo','director') then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No tienes permisos para asignar clientes.','inline_keyboard','[]'::jsonb));
    end if;
    v_client_name := nullif(trim(coalesce(v_args->>'client_name', v_args->>'name', '')), '');
    v_advisor_name := nullif(trim(coalesce(v_args->>'advisor_name', v_args->>'asesor_name', '')), '');
    if v_client_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el nombre o teléfono del cliente a asignar.','inline_keyboard','[]'::jsonb)); end if;
    if v_advisor_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el asesor destino. Ejemplo: asesor 2.','inline_keyboard','[]'::jsonb)); end if;
    select p2.id, p2.name into v_advisor_id, v_advisor_label from public.profiles p2
    where p2.organization_id = v_org_id and coalesce(p2.active,true)=true
      -- mig 228: cualquiera del lado VENTAS puede recibir un cliente (incluidos los
      -- directivos); solo se excluye el lado marketing (regla marketing ≠ ventas).
      and coalesce(p2.role,'asesor') <> 'marketing' and coalesce(p2.is_marketing_admin,false) = false
      and (public.fn_norm_nombre(p2.name) like '%'||public.fn_norm_nombre(v_advisor_name)||'%'
           or public.fn_obj_matchea(v_advisor_name, p2.name)
           or (regexp_replace(v_advisor_name,'[^0-9]','','g') <> '' and regexp_replace(coalesce(p2.name,''),'[^0-9]','','g') = regexp_replace(v_advisor_name,'[^0-9]','','g')))
    order by length(p2.name) asc limit 1;
    if v_advisor_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré al asesor destino "'||v_advisor_name||'".','inline_keyboard','[]'::jsonb)); end if;
    -- mig 232: elige por calidad de coincidencia y pregunta si hay empate.
    return public._bot_assign_client_safe(v_org_id, v_client_name, v_advisor_id, v_advisor_label);
    if v_lead_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con referencia "'||v_client_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Asigné a '||coalesce(v_lead_name,'cliente')||' con '||coalesce(v_advisor_label,'asesor')||' y lo puse en Contáctame Ya (prioridad 1).','inline_keyboard','[]'::jsonb));
  end if;

  if public.unaccent(lower(v_text)) ~ '^(¿)?(que|cuales|cuantas) (son las |son mis |son |hay de |hay |son )?etapas' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',
      'Las etapas de tu empresa son: '||coalesce(array_to_string(public.fn_org_stages_list(v_org_id), ' · '),'sin etapas')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_text ~* '(^|\s)(/clientes|mis\s+clientes|dame\s+el\s+nombre\s+de\s+mis\s+clientes|nombre\s+de\s+mis\s+clientes)(\s|$)' then v_tool := 'agenda';
  elsif v_text ~* '(^|\s)(/pipeline|pipeline|embudo)(\s|$)' then v_tool := 'pipeline'; end if;

  if v_tool in ('', 'auto') then
    if v_text ~* '(fecha.*zoom|zoom.*(mañana|manana|hoy|\d{1,2}|am|pm|:))' then v_tool := 'set_zoom_datetime';
    elsif v_text ~* '(cambia|mueve|actualiza).*(etapa)' then v_tool := 'change_stage';
    elsif v_text ~* '(cambia|actualiza).*(pr[oó]xima acci[oó]n)' then v_tool := 'update_next_action'; end if;
  end if;

  if v_tool in ('change_stage','update_stage','move_stage') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_stage := coalesce(v_args->>'stage', v_args->>'new_stage', v_args->>'etapa', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    -- Copilot can send raw text without an LLM-provided stage. Parse both
    -- parts together, then resolve the target against THIS company's stages.
    m_name := regexp_match(v_text, '(?i)^(?:cambia|cambiar|actualiza|actualizar)\s+(?:la\s+)?etapa\s+(?:de|del)\s+(.+?)\s+(?:a|al)\s+(.+?)[.!]?$');
    if m_name is not null then
      v_name := coalesce(nullif(btrim(v_name),''),btrim(m_name[1]));
      v_stage := coalesce(nullif(btrim(v_stage),''),btrim(m_name[2]));
    end if;

    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|cambiar|actualiza|etapa|a|de|del|la|el|cliente|mueve|pasar|stage|zoom|agendado|concretado|mañana|manana|hoy|am|pm|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_stage is null or trim(v_stage)='' then
      if v_text ~* 'zoom\s+agendado' then v_stage := 'Zoom Agendado';
      elsif v_text ~* 'zoom\s+concretado' then v_stage := 'Zoom Concretado';
      elsif v_text ~* 'seguimiento' then v_stage := 'Seguimiento';
      elsif v_text ~* 'nuevo\s+registro' then v_stage := 'Nuevo Registro'; end if;
    end if;
    if v_name is null or v_stage is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica cliente y etapa destino.','inline_keyboard','[]'::jsonb)); end if;
    v_stage_in := v_stage;
    v_stage := public.fn_org_stage(v_org_id,v_stage_in);
    if v_stage is null then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
        'text','No reconozco la etapa "'||v_stage_in||'". Las etapas de tu CRM son: '||
               array_to_string(public.fn_org_stages_list(v_org_id), ', ')||
               '. ¿A cuál lo muevo?','inline_keyboard','[]'::jsonb));
    end if;
    if (public.fn_is_org_appointment_stage(v_org_id,v_stage) or lower(v_stage)=lower('Visita Agendada')) and (v_zoom_at_text is null or trim(v_zoom_at_text)='') then
      v_zoom_at := public.parse_relative_or_abs_es(v_text, v_tz);
      if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Para pasar a "'||v_stage||'" necesito la fecha y hora. Ejemplo: "cambia etapa a '||v_stage||' mañana 9am".','inline_keyboard','[]'::jsonb)); end if;
    else v_zoom_at := public.parse_relative_or_abs_es(v_zoom_at_text, v_tz); end if;
    update public.leads l set stage = v_stage,
           next_action_at = case when public.fn_is_org_appointment_stage(v_org_id,v_stage) and v_zoom_at is not null then v_zoom_at else l.next_action_at end,
           next_action_date = case when public.fn_is_org_appointment_stage(v_org_id,v_stage) and v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end,
           visita_at = case when lower(v_stage)=lower('Visita Agendada') and v_zoom_at is not null then v_zoom_at else l.visita_at end,
           updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'Listo. Etapa de '||v_lead.name||' actualizada a "'||v_lead.stage||'".' ||
      case when public.fn_is_org_appointment_stage(v_org_id,v_lead.stage) and v_zoom_at is not null then E'\nFecha '||v_lead.stage||': '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) when lower(v_lead.stage)=lower('Visita Agendada') and v_zoom_at is not null then E'\nFecha visita: '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('set_zoom_datetime','update_zoom_datetime','zoom_date','set_zoom_date') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(pon|poner|fecha|zoom|agendado|a|de|del|la|el|cliente|mañana|manana|hoy|pasado|en|las|pm|am|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Dime el cliente para actualizar la fecha del Zoom.','inline_keyboard','[]'::jsonb)); end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, v_text), v_tz);
    if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No pude interpretar la fecha/hora. Ejemplo: mañana 9am o en 3 horas','inline_keyboard','[]'::jsonb)); end if;
    if cardinality(public.fn_org_appointment_stages(v_org_id))>1 then
      select l2.id,l2.name,l2.stage into v_lead from public.leads l2
       where l2.organization_id=v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id=v_profile_id)
        and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%'
         or (length(regexp_replace(v_name,'[^0-9]','','g'))>=7 and l2.phone_normalized=regexp_replace(v_name,'[^0-9]','','g')))
       order by l2.updated_at desc nulls last limit 1;
      if not found then return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','No encontré ese cliente en tu cartera.')); end if;
      v_stage:=public.fn_resolve_appointment_stage(v_org_id,v_lead.stage,coalesce(nullif(v_args->>'stage',''),nullif(v_args->>'etapa',''),public.fn_appointment_stage_from_text(v_org_id,v_text)));
      if v_stage is null then return jsonb_build_object('ok',false,'needs_input','appointment_stage','reply',jsonb_build_object('text',
       '¿En qué etapa es la cita? Indica la etapa, el cliente y la fecha: '||array_to_string(public.fn_org_appointment_stages(v_org_id),' · ')||'.')); end if;
    end if;
    update public.leads l set next_action_at = v_zoom_at, next_action_date = to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI'), stage = case when public.fn_is_org_appointment_stage(v_org_id,v_stage) then v_stage when public.fn_is_org_appointment_stage(v_org_id,l.stage) then l.stage when lower(coalesce(l.stage,'')) in ('zoom concretado','seguimiento','cierre','perdido','visita agendada')              then l.stage else coalesce(public.fn_org_stage(v_org_id,'Zoom Agendado'),l.stage) end, next_action = case when cardinality(public.fn_org_appointment_stages(v_org_id))>1 then coalesce(nullif(case when lower(coalesce(l.next_action,''))='zoom' then null else l.next_action end,''),v_stage,l.stage) when coalesce(l.next_action,'') ~* 'zoom' then l.next_action else 'Zoom' end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Fecha de '||v_lead.stage||' de '||v_lead.name||' actualizada a '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('update_next_action','next_action_update','set_next_action') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_next_action := coalesce(v_args->>'next_action', v_args->>'accion', v_args->>'proxima_accion', null);
    v_zoom_at_text := coalesce(v_args->>'next_action_at', v_args->>'zoom_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|actualiza|proxima|pr[oó]xima|accion|acci[oó]n|a|de|del|la|el|cliente|para)\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args); end if;
    if v_next_action is null or trim(v_next_action)='' then v_next_action := v_text; end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, case when v_text ~* '(mañana|manana|hoy|en\s+\d|\d{1,2}(:\d{2})?\s*(am|pm)?)' then v_text else null end), v_tz);
    update public.leads l set next_action = v_next_action, next_action_at = coalesce(v_zoom_at, l.next_action_at),
           next_action_date = case when v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.next_action, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'" para actualizar la próxima acción.','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'La próxima acción para '||v_lead.name||' ha sido actualizada a "'||v_lead.next_action||'".' ||
      case when v_lead.next_action_at is not null then E'\nFecha: '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args);
end; $function$;

CREATE OR REPLACE FUNCTION public.bot_agendar_visita(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_as jsonb := public.identify_asesor_by_telegram(p_telegram_chat_id);
  v_org uuid; v_tz text; v_stage text; v_managed boolean; v_current_stage text;
  v_client text := nullif(btrim(coalesce(p_args->>'client_name', p_args->>'name', p_args->>'cliente', p_args->>'lead','')),'');
  v_raw    text := nullif(btrim(coalesce(p_args->>'when', p_args->>'fecha', p_args->>'datetime', p_args->>'cuando', p_args->>'visita_at','')),'');
  v_lugar  text := nullif(btrim(coalesce(p_args->>'lugar', p_args->>'place', p_args->>'ubicacion', p_args->>'location', p_args->>'proyecto','')),'');
  v_texto  text := coalesce(p_args->>'input_text','');
  v_digits text; m text[];
  v_when timestamptz; v_lead_id uuid; v_lead_name text; v_legible text; v_accion text;
begin
  if not coalesce((v_as->>'paired')::boolean,false) then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Conecta tu Telegram al CRM primero.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  v_org := (v_as->>'organization_id')::uuid;
  select meta_config#>>'{crm,copilotReminders}'='true' into v_managed from public.organizations where id=v_org;
  v_stage:=case when coalesce(v_managed,false) then public.fn_org_appointment_stage(v_org) else 'Visita Agendada' end;
  if coalesce(v_managed,false) and v_stage is null then
   return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Esta empresa no utiliza una etapa de citas. El administrador puede elegirla en Pipeline de mi empresa.')); end if;
  v_tz := coalesce(public.fn_user_tz(v_org,p_telegram_chat_id),'America/Cancun');
  if v_client is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿Para qué cliente agendo la visita? Dime su nombre o teléfono.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  v_when := public.parse_relative_or_abs_es(coalesce(v_raw, v_texto, v_client), v_tz);
  if v_when is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿Para cuándo es la visita? Por ejemplo: «el sábado a las 4 de la tarde».','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  if v_when <= now() then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Esa fecha ya pasó. Dime una fecha futura para la visita.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  -- El lugar, si no vino en un campo, se saca del propio pedido («… en Portofino»).
  if v_lugar is null and v_texto <> '' then
    m := regexp_match(v_texto, '(?i)\sen\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9''. -]{2,40})\s*$');
    if m is not null then v_lugar := btrim(m[1]); end if;
  end if;

  v_accion := 'Visita' || coalesce(' en ' || v_lugar, '');
  v_digits := regexp_replace(v_client,'[^0-9]','','g');

     select l2.id,l2.stage into v_lead_id,v_current_stage from public.leads l2
      where l2.organization_id = v_org and l2.deleted_at is null
        and ( public.unaccent(coalesce(l2.name,'')) ilike public.unaccent('%'||v_client||'%')
              or (v_digits <> '' and regexp_replace(coalesce(l2.phone_normalized, l2.phone, ''),'[^0-9]','','g') = v_digits)
              or l2.id = public.fn_uuid_o_nulo(v_client) )
      order by l2.updated_at desc limit 1;
  if v_lead_id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré ese cliente. Dime su nombre o teléfono.')); end if;
  if coalesce(v_managed,false) then
    v_stage:=public.fn_resolve_appointment_stage(v_org,v_current_stage,coalesce(nullif(p_args->>'stage',''),nullif(p_args->>'etapa',''),public.fn_appointment_stage_from_text(v_org,v_texto)));
    if v_stage is null then return jsonb_build_object('ok',false,'needs_input','appointment_stage','reply',jsonb_build_object('text',
      '¿En qué etapa es la cita? Indica la etapa, el cliente y la fecha: '||array_to_string(public.fn_org_appointment_stages(v_org),' · ')||'.')); end if;
  end if;
  update public.leads l
     set visita_at = v_when,
         stage = v_stage,
         next_action = v_accion,
         next_action_at = v_when,
         next_action_date = to_char(v_when at time zone v_tz,'YYYY-MM-DD HH24:MI'),
         updated_at = now()
   where l.id=v_lead_id and l.organization_id=v_org and l.deleted_at is null
   returning l.id, l.name into v_lead_id, v_lead_name;

  if v_lead_id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré al cliente «'||v_client||'». Revisa el nombre o dime su teléfono.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  -- El lugar queda escrito en el expediente: es lo que el asesor va a buscar.
  if v_lugar is not null then
    perform public.bot_add_expediente_note(p_telegram_chat_id, v_lead_id::text, 'Visita agendada',
      'Visita en ' || v_lugar || ' — ' || public.fn_fecha_humana(v_when, v_tz, true), 'telegram');
  end if;

  v_legible := public.fn_fecha_humana(v_when, v_tz, true);
  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text',coalesce(v_stage,'Visita agendada')||' con **'||coalesce(v_lead_name,'el cliente')||'**'
        || coalesce(' en **'||v_lugar||'**','') || chr(10) || '«'||v_legible||'»' || chr(10)
        || case when coalesce(v_managed,false) then 'Copilot te recordará la cita 3 horas antes.' else public.fn_visita_avisos_texto(v_when) end,
    'parse_mode',null,'inline_keyboard',public._bot_kb_back()));
end;
$function$;
