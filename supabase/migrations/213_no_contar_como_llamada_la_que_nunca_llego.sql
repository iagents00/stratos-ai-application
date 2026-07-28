-- ════════════════════════════════════════════════════════════════════════
-- 213 — Una llamada que nunca llegó a Retell no cuenta como llamada
-- ────────────────────────────────────────────────────────────────────────
-- Las 3 pruebas de las 21:28 quedaron 'completed' porque la cola las dio por
-- despachadas, pero Retell nunca las recibió (no tienen retell_call_id y en
-- el historial de la cuenta no existen). El enfriamiento de 30 días de la
-- migración 209 las estaba tratando como "ya contactadas" → esas 3 personas
-- se quedaban sin llamar para siempre.
--
-- Dos arreglos:
--   1. Esas filas fantasma pasan a 'cancelled' con el motivo escrito.
--   2. El enfriamiento ahora exige PRUEBA de que la llamada existió
--      (retell_call_id) para las filas nativas. Una que falló se puede
--      reintentar; una que de verdad sonó, no.
-- Revertir: volver a la condición de la 209.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.scheduled_calls
SET status          = 'cancelled',
    dispatch_status = 'nunca_llego_a_retell',
    dispatch_error  = 'Despachada por el flujo 04 de n8n pero ausente del historial de Retell. El lead vuelve a la lista.',
    updated_at      = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::UUID
  AND status          = 'completed'
  AND attempted_at   >= current_date
  AND retell_call_id IS NULL
  AND dispatch_status IS NULL;

CREATE OR REPLACE FUNCTION public.fn_pick_campaign_leads(
  p_asesor_id UUID,
  p_stage     TEXT DEFAULT 'Contáctame Ya',
  p_limit     INT  DEFAULT 10,
  p_offset    INT  DEFAULT 0
)
RETURNS TABLE (pos BIGINT, lead_id UUID, nombre_en_crm TEXT, nombre_para_ana TEXT,
               canon TEXT, ingreso TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  WITH elegibles AS (
    SELECT DISTINCT ON (public.fn_phone_canon(coalesce(l.voice_phone_e164,
             l.whatsapp_phone_e164, l.phone_normalized, l.phone)))
           l.id, l.name,
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
    SELECT e.* FROM elegibles e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.scheduled_calls sc
      WHERE sc.organization_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND public.fn_phone_canon(sc.phone_e164) = e.canon
        AND (
              sc.status = 'pending'                       -- ya está en cola
           OR (sc.status = 'completed'                    -- y solo si REALMENTE sonó:
               AND sc.attempted_at > now() - INTERVAL '30 days'
               AND (sc.retell_call_id IS NOT NULL         --   prueba de que existió
                 OR sc.attempted_at < current_date))      --   o es de antes de este sistema
        )
    )
  ),
  numerados AS (
    SELECT row_number() OVER (ORDER BY created_at ASC) AS pos,
           id, name, canon, created_at
    FROM sin_encolar
  )
  SELECT pos, id, name,
         COALESCE(public.fn_clean_lead_name(name), 'Cliente'),
         canon, created_at
  FROM numerados
  WHERE pos > p_offset AND pos <= p_offset + p_limit
  ORDER BY pos;
$fn$;

COMMENT ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) IS
  'Leads llamables de un asesor en una etapa, del más viejo al más nuevo (= de abajo hacia arriba en el CRM). Excluye borrados, do_not_contact, sin teléfono, los ya encolados y los que REALMENTE se llamaron en los últimos 30 días (con retell_call_id como prueba).';

REVOKE ALL ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) TO service_role;
