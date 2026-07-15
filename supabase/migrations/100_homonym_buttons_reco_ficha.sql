-- Homónimos con BOTONES para recomendar/ficha (paridad Telegram + Copilot)
-- Reusa el pipeline probado de pickdis (write-actions): _bot_disambiguate -> pickdis ->
-- bot_handle_callback -> _bot_execute_pending. Se agregan 2 action_types de LECTURA
-- ('reco','ficha') de forma ADITIVA (no altera ninguna rama existente). Reversible.

-- 1) _bot_disambiguate: agregar verbos para las nuevas acciones de lectura (cosmético)
CREATE OR REPLACE FUNCTION public._bot_disambiguate(p_chat bigint, p_action_type text, p_args jsonb, p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_asesor jsonb; v_token text; v_kb jsonb := '[]'::jsonb; r record;
        v_args jsonb := coalesce(p_args,'{}'::jsonb); v_n int := 0; v_shown int := 0; v_verb text; v_txt text;
begin
  v_asesor := public.identify_asesor_by_telegram(p_chat);
  if coalesce((v_asesor->>'paired')::boolean,false) is not true then
    return public._bot_err_envelope(jsonb_build_object('error','not_paired'));
  end if;
  if nullif(btrim(coalesce(v_args->>'contenido','')),'') is null
     and coalesce(nullif(btrim(v_args->>'nota'),''), nullif(btrim(v_args->>'texto'),''), nullif(btrim(v_args->>'content'),''), nullif(btrim(v_args->>'notas'),'')) is not null then
    v_args := jsonb_set(v_args, '{contenido}', to_jsonb(coalesce(nullif(btrim(v_args->>'nota'),''), nullif(btrim(v_args->>'texto'),''), nullif(btrim(v_args->>'content'),''), nullif(btrim(v_args->>'notas'),''))));
  end if;
  v_token := substr(md5(gen_random_uuid()::text || now()::text), 1, 10);
  insert into public.bot_pending_actions(token, asesor_id, organization_id, telegram_chat_id, action_type, payload, summary, expires_at)
    values(v_token, (v_asesor->>'profile_id')::uuid, (v_asesor->>'organization_id')::uuid, p_chat, p_action_type, v_args, 'Accion para '||p_ref, now()+interval '10 minutes');
  for r in select * from public.fn_bot_name_candidates(p_chat, p_ref) loop
    v_n := v_n + 1;
    if v_shown < 10 then
      v_kb := v_kb || jsonb_build_array(jsonb_build_array(public._bot_btn(
        r.lead_name || coalesce(' . '||nullif(r.stage,''),'') ||
        case when length(coalesce(r.phone,'')) >= 4 then ' . ...'||right(r.phone,4) else '' end,
        'pickdis', v_token||':'||r.phone)));
      v_shown := v_shown + 1;
    end if;
  end loop;
  v_kb := v_kb || jsonb_build_array(jsonb_build_array(public._bot_btn('Cancelar','cancel',v_token)));
  v_verb := case p_action_type
    when 'add_expediente_note' then 'agregar la nota'
    when 'add_expediente_voice' then 'guardar la nota de voz'
    when 'update_fields' then 'actualizar'
    when 'add_task' then 'crear la tarea'
    when 'add_seguimiento' then 'registrar el seguimiento'
    when 'add_comunicacion' then 'registrar la comunicacion'
    when 'set_ai_agent' then 'asignar el agente'
    when 'create_deal' then 'registrar la venta'
    when 'soft_delete' then 'enviar a papelera'
    when 'gv_change_stage' then 'cambiar de etapa'
    when 'gv_set_zoom_datetime' then 'ponerle la fecha de Zoom'
    when 'gv_update_next_action' then 'cambiar la proxima accion'
    when 'reco' then 'recomendarle propiedades'
    when 'ficha' then 'ver su ficha'
    else 'aplicar la accion' end;
  v_txt := 'Hay '||v_n||' clientes con "'||p_ref||'". A cual queres '||v_verb||'?';
  if v_n > v_shown then
    v_txt := v_txt || E'\n(Te muestro los '||v_shown||' mas recientes. Si no esta, escribi el nombre completo o el telefono.)';
  end if;
  return jsonb_build_object('ok', true, 'staged', true, 'token', v_token,
    'reply', jsonb_build_object('text', v_txt, 'parse_mode', null, 'inline_keyboard', v_kb));
end; $function$;

-- 2) _bot_execute_pending: al elegir el homónimo, si la acción es de LECTURA re-ejecuta
--    recomendar/ficha con el cliente elegido (bloque ADITIVO, justo tras el bloque gv_).
CREATE OR REPLACE FUNCTION public._bot_execute_pending(p_telegram_chat_id bigint, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.bot_pending_actions;
  v_inner jsonb; v_phone text; v_as jsonb; v_org_id uuid; v_profile_id uuid; v_role text; v_notas text;
begin
  select * into v_row from public.bot_pending_actions
   where token = p_token and telegram_chat_id = p_telegram_chat_id and consumed_at is null limit 1;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'code','pending_not_found','reply', jsonb_build_object('text','Esta confirmacion vencio o ya se proceso.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  if v_row.expires_at < now() then
    update public.bot_pending_actions set consumed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'code','pending_expired','reply', jsonb_build_object('text','Esta confirmacion vencio. Vuelve a pedirlo.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  update public.bot_pending_actions set consumed_at = now() where id = v_row.id;

  -- Acciones de gvintell (cambiar etapa / fecha Zoom / proxima accion): re-ejecutan v2
  -- con el cliente elegido como telefono (resolucion unica), reusando toda su logica.
  if left(v_row.action_type, 3) = 'gv_' then
    v_inner := public.bot_nlu_dispatch_gvintell_v2(
      p_telegram_chat_id,
      substring(v_row.action_type from 4),
      (v_row.payload - 'client_name' - 'name' - 'nombre')
        || jsonb_build_object('client_name', v_row.payload->>'phone'));
    return v_inner;  -- v2 ya devuelve {ok, reply}
  end if;

  -- Acciones de LECTURA (recomendar / ver ficha) tras elegir un homonimo: re-ejecutan
  -- con el telefono del cliente elegido (resolucion unica). Devuelven su reply directo.
  if v_row.action_type in ('reco','ficha') then
    v_phone := v_row.payload->>'phone';
    if v_row.action_type = 'reco' then
      return public.bot_recomendar_propiedades(p_telegram_chat_id, coalesce(v_phone,''), coalesce(v_row.payload->>'context',''));
    else
      return public.bot_ficha_cliente(p_telegram_chat_id, coalesce(v_phone,''));
    end if;
  end if;

  v_phone := v_row.payload->>'phone';
  if coalesce(v_phone,'') <> '' then
    v_as := public.identify_asesor_by_telegram(p_telegram_chat_id);
    if coalesce((v_as->>'paired')::boolean,false) then
      v_org_id := (v_as->>'organization_id')::uuid;
      v_profile_id := (v_as->>'profile_id')::uuid;
      v_role := coalesce(v_as->>'role','asesor');
      v_phone := public._bot_canonical_phone(v_org_id, v_profile_id, v_role, v_phone);
    end if;
  end if;

  case v_row.action_type
    when 'create_lead' then
      v_inner := public.bot_upsert_lead(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', null, nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      v_notas := nullif(trim(coalesce(v_row.payload->>'notas','')),'');
      if v_notas is not null then perform public.bot_add_expediente_note(p_telegram_chat_id, v_phone, 'Alta de cliente', v_notas, 'telegram'); end if;
    when 'upsert_lead' then
      v_inner := public.bot_upsert_lead(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', v_row.payload->>'bio', nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
    when 'update_fields' then
      v_inner := public.bot_update_lead_fields(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', v_row.payload->>'bio', nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
    when 'add_seguimiento' then
      v_inner := public.bot_add_seguimiento(p_telegram_chat_id, v_phone, v_row.payload->>'tipo', v_row.payload->>'resumen');
    when 'add_comunicacion' then
      v_inner := public.bot_add_comunicacion(p_telegram_chat_id, v_phone, v_row.payload->>'tipo', v_row.payload->>'resumen', v_row.payload->>'transcripcion', nullif(v_row.payload->>'ocurrio_en','')::timestamptz, nullif(v_row.payload->>'duracion_seg','')::integer);
    when 'add_expediente_note' then
      v_inner := public.bot_add_expediente_note(p_telegram_chat_id, v_phone, v_row.payload->>'titulo', v_row.payload->>'contenido', coalesce(v_row.payload->>'source','telegram'));
    when 'add_expediente_voice' then
      v_inner := public.bot_add_expediente_voice(p_telegram_chat_id, v_phone, v_row.payload->>'titulo', v_row.payload->>'transcripcion', nullif(v_row.payload->>'duracion_seg','')::integer, v_row.payload->>'storage_path');
    when 'add_task' then
      v_inner := public.bot_add_task(p_telegram_chat_id, v_phone, v_row.payload->>'text', nullif(v_row.payload->>'due_at','')::timestamptz, v_row.payload->>'priority');
    when 'set_ai_agent' then
      v_inner := public.bot_set_ai_agent(p_telegram_chat_id, v_phone, v_row.payload->>'agent_key');
    when 'create_deal' then
      v_inner := public.bot_create_deal(p_telegram_chat_id, v_phone, nullif(v_row.payload->>'amount','')::bigint, coalesce(v_row.payload->>'currency','USD'), nullif(v_row.payload->>'project_unit_id','')::uuid, nullif(v_row.payload->>'signed_at','')::timestamptz, v_row.payload->>'notes');
    when 'soft_delete' then
      v_inner := public.bot_soft_delete_lead(p_telegram_chat_id, v_phone, v_row.payload->>'reason');
    else
      return jsonb_build_object('ok', false, 'code','unknown_action_type','reply', jsonb_build_object('text','Accion desconocida: ' || v_row.action_type,'parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end case;

  if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
  return jsonb_build_object('ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', 'Listo. ' || v_row.summary, 'parse_mode', null,
      'inline_keyboard', case when v_phone is not null then jsonb_build_array(jsonb_build_array(public._bot_btn('Ver ficha', 'view', regexp_replace(v_phone,'[^0-9]','','g')), public._bot_btn('Menu', 'menu', '_'))) else public._bot_kb_back() end));
end; $function$;

-- 3) bot_recomendar_propiedades: homónimos -> botones (antes: re-pregunta por texto)
CREATE OR REPLACE FUNCTION public.bot_recomendar_propiedades(p_chat bigint, p_ref text, p_context text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_pid uuid; v_role text; v_view_all boolean;
  v_nc int; v_names text; v_lead_id uuid; v_lead record;
  v_ref text := btrim(coalesce(p_ref,''));
  v_ctx text := public.unaccent(lower(coalesce(p_context,'')));
  v_sig text; v_zona text; v_bud_k numeric; v_bp jsonb;
  v_query text; v_why text; v_cat jsonb; v_cat_text text; v_pk numeric;
begin
  select org,pid,role,view_all into v_org,v_pid,v_role,v_view_all from public._bot_requester(p_chat);
  if v_org is null then return public._bot_smart_reask('No estás conectado al CRM. Usá /conectar ########.'); end if;

  if v_ref = '' then
    return public._bot_smart_reask('¿Para qué cliente te recomiendo propiedades? Decime el nombre o el teléfono.');
  end if;

  select count(*) into v_nc from public.fn_bot_name_candidates(p_chat, v_ref);
  if v_nc = 0 then
    return public._bot_smart_reask('No encontré al cliente "'||v_ref||'". ¿Lo escribiste completo, o me pasás el teléfono?');
  elsif v_nc > 1 then
    return public._bot_disambiguate(p_chat, 'reco', jsonb_build_object('context', coalesce(p_context,'')), v_ref);
  end if;

  select lead_id into v_lead_id from public.fn_bot_name_candidates(p_chat, v_ref) limit 1;
  select * into v_lead from public.leads where id=v_lead_id and organization_id=v_org;
  perform public._bot_remember_lead(p_chat, v_org, v_lead.id, v_lead.name, v_lead.phone_normalized);

  -- señal del lead: notas + budget + campaña (ahí suele estar presupuesto/zona)
  v_sig := public.unaccent(lower(concat_ws(' ', v_lead.notas, v_lead.budget, v_lead.campaign)));

  -- ZONA: explícita en el pedido; si no, de la señal del lead (notas)
  v_zona := case
    when (v_ctx||' '||v_sig) ~ 'playa del carmen|playa carmen|\ypdc\y' then 'Playa del Carmen'
    when (v_ctx||' '||v_sig) ~ 'tulum' then 'Tulum'
    when (v_ctx||' '||v_sig) ~ 'canc' then 'Cancun'
    when (v_ctx||' '||v_sig) ~ 'puerto morelos' then 'Puerto Morelos'
    when (v_ctx||' '||v_sig) ~ 'costa mujeres' then 'Costa Mujeres'
    when (v_ctx||' '||v_sig) ~ 'country club' then 'Country Club'
    when (v_ctx||' '||v_sig) ~ 'merida' then 'Merida'
    else null end;

  -- PRESUPUESTO (en miles): estructurado si >0; si no, de notas/budget/contexto
  v_pk := public.fn_presupuesto_k(v_lead.presupuesto);
  if coalesce(v_pk,0) > 0 then
    v_bud_k := v_pk;
  else
    v_bp := public.fn_parse_budget_k(v_ctx||' '||v_sig);
    if coalesce(v_bp->>'mode','none') <> 'none' then
      v_bud_k := coalesce((v_bp->>'max_k')::numeric, (v_bp->>'min_k')::numeric);
    end if;
  end if;

  -- delegar en el catálogo ya probado (filtra por zona + presupuesto con fallback a zona)
  v_query := 'propiedades'
    || coalesce(' en '||v_zona, '')
    || case when coalesce(v_bud_k,0) > 0 then ' de hasta '||round(v_bud_k)::text||'k' else '' end;
  v_cat := public.bot_buscar_proyectos(p_chat, jsonb_build_object('input_text', v_query, 'top', 5));
  v_cat_text := coalesce(v_cat->'reply'->>'text','');

  -- el PORQUÉ de la recomendación
  v_why := '🎯 Recomendación para '||btrim(coalesce(v_lead.name,'el cliente'));
  if v_zona is not null and coalesce(v_bud_k,0) > 0 then
    v_why := v_why||' — vive/le interesa '||v_zona||' y su presupuesto es ~'||public._bot_fmt_k(v_bud_k)||', así que busco en '||v_zona||' dentro de ese monto:';
  elsif v_zona is not null then
    v_why := v_why||' — le interesa '||v_zona||' (no veo presupuesto en su expediente), te muestro esa zona:';
  elsif coalesce(v_bud_k,0) > 0 then
    v_why := v_why||' — presupuesto ~'||public._bot_fmt_k(v_bud_k)||' (no veo zona en su expediente), filtro por ese monto:';
  else
    v_why := v_why||' — todavía no tiene presupuesto ni zona en su expediente; cargalos en sus notas y afino. Por ahora, del catálogo:';
  end if;

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
    'text', v_why||E'\n\n'||v_cat_text,
    'parse_mode', null,
    'inline_keyboard', jsonb_build_array(jsonb_build_array(public._bot_btn('Menú','menu')))));
end;
$function$;

-- 4) bot_ficha_cliente: homónimos -> botones (antes: re-pregunta por texto)
CREATE OR REPLACE FUNCTION public.bot_ficha_cliente(p_chat bigint, p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_pid uuid; v_role text; v_view_all boolean;
  v_nc int; v_names text; v_lead_id uuid; v_lead record; v_phone_cb text; v_kb jsonb;
  v_ref text := btrim(coalesce(p_ref,''));
begin
  select org,pid,role,view_all into v_org,v_pid,v_role,v_view_all from public._bot_requester(p_chat);
  if v_org is null then return public._bot_smart_reask('No estás conectado al CRM. Usá /conectar ########.'); end if;
  select count(*) into v_nc from public.fn_bot_name_candidates(p_chat, v_ref);
  if v_nc = 0 then
    return public._bot_smart_reask('No encontré al cliente "'||v_ref||'" en tu cartera. ¿Lo escribiste completo? También podés pasarme el teléfono.');
  elsif v_nc > 1 then
    return public._bot_disambiguate(p_chat, 'ficha', '{}'::jsonb, v_ref);
  end if;
  select lead_id into v_lead_id from public.fn_bot_name_candidates(p_chat, v_ref) limit 1;
  select * into v_lead from public.leads where id=v_lead_id and organization_id=v_org;
  perform public._bot_remember_lead(p_chat, v_org, v_lead.id, v_lead.name, v_lead.phone_normalized);
  v_phone_cb := nullif(regexp_replace(coalesce(v_lead.phone,''),'[^0-9]','','g'),'');
  v_kb := case when v_phone_cb is not null
    then jsonb_build_array(jsonb_build_array(public._bot_btn('Ver ficha','view',v_phone_cb), public._bot_btn('Menú','menu')))
    else jsonb_build_array(jsonb_build_array(public._bot_btn('Menú','menu'))) end;
  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text', btrim(coalesce(v_lead.name,'(sin nombre)'))||E'\n'||
          'Teléfono: '||coalesce(nullif(v_lead.phone,''),'sin teléfono')||E'\n'||
          'Etapa: '||coalesce(nullif(v_lead.stage,''),'sin etapa')||' · Score '||coalesce(v_lead.score,0)||case when v_lead.hot then ' (HOT)' else '' end||E'\n'||
          'Presupuesto: '||public._bot_fmt_k(public.fn_presupuesto_k(v_lead.presupuesto))||
          case when nullif(v_lead.email,'') is not null then E'\nCorreo: '||v_lead.email else '' end||
          case when nullif(v_lead.next_action,'') is not null then E'\nPróxima acción: '||v_lead.next_action else '' end,
    'parse_mode',null,'inline_keyboard', v_kb));
end;
$function$;
