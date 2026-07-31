-- El respaldo del informe dice la verdad, y sin jerga.
--
-- El 31-jul Ángel pidió un informe de un solo día y le salió:
--   «ESTE INFORME QUEDÓ A MEDIAS — El redactor no alcanzó a responder […]
--    Volvé a darle a Generar informe en un momento y sale completo.»
--
-- Las dos afirmaciones estaban mal:
--
-- 1. NO fue que «no alcanzó a responder». El redactor falló en 0,3 segundos con
--    un 400 de la API: `Your credit balance is too low to access the Anthropic
--    API`. La cuenta de la llave se quedó sin saldo. Nada que ver con tardar.
--
-- 2. «Volvé a darle en un momento y sale completo» era **falso**, y es lo peor
--    del asunto: mandaba a repetir algo que iba a fallar idéntico. Un aviso que
--    empuja a una acción inútil es peor que no decir nada, porque además tapa la
--    causa real. (Y de paso era voseo, contra nuestro propio estándar §5.10.)
--
-- Ahora el documento dice SOLO lo que sabe —que quedó sin redactar y que no se
-- envíe así— y el motivo lo pone la pantalla, que sí puede leer el error real y
-- distinguir «sin saldo» de «tardó» de «está saturado». Son tres situaciones con
-- tres respuestas distintas y hasta hoy se contaban igual.
--
-- Además: el respaldo mostraba «** CERRADO el pendiente manual del PR #559 […]
-- (n8n `8ZasBukTkSx26m2A`)», que es exactamente lo que se acordó que nunca se ve.
-- Da igual que sea un respaldo: si está en pantalla, alguien lo lee.
-- `fn_borrador_limpio` saca los asteriscos, las comillas invertidas, los nombres
-- de herramientas y los identificadores largos. Solo aplica al respaldo — la
-- evidencia que va al redactor no se toca, él ya sabe traducir.
--
-- Revertir: `create or replace` de `fn_informe_borrador` con el texto anterior.

create or replace function public.fn_borrador_limpio(p_texto text)
returns text
language sql
immutable
as $fn$
  select nullif(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        -- 1) lo que ya sabíamos limpiar (emojis, algunos números de versión)
        public.fn_texto_presentable(coalesce(p_texto,'')),
        -- 2) markdown y comillas invertidas
        '[*`_~]', '', 'g'),
      -- 3) jerga suelta: herramientas, PR/SW/migración con su número, y los
      --    identificadores largos sin espacios (los ids de flujo).
      '(\y(n8n|webhook|RPC|deploy|commit|repo)\y|\yPR ?#?[0-9]+|\ySW ?v?[0-9]+|\bmigraci[óo]n(es)? ?[0-9-]*|\y[A-Za-z0-9]{16,}\y)',
      '', 'gi'),
    -- 4) los espacios que quedan colgando tras sacar cosas
    '\s{2,}', ' ', 'g')), '');
$fn$;

grant execute on function public.fn_borrador_limpio(text) to authenticated, anon, service_role;

create or replace function public.fn_informe_borrador(p_j jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $fn$
declare
  v_out text;
  v_lin text;
begin
  v_out := upper(coalesce(p_j->'encabezado'->>'titulo', 'REPORTE DE AVANCES')) || E'\n'
    || 'Periodo: ' || (p_j->'periodo'->>'desde_largo') || ' al ' || (p_j->'periodo'->>'hasta_largo') || E'\n'
    || case when p_j->'encabezado'->>'responsables' is not null
            then 'Responsables: ' || (p_j->'encabezado'->>'responsables') || E'\n' else '' end
    || case when p_j->'encabezado'->>'proyecto' is not null
            then 'Proyecto: ' || (p_j->'encabezado'->>'proyecto') || E'\n' else '' end
    || E'\n';

  v_out := v_out || 'ESTE INFORME QUEDÓ SIN REDACTAR' || E'\n'
    || 'Abajo está lo que hay registrado, tal cual quedó escrito, sin pasar por el '
    || 'redactor. Sirve para revisar en qué se trabajó, pero NO para enviárselo al '
    || 'cliente. En la pantalla te digo por qué quedó así y qué hacer.' || E'\n\n';

  v_out := v_out || 'LO QUE HAY REGISTRADO' || E'\n'
    || 'Se trabajó en ' || jsonb_array_length(p_j->'dias')
    || case when jsonb_array_length(p_j->'dias') = 1 then ' jornada.' else ' jornadas.' end
    || E'\n\n';

  if jsonb_array_length(p_j->'dias') > 0 then
    select string_agg(linea, E'\n' order by ord) into v_lin
    from (
      select (d->>'fecha') as ord,
             (d->>'dia') || ' ' || (d->>'numero')
             || coalesce((
                  select ' — ' || string_agg(t, '; ')
                    from (
                      select public.fn_borrador_limpio(
                               coalesce(nullif(h->>'titulo',''), left(h->>'detalle', 180))) as t
                        from jsonb_array_elements(d->'hechos') h
                       limit 3
                    ) z
                   where t is not null), '') as linea
        from jsonb_array_elements(p_j->'dias') d
    ) x;
    v_out := v_out || 'JORNADAS DEL PERIODO' || E'\n' || coalesce(v_lin, '') || E'\n';
  end if;

  return v_out;
end
$fn$;

comment on function public.fn_informe_borrador(jsonb) is
  'Respaldo del informe cuando el redactor no responde. Dice qué hay, sin prometer que reintentar lo arregla.';
