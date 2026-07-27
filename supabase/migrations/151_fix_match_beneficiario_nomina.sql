-- El saldo buscaba el nombre en toda la descripción: los pagos "para Ángel · de Iván"
-- se le contaban TAMBIÉN a Iván (aparecía con el doble pagado). Ahora se busca
-- explícitamente el beneficiario ("· para <Nombre>").
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
                          and te.description ilike '%· para '||split_part(p.persona,' ',1)||'%'
                          and te.spent_at::date >= p.vigente_desde), 0) as pagado
      from fin_payroll p
      where p.organization_id = v_org and p.activo
        and (p_persona is null or p.persona ilike '%'||trim(p_persona)||'%')
    ) pr
  ) s;
  if coalesce(v_n,0) = 0 then return 'No hay nóminas definidas todavía. Decime «la nómina de X es de $N quincenales».'; end if;
  return 'SALDOS DE NÓMINA'||E'\n'||v_txt||E'\n'||'(Se acumula día a día. Los pagos se hacen el 15 y el 30 de cada mes.)';
end $$;

create or replace function public.fn_comando_nsg(p_profile_id uuid)
returns jsonb language plpgsql stable
security definer set search_path to 'public' as $$
declare v_org uuid; v jsonb;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return jsonb_build_object('ok', false); end if;
  select jsonb_build_object(
    'ok', true,
    'clientes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', l.name, 'etapa', l.stage,
        'objetivos', coalesce((
          select jsonb_agg(jsonb_build_object('titulo', o.titulo, 'actual', o.actual,
                    'meta', o.meta, 'unidad', o.unidad, 'estado', o.estado,
                    'pct', least(100, round(coalesce(o.actual,0) / nullif(o.meta,0) * 100)))
                 order by o.estado, o.due_date nulls last)
          from client_objectives o where o.lead_id = l.id and o.deleted_at is null), '[]'::jsonb),
        'ultimo_avance', (select u.texto from client_updates u
                           where u.lead_id = l.id and u.deleted_at is null
                           order by u.created_at desc limit 1)
      ) order by l.name)
      from leads l where l.organization_id = v_org), '[]'::jsonb),
    'trabajo', (
      select jsonb_build_object(
        'vencidas', count(*) filter (where t.estado <> 'hecha' and t.due_at < now()),
        'hoy',      count(*) filter (where t.estado <> 'hecha' and t.due_at::date = current_date),
        'en_curso', count(*) filter (where t.estado = 'en_curso'),
        'hechas_7d',count(*) filter (where t.estado = 'hecha' and t.updated_at > now() - interval '7 days'),
        'abiertas', count(*) filter (where t.estado <> 'hecha'))
      from mkt_tasks t where t.organization_id = v_org and t.deleted_at is null),
    'por_persona', coalesce((
      select jsonb_agg(x order by x->>'nombre') from (
        select jsonb_build_object('nombre', p.name,
                 'abiertas', count(*) filter (where t.estado <> 'hecha'),
                 'vencidas', count(*) filter (where t.estado <> 'hecha' and t.due_at < now())) as x
        from profiles p left join mkt_tasks t
          on t.assignee_id = p.id and t.organization_id = v_org and t.deleted_at is null
        where p.organization_id = v_org group by p.id, p.name) s), '[]'::jsonb),
    'proyectos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', pr.nombre,
               'hechas', (select count(*) from mkt_tasks t where t.project_id=pr.id and t.deleted_at is null and t.estado='hecha'),
               'total',  (select count(*) from mkt_tasks t where t.project_id=pr.id and t.deleted_at is null))
             order by pr.nombre)
      from mkt_projects pr where pr.organization_id = v_org and pr.deleted_at is null), '[]'::jsonb),
    'caja', (
      select jsonb_build_object(
        'entro',    coalesce(sum(te.amount) filter (where te.tipo='ingreso'), 0),
        'nomina',   coalesce(sum(te.amount) filter (where te.tipo='egreso' and te.category='Nómina'), 0),
        'servicios',coalesce(sum(te.amount) filter (where te.tipo='egreso' and te.category <> 'Nómina'), 0),
        'desde',    to_char(date_trunc('month', current_date), 'YYYY-MM-DD'))
      from team_expenses te
      where te.organization_id = v_org and te.spent_at >= date_trunc('month', current_date)),
    'nomina', coalesce((
      select jsonb_agg(jsonb_build_object('persona', pr.persona, 'monto', pr.monto,
               'moneda', pr.moneda, 'periodicidad', pr.periodicidad,
               'devengado', round(pr.monto * (greatest(0, current_date - pr.vigente_desde)::numeric /
                     case pr.periodicidad when 'semanal' then 7 when 'quincenal' then 15 else 30 end), 2),
               'pagado', coalesce((select sum(te.amount) from team_expenses te
                          where te.organization_id = pr.organization_id and te.category='Nómina'
                            and te.description ilike '%· para '||split_part(pr.persona,' ',1)||'%'
                            and te.spent_at::date >= pr.vigente_desde), 0))
             order by pr.persona)
      from fin_payroll pr where pr.organization_id = v_org and pr.activo), '[]'::jsonb)
  ) into v;
  return v;
end $$;;
