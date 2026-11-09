-- Server-side creation receipts, pending-field continuity and explicit currency.

CREATE OR REPLACE FUNCTION public.bot_upsert_lead(p_telegram_chat_id bigint, p_phone text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_stage text DEFAULT NULL::text, p_budget_text text DEFAULT NULL::text, p_budget_numeric bigint DEFAULT NULL::bigint, p_project text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_score integer DEFAULT NULL::integer, p_hot boolean DEFAULT NULL::boolean, p_next_action text DEFAULT NULL::text, p_next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_asesor_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_asesor record;
  v_phone_norm text;
  v_lead record;
  v_was_created boolean := false;
  v_new_id uuid;
  v_target_asesor_id uuid;
  v_target_asesor_name text;
  v_can_reassign boolean := false;
begin
  select id, name, role, organization_id
    into v_asesor
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and active = true;

  if not found then
    return jsonb_build_object('error', 'asesor_not_paired');
  end if;

  if nullif(btrim(p_stage),'') is not null then
    p_stage := public.fn_org_stage(v_asesor.organization_id,p_stage);
    if p_stage is null then return jsonb_build_object('success',false,'error','invalid_stage','stages',public.fn_org_stages_list(v_asesor.organization_id)); end if;
  end if;
  v_can_reassign := v_asesor.role in ('super_admin','admin','ceo','director');

  -- Normaliza la campaña a la forma canónica del tenant (alias en meta_config). White-label.
  p_campaign := public.fn_resolve_campaign(v_asesor.organization_id, p_campaign);

  v_phone_norm := nullif(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  if v_phone_norm is null then
    if nullif(btrim(p_name),'') is null then return jsonb_build_object('error','name_required'); end if;
    perform pg_advisory_xact_lock(hashtextextended(v_asesor.organization_id::text||':'||public.fn_norm_nombre(p_name),0));
    if (select count(*) from public.leads where organization_id=v_asesor.organization_id and deleted_at is null
      and public.fn_norm_nombre(name)=public.fn_norm_nombre(p_name))>1 then
      return jsonb_build_object('error','ambiguous_name','message','Hay varios contactos con ese nombre. No creé otro ni cambié ninguno.');
    end if;
  end if;

  -- asesor destino opcional para admin
  if p_new_asesor_name is not null and trim(p_new_asesor_name) <> '' then
    if not v_can_reassign then
      return jsonb_build_object('error','reassign_forbidden');
    end if;

    select p2.id, p2.name
      into v_target_asesor_id, v_target_asesor_name
    from public.profiles p2
    where p2.organization_id = v_asesor.organization_id
      and p2.active = true
      and (
        lower(trim(p2.name)) = lower(trim(p_new_asesor_name))
        or p2.name ilike '%' || trim(p_new_asesor_name) || '%'
      )
    order by case when lower(trim(p2.name)) = lower(trim(p_new_asesor_name)) then 0 else 1 end,
             length(p2.name)
    limit 1;

    if v_target_asesor_id is null then
      return jsonb_build_object('error','new_asesor_not_found');
    end if;
  end if;

  select id, asesor_id, asesor_name, name, stage
    into v_lead
  from public.leads
  where organization_id = v_asesor.organization_id
    and ((v_phone_norm is not null and phone_normalized=v_phone_norm) or (v_phone_norm is null and public.fn_norm_nombre(name)=public.fn_norm_nombre(p_name)))
    and deleted_at is null
  for update
  limit 1;

  if found then

    -- Creation must never silently rename or move the person owning this phone.
    if (nullif(p_name,'') is not null and public.fn_norm_nombre(p_name)<>public.fn_norm_nombre(v_lead.name))
      or (public.fn_crm_business_for_stage(v_asesor.organization_id,p_stage)->>'id' is distinct from public.fn_crm_business_for_stage(v_asesor.organization_id,v_lead.stage)->>'id'
          and public.fn_crm_business_for_stage(v_asesor.organization_id,v_lead.stage) is not null) then
      return jsonb_build_object('error','existing_contact_requires_explicit_update','message','Ese teléfono ya pertenece a '||v_lead.name||'. No cambié su nombre ni su negocio. Para otra ficha usa el alta vinculada; para corregirla, indica su ficha.');
    end if;
    if v_lead.asesor_id is not null and v_lead.asesor_id <> v_asesor.id
       and not v_can_reassign then
      return jsonb_build_object('error', 'lead_assigned_to_other_asesor', 'lead_id', v_lead.id, 'lead_name', v_lead.name);
    end if;

    update public.leads set
      name = coalesce(nullif(p_name, ''), name),
      email = coalesce(nullif(p_email, ''), email),
      stage = coalesce(nullif(p_stage, ''), stage),
      budget = coalesce(nullif(p_budget_text, ''), budget),
      presupuesto = coalesce(p_budget_numeric, presupuesto),
      project = coalesce(nullif(p_project, ''), project),
      campaign = coalesce(nullif(p_campaign, ''), campaign),
      bio = coalesce(nullif(p_bio, ''), bio),
      score = coalesce(p_score, score),
      hot = coalesce(p_hot, hot),
      next_action = coalesce(nullif(p_next_action, ''), next_action),
      next_action_at = coalesce(p_next_action_at, next_action_at),
      asesor_id = coalesce(v_target_asesor_id, asesor_id),
      asesor_name = coalesce(v_target_asesor_name, asesor_name),
      last_activity = 'Telegram · ' || coalesce(nullif(p_next_action, ''), nullif(p_stage, ''), 'actualización'),
      updated_at = now()
    where id = v_lead.id and organization_id=v_asesor.organization_id;

    v_new_id := v_lead.id;
  else
    begin
      insert into public.leads (
        organization_id, asesor_id, asesor_name, name, phone, email,
        stage, budget, presupuesto, project, campaign, bio, score, hot,
        next_action, next_action_at, last_activity, source
      ) values (
        v_asesor.organization_id,
        coalesce(v_target_asesor_id, v_asesor.id),
        coalesce(v_target_asesor_name, v_asesor.name),
        coalesce(nullif(p_name, ''), 'Sin nombre'),
        p_phone,
        nullif(p_email, ''),
        coalesce(nullif(p_stage, ''), public.fn_org_stage(v_asesor.organization_id,'primera etapa')),
        nullif(p_budget_text, ''),
        p_budget_numeric,
        nullif(p_project, ''),
        nullif(p_campaign, ''),
        nullif(p_bio, ''),
        coalesce(p_score, 50),
        coalesce(p_hot, false),
        nullif(p_next_action, ''),
        p_next_action_at,
        'Creado vía Telegram',
        'telegram'
      ) returning id into v_new_id;

      v_was_created := true;
    exception when unique_violation then
      select id, asesor_id, name, stage
        into v_lead
      from public.leads
      where organization_id = v_asesor.organization_id
        and ((v_phone_norm is not null and phone_normalized=v_phone_norm) or (v_phone_norm is null and public.fn_norm_nombre(name)=public.fn_norm_nombre(p_name)))
        and deleted_at is null
      for update
      limit 1;

      if not found then
        return jsonb_build_object('error', 'unexpected_state');
      end if;


    -- Creation must never silently rename or move the person owning this phone.
    if (nullif(p_name,'') is not null and public.fn_norm_nombre(p_name)<>public.fn_norm_nombre(v_lead.name))
      or (public.fn_crm_business_for_stage(v_asesor.organization_id,p_stage)->>'id' is distinct from public.fn_crm_business_for_stage(v_asesor.organization_id,v_lead.stage)->>'id'
          and public.fn_crm_business_for_stage(v_asesor.organization_id,v_lead.stage) is not null) then
      return jsonb_build_object('error','existing_contact_requires_explicit_update','message','Ese teléfono ya pertenece a '||v_lead.name||'. No cambié su nombre ni su negocio. Para otra ficha usa el alta vinculada; para corregirla, indica su ficha.');
    end if;

      if v_lead.asesor_id is not null and v_lead.asesor_id <> v_asesor.id
         and not v_can_reassign then
        return jsonb_build_object('error', 'lead_assigned_to_other_asesor', 'lead_id', v_lead.id);
      end if;

      update public.leads set
        name = coalesce(nullif(p_name, ''), name),
        email = coalesce(nullif(p_email, ''), email),
        stage = coalesce(nullif(p_stage, ''), stage),
        budget = coalesce(nullif(p_budget_text, ''), budget),
        presupuesto = coalesce(p_budget_numeric, presupuesto),
        project = coalesce(nullif(p_project, ''), project),
        campaign = coalesce(nullif(p_campaign, ''), campaign),
        bio = coalesce(nullif(p_bio, ''), bio),
        score = coalesce(p_score, score),
        hot = coalesce(p_hot, hot),
        next_action = coalesce(nullif(p_next_action, ''), next_action),
        next_action_at = coalesce(p_next_action_at, next_action_at),
        asesor_id = coalesce(v_target_asesor_id, asesor_id),
        asesor_name = coalesce(v_target_asesor_name, asesor_name),
        last_activity = 'Telegram · ' || coalesce(nullif(p_next_action, ''), nullif(p_stage, ''), 'actualización'),
        updated_at = now()
      where id = v_lead.id and organization_id=v_asesor.organization_id;

      v_new_id := v_lead.id;
    end;
  end if;

  -- NUEVO cliente -> prioridad 1 automática en la lista del asesor dueño (crm_prefs.order/pinned).
  -- Best-effort: si algo falla, nunca rompe la creación del lead.
  if v_was_created then
    begin
      declare
        v_owner  uuid := coalesce(v_target_asesor_id, v_asesor.id);
        v_prefs  jsonb;
        v_pinned text[];
        v_order  text[];
      begin
        select coalesce(crm_prefs,'{}'::jsonb) into v_prefs from public.profiles where id = v_owner;
        v_pinned := array(select jsonb_array_elements_text(coalesce(v_prefs->'pinned','[]'::jsonb)));
        v_order  := array(select jsonb_array_elements_text(coalesce(v_prefs->'order','[]'::jsonb)));
        if not (v_new_id::text = any(v_pinned)) then v_pinned := v_pinned || v_new_id::text; end if;
        v_order := array_remove(v_order, v_new_id::text);
        v_order := array[v_new_id::text] || v_order;  -- posición 1
        update public.profiles
           set crm_prefs = coalesce(crm_prefs,'{}'::jsonb)
                           || jsonb_build_object('pinned', to_jsonb(v_pinned), 'order', to_jsonb(v_order))
         where id = v_owner;
      end;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_new_id,
    'created', v_was_created,
    'assigned_to', coalesce(v_target_asesor_name, v_asesor.name)
  );
end;
$function$;

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
    v_notas:=(v_epayload->>'notas')||E'\n'||v_notas;
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
  v_lines := v_lines || ('Notas: '||coalesce(nullif(v_p->>'notas',''),'—'));
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

CREATE OR REPLACE FUNCTION public.bot_crm_update_client(p_chat bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.profiles%rowtype; l public.leads%rowtype; v_count int; v_ref text;
 v_name text; v_stage text; v_at timestamptz; v_note text; v_res jsonb; v_pending record; v_payload jsonb;
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Inicia sesión para actualizar tus contactos.')); end if;
 v_ref:=nullif(btrim(coalesce(p_args->>'lead_id',p_args->>'client_name',p_args->>'reference',p_args->>'phone','')),'');
 -- An unconfirmed registration owns subsequent details, even if its phone/name
 -- also identifies an existing person in another business.
 select * into v_pending from public.bot_pending_actions where organization_id=p.organization_id and telegram_chat_id=p_chat
  and action_type='create_lead' and consumed_at is null and expires_at>now()
  and (v_ref is null or public.fn_norm_nombre(payload->>'name') like '%'||public.fn_norm_nombre(v_ref)||'%'
    or payload->>'source_lead_id'=v_ref or payload->>'phone'=v_ref) order by created_at desc limit 1;
 if found then
  return public.bot_stage_create_lead(p_chat,(v_pending.payload-'_dictation_source')||p_args||jsonb_build_object('_merge_pending',true,'name',coalesce(nullif(p_args->>'name',''),v_pending.payload->>'name')));
 end if;
 if v_ref is null then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿De qué contacto actualizo los datos? Dime su nombre.')); end if;
 select count(*) into v_count from public.leads c where c.organization_id=p.organization_id and c.deleted_at is null
  and (p.role in ('admin','super_admin','ceo','director') or c.asesor_id=p.id)
  and (c.id=public.fn_uuid_o_nulo(v_ref) or (length(regexp_replace(v_ref,'\D','','g'))>=7 and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(v_ref,'\D','','g')) or public.fn_norm_nombre(c.name)=public.fn_norm_nombre(v_ref));
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
  and (c.id=public.fn_uuid_o_nulo(v_ref) or (length(regexp_replace(v_ref,'\D','','g'))>=7 and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(v_ref,'\D','','g')) or public.fn_norm_nombre(c.name)=public.fn_norm_nombre(v_ref)
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
  budget=coalesce(nullif(p_args->>'budget_text',''),budget),budget_currency=coalesce(nullif(p_args->>'budget_currency',''),budget_currency),
  next_action=coalesce(nullif(p_args->>'next_action',''),next_action),next_action_at=coalesce(v_at,next_action_at),
  next_action_date=case when v_at is not null then to_char(v_at at time zone public.fn_user_tz(p.organization_id,p_chat),'YYYY-MM-DD HH24:MI') else next_action_date end,
  last_activity='Datos actualizados desde el asistente',updated_at=now()
 where id=l.id and organization_id=p.organization_id;
 update public.bot_pending_confirm set action='team_plan_superseded',
   payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('_superseded_at',now(),'_superseded_by','contact_update')
  where organization_id=p.organization_id and telegram_chat_id=p_chat and action='team_plan';
 v_note:=nullif(btrim(coalesce(p_args->>'nota',p_args->>'notas','')),'');
 if v_note is not null and nullif(p_args->>'_dictation_source','') is not null
    and position(p_args->>'_dictation_source' in v_note)=0 then
   v_note:=v_note||E'\n\nDictado original:\n'||(p_args->>'_dictation_source');
 end if;
 if v_note is not null and not exists(select 1 from public.expediente_items e where e.organization_id=p.organization_id and e.lead_id=l.id
  and e.descripcion=v_note and e.created_at>now()-interval '5 minutes' and e.deleted_at is null) then
  v_res:=public.bot_add_expediente_note(p_chat,l.id::text,coalesce(nullif(p_args->>'titulo',''),'Actualización del contacto'),v_note,'copilot');
  if v_res ? 'error' then raise exception 'No se pudo guardar la nota: %',v_res->>'error'; end if;
 end if;
 return jsonb_build_object('ok',true,'lead_id',l.id,'reply',jsonb_build_object('text','Listo. Actualicé a '||v_name||
  case when p_args ? 'stage' then ' en «'||v_stage||'»' else '' end||'.'||case when v_note is not null then ' Guardé los detalles en su expediente.' else '' end||
  case when v_at is not null then ' Próxima actividad: '||public.fn_fecha_humana(v_at,public.fn_user_tz(p.organization_id,p_chat),true)||'.' else '' end));
end $function$;

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
   where token = p_token and telegram_chat_id = p_telegram_chat_id and consumed_at is null limit 1 for update;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'code','pending_not_found','reply', jsonb_build_object('text','Esta confirmación venció o ya se procesó.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  if v_row.expires_at < now() then
    update public.bot_pending_actions set consumed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'code','pending_expired','reply', jsonb_build_object('text','Esta confirmación venció. Vuelve a pedirlo.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  if v_row.action_type='create_lead' and v_row.payload->>'_needs_business'='true' then
    return jsonb_build_object('ok',false,'needs_input','business','reply',jsonb_build_object('text','Todavía no registré el contacto. Primero dime a qué negocio pertenece.','inline_keyboard','[]'::jsonb));
  end if;
  if v_row.action_type='create_lead' and coalesce((v_row.payload->>'_ready')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Todavía no registré el contacto. Dime su nombre y el negocio al que pertenece.'));
  end if;
  -- Preserve single-use behavior of existing callbacks; a failed creation remains retryable.
  if v_row.action_type<>'create_lead' then update public.bot_pending_actions set consumed_at=now() where id=v_row.id; end if;

  if left(v_row.action_type, 3) = 'gv_' then
    v_inner := public.bot_nlu_dispatch_gvintell_v2(
      p_telegram_chat_id,
      substring(v_row.action_type from 4),
      (v_row.payload - 'client_name' - 'name' - 'nombre')
        || jsonb_build_object('client_name', v_row.payload->>'phone'));
    if coalesce((v_inner->>'ok')::boolean,true) then update public.bot_pending_actions set consumed_at=now() where id=v_row.id; end if;
    return v_inner;
  end if;

  if v_row.action_type in ('reco','ficha') then
    v_phone := v_row.payload->>'phone';
    if v_row.action_type = 'reco' then
      return public.bot_recomendar_propiedades(p_telegram_chat_id, coalesce(v_phone,''), coalesce(v_row.payload->>'context',''));
    else
      return public.bot_ficha_cliente(p_telegram_chat_id, coalesce(v_phone,''));
    end if;
  end if;

  -- Reasignación tras elegir un homónimo: re-ejecuta con el teléfono elegido (resolución única).
  if v_row.action_type = 'reassign' then
    return public.bot_reassign_lead(p_telegram_chat_id, coalesce(v_row.payload->>'phone',''), coalesce(v_row.payload->>'target',''));
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
      v_inner := public.bot_crm_register_contact(p_telegram_chat_id,v_row.payload);
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      v_notas := nullif(trim(coalesce(v_row.payload->>'notas','')),'');
      if nullif(v_row.payload->>'_dictation_source','') is not null
         and position(v_row.payload->>'_dictation_source' in coalesce(v_notas,''))=0 then
        v_notas:=concat_ws(E'\n\n',v_notas,'Dictado original:'||E'\n'||(v_row.payload->>'_dictation_source'));
      end if;
      if v_notas is not null then
        if coalesce((public.bot_add_expediente_note(p_telegram_chat_id,v_inner->>'lead_id','Alta de cliente',v_notas,'copilot')->>'success')::boolean,false) is not true then
         raise exception 'No se guardaron las notas del alta. El registro no se confirmó.';
        end if;
      end if;
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
      return jsonb_build_object('ok', false, 'code','unknown_action_type','reply', jsonb_build_object('text','No conozco esa acción: ' || v_row.action_type,'parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end case;

  if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
  update public.bot_pending_actions set consumed_at=now() where id=v_row.id;
  return jsonb_build_object('ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', case when v_row.action_type='create_lead' and v_inner->>'created'='false' then 'La ficha ya existe; no creé un duplicado.' else public.fn_fmt_hecho(v_row.summary) end, 'parse_mode', null,
      'inline_keyboard', case when v_phone is not null then jsonb_build_array(jsonb_build_array(public._bot_btn('Ver ficha', 'view', coalesce(v_inner->>'lead_id',regexp_replace(v_phone,'[^0-9]','','g'))), public._bot_btn('Menú', 'menu', '_'))) else public._bot_kb_back() end));
end; $function$;

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
  -- Typed contact operations cannot become tasks because of an older draft.
  if v_tool='duplicate_client' then return public.bot_stage_create_lead(p_telegram_chat_id,v_args); end if;
  if v_tool='contact_business_status' then return public.bot_crm_business_status(p_telegram_chat_id,v_args); end if;
  -- CONVERSATION_CONTEXT_20261106: shared operation contracts win before legacy heuristics.
  if v_tool in ('multi','multi_task','multi_action','multi_tarea','multiple_tasks')
    and jsonb_typeof(v_args->'actions')='array'
    and exists(select 1 from jsonb_array_elements(v_args->'actions') a where a->>'tool_name' in ('update_client','create_personal_reminder')) then
    return public.bot_crm_conversation_multi(p_telegram_chat_id,v_args->'actions');
  end if;
  if v_tool='update_client' then return public.bot_crm_update_client(p_telegram_chat_id,v_args); end if;
  if v_tool='add_expediente_note' and nullif(coalesce(v_args->>'client_name',v_args->>'lead_id',v_args->>'phone'),'') is not null
     and nullif(coalesce(v_args->>'nota',v_args->>'notas',v_args->>'contenido'),'') is not null then
    return public.bot_crm_update_client(p_telegram_chat_id,(v_args-'phone')||jsonb_build_object('reference',coalesce(v_args->>'client_name',v_args->>'lead_id',v_args->>'phone'),'nota',coalesce(v_args->>'nota',v_args->>'notas',v_args->>'contenido')));
  end if;
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
    'fichas_por_negocio_habilitadas',(select coalesce((meta_config#>>'{crm,allowBusinessContactCopies}')::boolean,false) from public.organizations where id=v_prof.organization_id),
    'registro_en_curso',(select jsonb_build_object('tipo',action_type,'datos',payload,'listo',payload->'_ready')
       from public.bot_pending_actions where organization_id=v_prof.organization_id and telegram_chat_id=p_chat
       and action_type='create_lead' and consumed_at is null and expires_at>now() order by created_at desc limit 1),
    'clientes_recientes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.name,'etapa',c.stage,'telefono',c.phone,'ficha_original',c.business_entry_of,'negocio',public.fn_crm_business_for_stage(v_prof.organization_id,c.stage)->>'label')),'[]'::jsonb)
      from(select id,name,stage,phone,business_entry_of from public.leads where organization_id=v_prof.organization_id and deleted_at is null
        and (v_prof.role in ('admin','super_admin','director','ceo') or asesor_id=v_prof.id)
        order by updated_at desc limit 8)c),
    'ultimos_mensajes', v_turnos,
    'avisos_automaticos_recientes', v_avisos,
    'tareas_recien_registradas', v_recientes,
    'plan_esperando_confirmacion', coalesce(v_pend, 'null'::jsonb));
end;
$function$;

CREATE OR REPLACE FUNCTION public.bot_ficha_cliente(p_chat bigint, p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_pid uuid; v_role text; v_view_all boolean;
  v_nc int; v_lead_id uuid; v_lead record; v_phone_cb text; v_kb jsonb; v_txt text;
  v_ref text := btrim(coalesce(p_ref,''));
begin
  select org,pid,role,view_all into v_org,v_pid,v_role,v_view_all from public._bot_requester(p_chat);
  if v_org is null then return public._bot_smart_reask('No estás conectado al CRM. Usa /conectar ########.'); end if;
  select count(*) into v_nc from public.fn_bot_name_candidates(p_chat, v_ref);
  if v_nc = 0 then
    return coalesce(public.bot_sugerir_clientes(p_chat, v_ref),
           public._bot_smart_reask('No encontré al cliente "'||v_ref||'" en tu cartera. ¿Lo escribiste completo? También puedes pasarme el teléfono.'));
  elsif v_nc > 1 then
    return public._bot_disambiguate(p_chat, 'ficha', '{}'::jsonb, v_ref);
  end if;
  select lead_id into v_lead_id from public.fn_bot_name_candidates(p_chat, v_ref) limit 1;
  select * into v_lead from public.leads where id=v_lead_id and organization_id=v_org;
  perform public._bot_remember_lead(p_chat, v_org, v_lead.id, v_lead.name, v_lead.phone_normalized);
  v_phone_cb := v_lead.id::text;
  v_kb := case when v_phone_cb is not null
    then jsonb_build_array(jsonb_build_array(public._bot_btn('Ver ficha','view',v_phone_cb), public._bot_btn('Menú','menu')))
    else jsonb_build_array(jsonb_build_array(public._bot_btn('Menú','menu'))) end;

  v_txt := '▸ ' || btrim(coalesce(v_lead.name,'(sin nombre)'))
    || chr(10) || '· Teléfono: «' || coalesce(nullif(public._bot_fmt_phone(v_lead.phone),''),'sin teléfono') || '»'
    || chr(10) || '· Etapa: «' || coalesce(nullif(v_lead.stage,''),'sin etapa') || '»'
                || coalesce(' · puntaje «' || nullif(v_lead.score,0)::text || '»','')
                || case when v_lead.hot then ' · cliente caliente' else '' end
    || coalesce(chr(10) || '· Presupuesto: «' || case when v_lead.budget_currency is not null then to_char(v_lead.presupuesto,'FM999,999,999,999')||' '||v_lead.budget_currency else nullif(public._bot_fmt_k(public.fn_presupuesto_k(v_lead.presupuesto)),'') end || '»','')
    || case when nullif(v_lead.email,'') is not null then chr(10) || '· Correo: ' || v_lead.email else '' end
    || case when nullif(v_lead.project,'') is not null then chr(10) || '· Proyecto: «' || v_lead.project || '»' else '' end
    || case when nullif(v_lead.next_action,'') is not null then
         chr(10) || '· Próxima acción: «' || v_lead.next_action || '»'
         || case when v_lead.next_action_at is not null then ' · «' || public._bot_fmt_when(v_lead.next_action_at) || '»' else '' end
       else '' end;

  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text', v_txt, 'parse_mode',null,'inline_keyboard', v_kb));
end;
$function$;