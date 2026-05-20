-- ════════════════════════════════════════════════════════════════════════
-- 023 — fn_assign_lead: resetear stage a la primera etapa al reasignar
-- ────────────────────────────────────────────────────────────────────────
-- Cuando el call center de IA agota los 3 intentos y hace handoff a un asesor
-- humano (ej: Gael), el lead debe volver a la PRIMERA etapa del pipeline
-- ("Contáctame Ya") para que el asesor lo retome desde el principio del
-- proceso comercial humano.
--
-- Cambio único respecto a la versión previa: el UPDATE ahora también setea
-- stage. Por defecto 'Contáctame Ya' (primera etapa Duke v2); se puede
-- override pasando payload->>'stage'. Pasar "keep_stage": true lo deja igual.
--
-- Scoped a la org Stratos/Duke. service_role only. fn_assign_lead solo lo
-- llama n8n en el flujo de handoff de iAgents, así que esto no toca el resto.
--
-- IMPORTANTE: ejecutada vía MCP en producción. Source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

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
  v_keep_stage   BOOLEAN := COALESCE((payload ->> 'keep_stage')::boolean, false);
  v_stage        TEXT := COALESCE(NULLIF(trim(payload ->> 'stage'), ''), 'Contáctame Ya');
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;
  IF v_agent_name IS NULL OR length(trim(v_agent_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agent_name missing');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  -- Lookup del asesor por name (case-insensitive exact match) en la org Stratos.
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
  -- Al reasignar, el lead vuelve a la primera etapa del pipeline salvo que
  -- se pase keep_stage=true.
  WITH prev AS (
    SELECT id, asesor_name, stage
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
        stage = CASE WHEN v_keep_stage THEN l.stage ELSE v_stage END,
        updated_at = now(),
        last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI')
    FROM prev
    WHERE l.id = prev.id
    RETURNING l.id, l.stage
  )
  SELECT upd.id, prev.asesor_name, upd.stage
  INTO v_lead_id, v_prev_asesor, v_stage
  FROM upd, prev;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone', 'phone', v_phone);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'asesor_id', v_agent_id,
    'asesor_name', v_actual_name,
    'previous_asesor', v_prev_asesor,
    'stage', v_stage
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_assign_lead(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_assign_lead(jsonb) TO service_role;
