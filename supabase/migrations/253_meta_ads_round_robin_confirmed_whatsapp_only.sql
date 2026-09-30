-- 103_meta_ads_round_robin_confirmed_whatsapp_only.sql
-- -----------------------------------------------------------------------------
-- Launch guardrail for the Duke Meta Ads round-robin pool.
--
-- A lead assigned to an advisor without a confirmed WhatsApp destination would
-- still appear in Stratos, but the advisor would not receive the immediate
-- WhatsApp alert. For the initial campaign, route only to advisors with a
-- confirmed destination; Ken/Carlos can be re-enabled by adding their full
-- E.164 phone numbers to lead_assignment_pool_members.advisor_phone_e164.
-- -----------------------------------------------------------------------------

UPDATE public.lead_assignment_pool_members m
   SET active = NULLIF(btrim(m.advisor_phone_e164), '') IS NOT NULL,
       updated_at = now()
  FROM public.lead_assignment_pools pool
 WHERE m.pool_id = pool.id
   AND pool.organization_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND pool.pool_key = 'duke_ads_round_robin';

-- If the last assigned member was disabled by the guardrail, restart the pointer
-- at the first eligible active member on the next assignment.
UPDATE public.lead_assignment_pools pool
   SET last_assigned_member_id = NULL,
       updated_at = now()
 WHERE pool.organization_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND pool.pool_key = 'duke_ads_round_robin'
   AND NOT EXISTS (
     SELECT 1
       FROM public.lead_assignment_pool_members m
      WHERE m.id = pool.last_assigned_member_id
        AND m.active = true
   );

NOTIFY pgrst, 'reload schema';
