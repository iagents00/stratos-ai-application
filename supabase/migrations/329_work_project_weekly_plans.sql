alter table public.work_deliveries
  add column scheduled_at timestamptz,
  add column schedule_zone text,
  add constraint work_deliveries_schedule_pair check (
    (scheduled_at is null and schedule_zone is null)
    or (scheduled_at is not null and schedule_zone is not null and due_on is not null)
  );

-- Keep the announced local hour when a manager reschedules the calendar day.
create function public.work_project_move_schedule()
returns trigger language plpgsql set search_path = '' as $$
declare
  wall_time time;
begin
  if new.due_on is distinct from old.due_on and old.scheduled_at is not null then
    if new.due_on is null then
      new.scheduled_at := null;
      new.schedule_zone := null;
    else
      wall_time := (old.scheduled_at at time zone old.schedule_zone)::time;
      new.scheduled_at := (new.due_on + wall_time) at time zone old.schedule_zone;
      if new.scheduled_at at time zone old.schedule_zone <> new.due_on + wall_time then
        raise exception 'La hora no existe en ese día y zona por el cambio de horario';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger work_project_move_schedule before update of due_on on public.work_deliveries
for each row execute function public.work_project_move_schedule();

create table public.work_week_plan_receipts (
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  schedule_zone text not null,
  plan jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, actor_id, request_id)
);
alter table public.work_week_plan_receipts enable row level security;
revoke all on public.work_week_plan_receipts from public, anon, authenticated;
revoke all on function public.work_project_move_schedule() from public, anon, authenticated;

create function public.work_project_apply_week(p_org uuid, p_request uuid, p_zone text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.work_project_role(p_org,actor);
  prior public.work_week_plan_receipts;
  entry jsonb;
  saved jsonb;
  row_id uuid;
  target_project uuid;
  executor_id uuid;
  local_day date;
  clock_text text;
  starts_at timestamptz;
  created_rows jsonb := '[]'::jsonb;
  reused_rows jsonb := '[]'::jsonb;
  result jsonb;
begin
  if actor_role is null or actor_role not in ('super_admin','admin','director','ceo')
  then raise exception 'Tu cuenta no puede aplicar un plan de proyectos' using errcode='42501'; end if;
  if p_request is null or p_zone is null or length(p_zone)>80 or not exists(
    select 1 from pg_catalog.pg_timezone_names where name=p_zone
  ) then raise exception 'Revisa la solicitud y la zona horaria' using errcode='22023'; end if;
  if jsonb_typeof(p_plan) is distinct from 'array' then raise exception 'El plan debe contener actividades'; end if;
  if jsonb_array_length(p_plan) not between 1 and 50 or octet_length(p_plan::text)>160000
  then raise exception 'El plan admite hasta 50 actividades'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org::text,329));
  select * into prior from public.work_week_plan_receipts r
    where r.organization_id=p_org and r.actor_id=actor and r.request_id=p_request;
  if found then
    if prior.plan is distinct from p_plan or prior.schedule_zone is distinct from p_zone
    then raise exception 'Este identificador pertenece a otro plan' using errcode='23505'; end if;
    return prior.receipt;
  end if;

  for entry in select value from jsonb_array_elements(p_plan) loop
    if jsonb_typeof(entry) <> 'object' or coalesce(entry->>'due_on','') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception 'Cada actividad necesita una fecha válida'; end if;
    if exists (select 1 from jsonb_object_keys(entry) k where k not in
       ('project_id','title','outcome','assignee_id','reviewer_id','due_on','time','criteria','priority'))
    then raise exception 'El plan contiene un campo no permitido'; end if;
    local_day := (entry->>'due_on')::date;
    target_project := (entry->>'project_id')::uuid;
    executor_id := (entry->>'assignee_id')::uuid;
    clock_text := nullif(entry->>'time','');
    if clock_text is not null and clock_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then raise exception 'Ingresa la hora con formato HH:MM'; end if;
    starts_at := (local_day + clock_text::time) at time zone p_zone;
    if clock_text is not null and starts_at at time zone p_zone <> local_day + clock_text::time
    then raise exception 'Una de las horas no existe en el día y la zona indicados'; end if;

    -- Reuse an exact commitment already booked for the same person and time.
    -- Check the same scope as the write path before looking up an existing row.
    if public.work_project_role(p_org,executor_id) is null
      or public.work_project_role(p_org,(entry->>'reviewer_id')::uuid) is null
    then raise exception 'Selecciona personas activas de tu organización' using errcode='42501'; end if;
    select d.id into row_id from public.work_deliveries d
      where d.organization_id=p_org and d.project_id=target_project and d.assignee_id=executor_id
        and lower(d.title)=lower(btrim(entry->>'title'))
        and d.due_on=local_day and d.scheduled_at is not distinct from starts_at
      order by d.created_at,d.id limit 1;
    if found then
      reused_rows := reused_rows || jsonb_build_array(row_id);
      continue;
    end if;

    row_id := gen_random_uuid();
    saved := public.work_project_action(p_org,'create_delivery',
      (entry - 'time') || jsonb_build_object('id',row_id,'executor','person'));
    if starts_at is not null then
      update public.work_deliveries set scheduled_at=starts_at, schedule_zone=p_zone
        where id=(saved->>'id')::uuid and organization_id=p_org;
    end if;
    created_rows := created_rows || jsonb_build_array(row_id);
  end loop;

  result := jsonb_build_object('created',created_rows,'reused',reused_rows);
  insert into public.work_week_plan_receipts(organization_id,actor_id,request_id,schedule_zone,plan,receipt)
    values(p_org,actor,p_request,p_zone,p_plan,result);
  return result;
end $$;

revoke all on function public.work_project_apply_week(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.work_project_apply_week(uuid,uuid,text,jsonb) to authenticated;

insert into public.front_rpc_registry(nombre,nota) values
 ('work_project_apply_week','Proyectos: confirmar y guardar un plan semanal con un recibo')
on conflict(nombre) do nothing;
