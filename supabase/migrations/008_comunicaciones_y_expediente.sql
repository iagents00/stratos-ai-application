-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 008
-- Comunicaciones (con transcripciones para IA) + Expediente del cliente
--
-- Cierra la última brecha del CRM:
--   1. `comunicaciones`     — log detallado de cada contacto (llamada,
--                              WhatsApp, Zoom, email, visita, nota, sms)
--                              con TRANSCRIPCIÓN COMPLETA lista para que
--                              la IA la analice (Claude / OpenAI).
--   2. `expediente_items`   — documentos, fotos, audios, PDFs, INE,
--                              comprobantes, notas estructuradas.
--   3. `leads.fecha_ingreso` — fecha real del primer contacto (separada
--                              de created_at).
--   4. Trigger que mantiene `leads.seguimientos` sincronizado al
--      insertar en comunicaciones.
--   5. RPC `get_lead_ai_context(lead_id)` — devuelve TODO el contexto
--      de un lead en un solo query: ficha + últimas N comunicaciones
--      con transcripts + items de expediente. Es el payload exacto
--      que la IA recibirá.
--   6. RPC `bot_add_comunicacion` — para n8n / webhooks de transcripts.
--   7. RPC `search_comunicaciones` — full-text search en español sobre
--      transcripts.
--   8. Update de `bot_add_seguimiento` (de migration 007): ahora
--      ADEMÁS de bumpear el contador, inserta una fila en
--      comunicaciones. El bot v4 de n8n empieza a loggear estructurado
--      sin tocar el workflow.
--
-- Compatibilidad: depende de migrations 001-007.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DROP POLICY IF EXISTS, etc. Se puede correr varias veces sin romper nada.
--
-- AUDITORÍA pre-deploy validada contra producción (glulgyhkrqpykxmujodb):
--   ✓ helpers set_updated_at, current_organization_id, is_admin_or_above,
--     audit_trigger_func existen.
--   ✓ leads.phone_normalized, leads.organization_id, leads.deleted_at presentes.
--   ✓ profiles.telegram_chat_id presente.
--   ✓ diccionario FTS 'spanish' disponible.
--   ✓ tablas comunicaciones / expediente_items NO existen (apply limpio).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- 0. fecha_ingreso en leads (separada de created_at)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fecha_ingreso timestamptz;

UPDATE public.leads
   SET fecha_ingreso = created_at
 WHERE fecha_ingreso IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_fecha_ingreso
  ON public.leads(fecha_ingreso DESC);


-- ═══════════════════════════════════════════════════════════
-- 1. TABLA `comunicaciones`
--    Cada fila = un contacto real con el lead.
--    Pensada para que la IA lea transcripts completos y razone.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comunicaciones (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id       uuid        NOT NULL
                                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id               uuid        NOT NULL
                                    REFERENCES public.leads(id) ON DELETE CASCADE,
  asesor_id             uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  tipo                  text        NOT NULL CHECK (tipo IN (
                                      'llamada','whatsapp','sms','email',
                                      'zoom','meet','teams','visita','nota','otro'
                                    )),
  direccion             text        CHECK (direccion IN ('inbound','outbound','interno')),

  ocurrio_en            timestamptz NOT NULL DEFAULT now(),
  duracion_segundos     integer,

  resumen               text,
  resultado             text        CHECK (resultado IN (
                                      'contactado','no_contesto','buzon','numero_invalido',
                                      'reagendado','interesado','no_interesado',
                                      'visita_agendada','zoom_agendado','cierre','otro'
                                    )),

  -- ── Contenido completo para IA ─────────────────────────────
  -- TEXT en Postgres: hasta 1 GB con TOAST. Una transcripción de
  -- Zoom de 4 horas (~500 KB) cabe sobrada.
  transcript            text,
  transcript_lang       text        DEFAULT 'es',
  transcript_provider   text,                              -- whisper | deepgram | manual
  transcript_confidence numeric(4,3),                      -- 0.000 - 1.000

  -- ── Adjuntos del canal (en Supabase Storage) ───────────────
  audio_url             text,
  recording_url         text,
  attachments           jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- ── Análisis IA (rellenado async por worker) ───────────────
  ai_summary            text,
  ai_key_points         jsonb,
  ai_sentiment          text        CHECK (ai_sentiment IN
                                          ('positivo','neutro','negativo','mixto')),
  ai_intents            jsonb,                              -- BANT, objeciones, próximos pasos
  ai_topics             text[],
  ai_action_items       jsonb,
  ai_model              text,
  ai_analyzed_at        timestamptz,
  ai_token_count        integer,

  -- (Para RAG futuro: descomentar cuando pgvector esté habilitado)
  -- embedding          vector(1536),

  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at            timestamptz
);

