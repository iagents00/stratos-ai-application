-- ============================================================================
-- 072: Fixes de la revisión adversarial del chat WhatsApp
-- ----------------------------------------------------------------------------
-- (1) fn_wa_outbox_retry: re-encola una fila 'failed' (o atascada en
--     pending/sending >60s) para que el reintento desde el CRM FUNCIONE.
--     Antes: el botón "reintentar" era un no-op (claim exige 'pending').
--     Ejecutable por authenticated PERO con guardas de org/visibilidad
--     equivalentes a la RLS (la función es SECURITY DEFINER).
-- (2) fn_chatwoot_cecilia_event: backfill de mensajes espejados que quedaron
--     huérfanos (lead_id NULL) cuando el saliente llegó antes de existir el
--     lead — al upsertar el lead, adopta los mensajes de su conversación.
-- Aplicada en prod el 2026-07-08 vía MCP. Este archivo la versiona.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_wa_outbox_retry(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.whatsapp_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.whatsapp_outbox WHERE id = p_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  -- Guardas equivalentes a la RLS (SECURITY DEFINER la saltaría):
  IF v_row.organization_id IS DISTINCT FROM current_organization_id() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF NOT (is_admin_or_above() OR can_view_all_leads()
          OR is_lead_asesor(v_row.lead_id) OR v_row.created_by = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Solo re-encolar lo re-encolable: failed, o atascado >60s sin cerrar.
  IF NOT (v_row.status = 'failed'
          OR (v_row.status IN ('pending','sending')
              AND v_row.updated_at < now() - interval '60 seconds')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_retryable', 'status', v_row.status);
  END IF;

  UPDATE public.whatsapp_outbox
  SET status = 'pending', error = NULL, updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_wa_outbox_retry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_outbox_retry(uuid) TO authenticated;

-- Despachadora con backfill de huérfanos
CREATE OR REPLACE FUNCTION public.fn_chatwoot_cecilia_event(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_msg_type text := payload ->> 'message_type';
  v_upsert   jsonb := NULL;
  v_record   jsonb;
  v_lead_id  uuid;
  v_conv_id  integer := NULLIF(payload #>> '{conversation,id}','')::integer;
  v_adopted  integer := 0;
BEGIN
  IF v_msg_type = 'incoming' THEN
    v_upsert := public.fn_upsert_lead_from_chatwoot_asesor(payload, 'Cecilia Mendoza');
    v_lead_id := NULLIF(v_upsert ->> 'lead_id','')::uuid;
    -- Backfill: mensajes de esta conversación que quedaron sin lead
    -- (ej. salientes espejados antes de que existiera el lead).
    IF v_lead_id IS NOT NULL AND v_conv_id IS NOT NULL THEN
      UPDATE public.whatsapp_messages
      SET lead_id = v_lead_id
      WHERE lead_id IS NULL AND chatwoot_conversation_id = v_conv_id;
      GET DIAGNOSTICS v_adopted = ROW_COUNT;
    END IF;
  END IF;
  v_record := public.fn_record_whatsapp_message(payload);
  RETURN jsonb_build_object('ok', true, 'upsert', v_upsert, 'record', v_record, 'adopted_orphans', v_adopted);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_chatwoot_cecilia_event(jsonb) FROM PUBLIC, anon, authenticated;
