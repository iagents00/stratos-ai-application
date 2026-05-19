-- ════════════════════════════════════════════════════════════════════════
-- 020 — call_attempts + fn_register_failed_call
-- ────────────────────────────────────────────────────────────────────────
-- Motor de reintentos de llamadas con strike limit (típicamente 3 strikes
-- para casos de buzón / no contesta). n8n llama esta RPC tras cada llamada
-- fallida y decide en base al new_attempts si seguir reintentando o
-- marcar el lead como "buzón persistente" / dropear de la cola.
--
-- Columna call_attempts vive en leads y se incrementa atómicamente vía
-- UPDATE ... RETURNING en la función.
--
-- IMPORTANTE: ya ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Columna en leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS call_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.leads.call_attempts IS
  'Cantidad de intentos de llamada fallidos consecutivos. n8n lo incrementa vía fn_register_failed_call y decide si seguir reintentando (típicamente cap en 3 strikes).';

-- 2) RPC
CREATE OR REPLACE FUNCTION public.fn_register_failed_call(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone        TEXT := payload ->> 'phone_e164';
  v_phone_norm   TEXT;
  v_org_id       UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_lead_id      UUID;
  v_new_attempts INT;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;

  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  -- UPDATE atómico con incremento + RETURNING en la misma query.
  UPDATE public.leads
  SET call_attempts = call_attempts + 1,
      updated_at = now()
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone
         OR phone_normalized = v_phone_norm
         OR phone = v_phone)
    AND deleted_at IS NULL
  RETURNING id, call_attempts
    INTO v_lead_id, v_new_attempts;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'new_attempts', v_new_attempts
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_register_failed_call(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_failed_call(jsonb) TO service_role;
