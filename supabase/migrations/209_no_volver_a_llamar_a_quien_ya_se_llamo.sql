-- ════════════════════════════════════════════════════════════════════════
-- 209 — La campaña no repite a quien ya se llamó
-- ────────────────────────────────────────────────────────────────────────
-- fn_pick_campaign_leads excluía solo a los que tenían una llamada en estado
-- 'pending'. Apenas el CRON la despacha pasa a 'completed' y el lead volvía a
-- ser elegible → la siguiente tanda lo llamaba de nuevo. Con las 3 pruebas de
-- hoy ya habría pasado.
-- Ahora hay un enfriamiento de 30 días: si a ese teléfono se le marcó (o se le
-- va a marcar) en los últimos 30 días, no entra.
-- Revertir: quitar la rama del OR con attempted_at.
-- ════════════════════════════════════════════════════════════════════════

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
              sc.status = 'pending'                                       -- ya está en cola
           OR (sc.status = 'completed'                                    -- ya se marcó hace poco
               AND sc.attempted_at > now() - INTERVAL '30 days')
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
  'Leads llamables de un asesor en una etapa, del más viejo al más nuevo (= de abajo hacia arriba en el CRM). Excluye borrados, do_not_contact, sin teléfono, los ya encolados y los llamados en los últimos 30 días.';

REVOKE ALL ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) TO service_role;
