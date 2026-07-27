-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTOS: que el Copilot vea TODO el cerebro, ordenado por CARPETAS y sin
-- cortar los importantes. Verificado el 27-jul: veía 54 de 271 notas, 0 de los 22
-- entregables, y los 3 documentos clave (hot-cache 51 KB, promesas 43 KB, changelog
-- 41 KB) llegaban RECORTADOS a 24 KB — o sea, respondía con menos de la mitad.
-- ─────────────────────────────────────────────────────────────────────────────
alter table aios_docs add column if not exists carpeta text;
alter table aios_docs add column if not exists enlace  text;   -- para PDF/Word: su link de Drive
create index if not exists idx_aios_docs_carpeta on aios_docs(carpeta);

-- La carpeta se deduce del path: automática, sin mantenimiento manual
create or replace function public._aios_carpeta(p_path text)
returns text language sql immutable as $$
  select case
    when p_path like 'memory/reports/%'      then 'Informes'
    when p_path like 'memory/transcripts/%'  then 'Reuniones'
    when p_path like 'memory/decisions/%'    then 'Decisiones (el porqué)'
    when p_path like 'memory/sessions/%'     then 'Bitácora de sesiones'
    when p_path like 'documentos/%'          then 'Entregables (PDF y Word)'
    when p_path like 'memory/%'              then 'Memoria del día a día'
    when p_path like 'skills/%'              then 'Cómo hacemos las cosas'
    when p_path like 'connections/%'         then 'Conexiones y llaves'
    when p_path like 'infra/%'               then 'Infraestructura'
    when p_path like 'context/%'             then 'Contexto del negocio'
    else 'Índices'
  end;
$$;

create or replace function public.aios_docs_upsert(p_path text, p_titulo text, p_contenido text, p_enlace text default null)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into aios_docs(path, titulo, contenido, carpeta, enlace, updated_at)
  values (p_path, coalesce(nullif(p_titulo,''), p_path), coalesce(p_contenido,''),
          _aios_carpeta(p_path), nullif(p_enlace,''), now())
  on conflict (path) do update
    set titulo = excluded.titulo, contenido = excluded.contenido,
        carpeta = excluded.carpeta, enlace = coalesce(excluded.enlace, aios_docs.enlace),
        updated_at = now();
  return jsonb_build_object('ok', true, 'path', p_path, 'carpeta', _aios_carpeta(p_path));
end $function$;

update aios_docs set carpeta = _aios_carpeta(path) where carpeta is null;

-- El buscador del Copilot: índice POR CARPETA y contenido casi completo (con aviso si recorta)
create or replace function public.aios_brain(p_q text default null, p_path text default null)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v jsonb; v_lim int := 45000;
begin
  if nullif(trim(coalesce(p_path,'')),'') is not null then
    select jsonb_build_object('ok',true,'doc',jsonb_build_object(
      'path',path,'titulo',titulo,'carpeta',carpeta,'enlace',enlace,
      'actualizado',to_char(updated_at,'YYYY-MM-DD HH24:MI'),
      'contenido', left(contenido, v_lim)
        || case when length(contenido) > v_lim
                then E'\n\n[... documento recortado: tiene '||length(contenido)||' caracteres. Pedí una sección concreta y la busco.]'
                else '' end))
      into v from aios_docs where path = p_path;
    if v is null then
      select jsonb_build_object('ok',true,'doc',jsonb_build_object(
        'path',path,'titulo',titulo,'carpeta',carpeta,'enlace',enlace,
        'actualizado',to_char(updated_at,'YYYY-MM-DD HH24:MI'),
        'contenido', left(contenido, v_lim)
          || case when length(contenido) > v_lim
                  then E'\n\n[... documento recortado: tiene '||length(contenido)||' caracteres. Pedí una sección concreta y la busco.]'
                  else '' end))
        into v from aios_docs where path ilike '%'||p_path||'%' order by length(path) limit 1;
    end if;
    return coalesce(v, jsonb_build_object('ok',false,
      'error','No hay documento con ese path. Pide el índice (sin argumentos).'));
  end if;

  if nullif(trim(coalesce(p_q,'')),'') is not null then
    select jsonb_build_object('ok',true,'resultados', coalesce(jsonb_agg(s.r),'[]'::jsonb)) into v
    from (
      select jsonb_build_object('path',path,'titulo',titulo,'carpeta',carpeta,'enlace',enlace,
        'actualizado',to_char(updated_at,'YYYY-MM-DD HH24:MI'),
        'extracto', substring(contenido from greatest(1, position(lower(p_q) in lower(contenido)) - 160) for 420)) as r
      from aios_docs
      where titulo ilike '%'||p_q||'%' or contenido ilike '%'||p_q||'%' or path ilike '%'||p_q||'%'
      order by (titulo ilike '%'||p_q||'%') desc, updated_at desc
      limit 8
    ) s;
    return v;
  end if;

  -- Índice agrupado por carpeta (así un humano lo lee como si fueran secciones)
  select jsonb_build_object('ok',true,'total',(select count(*) from aios_docs),'carpetas', coalesce(jsonb_object_agg(c.carpeta, c.docs),'{}'::jsonb)) into v
  from (
    select coalesce(carpeta,'Otros') as carpeta,
           jsonb_agg(jsonb_build_object('path',path,'titulo',titulo,
             'actualizado',to_char(updated_at,'YYYY-MM-DD')) order by path) as docs
    from aios_docs group by coalesce(carpeta,'Otros')
  ) c;
  return v;
end $function$;;
