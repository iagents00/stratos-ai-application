-- Self-service enrollment for NEW Infobip read-only channels only.
-- Does not replace ingestion, existing routes, RLS, triggers or workflows.
-- Rollback: stop using these RPCs; disable only the newly enrolled route.
set local lock_timeout='2s';
set local statement_timeout='30s';

create or replace function public.fn_whatsapp_portal_assert_access(p_actor_id uuid,p_org uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_scope uuid;
begin
  select scope_organization_id into v_scope from public.platform_admins
    where user_id=p_actor_id and active;
  if not found or exists(select 1 from public.profiles where id=p_actor_id and not active) then
    raise exception 'Administración de plataforma requerida' using errcode='42501';
  end if;
  if not exists(select 1 from public.organizations where id=p_org and active
      and (v_scope is null or parent_organization_id=v_scope)
      and coalesce(meta_config#>>'{platform,kind}','')<>'partner') then
    raise exception 'La empresa no está disponible para este administrador' using errcode='42501';
  end if;
end;
$$;

create or replace function public.fn_whatsapp_portal_start(
  p_actor_id uuid,p_org uuid,p_advisor uuid,p_phone text,p_owner_type text
) returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_phone text; v_run public.whatsapp_onboarding_runs%rowtype;
begin
  perform public.fn_whatsapp_portal_assert_access(p_actor_id,p_org);
  v_phone:=public.fn_phone_canon(p_phone);
  if v_phone is null or v_phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'Escribe un número internacional válido'; end if;
  if p_owner_type not in ('company','advisor') then raise exception 'Propietario inválido'; end if;
  if not exists(select 1 from public.profiles where id=p_advisor and organization_id=p_org
      and active and role in ('admin','director','ceo','asesor')) then
    raise exception 'Selecciona un asesor activo de esta empresa';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stratos-wa:'||v_phone,0));
  if exists(select 1 from public.whatsapp_numero_asesor c
      left join public.whatsapp_readonly_ingestion_routes r on r.channel_id=c.id
      where public.fn_phone_canon(c.numero_whatsapp)=v_phone
        and (c.organization_id<>p_org or coalesce(r.protected,false)
             or c.proveedor is distinct from 'infobip' or c.asesor_id is distinct from p_advisor)) then
    raise exception 'El número ya tiene una conexión diferente o protegida; no se modificó' using errcode='42501';
  end if;
  select * into v_run from public.whatsapp_onboarding_runs
    where organization_id=p_org and public.fn_phone_canon(phone_e164)=v_phone
      and provider_state->>'mode'='infobip_portal' and status<>'disconnected'
    order by created_at desc limit 1 for update;
  if found then
    if v_run.advisor_id is distinct from p_advisor then raise exception 'El proceso existente tiene otro asesor asignado'; end if;
  else
    insert into public.whatsapp_onboarding_runs(organization_id,requested_by,advisor_id,owner_type,phone_e164,status,provider_state)
      values(p_org,p_actor_id,p_advisor,p_owner_type,'+'||v_phone,'waiting_customer','{"mode":"infobip_portal"}') returning * into v_run;
  end if;
  return to_jsonb(v_run);
end;
$$;

create or replace function public.fn_whatsapp_portal_prepare(
  p_actor_id uuid,p_run_id uuid,p_sender_phone text
) returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare
  v_run public.whatsapp_onboarding_runs%rowtype;
  v_channel public.whatsapp_numero_asesor%rowtype;
  v_advisor public.profiles%rowtype;
  v_phone text;
  v_matches uuid[];
begin
  select * into v_run from public.whatsapp_onboarding_runs where id=p_run_id for update;
  if not found then raise exception 'Proceso no encontrado'; end if;
  perform public.fn_whatsapp_portal_assert_access(p_actor_id,v_run.organization_id);
  if v_run.provider_state->>'mode' is distinct from 'infobip_portal' then
    raise exception 'Este proceso no corresponde al registro por Infobip';
  end if;
  v_phone:=public.fn_phone_canon(v_run.phone_e164);
  if v_phone is null or v_phone !~ '^[1-9][0-9]{7,14}$'
      or public.fn_phone_canon(p_sender_phone) is distinct from v_phone then
    raise exception 'Infobip no confirmó el mismo número del proceso';
  end if;
  -- Serialize aliases (Mexico 52/521 included) across organizations and retries.
  perform pg_advisory_xact_lock(hashtextextended('stratos-wa:'||v_phone,0));
  select * into v_advisor from public.profiles where id=v_run.advisor_id
    and organization_id=v_run.organization_id and active
    and role in ('admin','director','ceo','asesor');
  if not found then raise exception 'Selecciona un asesor activo de esta empresa'; end if;

  select array_agg(id order by id) into v_matches from public.whatsapp_numero_asesor
    where public.fn_phone_canon(numero_whatsapp)=v_phone;
  if cardinality(v_matches)>1 then raise exception 'El número tiene asignaciones duplicadas; requiere revisión'; end if;
  if cardinality(v_matches)=1 then
    select * into v_channel from public.whatsapp_numero_asesor where id=v_matches[1] for update;
    if v_channel.organization_id is distinct from v_run.organization_id then
      raise exception 'El número pertenece a otra empresa; no se cambió su conexión' using errcode='42501';
    end if;
    if exists(select 1 from public.whatsapp_readonly_ingestion_routes where channel_id=v_channel.id and protected)
        or v_channel.proveedor is distinct from 'infobip' then
      raise exception 'Esta conexión existente está protegida; no se modificó' using errcode='42501';
    end if;
    if not v_channel.active or v_channel.asesor_id is distinct from v_advisor.id then
      raise exception 'La asignación existente no coincide; revisa empresa y asesor antes de continuar';
    end if;
  else
    insert into public.whatsapp_numero_asesor(
      organization_id,numero_whatsapp,proveedor,asesor_id,asesor_name,
      platform_type,onboarded_via,onboarded_at,estado_conexion,active
    ) values(v_run.organization_id,'+'||v_phone,'infobip',v_advisor.id,v_advisor.name,
      'CLOUD_API','manual',now(),'desconocido',true) returning * into v_channel;
  end if;
  perform public.fn_activate_whatsapp_readonly(v_run.organization_id);
  perform public.fn_set_whatsapp_readonly_route(v_run.organization_id,v_channel.id,true);
  -- No credentials or provider request bodies are persisted here.
  update public.whatsapp_onboarding_runs set provider_state=jsonb_set(
      coalesce(provider_state,'{}'::jsonb),'{receiver}',
      coalesce(provider_state->'receiver','{}'::jsonb)||jsonb_build_object('channel_id',v_channel.id),true)
    where id=v_run.id and organization_id=v_run.organization_id;
  return jsonb_build_object('channel_id',v_channel.id,'organization_id',v_run.organization_id,
    'advisor_id',v_advisor.id,'phone',v_phone);
end;
$$;

create or replace function public.fn_whatsapp_portal_probe(p_actor_id uuid,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare
  v_run public.whatsapp_onboarding_runs%rowtype;
  v_channel public.whatsapp_numero_asesor%rowtype;
  v_in public.whatsapp_inbox%rowtype;
  v_echo timestamptz;
  v_assigned boolean:=false;
  v_ready boolean:=false;
begin
  select * into v_run from public.whatsapp_onboarding_runs where id=p_run_id for update;
  if not found then raise exception 'Proceso no encontrado'; end if;
  perform public.fn_whatsapp_portal_assert_access(p_actor_id,v_run.organization_id);
  select c.* into v_channel from public.whatsapp_numero_asesor c
    join public.whatsapp_readonly_ingestion_routes r on r.channel_id=c.id and r.enabled and not r.protected
    join public.profiles p on p.id=c.asesor_id and p.organization_id=c.organization_id and p.active
    where c.id::text=(v_run.provider_state#>>'{receiver,channel_id}')
      and c.organization_id=v_run.organization_id and c.asesor_id=v_run.advisor_id
      and c.active and c.proveedor='infobip'
      and public.fn_phone_canon(c.numero_whatsapp)=public.fn_phone_canon(v_run.phone_e164);
  if not found then raise exception 'Primero prepara la recepción de este número'; end if;
  v_ready:=v_run.provider_state#>>'{receiver,configured_at}' is not null;
  select * into v_in from public.whatsapp_inbox
    where organization_id=v_run.organization_id and channel_id=v_channel.id
      and source='infobip' and processing_error is null and processed_at is not null
      and created_at>=v_run.created_at and lead_id is not null
    order by created_at desc limit 1;
  if found then
    select exists(select 1 from public.leads where id=v_in.lead_id
      and organization_id=v_run.organization_id and asesor_id=v_run.advisor_id
      and deleted_at is null) into v_assigned;
  end if;
  select max(message_created_at) into v_echo from public.whatsapp_messages
    where organization_id=v_run.organization_id and channel_id=v_channel.id
      and provider='infobip' and direction='out' and created_at>=v_run.created_at;
  if v_ready and v_in.id is not null and v_assigned then
    update public.whatsapp_numero_asesor set estado_conexion='conectado',
      verificado_at=now(),ultimo_error=null where id=v_channel.id and organization_id=v_run.organization_id;
    update public.whatsapp_onboarding_runs set status='active',last_error=null,
      verified_at=coalesce(verified_at,now()) where id=v_run.id and organization_id=v_run.organization_id;
  end if;
  return jsonb_build_object('receiver_ready',v_ready,'inbound',v_in.id is not null,
    'lead',v_assigned,'advisor',v_assigned,'isolation',v_assigned,
    'received_at',v_in.created_at,'lead_id',case when v_assigned then v_in.lead_id end,
    'echo_received_at',v_echo,'status',case when v_ready and v_assigned then 'active' else 'ready_to_test' end);
end;
$$;

revoke all on function public.fn_whatsapp_portal_assert_access(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fn_whatsapp_portal_start(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.fn_whatsapp_portal_prepare(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fn_whatsapp_portal_probe(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_whatsapp_portal_assert_access(uuid,uuid) to service_role;
grant execute on function public.fn_whatsapp_portal_start(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.fn_whatsapp_portal_prepare(uuid,uuid,text) to service_role;
grant execute on function public.fn_whatsapp_portal_probe(uuid,uuid) to service_role;
