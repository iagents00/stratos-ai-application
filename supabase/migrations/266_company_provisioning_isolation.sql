-- Altas seguras: sólo app_metadata (escrita por Auth Admin) puede asignar
-- una empresa existente. user_metadata es editable por el usuario.
-- No cambia datos, membresías ni configuraciones de empresas existentes.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_org uuid;
  v_role text;
  v_name text;
  v_org_name text;
  v_slug text;
  v_recovery text;
begin
  v_name := coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_recovery := coalesce(nullif(lower(btrim(new.raw_user_meta_data->>'recovery_email')), ''), lower(new.email));
  v_org := nullif(new.raw_app_meta_data->>'stratos_organization_id', '')::uuid;
  if v_org is not null then
    if not exists(select 1 from public.organizations where id = v_org and active is true) then
      raise exception 'La empresa de destino no está activa.' using errcode = '23514';
    end if;
    v_role := new.raw_app_meta_data->>'stratos_role';
    if v_role is null or v_role not in ('admin','director','asesor','super_admin','ceo','marketing','colaborador') then
      raise exception 'Rol de alta inválido.' using errcode = '23514';
    end if;
  else
    -- Un registro independiente obtiene una empresa propia; jamás toma
    -- organization_id ni role desde metadata controlada por el navegador.
    v_org_name := coalesce(nullif(btrim(new.raw_user_meta_data->>'organization_name'), ''), v_name || ' Workspace');
    v_slug := 'workspace-' || new.id::text;
    insert into public.organizations (name, slug, plan, seats, trial_ends_at)
      values (v_org_name, v_slug, 'starter', 5, now() + interval '14 days') returning id into v_org;
    v_role := 'admin';
  end if;
  insert into public.profiles (id, name, role, organization_id, recovery_email, active)
    values (new.id, v_name, v_role, v_org, v_recovery, true);
  return new;
end;
$$;

-- Una empresa se crea con cupo y bitácora en la misma transacción.
-- La clave estable del intento permite recuperarse de respuestas perdidas.
create or replace function public.fn_provision_company(
  p_actor uuid, p_request_id uuid, p_name text, p_slug text,
  p_seats integer, p_features jsonb
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
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
    'features', v_features || '{"crm":true,"whatsappSignup":true,"whatsappModule":false,"whatsappChat":false,"procesoGuiado":false}'::jsonb
  );
  insert into public.organizations(id,name,slug,seats,plan,active,subscription_status,meta_config,parent_organization_id)
    values(p_request_id,btrim(p_name),p_slug,p_seats,'custom',true,'trial',v_meta,v_operator.scope_organization_id)
    returning * into v_org;
  insert into public.platform_admin_events(event_type,actor_user_id,partner_organization_id,organization_id,payload,notification_status)
    values('company_created',p_actor,v_operator.scope_organization_id,v_org.id,
      jsonb_build_object('organization_name',v_org.name,'organization_id',v_org.id,'user_seats',v_org.seats), 'not_configured')
    returning id into v_event;
  return jsonb_build_object('organization',to_jsonb(v_org),'event_id',v_event,'replayed',false);
end;
$$;
revoke all on function public.fn_provision_company(uuid,uuid,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.fn_provision_company(uuid,uuid,text,text,integer,jsonb) to service_role;
