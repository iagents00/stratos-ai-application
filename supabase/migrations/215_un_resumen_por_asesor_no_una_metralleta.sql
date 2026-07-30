-- Ángel, 30-jul, probando el guion: el Copilot de Asesor Prueba recibía
-- «Recordatorio proactivo (inactividad).» CADA MINUTO. «Le está mandando spam,
-- ten cuidado con eso.»
--
-- LO QUE PASABA (medido, no teoría):
--   · El escáner de inactividad (05:00) encolaba UNA fila POR CADA cliente sin
--     movimiento, con payload VACÍO. Hoy: 888 filas — Gael 499, Carlos 207,
--     Cecilia 80, Asesor Prueba 44…
--   · El consumidor entrega 1 por asesor por tick (cada minuto) → goteo infinito.
--   · Los asesores REALES tienen una compuerta (proactive_pending_reports: un
--     reporte abierto bloquea el siguiente por 12h) — pero esa compuerta SOLO se
--     crea para chats reales (advisor_tg > 0). Los chats sintéticos (el Copilot
--     del CRM) no tienen compuerta → metralleta.
--   · Y con payload sin texto, el log al Copilot caía en el genérico
--     «Recordatorio proactivo (inactividad).» — spam Y encima mudo.
--
-- EL ARREGLO, EN EL ORIGEN:
--
-- 1. EL ESCÁNER ENCOLA UN RESUMEN POR ASESOR POR DÍA, no una fila por cliente.
--    «Tienes 44 clientes sin movimiento: A, B, C, D, E y 39 más. Revísalos en
--    tu CRM y retoma contacto.» Con dedupe por asesor+día. Probado en seco con
--    los datos reales de Duke: 9 mensajes en vez de 888.
--
-- 2. EL AVISO DE TAREA ASIGNADA (Copilot) DICE ALGO ÚTIL: «Nueva actividad
--    asignada: “X” — te la asignó Y. La ves en Mi Espacio → Agenda.»
--
-- 3. SE PRENDE team_notify_on_assign EN DUKE (lo que Ángel señaló: el asesor no
--    se enteraba de la tarea nueva). Con el spam arreglado ya es seguro.
--
-- Nota: los ~790 pendientes de hoy ya se marcaron 'cancelled' a mano ANTES de
-- esta mig (frenar el sangrado). Las filas viven, nada se borró.
-- Nota 2: el primer intento de esta mig falló por un paréntesis sin cerrar en
-- el parche de get_pending — la transacción se revirtió entera y esta versión
-- cierra el paréntesis en la cola del COALESCE.
--
-- REVERTIR: CREATE OR REPLACE de las 2 funciones con el cuerpo anterior +
-- team_notify_on_assign=false. Sin DDL, sin borrar datos.

-- ── 1. Escáner → digest por asesor ──────────────────────────────────────────
create or replace function public.fn_proactive_scan_inactive(payload jsonb DEFAULT '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_enqueued int := 0; v_daystamp text; v_cutoff timestamptz;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled'); END IF;
  v_daystamp := to_char((now() AT TIME ZONE v_cfg.timezone)::date, 'YYYYMMDD');
  v_cutoff := CASE WHEN v_cfg.inactivity_hours IS NOT NULL THEN now() - (v_cfg.inactivity_hours * interval '1 hour')
                   ELSE now() - (v_cfg.inactivity_days * interval '1 day') END;
  WITH candidates AS (
    SELECT l.id, l.name, l.updated_at, l.asesor_id, l.asesor_name
    FROM public.leads l
    WHERE l.organization_id = v_org_id AND l.deleted_at IS NULL
      AND coalesce(trim(l.asesor_name),'') <> '' AND NOT coalesce(l.do_not_contact, false)
      AND NOT EXISTS (SELECT 1 FROM unnest(v_cfg.terminal_stages) t WHERE lower(t) = lower(l.stage))
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(v_cfg.inactivity_exclude_stages, ARRAY[]::text[])) s WHERE lower(s) = lower(l.stage))
      AND (v_cfg.inactivity_include_stages IS NULL OR cardinality(v_cfg.inactivity_include_stages) = 0
           OR EXISTS (SELECT 1 FROM unnest(v_cfg.inactivity_include_stages) i WHERE lower(i) = lower(l.stage)))
      AND (CASE WHEN v_cfg.inactivity_hours IS NOT NULL THEN l.updated_at < v_cutoff
                WHEN v_cfg.inactivity_signal = 'days_inactive' THEN COALESCE(l.days_inactive, 0) >= v_cfg.inactivity_days
                ELSE l.updated_at < v_cutoff END)
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  agg AS (
    -- mig 215: UN resumen por asesor por día, no una fila por cliente.
    SELECT c.asesor_id, c.asesor_name, count(*) AS n,
           (array_agg(coalesce(nullif(trim(c.name),''),'Sin nombre') ORDER BY c.updated_at))[1:5] AS top5,
           array_agg(c.id) AS lead_ids
    FROM candidates c
    GROUP BY c.asesor_id, c.asesor_name
  ),
  ins AS (
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    SELECT v_org_id, NULL, a.asesor_id, a.asesor_name, 'inactividad', now(),
           'inactividad:asesor:' || coalesce(a.asesor_id::text, lower(a.asesor_name)) || ':' || v_daystamp,
           jsonb_build_object(
             'text', 'Tienes ' || a.n || ' cliente' || CASE WHEN a.n = 1 THEN '' ELSE 's' END ||
                     ' sin movimiento: ' || array_to_string(a.top5, ', ') ||
                     CASE WHEN a.n > 5 THEN ' y ' || (a.n - 5) || ' más' ELSE '' END ||
                     '. Revísalos en tu CRM y retoma contacto.',
             'count', a.n, 'clientes', to_jsonb(a.top5), 'lead_ids', to_jsonb(a.lead_ids), 'digest', true)
    FROM agg a ON CONFLICT (dedupe_key) DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM ins;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id, 'digest', true);
END;
$fn$;

-- ── 2. El aviso de tarea asignada dice algo útil en el Copilot ──────────────
do $do$
declare v_def text; v_a text; v_tail text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='fn_proactive_get_pending';

  if position('Nueva actividad asignada' in v_def) > 0 then
    return; -- ya aplicado
  end if;

  v_a := 'COALESCE(NULLIF(c.payload->>''text'',''''), NULLIF(c.payload->>''message'','''')';
  v_tail := 'ELSE ''Recordatorio proactivo ('' || c.tipo || '').'' END)';
  if position(v_a in v_def) = 0 or position(v_tail in v_def) = 0 then
    raise exception 'No encontré las anclas del texto del log — no toco nada.';
  end if;

  v_def := replace(v_def, v_a,
    'COALESCE(CASE WHEN c.tipo=''team_action'' AND c.payload->>''fase''=''asignada'' AND NULLIF(c.payload->>''text'','''') IS NOT NULL'
    || ' THEN ''Nueva actividad asignada: “''||(c.payload->>''text'')||''”''||COALESCE('' — te la asignó ''||NULLIF(c.payload->>''quien_asigna'',''''),'''')||''. La ves en Mi Espacio → Agenda.'' END, '
    || v_a);
  -- cerrar el paréntesis del COALESCE externo (la causa del primer intento fallido)
  v_def := replace(v_def, v_tail, v_tail || ')');

  execute v_def;
end
$do$;

-- ── 3. El aviso al asignar, PRENDIDO en Duke ────────────────────────────────
update public.proactive_config
   set team_notify_on_assign = true
 where organization_id = '00000000-0000-0000-0000-000000000001';
