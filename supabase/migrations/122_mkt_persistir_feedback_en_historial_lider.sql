-- Migración 122 (marketing): que el COMENTARIO/APROBACIÓN del líder quede en SU PROPIO historial.
--
-- Bug de Ángel (captura): comentó, se envió bien ("Listo, le mandé tu comentario a Yazz"), pero al
-- SALIR y volver a entrar al Copilot el comentario NO aparecía en el chat del admin → puede creer que
-- no se envió y volver a tocar el botón. Causa: mkt_comment_evidence / mkt_approve_evidence avisaban al
-- RESPONSABLE (Yazz) y lo guardaban en SU chat, pero NO guardaban nada en el chat del PROPIO líder (solo
-- se veía "optimista" en pantalla y se perdía al recargar). Fix: loguear también en el historial del que
-- comenta/aprueba (su comentario + la confirmación). Aditivo/reversible (solo CREATE OR REPLACE).
--
-- NOTA: es un cambio SOLO de base de datos (funciones). No requiere redeploy del frontend — el front
-- v262 ya llama a estas RPCs; la persistencia ahora ocurre server-side.

create or replace function public.mkt_comment_evidence(p_task_id uuid, p_comment text)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_leader text; v_is_admin boolean; v_self_chat bigint;
  v_assignee uuid; v_titulo text; v_achat bigint; v_aname text; v_rid uuid; v_texto text; v_stamp text; v_reply text;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name, telegram_chat_id,
         (coalesce(is_marketing_admin,false) or role in ('super_admin','admin','ceo','director'))
    into v_org, v_leader, v_self_chat, v_is_admin from profiles where id = v_uid;
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

  v_reply := 'Listo, le mandé tu comentario a '||coalesce(v_aname,'tu compañero')||' sobre «'||v_titulo||'».';
  -- PERSISTIR en el historial del PROPIO líder: su comentario + la confirmación.
  if v_self_chat is not null then
    begin
      insert into tg_bot_activity (telegram_chat_id, role, content) values (v_self_chat, 'user', p_comment);
      insert into tg_bot_activity (telegram_chat_id, role, content, meta)
        values (v_self_chat, 'ai', v_reply, jsonb_build_object('kind','evidence_comment_sent','task_id',p_task_id));
    exception when others then null;
    end;
  end if;

  return v_reply;
end $function$;

create or replace function public.mkt_approve_evidence(p_task_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_leader text; v_is_admin boolean; v_self_chat bigint;
  v_assignee uuid; v_titulo text; v_achat bigint; v_aname text; v_rid uuid; v_texto text; v_stamp text; v_reply text;
begin
  v_uid := auth.uid();
  if v_uid is null then return 'Sesión no válida.'; end if;
  select organization_id, name, telegram_chat_id,
         (coalesce(is_marketing_admin,false) or role in ('super_admin','admin','ceo','director'))
    into v_org, v_leader, v_self_chat, v_is_admin from profiles where id = v_uid;
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

  v_reply := 'Aprobaste la evidencia de «'||v_titulo||'». Le avisé a '||coalesce(v_aname,'tu compañero')||'.';
  -- PERSISTIR en el historial del PROPIO líder (queda el registro de que aprobó, al recargar).
  if v_self_chat is not null then
    begin
      insert into tg_bot_activity (telegram_chat_id, role, content, meta)
        values (v_self_chat, 'ai', '✅ '||v_reply, jsonb_build_object('kind','evidence_approved_sent','task_id',p_task_id));
    exception when others then null;
    end;
  end if;

  return v_reply;
end $function$;
