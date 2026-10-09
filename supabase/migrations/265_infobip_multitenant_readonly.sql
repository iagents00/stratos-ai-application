-- 265_infobip_multitenant_readonly.sql
-- ============================================================================
-- Espejo de WhatsApp Business App -> CRM, SOLO LECTURA y multiempresa.
--
-- El usuario sigue atendiendo desde WhatsApp Business. Infobip entrega los
-- mensajes nuevos y sus ecos a n8n y esta RPC resuelve empresa + asesor usando
-- el numero empresarial registrado en whatsapp_numero_asesor. El payload NUNCA
-- puede elegir organization_id ni asesor_id.
--
-- Incluye BSUID (contact.userId): desde 2026 Meta puede ocultar el telefono de
-- un contacto con username. Un lead se identifica por BSUID y, cuando existe,
-- tambien por telefono. No habilita envios desde Stratos.
--
-- Rollback seguro:
--   1. volver el workflow n8n a fn_ingest_infobip_nsg;
--   2. revocar fn_ingest_infobip_multitenant;
--   3. las columnas nuevas pueden quedarse: son aditivas y conservan historial.
-- ============================================================================

alter table public.leads
  add column if not exists whatsapp_bsuid text,
  add column if not exists whatsapp_username text;

create unique index if not exists leads_org_whatsapp_bsuid_uidx
  on public.leads (organization_id, whatsapp_bsuid)
  where whatsapp_bsuid is not null and deleted_at is null;

alter table public.whatsapp_inbox
  add column if not exists channel_id uuid references public.whatsapp_numero_asesor(id),
  add column if not exists whatsapp_bsuid text,
  add column if not exists whatsapp_username text;

-- El messageId de Infobip es la identidad del evento. Este indice tambien
-- deduplica los eventos ya guardados por el receptor NSG anterior.
create unique index if not exists whatsapp_inbox_provider_event_uidx
  on public.whatsapp_inbox (organization_id, provider_message_id)
  where provider_message_id is not null;

alter table public.whatsapp_messages
  alter column chatwoot_conversation_id drop not null,
  add column if not exists provider text not null default 'chatwoot',
  add column if not exists provider_message_id text,
  add column if not exists channel_id uuid references public.whatsapp_numero_asesor(id),
  add column if not exists whatsapp_bsuid text,
  add column if not exists whatsapp_username text;

