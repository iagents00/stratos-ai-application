-- ════════════════════════════════════════════════════════════════════════
-- 029 — Protocolo Post-Zoom (Duke del Caribe)
-- ────────────────────────────────────────────────────────────────────────
-- "Un cliente que ya pasó por Zoom trae el 70% del trabajo hecho; perderlo
--  por falta de seguimiento es el desperdicio más caro." — Ivan, 2026-08-01
--
-- Qué agrega (todo ADITIVO e idempotente):
--   1. leads.post_zoom / post_zoom_at — hecho persistido "este cliente ya
--      pasó por Zoom", con backfill desde etapa actual, action_history y
--      el panel Control de Zooms (zoom_agendados.estatus='Asistió').
--   2. Trigger en leads: al entrar a una etapa post-Zoom se marca solo.
--   3. Trigger REVERSO en zoom_agendados: cuando el director marca
--      'Asistió' en el panel → el lead avanza a 'Zoom Concretado' (solo si
--      estaba antes del Zoom), se marca post_zoom, se registra el Zoom en
--      el expediente (comunicaciones tipo 'zoom') y queda evento en
--      action_history con crédito al presentador. Completa el ciclo:
--      ya existía lead→panel (zoom_agendados_sync_from_lead); faltaba
--      panel→lead. Guard pg_trigger_depth() evita re-entradas.
--   4. CHECK de proactive_reminders.tipo ampliado con 'notas_post_zoom' y
--      'post_zoom_seguimiento' — desbloquea fn_proactive_scan_notas_post_zoom
--      (existía en prod pero su tipo no estaba permitido: por eso el coach
--      de n8n quedó inactivo) y habilita la escalera nueva.
--   5. fn_post_zoom_scan(): escalera de INSISTENCIA post-Zoom (service_role,
--      lo llama n8n). Nota faltante → pide la nota; sin seguimiento →
--      avisos día 1/2/3+ con tono de compañero. Respeta quiet hours vía
--      fn_proactive_get_pending, dedupe diario por lead, tope por asesor.
--   6. get_post_zoom_pendientes(): facade para el CRM (SECURITY INVOKER,
--      la RLS de leads decide qué ve cada quién) — alimenta el banner
--      "Post-Zoom pendientes" del frontend.
--
-- NO toca: fn_proactive_get_pending, zoom_agendados_sync_from_lead, ni
-- ningún workflow existente. La fn legacy fn_proactive_scan_notas_post_zoom
-- queda superseded por fn_post_zoom_scan (misma dedupe_key → no duplican).
--
-- Aplicada vía MCP en producción (glulgyhkrqpykxmujodb). Este archivo es
-- el registro versionado. OJO: el esquema real de comunicaciones en prod
-- difiere del archivo 008 (sin direccion/resultado/deleted_at; transcripcion
-- en vez de transcript) — esta migración usa el esquema REAL.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Columnas nuevas en leads ─────────────────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS post_zoom    boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS post_zoom_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_post_zoom
  ON public.leads (organization_id, post_zoom_at DESC)
  WHERE post_zoom AND deleted_at IS NULL;

-- Helper: cast a timestamptz sin reventar con basura legacy.
CREATE OR REPLACE FUNCTION public.fn_safe_ts(t text)
RETURNS timestamptz LANGUAGE plpgsql AS $$
BEGIN
  RETURN t::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Helper: fecha + hora (texto libre del panel) → timestamptz en Cancún.
-- Nunca lanza: si la hora no se puede leer, cae a mediodía; si no hay
-- fecha, NULL (el caller decide el fallback).
CREATE OR REPLACE FUNCTION public.fn_cancun_ts(p_fecha date, p_hora text)
RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE
  v timestamptz;
