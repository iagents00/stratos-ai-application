-- 175 — Preguntar por la bitácora del equipo SIN nombre ya no revienta
--
-- Bug cazado en la prueba end-to-end, antes de que lo viera nadie: preguntar
-- «¿qué reportó el equipo hoy?» devolvía "Uy, algo falló procesando eso (record
-- v_p is not assigned yet)".
--
-- Causa: en plpgsql, leer un campo de un RECORD que nunca se asignó lanza error.
-- La migración 173 solo asignaba `v_p` cuando venía un nombre, pero después
-- consultaba `v_p.id` siempre — y el caso sin nombre es justamente el más común.
--
-- Arreglo: guardar el resultado en un `uuid` y un `text`, que sí admiten quedar
-- en null. Lección para el resto del cerebro: si una variable puede no asignarse
-- nunca, no la declares como RECORD.
--
-- Revertir: volver a la versión de la migración 173 (no recomendado, tiene el bug).

create or replace function public.fn_mkt_team_bitacora(
  p_profile_id uuid,
  p_fecha      date default null,
  p_nombre     text default null
) returns text
language plpgsql
stable
as $$
declare
  v_org uuid; v_fecha date; v_pid uuid; v_pname text; v_p record; r record;
  out_txt text := ''; v_n int := 0; v_plano text; v_corte int := 220;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Cancun')::date);

  if nullif(btrim(coalesce(p_nombre,'')),'') is not null then
    select * into v_p from _mkt_find_profile(v_org, p_nombre);
    v_pid := v_p.id; v_pname := v_p.name;
    if v_pid is null then return 'No encontré a «'||p_nombre||'» en el equipo.'; end if;
  end if;

  for r in
    select p.name, d.texto, d.evidencia_url
    from mkt_daily_reports d
    join profiles p on p.id = d.profile_id
    where d.organization_id = v_org
      and d.fecha = v_fecha
      and (v_pid is null or d.profile_id = v_pid)
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
    return case when v_pid is null
      then 'Nadie reportó bitácora del '||to_char(v_fecha,'DD/MM')||' todavía.'
      else v_pname||' no reportó bitácora del '||to_char(v_fecha,'DD/MM')||' todavía.' end;
  end if;
  return 'Bitácora del '||to_char(v_fecha,'DD/MM')||E'\n'||out_txt;
end $$;
