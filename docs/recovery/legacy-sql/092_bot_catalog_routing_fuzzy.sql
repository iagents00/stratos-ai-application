-- 092_bot_catalog_routing_fuzzy.sql
-- Hardening: si el bot interpreta mal "mandame el drive de Tulum Country Club"
-- como busqueda de cliente, la BD lo redirige al catalogo antes de contestar
-- "Sin coincidencias".

create or replace function public._bot_catalog_normalize(p_text text)
returns text
language sql
immutable
set search_path to 'public','pg_temp'
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            public.unaccent(lower(coalesce(p_text,''))),
            '\m(tulun|tulm|tulumm|tulunm)\M', 'tulum', 'g'
          ),
          '\m(cuntry|contry|conutri|contr[iy]|countryy)\M', 'country', 'g'
        ),
        '\m(clu|clb|clubb|cliub)\M', 'club', 'g'
      ),
      '\m(desarollos|desarrolos|desarollo|desarolo)\M', 'desarrollos', 'g'
    ),
    '\m(proyctos|proyetos|proycto|proyeto)\M', 'proyectos', 'g'
  );
$$;

create or replace function public._bot_is_catalog_query(p_text text)
returns boolean
language plpgsql
immutable
set search_path to 'public','pg_temp'
as $$
declare
  v_norm text := public._bot_catalog_normalize(p_text);
begin
  return
       v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|desarrol|departamento|departamentos|villa|villas|condo|condos|terreno|terrenos|inmueble|inmuebles)'
    or v_norm ~ 'catalogo'
    or v_norm ~ '(recamara|recamaras|habitacion|habitaciones)'
    or v_norm ~ '(cerca del mar|frente al mar|frente a la playa|vista al mar)'
    or v_norm ~ '\d+\s*(k|mil|mdp)\s*(a|-|y|hasta)\s*\d+'
    or (v_norm ~ 'top\s*\d+' and v_norm ~ '(\d+\s*(k|mil|mdp|usd|millon)|playa del carmen|tulum|cancun|merida|(^| )cabo)')
    or v_norm ~ '(country\s+club|club\s+country|tulum\s+country)'
    or (v_norm ~ '(mandame|mandale|manda|pasame|pasa|dame|enviame|envia|info|detalle|detalles|drive|brochure|pdf|ficha)' and v_norm ~ '(playa del carmen|tulum|cancun|merida|(^| )cabo|country|club)');
end;
$$;

-- Wrap bot_nlu_dispatch tambien, porque algunos workflows productivos llaman
-- esta funcion directamente y no el wrapper gvintell.
do $$
begin
  if to_regprocedure('public.bot_nlu_dispatch_catalog_orig(bigint,text,jsonb)') is null
     and to_regprocedure('public.bot_nlu_dispatch(bigint,text,jsonb)') is not null then
    alter function public.bot_nlu_dispatch(bigint, text, jsonb) rename to bot_nlu_dispatch_catalog_orig;
  end if;
end $$;

create or replace function public.bot_nlu_dispatch(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;

  v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'texto', v_args->>'query', v_args->>'name', ''));

  if v_tool in ('buscar_proyectos','buscar_propiedades','buscar_catalogo','catalogo','propiedades','proyectos_catalogo') then
    return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  if v_tool in ('', 'menu', 'quick_search', 'search', 'list_clients', 'view_lead', 'dashboard', 'pipeline_summary', 'list_pending', 'list_expediente', 'lead_history')
     and public._bot_is_catalog_query(v_text) then
    return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  return public.bot_nlu_dispatch_catalog_orig(p_telegram_chat_id, p_tool_name, p_args);
end;
$$;

grant execute on function public._bot_catalog_normalize(text) to service_role;
grant execute on function public._bot_is_catalog_query(text) to service_role;
grant execute on function public.bot_nlu_dispatch(bigint, text, jsonb) to service_role;
revoke all on function public._bot_catalog_normalize(text) from public, anon, authenticated;
revoke all on function public._bot_is_catalog_query(text) from public, anon, authenticated;
revoke all on function public.bot_nlu_dispatch(bigint, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- El bot Stratos/Duke productivo (BOTv5) llama bot_nlu_dispatch_gvintell.
-- Este wrapper evita que consultas de catalogo caigan en quick_search de clientes.
do $$
begin
  if to_regprocedure('public.bot_nlu_dispatch_gvintell_catalog_orig(bigint,text,jsonb)') is null then
    alter function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) rename to bot_nlu_dispatch_gvintell_catalog_orig;
  end if;
end $$;

create or replace function public.bot_nlu_dispatch_gvintell(
  p_telegram_chat_id bigint,
  p_tool_name text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_text text := coalesce(p_args->>'input_text', p_args->>'text', p_args->>'texto', p_args->>'query', '');
  v_query text := coalesce(nullif(p_args->>'query',''), v_text);
  v_norm text := public._bot_catalog_normalize(coalesce(v_text,'') || ' ' || coalesce(v_query,''));
  v_catalog_args jsonb;
begin
  if public._bot_is_catalog_query(v_norm)
     and v_tool in ('', 'menu', 'quick_search', 'search', 'list_clients', 'view_lead', 'dashboard', 'pipeline_summary', 'list_pending', 'list_expediente', 'lead_history') then

    v_catalog_args := coalesce(p_args, '{}'::jsonb)
      || jsonb_build_object('input_text', trim(v_norm), 'query', trim(v_norm));

    if v_norm ~ '\m(country club|club country|tulum country|country\s+club)\M' then
      v_catalog_args := v_catalog_args || jsonb_build_object('input_text', 'tulum country club', 'query', 'tulum country club', 'top', 1);
    elsif v_norm ~ '\m(mandame|mandale|manda|dame|pasame|envia|enviame)\M.*\m(el|la|de|del)\M' then
      v_catalog_args := v_catalog_args || jsonb_build_object('top', 1);
    end if;

    return public.bot_buscar_proyectos(p_telegram_chat_id, v_catalog_args);
  end if;

  return public.bot_nlu_dispatch_gvintell_catalog_orig(p_telegram_chat_id, p_tool_name, p_args);
end;
$$;

grant execute on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) to service_role;
revoke all on function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
