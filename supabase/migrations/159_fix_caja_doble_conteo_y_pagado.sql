-- Dos errores que Ángel vio en la pantalla de Comando (27-jul):
--
-- (1) «Entró $2.002,88» estaba DOBLE-CONTANDO. Desde que la contabilidad se mira
--     desde NSG, cada pago de nómina deja DOS filas: el egreso de la empresa y el
--     ingreso de la persona. La caja de la empresa sumaba las dos → contaba como
--     "entrada" la plata que la empresa acababa de pagar. La caja de la EMPRESA
--     solo debe mirar las filas de la empresa (persona_id is null).
--
-- (2) «se le debe $2.433,33 · pagado $0,00» a los dos, cuando a Ángel ya se le
--     pagaron $2.135,08 y a Iván $2.000. La causa: el cálculo buscaba los pagos
--     por el TEXTO de la descripción ('· para Ángel'), y al rehacer los
--     movimientos la descripción cambió a «Nómina pagada a Ángel» → no encontraba
--     nada. Ahora usa la columna `contraparte`, que existe justamente para esto:
--     no se vuelve a romper si alguien cambia la redacción.

do $mig$
declare v_src text; v_new text;
begin
  -- ── fn_comando_nsg ────────────────────────────────────────────────────────
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='fn_comando_nsg';
  if v_src is null then raise exception 'no encontré fn_comando_nsg'; end if;

  v_new := replace(v_src,
    E'      where te.organization_id = v_org and te.spent_at >= date_trunc(''month'', current_date)),',
    E'      where te.organization_id = v_org and te.persona_id is null\n'
    '        and te.spent_at >= date_trunc(''month'', current_date)),');
  if v_new = v_src then raise exception 'no encontré el filtro de la caja del mes'; end if;
  v_src := v_new;

  v_new := replace(v_src,
    E'                          where te.organization_id = pr.organization_id and te.category=''Nómina''\n'
    '                            and te.description ilike ''%· para ''||split_part(pr.persona,'' '',1)||''%''\n'
    '                            and te.spent_at::date >= pr.vigente_desde), 0))',
    E'                          where te.organization_id = pr.organization_id and te.category=''Nómina''\n'
    '                            and te.tipo = ''egreso'' and te.persona_id is null\n'
    '                            and te.contraparte ilike split_part(pr.persona,'' '',1)\n'
    '                            and te.spent_at::date >= pr.vigente_desde), 0))');
  if v_new = v_src then raise exception 'no encontré el cálculo de pagado en fn_comando_nsg'; end if;
  execute v_new;

  -- ── fn_fin_saldo (el mismo cálculo, para el Copilot) ──────────────────────
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='fn_fin_saldo';
  if v_src is null then raise exception 'no encontré fn_fin_saldo'; end if;

  v_new := replace(v_src,
    E'                        where te.organization_id = p.organization_id\n'
    '                          and te.category = ''Nómina''\n'
    '                          and te.description ilike ''%· para ''||split_part(p.persona,'' '',1)||''%''\n'
    '                          and te.spent_at::date >= p.vigente_desde), 0) as pagado',
    E'                        where te.organization_id = p.organization_id\n'
    '                          and te.category = ''Nómina''\n'
    '                          and te.tipo = ''egreso'' and te.persona_id is null\n'
    '                          and te.contraparte ilike split_part(p.persona,'' '',1)\n'
    '                          and te.spent_at::date >= p.vigente_desde), 0) as pagado');
  if v_new = v_src then raise exception 'no encontré el cálculo de pagado en fn_fin_saldo'; end if;
  execute v_new;
end $mig$;;
