-- 098: Copilot web -> agenda Personal / Profesional con lenguaje natural.
--
-- Objetivo:
--   - Frases como "recuérdame ir al banco pasado mañana a las 3 45" crean
--     una fila real en team_actions, visible en Mi Espacio -> Agenda.
--   - El Copilot web no depende del LLM/n8n para estos recordatorios claros.
--   - Reusa el parser de agenda del bot, pero corrige casos frecuentes:
--       * "a las 3 45" sin dos puntos
--       * "recuéstame/recuestame" como typo de "recuérdame"
--       * títulos tipo "que tengo que ir al banco" -> "Ir al banco"

alter table public.team_actions
  add column if not exists status text not null default 'pending',
  add column if not exists last_response_at timestamptz,
  add column if not exists evidence_at timestamptz,
  add column if not exists nota text;

update public.team_actions
   set status = 'done',
       done = true,
       completed_at = coalesce(completed_at, now())
 where lower(coalesce(status,'')) in ('cancelled','canceled','cancelado','cancelada');

alter table public.team_actions
  drop constraint if exists team_actions_status_check;

alter table public.team_actions
  add constraint team_actions_status_check
  check (status in ('pending','in_progress','not_done','done'));

create or replace function public._bot_agenda_norm(p_text text)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select btrim(regexp_replace(public.unaccent(lower(coalesce(p_text,''))), '\s+', ' ', 'g'));
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
  v_title := regexp_replace(v_title, '^\s*(que\s+)?(tengo|toca|debo|necesito|hay)\s+que\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*(que\s+)?(me\s+)?(avises?|recuerdes?)\s+(que\s+)?', '', 'i');
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

create or replace function public._bot_agenda_extract_time(p_norm text)
returns jsonb
language plpgsql
immutable
set search_path to 'public','pg_temp'
as $$
declare
  v_match text[];
  v_hour int;
  v_min int := 0;
  v_suffix text;
begin
  v_match := regexp_match(
    coalesce(p_norm,''),
    '(^| )(a las|alas|para las|hora)\s*([0-2]?[0-9])(?:(?::|\s+)([0-5][0-9]))?\s*(a\.?m\.?|p\.?m\.?|am|pm|manana|mañana|tarde|noche)?'
  );

  if v_match is not null then
    v_hour := least(greatest(v_match[3]::int, 0), 23);
    v_min := coalesce(nullif(v_match[4], '')::int, 0);
    v_suffix := coalesce(v_match[5], '');
  else
    v_match := regexp_match(coalesce(p_norm,''), '(^| )([0-2]?[0-9]):([0-5][0-9])\s*(a\.?m\.?|p\.?m\.?|am|pm)?( |$)');
    if v_match is not null then
      v_hour := least(greatest(v_match[2]::int, 0), 23);
      v_min := coalesce(nullif(v_match[3], '')::int, 0);
      v_suffix := coalesce(v_match[4], '');
    else
      v_match := regexp_match(coalesce(p_norm,''), '(^| )([1-9]|1[0-2])\s+([0-5][0-9])\s*(a\.?m\.?|p\.?m\.?|am|pm|tarde|noche)?( |$)');
      if v_match is not null then
        v_hour := least(greatest(v_match[2]::int, 0), 23);
        v_min := coalesce(nullif(v_match[3], '')::int, 0);
        v_suffix := coalesce(v_match[4], '');
      else
        v_match := regexp_match(coalesce(p_norm,''), '(^| )([1-9]|1[0-2])\s*(a\.?m\.?|p\.?m\.?|am|pm|tarde|noche)( |$)');
        if v_match is not null then
          v_hour := least(greatest(v_match[2]::int, 0), 23);
          v_min := 0;
          v_suffix := coalesce(v_match[3], '');
        end if;
      end if;
    end if;
  end if;

  if v_match is null then
    return jsonb_build_object('ok', false);
  end if;

  if v_suffix ~ 'p|tarde|noche' and v_hour < 12 then
    v_hour := v_hour + 12;
  elsif v_suffix ~ 'a|manana|mañana' and v_hour = 12 then
    v_hour := 0;
  elsif v_suffix = '' and v_hour between 1 and 7 then
    v_hour := v_hour + 12;
  end if;

  return jsonb_build_object('ok', true, 'hour', v_hour, 'minute', v_min);
end;
$$;

create or replace function public._bot_agenda_detect_category(p_text text, p_args jsonb default '{}'::jsonb)
returns text
language plpgsql
immutable
set search_path to 'public','pg_temp'
as $$
declare
  v_raw text := public._bot_agenda_norm(coalesce(
    p_args->>'category',
    p_args->>'agenda_category',
    p_args->>'scope',
    p_args->>'tipo',
    ''
  ));
  v_norm text := public._bot_agenda_norm(coalesce(p_text,''));
begin
  if v_raw in ('personal','privado','privada') then
    return 'personal';
  end if;
  if v_raw in ('profesional','professional','trabajo','laboral','equipo','cliente','clientes') then
    return 'profesional';
  end if;

  if v_norm ~ '(^| )(personal|mi agenda personal)( |$)' then
    return 'personal';
  end if;

  if v_norm ~ '(profesional|trabajo|laboral|cliente|clientes|lead|leads|crm|whatsapp|zoom|reunion|junta|llamada con|propuesta|cotizacion|cotización|seguimiento|equipo|oficina|ventas|presentacion|presentación)' then
    return 'profesional';
  end if;

  return 'personal';
end;
$$;

