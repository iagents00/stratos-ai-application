-- 108: Despachador del Copilot de MARKETING (F3) — la ÚNICA tool que llama el agente
-- IA del flujo n8n duplicado (webhook copilot-marketing). Espejo del patrón
-- bot_nlu_dispatch_gvintell pero 100% separado: resuelve el perfil por
-- telegram_chat_id (real o sintético), exige rol marketing/super_admin/admin y
-- rutea a las fn_mkt_* (migración 107). Aditivo — el cerebro de asesores queda intacto.

create or replace function public.mkt_nlu_dispatch(
  p_telegram_chat_id bigint,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql as $$
declare
  v_profile record;
  v_due timestamptz; v_entrega date;
  v_reply text;
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

  -- fechas tolerantes (si el modelo manda algo raro, se ignora en vez de romper)
  begin v_due := nullif(p_args->>'due','')::timestamptz; exception when others then v_due := null; end;
  begin v_entrega := nullif(p_args->>'entrega','')::date; exception when others then v_entrega := null; end;

  case coalesce(p_tool_name,'')
    when 'my_day' then
      v_reply := fn_mkt_my_day(v_profile.id);
    when 'create_task' then
      v_reply := fn_mkt_create_task(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'assignee',''), v_due,
        nullif(p_args->>'brand',''), nullif(p_args->>'project',''));
    when 'move_pipeline' then
      v_reply := fn_mkt_move_pipeline(v_profile.id, p_args->>'nombre', p_args->>'etapa');
    when 'create_request' then
      v_reply := fn_mkt_create_request(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'brand',''),
        coalesce(nullif(p_args->>'complejidad',''),'A'), v_entrega,
        nullif(p_args->>'assignee',''), nullif(p_args->>'objetivo',''));
    when 'pipeline_summary' then
      v_reply := fn_mkt_pipeline_summary(v_profile.id);
    when 'person_pending' then
      v_reply := fn_mkt_person_pending(v_profile.id, p_args->>'nombre');
    else
      v_reply := 'Puedo ayudarte con: tu día (my_day), crear tareas (create_task), mover propiedades del pipeline (move_pipeline), solicitudes de diseño (create_request), resumen del pipeline (pipeline_summary) y pendientes de una persona (person_pending).';
  end case;

  return jsonb_build_object('ok', true, 'reply', coalesce(v_reply,'Listo.'));
exception when others then
  return jsonb_build_object('ok', false, 'reply',
    'Uy, algo falló procesando eso ('||sqlerrm||'). Probá decirlo de otra forma.');
end $$;
