-- 182 · La bitácora no se traga tareas, y los avisos se pueden leer
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Estado final de las migraciones 188-192 aplicadas el 29-jul-2026, después de
-- que Ángel probara con el guion de pruebas y encontrara dos fallos.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── FALLO 1: una tarea delegada terminó como texto en un diario ─────────────
--   Alex dictó: «registrale que Jazz me tiene que entregar un reporte semanal
--   mañana a las doce» → el Copilot respondió «Anotado en tu bitácora del
--   28/07». La tarea de Yazmin NUNCA EXISTIÓ. Alex creyó que delegó algo y no
--   delegó nada; nadie le avisó a Yazmin, nadie la persiguió.
--
--   Se escribió una regla explícita en el prompt del agente (#0.7) con este
--   mismo ejemplo textual, se publicó, y SE VOLVIÓ A PROBAR ejecutando el
--   flujo: gpt-4o-mini siguió mandándolo a la bitácora. El modelo asocia
--   «registrale» con «anotar» y esa asociación le gana a la regla escrita.
--
--   → Es la regla del CLAUDE.md aplicada al ruteo: un prompt NO es una capa de
--     seguridad. La validación baja a la base.
--
--   PRIMER INTENTO (mig 189) TAMPOCO FRENÓ EL CASO REAL: exigía verbo de
--   obligación Y reconocer a la persona. Alex escribió «Jazz» y la persona es
--   «Yazz» — até la protección a que el usuario escribiera bien un nombre
--   propio. Eso no es una protección, es una esperanza.
--
--   LA MEDICIÓN QUE DECIDIÓ (mig 191): de las 13 bitácoras que existen en toda
--   la base, 3 tienen verbo de obligación — y las TRES son esta misma frase mal
--   ruteada. Ninguna bitácora real usa «tiene que» / «hay que» / «necesito
--   que»: una bitácora cuenta lo que YA hiciste, una obligación mira al futuro.
--   Son tiempos verbales distintos. → El verbo alcanza como señal, sin depender
--   del nombre.
--
--   Y se capturó cómo habla la gente: «jazz» entra como apodo de Yazmin. No se
--   corrige al usuario, se aprende de él.
--
-- ── FALLO 2: los avisos eran un muro de texto ──────────────────────────────
--   Así le llegaba a Yazmin:
--     «Falta 1 hora: «Actividad programada para hoy» vence a las 14:35. ¿Cómo
--      vas? Cuando la termines dime "ya terminé Actividad programada para hoy";
--      si necesitas más tiempo dime "pospón Actividad programada para hoy para
--      más tarde".»
--   El título aparece TRES veces en una frase. Para leerlo hay que trabajar.
--
--   Iván pasó como referencia la pantalla de Codex/ChatGPT: «es agradable
--   trabajar y leer». Lo que la hace agradable no es la fuente — es que cada
--   cosa está en su renglón. Eso no se arregla en el front: se arregla acá.
--
--   REGLA QUE QUEDA: un aviso tiene TRES partes, cada una en su línea —
--     1. QUÉ pasó   2. EL DATO (tarea y hora)   3. QUÉ PUEDE HACER (viñetas)
--   y el título se nombra UNA sola vez.
--
--   Los textos viven en funciones propias (fn_mkt_texto_*) para poder LEERLOS
--   con una consulta, sin mandarle un mensaje a nadie. Un texto que solo se ve
--   provocando un aviso real es un texto que nadie corrige.
--
-- REVERTIR: migración 181 (repo) restaura los textos y la bitácora previos.
--   Los respaldos de lo borrado quedan en mkt_daily_reports_respaldo_20260729.


-- ═══ 1 · APODOS COMO SUENAN ════════════════════════════════════════════════
update public.profiles
   set alias = array['yazz','jazz','yaz','jaz','yazmin','jazmin','ledesma']
 where id='90442ec3-e2dc-42bf-bb2b-4d4cba2ec872';


-- ═══ 2 · EL GUARDIA DE LA BITÁCORA ═════════════════════════════════════════
create or replace function public.fn_mkt_daily_report(
  p_profile_id uuid, p_texto text, p_fecha date DEFAULT NULL::date,
  p_evidencia_url text DEFAULT NULL::text, p_forzar boolean DEFAULT false)
 returns text
 language plpgsql
as $function$
declare
  v_org uuid; v_fecha date; v_texto text; v_evi text; v_n int; v_last uuid;
  v_tz text; v_otro text; v_plano text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  v_texto := nullif(btrim(coalesce(p_texto, '')), '');
  v_evi   := nullif(btrim(coalesce(p_evidencia_url, '')), '');
  v_tz    := fn_tz_de(p_profile_id);
  v_fecha := coalesce(p_fecha, (now() at time zone v_tz)::date);

  if v_texto is null and v_evi is not null then
    select id into v_last
    from mkt_daily_reports
    where organization_id = v_org and profile_id = p_profile_id and fecha = v_fecha
    order by created_at desc limit 1;
    if v_last is null then
      return 'Todavía no tienes bitácora del '||to_char(v_fecha,'DD/MM')||
             '. Cuéntame primero qué hiciste y le agrego el enlace.';
    end if;
    update mkt_daily_reports set evidencia_url = v_evi where id = v_last;
    return 'Listo, le agregué la evidencia a tu bitácora del '||to_char(v_fecha,'DD/MM')||'.';
  end if;

  if v_texto is null then
    return 'Cuéntame qué hiciste y lo anoto en tu bitácora. Por ejemplo: '||
           '"hoy edité el video de Casa Lago y grabé en Brasa y Piedra".';
  end if;

  -- Una bitácora cuenta lo que YA hiciste. Un verbo de obligación mira al
  -- futuro — eso es una tarea, y guardada acá no le llega a nadie.
  if not coalesce(p_forzar, false) then
    v_plano := lower(unaccent(v_texto));

    if v_plano ~ '\m(tiene|tienen|tengo|hay)\s+que\M'
       or v_plano ~ '\m(debe|deben|debera|deberia)\M'
       or v_plano ~ '\mnecesito\s+que\M'
       or v_plano ~ '\mque\s+(me\s+)?entregue\M'
       or v_plano ~ '\mpendiente\s+de\s+que\M'
    then
      -- Si además reconocemos a alguien lo nombramos; si no, se pregunta igual.
      -- El guardia NO depende de acertar el nombre: por eso falló el 1er intento.
      select p.name into v_otro
      from profiles p
      where p.organization_id = v_org
        and p.id <> p_profile_id
        and coalesce(p.active, true)
        and ( v_plano ~ ('\m'||lower(unaccent(split_part(p.name,' ',1)))||'\M')
           or exists (select 1 from unnest(coalesce(p.alias,'{}'::text[])) a
                      where v_plano ~ ('\m'||lower(unaccent(a))||'\M')) )
      order by length(p.name) desc
      limit 1;

      if v_otro is not null then
        return 'Ojo, eso suena a una tarea para '||v_otro||', no a tu bitácora. '
          || 'Si lo anoto acá, a '||split_part(v_otro,' ',1)||' no le llega nada y nadie la persigue.'
          || E'\n\n· Si es una tarea, dime: créale una tarea a '||split_part(v_otro,' ',1)||': <qué> <cuándo>'
          || E'\n· Si de verdad quieres anotarlo en tu bitácora, dime: anótalo igual';
      else
        return 'Ojo, eso suena a algo pendiente, no a algo que ya hiciste. '
          || 'La bitácora no le avisa a nadie ni persigue nada — si es una tarea, se pierde acá dentro.'
          || E'\n\n· Si es una tarea, dime: créale una tarea a <quién>: <qué> <cuándo>'
          || E'\n· Si de verdad quieres anotarlo en tu bitácora, dime: anótalo igual';
      end if;
    end if;
  end if;

  insert into mkt_daily_reports (organization_id, profile_id, fecha, texto, evidencia_url, origen)
  values (v_org, p_profile_id, v_fecha, v_texto, v_evi, 'copilot');

  select count(*) into v_n
  from mkt_daily_reports
  where organization_id = v_org and profile_id = p_profile_id and fecha = v_fecha;

  return 'Anotado en tu bitácora del '||to_char(v_fecha,'DD/MM')||
         case when v_n > 1 then ' (van '||v_n||' reportes ese día)' else '' end||'.'||
         E'\n\nTu líder ya lo ve en Equipo.'||
         case when v_evi is null
              then ' Si tienes evidencia, mándame el enlace y lo agrego.'
              else '' end;
end $function$;

-- La firma vieja de 4 argumentos NO se borra (regla: crear sí, borrar no):
-- delega en la de 5 para que TODO camino pase por el guardia. Sin esto,
-- Postgres elegiría la de 4 exactos y el guardia quedaría escrito y muerto.
create or replace function public.fn_mkt_daily_report(
  p_profile_id uuid, p_texto text, p_fecha date DEFAULT NULL::date,
  p_evidencia_url text DEFAULT NULL::text)
 returns text
 language sql
as $function$
  select public.fn_mkt_daily_report(p_profile_id, p_texto, p_fecha, p_evidencia_url, false);
$function$;

create table if not exists public.mkt_daily_reports_respaldo_20260729
  (like public.mkt_daily_reports including all);

comment on table public.mkt_daily_reports_respaldo_20260729 is
  'Respaldo de las bitácoras que el ruteo mal dirigido escribió (eran tareas, no bitácoras) '
  'y de las pruebas del laboratorio. Borradas el 29-jul-2026. Reinsertables tal cual.';


-- ═══ 3 · LOS TEXTOS DE LOS AVISOS, LEGIBLES Y PROBABLES ════════════════════
create or replace function public.fn_mkt_texto_falta_1h(p_titulo text, p_hora text)
 returns text language sql immutable as $function$
  select 'Falta 1 hora para «'||p_titulo||'» — vence a las '||p_hora||'.'
    || E'\n\n¿Cómo vas?'
    || E'\n· Si ya la terminaste: ya terminé '||p_titulo
    || E'\n· Si necesitas más tiempo: pospón '||p_titulo;
$function$;

create or replace function public.fn_mkt_texto_ultimos_10(p_titulo text, p_hora text)
 returns text language sql immutable as $function$
  select 'Últimos 10 minutos de «'||p_titulo||'» — vence a las '||p_hora||'.'
    || E'\n\n· Si ya está: ya terminé '||p_titulo
    || E'\n· Si no llegas: pospón '||p_titulo||' (o avísale a tu líder)';
$function$;

create or replace function public.fn_mkt_texto_arrancaste(p_titulo text, p_cuando text, p_intento int)
 returns text language sql immutable as $function$
  select case when p_intento = 1
      then '¿Ya pudiste comenzar «'||p_titulo||'»?'
           || coalesce(E'\nVa para el '||p_cuando||'.', '')
      else 'Sigo pendiente de «'||p_titulo||'» — ¿pudiste avanzar?' end
    || E'\n\n· Si ya estás en ello: ya empecé '||p_titulo
    || E'\n· Si ya la terminaste: ya terminé '||p_titulo
    || case when p_intento = 2 then E'\n· Si no vas a llegar: pospón '||p_titulo else '' end;
$function$;

create or replace function public.fn_mkt_texto_vencidas(p_n int, p_t1 text, p_d1 text, p_t2 text, p_d2 text)
 returns text language sql immutable as $function$
  select case
      when p_n = 1 then
        'Se te venció una tarea el '||p_d1||' y sigue pendiente.'
        || E'\n\n«'||p_t1||'»'
        || E'\n\n· Si ya la hiciste: ya terminé '||p_t1
        || E'\n· Si algo te bloquea, avísale a tu líder'
      when p_n = 2 then
        'Tienes 2 tareas vencidas.'
        || E'\n\n· «'||p_t1||'» — '||p_d1
        || E'\n· «'||p_t2||'» — '||p_d2
        || E'\n\nLas ves en Mi Día. Si ya hiciste alguna, dime «ya terminé …» para cerrarla.'
      else
        'Tienes '||p_n||' tareas vencidas.'
        || E'\n\n· «'||p_t1||'» — '||p_d1
        || E'\n· «'||p_t2||'» — '||p_d2
        || E'\n· y '||(p_n-2)||' más'
        || E'\n\nLas ves en Mi Día. Si ya hiciste alguna, dime «ya terminé …» para cerrarla.'
    end;
$function$;

create or replace function public.fn_mkt_texto_buen_dia(p_nombre text, p_hoy int, p_venc int, p_lista text)
 returns text language sql immutable as $function$
  select 'Buen día, ' || split_part(p_nombre,' ',1) || '.'
    || E'\n\n'
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
    || E'\n\n' || p_lista
    || E'\n\nCuando empieces alguna dime «ya empecé …», y cuando la cierres, «ya terminé …».';
$function$;

comment on function public.fn_mkt_texto_falta_1h(text,text) is
  'Los textos de los avisos viven en funciones propias para poder LEERLOS con una consulta, sin '
  'mandarle un mensaje a nadie. Un texto que solo se ve provocando un aviso real nadie lo corrige.';


-- ═══ 4 · EL AVISO AL ASIGNAR, CON FORMATO ══════════════════════════════════
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

  v_txt := coalesce(v_creador,'Tu líder')||' te asignó una tarea.'
    || E'\n\n«'||new.titulo||'»'
    || coalesce(E'\n'||to_char(new.due_at at time zone v_tz,'DD Mon')
                ||' a las '||to_char(new.due_at at time zone v_tz,'HH24:MI'), '')
    || E'\n\nYa está en tu Mi Día. Cuando la empieces, dime:'
    || E'\n· ya empecé '||new.titulo;

  if fn_mkt_in_window(v_pid, now()) then
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo,
                                     scheduled_at, status, payload, dedupe_key)
      values (new.organization_id, v_pid, v_pname, 'mkt_assign', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', new.id), 'mkt_assign:'||new.id)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if v_chat is not null then perform fn_log_proactive_copilot(v_chat, v_txt, 'ai'); end if;
  else
    v_when := fn_mkt_next_window_start(v_pid, now());
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo,
                                     scheduled_at, status, payload, dedupe_key)
      values (new.organization_id, v_pid, v_pname, 'mkt_assign', v_when, 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', new.id), 'mkt_assign:'||new.id);
  end if;

  return new;
exception when others then
  raise warning 'trg_mkt_task_assigned_fn falló para la tarea % (%): %', new.id, new.titulo, sqlerrm;
  return new;
end $function$;

-- NOTA: fn_mkt_persecucion_tick y fn_mkt_scan_vencimientos quedan igual que en
-- la migración 181, solo que ahora arman su texto llamando a las funciones
-- fn_mkt_texto_* de arriba (y el dispatcher pasa `forzar` a la bitácora).
-- El cuerpo completo está aplicado en la base como migraciones 188 y 190.
