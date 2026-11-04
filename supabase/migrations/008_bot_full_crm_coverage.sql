-- ============================================================================
-- 008_bot_full_crm_coverage.sql
--
-- RPCs faltantes para que el bot de Telegram pueda ejecutar TODOS los
-- movimientos del CRM (paridad completa con la app web).
--
-- Estado previo (ya deployado en prod, NO se toca):
--   bot_pair_by_name, bot_get_lead_by_phone, bot_get_lead_full_context,
--   bot_search_leads_by_name, bot_list_leads_by_filter, bot_list_pending,
--   bot_list_pipeline_summary, bot_upsert_lead, bot_update_lead_fields,
--   bot_soft_delete_lead, bot_view_lead, bot_add_seguimiento,
--   bot_add_comunicacion, bot_add_task, bot_complete_task, bot_create_deal,
--   identify_asesor_by_telegram, consume_telegram_pairing_code,
--   request_telegram_pairing_code, append_lead_note
--
-- Este archivo agrega 9 RPCs para cerrar los huecos:
--   bot_list_tasks               — lista tareas pendientes/hechas de un lead
--   bot_add_expediente_note      — agrega texto/nota al expediente del cliente
--   bot_add_expediente_voice     — agrega transcripción de voz al expediente
--   bot_list_expediente          — lista items del expediente
--   bot_set_ai_agent             — asigna un agente IA al lead (reactivar/seguimiento/callcenter/calificar)
--   bot_pin_lead                 — añade/quita lead de tarjetas de prioridad del asesor
--   bot_get_lead_history         — historial de eventos del lead (etapa, tareas, próximas acciones)
--   bot_get_dashboard_stats      — KPIs del asesor (leads activos, hot, score promedio, pipeline)
--   bot_quick_search             — búsqueda global por nombre/email/teléfono parcial
--
-- Convenciones:
--   - Todas son SECURITY DEFINER (la BD aplica la pertenencia por chat_id).
--   - Identifican al asesor llamando a identify_asesor_by_telegram primero.
--   - Devuelven JSONB con { success, ... } o { error, code }.
--   - Pueden ser invocadas desde n8n con SERVICE_ROLE.
-- ============================================================================

set search_path = public;

-- ----------------------------------------------------------------------------
-- 1) bot_list_tasks(chat_id, phone, only_pending)
-- Lista tareas de un lead, con IDs (para que el bot luego pueda completarlas).
-- ----------------------------------------------------------------------------
create or replace function public.bot_list_tasks(
  p_telegram_chat_id bigint,
  p_phone text,
  p_only_pending boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_lead_id uuid;
  v_lead_name text;
  v_tasks jsonb;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id := (v_asesor->>'organization_id')::uuid;

  select id, name
    into v_lead_id, v_lead_name
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  select coalesce(jsonb_agg(t order by t.order_idx, t.created_at) filter (where t.id is not null), '[]'::jsonb)
    into v_tasks
  from (
    select id, text, done, due_at, done_at, priority, order_idx, created_at
    from public.lead_tasks
    where lead_id = v_lead_id
      and organization_id = v_org_id
      and (not p_only_pending or done = false)
  ) t;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'lead_name', v_lead_name,
    'count', jsonb_array_length(v_tasks),
    'tasks', v_tasks
  );
end;
$$;

grant execute on function public.bot_list_tasks(bigint, text, boolean) to service_role;

