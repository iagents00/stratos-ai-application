-- mig 223e — La respuesta con la fecha no tocaba la tarea del plan cuando el plan venía
-- del separador (dictado crudo): el pendiente guarda el texto en SUBJUNTIVO («haga
-- seguimiento a los de remarketing») y el objetivo del intérprete llega en INFINITIVO
-- («Hacer seguimiento…», como se ve en la tarjeta). El matcheo exigía TODAS las palabras
-- significativas y «hacer» no aparece en «haga» → la tarea se saltaba y la tarjeta se
-- re-mostraba igual (evidencia: secuencia B de la verificación de la 223, y la prueba
-- real de Ángel «La fecha para lo de L seguimiento es mañana a las 4pm»).
-- Qué cambia:
--   · helper fn_obj_matchea(objetivo, texto): matchea si al menos el 60% de las palabras
--     significativas (≥4 letras) del objetivo están en el texto; sin palabras → matchea todo
--     (mismo comportamiento de antes). «hacer seguimiento remarketing» → 2/3 ✓.
--   · bot_corregir_plan usa el helper en la rama a (plan pendiente) y en la rama b
--     (recién registrado); además la rama a normaliza la hora al armar el cuando
--     («4:00 p.m.» → «a las 4:00 pm») para que el parser nunca la pierda.
-- Revertir: CREATE OR REPLACE de bot_corregir_plan con el matcheo estricto anterior
-- (encabezado de la 223b); el helper puede quedar (no lo llama nadie más).

create or replace function public.fn_obj_matchea(p_obj text, p_texto text)
returns boolean
language sql
immutable
as $fn$
  with palabras as (
    select w from unnest(regexp_split_to_array(public.unaccent(lower(coalesce(p_obj,''))), '\s+')) w
    where length(w) >= 4
  ),
  conteo as (
    select count(*)::numeric as total,
           count(*) filter (where public.unaccent(lower(coalesce(p_texto,''))) like '%'||w||'%')::numeric as dentro
    from palabras
  )
  select case when total = 0 then true else dentro >= ceil(total * 0.6) end from conteo;
$fn$;

