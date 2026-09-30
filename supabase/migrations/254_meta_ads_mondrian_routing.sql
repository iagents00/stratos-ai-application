-- 106_meta_ads_mondrian_routing.sql
-- -----------------------------------------------------------------------------
-- Duke / Marco Mondrian campaign routing.
--
-- Goal:
--   Meta Instant Forms must create the lead in Stratos as soon as the client
--   submits the prefilled form, even if they never click the post-submit
--   WhatsApp / landing-page CTA.
--
--   Leads from the Marco Mondrian draft are tagged and routed as:
--     project  = Mondrian
--     campaign = Duke Mondrian - Marco - Lead Ads
--     tag      = Mondrian
--     pool     = duke_ads_marco
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meta_ads_lead_routing_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  match_type      text NOT NULL
                  CHECK (match_type IN ('campaign_id','adset_id','ad_id','form_id','lead_id','contains')),
  match_value     text NOT NULL,
  project         text,
  campaign        text,
  tag             text,
  pool_key        text,
  priority        integer NOT NULL DEFAULT 100,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_routing_lookup
  ON public.meta_ads_lead_routing_overrides (organization_id, active, match_type, match_value, priority);

ALTER TABLE public.meta_ads_lead_routing_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_routing_select_admin ON public.meta_ads_lead_routing_overrides;
CREATE POLICY meta_ads_routing_select_admin ON public.meta_ads_lead_routing_overrides
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.is_admin_or_above()
      OR public.can_view_all_leads()
    )
  );

DROP POLICY IF EXISTS meta_ads_routing_admin_write ON public.meta_ads_lead_routing_overrides;
CREATE POLICY meta_ads_routing_admin_write ON public.meta_ads_lead_routing_overrides
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.is_admin_or_above()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.is_admin_or_above()
  );

REVOKE ALL ON public.meta_ads_lead_routing_overrides FROM anon;
GRANT SELECT ON public.meta_ads_lead_routing_overrides TO authenticated;

INSERT INTO public.meta_ads_lead_routing_overrides (
  organization_id, match_type, match_value, project, campaign, tag, pool_key, priority, active
) VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'campaign_id',
    '120246723565640137',
    'Mondrian',
    'Duke Mondrian - Marco - Lead Ads',
    'Mondrian',
    'duke_ads_marco',
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'adset_id',
    '120246723565650137',
    'Mondrian',
    'Duke Mondrian - Marco - Lead Ads',
    'Mondrian',
    'duke_ads_marco',
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'ad_id',
    '120246723565630137',
    'Mondrian',
    'Duke Mondrian - Marco - Lead Ads',
    'Mondrian',
    'duke_ads_marco',
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'contains',
    'mondrian',
    'Mondrian',
    'Duke Mondrian - Marco - Lead Ads',
    'Mondrian',
    'duke_ads_marco',
    50,
    true
  )
ON CONFLICT (organization_id, match_type, match_value) DO UPDATE
  SET project = EXCLUDED.project,
      campaign = EXCLUDED.campaign,
      tag = EXCLUDED.tag,
      pool_key = EXCLUDED.pool_key,
      priority = EXCLUDED.priority,
      active = EXCLUDED.active,
      updated_at = now();

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
  v_tag text;
  v_source text;
  v_profile_city text;
  v_meta_lead_id text;
  v_meta_form_id text;
  v_meta_page_id text;
  v_meta_campaign_id text;
  v_meta_adset_id text;
  v_meta_ad_id text;
  v_effective_pool_key text;
  v_routing record;
  v_payload_text text;
  v_lead_id uuid;
  v_existing boolean := false;
  v_needs_owner boolean := true;
  v_current_owner text;
  v_current_owner_id uuid;
  v_assignment jsonb;
  v_asesor_id uuid;
  v_asesor_name text;
  v_stage text := 'Contáctame Ya';
  v_advisor_phone text;
  v_notification_id uuid;
  v_notification_status text;
  v_notification_text text;
  v_dedupe_key text;
