-- 052_create_fn_sales_rpcs.sql
-- 5 RPC functions for the Stratos Sales funnel (prefix fn_sales_ to avoid
-- colliding with the 147 existing fn_* functions used by Duke and other tenants).
--
-- All functions:
--   - SECURITY DEFINER (consistent with existing Stratos RPCs)
--   - SET search_path = public, pg_temp (security hardening)
--   - Take organization_id (or scoped lead_id) to enforce tenant isolation
--
-- Functions:
--   fn_sales_upsert_lead_from_diagnostico(p_org_id, p_payload) returns uuid
--   fn_sales_get_pending_rescate_calls(p_org_id) returns SETOF leads
--   fn_sales_schedule_call(p_lead_id) returns void
--   fn_sales_update_from_retell_postcall(p_lead_id, p_extracted) returns void
--   fn_sales_register_appointment(p_lead_id, p_cal_event_id, p_selected_time, p_zoom_url, p_cal_event_url) returns void
--
-- Idempotent via CREATE OR REPLACE.

-- ============================================================
-- FASE 0.4 - RPCs fn_sales_* para Stratos AI Sales
-- Tenant: organization_id = b1145073-434c-4779-a243-d5e8f5ff3617
-- Convenciones:
--   - Prefijo fn_sales_ para no colisionar con las 147 RPCs existentes
--   - SECURITY DEFINER (consistente con resto de RPCs en Stratos)
--   - search_path = public, pg_temp para seguridad
-- ============================================================

-- 1) Upsert lead desde diagnóstico
CREATE OR REPLACE FUNCTION public.fn_sales_upsert_lead_from_diagnostico(
  p_org_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead_id uuid;
  v_phone text;
  v_email text;
  v_name text;
BEGIN
  v_phone := p_payload->>'whatsapp';
  v_email := p_payload->>'email';
  v_name := COALESCE(p_payload->>'name', 'Sin nombre');

  -- Upsert por (organization_id, whatsapp_phone_e164)
  SELECT id INTO v_lead_id
  FROM leads
  WHERE organization_id = p_org_id
    AND whatsapp_phone_e164 = v_phone
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      organization_id, name, email, whatsapp_phone_e164, voice_phone_e164,
      stage, urgency_status, source,
      diagnostico_payload, diagnostico_score, diagnostico_nivel, diagnostico_recomendacion,
      dolor_principal, contexto_previo,
      next_action_at, fecha_ingreso, created_at, updated_at
    ) VALUES (
      p_org_id, v_name, v_email, v_phone, v_phone,
      'Contáctame Ya', 'Rescate_Pendiente', COALESCE(p_payload->>'source', 'diagnostico_stratos'),
      p_payload,
      NULLIF(p_payload->>'score','')::int,
      p_payload->>'level',
      p_payload->>'aiosRecommended',
      p_payload->>'pain',
      p_payload->>'summary',
      NOW() + INTERVAL '5 minutes', NOW(), NOW(), NOW()
    )
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE leads SET
      name = COALESCE(v_name, name),
      email = COALESCE(v_email, email),
      stage = 'Contáctame Ya',
      urgency_status = 'Rescate_Pendiente',
      diagnostico_payload = p_payload,
      diagnostico_score = COALESCE(NULLIF(p_payload->>'score','')::int, diagnostico_score),
      diagnostico_nivel = COALESCE(p_payload->>'level', diagnostico_nivel),
      diagnostico_recomendacion = COALESCE(p_payload->>'aiosRecommended', diagnostico_recomendacion),
      dolor_principal = COALESCE(p_payload->>'pain', dolor_principal),
      contexto_previo = COALESCE(p_payload->>'summary', contexto_previo),
      next_action_at = NOW() + INTERVAL '5 minutes',
      updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN v_lead_id;
END;
$$;

-- 2) Obtener leads pendientes de rescate (CRON Sofía 5min)
CREATE OR REPLACE FUNCTION public.fn_sales_get_pending_rescate_calls(
  p_org_id uuid
)
RETURNS SETOF leads
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM leads
  WHERE organization_id = p_org_id
    AND urgency_status = 'Rescate_Pendiente'
    AND next_action_at IS NOT NULL
    AND next_action_at <= NOW()
    AND COALESCE(do_not_contact, false) = false
    AND COALESCE(call_attempts, 0) < 3
    AND deleted_at IS NULL
  ORDER BY next_action_at ASC
  LIMIT 50;
$$;

