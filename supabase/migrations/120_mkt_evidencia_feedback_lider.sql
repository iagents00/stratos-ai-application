-- Migración 120 (marketing): el LÍDER puede COMENTAR o APROBAR la evidencia; el comentario le llega
-- a quien hizo la tarea (aviso al teléfono + su Copilot). Pedido de Ángel: "que el admin Alex y los
-- otros admin de marketing puedan responder y hacerle comentarios para mejorar/ajustar algo". Aditivo/reversible.

-- 1) Extensibilidad: la tabla del chat gana 'meta' (jsonb) — lleva el task_id y marca que un mensaje de
--    evidencia admite comentario/aprobación (para pintar los botones). Futuros extras van acá (sin más DDL).
alter table public.tg_bot_activity add column if not exists meta jsonb;

-- 2) mkt_tasks: marca de evidencia aprobada por el líder (para que el módulo pueda mostrar el ✓ luego).
alter table public.mkt_tasks add column if not exists evidencia_aprobada boolean not null default false;

-- 3) Registro de comentarios/aprobaciones de evidencia (historial).
create table if not exists public.mkt_task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  author_id uuid,
  author_name text,
  assignee_id uuid,
  comment text,
  kind text not null default 'comment',   -- 'comment' | 'approval'
  created_at timestamptz not null default now()
);
alter table public.mkt_task_comments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mkt_task_comments' and policyname='mkt_task_comments_select') then
    create policy mkt_task_comments_select on public.mkt_task_comments for select
      using (organization_id = current_organization_id() and is_marketing_or_above());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mkt_task_comments' and policyname='mkt_task_comments_insert') then
    create policy mkt_task_comments_insert on public.mkt_task_comments for insert
      with check (organization_id = current_organization_id() and is_marketing_or_above());
  end if;
end $$;

-- 4) El historial del Copilot ahora DEVUELVE 'meta' (drop+create por cambio de tipo de retorno; solo lectura).
drop function if exists public.get_my_copilot_activity(integer);
create function public.get_my_copilot_activity(p_limit integer default 40)
returns table(id bigint, occurred_at timestamptz, role text, content text, media_path text, media_type text, meta jsonb)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_chat_id bigint;
begin
  select p.telegram_chat_id into v_chat_id from public.profiles p where p.id = auth.uid() limit 1;
  if v_chat_id is null then return; end if;
  return query
  select t.id, t.created_at as occurred_at, t.role, t.content, t.media_path, t.media_type, t.meta
  from public.tg_bot_activity t
  where t.telegram_chat_id = v_chat_id
  order by t.id desc
  limit least(greatest(p_limit, 1), 200);
end $function$;

-- 5) mkt_attach_evidence: marca la evidencia del LÍDER con meta (can_comment) para los botones del chat.
create or replace function public.mkt_attach_evidence(p_path text, p_tipo text default 'foto')
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_task uuid; v_titulo text; v_quien text;
  r record; v_hoy text; v_tipo text; v_dedupe text; v_rid uuid; v_texto text; v_meta jsonb;
  v_notified boolean := false;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name into v_org, v_quien from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_tipo := coalesce(nullif(p_tipo,''),'foto');

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
    return 'No encontré una tarea completada tuya para vincular esta evidencia. Marca primero la tarea como hecha y vuelve a enviarla.';
  end if;

  update mkt_tasks
    set evidencia_url = p_path, evidencia_tipo = v_tipo, evidencia_aprobada = false, updated_at = now()
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
        update proactive_reminders set status='sent', sent_at=now() where id = v_rid;  -- dispara el push
        insert into tg_bot_activity (telegram_chat_id, role, content, media_path, media_type, meta)
          values (r.chat, 'ai', v_texto, p_path, v_tipo, v_meta);  -- la foto va a su Copilot (+ botones si es líder)
        v_notified := true;
      exception when others then null;
      end;
    end if;
  end loop;

  return 'Evidencia adjuntada a «'||v_titulo||'».'||
    case when v_notified then ' Ya les llegó la foto a tu líder y a quien sigue la tarea (en su Copilot).'
         else ' Tu líder la puede ver en la pestaña Equipo.' end;
end $function$;

