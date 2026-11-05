-- A rename keeps the same clients and schedule; it is not a commercial move.
create or replace function public.fn_is_pipeline_label_rename(p_old jsonb,p_new jsonb) returns boolean
language sql stable set search_path=public,pg_temp as $fn$
 select coalesce(auth.role()='service_role'
  and (coalesce(nullif(current_setting('stratos.pipeline_label_rename',true),''),'{}')::jsonb->>'organization_id')=p_new->>'organization_id'
  and p_old->>'organization_id'=p_new->>'organization_id'
  and (coalesce(nullif(current_setting('stratos.pipeline_label_rename',true),''),'{}')::jsonb#>>array['names',p_old->>'stage'])=p_new->>'stage'
  and (p_old-'stage')=(p_new-'stage'),false)
$fn$;
revoke all on function public.fn_is_pipeline_label_rename(jsonb,jsonb) from public,anon;
grant execute on function public.fn_is_pipeline_label_rename(jsonb,jsonb) to authenticated,service_role;

-- Do not fabricate an appointment, handoff or score change when only a label changes.
-- Patch just the early guard, retaining each existing trigger function body.
do $patch$
declare r record; v_sql text;
begin
 for r in select p.oid from pg_proc p where p.pronamespace='public'::regnamespace
  and p.proname in ('fn_managed_appointment_date_guard','zoom_agendados_sync_from_lead','fn_iagents_lead_handoff','fn_leads_score_trigger')
  and p.prorettype='trigger'::regtype loop
  v_sql:=pg_get_functiondef(r.oid);
  if strpos(v_sql,'fn_is_pipeline_label_rename')=0 then
   v_sql:=regexp_replace(v_sql,'\mBEGIN\M',$skip$BEGIN
  IF TG_OP='UPDATE' THEN
    IF public.fn_is_pipeline_label_rename(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
  END IF;$skip$,'i');
   execute v_sql;
  end if;
 end loop;
end $patch$;

create or replace trigger leads_updated_at before update on public.leads for each row
 when (not public.fn_is_pipeline_label_rename(to_jsonb(old),to_jsonb(new))) execute function public.set_updated_at();

-- Old installed clients and outstanding assistant confirmations may still send
-- a former name. Resolve only explicit aliases belonging to this organization.
create or replace function public.fn_pipeline_stage_alias(p_org uuid,p_name text) returns text
language sql stable set search_path=public,pg_temp as $fn$
 select case when count(distinct s->>'name')=1 then min(s->>'name') end
 from public.organizations o
 cross join lateral jsonb_each_text(case when jsonb_typeof(o.meta_config#>'{crm,stageAliases}')='object'
   then o.meta_config#>'{crm,stageAliases}' else '{}'::jsonb end) a
 cross join lateral jsonb_array_elements(case when jsonb_typeof(o.meta_config#>'{crm,pipeline}')='array'
   then o.meta_config#>'{crm,pipeline}' else '[]'::jsonb end) s
 where o.id=p_org and s->>'name'=a.value
  and public.unaccent(lower(btrim(a.key)))=public.unaccent(lower(btrim(p_name)))
  and not exists(select 1 from jsonb_array_elements(o.meta_config#>'{crm,pipeline}') n
    where public.unaccent(lower(n->>'name'))=public.unaccent(lower(btrim(p_name))))
$fn$;
revoke all on function public.fn_pipeline_stage_alias(uuid,text) from public,anon;
grant execute on function public.fn_pipeline_stage_alias(uuid,text) to authenticated,service_role;

create or replace function public.fn_lead_pipeline_stage_alias() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_name text;
begin
 if tg_op='UPDATE' then
  if public.fn_is_pipeline_label_rename(to_jsonb(old),to_jsonb(new)) then return new; end if;
 end if;
 if tg_op='INSERT' then
  perform 1 from public.organizations where id=new.organization_id for key share;
 end if;
 v_name:=public.fn_pipeline_stage_alias(new.organization_id,new.stage);
 if v_name is not null then new.stage:=v_name; end if;
 return new;
end $fn$;
create or replace trigger leads_stage_alias before insert or update of stage on public.leads
 for each row execute function public.fn_lead_pipeline_stage_alias();

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
    v_appointment:=public.fn_org_appointment_stage(p_organization_id);
    if p_copilot is null and v_renames ? v_appointment then
      p_copilot:=jsonb_build_object('appointment_stage',v_renames->>v_appointment);
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
      'pipelineUpdatedAt',clock_timestamp(),'pipelineUpdatedBy',p_actor_id)
      ||case when v_renames<>'{}'::jsonb then jsonb_build_object('stageAliases',v_aliases) else '{}'::jsonb end),updated_at=clock_timestamp()
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
    'preserved_stages',v_preserved,'renamed_stages',v_renames,'renamed_clients',v_renamed_clients);
end $function$;

revoke all on function public.fn_company_pipeline_publish(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.fn_company_pipeline_publish(uuid,uuid,timestamptz,jsonb,jsonb) to service_role;


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
end $function$
;
