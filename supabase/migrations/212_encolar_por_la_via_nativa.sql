-- ════════════════════════════════════════════════════════════════════════
-- 212 — La campaña se encola por la vía NATIVA
-- ────────────────────────────────────────────────────────────────────────
-- fn_queue_campaign_calls insertaba sin `source`, así que las filas caían en
-- 'n8n_legacy' — la vía que está rota. Ahora nacen 'stratos_native' y las
-- atiende fn_dispatch_due_calls, que sí llega a Retell y además deja escrito
-- si la llamada se creó o falló.
-- Revertir: quitar el source del INSERT.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_queue_campaign_calls(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id   UUID        := '00000000-0000-0000-0000-000000000001'::UUID;
  v_asesor   UUID        := NULLIF(payload ->> 'asesor_id', '')::UUID;
  v_stage    TEXT        := COALESCE(NULLIF(payload ->> 'stage', ''), 'Contáctame Ya');
  v_limit    INT         := COALESCE(NULLIF(payload ->> 'limit', '')::INT, 3);
  v_offset   INT         := COALESCE(NULLIF(payload ->> 'offset', '')::INT, 0);
  v_spacing  INT         := COALESCE(NULLIF(payload ->> 'spacing_seconds', '')::INT, 60);
  v_start_at TIMESTAMPTZ := COALESCE(NULLIF(payload ->> 'start_at', '')::TIMESTAMPTZ, now());
  v_dry_run  BOOLEAN     := COALESCE((payload ->> 'dry_run')::BOOLEAN, true);
  v_rows     jsonb;
  v_n        INT;
BEGIN
  IF v_asesor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'asesor_id requerido');
  END IF;
  IF v_limit < 1 OR v_limit > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'limit fuera de rango (1-500)');
  END IF;
  IF v_spacing < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'spacing_seconds mínimo 10 (evita la estampida)');
  END IF;

  IF v_dry_run THEN
    SELECT jsonb_agg(jsonb_build_object(
             'pos',             p.pos,
             'nombre_en_crm',   p.nombre_en_crm,
             'nombre_para_ana', p.nombre_para_ana,
             'phone_e164',      '+' || p.canon,
             'ingreso',         p.ingreso,
             'programada',      v_start_at + ((p.pos - 1 - v_offset) * v_spacing) * INTERVAL '1 second'
           ) ORDER BY p.pos), count(*)
      INTO v_rows, v_n
      FROM public.fn_pick_campaign_leads(v_asesor, v_stage, v_limit, v_offset) p;

    RETURN jsonb_build_object('ok', true, 'dry_run', true,
                              'count', COALESCE(v_n, 0),
                              'calls', COALESCE(v_rows, '[]'::jsonb));
  END IF;

  WITH ins AS (
    INSERT INTO public.scheduled_calls
      (phone_e164, organization_id, scheduled_at, source, lead_id)
    SELECT '+' || p.canon, v_org_id,
           v_start_at + ((p.pos - 1 - v_offset) * v_spacing) * INTERVAL '1 second',
           'stratos_native', p.lead_id
    FROM public.fn_pick_campaign_leads(v_asesor, v_stage, v_limit, v_offset) p
    RETURNING id, phone_e164, scheduled_at
  )
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.scheduled_at), count(*)
    INTO v_rows, v_n
    FROM ins i;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'via', 'stratos_native',
                            'count', COALESCE(v_n, 0),
                            'calls', COALESCE(v_rows, '[]'::jsonb));
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_queue_campaign_calls(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_queue_campaign_calls(jsonb) TO service_role;
