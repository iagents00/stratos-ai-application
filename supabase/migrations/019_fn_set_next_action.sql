-- ════════════════════════════════════════════════════════════════════════
-- 019 — fn_set_next_action: setea/limpia la "Próxima Acción" del lead
-- ────────────────────────────────────────────────────────────────────────
-- n8n usa esta función cuando la IA quiere asignar/cambiar la próxima
-- acción concreta del lead — típicamente en handoff a humano
-- ("Llamar para aclarar dudas fiscales", "Enviar información de Tulum",
-- "Confirmar visita del jueves", etc.).
--
-- Actualiza 3 columnas en leads:
--   - next_action       (texto que se renderiza en el NextActionHero del CRM)
--   - next_action_at    (timestamp ISO con tz, para sorting y reminders)
--   - next_action_date  (display string opcional; si no llega, se autoformatea
--                        desde next_action_at en tz America/Cancun → "19 May, 15:00")
--
-- Soporta clear: { "clear": true } resetea las 3 columnas (semánticamente
-- "completada / sin pendiente"). Útil cuando el bot quiere marcar como
-- hecha una próxima acción previa antes de poner una nueva.
--
-- IMPORTANTE: ya ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_set_next_action(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone        TEXT        := payload ->> 'phone_e164';
  v_phone_norm   TEXT;
  v_action       TEXT        := payload ->> 'next_action';
  v_when         TIMESTAMPTZ := NULLIF(payload ->> 'next_action_at', '')::TIMESTAMPTZ;
  v_when_display TEXT        := NULLIF(payload ->> 'next_action_date', '');
  v_org_id       UUID        := '00000000-0000-0000-0000-000000000001'::UUID;
  v_lead_id      UUID;
  v_clear        BOOLEAN     := COALESCE((payload ->> 'clear')::boolean, false);
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;

  IF NOT v_clear AND (v_action IS NULL OR length(trim(v_action)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'next_action missing (pass "clear": true to reset)');
  END IF;

  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone
         OR phone_normalized = v_phone_norm
         OR phone = v_phone)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;

  IF v_clear THEN
    UPDATE public.leads SET
      next_action = NULL,
      next_action_at = NULL,
      next_action_date = NULL,
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI')
    WHERE id = v_lead_id;
    RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'action', 'cleared');
  END IF;

  -- Autoformateo del display cuando hay timestamp pero no llegó string custom.
  IF v_when_display IS NULL AND v_when IS NOT NULL THEN
    v_when_display := to_char(v_when AT TIME ZONE 'America/Cancun',
                              'DD Mon, HH24:MI');
  END IF;

  UPDATE public.leads SET
    next_action      = trim(v_action),
    next_action_at   = v_when,
    next_action_date = v_when_display,
    updated_at       = now(),
    last_activity    = to_char(now(), 'YYYY-MM-DD HH24:MI'),
    days_inactive    = 0
  WHERE id = v_lead_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'action', 'set',
    'next_action', trim(v_action),
    'next_action_at', v_when,
    'next_action_date', v_when_display
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_set_next_action(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_next_action(jsonb) TO service_role;
