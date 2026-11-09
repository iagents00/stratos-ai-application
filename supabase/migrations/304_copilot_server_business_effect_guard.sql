-- Preserve the original business when a copy request is misclassified as an update.
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
 -- The server validates the effect even when a model chooses update instead of copy.
 if nullif(p_args->>'stage','') is not null
   and public.fn_crm_business_for_stage(p.organization_id,l.stage) is not null
   and public.fn_crm_business_for_stage(p.organization_id,public.fn_crm_stage_for_contact(p.organization_id,l.stage,p_args->>'stage'))->>'id'
       is distinct from public.fn_crm_business_for_stage(p.organization_id,l.stage)->>'id' then
  if public.unaccent(lower(coalesce(p_args->>'input_text',p_args->>'_dictation_source',''))) ~ '(agregar|anadir|misma|mismo numero|dos crm|dos negocios|ambos|otra ficha|conserv)' then
   return public.bot_crm_stage_business_copy(p_chat,p_args||jsonb_build_object('source_lead_id',l.id,
    'name',coalesce(nullif(p_args->>'name',''),l.name),'business',public.fn_crm_business_for_stage(p.organization_id,public.fn_crm_stage_for_contact(p.organization_id,l.stage,p_args->>'stage'))->>'label'));
  end if;
  return jsonb_build_object('ok',false,'needs_input','business_operation','reply',jsonb_build_object('text','¿Quieres trasladar esta ficha al otro negocio o conservarla y agregar una segunda? Todavía no cambié su negocio.'));
 end if;
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