-- ════════════════════════════════════════════════════════════════════════
-- 214 — Que la campaña se mida en plata y se frene sola
-- ────────────────────────────────────────────────────────────────────────
-- La primera llamada real costó 10.64¢ por 27 segundos ($0.338/min), y el
-- 44% fue el modelo: 7 peticiones al LLM de ~6.195 tokens cada una (el
-- prompt del agente se reenvía entero en cada turno) = ~43.000 tokens para
-- una llamada que no logró nada porque era buzón.
--
-- Desglose real de esa llamada (centavos):
--   gpt_4_1_high_priority 3.04 · llm_token_surcharge 1.60 ·
--   gpt_4_1_text_testing 1.50 (FIJO por llamada) · retell_voice_engine 2.48 ·
--   elevenlabs_tts 1.80 · knowledge_base 0.23
--
-- Sin medición, una campaña de 145 llamadas es un cheque en blanco. Esto
-- agrega tres cosas:
--   1. Cada llamada guarda su resultado, duración, COSTO y tokens.
--   2. Un techo de gasto diario: si se pasa, el marcador deja de marcar
--      solo (no depende de que alguien mire).
--   3. El resultado se escribe en voice_call_logs -> por fin llega al CRM
--      (hasta ahora se iba a la base legacy "duke del caribe").
-- Revertir: cron.unschedule('stratos-call-outcomes') + enabled=false.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.scheduled_calls
  ADD COLUMN IF NOT EXISTS outcome          TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS cost_cents       NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS llm_tokens       INT,
  ADD COLUMN IF NOT EXISTS outcome_req_id   BIGINT,
  ADD COLUMN IF NOT EXISTS outcome_at       TIMESTAMPTZ;

COMMENT ON COLUMN public.scheduled_calls.cost_cents IS
  'Costo real de la llamada en centavos de dólar, según Retell (combined_cost).';
COMMENT ON COLUMN public.scheduled_calls.outcome IS
  'Cómo terminó: user_hangup, agent_hangup, voicemail_reached, dial_no_answer, etc.';

ALTER TABLE public.voice_campaign_config
  ADD COLUMN IF NOT EXISTS max_spend_usd_per_day NUMERIC(10,2) NOT NULL DEFAULT 20.00;

COMMENT ON COLUMN public.voice_campaign_config.max_spend_usd_per_day IS
  'Techo de gasto diario en dólares. Al alcanzarlo, fn_dispatch_due_calls deja de marcar por hoy. Es un freno duro, no un aviso.';

-- ───────── pedirle a Retell cómo terminó cada llamada ───────────────────
CREATE OR REPLACE FUNCTION public.fn_fetch_call_outcomes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_key TEXT;
  fila  RECORD;
  v_req BIGINT;
  v_n   INT := 0;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'RETELL_API_KEY';
  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'falta RETELL_API_KEY en Vault');
  END IF;

  FOR fila IN
    SELECT id, retell_call_id FROM public.scheduled_calls
    WHERE retell_call_id IS NOT NULL
      AND outcome IS NULL
      AND attempted_at < now() - INTERVAL '90 seconds'   -- darle tiempo a que termine
      AND (outcome_req_id IS NULL OR outcome_at < now() - INTERVAL '10 minutes')
    ORDER BY attempted_at
    LIMIT 20
  LOOP
    v_req := net.http_get(
      url     := 'https://api.retellai.com/v2/get-call/' || fila.retell_call_id,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key),
      timeout_milliseconds := 15000);

    UPDATE public.scheduled_calls
    SET outcome_req_id = v_req, outcome_at = now()
    WHERE id = fila.id;

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'consultadas', v_n);
END;
$fn$;

-- ───────── guardar resultado + costo, y mandarlo al CRM ─────────────────
CREATE OR REPLACE FUNCTION public.fn_collect_call_outcomes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  fila RECORD;
  j    jsonb;
  v_n  INT := 0;
