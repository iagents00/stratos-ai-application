-- Cuenta de cobro AL CLIENTE (pedido de Ángel, 27-jul-2026):
-- «lo de las cuentas de cobro será a partir de este 30 de este mes en adelante,
--  con lo que vayamos haciendo para duke y el corporativo de las 5 empresas»
-- Antes fin_invoices solo servía para la nómina (NSG → persona). Ahora también
-- para lo que NSG le cobra a un cliente, y el detalle se arma SOLO con el trabajo
-- que de verdad se cerró en el periodo (no se inventa nada).

alter table public.fin_invoices
  add column if not exists tipo    text not null default 'nomina',   -- nomina | cliente
  add column if not exists lead_id uuid,                             -- el cliente, cuando tipo='cliente'
  add column if not exists concepto text,
  add column if not exists notas    text;

create index if not exists fin_invoices_org_tipo_idx on public.fin_invoices (organization_id, tipo, periodo_hasta desc);

-- Lo entregado en el periodo: tareas cerradas + objetivos que se movieron.
create or replace function public.fn_fin_entregado_periodo(
  p_org uuid, p_lead_id uuid, p_desde date, p_hasta date
) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(x order by x->>'fecha'), '[]'::jsonb) from (
    select jsonb_build_object(
             'fecha', to_char(coalesce(t.updated_at, t.created_at)::date,'YYYY-MM-DD'),
             'que',   t.titulo,
             'tipo',  'tarea'
           ) x
      from mkt_tasks t
     where t.organization_id = p_org
       and t.deleted_at is null
       and t.estado in ('hecho','completada','cerrada','aprobado')
       and coalesce(t.updated_at, t.created_at)::date between p_desde and p_hasta
    union all
    select jsonb_build_object(
             'fecha', to_char(o.updated_at::date,'YYYY-MM-DD'),
             'que',   o.titulo || ' — va en ' || coalesce(o.actual,0)::text || ' de ' || coalesce(o.meta,0)::text
                      || coalesce(' ' || o.unidad, ''),
             'tipo',  'objetivo'
           ) x
      from client_objectives o
     where o.organization_id = p_org
       and o.deleted_at is null
       and (p_lead_id is null or o.lead_id = p_lead_id)
       and o.updated_at::date between p_desde and p_hasta
  ) s;
$$;

-- Arma la cuenta de cobro de un cliente. El monto lo pone quien la emite:
-- el sistema NO adivina cuánto se cobra.
create or replace function public.fn_fin_cuenta_cobro_cliente(
  p_profile_id uuid,
  p_cliente    text  default null,
  p_monto      numeric default null,
  p_desde      date  default null,
  p_hasta      date  default null,
  p_concepto   text  default null
) returns text
language plpgsql as $$
declare
  v_org uuid; v_lead record; v_desde date; v_hasta date; v_num text; v_n int;
  v_items jsonb; v_monto numeric;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  if coalesce(trim(p_cliente),'') <> '' then
    select id, name into v_lead from leads
     where organization_id = v_org and name ilike '%'||trim(p_cliente)||'%'
     order by length(name) limit 1;
    if v_lead.id is null then
      return 'No encontré al cliente «'||p_cliente||'» en el CRM. Revisá el nombre o cargalo primero.';
    end if;
  end if;

  -- por defecto, la quincena que se está cerrando (1-15 · 16-fin de mes)
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

  v_items := fn_fin_entregado_periodo(v_org, v_lead.id, v_desde, v_hasta);
  v_monto := p_monto;   -- puede quedar en null: se completa antes de firmar

  select count(*)+1 into v_n from fin_invoices where organization_id = v_org;
  v_num := 'NSG-'||to_char(current_date,'YYYY')||'-'||lpad(v_n::text,4,'0');

  insert into fin_invoices (organization_id, numero, tipo, lead_id, beneficiario,
                            periodo_desde, periodo_hasta, monto, moneda, estado,
                            concepto, created_by, detalle)
  values (v_org, v_num, 'cliente', v_lead.id, coalesce(v_lead.name, coalesce(p_cliente,'Cliente')),
          v_desde, v_hasta, coalesce(v_monto, 0), 'USD', 'borrador',
          coalesce(p_concepto, 'Servicios de desarrollo, automatización e inteligencia artificial'),
          p_profile_id,
          jsonb_build_object('items', v_items, 'monto_pendiente', (v_monto is null)));

  return '✓ Cuenta de cobro '||v_num||' · '||coalesce(v_lead.name,'Cliente')||E'\n'
      || 'Periodo: '||to_char(v_desde,'DD Mon')||' al '||to_char(v_hasta,'DD Mon')||E'\n'
      || case when v_monto is null then 'Monto: falta ponerlo (se completa en la Caja antes de firmar)'
              else 'Monto: $'||to_char(v_monto,'FM999,999.00')||' USD' end ||E'\n'
      || 'Entregado en el periodo: '||jsonb_array_length(v_items)||' cosas'||E'\n'
      || 'Queda en borrador — se descarga en Word desde la Caja para firmarla.';
end $$;

-- Lo que lee la pantalla de Caja.
create or replace function public.fn_fin_invoices_list(p_profile_id uuid)
returns jsonb
language plpgsql stable as $$
declare v_org uuid; v_out jsonb;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb)
    into v_out
    from (select id, numero, tipo, beneficiario, concepto, periodo_desde, periodo_hasta,
                 monto, moneda, estado, detalle, firmada_at, pagada_at, created_at
            from fin_invoices where organization_id = v_org
           order by created_at desc limit 60) i;
  return v_out;
end $$;

grant execute on function public.fn_fin_cuenta_cobro_cliente(uuid,text,numeric,date,date,text) to anon, authenticated;
grant execute on function public.fn_fin_invoices_list(uuid) to anon, authenticated;
grant execute on function public.fn_fin_entregado_periodo(uuid,uuid,date,date) to anon, authenticated;;
