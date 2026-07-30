-- Tres cosas que dejó la ronda de hoy con las capturas de Ángel:
--
-- 1) El QA diario tocaba a DUKE: T7 creaba/cerraba una tarea del Asesor Prueba
--    REAL y el feed del equipo mostraba «Asesor Prueba marcó como hecha QA
--    ciclo · aviso al asignar (auto)» (salió en la captura de las 10:31). Ahora
--    TODO el ciclo corre en la cancha QA (org ffffffff-…): se enciende el
--    interruptor del aviso para esa org y T7 asigna QA Admin → QA Asesor Uno.
--    Y el ciclo crece: T8 prueba el recordatorio personal («en dos horas»,
--    número en PALABRAS) y T9 el multi completo (dictado limpio + recordatorio
--    en el mismo mensaje — el caso real de hoy). Score pasa de /7 a /9.
--
-- 2) El fallback partía muletillas: «Bueno varias cosas quiero que…» producía
--    una tarea «Varias cosas». Las aperturas habladas se quitan ANTES de partir.
--
-- 3) El bot hablaba en voseo («Decime cuándo», «querés», «tenés») y Duke/NSG
--    hablan español neutro (regla de Iván). Barrido SEGURO: solo formas con
--    tilde o mayúscula inicial (jamás aparecen en los regex de entrada, que
--    matchean texto normalizado sin tildes) + « decime » con espacios (solo
--    existe en textos al usuario). Los patrones de entrada quedan intactos.
--    De paso, el aviso proactivo tipo 'personal' sale como «Recordatorio: …».
--
-- REVERTIR: cada bloque es un replace sobre pg_get_functiondef — volver a
-- ejecutar la versión anterior de cada función. Sin DDL, sin tocar datos.

-- ── 1a) La cancha QA puede avisar al asignar ─────────────────────────────────
insert into proactive_config (organization_id, team_notify_on_assign)
values ('ffffffff-0000-4000-a000-000000000001', true)
on conflict (organization_id) do update set team_notify_on_assign = true;

-- ── 1b) El ciclo QA v2: todo en la cancha + recordatorio + multi ─────────────
create or replace function public.fn_qa_run_ciclo()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_chat bigint := -990002;                                   -- QA Admin (cancha)
  v_org_qa uuid := 'ffffffff-0000-4000-a000-000000000001';
  v_fallas text[] := '{}'; v_ok int := 0; v_tot int := 0;
  t text; v_id uuid; v_n int; v_quien text; v_score text; v_ts timestamptz;
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

  -- T7: asignar por la UI → el trigger encola el aviso (TODO en la cancha QA;
  -- antes tocaba a Duke y el feed real mostraba la tarea del ciclo — 30-jul)
  v_tot := v_tot + 1;
  insert into team_actions (organization_id, text, due_at, priority, category, asesor_id, asesor_name, created_by, order_idx)
  select v_org_qa, 'QA ciclo · aviso al asignar (auto)', now() + interval '6 hours', 'normal', 'General',
         a.id, a.name, j.id, 997
  from (select id, name from profiles where telegram_chat_id = -990001) a,
       (select id from profiles where telegram_chat_id = -990002) j
  returning id into v_id;
  select count(*), max(payload->>'quien_asigna') into v_n, v_quien
    from proactive_reminders
   where dedupe_key = 'team_assigned:'||v_id::text||':'||(select id::text from profiles where telegram_chat_id=-990001)
     and status = 'pending';
  if v_n = 1 and v_quien is not null then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T7 trigger UI: avisos='||coalesce(v_n,0)||' quien='||coalesce(v_quien,'—')); end if;
  update proactive_reminders set status='cancelled'
   where dedupe_key = 'team_assigned:'||v_id::text||':'||(select id::text from profiles where telegram_chat_id=-990001);
  update team_actions set done=true, completed_at=now() where id = v_id;

  -- T8: recordatorio personal con la hora en PALABRAS («en dos horas»)
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'create_personal_reminder',jsonb_build_object(
        'text','QA ciclo · recordatorio (auto)','when','en dos horas'))#>>'{reply,text}','');
  select count(*), max(scheduled_at) into v_n, v_ts from proactive_reminders
   where organization_id = v_org_qa and tipo='personal' and status='pending'
     and payload->>'text' = 'QA ciclo · recordatorio (auto)';
  if t like 'Listo, te lo recuerdo%' and v_n = 1
     and v_ts between now() + interval '110 minutes' and now() + interval '130 minutes' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T8 recordatorio: reply=«'||left(replace(t,E'\n',' '),50)||'» filas='||coalesce(v_n,0)); end if;
  update proactive_reminders set status='cancelled'
   where organization_id = v_org_qa and tipo='personal' and status='pending'
     and payload->>'text' = 'QA ciclo · recordatorio (auto)';

  -- T9: multi = dictado limpio + recordatorio en el MISMO mensaje (caso real 30-jul)
  v_tot := v_tot + 1;
  t := coalesce(bot_nlu_dispatch_gvintell(v_chat,'multi',jsonb_build_object(
        'actions', jsonb_build_array(
          jsonb_build_object('tool_name','create_team_actions','args', jsonb_build_object(
            'input_text','qa multi: que QA Asesor Uno contacte a los leads qa',
            'tareas', jsonb_build_array(jsonb_build_object(
              'texto','Contactar a los leads qa','responsable','QA Asesor Uno','cuando','')))),
          jsonb_build_object('tool_name','create_personal_reminder','args', jsonb_build_object(
            'text','QA ciclo · multi (auto)','when','en una hora'))),
        'input_text','qa multi'))#>>'{reply,text}','');
  if t like '1 actividad%' and t like '%te lo recuerdo%' then v_ok := v_ok + 1;
  else v_fallas := v_fallas || ('T9 multi: reply=«'||left(replace(t,E'\n',' '),60)||'»'); end if;
  update proactive_reminders set status='cancelled'
   where organization_id = v_org_qa and tipo='personal' and status='pending'
     and payload->>'text' = 'QA ciclo · multi (auto)';
  delete from bot_pending_confirm where telegram_chat_id = v_chat;

  return jsonb_build_object('ok', v_ok = v_tot, 'score', v_ok||'/'||v_tot,
                            'golden', v_score, 'fallas', to_jsonb(v_fallas), 'corrido_en', now());
end;
$fn$;

-- ── 2) Las aperturas habladas no se vuelven tareas (fallback con dignidad) ───
do $do$
declare v_def text; v_anchor text; v_new text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = 'fn_ventas_split_dictado';

  v_anchor := 'if btrim(t) = '''' then return ''[]''::jsonb; end if;';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla splitter aparece % veces - no toco nada.', v_cnt; end if;

  v_new := v_anchor || chr(10)
    || '  -- mig 219: las aperturas habladas no son actividades - fuera ANTES de partir' || chr(10)
    || '  t := regexp_replace(t, ''^\s*(bueno|ok|vale|oye|mira|listo|entonces|hola)[,.;: ]+'', '''', ''i'');' || chr(10)
    || '  t := regexp_replace(t, ''^\s*(varias cosas|una cosa|un par de cosas|dos cosas|tres cosas)[,.;: ]+'', '''', ''i'');' || chr(10)
    || '  t := regexp_replace(t, ''^\s*(bueno|ok|vale|entonces)[,.;: ]+'', '''', ''i'');';
  execute replace(v_def, v_anchor, v_new);
