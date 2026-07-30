-- «contactar los leads» no matcheaba «Contactar A los leads agendados» (el
-- filtro era substring literal). Ahora matchea por PALABRAS significativas
-- (≥4 letras): todas deben aparecer en el texto de la tarea.
-- REVERTIR: volver al like literal.
do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_corregir_plan';

  v_anchor := 'if v_obj is not null and public.unaccent(lower(coalesce(v_t->>''texto'',''''))) not like ''%''||public.unaccent(lower(v_obj))||''%'' then';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla filtro aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    'if v_obj is not null and exists (' || chr(10)
 || '         select 1 from unnest(regexp_split_to_array(public.unaccent(lower(v_obj)), ''\s+'')) w' || chr(10)
 || '         where length(w) >= 4 and public.unaccent(lower(coalesce(v_t->>''texto'',''''))) not like ''%''||w||''%'') then');
end $do$;