COMMENT ON TABLE  public.comunicaciones IS
  'Log detallado de contactos con leads. transcript + ai_* permiten que la IA analice conversaciones completas (Zoom, WhatsApp, llamadas).';
COMMENT ON COLUMN public.comunicaciones.transcript IS
  'Transcripción completa. TEXT soporta hasta 1GB; conversaciones de horas caben sin problema.';

-- ── Triggers ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS comunicaciones_updated_at ON public.comunicaciones;
CREATE TRIGGER comunicaciones_updated_at
  BEFORE UPDATE ON public.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_comunicaciones_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
      FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.asesor_id IS NULL THEN
    SELECT asesor_id INTO NEW.asesor_id
      FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comunicaciones_set_org ON public.comunicaciones;
CREATE TRIGGER comunicaciones_set_org
  BEFORE INSERT ON public.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_comunicaciones_org_id();

-- Sincroniza el contador `leads.seguimientos` al insertar comm real.
CREATE OR REPLACE FUNCTION public.bump_lead_seguimientos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tipo IN ('llamada','whatsapp','sms','email','zoom','meet','teams','visita') THEN
    UPDATE public.leads
       SET seguimientos  = COALESCE(seguimientos, 0) + 1,
           last_activity = COALESCE(NEW.resumen,
                            CASE NEW.tipo
                              WHEN 'llamada'  THEN 'Llamada registrada'
                              WHEN 'whatsapp' THEN 'WhatsApp registrado'
                              WHEN 'zoom'     THEN 'Zoom registrado'
                              WHEN 'visita'   THEN 'Visita registrada'
                              ELSE 'Comunicación registrada'
                            END),
           updated_at    = now()
     WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comunicaciones_bump_counter ON public.comunicaciones;
