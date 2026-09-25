-- Permisos modulares por empresa. Caja es la primera superficie protegida
-- de extremo a extremo. Ninguna fila histórica se modifica con esta migración.
-- Solo organizaciones creadas desde whatsapp_admin optan por esta matriz.

create table if not exists public.company_module_entitlements (
  organization_id uuid not null references public.organizations(id),
  module_key text not null check (module_key in ('caja')),
  enabled boolean not null default false,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  primary key (organization_id, module_key)
);

create table if not exists public.company_module_permissions (
  organization_id uuid not null references public.organizations(id),
  module_key text not null check (module_key in ('caja')),
  principal_type text not null check (principal_type in ('role', 'user')),
  principal_id text not null,
  capability text not null check (capability in (
    'read_all', 'read_own', 'create', 'update_all', 'update_own'
  )),
  decision text not null check (decision in ('allow', 'deny', 'inherit')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  primary key (organization_id, module_key, principal_type, principal_id, capability)
);

-- No hay acceso directo desde el navegador: la consola raíz escribe mediante
-- una función service_role; cada usuario consulta únicamente su resultado.
alter table public.company_module_entitlements enable row level security;
alter table public.company_module_permissions enable row level security;
revoke all on public.company_module_entitlements from public, anon, authenticated;
revoke all on public.company_module_permissions from public, anon, authenticated;
grant all on public.company_module_entitlements to service_role;
grant all on public.company_module_permissions to service_role;

create or replace function public.fn_company_module_allowed(
  p_organization_id uuid, p_module_key text, p_capability text
) returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_meta jsonb;
  v_role text;
  v_active boolean;
  v_user_org uuid;
  v_enabled boolean;
  v_decision text;
begin
  if p_organization_id is null or p_module_key <> 'caja'
     or p_capability not in ('read_all','read_own','create','update_all','update_own','delete_all') then
    return false;
  end if;
  -- Service-role jobs already bypass RLS. Keep their existing behavior; any
  -- request made on behalf of a person must use that person's JWT instead.
  if auth.role() = 'service_role' then return true; end if;
  select meta_config into v_meta from public.organizations where id = p_organization_id;
  if not found then return false; end if;
  if v_meta #>> '{onboarding,createdFrom}' is distinct from 'whatsapp_admin'
     or v_meta #>> '{platform,kind}' = 'partner' then
    return true; -- legacy policy remains the authority for existing tenants
  end if;
  select role, active, organization_id into v_role, v_active, v_user_org
    from public.profiles where id = auth.uid();
  if not found or v_active is distinct from true
     or v_user_org is distinct from p_organization_id then return false; end if;
  select enabled into v_enabled from public.company_module_entitlements
    where organization_id = p_organization_id and module_key = p_module_key;
  if v_enabled is distinct from true then return false; end if;
  select decision into v_decision from public.company_module_permissions
    where organization_id = p_organization_id and module_key = p_module_key
      and principal_type = 'user' and principal_id = auth.uid()::text
      and capability = p_capability;
  if v_decision in ('allow','deny') then return v_decision = 'allow'; end if;
  select decision into v_decision from public.company_module_permissions
    where organization_id = p_organization_id and module_key = p_module_key
      and principal_type = 'role' and principal_id = v_role
      and capability = p_capability;
  return coalesce(v_decision = 'allow', false);
end;
$$;
revoke all on function public.fn_company_module_allowed(uuid,text,text) from public, anon;
grant execute on function public.fn_company_module_allowed(uuid,text,text) to authenticated, service_role;

-- Una política RESTRICTIVE se combina por AND con las políticas org-scoped
-- existentes. Los clientes históricos salen true sin cambiar su acceso.
create policy company_caja_team_expenses_select on public.team_expenses
  as restrictive for select to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'read_own')
        and (persona_id = auth.uid() or (persona_id is null and created_by = auth.uid())))
  );
create policy company_caja_team_expenses_insert on public.team_expenses
  as restrictive for insert to authenticated with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'create')
    and (public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
         or (created_by = auth.uid() and (persona_id is null or persona_id = auth.uid())))
  );
create policy company_caja_team_expenses_update on public.team_expenses
  as restrictive for update to authenticated
  using (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and (persona_id = auth.uid() or (persona_id is null and created_by = auth.uid())))
  )
  with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and (persona_id = auth.uid() or (persona_id is null and created_by = auth.uid())))
  );

