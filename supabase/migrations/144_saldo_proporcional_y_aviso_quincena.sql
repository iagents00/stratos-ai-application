-- Fix 1: el saldo se calculaba por periodos COMPLETOS (floor) → recién definida la
--        nómina mostraba 0 acumulado, que no dice nada. Ahora se acumula día a día
--        (proporcional), que es como se siente de verdad "lo que ya me gané".
-- Fix 2: el formato 'FM999,999.00' imprimía ".00" en vez de "0.00".
create or replace function public.fn_fin_saldo(p_profile_id uuid, p_persona text default null)
returns text language plpgsql as $$
declare v_org uuid; v_txt text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select count(*), string_agg(linea, E'\n' order by linea) into v_n, v_txt
  from (
    select '• '||pr.persona||': se le debe $'||to_char(round(greatest(0, devengado - pagado),2),'FM999999990.00')||' '||pr.moneda
           || '   (acumulado $'||to_char(round(devengado,2),'FM999999990.00')
           || ' · ya pagado $'||to_char(pagado,'FM999999990.00')||')'
           || '  ['||pr.monto||' '||pr.moneda||' '||pr.periodicidad||']' as linea
    from (
      select p.*,
             p.monto * (greatest(0, current_date - p.vigente_desde)::numeric /
                   case p.periodicidad when 'semanal' then 7 when 'quincenal' then 15 else 30 end) as devengado,
             coalesce((select sum(m.monto) from fin_movements m
                        where m.organization_id = p.organization_id and m.deleted_at is null
                          and m.tipo = 'nomina' and m.estado='pagado'
                          and m.para_quien ilike '%'||split_part(p.persona,' ',1)||'%'
                          and m.fecha >= p.vigente_desde), 0) as pagado
      from fin_payroll p
      where p.organization_id = v_org and p.activo
        and (p_persona is null or p.persona ilike '%'||trim(p_persona)||'%')
    ) pr
  ) s;

  if coalesce(v_n,0) = 0 then return 'No hay nóminas definidas todavía. Decime «la nómina de X es de $N semanales».'; end if;
  return 'SALDOS DE NÓMINA'||E'\n'||v_txt||E'\n'||'(Se acumula día a día. Los pagos se hacen el 15 y el 30 de cada mes.)';
end $$;

-- Aviso automático los días de pago: el 15 y el 30 (o el último día si el mes es más corto)
create or replace function public.fn_fin_aviso_pago_tick()
returns integer language plpgsql
security definer set search_path to 'public' as $$
declare r record; v_hoy date; v_dia int; v_ultimo int; v_txt text; v_n int := 0;
begin
  v_hoy := (now() at time zone 'America/Cancun')::date;
  v_dia := extract(day from v_hoy)::int;
  v_ultimo := extract(day from (date_trunc('month', v_hoy) + interval '1 month - 1 day'))::int;
  if v_dia <> 15 and v_dia <> 30 and not (v_dia = v_ultimo and v_ultimo < 30) then return 0; end if;

  for r in
    select p.id, p.name, p.telegram_chat_id, p.organization_id
    from profiles p join organizations o on o.id = p.organization_id
    where coalesce(o.meta_config->'mkt'->>'dailyDigest','false') = 'true'
      and p.telegram_chat_id is not null and p.role in ('super_admin','admin')
  loop
    begin
      v_txt := 'Hoy es día de pago ('||to_char(v_hoy,'DD Mon')||').'||E'\n\n'||fn_fin_saldo(r.id, null)
            || E'\n\n'||'Si quieres la cuenta de cobro dime: «genera la cuenta de cobro de Ángel».';
      perform _mkt_notify(r.organization_id, r.id, r.name, r.telegram_chat_id,
                          'dia_de_pago', v_txt, 'pago-'||r.id::text||'-'||v_hoy::text);
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  return v_n;
end $$;

select cron.schedule('aviso-dia-de-pago', '0 15 * * *', $$select public.fn_fin_aviso_pago_tick();$$);;
