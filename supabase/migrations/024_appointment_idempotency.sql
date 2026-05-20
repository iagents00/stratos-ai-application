-- ════════════════════════════════════════════════════════════════════════
-- 024 — Idempotencia de fn_register_appointment (ON CONFLICT zoom_meeting_id)
-- ────────────────────────────────────────────────────────────────────────
-- Antes: cada llamada hacía un INSERT nuevo en appointments → llamar 2 veces
-- con el mismo Zoom = filas duplicadas + recordatorios duplicados.
--
-- Ahora: índice único parcial en zoom_meeting_id (cuando no es NULL) + el
-- INSERT usa ON CONFLICT DO UPDATE → reagendar/reenviar el mismo Zoom
-- actualiza la fila existente en vez de duplicar. Si no viene zoom_meeting_id,
-- se comporta como antes (inserta; los NULL no entran al índice).
--
-- appointments está vacía hoy, así que el índice se crea sin riesgo.
-- Scoped a la org Stratos/Duke. service_role only.
--
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Índice único parcial: dedupe por zoom_meeting_id real (ignora NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS appointments_zoom_meeting_id_key
  ON public.appointments (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;

-- 2) Función idempotente.
CREATE OR REPLACE FUNCTION public.fn_register_appointment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone     text := payload ->> 'phone';
  v_lead_id   uuid;
  v_appt_id   uuid;
  v_org_id    uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing');
  END IF;

  SELECT id INTO v_lead_id FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR phone = v_phone
         OR phone_normalized = regexp_replace(v_phone, '[^0-9]', '', 'g'))
    AND deleted_at IS NULL LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone');
  END IF;

  INSERT INTO public.appointments (
    lead_id, organization_id, zoom_meeting_id, meet_link,
    start_time, end_time, timezone, advisor_name, status
  ) VALUES (
    v_lead_id, v_org_id,
    payload ->> 'zoom_meeting_id',
    payload ->> 'meet_link',
    NULLIF(payload ->> 'start_time', '')::timestamptz,
    NULLIF(payload ->> 'end_time', '')::timestamptz,
    COALESCE(payload ->> 'timezone', 'America/Cancun'),
    payload ->> 'advisor_name',
    COALESCE(payload ->> 'status', 'scheduled')
  )
  ON CONFLICT (zoom_meeting_id) WHERE zoom_meeting_id IS NOT NULL
  DO UPDATE SET
    lead_id      = EXCLUDED.lead_id,
    meet_link    = EXCLUDED.meet_link,
    start_time   = EXCLUDED.start_time,
    end_time     = EXCLUDED.end_time,
    timezone     = EXCLUDED.timezone,
    advisor_name = EXCLUDED.advisor_name,
    status       = EXCLUDED.status,
    updated_at   = now()
  RETURNING id INTO v_appt_id;

  -- Sincronizar lead: stage → Zoom Agendado + next_action
  UPDATE public.leads SET
    stage = 'Zoom Agendado',
    next_action = 'Zoom con cliente',
    next_action_at = NULLIF(payload ->> 'start_time', '')::timestamptz,
    next_action_date = to_char(NULLIF(payload ->> 'start_time', '')::timestamptz, 'YYYY-MM-DD'),
    updated_at = now()
  WHERE id = v_lead_id;

  RETURN jsonb_build_object('ok', true, 'appointment_id', v_appt_id, 'lead_id', v_lead_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_register_appointment(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_appointment(jsonb) TO service_role;
