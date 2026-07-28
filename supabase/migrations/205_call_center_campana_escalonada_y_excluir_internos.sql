-- ════════════════════════════════════════════════════════════════════════
-- 205 — Call Center: encolar una campaña ESCALONADA + sacar los internos
-- ────────────────────────────────────────────────────────────────────────
-- Por qué escalonada: fn_get_pending_calls reclama de un saque TODAS las
-- filas vencidas y el flujo 04 las separa en items → N POST simultáneos a
-- Retell. Encolar 150 con la misma hora = 150 teléfonos sonando a la vez
-- desde el mismo número: choca con el límite de concurrencia y quema la
-- reputación del número saliente. Por eso se reparten en el tiempo.
--
-- dry_run = true por defecto: hay que pedir explícitamente que inserte.
-- Revertir una campaña ya encolada (lo que todavía no salió):
--   update scheduled_calls set status='cancelled'
--    where status='pending' and organization_id='00000000-...-0001';
--
-- ⚠️ El UPDATE del final de este archivo NO funcionó como estaba escrito
--    (comparaba contra dígitos crudos en vez de la forma canónica) — lo
--    corrige la migración 206. Se deja tal cual se aplicó, por historia.
-- ════════════════════════════════════════════════════════════════════════

-- ───────── quiénes entran, en el orden del CRM (de abajo hacia arriba) ──
-- El CRM ordena por fecha de ingreso DESC (los más nuevos arriba), así que
-- "de abajo hacia arriba" = del más viejo al más nuevo.
-- (esta firma la reemplaza la 207, que agrega nombre_para_ana)
CREATE OR REPLACE FUNCTION public.fn_pick_campaign_leads(
  p_asesor_id UUID,
  p_stage     TEXT DEFAULT 'Contáctame Ya',
  p_limit     INT  DEFAULT 10,
  p_offset    INT  DEFAULT 0
)
RETURNS TABLE (pos BIGINT, lead_id UUID, nombre TEXT, canon TEXT, ingreso TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  WITH elegibles AS (
    SELECT DISTINCT ON (public.fn_phone_canon(coalesce(l.voice_phone_e164,
             l.whatsapp_phone_e164, l.phone_normalized, l.phone)))
           l.id,
           l.name,
           public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                          l.phone_normalized, l.phone)) AS canon,
           l.created_at
    FROM public.leads l
    WHERE l.organization_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND l.asesor_id  = p_asesor_id
      AND l.stage      = p_stage
      AND l.deleted_at IS NULL
      AND COALESCE(l.do_not_contact, false) = false
      AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                         l.phone_normalized, l.phone)) IS NOT NULL
    ORDER BY public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                            l.phone_normalized, l.phone)),
             l.created_at ASC
  ),
  sin_encolar AS (
    SELECT e.*
    FROM elegibles e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.scheduled_calls sc
      WHERE sc.organization_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND sc.status = 'pending'
        AND public.fn_phone_canon(sc.phone_e164) = e.canon
    )
  ),
  numerados AS (
    SELECT row_number() OVER (ORDER BY created_at ASC) AS pos,
           id, name, canon, created_at
    FROM sin_encolar
  )
  SELECT pos, id, name, canon, created_at
  FROM numerados
  WHERE pos > p_offset AND pos <= p_offset + p_limit
  ORDER BY pos;
$fn$;

COMMENT ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) IS
  'Leads llamables de un asesor en una etapa, del más viejo al más nuevo (= de abajo hacia arriba en el CRM). Excluye borrados, do_not_contact, sin teléfono y los ya encolados.';

-- ───────── encolar la campaña, repartida en el tiempo ───────────────────
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
  v_spacing  INT         := COALESCE(NULLIF(payload ->> 'spacing_seconds', '')::INT, 50);
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
             'pos', p.pos, 'nombre', p.nombre, 'phone_e164', '+' || p.canon,
             'ingreso', p.ingreso,
             'programada', v_start_at + ((p.pos - 1 - v_offset) * v_spacing) * INTERVAL '1 second'
           ) ORDER BY p.pos), count(*)
      INTO v_rows, v_n
      FROM public.fn_pick_campaign_leads(v_asesor, v_stage, v_limit, v_offset) p;

    RETURN jsonb_build_object('ok', true, 'dry_run', true,
                              'count', COALESCE(v_n, 0),
                              'calls', COALESCE(v_rows, '[]'::jsonb));
  END IF;

  WITH ins AS (
    INSERT INTO public.scheduled_calls (phone_e164, organization_id, scheduled_at)
    SELECT '+' || p.canon, v_org_id,
           v_start_at + ((p.pos - 1 - v_offset) * v_spacing) * INTERVAL '1 second'
    FROM public.fn_pick_campaign_leads(v_asesor, v_stage, v_limit, v_offset) p
    RETURNING id, phone_e164, scheduled_at
  )
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.scheduled_at), count(*)
    INTO v_rows, v_n
    FROM ins i;

  RETURN jsonb_build_object('ok', true, 'dry_run', false,
                            'count', COALESCE(v_n, 0),
                            'calls', COALESCE(v_rows, '[]'::jsonb));
END;
$fn$;

COMMENT ON FUNCTION public.fn_queue_campaign_calls(jsonb) IS
  'Encola una campaña de llamadas repartida en el tiempo (spacing_seconds entre cada una). dry_run=true por defecto: hay que pedir explícitamente que inserte.';

REVOKE ALL ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_queue_campaign_calls(jsonb)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_queue_campaign_calls(jsonb)               TO service_role;

-- ───────── sacar los números internos de Duke de cualquier campaña ──────
-- No son prospectos: son el gerente de ventas, el administrativo, la propia
-- empresa y (casi seguro) el propio asesor. Estaban dentro de los 150 y el
-- agente de voz los habría llamado. Reversible: do_not_contact = false.
-- ⚠️ Este UPDATE tocó 0 filas — ver la nota del encabezado y la migración 206.
UPDATE public.leads
SET do_not_contact = true, updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::UUID
  AND deleted_at IS NULL
  AND public.fn_phone_canon(coalesce(voice_phone_e164, whatsapp_phone_e164,
                                     phone_normalized, phone)) IN (
        '5219848770028',  -- Emmanuel Ortiz — Gerente de Ventas de Duke
        '5219848041787',  -- Alexander Administrativo Duke Del Caribe
        '5219842181660',  -- El Duke De Caribe (la empresa)
        '5219841539408',  -- Gael Velasco (el propio asesor)
        '5219841658649'   -- Administración Duke Del Caribe
      );
