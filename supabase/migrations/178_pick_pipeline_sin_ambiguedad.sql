-- 178 — Fix: "column reference nombre is ambiguous" al buscar una propiedad
--
-- Cazado en la prueba, antes de que lo viera nadie: `_mkt_pick_pipeline`
-- devolvía una tabla con columnas `id` y `nombre`, iguales a las de
-- mkt_pipeline_items. Dentro del cuerpo Postgres no sabía si `nombre` era la
-- columna de la tabla o la de salida, y TODA la ficha reventaba — tanto leerla
-- como escribirla.
--
-- Regla para el resto del cerebro: en un RETURNS TABLE, nunca uses nombres de
-- salida iguales a las columnas que vas a consultar adentro. Se prefijan `o_`.
--
-- (Es la hermana de la lección de la migración 175: los dos bugs de este día
-- salieron de plpgsql y los dos los cazó la prueba, no el usuario.)
--
-- Acá quedan en su forma VIGENTE las tres funciones de la ficha.

drop function if exists public._mkt_pick_pipeline(uuid, text);

create or replace function public._mkt_pick_pipeline(p_org uuid, p_nombre text)
returns table (o_id uuid, o_nombre text, o_varias text)
language plpgsql
stable
as $$
declare v_n int; v_opts text;
begin
  select count(*) into v_n from mkt_pipeline_items mp
  where mp.organization_id = p_org and mp.deleted_at is null and mp.nombre ilike '%'||p_nombre||'%';

  if v_n = 0 then
    return query select null::uuid, null::text, 'NINGUNA'::text; return;
  end if;

  if v_n > 1 then
    select string_agg(s.nombre, ' · ') into v_opts from (
      select mp.nombre from mkt_pipeline_items mp
      where mp.organization_id = p_org and mp.deleted_at is null and mp.nombre ilike '%'||p_nombre||'%'
      limit 4) s;
    return query select null::uuid, null::text, v_opts; return;
  end if;

  return query
    select mp.id, mp.nombre, null::text from mkt_pipeline_items mp
    where mp.organization_id = p_org and mp.deleted_at is null and mp.nombre ilike '%'||p_nombre||'%'
    limit 1;
end $$;

create or replace function public.fn_mkt_pipeline_set(
  p_profile_id uuid, p_nombre text, p_campo text, p_valor text
) returns text
language plpgsql
as $$
declare v_org uuid; v_p record; v_campo text; v_val text; v_fecha date;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(btrim(p_nombre),'') = '' then return '¿De qué propiedad?'; end if;

  select * into v_p from _mkt_pick_pipeline(v_org, p_nombre);
  if v_p.o_varias = 'NINGUNA' then
    return 'No encontré ninguna propiedad que se llame como «'||p_nombre||'» en el pipeline.';
  elsif v_p.o_varias is not null then
    return 'Hay varias que coinciden: '||v_p.o_varias||'. ¿Cuál exactamente?';
  end if;

  -- Se acepta el nombre HUMANO del campo, no solo el técnico: la gente dice
  -- "los crudos", no "crudos_url".
  v_campo := lower(btrim(coalesce(p_campo,'')));
  v_campo := case
    when v_campo in ('precio','valor') then 'precio'
    when v_campo in ('tipo','tipo de propiedad') then 'tipo'
    when v_campo in ('ubicacion','ubicación','locacion','locación','zona') then 'locacion'
    when v_campo in ('rodaje','fecha_rodaje','fecha de rodaje','grabacion','grabación') then 'fecha_rodaje'
    when v_campo in ('publicacion','publicación','fecha_publicacion','fecha de publicacion','fecha de publicación') then 'fecha_publicacion'
    when v_campo in ('crudos','crudos_url','carpeta de crudos','carpeta crudos') then 'crudos_url'
    when v_campo in ('video','video_url','video editado','link de video') then 'video_url'
    when v_campo in ('ig','instagram','reel','ig_url') then 'ig_url'
    when v_campo in ('story','story_url','historia') then 'story_url'
    when v_campo in ('cine','cine_url','version cine','versión cine') then 'cine_url'
    when v_campo in ('ficha','ficha_url','ficha tecnica','ficha técnica') then 'ficha_url'
    when v_campo in ('info','info_url','informacion','información','carpeta de informacion') then 'info_url'
    when v_campo in ('drive','drive_url','carpeta') then 'drive_url'
    when v_campo in ('notas','nota','comentario') then 'notas'
    else null end;
  if v_campo is null then
    return 'No sé qué es «'||coalesce(p_campo,'')||'». Puedo guardar: precio, tipo, ubicación, fecha de rodaje, '||
           'fecha de publicación, crudos, video, reel, story, cine, ficha técnica, información, drive o notas.';
  end if;

  v_val := nullif(btrim(coalesce(p_valor,'')), '');

  if v_campo in ('fecha_rodaje','fecha_publicacion') then
    begin v_fecha := v_val::date; exception when others then
      return 'No entendí la fecha «'||coalesce(v_val,'')||'». Decímela como año-mes-día.'; end;
    if v_campo = 'fecha_rodaje'
      then update mkt_pipeline_items set fecha_rodaje=v_fecha, updated_at=now() where id=v_p.o_id;
      else update mkt_pipeline_items set fecha_publicacion=v_fecha, updated_at=now() where id=v_p.o_id; end if;
  else
    execute format('update mkt_pipeline_items set %I = $1, updated_at = now() where id = $2', v_campo)
      using v_val, v_p.o_id;
  end if;

  return 'Listo, guardé '||replace(v_campo,'_',' ')||' en «'||v_p.o_nombre||'»'||
         case when v_val is null then ' (quedó vacío).' else ': '||v_val end;
