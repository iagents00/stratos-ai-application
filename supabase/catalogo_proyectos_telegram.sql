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
--      catálogo (zona, top-N, precio, recámaras, "cerca del mar", campo libre) con links de Drive.
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

-- Visibilidad: solo se muestran las propiedades de la pestaña "Top Desarrollos" del Sheet
-- (seccion = 'top-desarrollos'). (No se borra nada; las demás quedan visible=false.)
-- Para cambiar el set visible, se ajusta qué seccion queda visible y se corre este UPDATE.
-- alter table public.catalogo_proyectos add column if not exists visible boolean not null default false;
-- update public.catalogo_proyectos set visible = (seccion = 'top-desarrollos')
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
-- Diseño (2026-07-10): el precio del Sheet está incompleto (~75% de las filas sin
-- ticket, y las que lo tienen en formatos mezclados MDP/USD/K). Por eso:
--   • ZONA es el único filtro DURO (zona/ubicacion están bien cargadas).
--   • Recámaras / "cerca del mar" / texto libre → filtran si hay match; si no,
--     caen a best-effort (mejores opciones) en vez de "no encontré".
--   • PRECIO → solo RANKEA (nunca excluye) + nota de transparencia al usuario.
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
  v_top    int  := coalesce(nullif(p_args->>'top','')::int, nullif(p_args->>'limit','')::int, 0);
  v_terms  text[] := '{}';          -- criterios de texto (filtran si hay match; si no, best-effort)
  v_price  text[] := '{}';          -- tokens de precio: SOLO rankean (datos incompletos)
  v_beds   int := 0;
  v_has_price boolean := false;
  v_has_criteria boolean := false;
  v_matched int := 0;
  v_use_filter boolean := false;
  v_total  int := 0;
  v_shown  int := 0;
  v_lines  text := '';
  v_head   text;
  v_note   text := '';
  v_num    text;
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

  -- ZONA (único filtro DURO)
  if v_zona is null then
    if    v_norm ~ 'playa del carmen|(^| )playa( |$)|(^| )pdc( |$)' then v_zona := 'Playa del Carmen';
    elsif v_norm ~ 'tulum'            then v_zona := 'Tulum';
    elsif v_norm ~ 'cancun'           then v_zona := 'Cancun';
    elsif v_norm ~ 'merida'           then v_zona := 'Merida';
    elsif v_norm ~ 'los cabos|(^| )cabo' then v_zona := 'Cabo';
    end if;
  end if;

  -- TOP N
  if v_top = 0 then
    v_top := coalesce((regexp_match(v_norm,'top\s*(\d+)'))[1]::int,
                      (regexp_match(v_norm,'(\d+)\s*(mejores|proyectos|propiedades|opciones|desarrollos|villas?|departamentos?|casas?)'))[1]::int, 0);
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

  -- PRECIO / PRESUPUESTO -> SOLO ranking (el ~75% del catálogo no tiene precio cargado)
  v_has_price := v_norm ~ '\d+\s*(k|mil|mdp|millon|usd|dolar|pesos|dls|dlls)|\$\s*\d|presupuesto|economic|barat|de lujo|luxury|premium';
  for v_num in select (arr)[1] from regexp_matches(v_norm, '(\d{2,4})\s*(k|mil|mdp)', 'g') arr loop
    v_price := v_price || array[v_num];
  end loop;
  if v_norm ~ 'de lujo|luxury|premium' then v_price := v_price || array['lux']; end if;

  -- RECÁMARAS -> criterio de texto (suave)
  v_beds := coalesce((regexp_match(v_norm,'(\d+)\s*(recamara|recamaras|habitacion|habitaciones|cuarto|cuartos|dormitor|rec|bd|br)'))[1]::int, 0);
  if v_beds > 0 then
    v_terms := v_terms || array[v_beds||' bd', v_beds||'bd', v_beds||' rec', v_beds||' recamara', v_beds||' hab'];
  end if;

  -- CERCA DEL MAR / FRENTE A LA PLAYA
  if v_norm ~ '(^| )mar( |$)|al mar|frente al mar|cerca del mar|vista al mar|beach' then
    v_terms := v_terms || array['mar'];
  end if;

  -- TÉRMINOS de texto libres (villa, terreno, condo, nombre del desarrollo, masterbroker…)
  v_rest := v_norm;
  v_rest := regexp_replace(v_rest, 'top\s*\d+|\d+\s*(mejores|opciones|recamaras?|habitacion(es)?|cuartos?|bd|br|rec)|propiedad(es)?|proyectos?|desarrollos?|catalogo|busca(me|r)?|dame|muestrame|ensename|quiero|necesito|mejores|opciones|cerca del|frente al|vista al|de lujo|luxury|premium', ' ', 'g');
  v_rest := regexp_replace(v_rest, 'playa del carmen|tulum|cancun|merida|los cabos|(^| )cabo|(^| )pdc|(^| )playa', ' ', 'g');
  v_rest := regexp_replace(v_rest, '\d+\s*(k|mil|mdp|millon(es)?|usd|dolar(es)?|pesos|dls|dlls)|\$|\d{2,}', ' ', 'g');
  v_terms := v_terms || coalesce((
    select array_agg(w) from (
      select distinct w
      from regexp_split_to_table(v_rest, '\s+') w
      where length(w) >= 4
        and w !~ '^(que|como|cual|cuales|cuantas|cuantos|donde|hay|tienes|tiene|para|con|los|las|una|unos|unas|del|mas|mar|zona|precio|rango|entre|desde|hasta|sobre|opcion|opciones|cerca|frente|vista|quiero|tengo|busco)$'
    ) z
  ), '{}'::text[]);

  v_has_criteria := coalesce(array_length(v_terms,1),0) > 0;

  -- ¿cuántos matchean los criterios de texto (dentro de la zona si hay)?
  if v_has_criteria then
    select count(*) into v_matched
    from public.catalogo_proyectos cp
    where cp.organization_id = v_org and cp.visible = true
      and (v_zona is null or public.unaccent(lower(coalesce(cp.zona,'')||' '||coalesce(cp.ubicacion,''))) like '%'||public.unaccent(lower(v_zona))||'%')
      and (select count(*) from unnest(v_terms) t(term)
             where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') > 0;
    v_use_filter := v_matched > 0;
  end if;

  if v_use_filter then
    v_total := v_matched;
  else
    select count(*) into v_total
    from public.catalogo_proyectos cp
    where cp.organization_id = v_org and cp.visible = true
      and (v_zona is null or public.unaccent(lower(coalesce(cp.zona,'')||' '||coalesce(cp.ubicacion,''))) like '%'||public.unaccent(lower(v_zona))||'%');
    if v_total = 0 and v_zona is not null then
      v_zona := null;
      select count(*) into v_total
      from public.catalogo_proyectos cp
      where cp.organization_id = v_org and cp.visible = true;
    end if;
  end if;

  if v_total = 0 then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
      'text', 'Todavía no hay propiedades cargadas en el catálogo. Avisá al equipo para publicarlas.',
      'inline_keyboard', '[]'::jsonb));
  end if;

  if v_has_criteria and not v_use_filter then
    v_note := E'\n\nNo encontré algo que cuadre exacto con eso, pero acá van las mejores opciones del catálogo 👇';
  elsif v_has_price then
    v_note := E'\n\n💡 Ojo: no todas las propiedades tienen precio cargado, así que el filtro por presupuesto es orientativo.';
  end if;

  for r in
    select cp.*,
      ( (select count(*) from unnest(v_terms) t(term)
           where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%')
        + (select count(*) from unnest(v_price) pp(tok)
           where public.unaccent(lower(coalesce(cp.ticket,''))) like '%'||tok||'%') ) as score
    from public.catalogo_proyectos cp
    where cp.organization_id = v_org and cp.visible = true
      and (v_zona is null or public.unaccent(lower(coalesce(cp.zona,'')||' '||coalesce(cp.ubicacion,''))) like '%'||public.unaccent(lower(v_zona))||'%')
      and (not v_use_filter
           or (select count(*) from unnest(v_terms) t(term)
                 where public.unaccent(lower(concat_ws(' ', cp.desarrollo, cp.ubicacion, cp.zona, cp.masterbroker, cp.ticket, cp.clasificacion, cp.tipologia, cp.highlights, cp.contacto))) like '%'||term||'%') > 0)
    order by score desc, (cp.drive is not null and cp.drive <> '') desc, cp.desarrollo asc
    limit v_top
  loop
    v_shown := v_shown + 1;
    -- Markdown-safe (Telegram envía con parse_mode Markdown por defecto): los links van como
    -- [texto](url) para PROTEGER los "_" de las URLs de Drive (si van crudos, un "_" abre cursiva
    -- y rompe el mensaje → Telegram lo rechaza con "can't parse entities" → silencio). Los campos
    -- de texto pasan por translate para neutralizar _ * [ ] por si algún dato los trae.
    v_lines := v_lines
      || format(E'\n\n%s. %s', v_shown, translate(coalesce(r.desarrollo,''),'_*[]','    '))
      || case when coalesce(r.ubicacion, r.zona) is not null then ' — ' || translate(coalesce(r.ubicacion, r.zona),'_*[]','    ') else '' end
      || case when r.ticket is not null then ' · ' || translate(r.ticket,'_*[]','    ') else '' end
      || case when r.tipologia is not null then ' · ' || translate(r.tipologia,'_*[]','    ') else '' end
      || case when r.clasificacion is not null and r.tipologia is null then ' · ' || translate(r.clasificacion,'_*[]','    ') else '' end
      || case when r.highlights is not null then E'\n   ➤ ' || translate(r.highlights,'_*[]','    ') else '' end
      || case when r.masterbroker is not null then E'\n   🏢 ' || translate(r.masterbroker,'_*[]','    ') else '' end
      || case when r.contacto is not null then E'\n   ☎ ' || translate(r.contacto,'_*[]','    ') else '' end
      || case when r.drive is not null and r.drive <> '' then E'\n   📁 [Ver detalle en Drive](' || r.drive || ')'
              when r.maps is not null and r.maps <> ''   then E'\n   📍 [Ubicación en Maps](' || r.maps || ')'
              else E'\n   📁 Detalle en Drive: pendiente de cargar (pídeselo al equipo)' end;
  end loop;

  v_head := '🏗️ Catálogo Duke'
    || case when v_zona is not null then ' · ' || v_zona else '' end
    || case when v_use_filter or v_zona is not null
            then format(' — %s resultado%s', v_total, case when v_total=1 then '' else 's' end)
            else format(' — top %s', v_shown) end;

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
    'text', v_head || v_lines
      || case when v_total > v_shown then format(E'\n\n… y %s más. Afiná por zona, característica o precio para acotar.', v_total - v_shown) else '' end
      || E'\n\n📂 Tocá "Ver detalle en Drive" en cada propiedad para ver fotos, planos y más info.'
      || v_note,
    'inline_keyboard', '[]'::jsonb));
