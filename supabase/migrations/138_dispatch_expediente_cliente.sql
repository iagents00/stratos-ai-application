-- Suma al despachador del Copilot las herramientas del expediente de cliente.
-- ADITIVO: los casos anteriores quedan idénticos (marketing/Duke no cambia).
CREATE OR REPLACE FUNCTION public.mkt_nlu_dispatch(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_profile record;
  v_due timestamptz; v_entrega date;
  v_reply text; v_cat jsonb;
begin
  select id, name, role, organization_id into v_profile
  from profiles where telegram_chat_id = p_telegram_chat_id limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply',
      'No encontré tu usuario. Entrá al CRM una vez para activar tu identidad y volvé a intentar.');
  end if;
  if v_profile.role not in ('marketing','super_admin','admin') then
    return jsonb_build_object('ok', false, 'reply',
      'Este asistente es del equipo de marketing. Tu usuario no tiene ese rol.');
  end if;

  begin v_due := nullif(p_args->>'due','')::timestamptz; exception when others then v_due := null; end;
  begin v_entrega := nullif(p_args->>'entrega','')::date; exception when others then v_entrega := null; end;

  case coalesce(p_tool_name,'')
    when 'my_day' then
      v_reply := fn_mkt_my_day(v_profile.id);
    when 'create_task' then
      v_reply := fn_mkt_create_task(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'assignee',''), v_due,
        nullif(p_args->>'brand',''), nullif(p_args->>'project',''));
    when 'complete_task' then
      v_reply := fn_mkt_complete_task(v_profile.id, p_args->>'titulo');
    when 'start_task' then
      v_reply := fn_mkt_start_task(v_profile.id, p_args->>'titulo');
    when 'postpone_task' then
      v_reply := fn_mkt_postpone_task(v_profile.id, p_args->>'titulo', nullif(p_args->>'cuando',''));
    when 'move_pipeline' then
      v_reply := fn_mkt_move_pipeline(v_profile.id, p_args->>'nombre', p_args->>'etapa');
    when 'create_request' then
      v_reply := fn_mkt_create_request(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'brand',''),
        coalesce(nullif(p_args->>'complejidad',''),'A'), v_entrega,
        nullif(p_args->>'assignee',''), nullif(p_args->>'objetivo',''));
      if nullif(p_args->>'assignee','') is null and v_reply like '✓%' then
        v_reply := v_reply || ' Quedó sin responsable — cuando decidas, dime «asígnasela a …».';
      end if;
    when 'assign_request' then
      v_reply := fn_mkt_assign_request(v_profile.id, p_args->>'titulo', p_args->>'assignee');
    when 'pipeline_summary' then
      v_reply := fn_mkt_pipeline_summary(v_profile.id);
    when 'person_pending' then
      v_reply := fn_mkt_person_pending(v_profile.id, p_args->>'nombre');
    when 'buscar_drive' then
      v_cat := bot_buscar_proyectos(p_telegram_chat_id, jsonb_build_object('query', coalesce(p_args->>'query','')));
      v_reply := coalesce(v_cat->'reply'->>'text', v_cat->>'reply', 'No encontré resultados en el catálogo.');
      v_reply := regexp_replace(v_reply, '[🏗️🏢📁🏠🌊⭐✨🔑💎🌴]+\s?', '', 'g');
    -- proyectos + eliminar/restaurar (25-jul)
    when 'create_project' then
      v_reply := fn_mkt_create_project(v_profile.id, p_args->>'nombre',
        nullif(p_args->>'descripcion',''), v_entrega, nullif(p_args->>'brand',''));
    when 'list_projects' then
      v_reply := fn_mkt_list_projects(v_profile.id);
    when 'delete_project' then
      v_reply := fn_mkt_delete_project(v_profile.id, p_args->>'nombre',
        coalesce((p_args->>'confirm')::boolean, false));
    when 'restore_project' then
      v_reply := fn_mkt_restore_project(v_profile.id, p_args->>'nombre');
    when 'delete_task' then
      v_reply := fn_mkt_delete_task(v_profile.id, p_args->>'titulo');
    when 'restore_task' then
      v_reply := fn_mkt_restore_task(v_profile.id, p_args->>'titulo');
    -- ── NUEVO (27-jul): expediente del cliente — objetivos, progreso y avances ──
    when 'client_add' then
      v_reply := fn_client_add(v_profile.id, p_args->>'nombre', nullif(p_args->>'etapa',''));
    when 'client_status' then
      v_reply := fn_client_status(v_profile.id, p_args->>'cliente');
    when 'clients_overview' then
      v_reply := fn_clients_overview(v_profile.id);
    when 'client_set_objective' then
      v_reply := fn_client_set_objective(v_profile.id, p_args->>'cliente', p_args->>'titulo',
        coalesce(nullif(p_args->>'meta','')::numeric, 100), nullif(p_args->>'unidad',''), v_entrega);
    when 'client_progress' then
      v_reply := fn_client_progress(v_profile.id, p_args->>'cliente', nullif(p_args->>'titulo',''),
        coalesce(nullif(p_args->>'actual','')::numeric, 0));
    when 'client_log' then
      v_reply := fn_client_log(v_profile.id, p_args->>'cliente', p_args->>'texto', nullif(p_args->>'tipo',''));
    else
      v_reply := 'Puedo ayudarte con: tu día, crear tareas, avisar que empezaste ("ya empecé…"), completarlas ("ya terminé…"), posponerlas, eliminarlas, crear/listar/archivar proyectos, el expediente de un cliente (objetivos, progreso y avances), mover propiedades del pipeline, solicitudes de diseño, resumen del pipeline, pendientes de una persona y buscar el drive de una propiedad.';
  end case;

  return jsonb_build_object('ok', true, 'reply', coalesce(v_reply,'Listo.'));
exception when others then
  return jsonb_build_object('ok', false, 'reply',
    'Uy, algo falló procesando eso ('||sqlerrm||'). Probá decirlo de otra forma.');
end $function$;;
