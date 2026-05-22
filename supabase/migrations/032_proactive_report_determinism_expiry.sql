-- ════════════════════════════════════════════════════════════════════════
-- 032 — Reportes proactivos: determinismo + expiración (multi-asesor/multi-Zoom)
-- ────────────────────────────────────────────────────────────────────────
-- Blindaje para producción con varios asesores y varios Zooms pendientes a la vez:
--
--   1. fn_proactive_check_report — tiebreak determinista
--      ORDER BY created_at DESC, id DESC → siempre el último briefing enviado,
--      sin ambigüedad si dos reportes comparten created_at.
--
--   2. fn_proactive_open_report — red de seguridad: si no llega expires_at,
--      default now()+4h (nunca queda un reporte inmortal capturando respuestas).
--      n8n pasa expires_at = zoom_at (NO +1h) para que la escalación dispare a
--      zoom_at-30min, antes de que empiece el Zoom.
--
--   3. fn_proactive_expire_stale (CRON) — marca status='expired' los reportes
--      open vencidos (expires_at <= now()). Devuelve {ok, expired_count}.
--
-- Timing escalación vs expiración (con expires_at = zoom_at): NO chocan.
--   · scan_escalations dispara a zoom_at-30min (expires_at <= now()+30min),
--     reporte aún 'open' → el asesor todavía puede responder. Marca escalated_at.
--   · expire_stale marca 'expired' a zoom_at. 30 min de separación; tocan
--     columnas distintas (escalated_at vs status). Verificado en dry-run.
--
-- Aditivo (2 redefiniciones + 1 función nueva). Scoped a Duke, service_role only.
-- IMPORTANTE: ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid   := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_tg     bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_id uuid; v_lead uuid;
BEGIN
  IF v_tg IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id required'); END IF;
  SELECT id, lead_id INTO v_id, v_lead
  FROM public.proactive_pending_reports
  WHERE organization_id = v_org_id AND advisor_telegram_id = v_tg AND status = 'open'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'has_report', false); END IF;
  RETURN jsonb_build_object('ok', true, 'has_report', true, 'lead_id', v_lead, 'report_id', v_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_open_report(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id   uuid   := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_tg       bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_lead     uuid   := NULLIF(payload->>'lead_id','')::uuid;
  v_reminder uuid   := NULLIF(payload->>'reminder_id','')::uuid;
  v_expires  timestamptz := COALESCE(NULLIF(payload->>'expires_at','')::timestamptz, now() + interval '4 hours');
  v_id uuid; v_action text;
BEGIN
  IF v_tg IS NULL OR v_lead IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'advisor_telegram_id and lead_id required');
  END IF;
  SELECT id INTO v_id FROM public.proactive_pending_reports
  WHERE organization_id = v_org_id AND advisor_telegram_id = v_tg AND lead_id = v_lead AND status = 'open'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.proactive_pending_reports
    SET reminder_id = COALESCE(v_reminder, reminder_id), expires_at = v_expires WHERE id = v_id;
    v_action := 'updated';
  ELSE
    INSERT INTO public.proactive_pending_reports
      (organization_id, advisor_telegram_id, lead_id, reminder_id, status, expires_at)
    VALUES (v_org_id, v_tg, v_lead, v_reminder, 'open', v_expires) RETURNING id INTO v_id;
    v_action := 'created';
  END IF;
  RETURN jsonb_build_object('ok', true, 'report_id', v_id, 'action', v_action, 'expires_at', v_expires);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_proactive_expire_stale(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_n int;
BEGIN
  WITH upd AS (
    UPDATE public.proactive_pending_reports
    SET status = 'expired'
    WHERE organization_id = v_org_id AND status = 'open'
      AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM upd;
  RETURN jsonb_build_object('ok', true, 'expired_count', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_check_report(jsonb) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_open_report(jsonb)  FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_proactive_expire_stale(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_check_report(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_open_report(jsonb)  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_proactive_expire_stale(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