-- ----------------------------------------------------------------------------
-- 2) bot_add_expediente_note(chat_id, phone, titulo, contenido, source)
-- Agrega una nota / texto al expediente del cliente (tabla expediente_items).
-- ----------------------------------------------------------------------------
create or replace function public.bot_add_expediente_note(
  p_telegram_chat_id bigint,
  p_phone text,
  p_titulo text,
  p_contenido text,
  p_source text default 'telegram'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_asesor_id uuid;
  v_lead_id uuid;
  v_item_id uuid;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id    := (v_asesor->>'organization_id')::uuid;
  v_asesor_id := (v_asesor->>'profile_id')::uuid;

  select id into v_lead_id
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  insert into public.expediente_items
    (lead_id, asesor_id, organization_id, tipo, titulo, descripcion, metadata)
  values
    (v_lead_id, v_asesor_id, v_org_id, 'texto',
     coalesce(nullif(trim(p_titulo),''), 'Nota desde Telegram'),
     p_contenido,
     jsonb_build_object('source', coalesce(p_source,'telegram')))
  returning id into v_item_id;

  -- Mantén también la columna leads.notas viva (compat con app actual)
  update public.leads
     set notas = case
                   when notas is null or trim(notas) = ''
                   then to_char(now() at time zone 'America/Mexico_City','DD Mon HH24:MI') || ' · ' || coalesce(p_source,'telegram') || E'\n' || p_contenido
                   else notas || E'\n──── ' || to_char(now() at time zone 'America/Mexico_City','DD Mon HH24:MI') || ' · ' || coalesce(p_source,'telegram') || E' ────\n' || p_contenido
                 end,
         last_activity = 'Nota agregada · ' || to_char(now() at time zone 'America/Mexico_City','DD Mon HH24:MI'),
         updated_at = now()
   where id = v_lead_id;

  return jsonb_build_object('success', true, 'item_id', v_item_id, 'lead_id', v_lead_id);
end;
$$;

grant execute on function public.bot_add_expediente_note(bigint, text, text, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 3) bot_add_expediente_voice(chat_id, phone, titulo, transcripcion, duracion_seg, storage_path)
-- Agrega una transcripción de voz al expediente (con metadata del audio).
-- ----------------------------------------------------------------------------
create or replace function public.bot_add_expediente_voice(
  p_telegram_chat_id bigint,
  p_phone text,
  p_titulo text,
  p_transcripcion text,
  p_duracion_seg integer default null,
  p_storage_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_asesor_id uuid;
  v_lead_id uuid;
  v_item_id uuid;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id    := (v_asesor->>'organization_id')::uuid;
  v_asesor_id := (v_asesor->>'profile_id')::uuid;

  select id into v_lead_id
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  insert into public.expediente_items
    (lead_id, asesor_id, organization_id, tipo, titulo, descripcion, storage_path, mime_type, metadata)
  values
    (v_lead_id, v_asesor_id, v_org_id, 'audio',
     coalesce(nullif(trim(p_titulo),''), 'Nota de voz desde Telegram'),
     p_transcripcion,
     p_storage_path,
     'audio/ogg',
     jsonb_build_object(
       'source','telegram',
       'duracion_seg', p_duracion_seg,
       'transcrito', true
     ))
  returning id into v_item_id;

  -- También registra como comunicacion para el feed cronológico
  insert into public.comunicaciones
    (lead_id, asesor_id, organization_id, tipo, resumen, transcripcion, ocurrio_en, duracion_segundos, metadata)
  values
    (v_lead_id, v_asesor_id, v_org_id, 'nota',
     coalesce(nullif(trim(p_titulo),''), 'Nota de voz'),
     p_transcripcion,
     now(),
     p_duracion_seg,
     jsonb_build_object('source','telegram_voice'));

  update public.leads
     set last_activity = 'Nota de voz · ' || to_char(now() at time zone 'America/Mexico_City','DD Mon HH24:MI'),
         updated_at = now()
   where id = v_lead_id;

  return jsonb_build_object('success', true, 'item_id', v_item_id, 'lead_id', v_lead_id);
end;
$$;

grant execute on function public.bot_add_expediente_voice(bigint, text, text, text, integer, text) to service_role;

-- ----------------------------------------------------------------------------
-- 4) bot_list_expediente(chat_id, phone, limit)
-- Lista los items del expediente de un lead, más recientes primero.
-- ----------------------------------------------------------------------------
create or replace function public.bot_list_expediente(
  p_telegram_chat_id bigint,
  p_phone text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_lead_id uuid;
  v_lead_name text;
  v_items jsonb;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id := (v_asesor->>'organization_id')::uuid;

  select id, name
    into v_lead_id, v_lead_name
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
    into v_items
  from (
    select id, tipo, titulo, descripcion, storage_path, mime_type, size_bytes,
           metadata, created_at
    from public.expediente_items
    where lead_id = v_lead_id
      and organization_id = v_org_id
    order by created_at desc
    limit greatest(1, least(p_limit, 50))
  ) t;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'lead_name', v_lead_name,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
end;
$$;

grant execute on function public.bot_list_expediente(bigint, text, integer) to service_role;

-- ----------------------------------------------------------------------------
-- 5) bot_set_ai_agent(chat_id, phone, agent_key)
-- Asigna o quita un agente IA al lead. Valores permitidos:
--   'reactivar', 'seguimiento', 'callcenter', 'calificar', NULL (para quitar).
-- ----------------------------------------------------------------------------
create or replace function public.bot_set_ai_agent(
  p_telegram_chat_id bigint,
  p_phone text,
  p_agent_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_lead_id uuid;
  v_lead_name text;
  v_clean_key text;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id := (v_asesor->>'organization_id')::uuid;

  v_clean_key := lower(nullif(trim(coalesce(p_agent_key,'')),''));
  if v_clean_key is not null
     and v_clean_key not in ('reactivar','seguimiento','callcenter','calificar') then
    return jsonb_build_object('error','invalid_agent_key','allowed', jsonb_build_array('reactivar','seguimiento','callcenter','calificar'));
  end if;

  update public.leads
     set ai_agent = v_clean_key,
         updated_at = now()
   where organization_id = v_org_id
     and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
     and deleted_at is null
   returning id, name into v_lead_id, v_lead_name;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  insert into public.lead_events (lead_id, organization_id, actor_id, actor_name, type, action, metadata)
  values (
    v_lead_id, v_org_id,
    (v_asesor->>'profile_id')::uuid, (v_asesor->>'name'),
    'ai_agent',
    case when v_clean_key is null then 'Agente IA desasignado' else 'Agente IA: ' || v_clean_key end,
    jsonb_build_object('agent', v_clean_key, 'source','telegram')
  );

  return jsonb_build_object('success', true, 'lead_id', v_lead_id, 'lead_name', v_lead_name, 'ai_agent', v_clean_key);
end;
$$;

grant execute on function public.bot_set_ai_agent(bigint, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 6) bot_pin_lead(chat_id, phone, pinned)
-- Añade (pinned=true) o quita (pinned=false) un lead de las tarjetas de
-- prioridad del asesor (vive en profiles.crm_prefs.pinned[]).
-- ----------------------------------------------------------------------------
create or replace function public.bot_pin_lead(
  p_telegram_chat_id bigint,
  p_phone text,
  p_pinned boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_profile_id uuid;
  v_org_id uuid;
  v_lead_id uuid;
  v_lead_name text;
  v_prefs jsonb;
  v_pinned jsonb;
  v_lead_str text;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_profile_id := (v_asesor->>'profile_id')::uuid;
  v_org_id     := (v_asesor->>'organization_id')::uuid;

  select id, name into v_lead_id, v_lead_name
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  v_lead_str := v_lead_id::text;

  select coalesce(crm_prefs, '{}'::jsonb) into v_prefs
  from public.profiles where id = v_profile_id;

  v_pinned := coalesce(v_prefs->'pinned', '[]'::jsonb);

  if p_pinned then
    if not (v_pinned @> to_jsonb(v_lead_str)) then
      v_pinned := v_pinned || to_jsonb(v_lead_str);
    end if;
  else
    v_pinned := (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements_text(v_pinned) elem
      where elem <> v_lead_str
    );
  end if;

  update public.profiles
     set crm_prefs = jsonb_set(v_prefs, '{pinned}', v_pinned, true),
         updated_at = now()
   where id = v_profile_id;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'lead_name', v_lead_name,
    'pinned', p_pinned,
    'total_pinned', jsonb_array_length(v_pinned)
  );
end;
$$;

grant execute on function public.bot_pin_lead(bigint, text, boolean) to service_role;

-- ----------------------------------------------------------------------------
-- 7) bot_get_lead_history(chat_id, phone, limit)
-- Devuelve el timeline del lead: eventos de lead_events + cambios del audit_log.
-- ----------------------------------------------------------------------------
create or replace function public.bot_get_lead_history(
  p_telegram_chat_id bigint,
  p_phone text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_org_id uuid;
  v_lead_id uuid;
  v_lead_name text;
  v_events jsonb;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_org_id := (v_asesor->>'organization_id')::uuid;

  select id, name into v_lead_id, v_lead_name
  from public.leads
  where organization_id = v_org_id
    and phone_normalized = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and deleted_at is null
  limit 1;

  if v_lead_id is null then
    return jsonb_build_object('error','lead_not_found','phone',p_phone);
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.occurred_at desc), '[]'::jsonb)
    into v_events
  from (
    select 'lead_event' as source,
           type, action, actor_name, occurred_at, metadata
    from public.lead_events
    where lead_id = v_lead_id and organization_id = v_org_id
    union all
    select 'comunicacion' as source,
           tipo as type, resumen as action, null::text as actor_name, ocurrio_en as occurred_at, metadata
    from public.comunicaciones
    where lead_id = v_lead_id and organization_id = v_org_id
    order by occurred_at desc
    limit greatest(1, least(p_limit, 100))
  ) t;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'lead_name', v_lead_name,
    'count', jsonb_array_length(v_events),
    'events', v_events
  );