end $do$;

-- ── 3a) El aviso proactivo 'personal' se entrega como «Recordatorio: …» ──────
do $do$
declare v_def text; v_anchor text; v_new text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = 'fn_proactive_get_pending';

  v_anchor := 'END, COALESCE(NULLIF(c.payload->>''text'','''')';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla personal aparece % veces - no toco nada.', v_cnt; end if;

  v_new := 'WHEN c.tipo=''personal'' AND NULLIF(c.payload->>''text'','''') IS NOT NULL THEN ''Recordatorio: ''||(c.payload->>''text'') ' || v_anchor;
  execute replace(v_def, v_anchor, v_new);
end $do$;

-- ── 3b) Barrido de voseo → español neutro (solo formas display-seguras) ──────
do $do$
declare
  v_fn text; v_oid oid; v_def text; v_new text; i int;
  v_pairs text[][] := array[
    ['Decime','Dime'], ['Contame','Cuéntame'], [' decime ',' dime '],
    ['querés','quieres'], ['Tenés','Tienes'], ['tenés','tienes'],
    ['podés','puedes'], ['necesitás','necesitas'], ['Pasámelo','Pásamelo'],
    ['conectá','conecta'], ['Estudiá','Estudia'], ['Repasá','Repasa'],
    ['preparate','prepárate'], ['Mandamelo asi','Mándamelo así']];
begin
  foreach v_fn in array array[
    'bot_recomendar_propiedades','bot_reactivar_cliente','bot_stage_create_lead',
    'bot_clientes_de_asesor','bot_reassign_lead','bot_nlu_dispatch_gvintell_required_fields_orig',
    'bot_list_priority','bot_create_team_action','bot_list_expediente_v2',
    'bot_cliente_mas_hot','bot_register_expense','bot_smart_queries',
    'bot_documentos_espacio','bot_create_personal_reminder','bot_agendar_visita',
    'fn_proactive_get_pending'] loop
    for v_oid in
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.prokind='f' and p.proname = v_fn
    loop
      v_def := pg_get_functiondef(v_oid);
      v_new := v_def;
      for i in 1..array_length(v_pairs,1) loop
        v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
      end loop;
      if v_new <> v_def then execute v_new; end if;
    end loop;
  end loop;
end $do$;