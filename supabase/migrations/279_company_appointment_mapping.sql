-- Appointment meaning is independent of its display name. Legacy tenants remain unchanged.
create or replace function public.fn_org_appointment_stage(p_org uuid) returns text
language sql stable set search_path=public,pg_temp as $fn$
 select case when coalesce(o.meta_config->'crm','{}'::jsonb) ? 'appointmentStage'
   then nullif(o.meta_config#>>'{crm,appointmentStage}','')
   else coalesce(c.zoom_stage_label,case when exists(select 1 from public.fn_effective_org_stages(p_org) s where s.nombre='Zoom Agendado') then 'Zoom Agendado' end) end
 from public.organizations o left join public.proactive_config c on c.organization_id=o.id where o.id=p_org
$fn$;
revoke all on function public.fn_org_appointment_stage(uuid) from public,anon;
grant execute on function public.fn_org_appointment_stage(uuid) to authenticated,service_role;

-- Called only inside a server-authorized, locked publish/provision transaction.
create or replace function public.fn_company_appointment_config(p_org uuid,p_stage text) returns void
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_managed boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
 select meta_config#>>'{onboarding,createdFrom}'='whatsapp_admin' into v_managed from public.organizations where id=p_org;
 if p_stage is not null then
  select nombre into p_stage from public.fn_effective_org_stages(p_org)
   where lower(nombre)=lower(regexp_replace(btrim(p_stage),'\s+',' ','g')) limit 1;
  if not found then raise exception 'Elige una etapa del pipeline para la cita.' using errcode='22023'; end if;
 end if;
 update public.organizations set meta_config=jsonb_set(coalesce(meta_config,'{}'),'{crm}',
   coalesce(meta_config->'crm','{}')||jsonb_build_object('appointmentStage',p_stage,'copilotReminders',coalesce(v_managed,false))),updated_at=clock_timestamp() where id=p_org;
 if coalesce(v_managed,false) then
  insert into public.proactive_config(organization_id,enabled,shadow_mode,zoom_stage_label,zoom_reminder_hours,terminal_stages)
   values(p_org,true,false,coalesce(p_stage,'__no_appointment__'),3,array['Ganado','Perdido'])
   on conflict(organization_id) do update set zoom_stage_label=excluded.zoom_stage_label;
 else
  update public.proactive_config set zoom_stage_label=coalesce(p_stage,'__no_appointment__') where organization_id=p_org;
 end if;
end $fn$;
revoke all on function public.fn_company_appointment_config(uuid,text) from public,anon,authenticated;
grant execute on function public.fn_company_appointment_config(uuid,text) to service_role;

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

CREATE OR REPLACE FUNCTION public.fn_provision_company(p_actor uuid, p_request_id uuid, p_name text, p_slug text, p_seats integer, p_features jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_operator public.platform_admins%rowtype;
  v_org public.organizations%rowtype;
  v_count integer;
  v_event uuid;
  v_features jsonb;
  v_meta jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Sólo el servidor puede dar de alta empresas.' using errcode = '42501';
  end if;
  select * into v_operator from public.platform_admins where user_id = p_actor and active is true for update;
  if not found or exists(select 1 from public.profiles where id = p_actor and active is false) then
    raise exception 'Operador no autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null or length(btrim(p_name)) not between 2 and 120
     or p_name is null or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(p_slug) > 64 or p_seats is null or p_seats not between 1 and 1000 then
    raise exception 'Revisa nombre, identificador y licencias de la empresa.' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 719002));
  select * into v_org from public.organizations where id = p_request_id;
  if found then
    if v_org.meta_config #>> '{onboarding,createdBy}' is distinct from p_actor::text
       or v_org.parent_organization_id is distinct from v_operator.scope_organization_id then
      raise exception 'Este intento pertenece a otro operador.' using errcode = '42501';
    end if;
    if v_org.name is distinct from btrim(p_name) or v_org.slug is distinct from p_slug or v_org.seats is distinct from p_seats then
      raise exception 'Este intento ya creó una empresa con otros datos. Actualiza la lista para continuar.' using errcode = '23514';
    end if;
    return jsonb_build_object('organization', to_jsonb(v_org), 'replayed', true);
  end if;
  if v_operator.scope_organization_id is not null then
    -- El candado por contenedor también serializa operadores del mismo partner.
    perform 1 from public.organizations where id = v_operator.scope_organization_id and active is true for update;
    if not found then raise exception 'El partner está inactivo.' using errcode = '42501'; end if;
    select count(*) into v_count from public.organizations where parent_organization_id = v_operator.scope_organization_id;
    if v_operator.company_limit is null or v_count >= v_operator.company_limit then
      raise exception 'Se alcanzó el cupo de empresas del partner.' using errcode = '23514';
    end if;
    v_features := '{"teamAdmin":true,"mktModule":false,"comandoDirectivo":false}'::jsonb;
  else
    if p_features is null or jsonb_typeof(p_features) <> 'object'
       or (p_features - array['teamAdmin','mktModule','comandoDirectivo']) <> '{}'::jsonb
       or jsonb_typeof(p_features->'teamAdmin') is distinct from 'boolean'
       or jsonb_typeof(p_features->'mktModule') is distinct from 'boolean'
       or jsonb_typeof(p_features->'comandoDirectivo') is distinct from 'boolean' then
      raise exception 'Módulos iniciales inválidos.' using errcode = '23514';
    end if;
    v_features := p_features;
  end if;
  v_meta := jsonb_build_object(
    'onboarding', jsonb_build_object('status','draft','createdFrom','whatsapp_admin','createdBy',p_actor,'createdAt',now()),
    'features', v_features || '{"crm":true,"copilotModule":true,"whatsappSignup":true,"whatsappModule":false,"whatsappChat":false,"procesoGuiado":false}'::jsonb
  );
  v_meta:=v_meta||jsonb_build_object('crm',jsonb_build_object('pipeline','[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Reunión","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Ganado","color":"#34D399"},{"name":"Perdido","color":"#F87171"}]'::jsonb));
  insert into public.organizations(id,name,slug,seats,plan,active,subscription_status,meta_config,parent_organization_id)
    values(p_request_id,btrim(p_name),p_slug,p_seats,'custom',true,'trial',v_meta,v_operator.scope_organization_id)
    returning * into v_org;
  perform public.fn_company_appointment_config(v_org.id,'Reunión');
  select * into v_org from public.organizations where id=p_request_id;
  insert into public.platform_admin_events(event_type,actor_user_id,partner_organization_id,organization_id,payload,notification_status)
    values('company_created',p_actor,v_operator.scope_organization_id,v_org.id,
      jsonb_build_object('organization_name',v_org.name,'organization_id',v_org.id,'user_seats',v_org.seats), 'not_configured')
    returning id into v_event;
  return jsonb_build_object('organization',to_jsonb(v_org),'event_id',v_event,'replayed',false);
end;
$function$;

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

  select exists(select 1 from public.fn_effective_org_stages(p_org)
                 where organization_id = p_org and activo and deleted_at is null)
    into v_has;

  if not v_has then return null; end if;
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
