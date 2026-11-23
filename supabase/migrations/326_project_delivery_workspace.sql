-- Delivery workflow kept separate from marketing and weekly planning.
create table public.work_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  owner_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 160),
  outcome text not null check (char_length(outcome) between 1 and 2000),
  target_date date,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.work_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  outcome text not null check (char_length(outcome) between 1 and 2000),
  assignee_id uuid not null references public.profiles(id),
  reviewer_id uuid not null references public.profiles(id),
  executor text not null check (executor in ('person', 'progress_report')),
  state text not null default 'ready' check (state in ('ready', 'active', 'blocked', 'review', 'approved')),
  priority smallint not null default 2 check (priority between 1 and 3),
  due_on date,
  depends_on uuid,
  criteria jsonb not null,
  evidence text not null default '' check (char_length(evidence) <= 8000),
  note text not null default '' check (char_length(note) <= 2000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  foreign key (organization_id, project_id) references public.work_projects(organization_id, id),
  unique (project_id, id),
  foreign key (project_id, depends_on) references public.work_deliveries(project_id, id),
  check (depends_on is distinct from id)
);

create table public.work_delivery_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.work_deliveries(id),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table public.work_agent_runs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.work_deliveries(id),
  actor_id uuid not null references public.profiles(id),
  status text not null default 'running' check (status in ('running', 'failed', 'succeeded', 'expired')),
  expires_at timestamptz not null default now() + interval '2 minutes',
  delivery_version integer not null
);

create table public.work_project_focus (
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id),
  delivery_id uuid not null references public.work_deliveries(id),
  primary key (organization_id, profile_id)
);

create table public.work_project_help_usage (
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references public.profiles(id),
  day date not null,
  turns integer not null default 1,
  primary key (organization_id, actor_id, day)
);

create index work_projects_org_idx on public.work_projects (organization_id, created_at);
create index work_deliveries_org_idx on public.work_deliveries (organization_id, project_id);
create index work_deliveries_executor_idx on public.work_deliveries (organization_id, assignee_id);
create index work_deliveries_reviewer_idx on public.work_deliveries (organization_id, reviewer_id);
create index work_delivery_events_delivery_idx on public.work_delivery_events (delivery_id, id desc);
create unique index work_agent_runs_one_active_idx on public.work_agent_runs (delivery_id) where status = 'running';
create index work_agent_runs_actor_idx on public.work_agent_runs (actor_id, expires_at);

alter table public.work_projects enable row level security;
alter table public.work_deliveries enable row level security;
alter table public.work_delivery_events enable row level security;
alter table public.work_agent_runs enable row level security;
alter table public.work_project_focus enable row level security;
alter table public.work_project_help_usage enable row level security;
revoke all on public.work_projects, public.work_deliveries, public.work_delivery_events,
  public.work_agent_runs, public.work_project_focus, public.work_project_help_usage from public, anon, authenticated;

