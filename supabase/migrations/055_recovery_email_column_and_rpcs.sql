-- 055 — Correo de recuperación por usuario + RPCs + trigger de alta.
-- Aplica a TODOS los tenants (Duke, Grupo28, Stratos Sales, nuevos). RLS por org ya vigente.
-- Feature: recuperar contraseña por CÓDIGO enviado al correo de recuperación (distinto del email de login).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;

COMMENT ON COLUMN public.profiles.recovery_email IS
  'Correo REAL de recuperación del usuario (distinto del email de login, que puede ser un placeholder). Ahí se envía el código para restablecer la contraseña.';

-- Leer mi correo de recuperación (mismo patrón que fn_get_my_timezone)
CREATE OR REPLACE FUNCTION public.fn_get_my_recovery_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
  SELECT recovery_email FROM public.profiles WHERE id = auth.uid();
$$;

-- Fijar/actualizar mi correo de recuperación (valida formato; '' lo borra)
CREATE OR REPLACE FUNCTION public.fn_set_my_recovery_email(p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email,'')));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_email = '' THEN
    UPDATE public.profiles SET recovery_email = NULL, updated_at = now() WHERE id = v_uid;
    RETURN NULL;
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  UPDATE public.profiles SET recovery_email = v_email, updated_at = now() WHERE id = v_uid;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_my_recovery_email() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_my_recovery_email() TO authenticated;
REVOKE ALL ON FUNCTION public.fn_set_my_recovery_email(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_set_my_recovery_email(text) TO authenticated;

-- Extender el trigger de alta para copiar recovery_email desde metadata (registro futuro)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_org_id   uuid;
  v_org_name text;
  v_org_slug text;
  v_recovery text;
BEGIN
  v_org_id := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;
  v_recovery := lower(btrim(coalesce(NEW.raw_user_meta_data->>'recovery_email','')));
  IF v_recovery = '' THEN v_recovery := NULL; END IF;

  IF v_org_id IS NULL THEN
    v_org_name := COALESCE(
      NEW.raw_user_meta_data->>'organization_name',
      split_part(NEW.email, '@', 1) || '''s Workspace'
    );
    v_org_slug := lower(regexp_replace(
      COALESCE(NEW.raw_user_meta_data->>'organization_slug', split_part(NEW.email, '@', 1)),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substring(NEW.id::text, 1, 8);

    INSERT INTO public.organizations (name, slug, plan, seats, trial_ends_at)
    VALUES (v_org_name, v_org_slug, 'starter', 5, now() + interval '14 days')
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.profiles (id, name, role, organization_id, recovery_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      CASE WHEN (SELECT count(*) FROM public.profiles WHERE organization_id = v_org_id) = 0
           THEN 'admin' ELSE 'asesor' END
    ),
    v_org_id,
    v_recovery
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