end;
$$;

grant execute on function public.bot_get_lead_history(bigint, text, integer) to service_role;

-- ----------------------------------------------------------------------------
-- 8) bot_get_dashboard_stats(chat_id, scope)
-- KPIs del asesor (scope='me') o de toda la organización (scope='org', solo
-- para director/ceo/admin/super_admin).
-- ----------------------------------------------------------------------------
create or replace function public.bot_get_dashboard_stats(
  p_telegram_chat_id bigint,
  p_scope text default 'me'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_profile_id uuid;
  v_org_id uuid;
  v_role text;
  v_view_all boolean;
  v_total bigint; v_active bigint; v_closed bigint; v_hot bigint;
  v_avg_score numeric; v_pipeline bigint;
  v_pending_today bigint; v_pending_overdue bigint;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_profile_id := (v_asesor->>'profile_id')::uuid;
  v_org_id     := (v_asesor->>'organization_id')::uuid;
  v_role       := coalesce(v_asesor->>'role','asesor');

  v_view_all := p_scope = 'org' and v_role in ('super_admin','admin','ceo','director');

  with src as (
    select * from public.leads
    where organization_id = v_org_id
      and deleted_at is null
      and (v_view_all or asesor_id = v_profile_id)
  )
  select
    count(*) filter (where true),
    count(*) filter (where stage not in ('Cierre','Perdido')),
    count(*) filter (where stage = 'Cierre'),
    count(*) filter (where hot is true and stage not in ('Cierre','Perdido')),
    round(avg(score) filter (where stage not in ('Cierre','Perdido'))::numeric, 1),
    coalesce(sum(presupuesto) filter (where stage not in ('Cierre','Perdido')), 0)
    into v_total, v_active, v_closed, v_hot, v_avg_score, v_pipeline
  from src;

  -- Pendientes
  select
    count(*) filter (where next_action_at::date = (now() at time zone 'America/Cancun')::date),
    count(*) filter (where next_action_at < now())
    into v_pending_today, v_pending_overdue
  from public.leads
  where organization_id = v_org_id
    and deleted_at is null
    and (v_view_all or asesor_id = v_profile_id)
    and next_action_at is not null
    and stage not in ('Cierre','Perdido');

  return jsonb_build_object(
    'success', true,
    'scope', case when v_view_all then 'org' else 'me' end,
    'total', coalesce(v_total,0),
    'active', coalesce(v_active,0),
    'closed', coalesce(v_closed,0),
    'hot', coalesce(v_hot,0),
    'avg_score', coalesce(v_avg_score, 0),
    'pipeline_value', coalesce(v_pipeline, 0),
    'pending_today', coalesce(v_pending_today,0),
    'pending_overdue', coalesce(v_pending_overdue,0)
  );
end;
$$;

grant execute on function public.bot_get_dashboard_stats(bigint, text) to service_role;

-- ----------------------------------------------------------------------------
-- 9) bot_quick_search(chat_id, query, limit)
-- Búsqueda global: matchea por nombre (ilike), teléfono (parcial) o email.
-- Para cuando el asesor no recuerda el teléfono exacto.
-- ----------------------------------------------------------------------------
create or replace function public.bot_quick_search(
  p_telegram_chat_id bigint,
  p_query text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asesor jsonb;
  v_profile_id uuid;
  v_org_id uuid;
  v_role text;
  v_view_all boolean;
  v_q text;
  v_q_digits text;
  v_results jsonb;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean, false) is not true then
    return jsonb_build_object('error','not_paired');
  end if;
  v_profile_id := (v_asesor->>'profile_id')::uuid;
  v_org_id     := (v_asesor->>'organization_id')::uuid;
  v_role       := coalesce(v_asesor->>'role','asesor');
  v_view_all   := v_role in ('super_admin','admin','ceo','director');

  v_q := lower(trim(coalesce(p_query,'')));
  if length(v_q) < 2 then
    return jsonb_build_object('error','query_too_short','min_length', 2);
  end if;
  v_q_digits := regexp_replace(v_q, '[^0-9]', '', 'g');

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.score desc, r.updated_at desc), '[]'::jsonb)
    into v_results
  from (
    select id, name, phone, email, stage, score, hot, asesor_name, next_action, next_action_at, updated_at
    from public.leads
    where organization_id = v_org_id
      and deleted_at is null
      and (v_view_all or asesor_id = v_profile_id)
      and (
        lower(coalesce(name,'')) like '%' || v_q || '%'
        or lower(coalesce(email,'')) like '%' || v_q || '%'
        or (length(v_q_digits) >= 3 and coalesce(phone_normalized,'') like '%' || v_q_digits || '%')
      )
    order by score desc, updated_at desc
    limit greatest(1, least(p_limit, 25))
  ) r;

  return jsonb_build_object(
    'success', true,
    'query', p_query,
    'count', jsonb_array_length(v_results),
    'results', v_results
  );
