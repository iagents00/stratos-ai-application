-- Keep the full story in the file and the confirmation readable.
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
  v_source public.leads%rowtype; v_currency text;
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

  if nullif(v_args->>'source_lead_id','') is not null then
    select * into v_source from public.leads where organization_id=v_org and id=public.fn_uuid_o_nulo(v_args->>'source_lead_id') and deleted_at is null
     and (v_can_reassign or asesor_id=v_profile);
    if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré la ficha original en tu cartera. No cambié ningún cliente.')); end if;
    v_phone:=v_source.phone;
    v_name:=coalesce(v_name,v_source.name);
  end if;
  v_currency:=nullif(v_args->>'budget_currency','');
  if public.unaccent(lower(v_text)) ~ '\ypesos\y' then v_currency:='pesos'; end if;
  if public.unaccent(lower(v_text)) ~ '\y(dolares|usd)\y' then v_currency:='USD'; end if;
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
  if v_next is null and v_text<>'' then
    v_m:=regexp_match(v_text,'pr[oó]xima\s+(?:acci[oó]n|secci[oó]n)\s*(?:es|ser[ií]a|:)?\s*(.+?)(?:\s+y\s+la\s+otra|$)','i');
    if v_m is not null then v_next:=btrim(v_m[1]); end if;
  end if;
  if v_next is null and v_text <> '' then
    v_next := nullif(trim(coalesce(
      (regexp_match(v_text, 'pr[oó]xima\s+acci[oó]n\s*(?:es|ser[ií]a|:)?\s*([a-záéíóúñ][a-záéíóúñ]+(?:\s+(?:le|lo|la|les))?)', 'i'))[1],
      (regexp_match(v_text, '\y(ll[aá]mar\w*|ll[aá]mal\w*|contactar(?:lo|la|le|los|las)?|enviar\w*|envial\w*|mandar\w*|mandal\w*|visitar\w*|agendar\w*|escribir\w*|cotizar\w*|presentar\w*|reunir\w*|seguir\w*|mostrar\w*)\y', 'i'))[1]
    )),'');
  end if;

  select token, payload into v_etoken, v_epayload
  from public.bot_pending_actions
  where organization_id=v_org and telegram_chat_id=p_telegram_chat_id and action_type='create_lead' and consumed_at is null
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
    if position(v_notas in v_epayload->>'notas')>0 then v_notas:=v_epayload->>'notas';
    elsif position(v_epayload->>'notas' in v_notas)=0 then v_notas:=(v_epayload->>'notas')||E'\n'||v_notas; end if;
  end if;
  v_p := coalesce(v_epayload,'{}'::jsonb)
    || (case when v_args ? 'source_lead_id' then jsonb_build_object('source_lead_id',v_args->'source_lead_id') else '{}'::jsonb end)
    || (case when v_currency is not null then jsonb_build_object('budget_currency',v_currency) else '{}'::jsonb end)
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
  if v_business is null and nullif(v_epayload->>'_business_line','') is not null then
   select x into v_business from public.organizations o,jsonb_array_elements(o.meta_config#>'{crm,businessLines}') x
    where o.id=v_org and x->>'id'=v_epayload->>'_business_line';
  end if;
  if coalesce((v_business->>'ambiguous')::boolean,false) then
    v_business_pending:=true; v_p:=v_p-'stage';
  elsif v_business is not null then
    v_resolved_stage:=public.fn_org_stage(v_org,nullif(coalesce(v_stage,v_epayload->>'stage'),''));
    if nullif(v_stage,'') is not null and not(v_business->'stages' ? v_resolved_stage) then
      v_resolved_stage:=public.fn_crm_stage_for_contact(v_org,v_business->>'entryStage',v_stage);
      if v_resolved_stage is not null then v_p:=v_p||jsonb_build_object('stage',v_resolved_stage); end if;
    end if;
    if nullif(coalesce(v_stage,v_epayload->>'stage'),'') is null
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

  -- An explicit same-person request remains a copy even if the classifier
  -- calls it upsert_lead and provides only the known phone plus target business.
  if nullif(v_p->>'source_lead_id','') is null and nullif(v_p->>'phone','') is not null
    and public.unaccent(lower(coalesce(v_p->>'_dictation_source','')||' '||v_text)) ~ '(misma|mismo contacto|misma persona|otra ficha|conservar|ambos negocios|dos crm)' then
   select * into v_source from public.leads c where c.organization_id=v_org and c.deleted_at is null and c.business_entry_of is null
    and c.phone_normalized=regexp_replace(v_p->>'phone','\D','','g') and (v_can_reassign or c.asesor_id=v_profile);
   if found and public.fn_crm_business_for_stage(v_org,v_source.stage)->>'id' is distinct from v_p->>'_business_line'
       and nullif(v_p->>'_business_line','') is not null then
    v_p:=v_p||jsonb_build_object('source_lead_id',v_source.id);
   end if;
  end if;
  if v_business_pending then v_state:='ask_business';
  elsif v_fname is null then v_state := 'ask_name';
  else v_state := 'ready'; end if;

  v_p := v_p || jsonb_build_object('_ready', (v_state='ready'));
  -- Keep the actual dictation independently from the model's short summary.
  v_p:=v_p||jsonb_build_object('_dictation_source',concat_ws(E'\n\n',nullif(v_epayload->>'_dictation_source',''),
    case when position(coalesce(nullif(v_args->>'_dictation_source',''),v_text) in coalesce(v_epayload->>'_dictation_source',''))=0
     then coalesce(nullif(v_args->>'_dictation_source',''),nullif(v_text,'')) end));
  if nullif(v_p->>'budget_numeric','') is not null and nullif(v_p->>'budget_currency','') is not null then
   v_p:=v_p||jsonb_build_object('budget_text',to_char((v_p->>'budget_numeric')::numeric,'FM999,999,999,999')||' '||(v_p->>'budget_currency'));
  end if;
  v_token := public._bsc_upsert_pending(p_telegram_chat_id, v_profile, v_org, v_etoken, v_p);
  -- A new contact conversation supersedes an older, unconfirmed task draft.
  -- Preserve its payload; a later 'sí' can only confirm the current operation.
  update public.bot_pending_confirm set action='team_plan_superseded',
    payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('_superseded_at',now(),'_superseded_by','contact_registration')
   where organization_id=v_org and telegram_chat_id=p_telegram_chat_id and action='team_plan';


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

  v_money := case when nullif(v_p->>'budget_text','') is not null then v_p->>'budget_text' when (v_p->>'budget_numeric') is not null then to_char((v_p->>'budget_numeric')::numeric,'FM999,999,999,999')||' (moneda por confirmar)'
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
  v_lines := v_lines || ('Notas: '||case when nullif(v_p->>'notas','') is not null then 'Conservaré todos los detalles en el expediente al confirmar.' else '—' end);
  if nullif(v_p->>'new_asesor_name','') is not null then
    v_lines := v_lines || ('Asesor: '||(v_p->>'new_asesor_name'));
  end if;
  if nullif(v_p->>'source_lead_id','') is not null then
    v_lines:=array_append(v_lines,'Ficha vinculada: conservaré la ficha original en su negocio; esta alta tendrá seguimiento propio.');
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