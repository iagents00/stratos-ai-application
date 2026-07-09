-- 082_wa_pin_conversaciones.sql
-- Pin de conversaciones en la bandeja de WhatsApp (por usuario) + la lista
-- devuelve `pinned` y ordena pineados primero. Aplicada a prod por MCP.
--
--  • `whatsapp_reads.pinned` — el pin vive en la misma fila por-usuario de las
--    marcas de lectura (cero tablas nuevas; la RLS existente ya la protege:
--    cada quien ve/edita SOLO su fila).
--  • `fn_wa_toggle_pin(lead)` — voltea el pin. Si la fila no existe todavía,
--    la crea con last_read_at='epoch' para que PINEAR NO MARQUE LEÍDO (el
--    contador de no-leídos queda intacto).
--  • `fn_wa_conversations()` — v3: agrega la columna `pinned` y ordena
--    pineados → más reciente. DROP+CREATE porque cambiar el RETURNS TABLE no
--    se puede con OR REPLACE (mismo cuerpo rápido de 081, ~5ms; la fila de
--    whatsapp_reads ahora se lee UNA vez por lead y sirve para unread + pin).
--    ⚠ Sigue SECURITY DEFINER — NO volverla INVOKER (081 explica por qué).
-- Reversible: 081 tiene la versión previa de la función; la columna es aditiva.

ALTER TABLE public.whatsapp_reads
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- ── Toggle del pin (SECURITY INVOKER: la RLS de whatsapp_reads manda) ────────
CREATE OR REPLACE FUNCTION public.fn_wa_toggle_pin(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_pinned boolean;
BEGIN
  -- El lead debe EXISTIR y ser VISIBLE para quien pinea (INVOKER: la RLS de
  -- leads filtra sola — asesor solo los suyos). Sin este guard, cualquier
  -- autenticado sembraba filas de whatsapp_reads con UUIDs inventados.
  IF NOT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = p_lead_id AND l.organization_id = current_organization_id()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  -- INSERT con 'epoch': pinear una conversación NUNCA la marca como leída.
  INSERT INTO public.whatsapp_reads (user_id, lead_id, organization_id, last_read_at, pinned)
  VALUES (auth.uid(), p_lead_id, current_organization_id(), 'epoch'::timestamptz, true)
  ON CONFLICT (user_id, lead_id)
    DO UPDATE SET pinned = NOT public.whatsapp_reads.pinned
  RETURNING pinned INTO v_pinned;
  RETURN jsonb_build_object('ok', true, 'pinned', v_pinned);
END;
$$;

-- ── Lista de conversaciones v3 (081 + pinned) ────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_wa_conversations();

CREATE FUNCTION public.fn_wa_conversations()
RETURNS TABLE(
  lead_id uuid, lead_name text, lead_phone text, asesor_name text, stage text,
  last_content text, last_direction text, last_sender text,
  last_at timestamptz, unread_count bigint, pinned boolean
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
         COALESCE(u.c, 0),
         COALESCE(r.pinned, false)
  FROM leads_visibles lv
  -- último mensaje: un salto de índice (lead_id, message_created_at) por lead
  CROSS JOIN LATERAL (
    SELECT m.content, m.media, m.direction, m.sender_name, m.message_created_at
    FROM public.whatsapp_messages m
    WHERE m.lead_id = lv.id
    ORDER BY m.message_created_at DESC
    LIMIT 1
  ) lm
  -- la fila de lectura/pin del usuario: UN lookup por PK, sirve doble
  LEFT JOIN public.whatsapp_reads r
    ON r.lead_id = lv.id AND r.user_id = auth.uid()
  -- no-leídos del usuario actual: rango de índice parcial (solo 'in')
  LEFT JOIN LATERAL (
    SELECT count(*) AS c
    FROM public.whatsapp_messages m
    WHERE m.lead_id = lv.id
      AND m.direction = 'in'
      AND m.message_created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
  ) u ON true
  ORDER BY COALESCE(r.pinned, false) DESC, lm.message_created_at DESC
  LIMIT 200;
$$;

COMMENT ON FUNCTION public.fn_wa_conversations() IS
  'Bandeja de WhatsApp (v3: + pinned). SECURITY DEFINER con el modelo de permisos evaluado una vez — NO volverla INVOKER (ver mig 081).';

-- Mismos grants de siempre: solo usuarios logueados; nunca anon.
REVOKE ALL ON FUNCTION public.fn_wa_conversations()      FROM public, anon;
REVOKE ALL ON FUNCTION public.fn_wa_toggle_pin(uuid)     FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_conversations()   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_wa_toggle_pin(uuid)  TO authenticated, service_role;
