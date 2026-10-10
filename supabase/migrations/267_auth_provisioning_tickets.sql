-- Auth Admin aplica custom app_metadata después del INSERT de auth.users.
-- El servidor emite un ticket aleatorio, vinculado a correo/empresa/rol;
-- el trigger lo consume en la misma transacción que crea Auth y el perfil.
create table public.auth_provisioning_tickets (
 token uuid primary key,
 email text not null,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 role text not null check (role in ('admin','director','asesor','super_admin','ceo','marketing','colaborador')),
 expires_at timestamptz not null default now()+interval '5 minutes'
);
alter table public.auth_provisioning_tickets enable row level security;
revoke all on public.auth_provisioning_tickets from public,anon,authenticated;
grant select,insert,delete on public.auth_provisioning_tickets to service_role;

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
  v_ticket uuid;
  v_ticket_role text;
begin
  v_name := coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_recovery := coalesce(nullif(lower(btrim(new.raw_user_meta_data->>'recovery_email')), ''), lower(new.email));
  v_ticket := nullif(new.raw_user_meta_data->>'stratos_provisioning_ticket','')::uuid;
  if v_ticket is not null then
    delete from public.auth_provisioning_tickets
      where token=v_ticket and email=lower(btrim(new.email)) and expires_at>now()
      returning organization_id,role into v_org,v_ticket_role;
    if not found then
      raise exception 'Autorización de alta inválida o vencida.' using errcode='42501';
    end if;
  else
    -- Compatibilidad con clientes de Auth que sí insertan app_metadata al inicio.
    v_org := coalesce(nullif(new.raw_app_meta_data->>'stratos_organization_id',''),
                      nullif(new.raw_app_meta_data->>'organization_id',''))::uuid;
  end if;
  if v_org is not null then
    if not exists(select 1 from public.organizations where id = v_org and active is true) then
      raise exception 'La empresa de destino no está activa.' using errcode = '23514';
    end if;
    v_role := coalesce(v_ticket_role, nullif(new.raw_app_meta_data->>'stratos_role', ''),
                       nullif(new.raw_app_meta_data->>'role', ''),
                       case when exists(select 1 from public.profiles where organization_id=v_org) then 'asesor' else 'admin' end);
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

