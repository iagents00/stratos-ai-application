-- 269 — Serialize requests and reject ambiguous recovery aliases across organizations.
-- Existing signatures and service_role-only privileges are preserved.
-- PREPARE: busca usuario (email login o recovery_email), rate-limit, invalida previos, guarda hash nuevo.
CREATE OR REPLACE FUNCTION public.fn_recovery_prepare(
  p_email text, p_code_hash text, p_ip text DEFAULT NULL, p_ttl_minutes int DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_uid uuid; v_recovery text; v_name text; v_recent int;
BEGIN
  SELECT p.id, p.recovery_email, p.name INTO v_uid, v_recovery, v_name
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.active IS TRUE AND (
    lower(u.email) = lower(btrim(p_email))
    OR (
      lower(coalesce(p.recovery_email,'')) = lower(btrim(p_email))
      AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email)))
      AND (SELECT count(*) FROM public.profiles a
           WHERE lower(coalesce(a.recovery_email,'')) = lower(btrim(p_email))) = 1
    )
  )
  LIMIT 1;

  IF v_uid IS NULL OR coalesce(v_recovery,'') = '' THEN
    RETURN jsonb_build_object('ok', true, 'sent', false);   -- anti-enumeración
  END IF;

  -- The same user's parallel requests must share the rate limit and leave one code.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 269));
  SELECT count(*) INTO v_recent FROM public.password_reset_codes
  WHERE user_id = v_uid AND created_at > now() - interval '1 hour';
  IF v_recent >= 5 THEN
    RETURN jsonb_build_object('ok', true, 'sent', false, 'reason', 'rate_limited');
  END IF;

  UPDATE public.password_reset_codes SET used = true WHERE user_id = v_uid AND used = false;

  INSERT INTO public.password_reset_codes (user_id, code_hash, expires_at, ip)
  VALUES (v_uid, p_code_hash, now() + make_interval(mins => least(15, greatest(1, p_ttl_minutes))), p_ip);

  RETURN jsonb_build_object('ok', true, 'sent', true, 'recovery_email', v_recovery, 'name', coalesce(v_name,''));
END;
$$;

-- CONFIRM: valida expiración/intentos/hash; si ok marca usado y devuelve user_id.
CREATE OR REPLACE FUNCTION public.fn_recovery_confirm(
  p_email text, p_code_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_uid uuid; v_row public.password_reset_codes%ROWTYPE;
BEGIN
  SELECT p.id INTO v_uid
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.active IS TRUE AND (
    lower(u.email) = lower(btrim(p_email))
    OR (
      lower(coalesce(p.recovery_email,'')) = lower(btrim(p_email))
      AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email)))
      AND (SELECT count(*) FROM public.profiles a
           WHERE lower(coalesce(a.recovery_email,'')) = lower(btrim(p_email))) = 1
    )
  )
  LIMIT 1;

  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 269));
  SELECT * INTO v_row FROM public.password_reset_codes
  WHERE user_id = v_uid AND used = false ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_code'); END IF;

  IF v_row.expires_at <= now() THEN
    UPDATE public.password_reset_codes SET used = true WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  UPDATE public.password_reset_codes SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.attempts + 1 > 5 THEN
    UPDATE public.password_reset_codes SET used = true WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many');
  END IF;

  IF v_row.code_hash = p_code_hash THEN
    UPDATE public.password_reset_codes SET used = true WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'user_id', v_uid);
  END IF;

  RETURN jsonb_build_object('ok', false, 'reason', 'invalid', 'attempts_left', greatest(0, 5 - (v_row.attempts + 1)));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_recovery_prepare(text,text,text,int) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_recovery_prepare(text,text,text,int) TO service_role;
REVOKE ALL ON FUNCTION public.fn_recovery_confirm(text,text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_recovery_confirm(text,text) TO service_role;
