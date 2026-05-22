-- 043_bot_lead_resolver_unaccent_phone10.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Reconocimiento de clientes más robusto en las RPCs del bot de Telegram
-- (org-agnósticas — resuelven org por profiles.telegram_chat_id).
--
--  Problema A.1 (nombre): "Hugo" no encontraba "[TEST] Hugo Salinas" en algunos
--    casos, y los acentos/mayúsculas fallaban. Ahora: ILIKE parcial + unaccent.
--    Si hay varias coincidencias por nombre → desambiguación (lista corta de
--    botones para elegir) en vez de "sin coincidencias".
--  Problema A.2 (teléfono): el lado n8n normaliza a 10 dígitos (9985550206) pero
--    phone_normalized guarda con prefijo país (529985550206) → no matcheaba.
--    Ahora se compara por los ÚLTIMOS 10 DÍGITOS de forma consistente.
--
-- Diseño (fix en un solo punto, no en 17 funciones):
--   - _bot_phone10(text): últimos 10 dígitos.
--   - _bot_canonical_phone(org,actor,role,phone): dado un teléfono, devuelve el
--     `phone` real del lead que coincide por últimos-10 dígitos (si hay
--     exactamente 1); si no, devuelve el original (preserva comportamiento).
--   - bot_nlu_dispatch (wrapper): canonicaliza v_args->>'phone' ANTES de delegar
--     a _core, así view_lead/update_fields/add_*/create_deal/etc. matchean por
--     phone_normalized sin tocar sus cuerpos.
--   - bot_set_priority: resolver con unaccent + phone10 + desambiguación.
--   - bot_quick_search: unaccent + phone10.
--   - bot_handle_callback (wrapper): nueva ruta 'setprio' (botón de la
--     desambiguación → fija prioridad 1 por teléfono).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent;

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public._bot_phone10(p text)
returns text language sql immutable as $function$
  select right(regexp_replace(coalesce(p,''),'[^0-9]','','g'),10);
$function$;

create or replace function public._bot_canonical_phone(p_org uuid, p_actor uuid, p_role text, p_phone text)
returns text language plpgsql stable security definer set search_path to 'public' as $function$
declare v_d text; v_all boolean; v_phones text[];
begin
  v_d := public._bot_phone10(p_phone);
  if length(v_d) < 7 then return p_phone; end if;
  v_all := p_role in ('super_admin','admin','ceo','director');
  select array_agg(phone) into v_phones from (
    select phone from public.leads
     where organization_id = p_org and deleted_at is null
       and (v_all or asesor_id = p_actor)
       and public._bot_phone10(phone_normalized) = v_d
     limit 2
  ) s;
  if array_length(v_phones,1) = 1 then return v_phones[1]; end if;
  return p_phone;
end; $function$;

revoke all on function public._bot_phone10(text) from public;
revoke all on function public._bot_canonical_phone(uuid,uuid,text,text) from public;
grant execute on function public._bot_phone10(text) to service_role;
grant execute on function public._bot_canonical_phone(uuid,uuid,text,text) to service_role;

