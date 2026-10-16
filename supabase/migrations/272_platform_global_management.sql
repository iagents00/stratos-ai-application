-- Gestión global explícita desde la consola raíz. No amplía ninguna policy RLS,
-- no mueve datos comerciales ni reescribe configuración de tenants históricos.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Definiciones comparadas con producción antes de preparar esta migración.
-- Los JWT emitidos antes de una baja dejan de resolver tenant/nombre/rol en
-- las policies existentes; no se amplía ninguna policy ni ningún rol.
create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid() and active is true;
$$;
create or replace function public.current_user_name()
returns text language sql stable security definer set search_path = public as $$
  select name from public.profiles where id = auth.uid() and active is true;
$$;
create or replace function public.is_admin_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active is true
    and role in ('super_admin','admin','ceo','director'));
$$;
create or replace function public.is_marketing_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active is true
    and role in ('super_admin','admin','marketing','colaborador'));
$$;

-- Auth ban + refresh revocation no invalidan por sí solos un JWT firmado.
-- Este hook también cubre RPCs SECURITY DEFINER invocadas por PostgREST.
-- No afecta signup sin perfil, anónimos ni trabajos service_role.
create or replace function public.fn_platform_require_active_actor()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.role() = 'authenticated' and exists(select 1 from public.profiles where id = auth.uid() and active is false) then
    raise exception 'La cuenta está desactivada. Contacta al administrador.' using errcode = '42501';
  end if;
end $$;
revoke all on function public.fn_platform_require_active_actor() from public;
grant execute on function public.fn_platform_require_active_actor() to anon, authenticated, service_role;
do $$ declare v_existing text;
begin
  select substring(setting from length('pgrst.db_pre_request=') + 1) into v_existing
    from pg_db_role_setting s cross join lateral unnest(s.setconfig) setting
    where s.setrole in (0,(select oid from pg_roles where rolname='authenticator'))
      and s.setdatabase in (0,(select oid from pg_database where datname=current_database()))
      and setting like 'pgrst.db_pre_request=%'
      and substring(setting from length('pgrst.db_pre_request=') + 1) not in ('','public.fn_platform_require_active_actor')
    limit 1;
  if v_existing is not null then
    raise exception 'Ya existe un hook PostgREST. Debe integrarse explícitamente antes de instalar gestión global.';
  end if;
  alter role authenticator set pgrst.db_pre_request = 'public.fn_platform_require_active_actor';
end $$;

-- Defensa para tablas/realtime cuyas policies históricas usan id u org desde
-- profiles directamente. Lista explícita contrastada con pg_policies live;
-- ausencia de una tabla histórica no impide instalar esta migración.
create or replace function public.fn_platform_current_actor_active()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active is true);
$$;
revoke all on function public.fn_platform_current_actor_active() from public, anon;
grant execute on function public.fn_platform_current_actor_active() to authenticated, service_role;
do $$ declare v_table text;
begin
  foreach v_table in array array[
    'access_log','auto_facts','client_objectives','client_updates','fin_invoices','fin_movements','fin_payroll',
    'informe_notas','lead_assignment_pool_members','lead_assignment_pools','org_brain_docs','org_stages','patient_consents',
    'team_chat_channels','team_chat_messages','team_documents','whatsapp_inbox','whatsapp_numero_asesor',
    'device_tokens','project_copilot_receipts','push_subscriptions','team_chat_reads','whatsapp_reads',
    'leads','lead_tasks','lead_assignments','lead_events','lead_playbook_items','lead_scoring_history'
  ] loop
    if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity) then
      execute format('drop policy if exists stratos_platform_active_actor on public.%I',v_table);
      execute format('create policy stratos_platform_active_actor on public.%I as restrictive for all to authenticated using(public.fn_platform_current_actor_active()) with check(public.fn_platform_current_actor_active())',v_table);
    end if;
  end loop;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='profiles' and c.relrowsecurity) then
    drop policy if exists stratos_platform_active_actor_update on public.profiles;
    create policy stratos_platform_active_actor_update on public.profiles as restrictive for update to authenticated
      using(public.fn_platform_current_actor_active()) with check(public.fn_platform_current_actor_active());
  end if;
end $$;

