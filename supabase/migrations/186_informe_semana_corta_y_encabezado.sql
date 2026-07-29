-- ─────────────────────────────────────────────────────────────────────────────
-- Dos remates del informe quincenal, encontrados probándolo contra el periodo
-- real del documento de referencia (30 jun → 14 jul):
--
--   1. LA SEMANA HUÉRFANA. Un periodo de 15 días cae en tres cubos de 7, y el
--      tercero se queda con UN día. En el documento eso sale como «Semana 3 —»
--      con una sola viñeta, que se lee como un error. Si el último bloque tiene
--      menos de 3 días, se suma al anterior. Además las semanas ahora se derivan
--      de los días que de verdad tuvieron trabajo, no de aritmética sobre el
--      rango: así lo que dice la cabecera de cada semana siempre coincide con
--      las viñetas que la siguen.
--
--   2. EL ENCABEZADO NO SE INVENTA. «Responsables» y «Proyecto» son parte del
--      molde con el que se le manda el reporte a RH de Duke. Si no se los damos
--      al redactor, o los omite o se los inventa — y un nombre inventado en el
--      papel con el que se libera la nómina es exactamente lo que no puede
--      pasar. Ahora salen de `meta_config` de la empresa, como dato.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_informe_avances(
  p_profile_id uuid,
  p_dias       int  default 15,
  p_desde      date default null,
  p_hasta      date default null
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
  v_meta      jsonb;
  v_ajenos    text[];
  v_propios   text[];
  v_hasta     date;
  v_desde     date;
  v_entregas  jsonb;
  v_proyectos jsonb;
  v_objetivos jsonb;
  v_bitacora  jsonb;
  v_reuniones jsonb;
  v_cambios   jsonb;
  v_dias      jsonb;
  v_semanas   jsonb;
  v_cliente   text;
  v_borrador  text;
  v_lineas    text;
  v_n_ent     int;
  v_n_dias    int;

  c_dow_es constant text[] := array['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  c_mes_es constant text[] := array['enero','febrero','marzo','abril','mayo','junio',
                                    'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  c_ajenos  constant text[] := array['gvintell','tgenius','t-genius','gbs','vega','grupo ?28'];
  -- ⚠️ SOLO nombres que IDENTIFICAN a un cliente nuestro. Nada de palabras
  -- genéricas del producto (stratos a secas, crm, asesor, marketing, whatsapp):
  -- `stratos-prod` es la base de TODOS los inquilinos, así que una entrada de
  -- Constructora Vega que la nombrara se colaba como si fuera nuestra. Es la
  -- misma trampa que `bot_nlu_dispatch_gvintell`, en el otro sentido.
  c_propios constant text[] := array['duke','duque','nsg','stratos capital','iagents',
                                     'brasa','mueble','mueblar','muebler[ií]a','legacy',
                                     'nk23','casa lago'];
begin
  select p.organization_id into v_org from profiles p where p.id = p_profile_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.');
  end if;

  select o.name,
         coalesce((o.meta_config->>'usa_cerebro_aios')::boolean, false),
         coalesce(o.meta_config, '{}'::jsonb)
    into v_empresa, v_cerebro, v_meta
  from organizations o where o.id = v_org;

  select coalesce(
           (select array_agg(v) from jsonb_array_elements_text(v_meta->'informe_fuera_de_alcance') as t(v)
             where jsonb_typeof(v_meta->'informe_fuera_de_alcance') = 'array'),
           c_ajenos)
    into v_ajenos;
  select coalesce(
           (select array_agg(v) from jsonb_array_elements_text(v_meta->'informe_en_alcance') as t(v)
             where jsonb_typeof(v_meta->'informe_en_alcance') = 'array'),
           c_propios)
    into v_propios;

  v_tz := coalesce(public.fn_tz_de(p_profile_id), 'America/Bogota');

  if p_desde is not null and p_hasta is not null then
    v_desde := least(p_desde, p_hasta);
    v_hasta := greatest(p_desde, p_hasta);
  else
    v_hasta := (now() at time zone v_tz)::date;
    v_desde := v_hasta - greatest(coalesce(p_dias, 15), 1);
  end if;

  if v_hasta - v_desde > 400 then
    v_desde := v_hasta - 400;
  end if;

  select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into v_entregas
  from (
    select jsonb_build_object(
             'titulo',   t.titulo,
             'proyecto', pr.nombre,
             'quien',    pf.name,
             'fecha',    to_char((t.updated_at at time zone v_tz)::date, 'YYYY-MM-DD')
           ) as x
    from mkt_tasks t
    left join mkt_projects pr on pr.id = t.project_id
    left join profiles pf     on pf.id = t.assignee_id
    where t.organization_id = v_org
      and t.deleted_at is null
      and t.estado in ('hecha', 'hecho')
      and (t.updated_at at time zone v_tz)::date between v_desde and v_hasta
    order by t.updated_at desc
    limit 200
  ) s;

  select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb) into v_proyectos
  from (
    select jsonb_build_object(
             'nombre',  pr.nombre,
             'entrega', to_char(pr.due_date, 'YYYY-MM-DD'),
             'total',   count(t.id),
             'hechas',  count(t.id) filter (where t.estado in ('hecha','hecho')),
             'pct',     case when count(t.id) = 0 then 0
                             else round(100.0 * count(t.id) filter (where t.estado in ('hecha','hecho'))
                                        / count(t.id))::int end
           ) as x
    from mkt_projects pr
    left join mkt_tasks t on t.project_id = pr.id and t.deleted_at is null
    where pr.organization_id = v_org and pr.deleted_at is null
    group by pr.id, pr.nombre, pr.due_date
    limit 30
  ) s;

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
    limit 80
  ) s;

  select l.name into v_cliente
  from leads l where l.organization_id = v_org and l.deleted_at is null
  order by l.created_at limit 1;

  if v_cerebro then
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
        and public.fn_informe_en_alcance(d.titulo, v_ajenos, v_propios)
      limit 40
    ) s;

    select coalesce(jsonb_agg(x order by (x->>'fecha') desc, (x->>'peso')::int desc), '[]'::jsonb) into v_cambios
    from (
      select jsonb_build_object(
               'fecha', f,
               'peso',  length(b.bloque),
               'texto', left(
                          regexp_replace(
                            regexp_replace(b.bloque, '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2}\s*-\s*', ''),
                            '[]*`>#[]', '', 'g'),
                          420)
             ) as x
      from (
        select regexp_split_to_table(d.contenido, E'\n(?=- 20[0-9]{2}-)') as bloque
        from aios_docs d
        where d.path = 'memory/changelog.md'
           or d.path like 'memory/changelog-archive-%'
      ) b
      cross join lateral (
        select substring(b.bloque from '^- (20[0-9]{2}-[0-9]{2}-[0-9]{2})') as f
      ) g
      where g.f is not null
        and g.f::date between v_desde and v_hasta
        and public.fn_informe_en_alcance(b.bloque, v_ajenos, v_propios)
      limit 400
    ) s;
  else
    v_reuniones := '[]'::jsonb;
    v_cambios   := '[]'::jsonb;
  end if;

  with hechos as (
    select (e->>'fecha')::date as fecha, 'entrega' as tipo,
           (e->>'titulo') as titulo, coalesce(e->>'proyecto','') as detalle, 1000000 as peso
      from jsonb_array_elements(v_entregas) e
    union all
    select (c->>'fecha')::date, 'cambio', null, (c->>'texto'), (c->>'peso')::int
      from jsonb_array_elements(v_cambios) c
    union all
    select (r->>'fecha')::date, 'reunion', (r->>'titulo'), '', 1000000
      from jsonb_array_elements(v_reuniones) r
    union all
    select (b->>'fecha')::date, 'bitacora',
           coalesce(b->>'cliente',''), (b->>'texto'), length(coalesce(b->>'texto',''))
      from jsonb_array_elements(v_bitacora) b
  ),
  corridos as (
    select *, case when extract(isodow from fecha) = 7 then fecha - 1 else fecha end as habil
      from hechos
  ),
  rankeados as (
    select *, row_number() over (
             partition by habil
             order by case tipo when 'entrega' then 1 when 'reunion' then 2
                                when 'bitacora' then 3 else 4 end,
                      peso desc) as rn
      from corridos
  ),
  por_dia as (
    select habil,
           jsonb_agg(jsonb_build_object(
             'tipo', tipo, 'titulo', titulo, 'detalle', detalle,
             'movido_del_domingo', habil <> fecha
           ) order by rn) as hechos
      from rankeados
     where rn <= 8
     group by habil
  ),
  crudo as (
    select habil, hechos, (floor((habil - v_desde) / 7) + 1)::int as semana from por_dia
  ),
  -- La cola corta se pega a la semana anterior: un bloque «Semana 3» con un solo
  -- día no es una semana, es un renglón suelto.
  cola as (
    select max(semana) as ultima,
           count(*) filter (where semana = (select max(semana) from crudo)) as dias_ultima
      from crudo
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha',  to_char(c.habil, 'YYYY-MM-DD'),
           'dia',    c_dow_es[extract(isodow from c.habil)::int],
           'numero', extract(day from c.habil)::int,
           'mes',    c_mes_es[extract(month from c.habil)::int],
           'semana', case when c.semana = k.ultima and k.ultima > 1 and k.dias_ultima < 3
                          then k.ultima - 1 else c.semana end,
           'hechos', c.hechos
         ) order by c.habil), '[]'::jsonb)
    into v_dias
  from crudo c cross join cola k;

  v_n_dias := jsonb_array_length(v_dias);

  -- Las semanas se leen de los días que de verdad hubo, para que el encabezado
  -- de cada bloque nunca prometa un rango que después no tiene viñetas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'semana', s, 'desde', d0, 'hasta', d1, 'dias', n) order by s), '[]'::jsonb)
    into v_semanas
  from (
    select (d->>'semana')::int as s, min(d->>'fecha') as d0, max(d->>'fecha') as d1, count(*) as n
      from jsonb_array_elements(v_dias) d
     group by 1
  ) z;

  v_n_ent := jsonb_array_length(v_entregas);

  v_borrador := 'REPORTE DE AVANCES — ' || coalesce(v_empresa, 'la empresa') || E'\n'
    || 'Periodo: ' || to_char(v_desde, 'DD/MM/YYYY') || ' al ' || to_char(v_hasta, 'DD/MM/YYYY')
    || case when v_cliente is not null then '  ·  Cliente: ' || v_cliente else '' end || E'\n\n';

  v_borrador := v_borrador || 'RESUMEN GENERAL' || E'\n'
    || case when v_n_dias = 0
            then 'En este periodo no quedó registrado trabajo en el sistema.'
            else 'Se trabajó en ' || v_n_dias || ' jornadas'
                 || case when v_n_ent > 0 then ', con ' || v_n_ent || ' entregas cerradas' else '' end
                 || case when jsonb_array_length(v_reuniones) > 0
                         then ' y ' || jsonb_array_length(v_reuniones) || ' reuniones de trabajo'
                         else '' end || '.' end
    || E'\n\n';

  if v_n_dias > 0 then
    select string_agg(linea, E'\n' order by ord) into v_lineas
    from (
      select (d->>'fecha') as ord,
             '• ' || (d->>'dia') || ' ' || (d->>'numero') || ' — '
             || coalesce((
                  select string_agg(t, '; ')
                    from (
                      select coalesce(nullif(h->>'titulo',''), left(h->>'detalle', 160)) as t
                        from jsonb_array_elements(d->'hechos') h
                       limit 3
                    ) z), 'sin registro') as linea
        from jsonb_array_elements(v_dias) d
    ) x;
    v_borrador := v_borrador || 'PARTE 1 — TRABAJO REALIZADO' || E'\n' || v_lineas || E'\n\n';
  end if;

  if jsonb_array_length(v_proyectos) > 0 then
    select string_agg('• ' || (p->>'nombre') || ' — ' || (p->>'pct') || '% ('
                      || (p->>'hechas') || ' de ' || (p->>'total') || ' tareas)', E'\n'
                      order by (p->>'pct')::int desc)
      into v_lineas from jsonb_array_elements(v_proyectos) p;
    v_borrador := v_borrador || 'CÓMO VAN LOS PROYECTOS' || E'\n' || v_lineas || E'\n\n';
  end if;

  if jsonb_array_length(v_objetivos) > 0 then
    select string_agg('• ' || (o->>'titulo') || ': ' || coalesce(o->>'actual','0')
                      || ' de ' || coalesce(o->>'meta','—') || ' ' || coalesce(o->>'unidad','')
                      || case when o->>'pct' is not null then ' (' || (o->>'pct') || '%)' else '' end, E'\n')
      into v_lineas from jsonb_array_elements(v_objetivos) o;
    v_borrador := v_borrador || 'OBJETIVOS CON EL CLIENTE' || E'\n' || v_lineas || E'\n\n';
  end if;

  return jsonb_build_object(
    'ok', true,
    'empresa', v_empresa,
    'cliente', v_cliente,
    -- El encabezado del molde. Sale de `meta_config`, nunca del modelo.
    'encabezado', jsonb_build_object(
      'titulo',       coalesce(v_meta->>'informe_titulo', 'REPORTE DE AVANCES DE ' || coalesce(v_empresa,'')),
      'responsables', v_meta->>'informe_responsables',
      'proyecto',     v_meta->>'informe_proyecto'
    ),
    'periodo', jsonb_build_object(
      'desde', v_desde, 'hasta', v_hasta, 'dias', v_hasta - v_desde + 1,
      'desde_largo', extract(day from v_desde)::int || ' de ' || c_mes_es[extract(month from v_desde)::int]
                     || ' de ' || extract(year from v_desde)::int,
      'hasta_largo', extract(day from v_hasta)::int || ' de ' || c_mes_es[extract(month from v_hasta)::int]
                     || ' de ' || extract(year from v_hasta)::int
    ),
    'semanas',  v_semanas,
    'dias',     v_dias,
    'entregas', v_entregas,
    'proyectos', v_proyectos,
    'objetivos', v_objetivos,
    'bitacora', v_bitacora,
    'reuniones', v_reuniones,
    'cambios',  v_cambios,
    'borrador', v_borrador
  );
end
$fn$;

grant execute on function public.fn_informe_avances(uuid, int, date, date) to authenticated, anon, service_role;

-- El encabezado real de NSG, tal cual viene en los reportes que ya se enviaron.
update organizations
   set meta_config = coalesce(meta_config, '{}'::jsonb) || jsonb_build_object(
         'informe_titulo',       'REPORTE DE AVANCES DE NSG',
         'informe_responsables', 'Iván Rodríguez (Dirección y Estrategia) y Ángel Garzón Sarzosa (Ejecución y Comercial)',
         'informe_proyecto',     'Duke del Caribe + Stratos AI')
 where id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc';
