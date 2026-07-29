-- ─────────────────────────────────────────────────────────────────────────────
-- El informe quincenal, con el molde con el que se le manda a RH de Duke.
--
-- Pedido de Ángel (29-jul): «básate en el documento de Word, así es como hemos
-- estado enviando los reportes a RH de Duke del Caribe para liberar la nómina…
-- necesitamos que se genere automáticamente, y sobre todo la redacción, que sean
-- entendibles los avances, día a día. También si algo se hizo el domingo, pásalo
-- para el sábado… y solo lo que hacemos con Stratos Capital Group y Duke del
-- Caribe, no metas Vega ni Gvintell.»
--
-- Lo que cambia respecto de la 170/171:
--
--   1. RANGO DE FECHAS. Antes solo se podía pedir «últimos N días». Ahora se
--      puede pedir un periodo exacto (p_desde / p_hasta) — que es como se factura:
--      del 30 de junio al 14 de julio, no «los últimos 15 días».
--
--   2. LA EVIDENCIA LLEGA HASTA ATRÁS. Antes la función solo leía
--      `memory/changelog.md`. El archivador lo recorta a 40 entradas y, como se
--      escriben 13-20 por día, eso deja SEIS días de historia. Un informe
--      quincenal se quedaba sin la mitad del periodo y nadie se enteraba: salía
--      igual, solo que corto. Ahora también lee `memory/changelog-archive-*`.
--
--   3. DÍA A DÍA. La evidencia se agrupa por día con su nombre en español y su
--      número de semana dentro del periodo. Es la espina del documento: cada día
--      es una viñeta.
--
--   4. EL DOMINGO SE REPORTA EL SÁBADO. Los domingos no se trabaja; a veces sí.
--      Cuando pasa, ese trabajo aparece bajo el sábado — es una decisión de cómo
--      se cuenta, no un borrado: `fecha_real` queda guardada en cada hecho.
--
--   5. ALCANCE. El informe es de lo que hacemos para Stratos Capital Group y Duke
--      del Caribe. Lo de otros clientes (Gvintell, TGenius, Vega, Grupo 28) no
--      entra. ⚠️ El filtro NO puede ser un «contiene gvintell»: el cerebro del
--      CRM de Duke se llama `bot_nlu_dispatch_gvintell` y aparece en 35 de las 65
--      menciones. Se exige palabra suelta (no pegada a `_`) Y que la entrada no
--      hable además de lo nuestro. Las listas viven en `meta_config` para poder
--      afinarlas por empresa sin migrar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: ¿esta evidencia es del alcance del informe? ──────────────────────
-- Regla: si nombra a otro cliente Y NO nombra nada nuestro, queda fuera. Si
-- habla de los dos, entra (el redactor tiene la orden de contar solo la parte
-- nuestra). Preferimos incluir de más y que el redactor recorte, antes que
-- borrar en silencio trabajo que sí se hizo.
create or replace function public.fn_informe_en_alcance(
  p_texto   text,
  p_ajenos  text[],
  p_propios text[]
)
returns boolean
language sql
immutable
as $fn$
  with
  -- «palabra suelta»: no pegada a letra, número ni guion bajo. Así
  -- `bot_nlu_dispatch_gvintell` (el cerebro de Duke) no cuenta como Gvintell,
  -- y «navegador» no cuenta como Vega.
  ajeno as (
    select exists (
      select 1 from unnest(p_ajenos) k
      where p_texto ~* ('(^|[^a-z0-9_áéíóúñ])' || k || '([^a-z0-9_áéíóúñ]|$)')
    ) as v
  ),
  propio as (
    select exists (
      select 1 from unnest(p_propios) k
      where p_texto ~* ('(^|[^a-z0-9_áéíóúñ])' || k || '([^a-z0-9_áéíóúñ]|$)')
    ) as v
  )
  select (not (select v from ajeno)) or (select v from propio);
$fn$;

grant execute on function public.fn_informe_en_alcance(text, text[], text[]) to authenticated, anon, service_role;


