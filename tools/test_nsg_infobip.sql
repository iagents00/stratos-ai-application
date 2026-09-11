-- Run against stratos-prod using a privileged SQL session. Every fixture rolls back.
BEGIN;
UPDATE public.whatsapp_numero_asesor SET active=true
WHERE organization_id='4a17b181-35d2-41b3-b639-6e0bd4c38acc'
  AND public.fn_phone_canon(numero_whatsapp)='526861469109';
DO $test$
DECLARE
  o constant uuid:='4a17b181-35d2-41b3-b639-6e0bd4c38acc';
  iv constant uuid:='54ef3b9e-44f3-46d5-84c0-b8acab027adf';
  a constant uuid:='aa53f5a4-c06d-4a76-b3b7-75533e050101';
  fixture jsonb; result jsonb; l public.leads; before_count bigint;
  seed text:=gen_random_uuid()::text;
BEGIN
  IF has_function_privilege('anon','public.fn_ingest_infobip_nsg(jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.fn_ingest_infobip_nsg(jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.fn_ingest_infobip_nsg(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC permissions failed';
  END IF;
  SELECT count(*) INTO before_count FROM public.leads
    WHERE organization_id='00000000-0000-0000-0000-000000000001';
  fixture:=jsonb_build_object('results',jsonb_build_array(jsonb_build_object(
    'from','5212025550111','to','5216861469109','integrationType','WHATSAPP',
    'messageId',seed||'-1','message',jsonb_build_object('type','TEXT','text','QA NSG rollback'),
    'contact',jsonb_build_object('name','QA NSG transaccional'))));
  result:=public.fn_ingest_infobip_nsg(fixture);
  IF result->>'created'<>'1' OR result->>'received'<>'1' THEN
    RAISE EXCEPTION 'First capture failed: %',result;
  END IF;
  SELECT * INTO STRICT l FROM public.leads WHERE organization_id=o AND phone='+522025550111';
  IF l.stage<>'Prospecto' OR l.asesor_id<>iv OR l.source<>'whatsapp_inbound'
    OR l.action_history#>>'{0,action}'<>'WhatsApp recibido: QA NSG rollback'
    OR l.action_history#>>'{0,created_at}' IS NULL THEN RAISE EXCEPTION 'CRM mapping failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_numero_asesor WHERE organization_id=o
    AND public.fn_phone_canon(numero_whatsapp)='526861936914' AND active) THEN
    RAISE EXCEPTION 'Former channel still active';
  END IF;
  result:=public.fn_ingest_infobip_nsg(jsonb_set(fixture,'{results,0,to}','"5216861936914"'));
  IF result->>'ignored'<>'1' OR result->>'received'<>'0' THEN
    RAISE EXCEPTION 'Former number still captures';
  END IF;
  -- Repeat delivery, including the Mexico legacy prefix alias, is a no-op.
  fixture:=jsonb_set(fixture,'{results,0,from}','"522025550111"');
  fixture:=jsonb_set(fixture,'{results,0,to}','"526861469109"');
  result:=public.fn_ingest_infobip_nsg(fixture);
  IF result->>'duplicate'<>'1' OR result->>'received'<>'0' THEN RAISE EXCEPTION 'Dedup failed'; END IF;
  UPDATE public.leads SET stage='Diagnóstico',name='Nombre comercial conservado',
    asesor_id=a,asesor_name=(SELECT name FROM public.profiles WHERE organization_id=o AND id=a)
    WHERE organization_id=o AND id=l.id;
  fixture:=jsonb_set(fixture,'{results,0,messageId}',to_jsonb(seed||'-2'));
  result:=public.fn_ingest_infobip_nsg(fixture);
  SELECT * INTO STRICT l FROM public.leads WHERE organization_id=o AND id=l.id;
  IF l.stage<>'Diagnóstico' OR l.asesor_id<>a OR l.name<>'Nombre comercial conservado'
    OR jsonb_array_length(l.action_history)<>2 THEN RAISE EXCEPTION 'Followup overwrote commercial data'; END IF;
  IF (SELECT count(*) FROM public.comunicaciones WHERE organization_id=o AND lead_id=l.id)<>2 THEN
    RAISE EXCEPTION 'Timeline duplicate or missing'; END IF;
  -- An existing lead captured before the switch keeps its identity/history.
  INSERT INTO public.leads (organization_id,name,phone,stage,asesor_id,asesor_name,source,action_history)
  SELECT o,'Contacto anterior al cambio','+12025550113','Propuesta',iv,p.name,'whatsapp_inbound',
    '[{"action":"Mensaje anterior en 6914"}]'::jsonb
  FROM public.profiles p WHERE p.organization_id=o AND p.id=iv;
  result:=public.fn_ingest_infobip_nsg(jsonb_set(jsonb_set(fixture,
    '{results,0,from}','"12025550113"'),'{results,0,messageId}',to_jsonb(seed||'-existing')));
  IF result->>'created'<>'0' OR result->>'received'<>'1' THEN
    RAISE EXCEPTION 'Existing lead duplicated across number switch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE organization_id=o AND phone='+12025550113'
    AND stage='Propuesta' AND name='Contacto anterior al cambio' AND asesor_id=iv
    AND action_history#>>'{0,action}'='Mensaje anterior en 6914'
    AND jsonb_array_length(action_history)=2) THEN
    RAISE EXCEPTION 'Existing lead history lost';
  END IF;
  -- Same national digits in a different country must create a distinct contact.
  fixture:=jsonb_set(fixture,'{results,0,from}','"572025550111"');
  fixture:=jsonb_set(fixture,'{results,0,messageId}',to_jsonb(seed||'-3'));
  result:=public.fn_ingest_infobip_nsg(fixture);
  IF result->>'created'<>'1' THEN RAISE EXCEPTION 'Cross-country phone collision'; END IF;
  -- Media without a caption/name remains a capturable first contact.
  fixture:=jsonb_set(fixture,'{results,0,from}','"12025550112"');
  fixture:=jsonb_set(fixture,'{results,0,messageId}',to_jsonb(seed||'-4'));
  fixture:=jsonb_set(fixture,'{results,0,message}','{"type":"IMAGE","url":"https://example.invalid/qa.jpg"}');
  fixture:=fixture #- '{results,0,contact}';
  result:=public.fn_ingest_infobip_nsg(fixture);
  IF result->>'created'<>'1' OR NOT EXISTS (SELECT 1 FROM public.whatsapp_inbox
    WHERE organization_id=o AND provider_message_id=seed||'-4' AND jsonb_array_length(media_urls)=1)
    THEN RAISE EXCEPTION 'Media capture failed'; END IF;
  fixture:=jsonb_set(fixture,'{results,0,to}','"5219841376686"');
  result:=public.fn_ingest_infobip_nsg(fixture);
  IF result->>'ignored'<>'1' THEN RAISE EXCEPTION 'Recipient isolation failed'; END IF;
  result:=public.fn_ingest_infobip_nsg('{"entry":[{}]}');
  IF result->>'ignored'<>'business_app_echo' THEN RAISE EXCEPTION 'Echo guard failed'; END IF;
  BEGIN
    PERFORM public.fn_ingest_infobip_nsg('{"organization_id":"00000000-0000-0000-0000-000000000001","results":[]}');
    RAISE EXCEPTION 'Organization spoof accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  fixture:=jsonb_set(fixture,'{results,0,to}','"5216861469109"');
  BEGIN
    PERFORM public.fn_ingest_infobip_nsg(fixture #- '{results,0,messageId}');
    RAISE EXCEPTION 'Missing provider id accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT count(*) FROM public.leads WHERE organization_id='00000000-0000-0000-0000-000000000001')<>before_count THEN
    RAISE EXCEPTION 'Duke changed'; END IF;
END;
$test$;
ROLLBACK;
