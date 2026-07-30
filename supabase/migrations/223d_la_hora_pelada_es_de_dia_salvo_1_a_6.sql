-- mig 223d — «Hay que ordenar el archivo de expedientes mañana a las 9» quedaba a las
-- 9:00 P.M. Causa: fn_due_ventas tiene la regla «si la hora pelada cae fuera de la
-- jornada, prueba +12» y la jornada de Duke está configurada 10:00-22:00 → las 9:00
-- caían "fuera" y saltaban a las 21:00 (dentro). La regla era buena para «a las 4»
-- (16:00 ✓) pero mala para 7-11 de la mañana, que es lectura natural de oficina.
-- Qué cambia: el volteo +12 de una hora pelada se limita a 1-6 (nadie agenda trabajo
-- de 1 a 6 de la madrugada); de 7 a 11 la hora queda de DÍA aunque la jornada
-- configurada empiece más tarde. Con am/pm/«de la tarde» explícitos nada cambia.
-- Se toca en los DOS lugares que hacían el volteo (hora suelta sin día, y hora venida
-- del parser con día). Revertir: CREATE OR REPLACE con «v_h < 12» / «'12:00'::time».

create or replace function public.fn_due_ventas(p_profile_id uuid, p_texto text, p_tz text default null::text)
 returns timestamp with time zone
 language plpgsql
 stable
as $function$
declare
  v_tz text; v_ws time; v_we time; v_txt text; v_res timestamptz;
  v_explicita boolean; v_relativo boolean; v_local time; v_pm time;
  v_dia text; v_base date; v_dow int; v_diff int;
  h text[]; v_h int; v_m int; v_temprano boolean; v_mediodia boolean;
