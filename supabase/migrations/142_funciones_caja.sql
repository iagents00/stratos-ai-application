-- Registrar cualquier movimiento hablando
create or replace function public.fn_fin_registrar(
  p_profile_id uuid, p_tipo text, p_concepto text, p_monto numeric,
  p_de text default null, p_para text default null, p_metodo text default null,
  p_fecha date default null, p_estado text default 'pagado')
returns text language plpgsql as $$
declare v_org uuid; v_tipo text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(p_monto,0) = 0 then return '¿De cuánto es el movimiento?'; end if;
  v_tipo := lower(coalesce(nullif(trim(p_tipo),''),'gasto'));

  insert into fin_movements (organization_id, fecha, tipo, concepto, monto, de_quien, para_quien,
                             metodo, estado, registrado_por)
  values (v_org, coalesce(p_fecha, current_date), v_tipo, trim(p_concepto), abs(p_monto),
          nullif(trim(coalesce(p_de,'')),''), nullif(trim(coalesce(p_para,'')),''),
          nullif(trim(coalesce(p_metodo,'')),''), coalesce(nullif(trim(p_estado),''),'pagado'), p_profile_id);

  return '✓ Registrado: '||trim(p_concepto)||' · $'||to_char(abs(p_monto),'FM999,999.00')
      || coalesce(' · de '||p_de,'') || coalesce(' · para '||p_para,'')
      || coalesce(' · '||p_metodo,'')
      || ' ('||to_char(coalesce(p_fecha,current_date),'DD Mon')||').';
end $$;

-- Definir o cambiar la nómina de alguien
create or replace function public.fn_fin_set_nomina(
  p_profile_id uuid, p_persona text, p_monto numeric,
  p_periodicidad text default 'semanal', p_moneda text default 'USD')
returns text language plpgsql as $$
declare v_org uuid; v_pid uuid; v_id uuid;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_persona),'') = '' or coalesce(p_monto,0) <= 0 then
    return 'Decime de quién es la nómina y de cuánto.'; end if;

  select id into v_pid from profiles where organization_id=v_org and name ilike '%'||trim(p_persona)||'%' limit 1;

  select id into v_id from fin_payroll
   where organization_id=v_org and persona ilike '%'||trim(p_persona)||'%' and activo limit 1;

  if v_id is not null then
    update fin_payroll set monto=p_monto, periodicidad=coalesce(nullif(p_periodicidad,''),periodicidad),
           moneda=coalesce(nullif(p_moneda,''),moneda), updated_at=now(), vigente_desde=current_date
     where id=v_id;
    return '✓ Nómina actualizada: '||trim(p_persona)||' · $'||to_char(p_monto,'FM999,999.00')||' '||coalesce(p_moneda,'USD')||' '||coalesce(p_periodicidad,'semanal')||'.';
  end if;

  insert into fin_payroll (organization_id, profile_id, persona, monto, moneda, periodicidad)
  values (v_org, v_pid, trim(p_persona), p_monto, coalesce(nullif(p_moneda,''),'USD'), coalesce(nullif(p_periodicidad,''),'semanal'));
  return '✓ Nómina definida: '||trim(p_persona)||' · $'||to_char(p_monto,'FM999,999.00')||' '||coalesce(p_moneda,'USD')||' '||coalesce(p_periodicidad,'semanal')||'.';
end $$;

