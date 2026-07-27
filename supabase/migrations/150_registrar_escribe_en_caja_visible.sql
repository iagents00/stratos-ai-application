-- Que lo que se registre por chat aparezca en la Caja del CRM al instante
create or replace function public.fn_fin_registrar(
  p_profile_id uuid, p_tipo text, p_concepto text, p_monto numeric,
  p_de text default null, p_para text default null, p_metodo text default null,
  p_fecha date default null, p_estado text default 'pagado')
returns text language plpgsql as $$
declare v_org uuid; v_tipo text; v_estado text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(p_monto,0) = 0 then return '¿De cuánto es el movimiento?'; end if;
  v_tipo   := lower(coalesce(nullif(trim(p_tipo),''),'gasto'));
  v_estado := coalesce(nullif(trim(p_estado),''),'pagado');

  insert into fin_movements (organization_id, fecha, tipo, concepto, monto, de_quien, para_quien,
                             metodo, estado, registrado_por)
  values (v_org, coalesce(p_fecha, current_date), v_tipo, trim(p_concepto), abs(p_monto),
          nullif(trim(coalesce(p_de,'')),''), nullif(trim(coalesce(p_para,'')),''),
          nullif(trim(coalesce(p_metodo,'')),''), v_estado, p_profile_id);

  if v_estado = 'pagado' then
    insert into team_expenses (organization_id, amount, currency, category, description, spent_at, tipo, account, source, created_by)
    values (v_org, abs(p_monto), 'USD',
            case v_tipo when 'nomina' then 'Nómina' when 'ingreso' then 'Ingreso' when 'servicio' then 'Servicios' else 'Gasto' end,
            trim(p_concepto) || coalesce(' · para ' || p_para, '') || coalesce(' · de ' || p_de, ''),
            coalesce(p_fecha, current_date)::timestamptz,
            case when v_tipo = 'ingreso' then 'ingreso' else 'egreso' end,
            coalesce(nullif(trim(coalesce(p_metodo,'')),''), 'General'), 'web', p_profile_id);
  end if;

  return '✓ Registrado: '||trim(p_concepto)||' · $'||to_char(abs(p_monto),'FM999,999.00')
      || coalesce(' · de '||p_de,'') || coalesce(' · para '||p_para,'')
      || coalesce(' · '||p_metodo,'')
      || ' ('||to_char(coalesce(p_fecha,current_date),'DD Mon')||')'
      || case when v_estado='pagado' then '. Ya se ve en Caja.' else '. Queda como PENDIENTE.' end;
end $$;

-- El Comando de operación lee la misma caja
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
                            and te.description ilike '%'||split_part(pr.persona,' ',1)||'%'
                            and te.spent_at::date >= pr.vigente_desde), 0))
             order by pr.persona)
      from fin_payroll pr where pr.organization_id = v_org and pr.activo), '[]'::jsonb)
  ) into v;
  return v;
end $$;;
