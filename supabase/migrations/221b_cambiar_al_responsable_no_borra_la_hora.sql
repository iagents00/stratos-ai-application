-- Al contestar SOLO «para Gael» (sin hora ni día), el re-armado del plan
-- reconstruía «cuando» con día+hora vacíos y una tarea «mañana 11 am» quedaba
-- en «mañana» a secas. Si no hay hora ni día nuevos, el «cuando» original se
-- conserva tal cual.
-- REVERTIR: quitar el case (volver al btrim(concat_ws(...)) directo).

do $do$
declare v_def text; v_a1 text; v_a2 text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_corregir_plan';

  v_a1 := '|| jsonb_build_object(''cuando'',';
  v_cnt := (length(v_def) - length(replace(v_def, v_a1, ''))) / length(v_a1);
  if v_cnt <> 1 then raise exception 'Ancla cuando aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a1,
    '|| jsonb_build_object(''cuando'', case when v_hora is null and v_dia is null then coalesce(v_t->>''cuando'','''') else');

  v_a2 := 'v_hora))));';
  v_cnt := (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2);
  if v_cnt <> 1 then raise exception 'Ancla tail aparece % veces - no toco nada.', v_cnt; end if;
  v_def := replace(v_def, v_a2, 'v_hora)) end));');

  execute v_def;
end $do$;