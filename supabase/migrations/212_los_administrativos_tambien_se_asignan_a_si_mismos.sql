-- Pedido de Iván (30-jul): que en Duke un administrativo pueda, con el MISMO
-- lenguaje básico, tanto mandarle tareas a los demás como **anotarse cosas a sí
-- mismo** («recuérdame que tengo que hacer tal cosa», «agéndame tal cosa para
-- tal día a tal hora»).
--
-- Mandarle a los demás ya funcionaba (migs 193-211). Autoasignarse estaba a
-- medias. Probando 8 frases como las diría un jefe:
--
--   ✅ Ninguna se confundió con dictado de equipo — el riesgo grande no estaba.
--   ❌ Tres formas naturales NO se entendían.
--   ❌ Dos títulos salían sucios.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TRES FORMAS QUE NO ENTENDÍA
--
--    «necesito hacer el reporte de cierres mañana»      → «no terminé de entenderte»
--    «tengo que preparar la junta con Ken el lunes»     → «no terminé de entenderte»
--    «ponme una tarea para mañana: llamar a los de seguimiento» → pedía la fecha
--                                                          que ya le habían dado
--
--    Las dos primeras: el detector sólo conocía las formas donde uno le habla al
--    asistente («recuérdame», «agéndame», «ponme»). Le faltaba la forma más
--    natural de todas, la de primera persona: «necesito/tengo que/debo/me toca
--    + <hacer algo>».
--
--    ⚠️ El cuidado acá es no pisarse con el dictado de equipo. La diferencia es
--    limpia y se apoya en la gramática: **primera persona con infinitivo** es
--    para uno («tengo que preparar»), **tercera persona** es para otro («Gael
--    tiene que preparar», «necesito QUE Gael prepare»). Por eso el patrón exige
--    un infinitivo pegado — «necesito que» nunca lo tiene.
--
--    La tercera: el parser de fecha buscaba el día rodeado de espacios
--    (`(^| )manana( |$)`), y «para mañana**:**» tiene dos puntos. Pasa a usar
--    límites de palabra, que es lo correcto y tolera cualquier puntuación.
--
-- 2. DOS TÍTULOS SUCIOS
--
--    «recuérdame que tengo que llamar a Gael»  → «Que tengo que llamar a Gael»
--    «agéndame la corrida financiera para…»    → «La corrida financiera para»
--
--    Se limpian los arranques de primera persona, el «que» suelto, el artículo
--    inicial y la preposición que queda colgando al final.
--
-- 3. LA HORA POR DEFECTO ERA LAS 9, Y EN DUKE LA JORNADA ARRANCA A LAS 10
--
--    Un recordatorio sin hora quedaba a las 09:00 fijas — una hora antes de que
--    empiece el día en Duke. Ahora usa la **apertura de la jornada de esa
--    persona** (`work_start`), con 09:00 de respaldo si no tiene horario
--    cargado. Es la misma regla que ya rige del lado de las tareas de equipo, y
--    sirve igual para cualquier white-label con otro horario.
--
-- REVERTIR: CREATE OR REPLACE al cuerpo anterior de cada función. Sin DDL.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. El detector reconoce la primera persona ──────────────────────────────
create or replace function public._bot_agenda_is_create(p_tool text, p_norm text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  select lower(coalesce(p_tool,'')) in ('add_task','create_task','agenda_personal','recordatorio','add_reminder','schedule_reminder')
    or (
      coalesce(p_norm,'') ~ '(recuerdame|recordame|agendame|agenda me|anotame|apuntame|ponme|programame|creame|agrega)'
      and coalesce(p_norm,'') ~ '(manana|mañana|hoy|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|alas|en [0-9]+|temprano|mediodia)'
    )
    or (
      -- PRIMERA PERSONA + INFINITIVO: es para uno mismo.
      -- «tengo que preparar», «necesito hacer», «debo llamar», «me toca revisar».
      -- «necesito QUE Gael prepare» no entra: «que» no es infinitivo.
      coalesce(p_norm,'') ~ '\m(necesito|tengo\s+que|debo|me\s+toca|quisiera|tendria\s+que)\s+(\w+\s+){0,1}\w+(ar|er|ir)\M'
      and coalesce(p_norm,'') ~ '(manana|mañana|hoy|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|alas|en [0-9]+|temprano|mediodia)'
    );
$fn$;


-- ── 2. Títulos limpios ──────────────────────────────────────────────────────
create or replace function public._bot_agenda_extract_title(p_text text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_title text := btrim(coalesce(p_text,''));
begin
  -- verbos con los que uno le habla al asistente
  v_title := regexp_replace(v_title,
    '^\s*(por favor\s*)?(recu[eé]rdame|recordame|ag[eé]ndame|agendame|agenda|anota|an[oó]tame|ap[uú]ntame|ponme|programame|progr[aá]mame|creame|cr[eé]ame|agrega|agregame|agr[eé]game)\s*',
    '', 'i');
  -- «que tengo que …», «que debo …», y el «que» suelto que queda
  v_title := regexp_replace(v_title,
    '^\s*que\s+(tengo\s+que|debo|me\s+toca|tendr[ií]a\s+que|necesito)\s+', '', 'i');
  v_title := regexp_replace(v_title,
    '^\s*(tengo\s+que|debo|me\s+toca|tendr[ií]a\s+que|necesito|quisiera)\s+', '', 'i');
  v_title := regexp_replace(v_title, '^\s*que\s+', '', 'i');
  -- «una tarea de/para …», «un recordatorio …»
  v_title := regexp_replace(v_title, '^\s*(un|una|mi|en mi agenda|recordatorio|pendiente|actividad|tarea)\s*(de|para)?\s*', '', 'i');
  -- artículo inicial: «la corrida financiera» → «corrida financiera»
  v_title := regexp_replace(v_title, '^\s*(el|la|los|las)\s+', '', 'i');

  -- el tiempo, fuera del título (con límites de palabra: tolera «mañana:»)
  v_title := regexp_replace(v_title, '\s+(para\s+)?\m(hoy|ma[nñ]ana|pasado ma[nñ]ana)\M.*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+(para\s+)?(el\s+)?\m(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\M.*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+\m(en\s+\d+\s+(minuto|minutos|hora|horas|d[ií]a|dias|días))\M.*$', '', 'i');
  v_title := regexp_replace(v_title, '\s+\m(a\s+las|alas|para\s+las|hora)\s+\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?|am|pm|de la ma[nñ]ana|de la tarde|de la noche)?', '', 'i');
  v_title := regexp_replace(v_title, '\s+\m(temprano|a\s+primera\s+hora|al\s+mediod[ií]a)\M', '', 'i');

  v_title := regexp_replace(v_title, '\s+', ' ', 'g');
  -- preposición colgando al final («… financiera para»)
  v_title := regexp_replace(v_title, '\s+\m(para|de|en|a|con|el|la|los|las|y|o)\s*$', '', 'i');
  v_title := btrim(v_title, ' .,-–—:;');

  if v_title = '' then
    v_title := 'Recordatorio personal';
  end if;

  return upper(left(v_title, 1)) || substr(v_title, 2);
end;
$fn$;


-- ── 3. El día se reconoce aunque venga pegado a un signo ────────────────────
do $do$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='_bot_agenda_parse_due_at';

  v_old := '''(^| )manana( |$)|(^| )mañana( |$)''';
  if position(v_old in v_def) = 0 then
    raise exception 'No encontré el patrón de «mañana» — no toco nada.';
  end if;
  v_def := replace(v_def, v_old, '''\mmanana\M|\mmañana\M''');
  v_def := replace(v_def, '''(^| )hoy( |$)''', '''\mhoy\M''');
  v_def := replace(v_def, '''(^| )lunes( |$)''', '''\mlunes\M''');
  v_def := replace(v_def, '''(^| )martes( |$)''', '''\mmartes\M''');
  v_def := replace(v_def, '''(^| )miercoles( |$)|(^| )miércoles( |$)''', '''\mmiercoles\M|\mmiércoles\M''');
  v_def := replace(v_def, '''(^| )jueves( |$)''', '''\mjueves\M''');
  v_def := replace(v_def, '''(^| )viernes( |$)''', '''\mviernes\M''');
  v_def := replace(v_def, '''(^| )sabado( |$)|(^| )sábado( |$)''', '''\msabado\M|\msábado\M''');
  v_def := replace(v_def, '''(^| )domingo( |$)''', '''\mdomingo\M''');

  execute v_def;
end
$do$;


-- ── 4. Sin hora dicha, la apertura de SU jornada (no las 9 fijas) ───────────
do $do$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_agenda_personal_create';

  v_old := '  v_title := public._bot_agenda_extract_title(';
  if position(v_old in v_def) = 0 then
    raise exception 'No encontré el armado del título — no toco nada.';
  end if;

  v_def := replace(v_def, v_old,
       '  -- mig 212: si no dijo hora, la apertura de SU jornada. En Duke la' || chr(10)
    || '  -- jornada arranca 10:00 y las 09:00 fijas caían antes de que empiece.' || chr(10)
    || '  IF v_default_time AND coalesce(v_profile.work_start, ''09:00''::time) <> ''09:00''::time THEN' || chr(10)
    || '    v_due := (((v_due at time zone v_tz)::date) + v_profile.work_start) at time zone v_tz;' || chr(10)
    || '  END IF;' || chr(10) || chr(10)
    || v_old);

  -- el mensaje deja de mentir con «las 09:00»
  v_def := replace(v_def,
    'E''\n\nNo detecté hora exacta, así que lo dejé a las 09:00. Puedes decir “pospón esto 30 minutos” o “cámbialo a las 11”.''',
    'E''\n\nNo detecté hora exacta, así que lo dejé para el arranque de tu jornada ('' || to_char(v_due at time zone v_tz, ''HH24:MI'') || ''). Puedes decir “pospón esto 30 minutos” o “cámbialo a las 11”.''');

  execute v_def;
end
$do$;
