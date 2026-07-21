-- 113: Copilot de MARKETING para el ADMIN (Alex) + "mi día" del equipo + evidencia desde el Copilot.
--
-- Contexto: Alex Velázquez es super_admin PERO es el admin de MARKETING de Duke. Su Copilot
-- estaba cayendo en el cerebro de VENTAS (leads/brokers) porque el ruteo sólo miraba role='marketing'.
-- Aquí:
--   1) profiles.is_marketing_admin (bool, default false) — marca a los admins que operan del lado
--      marketing. Alex = true. El front (telegram.js) rutea al Copilot de marketing cuando
--      role='marketing' O is_marketing_admin. ADITIVO: ningún admin de ventas cambia (default false).
--   2) fn_mkt_my_day se vuelve CONSCIENTE DEL ROL: un super_admin/admin ve el "día" de TODO el
--      equipo (con el nombre de cada responsable); el rol `marketing` sigue viendo sólo lo suyo.
--      Antes, Alex (0 tareas propias) veía "Nada pendiente para hoy" aunque el equipo tuviera trabajo.
--   3) mkt_attach_evidence(p_path, p_tipo) — RPC determinista (SECURITY DEFINER, se resuelve por
--      auth.uid()) para adjuntar una foto/video de evidencia DESDE el Copilot a la última tarea
--      completada del propio usuario. Sólo toca tareas del propio caller (assignee_id=auth.uid()).
--
-- Reversible: git revert del archivo + (con OK humano) 'alter table profiles drop column
-- is_marketing_admin' y restaurar fn_mkt_my_day desde el historial. mkt_attach_evidence se puede
-- 'drop function'. No toca nada de ventas ni del Copilot de asesores.
-- APLICADA a stratos-prod (glulgyhkrqpykxmujodb) el 21-jul-2026.

-- 1) Bandera de admin de marketing --------------------------------------------------------------
alter table public.profiles add column if not exists is_marketing_admin boolean not null default false;
update public.profiles set is_marketing_admin = true
  where id = '50a045dc-d528-4840-a9f7-503653d94b0c';  -- Alex Velázquez (super_admin, admin de marketing)

-- 2) "Mi día" consciente del rol (admin = vista de equipo) ---------------------------------------
create or replace function public.fn_mkt_my_day(p_profile_id uuid)
 returns text
 language plpgsql
 stable
as $function$
declare
  v_org uuid; v_name text; v_role text; v_is_admin boolean; v_hoy date;
  r record; out_txt text := ''; sec text;
begin
  select organization_id, name, role into v_org, v_name, v_role
    from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_is_admin := coalesce(v_role in ('super_admin','admin'), false);
  v_hoy := (now() at time zone 'America/Cancun')::date;

  -- Rodaje de hoy — siempre de toda la marca/equipo
  for r in select nombre, coalesce(locacion,'') loc from mkt_pipeline_items
           where organization_id=v_org and deleted_at is null and fecha_rodaje=v_hoy loop
    out_txt := out_txt || 'Rodaje de hoy — ' || r.nombre || case when r.loc<>'' then ' · '||r.loc else '' end || E'\n';
  end loop;

  -- VENCIDAS
  sec := '';
  for r in select t.titulo, t.due_at, coalesce(pa.name,'') quien from mkt_tasks t
           left join profiles pa on pa.id = t.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id)
             and t.estado<>'hecha' and t.due_at is not null
             and (t.due_at at time zone 'America/Cancun')::date < v_hoy
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at limit (case when v_is_admin then 12 else 5 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || ' — venció el ' || to_char(r.due_at at time zone 'America/Cancun','DD Mon') || E'\n';
  end loop;
  if sec <> '' then out_txt := out_txt || E'\nVENCIDAS\n' || sec; end if;

  -- PARA HOY
  sec := '';
  for r in select t.titulo, t.due_at, coalesce(pa.name,'') quien,
             (t.depends_on is not null and exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado='hecha')) as unlocked
           from mkt_tasks t
           left join profiles pa on pa.id = t.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id)
             and t.estado<>'hecha'
             and (t.due_at is null or (t.due_at at time zone 'America/Cancun')::date = v_hoy)
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at nulls last limit (case when v_is_admin then 15 else 8 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || case when r.due_at is not null then ' · '||to_char(r.due_at at time zone 'America/Cancun','HH24:MI') else '' end
        || case when r.unlocked then ' — desbloqueada, ya puedes avanzar' else '' end || E'\n';
  end loop;
  out_txt := out_txt || E'\n' || case when v_is_admin then 'PARA HOY (equipo)' else 'PARA HOY' end || E'\n'
          || case when sec='' then E'Nada pendiente para hoy.\n' else sec end;

  -- BLOQUEADAS
  sec := '';
  for r in select t.titulo, coalesce(pa.name,'') quien, d.titulo dep_titulo, coalesce(pd.name,'') dep_quien,
                  greatest(0, (v_hoy - (d.created_at at time zone 'America/Cancun')::date)) dias
           from mkt_tasks t
           join mkt_tasks d on d.id = t.depends_on and d.estado<>'hecha'
           left join profiles pa on pa.id = t.assignee_id
           left join profiles pd on pd.id = d.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id) and t.estado<>'hecha'
           limit (case when v_is_admin then 8 else 5 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || ' — esperando «' || r.dep_titulo || '»'
        || case when r.dep_quien<>'' then ' de '||r.dep_quien else '' end
        || ' · hace ' || r.dias || E' días\n';
  end loop;
  if sec <> '' then
    out_txt := out_txt || E'\n' || case when v_is_admin then 'BLOQUEADAS DEL EQUIPO' else 'BLOQUEADAS (no dependen de ti)' end || E'\n' || sec;
  end if;

  return coalesce(nullif(trim(out_txt),''), 'Sin pendientes por ahora.');
end $function$;

-- 3) Adjuntar evidencia (foto/video) desde el Copilot -------------------------------------------
-- Determinista: se resuelve por auth.uid() (no depende del LLM). Adjunta a la ÚLTIMA tarea
-- 'hecha' del propio usuario que aún no tenga evidencia; si no hay, a la última 'hecha'.
create or replace function public.mkt_attach_evidence(p_path text, p_tipo text default 'foto')
 returns text
 language plpgsql
 security definer
 set search_path = public
as $function$
declare v_uid uuid; v_org uuid; v_task uuid; v_titulo text;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id into v_org from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select id, titulo into v_task, v_titulo from mkt_tasks
    where organization_id=v_org and assignee_id=v_uid and deleted_at is null
      and estado='hecha' and (evidencia_url is null or evidencia_url='')
    order by updated_at desc limit 1;
  if v_task is null then
    select id, titulo into v_task, v_titulo from mkt_tasks
      where organization_id=v_org and assignee_id=v_uid and deleted_at is null and estado='hecha'
      order by updated_at desc limit 1;
  end if;
  if v_task is null then
    return 'Guardé tu evidencia. Cuando marques una tarea como hecha, la vinculo a tu reporte.';
  end if;

  update mkt_tasks
    set evidencia_url = p_path,
        evidencia_tipo = coalesce(nullif(p_tipo,''),'foto'),
        updated_at = now()
    where id = v_task;
  return 'Evidencia adjuntada a «' || v_titulo || '». Suma a tu reporte.';
end $function$;

grant execute on function public.mkt_attach_evidence(text, text) to authenticated;