-- ── dispatch wrapper: canonicaliza el telefono (últimos 10 dígitos) ───────────
create or replace function public.bot_nlu_dispatch(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_args jsonb; v_as jsonb; v_canon text;
begin
  v_args := case when p_args is null or jsonb_typeof(p_args) <> 'object' then '{}'::jsonb else p_args end;

  if p_tool_name = 'list_priority' then
    return public.bot_list_priority(p_telegram_chat_id);
  elsif p_tool_name = 'set_priority' then
    return public.bot_set_priority(p_telegram_chat_id, coalesce(v_args->>'query', v_args->>'phone', v_args->>'name'), nullif(v_args->>'position','')::int);
  end if;

  if coalesce(v_args->>'phone','') <> '' then
    v_as := public.identify_asesor_by_telegram(p_telegram_chat_id);
    if coalesce((v_as->>'paired')::boolean,false) then
      v_canon := public._bot_canonical_phone((v_as->>'organization_id')::uuid, (v_as->>'profile_id')::uuid, coalesce(v_as->>'role','asesor'), v_args->>'phone');
      if v_canon is not null and v_canon <> (v_args->>'phone') then
        v_args := v_args || jsonb_build_object('phone', v_canon);
      end if;
    end if;
  end if;

  return public.bot_nlu_dispatch_core(p_telegram_chat_id, p_tool_name, v_args);
end; $function$;

revoke all on function public.bot_nlu_dispatch(bigint,text,jsonb) from public;
grant execute on function public.bot_nlu_dispatch(bigint,text,jsonb) to service_role;

-- ── set_priority: unaccent + phone10 + desambiguación ────────────────────────
create or replace function public.bot_set_priority(p_telegram_chat_id bigint, p_query text, p_position integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_org uuid; v_pid uuid; v_pname text;
  v_prefs jsonb; v_pinned text[]; v_dismissed text[]; v_order text[];
  v_lead uuid; v_lname text; v_qd10 text; v_pos int; v_len int;
  v_nmatch int; v_kb jsonb;
begin
  if p_query is null or length(trim(p_query))=0 then return jsonb_build_object('error','query_required'); end if;
  select organization_id,id,name into v_org,v_pid,v_pname
    from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true limit 1;
  if v_pid is null then return jsonb_build_object('error','asesor_not_paired'); end if;

  v_qd10 := right(regexp_replace(coalesce(p_query,''),'[^0-9]','','g'),10);

  select count(*) into v_nmatch from public.leads l
   where l.organization_id=v_org and l.deleted_at is null
     and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
     and ( (length(v_qd10) >= 7 and public._bot_phone10(l.phone_normalized)=v_qd10)
           or unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%' );

  if v_nmatch = 0 then
    return jsonb_build_object('ok',false,'error','lead_not_found',
      'reply',jsonb_build_object('text','No encontré un cliente que coincida con "'||p_query||'".','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  if v_nmatch > 1 and length(v_qd10) < 7 then
    select jsonb_agg(jsonb_build_array(public._bot_btn(
              left(coalesce(x.name,'(sin nombre)')||' · '||coalesce(x.stage,'-'), 60),
              'setprio', regexp_replace(coalesce(x.phone_normalized, x.phone, ''),'[^0-9]','','g'))))
      into v_kb
    from ( select l.name, l.stage, l.phone_normalized, l.phone, l.updated_at from public.leads l
            where l.organization_id=v_org and l.deleted_at is null
              and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
              and unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%'
            order by l.updated_at desc limit 6 ) x;
    v_kb := coalesce(v_kb,'[]'::jsonb) || public._bot_kb_back();
    return jsonb_build_object('ok',true,'ambiguous',true,'count',v_nmatch,
      'reply',jsonb_build_object('text','Hay '||v_nmatch||' clientes que coinciden con "'||p_query||'". ¿Cuál?','parse_mode',null,'inline_keyboard',v_kb));
  end if;

  select l.id,l.name into v_lead,v_lname from public.leads l
   where l.organization_id=v_org and l.deleted_at is null
     and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
     and ( (length(v_qd10) >= 7 and public._bot_phone10(l.phone_normalized)=v_qd10)
           or unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%' )
   order by (unaccent(lower(l.name))=unaccent(lower(p_query))) desc,
            (unaccent(lower(l.name)) like unaccent(lower(p_query))||'%') desc, l.updated_at desc
   limit 1;
  if v_lead is null then
    return jsonb_build_object('ok',false,'error','lead_not_found',
      'reply',jsonb_build_object('text','No encontré un cliente que coincida con "'||p_query||'".','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  select coalesce(crm_prefs,'{}'::jsonb) into v_prefs from public.profiles where id=v_pid;
  v_pinned    := array(select jsonb_array_elements_text(coalesce(v_prefs->'pinned','[]'::jsonb)));
  v_dismissed := array(select jsonb_array_elements_text(coalesce(v_prefs->'dismissed','[]'::jsonb)));
  v_order     := array(select jsonb_array_elements_text(coalesce(v_prefs->'order','[]'::jsonb)));
  if not (v_lead::text = any(v_pinned)) then v_pinned := v_pinned || v_lead::text; end if;
  v_dismissed := array_remove(v_dismissed, v_lead::text);
  v_order := array_remove(v_order, v_lead::text);
  v_len := coalesce(array_length(v_order,1),0);
  v_pos := greatest(1, least(coalesce(p_position,1), v_len+1));
  v_order := (case when v_pos>1 then v_order[1:v_pos-1] else array[]::text[] end) || v_lead::text || (case when v_pos<=v_len then v_order[v_pos:v_len] else array[]::text[] end);
  update public.profiles set crm_prefs = v_prefs || jsonb_build_object('pinned',to_jsonb(v_pinned),'dismissed',to_jsonb(v_dismissed),'order',to_jsonb(v_order)) where id=v_pid;

  return jsonb_build_object('ok',true,'lead_id',v_lead,'name',v_lname,'position',v_pos,
    'reply', jsonb_build_object('text','Listo, puse a '||v_lname||' en prioridad '||v_pos||'. Lo verás reordenado al refrescar el CRM.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
end; $function$;

revoke all on function public.bot_set_priority(bigint,text,integer) from public;
grant execute on function public.bot_set_priority(bigint,text,integer) to service_role;

-- ── quick_search: unaccent + phone10 ─────────────────────────────────────────
create or replace function public.bot_quick_search(p_telegram_chat_id bigint, p_query text, p_limit integer DEFAULT 10)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_asesor jsonb; v_profile_id uuid; v_org_id uuid; v_role text; v_view_all boolean;
  v_q text; v_q_digits text; v_results jsonb;
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

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.score desc, r.updated_at desc), '[]'::jsonb) into v_results
  from (
    select id, name, phone, email, stage, score, hot, asesor_name, next_action, next_action_at, updated_at
    from public.leads
    where organization_id = v_org_id and deleted_at is null
      and (v_view_all or asesor_id = v_profile_id)
      and (
        unaccent(lower(coalesce(name,''))) like '%' || unaccent(v_q) || '%'
        or unaccent(lower(coalesce(email,''))) like '%' || unaccent(v_q) || '%'
        or (length(v_q_digits) >= 7 and public._bot_phone10(phone_normalized) = right(v_q_digits,10))
        or (length(v_q_digits) between 3 and 6 and coalesce(phone_normalized,'') like '%' || v_q_digits || '%')
      )
    order by score desc, updated_at desc
    limit greatest(1, least(p_limit, 25))
  ) r;

  return jsonb_build_object('success', true, 'query', p_query, 'count', jsonb_array_length(v_results), 'results', v_results);
end; $function$;

revoke all on function public.bot_quick_search(bigint,text,integer) from public;
grant execute on function public.bot_quick_search(bigint,text,integer) to service_role;

-- ── callback wrapper: ruta 'setprio' (botón de desambiguación) ───────────────
create or replace function public.bot_handle_callback(p_telegram_chat_id bigint, p_callback_data text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_verify jsonb; v_action text; v_payload text;
begin
  v_verify := public._bot_cb_verify(p_callback_data);
  if (v_verify->>'valid')::boolean then
    v_action  := v_verify->>'action';
    v_payload := v_verify->>'payload';
    if v_action = 'list' then
      return public.bot_list_my_clients_v2(p_telegram_chat_id);
    elsif v_action = 'setprio' then
      return public.bot_set_priority(p_telegram_chat_id, split_part(coalesce(v_payload,''),':',1), 1);
    end if;
  end if;
  return public.bot_handle_callback_core(p_telegram_chat_id, p_callback_data);
end; $function$;

revoke all on function public.bot_handle_callback(bigint, text) from public;
grant execute on function public.bot_handle_callback(bigint, text) to service_role;
