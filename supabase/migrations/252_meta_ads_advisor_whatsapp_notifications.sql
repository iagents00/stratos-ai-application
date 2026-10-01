-- 102_meta_ads_advisor_whatsapp_notifications.sql
-- -----------------------------------------------------------------------------
-- Meta Lead Ads -> Stratos CRM -> advisor WhatsApp notification queue.
--
-- The form is no longer just a CRM insert. Each submission now:
--   1) captures the profile answer from the instant form,
--   2) keeps the lead in "Contáctame Ya" and assigned by round-robin,
--   3) queues a WhatsApp notification for the assigned advisor with the profile.
--
-- Sending is intentionally a queue, not a direct DB-side HTTP call. n8n or an
-- edge sender can claim rows and send with the currently approved WhatsApp route.
-- -----------------------------------------------------------------------------

ALTER TABLE public.lead_assignment_pool_members
  ADD COLUMN IF NOT EXISTS advisor_phone_e164 text;

CREATE TABLE IF NOT EXISTS public.advisor_whatsapp_notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  lead_id               uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  asesor_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  asesor_name           text NOT NULL,
  advisor_phone_e164    text,
  channel               text NOT NULL DEFAULT 'whatsapp'
                        CHECK (channel IN ('whatsapp')),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending',
                          'sending',
                          'sent',
                          'failed',
                          'missing_destination'
                        )),
  dedupe_key            text NOT NULL,
  content               text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4096),
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts              integer NOT NULL DEFAULT 0,
  claimed_at            timestamptz,
  sent_at               timestamptz,
  provider_message_id   text,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_advisor_wa_notifications_status
  ON public.advisor_whatsapp_notifications (status, created_at)
  WHERE status IN ('pending','sending');

CREATE INDEX IF NOT EXISTS idx_advisor_wa_notifications_lead
  ON public.advisor_whatsapp_notifications (lead_id, created_at);

ALTER TABLE public.advisor_whatsapp_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_wa_notifications_select_org ON public.advisor_whatsapp_notifications;
CREATE POLICY advisor_wa_notifications_select_org ON public.advisor_whatsapp_notifications
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.is_admin_or_above()
      OR public.can_view_all_leads()
      OR asesor_id = auth.uid()
      OR public.is_lead_asesor(lead_id)
    )
  );

DROP POLICY IF EXISTS advisor_wa_notifications_no_delete ON public.advisor_whatsapp_notifications;
CREATE POLICY advisor_wa_notifications_no_delete ON public.advisor_whatsapp_notifications
  FOR DELETE TO authenticated
  USING (false);

