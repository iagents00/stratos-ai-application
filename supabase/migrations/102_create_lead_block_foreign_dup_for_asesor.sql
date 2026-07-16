-- ═══════════════════════════════════════════════════════════════════════════
-- 102_create_lead_block_foreign_dup_for_asesor.sql
--   Alta de lead: un ASESOR no puede registrar un cliente que YA existe en el
--   CRM a nombre de OTRO asesor. Solo admin/above.
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto:
--   La migración 101 cerró el override "Registrar de todas formas" (fn_claim_lead).
--   Pero el alta NORMAL entra por `create_lead`, que NO revisa duplicados: solo
--   confía en el índice único de teléfono (uniq_leads_org_phone). Eso deja huecos:
--     · duplicado por EMAIL (mismo cliente, teléfono distinto o sin teléfono),
--     · carrera de la detección del front (el asesor guarda antes de que el
--       banner aparezca), o simplemente un bundle viejo en caché.
--   En esos casos el asesor terminaba metiendo el cliente igual. Este candado lo
--   cierra a nivel DB, así funciona aunque el front no lo haya frenado.
--
-- Cómo:
--   `create_lead` NO es SECURITY DEFINER (corre como el caller, con RLS), así que
--   por sí sola no vería el lead de otro asesor. Reusamos `find_lead_duplicate`
--   (SECURITY DEFINER, ya existente y probada) que SÍ los ve, y `is_admin_or_above()`
--   para el gate de rol. Ambas usan auth.uid() (el JWT del asesor) internamente.
--
-- Alcance / seguridad:
--   · Admin/above (super_admin/admin/ceo/director) → sin cambios, registra igual.
--   · Asesor con cliente NUEVO (sin match de phone/email) → sin cambios.
--   · Asesor con match a SU PROPIO lead (is_mine) → sin cambios (puede duplicar lo suyo).
--   · Asesor con match a lead de OTRO asesor → RAISE 'insufficient_privilege' (42501).
--   · Único caller de la RPC `create_lead`: el frontend (lead-save/offline/backup),
--     siempre con JWT de usuario. (El "create_lead" del flujo n8n sheet-agent es una
--     herramienta de Google Sheets, NO esta RPC — no se ve afectado.)
--   · Reversible: CREATE OR REPLACE. La versión previa (sin el guard) está en Git
--     y era idéntica salvo este bloque.
--   · Aplicada a stratos-prod por MCP; se versiona acá.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_lead(payload jsonb)
RETURNS TABLE(lead_id uuid, lead_created_at timestamp with time zone, lead_organization_id uuid, was_inserted boolean)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id           uuid;
  v_returned_id  uuid;
  v_created_at   timestamptz;
  v_org_id       uuid;
  v_inserted     boolean;
  v_dup          record;
BEGIN
  v_id := COALESCE(NULLIF(payload->>'id','')::uuid, gen_random_uuid());

  -- ── Candado: asesor no puede registrar un cliente ya existente de OTRO asesor ──
  IF NOT public.is_admin_or_above() THEN
    SELECT d.lead_id, d.asesor_name, d.is_mine
      INTO v_dup
      FROM public.find_lead_duplicate(NULLIF(payload->>'email',''), NULLIF(payload->>'phone','')) d
      LIMIT 1;
    IF v_dup.lead_id IS NOT NULL AND COALESCE(v_dup.is_mine, false) = false THEN
      RAISE EXCEPTION 'Este cliente ya está registrado en el CRM por %. Solo un administrador puede registrarlo o reasignarlo.', COALESCE(v_dup.asesor_name, 'otro asesor')
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO public.leads (
    id, name, phone, email, stage, score, hot, is_new,
    budget, presupuesto, project, campaign, source,
    next_action, next_action_date, last_activity, days_inactive,
    seguimientos, bio, risk, friction, notas, tag,
    asesor_name, asesor_id
  )
  VALUES (
    v_id,
    payload->>'name',
    NULLIF(payload->>'phone',''),
    NULLIF(payload->>'email',''),
    COALESCE(NULLIF(payload->>'stage',''), 'Contáctame ya'),
    COALESCE((payload->>'score')::int, 5),
    COALESCE((payload->>'hot')::boolean, false),
    COALESCE((payload->>'is_new')::boolean, true),
    NULLIF(payload->>'budget',''),
    COALESCE((payload->>'presupuesto')::bigint, 0),
    NULLIF(payload->>'project',''),
    NULLIF(payload->>'campaign',''),
    COALESCE(NULLIF(payload->>'source',''), 'manual'),
    NULLIF(payload->>'next_action',''),
    NULLIF(payload->>'next_action_date',''),
    NULLIF(payload->>'last_activity',''),
    COALESCE((payload->>'days_inactive')::int, 0),
    COALESCE((payload->>'seguimientos')::int, 0),
    NULLIF(payload->>'bio',''),
    NULLIF(payload->>'risk',''),
    NULLIF(payload->>'friction',''),
    NULLIF(payload->>'notas',''),
    NULLIF(payload->>'tag',''),
    NULLIF(payload->>'asesor_name',''),
    NULLIF(payload->>'asesor_id','')::uuid
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING leads.id, leads.created_at, leads.organization_id
  INTO v_returned_id, v_created_at, v_org_id;

  IF v_returned_id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT l.created_at, l.organization_id
      INTO v_created_at, v_org_id
    FROM public.leads l
    WHERE l.id = v_id;
    v_inserted := false;
  END IF;

  RETURN QUERY SELECT v_id, v_created_at, v_org_id, v_inserted;
END;
$function$;
