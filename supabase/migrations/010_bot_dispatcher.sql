-- ============================================================================
-- 010_bot_dispatcher.sql
--
-- Las dos funciones maestras del bot:
--
--   1) bot_nlu_dispatch(chat_id, tool_name, args)
--      Una supertool que el AI Agent llama desde n8n. Despacha al RPC correcto
--      según tool_name, envuelve la respuesta en el sobre estándar.
--      Para writes, en lugar de ejecutar, crea un bot_pending_actions y devuelve
--      la confirmación con botones [Sí][Cancelar].
--
--   2) bot_handle_callback(chat_id, callback_data, message_id)
--      Recibe los tap de botones desde Telegram. Valida HMAC, parsea la acción,
--      ejecuta la RPC correspondiente directo (sin IA), devuelve el sobre.
--
-- Estas dos funciones son el corazón del bot: n8n solo tiene que llamar una
-- de ellas según el tipo de update (message vs callback_query) y reenviar la
-- respuesta a Telegram.
-- ============================================================================

set search_path = public;

-- ----------------------------------------------------------------------------
-- Helper: registra una acción pendiente y devuelve sobre con botones de confirm.
-- ----------------------------------------------------------------------------
create or replace function public._bot_stage_action(
  p_telegram_chat_id bigint,
  p_action_type text,
  p_payload jsonb,
  p_summary text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_asesor jsonb; v_token text;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return public._bot_err_envelope(jsonb_build_object('error','not_paired'));
  end if;

  -- token corto, único, en base36 (8 chars son suficientes y caben en callback_data)
  v_token := substr(md5(gen_random_uuid()::text || now()::text), 1, 10);

  insert into public.bot_pending_actions(
    token, asesor_id, organization_id, telegram_chat_id,
    action_type, payload, summary,
    expires_at
  )
  values(
    v_token,
    (v_asesor->>'profile_id')::uuid,
    (v_asesor->>'organization_id')::uuid,
    p_telegram_chat_id,
    p_action_type,
    coalesce(p_payload, '{}'::jsonb),
    p_summary,
    now() + interval '10 minutes'
  );

  return jsonb_build_object(
    'ok', true,
    'staged', true,
    'token', v_token,
    'reply', jsonb_build_object(
      'text', p_summary || E'\n\n¿Confirmas?',
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_confirm(v_token)
    )
  );
end;
$$;
grant execute on function public._bot_stage_action(bigint, text, jsonb, text) to service_role;

-- ----------------------------------------------------------------------------
-- Helper: ejecuta una acción confirmada (por callback "confirm:<token>:...")
-- ----------------------------------------------------------------------------
create or replace function public._bot_execute_pending(
  p_telegram_chat_id bigint,
  p_token text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.bot_pending_actions;
  v_inner jsonb;
  v_phone text;
begin
  select * into v_row from public.bot_pending_actions
   where token = p_token
     and telegram_chat_id = p_telegram_chat_id
     and consumed_at is null
   limit 1;

  if v_row.id is null then
    return jsonb_build_object(
      'ok', false, 'code','pending_not_found',
      'reply', jsonb_build_object(
        'text','Esta confirmación venció o ya se procesó.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  end if;

  if v_row.expires_at < now() then
    update public.bot_pending_actions set consumed_at = now() where id = v_row.id;
    return jsonb_build_object(
      'ok', false, 'code','pending_expired',
      'reply', jsonb_build_object(
        'text','Esta confirmación venció. Vuelve a pedirlo.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  end if;

  -- Marca como consumida ANTES de ejecutar (evita doble-tap)
  update public.bot_pending_actions set consumed_at = now() where id = v_row.id;

  v_phone := v_row.payload->>'phone';

  -- Despacha según action_type
  case v_row.action_type
    when 'upsert_lead' then
      v_inner := public.bot_upsert_lead(
        p_telegram_chat_id,
        v_phone,
        v_row.payload->>'name',
        v_row.payload->>'email',
        v_row.payload->>'stage',
        v_row.payload->>'budget_text',
        nullif(v_row.payload->>'budget_numeric','')::bigint,
        v_row.payload->>'project',
        v_row.payload->>'campaign',
        v_row.payload->>'bio',
        nullif(v_row.payload->>'score','')::integer,
        nullif(v_row.payload->>'hot','')::boolean,
        v_row.payload->>'next_action',
        nullif(v_row.payload->>'next_action_at','')::timestamptz
      );

    when 'update_fields' then
      v_inner := public.bot_update_lead_fields(
        p_telegram_chat_id,
        v_phone,
        v_row.payload->>'name',
        v_row.payload->>'email',
        v_row.payload->>'stage',
        v_row.payload->>'budget_text',
        nullif(v_row.payload->>'budget_numeric','')::bigint,
        v_row.payload->>'project',
        v_row.payload->>'campaign',
        v_row.payload->>'bio',
        nullif(v_row.payload->>'score','')::integer,
        nullif(v_row.payload->>'hot','')::boolean,
        v_row.payload->>'next_action',
        nullif(v_row.payload->>'next_action_at','')::timestamptz,
        v_row.payload->>'new_asesor_name'
      );

    when 'add_seguimiento' then
      v_inner := public.bot_add_seguimiento(
        p_telegram_chat_id, v_phone,
        v_row.payload->>'tipo', v_row.payload->>'resumen'
      );

    when 'add_comunicacion' then
      v_inner := public.bot_add_comunicacion(
        p_telegram_chat_id, v_phone,
        v_row.payload->>'tipo',
        v_row.payload->>'resumen',
        v_row.payload->>'transcripcion',
        nullif(v_row.payload->>'ocurrio_en','')::timestamptz,
        nullif(v_row.payload->>'duracion_seg','')::integer
      );

    when 'add_expediente_note' then
      v_inner := public.bot_add_expediente_note(
        p_telegram_chat_id, v_phone,
        v_row.payload->>'titulo',
        v_row.payload->>'contenido',
        coalesce(v_row.payload->>'source','telegram')
      );

    when 'add_expediente_voice' then
      v_inner := public.bot_add_expediente_voice(
        p_telegram_chat_id, v_phone,
        v_row.payload->>'titulo',
        v_row.payload->>'transcripcion',
        nullif(v_row.payload->>'duracion_seg','')::integer,
        v_row.payload->>'storage_path'
      );

    when 'add_task' then
      v_inner := public.bot_add_task(
        p_telegram_chat_id, v_phone,
        v_row.payload->>'text',
        nullif(v_row.payload->>'due_at','')::timestamptz,
        v_row.payload->>'priority'
      );

    when 'set_ai_agent' then
      v_inner := public.bot_set_ai_agent(
        p_telegram_chat_id, v_phone, v_row.payload->>'agent_key'
      );

    when 'create_deal' then
      v_inner := public.bot_create_deal(
        p_telegram_chat_id, v_phone,
        nullif(v_row.payload->>'amount','')::bigint,
        coalesce(v_row.payload->>'currency','USD'),
        nullif(v_row.payload->>'project_unit_id','')::uuid,
        nullif(v_row.payload->>'signed_at','')::timestamptz,
        v_row.payload->>'notes'
      );

    when 'soft_delete' then
      v_inner := public.bot_soft_delete_lead(
        p_telegram_chat_id, v_phone, v_row.payload->>'reason'
      );

    else
      return jsonb_build_object(
        'ok', false, 'code','unknown_action_type',
        'reply', jsonb_build_object(
          'text','Acción desconocida: ' || v_row.action_type,
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );
  end case;

  -- Si la RPC original devolvió error, propaga el sobre de error
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  -- Éxito → mensaje de "Listo" + botón a ver el lead que se tocó
  return jsonb_build_object(
    'ok', true,
    'data', v_inner,
    'reply', jsonb_build_object(
      'text', 'Listo. ' || v_row.summary,
      'parse_mode', null,
      'inline_keyboard', case
        when v_phone is not null
        then jsonb_build_array(jsonb_build_array(
          public._bot_btn('Ver ficha', 'view', regexp_replace(v_phone,'[^0-9]','','g')),
          public._bot_btn('← Menú', 'menu', '_')
        ))
        else public._bot_kb_back()
      end
    )
  );
end;
$$;
grant execute on function public._bot_execute_pending(bigint, text) to service_role;

-- ----------------------------------------------------------------------------
-- BOT_NLU_DISPATCH — supertool que llama el AI Agent
-- ----------------------------------------------------------------------------
-- El AI Agent recibe el mensaje del asesor, decide tool_name y args, y llama
-- esta función UNA sola vez. La función decide:
--   - Si es read → ejecuta y devuelve sobre con texto + botones contextuales.
--   - Si es write → llama _bot_stage_action y devuelve confirmación.
--
-- tool_name válidos:
--   reads:  list_pending, dashboard, view_lead, quick_search, pipeline_summary,
--           list_expediente, lead_history, list_tasks, menu
--   writes: upsert_lead, update_fields, add_seguimiento, add_comunicacion,
--           add_expediente_note, add_expediente_voice, add_task, set_ai_agent,
--           pin_lead, create_deal, soft_delete, complete_task
-- ----------------------------------------------------------------------------
create or replace function public.bot_nlu_dispatch(
  p_telegram_chat_id bigint,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_inner jsonb;
  v_summary_parts text[];
  v_summary text;
begin
  v_phone := p_args->>'phone';

  case p_tool_name
    -- ----- READS (sin confirmación) -----
    when 'menu' then
      return public.bot_render_menu();
    when 'list_pending' then
      return public.bot_list_pending_v2(p_telegram_chat_id, coalesce(nullif(p_args->>'window_hours','')::int, 24));
    when 'dashboard' then
      return public.bot_get_dashboard_stats_v2(p_telegram_chat_id, coalesce(p_args->>'scope','me'));
    when 'view_lead' then
      return public.bot_view_lead_v2(p_telegram_chat_id, v_phone);
    when 'quick_search' then
      return public.bot_quick_search_v2(p_telegram_chat_id, p_args->>'query');
    when 'pipeline_summary' then
      return public.bot_list_pipeline_summary_v2(p_telegram_chat_id);
    when 'list_expediente' then
      return public.bot_list_expediente_v2(p_telegram_chat_id, v_phone);
    when 'lead_history' then
      return public.bot_get_lead_history_v2(p_telegram_chat_id, v_phone);
    when 'list_tasks' then
      return public.bot_list_tasks_v2(p_telegram_chat_id, v_phone);

    -- ----- WRITES (vía staging + confirmación) -----
    when 'upsert_lead' then
      v_summary_parts := array['Voy a registrar:'];
      v_summary_parts := v_summary_parts || ('· ' || coalesce(p_args->>'name','(sin nombre)') ||
                                             ' · ' || public._bot_fmt_phone(v_phone));
      if coalesce(p_args->>'project','') <> '' then
        v_summary_parts := v_summary_parts || ('· proyecto ' || (p_args->>'project'));
      end if;
      if (p_args->>'budget_numeric') is not null then
        v_summary_parts := v_summary_parts || ('· ' || public._bot_fmt_money(nullif(p_args->>'budget_numeric','')::bigint));
      end if;
      if coalesce(p_args->>'campaign','') <> '' then
        v_summary_parts := v_summary_parts || ('· campaña ' || (p_args->>'campaign'));
      end if;
      if coalesce(p_args->>'stage','') <> '' then
        v_summary_parts := v_summary_parts || ('· etapa ' || (p_args->>'stage'));
      end if;
      if coalesce(p_args->>'next_action','') <> '' then
        v_summary_parts := v_summary_parts || ('· próxima: ' || (p_args->>'next_action') ||
          case when (p_args->>'next_action_at') is not null
               then ' (' || public._bot_fmt_when(nullif(p_args->>'next_action_at','')::timestamptz) || ')'
               else '' end);
      end if;
      v_summary := array_to_string(v_summary_parts, E'\n');
      return public._bot_stage_action(p_telegram_chat_id, 'upsert_lead', p_args, v_summary);

    when 'update_fields' then
      v_summary_parts := array['Voy a actualizar ' || coalesce(p_args->>'name', public._bot_fmt_phone(v_phone)) || ':'];
      if coalesce(p_args->>'stage','') <> '' then
        v_summary_parts := v_summary_parts || ('· etapa → ' || (p_args->>'stage'));
      end if;
      if coalesce(p_args->>'next_action','') <> '' then
        v_summary_parts := v_summary_parts || ('· próxima: ' || (p_args->>'next_action') ||
          case when (p_args->>'next_action_at') is not null
               then ' (' || public._bot_fmt_when(nullif(p_args->>'next_action_at','')::timestamptz) || ')'
               else '' end);
      end if;
      if (p_args->>'hot') is not null then
        v_summary_parts := v_summary_parts || ('· caliente: ' || (p_args->>'hot'));
      end if;
      if (p_args->>'score') is not null then
        v_summary_parts := v_summary_parts || ('· score: ' || (p_args->>'score'));
      end if;
      if coalesce(p_args->>'new_asesor_name','') <> '' then
        v_summary_parts := v_summary_parts || ('· reasignar a: ' || (p_args->>'new_asesor_name'));
      end if;
      v_summary := array_to_string(v_summary_parts, E'\n');
      return public._bot_stage_action(p_telegram_chat_id, 'update_fields', p_args, v_summary);

    when 'add_seguimiento' then
      v_summary := 'Voy a registrar seguimiento (' || coalesce(p_args->>'tipo','nota') || ') en ' ||
                   public._bot_fmt_phone(v_phone) ||
                   case when coalesce(p_args->>'resumen','') <> ''
                        then E'\n· ' || (p_args->>'resumen') else '' end;
      return public._bot_stage_action(p_telegram_chat_id, 'add_seguimiento', p_args, v_summary);

    when 'add_comunicacion' then
      v_summary := 'Voy a registrar comunicación (' || coalesce(p_args->>'tipo','nota') || ') en ' ||
                   public._bot_fmt_phone(v_phone) ||
                   case when coalesce(p_args->>'resumen','') <> ''
                        then E'\n· ' || (p_args->>'resumen') else '' end ||
                   case when coalesce(p_args->>'duracion_seg','') <> ''
                        then E'\n· duración ' || (p_args->>'duracion_seg') || 's' else '' end;
      return public._bot_stage_action(p_telegram_chat_id, 'add_comunicacion', p_args, v_summary);

    when 'add_expediente_note' then
      v_summary := 'Voy a agregar al expediente de ' || public._bot_fmt_phone(v_phone) || ':' ||
                   E'\n· ' || substring(coalesce(p_args->>'contenido',''), 1, 200);
      return public._bot_stage_action(p_telegram_chat_id, 'add_expediente_note', p_args, v_summary);

    when 'add_expediente_voice' then
      v_summary := 'Voy a guardar la nota de voz en ' || public._bot_fmt_phone(v_phone) || ':' ||
                   E'\n· ' || substring(coalesce(p_args->>'transcripcion',''), 1, 200);
      return public._bot_stage_action(p_telegram_chat_id, 'add_expediente_voice', p_args, v_summary);

    when 'add_task' then
      v_summary := 'Voy a crear tarea para ' || public._bot_fmt_phone(v_phone) || ':' ||
                   E'\n· ' || coalesce(p_args->>'text','(sin texto)') ||
                   case when (p_args->>'due_at') is not null
                        then E'\n· vence ' || public._bot_fmt_when(nullif(p_args->>'due_at','')::timestamptz)
                        else '' end;
      return public._bot_stage_action(p_telegram_chat_id, 'add_task', p_args, v_summary);

    when 'set_ai_agent' then
      v_summary := case when coalesce(p_args->>'agent_key','') = '' or p_args->>'agent_key' = 'none'
                        then 'Voy a quitar el agente IA de ' || public._bot_fmt_phone(v_phone)
                        else 'Voy a asignar el agente "' || (p_args->>'agent_key') || '" a ' || public._bot_fmt_phone(v_phone) end;
      return public._bot_stage_action(p_telegram_chat_id, 'set_ai_agent', p_args, v_summary);

    when 'create_deal' then
      v_summary := 'Voy a registrar venta cerrada con ' || public._bot_fmt_phone(v_phone) || ':' ||
                   E'\n· monto ' || public._bot_fmt_money(nullif(p_args->>'amount','')::bigint, coalesce(p_args->>'currency','USD')) ||
                   case when (p_args->>'signed_at') is not null
                        then E'\n· firmado ' || public._bot_fmt_when(nullif(p_args->>'signed_at','')::timestamptz)
                        else '' end;
      return public._bot_stage_action(p_telegram_chat_id, 'create_deal', p_args, v_summary);

    when 'soft_delete' then
      v_summary := 'Voy a enviar a papelera el cliente ' || public._bot_fmt_phone(v_phone) || '.' ||
                   E'\nMotivo: ' || coalesce(p_args->>'reason','(sin motivo)') ||
                   E'\n(Se puede recuperar desde el web.)';
      return public._bot_stage_action(p_telegram_chat_id, 'soft_delete', p_args, v_summary);

    -- ----- ACCIONES SIN CONFIRMACIÓN (idempotentes/inmediatas) -----
    when 'pin_lead' then
      v_inner := public.bot_pin_lead(
        p_telegram_chat_id, v_phone,
        coalesce(nullif(p_args->>'pinned','')::boolean, true)
      );
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', case when coalesce(nullif(p_args->>'pinned','')::boolean, true)
                       then 'Pineado. ' || (v_inner->>'lead_name') || ' está ahora en tus prioridades.'
                       else 'Quitado de prioridades.' end,
          'parse_mode', null,
          'inline_keyboard', jsonb_build_array(jsonb_build_array(
            public._bot_btn('Ver ficha', 'view', regexp_replace(v_phone,'[^0-9]','','g')),
            public._bot_btn('← Menú', 'menu', '_')
          ))
        )
      );

    when 'complete_task' then
      v_inner := public.bot_complete_task(p_telegram_chat_id, nullif(p_args->>'task_id','')::uuid);
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', 'Tarea completada.',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    -- ----- STUB FASE 2 (imágenes del UI) -----
    when 'image' then
      v_inner := public.bot_get_dashboard_stats(p_telegram_chat_id, 'me');
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Captura del UI llegará pronto. Mientras tanto:' || E'\n' ||
                  '· activos: ' || coalesce(v_inner->>'active','0') ||
                  ' · calientes: ' || coalesce(v_inner->>'hot','0') ||
                  ' · pipeline: ' || public._bot_fmt_money(coalesce(nullif(v_inner->>'pipeline_value','')::bigint, 0)),
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    else
      return jsonb_build_object(
        'ok', false, 'code','unknown_tool',
        'reply', jsonb_build_object(
          'text', 'No conozco esa acción: ' || coalesce(p_tool_name,'(nula)'),
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );
  end case;
end;
$$;
grant execute on function public.bot_nlu_dispatch(bigint, text, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- BOT_HANDLE_CALLBACK — entry point para los tap de botones
-- ----------------------------------------------------------------------------
create or replace function public.bot_handle_callback(
  p_telegram_chat_id bigint,
  p_callback_data text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_verify jsonb;
  v_action text;
  v_payload text;
  v_parts text[];
  v_phone text;
  v_inner jsonb;
begin
  v_verify := public._bot_cb_verify(p_callback_data);
  if not (v_verify->>'valid')::boolean then
    return jsonb_build_object(
      'ok', false, 'code','invalid_signature',
      'reply', jsonb_build_object(
        'text', 'Acción expirada. Pídela de nuevo.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  end if;

  v_action  := v_verify->>'action';
  v_payload := v_verify->>'payload';
  v_parts   := string_to_array(coalesce(v_payload,''), ':');

  case v_action
    when 'menu' then
      return public.bot_render_menu();

    when 'view' then
      v_phone := v_parts[1];
      return public.bot_view_lead_v2(p_telegram_chat_id, v_phone);

    when 'pending' then
      return public.bot_list_pending_v2(p_telegram_chat_id, 24);

    when 'kpi' then
      return public.bot_get_dashboard_stats_v2(p_telegram_chat_id, coalesce(v_parts[1],'me'));

    when 'pipeline' then
      return public.bot_list_pipeline_summary_v2(p_telegram_chat_id);

    when 'list' then
      -- Por ahora "Mis clientes" devuelve los pendientes del asesor
      return public.bot_list_pending_v2(p_telegram_chat_id, 168);

    when 'searchprompt' then
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Escríbeme nombre, email o parte del teléfono.',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    when 'expediente' then
      v_phone := v_parts[1];
      return public.bot_list_expediente_v2(p_telegram_chat_id, v_phone);

    when 'history' then
      v_phone := v_parts[1];
      return public.bot_get_lead_history_v2(p_telegram_chat_id, v_phone);

    when 'stagepick' then
      v_phone := v_parts[1];
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Selecciona la nueva etapa:',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_stage_picker(v_phone)
        )
      );

    when 'stage' then
      -- "stage:<phone>:<slug>" — payload tiene 2 partes
      v_phone := v_parts[1];
      v_inner := public.bot_update_lead_fields(
        p_telegram_chat_id, v_phone,
        null, null, public._bot_stage_from_slug(v_parts[2]),
        null, null, null, null, null, null, null, null, null, null
      );
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', 'Actualizado. Etapa → ' || public._bot_stage_from_slug(v_parts[2]) || '.',
          'parse_mode', null,
          'inline_keyboard', jsonb_build_array(jsonb_build_array(
            public._bot_btn('Ver ficha', 'view', v_phone),
            public._bot_btn('← Menú', 'menu', '_')
          ))
        )
      );

    when 'nextpick' then
      v_phone := v_parts[1];
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Escríbeme la próxima acción y cuándo. Ej: "Llamarlo mañana 11am".',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    when 'taskprompt' then
      v_phone := v_parts[1];
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Escríbeme la tarea y cuándo vence. Ej: "Enviar propuesta el viernes 10am".',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    when 'taskdone' then
      v_inner := public.bot_complete_task(p_telegram_chat_id, v_parts[1]::uuid);
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', 'Tarea completada.',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    when 'agentpick' then
      v_phone := v_parts[1];
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Selecciona el agente IA para este cliente:',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_agent_picker(v_phone)
        )
      );

    when 'agent' then
      v_phone := v_parts[1];
      v_inner := public.bot_set_ai_agent(
        p_telegram_chat_id, v_phone,
        case when v_parts[2] = 'none' then null else v_parts[2] end
      );
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', case when v_parts[2] = 'none'
                       then 'Agente IA quitado.'
                       else 'Agente IA: ' || v_parts[2] || '.' end,
          'parse_mode', null,
          'inline_keyboard', jsonb_build_array(jsonb_build_array(
            public._bot_btn('Ver ficha', 'view', v_phone),
            public._bot_btn('← Menú', 'menu', '_')
          ))
        )
      );

    when 'pin' then
      v_phone := v_parts[1];
      v_inner := public.bot_pin_lead(
        p_telegram_chat_id, v_phone,
        coalesce(v_parts[2],'1') = '1'
      );
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      return jsonb_build_object(
        'ok', true, 'data', v_inner,
        'reply', jsonb_build_object(
          'text', case when coalesce(v_parts[2],'1') = '1'
                       then 'Pineado.' else 'Quitado de prioridades.' end,
          'parse_mode', null,
          'inline_keyboard', jsonb_build_array(jsonb_build_array(
            public._bot_btn('Ver ficha', 'view', v_phone),
            public._bot_btn('← Menú', 'menu', '_')
          ))
        )
      );

    when 'confirm' then
      return public._bot_execute_pending(p_telegram_chat_id, v_parts[1]);

    when 'cancel' then
      update public.bot_pending_actions
         set consumed_at = now()
       where token = v_parts[1] and telegram_chat_id = p_telegram_chat_id;
      return jsonb_build_object(
        'ok', true,
        'reply', jsonb_build_object(
          'text', 'Cancelado.',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );

    else
      return jsonb_build_object(
        'ok', false, 'code','unknown_callback_action',
        'reply', jsonb_build_object(
          'text', 'Acción no reconocida.',
          'parse_mode', null,
          'inline_keyboard', public._bot_kb_back()
        )
      );
  end case;
end;
$$;
grant execute on function public.bot_handle_callback(bigint, text) to service_role;

-- ----------------------------------------------------------------------------
-- HELPER: rate limit chequeo (llamado por n8n antes de cada interacción)
-- ----------------------------------------------------------------------------
create or replace function public.bot_check_rate_limit(p_telegram_chat_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.bot_rate_limit; v_max int := 30;
begin
  select * into v_row from public.bot_rate_limit where telegram_chat_id = p_telegram_chat_id;
  if v_row.telegram_chat_id is null then
    insert into public.bot_rate_limit(telegram_chat_id, count, window_start)
    values (p_telegram_chat_id, 1, now());
    return jsonb_build_object('ok', true);
  end if;
  if v_row.window_start < now() - interval '1 minute' then
    update public.bot_rate_limit
       set count = 1, window_start = now()
     where telegram_chat_id = p_telegram_chat_id;
    return jsonb_build_object('ok', true);
  end if;
  if v_row.count >= v_max then
    return jsonb_build_object('ok', false, 'code','rate_limited',
      'reply', jsonb_build_object(
        'text','Estás escribiendo muy rápido. Dame un momento.',
        'parse_mode', null, 'inline_keyboard', jsonb_build_array()
      ));
  end if;
  update public.bot_rate_limit
     set count = count + 1
   where telegram_chat_id = p_telegram_chat_id;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.bot_check_rate_limit(bigint) to service_role;

-- ----------------------------------------------------------------------------
-- FIN DE LA MIGRACIÓN 010
-- ----------------------------------------------------------------------------
-- Funciones expuestas tras esta migración:
--   _bot_stage_action(chat_id, action_type, payload, summary)
--   _bot_execute_pending(chat_id, token)
--   bot_nlu_dispatch(chat_id, tool_name, args)
--   bot_handle_callback(chat_id, callback_data)
--   bot_check_rate_limit(chat_id)
--
-- El bot v5 en n8n SOLO necesita llamar:
--   - bot_nlu_dispatch   (cuando es un mensaje normal procesado por el AI Agent)
--   - bot_handle_callback (cuando es un callback_query)
--   - bot_check_rate_limit (anti-flood, opcional)
-- Toda la lógica de presentación, confirmación y dispatch vive aquí.
-- ============================================================================
