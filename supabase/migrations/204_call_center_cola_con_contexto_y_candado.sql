-- ════════════════════════════════════════════════════════════════════════
-- 204 — Call Center: la cola de llamadas sale CON contexto, normalizada
--        y con candado de "no contactar"
-- ────────────────────────────────────────────────────────────────────────
-- Problema que resuelve (verificado 2026-07-28):
--   fn_get_pending_calls() devolvía SOLO el teléfono. El nodo de n8n
--   "API: Llamar Retell (Programada)" (flujo 04 - CRON Motor de Seguimiento,
--   w9rBYHI81ToFXMzf) espera además full_name, pipeline_stage, tiene_meet,
--   fecha_meet, hubo_llamada_previa, resumen_llamada_previa y discovery.*
--   → Ana llamaba diciendo "Cliente" y varias variables viajaban como
--   "undefined". Servía para llamadas sueltas de re-agendamiento, no para
--   una campaña.
--
-- Además:
--   · Los teléfonos de leads viejos no tienen "+" (91 de 150 en la etapa
--     "Contáctame Ya" de Gael) y ni fn_schedule_call ni el nodo de Retell
--     los normalizaban.
--   · El dedupe de fn_schedule_call comparaba strings crudos, así que
--     "+521..." y "521..." se encolaban dos veces.
--   · No había ningún candado real contra do_not_contact: un prompt no es
--     una capa de seguridad, la capa es que técnicamente no se pueda marcar.
--
-- Todo es aditivo: se agregan campos al JSON de salida, no se quita ninguno.
-- Revertir = volver a las definiciones de la migración 018.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── helper: forma canónica de un teléfono ────────────────────────
-- Solo dígitos. Caso especial México: el 521XXXXXXXXXX de WhatsApp y el
-- 52XXXXXXXXXX de telefonía son la misma persona (el nodo de Retell ya hacía
-- ese replace a mano). IMMUTABLE para poder indexarla.
CREATE OR REPLACE FUNCTION public.fn_phone_canon(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
           WHEN s.d IS NULL OR length(s.d) < 7 THEN NULL
           WHEN length(s.d) = 13 AND left(s.d, 3) = '521' THEN '52' || right(s.d, 10)
           ELSE s.d
         END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') AS d) s;
$fn$;

COMMENT ON FUNCTION public.fn_phone_canon(text) IS
  'Teléfono a forma canónica (solo dígitos, 521->52 para México). Para comparar teléfonos entre leads y scheduled_calls sin importar el formato.';

CREATE INDEX IF NOT EXISTS leads_phone_canon_idx
  ON public.leads (public.fn_phone_canon(
       coalesce(voice_phone_e164, whatsapp_phone_e164, phone_normalized, phone)));

-- ───────── fn_schedule_call v2 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_schedule_call(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_canon        TEXT;
  v_phone        TEXT;
  v_scheduled_at TIMESTAMPTZ := NULLIF(payload ->> 'scheduled_at', '')::TIMESTAMPTZ;
  v_org_id       UUID        := '00000000-0000-0000-0000-000000000001'::UUID;
  v_existing_id  UUID;
  v_id           UUID;
BEGIN
  v_canon := public.fn_phone_canon(payload ->> 'phone_e164');
  IF v_canon IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;
  v_phone := '+' || v_canon;

  IF v_scheduled_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'scheduled_at missing or invalid');
  END IF;

  -- Candado duro: si el lead está marcado "no contactar", no se encola. Punto.
  IF EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.organization_id = v_org_id
      AND l.do_not_contact IS TRUE
      AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                         l.phone_normalized, l.phone)) = v_canon
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead marcado do_not_contact',
                              'phone_e164', v_phone);
  END IF;

  -- Dedupe por forma canónica (antes comparaba el string crudo).
  SELECT id INTO v_existing_id
  FROM public.scheduled_calls
  WHERE organization_id = v_org_id
    AND status = 'pending'
    AND public.fn_phone_canon(phone_e164) = v_canon
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.scheduled_calls
    SET scheduled_at = v_scheduled_at, phone_e164 = v_phone, updated_at = now()
    WHERE id = v_existing_id;
    RETURN jsonb_build_object('ok', true, 'id', v_existing_id, 'action', 'updated',
                              'phone_e164', v_phone, 'scheduled_at', v_scheduled_at);
  END IF;

  INSERT INTO public.scheduled_calls (phone_e164, organization_id, scheduled_at)
  VALUES (v_phone, v_org_id, v_scheduled_at)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'action', 'created',
                            'phone_e164', v_phone, 'scheduled_at', v_scheduled_at);
