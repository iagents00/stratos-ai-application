-- 081_wa_conversations_rapida.sql
-- La bandeja de WhatsApp tardaba en cargar: fn_wa_conversations era SECURITY
-- INVOKER → la RLS de whatsapp_messages corría POR FILA (is_lead_asesor = un
-- subquery a leads por cada mensaje) y el window function escaneaba TODA la
-- tabla de mensajes. A más mensajes, peor. Aplicada a prod por MCP.
--
-- v2: SECURITY DEFINER con el MISMO modelo de permisos evaluado UNA sola vez
-- (org + admin/director/ceo/super_admin ven todo; asesor SOLO sus leads —
-- idéntico a la policy wa_messages_select), y el patrón rápido de bandeja:
-- leads visibles → último mensaje por índice (LATERAL ... LIMIT 1) →
-- no-leídos por índice parcial. Verificado con EXPLAIN ANALYZE: ~5ms.
-- Reversible: la versión previa vive en 075.

CREATE INDEX IF NOT EXISTS wa_messages_in_lead_idx
  ON public.whatsapp_messages (lead_id, message_created_at)
  WHERE direction = 'in';

CREATE OR REPLACE FUNCTION public.fn_wa_conversations()
RETURNS TABLE(
  lead_id uuid, lead_name text, lead_phone text, asesor_name text, stage text,
  last_content text, last_direction text, last_sender text,
  last_at timestamptz, unread_count bigint
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH me AS (
    -- Permisos evaluados UNA vez (mismo modelo que la RLS del expediente):
    -- admin/director/ceo/super_admin (o flag view_all_leads) ven toda la org;
    -- el asesor solo los leads asignados a él.
    SELECT current_organization_id() AS org,
           auth.uid()                AS uid,
           (is_admin_or_above() OR can_view_all_leads()) AS see_all
  ),
  leads_visibles AS (
    SELECT l.id, l.name, l.phone, l.asesor_name, l.stage
    FROM public.leads l, me
    WHERE l.organization_id = me.org
      AND l.deleted_at IS NULL
      AND (me.see_all OR l.asesor_id = me.uid)
      -- solo leads que tienen conversación de WhatsApp (probe por índice)
      AND EXISTS (SELECT 1 FROM public.whatsapp_messages m WHERE m.lead_id = l.id)
  )
  SELECT lv.id, lv.name, lv.phone, lv.asesor_name, lv.stage,
         COALESCE(
           NULLIF(lm.content, ''),
           CASE WHEN lm.media IS NOT NULL AND jsonb_array_length(lm.media) > 0
             THEN CASE lm.media->0->>'type'
               WHEN 'image' THEN '📷 Foto'
               WHEN 'audio' THEN '🎤 Audio'
               WHEN 'video' THEN '🎬 Video'
               ELSE '📎 Archivo' END
             ELSE '' END
         ),
         lm.direction, lm.sender_name, lm.message_created_at,
         COALESCE(u.c, 0)
  FROM leads_visibles lv
  -- último mensaje: un salto de índice (lead_id, message_created_at) por lead
  CROSS JOIN LATERAL (
    SELECT m.content, m.media, m.direction, m.sender_name, m.message_created_at
    FROM public.whatsapp_messages m
    WHERE m.lead_id = lv.id
    ORDER BY m.message_created_at DESC
    LIMIT 1
  ) lm
  -- no-leídos del usuario actual: rango de índice parcial (solo 'in')
  LEFT JOIN LATERAL (
    SELECT count(*) AS c
    FROM public.whatsapp_messages m
    WHERE m.lead_id = lv.id
      AND m.direction = 'in'
      AND m.message_created_at > COALESCE(
        (SELECT r.last_read_at FROM public.whatsapp_reads r
         WHERE r.lead_id = lv.id AND r.user_id = auth.uid()),
        'epoch'::timestamptz)
  ) u ON true
  ORDER BY lm.message_created_at DESC
  LIMIT 200;
$$;

-- Mismos grants de siempre: solo usuarios logueados; nunca anon.
REVOKE ALL ON FUNCTION public.fn_wa_conversations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_conversations() TO authenticated, service_role;
