-- Duke still has one project administrator. Team accounts are participants only:
-- the existing delivery predicates restrict them to assignments and reviews.
create or replace function public.work_project_role(p_org uuid, p_actor uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select case
    when o.id <> '00000000-0000-0000-0000-000000000001'::uuid then p.role::text
    when p.role = 'super_admin' and not coalesce(p.is_marketing_admin, false)
      and exists (select 1 from public.work_duke_project_accounts a where a.profile_id=p.id)
      then 'super_admin'
    else 'colaborador'
  end
  from public.profiles p
  join public.organizations o on o.id=p.organization_id
  where p.id=p_actor and p.organization_id=p_org and p.active is true and o.active is true
    and not coalesce(p.crm_only,false)
    and p.role in ('super_admin','admin','director','ceo','asesor','marketing','colaborador')
    and case when o.id='00000000-0000-0000-0000-000000000001'::uuid then
      exists (select 1 from public.work_duke_project_accounts)
    else
      coalesce(o.meta_config #> '{features,projectWorkspace}',
        to_jsonb(o.id='cd478b82-d2ff-4543-981d-fb9d7aa1583e'::uuid)) = 'true'::jsonb
    end;
$$;
