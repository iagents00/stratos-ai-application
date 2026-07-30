-- Reestructura (OK de Ángel, 30-jul): un INTÉRPRETE con Claude al frente del
-- Copilot de ventas decide la ruta (actividades / corrección / recordatorio /
-- CRM) con contexto real de la conversación. Esta migración es el lado base:
--
-- 1) fn_copilot_contexto(chat): lo que el intérprete necesita saber — últimos
--    mensajes, tareas recién registradas por quien escribe, y si hay un plan
--    esperando el «sí». Determinista, sin depender de la memoria del modelo.
-- 2) bot_corregir_plan(chat,args): la corrección como la dice un humano
--    («a las 10 am, ¿por qué a las 10 pm?») SIN palabras mágicas: corrige el
--    plan pendiente o la(s) tarea(s) recién registradas y confirma en una línea.
-- 3) `interpreted:true` en args = la carga viene ESTRUCTURADA del intérprete →
--    salta TODAS las detecciones por texto de required_fields (fue lo que hoy
--    secuestró un paquete perfecto por ver «recuérdame» adentro) y sigue por
--    la cadena normal de herramientas (agenda_orig → …). Telegram no cambia.
-- 4) Día sin hora se MUESTRA como «(sin hora)» — nunca más un «mañana 10:00
--    p.m.» que el jefe no dijo (el tope interno queda solo para ordenar).
-- 5) Voseo restante: «queres» sin tilde y «Decímelo».
--
-- REVERTIR: cada bloque es un replace anclado / create or replace — volver a la
-- versión anterior de cada función. Sin DDL destructivo, sin tocar datos.

-- ── 1) El contexto que ve el intérprete ──────────────────────────────────────
create or replace function public.fn_copilot_contexto(p_chat bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_prof record; v_turnos jsonb; v_recientes jsonb; v_pend jsonb; v_tz text;
begin
  select id, organization_id, name, coalesce(role,'asesor') as role into v_prof
  from profiles where telegram_chat_id = p_chat and coalesce(active,true) limit 1;
  if v_prof.id is null then return jsonb_build_object('ok', false); end if;
  v_tz := coalesce(public.fn_user_tz(v_prof.organization_id, p_chat), 'America/Cancun');

  select coalesce(jsonb_agg(jsonb_build_object('rol', role, 'texto', left(content, 220)) order by created_at), '[]'::jsonb)
    into v_turnos
  from (select role, content, created_at from tg_bot_activity
        where telegram_chat_id = p_chat order by created_at desc limit 8) t;

  select coalesce(jsonb_agg(jsonb_build_object('titulo', text, 'para', asesor_name,
           'cuando', fn_fmt_cuando_legible(due_at, v_tz)) order by created_at desc), '[]'::jsonb)
    into v_recientes
  from (select text, asesor_name, due_at, created_at from team_actions
        where created_by = v_prof.id and created_at > now() - interval '40 minutes'
          and coalesce(done,false) = false
        order by created_at desc limit 5) t;

  select to_jsonb(x) into v_pend from (
    select action, coalesce(jsonb_array_length(payload->'tareas'),0) as tareas_n
    from bot_pending_confirm where telegram_chat_id = p_chat limit 1) x;

  return jsonb_build_object('ok', true, 'quien_escribe', v_prof.name, 'rol', v_prof.role,
    'ultimos_mensajes', v_turnos, 'tareas_recien_registradas', v_recientes,
    'plan_esperando_confirmacion', coalesce(v_pend, 'null'::jsonb));
end;
$fn$;

-- ── 2) La corrección como habla la gente ─────────────────────────────────────
create or replace function public.bot_corregir_plan(p_telegram_chat_id bigint, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_prof record; v_tz text; v_hora text; v_dia text; v_obj text;
  v_when timestamptz; v_pend record; v_t jsonb; v_tareas jsonb := '[]'::jsonb;
  v_res jsonb; v_n int := 0; v_out text := ''; r record; v_nuevo timestamptz;
begin
  select id, organization_id, name into v_prof from profiles
   where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) limit 1;
  if v_prof.id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré tu perfil.','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;
  v_tz := coalesce(public.fn_user_tz(v_prof.organization_id, p_telegram_chat_id),'America/Cancun');
  v_hora := nullif(btrim(coalesce(p_args->>'nueva_hora','')),'');
  v_dia  := nullif(btrim(coalesce(p_args->>'nuevo_dia','')),'');
  v_obj  := nullif(btrim(coalesce(p_args->>'objetivo','')),'');
  if v_hora is null and v_dia is null then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','¿Para qué hora o día lo corrijo? Ej: «a las 10 am» o «mejor el viernes 9 am».','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;

  -- a) hay un plan esperando el «sí» → se corrige ESE y se vuelve a mostrar
  select * into v_pend from bot_pending_confirm
   where telegram_chat_id = p_telegram_chat_id and action = 'team_plan';
  if found and jsonb_typeof(v_pend.payload->'tareas') = 'array' then
    for v_t in select value from jsonb_array_elements(v_pend.payload->'tareas') loop
      v_tareas := v_tareas || (v_t || jsonb_build_object('cuando',
        btrim(concat_ws(' ',
          coalesce(v_dia, (regexp_match(lower(public.unaccent(coalesce(v_t->>'cuando',''))),
            '(pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)'))[1]),
          v_hora))));
    end loop;
    v_res := public.bot_create_team_actions(p_telegram_chat_id, v_tareas, false);
    delete from bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
    if coalesce((v_res->>'necesita_confirmacion')::boolean, false) then
      insert into bot_pending_confirm (telegram_chat_id, action, organization_id, payload)
      values (p_telegram_chat_id, 'team_plan', v_prof.organization_id, jsonb_build_object('tareas', v_tareas));
    end if;
    return v_res;
  end if;

  -- b) sin plan pendiente → corregir lo recién registrado por quien escribe
  v_when := public.parse_relative_or_abs_es(btrim(concat_ws(' ', v_dia, v_hora)), v_tz);
  for r in
    select id, text, due_at from team_actions
     where created_by = v_prof.id and created_at > now() - interval '40 minutes'
       and coalesce(done,false) = false
       and (v_obj is null or public.unaccent(lower(text)) like '%'||public.unaccent(lower(v_obj))||'%')
     order by created_at desc
     limit case when v_obj is null then 1 else 3 end
  loop
    update team_actions set due_at =
      case when v_dia is not null and v_when is not null then v_when
           when v_when is not null then
             (date_trunc('day', due_at at time zone v_tz) + (v_when at time zone v_tz)::time) at time zone v_tz
           else due_at end
    where id = r.id;
    select due_at into v_nuevo from team_actions where id = r.id;
    v_n := v_n + 1;
    v_out := v_out || '· «'||r.text||'» → '||fn_fmt_cuando_legible(v_nuevo, v_tz)||chr(10);
  end loop;
  if v_n = 0 then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text','No encontré una tarea recién registrada para corregir. Dime cuál es, por ejemplo: «la de revisar la torre 4, a las 10 am».',
      'parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;
  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text','Listo, corregido:'||chr(10)||v_out,'parse_mode',null,'inline_keyboard','[]'::jsonb));
