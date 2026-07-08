-- ═══════════════════════════════════════════════════════════════════════════
-- 064 · Ruteo del bot para propiedades (bot_nlu_dispatch_gvintell)
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ NO APLICADA A PROD TODAVÍA (2026-07-08). Este CREATE OR REPLACE pisa el
-- dispatcher COMPLETO del bot de Telegram. Antes de aplicarla:
--   1. select pg_get_functiondef('public.bot_nlu_dispatch_gvintell(bigint,text,jsonb)'::regprocedure)
--      y verificar que prod NO cambió desde que se escribió esta copia
--      (si cambió, re-inyectar SOLO el bloque "(0.5) PROPIEDADES" en la def actual).
--   2. Aplicar junto con el cambio del system prompt del AI Agent en n8n BOTv5
--      (workflow vM5Yu1HRmUDPOCg7): tool buscar_propiedades + "propiedades" en
--      isBypassCmd de Keep Context.
-- El resto del catálogo (CRM + fichas técnicas) funciona sin esta migración.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Ruteo en el dispatch del bot: intercepta tool_name de propiedades y, como
-- FALLBACK (solo si el clasificador no eligió herramienta), la detección por
-- texto. Cambio ADITIVO: el resto de la función queda idéntico a producción.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_name text; v_ncand int; v_text text;
  v_org uuid; v_expenses_enabled boolean := false; v_team_requires_evidence boolean := false;
  v_source text;
  v_cn text; v_norm_list text; v_parts int; v_maxwords int; v_has_comma boolean;
  v_pm public.bot_pending_stage_move%rowtype; v_nrm text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;
  v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'texto', v_args->>'query', ''));

  -- (0) Confirmacion de "mover toda una etapa" pendiente. Se chequea ANTES de todo (captura si/no).
  -- \y (limite de palabra) para tolerar "si, muevelos" (coma tras el si). NO usar ($|\s): falla con coma.
  select * into v_pm from public.bot_pending_stage_move where telegram_chat_id = p_telegram_chat_id;
  if found then
    if v_pm.created_at < now() - interval '15 minutes' then
      delete from public.bot_pending_stage_move where telegram_chat_id = p_telegram_chat_id;
    else
      v_nrm := translate(lower(v_text), 'áéíóúü', 'aeiouu');
      if v_nrm ~ '^\s*(si|claro|dale|ok|okey|okay|confirmo|confirmar|confirmado|correcto|adelante|hazlo|hazlos|sip|simon|afirmativo|muevelos|movelos|mandalos|pasalos|de una)\y'
         or v_nrm in ('si','dale','ok','sip','sii','siii','va','vale') then
        return public.bot_bulk_move_all_stage(p_telegram_chat_id, jsonb_build_object('confirmed', true));
      elsif v_nrm ~ '^\s*(no|nel|nop|nope|cancela|cancelar|mejor no|dejalo|olvidalo|para|stop)\y' then
        delete from public.bot_pending_stage_move where telegram_chat_id = p_telegram_chat_id;
        return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Cancelado, no moví nada. ¿En qué más te ayudo?','inline_keyboard','[]'::jsonb));
      else
        delete from public.bot_pending_stage_move where telegram_chat_id = p_telegram_chat_id;
      end if;
    end if;
  end if;

  -- (0.5) PROPIEDADES: catálogo de proyectos con links de Drive (migración 055).
  -- Se honra el tool del clasificador; la detección por texto es solo fallback
  -- cuando no eligió herramienta ('' o 'menu'). Sin plazas hardcodeadas aquí.
  if v_tool in ('propiedades','buscar_propiedades','properties','inventario','propiedad','top_inversiones')
     or (v_tool in ('','menu') and translate(lower(v_text), 'áéíóúü', 'aeiouu') ~
         '(^/?(propiedades|inventario)($|\s)|\y(top|mejores)\s+(propiedades|inversiones|desarrollos)\y|\ypropiedades\s+(de|en|para)\y|\yinversiones\s+(de|en)\y|\y(dame|mandame|pasame|enviame)\s+(el\s+|las?\s+|los\s+)?(links?|drives?|brochures?|propiedades)\y)')
  then
    return public.bot_propiedades(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  -- (1) Mover TODA una etapa a otra: "manda todos los de X a Y". Requiere "todos (los)? (de|en) ..."
  -- para no confundir un cliente llamado "Todos Santos". \y = limite de palabra (NO \b = backspace).
  if v_tool in ('change_stage','update_stage','move_stage','bulk_change_stage','bulk_stage','bulk_move_stage','mover_varios','mover_multiples') then
    if coalesce(v_args->>'client_name','') ~* '^\s*tod[oa]s?\s+(l[oa]s\s+)?(que\s+est[aá]n\s+en\s+|de\s+|en\s+)'
       or (v_args ? 'from_stage') or (v_args ? 'source_stage')
       or (v_text ~* '\ytod[oa]s?\s+(l[oa]s\s+)?(que\s+est[aá]n\s+en\s+|de\s+|en\s+)' and v_text ~* '\sa\s') then
      return public.bot_bulk_move_all_stage(p_telegram_chat_id, v_args);
    end if;
  end if;

  -- (2) Mover VARIOS clientes de etapa (bulk explicito).
  if v_tool in ('bulk_change_stage','bulk_stage','change_stage_bulk','bulk_move_stage','mover_varios','mover_multiples') then
    return public.bot_bulk_change_stage(p_telegram_chat_id, v_args);
  end if;

  -- (3) Fallback SIN cambiar n8n: un change_stage con VARIOS clientes (array clients, o client_name
  -- es una LISTA con comas / "A y B") se delega a bulk. La coma es senal fuerte de lista; el caso
  -- "A y B" sin coma solo si cada parte es un nombre corto (evita romper "Ferreteria y Materiales").
  if v_tool in ('change_stage','update_stage','move_stage') then
    if jsonb_typeof(v_args->'clients') = 'array' or jsonb_typeof(v_args->'client_names') = 'array' then
      return public.bot_bulk_change_stage(p_telegram_chat_id, v_args);
    end if;
    v_cn := trim(coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', ''));
    if v_cn <> '' and (position(',' in v_cn) > 0 or v_cn ~* '\yy\y') then
      v_has_comma := position(',' in v_cn) > 0;
      v_norm_list := regexp_replace(v_cn, '(?i)\s+y\s+|;|\n', ',', 'g');
      select count(*), coalesce(max(array_length(regexp_split_to_array(btrim(t.tok), '\s+'), 1)), 0)
        into v_parts, v_maxwords
      from regexp_split_to_table(v_norm_list, '\s*,\s*') as t(tok)
      where btrim(t.tok) <> '';
      if v_parts >= 2 and (v_has_comma or v_maxwords <= 2) then
        return public.bot_bulk_change_stage(p_telegram_chat_id, v_args || jsonb_build_object('clients', v_cn));
      end if;
    end if;
  end if;

  if v_tool in ('expense','gasto','registrar_gasto','register_expense','team_expense','obra_gasto','agenda_hoy','agenda','mi_dia','my_day') then
    select p.organization_id, coalesce(pc.expenses_enabled,false), coalesce(pc.team_requires_evidence,false)
      into v_org, v_expenses_enabled, v_team_requires_evidence
    from public.profiles p
    left join public.proactive_config pc on pc.organization_id = p.organization_id
    where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
    order by p.updated_at desc nulls last
    limit 1;

    if v_tool in ('expense','gasto','registrar_gasto','register_expense','team_expense','obra_gasto') and coalesce(v_expenses_enabled,false) then
      v_source := coalesce(nullif(btrim(v_args->>'source'), ''), nullif(btrim(v_args->>'fuente'), ''), 'texto');
      return public.bot_register_expense(p_telegram_chat_id, nullif(v_text,''), v_source);
    end if;

    if v_tool in ('agenda_hoy','agenda','mi_dia','my_day') and coalesce(v_team_requires_evidence,false) then
      return public.bot_agenda_hoy(p_telegram_chat_id);
    end if;
  end if;

  -- Desambiguacion de las acciones que editan un cliente por NOMBRE (cambiar etapa,
  -- fecha de Zoom, proxima accion). Si el nombre matchea >1 lead -> preguntar cual.
  if v_tool in ('change_stage','update_stage','move_stage',
                'set_zoom_datetime','update_zoom_datetime','zoom_date','set_zoom_date',
                'update_next_action','next_action_update','set_next_action') then
    v_name := nullif(trim(coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre','')),'');
    if v_name is not null and nullif(regexp_replace(v_name,'[^0-9]','','g'),'') is null then
      select count(*) into v_ncand from public.fn_bot_name_candidates(p_telegram_chat_id, v_name);
      if v_ncand > 1 then
        return public._bot_disambiguate(p_telegram_chat_id, 'gv_'||v_tool,
                 v_args || jsonb_build_object('input_text', v_text), v_name);
      end if;
    end if;
  end if;

  return public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, p_tool_name, p_args);
end;
$function$;