-- La firma cambia (se suman p_desde/p_hasta), así que la versión de 2 argumentos
-- tiene que irse: si quedaran las dos, una llamada con `p_profile_id + p_dias`
-- calzaría en ambas y Postgres respondería «function is not unique».
-- Es una FUNCIÓN, no datos: su código completo está en las migraciones 170/171 y
-- se restaura corriéndolas de nuevo. Único consumidor verificado: InformeAvances.jsx.
drop function if exists public.fn_informe_avances(uuid, int);

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

  -- Indexado por isodow: 1 = lunes … 7 = domingo.
  c_dow_es constant text[] := array['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  c_mes_es constant text[] := array['enero','febrero','marzo','abril','mayo','junio',
                                    'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  -- Defaults del alcance. Se pueden pisar por empresa desde `meta_config`.
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

  -- Listas de alcance: lo que diga la empresa, o los defaults.
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

  -- El periodo: si mandan fechas, mandan las fechas. Si no, «últimos N días».
  if p_desde is not null and p_hasta is not null then
    v_desde := least(p_desde, p_hasta);
    v_hasta := greatest(p_desde, p_hasta);
  else
    v_hasta := (now() at time zone v_tz)::date;
    v_desde := v_hasta - greatest(coalesce(p_dias, 15), 1);
  end if;

  -- Techo de cordura: nadie pide un informe de tres años, y si lo pide es un
  -- error de tipeo que tumbaría la consulta.
  if v_hasta - v_desde > 400 then
    v_desde := v_hasta - 400;
  end if;

  -- 1) Lo que se cerró en el periodo ──────────────────────────────────────────
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

  -- 2) Cómo va cada proyecto (el % sale de sus tareas, no de una opinión) ─────
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
    limit 80
  ) s;

  select l.name into v_cliente
  from leads l where l.organization_id = v_org and l.deleted_at is null
  order by l.created_at limit 1;

  -- 5) y 6) Reuniones y cambios operativos: SOLO si esta empresa usa el cerebro.
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

    -- Cambios: el changelog VIVO más los archivos. El archivador deja solo ~40
    -- entradas en el vivo (≈ 3 días); sin los archivos, un informe quincenal se
    -- arma con la última semana y parece que no se hizo nada antes.
    select coalesce(jsonb_agg(x order by (x->>'fecha') desc, (x->>'peso')::int desc), '[]'::jsonb) into v_cambios
    from (
      select jsonb_build_object(
               'fecha', f,
               -- `peso` = el largo ORIGINAL de la entrada, antes de recortar. Es
               -- el criterio para elegir qué se le manda al redactor: si se
               -- ordenara por el texto ya recortado, todo empata en 420 y la
               -- elección se vuelve azar.
               'peso',  length(b.bloque),
               'texto', left(
                          regexp_replace(
                            regexp_replace(b.bloque, '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2}\s*-\s*', ''),
                            -- El `]` va primero: dentro de una clase, pegado al
                            -- corchete de apertura, es un caracter literal.
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

  -- 7) LA ESPINA DEL DOCUMENTO: un renglón por día ────────────────────────────
  -- Todo lo de arriba se vuelca a una sola lista de hechos, y de ahí se agrupa
  -- por día hábil. `fecha_real` se conserva: el domingo se CUENTA en el sábado,
  -- no se borra, y si alguien pregunta se puede mostrar cuándo pasó de verdad.
  with hechos as (
    select (e->>'fecha')::date as fecha, 'entrega' as tipo,
           (e->>'titulo') as titulo,
           coalesce(e->>'proyecto','') as detalle,
           1000000 as peso                       -- una entrega cerrada siempre pesa
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
  -- El domingo (isodow 7) se reporta el sábado.
  corridos as (
    select *,
           case when extract(isodow from fecha) = 7 then fecha - 1 else fecha end as habil
      from hechos
  ),
  -- Máximo 8 hechos por día, los más sustanciosos primero. Sin este tope un
  -- periodo de 15 días manda 200 entradas al redactor y el prompt se vuelve
  -- impagable — y encima el modelo se pierde en el ruido.
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha',  to_char(habil, 'YYYY-MM-DD'),
           'dia',    c_dow_es[extract(isodow from habil)::int],
           'numero', extract(day from habil)::int,
           'mes',    c_mes_es[extract(month from habil)::int],
           'semana', (floor((habil - v_desde) / 7) + 1)::int,
           'hechos', hechos
         ) order by habil), '[]'::jsonb)
    into v_dias
  from por_dia;

  v_n_dias := jsonb_array_length(v_dias);

  -- Las semanas del periodo, para que el redactor sepa cuántos bloques armar.
  select coalesce(jsonb_agg(jsonb_build_object(
           'semana', s, 'desde', to_char(d0, 'YYYY-MM-DD'), 'hasta', to_char(d1, 'YYYY-MM-DD')
         ) order by s), '[]'::jsonb)
    into v_semanas
  from (
    select s,
           v_desde + (s - 1) * 7                       as d0,
           least(v_desde + s * 7 - 1, v_hasta)         as d1
    from generate_series(1, greatest(1, ceil((v_hasta - v_desde + 1) / 7.0)::int)) s
  ) w;

  -- 8) El borrador. Existe para que el informe NUNCA dependa de que la IA
  --    responda. Ya sale con la forma del documento: periodo, día a día por
  --    semana, y cierre. Feo comparado con el redactado, pero enviable.
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
             (d->>'dia') || ' ' || (d->>'numero') || ' — '
             -- El LIMIT tiene que ir en la subconsulta que produce las FILAS.
             -- Colgado del string_agg recortaría el resultado ya agregado (una
             -- fila), o sea: no recortaría nada.
             || coalesce((
                  select string_agg(t, '; ')
                    from (
                      select coalesce(nullif(h->>'titulo',''), left(h->>'detalle', 160)) as t
                        from jsonb_array_elements(d->'hechos') h
                       limit 3
                    ) z), 'sin registro') as linea
        from jsonb_array_elements(v_dias) d
    ) x;
    v_borrador := v_borrador || 'TRABAJO REALIZADO, DÍA A DÍA' || E'\n' || v_lineas || E'\n\n';
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

  return jsonb_build_object(
    'ok', true,
    'empresa', v_empresa,
    'cliente', v_cliente,
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

comment on function public.fn_informe_avances(uuid, int, date, date) is
  'Evidencia del informe de avances, agrupada día a día. El domingo se reporta en el sábado. Solo alcance propio (ver fn_informe_en_alcance).';
