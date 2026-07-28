-- 181 · Copilot: la hora, los avisos y los nombres
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Este archivo es el ESTADO FINAL de diez pasos aplicados el 29-jul-2026
-- (en la base quedaron registrados como las migraciones 178 a 187). Se
-- consolidan acá porque tres de ellos son versiones sucesivas de la MISMA
-- función y el repo no debería cargar tres copias casi iguales. Correr este
-- archivo de cero deja la base exactamente igual — todo es idempotente.
--
-- Los diez pasos, y qué enseñó cada uno:
--   178  La hora la pone la BASE, no el agente
--   179  El agente pasa la frase; parse_relative_or_abs_es calcula la fecha
--   180  Aviso al asignar · «Buen día» · un solo motor
--   181  Se va el aviso de 3 horas (convivían dos motores)
--   182  ⚠️ PROBANDO: el aviso al asignar NO salía. Un CHECK sobre
--        proactive_reminders.tipo lo rechazaba, y el «exception when others»
--        del trigger se tragaba el error. Todo devolvía «ok» y nada llegaba.
--   183  ⚠️ PROBANDO: «¿Ya pudiste comenzar?» salía UNA VEZ POR TAREA — dos
--        mensajes en el mismo segundo. El mismo error que ya se había
--        arreglado en las vencidas, vivo en otro bloque.
--   184  La redacción del «Buen día» se leía mal («no tienes actividades
--        nuevas, y 1 que ya venció»). Se separó a su propia función para
--        poder probar el texto SIN mandarle un mensaje a nadie.
--   185  El motor usa esa función
--   186  ⚠️ PROBANDO: «ponme una tarea» (sin decir a quién) se la asignaba a
--        OTRA PERSONA. Más nombres completos y apodos.
--   187  El laboratorio de QA no puede escribirle a una persona real
--
-- SIETE de estos diez salieron de PROBAR, no de leer. La regla que quedó:
-- una función que le escribe a una persona no se da por terminada hasta haber
-- leído lo que le llegó, a la hora que le llegó.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1 · LA HORA ═══════════════════════════════════════════════════════════
-- Alex dictó «asígnale una tarea a Yazz … mañana a las 4pm» y quedó a las
-- 17:00 de Cancún. due_at = 22:00 UTC menos las 16:00 pedidas = UTC-6.
-- Cancún es UTC-5 y no tiene horario de verano: el sistema interpretó las 4pm
-- en hora de Ciudad de México.
--
-- CAUSA: el prompt del agente (flujo n8n lplLwsnJapOXtFcs) pedía «due en ISO
-- 8601 CON ZONA». Le pedíamos a un modelo que hiciera aritmética de husos
-- horarios mientras la base tenía el dato real (profiles.work_tz) sin usarlo.
--
-- LA REGLA: cuando la base conoce el dato de verdad, no se le pregunta al
-- agente. El agente dice QUÉ hora; la base dice EN QUÉ ZONA. Así funciona
-- igual para Cancún, para Bogotá (NSG) y para cualquier white-label futuro,
-- sin tocar ningún prompt.
create or replace function public.fn_due_de_args(p_profile_id uuid, p_args jsonb)
 returns timestamp with time zone
 language plpgsql
 stable
as $function$
declare
  v_txt text; v_naive text; v_tz text; v_min numeric; v_we time;
  v_cuando text; v_res timestamptz; v_tiene_hora boolean; v_es_relativo boolean;
begin
  v_tz := fn_tz_de(p_profile_id);
  select coalesce(work_end, '18:00'::time) into v_we from profiles where id = p_profile_id;
  v_we := coalesce(v_we, '18:00'::time);

  -- (A) Relativo explícito en args («en_horas», «en_minutos»).
  v_min := coalesce(nullif(p_args->>'en_minutos','')::numeric, 0)
         + coalesce(nullif(p_args->>'en_horas','')::numeric, 0) * 60;
  if v_min > 0 then
    return now() + make_interval(mins => v_min::int);
  end if;

  -- (B) LA FRASE, tal cual la dijo la persona. Fuente preferida: la calcula
  --     Postgres, con la zona real y el «hoy» real de esa persona.
  --     parse_relative_or_abs_es ya la usa el bot de ventas desde hace meses;
  --     probada contra 20 frases reales entiende 15, incluidos los días de la
  --     semana («el viernes a las 10» → 31 Jul 10:00).
  v_cuando := lower(nullif(trim(p_args->>'cuando'), ''));
  if v_cuando is not null then
    begin v_res := parse_relative_or_abs_es(v_cuando, v_tz); exception when others then v_res := null; end;
    if v_res is not null then
      v_es_relativo := v_cuando ~ '(en|dentro\s+de)\s';
      v_tiene_hora  := v_cuando ~ '(\d{1,2}\s*:\s*\d{2})|(\d{1,2}\s*(a\.?\s?m|p\.?\s?m))|(a\s+las\s+\d)|(de\s+la\s+(tarde|noche|mañana|manana|madrugada))|(medio\s*d[íi]a)';
      -- Sin hora y sin «dentro de» → «para el jueves» → cierre de su jornada.
      -- El parser compartido la dejaba a las 09:00, ANTES de que Duke abra a
      -- las 10:00: la tarea nacía vencida. No se toca parse_relative_or_abs_es
      -- (la usa ventas): el ajuste vive de este lado.
      if not v_tiene_hora and not v_es_relativo then
        v_res := (((v_res at time zone v_tz)::date + v_we)::timestamp) at time zone v_tz;
      end if;
      return v_res;
    end if;
  end if;

  -- (C) Respaldo: el ISO que arma el agente. Se le DESCARTA el huso — el
  --     agente adivina el offset, la base lo sabe. El guardia «tiene hora»
  --     evita comerse el día en una fecha pelada (2026-07-29 termina en «-29»
  --     y un regex suelto lo destrozaría).
  v_txt := nullif(trim(p_args->>'due'), '');
  if v_txt is null then return null; end if;

  begin
    v_naive := replace(trim(v_txt), 'T', ' ');
    if v_naive ~ '\d{1,2}:\d{2}' then
      v_naive := regexp_replace(v_naive, '\s*(Z|[+-]\d{2}(:?\d{2})?)\s*$', '');
    end if;
    if v_naive ~ '^\d{4}-\d{2}-\d{2}$' then
      return ((v_naive::date + v_we)::timestamp) at time zone v_tz;
    end if;
    return (v_naive::timestamp) at time zone v_tz;
  exception when others then
    return null;
  end;
