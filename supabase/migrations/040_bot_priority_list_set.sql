-- ════════════════════════════════════════════════════════════════════════
-- 040 — Prioridades en el bot: list_priority + set_priority (en bot_nlu_dispatch)
-- ────────────────────────────────────────────────────────────────────────
-- El board "Clientes en prioridad" guarda orden/pins en profiles.crm_prefs
-- (JSONB por asesor; la columna leads.priority_order quedó vestigial). Estas
-- RPCs leen/escriben ese JSONB para que el bot maneje las tarjetas:
--   · bot_list_priority(p_telegram_chat_id): clientes en prioridad del asesor,
--     ordenados (membresía auto = is_new/hot/stage activa/inactivo<=3d o pinned,
--     menos dismissed; orden = crm_prefs.order).
--   · bot_set_priority(p_telegram_chat_id, p_query, p_position): resuelve el lead
--     por NOMBRE o teléfono, lo pinea y lo mueve a la posición en crm_prefs.order.
--
-- Integración: se renombra bot_nlu_dispatch → bot_nlu_dispatch_core y se crea un
-- wrapper bot_nlu_dispatch que intercepta tool_name 'list_priority'/'set_priority'
-- y delega el resto al core (sin reescribir la función gigante).
--   tool_name 'list_priority' → args {}
--   tool_name 'set_priority'  → args { query (nombre o tel), position }
--
-- ⚠️ El CRM cachea crm_prefs al login; los cambios del bot se ven al refrescar.
-- SECURITY DEFINER, scoped por asesor (telegram_chat_id). Duke.
-- Ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bot_list_priority(p_telegram_chat_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_org uuid; v_pid uuid; v_pname text; v_prefs jsonb; v_pinned text[]; v_dismissed text[]; v_order text[]; v_rows jsonb; v_text text;
BEGIN
  SELECT organization_id,id,name INTO v_org,v_pid,v_pname FROM public.profiles WHERE telegram_chat_id=p_telegram_chat_id AND COALESCE(active,true)=true LIMIT 1;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('error','asesor_not_paired'); END IF;
  SELECT COALESCE(crm_prefs,'{}'::jsonb) INTO v_prefs FROM public.profiles WHERE id=v_pid;
  v_pinned    := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'pinned','[]'::jsonb)));
  v_dismissed := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'dismissed','[]'::jsonb)));
  v_order     := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'order','[]'::jsonb)));
  WITH mine AS (
    SELECT l.id,l.name,l.phone,l.stage,l.score,l.next_action,l.is_new,l.hot,l.updated_at
    FROM public.leads l WHERE l.organization_id=v_org AND l.deleted_at IS NULL AND (l.asesor_id=v_pid OR lower(l.asesor_name)=lower(v_pname))
  ), prio AS (
    SELECT * FROM mine m WHERE NOT (m.id::text = ANY(v_dismissed))
      AND ( m.id::text = ANY(v_pinned) OR m.is_new OR m.hot OR lower(m.stage) IN ('zoom agendado','reactivar zoom','apartó','seguimiento') OR m.updated_at >= now()-interval '3 days' )
  ), numbered AS (
    SELECT p.*, row_number() OVER (ORDER BY array_position(v_order, p.id::text) NULLS LAST, (p.id::text = ANY(v_pinned)) DESC, p.updated_at DESC) AS position FROM prio p
  )
  SELECT jsonb_agg(jsonb_build_object('position',position,'lead_id',id,'name',name,'phone',phone,'stage',stage,'score',score,'next_action',next_action) ORDER BY position),
         string_agg(CASE WHEN position<=10 THEN position||'. '||name||' — '||COALESCE(stage,'')||CASE WHEN score IS NOT NULL THEN ' (score '||score||')' ELSE '' END END, E'\n' ORDER BY position)
  INTO v_rows, v_text FROM numbered;
  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'priority',COALESCE(v_rows,'[]'::jsonb),
    'reply', jsonb_build_object('text', CASE WHEN v_rows IS NULL THEN 'No tenés clientes en prioridad ahora.' ELSE 'Tus clientes en prioridad:'||E'\n'||v_text END, 'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
END; $fn$;

CREATE OR REPLACE FUNCTION public.bot_set_priority(p_telegram_chat_id bigint, p_query text, p_position int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_org uuid; v_pid uuid; v_pname text; v_prefs jsonb; v_pinned text[]; v_dismissed text[]; v_order text[];
  v_lead uuid; v_lname text; v_qdigits text; v_pos int; v_len int;
BEGIN
  IF p_query IS NULL OR length(trim(p_query))=0 THEN RETURN jsonb_build_object('error','query_required'); END IF;
  SELECT organization_id,id,name INTO v_org,v_pid,v_pname FROM public.profiles WHERE telegram_chat_id=p_telegram_chat_id AND COALESCE(active,true)=true LIMIT 1;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('error','asesor_not_paired'); END IF;
  v_qdigits := NULLIF(regexp_replace(p_query,'[^0-9]','','g'),'');
  SELECT l.id,l.name INTO v_lead,v_lname FROM public.leads l
  WHERE l.organization_id=v_org AND l.deleted_at IS NULL AND (l.asesor_id=v_pid OR lower(l.asesor_name)=lower(v_pname))
    AND ( (v_qdigits IS NOT NULL AND (l.phone_normalized=v_qdigits OR regexp_replace(COALESCE(l.phone,''),'[^0-9]','','g')=v_qdigits OR l.whatsapp_phone_e164=p_query)) OR l.name ILIKE '%'||p_query||'%' )
  ORDER BY (lower(l.name)=lower(p_query)) DESC, (l.name ILIKE p_query||'%') DESC, l.updated_at DESC LIMIT 1;
  IF v_lead IS NULL THEN RETURN jsonb_build_object('ok',false,'error','lead_not_found','reply',jsonb_build_object('text','No encontré un cliente que coincida con "'||p_query||'".','parse_mode',null,'inline_keyboard',public._bot_kb_back())); END IF;
  SELECT COALESCE(crm_prefs,'{}'::jsonb) INTO v_prefs FROM public.profiles WHERE id=v_pid;
  v_pinned    := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'pinned','[]'::jsonb)));
  v_dismissed := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'dismissed','[]'::jsonb)));
  v_order     := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_prefs->'order','[]'::jsonb)));
  IF NOT (v_lead::text = ANY(v_pinned)) THEN v_pinned := v_pinned || v_lead::text; END IF;
  v_dismissed := array_remove(v_dismissed, v_lead::text);
  v_order := array_remove(v_order, v_lead::text);
  v_len := COALESCE(array_length(v_order,1),0);
  v_pos := GREATEST(1, LEAST(COALESCE(p_position,1), v_len+1));
  v_order := (CASE WHEN v_pos>1 THEN v_order[1:v_pos-1] ELSE ARRAY[]::text[] END) || v_lead::text || (CASE WHEN v_pos<=v_len THEN v_order[v_pos:v_len] ELSE ARRAY[]::text[] END);
  UPDATE public.profiles SET crm_prefs = v_prefs || jsonb_build_object('pinned',to_jsonb(v_pinned),'dismissed',to_jsonb(v_dismissed),'order',to_jsonb(v_order)) WHERE id=v_pid;
  RETURN jsonb_build_object('ok',true,'lead_id',v_lead,'name',v_lname,'position',v_pos,
    'reply', jsonb_build_object('text','Listo, puse a '||v_lname||' en prioridad '||v_pos||'. Lo verás reordenado al refrescar el CRM.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
END; $fn$;

-- Renombrar el dispatch original y poner un wrapper que intercepta los 2 tools nuevos
ALTER FUNCTION public.bot_nlu_dispatch(bigint, text, jsonb) RENAME TO bot_nlu_dispatch_core;
CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_args jsonb;
BEGIN
  v_args := CASE WHEN p_args IS NULL OR jsonb_typeof(p_args) <> 'object' THEN '{}'::jsonb ELSE p_args END;
  IF p_tool_name = 'list_priority' THEN RETURN public.bot_list_priority(p_telegram_chat_id);
  ELSIF p_tool_name = 'set_priority' THEN RETURN public.bot_set_priority(p_telegram_chat_id, COALESCE(v_args->>'query', v_args->>'phone', v_args->>'name'), NULLIF(v_args->>'position','')::int);
  END IF;
  RETURN public.bot_nlu_dispatch_core(p_telegram_chat_id, p_tool_name, v_args);
END; $function$;

REVOKE ALL ON FUNCTION public.bot_list_priority(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bot_set_priority(bigint, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bot_list_priority(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_set_priority(bigint, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_nlu_dispatch(bigint, text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
