-- ═══════════════════════════════════════════════════════════════════════════
-- 013_rpc_find_lead_duplicate.sql — Detección de leads duplicados al alta
-- ═══════════════════════════════════════════════════════════════════════════
-- Problema:
--   Cuando un asesor está registrando un cliente nuevo, no sabe si ese
--   teléfono o email ya existe en el CRM (asignado a OTRO asesor que él no
--   ve por RLS). El UNIQUE INDEX uniq_leads_org_phone ya bloquea inserción
--   por phone duplicado, pero el error que regresa es opaco ("duplicate key
--   violation"); el asesor no sabe quién es el dueño actual ni en qué etapa
--   está el lead.
--
-- Solución:
--   RPC SECURITY DEFINER que busca dentro de la organización del usuario
--   (multi-tenant safe — NUNCA cruza orgs) por email o teléfono normalizado,
--   y devuelve los datos mínimos del lead existente + asesor dueño. El
--   frontend lo llama mientras el usuario tipea, y muestra un banner
--   "Este cliente ya está registrado por X (etapa: Y, desde: Z)".
--
-- Datos devueltos:
--   - lead_id, lead_name, lead_stage, lead_created_at
--   - asesor_id, asesor_name  → para que el frontend muestre quién lo tiene
--   - is_mine (boolean)       → si el lead pertenece al usuario que llama,
--                               para mostrar mensaje distinto ("ya lo tienes")
--   - match_type              → 'email' | 'phone' | 'both'
--
-- Seguridad:
--   - SECURITY DEFINER: bypassa RLS para poder ver leads de otros asesores
--     en la MISMA organización. NUNCA devuelve leads de otra org.
--   - Solo devuelve {id, name, stage, asesor_*} — datos no sensibles que el
--     asesor ya sabría al hablar con el cliente. NO devuelve presupuesto,
--     notas, ni datos de contacto adicionales.
--   - GRANT EXECUTE solo a authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.find_lead_duplicate(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS TABLE (
  lead_id         uuid,
  lead_name       text,
  lead_stage      text,
  lead_created_at timestamptz,
  asesor_id       uuid,
  asesor_name     text,
  is_mine         boolean,
  match_type      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id        uuid := auth.uid();
  v_caller_org       uuid;
  v_caller_name      text;
  v_email_norm       text;
  v_phone_norm       text;
BEGIN
  -- Sin sesión no respondemos nada (defensa en profundidad).
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolvemos org + nombre del usuario actual UNA vez.
  SELECT p.organization_id, p.name
    INTO v_caller_org, v_caller_name
    FROM public.profiles p
   WHERE p.id = v_caller_id;

  -- Si el usuario no tiene org (raro), no podemos buscar de forma segura.
  IF v_caller_org IS NULL THEN
    RETURN;
  END IF;

  -- Normalizamos inputs igual que el trigger normalize_lead_phone_trigger:
  --   · email   → lower + trim
  --   · phone   → solo dígitos
  v_email_norm := NULLIF(lower(btrim(p_email)), '');
  v_phone_norm := NULLIF(regexp_replace(COALESCE(p_phone,''), '[^0-9]', '', 'g'), '');

  -- Si no hay nada con qué buscar, salimos vacíos.
  IF v_email_norm IS NULL AND v_phone_norm IS NULL THEN
    RETURN;
  END IF;

  -- Buscamos el lead más reciente que matchea, dentro de la organización.
  -- Excluimos soft-deleted. Priorizamos match por TELÉFONO (señal más fuerte
  -- que email — varios miembros de una familia pueden compartir email).
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.stage,
    l.created_at,
    l.asesor_id,
    l.asesor_name,
    (l.asesor_id = v_caller_id)
      OR (l.asesor_name IS NOT NULL AND lower(btrim(l.asesor_name)) = lower(btrim(v_caller_name)))
        AS is_mine,
    CASE
      WHEN v_email_norm IS NOT NULL AND v_phone_norm IS NOT NULL
           AND lower(btrim(l.email)) = v_email_norm
           AND l.phone_normalized   = v_phone_norm THEN 'both'
      WHEN v_phone_norm IS NOT NULL AND l.phone_normalized = v_phone_norm THEN 'phone'
      WHEN v_email_norm IS NOT NULL AND lower(btrim(l.email)) = v_email_norm THEN 'email'
      ELSE NULL
    END AS match_type
  FROM public.leads l
  WHERE l.organization_id = v_caller_org
    AND l.deleted_at IS NULL
    AND (
      (v_phone_norm IS NOT NULL AND l.phone_normalized = v_phone_norm)
      OR
      (v_email_norm IS NOT NULL AND l.email IS NOT NULL AND lower(btrim(l.email)) = v_email_norm)
    )
  ORDER BY
    -- Phone match gana sobre email match (más confiable)
    CASE WHEN v_phone_norm IS NOT NULL AND l.phone_normalized = v_phone_norm THEN 0 ELSE 1 END,
    -- Lead más reciente primero
    l.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_lead_duplicate(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_lead_duplicate(text, text) TO authenticated;

COMMENT ON FUNCTION public.find_lead_duplicate(text, text) IS
  'Devuelve el lead existente (mismo org) que matchea email o phone — incluso si '
  'pertenece a otro asesor (bypassa RLS via SECURITY DEFINER). El frontend lo '
  'llama mientras el asesor escribe en el modal Registrar, para avisar antes de '
  'crear un duplicado. Datos devueltos son mínimos: id, name, stage, asesor, '
  'is_mine, match_type. NUNCA cruza organizaciones.';

-- Índice funcional para acelerar el match por email (lower(btrim(email))).
-- Filtra deleted_at IS NULL y email IS NOT NULL para mantenerlo pequeño.
-- El match por phone ya está cubierto por uniq_leads_org_phone.
CREATE INDEX IF NOT EXISTS idx_leads_org_email_lower
  ON public.leads (organization_id, lower(btrim(email)))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';