end $function$;

comment on function public.fn_due_de_args(uuid, jsonb) is
  'Convierte lo que dicta la persona en un due_at. Prefiere p_args.cuando (la frase en español, '
  'resuelta por parse_relative_or_abs_es en la zona real del perfil); si no, usa p_args.due '
  'descartando el huso que mande el agente. Sin hora explícita vence al cierre de su jornada.';


-- ═══ 2 · APODOS ════════════════════════════════════════════════════════════
-- El Copilot decía «Yazz», «Luis», «Emmanuel». Alex lleva su hoja con Yazmin
-- Ledesma, Luis Ángel Landeros y Emmanuel Sánchez — y en Duke hay DOS Emmanuel
-- (Sánchez de marketing y Ortiz, director de VENTAS), así que «Emmanuel» a
-- secas es ambiguo. Se ponen los nombres completos, y para que nadie tenga que
-- cambiar cómo habla, cada quien lleva sus apodos.
alter table public.profiles add column if not exists alias text[];
comment on column public.profiles.alias is
  'Cómo le dice el equipo a esta persona («Yazz» → Yazmin Ledesma). Para que el nombre '
  'que se muestra pueda ser el completo sin obligar a nadie a cambiar cómo habla.';

update public.profiles set name='Yazmin Ledesma',
       alias = array['yazz','yaz','yazmin','ledesma']
 where id='90442ec3-e2dc-42bf-bb2b-4d4cba2ec872';

update public.profiles set name='Luis Ángel Landeros',
       alias = array['luis','luis angel','landeros']
 where id='68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31';

update public.profiles set name='Emmanuel Sánchez',
       alias = array['emmanuel','emanuel','emma','manu','sanchez']
 where id='5c952100-6390-4bf0-8d37-ff3cc35cb173';

-- El otro Emmanuel (director de VENTAS). A propósito NO lleva el alias
-- «emmanuel»: en el contexto de marketing, «Emmanuel» debe ser Sánchez.
update public.profiles set alias = array['ortiz','emmanuel ortiz']
 where id='5793c2a3-e3d8-4f59-ae3f-cda8128b272f';

update public.profiles set alias = array['alex','velazquez','velázquez']
 where id='50a045dc-d528-4840-a9f7-503653d94b0c';


-- ═══ 3 · LA ASIGNACIÓN FANTASMA ════════════════════════════════════════════
-- Encontrado PROBANDO: Alex QA escribió «ponme una tarea: revisar el reporte
-- de la semana» — sin decir para quién — y el sistema respondió «✓ Tarea
-- creada … para Luis QA». En Duke se la habría llevado Emmanuel; en NSG, Ángel.
--
-- CAUSA: _mkt_find_profile(org, NULL) tenía «(p_name is null or …)», así que
-- sin nombre la condición era verdadera para TODO el equipo y devolvía al
-- primero de la lista. Después fn_mkt_create_task hace
-- «coalesce(v_asg.id, p_profile_id)» esperando un NULL que nunca llegaba.
--
-- Es de los peores errores posibles: silencioso y creíble. Nadie ve un error;
-- la tarea simplemente aparece en la lista de otro y desaparece de la tuya.
create or replace function public._mkt_find_profile(p_org uuid, p_name text)
 returns table(id uuid, name text)
 language plpgsql
 stable
as $function$
declare v_q text;
begin
  -- SIN NOMBRE = NADIE. Quien llama decide qué hacer con el nulo.
  v_q := lower(unaccent(coalesce(trim(p_name), '')));
  if v_q = '' then return; end if;

  return query
  select p.id, p.name
  from profiles p
  where p.organization_id = p_org
    and coalesce(p.active, true)
    and p.role in ('marketing','super_admin','admin')
    and ( lower(unaccent(p.name)) like '%'||v_q||'%'
       or exists (select 1 from unnest(coalesce(p.alias, '{}'::text[])) a
                  where lower(unaccent(a)) = v_q) )
  order by
    -- 1º su apodo exacto, 2º su nombre exacto, 3º empieza igual,
    -- 4º a igualdad gana marketing (en este módulo «Emmanuel» es Sánchez).
    (exists (select 1 from unnest(coalesce(p.alias, '{}'::text[])) a
             where lower(unaccent(a)) = v_q)) desc,
    (lower(unaccent(p.name)) = v_q) desc,
    (lower(unaccent(p.name)) like v_q||'%') desc,
    (p.role = 'marketing') desc,
    p.name
  limit 1;
