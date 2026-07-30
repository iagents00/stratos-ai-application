-- mig 223 — El candado de pendientes ya no se come las respuestas del jefe.
-- Evidencia (prueba de Ángel 30-jul 12:49-12:54, ejecuciones 1232143/1232152/1232164):
--   (1) «Para asesor prueba» respondía la pregunta «¿Para quién?» y el candado lo leyó
--       como CANCELAR: la palabra «para» (de «¡para!») está en la lista de cancelación
--       y choca con la preposición más común del español — hasta «para todos» cancelaba.
--   (2) El else del candado BORRABA el plan pendiente ante cualquier texto ajeno: el
--       propio multi (dictado + recordatorio) borró su plan al ejecutar el recordatorio,
--       y la respuesta con la fecha 35 s después ya no encontró nada.
--   (3) El payload estructurado del intérprete (create_team_actions interpreted+tareas)
--       también caía en el candado de texto en vez de reemplazar el plan.
--   (4) El iterador del multi re-entra por la puerta principal y cada sub-acción
--       logueaba su turno user+ai → burbujas fantasma («Revisar el sistema» que nadie
--       escribió) y el chat desordenado.
-- Qué cambia (solo bot_nlu_dispatch_gvintell_inner, por reemplazos anclados):
--   a) sub-llamadas del multi llevan _sub:true y NO loguean turno (el front loguea el real);
--   b) payload interpreted+tareas pasa de largo el candado (el manejo del tool borra y
--      re-crea el pendiente él mismo);
--   c) plan de equipo con más de 30 min se descarta solo (TTL);
--   d) «para» sale de la lista de cancelar;
--   e) pendiente team_plan + «para X» → asigna responsable vía bot_corregir_plan (determinista);
--   f) el else ya NO borra un team_plan (solo muere por «no», TTL o reemplazo); las
--      confirmaciones destructivas (delete de un lead) sí se siguen descartando al cambiar de tema.
-- Revertir: correr este mismo patrón con los textos invertidos (los anclajes quedan acá),
-- o restaurar el cuerpo anterior desde el backup diario del cerebro.

do $mig$
declare
  v_src text;
  v_new text;
  v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bot_nlu_dispatch_gvintell_inner';

  -- a) _sub en las sub-llamadas del iterador
  v_cnt := (length(v_src) - length(replace(v_src,
    'v_mx_sub := public.bot_nlu_dispatch_gvintell(p_telegram_chat_id, v_mx_tool, coalesce(v_mx_a->''args'', ''{}''::jsonb));', '')))
    / length('v_mx_sub := public.bot_nlu_dispatch_gvintell(p_telegram_chat_id, v_mx_tool, coalesce(v_mx_a->''args'', ''{}''::jsonb));');
  if v_cnt <> 1 then raise exception 'ancla a) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_src,
    'v_mx_sub := public.bot_nlu_dispatch_gvintell(p_telegram_chat_id, v_mx_tool, coalesce(v_mx_a->''args'', ''{}''::jsonb));',
    'v_mx_sub := public.bot_nlu_dispatch_gvintell(p_telegram_chat_id, v_mx_tool, coalesce(v_mx_a->''args'', ''{}''::jsonb) || jsonb_build_object(''_sub'', true));');

  -- b)+c) cabeza del candado: bypass estructurado + TTL 30 min
  v_cnt := (length(v_new) - length(replace(v_new,
    'if found then
    if v_norm ~ ''^\s*(si|claro|dale|ok|okey|okay|confirmo', '')))
    / length('if found then
    if v_norm ~ ''^\s*(si|claro|dale|ok|okey|okay|confirmo');
  if v_cnt <> 1 then raise exception 'ancla b) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_new,
    'if found then
    if v_norm ~ ''^\s*(si|claro|dale|ok|okey|okay|confirmo',
    'if found then
    if v_tool in (''create_team_actions'',''dictar_actividades'')
       and coalesce((v_args->>''interpreted'')::boolean, false)
       and jsonb_typeof(v_args->''tareas'') = ''array'' then
      null;  -- mig 223: pedido estructurado del intérprete — reemplaza el plan más abajo, no pasa por el candado de texto
    elsif v_pend.action = ''team_plan'' and v_pend.created_at < now() - interval ''30 minutes'' then
      delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;  -- mig 223: plan viejo, se descarta
    elsif v_norm ~ ''^\s*(si|claro|dale|ok|okey|okay|confirmo');

  -- d) «para» fuera de la lista de cancelar
  v_cnt := (length(v_new) - length(replace(v_new, '|dejalo|olvidalo|para|stop)', '')))
    / length('|dejalo|olvidalo|para|stop)');
  if v_cnt <> 1 then raise exception 'ancla d) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_new, '|dejalo|olvidalo|para|stop)', '|dejalo|olvidalo|stop)');

  -- e) «para X» responde el ¿Para quién? (antes del elsif de corrección de la mig 214)
  v_cnt := (length(v_new) - length(replace(v_new,
    'elsif v_pend.action = ''team_plan''
       and jsonb_typeof(v_pend.payload->''tareas'') = ''array''
       and length(v_text) <= 80', '')))
    / length('elsif v_pend.action = ''team_plan''
       and jsonb_typeof(v_pend.payload->''tareas'') = ''array''
       and length(v_text) <= 80');
  if v_cnt <> 1 then raise exception 'ancla e) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_new,
    'elsif v_pend.action = ''team_plan''
       and jsonb_typeof(v_pend.payload->''tareas'') = ''array''
       and length(v_text) <= 80',
    'elsif v_pend.action = ''team_plan'' and jsonb_typeof(v_pend.payload->''tareas'') = ''array''
       and v_norm ~ ''^\s*para\s+\S'' then
      -- mig 223: «para Fulano» / «para todos» contesta la pregunta de la tarjeta
      return public.bot_corregir_plan(p_telegram_chat_id, jsonb_build_object(
        ''interpreted'', true,
        ''nuevo_responsable'', btrim(regexp_replace(v_text, ''^\s*[Pp]ara\s+'', '''')),
        ''input_text'', v_text));
    elsif v_pend.action = ''team_plan''
       and jsonb_typeof(v_pend.payload->''tareas'') = ''array''
       and length(v_text) <= 80');

  -- f) el else ya no borra un plan de equipo
  v_cnt := (length(v_new) - length(replace(v_new,
    'else delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id; end if;', '')))
    / length('else delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id; end if;');
  if v_cnt <> 1 then raise exception 'ancla f) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_new,
    'else delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id; end if;',
    'else
      -- mig 223: un plan de equipo sobrevive a un mensaje ajeno (solo «no», el TTL o un
      -- plan nuevo lo cierran); una confirmación destructiva sí se descarta al cambiar de tema.
      if v_pend.action <> ''team_plan'' then
        delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
      end if;
    end if;');

  -- a2) la sub-acción de un multi no escribe turno (un solo bloque de logueo con 2 inserts)
  v_cnt := (length(v_new) - length(replace(v_new,
    'select organization_id into v_org from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true order by updated_at desc nulls last limit 1;', '')))
    / length('select organization_id into v_org from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true order by updated_at desc nulls last limit 1;');
  if v_cnt <> 1 then raise exception 'ancla a2) esperaba 1, hay %', v_cnt; end if;
  v_new := replace(v_new,
    'select organization_id into v_org from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true order by updated_at desc nulls last limit 1;',
    'if coalesce(v_args->>''_sub'','''') = ''true'' then return v_result; end if;  -- mig 223: la sub-acción de un multi no escribe turno
    select organization_id into v_org from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true order by updated_at desc nulls last limit 1;');

  execute v_new;
end
$mig$;