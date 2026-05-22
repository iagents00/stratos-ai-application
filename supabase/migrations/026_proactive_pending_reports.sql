-- ════════════════════════════════════════════════════════════════════════
-- 026 — Fase 3 motor proactivo: report-back del asesor
-- ────────────────────────────────────────────────────────────────────────
-- Cuando el motor le manda un recordatorio al asesor por Telegram, queda un
-- "reporte pendiente" abierto. Cuando el asesor responde qué pasó con el lead,
-- n8n cierra el reporte con el outcome. El manager_telegram_id NO vive acá
-- (se maneja en n8n con el grupo).
--
-- 3 RPCs (service_role only, patrón fn_proactive_*):
--   · fn_proactive_open_report  — abre (o actualiza si ya hay open p/ advisor+lead).
--   · fn_proactive_check_report — el open más reciente y no vencido p/ un telegram_id.
--   · fn_proactive_close_report — cierra con outcome.
--
-- 100% aditiva. Scoped a Duke. Validada con dry-run BEGIN/ROLLBACK.
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proactive_pending_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id),
  advisor_telegram_id bigint NOT NULL,
  lead_id             uuid NOT NULL,
  reminder_id         uuid,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','expired')),
  outcome             text,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proactive_pending_reports_open_idx
  ON public.proactive_pending_reports (advisor_telegram_id) WHERE status='open';
ALTER TABLE public.proactive_pending_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proactive_pending_reports_org_rw ON public.proactive_pending_reports;
CREATE POLICY proactive_pending_reports_org_rw ON public.proactive_pending_reports
  FOR ALL USING (organization_id = current_organization_id());

CREATE OR REPLACE FUNCTION public.fn_proactive_open_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id   uuid   := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_tg       bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_lead     uuid   := NULLIF(payload->>'lead_id','')::uuid;
  v_reminder uuid   := NULLIF(payload->>'reminder_id','')::uuid;
  v_expires  timestamptz := NULLIF(payload->>'expires_at','')::timestamptz;
  v_id       uuid;
  v_action   text;
BEGIN
  IF v_tg IS NULL OR v_lead IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id and lead_id required');
  END IF;

  SELECT id INTO v_id FROM public.proactive_pending_reports
  WHERE organization_id = v_org_id AND advisor_telegram_id = v_tg
    AND lead_id = v_lead AND status = 'open'
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.proactive_pending_reports
    SET reminder_id = COALESCE(v_reminder, reminder_id), expires_at = v_expires
    WHERE id = v_id;
    v_action := 'updated';
  ELSE
    INSERT INTO public.proactive_pending_reports
      (organization_id, advisor_telegram_id, lead_id, reminder_id, status, expires_at)
    VALUES (v_org_id, v_tg, v_lead, v_reminder, 'open', v_expires)
    RETURNING id INTO v_id;
    v_action := 'created';
  END IF;

  RETURN jsonb_build_object('ok', true, 'report_id', v_id, 'action', v_action);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid   := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_tg     bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_id     uuid;
  v_lead   uuid;
BEGIN
  IF v_tg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id required');
  END IF;
  SELECT id, lead_id INTO v_id, v_lead
  FROM public.proactive_pending_reports
  WHERE organization_id = v_org_id AND advisor_telegram_id = v_tg AND status = 'open'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'has_report', false);
  END IF;
  RETURN jsonb_build_object('ok', true, 'has_report', true, 'lead_id', v_lead, 'report_id', v_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_close_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_id      uuid := NULLIF(payload->>'id','')::uuid;
  v_outcome text := payload->>'outcome';
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id required');
  END IF;
  UPDATE public.proactive_pending_reports
  SET status = 'closed', outcome = v_outcome
  WHERE id = v_id;
  RETURN jsonb_build_object('ok', FOUND, 'id', v_id, 'status', 'closed');
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_open_report(jsonb)  FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_check_report(jsonb) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_close_report(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_open_report(jsonb)  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_check_report(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_close_report(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
