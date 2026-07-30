-- T9 del ciclo QA lo pescó: un dictado de UNA actividad con su tarea ya
-- redactada por el especialista se descartaba (regla mig 211: confiar solo si
-- vienen >= 2 tareas) y el splitter re-partía el texto crudo («2 actividades ▸
-- Todos»). La regla nació cuando el redactor era el modelo generalista, que
-- mandaba UNA tarea-resumen para dictados de varias; el especialista está
-- entrenado y probado para devolver EXACTAS. Con >= 1 el desglose limpio gana
-- y el fallback queda igual: sin tareas → separa la base.
--
-- REVERTIR: volver el >= 1 a >= 2.

do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind='f' and p.proname = 'bot_nlu_dispatch_gvintell_inner';

  v_anchor := 'and jsonb_array_length(v_args->''tareas'') >= 2';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla >= 2 aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    'and jsonb_array_length(v_args->''tareas'') >= 1 -- mig 219b: el especialista redacta mejor que el splitter');
end $do$;