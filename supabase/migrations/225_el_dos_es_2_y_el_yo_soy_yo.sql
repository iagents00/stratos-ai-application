-- mig 225 — «Pepito prueba 2» ES «Pepito prueba dos», y «yo» soy yo (pruebas de Ángel 30-jul):
--   · El buscador de clientes del cerebro CRM (bot_nlu_dispatch_gvintell_v2) matcheaba el nombre
--     con ilike pelado: «Pepito prueba 2» no encontraba al lead guardado como «Pepito prueba dos».
--     Ahora ambos lados pasan por fn_norm_nombre (minúsculas + sin acentos + dos↔2 … diez↔10).
--   · «¿Cuál es el número de Pepito prueba 2?» iba a bot_get_lead_by_phone con el NOMBRE como
--     argumento → «invalid_phone» → «Algo salió mal». Ahora: si el texto trae letras y no un
--     teléfono real (≥7 dígitos), busca por nombre normalizado con la misma visibilidad de siempre.
--   · Dictar «una tarea para mí / yo» pasaba el literal «yo» a _ventas_find_profile → «No encontré
--     a yo». Ahora «yo / para mí / conmigo…» se traduce al nombre de quien dicta ANTES de buscar.
-- Reversible: CREATE OR REPLACE con los cuerpos anteriores (backup diario); fn_norm_nombre se
-- puede dropear sin tocar datos.

create or replace function public.fn_norm_nombre(p_texto text)
returns text
language sql
stable
as $fn$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(public.unaccent(coalesce(p_texto,''))),
           '\m(una|uno)\M','1','g'),
           '\mdos\M','2','g'),
           '\mtres\M','3','g'),
           '\mcuatro\M','4','g'),
           '\mcinco\M','5','g'),
           '\mseis\M','6','g'),
           '\msiete\M','7','g'),
           '\mocho\M','8','g'),
           '\mnueve\M','9','g'),
           '\mdiez\M','10','g')
$fn$;

do $mig$
declare
  v_src text; v_cnt int;
  v_old_name text; v_new_name text;
  v_old_client text; v_new_client text;
  v_anchor text; v_yo text;
begin
  -- a) bot_nlu_dispatch_gvintell_v2: los 4 buscadores de leads matchean con nombre normalizado
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'bot_nlu_dispatch_gvintell_v2';

  v_old_name := 'public.unaccent(coalesce(l2.name,'''')) ilike public.unaccent(''%''||v_name||''%'')';
  v_new_name := 'public.fn_norm_nombre(l2.name) like ''%''||public.fn_norm_nombre(v_name)||''%''';
  v_cnt := (length(v_src) - length(replace(v_src, v_old_name, ''))) / length(v_old_name);
  if v_cnt <> 3 then raise exception 'mig225 matcher v_name: esperaba 3, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old_name, v_new_name);

  v_old_client := 'public.unaccent(coalesce(l2.name,'''')) ilike public.unaccent(''%''||v_client_name||''%'')';
  v_new_client := 'public.fn_norm_nombre(l2.name) like ''%''||public.fn_norm_nombre(v_client_name)||''%''';
  v_cnt := (length(v_src) - length(replace(v_src, v_old_client, ''))) / length(v_old_client);
  if v_cnt <> 1 then raise exception 'mig225 matcher v_client_name: esperaba 1, hay %', v_cnt; end if;
  v_src := replace(v_src, v_old_client, v_new_client);

  execute 'create or replace function public.bot_nlu_dispatch_gvintell_v2(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb default ''{}''::jsonb) returns jsonb language plpgsql security definer set search_path to ''public'', ''pg_temp'' as ' || quote_literal(v_src);

  -- b) bot_create_team_actions: «yo / para mí» = quien dicta, no un nombre a buscar en el equipo
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'bot_create_team_actions';

  v_anchor := 'v_pedido := nullif(btrim(coalesce(r->>''responsable'','''')), '''');';
  v_cnt := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
  if v_cnt <> 1 then raise exception 'mig225 ancla responsable: esperaba 1, hay %', v_cnt; end if;
  v_yo := v_anchor || chr(10) ||
    '    -- mig 225: «yo / para mí» se refiere a quien dicta' || chr(10) ||
    '    if v_pedido is not null and lower(public.unaccent(v_pedido)) in (''yo'',''a mi'',''mi'',''para mi'',''me'',''conmigo'',''yo mismo'',''yo misma'',''mi mismo'',''mi misma'') then' || chr(10) ||
    '      v_pedido := v_jefe.name;' || chr(10) ||
    '    end if;';
  v_src := replace(v_src, v_anchor, v_yo);

  execute 'create or replace function public.bot_create_team_actions(p_telegram_chat_id bigint, p_tareas jsonb, p_confirmar boolean default false) returns jsonb language plpgsql security definer set search_path to ''public'' as ' || quote_literal(v_src);