BEGIN
  FOR fila IN
    SELECT sc.id, sc.lead_id, sc.organization_id, sc.retell_call_id, r.content
    FROM public.scheduled_calls sc
    JOIN net._http_response r ON r.id = sc.outcome_req_id
    WHERE sc.outcome IS NULL
      AND r.status_code BETWEEN 200 AND 299
      AND r.content IS NOT NULL
  LOOP
    j := fila.content::jsonb;

    -- Solo cuando la llamada ya terminó; si sigue viva, se reintenta luego.
    CONTINUE WHEN COALESCE(j ->> 'call_status', '') = 'ongoing';

    UPDATE public.scheduled_calls
    SET outcome          = COALESCE(NULLIF(j ->> 'disconnection_reason', ''),
                                    j ->> 'call_status', 'desconocido'),
        duration_seconds = COALESCE((j ->> 'duration_ms')::INT / 1000, 0),
        cost_cents       = (j #>> '{call_cost,combined_cost}')::NUMERIC,
        llm_tokens       = (j #>> '{llm_token_usage,average}')::INT
                           * COALESCE((j #>> '{llm_token_usage,num_requests}')::INT, 1),
        updated_at       = now()
    WHERE id = fila.id;

    -- Y al CRM: hasta ahora el resultado se iba a la base legacy.
    IF fila.lead_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.voice_call_logs
                       WHERE call_id = fila.retell_call_id) THEN
      INSERT INTO public.voice_call_logs
        (call_id, lead_id, organization_id, direction, duration_seconds,
         call_summary, transcript, recording_url, disconnection_reason)
      VALUES
        (fila.retell_call_id, fila.lead_id, fila.organization_id, 'outbound',
         COALESCE((j ->> 'duration_ms')::INT / 1000, 0),
         NULLIF(j #>> '{call_analysis,call_summary}', ''),
         NULLIF(j ->> 'transcript', ''),
         NULLIF(j ->> 'recording_url', ''),
         NULLIF(j ->> 'disconnection_reason', ''));
    END IF;

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'cerradas', v_n);
END;
$fn$;

-- ───────── el marcador respeta el techo de gasto ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_dispatch_due_calls()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_key       TEXT;
  cfg         RECORD;
  fila        RECORD;
  v_ctx       jsonb;
  v_req       BIGINT;
  v_gasto_hoy NUMERIC;
  v_enviadas  INT := 0;
  v_blocked   INT := 0;
  v_frenadas  jsonb := '[]'::jsonb;
  v_detalle   jsonb := '[]'::jsonb;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'RETELL_API_KEY';
  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'falta RETELL_API_KEY en Vault');
  END IF;

  FOR cfg IN SELECT * FROM public.voice_campaign_config WHERE enabled IS TRUE LOOP

    WITH bloqueadas AS (
      UPDATE public.scheduled_calls sc
      SET status = 'cancelled', dispatch_status = 'bloqueada_do_not_contact', updated_at = now()
      WHERE sc.status = 'pending'
        AND sc.source = 'stratos_native'
        AND sc.organization_id = cfg.organization_id
        AND EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.organization_id = cfg.organization_id
            AND l.do_not_contact IS TRUE
            AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                               l.phone_normalized, l.phone))
                = public.fn_phone_canon(sc.phone_e164)
        )
      RETURNING 1
    )
    SELECT v_blocked + count(*) INTO v_blocked FROM bloqueadas;

    -- Freno de gasto: lo de hoy, en dólares.
    SELECT COALESCE(sum(cost_cents), 0) / 100.0 INTO v_gasto_hoy
    FROM public.scheduled_calls
    WHERE organization_id = cfg.organization_id
      AND attempted_at >= date_trunc('day', now() AT TIME ZONE cfg.work_tz) AT TIME ZONE cfg.work_tz;

    IF v_gasto_hoy >= cfg.max_spend_usd_per_day THEN
      v_frenadas := v_frenadas || jsonb_build_object('org', cfg.organization_id,
                      'gasto_hoy_usd', round(v_gasto_hoy, 2),
                      'techo_usd', cfg.max_spend_usd_per_day);
      CONTINUE;
    END IF;

    CONTINUE WHEN (now() AT TIME ZONE cfg.work_tz)::time < cfg.work_start
               OR (now() AT TIME ZONE cfg.work_tz)::time > cfg.work_end;

    FOR fila IN
      UPDATE public.scheduled_calls sc
      SET status = 'completed', attempted_at = now(), updated_at = now(),
          dispatch_status = 'enviado'
      WHERE sc.id IN (
        SELECT id FROM public.scheduled_calls
        WHERE status = 'pending' AND source = 'stratos_native'
          AND organization_id = cfg.organization_id AND scheduled_at <= now()
        ORDER BY scheduled_at LIMIT cfg.max_per_tick FOR UPDATE SKIP LOCKED
      )
      RETURNING sc.id, sc.phone_e164
    LOOP
      v_ctx := public.fn_call_context(fila.phone_e164, cfg.organization_id);

      v_req := net.http_post(
        url     := 'https://api.retellai.com/v2/create-phone-call',
        body    := jsonb_build_object(
                     'from_number',                  cfg.from_number,
                     'to_number',                    fila.phone_e164,
                     'override_agent_id',            cfg.agent_id,
                     'retell_llm_dynamic_variables', v_ctx - 'lead_id'),
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key,
                                      'Content-Type',  'application/json'),
        timeout_milliseconds := 15000);

      UPDATE public.scheduled_calls
      SET net_request_id = v_req, lead_id = NULLIF(v_ctx ->> 'lead_id', '')::UUID
      WHERE id = fila.id;

      v_enviadas := v_enviadas + 1;
      v_detalle  := v_detalle || jsonb_build_object('a', fila.phone_e164,
                                                    'nombre', v_ctx ->> 'nombre_cliente');
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'enviadas', v_enviadas,
                            'bloqueadas_do_not_contact', v_blocked,
                            'frenadas_por_gasto', v_frenadas, 'detalle', v_detalle);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_fetch_call_outcomes()   FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_collect_call_outcomes() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_fetch_call_outcomes()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_collect_call_outcomes() TO service_role;

SELECT cron.schedule('stratos-call-outcomes', '* * * * *',
  'SELECT public.fn_fetch_call_outcomes(); SELECT public.fn_collect_call_outcomes();');