BEGIN
  IF p_fecha IS NULL THEN RETURN NULL; END IF;
  BEGIN
    IF COALESCE(p_hora,'') ~ '^\d{1,2}:\d{2}' THEN
      v := ((p_fecha::text || ' ' || trim(p_hora))::timestamp) AT TIME ZONE 'America/Cancun';
    END IF;
  EXCEPTION WHEN others THEN
    v := NULL;
  END;
  IF v IS NULL THEN
    v := ((p_fecha::text || ' 12:00')::timestamp) AT TIME ZONE 'America/Cancun';
  END IF;
  RETURN v;
END;
$$;

-- ── 2) Trigger en leads: entrar a etapa post-Zoom marca el hecho ────────
CREATE OR REPLACE FUNCTION public.leads_mark_post_zoom()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stage IN ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa')
     AND NOT COALESCE(NEW.post_zoom, false) THEN
    NEW.post_zoom    := true;
    NEW.post_zoom_at := COALESCE(NEW.post_zoom_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_mark_post_zoom ON public.leads;
CREATE TRIGGER leads_mark_post_zoom
  BEFORE INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_mark_post_zoom();

-- ── 3) Trigger REVERSO: panel 'Asistió' → lead avanza + expediente ──────
CREATE OR REPLACE FUNCTION public.zoom_agendados_apply_asistio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead   public.leads;
  v_when   timestamptz;
  v_stage_prev text;
  v_avanza boolean := false;
  v_by     text;
  v_resumen text;
  v_evento jsonb;
BEGIN
  -- Solo reacciona a ediciones directas del panel (no a los ecos del
  -- sync lead→panel, que corren dentro de triggers de leads).
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NULL OR NEW.estatus IS DISTINCT FROM 'Asistió' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estatus IS NOT DISTINCT FROM 'Asistió' THEN
    RETURN NEW;  -- ya estaba en Asistió: nada nuevo
  END IF;

  SELECT * INTO v_lead FROM public.leads
   WHERE id = NEW.lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Cuándo ocurrió el Zoom (fecha + hora del panel, zona Cancún).
  v_when := COALESCE(public.fn_cancun_ts(NEW.fecha_zoom, NEW.hora), now());

  v_stage_prev := v_lead.stage;
  v_avanza := v_lead.stage IS NULL OR v_lead.stage NOT IN
    ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa');
  -- Crédito del Zoom: el presentador que lo corrió; si no hay, el asesor dueño.
  v_by := COALESCE(NULLIF(trim(NEW.presentador_principal),''),
                   NULLIF(trim(v_lead.asesor_name),''), 'Stratos AI');

  IF v_avanza THEN
    v_evento := jsonb_build_object(
      'id',           'pz-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
      'type',         'etapa',
      'action',       'Etapa: ' || COALESCE(v_stage_prev,'—') || ' → Zoom Concretado',
      'by',           v_by,
      'completed_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'doneAtFmt',    to_char(now() AT TIME ZONE 'America/Cancun', 'DD/MM HH24:MI'),
      'source',       'zoom_control_sync'
    );
  END IF;

  UPDATE public.leads l SET
    post_zoom    = true,
    post_zoom_at = COALESCE(l.post_zoom_at, v_when),
    stage        = CASE WHEN v_avanza THEN 'Zoom Concretado' ELSE l.stage END,
    next_action  = CASE WHEN COALESCE(trim(l.next_action),'') = ''
                        THEN 'Seguimiento post-Zoom (hoy)' ELSE l.next_action END,
    action_history = CASE WHEN v_avanza
                          THEN v_evento || (CASE WHEN jsonb_typeof(l.action_history) = 'array'
                                                 THEN l.action_history ELSE '[]'::jsonb END)
                          ELSE l.action_history END,
    updated_at   = now()
  WHERE l.id = NEW.lead_id;

  -- El Zoom queda en el expediente del cliente (comunicaciones tipo 'zoom').
  -- Idempotente por zoom_agendado_id en metadata.
  v_resumen := 'Zoom realizado'
    || CASE WHEN COALESCE(NEW.proyecto,'') <> '' THEN ' — ' || NEW.proyecto ELSE '' END
    || CASE WHEN COALESCE(NEW.presentador_principal,'') <> ''
            THEN ' · Presentó: ' || NEW.presentador_principal ELSE '' END
    || CASE WHEN COALESCE(NEW.presentador_apoyo,'') <> ''
            THEN ' y ' || NEW.presentador_apoyo ELSE '' END
    || CASE WHEN COALESCE(NEW.liner,'') <> '' THEN ' · Agendó: ' || NEW.liner ELSE '' END
    || CASE WHEN COALESCE(NEW.comentarios,'') <> '' THEN ' · ' || NEW.comentarios ELSE '' END;

  IF NOT EXISTS (
    SELECT 1 FROM public.comunicaciones c
    WHERE c.lead_id = NEW.lead_id
      AND c.metadata->>'zoom_agendado_id' = NEW.id::text
  ) THEN
    INSERT INTO public.comunicaciones
      (organization_id, lead_id, asesor_id, tipo, ocurrio_en, resumen, metadata)
    VALUES
      (NEW.organization_id, NEW.lead_id, v_lead.asesor_id, 'zoom', v_when,
       v_resumen,
       jsonb_build_object(
         'source', 'zoom_control_sync',
         'zoom_agendado_id', NEW.id::text,
         'liner', NEW.liner,
         'presentador_principal', NEW.presentador_principal,
         'presentador_apoyo', NEW.presentador_apoyo,
         'proyecto', NEW.proyecto));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zoom_agendados_apply_asistio ON public.zoom_agendados;