-- 3) Marcar lead como llamada en curso (lock antes de disparar Retell)
CREATE OR REPLACE FUNCTION public.fn_sales_schedule_call(
  p_lead_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE leads SET
    urgency_status = 'Llamada_En_Curso',
    call_attempts = COALESCE(call_attempts, 0) + 1,
    stage = CASE
      WHEN COALESCE(call_attempts, 0) = 0 THEN 'Segundo Intento'
      WHEN COALESCE(call_attempts, 0) = 1 THEN 'Tercer Intento'
      ELSE 'Reactivar Zoom'
    END,
    next_action_at = NULL,
    updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;

-- 4) Actualizar lead con datos post-call de Retell Sofía
CREATE OR REPLACE FUNCTION public.fn_sales_update_from_retell_postcall(
  p_lead_id uuid,
  p_extracted jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estado_final text;
  v_new_stage text;
  v_new_urgency text;
BEGIN
  v_estado_final := p_extracted->>'estado_final';

  -- Map estado_final Retell -> stage Duke
  CASE v_estado_final
    WHEN 'Asesoria_Agendada' THEN
      v_new_stage := 'Zoom Agendado';
      v_new_urgency := 'Agendado';
    WHEN 'Reagendar_Asesoria' THEN
      v_new_stage := 'Zoom Agendado';
      v_new_urgency := 'Agendado';
    WHEN 'No_Interesado' THEN
      v_new_stage := 'Remarketing IA';
      v_new_urgency := 'Pausado';
    WHEN 'No_Contactar' THEN
      v_new_stage := 'Remarketing IA';
      v_new_urgency := 'Pausado';
    WHEN 'Lead_No_Calificado' THEN
      v_new_stage := 'Remarketing IA';
      v_new_urgency := 'Pausado';
    WHEN 'Lead_Calificado_Sin_Agenda' THEN
      v_new_stage := 'Reactivar Zoom';
      v_new_urgency := 'Rescate_Pendiente';
    WHEN 'Ocupado_Reintentar' THEN
      v_new_stage := NULL; -- mantener stage actual
      v_new_urgency := 'Rescate_Pendiente';
    WHEN 'No_Contesta_Buzon' THEN
      v_new_stage := NULL;
      v_new_urgency := 'Rescate_Pendiente';
    WHEN 'Enviar_Informacion' THEN
      v_new_stage := 'Seguimiento';
      v_new_urgency := 'Pausado';
    ELSE
      v_new_stage := NULL;
      v_new_urgency := NULL;
  END CASE;

  UPDATE leads SET
    stage = COALESCE(v_new_stage, stage),
    urgency_status = COALESCE(v_new_urgency, urgency_status),
    name = COALESCE(p_extracted->>'nombre_real_cliente', name),
    email = COALESCE(p_extracted->>'lead_email', email),
    dolor_principal = COALESCE(p_extracted->>'dolor_principal', dolor_principal),
    contexto_previo = COALESCE(p_extracted->>'resumen_conversacion', contexto_previo),
    do_not_contact = CASE WHEN v_estado_final = 'No_Contactar' THEN true ELSE COALESCE(do_not_contact, false) END,
    selected_time = COALESCE((p_extracted->>'selected_time')::timestamptz, selected_time),
    next_action_at = CASE
      WHEN v_estado_final IN ('Ocupado_Reintentar','No_Contesta_Buzon') THEN NOW() + INTERVAL '30 minutes'
      WHEN v_estado_final = 'Lead_Calificado_Sin_Agenda' THEN NOW() + INTERVAL '24 hours'
      ELSE NULL
    END,
    updated_at = NOW(),
    notas = COALESCE(notas, '') ||
            E'\n[Sofía ' || NOW()::text || '] ' || v_estado_final ||
            CASE WHEN p_extracted->>'resumen_conversacion' IS NOT NULL
                 THEN ' | ' || (p_extracted->>'resumen_conversacion')
                 ELSE '' END
  WHERE id = p_lead_id;
END;
$$;

-- 5) Registrar asesoría agendada (webhook Cal.com)
CREATE OR REPLACE FUNCTION public.fn_sales_register_appointment(
  p_lead_id uuid,
  p_cal_event_id text,
  p_selected_time timestamptz,
  p_zoom_url text,
  p_cal_event_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE leads SET
    stage = 'Zoom Agendado',
    urgency_status = 'Agendado',
    cal_event_id = p_cal_event_id,
    cal_event_url = COALESCE(p_cal_event_url, cal_event_url),
    selected_time = p_selected_time,
    zoom_join_url = p_zoom_url,
    -- reset flags de recordatorios al re-agendar
    reminder_24h_sent_at = NULL,
    reminder_3h_sent_at = NULL,
    reminder_1h_sent_at = NULL,
    reminder_10min_sent_at = NULL,
    next_action_at = NULL,
    updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;
