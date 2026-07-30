-- mig 226b — «a las diez» también es una hora (salió del golden tras la mig 226):
--   · _bot_hora_explicita solo entendía dígitos: «a las diez» caía en (sin hora).
--     Ahora convierte la palabra a dígito SOLO cuando viene tras «a las / la(s) /
--     tipo / sobre las / hacia las» (así «en dos horas», que es relativo, NO se toca)
--     y llega hasta doce («a las once» y «a las doce» son de uso diario).
--   · El caso 44 del golden asertaba el encabezado «2 actividades» que la mig 226
--     quitó; ahora aserta lo que importa: las DOS tareas separadas y CON su hora.
-- Reversible: CREATE OR REPLACE con el cuerpo anterior + update del esperado viejo.

create or replace function public._bot_hora_explicita(p_text text)
returns text[]
language plpgsql
set search_path to 'public', 'pg_temp'
as $fn$
declare
  t text := lower(unaccent(coalesce(p_text,'')));
  m text[]; h int; mi int; mer text;
begin
  if btrim(t) = '' then return null; end if;

  -- mig 226b: la hora dicha en PALABRAS pasa a dígito, solo tras el marcador de hora
  -- («a las diez» → «a las 10»); lo relativo («en dos horas») no se toca.
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)(?:una|uno)\M', '\1 1', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)dos\M',    '\1 2', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)tres\M',   '\1 3', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)cuatro\M', '\1 4', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)cinco\M',  '\1 5', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)seis\M',   '\1 6', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)siete\M',  '\1 7', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)ocho\M',   '\1 8', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)nueve\M',  '\1 9', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)diez\M',   '\1 10', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)once\M',   '\1 11', 'g');
  t := regexp_replace(t, '(\m(?:a\s+las?|las|tipo|sobre\s+las|hacia\s+las)\s+)doce\M',   '\1 12', 'g');

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

update public.qa_golden_cases
set esperado_ilike = '%llamar a los clientes nuevos — mañana 10:00%actualizar el tablero — mañana 3:00%'
where id = 44 and esperado_ilike = '2 actividades';