-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 007: Bot de Telegram en modo asesor
--
-- Convierte el bot de Telegram en una superficie del CRM para
-- el asesor inmobiliario. Después de esta migración el bot puede:
--   · Identificar al asesor por su Telegram (sin que él diga su nombre)
--   · Crear/actualizar leads del asesor con teléfono como llave única
--   · Registrar seguimientos (incrementa contador, append a notas)
--   · Consultar la ficha completa de un lead por teléfono
--   · Listar pendientes del día del asesor
--
-- Cambios:
--   1. profiles: telegram_chat_id + estado de pareo (8 dígitos, anti-bruteforce)
--   2. RPCs de pareo: request/consume/identify
--   3. leads.phone_normalized + unicidad por organización
--   4. leads.next_action_at (timestamptz, no más TEXT) + trigger de sync
--   5. RPCs facade del bot: upsert_lead (race-safe con FOR UPDATE), add_seguimiento, get_lead, list_pending
--
-- Idempotente. Backfill seguro de data existente.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- 1. PAIRING TELEGRAM ↔ ASESOR
-- ═══════════════════════════════════════════════════════════
-- Códigos de 8 dígitos (10^8 = 100M combinaciones) vigentes 10 min.
-- Bot rate-limit (Telegram ~30 req/s) × 600s = 18,000 intentos máx
-- = 0.018% de adivinar. Sin necesidad de rate-limit explícito en BD.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id            BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_pairing_code       VARCHAR(8),
  ADD COLUMN IF NOT EXISTS telegram_pairing_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_paired_at          TIMESTAMPTZ;

-- Si la columna ya existía con VARCHAR(6) (migración previa), ampliarla a 8.
-- Widening varchar es siempre seguro (sin pérdida de datos).
ALTER TABLE public.profiles
  ALTER COLUMN telegram_pairing_code TYPE VARCHAR(8);

-- Un Telegram = un único perfil en toda la base
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_telegram_chat_id
  ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;


-- ── RPC: el asesor pide su código de pareo desde el web ──
CREATE OR REPLACE FUNCTION public.request_telegram_pairing_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_code TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 8 dígitos: 10^8 = 100M combinaciones
  v_code := lpad(floor(random() * 100000000)::text, 8, '0');

  UPDATE public.profiles
  SET telegram_pairing_code       = v_code,
      telegram_pairing_expires_at = now() + interval '10 minutes'
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'code',       v_code,
    'expires_at', now() + interval '10 minutes'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_telegram_pairing_code() TO authenticated;


