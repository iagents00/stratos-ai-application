-- ============================================================================
-- 095 — Bot Telegram (Stratos): CONSULTAS INTELIGENTES (7 fixes de UX)
-- ----------------------------------------------------------------------------
-- Contexto: rollout a asesores de Duke (transcripción 2026-07-13). Se testeó el
-- bot y se enlistaron los errores desde la perspectiva de un asesor NO técnico.
-- Este archivo arregla los 7 apartados que fallaban, sin tocar n8n.
--
-- Arquitectura (adaptable): se inserta UNA capa nueva `bot_smart_queries` en la
-- cadena de responsabilidad existente, ENTRE `_orig` y `_inner`:
--   bot_nlu_dispatch_gvintell  (agenda personal)
--     -> _agenda_orig          (catálogo v1)
--       -> _catalog_orig       (catálogo v2)
--         -> _orig             (bulk/expense/desambiguación)
--           -> bot_smart_queries  <== NUEVA CAPA (fixes 1..7)
--             -> _inner        (ruteo base a los 6 tools)
--               -> _v2 -> core
-- Si nada matchea, delega hacia abajo: comportamiento original 100% intacto.
--
-- Fixes:
--  1. Menú/"¿qué podés hacer?" -> lista de capacidades con ejemplos (bot_render_capabilities)
--  2. "clientes con presupuesto de 200K" -> filtra el campo presupuesto (no el teléfono) (bot_buscar_presupuesto)
--  3. "el más hot de <asesor>" -> top lead por score (bot_top_hot_asesor)
--  4. "clientes de <asesor>" -> filtra por asesor; admin ve de cualquiera (bot_clientes_de_asesor)
--  5. Reconocer ASESORES por nombre (bot_asesor_info)
--  6. "última acción de <cliente>" + búsqueda SIN acentos (bot_ultima_accion + fix accent en bot_list_expediente_v2)
--  7. Si duda (nombre = cliente Y asesor, varios matches) -> RE-PREGUNTA en vez de adivinar
--
-- Reversibilidad:
--   * Desconectar la capa:  volver a poner en `bot_nlu_dispatch_gvintell_orig`
--     la llamada final a `bot_nlu_dispatch_gvintell_inner` (ver bloque al final).
--   * Borrar las funciones nuevas (bot_smart_queries, bot_buscar_presupuesto, etc.).
--   * bot_list_expediente_v2: restaurar la versión previa (CREATE OR REPLACE).
-- Nada borra datos. Todo es CREATE OR REPLACE / funciones nuevas.
-- ============================================================================

-- ------------------------------------------------------------------ HELPERS --
create or replace function public.fn_presupuesto_k(p_val numeric)
returns numeric language sql immutable as $fn$
  select case
    when p_val is null then null
    when p_val >= 10000 then round(p_val/1000.0)   -- datos mezclados: 200000 -> 200 (K)
    else round(p_val)                              -- 200 ya está en miles
  end;
$fn$;

create or replace function public.fn_parse_budget_k(p_text text)
returns jsonb language plpgsql immutable as $fn$
declare
  t text := lower(public.unaccent(coalesce(p_text,'')));
  ks numeric[] := array[]::numeric[];
  g text[]; n numeric; u text; k numeric;
  v_min numeric; v_max numeric; v_mode text;
begin
  for g in
    select regexp_matches(t, '(\d[\d.,]*)\s*(millones|millon|mill|mdp|miles|mil|k|m)?\M', 'g')
  loop
    n := nullif(regexp_replace(replace(g[1],',',''), '\.(?=.*\.)', '', 'g'), '')::numeric;
    if n is null then continue; end if;
    u := coalesce(g[2],'');
    if u in ('millones','millon','mill','mdp','m') then k := n * 1000;
    elsif u in ('mil','miles','k') then k := n;
    else k := case when n >= 10000 then round(n/1000.0) else n end;
    end if;
    ks := ks || round(k);
  end loop;

  if array_length(ks,1) is null then return jsonb_build_object('mode','none'); end if;

  if t ~ '\yentre\y' and array_length(ks,1) >= 2 then
    v_min := least(ks[1], ks[2]); v_max := greatest(ks[1], ks[2]); v_mode := 'range';
  elsif t ~ '(menos de|hasta|maximo|max\y|por debajo|no mas de|menor|debajo de|<=?)' then
    v_max := ks[1]; v_mode := 'lte';
  elsif t ~ '(mas de|arriba de|minimo|desde|por encima|mayor|superior|>=?|excede)' then
    v_min := ks[1]; v_mode := 'gte';
  else
    v_min := ks[1]; v_max := ks[1]; v_mode := 'exact';
  end if;

  return jsonb_build_object('mode', v_mode, 'min_k', v_min, 'max_k', v_max);
end;
$fn$;

