-- 173 — La bitácora se reporta hablando (Copilot y Telegram)
--
-- La migración 172 le dio a la bitácora un lugar donde mostrarse. Esta le da la
-- puerta de entrada: hasta ahora el equipo reportaba su día en un Google Form
-- que vive fuera del CRM, así que el dato nunca llegaba al sistema que lo
-- necesita. Ahora se dice en el mismo Copilot que ya usan todos los días
-- («hoy edité el video de Casa Lago y grabé en Brasa y Piedra») y queda anotado.
--
-- Dos herramientas nuevas en el despachador de marketing:
--   bitacora_registrar → el equipo anota su día (y su evidencia).
--   bitacora_equipo    → el líder pregunta qué reportó el equipo.
--
-- Decisiones que vale la pena dejar escritas:
--
-- 1. Se permiten VARIOS reportes por persona y día. El formulario del que viene
--    esto ya funcionaba así (Yazmin reportó dos veces el 24/7). Forzar uno solo
--    obligaría a decidir si el segundo pisa al primero — y perder trabajo
--    reportado es peor que mostrar dos renglones.
--
-- 2. Si llega evidencia SIN texto, se engancha al último reporte de ese día en
--    vez de crear uno vacío. Es el caso real: primero cuentan el día, después
--    mandan el enlace de la carpeta.
--
-- 3. NO se manda aviso al líder por cada reporte. Tres personas reportando a
--    diario son tres notificaciones diarias que se vuelven ruido y se ignoran;
--    la información está en Equipo cuando la quiera. Si más adelante se quiere
--    empujar, lo correcto es un resumen al cierre del día, no un ping por
--    reporte.
--
-- Revertir: `drop function fn_mkt_daily_report, fn_mkt_team_bitacora` y volver a
-- crear mkt_nlu_dispatch sin los dos `when` nuevos (requiere OK humano según las
-- reglas del repo). Mientras tanto, quitar las herramientas del prompt de n8n ya
-- las deja inalcanzables.

/* ─────────────── 1. Anotar la bitácora del día ─────────────── */

create or replace function public.fn_mkt_daily_report(
  p_profile_id    uuid,
  p_texto         text,
  p_fecha         date default null,
  p_evidencia_url text default null
) returns text
language plpgsql
as $$
declare
  v_org uuid; v_fecha date; v_texto text; v_evi text; v_n int; v_last uuid;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  v_texto := nullif(btrim(coalesce(p_texto, '')), '');
  v_evi   := nullif(btrim(coalesce(p_evidencia_url, '')), '');
  -- El día se resuelve en la zona de la operación, no en UTC: si no, un reporte
  -- de las 7 de la tarde en Cancún se guardaba como del día siguiente.
  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Cancun')::date);

  -- Caso "toma el enlace de la evidencia": llega el link solo, después de haber
  -- contado el día. Se engancha al último reporte de esa fecha.
  if v_texto is null and v_evi is not null then
    select id into v_last
    from mkt_daily_reports
    where organization_id = v_org and profile_id = p_profile_id and fecha = v_fecha
    order by created_at desc limit 1;
    if v_last is null then
      return 'Todavía no tienes bitácora del '||to_char(v_fecha,'DD/MM')||
             '. Cuéntame primero qué hiciste y le agrego el enlace.';
    end if;
    update mkt_daily_reports set evidencia_url = v_evi where id = v_last;
    return 'Listo, le agregué la evidencia a tu bitácora del '||to_char(v_fecha,'DD/MM')||'.';
  end if;

  if v_texto is null then
    return 'Cuéntame qué hiciste y lo anoto en tu bitácora. Por ejemplo: '||
           '"hoy edité el video de Casa Lago y grabé en Brasa y Piedra".';
  end if;

  insert into mkt_daily_reports (organization_id, profile_id, fecha, texto, evidencia_url, origen)
  values (v_org, p_profile_id, v_fecha, v_texto, v_evi, 'copilot');

  select count(*) into v_n
  from mkt_daily_reports
  where organization_id = v_org and profile_id = p_profile_id and fecha = v_fecha;

  return 'Anotado en tu bitácora del '||to_char(v_fecha,'DD/MM')||
         case when v_n > 1 then ' (van '||v_n||' reportes ese día)' else '' end||'. '||
         'Tu líder ya lo ve en Equipo.'||
         case when v_evi is null
              then ' Si tienes evidencia, mándame el enlace y lo agrego.'
              else '' end;
end $$;

comment on function public.fn_mkt_daily_report(uuid, text, date, text) is
  'Anota el reporte del día de una persona de marketing. Si llega evidencia sin texto, la engancha al último reporte de esa fecha.';

/* ─────────────── 2. Qué reportó el equipo ─────────────── */

create or replace function public.fn_mkt_team_bitacora(
  p_profile_id uuid,
  p_fecha      date default null,
  p_nombre     text default null
) returns text
language plpgsql
stable
as $$
declare
  v_org uuid; v_fecha date; v_p record; r record;
  out_txt text := ''; v_n int := 0; v_plano text; v_corte int := 220;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Cancun')::date);

  if nullif(btrim(coalesce(p_nombre,'')),'') is not null then
    select * into v_p from _mkt_find_profile(v_org, p_nombre);
    if v_p.id is null then return 'No encontré a «'||p_nombre||'» en el equipo.'; end if;
  end if;

  for r in
    select p.name, d.texto, d.evidencia_url
    from mkt_daily_reports d
    join profiles p on p.id = d.profile_id
    where d.organization_id = v_org
      and d.fecha = v_fecha
      and (v_p.id is null or d.profile_id = v_p.id)
    order by p.name, d.created_at
  loop
    v_n := v_n + 1;
    -- El texto viene en varias líneas numeradas; para el chat se aplana y se
    -- recorta. El detalle completo está en el módulo, no hay que repetirlo acá.
    v_plano := btrim(regexp_replace(coalesce(r.texto,''), '\s+', ' ', 'g'));
    out_txt := out_txt || '• ' || r.name || ': ' || left(v_plano, v_corte)
      || case when length(v_plano) > v_corte then '...' else '' end
      || case when r.evidencia_url is not null then ' (con evidencia)' else '' end
      || E'\n';
  end loop;

  if v_n = 0 then
    return case when v_p.id is null
      then 'Nadie reportó bitácora del '||to_char(v_fecha,'DD/MM')||' todavía.'
      else v_p.name||' no reportó bitácora del '||to_char(v_fecha,'DD/MM')||' todavía.' end;
  end if;
  return 'Bitácora del '||to_char(v_fecha,'DD/MM')||E'\n'||out_txt;
end $$;

comment on function public.fn_mkt_team_bitacora(uuid, date, text) is
  'Lo que reportó el equipo de marketing en una fecha. Sin nombre devuelve a todos; con nombre, solo a esa persona.';