end;
$function$;

-- 4) WRAPPER de ruteo -----------------------------------------------------------
-- El dispatcher original se renombró UNA vez a *_orig (idempotencia: correr solo si aún no existe):
-- alter function public.bot_nlu_dispatch_gvintell(bigint, text, jsonb) rename to bot_nlu_dispatch_gvintell_orig;
--
-- El wrapper detecta intención de CATÁLOGO y delega el resto al *_orig intacto.
-- Capas de ruteo:
--   (A) el LLM eligió explícitamente una herramienta de catálogo (buscar_proyectos, …).
--   (B) el LLM no eligió herramienta ('' / 'menu') y el texto tiene señal amplia de catálogo.
--   (B') el LLM mandó la consulta a una herramienta de LECTURA del CRM (quick_search,
--        dashboard, list_clients, …) PERO el texto es claramente de catálogo (señal fuerte).
--        Esto cubre el caso en que el clasificador confunde "propiedades" con "buscar cliente".
--        Las herramientas de ESCRITURA (upsert_lead, change_stage, assign_client, …) NO se
--        interceptan: nunca se desvía un registro/asignación al catálogo.
--   (C) todo lo demás → bot_nlu_dispatch_gvintell_orig (comportamiento original intacto).
create or replace function public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text;
  v_norm text;
  v_broad  boolean;
  v_strong boolean;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;
  v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'texto', v_args->>'query',''));
  v_norm := public.unaccent(lower(coalesce(v_text,'')));

  -- (A) Herramienta de catálogo elegida explícitamente por el LLM
  if v_tool in ('buscar_proyectos','buscar_propiedades','buscar_catalogo','catalogo','propiedades','proyectos_catalogo') then
    return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  -- Señales de intención de CATÁLOGO (inventario de inmuebles en venta)
  v_broad :=
       v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|departamento|departamentos|villa|villas|condo|condos|terreno|terrenos|inmueble|inmuebles)'
    or v_norm ~ 'catalogo'
    or v_norm ~ '(recamara|recamaras|habitacion|habitaciones)'
    or v_norm ~ '(cerca del mar|frente al mar|frente a la playa|vista al mar)'
    or v_norm ~ '\d+\s*(k|mil|mdp)\s*(a|-|y|hasta)\s*\d+'
    or (v_norm ~ 'top\s*\d+' and v_norm ~ '(\d+\s*(k|mil|mdp|usd|millon)|playa del carmen|tulum|cancun|merida|(^| )cabo)');

  v_strong :=
       v_norm ~ 'catalogo'
    or v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|inmueble|inmuebles|departamento|departamentos|villa|villas|condo|condos|terreno|terrenos)\s+(en|de|cerca|con|para|frente|dispon|hay|arriba|baj|econom|barat)'
    or v_norm ~ '(que|cuales|cuantas|cuantos|dame|muestrame|ensename|busca|buscame|hay|tienes?)\s.*(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|inmueble|inmuebles|departamento|villa|condo|terreno)'
    or v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|inmueble|departamento|villa|condo|terreno).*(playa del carmen|tulum|cancun|merida|(^| )cabo)'
    or v_norm ~ '\d+\s*(k|mil|mdp)\s*(a|-|y|hasta)\s*\d+'
    or (v_norm ~ 'top\s*\d+' and v_norm ~ '(\d+\s*(k|mil|mdp|usd|millon)|playa del carmen|tulum|cancun|merida|(^| )cabo|propiedad|proyecto|desarrollo|villa|departamento|terreno)')
    or ((v_norm ~ 'cerca del mar|frente al mar|frente a la playa|vista al mar') and v_norm ~ '(propiedad|proyecto|desarrollo|departamento|villa|condo|recamara|recamaras)');

  -- (B) El LLM no eligió herramienta (o mandó menú): señal amplia basta
  if v_tool in ('', 'menu') and v_broad then
    return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  -- (B') El LLM eligió una herramienta de LECTURA del CRM pero el texto es claramente de catálogo
  if v_tool in ('quick_search','list_clients','view_lead','dashboard','pipeline_summary','list_pending','list_expediente','search','lead_history') and v_strong then
    return public.bot_buscar_proyectos(p_telegram_chat_id, v_args || jsonb_build_object('input_text', v_text));
  end if;

  -- (C) Todo lo demás: comportamiento ORIGINAL intacto
  return public.bot_nlu_dispatch_gvintell_orig(p_telegram_chat_id, p_tool_name, p_args);
end;
$function$;