end $function$;

comment on function public._mkt_find_profile(uuid, text) is
  'Encuentra a alguien del equipo por nombre completo o apodo (profiles.alias), sin importar '
  'tildes ni mayúsculas. Sin nombre devuelve VACÍO a propósito.';


-- ═══ 4 · LA CONFIRMACIÓN DE LA TAREA, EN SU HORA ═══════════════════════════
create or replace function public.fn_mkt_create_task(p_profile_id uuid, p_titulo text, p_assignee text DEFAULT NULL::text, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_brand text DEFAULT NULL::text, p_project text DEFAULT NULL::text)
 returns text
 language plpgsql
as $function$
declare
  v_org uuid; v_asg record; v_brand record;
  v_proj_id uuid; v_proj_nombre text; v_proj_brand uuid;
  v_modulo text; v_tz text; v_equipo text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return 'Decime qué hay que hacer (el título de la tarea).'; end if;

  v_tz := fn_tz_de(p_profile_id);

  select * into v_asg from _mkt_find_profile(v_org, p_assignee);
  if p_assignee is not null and v_asg.id is null then
    -- El equipo se lee de la base: sirve para Duke, para NSG y para el que venga.
    select string_agg(p.name, ', ' order by p.name) into v_equipo
    from profiles p where p.organization_id = v_org and coalesce(p.active,true)
      and p.role = 'marketing';
    return 'No encontré a «'||p_assignee||'» en el equipo.'
      || coalesce(' ¿Te refieres a '||v_equipo||'?', '');
  end if;
  select * into v_brand from _mkt_find_brand(v_org, p_brand);
  if p_project is not null then
    select id, nombre, brand_id into v_proj_id, v_proj_nombre, v_proj_brand from mkt_projects
    where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_project||'%'
    order by created_at desc limit 1;
  end if;

  insert into mkt_tasks (organization_id, brand_id, project_id, titulo, assignee_id, created_by,
                         estado, prioridad, avance_pct, due_at, origen)
  values (v_org, coalesce(v_proj_brand, v_brand.id), v_proj_id, trim(p_titulo),
          coalesce(v_asg.id, p_profile_id), p_profile_id, 'por_hacer', 'media', 0, p_due, 'copilot');

  select coalesce(o.meta_config->'mkt'->>'moduleLabel', 'Marketing') into v_modulo
  from organizations o where o.id = v_org;

  return '✓ Tarea creada: «'||trim(p_titulo)||'»'
    || ' · para '||coalesce(v_asg.name,'ti')
    || coalesce(' · marca '||v_brand.nombre, '')
    || coalesce(' · proyecto '||v_proj_nombre, '')
    || coalesce(' · vence '||to_char(p_due at time zone v_tz,'DD Mon HH24:MI'), '')
    || '. La ves en el módulo '||v_modulo||'.';
end $function$;


-- ═══ 5 · MI DÍA Y PENDIENTES, EN LA ZONA DE CADA QUIEN ═════════════════════
-- Tenían 'America/Cancun' clavado. Para Duke daba igual; para NSG (Bogotá) y
-- cualquier white-label en otra zona, mostraba la hora equivocada.
create or replace function public.fn_mkt_my_day(p_profile_id uuid)
 returns text
 language plpgsql
 stable
as $function$
declare
  v_org uuid; v_name text; v_role text; v_is_admin boolean; v_hoy date; v_tz text;
  r record; out_txt text := ''; sec text;
