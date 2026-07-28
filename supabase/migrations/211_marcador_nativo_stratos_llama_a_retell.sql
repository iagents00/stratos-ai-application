-- ════════════════════════════════════════════════════════════════════════
-- 211 — Stratos marca por Retell sin pasar por n8n
-- ────────────────────────────────────────────────────────────────────────
-- fn_dispatch_due_calls: cada minuto toma las llamadas vencidas de la cola
-- nativa y hace el POST a Retell con pg_net, guardando el id de la petición.
-- fn_collect_call_results: lee la respuesta de Retell y deja escrito si la
-- llamada se creó (con su call_id) o si falló y por qué.
--
-- Eso último es lo que hoy no existía: el flujo de n8n marcaba la fila como
-- 'completed' y nadie se enteraba de que Retell nunca la había recibido.
--
-- Frenos incorporados (que no dependen de que alguien se acuerde):
--   · voice_campaign_config.enabled: interruptor maestro, nace APAGADO.
--   · max_per_tick: techo de llamadas por minuto (1 por defecto).
--   · horario laboral en la zona de la organización.
--   · do_not_contact: se cancela antes de reclamar.
--
-- La llave de Retell vive en Vault (secreto RETELL_API_KEY), nunca en el
-- código ni en un flujo exportado.
--
-- PROBADO EN PRODUCCIÓN 2026-07-28 22:09 UTC: encolada 1 llamada -> el cron
-- la despachó -> Retell devolvió 201 con call_7962f39a6e100bf688f5bfc039f ->
-- la llamada conectó (26 s, agent_hangup) -> fn_collect_call_results dejó
-- dispatch_status='ok' y el call_id guardado.
--
-- Revertir: select cron.unschedule('stratos-call-dispatch') y ('stratos-call-collect'),
--           o simplemente enabled=false.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── el contexto que se le pasa al agente ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_call_context(p_phone_e164 TEXT, p_org_id UUID)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'lead_id',                ld.id,
    'nombre_cliente',         COALESCE(public.fn_clean_lead_name(ld.name), 'Cliente'),
    'etapa_embudo',           COALESCE(NULLIF(btrim(ld.stage), ''), 'Perfilamiento'),
    'tiene_meet',             CASE WHEN ld.selected_time IS NOT NULL
                                     OR COALESCE(ld.zoom_join_url,'') <> '' THEN 'si' ELSE 'no' END,
    'fecha_meet',             COALESCE(to_char(ld.selected_time AT TIME ZONE 'America/Cancun',
                                               'DD/MM/YYYY HH24:MI'), ''),
    'hubo_llamada_previa',    CASE WHEN vc.call_summary IS NOT NULL THEN 'si' ELSE 'no' END,
    'resumen_llamada_previa', COALESCE(replace(replace(vc.call_summary, '"', ''), E'\n', ' '), ''),
    'discovery_zona',         COALESCE(dd.data ->> 'zona', ''),
    'discovery_objetivo',     COALESCE(dd.data ->> 'objetivo', ''),
    'discovery_presupuesto',  COALESCE(dd.data ->> 'presupuesto', ''),
    'discovery_recamaras',    COALESCE(dd.data ->> 'recamaras', ''),
    'motivo_llamada',         'programada',
    'contexto_whatsapp',      ''
  )
  FROM (SELECT 1) dummy
  LEFT JOIN LATERAL (
    SELECT l.* FROM public.leads l
    WHERE l.organization_id = p_org_id
      AND l.deleted_at IS NULL
      AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                         l.phone_normalized, l.phone))
          = public.fn_phone_canon(p_phone_e164)
    ORDER BY l.updated_at DESC NULLS LAST
    LIMIT 1
  ) ld ON TRUE
  LEFT JOIN LATERAL (
    SELECT v.call_summary FROM public.voice_call_logs v
    WHERE v.lead_id = ld.id AND COALESCE(v.call_summary, '') <> ''
    ORDER BY v.created_at DESC LIMIT 1
  ) vc ON TRUE
  LEFT JOIN public.discovery_data dd ON dd.lead_id = ld.id;
