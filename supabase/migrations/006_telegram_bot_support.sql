-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 006: Soporte para el bot de Telegram
--
-- Agrega:
--   • Columna telegram_user_id en leads (para identificar al cliente
--     en futuras conversaciones del bot)
--   • Función append_lead_note: agrega una nota timestamped al lead
--     sin sobrescribir las anteriores. La llama el bot via RPC.
--   • Índice en telegram_user_id para lookup rápido (O(1))
-- ═══════════════════════════════════════════════════════════

-- Columna telegram_user_id
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint;

CREATE INDEX IF NOT EXISTS idx_leads_telegram_user_id
  ON public.leads(telegram_user_id)
  WHERE telegram_user_id IS NOT NULL AND deleted_at IS NULL;

-- Función append_lead_note: agrega una nota con timestamp y fuente
-- al campo `notas` sin perder lo anterior.
CREATE OR REPLACE FUNCTION public.append_lead_note(
  p_lead_id uuid,
  p_note    text,
  p_source  text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timestamp text;
  v_separator text;
  v_new_notas text;
BEGIN
  v_timestamp := to_char(now() AT TIME ZONE 'America/Mexico_City', 'DD Mon HH24:MI');
  v_separator := E'\n\n──── ' || v_timestamp || ' · ' || p_source || ' ────\n';

  UPDATE public.leads
  SET notas = COALESCE(notas, '') || v_separator || p_note,
      last_activity = p_source || ': ' || left(p_note, 60),
      seguimientos = seguimientos + 1
  WHERE id = p_lead_id
  RETURNING notas INTO v_new_notas;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lead not found', 'lead_id', p_lead_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', p_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_lead_note(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
