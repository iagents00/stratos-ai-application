-- Browser identity must come from a verified Supabase JWT, never a supplied chat id.
create or replace function public.copilot_ingress_actor(p_chat_id bigint) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare p public.profiles%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and active is true;
 if not found or p.organization_id is null or p.telegram_chat_id is distinct from p_chat_id
    or not exists(select 1 from public.organizations o where o.id=p.organization_id and coalesce(o.active,true)) then
  raise exception 'La sesión no corresponde a este Copilot.' using errcode='42501';
 end if;
 return jsonb_build_object('authorized',true,'profile_id',p.id,'organization_id',p.organization_id,'chat_id',p.telegram_chat_id);
end $fn$;
revoke all on function public.copilot_ingress_actor(bigint) from public,anon;
grant execute on function public.copilot_ingress_actor(bigint) to authenticated;

-- Service writers also have to preserve tenant relationships. Existing historical
-- rows are retained; a cancelled old row can still be closed without re-delivery.
create or replace function public.fn_copilot_recipient_tenant_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 if tg_table_name='proactive_reminders' then
  if tg_op='UPDATE' and new.status in ('cancelled','failed')
   and new.organization_id is not distinct from old.organization_id
   and new.asesor_id is not distinct from old.asesor_id and new.lead_id is not distinct from old.lead_id then return new; end if;
  if new.organization_id is null or not exists(select 1 from public.profiles p where p.id=new.asesor_id and p.organization_id=new.organization_id) then
   raise exception 'El destinatario no pertenece a la organización del aviso.' using errcode='23514';
  end if;
  if new.lead_id is not null and not exists(select 1 from public.leads l where l.id=new.lead_id and l.organization_id=new.organization_id) then
   raise exception 'El contacto no pertenece a la organización del aviso.' using errcode='23514';
  end if;
 else
  if new.organization_id is null or not exists(select 1 from public.profiles p where p.telegram_chat_id=new.telegram_chat_id and p.organization_id=new.organization_id) then
   raise exception 'El chat no pertenece a la organización del mensaje.' using errcode='23514';
  end if;
 end if;
 return new;
end $fn$;
revoke all on function public.fn_copilot_recipient_tenant_guard() from public,anon,authenticated;
create trigger copilot_recipient_tenant_guard before insert or update of organization_id,asesor_id,lead_id,status
 on public.proactive_reminders for each row execute function public.fn_copilot_recipient_tenant_guard();
create trigger copilot_message_tenant_guard before insert or update of organization_id,telegram_chat_id
 on public.tg_bot_activity for each row execute function public.fn_copilot_recipient_tenant_guard();

-- The push RPC previously accepted another person's id without any session.
create or replace function public.push_subscribe(p_user_id uuid,p_endpoint text,p_p256dh text,p_auth text,p_platform text default 'other') returns boolean
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 if auth.uid() is null or auth.uid() is distinct from p_user_id
   or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active is true and p.organization_id is not null) then
  raise exception 'Solo puedes registrar tus propias notificaciones.' using errcode='42501';
 end if;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,platform)
 values(p_user_id,p_endpoint,p_p256dh,p_auth,p_platform)
 on conflict(user_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,platform=excluded.platform,updated_at=now();
 return true;
end $fn$;
-- Keep the existing unsubscribe implementation but restrict its actor before it runs.
create or replace function public.push_unsubscribe(p_user_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
 if auth.uid() is null or auth.uid() is distinct from p_user_id then
  raise exception 'Solo puedes retirar tus propias notificaciones.' using errcode='42501';
 end if;
 delete from public.push_subscriptions where user_id=auth.uid();
 return true;
end $fn$;
revoke all on function public.push_subscribe(uuid,text,text,text,text),public.push_unsubscribe(uuid) from public,anon;
grant execute on function public.push_subscribe(uuid,text,text,text,text),public.push_unsubscribe(uuid) to authenticated;

-- Histories with no attributable organization are not exposed to the browser.
CREATE OR REPLACE FUNCTION public.get_my_copilot_activity(p_limit integer DEFAULT 40)
 RETURNS TABLE(id bigint, occurred_at timestamp with time zone, role text, content text, media_path text, media_type text, meta jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_chat_id bigint;
begin
  select p.telegram_chat_id into v_chat_id from public.profiles p where p.id=auth.uid() and p.active is true limit 1;
  if v_chat_id is null then return; end if;
  return query
  with crudo as (
    select t.id,t.created_at,t.role,t.content,t.media_path,t.media_type,t.meta from public.tg_bot_activity t
    where t.telegram_chat_id=v_chat_id and t.organization_id=public.current_organization_id()
    order by t.id desc limit least(greatest(p_limit,1),200)+40
  ), marcado as (
    select c.*,(
      exists(select 1 from crudo o where o.id<>c.id and o.role=c.role
        and abs(extract(epoch from(o.created_at-c.created_at)))<=180
        and public._copilot_msg_same(o.content,c.content)
        and ((c.role='user' and o.id<c.id) or(c.role<>'user' and (
          length(coalesce(o.content,''))>length(coalesce(c.content,''))
          or(length(coalesce(o.content,''))=length(coalesce(c.content,'')) and o.id<c.id)))))
      or(c.role='user' and exists(select 1 from crudo a where a.role<>'user' and a.created_at=c.created_at and a.id>c.id and a.id<=c.id+3)
        and exists(select 1 from crudo u where u.role='user' and u.id<c.id and u.created_at>=c.created_at-interval '5 minutes' and u.created_at<c.created_at))
    ) as es_duplicado,
    coalesce((select min(o.id) from crudo o where o.role=c.role and abs(extract(epoch from(o.created_at-c.created_at)))<=180
      and public._copilot_msg_same(o.content,c.content)),c.id) as orden_id
    from crudo c
  )
  select m.id,m.created_at,m.role,m.content,m.media_path,m.media_type,m.meta from marcado m
    where not m.es_duplicado order by m.orden_id desc,m.id desc limit least(greatest(p_limit,1),200);
end $function$;
-- Legacy n8n session ids have no tenant provenance. Read the attributed message log.
create or replace function public.get_my_telegram_activity(p_limit integer default 20)
returns table(id integer,occurred_at timestamptz,role text,content text)
language sql stable security definer set search_path=public,pg_temp as $fn$
 select t.id::integer,t.created_at,t.role,t.content
 from public.tg_bot_activity t join public.profiles p on p.id=auth.uid() and p.active is true
  and p.organization_id=t.organization_id and p.telegram_chat_id=t.telegram_chat_id
 where t.organization_id=public.current_organization_id()
 order by t.id desc limit least(greatest(p_limit,1),100);
$fn$;