END;
$fn$;

-- ───────── fn_get_pending_calls v2 ──────────────────────────────────────
-- (la versión final del enriquecido queda en la 207, que agrega el nombre
--  limpio; acá va la primera pasada tal como se aplicó)
CREATE OR REPLACE FUNCTION public.fn_get_pending_calls()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id  UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_calls   jsonb;
  v_blocked INT  := 0;
BEGIN
  -- 0) Candado: cancela (no deja pendientes para siempre) las filas cuyo lead
  --    esté marcado do_not_contact. Corre ANTES del reclamo, en su propia
  --    sentencia, así el reclamo ya no las ve.
  WITH bloqueadas AS (
    UPDATE public.scheduled_calls sc
    SET status = 'cancelled', updated_at = now()
    WHERE sc.status = 'pending'
      AND sc.organization_id = v_org_id
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.organization_id = v_org_id
          AND l.do_not_contact IS TRUE
          AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                             l.phone_normalized, l.phone))
              = public.fn_phone_canon(sc.phone_e164)
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_blocked FROM bloqueadas;

  -- 1) Reclamo atómico + enriquecido con el contexto que espera el agente.
  WITH claimed AS (
    UPDATE public.scheduled_calls
    SET status = 'completed', attempted_at = now(), updated_at = now()
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND organization_id = v_org_id
    RETURNING id, phone_e164, scheduled_at, created_at, attempted_at
  ),
  enriched AS (
    SELECT
      c.id, c.phone_e164, c.scheduled_at, c.created_at, c.attempted_at,
      ld.id                                                    AS lead_id,
      COALESCE(NULLIF(btrim(ld.name), ''), 'Cliente')           AS full_name,
      COALESCE(NULLIF(btrim(ld.stage), ''), 'Perfilamiento')    AS pipeline_stage,
      CASE WHEN ld.selected_time IS NOT NULL
             OR COALESCE(ld.zoom_join_url, '') <> '' THEN 'si' ELSE 'no' END AS tiene_meet,
      COALESCE(to_char(ld.selected_time AT TIME ZONE 'America/Cancun',
                       'DD/MM/YYYY HH24:MI'), '')               AS fecha_meet,
      CASE WHEN vc.call_summary IS NOT NULL THEN 'si' ELSE 'no' END AS hubo_llamada_previa,
      COALESCE(vc.call_summary, '')                             AS resumen_llamada_previa,
      COALESCE(dd.data, '{}'::jsonb)                            AS discovery
    FROM claimed c
    LEFT JOIN LATERAL (
      SELECT l.* FROM public.leads l
      WHERE l.organization_id = v_org_id
        AND l.deleted_at IS NULL
        AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                           l.phone_normalized, l.phone))
            = public.fn_phone_canon(c.phone_e164)
      ORDER BY l.updated_at DESC NULLS LAST
      LIMIT 1
    ) ld ON TRUE
    LEFT JOIN LATERAL (
      SELECT v.call_summary FROM public.voice_call_logs v
      WHERE v.lead_id = ld.id AND COALESCE(v.call_summary, '') <> ''
      ORDER BY v.created_at DESC
      LIMIT 1
    ) vc ON TRUE
    LEFT JOIN public.discovery_data dd ON dd.lead_id = ld.id
  )
  SELECT jsonb_agg(to_jsonb(e)) INTO v_calls FROM enriched e;

  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(jsonb_array_length(v_calls), 0),
    'blocked_do_not_contact', v_blocked,
    'calls', COALESCE(v_calls, '[]'::jsonb)
  );
END;
$fn$;

COMMENT ON FUNCTION public.fn_get_pending_calls() IS
  'Reclama las llamadas vencidas y las devuelve CON el contexto que el agente de voz necesita (nombre, etapa, zoom, resumen de la llamada previa y discovery). Cancela primero las de leads con do_not_contact.';

REVOKE ALL ON FUNCTION public.fn_schedule_call(jsonb)    FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_get_pending_calls()     FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_schedule_call(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_pending_calls()  TO service_role;