-- ── RPC: el bot consume el código (vía service_role) ──
CREATE OR REPLACE FUNCTION public.consume_telegram_pairing_code(
  p_code             TEXT,
  p_telegram_chat_id BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Buscar código vigente
  SELECT id, name, role, organization_id INTO v_profile
  FROM public.profiles
  WHERE telegram_pairing_code        = p_code
    AND telegram_pairing_expires_at  > now()
    AND active                       = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired_code');
  END IF;

  -- Atómicamente: setear chat_id, limpiar código.
  -- Si este chat_id ya está pareado a OTRO perfil, el índice único falla
  -- (capturamos el unique_violation y devolvemos error claro).
  BEGIN
    UPDATE public.profiles
    SET telegram_chat_id            = p_telegram_chat_id,
        telegram_pairing_code       = NULL,
        telegram_pairing_expires_at = NULL,
        telegram_paired_at          = now()
    WHERE id = v_profile.id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'telegram_already_paired_to_other_profile');
  END;

  RETURN jsonb_build_object(
    'success',         true,
    'profile_id',      v_profile.id,
    'name',            v_profile.name,
    'role',            v_profile.role,
    'organization_id', v_profile.organization_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_telegram_pairing_code(TEXT, BIGINT) TO service_role;


-- ── RPC: el bot identifica al asesor en cada mensaje ──
CREATE OR REPLACE FUNCTION public.identify_asesor_by_telegram(
  p_telegram_chat_id BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT id, name, role, organization_id, active INTO v_profile
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('paired', false);
  END IF;

  IF v_profile.active = false THEN
    RETURN jsonb_build_object('paired', false, 'reason', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'paired',          true,
    'profile_id',      v_profile.id,
    'name',            v_profile.name,
    'role',            v_profile.role,
    'organization_id', v_profile.organization_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.identify_asesor_by_telegram(BIGINT) TO service_role;


-- ═══════════════════════════════════════════════════════════
-- 2. TELÉFONO NORMALIZADO + UNICIDAD POR ORGANIZACIÓN
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Backfill data existente (solo dígitos)
UPDATE public.leads
SET phone_normalized = NULLIF(regexp_replace(phone, '[^0-9]', '', 'g'), '')
WHERE phone IS NOT NULL
  AND (phone_normalized IS NULL OR phone_normalized = '');

-- Trigger: mantener phone_normalized en sync con phone
CREATE OR REPLACE FUNCTION public.normalize_lead_phone_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone_normalized := NULLIF(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), '');
  ELSE
    NEW.phone_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_normalize_phone ON public.leads;
CREATE TRIGGER leads_normalize_phone
  BEFORE INSERT OR UPDATE OF phone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_phone_trigger();

-- Único por organización (NULL permitido para leads sin teléfono)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leads_org_phone
  ON public.leads(organization_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════════
-- 3. PRÓXIMA ACCIÓN CON TIMESTAMP REAL + SYNC TRIGGER
-- ═══════════════════════════════════════════════════════════
-- next_action_date está en TEXT — no se puede ordenar ni comparar.
-- Agregamos next_action_at TIMESTAMPTZ. Mientras el webapp se migra,
-- un trigger los mantiene sincronizados en ambas direcciones.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;

-- Backfill best-effort: solo lo que parece fecha ISO
DO $$
BEGIN
  UPDATE public.leads
  SET next_action_at = next_action_date::timestamptz
  WHERE next_action_at IS NULL
    AND next_action_date IS NOT NULL
    AND next_action_date ~ '^\d{4}-\d{2}-\d{2}';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Trigger de sincronización bidireccional:
--   · Si se setea next_action_at y next_action_date no, copiar a TEXT (formato ISO)
--   · Si se setea next_action_date (TEXT parseable) y next_action_at no, copiar a TIMESTAMPTZ
-- Cuando el webapp se migre completamente a next_action_at, este trigger se puede borrar.
CREATE OR REPLACE FUNCTION public.sync_next_action_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Caso 1: alguien setea next_action_at, sincroniza a TEXT
  IF NEW.next_action_at IS DISTINCT FROM OLD.next_action_at AND NEW.next_action_at IS NOT NULL THEN
    NEW.next_action_date := to_char(NEW.next_action_at AT TIME ZONE 'America/Cancun', 'YYYY-MM-DD HH24:MI');
  -- Caso 2: alguien setea next_action_date parseable, sincroniza a TIMESTAMPTZ
  ELSIF NEW.next_action_date IS DISTINCT FROM OLD.next_action_date
        AND NEW.next_action_date IS NOT NULL
        AND NEW.next_action_date ~ '^\d{4}-\d{2}-\d{2}' THEN
    BEGIN
      NEW.next_action_at := NEW.next_action_date::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- formato no parseable, dejar next_action_at como está
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_next_action ON public.leads;
CREATE TRIGGER leads_sync_next_action
  BEFORE INSERT OR UPDATE OF next_action_at, next_action_date ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_next_action_columns();

CREATE INDEX IF NOT EXISTS idx_leads_next_action_at
  ON public.leads(asesor_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.leads.next_action_date IS
  'DEPRECATED — usar next_action_at. Sincronizado vía trigger leads_sync_next_action mientras el webapp se migra.';


-- ═══════════════════════════════════════════════════════════
-- 4. BOT FACADE — RPCs que el bot llama via service_role
-- ═══════════════════════════════════════════════════════════
-- Toda escritura del bot pasa por estas funciones. Ventajas:
--   · Permisos por rol calculados en la BD (no confiar en el LLM)
--   · Validaciones (teléfono, tipo de seguimiento) blindadas
--   · Audit trail uniforme (audit_trigger_func ya está activo)
--   · Si cambian las reglas, se cambian aquí, no en el bot

-- ── Crear o actualizar lead — race-safe vía SELECT FOR UPDATE ──
CREATE OR REPLACE FUNCTION public.bot_upsert_lead(
  p_telegram_chat_id BIGINT,
  p_phone            TEXT,
  p_name             TEXT          DEFAULT NULL,
  p_email            TEXT          DEFAULT NULL,
  p_stage            TEXT          DEFAULT NULL,
  p_budget_text      TEXT          DEFAULT NULL,
  p_budget_numeric   BIGINT        DEFAULT NULL,
  p_project          TEXT          DEFAULT NULL,
  p_campaign         TEXT          DEFAULT NULL,
  p_bio              TEXT          DEFAULT NULL,
  p_score            INTEGER       DEFAULT NULL,
  p_hot              BOOLEAN       DEFAULT NULL,
  p_next_action      TEXT          DEFAULT NULL,
  p_next_action_at   TIMESTAMPTZ   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor      RECORD;
  v_phone_norm  TEXT;
  v_lead        RECORD;
  v_was_created BOOLEAN := false;
  v_new_id      uuid;
BEGIN
  -- 1. Identificar asesor
  SELECT id, name, role, organization_id INTO v_asesor
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'asesor_not_paired');
  END IF;

  -- 2. Normalizar teléfono
  v_phone_norm := NULLIF(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_phone');
  END IF;

  -- 3. Lockear si existe (FOR UPDATE evita race con otra ejecución concurrente)
  SELECT id, asesor_id, asesor_name, name INTO v_lead
  FROM public.leads
  WHERE organization_id  = v_asesor.organization_id
    AND phone_normalized = v_phone_norm
    AND deleted_at       IS NULL
  FOR UPDATE
  LIMIT 1;

  IF FOUND THEN
    -- Existe: si pertenece a otro asesor y este NO es admin/dir/ceo → forbidden
    IF v_lead.asesor_id IS NOT NULL
       AND v_lead.asesor_id <> v_asesor.id
       AND v_asesor.role NOT IN ('super_admin','admin','ceo','director') THEN
      RETURN jsonb_build_object(
        'error',     'lead_assigned_to_other_asesor',
        'lead_id',   v_lead.id,
        'lead_name', v_lead.name
      );
    END IF;

    -- Update sólo lo que vino. NULLIF(.., '') evita que strings vacíos
    -- (que el LLM puede pasar por error) sobrescriban datos existentes.
    UPDATE public.leads SET
      name           = COALESCE(NULLIF(p_name, ''),         name),
      email          = COALESCE(NULLIF(p_email, ''),        email),
      stage          = COALESCE(NULLIF(p_stage, ''),        stage),
      budget         = COALESCE(NULLIF(p_budget_text, ''),  budget),
      presupuesto    = COALESCE(p_budget_numeric,           presupuesto),
      project        = COALESCE(NULLIF(p_project, ''),      project),
      campaign       = COALESCE(NULLIF(p_campaign, ''),     campaign),
      bio            = COALESCE(NULLIF(p_bio, ''),          bio),
      score          = COALESCE(p_score,                    score),
      hot            = COALESCE(p_hot,                      hot),
      next_action    = COALESCE(NULLIF(p_next_action, ''),  next_action),
      next_action_at = COALESCE(p_next_action_at,           next_action_at),
      last_activity  = 'Telegram · ' || COALESCE(NULLIF(p_next_action, ''), NULLIF(p_stage, ''), 'actualización'),
      updated_at     = now()
    WHERE id = v_lead.id;

    v_new_id := v_lead.id;
  ELSE
    -- Insertar. Si otra tx ganó la carrera entre el SELECT FOR UPDATE
    -- (sin filas) y el INSERT, el unique index dispara unique_violation
    -- y reintentamos como UPDATE.
    BEGIN
      INSERT INTO public.leads (
        organization_id, asesor_id, asesor_name,
        name, phone, email,
        stage, budget, presupuesto,
        project, campaign, bio,
        score, hot,
        next_action, next_action_at,
        last_activity, source
      ) VALUES (
        v_asesor.organization_id, v_asesor.id, v_asesor.name,
        COALESCE(NULLIF(p_name, ''), 'Sin nombre'), p_phone, NULLIF(p_email, ''),
        COALESCE(NULLIF(p_stage, ''), 'Nuevo Registro'), NULLIF(p_budget_text, ''), p_budget_numeric,
        NULLIF(p_project, ''), NULLIF(p_campaign, ''), NULLIF(p_bio, ''),
        COALESCE(p_score, 50), COALESCE(p_hot, false),
        NULLIF(p_next_action, ''), p_next_action_at,
        'Creado vía Telegram', 'telegram'
      ) RETURNING id INTO v_new_id;

      v_was_created := true;
    EXCEPTION WHEN unique_violation THEN
      -- Otra ejecución insertó el mismo phone+org. Caer al UPDATE path.
      SELECT id, asesor_id INTO v_lead
      FROM public.leads
      WHERE organization_id  = v_asesor.organization_id
        AND phone_normalized = v_phone_norm
        AND deleted_at       IS NULL
      FOR UPDATE
      LIMIT 1;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'unexpected_state');
      END IF;

      IF v_lead.asesor_id IS NOT NULL
         AND v_lead.asesor_id <> v_asesor.id
         AND v_asesor.role NOT IN ('super_admin','admin','ceo','director') THEN
        RETURN jsonb_build_object(
          'error',     'lead_assigned_to_other_asesor',
          'lead_id',   v_lead.id
        );
      END IF;

      UPDATE public.leads SET
        name           = COALESCE(NULLIF(p_name, ''),         name),
        email          = COALESCE(NULLIF(p_email, ''),        email),
        stage          = COALESCE(NULLIF(p_stage, ''),        stage),
        budget         = COALESCE(NULLIF(p_budget_text, ''),  budget),
        presupuesto    = COALESCE(p_budget_numeric,           presupuesto),
        project        = COALESCE(NULLIF(p_project, ''),      project),
        campaign       = COALESCE(NULLIF(p_campaign, ''),     campaign),
        bio            = COALESCE(NULLIF(p_bio, ''),          bio),
        score          = COALESCE(p_score,                    score),
        hot            = COALESCE(p_hot,                      hot),
        next_action    = COALESCE(NULLIF(p_next_action, ''),  next_action),
        next_action_at = COALESCE(p_next_action_at,           next_action_at),
        last_activity  = 'Telegram · ' || COALESCE(NULLIF(p_next_action, ''), NULLIF(p_stage, ''), 'actualización'),
        updated_at     = now()
      WHERE id = v_lead.id;

      v_new_id := v_lead.id;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',  true,
    'lead_id',  v_new_id,
    'created',  v_was_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_upsert_lead TO service_role;


-- ── Agregar seguimiento (incrementa contador, append a notas) ──
CREATE OR REPLACE FUNCTION public.bot_add_seguimiento(
  p_telegram_chat_id BIGINT,
  p_phone            TEXT,
  p_tipo             TEXT,    -- llamada | whatsapp | email | zoom | visita | nota
  p_resumen          TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor      RECORD;
  v_phone_norm  TEXT;
  v_lead        RECORD;
  v_separator   TEXT;
  v_timestamp   TEXT;
  v_new_count   INTEGER;
BEGIN
  SELECT id, name, role, organization_id INTO v_asesor
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'asesor_not_paired');
  END IF;

  IF p_tipo NOT IN ('llamada','whatsapp','email','zoom','visita','nota') THEN
    RETURN jsonb_build_object('error', 'invalid_tipo');
  END IF;

  v_phone_norm := NULLIF(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_phone');
  END IF;

  -- FOR UPDATE para evitar race con otra ejecución concurrente del mismo asesor
  SELECT id, asesor_id, name INTO v_lead
  FROM public.leads
  WHERE organization_id  = v_asesor.organization_id
    AND phone_normalized = v_phone_norm
    AND deleted_at       IS NULL
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lead_not_found');
  END IF;

  -- Permiso: dueño del lead o rol superior
  IF v_lead.asesor_id IS NOT NULL
     AND v_lead.asesor_id <> v_asesor.id
     AND v_asesor.role NOT IN ('super_admin','admin','ceo','director') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Header de la nota: timestamp · tipo · asesor (Cancun = Quintana Roo, sin DST)
  v_timestamp := to_char(now() AT TIME ZONE 'America/Cancun', 'DD Mon HH24:MI');
  v_separator := E'\n\n──── ' || v_timestamp || ' · ' || p_tipo || ' · ' || v_asesor.name || ' ────\n';

  UPDATE public.leads
  SET notas         = COALESCE(notas, '') || v_separator || p_resumen,
      seguimientos  = COALESCE(seguimientos, 0) + 1,
      last_activity = p_tipo || ': ' || left(p_resumen, 60),
      updated_at    = now()
  WHERE id = v_lead.id
  RETURNING seguimientos INTO v_new_count;

  RETURN jsonb_build_object(
    'success',     true,
    'lead_id',     v_lead.id,
    'lead_name',   v_lead.name,
    'new_count',   v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_add_seguimiento TO service_role;


-- ── Consultar lead por teléfono ──
CREATE OR REPLACE FUNCTION public.bot_get_lead_by_phone(
  p_telegram_chat_id BIGINT,
  p_phone            TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor     RECORD;
  v_phone_norm TEXT;
  v_lead       RECORD;
BEGIN
  SELECT id, role, organization_id INTO v_asesor
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'asesor_not_paired');
  END IF;

  v_phone_norm := NULLIF(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_phone');
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE organization_id  = v_asesor.organization_id
    AND phone_normalized = v_phone_norm
    AND deleted_at       IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Asesor regular sólo ve sus leads
  IF v_lead.asesor_id IS NOT NULL
     AND v_lead.asesor_id <> v_asesor.id
     AND v_asesor.role NOT IN ('super_admin','admin','ceo','director') THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'lead', jsonb_build_object(
      'id',             v_lead.id,
      'name',           v_lead.name,
      'phone',          v_lead.phone,
      'email',          v_lead.email,
      'stage',          v_lead.stage,
      'score',          v_lead.score,
      'hot',            v_lead.hot,
      'budget',         v_lead.budget,
      'presupuesto',    v_lead.presupuesto,
      'project',        v_lead.project,
      'campaign',       v_lead.campaign,
      'bio',            v_lead.bio,
      'seguimientos',   v_lead.seguimientos,
      'next_action',    v_lead.next_action,
      'next_action_at', v_lead.next_action_at,
      'last_activity',  v_lead.last_activity,
      'asesor_name',    v_lead.asesor_name,
      'notas',          v_lead.notas,
      'created_at',     v_lead.created_at,
      'updated_at',     v_lead.updated_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_get_lead_by_phone TO service_role;


-- ── Listar pendientes del asesor ("qué tengo hoy") ──
CREATE OR REPLACE FUNCTION public.bot_list_pending(
  p_telegram_chat_id BIGINT,
  p_window_hours     INTEGER DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor  RECORD;
  v_pending jsonb;
BEGIN
  SELECT id, role, organization_id INTO v_asesor
  FROM public.profiles
  WHERE telegram_chat_id = p_telegram_chat_id AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'asesor_not_paired');
  END IF;

  SELECT jsonb_agg(item ORDER BY (item->>'next_action_at') NULLS LAST, (item->>'hot')::boolean DESC)
  INTO v_pending
  FROM (
    SELECT jsonb_build_object(
      'id',             l.id,
      'name',           l.name,
      'phone',          l.phone,
      'stage',          l.stage,
      'next_action',    l.next_action,
      'next_action_at', l.next_action_at,
      'hot',            l.hot
    ) AS item
    FROM public.leads l
    WHERE l.organization_id = v_asesor.organization_id
      AND l.asesor_id       = v_asesor.id
      AND l.deleted_at      IS NULL
      AND (
        l.next_action_at IS NULL
        OR l.next_action_at <= now() + make_interval(hours => p_window_hours)
      )
      AND (l.stage IS NULL OR l.stage NOT IN ('Cierre','Perdido'))
    LIMIT 25
  ) sub;

  RETURN jsonb_build_object('pending', COALESCE(v_pending, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_list_pending TO service_role;


-- ═══════════════════════════════════════════════════════════
-- FIN — refrescar el schema cache de PostgREST
-- ═══════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- Verificación rápida (correr en SQL Editor después de aplicar):
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'telegram_chat_id';        -- esperar 1
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name = 'leads'    AND column_name = 'phone_normalized';        -- esperar 1
--   SELECT count(*) FROM pg_proc WHERE proname LIKE 'bot\_%';                   -- esperar 4
--   SELECT count(*) FROM pg_proc WHERE proname IN
--    ('request_telegram_pairing_code','consume_telegram_pairing_code','identify_asesor_by_telegram');  -- esperar 3
