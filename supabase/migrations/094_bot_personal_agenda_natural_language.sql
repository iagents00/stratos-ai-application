-- 094_bot_personal_agenda_natural_language.sql
--
-- Agenda personal Telegram para Stratos/Duke.
-- - Mantiene el workflow n8n intacto: BOTv5 sigue llamando bot_nlu_dispatch_gvintell.
-- - Intercepta solo intenciones claras de agenda personal.
-- - Conserva catálogo/clientes/pipeline/expediente delegando al wrapper anterior.
-- - Usa America/Cancun vía fn_user_tz/proactive_config y agenda por telegram_chat_id.

create or replace function public._bot_agenda_norm(p_text text)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select btrim(regexp_replace(public.unaccent(lower(coalesce(p_text,''))), '\s+', ' ', 'g'));
$$;

create or replace function public._bot_agenda_extract_text(p_args jsonb)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select btrim(coalesce(
    p_args->>'input_text',
    p_args->>'original_text',
    p_args->>'utterance',
    p_args->>'message',
    p_args->>'text',
    p_args->>'texto',
    p_args->>'query',
    p_args->>'title',
    p_args->>'task',
    p_args->>'action',
    p_args->>'next_action',
    p_args->>'name',
    ''
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
    '^\s*(por favor\s*)?(recu[eé]rdame|recordame|ag[eé]ndame|agendame|agenda|anota|ponme|programame|progr[aá]mame|creame|cr[eé]ame|agrega|agregame|agr[eé]game)\s*',
    '',
    'i'
  );
  v_title := regexp_replace(v_title, '^\s*(un|una|mi|en mi agenda|recordatorio|pendiente|actividad|tarea)\s*(de|para)?\s*', '', 'i');
  v_title := regexp_replace(v_title, '\s+(hoy|ma[nñ]ana|pasado ma[nñ]ana)(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(el\s+)?(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(en\s+\d+\s+(minuto|minutos|hora|horas|d[ií]a|dias|días))(\s|$).*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(a\s+las|alas|para\s+las|hora)\s+\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?|am|pm|de la ma[nñ]ana|de la tarde|de la noche)?(\s|$)', '', 'i');
  v_title := regexp_replace(v_title, '\s+', ' ', 'g');
  v_title := btrim(v_title, ' .,-–—');

  if v_title = '' then
    v_title := 'Recordatorio personal';
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
    '(^| )(a las|alas|para las|hora)\s*([0-2]?[0-9])(?::([0-5][0-9]))?\s*(a\.?m\.?|p\.?m\.?|am|pm|manana|mañana|tarde|noche)?'
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
      v_match := regexp_match(coalesce(p_norm,''), '(^| )([1-9]|1[0-2])\s*(a\.?m\.?|p\.?m\.?|am|pm|tarde|noche)( |$)');
      if v_match is not null then
        v_hour := least(greatest(v_match[2]::int, 0), 23);
        v_min := 0;
        v_suffix := coalesce(v_match[3], '');
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

create or replace function public._bot_agenda_parse_due_at(p_text text, p_args jsonb, p_tz text default 'America/Cancun')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_temp'
as $$
declare
  v_tz text := coalesce(nullif(p_tz,''), 'America/Cancun');
  v_norm text := public._bot_agenda_norm(p_text);
  v_now_local timestamp := now() at time zone coalesce(nullif(p_tz,''), 'America/Cancun');
  v_raw text := nullif(coalesce(
    p_args->>'due_at',
    p_args->>'datetime',
    p_args->>'date_time',
    p_args->>'fecha_hora',
    p_args->>'next_action_at',
    p_args->>'reminder_at',
    p_args->>'scheduled_at',
    p_args->>'when'
  ), '');
  v_date_raw text := nullif(coalesce(p_args->>'date', p_args->>'fecha', p_args->>'day', p_args->>'dia'), '');
  v_time_raw text := nullif(coalesce(p_args->>'time', p_args->>'hora'), '');
  v_due timestamptz;
  v_date date;
  v_time jsonb;
  v_hour int := 9;
  v_min int := 0;
  v_has_time boolean := false;
  v_default_time boolean := false;
  v_match text[];
  v_days int;
  v_target_dow int;
  v_current_dow int;
begin
  if v_raw is not null then
    begin
      if v_raw ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$' then
        v_due := v_raw::timestamptz;
        return jsonb_build_object('ok', true, 'due_at', v_due, 'source', 'args_iso');
      elsif v_raw ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' then
        v_due := replace(left(v_raw, 16), 'T', ' ')::timestamp at time zone v_tz;
        return jsonb_build_object('ok', true, 'due_at', v_due, 'source', 'args_local');
      elsif v_raw ~ '^\d{4}-\d{2}-\d{2}$' then
        v_date_raw := v_raw;
      end if;
    exception when others then
      null;
    end;
  end if;

  if v_time_raw is not null then
    v_time := public._bot_agenda_extract_time('a las ' || v_time_raw);
    if coalesce((v_time->>'ok')::boolean, false) then
      v_hour := (v_time->>'hour')::int;
      v_min := (v_time->>'minute')::int;
      v_has_time := true;
    end if;
  end if;

  if not v_has_time then
    v_time := public._bot_agenda_extract_time(v_norm);
    if coalesce((v_time->>'ok')::boolean, false) then
      v_hour := (v_time->>'hour')::int;
      v_min := (v_time->>'minute')::int;
      v_has_time := true;
    end if;
  end if;

  v_match := regexp_match(v_norm, 'en\s+(\d+)\s*(minuto|minutos|min|mins)');
  if v_match is not null then
    v_due := now() + ((v_match[1]::int) * interval '1 minute');
    return jsonb_build_object('ok', true, 'due_at', v_due, 'source', 'relative_minutes');
  end if;

  v_match := regexp_match(v_norm, 'en\s+(\d+)\s*(hora|horas|hr|hrs)');
  if v_match is not null then
    v_due := now() + ((v_match[1]::int) * interval '1 hour');
    return jsonb_build_object('ok', true, 'due_at', v_due, 'source', 'relative_hours');
  end if;

  if v_date_raw is not null then
    begin
      if v_date_raw ~ '^\d{4}-\d{2}-\d{2}$' then
        v_date := v_date_raw::date;
      elsif v_date_raw ~ '^\d{1,2}/\d{1,2}/\d{4}$' then
        v_date := to_date(v_date_raw, 'DD/MM/YYYY');
      elsif v_date_raw ~ '^\d{1,2}/\d{1,2}$' then
        v_date := to_date(v_date_raw || '/' || extract(year from v_now_local)::int, 'DD/MM/YYYY');
      end if;
    exception when others then
      v_date := null;
    end;
  end if;

  if v_date is null then
    v_match := regexp_match(v_norm, '(^| )(\d{1,2})/(\d{1,2})(/([0-9]{2,4}))?( |$)');
    if v_match is not null then
      v_date := to_date(
        v_match[2] || '/' || v_match[3] || '/' ||
        coalesce(v_match[5], extract(year from v_now_local)::int::text),
        'DD/MM/YYYY'
      );
    end if;
  end if;

  if v_date is null then
    if v_norm ~ 'pasado manana|pasado mañana|\+2\s*dias|\+2\s*días' then
      v_date := v_now_local::date + 2;
    elsif v_norm ~ '(^| )manana( |$)|(^| )mañana( |$)' then
      v_date := v_now_local::date + 1;
    elsif v_norm ~ '(^| )hoy( |$)' then
      v_date := v_now_local::date;
    end if;
  end if;

  if v_date is null then
    v_target_dow := case
      when v_norm ~ '(^| )lunes( |$)' then 1
      when v_norm ~ '(^| )martes( |$)' then 2
      when v_norm ~ '(^| )miercoles( |$)|(^| )miércoles( |$)' then 3
      when v_norm ~ '(^| )jueves( |$)' then 4
      when v_norm ~ '(^| )viernes( |$)' then 5
      when v_norm ~ '(^| )sabado( |$)|(^| )sábado( |$)' then 6
      when v_norm ~ '(^| )domingo( |$)' then 0
      else null
    end;

    if v_target_dow is not null then
      v_current_dow := extract(dow from v_now_local)::int;
      v_days := (v_target_dow - v_current_dow + 7) % 7;
      if v_days = 0 then v_days := 7; end if;
      v_date := v_now_local::date + v_days;
    end if;
  end if;

  if v_date is null and v_has_time then
    v_date := v_now_local::date;
    if (v_date + make_time(v_hour, v_min, 0)) <= v_now_local + interval '2 minutes' then
      v_date := v_date + 1;
    end if;
  end if;

  if v_date is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_date');
  end if;

  if not v_has_time then
    v_default_time := true;
  end if;

  v_due := (v_date + make_time(v_hour, v_min, 0)) at time zone v_tz;

  return jsonb_build_object(
    'ok', true,
    'due_at', v_due,
    'source', case when v_default_time then 'date_default_09' else 'parsed_text' end,
    'default_time', v_default_time
  );
end;
$$;

create or replace function public._bot_agenda_reply_date(p_due_at timestamptz, p_tz text default 'America/Cancun')
returns text
language sql
stable
set search_path to 'public','pg_temp'
as $$
  select to_char(p_due_at at time zone coalesce(nullif(p_tz,''), 'America/Cancun'), 'DD/MM/YYYY HH24:MI') || ' Cancún';
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
  v_filter := regexp_replace(v_filter, '^(pospon|pospone|posp[oó]n|aplaza|mueve|recorre|cancela|cancelar|borra|elimina|quita|ya lo hice|ya la hice|hecho|hecha|lista|listo|completada|completado)\s*', '', 'g');
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
    and lower(coalesce(ta.category,'personal')) = 'personal'
    and (ta.asesor_id = p_profile_id or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(p_name,'')))
    and (
      v_filter = ''
      or public._bot_agenda_norm(ta.text) like '%' || v_filter || '%'
      or v_filter like '%' || public._bot_agenda_norm(ta.text) || '%'
    )
  order by
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
  v_due_info jsonb;
  v_due timestamptz;
  v_action_id uuid;
  v_order int;
  v_default_time boolean;
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
        'text', 'Claro. Dime fecha y hora para agendarlo, por ejemplo: “recuérdame llamar a Juan mañana a las 10”.',
        'inline_keyboard', '[]'::jsonb
      )
    );
  end if;

  v_due := (v_due_info->>'due_at')::timestamptz;
  v_default_time := coalesce((v_due_info->>'default_time')::boolean, false);
  v_title := public._bot_agenda_extract_title(coalesce(nullif(v_text,''), p_args->>'task', p_args->>'title', p_args->>'name'));

  select coalesce(max(order_idx), 0) + 1
    into v_order
  from public.team_actions
  where organization_id = v_profile.organization_id
    and coalesce(done,false) = false;

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
    assignee_type,
    order_idx,
    created_by,
    status
  )
  values (
    v_profile.organization_id,
    v_title,
    v_profile.id,
    v_profile.name,
    'personal',
    case when public._bot_agenda_norm(v_text) ~ '\burgente\b|\bimportante\b' then 'alta' else 'normal' end,
    false,
    v_due,
    null,
    'created_from_telegram',
    'human',
    v_order,
    v_profile.id,
    'pending'
  )
  returning id into v_action_id;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'reply', jsonb_build_object(
      'text',
      'Listo, lo agregué a tu agenda personal: “' || v_title || '” para ' ||
      public._bot_agenda_reply_date(v_due, v_tz) ||
      case when v_default_time then E'\n\nNo detecté hora exacta, así que lo dejé a las 09:00. Puedes decir “pospón esto 30 minutos” o “cámbialo a las 11”.' else '' end ||
      E'\n\nTe recordaré 1 hora antes y 10 minutos antes.',
      'inline_keyboard',
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.bot_agenda_personal_postpone(p_telegram_chat_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_profile public.profiles%rowtype;
  v_tz text;
  v_text text := public._bot_agenda_extract_text(coalesce(p_args,'{}'::jsonb));
  v_norm text := public._bot_agenda_norm(v_text);
  v_action public.team_actions%rowtype;
  v_match text[];
  v_minutes int := coalesce(nullif(p_args->>'minutes','')::int, nullif(p_args->>'delay_minutes','')::int, 30);
  v_due timestamptz;
begin
  select * into v_profile from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) = true
  order by updated_at desc nulls last limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  v_match := regexp_match(v_norm, '(\d+)\s*(minuto|minutos|min|mins)');
  if v_match is not null then
    v_minutes := v_match[1]::int;
  else
    v_match := regexp_match(v_norm, '(\d+)\s*(hora|horas|hr|hrs)');
    if v_match is not null then v_minutes := v_match[1]::int * 60; end if;
  end if;
  v_minutes := least(greatest(v_minutes, 5), 1440);

  v_action := public._bot_agenda_find_personal_action(v_profile.id, v_profile.organization_id, v_profile.name, v_text);
  if v_action.id is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No encontré un recordatorio personal pendiente para posponer.','inline_keyboard','[]'::jsonb));
  end if;

  v_due := greatest(v_action.due_at, now()) + (v_minutes * interval '1 minute');

  update public.team_actions
     set due_at = v_due,
         status = 'pending',
         last_response_at = null,
         updated_at = now()
   where id = v_action.id;

  update public.proactive_reminders
     set status = 'cancelled'
   where status = 'pending'
     and tipo = 'team_action'
     and payload->>'action_id' = v_action.id::text;

  v_tz := public.fn_user_tz(v_profile.organization_id, p_telegram_chat_id);
  return jsonb_build_object(
    'ok', true,
    'action_id', v_action.id,
    'reply', jsonb_build_object(
      'text', 'Listo, pospuse “' || v_action.text || '” para ' || public._bot_agenda_reply_date(v_due, v_tz) || '.',
      'inline_keyboard', '[]'::jsonb
    )
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
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No encontré un recordatorio personal pendiente que coincida.','inline_keyboard','[]'::jsonb));
  end if;

  update public.team_actions
     set done = true,
         status = case when v_cancel then 'cancelled' else 'done' end,
         completed_at = now(),
         last_response_at = now(),
         nota = case when v_cancel then 'cancelled_from_telegram' else coalesce(nota, 'completed_from_telegram') end,
         updated_at = now()
   where id = v_action.id;

  update public.proactive_reminders
     set status = 'cancelled'
   where status = 'pending'
     and tipo = 'team_action'
     and payload->>'action_id' = v_action.id::text;

  v_reply := case when v_cancel
    then 'Listo, cancelé “' || v_action.text || '” de tu agenda personal.'
    else 'Perfecto, marqué “' || v_action.text || '” como completado.'
  end;

  return jsonb_build_object('ok', true, 'action_id', v_action.id, 'reply', jsonb_build_object('text', v_reply, 'inline_keyboard','[]'::jsonb));
end;
$$;

create or replace function public.bot_proximas_acciones(p_telegram_chat_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_org uuid; v_pid uuid; v_view_all boolean; v_tz text; v_name text;
  v_personal text; v_profesional text; v_leads text; v_msg text;
begin
  select organization_id, id, coalesce(view_all_leads,false), name
    into v_org, v_pid, v_view_all, v_name
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) = true
  order by updated_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  select string_agg(line, E'\n') into v_personal from (
    select '• ' ||
      case when ta.due_at < now() then '⚠️ '
           when ta.due_at < now() + interval '2 hours' then '🔥 ' else '' end ||
      to_char(ta.due_at at time zone v_tz,'DD/MM HH24:MI') || ' — ' || ta.text as line,
      ta.due_at
    from public.team_actions ta
    where ta.organization_id = v_org
      and coalesce(ta.done,false) = false
      and ta.due_at is not null
      and lower(coalesce(ta.category,'personal')) = 'personal'
      and (ta.asesor_id = v_pid or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(v_name,'')))
      and ta.due_at >= now() - interval '2 days'
      and ta.due_at <= now() + interval '30 days'
    order by ta.due_at asc
    limit 12
  ) s;

  select string_agg(line, E'\n') into v_profesional from (
    select '• ' ||
      case when ta.due_at < now() then '⚠️ '
           when ta.due_at < now() + interval '2 hours' then '🔥 ' else '' end ||
      to_char(ta.due_at at time zone v_tz,'DD/MM HH24:MI') || ' — ' || ta.text ||
      case when lower(coalesce(ta.asesor_name,'')) = 'todos' then ' 👥' else '' end as line,
      ta.due_at
    from public.team_actions ta
    where ta.organization_id = v_org
      and coalesce(ta.done,false) = false
      and ta.due_at is not null
      and lower(coalesce(ta.category,'profesional')) <> 'personal'
      and (
        ta.asesor_id = v_pid
        or lower(coalesce(ta.asesor_name,'')) = lower(coalesce(v_name,''))
        or lower(coalesce(ta.asesor_name,'')) = 'todos'
      )
      and ta.due_at >= now() - interval '2 days'
      and ta.due_at <= now() + interval '30 days'
    order by ta.due_at asc
    limit 12
  ) s;

  select string_agg(line, E'\n') into v_leads from (
    select '• ' || coalesce(l.name,'Sin nombre') || ' — ' || coalesce(l.next_action,'(sin acción)') ||
           ' — ' || to_char(l.next_action_at at time zone v_tz,'DD/MM HH24:MI') ||
           case when l.next_action_at < now() then ' ⚠️ vencida'
                when l.next_action_at < now() + interval '2 hours' then ' 🔥 pronto' else '' end as line
    from public.leads l
    where l.organization_id = v_org
      and l.deleted_at is null
      and (v_view_all or l.asesor_id = v_pid)
      and l.next_action_at is not null
      and l.next_action_at >= now() - interval '2 days'
      and l.next_action_at <= now() + interval '30 days'
      and (l.stage is null or l.stage not in ('Cierre','Perdido'))
    order by (l.next_action_at >= now()) desc,
             case when l.next_action_at >= now() then l.next_action_at end asc,
             l.next_action_at desc
    limit 8
  ) s;

  if v_personal is null and v_profesional is null and v_leads is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No tienes pendientes con fecha en los próximos días. 🎉','inline_keyboard','[]'::jsonb));
  end if;

  v_msg := 'Tu agenda personal y profesional:';
  if v_personal is not null then v_msg := v_msg || E'\n\n🟢 Personal\n' || v_personal; end if;
  if v_profesional is not null then v_msg := v_msg || E'\n\n🔵 Profesional\n' || v_profesional; end if;
  if v_leads is not null then v_msg := v_msg || E'\n\n👤 Seguimiento de clientes\n' || v_leads; end if;

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text', v_msg, 'inline_keyboard','[]'::jsonb));
end;
$$;

create or replace function public._bot_agenda_is_list(p_tool text, p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select lower(coalesce(p_tool,'')) in ('list_pending','agenda','pendientes','proximas','upcoming','tasks')
    or coalesce(p_norm,'') ~ '(que tengo hoy|qué tengo hoy|que pendientes tengo|qué pendientes tengo|mis pendientes|mi agenda|agenda de hoy|pendientes de hoy)';
$$;

create or replace function public._bot_agenda_is_create(p_tool text, p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select lower(coalesce(p_tool,'')) in ('add_task','create_task','agenda_personal','recordatorio','add_reminder','schedule_reminder')
    or coalesce(p_norm,'') ~ '(recuerdame|recordame|agendame|agenda me|anotame|ponme|programame|creame|agrega).*(manana|mañana|hoy|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|alas|en [0-9]+)';
$$;

create or replace function public._bot_agenda_is_postpone(p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select coalesce(p_norm,'') ~ '(pospon|pospone|pospón|aplaza|mueve|recorre).*(minuto|minutos|hora|horas|mañana|manana|hoy|a las|alas)';
$$;

create or replace function public._bot_agenda_is_done(p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select coalesce(p_norm,'') ~ '(^| )(ya lo hice|ya la hice|hecho|hecha|listo|lista|completado|completada)( |$)';
$$;

create or replace function public._bot_agenda_is_cancel(p_norm text)
returns boolean
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select coalesce(p_norm,'') ~ '(cancela|cancelar|borra|elimina).*(recordatorio|pendiente|agenda|tarea|actividad|llamar|visita|cita)';
$$;

do $$
begin
  if to_regprocedure('public.bot_nlu_dispatch_gvintell_agenda_orig(bigint,text,jsonb)') is null then
    alter function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) rename to bot_nlu_dispatch_gvintell_agenda_orig;
  end if;
end $$;

create or replace function public.bot_nlu_dispatch_gvintell(
  p_telegram_chat_id bigint,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_text text;
  v_norm text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then
      v_tool := lower(coalesce(v_args#>>'{query,tool_name}', ''));
    end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then
      v_args := v_args#>'{query,args}';
    end if;
  end if;

  v_text := public._bot_agenda_extract_text(v_args);
  v_norm := public._bot_agenda_norm(v_text || ' ' || coalesce(v_args->>'query',''));

  if to_regprocedure('public._bot_is_catalog_query(text)') is not null
     and public._bot_is_catalog_query(v_norm) then
    return public.bot_nlu_dispatch_gvintell_agenda_orig(p_telegram_chat_id, p_tool_name, p_args);
  end if;

  if public._bot_agenda_is_cancel(v_norm) then
    return public.bot_agenda_personal_mark(p_telegram_chat_id, 'cancelled', v_args || jsonb_build_object('input_text', v_text));
  end if;

  if public._bot_agenda_is_done(v_norm) then
    return public.bot_agenda_personal_mark(p_telegram_chat_id, 'done', v_args || jsonb_build_object('input_text', v_text));
  end if;

  if public._bot_agenda_is_postpone(v_norm) then
    return public.bot_agenda_personal_postpone(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  if public._bot_agenda_is_list(v_tool, v_norm) then
    return public.bot_proximas_acciones(p_telegram_chat_id);
  end if;

  if public._bot_agenda_is_create(v_tool, v_norm) then
    return public.bot_agenda_personal_create(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  return public.bot_nlu_dispatch_gvintell_agenda_orig(p_telegram_chat_id, p_tool_name, p_args);
end;
$$;

grant execute on function public._bot_agenda_norm(text) to service_role;
grant execute on function public._bot_agenda_extract_text(jsonb) to service_role;
grant execute on function public._bot_agenda_extract_title(text) to service_role;
grant execute on function public._bot_agenda_extract_time(text) to service_role;
grant execute on function public._bot_agenda_parse_due_at(text, jsonb, text) to service_role;
grant execute on function public._bot_agenda_reply_date(timestamptz, text) to service_role;
grant execute on function public._bot_agenda_find_personal_action(uuid, uuid, text, text) to service_role;
grant execute on function public._bot_agenda_is_list(text, text) to service_role;
grant execute on function public._bot_agenda_is_create(text, text) to service_role;
grant execute on function public._bot_agenda_is_postpone(text) to service_role;
grant execute on function public._bot_agenda_is_done(text) to service_role;
grant execute on function public._bot_agenda_is_cancel(text) to service_role;
grant execute on function public.bot_agenda_personal_create(bigint, jsonb) to service_role;
grant execute on function public.bot_agenda_personal_postpone(bigint, jsonb) to service_role;
grant execute on function public.bot_agenda_personal_mark(bigint, text, jsonb) to service_role;
grant execute on function public.bot_proximas_acciones(bigint) to service_role;
grant execute on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) to service_role;

revoke all on function public._bot_agenda_norm(text) from public, anon, authenticated;
revoke all on function public._bot_agenda_extract_text(jsonb) from public, anon, authenticated;
revoke all on function public._bot_agenda_extract_title(text) from public, anon, authenticated;
revoke all on function public._bot_agenda_extract_time(text) from public, anon, authenticated;
revoke all on function public._bot_agenda_parse_due_at(text, jsonb, text) from public, anon, authenticated;
revoke all on function public._bot_agenda_reply_date(timestamptz, text) from public, anon, authenticated;
revoke all on function public._bot_agenda_find_personal_action(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public._bot_agenda_is_list(text, text) from public, anon, authenticated;
revoke all on function public._bot_agenda_is_create(text, text) from public, anon, authenticated;
revoke all on function public._bot_agenda_is_postpone(text) from public, anon, authenticated;
revoke all on function public._bot_agenda_is_done(text) from public, anon, authenticated;
revoke all on function public._bot_agenda_is_cancel(text) from public, anon, authenticated;
revoke all on function public.bot_agenda_personal_create(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.bot_agenda_personal_postpone(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.bot_agenda_personal_mark(bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
