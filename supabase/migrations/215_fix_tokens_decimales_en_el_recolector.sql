-- ════════════════════════════════════════════════════════════════════════
-- 215 — El promedio de tokens de Retell viene con decimales
-- ────────────────────────────────────────────────────────────────────────
-- llm_token_usage.average llega como "6188.666666666667" y el cast directo
-- a INT revienta ("invalid input syntax for type integer"). Eso hacía fallar
-- TODO el recolector de resultados: ninguna llamada cerraba, así que no se
-- veía ni el costo ni el resultado de la campaña. Se detectó al correrlo.
-- También se baja el reintento de 10 min a 2 min para que los resultados
-- entren mientras la campaña corre, no una hora después.
-- ════════════════════════════════════════════════════════════════════════

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
    CONTINUE WHEN COALESCE(j ->> 'call_status', '') = 'ongoing';

    UPDATE public.scheduled_calls
    SET outcome          = COALESCE(NULLIF(j ->> 'disconnection_reason', ''),
                                    j ->> 'call_status', 'desconocido'),
        duration_seconds = COALESCE((j ->> 'duration_ms')::NUMERIC / 1000, 0)::INT,
        cost_cents       = (j #>> '{call_cost,combined_cost}')::NUMERIC,
        -- average llega con decimales: NUMERIC primero, round después
        llm_tokens       = round(COALESCE((j #>> '{llm_token_usage,average}')::NUMERIC, 0)
                                 * COALESCE((j #>> '{llm_token_usage,num_requests}')::NUMERIC, 1))::INT,
        updated_at       = now()
    WHERE id = fila.id;

    IF fila.lead_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.voice_call_logs
                       WHERE call_id = fila.retell_call_id) THEN
      INSERT INTO public.voice_call_logs
        (call_id, lead_id, organization_id, direction, duration_seconds,
         call_summary, transcript, recording_url, disconnection_reason)
      VALUES
        (fila.retell_call_id, fila.lead_id, fila.organization_id, 'outbound',
         COALESCE((j ->> 'duration_ms')::NUMERIC / 1000, 0)::INT,
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

CREATE OR REPLACE FUNCTION public.fn_fetch_call_outcomes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_key TEXT; fila RECORD; v_req BIGINT; v_n INT := 0;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'RETELL_API_KEY';
  IF v_key IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'falta RETELL_API_KEY'); END IF;
  FOR fila IN
    SELECT id, retell_call_id FROM public.scheduled_calls
    WHERE retell_call_id IS NOT NULL AND outcome IS NULL
      AND attempted_at < now() - INTERVAL '60 seconds'
      AND (outcome_req_id IS NULL OR outcome_at < now() - INTERVAL '2 minutes')
    ORDER BY attempted_at LIMIT 25
  LOOP
    v_req := net.http_get(url := 'https://api.retellai.com/v2/get-call/' || fila.retell_call_id,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key),
      timeout_milliseconds := 15000);
    UPDATE public.scheduled_calls SET outcome_req_id = v_req, outcome_at = now() WHERE id = fila.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'consultadas', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_collect_call_outcomes() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_fetch_call_outcomes()   FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_collect_call_outcomes() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_fetch_call_outcomes()   TO service_role;
