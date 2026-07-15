-- 099_bot_required_dates_strict_time_hint.sql
-- Endurece 098: fecha/hora obligatoria significa fecha/hora real, no cualquier
-- string no vacio que el clasificador pueda poner por accidente.

create or replace function public._bot_has_datetime_hint(p_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_text, '') ~* (
    '(\d{1,2}:\d{2})'
    || '|(\d{1,2}\s*(am|pm|a\.?m\.?|p\.?m\.?))'
    || '|(\b(en|dentro de)\s+\d+\s*(min|mins|minuto|minutos|hora|horas|hr|hrs|h)\b)'
    || '|(\b(hoy|manana|mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*\b\d{1,2}\b)'
    || '|(\b\d{4}-\d{2}-\d{2}[ t]\d{1,2})'
    || '|(\b\d{1,2}\s+de\s+[[:alpha:]]+\b.*\b\d{1,2}\b)'
  );
$$;

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
  v_tool text := lower(coalesce(p_tool_name, ''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_stage text;
  v_zoom_when text;
  v_next_when text;
  v_has_next_action boolean;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then
      v_tool := lower(coalesce(v_args#>>'{query,tool_name}', ''));
    end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then
      v_args := v_args#>'{query,args}';
    end if;
  end if;

  v_stage := nullif(btrim(coalesce(v_args->>'stage', v_args->>'st', v_args->>'etapa', '')), '');

  v_zoom_when := concat_ws(' ',
    v_args->>'zoom_at',
    v_args->>'zoom_datetime',
    v_args->>'selected_time',
    v_args->>'fecha_zoom',
    v_args->>'next_action_at',
    v_args->>'next_action_date'
  );

  if v_stage = 'Zoom Agendado'
     and v_tool in ('change_stage', 'upsert_lead')
     and not public._bot_has_datetime_hint(v_zoom_when) then
    return jsonb_build_object(
      'ok', false,
      'needs_input', 'zoom_at',
      'reply', jsonb_build_object(
        'text', 'Perfecto. Para moverlo a Zoom Agendado necesito la fecha y hora exacta del Zoom. Ej: "mañana 5 pm" o "viernes 19 de julio 11 am".',
        'parse_mode', null,
        'inline_keyboard', '[]'::jsonb
      )
    );
  end if;

  v_has_next_action := nullif(btrim(coalesce(v_args->>'next_action', '')), '') is not null;
  v_next_when := concat_ws(' ',
    v_args->>'next_action_at',
    v_args->>'next_action_at_iso',
    v_args->>'next_action_date',
    v_args->>'when',
    v_args->>'due_at'
  );

  if v_tool in ('update_next_action', 'add_task')
     and v_has_next_action
     and not public._bot_has_datetime_hint(v_next_when) then
    return jsonb_build_object(
      'ok', false,
      'needs_input', 'next_action_at',
      'reply', jsonb_build_object(
        'text', 'Listo, entiendo la próxima acción. ¿Para qué fecha y hora la programo? Ej: "hoy 4:30 pm", "mañana 10 am" o "en 3 horas".',
        'parse_mode', null,
        'inline_keyboard', '[]'::jsonb
      )
    );
  end if;

  return public.bot_nlu_dispatch_gvintell_required_fields_orig(p_telegram_chat_id, p_tool_name, p_args);
end;
$$;

grant execute on function public._bot_has_datetime_hint(text) to service_role;
grant execute on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) to service_role;
revoke all on function public._bot_has_datetime_hint(text) from public, anon, authenticated;
revoke all on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) from public, anon, authenticated;

