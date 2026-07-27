-- Corrección de Ángel (27-jul): el sistema decía que se le debían $298,25 y él
-- dice que son **$365**. Tenía razón, y la diferencia no era un error de suma
-- sino de CÓMO se cuenta lo devengado.
--
-- Estábamos prorrateando día a día: al día 73 desde el 15-may, 73/15 = 4,87
-- quincenas → $2.433,33. Pero nadie piensa así. Ángel piensa (bien) en
-- quincenas COMPLETAS: van 5 quincenas desde el 15 de mayo → $2.500 devengados,
-- menos $2.135,08 ya cobrados = **$364,92**, que son los $365 que él dice.
--
-- Se cambia el prorrateo por `ceil(dias / periodo)`: la quincena en curso cuenta
-- entera. Es como se piensa un sueldo, y además hace que el número deje de
-- moverse todos los días.

do $mig$
declare v_src text; v_new text; v_viejo text; v_nuevo text;
begin
  -- fn_comando_nsg
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='fn_comando_nsg';

  v_viejo := E'round(pr.monto * (greatest(0, current_date - pr.vigente_desde)::numeric /\n'
             '                     case pr.periodicidad when ''semanal'' then 7 when ''quincenal'' then 15 else 30 end), 2)';
  v_nuevo := E'round(pr.monto * ceil(greatest(1, current_date - pr.vigente_desde)::numeric /\n'
             '                     case pr.periodicidad when ''semanal'' then 7 when ''quincenal'' then 15 else 30 end), 2)';

  v_new := replace(v_src, v_viejo, v_nuevo);
  if v_new = v_src then raise exception 'no encontré el devengado en fn_comando_nsg'; end if;
  execute v_new;

  -- fn_fin_saldo (el mismo cálculo, para el Copilot)
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='fn_fin_saldo';

  v_viejo := E'             p.monto * (greatest(0, current_date - p.vigente_desde)::numeric /\n'
             '                   case p.periodicidad when ''semanal'' then 7 when ''quincenal'' then 15 else 30 end) as devengado';
  v_nuevo := E'             p.monto * ceil(greatest(1, current_date - p.vigente_desde)::numeric /\n'
             '                   case p.periodicidad when ''semanal'' then 7 when ''quincenal'' then 15 else 30 end) as devengado';

  v_new := replace(v_src, v_viejo, v_nuevo);
  if v_new = v_src then raise exception 'no encontré el devengado en fn_fin_saldo'; end if;
  execute v_new;
end $mig$;;
