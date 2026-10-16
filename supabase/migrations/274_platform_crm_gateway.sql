-- CRM multiempresa por acciones explícitas del servidor. No cambia perfiles,
-- sesiones, roles ni policies del CRM ordinario. Solo service_role ejecuta.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.fn_platform_crm_assert(p_actor_id uuid,p_organization_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_scope uuid; v_org public.organizations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Sólo el servidor puede abrir el CRM de empresas.' using errcode='42501';
  end if;
  select scope_organization_id into v_scope from public.platform_admins
    where user_id=p_actor_id and active is true for share;
  if not found or exists(select 1 from public.profiles where id=p_actor_id and active is false) then
    raise exception 'El operador de plataforma no está autorizado.' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=p_actor_id for share;
  if exists(select 1 from public.profiles where id=p_actor_id and active is false) then
    raise exception 'El operador de plataforma no está autorizado.' using errcode='42501';
  end if;
  select * into v_org from public.organizations where id=p_organization_id for share;
  if not found or (v_scope is not null and v_org.id<>v_scope and v_org.parent_organization_id is distinct from v_scope) then
    raise exception 'No tienes acceso a esa empresa.' using errcode='42501';
  end if;
  if v_org.active is distinct from true then
    raise exception 'La empresa está desactivada.' using errcode='42501';
  end if;
end $$;

create or replace function public.fn_platform_crm_pipeline(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_meta jsonb; v_pipeline jsonb; v_static jsonb := '{"ea74b69a-6904-4c65-a0ca-e0af58f1473a":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"6c5cf32a-3db4-477d-bbed-26d90231bc9a":[{"name":"Sin contactar","color":"#94A3B8"},{"name":"Buscando cita","color":"#38BDF8"},{"name":"Cita sin confirmar","color":"#818CF8"},{"name":"Cita confirmada","color":"#22D3EE"},{"name":"Faltó a la cita","color":"#FBBF24"},{"name":"No continuó","color":"#F87171"},{"name":"Ya vino a consulta","color":"#38BDF8"},{"name":"Pensando el presupuesto","color":"#FB923C"},{"name":"Listo para empezar","color":"#22D3EE"},{"name":"En tratamiento","color":"#34D399"},{"name":"Tratamiento terminado","color":"#4ADE80"},{"name":"Vuelve a control","color":"#10B981"}],"deded000-0000-4000-a000-000000000001":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"00000000-0000-0000-0000-000000000001":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"72e827f9-4d40-4197-bde6-3e4359f09591":[{"name":"Mensaje nuevo","color":"#94A3B8"},{"name":"Ya se le informó","color":"#38BDF8"},{"name":"Cita agendada","color":"#818CF8"},{"name":"Preparación enviada","color":"#A78BFA"},{"name":"No se presentó","color":"#FBBF24"},{"name":"No agendó","color":"#F87171"},{"name":"Estudio realizado","color":"#22D3EE"},{"name":"Esperando interpretación","color":"#FB923C"},{"name":"Resultados entregados","color":"#4ADE80"},{"name":"Toca control","color":"#10B981"},{"name":"Médico por visitar","color":"#94A3B8"},{"name":"Visita hecha","color":"#818CF8"},{"name":"Ya nos mandó pacientes","color":"#22D3EE"},{"name":"Nos manda seguido","color":"#4ADE80"},{"name":"Dejó de mandar","color":"#F87171"}],"9afe40d2-7163-4407-a4cd-5346799ecd3c":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"cd478b82-d2ff-4543-981d-fb9d7aa1583e":[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Reunión","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Ganado","color":"#34D399"},{"name":"Perdido","color":"#F87171"}],"281caa01-7414-4eef-b3b6-afa1e7623ab3":[{"name":"Terreno y contrato","color":"#A8A29E"},{"name":"Diseño y proyecto ejecutivo","color":"#94A3B8"},{"name":"Licencias y permisos","color":"#38BDF8"},{"name":"Cimientos","color":"#FBBF24"},{"name":"Obra gris","color":"#FB923C"},{"name":"Acabados","color":"#A78BFA"},{"name":"Entrega","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"e583eb98-ff00-4920-a69c-db39f3841b31":[{"name":"Pidió cotización","color":"#94A3B8"},{"name":"Cotización enviada","color":"#CBD5E1"},{"name":"Anticipo recibido","color":"#4ADE80"},{"name":"No cerró","color":"#F87171"},{"name":"Corte","color":"#38BDF8"},{"name":"Armado","color":"#FBBF24"},{"name":"Laca","color":"#A78BFA"},{"name":"Terminado, listo para entregar","color":"#2DD4BF"},{"name":"Entregado","color":"#34D399"},{"name":"Ajustes y garantía","color":"#64748B"}],"4a17b181-35d2-41b3-b639-6e0bd4c38acc":[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Diagnóstico","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Cierre","color":"#F472B6"},{"name":"Onboarding","color":"#22D3EE"},{"name":"Activa","color":"#34D399"},{"name":"Descartada","color":"#F87171"}],"b1145073-434c-4779-a243-d5e8f5ff3617":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"c1d2e3f4-a5b6-47c8-9d0e-1f2a3b4c5d6e":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"065e12c5-56e2-440d-8f82-cd6c1ca612b7":[{"name":"Detectada","color":"#94A3B8"},{"name":"En Análisis","color":"#38BDF8"},{"name":"Presentada","color":"#FBBF24"},{"name":"Adjudicada","color":"#A78BFA"},{"name":"En Ejecución","color":"#06B6D4"},{"name":"Finalizada","color":"#34D399"},{"name":"Descartada","color":"#F87171"}]}'::jsonb;
  v_defaults jsonb := '[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Reunión","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Ganado","color":"#34D399"},{"name":"Perdido","color":"#F87171"}]'::jsonb;
begin
  select meta_config into v_meta from public.organizations where id=p_organization_id;
  if jsonb_typeof(v_meta#>'{crm,pipeline}')='array' and jsonb_array_length(v_meta#>'{crm,pipeline}')>0 then
    v_pipeline:=v_meta#>'{crm,pipeline}';
  elsif jsonb_typeof(v_meta#>'{crm,pipelines}')='array' then
    select jsonb_agg(s) into v_pipeline from jsonb_array_elements(v_meta#>'{crm,pipelines}') g
      cross join lateral jsonb_array_elements(case when jsonb_typeof(g->'stages')='array' then g->'stages' else '[]'::jsonb end) s;
  end if;
  -- Historical companies still keep their pipeline in org_stages. Its legacy
  -- column names vary; read JSON keys without altering that table or its rows.
  if v_pipeline is null and to_regclass('public.org_stages') is not null then
    execute $q$ select jsonb_agg(jsonb_build_object('name',coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage'),
      'color',coalesce(j->>'color','#64748B')) order by
      case when coalesce(j->>'sort_order',j->>'position',j->>'orden',j->>'stage_order','') ~ '^\d+$'
        then coalesce(j->>'sort_order',j->>'position',j->>'orden',j->>'stage_order')::integer else 999 end,
      coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage'))
      from (select to_jsonb(s) j from public.org_stages s) x
      where j->>'organization_id'=$1 and j->>'deleted_at' is null and coalesce(j->>'activo','true')<>'false'
        and coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage','')<>'' $q$
      into v_pipeline using p_organization_id::text;
  end if;
  -- Server fallback mirrors repository-only client configurations at this
  -- release. Saved database configuration always takes precedence. No seed or
  -- update is applied to historical organizations or their leads.
  v_pipeline:=coalesce(v_pipeline,v_static->p_organization_id::text,v_defaults);
  select coalesce(jsonb_agg(jsonb_build_object('name',s->>'name','color',
      case when s->>'color' ~ '^#[0-9A-Fa-f]{6}$' then s->>'color' else '#64748B' end) order by ord),'[]'::jsonb)
    into v_pipeline from jsonb_array_elements(v_pipeline) with ordinality x(s,ord)
    where nullif(btrim(s->>'name'),'') is not null;
  -- Keep occupied legacy stages visible; never relabel a company's clients.
  select v_pipeline||coalesce(jsonb_agg(jsonb_build_object('name',stage,'color','#64748B') order by stage),'[]'::jsonb)
    into v_pipeline from (select distinct stage from public.leads where organization_id=p_organization_id
      and deleted_at is null and nullif(btrim(stage),'') is not null
      and not exists(select 1 from jsonb_array_elements(v_pipeline) s where s->>'name'=stage)) legacy;
  return v_pipeline;
end $$;

create or replace function public.fn_platform_crm_read(
  p_actor_id uuid,p_organization_id uuid,p_lead_id uuid default null,
  p_page integer default 0,p_page_size integer default 50,p_search text default '',
  p_stage text default null,p_asesor_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_context jsonb; v_lead jsonb; v_notes jsonb; v_leads jsonb; v_total bigint; v_search text;
begin
  perform public.fn_platform_crm_assert(p_actor_id,p_organization_id);
  if p_page is null or p_page<0 or p_page>100000 or p_page_size is null or p_page_size<1 or p_page_size>100
     or length(coalesce(p_search,''))>200 then raise exception 'Filtros inválidos.' using errcode='22023'; end if;
  select jsonb_build_object('organization',jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'active',o.active),
    'pipeline',public.fn_platform_crm_pipeline(o.id),'advisors',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role) order by p.name,p.id)
      from public.profiles p where p.organization_id=o.id and p.active is true),'[]'::jsonb))
    into v_context from public.organizations o where o.id=p_organization_id;
  if p_lead_id is not null then
    select jsonb_build_object('id',l.id,'organization_id',l.organization_id,'name',l.name,'phone',l.phone,'email',l.email,
      'stage',l.stage,'asesor_id',l.asesor_id,'asesor_name',l.asesor_name,'budget',l.budget,'presupuesto',l.presupuesto,
      'project',l.project,'campaign',l.campaign,'source',l.source,'notas',l.notas,
      'next_action',l.next_action,'next_action_at',l.next_action_at,'created_at',l.created_at,'updated_at',l.updated_at,
      'action_history',l.action_history)
      into v_lead from public.leads l where l.organization_id=p_organization_id and l.id=p_lead_id and l.deleted_at is null;
    if not found then raise exception 'El cliente no existe en esta empresa.' using errcode='P0002'; end if;
    select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id desc),'[]'::jsonb) into v_notes from (
      select id,descripcion,titulo,tipo,metadata,created_at,asesor_id from public.expediente_items
      where organization_id=p_organization_id and lead_id=p_lead_id and deleted_at is null and tipo in ('nota','texto','nota_ia')
      order by created_at desc,id desc limit 100) n;
    return v_context||jsonb_build_object('lead',v_lead,'notes',v_notes);
  end if;
  -- Treat % and _ as literal search characters, not caller-supplied filters.
  v_search:='%'||replace(replace(replace(btrim(coalesce(p_search,'')),'\','\\'),'%','\%'),'_','\_')||'%';
  select count(*) into v_total from public.leads l where l.organization_id=p_organization_id and l.deleted_at is null
    and (p_stage is null or l.stage=p_stage) and (p_asesor_id is null or l.asesor_id=p_asesor_id)
    and (l.name ilike v_search or l.email ilike v_search or l.phone ilike v_search
      or (length(regexp_replace(coalesce(p_search,''),'[^0-9]','','g'))>=3
        and regexp_replace(coalesce(l.phone,''),'[^0-9]','','g') like '%'||regexp_replace(p_search,'[^0-9]','','g')||'%'));
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_leads from (
    select l.id,l.organization_id,l.name,l.phone,l.email,l.stage,l.asesor_id,l.asesor_name,l.budget,l.presupuesto,
      l.project,l.campaign,l.source,l.next_action,l.next_action_at,l.created_at,l.updated_at
    from public.leads l where l.organization_id=p_organization_id and l.deleted_at is null
      and (p_stage is null or l.stage=p_stage) and (p_asesor_id is null or l.asesor_id=p_asesor_id)
      and (l.name ilike v_search or l.email ilike v_search or l.phone ilike v_search
        or (length(regexp_replace(coalesce(p_search,''),'[^0-9]','','g'))>=3
          and regexp_replace(coalesce(l.phone,''),'[^0-9]','','g') like '%'||regexp_replace(p_search,'[^0-9]','','g')||'%'))
    order by l.created_at desc,l.id desc limit p_page_size offset p_page*p_page_size) x;
  return v_context||jsonb_build_object('leads',v_leads,'total',v_total,'page',p_page,'page_size',p_page_size,
    'has_more',(p_page+1)*p_page_size<v_total);
end $$;

create or replace function public.fn_platform_crm_mutate(
  p_actor_id uuid,p_organization_id uuid,p_lead_id uuid,p_expected_updated_at timestamptz,p_patch jsonb,p_create boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_before public.leads%rowtype; v_next public.leads%rowtype; v_after public.leads%rowtype;
  v_actor text; v_pipeline jsonb; v_assignee public.profiles%rowtype; v_key text; v_limit integer;
  v_patch jsonb; v_history jsonb; v_diff jsonb; v_fingerprint text; v_action text; v_exists boolean; v_set text; v_columns text[];
begin
  perform public.fn_platform_crm_assert(p_actor_id,p_organization_id);
  if p_lead_id is null or p_create is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then
    raise exception 'Faltan los datos del cliente.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in (
    'name','phone','email','budget','presupuesto','project','campaign','source','stage','asesor_id','notas','next_action','next_action_at')) then
    raise exception 'El cambio contiene campos no permitidos.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(p_patch) x where x.key<>'presupuesto' and jsonb_typeof(x.value) not in ('string','null')) then
    raise exception 'Los campos de texto no son válidos.' using errcode='22023'; end if;
  v_patch:=p_patch;
  for v_key in select jsonb_object_keys(v_patch) loop
    if v_key not in ('presupuesto','notas') and jsonb_typeof(v_patch->v_key)='string' then
      v_patch:=jsonb_set(v_patch,array[v_key],to_jsonb(btrim(v_patch->>v_key)));
    end if;
    v_limit:=case v_key when 'name' then 200 when 'phone' then 50 when 'email' then 254 when 'budget' then 100
      when 'project' then 200 when 'campaign' then 200 when 'source' then 80 when 'stage' then 100
      when 'notas' then 20000 when 'next_action' then 1000 else 100 end;
    if length(v_patch->>v_key)>v_limit then raise exception 'El campo % supera el tamaño permitido.',v_key using errcode='22023'; end if;
  end loop;
  for v_key in select unnest(array['phone','email','budget','project','campaign','next_action','next_action_at']) loop
    if v_patch ? v_key and v_patch->>v_key='' then v_patch:=jsonb_set(v_patch,array[v_key],'null'::jsonb); end if;
  end loop;
  if v_patch ? 'presupuesto' and (jsonb_typeof(v_patch->'presupuesto')<>'number'
      or (v_patch->>'presupuesto') !~ '^\d+$' or (v_patch->>'presupuesto')::numeric>9007199254740991) then
    raise exception 'El presupuesto debe ser un entero positivo o cero.' using errcode='22023'; end if;
  if nullif(v_patch->>'phone','') is not null and length(regexp_replace(v_patch->>'phone','[^0-9]','','g')) not between 7 and 15 then
    raise exception 'El teléfono debe tener entre 7 y 15 dígitos.' using errcode='22023'; end if;
  if nullif(v_patch->>'email','') is not null and v_patch->>'email' !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'El correo no es válido.' using errcode='22023'; end if;
  -- Same UUID serializes retries across workers; IDs can never be replayed in
  -- another company or with a different initial request.
  perform pg_advisory_xact_lock(hashtextextended('platform_crm:'||p_lead_id::text,719002));
  select * into v_before from public.leads where id=p_lead_id for update;
  v_exists:=found;
  v_fingerprint:=md5(v_patch::text);
  if p_create and v_exists then
    if v_before.organization_id=p_organization_id and v_before.deleted_at is null and exists(
      select 1 from public.audit_log where actor_id=p_actor_id and organization_id=p_organization_id and entity_id=p_lead_id
        and metadata->>'source'='platform_crm' and metadata->>'operation'='create'
        and metadata->>'request_fingerprint'=v_fingerprint) then
      return jsonb_build_object('lead',public.fn_platform_crm_read(p_actor_id,p_organization_id,p_lead_id)->'lead','audit_saved',true,'replayed',true);
    end if;
    raise exception 'El identificador ya fue utilizado. Recarga el cliente.' using errcode='40001';
  end if;
  if not p_create then
    if not v_exists or v_before.organization_id<>p_organization_id or v_before.deleted_at is not null then
      raise exception 'El cliente no existe en esta empresa.' using errcode='P0002'; end if;
    if p_expected_updated_at is null or v_before.updated_at is distinct from p_expected_updated_at then
      raise exception 'El cliente cambió en otra sesión. Recárgalo antes de guardar.' using errcode='40001'; end if;
  end if;
  v_pipeline:=public.fn_platform_crm_pipeline(p_organization_id);
  if p_create then
    v_patch:=jsonb_build_object('stage',v_pipeline->0->>'name','presupuesto',0,'source','manual')||v_patch;
  end if;
  v_next:=jsonb_populate_record(v_before,v_patch);
  if nullif(btrim(v_next.name),'') is null or length(btrim(v_next.name))<2 then
    raise exception 'Escribe el nombre del cliente (al menos 2 caracteres).' using errcode='22023'; end if;
  if (p_create or v_patch ? 'stage') and not exists(select 1 from jsonb_array_elements(v_pipeline) s where s->>'name'=v_next.stage) then
    raise exception 'La etapa no pertenece al pipeline de esta empresa.' using errcode='22023'; end if;
  if v_next.stage in ('Zoom Agendado','Visita Agendada') and
      (p_create or v_before.stage is distinct from v_next.stage or v_patch ? 'next_action_at') then
    if v_next.next_action_at is null then
      raise exception 'Esta etapa requiere fecha y hora de la próxima cita.' using errcode='22023';
    end if;
    if v_next.stage='Zoom Agendado' then v_next.selected_time:=v_next.next_action_at;
    else v_next.visita_at:=v_next.next_action_at; end if;
  end if;
  if p_create or v_patch ? 'asesor_id' then
    if v_next.asesor_id is null then raise exception 'Selecciona un asesor activo de esta empresa.' using errcode='22023'; end if;
    select * into v_assignee from public.profiles where id=v_next.asesor_id and organization_id=p_organization_id and active is true for share;
    if not found then raise exception 'El asesor no está activo en esta empresa.' using errcode='22023'; end if;
    v_next.asesor_name:=v_assignee.name;
  end if;
  select coalesce(name,'Operador Stratos') into v_actor from public.profiles where id=p_actor_id;
  v_actor:=coalesce(v_actor,'Operador Stratos');
  v_action:=case when p_create then 'Cliente registrado' when v_before.stage is distinct from v_next.stage then 'Etapa: '||v_before.stage||' → '||v_next.stage
    when v_before.asesor_id is distinct from v_next.asesor_id then 'Cliente reasignado a '||v_next.asesor_name else 'Datos del cliente actualizados' end;
  v_history:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'action',v_action,'date',now(),'by',v_actor,
    'actor_id',p_actor_id,'source','platform_crm'))||case when jsonb_typeof(v_before.action_history)='array' then v_before.action_history else '[]'::jsonb end;
  if p_create then
    insert into public.leads(id,organization_id,name,phone,email,stage,asesor_id,asesor_name,budget,presupuesto,project,campaign,
      source,notas,next_action,next_action_at,selected_time,visita_at,action_history,is_new,score)
    values(p_lead_id,p_organization_id,v_next.name,nullif(v_next.phone,''),nullif(v_next.email,''),v_next.stage,v_next.asesor_id,v_next.asesor_name,
      v_next.budget,v_next.presupuesto,v_next.project,v_next.campaign,v_next.source,v_next.notas,v_next.next_action,v_next.next_action_at,
      v_next.selected_time,v_next.visita_at,v_history,true,5)
      returning * into v_after;
  else
    -- Only touched business columns enter SET. UPDATE OF stage/phone/date
    -- triggers must not run just because an operator edited an unrelated note.
    v_columns:=array(select jsonb_object_keys(v_patch));
    if v_patch ? 'asesor_id' then v_columns:=v_columns||array['asesor_name']; end if;
    if v_next.selected_time is distinct from v_before.selected_time then v_columns:=v_columns||array['selected_time']; end if;
    if v_next.visita_at is distinct from v_before.visita_at then v_columns:=v_columns||array['visita_at']; end if;
    select string_agg(format('%I=($1).%I',c,c),',') into v_set from unnest(v_columns) c;
    v_next.action_history:=v_history;
    execute 'update public.leads set '||v_set||',action_history=($1).action_history,updated_at=clock_timestamp() where id=$2 and organization_id=$3 returning *'
      into v_after using v_next,p_lead_id,p_organization_id;
  end if;
  -- RETURNING does not include writes performed by AFTER triggers. The legacy
  -- name-to-advisor trigger can also replace an explicit UUID when names are
  -- duplicated. Verify the final row before recording success or real audit.
  select * into v_after from public.leads where id=p_lead_id;
  if not found or v_after.organization_id is distinct from p_organization_id or v_after.deleted_at is not null then
    raise exception 'Las reglas de la empresa cambiaron el cliente. Recarga antes de guardar.' using errcode='40001';
  end if;
  if (p_create or v_patch ? 'asesor_id') and
      (v_after.asesor_id is distinct from v_next.asesor_id or v_after.asesor_name is distinct from v_next.asesor_name) then
    raise exception 'Las reglas de la empresa cambiaron el asesor seleccionado. Revisa los nombres duplicados o selecciona otro asesor.' using errcode='40001';
  end if;
  select coalesce(jsonb_object_agg(n.key,jsonb_build_object('old',o.value,'new',n.value)),'{}'::jsonb) into v_diff
    from jsonb_each(to_jsonb(v_after)) n left join jsonb_each(to_jsonb(v_before)) o on o.key=n.key
    where n.value is distinct from o.value and n.key not in ('action_history','created_at','updated_at');
  insert into public.audit_log(actor_id,actor_name,actor_role,organization_id,entity_type,entity_id,action,changed_fields,metadata)
    values(p_actor_id,v_actor,'platform_admin',p_organization_id,'lead',p_lead_id,case when p_create then 'INSERT' else 'UPDATE' end,v_diff,
      jsonb_build_object('source','platform_crm','operation',case when p_create then 'create' else 'update' end,
        'request_fingerprint',case when p_create then v_fingerprint else null end));
  return jsonb_build_object('lead',public.fn_platform_crm_read(p_actor_id,p_organization_id,p_lead_id)->'lead','audit_saved',true,'replayed',false);
end $$;

revoke all on function public.fn_platform_crm_assert(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fn_platform_crm_pipeline(uuid) from public,anon,authenticated;
revoke all on function public.fn_platform_crm_read(uuid,uuid,uuid,integer,integer,text,text,uuid) from public,anon,authenticated;
revoke all on function public.fn_platform_crm_mutate(uuid,uuid,uuid,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.fn_platform_crm_assert(uuid,uuid) to service_role;
grant execute on function public.fn_platform_crm_pipeline(uuid) to service_role;
grant execute on function public.fn_platform_crm_read(uuid,uuid,uuid,integer,integer,text,text,uuid) to service_role;
grant execute on function public.fn_platform_crm_mutate(uuid,uuid,uuid,timestamptz,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