CREATE TRIGGER zoom_agendados_apply_asistio
  AFTER INSERT OR UPDATE OF estatus ON public.zoom_agendados
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_apply_asistio();

-- ── 4) CHECK de tipos ampliado (desbloquea el coach de notas) ───────────
ALTER TABLE public.proactive_reminders DROP CONSTRAINT IF EXISTS proactive_reminders_tipo_check;
ALTER TABLE public.proactive_reminders ADD CONSTRAINT proactive_reminders_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'inactividad','zoom_brief','zoom_escalation','custom','inactividad_insist',
    'next_action_3h','next_action_10min','team_action','team_escalation','personal',
    'visita_30d','visita_15d','visita_7d','visita_1d','visita_3h',
    'zoom_1h_missing','zoom_1h_ok','zoom_15min',
    'evidence_review','evidence_verified','evidence_rejected',
    'admin_overdue','admin_expense','llamada_entrante','mkt_assign',
    'notas_post_zoom','post_zoom_seguimiento'
  ]));

-- ── 5) Backfill (una vez, guardado por post_zoom=false) ─────────────────
-- 5a. Por etapa actual.
UPDATE public.leads
SET post_zoom = true,
    post_zoom_at = COALESCE(post_zoom_at, updated_at, now())
WHERE deleted_at IS NULL
  AND NOT post_zoom
  AND stage IN ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa');

-- 5b. Por historial (pasó por una etapa post-Zoom aunque hoy esté en otra;
--     incluye labels legacy Negociación / Visita Concretada).
UPDATE public.leads l
SET post_zoom = true,
    post_zoom_at = COALESCE(l.post_zoom_at, ev.first_at, l.updated_at, now())
FROM (
  SELECT l2.id,
         min(public.fn_safe_ts(e->>'completed_at')) AS first_at
  FROM public.leads l2
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(l2.action_history) = 'array'
         THEN l2.action_history ELSE '[]'::jsonb END) e
  WHERE l2.deleted_at IS NULL
    AND NOT l2.post_zoom
    AND e->>'type' = 'etapa'
    AND (e->>'action' LIKE '%→ Zoom Concretado'
      OR e->>'action' LIKE '%→ Seguimiento'
      OR e->>'action' LIKE '%→ Apartó'
      OR e->>'action' LIKE '%→ Visita Agendada'
      OR e->>'action' LIKE '%→ Cierre'
      OR e->>'action' LIKE '%→ Postventa'
      OR e->>'action' LIKE '%→ Negociación'
      OR e->>'action' LIKE '%→ Visita Concretada')
  GROUP BY l2.id
) ev
WHERE ev.id = l.id;