BEGIN
  v_payload_text := lower(payload::text);

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

  v_profile_city := public.fn_meta_payload_text(payload, ARRAY[
    'city',
    'ciudad',
    'ciudad_de_interes',
    'ciudad_interes',
    'interes_ciudad',
    'En que ciudad te gustaria ver propiedades desde USD $97,000',
    'en que ciudad te gustaria ver propiedades desde usd $97,000',
    'en_que_ciudad_te_gustaria_ver_propiedades_desde_usd_97000',
    'en_que_ciudad_te_gustaria_ver_propiedades_desde_usd_97_000'
  ]);

  v_project := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY[
      'project','proyecto','development','desarrollo','desarrollo_interes','desarrollo_de_interes'
    ]),
    'Duke desarrollos desde USD 97,000'
  );
  v_campaign := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['campaign_name','campaign','campana','campaña']),
    'Duke desarrollos desde USD 97,000'
  );
  v_tag := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['tag','tags','etiqueta','segmento','interest','interes','interés']),
    'meta_ads'
  );
  v_source := COALESCE(
    public.fn_meta_payload_text(payload, ARRAY['source','utm_source','platform']),
    'meta_ads'
  );

  v_meta_lead_id := public.fn_meta_payload_text(payload, ARRAY['leadgen_id','lead_id','meta_lead_id','id']);
  v_meta_form_id := public.fn_meta_payload_text(payload, ARRAY['form_id','meta_form_id']);
  v_meta_page_id := public.fn_meta_payload_text(payload, ARRAY['page_id','meta_page_id']);
  v_meta_campaign_id := public.fn_meta_payload_text(payload, ARRAY['campaign_id','meta_campaign_id']);
  v_meta_adset_id := public.fn_meta_payload_text(payload, ARRAY['adset_id','adgroup_id','meta_adset_id']);
  v_meta_ad_id := public.fn_meta_payload_text(payload, ARRAY['ad_id','meta_ad_id']);

  SELECT *
    INTO v_routing
  FROM public.meta_ads_lead_routing_overrides r
  WHERE r.organization_id = v_org_id
    AND r.active = true
    AND (
      (r.match_type = 'campaign_id' AND r.match_value = COALESCE(v_meta_campaign_id, ''))
      OR (r.match_type = 'adset_id' AND r.match_value = COALESCE(v_meta_adset_id, ''))
      OR (r.match_type = 'ad_id' AND r.match_value = COALESCE(v_meta_ad_id, ''))
      OR (r.match_type = 'form_id' AND r.match_value = COALESCE(v_meta_form_id, ''))
      OR (r.match_type = 'lead_id' AND r.match_value = COALESCE(v_meta_lead_id, ''))
      OR (r.match_type = 'contains' AND v_payload_text LIKE '%' || lower(r.match_value) || '%')
    )
  ORDER BY r.priority,
           CASE r.match_type
             WHEN 'lead_id' THEN 1
             WHEN 'ad_id' THEN 2
             WHEN 'adset_id' THEN 3
             WHEN 'campaign_id' THEN 4
             WHEN 'form_id' THEN 5
             ELSE 9
           END,
           r.updated_at DESC
  LIMIT 1;

  v_effective_pool_key := COALESCE(v_routing.pool_key, p_pool_key);

  IF v_routing.id IS NOT NULL THEN
    v_project := COALESCE(NULLIF(v_routing.project, ''), v_project);
    v_campaign := COALESCE(NULLIF(v_routing.campaign, ''), v_campaign);
    v_tag := COALESCE(NULLIF(v_routing.tag, ''), v_tag);
  ELSIF v_payload_text LIKE '%mondrian%' THEN
    v_project := 'Mondrian';
    v_campaign := CASE
      WHEN v_campaign IS NULL OR v_campaign = '' OR v_campaign ILIKE 'Duke desarrollos%'
        THEN 'Duke Mondrian - Lead Ads'
      ELSE v_campaign
    END;
    v_tag := 'Mondrian';
  END IF;

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
    v_assignment := public.fn_next_lead_assignment(v_effective_pool_key, v_org_id);
    IF COALESCE((v_assignment ->> 'ok')::boolean, false) THEN
      v_asesor_id := (v_assignment ->> 'asesor_id')::uuid;
      v_asesor_name := v_assignment ->> 'asesor_name';
    ELSE
      SELECT id, name
        INTO v_asesor_id, v_asesor_name
      FROM public.profiles
      WHERE organization_id = v_org_id
        AND active = true
        AND name IN ('Marco Lopez','Ken Duke','Carlos Reyes','Gael G','Cecilia Mendoza','Carlos Ayala')
      ORDER BY CASE name
        WHEN 'Marco Lopez' THEN 1
        WHEN 'Ken Duke' THEN 2
        WHEN 'Carlos Reyes' THEN 3
        WHEN 'Gael G' THEN 4
        WHEN 'Cecilia Mendoza' THEN 5
        WHEN 'Carlos Ayala' THEN 6
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
      project = CASE
        WHEN v_project = 'Mondrian' OR project IS NULL OR btrim(project) = '' OR project ILIKE 'Duke desarrollos%'
          THEN v_project
        ELSE project
      END,
      campaign = CASE
        WHEN v_campaign ILIKE '%Mondrian%' OR campaign IS NULL OR btrim(campaign) = '' OR campaign ILIKE 'Duke desarrollos%'
          THEN v_campaign
        ELSE campaign
      END,
      tag = CASE
        WHEN v_tag = 'Mondrian' OR tag IS NULL OR btrim(tag) = '' OR tag = 'meta_ads'
          THEN v_tag
        ELSE tag
      END,
      asesor_id = COALESCE(v_asesor_id, asesor_id),
      asesor_name = COALESCE(v_asesor_name, asesor_name),
      bio = CASE
        WHEN (bio IS NULL OR btrim(bio) = '') AND (v_profile_city IS NOT NULL OR v_project IS NOT NULL)
          THEN concat_ws(
            '; ',
            CASE WHEN v_project IS NOT NULL THEN 'Perfilamiento Meta Ads: desarrollo de interés: ' || v_project ELSE NULL END,
            CASE WHEN v_profile_city IS NOT NULL THEN 'ciudad de interés: ' || v_profile_city ELSE NULL END
          )
        ELSE bio
      END,
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
      true, 'alta', v_tag, true,
      CASE
        WHEN v_profile_city IS NOT NULL OR v_project IS NOT NULL
          THEN concat_ws(
            '; ',
            CASE WHEN v_project IS NOT NULL THEN 'Perfilamiento Meta Ads: desarrollo de interés: ' || v_project ELSE NULL END,
            CASE WHEN v_profile_city IS NOT NULL THEN 'ciudad de interés: ' || v_profile_city ELSE NULL END
          )
        ELSE NULL
      END,
      v_meta_lead_id, v_meta_form_id, v_meta_page_id, v_meta_campaign_id, v_meta_adset_id, v_meta_ad_id,
      now(), now(), to_char(now(), 'YYYY-MM-DD HH24:MI'), now()
    )
    RETURNING id INTO v_lead_id;
  END IF;

  INSERT INTO public.expediente_items (
    lead_id, organization_id, tipo, titulo, descripcion, asesor_id, metadata
  ) VALUES (
    v_lead_id, v_org_id, 'nota', 'Lead de Meta Ads',
    concat_ws(
      E'\n',
      CASE
        WHEN v_existing THEN 'Lead actualizado desde Meta Ads; se conserva owner si ya tenia asesor.'
        ELSE 'Lead nuevo capturado desde Meta Ads y asignado por pool.'
      END,
      CASE WHEN v_project IS NOT NULL THEN 'Desarrollo de interés: ' || v_project ELSE NULL END,
      CASE WHEN v_profile_city IS NOT NULL THEN 'Ciudad de interés: ' || v_profile_city ELSE NULL END
    ),
    v_asesor_id,
    jsonb_build_object(
      'source', 'meta_ads_round_robin',
      'pool_key', v_effective_pool_key,
      'requested_pool_key', p_pool_key,
      'routing_override_id', v_routing.id,
      'assignment', COALESCE(v_assignment, '{}'::jsonb),
      'campaign', v_campaign,
      'project', v_project,
      'tag', v_tag,
      'profile_city', v_profile_city,
      'meta_lead_id', v_meta_lead_id,
      'meta_form_id', v_meta_form_id,
      'meta_page_id', v_meta_page_id,
      'meta_campaign_id', v_meta_campaign_id,
      'meta_adset_id', v_meta_adset_id,
      'meta_ad_id', v_meta_ad_id,
      'payload', payload
    )
  );

  SELECT NULLIF(btrim(COALESCE(m.advisor_phone_e164, p.phone)), '')
    INTO v_advisor_phone
  FROM public.profiles p
  LEFT JOIN public.lead_assignment_pools pool
    ON pool.organization_id = p.organization_id
   AND pool.pool_key = v_effective_pool_key
  LEFT JOIN public.lead_assignment_pool_members m
    ON m.pool_id = pool.id
   AND m.asesor_id = p.id
  WHERE p.id = v_asesor_id
  LIMIT 1;

  v_dedupe_key := 'meta_ads:' || COALESCE(v_meta_lead_id, md5(payload::text));
  v_notification_text := concat_ws(
    E'\n',
    'Nuevo lead Meta Ads - ' || COALESCE(NULLIF(v_project, ''), 'Duke'),
    'Asesor: ' || COALESCE(v_asesor_name, 'Sin asignar'),
    'Cliente: ' || COALESCE(v_name, 'Sin Nombre'),
    'Tel: ' || COALESCE(v_phone, '-'),
    'Email: ' || COALESCE(v_email, '-'),
    'Desarrollo: ' || COALESCE(v_project, '-'),
    'Etiqueta: ' || COALESCE(v_tag, '-'),
    'Ciudad de interés: ' || COALESCE(v_profile_city, '-'),
    'Campaña: ' || COALESCE(v_campaign, '-'),
    'Etapa en Stratos: ' || v_stage,
    'Acción: contactar por WhatsApp o llamada hoy.'
  );
  v_notification_status := CASE
    WHEN v_advisor_phone IS NULL THEN 'missing_destination'
    ELSE 'pending'
  END;

  INSERT INTO public.advisor_whatsapp_notifications (
    organization_id, lead_id, asesor_id, asesor_name, advisor_phone_e164,
    status, dedupe_key, content, payload
  ) VALUES (
    v_org_id, v_lead_id, v_asesor_id, COALESCE(v_asesor_name, 'iAgents'), v_advisor_phone,
    v_notification_status, v_dedupe_key, v_notification_text,
    jsonb_build_object(
      'source', 'meta_ads_round_robin',
      'pool_key', v_effective_pool_key,
      'requested_pool_key', p_pool_key,
      'routing_override_id', v_routing.id,
      'lead_name', v_name,
      'lead_phone', v_phone,
      'lead_email', v_email,
      'profile_city', v_profile_city,
      'campaign', v_campaign,
      'project', v_project,
      'tag', v_tag,
      'meta_lead_id', v_meta_lead_id,
      'meta_form_id', v_meta_form_id,
      'meta_campaign_id', v_meta_campaign_id,
      'raw_payload', payload
    )
  )
  ON CONFLICT (organization_id, dedupe_key) DO UPDATE
    SET lead_id = EXCLUDED.lead_id,
        asesor_id = EXCLUDED.asesor_id,
        asesor_name = EXCLUDED.asesor_name,
        advisor_phone_e164 = EXCLUDED.advisor_phone_e164,
        content = EXCLUDED.content,
        payload = EXCLUDED.payload,
        status = CASE
          WHEN public.advisor_whatsapp_notifications.status IN ('sent','sending')
            THEN public.advisor_whatsapp_notifications.status
          ELSE EXCLUDED.status
        END,
        error = CASE
          WHEN EXCLUDED.status = 'pending' THEN NULL
          ELSE public.advisor_whatsapp_notifications.error
        END,
        updated_at = now()
  RETURNING id, status INTO v_notification_id, v_notification_status;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'existed', v_existing,
    'stage', v_stage,
    'asesor_id', v_asesor_id,
    'asesor_name', COALESCE(v_asesor_name, 'iAgents'),
    'pool_key', v_effective_pool_key,
    'requested_pool_key', p_pool_key,
    'routing_override_id', v_routing.id,
    'project', v_project,
    'campaign', v_campaign,
    'tag', v_tag,
    'meta_lead_id', v_meta_lead_id,
    'profile_city', v_profile_city,
    'advisor_whatsapp_notification_id', v_notification_id,
    'advisor_whatsapp_notification_status', v_notification_status,
    'advisor_phone_present', v_advisor_phone IS NOT NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) IS
  'n8n entrypoint for Meta Lead Ads. Upserts by meta_lead_id or phone, routes campaign-specific leads (including Mondrian Marco) into the right Stratos project/tag/pool, and queues advisor WhatsApp notifications.';

NOTIFY pgrst, 'reload schema';
