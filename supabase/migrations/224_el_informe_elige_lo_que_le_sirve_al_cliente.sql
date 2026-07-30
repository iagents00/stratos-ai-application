-- El informe elige QUÉ contar, no solo cómo contarlo.
--
-- Ángel (30-jul), sobre el reporte del 15 al 30 de julio: «no pongas eso de que
-- a pedido de Ángel, ni a pedido de Iván… y cosas como la segunda imagen no dan
-- valor de nada. ¿De qué le sirve a Yolanda de RRHH que un documento Word sin
-- daños? Ella ni va a entender eso.»
--
-- Tenía razón, y el problema estaba más abajo de lo que parecía. No es que el
-- redactor escribiera mal: es que le entregábamos mal la materia prima.
--
-- Cómo se elegían los hechos de cada día hasta hoy: primero las entregas, luego
-- las reuniones, luego la bitácora y al final el changelog, y DENTRO del
-- changelog ordenados por `peso`, que era `length(bloque)` — el texto más largo
-- primero. Pero en nuestro changelog las entradas más largas son justamente las
-- más técnicas: el debugging profundo, la corrupción del Word, el modelo que
-- falló de tres formas. Las entradas cortas y jugosas para el cliente («la foto
-- de la evidencia ya llega al chat») quedaban abajo del corte.
--
-- Como al redactor solo le llegan los primeros hechos de cada día, lo único que
-- veía era plomería. Por bien que escriba, no puede contar lo que no le dieron:
-- de ahí salieron «Documentos Word sin daños» y «Logo oficial como lo pidió
-- Oscar». El filtro del prompt (ya publicado en el flujo del redactor) le enseña
-- a descartar eso; esta migración se asegura de que además tenga con qué
-- reemplazarlo.
--
-- Qué cambia: el changelog deja de ordenarse por largo y pasa a ordenarse por
-- VALOR PARA EL CLIENTE. El largo queda solo como desempate.
--
-- Ojo con lo que NO cambia: esto es RANKING, no censura. Nada se borra —
-- las entradas internas siguen ahí, más abajo. Y el puntaje solo toca el
-- changelog: las entregas, las reuniones y la bitácora conservan su prioridad
-- de siempre, porque ésas ya vienen escritas en el idioma del cliente.
--
-- Revertir: `create or replace` de esta misma función con el `order by ... peso
-- desc` anterior. No toca datos, solo el orden en que se leen.


-- ¿Qué tan útil es esta línea del changelog para alguien de Duke que no es
-- técnico? No pretende ser inteligente: pretende separar «lo que el equipo del
-- cliente puede ver y usar» de «nuestras tripas».
create or replace function public.fn_informe_valor_cliente(p_texto text)
returns int
language sql
immutable
as $fn$
  select
      -- +3: nombra algo que una persona de Duke toca con las manos.
      case when lower(coalesce(p_texto,'')) ~
        ('duke|alex|asesor|gerente|copilot|crm|whatsapp|marketing|propiedad'
         || '|registro|lead|agenda|manual|notificaci|campanita|push|dictado'
         || '|expediente|pipeline|tablero|bit[áa]cora|evidencia|chat'
         || '|iphone|android|apk|m[óo]vil|app ')
      then 3 else 0 end
    -- -2: el sujeto de la entrada somos NOSOTROS, o es maquinaria que el
    --     cliente jamás ve. No se descarta: se manda al fondo de la fila.
    + case when lower(coalesce(p_texto,'')) ~
        ('aios|cerebro|skill|changelog|cuaderno de decisiones|operador'
         || '|prospecci|f[áa]brica de video|remotion|elevenlabs|vps'
         || '|backup|respaldo|corrupt|da[ñn]ad|base64|transporte'
         || '|regresi[óo]n|refactor|auditor[íi]a|service worker|logo')
      then -2 else 0 end;
$fn$;

comment on function public.fn_informe_valor_cliente(text) is
  'Puntaje de utilidad para el cliente de una entrada del changelog. Ordena, no borra.';


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
  c_propios constant text[] := array['duke','duque','stratos','nsg','marketing','copilot','crm',
                                     'brasa','mueble','mueblar','muebler[ií]a','legacy','nk23',
                                     'casa lago','asesor','asesores','whatsapp'];
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

    -- El texto se limpia con `fn_texto_presentable` (emojis, PR 123, SW v302,
    -- migraciones, rutas y enlaces fuera) ANTES de puntuarlo y de mandarlo, para
    -- que el puntaje mire el contenido y no la decoración.
    select coalesce(jsonb_agg(x order by (x->>'valor')::int desc, (x->>'peso')::int desc),
                    '[]'::jsonb) into v_cambios
    from (
      select jsonb_build_object(
               'fecha', f,
               'peso',  length(b.bloque),
               'valor', public.fn_informe_valor_cliente(b.bloque),
               'texto', left(public.fn_texto_presentable(
                          regexp_replace(b.bloque, '^- 20[0-9]{2}-[0-9]{2}-[0-9]{2}\s*-\s*', '')
                        ), 420)
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
           (e->>'titulo') as titulo, coalesce(e->>'proyecto','') as detalle,
           1000000 as peso, 0 as valor
      from jsonb_array_elements(v_entregas) e
    union all
    select (c->>'fecha')::date, 'cambio', null, (c->>'texto'),
           (c->>'peso')::int, coalesce((c->>'valor')::int, 0)
      from jsonb_array_elements(v_cambios) c
    union all
    select (r->>'fecha')::date, 'reunion', (r->>'titulo'), '', 1000000, 0
      from jsonb_array_elements(v_reuniones) r
    union all
    select (b->>'fecha')::date, 'bitacora',
           coalesce(b->>'cliente',''), (b->>'texto'),
           length(coalesce(b->>'texto','')), 0
      from jsonb_array_elements(v_bitacora) b
  ),
  corridos as (
    select *, case when extract(isodow from fecha) = 7 then fecha - 1 else fecha end as habil
      from hechos
  ),
  rankeados as (
    -- El tipo manda igual que antes (entrega > reunión > bitácora > changelog).
    -- Lo nuevo es el desempate DENTRO del changelog: primero lo que le sirve al
    -- cliente, y recién después lo más largo.
    select *, row_number() over (
             partition by habil
             order by case tipo when 'entrega' then 1 when 'reunion' then 2
                                when 'bitacora' then 3 else 4 end,
                      valor desc,
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

  -- Los porcentajes de proyectos y los objetivos ya NO van al borrador: Ángel los
  -- sacó del molde («quita eso de CÓMO VAN LOS PROYECTOS / OBJETIVOS CON EL
  -- CLIENTE»). Los datos siguen viajando en el JSON para quien los quiera; lo que
  -- se quitó es que aparecieran solos en el documento.

  return jsonb_build_object(
    'ok', true,
    'empresa', v_empresa,
    'cliente', v_cliente,
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

comment on function public.fn_informe_avances(uuid, int, date, date) is
  'Evidencia del informe de avances, día a día. El changelog se ordena por valor para el cliente, no por largo.';
