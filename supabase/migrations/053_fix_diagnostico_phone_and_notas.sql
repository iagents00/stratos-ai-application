-- 053_fix_diagnostico_phone_and_notas.sql
-- Bug fix: el CRM lee `phone` (no `whatsapp_phone_e164`) y el campo "Notas del
-- expediente" lee `notas`. La version original de fn_sales_upsert_lead_from_diagnostico
-- no escribia ninguno de los dos, asi que los leads quedaban sin telefono visible
-- ni resumen del diagnostico en el UI.
--
-- Este parche:
--   1. CREATE OR REPLACE de la funcion para escribir phone + notas
--   2. Backfill UPDATE de leads ya existentes en Stratos Sales sin phone/notas
--
-- Idempotente: aplicar varias veces no causa estragos (la condicion del UPDATE
-- exige phone IS NULL para hacer backfill, asi que no sobreescribe ediciones
-- manuales posteriores).

-- Actualiza fn_sales_upsert_lead_from_diagnostico para escribir tambien:
--   - phone (la columna canonical que muestra el CRM)
--   - notas (resumen humano-leible del diagnostico visible en la UI)
-- + Backfill del lead de Angel Garzon que ya esta en la DB.

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
  v_notas text;
BEGIN
  v_phone := p_payload->>'whatsapp';
  v_email := p_payload->>'email';
  v_name := COALESCE(p_payload->>'name', 'Sin nombre');

  -- Construye nota legible que aparece en la seccion "Notas del expediente" del CRM
  v_notas := E'[Diagnostico Stratos AI · ' || to_char(NOW() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') || E']\n'
          || E'Score: ' || COALESCE(p_payload->>'score', '?') || E'/100 · Nivel: ' || COALESCE(p_payload->>'level','-') || E'\n'
          || E'Modulo recomendado: ' || COALESCE(p_payload->>'aiosRecommended','-') || E'\n\n'
          || E'Dolor principal: ' || COALESCE(p_payload->>'pain','-') || E'\n\n'
          || E'Resumen ejecutivo:\n' || COALESCE(p_payload->>'summary','-');

  -- Upsert por (organization_id, whatsapp_phone_e164)
  SELECT id INTO v_lead_id
  FROM leads
  WHERE organization_id = p_org_id
    AND whatsapp_phone_e164 = v_phone
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      organization_id, name, email,
      phone,                              -- NUEVO: la columna canonical
      whatsapp_phone_e164, voice_phone_e164,
      stage, urgency_status, source,
      diagnostico_payload, diagnostico_score, diagnostico_nivel, diagnostico_recomendacion,
      dolor_principal, contexto_previo,
      notas,                              -- NUEVO: resumen legible
      next_action_at, fecha_ingreso, created_at, updated_at
    ) VALUES (
      p_org_id, v_name, v_email,
      v_phone,
      v_phone, v_phone,
      'Contáctame Ya', 'Rescate_Pendiente', COALESCE(p_payload->>'source', 'diagnostico_stratos'),
      p_payload,
      NULLIF(p_payload->>'score','')::int,
      p_payload->>'level',
      p_payload->>'aiosRecommended',
      p_payload->>'pain',
      p_payload->>'summary',
      v_notas,
      NOW() + INTERVAL '5 minutes', NOW(), NOW(), NOW()
    )
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE leads SET
      name = COALESCE(v_name, name),
      email = COALESCE(v_email, email),
      phone = COALESCE(phone, v_phone),    -- NUEVO: rellena phone si esta vacio
      stage = 'Contáctame Ya',
      urgency_status = 'Rescate_Pendiente',
      diagnostico_payload = p_payload,
      diagnostico_score = COALESCE(NULLIF(p_payload->>'score','')::int, diagnostico_score),
      diagnostico_nivel = COALESCE(p_payload->>'level', diagnostico_nivel),
      diagnostico_recomendacion = COALESCE(p_payload->>'aiosRecommended', diagnostico_recomendacion),
      dolor_principal = COALESCE(p_payload->>'pain', dolor_principal),
      contexto_previo = COALESCE(p_payload->>'summary', contexto_previo),
      notas = COALESCE(notas, '') || E'\n\n' || v_notas,   -- NUEVO: append nuevo diagnostico
      next_action_at = NOW() + INTERVAL '5 minutes',
      updated_at = NOW()
    WHERE id = v_lead_id;
  END IF;

  RETURN v_lead_id;
END;
$$;

-- Backfill: rellenar phone + notas en el lead de Angel Garzon que ya existia
UPDATE leads
SET
  phone = whatsapp_phone_e164,
  notas = E'[Diagnostico Stratos AI · ' || to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') || E' · backfill]\n'
       || E'Score: ' || COALESCE(diagnostico_score::text, '?') || E'/100 · Nivel: ' || COALESCE(diagnostico_nivel,'-') || E'\n'
       || E'Modulo recomendado: ' || COALESCE(diagnostico_recomendacion,'-') || E'\n\n'
       || E'Dolor principal: ' || COALESCE(dolor_principal,'-') || E'\n\n'
       || E'Resumen ejecutivo:\n' || COALESCE(contexto_previo,'-'),
  updated_at = NOW()
WHERE organization_id = 'b1145073-434c-4779-a243-d5e8f5ff3617'
  AND phone IS NULL
  AND deleted_at IS NULL
  AND whatsapp_phone_e164 IS NOT NULL
  AND diagnostico_payload IS NOT NULL
RETURNING id, name, phone, LEFT(notas, 60) AS notas_preview;
