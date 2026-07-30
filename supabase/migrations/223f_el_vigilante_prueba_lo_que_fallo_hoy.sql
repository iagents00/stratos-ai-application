-- mig 223f — El ciclo diario ahora cubre los tres escenarios que fallaron en la prueba
-- de fase 1 de Ángel (30-jul), para que no regresen en silencio:
--   T10: dictado sin responsable → tarjeta pregunta → «Para Fulano» asigna y CONSERVA la
--        hora (además ancla el «mañana a las 9» = 9:00 a.m., regla de la 223d);
--   T11: un multi (dictado + recordatorio) NO se come su propio plan (223) y la respuesta
--        con la fecha completa SOLO la tarea nombrada aunque el verbo cambie (223e);
--   T12: la corrección de una tarea YA registrada aplica de verdad («4:00 p.m.» → 16:00
--        en la fila) y cuando no entiende la hora lo DICE en vez de fingir éxito (223b).
-- El ciclo pasa de 9 a 12 pruebas. Revertir: quitar el bloque T10-T12 (anclas acá).

do $mig$
declare
  v_src text; v_new text; v_cnt int;
  v_ancla text := 'delete from bot_pending_confirm where telegram_chat_id = v_chat;

  return jsonb_build_object(''ok'', v_ok = v_tot,';
begin
  select prosrc into v_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='fn_qa_run_ciclo';

  v_cnt := (length(v_src) - length(replace(v_src, v_ancla, ''))) / length(v_ancla);
  if v_cnt <> 1 then raise exception 'ancla T10 esperaba 1, hay %', v_cnt; end if;

  v_new := replace(v_src, v_ancla,
'delete from bot_pending_confirm where telegram_chat_id = v_chat;

  -- T10 (mig 223f): «¿Para quién?» se contesta con «para Fulano» y conserva la hora
  v_tot := v_tot + 1;
  perform bot_nlu_dispatch_gvintell(v_chat,''create_team_actions'', jsonb_build_object(
    ''interpreted'', true, ''input_text'',''qa: hay que ordenar el archivo qa mañana a las 9'',
    ''tareas'', jsonb_build_array(jsonb_build_object(''texto'',''Ordenar el archivo qa'',''responsable'','''',''cuando'',''mañana a las 9''))));
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'''',jsonb_build_object(''input_text'',''Para QA Asesor Uno''))#>>''{reply,text}'','''');
  if t like ''%QA Asesor Uno%'' and t like ''%9:00 a.m.%'' and t not like ''%Cancelado%'' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || (''T10 para-quien: reply=«''||left(replace(t,E''\n'','' ''),60)||''»''); end if;
  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  -- T11 (mig 223f): el multi no se come su plan y la fecha completa SOLO la tarea nombrada
  v_tot := v_tot + 1;
  perform bot_nlu_dispatch_gvintell(v_chat,''multi'',jsonb_build_object(''actions'', jsonb_build_array(
    jsonb_build_object(''tool_name'',''dictar_actividades'',''args'', jsonb_build_object(
      ''input_text'',''que QA Asesor Uno contacte los leads qa hoy antes de las 4, que haga seguimiento a los de remarketing qa'')),
    jsonb_build_object(''tool_name'',''create_personal_reminder'',''args'', jsonb_build_object(
      ''text'',''QA ciclo · multi sobrevive (auto)'',''when'',''en una hora'')))));
  select count(*) into v_n from bot_pending_confirm where telegram_chat_id = v_chat and action=''team_plan'';
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,''corregir_plan'',jsonb_build_object(
    ''interpreted'',true,''nueva_hora'',''4:00 p.m.'',''nuevo_dia'',''mañana'',
    ''objetivo'',''Hacer seguimiento a los de remarketing qa'',
    ''input_text'',''la del seguimiento es mañana a las 4pm''))#>>''{reply,text}'','''');
  if v_n = 1 and t like ''%remarketing qa — mañana 4:00 p.m.%'' and t like ''%hoy 4:00 p.m.%'' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || (''T11 multi-sobrevive: pend=''||coalesce(v_n,0)||'' reply=«''||left(replace(t,E''\n'','' ''),70)||''»''); end if;
  update proactive_reminders set status=''cancelled''
   where organization_id = v_org_qa and tipo=''personal'' and status=''pending''
     and payload->>''text'' = ''QA ciclo · multi sobrevive (auto)'';
  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  -- T12 (mig 223f): corregir lo registrado APLICA de verdad y es honesto si no entiende
  v_tot := v_tot + 1;
  perform bot_nlu_dispatch_gvintell(v_chat,''create_team_actions'', jsonb_build_object(
    ''interpreted'', true, ''input_text'',''qa: que QA Asesor Uno revise la torre qa mañana a las 11'',
    ''tareas'', jsonb_build_array(jsonb_build_object(''texto'',''Revisar la torre qa'',''responsable'',''QA Asesor Uno'',''cuando'',''mañana a las 11''))));
  perform bot_nlu_dispatch_gvintell(v_chat,'''',jsonb_build_object(''input_text'',''si''));
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,''corregir_plan'',jsonb_build_object(
    ''interpreted'',true,''nueva_hora'',''4:00 p.m.'',''objetivo'',''Revisar la torre qa'',
    ''input_text'',''mejor pasa la de la torre qa a las 4 pm''))#>>''{reply,text}'','''');
  select id, due_at into v_id, v_ts from team_actions
   where organization_id=v_org_qa and text ilike ''%torre qa%'' and coalesce(done,false)=false
   order by created_at desc limit 1;
  if t like ''Listo, corregido%'' and t like ''%4:00 p.m.%''
     and (v_ts at time zone ''America/Cancun'')::time = ''16:00''::time then
    t := coalesce(bot_nlu_dispatch_gvintell(v_chat,''corregir_plan'',jsonb_build_object(
      ''interpreted'',true,''nueva_hora'',''patito'',''objetivo'',''Revisar la torre qa'',
      ''input_text'',''ponla a las patito''))#>>''{reply,text}'','''');
    if t like ''No entendí la hora nueva%'' then v_ok := v_ok + 1;
    else v_fallas := v_fallas || (''T12 honesta: reply=«''||left(replace(t,E''\n'','' ''),60)||''»''); end if;
  else v_fallas := v_fallas || (''T12 aplica: reply=«''||left(replace(t,E''\n'','' ''),60)||''» due=''||coalesce(to_char(v_ts at time zone ''America/Cancun'',''HH24:MI''),''—'')); end if;
  update team_actions set done=true, completed_at=now() where id = v_id;
  update proactive_reminders set status=''cancelled''
   where dedupe_key = ''team_assigned:''||v_id::text||'':''||(select id::text from profiles where telegram_chat_id=-990001);
  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  return jsonb_build_object(''ok'', v_ok = v_tot,');

  execute 'create or replace function public.fn_qa_run_ciclo() returns jsonb language plpgsql security definer set search_path to ''public'', ''pg_temp'' as ' || quote_literal(v_new);
end
$mig$;