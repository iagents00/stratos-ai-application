-- 099: Ajustes Copilot agenda web
-- - Evita titulo "Que" en frases como:
--   "recuerdame que manana tengo que ir al banco a las 5:30".
-- - Registra historial en tg_bot_activity.created_at (la columna real).
-- - Deduplica la respuesta normal vs. la respuesta con fecha entre guillemets.

create or replace function public._copilot_msg_norm(p_text text)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p_text,'')), 'áéíóúüñ', 'aeiouun'),
             '[«»“”"''*_`#]+', '', 'g'
           ),
           '\s+', ' ', 'g'
         ));
$$;

create or replace function public._bot_agenda_extract_title(p_text text)
returns text
language plpgsql
immutable
set search_path to 'public','pg_temp'
as $$
declare
  v_title text := btrim(coalesce(p_text,''));
begin
  v_title := regexp_replace(
    v_title,
    '^\s*(porfa|por favor)?\s*(recu[eé]rdame|recuerdame|recordame|recu[eé]stame|recuestame|ag[eé]ndame|agendame|agenda|anota|an[oó]tame|ponme|programame|progr[aá]mame|creame|cr[eé]ame|agrega|agregame|agr[eé]game)\s*',
    '',
    'i'
  );

  v_title := regexp_replace(v_title, '^\s*(un|una|mi|en mi agenda|recordatorio|pendiente|actividad|tarea)\s*(de|para)?\s*', '', 'i');
  v_title := regexp_replace(v_title, '^\s*que\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*(hoy|ma[nñ]ana|pasado ma[nñ]ana)\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*(el\s+)?(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*(que\s+)?(tengo|toca|debo|necesito|hay)\s+que\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*(que\s+)?(me\s+)?(avises?|recuerdes?)\s+(que\s+)?', '', 'i');
  v_title := regexp_replace(v_title, '^\s*que\s+', '', 'i');

  v_title := regexp_replace(v_title, '\s+(hoy|ma[nñ]ana|pasado ma[nñ]ana)(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(el\s+)?(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(en\s+\d+\s+(minuto|minutos|min|mins|hora|horas|hr|hrs|d[ií]a|dias|días))(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(a\s+las|alas|para\s+las|hora)\s+\d{1,2}((:|\s+)\d{2})?\s*(a\.?m\.?|p\.?m\.?|am|pm|de la ma[nñ]ana|de la tarde|de la noche)?(\s|$)', '', 'i');
  v_title := regexp_replace(v_title, '\s+', ' ', 'g');
  v_title := btrim(v_title, ' .,-–—');

  if v_title = '' then
    v_title := 'Recordatorio';
  end if;

  return upper(left(v_title, 1)) || substr(v_title, 2);
end;
$$;

