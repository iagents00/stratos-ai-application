-- ═══════════════════════════════════════════════════════════════════════════
-- 190 — El asistente nombra las etapas COMO ALEX, no como la base
--
-- `fn_mkt_pipeline_summary` armaba el rótulo con initcap(replace(etapa,'_',' ')),
-- así que respondía «Esperando Voz», «Lista» y «Grabada» — nombres nuestros.
-- En su hoja son «Sin voz en off», «Aprobado» y «Sin edición». Ya se había
-- arreglado en fn_mkt_move_pipeline (mig 182); faltaba el resumen, que es lo
-- que más se pregunta («¿cómo van los videos?»).
--
-- Se agrega un helper único para que no vuelva a haber dos formas de decir lo
-- mismo, y el aviso de RETRABAJO (Cambios), que antes no existía en el resumen.
-- Solo cambia TEXTO de salida; ningún dato se toca.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._mkt_etapa_label(p text)
 returns text language sql immutable
as $function$
  select case p
    when 'seleccionada'         then 'Seleccionada'
    when 'agendada'             then 'Agendada'
    when 'grabada'              then 'Sin edición'
    when 'en_edicion'           then 'En edición'
    when 'esperando_aprobacion' then 'Esperando aprobación'
    when 'cambios'              then 'Cambios'
    when 'lista'                then 'Aprobado'
    when 'esperando_voz'        then 'Sin voz en off'
    when 'publicada'            then 'Publicada'
    else initcap(replace(coalesce(p,''),'_',' ')) end;
$function$;

create or replace function public.fn_mkt_pipeline_summary(p_profile_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_org uuid; r record; out_txt text; v_total int := 0; v_voz int := 0; v_cam int := 0;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select count(*) into v_total from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null;
  if v_total = 0 then return 'Todavía no hay propiedades en el registro.'; end if;

  out_txt := 'Registro de propiedades — '||v_total||' en total:';
  for r in
    select p.etapa, count(*) n from mkt_pipeline_items p
    where p.organization_id=v_org and p.deleted_at is null
    group by p.etapa order by count(*) desc, p.etapa
  loop
    out_txt := out_txt || E'\n· ' || _mkt_etapa_label(r.etapa) || ': ' || r.n;
    if r.etapa = 'esperando_voz' then v_voz := r.n; end if;
    if r.etapa = 'cambios'       then v_cam := r.n; end if;
  end loop;

  -- El retrabajo pesa más que la voz en off: es trabajo ya hecho que hay que rehacer.
  if v_cam >= 3 then
    out_txt := out_txt || E'\n\nOjo: hay '||v_cam||' videos en Cambios — eso es retrabajo.';
  elsif v_voz >= 3 then
    out_txt := out_txt || E'\n\nOjo: el cuello es la voz en off — '||v_voz||' videos parados.';
  end if;
  return out_txt;
end $function$;
