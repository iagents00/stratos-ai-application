-- ════════════════════════════════════════════════════════════════════════
-- 028 — Escalación: proactive_pending_reports.escalated_at + fn_proactive_scan_escalations
-- ────────────────────────────────────────────────────────────────────────
-- Si el asesor ignora el briefing y el Zoom está inminente (expires_at dentro
-- de 30 min) y el reporte sigue 'open' sin escalar, el motor lo escala (al
-- manager, vía n8n). escalated_at marca que ya se escaló para no repetir.
--
-- fn_proactive_scan_escalations: claim atómico (FOR UPDATE SKIP LOCKED +
-- UPDATE...RETURNING) de los reportes due, setea escalated_at=now() y los
-- devuelve con advisor_telegram_id, lead_id, asesor_name (profiles por
-- telegram) y el name del lead (join a leads).
--
-- Aditiva (ADD COLUMN IF NOT EXISTS sobre tabla nueva 0 filas + función nueva).
-- Scoped a Duke. service_role only. Validada con dry-run BEGIN/ROLLBACK.
-- IMPORTANTE: ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.proactive_pending_reports ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE OR REPLACE FUNCTION public.fn_proactive_scan_escalations(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_rows   jsonb;
BEGIN
  WITH due AS (
    SELECT id FROM public.proactive_pending_reports
    WHERE organization_id = v_org_id
      AND status = 'open'
      AND escalated_at IS NULL
      AND expires_at IS NOT NULL
      AND expires_at <= now() + interval '30 minutes'
    ORDER BY expires_at
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.proactive_pending_reports r
    SET escalated_at = now()
    FROM due
    WHERE r.id = due.id
    RETURNING r.id, r.advisor_telegram_id, r.lead_id, r.expires_at
  )
  SELECT jsonb_agg(jsonb_build_object(
    'report_id', c.id,
    'advisor_telegram_id', c.advisor_telegram_id,
    'lead_id', c.lead_id,
    'asesor_name', pr.name,
    'lead_name', l.name,
    'expires_at', c.expires_at
  ))
  INTO v_rows
  FROM claimed c
  LEFT JOIN public.leads l    ON l.id = c.lead_id
  LEFT JOIN public.profiles pr ON pr.organization_id = v_org_id AND pr.telegram_chat_id = c.advisor_telegram_id;

  RETURN jsonb_build_object('ok', true, 'count', COALESCE(jsonb_array_length(v_rows), 0),
                            'escalations', COALESCE(v_rows, '[]'::jsonb));
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_scan_escalations(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_scan_escalations(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