-- 5c. Por panel: Zooms 'Asistió' ya vinculados a lead.
UPDATE public.leads l
SET post_zoom = true,
    post_zoom_at = COALESCE(l.post_zoom_at, z.zoom_at, l.updated_at, now())
FROM (
  SELECT za.lead_id,
         min(public.fn_cancun_ts(za.fecha_zoom, za.hora)) AS zoom_at
  FROM public.zoom_agendados za
  WHERE za.estatus = 'Asistió' AND za.lead_id IS NOT NULL
  GROUP BY za.lead_id
) z
WHERE z.lead_id = l.id AND l.deleted_at IS NULL AND NOT l.post_zoom;

-- 5d. Expediente retroactivo: cada Zoom 'Asistió' vinculado queda como
--     comunicación (sin tocar etapas ni action_history — solo el registro).
INSERT INTO public.comunicaciones
  (organization_id, lead_id, asesor_id, tipo, ocurrio_en, resumen, metadata)
SELECT za.organization_id, za.lead_id, l.asesor_id, 'zoom',
       COALESCE(public.fn_cancun_ts(za.fecha_zoom, za.hora), za.updated_at),
       'Zoom realizado'
         || CASE WHEN COALESCE(za.proyecto,'') <> '' THEN ' — ' || za.proyecto ELSE '' END
         || CASE WHEN COALESCE(za.presentador_principal,'') <> ''
                 THEN ' · Presentó: ' || za.presentador_principal ELSE '' END,
       jsonb_build_object('source','zoom_control_sync','zoom_agendado_id', za.id::text,
                          'backfill', true,
                          'liner', za.liner, 'presentador_principal', za.presentador_principal)
FROM public.zoom_agendados za
JOIN public.leads l ON l.id = za.lead_id AND l.deleted_at IS NULL
WHERE za.estatus = 'Asistió' AND za.lead_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.comunicaciones c
    WHERE c.lead_id = za.lead_id
      AND c.metadata->>'zoom_agendado_id' = za.id::text
  );

