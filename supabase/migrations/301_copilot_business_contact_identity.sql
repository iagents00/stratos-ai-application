-- A contact keeps one canonical phone identity. Explicit business entries share
-- that real phone through a validated parent; the existing unique phone index stays intact.
alter table public.leads add column if not exists business_entry_of uuid references public.leads(id);
alter table public.leads add column if not exists business_line_id text;
alter table public.leads add column if not exists budget_currency text;
create unique index if not exists leads_business_entry_unique on public.leads(organization_id,business_entry_of,business_line_id)
 where business_entry_of is not null and deleted_at is null;

create or replace function public.fn_crm_business_for_stage(p_org uuid,p_stage text) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $fn$
 select x from public.organizations o,jsonb_array_elements(coalesce(o.meta_config#>'{crm,businessLines}','[]')) x
 where o.id=p_org and x->'stages' ? p_stage limit 1;
$fn$;

create or replace function public.fn_lead_business_identity_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare parent public.leads%rowtype; line jsonb;
begin
 if new.business_entry_of is null then return new; end if;
 if coalesce(auth.role(),'')='authenticated' and
   (tg_op='INSERT' or new.business_entry_of is distinct from old.business_entry_of or new.business_line_id is distinct from old.business_line_id) then
  raise exception 'Crea la ficha vinculada desde el asistente con confirmación.' using errcode='42501';
 end if;
 if not exists(select 1 from public.organizations where id=new.organization_id and meta_config#>>'{crm,allowBusinessContactCopies}'='true') then
  raise exception 'Esta empresa no tiene habilitadas las fichas por negocio.';
 end if;
 select * into parent from public.leads where organization_id=new.organization_id and id=new.business_entry_of
  and business_entry_of is null and deleted_at is null for key share;
 if not found or parent.id=new.id then raise exception 'La ficha de origen no pertenece a esta empresa o ya no está activa.'; end if;
 line:=public.fn_crm_business_for_stage(new.organization_id,new.stage);
 if line is null or line->>'id' is distinct from new.business_line_id then raise exception 'La etapa no corresponde al negocio de esta ficha.'; end if;
 if nullif(regexp_replace(coalesce(new.phone,''),'\D','','g'),'') is distinct from nullif(regexp_replace(coalesce(parent.phone,''),'\D','','g'),'') then
  raise exception 'Ambas fichas comparten el teléfono de la ficha original. Corrígelo allí.';
 end if;
 -- Only the canonical contact owns the unique phone key. The business entry
 -- retains its real phone for display/calling; no invented number is stored.
 new.phone:=parent.phone;
 new.phone_normalized:=null;
 return new;
end $fn$;
create or replace trigger zzz_business_identity_guard before insert or update on public.leads
 for each row execute function public.fn_lead_business_identity_guard();

create or replace function public.fn_lead_business_phone_sync() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 if new.business_entry_of is null and new.phone is distinct from old.phone then
  update public.leads set phone=new.phone where organization_id=new.organization_id and business_entry_of=new.id;
 end if;
 return null;
end $fn$;
create or replace trigger zzz_business_phone_sync after update of phone on public.leads
 for each row execute function public.fn_lead_business_phone_sync();

create or replace function public.bot_crm_register_contact(p_chat bigint,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; source public.leads%rowtype; target public.leads%rowtype; line jsonb; result jsonb;
 sid uuid:=public.fn_uuid_o_nulo(p_args->>'source_lead_id'); root uuid; target_id uuid; created boolean:=false;
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('error','not_paired'); end if;
 if sid is not null then
  select * into source from public.leads where organization_id=p.organization_id and id=sid and deleted_at is null
   and (p.role in ('admin','super_admin','ceo','director') or asesor_id=p.id) for update;
  if not found then return jsonb_build_object('error','source_contact_not_found'); end if;
  root:=coalesce(source.business_entry_of,source.id);
  line:=public.fn_crm_business_for_stage(p.organization_id,p_args->>'stage');
  if line is null or line->>'id' is distinct from p_args->>'_business_line' then return jsonb_build_object('error','business_required'); end if;
  if line->>'id'=public.fn_crm_business_for_stage(p.organization_id,source.stage)->>'id' then
   return jsonb_build_object('error','same_business','message','La ficha ya pertenece a ese negocio. No creé otra ni cambié su nombre.');
  end if;
  if not exists(select 1 from public.organizations where id=p.organization_id and meta_config#>>'{crm,allowBusinessContactCopies}'='true') then
   return jsonb_build_object('error','business_copy_not_enabled','message','No cambié la ficha original. Esta empresa todavía no permite fichas vinculadas por negocio.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p.organization_id::text||':'||root::text||':'||(line->>'id'),0));
  select * into target from public.leads where organization_id=p.organization_id and deleted_at is null
   and ((business_entry_of=root and business_line_id=line->>'id') or (id=root and public.fn_crm_business_for_stage(p.organization_id,stage)->>'id'=line->>'id')) for update;
  if found then
   return jsonb_build_object('success',true,'created',false,'lead_id',target.id,'preserved_source_id',source.id);
  end if;
  if public.fn_is_org_appointment_stage(p.organization_id,p_args->>'stage') and nullif(p_args->>'next_action_at','') is null then
   return jsonb_build_object('error','appointment_time_required');
  end if;
  insert into public.leads(organization_id,asesor_id,asesor_name,name,phone,email,stage,business_entry_of,business_line_id,
   budget,presupuesto,budget_currency,project,next_action,next_action_at,source,last_activity)
  values(p.organization_id,source.asesor_id,source.asesor_name,coalesce(nullif(p_args->>'name',''),source.name),source.phone,source.email,
   p_args->>'stage',root,line->>'id',p_args->>'budget_text',nullif(p_args->>'budget_numeric','')::bigint,p_args->>'budget_currency',
   nullif(p_args->>'project',''),nullif(p_args->>'next_action',''),nullif(p_args->>'next_action_at','')::timestamptz,'copilot','Ficha vinculada por negocio') returning id into target_id;
  result:=jsonb_build_object('success',true,'created',true,'lead_id',target_id,'preserved_source_id',source.id);
 else
  result:=public.bot_upsert_lead(p_chat,p_args->>'phone',p_args->>'name',p_args->>'email',p_args->>'stage',p_args->>'budget_text',
   nullif(p_args->>'budget_numeric','')::bigint,p_args->>'project',p_args->>'campaign',null,null,null,p_args->>'next_action',
   nullif(p_args->>'next_action_at','')::timestamptz,p_args->>'new_asesor_name');
 end if;
 if result ? 'error' then return result; end if;
 update public.leads set budget_currency=coalesce(nullif(p_args->>'budget_currency',''),budget_currency)
 where organization_id=p.organization_id and id=(result->>'lead_id')::uuid;
 -- A success receipt is based on an actual visible row and its persisted business.
 if not exists(select 1 from public.leads where organization_id=p.organization_id and id=(result->>'lead_id')::uuid and deleted_at is null
   and name=p_args->>'name' and stage=p_args->>'stage') then raise exception 'No se confirmó el registro solicitado.'; end if;
 return result;
end $fn$;

create or replace function public.bot_crm_business_status(p_chat bigint,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype; answer text; ref text:=coalesce(p_args->>'client_name',p_args->>'reference',p_args->>'lead_id','');
begin
 select * into p from public.profiles where telegram_chat_id=p_chat and active;
 if not found then return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Inicia sesión para consultar tus clientes.')); end if;
 select string_agg('· '||l.name||': '||l.stage||case when l.budget_currency is not null and l.presupuesto is not null then ' · '||to_char(l.presupuesto,'FM999,999,999,999')||' '||l.budget_currency else '' end,E'\n' order by l.created_at,l.id) into answer
 from public.leads l where organization_id=p.organization_id and deleted_at is null
 and (p.role in ('admin','super_admin','ceo','director') or asesor_id=p.id)
 and (l.id=public.fn_uuid_o_nulo(ref) or public.fn_norm_nombre(l.name) like '%'||public.fn_norm_nombre(ref)||'%');
 return jsonb_build_object('ok',answer is not null,'reply',jsonb_build_object('text',coalesce('Así está registrado en tu CRM:'||E'\n'||answer,'No encontré ese cliente en tu cartera. Dime su nombre completo.')));
end $fn$;
revoke all on function public.fn_crm_business_for_stage(uuid,text),public.fn_lead_business_identity_guard(),public.fn_lead_business_phone_sync(),public.bot_crm_register_contact(bigint,jsonb),public.bot_crm_business_status(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.fn_crm_business_for_stage(uuid,text),public.bot_crm_register_contact(bigint,jsonb),public.bot_crm_business_status(bigint,jsonb) to service_role;

-- Only the requested customer's configured two-business CRM enables linked entries.
update public.organizations set meta_config=jsonb_set(coalesce(meta_config,'{}'),'{crm}',coalesce(meta_config->'crm','{}')||'{"allowBusinessContactCopies":true}'::jsonb)
where id='410570d9-2ce4-46eb-b77b-4a732861e238';
