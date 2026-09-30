-- Incoming WhatsApp for NSG / Ivan. No changes to Duke receivers or shared ingest.
-- Rollback operationally: set this NSG channel active=false and stop its new webhook.
ALTER TABLE public.whatsapp_inbox ADD COLUMN IF NOT EXISTS provider_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_inbox_infobip_nsg_event_uidx
  ON public.whatsapp_inbox (organization_id, asesor_phone, provider_message_id)
  WHERE source = 'infobip_nsg' AND provider_message_id IS NOT NULL;

-- Disabled until the authenticated receiver and provider subscription are ready.
INSERT INTO public.whatsapp_numero_asesor
  (organization_id,numero_whatsapp,asesor_id,asesor_name,proveedor,active,nota,platform_type)
SELECT '4a17b181-35d2-41b3-b639-6e0bd4c38acc', '+526861936914',
       p.id,p.name,'infobip',false,'NSG inbound; Infobip sender 5216861936914','CLOUD_API'
FROM public.profiles p
WHERE p.organization_id='4a17b181-35d2-41b3-b639-6e0bd4c38acc'
  AND p.id='54ef3b9e-44f3-46d5-84c0-b8acab027adf' AND p.active
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_numero_asesor c
    WHERE c.organization_id=p.organization_id
      AND public.fn_phone_canon(c.numero_whatsapp)='526861936914');

