-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 010
-- Confirmar / cancelar la ultima accion pendiente desde NLU
--
-- Permite que el asesor responda "si" / "ok" / "dale" en lugar de
-- tener que tocar el boton inline [Sí, registrar]. El AI Agent
-- mapea esas palabras a tool_name='confirm_last' (o 'cancel_last')
-- y el dispatcher ejecuta la ultima pending action sin necesidad
-- del HMAC token del callback.
--
-- Cambios:
--   1. RPC bot_confirm_latest_pending(chat_id) — busca la ultima
--      pending no consumida y la ejecuta via _bot_execute_pending.
--   2. RPC bot_cancel_latest_pending(chat_id) — marca como consumida
--      sin ejecutar.
--   3. bot_nlu_dispatch extendido: 'confirm_last' y 'cancel_last'
--      como tools nuevos.
--
-- El system prompt del AI Agent en n8n debe actualizarse al v5
-- (n8n/system-prompt-asesor-v5.md) para que reconozca las palabras
-- de confirmacion.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bot_confirm_latest_pending(p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token
  FROM public.bot_pending_actions
  WHERE telegram_chat_id = p_telegram_chat_id
    AND consumed_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'no_pending',
      'reply', jsonb_build_object(
        'text', 'No tienes nada pendiente de confirmar. Dime que necesitas.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  END IF;

  RETURN public._bot_execute_pending(p_telegram_chat_id, v_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_cancel_latest_pending(p_telegram_chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.bot_pending_actions
  SET consumed_at = now()
  WHERE id = (
    SELECT id FROM public.bot_pending_actions
    WHERE telegram_chat_id = p_telegram_chat_id
      AND consumed_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'no_pending',
      'reply', jsonb_build_object(
        'text', 'No habia nada que cancelar.',
        'parse_mode', null,
        'inline_keyboard', public._bot_kb_back()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reply', jsonb_build_object(
      'text', 'Cancelado. No se hizo ningun cambio.',
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_back()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_confirm_latest_pending(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_cancel_latest_pending(bigint)  TO service_role;

-- bot_nlu_dispatch ya fue actualizado con 'confirm_last' y 'cancel_last'.
-- Ver el cuerpo completo de la funcion en pg_proc para referencia.

NOTIFY pgrst, 'reload schema';