create function public.work_project_role(p_org uuid, p_actor uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select p.role::text from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_actor and p.organization_id = p_org and p.active is true and o.active is true
    and not coalesce(p.crm_only, false)
    and p.role in ('super_admin','admin','director','ceo','asesor','marketing','colaborador')
    and coalesce(o.meta_config #> '{features,projectWorkspace}',
      to_jsonb(o.id = 'cd478b82-d2ff-4543-981d-fb9d7aa1583e'::uuid)) = 'true'::jsonb
    and not (o.id = '00000000-0000-0000-0000-000000000001'::uuid
             and coalesce((to_jsonb(p)->>'is_marketing_admin')::boolean, false));
$$;

create function public.work_project_snapshot(p_org uuid, p_delivery uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.work_project_role(p_org, actor);
  manager boolean := actor_role in ('super_admin','admin','director','ceo');
  project_scope uuid;
  result jsonb;
begin
  if actor_role is null then raise exception 'Proyectos no está disponible para esta cuenta' using errcode='42501'; end if;
  if p_delivery is not null then
    select d.project_id into project_scope from public.work_deliveries d where d.id = p_delivery
      and d.organization_id = p_org and (manager or actor in (d.assignee_id,d.reviewer_id));
    if not found then raise exception 'Entrega no disponible' using errcode='42501'; end if;
  end if;

  with visible as materialized (
    select d.*,
      exists(select 1 from public.work_deliveries dep where dep.id = d.depends_on and dep.state <> 'approved') as waiting,
      (select r.expires_at from public.work_agent_runs r where r.delivery_id=d.id and r.status='running' and r.expires_at>now()) as running_until
    from public.work_deliveries d
    where d.organization_id = p_org and (manager or actor in (d.assignee_id,d.reviewer_id))
      and (project_scope is null or d.project_id = project_scope)
  ), projects as (
    select p.* from public.work_projects p where p.organization_id = p_org
      and (project_scope is null or p.id = project_scope)
      and (manager or exists(select 1 from visible d where d.project_id = p.id))
  )
  select jsonb_build_object(
    'manage', manager,
    'focus', (select f.delivery_id from public.work_project_focus f
      where f.organization_id=p_org and f.profile_id=actor and exists(select 1 from visible d where d.id=f.delivery_id)),
    'projects', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from projects p), '[]'),
    'deliveries', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at,d.id) from visible d), '[]'),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
      from public.profiles p where p.organization_id=p_org
      and (manager and public.work_project_role(p_org,p.id) is not null or p.id=actor or exists(
        select 1 from visible d where p.id in (d.assignee_id,d.reviewer_id)))), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from
      (select ev.* from public.work_delivery_events ev where ev.delivery_id=p_delivery order by ev.id desc limit 40) e), '[]')
  ) into result;
  return result;
end $$;

