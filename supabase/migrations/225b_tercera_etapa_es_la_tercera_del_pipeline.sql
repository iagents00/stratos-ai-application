-- mig 225b — «Pasa a X a tercera etapa» (prueba de Ángel 30-jul): el sistema conocía las
-- etapas por NOMBRE pero no por POSICIÓN. Ahora fn_canonical_stage entiende ordinales y
-- números — «tercera etapa», «etapa 3», «la 3», «3ra» → la 3ª del pipeline (Tercer Intento) —
-- y si no es un ordinal, matchea por texto igual que antes. Vale para TODOS los que llaman
-- fn_canonical_stage (cambio de etapa por chat, dictado, etc.).
-- Reversible: CREATE OR REPLACE con el cuerpo anterior (backup diario).

create or replace function public.fn_canonical_stage(p_in text)
returns text
language sql
set search_path to 'public', 'pg_temp'
as $fn$
  with norm as (select unaccent(lower(btrim(coalesce(p_in,'')))) as t),
  canon(pos, stage) as (values
    (1,'Contáctame Ya'),(2,'Segundo Intento'),(3,'Tercer Intento'),(4,'Rotación'),(5,'Remarketing IA'),
    (6,'Zoom Agendado'),(7,'Reactivar Zoom'),(8,'Zoom Concretado'),(9,'Seguimiento'),(10,'Largo Plazo'),
    (11,'Apartó'),(12,'Visita Agendada'),(13,'Cierre'),(14,'Postventa')),
  ord as (
    select (regexp_match(t,
      '^(?:(?:la|el|etapa|fase|numero)\s+)*(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa]|\d{1,2})(?:\s*(?:ra|da|ta|va|era|nda|°|ª))?(?:\s+(?:etapa|fase))?$'
    ))[1] as w from norm),
  num as (
    select case
      when w ~ '^\d+$' then w::int
      when w like 'primer%' then 1
      when w like 'segund%' then 2
      when w like 'tercer%' then 3
      when w like 'cuart%' then 4
      when w like 'quint%' then 5
      when w like 'sext%' then 6
      when w like 'septim%' then 7
      when w like 'octav%' then 8
      when w like 'noven%' then 9
      when w like 'decim%' then 10
    end as n from ord where w is not null),
  por_numero as (select c.stage from canon c join num on num.n = c.pos),
  por_texto as (
    select c.stage from canon c cross join norm
    where nullif(norm.t,'') is not null and (
          unaccent(lower(c.stage)) = norm.t
       or unaccent(lower(c.stage)) like '%'||norm.t||'%'
       or norm.t like '%'||unaccent(lower(c.stage))||'%')
    order by (case when unaccent(lower(c.stage)) = norm.t then 0 else 1 end), length(c.stage)
    limit 1)
  select coalesce((select stage from por_numero), (select stage from por_texto));
$fn$;