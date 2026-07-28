-- 176 · Los avisos de marketing respetan la jornada y dejan de repetirse
--
-- QUÉ PASABA (medido, no supuesto):
--   De los últimos 150 avisos de marketing, 81 (el 54%) salieron entre las 00:00
--   y la 01:00 de Cancún. La jornada de Duke es 10:00-22:00.
--
-- POR QUÉ:
--   fn_mkt_scan_vencimientos() corre por cron cada 30 minutos LAS 24 HORAS y no
--   miraba work_start/work_end en ningún lado. Encima los bloques de "vencida" y
--   "escalado al líder" deduplican con una clave que incluye el día
--   (mkt_overdue:<tarea>:<YYYYMMDD>): al cambiar el día a medianoche la clave
--   cambia para TODAS las vencidas a la vez, así que el primer tick después de
--   las 00:00 disparaba la tanda entera. No era azar: era el diseño.
--
--   El fix de jornada del 24-jul (migración 126) cubrió ventas y
--   fn_mkt_persecucion_tick — que SÍ respeta la jornada — pero el escáner quedó
--   afuera. Esta migración le aplica el MISMO patrón, no uno nuevo.
--
-- Y ADEMÁS el spam: el dedup "una vez al día por tarea" está bien pensado, pero
--   nadie ponía un techo. El líder recibía UNA LÍNEA POR CADA TAREA VENCIDA DE
--   CADA PERSONA TODOS LOS DÍAS (26 acumuladas en el chat de Alex). Ahora es
--   UN mensaje por persona por día, agrupado. Un chat que hay que scrollear para
--   encontrar tu propia conversación no es un asistente, es ruido.
--
-- QUÉ CAMBIA, en concreto:
--   1. fn_mkt_in_window(persona, now())  → nada fuera de su horario laboral
--   2. gate por organización (meta_config->>'mkt_persecucion'='on') → hoy solo
--      Duke y NSG; el QA Lab queda excluido SOLO, sin hardcodear su UUID
--   3. la hora se muestra en la zona de CADA PERSONA, no en 'America/Cancun' fijo
--      (para que NSG/Bogotá y los white-labels no vean la hora de Cancún)
--   4. solo gente activa
--   5. vencidas y escalado: UN aviso por persona/líder por día, agrupado
--
-- REVERTIR: correr el bloque comentado del final (restaura la versión previa).

create or replace function public.fn_mkt_scan_vencimientos()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; v_id uuid; v_txt text; v_n int := 0;
begin
  ---------------------------------------------------------------- A) POR VENCER
  -- Un aviso por tarea (dedup sin fecha → una sola vez en su vida).
  for r in
    select t.id, t.titulo, t.due_at, t.organization_id,
           p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz
    from mkt_tasks t
    join profiles p on p.id = t.assignee_id and coalesce(p.active, true)
    join organizations o on o.id = t.organization_id
    where t.deleted_at is null and t.estado <> 'hecha'
      and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
      and t.due_at between now() and now() + interval '3 hours'
      and fn_mkt_in_window(p.id, now())
      and not exists (select 1 from proactive_reminders x
                      where x.dedupe_key = 'mkt_due_soon:'||t.id)
  loop
    v_txt := 'Se acerca tu entrega: «'||r.titulo||'» vence hoy a las '
      || to_char(r.due_at at time zone r.ptz,'HH24:MI')
      || '. Cuando la termines dime "ya terminé '||r.titulo||'" y, si quieres, adjunta la evidencia con el botón de cámara.';
    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.organization_id, r.pid, r.pname, 'personal', now(), 'pending',
              jsonb_build_object('text', v_txt, 'mkt_task_id', r.id), 'mkt_due_soon:'||r.id)
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.chat is not null then perform fn_log_proactive_copilot(r.chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  ------------------------------------------------------- B) VENCIDAS (agrupado)
  -- UN mensaje por persona por día. Si tiene una sola, se nombra; si tiene
  -- varias, se nombran las dos primeras y se dice cuántas faltan.
  for r in
    select p.id as pid, p.name as pname, p.telegram_chat_id as chat,
           t.organization_id as org,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as ptz,
           count(*)::int as n,
           (array_agg(t.titulo  order by t.due_at))[1] as t1,
           (array_agg(t.due_at  order by t.due_at))[1] as d1,
           (array_agg(t.titulo  order by t.due_at))[2] as t2
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
      v_txt := 'Tienes 2 tareas vencidas: «'||r.t1||'» y «'||r.t2
        ||'». Las ves en Mi Día. Si ya hiciste alguna, dime "ya terminé …" para cerrarla.';
    else
      v_txt := 'Tienes '||r.n||' tareas vencidas: «'||r.t1||'», «'||r.t2||'» y '||(r.n-2)
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

  --------------------------------------------- C) ESCALADO AL LÍDER (agrupado)
  -- UN resumen por líder por día, con el total y el desglose por persona —
  -- en vez de una línea por cada tarea de cada persona todos los días.
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
           string_agg(v.pname||' ('||v.n||')', ', ' order by v.n desc, v.pname) as detalle
    from vencidas v
    join profiles a on a.organization_id = v.org
                   and a.is_marketing_admin = true
                   and coalesce(a.active, true)
    where fn_mkt_in_window(a.id, now())
      and not exists (
        select 1 from proactive_reminders x
        where x.dedupe_key = 'mkt_overdue_lider_dia:'||a.id||':'
              || to_char(now() at time zone coalesce(a.work_tz, a.timezone, 'America/Cancun'),'YYYYMMDD'))
    group by a.id, a.name, a.telegram_chat_id, v.org
  loop
    v_txt := 'Para tu radar: hay '||r.total||' tarea'||case when r.total = 1 then '' else 's' end
      ||' vencida'||case when r.total = 1 then '' else 's' end||' hace más de un día — '
      ||r.detalle||'. Las ves en la pestaña Equipo.';

    insert into proactive_reminders (organization_id, asesor_id, asesor_name, tipo, scheduled_at, status, payload, dedupe_key)
      values (r.org, r.admin_id, r.admin_name, 'admin_overdue', now(), 'pending',
              jsonb_build_object('text', v_txt, 'vencidas', r.total),
              'mkt_overdue_lider_dia:'||r.admin_id||':'
              || to_char(now() at time zone 'America/Cancun','YYYYMMDD'))
      returning id into v_id;
    update proactive_reminders set status='sent', sent_at=now() where id = v_id;
    if r.admin_chat is not null then perform fn_log_proactive_copilot(r.admin_chat, v_txt, 'ai'); end if;
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'avisos', v_n);
end
$function$;

comment on function public.fn_mkt_scan_vencimientos() is
  'Avisos de vencimientos de marketing. Respeta la jornada de cada persona (fn_mkt_in_window), '
  'solo corre en orgs con meta_config.mkt_persecucion=on, usa la zona horaria de cada quien y '
  'agrupa: UN aviso por persona por día. Migración 176 (29-jul-2026).';

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERTIR: la versión previa está en el repo del AIOS,
-- context/copilot-auditoria-avisos-28jul.md, y en el historial de esta función.
-- El rollback rápido es quitar de los tres bloques las tres líneas nuevas:
--   and coalesce(o.meta_config->>'mkt_persecucion','off') = 'on'
--   and fn_mkt_in_window(p.id, now())
--   and coalesce(p.active, true)
-- y volver al dedup por tarea. Pero eso reactiva el spam de madrugada.
-- ─────────────────────────────────────────────────────────────────────────────
