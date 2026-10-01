-- 101_meta_ads_round_robin.sql
-- -----------------------------------------------------------------------------
-- Meta Ads / Lead Ads -> Stratos CRM with HubSpot-style round-robin assignment.
--
-- Why:
--   The current Duke flow has point-to-point handoffs (iAgents -> Gael/Oscar)
--   and dedicated-number upserts. For campaigns that should distribute new
--   clients across several advisors, n8n needs a single RPC that:
--     1) upserts the lead,
--     2) puts it in the first pipeline stage,
--     3) assigns it to the next active advisor in a pool,
--     4) keeps existing owners on duplicate/revived leads.
--
-- Source campaign analyzed on 2026-08-11:
--   DUKE DEL CARIBE MKT (661863492474992)
--   GAEL - BAY VIEW GRAND 2026 no9295
--   Ad: VIDEO TOUR BAY VIEW GRAND
--   Objective: messaging / WhatsApp conversations
-- -----------------------------------------------------------------------------

-- Extra metadata columns for Meta attribution. These are nullable and additive.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_lead_id     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_form_id     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_page_id     text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_campaign_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_adset_id    text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_ad_id       text;

CREATE INDEX IF NOT EXISTS idx_leads_meta_lead_id
  ON public.leads (organization_id, meta_lead_id)
  WHERE meta_lead_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_meta_campaign_id
  ON public.leads (organization_id, meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.lead_assignment_pools (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id),
  pool_key                text NOT NULL,
  label                   text NOT NULL,
  strategy                text NOT NULL DEFAULT 'round_robin'
                          CHECK (strategy IN ('round_robin')),
  default_stage           text NOT NULL DEFAULT 'Contáctame Ya',
  active                  boolean NOT NULL DEFAULT true,
  last_assigned_member_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pool_key)
);

CREATE TABLE IF NOT EXISTS public.lead_assignment_pool_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id          uuid NOT NULL REFERENCES public.lead_assignment_pools(id) ON DELETE CASCADE,
  asesor_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asesor_name      text NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  weight           integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  sort_order       integer NOT NULL DEFAULT 100,
  assigned_count   integer NOT NULL DEFAULT 0,
  last_assigned_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, asesor_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_assignment_pools_last_member_fk'
      AND conrelid = 'public.lead_assignment_pools'::regclass
  ) THEN
    ALTER TABLE public.lead_assignment_pools
      ADD CONSTRAINT lead_assignment_pools_last_member_fk
      FOREIGN KEY (last_assigned_member_id)
      REFERENCES public.lead_assignment_pool_members(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignment_members_pool_active
  ON public.lead_assignment_pool_members (pool_id, active, sort_order, id);

ALTER TABLE public.lead_assignment_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_pool_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_pools_select_org ON public.lead_assignment_pools;
CREATE POLICY assignment_pools_select_org ON public.lead_assignment_pools
  FOR SELECT USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS assignment_pool_members_select_org ON public.lead_assignment_pool_members;
CREATE POLICY assignment_pool_members_select_org ON public.lead_assignment_pool_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lead_assignment_pools p
      WHERE p.id = lead_assignment_pool_members.pool_id
        AND p.organization_id = public.current_organization_id()
    )
  );

-- Admin-style writes from the app are allowed for mando roles. n8n uses
-- service_role and bypasses RLS, but these policies keep future UI management
-- sane without granting advisors control of routing.
DROP POLICY IF EXISTS assignment_pools_admin_write ON public.lead_assignment_pools;
CREATE POLICY assignment_pools_admin_write ON public.lead_assignment_pools
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = lead_assignment_pools.organization_id
        AND p.role IN ('super_admin','admin','ceo','director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = lead_assignment_pools.organization_id
        AND p.role IN ('super_admin','admin','ceo','director')
    )
  );

