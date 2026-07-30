-- Salió persiguiendo una rareza en NSG: «que Ángel revise el flujo de n8n
-- mañana» quedaba a las 8:00 a.m., y la jornada de Ángel empieza 9:30.
-- El 8 era el de «n8n».
--
-- Probando alrededor, el problema es general y silencioso:
--
--   «revise el flujo de n8n mañana»    → 8:00 a.m.   (el 8 de n8n)
--   «revise la torre 3 mañana»         → 3:00 p.m.   (el 3 de torre 3)
--   «migre a Postgres 15 mañana»       → no entiende nada
--   «revise el flujo mañana»           → 4:30 p.m.   ✅ (cierre de jornada)
--
-- ⚠️ ES DE LAS DOS ORGANIZACIONES, y a Duke le pega más fuerte: una
-- inmobiliaria habla todo el día de «torre 3», «lote 12», «modelo 2», «PH 4».
-- «Revisar la torre 3 mañana» se guardaba a las 3 de la tarde sin que nadie lo
-- pidiera — y es del tipo que NO se revisa, porque la tarea "se creó bien".
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LA CAUSA: UNA LÍNEA
--
-- En `parse_es_datetime_tgenius`, cuando la frase trae «mañana/hoy» o un día de
-- la semana, la hora se buscaba así:
--
--     m := regexp_match(v, '(\d{1,2})(?::(\d{2}))?\s*(am|pm)?');
--
-- Todo es opcional menos el número. No exige «a las», ni am/pm, ni dos puntos:
-- agarra **el primer número de 1-2 cifras que aparezca en la frase**, sea la
-- hora, el nombre de una herramienta o el número de una torre. La misma línea
-- estaba repetida en la rama de los días de la semana.
--
-- ⇒ Se reemplaza por `_bot_hora_explicita`, que sólo devuelve una hora cuando
--   la frase la ANUNCIA como tal:
--     · con minutos      «3:30», «15:00»
--     · con am/pm        «3pm», «10 a.m.»
--     · anunciada        «a las 3», «a la 1», «las 10», «tipo 4», «sobre las 5»
--     · con unidad       «17 hrs», «9 horas»
--     · y «de la tarde/noche» corrige el 12h cuando corresponde
--   Un número suelto NO es una hora: se ignora y la tarea cae en el default de
--   siempre (el cierre de la jornada de esa persona).
--
--   Los `\m` (arranque de palabra) son los que salvan «n8n»: ahí el 8 no empieza
--   palabra. Es la misma lección del `like '%me%'` que le asignaba tareas a
--   Cecilia MEndoza — los límites de palabra no son un detalle.
--
-- PROBADO — es la función de fecha COMPARTIDA (leads, zooms, dictado), así que
-- se probó más que nada:
--   · 15/15 en la batería: los 7 números que no son hora dejan de serlo y las
--     8 horas de verdad siguen saliendo igual («mañana a las 10:30», «3pm»,
--     «a las 3 de la tarde», «el lunes 17 hrs», «mañana 8:00»…).
--   · Golden de ventas 35/35 → 35/35 · Golden de marketing 15/17 → 15/17
--     (el 15/17 ya venía así, no lo cambia esto).
--   · De punta a punta por el dictado: «n8n» y «torre 3» ahora caen al cierre
--     de jornada; «mañana a las 10» y «el lunes a las 3 de la tarde», exactas.
--
-- REVERTIR: volver la línea a `regexp_match(v, '(\d{1,2})(?::(\d{2}))?\s*(am|pm)?')`
-- en las dos ramas. Sin DDL, sin tocar datos.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._bot_hora_explicita(p_text text)
returns text[]
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  t text := lower(unaccent(coalesce(p_text,'')));
  m text[]; h int; mi int; mer text;
begin
  if btrim(t) = '' then return null; end if;

  -- «3:30», «15:00»
  m := regexp_match(t, '\m(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?');
  if m is not null then
    h := m[1]::int; mi := m[2]::int; mer := coalesce(m[3],'');
  else
    -- «3pm», «10 a.m.»
    m := regexp_match(t, '\m(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)');
    if m is not null then
      h := m[1]::int; mi := 0; mer := m[2];
    else
      -- «a las 3», «a la 1», «las 10», «tipo 4», «sobre las 5»
      m := regexp_match(t, '\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+(\d{1,2})(?::(\d{2}))?');
      if m is not null then
        h := m[1]::int; mi := coalesce(m[2]::int,0); mer := '';
      else
        -- «17 hrs», «9 horas»
        m := regexp_match(t, '\m(\d{1,2})(?::(\d{2}))?\s*(?:hrs?|horas?)\M');
        if m is not null then
          h := m[1]::int; mi := coalesce(m[2]::int,0); mer := '';
        else
          return null;   -- un número suelto NO es una hora
        end if;
      end if;
    end if;
  end if;

  if mer = '' then
    if t ~ '\m(de|por|en)\s+la\s+(tarde|noche)\M' and h < 12 then h := h + 12;
    elsif t ~ '\m(de|por|en)\s+la\s+(manana|madrugada)\M' and h = 12 then h := 0;
    end if;
  else
    if mer like 'p%' and h < 12 then h := h + 12; end if;
    if mer like 'a%' and h = 12 then h := 0; end if;
  end if;

  if h between 0 and 23 and mi between 0 and 59 then
    return array[h::text, mi::text, null];
  end if;
  return null;
end;
$fn$;

do $do$
declare v_def text; v_anchor text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='parse_es_datetime_tgenius';

  v_anchor := 'm := regexp_match(v, ''(\d{1,2})(?::(\d{2}))?\s*(am|pm)?'');';
  if position(v_anchor in v_def) = 0 then
    raise exception 'No encontré la búsqueda de hora suelta — no toco nada.';
  end if;

  -- replace() cambia las DOS apariciones (rama «hoy/mañana» y rama día de semana)
  execute replace(v_def, v_anchor, 'm := public._bot_hora_explicita(v);');
end
$do$;
