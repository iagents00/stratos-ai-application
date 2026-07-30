-- El golden lo pescó (caso 51): «mañana temprano» mostraba «(sin hora)» aunque
-- «temprano» SÍ implica una hora que el sistema resuelve (9:00). Las palabras
-- de momento del día no cuentan como falta de hora.
-- REVERTIR: quitar la condición del regex agregada al flag sin_hora.
do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_create_team_actions';

  v_anchor := 'and public._bot_hora_explicita(lower(public.unaccent(coalesce(r->>''cuando'','''')))) is null));';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla sin_hora aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    'and public._bot_hora_explicita(lower(public.unaccent(coalesce(r->>''cuando'','''')))) is null' || chr(10)
 || '        and lower(public.unaccent(coalesce(r->>''cuando'',''''))) !~ ''\m(temprano|mediodia|tarde|noche|madrugada)\M''));');
end $do$;