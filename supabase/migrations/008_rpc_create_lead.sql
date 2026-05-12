-- ═══════════════════════════════════════════════════════════════════════════
-- 008_rpc_create_lead.sql — RPC facade idempotente para alta de leads
-- ═══════════════════════════════════════════════════════════════════════════
-- Problema que resuelve:
--   El INSERT directo desde el frontend (.from('leads').insert) no es
--   idempotente. Si el handler se dispara N veces (doble clic, retry de red),
--   se crean N filas duplicadas.
--
-- Solución:
--   El frontend genera un UUID localmente y se lo pasa a esta RPC. La RPC
--   intenta INSERT con ON CONFLICT (id) DO NOTHING. Si ya existe, devuelve
--   la fila existente con was_inserted=false. Si llega 10 veces con el mismo
--   id, sólo crea fila la primera.
--
-- Bonus de latencia:
--   El RETURN devuelve sólo {id, created_at, organization_id, was_inserted}
--   en lugar de SELECT * (que en lead-save.js anterior pasaba por las RLS
--   policies de SELECT que joinean profiles 3 veces). Reduce round-trip.
--
-- Seguridad:
--   SECURITY INVOKER → respeta RLS del usuario llamante. El trigger
--   set_org_id_from_actor de migración 005 sigue funcionando y rellena
--   organization_id automáticamente desde el JWT del asesor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_lead(payload jsonb)
RETURNS TABLE (
  lead_id              uuid,
  lead_created_at      timestamptz,
  lead_organization_id uuid,
  was_inserted         boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id           uuid;
  v_returned_id  uuid;
  v_created_at   timestamptz;
  v_org_id       uuid;
  v_inserted     boolean;
BEGIN
  -- Si el frontend mandó id (caso esperado), úsalo. Si no, generamos uno.
  v_id := COALESCE(NULLIF(payload->>'id','')::uuid, gen_random_uuid());

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
    COALESCE(NULLIF(payload->>'stage',''), 'Nuevo Registro'),
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
    -- Conflicto: la fila ya existía. Devolvemos sus datos actuales.
    SELECT l.created_at, l.organization_id
      INTO v_created_at, v_org_id
    FROM public.leads l
    WHERE l.id = v_id;
    v_inserted := false;
  END IF;

  RETURN QUERY SELECT v_id, v_created_at, v_org_id, v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead(jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_lead(jsonb) IS
  'Idempotent lead insert facade. Frontend passes a client-generated UUID; '
  'ON CONFLICT DO NOTHING blocks duplicates from double-submit / retry. '
  'Returns {id, created_at, organization_id, was_inserted}.';
