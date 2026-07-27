-- Que la @mención suene en el TELÉFONO, no solo en la campanita.
-- Sin esto el chat no reemplaza al WhatsApp: nadie mira una campanita que no
-- avisa. Reusa el mismo camino que ya usan las llamadas y los recordatorios
-- (edge function send-push vía pg_net); no hace falta ningún flujo n8n nuevo.
-- Es best-effort: si el push falla, el mensaje se manda igual.

create or replace function public.fn_chat_send(
  p_profile_id uuid, p_channel_id uuid, p_body text,
  p_attachment_path text default null, p_attachment_type text default null,
  p_reply_to uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_canal record; v_yo text; v_msg_id uuid;
  v_menciones uuid[] := '{}'; v_p record; v_chat bigint; v_quien uuid;
  v_primer text; v_resumen text;
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

  foreach v_quien in array coalesce(v_menciones, '{}'::uuid[]) loop
    if v_quien <> p_profile_id then
      -- (a) campanita del Copilot
      select telegram_chat_id into v_chat from profiles where id = v_quien;
      if v_chat is not null then
        perform fn_log_proactive_copilot(
          v_chat,
          coalesce(v_yo,'Alguien') || ' te mencionó en #' || v_canal.nombre || E'\n' || v_resumen,
          'assistant');
      end if;

      -- (b) push al teléfono — mismo camino que las llamadas y los recordatorios
      begin
        perform net.http_post(
          url     := 'https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/send-push',
          headers := jsonb_build_object('Content-Type','application/json',
                                        'x-push-secret','stratos-push-internal-2026'),
          body    := jsonb_build_object(
            'user_id', v_quien::text,
            'title',   coalesce(v_yo,'Alguien') || ' · #' || v_canal.nombre,
            'body',    v_resumen,
            'tag',     'chat-' || v_canal.id::text,
            'view',    'chat',
            'url',     '/'
          )
        );
      exception when others then null;
      end;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_msg_id, 'menciones', coalesce(array_length(v_menciones,1),0));
end $$;

grant execute on function public.fn_chat_send(uuid,uuid,text,text,text,uuid) to anon, authenticated;;
