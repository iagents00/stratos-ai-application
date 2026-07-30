-- mig 226 — Fuera el encabezado «N actividades» (pedido de Ángel 30-jul: «estorba»):
--   · El plan para confirmar arrancaba con «5 actividades» y recién después los nombres.
--     Ahora arranca DIRECTO por «▸ Nombre» (el conteo no aporta: la lista se ve).
--   · Al confirmar, «Registradas 5 actividades» queda en «Registradas» (singular igual).
--   · Los dos tests del vigilante (fn_qa_run_ciclo) que asertaban el encabezado viejo
--     pasan a asertar la forma nueva (el texto arranca con «▸»).
-- La corrección de plan (bot_corregir_plan) reusa este builder → hereda el cambio solo.
-- Reversible: CREATE OR REPLACE con los cuerpos anteriores (backup diario).

do $mig$
declare
  v_src text; v_cnt int; v_old text; v_new text;
begin
  -- a) bot_create_team_actions: el preview arranca por los nombres
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'bot_create_team_actions';

  v_old := '''text'', case when v_n = 1 then ''1 actividad'' else v_n || '' actividades'' end || E''\n\n'' || v_out';
  v_new := '''text'', v_out';
  v_cnt := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_cnt <> 1 then raise exception 'mig226 encabezado preview: esperaba 1, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old, v_new);

  v_old := 'case when v_n = 1 then ''Registrada'' else ''Registradas ''||v_n||'' actividades'' end';
  v_new := 'case when v_n = 1 then ''Registrada'' else ''Registradas'' end';
  v_cnt := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_cnt <> 1 then raise exception 'mig226 encabezado registradas: esperaba 1, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old, v_new);

  execute 'create or replace function public.bot_create_team_actions(p_telegram_chat_id bigint, p_tareas jsonb, p_confirmar boolean default false) returns jsonb language plpgsql security definer set search_path to ''public'' as ' || quote_literal(v_src);

  -- b) fn_qa_run_ciclo: los tests asertan la forma nueva (arranca con «▸»)
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_qa_run_ciclo';

  v_old := 'if t like ''1 actividad%'' and v_n = 1 then v_ok := v_ok + 1;';
  v_new := 'if t like ''▸%'' and v_n = 1 then v_ok := v_ok + 1;';
  v_cnt := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_cnt <> 1 then raise exception 'mig226 test dictado: esperaba 1, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old, v_new);

  v_old := 'if t like ''1 actividad%'' and t like ''%te lo recuerdo%'' then v_ok := v_ok + 1;';
  v_new := 'if t like ''▸%'' and t like ''%te lo recuerdo%'' then v_ok := v_ok + 1;';
  v_cnt := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_cnt <> 1 then raise exception 'mig226 test multi: esperaba 1, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old, v_new);

  execute 'create or replace function public.fn_qa_run_ciclo() returns jsonb language plpgsql security definer set search_path to ''public'', ''pg_temp'' as ' || quote_literal(v_src);
end $mig$;