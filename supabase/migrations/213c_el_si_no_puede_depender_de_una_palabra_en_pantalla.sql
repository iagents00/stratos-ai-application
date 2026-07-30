-- 🔴 BUG QUE INTRODUJE HOY CON LA MIG 213. Iván probó el guion completo y en dos
-- de las pruebas dijo «sí» y el sistema contestó «No tienes nada pendiente. Dime
-- que necesitas» — las actividades NO se guardaron. Después preguntó «qué tareas
-- tiene Asesor Prueba» y le salió una tarea vieja, porque las nuevas nunca se
-- crearon.
--
-- CAUSA: el pendiente que el «sí» necesita se guardaba con esta condición:
--
--     v_result := bot_create_team_actions(chat, v_multi, false);
--     if coalesce(v_result#>>'{reply,text}','') like 'Entendí%' then
--         insert into bot_pending_confirm ... 'team_plan' ...
--
-- O sea: **el guardado dependía de que el texto de la PANTALLA empezara con la
-- palabra «Entendí»**. En la mig 213 cambié ese texto a «N actividades» porque
-- Iván pidió un mensaje compacto — y con eso apagué el guardado sin tocarlo.
--
-- El golden no lo agarró porque el caso #44 sólo mira la tarjeta; nadie probaba
-- el CICLO (dictar → «sí» → ¿quedó la tarea?).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- EL ARREGLO: LA LÓGICA NO SE ADIVINA DEL TEXTO
--
-- `bot_create_team_actions` ahora DECLARA lo que pasó — devuelve
-- `necesita_confirmacion: true` y `plan_n` junto a la respuesta — y el ruteador
-- mira esa bandera en vez de olfatear la primera palabra del mensaje.
--
-- Es el fondo del problema, no el síntoma: mientras el control de flujo se
-- deduzca de la copy, cualquier cambio de redacción —el de hoy o el de dentro de
-- tres meses— vuelve a romper el guardado en silencio. Y «en silencio» es lo
-- peor que puede pasar acá: el jefe cree que dejó el trabajo asignado y no dejó
-- nada.
--
-- PROBADO — el ciclo entero, que es lo que faltaba probar:
--   1. dicta          → «1 actividad ▸ Asesor Prueba · Revisar el pipeline — mañana 4:00 p.m.»
--   2. pendiente guardado: 1  (antes: 0)
--   3. dice «sí»      → «Registrada»
--   4. tareas en la base: 27 → 28  ✅
--   Golden ventas 35/35.
--
-- REVERTIR: volver la condición a `like 'Entendí%'` y quitar los dos campos del
-- return. (No se recomienda: es volver a atar la lógica al texto.)
-- ═══════════════════════════════════════════════════════════════════════════

do $do$
declare v_def text; v_a text;
begin
  -- 1) el armador DECLARA que hay un plan esperando confirmación
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_create_team_actions';

  v_a := 'return jsonb_build_object(''ok'',true,''reply'',jsonb_build_object(
      ''text'', case when v_n = 1 then ''1 actividad'' else v_n || '' actividades'' end';
  if position(v_a in v_def) = 0 then
    raise exception 'No encontré el return del plan sin confirmar — no toco nada.';
  end if;
  execute replace(v_def, v_a,
    'return jsonb_build_object(''ok'',true,''necesita_confirmacion'',true,''plan_n'',v_n,''reply'',jsonb_build_object(
      ''text'', case when v_n = 1 then ''1 actividad'' else v_n || '' actividades'' end');

  -- 2) el ruteador mira la BANDERA, no la primera palabra del mensaje
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_nlu_dispatch_gvintell_inner';

  v_a := 'if coalesce(v_result#>>''{reply,text}'','''') like ''Entendí%'' then';
  if position(v_a in v_def) = 0 then
    raise exception 'No encontré la condición del pendiente — no toco nada.';
  end if;
  execute replace(v_def, v_a,
    'if coalesce((v_result->>''necesita_confirmacion'')::boolean, false) then');
end
$do$;
