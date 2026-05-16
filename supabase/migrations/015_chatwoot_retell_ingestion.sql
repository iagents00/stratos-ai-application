-- ════════════════════════════════════════════════════════════════════════
-- 015 — Ingesta de datos desde Chatwoot + Retell (vía n8n)
-- ────────────────────────────────────────────────────────────────────────
-- Crea las tablas satélite que la IA externa (n8n + Chatwoot + Retell) usa
-- para hidratar los leads del CRM con perfilamiento, citas Zoom y logs de
-- llamadas de voz. Todas multi-tenant via organization_id + RLS espejando
-- el patrón de `public.leads`.
--
-- También crea 4 funciones RPC SECURITY DEFINER que n8n llama vía Supabase
-- HTTP (con SERVICE_ROLE_KEY) — no requiere acceso directo a las tablas.
--
-- Las funciones siempre escriben en la org Stratos/Duke
-- (`00000000-0000-0000-0000-000000000001`) y asignan los leads creados
-- a `asesor_name = 'iAgents'`, que es la cuenta bot creada en este sprint.
--
-- Crea el flag `profiles.crm_only` para restringir esa cuenta al módulo
-- CRM (los otros módulos quedan ocultos en sidebar para esa cuenta).
--
-- IMPORTANTE: ya fue ejecutada manualmente vía MCP en producción. Este
-- archivo queda como source-of-truth versionado.
-- ════════════════════════════════════════════════════════════════════════

-- ───────────── 1. Flag per-usuario: crm_only ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crm_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.crm_only IS
  'Si true, el usuario solo puede acceder al CRM + Perfil (oculta otros módulos del sidebar). Usado para cuentas tipo bot/IA que no necesitan los módulos admin.';

-- ───────────── 2. Tabla: discovery_data ─────────────────────────────────
-- Perfilamiento dinámico extraído por la IA (Retell). 1:1 con lead.
CREATE TABLE IF NOT EXISTS public.discovery_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);
CREATE INDEX IF NOT EXISTS discovery_data_org_idx  ON public.discovery_data (organization_id);
CREATE INDEX IF NOT EXISTS discovery_data_lead_idx ON public.discovery_data (lead_id);
ALTER TABLE public.discovery_data ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.discovery_data IS
  'Datos de perfilamiento extraídos por la IA de voz (Retell). Zona, presupuesto, recámaras, enganche, etc. 1:1 con leads.';

-- ───────────── 3. Tabla: appointments ───────────────────────────────────
-- Citas Zoom agendadas por la IA. N appointments por lead.
CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES public.organizations(id),
  zoom_meeting_id   VARCHAR(64),
  meet_link         TEXT,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  timezone          VARCHAR(64) DEFAULT 'America/Cancun',
  advisor_name      VARCHAR(120),
  status            VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  reminder_3h_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_1h_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_3m_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_org_idx    ON public.appointments (organization_id);
CREATE INDEX IF NOT EXISTS appointments_lead_idx   ON public.appointments (lead_id);
CREATE INDEX IF NOT EXISTS appointments_start_idx  ON public.appointments (start_time);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.appointments IS
  'Citas Zoom agendadas por la IA tras el perfilamiento. Incluye link, hora local Cancún, status y flags de recordatorios.';

-- ───────────── 4. Tabla: voice_call_logs ────────────────────────────────
-- Auditoría completa de llamadas Retell AI (transcript, recording, summary).
CREATE TABLE IF NOT EXISTS public.voice_call_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id               VARCHAR(120) UNIQUE,
  lead_id               UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id),
  direction             VARCHAR(20),
  duration_seconds      INTEGER,
  call_summary          TEXT,
  transcript            TEXT,
  recording_url         TEXT,
  disconnection_reason  VARCHAR(120),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_call_logs_org_idx  ON public.voice_call_logs (organization_id);
CREATE INDEX IF NOT EXISTS voice_call_logs_lead_idx ON public.voice_call_logs (lead_id);
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.voice_call_logs IS
  'Registro de llamadas de voz hechas por Retell AI: transcript, grabación, resumen, duración.';