end $$;

create or replace function public.fn_mkt_pipeline_ficha(p_profile_id uuid, p_nombre text)
returns text
language plpgsql
stable
as $$
declare v_org uuid; v_p record; it record; out_txt text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select * into v_p from _mkt_pick_pipeline(v_org, coalesce(p_nombre,''));
  if v_p.o_varias = 'NINGUNA' then
    return 'No encontré ninguna propiedad que se llame como «'||coalesce(p_nombre,'')||'» en el pipeline.';
  elsif v_p.o_varias is not null then
    return 'Hay varias que coinciden: '||v_p.o_varias||'. ¿Cuál exactamente?';
  end if;

  select * into it from mkt_pipeline_items mp where mp.id = v_p.o_id;
  out_txt := it.nombre||E'\n'||'Etapa: '||replace(it.etapa,'_',' ')||
    coalesce(' · '||it.locacion,'')||coalesce(' · '||it.tipo,'')||coalesce(' · '||it.precio,'')||E'\n'||
    coalesce('Rodaje: '||to_char(it.fecha_rodaje,'DD/MM')||' ','')||
    coalesce('Publicado: '||to_char(it.fecha_publicacion,'DD/MM'),'');
  out_txt := btrim(out_txt)||E'\n';
  if it.crudos_url is not null then out_txt := out_txt||'Crudos: '||it.crudos_url||E'\n'; end if;
  if it.video_url  is not null then out_txt := out_txt||'Video: '||it.video_url||E'\n'; end if;
  if it.ig_url     is not null then out_txt := out_txt||'Reel: '||it.ig_url||E'\n'; end if;
  if it.story_url  is not null then out_txt := out_txt||'Story: '||it.story_url||E'\n'; end if;
  if it.cine_url   is not null then out_txt := out_txt||'Cine: '||it.cine_url||E'\n'; end if;
  if it.ficha_url  is not null then out_txt := out_txt||'Ficha tecnica: '||it.ficha_url||E'\n'; end if;
  if it.info_url   is not null then out_txt := out_txt||'Informacion: '||it.info_url||E'\n'; end if;
  if it.drive_url  is not null then out_txt := out_txt||'Drive: '||it.drive_url||E'\n'; end if;
  if it.notas      is not null then out_txt := out_txt||'Notas: '||it.notas||E'\n'; end if;
  return out_txt;
end $$;

-- El despachador aprendió las dos tools (pipeline_set, pipeline_ficha) en la
-- misma tanda; el cuerpo vigente de mkt_nlu_dispatch queda en la migración 174
-- más estos dos `when`.
