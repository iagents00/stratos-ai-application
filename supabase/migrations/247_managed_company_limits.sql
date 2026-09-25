-- Controles de empresas creadas por la consola nueva. Los tenants históricos
-- (incluido Duke) salen inmediatamente de ambas funciones sin cambios.
-- La consola usa service_role; los usuarios del CRM usan authenticated.

create or replace function public.fn_guard_managed_company_setup()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_active integer;
begin
  if old.meta_config #>> '{onboarding,createdFrom}' is distinct from 'whatsapp_admin'
     or old.meta_config #>> '{platform,kind}' = 'partner' then
    return new;
  end if;

  -- La RLS permite que un admin edite su empresa. Esa capacidad no debe
  -- permitirle ampliar licencias ni reescribir módulos o su historial.
  if auth.role() = 'authenticated' and (
       new.seats is distinct from old.seats
       or new.meta_config->'features' is distinct from old.meta_config->'features'
       or new.meta_config->'onboarding' is distinct from old.meta_config->'onboarding'
       or new.meta_config->'platform' is distinct from old.meta_config->'platform'
       or new.meta_config->'setup_history' is distinct from old.meta_config->'setup_history'
       or new.active is distinct from old.active
       or new.plan is distinct from old.plan
       or new.subscription_status is distinct from old.subscription_status
       or new.parent_organization_id is distinct from old.parent_organization_id
     ) then
    raise exception 'La configuración de módulos y licencias se administra desde Stratos.' using errcode = '42501';
  end if;

  if new.seats is distinct from old.seats then
    perform pg_advisory_xact_lock(hashtextextended(old.id::text, 719001));
    select count(*) into v_active from public.profiles
      where organization_id = old.id and active is true;
    if new.seats < v_active then
      raise exception 'El cupo no puede ser menor que los usuarios activos.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_guard_managed_company_setup on public.organizations;
create trigger zz_guard_managed_company_setup
before update on public.organizations for each row
execute function public.fn_guard_managed_company_setup();

create or replace function public.fn_guard_managed_company_users()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_org public.organizations%rowtype;
  v_active integer;
  v_new_slot boolean;
begin
  if new.organization_id is null then return new; end if;
  if tg_op = 'INSERT' then
    v_new_slot := new.active is true;
  else
    v_new_slot := new.active is true and
      (old.active is distinct from true
       or old.organization_id is distinct from new.organization_id);
  end if;

  -- Un solo candado por empresa serializa altas/reactivaciones y cambios de
  -- cupo. El contador en Edge mejora el mensaje; esta guarda impide carreras.
  if v_new_slot then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 719001));
  end if;
  select * into v_org from public.organizations where id = new.organization_id;
  if not found or v_org.meta_config #>> '{onboarding,createdFrom}' is distinct from 'whatsapp_admin'
     or v_org.meta_config #>> '{platform,kind}' = 'partner' then
    return new;
  end if;

  if auth.role() = 'authenticated' and tg_op = 'UPDATE' then
    if v_org.meta_config #>> '{features,teamAdmin}' = 'false'
       and (new.role is distinct from old.role or new.active is distinct from old.active) then
      raise exception 'La gestión de usuarios está desactivada para esta empresa.' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       and new.role not in ('admin', 'director', 'asesor') then
      raise exception 'Este rol requiere administración de Stratos.' using errcode = '42501';
    end if;
  end if;

  if v_new_slot then
    select count(*) into v_active from public.profiles
      where organization_id = new.organization_id and active is true;
    if v_active >= v_org.seats then
      raise exception 'La empresa ya utiliza todas sus licencias.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_guard_managed_company_users on public.profiles;
create trigger zz_guard_managed_company_users
before insert or update on public.profiles for each row
execute function public.fn_guard_managed_company_users();
