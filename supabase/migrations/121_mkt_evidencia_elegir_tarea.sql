-- Migración 121 (marketing): al enviar evidencia, ELEGIR a cuál tarea pertenece (ya no adivinar).
--
-- Bug real (captura de Ángel 21-jul): la foto se pegaba a "la última tarea hecha SIN evidencia". Si
-- esa tarea ya tenía evidencia, la foto caía en OTRA tarea equivocada («Ficha técnica membretada»
-- cuando en realidad era para «Prueba de cadena: elegir la foto»). No había forma de saber para cuál
-- tarea era la foto. Fix: el front sube la foto y PREGUNTA "¿a cuál de tus tareas pertenece?" con un
-- botón por tarea; el usuario elige y se llama a mkt_attach_evidence_to con el task_id explícito.
-- Aditivo/reversible.

-- 1) Candidatas: las tareas del propio usuario para vincular una evidencia (recientes), ordenadas
--    poniendo primero las HECHAS SIN evidencia (lo más probable), luego el resto.
create or replace function public.mkt_evidence_candidates()
returns table(task_id uuid, titulo text, estado text, tiene_evidencia boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_org uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return; end if;
  select organization_id into v_org from profiles where id = v_uid;
  if v_org is null then return; end if;
  return query
  select t.id, t.titulo, t.estado,
         (t.evidencia_url is not null and t.evidencia_url <> '') as tiene_evidencia,
         t.updated_at
  from mkt_tasks t
  where t.organization_id = v_org and t.assignee_id = v_uid and t.deleted_at is null
    and t.updated_at > now() - interval '21 days'
  order by
    case when t.estado='hecha' and (t.evidencia_url is null or t.evidencia_url='') then 0
         when t.estado<>'hecha' then 1
         else 2 end,
    t.updated_at desc
  limit 8;
end $function$;

-- 2) CORE: adjuntar evidencia a una tarea ESPECÍFICA (elegida por el usuario). Si no estaba hecha,
--    la marca hecha (dispara la cadena). Avisa al líder y a quien sigue la tarea, con la foto.
create or replace function public.mkt_attach_evidence_to(p_task_id uuid, p_path text, p_tipo text default 'foto')
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_quien text; v_titulo text; v_estado text; v_task uuid;
  r record; v_hoy text; v_tipo text; v_dedupe text; v_rid uuid; v_texto text; v_meta jsonb;
  v_notified boolean := false;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name into v_org, v_quien from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_tipo := coalesce(nullif(p_tipo,''),'foto');

  select id, titulo, estado into v_task, v_titulo, v_estado from mkt_tasks
    where id = p_task_id and organization_id = v_org and assignee_id = v_uid and deleted_at is null;
  if v_task is null then return 'No encontré esa tarea entre las tuyas.'; end if;

  update mkt_tasks
    set evidencia_url = p_path, evidencia_tipo = v_tipo, evidencia_aprobada = false,
        estado = case when estado <> 'hecha' then 'hecha' else estado end,  -- enviar evidencia = hecha (dispara cadena)
        updated_at = now()
    where id = v_task;

  v_hoy := to_char(now() at time zone 'America/Cancun','YYYYMMDD');
  for r in
    select distinct on (pid) pid, pname, chat, motivo from (
      select p.id as pid, p.name as pname, p.telegram_chat_id as chat, 'cadena'::text as motivo, 1 as pri
      from mkt_tasks t join profiles p on p.id = t.assignee_id
      where t.depends_on = v_task and t.deleted_at is null and t.estado <> 'hecha' and p.id <> v_uid
      union all
      select a.id, a.name, a.telegram_chat_id, 'lider'::text, 2 as pri
      from profiles a
      where a.organization_id = v_org and a.is_marketing_admin = true and a.id <> v_uid
    ) s order by pid, pri
  loop
    if r.motivo = 'cadena' then
      v_texto := (case when v_tipo='video' then '🎬 ' else '📸 ' end)||coalesce(v_quien,'Tu compañero')||
                 ' adjuntó evidencia de «'||v_titulo||'» — es lo que necesitas para tu parte.';
      v_dedupe := 'mkt_evidchain:'||v_task||':'||r.pid||':'||v_hoy;
      v_meta := jsonb_build_object('kind','evidence_seen','task_id',v_task,'from_name',v_quien);
    else
      v_texto := (case when v_tipo='video' then '🎬 ' else '📸 ' end)||coalesce(v_quien,'Alguien del equipo')||
                 ' adjuntó evidencia de «'||v_titulo||'».';
      v_dedupe := 'mkt_evid_lider:'||v_task||':'||r.pid||':'||v_hoy;
      v_meta := jsonb_build_object('kind','evidence_review','task_id',v_task,'from_name',v_quien,'can_comment',true);
    end if;
    if r.chat is not null and not exists (select 1 from proactive_reminders x where x.dedupe_key = v_dedupe) then
      begin
        insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
          values (v_org, r.pid, r.pname, 'personal', now(), 'pending', jsonb_build_object('text', v_texto), v_dedupe)
          returning id into v_rid;
        update proactive_reminders set status='sent', sent_at=now() where id = v_rid;
        insert into tg_bot_activity (telegram_chat_id, role, content, media_path, media_type, meta)
          values (r.chat, 'ai', v_texto, p_path, v_tipo, v_meta);
        v_notified := true;
      exception when others then null;
      end;
    end if;
  end loop;

  return 'Vinculé tu '||(case when v_tipo='video' then 'video' else 'foto' end)||' a «'||v_titulo||'».'||
    case when v_notified then ' Ya les llegó a tu líder y a quien sigue la tarea (en su Copilot).' else '' end;
end $function$;

-- 3) La versión de 2 args queda como FALLBACK (resuelve la última hecha sin evidencia y delega en _to).
create or replace function public.mkt_attach_evidence(p_path text, p_tipo text default 'foto')
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid; v_org uuid; v_task uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id into v_org from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select id into v_task from mkt_tasks
    where organization_id=v_org and assignee_id=v_uid and deleted_at is null
      and estado='hecha' and (evidencia_url is null or evidencia_url='')
    order by updated_at desc limit 1;
  if v_task is null then
    select id into v_task from mkt_tasks
      where organization_id=v_org and assignee_id=v_uid and deleted_at is null and estado='hecha'
      order by updated_at desc limit 1;
  end if;
  if v_task is null then
    return 'No encontré una tarea completada tuya para vincular esta evidencia. Marca primero la tarea como hecha y vuelve a enviarla.';
  end if;
  return public.mkt_attach_evidence_to(v_task, p_path, p_tipo);
end $function$;
