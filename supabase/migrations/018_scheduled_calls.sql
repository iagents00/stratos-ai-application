-- ════════════════════════════════════════════════════════════════════════
-- 018 — scheduled_calls + fn_schedule_call + fn_get_pending_calls
-- ────────────────────────────────────────────────────────────────────────
-- Cola de llamadas diferidas para Retell. Cuando un lead dice "márcame en
-- 15 minutos" durante una llamada, Retell extrae el delta y n8n inserta
-- una fila en scheduled_calls vía fn_schedule_call. Un CRON job en n8n
-- corre cada minuto y consume la cola via fn_get_pending_calls, que
-- claimea atómicamente las filas listas (UPDATE...RETURNING) y dispara
-- la llamada al agente Retell.
--
-- Decisión: phone_e164 se guarda como TEXT (no FK) porque nuestro schema
-- de leads tiene PK uuid y el teléfono vive en columnas separadas. La
-- función NO valida que el lead exista — el CRON puede agendar una
-- llamada incluso a un teléfono que aún no esté como lead.
--
-- IMPORTANTE: ya ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scheduled_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164      TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','cancelled')),
  attempted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_calls_phone_pending_idx
  ON public.scheduled_calls (phone_e164, organization_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS scheduled_calls_due_idx
  ON public.scheduled_calls (scheduled_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.scheduled_calls IS
  'Cola de llamadas diferidas para Retell. n8n inserta filas vía fn_schedule_call y un CRON las consume vía fn_get_pending_calls cada minuto.';
COMMENT ON COLUMN public.scheduled_calls.phone_e164 IS
  'Teléfono en formato E.164. No es FK a leads — la lookup la hace la función para tolerar leads que aún no existen.';

ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_calls_org_rw ON public.scheduled_calls;
CREATE POLICY scheduled_calls_org_rw ON public.scheduled_calls
  FOR ALL USING (organization_id = current_organization_id());

-- ───────── fn_schedule_call ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_schedule_call(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone        TEXT        := payload ->> 'phone_e164';
  v_scheduled_at TIMESTAMPTZ := NULLIF(payload ->> 'scheduled_at', '')::TIMESTAMPTZ;
  v_org_id       UUID        := '00000000-0000-0000-0000-000000000001'::UUID;
  v_existing_id  UUID;
  v_id           UUID;
BEGIN
  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_e164 missing or invalid');
  END IF;
  IF v_scheduled_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'scheduled_at missing or invalid');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.scheduled_calls
  WHERE phone_e164 = v_phone
    AND organization_id = v_org_id
    AND status = 'pending'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.scheduled_calls
    SET scheduled_at = v_scheduled_at, updated_at = now()
    WHERE id = v_existing_id;
    RETURN jsonb_build_object(
      'ok', true, 'id', v_existing_id, 'action', 'updated',
      'phone_e164', v_phone, 'scheduled_at', v_scheduled_at
    );
  END IF;

  INSERT INTO public.scheduled_calls (phone_e164, organization_id, scheduled_at)
  VALUES (v_phone, v_org_id, v_scheduled_at)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_id, 'action', 'created',
    'phone_e164', v_phone, 'scheduled_at', v_scheduled_at
  );
END;
$fn$;

-- ───────── fn_get_pending_calls ─────────────────────────────────────────
-- Atomic claim via UPDATE...RETURNING. Postgres garantiza que dos calls
-- concurrentes no toman las mismas filas (lock interno por row).
CREATE OR REPLACE FUNCTION public.fn_get_pending_calls()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_calls  jsonb;
BEGIN
  WITH claimed AS (
    UPDATE public.scheduled_calls
    SET status = 'completed',
        attempted_at = now(),
        updated_at = now()
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND organization_id = v_org_id
    RETURNING id, phone_e164, scheduled_at, created_at, attempted_at
  )
  SELECT jsonb_agg(to_jsonb(c)) INTO v_calls FROM claimed c;

  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(jsonb_array_length(v_calls), 0),
    'calls', COALESCE(v_calls, '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_schedule_call(jsonb)    FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_get_pending_calls()     FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_schedule_call(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_pending_calls()  TO service_role;
