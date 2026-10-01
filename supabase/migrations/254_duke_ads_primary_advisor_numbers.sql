-- 104_duke_ads_primary_advisor_numbers.sql
-- -----------------------------------------------------------------------------
-- Duke campaign launch pool: current priority advisor phone holders.
--
-- Source provided by operations sheet on 2026-08-12:
--   Marco        984 876 3357
--   Ken          984 218 1660
--   Carlos Reyes 984 179 4415
--
-- The name at the right of each sheet cell is treated as the current person
-- holding/using that WhatsApp number.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_pool_id uuid;
  v_carlos_reyes_id uuid;
  v_carlos_legacy_id uuid;
BEGIN
  INSERT INTO public.lead_assignment_pools (organization_id, pool_key, label, default_stage, active)
  VALUES (v_org, 'duke_ads_round_robin', 'Duke Ads - Round Robin', 'Contáctame Ya', true)
  ON CONFLICT (organization_id, pool_key) DO UPDATE
    SET label = EXCLUDED.label,
        default_stage = EXCLUDED.default_stage,
        active = true,
        updated_at = now()
  RETURNING id INTO v_pool_id;

  -- Confirm the current phone holders on their CRM profiles when those profiles
  -- already exist.
  UPDATE public.profiles
     SET phone = CASE name
       WHEN 'Marco Lopez' THEN '+529848763357'
       WHEN 'Ken Duke' THEN '+529842181660'
       ELSE phone
     END,
         active = true,
         updated_at = now()
   WHERE organization_id = v_org
     AND name IN ('Marco Lopez', 'Ken Duke');

  -- Prefer a dedicated Carlos Reyes profile if it already exists. If not, reuse
  -- the legacy Carlos slot that is already in the pool so routing works now.
  SELECT id INTO v_carlos_reyes_id
    FROM public.profiles
   WHERE organization_id = v_org
     AND name = 'Carlos Reyes'
   LIMIT 1;

  IF v_carlos_reyes_id IS NULL THEN
    SELECT id INTO v_carlos_legacy_id
      FROM public.profiles
     WHERE organization_id = v_org
       AND name = 'Carlos Ayala'
     LIMIT 1;

    IF v_carlos_legacy_id IS NOT NULL THEN
      UPDATE public.profiles
         SET name = 'Carlos Reyes',
             phone = '+529841794415',
             active = true,
             updated_at = now()
       WHERE id = v_carlos_legacy_id;
      v_carlos_reyes_id := v_carlos_legacy_id;
    END IF;
  ELSE
    UPDATE public.profiles
       SET phone = '+529841794415',
           active = true,
           updated_at = now()
     WHERE id = v_carlos_reyes_id;
  END IF;

  -- Ensure the three priority advisors are members of the campaign pool.
  INSERT INTO public.lead_assignment_pool_members (
    pool_id, asesor_id, asesor_name, sort_order, active, advisor_phone_e164
  )
  SELECT
    v_pool_id,
    p.id,
    p.name,
    CASE p.name
      WHEN 'Marco Lopez' THEN 10
      WHEN 'Ken Duke' THEN 20
      WHEN 'Carlos Reyes' THEN 30
      ELSE 100
    END,
    true,
    CASE p.name
      WHEN 'Marco Lopez' THEN '+529848763357'
      WHEN 'Ken Duke' THEN '+529842181660'
      WHEN 'Carlos Reyes' THEN '+529841794415'
      ELSE NULL
    END
  FROM public.profiles p
  WHERE p.organization_id = v_org
    AND p.active = true
    AND p.name IN ('Marco Lopez', 'Ken Duke', 'Carlos Reyes')
  ON CONFLICT (pool_id, asesor_id) DO UPDATE
    SET asesor_name = EXCLUDED.asesor_name,
        sort_order = EXCLUDED.sort_order,
        active = true,
        advisor_phone_e164 = EXCLUDED.advisor_phone_e164,
        updated_at = now();

  -- Keep other known advisors in Stratos, but keep this launch pool focused on
  -- the three currently requested phone holders.
  UPDATE public.lead_assignment_pool_members m
     SET active = false,
         updated_at = now()
    FROM public.profiles p
   WHERE m.pool_id = v_pool_id
     AND p.id = m.asesor_id
     AND p.organization_id = v_org
     AND p.name NOT IN ('Marco Lopez', 'Ken Duke', 'Carlos Reyes');

  -- Reset pointer so the next real lead starts with Marco, then Ken, then Carlos.
  UPDATE public.lead_assignment_pools
     SET last_assigned_member_id = NULL,
         updated_at = now()
   WHERE id = v_pool_id;
END $$;

NOTIFY pgrst, 'reload schema';
