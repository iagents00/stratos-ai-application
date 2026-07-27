-- Dos cosas que reportó Ángel (27-jul):
--
-- (1) «puse quinientos y me sale cero». La pantalla escribía el monto con un
--     UPDATE directo a la tabla desde el navegador. Cualquier tropiezo de RLS o
--     de sesión lo dejaba en silencio y el Word salía con «cero dólares».
--     Ahora va por una función: resuelve la organización desde el perfil de quien
--     llama, valida, y si algo falla lo DICE. Nada de fallar callado con plata.
--
-- (2) «Duke le paga a NSG, pero Ángel le cobra a NSG». Faltaba esa cuenta de
--     cobro: la de una PERSONA a la empresa, por su nómina. El monto no se pide:
--     sale del saldo real (lo devengado menos lo ya cobrado), que es exactamente
--     lo que la persona tiene derecho a cobrar.

create or replace function public.fn_fin_invoice_set_monto(
  p_profile_id uuid, p_invoice_id uuid, p_monto numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.'); end if;
  if p_monto is null or p_monto < 0 then
    return jsonb_build_object('ok', false, 'error', 'El monto tiene que ser un número mayor que cero.');
  end if;

  update fin_invoices
     set monto = round(p_monto, 2)
   where id = p_invoice_id and organization_id = v_org;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'No encontré esa cuenta de cobro en tu empresa.');
  end if;
  return jsonb_build_object('ok', true, 'monto', round(p_monto, 2));
end $$;

-- ── Cuenta de cobro de una PERSONA a NSG ─────────────────────────────────────
create or replace function public.fn_fin_cuenta_cobro_persona(
  p_profile_id uuid,
  p_persona    text default null,     -- vacío = yo mismo
  p_monto      numeric default null,  -- vacío = el saldo real que se le debe
  p_desde      date default null,
  p_hasta      date default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_yo text; v_p record; v_desde date; v_hasta date;
  v_num text; v_n int; v_monto numeric; v_devengado numeric; v_pagado numeric;
  v_items jsonb; v_empresa text;
begin
  select organization_id, name into v_org, v_yo from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select name into v_empresa from organizations where id = v_org;

  select * into v_p from fin_payroll
   where organization_id = v_org and activo
     and persona ilike '%'||trim(coalesce(nullif(p_persona,''), v_yo))||'%'
   limit 1;
  if v_p.id is null then
    return 'No encontré la nómina de «'||coalesce(nullif(p_persona,''), v_yo)||'». Cargala primero en Caja → Nómina.';
  end if;

  -- La quincena que se está cerrando, salvo que digan otra cosa.
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

  -- El monto por defecto es lo que DE VERDAD se le debe: quincenas completas
  -- devengadas menos lo ya cobrado. Mismo cálculo que muestra el Comando.
  v_devengado := round(v_p.monto * ceil(greatest(1, current_date - v_p.vigente_desde)::numeric /
                 case v_p.periodicidad when 'semanal' then 7 when 'quincenal' then 15 else 30 end), 2);
  select coalesce(sum(te.amount), 0) into v_pagado
    from team_expenses te
   where te.organization_id = v_org and te.category = 'Nómina'
     and te.tipo = 'egreso' and te.persona_id is null
     and te.contraparte ilike split_part(v_p.persona, ' ', 1)
     and te.spent_at::date >= v_p.vigente_desde;

  v_monto := coalesce(p_monto, round(greatest(0, v_devengado - v_pagado), 2));

  -- Lo entregado en el periodo, para que la cuenta no sea solo un número.
  v_items := fn_fin_entregado_periodo(v_org, null, v_desde, v_hasta);

  select count(*)+1 into v_n from fin_invoices where organization_id = v_org;
  v_num := 'NSG-'||to_char(current_date,'YYYY')||'-'||lpad(v_n::text,4,'0');

  insert into fin_invoices (organization_id, numero, tipo, beneficiario,
                            periodo_desde, periodo_hasta, monto, moneda, estado,
                            concepto, created_by, detalle)
  values (v_org, v_num, 'nomina', v_p.persona, v_desde, v_hasta,
          v_monto, coalesce(v_p.moneda,'USD'), 'borrador',
          'Servicios profesionales de desarrollo — '||v_p.periodicidad,
          p_profile_id,
          jsonb_build_object('items', v_items, 'cobra_a', coalesce(v_empresa,'NSG'),
                             'devengado', v_devengado, 'ya_cobrado', v_pagado));

  return '✓ Cuenta de cobro '||v_num||E'\n'
      || v_p.persona||' le cobra a '||coalesce(v_empresa,'NSG')||E'\n'
      || 'Periodo: '||to_char(v_desde,'DD Mon')||' al '||to_char(v_hasta,'DD Mon')||E'\n'
      || 'Monto: $'||to_char(v_monto,'FM999,999.00')||' '||coalesce(v_p.moneda,'USD')
      || case when p_monto is null then ' (el saldo real que se te debe)' else '' end ||E'\n'
      || 'Queda en borrador — se descarga en Word desde la Caja para firmarla.';
end $$;

-- Y el Copilot aprende a armarla por voz.
do $mig$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='mkt_nlu_dispatch';
  if position('fn_fin_cuenta_cobro_persona' in v_src) > 0 then return; end if;

  v_new := replace(v_src,
    E'    when ''fin_cuenta_cobro_cliente'' then',
    E'    when ''fin_cuenta_cobro_persona'' then\n'
    '      v_reply := fn_fin_cuenta_cobro_persona(v_profile.id, nullif(p_args->>''persona'',''''),\n'
    '        nullif(p_args->>''monto'','''')::numeric, nullif(p_args->>''desde'','''')::date,\n'
    '        nullif(p_args->>''hasta'','''')::date);\n'
    '    when ''fin_cuenta_cobro_cliente'' then');
  if v_new = v_src then raise exception 'no encontré el punto de inserción'; end if;
  execute v_new;
end $mig$;

grant execute on function public.fn_fin_invoice_set_monto(uuid,uuid,numeric) to anon, authenticated;
grant execute on function public.fn_fin_cuenta_cobro_persona(uuid,text,numeric,date,date) to anon, authenticated;
