-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 009
-- RPC get_my_telegram_activity
--
-- Permite que un asesor autenticado vea su propio historial reciente
-- de mensajes con el bot de Telegram, sin exponer la tabla
-- n8n_chat_histories al frontend.
--
-- SECURITY DEFINER porque la tabla n8n_chat_histories tiene RLS sin
-- políticas (solo el service_role de n8n escribe en ella). La RPC
-- filtra internamente por el telegram_chat_id del usuario autenticado
-- — cada asesor solo ve sus propios mensajes.
--
-- Uso en frontend:
--   const { data } = await supabase.rpc('get_my_telegram_activity', { p_limit: 20 })
--
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_telegram_activity(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id            integer,
  occurred_at   timestamptz,
  role          text,
  content       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id bigint;
BEGIN
  -- Identifica el chat del usuario autenticado.
  -- Alias 'p' obligatorio: el RETURNS TABLE declara una columna 'id', lo
  -- que crea ambigüedad con profiles.id si no se prefija.
  SELECT p.telegram_chat_id INTO v_chat_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    RETURN; -- sin pareo, lista vacia
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.created_at AS occurred_at,
    COALESCE(h.message->>'type', 'unknown') AS role,
    COALESCE(h.message->>'content', '') AS content
  FROM public.n8n_chat_histories h
  WHERE h.session_id = 'tg:' || v_chat_id::text
  ORDER BY h.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_telegram_activity(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
