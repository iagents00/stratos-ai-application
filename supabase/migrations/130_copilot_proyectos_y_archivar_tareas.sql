-- ─────────────────────────────────────────────────────────────────────────────
-- Copilot: gestionar PROYECTOS (crear/listar/archivar/restaurar) y ARCHIVAR tareas.
-- Regla del AIOS: NADA se borra de verdad. "Eliminar" = deleted_at (reversible).
-- Todo org-scoped. Aditivo: no toca ninguna función existente.
-- ─────────────────────────────────────────────────────────────────────────────
alter table mkt_projects add column if not exists deleted_by uuid;
alter table mkt_tasks    add column if not exists deleted_by uuid;

-- 1) CREAR PROYECTO ───────────────────────────────────────────────────────────
create or replace function public.fn_mkt_create_project(
  p_profile_id uuid, p_nombre text, p_descripcion text default null,
  p_due date default null, p_brand text default null)
returns text language plpgsql as $$
declare v_org uuid; v_brand record; v_existe text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_nombre),'') = '' then return 'Decime cómo se va a llamar el proyecto.'; end if;

  select nombre into v_existe from mkt_projects
   where organization_id = v_org and deleted_at is null and lower(trim(nombre)) = lower(trim(p_nombre)) limit 1;
  if v_existe is not null then
    return 'Ya existe un proyecto llamado «'||v_existe||'». Si querés otro, ponele un nombre distinto.';
  end if;

  select * into v_brand from _mkt_find_brand(v_org, p_brand);

  insert into mkt_projects (organization_id, brand_id, nombre, descripcion, due_date, estado, created_by)
  values (v_org, v_brand.id, trim(p_nombre), nullif(trim(coalesce(p_descripcion,'')),''), p_due, 'activo', p_profile_id);

  return '✓ Proyecto creado: «'||trim(p_nombre)||'»'
      || coalesce(' · entrega '||to_char(p_due,'DD Mon'),'')
      || '. Ya podés asignarle tareas diciendo «ponle una tarea al proyecto '||trim(p_nombre)||'…».';
end $$;

-- 2) LISTAR PROYECTOS ─────────────────────────────────────────────────────────
create or replace function public.fn_mkt_list_projects(p_profile_id uuid)
returns text language plpgsql as $$
declare v_org uuid; v_txt text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select count(*), string_agg(linea, E'\n' order by linea)
    into v_n, v_txt
  from (
    select '• '||pr.nombre
           || coalesce(' · entrega '||to_char(pr.due_date,'DD Mon'),'')
           || ' · '||(select count(*) from mkt_tasks t
                       where t.project_id = pr.id and t.deleted_at is null and t.estado <> 'hecha')::text
           ||' tarea(s) pendiente(s)' as linea
    from mkt_projects pr
    where pr.organization_id = v_org and pr.deleted_at is null
  ) s;

  if coalesce(v_n,0) = 0 then
    return 'No hay proyectos todavía. Decime «crea el proyecto …» y lo armo.';
  end if;
  return 'Proyectos activos ('||v_n||'):'||E'\n'||v_txt;
end $$;

-- 3) ARCHIVAR PROYECTO (reversible; pide confirmación si tiene tareas) ────────
create or replace function public.fn_mkt_delete_project(
  p_profile_id uuid, p_nombre text, p_confirm boolean default false)
returns text language plpgsql as $$
declare v_org uuid; v_n int; v_pr record; v_tareas int; v_ts timestamptz; v_lista text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_nombre),'') = '' then return '¿Cuál proyecto querés archivar?'; end if;

  select count(*) into v_n from mkt_projects
   where organization_id = v_org and deleted_at is null and nombre ilike '%'||trim(p_nombre)||'%';

  if v_n = 0 then
    return 'No encontré ningún proyecto que se llame «'||trim(p_nombre)||'».';
  elsif v_n > 1 then
    select string_agg('• '||nombre, E'\n' order by nombre) into v_lista from mkt_projects
     where organization_id = v_org and deleted_at is null and nombre ilike '%'||trim(p_nombre)||'%';
    return 'Hay '||v_n||' proyectos que coinciden con «'||trim(p_nombre)||'»:'||E'\n'||v_lista||E'\n'||'¿Cuál de esos?';
  end if;

  select * into v_pr from mkt_projects
   where organization_id = v_org and deleted_at is null and nombre ilike '%'||trim(p_nombre)||'%' limit 1;

  select count(*) into v_tareas from mkt_tasks
   where organization_id = v_org and project_id = v_pr.id and deleted_at is null and estado <> 'hecha';

  if v_tareas > 0 and not coalesce(p_confirm,false) then
    return 'Ojo: «'||v_pr.nombre||'» tiene '||v_tareas||' tarea(s) sin terminar. Si lo archivo, esas tareas también se archivan y salen de Mi Día. ¿Lo archivo igual? (decime que sí y lo hago)';
  end if;

  v_ts := now();
  update mkt_projects set deleted_at = v_ts, deleted_by = p_profile_id, updated_at = v_ts
   where id = v_pr.id and organization_id = v_org;
  update mkt_tasks set deleted_at = v_ts, deleted_by = p_profile_id, updated_at = v_ts
   where project_id = v_pr.id and organization_id = v_org and deleted_at is null;

  return '✓ Proyecto archivado: «'||v_pr.nombre||'»'
      || case when v_tareas > 0 then ' (y sus '||v_tareas||' tarea(s) pendientes)' else '' end
      || '. No se borró nada: si te arrepentís, decime «restaura el proyecto '||v_pr.nombre||'».';