begin
  select organization_id, name, role into v_org, v_name, v_role
    from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_is_admin := coalesce(v_role in ('super_admin','admin'), false);
  v_tz  := fn_tz_de(p_profile_id);
  v_hoy := (now() at time zone v_tz)::date;

  for r in select nombre, coalesce(locacion,'') loc from mkt_pipeline_items
           where organization_id=v_org and deleted_at is null and fecha_rodaje=v_hoy loop
    out_txt := out_txt || 'Rodaje de hoy — ' || r.nombre || case when r.loc<>'' then ' · '||r.loc else '' end || E'\n';
  end loop;

  sec := '';
  for r in select t.titulo, t.due_at, coalesce(pa.name,'') quien from mkt_tasks t
           left join profiles pa on pa.id = t.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id)
             and t.estado<>'hecha' and t.due_at is not null
             and (t.due_at at time zone v_tz)::date < v_hoy
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at limit (case when v_is_admin then 12 else 5 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || ' — venció el ' || to_char(r.due_at at time zone v_tz,'DD Mon') || E'\n';
  end loop;
  if sec <> '' then out_txt := out_txt || E'\nVENCIDAS\n' || sec; end if;

  sec := '';
  for r in select t.titulo, t.due_at, coalesce(pa.name,'') quien,
             (t.depends_on is not null and exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado='hecha')) as unlocked
           from mkt_tasks t
           left join profiles pa on pa.id = t.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id)
             and t.estado<>'hecha'
             and (t.due_at is null or (t.due_at at time zone v_tz)::date = v_hoy)
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at nulls last limit (case when v_is_admin then 15 else 8 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || case when r.due_at is not null then ' · '||to_char(r.due_at at time zone v_tz,'HH24:MI') else '' end
        || case when r.unlocked then ' — desbloqueada, ya puedes avanzar' else '' end || E'\n';
  end loop;
  out_txt := out_txt || E'\n' || case when v_is_admin then 'PARA HOY (equipo)' else 'PARA HOY' end || E'\n'
          || case when sec='' then E'Nada pendiente para hoy.\n' else sec end;

  sec := '';
  for r in select t.titulo, coalesce(pa.name,'') quien, d.titulo dep_titulo, coalesce(pd.name,'') dep_quien,
                  greatest(0, (v_hoy - (d.created_at at time zone v_tz)::date)) dias
           from mkt_tasks t
           join mkt_tasks d on d.id = t.depends_on and d.estado<>'hecha'
           left join profiles pa on pa.id = t.assignee_id
           left join profiles pd on pd.id = d.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and (v_is_admin or t.assignee_id=p_profile_id) and t.estado<>'hecha'
           limit (case when v_is_admin then 8 else 5 end) loop
    sec := sec || '• ' || r.titulo
        || case when v_is_admin and r.quien<>'' then ' ('||r.quien||')' else '' end
        || ' — esperando «' || r.dep_titulo || '»'
        || case when r.dep_quien<>'' then ' de '||r.dep_quien else '' end
        || ' · hace ' || r.dias || E' días\n';
  end loop;
  if sec <> '' then
    out_txt := out_txt || E'\n' || case when v_is_admin then 'BLOQUEADAS DEL EQUIPO' else 'BLOQUEADAS (no dependen de ti)' end || E'\n' || sec;
  end if;

  return coalesce(nullif(trim(out_txt),''), 'Sin pendientes por ahora.');
end $function$;

create or replace function public.fn_mkt_person_pending(p_profile_id uuid, p_name text)
 returns text
 language plpgsql
 stable
as $function$
declare v_org uuid; v_p record; r record; out_txt text := ''; v_n int := 0; v_tz text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select * into v_p from _mkt_find_profile(v_org, p_name);
  if v_p.id is null then return 'No encontré a «'||coalesce(p_name,'')||'» en el equipo.'; end if;
  v_tz := fn_tz_de(v_p.id);
  for r in select t.titulo, t.due_at,
             exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha') as blocked
           from mkt_tasks t
           where t.organization_id=v_org and t.deleted_at is null and t.assignee_id=v_p.id and t.estado<>'hecha'
           order by t.due_at nulls last limit 8 loop
    v_n := v_n + 1;
    out_txt := out_txt || '• ' || r.titulo
      || coalesce(' · '||to_char(r.due_at at time zone v_tz,'DD Mon'),'')
      || case when r.blocked then ' — bloqueada (espera a otra tarea)' else '' end || E'\n';
  end loop;
  if v_n = 0 then return v_p.name||' no tiene tareas pendientes en el módulo.'; end if;
  return 'Pendientes de '||v_p.name||E'\n'||out_txt;
end $function$;


-- ═══ 6 · EL AVISO AL ASIGNAR ═══════════════════════════════════════════════
-- Alex le creó una tarea a Yazz y Yazz NO recibió NADA. La tarea sí se creaba
-- y sí salía en su Mi Día — lo que faltaba era el aviso. Se enteró cuando ya
-- estaba vencida, a medianoche.
--
-- Iván, textual (28-jul): «El día siguiente por la mañana, al entrar en el
-- horario laboral, le llegan las actividades a esas personas, y una hora antes
-- se les recuerda, y diez minutos antes.»
--
-- ⚠️ 'mkt_assign' tuvo que entrarle al CHECK de proactive_reminders.tipo. Sin
-- eso el insert fallaba, y como el trigger termina en «exception when others»
-- el error se perdía en silencio: la función devolvía ok y no llegaba nada.
alter table public.proactive_reminders drop constraint if exists proactive_reminders_tipo_check;
alter table public.proactive_reminders add constraint proactive_reminders_tipo_check
  check (tipo = any (array[
    'inactividad','zoom_brief','zoom_escalation','custom','inactividad_insist',
    'next_action_3h','next_action_10min','team_action','team_escalation','personal',
    'visita_30d','visita_15d','visita_7d','visita_1d','zoom_1h_missing','zoom_1h_ok',
    'zoom_15min','evidence_review','evidence_verified','evidence_rejected',
    'admin_overdue','admin_expense','llamada_entrante',
    'mkt_assign'
  ]));

create or replace function public.fn_mkt_next_window_start(p_profile uuid, p_at timestamp with time zone default now())
 returns timestamp with time zone
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_tz text; v_ws time; v_local timestamp; v_d date;
begin
  select coalesce(work_tz, timezone, 'America/Cancun'), coalesce(work_start, '10:00'::time)
    into v_tz, v_ws from profiles where id = p_profile;
  if not found then return p_at; end if;
  v_local := p_at at time zone v_tz;
  v_d := v_local::date;
  if v_local::time < v_ws then
    return ((v_d + v_ws)::timestamp) at time zone v_tz;          -- hoy, más tarde
  end if;
  return (((v_d + 1) + v_ws)::timestamp) at time zone v_tz;      -- mañana al abrir
end $function$;

comment on function public.fn_mkt_next_window_start(uuid, timestamptz) is
  'Momento en que abre la próxima jornada de esa persona, en su zona. Para agendar avisos '
  'que caen fuera de horario en vez de mandarlos de madrugada.';

create or replace function public.trg_mkt_task_assigned_fn()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_on text; v_pid uuid; v_pname text; v_chat bigint; v_tz text; v_act boolean;
  v_creador text; v_txt text; v_when timestamptz; v_id uuid;
begin
  if new.assignee_id is null or new.assignee_id = new.created_by then return new; end if;

  select coalesce(meta_config->>'mkt_persecucion','off') into v_on
    from organizations where id = new.organization_id;
  if coalesce(v_on,'off') <> 'on' then return new; end if;

  select p.id, p.name, p.telegram_chat_id,
         coalesce(p.work_tz, p.timezone, 'America/Cancun'), coalesce(p.active, true)
    into v_pid, v_pname, v_chat, v_tz, v_act
    from profiles p where p.id = new.assignee_id;
  if v_pid is null or not v_act then return new; end if;

  select name into v_creador from profiles where id = new.created_by;

  v_txt := coalesce(v_creador,'Tu líder')||' te asignó una tarea: «'||new.titulo||'»'
    || coalesce(' · para el '||to_char(new.due_at at time zone v_tz,'DD Mon')
                ||' a las '||to_char(new.due_at at time zone v_tz,'HH24:MI'), '')
    || '. Ya la tienes en Mi Día. Cuando la empieces dime "ya empecé '||new.titulo||'".';

  if fn_mkt_in_window(v_pid, now()) then
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo,
                                     scheduled_at, status, payload, dedupe_key)
      values (new.organization_id, v_pid, v_pname, 'mkt_assign', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', new.id), 'mkt_assign:'||new.id)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if v_chat is not null then perform fn_log_proactive_copilot(v_chat, v_txt, 'ai'); end if;
  else
    -- Fuera de su horario: queda agendado para cuando abra su jornada.
    v_when := fn_mkt_next_window_start(v_pid, now());
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo,
                                     scheduled_at, status, payload, dedupe_key)
      values (new.organization_id, v_pid, v_pname, 'mkt_assign', v_when, 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', new.id), 'mkt_assign:'||new.id);
  end if;

  return new;
exception when others then
  -- La tarea SIEMPRE se crea, pase lo que pase con el aviso. Pero que se OIGA:
  -- este warning queda en el log de Postgres. Un aviso que falla en silencio es
  -- peor que uno que no existe — creés que está andando.
  raise warning 'trg_mkt_task_assigned_fn falló para la tarea % (%): %', new.id, new.titulo, sqlerrm;
  return new;
end $function$;

drop trigger if exists trg_mkt_task_assigned on public.mkt_tasks;
create trigger trg_mkt_task_assigned
  after insert on public.mkt_tasks
  for each row execute function public.trg_mkt_task_assigned_fn();


-- ═══ 7 · EL SALUDO DE LA MAÑANA ════════════════════════════════════════════
-- Vive aparte del motor a propósito: así se puede probar la REDACCIÓN sola,
-- sin mandarle un mensaje a nadie para verla. La primera versión decía «Hoy no
-- tienes actividades nuevas, y 1 que ya venció», que se lee mal.
create or replace function public.fn_mkt_texto_buen_dia(p_nombre text, p_hoy int, p_venc int, p_lista text)
 returns text
 language sql
 immutable
as $function$
  select 'Buen día, ' || split_part(p_nombre,' ',1) || '. '
    || case
         when p_hoy > 0 and p_venc = 0 then
           'Hoy tienes ' || p_hoy || case when p_hoy=1 then ' actividad:' else ' actividades:' end
         when p_hoy > 0 and p_venc > 0 then
           'Hoy tienes ' || p_hoy || case when p_hoy=1 then ' actividad' else ' actividades' end
           || ', y te ' || case when p_venc=1 then 'quedó 1 vencida:' else 'quedaron ' || p_venc || ' vencidas:' end
         else
           'Hoy no tienes actividades nuevas, pero te '
           || case when p_venc=1 then 'quedó 1 vencida:' else 'quedaron ' || p_venc || ' vencidas:' end
       end
    || E'\n' || p_lista
    || E'\nCuando empieces alguna dime "ya empecé …" y cuando la cierres, "ya terminé …".';
$function$;

comment on function public.fn_mkt_texto_buen_dia(text,int,int,text) is
  'Arma el saludo de la mañana. Vive aparte del tick para poder probar la redacción sola, '
  'sin mandarle nada a nadie.';


-- ═══ 8 · EL MOTOR ÚNICO DE AVISOS ══════════════════════════════════════════
-- Antes convivían DOS motores diciendo lo mismo: el escáner avisaba a 3 horas y
-- la persecución a 1h y 10min. En el chat de Yazz se ven los dos seguidos —
-- «Se acerca tu entrega» 12:00 y «¿Ya pudiste comenzar?» 12:25 — por la MISMA
-- tarea. Ahora queda uno solo, con los tiempos que pidió Iván.
create or replace function public.fn_mkt_persecucion_tick()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; v_id uuid; v_txt text; v_n int := 0; v_key text;
  v_hoy int; v_venc int; v_lista text;
begin
  -- A) FALTA 1 HORA
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at between now() + interval '10 minutes' and now() + interval '65 minutes'
      and fn_mkt_in_window(p.id, now())
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_due_1h:'||t.id||':'||to_char(t.due_at,'YYYYMMDDHH24MI'))
  loop
    v_txt := 'Falta 1 hora: «'||r.titulo||'» vence a las '
      || to_char(r.due_at at time zone r.ptz, 'HH24:MI')
      || '. ¿Cómo vas? Cuando la termines dime "ya terminé '||r.titulo||'"; si necesitas más tiempo dime "pospón '||r.titulo||' para más tarde".';
    v_key := 'mkt_due_1h:'||r.id||':'||to_char(r.due_at,'YYYYMMDDHH24MI');
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- B) ÚLTIMOS 10 MINUTOS — urgente, pero DENTRO DE LA JORNADA.
  --    Antes decía «siempre»: por ahí se colaban los avisos de madrugada de
  --    las tareas que habían quedado venciendo a la 01:00.
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at between now() and now() + interval '10 minutes'
      and fn_mkt_in_window(p.id, now())
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_due_10m:'||t.id||':'||to_char(t.due_at,'YYYYMMDDHH24MI'))
  loop
    v_txt := 'Últimos 10 minutos: «'||r.titulo||'» vence a las '
      || to_char(r.due_at at time zone r.ptz, 'HH24:MI')
      || '. ¿Ya está hecha o no? Si ya está, dime "ya terminé '||r.titulo||'"; si no llegas, dime "pospón '||r.titulo||'" o avísale a tu líder.';
    v_key := 'mkt_due_10m:'||r.id||':'||to_char(r.due_at,'YYYYMMDDHH24MI');
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- C) "¿YA PUDISTE COMENZAR?" — UNO POR PERSONA (la tarea más urgente sin
  --    empezar), máximo 2 al día, separados 3 horas.
  --    Antes era uno por TAREA: en el laboratorio, Luis recibió DOS en el
  --    mismo segundo. Con cinco pendientes serían cinco. Es el mismo error
  --    que ya se había arreglado en las vencidas, vivo en otro bloque.
  for r in
    with candidatas as (
      select distinct on (p.id)
             t.id, t.titulo, t.due_at, t.organization_id,
             p.id as pid, p.name as pname, p.telegram_chat_id as chat,
             coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz,
             to_char(now() at time zone coalesce(p.work_tz, p.timezone, 'America/Cancun'),'YYYYMMDD') as dia
      from mkt_tasks t
      join profiles p on p.id = t.assignee_id and coalesce(p.active,true)
      join organizations o on o.id = t.organization_id
      where t.deleted_at is null and t.estado = 'por_hacer'
        and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
        and t.created_at < now() - interval '45 minutes'
        and (t.due_at is null or t.due_at > now() + interval '2 hours')
        and fn_mkt_in_window(p.id, now())
      order by p.id, t.due_at nulls last, t.created_at
    )
    select c.*,
           case when not exists (select 1 from proactive_reminders x
                                 where x.dedupe_key = 'mkt_start_dia:'||c.pid||':'||c.dia||':1')
                then 1
                when not exists (select 1 from proactive_reminders x
                                 where x.dedupe_key = 'mkt_start_dia:'||c.pid||':'||c.dia||':2')
                 and exists (select 1 from proactive_reminders x
                             where x.dedupe_key = 'mkt_start_dia:'||c.pid||':'||c.dia||':1'
                               and x.sent_at < now() - interval '3 hours')
                then 2
                else 0 end as intento
    from candidatas c
  loop
    if r.intento = 0 then continue; end if;
    if r.intento = 1 then
      v_txt := '¿Ya pudiste comenzar «'||r.titulo||'»?'
        || case when r.due_at is not null
                then ' Va para el '||to_char(r.due_at at time zone r.ptz, 'DD Mon HH24:MI')||'.'
                else '' end
        || ' Si ya estás en ello dime "ya empecé '||r.titulo||'"; cuando la termines, "ya terminé '||r.titulo||'".';
    else
      v_txt := 'Sigo pendiente de «'||r.titulo||'» — ¿pudiste avanzar? Si ya estás en ello dime "ya empecé '
        || r.titulo||'"; si no vas a llegar, dime "pospón '||r.titulo||'" o cuéntale a tu líder.';
    end if;
    v_key := 'mkt_start_dia:'||r.pid||':'||r.dia||':'||r.intento;
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), v_key)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- D) ASIGNADAS FUERA DE HORARIO — se entregan al abrir su jornada
  for r in
    select x.id, x.payload->>'text' as texto, p.telegram_chat_id as chat
    from proactive_reminders x
    join profiles p on p.id = x.asesor_id
    where x.tipo = 'mkt_assign' and x.status = 'pending'
      and x.scheduled_at <= now()
      and fn_mkt_in_window(p.id, now())
  loop
    update proactive_reminders set status='sent', sent_at=now() where id = r.id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, r.texto, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  -- E) BUEN DÍA — una sola vez, en los primeros 90 min de SU jornada, y solo a
  --    quien REALMENTE tiene trabajo de marketing hoy. Así ningún admin de
  --    ventas recibe nada (regla de oro: marketing ≠ ventas).
  for r in
    select p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           p.organization_id as org,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from profiles p
    join organizations o on o.id = p.organization_id
    where coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and coalesce(p.active, true)
      and fn_mkt_in_window(p.id, now())
      and (now() at time zone coalesce(p.work_tz, p.timezone, 'America/Cancun'))::time
          <= coalesce(p.work_start,'10:00'::time) + interval '90 minutes'
      and exists (select 1 from mkt_tasks t
                  where t.assignee_id = p.id and t.deleted_at is null and t.estado <> 'hecha'
                    and t.due_at is not null
                    and (t.due_at at time zone coalesce(p.work_tz,p.timezone,'America/Cancun'))::date
                        <= (now() at time zone coalesce(p.work_tz,p.timezone,'America/Cancun'))::date)
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_buenos_dias:'||p.id||':'
                            || to_char(now() at time zone coalesce(p.work_tz,p.timezone,'America/Cancun'),'YYYYMMDD'))
  loop
    select count(*) filter (where (t.due_at at time zone r.ptz)::date = (now() at time zone r.ptz)::date),
           count(*) filter (where (t.due_at at time zone r.ptz)::date <  (now() at time zone r.ptz)::date),
           string_agg('• '||t.titulo
             || case when (t.due_at at time zone r.ptz)::date = (now() at time zone r.ptz)::date
                     then ' · '||to_char(t.due_at at time zone r.ptz,'HH24:MI')
                     else ' · venció el '||to_char(t.due_at at time zone r.ptz,'DD Mon') end,
             E'\n' order by t.due_at)
      into v_hoy, v_venc, v_lista
    from mkt_tasks t
    where t.assignee_id = r.pid and t.deleted_at is null and t.estado <> 'hecha'
      and t.due_at is not null
      and (t.due_at at time zone r.ptz)::date <= (now() at time zone r.ptz)::date;

    if coalesce(v_hoy,0) + coalesce(v_venc,0) = 0 then continue; end if;

    v_txt := fn_mkt_texto_buen_dia(r.pname, coalesce(v_hoy,0), coalesce(v_venc,0), v_lista);

    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.org, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'hoy', v_hoy, 'vencidas', v_venc),
              'mkt_buenos_dias:'||r.pid||':'||to_char(now() at time zone r.ptz,'YYYYMMDD'))
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'avisos', v_n);
end $function$;