begin
  v_txt := fn_hora_en_palabras(nullif(btrim(coalesce(p_texto,'')), ''));
  if nullif(v_txt,'') is null then return null; end if;

  select coalesce(p_tz, work_tz, timezone, 'America/Cancun'),
         coalesce(work_start,'09:00'::time), coalesce(work_end,'19:00'::time)
    into v_tz, v_ws, v_we
  from profiles where id = p_profile_id;
  v_tz := coalesce(v_tz, p_tz, 'America/Cancun');
  v_ws := coalesce(v_ws, '09:00'::time);
  v_we := coalesce(v_we, '19:00'::time);

  -- Lo que dice un jefe cuando no da una hora exacta.
  v_temprano := translate(lower(coalesce(p_texto,'')),'áéíóú','aeiou') ~ '\m(temprano|a\s+primera\s+hora|primera\s+hora|apenas\s+llegue|apenas\s+lleguen)\M';
  v_mediodia := translate(lower(coalesce(p_texto,'')),'áéíóú','aeiou') ~ '\m(al|del|de|para\s+el|antes\s+del)?\s*mediodia\M';

  begin v_res := parse_relative_or_abs_es(v_txt, v_tz); exception when others then v_res := null; end;

  if v_res is null then
    v_dia := (regexp_match(translate(lower(v_txt),'áéíóú','aeiou'),
      '\m(hoy|pasado\s+ma[nñ]ana|ma[nñ]ana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\M'))[1];

    if v_dia is not null then
      v_base := (now() at time zone v_tz)::date;
      v_dia  := regexp_replace(v_dia, '\s+', ' ', 'g');
      if v_dia like 'pasado%' then
        v_base := v_base + 2;
      elsif v_dia in ('manana','mañana') then
        v_base := v_base + 1;
      elsif v_dia <> 'hoy' then
        v_dow := case v_dia when 'lunes' then 1 when 'martes' then 2 when 'miercoles' then 3
                 when 'jueves' then 4 when 'viernes' then 5 when 'sabado' then 6
                 when 'domingo' then 7 else null end;
        if v_dow is null then return null; end if;
        v_diff := (v_dow - extract(isodow from v_base)::int + 7) % 7;
        if v_diff = 0 then v_diff := 7; end if;
        v_base := v_base + v_diff;
      end if;

      -- Un día sin hora vence al CIERRE de la jornada… salvo que el jefe haya
      -- dicho «temprano» o «al mediodía».
      v_res := (v_base + case when v_temprano then v_ws
                              when v_mediodia then '12:00'::time
                              else v_we end) at time zone v_tz;
      if v_res <= now() then v_res := v_res + interval '1 day'; end if;
      return v_res;
    end if;

    -- Una HORA suelta, sin día (mig 196b).
    h := regexp_match(v_txt, '\m(?:a|de|del|para|hasta|antes\s+de(?:l)?)?\s*las?\s+(\d{1,2})(?::(\d{2}))?', 'i');
    if h is null then h := regexp_match(v_txt, '\m(\d{1,2}):(\d{2})\M'); end if;
    if h is null then
      -- «temprano» a secas, sin día: mañana a la apertura.
      if v_temprano or v_mediodia then
        v_res := ((now() at time zone v_tz)::date
                  + case when v_temprano then v_ws else '12:00'::time end) at time zone v_tz;
        if v_res <= now() then v_res := v_res + interval '1 day'; end if;
        return v_res;
      end if;
      return null;
    end if;
    v_h := h[1]::int; v_m := coalesce(h[2]::int, 0);
    if v_h > 23 or v_m > 59 then return null; end if;

    if v_txt ~* '\m(pm|p\.?\s?m|de\s+la\s+(tarde|noche))\M' and v_h < 12 then v_h := v_h + 12; end if;
    if v_txt ~* '\m(am|a\.?\s?m|de\s+la\s+(manana|mañana|madrugada))\M' and v_h = 12 then v_h := 0; end if;

    v_base := (now() at time zone v_tz)::date;
    v_res  := (v_base + make_time(v_h, v_m, 0)) at time zone v_tz;

    -- mig 223d: solo 1-6 se voltean a la tarde; 7-11 son de día aunque la jornada abra más tarde.
    if v_txt !~* '\m(am|pm|a\.?\s?m|p\.?\s?m|de\s+la\s+(tarde|noche|manana|mañana|madrugada))\M'
       and v_h < 7 then
      v_pm := make_time(v_h, v_m, 0) + interval '12 hours';
      if (make_time(v_h, v_m, 0) < v_ws or make_time(v_h, v_m, 0) > v_we)
         and v_pm >= v_ws and v_pm <= v_we then
        v_res := v_res + interval '12 hours';
      end if;
    end if;

    if v_res <= now() then v_res := v_res + interval '1 day'; end if;
    return v_res;
  end if;

  -- mig 204: si el jefe dijo «temprano»/«al mediodía» y no dio hora exacta,
  -- eso vale más que la hora por defecto que haya puesto el parser.
  if (v_temprano or v_mediodia)
     and v_txt !~* '(\m\d{1,2}\s*[:.]\s*\d{2})|(\m\d{1,2}\s*(am|pm|a\.?\s?m|p\.?\s?m)\M)|(\ma\s+las?\s+)' then
    v_res := (((v_res at time zone v_tz)::date)
              + case when v_temprano then v_ws else '12:00'::time end) at time zone v_tz;
    if v_res <= now() then v_res := v_res + interval '1 day'; end if;
    return v_res;
  end if;

  v_relativo  := v_txt ~ '(en|dentro\s+de)\s';
  v_explicita := v_txt ~ '(\d{1,2}\s*(a\.?\s?m|p\.?\s?m))|(de\s+la\s+(tarde|noche|mañana|manana|madrugada))';

  if not v_explicita and not v_relativo then
    v_local := (v_res at time zone v_tz)::time;
    -- mig 223d: mismo criterio — el volteo +12 solo aplica a 1-6.
    if v_local < '07:00'::time then
      v_pm := v_local + interval '12 hours';
      if (v_local < v_ws or v_local > v_we) and v_pm >= v_ws and v_pm <= v_we then
        v_res := v_res + interval '12 hours';
      end if;
    end if;
  end if;

  return v_res;
end
$function$;