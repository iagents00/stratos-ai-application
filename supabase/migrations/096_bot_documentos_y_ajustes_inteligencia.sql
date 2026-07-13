-- ============================================================================
-- 096 — Bot Telegram (Stratos): Documentos "Mi Espacio" (Fase 2) + ajustes de
--       inteligencia sobre la capa bot_smart_queries (095).
-- Aplicado en stratos-prod vía MCP (2026-07-13). Sin tocar n8n.
--
-- SEPARACIÓN DE APARTADOS (clave):
--   * DOCUMENTOS (Mi Espacio, organizations.meta_config->'documents'):
--       se activa con "mi espacio" / "mis documentos" / nombrar el proveedor
--       (notion/excel/sheet/figma/sop). GANA sobre el catálogo (guard en el ENTRY).
--   * CATÁLOGO (proyectos/desarrollos/propiedades): propiedades/proyectos/zona/
--       precio/"drive de <proyecto>". Sin cambios.
--   * Si duda dentro de documentos -> RE-PREGUNTA con la lista.
--
-- AJUSTES DE INTELIGENCIA (en bot_smart_queries):
--   * "clientes de <asesor>" flexible ("clientes recientes de gael",
--     "que tenga el asesor prueba").
--   * "kpis de <asesor>"  -> bot_kpis_asesor (admin: de cualquiera; asesor: solo suyo).
--   * "próxima acción de <cliente>" (READ) -> bot_proxima_accion_cliente.
--   * "presupuesto/datos/teléfono/etapa de <cliente>" -> bot_ficha_cliente.
--   * Parser de presupuesto: PREFIERE el número con unidad ("3 clientes ... 200k"
--     ya no interpreta 3K).
--   * Presupuesto + filtro por asesor ("clientes de Cecilia con presupuesto > 200K").
--
-- ROLES (verificado): un asesor normal NUNCA ve KPIs/clientes de otro asesor
--   (se deniega con mensaje). Admin/ver-todo sí.
--
-- NOTA: los cuerpos completos y actuales viven en la base (pg_get_functiondef).
-- Abajo van las piezas NUEVAS de documentos + el parser + el cableado. El router
-- bot_smart_queries y las funciones-intención (bot_kpis_asesor, bot_ficha_cliente,
-- bot_proxima_accion_cliente, bot_buscar_presupuesto) se aplicaron por MCP y se
-- documentan en memory/reports/2026-07-13-bot-telegram-consultas-inteligentes.md.
--
-- REVERT:
--   * Quitar el guard de documentos del ENTRY (bloque al final, comentado).
--   * drop function bot_documentos_espacio, _bot_is_docs_query, _bot_doc_prov,
--     bot_kpis_asesor, bot_proxima_accion_cliente, bot_ficha_cliente.
--   * Restaurar bot_smart_queries / bot_buscar_presupuesto / fn_parse_budget_k previas.
-- ============================================================================

-- Etiqueta de proveedor a partir del "kind" del documento
create or replace function public._bot_doc_prov(p_kind text)
returns text language sql immutable as $fn$
  select case p_kind
    when 'notion' then 'Notion' when 'drive' then 'Google Drive' when 'sheet' then 'Google Sheets'
    when 'doc' then 'Google Docs' when 'slide' then 'Google Slides' when 'figma' then 'Figma'
    when 'onedrive' then 'OneDrive' else 'enlace' end;
$fn$;

-- ¿Es una consulta de DOCUMENTOS de mi espacio? Señal fuerte ("mi espacio") siempre;
-- proveedor (notion/excel/sop) solo si es pedido de recuperar y NO es nota/acción/recordatorio.
create or replace function public._bot_is_docs_query(p_norm text)
returns boolean language sql immutable as $fn$
  select coalesce(
    ( p_norm ~ 'mi\s*espacio'
      or p_norm ~ '\y(mis|los)\s+documentos\y'
      or p_norm ~ 'documentos?\s+(del|de)\s+equipo' )
    or
    ( ( p_norm ~ '\y(notion|figma)\y'
        or p_norm ~ '(hoja de calculo|planilla|spreadsheet|\yexcel\y)'
        or p_norm ~ '\ysop\s*\d' )
      and p_norm ~ '(pasa|manda|envia|dame|abri|abre|muestra|mostra|necesit|quiero|comparte|compartir|link|enlace|donde esta|tenes|tienes|ensename)'
      and not ( p_norm ~ '\y(agenda|pendient|recorda|tarea|zoom|cita|visita|gasto|comision|nota|apunte|observ|nuevo cliente|agrega|crea|registra|mueve|mover|cambi|etapa|asigna)\y' )
    ),
  false);
$fn$;

-- Parser de presupuesto (prefiere números con unidad)
create or replace function public.fn_parse_budget_k(p_text text)
returns jsonb language plpgsql immutable as $fn$
declare
  t text := lower(public.unaccent(coalesce(p_text,'')));
  ks_all numeric[] := array[]::numeric[]; ks_unit numeric[] := array[]::numeric[]; ks numeric[];
  g text[]; n numeric; u text; k numeric; v_min numeric; v_max numeric; v_mode text;
begin
  for g in select regexp_matches(t, '(\d[\d.,]*)\s*(millones|millon|mill|mdp|miles|mil|k|m)?\M', 'g') loop
    n := nullif(regexp_replace(replace(g[1],',',''), '\.(?=.*\.)', '', 'g'), '')::numeric;
    if n is null then continue; end if;
    u := coalesce(g[2],'');
    if u in ('millones','millon','mill','mdp','m') then k := n*1000;
    elsif u in ('mil','miles','k') then k := n;
    else k := case when n >= 10000 then round(n/1000.0) else n end; end if;
    ks_all := ks_all || round(k);
    if u <> '' or n >= 10000 then ks_unit := ks_unit || round(k); end if;
  end loop;
  ks := case when array_length(ks_unit,1) is not null then ks_unit else ks_all end;
  if array_length(ks,1) is null then return jsonb_build_object('mode','none'); end if;
  if t ~ '\yentre\y' and array_length(ks,1) >= 2 then
    v_min := least(ks[1],ks[2]); v_max := greatest(ks[1],ks[2]); v_mode := 'range';
  elsif t ~ '(menos de|hasta|maximo|max\y|por debajo|no mas de|menor|debajo de|<=?)' then v_max := ks[1]; v_mode := 'lte';
  elsif t ~ '(mas de|arriba de|minimo|desde|por encima|mayor|superior|>=?|excede)' then v_min := ks[1]; v_mode := 'gte';
  else v_min := ks[1]; v_max := ks[1]; v_mode := 'exact'; end if;
  return jsonb_build_object('mode', v_mode, 'min_k', v_min, 'max_k', v_max);
end;
$fn$;

-- bot_documentos_espacio: cuerpo aplicado por MCP (lee meta_config->'documents',
-- puntúa por título/tipo, envía link, re-pregunta si hay varios). Ver DB / reporte.

-- CABLEADO: guard de documentos en el ENTRY, ANTES del catálogo/agenda.
--   (Aplicado por MCP con replace sobre pg_get_functiondef; equivalente a insertar
--    tras la línea de v_norm := public._bot_agenda_norm(...):)
--   if public._bot_is_docs_query(v_norm) then
--     return public.bot_documentos_espacio(p_telegram_chat_id,
--              coalesce(p_args,'{}'::jsonb) || jsonb_build_object('input_text', v_text));
--   end if;
--
-- REVERT del guard: recrear bot_nlu_dispatch_gvintell sin ese bloque.
