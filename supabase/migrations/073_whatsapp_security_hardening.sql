-- ============================================================================
-- 073: Endurecimiento de seguridad (hallazgos de la revisión adversarial)
-- ----------------------------------------------------------------------------
-- (1) ALTA: fn_upsert_lead_from_chatwoot_asesor quedó ejecutable por
--     anon/authenticated (SECURITY DEFINER + org de Duke hardcodeada =
--     escritura NO autenticada a prod saltando RLS). Se revoca. n8n la
--     invoca vía fn_chatwoot_cecilia_event con service_role → sigue OK.
--     Mismo endurecimiento a la función base fn_upsert_lead_from_chatwoot
--     (patrón preexistente idéntico; el flujo 01 usa service key → sigue OK).
-- (2) MEDIA: el INSERT del CRM en whatsapp_outbox aceptaba cualquier
--     chatwoot_conversation_id (un asesor podía escribir a conversaciones
--     de otros). Trigger BEFORE INSERT que DERIVA el conversation_id del
--     lead server-side: lo que mande el cliente se ignora/valida.
-- Aplicada en prod el 2026-07-08 vía MCP. Este archivo la versiona.
-- ============================================================================

-- (1) Cerrar EXECUTE de las funciones de escritura de leads
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot_asesor(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot(jsonb)
  FROM PUBLIC, anon, authenticated;

-- (2) Atar el conversation_id de la cola al lead (server-side, inmune al cliente)
CREATE OR REPLACE FUNCTION public.fn_wa_outbox_bind_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conv integer;
BEGIN
  SELECT chatwoot_conversation_id INTO v_conv
  FROM public.leads
  WHERE id = NEW.lead_id AND deleted_at IS NULL;

  IF v_conv IS NULL THEN
    RAISE EXCEPTION 'lead sin conversación de WhatsApp conectada';
  END IF;

  NEW.chatwoot_conversation_id := v_conv;  -- lo del cliente se ignora
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_wa_outbox_bind_conversation ON public.whatsapp_outbox;
CREATE TRIGGER trg_wa_outbox_bind_conversation
  BEFORE INSERT ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.fn_wa_outbox_bind_conversation();