create policy company_caja_fin_movements_select on public.fin_movements
  as restrictive for select to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'read_own')
        and registrado_por = auth.uid())
  );
create policy company_caja_fin_movements_insert on public.fin_movements
  as restrictive for insert to authenticated with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'create')
    and (public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
         or registrado_por = auth.uid())
  );
create policy company_caja_fin_movements_update on public.fin_movements
  as restrictive for update to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and registrado_por = auth.uid())
  ) with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and registrado_por = auth.uid())
  );
create policy company_caja_fin_movements_delete on public.fin_movements
  as restrictive for delete to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'delete_all')
  );

create policy company_caja_fin_payroll_select on public.fin_payroll
  as restrictive for select to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'read_own')
        and profile_id = auth.uid())
  );
create policy company_caja_fin_payroll_insert on public.fin_payroll
  as restrictive for insert to authenticated with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
  );
create policy company_caja_fin_payroll_update on public.fin_payroll
  as restrictive for update to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
  ) with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
  );
create policy company_caja_fin_payroll_delete on public.fin_payroll
  as restrictive for delete to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'delete_all')
  );

create policy company_caja_fin_invoices_select on public.fin_invoices
  as restrictive for select to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'read_own')
        and created_by = auth.uid())
  );
create policy company_caja_fin_invoices_insert on public.fin_invoices
  as restrictive for insert to authenticated with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'create')
    and (public.fn_company_module_allowed(organization_id, 'caja', 'read_all')
         or created_by = auth.uid())
  );
create policy company_caja_fin_invoices_update on public.fin_invoices
  as restrictive for update to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and created_by = auth.uid())
  ) with check (
    public.fn_company_module_allowed(organization_id, 'caja', 'update_all')
    or (public.fn_company_module_allowed(organization_id, 'caja', 'update_own')
        and created_by = auth.uid())
  );
create policy company_caja_fin_invoices_delete on public.fin_invoices
  as restrictive for delete to authenticated using (
    public.fn_company_module_allowed(organization_id, 'caja', 'delete_all')
  );