CREATE TRIGGER comunicaciones_bump_counter
  AFTER INSERT ON public.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION public.bump_lead_seguimientos();

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comunicaciones_lead_time
  ON public.comunicaciones(lead_id, ocurrio_en DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comunicaciones_asesor_time
  ON public.comunicaciones(asesor_id, ocurrio_en DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comunicaciones_tipo_time
  ON public.comunicaciones(organization_id, tipo, ocurrio_en DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comunicaciones_pending_ai
  ON public.comunicaciones(created_at)
  WHERE ai_analyzed_at IS NULL AND transcript IS NOT NULL;

-- Full-text search en español sobre transcript + resumen + ai_summary.
-- Partial: solo filas activas, ahorra ~30% de tamaño del índice.
CREATE INDEX IF NOT EXISTS idx_comunicaciones_fts
  ON public.comunicaciones
  USING GIN (
    to_tsvector('spanish',
      coalesce(resumen,'')      || ' ' ||
      coalesce(transcript,'')   || ' ' ||
      coalesce(ai_summary,'')
    )
  )
  WHERE deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════════
-- 2. TABLA `expediente_items`
--    Documentos, fotos, audios, PDFs, INE, comprobantes, notas.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.expediente_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id     uuid        NOT NULL
                                  REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id             uuid        NOT NULL
                                  REFERENCES public.leads(id) ON DELETE CASCADE,

  tipo                text        NOT NULL CHECK (tipo IN (
                                    'nota','texto','transcripcion',
                                    'documento','pdf','imagen','foto',
                                    'video','audio','audio_message',
                                    'ine','pasaporte','comprobante_ingresos',
                                    'comprobante_domicilio','rfc','curp',
                                    'acta_constitutiva','estado_cuenta',
                                    'contrato','propuesta','cotizacion','otro'
                                  )),

  titulo              text,
  contenido           text,                              -- para tipos texto / nota / transcripcion

  file_path           text,                              -- path en Supabase Storage
  file_size_bytes     bigint,
  file_mime_type      text,

  ai_extracted_text   text,                              -- OCR / transcripción del archivo
  ai_summary          text,
  ai_metadata         jsonb,                             -- {tipo_doc:"INE", curp:"...", ...}
  ai_analyzed_at      timestamptz,
  ai_model            text,

  tags                text[],
  source              text        DEFAULT 'manual',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at          timestamptz
);

COMMENT ON TABLE  public.expediente_items IS
  'Documentos, archivos y notas estructuradas del expediente del cliente. file_path apunta a Supabase Storage.';
COMMENT ON COLUMN public.expediente_items.ai_extracted_text IS
  'Texto extraído por OCR/transcripción del archivo. Permite búsqueda y análisis IA sobre PDFs e imágenes.';

DROP TRIGGER IF EXISTS expediente_items_updated_at ON public.expediente_items;
CREATE TRIGGER expediente_items_updated_at
  BEFORE UPDATE ON public.expediente_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_expediente_items_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
      FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expediente_items_set_org ON public.expediente_items;
CREATE TRIGGER expediente_items_set_org
  BEFORE INSERT ON public.expediente_items
  FOR EACH ROW EXECUTE FUNCTION public.set_expediente_items_org_id();

CREATE INDEX IF NOT EXISTS idx_expediente_lead_time
  ON public.expediente_items(lead_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expediente_tipo
  ON public.expediente_items(organization_id, tipo)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expediente_pending_ai
  ON public.expediente_items(created_at)
  WHERE ai_analyzed_at IS NULL
    AND (file_path IS NOT NULL OR contenido IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_expediente_fts
  ON public.expediente_items
  USING GIN (
    to_tsvector('spanish',
      coalesce(titulo,'')             || ' ' ||
      coalesce(contenido,'')          || ' ' ||
      coalesce(ai_extracted_text,'')  || ' ' ||
      coalesce(ai_summary,'')
    )
  )
  WHERE deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY
--    Patrón: la visibilidad se DELEGA a la RLS de leads.
--    Si el usuario puede SELECT el lead, puede ver sus comms y
--    expediente. Esto reusa automáticamente las reglas de
--    asesor_name / can_view_all_leads / is_admin_or_above
--    sin duplicarlas.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.comunicaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_items ENABLE ROW LEVEL SECURITY;

-- ── COMUNICACIONES ────────────────────────────────────────────
DROP POLICY IF EXISTS "comunicaciones_select" ON public.comunicaciones;
CREATE POLICY "comunicaciones_select" ON public.comunicaciones
  FOR SELECT USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = comunicaciones.lead_id
      -- la RLS de leads ya filtra por asesor / admin / can_view_all
    )
  );

DROP POLICY IF EXISTS "comunicaciones_insert" ON public.comunicaciones;
CREATE POLICY "comunicaciones_insert" ON public.comunicaciones
  FOR INSERT WITH CHECK (
    (organization_id IS NULL                     -- trigger lo rellena
     OR organization_id = public.current_organization_id())
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
    )
  );

DROP POLICY IF EXISTS "comunicaciones_update" ON public.comunicaciones;
CREATE POLICY "comunicaciones_update" ON public.comunicaciones
  FOR UPDATE USING (
    organization_id = public.current_organization_id()
    AND (public.is_admin_or_above() OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "comunicaciones_delete" ON public.comunicaciones;
CREATE POLICY "comunicaciones_delete" ON public.comunicaciones
  FOR DELETE USING (
    organization_id = public.current_organization_id()
    AND public.is_admin_or_above()
  );

-- ── EXPEDIENTE_ITEMS ──────────────────────────────────────────
DROP POLICY IF EXISTS "expediente_select" ON public.expediente_items;
CREATE POLICY "expediente_select" ON public.expediente_items
  FOR SELECT USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = expediente_items.lead_id
    )
  );

DROP POLICY IF EXISTS "expediente_insert" ON public.expediente_items;
CREATE POLICY "expediente_insert" ON public.expediente_items
  FOR INSERT WITH CHECK (
    (organization_id IS NULL
     OR organization_id = public.current_organization_id())
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
    )
  );

