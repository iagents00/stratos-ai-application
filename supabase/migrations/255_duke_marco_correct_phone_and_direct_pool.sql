-- 105_duke_marco_correct_phone_and_direct_pool.sql
-- -----------------------------------------------------------------------------
-- Correct Marco's current WhatsApp holder number and prepare a Marco-only pool
-- for advisor-specific Duke ad URLs such as:
--   /duke/desarrollos-97k?advisor=marco
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_profile_id uuid;
  v_pool_id uuid;
BEGIN
  SELECT id
    INTO v_profile_id
    FROM public.profiles
   WHERE organization_id = v_org
     AND name IN ('Marco Lopez', 'Marco')
   ORDER BY CASE WHEN name = 'Marco Lopez' THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
       SET phone = '+529848763357',
           active = true,
           updated_at = now()
     WHERE id = v_profile_id;
  END IF;

  INSERT INTO public.lead_assignment_pools (organization_id, pool_key, label, default_stage, active)
  VALUES (v_org, 'duke_ads_marco', 'Duke Ads - Marco', 'Contáctame Ya', true)
  ON CONFLICT (organization_id, pool_key) DO UPDATE
    SET label = EXCLUDED.label,
        default_stage = EXCLUDED.default_stage,
        active = true,
        updated_at = now()
  RETURNING id INTO v_pool_id;

  IF v_profile_id IS NOT NULL THEN
    INSERT INTO public.lead_assignment_pool_members (
      pool_id, asesor_id, asesor_name, sort_order, active, advisor_phone_e164
    )
    SELECT v_pool_id, p.id, p.name, 10, true, '+529848763357'
      FROM public.profiles p
     WHERE p.id = v_profile_id
    ON CONFLICT (pool_id, asesor_id) DO UPDATE
      SET asesor_name = EXCLUDED.asesor_name,
          sort_order = EXCLUDED.sort_order,
          active = true,
          advisor_phone_e164 = EXCLUDED.advisor_phone_e164,
          updated_at = now();

    UPDATE public.lead_assignment_pool_members
       SET active = false,
           updated_at = now()
     WHERE pool_id = v_pool_id
       AND asesor_id <> v_profile_id;

    UPDATE public.lead_assignment_pools
       SET last_assigned_member_id = NULL,
           updated_at = now()
     WHERE id = v_pool_id;
  END IF;

  UPDATE public.lead_assignment_pool_members m
     SET advisor_phone_e164 = '+529848763357',
         active = true,
         updated_at = now()
    FROM public.lead_assignment_pools pool
    JOIN public.profiles p ON p.organization_id = pool.organization_id
   WHERE m.pool_id = pool.id
     AND m.asesor_id = p.id
     AND pool.organization_id = v_org
     AND pool.pool_key = 'duke_ads_round_robin'
     AND p.name IN ('Marco Lopez', 'Marco');
END $$;

NOTIFY pgrst, 'reload schema';