DROP POLICY IF EXISTS assignment_pool_members_admin_write ON public.lead_assignment_pool_members;
CREATE POLICY assignment_pool_members_admin_write ON public.lead_assignment_pool_members
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.lead_assignment_pools lap
      JOIN public.profiles p ON p.organization_id = lap.organization_id
      WHERE lap.id = lead_assignment_pool_members.pool_id
        AND p.id = auth.uid()
        AND p.role IN ('super_admin','admin','ceo','director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lead_assignment_pools lap
      JOIN public.profiles p ON p.organization_id = lap.organization_id
      WHERE lap.id = lead_assignment_pool_members.pool_id
        AND p.id = auth.uid()
        AND p.role IN ('super_admin','admin','ceo','director')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_meta_payload_text(payload jsonb, p_keys text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  k text;
  arr jsonb;
  entry jsonb;
  v text;
  data_arrays jsonb[];
BEGIN
  FOREACH k IN ARRAY p_keys LOOP
    v := NULLIF(btrim(COALESCE(
      payload ->> k,
      payload #>> ARRAY['lead', k],
      payload #>> ARRAY['data', k],
      payload #>> ARRAY['contact', k],
      payload #>> ARRAY['fields', k]
    )), '');
    IF v IS NOT NULL THEN
      RETURN v;
    END IF;
  END LOOP;

  data_arrays := ARRAY[
    COALESCE(payload -> 'field_data', '[]'::jsonb),
    COALESCE(payload #> '{lead,field_data}', '[]'::jsonb),
    COALESCE(payload #> '{data,field_data}', '[]'::jsonb),
    COALESCE(payload #> '{fields,field_data}', '[]'::jsonb)
  ];

  FOREACH arr IN ARRAY data_arrays LOOP
    IF jsonb_typeof(arr) = 'array' THEN
      FOR entry IN SELECT value FROM jsonb_array_elements(arr) LOOP
        FOREACH k IN ARRAY p_keys LOOP
          IF lower(COALESCE(entry ->> 'name', entry ->> 'key', '')) = lower(k) THEN
            v := NULLIF(btrim(COALESCE(
              entry #>> '{values,0}',
              entry ->> 'value',
              entry ->> 'answer'
            )), '');
            IF v IS NOT NULL THEN
              RETURN v;
            END IF;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_next_lead_assignment(
  p_pool_key text,
  p_organization_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pool public.lead_assignment_pools%ROWTYPE;
  v_last_order integer;
  v_last_id uuid;
  v_member public.lead_assignment_pool_members%ROWTYPE;
BEGIN
  SELECT *
    INTO v_pool
  FROM public.lead_assignment_pools
  WHERE organization_id = p_organization_id
    AND pool_key = p_pool_key
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pool_not_found', 'pool_key', p_pool_key);
  END IF;

  SELECT sort_order, id
    INTO v_last_order, v_last_id
  FROM public.lead_assignment_pool_members
  WHERE id = v_pool.last_assigned_member_id
    AND pool_id = v_pool.id
    AND active = true;

  SELECT *
    INTO v_member
  FROM public.lead_assignment_pool_members
  WHERE pool_id = v_pool.id
    AND active = true
    AND (
      v_last_order IS NULL
      OR (sort_order, id) > (v_last_order, v_last_id)
    )
  ORDER BY sort_order, id
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT *
      INTO v_member
    FROM public.lead_assignment_pool_members
    WHERE pool_id = v_pool.id
      AND active = true
    ORDER BY sort_order, id
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pool_has_no_active_members', 'pool_key', p_pool_key);
  END IF;

  UPDATE public.lead_assignment_pool_members
     SET assigned_count = assigned_count + 1,
         last_assigned_at = now(),
         asesor_name = (
           SELECT p.name FROM public.profiles p WHERE p.id = v_member.asesor_id
         ),
         updated_at = now()
   WHERE id = v_member.id
   RETURNING * INTO v_member;

  UPDATE public.lead_assignment_pools
     SET last_assigned_member_id = v_member.id,
         updated_at = now()
   WHERE id = v_pool.id;

  RETURN jsonb_build_object(
    'ok', true,
    'pool_id', v_pool.id,
    'pool_key', v_pool.pool_key,
    'member_id', v_member.id,
    'asesor_id', v_member.asesor_id,
    'asesor_name', v_member.asesor_name,
    'assigned_count', v_member.assigned_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_upsert_lead_from_meta_ads(
  payload jsonb,
  p_pool_key text DEFAULT 'duke_ads_round_robin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_phone text;
  v_phone_norm text;
  v_name text;
  v_email text;
  v_budget_text text;
  v_budget_num bigint;
  v_project text;
  v_campaign text;
  v_source text;
  v_meta_lead_id text;
  v_meta_form_id text;
  v_meta_page_id text;
  v_meta_campaign_id text;
  v_meta_adset_id text;
  v_meta_ad_id text;
  v_lead_id uuid;
  v_existing boolean := false;
  v_needs_owner boolean := true;
  v_current_owner text;
  v_current_owner_id uuid;
  v_assignment jsonb;
  v_asesor_id uuid;
  v_asesor_name text;
  v_stage text := 'Contáctame Ya';
BEGIN
  v_phone := public.fn_meta_payload_text(payload, ARRAY[
    'phone','phone_number','mobile_phone','telefono','teléfono','whatsapp',
    'whatsapp_phone','numero','número','numero_de_telefono','numero_de_whatsapp'
  ]);
  v_phone_norm := regexp_replace(COALESCE(v_phone, ''), '[^0-9]', '', 'g');

  IF v_phone IS NULL OR length(v_phone_norm) < 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_missing_or_invalid');
  END IF;

  v_name := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY[
      'full_name','fullname','name','nombre','nombre_completo','first_name'
    ]),
    'Sin Nombre'
  );
  v_email := public.fn_meta_payload_text(payload, ARRAY['email','correo','correo_electronico']);
  v_budget_text := public.fn_meta_payload_text(payload, ARRAY['budget','presupuesto','rango_presupuesto']);
  v_budget_num := NULLIF(regexp_replace(COALESCE(v_budget_text, ''), '[^0-9]', '', 'g'), '')::bigint;

  v_project := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['project','proyecto','development','desarrollo']),
    'Duke desarrollos desde USD 97,000'
  );
  v_campaign := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['campaign_name','campaign','campana','campaña']),
    'Duke desarrollos desde USD 97,000'
  );
  v_source := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['source','utm_source','platform']),
    'meta_ads'
  );

  v_meta_lead_id := public.fn_meta_payload_text(payload, ARRAY['leadgen_id','lead_id','meta_lead_id']);
  v_meta_form_id := public.fn_meta_payload_text(payload, ARRAY['form_id','meta_form_id']);
  v_meta_page_id := public.fn_meta_payload_text(payload, ARRAY['page_id','meta_page_id']);
  v_meta_campaign_id := public.fn_meta_payload_text(payload, ARRAY['campaign_id','meta_campaign_id']);
  v_meta_adset_id := public.fn_meta_payload_text(payload, ARRAY['adset_id','adgroup_id','meta_adset_id']);
  v_meta_ad_id := public.fn_meta_payload_text(payload, ARRAY['ad_id','meta_ad_id']);

  IF v_meta_lead_id IS NOT NULL THEN
    SELECT id, asesor_name, asesor_id
      INTO v_lead_id, v_current_owner, v_current_owner_id
    FROM public.leads
    WHERE organization_id = v_org_id
      AND meta_lead_id = v_meta_lead_id
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT id, asesor_name, asesor_id
      INTO v_lead_id, v_current_owner, v_current_owner_id
    FROM public.leads
    WHERE organization_id = v_org_id
      AND (
        phone_normalized = v_phone_norm
        OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_phone_norm
        OR regexp_replace(COALESCE(whatsapp_phone_e164, ''), '[^0-9]', '', 'g') = v_phone_norm
      )
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    v_existing := true;
    v_needs_owner := COALESCE(NULLIF(btrim(v_current_owner), ''), 'iAgents') = 'iAgents';
  END IF;

  IF v_needs_owner THEN
    v_assignment := public.fn_next_lead_assignment(p_pool_key, v_org_id);
    IF COALESCE((v_assignment ->> 'ok')::boolean, false) THEN
      v_asesor_id := (v_assignment ->> 'asesor_id')::uuid;
      v_asesor_name := v_assignment ->> 'asesor_name';
    ELSE
      SELECT id, name
        INTO v_asesor_id, v_asesor_name
      FROM public.profiles
      WHERE organization_id = v_org_id
        AND active = true
        AND name IN ('Gael G','Ken Duke','Cecilia Mendoza','Marco Lopez','Carlos Ayala')
      ORDER BY CASE name
        WHEN 'Gael G' THEN 1
        WHEN 'Ken Duke' THEN 2
        WHEN 'Cecilia Mendoza' THEN 3
        WHEN 'Marco Lopez' THEN 4
        WHEN 'Carlos Ayala' THEN 5
        ELSE 99
      END
      LIMIT 1;
    END IF;
  ELSE
    v_asesor_id := v_current_owner_id;
    v_asesor_name := v_current_owner;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.leads SET
      name = CASE
        WHEN name IS NULL OR btrim(name) = '' OR name = 'Sin Nombre' THEN v_name
        ELSE name
      END,
      email = COALESCE(email, v_email),
      phone = COALESCE(phone, v_phone),
      phone_normalized = COALESCE(phone_normalized, v_phone_norm),
      whatsapp_phone_e164 = COALESCE(whatsapp_phone_e164, v_phone),
      source = COALESCE(NULLIF(source, ''), v_source),
      stage = CASE
        WHEN stage IN ('Contactame Ya','Contáctame Ya','Contáctame ya','Segundo Intento','Tercer Intento','Rotación','Remarketing IA','Remarketing')
          THEN v_stage
        ELSE stage
      END,
      budget = COALESCE(budget, v_budget_text),
      presupuesto = COALESCE(NULLIF(presupuesto, 0), v_budget_num, presupuesto),
      project = COALESCE(project, v_project),
      campaign = COALESCE(campaign, v_campaign),
      asesor_id = COALESCE(v_asesor_id, asesor_id),
      asesor_name = COALESCE(v_asesor_name, asesor_name),
      meta_lead_id = COALESCE(meta_lead_id, v_meta_lead_id),
      meta_form_id = COALESCE(meta_form_id, v_meta_form_id),
      meta_page_id = COALESCE(meta_page_id, v_meta_page_id),
      meta_campaign_id = COALESCE(meta_campaign_id, v_meta_campaign_id),
      meta_adset_id = COALESCE(meta_adset_id, v_meta_adset_id),
      meta_ad_id = COALESCE(meta_ad_id, v_meta_ad_id),
      is_new = true,
      updated_at = now(),
      last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
      days_inactive = 0
    WHERE id = v_lead_id;
  ELSE
    INSERT INTO public.leads (
      name, email, phone, phone_normalized, whatsapp_phone_e164,
      source, stage, budget, presupuesto, project, campaign,
      asesor_name, asesor_id, organization_id,
      hot, priority, tag, is_new, bio,
      meta_lead_id, meta_form_id, meta_page_id, meta_campaign_id, meta_adset_id, meta_ad_id,
      created_at, updated_at, last_activity, fecha_ingreso
    ) VALUES (
      v_name, v_email, v_phone, v_phone_norm, v_phone,
      v_source, v_stage, v_budget_text, COALESCE(v_budget_num, 0), v_project, v_campaign,
      COALESCE(v_asesor_name, 'iAgents'), v_asesor_id, v_org_id,
      true, 'alta', 'meta_ads', true, NULL,
      v_meta_lead_id, v_meta_form_id, v_meta_page_id, v_meta_campaign_id, v_meta_adset_id, v_meta_ad_id,
      now(), now(), to_char(now(), 'YYYY-MM-DD HH24:MI'), now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  INSERT INTO public.expediente_items (
    lead_id, organization_id, tipo, titulo, descripcion, asesor_id, metadata
  ) VALUES (
    v_lead_id, v_org_id, 'nota', 'Lead de Meta Ads',
    CASE
      WHEN v_existing THEN 'Lead actualizado desde Meta Ads; se conserva owner si ya tenia asesor.'
      ELSE 'Lead nuevo capturado desde Meta Ads y asignado por round-robin.'
    END,
    v_asesor_id,
    jsonb_build_object(
      'source', 'meta_ads_round_robin',
      'pool_key', p_pool_key,
      'assignment', COALESCE(v_assignment, '{}'::jsonb),
      'campaign', v_campaign,
      'project', v_project,
      'meta_lead_id', v_meta_lead_id,
      'meta_form_id', v_meta_form_id,
      'meta_page_id', v_meta_page_id,
      'meta_campaign_id', v_meta_campaign_id,
      'meta_adset_id', v_meta_adset_id,
      'meta_ad_id', v_meta_ad_id,
      'payload', payload
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'existed', v_existing,
    'stage', v_stage,
    'asesor_id', v_asesor_id,
    'asesor_name', COALESCE(v_asesor_name, 'iAgents'),
    'pool_key', p_pool_key,
    'assignment', COALESCE(v_assignment, '{}'::jsonb),
    'meta_lead_id', v_meta_lead_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_meta_payload_text(jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_next_lead_assignment(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_meta_payload_text(jsonb, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_next_lead_assignment(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) IS
  'n8n entrypoint for Meta Lead Ads/WhatsApp campaign leads. Upserts by '
  'meta_lead_id or phone, moves early-stage leads to Contáctame Ya, and assigns '
  'new/unowned leads by round-robin pool.';

-- Default Duke pool. Inserts only advisors that already exist as active profiles.
DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_pool_id uuid;
BEGIN
  INSERT INTO public.lead_assignment_pools (organization_id, pool_key, label, default_stage)
  VALUES (v_org, 'duke_ads_round_robin', 'Duke Ads - Round Robin', 'Contáctame Ya')
  ON CONFLICT (organization_id, pool_key) DO UPDATE
    SET label = EXCLUDED.label,
        default_stage = EXCLUDED.default_stage,
        active = true,
        updated_at = now()
  RETURNING id INTO v_pool_id;

  INSERT INTO public.lead_assignment_pool_members (pool_id, asesor_id, asesor_name, sort_order)
  SELECT v_pool_id, p.id, p.name,
         CASE p.name
           WHEN 'Gael G' THEN 10
           WHEN 'Ken Duke' THEN 20
           WHEN 'Cecilia Mendoza' THEN 30
           WHEN 'Marco Lopez' THEN 40
           WHEN 'Carlos Ayala' THEN 50
           ELSE 100
         END
  FROM public.profiles p
  WHERE p.organization_id = v_org
    AND p.active = true
    AND p.name IN (
      'Gael G',
      'Ken Duke',
      'Cecilia Mendoza',
      'Marco Lopez',
      'Carlos Ayala'
    )
  ON CONFLICT (pool_id, asesor_id) DO UPDATE
    SET asesor_name = EXCLUDED.asesor_name,
        active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
END $$;

NOTIFY pgrst, 'reload schema';