REVOKE ALL ON public.advisor_whatsapp_notifications FROM anon;
GRANT SELECT ON public.advisor_whatsapp_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_advisor_whatsapp_notifications_claim(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer := greatest(1, least(COALESCE(p_limit, 10), 25));
  v_rows jsonb;
BEGIN
  WITH picked AS (
    SELECT id
    FROM public.advisor_whatsapp_notifications
    WHERE status = 'pending'
      AND advisor_phone_e164 IS NOT NULL
      AND btrim(advisor_phone_e164) <> ''
    ORDER BY created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.advisor_whatsapp_notifications n
       SET status = 'sending',
           attempts = attempts + 1,
           claimed_at = now(),
           updated_at = now()
      FROM picked
     WHERE n.id = picked.id
     RETURNING n.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'organization_id', organization_id,
    'lead_id', lead_id,
    'asesor_id', asesor_id,
    'asesor_name', asesor_name,
    'advisor_phone_e164', advisor_phone_e164,
    'content', content,
    'payload', payload,
    'attempts', attempts
  ) ORDER BY created_at), '[]'::jsonb)
    INTO v_rows
  FROM updated;

  RETURN jsonb_build_object('ok', true, 'notifications', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_advisor_whatsapp_notification_finish(
  p_id uuid,
  p_ok boolean,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.advisor_whatsapp_notifications
     SET status = CASE WHEN p_ok THEN 'sent' ELSE 'failed' END,
         provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
         error = p_error,
         sent_at = CASE WHEN p_ok THEN now() ELSE sent_at END,
         updated_at = now()
   WHERE id = p_id
     AND status IN ('pending','sending');

  RETURN jsonb_build_object('ok', true, 'id', p_id);
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
  v_profile_city text;
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
  v_advisor_phone text;
  v_notification_id uuid;
  v_notification_status text;
  v_notification_text text;
  v_dedupe_key text;
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

  v_meta_lead_id := public.fn_meta_payload_text(payload, ARRAY['leadgen_id','lead_id','meta_lead_id','id']);
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
      bio = CASE
        WHEN v_profile_city IS NOT NULL AND (bio IS NULL OR btrim(bio) = '')
          THEN 'Perfilamiento Meta Ads: ciudad de interés: ' || v_profile_city
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
      true, 'alta', 'meta_ads', true,
      CASE
        WHEN v_profile_city IS NOT NULL
          THEN 'Perfilamiento Meta Ads: ciudad de interés: ' || v_profile_city
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
        ELSE 'Lead nuevo capturado desde Meta Ads y asignado por round-robin.'
      END,
      CASE WHEN v_profile_city IS NOT NULL THEN 'Ciudad de interés: ' || v_profile_city ELSE NULL END
    ),
    v_asesor_id,
    jsonb_build_object(
      'source', 'meta_ads_round_robin',
      'pool_key', p_pool_key,
      'assignment', COALESCE(v_assignment, '{}'::jsonb),
      'campaign', v_campaign,
      'project', v_project,
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
   AND pool.pool_key = p_pool_key
  LEFT JOIN public.lead_assignment_pool_members m
    ON m.pool_id = pool.id
   AND m.asesor_id = p.id
  WHERE p.id = v_asesor_id
  LIMIT 1;

  v_dedupe_key := 'meta_ads:' || COALESCE(v_meta_lead_id, md5(payload::text));
  v_notification_text := concat_ws(
    E'\n',
    'Nuevo lead Meta Ads - Duke USD 97K',
    'Asesor: ' || COALESCE(v_asesor_name, 'Sin asignar'),
    'Cliente: ' || COALESCE(v_name, 'Sin Nombre'),
    'Tel: ' || COALESCE(v_phone, '-'),
    'Email: ' || COALESCE(v_email, '-'),
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
      'lead_name', v_name,
      'lead_phone', v_phone,
      'lead_email', v_email,
      'profile_city', v_profile_city,
      'campaign', v_campaign,
      'project', v_project,
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
    'pool_key', p_pool_key,
    'assignment', COALESCE(v_assignment, '{}'::jsonb),
    'meta_lead_id', v_meta_lead_id,
    'profile_city', v_profile_city,
    'advisor_whatsapp_notification_id', v_notification_id,
    'advisor_whatsapp_notification_status', v_notification_status,
    'advisor_phone_present', v_advisor_phone IS NOT NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_advisor_whatsapp_notifications_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_advisor_whatsapp_notification_finish(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_advisor_whatsapp_notifications_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_advisor_whatsapp_notification_finish(uuid, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_upsert_lead_from_meta_ads(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.fn_advisor_whatsapp_notifications_claim(integer) IS
  'n8n/worker claim endpoint for pending advisor WhatsApp notifications.';
COMMENT ON FUNCTION public.fn_advisor_whatsapp_notification_finish(uuid, boolean, text, text) IS
  'n8n/worker finish endpoint for advisor WhatsApp notification delivery.';

-- Known advisor WhatsApp destinations from the current Duke setup.
DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  UPDATE public.lead_assignment_pool_members m
     SET advisor_phone_e164 = CASE p.name
       WHEN 'Gael G' THEN COALESCE(NULLIF(btrim(p.phone), ''), '+5219848779295')
       WHEN 'Cecilia Mendoza' THEN '+5219842540664'
       WHEN 'Marco Lopez' THEN '+529842536828'
       ELSE m.advisor_phone_e164
     END,
         updated_at = now()
    FROM public.lead_assignment_pools pool
    JOIN public.profiles p ON p.organization_id = pool.organization_id
   WHERE m.pool_id = pool.id
     AND m.asesor_id = p.id
     AND pool.organization_id = v_org
     AND pool.pool_key = 'duke_ads_round_robin'
     AND p.name IN ('Gael G','Cecilia Mendoza','Marco Lopez');
END $$;

NOTIFY pgrst, 'reload schema';