create or replace function public._bot_agenda_is_create(p_tool text, p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select lower(coalesce(p_tool,'')) in ('add_task','create_task','agenda_personal','agenda_profesional','recordatorio','add_reminder','schedule_reminder')
    or coalesce(p_norm,'') ~ '(recuerdame|recordame|recuestame|agendame|agenda me|anotame|ponme|programame|creame|agrega).*(pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo|a las|alas|en [0-9]+|[0-9]{1,2}(:| )[0-9]{2})';
$$;

create or replace function public._bot_agenda_find_personal_action(
  p_profile_id uuid,
  p_org uuid,
  p_name text,
  p_text text default null
)
returns public.team_actions
language plpgsql
stable
set search_path to 'public','pg_temp'
as $$
declare
  v_action public.team_actions%rowtype;
  v_filter text := public._bot_agenda_norm(coalesce(p_text,''));
begin
  v_filter := regexp_replace(v_filter, '^(pospon|pospone|pospon|aplaza|mueve|recorre|cancela|cancelar|borra|elimina|quita|ya lo hice|ya la hice|hecho|hecha|lista|listo|completada|completado)\s*', '', 'g');
  v_filter := regexp_replace(v_filter, '^(esto|esta|eso|esa|lo|la)\s*', '', 'g');
  v_filter := regexp_replace(v_filter, '^(mi\s+)?(recordatorio|pendiente|tarea|actividad|agenda)\s*(de|para)?\s*', '', 'g');
  v_filter := regexp_replace(v_filter, '(en\s+\d+\s+(minuto|minutos|hora|horas)|\d+\s*(minuto|minutos|hora|horas))', '', 'g');
  v_filter := btrim(v_filter);
  if v_filter in ('esto','esta','eso','esa','lo','la') then
    v_filter := '';
  end if;

  select *
    into v_action
  from public.team_actions ta
  where ta.organization_id = p_org
    and coalesce(ta.done,false) = false
    and lower(coalesce(ta.category,'personal')) in ('personal','profesional')
    and (ta.asesor_id = p_profile_id or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(p_name,'')))
    and (
      v_filter = ''
      or public._bot_agenda_norm(ta.text) like '%' || v_filter || '%'
      or v_filter like '%' || public._bot_agenda_norm(ta.text) || '%'
    )
  order by
    case when lower(coalesce(ta.category,'personal')) = 'personal' then 0 else 1 end,
    case when ta.due_at >= now() - interval '12 hours' then 0 else 1 end,
    abs(extract(epoch from (ta.due_at - now()))) asc,
    ta.created_at desc
  limit 1;

  return v_action;
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
    v_reply := 'Ya lo tenía en tu agenda ' || case when v_category = 'personal' then 'personal' else 'profesional' end ||
               ': "' || v_existing.text || '" para ' || public._bot_agenda_reply_date(v_existing.due_at, v_tz) || '.';
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

  v_reply := 'Listo, lo agregué a tu agenda ' || case when v_category = 'personal' then 'personal' else 'profesional' end ||
             ': "' || v_title || '" para ' || public._bot_agenda_reply_date(v_due, v_tz) || '.' ||
             case when v_default_time then E'\n\nNo detecté hora exacta, así que lo dejé a las 09:00.' else '' end ||
             E'\n\nTe recordaré 1 hora antes y 10 minutos antes.';

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

create or replace function public.bot_agenda_personal_mark(p_telegram_chat_id bigint, p_status text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_profile public.profiles%rowtype;
  v_text text := public._bot_agenda_extract_text(coalesce(p_args,'{}'::jsonb));
  v_action public.team_actions%rowtype;
  v_status text := lower(coalesce(p_status,'done'));
  v_cancel boolean := false;
  v_reply text;
begin
  select * into v_profile from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) = true
  order by updated_at desc nulls last limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  v_cancel := v_status in ('cancel','cancelled','canceled','cancelado','cancelada');
  v_action := public._bot_agenda_find_personal_action(v_profile.id, v_profile.organization_id, v_profile.name, v_text);

  if v_action.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No encontré un recordatorio pendiente que coincida.','inline_keyboard','[]'::jsonb));
  end if;

  update public.team_actions
     set done = true,
         status = 'done',
         completed_at = now(),
         last_response_at = now(),
         nota = case when v_cancel then 'cancelled_from_copilot' else coalesce(nota, 'completed_from_copilot') end
   where id = v_action.id;

  update public.proactive_reminders
     set status = 'cancelled'
   where status = 'pending'
     and tipo = 'team_action'
     and payload->>'action_id' = v_action.id::text;

  v_reply := case when v_cancel
    then 'Listo, quité "' || v_action.text || '" de tu agenda.'
    else 'Perfecto, marqué "' || v_action.text || '" como completado.'
  end;

  return jsonb_build_object('ok', true, 'action_id', v_action.id, 'reply', jsonb_build_object('text', v_reply, 'inline_keyboard','[]'::jsonb));
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

  begin
    insert into public.tg_bot_activity (telegram_chat_id, role, content, occurred_at)
    values (v_chat_id, 'user', coalesce(p_text,''), now());

    if v_reply <> '' then
      insert into public.tg_bot_activity (telegram_chat_id, role, content, occurred_at)
      values (v_chat_id, 'ai', v_reply, now() + interval '1 millisecond');
    end if;
  exception when others then
    null;
  end;

  return v_result;
end;
$$;

grant execute on function public._bot_agenda_detect_category(text, jsonb) to service_role;
grant execute on function public.copilot_agenda_create_from_text(text, text) to authenticated;
grant execute on function public.copilot_agenda_create_from_text(text, text) to service_role;

revoke all on function public._bot_agenda_detect_category(text, jsonb) from public, anon, authenticated;
revoke all on function public.copilot_agenda_create_from_text(text, text) from public, anon;

notify pgrst, 'reload schema';
