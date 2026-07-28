-- ════════════════════════════════════════════════════════════════════════
-- 207 — El agente de voz saluda con un nombre USABLE
-- ────────────────────────────────────────────────────────────────────────
-- Al verificar la 204 salió esto: el nombre que le llegaba a Ana era
-- "sinombre / GAEL". Sobre los leads llamables de Gael:
--   · 28 traen pegado el sufijo del asesor ("... / GAEL")
--   · 10 son basura ("SN", "sinombre", "Sin Name", "SinNamee")
--   ·  5 son "Cliente Whatsapp 7288"
--   ·  8 traen emojis ("🐝Bee🐝", "Yaya🌅", "🌊Mar🌊")
-- Ana los habría saludado tal cual. Se limpia SOLO en la salida de la cola,
-- sin tocar el dato del CRM (el asesor sigue viendo el nombre como está).
--
-- NOTA sobre el DROP de abajo: fn_pick_campaign_leads se creó en la 205 hace
-- minutos, no guarda datos y todavía no la usa nadie (el flujo de n8n llama a
-- fn_get_pending_calls). Se recrea porque cambia su forma de salida — Postgres
-- no deja hacerlo con CREATE OR REPLACE. No hay pérdida de información.
-- Revertir: volver a COALESCE(NULLIF(btrim(ld.name),''),'Cliente').
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_clean_lead_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
           WHEN s.n IS NULL OR length(s.n) < 2                      THEN NULL
           WHEN s.n ~* '^(sn|s/n|sin ?nombre|sinombre|sin ?namee?|desconocido|test|prueba|n/?a)$' THEN NULL
           WHEN s.n ~* '^cliente\s+whats?app'                        THEN NULL
           ELSE initcap(s.n)
         END
  FROM (
    SELECT btrim(regexp_replace(
             regexp_replace(
               -- 1) fuera el sufijo del asesor pegado al final ("... / GAEL")
               regexp_replace(coalesce(p_name, ''), '\s*/\s*[[:alpha:]]+\s*$', '', 'g'),
               -- 2) fuera emojis y símbolos: solo letras, espacios y . - '
               '[^[:alpha:][:space:]''.-]', '', 'g'),
             -- 3) espacios colapsados
             '\s+', ' ', 'g')) AS n
  ) s;
$fn$;

COMMENT ON FUNCTION public.fn_clean_lead_name(text) IS
  'Nombre del lead listo para que lo pronuncie el agente de voz: sin el sufijo del asesor, sin emojis, capitalizado. NULL si es basura o placeholder (el llamador decide el respaldo).';

-- ───────── la cola usa el nombre limpio ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_get_pending_calls()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id  UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_calls   jsonb;
  v_blocked INT  := 0;
BEGIN
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
      ld.id                                                     AS lead_id,
      COALESCE(public.fn_clean_lead_name(ld.name), 'Cliente')    AS full_name,
      COALESCE(NULLIF(btrim(ld.stage), ''), 'Perfilamiento')     AS pipeline_stage,
      CASE WHEN ld.selected_time IS NOT NULL
             OR COALESCE(ld.zoom_join_url, '') <> '' THEN 'si' ELSE 'no' END AS tiene_meet,
      COALESCE(to_char(ld.selected_time AT TIME ZONE 'America/Cancun',
                       'DD/MM/YYYY HH24:MI'), '')                AS fecha_meet,
      CASE WHEN vc.call_summary IS NOT NULL THEN 'si' ELSE 'no' END AS hubo_llamada_previa,
      COALESCE(vc.call_summary, '')                              AS resumen_llamada_previa,
      COALESCE(dd.data, '{}'::jsonb)                             AS discovery
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

-- ───────── el dry-run muestra lo que Ana va a decir ─────────────────────
DROP FUNCTION IF EXISTS public.fn_pick_campaign_leads(UUID, TEXT, INT, INT);

CREATE FUNCTION public.fn_pick_campaign_leads(
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
        AND sc.status = 'pending'
        AND public.fn_phone_canon(sc.phone_e164) = e.canon
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
  'Leads llamables de un asesor en una etapa, del más viejo al más nuevo (= de abajo hacia arriba en el CRM). Excluye borrados, do_not_contact, sin teléfono y los ya encolados. Muestra el nombre del CRM y el que pronunciará el agente.';

REVOKE ALL ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pick_campaign_leads(UUID, TEXT, INT, INT) TO service_role;
