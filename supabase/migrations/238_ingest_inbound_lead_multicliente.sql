-- 238_ingest_inbound_lead_multicliente.sql
-- ============================================================================
-- EL ÚLTIMO TRAMO DEL RUTEO MULTI-CLIENTE.
--
-- PROBLEMA:
--   La migración 233 dio a Supabase la capacidad de resolver el tenant desde
--   el canal de WhatsApp (fn_resolver_canal_whatsapp), pero el ingest seguía
--   ignorándola. `ingest_inbound_lead` abría con:
--
--       v_org uuid := COALESCE((payload->>'organization_id')::uuid,
--                              '00000000-0000-0000-0000-000000000001');
--
--   Es decir: si n8n no manda `organization_id`, TODO lead entrante cae en la
--   organización de Stratos. Con Embedded Signup, cuando Grupo 28, TGenius o
--   Vega conecten su WhatsApp, sus leads aterrizarían en el CRM de Duke.
--
--   Segundo defecto: el asesor se resolvía casando `profiles.phone` como texto
--   EXACTO contra `asesor_phone`. Un "+52 984..." contra un "52984..." no casa,
--   y el lead queda sin dueño.
--
-- CAMBIO:
--   Antes de fijar la organización, se resuelve el canal por el que entró el
--   mensaje. El orden de precedencia queda:
--
--       organization_id del payload   → lo explícito siempre manda
--       organización del canal         → el canal decide el tenant
--       Stratos                        → último recurso (comportamiento previo)
--
--   El asesor sale del canal (que ya sabe de quién es el número) antes de caer
--   al match por texto de profiles.phone, que se conserva como respaldo.
--
-- POR QUÉ ES SEGURO:
--   No cambia nada de lo que hoy funciona. Si el payload trae organization_id,
--   se respeta igual que antes. Si no hay canal registrado que case, cae al
--   mismo default de Stratos de siempre. Solo cambia el resultado en los casos
--   en que el comportamiento anterior habría sido incorrecto.
--
--   Verificado antes de aplicar: el canal de Gael (WABA 263671803501919)
--   resuelve a org `stratos` + asesor `Gael G` — exactamente lo que hace hoy.
--
-- ⚠️ ESTO SOLO NO ALCANZA:
--   Auditados los payloads reales, n8n HARDCODEA organization_id = Stratos y no
--   manda phone_number_id ni waba_id ni asesor_phone. Con ese payload esta
--   función cae —correctamente— al organization_id explícito: es un no-op.
--   Para que el ruteo entre en efecto, n8n debe dejar de fijar organization_id
--   y empezar a mandar los ids del canal. Ver ops/RUTEO-WHATSAPP-multicliente.md
--
-- OBSERVABILIDAD:
--   `canal_match_by` y `canal_platform_type` quedan en audit_log.metadata y en
--   el JSON de respuesta, para poder ver por qué vía se ruteó cada lead y
--   detectar canales que todavía dependen del match por número.
--
-- DEPENDE DE: 233 (fn_resolver_canal_whatsapp)
--
-- ROLLBACK:
--   Restaurar la definición previa de ingest_inbound_lead (está en el historial
--   de git antes de este commit). No hay cambio de esquema, solo de función.
--
-- CÓMO VERIFICAR DESPUÉS DE APLICAR:
--   select public.ingest_inbound_lead(jsonb_build_object(
--     'source','meta_cloud_api', 'waba_id','263671803501919',
--     'sender_name','PRUEBA RUTEO', 'sender_phone','+525500000009',
--     'message_text','prueba'));
--   -- debe devolver organization_id = 00000000-...-0001, canal_match_by = waba_id
--   -- y asesor_name = 'Gael G'. Borrar el lead de prueba después.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ingest_inbound_lead(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_org uuid;
    v_canal_org uuid;
    v_canal_asesor uuid;
    v_canal_match text;
    v_canal_platform text;
    v_source text := COALESCE(payload->>'source','manual_paste');
    v_asesor_id uuid := NULLIF(payload->>'asesor_id','')::uuid;
    v_asesor_phone text := payload->>'asesor_phone';
    v_sender_phone text := payload->>'sender_phone';
    v_sender_phone_norm text := payload->>'sender_phone_normalized';
    v_sender_name text := payload->>'sender_name';
    v_message text := payload->>'message_text';
    v_extracted jsonb := COALESCE(payload->'extracted', '{}'::jsonb);
    v_name_extracted text := NULLIF(TRIM(v_extracted->>'name'),'');
    v_name text := COALESCE(v_name_extracted, NULLIF(TRIM(v_sender_name),''));
    v_email text := lower(NULLIF(v_extracted->>'email',''));
    v_phone_from_msg text := NULLIF(v_extracted->>'phone','');
    v_phone_input text := COALESCE(v_phone_from_msg, v_sender_phone_norm, v_sender_phone);
    v_phone_digits text := NULLIF(regexp_replace(COALESCE(v_phone_input,''), '[^0-9]', '', 'g'), '');
    v_project_id uuid := NULLIF(payload->>'project_id','')::uuid;
    v_campaign_id uuid := NULLIF(payload->>'campaign_id','')::uuid;
    v_lead public.leads;
    v_existing public.leads;
    v_inbox_id uuid;
    v_now timestamptz := now();
    v_is_new boolean := false;
    v_actor_name text := COALESCE(payload->>'operator', v_source);
    v_reject_reason text := NULL;
BEGIN
    -- ── Ruteo multi-cliente ─────────────────────────────────────────────────
    SELECT r.organization_id, r.asesor_id, r.match_by, r.platform_type
      INTO v_canal_org, v_canal_asesor, v_canal_match, v_canal_platform
      FROM public.fn_resolver_canal_whatsapp(
             NULLIF(payload->>'phone_number_id',''),
             NULLIF(payload->>'waba_id',''),
             COALESCE(NULLIF(payload->>'display_phone_number',''), NULLIF(v_asesor_phone,''))
           ) r;

    v_org := COALESCE(
        (payload->>'organization_id')::uuid,
        v_canal_org,
        '00000000-0000-0000-0000-000000000001'
    );

    -- El canal ya sabe de quién es el número; es más confiable que casar
    -- profiles.phone como texto exacto.
    v_asesor_id := COALESCE(v_asesor_id, v_canal_asesor);

    IF v_name IS NULL OR length(v_name) < 2 THEN
        v_reject_reason := 'missing_name';
    ELSIF v_phone_digits IS NULL OR length(v_phone_digits) < 10 THEN
        v_reject_reason := 'missing_or_invalid_phone';
    END IF;

    IF v_asesor_id IS NULL AND v_asesor_phone IS NOT NULL THEN
        SELECT id INTO v_asesor_id
        FROM public.profiles
        WHERE organization_id = v_org AND active = true AND phone = v_asesor_phone
        LIMIT 1;
    END IF;

    INSERT INTO public.whatsapp_inbox(
        organization_id, source, asesor_phone, asesor_id,
        sender_phone, sender_phone_normalized, sender_name,
        message_text, raw_payload, extracted,
        processed_at, processing_error
    ) VALUES (
        v_org, v_source, v_asesor_phone, v_asesor_id,
        v_sender_phone, v_phone_digits, v_sender_name,
        COALESCE(v_message,''), payload, v_extracted,
        CASE WHEN v_reject_reason IS NOT NULL THEN v_now ELSE NULL END,
        v_reject_reason
    ) RETURNING id INTO v_inbox_id;

    IF v_reject_reason IS NOT NULL THEN
        INSERT INTO public.audit_log(
            actor_id, actor_name, actor_role, entity_type, entity_id,
            action, metadata, organization_id
        ) VALUES (
            v_asesor_id, v_actor_name, 'ingest', 'lead', v_inbox_id,
            'INSERT',
            jsonb_build_object(
                'source', v_source, 'inbox_id', v_inbox_id,
                'action_detail','inbound_rejected',
                'reject_reason', v_reject_reason,
                'sender_name', v_sender_name,
                'sender_phone', v_sender_phone,
                'canal_match_by', v_canal_match
            ),
            v_org
        );
        RETURN jsonb_build_object(
            'ok', false,
            'rejected', true,
            'reason', v_reject_reason,
            'inbox_id', v_inbox_id,
            'hint', 'Necesitamos nombre Y telefono (E.164, min 10 digitos) para crear el lead.'
        );
    END IF;

    SELECT * INTO v_existing
    FROM public.leads
    WHERE organization_id = v_org
      AND deleted_at IS NULL
      AND (
          (v_phone_digits IS NOT NULL AND phone_normalized = v_phone_digits)
          OR (v_email IS NOT NULL AND email = v_email)
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        UPDATE public.leads
           SET action_history = action_history || jsonb_build_array(
                   jsonb_build_object(
                       'type','whatsapp_inbound', 'source', v_source, 'at', v_now,
                       'sender_phone', v_sender_phone, 'sender_name', v_sender_name,
                       'message_preview', LEFT(COALESCE(v_message,''), 300),
                       'inbox_id', v_inbox_id
                   )),
               last_activity = v_now::text,
               days_inactive = 0,
               updated_at = v_now
         WHERE id = v_existing.id
        RETURNING * INTO v_lead;
    ELSE
        v_is_new := true;
        INSERT INTO public.leads(
            organization_id, name, email, phone, phone_normalized, whatsapp_phone_e164,
            source, stage, score, is_new, hot, seguimientos, days_inactive,
            playbook, tasks, action_history,
            campaign_id, project_id, asesor_id, asesor_name, fecha_ingreso
        )
        SELECT
            v_org, INITCAP(TRIM(v_name)), v_email,
            v_phone_input, v_phone_input, v_phone_input,
            CASE WHEN v_source IN ('twilio','chatwoot','evolution_api','meta_cloud_api') THEN 'whatsapp_inbound' ELSE v_source END,
            'Contáctame Ya', 60, true, false, 0, 0,
            '[]'::jsonb, '[]'::jsonb,
            jsonb_build_array(jsonb_build_object(
                'type','whatsapp_inbound_first', 'source', v_source, 'at', v_now,
                'sender_phone', v_sender_phone, 'sender_name', v_sender_name,
                'message_preview', LEFT(COALESCE(v_message,''), 300),
                'extracted', v_extracted, 'inbox_id', v_inbox_id
            )),
            v_campaign_id, v_project_id, v_asesor_id,
            (SELECT name FROM public.profiles WHERE id = v_asesor_id),
            v_now
        RETURNING * INTO v_lead;
    END IF;

    UPDATE public.whatsapp_inbox
       SET lead_id = v_lead.id, processed_at = v_now
     WHERE id = v_inbox_id;

    INSERT INTO public.comunicaciones(
        lead_id, asesor_id, organization_id, tipo, resumen, transcripcion, ocurrio_en, metadata
    ) VALUES (
        v_lead.id, COALESCE(v_lead.asesor_id, v_asesor_id), v_org,
        'whatsapp', LEFT(COALESCE(v_message,''), 280), v_message, v_now,
        jsonb_build_object(
            'source', v_source, 'sender_phone', v_sender_phone, 'sender_name', v_sender_name,
            'inbox_id', v_inbox_id, 'extracted', v_extracted
        )
    );

    INSERT INTO public.audit_log(
        actor_id, actor_name, actor_role, entity_type, entity_id,
        action, metadata, organization_id
    ) VALUES (
        v_asesor_id, v_actor_name, 'ingest', 'lead', v_lead.id,
        CASE WHEN v_is_new THEN 'INSERT' ELSE 'UPDATE' END,
        jsonb_build_object(
            'source', v_source, 'inbox_id', v_inbox_id,
            'action_detail', CASE WHEN v_is_new THEN 'create_inbound_whatsapp' ELSE 'inbound_whatsapp_followup' END,
            'canal_match_by', v_canal_match,
            'canal_platform_type', v_canal_platform
        ),
        v_org
    );

    RETURN jsonb_build_object(
        'ok', true,
        'lead_id', v_lead.id, 'is_new', v_is_new, 'inbox_id', v_inbox_id,
        'asesor_id', v_lead.asesor_id, 'asesor_name', v_lead.asesor_name, 'stage', v_lead.stage,
        'organization_id', v_org, 'canal_match_by', v_canal_match
    );
END;
$function$;