comment on function public.fn_mkt_persecucion_tick() is
  'Único motor de avisos de tareas de marketing: al asignar, buen día al abrir la jornada, '
  '1 hora antes, 10 minutos antes y "¿ya pudiste comenzar?". Todo dentro de la jornada de '
  'cada persona y en su zona.';


-- ═══ 9 · EL ESCÁNER: SOLO VENCIDAS ═════════════════════════════════════════
-- Pierde el bloque «por vencer» de 3 horas (lo cubre la persecución) y se
-- queda con lo suyo: las vencidas agrupadas y el resumen al líder.
create or replace function public.fn_mkt_scan_vencimientos()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; v_id uuid; v_txt text; v_n int := 0;
begin
  ------------------------------------------------------- A) VENCIDAS (agrupado)
  for r in
    select p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           t.organization_id as org,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz,
           count(*)::int as n,
           (array_agg(t.titulo  order by t.due_at))[1] as t1,
           (array_agg(t.due_at  order by t.due_at))[1] as d1,
           (array_agg(t.titulo  order by t.due_at))[2] as t2,
           (array_agg(t.due_at  order by t.due_at))[2] as d2
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active, true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at < now() and t.due_at > now() - interval '14 days'
      and fn_mkt_in_window(p.id, now())
      and not exists (
        select 1 from proactive_reminders x
        where x.dedupe_key = 'mkt_overdue_dia:'||p.id||':'
              || to_char(now() at time zone coalesce(p.work_tz, p.timezone, 'America/Cancun'),'YYYYMMDD'))
    group by p.id, p.name, p.telegram_chat_id, t.organization_id,
             coalesce(p.work_tz, p.timezone, 'America/Cancun')
  loop
    if r.n = 1 then
      v_txt := 'Atención: «'||r.t1||'» venció el '
        || to_char(r.d1 at time zone r.ptz,'DD Mon HH24:MI')
        || ' y sigue pendiente. Si ya la hiciste, dime "ya terminé '||r.t1||'" para cerrarla; si algo te bloquea, avísale a tu líder.';
    elsif r.n = 2 then
      v_txt := 'Tienes 2 tareas vencidas: «'||r.t1||'» ('||to_char(r.d1 at time zone r.ptz,'DD Mon')
        ||') y «'||r.t2||'» ('||to_char(r.d2 at time zone r.ptz,'DD Mon')
        ||'). Las ves en Mi Día. Si ya hiciste alguna, dime "ya terminé …" para cerrarla.';
    else
      v_txt := 'Tienes '||r.n||' tareas vencidas: «'||r.t1||'» ('||to_char(r.d1 at time zone r.ptz,'DD Mon')
        ||'), «'||r.t2||'» ('||to_char(r.d2 at time zone r.ptz,'DD Mon')||') y '||(r.n-2)
        ||' más. Las ves en Mi Día. Si ya hiciste alguna, dime "ya terminé …" para cerrarla.';
    end if;

    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.org, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'vencidas', r.n),
              'mkt_overdue_dia:'||r.pid||':'||to_char(now() at time zone r.ptz,'YYYYMMDD'))
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  ---------------------------------------------- B) ESCALADO AL LÍDER (agrupado)
  for r in
    with vencidas as (
      select t.organization_id as org,
             coalesce(p.name,'(sin responsable)') as pname,
             count(*)::int as n
      from mkt_tasks t
      left join profiles p on p.id = t.assignee_id
      join organizations o on o.id = t.organization_id
      where t.deleted_at is null and t.estado <> 'hecha'
        and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
        and t.due_at < now() - interval '24 hours'
        and t.due_at > now() - interval '14 days'
      group by 1, 2
    )
    select a.id as admin_id, a.name as admin_name, a.telegram_chat_id as admin_chat,
           v.org, sum(v.n)::int as total,
           string_agg(v.pname||' ('||v.n||')', ', ' order by v.n desc, v.pname) as detalle,
           coalesce(a.work_tz, a.timezone, 'America/Cancun') as atz
    from vencidas v
    join profiles a on a.organization_id = v.org
                   and a.is_marketing_admin = true
                   and coalesce(a.active, true)
    where fn_mkt_in_window(a.id, now())
      and not exists (
        select 1 from proactive_reminders x
        where x.dedupe_key = 'mkt_overdue_lider_dia:'||a.id||':'
              || to_char(now() at time zone coalesce(a.work_tz, a.timezone, 'America/Cancun'),'YYYYMMDD'))
    group by a.id, a.name, a.telegram_chat_id, v.org, coalesce(a.work_tz, a.timezone, 'America/Cancun')
  loop
    v_txt := 'Para tu radar: hay '||r.total||' tarea'||case when r.total = 1 then '' else 's' end
      ||' vencida'||case when r.total = 1 then '' else 's' end||' hace más de un día — '
      ||r.detalle||'. Las ves en la pestaña Equipo.';

    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.org, r.admin_id, r.admin_name, 'admin_overdue', now(), 'pending',
              jsonb_build_object('text', v_txt, 'vencidas', r.total),
              'mkt_overdue_lider_dia:'||r.admin_id||':'||to_char(now() at time zone r.atz,'YYYYMMDD'))
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.admin_chat is not null then perform fn_log_proactive_copilot(r.admin_chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'avisos', v_n);
end $function$;