end $mig$;

create or replace function public.bot_get_lead_by_phone(p_telegram_chat_id bigint, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
DECLARE v_asesor RECORD; v_phone_norm TEXT; v_lead RECORD; v_es_admin boolean;
BEGIN
  SELECT id, role, organization_id INTO v_asesor FROM public.profiles WHERE telegram_chat_id = p_telegram_chat_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'asesor_not_paired'); END IF;
  v_es_admin := v_asesor.role IN ('super_admin','admin','ceo','director');
  v_phone_norm := NULLIF(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  IF v_phone_norm IS NOT NULL AND length(v_phone_norm) >= 7 THEN
    -- un teléfono de verdad (aunque venga con texto alrededor): igual que siempre
    SELECT * INTO v_lead FROM public.leads WHERE organization_id = v_asesor.organization_id AND phone_normalized = v_phone_norm AND deleted_at IS NULL LIMIT 1;
  ELSIF public.unaccent(coalesce(p_phone,'')) ~* '[a-z]' THEN
    -- mig 225: mandaron un NOMBRE («¿el número de Pepito prueba 2?») → buscar por nombre
    -- normalizado (dos↔2), respetando la misma visibilidad del chequeo de abajo
    SELECT * INTO v_lead FROM public.leads l
    WHERE l.organization_id = v_asesor.organization_id AND l.deleted_at IS NULL
      AND public.fn_norm_nombre(l.name) like '%'||public.fn_norm_nombre(p_phone)||'%'
      AND (v_es_admin OR l.asesor_id = v_asesor.id OR l.asesor_id IS NULL)
    ORDER BY l.updated_at DESC NULLS LAST LIMIT 1;
  ELSIF v_phone_norm IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.leads WHERE organization_id = v_asesor.organization_id AND phone_normalized = v_phone_norm AND deleted_at IS NULL LIMIT 1;
  ELSE
    RETURN jsonb_build_object('error', 'invalid_phone');
  END IF;
  IF v_lead.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  IF v_lead.asesor_id IS NOT NULL AND v_lead.asesor_id <> v_asesor.id AND NOT v_es_admin THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object('found', true, 'lead', jsonb_build_object(
    'id', v_lead.id, 'name', v_lead.name, 'phone', v_lead.phone, 'email', v_lead.email,
    'stage', v_lead.stage, 'score', v_lead.score, 'hot', v_lead.hot, 'budget', v_lead.budget,
    'presupuesto', v_lead.presupuesto, 'project', v_lead.project, 'campaign', v_lead.campaign,
    'bio', v_lead.bio, 'seguimientos', v_lead.seguimientos, 'next_action', v_lead.next_action,
    'next_action_at', v_lead.next_action_at, 'last_activity', v_lead.last_activity,
    'asesor_name', v_lead.asesor_name, 'notas', v_lead.notas,
    'created_at', v_lead.created_at, 'updated_at', v_lead.updated_at
  ));
END; $fn$;