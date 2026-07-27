-- Hueco que se ve en la captura de Ángel (27-jul): escribió «Hola» en #NSG y a
-- Iván no le llegaba NADA, porque solo avisábamos cuando había una @mención.
-- Un chat que solo suena con @ no reemplaza al WhatsApp: en WhatsApp suena
-- SIEMPRE. Ahora:
--   · Mensaje normal  → le llega al resto del equipo (título: quién y en qué canal).
--   · Con @mención    → al mencionado le llega con «te mencionó», que pesa más.
-- El que escribe nunca se avisa a sí mismo. Todo acotado a la organización.

create or replace function public.fn_chat_send(
  p_profile_id uuid, p_channel_id uuid, p_body text,
  p_attachment_path text default null, p_attachment_type text default null,
  p_reply_to uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
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
        headers := jsonb_build_object('Content-Type','application/json',
                                      'x-push-secret','stratos-push-internal-2026'),
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
end $$;

grant execute on function public.fn_chat_send(uuid,uuid,text,text,text,uuid) to anon, authenticated;;