-- 6) El líder COMENTA la evidencia → le llega al responsable de la tarea (push + su Copilot).
create or replace function public.mkt_comment_evidence(p_task_id uuid, p_comment text)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_leader text; v_is_admin boolean;
  v_assignee uuid; v_titulo text; v_achat bigint; v_aname text; v_rid uuid; v_texto text; v_stamp text;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name, (coalesce(is_marketing_admin,false) or role in ('super_admin','admin','ceo','director'))
    into v_org, v_leader, v_is_admin from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if not coalesce(v_is_admin,false) then return 'Solo un líder de marketing puede comentar la evidencia.'; end if;
  if coalesce(btrim(p_comment),'') = '' then return 'Escribe el comentario para tu compañero.'; end if;

  select assignee_id, titulo into v_assignee, v_titulo from mkt_tasks
    where id = p_task_id and organization_id = v_org and deleted_at is null;
  if v_assignee is null then return 'No encontré esa tarea.'; end if;
  select telegram_chat_id, name into v_achat, v_aname from profiles where id = v_assignee;

  insert into mkt_task_comments (organization_id, task_id, author_id, author_name, assignee_id, comment, kind)
    values (v_org, p_task_id, v_uid, v_leader, v_assignee, p_comment, 'comment');

  v_stamp := to_char(now() at time zone 'America/Cancun','YYYYMMDDHH24MISS');
  v_texto := '💬 '||coalesce(v_leader,'Tu líder')||' comentó tu evidencia de «'||v_titulo||'»: '||p_comment;
  begin
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (v_org, v_assignee, v_aname, 'personal', now(), 'pending', jsonb_build_object('text', v_texto), 'mkt_evcomment:'||p_task_id||':'||v_stamp)
      returning id into v_rid;
    update proactive_reminders set status='sent', sent_at=now() where id = v_rid;
    if v_achat is not null then
      insert into tg_bot_activity (telegram_chat_id, role, content, meta)
        values (v_achat, 'ai', v_texto, jsonb_build_object('kind','evidence_comment','task_id',p_task_id));
    end if;
  exception when others then null;
  end;

  return 'Listo, le mandé tu comentario a '||coalesce(v_aname,'tu compañero')||'.';
end $function$;

-- 7) El líder APRUEBA la evidencia → le avisa al responsable + marca la tarea.
create or replace function public.mkt_approve_evidence(p_task_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_leader text; v_is_admin boolean;
  v_assignee uuid; v_titulo text; v_achat bigint; v_aname text; v_rid uuid; v_texto text; v_stamp text;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name, (coalesce(is_marketing_admin,false) or role in ('super_admin','admin','ceo','director'))
    into v_org, v_leader, v_is_admin from profiles where id = v_uid;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if not coalesce(v_is_admin,false) then return 'Solo un líder de marketing puede aprobar la evidencia.'; end if;

  select assignee_id, titulo into v_assignee, v_titulo from mkt_tasks
    where id = p_task_id and organization_id = v_org and deleted_at is null;
  if v_assignee is null then return 'No encontré esa tarea.'; end if;
  select telegram_chat_id, name into v_achat, v_aname from profiles where id = v_assignee;

  update mkt_tasks set evidencia_aprobada = true, updated_at = now() where id = p_task_id;
  insert into mkt_task_comments (organization_id, task_id, author_id, author_name, assignee_id, comment, kind)
    values (v_org, p_task_id, v_uid, v_leader, v_assignee, 'Evidencia aprobada', 'approval');

  v_stamp := to_char(now() at time zone 'America/Cancun','YYYYMMDDHH24MISS');
  v_texto := '✅ '||coalesce(v_leader,'Tu líder')||' aprobó tu evidencia de «'||v_titulo||'». ¡Bien hecho!';
  begin
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (v_org, v_assignee, v_aname, 'personal', now(), 'pending', jsonb_build_object('text', v_texto), 'mkt_evapprove:'||p_task_id||':'||v_stamp)
      returning id into v_rid;
    update proactive_reminders set status='sent', sent_at=now() where id = v_rid;
    if v_achat is not null then
      insert into tg_bot_activity (telegram_chat_id, role, content, meta)
        values (v_achat, 'ai', v_texto, jsonb_build_object('kind','evidence_approved','task_id',p_task_id));
    end if;
  exception when others then null;
  end;

  return 'Aprobada. Le avisé a '||coalesce(v_aname,'tu compañero')||'.';
end $function$;
