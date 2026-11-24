-- Project access in Duke is granted to individual accounts by deployment.
create table public.work_duke_project_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.work_duke_project_accounts enable row level security;
revoke all on public.work_duke_project_accounts from public, anon, authenticated;

create or replace function public.work_project_role(p_org uuid, p_actor uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select p.role::text from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_actor and p.organization_id = p_org and p.active is true and o.active is true
    and not coalesce(p.crm_only, false)
    and p.role in ('super_admin','admin','director','ceo','asesor','marketing','colaborador')
    and case when o.id = '00000000-0000-0000-0000-000000000001'::uuid then
      p.role = 'super_admin'
      and not coalesce(p.is_marketing_admin, false)
      and exists (select 1 from public.work_duke_project_accounts a where a.profile_id = p.id)
    else
      coalesce(o.meta_config #> '{features,projectWorkspace}',
        to_jsonb(o.id = 'cd478b82-d2ff-4543-981d-fb9d7aa1583e'::uuid)) = 'true'::jsonb
    end;
$$;

create function public.work_project_duke_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.work_project_role('00000000-0000-0000-0000-000000000001'::uuid, auth.uid()) = 'super_admin', false);
$$;
revoke all on function public.work_project_duke_access() from public, anon, authenticated;
grant execute on function public.work_project_duke_access() to authenticated;

insert into public.front_rpc_registry(nombre,nota) values
  ('work_project_duke_access','Proyectos: consultar el permiso individual de la sesión en Duke')
on conflict(nombre) do nothing;
