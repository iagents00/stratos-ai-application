-- ─────────────────────────────────────────────────────────────────────────────
-- fn_informe_avances — «qué se hizo» en los últimos N días, contado en cristiano.
--
-- Pedido de Ángel (27-jul): «si lanzo el resumen, ese resumen debe estar conectado
-- con el AIOS… buscar la información de lo que se ha hecho de los últimos quince
-- días… que se entienda para cualquier persona de recursos humanos y para un CEO».
--
-- REGLA: esta función NO inventa nada. Junta EVIDENCIA (tareas cerradas, avance de
-- proyectos, objetivos del cliente, bitácora, reuniones y el changelog del cerebro)
-- y devuelve además un borrador ya redactado. La IA que lo pule después recibe SOLO
-- esta evidencia y tiene prohibido agregar hechos — si la IA no está disponible, el
-- borrador de acá se usa tal cual y el informe igual sale.
--
-- Aislamiento: el changelog y las reuniones salen del cerebro de iagents00, que NO
-- es de los clientes. Solo se incluyen si la organización lo tiene habilitado en
-- `meta_config.usa_cerebro_aios`. Sin esa bandera, el informe se arma solo con los
-- datos de la propia empresa.
--
-- ⚠️ OJO al releer: esta versión tiene el bug del LIMIT antes del ORDER BY en
-- `entregas` y `cambios`. Lo corrige la 171, que reemplaza la función completa.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_informe_avances(
  p_profile_id uuid,
  p_dias int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org       uuid;
  v_tz        text;
  v_empresa   text;
  v_cerebro   boolean;
  v_hasta     date;
  v_desde     date;
  v_entregas  jsonb;
  v_proyectos jsonb;
  v_objetivos jsonb;
  v_bitacora  jsonb;
  v_reuniones jsonb;
  v_cambios   jsonb;
  v_cliente   text;
  v_borrador  text;
  v_lineas    text;
  v_n_ent     int;
begin
  select p.organization_id into v_org from profiles p where p.id = p_profile_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.');
  end if;

  select o.name, coalesce((o.meta_config->>'usa_cerebro_aios')::boolean, false)
    into v_empresa, v_cerebro
  from organizations o where o.id = v_org;

  v_tz    := coalesce(public.fn_tz_de(p_profile_id), 'America/Bogota');
  v_hasta := (now() at time zone v_tz)::date;
  v_desde := v_hasta - greatest(coalesce(p_dias, 15), 1);

  -- 1) Lo que se cerró en el periodo ──────────────────────────────────────────
  select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into v_entregas
  from (
    select jsonb_build_object(
             'titulo',  t.titulo,
             'proyecto', pr.nombre,
             'quien',   pf.name,
             'fecha',   to_char((t.updated_at at time zone v_tz)::date, 'YYYY-MM-DD')
           ) as x
    from mkt_tasks t
    left join mkt_projects pr on pr.id = t.project_id
    left join profiles pf     on pf.id = t.assignee_id
    where t.organization_id = v_org
      and t.deleted_at is null
      and t.estado in ('hecha', 'hecho')
      and (t.updated_at at time zone v_tz)::date between v_desde and v_hasta
    limit 60
  ) s;

  -- 2) Cómo va cada proyecto (el % sale de sus tareas, no de una opinión) ─────
  select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb) into v_proyectos
  from (
    select jsonb_build_object(
             'nombre', pr.nombre,
             'entrega', to_char(pr.due_date, 'YYYY-MM-DD'),
             'total',  count(t.id),
             'hechas', count(t.id) filter (where t.estado in ('hecha','hecho')),
             'pct',    case when count(t.id) = 0 then 0
                            else round(100.0 * count(t.id) filter (where t.estado in ('hecha','hecho'))
                                       / count(t.id))::int end
           ) as x
    from mkt_projects pr
    left join mkt_tasks t on t.project_id = pr.id and t.deleted_at is null
    where pr.organization_id = v_org and pr.deleted_at is null
    group by pr.id, pr.nombre, pr.due_date
    limit 30
  ) s;

  -- 3) Objetivos comprometidos con el cliente ────────────────────────────────
  select coalesce(jsonb_agg(x order by x->>'titulo'), '[]'::jsonb) into v_objetivos
  from (
    select jsonb_build_object(
             'cliente', l.name,
             'titulo',  o.titulo,
             'meta',    o.meta,
             'actual',  o.actual,
             'unidad',  o.unidad,
             'pct',     case when coalesce(o.meta,0) = 0 then null
                             else least(100, round(100.0 * coalesce(o.actual,0) / o.meta)::int) end
           ) as x
    from client_objectives o
    left join leads l on l.id = o.lead_id
    where o.organization_id = v_org and o.deleted_at is null
    limit 30
  ) s;

  -- 4) Bitácora del cliente en el periodo ────────────────────────────────────
  select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into v_bitacora
  from (
    select jsonb_build_object(
             'cliente', l.name,
             'tipo',    u.tipo,
             'texto',   u.texto,
             'fecha',   to_char((u.created_at at time zone v_tz)::date, 'YYYY-MM-DD')
           ) as x
    from client_updates u
    left join leads l on l.id = u.lead_id
    where u.organization_id = v_org
      and u.deleted_at is null
      and (u.created_at at time zone v_tz)::date between v_desde and v_hasta
    order by u.created_at desc
    limit 40
  ) s;

  -- Cliente principal del periodo (para el encabezado del informe).
  select l.name into v_cliente
  from leads l where l.organization_id = v_org and l.deleted_at is null
  order by l.created_at limit 1;

  -- 5) y 6) Reuniones y cambios operativos: SOLO si esta empresa usa el cerebro.
  if v_cerebro then
    -- Reuniones: la fecha está en el nombre del archivo (memory/transcripts/AAAA-MM-DD-…).
    select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into v_reuniones
    from (
      select jsonb_build_object(
               'fecha',  substring(d.path from '(20[0-9]{2}-[0-9]{2}-[0-9]{2})'),
               'titulo', d.titulo
             ) as x
      from aios_docs d
      where d.carpeta = 'Reuniones'
        and substring(d.path from '(20[0-9]{2}-[0-9]{2}-[0-9]{2})') is not null
        and substring(d.path from '(20[0-9]{2}-[0-9]{2}-[0-9]{2})')::date between v_desde and v_hasta
      limit 25
    ) s;

    -- Cambios: las entradas del changelog cuya fecha cae en el periodo.
    -- Se parte por el guion de cada entrada («- AAAA-MM-DD - …») y se limpia el
    -- markdown, que en un informe para un CEO solo estorba.
    select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into v_cambios
    from (
      select jsonb_build_object(
               'fecha', substring(b.bloque from '^- (20[0-9]{2}-[0-9]{2}-[0-9]{2})'),
               'texto', left(
                          regexp_replace(
                            regexp_replace(b.bloque, '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2}\s*-\s*', ''),
                            '[*`>#]', '', 'g'),
                          900)
             ) as x
      from (
        select regexp_split_to_table(d.contenido, E'\n(?=- 20[0-9]{2}-)') as bloque
        from aios_docs d where d.path = 'memory/changelog.md'
      ) b
      where substring(b.bloque from '^- (20[0-9]{2}-[0-9]{2}-[0-9]{2})') is not null
        and substring(b.bloque from '^- (20[0-9]{2}-[0-9]{2}-[0-9]{2})')::date between v_desde and v_hasta
      limit 40
    ) s;
  else
    v_reuniones := '[]'::jsonb;
    v_cambios   := '[]'::jsonb;
  end if;

  -- 7) El borrador. Existe para que el informe NUNCA dependa de que la IA responda.
  v_n_ent := jsonb_array_length(v_entregas);

  v_borrador := 'INFORME DE AVANCES — ' || coalesce(v_empresa, 'la empresa') || E'\n'
    || 'Periodo: ' || to_char(v_desde, 'DD/MM/YYYY') || ' al ' || to_char(v_hasta, 'DD/MM/YYYY')
    || case when v_cliente is not null then '  ·  Cliente: ' || v_cliente else '' end || E'\n\n';

  v_borrador := v_borrador || 'EN UNA LÍNEA' || E'\n'
    || case when v_n_ent = 0
            then 'En este periodo no se cerró ninguna entrega registrada en el sistema.'
            else 'Se completaron ' || v_n_ent || ' entregas'
                 || case when jsonb_array_length(v_reuniones) > 0
                         then ' y se sostuvieron ' || jsonb_array_length(v_reuniones) || ' reuniones de trabajo'
                         else '' end || '.' end
    || E'\n\n';

  if v_n_ent > 0 then
    select string_agg('  • ' || (e->>'titulo')
                      || case when e->>'proyecto' is not null then ' (' || (e->>'proyecto') || ')' else '' end, E'\n')
      into v_lineas from jsonb_array_elements(v_entregas) e;
    v_borrador := v_borrador || 'LO QUE QUEDÓ FUNCIONANDO' || E'\n' || v_lineas || E'\n\n';
  end if;

  if jsonb_array_length(v_proyectos) > 0 then
    select string_agg('  • ' || (p->>'nombre') || ' — ' || (p->>'pct') || '% ('
                      || (p->>'hechas') || ' de ' || (p->>'total') || ' tareas)', E'\n'
                      order by (p->>'pct')::int desc)
      into v_lineas from jsonb_array_elements(v_proyectos) p;
    v_borrador := v_borrador || 'CÓMO VAN LOS PROYECTOS' || E'\n' || v_lineas || E'\n\n';
  end if;

  if jsonb_array_length(v_objetivos) > 0 then
    select string_agg('  • ' || (o->>'titulo') || ': ' || coalesce(o->>'actual','0')
                      || ' de ' || coalesce(o->>'meta','—') || ' ' || coalesce(o->>'unidad','')
                      || case when o->>'pct' is not null then ' (' || (o->>'pct') || '%)' else '' end, E'\n')
      into v_lineas from jsonb_array_elements(v_objetivos) o;
    v_borrador := v_borrador || 'OBJETIVOS CON EL CLIENTE' || E'\n' || v_lineas || E'\n\n';
  end if;

  if jsonb_array_length(v_reuniones) > 0 then
    select string_agg('  • ' || (r->>'fecha') || ' — ' || (r->>'titulo'), E'\n')
      into v_lineas from jsonb_array_elements(v_reuniones) r;
    v_borrador := v_borrador || 'REUNIONES DEL PERIODO' || E'\n' || v_lineas || E'\n\n';
  end if;

  return jsonb_build_object(
    'ok', true,
    'empresa', v_empresa,
    'cliente', v_cliente,
    'periodo', jsonb_build_object('desde', v_desde, 'hasta', v_hasta, 'dias', v_hasta - v_desde),
    'entregas', v_entregas,
    'proyectos', v_proyectos,
    'objetivos', v_objetivos,
    'bitacora', v_bitacora,
    'reuniones', v_reuniones,
    'cambios', v_cambios,
    'borrador', v_borrador
  );
end
$fn$;

grant execute on function public.fn_informe_avances(uuid, int) to authenticated, anon, service_role;

-- NSG es la empresa dueña del cerebro: su informe sí puede leerlo.
update organizations
   set meta_config = coalesce(meta_config, '{}'::jsonb) || jsonb_build_object('usa_cerebro_aios', true)
 where id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc';
