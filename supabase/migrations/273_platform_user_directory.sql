-- Auth Admin listUsers no puede leer algunas identidades históricas con campos
-- NULL. El directorio usa una proyección SQL explícita y segura; no repara ni
-- modifica auth.users, perfiles, tickets o datos de negocio.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.fn_platform_list_users(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_users jsonb; v_organizations jsonb;
begin
  -- VOLATILE por defecto: la autorización raíz existente toma un row lock.
  perform public.fn_platform_assert_root_actor(p_actor_id);
  select coalesce(jsonb_agg(directory.item order by directory.name, directory.id),'[]'::jsonb)
    into v_users
  from (
    select coalesce(p.id,u.id) id,
      coalesce(p.name,nullif(left(btrim(u.raw_user_meta_data->>'name'),120),''),u.email,'Cuenta sin perfil') name,
      jsonb_build_object(
        'id',coalesce(p.id,u.id),
        'name',coalesce(p.name,nullif(left(btrim(u.raw_user_meta_data->>'name'),120),''),u.email,'Cuenta sin perfil'),
        'role',p.role,'active',coalesce(p.active,false),'organization_id',p.organization_id,
        'updated_at',p.updated_at,'is_marketing_admin',coalesce(p.is_marketing_admin,false),
        'crm_only',coalesce(p.crm_only,false),'area',p.area,
        'email',u.email,'email_confirmed',u.email_confirmed_at is not null,
        'last_sign_in',u.last_sign_in_at,'identity_missing',u.id is null,'profile_missing',p.id is null,
        'platform_admin',case when a.user_id is null then null else jsonb_build_object(
          'active',a.active,'scope_organization_id',a.scope_organization_id,
          'support_only',a.support_only,'company_limit',a.company_limit) end,
        'protected_from_access_changes',coalesce(p.id,u.id)=p_actor_id or coalesce(a.active,false)
      ) item
    from public.profiles p full outer join auth.users u on u.id=p.id
    left join public.platform_admins a on a.user_id=coalesce(p.id,u.id)
  ) directory;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'name',o.name,'slug',o.slug,'plan',o.plan,'seats',o.seats,'active',o.active,
    'subscription_status',o.subscription_status,'meta_config',o.meta_config,
    'parent_organization_id',o.parent_organization_id,'created_at',o.created_at,'updated_at',o.updated_at
  ) order by o.created_at desc,o.id),'[]'::jsonb) into v_organizations
    from public.organizations o;
  return jsonb_build_object('ok',true,'users',v_users,'organizations',v_organizations);
end $$;
revoke all on function public.fn_platform_list_users(uuid) from public, anon, authenticated;
grant execute on function public.fn_platform_list_users(uuid) to service_role;
notify pgrst, 'reload schema';
