create or replace function public.bot_crm_conversation_multi(p_chat bigint,p_actions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare a jsonb; r jsonb; v_results jsonb:='[]'; v_text text:=''; v_ok boolean:=true;
begin
 if jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions) not between 1 and 10 then
  return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Divide el pedido en hasta diez acciones para revisarlas contigo.'));
 end if;
 for a in select value from jsonb_array_elements(p_actions) loop
  if coalesce(a->>'tool_name','') in ('multi','multi_task','multi_action','multi_tarea','multiple_tasks','') then
   r:=jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No identifiqué una de las acciones; esa parte no se guardó.'));
  else
   begin
    r:=public.bot_nlu_dispatch_gvintell(p_chat,a->>'tool_name',coalesce(a->'args','{}'::jsonb));
   exception when others then
    r:=jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No pude guardar una de las acciones. Esa parte no se completó.'));
   end;
  end if;
  v_results:=v_results||jsonb_build_array(r);
  v_ok:=v_ok and coalesce((r->>'ok')::boolean,false);
  v_text:=concat_ws(E'\n\n',nullif(v_text,''),nullif(r#>>'{reply,text}',''));
 end loop;
 return jsonb_build_object('ok',v_ok,'results',v_results,'reply',jsonb_build_object('text',v_text));
end $fn$;
revoke all on function public.bot_crm_conversation_multi(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.bot_crm_conversation_multi(bigint,jsonb) to service_role;


CREATE OR REPLACE FUNCTION public.bot_stage_create_lead_pre_tarjeta(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_asesor jsonb; v_org uuid; v_role text; v_can_reassign boolean; v_tz text; v_profile uuid;
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text',''));
  v_name text := nullif(trim(coalesce(v_args->>'name', v_args->>'client_name', v_args->>'nombre','')),'');
  v_phone text := nullif(trim(coalesce(v_args->>'phone', v_args->>'telefono','')),'');
  v_email text := nullif(trim(coalesce(v_args->>'email','')),'');
  v_stage text := nullif(trim(coalesce(v_args->>'stage', v_args->>'etapa','')),'');
  v_project text := nullif(trim(coalesce(v_args->>'project', v_args->>'proyecto','')),'');
  v_campaign text := nullif(trim(coalesce(v_args->>'campaign', v_args->>'campana', v_args->>'campaña','')),'');
  v_budget_text text := nullif(trim(coalesce(v_args->>'budget_text', v_args->>'budget', v_args->>'presupuesto_texto','')),'');
  v_budget_num bigint := nullif(regexp_replace(coalesce(v_args->>'budget_numeric', v_args->>'presupuesto',''),'[^0-9]','','g'),'')::bigint;
  v_notas text := nullif(trim(coalesce(v_args->>'notas', v_args->>'nota', v_args->>'bio', v_args->>'comentario','')),'');
  v_next text := nullif(trim(coalesce(v_args->>'next_action', v_args->>'proxima_accion', v_args->>'accion','')),'');
  v_when text := nullif(trim(coalesce(v_args->>'next_action_at', v_args->>'fecha','')),'');
  v_asesor_req text := nullif(trim(coalesce(v_args->>'asesor_name', v_args->>'advisor_name', v_args->>'new_asesor_name','')),'');
  v_m text[]; v_at timestamptz;
  v_etoken text; v_epayload jsonb; v_p jsonb; v_token text; v_state text;
  v_fname text; v_fphone text; v_fstage text; v_fnext text; v_fwhen text;
  v_lines text[]; v_summary text; v_money text; v_fecha text; v_kb jsonb; v_reply jsonb;
  v_business jsonb; v_business_text text; v_business_pending boolean:=false; v_resolved_stage text;
  v_falta text[] := ARRAY[]::text[]; v_falta_txt text := ''; v_stage_given boolean := true;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean,false) is not true then
    return public._bot_err_envelope(jsonb_build_object('error','not_paired'));
  end if;
  v_org := (v_asesor->>'organization_id')::uuid;
  v_profile := (v_asesor->>'profile_id')::uuid;
  v_role := coalesce(v_asesor->>'role','asesor');
  v_can_reassign := v_role in ('super_admin','admin','ceo','director');
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  if v_phone is null and v_text <> '' then
    v_m := regexp_match(regexp_replace(v_text,'[\s\-\(\)]','','g'), '(\+?\d{7,15})');
    if v_m is not null then v_phone := regexp_replace(v_m[1],'\D','','g'); end if;
  elsif v_phone is not null then
    v_phone := nullif(regexp_replace(v_phone,'[^0-9+]','','g'),'');
  end if;
  if v_asesor_req is not null and not v_can_reassign then v_asesor_req := null; end if;
  if v_can_reassign and v_asesor_req is null
     and v_text ~* '(asign\w+|al\s+asesor|para\s+el\s+asesor|reasign\w+)' then
    v_m := regexp_match(v_text, 'asesor\s+([A-Za-z0-9áéíóúñ]+(?:\s+[A-Za-z0-9áéíóúñ]+)?)', 'i');
    if v_m is not null then
      v_asesor_req := case when v_m[1] ~ '^[0-9]+$' then 'asesor '||v_m[1] else v_m[1] end;
    end if;
  end if;
  if v_next is null and v_text <> '' then
    v_next := nullif(trim(coalesce(
      (regexp_match(v_text, 'pr[oó]xima\s+acci[oó]n\s*(?:es|ser[ií]a|:)?\s*([a-záéíóúñ][a-záéíóúñ]+(?:\s+(?:le|lo|la|les))?)', 'i'))[1],
      (regexp_match(v_text, '\y(ll[aá]mar\w*|ll[aá]mal\w*|contactar(?:lo|la|le|los|las)?|enviar\w*|envial\w*|mandar\w*|mandal\w*|visitar\w*|agendar\w*|escribir\w*|cotizar\w*|presentar\w*|reunir\w*|seguir\w*|mostrar\w*)\y', 'i'))[1]
    )),'');
  end if;

  select token, payload into v_etoken, v_epayload
  from public.bot_pending_actions
  where telegram_chat_id=p_telegram_chat_id and action_type='create_lead' and consumed_at is null
    and (expires_at is null or expires_at>now())
  order by created_at desc limit 1;

  if v_etoken is not null then
    if (v_phone is not null and nullif(v_epayload->>'phone','') is not null and v_phone <> (v_epayload->>'phone'))
       or (v_name is not null and nullif(v_epayload->>'name','') is not null and lower(v_name) <> lower(v_epayload->>'name') and coalesce(v_args->>'_merge_pending','false')<>'true') then
      update public.bot_pending_actions set consumed_at=now() where token=v_etoken;
      v_etoken := null; v_epayload := null;
    end if;
  end if;

  if v_notas is not null and nullif(v_epayload->>'notas','') is not null and v_notas<>v_epayload->>'notas' then
    v_notas:=(v_epayload->>'notas')||E'\n'||v_notas;
  end if;
  v_p := coalesce(v_epayload,'{}'::jsonb)
    || (case when v_name is not null then jsonb_build_object('name',v_name) else '{}'::jsonb end)
    || (case when v_phone is not null then jsonb_build_object('phone',v_phone) else '{}'::jsonb end)
    || (case when v_email is not null then jsonb_build_object('email',v_email) else '{}'::jsonb end)
    || (case when v_stage is not null then jsonb_build_object('stage',v_stage) else '{}'::jsonb end)
    || (case when v_project is not null then jsonb_build_object('project',v_project) else '{}'::jsonb end)
    || (case when v_campaign is not null then jsonb_build_object('campaign',v_campaign) else '{}'::jsonb end)
    || (case when v_budget_text is not null then jsonb_build_object('budget_text',v_budget_text) else '{}'::jsonb end)
    || (case when v_budget_num is not null then jsonb_build_object('budget_numeric',v_budget_num) else '{}'::jsonb end)
    || (case when v_notas is not null then jsonb_build_object('notas',v_notas) else '{}'::jsonb end)
    || (case when v_next is not null then jsonb_build_object('next_action',v_next) else '{}'::jsonb end)
    || (case when v_asesor_req is not null then jsonb_build_object('new_asesor_name',v_asesor_req) else '{}'::jsonb end);

  -- Schedule only the requested activity time, never a date buried in the story.
  v_at := public.parse_relative_or_abs_es(v_when, v_tz);
  if v_at is not null then
    v_p := v_p || jsonb_build_object('next_action_at', to_char(v_at,'YYYY-MM-DD"T"HH24:MI:SSOF'));
  end if;

  v_fname := nullif(v_p->>'name','');
  v_fphone := nullif(v_p->>'phone','');
  v_fnext := nullif(v_p->>'next_action','');
  v_fwhen := nullif(v_p->>'next_action_at','');
  if v_fnext is null and v_fwhen is not null then v_fnext := 'Llamar'; v_p := v_p || jsonb_build_object('next_action','Llamar'); end if;
  -- Resolve business only during creation, using this organization's own configuration.
  -- Remove the known contact name before reading free-text business hints.
  v_business_text:=coalesce(nullif(v_args->>'business',''),nullif(v_args->>'negocio',''),v_text);
  if nullif(v_args->>'business','') is null and nullif(v_args->>'negocio','') is null and v_fname is not null then
    v_business_text:=replace(lower(v_business_text),lower(v_fname),' ');
  end if;
  v_business:=public.fn_org_business_match(v_org,v_business_text);
  if coalesce((v_business->>'ambiguous')::boolean,false) then
    v_business_pending:=true; v_p:=v_p-'stage';
  elsif v_business is not null then
    v_resolved_stage:=public.fn_org_stage(v_org,nullif(v_stage,''));
    if nullif(v_stage,'') is null
       or (public.unaccent(lower(v_stage)) in ('nuevo registro','contactame ya','primer contacto','primera etapa','nuevo','new','inbound')
           or v_resolved_stage=public.fn_org_stage(v_org,'primera etapa'))
          and strpos(public.unaccent(lower(v_text)),public.unaccent(lower(coalesce(v_stage,''))))=0 then
      v_p:=v_p||jsonb_build_object('stage',v_business->>'entryStage');
    elsif not(v_business->'stages' ? v_resolved_stage) then
      return jsonb_build_object('ok',false,'needs_input','business_stage','reply',jsonb_build_object('text','El negocio '||(v_business->>'label')||' no corresponde a la etapa indicada. Dime el negocio y la etapa que quieres usar.','inline_keyboard','[]'::jsonb));
    end if;
    v_p:=v_p||jsonb_build_object('_business_line',v_business->>'id','_business_label',v_business->>'label','_needs_business',false);
  elsif nullif(coalesce(v_args->>'business',v_args->>'negocio'),'') is not null or coalesce((v_epayload->>'_needs_business')::boolean,false) then
    v_business_pending:=true;
  end if;
  v_stage_given := nullif(v_p->>'stage','') is not null; v_fstage := public.fn_org_stage(v_org,coalesce(nullif(v_p->>'stage',''),'primera etapa'));
  if v_fstage is null and not v_business_pending then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text',
      'Indica una etapa de tu empresa: '||coalesce(array_to_string(public.fn_org_stages_list(v_org),' · '),'sin etapas configuradas')||'.','inline_keyboard','[]'::jsonb));
  end if;
  if not v_business_pending then v_p := v_p || jsonb_build_object('stage', v_fstage);
  else v_p:=v_p||jsonb_build_object('_needs_business',true); end if;

  if v_business_pending then v_state:='ask_business';
  elsif v_fname is null then v_state := 'ask_name';
  else v_state := 'ready'; end if;

  v_p := v_p || jsonb_build_object('_ready', (v_state='ready'));
  v_token := public._bsc_upsert_pending(p_telegram_chat_id, v_profile, v_org, v_etoken, v_p);

  update public.bot_pending_actions set consumed_at=now()
  where telegram_chat_id=p_telegram_chat_id and consumed_at is null
    and action_type in ('create_lead','upsert_lead','update_fields')
    and token <> v_token;

  if v_state='ask_business' then
    return jsonb_build_object('ok',true,'needs_input','business','reply',jsonb_build_object('text','¿A qué negocio pertenece este contacto? '||(select string_agg(x->>'label',' · ') from jsonb_array_elements((select meta_config#>'{crm,businessLines}' from public.organizations where id=v_org)) x),'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_phone' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Para registrar el cliente necesito su teléfono. ¿Cuál es el número?','parse_mode',null,'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_name' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Tengo el teléfono '||public._bot_fmt_phone(v_fphone)||'. ¿Cómo se llama el cliente?','parse_mode',null,'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_time' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Anoté la próxima acción "'||v_fnext||'" para '||v_fname||'. ¿Para qué fecha y hora la agendo? (ej: "mañana 3pm", "hoy en 2 horas")','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;

  v_money := case when (v_p->>'budget_numeric') is not null then public._bot_fmt_money((v_p->>'budget_numeric')::bigint)
                  else coalesce(nullif(v_p->>'budget_text',''),'—') end;
  v_fecha := case when v_fwhen is not null then public._bot_fmt_when(v_fwhen::timestamptz) else '—' end;
  v_lines := array['Voy a registrar el siguiente lead:'];
  v_lines := v_lines || ('Cliente: '||v_fname);
  if nullif(v_p->>'_business_label','') is not null then v_lines:=v_lines||('Negocio: '||(v_p->>'_business_label')); end if;
  v_lines := v_lines || ('Tel: '||coalesce(nullif(public._bot_fmt_phone(v_fphone),''),'Sin teléfono por ahora'));
  v_lines := v_lines || ('Estatus: '||v_fstage);
  v_lines := v_lines || ('Presupuesto: '||v_money);
  v_lines := v_lines || ('Proyecto: '||coalesce(nullif(v_p->>'project',''),'—'));
  v_lines := v_lines || ('Campaña: '||coalesce(nullif(v_p->>'campaign',''),'—'));
  v_lines := v_lines || ('Próx. acción: '||coalesce(v_fnext,'—')||case when v_fwhen is not null then ' — '||v_fecha else '' end);
  v_lines := v_lines || ('Notas: '||coalesce(nullif(v_p->>'notas',''),'—'));
  if nullif(v_p->>'new_asesor_name','') is not null then
    v_lines := v_lines || ('Asesor: '||(v_p->>'new_asesor_name'));
  end if;
  v_summary := array_to_string(v_lines,E'\n');

  -- Aviso de datos faltantes: se incluye en el SUMMARY para que bot_finalize_reply lo conserve al re-armar la tarjeta.
  if v_money = '—' then v_falta := array_append(v_falta, 'presupuesto'); end if;
  if v_fnext is null then v_falta := array_append(v_falta, 'próxima acción'); end if;
  if not v_stage_given then v_falta := array_append(v_falta, 'etapa/status (lo dejé en "'||v_fstage||'")'); end if;
  if cardinality(v_falta) > 0 then
    v_falta_txt := E'\n\n📝 Para que tu registro quede completo me falta: ' || array_to_string(v_falta, ', ')
                || '. Pásamelo si lo tienes; o registralo así con el botón de abajo.';
    v_summary := v_summary || v_falta_txt;
  end if;

  update public.bot_pending_actions set summary=v_summary where token=v_token;
  v_kb := public._bot_kb_confirm(v_token);

  return jsonb_build_object('ok',true,'staged',true,'token',v_token,'reply',jsonb_build_object('text',v_summary||E'\n\n¿Confirmas?','parse_mode',null,'inline_keyboard',v_kb));
end; $function$;

CREATE OR REPLACE FUNCTION public.fn_copilot_contexto(p_chat bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_prof record; v_turnos jsonb; v_avisos jsonb;
  v_recientes jsonb; v_pend jsonb; v_tz text;
begin
  select id, organization_id, name, coalesce(role,'asesor') as role into v_prof
  from profiles where telegram_chat_id = p_chat and coalesce(active,true) limit 1;
  if v_prof.id is null then return jsonb_build_object('ok', false); end if;
  v_tz := coalesce(public.fn_user_tz(v_prof.organization_id, p_chat), 'America/Cancun');

  -- LA CONVERSACIÓN: solo turnos reales, en orden, sin repetidos.
  with reales as (
    select a.role, a.content, a.created_at, a.id,
           lower(regexp_replace(replace(replace(replace(coalesce(a.content,''),'**',''),'«',''),'»',''),
                 '\s+', ' ', 'g')) as esencia
    from public.tg_bot_activity a
    where a.organization_id=v_prof.organization_id and a.telegram_chat_id = p_chat
      and a.meta->>'kind' is null          -- (1) fuera los avisos automáticos
      and coalesce(btrim(a.content),'') <> ''
    order by a.created_at desc, (a.role = 'ai') desc, a.id desc
    limit 36
  ), ordenados as (
    select r.*, row_number() over (order by r.created_at, (r.role = 'user') desc, r.id) as n
    from reales r                                  -- (2) usuario antes que asistente
  ), sin_repes as (
    select o.* from ordenados o
    left join ordenados prev on prev.n = o.n - 1
    where prev.esencia is null or prev.esencia <> o.esencia   -- (3) sin duplicados
  )
  select coalesce(jsonb_agg(jsonb_build_object('rol', s.role, 'texto', left(s.content, 4000))
                            order by s.n), '[]'::jsonb)
    into v_turnos
  from (select * from sin_repes order by n desc limit 20) s;  -- (4) 14 turnos reales

  -- Los avisos que le mandó el sistema, aparte y resumidos: contexto, no diálogo.
  select coalesce(jsonb_agg(jsonb_build_object('aviso', left(t.content, 120)) order by t.created_at), '[]'::jsonb)
    into v_avisos
  from (select content, created_at from public.tg_bot_activity
        where organization_id=v_prof.organization_id and telegram_chat_id = p_chat and meta->>'kind' is not null
        order by created_at desc limit 4) t;

  select coalesce(jsonb_agg(jsonb_build_object('titulo', text, 'para', asesor_name,
           'cuando', fn_fmt_cuando_legible(due_at, v_tz)) order by created_at desc), '[]'::jsonb)
    into v_recientes
  from (select text, asesor_name, due_at, created_at from team_actions
        where organization_id=v_prof.organization_id and created_by = v_prof.id and created_at > now() - interval '40 minutes'
          and coalesce(done,false) = false
        order by created_at desc limit 5) t;

  select to_jsonb(x) into v_pend from (
    select action, coalesce(jsonb_array_length(payload->'tareas'),0) as tareas_n, payload->'tareas' as tareas
    from bot_pending_confirm where organization_id=v_prof.organization_id and telegram_chat_id = p_chat and created_at>now()-interval '24 hours'
      and not exists(select 1 from public.bot_pending_actions a where a.organization_id=v_prof.organization_id and a.telegram_chat_id=p_chat
       and a.consumed_at is null and a.expires_at>now() and a.created_at>bot_pending_confirm.created_at) limit 1) x;

  return jsonb_build_object('ok', true, 'quien_escribe', v_prof.name, 'rol', v_prof.role,
    'equipo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', name, 'rol', coalesce(role,'asesor')) order by name), '[]'::jsonb)
                from profiles where organization_id = v_prof.organization_id and coalesce(active,true)),
    'empresa',(select name from public.organizations where id=v_prof.organization_id),
    'etapas',to_jsonb(public.fn_org_stages_list(v_prof.organization_id)),
    'negocios',(select meta_config#>'{crm,businessLines}' from public.organizations where id=v_prof.organization_id),
    'registro_en_curso',(select jsonb_build_object('tipo',action_type,'datos',payload,'listo',payload->'_ready')
       from public.bot_pending_actions where organization_id=v_prof.organization_id and telegram_chat_id=p_chat
       and action_type='create_lead' and consumed_at is null and expires_at>now() order by created_at desc limit 1),
    'clientes_recientes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.name,'etapa',c.stage,'telefono',c.phone)),'[]'::jsonb)
      from(select id,name,stage,phone from public.leads where organization_id=v_prof.organization_id and deleted_at is null
        and (v_prof.role in ('admin','super_admin','director','ceo') or asesor_id=v_prof.id)
        order by updated_at desc limit 8)c),
    'ultimos_mensajes', v_turnos,
    'avisos_automaticos_recientes', v_avisos,
    'tareas_recien_registradas', v_recientes,
    'plan_esperando_confirmacion', coalesce(v_pend, 'null'::jsonb));
end;
$function$;

CREATE OR REPLACE FUNCTION public.bot_confirm_latest_pending(p_telegram_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_token text;
  v_result jsonb;
  v_remaining int;
  v_reas jsonb;
BEGIN
  SELECT token INTO v_token
  FROM public.bot_pending_actions
  WHERE telegram_chat_id = p_telegram_chat_id
    AND consumed_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    -- mig 301: ¿había un reparto esperando respuesta? Entonces el «sí» es para eso.
    SELECT payload INTO v_reas
    FROM public.bot_pending_confirm
    WHERE telegram_chat_id = p_telegram_chat_id
      AND action = 'reasignar_pendiente'
      AND created_at > now() - interval '15 minutes'
    LIMIT 1;

    IF v_reas IS NOT NULL
       AND coalesce(v_reas->>'origen','') <> ''
       AND coalesce(v_reas->>'destino','') <> ''
       AND coalesce(nullif(v_reas->>'cantidad','')::int, 0) > 0 THEN
      DELETE FROM public.bot_pending_confirm
       WHERE telegram_chat_id = p_telegram_chat_id AND action = 'reasignar_pendiente';
      -- Arma el PLAN (no mueve nada): queda el «¿Confirmas?» de siempre.
      RETURN public.bot_redistribuir_leads(p_telegram_chat_id, jsonb_build_object(
        'origen', v_reas->>'origen',
        'etapa',  v_reas->>'etapa',
        'orden',  coalesce(v_reas->>'orden','nuevos'),
        'destinos', jsonb_build_array(jsonb_build_object(
          'nombre', v_reas->>'destino', 'cantidad', (v_reas->>'cantidad')::int)),
        'confirmar', false));
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'no_pending',
      'reply', jsonb_build_object(
        'text', 'No tienes nada pendiente. Dime que necesitas.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  END IF;

  v_result := public._bot_execute_pending(p_telegram_chat_id, v_token);

  SELECT count(*) INTO v_remaining
  FROM public.bot_pending_actions
  WHERE telegram_chat_id = p_telegram_chat_id
    AND consumed_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_remaining > 0 AND v_result ? 'reply' THEN
    v_result := jsonb_set(
      v_result,
      '{reply,text}',
      to_jsonb(
        coalesce(v_result->'reply'->>'text', 'Listo.') ||
        E'\n\n' ||
        'Quedan ' || v_remaining || ' accion(es) pendientes. Responde "si" para confirmar la siguiente o "no" para cancelarlas todas.'
      )
    );
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name, ''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_stage text; v_zoom_when text; v_next_when text; v_has_next_action boolean;
  -- mig 245: el plan de la llamada · mig 255: la nota al expediente
  v_txt text; v_norm text; v_nota jsonb;
  v_plan_report uuid; v_plan_lead uuid; v_plan_org uuid;
  v_lead_name text; v_asesor_name text; v_zoom_at timestamptz;
  v_res jsonb; v_mgr bigint;
begin
  -- CONVERSATION_CONTEXT_20261106: shared operation contracts win before legacy heuristics.
  if v_tool in ('multi','multi_task','multi_action','multi_tarea','multiple_tasks')
    and jsonb_typeof(v_args->'actions')='array'
    and exists(select 1 from jsonb_array_elements(v_args->'actions') a where a->>'tool_name' in ('update_client','create_personal_reminder')) then
    return public.bot_crm_conversation_multi(p_telegram_chat_id,v_args->'actions');
  end if;
  if v_tool='update_client' then return public.bot_crm_update_client(p_telegram_chat_id,v_args); end if;
  if v_tool in ('upsert_lead','create_lead','add_client','create_client') then
    return public.bot_stage_create_lead(p_telegram_chat_id,v_args);
  end if;
  if v_tool='create_personal_reminder' and nullif(v_args->>'when','') is not null then
    return public.bot_create_personal_reminder(p_telegram_chat_id,v_args);
  end if;
  if v_tool in ('confirm_last','confirmar') then return public.bot_confirm_latest_pending(p_telegram_chat_id); end if;
  if v_tool in ('','menu') and public.unaccent(lower(btrim(coalesce(v_args->>'input_text','')))) ~ '^(si|sí|dale|ok|confirmo|confirmar|adelante)[.! ]*$'
    and exists(select 1 from public.bot_pending_actions a join public.profiles p on p.telegram_chat_id=a.telegram_chat_id and p.organization_id=a.organization_id
     where a.telegram_chat_id=p_telegram_chat_id and p.active and a.consumed_at is null and a.expires_at>now()) then
    return public.bot_confirm_latest_pending(p_telegram_chat_id);
  end if;
  -- Space requests precede catalog routing and pending-plan consumption.
  v_txt:=public._bot_space_request_text(p_args);
  v_norm:=public.unaccent(lower(v_txt));
  if v_tool in ('space_documents','get_document','buscar_documentos','documents')
     or (public._bot_is_space_document_request(v_norm)
       and (v_norm ~ '(mi[[:space:]]*espa|mi[[:space:]]+space)' or v_norm !~ '\y(clientes?|pacientes?|prospectos?|expediente)\y')
       and v_tool not in
       ('create_lead','upsert_lead','change_stage','update_fields','add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion','multi','multi_task','create_team_actions','create_team_action','create_personal_reminder','create_task','add_task','assign_task','delete_task','soft_delete')) then
    v_res:=public.bot_documentos_espacio(p_telegram_chat_id,coalesce(p_args,'{}'::jsonb)||jsonb_build_object('input_text',v_txt));
    if coalesce((v_res->>'found')::boolean,false)
      or v_tool in ('space_documents','get_document','buscar_documentos','documents')
      or v_norm ~ '(mi[[:space:]]*espa|mi[[:space:]]+space|docu[a-z]*|archivos?|contratos?|informes?|reportes?|presentacion|manual|notion|figma|excel|planilla|spreadsheet)' then
      return v_res;
    end if;
  end if;
  -- mig 318: repartir la cartera de un asesor (solo dirección) y deshacerlo.
  -- Se activa SOLO por tool_name exacto, nunca por el texto.
  if lower(coalesce(p_tool_name,'')) in ('redistribuir_leads','repartir_cartera','distribuir_leads') then
    -- mig 300: el detector del flujo manda solo origen/destinos, asi que
    -- «los mas antiguos» y «de segunda etapa» se perdian. Si la frase trae
    -- filtros (o no trae destino), la lee el parser de la base. Con DOS o mas
    -- destinos NO se toca: ese reparto lo arma bien el flujo.
    v_res := null;
    if coalesce(nullif(btrim(p_args->>'input_text'), ''), '') <> ''
       and (case when jsonb_typeof(p_args->'destinos') = 'array'
                 then jsonb_array_length(p_args->'destinos') else 0 end) <= 1
       and coalesce(p_args->>'etapa','') = ''
    then
      v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id, p_args->>'input_text');
    end if;
    if v_res is not null then return v_res; end if;
    return public.bot_redistribuir_leads(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;
  if lower(coalesce(p_tool_name,'')) in ('deshacer_redistribucion','undo_redistribucion') then
    return public.bot_deshacer_redistribucion(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;

  -- mig 298: la misma orden, dicha en palabras («mueve los 50 clientes más
  -- antiguos de Gael de segunda etapa a Carlos»). Solo arma el PLAN y pide
  -- confirmación: por texto NUNCA se mueve una cartera. Devuelve null si la
  -- frase no era una reasignación, y el asistente sigue su curso.
  if v_tool in ('','menu') and coalesce(p_args->>'interpreted','') <> 'true' then
    v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id,
               coalesce(nullif(btrim(p_args->>'input_text'), ''), ''));
    if v_res is not null then return v_res; end if;
  end if;

  -- mig 300: el desglose del intérprete manda. Va derecho al plural, que
  -- respeta responsable y hora de cada tarea. Nada de regex sobre el crudo.
  if lower(coalesce(p_tool_name,'')) in ('create_team_actions','create_team_action')
     and jsonb_typeof(p_args->'tareas') = 'array'
     and jsonb_array_length(p_args->'tareas') > 0 then
    v_res := public.bot_create_team_actions(p_telegram_chat_id, p_args->'tareas', false);
    -- Si quedó como plan a confirmar, se recuerda para que el «sí» lo aplique.
    if coalesce(v_res#>>'{reply,text}','') like 'Entendí%' then
      delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
      insert into public.bot_pending_confirm (telegram_chat_id, action, organization_id, payload)
      values (p_telegram_chat_id, 'team_plan',
              (select organization_id from public.profiles
                where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
                order by updated_at desc nulls last limit 1),
              jsonb_build_object('tareas', p_args->'tareas'));
    end if;
    return v_res;
  end if;

  -- mig 296: un ENCARGO a otra persona se reconoce al entrar.
  -- Exige responsable Y verbo: una pregunta nunca cumple las dos.
  if jsonb_typeof(p_args->'tareas') is distinct from 'array'
     and coalesce(p_args->>'interpreted','') <> 'true'
     and coalesce(lower(p_tool_name),'') in ('','menu')
     and coalesce(jsonb_array_length(public.fn_ventas_split_dictado(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           coalesce(nullif(btrim(p_args->>'input_text'),''),
                    nullif(btrim(p_args->>'text'),''), ''))), 0) < 2
     and public._bot_responsable_del_texto(coalesce(
         nullif(btrim(p_args->>'input_text'),''),
         nullif(btrim(p_args->>'text'),''), '')) is not null
     and exists (select 1 from public._ventas_find_profile(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           public._bot_responsable_del_texto(coalesce(
             nullif(btrim(p_args->>'input_text'),''),
             nullif(btrim(p_args->>'text'),''), ''))))
     and lower(coalesce(p_args->>'input_text', p_args->>'text', ''))
         ~ '(?i)\y(as[ií]gnale|asignar|asigna|ponle|d[ií]le|enc[aá]rgale|p[ií]dele|pedirle|solic[ií]tale)\y' then
    return public.bot_create_team_action(p_telegram_chat_id,
      coalesce(public._bot_tarea_del_texto(coalesce(p_args->>'input_text', p_args->>'text')),
               p_args->>'input_text'),
      coalesce(p_args->>'input_text', p_args->>'text'),
      public._bot_responsable_del_texto(coalesce(p_args->>'input_text', p_args->>'text')));
  end if;
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}', '')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;



  if exists(select 1 from public.bot_pending_actions a
      join public.profiles p on p.organization_id=a.organization_id and p.telegram_chat_id=a.telegram_chat_id and p.active
      where a.telegram_chat_id=p_telegram_chat_id and a.action_type='create_lead' and a.consumed_at is null
        and (a.expires_at is null or a.expires_at>now()) and a.payload->>'_needs_business'='true'
        and public.fn_org_business_match(a.organization_id,coalesce(v_args->>'input_text',v_args->>'text','')) is not null) then
    return public.bot_stage_create_lead(p_telegram_chat_id,v_args);
  end if;

  /* ── EL PLAN DE LA LLAMADA (mig 245) ──────────────────────────────────────
     Al tocar «Ya estudié, este es mi plan» queda un reporte `awaiting_plan`
     abierto y el asistente pide el plan. En Telegram el flujo de n8n atrapa esa
     respuesta ANTES del cerebro; el Copilot NO tiene esa rama, así que el plan
     caía como una nota suelta al expediente. Se resuelve donde vive la causa —el
     cerebro—: si hay un plan pendiente, lo que la persona escribe ES el plan. */
  v_txt := btrim(coalesce(v_args->>'input_text', v_args->>'texto', v_args->>'raw_text',
                          v_args->>'message', v_args->>'contenido', v_args->>'nota', ''));
  -- mig 268: agendar un Zoom o una visita CON UN CLIENTE no es una tarea de equipo.
  if v_txt <> '' and v_tool in ('add_task','create_task','team_action','add_team_action','crear_tarea','asignar_tarea','agenda_personal') then
    v_norm := public.unaccent(lower(v_txt));
    if v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      null;
    end if;
    -- mig 282: varias tareas en una frase, cada una con su hora.
    if v_tool in ('create_personal_reminder','add_task','create_team_action')
       and jsonb_array_length(public.fn_partir_tareas(v_txt)) > 1 then
      return public.bot_create_team_actions(p_telegram_chat_id,
               public.fn_partir_tareas(v_txt), true);
    end if;
    -- mig 274: «asignale a Fulano …» es una tarea PARA Fulano.
    -- mig 294: hace falta un VERBO de encargo. Sin eso, una pregunta
    -- («¿cuáles son mis actividades?») se convertía en tarea.
    if public._bot_responsable_del_texto(v_txt) is not null
       and v_norm ~ '\y(asigna\w*|asignale|ponle|dile|encargale|encargarle|pidele|pedirle|solicitale|solicitarle|recuerdale|recordarle|comentale|avisale|mandale|escribele)\y' then
      v_tool := 'create_team_action';
      v_args := v_args || jsonb_build_object('responsable', public._bot_responsable_del_texto(v_txt));
      if coalesce(btrim(v_args->>'text'),'') = '' and public._bot_tarea_del_texto(v_txt) is not null then
        v_args := v_args || jsonb_build_object('text', public._bot_tarea_del_texto(v_txt));
      end if;
    end if;
    if v_tool = 'create_team_action' then
      null;
    elsif v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      if v_norm ~ '\y(zoom|reunion|videollamada)\y' then
        v_tool := 'set_zoom_datetime';
      elsif v_norm ~ '\y(visita|recorrido|showing)\y' then
        v_tool := 'agendar_visita';
      end if;
      if v_tool in ('set_zoom_datetime','agendar_visita') then
        if coalesce(btrim(v_args->>'client_name'),'') = '' then
          v_args := v_args || jsonb_build_object('client_name', public._bot_cliente_del_texto(v_txt));
        end if;
        if coalesce(btrim(v_args->>'fecha'),'') = '' then
          v_args := v_args || jsonb_build_object('fecha', v_txt);
        end if;
      end if;
    end if;
    v_norm := null;
  end if;

  if v_txt <> '' then
    select r.id, r.lead_id, r.organization_id
      into v_plan_report, v_plan_lead, v_plan_org
    from public.proactive_pending_reports r
    where r.advisor_telegram_id = p_telegram_chat_id
      and r.status = 'open' and r.kind = 'awaiting_plan'
      and (r.expires_at is null or r.expires_at > now())
    order by r.created_at desc limit 1;
  end if;

  if v_plan_report is not null then
    v_norm := public.unaccent(lower(v_txt));

    if v_norm ~ '^/'
       or v_norm ~ '^(menu|inicio|start|home|ayuda|hola|buenas|buenos dias|buenas tardes|buenas noches)($|\s)'
       or v_norm ~ '^(si|no|ok|okay|dale|listo|cancelar|cancela|confirmar|confirmo)[.!]?$'
       or v_norm ~ '(mis clientes|lista de clientes|mis leads|mi agenda|mis pendientes|que tengo hoy|proximas acciones|kpis|indicadores|como voy|mis numeros|pipeline|embudo)' then
      null;  -- Es un comando: pasa, y el plan sigue pendiente (mismo escape que Telegram).

    elsif v_norm ~ '(no tengo (un |el )?plan|sin plan|no lo prepare|no alcance a|no pude preparar|no se que decirle|necesito (apoyo|ayuda))' then
      select l.name into v_lead_name from public.leads l where l.id = v_plan_lead;
      v_res := public.fn_proactive_plan_giveup(jsonb_build_object(
        'organization_id', v_plan_org, 'advisor_telegram_id', p_telegram_chat_id,
        'lead_id', v_plan_lead, 'report_id', v_plan_report, 'raw_text', v_txt));
      for v_mgr in
        select x::bigint from jsonb_array_elements_text(coalesce(v_res->'manager_telegram_ids','[]'::jsonb)) as t(x)
      loop
        begin
          perform public.fn_log_proactive_copilot(v_mgr,
            '▸ Un asesor necesita apoyo' || chr(10) || '· ' || coalesce(v_res->>'admin_text',''), 'ai');
        exception when others then null; end;
      end loop;
      return jsonb_build_object('ok', true,
        'reply', jsonb_build_object(
          'text', '▸ Sin problema, te apoyamos' || chr(10)
                || '· Lo dejé anotado en el expediente de «' || coalesce(v_lead_name,'este cliente') || '».' || chr(10)
                || '· Tu coordinador ya está avisado para prepararlo contigo.' || chr(10)
                || '· Puedes seguir usando el asistente con normalidad.',
          'parse_mode', null, 'inline_keyboard', '[]'::jsonb));

    else
      select l.name, coalesce(l.selected_time, l.next_action_at) into v_lead_name, v_zoom_at
        from public.leads l where l.id = v_plan_lead;
      select p.name into v_asesor_name from public.profiles p
        where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true limit 1;

      v_res := public.fn_proactive_log_plan(jsonb_build_object(
        'lead_id', v_plan_lead, 'report_id', v_plan_report,
        'asesor_name', coalesce(v_asesor_name,'(sin asesor)'), 'plan', v_txt));

      if coalesce((v_res->>'ok')::boolean, false) then
        return jsonb_build_object('ok', true,
          'reply', jsonb_build_object(
            'text', '▸ Plan guardado' || coalesce(' — ' || v_lead_name, '') || chr(10)
                  || '· Quedó en el expediente del cliente; tu coordinador ya lo puede ver.'
                  || coalesce(chr(10) || '· Zoom: «' || public.fn_fmt_fecha_legible(v_zoom_at) || '»', '')
                  || chr(10) || '· Al terminar la llamada dime cómo te fue y actualizo la ficha.',
            'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
      end if;
      perform public.fn_proactive_close_report(jsonb_build_object('id', v_plan_report, 'outcome', 'plan_no_guardado'));
    end if;
  end if;

  /* ── AÑADIR AL EXPEDIENTE (mig 255) ───────────────────────────────────────
     «Añade en el expediente de Angel G, que es una persona muy puntual» se iba a
     VER LA FICHA solo porque decía «expediente», y tomaba la frase entera como
     nombre del cliente. Acá se mira el VERBO: si es escribir, y el nombre resuelve
     a un cliente único de TU cartera, va por el camino de agregar nota —con el
     teléfono ya resuelto, para que nadie lo vuelva a adivinar—. Si no resuelve,
     no se toca nada y el asistente pregunta como siempre. */
  if v_txt <> ''
     and v_tool not in ('add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion',
                        'upsert_lead','create_lead','update_fields','add_task','create_deal','soft_delete')
     and not exists (select 1 from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id)
  then
    begin
      v_nota := public._bot_nota_expediente_ref(p_telegram_chat_id, v_txt);
    exception when others then v_nota := jsonb_build_object('ok', false); end;

    if coalesce((v_nota->>'ok')::boolean, false) then
      return public.bot_nlu_dispatch_gvintell_required_fields_orig(
        p_telegram_chat_id, 'add_expediente_note',
        jsonb_build_object('phone', v_nota->>'phone', 'titulo', 'Nota del asesor',
                           'contenido', v_nota->>'contenido'));
    end if;
  end if;

  v_stage := nullif(btrim(coalesce(v_args->>'stage', v_args->>'st', v_args->>'etapa', '')), '');

  -- mig 239: «clientes sin movimiento» es una pregunta, no la lista de la cartera.
  if translate(lower(coalesce(v_args->>'input_text', v_args->>'texto', '')), 'áéíóú', 'aeiou')
     ~ '\y(sin\s+movimiento|sin\s+mover|sin\s+tocar|sin\s+actividad|inactivos?|abandonados?|enfriad)\y'
     and coalesce(v_tool,'') not in ('create_lead','upsert_lead','change_stage') then
    return public.bot_clientes_sin_movimiento(p_telegram_chat_id,
             coalesce(v_args->>'input_text', v_args->>'texto', ''));
  end if;

  -- mig 231: se suma lo que ESCRIBIÓ la persona (si no, el Zoom entraba en bucle).
  v_zoom_when := concat_ws(' ',
    v_args->>'zoom_at', v_args->>'zoom_datetime', v_args->>'selected_time', v_args->>'fecha_zoom',
    v_args->>'next_action_at', v_args->>'next_action_date',
    v_args->>'input_text', v_args->>'texto', v_args->>'raw_text');

  if v_stage = 'Zoom Agendado' and v_tool in ('change_stage', 'upsert_lead')
     and not public._bot_has_datetime_hint(v_zoom_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'zoom_at',
      'reply', jsonb_build_object(
        'text', 'Perfecto. Para moverlo a Zoom Agendado necesito la fecha y hora exacta del Zoom. Ej: "mañana 5 pm" o "viernes 19 de julio 11 am".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  v_has_next_action := nullif(btrim(coalesce(v_args->>'next_action', '')), '') is not null;
  v_next_when := concat_ws(' ',
    v_args->>'next_action_at', v_args->>'next_action_at_iso', v_args->>'next_action_date',
    v_args->>'when', v_args->>'due_at');

  if v_tool in ('update_next_action', 'add_task') and v_has_next_action
     and not public._bot_has_datetime_hint(v_next_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'next_action_at',
      'reply', jsonb_build_object(
        'text', 'Listo, entiendo la próxima acción. ¿Para qué fecha y hora la programo? Ej: "hoy 4:30 pm", "mañana 10 am" o "en 3 horas".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch_gvintell_required_fields_orig(p_telegram_chat_id, v_tool, v_args);
end;
$function$;