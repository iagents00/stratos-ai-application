-- Preserve old task drafts without letting them capture confirmations of a new contact operation.
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


create or replace function public.bot_crm_update_client(p_chat bigint,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; l public.leads%rowtype; v_count int; v_ref text;
 v_name text; v_stage text; v_at timestamptz; v_note text; v_res jsonb; v_pending record; v_payload jsonb;
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Inicia sesión para actualizar tus contactos.')); end if;
 v_ref:=nullif(btrim(coalesce(p_args->>'lead_id',p_args->>'client_name',p_args->>'reference',p_args->>'phone','')),'');
 if v_ref is null then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿De qué contacto actualizo los datos? Dime su nombre.')); end if;
 select count(*) into v_count from public.leads c where c.organization_id=p.organization_id and c.deleted_at is null
  and (p.role in ('admin','super_admin','ceo','director') or c.asesor_id=p.id)
  and (c.id=public.fn_uuid_o_nulo(v_ref) or (length(regexp_replace(v_ref,'\D','','g'))>=7 and c.phone_normalized=regexp_replace(v_ref,'\D','','g')) or public.fn_norm_nombre(c.name)=public.fn_norm_nombre(v_ref));
 if v_count=0 then
  select count(*) into v_count from public.leads c where c.organization_id=p.organization_id and c.deleted_at is null
   and (p.role in ('admin','super_admin','ceo','director') or c.asesor_id=p.id)
   and public.fn_norm_nombre(c.name) like '%'||public.fn_norm_nombre(v_ref)||'%';
 end if;
 if v_count>1 then return jsonb_build_object('ok',false,'needs_input','client','reply',jsonb_build_object('text','Hay varios contactos con ese nombre. Dime el nombre completo o selecciona su ficha; todavía no cambié ninguno.')); end if;
 if v_count=0 then
  select * into v_pending from public.bot_pending_actions where organization_id=p.organization_id and telegram_chat_id=p_chat
    and action_type='create_lead' and consumed_at is null and expires_at>now()
    and public.fn_norm_nombre(payload->>'name') like '%'||public.fn_norm_nombre(v_ref)||'%'
    order by created_at desc limit 1;
  if found then
   v_payload:=v_pending.payload||p_args||jsonb_build_object('_merge_pending',true);
   if nullif(p_args->>'stage','') is not null then
    v_stage:=public.fn_crm_stage_for_contact(p.organization_id,v_pending.payload->>'stage',p_args->>'stage');
    if v_stage is null then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Dime el nombre completo de la etapa de ese negocio. Todavía no registré el contacto.')); end if;
    v_payload:=v_payload||jsonb_build_object('stage',v_stage);
   end if;
   v_name:=coalesce(nullif(p_args->>'name',''),v_pending.payload->>'name');
   if nullif(p_args->>'second_surname','') is not null then v_name:=regexp_replace(v_name,'\S+\s*$','')||btrim(p_args->>'second_surname'); end if;
   v_payload:=v_payload||jsonb_build_object('name',v_name);
   return public.bot_stage_create_lead(p_chat,v_payload);
  end if;
  return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré ese contacto en tu empresa. No cambié ni creé otro registro.'));
 end if;
 select * into l from public.leads c where c.organization_id=p.organization_id and c.deleted_at is null
  and (p.role in ('admin','super_admin','ceo','director') or c.asesor_id=p.id)
  and (c.id=public.fn_uuid_o_nulo(v_ref) or (length(regexp_replace(v_ref,'\D','','g'))>=7 and c.phone_normalized=regexp_replace(v_ref,'\D','','g')) or public.fn_norm_nombre(c.name)=public.fn_norm_nombre(v_ref)
    or public.fn_norm_nombre(c.name) like '%'||public.fn_norm_nombre(v_ref)||'%')
  order by (c.id=public.fn_uuid_o_nulo(v_ref)) desc nulls last,(public.fn_norm_nombre(c.name)=public.fn_norm_nombre(v_ref)) desc limit 1 for update;
 v_name:=coalesce(nullif(btrim(p_args->>'name'),''),l.name);
 if nullif(btrim(p_args->>'second_surname'),'') is not null then v_name:=regexp_replace(l.name,'\S+\s*$','')||btrim(p_args->>'second_surname'); end if;
 v_stage:=l.stage;
 if nullif(btrim(p_args->>'stage'),'') is not null then
  v_stage:=public.fn_crm_stage_for_contact(p.organization_id,l.stage,p_args->>'stage');
  if v_stage is null then return jsonb_build_object('ok',false,'needs_input','stage','reply',jsonb_build_object('text','No pude identificar una sola etapa de tu negocio. Dime su nombre completo; todavía no guardé el cambio.')); end if;
 end if;
 if nullif(p_args->>'next_action_at','') is not null then
  v_at:=public.parse_relative_or_abs_es(p_args->>'next_action_at',public.fn_user_tz(p.organization_id,p_chat));
  if v_at is null or v_at<=now() then return jsonb_build_object('ok',false,'needs_input','date','reply',jsonb_build_object('text','Dime una fecha y hora futuras para esa actividad. Todavía no la programé.')); end if;
 end if;
 if v_stage is distinct from l.stage and public.fn_is_org_appointment_stage(p.organization_id,v_stage) and v_at is null then
  return jsonb_build_object('ok',false,'needs_input','date','reply',jsonb_build_object('text','¿Qué día y a qué hora es la reunión? Necesito ambos para programarla.'));
 end if;
 if p_args ? 'phone' and length(regexp_replace(coalesce(p_args->>'phone',''),'\D','','g')) not between 7 and 15 then
  return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Ese teléfono está incompleto. No cambié los datos del contacto.'));
 end if;
 if not (p_args ?| array['name','second_surname','phone','email','stage','nota','notas','next_action','next_action_at','budget_numeric','project']) then
  return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿Qué dato quieres cambiar de '||l.name||'?'));
 end if;
 update public.leads set name=v_name,stage=v_stage,
  phone=case when p_args ? 'phone' then regexp_replace(p_args->>'phone','\D','','g') else phone end,
  email=coalesce(nullif(p_args->>'email',''),email),project=coalesce(nullif(p_args->>'project',''),project),
  presupuesto=coalesce(nullif(p_args->>'budget_numeric','')::bigint,presupuesto),
  next_action=coalesce(nullif(p_args->>'next_action',''),next_action),next_action_at=coalesce(v_at,next_action_at),
  next_action_date=case when v_at is not null then to_char(v_at at time zone public.fn_user_tz(p.organization_id,p_chat),'YYYY-MM-DD HH24:MI') else next_action_date end,
  last_activity='Datos actualizados desde el asistente',updated_at=now()
 where id=l.id and organization_id=p.organization_id;
 update public.bot_pending_confirm set action='team_plan_superseded',
   payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('_superseded_at',now(),'_superseded_by','contact_update')
  where organization_id=p.organization_id and telegram_chat_id=p_chat and action='team_plan';
 v_note:=nullif(btrim(coalesce(p_args->>'nota',p_args->>'notas','')),'');
 if v_note is not null and not exists(select 1 from public.expediente_items e where e.organization_id=p.organization_id and e.lead_id=l.id
  and e.descripcion=v_note and e.created_at>now()-interval '5 minutes' and e.deleted_at is null) then
  v_res:=public.bot_add_expediente_note(p_chat,l.id::text,coalesce(nullif(p_args->>'titulo',''),'Actualización del contacto'),v_note,'copilot');
  if v_res ? 'error' then raise exception 'No se pudo guardar la nota: %',v_res->>'error'; end if;
 end if;
 return jsonb_build_object('ok',true,'lead_id',l.id,'reply',jsonb_build_object('text','Listo. Actualicé a '||v_name||
  case when p_args ? 'stage' then ' en «'||v_stage||'»' else '' end||'.'||case when v_note is not null then ' Guardé los detalles en su expediente.' else '' end||
  case when v_at is not null then ' Próxima actividad: '||public.fn_fecha_humana(v_at,public.fn_user_tz(p.organization_id,p_chat),true)||'.' else '' end));
end $fn$;
