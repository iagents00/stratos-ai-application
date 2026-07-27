-- La Caja del CRM lee `team_expenses`, pero los pagos se registraron en `fin_movements`
-- → la pantalla mostraba $0 teniendo los pagos cargados. Se unifica en team_expenses,
-- que es la que ya pinta el front. (`source` solo acepta texto|audio|ticket|web.)
insert into team_expenses (organization_id, amount, currency, category, description, spent_at, tipo, account, source)
select m.organization_id, m.monto, m.moneda,
       case m.tipo when 'nomina' then 'Nómina' when 'ingreso' then 'Ingreso' when 'servicio' then 'Servicios' else 'Gasto' end,
       m.concepto || coalesce(' · para ' || m.para_quien, '') || coalesce(' · de ' || m.de_quien, ''),
       m.fecha::timestamptz,
       case when m.tipo = 'ingreso' then 'ingreso' else 'egreso' end,
       coalesce(m.metodo, 'General'),
       'web'
from fin_movements m
where m.organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'
  and m.deleted_at is null and m.estado = 'pagado'
  and not exists (
    select 1 from team_expenses te
    where te.organization_id = m.organization_id
      and te.amount = m.monto and te.spent_at::date = m.fecha
      and te.description like m.concepto || '%');

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
             coalesce((select sum(te.amount) from team_expenses te
                        where te.organization_id = p.organization_id
                          and te.category = 'Nómina'
                          and te.description ilike '%'||split_part(p.persona,' ',1)||'%'
                          and te.spent_at::date >= p.vigente_desde), 0) as pagado
      from fin_payroll p
      where p.organization_id = v_org and p.activo
        and (p_persona is null or p.persona ilike '%'||trim(p_persona)||'%')
    ) pr
  ) s;
  if coalesce(v_n,0) = 0 then return 'No hay nóminas definidas todavía. Decime «la nómina de X es de $N quincenales».'; end if;
  return 'SALDOS DE NÓMINA'||E'\n'||v_txt||E'\n'||'(Se acumula día a día. Los pagos se hacen el 15 y el 30 de cada mes.)';
end $$;;
