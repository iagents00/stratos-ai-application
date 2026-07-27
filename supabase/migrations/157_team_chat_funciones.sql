-- Las funciones del chat de equipo. Todo org-scoped por el perfil de quien llama:
-- ninguna recibe organization_id desde el navegador.

create or replace function public.fn_chat_channels(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid; v_out jsonb;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by (x->>'orden')::int, x->>'nombre'), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'descripcion', c.descripcion,
      'tipo', c.tipo, 'orden', c.orden,
      'sin_leer', (select count(*) from team_chat_messages m
                    where m.channel_id = c.id and m.deleted_at is null
                      and m.author_id is distinct from p_profile_id
                      and m.created_at > coalesce(
                            (select r.last_read_at from team_chat_reads r
                              where r.channel_id = c.id and r.profile_id = p_profile_id),
                            '1970-01-01'::timestamptz)),
      'ultimo', (select jsonb_build_object(
                          'body', left(coalesce(nullif(m.body,''), 'archivo'), 90),
                          'autor', coalesce(pr.name, 'alguien'),
                          'cuando', m.created_at)
                   from team_chat_messages m
                   left join profiles pr on pr.id = m.author_id
                  where m.channel_id = c.id and m.deleted_at is null
                  order by m.created_at desc limit 1)
    ) x
    from team_chat_channels c
   where c.organization_id = v_org and c.archived_at is null
  ) s;
  return v_out;
end $$;

create or replace function public.fn_chat_messages(p_profile_id uuid, p_channel_id uuid, p_limit int default 120)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid; v_out jsonb;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return '[]'::jsonb; end if;
  if not exists (select 1 from team_chat_channels c where c.id = p_channel_id and c.organization_id = v_org) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(x order by x->>'created_at'), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'id', m.id, 'body', m.body, 'author_id', m.author_id,
      'autor', coalesce(pr.name, 'Alguien'),
      'created_at', m.created_at, 'edited_at', m.edited_at,
      'attachment_path', m.attachment_path, 'attachment_type', m.attachment_type,
      'reply_to', m.reply_to,
      'reply_body',  (select left(coalesce(nullif(r.body,''),'archivo'), 80) from team_chat_messages r where r.id = m.reply_to),
      'reply_autor', (select rp.name from team_chat_messages r left join profiles rp on rp.id = r.author_id where r.id = m.reply_to),
      'me_mencionaron', p_profile_id = any(m.menciones)
    ) x
    from (select * from team_chat_messages
           where channel_id = p_channel_id and deleted_at is null
           order by created_at desc limit greatest(1, least(coalesce(p_limit,120), 400))) m
    left join profiles pr on pr.id = m.author_id
  ) s;
  return v_out;
end $$;

-- Mandar un mensaje. Resuelve las @menciones contra el equipo de la org y le avisa
-- a cada mencionado en la campanita (el mismo canal de las alertas del Copilot),
-- para que un "@Iván mirá esto" no se pierda.
create or replace function public.fn_chat_send(
  p_profile_id uuid, p_channel_id uuid, p_body text,
  p_attachment_path text default null, p_attachment_type text default null,
  p_reply_to uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_canal record; v_yo text; v_msg_id uuid;
  v_menciones uuid[] := '{}'; v_p record; v_chat bigint; v_quien uuid; v_primer text;
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

  foreach v_quien in array coalesce(v_menciones, '{}'::uuid[]) loop
    if v_quien <> p_profile_id then
      select telegram_chat_id into v_chat from profiles where id = v_quien;
      if v_chat is not null then
        perform fn_log_proactive_copilot(
          v_chat,
          coalesce(v_yo,'Alguien') || ' te mencionó en #' || v_canal.nombre || E'\n' ||
          left(coalesce(nullif(p_body,''), 'te compartió un archivo'), 220),
          'assistant');
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_msg_id, 'menciones', array_length(v_menciones, 1));
end $$;

create or replace function public.fn_chat_read(p_profile_id uuid, p_channel_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from team_chat_channels c join profiles p on p.id = p_profile_id
                  where c.id = p_channel_id and c.organization_id = p.organization_id) then
    return;
  end if;
  insert into team_chat_reads (channel_id, profile_id, last_read_at)
  values (p_channel_id, p_profile_id, now())
  on conflict (channel_id, profile_id) do update set last_read_at = now();
end $$;

create or replace function public.fn_chat_create_channel(
  p_profile_id uuid, p_nombre text, p_descripcion text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_slug text; v_id uuid;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.'); end if;
  if coalesce(trim(p_nombre),'') = '' then return jsonb_build_object('ok', false, 'error', 'Ponele un nombre al canal.'); end if;

  -- slug sin tildes ni símbolos, sin depender de extensiones
  v_slug := lower(translate(trim(p_nombre),
              'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
              'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'));
  v_slug := trim(both '-' from regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'canal-' || substr(gen_random_uuid()::text, 1, 6); end if;

  if exists (select 1 from team_chat_channels where organization_id = v_org and slug = v_slug) then
    return jsonb_build_object('ok', false, 'error', 'Ya existe un canal que se llama así.');
  end if;

  insert into team_chat_channels (organization_id, nombre, slug, descripcion, created_by)
  values (v_org, trim(p_nombre), v_slug, nullif(trim(coalesce(p_descripcion,'')),''), p_profile_id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.fn_chat_channels(uuid)                       to anon, authenticated;
grant execute on function public.fn_chat_messages(uuid,uuid,int)              to anon, authenticated;
grant execute on function public.fn_chat_send(uuid,uuid,text,text,text,uuid)  to anon, authenticated;
grant execute on function public.fn_chat_read(uuid,uuid)                      to anon, authenticated;
grant execute on function public.fn_chat_create_channel(uuid,text,text)       to anon, authenticated;;