create function public.work_project_action(p_org uuid, p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.work_project_role(p_org,actor);
  manager boolean := actor_role in ('super_admin','admin','director','ceo');
  d public.work_deliveries;
  p public.work_projects;
  item_id uuid := (p_data->>'id')::uuid;
  selected_project uuid;
  executor_id uuid;
  reviewer uuid;
  dependency uuid;
  selected_executor text;
  title text := trim(p_data->>'title');
  outcome text := trim(p_data->>'outcome');
  summary text := trim(coalesce(p_data->>'note',''));
  evidence_text text := trim(coalesce(p_data->>'evidence',''));
  checked jsonb := p_data->'checked';
  requirements jsonb;
begin
  if actor_role is null then raise exception 'Proyectos no está disponible para esta cuenta' using errcode='42501'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>32000 or item_id is null
  then raise exception 'Solicitud de proyecto inválida' using errcode='22023'; end if;

  if p_action = 'create_project' then
    if not manager then raise exception 'Tu cuenta no puede crear proyectos' using errcode='42501'; end if;
    insert into public.work_projects(id,organization_id,owner_id,title,outcome,target_date)
      values(item_id,p_org,actor,title,outcome,nullif(p_data->>'target_date','')::date)
      on conflict (id) do nothing returning * into p;
    if not found then
      select * into p from public.work_projects where id=item_id and organization_id=p_org and owner_id=actor
        and work_projects.title=trim(p_data->>'title') and work_projects.outcome=trim(p_data->>'outcome')
        and target_date is not distinct from nullif(p_data->>'target_date','')::date;
      if not found then raise exception 'El identificador ya está en uso' using errcode='23505'; end if;
    end if;
    return to_jsonb(p);
  end if;

  if p_action in ('create_delivery','delegate') then
    if not manager then raise exception 'Tu cuenta no puede delegar entregas' using errcode='42501'; end if;
    executor_id := (p_data->>'assignee_id')::uuid;
    reviewer := (p_data->>'reviewer_id')::uuid;
    selected_executor := p_data->>'executor';
    if public.work_project_role(p_org,executor_id) is null or public.work_project_role(p_org,reviewer) is null
    then raise exception 'Selecciona personas activas de tu organización' using errcode='42501'; end if;
  end if;

  if p_action = 'create_delivery' then
    selected_project := (p_data->>'project_id')::uuid;
    dependency := nullif(p_data->>'depends_on','')::uuid;
    if not exists(select 1 from public.work_projects where id=selected_project and organization_id=p_org)
      or (dependency is not null and not exists(select 1 from public.work_deliveries where id=dependency and project_id=selected_project))
    then raise exception 'Proyecto o dependencia no disponible' using errcode='42501'; end if;
    requirements := p_data->'criteria';
    if jsonb_typeof(requirements) is distinct from 'array' then raise exception 'Escribe al menos un criterio'; end if;
    if jsonb_array_length(requirements) not between 1 and 12 or exists (
      select 1 from jsonb_array_elements(requirements) c where jsonb_typeof(c)<>'string' or char_length(trim(c #>> '{}')) not between 1 and 240
    ) then raise exception 'Escribe de 1 a 12 criterios de hasta 240 caracteres'; end if;
    select jsonb_agg(jsonb_build_object('text',trim(c.value),'done',false) order by c.idx) into requirements
      from jsonb_array_elements_text(requirements) with ordinality c(value,idx);
    insert into public.work_deliveries(id,organization_id,project_id,title,outcome,assignee_id,reviewer_id,executor,priority,due_on,depends_on,criteria)
      values(item_id,p_org,selected_project,title,outcome,executor_id,reviewer,selected_executor,
        coalesce((p_data->>'priority')::smallint,2),nullif(p_data->>'due_on','')::date,dependency,requirements)
      on conflict (id) do nothing returning * into d;
    if found then
      insert into public.work_delivery_events(delivery_id,actor_id,action) values(d.id,actor,'created');
    else
      select * into d from public.work_deliveries where id=item_id and organization_id=p_org and project_id=selected_project
        and work_deliveries.title=trim(p_data->>'title') and work_deliveries.outcome=trim(p_data->>'outcome')
        and assignee_id=executor_id and reviewer_id=reviewer and executor=selected_executor
        and due_on is not distinct from nullif(p_data->>'due_on','')::date
        and depends_on is not distinct from dependency and priority=coalesce((p_data->>'priority')::smallint,2)
        and (select jsonb_agg(c->'text' order by ord) from jsonb_array_elements(criteria) with ordinality t(c,ord))
          = (select jsonb_agg(c->'text' order by ord) from jsonb_array_elements(requirements) with ordinality t(c,ord))
        and exists(select 1 from public.work_delivery_events where delivery_id=item_id and actor_id=actor and action='created');
      if not found then raise exception 'El identificador ya está en uso' using errcode='23505'; end if;
    end if;
    return to_jsonb(d);
  end if;

  select * into d from public.work_deliveries where id=item_id and organization_id=p_org for update;
  if not found or not (manager or actor in (d.assignee_id,d.reviewer_id))
  then raise exception 'Entrega no disponible' using errcode='42501'; end if;

  if p_action = 'focus' then
    if actor <> d.assignee_id or d.state not in ('ready','active','blocked')
    then raise exception 'Elige una entrega que tengas asignada' using errcode='42501'; end if;
    insert into public.work_project_focus values(p_org,actor,d.id)
      on conflict (organization_id,profile_id) do update set delivery_id=excluded.delivery_id;
    return to_jsonb(d);
  end if;

  if d.version is distinct from (p_data->>'version')::integer
  then raise exception 'La entrega cambió. Actualiza antes de guardar' using errcode='40001'; end if;
  if exists(select 1 from public.work_agent_runs where delivery_id=d.id and status='running' and expires_at>now())
  then raise exception 'El agente está preparando el informe'; end if;
  if (p_action in ('start','save','submit') and actor <> d.assignee_id)
     or (p_action in ('approve','return') and actor <> d.reviewer_id)
     or (p_action in ('block','unblock') and not (manager or actor=d.assignee_id))
  then raise exception 'No tienes permiso para esta acción' using errcode='42501'; end if;
  if char_length(summary)>2000 or char_length(evidence_text)>8000 then raise exception 'El texto es demasiado largo'; end if;

  if p_action in ('start','submit') and exists(
    select 1 from public.work_deliveries where id=d.depends_on and state <> 'approved'
  ) then raise exception 'Primero resuelve la dependencia de esta entrega'; end if;

  case
    when p_action='delegate' and d.state in ('ready','active','blocked') then
      d.assignee_id := executor_id;
      d.reviewer_id := reviewer;
      d.executor := selected_executor;
      d.due_on := nullif(p_data->>'due_on','')::date;
      d.priority := coalesce((p_data->>'priority')::smallint,d.priority);
    when p_action='start' and d.state='ready' and d.executor='person' then d.state := 'active';
    when p_action in ('save','submit') and d.state='active' and d.executor='person' then
      if jsonb_typeof(checked) is distinct from 'array' then raise exception 'Revisa los criterios de la entrega'; end if;
      if jsonb_array_length(checked) <> jsonb_array_length(d.criteria)
        or exists(select 1 from jsonb_array_elements(checked) c where jsonb_typeof(c)<>'boolean')
      then raise exception 'Revisa los criterios de la entrega'; end if;
      select jsonb_agg(jsonb_set(c.value,'{done}',checked->((c.idx-1)::integer)) order by c.idx) into d.criteria
        from jsonb_array_elements(d.criteria) with ordinality c(value,idx);
      d.evidence := evidence_text;
      if p_action='submit' then
        if d.evidence='' or checked @> '[false]'::jsonb then raise exception 'Completa los criterios y adjunta evidencia'; end if;
        if public.work_project_role(p_org,d.reviewer_id) is null then raise exception 'Asigna un revisor activo'; end if;
        d.state := 'review';
      end if;
    when p_action='approve' and d.state='review' then
      if d.executor='progress_report' then
        if checked is distinct from (select jsonb_agg(true) from jsonb_array_elements(d.criteria))
        then raise exception 'Confirma cada criterio antes de aprobar el informe'; end if;
        select jsonb_agg(jsonb_set(c.value,'{done}','true') order by c.idx) into d.criteria
          from jsonb_array_elements(d.criteria) with ordinality c(value,idx);
      end if;
      d.state := 'approved'; d.approved_at := now();
    when p_action='return' and d.state='review' and summary<>'' then
      d.state := 'active'; d.note := summary;
    when p_action='block' and d.state in ('ready','active') and summary<>'' then
      d.state := 'blocked'; d.note := summary;
    when p_action='unblock' and d.state='blocked' and summary<>'' then
      d.state := 'ready'; d.note := '';
    else raise exception 'Este cambio no está disponible en el estado actual';
  end case;

  update public.work_deliveries set state=d.state, assignee_id=d.assignee_id, reviewer_id=d.reviewer_id,
    executor=d.executor, due_on=d.due_on, priority=d.priority, criteria=d.criteria, evidence=d.evidence,
    note=d.note, approved_at=d.approved_at, version=d.version+1 where id=d.id returning * into d;
  insert into public.work_delivery_events(delivery_id,actor_id,action,detail)
    values(d.id,actor,p_action,summary);
  return to_jsonb(d);
end $$;

-- Only the authenticated Edge worker may start or finish a run. A lease is
-- tied to its delivery version and expires even if the provider never replies.
create function public.work_project_agent(p_org uuid, p_actor uuid, p_id uuid, p_version integer,
  p_run uuid default null, p_report text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_role text := public.work_project_role(p_org,p_actor);
  d public.work_deliveries;
  r public.work_agent_runs;
begin
  select * into d from public.work_deliveries where organization_id=p_org and id=p_id for update;
  if not found or actor_role is null or (d.assignee_id <> p_actor and actor_role not in ('super_admin','admin','director','ceo'))
  then raise exception 'Entrega no disponible' using errcode='42501'; end if;
  if p_run is null then
    if d.executor <> 'progress_report' or d.state not in ('ready','active')
      or d.version is distinct from p_version
      or public.work_project_role(p_org,d.assignee_id) is null or public.work_project_role(p_org,d.reviewer_id) is null
      or exists(select 1 from public.work_deliveries where id=d.depends_on and state <> 'approved')
    then raise exception 'La entrega todavía no puede ejecutarse'; end if;

    -- Serialize per actor for the daily cap, including runs on different deliveries.
    perform pg_advisory_xact_lock(hashtextextended(p_actor::text,326));
    if (select count(*) from public.work_agent_runs where actor_id=p_actor and expires_at>now()-interval '1 day') >= 12
    then raise exception 'Alcanzaste el límite diario de informes'; end if;
    update public.work_agent_runs set status='expired' where delivery_id=d.id and status='running' and expires_at<=now();
    if exists(select 1 from public.work_agent_runs where delivery_id=d.id and status='running')
    then raise exception 'Ya hay un informe en curso'; end if;
    insert into public.work_agent_runs(delivery_id,actor_id,delivery_version) values(d.id,p_actor,d.version) returning * into r;
    insert into public.work_delivery_events(delivery_id,actor_id,action) values(d.id,p_actor,'agent_started');
    return jsonb_build_object('run',r.id);
  end if;

  select * into r from public.work_agent_runs
    where id=p_run and delivery_id=d.id and actor_id=p_actor and status='running' and expires_at>now();
  if not found or r.delivery_version<>d.version then raise exception 'La ejecución ya no está vigente'; end if;
  if p_report is null or char_length(trim(p_report)) not between 1 and 8000
    or public.work_project_role(p_org,d.reviewer_id) is null
  then
    update public.work_agent_runs set status='failed' where id=r.id;
    update public.work_deliveries set state='blocked', note='El agente no pudo confirmar el informe. Revisa el contexto y resuelve el bloqueo para reintentar.',
      version=version+1 where id=d.id;
    insert into public.work_delivery_events(delivery_id,actor_id,action) values(d.id,p_actor,'agent_failed');
    return jsonb_build_object('status','failed');
  end if;

  update public.work_agent_runs set status='succeeded' where id=r.id;
  update public.work_deliveries set state='review', evidence=trim(p_report), version=version+1 where id=d.id;
  insert into public.work_delivery_events(delivery_id,actor_id,action) values(d.id,p_actor,'agent_submitted');
  return jsonb_build_object('status','review');
end $$;

create function public.work_project_limit_help(p_org uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if public.work_project_role(p_org,p_actor) is null then return false; end if;
  delete from public.work_project_help_usage where organization_id=p_org and actor_id=p_actor and day<current_date-7;
  insert into public.work_project_help_usage(organization_id,actor_id,day)
    values(p_org,p_actor,current_date)
    on conflict (organization_id,actor_id,day) do update set turns=work_project_help_usage.turns+1
    where work_project_help_usage.turns<60;
  return found;
end $$;

revoke all on function public.work_project_limit_help(uuid,uuid) from public, anon, authenticated;
grant execute on function public.work_project_limit_help(uuid,uuid) to service_role;
revoke all on function public.work_project_role(uuid,uuid), public.work_project_snapshot(uuid,uuid),
  public.work_project_action(uuid,text,jsonb), public.work_project_agent(uuid,uuid,uuid,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.work_project_snapshot(uuid,uuid), public.work_project_action(uuid,text,jsonb) to authenticated;
grant execute on function public.work_project_agent(uuid,uuid,uuid,integer,uuid,text) to service_role;

insert into public.front_rpc_registry (nombre, nota) values
  ('work_project_snapshot','Proyectos: consultar entregas de la cuenta'),
  ('work_project_action','Proyectos: gestionar y revisar entregas')
on conflict (nombre) do nothing;
