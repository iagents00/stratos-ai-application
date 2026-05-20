-- ════════════════════════════════════════════════════════════════════════
-- 025 — Asistente Proactivo de Seguimiento (recordatorios para asesores)
-- ────────────────────────────────────────────────────────────────────────
-- Motor proactivo que le recuerda al ASESOR (nunca al cliente final).
-- Todo gobernado por una tabla de config → ajustar umbrales es un UPDATE.
--   Motor 1 "abandono": leads sin movimiento N días (señal: updated_at).
--   Motor 2 "zoom en X horas": stage 'Zoom Agendado' + next_action_at en ventana.
--     El briefing IA usa get_lead_ai_context(lead_id,50).
-- Cola + claim atómico (FOR UPDATE SKIP LOCKED) + CRON n8n. Scope Duke 000...001.
-- Aditiva. enabled=false. shadow_mode=true blindado a iAgents. Idempotente.
--
-- NOTA (Claude): el RETURNING de fn_proactive_get_pending se calificó con el
-- alias r.* — sin eso, "payload" colisiona con el parámetro de la función
-- (error 42702 ambiguous). Detectado en dry-run BEGIN/ROLLBACK antes de aplicar.
--
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proactive_config (
  organization_id          uuid PRIMARY KEY
                           REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled                  boolean NOT NULL DEFAULT false,
  inactivity_days          integer NOT NULL DEFAULT 3,
  inactivity_signal        text    NOT NULL DEFAULT 'updated_at'
                           CHECK (inactivity_signal IN ('days_inactive','updated_at')),
  zoom_reminder_hours      numeric NOT NULL DEFAULT 3,
  zoom_escalation_minutes  integer NOT NULL DEFAULT 30,
  zoom_stage_label         text    NOT NULL DEFAULT 'Zoom Agendado',
  quiet_start_hour         integer NOT NULL DEFAULT 21,
  quiet_end_hour           integer NOT NULL DEFAULT 8,
  timezone                 text    NOT NULL DEFAULT 'America/Cancun',
  shadow_mode              boolean NOT NULL DEFAULT true,
  test_telegram_id         bigint,
  test_asesor_names        text[]  NOT NULL DEFAULT ARRAY['iAgents'],
  terminal_stages          text[]  NOT NULL DEFAULT ARRAY['Cierre','Rotación','Postventa'],
  updated_at               timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS proactive_config_updated_at ON public.proactive_config;
CREATE TRIGGER proactive_config_updated_at
  BEFORE UPDATE ON public.proactive_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.proactive_config (organization_id, enabled, shadow_mode)
VALUES ('00000000-0000-0000-0000-000000000001', false, true)
ON CONFLICT (organization_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.proactive_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  lead_id         uuid,
  asesor_id       uuid,
  asesor_name     text,
  tipo            text NOT NULL
                  CHECK (tipo IN ('inactividad','zoom_brief','zoom_escalation','custom')),
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','cancelled','skipped')),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key      text,
  ignore_quiet    boolean NOT NULL DEFAULT false,
  attempts        integer NOT NULL DEFAULT 0,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS proactive_reminders_dedupe_idx
  ON public.proactive_reminders (dedupe_key);
CREATE INDEX IF NOT EXISTS proactive_reminders_due_idx
  ON public.proactive_reminders (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS proactive_reminders_org_status_idx
  ON public.proactive_reminders (organization_id, status);
ALTER TABLE public.proactive_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proactive_config_org_rw ON public.proactive_config;
CREATE POLICY proactive_config_org_rw ON public.proactive_config
  FOR ALL USING (organization_id = current_organization_id());
DROP POLICY IF EXISTS proactive_reminders_org_rw ON public.proactive_reminders;
CREATE POLICY proactive_reminders_org_rw ON public.proactive_reminders
  FOR ALL USING (organization_id = current_organization_id());

CREATE OR REPLACE FUNCTION public.fn_proactive_get_config(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                            '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg jsonb;
BEGIN
  SELECT to_jsonb(c) INTO v_cfg FROM public.proactive_config c
  WHERE c.organization_id = v_org_id;
  RETURN jsonb_build_object('ok', v_cfg IS NOT NULL, 'config', COALESCE(v_cfg, '{}'::jsonb));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_zooms(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                            '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_enqueued int := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  WITH candidates AS (
    SELECT l.id, l.asesor_id, l.asesor_name, l.next_action_at,
           GREATEST(l.next_action_at - (v_cfg.zoom_reminder_hours * interval '1 hour'), now()) AS fire_at
    FROM public.leads l
    WHERE l.organization_id = v_org_id
      AND l.deleted_at IS NULL
      AND lower(l.stage) = lower(v_cfg.zoom_stage_label)
      AND l.next_action_at IS NOT NULL
      AND l.next_action_at > now()
      AND l.next_action_at <= now() + interval '24 hours'
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  ins AS (
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'zoom_brief',
           c.fire_at,
           'zoom_brief:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true,
           jsonb_build_object('zoom_at', c.next_action_at)
    FROM candidates c
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM ins;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_inactive(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                            '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_enqueued int := 0;
  v_daystamp text;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  v_daystamp := to_char((now() AT TIME ZONE v_cfg.timezone)::date, 'YYYYMMDD');
  WITH candidates AS (
    SELECT l.id, l.asesor_id, l.asesor_name
    FROM public.leads l
    WHERE l.organization_id = v_org_id
      AND l.deleted_at IS NULL
      AND l.asesor_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM unnest(v_cfg.terminal_stages) t WHERE lower(t) = lower(l.stage)
      )
      AND (
            (v_cfg.inactivity_signal = 'days_inactive'
              AND COALESCE(l.days_inactive, 0) >= v_cfg.inactivity_days)
         OR (v_cfg.inactivity_signal = 'updated_at'
              AND l.updated_at < now() - (v_cfg.inactivity_days * interval '1 day'))
      )
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  ins AS (
    INSERT INTO public.proactive_reminders
      (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'inactividad', now(),
           'inactividad:' || c.id::text || ':' || v_daystamp,
           '{}'::jsonb
    FROM candidates c
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM ins;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id   uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                              '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg      public.proactive_config%ROWTYPE;
  v_hour     int;
  v_in_quiet boolean := false;
  v_limit    int := COALESCE(NULLIF(payload->>'limit','')::int, 50);
  v_rows     jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'count', 0, 'reminders', '[]'::jsonb, 'reason', 'disabled');
  END IF;
  v_hour := EXTRACT(hour FROM (now() AT TIME ZONE v_cfg.timezone))::int;
  IF v_cfg.quiet_start_hour > v_cfg.quiet_end_hour THEN
    v_in_quiet := (v_hour >= v_cfg.quiet_start_hour OR v_hour < v_cfg.quiet_end_hour);
  ELSE
    v_in_quiet := (v_hour >= v_cfg.quiet_start_hour AND v_hour < v_cfg.quiet_end_hour);
  END IF;
  WITH claimed AS (
    UPDATE public.proactive_reminders r
    SET status = 'sent', sent_at = now(), attempts = attempts + 1
    WHERE r.id IN (
      SELECT id FROM public.proactive_reminders
      WHERE organization_id = v_org_id
        AND status = 'pending'
        AND scheduled_at <= now()
        AND (NOT v_in_quiet OR ignore_quiet)
      ORDER BY scheduled_at
      LIMIT v_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING r.id, r.lead_id, r.asesor_id, r.asesor_name, r.tipo, r.scheduled_at, r.payload, r.dedupe_key
  )
  SELECT jsonb_agg(to_jsonb(c)) INTO v_rows FROM claimed c;
  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(jsonb_array_length(v_rows), 0),
    'shadow_mode', v_cfg.shadow_mode,
    'test_telegram_id', v_cfg.test_telegram_id,
    'reminders', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_enqueue(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,
                            '00000000-0000-0000-0000-000000000001'::uuid);
  v_id uuid;
BEGIN
  INSERT INTO public.proactive_reminders
    (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
  VALUES (
    v_org_id,
    NULLIF(payload->>'lead_id','')::uuid,
    NULLIF(payload->>'asesor_id','')::uuid,
    payload->>'asesor_name',
    COALESCE(payload->>'tipo', 'custom'),
    COALESCE(NULLIF(payload->>'scheduled_at','')::timestamptz, now()),
    NULLIF(payload->>'dedupe_key',''),
    COALESCE((payload->>'ignore_quiet')::boolean, false),
    COALESCE(payload->'data', '{}'::jsonb)
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id,
                            'action', CASE WHEN v_id IS NULL THEN 'duplicate_skipped' ELSE 'created' END);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_mark(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id     uuid := NULLIF(payload->>'id','')::uuid;
  v_status text := payload->>'status';
BEGIN
  IF v_id IS NULL OR v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id and status required');
  END IF;
  IF v_status NOT IN ('pending','sent','cancelled','skipped') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid status');
  END IF;
  UPDATE public.proactive_reminders
  SET status = v_status,
      sent_at = CASE WHEN v_status = 'sent' THEN now() ELSE sent_at END
  WHERE id = v_id;
  RETURN jsonb_build_object('ok', FOUND, 'id', v_id, 'status', v_status);
END;
$fn$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'fn_proactive_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, authenticated, anon;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