-- ───────────── 5. RLS de las 3 tablas satélite ──────────────────────────
DROP POLICY IF EXISTS discovery_data_rw  ON public.discovery_data;
DROP POLICY IF EXISTS appointments_rw    ON public.appointments;
DROP POLICY IF EXISTS voice_call_logs_rw ON public.voice_call_logs;

CREATE POLICY discovery_data_rw ON public.discovery_data
  FOR ALL USING (
    organization_id = current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = discovery_data.lead_id)
  );

CREATE POLICY appointments_rw ON public.appointments
  FOR ALL USING (
    organization_id = current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = appointments.lead_id)
  );

CREATE POLICY voice_call_logs_rw ON public.voice_call_logs
  FOR ALL USING (
    organization_id = current_organization_id()
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = voice_call_logs.lead_id)
  );

-- ───────────── 6. Funciones RPC para n8n ────────────────────────────────
-- Diseño: todas SECURITY DEFINER, scoped a Stratos org, asignan a 'iAgents'.
-- n8n las invoca vía HTTP con SERVICE_ROLE_KEY → bypass RLS pero la lógica
-- de validación vive dentro de cada función.

-- ─ 6.1 — Upsert principal desde webhook message_created de Chatwoot ─
CREATE OR REPLACE FUNCTION public.fn_upsert_lead_from_chatwoot(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone               text;
  v_phone_norm          text;
  v_name                text;
  v_email               text;
  v_labels              jsonb;
  v_first_label         text;
  v_inbox_id            int;
  v_conv_id             int;
  v_chatwoot_contact_id int;
  v_stage               text;
  v_is_human_needed     boolean := false;
  v_lead_id             uuid;
  v_org_id              uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_existing            boolean := false;
BEGIN
  v_phone   := payload #>> '{conversation,meta,sender,phone_number}';
  v_name    := COALESCE(payload #>> '{conversation,meta,sender,name}', 'Sin Nombre');
  v_email   := payload #>> '{conversation,meta,sender,email}';
  v_labels  := COALESCE(payload #> '{conversation,labels}', '[]'::jsonb);
  v_inbox_id := NULLIF(payload #>> '{conversation,inbox_id}', '')::int;
  v_conv_id  := NULLIF(payload #>> '{conversation,id}', '')::int;
  v_chatwoot_contact_id := NULLIF(payload #>> '{conversation,meta,sender,id}', '')::int;

  IF v_phone IS NULL OR length(v_phone) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing or invalid');
  END IF;
  v_phone_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');

  v_first_label := lower(COALESCE(v_labels ->> 0, ''));
  v_stage := CASE v_first_label
    WHEN 'inbound'          THEN 'Contáctame ya'
    WHEN 'nuevo'            THEN 'Contáctame ya'
    WHEN 'perfilamiento-ia' THEN 'Segundo Intento'
    WHEN 'meet-agendado'    THEN 'Zoom Agendado'
    WHEN 'meet-pendiente'   THEN 'Zoom Agendado'
    WHEN 'meet-confirmado'  THEN 'Zoom Agendado'
    WHEN 'zoom-realizado'   THEN 'Zoom Concretado'
    WHEN 'meet-realizado'   THEN 'Zoom Concretado'
    WHEN 'visita-agendada'  THEN 'Visita Agendada'
    WHEN 'visita-realizada' THEN 'Visita Concretada'
    WHEN 'negociacion'      THEN 'Negociación'
    WHEN 'cierre'           THEN 'Cierre'
    WHEN 'cerrado-ganado'   THEN 'Cierre'
    WHEN 'no-show'          THEN 'No Show'
    WHEN 'perdido'          THEN 'Rotación'
    WHEN 'rotacion'         THEN 'Rotación'
    WHEN 'remarketing'      THEN 'Remarketing'
    WHEN 'postventa'        THEN 'Postventa'
    WHEN 'requiere-humano'  THEN NULL
    ELSE NULL
  END;
  IF v_first_label = 'requiere-humano' THEN
    v_is_human_needed := true;
  END IF;

  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone
         OR phone_normalized = v_phone_norm
         OR phone = v_phone)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    v_existing := true;
    UPDATE public.leads SET
      name = CASE WHEN name IS NULL OR name IN ('', 'Sin Nombre') THEN v_name ELSE name END,
      email = COALESCE(email, v_email),
      whatsapp_phone_e164 = COALESCE(whatsapp_phone_e164, v_phone),
      phone = COALESCE(phone, v_phone),
      phone_normalized = COALESCE(phone_normalized, v_phone_norm),
      stage = CASE WHEN v_stage IS NOT NULL THEN v_stage ELSE stage END,
      hot = CASE WHEN v_is_human_needed THEN true ELSE hot END,
      priority = CASE WHEN v_is_human_needed THEN 'urgente' ELSE priority END,
      tag = COALESCE(NULLIF(v_first_label, ''), tag),
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
      days_inactive = 0
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      name, email, phone, phone_normalized, whatsapp_phone_e164,
      source, stage, asesor_name, organization_id,
      hot, priority, tag, is_new, bio,
      created_at, updated_at, last_activity, fecha_ingreso
    ) VALUES (
      v_name, v_email, v_phone, v_phone_norm, v_phone,
      'whatsapp', COALESCE(v_stage, 'Contáctame ya'), 'iAgents', v_org_id,
      v_is_human_needed,
      CASE WHEN v_is_human_needed THEN 'urgente' ELSE NULL END,
      NULLIF(v_first_label, ''),
      true,
      'Lead capturado por IA desde WhatsApp. Pendiente perfilamiento.',
      now(), now(), to_char(now(), 'YYYY-MM-DD HH24:MI'), now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  IF COALESCE((payload ->> 'private')::boolean, false) IS TRUE
     AND payload ->> 'content' IS NOT NULL
     AND length(trim(payload ->> 'content')) > 0 THEN
    INSERT INTO public.expediente_items (
      lead_id, organization_id, tipo, titulo, descripcion, metadata
    ) VALUES (
      v_lead_id, v_org_id, 'nota_ia',
      'Nota privada de IA',
      payload ->> 'content',
      jsonb_build_object(
        'source', 'chatwoot',
        'chatwoot_message_id', payload ->> 'id',
        'chatwoot_conversation_id', v_conv_id,
        'chatwoot_inbox_id', v_inbox_id,
        'chatwoot_contact_id', v_chatwoot_contact_id,
        'label', v_first_label
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'lead_id', v_lead_id, 'existed', v_existing,
    'stage', COALESCE(v_stage, 'unchanged'), 'human_needed', v_is_human_needed,
    'label_received', v_first_label
  );
END;
$fn$;

-- ─ 6.2 — Registrar appointment (Zoom) ─
CREATE OR REPLACE FUNCTION public.fn_register_appointment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone     text := payload ->> 'phone';
  v_lead_id   uuid;
  v_appt_id   uuid;
  v_org_id    uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing');
  END IF;
  SELECT id INTO v_lead_id FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR phone = v_phone
         OR phone_normalized = regexp_replace(v_phone, '[^0-9]', '', 'g'))
    AND deleted_at IS NULL LIMIT 1;
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone');
  END IF;
  INSERT INTO public.appointments (
    lead_id, organization_id, zoom_meeting_id, meet_link,
    start_time, end_time, timezone, advisor_name, status
  ) VALUES (
    v_lead_id, v_org_id,
    payload ->> 'zoom_meeting_id',
    payload ->> 'meet_link',
    NULLIF(payload ->> 'start_time', '')::timestamptz,
    NULLIF(payload ->> 'end_time', '')::timestamptz,
    COALESCE(payload ->> 'timezone', 'America/Cancun'),
    payload ->> 'advisor_name',
    COALESCE(payload ->> 'status', 'scheduled')
  ) RETURNING id INTO v_appt_id;
  UPDATE public.leads SET
    stage = 'Zoom Agendado',
    next_action = 'Zoom con cliente',
    next_action_at = NULLIF(payload ->> 'start_time', '')::timestamptz,
    next_action_date = to_char(NULLIF(payload ->> 'start_time', '')::timestamptz, 'YYYY-MM-DD'),
    updated_at = now()
  WHERE id = v_lead_id;
  RETURN jsonb_build_object('ok', true, 'appointment_id', v_appt_id, 'lead_id', v_lead_id);
END;
$fn$;

-- ─ 6.3 — Registrar voice_call_log (Retell) ─
CREATE OR REPLACE FUNCTION public.fn_register_voice_call(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone   text := payload ->> 'phone';
  v_lead_id uuid;
  v_log_id  uuid;
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing');
  END IF;
  SELECT id INTO v_lead_id FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR voice_phone_e164 = v_phone
         OR phone = v_phone OR phone_normalized = regexp_replace(v_phone, '[^0-9]', '', 'g'))
    AND deleted_at IS NULL LIMIT 1;
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone');
  END IF;
  INSERT INTO public.voice_call_logs (
    call_id, lead_id, organization_id, direction, duration_seconds,
    call_summary, transcript, recording_url, disconnection_reason
  ) VALUES (
    payload ->> 'call_id', v_lead_id, v_org_id,
    payload ->> 'direction',
    NULLIF(payload ->> 'duration_seconds', '')::int,
    payload ->> 'call_summary',
    payload ->> 'transcript',
    payload ->> 'recording_url',
    payload ->> 'disconnection_reason'
  )
  ON CONFLICT (call_id) DO UPDATE SET
    duration_seconds = EXCLUDED.duration_seconds,
    call_summary = EXCLUDED.call_summary,
    transcript = EXCLUDED.transcript,
    recording_url = EXCLUDED.recording_url,
    disconnection_reason = EXCLUDED.disconnection_reason
  RETURNING id INTO v_log_id;
  RETURN jsonb_build_object('ok', true, 'voice_log_id', v_log_id, 'lead_id', v_lead_id);
END;
$fn$;

-- ─ 6.4 — Upsert discovery_data (perfilamiento de la llamada Retell) ─
CREATE OR REPLACE FUNCTION public.fn_upsert_discovery(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_phone     text := payload ->> 'phone';
  v_data      jsonb := COALESCE(payload -> 'data', '{}'::jsonb);
  v_lead_id   uuid;
  v_disc_id   uuid;
  v_org_id    uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone missing');
  END IF;
  SELECT id INTO v_lead_id FROM public.leads
  WHERE organization_id = v_org_id
    AND (whatsapp_phone_e164 = v_phone OR phone = v_phone
         OR phone_normalized = regexp_replace(v_phone, '[^0-9]', '', 'g'))
    AND deleted_at IS NULL LIMIT 1;
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead not found for phone');
  END IF;
  INSERT INTO public.discovery_data (lead_id, organization_id, data)
  VALUES (v_lead_id, v_org_id, v_data)
  ON CONFLICT (lead_id) DO UPDATE SET
    data = public.discovery_data.data || EXCLUDED.data,
    updated_at = now()
  RETURNING id INTO v_disc_id;
  UPDATE public.leads SET
    budget = COALESCE(v_data ->> 'presupuesto', budget),
    bio = COALESCE(v_data ->> 'objetivo', bio),
    updated_at = now()
  WHERE id = v_lead_id;
  RETURN jsonb_build_object('ok', true, 'discovery_id', v_disc_id, 'lead_id', v_lead_id);
END;
$fn$;

-- ───────────── 7. Grants — solo service_role ────────────────────────────
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_chatwoot(jsonb) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_register_appointment(jsonb)       FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_register_voice_call(jsonb)        FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_upsert_discovery(jsonb)           FROM PUBLIC, authenticated, anon;

GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_chatwoot(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_register_appointment(jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_register_voice_call(jsonb)        TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_upsert_discovery(jsonb)           TO service_role;