-- Cuánto se le debe a alguien: lo devengado desde su última fecha, menos lo ya pagado
create or replace function public.fn_fin_saldo(p_profile_id uuid, p_persona text default null)
returns text language plpgsql as $$
declare v_org uuid; v_txt text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select count(*), string_agg(linea, E'\n' order by linea) into v_n, v_txt
  from (
    select '• '||pr.persona||': se le debe $'||to_char(greatest(0, devengado - pagado),'FM999,999.00')||' '||pr.moneda
           || '  (acumulado $'||to_char(devengado,'FM999,999.00')||' · pagado $'||to_char(pagado,'FM999,999.00')||')' as linea
    from (
      select p.*,
             -- devengado: nº de periodos completos desde que arrancó la nómina
             round(p.monto * floor(greatest(0, current_date - p.vigente_desde)::numeric /
                   case p.periodicidad when 'semanal' then 7 when 'quincenal' then 15 else 30 end), 2) as devengado,
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
  return 'SALDOS DE NÓMINA'||E'\n'||v_txt||E'\n'||'(Los pagos se hacen el 15 y el 30 de cada mes.)';
end $$;

-- Estado de la caja
create or replace function public.fn_fin_resumen(p_profile_id uuid, p_desde date default null)
returns text language plpgsql as $$
declare v_org uuid; v_d date; v_in numeric; v_nom numeric; v_serv numeric; v_det text; v_saldos text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_d := coalesce(p_desde, date_trunc('month', current_date)::date);

  select coalesce(sum(monto) filter (where tipo='ingreso'),0),
         coalesce(sum(monto) filter (where tipo='nomina'),0),
         coalesce(sum(monto) filter (where tipo in ('servicio','gasto')),0)
    into v_in, v_nom, v_serv
  from fin_movements where organization_id=v_org and deleted_at is null and fecha >= v_d and estado='pagado';

  select string_agg('• '||to_char(fecha,'DD Mon')||' — '||concepto||': $'||to_char(monto,'FM999,999.00')
         ||coalesce(' ('||metodo||')',''), E'\n' order by fecha desc)
    into v_det
  from (select * from fin_movements where organization_id=v_org and deleted_at is null and fecha >= v_d
        order by fecha desc limit 8) u;

  v_saldos := fn_fin_saldo(p_profile_id, null);

  return 'CAJA desde el '||to_char(v_d,'DD Mon')||E'\n'
      || 'Entró: $'||to_char(v_in,'FM999,999.00')||E'\n'
      || 'Nómina pagada: $'||to_char(v_nom,'FM999,999.00')||E'\n'
      || 'Servicios y gastos: $'||to_char(v_serv,'FM999,999.00')||E'\n'
      || 'Diferencia: $'||to_char(v_in - v_nom - v_serv,'FM999,999.00')
      || coalesce(E'\n\n'||'ÚLTIMOS MOVIMIENTOS'||E'\n'||v_det,'')
      || E'\n\n'||v_saldos;
end $$;

-- Cuenta de cobro (queda registrada y numerada; el PDF para firmar sale del flujo n8n)
create or replace function public.fn_fin_cuenta_cobro(
  p_profile_id uuid, p_persona text, p_desde date default null, p_hasta date default null)
returns text language plpgsql as $$
declare v_org uuid; v_p record; v_desde date; v_hasta date; v_monto numeric; v_num text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select * into v_p from fin_payroll
   where organization_id=v_org and activo and persona ilike '%'||trim(coalesce(p_persona,''))||'%' limit 1;
  if v_p.id is null then return 'No encontré la nómina de «'||coalesce(p_persona,'')||'».'; end if;

  -- por defecto: la quincena que se está cerrando (1-15 o 16-fin de mes)
  if p_desde is null then
    if extract(day from current_date) >= 16 then
      v_desde := date_trunc('month', current_date)::date + 15;
      v_hasta := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
    else
      v_desde := date_trunc('month', current_date)::date;
      v_hasta := date_trunc('month', current_date)::date + 14;
    end if;
  else
    v_desde := p_desde; v_hasta := coalesce(p_hasta, current_date);
  end if;

  v_monto := round(v_p.monto * ((v_hasta - v_desde + 1)::numeric /
             case v_p.periodicidad when 'semanal' then 7 when 'quincenal' then 15 else 30 end), 2);

  select count(*)+1 into v_n from fin_invoices where organization_id=v_org;
  v_num := 'NSG-'||to_char(current_date,'YYYY')||'-'||lpad(v_n::text,4,'0');

  insert into fin_invoices (organization_id, numero, beneficiario, periodo_desde, periodo_hasta,
                            monto, moneda, estado, created_by,
                            detalle)
  values (v_org, v_num, v_p.persona, v_desde, v_hasta, v_monto, v_p.moneda, 'borrador', p_profile_id,
          jsonb_build_object('base', v_p.monto, 'periodicidad', v_p.periodicidad, 'dias', v_hasta - v_desde + 1));

  return '✓ Cuenta de cobro '||v_num||' · '||v_p.persona||E'\n'
      || 'Periodo: '||to_char(v_desde,'DD Mon')||' al '||to_char(v_hasta,'DD Mon')||E'\n'
      || 'Monto: $'||to_char(v_monto,'FM999,999.00')||' '||v_p.moneda||E'\n'
      || 'Queda en borrador para revisar y firmar.';
end $$;;
