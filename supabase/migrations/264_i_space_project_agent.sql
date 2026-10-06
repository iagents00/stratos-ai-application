-- Atomic, authenticated I Space project edits. Existing table RLS stays authoritative.
create table public.project_copilot_receipts (
 user_id uuid not null default auth.uid() references auth.users(id),
 request_id uuid not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table public.project_copilot_receipts enable row level security;
create policy project_copilot_receipts_own on public.project_copilot_receipts
 for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert on public.project_copilot_receipts to authenticated;

create or replace function public.apply_i_space_project_plan(p_request_id uuid,p_operations jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_org uuid; v_brand uuid; op jsonb; patch jsonb; v_id uuid; v_result jsonb:='[]'; v_cached jsonb;
 p public.mkt_projects%rowtype; t public.mkt_tasks%rowtype; previous_state text;
 touched uuid[]:='{}'; advancing uuid[]:='{}'; v_title text;
begin
 select organization_id into v_org from public.profiles where id=auth.uid();
 if v_org is distinct from 'cd478b82-d2ff-4543-981d-fb9d7aa1583e'::uuid then raise exception 'Espacio no autorizado'; end if;
 if p_request_id is null then raise exception 'Solicitud sin identificador'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_org::text,0));
 select result into v_cached from public.project_copilot_receipts where user_id=auth.uid() and request_id=p_request_id;
 if found then return v_cached; end if;
 if jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 120 then raise exception 'Lote no válido'; end if;
 if octet_length(p_operations::text)>250000 then raise exception 'Lote demasiado grande'; end if;
 select id into v_brand from public.mkt_brands where organization_id=v_org and activo=true order by orden limit 1;
 for op in select value from jsonb_array_elements(p_operations) loop
  v_id:=(op->>'id')::uuid; patch:=op->'patch';
  if v_id is null or jsonb_typeof(patch) is distinct from 'object' or v_id=any(touched) then raise exception 'Cambio no válido o repetido'; end if;
  touched:=array_append(touched,v_id);
  if op->>'entity'='project' then
   if exists(select 1 from jsonb_object_keys(patch) k where k not in ('nombre','descripcion','due_date','estado','drive_url','orden')) then raise exception 'Campo de proyecto no permitido'; end if;
   if (op->>'create')::boolean then
    p:=jsonb_populate_record(null::public.mkt_projects,jsonb_build_object('id',v_id,'organization_id',v_org,'brand_id',v_brand,'estado','activo','orden',0,'created_by',auth.uid(),'created_at',now(),'updated_at',now())||patch);
   else
    select * into p from public.mkt_projects where id=v_id and organization_id=v_org and deleted_at is null for update;
    if not found or p.updated_at is distinct from (op->>'expected_updated_at')::timestamptz then raise exception 'Proyecto modificado por otra sesión'; end if;
    p:=jsonb_populate_record(p,patch); p.updated_at:=now();
   end if;
   v_title:=p.nombre;
   if p.drive_url is not null and p.drive_url !~* '^https?://' then raise exception 'Enlace no válido'; end if;
   if (op->>'create')::boolean then
    if exists(select 1 from public.mkt_projects where organization_id=v_org and deleted_at is null and lower(trim(nombre))=lower(trim(p.nombre))) then raise exception 'Proyecto duplicado'; end if;
    insert into public.mkt_projects select p.*;
   else
    update public.mkt_projects set nombre=p.nombre,descripcion=p.descripcion,due_date=p.due_date,estado=p.estado,drive_url=p.drive_url,orden=p.orden,updated_at=p.updated_at where id=v_id and organization_id=v_org;
   end if;
  elsif op->>'entity'='task' then
   if exists(select 1 from jsonb_object_keys(patch) k where k not in ('titulo','descripcion','project_id','estado','prioridad','assignee_id','depends_on','due_at','drive_url')) then raise exception 'Campo de tarea no permitido'; end if;
   previous_state:=null;
   if (op->>'create')::boolean then
    t:=jsonb_populate_record(null::public.mkt_tasks,jsonb_build_object('id',v_id,'organization_id',v_org,'brand_id',v_brand,'estado','por_hacer','prioridad','media','created_by',auth.uid(),'created_at',now(),'updated_at',now(),'origen','web','avance_pct',0,'evidencia_aprobada',false)||patch);
    if coalesce(t.descripcion,'') !~ '(?n)^\s*- \[[ xX]\] .+' then raise exception 'La tarea requiere checklist'; end if;
   else
    select * into t from public.mkt_tasks where id=v_id and organization_id=v_org and deleted_at is null for update;
    if not found or t.updated_at is distinct from (op->>'expected_updated_at')::timestamptz then raise exception 'Tarea modificada por otra sesión'; end if;
    previous_state:=t.estado; t:=jsonb_populate_record(t,patch); t.updated_at:=now();
   end if;
   v_title:=t.titulo;
   if t.project_id is not null and not exists(select 1 from public.mkt_projects where id=t.project_id and organization_id=v_org and deleted_at is null) then raise exception 'Proyecto fuera del espacio'; end if;
   if t.assignee_id is not null and not exists(select 1 from public.profiles where id=t.assignee_id and organization_id=v_org) then raise exception 'Responsable fuera del espacio'; end if;
   if t.depends_on is not null and not exists(select 1 from public.mkt_tasks where id=t.depends_on and organization_id=v_org and deleted_at is null) then raise exception 'Dependencia fuera del espacio'; end if;
   if t.drive_url is not null and t.drive_url !~* '^https?://' then raise exception 'Enlace no válido'; end if;
   if t.estado='hecha' and coalesce(t.descripcion,'') ~ '(?n)^\s*- \[ \] .+' then raise exception 'Checklist incompleto'; end if;
   if t.estado='hecha' or (t.estado in ('en_curso','en_revision') and t.estado is distinct from previous_state) then advancing:=array_append(advancing,v_id); end if;
   t.avance_pct:=case when t.estado='hecha' then 100 when t.estado='en_revision' then 90 when t.estado='en_curso' then 25 else 0 end;
   if (op->>'create')::boolean then
    if exists(select 1 from public.mkt_tasks where organization_id=v_org and deleted_at is null and project_id is not distinct from t.project_id and lower(trim(titulo))=lower(trim(t.titulo))) then raise exception 'Tarea duplicada'; end if;
    insert into public.mkt_tasks select t.*;
   else
    update public.mkt_tasks set titulo=t.titulo,descripcion=t.descripcion,project_id=t.project_id,estado=t.estado,prioridad=t.prioridad,assignee_id=t.assignee_id,depends_on=t.depends_on,due_at=t.due_at,drive_url=t.drive_url,avance_pct=t.avance_pct,updated_at=t.updated_at where id=v_id and organization_id=v_org;
   end if;
  else raise exception 'Entidad no válida';
  end if;
  if coalesce(length(trim(v_title)),0) not between 1 and 240 or length(coalesce(patch->>'descripcion',''))>16000 then raise exception 'Título o descripción no válido'; end if;
  v_result:=v_result||jsonb_build_array(jsonb_build_object('id',v_id,'entity',op->>'entity','created',(op->>'create')::boolean,'title',v_title));
 end loop;
 if exists(select 1 from public.mkt_tasks x where x.id=any(advancing) and x.organization_id=v_org and
   (coalesce(x.descripcion,'') ~ '(?n)^Bloqueo: .+' or (x.depends_on is not null and not exists(select 1 from public.mkt_tasks d where d.id=x.depends_on and d.organization_id=v_org and d.deleted_at is null and d.estado='hecha')))) then raise exception 'Resuelve las dependencias y bloqueos antes de avanzar'; end if;
 if exists(with recursive chain as (
   select id,depends_on,array[id] path,false cycle from public.mkt_tasks where organization_id=v_org and id=any(touched) and deleted_at is null
   union all select d.id,d.depends_on,c.path||d.id,d.id=any(c.path) from chain c join public.mkt_tasks d on d.id=c.depends_on and d.organization_id=v_org and d.deleted_at is null where not c.cycle
  ) select 1 from chain where cycle) then raise exception 'La dependencia forma un ciclo'; end if;
 insert into public.project_copilot_receipts(user_id,request_id,result) values(auth.uid(),p_request_id,v_result);
 return v_result;
end $$;
revoke all on function public.apply_i_space_project_plan(uuid,jsonb) from public,anon;
grant execute on function public.apply_i_space_project_plan(uuid,jsonb) to authenticated;
