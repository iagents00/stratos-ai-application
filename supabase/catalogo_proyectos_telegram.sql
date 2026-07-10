-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo de proyectos + consulta por Telegram (Duke del Caribe)
-- Aplicado en stratos-prod (glulgyhkrqpykxmujodb). Este archivo es la fuente de
-- verdad en GitHub de lo que vive en Supabase (las funciones/tabla se aplicaron vía MCP).
--
-- Resumen:
--   1) Tabla public.catalogo_proyectos (org-scoped, RLS igual que `projects`).
--   2) Carga: 572 desarrollos del Sheet "DRIVES DUKE DEL CARIBE" (import por http
--      desde tools/catalogo.seed.json; regenerable con tools/importar_catalogo.py).
--   3) bot_buscar_proyectos(tg, args): el "cerebro" que responde consultas del
--      catálogo (zona, top-N, campo libre) con links de Drive.
--   4) Wrapper de bot_nlu_dispatch_gvintell: rutea las consultas de catálogo a
--      bot_buscar_proyectos y delega TODO lo demás al dispatcher original intacto
--      (renombrado a *_orig). No se reescribió la lógica existente del bot.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) TABLA ---------------------------------------------------------------------
create table if not exists public.catalogo_proyectos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seccion         text,
  seccion_nombre  text,
  desarrollo      text not null,
  ubicacion       text,
  zona            text,
  masterbroker    text,
  ticket          text,
  clasificacion   text,
  tipologia       text,
  entrega         text,
  financiamiento  text,
  entrega_como    text,
  highlights      text,
  mantenimiento   text,
  contacto        text,
  asesor          text,
  drive           text,
  maps            text,
  visible         boolean not null default false,  -- solo las visibles se muestran (web + bot); el resto queda guardado y oculto
  created_at      timestamptz not null default now()
);

-- Visibilidad: solo se muestran las propiedades de la pestaña "DRIVES DC" del Sheet.
-- (No se borra nada; las demás quedan visible=false.) Para cambiar el set visible,
-- se edita esa pestaña, se re-importa y se corre este UPDATE.
-- alter table public.catalogo_proyectos add column if not exists visible boolean not null default false;
-- update public.catalogo_proyectos set visible = (seccion = 'drives-dc')
--   where organization_id = '00000000-0000-0000-0000-000000000001';
create index if not exists idx_catalogo_org on public.catalogo_proyectos(organization_id);
create index if not exists idx_catalogo_ubicacion on public.catalogo_proyectos(organization_id, lower(ubicacion));

alter table public.catalogo_proyectos enable row level security;
drop policy if exists catalogo_select on public.catalogo_proyectos;
create policy catalogo_select on public.catalogo_proyectos
  for select using (organization_id = current_organization_id());
drop policy if exists catalogo_insert_admin on public.catalogo_proyectos;
create policy catalogo_insert_admin on public.catalogo_proyectos
  for insert with check (organization_id = current_organization_id() and is_admin_or_above());
drop policy if exists catalogo_update_admin on public.catalogo_proyectos;
create policy catalogo_update_admin on public.catalogo_proyectos
  for update using (organization_id = current_organization_id() and is_admin_or_above());
drop policy if exists catalogo_delete_admin on public.catalogo_proyectos;
create policy catalogo_delete_admin on public.catalogo_proyectos
  for delete using (organization_id = current_organization_id() and is_admin_or_above());

-- 2) CARGA (idempotente) — lee el JSON del repo por http y expande a filas -------
-- create extension if not exists http with schema extensions;
-- delete from public.catalogo_proyectos where organization_id = '00000000-0000-0000-0000-000000000001';
-- insert into public.catalogo_proyectos
--   (organization_id, seccion, seccion_nombre, desarrollo, ubicacion, zona, masterbroker, ticket,
--    clasificacion, tipologia, entrega, financiamiento, entrega_como, highlights, mantenimiento, contacto, asesor, drive, maps)
-- select '00000000-0000-0000-0000-000000000001',
--   nullif(e->>'seccion',''), nullif(e->>'seccion_nombre',''), e->>'desarrollo',
--   nullif(e->>'ubicacion',''), nullif(e->>'zona',''), nullif(e->>'masterbroker',''), nullif(e->>'ticket',''),
--   nullif(e->>'clasificacion',''), nullif(e->>'tipologia',''), nullif(e->>'entrega',''), nullif(e->>'financiamiento',''),
--   nullif(e->>'entrega_como',''), nullif(e->>'highlights',''), nullif(e->>'mantenimiento',''), nullif(e->>'contacto',''),
--   nullif(e->>'asesor',''), nullif(e->>'drive',''), nullif(e->>'maps','')
-- from (select (extensions.http_get('https://raw.githubusercontent.com/iagents00/stratos-ai-application/main/tools/catalogo.seed.json')).content::jsonb as j) t,
--      jsonb_array_elements(t.j) as e;

