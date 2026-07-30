-- El dictado por voz de hoy a las 10:38 (capturas de Ángel) salió BASURA no por
-- el especialista sino porque nunca le llegó: el clasificador envolvió el
-- dictado en `multi` con `actions[]`, y (1) el desvío de n8n solo atrapaba
-- `dictar_actividades` puro, (2) el candado por texto de la base secuestraba el
-- `multi` entero al splitter crudo, y (3) la base trataba `multi` como sinónimo
-- de create_team_actions y JAMÁS leía `actions[]` — el recordatorio «a mí
-- recuérdame en tres horas...» se TRAGÓ sin crear nada.
--
-- n8n ya quedó publicado (v8fc3c535): el IF atrapa multi-con-dictado, el
-- especialista recibe el texto crudo verbatim y Parse reconstruye el multi con
-- las tareas limpias. Esta migración es la mitad de la base:
--
-- A) `required_fields_orig`: un multi CON actions[] salta directo al _inner
--    (sin candados por texto sobre el mensaje completo — cada acción va a tener
--    sus propios candados al ejecutarse una por una).
-- B) `_inner`: ejecuta multi.actions UNA POR UNA re-entrando por la puerta
--    principal (bot_nlu_dispatch_gvintell), con lo cual cada acción pasa por
--    TODAS las capas de protección con SU PROPIO texto. Respuestas concatenadas
--    en una sola. Tope 5 acciones, multi anidado se ignora,
--    dictar_actividades se traduce a create_team_actions.
--
-- REVERTIR: quitar el bloque insertado en cada función (los anclajes quedan
-- intactos). Sin DDL, sin tocar datos.

do $do$
declare v_def text; v_anchor text; v_new text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bot_nlu_dispatch_gvintell_required_fields_orig';

  v_anchor := 'if v_tool not in (''add_expediente_note'',''add_expediente_voice'',''add_note_bulk'',';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla A aparece % veces - no toco nada.', v_cnt; end if;

  v_new := 'if v_tool in (''multi'',''multi_task'',''multi_action'',''multi_tarea'',''multiple_tasks'')' || chr(10)
        || '     and jsonb_typeof(v_args->''actions'') = ''array''' || chr(10)
        || '     and jsonb_array_length(v_args->''actions'') >= 1 then' || chr(10)
        || '    return public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, p_tool_name, p_args);' || chr(10)
        || '  end if;' || chr(10) || chr(10)
        || '  ' || v_anchor;
  execute replace(v_def, v_anchor, v_new);
end $do$;

do $do$
declare v_def text; v_anchor text; v_new text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bot_nlu_dispatch_gvintell_inner';

  v_anchor := 'select * into v_pend from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla B aparece % veces - no toco nada.', v_cnt; end if;

  v_new :=
    '-- mig 218: un multi del clasificador con actions[] se ejecuta accion por accion,' || chr(10)
 || '  -- re-entrando por la puerta principal para que cada una tenga sus candados.' || chr(10)
 || '  if v_tool in (''multi'',''multi_task'',''multi_action'',''multi_tarea'',''multiple_tasks'')' || chr(10)
 || '     and jsonb_typeof(v_args->''actions'') = ''array''' || chr(10)
 || '     and jsonb_array_length(v_args->''actions'') >= 1 then' || chr(10)
 || '    declare v_mx_a jsonb; v_mx_tool text; v_mx_sub jsonb; v_mx_txts text[] := ''{}'';' || chr(10)
 || '            v_mx_kb jsonb := ''[]''::jsonb; v_mx_ok boolean := true; v_mx_n int := 0;' || chr(10)
 || '    begin' || chr(10)
 || '      for v_mx_a in select value from jsonb_array_elements(v_args->''actions'') loop' || chr(10)
 || '        exit when v_mx_n >= 5;' || chr(10)
 || '        v_mx_tool := lower(coalesce(v_mx_a->>''tool_name'', v_mx_a->>''tool'', ''''));' || chr(10)
 || '        if v_mx_tool in ('''', ''multi'', ''multi_task'', ''multi_action'', ''multi_tarea'', ''multiple_tasks'') then continue; end if;' || chr(10)
 || '        if v_mx_tool = ''dictar_actividades'' then v_mx_tool := ''create_team_actions''; end if;' || chr(10)
 || '        v_mx_n := v_mx_n + 1;' || chr(10)
 || '        v_mx_sub := public.bot_nlu_dispatch_gvintell(p_telegram_chat_id, v_mx_tool, coalesce(v_mx_a->''args'', ''{}''::jsonb));' || chr(10)
 || '        if coalesce((v_mx_sub->>''ok'')::boolean, true) = false then v_mx_ok := false; end if;' || chr(10)
 || '        if nullif(btrim(coalesce(v_mx_sub#>>''{reply,text}'', '''')), '''') is not null then' || chr(10)
 || '          v_mx_txts := v_mx_txts || (v_mx_sub#>>''{reply,text}'');' || chr(10)
 || '        end if;' || chr(10)
 || '        if jsonb_typeof(v_mx_sub#>''{reply,inline_keyboard}'') = ''array''' || chr(10)
 || '           and jsonb_array_length(v_mx_sub#>''{reply,inline_keyboard}'') > 0' || chr(10)
 || '           and jsonb_array_length(v_mx_kb) = 0 then' || chr(10)
 || '          v_mx_kb := v_mx_sub#>''{reply,inline_keyboard}'';' || chr(10)
 || '        end if;' || chr(10)
 || '      end loop;' || chr(10)
 || '      if v_mx_n > 0 then' || chr(10)
 || '        return jsonb_build_object(''ok'', v_mx_ok, ''reply'', jsonb_build_object(' || chr(10)
 || '          ''text'', array_to_string(v_mx_txts, chr(10)||chr(10)), ''parse_mode'', null, ''inline_keyboard'', v_mx_kb));' || chr(10)
 || '      end if;' || chr(10)
 || '    end;' || chr(10)
 || '  end if;' || chr(10) || chr(10)
 || '  ' || v_anchor;
  execute replace(v_def, v_anchor, v_new);
end $do$;