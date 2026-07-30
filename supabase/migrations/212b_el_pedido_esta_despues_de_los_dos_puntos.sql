-- La mig 212 dejó a los administrativos anotándose cosas a sí mismos. Barriendo
-- después las frases de esa misma lista, una quedaba a medias — y era una de las
-- que el propio pedido de Iván usaba de ejemplo:
--
--   «ponme una tarea para mañana: llamar a los de seguimiento»
--       fecha ✅ mañana 10:00      título ❌ «Tarea»
--
-- La fecha la arregló la 212. El título no: se guardaba una tarea llamada
-- «Tarea», con el pedido de verdad —«llamar a los de seguimiento»— tirado a la
-- basura. En la agenda del jefe queda una línea que no dice nada.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LO QUE VA DESPUÉS DE LOS DOS PUNTOS ES EL PEDIDO
--
--    El armador del título recorta el tiempo de la frase, y para eso borra todo
--    lo que sigue al día: en «una tarea para mañana: llamar a los de
--    seguimiento», «mañana» aparece ANTES del pedido, así que se llevaba el
--    pedido puesto. Sólo sobrevivía el andamiaje: «tarea».
--
--    Cuando hay dos puntos, lo de la izquierda es andamiaje y lo de la derecha
--    es el pedido. Se toma la derecha y se la hace pasar por la limpieza normal.
--
--    ⚠️ Los dos puntos de una HORA no cuentan («llamar a Juan a las 3:30» no se
--    parte por el medio). Se reconocen porque llevan un dígito detrás. Y al
--    revés, «a las 3: llamar a Juan» SÍ parte — ahí los dos puntos separan de
--    verdad. Por eso la regla mira lo que sigue, no lo que precede.
--
--    Si detrás de los dos puntos no hay nada con sustancia («…mañana: ok»), se
--    ignora y se sigue como siempre.
--
-- 2. EL DÍA TAMPOCO ES EL TÍTULO CUANDO VIENE ADELANTE
--
--    «recuérdame mañana llamar a Juan»  → se guardaba «Mañana llamar a Juan»
--    «recuérdame mañana:»               → se guardaba «Mañana»
--
--    El recorte de tiempo exigía un espacio delante del día, y un día que arranca
--    la frase no lo tiene. Ahora también se recorta al principio.
--
-- 3. UN TÍTULO DE UNA SOLA PALABRA GENÉRICA NO ES UN TÍTULO
--
--    Red de seguridad: si después de todo queda «tarea», «pendiente», «algo» y
--    similares, se usa «Recordatorio personal» — igual que cuando queda vacío.
--    Es honesto en vez de aparentar que se entendió algo.
--
-- PROBADO: 24/24 títulos (los 4 nuevos + los dos puntos de la hora + 10 de
-- regresión) y 8/8 de punta a punta contra el cerebro real. El golden de ventas
-- queda 35/35 igual que antes, sin un solo caso cambiado — corriéndolo con la
-- cancha de QA (chat -990001), que es con la que da 35/35; con un chat real da
-- 28/35 porque los casos esperan los leads sintéticos (Diana, Carlos, Maria).
--
-- REVERTIR: CREATE OR REPLACE de _bot_agenda_extract_title con el cuerpo de la
-- mig 212 §2. Una sola función, un solo consumidor (bot_agenda_personal_create).
-- Sin DDL, sin tocar datos.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._bot_agenda_extract_title(p_text text)
returns text
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_title   text := btrim(coalesce(p_text,''));
  v_payload text;
  v_probe   text;
begin
  -- mig 212b: «una tarea para mañana: llamar a los de seguimiento» → el pedido
  -- está a la derecha de los dos puntos. Los de una hora no cuentan: se
  -- reconocen porque llevan un dígito detrás (3:30).
  v_payload := (regexp_match(v_title, ':(?![0-9])\s*(.+)$'))[1];
  if v_payload is not null and btrim(v_payload) ~ '\w{3,}' then
    v_title := btrim(v_payload);
  end if;

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

  -- mig 212b: el día también puede venir ADELANTE («mañana llamar a Juan»).
  -- Ahí tampoco es el título: es cuándo.
  v_title := regexp_replace(v_title,
    '^\s*(para\s+)?(el\s+)?\m(hoy|ma[nñ]ana|pasado ma[nñ]ana|lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\M\s*',
    '', 'i');

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

  -- mig 212b: un título que quedó en una palabra genérica no dice nada.
  v_probe := lower(translate(v_title,'áéíóú','aeiou'));
  if v_title = '' or v_probe in ('tarea','tareas','recordatorio','recordatorios',
                                 'pendiente','pendientes','actividad','actividades',
                                 'cosa','algo','eso','esto') then
    v_title := 'Recordatorio personal';
  end if;

  return upper(left(v_title, 1)) || substr(v_title, 2);
end;
$fn$;