create or replace function public.fn_bot_find_asesores(p_org uuid, p_name text)
returns table(asesor_id uuid, asesor_name text, role text)
language plpgsql stable security definer set search_path to 'public','pg_temp' as $fn$
declare v_ref text := nullif(btrim(coalesce(p_name,'')),'');
begin
  if v_ref is null or p_org is null then return; end if;
  return query
  select pr.id, pr.name, pr.role
  from public.profiles pr
  where pr.organization_id = p_org and coalesce(pr.active,true) = true and pr.name is not null
    and public.unaccent(lower(pr.name)) ilike '%'||public.unaccent(lower(v_ref))||'%'
  order by (case when public.unaccent(lower(pr.name)) = public.unaccent(lower(v_ref)) then 0
                 when public.unaccent(lower(pr.name)) ilike public.unaccent(lower(v_ref))||'%' then 1
                 else 2 end), length(pr.name) asc
  limit 10;
end;
$fn$;

create or replace function public._bot_smart_reask(p_text text)
returns jsonb language sql immutable as $fn$
  select jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text', p_text, 'parse_mode', null,
    'inline_keyboard', jsonb_build_array(jsonb_build_array(public._bot_btn('Menú','menu')))));
$fn$;

create or replace function public._bot_fmt_k(p_k numeric)
returns text language sql immutable as $fn$
  select case
    when p_k is null then '—'
    when p_k >= 1000 then '$'||trim(to_char(p_k/1000.0,'FM999990.0'))||'M'
    else '$'||trim(to_char(p_k,'FM999990'))||'K'
  end;
$fn$;

create or replace function public._bot_requester(p_chat bigint)
returns table(org uuid, pid uuid, role text, view_all boolean)
language sql stable security definer set search_path to 'public','pg_temp' as $fn$
  select p.organization_id, p.id, coalesce(p.role,'asesor'),
         (coalesce(p.role,'asesor') in ('super_admin','admin','ceo','director') or coalesce(p.view_all_leads,false))
  from public.profiles p
  where p.telegram_chat_id = p_chat and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
$fn$;

create or replace function public._bot_extract_person(p_norm text, p_extra text[] default '{}')
returns text language plpgsql immutable as $fn$
declare
  v text := ' '||coalesce(p_norm,'')||' '; w text;
  gen text[] := array['el','la','los','las','un','una','unos','unas','de','del','con','a','al','y','o',
    'que','cual','cuales','cuando','quien','quienes','como','donde','cuanto','cuantos','cuanta','cuantas',
    'fue','se','hizo','es','son','mi','mis','tu','tus','su','sus','dime','dame','muestrame','ensename',
    'quiero','saber','ver','por','favor','porfa','hoy','ahora','me','le','lo','para','the','sobre','esta',
    'este','estan','tiene','tienen','hay','fueron','ha'];
begin
  foreach w in array (gen || coalesce(p_extra,'{}')) loop
    v := regexp_replace(v, '\y'||w||'\y', ' ', 'gi');
  end loop;
  v := regexp_replace(v, '[^a-z0-9ñ ]', ' ', 'gi');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  return nullif(v,'');
end;
$fn$;

