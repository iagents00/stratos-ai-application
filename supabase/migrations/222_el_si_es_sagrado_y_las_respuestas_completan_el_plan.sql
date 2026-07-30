-- Capturas de Ángel 12:19-12:21: «si» tras la tarjeta respondía «¿Para qué hora
-- o día lo corrijo?» — el intérprete a veces clasifica el «si» como corrección
-- y esa herramienta corre ANTES del candado determinista del pendiente. Regla
-- del AIOS: la seguridad son LLAVES, no prompts.
--
-- 1) bot_corregir_plan: si el texto es una confirmación/negación pura
--    («si», «no», «dale», «confirmo», «cancela»…), DELEGA al flujo determinista
--    del pendiente (_inner con tool vacío). El «sí» registra SIEMPRE, sin
--    importar el humor del modelo.
-- 2) fn_copilot_contexto: el plan pendiente viaja COMPLETO (tareas con texto,
--    responsable y cuándo) — la base de la ruta «completar»: contestar «la de
--    los leads mañana a las 4 y la de Cecilia hoy 8 pm» actualiza el plan.
--
-- REVERTIR: quitar el guard / volver el subquery a tareas_n solo.

do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='bot_corregir_plan';

  v_anchor := 'if v_hora is null and v_dia is null and v_resp is null then';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla ask aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    '-- mig 222: una confirmación/negación pura JAMÁS es corrección — va al flujo determinista' || chr(10)
 || '  if lower(public.unaccent(coalesce(p_args->>''input_text'',''''))) ~' || chr(10)
 || '     ''^\s*((si|no|dale|ok|okey|confirmo|confirmar|correcto|adelante|claro|cancela|cancelar|nel|nop)[\s.!]*)+$'' then' || chr(10)
 || '    return public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, '''',' || chr(10)
 || '      jsonb_build_object(''input_text'', coalesce(p_args->>''input_text'','''')));' || chr(10)
 || '  end if;' || chr(10)
 || '  ' || v_anchor);
end $do$;

do $do$
declare v_def text; v_anchor text; v_cnt int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname='fn_copilot_contexto';

  v_anchor := 'select action, coalesce(jsonb_array_length(payload->''tareas''),0) as tareas_n';
  v_cnt := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'Ancla pend aparece % veces - no toco nada.', v_cnt; end if;

  execute replace(v_def, v_anchor,
    'select action, coalesce(jsonb_array_length(payload->''tareas''),0) as tareas_n, payload->''tareas'' as tareas');
end $do$;