create or replace function public.bot_agenda_personal_create(p_telegram_chat_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_profile public.profiles%rowtype;
  v_tz text;
  v_text text := public._bot_agenda_extract_text(coalesce(p_args,'{}'::jsonb));
  v_title text;
  v_category text;
  v_due_info jsonb;
  v_due timestamptz;
  v_action_id uuid;
  v_existing public.team_actions%rowtype;
  v_default_time boolean;
  v_reply text;
begin
  select *
    into v_profile
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id
    and coalesce(active, true) = true
  order by updated_at desc nulls last
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  v_tz := public.fn_user_tz(v_profile.organization_id, p_telegram_chat_id);
  v_due_info := public._bot_agenda_parse_due_at(v_text, coalesce(p_args,'{}'::jsonb), v_tz);

  if not coalesce((v_due_info->>'ok')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'needs_date', true,
      'reply', jsonb_build_object(
        'text', 'Claro. Dime fecha y hora para agendarlo, por ejemplo: "recuérdame llamar a Juan mañana a las 10".',
        'inline_keyboard', '[]'::jsonb
      )
    );
  end if;

  v_due := (v_due_info->>'due_at')::timestamptz;
  v_default_time := coalesce((v_due_info->>'default_time')::boolean, false);
  v_title := public._bot_agenda_extract_title(coalesce(nullif(v_text,''), p_args->>'task', p_args->>'title', p_args->>'name'));
  v_category := public._bot_agenda_detect_category(v_text, coalesce(p_args,'{}'::jsonb));

  select *
    into v_existing
  from public.team_actions ta
  where ta.organization_id = v_profile.organization_id
    and coalesce(ta.done,false) = false
    and ta.asesor_id = v_profile.id
    and lower(coalesce(ta.category,'personal')) = v_category
    and public._bot_agenda_norm(ta.text) = public._bot_agenda_norm(v_title)
    and ta.due_at between v_due - interval '2 minutes' and v_due + interval '2 minutes'
  order by ta.created_at desc
  limit 1;

  if v_existing.id is not null then
    v_reply := 'Listo, te lo recuerdo:' || E'\n' ||
               '• ' || lower(v_existing.text) || E'\n' ||
               'el «' || public._bot_agenda_reply_date(v_existing.due_at, v_tz) || '»';
    return jsonb_build_object(
      'ok', true,
      'deduped', true,
      'action_id', v_existing.id,
      'reply', jsonb_build_object('text', v_reply, 'inline_keyboard','[]'::jsonb)
    );
  end if;

  insert into public.team_actions (
    organization_id,
    text,
    asesor_id,
    asesor_name,
    category,
    priority,
    done,
    due_at,
    completed_at,
    nota,
    status
  )
  values (
    v_profile.organization_id,
    v_title,
    v_profile.id,
    v_profile.name,
    v_category,
    case when public._bot_agenda_norm(v_text) ~ '\burgente\b|\bimportante\b' then 'urgente' else 'normal' end,
    false,
    v_due,
    null,
    'created_from_copilot',
    'pending'
  )
  returning id into v_action_id;

  v_reply := 'Listo, te lo recuerdo:' || E'\n' ||
             '• ' || lower(v_title) || E'\n' ||
             'el «' || public._bot_agenda_reply_date(v_due, v_tz) || '»' ||
             case when v_default_time then E'\n\nNo detecté hora exacta, así que lo dejé a las 09:00.' else '' end;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'category', v_category,
    'due_at', v_due,
    'title', v_title,
    'reply', jsonb_build_object('text', v_reply, 'inline_keyboard','[]'::jsonb)
  );
end;
$$;

create or replace function public.copilot_agenda_create_from_text(
  p_text text,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_profile public.profiles%rowtype;
  v_chat_id bigint;
  v_args jsonb;
  v_result jsonb;
  v_reply text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select *
    into v_profile
  from public.profiles
  where id = auth.uid()
    and coalesce(active, true) = true
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_chat_id := v_profile.telegram_chat_id;
  if v_chat_id is null then
    return jsonb_build_object('ok', false, 'error', 'telegram_not_paired');
  end if;

  v_args := jsonb_build_object(
    'input_text', coalesce(p_text,''),
    'category', coalesce(p_category, '')
  );

  v_result := public.bot_agenda_personal_create(v_chat_id, v_args);
  v_reply := coalesce(v_result#>>'{reply,text}', v_result->>'text', '');

  insert into public.tg_bot_activity (organization_id, telegram_chat_id, role, content, created_at, meta)
  values (v_profile.organization_id, v_chat_id, 'user', coalesce(p_text,''), now(), jsonb_build_object('source','copilot_agenda_direct'));

  if v_reply <> '' then
    insert into public.tg_bot_activity (organization_id, telegram_chat_id, role, content, created_at, meta)
    values (v_profile.organization_id, v_chat_id, 'ai', v_reply, now() + interval '1 millisecond', jsonb_build_object('source','copilot_agenda_direct'));
  end if;

  return v_result;
end;
$$;

grant execute on function public.copilot_agenda_create_from_text(text, text) to authenticated;
grant execute on function public.copilot_agenda_create_from_text(text, text) to service_role;
revoke all on function public.copilot_agenda_create_from_text(text, text) from public, anon;

notify pgrst, 'reload schema';