$fn$;

-- ───────── el marcador ──────────────────────────────────────────────────
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
  v_enviadas  INT := 0;
  v_blocked   INT := 0;
  v_detalle   jsonb := '[]'::jsonb;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'RETELL_API_KEY';
  IF v_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'falta el secreto RETELL_API_KEY en Vault');
  END IF;

  FOR cfg IN
    SELECT * FROM public.voice_campaign_config WHERE enabled IS TRUE
  LOOP
    -- Candado: nada de do_not_contact, ni siquiera encolado.
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

    -- Fuera de horario: no se marca (las filas esperan).
    CONTINUE WHEN (now() AT TIME ZONE cfg.work_tz)::time < cfg.work_start
               OR (now() AT TIME ZONE cfg.work_tz)::time > cfg.work_end;

    FOR fila IN
      UPDATE public.scheduled_calls sc
      SET status = 'completed', attempted_at = now(), updated_at = now(),
          dispatch_status = 'enviado'
      WHERE sc.id IN (
        SELECT id FROM public.scheduled_calls
        WHERE status = 'pending'
          AND source = 'stratos_native'
          AND organization_id = cfg.organization_id
          AND scheduled_at <= now()
        ORDER BY scheduled_at
        LIMIT cfg.max_per_tick
        FOR UPDATE SKIP LOCKED
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
                     'retell_llm_dynamic_variables', v_ctx - 'lead_id'
                   ),
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key,
                                      'Content-Type',  'application/json'),
        timeout_milliseconds := 15000
      );

      UPDATE public.scheduled_calls
      SET net_request_id = v_req,
          lead_id        = NULLIF(v_ctx ->> 'lead_id', '')::UUID
      WHERE id = fila.id;

      v_enviadas := v_enviadas + 1;
      v_detalle  := v_detalle || jsonb_build_object('id', fila.id, 'a', fila.phone_e164,
                                                    'nombre', v_ctx ->> 'nombre_cliente');
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'enviadas', v_enviadas,
                            'bloqueadas_do_not_contact', v_blocked, 'detalle', v_detalle);
END;
$fn$;

-- ───────── ¿qué contestó Retell? ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_collect_call_results()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ok INT := 0; v_err INT := 0;
BEGIN
  WITH resueltas AS (
    UPDATE public.scheduled_calls sc
    SET dispatch_status = CASE WHEN r.status_code BETWEEN 200 AND 299 THEN 'ok' ELSE 'error' END,
        retell_call_id  = CASE WHEN r.status_code BETWEEN 200 AND 299
                               THEN (r.content::jsonb) ->> 'call_id' END,
        dispatch_error  = CASE WHEN r.status_code BETWEEN 200 AND 299 THEN NULL
                               ELSE left(coalesce(nullif(r.error_msg,''), r.content,
                                                  'HTTP ' || r.status_code), 500) END,
        updated_at      = now()
    FROM net._http_response r
    WHERE sc.net_request_id = r.id
      AND sc.dispatch_status = 'enviado'
    RETURNING sc.dispatch_status AS st
  )
  SELECT count(*) FILTER (WHERE st = 'ok'), count(*) FILTER (WHERE st = 'error')
    INTO v_ok, v_err FROM resueltas;

  RETURN jsonb_build_object('ok', true, 'creadas', v_ok, 'fallidas', v_err);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_call_context(TEXT, UUID)   FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_dispatch_due_calls()       FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_collect_call_results()     FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_due_calls()    TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_collect_call_results()  TO service_role;

-- ───────── el reloj ─────────────────────────────────────────────────────
SELECT cron.schedule('stratos-call-dispatch', '* * * * *', 'SELECT public.fn_dispatch_due_calls();');
SELECT cron.schedule('stratos-call-collect',  '* * * * *', 'SELECT public.fn_collect_call_results();');
