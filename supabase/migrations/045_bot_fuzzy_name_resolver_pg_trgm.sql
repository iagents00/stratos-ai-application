-- 045_bot_fuzzy_name_resolver_pg_trgm.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Búsqueda difusa (tolerante a typos) en el resolver del bot de Telegram.
--
-- Problema: "grabiela" no encontraba "[TEST] Gabriela Ríos" porque ILIKE exige
-- substring exacta. Ahora, SOLO como fallback (cuando la pasada exacta no
-- encontró nada y el query es un nombre de >=4 chars), se usa pg_trgm
-- word_similarity() contra el nombre (unaccent + lower) con umbral 0.3.
--
-- word_similarity(query, name) compara el query contra la mejor secuencia de
-- palabras del nombre, así un typo de un solo nombre matchea aunque el lead
-- tenga prefijo "[TEST]" + apellido. Umbral 0.3 calibrado: 'grabiela'→'gabriela'
-- da 0.333; un nombre no relacionado da 0 → sin falsos positivos. Si varios
-- superan el umbral → desambiguación (mismo flujo que nombre parcial).
--
-- Solo redefine bot_set_priority y bot_quick_search (resolver por nombre).
-- Aditivo, scoped por asesor/org, service_role.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

create or replace function public.bot_set_priority(p_telegram_chat_id bigint, p_query text, p_position integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_org uuid; v_pid uuid; v_pname text;
  v_prefs jsonb; v_pinned text[]; v_dismissed text[]; v_order text[];
  v_lead uuid; v_lname text; v_qd10 text; v_pos int; v_len int;
  v_nmatch int; v_kb jsonb; v_use_fuzzy boolean := false;
begin
  if p_query is null or length(trim(p_query))=0 then return jsonb_build_object('error','query_required'); end if;
  select organization_id,id,name into v_org,v_pid,v_pname
    from public.profiles where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true limit 1;
  if v_pid is null then return jsonb_build_object('error','asesor_not_paired'); end if;

  v_qd10 := right(regexp_replace(coalesce(p_query,''),'[^0-9]','','g'),10);

  -- 1) pasada exacta: telefono (últimos 10) OR nombre (unaccent, parcial)
  select count(*) into v_nmatch from public.leads l
   where l.organization_id=v_org and l.deleted_at is null
     and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
     and ( (length(v_qd10) >= 7 and public._bot_phone10(l.phone_normalized)=v_qd10)
           or unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%' );

  -- 2) fallback difuso (pg_trgm) solo si lo exacto no encontró nada y el query
  --    es un nombre de >=4 chars → tolera typos tipo 'grabiela' -> Gabriela.
  if v_nmatch = 0 and length(trim(p_query)) >= 4 and length(v_qd10) < 7 then
    v_use_fuzzy := true;
    select count(*) into v_nmatch from public.leads l
     where l.organization_id=v_org and l.deleted_at is null
       and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
       and word_similarity(unaccent(lower(p_query)), unaccent(lower(coalesce(l.name,'')))) >= 0.3;
  end if;

  if v_nmatch = 0 then
    return jsonb_build_object('ok',false,'error','lead_not_found',
      'reply',jsonb_build_object('text','No encontré un cliente que coincida con "'||p_query||'".','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  -- varios por nombre -> desambiguación
  if v_nmatch > 1 and length(v_qd10) < 7 then
    select jsonb_agg(jsonb_build_array(public._bot_btn(
              left(coalesce(x.name,'(sin nombre)')||' · '||coalesce(x.stage,'-'), 60),
              'setprio', regexp_replace(coalesce(x.phone_normalized, x.phone, ''),'[^0-9]','','g'))))
      into v_kb
    from ( select l.name, l.stage, l.phone_normalized, l.phone, l.updated_at,
                  word_similarity(unaccent(lower(p_query)), unaccent(lower(coalesce(l.name,'')))) ws
            from public.leads l
            where l.organization_id=v_org and l.deleted_at is null
              and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
              and ( case when v_use_fuzzy
                         then word_similarity(unaccent(lower(p_query)), unaccent(lower(coalesce(l.name,'')))) >= 0.3
                         else unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%' end )
            order by ws desc nulls last, l.updated_at desc limit 6 ) x;
    v_kb := coalesce(v_kb,'[]'::jsonb) || public._bot_kb_back();
    return jsonb_build_object('ok',true,'ambiguous',true,'count',v_nmatch,'fuzzy',v_use_fuzzy,
      'reply',jsonb_build_object('text','Hay '||v_nmatch||' clientes que coinciden con "'||p_query||'". ¿Cuál?','parse_mode',null,'inline_keyboard',v_kb));
  end if;

  -- resolver a 1
  select l.id,l.name into v_lead,v_lname from public.leads l
   where l.organization_id=v_org and l.deleted_at is null
     and (l.asesor_id=v_pid or lower(l.asesor_name)=lower(v_pname))
     and ( (length(v_qd10) >= 7 and public._bot_phone10(l.phone_normalized)=v_qd10)
           or unaccent(lower(coalesce(l.name,''))) like '%'||unaccent(lower(p_query))||'%'
           or (v_use_fuzzy and word_similarity(unaccent(lower(p_query)), unaccent(lower(coalesce(l.name,'')))) >= 0.3) )
   order by (unaccent(lower(l.name))=unaccent(lower(p_query))) desc,
            (unaccent(lower(l.name)) like unaccent(lower(p_query))||'%') desc,
            word_similarity(unaccent(lower(p_query)), unaccent(lower(coalesce(l.name,'')))) desc,
            l.updated_at desc
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

  return jsonb_build_object('ok',true,'lead_id',v_lead,'name',v_lname,'position',v_pos,'fuzzy',v_use_fuzzy,
    'reply', jsonb_build_object('text','Listo, puse a '||v_lname||' en prioridad '||v_pos||'. Lo verás reordenado al refrescar el CRM.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
end; $function$;

revoke all on function public.bot_set_priority(bigint,text,integer) from public;
grant execute on function public.bot_set_priority(bigint,text,integer) to service_role;

create or replace function public.bot_quick_search(p_telegram_chat_id bigint, p_query text, p_limit integer DEFAULT 10)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_asesor jsonb; v_profile_id uuid; v_org_id uuid; v_role text; v_view_all boolean;
  v_q text; v_q_digits text; v_results jsonb; v_count int;
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

  -- pasada exacta (nombre/email unaccent, telefono últimos-10)
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
  v_count := jsonb_array_length(v_results);

  -- fallback difuso (pg_trgm) si lo exacto no encontró nada y el query es nombre de >=4 chars
  if v_count = 0 and length(v_q) >= 4 and length(v_q_digits) < 7 then
    select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.ws desc, r.score desc), '[]'::jsonb) into v_results
    from (
      select id, name, phone, email, stage, score, hot, asesor_name, next_action, next_action_at, updated_at,
             word_similarity(unaccent(v_q), unaccent(lower(coalesce(name,'')))) as ws
      from public.leads
      where organization_id = v_org_id and deleted_at is null
        and (v_view_all or asesor_id = v_profile_id)
        and word_similarity(unaccent(v_q), unaccent(lower(coalesce(name,'')))) >= 0.3
      order by ws desc, score desc
      limit greatest(1, least(p_limit, 25))
    ) r;
    v_count := jsonb_array_length(v_results);
  end if;

  return jsonb_build_object('success', true, 'query', p_query, 'count', v_count, 'results', v_results);
end; $function$;

revoke all on function public.bot_quick_search(bigint,text,integer) from public;
grant execute on function public.bot_quick_search(bigint,text,integer) to service_role;