create unique index if not exists whatsapp_messages_provider_event_uidx
  on public.whatsapp_messages (organization_id, provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists whatsapp_messages_channel_created_idx
  on public.whatsapp_messages (channel_id, message_created_at desc)
  where channel_id is not null;

-- Activa la experiencia de lectura sin hacer un read/modify/write de todo
-- meta_config. Asi una publicacion concurrente del pipeline no se pierde.
create or replace function public.fn_activate_whatsapp_readonly(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.organizations
     set meta_config = jsonb_set(
       coalesce(meta_config, '{}'::jsonb),
       '{features}',
       coalesce(meta_config->'features', '{}'::jsonb) || jsonb_build_object(
         'whatsappModule', true,
         'whatsappChat', true,
         'whatsappReadOnly', true
       ),
       true
     )
   where id = p_organization_id;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.fn_activate_whatsapp_readonly(uuid)
  from public, anon, authenticated;
grant execute on function public.fn_activate_whatsapp_readonly(uuid)
  to service_role;

create or replace function public.fn_ingest_infobip_multitenant(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r jsonb;
  m jsonb;
  v_channel_matches uuid[];
  v_channel uuid;
  v_org uuid;
  v_recipient text;
  v_advisor uuid;
  v_advisor_name text;
  v_from text;
  v_user_id text;
  v_phone text;
  v_bsuid text;
  v_username text;
  v_identity text;
  v_message_id text;
  v_type text;
  v_text text;
  v_name text;
  v_media jsonb;
  v_time timestamptz;
  v_stage text;
  v_lead uuid;
  v_lead_matches uuid[];
  v_inbox uuid;
  v_message uuid;
  v_new boolean;
  v_direction text;
  v_source text;
  v_event jsonb;
  v_received integer := 0;
  v_echoed integer := 0;
  v_created integer := 0;
  v_duplicate integer := 0;
  v_ignored integer := 0;
  v_errors integer := 0;
begin
  if payload ? 'organization_id' or payload ? 'asesor_id' then
    raise exception 'Tenant and advisor are resolved server-side'
      using errcode = '22023';
  end if;

  -- Los eventos de Subscriptions llegan con otra envoltura. n8n debe
  -- normalizarlos a results[] y marcar BUSINESS_APP_MESSAGE_ECHO como OUT.
  if payload ? 'entry' and not payload ? 'results' then
    return jsonb_build_object('ok', true, 'ignored', 'normalization_required');
  end if;

  if jsonb_typeof(payload->'results') is distinct from 'array' then
    raise exception 'Expected Infobip results array' using errcode = '22023';
  end if;
  if jsonb_array_length(payload->'results') > 2000 then
    raise exception 'Batch exceeds limit' using errcode = '22023';
  end if;

  -- Orden estable: evita deadlocks si dos lotes contienen los mismos contactos.
  for r in
    select value
    from jsonb_array_elements(payload->'results')
    order by public.fn_phone_canon(value->>'to'),
             coalesce(value#>>'{contact,userId}', value->>'from'),
             value->>'messageId'
  loop
    if upper(coalesce(r->>'integrationType', 'WHATSAPP')) <> 'WHATSAPP' then
      v_ignored := v_ignored + 1;
      continue;
    end if;

    v_direction := upper(coalesce(
      nullif(btrim(r->>'direction'), ''),
      case when upper(coalesce(payload->>'eventType', payload->>'event', '')) =
        'BUSINESS_APP_MESSAGE_ECHO' then 'OUT' else 'IN' end
    ));
    if v_direction not in ('IN', 'OUT') then
      raise exception 'Unsupported WhatsApp direction: %', v_direction
        using errcode = '22023';
    end if;
    v_source := case when v_direction = 'OUT'
      then 'infobip_business_app_echo' else 'infobip' end;

    -- IN: el numero empresarial es destinatario. OUT/echo: es remitente.
    v_recipient := public.fn_phone_canon(case
      when v_direction = 'OUT' then r->>'from' else r->>'to' end);
    if v_recipient is null then
      raise exception 'Missing Infobip recipient' using errcode = '22023';
    end if;

    select array_agg(c.id order by c.id)
      into v_channel_matches
    from public.whatsapp_numero_asesor c
    where c.active
      and c.proveedor = 'infobip'
      and public.fn_phone_canon(c.numero_whatsapp) = v_recipient;

    if coalesce(cardinality(v_channel_matches), 0) = 0 then
      raise exception 'Unregistered Infobip recipient: %', v_recipient
        using errcode = '22023';
    end if;
    if cardinality(v_channel_matches) > 1 then
      raise exception 'Ambiguous Infobip recipient: %', v_recipient
        using errcode = '22023';
    end if;

    v_channel := v_channel_matches[1];
    select c.organization_id,
           case when p.active then p.id else null end,
           coalesce(case when p.active then p.name end, c.asesor_name)
      into v_org, v_advisor, v_advisor_name
    from public.whatsapp_numero_asesor c
    left join public.profiles p
      on p.id = c.asesor_id and p.organization_id = c.organization_id
    where c.id = v_channel and c.active and c.proveedor = 'infobip';

    if v_org is null then
      raise exception 'Inactive Infobip channel: %', v_channel
        using errcode = '22023';
    end if;

    -- La identidad del contacto siempre queda del lado opuesto al numero
    -- empresarial, independientemente de la direccion del mensaje.
    v_from := nullif(btrim(case
      when v_direction = 'OUT' then r->>'to' else r->>'from' end), '');
    v_user_id := nullif(btrim(r#>>'{contact,userId}'), '');
    v_bsuid := case
      when v_user_id ~ '^[A-Za-z]{2}\.[A-Za-z0-9._-]{1,147}$' then v_user_id
      when v_from ~ '^[A-Za-z]{2}\.[A-Za-z0-9._-]{1,147}$' then v_from
      else null
    end;

    v_username := left(nullif(btrim(r#>>'{contact,username}'), ''), 200);
    v_phone := public.fn_phone_canon(coalesce(
      nullif(r#>>'{contact,phoneNumber}', ''),
      case when v_user_id !~ '^[A-Za-z]{2}\.' then v_user_id end,
      case when v_from !~ '^[A-Za-z]{2}\.' then v_from end
    ));
    if v_phone is not null and v_phone !~ '^[1-9][0-9]{7,14}$' then
      v_phone := null;
    end if;

    v_identity := coalesce(v_bsuid, v_phone);
    v_message_id := nullif(btrim(r->>'messageId'), '');
    if v_identity is null or v_message_id is null or length(v_message_id) > 512 then
      raise exception 'Missing sender identity or messageId' using errcode = '22023';
    end if;
    if v_phone = v_recipient then
      v_ignored := v_ignored + 1;
      continue;
    end if;

    m := coalesce(r->'message', '{}'::jsonb);
    v_type := upper(coalesce(m->>'type', ''));
    if v_type not in (
      'TEXT','IMAGE','AUDIO','VOICE','VIDEO','DOCUMENT','STICKER','LOCATION',
      'CONTACT','CONTACTS','BUTTON','INTERACTIVE_BUTTON_REPLY','INTERACTIVE_LIST_REPLY'
    ) then
      v_ignored := v_ignored + 1;
      continue;
    end if;

    v_text := coalesce(
      nullif(m->>'text', ''), nullif(m->>'caption', ''),
      nullif(m->>'title', ''), nullif(m->>'fileName', ''),
      case when v_type = 'LOCATION' then concat_ws('',
        'Ubicacion: ', nullif(m->>'latitude', ''), ', ', nullif(m->>'longitude', '')) end,
      case when v_type in ('CONTACT','CONTACTS') then 'Contacto compartido' end,
      'Mensaje de WhatsApp (' || lower(v_type) || ')'
    );
    if v_type = 'TEXT' and nullif(btrim(v_text), '') is null then
      v_ignored := v_ignored + 1;
      continue;
    end if;

    v_name := left(coalesce(
      nullif(btrim(r#>>'{contact,name}'), ''),
      v_username,
      case when v_phone is not null then 'Contacto WhatsApp +' || v_phone end,
      'Contacto WhatsApp ' || v_bsuid
    ), 200);

    begin
      v_time := coalesce(nullif(r->>'receivedAt', '')::timestamptz, now());
    exception when others then
      v_time := now();
    end;
    if v_time > now() + interval '5 minutes' then v_time := now(); end if;

    v_media := case when v_type in ('IMAGE','AUDIO','VOICE','VIDEO','DOCUMENT','STICKER')
      then jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'type', lower(v_type), 'url', m->>'url', 'mime', m->>'contentType',
        'filename', m->>'fileName'
      )))
      else '[]'::jsonb end;

    perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || v_identity, 0));
    v_inbox := null;
    insert into public.whatsapp_inbox (
      organization_id, source, channel_id, asesor_phone, asesor_id,
      sender_phone, sender_phone_normalized, sender_name,
      whatsapp_bsuid, whatsapp_username, message_text, media_urls,
      raw_payload, received_at, provider_message_id
    ) values (
      v_org, v_source, v_channel, v_recipient, v_advisor,
      case when v_phone is not null then '+' || v_phone end, v_phone, v_name,
      v_bsuid, v_username, v_text, v_media,
      r, v_time, v_message_id
    )
    on conflict (organization_id, provider_message_id)
      where provider_message_id is not null do nothing
    returning id into v_inbox;

    if v_inbox is null then
      v_duplicate := v_duplicate + 1;
      continue;
    end if;

    select array_agg(x.id order by x.id)
      into v_lead_matches
    from (
      select distinct l.id
      from public.leads l
      where l.organization_id = v_org
        and l.deleted_at is null
        and (
          (v_bsuid is not null and (l.whatsapp_bsuid = v_bsuid or l.whatsapp_wa_id = v_bsuid))
          or
          (v_phone is not null and (
            public.fn_phone_canon(l.phone) = v_phone
            or public.fn_phone_canon(l.whatsapp_phone_e164) = v_phone
            or public.fn_phone_canon(l.whatsapp_wa_id) = v_phone
          ))
        )
    ) x;

    if cardinality(v_lead_matches) > 1 then
      update public.whatsapp_inbox
         set processed_at = now(), processing_error = 'ambiguous_contact_manual_merge'
       where organization_id = v_org and id = v_inbox;
      v_errors := v_errors + 1;
      continue;
    end if;

    v_lead := v_lead_matches[1];
    v_new := v_lead is null;
    select coalesce(nullif(o.meta_config#>>'{crm,pipeline,0,name}', ''), 'Prospecto')
      into v_stage
    from public.organizations o where o.id = v_org;

    v_event := jsonb_build_object(
      'id', v_inbox,
      'type', case when v_direction = 'OUT'
        then 'whatsapp_business_app_echo' else 'whatsapp_inbound' end,
      'source', v_source,
      'created_at', v_time, 'at', v_time, 'by', 'WhatsApp Business',
      'action', case when v_direction = 'OUT'
        then 'WhatsApp enviado desde la app: ' || left(v_text, 500)
        else 'WhatsApp recibido: ' || left(v_text, 500) end,
      'message_preview', left(v_text, 500), 'inbox_id', v_inbox,
      'provider_message_id', v_message_id, 'channel_id', v_channel
    );

    if v_new then
      insert into public.leads (
        organization_id, name, phone, whatsapp_phone_e164, whatsapp_wa_id,
        whatsapp_bsuid, whatsapp_username, source, stage,
        asesor_id, asesor_name, fecha_ingreso, last_activity, is_new, action_history
      ) values (
        v_org, v_name,
        case when v_phone is not null then '+' || v_phone end,
        case when v_phone is not null then '+' || v_phone end,
        coalesce(v_from, v_bsuid), v_bsuid, v_username,
        case when v_direction = 'OUT'
          then 'whatsapp_business_app' else 'whatsapp_inbound' end,
        v_stage, v_advisor, v_advisor_name,
        v_time, v_time::text, true, jsonb_build_array(v_event)
      ) returning id into v_lead;
      v_created := v_created + 1;
    else
      update public.leads
         set whatsapp_bsuid = coalesce(v_bsuid, whatsapp_bsuid),
             whatsapp_username = coalesce(v_username, whatsapp_username),
             whatsapp_phone_e164 = coalesce(
               whatsapp_phone_e164,
               case when v_phone is not null then '+' || v_phone end
             ),
             phone = coalesce(phone, case when v_phone is not null then '+' || v_phone end),
             whatsapp_wa_id = coalesce(whatsapp_wa_id, v_from, v_bsuid),
             action_history = coalesce(action_history, '[]'::jsonb) || jsonb_build_array(v_event),
             last_activity = now()::text,
             days_inactive = 0,
             updated_at = now()
       where organization_id = v_org and id = v_lead;
    end if;

    update public.whatsapp_inbox
       set lead_id = v_lead, processed_at = now(), processing_error = null
     where organization_id = v_org and id = v_inbox;

    v_message := null;
    insert into public.whatsapp_messages (
      organization_id, lead_id, chatwoot_conversation_id,
      direction, content, content_type, sender_name, sender_type,
      message_created_at, media, provider, provider_message_id,
      channel_id, whatsapp_bsuid, whatsapp_username
    ) values (
      v_org, v_lead, null,
      lower(v_direction), v_text, lower(v_type),
      case when v_direction = 'OUT' then coalesce(v_advisor_name, 'WhatsApp Business') else v_name end,
      case when v_direction = 'OUT' then 'advisor' else 'contact' end,
      v_time, v_media, 'infobip', v_message_id,
      v_channel, v_bsuid, v_username
    )
    on conflict (organization_id, provider, provider_message_id)
      where provider_message_id is not null do nothing
    returning id into v_message;

    insert into public.comunicaciones (
      organization_id, lead_id, asesor_id, tipo, resumen,
      transcripcion, ocurrio_en, metadata
    ) values (
      v_org, v_lead, v_advisor, 'whatsapp', left(v_text, 280),
      v_text, v_time,
      jsonb_build_object(
        'source', v_source, 'direction', lower(v_direction), 'inbox_id', v_inbox,
        'provider_message_id', v_message_id, 'recipient', v_recipient,
        'channel_id', v_channel, 'media', v_media,
        'whatsapp_bsuid', v_bsuid, 'whatsapp_username', v_username,
        'referral', coalesce(r->'referral', m->'referral')
      )
    );

    if v_direction = 'OUT' then
      v_echoed := v_echoed + 1;
    else
      v_received := v_received + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'received', v_received, 'echoed', v_echoed, 'created', v_created,
    'duplicate', v_duplicate, 'ignored', v_ignored, 'errors', v_errors
  );
end;
$function$;

comment on function public.fn_ingest_infobip_multitenant(jsonb) is
  'Espejo solo lectura de Infobip. Resuelve tenant/asesor por el numero empresarial activo y guarda mensajes entrantes y ecos de WhatsApp Business App; soporta BSUID.';

revoke all on function public.fn_ingest_infobip_multitenant(jsonb)
  from public, anon, authenticated;
grant execute on function public.fn_ingest_infobip_multitenant(jsonb)
  to service_role;
