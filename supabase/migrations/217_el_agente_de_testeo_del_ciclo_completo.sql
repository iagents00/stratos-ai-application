-- Ángel, 30-jul: «no podemos ir testeando todo el día… crea los agentes de
-- testeo que vayan testeando lo que vas mejorando, y yo testeo los otros por
-- mi cuenta.»
--
-- La lección del día lo justifica sola: el golden probaba RESPUESTAS y por eso
-- el «sí» roto (213c) pasó verde — nadie probaba el CICLO. Este agente prueba
-- CICLOS COMPLETOS, de punta a punta, contra el cerebro real:
--
--   T1 dictar        → plan mostrado Y pendiente guardado
--   T2 decir «sí»    → «Registrada» Y la fila EXISTE en team_actions
--   T3 «mejor a las 4 pm» → el plan se corrige (y «no» lo cancela)
--   T4 autoasignarse → cae en la agenda personal con el título limpio
--   T5 «qué tareas tiene X» → responde
--   T6 el golden de ventas completo (35 casos de respuesta)
--   T7 asignar por la UI (insert directo) → el TRIGGER encola el aviso con
--      quien_asigna (y se autolimpia: cancela el aviso y cierra la tarea
--      antes del tick del motor)
--
-- T1-T5 corren en la CANCHA QA (org ffffffff-…, chats -990001/-990002): cero
-- contacto con datos reales. T7 corre en Duke porque el interruptor del aviso
-- es de esa org — y se limpia solo en el mismo segundo.
--
-- CRON: diario a las 13:00 UTC (07:00 Cancún, antes de la jornada), job
-- 'qa-ciclo-ventas'. Si algo falla, le AVISA A ÁNGEL al Copilot/campanita
-- (chat 7464451486) con el detalle del primer fallo. Si pasa, silencio.
-- A demanda: select fn_qa_run_ciclo();
--
-- REVERTIR: select cron.unschedule('qa-ciclo-ventas'); drop de las 2 funciones.

create or replace function public.fn_qa_run_ciclo()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_chat bigint := -990002;                                   -- QA Admin (cancha)
  v_org_qa uuid := 'ffffffff-0000-4000-a000-000000000001';
  v_org_duke uuid := '00000000-0000-0000-0000-000000000001';
  v_fallas text[] := '{}'; v_ok int := 0; v_tot int := 0;
  t text; v_id uuid; v_n int; v_quien text; v_score text;
begin
  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  -- T1: dictar → plan + pendiente guardado
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object(
        'input_text','necesito que QA Asesor Uno revise el tablero qa mañana a las 3 de la tarde'))#>>'{reply,text}','');
  select count(*) into v_n from bot_pending_confirm where telegram_chat_id = v_chat and action='team_plan';
  if t like '1 actividad%' and v_n = 1 then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T1 dictado: reply=«'||left(replace(t,E'\n',' '),60)||'» pendientes='||v_n); end if;

  -- T2: «sí» → Registrada + la fila existe
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object('input_text','si'))#>>'{reply,text}','');
  select count(*) into v_n from team_actions
   where organization_id = v_org_qa and text ilike 'Revisar el tablero qa%' and coalesce(done,false)=false;
  if t like 'Registrada%' and v_n >= 1 then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T2 confirmar: reply=«'||left(replace(t,E'\n',' '),60)||'» filas='||v_n); end if;
  update team_actions set done=true, completed_at=now()
   where organization_id = v_org_qa and text ilike 'Revisar el tablero qa%' and coalesce(done,false)=false;

  -- T3: corrección de hora sobre el plan pendiente + cancelar
  v_tot := v_tot + 1;
  perform bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object(
        'input_text','que QA Asesor Uno prepare el informe qa mañana a las 3 de la tarde'));
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object('input_text','mejor a las 4 pm'))#>>'{reply,text}','');
  if t like '%4:00 p.m.%' and t like '%¿Confirmo?%' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T3 correccion: reply=«'||left(replace(t,E'\n',' '),60)||'»'); end if;
  perform bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object('input_text','no'));

  -- T4: autoasignación → agenda personal con título limpio
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object(
        'input_text','ponme una tarea para mañana: revisar el ciclo qa'))#>>'{reply,text}','');
  if t like '%agenda personal%' and t like '%Revisar el ciclo qa%' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T4 autoasignacion: reply=«'||left(replace(t,E'\n',' '),60)||'»'); end if;
  update team_actions set done=true, completed_at=now()
   where organization_id = v_org_qa and text ilike 'Revisar el ciclo qa%' and coalesce(done,false)=false;

  -- T5: qué tareas tiene un compañero
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'',jsonb_build_object(
        'input_text','qué tareas tiene QA Asesor Uno'))#>>'{reply,text}','');
  if t like '%pendiente%' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T5 tareas de otro: reply=«'||left(replace(t,E'\n',' '),60)||'»'); end if;

  -- T6: el golden completo de respuestas
  v_tot := v_tot + 1;
  v_score := coalesce(public.fn_qa_run_golden(-990001)->>'score','?');
  if v_score = '35/35' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T6 golden: '||v_score); end if;

  -- T7: asignar por la UI (Duke) → el trigger encola el aviso; autolimpieza inmediata
  v_tot := v_tot + 1;
  insert into team_actions (organization_id, text, due_at, priority, category, asesor_id, asesor_name, created_by, order_idx)
  select v_org_duke, 'QA ciclo · aviso al asignar (auto)', now() + interval '6 hours', 'normal', 'General',
         a.id, a.name, j.id, 997
  from (select id, name from profiles where telegram_chat_id = -9000000000032) a,
       (select id from profiles where telegram_chat_id = 7464451486) j
  returning id into v_id;
  select count(*), max(payload->>'quien_asigna') into v_n, v_quien
    from proactive_reminders
   where dedupe_key = 'team_assigned:'||v_id::text||':'||(select id::text from profiles where telegram_chat_id=-9000000000032)
     and status = 'pending';
  if v_n = 1 and v_quien is not null then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T7 trigger UI: avisos='||coalesce(v_n,0)||' quien='||coalesce(v_quien,'—')); end if;
  update proactive_reminders set status='cancelled'
   where dedupe_key = 'team_assigned:'||v_id::text||':'||(select id::text from profiles where telegram_chat_id=-9000000000032);
  update team_actions set done=true, completed_at=now() where id = v_id;

  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  return jsonb_build_object('ok', v_ok = v_tot, 'score', v_ok||'/'||v_tot,
                            'golden', v_score, 'fallas', to_jsonb(v_fallas), 'corrido_en', now());
end;
$fn$;

create or replace function public.fn_qa_ciclo_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare r jsonb;
begin
  r := public.fn_qa_run_ciclo();
  if not coalesce((r->>'ok')::boolean, false) then
    insert into public.tg_bot_activity (telegram_chat_id, role, content)
    values (7464451486, 'ai',
      '⚠️ QA del ciclo de ventas: '||coalesce(r->>'score','?')||'. Primer fallo: '||
      coalesce(r->'fallas'->>0,'(sin detalle)')||'. Corre «select fn_qa_run_ciclo();» para ver todo.');
  end if;
  return r;
end;
$fn$;

select cron.schedule('qa-ciclo-ventas', '0 13 * * *', 'select public.fn_qa_ciclo_tick();');
