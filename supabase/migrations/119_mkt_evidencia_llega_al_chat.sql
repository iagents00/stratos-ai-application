-- Migración 119 (marketing): la EVIDENCIA (foto/video) LLEGA al chat del Copilot y se abre como en WhatsApp.
--
-- Pedido de Ángel: "debe llegarle la FOTO de la evidencia, no solo decirle 'N adjuntó evidencia — ábrela
-- en Equipo'. Las imágenes deben ser como el módulo WhatsApp: que se pueden ver abriéndolas desde el chat."
--
-- Antes: al líder solo le llegaba un TEXTO. Ahora la foto/video viaja al chat del Copilot del LÍDER y de
-- QUIEN SIGUE LA TAREA en la cadena (tareas que depends_on la completada), persiste en el historial del que
-- la envía, y se abre a pantalla completa. Todo aditivo/reversible (columnas nuevas + CREATE OR REPLACE;
-- get_my_copilot_activity es drop+create SOLO por cambio de tipo de retorno — función de solo lectura).
--
-- Vía libre confirmada: la política de storage `evidencia_mkt_select` deja a cualquier usuario
-- marketing-o-superior de la MISMA org firmar (createSignedUrl) cualquier objeto bajo mkt/<org>/... →
-- el líder puede abrir la foto que subió un miembro del equipo.

-- 1) La tabla del chat guarda la referencia al adjunto (ruta en bucket privado 'evidencia' + tipo).
alter table public.tg_bot_activity
  add column if not exists media_path text,
  add column if not exists media_type text;

-- 2) Loguear un mensaje al chat de CUALQUIER usuario (por chat_id) CON adjunto.
create or replace function public.fn_log_proactive_copilot_media(
  p_chat_id bigint, p_content text, p_role text default 'ai',
  p_media_path text default null, p_media_type text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_id bigint;
begin
  insert into public.tg_bot_activity (telegram_chat_id, role, content, media_path, media_type)
  values (p_chat_id, coalesce(nullif(p_role,''),'ai'), p_content, p_media_path, p_media_type)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- 3) Loguear al chat del PROPIO usuario (auth.uid()) CON adjunto — para que la foto que TÚ enviaste
--    se siga viendo al recargar (no solo el preview local que expira).
create or replace function public.copilot_log_msg_media(
  p_role text, p_content text, p_media_path text default null, p_media_type text default null
) returns bigint
language plpgsql security definer set search_path to 'public'
as $function$
declare v_chat bigint; v_id bigint;
begin
  select telegram_chat_id into v_chat from public.profiles where id = auth.uid() limit 1;
  if v_chat is null then return null; end if;
  if coalesce(btrim(p_content),'') = '' and p_media_path is null then return null; end if;
  insert into public.tg_bot_activity (telegram_chat_id, role, content, media_path, media_type)
  values (v_chat, case when lower(coalesce(p_role,''))='user' then 'user' else 'ai' end, p_content, p_media_path, p_media_type)
  returning id into v_id;
  return v_id;
end $function$;

-- 4) El historial del Copilot ahora DEVUELVE la referencia al adjunto (drop+create: cambia el tipo de
--    retorno de una función de SOLO LECTURA; reversible).
drop function if exists public.get_my_copilot_activity(integer);
create function public.get_my_copilot_activity(p_limit integer default 40)
returns table(id bigint, occurred_at timestamptz, role text, content text, media_path text, media_type text)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_chat_id bigint;
begin
  select p.telegram_chat_id into v_chat_id from public.profiles p where p.id = auth.uid() limit 1;
  if v_chat_id is null then return; end if;
  return query
  select t.id, t.created_at as occurred_at, t.role, t.content, t.media_path, t.media_type
  from public.tg_bot_activity t
  where t.telegram_chat_id = v_chat_id
  order by t.id desc
  limit least(greatest(p_limit, 1), 200);
end $function$;

-- 5) Al adjuntar evidencia, la FOTO/VIDEO llega al Copilot del LÍDER y de QUIEN SIGUE LA TAREA (+ push).
create or replace function public.mkt_attach_evidence(p_path text, p_tipo text default 'foto')
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid; v_org uuid; v_task uuid; v_titulo text; v_quien text;
  r record; v_hoy text; v_tipo text; v_dedupe text; v_rid uuid; v_texto text;
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
    set evidencia_url = p_path, evidencia_tipo = v_tipo, updated_at = now()
    where id = v_task;

  v_hoy := to_char(now() at time zone 'America/Cancun','YYYYMMDD');

  -- Destinatarios: (cadena) quien tiene una tarea que DEPENDE de ésta y sigue pendiente [la necesita
  -- para avanzar], y (líder) los marketing admin [visibilidad]. Si alguien es ambos, gana 'cadena'.
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
    else
      v_texto := (case when v_tipo='video' then '🎬 ' else '📸 ' end)||coalesce(v_quien,'Alguien del equipo')||
                 ' adjuntó evidencia de «'||v_titulo||'».';
      v_dedupe := 'mkt_evid_lider:'||v_task||':'||r.pid||':'||v_hoy;
    end if;
    if r.chat is not null and not exists (select 1 from proactive_reminders x where x.dedupe_key = v_dedupe) then
      begin
        insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
          values (v_org, r.pid, r.pname, 'personal', now(), 'pending', jsonb_build_object('text', v_texto), v_dedupe)
          returning id into v_rid;
        update proactive_reminders set status='sent', sent_at=now() where id = v_rid;  -- dispara el push
        perform fn_log_proactive_copilot_media(r.chat, v_texto, 'ai', p_path, v_tipo);  -- la foto va a su Copilot
        v_notified := true;
      exception when others then null;  -- best-effort: un aviso jamás rompe la operación principal
      end;
    end if;
  end loop;

  return 'Evidencia adjuntada a «'||v_titulo||'».'||
    case when v_notified then ' Ya les llegó la foto a tu líder y a quien sigue la tarea (en su Copilot).'
         else ' Tu líder la puede ver en la pestaña Equipo.' end;
end $function$;
