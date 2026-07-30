-- El primer barrido (219) se quedó corto: «Decime cuándo» vive en
-- bot_create_team_actions, y el voseo estaba en 26 funciones más (equipo,
-- ficha, finanzas, push). Mismo criterio SEGURO: solo formas con tilde o
-- mayúscula inicial — jamás aparecen en regex de entrada (que matchean texto
-- normalizado sin tildes) — más « decime » con espacios. Los patrones de
-- entrada quedan intactos.
--
-- ⛔ fn_mkt_* (marketing) NO se toca en una ronda de ventas (regla de oro
-- marketing ≠ ventas): su voseo queda anotado para una ronda propia con su QA.
--
-- REVERTIR: re-ejecutar la versión anterior de cada función.

do $do$
declare
  v_fn text; v_oid oid; v_def text; v_new text; i int;
  v_pairs text[][] := array[
    ['Decime','Dime'], ['Contame','Cuéntame'], [' decime ',' dime '],
    ['querés','quieres'], ['Tenés','Tienes'], ['tenés','tienes'],
    ['podés','puedes'], ['necesitás','necesitas'], ['Pasámelo','Pásamelo'],
    ['conectá','conecta'], ['Estudiá','Estudia'], ['Repasá','Repasa'],
    ['preparate','prepárate'], ['Mandamelo asi','Mándamelo así'],
    ['Avisame','Avísame'], ['Revisá','Revisa'], ['Mirá','Mira'], ['Fijate','Fíjate']];
begin
  foreach v_fn in array array[
    'bot_add_expediente_note_bulk','bot_asesor_info','bot_bulk_move_all_stage',
    'bot_buscar_presupuesto','bot_create_team_actions','bot_ficha_cliente',
    'bot_kpis_asesor','bot_nlu_dispatch_gvintell_inner','bot_proxima_accion_cliente',
    'bot_top_hot_asesor','bot_ultima_accion','fn_client_set_objective',
    'fn_client_status','fn_clients_overview','fn_doc_guardar',
    'fn_fin_cuenta_cobro_cliente','fn_fin_saldo','fn_fin_set_nomina',
    'fn_team_action_respond','trg_push_on_proactive_sent'] loop
    for v_oid in
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.prokind='f' and p.proname = v_fn
    loop
      v_def := pg_get_functiondef(v_oid);
      v_new := v_def;
      for i in 1..array_length(v_pairs,1) loop
        v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
      end loop;
      if v_new <> v_def then execute v_new; end if;
    end loop;
  end loop;
end $do$;