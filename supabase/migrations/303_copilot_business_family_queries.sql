create or replace function public.bot_crm_business_status(p_chat bigint,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; answer text; ref text:=coalesce(p_args->>'client_name',p_args->>'reference',p_args->>'lead_id','');
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Inicia sesión para consultar tus clientes.')); end if;
 with matched as (
  select coalesce(l.business_entry_of,l.id) root from public.leads l where organization_id=p.organization_id and deleted_at is null
   and (p.role in ('admin','super_admin','ceo','director') or asesor_id=p.id)
   and (l.id=public.fn_uuid_o_nulo(ref) or public.fn_norm_nombre(l.name) like '%'||public.fn_norm_nombre(ref)||'%')
 )
 select string_agg('· '||l.name||': '||l.stage||case when l.budget_currency is not null and l.presupuesto is not null then ' · '||to_char(l.presupuesto,'FM999,999,999,999')||' '||l.budget_currency else '' end,E'\n' order by l.created_at,l.id) into answer
 from public.leads l where organization_id=p.organization_id and deleted_at is null
 and (p.role in ('admin','super_admin','ceo','director') or asesor_id=p.id)
 and coalesce(l.business_entry_of,l.id) in(select root from matched);
 return jsonb_build_object('ok',answer is not null,'reply',jsonb_build_object('text',coalesce('Así está registrado en tu CRM:'||E'\n'||answer,'No encontré ese cliente en tu cartera. Dime su nombre completo.')));
end $fn$;
revoke all on function public.bot_crm_business_status(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.bot_crm_business_status(bigint,jsonb) to service_role;

-- Source-aware staging returns the existing family instead of suggesting an
-- unnecessary duplicate when the requested business entry already exists.
create or replace function public.bot_crm_stage_business_copy(p_chat bigint,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; source public.leads%rowtype; line jsonb; target_id uuid;
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Inicia sesión para registrar contactos.')); end if;
 select * into source from public.leads where organization_id=p.organization_id and id=public.fn_uuid_o_nulo(p_args->>'source_lead_id') and deleted_at is null
  and (p.role in ('admin','super_admin','ceo','director') or asesor_id=p.id);
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Dime qué ficha original debo conservar. Todavía no cambié ningún cliente.')); end if;
 line:=public.fn_org_business_match(p.organization_id,coalesce(p_args->>'business',p_args->>'stage',''));
 if line is null then line:=public.fn_crm_business_for_stage(p.organization_id,p_args->>'stage'); end if;
 if line is not null and not coalesce((line->>'ambiguous')::boolean,false) then
  select id into target_id from public.leads where organization_id=p.organization_id and deleted_at is null
   and coalesce(business_entry_of,id)=coalesce(source.business_entry_of,source.id)
   and public.fn_crm_business_for_stage(p.organization_id,stage)->>'id'=line->>'id';
  if target_id is not null then return public.bot_crm_business_status(p_chat,jsonb_build_object('lead_id',source.id)); end if;
 end if;
 return public.bot_stage_create_lead(p_chat,p_args);
end $fn$;
revoke all on function public.bot_crm_stage_business_copy(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.bot_crm_stage_business_copy(bigint,jsonb) to service_role;

do $patch$
declare source text;
begin
 select pg_get_functiondef('public.bot_nlu_dispatch_gvintell(bigint,text,jsonb)'::regprocedure) into source;
 if position($old$if v_tool='duplicate_client' then return public.bot_stage_create_lead(p_telegram_chat_id,v_args); end if;$old$ in source)=0 then raise exception 'Contact dispatcher changed; inspect before patching.'; end if;
 execute replace(source,$old$if v_tool='duplicate_client' then return public.bot_stage_create_lead(p_telegram_chat_id,v_args); end if;$old$,$new$if v_tool='duplicate_client' then return public.bot_crm_stage_business_copy(p_telegram_chat_id,v_args); end if;$new$);
end $patch$;
