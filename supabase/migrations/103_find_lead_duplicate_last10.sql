-- ═══════════════════════════════════════════════════════════════════════════
-- 103_find_lead_duplicate_last10.sql — Detección de duplicados robusta al código de país
-- ═══════════════════════════════════════════════════════════════════════════
-- Problema (reportado jul 2026):
--   La detección de duplicados al registrar (find_lead_duplicate, mig. 013)
--   comparaba el teléfono COMPLETO exacto (phone_normalized = input). Entonces
--   si el cliente ya estaba guardado como "+5219842803001" y el asesor lo
--   tecleaba SIN el código de país ("9842803001"), NO lo reconocía como
--   duplicado y lo dejaba registrar dos veces. Igual pasaba con los números de
--   Estados Unidos (+1): sin el "1" no matcheaba.
--
-- Solución:
--   Comparar por los ÚLTIMOS 10 DÍGITOS (el número nacional, que es igual para
--   México y USA/Canadá). Así se reconocen como el MISMO cliente, sin importar
--   si el asesor puso o no el código de país:
--     +5219842803001 · 529842803001 · 9842803001  → tail "9842803001"
--     +13105550100   · 13105550100  · 3105550100  → tail "3105550100"
--   right(x,10) devuelve la cadena completa si es más corta, así que números
--   de <10 dígitos siguen comparándose de forma exacta (sin falsos positivos:
--   cadenas de distinta longitud nunca son iguales).
--
-- Alcance / seguridad:
--   · SOLO cambia la DETECCIÓN al alta (el banner del modal "Registrar").
--     NOTA: create_lead (mig. 102, PR #410) REUSA find_lead_duplicate para
--     bloquear el ALTA server-side, así que este cambio también hace ese
--     candado robusto al código de país — sin tocar create_lead.
--   · NO toca `phone_normalized` (lo generan y consumen el bot de Telegram,
--     WhatsApp, Chatwoot y Retell con match EXACTO — cambiarlo sería peligroso).
--   · NO toca el índice único uniq_leads_org_phone.
--   · Sigue siendo SECURITY DEFINER + org-scoped: NUNCA cruza organizaciones.
--
-- Reversible:
--   Volver a la versión de la migración 013 (CREATE OR REPLACE) restaura el
--   comportamiento anterior. El índice nuevo se puede DROP sin efecto funcional.
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
  v_phone_tail       text;
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
  -- Últimos 10 dígitos = número nacional (MX/USA). Comparamos por acá para que
  -- el código de país (o su ausencia) no impida reconocer el duplicado.
  v_phone_tail := NULLIF(right(v_phone_norm, 10), '');

  -- Si no hay nada con qué buscar, salimos vacíos.
  IF v_email_norm IS NULL AND v_phone_tail IS NULL THEN
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
      WHEN v_email_norm IS NOT NULL AND v_phone_tail IS NOT NULL
           AND lower(btrim(l.email)) = v_email_norm
           AND l.phone_normalized IS NOT NULL
           AND right(l.phone_normalized, 10) = v_phone_tail THEN 'both'
      WHEN v_phone_tail IS NOT NULL AND l.phone_normalized IS NOT NULL
           AND right(l.phone_normalized, 10) = v_phone_tail THEN 'phone'
      WHEN v_email_norm IS NOT NULL AND lower(btrim(l.email)) = v_email_norm THEN 'email'
      ELSE NULL
    END AS match_type
  FROM public.leads l
  WHERE l.organization_id = v_caller_org
    AND l.deleted_at IS NULL
    AND (
      (v_phone_tail IS NOT NULL AND l.phone_normalized IS NOT NULL
         AND right(l.phone_normalized, 10) = v_phone_tail)
      OR
      (v_email_norm IS NOT NULL AND l.email IS NOT NULL AND lower(btrim(l.email)) = v_email_norm)
    )
  ORDER BY
    -- Phone match gana sobre email match (más confiable)
    CASE WHEN v_phone_tail IS NOT NULL AND l.phone_normalized IS NOT NULL
              AND right(l.phone_normalized, 10) = v_phone_tail THEN 0 ELSE 1 END,
    -- Lead más reciente primero
    l.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_lead_duplicate(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_lead_duplicate(text, text) TO authenticated;

COMMENT ON FUNCTION public.find_lead_duplicate(text, text) IS
  'Devuelve el lead existente (mismo org) que matchea email o teléfono por sus '
  'ÚLTIMOS 10 DÍGITOS (número nacional — así "9842803001" y "+5219842803001" son '
  'el mismo cliente; robusto al código de país MX/USA). Bypassa RLS via SECURITY '
  'DEFINER para avisar antes de crear un duplicado. NUNCA cruza organizaciones.';

-- Índice funcional para acelerar el match por los últimos 10 dígitos del teléfono.
CREATE INDEX IF NOT EXISTS idx_leads_org_phone_tail10
  ON public.leads (organization_id, right(phone_normalized, 10))
  WHERE deleted_at IS NULL AND phone_normalized IS NOT NULL;
