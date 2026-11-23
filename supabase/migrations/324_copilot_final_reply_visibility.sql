-- A final reply is unique by request, not by a repeated sentence.
CREATE OR REPLACE FUNCTION public.tg_bot_activity_dedupe()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin

  if new.role='ai' and new.meta->>'kind'='copilot_delivery' and exists(
    select 1 from public.copilot_deliveries d join public.profiles p on p.id=d.profile_id and p.organization_id=d.organization_id
    where d.id::text=new.meta->>'request_id' and d.organization_id=new.organization_id
      and p.telegram_chat_id=new.telegram_chat_id and d.status in ('completed','failed','uncertain')) then return new; end if;
  if exists (
    select 1 from public.tg_bot_activity
     where organization_id = new.organization_id and telegram_chat_id = new.telegram_chat_id
       and role = new.role
       and content = new.content
       and created_at > now() - case when new.role = 'user'
                                     then interval '20 seconds'
                                     else interval '90 seconds' end
  ) then
    return null;  -- misma voz, misma frase, recién dicha: no se repite
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tg_bot_activity_no_duplicar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_norm text;
begin

  if new.role='ai' and new.meta->>'kind'='copilot_delivery' and exists(
    select 1 from public.copilot_deliveries d join public.profiles p on p.id=d.profile_id and p.organization_id=d.organization_id
    where d.id::text=new.meta->>'request_id' and d.organization_id=new.organization_id
      and p.telegram_chat_id=new.telegram_chat_id and d.status in ('completed','failed','uncertain')) then return new; end if;
  if coalesce(new.role,'') <> 'ai' or new.telegram_chat_id is null then
    return new;
  end if;

  v_norm := public._copilot_msg_norm(coalesce(new.content,''));
  -- Los mensajes muy cortos se dejan pasar: no hay suficiente texto para
  -- afirmar que dos son el mismo.
  if length(v_norm) < 40 then
    return new;
  end if;

  if exists (
    select 1 from public.tg_bot_activity a
     where a.organization_id = new.organization_id and a.telegram_chat_id = new.telegram_chat_id
       and a.role = 'ai'
       and a.created_at > now() - interval '1 minute'
       and left(public._copilot_msg_norm(a.content), 150) = left(v_norm, 150)
  ) then
    return null;   -- ya está en el hilo: no se guarda otra vez
  end if;

  return new;
end;
$function$;

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
    select c.*,(case when coalesce(c.meta->>'kind','')='copilot_delivery' and nullif(c.meta->>'request_id','') is not null then false else (
      exists(select 1 from crudo o where o.id<>c.id and o.role=c.role
        and abs(extract(epoch from(o.created_at-c.created_at)))<=180
        and public._copilot_msg_same(o.content,c.content)
        and ((c.role='user' and o.id<c.id) or(c.role<>'user' and (
          length(coalesce(o.content,''))>length(coalesce(c.content,''))
          or(length(coalesce(o.content,''))=length(coalesce(c.content,'')) and o.id<c.id)))))
      or(c.role='user' and exists(select 1 from crudo a where a.role<>'user' and a.created_at=c.created_at and a.id>c.id and a.id<=c.id+3)
        and exists(select 1 from crudo u where u.role='user' and u.id<c.id and u.created_at>=c.created_at-interval '5 minutes' and u.created_at<c.created_at))
    ) end) as es_duplicado,
    case when coalesce(c.meta->>'kind','')='copilot_delivery' and nullif(c.meta->>'request_id','') is not null then c.id else coalesce((select min(o.id) from crudo o where o.role=c.role and abs(extract(epoch from(o.created_at-c.created_at)))<=180
      and public._copilot_msg_same(o.content,c.content)),c.id) end as orden_id
    from crudo c
  )
  select m.id,m.created_at,m.role,m.content,m.media_path,m.media_type,m.meta from marcado m
    where not m.es_duplicado order by m.orden_id desc,m.id desc limit least(greatest(p_limit,1),200);
end $function$;