end;
$$;

grant execute on function public.bot_quick_search(bigint, text, integer) to service_role;

-- ============================================================================
-- Resumen de RPCs después de aplicar esta migración (25 totales)
-- ============================================================================
-- Pareo y onboarding (3):
--   request_telegram_pairing_code, consume_telegram_pairing_code, bot_pair_by_name
--
-- Identidad (1):
--   identify_asesor_by_telegram
--
-- Consulta (8):
--   bot_get_lead_by_phone, bot_get_lead_full_context, bot_view_lead,
--   bot_search_leads_by_name, bot_quick_search (NUEVA),
--   bot_list_leads_by_filter, bot_list_pipeline_summary,
--   bot_get_dashboard_stats (NUEVA)
--
-- Agenda y pendientes (2):
--   bot_list_pending, bot_list_tasks (NUEVA)
--
-- Escritura de lead (3):
--   bot_upsert_lead, bot_update_lead_fields, bot_soft_delete_lead
--
-- Historial de interacciones (3):
--   bot_add_seguimiento, bot_add_comunicacion, bot_get_lead_history (NUEVA)
--
-- Expediente (3):
--   bot_add_expediente_note (NUEVA), bot_add_expediente_voice (NUEVA),
--   bot_list_expediente (NUEVA)
--
-- Tareas (2):
--   bot_add_task, bot_complete_task
--
-- Cierre y agentes (2):
--   bot_create_deal, bot_set_ai_agent (NUEVA)
--
-- Priorización (1):
--   bot_pin_lead (NUEVA)
-- ============================================================================