comment on function public.fn_mkt_scan_vencimientos() is
  'Solo VENCIDAS: un aviso agrupado por persona por día y un resumen por líder por día. '
  'El "por vencer" lo maneja fn_mkt_persecucion_tick (1 hora y 10 minutos).';


-- ═══ 10 · EL LABORATORIO NO LE ESCRIBE A UNA PERSONA REAL ══════════════════
-- En el chat REAL de Alex, a la 01:30 a.m. del 28-jul, quedó
--   «No conozco esa accion: __probe_inexistente__»
-- Un mensaje de PRUEBA. Llegó ahí porque el runner de QA aceptaba cualquier
-- chat_id. La seguridad son LLAVES, no advertencias: ahora NO PUEDE correr
-- contra un chat que no sea del laboratorio, ni queriendo.
create table if not exists public.tg_bot_activity_respaldo_20260729
  (like public.tg_bot_activity including all);

comment on table public.tg_bot_activity_respaldo_20260729 is
  'Respaldo de los mensajes de prueba del QA que quedaron en chats reales, borrados el '
  '29-jul-2026. Se puede reinsertar tal cual si hiciera falta.';

create or replace function public.fn_qa_run_golden_mkt(p_chat bigint DEFAULT '-990011'::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record; v_reply text; v_all text; v_pass boolean; v_err text; v_chat bigint;
  v_out jsonb := '[]'::jsonb; v_ok int:=0; v_tot int:=0;
  v_qa_org uuid := 'ffffffff-0000-4000-a000-000000000001';
begin
  -- ⛔ El laboratorio solo puede escribirle al laboratorio.
  if not exists (select 1 from profiles
                 where telegram_chat_id = p_chat and organization_id = v_qa_org) then
    return jsonb_build_object('ok', false,
      'error', 'Ese chat no es del laboratorio de QA. Correr las pruebas contra un chat real '
            || 'le deja mensajes de prueba a una persona de verdad — le pasó a Alex el 28-jul. '
            || 'Usá los chats de QA (Alex QA -990013, Yazz QA -990011, Luis QA -990012).');
  end if;

  perform public.fn_qa_reset_mkt();
  for r in select * from qa_golden_cases where superficie='marketing' and activo order by id loop
    v_tot := v_tot+1; v_err:=null; v_reply:=null;
    v_chat := coalesce(r.chat_override, p_chat);
    -- Un caso con chat_override fuera del laboratorio se SALTA, no se ejecuta.
    if not exists (select 1 from profiles where telegram_chat_id = v_chat and organization_id = v_qa_org) then
      v_out := v_out || jsonb_build_object('id', r.id, 'cat', r.categoria, 'pass', null,
                        'error', 'saltado: chat_override fuera del laboratorio');
      continue;
    end if;
    begin
      v_reply := public.mkt_nlu_dispatch(v_chat, nullif(r.tool_name,''), coalesce(r.args,'{}'::jsonb)) ->> 'reply';
    exception when others then v_err := SQLERRM; end;
    v_all := coalesce(v_reply,'');
    v_pass := v_err is null and length(btrim(v_all))>0
      and (r.esperado_ilike is null or v_all ilike '%'||r.esperado_ilike||'%')
      and (r.prohibido_ilike is null or v_all not ilike '%'||r.prohibido_ilike||'%');
    if v_pass then v_ok:=v_ok+1; end if;
    v_out := v_out || jsonb_build_object('id',r.id,'cat',r.categoria,'pass',v_pass,'error',v_err,'reply',left(v_all,150));
  end loop;
  return jsonb_build_object('total',v_tot,'ok',v_ok,'score',v_ok||'/'||v_tot,'casos',v_out);
end $function$;