DROP POLICY IF EXISTS "expediente_update" ON public.expediente_items;
CREATE POLICY "expediente_update" ON public.expediente_items
  FOR UPDATE USING (
    organization_id = public.current_organization_id()
    AND (public.is_admin_or_above() OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "expediente_delete" ON public.expediente_items;
CREATE POLICY "expediente_delete" ON public.expediente_items
  FOR DELETE USING (
    organization_id = public.current_organization_id()
    AND public.is_admin_or_above()
  );


-- ═══════════════════════════════════════════════════════════
-- 4. AUDIT — sin triggers en estas tablas (decisión deliberada)
-- ═══════════════════════════════════════════════════════════
-- A diferencia de leads / profiles, NO aplicamos audit_trigger_func
-- a comunicaciones / expediente_items. Razones:
--   1. transcript / contenido / ai_extracted_text pueden pesar 100s de KB.
--      audit_trigger_func guarda OLD y NEW de cada campo cambiado en
--      audit_log.changed_fields → duplicaría cada transcript en cada
--      UPDATE y multiplicaría el storage por 2-3×.
--   2. Estas tablas YA SON el historial. Tienen created_at, created_by,
--      updated_at, deleted_at. El patrón correcto para "editar" un
--      transcript es insertar una NUEVA fila, no mutar la anterior.
--   3. Si más adelante se requiere versionado, una tabla
--      `comunicaciones_versions` es más limpia que abusar del audit_log.


-- ═══════════════════════════════════════════════════════════
-- 5. RPC `get_lead_ai_context`
--    Devuelve TODO el contexto de un lead en un solo round-trip.
--    Es el payload que la IA recibe como prompt context.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_lead_ai_context(
  p_lead_id            uuid,
  p_max_comunicaciones integer DEFAULT 20,
  p_max_expediente     integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lead       jsonb;
  v_asesor     jsonb;
  v_comms      jsonb;
  v_expediente jsonb;
BEGIN
  SELECT to_jsonb(l) INTO v_lead
    FROM public.leads l
   WHERE l.id = p_lead_id
     AND l.deleted_at IS NULL;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('error', 'lead_not_found_or_no_access');
  END IF;

  SELECT to_jsonb(p) - 'telegram_chat_id' - 'telegram_pairing_code'
    INTO v_asesor
    FROM public.profiles p
   WHERE p.id = (v_lead->>'asesor_id')::uuid;

  SELECT coalesce(jsonb_agg(c ORDER BY (c->>'ocurrio_en') DESC), '[]'::jsonb)
    INTO v_comms
    FROM (
      SELECT to_jsonb(co) AS c
        FROM public.comunicaciones co
       WHERE co.lead_id = p_lead_id
         AND co.deleted_at IS NULL
       ORDER BY co.ocurrio_en DESC
       LIMIT p_max_comunicaciones
    ) sub;

  SELECT coalesce(jsonb_agg(e ORDER BY (e->>'created_at') DESC), '[]'::jsonb)
    INTO v_expediente
    FROM (
      SELECT to_jsonb(ei) AS e
        FROM public.expediente_items ei
       WHERE ei.lead_id = p_lead_id
         AND ei.deleted_at IS NULL
       ORDER BY ei.created_at DESC
       LIMIT p_max_expediente
    ) sub;

  RETURN jsonb_build_object(
    'lead',           v_lead,
    'asesor',         v_asesor,
    'comunicaciones', v_comms,
    'expediente',     v_expediente,
    'generated_at',   now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_ai_context(uuid, integer, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_lead_ai_context IS
  'Payload completo del lead para análisis IA: ficha + asesor + N comunicaciones (con transcripts) + items del expediente.';


-- ═══════════════════════════════════════════════════════════
-- 6. RPC `add_comunicacion` (frontend autenticado)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.add_comunicacion(
  p_lead_id            uuid,
  p_tipo               text,
  p_resumen            text        DEFAULT NULL,
  p_transcript         text        DEFAULT NULL,
  p_direccion          text        DEFAULT 'outbound',
  p_resultado          text        DEFAULT NULL,
  p_duracion_segundos  integer     DEFAULT NULL,
  p_audio_url          text        DEFAULT NULL,
  p_recording_url      text        DEFAULT NULL,
  p_metadata           jsonb       DEFAULT '{}'::jsonb,
  p_ocurrio_en         timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.comunicaciones (
    lead_id, tipo, direccion, resumen, transcript,
    resultado, duracion_segundos, audio_url, recording_url,
    metadata, ocurrio_en
  ) VALUES (
    p_lead_id, p_tipo, p_direccion, p_resumen, p_transcript,
    p_resultado, p_duracion_segundos, p_audio_url, p_recording_url,
    coalesce(p_metadata, '{}'::jsonb), p_ocurrio_en
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_comunicacion(
  uuid, text, text, text, text, text, integer, text, text, jsonb, timestamptz
) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 7. RPC `add_expediente_item` (frontend autenticado)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.add_expediente_item(
  p_lead_id    uuid,
  p_tipo       text,
  p_titulo     text   DEFAULT NULL,
  p_contenido  text   DEFAULT NULL,
  p_file_path  text   DEFAULT NULL,
  p_file_size  bigint DEFAULT NULL,
  p_file_mime  text   DEFAULT NULL,
  p_tags       text[] DEFAULT NULL,
  p_source     text   DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.expediente_items (
    lead_id, tipo, titulo, contenido,
    file_path, file_size_bytes, file_mime_type,
    tags, source
  ) VALUES (
    p_lead_id, p_tipo, p_titulo, p_contenido,
    p_file_path, p_file_size, p_file_mime,
    p_tags, p_source
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_expediente_item(
  uuid, text, text, text, text, bigint, text, text[], text
) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 8. RPC `bot_add_comunicacion` (service_role — n8n / webhooks)
--    Inserta comunicación con transcript completo desde el bot.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.bot_add_comunicacion(
  p_telegram_chat_id  bigint,
  p_lead_phone        text,
  p_tipo              text,
  p_resumen           text  DEFAULT NULL,
  p_transcript        text  DEFAULT NULL,
  p_direccion         text  DEFAULT 'outbound',
  p_metadata          jsonb DEFAULT '{}'::jsonb,
  p_audio_url         text  DEFAULT NULL,
  p_recording_url     text  DEFAULT NULL,
  p_duracion_segundos integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor  public.profiles%ROWTYPE;
  v_lead    public.leads%ROWTYPE;
  v_phone_n text;
  v_id      uuid;
BEGIN
  SELECT * INTO v_asesor
    FROM public.profiles
   WHERE telegram_chat_id = p_telegram_chat_id
   LIMIT 1;
  IF v_asesor.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'asesor_not_paired');
  END IF;

  v_phone_n := regexp_replace(coalesce(p_lead_phone, ''), '[^0-9]', '', 'g');

  SELECT * INTO v_lead
    FROM public.leads
   WHERE organization_id  = v_asesor.organization_id
     AND phone_normalized = v_phone_n
     AND deleted_at IS NULL
   LIMIT 1;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  INSERT INTO public.comunicaciones (
    organization_id, lead_id, asesor_id, created_by,
    tipo, direccion, resumen, transcript,
    audio_url, recording_url, duracion_segundos, metadata
  ) VALUES (
    v_asesor.organization_id, v_lead.id, v_asesor.id, v_asesor.id,
    p_tipo, p_direccion, p_resumen, p_transcript,
    p_audio_url, p_recording_url, p_duracion_segundos, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'comunicacion_id', v_id,
    'lead_id',         v_lead.id,
    'lead_name',       v_lead.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_add_comunicacion(
  bigint, text, text, text, text, text, jsonb, text, text, integer
) TO service_role;


-- ═══════════════════════════════════════════════════════════
-- 9. RPC `search_comunicaciones` (full-text search en español)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_comunicaciones(
  p_query   text,
  p_lead_id uuid    DEFAULT NULL,
  p_tipo    text    DEFAULT NULL,
  p_limit   integer DEFAULT 30
)
RETURNS TABLE (
  id         uuid,
  lead_id    uuid,
  tipo       text,
  ocurrio_en timestamptz,
  resumen    text,
  rank       real,
  snippet    text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.lead_id,
    c.tipo,
    c.ocurrio_en,
    c.resumen,
    ts_rank(
      to_tsvector('spanish',
        coalesce(c.resumen, '')    || ' ' ||
        coalesce(c.transcript, '') || ' ' ||
        coalesce(c.ai_summary, '')
      ),
      plainto_tsquery('spanish', p_query)
    ) AS rank,
    ts_headline('spanish',
      coalesce(c.transcript, c.resumen, ''),
      plainto_tsquery('spanish', p_query),
      'MaxWords=30, MinWords=10, ShortWord=3'
    ) AS snippet
  FROM public.comunicaciones c
  WHERE c.deleted_at IS NULL
    AND (p_lead_id IS NULL OR c.lead_id = p_lead_id)
    AND (p_tipo    IS NULL OR c.tipo    = p_tipo)
    AND to_tsvector('spanish',
          coalesce(c.resumen, '')    || ' ' ||
          coalesce(c.transcript, '') || ' ' ||
          coalesce(c.ai_summary, '')
        ) @@ plainto_tsquery('spanish', p_query)
  ORDER BY rank DESC, c.ocurrio_en DESC
  LIMIT LEAST(p_limit, 200);
$$;

GRANT EXECUTE ON FUNCTION public.search_comunicaciones(text, uuid, text, integer)
  TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 10. UPDATE `bot_add_seguimiento` (de migration 007)
--     Mantiene la API existente que usa el n8n bot v4 INTACTA,
--     pero ahora ADEMÁS de bumpear contador y appendear nota,
--     inserta una fila en `comunicaciones`. El bot empieza a
--     loggear estructurado SIN cambios en el workflow de n8n.
--
--     ── Backwards-compat ──
--     Misma firma que 007. Mismo retorno. Mismo upsert de notas.
--     El trigger comunicaciones_bump_counter hace el +1 ahora,
--     así que removemos el UPDATE manual de seguimientos para
--     evitar double-bump.
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.bot_add_seguimiento(
  p_telegram_chat_id bigint,
  p_phone            text,
  p_tipo             text,
  p_resumen          text,
  p_metadata         jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor    public.profiles%ROWTYPE;
  v_lead      public.leads%ROWTYPE;
  v_phone_n   text;
  v_comm_id   uuid;
  v_new_count integer;
  v_note_line text;
BEGIN
  -- 1. Asesor por chat_id
  SELECT * INTO v_asesor
    FROM public.profiles
   WHERE telegram_chat_id = p_telegram_chat_id
   LIMIT 1;
  IF v_asesor.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'asesor_not_paired');
  END IF;

  -- 2. Lead por teléfono normalizado dentro de la organización
  v_phone_n := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  SELECT * INTO v_lead
    FROM public.leads
   WHERE organization_id  = v_asesor.organization_id
     AND phone_normalized = v_phone_n
     AND deleted_at IS NULL
   FOR UPDATE
   LIMIT 1;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found');
  END IF;

  -- 3. Insertar comunicación estructurada (el trigger bumpea seguimientos)
  INSERT INTO public.comunicaciones (
    organization_id, lead_id, asesor_id, created_by,
    tipo, direccion, resumen, metadata
  ) VALUES (
    v_asesor.organization_id, v_lead.id, v_asesor.id, v_asesor.id,
    p_tipo, 'outbound', p_resumen, coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_comm_id;

  -- 4. Append a la nota legacy (el bot v4 todavía la lee)
  v_note_line := format('[%s · %s] %s',
                  to_char(now() AT TIME ZONE 'America/Cancun', 'DD-Mon HH24:MI'),
                  p_tipo,
                  coalesce(p_resumen, ''));
  UPDATE public.leads
     SET notas = CASE
                   WHEN coalesce(notas, '') = '' THEN v_note_line
                   ELSE notas || E'\n' || v_note_line
                 END
   WHERE id = v_lead.id
   RETURNING seguimientos INTO v_new_count;

  RETURN jsonb_build_object(
    'ok',              true,
    'comunicacion_id', v_comm_id,
    'lead_id',         v_lead.id,
    'lead_name',       v_lead.name,
    'seguimientos',    v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_add_seguimiento(bigint, text, text, text, jsonb)
  TO service_role;


-- ═══════════════════════════════════════════════════════════
-- 11. Refrescar schema cache de PostgREST
-- ═══════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-DEPLOY
--
--   -- Tablas creadas
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public'
--      AND table_name IN ('comunicaciones','expediente_items');
--
--   -- RPCs disponibles
--   SELECT routine_name FROM information_schema.routines
--    WHERE routine_schema = 'public'
--      AND routine_name IN (
--        'get_lead_ai_context','add_comunicacion','add_expediente_item',
--        'bot_add_comunicacion','bot_add_seguimiento','search_comunicaciones'
--      );
--
--   -- Smoke test (sustituir por un lead real con teléfono)
--   SELECT public.add_comunicacion(
--     (SELECT id FROM public.leads WHERE phone_normalized IS NOT NULL LIMIT 1),
--     'zoom',
--     'Smoke test desde migration 008',
--     'Hola, esta es una transcripción de prueba…',
--     'outbound', 'interesado', 1820
--   );
--
--   SELECT public.get_lead_ai_context(
--     (SELECT id FROM public.leads WHERE phone_normalized IS NOT NULL LIMIT 1)
--   );
--
-- ═══════════════════════════════════════════════════════════