-- 3) CEREBRO: búsqueda del catálogo --------------------------------------------
create or replace function public.bot_buscar_proyectos(p_telegram_chat_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_org uuid;
  v_text   text := trim(coalesce(p_args->>'input_text', p_args->>'text', p_args->>'texto', p_args->>'query',''));
  v_norm   text;
  v_rest   text;
  v_zona   text := nullif(trim(coalesce(p_args->>'zona', p_args->>'ubicacion','')),'');
  v_ticket text := nullif(trim(coalesce(p_args->>'ticket','')),'');
  v_top    int  := coalesce(nullif(p_args->>'top','')::int, nullif(p_args->>'limit','')::int, 0);
  v_terms  text[];
  v_total  int := 0;
  v_shown  int := 0;
  v_lines  text := '';
  v_head   text;
  v_filtros text := '';
  r record;
begin
  select p.organization_id into v_org
  from public.profiles p
  where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last
  limit 1;

  if v_org is null then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object(
      'text', 'Aún no te reconozco. Conectá tu Telegram desde el CRM (Perfil → Conectar Telegram) y volvé a preguntar por el catálogo.',
      'inline_keyboard', '[]'::jsonb));
  end if;

  v_norm := public.unaccent(lower(coalesce(v_text,'')));

  if v_zona is null then
    if v_norm ~ 'playa del carmen|(^| )playa( |$)|(^| )pdc( |$)' then v_zona := 'Playa del Carmen';
    elsif v_norm ~ 'tulum' then v_zona := 'Tulum';
    elsif v_norm ~ 'cancun' then v_zona := 'Cancun';
    elsif v_norm ~ 'merida' then v_zona := 'Merida';
    elsif v_norm ~ 'los cabos|(^| )cabo' then v_zona := 'Cabo';
    end if;
  end if;

  if v_top = 0 then
    v_top := coalesce((regexp_match(v_norm,'top\s*(\d+)'))[1]::int,
                      (regexp_match(v_norm,'(\d+)\s*(mejores|proyectos|propiedades|opciones|desarrollos)'))[1]::int, 0);
    if v_top = 0 then
      if    v_norm ~ '(^| )(un|uno|una)( |$)' then v_top := 1;
      elsif v_norm ~ '(^| )dos( |$)'          then v_top := 2;
      elsif v_norm ~ '(^| )tres( |$)'         then v_top := 3;
      elsif v_norm ~ '(^| )cuatro( |$)'       then v_top := 4;
      elsif v_norm ~ '(^| )cinco( |$)'        then v_top := 5;
      end if;
    end if;
  end if;
  if v_top <= 0 then v_top := 5; end if;
  if v_top > 15 then v_top := 15; end if;

  if v_ticket is null then
    if    v_norm ~ 'luxury|de lujo'                 then v_ticket := 'luxury';
    elsif v_norm ~ '450|500|800'                    then v_ticket := '450';
    elsif v_norm ~ '350'                            then v_ticket := '350';
    elsif v_norm ~ '250'                            then v_ticket := '250';
    elsif v_norm ~ '150|80k|economic|barat'         then v_ticket := '150';
    end if;
  end if;

  v_rest := v_norm;
  v_rest := regexp_replace(v_rest, 'recamaras?|habitacion(es)?|cuartos?', 'hab', 'g');
  v_rest := regexp_replace(v_rest, 'top\s*\d+|\d+\s*(mejores|opciones)|propiedad(es)?|proyectos?|desarrollos?|catalogo|busca(me|r)?|dame|muestrame|ensename|quiero|necesito|mejores|opciones|cerca del|frente al|vista al', ' ', 'g');
  v_rest := regexp_replace(v_rest, 'playa del carmen|tulum|cancun|merida|los cabos|(^| )cabo|(^| )pdc', ' ', 'g');
  select array_agg(w) into v_terms
  from (
    select distinct w
    from regexp_split_to_table(v_rest, '\s+') w
    where length(w) >= 3
      and w !~ '^(que|como|cual|cuales|cuantas|donde|hay|tienes|tiene|para|con|los|las|una|uno|del|mas|mar|zona|precio|rango)$'
  ) z
  where w is not null and w <> '';
  if v_norm ~ '(^| )mar( |$)|al mar|beach|frente al mar' then
    v_terms := coalesce(v_terms, '{}'::text[]) || array['mar'];
  end if;

  select count(*) into v_total
  from public.catalogo_proyectos cp
  where cp.organization_id = v_org
    and cp.visible = true
    and (v_zona is null or public.unaccent(lower(coalesce(cp.zona,'')||' '||coalesce(cp.ubicacion,''))) like '%'||public.unaccent(lower(v_zona))||'%')
    and (v_ticket is null
         or (v_ticket = 'luxury' and (lower(coalesce(cp.ticket,'')) like '%luxury%' or lower(coalesce(cp.clasificacion,'')) like '%lux%'))
         or lower(coalesce(cp.ticket,'')) like '%'||v_ticket||'%')
    and (coalesce(array_length(v_terms,1),0) = 0
         or (select count(*) from unnest(v_terms) t(term)
             where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') > 0);

  if v_total = 0 then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
      'text', 'No encontré desarrollos que cuadren con eso 🤔. Probá con una zona (Playa del Carmen, Tulum, Cancún…), un rango de precio, o una característica (ej: "2 recámaras cerca del mar", "top 3 en Tulum").',
      'inline_keyboard', '[]'::jsonb));
  end if;

  for r in
    select cp.*,
      (select count(*) from unnest(coalesce(v_terms,'{}'::text[])) t(term)
         where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') as score
    from public.catalogo_proyectos cp
    where cp.organization_id = v_org
      and cp.visible = true
      and (v_zona is null or public.unaccent(lower(coalesce(cp.zona,'')||' '||coalesce(cp.ubicacion,''))) like '%'||public.unaccent(lower(v_zona))||'%')
      and (v_ticket is null
           or (v_ticket = 'luxury' and (lower(coalesce(cp.ticket,'')) like '%luxury%' or lower(coalesce(cp.clasificacion,'')) like '%lux%'))
           or lower(coalesce(cp.ticket,'')) like '%'||v_ticket||'%')
      and (coalesce(array_length(v_terms,1),0) = 0
           or (select count(*) from unnest(v_terms) t(term)
               where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') > 0)
    order by
      (select count(*) from unnest(coalesce(v_terms,'{}'::text[])) t(term)
         where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') desc,
      (cp.seccion = 'top-desarrollos') desc,
      (cp.drive is not null) desc,
      cp.desarrollo asc
    limit v_top
  loop
    v_shown := v_shown + 1;
    v_lines := v_lines
      || format(E'\n\n%s. %s', v_shown, r.desarrollo)
      || case when coalesce(r.ubicacion, r.zona) is not null then ' — ' || coalesce(r.ubicacion, r.zona) else '' end
      || case when r.ticket is not null then ' · ' || r.ticket else '' end
      || case when r.tipologia is not null then ' · ' || r.tipologia else '' end
      || case when r.clasificacion is not null and r.tipologia is null then ' · ' || r.clasificacion else '' end
      || case when r.highlights is not null then E'\n   ➤ ' || r.highlights else '' end
      || case when r.masterbroker is not null then E'\n   🏢 ' || r.masterbroker else '' end
      || case when r.contacto is not null then E'\n   ☎ ' || r.contacto else '' end
      || case when r.drive is not null then E'\n   📁 ' || r.drive else '' end;
  end loop;

  if v_zona is not null then v_filtros := v_filtros || ' · ' || v_zona; end if;
  if v_ticket is not null then v_filtros := v_filtros || ' · ' || (case v_ticket when 'luxury' then 'Luxury' when '450' then '450k+' else v_ticket||'k' end); end if;

  v_head := format('🏗️ Catálogo Duke%s — %s resultado%s', v_filtros, v_total, case when v_total=1 then '' else 's' end);

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
    'text', v_head || v_lines
      || case when v_total > v_shown then format(E'\n\n… y %s más. Afiná por zona o rango de precio para verlos.', v_total - v_shown) else '' end,
    'inline_keyboard', '[]'::jsonb));
end;
$function$;

-- 4) WRAPPER del dispatcher (rename + wrap; el original NO se reescribe) ---------
-- alter function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) rename to bot_nlu_dispatch_gvintell_orig;
--
-- create or replace function public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb default '{}'::jsonb)
-- returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $wrap$
-- declare v_tool text := lower(coalesce(p_tool_name,'')); v_args jsonb := coalesce(p_args,'{}'::jsonb); v_text text; v_norm text;
-- begin
--   if jsonb_typeof(v_args->'query') = 'object' then
--     if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
--     if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
--   end if;
--   v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'texto', v_args->>'query',''));
--   v_norm := public.unaccent(lower(coalesce(v_text,'')));
--   if v_tool in ('buscar_proyectos','buscar_propiedades','buscar_catalogo','catalogo','propiedades','proyectos_catalogo') then
--     return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
--   end if;
--   if v_tool in ('', 'menu') and (
--        v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|departamento|departamentos|villa|villas|condo|condos|terreno|terrenos)\s+(en|de|cerca|con|para|arriba|baj|econom|barat)'
--     or v_norm ~ 'catalogo'
--     or v_norm ~ '(que|cuales|cuantas|muestrame|dame|busca|buscame|ensename|hay|tienes?)\s.*(propiedad|proyecto|desarrollo|departamento|villa|condo|terreno)'
--     or v_norm ~ 'top\s*\d+.*(propiedad|proyecto|desarrollo|departamento|villa|condo|zona|tulum|playa|cancun|merida|cabo)'
--   ) then
--     return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
--   end if;
--   return public.bot_nlu_dispatch_gvintell_orig(p_telegram_chat_id, p_tool_name, p_args);
-- end; $wrap$;
