-- ═══════════════════════════════════════════════════════════════════════════
-- 182 — Las etapas del registro vuelven a ser LAS DE ALEX
--
-- Su hoja usa: Sin edición → esperando aprobación → CAMBIOS → Aprovado →
-- sin Voz en Off → Publicado. Al cargar las 21 propiedades, «CAMBIOS» y
-- «esperando aprobación» se aplastaron dentro de «en edición» — y con eso se
-- perdió la única señal que a él le importa mirar: QUÉ ESTÁ EN RETRABAJO.
-- Un video que volvió con cambios no es lo mismo que uno que se está editando
-- por primera vez, y en su hoja se ven distinto a propósito.
--
-- Esto solo AGREGA dos estados. Ninguna fila cambia de valor, ningún dato se
-- pierde. Para revertir: volver a poner el CHECK anterior (las filas que ya
-- estén en los estados nuevos habría que moverlas a 'en_edicion' antes).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.mkt_pipeline_items
  drop constraint if exists mkt_pipeline_items_etapa_check;

alter table public.mkt_pipeline_items
  add constraint mkt_pipeline_items_etapa_check check (etapa = any (array[
    'seleccionada',
    'agendada',
    'grabada',                -- «Sin edición» en su hoja
    'en_edicion',
    'esperando_aprobacion',   -- NUEVO
    'cambios',                -- NUEVO — el retrabajo
    'lista',                  -- «Aprobado» en su hoja
    'esperando_voz',          -- «Sin voz en off»
    'publicada'
  ]));

-- El cerebro tiene que entender los dos estados nuevos cuando alguien se lo
-- diga hablando. OJO con el orden de los casos: 'esperando aprobación' trae
-- «esper» igual que 'esperando voz', y «sin edición» trae «edici» igual que
-- «en edición». Lo específico va primero, lo genérico después.
create or replace function public._mkt_norm_etapa(p text)
 returns text
 language sql
 immutable
as $function$
  select case
    when p is null then null
    when lower(p) like '%selec%'                                then 'seleccionada'
    when lower(p) like '%agend%'                                then 'agendada'
    when lower(p) like '%cambio%' or lower(p) like '%retrab%'   then 'cambios'
    when lower(p) like '%esper%' and (lower(p) like '%aprob%' or lower(p) like '%aprov%')
                                                                then 'esperando_aprobacion'
    when lower(p) like '%sin edic%' or lower(p) like '%sin edit%' then 'grabada'
    when lower(p) like '%aprob%' or lower(p) like '%aprov%'      then 'lista'
    when lower(p) like '%grab%' and lower(p) not like '%esper%' then 'grabada'
    when lower(p) like '%edici%' or lower(p) like '%edit%'      then 'en_edicion'
    when lower(p) like '%voz%'                                  then 'esperando_voz'
    when lower(p) like '%esper%'                                then 'esperando_voz'
    when lower(p) like '%list%'                                 then 'lista'
    when lower(p) like '%public%'                               then 'publicada'
    else null end;
$function$;

-- Mismo texto de ayuda, con las etapas nuevas adentro (si no, el asistente
-- ofrece una lista que ya no es la real).
create or replace function public.fn_mkt_move_pipeline(p_profile_id uuid, p_nombre text, p_etapa text)
 returns text
 language plpgsql
as $function$
declare
  v_org uuid; v_et text; v_item record; v_n int; v_voz int; v_cam int; v_opts text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_et := _mkt_norm_etapa(p_etapa);
  if v_et is null then
    return 'No entendí la etapa «'||coalesce(p_etapa,'')||'». Opciones: seleccionada, agendada, '
        || 'grabada (sin edición), en edición, esperando aprobación, cambios, aprobado, '
        || 'sin voz en off, publicada.';
  end if;

  select count(*) into v_n from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%';
  if v_n = 0 then return 'No encontré ninguna propiedad que se llame como «'||p_nombre||'» en el registro.'; end if;
  if v_n > 1 then
    select string_agg(nombre, ' · ') into v_opts from (
      select nombre from mkt_pipeline_items
      where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%' limit 4) s;
    return 'Hay varias que coinciden: '||v_opts||'. ¿Cuál exactamente?';
  end if;

  select * into v_item from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%' limit 1;

  update mkt_pipeline_items set etapa=v_et, updated_at=now() where id=v_item.id;

  select count(*) into v_voz from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and etapa='esperando_voz';
  select count(*) into v_cam from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and etapa='cambios';

  return '«'||v_item.nombre||'» quedó en '||
    case v_et
      when 'grabada'              then 'grabada (sin edición)'
      when 'esperando_aprobacion' then 'esperando aprobación'
      when 'cambios'              then 'cambios'
      when 'lista'                then 'aprobado'
      when 'esperando_voz'        then 'sin voz en off'
      else replace(v_et,'_',' ') end
    || case when v_cam >= 3 then '. Ojo: hay '||v_cam||' videos en CAMBIOS (retrabajo).'
            when v_voz >= 3 then '. Ojo: siguen '||v_voz||' propiedades sin voz en off.'
            else '.' end;
end $function$;
