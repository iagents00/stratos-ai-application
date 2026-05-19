-- ════════════════════════════════════════════════════════════════════════
-- 021 — fn_reset_call_attempts + fn_assign_lead
-- ────────────────────────────────────────────────────────────────────────
-- Dos RPCs complementarias del motor de strikes (PR #132 / migration 020):
--
-- 1) fn_reset_call_attempts: cuando una llamada conecta exitosamente, n8n
--    llama esta función y el contador vuelve a 0. Sin esto, la cuenta
--    seguiría subiendo en el siguiente fallido y un cliente que contestó
--    al segundo intento podría quedar a 1 strike del cap por error.
--
-- 2) fn_assign_lead: cuando hay handoff a humano, reasignación REAL en BD
--    (no solo texto en next_action). Actualiza leads.asesor_id + asesor_name
--    para que el filtro "Mis Leads" del asesor detecte el lead. Recibe
--    agent_name por string (case-insensitive exact match contra profiles.name
--    en la org Stratos). Devuelve previous_asesor para auditoría.
--
-- IMPORTANTE: ya ejecutadas vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── fn_reset_call_attempts ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_reset_call_attempts(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone      TEXT := payload ->> 'phone_e164';
  v_phone_norm TEXT;
  v_org_id     UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_lead_id    UUID;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  UPDATE public.leads
  SET call_attempts = 0, updated_at = now()
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR phone_normalized = v_phone_norm OR phone = v_phone)
    AND deleted_at IS NULL
  RETURNING id INTO v_lead_id;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;
  RETURN jsonb_build_object('ok', true, 'lead_id', v_lead_id, 'call_attempts', 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_reset_call_attempts(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_reset_call_attempts(jsonb) TO service_role;

-- ───────── fn_assign_lead ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_assign_lead(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone        TEXT := payload ->> 'phone_e164';
  v_agent_name   TEXT := payload ->> 'agent_name';
  v_phone_norm   TEXT;
  v_org_id       UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_lead_id      UUID;
  v_agent_id     UUID;
  v_actual_name  TEXT;
  v_prev_asesor  TEXT;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;
  IF v_agent_name IS NULL OR length(trim(v_agent_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agent_name missing');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  -- Lookup del asesor por name (case-insensitive exact match) en Stratos.
  SELECT id, name INTO v_agent_id, v_actual_name
  FROM public.profiles
  WHERE organization_id = v_org_id
    AND lower(name) = lower(trim(v_agent_name))
    AND COALESCE(active, true) = true
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'agent not found in profiles',
      'agent_name', v_agent_name,
      'hint', 'usá el name exacto del profile (case-insensitive). Ej: "Gael G"'
    );
  END IF;

  -- Reasignación atómica + capturar el asesor previo en el RETURNING.
  WITH prev AS (
    SELECT id, asesor_name
    FROM public.leads
    WHERE organization_id = v_org_id
      AND (whatsapp_phone_e164 = v_phone OR phone_normalized = v_phone_norm OR phone = v_phone)
      AND deleted_at IS NULL
    LIMIT 1
  ),
  upd AS (
    UPDATE public.leads l
    SET asesor_id = v_agent_id,
        asesor_name = v_actual_name,
        updated_at = now(),
        last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI')
    FROM prev
    WHERE l.id = prev.id
    RETURNING l.id
  )
  SELECT upd.id, prev.asesor_name INTO v_lead_id, v_prev_asesor
  FROM upd, prev;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'asesor_id', v_agent_id,
    'asesor_name', v_actual_name,
    'previous_asesor', v_prev_asesor
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_assign_lead(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_assign_lead(jsonb) TO service_role;
