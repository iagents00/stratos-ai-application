-- A short answer to an open registration card is a confirmation, not a new lead.
create or replace function public.bot_crm_confirm_from_text(p_chat bigint,p_text text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; a public.bot_pending_actions%rowtype; v_text text;
begin
 v_text:=btrim(regexp_replace(public.unaccent(lower(coalesce(p_text,''))),'[[:punct:][:space:]]+',' ','g'));
 if v_text !~ '^(si|si registrar|si confirmar|confirmo|confirmar|adelante|de acuerdo|dale|ok|registralo|hazlo|correcto)$' then return null; end if;
 select * into p from public.profiles where telegram_chat_id=p_chat and active is true;
 if not found or not exists(select 1 from public.organizations where id=p.organization_id and coalesce(active,true)) then return null; end if;
 select * into a from public.bot_pending_actions where organization_id=p.organization_id
  and telegram_chat_id=p_chat and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
 if not found then
  -- Repeated acceptance of an already closed card must not stage it again.
  select * into a from public.bot_pending_actions where organization_id=p.organization_id
   and telegram_chat_id=p_chat and action_type='create_lead' and consumed_at>now()-interval '5 minutes'
   and expires_at>now() order by consumed_at desc limit 1;
  if not found then return null; end if;
  if exists(select 1 from public.bot_pending_confirm where organization_id=p.organization_id
   and telegram_chat_id=p_chat and created_at>a.created_at
   and action not in ('team_plan_superseded','cancelled','consumed')) then return null; end if;
  return jsonb_build_object('ok',true,'already_closed',true,'reply',jsonb_build_object('text',
   'Esa confirmación ya está cerrada. Puedes consultar la ficha o decirme qué dato quieres cambiar.','inline_keyboard','[]'::jsonb));
 end if;
 if a.action_type<>'create_lead' then return null; end if;
 if exists(select 1 from public.bot_pending_confirm where organization_id=p.organization_id
  and telegram_chat_id=p_chat and created_at>a.created_at
  and action not in ('team_plan_superseded','cancelled','consumed')) then return null; end if;
 return public._bot_execute_pending(p_chat,a.token);
end $fn$;
revoke all on function public.bot_crm_confirm_from_text(bigint,text) from public,anon,authenticated;
grant execute on function public.bot_crm_confirm_from_text(bigint,text) to service_role;

create or replace function public.copilot_confirm_registration(p_text text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and active is true;
 if not found or p.organization_id is null then raise exception 'Session required' using errcode='42501'; end if;
 return public.bot_crm_confirm_from_text(p.telegram_chat_id,p_text);
end $fn$;
revoke all on function public.copilot_confirm_registration(text) from public,anon;
grant execute on function public.copilot_confirm_registration(text) to authenticated;

-- The shared Telegram/Copilot dispatcher honors the same original-turn contract.
do $migration$
declare source text; marker constant text:='-- REGISTRATION_ACCEPTANCE_20261123'; at int;
begin
 source:=pg_get_functiondef('public.bot_nlu_dispatch_gvintell(bigint,text,jsonb)'::regprocedure);
 source:=replace(source,chr(13)||chr(10),chr(10));
 if position(marker in source)>0 then return; end if;
 at:=position(E'\nbegin\n' in source);
 if at=0 or source !~ 'v_res[[:space:]]+jsonb' then raise exception 'Review changed dispatcher before applying confirmation boundary'; end if;
 source:=overlay(source placing E'\nbegin\n  -- REGISTRATION_ACCEPTANCE_20261123\n  v_res:=public.bot_crm_confirm_from_text(p_telegram_chat_id,coalesce(p_args->>''_original_input_text'',p_args->>''input_text'',p_args->>''text'',''''));\n  if v_res is not null then return v_res; end if;\n' from at for length(E'\nbegin\n'));
 execute source;
end $migration$;