-- ── 6) Escalera de insistencia: fn_post_zoom_scan (la llama n8n) ────────
CREATE OR REPLACE FUNCTION public.fn_post_zoom_scan(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                         '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_max_por_asesor int := COALESCE(NULLIF(payload->>'max_per_asesor','')::int, 5);
  v_daystamp text;
  v_notas int := 0;
  v_seg int := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  v_daystamp := to_char((now() AT TIME ZONE v_cfg.timezone)::date, 'YYYYMMDD');

  WITH base AS (
    SELECT l.id, l.name, l.stage, l.asesor_id, l.asesor_name,
           l.post_zoom_at, l.next_action_at,
           GREATEST(
             l.post_zoom_at,
             COALESCE(t.last_comm,  l.post_zoom_at),
             COALESCE(t.last_exp,   l.post_zoom_at)
           ) AS last_touch,
           (COALESCE(t.nota_comm, false) OR COALESCE(t.nota_exp, false)) AS nota_ok
    FROM public.leads l
    LEFT JOIN LATERAL (
      SELECT
        max(c.ocurrio_en) FILTER (WHERE COALESCE(c.metadata->>'source','') <> 'zoom_control_sync') AS last_comm,
        bool_or(c.tipo IN ('zoom','nota')
                AND COALESCE(c.metadata->>'source','') <> 'zoom_control_sync'
                AND c.ocurrio_en >= l.post_zoom_at - interval '2 hours') AS nota_comm,
        (SELECT max(e.created_at) FROM public.expediente_items e
          WHERE e.lead_id = l.id AND e.deleted_at IS NULL) AS last_exp,
        (SELECT bool_or(e.created_at >= l.post_zoom_at - interval '2 hours')
           FROM public.expediente_items e
          WHERE e.lead_id = l.id AND e.deleted_at IS NULL) AS nota_exp
      FROM public.comunicaciones c
      WHERE c.lead_id = l.id
    ) t ON true
    WHERE l.organization_id = v_org
      AND l.deleted_at IS NULL
      AND l.post_zoom
      AND l.post_zoom_at IS NOT NULL
      AND l.stage IN ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada')
      AND COALESCE(trim(l.asesor_name),'') <> ''
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  cand AS (
    SELECT b.*,
      EXTRACT(epoch FROM (now() - b.last_touch)) / 3600.0 AS horas_sin_toque,
      EXTRACT(epoch FROM (now() - b.post_zoom_at)) / 3600.0 AS horas_desde_zoom,
      LEAST(3, GREATEST(1, floor(EXTRACT(epoch FROM (now() - b.last_touch)) / 86400.0)))::int AS nivel,
      row_number() OVER (PARTITION BY b.asesor_name ORDER BY b.post_zoom_at DESC) AS rn
    FROM base b
    WHERE (b.next_action_at IS NULL OR b.next_action_at <= now())
  ),
  ins_notas AS (
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    SELECT v_org, c.id, c.asesor_id, c.asesor_name, 'notas_post_zoom', now(),
           'notas_post_zoom:' || c.id::text || ':' || v_daystamp,
           jsonb_build_object('lead_name', c.name, 'stage', c.stage,
             'text', '▸ ' || COALESCE(c.name,'Tu cliente') || chr(10) ||
                     '· Ya pasó por Zoom y falta la nota de cómo les fue.' || chr(10) ||
                     '· Mándame un audio con lo que se habló y la dejo en su expediente.')
    FROM cand c
    WHERE NOT c.nota_ok AND c.horas_desde_zoom >= 3 AND c.rn <= v_max_por_asesor
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  ins_seg AS (
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    SELECT v_org, c.id, c.asesor_id, c.asesor_name, 'post_zoom_seguimiento', now(),
           'post_zoom_seg:' || c.id::text || ':' || v_daystamp,
           jsonb_build_object('lead_name', c.name, 'stage', c.stage,
             'nivel', c.nivel, 'dias_sin_toque', floor(c.horas_sin_toque/24),
             'escalate', c.nivel >= 3,
             'text', CASE c.nivel
               WHEN 1 THEN '▸ ' || COALESCE(c.name,'Tu cliente') || chr(10) ||
                 '· Pasó por Zoom y lleva un día sin seguimiento.' || chr(10) ||
                 '· Este cliente ya trae el 70% del camino — contáctalo hoy.'
               WHEN 2 THEN '▸ ' || COALESCE(c.name,'Tu cliente') || chr(10) ||
                 '· Van 2 días sin seguimiento después de su Zoom.' || chr(10) ||
                 '· No dejes enfriar todo el trabajo que ya se hizo con él.'
               ELSE '▸ ' || COALESCE(c.name,'Tu cliente') || chr(10) ||
                 '· 3 días o más sin seguimiento post-Zoom. Prioridad máxima.' || chr(10) ||
                 '· Contáctalo ahora, o cuéntame qué pasó y lo registramos.'
             END)
    FROM cand c
    WHERE c.nota_ok AND c.horas_sin_toque >= 24 AND c.rn <= v_max_por_asesor
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins_notas), (SELECT count(*) FROM ins_seg)
    INTO v_notas, v_seg;

  RETURN jsonb_build_object('ok', true, 'enqueued', v_notas + v_seg,
    'notas', v_notas, 'seguimientos', v_seg, 'organization_id', v_org);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_post_zoom_scan(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_post_zoom_scan(jsonb) TO service_role;

-- ── 7) Facade para el CRM: get_post_zoom_pendientes ─────────────────────
-- SECURITY INVOKER: la RLS de leads decide (asesor ve lo suyo; director todo).
CREATE OR REPLACE FUNCTION public.get_post_zoom_pendientes()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_items jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(x) ORDER BY (NOT x.nota_ok) DESC, x.dias_sin_seguimiento DESC)
  INTO v_items
  FROM (
    SELECT l.id AS lead_id, l.name, l.asesor_name, l.stage,
           l.post_zoom_at, l.next_action, l.next_action_at,
           GREATEST(l.post_zoom_at,
                    COALESCE(t.last_comm, l.post_zoom_at),
                    COALESCE(t.last_exp,  l.post_zoom_at)) AS ultimo_toque_at,
           floor(EXTRACT(epoch FROM (now() - GREATEST(l.post_zoom_at,
                    COALESCE(t.last_comm, l.post_zoom_at),
                    COALESCE(t.last_exp,  l.post_zoom_at)))) / 86400.0)::int AS dias_sin_seguimiento,
           (COALESCE(t.nota_comm,false) OR COALESCE(t.nota_exp,false)) AS nota_ok
    FROM public.leads l
    LEFT JOIN LATERAL (
      SELECT
        max(c.ocurrio_en) FILTER (WHERE COALESCE(c.metadata->>'source','') <> 'zoom_control_sync') AS last_comm,
        bool_or(c.tipo IN ('zoom','nota')
                AND COALESCE(c.metadata->>'source','') <> 'zoom_control_sync'
                AND c.ocurrio_en >= l.post_zoom_at - interval '2 hours') AS nota_comm,
        (SELECT max(e.created_at) FROM public.expediente_items e
          WHERE e.lead_id = l.id AND e.deleted_at IS NULL) AS last_exp,
        (SELECT bool_or(e.created_at >= l.post_zoom_at - interval '2 hours')
           FROM public.expediente_items e
          WHERE e.lead_id = l.id AND e.deleted_at IS NULL) AS nota_exp
      FROM public.comunicaciones c
      WHERE c.lead_id = l.id
    ) t ON true
    WHERE l.deleted_at IS NULL
      AND l.post_zoom
      AND l.post_zoom_at IS NOT NULL
      AND l.stage IN ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada')
  ) x
  WHERE (NOT x.nota_ok) OR x.dias_sin_seguimiento >= 1;

  RETURN jsonb_build_object('ok', true,
    'count', COALESCE(jsonb_array_length(v_items), 0),
    'items', COALESCE(v_items, '[]'::jsonb));
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_post_zoom_pendientes() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (aditiva — revertir no toca datos de negocio existentes):
--   DROP TRIGGER  IF EXISTS zoom_agendados_apply_asistio ON public.zoom_agendados;
--   DROP FUNCTION IF EXISTS public.zoom_agendados_apply_asistio();
--   DROP TRIGGER  IF EXISTS leads_mark_post_zoom ON public.leads;
--   DROP FUNCTION IF EXISTS public.leads_mark_post_zoom();
--   DROP FUNCTION IF EXISTS public.fn_post_zoom_scan(jsonb);
--   DROP FUNCTION IF EXISTS public.get_post_zoom_pendientes();
--   DROP FUNCTION IF EXISTS public.fn_safe_ts(text);
--   -- (columnas post_zoom/post_zoom_at pueden quedarse; son inertes)
--   -- (el CHECK ampliado puede quedarse; solo PERMITE tipos nuevos)
--
-- VALIDACIÓN POST-APPLY (correr tras aplicar):
--   SELECT count(*) FILTER (WHERE post_zoom) AS marcados FROM leads WHERE deleted_at IS NULL;
--   SELECT tgname FROM pg_trigger WHERE tgrelid='public.zoom_agendados'::regclass AND NOT tgisinternal;
--   SELECT public.get_post_zoom_pendientes()->>'count';
-- ════════════════════════════════════════════════════════════════════════