end $$;

-- 4) RESTAURAR PROYECTO ───────────────────────────────────────────────────────
create or replace function public.fn_mkt_restore_project(p_profile_id uuid, p_nombre text)
returns text language plpgsql as $$
declare v_org uuid; v_pr record; v_ts timestamptz; v_tareas int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select * into v_pr from mkt_projects
   where organization_id = v_org and deleted_at is not null and nombre ilike '%'||trim(coalesce(p_nombre,''))||'%'
   order by deleted_at desc limit 1;
  if v_pr.id is null then return 'No encontré ningún proyecto archivado que se llame «'||coalesce(p_nombre,'')||'».'; end if;

  v_ts := v_pr.deleted_at;
  update mkt_projects set deleted_at = null, deleted_by = null, updated_at = now() where id = v_pr.id;
  update mkt_tasks set deleted_at = null, deleted_by = null, updated_at = now()
   where project_id = v_pr.id and organization_id = v_org and deleted_at = v_ts;
  get diagnostics v_tareas = row_count;

  return '✓ Proyecto restaurado: «'||v_pr.nombre||'»'
      || case when v_tareas > 0 then ' (con sus '||v_tareas||' tarea(s))' else '' end||'.';
end $$;

-- 5) ARCHIVAR TAREA (reversible) ──────────────────────────────────────────────
create or replace function public.fn_mkt_delete_task(p_profile_id uuid, p_titulo text)
returns text language plpgsql as $$
declare v_org uuid; v_n int; v_t record; v_lista text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return '¿Cuál tarea querés eliminar?'; end if;

  select count(*) into v_n from mkt_tasks
   where organization_id = v_org and deleted_at is null and titulo ilike '%'||trim(p_titulo)||'%';

  if v_n = 0 then
    return 'No encontré ninguna tarea que diga «'||trim(p_titulo)||'».';
  elsif v_n > 1 then
    select string_agg('• '||titulo, E'\n' order by created_at desc) into v_lista from mkt_tasks
     where organization_id = v_org and deleted_at is null and titulo ilike '%'||trim(p_titulo)||'%';
    return 'Hay '||v_n||' tareas que coinciden:'||E'\n'||v_lista||E'\n'||'¿Cuál elimino? Decime el título más completo.';
  end if;

  select * into v_t from mkt_tasks
   where organization_id = v_org and deleted_at is null and titulo ilike '%'||trim(p_titulo)||'%' limit 1;

  update mkt_tasks set deleted_at = now(), deleted_by = p_profile_id, updated_at = now()
   where id = v_t.id and organization_id = v_org;

  return '✓ Tarea eliminada: «'||v_t.titulo||'». Sale de Mi Día y de los avisos. No se borró de verdad: decime «restaura la tarea '||v_t.titulo||'» si la necesitás de vuelta.';
end $$;

-- 6) RESTAURAR TAREA ──────────────────────────────────────────────────────────
create or replace function public.fn_mkt_restore_task(p_profile_id uuid, p_titulo text)
returns text language plpgsql as $$
declare v_org uuid; v_t record;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select * into v_t from mkt_tasks
   where organization_id = v_org and deleted_at is not null and titulo ilike '%'||trim(coalesce(p_titulo,''))||'%'
   order by deleted_at desc limit 1;
  if v_t.id is null then return 'No encontré ninguna tarea archivada que diga «'||coalesce(p_titulo,'')||'».'; end if;

  update mkt_tasks set deleted_at = null, deleted_by = null, updated_at = now() where id = v_t.id;
  return '✓ Tarea restaurada: «'||v_t.titulo||'». Vuelve a Mi Día.';
end $$;;
