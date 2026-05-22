-- 048_bot_next_action_state.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Bug "Prox. acción" (callback nextpick): creaba una TAREA en vez de actualizar
-- la próxima acción del lead. Causa: el botón solo mostraba un prompt; el texto
-- que escribía el asesor lo ruteaba el LLM de n8n (sin saber que respondía al
-- prompt) → mal-routeaba a add_task.
--
-- Fix determinístico (mismo patrón que awaiting_reschedule): se registra estado
-- 'awaiting_next_action' en proactive_pending_reports y se expone en
-- fn_proactive_check_report (que n8n ya consulta al recibir texto). n8n, al ver
-- awaiting_next_action=true, manda el texto a fn_proactive_next_action_apply.
--
--   - fn_proactive_next_action_start(chat,phone): abre el estado + prompt.
--     (el wrapper bot_handle_callback intercepta action='nextpick' y la llama)
--   - fn_proactive_check_report: ahora devuelve awaiting_next_action + lead_id.
--   - fn_proactive_next_action_apply(payload): setea leads.next_action +
--     next_action_at (n8n parsea NL→ISO en next_action_at_iso), deja traza en
--     comunicaciones + expediente_items, y cierra el estado.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_proactive_next_action_start(p_telegram_chat_id bigint, p_phone text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
declare v_org uuid; v_pid uuid; v_role text; v_all boolean; v_lead uuid; v_d text;
begin
  select organization_id,id,role into v_org,v_pid,v_role from public.profiles
    where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true limit 1;
  if v_pid is null then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No estás vinculado.','parse_mode',null,'inline_keyboard',public._bot_kb_back())); end if;
  v_all := v_role in ('super_admin','admin','ceo','director');
  v_d := public._bot_phone10(p_phone);
  select id into v_lead from public.leads
    where organization_id=v_org and deleted_at is null and public._bot_phone10(phone_normalized)=v_d
      and (v_all or asesor_id=v_pid) limit 1;
  if v_lead is null then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré ese cliente.','parse_mode',null,'inline_keyboard',public._bot_kb_back())); end if;
  update public.proactive_pending_reports set status='closed', outcome='superseded'
    where organization_id=v_org and advisor_telegram_id=p_telegram_chat_id and status='open' and kind='awaiting_next_action';
  insert into public.proactive_pending_reports (organization_id, advisor_telegram_id, lead_id, kind, status, expires_at)
    values (v_org, p_telegram_chat_id, v_lead, 'awaiting_next_action', 'open', now()+interval '1 hour');
  return jsonb_build_object('ok',true,'lead_id',v_lead,
    'reply',jsonb_build_object('text','Escribime la próxima acción y cuándo. Ej: "Llamarlo mañana 11am".','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
end; $fn$;

create or replace function public.fn_proactive_next_action_apply(payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
declare v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_action text := NULLIF(btrim(payload->>'next_action'),'');
  v_new timestamptz; v_name text; v_agent uuid; v_legible text; v_date text;
begin
  if v_tg is null or v_lead is null then return jsonb_build_object('ok',false,'text','Faltan datos.'); end if;
  if v_action is null then return jsonb_build_object('ok',false,'text','No entendí la próxima acción.'); end if;
  begin v_new := NULLIF(payload->>'next_action_at_iso','')::timestamptz; exception when others then v_new := null; end;
  select name into v_name from public.leads where id=v_lead and organization_id=v_org and deleted_at is null;
  if v_name is null then return jsonb_build_object('ok',false,'text','No encontré ese lead.'); end if;
  select id into v_agent from public.profiles where organization_id=v_org and telegram_chat_id=v_tg and coalesce(active,true)=true limit 1;
  if v_new is not null then
    v_date := to_char(v_new at time zone 'America/Cancun','DD Mon, HH24:MI');
    v_legible := ' - '||to_char(v_new at time zone 'America/Cancun','DD/MM HH24:MI')||' hs (Cancún)';
  end if;
  update public.leads
     set next_action = v_action, next_action_at = coalesce(v_new, next_action_at),
         next_action_date = coalesce(v_date, next_action_date),
         last_activity = to_char(now(),'YYYY-MM-DD HH24:MI'), updated_at = now()
   where id=v_lead;
  insert into public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en)
    values (v_lead,v_org,'nota','Próxima acción: '||v_action||coalesce(v_legible,'')||'.',v_agent,now());
  insert into public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata)
    values (v_lead,v_org,'nota','Próxima acción (bot)','Próxima acción: '||v_action||coalesce(v_legible,'')||'.',v_agent,
            jsonb_build_object('source','proactive_next_action_apply','next_action_at',v_new));
  update public.proactive_pending_reports set status='closed', outcome='next_action_set'
    where organization_id=v_org and advisor_telegram_id=v_tg and lead_id=v_lead and status='open' and kind='awaiting_next_action';
  return jsonb_build_object('ok',true,'text','Listo, próxima acción de '||v_name||': '||v_action||coalesce(v_legible,'')||'.','next_action_at',v_new);
end; $fn$;

create or replace function public.fn_proactive_check_report(payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint; v_id uuid; v_lead uuid; v_kind text; v_mgr bigint; v_mgrs bigint[];
begin
  if v_tg is null then return jsonb_build_object('ok',false,'error','advisor_telegram_id required'); end if;
  select coalesce(array_agg(telegram_chat_id order by telegram_chat_id), array[]::bigint[]) into v_mgrs
    from public.profiles where organization_id=v_org and role in ('super_admin','admin','ceo','director') and coalesce(active,true)=true and telegram_chat_id is not null;
  v_mgr := coalesce((select manager_telegram_id from public.proactive_config where organization_id=v_org), v_mgrs[1]);
  select id,lead_id,kind into v_id,v_lead,v_kind from public.proactive_pending_reports
    where organization_id=v_org and advisor_telegram_id=v_tg and status='open'
      and kind in ('zoom_brief','awaiting_reschedule','awaiting_next_action') and (expires_at is null or expires_at>now())
    order by created_at desc, id desc limit 1;
  if v_id is null then return jsonb_build_object('ok',true,'has_report',false,'awaiting_reschedule',false,'awaiting_next_action',false,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs)); end if;
  return jsonb_build_object('ok',true,'has_report',true,'awaiting_reschedule',(v_kind='awaiting_reschedule'),'awaiting_next_action',(v_kind='awaiting_next_action'),'report_kind',v_kind,'lead_id',v_lead,'report_id',v_id,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
end; $function$;

grant execute on function public.fn_proactive_next_action_start(bigint,text) to service_role;
grant execute on function public.fn_proactive_next_action_apply(jsonb) to service_role;
revoke all on function public.fn_proactive_next_action_start(bigint,text) from public;
revoke all on function public.fn_proactive_next_action_apply(jsonb) from public;

-- wrapper: interceptar nextpick -> abre el estado awaiting_next_action
create or replace function public.bot_handle_callback(p_telegram_chat_id bigint, p_callback_data text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_verify jsonb; v_action text; v_payload text;
begin
  v_verify := public._bot_cb_verify(p_callback_data);
  if (v_verify->>'valid')::boolean then
    v_action  := v_verify->>'action';
    v_payload := v_verify->>'payload';
    if v_action = 'list' then
      return public.bot_list_my_clients_v2(p_telegram_chat_id);
    elsif v_action = 'setprio' then
      return public.bot_set_priority(p_telegram_chat_id, split_part(coalesce(v_payload,''),':',1), 1);
    elsif v_action = 'nextpick' then
      return public.fn_proactive_next_action_start(p_telegram_chat_id, split_part(coalesce(v_payload,''),':',1));
    end if;
  end if;
  return public.bot_handle_callback_core(p_telegram_chat_id, p_callback_data);
end; $function$;
revoke all on function public.bot_handle_callback(bigint, text) from public;
grant execute on function public.bot_handle_callback(bigint, text) to service_role;