-- El chat de Telegram puede tener historia de la empresa anterior. No se
-- cambia telegram_chat_id: su trigger histórico trasladaría datos de negocio.
create or replace function public.get_my_telegram_activity(p_limit integer default 20)
returns table(id integer, occurred_at timestamptz, role text, content text)
language plpgsql stable security definer set search_path = public as $$
declare v_chat_id bigint;
begin
  select p.telegram_chat_id into v_chat_id from public.profiles p where p.id=auth.uid() and p.active is true limit 1;
  if v_chat_id is null or exists(select 1 from auth.users u where u.id=auth.uid()
      and u.raw_app_meta_data->>'stratos_legacy_telegram_history_blocked'='true') then return; end if;
  return query select h.id,h.created_at,coalesce(h.message->>'type','unknown'),coalesce(h.message->>'content','')
    from public.n8n_chat_histories h where h.session_id='tg:'||v_chat_id::text
    order by h.id desc limit least(greatest(p_limit,1),100);
end $$;

create or replace function public.get_my_copilot_activity(p_limit integer default 40)
returns table(id bigint, occurred_at timestamptz, role text, content text, media_path text, media_type text, meta jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_chat_id bigint;
begin
  select p.telegram_chat_id into v_chat_id from public.profiles p where p.id=auth.uid() and p.active is true limit 1;
  if v_chat_id is null then return; end if;
  return query
  with crudo as (
    select t.id,t.created_at,t.role,t.content,t.media_path,t.media_type,t.meta from public.tg_bot_activity t
    where t.telegram_chat_id=v_chat_id and (t.organization_id=public.current_organization_id()
      or (t.organization_id is null and not exists(select 1 from auth.users u where u.id=auth.uid()
        and u.raw_app_meta_data->>'stratos_legacy_telegram_history_blocked'='true')))
    order by t.id desc limit least(greatest(p_limit,1),200)+40
  ), marcado as (
    select c.*,(
      exists(select 1 from crudo o where o.id<>c.id and o.role=c.role
        and abs(extract(epoch from(o.created_at-c.created_at)))<=180
        and public._copilot_msg_same(o.content,c.content)
        and ((c.role='user' and o.id<c.id) or(c.role<>'user' and (
          length(coalesce(o.content,''))>length(coalesce(c.content,''))
          or(length(coalesce(o.content,''))=length(coalesce(c.content,'')) and o.id<c.id)))))
      or(c.role='user' and exists(select 1 from crudo a where a.role<>'user' and a.created_at=c.created_at and a.id>c.id and a.id<=c.id+3)
        and exists(select 1 from crudo u where u.role='user' and u.id<c.id and u.created_at>=c.created_at-interval '5 minutes' and u.created_at<c.created_at))
    ) as es_duplicado,
    coalesce((select min(o.id) from crudo o where o.role=c.role and abs(extract(epoch from(o.created_at-c.created_at)))<=180
      and public._copilot_msg_same(o.content,c.content)),c.id) as orden_id
    from crudo c
  )
  select m.id,m.created_at,m.role,m.content,m.media_path,m.media_type,m.meta from marcado m
    where not m.es_duplicado order by m.orden_id desc,m.id desc limit least(greatest(p_limit,1),200);
end $$;

create or replace function public.fn_platform_assert_root_actor(p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Sólo el servidor puede administrar la plataforma.' using errcode = '42501';
  end if;
  perform 1 from public.platform_admins
    where user_id = p_actor_id and active is true and scope_organization_id is null for update;
  if not found or exists(select 1 from public.profiles where id = p_actor_id and active is false) then
    raise exception 'El operador no es administrador raíz activo.' using errcode = '42501';
  end if;
end $$;
revoke all on function public.fn_platform_assert_root_actor(uuid) from public, anon, authenticated;
grant execute on function public.fn_platform_assert_root_actor(uuid) to service_role;

-- También las altas/reactivaciones en tenants históricos respetan sus licencias.
-- Las cuentas y empresas existentes no se modifican ni se desactivan al instalar.
create or replace function public.fn_guard_platform_company_capacity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org public.organizations%rowtype; v_count integer;
begin
  if new.active is distinct from true or new.organization_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.active is true and old.organization_id = new.organization_id then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 719001));
  select * into v_org from public.organizations where id = new.organization_id;
  if not found or v_org.active is distinct from true then
    raise exception 'La empresa de destino no está activa.' using errcode = '23514';
  end if;
  select count(*) into v_count from public.profiles where organization_id = new.organization_id and active is true;
  if v_count >= v_org.seats then
    raise exception 'La empresa ya utiliza todas sus licencias.' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace trigger zy_guard_platform_company_capacity