-- Los comprobantes viven en un bucket privado, con nombres
-- caja/<organizacion>/<id_movimiento>-<timestamp>.<extension>.
-- Un usuario con vista propia no puede firmar una URL de otra persona.
create or replace function public.fn_company_caja_evidence_allowed(
  p_name text, p_action text
) returns boolean language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare v_org uuid; v_id uuid; v_file text; v_row public.team_expenses%rowtype;
begin
  if split_part(p_name,'/',1) <> 'caja' then return true; end if;
  if split_part(p_name,'/',2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_org := split_part(p_name,'/',2)::uuid;
  if not exists (select 1 from public.organizations
     where id = v_org and meta_config #>> '{onboarding,createdFrom}' = 'whatsapp_admin'
       and meta_config #>> '{platform,kind}' is distinct from 'partner') then
    return true;
  end if;
  v_file := split_part(p_name,'/',3);
  if left(v_file,36) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_id := left(v_file,36)::uuid;
  select * into v_row from public.team_expenses
    where id = v_id and organization_id = v_org;
  if not found then return false; end if;
  if p_action = 'read' then
    return public.fn_company_module_allowed(v_org,'caja','read_all')
      or (public.fn_company_module_allowed(v_org,'caja','read_own')
        and (v_row.persona_id = auth.uid()
          or (v_row.persona_id is null and v_row.created_by = auth.uid())));
  end if;
  if p_action = 'write' then
    return public.fn_company_module_allowed(v_org,'caja','update_all')
      or (public.fn_company_module_allowed(v_org,'caja','update_own')
        and (v_row.persona_id = auth.uid()
          or (v_row.persona_id is null and v_row.created_by = auth.uid())));
  end if;
  return false;
end $$;
revoke all on function public.fn_company_caja_evidence_allowed(text,text) from public, anon;
grant execute on function public.fn_company_caja_evidence_allowed(text,text) to authenticated;

create policy company_caja_evidence_select on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'evidencia' or (storage.foldername(name))[1] <> 'caja'
    or public.fn_company_caja_evidence_allowed(name,'read')
  );
create policy company_caja_evidence_insert on storage.objects
  as restrictive for insert to authenticated with check (
    bucket_id <> 'evidencia' or (storage.foldername(name))[1] <> 'caja'
    or public.fn_company_caja_evidence_allowed(name,'write')
  );
create policy company_caja_evidence_update on storage.objects
  as restrictive for update to authenticated using (
    bucket_id <> 'evidencia' or (storage.foldername(name))[1] <> 'caja'
    or public.fn_company_caja_evidence_allowed(name,'write')
  ) with check (
    bucket_id <> 'evidencia' or (storage.foldername(name))[1] <> 'caja'
    or public.fn_company_caja_evidence_allowed(name,'write')
  );

-- Estas dos RPC son SECURITY DEFINER: por eso requieren una comprobación
-- propia; RLS por sí sola no protege las escrituras de su implementación.
create or replace function public.fn_fin_cuenta_cobro_persona(
  p_profile_id uuid, p_persona text default null::text, p_monto numeric default null::numeric,
  p_desde date default null::date, p_hasta date default null::date
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid;
begin
  if v is not null then p_profile_id := v; end if;
  select organization_id into v_org from public.profiles where id = p_profile_id;
  if not public.fn_company_module_allowed(v_org, 'caja', 'update_all') then
    raise exception 'No tienes permiso para crear cuentas de nómina.' using errcode = '42501';
  end if;
  return public.fn_fin_cuenta_cobro_persona_impl(p_profile_id, p_persona, p_monto, p_desde, p_hasta);
end $$;

create or replace function public.fn_fin_invoice_set_monto(
  p_profile_id uuid, p_invoice_id uuid, p_monto numeric
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid; v_owner uuid;
begin
  if v is not null then p_profile_id := v; end if;
  select organization_id into v_org from public.profiles where id = p_profile_id;
  select created_by into v_owner from public.fin_invoices
    where id = p_invoice_id and organization_id = v_org;
  if not (public.fn_company_module_allowed(v_org, 'caja', 'update_all')
      or (v_owner = p_profile_id and public.fn_company_module_allowed(v_org, 'caja', 'update_own'))) then
    raise exception 'No tienes permiso para editar esta cuenta.' using errcode = '42501';
  end if;
  return public.fn_fin_invoice_set_monto_impl(p_profile_id, p_invoice_id, p_monto);
end $$;

-- Comando agrupa Caja con SECURITY DEFINER. La vista directiva puede seguir
-- activa sin dar acceso a los saldos o a la nómina de Caja.
create or replace function public.fn_comando_nsg(p_profile_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid; v_result jsonb;
begin
  if v is not null then p_profile_id := v; end if;
  select organization_id into v_org from public.profiles where id = p_profile_id;
  v_result := public.fn_comando_nsg_impl(p_profile_id);
  if not public.fn_company_module_allowed(v_org, 'caja', 'read_all') then
    return v_result - 'caja' - 'nomina';
  end if;
  return v_result;
end $$;

-- La consola escribe toda la matriz en una sola transacción. Sin DELETE:
-- 'inherit' desactiva una excepción individual y conserva trazabilidad.
create or replace function public.fn_platform_save_caja_access(
  p_organization_id uuid, p_expected_updated_at timestamptz,
  p_enabled boolean, p_permissions jsonb, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_org public.organizations%rowtype;
  v_item jsonb;
  v_type text;
  v_principal text;
  v_capability text;
  v_decision text;
  v_meta jsonb;
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Solo el servidor de Stratos puede administrar módulos.' using errcode = '42501';
  end if;
  if p_organization_id is null or p_expected_updated_at is null or p_enabled is null
     or jsonb_typeof(p_permissions) is distinct from 'array'
     or jsonb_array_length(p_permissions) > 6000 then
    raise exception 'Configuración de módulos inválida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_admins
    where user_id = p_actor_id and active is true and scope_organization_id is null) then
    raise exception 'El operador no es administrador raíz activo.' using errcode = '42501';
  end if;
  select * into v_org from public.organizations
    where id = p_organization_id for update;
  if not found or v_org.meta_config #>> '{onboarding,createdFrom}' is distinct from 'whatsapp_admin'
     or v_org.meta_config #>> '{platform,kind}' = 'partner' then
    raise exception 'Esta empresa conserva su configuración personalizada.' using errcode = '42501';
  end if;
  if v_org.updated_at is distinct from p_expected_updated_at then
    raise exception 'La empresa cambió. Actualiza antes de guardar.' using errcode = '40001';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by principal_type, principal_id, capability), '[]'::jsonb)
    into v_before from public.company_module_permissions p
    where p.organization_id = p_organization_id and p.module_key = 'caja';
  for v_item in select value from jsonb_array_elements(p_permissions) loop
    v_type := v_item->>'principal_type';
    v_principal := v_item->>'principal_id';
    v_capability := v_item->>'capability';
    v_decision := v_item->>'decision';
    if coalesce(v_type,'') not in ('role','user') or coalesce(v_capability,'') not in
       ('read_all','read_own','create','update_all','update_own')
       or coalesce(v_decision,'') not in ('allow','deny','inherit') then
      raise exception 'Permiso inválido.' using errcode = '22023';
    end if;
    if v_type = 'role' then
      if coalesce(v_principal,'') not in ('super_admin','admin','director','ceo','asesor','marketing','colaborador') then
        raise exception 'Rol inválido.' using errcode = '22023';
      end if;
    else
      if coalesce(v_principal,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Usuario inválido.' using errcode = '22023';
      end if;
      if not exists (select 1 from public.profiles where id = v_principal::uuid
        and organization_id = p_organization_id and active is true) then
        raise exception 'El usuario no pertenece a esta empresa.' using errcode = '42501';
      end if;
    end if;
    insert into public.company_module_permissions
      (organization_id,module_key,principal_type,principal_id,capability,decision,changed_by,changed_at)
    values (p_organization_id,'caja',v_type,v_principal,v_capability,v_decision,p_actor_id,v_now)
    on conflict (organization_id,module_key,principal_type,principal_id,capability)
      do update set decision = excluded.decision, changed_by = excluded.changed_by,
        changed_at = excluded.changed_at;
  end loop;
  insert into public.company_module_entitlements
    (organization_id,module_key,enabled,changed_by,changed_at)
  values (p_organization_id,'caja',p_enabled,p_actor_id,v_now)
  on conflict (organization_id,module_key)
    do update set enabled = excluded.enabled, changed_by = excluded.changed_by,
      changed_at = excluded.changed_at;
  v_meta := jsonb_set(coalesce(v_org.meta_config,'{}'::jsonb), '{features,caja}', to_jsonb(p_enabled), true);
  update public.organizations set meta_config = v_meta, updated_at = v_now
    where id = p_organization_id;
  insert into public.audit_log
    (actor_id,organization_id,entity_type,entity_id,action,changed_fields,metadata)
  values (p_actor_id,p_organization_id,'organization',p_organization_id,
    'COMPANY_CAJA_ACCESS_UPDATED',
    jsonb_build_object('enabled_before',coalesce(v_org.meta_config #>> '{features,caja}','false'),
      'enabled_after',p_enabled,'permissions_before',v_before,'permissions_after',p_permissions),
    jsonb_build_object('source','platform_admin'));
  return jsonb_build_object('ok',true,'updated_at',v_now);
end $$;
revoke all on function public.fn_platform_save_caja_access(uuid,timestamptz,boolean,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.fn_platform_save_caja_access(uuid,timestamptz,boolean,jsonb,uuid)
  to service_role;

create or replace function public.fn_my_company_module_access()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare v_org uuid; v_enabled boolean;
begin
  select organization_id into v_org from public.profiles
    where id = auth.uid() and active is true;
  if v_org is null then return '{}'::jsonb; end if;
  select enabled into v_enabled from public.company_module_entitlements
    where organization_id = v_org and module_key = 'caja';
  return jsonb_build_object('caja',jsonb_build_object(
    'enabled',coalesce(v_enabled,false),
    'read_all',public.fn_company_module_allowed(v_org,'caja','read_all'),
    'read_own',public.fn_company_module_allowed(v_org,'caja','read_own'),
    'create',public.fn_company_module_allowed(v_org,'caja','create'),
    'update_all',public.fn_company_module_allowed(v_org,'caja','update_all'),
    'update_own',public.fn_company_module_allowed(v_org,'caja','update_own')
  ));
end $$;
revoke all on function public.fn_my_company_module_access() from public, anon;
grant execute on function public.fn_my_company_module_access() to authenticated;
