-- Internal senders and receiver share a server-only key, never a repository literal.
create or replace function public.fn_push_internal_headers() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_secret text;
begin
 select value into v_secret from public.push_secure_config where key='webhook_secret';
 if nullif(v_secret,'') is null then raise exception 'Push secret is not configured'; end if;
 return jsonb_build_object('Content-Type','application/json','x-push-secret',v_secret);
end $fn$;
revoke all on function public.fn_push_internal_headers() from public,anon,authenticated;
grant execute on function public.fn_push_internal_headers() to service_role;

CREATE OR REPLACE FUNCTION public.fn_chat_send_impl(p_profile_id uuid, p_channel_id uuid, p_body text, p_attachment_path text DEFAULT NULL::text, p_attachment_type text DEFAULT NULL::text, p_reply_to uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid; v_canal record; v_yo text; v_msg_id uuid;
  v_menciones uuid[] := '{}'; v_p record; v_chat bigint;
  v_primer text; v_resumen text; v_mencionado boolean; v_titulo text;
begin
  select organization_id, name into v_org, v_yo from profiles where id = p_profile_id;
  if v_org is null then return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.'); end if;

  select * into v_canal from team_chat_channels
   where id = p_channel_id and organization_id = v_org and archived_at is null;
  if v_canal.id is null then return jsonb_build_object('ok', false, 'error', 'Ese canal no existe.'); end if;

  if coalesce(trim(p_body),'') = '' and p_attachment_path is null then
    return jsonb_build_object('ok', false, 'error', 'El mensaje está vacío.');
  end if;

  -- @menciones: por nombre completo o por el primer nombre. Sin regex a propósito
  -- (los nombres traen tildes y apellidos; un ilike simple no se rompe con eso).
  for v_p in select id, name from profiles where organization_id = v_org and coalesce(name,'') <> '' loop
    v_primer := split_part(v_p.name, ' ', 1);
    if p_body ilike '%@' || v_p.name || '%' or p_body ilike '%@' || v_primer || '%' then
      v_menciones := array_append(v_menciones, v_p.id);
    end if;
  end loop;

  insert into team_chat_messages (organization_id, channel_id, author_id, body,
                                  attachment_path, attachment_type, reply_to, menciones)
  values (v_org, p_channel_id, p_profile_id, coalesce(p_body,''),
          p_attachment_path, p_attachment_type, p_reply_to, v_menciones)
  returning id into v_msg_id;

  insert into team_chat_reads (channel_id, profile_id, last_read_at)
  values (p_channel_id, p_profile_id, now())
  on conflict (channel_id, profile_id) do update set last_read_at = now();

  v_resumen := left(coalesce(nullif(p_body,''), 'te compartió un archivo'), 180);

  -- Avisar a TODO el equipo de la org, menos a quien escribió.
  for v_p in
    select id, name, telegram_chat_id
      from profiles
     where organization_id = v_org
       and id <> p_profile_id
       and coalesce(active, true)
  loop
    v_mencionado := v_p.id = any(coalesce(v_menciones, '{}'::uuid[]));
    v_titulo := case when v_mencionado
                     then coalesce(v_yo,'Alguien') || ' te mencionó · #' || v_canal.nombre
                     else coalesce(v_yo,'Alguien') || ' · #' || v_canal.nombre end;

    -- (a) campanita del Copilot — solo si de verdad es para esa persona, para no
    --     llenarle la campanita de charla suelta.
    if v_mencionado then
      v_chat := v_p.telegram_chat_id;
      if v_chat is not null then
        perform fn_log_proactive_copilot(v_chat, v_titulo || E'\n' || v_resumen, 'assistant');
      end if;
    end if;

    -- (b) push al teléfono — SIEMPRE, como WhatsApp. Mismo camino que las
    --     llamadas y los recordatorios. Best-effort: si falla, el mensaje ya quedó.
    begin
      perform net.http_post(
        url     := 'https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/send-push',
        headers := public.fn_push_internal_headers(),
        body    := jsonb_build_object(
          'user_id', v_p.id::text,
          'title',   v_titulo,
          'body',    v_resumen,
          'tag',     'chat-' || v_canal.id::text,
          'view',    'chat',
          'url',     '/')
      );
    exception when others then null;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_msg_id,
                            'menciones', coalesce(array_length(v_menciones,1),0));
end $function$;

CREATE OR REPLACE FUNCTION public.trg_push_on_proactive_sent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user  uuid;
  v_body  text;
  v_title text;
BEGIN
  IF NEW.asesor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.asesor_id AND p.organization_id = NEW.organization_id AND p.active is true) THEN
    v_user := NEW.asesor_id;
  ELSIF NEW.asesor_name IS NOT NULL THEN
    SELECT p.id INTO v_user
    FROM public.profiles p
    WHERE p.organization_id = NEW.organization_id
      AND p.active is true AND lower(p.name) = lower(NEW.asesor_name)
    ORDER BY p.active DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Título: el payload manda (caso llamadas "📞 X te está llamando"); default igual que antes
  v_title := coalesce(nullif(NEW.payload->>'title',''), 'Copilot · Stratos');

  v_body := coalesce(
    nullif(NEW.payload->>'text',''),
    nullif(NEW.payload->>'message',''),
    nullif(NEW.payload->>'message_hint',''),
    nullif(NEW.payload->>'next_action',''),
    CASE
      WHEN NEW.tipo LIKE 'zoom%'        THEN 'Tienes un Zoom próximamente — repasá la ficha del cliente.'
      WHEN NEW.tipo LIKE 'next_action%' THEN 'Tienes una acción programada con un cliente próximamente.'
      WHEN NEW.tipo LIKE 'visita%'      THEN 'Tienes una visita/recorrido agendado próximamente.'
      WHEN NEW.tipo LIKE 'inactividad%' THEN 'Tienes un cliente sin movimiento; revisalo en el CRM.'
      WHEN NEW.tipo IN ('team_action','personal') THEN 'Tienes un recordatorio pendiente.'
      ELSE 'Recordatorio del asistente.'
    END
  );

  BEGIN
    PERFORM net.http_post(
      url     := 'https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/send-push',
      headers := public.fn_push_internal_headers(),
      body    := jsonb_build_object(
        'user_id', v_user::text,
        'title',   v_title,
        'body',    v_body,
        'tag',     CASE WHEN NEW.payload->>'kind' = 'llamada' THEN 'stratos-llamada' ELSE 'proactive-'||NEW.id::text END,
        'view',    'copilot',
        'url',     coalesce(nullif(NEW.payload->>'url',''), '/'),
        'kind',    NEW.payload->>'kind',
        'requireInteraction', coalesce((NEW.payload->>'requireInteraction')::boolean, false)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;