before insert or update on public.profiles for each row
execute function public.fn_guard_platform_company_capacity();
revoke all on function public.fn_guard_platform_company_capacity() from public, anon, authenticated;

create or replace function public.fn_platform_update_user(
  p_actor_id uuid, p_user_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_role text, p_active boolean, p_organization_id uuid,
  p_is_marketing_admin boolean, p_crm_only boolean, p_area text,
  p_confirm_move boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_source uuid;
  v_lock uuid;
  v_destination public.organizations%rowtype;
  v_move boolean;
  v_access_change boolean;
  v_auth auth.users%rowtype;
  v_auth_meta jsonb;
  v_banned_until timestamptz;
  v_sessions_revoked integer := 0;
begin
  perform public.fn_platform_assert_root_actor(p_actor_id);
  if p_user_id is null or p_expected_updated_at is null or p_organization_id is null
     or p_name is null or length(btrim(p_name)) not between 1 and 120
     or p_role is null or p_role not in ('super_admin','admin','director','ceo','asesor','marketing','colaborador')
     or p_active is null or p_is_marketing_admin is null or p_crm_only is null
     or length(coalesce(p_area,'')) > 120 then
    raise exception 'Datos de usuario inválidos.' using errcode = '22023';
  end if;
  if p_is_marketing_admin and (p_crm_only or p_role not in ('super_admin','admin','director','ceo','marketing')) then
    raise exception 'El acceso de líder de Marketing requiere un rol compatible y acceso completo.' using errcode = '22023';
  end if;
  select organization_id into v_source from public.profiles where id = p_user_id;
  if not found then raise exception 'El usuario no existe.' using errcode = 'P0002'; end if;
  -- Mismo orden para dos movimientos opuestos y para cambios de cupo.
  for v_lock in select distinct value from unnest(array[v_source,p_organization_id]) value order by value loop
    perform pg_advisory_xact_lock(hashtextextended(v_lock::text, 719001));
  end loop;
  select * into v_before from public.profiles where id = p_user_id for update;
  if v_before.organization_id is distinct from v_source or v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'El usuario cambió. Actualiza antes de guardar.' using errcode = '40001';
  end if;
  v_move := v_before.organization_id is distinct from p_organization_id;
  v_access_change := v_move or v_before.role is distinct from p_role or v_before.active is distinct from p_active
    or v_before.is_marketing_admin is distinct from p_is_marketing_admin or v_before.crm_only is distinct from p_crm_only;
  if v_access_change and (p_user_id = p_actor_id or exists(
      select 1 from public.platform_admins where user_id = p_user_id and active is true)) then
    raise exception 'No puedes cambiar el acceso de tu propia cuenta ni de un operador de plataforma desde este editor.' using errcode = '42501';
  end if;
  if v_move and p_confirm_move is distinct from true then
    raise exception 'Confirma el cambio de empresa. Los datos e historiales permanecen en la empresa original.' using errcode = '22023';
  end if;
  if v_move then
    -- No consumir, trasladar ni borrar confirmaciones de negocio. El operador
    -- debe resolverlas en su empresa antes de cambiar la pertenencia.
    if to_regclass('public.bot_pending_actions') is not null then
      if exists(select 1 from public.bot_pending_actions where (asesor_id=p_user_id or telegram_chat_id=v_before.telegram_chat_id)
        and consumed_at is null and expires_at>clock_timestamp()) then
        raise exception 'Resuelve las acciones pendientes de Telegram antes de mover este usuario.' using errcode='23514';
      end if;
    end if;
    if to_regclass('public.bot_pending_confirm') is not null then
      if exists(select 1 from public.bot_pending_confirm where telegram_chat_id=v_before.telegram_chat_id) then
        raise exception 'Resuelve la confirmación pendiente de Telegram antes de mover este usuario.' using errcode='23514';
      end if;
    end if;
  end if;
  select * into v_destination from public.organizations where id = p_organization_id;
  if not found then raise exception 'La empresa de destino no existe.' using errcode = 'P0002'; end if;
  if p_active and (v_move or v_before.active is distinct from true) and v_destination.active is distinct from true then
    raise exception 'La empresa de destino no está activa.' using errcode = '23514';
  end if;
  if v_before.active is true and v_before.role in ('admin','super_admin')
     and (v_move or not p_active or p_role not in ('admin','super_admin'))
     and not exists(select 1 from public.profiles where organization_id = v_source
       and id <> p_user_id and active is true and role in ('admin','super_admin')) then
    raise exception 'La empresa debe conservar al menos un administrador activo.' using errcode = '23514';
  end if;
  select * into v_auth from auth.users where id = p_user_id for update;
  if not found then raise exception 'No existe la identidad de acceso de este usuario.' using errcode = '23514'; end if;
  v_auth_meta := coalesce(v_auth.raw_app_meta_data,'{}'::jsonb)
    || jsonb_build_object('stratos_organization_id',p_organization_id,'stratos_role',p_role);
  if v_auth_meta ? 'organization_id' then v_auth_meta := v_auth_meta || jsonb_build_object('organization_id',p_organization_id); end if;
  if v_auth_meta ? 'role' then v_auth_meta := v_auth_meta || jsonb_build_object('role',p_role); end if;
  if v_move then
    v_auth_meta := v_auth_meta || jsonb_build_object('stratos_last_organization_change_at',clock_timestamp(),
      'stratos_legacy_telegram_history_blocked',true);
  end if;
  v_banned_until := v_auth.banned_until;
  if not p_active and v_auth_meta->>'stratos_platform_disabled' is distinct from 'true' then
    v_banned_until := clock_timestamp() + interval '100 years';
    v_auth_meta := v_auth_meta || jsonb_build_object('stratos_platform_disabled',true,
      'stratos_platform_previous_banned_until',v_auth.banned_until,
      'stratos_platform_applied_banned_until',v_banned_until);
  elsif p_active and v_auth_meta->>'stratos_platform_disabled' = 'true' then
    -- Una sanción cambiada desde otro administrador mientras la cuenta estaba
    -- de baja sigue vigente. Sólo deshacemos exactamente nuestro propio ban.
    if v_auth.banned_until = nullif(v_auth_meta->>'stratos_platform_applied_banned_until','')::timestamptz then
      v_banned_until := nullif(v_auth_meta->>'stratos_platform_previous_banned_until','')::timestamptz;
    end if;
    v_auth_meta := v_auth_meta - 'stratos_platform_disabled' - 'stratos_platform_previous_banned_until'
      - 'stratos_platform_applied_banned_until';
  end if;
  update public.profiles set name = btrim(p_name), role = p_role, active = p_active,
    organization_id = p_organization_id, is_marketing_admin = p_is_marketing_admin,
    crm_only = p_crm_only, area = nullif(btrim(p_area),''), updated_at = clock_timestamp()
    where id = p_user_id returning * into v_after;
  -- Sólo las claves de identidad de Stratos cambian; proveedores y metadata
  -- ajena quedan intactos. Perfil, Auth y bitácora se guardan juntos.
  update auth.users set raw_app_meta_data = v_auth_meta, banned_until = v_banned_until,
    raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('name',v_after.name)
    where id = p_user_id;
  if v_access_change then
    -- Revoca refresh sessions. JWTs ya emitidos conservan su vencimiento;
    -- la organización y el rol efectivos de RLS salen del perfil actualizado.
    delete from auth.sessions where user_id = p_user_id;
    get diagnostics v_sessions_revoked = row_count;
  end if;
  if v_move then
    -- Evita que el antiguo partner pueda seguir revelando una contraseña de
    -- una cuenta que ya no pertenece a sus empresas. No borra datos de negocio.
    delete from public.temporary_login_credentials where user_id = p_user_id;
    update public.company_module_permissions set decision = 'inherit', changed_by = p_actor_id, changed_at = clock_timestamp()
      where organization_id in (v_source,p_organization_id) and principal_type = 'user' and principal_id = p_user_id::text;
  end if;
  insert into public.audit_log(actor_id,organization_id,entity_type,entity_id,action,changed_fields,metadata)
  values(p_actor_id,p_organization_id,'profile',p_user_id,'UPDATE',
    jsonb_build_object('before',jsonb_build_object('name',v_before.name,'role',v_before.role,'active',v_before.active,
      'organization_id',v_before.organization_id,'is_marketing_admin',v_before.is_marketing_admin,'crm_only',v_before.crm_only,'area',v_before.area),
      'after',jsonb_build_object('name',v_after.name,'role',v_after.role,'active',v_after.active,
      'organization_id',v_after.organization_id,'is_marketing_admin',v_after.is_marketing_admin,'crm_only',v_after.crm_only,'area',v_after.area)),
    jsonb_build_object('source','platform_admin','operation','PLATFORM_USER_UPDATED','moved',v_move,
      'business_data_moved',false,'source_organization_id',v_source,'refresh_sessions_revoked',v_sessions_revoked));
  return jsonb_build_object('ok',true,'audit_saved',true,'user',jsonb_build_object(
    'id',v_after.id,'name',v_after.name,'role',v_after.role,'active',v_after.active,
    'organization_id',v_after.organization_id,'updated_at',v_after.updated_at,
    'is_marketing_admin',v_after.is_marketing_admin,'crm_only',v_after.crm_only,'area',v_after.area));
end $$;
revoke all on function public.fn_platform_update_user(uuid,uuid,timestamptz,text,text,boolean,uuid,boolean,boolean,text,boolean)
  from public, anon, authenticated;
grant execute on function public.fn_platform_update_user(uuid,uuid,timestamptz,text,text,boolean,uuid,boolean,boolean,text,boolean)
  to service_role;

create or replace function public.fn_platform_update_company(
  p_actor_id uuid, p_organization_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_seats integer, p_active boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before public.organizations%rowtype; v_after public.organizations%rowtype; v_count integer;
begin
  perform public.fn_platform_assert_root_actor(p_actor_id);
  if p_organization_id is null or p_expected_updated_at is null or p_name is null
     or length(btrim(p_name)) not between 2 and 120 or p_seats is null
     or p_seats not between 1 and 1000 or p_active is null then
    raise exception 'Datos de empresa inválidos.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 719001));
  select * into v_before from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'La empresa no existe.' using errcode = 'P0002'; end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'La empresa cambió. Actualiza antes de guardar.' using errcode = '40001';
  end if;
  select count(*) into v_count from public.profiles where organization_id = p_organization_id and active is true;
  if p_seats is distinct from v_before.seats and p_seats < v_count then
    raise exception 'El cupo no puede ser menor que los usuarios activos.' using errcode = '23514';
  end if;
  if not p_active and v_before.active is true and exists(
    select 1 from public.platform_admins a left join public.profiles p on p.id = a.user_id
      where a.active is true and (a.scope_organization_id = p_organization_id
        or (p.organization_id = p_organization_id and p.active is true))) then
    raise exception 'No puedes desactivar una empresa con operadores de plataforma activos.' using errcode = '42501';
  end if;
  update public.organizations set name = btrim(p_name), seats = p_seats, active = p_active, updated_at = clock_timestamp()
    where id = p_organization_id returning * into v_after;
  insert into public.audit_log(actor_id,organization_id,entity_type,entity_id,action,changed_fields,metadata)
  values(p_actor_id,p_organization_id,'organization',p_organization_id,'UPDATE',
    jsonb_build_object('before',jsonb_build_object('name',v_before.name,'seats',v_before.seats,'active',v_before.active),
      'after',jsonb_build_object('name',v_after.name,'seats',v_after.seats,'active',v_after.active)),
    jsonb_build_object('source','platform_admin','operation','PLATFORM_COMPANY_UPDATED'));
  return jsonb_build_object('ok',true,'audit_saved',true,'organization',to_jsonb(v_after));
end $$;
revoke all on function public.fn_platform_update_company(uuid,uuid,timestamptz,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.fn_platform_update_company(uuid,uuid,timestamptz,text,integer,boolean) to service_role;
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
