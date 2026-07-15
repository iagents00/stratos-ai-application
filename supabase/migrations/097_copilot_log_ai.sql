-- Migración: funciones auxiliares para el Copilot CRM
-- Permite al n8n flow guardar respuestas del AI en tg_bot_activity
-- usando la anon key de stratos-prod (sin necesidad de service_role).

-- Guarda una respuesta del AI en tg_bot_activity
CREATE OR REPLACE FUNCTION public.copilot_log_ai(
  p_telegram_chat_id bigint,
  p_content text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.tg_bot_activity (telegram_chat_id, role, content, occurred_at)
  VALUES (p_telegram_chat_id, 'ai', p_content, now());
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Guarda un mensaje del usuario en tg_bot_activity
CREATE OR REPLACE FUNCTION public.copilot_log_user(
  p_text text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_chat_id bigint;
BEGIN
  SELECT telegram_chat_id INTO v_chat_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_chat_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.tg_bot_activity (telegram_chat_id, role, content, occurred_at)
  VALUES (v_chat_id, 'user', p_text, now());
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
