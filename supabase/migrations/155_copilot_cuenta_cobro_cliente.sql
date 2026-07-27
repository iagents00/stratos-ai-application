-- Le enseña al Copilot a armar la cuenta de cobro de un CLIENTE por voz
-- («armá la cuenta de cobro de Duke de esta quincena»). Parche ADITIVO sobre
-- mkt_nlu_dispatch: se inserta un `when` nuevo justo antes del que ya existía
-- para la nómina. No se toca ninguna rama existente.
do $mig$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mkt_nlu_dispatch';

  if v_src is null then raise exception 'no encontré mkt_nlu_dispatch'; end if;

  if position('fin_cuenta_cobro_cliente' in v_src) > 0 then
    raise notice 'ya estaba: no se toca';
    return;
  end if;

  v_new := replace(
    v_src,
    E'    when ''fin_cuenta_cobro'' then',
    E'    when ''fin_cuenta_cobro_cliente'' then\n'
    '      v_reply := fn_fin_cuenta_cobro_cliente(v_profile.id, p_args->>''cliente'',\n'
    '        nullif(p_args->>''monto'','''')::numeric, nullif(p_args->>''desde'','''')::date,\n'
    '        nullif(p_args->>''hasta'','''')::date, nullif(p_args->>''concepto'',''''));\n'
    '    when ''fin_cuenta_cobro'' then'
  );

  if v_new = v_src then raise exception 'no encontré el punto de inserción'; end if;
  execute v_new;
end $mig$;;
