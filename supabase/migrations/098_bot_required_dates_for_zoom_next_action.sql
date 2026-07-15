-- 098_bot_required_dates_for_zoom_next_action.sql
-- Guardrail compartido por Telegram y Copilot:
-- - Cambiar a "Zoom Agendado" exige fecha/hora del Zoom.
-- - Definir una proxima accion exige fecha/hora de seguimiento.
-- No modifica datos; solo evita que el router ejecute herramientas incompletas.

do $$
begin
  if to_regprocedure('public.bot_nlu_dispatch_gvintell_required_fields_orig(bigint,text,jsonb)') is null then
    alter function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb)
      rename to bot_nlu_dispatch_gvintell_required_fields_orig;
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
  v_tool text := lower(coalesce(p_tool_name, ''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_stage text;
  v_has_zoom_when boolean;
  v_has_next_when boolean;
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

  v_stage := nullif(btrim(coalesce(
    v_args->>'stage',
    v_args->>'st',
    v_args->>'etapa',
    ''
  )), '');

  v_has_zoom_when := (
    nullif(btrim(coalesce(v_args->>'zoom_at', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'zoom_datetime', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'selected_time', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'fecha_zoom', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'next_action_at', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'next_action_date', '')), '') is not null
  );

  if v_stage = 'Zoom Agendado' and v_tool in ('change_stage', 'upsert_lead') and not v_has_zoom_when then
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
  v_has_next_when := (
    nullif(btrim(coalesce(v_args->>'next_action_at', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'next_action_at_iso', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'next_action_date', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'when', '')), '') is not null
    or nullif(btrim(coalesce(v_args->>'due_at', '')), '') is not null
  );

  if v_tool in ('update_next_action', 'add_task') and v_has_next_action and not v_has_next_when then
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

grant execute on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) to service_role;
revoke all on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) from public, anon, authenticated;