create or replace function public.bot_corregir_plan(p_telegram_chat_id bigint, p_args jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prof record; v_tz text; v_hora text; v_dia text; v_obj text;
  v_when timestamptz; v_pend record; v_t jsonb; v_tareas jsonb := '[]'::jsonb;
  v_res jsonb; v_n int := 0; v_out text := ''; r record; v_nuevo timestamptz;
begin
  select id, organization_id, name into v_prof from profiles
   where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) limit 1;
  if v_prof.id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré tu perfil.','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;
  v_tz := coalesce(public.fn_user_tz(v_prof.organization_id, p_telegram_chat_id),'America/Cancun');
  v_hora := nullif(btrim(coalesce(p_args->>'nueva_hora','')),'');
  v_dia  := nullif(btrim(coalesce(p_args->>'nuevo_dia','')),'');
  v_obj  := nullif(btrim(coalesce(p_args->>'objetivo','')),'');
  declare v_resp text := nullif(btrim(coalesce(p_args->>'nuevo_responsable','')),''); begin
  -- mig 222: una confirmación/negación pura JAMÁS es corrección — va al flujo determinista
  if lower(public.unaccent(coalesce(p_args->>'input_text',''))) ~
     '^\s*((si|no|dale|ok|okey|confirmo|confirmar|correcto|adelante|claro|cancela|cancelar|nel|nop)[\s.!]*)+$' then
    return public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, '',
      jsonb_build_object('input_text', coalesce(p_args->>'input_text','')));
  end if;
  if v_hora is null and v_dia is null and v_resp is null then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','¿Para qué hora o día lo corrijo? Ej: «a las 10 am» o «mejor el viernes 9 am».','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;

  -- a) hay un plan esperando el «sí» → se corrige ESE y se vuelve a mostrar
  select * into v_pend from bot_pending_confirm
   where telegram_chat_id = p_telegram_chat_id and action = 'team_plan';
  if found and jsonb_typeof(v_pend.payload->'tareas') = 'array' then
    for v_t in select value from jsonb_array_elements(v_pend.payload->'tareas') loop
      if v_obj is not null and not public.fn_obj_matchea(v_obj, coalesce(v_t->>'texto','')) then
        v_tareas := v_tareas || v_t; continue;
      end if;
      v_tareas := v_tareas || (v_t
        || case when v_resp is not null and coalesce(nullif(btrim(v_t->>'responsable'),''), '¿Para quién?') in ('¿Para quién?','Todos')
             then jsonb_build_object('responsable', v_resp) else '{}'::jsonb end
        || jsonb_build_object('cuando', case when v_hora is null and v_dia is null then coalesce(v_t->>'cuando','') else
        btrim(concat_ws(' ',
          coalesce(v_dia, (regexp_match(lower(public.unaccent(coalesce(v_t->>'cuando',''))),
            '(pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)'))[1]),
          case when v_hora is null then null
               when lower(v_hora) ~ '\mlas?\M' then regexp_replace(lower(public.unaccent(v_hora)), '\.', '', 'g')
               else 'a las '||regexp_replace(lower(public.unaccent(v_hora)), '\.', '', 'g') end)) end));
    end loop;
    v_res := public.bot_create_team_actions(p_telegram_chat_id, v_tareas, false);
    delete from bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
    if coalesce((v_res->>'necesita_confirmacion')::boolean, false) then
      insert into bot_pending_confirm (telegram_chat_id, action, organization_id, payload)
      values (p_telegram_chat_id, 'team_plan', v_prof.organization_id, jsonb_build_object('tareas', v_tareas));
    end if;
    return v_res;
  end if;

  -- b) sin plan pendiente → corregir lo recién registrado por quien escribe (mig 223b)
  declare
    v_hh text[]; v_time time; v_day date; v_hnorm text;
  begin
    if v_hora is null and v_dia is null then
      return jsonb_build_object('ok',true,'reply',jsonb_build_object(
        'text','Esa tarea ya quedó registrada. Para cambiarle el responsable, dímela de nuevo completa (qué, quién y cuándo).',
        'parse_mode',null,'inline_keyboard','[]'::jsonb));
    end if;
    if v_hora is not null then
      v_hnorm := lower(public.unaccent(regexp_replace(v_hora, '\.', '', 'g')));
      if v_hnorm !~ '\mlas?\M' then v_hnorm := 'a las '||v_hnorm; end if;
      v_hh := public._bot_hora_explicita(v_hnorm);
      if v_hh is null then
        return jsonb_build_object('ok',true,'reply',jsonb_build_object(
          'text','No entendí la hora nueva. Dímela como «a las 4 pm» o «a las 16:00».',
          'parse_mode',null,'inline_keyboard','[]'::jsonb));
      end if;
      v_time := make_time(v_hh[1]::int, coalesce(nullif(v_hh[2],'')::int,0), 0);
      -- horario laboral: una hora pelada de 1 a 6 es de la tarde
      if v_time < '07:00'::time and v_hnorm !~ '\m(am|a m)\M' and v_hnorm !~ '(madrugada|de la manana)' then
        v_time := v_time + interval '12 hours';
      end if;
    end if;
    if v_dia is not null then
      v_when := public.parse_relative_or_abs_es(lower(public.unaccent(v_dia))||' a las 12', v_tz);
      if v_when is null then
        return jsonb_build_object('ok',true,'reply',jsonb_build_object(
          'text','No entendí el día nuevo. Dímelo como «mañana», «el viernes» o «el 15 de agosto».',
          'parse_mode',null,'inline_keyboard','[]'::jsonb));
      end if;
      v_day := (v_when at time zone v_tz)::date;
    end if;

    for r in
      select id, text, due_at from team_actions
       where created_by = v_prof.id and created_at > now() - interval '40 minutes'
         and coalesce(done,false) = false
         and (v_obj is null or public.fn_obj_matchea(v_obj, text))
       order by created_at desc
       limit case when v_obj is null then 1 else 3 end
    loop
      update team_actions set due_at =
        ((coalesce(v_day, (due_at at time zone v_tz)::date))
         + coalesce(v_time, (due_at at time zone v_tz)::time)) at time zone v_tz
      where id = r.id;
      select due_at into v_nuevo from team_actions where id = r.id;
      v_n := v_n + 1;
      v_out := v_out || '· «'||r.text||'» → '||fn_fmt_cuando_legible(v_nuevo, v_tz)||chr(10);
    end loop;
    if v_n = 0 then
      return jsonb_build_object('ok',true,'reply',jsonb_build_object(
        'text','No encontré una tarea recién registrada para corregir. Dime cuál es, por ejemplo: «la de revisar la torre 4, a las 10 am».',
        'parse_mode',null,'inline_keyboard','[]'::jsonb));
    end if;
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text','Listo, corregido:'||chr(10)||v_out,'parse_mode',null,'inline_keyboard','[]'::jsonb));
  end;
end;
end;
$function$;