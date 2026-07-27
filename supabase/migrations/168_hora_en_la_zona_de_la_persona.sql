-- BUG que reportó Ángel (27-jul, con captura): a las **14:22 de Bogotá** pidió
-- «recordame en 2 minutos» y el sistema contestó **«tarea creada para las 13:24»**
-- — una hora que ya había pasado.
--
-- Causa: el agente manda `due` como texto SIN zona horaria. Postgres lo
-- interpreta en la zona del servidor (UTC) y el agente, encima, hace la cuenta
-- de la hora local a ojo. Resultado: se desfasa una hora y la tarea nace vencida.
--
-- Fix, en la BASE y no en el prompt (un prompt vuelve a fallar; esto no):
--   1. Si `due` viene SIN zona, se interpreta en la zona horaria DE LA PERSONA
--      (`profiles.work_tz` → `timezone` → Bogotá). Nunca más en la del servidor.
--   2. Se aceptan `en_minutos` / `en_horas`: para lo relativo, la cuenta la hace
--      Postgres con `now()`, que no se puede equivocar. El agente ya no calcula.

create or replace function public.fn_tz_de(p_profile_id uuid)
returns text language sql stable as $$
  select coalesce(nullif(work_tz,''), nullif(timezone,''), 'America/Bogota')
  from profiles where id = p_profile_id;
$$;

-- Convierte lo que mande el agente en un instante correcto.
create or replace function public.fn_due_de_args(p_profile_id uuid, p_args jsonb)
returns timestamptz language plpgsql stable as $$
declare v_txt text; v_tz text; v_min numeric;
begin
  v_tz := fn_tz_de(p_profile_id);

  -- (2) Relativo: lo resuelve Postgres, no el agente.
  v_min := coalesce(nullif(p_args->>'en_minutos','')::numeric, 0)
         + coalesce(nullif(p_args->>'en_horas','')::numeric, 0) * 60;
  if v_min > 0 then
    return now() + make_interval(mins => v_min::int);
  end if;

  v_txt := nullif(trim(p_args->>'due'), '');
  if v_txt is null then return null; end if;

  begin
    -- (1) ¿Trae zona? (Z, +05, -0500…). Si sí, se respeta tal cual.
    if v_txt ~ '(Z|[+-]\d{2}:?\d{2})\s*$' then
      return v_txt::timestamptz;
    end if;
    -- Si no, se interpreta en la zona de la persona.
    return (v_txt::timestamp) at time zone v_tz;
  exception when others then
    return null;
  end;
end $$;

-- Se conecta en el despachador. Parche quirúrgico: solo cambia cómo se calcula
-- v_due; ninguna otra rama se toca.
do $mig$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='mkt_nlu_dispatch';

  v_new := replace(v_src,
    E'  begin v_due := nullif(p_args->>''due'','''')::timestamptz; exception when others then v_due := null; end;',
    E'  -- La hora se resuelve en la zona de la persona (o con now() si es relativa).\n'
    '  -- Antes se casteaba a pelo y caía en UTC: «en 2 minutos» nacía una hora tarde.\n'
    '  begin v_due := fn_due_de_args(v_profile.id, p_args); exception when others then v_due := null; end;');

  if v_new = v_src then raise exception 'no encontré el cálculo de v_due'; end if;
  execute v_new;
end $mig$;

grant execute on function public.fn_tz_de(uuid) to anon, authenticated;
grant execute on function public.fn_due_de_args(uuid, jsonb) to anon, authenticated;
