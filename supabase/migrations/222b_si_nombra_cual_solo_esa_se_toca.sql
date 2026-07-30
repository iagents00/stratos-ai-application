-- «la de contactar los leads mejor hoy a las 8 pm» movió TAMBIÉN el informe
-- semanal: la rama del plan pendiente aplicaba la hora a TODAS las tareas e
-- ignoraba el «objetivo». Ahora, si el mensaje nombra cuál («la de X»), SOLO
-- las tareas que matchean el objetivo se tocan; las demás quedan intactas.
-- REVERTIR: quitar el case del filtro por objetivo.
do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_corregir_plan';

  v_anchor := 'for v_t in select value from jsonb_array_elements(v_pend.payload->''tareas'') loop';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla loop aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    v_anchor || chr(10)
 || '      if v_obj is not null and public.unaccent(lower(coalesce(v_t->>''texto'',''''))) not like ''%''||public.unaccent(lower(v_obj))||''%'' then' || chr(10)
 || '        v_tareas := v_tareas || v_t; continue;' || chr(10)
 || '      end if;');
end $do$;