-- --------------------------------------------------------- FUNCIONES-INTENCIÓN
-- (Los cuerpos idénticos a producción; ver detalle en cada fix.)
-- FIX 2
create or replace function public.bot_buscar_presupuesto(p_chat bigint, p_args jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $fn$
declare
  v_org uuid; v_pid uuid; v_role text; v_view_all boolean; v_tz text;
  v_text text := trim(coalesce(p_args->>'input_text', p_args->>'text', p_args->>'query',''));
  v_p jsonb; v_mode text; v_min numeric; v_max numeric;
  v_total int; v_lines text; v_shown int; v_desc text;
begin
  select org,pid,role,view_all into v_org,v_pid,v_role,v_view_all from public._bot_requester(p_chat);
  if v_org is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No estás conectado al CRM. Usá /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org, p_chat);
  v_p := public.fn_parse_budget_k(v_text);
  v_mode := v_p->>'mode'; v_min := nullif(v_p->>'min_k','')::numeric; v_max := nullif(v_p->>'max_k','')::numeric;
  if v_mode = 'none' then
    return public._bot_smart_reask('¿De qué presupuesto? Decime un monto, por ej.: "clientes con presupuesto de 200K", "entre 200K y 300K", o "más de 1M".');
  end if;
  v_desc := case v_mode
    when 'exact' then 'de '||public._bot_fmt_k(v_min)
    when 'range' then 'entre '||public._bot_fmt_k(v_min)||' y '||public._bot_fmt_k(v_max)
    when 'gte'   then 'de más de '||public._bot_fmt_k(v_min)
    when 'lte'   then 'de hasta '||public._bot_fmt_k(v_max) else '' end;
  select count(*) into v_total from (
    select public.fn_presupuesto_k(l.presupuesto) as pk from public.leads l
    where l.organization_id=v_org and l.deleted_at is null and (v_view_all or l.asesor_id=v_pid)
  ) b where pk is not null and (
    (v_mode='exact' and pk=v_min) or (v_mode='range' and pk between v_min and v_max)
    or (v_mode='gte' and pk>=v_min) or (v_mode='lte' and pk<=v_max));
  if coalesce(v_total,0)=0 then
    return public._bot_smart_reask('No encontré clientes con presupuesto '||v_desc||
      case when v_view_all then '.' else ' en tu cartera.' end||' ¿Probamos otro monto o un rango (ej. "entre 150K y 250K")?');
  end if;
  select string_agg(line, E'\n'), count(*) into v_lines, v_shown from (
    select '• '||coalesce(l.name,'(sin nombre)')||' — 💰 '||public._bot_fmt_k(l.pk)
           ||' — '||coalesce(nullif(l.stage,''),'sin etapa')||' — 📱 '||coalesce(nullif(l.phone,''),'sin teléfono') as line
    from (
      select b.*, public.fn_presupuesto_k(b.presupuesto) pk from public.leads b
      where b.organization_id=v_org and b.deleted_at is null and (v_view_all or b.asesor_id=v_pid)
        and public.fn_presupuesto_k(b.presupuesto) is not null
        and ((v_mode='exact' and public.fn_presupuesto_k(b.presupuesto)=v_min)
          or (v_mode='range' and public.fn_presupuesto_k(b.presupuesto) between v_min and v_max)
          or (v_mode='gte' and public.fn_presupuesto_k(b.presupuesto) >= v_min)
          or (v_mode='lte' and public.fn_presupuesto_k(b.presupuesto) <= v_max))
      order by b.hot desc nulls last, b.score desc nulls last, b.updated_at desc nulls last limit 20
    ) l ) s;
  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text','Clientes con presupuesto '||v_desc||' ('||v_total||
           case when v_total>v_shown then ', muestro los '||v_shown||' más calientes' else '' end||'):'||E'\n'||v_lines||
           case when v_total>v_shown then E'\n\nPara verlos todos, abrí el CRM web.' else '' end,
    'parse_mode',null,'inline_keyboard','[]'::jsonb));
end;
$fn$;

-- NOTA: bot_asesor_info, bot_clientes_de_asesor, bot_top_hot_asesor, bot_ultima_accion,
-- bot_render_capabilities y bot_smart_queries se aplicaron vía MCP apply_migration en
-- stratos-prod (2026-07-13). Ver el cuerpo exacto en la base (pg_get_functiondef) o en
-- memory/reports/2026-07-13-bot-telegram-consultas-inteligentes.md del AIOS.
-- Este archivo documenta la intención y los helpers; la base es la fuente viva.

-- ------------------------------------------------------ CABLEADO DE LA CAPA ---
-- Inserta bot_smart_queries entre _orig y _inner sin re-transcribir _orig:
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.bot_nlu_dispatch_gvintell_orig(bigint,text,jsonb)'::regprocedure) into v_def;
  v_def := replace(v_def,
    'public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, p_tool_name, p_args)',
    'public.bot_smart_queries(p_telegram_chat_id, p_tool_name, p_args)');
  execute v_def;
end $$;

-- FIX 6 (parte b): bot_list_expediente_v2 accent-insensitive (ficha/notas de X):
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.bot_list_expediente_v2(bigint,text)'::regprocedure) into v_def;
  v_def := replace(v_def, 'or l.name ilike ''%''||v_ref||''%''',
    'or public.unaccent(lower(l.name)) ilike ''%''||public.unaccent(lower(v_ref))||''%''');
  v_def := replace(v_def,
    'case when lower(l.name)=lower(v_ref) then 0 when l.name ilike v_ref||''%'' then 1 else 2 end',
    'case when public.unaccent(lower(l.name))=public.unaccent(lower(v_ref)) then 0 when public.unaccent(lower(l.name)) ilike public.unaccent(lower(v_ref))||''%'' then 1 else 2 end');
  execute v_def;
end $$;

-- ------------------------------------------------------------- REVERT (manual)
-- Desconectar la capa nueva (deja todo lo demás intacto):
-- do $$ declare v_def text; begin
--   select pg_get_functiondef('public.bot_nlu_dispatch_gvintell_orig(bigint,text,jsonb)'::regprocedure) into v_def;
--   v_def := replace(v_def,'public.bot_smart_queries(p_telegram_chat_id, p_tool_name, p_args)',
--                          'public.bot_nlu_dispatch_gvintell_inner(p_telegram_chat_id, p_tool_name, p_args)');
--   execute v_def; end $$;