end;
$fn$;

-- ── 3) corregir_plan + bypass interpreted en required_fields ─────────────────
do $do$
declare v_def text; v_anchor text; v_new text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = 'bot_nlu_dispatch_gvintell_required_fields_orig';

  v_anchor := 'if v_tool not in (''add_expediente_note'',''add_expediente_voice'',''add_note_bulk'',';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla candado aparece % veces - no toco nada.', v_cnt; end if;

  v_new := 'if v_tool in (''corregir_plan'',''correccion_plan'',''corregir_tarea'') then' || chr(10)
        || '    return public.bot_corregir_plan(p_telegram_chat_id, v_args);' || chr(10)
        || '  end if;' || chr(10) || chr(10)
        || '  -- mig 220: carga ESTRUCTURADA del intérprete → sin detecciones por texto' || chr(10)
        || '  if coalesce((v_args->>''interpreted'')::boolean, false) and v_tool not in ('''',''menu'') then' || chr(10)
        || '    return public.bot_nlu_dispatch_gvintell_agenda_orig(p_telegram_chat_id, p_tool_name, p_args);' || chr(10)
        || '  end if;' || chr(10) || chr(10)
        || '  ' || v_anchor;
  execute replace(v_def, v_anchor, v_new);
end $do$;

-- ── 4) Día sin hora se muestra honesto ──────────────────────────────────────
do $do$
declare v_def text; v_a1 text; v_a2 text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = 'bot_create_team_actions';

  v_a1 := '''texto'', v_txt, ''resp_id'', v_resp_id, ''quien'', v_resp_name, ''due'', v_due);';
  v_cnt := (length(v_def) - length(replace(v_def, v_a1, ''))) / length(v_a1);
  if v_cnt <> 1 then raise exception 'Ancla plan aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a1,
    '''texto'', v_txt, ''resp_id'', v_resp_id, ''quien'', v_resp_name, ''due'', v_due,' || chr(10)
 || '      ''sin_hora'', (v_due is not null and nullif(r->>''cuando'','''') is not null' || chr(10)
 || '        and public._bot_hora_explicita(lower(public.unaccent(coalesce(r->>''cuando'','''')))) is null));');

  v_a2 := 'else '' — '' || fn_fmt_cuando_legible((v_p->>''due'')::timestamptz, v_tz) end';
  v_cnt := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  if v_cnt <> 1 then raise exception 'Ancla legible aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a2,
    'when coalesce((v_p->>''sin_hora'')::boolean,false) then '' — '' || btrim(regexp_replace(' || chr(10)
 || '             fn_fmt_cuando_legible((v_p->>''due'')::timestamptz, v_tz), ''\s*\d{1,2}:\d{2}\s*[ap]\.?\s?m\.?\s*$'', '''')) || '' (sin hora)''' || chr(10)
 || '           else '' — '' || fn_fmt_cuando_legible((v_p->>''due'')::timestamptz, v_tz) end');

  v_def := replace(v_def, 'Decímelo', 'Dímelo');
  execute v_def;
end $do$;

-- ── 5) «queres» sin tilde (lista de Zoom y afines) ───────────────────────────
do $do$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = '_bot_disambiguate';
  v_new := replace(v_def, ' queres ', ' quieres ');
  if v_new <> v_def then execute v_new; end if;
end $do$;