CREATE OR REPLACE FUNCTION public.fn_ingest_infobip_nsg(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
DECLARE
  v_org constant uuid := '4a17b181-35d2-41b3-b639-6e0bd4c38acc';
  v_recipient constant text := '526861936914';
  v_ivan constant uuid := '54ef3b9e-44f3-46d5-84c0-b8acab027adf';
  r jsonb; m jsonb; v_type text; v_phone text; v_id text; v_name text;
  v_text text; v_media jsonb; v_time timestamptz; v_advisor text;
  v_lead uuid; v_inbox uuid; v_matches uuid[]; v_new boolean;
  v_event jsonb; v_received int:=0; v_created int:=0; v_duplicate int:=0; v_ignored int:=0;
BEGIN
  -- Only the authenticated n8n service credential can execute this RPC.
  -- Tenant and advisor are server-owned; provider/user fields cannot override them.
  IF payload ? 'organization_id' AND payload->>'organization_id' IS DISTINCT FROM v_org::text THEN
    RAISE EXCEPTION 'Organization mismatch' USING ERRCODE='22023';
  END IF;
  IF payload ? 'entry' AND NOT payload ? 'results' THEN
    RETURN jsonb_build_object('ok',true,'ignored','business_app_echo');
  END IF;
  IF jsonb_typeof(payload->'results') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected Infobip results array' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(payload->'results') > 2000 THEN
    RAISE EXCEPTION 'Batch exceeds limit' USING ERRCODE='22023';
  END IF;
  -- Stable order also prevents opposite-order batches deadlocking on contacts.
  FOR r IN SELECT value FROM jsonb_array_elements(payload->'results')
           ORDER BY public.fn_phone_canon(value->>'from'),value->>'messageId'
  LOOP
    IF public.fn_phone_canon(r->>'to') IS DISTINCT FROM v_recipient THEN
      v_ignored:=v_ignored+1; CONTINUE;
    END IF;
    IF r ? 'integrationType' AND r->>'integrationType' IS DISTINCT FROM 'WHATSAPP' THEN
      RAISE EXCEPTION 'Unexpected integration type' USING ERRCODE='22023';
    END IF;
    SELECT p.name INTO v_advisor
      FROM public.whatsapp_numero_asesor c JOIN public.profiles p
        ON p.id=c.asesor_id AND p.organization_id=c.organization_id AND p.active
      WHERE c.organization_id=v_org AND c.active AND c.proveedor='infobip'
        AND public.fn_phone_canon(c.numero_whatsapp)=v_recipient AND p.id=v_ivan;
    IF v_advisor IS NULL THEN RAISE EXCEPTION 'NSG channel is not active'; END IF;
    v_phone:=public.fn_phone_canon(r->>'from');
    v_id:=nullif(btrim(r->>'messageId'),'');
    IF v_phone IS NULL OR v_phone !~ '^[1-9][0-9]{7,14}$' OR v_id IS NULL OR length(v_id)>512 THEN
      RAISE EXCEPTION 'Invalid sender or missing messageId' USING ERRCODE='22023';
    END IF;
    -- A self-echo cannot become a prospect.
    IF v_phone=v_recipient THEN v_ignored:=v_ignored+1; CONTINUE; END IF;
    m:=r->'message'; v_type:=upper(coalesce(m->>'type',''));
    IF v_type NOT IN ('TEXT','IMAGE','AUDIO','VOICE','VIDEO','DOCUMENT','STICKER',
                      'LOCATION','CONTACT','CONTACTS','BUTTON','INTERACTIVE_BUTTON_REPLY',
                      'INTERACTIVE_LIST_REPLY') THEN
      v_ignored:=v_ignored+1; CONTINUE;
    END IF;
    v_text:=coalesce(nullif(m->>'text',''),nullif(m->>'caption',''),
                     nullif(m->>'title',''),nullif(m->>'fileName',''));
    IF v_type='TEXT' AND nullif(btrim(v_text),'') IS NULL THEN
      v_ignored:=v_ignored+1; CONTINUE;
    END IF;
    v_text:=coalesce(v_text,'Mensaje de WhatsApp ('||lower(v_type)||')');
    v_name:=CASE WHEN jsonb_typeof(r#>'{contact,name}')='string'
                 THEN left(nullif(btrim(r#>>'{contact,name}'),''),200) END;
    v_name:=coalesce(v_name,'Contacto WhatsApp +'||v_phone);
    v_time:=coalesce(nullif(r->>'receivedAt','')::timestamptz,now());
    IF v_time>now()+interval '5 minutes' THEN v_time:=now(); END IF;
    v_media:=CASE WHEN v_type IN ('IMAGE','AUDIO','VOICE','VIDEO','DOCUMENT','STICKER')
      THEN jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'type',lower(v_type),'url',m->>'url','mime',m->>'contentType','name',m->>'fileName')))
      ELSE '[]'::jsonb END;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text||':'||v_phone,0));
    v_inbox:=NULL;
    INSERT INTO public.whatsapp_inbox
      (organization_id,source,asesor_phone,asesor_id,sender_phone,sender_phone_normalized,
       sender_name,message_text,media_urls,raw_payload,received_at,provider_message_id)
    VALUES (v_org,'infobip_nsg',v_recipient,v_ivan,'+'||v_phone,v_phone,
            v_name,v_text,v_media,r,v_time,v_id)
    ON CONFLICT (organization_id,asesor_phone,provider_message_id)
      WHERE source='infobip_nsg' AND provider_message_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_inbox;
    IF v_inbox IS NULL THEN v_duplicate:=v_duplicate+1; CONTINUE; END IF;

    SELECT array_agg(l.id) INTO v_matches FROM public.leads l
      WHERE l.organization_id=v_org AND l.deleted_at IS NULL
      AND (public.fn_phone_canon(l.phone)=v_phone
        OR public.fn_phone_canon(l.whatsapp_phone_e164)=v_phone
        OR public.fn_phone_canon(l.whatsapp_wa_id)=v_phone);
    IF cardinality(v_matches)>1 THEN
      RAISE EXCEPTION 'Ambiguous NSG contact: manual merge required';
    END IF;
    v_lead:=v_matches[1]; v_new:=v_lead IS NULL;
    v_event:=jsonb_build_object('id',v_inbox,'type','whatsapp_inbound',
      'source','infobip_nsg','created_at',v_time,'at',v_time,'by','WhatsApp',
      'action','WhatsApp recibido: '||left(v_text,500),'message_preview',left(v_text,500),
      'inbox_id',v_inbox,'provider_message_id',v_id);
    IF v_new THEN
      INSERT INTO public.leads
        (organization_id,name,phone,whatsapp_phone_e164,whatsapp_wa_id,source,stage,
         asesor_id,asesor_name,fecha_ingreso,last_activity,is_new,action_history)
      VALUES (v_org,v_name,'+'||v_phone,'+'||v_phone,r->>'from','whatsapp_inbound',
              'Prospecto',v_ivan,v_advisor,v_time,v_time::text,true,jsonb_build_array(v_event))
      RETURNING id INTO v_lead;
      v_created:=v_created+1;
    ELSE
      -- Keep commercial ownership, name and stage after the initial capture.
      UPDATE public.leads SET action_history=coalesce(action_history,'[]'::jsonb)||jsonb_build_array(v_event),
        last_activity=now()::text,days_inactive=0
      WHERE organization_id=v_org AND id=v_lead;
    END IF;
    UPDATE public.whatsapp_inbox SET lead_id=v_lead,processed_at=now()
      WHERE organization_id=v_org AND id=v_inbox;
    INSERT INTO public.comunicaciones
      (organization_id,lead_id,asesor_id,tipo,resumen,transcripcion,ocurrio_en,metadata)
    SELECT v_org,v_lead,l.asesor_id,'whatsapp',left(v_text,280),v_text,v_time,
      jsonb_build_object('source','infobip_nsg','inbox_id',v_inbox,
        'provider_message_id',v_id,'recipient',v_recipient,'media',v_media,
        'referral',coalesce(r->'referral',m->'referral'))
    FROM public.leads l WHERE l.organization_id=v_org AND l.id=v_lead;
    v_received:=v_received+1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'received',v_received,'created',v_created,
                           'duplicate',v_duplicate,'ignored',v_ignored);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_ingest_infobip_nsg(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ingest_infobip_nsg(jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
