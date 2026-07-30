-- Capturas de Ángel 30-jul 11:59: «¿Cuáles son las actividades que tiene asesor
-- prueba?» → «No encontré ese cliente». Un nombre del EQUIPO cayó al buscador
-- de CLIENTES: nadie en la cadena consulta la nómina antes de decidir.
--
-- 1) fn_copilot_contexto ahora incluye el EQUIPO de la org (nombre + rol).
--    El intérprete decide asesor-vs-lead por DATO, no por adivinanza.
-- 2) El detector «qué tareas tiene X» (mig 212e) tolera «que tiene(n)» y
--    «cuáles son las actividades/tareas de X».
-- 3) Confirmación guiada completa (pedido de Ángel): si el dictado no dice
--    PARA QUIÉN, la tarjeta lo pregunta («dime el nombre o di "para todos"»)
--    en vez de mandarla a Todos en silencio (el 30-jul un «Todos» accidental
--    notificó a las 18 personas reales de Duke).
-- 4) bot_corregir_plan acepta también «nuevo_responsable»: contestar «para
--    Gael» con el plan pendiente asigna y re-muestra.
--
-- REVERTIR: versión anterior de cada función (replaces anclados / create or
-- replace). Sin DDL destructivo, sin tocar datos.

-- ── 1) La nómina del equipo entra al contexto ────────────────────────────────
do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='fn_copilot_contexto';

  v_anchor := 'return jsonb_build_object(''ok'', true, ''quien_escribe'', v_prof.name, ''rol'', v_prof.role,';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla contexto aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    'return jsonb_build_object(''ok'', true, ''quien_escribe'', v_prof.name, ''rol'', v_prof.role,' || chr(10)
 || '    ''equipo'', (select coalesce(jsonb_agg(jsonb_build_object(''nombre'', name, ''rol'', coalesce(role,''asesor'')) order by name), ''[]''::jsonb)' || chr(10)
 || '                from profiles where organization_id = v_prof.organization_id and coalesce(active,true) limit 1),');
end $do$;

-- ── 2) «cuáles son las actividades que tiene X» también se entiende ──────────
do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_nlu_dispatch_gvintell_required_fields_orig';

  v_anchor := '''\m(?:tareas|pendientes|actividades)\s+(?:tiene|tienen|de|del)\s+([a-z][a-z ]{1,39}?)\s*\??$''';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla tareas-de aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    '''\m(?:tareas|pendientes|actividades)\s+(?:que\s+)?(?:tiene|tienen|de|del)\s+(?:el\s+|la\s+)?([a-z][a-z ]{1,39}?)\s*\??$''');
end $do$;

-- ── 3) Sin responsable → se pregunta, no se manda a Todos en silencio ────────
do $do$
declare v_def text; v_a1 text; v_a2 text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_create_team_actions';

  v_a1 := 'v_resp_id := null; v_resp_name := ''Todos'';';
  v_cnt := (length(v_def) - length(replace(v_def, v_a1, ''))) / length(v_a1);
  if v_cnt <> 1 then raise exception 'Ancla Todos aparece % veces - no toco nada.', v_cnt; end if;
  execute replace(v_def, v_a1,
    'v_resp_id := null;' || chr(10)
 || '      if v_pedido is null then v_resp_name := ''¿Para quién?'';' || chr(10)
 || '      else v_resp_name := ''Todos''; end if;');
end $do$;

do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_create_team_actions';

  v_anchor := 'if not coalesce(p_confirmar,false) then';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla confirmar aparece % veces - no toco nada.', v_cnt; end if;
  execute replace(v_def, v_anchor,
    'if exists (select 1 from jsonb_array_elements(v_plan) e where e->>''quien'' = ''¿Para quién?'') then' || chr(10)
 || '    v_out := v_out || chr(10) || ''Falta saber para quién es: '' ||' || chr(10)
 || '      (select string_agg(e->>''texto'', '' / '') from jsonb_array_elements(v_plan) e where e->>''quien'' = ''¿Para quién?'')' || chr(10)
 || '      || ''. Dime el nombre o di «para todos».'' || chr(10);' || chr(10)
 || '  end if;' || chr(10)
 || '  if not coalesce(p_confirmar,false) then');
end $do$;

-- ── 4) «para Gael» con el plan pendiente = asignar y re-mostrar ──────────────
do $do$
declare v_def text; v_a1 text; v_a2 text; v_a3 text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_corregir_plan';

  v_a1 := 'v_obj  := nullif(btrim(coalesce(p_args->>''objetivo'','''')),'''');';
  v_cnt := (length(v_def) - length(replace(v_def, v_a1, ''))) / length(v_a1);
  if v_cnt <> 1 then raise exception 'Ancla obj aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a1, v_a1 || chr(10)
 || '  declare v_resp text := nullif(btrim(coalesce(p_args->>''nuevo_responsable'','''')),''''); begin');

  v_a2 := 'if v_hora is null and v_dia is null then';
  v_cnt := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  if v_cnt <> 1 then raise exception 'Ancla vacio aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a2, 'if v_hora is null and v_dia is null and v_resp is null then');

  v_a2 := 'v_tareas := v_tareas || (v_t || jsonb_build_object(''cuando'',';
  v_cnt := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  if v_cnt <> 1 then raise exception 'Ancla cuando aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a2,
    'v_tareas := v_tareas || (v_t' || chr(10)
 || '        || case when v_resp is not null and coalesce(nullif(btrim(v_t->>''responsable''),''''), ''¿Para quién?'') in (''¿Para quién?'',''Todos'')' || chr(10)
 || '             then jsonb_build_object(''responsable'', v_resp) else ''{}''::jsonb end' || chr(10)
 || '        || jsonb_build_object(''cuando'',');

  v_a3 := 'end;' || chr(10) || '$function$';
  v_cnt := (length(v_def) - length(replace(v_def, v_a3, ''))) / length(v_a3);
  if v_cnt <> 1 then raise exception 'Ancla cierre aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a3, 'end;' || chr(10) || 'end;' || chr(10) || '$function$');

  execute v_def;
end $do$;